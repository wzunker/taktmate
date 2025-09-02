#!/usr/bin/env node

/**
 * Database migration CLI for TaktMate
 * Usage: node scripts/migrate.js [command] [options]
 */

require('dotenv').config();
const { initializeDatabase, closeDatabase } = require('../config/database');
const MigrationManager = require('../database/migrationManager');

async function showHelp() {
  console.log('TaktMate Database Migration CLI');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/migrate.js [command] [options]');
  console.log('');
  console.log('Commands:');
  console.log('  status                   Show migration status');
  console.log('  run                      Run all pending migrations');
  console.log('  validate                 Validate migration integrity');
  console.log('  create <name>            Create a new migration file');
  console.log('  history                  Show migration execution history');
  console.log('  help, -h, --help         Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/migrate.js status');
  console.log('  node scripts/migrate.js run');
  console.log('  node scripts/migrate.js create "add user preferences table"');
  console.log('  node scripts/migrate.js validate');
}

async function showStatus() {
  try {
    console.log('📊 Migration Status');
    console.log('=' .repeat(50));
    
    const manager = new MigrationManager();
    const status = await manager.getMigrationStatus();
    
    console.log(`Available migrations:     ${status.available}`);
    console.log(`Executed migrations:      ${status.executed}`);
    console.log(`Pending migrations:       ${status.pending}`);
    
    if (status.migrations.pending.length > 0) {
      console.log('');
      console.log('📋 Pending migrations:');
      status.migrations.pending.forEach(name => {
        console.log(`   - ${name}`);
      });
    }
    
    if (status.migrations.executed.length > 0) {
      console.log('');
      console.log('✅ Last 5 executed migrations:');
      status.migrations.executed
        .slice(-5)
        .forEach(migration => {
          const status = migration.success ? '✅' : '❌';
          const date = new Date(migration.executed_at).toLocaleString();
          console.log(`   ${status} ${migration.name} (${date})`);
        });
    }
    
  } catch (error) {
    console.error('❌ Error getting migration status:', error.message);
  }
}

async function runMigrations() {
  try {
    console.log('🚀 Running Database Migrations');
    console.log('=' .repeat(50));
    
    const manager = new MigrationManager();
    const result = await manager.runPendingMigrations();
    
    if (result.executed === 0) {
      console.log('✅ Database is up to date');
    } else {
      console.log('');
      console.log('📊 Migration Summary:');
      console.log(`   Executed: ${result.executed} migrations`);
      console.log(`   Total time: ${result.totalExecutionTime}ms`);
      
      console.log('');
      console.log('📋 Executed migrations:');
      result.migrations.forEach(migration => {
        const status = migration.success ? '✅' : '❌';
        console.log(`   ${status} ${migration.name} (${migration.executionTime}ms)`);
      });
    }
    
  } catch (error) {
    console.error('❌ Migration execution failed:', error.message);
    process.exit(1);
  }
}

async function validateIntegrity() {
  try {
    console.log('🔍 Validating Migration Integrity');
    console.log('=' .repeat(50));
    
    const manager = new MigrationManager();
    const validation = await manager.validateMigrationIntegrity();
    
    if (validation.valid) {
      console.log('✅ All migrations are valid and intact');
    } else {
      console.log(`⚠️  Found ${validation.issues.length} issues:`);
      validation.issues.forEach(issue => {
        console.log(`   - ${issue.migration}: ${issue.message}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Validation failed:', error.message);
  }
}

async function createMigration(name, description) {
  try {
    if (!name) {
      console.error('❌ Migration name is required');
      console.log('Usage: node scripts/migrate.js create <name> [description]');
      process.exit(1);
    }
    
    console.log(`📝 Creating new migration: ${name}`);
    
    const manager = new MigrationManager();
    const result = await manager.createMigration(name, description);
    
    console.log(`✅ Created migration file: ${result.filename}`);
    console.log(`📁 Path: ${result.filepath}`);
    console.log('');
    console.log('📋 Next steps:');
    console.log('   1. Edit the migration file to add your SQL statements');
    console.log('   2. Run "npm run migrate" to execute pending migrations');
    
  } catch (error) {
    console.error('❌ Failed to create migration:', error.message);
  }
}

async function showHistory() {
  try {
    console.log('📜 Migration History');
    console.log('=' .repeat(80));
    
    const manager = new MigrationManager();
    const executed = await manager.getExecutedMigrations();
    
    if (executed.length === 0) {
      console.log('No migrations have been executed yet');
      return;
    }
    
    console.log(`Found ${executed.length} executed migrations:\n`);
    
    executed.forEach((migration, index) => {
      const status = migration.success ? '✅' : '❌';
      const date = new Date(migration.executed_at).toLocaleString();
      
      console.log(`${index + 1}. ${status} ${migration.migration_name}`);
      console.log(`   Executed: ${date}`);
      if (!migration.success && migration.error_message) {
        console.log(`   Error: ${migration.error_message}`);
      }
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error getting migration history:', error.message);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command || command === 'help' || command === '-h' || command === '--help') {
    await showHelp();
    return;
  }
  
  try {
    console.log('🔌 Connecting to database...');
    await initializeDatabase();
    
    switch (command) {
      case 'status':
        await showStatus();
        break;
        
      case 'run':
        await runMigrations();
        break;
        
      case 'validate':
        await validateIntegrity();
        break;
        
      case 'create':
        const name = args[1];
        const description = args.slice(2).join(' ');
        await createMigration(name, description);
        break;
        
      case 'history':
        await showHistory();
        break;
        
      default:
        console.error(`❌ Unknown command: ${command}`);
        console.log('Run with --help to see available commands');
        process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Command execution failed:', error.message);
    process.exit(1);
  } finally {
    await closeDatabase();
  }
}

// Run the script
main();
