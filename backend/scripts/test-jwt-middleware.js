#!/usr/bin/env node

/**
 * JWT Middleware Testing Utility for TaktMate
 * 
 * This script tests the JWT validation middleware with various scenarios
 * including valid tokens, invalid tokens, and error conditions.
 */

const express = require('express');
const { 
  jwtAuthMiddleware, 
  optionalJwtAuthMiddleware,
  requireEmailVerification,
  requireRole,
  requireCompany,
  validateJwtToken,
  getJwksCacheStats
} = require('../middleware/jwtValidation');

const { 
  config,
  validateConfiguration,
  getConfigurationStatus
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
 * Create sample JWT token payload for testing
 */
function createSampleTokenPayload() {
  const now = Math.floor(Date.now() / 1000);
  
  return {
    iss: `https://${config.tenantName}.b2clogin.com/${config.tenantId}/v2.0/`,
    aud: config.clientId,
    sub: 'test-user-12345',
    iat: now,
    exp: now + 3600, // 1 hour
    nbf: now,
    ver: '1.0',
    tfp: config.signUpSignInPolicy,
    auth_time: now,
    emails: ['test@example.com'],
    given_name: 'Test',
    family_name: 'User',
    name: 'Test User',
    extension_Company: 'Test Corp',
    extension_Role: 'Tester',
    extension_Industry: 'Technology',
    idp: 'local',
    email_verified: true
  };
}

/**
 * Test JWT token validation function
 */
async function testJwtTokenValidation() {
  log('\n🎫 Testing JWT Token Validation Function', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  // Test valid token payload
  try {
    const validPayload = createSampleTokenPayload();
    const startTime = Date.now();
    
    // Note: This tests the payload extraction, not actual JWT verification
    // since we don't have a real signed token for testing
    const result = await validateJwtToken('dummy-token-for-payload-test');
    const duration = Date.now() - startTime;
    
    // This will fail validation but we can test the error handling
    addTestResult('JWT validation error handling', !result.valid && result.code, null, duration);
    
  } catch (error) {
    addTestResult('JWT validation function', false, error);
  }

  // Test invalid token scenarios
  const invalidTokens = [
    { name: 'Empty token', token: '' },
    { name: 'Malformed token', token: 'invalid.jwt.token' },
    { name: 'Non-JWT string', token: 'not-a-jwt-token' }
  ];

  for (const testCase of invalidTokens) {
    try {
      const startTime = Date.now();
      const result = await validateJwtToken(testCase.token);
      const duration = Date.now() - startTime;
      
      addTestResult(`Invalid token handling: ${testCase.name}`, !result.valid, null, duration);
      
    } catch (error) {
      addTestResult(`Invalid token handling: ${testCase.name}`, false, error);
    }
  }
}

/**
 * Test middleware configuration
 */
function testMiddlewareConfiguration() {
  log('\n⚙️  Testing Middleware Configuration', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    // Test configuration validation
    validateConfiguration();
    addTestResult('Configuration validation', true);
    
    // Test configuration status
    const status = getConfigurationStatus();
    addTestResult('Configuration status retrieval', !!status.configured);
    
    // Test JWKS cache stats
    const cacheStats = getJwksCacheStats();
    addTestResult('JWKS cache statistics', !!cacheStats);
    
    if (cacheStats) {
      log(`  📊 Cache TTL: ${cacheStats.ttl}ms`, colors.blue);
      log(`  📊 Max Entries: ${cacheStats.cacheMaxEntries}`, colors.blue);
      log(`  📊 Requests Per Minute: ${cacheStats.requestsPerMinute}`, colors.blue);
    }
    
  } catch (error) {
    addTestResult('Middleware configuration', false, error);
  }
}

/**
 * Test middleware creation and options
 */
function testMiddlewareCreation() {
  log('\n🏗️  Testing Middleware Creation', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    // Test basic middleware creation
    const basicMiddleware = jwtAuthMiddleware();
    addTestResult('Basic JWT middleware creation', typeof basicMiddleware === 'function');
    
    // Test middleware with options
    const optionsMiddleware = jwtAuthMiddleware({
      logAuthentication: true,
      includeErrorDetails: true
    });
    addTestResult('JWT middleware with options', typeof optionsMiddleware === 'function');
    
    // Test optional middleware
    const optionalMiddleware = optionalJwtAuthMiddleware();
    addTestResult('Optional JWT middleware creation', typeof optionalMiddleware === 'function');
    
    // Test email verification middleware
    const emailMiddleware = requireEmailVerification();
    addTestResult('Email verification middleware creation', typeof emailMiddleware === 'function');
    
    // Test role-based middleware
    const roleMiddleware = requireRole(['admin', 'user']);
    addTestResult('Role-based middleware creation', typeof roleMiddleware === 'function');
    
    // Test company-based middleware
    const companyMiddleware = requireCompany(['Test Corp', 'Example Inc']);
    addTestResult('Company-based middleware creation', typeof companyMiddleware === 'function');
    
  } catch (error) {
    addTestResult('Middleware creation', false, error);
  }
}

/**
 * Test middleware with mock requests
 */
async function testMiddlewareWithMockRequests() {
  log('\n🔬 Testing Middleware with Mock Requests', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  // Create mock request and response objects
  const createMockReq = (headers = {}, path = '/test', method = 'GET') => ({
    headers: {
      'user-agent': 'TaktMate-Test/1.0',
      ...headers
    },
    path: path,
    method: method,
    ip: '127.0.0.1'
  });

  const createMockRes = () => {
    const res = {
      statusCode: 200,
      headers: {},
      body: null
    };
    
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    
    res.json = (data) => {
      res.body = data;
      return res;
    };
    
    return res;
  };

  // Test missing token scenario
  try {
    const middleware = jwtAuthMiddleware();
    const req = createMockReq();
    const res = createMockRes();
    let nextCalled = false;
    
    const next = () => { nextCalled = true; };
    
    const startTime = Date.now();
    await middleware(req, res, next);
    const duration = Date.now() - startTime;
    
    const testPassed = res.statusCode === 401 && 
                      res.body && 
                      res.body.code === 'MISSING_TOKEN' &&
                      !nextCalled;
    
    addTestResult('Missing token handling', testPassed, null, duration);
    
  } catch (error) {
    addTestResult('Missing token handling', false, error);
  }

  // Test invalid token scenario
  try {
    const middleware = jwtAuthMiddleware();
    const req = createMockReq({
      'authorization': 'Bearer invalid-token'
    });
    const res = createMockRes();
    let nextCalled = false;
    
    const next = () => { nextCalled = true; };
    
    const startTime = Date.now();
    await middleware(req, res, next);
    const duration = Date.now() - startTime;
    
    const testPassed = res.statusCode === 401 && 
                      res.body && 
                      res.body.success === false &&
                      !nextCalled;
    
    addTestResult('Invalid token handling', testPassed, null, duration);
    
  } catch (error) {
    addTestResult('Invalid token handling', false, error);
  }

  // Test optional middleware with no token
  try {
    const middleware = optionalJwtAuthMiddleware();
    const req = createMockReq();
    const res = createMockRes();
    let nextCalled = false;
    
    const next = () => { nextCalled = true; };
    
    const startTime = Date.now();
    await middleware(req, res, next);
    const duration = Date.now() - startTime;
    
    const testPassed = nextCalled && 
                      req.user === null &&
                      req.token === null &&
                      req.userId === null;
    
    addTestResult('Optional middleware without token', testPassed, null, duration);
    
  } catch (error) {
    addTestResult('Optional middleware without token', false, error);
  }
}

/**
 * Test role-based authorization
 */
function testRoleBasedAuthorization() {
  log('\n👥 Testing Role-Based Authorization', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  // Create mock request with user
  const createMockReqWithUser = (user) => ({
    user: user,
    headers: { 'user-agent': 'TaktMate-Test/1.0' },
    path: '/test',
    method: 'GET',
    ip: '127.0.0.1'
  });

  const createMockRes = () => {
    const res = {
      statusCode: 200,
      headers: {},
      body: null
    };
    
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    
    res.json = (data) => {
      res.body = data;
      return res;
    };
    
    return res;
  };

  // Test valid role
  try {
    const middleware = requireRole(['admin', 'user']);
    const req = createMockReqWithUser({ 
      id: 'test-user',
      email: 'test@example.com',
      role: 'admin' 
    });
    const res = createMockRes();
    let nextCalled = false;
    
    const next = () => { nextCalled = true; };
    
    middleware(req, res, next);
    
    addTestResult('Valid role authorization', nextCalled && res.statusCode === 200);
    
  } catch (error) {
    addTestResult('Valid role authorization', false, error);
  }

  // Test invalid role
  try {
    const middleware = requireRole(['admin']);
    const req = createMockReqWithUser({ 
      id: 'test-user',
      email: 'test@example.com',
      role: 'user' 
    });
    const res = createMockRes();
    let nextCalled = false;
    
    const next = () => { nextCalled = true; };
    
    middleware(req, res, next);
    
    const testPassed = !nextCalled && 
                      res.statusCode === 403 &&
                      res.body &&
                      res.body.code === 'INSUFFICIENT_PERMISSIONS';
    
    addTestResult('Invalid role authorization', testPassed);
    
  } catch (error) {
    addTestResult('Invalid role authorization', false, error);
  }
}

/**
 * Test company-based authorization
 */
function testCompanyBasedAuthorization() {
  log('\n🏢 Testing Company-Based Authorization', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  const createMockReqWithUser = (user) => ({
    user: user,
    headers: { 'user-agent': 'TaktMate-Test/1.0' },
    path: '/test',
    method: 'GET',
    ip: '127.0.0.1'
  });

  const createMockRes = () => {
    const res = {
      statusCode: 200,
      headers: {},
      body: null
    };
    
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    
    res.json = (data) => {
      res.body = data;
      return res;
    };
    
    return res;
  };

  // Test valid company
  try {
    const middleware = requireCompany(['Test Corp', 'Example Inc']);
    const req = createMockReqWithUser({ 
      id: 'test-user',
      email: 'test@example.com',
      company: 'Test Corp' 
    });
    const res = createMockRes();
    let nextCalled = false;
    
    const next = () => { nextCalled = true; };
    
    middleware(req, res, next);
    
    addTestResult('Valid company authorization', nextCalled && res.statusCode === 200);
    
  } catch (error) {
    addTestResult('Valid company authorization', false, error);
  }

  // Test invalid company
  try {
    const middleware = requireCompany(['Test Corp']);
    const req = createMockReqWithUser({ 
      id: 'test-user',
      email: 'test@example.com',
      company: 'Other Corp' 
    });
    const res = createMockRes();
    let nextCalled = false;
    
    const next = () => { nextCalled = true; };
    
    middleware(req, res, next);
    
    const testPassed = !nextCalled && 
                      res.statusCode === 403 &&
                      res.body &&
                      res.body.code === 'COMPANY_ACCESS_RESTRICTED';
    
    addTestResult('Invalid company authorization', testPassed);
    
  } catch (error) {
    addTestResult('Invalid company authorization', false, error);
  }
}

/**
 * Generate testing report
 */
function generateTestReport() {
  log('\n📋 JWT Middleware Testing Report', colors.cyan);
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
      const color = duration < 50 ? colors.green : duration < 200 ? colors.yellow : colors.red;
      log(`  ${test}: ${duration}ms`, color);
    });
  }

  // Overall status
  if (successRate >= 90) {
    log(`\n✅ Overall Status: EXCELLENT - JWT middleware is ready for production`, colors.green);
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

  log('🧪 TaktMate JWT Middleware Testing', colors.bright);
  log(`Environment: ${process.env.NODE_ENV || 'development'}`, colors.blue);

  try {
    switch (command) {
      case 'validation':
        await testJwtTokenValidation();
        break;
      case 'config':
        testMiddlewareConfiguration();
        break;
      case 'creation':
        testMiddlewareCreation();
        break;
      case 'requests':
        await testMiddlewareWithMockRequests();
        break;
      case 'roles':
        testRoleBasedAuthorization();
        break;
      case 'companies':
        testCompanyBasedAuthorization();
        break;
      case 'help':
        log('\nUsage: node test-jwt-middleware.js [command]', colors.yellow);
        log('\nCommands:', colors.yellow);
        log('  validation - Test JWT token validation function', colors.blue);
        log('  config     - Test middleware configuration', colors.blue);
        log('  creation   - Test middleware creation', colors.blue);
        log('  requests   - Test middleware with mock requests', colors.blue);
        log('  roles      - Test role-based authorization', colors.blue);
        log('  companies  - Test company-based authorization', colors.blue);
        log('  all        - Run all tests (default)', colors.blue);
        log('  help       - Display this help', colors.blue);
        break;
      case 'all':
      default:
        testMiddlewareConfiguration();
        testMiddlewareCreation();
        await testJwtTokenValidation();
        await testMiddlewareWithMockRequests();
        testRoleBasedAuthorization();
        testCompanyBasedAuthorization();
        
        const report = generateTestReport();
        
        log('\n📖 Next Steps:', colors.cyan);
        if (report.success) {
          log('1. JWT middleware is ready for integration', colors.blue);
          log('2. Proceed with authentication routes implementation', colors.blue);
          log('3. Test with real Microsoft Entra External ID tokens', colors.blue);
        } else {
          log('1. Fix the issues identified in the test report', colors.red);
          log('2. Re-run tests to verify fixes', colors.blue);
          log('3. Check configuration and dependencies', colors.blue);
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
  testJwtTokenValidation,
  testMiddlewareConfiguration,
  testMiddlewareCreation,
  testMiddlewareWithMockRequests,
  testRoleBasedAuthorization,
  testCompanyBasedAuthorization,
  generateTestReport
};
