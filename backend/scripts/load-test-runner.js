#!/usr/bin/env node

// Load Testing Runner
// Comprehensive performance testing under concurrent user load

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('⚡ Load Testing Runner');
console.log('====================');

// Load test categories
const loadTestCategories = [
  {
    name: 'Authentication Load Testing',
    script: 'npm test -- --testPathPattern=load/authenticationLoad.test.js',
    description: 'Tests authentication performance under concurrent user load',
    critical: true,
    estimatedTime: '60s'
  },
  {
    name: 'API Endpoints Load Testing',
    script: 'npm test -- --testPathPattern=load/apiEndpointsLoad.test.js',
    description: 'Tests API endpoint performance with concurrent requests',
    critical: true,
    estimatedTime: '90s'
  }
];

// System metrics tracking
const systemMetrics = {
  initial: {},
  final: {},
  peak: {
    cpu: 0,
    memory: 0
  }
};

// Results tracking
const results = {
  passed: 0,
  failed: 0,
  categories: {},
  startTime: Date.now(),
  errors: [],
  warnings: [],
  performanceIssues: []
};

function logTest(category, status, message = '') {
  const statusIcon = {
    'PASS': '✅',
    'FAIL': '❌',
    'RUN': '🔄',
    'WARN': '⚠️'
  }[status] || '❓';
  
  console.log(`${statusIcon} ${category}: ${message}`);
}

function runCommand(command, options = {}) {
  try {
    const output = execSync(command, {
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      timeout: 180000, // 3 minutes for load tests
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

function getSystemMetrics() {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  
  return {
    cpu: {
      count: cpus.length,
      model: cpus[0].model,
      speed: cpus[0].speed
    },
    memory: {
      total: totalMem,
      used: usedMem,
      free: freeMem,
      usagePercent: (usedMem / totalMem) * 100
    },
    platform: os.platform(),
    arch: os.arch(),
    uptime: os.uptime(),
    loadAverage: os.loadavg()
  };
}

function checkLoadTestPrerequisites() {
  console.log('\n🎯 Load Test Prerequisites Check');
  console.log('─'.repeat(50));
  
  const checks = [
    {
      name: 'System Resources',
      command: 'echo "OK"',
      validator: () => {
        const metrics = getSystemMetrics();
        const minMemoryGB = 4;
        const availableMemoryGB = (metrics.memory.total / 1024 / 1024 / 1024);
        return availableMemoryGB >= minMemoryGB;
      }
    },
    {
      name: 'Load Test Files',
      command: 'ls __tests__/load/*.test.js | wc -l',
      validator: (output) => parseInt(output.trim()) >= 2
    },
    {
      name: 'Application Server',
      command: 'ls ../index.js',
      validator: (output) => !output.includes('No such file')
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
      results.errors.push(`Load test prerequisite failed: ${check.name}`);
    }
  });
  
  // Display system information
  const metrics = getSystemMetrics();
  console.log(`\n💻 System Information:`);
  console.log(`   Platform: ${metrics.platform} ${metrics.arch}`);
  console.log(`   CPU: ${metrics.cpu.count}x ${metrics.cpu.model}`);
  console.log(`   Memory: ${(metrics.memory.total / 1024 / 1024 / 1024).toFixed(2)}GB total, ${(metrics.memory.used / 1024 / 1024 / 1024).toFixed(2)}GB used (${metrics.memory.usagePercent.toFixed(1)}%)`);
  console.log(`   Load Average: ${metrics.loadAverage.map(l => l.toFixed(2)).join(', ')}`);
  
  systemMetrics.initial = metrics;
  
  return allPassed;
}

function monitorSystemDuringTests() {
  const monitorInterval = setInterval(() => {
    const currentMetrics = getSystemMetrics();
    
    // Track peak usage
    if (currentMetrics.memory.usagePercent > systemMetrics.peak.memory) {
      systemMetrics.peak.memory = currentMetrics.memory.usagePercent;
    }
    
    const currentLoad = currentMetrics.loadAverage[0];
    if (currentLoad > systemMetrics.peak.cpu) {
      systemMetrics.peak.cpu = currentLoad;
    }
    
    // Log warnings for high resource usage
    if (currentMetrics.memory.usagePercent > 90) {
      results.warnings.push(`High memory usage: ${currentMetrics.memory.usagePercent.toFixed(1)}%`);
    }
    
    if (currentLoad > currentMetrics.cpu.count * 2) {
      results.warnings.push(`High CPU load: ${currentLoad.toFixed(2)}`);
    }
  }, 5000); // Check every 5 seconds
  
  return monitorInterval;
}

function runLoadTests() {
  console.log('\n🎯 Load Testing Execution');
  console.log('─'.repeat(50));
  
  // Start system monitoring
  const monitorInterval = monitorSystemDuringTests();
  
  try {
    for (const category of loadTestCategories) {
      logTest(category.name, 'RUN', `Starting load tests... (${category.estimatedTime})`);
      
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
        
        // Extract performance metrics from test output
        const testOutput = result.output || '';
        
        // Look for performance indicators
        if (testOutput.includes('Average Response Time:')) {
          const responseTimeMatch = testOutput.match(/Average Response Time: ([\d.]+)ms/);
          if (responseTimeMatch) {
            const avgResponseTime = parseFloat(responseTimeMatch[1]);
            if (avgResponseTime > 2000) {
              results.performanceIssues.push(`High response time in ${category.name}: ${avgResponseTime}ms`);
            }
          }
        }
        
        if (testOutput.includes('Success Rate:')) {
          const successRateMatch = testOutput.match(/Success Rate: ([\d.]+)%/);
          if (successRateMatch) {
            const successRate = parseFloat(successRateMatch[1]);
            if (successRate < 80) {
              results.performanceIssues.push(`Low success rate in ${category.name}: ${successRate}%`);
            }
          }
        }
        
        // Extract test counts
        const passedTests = (testOutput.match(/✓/g) || []).length;
        const failedTests = (testOutput.match(/✕/g) || []).length;
        
        if (passedTests > 0) {
          logTest(category.name, 'PASS', 
            `${passedTests} load tests passed`, 
            failedTests > 0 ? `${failedTests} tests failed` : '');
        }
      } else {
        results.failed++;
        logTest(category.name, 'FAIL', `Failed after ${duration}ms`);
        
        if (category.critical) {
          results.errors.push(`Critical load test failed: ${category.name}`);
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
  } finally {
    // Stop system monitoring
    clearInterval(monitorInterval);
    systemMetrics.final = getSystemMetrics();
  }
}

function generateLoadTestReport() {
  console.log('\n🎯 Load Test Results Summary');
  console.log('─'.repeat(50));
  
  const totalDuration = Date.now() - results.startTime;
  const totalTests = results.passed + results.failed;
  const successRate = totalTests > 0 ? Math.round(((results.passed / totalTests) * 100)) : 0;
  
  console.log(`⚡ Load Test Summary:`);
  console.log(`   Total Categories: ${totalTests}`);
  console.log(`   Passed: ${results.passed} ✅`);
  console.log(`   Failed: ${results.failed} ❌`);
  console.log(`   Duration: ${totalDuration}ms`);
  console.log(`   Success Rate: ${successRate}%`);
  
  // Category breakdown
  console.log(`\n📊 Load Test Category Results:`);
  Object.entries(results.categories).forEach(([name, data]) => {
    const status = data.passed ? '✅ PASS' : '❌ FAIL';
    const critical = data.critical ? ' (Critical)' : '';
    console.log(`   ${name}: ${status}${critical} - ${data.duration}ms`);
  });
  
  // System performance analysis
  console.log(`\n💻 System Performance Analysis:`);
  console.log(`   Peak Memory Usage: ${systemMetrics.peak.memory.toFixed(1)}%`);
  console.log(`   Peak CPU Load: ${systemMetrics.peak.cpu.toFixed(2)}`);
  
  const memoryIncrease = systemMetrics.final.memory.usagePercent - systemMetrics.initial.memory.usagePercent;
  console.log(`   Memory Usage Change: ${memoryIncrease > 0 ? '+' : ''}${memoryIncrease.toFixed(1)}%`);
  
  // Performance issues
  if (results.performanceIssues.length > 0) {
    console.log(`\n⚠️  Performance Issues Detected:`);
    results.performanceIssues.forEach((issue, index) => {
      console.log(`   ${index + 1}. ${issue}`);
    });
  }
  
  // Errors and warnings
  if (results.errors.length > 0) {
    console.log(`\n❌ Critical Issues:`);
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
  
  // Performance recommendations
  console.log(`\n💡 Performance Recommendations:`);
  if (results.performanceIssues.length > 0) {
    console.log(`   • Address ${results.performanceIssues.length} performance issue(s)`);
    console.log(`   • Consider implementing connection pooling`);
    console.log(`   • Review database query optimization`);
    console.log(`   • Consider implementing caching strategies`);
  } else if (successRate >= 95) {
    console.log(`   • 🎉 Excellent load test performance!`);
    console.log(`   • System handles concurrent load well`);
    console.log(`   • Consider stress testing with higher loads`);
  } else if (successRate >= 80) {
    console.log(`   • Good baseline performance established`);
    console.log(`   • Monitor response times under production load`);
    console.log(`   • Consider performance optimization`);
  } else {
    console.log(`   • Significant performance improvements needed`);
    console.log(`   • Review system architecture for bottlenecks`);
    console.log(`   • Implement load balancing and scaling strategies`);
  }
  
  // Save detailed report
  const reportPath = path.join(__dirname, '..', 'test-results', 'load-test-report.json');
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
    systemMetrics: systemMetrics,
    performanceIssues: results.performanceIssues,
    errors: results.errors,
    warnings: results.warnings,
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      cpuCount: os.cpus().length,
      totalMemoryGB: (os.totalmem() / 1024 / 1024 / 1024).toFixed(2)
    },
    recommendations: generatePerformanceRecommendations(successRate, results)
  };
  
  fs.writeFileSync(reportPath, JSON.stringify(detailedReport, null, 2));
  console.log(`\n📄 Detailed load test report saved to: ${reportPath}`);
}

function generatePerformanceRecommendations(score, results) {
  const recommendations = [];
  
  if (results.performanceIssues.length > 0) {
    recommendations.push('Address identified performance bottlenecks');
    recommendations.push('Implement response time monitoring');
    recommendations.push('Consider database connection pooling');
  }
  
  if (score < 80) {
    recommendations.push('Comprehensive performance optimization required');
    recommendations.push('Review system architecture for scalability');
    recommendations.push('Implement caching strategies');
  }
  
  if (systemMetrics.peak.memory > 85) {
    recommendations.push('Monitor memory usage and implement garbage collection optimization');
    recommendations.push('Consider memory leak analysis');
  }
  
  if (systemMetrics.peak.cpu > os.cpus().length * 1.5) {
    recommendations.push('CPU optimization required');
    recommendations.push('Consider load balancing or horizontal scaling');
  }
  
  recommendations.push('Regular load testing and performance monitoring');
  recommendations.push('Establish performance baselines and alerts');
  recommendations.push('Plan for capacity scaling based on load patterns');
  
  return recommendations;
}

function main() {
  try {
    console.log(`🚀 Starting Load Testing at ${new Date().toISOString()}`);
    
    // Check prerequisites
    if (!checkLoadTestPrerequisites()) {
      console.log('\n❌ Load test prerequisites check failed. Please fix issues before running tests.');
      process.exit(1);
    }
    
    // Run load tests
    runLoadTests();
    
    // Generate report
    generateLoadTestReport();
    
    // Exit with appropriate code
    const hasFailures = results.failed > 0;
    const hasCriticalIssues = results.errors.length > 0;
    const hasPerformanceIssues = results.performanceIssues.length > 0;
    
    if (hasCriticalIssues) {
      console.log('\n🚨 Critical load test failures detected. System may not handle production load.');
      process.exit(1);
    } else if (hasFailures || hasPerformanceIssues) {
      console.log('\n⚠️  Some load tests failed or performance issues detected. Review and optimize.');
      process.exit(1);
    } else {
      console.log('\n✅ All load tests passed successfully! System ready for concurrent users.');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('\n💥 Unexpected error during load testing:');
    console.error(error.message);
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', () => {
  console.log('\n\n⏹️  Load testing interrupted by user');
  process.exit(130);
});

process.on('SIGTERM', () => {
  console.log('\n\n⏹️  Load testing terminated');
  process.exit(143);
});

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  runLoadTests,
  checkLoadTestPrerequisites,
  generateLoadTestReport,
  results
};
