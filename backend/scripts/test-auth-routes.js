#!/usr/bin/env node

/**
 * Authentication Routes Testing Utility for TaktMate
 * 
 * This script tests all authentication routes with various scenarios
 * including configuration, URL generation, token validation, and error handling.
 */

const express = require('express');
const request = require('supertest');
const { 
  config,
  validateConfiguration,
  getConfigurationStatus
} = require('../config/azureAdB2C');

// Import the auth routes
const authRoutes = require('../routes/auth');

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
  performance: {},
  endpoints: {}
};

/**
 * Add test result
 */
function addTestResult(testName, passed, error = null, duration = null, endpoint = null) {
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
  
  if (endpoint) {
    if (!testResults.endpoints[endpoint]) {
      testResults.endpoints[endpoint] = { total: 0, passed: 0, failed: 0 };
    }
    testResults.endpoints[endpoint].total++;
    if (passed) {
      testResults.endpoints[endpoint].passed++;
    } else {
      testResults.endpoints[endpoint].failed++;
    }
  }
}

/**
 * Create Express app for testing
 */
function createTestApp() {
  const app = express();
  
  // Basic middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Add IP address for testing
  app.use((req, res, next) => {
    req.ip = req.ip || '127.0.0.1';
    next();
  });
  
  // Mount auth routes
  app.use('/auth', authRoutes);
  
  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  
  return app;
}

/**
 * Test configuration endpoint
 */
async function testConfigurationEndpoint(app) {
  log('\n⚙️  Testing Configuration Endpoint', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    const startTime = Date.now();
    const response = await request(app)
      .get('/auth/config')
      .expect('Content-Type', /json/);
    
    const duration = Date.now() - startTime;
    
    // Test successful response
    const testPassed = response.status === 200 && 
                      response.body.success === true &&
                      response.body.configured !== undefined &&
                      response.body.config &&
                      response.body.endpoints &&
                      response.body.features;
    
    addTestResult('GET /auth/config - Success Response', testPassed, null, duration, '/auth/config');
    
    if (testPassed) {
      // Test response structure
      const hasRequiredFields = !!(
        response.body.config.tenant &&
        response.body.config.policies &&
        response.body.endpoints.login &&
        response.body.features.socialLogin
      );
      
      addTestResult('Configuration Response Structure', hasRequiredFields);
      
      // Test security (no sensitive data exposed)
      const isSafe = !(
        response.body.config.tenant.id?.length > 10 ||
        response.body.config.application?.clientId?.length > 10
      );
      
      addTestResult('Configuration Security (No Full IDs)', isSafe);
      
      // Log configuration summary
      if (config.debugAuth) {
        log(`  📋 Tenant: ${response.body.config.tenant.name}`, colors.blue);
        log(`  📋 Configured: ${response.body.configured}`, colors.blue);
        log(`  📋 Features: ${Object.keys(response.body.features).length}`, colors.blue);
      }
    }
    
  } catch (error) {
    addTestResult('GET /auth/config', false, error, null, '/auth/config');
  }
}

/**
 * Test login URL generation endpoint
 */
async function testLoginUrlEndpoint(app) {
  log('\n🔗 Testing Login URL Generation', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  // Test basic login URL generation
  try {
    const startTime = Date.now();
    const response = await request(app)
      .get('/auth/login-url')
      .expect('Content-Type', /json/);
    
    const duration = Date.now() - startTime;
    
    const testPassed = response.status === 200 && 
                      response.body.success === true &&
                      response.body.loginUrl &&
                      response.body.loginUrl.includes('b2clogin.com');
    
    addTestResult('GET /auth/login-url - Basic Generation', testPassed, null, duration, '/auth/login-url');
    
    if (testPassed && config.debugAuth) {
      log(`  🔗 Login URL: ${response.body.loginUrl.substring(0, 80)}...`, colors.blue);
    }
    
  } catch (error) {
    addTestResult('GET /auth/login-url - Basic', false, error, null, '/auth/login-url');
  }

  // Test password reset URL generation
  try {
    const startTime = Date.now();
    const response = await request(app)
      .get('/auth/password-reset-url')
      .expect('Content-Type', /json/);
    
    const duration = Date.now() - startTime;
    
    const testPassed = response.status === 200 && 
                      response.body.success === true &&
                      response.body.passwordResetUrl;
    
    addTestResult('GET /auth/password-reset-url', testPassed, null, duration, '/auth/password-reset-url');
    
  } catch (error) {
    addTestResult('GET /auth/password-reset-url', false, error, null, '/auth/password-reset-url');
  }

  // Test profile edit URL generation
  try {
    const startTime = Date.now();
    const response = await request(app)
      .get('/auth/profile-edit-url')
      .expect('Content-Type', /json/);
    
    const duration = Date.now() - startTime;
    
    const testPassed = response.status === 200 && 
                      response.body.success === true &&
                      response.body.profileEditUrl;
    
    addTestResult('GET /auth/profile-edit-url', testPassed, null, duration, '/auth/profile-edit-url');
    
  } catch (error) {
    addTestResult('GET /auth/profile-edit-url', false, error, null, '/auth/profile-edit-url');
  }
}

/**
 * Test token validation endpoint
 */
async function testTokenValidationEndpoint(app) {
  log('\n🎫 Testing Token Validation Endpoint', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  // Test missing token
  try {
    const startTime = Date.now();
    const response = await request(app)
      .post('/auth/validate')
      .send({})
      .expect('Content-Type', /json/);
    
    const duration = Date.now() - startTime;
    
    const testPassed = response.status === 400 && 
                      response.body.success === false &&
                      response.body.code === 'VALIDATION_ERROR';
    
    addTestResult('POST /auth/validate - Missing Token', testPassed, null, duration, '/auth/validate');
    
  } catch (error) {
    addTestResult('POST /auth/validate - Missing Token', false, error, null, '/auth/validate');
  }

  // Test invalid token
  try {
    const startTime = Date.now();
    const response = await request(app)
      .post('/auth/validate')
      .send({ token: 'invalid-token-123' })
      .expect('Content-Type', /json/);
    
    const duration = Date.now() - startTime;
    
    const testPassed = response.status === 401 && 
                      response.body.success === true &&
                      response.body.valid === false;
    
    addTestResult('POST /auth/validate - Invalid Token', testPassed, null, duration, '/auth/validate');
    
  } catch (error) {
    addTestResult('POST /auth/validate - Invalid Token', false, error, null, '/auth/validate');
  }

  // Test malformed token
  try {
    const startTime = Date.now();
    const response = await request(app)
      .post('/auth/validate')
      .send({ token: 'not.a.valid.jwt.token.structure' })
      .expect('Content-Type', /json/);
    
    const duration = Date.now() - startTime;
    
    const testPassed = response.status === 401 && 
                      response.body.success === true &&
                      response.body.valid === false;
    
    addTestResult('POST /auth/validate - Malformed Token', testPassed, null, duration, '/auth/validate');
    
  } catch (error) {
    addTestResult('POST /auth/validate - Malformed Token', false, error, null, '/auth/validate');
  }
}

/**
 * Test JWKS statistics endpoint
 */
async function testJwksStatsEndpoint(app) {
  log('\n📊 Testing JWKS Statistics Endpoint', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    const startTime = Date.now();
    const response = await request(app)
      .get('/auth/jwks-stats')
      .expect('Content-Type', /json/);
    
    const duration = Date.now() - startTime;
    
    const testPassed = response.status === 200 && 
                      response.body.success === true &&
                      response.body.cache &&
                      response.body.endpoints;
    
    addTestResult('GET /auth/jwks-stats', testPassed, null, duration, '/auth/jwks-stats');
    
    if (testPassed && config.debugAuth) {
      log(`  📊 Cache TTL: ${response.body.cache?.ttl || 'N/A'}ms`, colors.blue);
      log(`  📊 JWKS URI: ${response.body.endpoints?.jwksUri?.substring(0, 60)}...`, colors.blue);
    }
    
  } catch (error) {
    addTestResult('GET /auth/jwks-stats', false, error, null, '/auth/jwks-stats');
  }
}

/**
 * Test status endpoint
 */
async function testStatusEndpoint(app) {
  log('\n🏥 Testing Status Endpoint', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    const startTime = Date.now();
    const response = await request(app)
      .get('/auth/status')
      .expect('Content-Type', /json/);
    
    const duration = Date.now() - startTime;
    
    const testPassed = response.status === 200 && 
                      response.body.success === true &&
                      response.body.authenticated !== undefined &&
                      response.body.system;
    
    addTestResult('GET /auth/status', testPassed, null, duration, '/auth/status');
    
    if (testPassed && config.debugAuth) {
      log(`  🏥 Authenticated: ${response.body.authenticated}`, colors.blue);
      log(`  🏥 System Status: ${response.body.system.status}`, colors.blue);
    }
    
  } catch (error) {
    addTestResult('GET /auth/status', false, error, null, '/auth/status');
  }
}

/**
 * Test logout endpoint
 */
async function testLogoutEndpoint(app) {
  log('\n🚪 Testing Logout Endpoint', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    const startTime = Date.now();
    const response = await request(app)
      .post('/auth/logout')
      .expect('Content-Type', /json/);
    
    const duration = Date.now() - startTime;
    
    const testPassed = response.status === 200 && 
                      response.body.success === true &&
                      response.body.clearTokens === true;
    
    addTestResult('POST /auth/logout', testPassed, null, duration, '/auth/logout');
    
  } catch (error) {
    addTestResult('POST /auth/logout', false, error, null, '/auth/logout');
  }
}

/**
 * Test rate limiting
 */
async function testRateLimiting(app) {
  log('\n🚫 Testing Rate Limiting', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  // Only test if rate limiting is enabled
  if (!config.rateLimiting) {
    log('⚠️  Rate limiting disabled, skipping tests', colors.yellow);
    return;
  }

  try {
    // Make multiple rapid requests to trigger rate limiting
    const requests = [];
    for (let i = 0; i < 25; i++) {
      requests.push(
        request(app)
          .post('/auth/validate')
          .send({ token: 'test-token' })
      );
    }

    const responses = await Promise.all(requests);
    const rateLimitedResponses = responses.filter(res => res.status === 429);
    
    const testPassed = rateLimitedResponses.length > 0;
    
    addTestResult('Rate Limiting Enforcement', testPassed);
    
    if (testPassed && config.debugAuth) {
      log(`  🚫 Rate limited after ${responses.length - rateLimitedResponses.length} requests`, colors.blue);
    }
    
  } catch (error) {
    addTestResult('Rate Limiting Test', false, error);
  }
}

/**
 * Test error handling
 */
async function testErrorHandling(app) {
  log('\n💥 Testing Error Handling', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  // Test non-existent endpoint
  try {
    const response = await request(app)
      .get('/auth/non-existent-endpoint')
      .expect(404);
    
    addTestResult('404 Error Handling', response.status === 404);
    
  } catch (error) {
    addTestResult('404 Error Handling', false, error);
  }

  // Test invalid HTTP method
  try {
    const response = await request(app)
      .patch('/auth/config'); // PATCH not supported
    
    const testPassed = response.status === 404 || response.status === 405;
    
    addTestResult('Invalid Method Handling', testPassed);
    
  } catch (error) {
    addTestResult('Invalid Method Handling', false, error);
  }

  // Test malformed JSON
  try {
    const response = await request(app)
      .post('/auth/validate')
      .set('Content-Type', 'application/json')
      .send('{"invalid": json}'); // Malformed JSON
    
    const testPassed = response.status === 400;
    
    addTestResult('Malformed JSON Handling', testPassed);
    
  } catch (error) {
    addTestResult('Malformed JSON Handling', false, error);
  }
}

/**
 * Generate testing report
 */
function generateTestReport() {
  log('\n📋 Authentication Routes Testing Report', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  const successRate = testResults.total > 0 ? 
    Math.round((testResults.passed / testResults.total) * 100) : 0;

  log(`\n📊 Test Summary:`, colors.yellow);
  log(`  Total Tests: ${testResults.total}`, colors.blue);
  log(`  Passed: ${testResults.passed}`, colors.green);
  log(`  Failed: ${testResults.failed}`, colors.red);
  log(`  Success Rate: ${successRate}%`, successRate >= 80 ? colors.green : colors.red);

  // Endpoint-specific results
  if (Object.keys(testResults.endpoints).length > 0) {
    log(`\n🔗 Endpoint Results:`, colors.yellow);
    Object.entries(testResults.endpoints).forEach(([endpoint, stats]) => {
      const endpointSuccessRate = Math.round((stats.passed / stats.total) * 100);
      const color = endpointSuccessRate >= 80 ? colors.green : colors.red;
      log(`  ${endpoint}: ${stats.passed}/${stats.total} (${endpointSuccessRate}%)`, color);
    });
  }

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
    log(`\n✅ Overall Status: EXCELLENT - Authentication routes are production-ready`, colors.green);
  } else if (successRate >= 80) {
    log(`\n⚠️  Overall Status: GOOD - Minor issues need attention`, colors.yellow);
  } else if (successRate >= 60) {
    log(`\n🔶 Overall Status: NEEDS WORK - Several issues require fixing`, colors.yellow);
  } else {
    log(`\n❌ Overall Status: CRITICAL - Major issues prevent production use`, colors.red);
  }

  return {
    success: successRate >= 80,
    summary: testResults
  };
}

/**
 * Main function
 */
async function main() {
  const command = process.argv[2] || 'all';

  log('🧪 TaktMate Authentication Routes Testing', colors.bright);
  log(`Environment: ${process.env.NODE_ENV || 'development'}`, colors.blue);

  // Create test app
  const app = createTestApp();

  try {
    switch (command) {
      case 'config':
        await testConfigurationEndpoint(app);
        break;
      case 'login':
        await testLoginUrlEndpoint(app);
        break;
      case 'validate':
        await testTokenValidationEndpoint(app);
        break;
      case 'stats':
        await testJwksStatsEndpoint(app);
        break;
      case 'status':
        await testStatusEndpoint(app);
        break;
      case 'logout':
        await testLogoutEndpoint(app);
        break;
      case 'rate-limit':
        await testRateLimiting(app);
        break;
      case 'errors':
        await testErrorHandling(app);
        break;
      case 'help':
        log('\nUsage: node test-auth-routes.js [command]', colors.yellow);
        log('\nCommands:', colors.yellow);
        log('  config     - Test configuration endpoint', colors.blue);
        log('  login      - Test login URL generation', colors.blue);
        log('  validate   - Test token validation', colors.blue);
        log('  stats      - Test JWKS statistics', colors.blue);
        log('  status     - Test status endpoint', colors.blue);
        log('  logout     - Test logout endpoint', colors.blue);
        log('  rate-limit - Test rate limiting', colors.blue);
        log('  errors     - Test error handling', colors.blue);
        log('  all        - Run all tests (default)', colors.blue);
        log('  help       - Display this help', colors.blue);
        break;
      case 'all':
      default:
        await testConfigurationEndpoint(app);
        await testLoginUrlEndpoint(app);
        await testTokenValidationEndpoint(app);
        await testJwksStatsEndpoint(app);
        await testStatusEndpoint(app);
        await testLogoutEndpoint(app);
        await testRateLimiting(app);
        await testErrorHandling(app);
        
        const report = generateTestReport();
        
        log('\n📖 Next Steps:', colors.cyan);
        if (report.success) {
          log('1. Authentication routes are ready for integration', colors.blue);
          log('2. Test with real Azure AD B2C tokens', colors.blue);
          log('3. Integrate with frontend application', colors.blue);
        } else {
          log('1. Fix the issues identified in the test report', colors.red);
          log('2. Re-run tests to verify fixes', colors.blue);
          log('3. Check Azure AD B2C configuration', colors.blue);
        }
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
  testConfigurationEndpoint,
  testLoginUrlEndpoint,
  testTokenValidationEndpoint,
  testJwksStatsEndpoint,
  testStatusEndpoint,
  testLogoutEndpoint,
  testRateLimiting,
  testErrorHandling,
  generateTestReport,
  createTestApp
};
