const express = require('express');
const cors = require('cors');
const { OpenAI } = require('openai');
require('dotenv').config();

const { parseCsv, formatCsvForPrompt } = require('./processCsv');
const { parsePdf, formatPdfForPrompt } = require('./processPdf');
const { parseDocx, formatDocxForPrompt } = require('./processDocx');
const { parseXlsx, formatXlsxForPrompt } = require('./processXlsx');
const { requireAuth } = require('./middleware/auth');
const { healthCheck, getBlobContent, listUserFiles } = require('./services/storage');
const cosmosService = require('./services/cosmos');
const summarizerService = require('./services/summarizerService');
const filesRouter = require('./routes/files');
const conversationsRouter = require('./routes/conversations');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Azure OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://taktmate.openai.azure.com/openai/deployments/gpt-4.1',
  defaultQuery: { 'api-version': '2025-01-01-preview' },
  defaultHeaders: {
    'api-key': process.env.OPENAI_API_KEY,
  },
});

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000', 
      'http://127.0.0.1:3000',
      'https://orange-flower-0b350780f.1.azurestaticapps.net',
      'https://app.taktconnect.com'
    ];
    
    // Allow any Azure Static Web Apps origin or the specific origins
    if (allowedOrigins.includes(origin) || origin.includes('azurestaticapps.net')) {
      return callback(null, true);
    }
    
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
        
      default:
        throw new Error(`Unsupported file type: ${fileExtension}`);
    }
  } catch (error) {
    console.error(`Error parsing ${fileExtension} file "${fileName}":`, error.message);
    throw new Error(`Failed to parse ${fileExtension.toUpperCase()} file: ${error.message}`);
  }
}

// Enhanced chat endpoint with conversation support
app.post('/api/chat', requireAuth, async (req, res) => {
  try {
    const user = req.user; // From SWA authentication middleware
    
    const { fileName, message, conversationId } = req.body;

    if (!fileName || !message) {
      return res.status(400).json({ 
        error: 'fileName and message are required',
        message: 'Please provide the name of the file you want to chat with'
      });
    }

    console.log(`Chat request from user ${user.id} for file: ${fileName}`);
    
    // Verify user has access to this file
    const userFiles = await listUserFiles(user.id);
    const fileExists = userFiles.find(file => file.name === fileName);
    
    if (!fileExists) {
      return res.status(404).json({ 
        error: 'File not found', 
        message: `File '${fileName}' does not exist in your storage. Please upload the file first using the file upload feature.` 
      });
    }

    // Get blob content and parse file based on type
    const blobBuffer = await getBlobContent(user.id, fileName);
    const fileContent = await parseFileContent(blobBuffer, fileName);

    // Handle conversation context
    let conversation = null;
    let conversationMessages = [];
    
    if (conversationId) {
      try {
        // Get existing conversation
        conversation = await cosmosService.getConversation(conversationId, user.id);
        
        // Verify the conversation is for the same file
        if (conversation.fileName !== fileName) {
          return res.status(400).json({
            success: false,
            error: 'File mismatch',
            message: `Conversation is associated with ${conversation.fileName}, not ${fileName}`
          });
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
        const title = cosmosService.generateTitle([{ role: 'user', content: message }], fileName);
        conversation = await cosmosService.createConversation(user.id, fileName, title);
        console.log(`Auto-created conversation: ${conversation.id}`);
      } catch (error) {
        console.warn('Failed to auto-create conversation:', error.message);
        // Continue without conversation (backward compatibility)
      }
    }

    // Create system prompt with conversation context
    let systemPrompt = `You are a helpful document analysis assistant.  
        Your role is to answer questions using only the provided document data.  

        Guidelines:
        - Use **only** the document data provided. If the answer is not present, reply exactly: "No relevant data found."  
        - Give the most accurate and complete answer possible while staying concise.  
        - Respond in a warm, professional tone (polite, clear, approachable).   
        - For lists, provide the relevant items in a clean format (bulleted list or comma-separated, depending on clarity).  
        - For numbers, include units if available.  
        - Do not over-explain your reasoning or add outside commentary unless the user explicitly asks for it.  

${fileContent}`;

    // Add conversation context if available
    if (conversationMessages.length > 0) {
      systemPrompt += `\n\nPrevious conversation context:\n`;
      conversationMessages.forEach(msg => {
        systemPrompt += `${msg.role}: ${msg.content}\n`;
      });
      systemPrompt += `\nContinue the conversation based on this context.`;
    }

    // Prepare messages for OpenAI
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ];

    // Call Azure OpenAI GPT-4.1
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1', // This matches your Azure deployment name
      messages,
      max_tokens: 500,
      temperature: 0.1
    });

    const reply = completion.choices[0].message.content;

    // Save messages to conversation if we have one
    if (conversation) {
      try {
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

    res.json({
      success: true,
      reply,
      fileName: fileName,
      conversationId: conversation?.id || null,
      conversationTitle: conversation?.title || null
    });

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