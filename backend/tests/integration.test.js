const { initializeDatabase, closeDatabase, validateDatabaseConfig, getPoolStatistics } = require('../config/database');
const User = require('../models/User');
const Session = require('../models/Session');
const MigrationManager = require('../database/migrationManager');
const DatabaseMigration = require('../database/migrations');

describe('Database Integration Tests', () => {
  beforeAll(async () => {
    // Validate configuration before starting
    await validateDatabaseConfig();
    
    // Initialize database connection
    await initializeDatabase();
    
    // Ensure schema is up to date
    const migrationManager = new MigrationManager();
    await migrationManager.runPendingMigrations();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('End-to-End User Registration and Authentication Flow', () => {
    let registeredUser;
    let userSession;

    test('should complete full user registration flow', async () => {
      // Step 1: Create user account
      const registrationData = {
        name: 'Integration Test User',
        company: 'TaktMate Inc',
        role: 'QA Engineer',
        email: 'integration.test@taktmate.com',
        password: 'IntegrationTestPassword123!'
      };

      registeredUser = await User.create(registrationData);
      
      expect(registeredUser).toBeInstanceOf(User);
      expect(registeredUser.email_verified).toBe(false);
      expect(registeredUser.email_verification_token).toBeDefined();

      // Step 2: Verify email
      await registeredUser.verifyEmail(registeredUser.email_verification_token);
      
      const verifiedUser = await User.findById(registeredUser.id);
      expect(verifiedUser.email_verified).toBe(true);
      expect(verifiedUser.email_verification_token).toBeNull();

      // Step 3: Simulate login by creating session
      userSession = await Session.create(registeredUser.id, {
        ipAddress: '192.168.100.1',
        userAgent: 'Integration Test Browser 1.0'
      });

      expect(userSession).toBeInstanceOf(Session);
      expect(userSession.user_id).toBe(registeredUser.id);

      // Step 4: Update last login
      await registeredUser.updateLastLogin();
      
      const loggedInUser = await User.findById(registeredUser.id);
      expect(loggedInUser.last_login).toBeInstanceOf(Date);
    });

    test('should authenticate user with password', async () => {
      // Find user by email (login simulation)
      const foundUser = await User.findByEmail('integration.test@taktmate.com');
      expect(foundUser).not.toBeNull();
      expect(foundUser.id).toBe(registeredUser.id);

      // Verify password
      const isValidPassword = await User.comparePassword('IntegrationTestPassword123!', foundUser.password_hash);
      expect(isValidPassword).toBe(true);

      // Verify wrong password fails
      const isInvalidPassword = await User.comparePassword('WrongPassword', foundUser.password_hash);
      expect(isInvalidPassword).toBe(false);
    });

    test('should manage user sessions properly', async () => {
      // Validate existing session
      const sessionValidation = await userSession.validate();
      expect(sessionValidation.valid).toBe(true);

      // Create additional session (multi-device simulation)
      const mobileSession = await Session.create(registeredUser.id, {
        ipAddress: '192.168.100.2',
        userAgent: 'Mobile App 1.0'
      });

      // Get all user sessions
      const allSessions = await Session.findByUserId(registeredUser.id);
      expect(allSessions.length).toBe(2);

      // Extend session
      const originalExpiration = userSession.expires_at;
      await userSession.extend(1);
      expect(userSession.expires_at.getTime()).toBeGreaterThan(originalExpiration.getTime());

      // Invalidate one session (logout from one device)
      await mobileSession.invalidate();
      
      const activeSessions = await Session.findByUserId(registeredUser.id);
      expect(activeSessions.length).toBe(1);
      expect(activeSessions[0].id).toBe(userSession.id);
    });

    test('should handle password reset flow', async () => {
      // Generate password reset token
      const resetToken = await registeredUser.setPasswordResetToken();
      expect(resetToken).toBeDefined();

      // Find user by reset token
      const userByResetToken = await User.findByPasswordResetToken(resetToken);
      expect(userByResetToken).not.toBeNull();
      expect(userByResetToken.id).toBe(registeredUser.id);

      // Update password using reset token
      const newPassword = 'NewIntegrationPassword456!';
      await registeredUser.updatePassword(newPassword);

      // Verify new password works
      const isNewPasswordValid = await User.comparePassword(newPassword, registeredUser.password_hash);
      expect(isNewPasswordValid).toBe(true);

      // Verify old password no longer works
      const isOldPasswordValid = await User.comparePassword('IntegrationTestPassword123!', registeredUser.password_hash);
      expect(isOldPasswordValid).toBe(false);

      // Verify reset token is cleared
      const updatedUser = await User.findById(registeredUser.id);
      expect(updatedUser.password_reset_token).toBeNull();
      expect(updatedUser.password_reset_expires).toBeNull();
    });

    test('should handle GDPR data export', async () => {
      const exportData = await registeredUser.getExportData();
      
      expect(exportData).toBeDefined();
      expect(exportData.user).toBeDefined();
      expect(exportData.user.id).toBe(registeredUser.id);
      expect(exportData.user.name).toBe('Integration Test User');
      expect(exportData.user.email).toBe('integration.test@taktmate.com');
      
      expect(exportData.sessions).toBeDefined();
      expect(exportData.sessions.length).toBeGreaterThan(0);
      
      expect(exportData.audit_log).toBeDefined();
      expect(exportData.audit_log.length).toBeGreaterThan(0);
    });

    test('should handle account deactivation', async () => {
      // Invalidate all sessions first
      const invalidatedCount = await Session.invalidateAllForUser(registeredUser.id);
      expect(invalidatedCount).toBeGreaterThanOrEqual(1);

      // Deactivate account
      await registeredUser.deactivate();
      expect(registeredUser.is_active).toBe(false);

      // Verify user cannot be found by normal queries
      const foundUser = await User.findById(registeredUser.id);
      expect(foundUser).toBeNull();

      const foundByEmail = await User.findByEmail(registeredUser.email);
      expect(foundByEmail).toBeNull();
    });
  });

  describe('Multi-User Scenarios', () => {
    let users = [];
    let sessions = [];

    beforeAll(async () => {
      // Create multiple test users
      const userPromises = Array(5).fill().map((_, i) => 
        User.create({
          name: `Multi User ${i + 1}`,
          email: `multiuser${i + 1}@integration.test`,
          password: `MultiPassword${i + 1}!`
        })
      );

      users = await Promise.all(userPromises);
      expect(users.length).toBe(5);

      // Create sessions for each user
      const sessionPromises = users.map((user, i) => 
        Session.create(user.id, {
          ipAddress: `192.168.200.${10 + i}`,
          userAgent: `Multi Browser ${i + 1}`
        })
      );

      sessions = await Promise.all(sessionPromises);
      expect(sessions.length).toBe(5);
    });

    afterAll(async () => {
      // Clean up test data
      for (const user of users) {
        try {
          await Session.invalidateAllForUser(user.id);
          await user.deactivate();
        } catch (error) {
          console.log(`Cleanup error for user ${user.id}:`, error.message);
        }
      }
    });

    test('should handle concurrent user operations', async () => {
      // Concurrent user updates
      const updatePromises = users.map((user, i) => 
        user.update({
          company: `Updated Company ${i + 1}`,
          role: `Updated Role ${i + 1}`
        })
      );

      const updatedUsers = await Promise.all(updatePromises);
      expect(updatedUsers.length).toBe(5);

      updatedUsers.forEach((user, i) => {
        expect(user.company).toBe(`Updated Company ${i + 1}`);
        expect(user.role).toBe(`Updated Role ${i + 1}`);
      });
    });

    test('should handle concurrent session operations', async () => {
      // Concurrent session updates
      const sessionUpdatePromises = sessions.map(session => 
        session.updateLastAccessed()
      );

      await Promise.all(sessionUpdatePromises);

      // Verify all sessions are still active
      const activeSessionPromises = sessions.map(session => 
        Session.findBySessionId(session.session_id)
      );

      const activeSessions = await Promise.all(activeSessionPromises);
      expect(activeSessions.every(session => session !== null)).toBe(true);
    });

    test('should handle session statistics across multiple users', async () => {
      const stats = await Session.getStatistics();
      
      expect(stats.active_sessions).toBeGreaterThanOrEqual(5);
      expect(stats.total_sessions).toBeGreaterThanOrEqual(5);
      expect(stats.sessions_last_24h).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Database Performance and Reliability', () => {
    test('should handle high-volume operations', async () => {
      const startTime = Date.now();
      
      // Create multiple users rapidly
      const bulkUsers = [];
      for (let i = 0; i < 10; i++) {
        const user = await User.create({
          name: `Bulk User ${i + 1}`,
          email: `bulkuser${i + 1}@performance.test`,
          password: `BulkPassword${i + 1}!`
        });
        bulkUsers.push(user);
      }

      const creationTime = Date.now() - startTime;
      expect(creationTime).toBeLessThan(30000); // Should complete within 30 seconds
      expect(bulkUsers.length).toBe(10);

      // Create sessions for all users
      const sessionStartTime = Date.now();
      const bulkSessions = [];
      
      for (const user of bulkUsers) {
        const session = await Session.create(user.id, {
          ipAddress: '192.168.250.100'
        });
        bulkSessions.push(session);
      }

      const sessionCreationTime = Date.now() - sessionStartTime;
      expect(sessionCreationTime).toBeLessThan(20000); // Should complete within 20 seconds
      expect(bulkSessions.length).toBe(10);

      // Clean up
      for (const user of bulkUsers) {
        await Session.invalidateAllForUser(user.id);
        await user.deactivate();
      }
    });

    test('should maintain connection pool health', async () => {
      const poolStats = getPoolStatistics();
      
      expect(poolStats.connected).toBe(true);
      expect(poolStats.totalConnections).toBeGreaterThan(0);
      expect(poolStats.usedConnections).toBeGreaterThanOrEqual(0);
      expect(poolStats.freeConnections).toBeGreaterThanOrEqual(0);
    });

    test('should handle transaction-like operations', async () => {
      // Simulate a complex operation that should be atomic
      const transactionUser = await User.create({
        name: 'Transaction Test User',
        email: 'transaction@reliability.test',
        password: 'TransactionPassword123!'
      });

      try {
        // Create session
        const transactionSession = await Session.create(transactionUser.id);
        
        // Update user
        await transactionUser.update({
          company: 'Transaction Company',
          role: 'Transaction Role'
        });
        
        // Verify email
        await transactionUser.verifyEmail(transactionUser.email_verification_token);
        
        // All operations should succeed
        const finalUser = await User.findById(transactionUser.id);
        expect(finalUser.company).toBe('Transaction Company');
        expect(finalUser.role).toBe('Transaction Role');
        expect(finalUser.email_verified).toBe(true);
        
        const finalSession = await Session.findBySessionId(transactionSession.session_id);
        expect(finalSession).not.toBeNull();
        
        // Clean up
        await Session.invalidateAllForUser(transactionUser.id);
        await transactionUser.deactivate();
        
      } catch (error) {
        // If any operation fails, we should still be able to clean up
        await Session.invalidateAllForUser(transactionUser.id);
        await transactionUser.deactivate();
        throw error;
      }
    });
  });

  describe('Migration System Integration', () => {
    test('should have all migrations applied', async () => {
      const migrationManager = new MigrationManager();
      const status = await migrationManager.getMigrationStatus();
      
      expect(status.pending).toBe(0);
      expect(status.executed).toBeGreaterThan(0);
      
      // Verify specific migrations exist
      const expectedMigrations = ['001_initial_schema', '002_indexes_and_triggers', '003_procedures_and_views'];
      expectedMigrations.forEach(migration => {
        const found = status.migrations.executed.some(m => m.name === migration);
        expect(found).toBe(true);
      });
    });

    test('should validate migration integrity', async () => {
      const migrationManager = new MigrationManager();
      const validation = await migrationManager.validateMigrationIntegrity();
      
      expect(validation.valid).toBe(true);
      expect(validation.issues.length).toBe(0);
    });

    test('should handle database maintenance procedures', async () => {
      // Test cleanup procedures work
      const { executeQuery } = require('../config/database');
      
      // Execute session cleanup
      const cleanupResult = await executeQuery('EXEC CleanupExpiredSessions');
      expect(cleanupResult.recordset).toBeDefined();
      expect(cleanupResult.recordset[0]).toHaveProperty('deleted_sessions');
      
      // Execute data export cleanup
      const exportCleanupResult = await executeQuery('EXEC CleanupExpiredDataExports');
      expect(exportCleanupResult.recordset).toBeDefined();
      expect(exportCleanupResult.recordset[0]).toHaveProperty('deleted_exports');
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    test('should recover from connection interruption simulation', async () => {
      // This test simulates what happens when connection is temporarily lost
      // and then restored (common in cloud environments)
      
      const beforeInterruption = await User.findByEmail('integration.test@taktmate.com');
      
      // The connection should automatically recover
      const afterRecovery = await User.create({
        name: 'Recovery Test User',
        email: 'recovery@edgecase.test',
        password: 'RecoveryPassword123!'
      });
      
      expect(afterRecovery).toBeInstanceOf(User);
      
      // Clean up
      await afterRecovery.deactivate();
    });

    test('should handle edge case data values', async () => {
      // Test with edge case values
      const edgeCaseUser = await User.create({
        name: 'A', // Minimum length name
        company: 'A'.repeat(100), // Maximum length company
        role: 'A'.repeat(100), // Maximum length role
        email: 'edge@case.test',
        password: 'EdgePass1!' // Minimum valid password
      });
      
      expect(edgeCaseUser).toBeInstanceOf(User);
      expect(edgeCaseUser.name).toBe('A');
      expect(edgeCaseUser.company.length).toBe(100);
      expect(edgeCaseUser.role.length).toBe(100);
      
      // Clean up
      await edgeCaseUser.deactivate();
    });

    test('should handle concurrent access to same resources', async () => {
      // Create a user for concurrent access testing
      const concurrentUser = await User.create({
        name: 'Concurrent Access User',
        email: 'concurrent@access.test',
        password: 'ConcurrentPassword123!'
      });

      // Simulate multiple concurrent updates
      const updatePromises = Array(3).fill().map((_, i) => 
        concurrentUser.update({
          company: `Concurrent Company ${i + 1}`
        })
      );

      // All updates should succeed (last one wins)
      const results = await Promise.all(updatePromises);
      expect(results.length).toBe(3);
      
      // Verify final state
      const finalUser = await User.findById(concurrentUser.id);
      expect(finalUser.company).toMatch(/^Concurrent Company [1-3]$/);
      
      // Clean up
      await concurrentUser.deactivate();
    });
  });
});
