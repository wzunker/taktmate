#!/usr/bin/env node

/**
 * Database testing script for TaktMate
 * Usage: node scripts/test-database.js [--connectivity] [--crud] [--integration] [--all]
 */

require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');

async function showHelp() {
  console.log('TaktMate Database Testing Script');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/test-database.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  --connectivity           Run database connectivity tests only');
  console.log('  --crud                   Run CRUD operations tests only');
  console.log('  --integration            Run integration tests only');
  console.log('  --user                   Run User model tests only');
  console.log('  --session                Run Session model tests only');
  console.log('  --all                    Run all database tests (default)');
  console.log('  --coverage               Run tests with coverage report');
  console.log('  --watch                  Run tests in watch mode');
  console.log('  --help, -h               Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/test-database.js --connectivity');
  console.log('  node scripts/test-database.js --crud --coverage');
  console.log('  node scripts/test-database.js --all');
}

function runJestTests(testPattern, options = {}) {
  return new Promise((resolve, reject) => {
    const jestArgs = [];
    
    // Add test pattern if specified
    if (testPattern) {
      jestArgs.push(testPattern);
    }
    
    // Add coverage if requested
    if (options.coverage) {
      jestArgs.push('--coverage');
    }
    
    // Add watch mode if requested
    if (options.watch) {
      jestArgs.push('--watch');
    }
    
    // Add verbose output
    jestArgs.push('--verbose');
    
    // Add specific configuration
    jestArgs.push('--testTimeout=30000'); // 30 second timeout for database operations
    
    console.log(`🧪 Running Jest with args: ${jestArgs.join(' ')}`);
    
    const jest = spawn('npx', ['jest', ...jestArgs], {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    jest.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Jest exited with code ${code}`));
      }
    });
    
    jest.on('error', (error) => {
      reject(error);
    });
  });
}

async function validateEnvironment() {
  console.log('🔍 Validating test environment...');
  
  const required = [
    'AZURE_SQL_SERVER',
    'AZURE_SQL_DATABASE', 
    'AZURE_SQL_USER',
    'AZURE_SQL_PASSWORD'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('');
    console.error('💡 Make sure to:');
    console.error('   1. Copy backend/env.example to backend/.env');
    console.error('   2. Update .env with your Azure SQL Database credentials');
    console.error('   3. Run: npm run validate-config');
    process.exit(1);
  }
  
  console.log('✅ Environment validation passed');
}

async function runConnectivityTests(options) {
  console.log('🔌 Running Database Connectivity Tests');
  console.log('=' .repeat(50));
  
  await runJestTests('tests/database-connectivity.test.js', options);
}

async function runCrudTests(options) {
  console.log('📝 Running CRUD Operations Tests');
  console.log('=' .repeat(50));
  
  await runJestTests('tests/crud-operations.test.js', options);
}

async function runIntegrationTests(options) {
  console.log('🔄 Running Integration Tests');
  console.log('=' .repeat(50));
  
  await runJestTests('tests/integration.test.js', options);
}

async function runUserTests(options) {
  console.log('👤 Running User Model Tests');
  console.log('=' .repeat(50));
  
  await runJestTests('tests/user.test.js', options);
}

async function runSessionTests(options) {
  console.log('🔐 Running Session Model Tests');
  console.log('=' .repeat(50));
  
  await runJestTests('tests/session.test.js', options);
}

async function runAllDatabaseTests(options) {
  console.log('🚀 Running All Database Tests');
  console.log('=' .repeat(50));
  
  const testFiles = [
    'tests/database-connectivity.test.js',
    'tests/crud-operations.test.js', 
    'tests/user.test.js',
    'tests/session.test.js',
    'tests/integration.test.js'
  ];
  
  await runJestTests(testFiles.join(' '), options);
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    await showHelp();
    return;
  }
  
  const options = {
    coverage: args.includes('--coverage'),
    watch: args.includes('--watch')
  };
  
  try {
    // Validate environment before running tests
    await validateEnvironment();
    
    console.log('🧪 TaktMate Database Test Suite');
    console.log('=' .repeat(50));
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Database: ${process.env.AZURE_SQL_DATABASE}`);
    console.log(`Server: ${process.env.AZURE_SQL_SERVER}`);
    console.log('');
    
    if (args.includes('--connectivity')) {
      await runConnectivityTests(options);
    } else if (args.includes('--crud')) {
      await runCrudTests(options);
    } else if (args.includes('--integration')) {
      await runIntegrationTests(options);
    } else if (args.includes('--user')) {
      await runUserTests(options);
    } else if (args.includes('--session')) {
      await runSessionTests(options);
    } else {
      // Default: run all tests
      await runAllDatabaseTests(options);
    }
    
    console.log('');
    console.log('✅ Database tests completed successfully!');
    
  } catch (error) {
    console.error('');
    console.error('❌ Database tests failed:', error.message);
    console.error('');
    console.error('🔧 Troubleshooting:');
    console.error('   1. Check database connection: npm run db:test');
    console.error('   2. Validate configuration: npm run validate-config');
    console.error('   3. Run database setup: npm run db:setup');
    console.error('   4. Check migration status: npm run migrate:status');
    
    process.exit(1);
  }
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.log('\n\n🛑 Tests interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Tests terminated');
  process.exit(0);
});

// Run the script
main();
