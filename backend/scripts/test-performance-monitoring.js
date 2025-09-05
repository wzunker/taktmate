#!/usr/bin/env node

/**
 * Performance Monitoring and Dependency Tracking Testing for TaktMate
 * 
 * This script tests the comprehensive performance monitoring and dependency
 * tracking capabilities, including system metrics, request performance,
 * dependency tracking, and resource utilization monitoring.
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
 * Test performance monitoring functions availability
 */
async function testPerformanceMonitoringFunctions() {
  log('\\n📊 Testing Performance Monitoring Functions', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    const appInsights = require('../config/applicationInsights');
    const telemetry = appInsights.telemetry;
    const performanceMonitoring = appInsights.performanceMonitoring;
    
    const requiredTelemetryFunctions = [
      'trackSystemPerformance',
      'trackRequestPerformance',
      'trackDatabaseOperation',
      'trackStartupPerformance',
      'trackResourceUtilization'
    ];
    
    let allTelemetryFunctionsAvailable = true;
    const telemetryFunctionStatus = {};
    
    for (const func of requiredTelemetryFunctions) {
      const isAvailable = typeof telemetry[func] === 'function';
      telemetryFunctionStatus[func] = isAvailable;
      if (!isAvailable) allTelemetryFunctionsAvailable = false;
    }
    
    addTestResult('Performance Functions', 'Performance telemetry functions available', allTelemetryFunctionsAvailable);
    
    const requiredMonitoringFunctions = [
      'startMonitoring',
      'stopMonitoring',
      'trackOperation',
      'trackDependencyCall',
      'getPerformanceSnapshot'
    ];
    
    let allMonitoringFunctionsAvailable = true;
    const monitoringFunctionStatus = {};
    
    for (const func of requiredMonitoringFunctions) {
      const isAvailable = typeof performanceMonitoring[func] === 'function';
      monitoringFunctionStatus[func] = isAvailable;
      if (!isAvailable) allMonitoringFunctionsAvailable = false;
    }
    
    addTestResult('Performance Functions', 'Performance monitoring functions available', allMonitoringFunctionsAvailable);
    
    if (process.env.DEBUG_TESTS === 'true') {
      log('  📊 Telemetry Functions:', colors.blue);
      Object.entries(telemetryFunctionStatus).forEach(([func, available]) => {
        log(`    ${func}: ${available ? 'Available' : 'Missing'}`, colors.blue);
      });
      
      log('  📊 Monitoring Functions:', colors.blue);
      Object.entries(monitoringFunctionStatus).forEach(([func, available]) => {
        log(`    ${func}: ${available ? 'Available' : 'Missing'}`, colors.blue);
      });
    }
    
  } catch (error) {
    addTestResult('Performance Functions', 'Performance monitoring functions availability', false, error);
  }
}

/**
 * Test system performance monitoring
 */
async function testSystemPerformanceMonitoring() {
  log('\\n🖥️  Testing System Performance Monitoring', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    const appInsights = require('../config/applicationInsights');
    const telemetry = appInsights.telemetry;
    
    // Test system performance tracking
    const startTime = Date.now();
    telemetry.trackSystemPerformance({
      customMetric1: 100,
      customMetric2: 200
    });
    const duration = Date.now() - startTime;
    
    addTestResult('System Performance', 'System performance tracking', true, null, duration);
    
  } catch (error) {
    addTestResult('System Performance', 'System performance tracking', false, error);
  }

  try {
    const appInsights = require('../config/applicationInsights');
    const telemetry = appInsights.telemetry;
    
    // Test resource utilization tracking
    const startTime = Date.now();
    telemetry.trackResourceUtilization();
    const duration = Date.now() - startTime;
    
    addTestResult('System Performance', 'Resource utilization tracking', true, null, duration);
    
  } catch (error) {
    addTestResult('System Performance', 'Resource utilization tracking', false, error);
  }

  try {
    const appInsights = require('../config/applicationInsights');
    const performanceMonitoring = appInsights.performanceMonitoring;
    
    // Test performance snapshot
    const startTime = Date.now();
    const snapshot = performanceMonitoring.getPerformanceSnapshot();
    const duration = Date.now() - startTime;
    
    const testPassed = snapshot && 
                      snapshot.timestamp &&
                      snapshot.memory &&
                      snapshot.cpu &&
                      snapshot.system;
    
    addTestResult('System Performance', 'Performance snapshot generation', testPassed, null, duration);
    
    if (testPassed && process.env.DEBUG_TESTS === 'true') {
      log(`  📊 Heap Usage: ${Math.round(snapshot.memory.heapUsagePercent)}%`, colors.blue);
      log(`  📊 Total Memory: ${Math.round(snapshot.system.totalMemory / 1024 / 1024)}MB`, colors.blue);
      log(`  📊 CPU Count: ${snapshot.system.cpuCount}`, colors.blue);
      log(`  📊 Uptime: ${Math.round(snapshot.system.uptime)}s`, colors.blue);
    }
    
  } catch (error) {
    addTestResult('System Performance', 'Performance snapshot generation', false, error);
  }
}

/**
 * Test request performance monitoring
 */
async function testRequestPerformanceMonitoring() {
  log('\\n🌐 Testing Request Performance Monitoring', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    const appInsights = require('../config/applicationInsights');
    const telemetry = appInsights.telemetry;
    
    // Create mock request and response objects
    const mockReq = {
      method: 'GET',
      originalUrl: '/api/test',
      url: '/api/test',
      headers: {
        'user-agent': 'test-agent'
      }
    };
    
    const mockRes = {
      statusCode: 200,
      get: (header) => {
        if (header === 'content-length') return '1024';
        return null;
      }
    };
    
    const startTime = Date.now();
    telemetry.trackRequestPerformance(mockReq, mockRes, 150, {
      userId: 'test-user',
      correlationId: 'test-correlation'
    });
    const duration = Date.now() - startTime;
    
    addTestResult('Request Performance', 'Request performance tracking', true, null, duration);
    
  } catch (error) {
    addTestResult('Request Performance', 'Request performance tracking', false, error);
  }

  try {
    // Test with different request categories
    const appInsights = require('../config/applicationInsights');
    const telemetry = appInsights.telemetry;
    
    const requestTypes = [
      { url: '/api/files', category: 'api' },
      { url: '/auth/config', category: 'auth' },
      { url: '/health', category: 'health' },
      { url: '/static/style.css', category: 'other' }
    ];
    
    let allRequestTypesTracked = true;
    
    for (const reqType of requestTypes) {
      try {
        const mockReq = {
          method: 'GET',
          originalUrl: reqType.url,
          url: reqType.url,
          headers: { 'user-agent': 'test-agent' }
        };
        
        const mockRes = {
          statusCode: 200,
          get: () => null
        };
        
        telemetry.trackRequestPerformance(mockReq, mockRes, 100);
      } catch (error) {
        allRequestTypesTracked = false;
        break;
      }
    }
    
    addTestResult('Request Performance', 'Multiple request categories tracking', allRequestTypesTracked);
    
  } catch (error) {
    addTestResult('Request Performance', 'Multiple request categories tracking', false, error);
  }
}

/**
 * Test dependency tracking
 */
async function testDependencyTracking() {
  log('\\n🔗 Testing Dependency Tracking', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    const appInsights = require('../config/applicationInsights');
    const telemetry = appInsights.telemetry;
    
    // Test enhanced dependency tracking
    const startTime = Date.now();
    telemetry.trackDependency(
      'Test API',
      'GET /api/test',
      250,
      true,
      'HTTP',
      {
        resultCode: 200,
        requestSize: 100,
        responseSize: 500
      }
    );
    const duration = Date.now() - startTime;
    
    addTestResult('Dependency Tracking', 'Enhanced dependency tracking', true, null, duration);
    
  } catch (error) {
    addTestResult('Dependency Tracking', 'Enhanced dependency tracking', false, error);
  }

  try {
    const appInsights = require('../config/applicationInsights');
    const telemetry = appInsights.telemetry;
    
    // Test database operation tracking
    const startTime = Date.now();
    telemetry.trackDatabaseOperation(
      'SELECT',
      'users',
      75,
      true,
      {
        rowCount: 10,
        queryComplexity: 'simple'
      }
    );
    const duration = Date.now() - startTime;
    
    addTestResult('Dependency Tracking', 'Database operation tracking', true, null, duration);
    
  } catch (error) {
    addTestResult('Dependency Tracking', 'Database operation tracking', false, error);
  }

  try {
    const appInsights = require('../config/applicationInsights');
    const performanceMonitoring = appInsights.performanceMonitoring;
    
    // Test dependency call wrapper with success
    const startTime = Date.now();
    const result = await performanceMonitoring.trackDependencyCall(
      'Test Service',
      'HTTP',
      async () => {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 100));
        return { success: true, data: 'test' };
      },
      {
        command: 'test-operation',
        version: '1.0'
      }
    );
    const duration = Date.now() - startTime;
    
    const testPassed = result && result.success === true;
    
    addTestResult('Dependency Tracking', 'Dependency call wrapper (success)', testPassed, null, duration);
    
  } catch (error) {
    addTestResult('Dependency Tracking', 'Dependency call wrapper (success)', false, error);
  }

  try {
    const appInsights = require('../config/applicationInsights');
    const performanceMonitoring = appInsights.performanceMonitoring;
    
    // Test dependency call wrapper with failure
    let errorCaught = false;
    const startTime = Date.now();
    
    try {
      await performanceMonitoring.trackDependencyCall(
        'Failing Service',
        'HTTP',
        async () => {
          // Simulate API failure
          await new Promise(resolve => setTimeout(resolve, 50));
          const error = new Error('Service unavailable');
          error.status = 503;
          throw error;
        },
        {
          command: 'failing-operation'
        }
      );
    } catch (error) {
      errorCaught = true;
    }
    
    const duration = Date.now() - startTime;
    
    addTestResult('Dependency Tracking', 'Dependency call wrapper (failure)', errorCaught, null, duration);
    
  } catch (error) {
    addTestResult('Dependency Tracking', 'Dependency call wrapper (failure)', false, error);
  }
}

/**
 * Test operation performance tracking
 */
async function testOperationPerformanceTracking() {
  log('\\n⚙️  Testing Operation Performance Tracking', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    const appInsights = require('../config/applicationInsights');
    const performanceMonitoring = appInsights.performanceMonitoring;
    
    // Test successful operation tracking
    const result = await performanceMonitoring.trackOperation(
      'TestOperation',
      async () => {
        // Simulate operation
        await new Promise(resolve => setTimeout(resolve, 100));
        return { result: 'success', value: 42 };
      },
      {
        userId: 'test-user',
        operationType: 'computation'
      }
    );
    
    const testPassed = result && result.result === 'success' && result.value === 42;
    
    addTestResult('Operation Performance', 'Successful operation tracking', testPassed);
    
  } catch (error) {
    addTestResult('Operation Performance', 'Successful operation tracking', false, error);
  }

  try {
    const appInsights = require('../config/applicationInsights');
    const performanceMonitoring = appInsights.performanceMonitoring;
    
    // Test failed operation tracking
    let errorCaught = false;
    
    try {
      await performanceMonitoring.trackOperation(
        'FailingOperation',
        async () => {
          // Simulate operation failure
          await new Promise(resolve => setTimeout(resolve, 50));
          throw new Error('Operation failed');
        },
        {
          userId: 'test-user',
          operationType: 'failing-computation'
        }
      );
    } catch (error) {
      errorCaught = true;
    }
    
    addTestResult('Operation Performance', 'Failed operation tracking', errorCaught);
    
  } catch (error) {
    addTestResult('Operation Performance', 'Failed operation tracking', false, error);
  }

  try {
    const appInsights = require('../config/applicationInsights');
    const performanceMonitoring = appInsights.performanceMonitoring;
    
    // Test multiple concurrent operations
    const operations = [];
    for (let i = 0; i < 5; i++) {
      operations.push(
        performanceMonitoring.trackOperation(
          `ConcurrentOperation${i}`,
          async () => {
            await new Promise(resolve => setTimeout(resolve, 50 + (i * 10)));
            return { operationId: i, success: true };
          },
          { concurrencyTest: true }
        )
      );
    }
    
    const results = await Promise.all(operations);
    const testPassed = results.length === 5 && results.every(r => r.success === true);
    
    addTestResult('Operation Performance', 'Concurrent operations tracking', testPassed);
    
  } catch (error) {
    addTestResult('Operation Performance', 'Concurrent operations tracking', false, error);
  }
}

/**
 * Test performance monitoring lifecycle
 */
async function testPerformanceMonitoringLifecycle() {
  log('\\n🔄 Testing Performance Monitoring Lifecycle', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    const appInsights = require('../config/applicationInsights');
    const performanceMonitoring = appInsights.performanceMonitoring;
    
    // Test starting monitoring
    const startTime = Date.now();
    const monitoringInterval = performanceMonitoring.startMonitoring(1000); // 1 second interval
    const duration = Date.now() - startTime;
    
    const testPassed = monitoringInterval !== null;
    
    addTestResult('Monitoring Lifecycle', 'Start performance monitoring', testPassed, null, duration);
    
    // Wait a bit to let monitoring run
    if (testPassed) {
      await new Promise(resolve => setTimeout(resolve, 2500)); // Wait 2.5 seconds for 2+ cycles
      
      // Test stopping monitoring
      const stopStartTime = Date.now();
      performanceMonitoring.stopMonitoring(monitoringInterval);
      const stopDuration = Date.now() - stopStartTime;
      
      addTestResult('Monitoring Lifecycle', 'Stop performance monitoring', true, null, stopDuration);
    }
    
  } catch (error) {
    addTestResult('Monitoring Lifecycle', 'Performance monitoring lifecycle', false, error);
  }

  try {
    const appInsights = require('../config/applicationInsights');
    const performanceMonitoring = appInsights.performanceMonitoring;
    
    // Test monitoring with disabled configuration
    const originalConfig = appInsights.config.enableCustomTelemetry;
    appInsights.config.enableCustomTelemetry = false;
    
    const monitoringInterval = performanceMonitoring.startMonitoring(1000);
    const testPassed = monitoringInterval === null; // Should return null when disabled
    
    // Restore configuration
    appInsights.config.enableCustomTelemetry = originalConfig;
    
    addTestResult('Monitoring Lifecycle', 'Monitoring respects configuration', testPassed);
    
  } catch (error) {
    addTestResult('Monitoring Lifecycle', 'Monitoring respects configuration', false, error);
  }
}

/**
 * Test startup performance tracking
 */
async function testStartupPerformanceTracking() {
  log('\\n🚀 Testing Startup Performance Tracking', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    const appInsights = require('../config/applicationInsights');
    const telemetry = appInsights.telemetry;
    
    // Test startup performance tracking
    const startupMetrics = {
      properties: {
        version: '2.0.0',
        environment: 'test',
        features: 'all-enabled'
      },
      measurements: {
        startupDuration: 1500,
        moduleLoadTime: 500,
        configurationTime: 200,
        memoryUsage: 50 * 1024 * 1024
      }
    };
    
    const startTime = Date.now();
    telemetry.trackStartupPerformance(startupMetrics);
    const duration = Date.now() - startTime;
    
    addTestResult('Startup Performance', 'Startup performance tracking', true, null, duration);
    
  } catch (error) {
    addTestResult('Startup Performance', 'Startup performance tracking', false, error);
  }
}

/**
 * Test performance monitoring under load
 */
async function testPerformanceUnderLoad() {
  log('\\n⚡ Testing Performance Monitoring Under Load', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    const appInsights = require('../config/applicationInsights');
    const telemetry = appInsights.telemetry;
    const performanceMonitoring = appInsights.performanceMonitoring;
    
    // Test high-volume telemetry
    const iterations = 100;
    const startTime = Date.now();
    
    const promises = [];
    for (let i = 0; i < iterations; i++) {
      promises.push(
        performanceMonitoring.trackOperation(
          `LoadTestOperation${i}`,
          async () => {
            // Simulate quick operation
            await new Promise(resolve => setTimeout(resolve, 1));
            return { iteration: i };
          },
          { loadTest: true }
        )
      );
    }
    
    await Promise.all(promises);
    const totalDuration = Date.now() - startTime;
    const avgDuration = totalDuration / iterations;
    
    const testPassed = avgDuration < 50; // Less than 50ms average
    
    addTestResult('Performance Under Load', `High-volume operation tracking (${iterations} ops)`, testPassed, 
      testPassed ? null : `Average duration: ${avgDuration.toFixed(2)}ms`, totalDuration);
    
    if (process.env.DEBUG_TESTS === 'true') {
      log(`  ⚡ Total time: ${totalDuration}ms`, colors.blue);
      log(`  ⚡ Average per operation: ${avgDuration.toFixed(2)}ms`, colors.blue);
      log(`  ⚡ Operations per second: ~${Math.round(1000 / avgDuration)}`, colors.blue);
    }
    
  } catch (error) {
    addTestResult('Performance Under Load', 'High-volume operation tracking', false, error);
  }

  try {
    // Test memory usage under load
    const appInsights = require('../config/applicationInsights');
    const telemetry = appInsights.telemetry;
    
    const initialMemory = process.memoryUsage();
    
    // Generate telemetry load
    for (let i = 0; i < 500; i++) {
      telemetry.trackSystemPerformance({ loadTestMetric: i });
      telemetry.trackResourceUtilization();
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const finalMemory = process.memoryUsage();
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    const memoryIncreaseKB = Math.round(memoryIncrease / 1024);
    
    const testPassed = memoryIncreaseKB < 10000; // Less than 10MB increase
    
    addTestResult('Performance Under Load', 'Memory usage under telemetry load', testPassed, 
      testPassed ? null : `Memory increased by ${memoryIncreaseKB}KB`);
    
    if (process.env.DEBUG_TESTS === 'true') {
      log(`  💾 Memory increase: ${memoryIncreaseKB}KB`, colors.blue);
      log(`  💾 Final heap: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`, colors.blue);
    }
    
  } catch (error) {
    addTestResult('Performance Under Load', 'Memory usage under telemetry load', false, error);
  }
}

/**
 * Generate comprehensive test report
 */
function generateTestReport() {
  log('\\n📋 Performance Monitoring Testing Report', colors.cyan);
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
    log(`\\n✅ Overall Status: EXCELLENT - Performance monitoring is production-ready`, colors.green);
  } else if (successRate >= 85) {
    log(`\\n⚠️  Overall Status: GOOD - Minor performance monitoring issues need attention`, colors.yellow);
  } else if (successRate >= 70) {
    log(`\\n🔶 Overall Status: NEEDS WORK - Several performance monitoring issues require fixing`, colors.yellow);
  } else {
    log(`\\n❌ Overall Status: CRITICAL - Major performance monitoring issues prevent proper monitoring`, colors.red);
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

  log('🧪 TaktMate Performance Monitoring and Dependency Tracking Testing', colors.bright);
  log(`Environment: ${process.env.NODE_ENV || 'development'}`, colors.blue);

  try {
    switch (command) {
      case 'functions':
        await testPerformanceMonitoringFunctions();
        break;
      case 'system':
        await testSystemPerformanceMonitoring();
        break;
      case 'request':
        await testRequestPerformanceMonitoring();
        break;
      case 'dependency':
        await testDependencyTracking();
        break;
      case 'operation':
        await testOperationPerformanceTracking();
        break;
      case 'lifecycle':
        await testPerformanceMonitoringLifecycle();
        break;
      case 'startup':
        await testStartupPerformanceTracking();
        break;
      case 'load':
        await testPerformanceUnderLoad();
        break;
      case 'help':
        log('\\nUsage: node test-performance-monitoring.js [command]', colors.yellow);
        log('\\nCommands:', colors.yellow);
        log('  functions   - Test performance monitoring functions availability', colors.blue);
        log('  system      - Test system performance monitoring', colors.blue);
        log('  request     - Test request performance monitoring', colors.blue);
        log('  dependency  - Test dependency tracking', colors.blue);
        log('  operation   - Test operation performance tracking', colors.blue);
        log('  lifecycle   - Test monitoring lifecycle (start/stop)', colors.blue);
        log('  startup     - Test startup performance tracking', colors.blue);
        log('  load        - Test performance under load', colors.blue);
        log('  all         - Run all tests (default)', colors.blue);
        log('  help        - Display this help', colors.blue);
        break;
      case 'all':
      default:
        await testPerformanceMonitoringFunctions();
        await testSystemPerformanceMonitoring();
        await testRequestPerformanceMonitoring();
        await testDependencyTracking();
        await testOperationPerformanceTracking();
        await testPerformanceMonitoringLifecycle();
        await testStartupPerformanceTracking();
        await testPerformanceUnderLoad();
        
        const report = generateTestReport();
        
        log('\\n📖 Next Steps:', colors.cyan);
        if (report.success) {
          log('1. Performance monitoring is ready for production deployment', colors.blue);
          log('2. Configure Application Insights dashboards for performance metrics', colors.blue);
          log('3. Set up alerts for performance degradation and resource usage', colors.blue);
          log('4. Deploy and monitor performance data in Azure Portal', colors.blue);
        } else {
          log('1. Fix the performance monitoring issues identified in the test report', colors.red);
          log('2. Verify Application Insights configuration and connectivity', colors.blue);
          log('3. Check performance monitoring function implementations', colors.blue);
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
  testPerformanceMonitoringFunctions,
  testSystemPerformanceMonitoring,
  testRequestPerformanceMonitoring,
  testDependencyTracking,
  testOperationPerformanceTracking,
  testPerformanceMonitoringLifecycle,
  testStartupPerformanceTracking,
  testPerformanceUnderLoad,
  generateTestReport
};
