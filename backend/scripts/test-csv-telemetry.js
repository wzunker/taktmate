#!/usr/bin/env node

/**
 * CSV Telemetry Testing for TaktMate
 * 
 * This script tests the comprehensive CSV upload and processing telemetry
 * functionality, including file uploads, chat interactions, parsing operations,
 * and business metrics tracking.
 */

const request = require('supertest');
const express = require('express');
const multer = require('multer');

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
 * Create test CSV content
 */
function createTestCSV(rows = 100, columns = 5) {
  const headers = Array.from({ length: columns }, (_, i) => `Column${i + 1}`);
  let csvContent = headers.join(',') + '\\n';
  
  for (let i = 0; i < rows; i++) {
    const row = Array.from({ length: columns }, (_, j) => `Value${i + 1}_${j + 1}`);
    csvContent += row.join(',') + '\\n';
  }
  
  return csvContent;
}

/**
 * Test CSV telemetry functions availability
 */
async function testTelemetryFunctions() {
  log('\\n📊 Testing CSV Telemetry Functions Availability', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    const appInsights = require('../config/applicationInsights');
    const telemetry = appInsights.telemetry;
    
    const requiredFunctions = [
      'trackFileUpload',
      'trackChatInteraction',
      'trackCSVParsing',
      'trackCSVAnalysis',
      'trackCSVFileOperation',
      'trackCSVError',
      'trackCSVBusinessMetrics'
    ];
    
    let allFunctionsAvailable = true;
    const functionStatus = {};
    
    for (const func of requiredFunctions) {
      const isAvailable = typeof telemetry[func] === 'function';
      functionStatus[func] = isAvailable;
      if (!isAvailable) allFunctionsAvailable = false;
    }
    
    addTestResult('Telemetry Functions', 'All CSV telemetry functions available', allFunctionsAvailable);
    
    if (process.env.DEBUG_TESTS === 'true') {
      Object.entries(functionStatus).forEach(([func, available]) => {
        log(`  📊 ${func}: ${available ? 'Available' : 'Missing'}`, colors.blue);
      });
    }
    
  } catch (error) {
    addTestResult('Telemetry Functions', 'CSV telemetry functions availability', false, error);
  }
}

/**
 * Test file upload telemetry
 */
async function testFileUploadTelemetry() {
  log('\\n📤 Testing File Upload Telemetry', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    const appInsights = require('../config/applicationInsights');
    const telemetry = appInsights.telemetry;
    
    // Test small file upload telemetry
    const startTime = Date.now();
    telemetry.trackFileUpload(
      'test-user-123',
      'test-small.csv',
      1024, // 1KB
      100,  // 100 rows
      50,   // 50ms processing time
      true, // success
      {
        userEmail: 'test@example.com',
        columnCount: 5,
        encoding: 'utf-8'
      }
    );
    const duration = Date.now() - startTime;
    
    addTestResult('File Upload Telemetry', 'Small file upload tracking', true, null, duration);
    
  } catch (error) {
    addTestResult('File Upload Telemetry', 'Small file upload tracking', false, error);
  }

  try {
    const appInsights = require('../config/applicationInsights');
    const telemetry = appInsights.telemetry;
    
    // Test large file upload telemetry
    const startTime = Date.now();
    telemetry.trackFileUpload(
      'test-user-123',
      'test-large.csv',
      5 * 1024 * 1024, // 5MB
      100000,          // 100k rows
      2000,           // 2s processing time
      true,           // success
      {
        userEmail: 'test@example.com',
        columnCount: 20,
        encoding: 'utf-8',
        hasSpecialCharacters: true
      }
    );
    const duration = Date.now() - startTime;
    
    addTestResult('File Upload Telemetry', 'Large file upload tracking', true, null, duration);
    
  } catch (error) {
    addTestResult('File Upload Telemetry', 'Large file upload tracking', false, error);
  }

  try {
    const appInsights = require('../config/applicationInsights');
    const telemetry = appInsights.telemetry;
    
    // Test failed upload telemetry
    const testError = new Error('CSV parsing failed');
    const startTime = Date.now();
    telemetry.trackCSVError(
      testError,
      'test-user-123',
      null,
      'failed-upload.csv',
      'upload',
      {
        fileSize: 2048,
        duration: 100,
        errorStage: 'parsing'
      }
    );
    const duration = Date.now() - startTime;
    
    addTestResult('File Upload Telemetry', 'Failed upload error tracking', true, null, duration);
    
  } catch (error) {
    addTestResult('File Upload Telemetry', 'Failed upload error tracking', false, error);
  }
}

/**
 * Test CSV parsing telemetry
 */
async function testCSVParsingTelemetry() {
  log('\\n🔍 Testing CSV Parsing Telemetry', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    const appInsights = require('../config/applicationInsights');
    const telemetry = appInsights.telemetry;
    
    // Test simple CSV parsing
    const startTime = Date.now();
    telemetry.trackCSVParsing(
      'test-user-123',
      'simple.csv',
      1024,  // 1KB
      50,    // 50 rows
      5,     // 5 columns
      25,    // 25ms parse time
      true,  // success
      {
        encoding: 'utf-8',
        delimiter: 'comma',
        hasEmptyRows: false,
        hasSpecialCharacters: false
      }
    );
    const duration = Date.now() - startTime;
    
    addTestResult('CSV Parsing Telemetry', 'Simple CSV parsing tracking', true, null, duration);
    
  } catch (error) {
    addTestResult('CSV Parsing Telemetry', 'Simple CSV parsing tracking', false, error);
  }

  try {
    const appInsights = require('../config/applicationInsights');
    const telemetry = appInsights.telemetry;
    
    // Test complex CSV parsing
    const startTime = Date.now();
    telemetry.trackCSVParsing(
      'test-user-123',
      'complex.csv',
      10 * 1024 * 1024, // 10MB
      50000,            // 50k rows
      75,               // 75 columns (complex structure)
      5000,            // 5s parse time
      true,            // success
      {
        encoding: 'utf-8',
        delimiter: 'comma',
        hasEmptyRows: true,
        hasSpecialCharacters: true,
        memoryUsage: 50 * 1024 * 1024 // 50MB
      }
    );
    const duration = Date.now() - startTime;
    
    addTestResult('CSV Parsing Telemetry', 'Complex CSV parsing tracking', true, null, duration);
    
  } catch (error) {
    addTestResult('CSV Parsing Telemetry', 'Complex CSV parsing tracking', false, error);
  }
}

/**
 * Test chat interaction telemetry
 */
async function testChatInteractionTelemetry() {
  log('\\n💬 Testing Chat Interaction Telemetry', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    const appInsights = require('../config/applicationInsights');
    const telemetry = appInsights.telemetry;
    
    // Test simple chat interaction
    const startTime = Date.now();
    telemetry.trackChatInteraction(
      'test-user-123',
      'file-123',
      'test.csv',
      50,    // message length
      1500,  // 1.5s response time
      true,  // success
      {
        userEmail: 'test@example.com',
        replyLength: 200,
        tokenUsage: 150,
        promptTokens: 100,
        completionTokens: 50,
        fileSize: 2048,
        fileRowCount: 100
      }
    );
    const duration = Date.now() - startTime;
    
    addTestResult('Chat Interaction Telemetry', 'Simple chat interaction tracking', true, null, duration);
    
  } catch (error) {
    addTestResult('Chat Interaction Telemetry', 'Simple chat interaction tracking', false, error);
  }

  try {
    const appInsights = require('../config/applicationInsights');
    const telemetry = appInsights.telemetry;
    
    // Test complex chat interaction
    const startTime = Date.now();
    telemetry.trackChatInteraction(
      'test-user-123',
      'file-456',
      'large-dataset.csv',
      800,   // long message (complex)
      8000,  // 8s response time (slow)
      true,  // success
      {
        userEmail: 'test@example.com',
        replyLength: 1500,
        tokenUsage: 2000,
        promptTokens: 1500,
        completionTokens: 500,
        fileSize: 5 * 1024 * 1024,
        fileRowCount: 50000
      }
    );
    const duration = Date.now() - startTime;
    
    addTestResult('Chat Interaction Telemetry', 'Complex chat interaction tracking', true, null, duration);
    
  } catch (error) {
    addTestResult('Chat Interaction Telemetry', 'Complex chat interaction tracking', false, error);
  }

  try {
    const appInsights = require('../config/applicationInsights');
    const telemetry = appInsights.telemetry;
    
    // Test failed chat interaction
    const startTime = Date.now();
    telemetry.trackChatInteraction(
      'test-user-123',
      'file-789',
      'problematic.csv',
      100,   // message length
      2000,  // response time
      false, // failed
      {
        userEmail: 'test@example.com',
        errorType: 'OpenAIError',
        errorMessage: 'Rate limit exceeded',
        fileSize: 1024,
        fileRowCount: 50
      }
    );
    const duration = Date.now() - startTime;
    
    addTestResult('Chat Interaction Telemetry', 'Failed chat interaction tracking', true, null, duration);
    
  } catch (error) {
    addTestResult('Chat Interaction Telemetry', 'Failed chat interaction tracking', false, error);
  }
}

/**
 * Test CSV data analysis telemetry
 */
async function testCSVAnalysisTelemetry() {
  log('\\n📈 Testing CSV Data Analysis Telemetry', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    const appInsights = require('../config/applicationInsights');
    const telemetry = appInsights.telemetry;
    
    // Test simple analysis
    const startTime = Date.now();
    telemetry.trackCSVAnalysis(
      'test-user-123',
      'file-123',
      'data.csv',
      'summary_statistics',
      500,   // 500ms analysis time
      true,  // success
      {
        dataPoints: 500,
        columnsAnalyzed: 5,
        rowsAnalyzed: 100,
        memoryUsage: 10 * 1024 * 1024
      }
    );
    const duration = Date.now() - startTime;
    
    addTestResult('CSV Analysis Telemetry', 'Simple data analysis tracking', true, null, duration);
    
  } catch (error) {
    addTestResult('CSV Analysis Telemetry', 'Simple data analysis tracking', false, error);
  }

  try {
    const appInsights = require('../config/applicationInsights');
    const telemetry = appInsights.telemetry;
    
    // Test complex analysis
    const startTime = Date.now();
    telemetry.trackCSVAnalysis(
      'test-user-123',
      'file-456',
      'big-data.csv',
      'correlation_analysis',
      10000, // 10s analysis time (complex)
      true,  // success
      {
        dataPoints: 1000000,
        columnsAnalyzed: 50,
        rowsAnalyzed: 20000,
        memoryUsage: 500 * 1024 * 1024
      }
    );
    const duration = Date.now() - startTime;
    
    addTestResult('CSV Analysis Telemetry', 'Complex data analysis tracking', true, null, duration);
    
  } catch (error) {
    addTestResult('CSV Analysis Telemetry', 'Complex data analysis tracking', false, error);
  }
}

/**
 * Test file operations telemetry
 */
async function testFileOperationsTelemetry() {
  log('\\n📁 Testing File Operations Telemetry', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  const operations = ['view', 'list', 'delete', 'download'];
  
  for (const operation of operations) {
    try {
      const appInsights = require('../config/applicationInsights');
      const telemetry = appInsights.telemetry;
      
      const startTime = Date.now();
      telemetry.trackCSVFileOperation(
        'test-user-123',
        operation === 'list' ? null : 'file-123',
        operation === 'list' ? 'file_list' : 'test.csv',
        operation,
        Math.random() * 100 + 10, // 10-110ms operation time
        true, // success
        {
          fileSize: 2048,
          rowCount: 100,
          userAgent: 'test-agent'
        }
      );
      const duration = Date.now() - startTime;
      
      addTestResult('File Operations Telemetry', `${operation} operation tracking`, true, null, duration);
      
    } catch (error) {
      addTestResult('File Operations Telemetry', `${operation} operation tracking`, false, error);
    }
  }
}

/**
 * Test business metrics telemetry
 */
async function testBusinessMetricsTelemetry() {
  log('\\n💼 Testing Business Metrics Telemetry', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    const appInsights = require('../config/applicationInsights');
    const telemetry = appInsights.telemetry;
    
    // Test comprehensive business metrics
    const businessMetrics = {
      totalFilesUploaded: 5,
      totalDataPointsProcessed: 50000,
      averageFileSize: 2 * 1024 * 1024,
      processingEfficiency: 1000,
      totalChatInteractions: 25,
      totalTokensUsed: 5000,
      averageResponseTime: 2000,
      dataEfficiency: 100,
      userEngagement: 0.85,
      systemUtilization: 0.65
    };
    
    const startTime = Date.now();
    telemetry.trackCSVBusinessMetrics(
      'test-user-123',
      'file-123',
      'business-data.csv',
      businessMetrics,
      {
        reportingPeriod: 'daily',
        businessUnit: 'analytics'
      }
    );
    const duration = Date.now() - startTime;
    
    addTestResult('Business Metrics Telemetry', 'Comprehensive business metrics tracking', true, null, duration);
    
  } catch (error) {
    addTestResult('Business Metrics Telemetry', 'Comprehensive business metrics tracking', false, error);
  }

  try {
    const appInsights = require('../config/applicationInsights');
    const telemetry = appInsights.telemetry;
    
    // Test KPI-specific metrics
    const kpiMetrics = {
      uploadSuccessRate: 0.95,
      averageProcessingTime: 1500,
      userSatisfactionScore: 4.2,
      systemAvailability: 0.999,
      costPerProcessedRow: 0.001
    };
    
    const startTime = Date.now();
    telemetry.trackCSVBusinessMetrics(
      'system',
      null,
      'kpi-dashboard',
      kpiMetrics,
      {
        metricType: 'kpi',
        aggregationLevel: 'system'
      }
    );
    const duration = Date.now() - startTime;
    
    addTestResult('Business Metrics Telemetry', 'KPI metrics tracking', true, null, duration);
    
  } catch (error) {
    addTestResult('Business Metrics Telemetry', 'KPI metrics tracking', false, error);
  }
}

/**
 * Test telemetry performance characteristics
 */
async function testTelemetryPerformance() {
  log('\\n⚡ Testing Telemetry Performance Characteristics', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    const appInsights = require('../config/applicationInsights');
    const telemetry = appInsights.telemetry;
    
    // Test bulk telemetry performance
    const iterations = 100;
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      
      // Simulate a complete CSV processing flow
      telemetry.trackFileUpload(
        `test-user-${i}`,
        `test-file-${i}.csv`,
        1024 + (i * 10),
        100 + i,
        50 + (i % 10),
        true
      );
      
      telemetry.trackCSVParsing(
        `test-user-${i}`,
        `test-file-${i}.csv`,
        1024 + (i * 10),
        100 + i,
        5,
        25 + (i % 5),
        true
      );
      
      telemetry.trackChatInteraction(
        `test-user-${i}`,
        `file-${i}`,
        `test-file-${i}.csv`,
        50 + (i % 20),
        1000 + (i * 10),
        true
      );
      
      const duration = Date.now() - startTime;
      times.push(duration);
    }
    
    const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    const maxTime = Math.max(...times);
    const minTime = Math.min(...times);
    
    const testPassed = avgTime < 10; // Less than 10ms average for full flow
    
    addTestResult('Telemetry Performance', `Bulk telemetry processing (${iterations} flows)`, testPassed, null, Math.round(avgTime * 100) / 100);
    
    if (process.env.DEBUG_TESTS === 'true') {
      log(`  ⚡ Average: ${avgTime.toFixed(2)}ms`, colors.blue);
      log(`  ⚡ Min: ${minTime}ms, Max: ${maxTime}ms`, colors.blue);
      log(`  ⚡ Flows per second: ~${Math.round(1000 / avgTime)}`, colors.blue);
    }
    
  } catch (error) {
    addTestResult('Telemetry Performance', 'Bulk telemetry processing', false, error);
  }

  try {
    // Test memory usage impact
    const initialMemory = process.memoryUsage();
    const appInsights = require('../config/applicationInsights');
    const telemetry = appInsights.telemetry;
    
    // Generate telemetry load
    for (let i = 0; i < 1000; i++) {
      telemetry.trackCSVBusinessMetrics(
        `user-${i}`,
        `file-${i}`,
        `test-${i}.csv`,
        { testMetric: i, processingTime: i * 10 }
      );
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const finalMemory = process.memoryUsage();
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    const memoryIncreaseKB = Math.round(memoryIncrease / 1024);
    
    const testPassed = memoryIncreaseKB < 5000; // Less than 5MB increase
    
    addTestResult('Telemetry Performance', 'Memory usage impact', testPassed, 
      testPassed ? null : `Memory increased by ${memoryIncreaseKB}KB`);
    
    if (process.env.DEBUG_TESTS === 'true') {
      log(`  💾 Memory increase: ${memoryIncreaseKB}KB`, colors.blue);
      log(`  💾 Final heap: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`, colors.blue);
    }
    
  } catch (error) {
    addTestResult('Telemetry Performance', 'Memory usage impact', false, error);
  }
}

/**
 * Generate comprehensive test report
 */
function generateTestReport() {
  log('\\n📋 CSV Telemetry Testing Report', colors.cyan);
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
    log(`\\n✅ Overall Status: EXCELLENT - CSV telemetry is production-ready`, colors.green);
  } else if (successRate >= 85) {
    log(`\\n⚠️  Overall Status: GOOD - Minor telemetry issues need attention`, colors.yellow);
  } else if (successRate >= 70) {
    log(`\\n🔶 Overall Status: NEEDS WORK - Several telemetry issues require fixing`, colors.yellow);
  } else {
    log(`\\n❌ Overall Status: CRITICAL - Major telemetry issues prevent proper monitoring`, colors.red);
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

  log('🧪 TaktMate CSV Telemetry Testing', colors.bright);
  log(`Environment: ${process.env.NODE_ENV || 'development'}`, colors.blue);

  try {
    switch (command) {
      case 'functions':
        await testTelemetryFunctions();
        break;
      case 'upload':
        await testFileUploadTelemetry();
        break;
      case 'parsing':
        await testCSVParsingTelemetry();
        break;
      case 'chat':
        await testChatInteractionTelemetry();
        break;
      case 'analysis':
        await testCSVAnalysisTelemetry();
        break;
      case 'operations':
        await testFileOperationsTelemetry();
        break;
      case 'business':
        await testBusinessMetricsTelemetry();
        break;
      case 'performance':
        await testTelemetryPerformance();
        break;
      case 'help':
        log('\\nUsage: node test-csv-telemetry.js [command]', colors.yellow);
        log('\\nCommands:', colors.yellow);
        log('  functions   - Test telemetry functions availability', colors.blue);
        log('  upload      - Test file upload telemetry', colors.blue);
        log('  parsing     - Test CSV parsing telemetry', colors.blue);
        log('  chat        - Test chat interaction telemetry', colors.blue);
        log('  analysis    - Test CSV data analysis telemetry', colors.blue);
        log('  operations  - Test file operations telemetry', colors.blue);
        log('  business    - Test business metrics telemetry', colors.blue);
        log('  performance - Test telemetry performance', colors.blue);
        log('  all         - Run all tests (default)', colors.blue);
        log('  help        - Display this help', colors.blue);
        break;
      case 'all':
      default:
        await testTelemetryFunctions();
        await testFileUploadTelemetry();
        await testCSVParsingTelemetry();
        await testChatInteractionTelemetry();
        await testCSVAnalysisTelemetry();
        await testFileOperationsTelemetry();
        await testBusinessMetricsTelemetry();
        await testTelemetryPerformance();
        
        const report = generateTestReport();
        
        log('\\n📖 Next Steps:', colors.cyan);
        if (report.success) {
          log('1. CSV telemetry is ready for production monitoring', colors.blue);
          log('2. Configure Application Insights dashboards for CSV metrics', colors.blue);
          log('3. Set up alerts for CSV processing performance and errors', colors.blue);
          log('4. Deploy and monitor CSV telemetry data in Azure Portal', colors.blue);
        } else {
          log('1. Fix the telemetry issues identified in the test report', colors.red);
          log('2. Verify Application Insights configuration and connectivity', colors.blue);
          log('3. Check telemetry function implementations', colors.blue);
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
  testTelemetryFunctions,
  testFileUploadTelemetry,
  testCSVParsingTelemetry,
  testChatInteractionTelemetry,
  testCSVAnalysisTelemetry,
  testFileOperationsTelemetry,
  testBusinessMetricsTelemetry,
  testTelemetryPerformance,
  generateTestReport
};
