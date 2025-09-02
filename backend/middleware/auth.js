const AuthService = require('../services/authService');
const rateLimit = require('express-rate-limit');

// Initialize auth service
const authService = new AuthService();

/**
 * Authentication middleware for protecting routes
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from Authorization header or session
    let token = null;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7);
    } else if (req.session && req.session.token) {
      token = req.session.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access denied. No token provided.',
        code: 'NO_TOKEN'
      });
    }

    // Verify JWT token
    let payload;
    try {
      payload = authService.verifyJWT(token);
    } catch (error) {
      if (error.message === 'Token expired') {
        return res.status(401).json({
          success: false,
          error: 'Token expired. Please log in again.',
          code: 'TOKEN_EXPIRED'
        });
      } else {
        return res.status(401).json({
          success: false,
          error: 'Invalid token.',
          code: 'INVALID_TOKEN'
        });
      }
    }

    // Get session ID from request (could be in headers, session, or body)
    const sessionId = req.headers['x-session-id'] || 
                     req.session?.sessionId || 
                     req.body?.sessionId;

    if (sessionId) {
      // Validate session if session ID is provided
      const sessionValidation = await authService.validateSession(sessionId, {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      if (!sessionValidation.valid) {
        return res.status(401).json({
          success: false,
          error: 'Invalid or expired session.',
          code: 'INVALID_SESSION',
          reason: sessionValidation.reason
        });
      }

      // Add session info to request
      req.session_info = sessionValidation.session;
    }

    // Add user info to request
    req.user = {
      id: payload.userId,
      email: payload.email,
      name: payload.name,
      emailVerified: payload.emailVerified
    };

    next();

  } catch (error) {
    console.error('Authentication middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication error',
      code: 'AUTH_ERROR'
    });
  }
};

/**
 * Middleware to require email verification
 */
const requireEmailVerification = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  if (!req.user.emailVerified) {
    return res.status(403).json({
      success: false,
      error: 'Email verification required',
      code: 'EMAIL_VERIFICATION_REQUIRED',
      message: 'Please verify your email address before accessing this resource.'
    });
  }

  next();
};

/**
 * Optional authentication - adds user info if token is present but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
  try {
    // Get token from Authorization header or session
    let token = null;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7);
    } else if (req.session && req.session.token) {
      token = req.session.token;
    }

    if (token) {
      try {
        const payload = authService.verifyJWT(token);
        req.user = {
          id: payload.userId,
          email: payload.email,
          name: payload.name,
          emailVerified: payload.emailVerified
        };
      } catch (error) {
        // Token invalid or expired, but that's okay for optional auth
        req.user = null;
      }
    }

    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    next(); // Continue even if there's an error
  }
};

/**
 * Rate limiting for authentication endpoints
 */
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip successful requests
  skipSuccessfulRequests: true,
  // Custom key generator to include user agent
  keyGenerator: (req) => {
    return `${req.ip}-${req.get('User-Agent') || 'unknown'}`;
  }
});

/**
 * Rate limiting for password reset requests
 */
const passwordResetRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 password reset requests per hour
  message: {
    success: false,
    error: 'Too many password reset attempts, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Rate limiting for email verification requests
 */
const emailVerificationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 email verification requests per hour
  message: {
    success: false,
    error: 'Too many email verification attempts, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * General API rate limiting
 */
const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Middleware to extract client info (IP, User Agent) and add to request
 */
const extractClientInfo = (req, res, next) => {
  req.clientInfo = {
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent') || 'Unknown',
    origin: req.get('Origin') || req.get('Referer') || 'Unknown'
  };
  next();
};

/**
 * Middleware to validate session and update last accessed time
 */
const validateAndUpdateSession = async (req, res, next) => {
  try {
    if (req.session_info) {
      // Update last accessed time
      await req.session_info.updateLastAccessed();
    }
    next();
  } catch (error) {
    console.error('Session update error:', error);
    // Continue even if session update fails
    next();
  }
};

/**
 * Error handler for authentication errors
 */
const authErrorHandler = (error, req, res, next) => {
  if (error.name === 'UnauthorizedError') {
    return res.status(401).json({
      success: false,
      error: 'Invalid token',
      code: 'UNAUTHORIZED'
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'Token expired',
      code: 'TOKEN_EXPIRED'
    });
  }

  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Invalid token',
      code: 'INVALID_TOKEN'
    });
  }

  // Pass other errors to the general error handler
  next(error);
};

/**
 * Middleware to check if user owns resource
 */
const checkResourceOwnership = (resourceUserIdField = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const resourceUserId = req.params[resourceUserIdField] || req.body[resourceUserIdField];
    
    if (!resourceUserId) {
      return res.status(400).json({
        success: false,
        error: 'Resource user ID not provided',
        code: 'MISSING_USER_ID'
      });
    }

    if (parseInt(resourceUserId) !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only access your own resources.',
        code: 'ACCESS_DENIED'
      });
    }

    next();
  };
};

module.exports = {
  authenticate,
  optionalAuth,
  requireEmailVerification,
  authRateLimit,
  passwordResetRateLimit,
  emailVerificationRateLimit,
  apiRateLimit,
  extractClientInfo,
  validateAndUpdateSession,
  authErrorHandler,
  checkResourceOwnership,
  authService // Export auth service for use in routes
};
