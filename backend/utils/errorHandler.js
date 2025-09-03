/**
 * Comprehensive Error Handler for TaktMate Backend
 * 
 * This module provides centralized error handling for authentication failures,
 * JWT validation errors, and other system errors with proper logging and
 * user-friendly error messages.
 */

const { config: azureConfig } = require('../config/azureAdB2C');

/**
 * Error types and their corresponding HTTP status codes
 */
const ErrorTypes = {
  // Authentication Errors (4xx)
  AUTHENTICATION_REQUIRED: { code: 401, type: 'AUTHENTICATION_REQUIRED' },
  INVALID_TOKEN: { code: 401, type: 'INVALID_TOKEN' },
  EXPIRED_TOKEN: { code: 401, type: 'EXPIRED_TOKEN' },
  MALFORMED_TOKEN: { code: 401, type: 'MALFORMED_TOKEN' },
  INSUFFICIENT_PERMISSIONS: { code: 403, type: 'INSUFFICIENT_PERMISSIONS' },
  ACCOUNT_DISABLED: { code: 403, type: 'ACCOUNT_DISABLED' },
  ACCOUNT_LOCKED: { code: 423, type: 'ACCOUNT_LOCKED' },
  
  // Azure AD B2C Specific Errors
  AZURE_AD_B2C_UNAVAILABLE: { code: 503, type: 'AZURE_AD_B2C_UNAVAILABLE' },
  INVALID_TENANT: { code: 401, type: 'INVALID_TENANT' },
  INVALID_CLIENT: { code: 401, type: 'INVALID_CLIENT' },
  JWKS_FETCH_ERROR: { code: 503, type: 'JWKS_FETCH_ERROR' },
  TOKEN_VALIDATION_ERROR: { code: 401, type: 'TOKEN_VALIDATION_ERROR' },
  
  // Rate Limiting and Security
  RATE_LIMIT_EXCEEDED: { code: 429, type: 'RATE_LIMIT_EXCEEDED' },
  SUSPICIOUS_ACTIVITY: { code: 429, type: 'SUSPICIOUS_ACTIVITY' },
  IP_BLOCKED: { code: 403, type: 'IP_BLOCKED' },
  
  // System Errors (5xx)
  INTERNAL_SERVER_ERROR: { code: 500, type: 'INTERNAL_SERVER_ERROR' },
  SERVICE_UNAVAILABLE: { code: 503, type: 'SERVICE_UNAVAILABLE' },
  DATABASE_ERROR: { code: 503, type: 'DATABASE_ERROR' },
  EXTERNAL_SERVICE_ERROR: { code: 503, type: 'EXTERNAL_SERVICE_ERROR' },
  
  // Validation Errors (4xx)
  INVALID_REQUEST: { code: 400, type: 'INVALID_REQUEST' },
  MISSING_PARAMETERS: { code: 400, type: 'MISSING_PARAMETERS' },
  INVALID_PARAMETERS: { code: 400, type: 'INVALID_PARAMETERS' },
  
  // Resource Errors (4xx)
  RESOURCE_NOT_FOUND: { code: 404, type: 'RESOURCE_NOT_FOUND' },
  RESOURCE_CONFLICT: { code: 409, type: 'RESOURCE_CONFLICT' },
  RESOURCE_GONE: { code: 410, type: 'RESOURCE_GONE' }
};

/**
 * User-friendly error messages with actionable guidance
 */
const ErrorMessages = {
  AUTHENTICATION_REQUIRED: {
    message: 'Authentication is required to access this resource.',
    userMessage: 'Please log in to continue.',
    action: 'redirect_to_login',
    guidance: 'You need to sign in with your account to access this feature.'
  },
  
  INVALID_TOKEN: {
    message: 'The provided authentication token is invalid.',
    userMessage: 'Your session is invalid. Please sign in again.',
    action: 'redirect_to_login',
    guidance: 'Your authentication token is not valid. Please sign in again to get a new token.'
  },
  
  EXPIRED_TOKEN: {
    message: 'The authentication token has expired.',
    userMessage: 'Your session has expired. Please sign in again.',
    action: 'redirect_to_login',
    guidance: 'Your session has expired for security reasons. Please sign in again to continue.'
  },
  
  MALFORMED_TOKEN: {
    message: 'The authentication token is malformed or corrupted.',
    userMessage: 'Authentication error. Please sign in again.',
    action: 'redirect_to_login',
    guidance: 'There was an issue with your authentication token. Please sign in again.'
  },
  
  INSUFFICIENT_PERMISSIONS: {
    message: 'Insufficient permissions to access this resource.',
    userMessage: 'You do not have permission to access this resource.',
    action: 'contact_support',
    guidance: 'Your account does not have the required permissions. Contact your administrator if you believe this is an error.'
  },
  
  ACCOUNT_DISABLED: {
    message: 'The user account has been disabled.',
    userMessage: 'Your account has been disabled.',
    action: 'contact_support',
    guidance: 'Your account has been disabled. Please contact support for assistance.'
  },
  
  ACCOUNT_LOCKED: {
    message: 'The user account is temporarily locked.',
    userMessage: 'Your account is temporarily locked.',
    action: 'wait_and_retry',
    guidance: 'Your account is temporarily locked due to security reasons. Please try again later or contact support.'
  },
  
  AZURE_AD_B2C_UNAVAILABLE: {
    message: 'Azure AD B2C authentication service is temporarily unavailable.',
    userMessage: 'Authentication service is temporarily unavailable.',
    action: 'retry_later',
    guidance: 'The authentication service is currently experiencing issues. Please try again in a few minutes.'
  },
  
  INVALID_TENANT: {
    message: 'Invalid Azure AD B2C tenant configuration.',
    userMessage: 'Authentication configuration error.',
    action: 'contact_support',
    guidance: 'There is a configuration issue with the authentication system. Please contact support.'
  },
  
  INVALID_CLIENT: {
    message: 'Invalid client application configuration.',
    userMessage: 'Application configuration error.',
    action: 'contact_support',
    guidance: 'There is an issue with the application configuration. Please contact support.'
  },
  
  JWKS_FETCH_ERROR: {
    message: 'Failed to fetch JWKS keys for token validation.',
    userMessage: 'Authentication service error.',
    action: 'retry_later',
    guidance: 'There was an issue validating your authentication. Please try again in a few minutes.'
  },
  
  TOKEN_VALIDATION_ERROR: {
    message: 'Token validation failed due to technical error.',
    userMessage: 'Authentication validation failed.',
    action: 'retry_or_relogin',
    guidance: 'There was an issue validating your authentication. Please try refreshing the page or signing in again.'
  },
  
  RATE_LIMIT_EXCEEDED: {
    message: 'Rate limit exceeded for authentication requests.',
    userMessage: 'Too many requests. Please wait before trying again.',
    action: 'wait_and_retry',
    guidance: 'You have made too many requests. Please wait a few minutes before trying again.',
    retryAfter: 300 // 5 minutes
  },
  
  SUSPICIOUS_ACTIVITY: {
    message: 'Suspicious activity detected.',
    userMessage: 'Unusual activity detected. Access temporarily restricted.',
    action: 'contact_support',
    guidance: 'Unusual activity has been detected on your account. Please contact support for assistance.'
  },
  
  IP_BLOCKED: {
    message: 'Access blocked from this IP address.',
    userMessage: 'Access denied from your location.',
    action: 'contact_support',
    guidance: 'Access has been blocked from your current location. Please contact support if you believe this is an error.'
  },
  
  INTERNAL_SERVER_ERROR: {
    message: 'An internal server error occurred.',
    userMessage: 'A server error occurred. Please try again.',
    action: 'retry_later',
    guidance: 'An unexpected error occurred. Please try again in a few minutes. If the problem persists, contact support.'
  },
  
  SERVICE_UNAVAILABLE: {
    message: 'Service is temporarily unavailable.',
    userMessage: 'Service temporarily unavailable.',
    action: 'retry_later',
    guidance: 'The service is temporarily unavailable. Please try again in a few minutes.'
  },
  
  INVALID_REQUEST: {
    message: 'The request is invalid or malformed.',
    userMessage: 'Invalid request format.',
    action: 'check_request',
    guidance: 'The request format is invalid. Please check your input and try again.'
  },
  
  MISSING_PARAMETERS: {
    message: 'Required parameters are missing from the request.',
    userMessage: 'Missing required information.',
    action: 'check_request',
    guidance: 'Some required information is missing. Please check your input and try again.'
  },
  
  RESOURCE_NOT_FOUND: {
    message: 'The requested resource was not found.',
    userMessage: 'Resource not found.',
    action: 'check_url',
    guidance: 'The requested resource could not be found. Please check the URL and try again.'
  }
};

/**
 * Error context for debugging and logging
 */
class ErrorContext {
  constructor(options = {}) {
    this.timestamp = new Date().toISOString();
    this.requestId = options.requestId || this.generateRequestId();
    this.userId = options.userId || null;
    this.userAgent = options.userAgent || null;
    this.ip = options.ip || null;
    this.endpoint = options.endpoint || null;
    this.method = options.method || null;
    this.additionalContext = options.additionalContext || {};
  }

  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  toObject() {
    return {
      timestamp: this.timestamp,
      requestId: this.requestId,
      userId: this.userId,
      userAgent: this.userAgent,
      ip: this.ip,
      endpoint: this.endpoint,
      method: this.method,
      additionalContext: this.additionalContext
    };
  }
}

/**
 * Comprehensive Error class with context and metadata
 */
class TaktMateError extends Error {
  constructor(errorType, originalError = null, context = {}) {
    const errorInfo = ErrorTypes[errorType];
    const errorMessage = ErrorMessages[errorType];
    
    if (!errorInfo) {
      throw new Error(`Unknown error type: ${errorType}`);
    }

    super(errorMessage?.message || `Error of type ${errorType} occurred`);
    
    this.name = 'TaktMateError';
    this.type = errorInfo.type;
    this.statusCode = errorInfo.code;
    this.errorCode = errorType;
    this.userMessage = errorMessage?.userMessage || 'An error occurred';
    this.action = errorMessage?.action || 'retry_later';
    this.guidance = errorMessage?.guidance || 'Please try again later';
    this.retryAfter = errorMessage?.retryAfter || null;
    this.originalError = originalError;
    this.context = new ErrorContext(context);
    this.isOperational = true; // This is an expected/handled error
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TaktMateError);
    }
  }

  /**
   * Convert error to API response format
   */
  toApiResponse() {
    const response = {
      success: false,
      error: {
        type: this.type,
        code: this.errorCode,
        message: this.userMessage,
        action: this.action,
        guidance: this.guidance,
        requestId: this.context.requestId,
        timestamp: this.context.timestamp
      }
    };

    // Add retry information for rate limiting
    if (this.retryAfter) {
      response.error.retryAfter = this.retryAfter;
    }

    // Add debug information in development
    if (azureConfig.debugAuth && process.env.NODE_ENV !== 'production') {
      response.debug = {
        originalMessage: this.message,
        stack: this.stack,
        originalError: this.originalError?.message,
        context: this.context.toObject()
      };
    }

    return response;
  }

  /**
   * Convert error to log format
   */
  toLogFormat() {
    return {
      level: this.statusCode >= 500 ? 'error' : 'warn',
      type: this.type,
      code: this.errorCode,
      statusCode: this.statusCode,
      message: this.message,
      userMessage: this.userMessage,
      originalError: this.originalError?.message,
      stack: this.stack,
      context: this.context.toObject()
    };
  }
}

/**
 * JWT-specific error handler
 */
class JWTErrorHandler {
  static handleJWTError(error, context = {}) {
    if (azureConfig.debugJwt) {
      console.log(`🔍 JWT Error Debug: ${error.message}`, error);
    }

    // Map JWT library errors to our error types
    if (error.name === 'TokenExpiredError') {
      return new TaktMateError('EXPIRED_TOKEN', error, context);
    }
    
    if (error.name === 'JsonWebTokenError') {
      if (error.message.includes('malformed')) {
        return new TaktMateError('MALFORMED_TOKEN', error, context);
      }
      if (error.message.includes('invalid signature')) {
        return new TaktMateError('INVALID_TOKEN', error, context);
      }
      if (error.message.includes('jwt must be provided')) {
        return new TaktMateError('AUTHENTICATION_REQUIRED', error, context);
      }
      return new TaktMateError('TOKEN_VALIDATION_ERROR', error, context);
    }
    
    if (error.name === 'NotBeforeError') {
      return new TaktMateError('INVALID_TOKEN', error, context);
    }

    // JWKS-related errors
    if (error.message && error.message.includes('JWKS')) {
      return new TaktMateError('JWKS_FETCH_ERROR', error, context);
    }

    // Azure AD B2C specific errors
    if (error.message && error.message.includes('tenant')) {
      return new TaktMateError('INVALID_TENANT', error, context);
    }

    if (error.message && error.message.includes('client')) {
      return new TaktMateError('INVALID_CLIENT', error, context);
    }

    // Default to generic token validation error
    return new TaktMateError('TOKEN_VALIDATION_ERROR', error, context);
  }
}

/**
 * HTTP error handler for common HTTP errors
 */
class HTTPErrorHandler {
  static handleHTTPError(error, context = {}) {
    // Handle Axios/HTTP client errors
    if (error.response) {
      const status = error.response.status;
      
      if (status === 401) {
        return new TaktMateError('AUTHENTICATION_REQUIRED', error, context);
      }
      if (status === 403) {
        return new TaktMateError('INSUFFICIENT_PERMISSIONS', error, context);
      }
      if (status === 404) {
        return new TaktMateError('RESOURCE_NOT_FOUND', error, context);
      }
      if (status === 429) {
        return new TaktMateError('RATE_LIMIT_EXCEEDED', error, context);
      }
      if (status >= 500) {
        return new TaktMateError('EXTERNAL_SERVICE_ERROR', error, context);
      }
    }
    
    // Network errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return new TaktMateError('SERVICE_UNAVAILABLE', error, context);
    }
    
    if (error.code === 'ETIMEDOUT') {
      return new TaktMateError('SERVICE_UNAVAILABLE', error, context);
    }

    // Default to internal server error
    return new TaktMateError('INTERNAL_SERVER_ERROR', error, context);
  }
}

/**
 * Application Insights error tracking
 */
class ErrorTracker {
  static trackError(error, userId = null, additionalProperties = {}) {
    try {
      // Try to get Application Insights
      const appInsights = require('../config/applicationInsights');
      
      if (appInsights && appInsights.telemetry) {
        const properties = {
          errorType: error.type || 'Unknown',
          errorCode: error.errorCode || error.code || 'Unknown',
          userId: userId || error.context?.userId,
          endpoint: error.context?.endpoint,
          userAgent: error.context?.userAgent,
          ...additionalProperties
        };

        const metrics = {
          statusCode: error.statusCode || 500,
          timestamp: Date.now()
        };

        appInsights.telemetry.trackError(error, userId, properties, metrics);
      }
    } catch (trackingError) {
      // Silently fail - don't let error tracking break the application
      if (azureConfig.debugAuth) {
        console.log('⚠️  Error tracking failed:', trackingError.message);
      }
    }
  }
}

/**
 * Main error handler middleware with enhanced logging integration
 */
function createErrorHandler(errorLoggingService = null) {
  return async (error, req, res, next) => {
    let taktMateError;

    // If it's already a TaktMateError, use it as is
    if (error instanceof TaktMateError) {
      taktMateError = error;
    } else {
      // Create context from request
      const context = {
        requestId: req.id || req.headers['x-request-id'],
        userId: req.user?.id,
        userAgent: req.headers['user-agent'],
        ip: req.ip || req.connection.remoteAddress,
        endpoint: req.path,
        method: req.method,
        additionalContext: {
          body: req.body ? Object.keys(req.body) : [],
          query: req.query ? Object.keys(req.query) : [],
          params: req.params ? Object.keys(req.params) : []
        }
      };

      // Handle different error types
      if (error.name && error.name.includes('JWT') || error.name.includes('Token')) {
        taktMateError = JWTErrorHandler.handleJWTError(error, context);
      } else if (error.response || error.code) {
        taktMateError = HTTPErrorHandler.handleHTTPError(error, context);
      } else {
        // Generic error
        taktMateError = new TaktMateError('INTERNAL_SERVER_ERROR', error, context);
      }
    }

    // Log the error
    const logData = taktMateError.toLogFormat();
    if (logData.level === 'error') {
      console.error('🚨 TaktMate Error:', logData);
    } else {
      console.warn('⚠️  TaktMate Warning:', logData);
    }

    // Track error in Application Insights with enhanced error tracking
    const duration = req.startTime ? Date.now() - req.startTime : 0;
    const errorContext = {
      component: 'errorHandler',
      endpoint: req.path,
      method: req.method,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress,
      correlationId: req.headers['x-correlation-id'],
      sessionId: req.sessionID,
      userId: req.user?.id,
      userEmail: req.user?.email,
      duration: duration
    };

    // Use specialized error tracking based on error type
    if (global.appInsights && global.appInsights.telemetry) {
      switch (taktMateError.type) {
        case 'AUTHENTICATION_REQUIRED':
        case 'TOKEN_EXPIRED':
        case 'TOKEN_INVALID':
        case 'INSUFFICIENT_PERMISSIONS':
          global.appInsights.telemetry.trackAuthError(taktMateError, {
            ...errorContext,
            tokenExpired: taktMateError.type === 'TOKEN_EXPIRED',
            tokenInvalid: taktMateError.type === 'TOKEN_INVALID',
            authProvider: 'azure-ad-b2c'
          });
          break;
        case 'VALIDATION_FAILED':
        case 'INVALID_CSV':
          global.appInsights.telemetry.trackValidationError(taktMateError, req.body || {}, {
            ...errorContext,
            validationType: 'request',
            fieldName: taktMateError.context?.fieldName || 'unknown'
          });
          break;
        default:
          global.appInsights.telemetry.trackHTTPError(taktMateError, req, res, {
            ...errorContext,
            errorCategory: 'taktmate_error'
          });
          break;
      }
    }

    // Enhanced logging with comprehensive error logging service
    if (errorLoggingService) {
      try {
        await errorLoggingService.logError(taktMateError, {
          component: 'error_handler',
          endpoint: req.path,
          method: req.method,
          statusCode: taktMateError.statusCode,
          errorType: taktMateError.type,
          important: taktMateError.statusCode >= 500
        }, req);
      } catch (loggingError) {
        console.error('❌ Enhanced error logging failed:', loggingError.message);
      }
    }

    // Also track with general error tracking for backwards compatibility
    ErrorTracker.trackError(taktMateError, req.user?.id, errorContext);

    // Set retry-after header for rate limiting
    if (taktMateError.retryAfter) {
      res.set('Retry-After', taktMateError.retryAfter);
    }

    // Send error response
    res.status(taktMateError.statusCode).json(taktMateError.toApiResponse());
  };
}

/**
 * Express middleware for handling async errors
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Create authentication error with context
 */
function createAuthError(errorType, originalError = null, req = null) {
  const context = req ? {
    requestId: req.id || req.headers['x-request-id'],
    userId: req.user?.id,
    userAgent: req.headers['user-agent'],
    ip: req.ip || req.connection.remoteAddress,
    endpoint: req.path,
    method: req.method
  } : {};

  return new TaktMateError(errorType, originalError, context);
}

module.exports = {
  TaktMateError,
  JWTErrorHandler,
  HTTPErrorHandler,
  ErrorTracker,
  ErrorTypes,
  ErrorMessages,
  ErrorContext,
  createErrorHandler,
  asyncHandler,
  createAuthError
};
