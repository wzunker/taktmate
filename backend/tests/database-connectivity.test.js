const { initializeDatabase, closeDatabase, testConnection, executeQuery, getPoolStatistics } = require('../config/database');
const DatabaseMigration = require('../database/migrations');
const MigrationManager = require('../database/migrationManager');

describe('Database Connectivity Tests', () => {
  beforeAll(async () => {
    // Initialize database connection
    await initializeDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('Basic Connectivity', () => {
    test('should connect to Azure SQL Database successfully', async () => {
      // Test basic connectivity
      const result = await testConnection();
      expect(result).toBeDefined();
      expect(result.recordset).toBeDefined();
      expect(result.recordset[0].test).toBe(1);
    });

    test('should execute simple queries', async () => {
      const query = 'SELECT GETUTCDATE() as current_time, @@VERSION as version';
      const result = await executeQuery(query);
      
      expect(result).toBeDefined();
      expect(result.recordset).toBeDefined();
      expect(result.recordset.length).toBe(1);
      expect(result.recordset[0].current_time).toBeInstanceOf(Date);
      expect(result.recordset[0].version).toBeDefined();
    });

    test('should have active connection pool', () => {
      const stats = getPoolStatistics();
      expect(stats.connected).toBe(true);
      expect(typeof stats.totalConnections).toBe('number');
      expect(typeof stats.usedConnections).toBe('number');
      expect(typeof stats.freeConnections).toBe('number');
    });
  });

  describe('Database Schema Verification', () => {
    test('should have all required tables', async () => {
      const tablesQuery = `
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_TYPE = 'BASE TABLE'
        ORDER BY TABLE_NAME
      `;
      
      const result = await executeQuery(tablesQuery);
      const tableNames = result.recordset.map(row => row.TABLE_NAME);
      
      const requiredTables = ['Users', 'Sessions', 'OAuthTokens', 'DataExportRequests', 'AuditLog'];
      
      requiredTables.forEach(tableName => {
        expect(tableNames).toContain(tableName);
      });
    });

    test('should have proper table structures', async () => {
      // Test Users table structure
      const usersColumnsQuery = `
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'Users'
        ORDER BY ORDINAL_POSITION
      `;
      
      const result = await executeQuery(usersColumnsQuery);
      const columns = result.recordset;
      
      const requiredColumns = ['id', 'name', 'company', 'role', 'email', 'password_hash'];
      const columnNames = columns.map(col => col.COLUMN_NAME);
      
      requiredColumns.forEach(columnName => {
        expect(columnNames).toContain(columnName);
      });
      
      // Verify email column is unique
      const constraintsQuery = `
        SELECT CONSTRAINT_NAME, CONSTRAINT_TYPE
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
        WHERE TABLE_NAME = 'Users' AND CONSTRAINT_TYPE = 'UNIQUE'
      `;
      
      const constraintsResult = await executeQuery(constraintsQuery);
      expect(constraintsResult.recordset.length).toBeGreaterThan(0);
    });

    test('should have proper foreign key relationships', async () => {
      const foreignKeysQuery = `
        SELECT 
          fk.name as FK_NAME,
          tp.name as PARENT_TABLE,
          tr.name as REFERENCED_TABLE
        FROM sys.foreign_keys fk
        INNER JOIN sys.tables tp ON fk.parent_object_id = tp.object_id
        INNER JOIN sys.tables tr ON fk.referenced_object_id = tr.object_id
      `;
      
      const result = await executeQuery(foreignKeysQuery);
      const foreignKeys = result.recordset;
      
      // Should have foreign keys from Sessions to Users, OAuthTokens to Users, etc.
      const expectedRelationships = [
        { PARENT_TABLE: 'Sessions', REFERENCED_TABLE: 'Users' },
        { PARENT_TABLE: 'OAuthTokens', REFERENCED_TABLE: 'Users' },
        { PARENT_TABLE: 'DataExportRequests', REFERENCED_TABLE: 'Users' }
      ];
      
      expectedRelationships.forEach(relationship => {
        const found = foreignKeys.find(fk => 
          fk.PARENT_TABLE === relationship.PARENT_TABLE && 
          fk.REFERENCED_TABLE === relationship.REFERENCED_TABLE
        );
        expect(found).toBeDefined();
      });
    });

    test('should have performance indexes', async () => {
      const indexesQuery = `
        SELECT 
          i.name as INDEX_NAME,
          t.name as TABLE_NAME,
          i.type_desc as INDEX_TYPE
        FROM sys.indexes i
        INNER JOIN sys.tables t ON i.object_id = t.object_id
        WHERE i.name IS NOT NULL
        ORDER BY t.name, i.name
      `;
      
      const result = await executeQuery(indexesQuery);
      const indexes = result.recordset;
      
      // Should have indexes on frequently queried columns
      const expectedIndexes = ['IX_Users_Email', 'IX_Sessions_SessionId', 'IX_Sessions_UserId'];
      const indexNames = indexes.map(idx => idx.INDEX_NAME);
      
      expectedIndexes.forEach(indexName => {
        expect(indexNames).toContain(indexName);
      });
    });
  });

  describe('Migration System Tests', () => {
    test('should have migration system initialized', async () => {
      const migrationManager = new MigrationManager();
      await migrationManager.initializeMigrationSystem();
      
      // Check if MigrationHistory table exists
      const tableCheck = `
        SELECT COUNT(*) as table_count
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_NAME = 'MigrationHistory'
      `;
      
      const result = await executeQuery(tableCheck);
      expect(result.recordset[0].table_count).toBe(1);
    });

    test('should have executed initial migrations', async () => {
      const migrationManager = new MigrationManager();
      const status = await migrationManager.getMigrationStatus();
      
      expect(status.executed).toBeGreaterThan(0);
      expect(status.pending).toBe(0); // All migrations should be executed
      
      // Check for specific migrations
      const expectedMigrations = ['001_initial_schema', '002_indexes_and_triggers', '003_procedures_and_views'];
      expectedMigrations.forEach(migration => {
        expect(status.migrations.executed.some(m => m.name === migration)).toBe(true);
      });
    });

    test('should validate migration integrity', async () => {
      const migrationManager = new MigrationManager();
      const validation = await migrationManager.validateMigrationIntegrity();
      
      expect(validation.valid).toBe(true);
      expect(validation.issues.length).toBe(0);
    });
  });

  describe('Stored Procedures and Views', () => {
    test('should have cleanup procedures', async () => {
      const proceduresQuery = `
        SELECT ROUTINE_NAME
        FROM INFORMATION_SCHEMA.ROUTINES
        WHERE ROUTINE_TYPE = 'PROCEDURE'
      `;
      
      const result = await executeQuery(proceduresQuery);
      const procedures = result.recordset.map(row => row.ROUTINE_NAME);
      
      const expectedProcedures = ['CleanupExpiredSessions', 'CleanupExpiredDataExports', 'DatabaseMaintenance'];
      expectedProcedures.forEach(procName => {
        expect(procedures).toContain(procName);
      });
    });

    test('should have monitoring views', async () => {
      const viewsQuery = `
        SELECT TABLE_NAME
        FROM INFORMATION_SCHEMA.VIEWS
      `;
      
      const result = await executeQuery(viewsQuery);
      const views = result.recordset.map(row => row.TABLE_NAME);
      
      const expectedViews = ['ActiveUserSessions', 'UserStatistics', 'SessionStatistics', 'AuditLogSummary'];
      expectedViews.forEach(viewName => {
        expect(views).toContain(viewName);
      });
    });

    test('should be able to query monitoring views', async () => {
      // Test UserStatistics view
      const userStatsQuery = 'SELECT * FROM UserStatistics';
      const userStatsResult = await executeQuery(userStatsQuery);
      
      expect(userStatsResult.recordset).toBeDefined();
      expect(userStatsResult.recordset.length).toBe(1);
      expect(userStatsResult.recordset[0]).toHaveProperty('total_users');
      expect(userStatsResult.recordset[0]).toHaveProperty('verified_users');
      
      // Test SessionStatistics view
      const sessionStatsQuery = 'SELECT * FROM SessionStatistics';
      const sessionStatsResult = await executeQuery(sessionStatsQuery);
      
      expect(sessionStatsResult.recordset).toBeDefined();
      expect(sessionStatsResult.recordset.length).toBe(1);
      expect(sessionStatsResult.recordset[0]).toHaveProperty('total_sessions');
      expect(sessionStatsResult.recordset[0]).toHaveProperty('active_sessions');
    });

    test('should execute cleanup procedures', async () => {
      // Test session cleanup procedure
      const cleanupQuery = 'EXEC CleanupExpiredSessions';
      const result = await executeQuery(cleanupQuery);
      
      expect(result.recordset).toBeDefined();
      expect(result.recordset[0]).toHaveProperty('deleted_sessions');
      expect(typeof result.recordset[0].deleted_sessions).toBe('number');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid queries gracefully', async () => {
      await expect(executeQuery('SELECT * FROM NonExistentTable')).rejects.toThrow();
    });

    test('should handle connection pool exhaustion', async () => {
      // This test verifies the pool can handle multiple concurrent requests
      const promises = Array(5).fill().map((_, i) => 
        executeQuery(`SELECT ${i} as test_number, GETUTCDATE() as test_time`)
      );
      
      const results = await Promise.all(promises);
      
      expect(results.length).toBe(5);
      results.forEach((result, index) => {
        expect(result.recordset[0].test_number).toBe(index);
        expect(result.recordset[0].test_time).toBeInstanceOf(Date);
      });
    });

    test('should handle malformed queries', async () => {
      await expect(executeQuery('INVALID SQL SYNTAX')).rejects.toThrow();
      await expect(executeQuery('')).rejects.toThrow();
      await expect(executeQuery(null)).rejects.toThrow();
    });
  });

  describe('Performance Tests', () => {
    test('should execute queries within reasonable time', async () => {
      const startTime = Date.now();
      
      await executeQuery('SELECT COUNT(*) as total FROM Users');
      
      const executionTime = Date.now() - startTime;
      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should handle concurrent queries efficiently', async () => {
      const startTime = Date.now();
      
      const queries = [
        'SELECT COUNT(*) as users FROM Users',
        'SELECT COUNT(*) as sessions FROM Sessions',
        'SELECT COUNT(*) as oauth_tokens FROM OAuthTokens',
        'SELECT COUNT(*) as audit_logs FROM AuditLog',
        'SELECT COUNT(*) as export_requests FROM DataExportRequests'
      ];
      
      const promises = queries.map(query => executeQuery(query));
      const results = await Promise.all(promises);
      
      const totalTime = Date.now() - startTime;
      
      expect(results.length).toBe(5);
      expect(totalTime).toBeLessThan(10000); // All queries should complete within 10 seconds
      
      results.forEach(result => {
        expect(result.recordset).toBeDefined();
        expect(result.recordset.length).toBe(1);
      });
    });
  });
});
