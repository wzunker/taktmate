const { CosmosClient } = require('@azure/cosmos');
const { DefaultAzureCredential } = require('@azure/identity');

// Configuration constants for conversation management
const CONVERSATION_CONFIG = {
  // Message limits and archiving thresholds
  MAX_ACTIVE_MESSAGES: 50,           // Maximum messages before archiving consideration
  ARCHIVE_THRESHOLD_MESSAGES: 40,    // Start archiving process at this count
  SUMMARIZATION_TRIGGER: 35,         // Generate summary at this message count
  MAX_TOKENS_PER_CONVERSATION: 50000, // Token limit before archiving
  
  // Status definitions
  STATUS: {
    ACTIVE: 'active',
    ARCHIVED: 'archived', 
    DELETED: 'deleted'
  },
  
  // Message roles
  ROLES: {
    USER: 'user',
    ASSISTANT: 'assistant',
    SYSTEM: 'system'
  },
  
  // TTL settings (in seconds)
  DEFAULT_TTL: 7776000, // 90 days
  ARCHIVED_TTL: 31536000 // 365 days for archived conversations
};

class CosmosService {
  constructor() {
    this.client = null;
    this.database = null;
    this.container = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      const endpoint = process.env.COSMOS_DB_ENDPOINT;
      const databaseName = process.env.COSMOS_DB_DATABASE_NAME;
      const containerName = process.env.COSMOS_DB_CONTAINER_NAME;

      if (!endpoint || !databaseName || !containerName) {
        throw new Error('Missing Cosmos DB configuration. Check environment variables.');
      }

      // Use Managed Identity for authentication
      const credential = new DefaultAzureCredential();
      
      this.client = new CosmosClient({
        endpoint,
        aadCredentials: credential
      });

      this.database = this.client.database(databaseName);
      this.container = this.database.container(containerName);

      // Test the connection
      await this.database.read();
      
      this.isInitialized = true;
      console.log('✅ Cosmos DB connection established successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Cosmos DB:', error.message);
      throw error;
    }
  }

  async healthCheck() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Simple read operation to check connectivity
      await this.database.read();
      
      return {
        status: 'healthy',
        database: process.env.COSMOS_DB_DATABASE_NAME,
        container: process.env.COSMOS_DB_CONTAINER_NAME,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  async createConversation(userId, fileName, title = null, suggestions = []) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();
      
      const conversation = {
        id: conversationId,
        userId,
        title: title || `Conversation about ${fileName}`,
        fileName,
        createdAt: now,
        updatedAt: now,
        status: CONVERSATION_CONFIG.STATUS.ACTIVE,
        messageCount: 0,
        messages: [],
        summary: null,
        archiveBlobUrl: null,
        suggestions: suggestions.length > 0 ? suggestions : null, // Store suggestions if provided
        metadata: {
          totalTokens: 0,
          averageResponseTime: 0,
          maxActiveMessages: CONVERSATION_CONFIG.MAX_ACTIVE_MESSAGES,
          archiveThreshold: CONVERSATION_CONFIG.ARCHIVE_THRESHOLD_MESSAGES,
          summarizationTrigger: CONVERSATION_CONFIG.SUMMARIZATION_TRIGGER
        },
        // TTL for automatic cleanup (90 days)
        ttl: CONVERSATION_CONFIG.DEFAULT_TTL
      };

      const { resource } = await this.container.items.create(conversation);
      console.log(`✅ Created conversation: ${conversationId} for user: ${userId} with ${suggestions.length} suggestions`);
      
      return resource;
    } catch (error) {
      console.error('❌ Failed to create conversation:', error.message);
      throw error;
    }
  }

  async getConversation(conversationId, userId) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const { resource } = await this.container.item(conversationId, userId).read();
      
      if (!resource) {
        throw new Error('Conversation not found');
      }

      return resource;
    } catch (error) {
      console.error(`❌ Failed to get conversation ${conversationId}:`, error.message);
      throw error;
    }
  }

  async listUserConversations(userId, limit = 20, offset = 0) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const querySpec = {
        query: `
          SELECT * FROM c 
          WHERE c.userId = @userId 
          ORDER BY c.updatedAt DESC 
          OFFSET @offset LIMIT @limit
        `,
        parameters: [
          { name: '@userId', value: userId },
          { name: '@offset', value: offset },
          { name: '@limit', value: limit }
        ]
      };

      const { resources } = await this.container.items.query(querySpec).fetchAll();
      
      console.log(`✅ Retrieved ${resources.length} conversations for user: ${userId}`);
      return resources;
    } catch (error) {
      console.error(`❌ Failed to list conversations for user ${userId}:`, error.message);
      throw error;
    }
  }

  async addMessage(conversationId, userId, message) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Get existing conversation
      const conversation = await this.getConversation(conversationId, userId);
      
      // Add message with ID and timestamp
      const messageWithMeta = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...message,
        timestamp: new Date().toISOString()
      };

      conversation.messages.push(messageWithMeta);
      conversation.messageCount = conversation.messages.length;
      conversation.updatedAt = new Date().toISOString();

      // Update conversation
      const { resource } = await this.container.item(conversationId, userId).replace(conversation);
      
      console.log(`✅ Added message to conversation: ${conversationId}`);
      return resource;
    } catch (error) {
      console.error(`❌ Failed to add message to conversation ${conversationId}:`, error.message);
      throw error;
    }
  }

  async updateConversation(conversationId, userId, updates) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const conversation = await this.getConversation(conversationId, userId);
      
      // Apply updates
      Object.assign(conversation, updates, {
        updatedAt: new Date().toISOString()
      });

      const { resource } = await this.container.item(conversationId, userId).replace(conversation);
      
      console.log(`✅ Updated conversation: ${conversationId}`);
      return resource;
    } catch (error) {
      console.error(`❌ Failed to update conversation ${conversationId}:`, error.message);
      throw error;
    }
  }

  async deleteConversation(conversationId, userId) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Soft delete by updating status
      await this.updateConversation(conversationId, userId, {
        status: 'deleted'
      });
      
      console.log(`✅ Soft deleted conversation: ${conversationId}`);
      return { success: true, message: 'Conversation deleted successfully' };
    } catch (error) {
      console.error(`❌ Failed to delete conversation ${conversationId}:`, error.message);
      throw error;
    }
  }

  async searchConversations(userId, query, limit = 10) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const querySpec = {
        query: `
          SELECT * FROM c 
          WHERE c.userId = @userId 
          AND (CONTAINS(UPPER(c.title), UPPER(@query)) OR CONTAINS(UPPER(c.summary), UPPER(@query)))
          AND c.status != 'deleted'
          ORDER BY c.updatedAt DESC 
          OFFSET 0 LIMIT @limit
        `,
        parameters: [
          { name: '@userId', value: userId },
          { name: '@query', value: query },
          { name: '@limit', value: limit }
        ]
      };

      const { resources } = await this.container.items.query(querySpec).fetchAll();
      
      console.log(`✅ Found ${resources.length} conversations matching query: "${query}"`);
      return resources;
    } catch (error) {
      console.error(`❌ Failed to search conversations:`, error.message);
      throw error;
    }
  }

  async getConversationsByFile(userId, fileName, limit = 10) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const querySpec = {
        query: `
          SELECT * FROM c 
          WHERE c.userId = @userId 
          AND c.fileName = @fileName
          AND c.status != @deletedStatus
          ORDER BY c.updatedAt DESC 
          OFFSET 0 LIMIT @limit
        `,
        parameters: [
          { name: '@userId', value: userId },
          { name: '@fileName', value: fileName },
          { name: '@deletedStatus', value: CONVERSATION_CONFIG.STATUS.DELETED },
          { name: '@limit', value: limit }
        ]
      };

      const { resources } = await this.container.items.query(querySpec).fetchAll();
      
      console.log(`✅ Found ${resources.length} conversations for file: ${fileName}`);
      return resources;
    } catch (error) {
      console.error(`❌ Failed to get conversations by file:`, error.message);
      throw error;
    }
  }

  /**
   * Check if a conversation needs archiving based on configured thresholds
   * @param {Object} conversation - The conversation document
   * @returns {Object} - Archiving recommendation with reasons
   */
  shouldArchiveConversation(conversation) {
    const reasons = [];
    let shouldArchive = false;

    // Check message count threshold
    if (conversation.messageCount >= CONVERSATION_CONFIG.ARCHIVE_THRESHOLD_MESSAGES) {
      reasons.push(`Message count (${conversation.messageCount}) exceeds threshold (${CONVERSATION_CONFIG.ARCHIVE_THRESHOLD_MESSAGES})`);
      shouldArchive = true;
    }

    // Check token count threshold
    if (conversation.metadata?.totalTokens >= CONVERSATION_CONFIG.MAX_TOKENS_PER_CONVERSATION) {
      reasons.push(`Token count (${conversation.metadata.totalTokens}) exceeds threshold (${CONVERSATION_CONFIG.MAX_TOKENS_PER_CONVERSATION})`);
      shouldArchive = true;
    }

    // Check if already archived
    if (conversation.status === CONVERSATION_CONFIG.STATUS.ARCHIVED) {
      reasons.push('Conversation is already archived');
    }

    return {
      shouldArchive,
      reasons,
      messageCount: conversation.messageCount,
      tokenCount: conversation.metadata?.totalTokens || 0,
      thresholds: {
        maxMessages: CONVERSATION_CONFIG.MAX_ACTIVE_MESSAGES,
        archiveMessages: CONVERSATION_CONFIG.ARCHIVE_THRESHOLD_MESSAGES,
        maxTokens: CONVERSATION_CONFIG.MAX_TOKENS_PER_CONVERSATION
      }
    };
  }

  /**
   * Check if a conversation needs summarization
   * @param {Object} conversation - The conversation document
   * @returns {boolean} - True if summarization is needed
   */
  shouldSummarizeConversation(conversation) {
    return conversation.messageCount >= CONVERSATION_CONFIG.SUMMARIZATION_TRIGGER && 
           !conversation.summary &&
           conversation.status === CONVERSATION_CONFIG.STATUS.ACTIVE;
  }

  /**
   * Get recent messages from a conversation (for performance)
   * @param {string} conversationId - The conversation ID
   * @param {string} userId - The user ID (for partition key)
   * @param {number} limit - Number of recent messages to retrieve
   * @returns {Array} - Array of recent messages
   */
  async getRecentMessages(conversationId, userId, limit = 20) {
    try {
      const conversation = await this.getConversation(conversationId, userId);
      
      // Return the most recent messages (last N messages)
      const recentMessages = conversation.messages.slice(-limit);
      
      console.log(`✅ Retrieved ${recentMessages.length} recent messages from conversation: ${conversationId}`);
      return recentMessages;
    } catch (error) {
      console.error(`❌ Failed to get recent messages from conversation ${conversationId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get full conversation (including archived messages if needed)
   * @param {string} conversationId - The conversation ID
   * @param {string} userId - The user ID (for partition key)
   * @returns {Object} - Full conversation with all messages
   */
  async getFullConversation(conversationId, userId) {
    try {
      const conversation = await this.getConversation(conversationId, userId);
      
      // If conversation is archived and has a blob URL, fetch from blob storage
      if (conversation.status === CONVERSATION_CONFIG.STATUS.ARCHIVED && conversation.archiveBlobUrl) {
        console.log(`📁 Conversation ${conversationId} is archived, retrieving from blob storage`);
        try {
          // Dynamically import to avoid circular dependency
          const summarizerService = require('./summarizerService');
          const archivedConversation = await summarizerService.getArchivedConversation(conversation.archiveBlobUrl);
          
          // Merge archived data with current metadata
          const fullConversation = {
            ...conversation,
            messages: archivedConversation.messages || conversation.messages,
            originalMessageCount: archivedConversation.messageCount || conversation.messageCount
          };
          
          console.log(`✅ Retrieved full archived conversation: ${conversationId}`);
          return fullConversation;
        } catch (blobError) {
          console.warn(`⚠️ Failed to retrieve archived conversation from blob, using trimmed version:`, blobError.message);
          // Fall back to the trimmed version in Cosmos DB
        }
      }
      
      console.log(`✅ Retrieved full conversation: ${conversationId}`);
      return conversation;
    } catch (error) {
      console.error(`❌ Failed to get full conversation ${conversationId}:`, error.message);
      throw error;
    }
  }

  /**
   * Archive a conversation (move to blob storage + summarize)
   * @param {string} conversationId - The conversation ID
   * @param {string} userId - The user ID (for partition key)
   * @returns {Object} - Updated conversation document
   */
  async archiveConversation(conversationId, userId) {
    try {
      // Use the full summarization service for complete archiving
      const summarizerService = require('./summarizerService');
      const archivedConversation = await summarizerService.archiveConversationComplete(conversationId, userId);
      
      console.log(`📁 Archived conversation using summarization service: ${conversationId}`);
      return archivedConversation;
    } catch (error) {
      console.error(`❌ Failed to archive conversation ${conversationId}:`, error.message);
      throw error;
    }
  }

  /**
   * Generate a title for a conversation based on its messages
   * @param {Array} messages - Array of messages in the conversation
   * @param {string} fileName - Associated file name
   * @returns {string} - Generated title
   */
  generateTitle(messages, fileName) {
    try {
      // Simple title generation based on first user message
      const firstUserMessage = messages.find(msg => msg.role === CONVERSATION_CONFIG.ROLES.USER);
      
      if (firstUserMessage && firstUserMessage.content) {
        // Extract first few words from the user's question
        const words = firstUserMessage.content.trim().split(' ').slice(0, 6);
        let title = words.join(' ');
        
        // Add ellipsis if truncated
        if (firstUserMessage.content.split(' ').length > 6) {
          title += '...';
        }
        
        // Fallback to file-based title if message is too short
        if (title.length < 10) {
          title = `Discussion about ${fileName}`;
        }
        
        console.log(`✅ Generated title: "${title}"`);
        return title;
      }
      
      // Fallback title
      const fallbackTitle = `Conversation about ${fileName}`;
      console.log(`✅ Using fallback title: "${fallbackTitle}"`);
      return fallbackTitle;
    } catch (error) {
      console.error('❌ Failed to generate title:', error.message);
      return `Conversation about ${fileName}`;
    }
  }

  /**
   * Get conversations by date range
   * @param {string} userId - The user ID
   * @param {string} startDate - Start date (ISO string)
   * @param {string} endDate - End date (ISO string)
   * @param {number} limit - Maximum number of conversations to return
   * @returns {Array} - Array of conversations in date range
   */
  async getConversationsByDateRange(userId, startDate, endDate, limit = 50) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const querySpec = {
        query: `
          SELECT * FROM c 
          WHERE c.userId = @userId 
          AND c.createdAt >= @startDate 
          AND c.createdAt <= @endDate
          AND c.status != @deletedStatus
          ORDER BY c.createdAt DESC 
          OFFSET 0 LIMIT @limit
        `,
        parameters: [
          { name: '@userId', value: userId },
          { name: '@startDate', value: startDate },
          { name: '@endDate', value: endDate },
          { name: '@deletedStatus', value: CONVERSATION_CONFIG.STATUS.DELETED },
          { name: '@limit', value: limit }
        ]
      };

      const { resources } = await this.container.items.query(querySpec).fetchAll();
      
      console.log(`✅ Found ${resources.length} conversations between ${startDate} and ${endDate}`);
      return resources;
    } catch (error) {
      console.error(`❌ Failed to get conversations by date range:`, error.message);
      throw error;
    }
  }
}

// Export singleton instance and configuration
const cosmosService = new CosmosService();
module.exports = cosmosService;
module.exports.CONVERSATION_CONFIG = CONVERSATION_CONFIG;
