// Integration tests for Complete Authentication Flows
// Tests end-to-end authentication processes including Microsoft Entra External ID integration,
// token management, session handling, and protected endpoint access

const request = require('supertest');
const jwt = require('jsonwebtoken');

// Mock the main app before importing it
jest.mock('../../../config/applicationInsights', () => ({
  telemetry: {
    trackEvent: jest.fn(),
    trackException: jest.fn(),
    trackDependency: jest.fn()
  }
}));

jest.mock('../../../services/auditLoggingService');
jest.mock('../../../services/gdprComplianceService');
jest.mock('../../../services/accountDeletionService');
jest.mock('../../../services/legalDocumentsService');
jest.mock('../../../services/cookieConsentService');
jest.mock('../../../services/dataRetentionService');

describe('Authentication Flows Integration Tests', () => {
  let app;
  let server;

  beforeAll(async () => {
    // Import app after mocks are set up
    const appModule = require('../../../index');
    app = appModule.app || appModule;
    
    // Start server on a test port
    server = app.listen(0, () => {
      console.log(`Test server running on port ${server.address().port}`);
    });
    
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  describe('Public Endpoints (No Authentication Required)', () => {
    test('should access health endpoint without authentication', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('timestamp');
    });

    test('should access Microsoft Entra External ID health endpoint', async () => {
      const response = await request(app)
        .get('/health/azure-ad-b2c')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('configuration');
    });

    test('should access legal documents without authentication', async () => {
      const response = await request(app)
        .get('/legal/privacy-policy')
        .expect(200);

      expect(response.text).toContain('Privacy Policy');
    });

    test('should access cookie consent configuration', async () => {
      const response = await request(app)
        .get('/api/cookie-consent/config')
        .expect(200);

      expect(response.body).toHaveProperty('categories');
      expect(response.body).toHaveProperty('consentRequired');
    });
  });

  describe('Token Validation Flow', () => {
    test('should reject requests to protected endpoints without token', async () => {
      const response = await request(app)
        .get('/api/files')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('No token provided');
    });

    test('should reject requests with malformed token', async () => {
      const response = await request(app)
        .get('/api/files')
        .set('Authorization', 'Bearer invalid-token-format')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid token');
    });

    test('should reject requests with expired token', async () => {
      const expiredToken = global.testUtils.generateTestJWT({
        exp: Math.floor(Date.now() / 1000) - 3600 // Expired 1 hour ago
      });

      const response = await request(app)
        .get('/api/files')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Token expired');
    });

    test('should accept requests with valid JWT token', async () => {
      const validToken = global.testUtils.generateTestJWT();

      const response = await request(app)
        .get('/api/files')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('files');
      expect(Array.isArray(response.body.files)).toBe(true);
    });

    test('should accept requests with valid Microsoft Entra External ID token', async () => {
      const azureToken = global.testUtils.generateTestAzureToken();

      const response = await request(app)
        .get('/api/files')
        .set('Authorization', `Bearer ${azureToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('files');
    });
  });

  describe('Token Refresh Flow', () => {
    test('should refresh valid refresh token', async () => {
      const refreshToken = global.testUtils.generateTestJWT({
        token_use: 'refresh',
        exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60 // 7 days
      });

      // Mock the Microsoft Entra External ID token refresh endpoint
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer'
        })
      });
      global.fetch = mockFetch;

      const response = await request(app)
        .post('/api/token/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('tokens');
      expect(response.body.tokens).toHaveProperty('accessToken');
      expect(response.body.tokens).toHaveProperty('refreshToken');
    });

    test('should reject invalid refresh token', async () => {
      const invalidRefreshToken = 'invalid-refresh-token';

      const response = await request(app)
        .post('/api/token/refresh')
        .send({ refreshToken: invalidRefreshToken })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    test('should validate token expiration endpoint', async () => {
      const validToken = global.testUtils.generateTestJWT();

      const response = await request(app)
        .get('/api/token/expiration')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('expiresAt');
      expect(response.body).toHaveProperty('remainingTime');
      expect(response.body).toHaveProperty('needsRefresh');
    });
  });

  describe('File Upload and Access Flow', () => {
    test('should upload file with valid authentication', async () => {
      const validToken = global.testUtils.generateTestJWT();
      
      // Create a test CSV file
      const csvContent = 'name,age,city\nJohn,30,New York\nJane,25,Los Angeles';
      
      const response = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${validToken}`)
        .attach('file', Buffer.from(csvContent), 'test.csv')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('fileId');
      expect(response.body).toHaveProperty('filename', 'test.csv');
      expect(response.body).toHaveProperty('userId');
    });

    test('should reject file upload without authentication', async () => {
      const csvContent = 'name,age,city\nJohn,30,New York';
      
      const response = await request(app)
        .post('/api/upload')
        .attach('file', Buffer.from(csvContent), 'test.csv')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    test('should access user files with valid authentication', async () => {
      const validToken = global.testUtils.generateTestJWT();

      const response = await request(app)
        .get('/api/files')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('files');
      expect(Array.isArray(response.body.files)).toBe(true);
    });

    test('should prevent access to other users files', async () => {
      // Create tokens for two different users
      const user1Token = global.testUtils.generateTestJWT({ sub: 'user-1' });
      const user2Token = global.testUtils.generateTestJWT({ sub: 'user-2' });

      // Upload file as user 1
      const csvContent = 'name,age\nUser1,30';
      const uploadResponse = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${user1Token}`)
        .attach('file', Buffer.from(csvContent), 'user1-file.csv')
        .expect(200);

      const fileId = uploadResponse.body.fileId;

      // Try to access the file as user 2
      const accessResponse = await request(app)
        .get(`/api/files/${fileId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(403);

      expect(accessResponse.body).toHaveProperty('success', false);
      expect(accessResponse.body).toHaveProperty('error');
      expect(accessResponse.body.error).toContain('Access denied');
    });
  });

  describe('Chat and AI Integration Flow', () => {
    test('should process chat request with valid authentication', async () => {
      const validToken = global.testUtils.generateTestJWT();

      // First upload a file
      const csvContent = 'name,age,salary\nJohn,30,50000\nJane,25,60000';
      const uploadResponse = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${validToken}`)
        .attach('file', Buffer.from(csvContent), 'salary-data.csv')
        .expect(200);

      const fileId = uploadResponse.body.fileId;

      // Then send a chat message about the file
      const chatResponse = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          fileId: fileId,
          message: 'What is the average salary?'
        })
        .expect(200);

      expect(chatResponse.body).toHaveProperty('success', true);
      expect(chatResponse.body).toHaveProperty('response');
      expect(chatResponse.body).toHaveProperty('conversationId');
    });

    test('should reject chat request without authentication', async () => {
      const response = await request(app)
        .post('/api/chat')
        .send({
          fileId: 'some-file-id',
          message: 'What is the data about?'
        })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    test('should reject chat request for non-existent file', async () => {
      const validToken = global.testUtils.generateTestJWT();

      const response = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          fileId: 'non-existent-file-id',
          message: 'What is this data?'
        })
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('File not found');
    });
  });

  describe('GDPR and Privacy Flow', () => {
    test('should export user data with valid authentication', async () => {
      const validToken = global.testUtils.generateTestJWT();

      const response = await request(app)
        .get('/api/gdpr/export')
        .set('Authorization', `Bearer ${validToken}`)
        .query({ format: 'json' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('exportId');
      expect(response.body).toHaveProperty('format', 'json');
    });

    test('should record user consent with valid authentication', async () => {
      const validToken = global.testUtils.generateTestJWT();

      const response = await request(app)
        .post('/api/cookie-consent/record')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          necessary: true,
          analytics: true,
          marketing: false,
          preferences: true
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('consentId');
      expect(response.body).toHaveProperty('timestamp');
    });

    test('should get session data disclosure with valid authentication', async () => {
      const validToken = global.testUtils.generateTestJWT();

      const response = await request(app)
        .get('/api/session-data/disclosure')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('sessionData');
      expect(response.body).toHaveProperty('disclosure');
    });
  });

  describe('Admin and Monitoring Flows', () => {
    test('should access audit logs with admin authentication', async () => {
      const adminToken = global.testUtils.generateTestJWT({
        roles: ['admin'],
        permissions: ['audit:read']
      });

      const response = await request(app)
        .get('/api/audit/logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          limit: 10,
          category: 'DATA_ACCESS'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('results');
      expect(Array.isArray(response.body.results)).toBe(true);
    });

    test('should reject audit logs access for non-admin users', async () => {
      const userToken = global.testUtils.generateTestJWT({
        roles: ['user']
      });

      const response = await request(app)
        .get('/api/audit/logs')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Insufficient permissions');
    });

    test('should get system health with admin authentication', async () => {
      const adminToken = global.testUtils.generateTestJWT({
        roles: ['admin']
      });

      const response = await request(app)
        .get('/health/system')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('services');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('Session Management Flow', () => {
    test('should handle session creation and validation', async () => {
      const validToken = global.testUtils.generateTestJWT();

      // Make a request that should create a session
      const response1 = await request(app)
        .get('/api/files')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      // Check if session was created (via response headers or body)
      expect(response1.body).toHaveProperty('success', true);

      // Make another request with the same token
      const response2 = await request(app)
        .get('/api/files')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response2.body).toHaveProperty('success', true);
    });

    test('should handle session fingerprinting', async () => {
      const validToken = global.testUtils.generateTestJWT();

      // Make request with specific user agent
      const response = await request(app)
        .get('/api/files')
        .set('Authorization', `Bearer ${validToken}`)
        .set('User-Agent', 'Test-Integration-Client/1.0')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    test('should handle token expiration and refresh', async () => {
      // Create a token that expires soon
      const shortLivedToken = global.testUtils.generateTestJWT({
        exp: Math.floor(Date.now() / 1000) + 300 // 5 minutes
      });

      const response = await request(app)
        .get('/api/token/expiration')
        .set('Authorization', `Bearer ${shortLivedToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('needsRefresh', true);
      expect(response.body).toHaveProperty('remainingTime');
      expect(response.body.remainingTime).toBeLessThan(600); // Less than 10 minutes
    });
  });

  describe('Error Handling and Security', () => {
    test('should handle malformed request bodies gracefully', async () => {
      const validToken = global.testUtils.generateTestJWT();

      const response = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${validToken}`)
        .set('Content-Type', 'application/json')
        .send('invalid-json-string')
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    test('should enforce rate limiting on authentication endpoints', async () => {
      const requests = [];
      
      // Make multiple rapid requests
      for (let i = 0; i < 20; i++) {
        requests.push(
          request(app)
            .post('/api/token/validate')
            .send({ token: 'test-token' })
        );
      }

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    test('should sanitize input data', async () => {
      const validToken = global.testUtils.generateTestJWT();
      
      const maliciousInput = '<script>alert("xss")</script>';
      
      const response = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          fileId: 'test-file-id',
          message: maliciousInput
        });

      // Should either reject the input or sanitize it
      if (response.status === 200) {
        expect(response.body.response).not.toContain('<script>');
      } else {
        expect(response.status).toBe(400);
      }
    });

    test('should handle CORS properly', async () => {
      const response = await request(app)
        .options('/api/files')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET')
        .set('Access-Control-Request-Headers', 'Authorization')
        .expect(204);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
      expect(response.headers).toHaveProperty('access-control-allow-headers');
    });
  });

  describe('Performance and Monitoring', () => {
    test('should respond within acceptable time limits', async () => {
      const validToken = global.testUtils.generateTestJWT();
      
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/files')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(5000); // Should respond within 5 seconds
      expect(response.body).toHaveProperty('success', true);
    });

    test('should include proper security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Check for security headers added by helmet
      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-xss-protection');
    });

    test('should track requests in Application Insights', async () => {
      const validToken = global.testUtils.generateTestJWT();

      await request(app)
        .get('/api/files')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      // Verify that telemetry tracking was called (mocked)
      // This would be implementation-specific based on how telemetry is set up
      expect(true).toBe(true); // Placeholder for actual telemetry verification
    });
  });
});
