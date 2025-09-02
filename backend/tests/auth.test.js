const request = require('supertest');
const express = require('express');
const session = require('express-session');
const { initializeDatabase, closeDatabase } = require('../config/database');
const authRoutes = require('../routes/auth');
const User = require('../models/User');
const Session = require('../models/Session');
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
    cookie: { secure: false } // Allow non-HTTPS for testing
  }));
  
  app.use('/auth', authRoutes);
  
  return app;
};

describe('Authentication Routes Tests', () => {
  let app;
  let testUser;

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

  describe('POST /auth/register', () => {
    test('should register a new user successfully', async () => {
      const registrationData = {
        name: 'Auth Test User',
        company: 'Test Company',
        role: 'Software Engineer',
        email: 'authtest@unittest.com',
        password: 'TestPassword123!'
      };

      const response = await request(app)
        .post('/auth/register')
        .send(registrationData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User registered successfully');
      
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.id).toBeDefined();
      expect(response.body.data.user.name).toBe(registrationData.name);
      expect(response.body.data.user.email).toBe(registrationData.email.toLowerCase());
      expect(response.body.data.user.company).toBe(registrationData.company);
      expect(response.body.data.user.role).toBe(registrationData.role);
      expect(response.body.data.user.email_verified).toBe(false);
      
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.requires_email_verification).toBe(true);

      // Store for later tests
      testUser = await User.findByEmail(registrationData.email);
    });

    test('should reject registration with missing fields', async () => {
      const invalidData = {
        name: 'Test User'
        // Missing email and password
      };

      const response = await request(app)
        .post('/auth/register')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Name, email, and password are required');
      expect(response.body.code).toBe('MISSING_FIELDS');
    });

    test('should reject registration with invalid email', async () => {
      const invalidData = {
        name: 'Test User',
        email: 'invalid-email',
        password: 'TestPassword123!'
      };

      const response = await request(app)
        .post('/auth/register')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.error).toContain('valid email address');
    });

    test('should reject registration with weak password', async () => {
      const invalidData = {
        name: 'Test User',
        email: 'weakpassword@test.com',
        password: 'weak'
      };

      const response = await request(app)
        .post('/auth/register')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    test('should reject duplicate email registration', async () => {
      const duplicateData = {
        name: 'Duplicate User',
        email: 'authtest@unittest.com', // Same email as first test
        password: 'TestPassword123!'
      };

      const response = await request(app)
        .post('/auth/register')
        .send(duplicateData);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User with this email already exists');
      expect(response.body.code).toBe('USER_EXISTS');
    });
  });

  describe('POST /auth/login', () => {
    test('should login with valid credentials', async () => {
      const loginData = {
        email: 'authtest@unittest.com',
        password: 'TestPassword123!'
      };

      const response = await request(app)
        .post('/auth/login')
        .send(loginData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Login successful');
      
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe(loginData.email.toLowerCase());
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.session_id).toBeDefined();
      expect(response.body.data.expires_at).toBeDefined();
      expect(response.body.data.requires_email_verification).toBe(true);
    });

    test('should reject login with invalid email', async () => {
      const invalidData = {
        email: 'nonexistent@unittest.com',
        password: 'TestPassword123!'
      };

      const response = await request(app)
        .post('/auth/login')
        .send(invalidData);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid email or password');
      expect(response.body.code).toBe('INVALID_CREDENTIALS');
    });

    test('should reject login with invalid password', async () => {
      const invalidData = {
        email: 'authtest@unittest.com',
        password: 'WrongPassword'
      };

      const response = await request(app)
        .post('/auth/login')
        .send(invalidData);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid email or password');
      expect(response.body.code).toBe('INVALID_CREDENTIALS');
    });

    test('should reject login with missing fields', async () => {
      const invalidData = {
        email: 'authtest@unittest.com'
        // Missing password
      };

      const response = await request(app)
        .post('/auth/login')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Email and password are required');
      expect(response.body.code).toBe('MISSING_FIELDS');
    });
  });

  describe('POST /auth/verify-email', () => {
    test('should verify email with valid token', async () => {
      if (!testUser || !testUser.email_verification_token) {
        throw new Error('Test user or verification token not available');
      }

      const response = await request(app)
        .post('/auth/verify-email')
        .send({
          token: testUser.email_verification_token
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Email verified successfully');
      
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email_verified).toBe(true);
      expect(response.body.data.token).toBeDefined();

      // Update local testUser reference
      testUser = await User.findById(testUser.id);
    });

    test('should reject verification with invalid token', async () => {
      const response = await request(app)
        .post('/auth/verify-email')
        .send({
          token: 'invalid-verification-token'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid or expired verification token');
      expect(response.body.code).toBe('INVALID_TOKEN');
    });

    test('should reject verification with missing token', async () => {
      const response = await request(app)
        .post('/auth/verify-email')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Verification token is required');
      expect(response.body.code).toBe('MISSING_TOKEN');
    });
  });

  describe('POST /auth/request-password-reset', () => {
    test('should request password reset for existing user', async () => {
      const response = await request(app)
        .post('/auth/request-password-reset')
        .send({
          email: 'authtest@unittest.com'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('password reset');
    });

    test('should handle password reset request for non-existent user', async () => {
      const response = await request(app)
        .post('/auth/request-password-reset')
        .send({
          email: 'nonexistent@unittest.com'
        });

      // Should still return success to prevent email enumeration
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('password reset');
    });

    test('should reject password reset request with missing email', async () => {
      const response = await request(app)
        .post('/auth/request-password-reset')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Email is required');
      expect(response.body.code).toBe('MISSING_EMAIL');
    });
  });

  describe('POST /auth/reset-password', () => {
    let resetToken;

    beforeAll(async () => {
      if (testUser) {
        resetToken = await testUser.setPasswordResetToken();
      }
    });

    test('should reset password with valid token', async () => {
      if (!resetToken) {
        throw new Error('Reset token not available');
      }

      const newPassword = 'NewTestPassword456!';
      
      const response = await request(app)
        .post('/auth/reset-password')
        .send({
          token: resetToken,
          password: newPassword
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('reset successfully');
      
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.token).toBeDefined();

      // Verify new password works
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: 'authtest@unittest.com',
          password: newPassword
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.success).toBe(true);
    });

    test('should reject password reset with invalid token', async () => {
      const response = await request(app)
        .post('/auth/reset-password')
        .send({
          token: 'invalid-reset-token',
          password: 'NewPassword123!'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid or expired reset token');
      expect(response.body.code).toBe('INVALID_TOKEN');
    });

    test('should reject password reset with weak password', async () => {
      // Generate new reset token
      const newResetToken = await testUser.setPasswordResetToken();
      
      const response = await request(app)
        .post('/auth/reset-password')
        .send({
          token: newResetToken,
          password: 'weak'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /auth/providers', () => {
    test('should return available OAuth providers', async () => {
      const response = await request(app)
        .get('/auth/providers');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.providers).toBeDefined();
      expect(Array.isArray(response.body.data.providers)).toBe(true);
      
      const providers = response.body.data.providers;
      const providerNames = providers.map(p => p.name);
      
      expect(providerNames).toContain('google');
      expect(providerNames).toContain('microsoft');
      
      providers.forEach(provider => {
        expect(provider).toHaveProperty('name');
        expect(provider).toHaveProperty('displayName');
        expect(provider).toHaveProperty('configured');
      });
    });
  });

  describe('Session Management', () => {
    let authToken;
    let sessionId;

    test('should maintain session after login', async () => {
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: 'authtest@unittest.com',
          password: 'NewTestPassword456!' // From previous password reset test
        });

      expect(loginResponse.status).toBe(200);
      authToken = loginResponse.body.data.token;
      sessionId = loginResponse.body.data.session_id;
      
      expect(authToken).toBeDefined();
      expect(sessionId).toBeDefined();
    });

    test('should get current user info', async () => {
      const agent = request.agent(app);
      
      // Login first to establish session
      await agent
        .post('/auth/login')
        .send({
          email: 'authtest@unittest.com',
          password: 'NewTestPassword456!'
        });

      const response = await agent.get('/auth/me');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.id).toBe(testUser.id);
      expect(response.body.data.email).toBe(testUser.email);
      expect(response.body.data.active_sessions_count).toBeGreaterThan(0);
    });

    test('should refresh JWT token', async () => {
      if (!authToken || !sessionId) {
        throw new Error('Auth token or session ID not available from previous test');
      }

      const response = await request(app)
        .post('/auth/refresh-token')
        .send({
          token: authToken,
          session_id: sessionId
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Token refreshed successfully');
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.token).not.toBe(authToken); // Should be a new token
    });

    test('should logout successfully', async () => {
      const agent = request.agent(app);
      
      // Login first
      const loginResponse = await agent
        .post('/auth/login')
        .send({
          email: 'authtest@unittest.com',
          password: 'NewTestPassword456!'
        });

      const logoutSessionId = loginResponse.body.data.session_id;

      const response = await agent
        .post('/auth/logout')
        .send({
          session_id: logoutSessionId
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logged out successfully');
    });

    test('should logout from all devices', async () => {
      // Create multiple sessions
      const session1Response = await request(app)
        .post('/auth/login')
        .send({
          email: 'authtest@unittest.com',
          password: 'NewTestPassword456!'
        });

      const session2Response = await request(app)
        .post('/auth/login')
        .send({
          email: 'authtest@unittest.com',
          password: 'NewTestPassword456!'
        });

      expect(session1Response.status).toBe(200);
      expect(session2Response.status).toBe(200);

      // Logout from all devices
      const response = await request(app)
        .post('/auth/logout-all')
        .send({
          user_id: testUser.id
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Logged out from');
    });
  });

  describe('Rate Limiting', () => {
    test('should enforce rate limiting on registration attempts', async () => {
      const registrationData = {
        name: 'Rate Limit Test',
        email: 'ratelimit@test.com',
        password: 'TestPassword123!'
      };

      // Make multiple rapid requests
      const promises = Array(7).fill().map(() => 
        request(app)
          .post('/auth/register')
          .send(registrationData)
      );

      const responses = await Promise.all(promises);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
      
      if (rateLimitedResponses.length > 0) {
        expect(rateLimitedResponses[0].body.code).toBe('RATE_LIMIT_EXCEEDED');
      }
    });

    test('should enforce rate limiting on login attempts', async () => {
      const loginData = {
        email: 'authtest@unittest.com',
        password: 'WrongPassword'
      };

      // Make multiple rapid failed login attempts
      const promises = Array(7).fill().map(() => 
        request(app)
          .post('/auth/login')
          .send(loginData)
      );

      const responses = await Promise.all(promises);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed JSON requests', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send('invalid json')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
    });

    test('should handle requests with no body', async () => {
      const response = await request(app)
        .post('/auth/login');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('MISSING_FIELDS');
    });

    test('should handle extremely long input values', async () => {
      const longString = 'a'.repeat(1000);
      
      const response = await request(app)
        .post('/auth/register')
        .send({
          name: longString,
          email: 'longstring@test.com',
          password: 'TestPassword123!'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });
});
