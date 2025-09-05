// Security tests for Session Management
// Tests comprehensive session security, hijacking prevention, and lifecycle management

const { SessionManagementService } = require('../../middleware/sessionManagement');

// Mock external dependencies
jest.mock('../../config/applicationInsights', () => ({
  telemetry: {
    trackEvent: jest.fn(),
    trackException: jest.fn(),
    trackDependency: jest.fn()
  }
}));

describe('Session Management Security Tests', () => {
  let sessionManagement;
  let mockAppInsights;
  let mockFileStore;

  beforeEach(() => {
    mockAppInsights = {
      telemetry: {
        trackEvent: jest.fn(),
        trackException: jest.fn(),
        trackDependency: jest.fn()
      }
    };

    mockFileStore = {
      getUserFiles: jest.fn().mockResolvedValue([]),
      deleteFile: jest.fn().mockResolvedValue(true),
      cleanupUserFiles: jest.fn().mockResolvedValue({ deleted: 0 })
    };

    sessionManagement = new SessionManagementService(mockAppInsights, mockFileStore);
  });

  afterEach(() => {
    jest.clearAllMocks();
    sessionManagement.clearAllSessions(); // Clean up sessions between tests
  });

  describe('Session Creation Security', () => {
    test('should generate cryptographically secure session IDs', async () => {
      const sessionIds = new Set();
      
      // Generate multiple session IDs
      for (let i = 0; i < 1000; i++) {
        const session = await sessionManagement.createSession({
          userId: `user-${i}`,
          userAgent: 'Test-Agent',
          ipAddress: '192.168.1.1'
        });
        sessionIds.add(session.sessionId);
      }
      
      // All session IDs should be unique
      expect(sessionIds.size).toBe(1000);
      
      // Session IDs should be sufficiently long and random
      const sessionIdArray = Array.from(sessionIds);
      sessionIdArray.forEach(sessionId => {
        expect(sessionId).toMatch(/^[a-f0-9]{64}$/); // 64 character hex string
        expect(sessionId.length).toBe(64);
      });
    });

    test('should create session with secure fingerprint', async () => {
      const sessionData = {
        userId: 'test-user-123',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ipAddress: '192.168.1.100',
        acceptLanguage: 'en-US,en;q=0.9',
        acceptEncoding: 'gzip, deflate, br'
      };

      const session = await sessionManagement.createSession(sessionData);
      
      expect(session).toHaveProperty('sessionId');
      expect(session).toHaveProperty('fingerprint');
      expect(session).toHaveProperty('createdAt');
      expect(session).toHaveProperty('lastActivity');
      expect(session.fingerprint).toMatch(/^[a-f0-9]+$/); // Hex fingerprint
      expect(session.fingerprint.length).toBeGreaterThan(32);
    });

    test('should reject session creation with missing critical data', async () => {
      const invalidSessionData = [
        {}, // Empty data
        { userId: 'test-user' }, // Missing userAgent and IP
        { userAgent: 'Test-Agent' }, // Missing userId and IP
        { ipAddress: '192.168.1.1' }, // Missing userId and userAgent
        { userId: null, userAgent: 'Test', ipAddress: '192.168.1.1' }, // Null userId
        { userId: '', userAgent: 'Test', ipAddress: '192.168.1.1' } // Empty userId
      ];

      for (const data of invalidSessionData) {
        try {
          await sessionManagement.createSession(data);
          fail(`Should have rejected invalid session data: ${JSON.stringify(data)}`);
        } catch (error) {
          expect(error.message).toContain('Invalid session data');
        }
      }
    });
  });

  describe('Session Hijacking Prevention', () => {
    test('should detect session hijacking via fingerprint mismatch', async () => {
      // Create initial session
      const originalSession = await sessionManagement.createSession({
        userId: 'test-user-123',
        userAgent: 'Original-Browser/1.0',
        ipAddress: '192.168.1.100'
      });

      // Attempt to use session from different browser/IP
      const hijackAttempt = await sessionManagement.validateSession(originalSession.sessionId, {
        userAgent: 'Malicious-Browser/2.0', // Different user agent
        ipAddress: '10.0.0.1' // Different IP address
      });

      expect(hijackAttempt.valid).toBe(false);
      expect(hijackAttempt.reason).toContain('Fingerprint mismatch');
      
      // Should log security event
      expect(mockAppInsights.telemetry.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'SessionHijackingAttempt',
          properties: expect.objectContaining({
            sessionId: originalSession.sessionId,
            reason: 'Fingerprint mismatch'
          })
        })
      );
    });

    test('should allow minor fingerprint changes (same user, updated browser)', async () => {
      const originalSession = await sessionManagement.createSession({
        userId: 'test-user-123',
        userAgent: 'Browser/1.0.0',
        ipAddress: '192.168.1.100'
      });

      // Minor user agent change (browser update)
      const minorChange = await sessionManagement.validateSession(originalSession.sessionId, {
        userAgent: 'Browser/1.0.1', // Minor version update
        ipAddress: '192.168.1.100' // Same IP
      });

      expect(minorChange.valid).toBe(true);
    });

    test('should detect concurrent session abuse', async () => {
      const session = await sessionManagement.createSession({
        userId: 'test-user-123',
        userAgent: 'Test-Browser/1.0',
        ipAddress: '192.168.1.100'
      });

      // Simulate many concurrent requests from same session
      const concurrentRequests = [];
      for (let i = 0; i < 50; i++) {
        concurrentRequests.push(
          sessionManagement.validateSession(session.sessionId, {
            userAgent: 'Test-Browser/1.0',
            ipAddress: '192.168.1.100'
          })
        );
      }

      const results = await Promise.all(concurrentRequests);
      const blockedRequests = results.filter(r => !r.valid && r.reason.includes('Concurrent abuse'));
      
      expect(blockedRequests.length).toBeGreaterThan(0);
    });

    test('should implement IP address change detection', async () => {
      const session = await sessionManagement.createSession({
        userId: 'test-user-123',
        userAgent: 'Test-Browser/1.0',
        ipAddress: '192.168.1.100'
      });

      // Sudden IP change to different network
      const ipChangeValidation = await sessionManagement.validateSession(session.sessionId, {
        userAgent: 'Test-Browser/1.0',
        ipAddress: '10.0.0.1' // Completely different network
      });

      expect(ipChangeValidation.valid).toBe(false);
      expect(ipChangeValidation.reason).toContain('Suspicious IP change');
    });

    test('should allow legitimate IP changes within same network', async () => {
      const session = await sessionManagement.createSession({
        userId: 'test-user-123',
        userAgent: 'Test-Browser/1.0',
        ipAddress: '192.168.1.100'
      });

      // IP change within same subnet (WiFi to Ethernet)
      const sameNetworkValidation = await sessionManagement.validateSession(session.sessionId, {
        userAgent: 'Test-Browser/1.0',
        ipAddress: '192.168.1.101' // Same subnet
      });

      expect(sameNetworkValidation.valid).toBe(true);
    });
  });

  describe('Session Lifecycle Security', () => {
    test('should enforce session timeout', async () => {
      const shortTimeoutSession = await sessionManagement.createSession({
        userId: 'test-user-123',
        userAgent: 'Test-Browser/1.0',
        ipAddress: '192.168.1.100'
      }, { timeout: 1000 }); // 1 second timeout

      // Wait for session to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      const validation = await sessionManagement.validateSession(shortTimeoutSession.sessionId, {
        userAgent: 'Test-Browser/1.0',
        ipAddress: '192.168.1.100'
      });

      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('Session expired');
    });

    test('should enforce inactivity timeout', async () => {
      const session = await sessionManagement.createSession({
        userId: 'test-user-123',
        userAgent: 'Test-Browser/1.0',
        ipAddress: '192.168.1.100'
      }, { inactivityTimeout: 500 }); // 500ms inactivity timeout

      // Wait for inactivity timeout
      await new Promise(resolve => setTimeout(resolve, 600));

      const validation = await sessionManagement.validateSession(session.sessionId, {
        userAgent: 'Test-Browser/1.0',
        ipAddress: '192.168.1.100'
      });

      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('Inactivity timeout');
    });

    test('should extend session on activity', async () => {
      const session = await sessionManagement.createSession({
        userId: 'test-user-123',
        userAgent: 'Test-Browser/1.0',
        ipAddress: '192.168.1.100'
      }, { inactivityTimeout: 1000 });

      // Activity before timeout
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const validation1 = await sessionManagement.validateSession(session.sessionId, {
        userAgent: 'Test-Browser/1.0',
        ipAddress: '192.168.1.100'
      });
      expect(validation1.valid).toBe(true);

      // Wait again, but less than timeout from last activity
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const validation2 = await sessionManagement.validateSession(session.sessionId, {
        userAgent: 'Test-Browser/1.0',
        ipAddress: '192.168.1.100'
      });
      expect(validation2.valid).toBe(true);
    });

    test('should cleanup expired sessions automatically', async () => {
      // Create multiple sessions with short timeouts
      const sessions = [];
      for (let i = 0; i < 5; i++) {
        const session = await sessionManagement.createSession({
          userId: `test-user-${i}`,
          userAgent: 'Test-Browser/1.0',
          ipAddress: '192.168.1.100'
        }, { timeout: 100 }); // Very short timeout
        sessions.push(session);
      }

      // Wait for sessions to expire
      await new Promise(resolve => setTimeout(resolve, 200));

      // Trigger cleanup
      const cleanupResult = await sessionManagement.cleanupExpiredSessions();
      
      expect(cleanupResult.cleaned).toBe(5);
      expect(mockFileStore.cleanupUserFiles).toHaveBeenCalledTimes(5);
    });
  });

  describe('Session Storage Security', () => {
    test('should encrypt sensitive session data', async () => {
      const sensitiveData = {
        userId: 'test-user-123',
        userAgent: 'Test-Browser/1.0',
        ipAddress: '192.168.1.100',
        sensitiveInfo: 'secret-data-123'
      };

      const session = await sessionManagement.createSession(sensitiveData);
      
      // Get raw session data
      const rawSessionData = sessionManagement.getRawSessionData(session.sessionId);
      
      // Sensitive data should be encrypted
      expect(rawSessionData.encryptedData).toBeDefined();
      expect(rawSessionData.encryptedData).not.toContain('secret-data-123');
      expect(rawSessionData.encryptedData).not.toContain('test-user-123');
    });

    test('should prevent session data tampering', async () => {
      const session = await sessionManagement.createSession({
        userId: 'test-user-123',
        userAgent: 'Test-Browser/1.0',
        ipAddress: '192.168.1.100'
      });

      // Attempt to tamper with session data
      try {
        sessionManagement.tamperWithSession(session.sessionId, {
          userId: 'malicious-user'
        });
        fail('Should not allow session tampering');
      } catch (error) {
        expect(error.message).toContain('Session tampering detected');
      }
    });

    test('should validate session integrity', async () => {
      const session = await sessionManagement.createSession({
        userId: 'test-user-123',
        userAgent: 'Test-Browser/1.0',
        ipAddress: '192.168.1.100'
      });

      // Corrupt session data
      sessionManagement.corruptSessionData(session.sessionId);

      const validation = await sessionManagement.validateSession(session.sessionId, {
        userAgent: 'Test-Browser/1.0',
        ipAddress: '192.168.1.100'
      });

      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('Session integrity check failed');
    });
  });

  describe('Session Fixation Prevention', () => {
    test('should regenerate session ID on privilege escalation', async () => {
      const session = await sessionManagement.createSession({
        userId: 'test-user-123',
        userAgent: 'Test-Browser/1.0',
        ipAddress: '192.168.1.100',
        role: 'user'
      });

      const originalSessionId = session.sessionId;

      // Simulate privilege escalation (user becomes admin)
      const newSession = await sessionManagement.regenerateSession(originalSessionId, {
        role: 'admin'
      });

      expect(newSession.sessionId).not.toBe(originalSessionId);
      expect(newSession.userId).toBe('test-user-123');
      expect(newSession.role).toBe('admin');

      // Old session should be invalid
      const oldValidation = await sessionManagement.validateSession(originalSessionId, {
        userAgent: 'Test-Browser/1.0',
        ipAddress: '192.168.1.100'
      });
      expect(oldValidation.valid).toBe(false);
    });

    test('should prevent session fixation attacks', async () => {
      // Attacker tries to fix a session ID
      const attackerSessionId = 'attacker-controlled-session-id-123';
      
      try {
        await sessionManagement.createSessionWithId(attackerSessionId, {
          userId: 'victim-user',
          userAgent: 'Victim-Browser/1.0',
          ipAddress: '192.168.1.200'
        });
        fail('Should not allow attacker-controlled session IDs');
      } catch (error) {
        expect(error.message).toContain('Session ID cannot be specified');
      }
    });
  });

  describe('Multi-User Session Security', () => {
    test('should isolate sessions between different users', async () => {
      const user1Session = await sessionManagement.createSession({
        userId: 'user-1',
        userAgent: 'Browser/1.0',
        ipAddress: '192.168.1.100'
      });

      const user2Session = await sessionManagement.createSession({
        userId: 'user-2',
        userAgent: 'Browser/1.0',
        ipAddress: '192.168.1.101'
      });

      // User 1 should not be able to access User 2's session data
      const crossUserAccess = await sessionManagement.getSessionData(user2Session.sessionId, {
        requestingUserId: 'user-1'
      });

      expect(crossUserAccess).toBeNull();
      
      // Should log unauthorized access attempt
      expect(mockAppInsights.telemetry.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'UnauthorizedSessionAccess',
          properties: expect.objectContaining({
            requestingUserId: 'user-1',
            targetSessionId: user2Session.sessionId
          })
        })
      );
    });

    test('should prevent session enumeration attacks', async () => {
      // Create some sessions
      const sessions = [];
      for (let i = 0; i < 5; i++) {
        const session = await sessionManagement.createSession({
          userId: `user-${i}`,
          userAgent: 'Browser/1.0',
          ipAddress: `192.168.1.${100 + i}`
        });
        sessions.push(session);
      }

      // Attempt to enumerate sessions
      const enumerationAttempts = [];
      for (let i = 0; i < 100; i++) {
        const guessedSessionId = `session-${i}`;
        enumerationAttempts.push(
          sessionManagement.validateSession(guessedSessionId, {
            userAgent: 'Attacker-Browser/1.0',
            ipAddress: '10.0.0.1'
          })
        );
      }

      const results = await Promise.all(enumerationAttempts);
      
      // Should detect enumeration pattern
      const lastResult = results[results.length - 1];
      expect(lastResult.valid).toBe(false);
      expect(lastResult.reason).toContain('Session enumeration detected');
    });
  });

  describe('Session Security Headers and Cookies', () => {
    test('should generate secure session cookies', async () => {
      const session = await sessionManagement.createSession({
        userId: 'test-user-123',
        userAgent: 'Browser/1.0',
        ipAddress: '192.168.1.100'
      });

      const cookieOptions = sessionManagement.getSessionCookieOptions(session.sessionId);
      
      expect(cookieOptions).toHaveProperty('httpOnly', true);
      expect(cookieOptions).toHaveProperty('secure', true);
      expect(cookieOptions).toHaveProperty('sameSite', 'strict');
      expect(cookieOptions).toHaveProperty('maxAge');
      expect(cookieOptions.maxAge).toBeGreaterThan(0);
    });

    test('should implement proper CSRF protection for sessions', async () => {
      const session = await sessionManagement.createSession({
        userId: 'test-user-123',
        userAgent: 'Browser/1.0',
        ipAddress: '192.168.1.100'
      });

      const csrfToken = sessionManagement.generateCSRFToken(session.sessionId);
      expect(csrfToken).toBeDefined();
      expect(csrfToken).toMatch(/^[a-f0-9]+$/);
      expect(csrfToken.length).toBeGreaterThan(32);

      // Validate CSRF token
      const isValidCSRF = sessionManagement.validateCSRFToken(session.sessionId, csrfToken);
      expect(isValidCSRF).toBe(true);

      // Invalid CSRF token should be rejected
      const invalidCSRF = sessionManagement.validateCSRFToken(session.sessionId, 'invalid-token');
      expect(invalidCSRF).toBe(false);
    });
  });

  describe('Session Monitoring and Alerting', () => {
    test('should track session security events', async () => {
      const session = await sessionManagement.createSession({
        userId: 'test-user-123',
        userAgent: 'Browser/1.0',
        ipAddress: '192.168.1.100'
      });

      // Simulate various security events
      await sessionManagement.validateSession('invalid-session-id', {
        userAgent: 'Browser/1.0',
        ipAddress: '192.168.1.100'
      });

      await sessionManagement.validateSession(session.sessionId, {
        userAgent: 'Different-Browser/2.0',
        ipAddress: '10.0.0.1'
      });

      // Should have tracked security events
      expect(mockAppInsights.telemetry.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'InvalidSessionAccess'
        })
      );

      expect(mockAppInsights.telemetry.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'SessionHijackingAttempt'
        })
      );
    });

    test('should generate security alerts for critical events', async () => {
      // Simulate multiple failed session validations (potential attack)
      const attackerIP = '10.0.0.1';
      for (let i = 0; i < 10; i++) {
        await sessionManagement.validateSession(`fake-session-${i}`, {
          userAgent: 'Attacker-Browser/1.0',
          ipAddress: attackerIP
        });
      }

      // Should trigger security alert
      expect(mockAppInsights.telemetry.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'SecurityAlert',
          properties: expect.objectContaining({
            alertType: 'MultipleFailedSessionValidations',
            sourceIP: attackerIP
          })
        })
      );
    });
  });
});
