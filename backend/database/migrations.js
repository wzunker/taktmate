const { executeQuery, sql } = require('../config/database');
const fs = require('fs').promises;
const path = require('path');

/**
 * Database migration utilities for TaktMate
 */
class DatabaseMigration {
  constructor() {
    this.migrationsPath = path.join(__dirname, 'schema.sql');
  }

  /**
   * Check if database tables exist
   */
  async checkTablesExist() {
    try {
      const query = `
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_TYPE = 'BASE TABLE' 
        AND TABLE_NAME IN ('Users', 'Sessions', 'OAuthTokens', 'DataExportRequests', 'AuditLog')
      `;
      
      const result = await executeQuery(query);
      const existingTables = result.recordset.map(row => row.TABLE_NAME);
      
      const requiredTables = ['Users', 'Sessions', 'OAuthTokens', 'DataExportRequests', 'AuditLog'];
      const missingTables = requiredTables.filter(table => !existingTables.includes(table));
      
      return {
        exists: missingTables.length === 0,
        existingTables,
        missingTables
      };
    } catch (error) {
      console.error('Error checking tables:', error);
      throw error;
    }
  }

  /**
   * Run initial database setup (legacy method - use MigrationManager for new setups)
   */
  async runInitialSetup() {
    try {
      console.log('🔄 Running initial database setup...');
      console.log('ℹ️  Note: For new setups, consider using the migration system (npm run migrate)');
      
      // Check if tables already exist
      const tableCheck = await this.checkTablesExist();
      
      if (tableCheck.exists) {
        console.log('✅ Database tables already exist. Skipping initial setup.');
        return { success: true, message: 'Tables already exist' };
      }

      console.log(`📋 Missing tables: ${tableCheck.missingTables.join(', ')}`);
      
      // Use the migration system if available
      try {
        const MigrationManager = require('./migrationManager');
        const migrationManager = new MigrationManager();
        
        console.log('🔄 Using migration system for setup...');
        const result = await migrationManager.runPendingMigrations();
        
        return { 
          success: true, 
          message: `Database setup completed via migrations. Executed ${result.executed} migrations.` 
        };
        
      } catch (migrationError) {
        console.log('⚠️  Migration system not available, falling back to legacy setup...');
        
        // Fallback to legacy schema.sql file
        const schemaSQL = await fs.readFile(this.migrationsPath, 'utf8');
        
        // Split SQL into individual statements
        const statements = this.splitSQLStatements(schemaSQL);
        
        console.log(`📝 Executing ${statements.length} SQL statements...`);
        
        // Execute each statement
        for (let i = 0; i < statements.length; i++) {
          const statement = statements[i].trim();
          if (statement && !statement.startsWith('--')) {
            try {
              console.log(`   ${i + 1}/${statements.length}: Executing statement...`);
              await executeQuery(statement);
            } catch (error) {
              console.error(`❌ Error executing statement ${i + 1}:`, error.message);
              console.error('Statement:', statement.substring(0, 100) + '...');
              throw error;
            }
          }
        }
        
        // Verify tables were created
        const finalCheck = await this.checkTablesExist();
        
        if (finalCheck.exists) {
          console.log('✅ Database setup completed successfully!');
          console.log(`📊 Created tables: ${finalCheck.existingTables.join(', ')}`);
          return { success: true, message: 'Database setup completed' };
        } else {
          throw new Error(`Setup incomplete. Missing tables: ${finalCheck.missingTables.join(', ')}`);
        }
      }
      
    } catch (error) {
      console.error('❌ Database setup failed:', error);
      throw error;
    }
  }

  /**
   * Split SQL file into individual statements
   */
  splitSQLStatements(sql) {
    // Remove comments and split by GO statements (SQL Server batch separator)
    const lines = sql.split('\n');
    const statements = [];
    let currentStatement = '';
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip comments
      if (trimmedLine.startsWith('--') || trimmedLine === '') {
        continue;
      }
      
      // Check for batch separator
      if (trimmedLine.toUpperCase() === 'GO') {
        if (currentStatement.trim()) {
          statements.push(currentStatement.trim());
          currentStatement = '';
        }
        continue;
      }
      
      currentStatement += line + '\n';
    }
    
    // Add the last statement if it exists
    if (currentStatement.trim()) {
      statements.push(currentStatement.trim());
    }
    
    return statements;
  }

  /**
   * Create a test user for development
   */
  async createTestUser() {
    try {
      const bcrypt = require('bcrypt');
      const saltRounds = 12;
      const testPassword = await bcrypt.hash('TestPassword123!', saltRounds);
      
      const query = `
        IF NOT EXISTS (SELECT 1 FROM Users WHERE email = @email)
        BEGIN
          INSERT INTO Users (name, company, role, email, password_hash, email_verified, created_at)
          VALUES (@name, @company, @role, @email, @password_hash, 1, GETUTCDATE())
        END
      `;
      
      const parameters = {
        name: 'Test User',
        company: 'TaktMate',
        role: 'Developer',
        email: 'test@taktmate.com',
        password_hash: testPassword
      };
      
      await executeQuery(query, parameters);
      console.log('✅ Test user created: test@taktmate.com / TestPassword123!');
      
      return { success: true, email: 'test@taktmate.com' };
    } catch (error) {
      console.error('❌ Error creating test user:', error);
      throw error;
    }
  }

  /**
   * Reset database (drop all tables) - USE WITH CAUTION
   */
  async resetDatabase() {
    try {
      console.log('⚠️  Resetting database - dropping all tables...');
      
      const dropQueries = [
        'DROP VIEW IF EXISTS UserStatistics',
        'DROP VIEW IF EXISTS ActiveUserSessions',
        'DROP PROCEDURE IF EXISTS CleanupExpiredDataExports',
        'DROP PROCEDURE IF EXISTS CleanupExpiredSessions',
        'DROP TABLE IF EXISTS AuditLog',
        'DROP TABLE IF EXISTS DataExportRequests',
        'DROP TABLE IF EXISTS OAuthTokens',
        'DROP TABLE IF EXISTS Sessions',
        'DROP TABLE IF EXISTS Users'
      ];
      
      for (const query of dropQueries) {
        try {
          await executeQuery(query);
        } catch (error) {
          // Ignore errors for non-existent objects
          if (!error.message.includes('does not exist')) {
            console.warn('Warning dropping object:', error.message);
          }
        }
      }
      
      console.log('✅ Database reset completed');
      return { success: true, message: 'Database reset completed' };
    } catch (error) {
      console.error('❌ Database reset failed:', error);
      throw error;
    }
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats() {
    try {
      const queries = {
        users: 'SELECT COUNT(*) as count FROM Users WHERE is_active = 1',
        sessions: 'SELECT COUNT(*) as count FROM Sessions WHERE expires_at > GETUTCDATE() AND is_active = 1',
        oauthTokens: 'SELECT COUNT(*) as count FROM OAuthTokens',
        auditLogs: 'SELECT COUNT(*) as count FROM AuditLog WHERE created_at > DATEADD(day, -30, GETUTCDATE())'
      };
      
      const stats = {};
      
      for (const [key, query] of Object.entries(queries)) {
        try {
          const result = await executeQuery(query);
          stats[key] = result.recordset[0].count;
        } catch (error) {
          stats[key] = 'Error: ' + error.message;
        }
      }
      
      return stats;
    } catch (error) {
      console.error('Error getting database stats:', error);
      throw error;
    }
  }
}

module.exports = DatabaseMigration;
