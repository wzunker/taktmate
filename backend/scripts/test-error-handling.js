#!/usr/bin/env node

/**
 * Comprehensive Error Handling Testing Utility for TaktMate
 * 
 * This script tests the comprehensive error handling system for authentication
 * failures, JWT validation errors, and various system error scenarios.
 */

const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const { TaktMateError, JWTErrorHandler, createAuthError, createErrorHandler } = require('../utils/errorHandler');
const { jwtAuthMiddleware, optionalJwtAuthMiddleware } = require('../middleware/jwtValidation');

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
  categories: {}
};

/**
 * Add test result
 */
function addTestResult(category, testName, passed, error = null, duration = null) {
  testResults.total++;
  
  if (!testResults.categories[category]) {
    testResults.categories[category] = { total: 0, passed: 0, failed: 0 };
  }
  
  testResults.categories[category].total++;
  
  if (passed) {
    testResults.passed++;
    testResults.categories[category].passed++;
    log(`✅ ${testName}${duration ? ` (${duration}ms)` : ''}`, colors.green);
  } else {
    testResults.failed++;
    testResults.categories[category].failed++;
    testResults.errors.push({ category, test: testName, error: error?.message || error });
    log(`❌ ${testName}: ${error?.message || error}`, colors.red);
  }
}

/**
 * Create test Express app with error handling
 */
function createTestApp() {
  const app = express();
  
  // Basic middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Add request ID for tracking
  app.use((req, res, next) => {
    req.id = `test_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    next();
  });
  
  // Test endpoints that trigger different error scenarios
  
  // Authentication required endpoint
  app.get('/auth-required', jwtAuthMiddleware(), (req, res) => {
    res.json({ success: true, user: req.user });
  });
  
  // Optional authentication endpoint
  app.get('/auth-optional', optionalJwtAuthMiddleware(), (req, res) => {
    res.json({ success: true, authenticated: !!req.user, user: req.user });
  });
  
  // Endpoint that throws specific errors
  app.post('/test-error/:errorType', (req, res, next) => {
    const { errorType } = req.params;
    
    try {
      switch (errorType) {
        case 'authentication-required':
          throw createAuthError('AUTHENTICATION_REQUIRED', null, req);
        case 'invalid-token':
          throw createAuthError('INVALID_TOKEN', new Error('Token signature invalid'), req);
        case 'expired-token':
          throw createAuthError('EXPIRED_TOKEN', new Error('Token has expired'), req);
        case 'malformed-token':
          throw createAuthError('MALFORMED_TOKEN', new Error('Token is malformed'), req);
        case 'insufficient-permissions':
          throw createAuthError('INSUFFICIENT_PERMISSIONS', new Error('User lacks required permissions'), req);
        case 'rate-limit':
          throw createAuthError('RATE_LIMIT_EXCEEDED', new Error('Too many requests'), req);
        case 'service-unavailable':
          throw createAuthError('SERVICE_UNAVAILABLE', new Error('Service temporarily unavailable'), req);
        case 'internal-error':
          throw createAuthError('INTERNAL_SERVER_ERROR', new Error('Internal server error'), req);
        default:
          throw new Error('Unknown error type');
      }
    } catch (error) {
      next(error);
    }
  });
  
  // Endpoint that throws JWT errors directly
  app.post('/test-jwt-error/:errorType', (req, res, next) => {
    const { errorType } = req.params;
    
    try {
      let jwtError;
      
      switch (errorType) {
        case 'expired':
          jwtError = new Error('jwt expired');
          jwtError.name = 'TokenExpiredError';
          break;
        case 'malformed':
          jwtError = new Error('jwt malformed');
          jwtError.name = 'JsonWebTokenError';
          break;
        case 'invalid-signature':
          jwtError = new Error('invalid signature');
          jwtError.name = 'JsonWebTokenError';
          break;
        case 'not-before':
          jwtError = new Error('jwt not active');
          jwtError.name = 'NotBeforeError';
          break;
        default:
          jwtError = new Error('jwt validation failed');
          jwtError.name = 'JsonWebTokenError';
      }
      
      const handledError = JWTErrorHandler.handleJWTError(jwtError, {
        endpoint: req.path,
        method: req.method
      });
      
      throw handledError;
      
    } catch (error) {
      next(error);
    }
  });
  
  // Endpoint that throws unexpected errors
  app.get('/test-unexpected-error', (req, res, next) => {
    try {
      // Simulate unexpected error
      const unexpectedError = new Error('Unexpected system error');
      unexpectedError.code = 'ECONNREFUSED';
      throw unexpectedError;
    } catch (error) {
      next(error);
    }
  });
  
  // Use comprehensive error handler
  app.use(createErrorHandler());
  
  return app;
}

/**
 * Generate test JWT tokens
 */
function generateTestTokens() {
  const secret = 'test-secret-key';
  const now = Math.floor(Date.now() / 1000);
  
  return {
    valid: jwt.sign({
      sub: 'test-user-123',
      email: 'test@example.com',
      name: 'Test User',
      iat: now,
      exp: now + 3600 // 1 hour from now
    }, secret),
    
    expired: jwt.sign({
      sub: 'test-user-123',
      email: 'test@example.com',
      name: 'Test User',
      iat: now - 7200, // 2 hours ago
      exp: now - 3600  // 1 hour ago (expired)
    }, secret),
    
    malformed: 'invalid.jwt.token',
    
    invalidSignature: jwt.sign({
      sub: 'test-user-123',
      email: 'test@example.com',
      name: 'Test User',
      iat: now,
      exp: now + 3600
    }, 'wrong-secret-key'),
    
    missingClaims: jwt.sign({
      iat: now,
      exp: now + 3600
    }, secret)
  };
}

/**
 * Test TaktMateError class functionality
 */
async function testTaktMateErrorClass() {
  log('\n🧪 Testing TaktMateError Class', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    // Test error creation
    const error = new TaktMateError('AUTHENTICATION_REQUIRED', null, {
      userId: 'test-user',
      endpoint: '/test',
      method: 'GET'
    });
    
    const testPassed = error.type === 'AUTHENTICATION_REQUIRED' &&
                      error.statusCode === 401 &&
                      error.userMessage &&
                      error.context.userId === 'test-user';
    
    addTestResult('TaktMateError', 'Error creation and properties', testPassed);
    
  } catch (error) {
    addTestResult('TaktMateError', 'Error creation and properties', false, error);
  }

  try {
    // Test API response format
    const error = new TaktMateError('EXPIRED_TOKEN', new Error('Token expired'));
    const apiResponse = error.toApiResponse();
    
    const testPassed = apiResponse.success === false &&
                      apiResponse.error.type === 'EXPIRED_TOKEN' &&
                      apiResponse.error.code === 'EXPIRED_TOKEN' &&
                      apiResponse.error.message &&
                      apiResponse.error.action &&
                      apiResponse.error.guidance;
    
    addTestResult('TaktMateError', 'API response format', testPassed);
    
  } catch (error) {
    addTestResult('TaktMateError', 'API response format', false, error);
  }

  try {
    // Test log format
    const error = new TaktMateError('INTERNAL_SERVER_ERROR', new Error('System error'));
    const logFormat = error.toLogFormat();
    
    const testPassed = logFormat.level === 'error' &&
                      logFormat.type === 'INTERNAL_SERVER_ERROR' &&
                      logFormat.statusCode === 500 &&
                      logFormat.context;
    
    addTestResult('TaktMateError', 'Log format', testPassed);
    
  } catch (error) {
    addTestResult('TaktMateError', 'Log format', false, error);
  }
}

/**
 * Test JWT error handling
 */
async function testJWTErrorHandling() {
  log('\n🔐 Testing JWT Error Handling', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  const jwtErrors = [
    { name: 'TokenExpiredError', message: 'jwt expired', expected: 'EXPIRED_TOKEN' },
    { name: 'JsonWebTokenError', message: 'jwt malformed', expected: 'MALFORMED_TOKEN' },
    { name: 'JsonWebTokenError', message: 'invalid signature', expected: 'INVALID_TOKEN' },
    { name: 'NotBeforeError', message: 'jwt not active', expected: 'INVALID_TOKEN' }
  ];

  for (const jwtError of jwtErrors) {
    try {
      const error = new Error(jwtError.message);
      error.name = jwtError.name;
      
      const handledError = JWTErrorHandler.handleJWTError(error, {
        endpoint: '/test',
        method: 'GET'
      });
      
      const testPassed = handledError.errorCode === jwtError.expected &&
                        handledError instanceof TaktMateError;
      
      addTestResult('JWT Error Handling', `${jwtError.name} -> ${jwtError.expected}`, testPassed);
      
    } catch (error) {
      addTestResult('JWT Error Handling', `${jwtError.name} -> ${jwtError.expected}`, false, error);
    }
  }
}

/**
 * Test authentication error scenarios
 */
async function testAuthenticationErrors(app) {
  log('\n🔒 Testing Authentication Error Scenarios', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  const tokens = generateTestTokens();

  // Test missing token
  try {
    const response = await request(app)
      .get('/auth-required');
    
    const testPassed = response.status === 401 &&
                      response.body.success === false &&
                      response.body.error.type === 'AUTHENTICATION_REQUIRED';
    
    addTestResult('Authentication Errors', 'Missing token', testPassed);
    
  } catch (error) {
    addTestResult('Authentication Errors', 'Missing token', false, error);
  }

  // Test malformed token
  try {
    const response = await request(app)
      .get('/auth-required')
      .set('Authorization', 'Bearer invalid-token');
    
    const testPassed = response.status === 401 &&
                      response.body.success === false &&
                      response.body.error.code.includes('TOKEN');
    
    addTestResult('Authentication Errors', 'Malformed token', testPassed);
    
  } catch (error) {
    addTestResult('Authentication Errors', 'Malformed token', false, error);
  }

  // Test empty authorization header
  try {
    const response = await request(app)
      .get('/auth-required')
      .set('Authorization', '');
    
    const testPassed = response.status === 401;
    
    addTestResult('Authentication Errors', 'Empty authorization header', testPassed);
    
  } catch (error) {
    addTestResult('Authentication Errors', 'Empty authorization header', false, error);
  }

  // Test invalid authorization format
  try {
    const response = await request(app)
      .get('/auth-required')
      .set('Authorization', 'InvalidFormat token');
    
    const testPassed = response.status === 401;
    
    addTestResult('Authentication Errors', 'Invalid authorization format', testPassed);
    
  } catch (error) {
    addTestResult('Authentication Errors', 'Invalid authorization format', false, error);
  }
}

/**
 * Test specific error types
 */
async function testSpecificErrorTypes(app) {
  log('\n🎯 Testing Specific Error Types', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  const errorTests = [
    { type: 'authentication-required', expectedStatus: 401, expectedCode: 'AUTHENTICATION_REQUIRED' },
    { type: 'invalid-token', expectedStatus: 401, expectedCode: 'INVALID_TOKEN' },
    { type: 'expired-token', expectedStatus: 401, expectedCode: 'EXPIRED_TOKEN' },
    { type: 'malformed-token', expectedStatus: 401, expectedCode: 'MALFORMED_TOKEN' },
    { type: 'insufficient-permissions', expectedStatus: 403, expectedCode: 'INSUFFICIENT_PERMISSIONS' },
    { type: 'rate-limit', expectedStatus: 429, expectedCode: 'RATE_LIMIT_EXCEEDED' },
    { type: 'service-unavailable', expectedStatus: 503, expectedCode: 'SERVICE_UNAVAILABLE' },
    { type: 'internal-error', expectedStatus: 500, expectedCode: 'INTERNAL_SERVER_ERROR' }
  ];

  for (const errorTest of errorTests) {
    try {
      const startTime = Date.now();
      const response = await request(app)
        .post(`/test-error/${errorTest.type}`);
      const duration = Date.now() - startTime;
      
      const testPassed = response.status === errorTest.expectedStatus &&
                        response.body.success === false &&
                        response.body.error.code === errorTest.expectedCode &&
                        response.body.error.message &&
                        response.body.error.action &&
                        response.body.error.guidance;
      
      addTestResult('Specific Error Types', `${errorTest.type} error`, testPassed, null, duration);
      
    } catch (error) {
      addTestResult('Specific Error Types', `${errorTest.type} error`, false, error);
    }
  }
}

/**
 * Test JWT-specific error handling
 */
async function testJWTSpecificErrors(app) {
  log('\n🔑 Testing JWT-Specific Error Handling', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  const jwtErrorTests = [
    { type: 'expired', expectedCode: 'EXPIRED_TOKEN' },
    { type: 'malformed', expectedCode: 'MALFORMED_TOKEN' },
    { type: 'invalid-signature', expectedCode: 'INVALID_TOKEN' },
    { type: 'not-before', expectedCode: 'INVALID_TOKEN' }
  ];

  for (const errorTest of jwtErrorTests) {
    try {
      const startTime = Date.now();
      const response = await request(app)
        .post(`/test-jwt-error/${errorTest.type}`);
      const duration = Date.now() - startTime;
      
      const testPassed = response.status === 401 &&
                        response.body.success === false &&
                        response.body.error.code === errorTest.expectedCode;
      
      addTestResult('JWT-Specific Errors', `JWT ${errorTest.type} error`, testPassed, null, duration);
      
    } catch (error) {
      addTestResult('JWT-Specific Errors', `JWT ${errorTest.type} error`, false, error);
    }
  }
}

/**
 * Test error response format
 */
async function testErrorResponseFormat(app) {
  log('\n📋 Testing Error Response Format', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    const response = await request(app)
      .post('/test-error/authentication-required');
    
    const requiredFields = ['success', 'error'];
    const errorRequiredFields = ['type', 'code', 'message', 'action', 'guidance', 'requestId', 'timestamp'];
    
    const hasRequiredFields = requiredFields.every(field => response.body.hasOwnProperty(field));
    const hasErrorFields = errorRequiredFields.every(field => response.body.error.hasOwnProperty(field));
    
    const testPassed = response.body.success === false &&
                      hasRequiredFields &&
                      hasErrorFields &&
                      typeof response.body.error.requestId === 'string' &&
                      typeof response.body.error.timestamp === 'string';
    
    addTestResult('Error Response Format', 'Standard error response format', testPassed);
    
  } catch (error) {
    addTestResult('Error Response Format', 'Standard error response format', false, error);
  }

  try {
    // Test rate limiting response includes retry-after
    const response = await request(app)
      .post('/test-error/rate-limit');
    
    const testPassed = response.body.error.retryAfter &&
                      typeof response.body.error.retryAfter === 'number';
    
    addTestResult('Error Response Format', 'Rate limit retry-after header', testPassed);
    
  } catch (error) {
    addTestResult('Error Response Format', 'Rate limit retry-after header', false, error);
  }
}

/**
 * Test optional authentication behavior
 */
async function testOptionalAuthentication(app) {
  log('\n🔓 Testing Optional Authentication', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  // Test without token (should succeed)
  try {
    const response = await request(app)
      .get('/auth-optional');
    
    const testPassed = response.status === 200 &&
                      response.body.success === true &&
                      response.body.authenticated === false &&
                      !response.body.user;
    
    addTestResult('Optional Authentication', 'No token provided', testPassed);
    
  } catch (error) {
    addTestResult('Optional Authentication', 'No token provided', false, error);
  }

  // Test with invalid token (should succeed but not authenticate)
  try {
    const response = await request(app)
      .get('/auth-optional')
      .set('Authorization', 'Bearer invalid-token');
    
    const testPassed = response.status === 200 &&
                      response.body.success === true &&
                      response.body.authenticated === false &&
                      !response.body.user;
    
    addTestResult('Optional Authentication', 'Invalid token provided', testPassed);
    
  } catch (error) {
    addTestResult('Optional Authentication', 'Invalid token provided', false, error);
  }
}

/**
 * Test error handling performance
 */
async function testErrorHandlingPerformance(app) {
  log('\n⚡ Testing Error Handling Performance', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    const iterations = 10;
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      await request(app).get('/auth-required');
      const duration = Date.now() - startTime;
      times.push(duration);
    }
    
    const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    const maxTime = Math.max(...times);
    const minTime = Math.min(...times);
    
    const testPassed = avgTime < 100; // Average should be under 100ms
    
    addTestResult('Performance', `Error handling performance (avg: ${avgTime.toFixed(2)}ms)`, testPassed, null, avgTime);
    
    if (testPassed) {
      log(`  ⚡ Min: ${minTime}ms, Max: ${maxTime}ms, Avg: ${avgTime.toFixed(2)}ms`, colors.blue);
    }
    
  } catch (error) {
    addTestResult('Performance', 'Error handling performance', false, error);
  }
}

/**
 * Test unexpected error handling
 */
async function testUnexpectedErrorHandling(app) {
  log('\n💥 Testing Unexpected Error Handling', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    const response = await request(app)
      .get('/test-unexpected-error');
    
    const testPassed = response.status >= 500 &&
                      response.body.success === false &&
                      response.body.error.code &&
                      response.body.error.message;
    
    addTestResult('Unexpected Errors', 'Unexpected system error handling', testPassed);
    
  } catch (error) {
    addTestResult('Unexpected Errors', 'Unexpected system error handling', false, error);
  }
}

/**
 * Generate comprehensive test report
 */
function generateTestReport() {
  log('\n📋 Comprehensive Error Handling Test Report', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  const successRate = testResults.total > 0 ? 
    Math.round((testResults.passed / testResults.total) * 100) : 0;

  log(`\n📊 Overall Test Summary:`, colors.yellow);
  log(`  Total Tests: ${testResults.total}`, colors.blue);
  log(`  Passed: ${testResults.passed}`, colors.green);
  log(`  Failed: ${testResults.failed}`, colors.red);
  log(`  Success Rate: ${successRate}%`, successRate >= 90 ? colors.green : successRate >= 70 ? colors.yellow : colors.red);

  // Category breakdown
  log(`\n📈 Results by Category:`, colors.yellow);
  Object.entries(testResults.categories).forEach(([category, results]) => {
    const categoryRate = Math.round((results.passed / results.total) * 100);
    const color = categoryRate >= 90 ? colors.green : categoryRate >= 70 ? colors.yellow : colors.red;
    log(`  ${category}: ${results.passed}/${results.total} (${categoryRate}%)`, color);
  });

  if (testResults.failed > 0) {
    log(`\n❌ Failed Tests:`, colors.red);
    testResults.errors.forEach((error, index) => {
      log(`  ${index + 1}. [${error.category}] ${error.test}: ${error.error}`, colors.red);
    });
  }

  // Overall status
  if (successRate >= 95) {
    log(`\n✅ Overall Status: EXCELLENT - Error handling is production-ready`, colors.green);
  } else if (successRate >= 85) {
    log(`\n⚠️  Overall Status: GOOD - Minor issues need attention`, colors.yellow);
  } else if (successRate >= 70) {
    log(`\n🔶 Overall Status: NEEDS WORK - Several issues require fixing`, colors.yellow);
  } else {
    log(`\n❌ Overall Status: CRITICAL - Major issues prevent production use`, colors.red);
  }

  return {
    success: successRate >= 85,
    summary: testResults
  };
}

/**
 * Main function
 */
async function main() {
  const command = process.argv[2] || 'all';

  log('🧪 TaktMate Comprehensive Error Handling Testing', colors.bright);
  log(`Environment: ${process.env.NODE_ENV || 'development'}`, colors.blue);

  // Create test app
  const app = createTestApp();

  try {
    switch (command) {
      case 'error-class':
        await testTaktMateErrorClass();
        break;
      case 'jwt':
        await testJWTErrorHandling();
        break;
      case 'auth':
        await testAuthenticationErrors(app);
        break;
      case 'specific':
        await testSpecificErrorTypes(app);
        break;
      case 'format':
        await testErrorResponseFormat(app);
        break;
      case 'optional':
        await testOptionalAuthentication(app);
        break;
      case 'performance':
        await testErrorHandlingPerformance(app);
        break;
      case 'unexpected':
        await testUnexpectedErrorHandling(app);
        break;
      case 'help':
        log('\nUsage: node test-error-handling.js [command]', colors.yellow);
        log('\nCommands:', colors.yellow);
        log('  error-class - Test TaktMateError class functionality', colors.blue);
        log('  jwt         - Test JWT error handling', colors.blue);
        log('  auth        - Test authentication error scenarios', colors.blue);
        log('  specific    - Test specific error types', colors.blue);
        log('  format      - Test error response format', colors.blue);
        log('  optional    - Test optional authentication behavior', colors.blue);
        log('  performance - Test error handling performance', colors.blue);
        log('  unexpected  - Test unexpected error handling', colors.blue);
        log('  all         - Run all tests (default)', colors.blue);
        log('  help        - Display this help', colors.blue);
        break;
      case 'all':
      default:
        await testTaktMateErrorClass();
        await testJWTErrorHandling();
        await testAuthenticationErrors(app);
        await testSpecificErrorTypes(app);
        await testJWTSpecificErrors(app);
        await testErrorResponseFormat(app);
        await testOptionalAuthentication(app);
        await testErrorHandlingPerformance(app);
        await testUnexpectedErrorHandling(app);
        
        const report = generateTestReport();
        
        log('\n📖 Next Steps:', colors.cyan);
        if (report.success) {
          log('1. Error handling system is ready for production use', colors.blue);
          log('2. Integrate with monitoring and alerting systems', colors.blue);
          log('3. Test with real Microsoft Entra External ID error scenarios', colors.blue);
        } else {
          log('1. Fix the issues identified in the test report', colors.red);
          log('2. Re-run tests to verify fixes', colors.blue);
          log('3. Check error message clarity and user guidance', colors.blue);
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
  testTaktMateErrorClass,
  testJWTErrorHandling,
  testAuthenticationErrors,
  testSpecificErrorTypes,
  testErrorResponseFormat,
  testOptionalAuthentication,
  testErrorHandlingPerformance,
  generateTestReport,
  createTestApp
};
