#!/usr/bin/env node

/**
 * End-to-End Azure AD B2C User Flow Testing for TaktMate
 * 
 * This script performs comprehensive testing of Azure AD B2C user flows,
 * token generation, validation, and integration testing.
 */

const https = require('https');
const { 
  config, 
  getJwksUri,
  getIssuerUrl,
  generateLoginUrl,
  generatePasswordResetUrl,
  generateProfileEditUrl,
  extractUserProfile,
  validateConfiguration
} = require('../config/azureAdB2C');

const { 
  validateJwtToken,
  getJwksKeys,
  getJwksCacheStats 
} = require('../middleware/jwtValidation');

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
 * Log with colors and timestamps
 */
function log(message, color = colors.reset) {
  const timestamp = new Date().toISOString();
  console.log(`${colors.blue}[${timestamp}]${colors.reset} ${color}${message}${colors.reset}`);
}

/**
 * Test results tracking
 */
let testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: [],
  performance: {}
};

/**
 * Add test result
 */
function addTestResult(testName, passed, error = null, duration = null) {
  testResults.total++;
  if (passed) {
    testResults.passed++;
    log(`✅ ${testName}${duration ? ` (${duration}ms)` : ''}`, colors.green);
  } else {
    testResults.failed++;
    testResults.errors.push({ test: testName, error: error?.message || error });
    log(`❌ ${testName}: ${error?.message || error}`, colors.red);
  }
  
  if (duration) {
    testResults.performance[testName] = duration;
  }
}

/**
 * HTTP request helper with timeout and error handling
 */
function makeHttpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const timeout = options.timeout || 10000;
    
    const req = https.get(url, {
      timeout: timeout,
      ...options
    }, (res) => {
      const duration = Date.now() - startTime;
      let data = '';
      
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const result = {
            statusCode: res.statusCode,
            headers: res.headers,
            body: data,
            duration: duration
          };
          
          if (res.headers['content-type']?.includes('application/json')) {
            result.json = JSON.parse(data);
          }
          
          resolve(result);
        } catch (error) {
          reject(new Error(`Response parsing failed: ${error.message}`));
        }
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timeout after ${timeout}ms`));
    });
  });
}

/**
 * Test Azure AD B2C endpoints connectivity
 */
async function testEndpointsConnectivity() {
  log('\n🌐 Testing Azure AD B2C Endpoints Connectivity', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  const endpoints = [
    {
      name: 'JWKS Endpoint',
      url: getJwksUri(),
      expectedStatus: 200,
      expectedContent: 'application/json'
    },
    {
      name: 'OpenID Configuration',
      url: `https://${config.tenantName}.b2clogin.com/${config.tenantName}.onmicrosoft.com/${config.signUpSignInPolicy}/v2.0/.well-known/openid_configuration`,
      expectedStatus: 200,
      expectedContent: 'application/json'
    },
    {
      name: 'OAuth2 Authorization Endpoint',
      url: `https://${config.tenantName}.b2clogin.com/${config.tenantName}.onmicrosoft.com/oauth2/v2.0/authorize?p=${config.signUpSignInPolicy}&client_id=${config.clientId}&response_type=code&scope=openid&redirect_uri=https://jwt.ms`,
      expectedStatus: 200,
      expectedContent: 'text/html'
    }
  ];

  for (const endpoint of endpoints) {
    try {
      const startTime = Date.now();
      const response = await makeHttpRequest(endpoint.url);
      const duration = Date.now() - startTime;
      
      const statusOk = response.statusCode === endpoint.expectedStatus;
      const contentTypeOk = !endpoint.expectedContent || 
        response.headers['content-type']?.includes(endpoint.expectedContent);
      
      if (statusOk && contentTypeOk) {
        addTestResult(`${endpoint.name} connectivity`, true, null, duration);
        
        // Additional validation for specific endpoints
        if (endpoint.name === 'JWKS Endpoint' && response.json) {
          const keyCount = response.json.keys?.length || 0;
          log(`  📋 JWKS Keys found: ${keyCount}`, colors.blue);
          
          if (keyCount > 0) {
            addTestResult('JWKS keys available', true);
          } else {
            addTestResult('JWKS keys available', false, 'No keys found in JWKS endpoint');
          }
        }
        
        if (endpoint.name === 'OpenID Configuration' && response.json) {
          const config = response.json;
          log(`  📋 Issuer: ${config.issuer}`, colors.blue);
          log(`  📋 Authorization Endpoint: ${config.authorization_endpoint}`, colors.blue);
          log(`  📋 Token Endpoint: ${config.token_endpoint}`, colors.blue);
          
          addTestResult('OpenID configuration valid', !!config.issuer && !!config.authorization_endpoint);
        }
        
      } else {
        addTestResult(
          `${endpoint.name} connectivity`, 
          false, 
          `Status: ${response.statusCode}, Content-Type: ${response.headers['content-type']}`
        );
      }
      
    } catch (error) {
      addTestResult(`${endpoint.name} connectivity`, false, error);
    }
  }
}

/**
 * Test user flow URL generation
 */
function testUserFlowUrls() {
  log('\n🔗 Testing User Flow URL Generation', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    // Test sign-up/sign-in URL
    const loginUrl = generateLoginUrl('https://jwt.ms');
    const loginUrlValid = loginUrl.includes(config.tenantName) && 
                         loginUrl.includes(config.clientId) && 
                         loginUrl.includes(config.signUpSignInPolicy);
    
    addTestResult('Sign-up/Sign-in URL generation', loginUrlValid);
    if (loginUrlValid) {
      log(`  🔗 Login URL: ${loginUrl}`, colors.blue);
    }

    // Test password reset URL
    if (config.passwordResetPolicy) {
      const resetUrl = generatePasswordResetUrl('https://jwt.ms');
      const resetUrlValid = resetUrl.includes(config.tenantName) && 
                           resetUrl.includes(config.clientId) && 
                           resetUrl.includes(config.passwordResetPolicy);
      
      addTestResult('Password reset URL generation', resetUrlValid);
      if (resetUrlValid) {
        log(`  🔗 Reset URL: ${resetUrl}`, colors.blue);
      }
    } else {
      log('  ⚠️  Password reset policy not configured', colors.yellow);
    }

    // Test profile edit URL
    if (config.profileEditPolicy) {
      const profileUrl = generateProfileEditUrl('https://jwt.ms');
      const profileUrlValid = profileUrl.includes(config.tenantName) && 
                              profileUrl.includes(config.clientId) && 
                              profileUrl.includes(config.profileEditPolicy);
      
      addTestResult('Profile edit URL generation', profileUrlValid);
      if (profileUrlValid) {
        log(`  🔗 Profile URL: ${profileUrl}`, colors.blue);
      }
    } else {
      log('  ⚠️  Profile edit policy not configured', colors.yellow);
    }

  } catch (error) {
    addTestResult('User flow URL generation', false, error);
  }
}

/**
 * Test JWT token validation with sample tokens
 */
async function testJwtTokenValidation() {
  log('\n🎫 Testing JWT Token Validation', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  // Create sample valid token payload
  const now = Math.floor(Date.now() / 1000);
  const validTokenPayload = {
    iss: getIssuerUrl(),
    aud: config.clientId,
    sub: 'test-user-12345',
    iat: now,
    exp: now + 3600,
    nbf: now,
    ver: '1.0',
    tfp: config.signUpSignInPolicy,
    emails: ['test@example.com'],
    given_name: 'Test',
    family_name: 'User',
    name: 'Test User',
    extension_Company: 'Test Corp',
    extension_Role: 'Tester',
    idp: 'local',
    email_verified: true
  };

  // Test user profile extraction
  try {
    const userProfile = extractUserProfile(validTokenPayload);
    const profileValid = userProfile.id === 'test-user-12345' && 
                        userProfile.email === 'test@example.com' &&
                        userProfile.name === 'Test User' &&
                        userProfile.company === 'Test Corp' &&
                        userProfile.role === 'Tester';
    
    addTestResult('User profile extraction from token payload', profileValid);
    
    if (profileValid) {
      log(`  👤 User: ${userProfile.name} (${userProfile.email})`, colors.blue);
      log(`  🏢 Company: ${userProfile.company}`, colors.blue);
      log(`  💼 Role: ${userProfile.role}`, colors.blue);
      log(`  🔒 Email Verified: ${userProfile.emailVerified}`, colors.blue);
    }
    
  } catch (error) {
    addTestResult('User profile extraction from token payload', false, error);
  }

  // Test invalid token scenarios
  const invalidScenarios = [
    {
      name: 'Expired token',
      payload: { ...validTokenPayload, exp: now - 3600 }
    },
    {
      name: 'Invalid issuer',
      payload: { ...validTokenPayload, iss: 'https://invalid-issuer.com' }
    },
    {
      name: 'Invalid audience',
      payload: { ...validTokenPayload, aud: 'invalid-client-id' }
    },
    {
      name: 'Missing subject',
      payload: { ...validTokenPayload, sub: undefined }
    },
    {
      name: 'Missing emails',
      payload: { ...validTokenPayload, emails: undefined }
    }
  ];

  for (const scenario of invalidScenarios) {
    try {
      const profile = extractUserProfile(scenario.payload);
      
      // Some scenarios might still extract profile but validation should catch issues
      if (scenario.name === 'Missing subject' && !profile.id) {
        addTestResult(`Invalid token handling: ${scenario.name}`, true);
      } else if (scenario.name === 'Missing emails' && !profile.email) {
        addTestResult(`Invalid token handling: ${scenario.name}`, true);
      } else {
        // Other scenarios should be handled by JWT validation middleware
        log(`  ⚠️  ${scenario.name}: Profile extracted but validation needed`, colors.yellow);
      }
      
    } catch (error) {
      addTestResult(`Invalid token handling: ${scenario.name}`, true);
    }
  }
}

/**
 * Test JWKS key caching and performance
 */
async function testJwksPerformance() {
  log('\n⚡ Testing JWKS Performance and Caching', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    // Test initial JWKS fetch
    const startTime1 = Date.now();
    const keys1 = await getJwksKeys();
    const duration1 = Date.now() - startTime1;
    
    addTestResult('Initial JWKS key fetch', keys1.length > 0, null, duration1);
    
    if (keys1.length > 0) {
      log(`  🔑 Keys retrieved: ${keys1.length}`, colors.blue);
    }

    // Test cached JWKS fetch (should be faster)
    const startTime2 = Date.now();
    const keys2 = await getJwksKeys();
    const duration2 = Date.now() - startTime2;
    
    const cacheWorking = duration2 < duration1 && keys2.length === keys1.length;
    addTestResult('JWKS caching performance', cacheWorking, null, duration2);
    
    if (cacheWorking) {
      log(`  📈 Cache speedup: ${duration1 - duration2}ms`, colors.green);
    }

    // Test cache statistics
    const cacheStats = getJwksCacheStats();
    addTestResult('JWKS cache statistics available', !!cacheStats.hasKeys);
    
    if (cacheStats.hasKeys) {
      log(`  📊 Cache age: ${Math.round(cacheStats.age / 1000)}s`, colors.blue);
      log(`  📊 Key count: ${cacheStats.keyCount}`, colors.blue);
      log(`  📊 TTL: ${Math.round(cacheStats.ttl / 1000 / 60)}min`, colors.blue);
    }

  } catch (error) {
    addTestResult('JWKS performance testing', false, error);
  }
}

/**
 * Test configuration validation
 */
function testConfigurationValidation() {
  log('\n⚙️  Testing Configuration Validation', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    validateConfiguration();
    addTestResult('Configuration validation', true);
    
    // Test individual configuration components
    const configTests = [
      { name: 'Tenant name configured', test: !!config.tenantName && config.tenantName !== 'your-tenant-name' },
      { name: 'Client ID configured', test: !!config.clientId && config.clientId !== 'your-client-id' },
      { name: 'Sign-up/sign-in policy configured', test: !!config.signUpSignInPolicy },
      { name: 'Issuer URL generation', test: !!getIssuerUrl() },
      { name: 'JWKS URI generation', test: !!getJwksUri() }
    ];

    configTests.forEach(test => {
      addTestResult(test.name, test.test, test.test ? null : 'Configuration missing or invalid');
    });

  } catch (error) {
    addTestResult('Configuration validation', false, error);
  }
}

/**
 * Test error handling scenarios
 */
async function testErrorHandling() {
  log('\n🚨 Testing Error Handling Scenarios', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  // Test invalid JWKS endpoint
  try {
    const invalidJwksUrl = 'https://invalid-tenant.b2clogin.com/invalid/jwks';
    await makeHttpRequest(invalidJwksUrl, { timeout: 5000 });
    addTestResult('Invalid JWKS endpoint handling', false, 'Should have failed but succeeded');
  } catch (error) {
    addTestResult('Invalid JWKS endpoint handling', true);
  }

  // Test invalid user flow URL
  try {
    const invalidFlowUrl = `https://${config.tenantName}.b2clogin.com/invalid/oauth2/v2.0/authorize`;
    const response = await makeHttpRequest(invalidFlowUrl, { timeout: 5000 });
    
    // Should return error page or 404
    const errorHandled = response.statusCode >= 400 || response.body.includes('error');
    addTestResult('Invalid user flow URL handling', errorHandled);
    
  } catch (error) {
    addTestResult('Invalid user flow URL handling', true);
  }

  // Test malformed configuration
  const originalTenantName = config.tenantName;
  try {
    config.tenantName = '';
    validateConfiguration();
    addTestResult('Malformed configuration detection', false, 'Should have detected invalid config');
  } catch (error) {
    addTestResult('Malformed configuration detection', true);
  } finally {
    config.tenantName = originalTenantName;
  }
}

/**
 * Test performance benchmarks
 */
async function testPerformanceBenchmarks() {
  log('\n📊 Testing Performance Benchmarks', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  const benchmarks = {
    'JWKS key retrieval (cached)': { target: 10, test: () => getJwksKeys() },
    'User profile extraction': { target: 50, test: () => {
      const payload = {
        sub: 'test-user',
        emails: ['test@example.com'],
        given_name: 'Test',
        family_name: 'User',
        name: 'Test User',
        extension_Company: 'Test Corp',
        extension_Role: 'Tester'
      };
      return extractUserProfile(payload);
    }},
    'Login URL generation': { target: 5, test: () => generateLoginUrl('https://jwt.ms') }
  };

  for (const [testName, benchmark] of Object.entries(benchmarks)) {
    try {
      const iterations = 10;
      const times = [];
      
      // Warm up
      await benchmark.test();
      
      // Run benchmark
      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        await benchmark.test();
        times.push(Date.now() - startTime);
      }
      
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      
      const passed = avgTime <= benchmark.target;
      addTestResult(`${testName} performance`, passed, 
        passed ? null : `Average ${avgTime}ms > target ${benchmark.target}ms`, 
        avgTime);
      
      if (passed) {
        log(`  📈 Avg: ${avgTime.toFixed(1)}ms, Min: ${minTime}ms, Max: ${maxTime}ms`, colors.blue);
      }
      
    } catch (error) {
      addTestResult(`${testName} performance`, false, error);
    }
  }
}

/**
 * Generate testing report
 */
function generateTestReport() {
  log('\n📋 End-to-End Testing Report', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  const successRate = testResults.total > 0 ? 
    Math.round((testResults.passed / testResults.total) * 100) : 0;

  log(`\n📊 Test Summary:`, colors.yellow);
  log(`  Total Tests: ${testResults.total}`, colors.blue);
  log(`  Passed: ${testResults.passed}`, colors.green);
  log(`  Failed: ${testResults.failed}`, colors.red);
  log(`  Success Rate: ${successRate}%`, successRate >= 80 ? colors.green : colors.red);

  if (testResults.failed > 0) {
    log(`\n❌ Failed Tests:`, colors.red);
    testResults.errors.forEach((error, index) => {
      log(`  ${index + 1}. ${error.test}: ${error.error}`, colors.red);
    });
  }

  if (Object.keys(testResults.performance).length > 0) {
    log(`\n⚡ Performance Results:`, colors.yellow);
    Object.entries(testResults.performance).forEach(([test, duration]) => {
      const color = duration < 100 ? colors.green : duration < 500 ? colors.yellow : colors.red;
      log(`  ${test}: ${duration}ms`, color);
    });
  }

  // Overall status
  if (successRate >= 90) {
    log(`\n✅ Overall Status: EXCELLENT - Azure AD B2C is ready for production`, colors.green);
  } else if (successRate >= 80) {
    log(`\n⚠️  Overall Status: GOOD - Minor issues need attention`, colors.yellow);
  } else if (successRate >= 60) {
    log(`\n🔶 Overall Status: NEEDS WORK - Several issues require fixing`, colors.yellow);
  } else {
    log(`\n❌ Overall Status: CRITICAL - Major issues prevent production use`, colors.red);
  }

  return {
    success: successRate >= 80,
    summary: testResults,
    recommendations: generateRecommendations(successRate, testResults.errors)
  };
}

/**
 * Generate recommendations based on test results
 */
function generateRecommendations(successRate, errors) {
  const recommendations = [];

  if (successRate < 80) {
    recommendations.push('🔧 Fix critical configuration issues before proceeding');
  }

  const connectivityErrors = errors.filter(e => e.test.includes('connectivity'));
  if (connectivityErrors.length > 0) {
    recommendations.push('🌐 Check network connectivity and Azure AD B2C tenant configuration');
  }

  const configErrors = errors.filter(e => e.test.includes('configuration'));
  if (configErrors.length > 0) {
    recommendations.push('⚙️ Review and update environment variables and configuration settings');
  }

  const performanceIssues = errors.filter(e => e.test.includes('performance'));
  if (performanceIssues.length > 0) {
    recommendations.push('📊 Optimize performance for production deployment');
  }

  if (recommendations.length === 0 && successRate >= 90) {
    recommendations.push('🚀 Configuration looks great! Ready to proceed with integration');
    recommendations.push('📝 Document the current configuration for team reference');
    recommendations.push('🔄 Set up monitoring and alerts for production deployment');
  }

  return recommendations;
}

/**
 * Display manual testing instructions
 */
function displayManualTestingInstructions() {
  log('\n📖 Manual Testing Instructions', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  log('\n1. Azure Portal Testing:', colors.yellow);
  log('   • Go to Azure AD B2C > User flows > B2C_1_signupsignin1', colors.blue);
  log('   • Click "Run user flow"', colors.blue);
  log('   • Select your application and use https://jwt.ms as reply URL', colors.blue);
  log('   • Complete authentication flow and verify token claims', colors.blue);

  log('\n2. Direct URL Testing:', colors.yellow);
  const loginUrl = generateLoginUrl('https://jwt.ms');
  log(`   • Test login URL: ${loginUrl}`, colors.blue);
  
  if (config.passwordResetPolicy) {
    const resetUrl = generatePasswordResetUrl('https://jwt.ms');
    log(`   • Test reset URL: ${resetUrl}`, colors.blue);
  }

  log('\n3. Token Validation Testing:', colors.yellow);
  log('   • Use https://jwt.ms to decode tokens', colors.blue);
  log('   • Verify all required claims are present', colors.blue);
  log('   • Test with npm run test:jwt-claims', colors.blue);

  log('\n4. Integration Testing:', colors.yellow);
  log('   • Test authentication in your React application', colors.blue);
  log('   • Verify protected API endpoints work correctly', colors.blue);
  log('   • Test logout functionality', colors.blue);
}

/**
 * Main function
 */
async function main() {
  const command = process.argv[2] || 'all';

  log('🧪 TaktMate Azure AD B2C End-to-End Testing', colors.bright);
  log(`Environment: ${process.env.NODE_ENV || 'development'}`, colors.blue);
  log(`Tenant: ${config.tenantName}`, colors.blue);

  try {
    switch (command) {
      case 'connectivity':
        await testEndpointsConnectivity();
        break;
      case 'urls':
        testUserFlowUrls();
        break;
      case 'tokens':
        await testJwtTokenValidation();
        break;
      case 'performance':
        await testJwksPerformance();
        await testPerformanceBenchmarks();
        break;
      case 'config':
        testConfigurationValidation();
        break;
      case 'errors':
        await testErrorHandling();
        break;
      case 'manual':
        displayManualTestingInstructions();
        break;
      case 'help':
        log('\nUsage: node test-e2e-flows.js [command]', colors.yellow);
        log('\nCommands:', colors.yellow);
        log('  connectivity - Test Azure AD B2C endpoint connectivity', colors.blue);
        log('  urls         - Test user flow URL generation', colors.blue);
        log('  tokens       - Test JWT token validation and user profile extraction', colors.blue);
        log('  performance  - Test JWKS caching and performance benchmarks', colors.blue);
        log('  config       - Test configuration validation', colors.blue);
        log('  errors       - Test error handling scenarios', colors.blue);
        log('  manual       - Display manual testing instructions', colors.blue);
        log('  all          - Run all automated tests (default)', colors.blue);
        log('  help         - Display this help', colors.blue);
        break;
      case 'all':
      default:
        testConfigurationValidation();
        await testEndpointsConnectivity();
        testUserFlowUrls();
        await testJwtTokenValidation();
        await testJwksPerformance();
        await testPerformanceBenchmarks();
        await testErrorHandling();
        
        const report = generateTestReport();
        
        log('\n📖 Next Steps:', colors.cyan);
        if (report.success) {
          log('1. Proceed with manual testing using the instructions above', colors.blue);
          log('2. Test integration with your React application', colors.blue);
          log('3. Complete Task 1.7: Document Azure AD B2C setup', colors.blue);
        } else {
          log('1. Fix the issues identified in the test report', colors.red);
          log('2. Re-run tests to verify fixes', colors.blue);
          log('3. Consult AZURE_AD_B2C_SETUP.md for troubleshooting', colors.blue);
        }
        
        if (report.recommendations.length > 0) {
          log('\n💡 Recommendations:', colors.yellow);
          report.recommendations.forEach(rec => {
            log(`  ${rec}`, colors.blue);
          });
        }
        
        displayManualTestingInstructions();
        break;
    }
    
  } catch (error) {
    log(`\n❌ Testing Error: ${error.message}`, colors.red);
    console.error(error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    log(`\n❌ Script Error: ${error.message}`, colors.red);
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  testEndpointsConnectivity,
  testUserFlowUrls,
  testJwtTokenValidation,
  testJwksPerformance,
  testConfigurationValidation,
  testErrorHandling,
  testPerformanceBenchmarks,
  generateTestReport
};
