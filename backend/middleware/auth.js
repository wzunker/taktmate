/**
 * Azure Static Web Apps Authentication Middleware
 * 
 * This middleware parses the x-ms-client-principal header that Azure Static Web Apps
 * automatically injects into requests when users are authenticated through External ID.
 * 
 * SWA handles all token validation, so we just need to parse the user information
 * from the header and make it available to our route handlers.
 */

/**
 * Middleware to require authentication via Azure Static Web Apps
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object  
 * @param {Function} next - Express next function
 */
function requireAuth(req, res, next) {
  try {
    // LOCAL DEVELOPMENT BYPASS - Multiple safety checks
    console.log('🔍 Auth Debug:', {
      LOCAL_DEVELOPMENT: process.env.LOCAL_DEVELOPMENT,
      NODE_ENV: process.env.NODE_ENV,
      hostname: req.hostname,
      host: req.headers.host
    });
    
    if (process.env.LOCAL_DEVELOPMENT === 'true' && 
        process.env.NODE_ENV === 'development' && 
        (req.hostname === 'localhost' || req.hostname === '127.0.0.1')) {
      
      console.log('🔧 Using mock user for local development');
      req.user = {
        id: 'local-dev-user',
        email: 'dev@localhost',
        name: 'Local Developer',
        identityProvider: 'local-mock',
        roles: ['authenticated'],
        claims: []
      };
      return next();
    }

    // Get the SWA client principal header
    const clientPrincipalHeader = req.headers['x-ms-client-principal'];
    
    // If no header is present, the user is not authenticated
    if (!clientPrincipalHeader) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Please log in to access this resource'
      });
    }

    // Decode the base64-encoded JSON
    const clientPrincipalEncoded = Buffer.from(clientPrincipalHeader, 'base64');
    const clientPrincipalDecoded = clientPrincipalEncoded.toString('utf8');
    
    // Parse the JSON to get user information
    const clientPrincipal = JSON.parse(clientPrincipalDecoded);
    
    // Validate that we have the expected user information
    if (!clientPrincipal || !clientPrincipal.userId) {
      return res.status(401).json({ 
        error: 'Invalid authentication',
        message: 'Authentication data is malformed'
      });
    }

    // Attach user information to the request object
    req.user = {
      id: clientPrincipal.userId,
      email: clientPrincipal.userDetails,
      name: clientPrincipal.userDetails, // Often the same as email for External ID
      identityProvider: clientPrincipal.identityProvider,
      roles: clientPrincipal.userRoles || ['authenticated'],
      claims: clientPrincipal.claims || []
    };

    // Continue to the next middleware/route handler
    next();

  } catch (error) {
    console.error('Authentication middleware error:', error.message);
    return res.status(401).json({ 
      error: 'Authentication failed',
      message: 'Unable to process authentication information'
    });
  }
}

/**
 * Optional middleware to extract user information without requiring authentication
 * Useful for endpoints that work for both authenticated and anonymous users
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function optionalAuth(req, res, next) {
  try {
    const clientPrincipalHeader = req.headers['x-ms-client-principal'];
    
    if (clientPrincipalHeader) {
      const clientPrincipalEncoded = Buffer.from(clientPrincipalHeader, 'base64');
      const clientPrincipalDecoded = clientPrincipalEncoded.toString('utf8');
      const clientPrincipal = JSON.parse(clientPrincipalDecoded);
      
      if (clientPrincipal && clientPrincipal.userId) {
        req.user = {
          id: clientPrincipal.userId,
          email: clientPrincipal.userDetails,
          name: clientPrincipal.userDetails,
          identityProvider: clientPrincipal.identityProvider,
          roles: clientPrincipal.userRoles || ['authenticated'],
          claims: clientPrincipal.claims || []
        };
      }
    }
    
    // Always continue, whether user is authenticated or not
    next();

  } catch (error) {
    console.error('Optional auth middleware error:', error.message);
    // Don't fail the request, just continue without user info
    next();
  }
}

/**
 * Utility function to check if user has a specific role
 * 
 * @param {Object} user - User object from req.user
 * @param {string} role - Role to check for
 * @returns {boolean} - True if user has the role
 */
function hasRole(user, role) {
  return user && user.roles && user.roles.includes(role);
}

/**
 * Middleware factory to require a specific role
 * 
 * @param {string} requiredRole - Role that the user must have
 * @returns {Function} - Express middleware function
 */
function requireRole(requiredRole) {
  return (req, res, next) => {
    // First ensure the user is authenticated
    requireAuth(req, res, (err) => {
      if (err) return next(err);
      
      // Check if user has the required role
      if (!hasRole(req.user, requiredRole)) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: `This resource requires the '${requiredRole}' role`
        });
      }
      
      next();
    });
  };
}

/**
 * Utility function to get user display name from claims
 * 
 * @param {Object} user - User object from req.user
 * @returns {string} - User's display name
 */
function getUserDisplayName(user) {
  if (!user || !user.claims) return user?.name || user?.email || 'User';
  
  // Try to find name claim
  const nameClaim = user.claims.find(claim => 
    claim.typ === 'name' || 
    claim.typ === 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name' ||
    claim.typ === 'preferred_username'
  );
  
  return nameClaim ? nameClaim.val : (user.name || user.email || 'User');
}

module.exports = {
  requireAuth,
  optionalAuth,
  requireRole,
  hasRole,
  getUserDisplayName
};
