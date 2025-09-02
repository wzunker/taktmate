#!/usr/bin/env node

/**
 * Configuration validation script for TaktMate
 * Usage: node scripts/validate-config.js [--fix]
 */

require('dotenv').config();
const { 
  validateEnvironmentSetup, 
  generateEnvironmentTemplate,
  getDatabaseConfig,
  getPoolStatistics 
} = require('../config/database');
const fs = require('fs').promises;
const path = require('path');

async function showHelp() {
  console.log('TaktMate Configuration Validator');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/validate-config.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  --fix                    Create .env file from template if missing');
  console.log('  --template               Generate .env template');
  console.log('  --status                 Show current configuration status');
  console.log('  --pool                   Show connection pool statistics');
  console.log('  --help, -h               Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/validate-config.js');
  console.log('  node scripts/validate-config.js --fix');
  console.log('  node scripts/validate-config.js --template > .env');
}

async function validateConfiguration() {
  console.log('🔍 Validating TaktMate Configuration');
  console.log('=' .repeat(50));
  
  const validation = validateEnvironmentSetup();
  
  console.log(`Environment: ${validation.environment}`);
  console.log(`Configuration Status: ${validation.valid ? '✅ Valid' : '❌ Invalid'}`);
  
  if (validation.issues.length > 0) {
    console.log('\n❌ Required Environment Variables Missing:');
    validation.issues.forEach(issue => {
      console.log(`   - ${issue}`);
    });
  }
  
  if (validation.warnings.length > 0) {
    console.log('\n⚠️  Configuration Warnings:');
    validation.warnings.forEach(warning => {
      console.log(`   - ${warning}`);
    });
  }
  
  if (validation.valid && validation.warnings.length === 0) {
    console.log('\n✅ Configuration is complete and valid');
  }
  
  // Show setup instructions if configuration is invalid
  if (!validation.valid) {
    console.log('\n📋 Setup Instructions:');
    console.log('1. Copy env.example to .env:');
    console.log('   cp backend/env.example backend/.env');
    console.log('');
    console.log('2. Edit .env file with your Azure SQL Database credentials');
    console.log('');
    console.log('3. Run validation again:');
    console.log('   npm run validate-config');
  }
  
  return validation;
}

async function showConfigurationStatus() {
  try {
    console.log('📊 Current Configuration Status');
    console.log('=' .repeat(50));
    
    const config = getDatabaseConfig();
    
    console.log(`Environment: ${config.environment}`);
    console.log(`Server: ${config.server || 'Not configured'}`);
    console.log(`Database: ${config.database || 'Not configured'}`);
    console.log(`User: ${config.user || 'Not configured'}`);
    
    if (config.pool) {
      console.log(`Connection Pool: ${config.pool.min}-${config.pool.max} connections`);
    }
    
    if (config.options) {
      console.log(`Encryption: ${config.options.encrypt ? 'Enabled' : 'Disabled'}`);
      console.log(`Trust Server Certificate: ${config.options.trustServerCertificate ? 'Yes' : 'No'}`);
    }
    
  } catch (error) {
    console.error('❌ Error getting configuration status:', error.message);
  }
}

async function showPoolStatistics() {
  try {
    console.log('📊 Connection Pool Statistics');
    console.log('=' .repeat(50));
    
    // Try to get pool statistics
    const stats = getPoolStatistics();
    
    if (stats.connected) {
      console.log(`Status: ✅ Connected`);
      console.log(`Total Connections: ${stats.totalConnections}`);
      console.log(`Used Connections: ${stats.usedConnections}`);
      console.log(`Free Connections: ${stats.freeConnections}`);
      console.log(`Pending Acquires: ${stats.pendingAcquires}`);
      console.log(`Pending Creates: ${stats.pendingCreates}`);
    } else {
      console.log(`Status: ❌ Not connected`);
      console.log(`Message: ${stats.message || stats.error}`);
      console.log('');
      console.log('💡 To test connection, run: npm run db:test');
    }
    
  } catch (error) {
    console.error('❌ Error getting pool statistics:', error.message);
  }
}

async function createEnvironmentFile() {
  try {
    const envPath = path.join(__dirname, '..', '.env');
    
    // Check if .env already exists
    try {
      await fs.access(envPath);
      console.log('⚠️  .env file already exists');
      console.log('Use --template option to generate a new template');
      return;
    } catch (error) {
      // File doesn't exist, which is what we want
    }
    
    // Generate template
    const template = generateEnvironmentTemplate();
    
    // Write to .env file
    await fs.writeFile(envPath, template);
    
    console.log('✅ Created .env file from template');
    console.log('📋 Next steps:');
    console.log('   1. Edit backend/.env with your Azure SQL Database credentials');
    console.log('   2. Run: npm run validate-config');
    console.log('   3. Test connection: npm run db:test');
    
  } catch (error) {
    console.error('❌ Error creating .env file:', error.message);
  }
}

async function generateTemplate() {
  console.log(generateEnvironmentTemplate());
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (command === '--help' || command === '-h') {
    await showHelp();
    return;
  }
  
  try {
    switch (command) {
      case '--fix':
        await createEnvironmentFile();
        break;
        
      case '--template':
        await generateTemplate();
        break;
        
      case '--status':
        await showConfigurationStatus();
        break;
        
      case '--pool':
        await showPoolStatistics();
        break;
        
      case undefined:
        // Default: validate configuration
        await validateConfiguration();
        break;
        
      default:
        console.error(`❌ Unknown option: ${command}`);
        console.log('Run with --help to see available options');
        process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Command execution failed:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
