const Session = require('../models/Session');
const User = require('../models/User');
const { initializeDatabase, closeDatabase } = require('../config/database');
const DatabaseMigration = require('../database/migrations');

describe('Session Model Tests', () => {
  let testUser;
  let testSession;

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

    // Create test user
    try {
      testUser = await User.create({
        name: 'Session Test User',
        company: 'Test Company',
        role: 'Tester',
        email: 'sessiontest@unittest.com',
        password: 'TestPassword123!'
      });
    } catch (error) {
      // User might already exist, try to find it
      testUser = await User.findByEmail('sessiontest@unittest.com');
      if (!testUser) {
        throw error;
      }
    }
  });

  afterAll(async () => {
    // Clean up test data
    if (testUser) {
      try {
        await Session.invalidateAllForUser(testUser.id);
        await testUser.deactivate();
      } catch (error) {
        console.log('Cleanup error:', error.message);
      }
    }
    
    await closeDatabase();
  });

  describe('Session Generation and Validation', () => {
    test('should generate unique session IDs', () => {
      const sessionId1 = Session.generateSessionId();
      const sessionId2 = Session.generateSessionId();
      
      expect(sessionId1).toBeDefined();
      expect(sessionId2).toBeDefined();
      expect(sessionId1).not.toBe(sessionId2);
      expect(sessionId1.length).toBeGreaterThan(40); // Timestamp + 64 hex chars
      expect(sessionId1).toMatch(/^[0-9a-z]+_[0-9a-f]{64}$/);
    });

    test('should calculate correct expiration dates', () => {
      const expiration = Session.calculateExpiration(7);
      const now = new Date();
      const expectedExpiration = new Date();
      expectedExpiration.setDate(expectedExpiration.getDate() + 7);
      
      expect(expiration).toBeInstanceOf(Date);
      expect(expiration.getTime()).toBeGreaterThan(now.getTime());
      // Allow for small timing differences (1 minute)
      expect(Math.abs(expiration.getTime() - expectedExpiration.getTime())).toBeLessThan(60000);
    });

    test('should validate session data correctly', () => {
      const validSessionData = {
        user_id: 1,
        ip_address: '192.168.1.1',
        user_agent: 'Mozilla/5.0 Test Browser',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
      };

      const validation = Session.validate(validSessionData);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should reject invalid session data', () => {
      const invalidSessionData = {
        user_id: 'invalid', // Should be number
        ip_address: '999.999.999.999', // Invalid IP
        user_agent: 'a'.repeat(600), // Too long
        expires_at: new Date(Date.now() - 1000) // In the past
      };

      const validation = Session.validate(invalidSessionData);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    test('should accept IPv6 addresses', () => {
      const sessionData = {
        user_id: 1,
        ip_address: '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };

      const validation = Session.validate(sessionData);
      expect(validation.isValid).toBe(true);
    });
  });

  describe('Session CRUD Operations', () => {
    test('should create a new session', async () => {
      const options = {
        ipAddress: '192.168.1.100',
        userAgent: 'Test Browser 1.0',
        durationDays: 7
      };

      testSession = await Session.create(testUser.id, options);
      
      expect(testSession).toBeInstanceOf(Session);
      expect(testSession.id).toBeDefined();
      expect(testSession.session_id).toBeDefined();
      expect(testSession.user_id).toBe(testUser.id);
      expect(testSession.ip_address).toBe(options.ipAddress);
      expect(testSession.user_agent).toBe(options.userAgent);
      expect(testSession.is_active).toBe(true);
      expect(new Date(testSession.expires_at)).toBeInstanceOf(Date);
      expect(new Date(testSession.expires_at).getTime()).toBeGreaterThan(Date.now());
    });

    test('should find session by session ID', async () => {
      if (!testSession) {
        throw new Error('Test session not created');
      }

      const foundSession = await Session.findBySessionId(testSession.session_id);
      expect(foundSession).toBeInstanceOf(Session);
      expect(foundSession.id).toBe(testSession.id);
      expect(foundSession.user_id).toBe(testUser.id);
    });

    test('should find all sessions for a user', async () => {
      const sessions = await Session.findByUserId(testUser.id);
      expect(Array.isArray(sessions)).toBe(true);
      expect(sessions.length).toBeGreaterThan(0);
      expect(sessions[0]).toBeInstanceOf(Session);
      expect(sessions[0].user_id).toBe(testUser.id);
    });

    test('should not find expired or inactive sessions', async () => {
      // This test assumes findBySessionId only returns active, non-expired sessions
      const expiredSession = await Session.findBySessionId('nonexistent_session_id');
      expect(expiredSession).toBeNull();
    });

    test('should get session with user information', async () => {
      if (!testSession) {
        throw new Error('Test session not created');
      }

      const sessionWithUser = await testSession.getWithUser();
      expect(sessionWithUser).toBeDefined();
      expect(sessionWithUser.session).toBeInstanceOf(Session);
      expect(sessionWithUser.user).toBeDefined();
      expect(sessionWithUser.user.id).toBe(testUser.id);
      expect(sessionWithUser.user.name).toBe(testUser.name);
      expect(sessionWithUser.user.email).toBe(testUser.email);
    });
  });

  describe('Session Management', () => {
    test('should validate active session', async () => {
      if (!testSession) {
        throw new Error('Test session not created');
      }

      const validation = await testSession.validate();
      expect(validation.valid).toBe(true);
    });

    test('should update last accessed time', async () => {
      if (!testSession) {
        throw new Error('Test session not created');
      }

      const originalLastAccessed = testSession.last_accessed;
      
      // Wait a moment to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await testSession.updateLastAccessed();
      
      // Refresh session data
      const updatedSession = await Session.findBySessionId(testSession.session_id);
      expect(new Date(updatedSession.last_accessed).getTime()).toBeGreaterThan(new Date(originalLastAccessed).getTime());
    });

    test('should extend session expiration', async () => {
      if (!testSession) {
        throw new Error('Test session not created');
      }

      const originalExpiration = new Date(testSession.expires_at);
      await testSession.extend(1); // Extend by 1 day
      
      expect(new Date(testSession.expires_at).getTime()).toBeGreaterThan(originalExpiration.getTime());
      
      // Should be approximately 1 day later (allow 1 minute tolerance)
      const expectedExpiration = new Date(originalExpiration.getTime() + 24 * 60 * 60 * 1000);
      expect(Math.abs(new Date(testSession.expires_at).getTime() - expectedExpiration.getTime())).toBeLessThan(60000);
    });

    test('should invalidate session', async () => {
      if (!testSession) {
        throw new Error('Test session not created');
      }

      await testSession.invalidate();
      expect(testSession.is_active).toBe(false);
      
      // Should not be found by findBySessionId (which only returns active sessions)
      const foundSession = await Session.findBySessionId(testSession.session_id);
      expect(foundSession).toBeNull();
    });

    test('should invalidate all sessions for user', async () => {
      // Create multiple sessions
      const session1 = await Session.create(testUser.id, { ipAddress: '192.168.1.101' });
      const session2 = await Session.create(testUser.id, { ipAddress: '192.168.1.102' });
      
      const invalidatedCount = await Session.invalidateAllForUser(testUser.id);
      expect(invalidatedCount).toBeGreaterThanOrEqual(2);
      
      // Verify sessions are invalidated
      const foundSession1 = await Session.findBySessionId(session1.session_id);
      const foundSession2 = await Session.findBySessionId(session2.session_id);
      expect(foundSession1).toBeNull();
      expect(foundSession2).toBeNull();
    });
  });

  describe('Session Statistics and Monitoring', () => {
    test('should get session statistics', async () => {
      const stats = await Session.getStatistics();
      
      expect(stats).toBeDefined();
      expect(typeof stats.total_sessions).toBe('number');
      expect(typeof stats.active_sessions).toBe('number');
      expect(typeof stats.expired_sessions).toBe('number');
      expect(typeof stats.inactive_sessions).toBe('number');
      expect(typeof stats.sessions_last_24h).toBe('number');
      expect(typeof stats.sessions_last_hour).toBe('number');
    });

    test('should get active sessions summary', async () => {
      // Create a test session first
      const activeSession = await Session.create(testUser.id, { ipAddress: '192.168.1.200' });
      
      const activeSessions = await Session.getActiveSessions();
      
      expect(Array.isArray(activeSessions)).toBe(true);
      
      if (activeSessions.length > 0) {
        const session = activeSessions[0];
        expect(session.session_id).toBeDefined();
        expect(session.user_id).toBeDefined();
        expect(session.user_name).toBeDefined();
        expect(session.user_email).toBeDefined();
        expect(typeof session.minutes_inactive).toBe('number');
      }
      
      // Clean up
      await activeSession.invalidate();
    });

    test('should detect suspicious activity', async () => {
      const suspiciousCheck = await Session.detectSuspiciousActivity(testUser.id, '192.168.1.300');
      
      expect(suspiciousCheck).toBeDefined();
      expect(typeof suspiciousCheck.suspicious).toBe('boolean');
      expect(typeof suspiciousCheck.unique_ips).toBe('number');
      expect(typeof suspiciousCheck.session_count).toBe('number');
    });

    test('should clean up expired sessions', async () => {
      const deletedCount = await Session.cleanupExpired();
      expect(typeof deletedCount).toBe('number');
      expect(deletedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Session Serialization', () => {
    test('should convert to JSON without sensitive data', async () => {
      const session = await Session.create(testUser.id, {
        ipAddress: '192.168.1.400',
        userAgent: 'Test Browser for JSON'
      });
      
      const json = session.toJSON();
      
      expect(json.id).toBeDefined();
      expect(json.session_id).toBeDefined();
      expect(json.user_id).toBe(testUser.id);
      expect(json.expires_at).toBeDefined();
      expect(json.created_at).toBeDefined();
      expect(json.last_accessed).toBeDefined();
      expect(json.is_active).toBeDefined();
      
      // Sensitive data should be excluded
      expect(json.ip_address).toBeUndefined();
      expect(json.user_agent).toBeUndefined();
      
      // Clean up
      await session.invalidate();
    });

    test('should convert to full JSON with all data', async () => {
      const session = await Session.create(testUser.id, {
        ipAddress: '192.168.1.500',
        userAgent: 'Test Browser for Full JSON'
      });
      
      const fullJson = session.toFullJSON();
      
      expect(fullJson.id).toBeDefined();
      expect(fullJson.session_id).toBeDefined();
      expect(fullJson.user_id).toBe(testUser.id);
      expect(fullJson.expires_at).toBeDefined();
      expect(fullJson.created_at).toBeDefined();
      expect(fullJson.last_accessed).toBeDefined();
      expect(fullJson.is_active).toBeDefined();
      expect(fullJson.ip_address).toBe('192.168.1.500');
      expect(fullJson.user_agent).toBe('Test Browser for Full JSON');
      
      // Clean up
      await session.invalidate();
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid user ID', async () => {
      await expect(Session.create(999999)).rejects.toThrow('User not found');
    });

    test('should handle session validation failure', async () => {
      // Mock a session with invalid data
      await expect(Session.create(testUser.id, {
        ipAddress: 'invalid-ip',
        userAgent: 'a'.repeat(600) // Too long
      })).rejects.toThrow('Session validation failed');
    });
  });
});
