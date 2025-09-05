/**
 * Microsoft Entra External ID Authentication Configuration
 * 
 * This configuration file contains all the necessary settings for Microsoft Entra External ID
 * authentication integration with the TaktMate frontend application.
 */

import { LogLevel } from '@azure/msal-browser';

/**
 * Configuration object for Microsoft Entra External ID
 * These values should be set based on your Microsoft Entra External ID tenant configuration
 */
export const msalConfig = {
  auth: {
    clientId: process.env.REACT_APP_ENTRA_EXTERNAL_ID_CLIENT_ID || 'your-client-id-here',
    authority: process.env.REACT_APP_ENTRA_EXTERNAL_ID_AUTHORITY || 'https://your-tenant.ciamlogin.com/your-tenant.onmicrosoft.com/B2C_1_signupsignin',
    knownAuthorities: [process.env.REACT_APP_ENTRA_EXTERNAL_ID_KNOWN_AUTHORITY || 'your-tenant.ciamlogin.com'],
    redirectUri: process.env.REACT_APP_REDIRECT_URI || window.location.origin,
    postLogoutRedirectUri: process.env.REACT_APP_POST_LOGOUT_REDIRECT_URI || window.location.origin,
    navigateToLoginRequestUrl: false, // Set to true if you want to return to the page that initiated the login request
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
    // Add any additional scopes your application needs
    process.env.REACT_APP_ENTRA_EXTERNAL_ID_SCOPE || 'https://your-tenant.onmicrosoft.com/your-api/access_as_user'
  ],
};

/**
 * Add here the endpoints and scopes when obtaining an access token for protected web APIs.
 * For more information, see: https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-browser/docs/resources-and-scopes.md
 */
export const protectedResources = {
  taktmateApi: {
    endpoint: process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001',
    scopes: [
      process.env.REACT_APP_ENTRA_EXTERNAL_ID_SCOPE || 'https://your-tenant.onmicrosoft.com/your-api/access_as_user'
    ],
  },
};

/**
 * Policy names for Microsoft Entra External ID user flows
 */
export const b2cPolicies = {
  signUpSignIn: process.env.REACT_APP_ENTRA_EXTERNAL_ID_SIGNUP_SIGNIN_POLICY || 'B2C_1_signupsignin',
  editProfile: process.env.REACT_APP_ENTRA_EXTERNAL_ID_EDIT_PROFILE_POLICY || 'B2C_1_profileediting',
  resetPassword: process.env.REACT_APP_ENTRA_EXTERNAL_ID_RESET_PASSWORD_POLICY || 'B2C_1_passwordreset',
};

/**
 * Authority URLs for different Microsoft Entra External ID policies
 */
export const authorities = {
  signUpSignIn: {
    authority: `https://${process.env.REACT_APP_ENTRA_EXTERNAL_ID_TENANT_NAME || 'your-tenant'}.ciamlogin.com/${process.env.REACT_APP_ENTRA_EXTERNAL_ID_TENANT_NAME || 'your-tenant'}.onmicrosoft.com/${b2cPolicies.signUpSignIn}`,
  },
  editProfile: {
    authority: `https://${process.env.REACT_APP_ENTRA_EXTERNAL_ID_TENANT_NAME || 'your-tenant'}.ciamlogin.com/${process.env.REACT_APP_ENTRA_EXTERNAL_ID_TENANT_NAME || 'your-tenant'}.onmicrosoft.com/${b2cPolicies.editProfile}`,
  },
  resetPassword: {
    authority: `https://${process.env.REACT_APP_ENTRA_EXTERNAL_ID_TENANT_NAME || 'your-tenant'}.ciamlogin.com/${process.env.REACT_APP_ENTRA_EXTERNAL_ID_TENANT_NAME || 'your-tenant'}.onmicrosoft.com/${b2cPolicies.resetPassword}`,
  },
};

/**
 * Configuration validation
 */
export const validateConfiguration = () => {
  const requiredEnvVars = [
    'REACT_APP_ENTRA_EXTERNAL_ID_CLIENT_ID',
    'REACT_APP_ENTRA_EXTERNAL_ID_AUTHORITY',
    'REACT_APP_ENTRA_EXTERNAL_ID_KNOWN_AUTHORITY',
    'REACT_APP_ENTRA_EXTERNAL_ID_TENANT_NAME',
    'REACT_APP_ENTRA_EXTERNAL_ID_SCOPE',
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.warn('⚠️ Missing Microsoft Entra External ID environment variables:', missingVars);
    console.warn('The application will use default values, but authentication may not work correctly.');
    console.warn('Please check your .env file and ensure all required variables are set.');
    return false;
  }

  return true;
};

// Validate configuration on import
validateConfiguration();
