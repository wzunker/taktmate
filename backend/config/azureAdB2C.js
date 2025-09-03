/**
 * Azure AD B2C Configuration for TaktMate
 * 
 * This module provides comprehensive configuration settings and utilities for integrating
 * with Azure Active Directory B2C for user authentication and authorization.
 * 
 * Features:
 * - Environment variable-based configuration
 * - JWT token validation and user profile extraction
 * - URL generation for authentication flows
 * - Configuration validation and error handling
 * - Support for both user flows and custom policies
 * - Integration with security middleware and Application Insights
 */

require('dotenv').config();

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
  domain: process.env.AZURE_AD_B2C_DOMAIN || `${process.env.AZURE_AD_B2C_TENANT_NAME || 'taktmate'}.b2clogin.com`,
  
  // Application Registration Details
  clientId: process.env.AZURE_AD_B2C_CLIENT_ID,
  clientSecret: process.env.AZURE_AD_B2C_CLIENT_SECRET,
  
  // User Flow/Policy Configuration
  signUpSignInPolicy: process.env.AZURE_AD_B2C_SIGNUP_SIGNIN_POLICY || 'B2C_1_signupsignin1',
  passwordResetPolicy: process.env.AZURE_AD_B2C_PASSWORD_RESET_POLICY || 'B2C_1_passwordreset1',
  profileEditPolicy: process.env.AZURE_AD_B2C_PROFILE_EDIT_POLICY || 'B2C_1_profileedit1',
  
  // Token Configuration
  scope: process.env.AZURE_AD_B2C_SCOPE || 'openid profile email offline_access',
  responseType: process.env.AZURE_AD_B2C_RESPONSE_TYPE || 'id_token',
  responseMode: process.env.AZURE_AD_B2C_RESPONSE_MODE || 'fragment',
  
  // Redirect URLs
  redirectUri: process.env.AZURE_AD_B2C_REDIRECT_URI || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback`,
  postLogoutRedirectUri: process.env.AZURE_AD_B2C_POST_LOGOUT_REDIRECT_URI || process.env.FRONTEND_URL || 'http://localhost:3000',
  
  // Application URLs
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  backendUrl: process.env.BACKEND_URL || 'http://localhost:3001',
  
  // JWT Validation Settings
  validateIssuer: process.env.JWT_VALIDATE_ISSUER !== 'false',
  validateAudience: process.env.JWT_VALIDATE_AUDIENCE !== 'false',
  validateLifetime: process.env.JWT_VALIDATE_LIFETIME !== 'false',
  clockTolerance: parseInt(process.env.JWT_CLOCK_TOLERANCE) || 300, // 5 minutes in seconds
  
  // Cache Configuration
  jwksCacheTtl: parseInt(process.env.JWKS_CACHE_TTL) || 24 * 60 * 60 * 1000, // 24 hours
  jwtCacheTtl: parseInt(process.env.JWT_CACHE_TTL) || 60 * 60 * 1000, // 1 hour
  
  // Session and Token Lifecycle Configuration
  sessionTimeout: parseInt(process.env.SESSION_TIMEOUT) || 8 * 60 * 60 * 1000, // 8 hours
  inactivityTimeout: parseInt(process.env.INACTIVITY_TIMEOUT) || 30 * 60 * 1000, // 30 minutes
  extendedSessionTimeout: parseInt(process.env.EXTENDED_SESSION_TIMEOUT) || 30 * 24 * 60 * 60 * 1000, // 30 days
  
  // Token Refresh Configuration
  tokenRefreshThreshold: parseInt(process.env.TOKEN_REFRESH_THRESHOLD) || 5 * 60 * 1000, // 5 minutes before expiry
  enableAutomaticTokenRefresh: process.env.ENABLE_AUTOMATIC_TOKEN_REFRESH !== 'false',
  enableTokenRotation: process.env.ENABLE_TOKEN_ROTATION !== 'false',
  refreshTokenLifetime: parseInt(process.env.REFRESH_TOKEN_LIFETIME) || 7 * 24 * 60 * 60 * 1000, // 7 days
  
  // Advanced Session Security
  enableSessionFingerprinting: process.env.ENABLE_SESSION_FINGERPRINTING !== 'false',
  enableSecureTokenStorage: process.env.ENABLE_SECURE_TOKEN_STORAGE !== 'false',
  sessionSecurityLevel: process.env.SESSION_SECURITY_LEVEL || 'standard', // standard, high, maximum
  
  // Security Configuration
  enableRateLimit: process.env.ENABLE_RATE_LIMIT !== 'false',
  enableSecurityHeaders: process.env.ENABLE_HELMET !== 'false',
  enableCors: process.env.ENABLE_CORS !== 'false',
  
  // Debug Configuration
  debugJwt: process.env.DEBUG_JWT === 'true',
  debugAuth: process.env.DEBUG_AUTH === 'true',
  debugSecurity: process.env.DEBUG_SECURITY === 'true',
  
  // Custom Claims Configuration
  customClaims: {
    company: process.env.AZURE_AD_B2C_COMPANY_CLAIM || 'extension_Company',
    role: process.env.AZURE_AD_B2C_ROLE_CLAIM || 'extension_Role',
    industry: process.env.AZURE_AD_B2C_INDUSTRY_CLAIM || 'extension_Industry'
  },
  
  // Custom Policy Configuration (if using custom policies instead of user flows)
  useCustomPolicies: process.env.AZURE_AD_B2C_USE_CUSTOM_POLICIES === 'true',
  customPolicySignUpSignIn: process.env.AZURE_AD_B2C_CUSTOM_POLICY_SIGNUP_SIGNIN || 'B2C_1A_TaktMate_SignUpOrSignIn',
  customPolicyPasswordReset: process.env.AZURE_AD_B2C_CUSTOM_POLICY_PASSWORD_RESET || 'B2C_1A_TaktMate_PasswordReset',
  customPolicyProfileEdit: process.env.AZURE_AD_B2C_CUSTOM_POLICY_PROFILE_EDIT || 'B2C_1A_TaktMate_ProfileEdit',
  
  // Environment Configuration
  environment: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test'
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
 * @param {boolean} strict - If true, validates all recommended variables
 * @throws {Error} If required configuration is missing
 */
function validateConfiguration(strict = false) {
  const required = [
    'AZURE_AD_B2C_TENANT_ID',
    'AZURE_AD_B2C_CLIENT_ID'
  ];
  
  const recommended = [
    'AZURE_AD_B2C_TENANT_NAME',
    'AZURE_AD_B2C_CLIENT_SECRET',
    'FRONTEND_URL',
    'BACKEND_URL'
  ];
  
  // Check required variables
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required Azure AD B2C environment variables: ${missing.join(', ')}\n` +
      'Please check your .env file and ensure all required variables are set.\n' +
      'See AZURE_AD_B2C_COMPLETE_SETUP_GUIDE.md for configuration details.'
    );
  }
  
  // Check recommended variables in strict mode
  if (strict) {
    const missingRecommended = recommended.filter(key => !process.env[key]);
    if (missingRecommended.length > 0) {
      console.warn(
        `⚠️  Missing recommended Azure AD B2C environment variables: ${missingRecommended.join(', ')}\n` +
        'These variables are recommended for production deployment.'
      );
    }
  }
  
  // Validate URL formats
  const urlsToValidate = [
    { name: 'redirectUri', value: azureAdB2CConfig.redirectUri },
    { name: 'postLogoutRedirectUri', value: azureAdB2CConfig.postLogoutRedirectUri },
    { name: 'frontendUrl', value: azureAdB2CConfig.frontendUrl },
    { name: 'backendUrl', value: azureAdB2CConfig.backendUrl }
  ];
  
  for (const urlConfig of urlsToValidate) {
    try {
      new URL(urlConfig.value);
    } catch (error) {
      throw new Error(`Invalid URL format for ${urlConfig.name}: ${urlConfig.value} - ${error.message}`);
    }
  }
  
  // Validate tenant configuration
  if (!azureAdB2CConfig.tenantName || azureAdB2CConfig.tenantName === 'your-tenant-name') {
    throw new Error('AZURE_AD_B2C_TENANT_NAME must be set to your actual tenant name');
  }
  
  if (!azureAdB2CConfig.clientId || azureAdB2CConfig.clientId === 'your-client-id') {
    throw new Error('AZURE_AD_B2C_CLIENT_ID must be set to your actual client ID');
  }
  
  // Validate numeric configurations
  if (azureAdB2CConfig.clockTolerance < 0 || azureAdB2CConfig.clockTolerance > 3600) {
    throw new Error('JWT_CLOCK_TOLERANCE must be between 0 and 3600 seconds');
  }
  
  // Debug logging for configuration validation
  if (azureAdB2CConfig.debugAuth) {
    console.log('✅ Azure AD B2C Configuration validated successfully');
    console.log(`   Tenant: ${azureAdB2CConfig.tenantName}`);
    console.log(`   Environment: ${azureAdB2CConfig.environment}`);
    console.log(`   Debug Mode: JWT=${azureAdB2CConfig.debugJwt}, Auth=${azureAdB2CConfig.debugAuth}`);
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
 * @param {string} redirectUri - Redirect URI (optional, uses config default)
 * @param {Object} options - Additional options
 * @param {string} options.state - State parameter for CSRF protection
 * @param {string} options.nonce - Nonce parameter for replay protection
 * @param {string} options.policy - Policy name (defaults to sign-up/sign-in policy)
 * @param {string} options.responseType - Response type (defaults to id_token)
 * @param {string} options.responseMode - Response mode (defaults to fragment)
 * @param {string} options.scope - OAuth scope (defaults to config scope)
 * @returns {string} The complete login URL
 */
function generateLoginUrl(redirectUri = null, options = {}) {
  const { 
    domain, 
    tenantName, 
    signUpSignInPolicy, 
    clientId, 
    scope,
    responseType,
    responseMode 
  } = azureAdB2CConfig;
  
  const {
    state = '',
    nonce = 'defaultNonce',
    policy = null,
    responseType: customResponseType = responseType,
    responseMode: customResponseMode = responseMode,
    scope: customScope = scope
  } = options;
  
  const policyName = policy || signUpSignInPolicy;
  const targetRedirectUri = redirectUri || azureAdB2CConfig.redirectUri;
  
  const params = new URLSearchParams({
    'client_id': clientId,
    'response_type': customResponseType,
    'redirect_uri': targetRedirectUri,
    'response_mode': customResponseMode,
    'scope': customScope,
    'state': state,
    'nonce': nonce
  });
  
  // Remove empty parameters
  for (const [key, value] of params.entries()) {
    if (!value) {
      params.delete(key);
    }
  }
  
  const loginUrl = `https://${domain}/${tenantName}.onmicrosoft.com/${policyName}/oauth2/v2.0/authorize?${params.toString()}`;
  
  if (azureAdB2CConfig.debugAuth) {
    console.log(`🔗 Generated login URL: ${loginUrl}`);
  }
  
  return loginUrl;
}

/**
 * Generate password reset URL for Azure AD B2C
 * 
 * @param {string} redirectUri - Redirect URI (optional, uses config default)
 * @param {Object} options - Additional options
 * @returns {string} The complete password reset URL
 */
function generatePasswordResetUrl(redirectUri = null, options = {}) {
  if (!azureAdB2CConfig.passwordResetPolicy) {
    throw new Error('Password reset policy not configured. Set AZURE_AD_B2C_PASSWORD_RESET_POLICY environment variable.');
  }
  
  return generateLoginUrl(redirectUri, {
    ...options,
    policy: azureAdB2CConfig.passwordResetPolicy
  });
}

/**
 * Generate profile edit URL for Azure AD B2C
 * 
 * @param {string} redirectUri - Redirect URI (optional, uses config default)
 * @param {Object} options - Additional options
 * @returns {string} The complete profile edit URL
 */
function generateProfileEditUrl(redirectUri = null, options = {}) {
  if (!azureAdB2CConfig.profileEditPolicy) {
    throw new Error('Profile edit policy not configured. Set AZURE_AD_B2C_PROFILE_EDIT_POLICY environment variable.');
  }
  
  return generateLoginUrl(redirectUri, {
    ...options,
    policy: azureAdB2CConfig.profileEditPolicy
  });
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
 * Generate token refresh URL for Azure AD B2C
 * 
 * @returns {string} The token refresh URL
 */
function generateTokenRefreshUrl() {
  const { domain, tenantName, signUpSignInPolicy } = azureAdB2CConfig;
  return `https://${domain}/${tenantName}.onmicrosoft.com/${signUpSignInPolicy}/oauth2/v2.0/token`;
}

/**
 * Get session timeout configuration based on security level
 * 
 * @param {string} securityLevel - Security level (standard, high, maximum)
 * @returns {Object} Session timeout configuration
 */
function getSessionTimeoutConfig(securityLevel = null) {
  const level = securityLevel || azureAdB2CConfig.sessionSecurityLevel;
  
  const configs = {
    standard: {
      sessionTimeout: 8 * 60 * 60 * 1000, // 8 hours
      inactivityTimeout: 30 * 60 * 1000, // 30 minutes
      extendedSessionTimeout: 30 * 24 * 60 * 60 * 1000, // 30 days
      tokenRefreshThreshold: 5 * 60 * 1000 // 5 minutes
    },
    high: {
      sessionTimeout: 4 * 60 * 60 * 1000, // 4 hours
      inactivityTimeout: 15 * 60 * 1000, // 15 minutes
      extendedSessionTimeout: 7 * 24 * 60 * 60 * 1000, // 7 days
      tokenRefreshThreshold: 10 * 60 * 1000 // 10 minutes
    },
    maximum: {
      sessionTimeout: 2 * 60 * 60 * 1000, // 2 hours
      inactivityTimeout: 5 * 60 * 1000, // 5 minutes
      extendedSessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
      tokenRefreshThreshold: 15 * 60 * 1000 // 15 minutes
    }
  };
  
  return configs[level] || configs.standard;
}

/**
 * Check if token refresh is needed based on expiration
 * 
 * @param {number} expiresAt - Token expiration timestamp
 * @param {number} threshold - Refresh threshold in milliseconds
 * @returns {boolean} Whether token needs refresh
 */
function needsTokenRefresh(expiresAt, threshold = null) {
  const refreshThreshold = threshold || azureAdB2CConfig.tokenRefreshThreshold;
  const now = Date.now();
  return (expiresAt - now) <= refreshThreshold;
}

/**
 * Get token lifetime configuration
 * 
 * @returns {Object} Token lifetime configuration
 */
function getTokenLifetimeConfig() {
  return {
    accessTokenLifetime: 60 * 60 * 1000, // 1 hour (Azure AD B2C default)
    idTokenLifetime: 60 * 60 * 1000, // 1 hour (Azure AD B2C default)
    refreshTokenLifetime: azureAdB2CConfig.refreshTokenLifetime,
    sessionTimeout: azureAdB2CConfig.sessionTimeout,
    inactivityTimeout: azureAdB2CConfig.inactivityTimeout,
    extendedSessionTimeout: azureAdB2CConfig.extendedSessionTimeout,
    tokenRefreshThreshold: azureAdB2CConfig.tokenRefreshThreshold
  };
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
    allowHttpForRedirectUrl: azureAdB2CConfig.isDevelopment,
    clientSecret: azureAdB2CConfig.clientSecret,
    validateIssuer: azureAdB2CConfig.validateIssuer,
    isB2C: true,
    issuer: getIssuerUrl(),
    passReqToCallback: true,
    scope: azureAdB2CConfig.scope.split(' '),
    loggingLevel: azureAdB2CConfig.isDevelopment ? 'info' : 'warn',
    nonceLifetime: 600, // 10 minutes
    nonceMaxAmount: 5,
    useCookieInsteadOfSession: false,
    cookieEncryptionKeys: [
      { 
        'key': process.env.COOKIE_ENCRYPTION_KEY || 'default-key-change-in-production', 
        'iv': process.env.COOKIE_ENCRYPTION_IV || 'default-iv-change-in-production' 
      }
    ]
  };
}

/**
 * Get comprehensive configuration status
 * 
 * @returns {Object} Configuration status object
 */
function getConfigurationStatus() {
  return {
    configured: !!(azureAdB2CConfig.tenantId && azureAdB2CConfig.clientId),
    environment: azureAdB2CConfig.environment,
    tenant: {
      name: azureAdB2CConfig.tenantName,
      id: azureAdB2CConfig.tenantId ? '✓ Set' : '✗ Missing',
      domain: azureAdB2CConfig.domain
    },
    application: {
      clientId: azureAdB2CConfig.clientId ? '✓ Set' : '✗ Missing',
      clientSecret: azureAdB2CConfig.clientSecret ? '✓ Set' : '✗ Missing'
    },
    policies: {
      signUpSignIn: azureAdB2CConfig.signUpSignInPolicy,
      passwordReset: azureAdB2CConfig.passwordResetPolicy || 'Not configured',
      profileEdit: azureAdB2CConfig.profileEditPolicy || 'Not configured',
      useCustomPolicies: azureAdB2CConfig.useCustomPolicies
    },
    urls: {
      frontend: azureAdB2CConfig.frontendUrl,
      backend: azureAdB2CConfig.backendUrl,
      redirectUri: azureAdB2CConfig.redirectUri,
      postLogoutRedirectUri: azureAdB2CConfig.postLogoutRedirectUri
    },
    security: {
      validateIssuer: azureAdB2CConfig.validateIssuer,
      validateAudience: azureAdB2CConfig.validateAudience,
      validateLifetime: azureAdB2CConfig.validateLifetime,
      clockTolerance: azureAdB2CConfig.clockTolerance,
      enableRateLimit: azureAdB2CConfig.enableRateLimit,
      enableSecurityHeaders: azureAdB2CConfig.enableSecurityHeaders,
      enableCors: azureAdB2CConfig.enableCors
    },
    
    session: {
      sessionTimeout: azureAdB2CConfig.sessionTimeout / 1000 / 60 / 60 + ' hours',
      inactivityTimeout: azureAdB2CConfig.inactivityTimeout / 1000 / 60 + ' minutes',
      extendedSessionTimeout: azureAdB2CConfig.extendedSessionTimeout / 1000 / 60 / 60 / 24 + ' days',
      sessionSecurityLevel: azureAdB2CConfig.sessionSecurityLevel,
      enableSessionFingerprinting: azureAdB2CConfig.enableSessionFingerprinting,
      enableSecureTokenStorage: azureAdB2CConfig.enableSecureTokenStorage
    },
    
    tokenManagement: {
      tokenRefreshThreshold: azureAdB2CConfig.tokenRefreshThreshold / 1000 / 60 + ' minutes',
      enableAutomaticTokenRefresh: azureAdB2CConfig.enableAutomaticTokenRefresh,
      enableTokenRotation: azureAdB2CConfig.enableTokenRotation,
      refreshTokenLifetime: azureAdB2CConfig.refreshTokenLifetime / 1000 / 60 / 60 / 24 + ' days'
    },
    debug: {
      jwt: azureAdB2CConfig.debugJwt,
      auth: azureAdB2CConfig.debugAuth,
      security: azureAdB2CConfig.debugSecurity
    }
  };
}

/**
 * Get policy name based on configuration
 * 
 * @param {string} type - Policy type ('login', 'reset', 'edit')
 * @returns {string} Policy name
 */
function getPolicyName(type) {
  if (azureAdB2CConfig.useCustomPolicies) {
    switch (type) {
      case 'login':
        return azureAdB2CConfig.customPolicySignUpSignIn;
      case 'reset':
        return azureAdB2CConfig.customPolicyPasswordReset;
      case 'edit':
        return azureAdB2CConfig.customPolicyProfileEdit;
      default:
        return azureAdB2CConfig.customPolicySignUpSignIn;
    }
  } else {
    switch (type) {
      case 'login':
        return azureAdB2CConfig.signUpSignInPolicy;
      case 'reset':
        return azureAdB2CConfig.passwordResetPolicy;
      case 'edit':
        return azureAdB2CConfig.profileEditPolicy;
      default:
        return azureAdB2CConfig.signUpSignInPolicy;
    }
  }
}

/**
 * Check if feature is enabled
 * 
 * @param {string} feature - Feature name
 * @returns {boolean} Whether feature is enabled
 */
function isFeatureEnabled(feature) {
  switch (feature) {
    case 'passwordReset':
      return !!(azureAdB2CConfig.passwordResetPolicy || azureAdB2CConfig.customPolicyPasswordReset);
    case 'profileEdit':
      return !!(azureAdB2CConfig.profileEditPolicy || azureAdB2CConfig.customPolicyProfileEdit);
    case 'customPolicies':
      return azureAdB2CConfig.useCustomPolicies;
    case 'rateLimit':
      return azureAdB2CConfig.enableRateLimit;
    case 'securityHeaders':
      return azureAdB2CConfig.enableSecurityHeaders;
    case 'cors':
      return azureAdB2CConfig.enableCors;
    case 'debug':
      return azureAdB2CConfig.debugAuth || azureAdB2CConfig.debugJwt || azureAdB2CConfig.debugSecurity;
    case 'automaticTokenRefresh':
      return azureAdB2CConfig.enableAutomaticTokenRefresh;
    case 'tokenRotation':
      return azureAdB2CConfig.enableTokenRotation;
    case 'sessionFingerprinting':
      return azureAdB2CConfig.enableSessionFingerprinting;
    case 'secureTokenStorage':
      return azureAdB2CConfig.enableSecureTokenStorage;
    default:
      return false;
  }
}

/**
 * Log configuration summary
 */
function logConfigurationSummary() {
  if (!azureAdB2CConfig.debugAuth) return;
  
  console.log('\n🔧 Azure AD B2C Configuration Summary');
  console.log('=====================================');
  console.log(`Environment: ${azureAdB2CConfig.environment}`);
  console.log(`Tenant: ${azureAdB2CConfig.tenantName}`);
  console.log(`Domain: ${azureAdB2CConfig.domain}`);
  console.log(`Client ID: ${azureAdB2CConfig.clientId ? azureAdB2CConfig.clientId.substring(0, 8) + '...' : 'Not set'}`);
  console.log(`Frontend URL: ${azureAdB2CConfig.frontendUrl}`);
  console.log(`Backend URL: ${azureAdB2CConfig.backendUrl}`);
  console.log(`Use Custom Policies: ${azureAdB2CConfig.useCustomPolicies ? 'Yes' : 'No'}`);
  console.log(`Password Reset: ${isFeatureEnabled('passwordReset') ? 'Enabled' : 'Disabled'}`);
  console.log(`Profile Edit: ${isFeatureEnabled('profileEdit') ? 'Enabled' : 'Disabled'}`);
  console.log(`Rate Limiting: ${isFeatureEnabled('rateLimit') ? 'Enabled' : 'Disabled'}`);
  console.log(`Security Headers: ${isFeatureEnabled('securityHeaders') ? 'Enabled' : 'Disabled'}`);
  console.log(`CORS: ${isFeatureEnabled('cors') ? 'Enabled' : 'Disabled'}`);
  
  console.log('\n🕐 Session & Token Management:');
  console.log(`Session Security Level: ${azureAdB2CConfig.sessionSecurityLevel}`);
  console.log(`Session Timeout: ${azureAdB2CConfig.sessionTimeout / 1000 / 60 / 60} hours`);
  console.log(`Inactivity Timeout: ${azureAdB2CConfig.inactivityTimeout / 1000 / 60} minutes`);
  console.log(`Automatic Token Refresh: ${isFeatureEnabled('automaticTokenRefresh') ? 'Enabled' : 'Disabled'}`);
  console.log(`Token Rotation: ${isFeatureEnabled('tokenRotation') ? 'Enabled' : 'Disabled'}`);
  console.log(`Session Fingerprinting: ${isFeatureEnabled('sessionFingerprinting') ? 'Enabled' : 'Disabled'}`);
  console.log(`Secure Token Storage: ${isFeatureEnabled('secureTokenStorage') ? 'Enabled' : 'Disabled'}`);
  console.log('=====================================\n');
}

// Initialize configuration on module load
if (azureAdB2CConfig.environment !== 'test') {
  try {
    // Validate configuration
    validateConfiguration(azureAdB2CConfig.isProduction);
    
    // Log configuration summary in debug mode
    logConfigurationSummary();
    
    if (azureAdB2CConfig.debugAuth) {
      console.log('✅ Azure AD B2C configuration module loaded successfully');
    }
  } catch (error) {
    console.error('❌ Azure AD B2C Configuration Error:', error.message);
    
    if (azureAdB2CConfig.isProduction) {
      console.error('💥 Exiting due to configuration error in production environment');
      process.exit(1); // Fail fast in production
    } else {
      console.warn('⚠️  Continuing with invalid configuration in development environment');
      console.warn('   Please fix configuration issues before deploying to production');
    }
  }
}

module.exports = {
  // Configuration object
  config: azureAdB2CConfig,
  
  // URL generation functions
  getMetadataUrl,
  getAuthorityUrl,
  getIssuerUrl,
  getJwksUri,
  
  // Authentication URL generators
  generateLoginUrl,
  generatePasswordResetUrl,
  generateProfileEditUrl,
  generateLogoutUrl,
  generateTokenRefreshUrl,
  
  // User profile and token utilities
  extractUserProfile,
  
  // Configuration utilities
  validateConfiguration,
  getConfigurationStatus,
  getPolicyName,
  isFeatureEnabled,
  logConfigurationSummary,
  
  // Session and Token Management utilities
  getSessionTimeoutConfig,
  needsTokenRefresh,
  getTokenLifetimeConfig,
  
  // Integration utilities
  getPassportConfig
};
