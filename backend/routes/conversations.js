const express = require('express');
const router = express.Router();
const cosmosService = require('../services/cosmos');
const { requireAuth } = require('../middleware/auth');
const { getBlobContent } = require('../services/storage');
const { suggestionPrompt, multiFileSuggestionPrompt } = require('../prompts/suggestionPrompt');
const openaiService = require('../services/openaiService');

// Import file processing functions
const { parseCsv, formatCsvForPrompt } = require('../processCsv');
const { parsePdf, formatPdfForPrompt } = require('../processPdf');
const { parseDocx, formatDocxForPrompt } = require('../processDocx');
const { parseXlsx, formatXlsxForPrompt } = require('../processXlsx');
const { parseTxt, formatTxtForPrompt } = require('../processTxt');

// Initialize OpenAI client for suggestions (always use GPT-4.1 for this)
const openai = openaiService.createOpenAIClient('gpt-4.1');

// Apply authentication to all conversation routes
router.use(requireAuth);

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
 * Generate suggested questions for a file using GPT
 * @param {string} fileName - Name of the file
 * @param {string} fileContent - Processed file content
 * @returns {Promise<Array<string>>} - Array of suggested questions
 */
async function generateSuggestions(fileName, fileContent) {
  try {
    // Extract file type from extension
    const fileExtension = fileName.toLowerCase().substring(fileName.lastIndexOf('.') + 1);
    
    // Generate the suggestion prompt
    const prompt = suggestionPrompt(fileName, fileExtension, fileContent);
    
    // Call GPT to generate suggestions (matching main chat parameters exactly)
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1', // This matches your Azure deployment name
      messages: [
        { role: 'system', content: prompt }
      ],
      max_tokens: 500,
      temperature: 0.1
    });
    
    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('No response from GPT');
    }
    
    // Parse JSON response
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      console.error(`❌ JSON Parse Error: ${parseError.message}`);
      console.error(`📝 Unparseable content: ${content}`);
      throw new Error(`Failed to parse GPT response as JSON: ${parseError.message}`);
    }
    
    if (!parsed.suggestions || !Array.isArray(parsed.suggestions)) {
      console.error(`❌ Invalid suggestion format. Received:`, parsed);
      throw new Error('Invalid suggestion format received');
    }
    
    // Validate we have exactly 2 suggestions
    const suggestions = parsed.suggestions.slice(0, 2); // Ensure max 2 suggestions
    if (suggestions.length === 0) {
      throw new Error('No suggestions generated');
    }
    
    return suggestions;
    
  } catch (error) {
    console.error(`Failed to generate suggestions for ${fileName}:`, error.message);
    
    // Return fallback suggestions based on file type
    const fileExtension = fileName.toLowerCase().substring(fileName.lastIndexOf('.') + 1);
    return getFallbackSuggestions(fileExtension, fileName);
  }
}

/**
 * Generate suggested questions for multiple files using GPT
 * @param {Array<Object>} filesData - Array of {fileName, content, type}
 * @returns {Promise<Array<string>>} - Array of suggested questions
 */
async function generateMultiFileSuggestions(filesData) {
  try {
    if (!Array.isArray(filesData) || filesData.length === 0) {
      throw new Error('filesData must be a non-empty array');
    }

    // Generate the multi-file suggestion prompt
    const prompt = multiFileSuggestionPrompt(filesData);
    
    // Call GPT to generate suggestions (matching main chat parameters exactly)
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1', // This matches your Azure deployment name
      messages: [
        { role: 'system', content: prompt }
      ],
      max_tokens: 500,
      temperature: 0.1
    });
    
    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('No response from GPT');
    }
    
    // Parse JSON response
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      console.error(`❌ JSON Parse Error for multi-file suggestions: ${parseError.message}`);
      console.error(`📝 Unparseable content: ${content}`);
      throw new Error(`Failed to parse GPT response as JSON: ${parseError.message}`);
    }
    
    if (!parsed.suggestions || !Array.isArray(parsed.suggestions)) {
      console.error(`❌ Invalid multi-file suggestion format. Received:`, parsed);
      throw new Error('Invalid suggestion format received');
    }
    
    // Validate we have exactly 2 suggestions
    const suggestions = parsed.suggestions.slice(0, 2); // Ensure max 2 suggestions
    if (suggestions.length === 0) {
      throw new Error('No suggestions generated');
    }
    
    return suggestions;
    
  } catch (error) {
    console.error(`Failed to generate multi-file suggestions:`, error.message);
    
    // Return fallback suggestions for multi-file scenarios
    return getMultiFileFallbackSuggestions(filesData);
  }
}

/**
 * Get fallback suggestions for multi-file scenarios
 * @param {Array<Object>} filesData - Array of {fileName, content, type}
 * @returns {Array<string>} - Fallback suggestions
 */
function getMultiFileFallbackSuggestions(filesData) {
  const fileTypes = [...new Set(filesData.map(f => f.type.toLowerCase()))];
  const fileCount = filesData.length;
  
  // Generic multi-file suggestions
  const suggestions = [
    `Compare and analyze patterns across all ${fileCount} files`,
    `What insights can be gained by combining data from these ${fileCount} documents?`
  ];
  
  // Customize based on file types
  if (fileTypes.includes('csv') && fileTypes.length > 1) {
    suggestions[0] = 'How do the data patterns in the CSV files relate to the other documents?';
  } else if (fileTypes.every(type => ['pdf', 'docx', 'txt'].includes(type))) {
    suggestions[0] = 'What are the common themes and differences across these documents?';
  } else if (fileTypes.includes('xlsx')) {
    suggestions[1] = 'What correlations exist between the spreadsheet data and other files?';
  }
  
  return suggestions;
}

/**
 * Get fallback suggestions when GPT generation fails
 * @param {string} fileExtension - File extension
 * @param {string} fileName - File name
 * @returns {Array<string>} - Fallback suggestions
 */
function getFallbackSuggestions(fileExtension, fileName) {
  const fallbacks = {
    csv: [
      "What are the main columns and data types in this dataset?",
      "Can you show me a summary of the key statistics from this data?"
    ],
    pdf: [
      "What are the main topics covered in this document?",
      "Can you summarize the key findings or conclusions?"
    ],
    docx: [
      "What is the main purpose of this document?",
      "What are the key points or action items mentioned?"
    ],
    xlsx: [
      "What sheets are available and what data do they contain?",
      "Can you analyze the numerical data in this spreadsheet?"
    ],
    txt: [
      "What are the main themes discussed in this text?",
      "Can you provide a summary of the content?"
    ]
  };
  
  const suggestions = fallbacks[fileExtension] || [
    `What information is contained in this ${fileName} file?`,
    "Can you help me understand the content and structure of this document?"
  ];
  
  return suggestions;
}

/**
 * GET /api/conversations
 * List user conversations with pagination
 */
router.get('/', async (req, res) => {
  try {
    const user = req.user;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    const conversations = await cosmosService.listUserConversations(user.id, limit, offset);

    // Add metadata for pagination
    const response = {
      success: true,
      conversations,
      pagination: {
        limit,
        offset,
        count: conversations.length,
        hasMore: conversations.length === limit
      }
    };

    res.json(response);
  } catch (error) {
    console.error(`Failed to list conversations for user ${req.user?.id}:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve conversations',
      message: error.message
    });
  }
});

/**
 * POST /api/conversations
 * Create new conversation with suggested questions
 */
router.post('/', async (req, res) => {
  try {
    const user = req.user;
    const { fileName, fileNames, title } = req.body;

    // Support both single file (backward compatibility) and multiple files
    let targetFileNames = [];
    if (fileNames && Array.isArray(fileNames)) {
      targetFileNames = fileNames;
    } else if (fileName) {
      targetFileNames = [fileName];
    }

    if (targetFileNames.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'fileName or fileNames is required',
        message: 'Please specify the file name(s) for this conversation'
      });
    }

    // Validate file count limit
    if (targetFileNames.length > 5) {
      return res.status(400).json({
        success: false,
        error: 'Too many files',
        message: 'Maximum of 5 files can be processed at once'
      });
    }

    // Generate suggestions by analyzing the file content(s)
    let suggestions = [];
    try {
      if (targetFileNames.length === 1) {
        // Single file suggestions (existing logic)
        const fileBuffer = await getBlobContent(user.id, targetFileNames[0]);
        const fileContent = await parseFileContent(fileBuffer, targetFileNames[0]);
        suggestions = await generateSuggestions(targetFileNames[0], fileContent);
      } else {
        // Multi-file suggestions - parse files and generate proper multi-file suggestions
        const filesData = [];
        for (const fileName of targetFileNames) {
          const fileBuffer = await getBlobContent(user.id, fileName);
          const content = await parseFileContent(fileBuffer, fileName);
          const fileExtension = fileName.toLowerCase().substring(fileName.lastIndexOf('.') + 1);
          
          filesData.push({
            fileName,
            content,
            type: fileExtension.toUpperCase()
          });
        }
        suggestions = await generateMultiFileSuggestions(filesData);
      }
    } catch (suggestionError) {
      console.warn(`Failed to generate suggestions for files [${targetFileNames.join(', ')}]:`, suggestionError.message);
      // Continue with conversation creation using appropriate fallback
      if (targetFileNames.length === 1) {
        const fileExtension = targetFileNames[0].toLowerCase().substring(targetFileNames[0].lastIndexOf('.') + 1);
        suggestions = getFallbackSuggestions(fileExtension, targetFileNames[0]);
      } else {
        // Create mock filesData for fallback
        const fallbackFilesData = targetFileNames.map(fileName => ({
          fileName,
          type: fileName.toLowerCase().substring(fileName.lastIndexOf('.') + 1).toUpperCase(),
          content: ''
        }));
        suggestions = getMultiFileFallbackSuggestions(fallbackFilesData);
      }
    }

    // Create conversation with suggestions
    const conversation = await cosmosService.createConversation(
      user.id, 
      targetFileNames[0], // Primary file for backward compatibility
      title, 
      suggestions, 
      targetFileNames // All files
    );

    res.status(201).json({
      success: true,
      conversation,
      message: 'Conversation created successfully'
    });
  } catch (error) {
    console.error(`Failed to create conversation for user ${req.user?.id}:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to create conversation',
      message: error.message
    });
  }
});

/**
 * GET /api/conversations/:id
 * Get specific conversation
 */
router.get('/:id', async (req, res) => {
  try {
    const user = req.user;
    const conversationId = req.params.id;
    const includeArchived = req.query.includeArchived === 'true';

    let conversation;
    if (includeArchived) {
      conversation = await cosmosService.getFullConversation(conversationId, user.id);
    } else {
      conversation = await cosmosService.getConversation(conversationId, user.id);
    }

    res.json({
      success: true,
      conversation
    });
  } catch (error) {
    console.error(`Failed to get conversation ${req.params.id} for user ${req.user?.id}:`, error.message);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
        message: 'The requested conversation does not exist or you do not have access to it'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve conversation',
      message: error.message
    });
  }
});

/**
 * PUT /api/conversations/:id
 * Update conversation (title, etc.)
 */
router.put('/:id', async (req, res) => {
  try {
    const user = req.user;
    const conversationId = req.params.id;
    const updates = req.body;

    // Remove fields that shouldn't be updated directly
    delete updates.id;
    delete updates.userId;
    delete updates.createdAt;
    delete updates.messages;
    delete updates.messageCount;

    const updatedConversation = await cosmosService.updateConversation(conversationId, user.id, updates);

    res.json({
      success: true,
      conversation: updatedConversation,
      message: 'Conversation updated successfully'
    });
  } catch (error) {
    console.error(`Failed to update conversation ${req.params.id} for user ${req.user?.id}:`, error.message);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
        message: 'The requested conversation does not exist or you do not have access to it'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update conversation',
      message: error.message
    });
  }
});

/**
 * DELETE /api/conversations/:id
 * Delete conversation (soft delete)
 */
router.delete('/:id', async (req, res) => {
  try {
    const user = req.user;
    const conversationId = req.params.id;

    const result = await cosmosService.deleteConversation(conversationId, user.id);

    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error(`Failed to delete conversation ${req.params.id} for user ${req.user?.id}:`, error.message);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
        message: 'The requested conversation does not exist or you do not have access to it'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to delete conversation',
      message: error.message
    });
  }
});

/**
 * GET /api/conversations/:id/messages
 * Get conversation messages (with pagination)
 */
router.get('/:id/messages', async (req, res) => {
  try {
    const user = req.user;
    const conversationId = req.params.id;
    const limit = parseInt(req.query.limit) || 20;
    const recent = req.query.recent === 'true';

    let messages;
    if (recent) {
      messages = await cosmosService.getRecentMessages(conversationId, user.id, limit);
    } else {
      const conversation = await cosmosService.getConversation(conversationId, user.id);
      messages = conversation.messages || [];
    }

    res.json({
      success: true,
      messages,
      conversationId,
      count: messages.length
    });
  } catch (error) {
    console.error(`Failed to get messages for conversation ${req.params.id}:`, error.message);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
        message: 'The requested conversation does not exist or you do not have access to it'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve messages',
      message: error.message
    });
  }
});

/**
 * POST /api/conversations/:id/messages
 * Add message to conversation
 */
router.post('/:id/messages', async (req, res) => {
  try {
    const user = req.user;
    const conversationId = req.params.id;
    const { role, content } = req.body;

    if (!role || !content) {
      return res.status(400).json({
        success: false,
        error: 'role and content are required',
        message: 'Please provide both message role and content'
      });
    }

    if (!['user', 'assistant', 'system'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role',
        message: 'Role must be one of: user, assistant, system'
      });
    }

    const message = { role, content };
    const updatedConversation = await cosmosService.addMessage(conversationId, user.id, message);

    res.status(201).json({
      success: true,
      conversation: updatedConversation,
      message: 'Message added successfully'
    });
  } catch (error) {
    console.error(`Failed to add message to conversation ${req.params.id}:`, error.message);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
        message: 'The requested conversation does not exist or you do not have access to it'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to add message',
      message: error.message
    });
  }
});

/**
 * POST /api/conversations/:id/archive
 * Archive a conversation
 */
router.post('/:id/archive', async (req, res) => {
  try {
    const user = req.user;
    const conversationId = req.params.id;

    const archivedConversation = await cosmosService.archiveConversation(conversationId, user.id);

    res.json({
      success: true,
      conversation: archivedConversation,
      message: 'Conversation archived successfully'
    });
  } catch (error) {
    console.error(`Failed to archive conversation ${req.params.id}:`, error.message);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
        message: 'The requested conversation does not exist or you do not have access to it'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to archive conversation',
      message: error.message
    });
  }
});


module.exports = router;
