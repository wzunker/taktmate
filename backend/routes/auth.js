/**
 * Authentication Routes for Azure AD B2C Integration
 * 
 * This module provides authentication endpoints for Azure AD B2C integration,
 * including login URL generation, user profile management, and authentication status.
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const { 
  config, 
  generateLoginUrl, 
  generatePasswordResetUrl, 
  generateProfileEditUrl,
  extractUserProfile,
  validateConfiguration,
  getConfigurationStatus,
  isFeatureEnabled,
  logConfigurationSummary
} = require('../config/azureAdB2C');

const { 
  jwtAuthMiddleware, 
  optionalJwtAuthMiddleware,
  validateJwtToken,
  getJwksCacheStats
} = require('../middleware/jwtValidation');

const router = express.Router();

// Import Application Insights telemetry (optional)
let telemetry = null;
try {
  const appInsights = require('../config/applicationInsights');
  telemetry = appInsights.telemetry;
} catch (error) {
  // Application Insights not configured or available
  if (config.debugAuth) {
    console.log('ℹ️  Application Insights not available for auth routes telemetry');
  }
}

/**
 * Dynamic rate limiting for authentication endpoints
 */
const createRateLimit = (windowMs, max, message, skipSuccessfulRequests = false) => {
  // Check if rate limiting is enabled
  if (!isFeatureEnabled('rateLimiting')) {
    return (req, res, next) => next(); // No-op middleware if disabled
  }
  
  return rateLimit({
    windowMs: windowMs,
    max: max,
    message: {
      success: false,
      error: message,
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil(windowMs / 1000) // seconds
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: skipSuccessfulRequests,
    handler: (req, res) => {
      // Track rate limit exceeded events
      if (telemetry) {
        telemetry.trackEvent('RateLimitExceeded', {
          endpoint: req.path,
          method: req.method,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          userId: req.userId || 'anonymous'
        });
      }
      
      if (config.debugAuth) {
        console.log(`🚫 Rate limit exceeded for ${req.ip} on ${req.path}`);
      }
      
      res.status(429).json({
        success: false,
        error: message,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  });
};

// Standard rate limiting for general auth endpoints
const authRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  100, // 100 requests per window
  'Too many authentication requests, please try again later.'
);

// Strict rate limiting for sensitive operations
const strictAuthRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  20, // 20 requests per window
  'Too many sensitive authentication requests, please try again later.',
  true // Skip successful requests in count
);

/**
 * GET /auth/config
 * Get authentication configuration and status
 */
router.get('/config', authRateLimit, (req, res) => {
  const startTime = Date.now();
  
  try {
    // Validate configuration
    const isValid = validateConfiguration();
    const configStatus = getConfigurationStatus();
    
    // Build comprehensive configuration response
    const authConfig = {
      success: true,
      configured: configStatus.configured,
      valid: isValid,
      timestamp: new Date().toISOString(),
      config: {
        tenant: {
          name: config.tenantName,
          domain: `${config.tenantName}.b2clogin.com`,
          id: config.tenantId ? config.tenantId.substring(0, 8) + '...' : null // Partial for security
        },
        application: {
          clientId: config.clientId ? config.clientId.substring(0, 8) + '...' : null, // Partial for security
          redirectUri: config.redirectUri
        },
        policies: {
          signUpSignIn: config.signUpSignInPolicy,
          passwordReset: config.passwordResetPolicy,
          profileEdit: config.profileEditPolicy,
          useCustomPolicies: config.useCustomPolicies
        },
        validation: {
          issuer: config.validateIssuer,
          audience: config.validateAudience,
          lifetime: config.validateLifetime,
          clockTolerance: config.clockTolerance
        },
        caching: {
          jwksTtl: config.jwksCacheTtl,
          jwtTtl: config.jwtCacheTtl
        }
      },
      endpoints: {
        login: '/auth/login-url',
        logout: '/auth/logout',
        profile: '/auth/profile',
        status: '/auth/status',
        validate: '/auth/validate',
        jwksStats: '/auth/jwks-stats'
      },
      features: {
        socialLogin: ['Google', 'Microsoft', 'Local'],
        selfService: ['Password Reset', 'Profile Edit'],
        customAttributes: ['Company', 'Role', 'Industry'],
        rateLimiting: isFeatureEnabled('rateLimiting'),
        securityHeaders: isFeatureEnabled('securityHeaders'),
        cors: isFeatureEnabled('cors'),
        telemetry: !!telemetry,
        debug: {
          auth: config.debugAuth,
          jwt: config.debugJwt,
          config: config.debugConfig
        }
      }
    };

    // Track configuration request
    if (telemetry) {
      telemetry.trackEvent('AuthConfigRequested', {
        configured: configStatus.configured.toString(),
        valid: isValid.toString(),
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }, {
        responseTime: Date.now() - startTime
      });
    }

    if (config.debugAuth) {
      console.log(`📋 Auth configuration requested from ${req.ip}`);
    }

    res.json(authConfig);
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error('Configuration error:', error);
    
    // Track configuration error
    if (telemetry) {
      telemetry.trackError(error, null, {
        component: 'authConfigEndpoint',
        duration: duration,
        ip: req.ip
      });
    }
    
    res.status(500).json({
      success: false,
      configured: false,
      error: 'Authentication configuration error',
      code: 'CONFIG_ERROR',
      timestamp: new Date().toISOString(),
      details: config.debugAuth ? error.message : undefined
    });
  }
});

/**
 * GET /auth/login-url
 * Generate Azure AD B2C login URL
 */
router.get('/login-url', authRateLimit, [
  // Validate redirect_uri parameter
  body('redirect_uri')
    .optional()
    .isURL({ protocols: ['http', 'https'] })
    .withMessage('Invalid redirect URI format'),
], (req, res) => {
  try {
    // Check validation results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request parameters',
        code: 'VALIDATION_ERROR',
        details: errors.array()
      });
    }

    const redirectUri = req.query.redirect_uri || req.body.redirect_uri || `${process.env.FRONTEND_URL}/auth/callback`;
    const state = req.query.state || 'default';
    const nonce = req.query.nonce || 'defaultNonce';

    const loginUrl = generateLoginUrl(redirectUri, { state, nonce });

    res.json({
      success: true,
      loginUrl: loginUrl,
      redirectUri: redirectUri,
      state: state,
      policy: config.signUpSignInPolicy,
      expiresIn: 300 // URL valid for 5 minutes
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to generate login URL',
      code: 'LOGIN_URL_ERROR',
      details: error.message
    });
  }
});

/**
 * GET /auth/password-reset-url
 * Generate Azure AD B2C password reset URL
 */
router.get('/password-reset-url', authRateLimit, [
  body('redirect_uri')
    .optional()
    .isURL({ protocols: ['http', 'https'] })
    .withMessage('Invalid redirect URI format'),
], (req, res) => {
  try {
    if (!config.passwordResetPolicy) {
      return res.status(404).json({
        success: false,
        error: 'Password reset not configured',
        code: 'FEATURE_NOT_AVAILABLE'
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request parameters',
        code: 'VALIDATION_ERROR',
        details: errors.array()
      });
    }

    const redirectUri = req.query.redirect_uri || req.body.redirect_uri || `${process.env.FRONTEND_URL}/auth/callback`;
    const state = req.query.state || 'password-reset';

    const resetUrl = generatePasswordResetUrl(redirectUri, { state });

    res.json({
      success: true,
      resetUrl: resetUrl,
      redirectUri: redirectUri,
      state: state,
      policy: config.passwordResetPolicy,
      expiresIn: 300
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to generate password reset URL',
      code: 'RESET_URL_ERROR',
      details: error.message
    });
  }
});

/**
 * GET /auth/profile-edit-url
 * Generate Azure AD B2C profile edit URL
 */
router.get('/profile-edit-url', jwtAuthMiddleware(), [
  body('redirect_uri')
    .optional()
    .isURL({ protocols: ['http', 'https'] })
    .withMessage('Invalid redirect URI format'),
], (req, res) => {
  try {
    if (!config.profileEditPolicy) {
      return res.status(404).json({
        success: false,
        error: 'Profile editing not configured',
        code: 'FEATURE_NOT_AVAILABLE'
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request parameters',
        code: 'VALIDATION_ERROR',
        details: errors.array()
      });
    }

    const redirectUri = req.query.redirect_uri || req.body.redirect_uri || `${process.env.FRONTEND_URL}/auth/callback`;
    const state = req.query.state || 'profile-edit';

    const profileUrl = generateProfileEditUrl(redirectUri, { state });

    res.json({
      success: true,
      profileUrl: profileUrl,
      redirectUri: redirectUri,
      state: state,
      policy: config.profileEditPolicy,
      expiresIn: 300,
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to generate profile edit URL',
      code: 'PROFILE_URL_ERROR',
      details: error.message
    });
  }
});

/**
 * POST /auth/validate-token
 * Validate JWT token and extract user information
 */
router.post('/validate-token', strictAuthRateLimit, [
  body('token')
    .notEmpty()
    .withMessage('Token is required')
    .isJWT()
    .withMessage('Invalid JWT token format'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request parameters',
        code: 'VALIDATION_ERROR',
        details: errors.array()
      });
    }

    const { token } = req.body;
    const validation = await validateJwtToken(token);

    if (validation.valid) {
      res.json({
        success: true,
        valid: true,
        user: validation.userProfile,
        token: {
          issuer: validation.payload.iss,
          audience: validation.payload.aud,
          expiresAt: validation.payload.exp,
          issuedAt: validation.payload.iat,
          policy: validation.payload.tfp
        }
      });
    } else {
      res.status(401).json({
        success: false,
        valid: false,
        error: validation.error,
        code: validation.code
      });
    }

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Token validation failed',
      code: 'VALIDATION_ERROR',
      details: error.message
    });
  }
});

/**
 * GET /auth/profile
 * Get current user profile (requires authentication)
 */
router.get('/profile', jwtAuthMiddleware({ logAuthentication: true }), (req, res) => {
  try {
    const userProfile = {
      success: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        givenName: req.user.givenName,
        familyName: req.user.familyName,
        company: req.user.company,
        role: req.user.role,
        industry: req.user.industry,
        emailVerified: req.user.emailVerified,
        identityProvider: req.user.identityProvider
      },
      token: {
        issuer: req.token.iss,
        audience: req.token.aud,
        expiresAt: req.token.exp,
        issuedAt: req.token.iat,
        policy: req.token.tfp
      },
      session: {
        authenticated: true,
        expiresIn: req.token.exp - Math.floor(Date.now() / 1000)
      }
    };

    res.json(userProfile);

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve user profile',
      code: 'PROFILE_ERROR',
      details: error.message
    });
  }
});

/**
 * POST /auth/logout
 * Logout user (client-side token cleanup)
 */
router.post('/logout', optionalJwtAuthMiddleware(), (req, res) => {
  try {
    const logoutData = {
      success: true,
      message: 'Logout successful',
      redirectUrl: `${process.env.FRONTEND_URL}/`,
      clearTokens: true
    };

    // If user was authenticated, include user info in logout response
    if (req.user) {
      logoutData.user = {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name
      };
      
      console.log(`✅ User logged out: ${req.user.email} (${req.user.id})`);
    }

    res.json(logoutData);

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Logout failed',
      code: 'LOGOUT_ERROR',
      details: error.message
    });
  }
});

/**
 * POST /auth/validate
 * Validate JWT token and return user information
 */
router.post('/validate', strictAuthRateLimit, [
  body('token')
    .notEmpty()
    .withMessage('Token is required')
    .isLength({ min: 10 })
    .withMessage('Token appears to be too short')
], async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Check validation results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors.array()
      });
    }

    const { token } = req.body;
    
    if (config.debugAuth) {
      console.log('🔍 Token validation requested');
    }

    // Validate the token
    const validation = await validateJwtToken(token, {
      endpoint: req.path,
      method: req.method,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      source: 'validation_endpoint'
    });

    const duration = Date.now() - startTime;

    if (validation.valid) {
      // Track successful validation
      if (telemetry) {
        telemetry.trackEvent('TokenValidationSuccess', {
          userId: validation.userProfile.id,
          email: validation.userProfile.email,
          identityProvider: validation.userProfile.identityProvider,
          ip: req.ip,
          userAgent: req.headers['user-agent']
        }, {
          validationDuration: validation.validationDuration,
          totalDuration: duration
        });
      }

      if (config.debugAuth) {
        console.log(`✅ Token validation successful for ${validation.userProfile.email} in ${duration}ms`);
      }

      res.json({
        success: true,
        valid: true,
        user: validation.userProfile,
        token: {
          issuer: validation.payload.iss,
          audience: validation.payload.aud,
          issuedAt: new Date(validation.payload.iat * 1000).toISOString(),
          expiresAt: new Date(validation.payload.exp * 1000).toISOString(),
          subject: validation.payload.sub,
          authTime: validation.payload.auth_time ? new Date(validation.payload.auth_time * 1000).toISOString() : null,
          identityProvider: validation.payload.idp,
          trustFrameworkPolicy: validation.payload.tfp
        },
        validation: {
          duration: validation.validationDuration,
          totalDuration: duration
        }
      });

    } else {
      // Track validation failure
      if (telemetry) {
        telemetry.trackEvent('TokenValidationFailed', {
          errorCode: validation.code,
          error: validation.error,
          ip: req.ip,
          userAgent: req.headers['user-agent']
        }, {
          validationDuration: validation.validationDuration,
          totalDuration: duration
        });
      }

      if (config.debugAuth) {
        console.log(`❌ Token validation failed: ${validation.error} in ${duration}ms`);
      }

      res.status(401).json({
        success: true,
        valid: false,
        error: validation.error,
        code: validation.code,
        validation: {
          duration: validation.validationDuration,
          totalDuration: duration
        }
      });
    }

  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error('Token validation endpoint error:', error);
    
    // Track validation endpoint error
    if (telemetry) {
      telemetry.trackError(error, null, {
        component: 'tokenValidationEndpoint',
        duration: duration,
        ip: req.ip
      });
    }

    res.status(500).json({
      success: false,
      error: 'Token validation service error',
      code: 'VALIDATION_SERVICE_ERROR',
      validation: {
        duration: duration
      }
    });
  }
});

/**
 * GET /auth/jwks-stats
 * Get JWKS cache statistics and performance metrics
 */
router.get('/jwks-stats', authRateLimit, (req, res) => {
  const startTime = Date.now();
  
  try {
    const cacheStats = getJwksCacheStats();
    const duration = Date.now() - startTime;

    // Track JWKS stats request
    if (telemetry) {
      telemetry.trackEvent('JWKSStatsRequested', {
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }, {
        responseTime: duration
      });
    }

    if (config.debugAuth) {
      console.log(`📊 JWKS stats requested from ${req.ip}`);
    }

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      cache: cacheStats,
      performance: {
        responseTime: duration
      },
      endpoints: {
        jwksUri: `https://${config.tenantName}.b2clogin.com/${config.tenantId}/discovery/v2.0/keys?p=${config.signUpSignInPolicy}`,
        issuer: `https://${config.tenantName}.b2clogin.com/${config.tenantId}/v2.0/`,
        metadata: `https://${config.tenantName}.b2clogin.com/${config.tenantName}.onmicrosoft.com/${config.signUpSignInPolicy}/v2.0/.well-known/openid_configuration`
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error('JWKS stats error:', error);
    
    // Track JWKS stats error
    if (telemetry) {
      telemetry.trackError(error, null, {
        component: 'jwksStatsEndpoint',
        duration: duration,
        ip: req.ip
      });
    }

    res.status(500).json({
      success: false,
      error: 'JWKS statistics service error',
      code: 'JWKS_STATS_ERROR',
      performance: {
        responseTime: duration
      }
    });
  }
});

/**
 * GET /auth/status
 * Get authentication status and system health
 */
router.get('/status', optionalJwtAuthMiddleware(), async (req, res) => {
  try {
    const status = {
      success: true,
      authenticated: !!req.user,
      system: {
        azureAdB2C: 'configured',
        jwtValidation: 'enabled',
        rateLimit: 'active',
        timestamp: new Date().toISOString()
      }
    };

    // Include user info if authenticated
    if (req.user) {
      status.user = {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        company: req.user.company,
        role: req.user.role
      };
      
      status.session = {
        expiresIn: req.token.exp - Math.floor(Date.now() / 1000),
        policy: req.token.tfp,
        identityProvider: req.user.identityProvider
      };
    }

    // Include JWKS cache statistics
    try {
      status.system.jwksCache = getJwksCacheStats();
    } catch (error) {
      status.system.jwksCache = 'error';
    }

    res.json(status);

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Status check failed',
      code: 'STATUS_ERROR',
      details: error.message
    });
  }
});

/**
 * GET /auth/health
 * Health check endpoint for authentication system
 */
router.get('/health', (req, res) => {
  try {
    validateConfiguration();
    
    const health = {
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      components: {
        configuration: 'ok',
        azureAdB2C: 'configured',
        jwtValidation: 'enabled',
        rateLimit: 'active'
      }
    };

    res.json(health);

  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: 'Authentication system configuration error',
      code: 'CONFIG_ERROR',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Error handling middleware for authentication routes
 */
router.use((error, req, res, next) => {
  console.error('Authentication route error:', error);

  // Handle specific error types
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Request validation failed',
      code: 'VALIDATION_ERROR',
      details: error.message
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'Token has expired',
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

  // Generic error response
  res.status(500).json({
    success: false,
    error: 'Internal authentication error',
    code: 'INTERNAL_ERROR',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
