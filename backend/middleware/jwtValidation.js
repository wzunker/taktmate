/**
 * JWT Token Validation Middleware for Microsoft Entra External ID
 * 
 * This middleware validates JWT tokens issued by Microsoft Entra External ID,
 * extracts user profile information, and provides authentication
 * for protected API endpoints.
 */

const jwt = require('jsonwebtoken');
const axios = require('axios');
const crypto = require('crypto');
const { 
  config, 
  getJwksUri, 
  getIssuerUrl, 
  extractUserProfile,
  isFeatureEnabled 
} = require('../config/entraExternalId');
const { JWTErrorHandler, createAuthError, asyncHandler } = require('../utils/errorHandler');

// Import Application Insights telemetry (optional)
let telemetry = null;
try {
  const appInsights = require('../config/applicationInsights');
  telemetry = appInsights.telemetry;
} catch (error) {
  // Application Insights not configured or available
  if (config.debugAuth) {
    console.log('ℹ️  Application Insights not available for JWT middleware telemetry');
  }
}

/**
 * JWKS Client Configuration with dynamic configuration
 * Note: Caching disabled due to lru-cache compatibility issue in Azure App Service
 */

/**
 * Production-ready JWKS key cache
 * Simple, reliable approach without problematic dependencies
 */
let jwksKeysCache = null;
let jwksCacheExpiry = 0;
const JWKS_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

async function getJwksKeys() {
  // Check cache first
  if (jwksKeysCache && Date.now() < jwksCacheExpiry) {
    if (config.debugJwt) {
      console.log('✅ Using cached JWKS keys');
    }
    return jwksKeysCache;
  }

  try {
    if (config.debugJwt) {
      console.log('🔍 Fetching JWKS keys from:', getJwksUri());
    }
    
    const response = await axios.get(getJwksUri(), {
      timeout: 30000,
      headers: {
        'User-Agent': 'TaktMate-JWT-Validator/1.0'
      }
    });

    jwksKeysCache = response.data.keys;
    jwksCacheExpiry = Date.now() + JWKS_CACHE_DURATION;

    if (config.debugJwt) {
      console.log(`✅ JWKS keys fetched successfully: ${jwksKeysCache.length} keys`);
    }

    // Track JWKS key retrieval in Application Insights
    if (telemetry) {
      telemetry.trackEvent('JWKSKeysRetrieved', {
        keyCount: jwksKeysCache.length.toString(),
        jwksUri: getJwksUri()
      });
    }

    return jwksKeysCache;
  } catch (error) {
    console.error('❌ Failed to fetch JWKS keys:', error.message);
    if (telemetry) {
      telemetry.trackEvent('JWKSKeysFetchFailed', {
        error: error.message,
        jwksUri: getJwksUri()
      });
    }
    throw new Error('JWKS key fetch failed');
  }
}

/**
 * Get signing key for JWT verification using production-ready approach
 */
async function getSigningKey(kid, context = {}) {
  try {
    const keys = await getJwksKeys();
    const key = keys.find(k => k.kid === kid);
    
    if (!key) {
      throw new Error(`Signing key not found for kid: ${kid}`);
    }
    
    // Convert JWK to PEM format
    const publicKey = jwkToPem(key);
    return publicKey;
  } catch (error) {
    // Create specific error for JWKS key retrieval failure
    const jwksError = createAuthError('JWKS_FETCH_ERROR', error, context);
    throw jwksError;
  }
}

// getJwksKeys function is already defined above - removing duplicate

/**
 * Validate JWT token with comprehensive error handling and telemetry
 */
async function validateJwtToken(token, context = {}) {
  const startTime = Date.now();
  
  try {
    // Decode token header to get key ID
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || !decoded.header || !decoded.header.kid) {
      throw createAuthError('MALFORMED_TOKEN', 
        new Error('Invalid token structure or missing key ID'), 
        context);
    }
    
    // Debug logging
    if (config.debugJwt) {
      console.log('🔍 JWT Token validation started:', {
        kid: decoded.header.kid,
        algorithm: decoded.header.alg,
        type: decoded.header.typ
      });
    }
    
    // Get signing key with timing and context
    const keyStartTime = Date.now();
    const signingKey = await getSigningKey(decoded.header.kid, context);
    const keyDuration = Date.now() - keyStartTime;
    
    if (config.debugJwt) {
      console.log(`🔑 Signing key retrieved in ${keyDuration}ms`);
    }
    
    // Verify token with dynamic configuration
    const verifyOptions = {
      algorithms: ['RS256'],
      clockTolerance: config.clockTolerance
    };
    
    // Add issuer validation if enabled
    if (config.validateIssuer) {
      verifyOptions.issuer = getIssuerUrl();
    }
    
    // Add audience validation if enabled
    if (config.validateAudience) {
      verifyOptions.audience = config.clientId;
    }
    
    // Add lifetime validation if enabled
    if (config.validateLifetime) {
      verifyOptions.ignoreExpiration = false;
      verifyOptions.ignoreNotBefore = false;
    } else {
      verifyOptions.ignoreExpiration = true;
      verifyOptions.ignoreNotBefore = true;
    }
    
    const payload = jwt.verify(token, signingKey, verifyOptions);
    const duration = Date.now() - startTime;
    
    // Extract user profile
    const userProfile = extractUserProfile(payload);
    
    // Debug logging for successful validation
    if (config.debugJwt) {
      console.log(`✅ JWT Token validated successfully in ${duration}ms:`, {
        userId: userProfile.id,
        email: userProfile.email,
        issuer: payload.iss,
        audience: payload.aud,
        expiresAt: new Date(payload.exp * 1000).toISOString()
      });
    }
    
    // Track successful validation in Application Insights
    if (telemetry) {
      telemetry.trackEvent('JWTTokenValidated', {
        success: 'true',
        userId: userProfile.id,
        email: userProfile.email,
        identityProvider: userProfile.identityProvider,
        ...context
      }, {
        validationDuration: duration,
        keyRetrievalDuration: keyDuration
      });
    }
    
    return {
      valid: true,
      payload: payload,
      userProfile: userProfile,
      validationDuration: duration
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    // Handle JWT errors with comprehensive error handler
    const jwtError = JWTErrorHandler.handleJWTError(error, context);
    
    // Debug logging for validation errors
    if (config.debugJwt) {
      console.log(`❌ JWT Token validation failed in ${duration}ms:`, {
        error: jwtError.message,
        code: jwtError.errorCode,
        type: jwtError.type,
        originalError: error.message
      });
    }
    
    // Track validation failure in Application Insights
    if (telemetry) {
      telemetry.trackEvent('JWTTokenValidationFailed', {
        success: 'false',
        error: jwtError.message,
        errorCode: jwtError.errorCode,
        errorType: jwtError.type,
        originalError: error.message,
        ...context
      }, {
        validationDuration: duration
      });
    }
    
    // Throw the enhanced error for middleware to handle
    throw jwtError;
  }
}

/**
 * Get error code based on JWT error type
 */
function getErrorCode(error) {
  if (error.name === 'TokenExpiredError') {
    return 'TOKEN_EXPIRED';
  } else if (error.name === 'JsonWebTokenError') {
    if (error.message.includes('invalid issuer')) {
      return 'INVALID_ISSUER';
    } else if (error.message.includes('invalid audience')) {
      return 'INVALID_AUDIENCE';
    } else if (error.message.includes('invalid signature')) {
      return 'INVALID_SIGNATURE';
    }
    return 'INVALID_TOKEN';
  } else if (error.name === 'NotBeforeError') {
    return 'TOKEN_NOT_ACTIVE';
  }
  return 'TOKEN_VALIDATION_ERROR';
}

/**
 * Extract token from request
 */
function extractTokenFromRequest(req) {
  // Check Authorization header (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Check query parameter (for testing/development)
  if (req.query.token) {
    return req.query.token;
  }
  
  // Check session (if using session-based auth)
  if (req.session && req.session.token) {
    return req.session.token;
  }
  
  return null;
}

/**
 * JWT Authentication Middleware with comprehensive error handling
 */
function jwtAuthMiddleware(options = {}) {
  return asyncHandler(async (req, res, next) => {
    const startTime = Date.now();
    
    // Production debugging for JWT authentication
    if (config.debugJwt) {
      console.log('🔍 JWT Auth: Processing request for:', req.method, req.path);
      console.log('🔍 JWT Auth: Authorization header:', req.headers.authorization ? 'Present' : 'Missing');
      console.log('🔍 JWT Auth: Origin:', req.headers.origin);
    }
    
    // Extract token from request
    const token = extractTokenFromRequest(req);
    
    if (!token) {
      if (config.debugJwt) {
        console.log('❌ JWT Auth: No token found in request headers');
      }
      // Track missing token event
      if (telemetry) {
        telemetry.trackEvent('AuthenticationFailed', {
          reason: 'missing_token',
          endpoint: req.path,
          method: req.method,
          userAgent: req.headers['user-agent'],
          ip: req.ip
        });
      }
      
      throw createAuthError('AUTHENTICATION_REQUIRED', null, req);
    }
    
    // Create context for validation
    const context = {
      requestId: req.id || req.headers['x-request-id'],
      userId: req.user?.id,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress,
      endpoint: req.path,
      method: req.method
    };
    
    // Validate token with context - use try-catch to prevent crashes
    if (config.debugJwt) {
      console.log('🔍 JWT Auth: Starting token validation...');
    }
    
    let validation;
    try {
      validation = await validateJwtToken(token, context);
      
      if (config.debugJwt) {
        console.log('✅ JWT Auth: Token validation successful for user:', validation.userProfile?.email || validation.userProfile?.id);
      }
      
      // Add user information to request
      req.user = validation.userProfile;
      req.token = validation.payload;
      req.userId = validation.userProfile.id;
      req.authDuration = validation.validationDuration;
    } catch (validationError) {
      if (config.debugJwt) {
        console.log('❌ JWT Auth: Token validation failed:', validationError.message);
      }
      
      // Don't crash the server - return 401 instead
      return res.status(401).json({
        success: false,
        error: 'Token validation failed',
        message: 'Invalid or expired token',
        code: 'TOKEN_VALIDATION_FAILED'
      });
    }
    
    // Track successful authentication
    const duration = Date.now() - startTime;
    
    if (telemetry) {
      telemetry.trackAuthentication(
        validation.userProfile.id,
        validation.userProfile.email,
        validation.userProfile.identityProvider,
        true,
        duration
      );
    }
    
    // Log successful authentication (optional)
    if (options.logAuthentication || config.debugAuth) {
      console.log(`✅ User authenticated: ${validation.userProfile.email} (${validation.userProfile.id}) in ${duration}ms`);
    }
    
    next();
  });
}

/**
 * Optional JWT Authentication Middleware with enhanced error handling
 * Validates token if present, but doesn't require it
 */
function optionalJwtAuthMiddleware(options = {}) {
  return async (req, res, next) => {
    try {
      const token = extractTokenFromRequest(req);
      
      if (!token) {
        // No token provided, continue without authentication
        req.user = null;
        req.token = null;
        req.userId = null;
        return next();
      }
      
      // Create context for validation
      const context = {
        requestId: req.id || req.headers['x-request-id'],
        userAgent: req.headers['user-agent'],
        ip: req.ip || req.connection.remoteAddress,
        endpoint: req.path,
        method: req.method,
        optional: true
      };
      
      try {
        // Validate token - this will throw TaktMateError on failure
        const validation = await validateJwtToken(token, context);
        
        // Valid token, add user information
        req.user = validation.userProfile;
        req.token = validation.payload;
        req.userId = validation.userProfile.id;
        req.authDuration = validation.validationDuration;
        
        if (options.logAuthentication || config.debugAuth) {
          console.log(`✅ Optional auth - User authenticated: ${validation.userProfile.email} (${validation.userProfile.id})`);
        }
        
      } catch (jwtError) {
        // Invalid token, log but continue without authentication
        if (options.logInvalidTokens || config.debugAuth) {
          console.warn(`❌ Optional auth - Invalid token: ${jwtError.userMessage}`);
        }
        
        // Track optional authentication failure
        if (telemetry) {
          telemetry.trackEvent('OptionalAuthenticationFailed', {
            reason: jwtError.errorCode,
            endpoint: req.path,
            method: req.method,
            userAgent: req.headers['user-agent'],
            ip: req.ip
          });
        }
        
        req.user = null;
        req.token = null;
        req.userId = null;
      }
      
      next();
      
    } catch (error) {
      // Unexpected error in optional middleware - log but continue
      console.error('Optional JWT middleware unexpected error:', error);
      
      if (telemetry) {
        telemetry.trackError(error, null, {
          component: 'optionalJwtAuthMiddleware',
          endpoint: req.path,
          method: req.method
        });
      }
      
      // For optional auth, continue even on unexpected errors
      req.user = null;
      req.token = null;
      req.userId = null;
      next();
    }
  };
}

/**
 * Email Verification Required Middleware with enhanced error handling
 * Requires user to have verified email
 */
function requireEmailVerification() {
  return (req, res, next) => {
    if (!req.user) {
      const error = createAuthError('AUTHENTICATION_REQUIRED', null, req);
      return next(error);
    }
    
    if (!req.user.emailVerified) {
      const error = createAuthError('INSUFFICIENT_PERMISSIONS', 
        new Error('Email verification required'), 
        req);
      error.userMessage = 'Email verification required to access this feature';
      error.guidance = 'Please verify your email address to continue';
      error.action = 'verify_email';
      return next(error);
    }
    
    next();
  };
}

/**
 * Role-based Authorization Middleware with enhanced error handling
 * Requires user to have specific role
 */
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      const error = createAuthError('AUTHENTICATION_REQUIRED', null, req);
      return next(error);
    }
    
    const userRole = req.user.role;
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    
    if (!userRole || !roles.includes(userRole)) {
      const error = createAuthError('INSUFFICIENT_PERMISSIONS', 
        new Error(`Role '${userRole}' not in allowed roles: ${roles.join(', ')}`), 
        req);
      error.userMessage = 'You do not have the required permissions for this action';
      error.guidance = `This feature requires one of the following roles: ${roles.join(', ')}. Your current role is: ${userRole || 'none'}`;
      error.action = 'contact_support';
      
      // Add role information to error context
      error.context.additionalContext.requiredRoles = roles;
      error.context.additionalContext.userRole = userRole;
      
      return next(error);
    }
    
    next();
  };
}

/**
 * Company-based Authorization Middleware with enhanced error handling
 * Requires user to belong to specific company
 */
function requireCompany(allowedCompanies) {
  return (req, res, next) => {
    if (!req.user) {
      const error = createAuthError('AUTHENTICATION_REQUIRED', null, req);
      return next(error);
    }
    
    const userCompany = req.user.company;
    const companies = Array.isArray(allowedCompanies) ? allowedCompanies : [allowedCompanies];
    
    if (!userCompany || !companies.includes(userCompany)) {
      const error = createAuthError('INSUFFICIENT_PERMISSIONS', 
        new Error(`Company '${userCompany}' not in allowed companies: ${companies.join(', ')}`), 
        req);
      error.userMessage = 'Access restricted to specific companies';
      error.guidance = `This feature is only available to users from: ${companies.join(', ')}. Your company is: ${userCompany || 'none'}`;
      error.action = 'contact_support';
      
      // Add company information to error context
      error.context.additionalContext.requiredCompanies = companies;
      error.context.additionalContext.userCompany = userCompany;
      
      return next(error);
    }
    
    next();
  };
}

/**
 * Clear JWKS cache (for testing or key rotation)
 */
function clearJwksCache() {
  if (jwksClientInstance && typeof jwksClientInstance.clearCache === 'function') {
    jwksClientInstance.clearCache();
  }
}

/**
 * Get cache statistics
 */
function getJwksCacheStats() {
  // jwks-client doesn't expose cache stats directly
  // Return basic information about the client configuration
  return {
    hasKeys: true, // Assume keys are available if client is configured
    keyCount: 'unknown', // jwks-client doesn't expose this
    lastFetch: 'managed by jwks-client',
    age: 'managed by jwks-client',
    ttl: 24 * 60 * 60 * 1000, // 24 hours as configured
    cacheMaxEntries: 5,
    requestsPerMinute: 10
  };
}

/**
 * Convert JWK to PEM format for jsonwebtoken library
 * Production-ready implementation without external dependencies
 */
function jwkToPem(jwk) {
  if (jwk.kty !== 'RSA') {
    throw new Error('Only RSA keys are supported');
  }

  try {
    // Use Node.js built-in crypto module for reliable key conversion
    const publicKey = crypto.createPublicKey({
      key: {
        kty: jwk.kty,
        n: jwk.n,
        e: jwk.e
      },
      format: 'jwk'
    });

    return publicKey.export({
      type: 'spki',
      format: 'pem'
    });
  } catch (error) {
    console.error('❌ Failed to convert JWK to PEM:', error.message);
    throw new Error('JWK to PEM conversion failed');
  }
}

module.exports = {
  jwtAuthMiddleware,
  optionalJwtAuthMiddleware,
  requireEmailVerification,
  requireRole,
  requireCompany,
  validateJwtToken,
  extractTokenFromRequest,
  getJwksKeys,
  clearJwksCache,
  getJwksCacheStats,
  jwkToPem
};
