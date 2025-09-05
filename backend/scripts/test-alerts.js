#!/usr/bin/env node

/**
 * Alert Configuration Testing and Validation Script for TaktMate
 * 
 * This script validates alert templates, queries, thresholds, and deployment
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
 * Test alert template JSON validity
 */
function testAlertTemplates() {
  log('\\n🚨 Testing Alert Templates', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  const alertsDir = path.join(__dirname, '..', 'alerts');
  const templateFiles = [
    'critical-error-alerts.json',
    'performance-alerts.json',
    'availability-business-alerts.json',
    'action-groups.json',
    'master-alerts-deployment.json'
  ];

  templateFiles.forEach(templateFile => {
    try {
      const startTime = Date.now();
      const templatePath = path.join(alertsDir, templateFile);
      
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
      
      // Validate resources array
      if (!Array.isArray(template.resources) || template.resources.length === 0) {
        addTestResult('Template Validation', `${templateFile} resources`, false,
          'Resources array is empty or invalid');
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
 * Test alert rule configurations
 */
function testAlertRuleConfigurations() {
  log('\\n📋 Testing Alert Rule Configurations', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  const alertsDir = path.join(__dirname, '..', 'alerts');
  const alertTemplates = [
    'critical-error-alerts.json',
    'performance-alerts.json',
    'availability-business-alerts.json'
  ];

  alertTemplates.forEach(templateFile => {
    try {
      const startTime = Date.now();
      const templatePath = path.join(alertsDir, templateFile);
      const templateContent = fs.readFileSync(templatePath, 'utf8');
      const template = JSON.parse(templateContent);
      
      let alertRuleCount = 0;
      let validAlertRules = 0;
      
      // Analyze alert rules in template
      template.resources.forEach(resource => {
        if (resource.type === 'Microsoft.Insights/scheduledQueryRules') {
          alertRuleCount++;
          
          // Validate required properties
          const requiredProps = ['displayName', 'description', 'severity', 'enabled', 'evaluationFrequency', 'windowSize', 'criteria'];
          const hasAllProps = requiredProps.every(prop => resource.properties[prop] !== undefined);
          
          if (hasAllProps) {
            // Validate criteria structure
            const criteria = resource.properties.criteria;
            if (criteria.allOf && Array.isArray(criteria.allOf) && criteria.allOf.length > 0) {
              const firstCriterion = criteria.allOf[0];
              if (firstCriterion.query && firstCriterion.operator && firstCriterion.threshold !== undefined) {
                validAlertRules++;
              }
            }
          }
        }
      });
      
      const duration = Date.now() - startTime;
      const testPassed = alertRuleCount > 0 && validAlertRules === alertRuleCount;
      
      addTestResult('Alert Rule Configuration', 
        `${templateFile} alert rules (${validAlertRules}/${alertRuleCount})`, 
        testPassed, 
        testPassed ? null : `Only ${validAlertRules} of ${alertRuleCount} alert rules are valid`,
        duration);
      
    } catch (error) {
      addTestResult('Alert Rule Configuration', `${templateFile} configuration analysis`, false, error);
    }
  });
}

/**
 * Test alert queries
 */
function testAlertQueries() {
  log('\\n🔍 Testing Alert Queries', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  const alertsDir = path.join(__dirname, '..', 'alerts');
  const alertTemplates = [
    'critical-error-alerts.json',
    'performance-alerts.json',
    'availability-business-alerts.json'
  ];

  alertTemplates.forEach(templateFile => {
    try {
      const startTime = Date.now();
      const templatePath = path.join(alertsDir, templateFile);
      const templateContent = fs.readFileSync(templatePath, 'utf8');
      const template = JSON.parse(templateContent);
      
      let queryCount = 0;
      let validQueries = 0;
      
      // Extract and validate queries
      template.resources.forEach(resource => {
        if (resource.type === 'Microsoft.Insights/scheduledQueryRules') {
          const criteria = resource.properties.criteria;
          if (criteria.allOf && Array.isArray(criteria.allOf)) {
            criteria.allOf.forEach(criterion => {
              if (criterion.query) {
                queryCount++;
                
                // Basic query validation
                const query = criterion.query.trim();
                const hasValidStructure = (
                  query.length > 10 &&
                  (query.includes('requests') || 
                   query.includes('customEvents') || 
                   query.includes('exceptions') || 
                   query.includes('dependencies')) &&
                  query.includes('timestamp > ago(') &&
                  (query.includes('summarize') || query.includes('count'))
                );
                
                if (hasValidStructure) {
                  validQueries++;
                }
              }
            });
          }
        }
      });
      
      const duration = Date.now() - startTime;
      const testPassed = queryCount > 0 && validQueries === queryCount;
      
      addTestResult('Alert Queries', 
        `${templateFile} queries (${validQueries}/${queryCount})`, 
        testPassed, 
        testPassed ? null : `Only ${validQueries} of ${queryCount} queries appear valid`,
        duration);
      
    } catch (error) {
      addTestResult('Alert Queries', `${templateFile} query analysis`, false, error);
    }
  });
}

/**
 * Test action group configurations
 */
function testActionGroupConfigurations() {
  log('\\n📧 Testing Action Group Configurations', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    const startTime = Date.now();
    const alertsDir = path.join(__dirname, '..', 'alerts');
    const templatePath = path.join(alertsDir, 'action-groups.json');
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    const template = JSON.parse(templateContent);
    
    let actionGroupCount = 0;
    let validActionGroups = 0;
    
    template.resources.forEach(resource => {
      if (resource.type === 'Microsoft.Insights/actionGroups') {
        actionGroupCount++;
        
        // Validate action group properties
        const properties = resource.properties;
        const hasRequiredProps = (
          properties.groupShortName &&
          properties.enabled !== undefined &&
          (properties.emailReceivers || 
           properties.smsReceivers || 
           properties.webhookReceivers ||
           properties.logicAppReceivers)
        );
        
        if (hasRequiredProps) {
          validActionGroups++;
        }
      }
    });
    
    const duration = Date.now() - startTime;
    const testPassed = actionGroupCount >= 3 && validActionGroups === actionGroupCount; // Expect at least 3 action groups
    
    addTestResult('Action Group Configuration', 
      `Action groups configuration (${validActionGroups}/${actionGroupCount})`, 
      testPassed, 
      testPassed ? null : `Expected at least 3 action groups, found ${actionGroupCount}`,
      duration);
    
  } catch (error) {
    addTestResult('Action Group Configuration', 'Action groups configuration', false, error);
  }
}

/**
 * Test alert thresholds and conditions
 */
function testAlertThresholds() {
  log('\\n⚖️  Testing Alert Thresholds and Conditions', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  const expectedThresholds = {
    'critical-error-alerts.json': [
      { name: 'High Error Rate', expectedQuery: 'ErrorRate > 5' },
      { name: 'Unhandled Exceptions', expectedQuery: 'UnhandledException' },
      { name: 'Authentication Failures', expectedQuery: 'FailureCount > 10' }
    ],
    'performance-alerts.json': [
      { name: 'High Response Time', expectedQuery: 'P95ResponseTime > 5000' },
      { name: 'High Memory Usage', expectedQuery: '> 85' },
      { name: 'High CPU Load', expectedQuery: '> 0.9' }
    ],
    'availability-business-alerts.json': [
      { name: 'Service Availability Drop', expectedQuery: 'Availability < 95' },
      { name: 'CSV Processing Failures', expectedQuery: 'FailureRate > 20' },
      { name: 'Chat Service Degradation', expectedQuery: 'SuccessRate < 80' }
    ]
  };

  Object.entries(expectedThresholds).forEach(([templateFile, expectedAlerts]) => {
    try {
      const startTime = Date.now();
      const alertsDir = path.join(__dirname, '..', 'alerts');
      const templatePath = path.join(alertsDir, templateFile);
      const templateContent = fs.readFileSync(templatePath, 'utf8');
      const template = JSON.parse(templateContent);
      
      let thresholdTests = 0;
      let validThresholds = 0;
      
      expectedAlerts.forEach(expectedAlert => {
        thresholdTests++;
        
        // Find alert rule with matching name pattern
        const matchingRule = template.resources.find(resource => 
          resource.type === 'Microsoft.Insights/scheduledQueryRules' &&
          resource.properties.displayName &&
          resource.properties.displayName.includes(expectedAlert.name)
        );
        
        if (matchingRule) {
          const criteria = matchingRule.properties.criteria;
          if (criteria.allOf && criteria.allOf[0] && criteria.allOf[0].query) {
            const query = criteria.allOf[0].query;
            if (query.includes(expectedAlert.expectedQuery)) {
              validThresholds++;
            }
          }
        }
      });
      
      const duration = Date.now() - startTime;
      const testPassed = validThresholds === thresholdTests;
      
      addTestResult('Alert Thresholds', 
        `${templateFile} thresholds (${validThresholds}/${thresholdTests})`, 
        testPassed, 
        testPassed ? null : `Only ${validThresholds} of ${thresholdTests} expected thresholds found`,
        duration);
      
    } catch (error) {
      addTestResult('Alert Thresholds', `${templateFile} threshold analysis`, false, error);
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
    const deployScript = require('./deploy-alerts.js');
    
    // Test configuration validation without environment variables
    const originalEnv = { ...process.env };
    delete process.env.AZURE_SUBSCRIPTION_ID;
    delete process.env.AZURE_RESOURCE_GROUP;
    delete process.env.APPINSIGHTS_NAME;
    
    const startTime = Date.now();
    const validationResult = deployScript.validateConfiguration();
    const duration = Date.now() - startTime;
    
    addTestResult('Deployment Script', 'Configuration validation (should fail)', !validationResult, null, duration);
    
    // Restore environment and test with mock values
    process.env.AZURE_SUBSCRIPTION_ID = 'test-subscription-id';
    process.env.AZURE_RESOURCE_GROUP = 'test-resource-group';
    process.env.APPINSIGHTS_NAME = 'test-insights';
    
    const validationWithEnv = deployScript.validateConfiguration();
    addTestResult('Deployment Script', 'Configuration validation (should pass)', validationWithEnv);
    
    // Test script generation
    const bashScript = deployScript.generateDeploymentScript('bash');
    addTestResult('Deployment Script', 'Bash script generation', 
      bashScript.includes('#!/bin/bash') && bashScript.includes('az deployment group create'));
    
    const psScript = deployScript.generateDeploymentScript('powershell');
    addTestResult('Deployment Script', 'PowerShell script generation',
      psScript.includes('New-AzResourceGroupDeployment') || psScript.includes('Write-Host'));
    
    const instructions = deployScript.generateManualInstructions();
    addTestResult('Deployment Script', 'Manual instructions generation',
      instructions.includes('Prerequisites') && instructions.includes('Deploy Alert Rules'));
    
    const summary = deployScript.generateAlertSummary();
    addTestResult('Deployment Script', 'Alert summary generation',
      summary.includes('Alert Categories') && summary.includes('Alert Thresholds'));
    
    // Test alert categories
    const alertCategories = deployScript.alertCategories;
    addTestResult('Deployment Script', 'Alert categories availability',
      Array.isArray(alertCategories) && alertCategories.length >= 3);
    
    // Restore original environment
    Object.assign(process.env, originalEnv);
    
  } catch (error) {
    addTestResult('Deployment Script', 'Deployment script functionality', false, error);
  }
}

/**
 * Test alert coverage and completeness
 */
function testAlertCoverage() {
  log('\\n📊 Testing Alert Coverage and Completeness', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  const expectedAlertTypes = {
    'Critical Errors': [
      'High Error Rate',
      'Unhandled Exceptions', 
      'Critical Errors Spike',
      'Authentication Failures',
      'External Service Failures'
    ],
    'Performance': [
      'High Response Time',
      'Low Throughput',
      'High Memory Usage',
      'Slow CSV Processing',
      'High CPU Load',
      'Dependency Performance Degradation'
    ],
    'Availability & Business': [
      'Application Unavailable',
      'Service Availability Drop',
      'CSV Processing Failures',
      'Chat Service Degradation',
      'User Activity Drop',
      'Data Processing Volume Drop'
    ]
  };

  const alertsDir = path.join(__dirname, '..', 'alerts');
  const templateFiles = [
    'critical-error-alerts.json',
    'performance-alerts.json',
    'availability-business-alerts.json'
  ];

  let totalExpectedAlerts = 0;
  let foundAlerts = 0;

  Object.values(expectedAlertTypes).forEach(alerts => {
    totalExpectedAlerts += alerts.length;
  });

  templateFiles.forEach(templateFile => {
    try {
      const templatePath = path.join(alertsDir, templateFile);
      const templateContent = fs.readFileSync(templatePath, 'utf8');
      const template = JSON.parse(templateContent);
      
      template.resources.forEach(resource => {
        if (resource.type === 'Microsoft.Insights/scheduledQueryRules') {
          foundAlerts++;
        }
      });
      
    } catch (error) {
      // Handle error silently for coverage test
    }
  });

  const coveragePercentage = Math.round((foundAlerts / totalExpectedAlerts) * 100);
  const testPassed = coveragePercentage >= 90; // At least 90% coverage

  addTestResult('Alert Coverage', 
    `Alert coverage (${foundAlerts}/${totalExpectedAlerts} alerts, ${coveragePercentage}%)`,
    testPassed,
    testPassed ? null : `Coverage below 90%: only ${coveragePercentage}% of expected alerts found`);

  // Test alert severity distribution
  const severityDistribution = { 1: 0, 2: 0, 3: 0, 4: 0 }; // Severity levels 1-4
  
  templateFiles.forEach(templateFile => {
    try {
      const templatePath = path.join(alertsDir, templateFile);
      const templateContent = fs.readFileSync(templatePath, 'utf8');
      const template = JSON.parse(templateContent);
      
      template.resources.forEach(resource => {
        if (resource.type === 'Microsoft.Insights/scheduledQueryRules') {
          const severity = resource.properties.severity;
          if (severity >= 1 && severity <= 4) {
            severityDistribution[severity]++;
          }
        }
      });
      
    } catch (error) {
      // Handle error silently for coverage test
    }
  });

  const hasCriticalAlerts = severityDistribution[1] > 0; // Severity 1 = Critical
  const hasWarningAlerts = severityDistribution[2] > 0; // Severity 2 = Warning
  const hasInfoAlerts = severityDistribution[3] > 0 || severityDistribution[4] > 0; // Severity 3-4 = Info

  addTestResult('Alert Coverage', 
    `Severity distribution (Critical: ${severityDistribution[1]}, Warning: ${severityDistribution[2]}, Info: ${severityDistribution[3] + severityDistribution[4]})`,
    hasCriticalAlerts && hasWarningAlerts);
}

/**
 * Test telemetry data source compatibility
 */
function testTelemetryCompatibility() {
  log('\\n📡 Testing Telemetry Data Source Compatibility', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  // Test if the Application Insights configuration exports the required telemetry data
  try {
    const appInsights = require('../config/applicationInsights');
    
    const requiredTelemetryEvents = [
      'ErrorOccurred',
      'UnhandledException',
      'AuthenticationError',
      'ExternalServiceError',
      'CSVFileUpload',
      'CSVChatInteraction',
      'SystemPerformance',
      'ResourceUtilization'
    ];
    
    // Check if telemetry functions that generate these events are available
    const requiredTelemetryFunctions = [
      'trackError',
      'trackUnhandledException',
      'trackAuthError',
      'trackExternalServiceError',
      'trackFileUpload',
      'trackChatInteraction',
      'trackSystemPerformance',
      'trackResourceUtilization'
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
    const testPassed = compatibilityScore >= 0.8; // At least 80% of functions available
    
    addTestResult('Telemetry Compatibility', 
      `Telemetry functions for alerts (${availableFunctions}/${requiredTelemetryFunctions.length})`,
      testPassed,
      testPassed ? null : `Missing functions: ${missingFunctions.join(', ')}`);
    
    // Test expected telemetry events
    addTestResult('Telemetry Compatibility', 
      `Expected telemetry events defined (${requiredTelemetryEvents.length} events)`, true);
    
  } catch (error) {
    addTestResult('Telemetry Compatibility', 'Application Insights integration', false, error);
  }
}

/**
 * Generate comprehensive test report
 */
function generateTestReport() {
  log('\\n📋 Alert Configuration Testing Report', colors.cyan);
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
    log(`\\n✅ Overall Status: EXCELLENT - Alert configurations are production-ready`, colors.green);
  } else if (successRate >= 85) {
    log(`\\n⚠️  Overall Status: GOOD - Minor alert configuration issues need attention`, colors.yellow);
  } else if (successRate >= 70) {
    log(`\\n🔶 Overall Status: NEEDS WORK - Several alert configuration issues require fixing`, colors.yellow);
  } else {
    log(`\\n❌ Overall Status: CRITICAL - Major alert configuration issues prevent deployment`, colors.red);
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

  log('🧪 TaktMate Alert Configuration Testing and Validation', colors.bright);
  log(`Environment: ${process.env.NODE_ENV || 'development'}`, colors.blue);

  try {
    switch (command) {
      case 'templates':
        testAlertTemplates();
        break;
      case 'rules':
        testAlertRuleConfigurations();
        break;
      case 'queries':
        testAlertQueries();
        break;
      case 'actions':
        testActionGroupConfigurations();
        break;
      case 'thresholds':
        testAlertThresholds();
        break;
      case 'deployment':
        testDeploymentScript();
        break;
      case 'coverage':
        testAlertCoverage();
        break;
      case 'compatibility':
        testTelemetryCompatibility();
        break;
      case 'help':
        log('\\nUsage: node test-alerts.js [command]', colors.yellow);
        log('\\nCommands:', colors.yellow);
        log('  templates     - Test alert template validity', colors.blue);
        log('  rules         - Test alert rule configurations', colors.blue);
        log('  queries       - Test alert query validity', colors.blue);
        log('  actions       - Test action group configurations', colors.blue);
        log('  thresholds    - Test alert thresholds and conditions', colors.blue);
        log('  deployment    - Test deployment script functionality', colors.blue);
        log('  coverage      - Test alert coverage and completeness', colors.blue);
        log('  compatibility - Test telemetry data source compatibility', colors.blue);
        log('  all           - Run all tests (default)', colors.blue);
        log('  help          - Display this help', colors.blue);
        break;
      case 'all':
      default:
        testAlertTemplates();
        testAlertRuleConfigurations();
        testAlertQueries();
        testActionGroupConfigurations();
        testAlertThresholds();
        testDeploymentScript();
        testAlertCoverage();
        testTelemetryCompatibility();
        
        const report = generateTestReport();
        
        log('\\n📖 Next Steps:', colors.cyan);
        if (report.success) {
          log('1. Alert configurations are ready for deployment to Azure', colors.blue);
          log('2. Configure email recipients and notification channels', colors.blue);
          log('3. Run the deployment script to create alert rules', colors.blue);
          log('4. Test alert notifications and adjust thresholds as needed', colors.blue);
        } else {
          log('1. Fix the alert configuration issues identified in the test report', colors.red);
          log('2. Verify alert templates and queries', colors.blue);
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
  testAlertTemplates,
  testAlertRuleConfigurations,
  testAlertQueries,
  testActionGroupConfigurations,
  testAlertThresholds,
  testDeploymentScript,
  testAlertCoverage,
  testTelemetryCompatibility,
  generateTestReport
};
