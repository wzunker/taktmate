const request = require('supertest');
const express = require('express');
const session = require('express-session');
const { initializeDatabase, closeDatabase } = require('../config/database');
const authRoutes = require('../routes/auth');
const User = require('../models/User');
const Session = require('../models/Session');
const SecurityUtils = require('../utils/security');
const DatabaseMigration = require('../database/migrations');

// Create test app
const createTestApp = () => {
  const app = express();
  
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Session middleware for testing
  app.use(session({
    secret: 'test-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
  }));
  
  app.use('/auth', authRoutes);
  
  return app;
};

describe('Secure Login Implementation Tests', () => {
  let app;
  let testUser;
  let verifiedUser;

  beforeAll(async () => {
    // Initialize database connection
    await initializeDatabase();
    
    // Ensure database schema exists
    const migration = new DatabaseMigration();
    try {
      await migration.runInitialSetup();
    } catch (error) {
      console.log('Database setup note:', error.message);
    }
    
    // Create test app
    app = createTestApp();

    // Create test users
    testUser = await User.create({
      name: 'Secure Login Test User',
      email: 'securelogin@unittest.com',
      password: 'SecureTestPassword123!'
    });

    // Create verified user
    verifiedUser = await User.create({
      name: 'Verified Test User',
      email: 'verified@unittest.com',
      password: 'VerifiedPassword123!'
    });
    
    // Verify the second user's email
    await verifiedUser.verifyEmail(verifiedUser.email_verification_token);
  });

  afterAll(async () => {
    // Clean up test data
    if (testUser) {
      try {
        await Session.invalidateAllForUser(testUser.id);
        await testUser.deactivate();
      } catch (error) {
        console.log('Cleanup error for testUser:', error.message);
      }
    }
    
    if (verifiedUser) {
      try {
        await Session.invalidateAllForUser(verifiedUser.id);
        await verifiedUser.deactivate();
      } catch (error) {
        console.log('Cleanup error for verifiedUser:', error.message);
      }
    }
    
    await closeDatabase();
  });

  describe('Secure Login Flow', () => {
    test('should perform complete secure login with unverified user', async () => {
      const loginData = {
        email: 'securelogin@unittest.com',
        password: 'SecureTestPassword123!'
      };

      const response = await request(app)
        .post('/auth/login')
        .send(loginData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Login successful');
      
      // Check user data
      expect(response.body.data.user.id).toBe(testUser.id);
      expect(response.body.data.user.email).toBe(loginData.email.toLowerCase());
      expect(response.body.data.user.email_verified).toBe(false);
      
      // Check security data
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.session_id).toBeDefined();
      expect(response.body.data.expires_at).toBeDefined();
      expect(response.body.data.requires_email_verification).toBe(true);
      
      // Check security metadata
      expect(response.body.data.security).toBeDefined();
      expect(response.body.data.security.session_expires_in_days).toBe(7);
      expect(response.body.data.security.login_timestamp).toBeDefined();
      expect(typeof response.body.data.security.suspicious_activity).toBe('boolean');
    });

    test('should perform secure login with verified user', async () => {
      const loginData = {
        email: 'verified@unittest.com',
        password: 'VerifiedPassword123!'
      };

      const response = await request(app)
        .post('/auth/login')
        .send(loginData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      expect(response.body.data.user.email_verified).toBe(true);
      expect(response.body.data.requires_email_verification).toBe(false);
    });

    test('should update last login timestamp', async () => {
      const originalLastLogin = testUser.last_login;
      
      await request(app)
        .post('/auth/login')
        .send({
          email: 'securelogin@unittest.com',
          password: 'SecureTestPassword123!'
        });

      // Refresh user data
      const updatedUser = await User.findById(testUser.id);
      expect(updatedUser.last_login).toBeInstanceOf(Date);
      
      if (originalLastLogin) {
        expect(updatedUser.last_login.getTime()).toBeGreaterThan(originalLastLogin.getTime());
      }
    });

    test('should create session with proper expiration', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'securelogin@unittest.com',
          password: 'SecureTestPassword123!'
        });

      const sessionId = response.body.data.session_id;
      const expiresAt = new Date(response.body.data.expires_at);
      
      // Session should expire in approximately 7 days
      const expectedExpiration = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const timeDiff = Math.abs(expiresAt.getTime() - expectedExpiration.getTime());
      expect(timeDiff).toBeLessThan(60000); // Within 1 minute
      
      // Verify session exists in database
      const session = await Session.findBySessionId(sessionId);
      expect(session).not.toBeNull();
      expect(session.user_id).toBe(testUser.id);
    });
  });

  describe('Security Features', () => {
    test('should detect and log failed login attempts', async () => {
      const invalidLoginData = {
        email: 'securelogin@unittest.com',
        password: 'WrongPassword'
      };

      const response = await request(app)
        .post('/auth/login')
        .send(invalidLoginData);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_CREDENTIALS');

      // Verify audit log entry was created
      const { executeQuery } = require('../config/database');
      const auditQuery = `
        SELECT * FROM AuditLog 
        WHERE action = 'login_failed' 
          AND user_id = @userId 
        ORDER BY created_at DESC
      `;
      
      const auditResult = await executeQuery(auditQuery, { userId: testUser.id });
      expect(auditResult.recordset.length).toBeGreaterThan(0);
      
      const latestFailure = auditResult.recordset[0];
      expect(JSON.parse(latestFailure.details).reason).toBe('invalid_password');
    });

    test('should reject login for deactivated account', async () => {
      // Create and deactivate a user
      const deactivatedUser = await User.create({
        name: 'Deactivated User',
        email: 'deactivated@unittest.com',
        password: 'DeactivatedPassword123!'
      });
      
      await deactivatedUser.deactivate();

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'deactivated@unittest.com',
          password: 'DeactivatedPassword123!'
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('ACCOUNT_DEACTIVATED');
    });

    test('should handle OAuth-only accounts appropriately', async () => {
      // Create OAuth-only user (no password)
      const { executeQuery } = require('../config/database');
      await executeQuery(
        `INSERT INTO Users (name, email, email_verified, created_at, updated_at)
         VALUES ('OAuth Only User', 'oauth@unittest.com', 1, GETUTCDATE(), GETUTCDATE())`
      );

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'oauth@unittest.com',
          password: 'AnyPassword123!'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('OAUTH_ONLY_ACCOUNT');
      expect(response.body.hint).toBe('Use Google or Microsoft sign-in buttons');

      // Clean up
      await executeQuery('UPDATE Users SET is_active = 0 WHERE email = @email', { email: 'oauth@unittest.com' });
    });

    test('should detect suspicious login activity', async () => {
      // Create multiple sessions from different IPs to trigger suspicious activity
      const user = await User.create({
        name: 'Suspicious Activity User',
        email: 'suspicious@unittest.com',
        password: 'SuspiciousPassword123!'
      });

      // Create multiple sessions from different IPs
      await Session.create(user.id, { ipAddress: '192.168.1.1' });
      await Session.create(user.id, { ipAddress: '192.168.1.2' });
      await Session.create(user.id, { ipAddress: '192.168.1.3' });
      await Session.create(user.id, { ipAddress: '192.168.1.4' });

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'suspicious@unittest.com',
          password: 'SuspiciousPassword123!'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // Should detect suspicious activity
      expect(response.body.data.security.suspicious_activity).toBe(true);

      // Clean up
      await Session.invalidateAllForUser(user.id);
      await user.deactivate();
    });

    test('should enforce rate limiting on failed login attempts', async () => {
      const invalidLoginData = {
        email: 'securelogin@unittest.com',
        password: 'DefinitelyWrongPassword'
      };

      // Make multiple rapid failed login attempts
      const promises = Array(6).fill().map(() => 
        request(app)
          .post('/auth/login')
          .send(invalidLoginData)
      );

      const responses = await Promise.all(promises);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
      
      if (rateLimitedResponses.length > 0) {
        expect(rateLimitedResponses[0].body.code).toBe('RATE_LIMIT_EXCEEDED');
      }
    });
  });

  describe('Session Security', () => {
    let loginSession;

    test('should create secure session on login', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'securelogin@unittest.com',
          password: 'SecureTestPassword123!'
        });

      loginSession = response.body.data.session_id;
      
      // Verify session was created with proper security
      const session = await Session.findBySessionId(loginSession);
      expect(session).not.toBeNull();
      expect(session.user_id).toBe(testUser.id);
      expect(session.is_active).toBe(true);
      expect(new Date(session.expires_at)).toBeInstanceOf(Date);
      expect(new Date(session.expires_at).getTime()).toBeGreaterThan(Date.now());
    });

    test('should handle concurrent logins from same user', async () => {
      const loginPromises = Array(3).fill().map(() => 
        request(app)
          .post('/auth/login')
          .send({
            email: 'securelogin@unittest.com',
            password: 'SecureTestPassword123!'
          })
      );

      const responses = await Promise.all(loginPromises);
      
      // All logins should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.session_id).toBeDefined();
      });

      // Should have created multiple sessions
      const userSessions = await Session.findByUserId(testUser.id);
      expect(userSessions.length).toBeGreaterThanOrEqual(3);

      // Clean up extra sessions
      await Session.invalidateAllForUser(testUser.id);
    });

    test('should handle login with suspicious client information', async () => {
      const response = await request(app)
        .post('/auth/login')
        .set('User-Agent', 'SuspiciousBot/1.0')
        .set('Origin', 'http://malicious-site.com')
        .send({
          email: 'securelogin@unittest.com',
          password: 'SecureTestPassword123!'
        });

      // Login should still succeed but be flagged
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // Check if suspicious activity was logged
      const { executeQuery } = require('../config/database');
      const auditQuery = `
        SELECT * FROM AuditLog 
        WHERE action = 'login_success' 
          AND user_id = @userId 
          AND details LIKE '%suspicious%'
        ORDER BY created_at DESC
      `;
      
      const auditResult = await executeQuery(auditQuery, { userId: testUser.id });
      // Should have logged the login with suspicious activity flag
      expect(auditResult.recordset.length).toBeGreaterThan(0);
    });
  });

  describe('Security Utilities', () => {
    test('should validate password strength correctly', () => {
      const strongPassword = 'StrongPassword123!@#';
      const weakPassword = 'weak';
      
      const strongValidation = SecurityUtils.validatePasswordStrength(strongPassword);
      const weakValidation = SecurityUtils.validatePasswordStrength(weakPassword);
      
      expect(strongValidation.isValid).toBe(true);
      expect(strongValidation.strength).toBe('excellent');
      expect(strongValidation.suggestions.length).toBe(0);
      
      expect(weakValidation.isValid).toBe(false);
      expect(weakValidation.strength).toBe('very_weak');
      expect(weakValidation.suggestions.length).toBeGreaterThan(0);
    });

    test('should detect common password patterns', () => {
      const commonPasswords = [
        'password123',
        'qwerty123',
        'admin123',
        '123456789',
        'aaaaaaa1!'
      ];

      commonPasswords.forEach(password => {
        const validation = SecurityUtils.validatePasswordStrength(password);
        expect(validation.checks.noCommonPatterns).toBe(false);
      });
    });

    test('should sanitize malicious input', () => {
      const maliciousInputs = [
        '<script>alert("xss")</script>',
        'javascript:alert(1)',
        '<img src="x" onerror="alert(1)">',
        'onclick="malicious()"',
        '&#x3C;script&#x3E;alert(1)&#x3C;/script&#x3E;'
      ];

      maliciousInputs.forEach(input => {
        const sanitized = SecurityUtils.sanitizeInput(input);
        expect(sanitized).not.toContain('<script');
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).not.toContain('onerror');
        expect(sanitized).not.toContain('onclick');
      });
    });

    test('should validate email security', () => {
      const validEmail = 'valid@example.com';
      const invalidEmails = [
        'invalid@email@domain.com',
        'test..test@example.com',
        'javascript:alert(1)@example.com',
        '<script>@example.com',
        'a'.repeat(260) + '@example.com'
      ];

      const validResult = SecurityUtils.validateEmailSecurity(validEmail);
      expect(validResult.isValid).toBe(true);
      expect(validResult.normalized).toBe(validEmail.toLowerCase());

      invalidEmails.forEach(email => {
        const result = SecurityUtils.validateEmailSecurity(email);
        expect(result.isValid).toBe(false);
        expect(result.reason).toBeDefined();
      });
    });

    test('should analyze client information for security', () => {
      const mockRequest = {
        ip: '192.168.1.100',
        get: (header) => {
          const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Origin': 'http://localhost:3000',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate'
          };
          return headers[header];
        },
        connection: { remoteAddress: '192.168.1.100' }
      };

      const analysis = SecurityUtils.analyzeClientInfo(mockRequest);
      
      expect(analysis.ipAddress).toBe('192.168.1.100');
      expect(analysis.userAgent).toContain('Mozilla');
      expect(analysis.origin).toBe('http://localhost:3000');
      expect(analysis.suspicious).toBe(false);
      expect(analysis.suspiciousReasons.length).toBe(0);
    });

    test('should detect suspicious client information', () => {
      const suspiciousMockRequest = {
        ip: '192.168.1.100',
        get: (header) => {
          const headers = {
            'User-Agent': 'SuspiciousBot/1.0',
            'Origin': 'http://malicious-site.com',
            'Accept-Language': '',
            'Accept-Encoding': ''
          };
          return headers[header];
        },
        connection: { remoteAddress: '192.168.1.100' }
      };

      const analysis = SecurityUtils.analyzeClientInfo(suspiciousMockRequest);
      
      expect(analysis.suspicious).toBe(true);
      expect(analysis.suspiciousReasons.length).toBeGreaterThan(0);
      expect(analysis.suspiciousReasons.some(reason => reason.includes('Bot'))).toBe(true);
    });
  });

  describe('Advanced Login Security', () => {
    test('should handle brute force detection', async () => {
      const bruteForceEmail = 'bruteforce@unittest.com';
      
      // Create user for brute force testing
      const bruteForceUser = await User.create({
        name: 'Brute Force Test User',
        email: bruteForceEmail,
        password: 'BruteForcePassword123!'
      });

      // Simulate multiple failed attempts
      for (let i = 0; i < 6; i++) {
        await request(app)
          .post('/auth/login')
          .send({
            email: bruteForceEmail,
            password: 'WrongPassword'
          });
      }

      // Check brute force detection
      const detection = await SecurityUtils.detectBruteForceAttempt(bruteForceEmail, '192.168.1.100');
      expect(detection.isBruteForce).toBe(true);
      expect(detection.failedAttempts).toBeGreaterThanOrEqual(5);

      // Clean up
      await Session.invalidateAllForUser(bruteForceUser.id);
      await bruteForceUser.deactivate();
    });

    test('should analyze login patterns for risk assessment', async () => {
      const analysis = await SecurityUtils.analyzeLoginPattern(testUser.id, '192.168.1.100');
      
      expect(analysis).toBeDefined();
      expect(typeof analysis.totalAttempts).toBe('number');
      expect(typeof analysis.successfulLogins).toBe('number');
      expect(typeof analysis.failedLogins).toBe('number');
      expect(typeof analysis.uniqueIPs).toBe('number');
      expect(analysis.currentIP).toBe('192.168.1.100');
      expect(typeof analysis.isNewIP).toBe('boolean');
      expect(['minimal', 'low', 'medium', 'high', 'unknown']).toContain(analysis.riskLevel);
    });

    test('should generate secure JWT payloads', () => {
      const payload = SecurityUtils.createJWTPayload(testUser);
      
      expect(payload.userId).toBe(testUser.id);
      expect(payload.email).toBe(testUser.email);
      expect(payload.name).toBe(testUser.name);
      expect(payload.emailVerified).toBe(testUser.email_verified);
      expect(payload.iat).toBeDefined();
      expect(payload.jti).toBeDefined(); // JWT ID for revocation tracking
      expect(payload.jti.length).toBe(32); // 16 bytes = 32 hex chars
    });

    test('should provide security headers', () => {
      const headers = SecurityUtils.getSecurityHeaders();
      
      expect(headers).toBeDefined();
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
      expect(headers['X-Frame-Options']).toBe('DENY');
      expect(headers['X-XSS-Protection']).toBe('1; mode=block');
      expect(headers['Strict-Transport-Security']).toContain('max-age');
      expect(headers['Content-Security-Policy']).toContain("default-src 'self'");
    });
  });

  describe('Session Management During Login', () => {
    test('should handle multiple concurrent logins', async () => {
      const loginPromises = Array(5).fill().map((_, i) => 
        request(app)
          .post('/auth/login')
          .set('User-Agent', `Test Browser ${i + 1}`)
          .send({
            email: 'securelogin@unittest.com',
            password: 'SecureTestPassword123!'
          })
      );

      const responses = await Promise.all(loginPromises);
      
      // All logins should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.session_id).toBeDefined();
      });

      // Should have created multiple unique sessions
      const sessionIds = responses.map(r => r.body.data.session_id);
      const uniqueSessionIds = new Set(sessionIds);
      expect(uniqueSessionIds.size).toBe(5);

      // Clean up sessions
      await Session.invalidateAllForUser(testUser.id);
    });

    test('should maintain session consistency across requests', async () => {
      const agent = request.agent(app);
      
      // Login
      const loginResponse = await agent
        .post('/auth/login')
        .send({
          email: 'securelogin@unittest.com',
          password: 'SecureTestPassword123!'
        });

      const sessionId = loginResponse.body.data.session_id;
      
      // Check user profile with same session
      const profileResponse = await agent.get('/auth/me');
      
      expect(profileResponse.status).toBe(200);
      expect(profileResponse.body.success).toBe(true);
      expect(profileResponse.body.data.id).toBe(testUser.id);
      
      if (profileResponse.body.data.current_session) {
        expect(profileResponse.body.data.current_session.id).toBe(sessionId);
      }
    });
  });
});
