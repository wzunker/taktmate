#!/usr/bin/env node

/**
 * Application Insights SDK Integration Testing for TaktMate
 * 
 * This script tests the complete integration of the Application Insights SDK
 * with the Express application, including middleware, telemetry tracking,
 * and end-to-end functionality.
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
 * Test Application Insights SDK installation
 */
async function testSDKInstallation() {
  log('\n📦 Testing Application Insights SDK Installation', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    // Test SDK availability
    const appInsights = require('applicationinsights');
    const testPassed = appInsights && typeof appInsights.setup === 'function';
    
    addTestResult('SDK Installation', 'Application Insights SDK availability', testPassed);
    
    if (testPassed) {
      log(`  📦 SDK Version: ${appInsights.VERSION || 'Unknown'}`, colors.blue);
      log(`  📦 Setup method: ${typeof appInsights.setup}`, colors.blue);
      log(`  📦 Configuration: ${typeof appInsights.Configuration}`, colors.blue);
    }
    
  } catch (error) {
    addTestResult('SDK Installation', 'Application Insights SDK availability', false, error);
  }

  try {
    // Test configuration module
    const configModule = require('../config/applicationInsights');
    const hasRequiredMethods = configModule &&
                              typeof configModule.initializeApplicationInsights === 'function' &&
                              typeof configModule.getClient === 'function' &&
                              typeof configModule.telemetry === 'object';
    
    addTestResult('SDK Installation', 'Configuration module structure', hasRequiredMethods);
    
    if (hasRequiredMethods) {
      log(`  🔧 Initialize method: Available`, colors.blue);
      log(`  🔧 Get client method: Available`, colors.blue);
      log(`  🔧 Telemetry object: Available`, colors.blue);
      log(`  🔧 Configuration status: Available`, colors.blue);
    }
    
  } catch (error) {
    addTestResult('SDK Installation', 'Configuration module structure', false, error);
  }

  try {
    // Test dependencies
    const requiredDependencies = [
      'applicationinsights',
      'os',
      'express'
    ];
    
    let allDependenciesAvailable = true;
    const dependencyStatus = {};
    
    for (const dep of requiredDependencies) {
      try {
        require(dep);
        dependencyStatus[dep] = 'Available';
      } catch (error) {
        dependencyStatus[dep] = 'Missing';
        allDependenciesAvailable = false;
      }
    }
    
    addTestResult('SDK Installation', 'Required dependencies', allDependenciesAvailable);
    
    if (process.env.DEBUG_TESTS === 'true') {
      Object.entries(dependencyStatus).forEach(([dep, status]) => {
        log(`  📚 ${dep}: ${status}`, colors.blue);
      });
    }
    
  } catch (error) {
    addTestResult('SDK Installation', 'Required dependencies', false, error);
  }
}

/**
 * Test SDK initialization process
 */
async function testSDKInitialization() {
  log('\n🚀 Testing SDK Initialization Process', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    // Test initialization without configuration
    const configModule = require('../config/applicationInsights');
    
    // Temporarily clear environment variables
    const originalConnectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
    const originalInstrumentationKey = process.env.APPINSIGHTS_INSTRUMENTATIONKEY;
    
    delete process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
    delete process.env.APPINSIGHTS_INSTRUMENTATIONKEY;
    
    const startTime = Date.now();
    const client = configModule.initializeApplicationInsights();
    const duration = Date.now() - startTime;
    
    // Should return null when not configured
    const testPassed = client === null;
    
    addTestResult('SDK Initialization', 'Initialization without configuration', testPassed, null, duration);
    
    // Restore environment variables
    if (originalConnectionString) {
      process.env.APPLICATIONINSIGHTS_CONNECTION_STRING = originalConnectionString;
    }
    if (originalInstrumentationKey) {
      process.env.APPINSIGHTS_INSTRUMENTATIONKEY = originalInstrumentationKey;
    }
    
  } catch (error) {
    addTestResult('SDK Initialization', 'Initialization without configuration', false, error);
  }

  try {
    // Test initialization with mock configuration
    process.env.APPLICATIONINSIGHTS_CONNECTION_STRING = 'InstrumentationKey=test-key;IngestionEndpoint=https://test.in.applicationinsights.azure.com/';
    
    const configModule = require('../config/applicationInsights');
    const startTime = Date.now();
    const client = configModule.initializeApplicationInsights();
    const duration = Date.now() - startTime;
    
    const testPassed = client !== null;
    
    addTestResult('SDK Initialization', 'Initialization with mock configuration', testPassed, null, duration);
    
    if (testPassed) {
      log(`  🎯 Client type: ${typeof client}`, colors.blue);
      log(`  🎯 Has context: ${client.context ? 'Yes' : 'No'}`, colors.blue);
      log(`  🎯 Has config: ${client.config ? 'Yes' : 'No'}`, colors.blue);
    }
    
  } catch (error) {
    addTestResult('SDK Initialization', 'Initialization with mock configuration', false, error);
  }

  try {
    // Test configuration status
    const configModule = require('../config/applicationInsights');
    const configStatus = configModule.getConfigurationStatus();
    
    const testPassed = configStatus &&
                      typeof configStatus.configured === 'boolean' &&
                      typeof configStatus.environment === 'string';
    
    addTestResult('SDK Initialization', 'Configuration status retrieval', testPassed);
    
    if (testPassed) {
      log(`  📊 Configured: ${configStatus.configured}`, colors.blue);
      log(`  📊 Environment: ${configStatus.environment}`, colors.blue);
      log(`  📊 Sampling: ${configStatus.samplingPercentage}%`, colors.blue);
    }
    
  } catch (error) {
    addTestResult('SDK Initialization', 'Configuration status retrieval', false, error);
  }
}

/**
 * Test Express middleware integration
 */
async function testExpressIntegration() {
  log('\n🌐 Testing Express Middleware Integration', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    // Create test Express app
    const app = express();
    
    // Test middleware creation
    const configModule = require('../config/applicationInsights');
    const middleware = configModule.createExpressMiddleware();
    
    const testPassed = typeof middleware === 'function';
    
    addTestResult('Express Integration', 'Middleware creation', testPassed);
    
    if (testPassed) {
      log(`  🌐 Middleware type: ${typeof middleware}`, colors.blue);
      log(`  🌐 Middleware length: ${middleware.length} parameters`, colors.blue);
    }
    
  } catch (error) {
    addTestResult('Express Integration', 'Middleware creation', false, error);
  }

  try {
    // Test middleware integration in Express app
    const app = express();
    const configModule = require('../config/applicationInsights');
    
    // Add middleware
    app.use(configModule.createExpressMiddleware());
    
    // Add test route
    app.get('/test', (req, res) => {
      res.json({ 
        success: true, 
        telemetry: !!req.telemetry,
        timestamp: new Date().toISOString()
      });
    });
    
    // Test request with middleware
    const response = await request(app)
      .get('/test')
      .expect(200);
    
    const testPassed = response.body.success === true;
    
    addTestResult('Express Integration', 'Middleware request processing', testPassed);
    
    if (testPassed) {
      log(`  🌐 Telemetry available: ${response.body.telemetry ? 'Yes' : 'No'}`, colors.blue);
      log(`  🌐 Response time: ${response.header['x-response-time'] || 'Not tracked'}`, colors.blue);
    }
    
  } catch (error) {
    addTestResult('Express Integration', 'Middleware request processing', false, error);
  }

  try {
    // Test telemetry context in middleware
    const app = express();
    const configModule = require('../config/applicationInsights');
    
    app.use(configModule.createExpressMiddleware());
    
    app.get('/telemetry-test', (req, res) => {
      const hasTelemetry = !!req.telemetry;
      const telemetryMethods = hasTelemetry ? Object.keys(req.telemetry) : [];
      
      res.json({
        hasTelemetry: hasTelemetry,
        telemetryMethods: telemetryMethods,
        methodCount: telemetryMethods.length
      });
    });
    
    const response = await request(app)
      .get('/telemetry-test')
      .expect(200);
    
    const testPassed = response.body.hasTelemetry === true && 
                      response.body.methodCount > 0;
    
    addTestResult('Express Integration', 'Telemetry context availability', testPassed);
    
    if (testPassed) {
      log(`  📊 Telemetry methods: ${response.body.methodCount}`, colors.blue);
      log(`  📊 Available methods: ${response.body.telemetryMethods.slice(0, 3).join(', ')}...`, colors.blue);
    }
    
  } catch (error) {
    addTestResult('Express Integration', 'Telemetry context availability', false, error);
  }
}

/**
 * Test telemetry functionality
 */
async function testTelemetryFunctionality() {
  log('\n📊 Testing Telemetry Functionality', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    // Test telemetry methods availability
    const configModule = require('../config/applicationInsights');
    const telemetry = configModule.telemetry;
    
    const requiredMethods = [
      'trackEvent',
      'trackMetric',
      'trackAuthentication',
      'trackError'
    ];
    
    let allMethodsAvailable = true;
    const methodStatus = {};
    
    for (const method of requiredMethods) {
      const isAvailable = typeof telemetry[method] === 'function';
      methodStatus[method] = isAvailable;
      if (!isAvailable) allMethodsAvailable = false;
    }
    
    addTestResult('Telemetry Functionality', 'Required telemetry methods', allMethodsAvailable);
    
    if (process.env.DEBUG_TESTS === 'true') {
      Object.entries(methodStatus).forEach(([method, available]) => {
        log(`  📊 ${method}: ${available ? 'Available' : 'Missing'}`, colors.blue);
      });
    }
    
  } catch (error) {
    addTestResult('Telemetry Functionality', 'Required telemetry methods', false, error);
  }

  try {
    // Test event tracking
    const configModule = require('../config/applicationInsights');
    const startTime = Date.now();
    
    configModule.telemetry.trackEvent('SDKIntegrationTest', {
      testType: 'automated',
      testId: `sdk-test-${Date.now()}`,
      environment: 'testing'
    }, {
      testValue: 42,
      duration: 100
    });
    
    const duration = Date.now() - startTime;
    
    addTestResult('Telemetry Functionality', 'Event tracking execution', true, null, duration);
    
  } catch (error) {
    addTestResult('Telemetry Functionality', 'Event tracking execution', false, error);
  }

  try {
    // Test metric tracking
    const configModule = require('../config/applicationInsights');
    const startTime = Date.now();
    
    configModule.telemetry.trackMetric('SDKTestMetric', 123.45, {
      testType: 'automated',
      metricCategory: 'integration'
    });
    
    const duration = Date.now() - startTime;
    
    addTestResult('Telemetry Functionality', 'Metric tracking execution', true, null, duration);
    
  } catch (error) {
    addTestResult('Telemetry Functionality', 'Metric tracking execution', false, error);
  }

  try {
    // Test error tracking
    const configModule = require('../config/applicationInsights');
    const testError = new Error('SDK integration test error');
    const startTime = Date.now();
    
    configModule.telemetry.trackError(testError, 'test-user', {
      testType: 'automated',
      component: 'sdk-integration-test'
    });
    
    const duration = Date.now() - startTime;
    
    addTestResult('Telemetry Functionality', 'Error tracking execution', true, null, duration);
    
  } catch (error) {
    addTestResult('Telemetry Functionality', 'Error tracking execution', false, error);
  }
}

/**
 * Test performance characteristics
 */
async function testPerformanceCharacteristics() {
  log('\n⚡ Testing Performance Characteristics', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    // Test telemetry performance
    const configModule = require('../config/applicationInsights');
    const iterations = 100;
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      configModule.telemetry.trackEvent(`PerformanceTest${i}`, {
        iteration: i,
        testType: 'performance'
      });
      const duration = Date.now() - startTime;
      times.push(duration);
    }
    
    const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    const maxTime = Math.max(...times);
    const minTime = Math.min(...times);
    
    const testPassed = avgTime < 5; // Less than 5ms average
    
    addTestResult('Performance', `Telemetry performance (${iterations} events)`, testPassed, null, Math.round(avgTime * 100) / 100);
    
    if (process.env.DEBUG_TESTS === 'true') {
      log(`  ⚡ Average: ${avgTime.toFixed(2)}ms`, colors.blue);
      log(`  ⚡ Min: ${minTime}ms, Max: ${maxTime}ms`, colors.blue);
      log(`  ⚡ Events per second: ~${Math.round(1000 / avgTime)}`, colors.blue);
    }
    
  } catch (error) {
    addTestResult('Performance', 'Telemetry performance', false, error);
  }

  try {
    // Test middleware performance
    const app = express();
    const configModule = require('../config/applicationInsights');
    
    app.use(configModule.createExpressMiddleware());
    app.get('/perf-test', (req, res) => {
      res.json({ success: true });
    });
    
    const iterations = 50;
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      await request(app).get('/perf-test');
      const duration = Date.now() - startTime;
      times.push(duration);
    }
    
    const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    const testPassed = avgTime < 50; // Less than 50ms average
    
    addTestResult('Performance', `Middleware performance (${iterations} requests)`, testPassed, null, Math.round(avgTime * 100) / 100);
    
  } catch (error) {
    addTestResult('Performance', 'Middleware performance', false, error);
  }

  try {
    // Test memory usage
    const initialMemory = process.memoryUsage();
    const configModule = require('../config/applicationInsights');
    
    // Generate telemetry load
    for (let i = 0; i < 1000; i++) {
      configModule.telemetry.trackEvent('MemoryTest', { iteration: i });
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const finalMemory = process.memoryUsage();
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    const memoryIncreaseKB = Math.round(memoryIncrease / 1024);
    
    const testPassed = memoryIncreaseKB < 2000; // Less than 2MB increase
    
    addTestResult('Performance', 'Memory usage impact', testPassed, 
      testPassed ? null : `Memory increased by ${memoryIncreaseKB}KB`);
    
    if (process.env.DEBUG_TESTS === 'true') {
      log(`  💾 Memory increase: ${memoryIncreaseKB}KB`, colors.blue);
      log(`  💾 Final heap: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`, colors.blue);
    }
    
  } catch (error) {
    addTestResult('Performance', 'Memory usage impact', false, error);
  }
}

/**
 * Test end-to-end integration
 */
async function testEndToEndIntegration() {
  log('\n🔄 Testing End-to-End Integration', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    // Create a complete Express app with all middleware
    const app = express();
    const configModule = require('../config/applicationInsights');
    
    // Add Application Insights middleware
    app.use(configModule.createExpressMiddleware());
    
    // Add JSON parsing
    app.use(express.json());
    
    // Test route that uses telemetry
    app.post('/e2e-test', (req, res) => {
      try {
        // Track the request
        if (req.telemetry) {
          req.telemetry.trackEvent('E2ETestRequest', {
            method: req.method,
            path: req.path,
            userAgent: req.headers['user-agent']
          }, {
            timestamp: Date.now(),
            bodySize: JSON.stringify(req.body).length
          });
        }
        
        res.json({
          success: true,
          telemetryAvailable: !!req.telemetry,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
    
    // Test the complete flow
    const response = await request(app)
      .post('/e2e-test')
      .send({ test: 'data', value: 123 })
      .expect(200);
    
    const testPassed = response.body.success === true &&
                      response.body.telemetryAvailable === true;
    
    addTestResult('End-to-End', 'Complete integration flow', testPassed);
    
    if (testPassed) {
      log(`  🔄 Response success: ${response.body.success}`, colors.blue);
      log(`  🔄 Telemetry available: ${response.body.telemetryAvailable}`, colors.blue);
    }
    
  } catch (error) {
    addTestResult('End-to-End', 'Complete integration flow', false, error);
  }

  try {
    // Test error handling integration
    const app = express();
    const configModule = require('../config/applicationInsights');
    
    app.use(configModule.createExpressMiddleware());
    
    app.get('/error-test', (req, res) => {
      const testError = new Error('Integration test error');
      
      // Track error using telemetry
      if (req.telemetry) {
        req.telemetry.trackError(testError, null, {
          endpoint: req.path,
          method: req.method,
          testType: 'integration'
        });
      }
      
      res.status(500).json({
        success: false,
        error: 'Test error tracked',
        telemetryAvailable: !!req.telemetry
      });
    });
    
    const response = await request(app)
      .get('/error-test')
      .expect(500);
    
    const testPassed = response.body.success === false &&
                      response.body.telemetryAvailable === true;
    
    addTestResult('End-to-End', 'Error tracking integration', testPassed);
    
  } catch (error) {
    addTestResult('End-to-End', 'Error tracking integration', false, error);
  }
}

/**
 * Generate comprehensive test report
 */
function generateTestReport() {
  log('\n📋 SDK Integration Testing Report', colors.cyan);
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
    log(`\n✅ Overall Status: EXCELLENT - SDK integration is production-ready`, colors.green);
  } else if (successRate >= 85) {
    log(`\n⚠️  Overall Status: GOOD - Minor issues need attention`, colors.yellow);
  } else if (successRate >= 70) {
    log(`\n🔶 Overall Status: NEEDS WORK - Several issues require fixing`, colors.yellow);
  } else {
    log(`\n❌ Overall Status: CRITICAL - Major integration issues prevent proper monitoring`, colors.red);
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

  log('🧪 TaktMate Application Insights SDK Integration Testing', colors.bright);
  log(`Environment: ${process.env.NODE_ENV || 'development'}`, colors.blue);

  try {
    switch (command) {
      case 'sdk':
        await testSDKInstallation();
        break;
      case 'init':
        await testSDKInitialization();
        break;
      case 'express':
        await testExpressIntegration();
        break;
      case 'telemetry':
        await testTelemetryFunctionality();
        break;
      case 'performance':
        await testPerformanceCharacteristics();
        break;
      case 'e2e':
        await testEndToEndIntegration();
        break;
      case 'help':
        log('\nUsage: node test-sdk-integration.js [command]', colors.yellow);
        log('\nCommands:', colors.yellow);
        log('  sdk         - Test SDK installation and availability', colors.blue);
        log('  init        - Test SDK initialization process', colors.blue);
        log('  express     - Test Express middleware integration', colors.blue);
        log('  telemetry   - Test telemetry functionality', colors.blue);
        log('  performance - Test performance characteristics', colors.blue);
        log('  e2e         - Test end-to-end integration', colors.blue);
        log('  all         - Run all tests (default)', colors.blue);
        log('  help        - Display this help', colors.blue);
        break;
      case 'all':
      default:
        await testSDKInstallation();
        await testSDKInitialization();
        await testExpressIntegration();
        await testTelemetryFunctionality();
        await testPerformanceCharacteristics();
        await testEndToEndIntegration();
        
        const report = generateTestReport();
        
        log('\n📖 Next Steps:', colors.cyan);
        if (report.success) {
          log('1. SDK integration is ready for production use', colors.blue);
          log('2. Configure Application Insights resource in Azure', colors.blue);
          log('3. Set up environment variables with connection string', colors.blue);
          log('4. Deploy and monitor telemetry data in Azure Portal', colors.blue);
        } else {
          log('1. Fix the issues identified in the test report', colors.red);
          log('2. Verify SDK installation and dependencies', colors.blue);
          log('3. Check Application Insights configuration', colors.blue);
          log('4. Re-run tests to verify fixes', colors.blue);
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
  testSDKInstallation,
  testSDKInitialization,
  testExpressIntegration,
  testTelemetryFunctionality,
  testPerformanceCharacteristics,
  testEndToEndIntegration,
  generateTestReport
};
