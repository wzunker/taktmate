#!/usr/bin/env node

/**
 * Azure AD B2C JWT Token Claims Testing Utility for TaktMate
 * 
 * This script tests and validates JWT token claims configuration
 * and provides tools for testing token validation and user profile extraction.
 */

const jwt = require('jsonwebtoken');
const https = require('https');
const crypto = require('crypto');
const { 
  config, 
  getJwksUri,
  getIssuerUrl,
  extractUserProfile,
  validateConfiguration
} = require('../config/azureAdB2C');

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
          resolve(jwks);
        } catch (error) {
          reject(new Error(`Failed to parse JWKS: ${error.message}`));
        }
      });
    }).on('error', reject);
  });
}

/**
 * Create sample JWT token payload for testing
 */
function createSampleTokenPayload() {
  const now = Math.floor(Date.now() / 1000);
  
  return {
    // Standard JWT claims
    iss: getIssuerUrl(),
    aud: config.clientId,
    sub: 'sample-user-12345',
    iat: now,
    exp: now + 3600, // 1 hour
    nbf: now,
    
    // Azure AD B2C specific claims
    ver: '1.0',
    tfp: config.signUpSignInPolicy,
    auth_time: now,
    nonce: 'sample-nonce',
    
    // User profile claims
    emails: ['john.doe@techcorp.com'],
    given_name: 'John',
    family_name: 'Doe',
    name: 'John Doe',
    
    // Custom claims (user flow format)
    extension_Company: 'TechCorp Inc',
    extension_Role: 'Software Engineer',
    extension_Industry: 'Technology',
    
    // Authentication metadata
    idp: 'local',
    email_verified: true
  };
}

/**
 * Create sample JWT token payload with custom policy format
 */
function createSampleCustomPolicyTokenPayload() {
  const now = Math.floor(Date.now() / 1000);
  
  return {
    // Standard JWT claims
    iss: getIssuerUrl(),
    aud: config.clientId,
    sub: 'sample-user-67890',
    iat: now,
    exp: now + 3600, // 1 hour
    nbf: now,
    
    // Azure AD B2C specific claims
    ver: '1.0',
    tfp: config.customPolicySignUpSignIn || 'B2C_1A_TaktMate_SignUpOrSignIn',
    auth_time: now,
    nonce: 'sample-nonce',
    
    // User profile claims
    emails: ['jane.smith@healthcorp.com'],
    given_name: 'Jane',
    family_name: 'Smith',
    name: 'Jane Smith',
    
    // Custom claims (custom policy format)
    company: 'HealthCorp Ltd',
    jobTitle: 'Product Manager',
    industry: 'Healthcare',
    
    // Authentication metadata
    identityProvider: 'Google',
    email_verified: true
  };
}

/**
 * Test JWT token structure and claims
 */
function testTokenStructure() {
  log('\n🎫 Testing JWT Token Structure and Claims', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  // Test user flow token format
  log('\n1. User Flow Token Format:', colors.yellow);
  const userFlowToken = createSampleTokenPayload();
  log(JSON.stringify(userFlowToken, null, 2), colors.blue);
  
  const userFlowProfile = extractUserProfile(userFlowToken);
  log('\nExtracted User Profile (User Flow):', colors.green);
  log(JSON.stringify(userFlowProfile, null, 2), colors.green);

  // Test custom policy token format
  log('\n2. Custom Policy Token Format:', colors.yellow);
  const customPolicyToken = createSampleCustomPolicyTokenPayload();
  log(JSON.stringify(customPolicyToken, null, 2), colors.blue);
  
  const customPolicyProfile = extractUserProfile(customPolicyToken);
  log('\nExtracted User Profile (Custom Policy):', colors.green);
  log(JSON.stringify(customPolicyProfile, null, 2), colors.green);

  return { userFlowToken, customPolicyToken, userFlowProfile, customPolicyProfile };
}

/**
 * Test JWT token validation parameters
 */
function testTokenValidationConfig() {
  log('\n🔧 JWT Token Validation Configuration', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  const validationConfig = {
    issuer: getIssuerUrl(),
    audience: config.clientId,
    jwksUri: getJwksUri(),
    algorithms: ['RS256'],
    clockTolerance: config.clockTolerance,
    validateIssuer: config.validateIssuer,
    validateAudience: config.validateAudience,
    validateLifetime: config.validateLifetime
  };

  log('\nValidation Configuration:', colors.yellow);
  Object.entries(validationConfig).forEach(([key, value]) => {
    log(`  ${key}: ${value}`, colors.blue);
  });

  // Test configuration completeness
  log('\nConfiguration Validation:', colors.yellow);
  const requiredFields = ['issuer', 'audience', 'jwksUri'];
  let configValid = true;

  requiredFields.forEach(field => {
    if (validationConfig[field] && validationConfig[field] !== 'your-client-id') {
      log(`  ✅ ${field}: Configured`, colors.green);
    } else {
      log(`  ❌ ${field}: Missing or invalid`, colors.red);
      configValid = false;
    }
  });

  return { validationConfig, configValid };
}

/**
 * Test JWKS endpoint connectivity
 */
async function testJwksEndpoint() {
  log('\n🔑 Testing JWKS Endpoint', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    const jwksUri = getJwksUri();
    log(`\nJWKS URI: ${jwksUri}`, colors.blue);
    
    const jwks = await fetchJwksKeys();
    
    if (jwks.keys && jwks.keys.length > 0) {
      log(`✅ JWKS Keys Retrieved: ${jwks.keys.length} keys found`, colors.green);
      
      jwks.keys.forEach((key, index) => {
        log(`\nKey ${index + 1}:`, colors.yellow);
        log(`  Key ID (kid): ${key.kid}`, colors.blue);
        log(`  Key Type (kty): ${key.kty}`, colors.blue);
        log(`  Algorithm (alg): ${key.alg || 'RS256'}`, colors.blue);
        log(`  Use: ${key.use || 'sig'}`, colors.blue);
      });
      
      return { success: true, keys: jwks.keys };
    } else {
      log('❌ No JWKS keys found', colors.red);
      return { success: false, error: 'No keys found' };
    }
  } catch (error) {
    log(`❌ JWKS Endpoint Error: ${error.message}`, colors.red);
    return { success: false, error: error.message };
  }
}

/**
 * Test required claims configuration
 */
function testRequiredClaims() {
  log('\n📋 Testing Required Claims Configuration', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  const requiredClaims = [
    { name: 'sub', description: 'Subject (User ID)', required: true },
    { name: 'emails', description: 'Email Addresses', required: true },
    { name: 'given_name', description: 'Given Name', required: true },
    { name: 'family_name', description: 'Family Name', required: true },
    { name: 'name', description: 'Display Name', required: true },
    { name: 'extension_Company', description: 'Company (User Flow)', required: true },
    { name: 'extension_Role', description: 'Role (User Flow)', required: true },
    { name: 'company', description: 'Company (Custom Policy)', required: false },
    { name: 'jobTitle', description: 'Job Title (Custom Policy)', required: false },
    { name: 'industry', description: 'Industry', required: false },
    { name: 'idp', description: 'Identity Provider', required: false },
    { name: 'email_verified', description: 'Email Verified', required: false }
  ];

  log('\nRequired Claims for JWT Tokens:', colors.yellow);
  
  requiredClaims.forEach(claim => {
    const status = claim.required ? '✅ Required' : '🔵 Optional';
    log(`  ${status} ${claim.name}: ${claim.description}`, claim.required ? colors.green : colors.blue);
  });

  // Test sample tokens for required claims
  log('\nClaim Validation Test:', colors.yellow);
  const sampleToken = createSampleTokenPayload();
  const missingClaims = [];
  
  requiredClaims.filter(c => c.required).forEach(claim => {
    if (sampleToken[claim.name] !== undefined) {
      log(`  ✅ ${claim.name}: Present`, colors.green);
    } else {
      log(`  ❌ ${claim.name}: Missing`, colors.red);
      missingClaims.push(claim.name);
    }
  });

  return { requiredClaims, missingClaims };
}

/**
 * Test token validation scenarios
 */
function testTokenValidationScenarios() {
  log('\n🧪 Testing Token Validation Scenarios', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  const scenarios = [
    {
      name: 'Valid Token',
      token: createSampleTokenPayload(),
      expectedResult: 'success'
    },
    {
      name: 'Expired Token',
      token: { ...createSampleTokenPayload(), exp: Math.floor(Date.now() / 1000) - 3600 },
      expectedResult: 'failure',
      expectedError: 'Token expired'
    },
    {
      name: 'Invalid Issuer',
      token: { ...createSampleTokenPayload(), iss: 'https://invalid-issuer.com' },
      expectedResult: 'failure',
      expectedError: 'Invalid issuer'
    },
    {
      name: 'Invalid Audience',
      token: { ...createSampleTokenPayload(), aud: 'invalid-client-id' },
      expectedResult: 'failure',
      expectedError: 'Invalid audience'
    },
    {
      name: 'Missing Required Claims',
      token: { ...createSampleTokenPayload(), emails: undefined, sub: undefined },
      expectedResult: 'failure',
      expectedError: 'Missing required claims'
    },
    {
      name: 'Future Token (nbf)',
      token: { ...createSampleTokenPayload(), nbf: Math.floor(Date.now() / 1000) + 3600 },
      expectedResult: 'failure',
      expectedError: 'Token not yet valid'
    }
  ];

  scenarios.forEach((scenario, index) => {
    log(`\n${index + 1}. ${scenario.name}:`, colors.yellow);
    
    // Basic validation checks
    const now = Math.floor(Date.now() / 1000);
    const token = scenario.token;
    
    // Check expiration
    if (token.exp && token.exp < now) {
      log(`  ❌ Token expired (exp: ${token.exp}, now: ${now})`, colors.red);
    } else if (token.exp) {
      log(`  ✅ Token not expired (exp: ${token.exp})`, colors.green);
    }
    
    // Check issuer
    if (token.iss === getIssuerUrl()) {
      log(`  ✅ Valid issuer: ${token.iss}`, colors.green);
    } else {
      log(`  ❌ Invalid issuer: ${token.iss}`, colors.red);
    }
    
    // Check audience
    if (token.aud === config.clientId) {
      log(`  ✅ Valid audience: ${token.aud}`, colors.green);
    } else {
      log(`  ❌ Invalid audience: ${token.aud}`, colors.red);
    }
    
    // Check required claims
    const requiredClaims = ['sub', 'emails'];
    const missingClaims = requiredClaims.filter(claim => !token[claim]);
    if (missingClaims.length === 0) {
      log(`  ✅ All required claims present`, colors.green);
    } else {
      log(`  ❌ Missing claims: ${missingClaims.join(', ')}`, colors.red);
    }

    // Test user profile extraction
    try {
      const profile = extractUserProfile(token);
      log(`  ✅ User profile extracted successfully`, colors.green);
      log(`     User: ${profile.name || 'Unknown'} (${profile.email || 'No email'})`, colors.blue);
    } catch (error) {
      log(`  ❌ Profile extraction failed: ${error.message}`, colors.red);
    }
  });

  return scenarios;
}

/**
 * Display JWT token configuration guide
 */
function displayConfigurationGuide() {
  log('\n📖 JWT Token Configuration Guide', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  log('\n1. User Flow Configuration:', colors.yellow);
  log('   - Go to Azure AD B2C > User flows', colors.blue);
  log('   - Select B2C_1_signupsignin1', colors.blue);
  log('   - Go to "Application claims"', colors.blue);
  log('   - Ensure these claims are selected:', colors.blue);
  
  const userFlowClaims = [
    'Email Addresses',
    'Given Name', 
    'Surname',
    'Display Name',
    'User\'s Object ID',
    'Company (custom attribute)',
    'Role (custom attribute)',
    'Identity Provider'
  ];
  
  userFlowClaims.forEach(claim => {
    log(`     ✅ ${claim}`, colors.green);
  });

  log('\n2. Custom Policy Configuration (if using):', colors.yellow);
  log('   - Ensure OutputClaims section includes all required claims', colors.blue);
  log('   - Map extension attributes to friendly names:', colors.blue);
  log('     extension_Company → company', colors.green);
  log('     extension_Role → jobTitle', colors.green);

  log('\n3. Token Validation Setup:', colors.yellow);
  log('   - Configure JWKS URI for signature validation', colors.blue);
  log('   - Set correct issuer URL for your tenant', colors.blue);
  log('   - Use your application client ID as audience', colors.blue);
  log('   - Set appropriate clock tolerance (300 seconds)', colors.blue);

  log('\n4. Testing Procedure:', colors.yellow);
  log('   - Generate test token using Azure AD B2C user flow', colors.blue);
  log('   - Use https://jwt.ms to decode and verify token structure', colors.blue);
  log('   - Test token validation in your application', colors.blue);
  log('   - Verify user profile extraction works correctly', colors.blue);
}

/**
 * Display troubleshooting guide
 */
function displayTroubleshooting() {
  log('\n🔧 JWT Token Troubleshooting Guide', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  const issues = [
    {
      problem: 'Missing custom claims in token',
      solutions: [
        'Verify custom attributes are added to user flow "Application claims"',
        'Check that user provided values during registration',
        'Ensure custom policies include claims in OutputClaims section',
        'Test with newly registered user to verify claim collection'
      ]
    },
    {
      problem: 'Token signature validation fails',
      solutions: [
        'Verify JWKS URI is correct for your tenant and policy',
        'Check that JWKS keys are being fetched successfully',
        'Ensure token was issued by the correct Azure AD B2C tenant',
        'Verify algorithm is RS256 and key ID matches JWKS'
      ]
    },
    {
      problem: 'Invalid issuer error',
      solutions: [
        'Check issuer URL format: https://{tenant}.b2clogin.com/{tenant-id}/v2.0/',
        'Verify tenant ID and tenant name are correct',
        'Ensure policy name matches between issuer URL and actual policy',
        'Check for trailing slashes in issuer URL configuration'
      ]
    },
    {
      problem: 'Token expiration issues',
      solutions: [
        'Check system clock synchronization',
        'Configure appropriate clock tolerance (300 seconds recommended)',
        'Verify token lifetime settings in user flow properties',
        'Implement proper token refresh logic in application'
      ]
    }
  ];

  issues.forEach((issue, index) => {
    log(`\n${index + 1}. ${issue.problem}:`, colors.yellow);
    issue.solutions.forEach(solution => {
      log(`   • ${solution}`, colors.blue);
    });
  });
}

/**
 * Main function
 */
async function main() {
  const command = process.argv[2] || 'all';

  log('🚀 TaktMate Azure AD B2C JWT Token Claims Testing', colors.bright);
  log(`Environment: ${process.env.NODE_ENV || 'development'}`, colors.blue);

  switch (command) {
    case 'structure':
      testTokenStructure();
      break;
    case 'config':
      testTokenValidationConfig();
      break;
    case 'jwks':
      await testJwksEndpoint();
      break;
    case 'claims':
      testRequiredClaims();
      break;
    case 'scenarios':
      testTokenValidationScenarios();
      break;
    case 'guide':
      displayConfigurationGuide();
      break;
    case 'troubleshoot':
      displayTroubleshooting();
      break;
    case 'help':
      log('\nUsage: node test-jwt-claims.js [command]', colors.yellow);
      log('\nCommands:', colors.yellow);
      log('  structure    - Test token structure and user profile extraction', colors.blue);
      log('  config       - Test token validation configuration', colors.blue);
      log('  jwks         - Test JWKS endpoint connectivity', colors.blue);
      log('  claims       - Test required claims configuration', colors.blue);
      log('  scenarios    - Test various token validation scenarios', colors.blue);
      log('  guide        - Display configuration guide', colors.blue);
      log('  troubleshoot - Display troubleshooting guide', colors.blue);
      log('  all          - Run all tests (default)', colors.blue);
      log('  help         - Display this help', colors.blue);
      break;
    case 'all':
    default:
      // Run configuration validation first
      try {
        validateConfiguration();
        log('\n✅ Basic configuration validation passed', colors.green);
      } catch (error) {
        log(`\n❌ Configuration validation failed: ${error.message}`, colors.red);
        log('Please fix configuration issues before proceeding', colors.yellow);
        return;
      }

      // Run all tests
      testTokenStructure();
      const { configValid } = testTokenValidationConfig();
      const jwksResult = await testJwksEndpoint();
      const { missingClaims } = testRequiredClaims();
      testTokenValidationScenarios();

      // Summary
      log('\n🎯 JWT Claims Testing Summary', colors.cyan);
      log('=' .repeat(60), colors.cyan);
      
      const overallSuccess = configValid && jwksResult.success && missingClaims.length === 0;

      if (overallSuccess) {
        log('\n✅ JWT token claims configuration is ready!', colors.green);
        log('Your Azure AD B2C JWT token configuration is properly set up.', colors.green);
      } else {
        log('\n❌ JWT token claims configuration needs attention!', colors.red);
        log('Please review the issues above and update your configuration.', colors.red);
      }

      log('\n📖 Next Steps:', colors.cyan);
      log('1. Configure user flow application claims in Azure portal', colors.blue);
      log('2. Test authentication flow and verify token claims', colors.blue);
      log('3. Implement JWT token validation in your application', colors.blue);
      log('4. Proceed to Task 1.6: Test Azure AD B2C user flows', colors.blue);
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
  testTokenStructure,
  testTokenValidationConfig,
  testJwksEndpoint,
  testRequiredClaims,
  testTokenValidationScenarios,
  createSampleTokenPayload,
  createSampleCustomPolicyTokenPayload
};
