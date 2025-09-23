const { CosmosClient } = require('@azure/cosmos');
const { DefaultAzureCredential } = require('@azure/identity');

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

  async createConversation(userId, fileName, title = null) {
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
        status: 'active',
        messageCount: 0,
        messages: [],
        summary: null,
        archiveBlobUrl: null,
        metadata: {
          totalTokens: 0,
          averageResponseTime: 0
        }
      };

      const { resource } = await this.container.items.create(conversation);
      console.log(`✅ Created conversation: ${conversationId} for user: ${userId}`);
      
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
          AND c.status != 'deleted'
          ORDER BY c.updatedAt DESC 
          OFFSET 0 LIMIT @limit
        `,
        parameters: [
          { name: '@userId', value: userId },
          { name: '@fileName', value: fileName },
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
}

// Export singleton instance
const cosmosService = new CosmosService();
module.exports = cosmosService;
