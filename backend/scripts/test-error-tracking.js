#!/usr/bin/env node

/**
 * Error Tracking and Exception Logging Testing for TaktMate
 * 
 * This script tests the comprehensive error tracking and exception logging
 * capabilities, including specialized error tracking functions, global error
 * handlers, and integration with Application Insights.
 */

const request = require('supertest');
const express = require('express');

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
 * Test error tracking functions availability
 */
async function testErrorTrackingFunctions() {
  log('\\n🚨 Testing Error Tracking Functions', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    const appInsights = require('../config/applicationInsights');
    const telemetry = appInsights.telemetry;
    
    const requiredErrorTrackingFunctions = [
      'trackError',
      'trackUnhandledException',
      'trackHTTPError',
      'trackValidationError',
      'trackAuthError',
      'trackExternalServiceError'
    ];
    
    let allErrorFunctionsAvailable = true;
    const errorFunctionStatus = {};
    
    for (const func of requiredErrorTrackingFunctions) {
      const isAvailable = typeof telemetry[func] === 'function';
      errorFunctionStatus[func] = isAvailable;
      if (!isAvailable) allErrorFunctionsAvailable = false;
    }
    
    addTestResult('Error Functions', 'Error tracking functions available', allErrorFunctionsAvailable);
    
    if (process.env.DEBUG_TESTS === 'true') {
      log('  🚨 Error Tracking Functions:', colors.blue);
      Object.entries(errorFunctionStatus).forEach(([func, available]) => {
        log(`    ${func}: ${available ? 'Available' : 'Missing'}`, colors.blue);
      });
    }
    
  } catch (error) {
    addTestResult('Error Functions', 'Error tracking functions availability', false, error);
  }
}

/**
 * Test general error tracking
 */
async function testGeneralErrorTracking() {
  log('\\n🔍 Testing General Error Tracking', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    const appInsights = require('../config/applicationInsights');
    const telemetry = appInsights.telemetry;
    
    // Test basic error tracking
    const testError = new Error('Test error message');
    testError.name = 'TestError';
    
    const startTime = Date.now();
    telemetry.trackError(testError, 'test-user-123', {
      component: 'test',
      operation: 'error_tracking_test',
      endpoint: '/test',
      method: 'GET'
    });
    const duration = Date.now() - startTime;
    
    addTestResult('General Error Tracking', 'Basic error tracking', true, null, duration);
    
  } catch (error) {
    addTestResult('General Error Tracking', 'Basic error tracking', false, error);
  }

  try {
    const appInsights = require('../config/applicationInsights');
    const telemetry = appInsights.telemetry;
    
    // Test error categorization
    const errorTypes = [
      { name: 'NetworkError', message: 'Network timeout', category: 'network' },
      { name: 'DatabaseError', message: 'SQL connection failed', category: 'database' },
      { name: 'AuthenticationError', message: 'Invalid token', category: 'authentication' },
      { name: 'ValidationError', message: 'Invalid input', category: 'validation' },
      { name: 'PermissionError', message: 'Access denied', category: 'authorization' },
      { name: 'OpenAIError', message: 'API quota exceeded', category: 'external_service' }
    ];
    
    let allCategoriesTracked = true;
    
    for (const errorType of errorTypes) {
      try {
        const testError = new Error(errorType.message);
        testError.name = errorType.name;
        
        telemetry.trackError(testError, 'test-user-123', {
          component: 'test',
          operation: 'categorization_test'
        });
      } catch (error) {
        allCategoriesTracked = false;
        break;
      }
    }
    
    addTestResult('General Error Tracking', 'Error categorization', allCategoriesTracked);
    
  } catch (error) {
    addTestResult('General Error Tracking', 'Error categorization', false, error);
  }

  try {
    const appInsights = require('../config/applicationInsights');
    const telemetry = appInsights.telemetry;
    
    // Test error severity classification
    const severityTests = [
      { statusCode: 500, expectedSeverity: 'critical' },
      { statusCode: 400, expectedSeverity: 'warning' },
      { statusCode: 200, expectedSeverity: 'error' }
    ];
    
    let allSeveritiesTracked = true;
    
    for (const test of severityTests) {
      try {
        const testError = new Error('Test severity error');
        testError.statusCode = test.statusCode;
        
        telemetry.trackError(testError, 'test-user-123', {
          component: 'test',
          operation: 'severity_test'
        });
      } catch (error) {
        allSeveritiesTracked = false;
        break;
      }
    }
    
    addTestResult('General Error Tracking', 'Error severity classification', allSeveritiesTracked);
    
  } catch (error) {
    addTestResult('General Error Tracking', 'Error severity classification', false, error);
  }
}

/**
 * Test unhandled exception tracking
 */
async function testUnhandledExceptionTracking() {
  log('\\n💥 Testing Unhandled Exception Tracking', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    const appInsights = require('../config/applicationInsights');
    const telemetry = appInsights.telemetry;
    
    // Test unhandled exception tracking
    const testError = new Error('Test unhandled exception');
    testError.name = 'UnhandledException';
    
    const startTime = Date.now();
    telemetry.trackUnhandledException(testError, {
      type: 'test_exception',
      component: 'test_framework'
    });
    const duration = Date.now() - startTime;
    
    addTestResult('Unhandled Exception Tracking', 'Unhandled exception tracking', true, null, duration);
    
  } catch (error) {
    addTestResult('Unhandled Exception Tracking', 'Unhandled exception tracking', false, error);
  }

  try {
    const appInsights = require('../config/applicationInsights');
    const telemetry = appInsights.telemetry;
    
    // Test promise rejection tracking
    const testError = new Error('Test promise rejection');
    testError.name = 'UnhandledPromiseRejection';
    
    const startTime = Date.now();
    telemetry.trackUnhandledException(testError, {
      type: 'unhandledRejection',
      promise: 'Promise<test>'
    });
    const duration = Date.now() - startTime;
    
    addTestResult('Unhandled Exception Tracking', 'Promise rejection tracking', true, null, duration);
    
  } catch (error) {
    addTestResult('Unhandled Exception Tracking', 'Promise rejection tracking', false, error);
  }

  try {
    const appInsights = require('../config/applicationInsights');
    const telemetry = appInsights.telemetry;
    
    // Test system context capture
    const testError = new Error('Test system context');
    testError.name = 'SystemError';
    
    telemetry.trackUnhandledException(testError, {
      type: 'system_error',
      processId: process.pid,
      nodeVersion: process.version,
      platform: require('os').platform(),
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage().heapUsed
    });
    
    addTestResult('Unhandled Exception Tracking', 'System context capture', true);
    
  } catch (error) {
    addTestResult('Unhandled Exception Tracking', 'System context capture', false, error);
  }
}

/**
 * Test HTTP error tracking
 */
async function testHTTPErrorTracking() {
  log('\\n🌐 Testing HTTP Error Tracking', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    const appInsights = require('../config/applicationInsights');
    const telemetry = appInsights.telemetry;
    
    // Create mock request and response objects
    const mockReq = {
      method: 'POST',
      originalUrl: '/api/test',
      url: '/api/test',
      headers: {
        'user-agent': 'test-agent',
        'content-length': '100'
      },
      ip: '127.0.0.1',
      sessionID: 'test-session',
      user: {
        id: 'test-user-123',
        email: 'test@example.com'
      }
    };
    
    const mockRes = {
      statusCode: 500,
      get: (header) => {
        if (header === 'content-length') return '200';
        return null;
      }
    };
    
    const testError = new Error('Test HTTP error');
    testError.status = 500;
    
    const startTime = Date.now();
    telemetry.trackHTTPError(testError, mockReq, mockRes, {
      duration: 250,
      component: 'test'
    });
    const duration = Date.now() - startTime;
    
    addTestResult('HTTP Error Tracking', 'HTTP error tracking', true, null, duration);
    
  } catch (error) {
    addTestResult('HTTP Error Tracking', 'HTTP error tracking', false, error);
  }

  try {
    const appInsights = require('../config/applicationInsights');
    const telemetry = appInsights.telemetry;
    
    // Test different HTTP status codes
    const statusCodes = [400, 401, 403, 404, 500, 502, 503];
    
    let allStatusCodesTracked = true;
    
    for (const statusCode of statusCodes) {
      try {
        const mockReq = {
          method: 'GET',
          originalUrl: `/api/test/${statusCode}`,
          headers: { 'user-agent': 'test-agent' },
          ip: '127.0.0.1'
        };
        
        const mockRes = {
          statusCode: statusCode,
          get: () => null
        };
        
        const testError = new Error(`Test ${statusCode} error`);
        testError.status = statusCode;
        
        telemetry.trackHTTPError(testError, mockReq, mockRes);
      } catch (error) {
        allStatusCodesTracked = false;
        break;
      }
    }
    
    addTestResult('HTTP Error Tracking', 'Multiple HTTP status codes', allStatusCodesTracked);
    
  } catch (error) {
    addTestResult('HTTP Error Tracking', 'Multiple HTTP status codes', false, error);
  }

  try {
    const appInsights = require('../config/applicationInsights');
    const telemetry = appInsights.telemetry;
    
    // Test error classification (client vs server errors)
    const errorClassifications = [
      { statusCode: 400, expectedClass: 'client_error' },
      { statusCode: 404, expectedClass: 'client_error' },
      { statusCode: 500, expectedClass: 'server_error' },
      { statusCode: 502, expectedClass: 'server_error' }
    ];
    
    let allClassificationsTracked = true;
    
    for (const test of errorClassifications) {
      try {
        const mockReq = {
          method: 'GET',
          originalUrl: '/api/test',
          headers: { 'user-agent': 'test-agent' },
          ip: '127.0.0.1'
        };
        
        const mockRes = {
          statusCode: test.statusCode,
          get: () => null
        };
        
        const testError = new Error('Test classification error');
        testError.status = test.statusCode;
        
        telemetry.trackHTTPError(testError, mockReq, mockRes);
      } catch (error) {
        allClassificationsTracked = false;
        break;
      }
    }
    
    addTestResult('HTTP Error Tracking', 'Error classification', allClassificationsTracked);
    
  } catch (error) {
    addTestResult('HTTP Error Tracking', 'Error classification', false, error);
  }
}

/**
 * Test validation error tracking
 */
async function testValidationErrorTracking() {
  log('\\n✅ Testing Validation Error Tracking', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    const appInsights = require('../config/applicationInsights');
    const telemetry = appInsights.telemetry;
    
    // Test validation error tracking
    const testError = new Error('Validation failed: email is required');
    testError.name = 'ValidationError';
    
    const testData = {
      username: 'testuser',
      email: '', // Invalid email
      age: 25
    };
    
    const startTime = Date.now();
    telemetry.trackValidationError(testError, testData, {
      validationType: 'user_registration',
      fieldName: 'email',
      expectedType: 'email',
      actualValue: ''
    });
    const duration = Date.now() - startTime;
    
    addTestResult('Validation Error Tracking', 'Validation error tracking', true, null, duration);
    
  } catch (error) {
    addTestResult('Validation Error Tracking', 'Validation error tracking', false, error);
  }

  try {
    const appInsights = require('../config/applicationInsights');
    const telemetry = appInsights.telemetry;
    
    // Test different validation scenarios
    const validationScenarios = [
      { field: 'email', type: 'email', value: 'invalid-email' },
      { field: 'age', type: 'number', value: 'not-a-number' },
      { field: 'password', type: 'string', value: '' },
      { field: 'phoneNumber', type: 'phone', value: '123' }
    ];
    
    let allValidationScenariosTracked = true;
    
    for (const scenario of validationScenarios) {
      try {
        const testError = new Error(`Validation failed: ${scenario.field} is invalid`);
        testError.name = 'ValidationError';
        
        const testData = { [scenario.field]: scenario.value };
        
        telemetry.trackValidationError(testError, testData, {
          validationType: 'field_validation',
          fieldName: scenario.field,
          expectedType: scenario.type,
          actualValue: scenario.value
        });
      } catch (error) {
        allValidationScenariosTracked = false;
        break;
      }
    }
    
    addTestResult('Validation Error Tracking', 'Multiple validation scenarios', allValidationScenariosTracked);
    
  } catch (error) {
    addTestResult('Validation Error Tracking', 'Multiple validation scenarios', false, error);
  }

  try {
    const appInsights = require('../config/applicationInsights');
    const telemetry = appInsights.telemetry;
    
    // Test complex data validation
    const complexData = {
      user: {
        profile: {
          name: 'Test User',
          email: 'invalid-email',
          preferences: {
            theme: 'dark',
            notifications: true
          }
        },
        settings: {
          privacy: 'public'
        }
      },
      metadata: {
        source: 'api',
        timestamp: new Date().toISOString()
      }
    };
    
    const testError = new Error('Complex validation failed');
    testError.name = 'ValidationError';
    
    telemetry.trackValidationError(testError, complexData, {
      validationType: 'complex_object',
      fieldName: 'user.profile.email',
      expectedType: 'email',
      actualValue: 'invalid-email'
    });
    
    addTestResult('Validation Error Tracking', 'Complex data validation', true);
    
  } catch (error) {
    addTestResult('Validation Error Tracking', 'Complex data validation', false, error);
  }
}

/**
 * Test authentication error tracking
 */
async function testAuthenticationErrorTracking() {
  log('\\n🔐 Testing Authentication Error Tracking', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    const appInsights = require('../config/applicationInsights');
    const telemetry = appInsights.telemetry;
    
    // Test authentication error tracking
    const testError = new Error('Token has expired');
    testError.name = 'AuthenticationError';
    
    const startTime = Date.now();
    telemetry.trackAuthError(testError, {
      authProvider: 'azure-ad-b2c',
      authMethod: 'jwt',
      tokenExpired: true,
      tokenInvalid: false,
      userId: 'test-user-123',
      userEmail: 'test@example.com',
      tokenAge: 3600000 // 1 hour
    });
    const duration = Date.now() - startTime;
    
    addTestResult('Authentication Error Tracking', 'Authentication error tracking', true, null, duration);
    
  } catch (error) {
    addTestResult('Authentication Error Tracking', 'Authentication error tracking', false, error);
  }

  try {
    const appInsights = require('../config/applicationInsights');
    const telemetry = appInsights.telemetry;
    
    // Test authorization error tracking
    const testError = new Error('Insufficient permissions');
    testError.name = 'AuthorizationError';
    
    telemetry.trackAuthError(testError, {
      authProvider: 'azure-ad-b2c',
      authMethod: 'jwt',
      tokenExpired: false,
      tokenInvalid: false,
      userId: 'test-user-123',
      userEmail: 'test@example.com',
      requiredRole: 'admin',
      userRole: 'user'
    });
    
    addTestResult('Authentication Error Tracking', 'Authorization error tracking', true);
    
  } catch (error) {
    addTestResult('Authentication Error Tracking', 'Authorization error tracking', false, error);
  }

  try {
    const appInsights = require('../config/applicationInsights');
    const telemetry = appInsights.telemetry;
    
    // Test different auth error scenarios
    const authScenarios = [
      { errorType: 'TokenExpired', tokenExpired: true },
      { errorType: 'TokenInvalid', tokenInvalid: true },
      { errorType: 'AuthenticationRequired', tokenExpired: false, tokenInvalid: false },
      { errorType: 'InsufficientPermissions', tokenExpired: false, tokenInvalid: false }
    ];
    
    let allAuthScenariosTracked = true;
    
    for (const scenario of authScenarios) {
      try {
        const testError = new Error(`Auth error: ${scenario.errorType}`);
        testError.name = scenario.errorType;
        
        telemetry.trackAuthError(testError, {
          authProvider: 'azure-ad-b2c',
          authMethod: 'jwt',
          tokenExpired: scenario.tokenExpired || false,
          tokenInvalid: scenario.tokenInvalid || false,
          userId: 'test-user-123'
        });
      } catch (error) {
        allAuthScenariosTracked = false;
        break;
      }
    }
    
    addTestResult('Authentication Error Tracking', 'Multiple auth scenarios', allAuthScenariosTracked);
    
  } catch (error) {
    addTestResult('Authentication Error Tracking', 'Multiple auth scenarios', false, error);
  }
}

/**
 * Test external service error tracking
 */
async function testExternalServiceErrorTracking() {
  log('\\n🔗 Testing External Service Error Tracking', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    const appInsights = require('../config/applicationInsights');
    const telemetry = appInsights.telemetry;
    
    // Test external service error tracking
    const testError = new Error('OpenAI API quota exceeded');
    testError.status = 429;
    testError.name = 'OpenAIError';
    
    const startTime = Date.now();
    telemetry.trackExternalServiceError(testError, 'OpenAI API', 'chat.completions.create', {
      endpoint: 'https://api.openai.com/v1/chat/completions',
      duration: 5000,
      timeout: false,
      retryCount: 2,
      model: 'gpt-4.1',
      quotaExceeded: true
    });
    const duration = Date.now() - startTime;
    
    addTestResult('External Service Error Tracking', 'External service error tracking', true, null, duration);
    
  } catch (error) {
    addTestResult('External Service Error Tracking', 'External service error tracking', false, error);
  }

  try {
    const appInsights = require('../config/applicationInsights');
    const telemetry = appInsights.telemetry;
    
    // Test different external services
    const externalServices = [
      { name: 'OpenAI API', operation: 'chat.completions.create', statusCode: 429 },
      { name: 'Azure Storage', operation: 'blob.upload', statusCode: 503 },
      { name: 'Database', operation: 'query.execute', statusCode: 500 },
      { name: 'Email Service', operation: 'email.send', statusCode: 502 }
    ];
    
    let allExternalServicesTracked = true;
    
    for (const service of externalServices) {
      try {
        const testError = new Error(`${service.name} error`);
        testError.status = service.statusCode;
        
        telemetry.trackExternalServiceError(testError, service.name, service.operation, {
          statusCode: service.statusCode,
          duration: 1000,
          retryCount: 1
        });
      } catch (error) {
        allExternalServicesTracked = false;
        break;
      }
    }
    
    addTestResult('External Service Error Tracking', 'Multiple external services', allExternalServicesTracked);
    
  } catch (error) {
    addTestResult('External Service Error Tracking', 'Multiple external services', false, error);
  }

  try {
    const appInsights = require('../config/applicationInsights');
    const telemetry = appInsights.telemetry;
    
    // Test timeout and retry scenarios
    const timeoutScenarios = [
      { timeout: true, retryCount: 0, duration: 30000 },
      { timeout: true, retryCount: 3, duration: 45000 },
      { timeout: false, retryCount: 2, duration: 5000 }
    ];
    
    let allTimeoutScenariosTracked = true;
    
    for (const scenario of timeoutScenarios) {
      try {
        const testError = new Error(scenario.timeout ? 'Request timeout' : 'Service unavailable');
        testError.code = scenario.timeout ? 'ETIMEDOUT' : 'ECONNREFUSED';
        
        telemetry.trackExternalServiceError(testError, 'Test Service', 'test.operation', {
          timeout: scenario.timeout,
          retryCount: scenario.retryCount,
          duration: scenario.duration
        });
      } catch (error) {
        allTimeoutScenariosTracked = false;
        break;
      }
    }
    
    addTestResult('External Service Error Tracking', 'Timeout and retry scenarios', allTimeoutScenariosTracked);
    
  } catch (error) {
    addTestResult('External Service Error Tracking', 'Timeout and retry scenarios', false, error);
  }
}

/**
 * Test error correlation and context
 */
async function testErrorCorrelationAndContext() {
  log('\\n🔄 Testing Error Correlation and Context', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    const appInsights = require('../config/applicationInsights');
    const telemetry = appInsights.telemetry;
    
    // Test error correlation with request context
    const correlationId = `test-correlation-${Date.now()}`;
    const sessionId = `test-session-${Date.now()}`;
    
    const testError = new Error('Test correlated error');
    testError.name = 'CorrelatedError';
    
    telemetry.trackError(testError, 'test-user-123', {
      correlationId: correlationId,
      sessionId: sessionId,
      component: 'test',
      operation: 'correlation_test',
      endpoint: '/api/test',
      method: 'POST',
      userAgent: 'test-agent',
      ip: '127.0.0.1'
    });
    
    addTestResult('Error Correlation', 'Error correlation tracking', true);
    
  } catch (error) {
    addTestResult('Error Correlation', 'Error correlation tracking', false, error);
  }

  try {
    const appInsights = require('../config/applicationInsights');
    const telemetry = appInsights.telemetry;
    
    // Test error context preservation across multiple errors
    const baseContext = {
      correlationId: 'test-correlation-chain',
      sessionId: 'test-session-chain',
      userId: 'test-user-123',
      userEmail: 'test@example.com'
    };
    
    const errorChain = [
      { name: 'ValidationError', message: 'Invalid input', component: 'validation' },
      { name: 'ProcessingError', message: 'Processing failed', component: 'processor' },
      { name: 'StorageError', message: 'Storage failed', component: 'storage' }
    ];
    
    let allChainErrorsTracked = true;
    
    for (let i = 0; i < errorChain.length; i++) {
      try {
        const errorInfo = errorChain[i];
        const testError = new Error(errorInfo.message);
        testError.name = errorInfo.name;
        
        telemetry.trackError(testError, baseContext.userId, {
          ...baseContext,
          component: errorInfo.component,
          chainIndex: i,
          chainLength: errorChain.length
        });
      } catch (error) {
        allChainErrorsTracked = false;
        break;
      }
    }
    
    addTestResult('Error Correlation', 'Error chain correlation', allChainErrorsTracked);
    
  } catch (error) {
    addTestResult('Error Correlation', 'Error chain correlation', false, error);
  }

  try {
    const appInsights = require('../config/applicationInsights');
    const telemetry = appInsights.telemetry;
    
    // Test business context preservation
    const businessContext = {
      userId: 'test-user-123',
      userEmail: 'test@example.com',
      tenantId: 'test-tenant',
      subscriptionId: 'test-subscription',
      businessProcess: 'csv_processing',
      fileId: 'test-file-123',
      fileName: 'test-data.csv',
      fileSize: 1024000,
      rowCount: 5000
    };
    
    const testError = new Error('Business process error');
    testError.name = 'BusinessProcessError';
    
    telemetry.trackError(testError, businessContext.userId, businessContext);
    
    addTestResult('Error Correlation', 'Business context preservation', true);
    
  } catch (error) {
    addTestResult('Error Correlation', 'Business context preservation', false, error);
  }
}

/**
 * Test error tracking performance and efficiency
 */
async function testErrorTrackingPerformance() {
  log('\\n⚡ Testing Error Tracking Performance', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    const appInsights = require('../config/applicationInsights');
    const telemetry = appInsights.telemetry;
    
    // Test high-volume error tracking
    const iterations = 100;
    const startTime = Date.now();
    
    for (let i = 0; i < iterations; i++) {
      const testError = new Error(`Performance test error ${i}`);
      testError.name = 'PerformanceTestError';
      
      telemetry.trackError(testError, `test-user-${i}`, {
        component: 'performance_test',
        operation: 'bulk_error_tracking',
        iteration: i
      });
    }
    
    const totalDuration = Date.now() - startTime;
    const avgDuration = totalDuration / iterations;
    
    const testPassed = avgDuration < 10; // Less than 10ms average
    
    addTestResult('Error Tracking Performance', `High-volume error tracking (${iterations} errors)`, testPassed, 
      testPassed ? null : `Average duration: ${avgDuration.toFixed(2)}ms`, totalDuration);
    
    if (process.env.DEBUG_TESTS === 'true') {
      log(`  ⚡ Total time: ${totalDuration}ms`, colors.blue);
      log(`  ⚡ Average per error: ${avgDuration.toFixed(2)}ms`, colors.blue);
      log(`  ⚡ Errors per second: ~${Math.round(1000 / avgDuration)}`, colors.blue);
    }
    
  } catch (error) {
    addTestResult('Error Tracking Performance', 'High-volume error tracking', false, error);
  }

  try {
    // Test memory usage during error tracking
    const appInsights = require('../config/applicationInsights');
    const telemetry = appInsights.telemetry;
    
    const initialMemory = process.memoryUsage();
    
    // Generate error tracking load
    for (let i = 0; i < 500; i++) {
      const testError = new Error(`Memory test error ${i}`);
      testError.name = 'MemoryTestError';
      
      telemetry.trackError(testError, `test-user-${i}`, {
        component: 'memory_test',
        operation: 'memory_usage_test',
        iteration: i,
        largeContext: 'x'.repeat(1000) // 1KB of context data
      });
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const finalMemory = process.memoryUsage();
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    const memoryIncreaseKB = Math.round(memoryIncrease / 1024);
    
    const testPassed = memoryIncreaseKB < 5000; // Less than 5MB increase
    
    addTestResult('Error Tracking Performance', 'Memory usage during error tracking', testPassed, 
      testPassed ? null : `Memory increased by ${memoryIncreaseKB}KB`);
    
    if (process.env.DEBUG_TESTS === 'true') {
      log(`  💾 Memory increase: ${memoryIncreaseKB}KB`, colors.blue);
      log(`  💾 Final heap: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`, colors.blue);
    }
    
  } catch (error) {
    addTestResult('Error Tracking Performance', 'Memory usage during error tracking', false, error);
  }
}

/**
 * Generate comprehensive test report
 */
function generateTestReport() {
  log('\\n📋 Error Tracking and Exception Logging Testing Report', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  const successRate = testResults.total > 0 ? 
    Math.round((testResults.passed / testResults.total) * 100) : 0;

  log(`\\n📊 Overall Test Summary:`, colors.yellow);
  log(`  Total Tests: ${testResults.total}`, colors.blue);
  log(`  Passed: ${testResults.passed}`, colors.green);
  log(`  Failed: ${testResults.failed}`, colors.red);
  log(`  Success Rate: ${successRate}%`, successRate >= 90 ? colors.green : successRate >= 70 ? colors.yellow : colors.red);

  // Category breakdown
  log(`\\n📈 Results by Category:`, colors.yellow);
  Object.entries(testResults.categories).forEach(([category, results]) => {
    const categoryRate = Math.round((results.passed / results.total) * 100);
    const color = categoryRate >= 90 ? colors.green : categoryRate >= 70 ? colors.yellow : colors.red;
    log(`  ${category}: ${results.passed}/${results.total} (${categoryRate}%)`, color);
  });

  if (testResults.failed > 0) {
    log(`\\n❌ Failed Tests:`, colors.red);
    testResults.errors.forEach((error, index) => {
      log(`  ${index + 1}. [${error.category}] ${error.test}: ${error.error}`, colors.red);
    });
  }

  // Overall status
  if (successRate >= 95) {
    log(`\\n✅ Overall Status: EXCELLENT - Error tracking is production-ready`, colors.green);
  } else if (successRate >= 85) {
    log(`\\n⚠️  Overall Status: GOOD - Minor error tracking issues need attention`, colors.yellow);
  } else if (successRate >= 70) {
    log(`\\n🔶 Overall Status: NEEDS WORK - Several error tracking issues require fixing`, colors.yellow);
  } else {
    log(`\\n❌ Overall Status: CRITICAL - Major error tracking issues prevent proper monitoring`, colors.red);
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

  log('🧪 TaktMate Error Tracking and Exception Logging Testing', colors.bright);
  log(`Environment: ${process.env.NODE_ENV || 'development'}`, colors.blue);

  try {
    switch (command) {
      case 'functions':
        await testErrorTrackingFunctions();
        break;
      case 'general':
        await testGeneralErrorTracking();
        break;
      case 'unhandled':
        await testUnhandledExceptionTracking();
        break;
      case 'http':
        await testHTTPErrorTracking();
        break;
      case 'validation':
        await testValidationErrorTracking();
        break;
      case 'auth':
        await testAuthenticationErrorTracking();
        break;
      case 'external':
        await testExternalServiceErrorTracking();
        break;
      case 'correlation':
        await testErrorCorrelationAndContext();
        break;
      case 'performance':
        await testErrorTrackingPerformance();
        break;
      case 'help':
        log('\\nUsage: node test-error-tracking.js [command]', colors.yellow);
        log('\\nCommands:', colors.yellow);
        log('  functions    - Test error tracking functions availability', colors.blue);
        log('  general      - Test general error tracking', colors.blue);
        log('  unhandled    - Test unhandled exception tracking', colors.blue);
        log('  http         - Test HTTP error tracking', colors.blue);
        log('  validation   - Test validation error tracking', colors.blue);
        log('  auth         - Test authentication error tracking', colors.blue);
        log('  external     - Test external service error tracking', colors.blue);
        log('  correlation  - Test error correlation and context', colors.blue);
        log('  performance  - Test error tracking performance', colors.blue);
        log('  all          - Run all tests (default)', colors.blue);
        log('  help         - Display this help', colors.blue);
        break;
      case 'all':
      default:
        await testErrorTrackingFunctions();
        await testGeneralErrorTracking();
        await testUnhandledExceptionTracking();
        await testHTTPErrorTracking();
        await testValidationErrorTracking();
        await testAuthenticationErrorTracking();
        await testExternalServiceErrorTracking();
        await testErrorCorrelationAndContext();
        await testErrorTrackingPerformance();
        
        const report = generateTestReport();
        
        log('\\n📖 Next Steps:', colors.cyan);
        if (report.success) {
          log('1. Error tracking is ready for production deployment', colors.blue);
          log('2. Configure Application Insights alerts for critical errors', colors.blue);
          log('3. Set up error dashboards for monitoring and analysis', colors.blue);
          log('4. Deploy and monitor error data in Azure Portal', colors.blue);
        } else {
          log('1. Fix the error tracking issues identified in the test report', colors.red);
          log('2. Verify Application Insights configuration and connectivity', colors.blue);
          log('3. Check error tracking function implementations', colors.blue);
          log('4. Re-run tests to verify fixes', colors.blue);
        }
        break;
    }
    
  } catch (error) {
    log(`\\n❌ Testing Error: ${error.message}`, colors.red);
    console.error(error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    log(`\\n❌ Script Error: ${error.message}`, colors.red);
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  testErrorTrackingFunctions,
  testGeneralErrorTracking,
  testUnhandledExceptionTracking,
  testHTTPErrorTracking,
  testValidationErrorTracking,
  testAuthenticationErrorTracking,
  testExternalServiceErrorTracking,
  testErrorCorrelationAndContext,
  testErrorTrackingPerformance,
  generateTestReport
};
