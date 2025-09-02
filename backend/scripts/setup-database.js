#!/usr/bin/env node

/**
 * Database setup script for TaktMate
 * Usage: node scripts/setup-database.js [--reset] [--test-user]
 */

require('dotenv').config();
const { initializeDatabase, closeDatabase, testConnection } = require('../config/database');
const DatabaseMigration = require('../database/migrations');

async function main() {
  const args = process.argv.slice(2);
  const shouldReset = args.includes('--reset');
  const shouldCreateTestUser = args.includes('--test-user');
  
  try {
    console.log('🚀 TaktMate Database Setup');
    console.log('=' .repeat(50));
    
    // Initialize database connection
    console.log('📡 Connecting to Azure SQL Database...');
    await initializeDatabase();
    
    // Test connection
    console.log('🔍 Testing database connection...');
    await testConnection();
    
    const migration = new DatabaseMigration();
    
    // Reset database if requested
    if (shouldReset) {
      console.log('\n⚠️  RESET MODE - This will drop all existing tables!');
      console.log('Continuing in 3 seconds...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      await migration.resetDatabase();
    }
    
    // Check current database state
    console.log('\n📊 Checking database state...');
    const tableCheck = await migration.checkTablesExist();
    
    if (tableCheck.exists) {
      console.log('✅ All required tables exist:');
      tableCheck.existingTables.forEach(table => {
        console.log(`   - ${table}`);
      });
    } else {
      console.log('📋 Missing tables detected:');
      tableCheck.missingTables.forEach(table => {
        console.log(`   - ${table}`);
      });
      
      // Run initial setup
      console.log('\n🔧 Running database setup...');
      await migration.runInitialSetup();
    }
    
    // Create test user if requested
    if (shouldCreateTestUser) {
      console.log('\n👤 Creating test user...');
      try {
        await migration.createTestUser();
      } catch (error) {
        if (error.message.includes('bcrypt')) {
          console.log('⚠️  bcrypt not installed. Installing...');
          const { execSync } = require('child_process');
          execSync('npm install bcrypt', { stdio: 'inherit' });
          await migration.createTestUser();
        } else {
          throw error;
        }
      }
    }
    
    // Show database statistics
    console.log('\n📈 Database Statistics:');
    try {
      const stats = await migration.getDatabaseStats();
      console.log(`   Active Users: ${stats.users}`);
      console.log(`   Active Sessions: ${stats.sessions}`);
      console.log(`   OAuth Tokens: ${stats.oauthTokens}`);
      console.log(`   Recent Audit Logs: ${stats.auditLogs}`);
    } catch (error) {
      console.log('   Could not retrieve statistics (tables may not exist yet)');
    }
    
    console.log('\n✅ Database setup completed successfully!');
    console.log('=' .repeat(50));
    
    // Show next steps
    console.log('\n📝 Next Steps:');
    console.log('   1. Update your .env file with database credentials');
    console.log('   2. Test the connection: node scripts/test-connection.js');
    if (!shouldCreateTestUser) {
      console.log('   3. Create a test user: node scripts/setup-database.js --test-user');
    }
    console.log('   4. Start the application: npm run dev');
    
  } catch (error) {
    console.error('\n❌ Database setup failed:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('   1. Check your .env file has correct database credentials');
    console.error('   2. Ensure Azure SQL Database firewall allows your IP');
    console.error('   3. Verify database server is running and accessible');
    console.error('   4. Check Azure portal for database status');
    
    process.exit(1);
  } finally {
    // Clean up database connection
    await closeDatabase();
  }
}

// Handle script arguments and help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('TaktMate Database Setup Script');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/setup-database.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  --reset      Drop all existing tables and recreate (DESTRUCTIVE!)');
  console.log('  --test-user  Create a test user account for development');
  console.log('  --help, -h   Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/setup-database.js');
  console.log('  node scripts/setup-database.js --test-user');
  console.log('  node scripts/setup-database.js --reset --test-user');
  process.exit(0);
}

// Run the main function
main();
