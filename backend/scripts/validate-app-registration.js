#!/usr/bin/env node

/**
 * Microsoft Entra External ID Application Registration Validator for TaktMate
 * 
 * This script validates the Microsoft Entra External ID application registration
 * configuration and tests connectivity with the registered application.
 */

const { 
  config, 
  getMetadataUrl, 
  getAuthorityUrl, 
  generateLoginUrl,
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
 * Validate application registration configuration
 */
function validateAppRegistration() {
  log('\n🔧 Application Registration Configuration Validation', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  const validationResults = {
    basicConfig: false,
    clientCredentials: false,
    redirectUris: false,
    environmentSetup: false
  };

  // Check basic configuration
  log('\n1. Basic Configuration:', colors.yellow);
  
  const requiredFields = [
    { key: 'tenantName', value: config.tenantName, description: 'Tenant Name' },
    { key: 'tenantId', value: config.tenantId, description: 'Tenant ID' },
    { key: 'domain', value: config.domain, description: 'B2C Domain' },
    { key: 'clientId', value: config.clientId, description: 'Client ID' }
  ];

  let basicConfigValid = true;
  requiredFields.forEach(field => {
    if (field.value && field.value !== 'your-tenant-id-guid' && field.value !== 'your-client-id-here') {
      log(`   ✅ ${field.description}: ${field.key === 'tenantId' || field.key === 'clientId' ? field.value.substring(0, 8) + '...' : field.value}`, colors.green);
    } else {
      log(`   ❌ ${field.description}: Not configured`, colors.red);
      basicConfigValid = false;
    }
  });

  validationResults.basicConfig = basicConfigValid;

  // Check client credentials
  log('\n2. Client Credentials:', colors.yellow);
  
  if (config.clientSecret && config.clientSecret !== 'your-client-secret-here') {
    log(`   ✅ Client Secret: Configured (${config.clientSecret.substring(0, 8)}...)`, colors.green);
    validationResults.clientCredentials = true;
  } else {
    log(`   ❌ Client Secret: Not configured`, colors.red);
    log(`   💡 Set AZURE_AD_B2C_CLIENT_SECRET in your .env file`, colors.blue);
  }

  // Check redirect URIs
  log('\n3. Redirect URIs:', colors.yellow);
  
  const redirectUris = [
    { name: 'Redirect URI', value: config.redirectUri },
    { name: 'Post Logout Redirect URI', value: config.postLogoutRedirectUri }
  ];

  let redirectUrisValid = true;
  redirectUris.forEach(uri => {
    try {
      new URL(uri.value);
      log(`   ✅ ${uri.name}: ${uri.value}`, colors.green);
    } catch (error) {
      log(`   ❌ ${uri.name}: Invalid URL - ${uri.value}`, colors.red);
      redirectUrisValid = false;
    }
  });

  validationResults.redirectUris = redirectUrisValid;

  // Check environment setup
  log('\n4. Environment Setup:', colors.yellow);
  
  const environmentVars = [
    'AZURE_AD_B2C_TENANT_ID',
    'AZURE_AD_B2C_CLIENT_ID',
    'AZURE_AD_B2C_CLIENT_SECRET',
    'AZURE_AD_B2C_REDIRECT_URI'
  ];

  let envSetupValid = true;
  environmentVars.forEach(varName => {
    if (process.env[varName] && !process.env[varName].includes('your-')) {
      log(`   ✅ ${varName}: Configured`, colors.green);
    } else {
      log(`   ❌ ${varName}: Not configured`, colors.red);
      envSetupValid = false;
    }
  });

  validationResults.environmentSetup = envSetupValid;

  return validationResults;
}

/**
 * Test Microsoft Entra External ID endpoints with application
 */
async function testApplicationEndpoints() {
  log('\n🌐 Testing Microsoft Entra External ID Endpoints', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  const endpoints = [
    {
      name: 'OpenID Configuration',
      url: getMetadataUrl(),
      expectedFields: ['authorization_endpoint', 'token_endpoint', 'issuer', 'jwks_uri']
    }
  ];

  const testResults = [];

  for (const endpoint of endpoints) {
    try {
      log(`\nTesting ${endpoint.name}:`, colors.yellow);
      log(`URL: ${endpoint.url}`, colors.blue);
      
      const response = await fetchUrl(endpoint.url);
      
      if (response.status === 200 && response.data) {
        log(`✅ Status: ${response.status} - OK`, colors.green);
        
        // Check expected fields
        let allFieldsPresent = true;
        endpoint.expectedFields.forEach(field => {
          if (response.data[field]) {
            log(`   ✅ ${field}: Present`, colors.green);
          } else {
            log(`   ❌ ${field}: Missing`, colors.red);
            allFieldsPresent = false;
          }
        });
        
        testResults.push({
          name: endpoint.name,
          success: allFieldsPresent,
          status: response.status,
          data: response.data
        });
        
      } else {
        log(`❌ Status: ${response.status} - Error`, colors.red);
        testResults.push({
          name: endpoint.name,
          success: false,
          status: response.status,
          error: response.data
        });
      }
    } catch (error) {
      log(`❌ Network Error: ${error.message}`, colors.red);
      testResults.push({
        name: endpoint.name,
        success: false,
        error: error.message
      });
    }
  }

  return testResults;
}

/**
 * Generate application authentication URLs
 */
function generateApplicationUrls() {
  log('\n🔗 Application Authentication URLs', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  const state = crypto.randomBytes(16).toString('hex');
  const nonce = crypto.randomBytes(16).toString('hex');

  const urls = [
    {
      name: 'Sign-up/Sign-in URL',
      url: generateLoginUrl(state, nonce),
      description: 'Use this URL to test user registration and login'
    },
    {
      name: 'Logout URL',
      url: generateLogoutUrl(),
      description: 'Use this URL to test user logout'
    }
  ];

  log(`\nGenerated with:`, colors.yellow);
  log(`State: ${state}`, colors.blue);
  log(`Nonce: ${nonce}`, colors.blue);

  urls.forEach(urlInfo => {
    log(`\n${urlInfo.name}:`, colors.yellow);
    log(`${urlInfo.url}`, colors.green);
    log(`Description: ${urlInfo.description}`, colors.magenta);
  });

  return { urls, state, nonce };
}

/**
 * Display application registration checklist
 */
function displayRegistrationChecklist() {
  log('\n📋 Application Registration Checklist', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  const checklist = [
    {
      item: 'Application registered in Microsoft Entra External ID',
      description: 'Create "TaktMate CSV Chat Application" in App registrations'
    },
    {
      item: 'Client ID obtained and configured',
      description: 'Copy Application (client) ID to AZURE_AD_B2C_CLIENT_ID'
    },
    {
      item: 'Client Secret created and configured',
      description: 'Create client secret and copy to AZURE_AD_B2C_CLIENT_SECRET'
    },
    {
      item: 'Redirect URIs configured',
      description: 'Add development and production redirect URIs in Authentication'
    },
    {
      item: 'API permissions granted',
      description: 'Grant openid, profile, email, offline_access permissions'
    },
    {
      item: 'Application added to user flows',
      description: 'Add application to B2C_1_signupsignin1 user flow'
    },
    {
      item: 'Authentication flow tested',
      description: 'Test complete authentication flow with jwt.ms'
    }
  ];

  checklist.forEach((check, index) => {
    log(`\n${index + 1}. ${check.item}:`, colors.yellow);
    log(`   ${check.description}`, colors.blue);
  });
}

/**
 * Display troubleshooting guide
 */
function displayTroubleshooting() {
  log('\n🔧 Troubleshooting Common Issues', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  const issues = [
    {
      problem: 'Invalid client_id error',
      solutions: [
        'Verify AZURE_AD_B2C_CLIENT_ID matches Application (client) ID in Azure portal',
        'Ensure you are using the B2C tenant, not the regular Azure AD tenant',
        'Check that the application is registered in the correct B2C tenant'
      ]
    },
    {
      problem: 'Invalid redirect_uri error',
      solutions: [
        'Verify redirect URI in Azure portal matches AZURE_AD_B2C_REDIRECT_URI exactly',
        'Ensure redirect URI includes the correct protocol (http/https)',
        'Check that redirect URI is added to the Authentication section of the app registration'
      ]
    },
    {
      problem: 'Token validation errors',
      solutions: [
        'Verify issuer URL matches your B2C tenant and policy',
        'Check that client ID in token matches your application registration',
        'Ensure token is not expired and was issued for your application'
      ]
    },
    {
      problem: 'Missing custom claims in token',
      solutions: [
        'Verify custom attributes are added to user flow Application claims',
        'Check that user has provided values for Company and Role during registration',
        'Ensure custom policies are properly configured if using custom policies'
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
 * Display next steps
 */
function displayNextSteps() {
  log('\n📖 Next Steps', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  const steps = [
    'Complete application registration in Microsoft Entra External ID portal',
    'Update environment variables with client ID and secret',
    'Test authentication flow using generated URLs',
    'Verify JWT tokens contain expected claims',
    'Proceed to Task 1.5: Configure JWT token claims validation'
  ];

  steps.forEach((step, index) => {
    log(`${index + 1}. ${step}`, colors.blue);
  });
}

/**
 * Main function
 */
async function main() {
  const command = process.argv[2] || 'all';

  log('🚀 TaktMate Microsoft Entra External ID Application Registration Validator', colors.bright);
  log(`Environment: ${process.env.NODE_ENV || 'development'}`, colors.blue);

  switch (command) {
    case 'config':
      validateAppRegistration();
      break;
    case 'endpoints':
      await testApplicationEndpoints();
      break;
    case 'urls':
      generateApplicationUrls();
      break;
    case 'checklist':
      displayRegistrationChecklist();
      break;
    case 'troubleshoot':
      displayTroubleshooting();
      break;
    case 'help':
      log('\nUsage: node validate-app-registration.js [command]', colors.yellow);
      log('\nCommands:', colors.yellow);
      log('  config       - Validate application configuration', colors.blue);
      log('  endpoints    - Test Microsoft Entra External ID endpoints', colors.blue);
      log('  urls         - Generate authentication URLs', colors.blue);
      log('  checklist    - Display registration checklist', colors.blue);
      log('  troubleshoot - Display troubleshooting guide', colors.blue);
      log('  all          - Run all validations (default)', colors.blue);
      log('  help         - Display this help', colors.blue);
      break;
    case 'all':
    default:
      const validationResults = validateAppRegistration();
      const endpointResults = await testApplicationEndpoints();
      generateApplicationUrls();
      
      log('\n🎯 Validation Summary', colors.cyan);
      log('=' .repeat(60), colors.cyan);
      
      const overallSuccess = validationResults.basicConfig && 
                           validationResults.clientCredentials && 
                           validationResults.redirectUris && 
                           validationResults.environmentSetup &&
                           endpointResults.every(r => r.success);

      if (overallSuccess) {
        log('\n✅ Application registration validation passed!', colors.green);
        log('Your Microsoft Entra External ID application is properly configured.', colors.green);
      } else {
        log('\n❌ Application registration validation failed!', colors.red);
        log('Please review the issues above and update your configuration.', colors.red);
      }
      
      displayNextSteps();
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
  validateAppRegistration,
  testApplicationEndpoints,
  generateApplicationUrls
};
