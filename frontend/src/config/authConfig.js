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
 */
export const msalConfig = {
  auth: {
    clientId: process.env.REACT_APP_ENTRA_EXTERNAL_ID_CLIENT_ID || '3f1869f7-716b-4885-ac8a-86e78515f3a4',
    // For Entra External ID, we use the tenant domain directly
    authority: `https://login.microsoftonline.com/${process.env.REACT_APP_ENTRA_EXTERNAL_ID_TENANT_ID || 'taktmate.onmicrosoft.com'}`,
    knownAuthorities: ['login.microsoftonline.com'],
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
    'email'
    // Standard Entra External ID scopes - no custom API scopes needed for basic auth
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
  const requiredEnvVars = [
    'REACT_APP_ENTRA_EXTERNAL_ID_CLIENT_ID',
    'REACT_APP_ENTRA_EXTERNAL_ID_TENANT_ID'
  ];

  // Debug: Log all environment variables
  console.log('🔍 Environment variables debug:');
  console.log('CLIENT_ID:', process.env.REACT_APP_ENTRA_EXTERNAL_ID_CLIENT_ID ? 'SET' : 'MISSING');
  console.log('TENANT_ID:', process.env.REACT_APP_ENTRA_EXTERNAL_ID_TENANT_ID ? `SET (${process.env.REACT_APP_ENTRA_EXTERNAL_ID_TENANT_ID})` : 'MISSING');
  console.log('Authority will be:', `https://login.microsoftonline.com/${process.env.REACT_APP_ENTRA_EXTERNAL_ID_TENANT_ID || 'your-tenant.onmicrosoft.com'}`);

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.warn('⚠️ Missing Microsoft Entra External ID environment variables:', missingVars);
    console.warn('The application will use default values, but authentication may not work correctly.');
    console.warn('Please check your .env file and ensure all required variables are set.');
    return false;
  }

  console.log('✅ Microsoft Entra External ID configuration validated');
  return true;
};

// Validate configuration on import
validateConfiguration();
