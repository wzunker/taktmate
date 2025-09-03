const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { OpenAI } = require('openai');
require('dotenv').config();

// Import enhanced modules
const fileStore = require('./fileStore');
const { parseCsv, formatCsvForPrompt } = require('./processCsv');
const { userService } = require('./services/userService');
const { config: azureConfig } = require('./config/azureAdB2C');

// Import middleware
const { 
  jwtAuthMiddleware, 
  optionalJwtAuthMiddleware 
} = require('./middleware/jwtValidation');
const securityMiddleware = require('./middleware/security');

// Import error handling
const { createErrorHandler, asyncHandler } = require('./utils/errorHandler');

// Import routes
const authRoutes = require('./routes/auth');

// Initialize Application Insights FIRST (before any other imports)
let appInsights = null;
let telemetryClient = null;
let performanceMonitor = null;
try {
  appInsights = require('./config/applicationInsights');
  telemetryClient = appInsights.initializeApplicationInsights();
  
  if (telemetryClient) {
    console.log('✅ Application Insights SDK initialized successfully');
    
    // Start performance monitoring
    performanceMonitor = appInsights.performanceMonitoring.startMonitoring(60000); // Every minute
  }
} catch (error) {
  console.log('⚠️  Application Insights initialization failed:', error.message);
}

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Azure OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'BT4uTZtbBEx9a6ulvMS4w9m8qmJsZPl0lIosOOCu2dOsn2G1DLH5JQQJ99BHACYeBjFXJ3w3AAABACOGB5lu',
  baseURL: 'https://taktmate.openai.azure.com/openai/deployments/gpt-4.1',
  defaultQuery: { 'api-version': '2025-01-01-preview' },
  defaultHeaders: {
    'api-key': process.env.OPENAI_API_KEY || 'BT4uTZtbBEx9a6ulvMS4w9m8qmJsZPl0lIosOOCu2dOsn2G1DLH5JQQJ99BHACYeBjFXJ3w3AAABACOGB5lu',
  },
});

// Apply security middleware first
app.use(securityMiddleware);

// Add Application Insights middleware early in the pipeline
if (appInsights && appInsights.createExpressMiddleware) {
  app.use(appInsights.createExpressMiddleware());
}

// Enhanced CORS configuration with dynamic environment-specific settings
const corsConfig = require('./config/cors');

// Log CORS configuration for debugging
corsConfig.logCorsConfiguration();

// Apply CORS middleware with environment-specific configuration
app.use(cors(corsConfig.createCorsMiddlewareOptions()));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Mount authentication routes
app.use('/auth', authRoutes);

// Enhanced health check endpoint with authentication status
app.get('/health', optionalJwtAuthMiddleware(), (req, res) => {
  const healthStatus = {
    status: 'OK',
    message: 'TaktMate Backend is running',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    authentication: {
      configured: azureConfig.tenantName ? true : false,
      userAuthenticated: !!req.user
    },
    services: {
      fileStore: fileStore ? 'available' : 'unavailable',
      userService: userService ? 'available' : 'unavailable',
      openai: openai ? 'available' : 'unavailable'
    }
  };

  if (req.user) {
    healthStatus.user = {
      id: req.user.id,
      email: req.user.email,
      displayName: req.user.displayName
    };
  }

  res.json(healthStatus);
});

// Enhanced test endpoint with authentication info
app.get('/test', optionalJwtAuthMiddleware(), (req, res) => {
  const testResponse = {
    status: 'OK', 
    message: 'Backend is working',
    cors: 'enabled',
    timestamp: new Date().toISOString(),
    authentication: !!req.user,
    environment: process.env.NODE_ENV || 'development'
  };

  if (req.user) {
    testResponse.user = {
      authenticated: true,
      id: req.user.id,
      email: req.user.email
    };
  }

  res.json(testResponse);
});

// API status endpoint
app.get('/api/status', optionalJwtAuthMiddleware(), (req, res) => {
  const stats = fileStore.getStats();
  
  const statusResponse = {
    success: true,
    system: {
      status: 'operational',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    },
    storage: {
      totalFiles: stats.totalFiles,
      totalUsers: stats.totalUsers,
      storageUsedMB: stats.storageUsedMB,
      utilizationPercent: stats.utilizationPercent
    },
    authentication: {
      enabled: true,
      userAuthenticated: !!req.user
    }
  };

  if (req.user) {
    const userFiles = fileStore.getUserFiles(req.user.id);
    statusResponse.user = {
      id: req.user.id,
      email: req.user.email,
      fileCount: userFiles.length
    };
  }

  res.json(statusResponse);
});

// Enhanced CSV upload endpoint with authentication
app.post('/upload', jwtAuthMiddleware(), upload.single('csvFile'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    if (azureConfig.debugAuth) {
      console.log(`📁 File upload request from user: ${req.user.email} (${req.user.id})`);
    }
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        error: 'No CSV file uploaded',
        code: 'MISSING_FILE'
      });
    }

    const filename = req.file.originalname;
    const buffer = req.file.buffer;
    
    if (azureConfig.debugAuth) {
      console.log(`📁 Processing file: ${filename}, size: ${buffer.length} bytes`);
    }

    // Check if user can upload files
    if (!fileStore.canUserUpload(req.user.id, req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Upload limit reached or insufficient permissions',
        code: 'UPLOAD_DENIED',
        limits: {
          maxFilesPerUser: fileStore.maxFilesPerUser,
          currentFileCount: fileStore.getUserFiles(req.user.id).length
        }
      });
    }

    // Parse CSV with error handling and performance tracking
    let rows;
    try {
      if (appInsights?.performanceMonitoring) {
        rows = await appInsights.performanceMonitoring.trackOperation(
          'CSV_Parsing',
          async () => await parseCsv(buffer),
          {
            userId: req.user.id,
            filename: filename,
            fileSize: buffer.length,
            operation: 'csv_parsing'
          }
        );
      } else {
        rows = await parseCsv(buffer);
      }
    } catch (parseError) {
      // Track parsing error
      if (appInsights && appInsights.telemetry) {
        appInsights.telemetry.trackCSVError(
          parseError,
          req.user.id,
          null,
          filename,
          'parsing',
          {
            fileSize: buffer.length,
            errorStage: 'csv_parsing'
          }
        );
      }
      
      return res.status(400).json({
        success: false,
        error: 'Invalid CSV format: ' + parseError.message,
        code: 'INVALID_CSV'
      });
    }
    
    if (rows.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'CSV file is empty or contains no valid data',
        code: 'EMPTY_CSV'
      });
    }

    // Generate unique file ID with user prefix
    const fileId = `${req.user.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store file with user association
    const storeResult = fileStore.store(
      fileId, 
      filename, 
      rows, 
      req.user.id,
      req.user,
      {
        description: req.body.description || '',
        tags: req.body.tags ? req.body.tags.split(',').map(tag => tag.trim()) : [],
        isPublic: req.body.isPublic === 'true',
        allowSharing: req.body.allowSharing !== 'false', // Default true
        retentionDays: parseInt(req.body.retentionDays) || 7,
        userAgent: req.headers['user-agent'],
        ip: req.ip
      }
    );

    if (!storeResult.success) {
      return res.status(500).json({
        success: false,
        error: storeResult.error,
        code: 'STORAGE_ERROR'
      });
    }

    const duration = Date.now() - startTime;

    // Track comprehensive file upload metrics in Application Insights
    if (appInsights && appInsights.telemetry) {
      // Get column count from first row
      const columnCount = rows.length > 0 ? Object.keys(rows[0]).length : 0;
      
      // Track main file upload with comprehensive metrics
      appInsights.telemetry.trackFileUpload(
        req.user.id,
        filename,
        buffer.length,
        rows.length,
        duration,
        true, // success
        {
          userEmail: req.user.email,
          userDisplayName: req.user.displayName,
          description: req.body.description || '',
          tags: req.body.tags || '',
          isPublic: req.body.isPublic === 'true',
          allowSharing: req.body.allowSharing !== 'false',
          retentionDays: parseInt(req.body.retentionDays) || 7,
          userAgent: req.headers['user-agent'],
          ip: req.ip,
          columnCount: columnCount
        }
      );
      
      // Track CSV parsing operation specifically
      appInsights.telemetry.trackCSVParsing(
        req.user.id,
        filename,
        buffer.length,
        rows.length,
        columnCount,
        duration,
        true, // success
        {
          encoding: 'utf-8', // Assume UTF-8 for now
          delimiter: 'comma',
          hasEmptyRows: false, // We filter empty rows
          hasSpecialCharacters: filename.includes(' ') || /[^a-zA-Z0-9.-]/.test(filename)
        }
      );
      
      // Track business metrics
      const businessMetrics = {
        totalFilesUploaded: 1,
        totalDataPointsProcessed: rows.length * columnCount,
        averageFileSize: buffer.length,
        processingEfficiency: rows.length > 0 ? Math.round((rows.length / duration) * 1000) : 0
      };
      
      appInsights.telemetry.trackCSVBusinessMetrics(
        req.user.id,
        fileId,
        filename,
        businessMetrics,
        {
          uploadMethod: 'api',
          clientType: 'web'
        }
      );
    }

    if (azureConfig.debugAuth) {
      console.log(`✅ File stored successfully: ${filename} (${fileId}) in ${duration}ms`);
    }

    // Return comprehensive response
    const response = {
      success: true,
      fileId,
      filename,
      rowCount: rows.length,
      headers: Object.keys(rows[0]),
      size: storeResult.size,
      uploadedAt: storeResult.uploadedAt,
      user: {
        id: req.user.id,
        email: req.user.email,
        displayName: req.user.displayName
      },
      metadata: {
        isPublic: storeResult.isPublic || false,
        allowSharing: storeResult.allowSharing !== false,
        retentionDays: parseInt(req.body.retentionDays) || 7
      },
      processingDuration: duration,
      // Send first 50 rows for display
      data: rows.slice(0, 50)
    };

    // Add file count header
    const userFileCount = fileStore.getUserFiles(req.user.id).length;
    res.set('X-File-Count', userFileCount.toString());

    res.json(response);

  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error('Upload error:', error);
    
    // Track comprehensive upload error in Application Insights
    if (appInsights && appInsights.telemetry) {
      const filename = req.file?.originalname || 'unknown';
      const fileSize = req.file?.buffer?.length || 0;
      
      // Track CSV-specific error
      appInsights.telemetry.trackCSVError(
        error,
        req.user?.id,
        null, // fileId not available on error
        filename,
        'upload',
        {
          fileSize: fileSize,
          duration: duration,
          userAgent: req.headers['user-agent'],
          ip: req.ip,
          errorStage: 'upload_processing'
        }
      );
      
      // Also track general error for backwards compatibility
      appInsights.telemetry.trackError(error, req.user?.id, {
        component: 'csvUpload',
        filename: filename,
        duration: duration,
        operation: 'file_upload'
      });
    }

    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        success: false,
        error: 'File too large. Maximum size is 5MB.',
        code: 'FILE_TOO_LARGE',
        maxSize: '5MB'
      });
    }

    res.status(500).json({ 
      success: false,
      error: 'Failed to process CSV file: ' + error.message,
      code: 'PROCESSING_ERROR'
    });
  }
});

// Enhanced chat endpoint with authentication
app.post('/chat', jwtAuthMiddleware(), async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Debug flag - set DEBUG_PROMPTS=true in environment to enable
    const DEBUG_PROMPTS = process.env.DEBUG_PROMPTS === 'true';
    
    const { fileId, message } = req.body;

    if (!fileId || !message) {
      return res.status(400).json({ 
        success: false,
        error: 'fileId and message are required',
        code: 'MISSING_PARAMETERS'
      });
    }

    if (azureConfig.debugAuth) {
      console.log(`💬 Chat request from user: ${req.user.email} for file: ${fileId}`);
    }

    // Retrieve CSV data with user access control
    const fileData = fileStore.get(fileId, req.user.id, {
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });

    if (!fileData) {
      return res.status(404).json({ 
        success: false,
        error: 'File not found or access denied. Please check the file ID and your permissions.',
        code: 'FILE_NOT_FOUND'
      });
    }

    // Format CSV data for GPT prompt
    const csvString = formatCsvForPrompt(fileData.rows, fileData.filename);

    // Enhanced system prompt with user context
    const systemPrompt = `You are a CSV data assistant for TaktMate.
      User: ${req.user.displayName} (${req.user.email})
      File: ${fileData.filename}
      
      Rules:
      - Only use the provided CSV data. Do not infer or add outside knowledge.
      - If the answer is not in the CSV, reply exactly: "No relevant data found."
      - Respond with the most direct and concise answer possible. 
      - Output only the specific value(s) requested (e.g., IDs, names, numbers, percentages), not entire rows or extra fields, unless the question explicitly asks for them.
      - For lists, output only the relevant items, one per line or in a comma-separated list, without extra commentary.
      - For numeric answers, return the number with units.
      - Never explain your reasoning or provide additional context.
      - Be helpful and accurate in your analysis.

${csvString}`;

    // DEBUG: Log the full prompt if debug mode is enabled
    if (DEBUG_PROMPTS) {
      console.log('\n' + '='.repeat(80));
      console.log('🔍 FULL PROMPT DEBUG');
      console.log('='.repeat(80));
      console.log('📋 SYSTEM MESSAGE:');
      console.log(systemPrompt);
      console.log('\n📝 USER MESSAGE:');
      console.log(message);
      console.log(`👤 USER: ${req.user.email}`);
      console.log(`📁 FILE: ${fileData.filename}`);
      console.log('='.repeat(80) + '\n');
    }

    // Call Azure OpenAI GPT-4.1 with dependency tracking
    const completion = await appInsights?.performanceMonitoring?.trackDependencyCall(
      'OpenAI API',
      'HTTP',
      async () => {
        return await openai.chat.completions.create({
          model: 'gpt-4.1', // This matches your Azure deployment name
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message }
          ],
          max_tokens: 500,
          temperature: 0.1
        });
      },
      {
        command: 'chat.completions.create',
        model: 'gpt-4.1',
        messageLength: message.length,
        maxTokens: 500,
        temperature: 0.1
      }
    ) || await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      max_tokens: 500,
      temperature: 0.1
    });

    const reply = completion.choices[0].message.content;
    const duration = Date.now() - startTime;

    // DEBUG: Log the response if debug mode is enabled
    if (DEBUG_PROMPTS) {
      console.log('💬 GPT RESPONSE:');
      console.log(reply);
      console.log(`⏱️ Duration: ${duration}ms`);
      console.log('='.repeat(80) + '\n');
    }

    // Track comprehensive chat interaction in Application Insights
    if (appInsights && appInsights.telemetry) {
      // Extract token usage from completion if available
      const tokenUsage = completion.usage?.total_tokens || 0;
      const promptTokens = completion.usage?.prompt_tokens || 0;
      const completionTokens = completion.usage?.completion_tokens || 0;
      
      // Track main chat interaction with comprehensive metrics
      appInsights.telemetry.trackChatInteraction(
        req.user.id,
        fileId,
        fileData.filename,
        message.length,
        duration,
        true, // success
        {
          userEmail: req.user.email,
          userDisplayName: req.user.displayName,
          replyLength: reply.length,
          model: 'gpt-4.1',
          temperature: 0.1,
          maxTokens: 500,
          tokenUsage: tokenUsage,
          promptTokens: promptTokens,
          completionTokens: completionTokens,
          fileSize: fileData.size,
          fileRowCount: fileData.rowCount,
          fileAccessCount: fileData.accessCount,
          hasContext: true
        }
      );
      
      // Track CSV data analysis operation
      appInsights.telemetry.trackCSVAnalysis(
        req.user.id,
        fileId,
        fileData.filename,
        'chat_query',
        duration,
        true, // success
        {
          queryComplexity: message.length > 100 ? 'complex' : 'simple',
          responseLength: reply.length,
          dataPointsAnalyzed: fileData.rowCount,
          columnsAnalyzed: fileData.columnCount || 0
        }
      );
      
      // Track OpenAI dependency
      appInsights.telemetry.trackDependency(
        'OpenAI API',
        'chat.completions.create',
        duration,
        true,
        'HTTP'
      );
      
      // Track business metrics for chat usage
      const chatBusinessMetrics = {
        totalChatInteractions: 1,
        totalTokensUsed: tokenUsage,
        averageResponseTime: duration,
        dataEfficiency: fileData.rowCount > 0 ? Math.round(tokenUsage / fileData.rowCount) : 0
      };
      
      appInsights.telemetry.trackCSVBusinessMetrics(
        req.user.id,
        fileId,
        fileData.filename,
        chatBusinessMetrics,
        {
          interactionType: 'chat',
          aiModel: 'gpt-4.1'
        }
      );
    }

    if (azureConfig.debugAuth) {
      console.log(`✅ Chat response generated in ${duration}ms for user: ${req.user.email}`);
    }

    // Comprehensive response
    const response = {
      success: true,
      reply,
      fileId,
      filename: fileData.filename,
      user: {
        id: req.user.id,
        email: req.user.email,
        displayName: req.user.displayName
      },
      file: {
        accessCount: fileData.accessCount,
        lastAccessedAt: fileData.lastAccessedAt,
        rowCount: fileData.rowCount
      },
      processingDuration: duration,
      timestamp: new Date().toISOString()
    };

    res.json(response);

  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error('Chat error:', error);
    
    // Track comprehensive chat error in Application Insights with enhanced error tracking
    if (appInsights && appInsights.telemetry) {
      const fileId = req.body?.fileId;
      const message = req.body?.message || '';
      const fileData = fileStore.get(fileId);
      
      // Use specialized error tracking based on error type
      if (error.name && (error.name.includes('OpenAI') || error.name.includes('API') || error.code)) {
        // Track as external service error for OpenAI API issues
        appInsights.telemetry.trackExternalServiceError(error, 'OpenAI API', 'chat.completions.create', {
          endpoint: '/chat',
          duration: duration,
          userId: req.user?.id,
          fileId: fileId,
          messageLength: message.length,
          model: 'gpt-4.1',
          statusCode: error.status || error.statusCode || 500,
          timeout: error.code === 'ETIMEDOUT' || error.message?.includes('timeout'),
          retryCount: 0, // Could be enhanced with actual retry logic
          quotaExceeded: error.code === 'insufficient_quota'
        });
      } else {
        // Track as general HTTP error
        appInsights.telemetry.trackHTTPError(error, req, null, {
          component: 'chatEndpoint',
          operation: 'chat_processing',
          duration: duration,
          fileId: fileId,
          messageLength: message.length,
          hasFile: !!fileData,
          errorCategory: 'chat_error'
        });
      }
      
      // Track CSV-specific chat error
      appInsights.telemetry.trackCSVError(
        error,
        req.user?.id,
        fileId,
        fileData?.filename || 'unknown',
        'chat',
        {
          messageLength: message.length,
          duration: duration,
          fileSize: fileData?.size || 0,
          fileRowCount: fileData?.rowCount || 0,
          userAgent: req.headers['user-agent'],
          ip: req.ip,
          errorStage: 'chat_processing'
        }
      );
      
      // Track failed chat interaction
      appInsights.telemetry.trackChatInteraction(
        req.user?.id,
        fileId,
        fileData?.filename || 'unknown',
        message.length,
        duration,
        false, // success = false
        {
          userEmail: req.user?.email,
          errorType: error.name || 'Unknown',
          errorMessage: error.message || 'Unknown error',
          fileSize: fileData?.size || 0,
          fileRowCount: fileData?.rowCount || 0
        }
      );
      
      // Also track general error for backwards compatibility
      appInsights.telemetry.trackError(error, req.user?.id, {
        component: 'chatEndpoint',
        fileId: fileId,
        messageLength: message.length,
        duration: duration,
        operation: 'chat_interaction',
        endpoint: '/chat',
        method: 'POST',
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        correlationId: req.headers['x-correlation-id'],
        sessionId: req.sessionID
      });
    }

    // Handle specific OpenAI errors
    if (error.code === 'insufficient_quota') {
      return res.status(429).json({
        success: false,
        error: 'OpenAI API quota exceeded. Please try again later.',
        code: 'QUOTA_EXCEEDED'
      });
    }

    if (error.code === 'model_not_found') {
      return res.status(503).json({
        success: false,
        error: 'AI service temporarily unavailable. Please try again later.',
        code: 'SERVICE_UNAVAILABLE'
      });
    }

    res.status(500).json({ 
      success: false,
      error: 'Failed to process chat message: ' + error.message,
      code: 'PROCESSING_ERROR',
      processingDuration: duration
    });
  }
});

// File management endpoints

// Get user's files
app.get('/api/files', jwtAuthMiddleware(), (req, res) => {
  const startTime = Date.now();
  
  try {
    const options = {
      sortBy: req.query.sortBy || 'uploadedAt',
      sortOrder: req.query.sortOrder || 'desc',
      limit: parseInt(req.query.limit) || 20,
      offset: parseInt(req.query.offset) || 0
    };

    const userFiles = fileStore.getUserFiles(req.user.id, options);
    const totalFiles = fileStore.getAllIds(req.user.id).length;
    const duration = Date.now() - startTime;

    // Track comprehensive file listing operation
    if (appInsights && appInsights.telemetry) {
      // Track CSV file operation
      appInsights.telemetry.trackCSVFileOperation(
        req.user.id,
        null, // no specific fileId for list operation
        'file_list',
        'list',
        duration,
        true, // success
        {
          fileCount: userFiles.length,
          totalFiles: totalFiles,
          sortBy: options.sortBy,
          sortOrder: options.sortOrder,
          limit: options.limit,
          offset: options.offset,
          userAgent: req.headers['user-agent']
        }
      );
      
      // Also track legacy event for backwards compatibility
      appInsights.telemetry.trackEvent('FilesQueried', {
        userId: req.user.id,
        userEmail: req.user.email,
        fileCount: userFiles.length.toString(),
        totalFiles: totalFiles.toString()
      }, {
        queryDuration: duration
      });
    }

    res.set('X-Total-Count', totalFiles.toString());
    res.set('X-File-Count', userFiles.length.toString());

    res.json({
      success: true,
      files: userFiles,
      pagination: {
        total: totalFiles,
        returned: userFiles.length,
        offset: options.offset,
        limit: options.limit
      },
      queryDuration: duration
    });

  } catch (error) {
    console.error('Files query error:', error);
    
    if (appInsights && appInsights.telemetry) {
      appInsights.telemetry.trackError(error, req.user.id, {
        component: 'filesQuery'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve files: ' + error.message,
      code: 'FILES_QUERY_ERROR'
    });
  }
});

// Get specific file metadata
app.get('/api/files/:fileId', jwtAuthMiddleware(), (req, res) => {
  const startTime = Date.now();
  
  try {
    const fileId = req.params.fileId;
    const metadata = fileStore.getMetadata(fileId, req.user.id);

    if (!metadata) {
      return res.status(404).json({
        success: false,
        error: 'File not found or access denied',
        code: 'FILE_NOT_FOUND'
      });
    }

    const duration = Date.now() - startTime;

    // Track file metadata retrieval
    if (appInsights && appInsights.telemetry) {
      appInsights.telemetry.trackCSVFileOperation(
        req.user.id,
        fileId,
        metadata.filename,
        'view',
        duration,
        true, // success
        {
          fileSize: metadata.size,
          rowCount: metadata.rowCount,
          accessCount: metadata.accessCount,
          userAgent: req.headers['user-agent']
        }
      );
    }

    res.json({
      success: true,
      metadata: metadata,
      queryDuration: duration
    });

  } catch (error) {
    console.error('File metadata error:', error);
    
    if (appInsights && appInsights.telemetry) {
      const duration = Date.now() - startTime;
      
      // Track CSV-specific error
      appInsights.telemetry.trackCSVError(
        error,
        req.user.id,
        req.params.fileId,
        'unknown',
        'view',
        {
          duration: duration,
          userAgent: req.headers['user-agent'],
          errorStage: 'metadata_retrieval'
        }
      );
      
      // Also track general error
      appInsights.telemetry.trackError(error, req.user.id, {
        component: 'fileMetadata',
        fileId: req.params.fileId,
        operation: 'metadata_retrieval'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve file metadata: ' + error.message,
      code: 'METADATA_ERROR'
    });
  }
});

// Delete a file
app.delete('/api/files/:fileId', jwtAuthMiddleware(), (req, res) => {
  const startTime = Date.now();
  
  try {
    const fileId = req.params.fileId;
    const deleted = fileStore.delete(fileId, req.user.id, {
      reason: 'user_request',
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });

    const duration = Date.now() - startTime;

    if (deleted) {
      // Track comprehensive file deletion
      if (appInsights && appInsights.telemetry) {
        // Track CSV file operation
        appInsights.telemetry.trackCSVFileOperation(
          req.user.id,
          fileId,
          deleted.filename || 'unknown',
          'delete',
          duration,
          true, // success
          {
            fileSize: deleted.size || 0,
            rowCount: deleted.rowCount || 0,
            reason: 'user_request',
            userAgent: req.headers['user-agent'],
            ip: req.ip
          }
        );
        
        // Also track legacy event for backwards compatibility
        appInsights.telemetry.trackEvent('FileDeleted', {
          userId: req.user.id,
          userEmail: req.user.email,
          fileId: fileId,
          reason: 'user_request'
        }, {
          deletionDuration: duration
        });
      }

      if (azureConfig.debugAuth) {
        console.log(`🗑️  File ${fileId} deleted by user ${req.user.email}`);
      }

      res.json({
        success: true,
        message: 'File deleted successfully',
        fileId: fileId,
        deletionDuration: duration
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'File not found or access denied',
        code: 'FILE_NOT_FOUND'
      });
    }

  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error('File deletion error:', error);
    
    if (appInsights && appInsights.telemetry) {
      appInsights.telemetry.trackError(error, req.user.id, {
        component: 'fileDeletion',
        fileId: req.params.fileId,
        duration: duration
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to delete file: ' + error.message,
      code: 'DELETION_ERROR'
    });
  }
});

// Get file storage statistics for user
app.get('/api/files/stats/user', jwtAuthMiddleware(), (req, res) => {
  try {
    const userFiles = fileStore.getUserFiles(req.user.id);
    const globalStats = fileStore.getStats();
    
    const userStats = {
      success: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        displayName: req.user.displayName
      },
      files: {
        count: userFiles.length,
        maxAllowed: fileStore.maxFilesPerUser,
        utilizationPercent: Math.round((userFiles.length / fileStore.maxFilesPerUser) * 100)
      },
      storage: {
        totalSizeBytes: userFiles.reduce((sum, file) => sum + (file.size || 0), 0),
        totalSizeMB: Math.round(userFiles.reduce((sum, file) => sum + (file.size || 0), 0) / (1024 * 1024) * 100) / 100,
        averageFileSize: userFiles.length > 0 ? Math.round(userFiles.reduce((sum, file) => sum + (file.size || 0), 0) / userFiles.length) : 0
      },
      activity: {
        totalUploads: userFiles.length,
        totalAccesses: userFiles.reduce((sum, file) => sum + (file.accessCount || 0), 0),
        lastUpload: userFiles.length > 0 ? userFiles[0].uploadedAt : null,
        lastAccess: userFiles.length > 0 ? Math.max(...userFiles.map(f => new Date(f.lastAccessedAt || f.uploadedAt).getTime())) : null
      },
      system: {
        totalFiles: globalStats.totalFiles,
        totalUsers: globalStats.totalUsers,
        systemUtilization: globalStats.utilizationPercent
      }
    };

    res.json(userStats);

  } catch (error) {
    console.error('User stats error:', error);
    
    if (appInsights && appInsights.telemetry) {
      appInsights.telemetry.trackError(error, req.user.id, {
        component: 'userStats'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve user statistics: ' + error.message,
      code: 'STATS_ERROR'
    });
  }
});

// Comprehensive error handling middleware
app.use(createErrorHandler());

app.listen(PORT, () => {
  console.log('\n🚀 TaktMate Backend v2.0 - Azure AD B2C Enabled');
  console.log('=' .repeat(60));
  console.log(`🌐 Server: http://localhost:${PORT}`);
  console.log(`🏥 Health: http://localhost:${PORT}/health`);
  console.log(`📊 Status: http://localhost:${PORT}/api/status`);
  console.log(`🔐 Auth:   http://localhost:${PORT}/auth/config`);
  
  // Show configuration status
  console.log('\n🔧 Configuration:');
  console.log(`   Azure AD B2C: ${azureConfig.tenantName ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`   Application Insights: ${telemetryClient ? '✅ Initialized' : '⚠️  Not configured'}`);
  console.log(`   Security Middleware: ✅ Enabled`);
  console.log(`   File Store: ✅ Enhanced with user association`);
  console.log(`   User Service: ✅ Available`);
  
  // Show debug status
  const DEBUG_PROMPTS = process.env.DEBUG_PROMPTS === 'true';
  console.log('\n🔍 Debug Settings:');
  console.log(`   Debug Prompts: ${DEBUG_PROMPTS ? '✅ ENABLED' : '❌ DISABLED'} (set DEBUG_PROMPTS=true to enable)`);
  console.log(`   Debug Auth: ${azureConfig.debugAuth ? '✅ ENABLED' : '❌ DISABLED'}`);
  console.log(`   Debug JWT: ${azureConfig.debugJwt ? '✅ ENABLED' : '❌ DISABLED'}`);
  
  // Show Application Insights status if configured
  if (appInsights) {
    const configStatus = appInsights.getConfigurationStatus();
    console.log('\n📊 Application Insights:');
    console.log(`   Status: ${configStatus.configured ? '✅ Configured' : '❌ Not configured'}`);
    console.log(`   Environment: ${configStatus.environment}`);
    console.log(`   Sampling: ${configStatus.samplingPercentage}%`);
    console.log(`   Live Metrics: ${configStatus.liveMetricsEnabled ? '✅ Enabled' : '❌ Disabled'}`);
  }
  
  // Show available endpoints
  console.log('\n📡 Available Endpoints:');
  console.log('   Authentication:');
  console.log('     GET  /auth/config         - Get auth configuration');
  console.log('     GET  /auth/login-url      - Generate login URL');
  console.log('     POST /auth/validate       - Validate JWT token');
  console.log('     GET  /auth/status         - Auth system status');
  console.log('   File Operations:');
  console.log('     POST /upload              - Upload CSV file (auth required)');
  console.log('     POST /chat                - Chat with CSV data (auth required)');
  console.log('     GET  /api/files           - Get user files (auth required)');
  console.log('     GET  /api/files/:id       - Get file metadata (auth required)');
  console.log('     DELETE /api/files/:id     - Delete file (auth required)');
  console.log('     GET  /api/files/stats/user - Get user statistics (auth required)');
  console.log('   System:');
  console.log('     GET  /health              - Health check');
  console.log('     GET  /test                - Test endpoint');
  console.log('     GET  /api/status          - System status');
  
  // Show file store statistics
  const stats = fileStore.getStats();
  console.log('\n📁 File Store Status:');
  console.log(`   Total Files: ${stats.totalFiles}`);
  console.log(`   Total Users: ${stats.totalUsers}`);
  console.log(`   Storage Used: ${stats.storageUsedMB} MB`);
  console.log(`   Utilization: ${stats.utilizationPercent}%`);
  console.log(`   Max Capacity: ${stats.maxStorageCapacity} files`);
  
  console.log('\n✨ TaktMate Backend is ready for Azure AD B2C authentication!');
  console.log('=' .repeat(60));
  console.log(`📝 Note: Using port ${PORT} (port 5000 is used by macOS AirPlay)\n`);
  
  // Track comprehensive application startup performance
  if (appInsights && appInsights.telemetry) {
    const startupMetrics = {
      properties: {
        version: '2.0.0',
        azureAdB2CConfigured: azureConfig.tenantName ? 'true' : 'false',
        applicationInsightsConfigured: telemetryClient ? 'true' : 'false',
        performanceMonitoringEnabled: performanceMonitor ? 'true' : 'false',
        fileStoreEnabled: 'true',
        errorHandlingEnabled: 'true'
      },
      measurements: {
        startupDuration: Date.now() - (process.env.START_TIME || Date.now()),
        fileCount: stats.totalFiles,
        userCount: stats.totalUsers,
        moduleLoadTime: 0, // Could be enhanced with actual module load timing
        configurationTime: 0 // Could be enhanced with actual config timing
      }
    };
    
    appInsights.telemetry.trackStartupPerformance(startupMetrics);
    
    // Also track legacy startup event for backwards compatibility
    appInsights.telemetry.trackEvent('ApplicationStartup', {
      version: '2.0.0',
      environment: process.env.NODE_ENV || 'development',
      port: PORT.toString(),
      azureAdB2CConfigured: azureConfig.tenantName ? 'true' : 'false',
      applicationInsightsConfigured: telemetryClient ? 'true' : 'false',
      nodeVersion: process.version,
      platform: require('os').platform(),
      architecture: require('os').arch()
    }, {
      startupDuration: Date.now() - (process.env.START_TIME || Date.now()),
      memoryUsage: process.memoryUsage().heapUsed,
      fileCount: stats.totalFiles,
      userCount: stats.totalUsers
    });
  }
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('📊 SIGTERM received, shutting down gracefully');
  
  // Stop performance monitoring
  if (performanceMonitor && appInsights?.performanceMonitoring) {
    appInsights.performanceMonitoring.stopMonitoring(performanceMonitor);
  }
  
  // Flush telemetry data
  if (appInsights) {
    appInsights.flush();
  }
  
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📊 SIGINT received, shutting down gracefully');
  
  // Stop performance monitoring
  if (performanceMonitor && appInsights?.performanceMonitoring) {
    appInsights.performanceMonitoring.stopMonitoring(performanceMonitor);
  }
  
  // Flush telemetry data
  if (appInsights) {
    appInsights.flush();
  }
  
  process.exit(0);
});