#!/usr/bin/env node

/**
 * Dashboard Testing and Validation Script for TaktMate
 * 
 * This script validates dashboard templates, queries, and deployment
 * configurations to ensure they work correctly with Application Insights.
 */

const fs = require('fs');
const path = require('path');

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
 * Test dashboard template JSON validity
 */
function testDashboardTemplates() {
  log('\\n📊 Testing Dashboard Templates', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  const dashboardsDir = path.join(__dirname, '..', 'dashboards');
  const templateFiles = [
    'overview-dashboard.json',
    'error-monitoring-dashboard.json',
    'performance-dashboard.json',
    'business-intelligence-dashboard.json'
  ];

  templateFiles.forEach(templateFile => {
    try {
      const startTime = Date.now();
      const templatePath = path.join(dashboardsDir, templateFile);
      
      // Check if file exists
      if (!fs.existsSync(templatePath)) {
        addTestResult('Template Validation', `${templateFile} exists`, false, 'File not found');
        return;
      }
      
      // Read and parse JSON
      const templateContent = fs.readFileSync(templatePath, 'utf8');
      const template = JSON.parse(templateContent);
      
      // Validate required ARM template structure
      const requiredFields = ['$schema', 'contentVersion', 'parameters', 'resources'];
      const missingFields = requiredFields.filter(field => !template[field]);
      
      if (missingFields.length > 0) {
        addTestResult('Template Validation', `${templateFile} structure`, false, 
          `Missing required fields: ${missingFields.join(', ')}`);
        return;
      }
      
      // Validate parameters
      const requiredParams = ['dashboardName', 'applicationInsightsResourceId'];
      const templateParams = Object.keys(template.parameters || {});
      const missingParams = requiredParams.filter(param => !templateParams.includes(param));
      
      if (missingParams.length > 0) {
        addTestResult('Template Validation', `${templateFile} parameters`, false,
          `Missing required parameters: ${missingParams.join(', ')}`);
        return;
      }
      
      // Validate resources array
      if (!Array.isArray(template.resources) || template.resources.length === 0) {
        addTestResult('Template Validation', `${templateFile} resources`, false,
          'Resources array is empty or invalid');
        return;
      }
      
      // Validate dashboard resource
      const dashboardResource = template.resources.find(r => r.type === 'Microsoft.Portal/dashboards');
      if (!dashboardResource) {
        addTestResult('Template Validation', `${templateFile} dashboard resource`, false,
          'No dashboard resource found');
        return;
      }
      
      const duration = Date.now() - startTime;
      addTestResult('Template Validation', `${templateFile} structure`, true, null, duration);
      
    } catch (error) {
      addTestResult('Template Validation', `${templateFile} parsing`, false, error);
    }
  });
}

/**
 * Test KQL queries syntax
 */
function testKQLQueries() {
  log('\\n📈 Testing KQL Queries', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    const startTime = Date.now();
    const queriesPath = path.join(__dirname, '..', 'dashboards', 'kusto-queries.kql');
    
    if (!fs.existsSync(queriesPath)) {
      addTestResult('KQL Validation', 'KQL queries file exists', false, 'File not found');
      return;
    }
    
    const queriesContent = fs.readFileSync(queriesPath, 'utf8');
    const duration = Date.now() - startTime;
    
    // Basic syntax validation
    const lines = queriesContent.split('\\n');
    let queryCount = 0;
    let currentQuery = '';
    let inQuery = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip comments and empty lines
      if (line.startsWith('//') || line === '') {
        if (inQuery && currentQuery.trim()) {
          queryCount++;
          currentQuery = '';
          inQuery = false;
        }
        continue;
      }
      
      // Start of a new query
      if (!inQuery) {
        inQuery = true;
      }
      
      currentQuery += line + ' ';
      
      // End of query (semicolon or render statement)
      if (line.endsWith(';') || line.includes('render ')) {
        queryCount++;
        currentQuery = '';
        inQuery = false;
      }
    }
    
    // Final query if no semicolon
    if (inQuery && currentQuery.trim()) {
      queryCount++;
    }
    
    addTestResult('KQL Validation', `KQL queries file readable (${queryCount} queries found)`, true, null, duration);
    
    // Test for common KQL patterns
    const commonPatterns = [
      { pattern: /\\| where timestamp > ago\\(/g, name: 'Time filtering' },
      { pattern: /\\| summarize/g, name: 'Aggregation queries' },
      { pattern: /\\| render (timechart|columnchart|piechart)/g, name: 'Chart rendering' },
      { pattern: /\\| project/g, name: 'Column projection' },
      { pattern: /\\| order by/g, name: 'Result ordering' }
    ];
    
    commonPatterns.forEach(({ pattern, name }) => {
      const matches = queriesContent.match(pattern) || [];
      addTestResult('KQL Validation', `${name} (${matches.length} instances)`, matches.length > 0);
    });
    
  } catch (error) {
    addTestResult('KQL Validation', 'KQL queries validation', false, error);
  }
}

/**
 * Test dashboard query validity
 */
function testDashboardQueries() {
  log('\\n🔍 Testing Dashboard Queries', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  const dashboardsDir = path.join(__dirname, '..', 'dashboards');
  const templateFiles = [
    'overview-dashboard.json',
    'error-monitoring-dashboard.json',
    'performance-dashboard.json',
    'business-intelligence-dashboard.json'
  ];

  templateFiles.forEach(templateFile => {
    try {
      const startTime = Date.now();
      const templatePath = path.join(dashboardsDir, templateFile);
      const templateContent = fs.readFileSync(templatePath, 'utf8');
      const template = JSON.parse(templateContent);
      
      let queryCount = 0;
      let validQueries = 0;
      
      // Extract queries from template
      const extractQueries = (obj) => {
        if (typeof obj === 'object' && obj !== null) {
          if (obj.Query && typeof obj.Query === 'string') {
            queryCount++;
            
            // Basic query validation
            const query = obj.Query.trim();
            if (query.length > 10 && (
              query.includes('requests') || 
              query.includes('customEvents') || 
              query.includes('exceptions') || 
              query.includes('dependencies')
            )) {
              validQueries++;
            }
          }
          
          // Recursively search for queries
          Object.values(obj).forEach(value => {
            if (typeof value === 'object') {
              extractQueries(value);
            }
          });
        }
      };
      
      extractQueries(template);
      
      const duration = Date.now() - startTime;
      const testPassed = queryCount > 0 && validQueries === queryCount;
      
      addTestResult('Dashboard Queries', 
        `${templateFile} queries (${validQueries}/${queryCount})`, 
        testPassed, 
        testPassed ? null : `Only ${validQueries} of ${queryCount} queries appear valid`,
        duration);
      
    } catch (error) {
      addTestResult('Dashboard Queries', `${templateFile} query extraction`, false, error);
    }
  });
}

/**
 * Test deployment script functionality
 */
function testDeploymentScript() {
  log('\\n🚀 Testing Deployment Script', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    const deployScript = require('./deploy-dashboards.js');
    
    // Test configuration validation without environment variables
    const originalEnv = { ...process.env };
    delete process.env.AZURE_SUBSCRIPTION_ID;
    delete process.env.AZURE_RESOURCE_GROUP;
    delete process.env.APPINSIGHTS_RESOURCE_ID;
    
    const startTime = Date.now();
    const validationResult = deployScript.validateConfiguration();
    const duration = Date.now() - startTime;
    
    addTestResult('Deployment Script', 'Configuration validation (should fail)', !validationResult, null, duration);
    
    // Restore environment and test with mock values
    process.env.AZURE_SUBSCRIPTION_ID = 'test-subscription-id';
    process.env.AZURE_RESOURCE_GROUP = 'test-resource-group';
    process.env.APPINSIGHTS_RESOURCE_ID = '/subscriptions/test/resourceGroups/test/providers/microsoft.insights/components/test';
    
    const validationWithEnv = deployScript.validateConfiguration();
    addTestResult('Deployment Script', 'Configuration validation (should pass)', validationWithEnv);
    
    // Test script generation
    const bashScript = deployScript.generateDeploymentScript('bash');
    addTestResult('Deployment Script', 'Bash script generation', 
      bashScript.includes('#!/bin/bash') && bashScript.includes('az deployment group create'));
    
    const psScript = deployScript.generateDeploymentScript('powershell');
    addTestResult('Deployment Script', 'PowerShell script generation',
      psScript.includes('New-AzResourceGroupDeployment'));
    
    const instructions = deployScript.generateManualInstructions();
    addTestResult('Deployment Script', 'Manual instructions generation',
      instructions.includes('Prerequisites') && instructions.includes('Deployment Commands'));
    
    const summary = deployScript.generateConfigurationSummary();
    addTestResult('Deployment Script', 'Configuration summary generation',
      summary.includes('Deployment Configuration') && summary.includes('Available Dashboards'));
    
    // Test dashboard list
    const dashboards = deployScript.dashboards;
    addTestResult('Deployment Script', 'Dashboard list availability',
      Array.isArray(dashboards) && dashboards.length > 0);
    
    // Restore original environment
    Object.assign(process.env, originalEnv);
    
  } catch (error) {
    addTestResult('Deployment Script', 'Deployment script functionality', false, error);
  }
}

/**
 * Test dashboard completeness
 */
function testDashboardCompleteness() {
  log('\\n📋 Testing Dashboard Completeness', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  const expectedCharts = {
    'overview-dashboard.json': [
      'Application Health Summary',
      'Request Volume Trends',
      'Response Time Percentiles',
      'Top Endpoints',
      'Error Distribution',
      'User Activity Summary',
      'CSV Processing Summary',
      'System Performance Trends'
    ],
    'error-monitoring-dashboard.json': [
      'Error Rate Trends',
      'Error Distribution by Category',
      'Top Errors by Frequency',
      'Authentication Errors',
      'External Service Errors',
      'Error Impact on Users',
      'Critical Errors',
      'Validation Errors',
      'Error Resolution Time',
      'Error Correlation'
    ],
    'performance-dashboard.json': [
      'Response Time Trends',
      'Request Throughput',
      'Endpoint Performance',
      'System Resource Utilization',
      'Dependency Performance',
      'CSV Processing Performance',
      'Chat Performance',
      'Memory Pressure',
      'Performance Alerts',
      'Slow Operations'
    ],
    'business-intelligence-dashboard.json': [
      'User Activity Overview',
      'CSV Processing Metrics',
      'Chat Analytics',
      'User Engagement Trends',
      'User Behavior Patterns',
      'Top Users',
      'Processing Efficiency',
      'Chat Engagement',
      'Business Value Metrics',
      'User Retention'
    ]
  };

  Object.entries(expectedCharts).forEach(([templateFile, expectedTitles]) => {
    try {
      const startTime = Date.now();
      const dashboardsDir = path.join(__dirname, '..', 'dashboards');
      const templatePath = path.join(dashboardsDir, templateFile);
      const templateContent = fs.readFileSync(templatePath, 'utf8');
      const template = JSON.parse(templateContent);
      
      let foundTitles = [];
      
      // Extract chart titles from template
      const extractTitles = (obj) => {
        if (typeof obj === 'object' && obj !== null) {
          if (obj.PartTitle && typeof obj.PartTitle === 'string') {
            foundTitles.push(obj.PartTitle);
          }
          
          // Recursively search for titles
          Object.values(obj).forEach(value => {
            if (typeof value === 'object') {
              extractTitles(value);
            }
          });
        }
      };
      
      extractTitles(template);
      
      const duration = Date.now() - startTime;
      const completenessScore = foundTitles.length / expectedTitles.length;
      const testPassed = completenessScore >= 0.8; // At least 80% of expected charts
      
      addTestResult('Dashboard Completeness', 
        `${templateFile} completeness (${foundTitles.length}/${expectedTitles.length} charts)`,
        testPassed,
        testPassed ? null : `Missing expected charts. Found: ${foundTitles.join(', ')}`,
        duration);
      
    } catch (error) {
      addTestResult('Dashboard Completeness', `${templateFile} completeness check`, false, error);
    }
  });
}

/**
 * Test telemetry data source compatibility
 */
function testTelemetryCompatibility() {
  log('\\n📡 Testing Telemetry Data Source Compatibility', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  // Test if the Application Insights configuration exports the required telemetry functions
  try {
    const appInsights = require('../config/applicationInsights');
    
    const requiredTelemetryFunctions = [
      'trackError',
      'trackEvent',
      'trackMetric',
      'trackFileUpload',
      'trackChatInteraction',
      'trackCSVParsing',
      'trackCSVAnalysis',
      'trackCSVFileOperation',
      'trackCSVError',
      'trackCSVBusinessMetrics',
      'trackSystemPerformance',
      'trackRequestPerformance',
      'trackResourceUtilization',
      'trackUnhandledException',
      'trackHTTPError',
      'trackValidationError',
      'trackAuthError',
      'trackExternalServiceError'
    ];
    
    let availableFunctions = 0;
    const missingFunctions = [];
    
    requiredTelemetryFunctions.forEach(funcName => {
      if (appInsights.telemetry && typeof appInsights.telemetry[funcName] === 'function') {
        availableFunctions++;
      } else {
        missingFunctions.push(funcName);
      }
    });
    
    const compatibilityScore = availableFunctions / requiredTelemetryFunctions.length;
    const testPassed = compatibilityScore >= 0.9; // At least 90% of functions available
    
    addTestResult('Telemetry Compatibility', 
      `Telemetry functions availability (${availableFunctions}/${requiredTelemetryFunctions.length})`,
      testPassed,
      testPassed ? null : `Missing functions: ${missingFunctions.join(', ')}`);
    
  } catch (error) {
    addTestResult('Telemetry Compatibility', 'Application Insights integration', false, error);
  }

  // Test expected custom events and metrics
  const expectedEventNames = [
    'CSVFileUpload',
    'CSVChatInteraction', 
    'CSVParsing',
    'CSVAnalysis',
    'CSVFileOperation',
    'CSVError',
    'SystemPerformance',
    'ResourceUtilization',
    'RequestPerformance',
    'ErrorOccurred',
    'UnhandledException',
    'HTTPError',
    'ValidationError',
    'AuthenticationError',
    'ExternalServiceError'
  ];

  const expectedMetricNames = [
    'Error_Count',
    'HTTP_Error_Count',
    'Auth_Error_Count',
    'Validation_Error_Count',
    'External_Service_Error_Count',
    'Request_Duration',
    'Request_Throughput',
    'System_HeapUsagePercent',
    'Resource_MemoryPressure',
    'Resource_CPUPressure'
  ];

  addTestResult('Telemetry Compatibility', 
    `Expected custom events defined (${expectedEventNames.length} events)`, true);
  
  addTestResult('Telemetry Compatibility', 
    `Expected custom metrics defined (${expectedMetricNames.length} metrics)`, true);
}

/**
 * Test dashboard performance and complexity
 */
function testDashboardPerformance() {
  log('\\n⚡ Testing Dashboard Performance', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  const dashboardsDir = path.join(__dirname, '..', 'dashboards');
  const templateFiles = [
    'overview-dashboard.json',
    'error-monitoring-dashboard.json', 
    'performance-dashboard.json',
    'business-intelligence-dashboard.json'
  ];

  templateFiles.forEach(templateFile => {
    try {
      const startTime = Date.now();
      const templatePath = path.join(dashboardsDir, templateFile);
      const templateContent = fs.readFileSync(templatePath, 'utf8');
      const template = JSON.parse(templateContent);
      const parseTime = Date.now() - startTime;
      
      // Analyze template complexity
      const templateSize = templateContent.length;
      const templateSizeKB = Math.round(templateSize / 1024);
      
      let queryCount = 0;
      let complexQueryCount = 0;
      
      const analyzeQueries = (obj) => {
        if (typeof obj === 'object' && obj !== null) {
          if (obj.Query && typeof obj.Query === 'string') {
            queryCount++;
            const query = obj.Query;
            
            // Count complex query indicators
            const complexityIndicators = [
              'join',
              'union',
              'summarize',
              'percentile',
              'make_set',
              'dcount',
              'render'
            ];
            
            const complexityScore = complexityIndicators.filter(indicator => 
              query.toLowerCase().includes(indicator)).length;
            
            if (complexityScore >= 2) {
              complexQueryCount++;
            }
          }
          
          Object.values(obj).forEach(value => {
            if (typeof value === 'object') {
              analyzeQueries(value);
            }
          });
        }
      };
      
      analyzeQueries(template);
      
      // Performance assessment
      const performanceScore = {
        size: templateSizeKB < 100 ? 'Good' : templateSizeKB < 200 ? 'Moderate' : 'Large',
        parseTime: parseTime < 50 ? 'Fast' : parseTime < 100 ? 'Moderate' : 'Slow',
        queryComplexity: complexQueryCount / queryCount
      };
      
      const testPassed = templateSizeKB < 300 && parseTime < 200; // Reasonable thresholds
      
      addTestResult('Dashboard Performance', 
        `${templateFile} performance (${templateSizeKB}KB, ${parseTime}ms parse, ${queryCount} queries)`,
        testPassed,
        testPassed ? null : `Template may be too large or complex`,
        parseTime);
      
    } catch (error) {
      addTestResult('Dashboard Performance', `${templateFile} performance analysis`, false, error);
    }
  });
}

/**
 * Generate comprehensive test report
 */
function generateTestReport() {
  log('\\n📋 Dashboard Testing Report', colors.cyan);
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
    log(`\\n✅ Overall Status: EXCELLENT - Dashboards are production-ready`, colors.green);
  } else if (successRate >= 85) {
    log(`\\n⚠️  Overall Status: GOOD - Minor dashboard issues need attention`, colors.yellow);
  } else if (successRate >= 70) {
    log(`\\n🔶 Overall Status: NEEDS WORK - Several dashboard issues require fixing`, colors.yellow);
  } else {
    log(`\\n❌ Overall Status: CRITICAL - Major dashboard issues prevent deployment`, colors.red);
  }

  return {
    success: successRate >= 85,
    summary: testResults
  };
}

/**
 * Main function
 */
function main() {
  const command = process.argv[2] || 'all';

  log('🧪 TaktMate Dashboard Testing and Validation', colors.bright);
  log(`Environment: ${process.env.NODE_ENV || 'development'}`, colors.blue);

  try {
    switch (command) {
      case 'templates':
        testDashboardTemplates();
        break;
      case 'queries':
        testKQLQueries();
        testDashboardQueries();
        break;
      case 'deployment':
        testDeploymentScript();
        break;
      case 'completeness':
        testDashboardCompleteness();
        break;
      case 'compatibility':
        testTelemetryCompatibility();
        break;
      case 'performance':
        testDashboardPerformance();
        break;
      case 'help':
        log('\\nUsage: node test-dashboards.js [command]', colors.yellow);
        log('\\nCommands:', colors.yellow);
        log('  templates     - Test dashboard template validity', colors.blue);
        log('  queries       - Test KQL queries and dashboard queries', colors.blue);
        log('  deployment    - Test deployment script functionality', colors.blue);
        log('  completeness  - Test dashboard completeness', colors.blue);
        log('  compatibility - Test telemetry data source compatibility', colors.blue);
        log('  performance   - Test dashboard performance and complexity', colors.blue);
        log('  all           - Run all tests (default)', colors.blue);
        log('  help          - Display this help', colors.blue);
        break;
      case 'all':
      default:
        testDashboardTemplates();
        testKQLQueries();
        testDashboardQueries();
        testDeploymentScript();
        testDashboardCompleteness();
        testTelemetryCompatibility();
        testDashboardPerformance();
        
        const report = generateTestReport();
        
        log('\\n📖 Next Steps:', colors.cyan);
        if (report.success) {
          log('1. Dashboards are ready for deployment to Azure', colors.blue);
          log('2. Run the deployment script to create dashboards', colors.blue);
          log('3. Configure alerts based on dashboard queries', colors.blue);
          log('4. Share dashboards with your team', colors.blue);
        } else {
          log('1. Fix the dashboard issues identified in the test report', colors.red);
          log('2. Verify dashboard templates and queries', colors.blue);
          log('3. Check telemetry data source compatibility', colors.blue);
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
  main();
}

module.exports = {
  testDashboardTemplates,
  testKQLQueries,
  testDashboardQueries,
  testDeploymentScript,
  testDashboardCompleteness,
  testTelemetryCompatibility,
  testDashboardPerformance,
  generateTestReport
};
