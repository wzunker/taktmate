/**
 * Microsoft Entra External ID Authentication Configuration
 * 
 * This configuration file contains all the necessary settings for Microsoft Entra External ID
 * authentication integration with the TaktMate frontend application.
 */

import { LogLevel } from '@azure/msal-browser';

/**
 * Configuration object for Microsoft Entra External ID
 * Simplified configuration that works with current environment variables
 * Updated: 2025-09-06 - Force cache refresh
 */
export const msalConfig = {
  auth: {
    clientId: process.env.REACT_APP_ENTRA_EXTERNAL_ID_CLIENT_ID || '3f1869f7-716b-4885-ac8a-86e78515f3a4',
    // Use External ID authority - environment variable takes precedence, then try multiple formats
    authority: process.env.REACT_APP_ENTRA_EXTERNAL_ID_AUTHORITY || 
               (process.env.REACT_APP_ENTRA_EXTERNAL_ID_TENANT_ID 
                 ? `https://login.microsoftonline.com/${process.env.REACT_APP_ENTRA_EXTERNAL_ID_TENANT_ID}`
                 : `https://taktmate.ciamlogin.com/${process.env.REACT_APP_ENTRA_EXTERNAL_ID_USER_FLOW || 'TaktMateSignUpSignIn'}`),
    knownAuthorities: ['taktmate.ciamlogin.com', 'login.microsoftonline.com'],
    redirectUri: process.env.REACT_APP_REDIRECT_URI || window.location.origin,
    postLogoutRedirectUri: process.env.REACT_APP_POST_LOGOUT_REDIRECT_URI || window.location.origin,
    navigateToLoginRequestUrl: false,
  },
  cache: {
    cacheLocation: 'sessionStorage', // Configures cache location. "sessionStorage" is more secure, but "localStorage" gives you SSO between tabs.
    storeAuthStateInCookie: false, // Set this to "true" if you are having issues on IE11 or Edge
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) {
          return;
        }
        switch (level) {
          case LogLevel.Error:
            console.error(message);
            return;
          case LogLevel.Info:
            console.info(message);
            return;
          case LogLevel.Verbose:
            console.debug(message);
            return;
          case LogLevel.Warning:
            console.warn(message);
            return;
          default:
            return;
        }
      },
      piiLoggingEnabled: false,
      logLevel: process.env.NODE_ENV === 'development' ? LogLevel.Verbose : LogLevel.Error,
    },
    windowHashTimeout: 60000,
    iframeHashTimeout: 6000,
    loadFrameTimeout: 0,
  },
};

/**
 * Scopes you add here will be prompted for user consent during sign-in.
 * By default, MSAL.js will add OIDC scopes (openid, profile, email) to any login request.
 * For more information about OIDC scopes, visit: 
 * https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-permissions-and-consent#openid-connect-scopes
 */
export const loginRequest = {
  scopes: [
    'openid',
    'profile',
    'email',
    // Request token for our application (this sets the correct audience)
    `api://${process.env.REACT_APP_ENTRA_EXTERNAL_ID_CLIENT_ID || '3f1869f7-716b-4885-ac8a-86e78515f3a4'}/access_as_user`
  ],
};

/**
 * Add here the endpoints and scopes when obtaining an access token for protected web APIs.
 * For more information, see: https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-browser/docs/resources-and-scopes.md
 */
export const protectedResources = {
  taktmateApi: {
    endpoint: process.env.REACT_APP_API_URL || 'https://taktmate-backend-api-csheb3aeg8f5bcbv.eastus-01.azurewebsites.net/api',
    scopes: [
      'openid',
      'profile', 
      'email'
      // Standard scopes for Entra External ID - no custom API scopes needed
    ],
  },
};

/**
 * Microsoft Entra External ID uses standard OAuth 2.0/OpenID Connect
 * No custom policies needed - just standard authentication flows
 */

/**
 * Configuration validation
 */
export const validateConfiguration = () => {
  // Debug: Log all environment variables
  console.log('🔍 Environment variables debug:');
  console.log('CLIENT_ID:', process.env.REACT_APP_ENTRA_EXTERNAL_ID_CLIENT_ID ? 'SET' : 'USING DEFAULT');
  console.log('USER_FLOW:', process.env.REACT_APP_ENTRA_EXTERNAL_ID_USER_FLOW ? `SET (${process.env.REACT_APP_ENTRA_EXTERNAL_ID_USER_FLOW})` : 'USING DEFAULT');
  const authority = process.env.REACT_APP_ENTRA_EXTERNAL_ID_AUTHORITY || 
                   (process.env.REACT_APP_ENTRA_EXTERNAL_ID_TENANT_ID 
                     ? `https://login.microsoftonline.com/${process.env.REACT_APP_ENTRA_EXTERNAL_ID_TENANT_ID}`
                     : `https://taktmate.ciamlogin.com/${process.env.REACT_APP_ENTRA_EXTERNAL_ID_USER_FLOW || 'TaktMateSignUpSignIn'}`);
  console.log('Authority will be:', authority);
  console.log('Authority source:', process.env.REACT_APP_ENTRA_EXTERNAL_ID_AUTHORITY ? 'CUSTOM' : 
             process.env.REACT_APP_ENTRA_EXTERNAL_ID_TENANT_ID ? 'TENANT_ID' : 'CIAM_DOMAIN');
  console.log('Redirect URI:', process.env.REACT_APP_REDIRECT_URI || window.location.origin);
  console.log('Known Authorities:', ['taktmate.ciamlogin.com', 'login.microsoftonline.com']);
  console.log('Expected OpenID Config URL:', `${authority}/.well-known/openid_configuration`);

  // For External ID, we have good defaults so we don't require environment variables
  console.log('✅ Microsoft Entra External ID configuration ready (using defaults if env vars missing)');
  return true;
};

// Validate configuration on import
validateConfiguration();
