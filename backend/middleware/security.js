/**
 * Security Middleware for TaktMate Application
 * 
 * This module provides comprehensive security middleware including
 * rate limiting, input validation, CORS configuration, and security headers.
 */

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, query, param, validationResult } = require('express-validator');

/**
 * Security Headers Configuration
 */
function configureSecurityHeaders() {
  return helmet({
    // Content Security Policy
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        scriptSrc: ["'self'"],
        connectSrc: [
          "'self'",
          "https://*.b2clogin.com",
          "https://*.openai.azure.com",
          "https://login.microsoftonline.com",
          "https://accounts.google.com"
        ],
        frameSrc: [
          "'self'",
          "https://*.b2clogin.com",
          "https://login.microsoftonline.com",
          "https://accounts.google.com"
        ]
      }
    },
    
    // HTTP Strict Transport Security
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },
    
    // X-Frame-Options
    frameguard: {
      action: 'deny'
    },
    
    // X-Content-Type-Options
    noSniff: true,
    
    // Referrer Policy
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin'
    },
    
    // X-XSS-Protection (legacy but still useful)
    xssFilter: true,
    
    // Remove X-Powered-By header
    hidePoweredBy: true
  });
}

/**
 * CORS Configuration
 */
function configureCORS() {
  const allowedOrigins = [
    'http://localhost:3000', // Development frontend
    'https://app.taktconnect.com', // Production frontend
    process.env.FRONTEND_URL
  ].filter(Boolean);

  return {
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true, // Allow credentials (cookies, authorization headers)
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-CSRF-Token'
    ],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    maxAge: 86400 // 24 hours
  };
}

/**
 * General Rate Limiting
 */
const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Rate limit exceeded',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: Math.round(req.rateLimit.resetTime / 1000)
    });
  }
});

/**
 * API Rate Limiting (more restrictive)
 */
const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 API requests per windowMs
  message: {
    success: false,
    error: 'Too many API requests, please try again later.',
    code: 'API_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'API rate limit exceeded',
      code: 'API_RATE_LIMIT_EXCEEDED',
      retryAfter: Math.round(req.rateLimit.resetTime / 1000)
    });
  }
});

/**
 * Upload Rate Limiting (very restrictive)
 */
const uploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // Limit each IP to 50 uploads per hour
  message: {
    success: false,
    error: 'Too many file uploads, please try again later.',
    code: 'UPLOAD_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Upload rate limit exceeded',
      code: 'UPLOAD_RATE_LIMIT_EXCEEDED',
      retryAfter: Math.round(req.rateLimit.resetTime / 1000)
    });
  }
});

/**
 * Authentication Rate Limiting
 */
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 auth requests per windowMs
  message: {
    success: false,
    error: 'Too many authentication requests, please try again later.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Authentication rate limit exceeded',
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      retryAfter: Math.round(req.rateLimit.resetTime / 1000)
    });
  }
});

/**
 * Input Validation Middleware
 */
function validateRequest(validations) {
  return async (req, res, next) => {
    // Run all validations
    await Promise.all(validations.map(validation => validation.run(req)));

    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Request validation failed',
        code: 'VALIDATION_ERROR',
        details: errors.array().map(error => ({
          field: error.path || error.param,
          message: error.msg,
          value: error.value
        }))
      });
    }

    next();
  };
}

/**
 * Common Validation Rules
 */
const validationRules = {
  // File upload validations
  csvFile: [
    body('fileId')
      .optional()
      .isUUID()
      .withMessage('Invalid file ID format'),
  ],

  // Chat message validations
  chatMessage: [
    body('message')
      .notEmpty()
      .withMessage('Message is required')
      .isLength({ min: 1, max: 1000 })
      .withMessage('Message must be between 1 and 1000 characters')
      .trim()
      .escape(),
    body('fileId')
      .notEmpty()
      .withMessage('File ID is required')
      .isUUID()
      .withMessage('Invalid file ID format')
  ],

  // Authentication validations
  token: [
    body('token')
      .notEmpty()
      .withMessage('Token is required')
      .isJWT()
      .withMessage('Invalid JWT token format')
  ],

  // URL validations
  redirectUri: [
    query('redirect_uri')
      .optional()
      .isURL({ protocols: ['http', 'https'] })
      .withMessage('Invalid redirect URI format'),
    body('redirect_uri')
      .optional()
      .isURL({ protocols: ['http', 'https'] })
      .withMessage('Invalid redirect URI format')
  ],

  // General parameter validations
  uuid: (paramName) => [
    param(paramName)
      .isUUID()
      .withMessage(`Invalid ${paramName} format`)
  ],

  // Pagination validations
  pagination: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
  ]
};

/**
 * Security Logging Middleware
 */
function securityLogger() {
  return (req, res, next) => {
    // Log security-relevant events
    const securityEvents = [];

    // Check for suspicious patterns
    if (req.headers['user-agent'] && req.headers['user-agent'].toLowerCase().includes('bot')) {
      securityEvents.push('bot_user_agent');
    }

    if (req.ip && req.ip !== '127.0.0.1' && req.ip !== '::1') {
      // Log external IP access
      securityEvents.push('external_ip_access');
    }

    if (req.headers.authorization) {
      securityEvents.push('auth_header_present');
    }

    // Log significant events
    if (securityEvents.length > 0) {
      console.log(`🔒 Security Event: ${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        events: securityEvents,
        timestamp: new Date().toISOString()
      });
    }

    next();
  };
}

/**
 * Request Size Limiting Middleware
 */
function limitRequestSize(maxSize = '10mb') {
  return (req, res, next) => {
    const contentLength = req.headers['content-length'];
    
    if (contentLength) {
      const sizeInBytes = parseInt(contentLength, 10);
      const maxSizeInBytes = parseSize(maxSize);
      
      if (sizeInBytes > maxSizeInBytes) {
        return res.status(413).json({
          success: false,
          error: 'Request entity too large',
          code: 'REQUEST_TOO_LARGE',
          maxSize: maxSize
        });
      }
    }
    
    next();
  };
}

/**
 * Parse size string to bytes
 */
function parseSize(size) {
  const units = { b: 1, kb: 1024, mb: 1024 * 1024, gb: 1024 * 1024 * 1024 };
  const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
  
  if (!match) return 0;
  
  const value = parseFloat(match[1]);
  const unit = match[2] || 'b';
  
  return Math.floor(value * units[unit]);
}

/**
 * Error Handling Middleware for Security
 */
function securityErrorHandler() {
  return (error, req, res, next) => {
    // Log security-related errors
    if (error.message && (
      error.message.includes('CORS') ||
      error.message.includes('rate limit') ||
      error.message.includes('validation')
    )) {
      console.error('🚨 Security Error:', {
        error: error.message,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
      });
    }

    // Handle CORS errors
    if (error.message.includes('CORS')) {
      return res.status(403).json({
        success: false,
        error: 'CORS policy violation',
        code: 'CORS_ERROR'
      });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Request validation failed',
        code: 'VALIDATION_ERROR',
        details: error.message
      });
    }

    next(error);
  };
}

module.exports = {
  configureSecurityHeaders,
  configureCORS,
  generalRateLimit,
  apiRateLimit,
  uploadRateLimit,
  authRateLimit,
  validateRequest,
  validationRules,
  securityLogger,
  limitRequestSize,
  securityErrorHandler
};
