const express = require('express');
const cors = require('cors');
const { OpenAI } = require('openai');
require('dotenv').config();

const { parseCsv, formatCsvForPrompt } = require('./processCsv');
const { parsePdf, formatPdfForPrompt } = require('./processPdf');
const { parseDocx, formatDocxForPrompt } = require('./processDocx');
const { parseXlsx, formatXlsxForPrompt } = require('./processXlsx');
const { parseTxt, formatTxtForPrompt } = require('./processTxt');
const { requireAuth } = require('./middleware/auth');
const { healthCheck, getBlobContent, listUserFiles } = require('./services/storage');
const cosmosService = require('./services/cosmos');
const summarizerService = require('./services/summarizerService');
const filesRouter = require('./routes/files');
const conversationsRouter = require('./routes/conversations');
const { normalPrompt } = require('./prompts/normalPrompt');
const openaiService = require('./services/openaiService');
const { loadTools, executeTool } = require('./toolkit');
const config = require('./config');

// Try to load debug config (local only, not in git)
let DEBUG_MODE = false;
try {
  const debugConfig = require('./debug.config.js');
  DEBUG_MODE = debugConfig.DEBUG_MODE;
  if (DEBUG_MODE) console.log('🐛 DEBUG MODE ENABLED - debug info will be included in responses');
} catch (e) {
  // debug.config.js doesn't exist, that's fine
}

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Azure OpenAI using centralized service
const openai = openaiService.createOpenAIClient();

// Log active model on startup
console.log(`🤖 Active OpenAI Model: ${openaiService.getActiveDeployment()}`);
console.log(`🔧 Tool calling enabled: ${openaiService.supportsToolCalling()}`);

/**
 * Generate a short, memorable title from a user's first message using AI
 * @param {string} userMessage - The user's first question/message
 * @returns {Promise<string>} - A short, memorable title (4-8 words)
 */
async function generateConversationTitle(userMessage) {
  try {
    console.log(`🎯 Generating AI title for message: "${userMessage.substring(0, 100)}..."`);
    
    const prompt = `You are a helpful assistant that creates short, memorable conversation titles.

User's question: "${userMessage}"

Generate a concise title (4-8 words) that captures the essence of this question. Be specific and descriptive. Do not use quotes or special formatting. Just return the title text directly.`;

    console.log(`📤 Sending OpenAI request for title generation...`);
    
    // Always use GPT-4.1 for title generation
    const titleClient = openaiService.createOpenAIClient('gpt-4.1');
    const completion = await titleClient.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        { role: 'system', content: prompt }
      ],
      max_tokens: 30,
      temperature: 0.7
    });

    console.log(`📥 Received OpenAI response:`, JSON.stringify(completion.choices[0]));

    const title = completion.choices[0]?.message?.content?.trim();
    if (!title) {
      throw new Error('No title generated from AI');
    }
    
    // Remove any quotes that might have been added
    const cleanTitle = title.replace(/^["']|["']$/g, '');
    
    console.log(`✨ AI-generated title SUCCESS: "${cleanTitle}"`);
    return cleanTitle;
  } catch (error) {
    console.error('❌ Failed to generate AI title - ERROR DETAILS:');
    console.error('Error message:', error.message);
    console.error('Error name:', error.name);
    console.error('Error code:', error.code);
    if (error.response) {
      console.error('Error response:', error.response);
    }
    console.error('Full error:', JSON.stringify(error, null, 2));
    
    // Fallback to simple truncation
    const words = userMessage.trim().split(' ').slice(0, 6);
    let fallbackTitle = words.join(' ');
    if (userMessage.split(' ').length > 6) {
      fallbackTitle += '...';
    }
    console.log(`📝 Using fallback title: "${fallbackTitle}"`);
    return fallbackTitle;
  }
}

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    console.log('🌐 CORS Debug - Origin:', origin);
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // LOCAL DEVELOPMENT: Be more permissive
    if (process.env.NODE_ENV === 'development' || process.env.LOCAL_DEVELOPMENT === 'true') {
      console.log('🔧 Local development mode - allowing all localhost origins');
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }
    }
    
    const allowedOrigins = [
      'http://localhost:3000', 
      'http://127.0.0.1:3000',
      'https://orange-flower-0b350780f.1.azurestaticapps.net',
      'https://app.taktconnect.com'
    ];
    
    // Allow any Azure Static Web Apps origin or the specific origins
    if (allowedOrigins.includes(origin) || origin.includes('azurestaticapps.net')) {
      console.log('✅ CORS - Origin allowed:', origin);
      return callback(null, true);
    }
    
    console.log('❌ CORS - Origin rejected:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-ms-client-principal']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security headers middleware
app.use((req, res, next) => {
  // Security headers for all responses
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Add blob storage domain to CSP for direct uploads/downloads
  const blobStorageDomain = `https://${process.env.STORAGE_ACCOUNT_NAME || 'taktmateblob'}.blob.core.windows.net`;
  res.setHeader('Content-Security-Policy', 
    `default-src 'self'; ` +
    `connect-src 'self' ${blobStorageDomain} https://taktmate.openai.azure.com; ` +
    `script-src 'self' 'unsafe-inline'; ` +
    `style-src 'self' 'unsafe-inline'; ` +
    `img-src 'self' data:; ` +
    `font-src 'self'; ` +
    `object-src 'none'; ` +
    `base-uri 'self';`
  );
  
  next();
});

// Register file management routes
app.use('/api/files', filesRouter);

// Register conversation management routes
app.use('/api/conversations', conversationsRouter);

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Check storage connectivity
    const storageHealth = await healthCheck();
    
    // Check Cosmos DB connectivity
    const cosmosHealth = await cosmosService.healthCheck();
    
    // Check Summarizer service connectivity
    const summarizerHealth = await summarizerService.healthCheck();
    
    const overallStatus = 
      storageHealth.status === 'healthy' && 
      cosmosHealth.status === 'healthy' && 
      summarizerHealth.status === 'healthy'
        ? 'OK' : 'DEGRADED';
    const statusCode = overallStatus === 'OK' ? 200 : 503;
    
    res.status(statusCode).json({ 
      status: overallStatus,
      message: 'TaktMate Backend is running',
      services: {
        api: 'healthy',
        storage: storageHealth,
        cosmos: cosmosHealth,
        summarizer: summarizerHealth
      },
      environment: {
        nodeVersion: process.version,
        storageAccount: process.env.STORAGE_ACCOUNT_NAME || 'not configured',
        cosmosEndpoint: process.env.COSMOS_DB_ENDPOINT || 'not configured',
        cosmosDatabase: process.env.COSMOS_DB_DATABASE_NAME || 'not configured'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Health check error:', error.message);
    res.status(503).json({
      status: 'UNHEALTHY',
      message: 'TaktMate Backend health check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});


// Test upload endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Backend is working',
    cors: 'enabled',
    timestamp: new Date().toISOString()
  });
});



// Handle preflight OPTIONS request for chat
app.options('/api/chat', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-ms-client-principal');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

/**
 * Parse file content based on file extension
 * @param {Buffer} buffer - File buffer
 * @param {string} fileName - File name with extension
 * @returns {Promise<string>} - Formatted content for GPT prompt
 */
async function parseFileContent(buffer, fileName) {
  // Get file extension (case-insensitive)
  const fileExtension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
  
  try {
    switch (fileExtension) {
      case '.csv':
        const csvRows = await parseCsv(buffer);
        if (!csvRows || csvRows.length === 0) {
          throw new Error('CSV file is empty or contains no data');
        }
        return formatCsvForPrompt(csvRows, fileName);
        
      case '.pdf':
        const pdfText = await parsePdf(buffer);
        return formatPdfForPrompt(pdfText, fileName);
        
      case '.docx':
        const docxText = await parseDocx(buffer);
        return formatDocxForPrompt(docxText, fileName);
        
      case '.xlsx':
        const xlsxText = await parseXlsx(buffer);
        return formatXlsxForPrompt(xlsxText, fileName);
        
      case '.txt':
        const txtText = await parseTxt(buffer);
        return formatTxtForPrompt(txtText, fileName);
        
      default:
        throw new Error(`Unsupported file type: ${fileExtension}`);
    }
  } catch (error) {
    console.error(`Error parsing ${fileExtension} file "${fileName}":`, error.message);
    throw new Error(`Failed to parse ${fileExtension.toUpperCase()} file: ${error.message}`);
  }
}

/**
 * Parse multiple files and combine their content
 * @param {Array<string>} fileNames - Array of file names
 * @param {string} userId - User ID for file access
 * @returns {Promise<string>} - Combined formatted content for GPT prompt
 */
async function parseMultipleFiles(fileNames, userId) {
  if (!Array.isArray(fileNames) || fileNames.length === 0) {
    throw new Error('fileNames must be a non-empty array');
  }

  // Validate file count limit
  if (fileNames.length > 5) {
    throw new Error('Maximum of 5 files can be processed at once');
  }

  const fileContents = [];
  
  for (const fileName of fileNames) {
    try {
      // Get blob content and parse file
      const blobBuffer = await getBlobContent(userId, fileName);
      const content = await parseFileContent(blobBuffer, fileName);
      
      // Get file type for formatting
      const fileExtension = fileName.toLowerCase().substring(fileName.lastIndexOf('.') + 1);
      
      fileContents.push({
        fileName,
        content,
        type: fileExtension.toUpperCase()
      });
    } catch (error) {
      console.error(`Error processing file "${fileName}":`, error.message);
      throw new Error(`Failed to process file "${fileName}": ${error.message}`);
    }
  }
  
  return formatMultiFilePrompt(fileContents);
}

/**
 * Format multiple file contents into a single prompt
 * @param {Array<Object>} filesData - Array of {fileName, content, type}
 * @returns {string} - Formatted multi-file prompt
 */
function formatMultiFilePrompt(filesData) {
  if (!Array.isArray(filesData) || filesData.length === 0) {
    throw new Error('filesData must be a non-empty array');
  }

  // If only one file, return single file format for consistency
  if (filesData.length === 1) {
    return filesData[0].content;
  }

  let prompt = `You are analyzing ${filesData.length} documents. Here are the files:\n\n`;
  
  filesData.forEach((file, index) => {
    prompt += `=== FILE ${index + 1}: ${file.fileName} ===\n`;
    prompt += `File Type: ${file.type}\n\n`;
    prompt += file.content;
    prompt += `\n\n`;
  });
  
  prompt += `When answering questions:
- Specify which file(s) contain the relevant information
- Cross-reference data between files when applicable
- If data spans multiple files, provide a comprehensive answer
- Use the format "From [filename]:" when citing specific file sources\n\n`;
  
  return prompt;
}

// Enhanced chat endpoint with conversation support
app.post('/api/chat', requireAuth, async (req, res) => {
  try {
    const user = req.user; // From SWA authentication middleware
    
    const { fileName, fileNames, message, conversationId } = req.body;

    // Support both single file (backward compatibility) and multiple files
    let targetFileNames = [];
    if (fileNames && Array.isArray(fileNames)) {
      targetFileNames = fileNames;
    } else if (fileName) {
      targetFileNames = [fileName];
    }

    if (targetFileNames.length === 0 || !message) {
      return res.status(400).json({ 
        error: 'fileNames (or fileName) and message are required',
        message: 'Please provide the name(s) of the file(s) you want to chat with'
      });
    }

    // Validate file count limit
    if (targetFileNames.length > 5) {
      return res.status(400).json({
        error: 'Too many files',
        message: 'Maximum of 5 files can be processed at once'
      });
    }

    console.log(`Chat request from user ${user.id} for ${targetFileNames.length} file(s): ${targetFileNames.join(', ')}`);
    
    // Verify user has access to all files
    const userFiles = await listUserFiles(user.id);
    const missingFiles = [];
    
    for (const targetFileName of targetFileNames) {
      const fileExists = userFiles.find(file => file.name === targetFileName);
      if (!fileExists) {
        missingFiles.push(targetFileName);
      }
    }
    
    if (missingFiles.length > 0) {
      return res.status(404).json({ 
        error: 'File(s) not found', 
        message: `The following file(s) do not exist in your storage: ${missingFiles.join(', ')}. Please upload them first using the file upload feature.` 
      });
    }

    // Parse files (single or multiple)
    let fileContent;
    if (targetFileNames.length === 1) {
      // Single file processing (backward compatibility)
      const blobBuffer = await getBlobContent(user.id, targetFileNames[0]);
      fileContent = await parseFileContent(blobBuffer, targetFileNames[0]);
    } else {
      // Multiple file processing
      fileContent = await parseMultipleFiles(targetFileNames, user.id);
    }

    // Handle conversation context
    let conversation = null;
    let conversationMessages = [];
    
    if (conversationId) {
      try {
        // Get existing conversation
        conversation = await cosmosService.getConversation(conversationId, user.id);
        
        // Allow dynamic file changes - update conversation's file associations to current files
        const conversationFileNames = conversation.fileNames || [conversation.fileName];
        const filesMatch = conversationFileNames.length === targetFileNames.length &&
                          conversationFileNames.every(name => targetFileNames.includes(name));
        
        // Always update file associations if they've changed
        if (!filesMatch) {
          const conversationFiles = conversationFileNames.join(', ');
          const requestFiles = targetFileNames.join(', ');
          console.log(`Updating conversation ${conversationId} files from [${conversationFiles}] to [${requestFiles}]`);
          
          try {
            // Update conversation to use current file names (allows dynamic file changes)
            const updateData = targetFileNames.length === 1 
              ? { fileName: targetFileNames[0] }
              : { fileNames: targetFileNames };
            
            await cosmosService.updateConversation(conversationId, user.id, updateData);
            console.log(`Successfully updated conversation ${conversationId} file associations`);
          } catch (updateError) {
            console.warn(`Failed to update conversation file associations:`, updateError.message);
            // Continue anyway - this is not critical
          }
        }
        
        // Get recent messages for context (last 10 messages to avoid token limits)
        conversationMessages = await cosmosService.getRecentMessages(conversationId, user.id, 10);
        console.log(`Using conversation context: ${conversationId} with ${conversationMessages.length} recent messages`);
      } catch (error) {
        console.warn(`Failed to load conversation ${conversationId}:`, error.message);
        // Continue without conversation context
      }
    } else {
      // Auto-create a new conversation if none provided
      try {
        // Generate AI-powered title from first user message
        const title = await generateConversationTitle(message);
        
        // For backward compatibility, use fileName for single files, fileNames for multiple
        if (targetFileNames.length === 1) {
          conversation = await cosmosService.createConversation(user.id, targetFileNames[0], title);
        } else {
          // This will need cosmos service update, but for now use first file as primary
          conversation = await cosmosService.createConversation(user.id, targetFileNames[0], title, [], targetFileNames);
        }
        console.log(`Auto-created conversation: ${conversation.id} with AI title: "${title}"`);
      } catch (error) {
        console.warn('Failed to auto-create conversation:', error.message);
        // Continue without conversation (backward compatibility)
      }
    }

    // Create system prompt with conversation context
    const systemPrompt = normalPrompt(fileContent, conversationMessages);

    // Prepare messages for OpenAI
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ];

    // Prepare chat options
    const chatOptions = {
      model: openaiService.getActiveDeployment(),
      messages
    };
    
    // GPT-5-mini has different parameter requirements than GPT-4.1
    if (openaiService.supportsToolCalling()) {
      // GPT-5-mini: uses max_completion_tokens, only supports temperature=1 (default)
      chatOptions.max_completion_tokens = config.MAX_COMPLETION_TOKENS;
    } else {
      // GPT-4.1: uses max_tokens, supports custom temperature
      chatOptions.max_tokens = config.MAX_TOKENS;
      chatOptions.temperature = config.TEMPERATURE;
    }

    // Add tools if the active model supports them
    let tools = [];
    if (openaiService.supportsToolCalling()) {
      tools = await loadTools();
      if (tools.length > 0) {
        chatOptions.tools = tools;
        chatOptions.tool_choice = 'auto';
        console.log(`🔧 Tool calling enabled with ${tools.length} tools`);
      }
    }

    // Initial API call
    let completion;
    try {
      console.log('📤 Making initial OpenAI API call with options:', JSON.stringify({
        model: chatOptions.model,
        hasTools: !!chatOptions.tools,
        toolCount: chatOptions.tools?.length || 0,
        messageCount: chatOptions.messages.length,
        maxTokens: chatOptions.max_tokens || chatOptions.max_completion_tokens
      }));
      
      completion = await openai.chat.completions.create(chatOptions);
      console.log('📥 Received completion, finish_reason:', completion.choices[0].finish_reason);
    } catch (error) {
      console.error('❌ OpenAI API call failed:', error.message);
      console.error('Error details:', JSON.stringify(error, null, 2));
      throw error;
    }
    
    let reply = completion.choices[0].message.content;
    
    // Handle tool calls if present
    const toolCalls = completion.choices[0].message.tool_calls;
    let chartData = null; // Track chart data if create_plot is called
    
    if (toolCalls && toolCalls.length > 0) {
      console.log(`🛠️ Model requested ${toolCalls.length} tool call(s)`);
      
      // Execute all requested tools
      const toolMessages = [];
      for (const toolCall of toolCalls) {
        try {
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments);
          
          console.log(`🔧 Executing tool: ${toolName}`);
          console.log(`   Tool arguments:`, JSON.stringify(toolArgs, null, 2));
          
          const toolResult = await executeTool(toolName, toolArgs, user.id);
          
          console.log(`✅ Tool ${toolName} executed successfully`);
          console.log(`   Tool result:`, JSON.stringify(toolResult, null, 2));
          
          // If this is a create_plot tool, save the chart data for the frontend
          if (toolName === 'create_plot') {
            chartData = toolResult;
            console.log(`📊 Chart data captured for frontend rendering`);
          }
          
          toolMessages.push({
            role: 'tool',
            content: JSON.stringify(toolResult),
            tool_call_id: toolCall.id
          });
        } catch (error) {
          console.error(`❌ Tool execution failed:`, error.message);
          console.error(`   Error stack:`, error.stack);
          toolMessages.push({
            role: 'tool',
            content: JSON.stringify({ error: error.message }),
            tool_call_id: toolCall.id
          });
        }
      }
      
      // Send tool results back to the model for final response
      const followUpMessages = [
        ...messages,
        completion.choices[0].message,
        ...toolMessages
      ];
      
      // Follow-up call after tool execution (always gpt-5-mini when tools are used)
      const followUpCompletion = await openai.chat.completions.create({
        model: openaiService.getActiveDeployment(),
        messages: followUpMessages,
        max_completion_tokens: config.MAX_COMPLETION_TOKENS
        // Note: temperature omitted, gpt-5-mini only supports default (1)
      });
      
      reply = followUpCompletion.choices[0].message.content;
      
      if (!reply) {
        console.warn('⚠️  Follow-up completion returned null content');
        console.log('Follow-up response:', JSON.stringify(followUpCompletion.choices[0]));
        // Fallback: describe what the tool found
        reply = 'I executed the calculation but received an empty response. Please try again.';
      } else {
        console.log(`✅ Generated final response after tool execution: ${reply.substring(0, 100)}...`);
      }
    }

    // Save messages to conversation if we have one
    if (conversation) {
      try {
        // Clear suggestions after first user message (if this is the first message)
        const shouldClearSuggestions = conversation.messageCount === 0 && conversation.suggestions;
        
        // Add user message
        await cosmosService.addMessage(conversation.id, user.id, {
          role: 'user',
          content: message
        });
        
        // Add assistant response
        await cosmosService.addMessage(conversation.id, user.id, {
          role: 'assistant',
          content: reply
        });
        
        // Clear suggestions after first user message
        if (shouldClearSuggestions) {
          console.log(`🧹 Clearing suggestions for conversation ${conversation.id} after first message`);
          await cosmosService.updateConversation(conversation.id, user.id, { suggestions: null });
        }
        
        // Update title with AI-generated one if this is the first user message (generic title)
        console.log(`🔍 Checking if title needs updating. Current title: "${conversation.title}", messageCount: ${conversation.messageCount}`);
        
        const isGenericTitle = conversation.title && (
          conversation.title.startsWith('Conversation about ') || 
          conversation.title.includes(' files')
        );
        
        console.log(`🔍 Is generic title? ${isGenericTitle}, Is first message? ${conversation.messageCount === 0}`);
        
        if (isGenericTitle && conversation.messageCount === 0) {
          try {
            console.log(`🎨 Generating AI title for first message in conversation ${conversation.id}`);
            const aiTitle = await generateConversationTitle(message);
            await cosmosService.updateConversation(conversation.id, user.id, { title: aiTitle });
            console.log(`✅ Updated conversation title from "${conversation.title}" to "${aiTitle}"`);
            conversation.title = aiTitle; // Update local object for response
          } catch (error) {
            console.error('⚠️  Failed to update conversation title:', error.message);
            // Not critical, continue
          }
        } else {
          console.log(`⏭️  Skipping title update - not first message or not generic title`);
        }
        
        // Check if conversation needs archiving or summarization
        const updatedConversation = await cosmosService.getConversation(conversation.id, user.id);
        const archiveCheck = cosmosService.shouldArchiveConversation(updatedConversation);
        const needsSummary = cosmosService.shouldSummarizeConversation(updatedConversation);
        
        if (archiveCheck.shouldArchive) {
          console.log(`Conversation ${conversation.id} should be archived:`, archiveCheck.reasons);
          // Trigger background archiving (non-blocking)
          summarizerService.archiveConversationComplete(conversation.id, user.id)
            .then(() => console.log(`✅ Background archiving completed for ${conversation.id}`))
            .catch(error => console.error(`❌ Background archiving failed for ${conversation.id}:`, error.message));
        } else if (needsSummary) {
          console.log(`Conversation ${conversation.id} needs summarization`);
          // Generate summary in background (non-blocking)
          summarizerService.summarizeConversation(updatedConversation.messages, updatedConversation.fileName)
            .then(summary => {
              return cosmosService.updateConversation(conversation.id, user.id, { summary });
            })
            .then(() => console.log(`✅ Background summarization completed for ${conversation.id}`))
            .catch(error => console.error(`❌ Background summarization failed for ${conversation.id}:`, error.message));
        }
      } catch (error) {
        console.error('Failed to save conversation messages:', error.message);
        // Don't fail the chat response, just log the error
      }
    }

    // Prepare response
    const response = {
      success: true,
      reply,
      fileName: fileName,
      conversationId: conversation?.id || null
    };

    // Include title if we have a conversation
    // This allows the frontend to update the title if it has changed (e.g., AI-generated title)
    if (conversation) {
      response.title = conversation.title;
    }

    // Include chart data if create_plot tool was called
    if (chartData) {
      response.chartData = chartData;
      console.log(`📊 Attaching chart data to response`);
    }

    // Add debug info if DEBUG_MODE is enabled (local development only)
    if (DEBUG_MODE) {
      response.debug = {
        promptSent: systemPrompt,
        userMessage: message,
        fullMessages: messages,
        openaiResponse: completion,
        parsedReply: reply,
        toolsAvailable: tools.length > 0 ? tools : null,
        toolCalling: {
          enabled: openaiService.supportsToolCalling(),
          activeModel: openaiService.getActiveDeployment(),
          toolsCount: tools.length
        }
      };
    }

    res.json(response);

  } catch (error) {
    console.error(`Chat error for user ${req.user?.email || 'unknown'}:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to process chat message. Please try again.' 
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Application error:', error.message);
  res.status(500).json({ error: error.message });
});

app.listen(PORT, async () => {
  console.log(`TaktMate Backend running on port ${PORT}`);
  console.log(`Storage Account: ${process.env.STORAGE_ACCOUNT_NAME || 'NOT CONFIGURED'}`);
  console.log(`Cosmos DB: ${process.env.COSMOS_DB_ENDPOINT || 'NOT CONFIGURED'}`);
  
  // Test storage connectivity on startup
  try {
    const storageHealth = await healthCheck();
    console.log(`Storage connectivity: ${storageHealth.status}`);
    if (storageHealth.status !== 'healthy') {
      console.warn('WARNING: Storage service is not healthy:', storageHealth.error);
    }
  } catch (error) {
    console.error('ERROR: Failed to check storage connectivity on startup:', error.message);
  }

  // Test Cosmos DB connectivity on startup
  try {
    const cosmosHealth = await cosmosService.healthCheck();
    console.log(`Cosmos DB connectivity: ${cosmosHealth.status}`);
    if (cosmosHealth.status !== 'healthy') {
      console.warn('WARNING: Cosmos DB service is not healthy:', cosmosHealth.error);
    }
  } catch (error) {
    console.error('ERROR: Failed to check Cosmos DB connectivity on startup:', error.message);
  }

  // Test Summarizer service connectivity on startup
  try {
    const summarizerHealth = await summarizerService.healthCheck();
    console.log(`Summarizer service connectivity: ${summarizerHealth.status}`);
    if (summarizerHealth.status !== 'healthy') {
      console.warn('WARNING: Summarizer service is not healthy:', summarizerHealth.error);
    }
  } catch (error) {
    console.error('ERROR: Failed to check Summarizer service connectivity on startup:', error.message);
  }
});