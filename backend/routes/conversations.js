const express = require('express');
const router = express.Router();
const cosmosService = require('../services/cosmos');
const { requireAuth } = require('../middleware/auth');

// Apply authentication to all conversation routes
router.use(requireAuth);

/**
 * GET /api/conversations
 * List user conversations with pagination
 */
router.get('/', async (req, res) => {
  try {
    const user = req.user;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const fileName = req.query.fileName; // Optional filter by file
    const search = req.query.search; // Optional search query
    const startDate = req.query.startDate; // Optional date range start
    const endDate = req.query.endDate; // Optional date range end

    let conversations;

    // Handle different query types
    if (search) {
      conversations = await cosmosService.searchConversations(user.id, search, limit);
    } else if (fileName) {
      conversations = await cosmosService.getConversationsByFile(user.id, fileName, limit);
    } else if (startDate && endDate) {
      conversations = await cosmosService.getConversationsByDateRange(user.id, startDate, endDate, limit);
    } else {
      conversations = await cosmosService.listUserConversations(user.id, limit, offset);
    }

    // Add metadata for pagination
    const response = {
      success: true,
      conversations,
      pagination: {
        limit,
        offset,
        count: conversations.length,
        hasMore: conversations.length === limit
      },
      filters: {
        fileName,
        search,
        startDate,
        endDate
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
 * Create new conversation
 */
router.post('/', async (req, res) => {
  try {
    const user = req.user;
    const { fileName, title } = req.body;

    if (!fileName) {
      return res.status(400).json({
        success: false,
        error: 'fileName is required',
        message: 'Please specify the CSV file name for this conversation'
      });
    }

    const conversation = await cosmosService.createConversation(user.id, fileName, title);

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

/**
 * GET /api/conversations/:id/export/json
 * Export conversation as JSON
 */
router.get('/:id/export/json', async (req, res) => {
  try {
    const user = req.user;
    const conversationId = req.params.id;

    const conversation = await cosmosService.getFullConversation(conversationId, user.id);

    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="conversation-${conversationId}.json"`);

    res.json(conversation);
  } catch (error) {
    console.error(`Failed to export conversation ${req.params.id}:`, error.message);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
        message: 'The requested conversation does not exist or you do not have access to it'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to export conversation',
      message: error.message
    });
  }
});

/**
 * GET /api/conversations/:id/export/csv
 * Export conversation as CSV
 */
router.get('/:id/export/csv', async (req, res) => {
  try {
    const user = req.user;
    const conversationId = req.params.id;

    const conversation = await cosmosService.getFullConversation(conversationId, user.id);

    // Convert messages to CSV format
    const csvHeader = 'timestamp,role,content\n';
    const csvRows = conversation.messages.map(msg => {
      const timestamp = msg.timestamp || new Date().toISOString();
      const content = `"${msg.content.replace(/"/g, '""')}"`;
      return `${timestamp},${msg.role},${content}`;
    }).join('\n');

    const csvContent = csvHeader + csvRows;

    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="conversation-${conversationId}.csv"`);

    res.send(csvContent);
  } catch (error) {
    console.error(`Failed to export conversation as CSV ${req.params.id}:`, error.message);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
        message: 'The requested conversation does not exist or you do not have access to it'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to export conversation',
      message: error.message
    });
  }
});

module.exports = router;
