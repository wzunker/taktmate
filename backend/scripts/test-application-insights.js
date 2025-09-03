#!/usr/bin/env node

/**
 * Application Insights Testing Utility for TaktMate
 * 
 * This script tests the Application Insights configuration, telemetry tracking,
 * and monitoring capabilities to ensure proper setup and functionality.
 */

const { 
  initializeApplicationInsights, 
  getClient, 
  telemetry, 
  getConfigurationStatus,
  config 
} = require('../config/applicationInsights');

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
 * Test Application Insights configuration
 */
async function testConfiguration() {
  log('\n🔧 Testing Application Insights Configuration', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    // Test configuration status
    const configStatus = getConfigurationStatus();
    
    const testPassed = typeof configStatus === 'object' &&
                      typeof configStatus.configured === 'boolean' &&
                      typeof configStatus.environment === 'string';
    
    addTestResult('Configuration', 'Configuration status retrieval', testPassed);
    
    if (testPassed && config.enableDebugLogging) {
      log(`  📋 Configured: ${configStatus.configured}`, colors.blue);
      log(`  📋 Connection String: ${configStatus.connectionString ? 'Present' : 'Missing'}`, colors.blue);
      log(`  📋 Instrumentation Key: ${configStatus.instrumentationKey ? 'Present' : 'Missing'}`, colors.blue);
      log(`  📋 Environment: ${configStatus.environment}`, colors.blue);
      log(`  📋 Sampling: ${configStatus.samplingPercentage}%`, colors.blue);
      log(`  📋 Live Metrics: ${configStatus.liveMetricsEnabled ? 'Enabled' : 'Disabled'}`, colors.blue);
    }
    
  } catch (error) {
    addTestResult('Configuration', 'Configuration status retrieval', false, error);
  }

  try {
    // Test environment variables
    const requiredEnvVars = [
      'APPLICATIONINSIGHTS_CONNECTION_STRING',
      'APPINSIGHTS_INSTRUMENTATIONKEY'
    ];
    
    const hasConnectionString = !!process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
    const hasInstrumentationKey = !!process.env.APPINSIGHTS_INSTRUMENTATIONKEY;
    const hasEitherKey = hasConnectionString || hasInstrumentationKey;
    
    addTestResult('Configuration', 'Environment variables', hasEitherKey, 
      hasEitherKey ? null : 'Missing APPLICATIONINSIGHTS_CONNECTION_STRING and APPINSIGHTS_INSTRUMENTATIONKEY');
    
    if (config.enableDebugLogging) {
      log(`  🔑 Connection String: ${hasConnectionString ? 'Present' : 'Missing'}`, 
        hasConnectionString ? colors.green : colors.yellow);
      log(`  🔑 Instrumentation Key: ${hasInstrumentationKey ? 'Present' : 'Missing'}`, 
        hasInstrumentationKey ? colors.green : colors.yellow);
    }
    
  } catch (error) {
    addTestResult('Configuration', 'Environment variables', false, error);
  }

  try {
    // Test cloud role configuration
    const cloudRole = config.cloudRole;
    const cloudRoleInstance = config.cloudRoleInstance;
    
    const testPassed = cloudRole && cloudRole.length > 0 &&
                      cloudRoleInstance && cloudRoleInstance.length > 0;
    
    addTestResult('Configuration', 'Cloud role configuration', testPassed);
    
    if (config.enableDebugLogging) {
      log(`  ☁️  Cloud Role: ${cloudRole}`, colors.blue);
      log(`  ☁️  Cloud Role Instance: ${cloudRoleInstance}`, colors.blue);
    }
    
  } catch (error) {
    addTestResult('Configuration', 'Cloud role configuration', false, error);
  }
}

/**
 * Test Application Insights initialization
 */
async function testInitialization() {
  log('\n🚀 Testing Application Insights Initialization', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    // Test initialization
    const startTime = Date.now();
    const client = initializeApplicationInsights();
    const duration = Date.now() - startTime;
    
    const testPassed = client !== null;
    
    addTestResult('Initialization', 'Application Insights initialization', testPassed, null, duration);
    
    if (testPassed && config.enableDebugLogging) {
      log(`  🎯 Client initialized successfully`, colors.green);
      log(`  🎯 Initialization duration: ${duration}ms`, colors.blue);
    }
    
  } catch (error) {
    addTestResult('Initialization', 'Application Insights initialization', false, error);
  }

  try {
    // Test client retrieval
    const client = getClient();
    const testPassed = client !== null && client !== undefined;
    
    addTestResult('Initialization', 'Client retrieval', testPassed);
    
    if (testPassed && config.enableDebugLogging) {
      log(`  📱 Client object available`, colors.green);
      log(`  📱 Client type: ${typeof client}`, colors.blue);
    }
    
  } catch (error) {
    addTestResult('Initialization', 'Client retrieval', false, error);
  }

  try {
    // Test client properties
    const client = getClient();
    if (client) {
      const hasContext = client.context && typeof client.context === 'object';
      const hasConfig = client.config && typeof client.config === 'object';
      const hasTrackMethods = typeof client.trackEvent === 'function' &&
                            typeof client.trackMetric === 'function' &&
                            typeof client.trackException === 'function';
      
      const testPassed = hasContext && hasConfig && hasTrackMethods;
      
      addTestResult('Initialization', 'Client properties validation', testPassed);
      
      if (config.enableDebugLogging) {
        log(`  🔍 Context: ${hasContext ? 'Available' : 'Missing'}`, colors.blue);
        log(`  🔍 Config: ${hasConfig ? 'Available' : 'Missing'}`, colors.blue);
        log(`  🔍 Track Methods: ${hasTrackMethods ? 'Available' : 'Missing'}`, colors.blue);
      }
    } else {
      addTestResult('Initialization', 'Client properties validation', false, 'Client not available');
    }
    
  } catch (error) {
    addTestResult('Initialization', 'Client properties validation', false, error);
  }
}

/**
 * Test telemetry tracking functionality
 */
async function testTelemetryTracking() {
  log('\n📊 Testing Telemetry Tracking', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  // Test custom event tracking
  try {
    const startTime = Date.now();
    telemetry.trackEvent('TestEvent', {
      testType: 'automated',
      testId: `test-${Date.now()}`,
      environment: 'testing'
    }, {
      duration: 100,
      testValue: 42
    });
    const duration = Date.now() - startTime;
    
    addTestResult('Telemetry', 'Custom event tracking', true, null, duration);
    
  } catch (error) {
    addTestResult('Telemetry', 'Custom event tracking', false, error);
  }

  // Test metric tracking
  try {
    const startTime = Date.now();
    telemetry.trackMetric('TestMetric', 123.45, {
      testType: 'automated',
      metricCategory: 'performance'
    });
    const duration = Date.now() - startTime;
    
    addTestResult('Telemetry', 'Custom metric tracking', true, null, duration);
    
  } catch (error) {
    addTestResult('Telemetry', 'Custom metric tracking', false, error);
  }

  // Test authentication tracking
  try {
    const startTime = Date.now();
    telemetry.trackAuthentication(
      'test-user-123',
      'test@example.com',
      'azure-ad-b2c',
      true,
      250,
      { testRun: true }
    );
    const duration = Date.now() - startTime;
    
    addTestResult('Telemetry', 'Authentication event tracking', true, null, duration);
    
  } catch (error) {
    addTestResult('Telemetry', 'Authentication event tracking', false, error);
  }

  // Test file upload tracking
  try {
    const startTime = Date.now();
    if (typeof telemetry.trackFileUpload === 'function') {
      telemetry.trackFileUpload(
        'test-user-123',
        1024,
        100,
        500,
        true
      );
    }
    const duration = Date.now() - startTime;
    
    addTestResult('Telemetry', 'File upload tracking', true, null, duration);
    
  } catch (error) {
    addTestResult('Telemetry', 'File upload tracking', false, error);
  }

  // Test chat interaction tracking
  try {
    const startTime = Date.now();
    if (typeof telemetry.trackChatInteraction === 'function') {
      telemetry.trackChatInteraction(
        'test-user-123',
        50,
        1200,
        true,
        150
      );
    }
    const duration = Date.now() - startTime;
    
    addTestResult('Telemetry', 'Chat interaction tracking', true, null, duration);
    
  } catch (error) {
    addTestResult('Telemetry', 'Chat interaction tracking', false, error);
  }

  // Test error tracking
  try {
    const startTime = Date.now();
    const testError = new Error('Test error for Application Insights validation');
    telemetry.trackError(testError, 'test-user-123', {
      testType: 'automated',
      component: 'test-suite'
    });
    const duration = Date.now() - startTime;
    
    addTestResult('Telemetry', 'Error tracking', true, null, duration);
    
  } catch (error) {
    addTestResult('Telemetry', 'Error tracking', false, error);
  }

  // Test dependency tracking
  try {
    const startTime = Date.now();
    if (typeof telemetry.trackDependency === 'function') {
      telemetry.trackDependency(
        'test-api',
        'GET /test',
        150,
        true,
        'HTTP'
      );
    }
    const duration = Date.now() - startTime;
    
    addTestResult('Telemetry', 'Dependency tracking', true, null, duration);
    
  } catch (error) {
    addTestResult('Telemetry', 'Dependency tracking', false, error);
  }
}

/**
 * Test telemetry performance
 */
async function testTelemetryPerformance() {
  log('\n⚡ Testing Telemetry Performance', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    // Test multiple events performance
    const eventCount = 100;
    const startTime = Date.now();
    
    for (let i = 0; i < eventCount; i++) {
      telemetry.trackEvent(`TestEvent${i}`, {
        iteration: i,
        batch: 'performance-test'
      }, {
        value: Math.random() * 100
      });
    }
    
    const duration = Date.now() - startTime;
    const avgDuration = duration / eventCount;
    
    const testPassed = avgDuration < 5; // Less than 5ms per event
    
    addTestResult('Performance', `Batch event tracking (${eventCount} events)`, testPassed, null, duration);
    
    if (config.enableDebugLogging) {
      log(`  ⚡ Total duration: ${duration}ms`, colors.blue);
      log(`  ⚡ Average per event: ${avgDuration.toFixed(2)}ms`, colors.blue);
      log(`  ⚡ Events per second: ${Math.round(1000 / avgDuration)}`, colors.blue);
    }
    
  } catch (error) {
    addTestResult('Performance', 'Batch event tracking', false, error);
  }

  try {
    // Test concurrent telemetry
    const concurrentCount = 10;
    const promises = [];
    const startTime = Date.now();
    
    for (let i = 0; i < concurrentCount; i++) {
      promises.push(new Promise(resolve => {
        telemetry.trackMetric(`ConcurrentMetric${i}`, Math.random() * 100);
        resolve();
      }));
    }
    
    await Promise.all(promises);
    const duration = Date.now() - startTime;
    
    const testPassed = duration < 100; // Less than 100ms for 10 concurrent calls
    
    addTestResult('Performance', `Concurrent telemetry (${concurrentCount} calls)`, testPassed, null, duration);
    
  } catch (error) {
    addTestResult('Performance', 'Concurrent telemetry', false, error);
  }

  try {
    // Test memory usage
    const initialMemory = process.memoryUsage();
    
    // Generate telemetry load
    for (let i = 0; i < 1000; i++) {
      telemetry.trackEvent('MemoryTestEvent', { iteration: i });
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const finalMemory = process.memoryUsage();
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    const memoryIncreaseKB = Math.round(memoryIncrease / 1024);
    
    const testPassed = memoryIncreaseKB < 1000; // Less than 1MB increase
    
    addTestResult('Performance', 'Memory usage impact', testPassed, 
      testPassed ? null : `Memory increased by ${memoryIncreaseKB}KB`);
    
    if (config.enableDebugLogging) {
      log(`  💾 Memory increase: ${memoryIncreaseKB}KB`, colors.blue);
      log(`  💾 Heap used: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`, colors.blue);
    }
    
  } catch (error) {
    addTestResult('Performance', 'Memory usage impact', false, error);
  }
}

/**
 * Test Application Insights features
 */
async function testFeatures() {
  log('\n🎯 Testing Application Insights Features', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    // Test sampling configuration
    const client = getClient();
    if (client && client.config) {
      const samplingPercentage = client.config.samplingPercentage;
      const testPassed = typeof samplingPercentage === 'number' &&
                        samplingPercentage >= 0 &&
                        samplingPercentage <= 100;
      
      addTestResult('Features', 'Sampling configuration', testPassed);
      
      if (config.enableDebugLogging) {
        log(`  🎲 Sampling percentage: ${samplingPercentage}%`, colors.blue);
      }
    } else {
      addTestResult('Features', 'Sampling configuration', false, 'Client config not available');
    }
    
  } catch (error) {
    addTestResult('Features', 'Sampling configuration', false, error);
  }

  try {
    // Test context tags
    const client = getClient();
    if (client && client.context && client.context.tags) {
      const hasCloudRole = !!client.context.tags[client.context.keys.cloudRole];
      const hasCloudRoleInstance = !!client.context.tags[client.context.keys.cloudRoleInstance];
      const hasAppVersion = !!client.context.tags[client.context.keys.applicationVersion];
      
      const testPassed = hasCloudRole && hasCloudRoleInstance;
      
      addTestResult('Features', 'Context tags configuration', testPassed);
      
      if (config.enableDebugLogging) {
        log(`  🏷️  Cloud Role: ${hasCloudRole ? 'Set' : 'Missing'}`, colors.blue);
        log(`  🏷️  Cloud Role Instance: ${hasCloudRoleInstance ? 'Set' : 'Missing'}`, colors.blue);
        log(`  🏷️  Application Version: ${hasAppVersion ? 'Set' : 'Missing'}`, colors.blue);
      }
    } else {
      addTestResult('Features', 'Context tags configuration', false, 'Client context not available');
    }
    
  } catch (error) {
    addTestResult('Features', 'Context tags configuration', false, error);
  }

  try {
    // Test common properties
    const client = getClient();
    if (client && client.commonProperties) {
      const hasEnvironment = !!client.commonProperties.environment;
      const hasVersion = !!client.commonProperties.version;
      const hasCloudRole = !!client.commonProperties.cloudRole;
      
      const testPassed = hasEnvironment && hasVersion && hasCloudRole;
      
      addTestResult('Features', 'Common properties configuration', testPassed);
      
      if (config.enableDebugLogging) {
        log(`  📋 Environment: ${hasEnvironment ? client.commonProperties.environment : 'Missing'}`, colors.blue);
        log(`  📋 Version: ${hasVersion ? client.commonProperties.version : 'Missing'}`, colors.blue);
        log(`  📋 Cloud Role: ${hasCloudRole ? client.commonProperties.cloudRole : 'Missing'}`, colors.blue);
      }
    } else {
      addTestResult('Features', 'Common properties configuration', false, 'Common properties not available');
    }
    
  } catch (error) {
    addTestResult('Features', 'Common properties configuration', false, error);
  }
}

/**
 * Test Application Insights connectivity
 */
async function testConnectivity() {
  log('\n🌐 Testing Application Insights Connectivity', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    // Test telemetry flush
    const client = getClient();
    if (client && typeof client.flush === 'function') {
      const startTime = Date.now();
      
      // Send a test event and flush
      telemetry.trackEvent('ConnectivityTest', {
        timestamp: new Date().toISOString(),
        testType: 'connectivity'
      });
      
      client.flush();
      const duration = Date.now() - startTime;
      
      addTestResult('Connectivity', 'Telemetry flush operation', true, null, duration);
      
    } else {
      addTestResult('Connectivity', 'Telemetry flush operation', false, 'Flush method not available');
    }
    
  } catch (error) {
    addTestResult('Connectivity', 'Telemetry flush operation', false, error);
  }

  try {
    // Test configuration validation
    const configStatus = getConfigurationStatus();
    const hasValidConfig = configStatus.configured && 
                          (configStatus.connectionString || configStatus.instrumentationKey);
    
    addTestResult('Connectivity', 'Configuration validation', hasValidConfig,
      hasValidConfig ? null : 'Missing valid connection configuration');
    
  } catch (error) {
    addTestResult('Connectivity', 'Configuration validation', false, error);
  }

  try {
    // Test endpoint accessibility (basic validation)
    const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
    if (connectionString) {
      const hasIngestionEndpoint = connectionString.includes('IngestionEndpoint=');
      const hasLiveEndpoint = connectionString.includes('LiveEndpoint=');
      
      const testPassed = hasIngestionEndpoint;
      
      addTestResult('Connectivity', 'Endpoint configuration', testPassed);
      
      if (config.enableDebugLogging) {
        log(`  🔗 Ingestion Endpoint: ${hasIngestionEndpoint ? 'Present' : 'Missing'}`, colors.blue);
        log(`  🔗 Live Endpoint: ${hasLiveEndpoint ? 'Present' : 'Missing'}`, colors.blue);
      }
    } else {
      addTestResult('Connectivity', 'Endpoint configuration', false, 'Connection string not available');
    }
    
  } catch (error) {
    addTestResult('Connectivity', 'Endpoint configuration', false, error);
  }
}

/**
 * Generate comprehensive test report
 */
function generateTestReport() {
  log('\n📋 Application Insights Testing Report', colors.cyan);
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

  // Configuration summary
  const configStatus = getConfigurationStatus();
  log(`\n⚙️  Configuration Summary:`, colors.yellow);
  log(`  Configured: ${configStatus.configured ? 'Yes' : 'No'}`, configStatus.configured ? colors.green : colors.red);
  log(`  Environment: ${configStatus.environment}`, colors.blue);
  log(`  Sampling: ${configStatus.samplingPercentage}%`, colors.blue);
  log(`  Live Metrics: ${configStatus.liveMetricsEnabled ? 'Enabled' : 'Disabled'}`, colors.blue);

  // Overall status
  if (successRate >= 95) {
    log(`\n✅ Overall Status: EXCELLENT - Application Insights is production-ready`, colors.green);
  } else if (successRate >= 85) {
    log(`\n⚠️  Overall Status: GOOD - Minor issues need attention`, colors.yellow);
  } else if (successRate >= 70) {
    log(`\n🔶 Overall Status: NEEDS WORK - Several issues require fixing`, colors.yellow);
  } else {
    log(`\n❌ Overall Status: CRITICAL - Major issues prevent proper monitoring`, colors.red);
  }

  return {
    success: successRate >= 85,
    summary: testResults,
    configuration: configStatus
  };
}

/**
 * Main function
 */
async function main() {
  const command = process.argv[2] || 'all';

  log('🧪 TaktMate Application Insights Testing', colors.bright);
  log(`Environment: ${process.env.NODE_ENV || 'development'}`, colors.blue);

  try {
    switch (command) {
      case 'config':
        await testConfiguration();
        break;
      case 'init':
        await testInitialization();
        break;
      case 'telemetry':
        await testTelemetryTracking();
        break;
      case 'performance':
        await testTelemetryPerformance();
        break;
      case 'features':
        await testFeatures();
        break;
      case 'connectivity':
        await testConnectivity();
        break;
      case 'help':
        log('\nUsage: node test-application-insights.js [command]', colors.yellow);
        log('\nCommands:', colors.yellow);
        log('  config       - Test configuration and environment variables', colors.blue);
        log('  init         - Test Application Insights initialization', colors.blue);
        log('  telemetry    - Test telemetry tracking functionality', colors.blue);
        log('  performance  - Test telemetry performance characteristics', colors.blue);
        log('  features     - Test Application Insights features', colors.blue);
        log('  connectivity - Test connectivity and endpoint configuration', colors.blue);
        log('  all          - Run all tests (default)', colors.blue);
        log('  help         - Display this help', colors.blue);
        break;
      case 'all':
      default:
        await testConfiguration();
        await testInitialization();
        await testTelemetryTracking();
        await testTelemetryPerformance();
        await testFeatures();
        await testConnectivity();
        
        const report = generateTestReport();
        
        log('\n📖 Next Steps:', colors.cyan);
        if (report.success) {
          log('1. Application Insights is ready for production use', colors.blue);
          log('2. Configure custom dashboards in Azure Portal', colors.blue);
          log('3. Set up alerts for critical metrics', colors.blue);
          log('4. Review telemetry data in Azure Portal', colors.blue);
        } else {
          log('1. Fix the issues identified in the test report', colors.red);
          log('2. Verify Application Insights resource configuration', colors.blue);
          log('3. Check network connectivity to Azure endpoints', colors.blue);
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
  testConfiguration,
  testInitialization,
  testTelemetryTracking,
  testTelemetryPerformance,
  testFeatures,
  testConnectivity,
  generateTestReport
};
