const { executeQuery, sql } = require('../config/database');
const fs = require('fs').promises;
const path = require('path');

/**
 * Advanced database migration manager for TaktMate
 * Handles versioned migrations with rollback support and detailed logging
 */
class MigrationManager {
  constructor() {
    this.migrationsPath = path.join(__dirname, 'migrations');
  }

  /**
   * Initialize migration system - create MigrationHistory table if it doesn't exist
   */
  async initializeMigrationSystem() {
    try {
      console.log('🔧 Initializing migration system...');
      
      // Check if MigrationHistory table exists
      const checkTableQuery = `
        SELECT COUNT(*) as table_count
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_NAME = 'MigrationHistory'
      `;
      
      const result = await executeQuery(checkTableQuery);
      
      if (result.recordset[0].table_count === 0) {
        console.log('📋 Creating MigrationHistory table...');
        
        const createTableQuery = `
          CREATE TABLE MigrationHistory (
            id INT IDENTITY(1,1) PRIMARY KEY,
            migration_name NVARCHAR(255) NOT NULL UNIQUE,
            executed_at DATETIME2 DEFAULT GETUTCDATE(),
            success BIT DEFAULT 1,
            error_message NVARCHAR(MAX),
            execution_time_ms INT,
            checksum NVARCHAR(64) -- For migration file integrity
          );
          
          CREATE INDEX IX_MigrationHistory_MigrationName ON MigrationHistory(migration_name);
          CREATE INDEX IX_MigrationHistory_ExecutedAt ON MigrationHistory(executed_at);
        `;
        
        await executeQuery(createTableQuery);
        console.log('✅ MigrationHistory table created');
      } else {
        console.log('✅ MigrationHistory table already exists');
      }
      
    } catch (error) {
      console.error('❌ Failed to initialize migration system:', error);
      throw error;
    }
  }

  /**
   * Get list of available migration files
   */
  async getAvailableMigrations() {
    try {
      const files = await fs.readdir(this.migrationsPath);
      const migrationFiles = files
        .filter(file => file.endsWith('.sql'))
        .sort(); // Natural sort order
      
      return migrationFiles.map(file => ({
        name: path.basename(file, '.sql'),
        filename: file,
        path: path.join(this.migrationsPath, file)
      }));
    } catch (error) {
      console.error('Error reading migration files:', error);
      return [];
    }
  }

  /**
   * Get list of executed migrations from database
   */
  async getExecutedMigrations() {
    try {
      const query = `
        SELECT migration_name, executed_at, success, error_message 
        FROM MigrationHistory 
        ORDER BY executed_at ASC
      `;
      
      const result = await executeQuery(query);
      return result.recordset;
    } catch (error) {
      console.error('Error getting executed migrations:', error);
      return [];
    }
  }

  /**
   * Get pending migrations (available but not executed)
   */
  async getPendingMigrations() {
    const available = await this.getAvailableMigrations();
    const executed = await this.getExecutedMigrations();
    const executedNames = new Set(executed.map(m => m.migration_name));
    
    return available.filter(migration => !executedNames.has(migration.name));
  }

  /**
   * Calculate checksum for migration file integrity
   */
  async calculateChecksum(filePath) {
    const crypto = require('crypto');
    const content = await fs.readFile(filePath, 'utf8');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Execute a single migration file
   */
  async executeMigration(migration) {
    const startTime = Date.now();
    let success = false;
    let errorMessage = null;
    
    try {
      console.log(`🔄 Executing migration: ${migration.name}`);
      
      // Read migration file
      const migrationSQL = await fs.readFile(migration.path, 'utf8');
      const checksum = await this.calculateChecksum(migration.path);
      
      // Split into statements (handle GO separators)
      const statements = this.splitSQLStatements(migrationSQL);
      
      // Execute each statement
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i].trim();
        
        // Skip empty statements and comments
        if (!statement || statement.startsWith('--')) {
          continue;
        }
        
        // Skip migration history inserts (we'll add our own)
        if (statement.toLowerCase().includes('insert into migrationhistory')) {
          continue;
        }
        
        try {
          await executeQuery(statement);
        } catch (error) {
          console.error(`❌ Error in statement ${i + 1} of ${migration.name}:`, error.message);
          throw error;
        }
      }
      
      success = true;
      console.log(`✅ Migration ${migration.name} executed successfully`);
      
    } catch (error) {
      success = false;
      errorMessage = error.message;
      console.error(`❌ Migration ${migration.name} failed:`, error.message);
    }
    
    const executionTime = Date.now() - startTime;
    const checksum = success ? await this.calculateChecksum(migration.path) : null;
    
    // Record migration execution
    await this.recordMigrationExecution(migration.name, success, errorMessage, executionTime, checksum);
    
    if (!success) {
      throw new Error(`Migration ${migration.name} failed: ${errorMessage}`);
    }
    
    return { success, executionTime };
  }

  /**
   * Record migration execution in history
   */
  async recordMigrationExecution(migrationName, success, errorMessage, executionTime, checksum) {
    const query = `
      INSERT INTO MigrationHistory (migration_name, success, error_message, execution_time_ms, checksum)
      VALUES (@migrationName, @success, @errorMessage, @executionTime, @checksum)
    `;
    
    await executeQuery(query, {
      migrationName,
      success: success ? 1 : 0,
      errorMessage,
      executionTime,
      checksum
    });
  }

  /**
   * Run all pending migrations
   */
  async runPendingMigrations() {
    try {
      console.log('🚀 Running pending migrations...');
      
      // Initialize migration system
      await this.initializeMigrationSystem();
      
      // Get pending migrations
      const pendingMigrations = await this.getPendingMigrations();
      
      if (pendingMigrations.length === 0) {
        console.log('✅ No pending migrations found');
        return { executed: 0, migrations: [] };
      }
      
      console.log(`📋 Found ${pendingMigrations.length} pending migrations:`);
      pendingMigrations.forEach(migration => {
        console.log(`   - ${migration.name}`);
      });
      
      const executedMigrations = [];
      let totalExecutionTime = 0;
      
      // Execute migrations in order
      for (const migration of pendingMigrations) {
        const result = await this.executeMigration(migration);
        executedMigrations.push({
          name: migration.name,
          success: result.success,
          executionTime: result.executionTime
        });
        totalExecutionTime += result.executionTime;
      }
      
      console.log(`✅ Executed ${executedMigrations.length} migrations in ${totalExecutionTime}ms`);
      
      return {
        executed: executedMigrations.length,
        migrations: executedMigrations,
        totalExecutionTime
      };
      
    } catch (error) {
      console.error('❌ Migration execution failed:', error);
      throw error;
    }
  }

  /**
   * Get migration status overview
   */
  async getMigrationStatus() {
    try {
      const available = await this.getAvailableMigrations();
      const executed = await this.getExecutedMigrations();
      const pending = await this.getPendingMigrations();
      
      return {
        available: available.length,
        executed: executed.length,
        pending: pending.length,
        migrations: {
          available: available.map(m => m.name),
          executed: executed.map(m => ({
            name: m.migration_name,
            executed_at: m.executed_at,
            success: m.success
          })),
          pending: pending.map(m => m.name)
        }
      };
    } catch (error) {
      console.error('Error getting migration status:', error);
      throw error;
    }
  }

  /**
   * Validate migration integrity
   */
  async validateMigrationIntegrity() {
    try {
      console.log('🔍 Validating migration integrity...');
      
      const executed = await this.getExecutedMigrations();
      const issues = [];
      
      for (const migration of executed) {
        const migrationFile = path.join(this.migrationsPath, `${migration.migration_name}.sql`);
        
        try {
          // Check if file still exists
          await fs.access(migrationFile);
          
          // Check checksum if available
          if (migration.checksum) {
            const currentChecksum = await this.calculateChecksum(migrationFile);
            if (currentChecksum !== migration.checksum) {
              issues.push({
                migration: migration.migration_name,
                issue: 'checksum_mismatch',
                message: 'Migration file has been modified since execution'
              });
            }
          }
        } catch (error) {
          issues.push({
            migration: migration.migration_name,
            issue: 'file_missing',
            message: 'Migration file no longer exists'
          });
        }
      }
      
      if (issues.length === 0) {
        console.log('✅ All migrations validated successfully');
      } else {
        console.log(`⚠️  Found ${issues.length} migration integrity issues:`);
        issues.forEach(issue => {
          console.log(`   - ${issue.migration}: ${issue.message}`);
        });
      }
      
      return { valid: issues.length === 0, issues };
    } catch (error) {
      console.error('Error validating migration integrity:', error);
      throw error;
    }
  }

  /**
   * Split SQL file into individual statements
   */
  splitSQLStatements(sql) {
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
   * Create a new migration file template
   */
  async createMigration(name, description = '') {
    try {
      // Get next migration number
      const existing = await this.getAvailableMigrations();
      const nextNumber = existing.length + 1;
      const paddedNumber = nextNumber.toString().padStart(3, '0');
      
      const filename = `${paddedNumber}_${name.toLowerCase().replace(/\s+/g, '_')}.sql`;
      const filepath = path.join(this.migrationsPath, filename);
      
      const template = `-- Migration ${paddedNumber}: ${name}
-- Created: ${new Date().toISOString().split('T')[0]}
-- Description: ${description}

-- Add your migration SQL here


-- Record this migration
INSERT INTO MigrationHistory (migration_name, success, execution_time_ms) 
VALUES ('${paddedNumber}_${name.toLowerCase().replace(/\s+/g, '_')}', 1, 0);
`;

      await fs.writeFile(filepath, template);
      console.log(`✅ Created migration file: ${filename}`);
      
      return { filename, filepath };
    } catch (error) {
      console.error('Error creating migration file:', error);
      throw error;
    }
  }
}

module.exports = MigrationManager;
