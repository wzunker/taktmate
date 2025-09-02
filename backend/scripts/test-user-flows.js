#!/usr/bin/env node

/**
 * Azure AD B2C User Flow Testing Utility
 * 
 * This script helps test and validate Azure AD B2C user flows configuration
 * by generating test URLs and validating JWT tokens.
 */

const { 
  config, 
  getMetadataUrl, 
  getAuthorityUrl, 
  getIssuerUrl, 
  getJwksUri,
  generateLoginUrl,
  generatePasswordResetUrl,
  generateProfileEditUrl,
  generateLogoutUrl,
  validateConfiguration,
  extractUserProfile
} = require('../config/azureAdB2C');

const https = require('https');
const crypto = require('crypto');

/**
 * Colors for console output
 */
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

/**
 * Log with colors
 */
function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

/**
 * Generate secure random state and nonce
 */
function generateSecureTokens() {
  return {
    state: crypto.randomBytes(16).toString('hex'),
    nonce: crypto.randomBytes(16).toString('hex')
  };
}

/**
 * Fetch URL and return response
 */
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (error) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    }).on('error', reject);
  });
}

/**
 * Test Azure AD B2C metadata endpoints
 */
async function testMetadataEndpoints() {
  log('\n🔍 Testing Azure AD B2C Metadata Endpoints', colors.cyan);
  log('=' .repeat(50), colors.cyan);

  const endpoints = [
    { name: 'Metadata URL', url: getMetadataUrl() },
    { name: 'Authority URL', url: getAuthorityUrl() },
    { name: 'Issuer URL', url: getIssuerUrl() },
    { name: 'JWKS URI', url: getJwksUri() }
  ];

  for (const endpoint of endpoints) {
    try {
      log(`\nTesting ${endpoint.name}:`, colors.yellow);
      log(`URL: ${endpoint.url}`, colors.blue);
      
      const response = await fetchUrl(endpoint.url);
      
      if (response.status === 200) {
        log(`✅ Status: ${response.status} - OK`, colors.green);
        
        if (endpoint.name === 'Metadata URL' && response.data.issuer) {
          log(`   Issuer: ${response.data.issuer}`, colors.blue);
          log(`   Authorization Endpoint: ${response.data.authorization_endpoint}`, colors.blue);
          log(`   Token Endpoint: ${response.data.token_endpoint}`, colors.blue);
        }
        
        if (endpoint.name === 'JWKS URI' && response.data.keys) {
          log(`   Keys Available: ${response.data.keys.length}`, colors.blue);
        }
      } else {
        log(`❌ Status: ${response.status} - Error`, colors.red);
        if (typeof response.data === 'string') {
          log(`   Error: ${response.data.substring(0, 200)}...`, colors.red);
        }
      }
    } catch (error) {
      log(`❌ Network Error: ${error.message}`, colors.red);
    }
  }
}

/**
 * Generate and display user flow URLs
 */
function testUserFlowUrls() {
  log('\n🔗 Generating User Flow URLs', colors.cyan);
  log('=' .repeat(50), colors.cyan);

  const { state, nonce } = generateSecureTokens();
  
  const flows = [
    { name: 'Sign-up/Sign-in Flow', url: generateLoginUrl(state, nonce) },
    { name: 'Password Reset Flow', url: generatePasswordResetUrl(state, nonce) },
    { name: 'Profile Edit Flow', url: generateProfileEditUrl(state, nonce) },
    { name: 'Logout Flow', url: generateLogoutUrl() }
  ];

  log(`\nGenerated with:`, colors.yellow);
  log(`State: ${state}`, colors.blue);
  log(`Nonce: ${nonce}`, colors.blue);

  flows.forEach(flow => {
    log(`\n${flow.name}:`, colors.yellow);
    log(`${flow.url}`, colors.green);
    log(`\nTest this URL by:`, colors.magenta);
    log(`1. Copy the URL above`, colors.magenta);
    log(`2. Open in browser`, colors.magenta);
    log(`3. Complete authentication flow`, colors.magenta);
    log(`4. Verify JWT token at https://jwt.ms`, colors.magenta);
  });
}

/**
 * Display configuration summary
 */
function displayConfiguration() {
  log('\n⚙️  Azure AD B2C Configuration Summary', colors.cyan);
  log('=' .repeat(50), colors.cyan);

  const configItems = [
    { key: 'Tenant Name', value: config.tenantName },
    { key: 'Tenant ID', value: config.tenantId ? config.tenantId.substring(0, 8) + '...' : 'Not set' },
    { key: 'Domain', value: config.domain },
    { key: 'Client ID', value: config.clientId ? config.clientId.substring(0, 8) + '...' : 'Not set' },
    { key: 'Sign-up/Sign-in Policy', value: config.signUpSignInPolicy },
    { key: 'Password Reset Policy', value: config.passwordResetPolicy },
    { key: 'Profile Edit Policy', value: config.profileEditPolicy },
    { key: 'Scope', value: config.scope },
    { key: 'Redirect URI', value: config.redirectUri },
    { key: 'Post Logout Redirect URI', value: config.postLogoutRedirectUri },
    { key: 'Frontend URL', value: config.frontendUrl },
    { key: 'Backend URL', value: config.backendUrl }
  ];

  configItems.forEach(item => {
    const status = item.value && item.value !== 'Not set' ? '✅' : '❌';
    log(`${status} ${item.key}: ${item.value}`, item.value && item.value !== 'Not set' ? colors.green : colors.red);
  });
}

/**
 * Test JWT token parsing (with sample token structure)
 */
function testTokenParsing() {
  log('\n🎫 JWT Token Structure Test', colors.cyan);
  log('=' .repeat(50), colors.cyan);

  // Sample token payload structure that should be received from Azure AD B2C
  const sampleTokenPayload = {
    sub: 'sample-user-id-12345',
    emails: ['user@example.com'],
    given_name: 'John',
    family_name: 'Doe',
    name: 'John Doe',
    extension_Company: 'TechCorp Inc',
    extension_Role: 'Software Engineer',
    iss: getIssuerUrl(),
    aud: config.clientId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    email_verified: true
  };

  log('\nSample JWT Token Payload:', colors.yellow);
  log(JSON.stringify(sampleTokenPayload, null, 2), colors.blue);

  log('\nExtracted User Profile:', colors.yellow);
  const userProfile = extractUserProfile(sampleTokenPayload);
  log(JSON.stringify(userProfile, null, 2), colors.green);

  log('\nExpected Claims in Real Token:', colors.yellow);
  const expectedClaims = [
    'sub (User ID)',
    'emails (Email array)',
    'given_name, family_name, name',
    'extension_Company (Custom attribute)',
    'extension_Role (Custom attribute)', 
    'iss (Issuer)',
    'aud (Audience)',
    'iat, exp, nbf (Token timestamps)',
    'email_verified (Boolean)'
  ];
  
  expectedClaims.forEach(claim => {
    log(`✅ ${claim}`, colors.green);
  });
}

/**
 * Validate environment configuration
 */
function testConfiguration() {
  log('\n🔧 Configuration Validation', colors.cyan);
  log('=' .repeat(50), colors.cyan);

  try {
    validateConfiguration();
    log('✅ Configuration validation passed!', colors.green);
  } catch (error) {
    log('❌ Configuration validation failed:', colors.red);
    log(error.message, colors.red);
    log('\nPlease check your .env file and ensure all required variables are set.', colors.yellow);
    log('See AZURE_AD_B2C_SETUP.md for configuration details.', colors.yellow);
  }
}

/**
 * Display help information
 */
function displayHelp() {
  log('\n📖 Azure AD B2C User Flow Testing Utility', colors.cyan);
  log('=' .repeat(50), colors.cyan);
  
  log('\nUsage: node test-user-flows.js [command]', colors.yellow);
  
  log('\nCommands:', colors.yellow);
  log('  config     - Display configuration summary', colors.blue);
  log('  metadata   - Test metadata endpoints', colors.blue);
  log('  urls       - Generate user flow URLs for testing', colors.blue);
  log('  tokens     - Test JWT token parsing', colors.blue);
  log('  validate   - Validate configuration', colors.blue);
  log('  all        - Run all tests (default)', colors.blue);
  log('  help       - Display this help', colors.blue);

  log('\nExamples:', colors.yellow);
  log('  npm run test:user-flows', colors.green);
  log('  npm run test:user-flows config', colors.green);
  log('  npm run test:user-flows urls', colors.green);

  log('\nNext Steps:', colors.yellow);
  log('1. Ensure your .env file is configured with Azure AD B2C settings', colors.magenta);
  log('2. Run this script to validate configuration', colors.magenta);
  log('3. Use generated URLs to test user flows in browser', colors.magenta);
  log('4. Verify JWT tokens contain expected claims', colors.magenta);
  log('5. Proceed to Task 1.3 once user flows are working', colors.magenta);
}

/**
 * Main function
 */
async function main() {
  const command = process.argv[2] || 'all';

  log('🚀 TaktMate Azure AD B2C User Flow Testing', colors.bright);
  log(`Environment: ${process.env.NODE_ENV || 'development'}`, colors.blue);

  switch (command) {
    case 'config':
      displayConfiguration();
      break;
    case 'metadata':
      await testMetadataEndpoints();
      break;
    case 'urls':
      testUserFlowUrls();
      break;
    case 'tokens':
      testTokenParsing();
      break;
    case 'validate':
      testConfiguration();
      break;
    case 'help':
      displayHelp();
      break;
    case 'all':
    default:
      testConfiguration();
      displayConfiguration();
      await testMetadataEndpoints();
      testUserFlowUrls();
      testTokenParsing();
      
      log('\n🎉 Testing Complete!', colors.green);
      log('Use the generated URLs above to test your user flows in a browser.', colors.yellow);
      break;
  }
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    log(`\n❌ Script Error: ${error.message}`, colors.red);
    process.exit(1);
  });
}

module.exports = {
  testMetadataEndpoints,
  testUserFlowUrls,
  testTokenParsing,
  testConfiguration,
  displayConfiguration
};
