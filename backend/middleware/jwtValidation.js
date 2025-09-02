/**
 * JWT Token Validation Middleware for Azure AD B2C
 * 
 * This middleware validates JWT tokens issued by Azure AD B2C,
 * extracts user profile information, and provides authentication
 * for protected API endpoints.
 */

const jwt = require('jsonwebtoken');
const https = require('https');
const { 
  config, 
  getJwksUri, 
  getIssuerUrl, 
  extractUserProfile 
} = require('../config/azureAdB2C');

/**
 * JWKS key cache
 */
let jwksCache = {
  keys: null,
  lastFetch: null,
  ttl: 24 * 60 * 60 * 1000 // 24 hours
};

/**
 * Fetch JWKS keys from Azure AD B2C
 */
async function fetchJwksKeys() {
  return new Promise((resolve, reject) => {
    const jwksUri = getJwksUri();
    
    https.get(jwksUri, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const jwks = JSON.parse(data);
          resolve(jwks.keys || []);
        } catch (error) {
          reject(new Error(`Failed to parse JWKS: ${error.message}`));
        }
      });
    }).on('error', (error) => {
      reject(new Error(`JWKS fetch failed: ${error.message}`));
    });
  });
}

/**
 * Get JWKS keys with caching
 */
async function getJwksKeys() {
  const now = Date.now();
  
  // Check if cache is valid
  if (jwksCache.keys && jwksCache.lastFetch && (now - jwksCache.lastFetch) < jwksCache.ttl) {
    return jwksCache.keys;
  }
  
  try {
    const keys = await fetchJwksKeys();
    jwksCache.keys = keys;
    jwksCache.lastFetch = now;
    return keys;
  } catch (error) {
    // If fetch fails and we have cached keys, use them
    if (jwksCache.keys) {
      console.warn('JWKS fetch failed, using cached keys:', error.message);
      return jwksCache.keys;
    }
    throw error;
  }
}

/**
 * Convert JWK to PEM format for JWT verification
 */
function jwkToPem(jwk) {
  // This is a simplified implementation
  // In production, consider using a library like jwk-to-pem
  if (jwk.kty === 'RSA' && jwk.n && jwk.e) {
    // For now, we'll rely on the jsonwebtoken library's built-in JWK support
    return jwk;
  }
  throw new Error('Unsupported JWK format');
}

/**
 * Get signing key for JWT verification
 */
async function getSigningKey(kid) {
  try {
    const keys = await getJwksKeys();
    const key = keys.find(k => k.kid === kid);
    
    if (!key) {
      throw new Error(`Unable to find key with kid: ${kid}`);
    }
    
    return jwkToPem(key);
  } catch (error) {
    throw new Error(`Failed to get signing key: ${error.message}`);
  }
}

/**
 * Validate JWT token
 */
async function validateJwtToken(token) {
  try {
    // Decode token header to get key ID
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || !decoded.header || !decoded.header.kid) {
      throw new Error('Invalid token structure or missing key ID');
    }
    
    // Get signing key
    const signingKey = await getSigningKey(decoded.header.kid);
    
    // Verify token
    const verifyOptions = {
      issuer: getIssuerUrl(),
      audience: config.clientId,
      algorithms: ['RS256'],
      clockTolerance: config.clockTolerance || 300
    };
    
    if (!config.validateIssuer) {
      delete verifyOptions.issuer;
    }
    
    if (!config.validateAudience) {
      delete verifyOptions.audience;
    }
    
    const payload = jwt.verify(token, signingKey, verifyOptions);
    
    return {
      valid: true,
      payload: payload,
      userProfile: extractUserProfile(payload)
    };
    
  } catch (error) {
    return {
      valid: false,
      error: error.message,
      code: getErrorCode(error)
    };
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
 * JWT Authentication Middleware
 */
function jwtAuthMiddleware(options = {}) {
  return async (req, res, next) => {
    try {
      // Extract token from request
      const token = extractTokenFromRequest(req);
      
      if (!token) {
        return res.status(401).json({
          success: false,
          error: 'No authentication token provided',
          code: 'MISSING_TOKEN'
        });
      }
      
      // Validate token
      const validation = await validateJwtToken(token);
      
      if (!validation.valid) {
        return res.status(401).json({
          success: false,
          error: 'Invalid authentication token',
          code: validation.code,
          details: options.includeErrorDetails ? validation.error : undefined
        });
      }
      
      // Add user information to request
      req.user = validation.userProfile;
      req.token = validation.payload;
      req.userId = validation.userProfile.id;
      
      // Log successful authentication (optional)
      if (options.logAuthentication) {
        console.log(`✅ User authenticated: ${validation.userProfile.email} (${validation.userProfile.id})`);
      }
      
      next();
      
    } catch (error) {
      console.error('JWT middleware error:', error);
      
      return res.status(500).json({
        success: false,
        error: 'Authentication service error',
        code: 'AUTH_SERVICE_ERROR'
      });
    }
  };
}

/**
 * Optional JWT Authentication Middleware
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
      
      // Validate token
      const validation = await validateJwtToken(token);
      
      if (validation.valid) {
        // Valid token, add user information
        req.user = validation.userProfile;
        req.token = validation.payload;
        req.userId = validation.userProfile.id;
        
        if (options.logAuthentication) {
          console.log(`✅ User authenticated: ${validation.userProfile.email} (${validation.userProfile.id})`);
        }
      } else {
        // Invalid token, log but continue
        if (options.logInvalidTokens) {
          console.warn(`❌ Invalid token: ${validation.error}`);
        }
        req.user = null;
        req.token = null;
        req.userId = null;
      }
      
      next();
      
    } catch (error) {
      console.error('Optional JWT middleware error:', error);
      
      // For optional auth, continue even on errors
      req.user = null;
      req.token = null;
      req.userId = null;
      next();
    }
  };
}

/**
 * Email Verification Required Middleware
 * Requires user to have verified email
 */
function requireEmailVerification() {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      });
    }
    
    if (!req.user.emailVerified) {
      return res.status(403).json({
        success: false,
        error: 'Email verification required',
        code: 'EMAIL_VERIFICATION_REQUIRED',
        hint: 'Please verify your email address to access this feature'
      });
    }
    
    next();
  };
}

/**
 * Role-based Authorization Middleware
 * Requires user to have specific role
 */
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      });
    }
    
    const userRole = req.user.role;
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    
    if (!userRole || !roles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: roles,
        current: userRole
      });
    }
    
    next();
  };
}

/**
 * Company-based Authorization Middleware
 * Requires user to belong to specific company
 */
function requireCompany(allowedCompanies) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      });
    }
    
    const userCompany = req.user.company;
    const companies = Array.isArray(allowedCompanies) ? allowedCompanies : [allowedCompanies];
    
    if (!userCompany || !companies.includes(userCompany)) {
      return res.status(403).json({
        success: false,
        error: 'Company access restricted',
        code: 'COMPANY_ACCESS_RESTRICTED',
        required: companies,
        current: userCompany
      });
    }
    
    next();
  };
}

/**
 * Clear JWKS cache (for testing or key rotation)
 */
function clearJwksCache() {
  jwksCache.keys = null;
  jwksCache.lastFetch = null;
}

/**
 * Get cache statistics
 */
function getJwksCacheStats() {
  return {
    hasKeys: !!jwksCache.keys,
    keyCount: jwksCache.keys ? jwksCache.keys.length : 0,
    lastFetch: jwksCache.lastFetch,
    age: jwksCache.lastFetch ? Date.now() - jwksCache.lastFetch : null,
    ttl: jwksCache.ttl
  };
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
  getJwksCacheStats
};
