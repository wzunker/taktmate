/**
 * Azure Application Insights Configuration for TaktMate
 * 
 * This module provides comprehensive Application Insights setup for monitoring,
 * logging, performance tracking, and custom telemetry for the TaktMate application.
 * 
 * Features:
 * - Automatic request, dependency, and exception tracking
 * - Custom telemetry for authentication, file uploads, and chat interactions
 * - Performance monitoring and alerting
 * - User behavior analytics
 * - Error tracking and diagnostics
 * - Live metrics streaming
 * - Custom dashboards and KPIs
 */

const appInsights = require('applicationinsights');
const os = require('os');
const { config: azureConfig } = require('./azureAdB2C');

/**
 * Application Insights Configuration
 */
const config = {
  // Primary configuration
  connectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING,
  instrumentationKey: process.env.APPINSIGHTS_INSTRUMENTATIONKEY,
  cloudRole: process.env.APPINSIGHTS_CLOUD_ROLE || 'taktmate-backend',
  cloudRoleInstance: process.env.APPINSIGHTS_CLOUD_ROLE_INSTANCE || `${os.hostname()}-${process.pid}`,
  
  // Sampling configuration
  samplingPercentage: parseFloat(process.env.APPINSIGHTS_SAMPLING_PERCENTAGE) || 100,
  maxSamplesPerSecond: parseInt(process.env.APPINSIGHTS_MAX_SAMPLES_PER_SECOND) || 20,
  
  // Auto-collection settings
  enableAutoCollectRequests: process.env.APPINSIGHTS_AUTO_COLLECT_REQUESTS !== 'false',
  enableAutoCollectPerformance: process.env.APPINSIGHTS_AUTO_COLLECT_PERFORMANCE !== 'false',
  enableAutoCollectExceptions: process.env.APPINSIGHTS_AUTO_COLLECT_EXCEPTIONS !== 'false',
  enableAutoCollectDependencies: process.env.APPINSIGHTS_AUTO_COLLECT_DEPENDENCIES !== 'false',
  enableAutoCollectConsole: process.env.APPINSIGHTS_AUTO_COLLECT_CONSOLE !== 'false',
  enableAutoCollectHeartbeat: process.env.APPINSIGHTS_AUTO_COLLECT_HEARTBEAT !== 'false',
  
  // Live metrics and streaming
  enableLiveMetrics: process.env.APPINSIGHTS_ENABLE_LIVE_METRICS === 'true' || process.env.NODE_ENV === 'production',
  liveMetricsAuthenticationApiKey: process.env.APPINSIGHTS_LIVE_METRICS_API_KEY,
  
  // Web instrumentation
  enableWebInstrumentation: process.env.APPINSIGHTS_ENABLE_WEB_INSTRUMENTATION !== 'false',
  enableAutoCollectIncomingRequestAzureFunctions: false,
  
  // Correlation and tracing
  enableDistributedTracing: process.env.APPINSIGHTS_ENABLE_DISTRIBUTED_TRACING !== 'false',
  enableAutoCorrelation: process.env.APPINSIGHTS_ENABLE_AUTO_CORRELATION !== 'false',
  enableRequestResponseHeaders: process.env.APPINSIGHTS_ENABLE_REQUEST_RESPONSE_HEADERS === 'true',
  
  // Performance and diagnostics
  enableUseDiskRetryCaching: process.env.APPINSIGHTS_USE_DISK_RETRY_CACHING !== 'false',
  enableResendInterval: parseInt(process.env.APPINSIGHTS_RESEND_INTERVAL) || 60000, // 1 minute
  enableMaxBytesOnDisk: parseInt(process.env.APPINSIGHTS_MAX_BYTES_ON_DISK) || 50 * 1024 * 1024, // 50MB
  
  // Privacy and compliance
  disableAllExtendedMetrics: process.env.APPINSIGHTS_DISABLE_EXTENDED_METRICS === 'true',
  enableAutoCollectPreAggregatedMetrics: process.env.APPINSIGHTS_PREAGGREGATE_METRICS !== 'false',
  enableSendLiveMetrics: process.env.APPINSIGHTS_SEND_LIVE_METRICS !== 'false',
  
  // Custom settings for TaktMate
  enableCustomTelemetry: process.env.APPINSIGHTS_ENABLE_CUSTOM_TELEMETRY !== 'false',
  enableUserTracking: process.env.APPINSIGHTS_ENABLE_USER_TRACKING !== 'false',
  enableBusinessMetrics: process.env.APPINSIGHTS_ENABLE_BUSINESS_METRICS !== 'false',
  enableSecurityMonitoring: process.env.APPINSIGHTS_ENABLE_SECURITY_MONITORING !== 'false',
  
  // Debug and development
  enableDebugLogging: process.env.APPINSIGHTS_DEBUG_LOGGING === 'true' || azureConfig.debugAuth,
  enableVerboseLogging: process.env.APPINSIGHTS_VERBOSE_LOGGING === 'true',
  
  // Environment and deployment
  environment: process.env.NODE_ENV || 'development',
  version: process.env.APP_VERSION || '2.0.0',
  deploymentId: process.env.DEPLOYMENT_ID || `deploy-${Date.now()}`,
  
  // Resource information
  resourceGroup: process.env.AZURE_RESOURCE_GROUP,
  subscriptionId: process.env.AZURE_SUBSCRIPTION_ID,
  region: process.env.AZURE_REGION || 'East US'
};

/**
 * Initialize Application Insights with comprehensive configuration
 */
function initializeApplicationInsights() {
  try {
    // Only initialize if connection string is provided
    if (!config.connectionString && !config.instrumentationKey) {
      if (config.enableDebugLogging) {
        console.log('⚠️  Application Insights not configured - skipping initialization');
        console.log('   Set APPLICATIONINSIGHTS_CONNECTION_STRING or APPINSIGHTS_INSTRUMENTATIONKEY to enable');
      }
      return null;
    }

    // Setup Application Insights with connection string (preferred) or instrumentation key
    if (config.connectionString) {
      appInsights.setup(config.connectionString);
      if (config.enableDebugLogging) {
        console.log('🔧 Application Insights setup with connection string');
      }
    } else if (config.instrumentationKey) {
      appInsights.setup(config.instrumentationKey);
      if (config.enableDebugLogging) {
        console.log('🔧 Application Insights setup with instrumentation key (deprecated)');
      }
    }

    // Configure comprehensive auto-collection
    appInsights.Configuration
      .setAutoCollectRequests(config.enableAutoCollectRequests)
      .setAutoCollectPerformance(config.enableAutoCollectPerformance, config.enableAutoCollectExceptions)
      .setAutoCollectExceptions(config.enableAutoCollectExceptions)
      .setAutoCollectDependencies(config.enableAutoCollectDependencies)
      .setAutoCollectConsole(config.enableAutoCollectConsole, config.enableAutoCollectConsole)
      .setAutoCollectHeartbeat(config.enableAutoCollectHeartbeat)
      .setAutoCollectPreAggregatedMetrics(config.enableAutoCollectPreAggregatedMetrics)
      .setUseDiskRetryCaching(config.enableUseDiskRetryCaching)
      .setDistributedTracingMode(config.enableDistributedTracing ? 
        appInsights.DistributedTracingModes.AI_AND_W3C : 
        appInsights.DistributedTracingModes.AI);

    // Configure sampling
    appInsights.Configuration.setSamplingPercentage(config.samplingPercentage);
    
    if (config.maxSamplesPerSecond > 0) {
      appInsights.Configuration.setMaxSamplesPerSecond(config.maxSamplesPerSecond);
    }

    // Configure disk retry caching
    if (config.enableUseDiskRetryCaching) {
      appInsights.Configuration
        .setResendInterval(config.enableResendInterval)
        .setMaxBytesOnDisk(config.enableMaxBytesOnDisk);
    }

    // Enable live metrics with authentication if configured
    if (config.enableLiveMetrics) {
      if (config.liveMetricsAuthenticationApiKey) {
        appInsights.Configuration.enableLiveMetrics(config.liveMetricsAuthenticationApiKey);
        if (config.enableDebugLogging) {
          console.log('🔧 Live Metrics enabled with authentication');
        }
      } else {
        appInsights.Configuration.enableLiveMetrics();
        if (config.enableDebugLogging) {
          console.log('🔧 Live Metrics enabled without authentication');
        }
      }
    }

    // Configure cloud role and instance for service map
    appInsights.defaultClient.context.tags[appInsights.defaultClient.context.keys.cloudRole] = config.cloudRole;
    appInsights.defaultClient.context.tags[appInsights.defaultClient.context.keys.cloudRoleInstance] = config.cloudRoleInstance;

    // Set application version and deployment information
    appInsights.defaultClient.context.tags[appInsights.defaultClient.context.keys.applicationVersion] = config.version;
    
    // Add custom properties for all telemetry
    appInsights.defaultClient.commonProperties = {
      environment: config.environment,
      version: config.version,
      deploymentId: config.deploymentId,
      cloudRole: config.cloudRole,
      region: config.region
    };

    // Configure request and response header collection
    if (config.enableRequestResponseHeaders) {
      appInsights.Configuration.setRequestResponseHeaders(true);
    }

    // Start Application Insights
    appInsights.start();

    // Log successful initialization
    if (config.enableDebugLogging) {
      console.log('✅ Application Insights initialized successfully');
      console.log(`   Cloud Role: ${config.cloudRole}`);
      console.log(`   Cloud Role Instance: ${config.cloudRoleInstance}`);
      console.log(`   Environment: ${config.environment}`);
      console.log(`   Version: ${config.version}`);
      console.log(`   Sampling: ${config.samplingPercentage}%`);
      console.log(`   Live Metrics: ${config.enableLiveMetrics ? 'Enabled' : 'Disabled'}`);
    } else {
      console.log('✅ Application Insights initialized successfully');
    }
    
    // Set up global error handlers for unhandled exceptions
    setupGlobalErrorHandlers();
    
    // Set up custom telemetry processors
    setupCustomTelemetryProcessors();
    
    return appInsights.defaultClient;
  } catch (error) {
    console.error('❌ Failed to initialize Application Insights:', error.message);
    if (config.enableDebugLogging) {
      console.error('   Error details:', error);
    }
    return null;
  }
}

/**
 * Set up global error handlers for unhandled exceptions
 */
function setupGlobalErrorHandlers() {
  if (!config.enableAutoCollectExceptions) return;

  process.on('uncaughtException', (error) => {
    console.error('🚨 Uncaught Exception:', error);
    
    // Track with enhanced error tracking
    if (telemetry && telemetry.trackUnhandledException) {
      telemetry.trackUnhandledException(error, {
        type: 'uncaughtException',
        processId: process.pid,
        nodeVersion: process.version,
        platform: require('os').platform(),
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage().heapUsed
      });
    } else if (appInsights.defaultClient) {
      appInsights.defaultClient.trackException({
        exception: error,
        properties: {
          type: 'uncaughtException',
          environment: config.environment,
          cloudRole: config.cloudRole
        }
      });
    }
    
    // Flush telemetry before potential exit
    if (appInsights.defaultClient) {
      appInsights.defaultClient.flush();
    }
    
    // Log additional context
    console.error('🚨 Process will exit due to uncaught exception');
    console.error('🚨 Process uptime:', process.uptime(), 'seconds');
    console.error('🚨 Memory usage:', Math.round(process.memoryUsage().heapUsed / 1024 / 1024), 'MB');
    
    // Exit process after a brief delay to allow telemetry to be sent
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 Unhandled Promise Rejection:', reason);
    console.error('🚨 Promise:', promise);
    
    const error = reason instanceof Error ? reason : new Error(String(reason));
    
    // Track with enhanced error tracking
    if (telemetry && telemetry.trackUnhandledException) {
      telemetry.trackUnhandledException(error, {
        type: 'unhandledRejection',
        processId: process.pid,
        nodeVersion: process.version,
        platform: require('os').platform(),
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage().heapUsed,
        promise: String(promise)
      });
    } else if (appInsights.defaultClient) {
      appInsights.defaultClient.trackException({
        exception: error,
        properties: {
          type: 'unhandledRejection',
          environment: config.environment,
          cloudRole: config.cloudRole,
          promise: String(promise)
        }
      });
    }
    
    // Flush telemetry
    if (appInsights.defaultClient) {
      appInsights.defaultClient.flush();
    }
    
    // Log additional context
    console.error('🚨 Unhandled promise rejection detected');
    console.error('🚨 This may indicate a programming error or missing error handling');
  });

  // Add warning handler for deprecations and other warnings
  process.on('warning', (warning) => {
    console.warn('⚠️  Process Warning:', warning.name, warning.message);
    
    if (telemetry && telemetry.trackEvent) {
      telemetry.trackEvent('ProcessWarning', {
        warningName: warning.name,
        warningMessage: warning.message,
        warningStack: warning.stack || 'No stack trace',
        environment: config.environment,
        cloudRole: config.cloudRole,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Add memory warning handler
  if (config.enableResourceMonitoring) {
    const checkMemoryUsage = () => {
      const memUsage = process.memoryUsage();
      const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
      
      if (heapUsagePercent > 90) {
        console.warn('⚠️  High memory usage detected:', Math.round(heapUsagePercent), '%');
        
        if (telemetry && telemetry.trackEvent) {
          telemetry.trackEvent('HighMemoryUsage', {
            heapUsagePercent: heapUsagePercent.toString(),
            heapUsed: memUsage.heapUsed.toString(),
            heapTotal: memUsage.heapTotal.toString(),
            severity: 'warning',
            environment: config.environment,
            timestamp: new Date().toISOString()
          }, {
            heapUsagePercent: heapUsagePercent,
            heapUsed: memUsage.heapUsed,
            heapTotal: memUsage.heapTotal
          });
        }
      }
    };

    // Check memory usage every 30 seconds
    setInterval(checkMemoryUsage, 30000);
  }
}

/**
 * Set up custom telemetry processors
 */
function setupCustomTelemetryProcessors() {
  if (!appInsights.defaultClient) return;

  // Add telemetry processor to enrich all telemetry with custom data
  appInsights.defaultClient.addTelemetryProcessor((envelope) => {
    // Add custom properties to all telemetry
    if (!envelope.data.baseData.properties) {
      envelope.data.baseData.properties = {};
    }
    
    // Add system information
    envelope.data.baseData.properties.nodeVersion = process.version;
    envelope.data.baseData.properties.platform = os.platform();
    envelope.data.baseData.properties.arch = os.arch();
    envelope.data.baseData.properties.hostname = os.hostname();
    
    // Add deployment information
    envelope.data.baseData.properties.deploymentId = config.deploymentId;
    envelope.data.baseData.properties.region = config.region;
    
    // Filter sensitive information
    if (envelope.data.baseData.properties.headers) {
      // Remove authorization headers and other sensitive data
      delete envelope.data.baseData.properties.headers.authorization;
      delete envelope.data.baseData.properties.headers.cookie;
      delete envelope.data.baseData.properties.headers['x-api-key'];
    }
    
    return true;
  });

  // Add processor for performance optimization
  appInsights.defaultClient.addTelemetryProcessor((envelope) => {
    // Skip certain noisy telemetry in development
    if (config.environment === 'development') {
      const baseType = envelope.data.baseType;
      const name = envelope.data.baseData.name;
      
      // Skip health check requests
      if (baseType === 'RequestData' && (name?.includes('/health') || name?.includes('/ping'))) {
        return false;
      }
      
      // Skip static file requests
      if (baseType === 'RequestData' && name?.match(/\.(js|css|png|jpg|ico|svg)$/)) {
        return false;
      }
    }
    
    return true;
  });
}

/**
 * Get Application Insights client
 */
function getClient() {
  return appInsights.defaultClient;
}

/**
 * Custom telemetry tracking functions for TaktMate
 */
const telemetry = {
  /**
   * Track authentication events with comprehensive details
   */
  trackAuthentication: (userId, email, provider, success, duration = null, additionalProps = {}) => {
    const client = getClient();
    if (!client || !config.enableUserTracking) return;

    const properties = {
      userId: userId,
      email: email,
      provider: provider || 'azure-ad-b2c',
      success: success.toString(),
      environment: config.environment,
      cloudRole: config.cloudRole,
      timestamp: new Date().toISOString(),
      ...additionalProps
    };

    // Track authentication event
    client.trackEvent({
      name: 'UserAuthentication',
      properties: properties,
      measurements: duration ? { authenticationDuration: duration } : undefined
    });

    // Track success/failure metrics
    if (success) {
      client.trackMetric({
        name: 'AuthenticationSuccess',
        value: 1,
        properties: { 
          provider: provider || 'azure-ad-b2c',
          environment: config.environment
        }
      });
    } else {
      client.trackMetric({
        name: 'AuthenticationFailure',
        value: 1,
        properties: { 
          provider: provider || 'azure-ad-b2c',
          environment: config.environment,
          reason: additionalProps.failureReason || 'unknown'
        }
      });
    }

    // Track authentication duration if provided
    if (duration) {
      client.trackMetric({
        name: 'AuthenticationDuration',
        value: duration,
        properties: {
          provider: provider || 'azure-ad-b2c',
          success: success.toString()
        }
      });
    }
  },

  /**
   * Track CSV file uploads with comprehensive metrics
   */
  trackFileUpload: (userId, filename, fileSize, rowCount, processingTime, success, additionalProps = {}) => {
    const client = getClient();
    if (!client || !config.enableCustomTelemetry) return;

    // Calculate derived metrics
    const processingRate = rowCount > 0 && processingTime > 0 ? Math.round((rowCount / processingTime) * 1000) : 0; // rows per second
    const bytesPerRow = rowCount > 0 ? Math.round(fileSize / rowCount) : 0;
    const fileExtension = filename ? filename.split('.').pop()?.toLowerCase() || 'unknown' : 'unknown';
    
    // Determine file size category
    let sizeCategory = 'small';
    if (fileSize > 5 * 1024 * 1024) sizeCategory = 'xlarge';      // > 5MB
    else if (fileSize > 1024 * 1024) sizeCategory = 'large';      // > 1MB
    else if (fileSize > 100 * 1024) sizeCategory = 'medium';      // > 100KB
    
    // Determine row count category
    let rowCategory = 'small';
    if (rowCount > 100000) rowCategory = 'xlarge';        // > 100k rows
    else if (rowCount > 10000) rowCategory = 'large';     // > 10k rows
    else if (rowCount > 1000) rowCategory = 'medium';     // > 1k rows
    
    // Determine performance category
    let performanceCategory = 'slow';
    if (processingRate > 10000) performanceCategory = 'fast';     // > 10k rows/sec
    else if (processingRate > 1000) performanceCategory = 'medium'; // > 1k rows/sec

    const properties = {
      userId: userId,
      filename: filename || 'unknown',
      fileExtension: fileExtension,
      success: success.toString(),
      sizeCategory: sizeCategory,
      rowCategory: rowCategory,
      performanceCategory: performanceCategory,
      hasHeaders: rowCount > 0 ? 'true' : 'false',
      environment: config.environment,
      cloudRole: config.cloudRole,
      timestamp: new Date().toISOString(),
      ...additionalProps
    };

    const measurements = {
      fileSize: fileSize,
      rowCount: rowCount,
      processingTime: processingTime,
      processingRate: processingRate,
      bytesPerRow: bytesPerRow,
      compressionEfficiency: additionalProps.originalSize ? (additionalProps.originalSize - fileSize) / additionalProps.originalSize : 0
    };

    // Main file upload event
    client.trackEvent({
      name: 'CSVFileUpload',
      properties: properties,
      measurements: measurements
    });

    // Track specific metrics for dashboards
    client.trackMetric({
      name: 'CSV_FileSize',
      value: fileSize,
      properties: { 
        success: success.toString(),
        sizeCategory: sizeCategory,
        userId: userId
      }
    });

    client.trackMetric({
      name: 'CSV_RowCount',
      value: rowCount,
      properties: { 
        success: success.toString(),
        rowCategory: rowCategory,
        userId: userId
      }
    });

    client.trackMetric({
      name: 'CSV_ProcessingTime',
      value: processingTime,
      properties: { 
        success: success.toString(),
        performanceCategory: performanceCategory,
        userId: userId
      }
    });

    client.trackMetric({
      name: 'CSV_ProcessingRate',
      value: processingRate,
      properties: { 
        success: success.toString(),
        performanceCategory: performanceCategory,
        userId: userId
      }
    });

    // Track file upload by size category for analysis
    client.trackEvent({
      name: 'CSV_UploadBySize',
      properties: {
        userId: userId,
        sizeCategory: sizeCategory,
        success: success.toString(),
        environment: config.environment
      },
      measurements: {
        fileSize: fileSize,
        processingTime: processingTime
      }
    });

    // Track file upload by row count category
    client.trackEvent({
      name: 'CSV_UploadByRowCount',
      properties: {
        userId: userId,
        rowCategory: rowCategory,
        success: success.toString(),
        environment: config.environment
      },
      measurements: {
        rowCount: rowCount,
        processingTime: processingTime
      }
    });

    // Track performance characteristics
    client.trackEvent({
      name: 'CSV_ProcessingPerformance',
      properties: {
        userId: userId,
        performanceCategory: performanceCategory,
        sizeCategory: sizeCategory,
        rowCategory: rowCategory,
        success: success.toString(),
        environment: config.environment
      },
      measurements: {
        processingRate: processingRate,
        processingTime: processingTime,
        bytesPerRow: bytesPerRow
      }
    });
  },

  /**
   * Track CSV chat interactions with comprehensive metrics
   */
  trackChatInteraction: (userId, fileId, filename, messageLength, responseTime, success, additionalProps = {}) => {
    const client = getClient();
    if (!client || !config.enableCustomTelemetry) return;

    // Calculate derived metrics
    const wordsPerSecond = messageLength > 0 && responseTime > 0 ? Math.round((messageLength / responseTime) * 1000) : 0;
    const responseEfficiency = responseTime > 0 ? Math.round(1000 / responseTime) : 0; // responses per second capability
    
    // Determine message complexity
    let complexityCategory = 'simple';
    if (messageLength > 500) complexityCategory = 'complex';
    else if (messageLength > 100) complexityCategory = 'medium';
    
    // Determine response speed category
    let speedCategory = 'slow';
    if (responseTime < 1000) speedCategory = 'fast';      // < 1s
    else if (responseTime < 5000) speedCategory = 'medium'; // < 5s
    
    const properties = {
      userId: userId,
      fileId: fileId || 'unknown',
      filename: filename || 'unknown',
      success: success.toString(),
      complexityCategory: complexityCategory,
      speedCategory: speedCategory,
      hasFileContext: fileId ? 'true' : 'false',
      environment: config.environment,
      cloudRole: config.cloudRole,
      timestamp: new Date().toISOString(),
      ...additionalProps
    };

    const measurements = {
      messageLength: messageLength,
      responseTime: responseTime,
      wordsPerSecond: wordsPerSecond,
      responseEfficiency: responseEfficiency,
      tokenUsage: additionalProps.tokenUsage || 0,
      promptTokens: additionalProps.promptTokens || 0,
      completionTokens: additionalProps.completionTokens || 0,
      fileSize: additionalProps.fileSize || 0,
      fileRowCount: additionalProps.fileRowCount || 0
    };

    // Main chat interaction event
    client.trackEvent({
      name: 'CSVChatInteraction',
      properties: properties,
      measurements: measurements
    });

    // Track chat response time metrics
    client.trackMetric({
      name: 'CSV_ChatResponseTime',
      value: responseTime,
      properties: { 
        success: success.toString(),
        speedCategory: speedCategory,
        complexityCategory: complexityCategory,
        userId: userId
      }
    });

    // Track message complexity metrics
    client.trackMetric({
      name: 'CSV_MessageLength',
      value: messageLength,
      properties: { 
        success: success.toString(),
        complexityCategory: complexityCategory,
        userId: userId
      }
    });

    // Track OpenAI token usage if available
    if (additionalProps.tokenUsage) {
      client.trackMetric({
        name: 'CSV_OpenAITokenUsage',
        value: additionalProps.tokenUsage,
        properties: {
          success: success.toString(),
          complexityCategory: complexityCategory,
          userId: userId
        }
      });
    }

    // Track chat by complexity category
    client.trackEvent({
      name: 'CSV_ChatByComplexity',
      properties: {
        userId: userId,
        complexityCategory: complexityCategory,
        success: success.toString(),
        environment: config.environment
      },
      measurements: {
        messageLength: messageLength,
        responseTime: responseTime
      }
    });

    // Track chat by response speed
    client.trackEvent({
      name: 'CSV_ChatBySpeed',
      properties: {
        userId: userId,
        speedCategory: speedCategory,
        success: success.toString(),
        environment: config.environment
      },
      measurements: {
        responseTime: responseTime,
        wordsPerSecond: wordsPerSecond
      }
    });

    // Track file-specific chat metrics if file context is available
    if (fileId && additionalProps.fileSize && additionalProps.fileRowCount) {
      client.trackEvent({
        name: 'CSV_FileContextChat',
        properties: {
          userId: userId,
          fileId: fileId,
          filename: filename || 'unknown',
          success: success.toString(),
          environment: config.environment
        },
        measurements: {
          responseTime: responseTime,
          fileSize: additionalProps.fileSize,
          fileRowCount: additionalProps.fileRowCount,
          messageLength: messageLength
        }
      });
    }
  },

  /**
   * Enhanced error tracking with comprehensive analytics
   */
  trackError: (error, userId = null, context = {}) => {
    const client = getClient();
    if (!client || !config.enableCustomTelemetry) return;

    // Extract error information
    const errorType = error.name || 'UnknownError';
    const errorMessage = error.message || 'Unknown error occurred';
    const errorStack = error.stack || 'No stack trace available';
    
    // Determine error severity
    let severity = 'error';
    if (error.status >= 500 || error.statusCode >= 500) severity = 'critical';
    else if (error.status >= 400 || error.statusCode >= 400) severity = 'warning';
    else if (errorType.includes('Validation')) severity = 'warning';
    else if (errorType.includes('Authentication') || errorType.includes('Authorization')) severity = 'warning';
    
    // Determine error category
    let category = 'application';
    if (errorType.includes('Network') || errorType.includes('Timeout')) category = 'network';
    else if (errorType.includes('Database') || errorType.includes('SQL')) category = 'database';
    else if (errorType.includes('Authentication') || errorType.includes('JWT')) category = 'authentication';
    else if (errorType.includes('Validation') || errorType.includes('Parse')) category = 'validation';
    else if (errorType.includes('Permission') || errorType.includes('Access')) category = 'authorization';
    else if (errorType.includes('OpenAI') || errorType.includes('API')) category = 'external_service';

    const properties = {
      userId: userId || 'anonymous',
      errorType: errorType,
      errorMessage: errorMessage,
      severity: severity,
      category: category,
      environment: config.environment,
      cloudRole: config.cloudRole,
      timestamp: new Date().toISOString(),
      // Request context
      userAgent: context.userAgent || 'unknown',
      ip: context.ip || 'unknown',
      endpoint: context.endpoint || 'unknown',
      method: context.method || 'unknown',
      // Error context
      component: context.component || 'unknown',
      operation: context.operation || 'unknown',
      correlationId: context.correlationId || 'unknown',
      sessionId: context.sessionId || 'unknown',
      // Additional context
      ...context
    };

    const measurements = {
      errorCount: 1,
      duration: context.duration || 0,
      statusCode: error.status || error.statusCode || 500,
      stackDepth: errorStack.split('\\n').length
    };

    // Track comprehensive error event
    client.trackEvent({
      name: 'ErrorOccurred',
      properties: properties,
      measurements: measurements
    });

    // Track exception with enhanced context
    client.trackException({
      exception: error,
      properties: properties,
      measurements: measurements
    });

    // Track error metrics by category
    client.trackMetric('Error_Count', 1, {
      errorType: errorType,
      category: category,
      severity: severity,
      environment: config.environment
    });

    // Track error by component
    if (context.component) {
      client.trackMetric(`Error_${context.component}_Count`, 1, {
        errorType: errorType,
        severity: severity,
        environment: config.environment
      });
    }

    // Track error by operation
    if (context.operation) {
      client.trackMetric(`Error_${context.operation}_Count`, 1, {
        errorType: errorType,
        severity: severity,
        environment: config.environment
      });
    }
  },

  /**
   * Track unhandled exceptions and promise rejections
   */
  trackUnhandledException: (error, context = {}) => {
    const client = getClient();
    if (!client || !config.enableCustomTelemetry) return;

    const properties = {
      errorType: error.name || 'UnhandledException',
      errorMessage: error.message || 'Unhandled exception occurred',
      severity: 'critical',
      category: 'unhandled',
      environment: config.environment,
      cloudRole: config.cloudRole,
      timestamp: new Date().toISOString(),
      processId: process.pid,
      nodeVersion: process.version,
      platform: require('os').platform(),
      ...context
    };

    const measurements = {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage().heapUsed,
      stackDepth: error.stack ? error.stack.split('\\n').length : 0
    };

    // Track critical unhandled exception
    client.trackEvent({
      name: 'UnhandledException',
      properties: properties,
      measurements: measurements
    });

    client.trackException({
      exception: error,
      properties: properties,
      measurements: measurements
    });

    // Track critical error metric
    client.trackMetric('Critical_Error_Count', 1, {
      errorType: 'UnhandledException',
      environment: config.environment
    });
  },

  /**
   * Track HTTP errors with request context
   */
  trackHTTPError: (error, req, res, context = {}) => {
    const client = getClient();
    if (!client || !config.enableCustomTelemetry) return;

    const statusCode = error.status || error.statusCode || res?.statusCode || 500;
    const method = req?.method || 'unknown';
    const url = req?.originalUrl || req?.url || 'unknown';
    
    // Determine error classification
    let errorClass = 'server_error';
    if (statusCode >= 400 && statusCode < 500) errorClass = 'client_error';
    else if (statusCode >= 500) errorClass = 'server_error';
    
    let severity = 'error';
    if (statusCode >= 500) severity = 'critical';
    else if (statusCode >= 400) severity = 'warning';

    const properties = {
      errorType: error.name || 'HTTPError',
      errorMessage: error.message || `HTTP ${statusCode} error`,
      statusCode: statusCode.toString(),
      method: method,
      url: url,
      errorClass: errorClass,
      severity: severity,
      category: 'http',
      environment: config.environment,
      cloudRole: config.cloudRole,
      timestamp: new Date().toISOString(),
      // Request context
      userAgent: req?.headers['user-agent'] || 'unknown',
      ip: req?.ip || req?.connection?.remoteAddress || 'unknown',
      correlationId: req?.headers['x-correlation-id'] || 'unknown',
      sessionId: req?.sessionID || 'unknown',
      userId: req?.user?.id || 'anonymous',
      userEmail: req?.user?.email || 'unknown',
      ...context
    };

    const measurements = {
      statusCode: statusCode,
      duration: context.duration || 0,
      requestSize: req?.headers['content-length'] ? parseInt(req.headers['content-length']) : 0,
      responseSize: res?.get ? (res.get('content-length') ? parseInt(res.get('content-length')) : 0) : 0
    };

    // Track HTTP error event
    client.trackEvent({
      name: 'HTTPError',
      properties: properties,
      measurements: measurements
    });

    client.trackException({
      exception: error,
      properties: properties,
      measurements: measurements
    });

    // Track HTTP error metrics
    client.trackMetric('HTTP_Error_Count', 1, {
      statusCode: statusCode.toString(),
      method: method,
      errorClass: errorClass,
      severity: severity,
      environment: config.environment
    });

    // Track endpoint-specific error rates
    if (url !== 'unknown') {
      client.trackMetric('Endpoint_Error_Count', 1, {
        endpoint: url,
        statusCode: statusCode.toString(),
        method: method,
        environment: config.environment
      });
    }
  },

  /**
   * Track validation errors
   */
  trackValidationError: (error, data, context = {}) => {
    const client = getClient();
    if (!client || !config.enableCustomTelemetry) return;

    const properties = {
      errorType: error.name || 'ValidationError',
      errorMessage: error.message || 'Validation failed',
      severity: 'warning',
      category: 'validation',
      environment: config.environment,
      cloudRole: config.cloudRole,
      timestamp: new Date().toISOString(),
      // Validation context
      validationType: context.validationType || 'unknown',
      fieldName: context.fieldName || 'unknown',
      expectedType: context.expectedType || 'unknown',
      actualValue: context.actualValue || 'unknown',
      ...context
    };

    const measurements = {
      dataSize: JSON.stringify(data || {}).length,
      fieldCount: Object.keys(data || {}).length,
      errorCount: 1
    };

    // Track validation error event
    client.trackEvent({
      name: 'ValidationError',
      properties: properties,
      measurements: measurements
    });

    client.trackException({
      exception: error,
      properties: properties,
      measurements: measurements
    });

    // Track validation error metrics
    client.trackMetric('Validation_Error_Count', 1, {
      validationType: context.validationType || 'unknown',
      fieldName: context.fieldName || 'unknown',
      environment: config.environment
    });
  },

  /**
   * Track authentication and authorization errors
   */
  trackAuthError: (error, context = {}) => {
    const client = getClient();
    if (!client || !config.enableCustomTelemetry) return;

    const errorType = error.name || 'AuthError';
    let category = 'authentication';
    if (errorType.includes('Authorization') || errorType.includes('Permission') || errorType.includes('Access')) {
      category = 'authorization';
    }

    const properties = {
      errorType: errorType,
      errorMessage: error.message || 'Authentication/Authorization failed',
      severity: 'warning',
      category: category,
      environment: config.environment,
      cloudRole: config.cloudRole,
      timestamp: new Date().toISOString(),
      // Auth context
      authProvider: context.authProvider || 'azure-ad-b2c',
      authMethod: context.authMethod || 'jwt',
      tokenExpired: context.tokenExpired ? 'true' : 'false',
      tokenInvalid: context.tokenInvalid ? 'true' : 'false',
      userId: context.userId || 'unknown',
      userEmail: context.userEmail || 'unknown',
      ...context
    };

    const measurements = {
      errorCount: 1,
      tokenAge: context.tokenAge || 0,
      attemptCount: context.attemptCount || 1
    };

    // Track authentication error event
    client.trackEvent({
      name: 'AuthenticationError',
      properties: properties,
      measurements: measurements
    });

    client.trackException({
      exception: error,
      properties: properties,
      measurements: measurements
    });

    // Track auth error metrics
    client.trackMetric('Auth_Error_Count', 1, {
      errorType: errorType,
      category: category,
      authProvider: context.authProvider || 'azure-ad-b2c',
      environment: config.environment
    });

    // Track security metrics
    client.trackMetric('Security_Incident_Count', 1, {
      incidentType: category,
      severity: 'warning',
      environment: config.environment
    });
  },

  /**
   * Track external service errors
   */
  trackExternalServiceError: (error, serviceName, operation, context = {}) => {
    const client = getClient();
    if (!client || !config.enableCustomTelemetry) return;

    const statusCode = error.status || error.statusCode || context.statusCode || 500;
    let severity = 'error';
    if (statusCode >= 500) severity = 'critical';
    else if (statusCode >= 400) severity = 'warning';

    const properties = {
      errorType: error.name || 'ExternalServiceError',
      errorMessage: error.message || 'External service error',
      serviceName: serviceName || 'unknown',
      operation: operation || 'unknown',
      severity: severity,
      category: 'external_service',
      environment: config.environment,
      cloudRole: config.cloudRole,
      timestamp: new Date().toISOString(),
      // Service context
      statusCode: statusCode.toString(),
      endpoint: context.endpoint || 'unknown',
      timeout: context.timeout ? 'true' : 'false',
      retryCount: context.retryCount || 0,
      ...context
    };

    const measurements = {
      statusCode: statusCode,
      duration: context.duration || 0,
      retryCount: context.retryCount || 0,
      errorCount: 1
    };

    // Track external service error event
    client.trackEvent({
      name: 'ExternalServiceError',
      properties: properties,
      measurements: measurements
    });

    client.trackException({
      exception: error,
      properties: properties,
      measurements: measurements
    });

    // Track service-specific error metrics
    client.trackMetric('External_Service_Error_Count', 1, {
      serviceName: serviceName || 'unknown',
      operation: operation || 'unknown',
      statusCode: statusCode.toString(),
      severity: severity,
      environment: config.environment
    });

    // Track service availability impact
    client.trackMetric('Service_Availability_Impact', 1, {
      serviceName: serviceName || 'unknown',
      severity: severity,
      environment: config.environment
    });
  },

  /**
   * Track custom metrics
   */
  trackMetric: (name, value, properties = {}) => {
    const client = getClient();
    if (!client) return;

    client.trackMetric({
      name: name,
      value: value,
      properties: {
        environment: process.env.NODE_ENV || 'development',
        ...properties
      }
    });
  },

  /**
   * Track custom events
   */
  trackEvent: (name, properties = {}, measurements = {}) => {
    const client = getClient();
    if (!client) return;

    client.trackEvent({
      name: name,
      properties: {
        environment: process.env.NODE_ENV || 'development',
        ...properties
      },
      measurements: measurements
    });
  },

  /**
   * Track CSV parsing operations
   */
  trackCSVParsing: (userId, filename, fileSize, rowCount, columnCount, parseTime, success, additionalProps = {}) => {
    const client = getClient();
    if (!client || !config.enableCustomTelemetry) return;

    // Calculate derived metrics
    const parseRate = rowCount > 0 && parseTime > 0 ? Math.round((rowCount / parseTime) * 1000) : 0; // rows per second
    const bytesPerSecond = fileSize > 0 && parseTime > 0 ? Math.round((fileSize / parseTime) * 1000) : 0;
    const avgBytesPerRow = rowCount > 0 ? Math.round(fileSize / rowCount) : 0;
    const avgBytesPerColumn = columnCount > 0 ? Math.round(fileSize / (rowCount * columnCount)) : 0;

    // Determine data structure complexity
    let structureComplexity = 'simple';
    if (columnCount > 50) structureComplexity = 'complex';
    else if (columnCount > 20) structureComplexity = 'medium';

    const properties = {
      userId: userId,
      filename: filename || 'unknown',
      success: success.toString(),
      structureComplexity: structureComplexity,
      hasEmptyRows: additionalProps.hasEmptyRows ? 'true' : 'false',
      hasSpecialCharacters: additionalProps.hasSpecialCharacters ? 'true' : 'false',
      encoding: additionalProps.encoding || 'unknown',
      delimiter: additionalProps.delimiter || 'comma',
      environment: config.environment,
      timestamp: new Date().toISOString()
    };

    const measurements = {
      fileSize: fileSize,
      rowCount: rowCount,
      columnCount: columnCount,
      parseTime: parseTime,
      parseRate: parseRate,
      bytesPerSecond: bytesPerSecond,
      avgBytesPerRow: avgBytesPerRow,
      avgBytesPerColumn: avgBytesPerColumn,
      memoryUsage: additionalProps.memoryUsage || 0
    };

    // Main CSV parsing event
    client.trackEvent({
      name: 'CSV_ParsingOperation',
      properties: properties,
      measurements: measurements
    });

    // Track parsing performance metrics
    client.trackMetric({
      name: 'CSV_ParseTime',
      value: parseTime,
      properties: { 
        success: success.toString(),
        structureComplexity: structureComplexity,
        userId: userId
      }
    });

    client.trackMetric({
      name: 'CSV_ParseRate',
      value: parseRate,
      properties: { 
        success: success.toString(),
        structureComplexity: structureComplexity,
        userId: userId
      }
    });
  },

  /**
   * Track CSV data analysis operations
   */
  trackCSVAnalysis: (userId, fileId, filename, analysisType, analysisTime, success, additionalProps = {}) => {
    const client = getClient();
    if (!client || !config.enableCustomTelemetry) return;

    // Determine analysis complexity
    let analysisComplexity = 'simple';
    if (analysisTime > 5000) analysisComplexity = 'complex';    // > 5s
    else if (analysisTime > 1000) analysisComplexity = 'medium'; // > 1s

    const properties = {
      userId: userId,
      fileId: fileId || 'unknown',
      filename: filename || 'unknown',
      analysisType: analysisType || 'unknown',
      success: success.toString(),
      analysisComplexity: analysisComplexity,
      environment: config.environment,
      timestamp: new Date().toISOString(),
      ...additionalProps
    };

    const measurements = {
      analysisTime: analysisTime,
      dataPoints: additionalProps.dataPoints || 0,
      columnsAnalyzed: additionalProps.columnsAnalyzed || 0,
      rowsAnalyzed: additionalProps.rowsAnalyzed || 0,
      memoryUsage: additionalProps.memoryUsage || 0
    };

    // Main CSV analysis event
    client.trackEvent({
      name: 'CSV_DataAnalysis',
      properties: properties,
      measurements: measurements
    });

    // Track analysis performance
    client.trackMetric({
      name: 'CSV_AnalysisTime',
      value: analysisTime,
      properties: { 
        analysisType: analysisType || 'unknown',
        analysisComplexity: analysisComplexity,
        success: success.toString(),
        userId: userId
      }
    });
  },

  /**
   * Track CSV file operations (view, download, delete)
   */
  trackCSVFileOperation: (userId, fileId, filename, operation, operationTime, success, additionalProps = {}) => {
    const client = getClient();
    if (!client || !config.enableCustomTelemetry) return;

    const properties = {
      userId: userId,
      fileId: fileId || 'unknown',
      filename: filename || 'unknown',
      operation: operation || 'unknown',
      success: success.toString(),
      environment: config.environment,
      timestamp: new Date().toISOString(),
      ...additionalProps
    };

    const measurements = {
      operationTime: operationTime,
      fileSize: additionalProps.fileSize || 0,
      rowCount: additionalProps.rowCount || 0
    };

    // Main file operation event
    client.trackEvent({
      name: 'CSV_FileOperation',
      properties: properties,
      measurements: measurements
    });

    // Track operation-specific metrics
    client.trackMetric({
      name: `CSV_${operation}Time`,
      value: operationTime,
      properties: { 
        success: success.toString(),
        userId: userId
      }
    });
  },

  /**
   * Track CSV processing errors with detailed context
   */
  trackCSVError: (error, userId, fileId, filename, operation, additionalContext = {}) => {
    const client = getClient();
    if (!client || !config.enableCustomTelemetry) return;

    const errorType = error.name || 'Unknown';
    const errorMessage = error.message || 'Unknown error';
    
    const properties = {
      userId: userId || 'unknown',
      fileId: fileId || 'unknown',
      filename: filename || 'unknown',
      operation: operation || 'unknown',
      errorType: errorType,
      errorMessage: errorMessage,
      environment: config.environment,
      timestamp: new Date().toISOString(),
      ...additionalContext
    };

    // Track CSV-specific error
    client.trackEvent({
      name: 'CSV_ProcessingError',
      properties: properties
    });

    // Track the exception
    client.trackException({
      exception: error,
      properties: properties
    });

    // Track error metrics
    client.trackMetric({
      name: 'CSV_ErrorCount',
      value: 1,
      properties: { 
        errorType: errorType,
        operation: operation || 'unknown',
        userId: userId || 'unknown'
      }
    });
  },

  /**
   * Track CSV business metrics and KPIs
   */
  trackCSVBusinessMetrics: (userId, fileId, filename, metrics, additionalProps = {}) => {
    const client = getClient();
    if (!client || !config.enableBusinessMetrics) return;

    const properties = {
      userId: userId,
      fileId: fileId || 'unknown',
      filename: filename || 'unknown',
      environment: config.environment,
      timestamp: new Date().toISOString(),
      ...additionalProps
    };

    // Track business metrics
    client.trackEvent({
      name: 'CSV_BusinessMetrics',
      properties: properties,
      measurements: metrics
    });

    // Track individual KPIs
    Object.entries(metrics).forEach(([metricName, metricValue]) => {
      if (typeof metricValue === 'number') {
        client.trackMetric({
          name: `CSV_KPI_${metricName}`,
          value: metricValue,
          properties: {
            userId: userId,
            fileId: fileId || 'unknown'
          }
        });
      }
    });
  },

  /**
   * Track dependencies (external API calls) with enhanced monitoring
   */
  trackDependency: (name, command, duration, success, dependencyType = 'HTTP', additionalProps = {}) => {
    const client = getClient();
    if (!client || !config.enableCustomTelemetry) return;

    // Calculate performance metrics
    const performanceCategory = duration < 1000 ? 'fast' : duration < 5000 ? 'medium' : 'slow';
    const resultCode = additionalProps.resultCode || (success ? 200 : 500);
    
    client.trackDependency({
      target: name,
      name: command,
      data: command,
      duration: duration,
      resultCode: resultCode,
      success: success,
      dependencyTypeName: dependencyType,
      properties: {
        environment: config.environment,
        performanceCategory: performanceCategory,
        cloudRole: config.cloudRole,
        timestamp: new Date().toISOString(),
        ...additionalProps
      }
    });

    // Track dependency performance metrics
    client.trackMetric({
      name: `Dependency_${dependencyType}_Duration`,
      value: duration,
      properties: {
        target: name,
        success: success.toString(),
        performanceCategory: performanceCategory,
        environment: config.environment
      }
    });

    // Track dependency availability
    client.trackMetric({
      name: `Dependency_${dependencyType}_Availability`,
      value: success ? 1 : 0,
      properties: {
        target: name,
        environment: config.environment
      }
    });
  },

  /**
   * Track system performance metrics
   */
  trackSystemPerformance: (metrics = {}) => {
    const client = getClient();
    if (!client || !config.enableCustomTelemetry) return;

    // Get system metrics
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    const systemMetrics = {
      // Memory metrics
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      
      // CPU metrics (in microseconds)
      cpuUser: cpuUsage.user,
      cpuSystem: cpuUsage.system,
      
      // Process metrics
      uptime: process.uptime(),
      pid: process.pid,
      
      // Custom metrics
      ...metrics
    };

    // Track system performance event
    client.trackEvent({
      name: 'SystemPerformance',
      properties: {
        environment: config.environment,
        cloudRole: config.cloudRole,
        nodeVersion: process.version,
        platform: require('os').platform(),
        timestamp: new Date().toISOString()
      },
      measurements: systemMetrics
    });

    // Track individual performance metrics
    Object.entries(systemMetrics).forEach(([metricName, metricValue]) => {
      if (typeof metricValue === 'number') {
        client.trackMetric({
          name: `System_${metricName}`,
          value: metricValue,
          properties: {
            environment: config.environment,
            cloudRole: config.cloudRole
          }
        });
      }
    });

    // Calculate and track derived metrics
    const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    const memoryPressure = heapUsagePercent > 80 ? 'high' : heapUsagePercent > 60 ? 'medium' : 'low';

    client.trackMetric({
      name: 'System_HeapUsagePercent',
      value: heapUsagePercent,
      properties: {
        memoryPressure: memoryPressure,
        environment: config.environment
      }
    });
  },

  /**
   * Track HTTP request performance
   */
  trackRequestPerformance: (req, res, duration, additionalProps = {}) => {
    const client = getClient();
    if (!client || !config.enableCustomTelemetry) return;

    const method = req.method;
    const url = req.originalUrl || req.url;
    const statusCode = res.statusCode;
    const success = statusCode < 400;
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    // Determine performance category
    const performanceCategory = duration < 100 ? 'fast' : duration < 1000 ? 'medium' : 'slow';
    
    // Determine request category
    let requestCategory = 'other';
    if (url.startsWith('/api/')) requestCategory = 'api';
    else if (url.startsWith('/auth/')) requestCategory = 'auth';
    else if (url === '/health') requestCategory = 'health';
    
    const properties = {
      method: method,
      url: url,
      statusCode: statusCode.toString(),
      success: success.toString(),
      performanceCategory: performanceCategory,
      requestCategory: requestCategory,
      userAgent: userAgent.substring(0, 100), // Truncate long user agents
      environment: config.environment,
      cloudRole: config.cloudRole,
      timestamp: new Date().toISOString(),
      ...additionalProps
    };

    const measurements = {
      duration: duration,
      responseSize: res.get('content-length') ? parseInt(res.get('content-length')) : 0,
      requestSize: req.get('content-length') ? parseInt(req.get('content-length')) : 0
    };

    // Track request performance event
    client.trackEvent({
      name: 'RequestPerformance',
      properties: properties,
      measurements: measurements
    });

    // Track request duration metric
    client.trackMetric({
      name: 'Request_Duration',
      value: duration,
      properties: {
        method: method,
        requestCategory: requestCategory,
        performanceCategory: performanceCategory,
        success: success.toString(),
        environment: config.environment
      }
    });

    // Track request throughput
    client.trackMetric({
      name: 'Request_Throughput',
      value: 1,
      properties: {
        method: method,
        requestCategory: requestCategory,
        statusCode: statusCode.toString(),
        environment: config.environment
      }
    });
  },

  /**
   * Track database operations (for future database integration)
   */
  trackDatabaseOperation: (operation, table, duration, success, additionalProps = {}) => {
    const client = getClient();
    if (!client || !config.enableCustomTelemetry) return;

    const performanceCategory = duration < 50 ? 'fast' : duration < 200 ? 'medium' : 'slow';
    
    client.trackDependency({
      target: 'database',
      name: `${operation} ${table}`,
      data: `${operation} ${table}`,
      duration: duration,
      resultCode: success ? 200 : 500,
      success: success,
      dependencyTypeName: 'SQL',
      properties: {
        operation: operation,
        table: table,
        performanceCategory: performanceCategory,
        environment: config.environment,
        ...additionalProps
      }
    });

    // Track database performance metrics
    client.trackMetric({
      name: 'Database_OperationDuration',
      value: duration,
      properties: {
        operation: operation,
        table: table,
        success: success.toString(),
        performanceCategory: performanceCategory,
        environment: config.environment
      }
    });
  },

  /**
   * Track application startup performance
   */
  trackStartupPerformance: (startupMetrics) => {
    const client = getClient();
    if (!client || !config.enableCustomTelemetry) return;

    const properties = {
      nodeVersion: process.version,
      platform: require('os').platform(),
      architecture: require('os').arch(),
      environment: config.environment,
      cloudRole: config.cloudRole,
      timestamp: new Date().toISOString(),
      ...startupMetrics.properties
    };

    const measurements = {
      startupDuration: startupMetrics.startupDuration || 0,
      memoryUsage: process.memoryUsage().heapUsed,
      moduleLoadTime: startupMetrics.moduleLoadTime || 0,
      configurationTime: startupMetrics.configurationTime || 0,
      ...startupMetrics.measurements
    };

    // Track startup performance event
    client.trackEvent({
      name: 'ApplicationStartup',
      properties: properties,
      measurements: measurements
    });

    // Track startup duration metric
    client.trackMetric({
      name: 'Startup_Duration',
      value: measurements.startupDuration,
      properties: {
        environment: config.environment,
        nodeVersion: process.version
      }
    });
  },

  /**
   * Track resource utilization
   */
  trackResourceUtilization: () => {
    const client = getClient();
    if (!client || !config.enableCustomTelemetry) return;

    const os = require('os');
    const memUsage = process.memoryUsage();
    
    // System resources
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsagePercent = (usedMemory / totalMemory) * 100;
    
    const cpus = os.cpus();
    const loadAverage = os.loadavg();

    const resourceMetrics = {
      // Memory metrics
      totalMemory: totalMemory,
      freeMemory: freeMemory,
      usedMemory: usedMemory,
      memoryUsagePercent: memoryUsagePercent,
      
      // Process memory
      processHeapUsed: memUsage.heapUsed,
      processHeapTotal: memUsage.heapTotal,
      processRSS: memUsage.rss,
      processExternal: memUsage.external,
      
      // CPU metrics
      cpuCount: cpus.length,
      loadAverage1m: loadAverage[0],
      loadAverage5m: loadAverage[1],
      loadAverage15m: loadAverage[2],
      
      // Process metrics
      uptime: process.uptime(),
      pid: process.pid
    };

    // Track resource utilization event
    client.trackEvent({
      name: 'ResourceUtilization',
      properties: {
        environment: config.environment,
        cloudRole: config.cloudRole,
        hostname: os.hostname(),
        platform: os.platform(),
        timestamp: new Date().toISOString()
      },
      measurements: resourceMetrics
    });

    // Track individual resource metrics
    Object.entries(resourceMetrics).forEach(([metricName, metricValue]) => {
      if (typeof metricValue === 'number') {
        client.trackMetric({
          name: `Resource_${metricName}`,
          value: metricValue,
          properties: {
            environment: config.environment,
            cloudRole: config.cloudRole
          }
        });
      }
    });

    // Calculate and track resource pressure indicators
    const memoryPressure = memoryUsagePercent > 80 ? 'high' : memoryUsagePercent > 60 ? 'medium' : 'low';
    const cpuPressure = loadAverage[0] > cpus.length * 0.8 ? 'high' : loadAverage[0] > cpus.length * 0.6 ? 'medium' : 'low';

    client.trackMetric({
      name: 'Resource_MemoryPressure',
      value: memoryUsagePercent,
      properties: {
        pressureLevel: memoryPressure,
        environment: config.environment
      }
    });

    client.trackMetric({
      name: 'Resource_CPUPressure',
      value: loadAverage[0],
      properties: {
        pressureLevel: cpuPressure,
        environment: config.environment,
        cpuCount: cpus.length.toString()
      }
    });
  },

  /**
   * Track page views (for frontend integration)
   */
  trackPageView: (name, url, userId = null, duration = null) => {
    const client = getClient();
    if (!client) return;

    client.trackPageView({
      name: name,
      url: url,
      duration: duration,
      properties: {
        userId: userId,
        environment: process.env.NODE_ENV || 'development'
      }
    });
  }
};

/**
 * Express middleware for Application Insights
 */
function createExpressMiddleware() {
  const client = getClient();
  if (!client) {
    // Return no-op middleware if Application Insights is not configured
    return (req, res, next) => next();
  }

  return (req, res, next) => {
    // Track request start time
    const startTime = Date.now();

    // Add telemetry context to request
    req.telemetry = telemetry;

    // Track user information if available
    if (req.user) {
      client.context.tags[client.context.keys.userId] = req.user.id;
      client.context.tags[client.context.keys.userAuthUserId] = req.user.email;
    }

    // Track session information
    if (req.sessionID) {
      client.context.tags[client.context.keys.sessionId] = req.sessionID;
    }

    // Add performance monitoring context to request
    req.startTime = startTime;

    // Override res.end to track response with comprehensive performance monitoring
    const originalEnd = res.end;
    res.end = function(...args) {
      const duration = Date.now() - startTime;
      
      // Track comprehensive request performance
      if (config.enableCustomTelemetry) {
        telemetry.trackRequestPerformance(req, res, duration, {
          userId: req.user?.id,
          userEmail: req.user?.email,
          sessionId: req.sessionID,
          correlationId: req.headers['x-correlation-id']
        });
      }
      
      // Track custom metrics for API endpoints (legacy support)
      if (req.path.startsWith('/api/')) {
        telemetry.trackMetric('APIResponseTime', duration, {
          endpoint: req.path,
          method: req.method,
          statusCode: res.statusCode.toString()
        });
      }

      // Track authentication events
      if (req.path.startsWith('/auth/')) {
        telemetry.trackEvent('AuthEndpointAccess', {
          endpoint: req.path,
          method: req.method,
          statusCode: res.statusCode.toString(),
          userId: req.user ? req.user.id : 'anonymous'
        }, {
          duration: duration
        });
      }

      originalEnd.apply(this, args);
    };

    next();
  };
}

/**
 * Performance monitoring utilities
 */
const performanceMonitoring = {
  /**
   * Start performance monitoring interval
   */
  startMonitoring: (intervalMs = 60000) => {
    if (!config.enableCustomTelemetry) return null;

    const interval = setInterval(() => {
      try {
        // Track system performance
        telemetry.trackSystemPerformance();
        
        // Track resource utilization
        telemetry.trackResourceUtilization();
        
        // Track custom business metrics if available
        if (typeof global.getBusinessMetrics === 'function') {
          const businessMetrics = global.getBusinessMetrics();
          telemetry.trackEvent('PeriodicBusinessMetrics', {
            environment: config.environment,
            timestamp: new Date().toISOString()
          }, businessMetrics);
        }
      } catch (error) {
        console.error('Performance monitoring error:', error);
      }
    }, intervalMs);

    console.log(`📊 Performance monitoring started (interval: ${intervalMs}ms)`);
    return interval;
  },

  /**
   * Stop performance monitoring
   */
  stopMonitoring: (interval) => {
    if (interval) {
      clearInterval(interval);
      console.log('📊 Performance monitoring stopped');
    }
  },

  /**
   * Track operation performance with automatic timing
   */
  trackOperation: async (operationName, operationFunc, additionalProps = {}) => {
    const startTime = Date.now();
    let success = true;
    let error = null;

    try {
      const result = await operationFunc();
      return result;
    } catch (err) {
      success = false;
      error = err;
      throw err;
    } finally {
      const duration = Date.now() - startTime;
      
      // Track operation performance
      telemetry.trackEvent('OperationPerformance', {
        operationName: operationName,
        success: success.toString(),
        environment: config.environment,
        timestamp: new Date().toISOString(),
        ...(error && { errorType: error.name, errorMessage: error.message }),
        ...additionalProps
      }, {
        duration: duration
      });

      // Track operation duration metric
      telemetry.trackMetric(`Operation_${operationName}_Duration`, duration, {
        success: success.toString(),
        environment: config.environment
      });

      if (error) {
        telemetry.trackError(error, null, {
          operation: operationName,
          duration: duration,
          ...additionalProps
        });
      }
    }
  },

  /**
   * Create dependency tracking wrapper
   */
  trackDependencyCall: async (dependencyName, dependencyType, callFunc, additionalProps = {}) => {
    const startTime = Date.now();
    let success = true;
    let resultCode = 200;
    let error = null;

    try {
      const result = await callFunc();
      return result;
    } catch (err) {
      success = false;
      error = err;
      resultCode = err.status || err.statusCode || 500;
      throw err;
    } finally {
      const duration = Date.now() - startTime;
      
      // Track dependency
      telemetry.trackDependency(
        dependencyName,
        additionalProps.command || 'call',
        duration,
        success,
        dependencyType,
        {
          resultCode: resultCode,
          ...(error && { errorType: error.name, errorMessage: error.message }),
          ...additionalProps
        }
      );
    }
  },

  /**
   * Get current performance snapshot
   */
  getPerformanceSnapshot: () => {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const os = require('os');
    
    return {
      timestamp: new Date().toISOString(),
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss,
        heapUsagePercent: (memUsage.heapUsed / memUsage.heapTotal) * 100
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      system: {
        uptime: process.uptime(),
        loadAverage: os.loadavg(),
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        cpuCount: os.cpus().length
      }
    };
  }
};

/**
 * Flush telemetry data (useful for serverless environments)
 */
function flush() {
  const client = getClient();
  if (client) {
    client.flush();
  }
}

/**
 * Get Application Insights configuration status
 */
function getConfigurationStatus() {
  return {
    configured: !!(config.connectionString || config.instrumentationKey),
    connectionString: !!config.connectionString,
    instrumentationKey: !!config.instrumentationKey,
    samplingPercentage: config.samplingPercentage,
    liveMetricsEnabled: config.enableLiveMetrics,
    environment: process.env.NODE_ENV || 'development'
  };
}

module.exports = {
  config,
  initializeApplicationInsights,
  getClient,
  telemetry,
  createExpressMiddleware,
  performanceMonitoring,
  flush,
  getConfigurationStatus
};
