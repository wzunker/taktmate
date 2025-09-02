#!/usr/bin/env node

/**
 * Test Azure SQL Database connection
 * Usage: node scripts/test-connection.js
 */

require('dotenv').config();
const { initializeDatabase, closeDatabase, testConnection, executeQuery } = require('../config/database');

async function testDatabaseConnection() {
  try {
    console.log('🔍 Testing TaktMate Database Connection');
    console.log('=' .repeat(50));
    
    // Test basic connection
    console.log('📡 Initializing connection...');
    await initializeDatabase();
    console.log('✅ Database connection initialized');
    
    // Test query execution
    console.log('🔍 Testing query execution...');
    await testConnection();
    console.log('✅ Query execution successful');
    
    // Test more detailed connection info
    console.log('📊 Retrieving database information...');
    const dbInfoQuery = `
      SELECT 
        DB_NAME() as database_name,
        @@VERSION as version,
        GETUTCDATE() as current_time,
        USER_NAME() as current_user
    `;
    
    const result = await executeQuery(dbInfoQuery);
    const info = result.recordset[0];
    
    console.log('📋 Database Information:');
    console.log(`   Database: ${info.database_name}`);
    console.log(`   User: ${info.current_user}`);
    console.log(`   Server Time: ${info.current_time}`);
    console.log(`   Version: ${info.version.split('\n')[0]}`);
    
    // Test table existence
    console.log('\n📋 Checking table structure...');
    const tablesQuery = `
      SELECT TABLE_NAME, TABLE_TYPE 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `;
    
    try {
      const tablesResult = await executeQuery(tablesQuery);
      if (tablesResult.recordset.length > 0) {
        console.log('✅ Found tables:');
        tablesResult.recordset.forEach(table => {
          console.log(`   - ${table.TABLE_NAME}`);
        });
      } else {
        console.log('⚠️  No tables found. Run setup-database.js to create schema.');
      }
    } catch (error) {
      console.log('⚠️  Could not check tables:', error.message);
    }
    
    console.log('\n✅ Database connection test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Database connection test failed:');
    console.error(`   Error: ${error.message}`);
    
    // Provide helpful troubleshooting information
    console.error('\n🔧 Troubleshooting Steps:');
    
    if (error.message.includes('Login failed')) {
      console.error('   1. Check AZURE_SQL_USER and AZURE_SQL_PASSWORD in .env');
      console.error('   2. Verify credentials in Azure portal');
    }
    
    if (error.message.includes('server was not found')) {
      console.error('   1. Check AZURE_SQL_SERVER in .env file');
      console.error('   2. Ensure server name includes .database.windows.net');
      console.error('   3. Verify server exists in Azure portal');
    }
    
    if (error.message.includes('Cannot open database')) {
      console.error('   1. Check AZURE_SQL_DATABASE name in .env');
      console.error('   2. Verify database exists in Azure portal');
      console.error('   3. Check user has access to the database');
    }
    
    if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
      console.error('   1. Check Azure SQL firewall rules');
      console.error('   2. Add your IP address to allowed IPs');
      console.error('   3. Enable "Allow Azure services" if needed');
    }
    
    console.error('\n📋 Current Environment Variables:');
    console.error(`   AZURE_SQL_SERVER: ${process.env.AZURE_SQL_SERVER || 'NOT SET'}`);
    console.error(`   AZURE_SQL_DATABASE: ${process.env.AZURE_SQL_DATABASE || 'NOT SET'}`);
    console.error(`   AZURE_SQL_USER: ${process.env.AZURE_SQL_USER || 'NOT SET'}`);
    console.error(`   AZURE_SQL_PASSWORD: ${process.env.AZURE_SQL_PASSWORD ? '[SET]' : 'NOT SET'}`);
    
    process.exit(1);
  } finally {
    await closeDatabase();
  }
}

// Run the test
testDatabaseConnection();
