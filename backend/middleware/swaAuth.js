/**
 * Azure Static Web Apps Authentication Middleware
 * 
 * This middleware extracts user information from the x-ms-client-principal header
 * that Azure Static Web Apps provides when using built-in authentication.
 */

const { config } = require('../config/entraExternalId');

// Import Application Insights telemetry (optional)
let telemetry = null;
try {
  const appInsights = require('../config/applicationInsights');
  telemetry = appInsights.telemetry;
} catch (error) {
  // Application Insights not configured or available
  console.log('ℹ️  Application Insights not available for SWA middleware telemetry');
}

/**
 * Azure Static Web Apps Authentication Middleware
 * 
 * This middleware extracts user information from the x-ms-client-principal header
 * that Azure Static Web Apps provides when using built-in authentication.
 */
function swaAuthMiddleware(options = {}) {
  const {
    required = true,
    logAuthentication = true,
    allowAnonymous = false
  } = options;

  return (req, res, next) => {
    try {
      // Get the client principal header from SWA
      const clientPrincipalHeader = req.headers['x-ms-client-principal'];
      
      console.log('🔍 SWA Auth Debug:', {
        hasClientPrincipal: !!clientPrincipalHeader,
        headerLength: clientPrincipalHeader?.length || 0,
        userAgent: req.headers['user-agent']?.substring(0, 50) || 'N/A',
        origin: req.headers.origin || 'N/A',
        referer: req.headers.referer || 'N/A',
        path: req.path,
        method: req.method
      });
      
      if (!clientPrincipalHeader) {
        if (required && !allowAnonymous) {
          console.log('❌ SWA auth - No client principal header found, authentication required');
          return res.status(401).json({
            success: false,
            error: 'Authentication required',
            message: 'No authentication information provided by Azure Static Web Apps'
          });
        }
        
        // No authentication but it's optional
        console.log('ℹ️  SWA auth - No authentication, proceeding as anonymous');
        req.user = null;
        req.userId = null;
        return next();
      }

      try {
        // Decode the base64 encoded client principal
        const clientPrincipal = JSON.parse(
          Buffer.from(clientPrincipalHeader, 'base64').toString('utf8')
        );

        console.log('🔍 SWA Client Principal:', {
          userId: clientPrincipal.userId,
          userDetails: clientPrincipal.userDetails,
          identityProvider: clientPrincipal.identityProvider,
          userRoles: clientPrincipal.userRoles
        });

        // Extract user information in a format compatible with our existing code
        const userProfile = {
          id: clientPrincipal.userId,
          email: clientPrincipal.userDetails,
          name: clientPrincipal.userDetails, // SWA often uses email as the main identifier
          identityProvider: clientPrincipal.identityProvider,
          roles: clientPrincipal.userRoles || [],
          emailVerified: true // SWA handles email verification
        };

        // Set user information on request
        req.user = userProfile;
        req.userId = userProfile.id;
        req.clientPrincipal = clientPrincipal;

        console.log(`✅ SWA auth - User authenticated: ${userProfile.email} (${userProfile.id})`);

        // Track successful authentication in Application Insights
        if (telemetry) {
          telemetry.trackEvent('SWAAuthenticationSuccess', {
            userId: userProfile.id,
            email: userProfile.email,
            identityProvider: userProfile.identityProvider,
            endpoint: req.path,
            method: req.method
          });
        }

        next();

      } catch (decodeError) {
        console.error('❌ Failed to decode SWA client principal:', decodeError.message);
        
        if (required) {
          return res.status(401).json({
            success: false,
            error: 'Authentication failed',
            message: 'Invalid authentication information from Azure Static Web Apps'
          });
        }
        
        req.user = null;
        req.userId = null;
        next();
      }

    } catch (error) {
      console.error('❌ SWA authentication middleware error:', error);
      
      if (telemetry) {
        telemetry.trackError(error, null, {
          component: 'swaAuthMiddleware',
          endpoint: req.path,
          method: req.method
        });
      }
      
      if (required) {
        return res.status(500).json({
          success: false,
          error: 'Authentication system error',
          message: 'Internal authentication error'
        });
      }
      
      req.user = null;
      req.userId = null;
      next();
    }
  };
}

/**
 * Optional SWA Authentication Middleware
 * Same as swaAuthMiddleware but doesn't require authentication
 */
function optionalSwaAuthMiddleware(options = {}) {
  return swaAuthMiddleware({
    ...options,
    required: false,
    allowAnonymous: true
  });
}

module.exports = {
  swaAuthMiddleware,
  optionalSwaAuthMiddleware
};
