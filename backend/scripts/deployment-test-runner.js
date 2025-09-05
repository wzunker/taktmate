#!/usr/bin/env node

// Deployment and Rollback Testing Runner
// Comprehensive testing of deployment pipelines and rollback procedures

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Deployment and Rollback Test Runner');
console.log('=====================================');

// Deployment test categories
const deploymentTestCategories = [
  {
    name: 'Deployment Validation',
    script: 'npm test -- --testPathPattern=deployment/deploymentValidation.test.js',
    description: 'Tests deployment process, environment validation, and service health',
    critical: true,
    estimatedTime: '45s'
  },
  {
    name: 'Rollback Validation',
    script: 'npm test -- --testPathPattern=deployment/rollbackValidation.test.js',
    description: 'Tests rollback procedures, data integrity, and service recovery',
    critical: true,
    estimatedTime: '50s'
  }
];

// Deployment phases
const deploymentPhases = [
  'Pre-deployment Validation',
  'Application Health Checks',
  'Performance Validation',
  'Configuration Validation',
  'Deployment Readiness'
];

const rollbackPhases = [
  'Rollback Prerequisites',
  'Application Rollback Testing',
  'Database Rollback Testing',
  'Service Recovery Testing',
  'Rollback Validation and Verification'
];

// Results tracking
const results = {
  passed: 0,
  failed: 0,
  categories: {},
  phases: {},
  startTime: Date.now(),
  errors: [],
  warnings: [],
  criticalIssues: []
};

function logTest(category, status, message = '') {
  const statusIcon = {
    'PASS': '✅',
    'FAIL': '❌',
    'RUN': '🔄',
    'WARN': '⚠️',
    'CRITICAL': '🚨'
  }[status] || '❓';
  
  console.log(`${statusIcon} ${category}: ${message}`);
}

function runCommand(command, options = {}) {
  try {
    const output = execSync(command, {
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      timeout: 120000, // 2 minutes for deployment tests
      cwd: __dirname,
      ...options
    });
    return { success: true, output };
  } catch (error) {
    return { 
      success: false, 
      error: error.message,
      output: error.stdout || error.stderr || ''
    };
  }
}

function checkDeploymentPrerequisites() {
  console.log('\n🎯 Deployment Test Prerequisites Check');
  console.log('─'.repeat(50));
  
  const checks = [
    {
      name: 'Deployment Test Files',
      command: 'ls __tests__/deployment/*.test.js | wc -l',
      validator: (output) => parseInt(output.trim()) >= 2
    },
    {
      name: 'Application Structure',
      command: 'ls ../index.js ../package.json',
      validator: (output) => !output.includes('No such file')
    },
    {
      name: 'Configuration Files',
      command: 'ls ../config/*.js | wc -l',
      validator: (output) => parseInt(output.trim()) >= 1
    },
    {
      name: 'Service Files',
      command: 'ls ../services/*.js | wc -l',
      validator: (output) => parseInt(output.trim()) >= 3
    }
  ];
  
  let allPassed = true;
  
  checks.forEach(check => {
    const result = runCommand(check.command, { silent: true });
    const passed = result.success && check.validator(result.output || '');
    
    logTest(check.name, passed ? 'PASS' : 'FAIL', 
      passed ? 'OK' : 'Failed validation');
    
    if (!passed) {
      allPassed = false;
      results.errors.push(`Deployment prerequisite failed: ${check.name}`);
    }
  });
  
  return allPassed;
}

function runDeploymentTests() {
  console.log('\n🎯 Deployment and Rollback Testing');
  console.log('─'.repeat(50));
  
  for (const category of deploymentTestCategories) {
    logTest(category.name, 'RUN', `Starting tests... (${category.estimatedTime})`);
    
    const startTime = Date.now();
    const result = runCommand(category.script);
    const duration = Date.now() - startTime;
    
    results.categories[category.name] = {
      passed: result.success,
      duration,
      critical: category.critical,
      output: result.output || result.error || ''
    };
    
    if (result.success) {
      results.passed++;
      logTest(category.name, 'PASS', `Completed in ${duration}ms`);
      
      // Extract test results from Jest output
      const testOutput = result.output || '';
      const passedTests = (testOutput.match(/✓/g) || []).length;
      const failedTests = (testOutput.match(/✕/g) || []).length;
      
      if (passedTests > 0) {
        logTest(category.name, 'PASS', 
          `${passedTests} tests passed`, 
          failedTests > 0 ? `${failedTests} tests failed` : '');
      }
      
      // Analyze test phases
      if (category.name === 'Deployment Validation') {
        deploymentPhases.forEach(phase => {
          if (testOutput.toLowerCase().includes(phase.toLowerCase())) {
            results.phases[phase] = { status: 'completed', category: category.name };
          }
        });
      } else if (category.name === 'Rollback Validation') {
        rollbackPhases.forEach(phase => {
          if (testOutput.toLowerCase().includes(phase.toLowerCase())) {
            results.phases[phase] = { status: 'completed', category: category.name };
          }
        });
      }
      
    } else {
      results.failed++;
      const status = category.critical ? 'CRITICAL' : 'FAIL';
      logTest(category.name, status, `Failed after ${duration}ms`);
      
      if (category.critical) {
        results.criticalIssues.push(`Critical deployment test failed: ${category.name}`);
      }
      
      // Extract error details
      if (result.output && result.output.includes('FAIL')) {
        const failedTests = result.output
          .split('\n')
          .filter(line => line.includes('✕') || line.includes('FAIL'))
          .slice(0, 3);
          
        failedTests.forEach(test => {
          console.log(`   ${test.trim()}`);
        });
      }
    }
  }
}

function analyzeDeploymentReadiness() {
  console.log('\n🎯 Deployment Readiness Analysis');
  console.log('─'.repeat(50));
  
  const readinessChecklist = {
    'Environment Validation': results.phases['Pre-deployment Validation']?.status === 'completed',
    'Health Checks': results.phases['Application Health Checks']?.status === 'completed',
    'Performance Validation': results.phases['Performance Validation']?.status === 'completed',
    'Configuration Validation': results.phases['Configuration Validation']?.status === 'completed',
    'Deployment Artifacts': results.phases['Deployment Readiness']?.status === 'completed'
  };
  
  console.log(`Deployment Readiness Checklist:`);
  Object.entries(readinessChecklist).forEach(([item, ready]) => {
    logTest(item, ready ? 'PASS' : 'WARN', ready ? 'Validated' : 'Not validated');
  });
  
  const readyItems = Object.values(readinessChecklist).filter(Boolean).length;
  const totalItems = Object.keys(readinessChecklist).length;
  const readinessPercentage = (readyItems / totalItems) * 100;
  
  console.log(`\nOverall Deployment Readiness: ${readinessPercentage.toFixed(1)}% (${readyItems}/${totalItems})`);
  
  if (readinessPercentage < 80) {
    results.warnings.push(`Low deployment readiness: ${readinessPercentage.toFixed(1)}%`);
  }
  
  return readinessPercentage;
}

function analyzeRollbackCapability() {
  console.log('\n🎯 Rollback Capability Analysis');
  console.log('─'.repeat(50));
  
  const rollbackCapabilities = {
    'Rollback Prerequisites': results.phases['Rollback Prerequisites']?.status === 'completed',
    'Application Rollback': results.phases['Application Rollback Testing']?.status === 'completed',
    'Database Rollback': results.phases['Database Rollback Testing']?.status === 'completed',
    'Service Recovery': results.phases['Service Recovery Testing']?.status === 'completed',
    'Rollback Validation': results.phases['Rollback Validation and Verification']?.status === 'completed'
  };
  
  console.log(`Rollback Capabilities:`);
  Object.entries(rollbackCapabilities).forEach(([capability, available]) => {
    logTest(capability, available ? 'PASS' : 'WARN', available ? 'Available' : 'Not validated');
  });
  
  const availableCapabilities = Object.values(rollbackCapabilities).filter(Boolean).length;
  const totalCapabilities = Object.keys(rollbackCapabilities).length;
  const rollbackReadiness = (availableCapabilities / totalCapabilities) * 100;
  
  console.log(`\nOverall Rollback Readiness: ${rollbackReadiness.toFixed(1)}% (${availableCapabilities}/${totalCapabilities})`);
  
  if (rollbackReadiness < 80) {
    results.warnings.push(`Low rollback readiness: ${rollbackReadiness.toFixed(1)}%`);
  }
  
  return rollbackReadiness;
}

function generateDeploymentReport() {
  console.log('\n🎯 Deployment Testing Results Summary');
  console.log('─'.repeat(50));
  
  const totalDuration = Date.now() - results.startTime;
  const totalTests = results.passed + results.failed;
  const successRate = totalTests > 0 ? Math.round(((results.passed / totalTests) * 100)) : 0;
  
  console.log(`🚀 Deployment Test Summary:`);
  console.log(`   Total Categories: ${totalTests}`);
  console.log(`   Passed: ${results.passed} ✅`);
  console.log(`   Failed: ${results.failed} ❌`);
  console.log(`   Duration: ${totalDuration}ms`);
  console.log(`   Success Rate: ${successRate}%`);
  
  // Category breakdown
  console.log(`\n📊 Test Category Results:`);
  Object.entries(results.categories).forEach(([name, data]) => {
    const status = data.passed ? '✅ PASS' : '❌ FAIL';
    const critical = data.critical ? ' (Critical)' : '';
    console.log(`   ${name}: ${status}${critical} - ${data.duration}ms`);
  });
  
  // Phase completion status
  console.log(`\n🔄 Test Phase Completion:`);
  const allPhases = [...deploymentPhases, ...rollbackPhases];
  allPhases.forEach(phase => {
    const completed = results.phases[phase]?.status === 'completed';
    console.log(`   ${phase}: ${completed ? '✅' : '⏭️'}`);
  });
  
  // Readiness analysis
  const deploymentReadiness = analyzeDeploymentReadiness();
  const rollbackReadiness = analyzeRollbackCapability();
  
  // Critical issues
  if (results.criticalIssues.length > 0) {
    console.log(`\n🚨 Critical Issues:`);
    results.criticalIssues.forEach((issue, index) => {
      console.log(`   ${index + 1}. ${issue}`);
    });
  }
  
  // Errors and warnings
  if (results.errors.length > 0) {
    console.log(`\n❌ Errors:`);
    results.errors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error}`);
    });
  }
  
  if (results.warnings.length > 0) {
    console.log(`\n⚠️  Warnings:`);
    results.warnings.forEach((warning, index) => {
      console.log(`   ${index + 1}. ${warning}`);
    });
  }
  
  // Deployment recommendations
  console.log(`\n💡 Deployment Recommendations:`);
  if (results.criticalIssues.length > 0) {
    console.log(`   • 🚨 URGENT: Fix ${results.criticalIssues.length} critical deployment issue(s)`);
    console.log(`   • Do not deploy to production until issues are resolved`);
    console.log(`   • Review deployment pipeline configuration`);
  } else if (successRate >= 95 && deploymentReadiness >= 90 && rollbackReadiness >= 90) {
    console.log(`   • 🎉 Excellent deployment and rollback readiness!`);
    console.log(`   • System is ready for production deployment`);
    console.log(`   • Rollback procedures are fully validated`);
    console.log(`   • Consider automated deployment pipeline`);
  } else if (successRate >= 80) {
    console.log(`   • Good deployment foundation established`);
    console.log(`   • Address remaining validation issues before production`);
    console.log(`   • Test rollback procedures in staging environment`);
    console.log(`   • Implement comprehensive monitoring during deployment`);
  } else {
    console.log(`   • Significant deployment improvements needed`);
    console.log(`   • Review deployment pipeline and procedures`);
    console.log(`   • Implement proper health checks and validation`);
    console.log(`   • Establish comprehensive rollback procedures`);
  }
  
  // Save detailed report
  const reportPath = path.join(__dirname, '..', 'test-results', 'deployment-test-report.json');
  const reportDir = path.dirname(reportPath);
  
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  
  const detailedReport = {
    timestamp: new Date().toISOString(),
    summary: {
      total: totalTests,
      passed: results.passed,
      failed: results.failed,
      duration: totalDuration,
      successRate: successRate
    },
    categories: results.categories,
    phases: results.phases,
    readiness: {
      deployment: deploymentReadiness,
      rollback: rollbackReadiness
    },
    criticalIssues: results.criticalIssues,
    errors: results.errors,
    warnings: results.warnings,
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      testFramework: 'Jest + Supertest'
    },
    recommendations: generateDeploymentRecommendations(successRate, deploymentReadiness, rollbackReadiness)
  };
  
  fs.writeFileSync(reportPath, JSON.stringify(detailedReport, null, 2));
  console.log(`\n📄 Detailed deployment test report saved to: ${reportPath}`);
}

function generateDeploymentRecommendations(successRate, deploymentReadiness, rollbackReadiness) {
  const recommendations = [];
  
  if (successRate < 80) {
    recommendations.push('Fix failing deployment validation tests');
    recommendations.push('Review application configuration and dependencies');
    recommendations.push('Implement proper error handling and logging');
  }
  
  if (deploymentReadiness < 90) {
    recommendations.push('Complete deployment readiness checklist');
    recommendations.push('Validate all environment configurations');
    recommendations.push('Implement comprehensive health checks');
  }
  
  if (rollbackReadiness < 90) {
    recommendations.push('Establish rollback procedures and testing');
    recommendations.push('Implement database backup and recovery strategies');
    recommendations.push('Test service recovery procedures');
  }
  
  recommendations.push('Implement automated deployment pipeline');
  recommendations.push('Establish monitoring and alerting for deployments');
  recommendations.push('Regular deployment and rollback testing');
  recommendations.push('Document deployment procedures and runbooks');
  
  return recommendations;
}

function main() {
  try {
    console.log(`🚀 Starting Deployment and Rollback Testing at ${new Date().toISOString()}`);
    
    // Check prerequisites
    if (!checkDeploymentPrerequisites()) {
      console.log('\n❌ Deployment test prerequisites check failed. Please fix issues before running tests.');
      process.exit(1);
    }
    
    // Run deployment tests
    runDeploymentTests();
    
    // Generate report
    generateDeploymentReport();
    
    // Exit with appropriate code
    const hasFailures = results.failed > 0;
    const hasCriticalIssues = results.criticalIssues.length > 0;
    
    if (hasCriticalIssues) {
      console.log('\n🚨 Critical deployment issues detected. Do not deploy to production.');
      process.exit(1);
    } else if (hasFailures) {
      console.log('\n⚠️  Some deployment tests failed. Review and address issues before deployment.');
      process.exit(1);
    } else {
      console.log('\n✅ All deployment and rollback tests passed! System ready for deployment.');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('\n💥 Unexpected error during deployment testing:');
    console.error(error.message);
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', () => {
  console.log('\n\n⏹️  Deployment testing interrupted by user');
  process.exit(130);
});

process.on('SIGTERM', () => {
  console.log('\n\n⏹️  Deployment testing terminated');
  process.exit(143);
});

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  runDeploymentTests,
  checkDeploymentPrerequisites,
  analyzeDeploymentReadiness,
  analyzeRollbackCapability,
  generateDeploymentReport,
  results
};
