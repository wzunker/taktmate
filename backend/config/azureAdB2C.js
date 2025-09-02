/**
 * Azure AD B2C Configuration for TaktMate
 * 
 * This module provides configuration settings and utilities for integrating
 * with Azure Active Directory B2C for user authentication and authorization.
 */

/**
 * Azure AD B2C Configuration Object
 * 
 * Contains all necessary configuration for connecting to Azure AD B2C tenant
 * and validating JWT tokens issued by the service.
 */
const azureAdB2CConfig = {
  // Tenant Configuration
  tenantName: process.env.AZURE_AD_B2C_TENANT_NAME || 'taktmate',
  tenantId: process.env.AZURE_AD_B2C_TENANT_ID,
  domain: process.env.AZURE_AD_B2C_DOMAIN || 'taktmate.b2clogin.com',
  
  // Application Registration Details
  clientId: process.env.AZURE_AD_B2C_CLIENT_ID,
  clientSecret: process.env.AZURE_AD_B2C_CLIENT_SECRET,
  
  // User Flow/Policy Configuration
  signUpSignInPolicy: process.env.AZURE_AD_B2C_SIGN_UP_SIGN_IN_POLICY || 'B2C_1_signupsignin1',
  passwordResetPolicy: process.env.AZURE_AD_B2C_PASSWORD_RESET_POLICY || 'B2C_1_passwordreset1',
  profileEditPolicy: process.env.AZURE_AD_B2C_PROFILE_EDIT_POLICY || 'B2C_1_profileedit1',
  
  // Token Configuration
  scope: process.env.AZURE_AD_B2C_SCOPE || 'openid profile email',
  
  // Redirect URLs
  redirectUri: process.env.AZURE_AD_B2C_REDIRECT_URI || 'http://localhost:3000/auth/callback',
  postLogoutRedirectUri: process.env.AZURE_AD_B2C_POST_LOGOUT_REDIRECT_URI || 'http://localhost:3000',
  
  // Application URLs
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  backendUrl: process.env.BACKEND_URL || 'http://localhost:3001',
  
  // JWT Validation Settings
  validateIssuer: true,
  validateAudience: true,
  validateLifetime: true,
  clockTolerance: 300, // 5 minutes in seconds
  
  // Custom Claims Configuration
  customClaims: {
    company: 'extension_Company',
    role: 'extension_Role',
    industry: 'extension_Industry'
  },
  
  // Custom Policy Configuration (if using custom policies instead of user flows)
  useCustomPolicies: process.env.AZURE_AD_B2C_USE_CUSTOM_POLICIES === 'true',
  customPolicySignUpSignIn: process.env.AZURE_AD_B2C_CUSTOM_POLICY_SIGNUP_SIGNIN || 'B2C_1A_TaktMate_SignUpOrSignIn',
  customPolicyPasswordReset: process.env.AZURE_AD_B2C_CUSTOM_POLICY_PASSWORD_RESET || 'B2C_1A_TaktMate_PasswordReset',
  customPolicyProfileEdit: process.env.AZURE_AD_B2C_CUSTOM_POLICY_PROFILE_EDIT || 'B2C_1A_TaktMate_ProfileEdit'
};

/**
 * Get the metadata URL for the Azure AD B2C tenant
 * Used for JWT token validation and discovering endpoint information
 * 
 * @returns {string} The OpenID Connect metadata URL
 */
function getMetadataUrl() {
  const { domain, tenantName, signUpSignInPolicy } = azureAdB2CConfig;
  return `https://${domain}/${tenantName}.onmicrosoft.com/${signUpSignInPolicy}/v2.0/.well-known/openid_configuration`;
}

/**
 * Get the authority URL for the Azure AD B2C tenant
 * Used for token validation and authentication flows
 * 
 * @returns {string} The authority URL
 */
function getAuthorityUrl() {
  const { domain, tenantName, signUpSignInPolicy } = azureAdB2CConfig;
  return `https://${domain}/${tenantName}.onmicrosoft.com/${signUpSignInPolicy}`;
}

/**
 * Get the issuer URL for JWT token validation
 * This is the expected 'iss' claim value in JWT tokens
 * 
 * @returns {string} The issuer URL
 */
function getIssuerUrl() {
  const { domain, tenantName, signUpSignInPolicy, tenantId } = azureAdB2CConfig;
  return `https://${domain}/${tenantId}/v2.0/`;
}

/**
 * Get the JWKS (JSON Web Key Set) URI for token signature validation
 * 
 * @returns {string} The JWKS URI
 */
function getJwksUri() {
  const { domain, tenantName, signUpSignInPolicy } = azureAdB2CConfig;
  return `https://${domain}/${tenantName}.onmicrosoft.com/${signUpSignInPolicy}/discovery/v2.0/keys`;
}

/**
 * Validate that all required environment variables are set
 * 
 * @throws {Error} If required configuration is missing
 */
function validateConfiguration() {
  const required = [
    'AZURE_AD_B2C_TENANT_ID',
    'AZURE_AD_B2C_CLIENT_ID'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required Azure AD B2C environment variables: ${missing.join(', ')}\n` +
      'Please check your .env file and ensure all required variables are set.\n' +
      'See AZURE_AD_B2C_SETUP.md for configuration details.'
    );
  }
  
  // Validate URL formats
  try {
    new URL(azureAdB2CConfig.redirectUri);
    new URL(azureAdB2CConfig.postLogoutRedirectUri);
    new URL(azureAdB2CConfig.frontendUrl);
    new URL(azureAdB2CConfig.backendUrl);
  } catch (error) {
    throw new Error(`Invalid URL format in Azure AD B2C configuration: ${error.message}`);
  }
}

/**
 * Extract user profile information from Azure AD B2C JWT token claims
 * 
 * @param {Object} tokenPayload - Decoded JWT token payload
 * @returns {Object} User profile object
 */
function extractUserProfile(tokenPayload) {
  const profile = {
    id: tokenPayload.sub || tokenPayload.oid,
    email: tokenPayload.emails?.[0] || tokenPayload.email,
    name: tokenPayload.name || `${tokenPayload.given_name || ''} ${tokenPayload.family_name || ''}`.trim(),
    givenName: tokenPayload.given_name,
    familyName: tokenPayload.family_name,
    // Custom claims - check both extension format and custom policy format
    company: tokenPayload[azureAdB2CConfig.customClaims.company] || tokenPayload.company || '',
    role: tokenPayload[azureAdB2CConfig.customClaims.role] || tokenPayload.jobTitle || '',
    industry: tokenPayload[azureAdB2CConfig.customClaims.industry] || tokenPayload.industry || '',
    emailVerified: tokenPayload.email_verified || false,
    identityProvider: tokenPayload.idp || tokenPayload.identityProvider,
    // Token metadata
    issuer: tokenPayload.iss,
    audience: tokenPayload.aud,
    issuedAt: tokenPayload.iat,
    expiresAt: tokenPayload.exp,
    notBefore: tokenPayload.nbf
  };
  
  // Clean up empty values
  Object.keys(profile).forEach(key => {
    if (profile[key] === undefined || profile[key] === null || profile[key] === '') {
      if (key !== 'company' && key !== 'role' && key !== 'industry') { // Keep these as empty strings
        delete profile[key];
      }
    }
  });
  
  return profile;
}

/**
 * Generate login URL for Azure AD B2C
 * 
 * @param {string} state - Optional state parameter for CSRF protection
 * @param {string} nonce - Optional nonce parameter for replay protection
 * @param {string} policy - Optional policy name (defaults to sign-up/sign-in policy)
 * @returns {string} The complete login URL
 */
function generateLoginUrl(state = '', nonce = '', policy = null) {
  const { domain, tenantName, signUpSignInPolicy, clientId, redirectUri, scope } = azureAdB2CConfig;
  const policyName = policy || signUpSignInPolicy;
  
  const params = new URLSearchParams({
    'client_id': clientId,
    'response_type': 'code',
    'redirect_uri': redirectUri,
    'response_mode': 'form_post',
    'scope': scope,
    'state': state,
    'nonce': nonce
  });
  
  return `https://${domain}/${tenantName}.onmicrosoft.com/${policyName}/oauth2/v2.0/authorize?${params.toString()}`;
}

/**
 * Generate password reset URL for Azure AD B2C
 * 
 * @param {string} state - Optional state parameter for CSRF protection
 * @param {string} nonce - Optional nonce parameter for replay protection
 * @returns {string} The complete password reset URL
 */
function generatePasswordResetUrl(state = '', nonce = '') {
  return generateLoginUrl(state, nonce, azureAdB2CConfig.passwordResetPolicy);
}

/**
 * Generate profile edit URL for Azure AD B2C
 * 
 * @param {string} state - Optional state parameter for CSRF protection
 * @param {string} nonce - Optional nonce parameter for replay protection
 * @returns {string} The complete profile edit URL
 */
function generateProfileEditUrl(state = '', nonce = '') {
  return generateLoginUrl(state, nonce, azureAdB2CConfig.profileEditPolicy);
}

/**
 * Generate logout URL for Azure AD B2C
 * 
 * @returns {string} The complete logout URL
 */
function generateLogoutUrl() {
  const { domain, tenantName, signUpSignInPolicy, postLogoutRedirectUri } = azureAdB2CConfig;
  
  const params = new URLSearchParams({
    'post_logout_redirect_uri': postLogoutRedirectUri
  });
  
  return `https://${domain}/${tenantName}.onmicrosoft.com/${signUpSignInPolicy}/oauth2/v2.0/logout?${params.toString()}`;
}

/**
 * Get configuration object for passport-azure-ad strategy
 * 
 * @returns {Object} Passport strategy configuration
 */
function getPassportConfig() {
  return {
    identityMetadata: getMetadataUrl(),
    clientID: azureAdB2CConfig.clientId,
    responseType: 'code id_token',
    responseMode: 'form_post',
    redirectUrl: azureAdB2CConfig.redirectUri,
    allowHttpForRedirectUrl: process.env.NODE_ENV === 'development',
    clientSecret: azureAdB2CConfig.clientSecret,
    validateIssuer: azureAdB2CConfig.validateIssuer,
    isB2C: true,
    issuer: getIssuerUrl(),
    passReqToCallback: true,
    scope: azureAdB2CConfig.scope.split(' '),
    loggingLevel: process.env.NODE_ENV === 'development' ? 'info' : 'warn',
    nonceLifetime: 600, // 10 minutes
    nonceMaxAmount: 5,
    useCookieInsteadOfSession: false,
    cookieEncryptionKeys: [
      { 'key': process.env.COOKIE_ENCRYPTION_KEY || 'default-key-change-in-production', 'iv': process.env.COOKIE_ENCRYPTION_IV || 'default-iv-change-in-production' }
    ]
  };
}

// Validate configuration on module load (except in test environment)
if (process.env.NODE_ENV !== 'test') {
  try {
    validateConfiguration();
  } catch (error) {
    console.error('Azure AD B2C Configuration Error:', error.message);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1); // Fail fast in production
    }
  }
}

module.exports = {
  config: azureAdB2CConfig,
  getMetadataUrl,
  getAuthorityUrl,
  getIssuerUrl,
  getJwksUri,
  validateConfiguration,
  extractUserProfile,
  generateLoginUrl,
  generatePasswordResetUrl,
  generateProfileEditUrl,
  generateLogoutUrl,
  getPassportConfig
};
