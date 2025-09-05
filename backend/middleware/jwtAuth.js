// JWT Authentication Middleware
// Handles JWT token extraction, validation, and user information extraction

const jwt = require('jsonwebtoken');

/**
 * Create JWT authentication middleware
 * @param {Object} options - Configuration options
 * @param {string[]} options.algorithms - Allowed JWT algorithms
 * @param {string} options.issuer - Expected token issuer
 * @param {string} options.audience - Expected token audience
 * @param {boolean} options.optional - Whether authentication is optional
 * @returns {Function} Express middleware function
 */
function jwtAuthMiddleware(options = {}) {
  const {
    algorithms = ['HS256'],
    issuer = null,
    audience = null,
    optional = false
  } = options;

  return async (req, res, next) => {
    try {
      // Extract token from Authorization header
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
        if (optional) {
          req.user = null;
          req.token = null;
          req.tokenInfo = null;
          return next();
        }
        
        return res.status(401).json({
          success: false,
          error: 'No token provided',
          code: 'NO_TOKEN'
        });
      }

      // Check Bearer format
      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return res.status(401).json({
          success: false,
          error: 'Invalid token format',
          code: 'INVALID_TOKEN_FORMAT'
        });
      }

      const token = parts[1];
      if (!token) {
        if (optional) {
          req.user = null;
          req.token = null;
          req.tokenInfo = null;
          return next();
        }
        
        return res.status(401).json({
          success: false,
          error: 'No token provided',
          code: 'NO_TOKEN'
        });
      }

      // Check if JWT secret is configured
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        return res.status(500).json({
          success: false,
          error: 'Authentication configuration error',
          code: 'AUTH_CONFIG_ERROR'
        });
      }

      // Verify and decode token
      const verifyOptions = {
        algorithms,
        ...(issuer && { issuer }),
        ...(audience && { audience })
      };

      const decoded = jwt.verify(token, jwtSecret, verifyOptions);
      
      // Extract user information from token
      const user = {
        ...decoded,
        id: decoded.sub || decoded.oid || decoded.id, // Normalize user ID
        userId: decoded.sub || decoded.oid || decoded.id
      };

      // Extract token metadata
      const now = Math.floor(Date.now() / 1000);
      const tokenInfo = {
        issuedAt: decoded.iat,
        expiresAt: decoded.exp,
        tokenId: decoded.jti,
        age: decoded.iat ? now - decoded.iat : null,
        remainingTime: decoded.exp ? decoded.exp - now : null
      };

      // Attach to request object
      req.user = user;
      req.token = token;
      req.tokenInfo = tokenInfo;

      next();

    } catch (error) {
      // Handle specific JWT errors
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

      if (error.name === 'NotBeforeError') {
        return res.status(401).json({
          success: false,
          error: 'Token not active',
          code: 'TOKEN_NOT_ACTIVE'
        });
      }

      // Handle other errors
      return res.status(401).json({
        success: false,
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }
  };
}

module.exports = {
  jwtAuthMiddleware
};
