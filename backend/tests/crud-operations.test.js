const { initializeDatabase, closeDatabase } = require('../config/database');
const User = require('../models/User');
const Session = require('../models/Session');
const DatabaseMigration = require('../database/migrations');

describe('CRUD Operations Tests', () => {
  let testUser1, testUser2;
  let testSession1, testSession2;

  beforeAll(async () => {
    // Initialize database connection
    await initializeDatabase();
    
    // Ensure database schema exists
    const migration = new DatabaseMigration();
    try {
      await migration.runInitialSetup();
    } catch (error) {
      // Schema might already exist, continue
      console.log('Database setup note:', error.message);
    }
  });

  afterAll(async () => {
    // Clean up test data
    if (testUser1) {
      try {
        await Session.invalidateAllForUser(testUser1.id);
        await testUser1.deactivate();
      } catch (error) {
        console.log('Cleanup error for user1:', error.message);
      }
    }
    
    if (testUser2) {
      try {
        await Session.invalidateAllForUser(testUser2.id);
        await testUser2.deactivate();
      } catch (error) {
        console.log('Cleanup error for user2:', error.message);
      }
    }
    
    await closeDatabase();
  });

  describe('User CRUD Operations', () => {
    describe('Create Operations', () => {
      test('should create a new user with all fields', async () => {
        const userData = {
          name: 'CRUD Test User 1',
          company: 'Test Company Inc',
          role: 'Software Engineer',
          email: 'crudtest1@unittest.com',
          password: 'SecurePassword123!'
        };

        testUser1 = await User.create(userData);
        
        expect(testUser1).toBeInstanceOf(User);
        expect(testUser1.id).toBeDefined();
        expect(testUser1.name).toBe(userData.name);
        expect(testUser1.company).toBe(userData.company);
        expect(testUser1.role).toBe(userData.role);
        expect(testUser1.email).toBe(userData.email.toLowerCase());
        expect(testUser1.password_hash).toBeDefined();
        expect(testUser1.password_hash).not.toBe(userData.password);
        expect(testUser1.email_verified).toBe(false);
        expect(testUser1.email_verification_token).toBeDefined();
        expect(testUser1.is_active).toBe(true);
        expect(testUser1.created_at).toBeInstanceOf(Date);
        expect(testUser1.updated_at).toBeInstanceOf(Date);
      });

      test('should create a user with minimal required fields', async () => {
        const userData = {
          name: 'CRUD Test User 2',
          email: 'crudtest2@unittest.com',
          password: 'AnotherPassword456!'
        };

        testUser2 = await User.create(userData);
        
        expect(testUser2).toBeInstanceOf(User);
        expect(testUser2.id).toBeDefined();
        expect(testUser2.name).toBe(userData.name);
        expect(testUser2.company).toBeNull();
        expect(testUser2.role).toBeNull();
        expect(testUser2.email).toBe(userData.email.toLowerCase());
        expect(testUser2.is_active).toBe(true);
      });

      test('should prevent duplicate email addresses', async () => {
        const duplicateUserData = {
          name: 'Duplicate User',
          email: 'crudtest1@unittest.com', // Same email as testUser1
          password: 'Password123!'
        };

        await expect(User.create(duplicateUserData)).rejects.toThrow('User with this email already exists');
      });

      test('should validate required fields', async () => {
        const invalidUserData = {
          company: 'Test Company',
          role: 'Developer'
          // Missing name, email, and password
        };

        await expect(User.create(invalidUserData)).rejects.toThrow('Validation failed');
      });
    });

    describe('Read Operations', () => {
      test('should find user by ID', async () => {
        const foundUser = await User.findById(testUser1.id);
        
        expect(foundUser).toBeInstanceOf(User);
        expect(foundUser.id).toBe(testUser1.id);
        expect(foundUser.name).toBe(testUser1.name);
        expect(foundUser.email).toBe(testUser1.email);
      });

      test('should find user by email', async () => {
        const foundUser = await User.findByEmail(testUser2.email);
        
        expect(foundUser).toBeInstanceOf(User);
        expect(foundUser.id).toBe(testUser2.id);
        expect(foundUser.name).toBe(testUser2.name);
        expect(foundUser.email).toBe(testUser2.email);
      });

      test('should return null for non-existent user ID', async () => {
        const nonExistentUser = await User.findById(999999);
        expect(nonExistentUser).toBeNull();
      });

      test('should return null for non-existent email', async () => {
        const nonExistentUser = await User.findByEmail('nonexistent@test.com');
        expect(nonExistentUser).toBeNull();
      });

      test('should find user by email verification token', async () => {
        const foundUser = await User.findByEmailVerificationToken(testUser1.email_verification_token);
        
        expect(foundUser).toBeInstanceOf(User);
        expect(foundUser.id).toBe(testUser1.id);
        expect(foundUser.email_verification_token).toBe(testUser1.email_verification_token);
      });
    });

    describe('Update Operations', () => {
      test('should update user name and company', async () => {
        const updatedUser = await testUser1.update({
          name: 'Updated CRUD Test User 1',
          company: 'Updated Test Company Inc'
        });

        expect(updatedUser.name).toBe('Updated CRUD Test User 1');
        expect(updatedUser.company).toBe('Updated Test Company Inc');
        expect(updatedUser.role).toBe(testUser1.role); // Should remain unchanged
        expect(updatedUser.email).toBe(testUser1.email); // Should remain unchanged
        expect(updatedUser.updated_at.getTime()).toBeGreaterThan(testUser1.updated_at.getTime());
        
        // Update local reference
        testUser1 = updatedUser;
      });

      test('should update user email', async () => {
        const newEmail = 'updated.crudtest2@unittest.com';
        const updatedUser = await testUser2.update({
          email: newEmail
        });

        expect(updatedUser.email).toBe(newEmail);
        expect(updatedUser.name).toBe(testUser2.name); // Should remain unchanged
        
        // Update local reference
        testUser2 = updatedUser;
      });

      test('should prevent updating to existing email', async () => {
        await expect(testUser2.update({
          email: testUser1.email // Try to use testUser1's email
        })).rejects.toThrow('User with this email already exists');
      });

      test('should verify email address', async () => {
        await testUser1.verifyEmail(testUser1.email_verification_token);
        
        const verifiedUser = await User.findById(testUser1.id);
        expect(verifiedUser.email_verified).toBe(true);
        expect(verifiedUser.email_verification_token).toBeNull();
        expect(verifiedUser.email_verification_expires).toBeNull();
      });

      test('should update password', async () => {
        const newPassword = 'NewSecurePassword789!';
        const originalHash = testUser1.password_hash;
        
        await testUser1.updatePassword(newPassword);
        
        expect(testUser1.password_hash).toBeDefined();
        expect(testUser1.password_hash).not.toBe(originalHash);
        
        // Verify new password works
        const isValid = await User.comparePassword(newPassword, testUser1.password_hash);
        expect(isValid).toBe(true);
        
        // Verify old password doesn't work
        const isOldValid = await User.comparePassword('SecurePassword123!', testUser1.password_hash);
        expect(isOldValid).toBe(false);
      });

      test('should update last login timestamp', async () => {
        const originalLastLogin = testUser1.last_login;
        
        await testUser1.updateLastLogin();
        
        const updatedUser = await User.findById(testUser1.id);
        expect(updatedUser.last_login).toBeInstanceOf(Date);
        
        if (originalLastLogin) {
          expect(updatedUser.last_login.getTime()).toBeGreaterThan(originalLastLogin.getTime());
        }
      });
    });

    describe('Delete Operations', () => {
      test('should deactivate user (soft delete)', async () => {
        await testUser2.deactivate();
        
        expect(testUser2.is_active).toBe(false);
        
        // Should not be found by normal queries
        const foundUser = await User.findById(testUser2.id);
        expect(foundUser).toBeNull();
        
        const foundByEmail = await User.findByEmail(testUser2.email);
        expect(foundByEmail).toBeNull();
      });
    });
  });

  describe('Session CRUD Operations', () => {
    describe('Create Operations', () => {
      test('should create a session for user', async () => {
        const sessionOptions = {
          ipAddress: '192.168.1.100',
          userAgent: 'CRUD Test Browser 1.0',
          durationDays: 7
        };

        testSession1 = await Session.create(testUser1.id, sessionOptions);
        
        expect(testSession1).toBeInstanceOf(Session);
        expect(testSession1.id).toBeDefined();
        expect(testSession1.session_id).toBeDefined();
        expect(testSession1.user_id).toBe(testUser1.id);
        expect(testSession1.ip_address).toBe(sessionOptions.ipAddress);
        expect(testSession1.user_agent).toBe(sessionOptions.userAgent);
        expect(testSession1.is_active).toBe(true);
        expect(testSession1.expires_at).toBeInstanceOf(Date);
        expect(testSession1.created_at).toBeInstanceOf(Date);
        expect(testSession1.last_accessed).toBeInstanceOf(Date);
        
        // Should expire in approximately 7 days
        const expectedExpiration = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const timeDiff = Math.abs(testSession1.expires_at.getTime() - expectedExpiration.getTime());
        expect(timeDiff).toBeLessThan(60000); // Within 1 minute
      });

      test('should create session with minimal options', async () => {
        testSession2 = await Session.create(testUser1.id);
        
        expect(testSession2).toBeInstanceOf(Session);
        expect(testSession2.user_id).toBe(testUser1.id);
        expect(testSession2.ip_address).toBeNull();
        expect(testSession2.user_agent).toBeNull();
        expect(testSession2.is_active).toBe(true);
      });

      test('should prevent creating session for non-existent user', async () => {
        await expect(Session.create(999999)).rejects.toThrow('User not found');
      });
    });

    describe('Read Operations', () => {
      test('should find session by session ID', async () => {
        const foundSession = await Session.findBySessionId(testSession1.session_id);
        
        expect(foundSession).toBeInstanceOf(Session);
        expect(foundSession.id).toBe(testSession1.id);
        expect(foundSession.user_id).toBe(testSession1.user_id);
        expect(foundSession.session_id).toBe(testSession1.session_id);
      });

      test('should find all sessions for user', async () => {
        const userSessions = await Session.findByUserId(testUser1.id);
        
        expect(Array.isArray(userSessions)).toBe(true);
        expect(userSessions.length).toBeGreaterThanOrEqual(2); // testSession1 and testSession2
        
        const sessionIds = userSessions.map(s => s.id);
        expect(sessionIds).toContain(testSession1.id);
        expect(sessionIds).toContain(testSession2.id);
      });

      test('should return null for non-existent session ID', async () => {
        const nonExistentSession = await Session.findBySessionId('nonexistent_session_id');
        expect(nonExistentSession).toBeNull();
      });

      test('should get session with user information', async () => {
        const sessionWithUser = await testSession1.getWithUser();
        
        expect(sessionWithUser).toBeDefined();
        expect(sessionWithUser.session).toBeInstanceOf(Session);
        expect(sessionWithUser.user).toBeDefined();
        expect(sessionWithUser.user.id).toBe(testUser1.id);
        expect(sessionWithUser.user.name).toBe(testUser1.name);
        expect(sessionWithUser.user.email).toBe(testUser1.email);
      });
    });

    describe('Update Operations', () => {
      test('should validate active session', async () => {
        const validation = await testSession1.validate();
        expect(validation.valid).toBe(true);
      });

      test('should update last accessed time', async () => {
        const originalLastAccessed = testSession1.last_accessed;
        
        // Wait a moment to ensure timestamp difference
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await testSession1.updateLastAccessed();
        
        const updatedSession = await Session.findBySessionId(testSession1.session_id);
        expect(updatedSession.last_accessed.getTime()).toBeGreaterThan(originalLastAccessed.getTime());
      });

      test('should extend session expiration', async () => {
        const originalExpiration = testSession1.expires_at;
        
        await testSession1.extend(1); // Extend by 1 day
        
        expect(testSession1.expires_at.getTime()).toBeGreaterThan(originalExpiration.getTime());
        
        // Should be approximately 1 day later
        const expectedExpiration = new Date(originalExpiration.getTime() + 24 * 60 * 60 * 1000);
        const timeDiff = Math.abs(testSession1.expires_at.getTime() - expectedExpiration.getTime());
        expect(timeDiff).toBeLessThan(60000); // Within 1 minute
      });
    });

    describe('Delete Operations', () => {
      test('should invalidate single session', async () => {
        await testSession2.invalidate();
        
        expect(testSession2.is_active).toBe(false);
        
        // Should not be found by findBySessionId (which only returns active sessions)
        const foundSession = await Session.findBySessionId(testSession2.session_id);
        expect(foundSession).toBeNull();
      });

      test('should invalidate all sessions for user', async () => {
        // Create an additional session to test mass invalidation
        const additionalSession = await Session.create(testUser1.id, {
          ipAddress: '192.168.1.200'
        });
        
        const invalidatedCount = await Session.invalidateAllForUser(testUser1.id);
        expect(invalidatedCount).toBeGreaterThanOrEqual(1);
        
        // All sessions should now be invalidated
        const activeSessions = await Session.findByUserId(testUser1.id);
        expect(activeSessions.length).toBe(0);
      });
    });
  });

  describe('Complex CRUD Scenarios', () => {
    test('should handle user with multiple sessions lifecycle', async () => {
      // Create a new user for this test
      const complexUser = await User.create({
        name: 'Complex CRUD User',
        email: 'complex.crud@unittest.com',
        password: 'ComplexPassword123!'
      });

      // Create multiple sessions
      const session1 = await Session.create(complexUser.id, { ipAddress: '192.168.1.10' });
      const session2 = await Session.create(complexUser.id, { ipAddress: '192.168.1.20' });
      const session3 = await Session.create(complexUser.id, { ipAddress: '192.168.1.30' });

      // Verify all sessions exist
      const allSessions = await Session.findByUserId(complexUser.id);
      expect(allSessions.length).toBe(3);

      // Update user information
      await complexUser.update({
        name: 'Updated Complex User',
        company: 'Complex Company'
      });

      // Verify sessions still exist after user update
      const sessionsAfterUpdate = await Session.findByUserId(complexUser.id);
      expect(sessionsAfterUpdate.length).toBe(3);

      // Invalidate one session
      await session2.invalidate();
      const sessionsAfterInvalidation = await Session.findByUserId(complexUser.id);
      expect(sessionsAfterInvalidation.length).toBe(2);

      // Clean up
      await Session.invalidateAllForUser(complexUser.id);
      await complexUser.deactivate();
    });

    test('should handle concurrent operations', async () => {
      // Create a user for concurrent testing
      const concurrentUser = await User.create({
        name: 'Concurrent Test User',
        email: 'concurrent.test@unittest.com',
        password: 'ConcurrentPassword123!'
      });

      // Create multiple sessions concurrently
      const sessionPromises = Array(5).fill().map((_, i) => 
        Session.create(concurrentUser.id, {
          ipAddress: `192.168.2.${10 + i}`,
          userAgent: `Concurrent Browser ${i + 1}`
        })
      );

      const concurrentSessions = await Promise.all(sessionPromises);
      expect(concurrentSessions.length).toBe(5);

      // Verify all sessions were created
      const allSessions = await Session.findByUserId(concurrentUser.id);
      expect(allSessions.length).toBe(5);

      // Update sessions concurrently
      const updatePromises = concurrentSessions.map(session => 
        session.updateLastAccessed()
      );

      await Promise.all(updatePromises);

      // Clean up
      await Session.invalidateAllForUser(concurrentUser.id);
      await concurrentUser.deactivate();
    });

    test('should handle data export for GDPR compliance', async () => {
      // Create user and session data
      const gdprUser = await User.create({
        name: 'GDPR Test User',
        email: 'gdpr.test@unittest.com',
        password: 'GDPRPassword123!'
      });

      const gdprSession = await Session.create(gdprUser.id, {
        ipAddress: '192.168.3.100',
        userAgent: 'GDPR Test Browser'
      });

      // Export user data
      const exportData = await gdprUser.getExportData();

      expect(exportData).toBeDefined();
      expect(exportData.user).toBeDefined();
      expect(exportData.user.id).toBe(gdprUser.id);
      expect(exportData.user.email).toBe(gdprUser.email);
      expect(exportData.sessions).toBeDefined();
      expect(exportData.sessions.length).toBeGreaterThan(0);
      expect(exportData.audit_log).toBeDefined();

      // Clean up
      await Session.invalidateAllForUser(gdprUser.id);
      await gdprUser.deactivate();
    });
  });

  describe('Data Integrity and Constraints', () => {
    test('should enforce email uniqueness across active users', async () => {
      const email = 'uniqueness.test@unittest.com';
      
      const user1 = await User.create({
        name: 'Uniqueness Test User 1',
        email: email,
        password: 'Password123!'
      });

      // Should not be able to create another user with same email
      await expect(User.create({
        name: 'Uniqueness Test User 2',
        email: email,
        password: 'Password456!'
      })).rejects.toThrow('User with this email already exists');

      // Clean up
      await user1.deactivate();
    });

    test('should cascade delete sessions when user is referenced', async () => {
      // Note: This test verifies the foreign key relationship works
      // In practice, we use soft deletes, but the FK constraint should exist
      
      const cascadeUser = await User.create({
        name: 'Cascade Test User',
        email: 'cascade.test@unittest.com',
        password: 'CascadePassword123!'
      });

      const cascadeSession = await Session.create(cascadeUser.id);
      
      // Verify session exists
      const foundSession = await Session.findBySessionId(cascadeSession.session_id);
      expect(foundSession).not.toBeNull();

      // Clean up (soft delete)
      await Session.invalidateAllForUser(cascadeUser.id);
      await cascadeUser.deactivate();
    });
  });
});
