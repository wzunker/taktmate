const { OpenAI } = require('openai');
const { BlobServiceClient } = require('@azure/storage-blob');
const { DefaultAzureCredential } = require('@azure/identity');
const cosmosService = require('./cosmos');
const openaiService = require('./openaiService');

// Initialize Azure OpenAI for summarization (always use GPT-4.1 for this)
const openai = openaiService.createOpenAIClient('gpt-4.1');

class SummarizerService {
  constructor() {
    this.blobServiceClient = null;
    this.containerName = 'conversation-archives';
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      const storageAccountName = process.env.STORAGE_ACCOUNT_NAME;
      if (!storageAccountName) {
        throw new Error('STORAGE_ACCOUNT_NAME environment variable is required');
      }

      // Use Managed Identity for blob storage authentication
      const credential = new DefaultAzureCredential();
      const blobServiceUrl = `https://${storageAccountName}.blob.core.windows.net`;
      
      this.blobServiceClient = new BlobServiceClient(blobServiceUrl, credential);

      // Ensure the container exists
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      await containerClient.createIfNotExists({
        access: 'container'
      });

      this.isInitialized = true;
      console.log('✅ Summarizer service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize summarizer service:', error.message);
      throw error;
    }
  }

  /**
   * Generate a conversation summary using Azure OpenAI
   * @param {Array} messages - Array of conversation messages
   * @param {string} fileName - Associated file name for context
   * @returns {string} - Generated summary
   */
  async summarizeConversation(messages, fileName) {
    try {
      if (!messages || messages.length === 0) {
        return `Empty conversation about ${fileName}`;
      }

      // Filter out system messages and prepare conversation text
      const conversationText = messages
        .filter(msg => msg.role !== 'system')
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');

      const summaryPrompt = `Summarize the following conversation about the CSV file "${fileName}". 
      
      Focus on:
      - Key questions asked by the user
      - Main insights or data points discussed
      - Important findings or patterns identified
      - Overall theme of the conversation
      
      Keep the summary concise (2-3 sentences) and informative.
      
      Conversation:
      ${conversationText}
      
      Summary:`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4.1',
        messages: [
          { role: 'system', content: 'You are an expert at summarizing data analysis conversations. Provide clear, concise summaries.' },
          { role: 'user', content: summaryPrompt }
        ],
        max_tokens: 200,
        temperature: 0.1
      });

      const summary = completion.choices[0].message.content.trim();
      console.log(`✅ Generated summary for conversation about ${fileName}`);
      
      return summary;
    } catch (error) {
      console.error('❌ Failed to generate conversation summary:', error.message);
      // Return a fallback summary
      return `Conversation about ${fileName} with ${messages.length} messages covering data analysis and insights.`;
    }
  }

  /**
   * Check if a conversation should be archived
   * @param {Object} conversation - The conversation document
   * @returns {boolean} - True if conversation should be archived
   */
  shouldArchive(conversation) {
    return cosmosService.shouldArchiveConversation(conversation).shouldArchive;
  }

  /**
   * Archive a conversation to blob storage
   * @param {Object} conversation - The conversation document
   * @returns {string} - Blob URL of the archived conversation
   */
  async archiveToBlob(conversation) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const blobName = `${conversation.userId}/${conversation.id}_${Date.now()}.json`;
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      const blobClient = containerClient.getBlobClient(blobName);
      const blockBlobClient = blobClient.getBlockBlobClient();

      // Prepare the full conversation data for archiving
      const archiveData = {
        ...conversation,
        archivedAt: new Date().toISOString(),
        archiveVersion: '1.0'
      };

      const jsonData = JSON.stringify(archiveData, null, 2);

      // Upload to blob storage
      await blockBlobClient.upload(jsonData, jsonData.length, {
        blobHTTPHeaders: {
          blobContentType: 'application/json'
        },
        metadata: {
          conversationId: conversation.id,
          userId: conversation.userId,
          fileName: conversation.fileName,
          messageCount: conversation.messageCount.toString(),
          archivedAt: new Date().toISOString()
        }
      });

      const blobUrl = blobClient.url;
      console.log(`✅ Archived conversation ${conversation.id} to blob: ${blobName}`);
      
      return blobUrl;
    } catch (error) {
      console.error(`❌ Failed to archive conversation ${conversation.id} to blob:`, error.message);
      throw error;
    }
  }

  /**
   * Retrieve archived conversation from blob storage
   * @param {string} blobUrl - URL of the archived conversation
   * @returns {Object} - Full conversation data from archive
   */
  async getArchivedConversation(blobUrl) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Extract blob name from URL
      const urlParts = blobUrl.split('/');
      const blobName = urlParts.slice(-2).join('/'); // userId/filename

      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      const blobClient = containerClient.getBlobClient(blobName);

      const downloadResponse = await blobClient.download();
      const downloadedContent = await this.streamToString(downloadResponse.readableStreamBody);
      
      const conversationData = JSON.parse(downloadedContent);
      
      console.log(`✅ Retrieved archived conversation from blob: ${blobName}`);
      return conversationData;
    } catch (error) {
      console.error('❌ Failed to retrieve archived conversation:', error.message);
      throw error;
    }
  }

  /**
   * Trim a conversation to keep only recent messages
   * @param {Object} conversation - The conversation document
   * @param {number} keepLast - Number of recent messages to keep
   * @returns {Object} - Conversation with trimmed messages
   */
  trimConversation(conversation, keepLast = 10) {
    try {
      if (!conversation.messages || conversation.messages.length <= keepLast) {
        return conversation;
      }

      const trimmedConversation = {
        ...conversation,
        messages: conversation.messages.slice(-keepLast),
        originalMessageCount: conversation.messageCount,
        trimmedAt: new Date().toISOString()
      };

      console.log(`✅ Trimmed conversation ${conversation.id} from ${conversation.messages.length} to ${keepLast} messages`);
      return trimmedConversation;
    } catch (error) {
      console.error(`❌ Failed to trim conversation ${conversation.id}:`, error.message);
      return conversation; // Return original on error
    }
  }

  /**
   * Full archiving process: summarize, archive to blob, and trim
   * @param {string} conversationId - The conversation ID
   * @param {string} userId - The user ID
   * @returns {Object} - Updated conversation document
   */
  async archiveConversationComplete(conversationId, userId) {
    try {
      // Get the full conversation
      const conversation = await cosmosService.getConversation(conversationId, userId);
      
      if (conversation.status === 'archived') {
        console.log(`⚠️ Conversation ${conversationId} is already archived`);
        return conversation;
      }

      console.log(`🔄 Starting full archive process for conversation ${conversationId}`);

      // Step 1: Generate summary if not exists
      let summary = conversation.summary;
      if (!summary && conversation.messages.length > 0) {
        summary = await this.summarizeConversation(conversation.messages, conversation.fileName);
      }

      // Step 2: Archive full conversation to blob storage
      const blobUrl = await this.archiveToBlob(conversation);

      // Step 3: Trim the conversation for Cosmos DB
      const trimmedConversation = this.trimConversation(conversation, 10);

      // Step 4: Update the conversation in Cosmos DB
      const updates = {
        status: 'archived',
        messages: trimmedConversation.messages,
        summary: summary,
        archiveBlobUrl: blobUrl,
        archivedAt: new Date().toISOString(),
        originalMessageCount: conversation.messageCount,
        ttl: cosmosService.CONVERSATION_CONFIG.ARCHIVED_TTL // Extended TTL for archived conversations
      };

      const updatedConversation = await cosmosService.updateConversation(conversationId, userId, updates);

      console.log(`✅ Completed full archive process for conversation ${conversationId}`);
      return updatedConversation;
    } catch (error) {
      console.error(`❌ Failed to complete archive process for conversation ${conversationId}:`, error.message);
      throw error;
    }
  }

  /**
   * Process conversations that need archiving
   * @param {string} userId - User ID to process conversations for
   * @returns {Array} - Array of archived conversation IDs
   */
  async processArchivingQueue(userId) {
    try {
      console.log(`🔄 Processing archiving queue for user ${userId}`);
      
      // Get active conversations for the user
      const conversations = await cosmosService.listUserConversations(userId, 100, 0);
      const archivedIds = [];

      for (const conversation of conversations) {
        if (conversation.status === 'active' && this.shouldArchive(conversation)) {
          try {
            await this.archiveConversationComplete(conversation.id, userId);
            archivedIds.push(conversation.id);
            console.log(`✅ Auto-archived conversation ${conversation.id}`);
          } catch (error) {
            console.error(`❌ Failed to auto-archive conversation ${conversation.id}:`, error.message);
            // Continue processing other conversations
          }
        }
      }

      console.log(`✅ Processed archiving queue for user ${userId}: ${archivedIds.length} conversations archived`);
      return archivedIds;
    } catch (error) {
      console.error(`❌ Failed to process archiving queue for user ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * Helper function to convert stream to string
   * @param {ReadableStream} readableStream - The readable stream
   * @returns {string} - String content
   */
  async streamToString(readableStream) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      readableStream.on('data', (data) => {
        chunks.push(data.toString());
      });
      readableStream.on('end', () => {
        resolve(chunks.join(''));
      });
      readableStream.on('error', reject);
    });
  }

  /**
   * Health check for the summarizer service
   * @returns {Object} - Health status
   */
  async healthCheck() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Test blob storage connectivity
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      await containerClient.getProperties();

      return {
        status: 'healthy',
        service: 'summarizer',
        blobStorage: 'connected',
        containerName: this.containerName,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        service: 'summarizer',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Export singleton instance
const summarizerService = new SummarizerService();
module.exports = summarizerService;
