/**
 * Azure Application Insights Configuration for TaktMate
 * 
 * This module configures Application Insights for monitoring, logging,
 * and performance tracking of the TaktMate application.
 */

const appInsights = require('applicationinsights');

/**
 * Application Insights Configuration
 */
const config = {
  connectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING,
  instrumentationKey: process.env.APPINSIGHTS_INSTRUMENTATIONKEY,
  
  // Sampling configuration
  samplingPercentage: parseFloat(process.env.APPINSIGHTS_SAMPLING_PERCENTAGE) || 100,
  
  // Auto-collection settings
  enableAutoCollectRequests: true,
  enableAutoCollectPerformance: true,
  enableAutoCollectExceptions: true,
  enableAutoCollectDependencies: true,
  enableAutoCollectConsole: true,
  enableAutoCollectHeartbeat: true,
  
  // Custom settings
  enableLiveMetrics: process.env.NODE_ENV === 'production',
  enableWebInstrumentation: true,
  
  // Correlation settings
  enableDistributedTracing: true,
  enableAutoCorrelation: true,
  
  // Privacy settings
  enableAutoCollectIncomingRequestAzureFunctions: false,
  disableAllExtendedMetrics: false
};

/**
 * Initialize Application Insights
 */
function initializeApplicationInsights() {
  try {
    // Only initialize if connection string is provided
    if (!config.connectionString && !config.instrumentationKey) {
      console.log('⚠️  Application Insights not configured - skipping initialization');
      return null;
    }

    // Setup Application Insights
    if (config.connectionString) {
      appInsights.setup(config.connectionString);
    } else if (config.instrumentationKey) {
      appInsights.setup(config.instrumentationKey);
    }

    // Configure auto-collection
    appInsights.Configuration
      .setAutoCollectRequests(config.enableAutoCollectRequests)
      .setAutoCollectPerformance(config.enableAutoCollectPerformance, config.enableAutoCollectExceptions)
      .setAutoCollectExceptions(config.enableAutoCollectExceptions)
      .setAutoCollectDependencies(config.enableAutoCollectDependencies)
      .setAutoCollectConsole(config.enableAutoCollectConsole, config.enableAutoCollectConsole)
      .setAutoCollectHeartbeat(config.enableAutoCollectHeartbeat)
      .setUseDiskRetryCaching(true)
      .setDistributedTracingMode(config.enableDistributedTracing ? appInsights.DistributedTracingModes.AI_AND_W3C : appInsights.DistributedTracingModes.AI);

    // Set sampling percentage
    appInsights.Configuration.setSamplingPercentage(config.samplingPercentage);

    // Enable live metrics if configured
    if (config.enableLiveMetrics) {
      appInsights.Configuration.enableLiveMetrics();
    }

    // Start Application Insights
    appInsights.start();

    console.log('✅ Application Insights initialized successfully');
    
    return appInsights.defaultClient;
  } catch (error) {
    console.error('❌ Failed to initialize Application Insights:', error.message);
    return null;
  }
}

/**
 * Get Application Insights client
 */
function getClient() {
  return appInsights.defaultClient;
}

/**
 * Custom telemetry tracking functions
 */
const telemetry = {
  /**
   * Track authentication events
   */
  trackAuthentication: (userId, email, provider, success, duration = null) => {
    const client = getClient();
    if (!client) return;

    client.trackEvent({
      name: 'UserAuthentication',
      properties: {
        userId: userId,
        email: email,
        provider: provider,
        success: success.toString(),
        environment: process.env.NODE_ENV || 'development'
      },
      measurements: duration ? { duration: duration } : undefined
    });

    if (success) {
      client.trackMetric({
        name: 'AuthenticationSuccess',
        value: 1,
        properties: { provider: provider }
      });
    } else {
      client.trackMetric({
        name: 'AuthenticationFailure',
        value: 1,
        properties: { provider: provider }
      });
    }
  },

  /**
   * Track CSV file uploads
   */
  trackFileUpload: (userId, fileSize, rowCount, processingTime, success) => {
    const client = getClient();
    if (!client) return;

    client.trackEvent({
      name: 'FileUpload',
      properties: {
        userId: userId,
        success: success.toString(),
        environment: process.env.NODE_ENV || 'development'
      },
      measurements: {
        fileSize: fileSize,
        rowCount: rowCount,
        processingTime: processingTime
      }
    });

    client.trackMetric({
      name: 'FileUploadSize',
      value: fileSize,
      properties: { success: success.toString() }
    });

    client.trackMetric({
      name: 'FileProcessingTime',
      value: processingTime,
      properties: { success: success.toString() }
    });
  },

  /**
   * Track chat interactions
   */
  trackChatInteraction: (userId, messageLength, responseTime, success, tokenUsage = null) => {
    const client = getClient();
    if (!client) return;

    client.trackEvent({
      name: 'ChatInteraction',
      properties: {
        userId: userId,
        success: success.toString(),
        environment: process.env.NODE_ENV || 'development'
      },
      measurements: {
        messageLength: messageLength,
        responseTime: responseTime,
        ...(tokenUsage && { tokenUsage: tokenUsage })
      }
    });

    client.trackMetric({
      name: 'ChatResponseTime',
      value: responseTime,
      properties: { success: success.toString() }
    });

    if (tokenUsage) {
      client.trackMetric({
        name: 'OpenAITokenUsage',
        value: tokenUsage
      });
    }
  },

  /**
   * Track API errors
   */
  trackError: (error, userId = null, context = {}) => {
    const client = getClient();
    if (!client) return;

    client.trackException({
      exception: error,
      properties: {
        userId: userId,
        environment: process.env.NODE_ENV || 'development',
        ...context
      }
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
   * Track dependencies (external API calls)
   */
  trackDependency: (name, command, duration, success, dependencyType = 'HTTP') => {
    const client = getClient();
    if (!client) return;

    client.trackDependency({
      target: name,
      name: command,
      data: command,
      duration: duration,
      resultCode: success ? 200 : 500,
      success: success,
      dependencyTypeName: dependencyType,
      properties: {
        environment: process.env.NODE_ENV || 'development'
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

    // Override res.end to track response
    const originalEnd = res.end;
    res.end = function(...args) {
      const duration = Date.now() - startTime;
      
      // Track custom metrics for API endpoints
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
  flush,
  getConfigurationStatus
};
