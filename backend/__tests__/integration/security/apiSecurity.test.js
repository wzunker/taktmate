// Integration tests for API Security and Endpoint Protection
// Tests comprehensive security measures including rate limiting, CSRF protection,
// input validation, and authorization controls

const request = require('supertest');

// Mock external dependencies
jest.mock('../../../config/applicationInsights', () => ({
  telemetry: {
    trackEvent: jest.fn(),
    trackException: jest.fn(),
    trackDependency: jest.fn()
  }
}));

jest.mock('../../../services/auditLoggingService');
jest.mock('../../../services/gdprComplianceService');

describe('API Security Integration Tests', () => {
  let app;
  let server;

  beforeAll(async () => {
    // Import app after mocks are set up
    const appModule = require('../../../index');
    app = appModule.app || appModule;
    
    // Start server on a test port
    server = app.listen(0, () => {
      console.log(`Security Test server running on port ${server.address().port}`);
    });
    
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  describe('Rate Limiting Protection', () => {
    test('should enforce rate limits on authentication endpoints', async () => {
      const requests = [];
      
      // Make rapid successive requests to trigger rate limiting
      for (let i = 0; i < 25; i++) {
        requests.push(
          request(app)
            .post('/api/token/validate')
            .send({ token: 'test-token-' + i })
        );
      }

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited (429 status)
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);

      // Check rate limit headers
      const rateLimitedResponse = rateLimitedResponses[0];
      expect(rateLimitedResponse.headers).toHaveProperty('x-ratelimit-limit');
      expect(rateLimitedResponse.headers).toHaveProperty('x-ratelimit-remaining');
      expect(rateLimitedResponse.headers).toHaveProperty('x-ratelimit-reset');
    });

    test('should enforce different rate limits for different endpoints', async () => {
      const uploadRequests = [];
      const chatRequests = [];
      
      const validToken = global.testUtils.generateTestJWT();
      
      // Test upload endpoint rate limiting
      for (let i = 0; i < 10; i++) {
        uploadRequests.push(
          request(app)
            .post('/api/upload')
            .set('Authorization', `Bearer ${validToken}`)
            .attach('file', Buffer.from('test,data\n1,2'), 'test.csv')
        );
      }

      // Test chat endpoint rate limiting
      for (let i = 0; i < 15; i++) {
        chatRequests.push(
          request(app)
            .post('/api/chat')
            .set('Authorization', `Bearer ${validToken}`)
            .send({
              fileId: 'test-file-id',
              message: 'Test message ' + i
            })
        );
      }

      const [uploadResponses, chatResponses] = await Promise.all([
        Promise.all(uploadRequests),
        Promise.all(chatRequests)
      ]);

      // Both endpoints should have different rate limiting behavior
      const uploadRateLimited = uploadResponses.filter(res => res.status === 429);
      const chatRateLimited = chatResponses.filter(res => res.status === 429);

      // At least one type of endpoint should be rate limited
      expect(uploadRateLimited.length + chatRateLimited.length).toBeGreaterThan(0);
    });

    test('should reset rate limits after time window', async () => {
      // Make requests to hit rate limit
      const initialRequests = [];
      for (let i = 0; i < 15; i++) {
        initialRequests.push(
          request(app)
            .post('/api/token/validate')
            .send({ token: 'rate-test-' + i })
        );
      }

      await Promise.all(initialRequests);

      // Wait for rate limit window to reset (this would be implementation-specific)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Should be able to make requests again
      const response = await request(app)
        .post('/api/token/validate')
        .send({ token: 'after-reset-token' });

      expect(response.status).not.toBe(429);
    });
  });

  describe('CSRF Protection', () => {
    test('should require CSRF token for state-changing operations', async () => {
      const validToken = global.testUtils.generateTestJWT();

      // Attempt POST without CSRF token
      const response = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${validToken}`)
        .attach('file', Buffer.from('test,data\n1,2'), 'test.csv')
        .expect(403);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('CSRF');
    });

    test('should accept requests with valid CSRF token', async () => {
      const validToken = global.testUtils.generateTestJWT();

      // Get CSRF token first
      const csrfResponse = await request(app)
        .get('/api/csrf-token')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      const csrfToken = csrfResponse.body.csrfToken;

      // Use CSRF token in subsequent request
      const response = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-CSRF-Token', csrfToken)
        .attach('file', Buffer.from('test,data\n1,2'), 'test.csv')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    test('should reject requests with invalid CSRF token', async () => {
      const validToken = global.testUtils.generateTestJWT();

      const response = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-CSRF-Token', 'invalid-csrf-token')
        .attach('file', Buffer.from('test,data\n1,2'), 'test.csv')
        .expect(403);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('Invalid CSRF token');
    });
  });

  describe('Input Validation and Sanitization', () => {
    test('should validate and sanitize file upload parameters', async () => {
      const validToken = global.testUtils.generateTestJWT();
      const csrfToken = await getCsrfToken(validToken);

      // Test with malicious filename
      const response = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-CSRF-Token', csrfToken)
        .attach('file', Buffer.from('test,data\n1,2'), '../../../malicious.csv')
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('Invalid filename');
    });

    test('should validate chat message input', async () => {
      const validToken = global.testUtils.generateTestJWT();

      // Test with extremely long message
      const longMessage = 'a'.repeat(10000);
      
      const response = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          fileId: 'test-file-id',
          message: longMessage
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('Message too long');
    });

    test('should sanitize HTML and script content', async () => {
      const validToken = global.testUtils.generateTestJWT();

      const maliciousMessage = '<script>alert("xss")</script><img src="x" onerror="alert(1)">';
      
      const response = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          fileId: 'test-file-id',
          message: maliciousMessage
        });

      // Should either reject or sanitize the input
      if (response.status === 200) {
        expect(response.body.message).not.toContain('<script>');
        expect(response.body.message).not.toContain('onerror');
      } else {
        expect(response.status).toBe(400);
      }
    });

    test('should validate JSON input structure', async () => {
      const validToken = global.testUtils.generateTestJWT();

      // Send malformed JSON
      const response = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${validToken}`)
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('Invalid JSON');
    });

    test('should validate required fields', async () => {
      const validToken = global.testUtils.generateTestJWT();

      // Send request with missing required fields
      const response = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          // Missing fileId and message
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('Missing required fields');
    });
  });

  describe('Authorization and Access Control', () => {
    test('should enforce user-specific file access', async () => {
      const user1Token = global.testUtils.generateTestJWT({ sub: 'user-1' });
      const user2Token = global.testUtils.generateTestJWT({ sub: 'user-2' });
      const csrfToken = await getCsrfToken(user1Token);

      // Upload file as user 1
      const uploadResponse = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${user1Token}`)
        .set('X-CSRF-Token', csrfToken)
        .attach('file', Buffer.from('user1,data\n1,2'), 'user1-file.csv')
        .expect(200);

      const fileId = uploadResponse.body.fileId;

      // Try to access file as user 2
      const accessResponse = await request(app)
        .get(`/api/files/${fileId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(403);

      expect(accessResponse.body).toHaveProperty('success', false);
      expect(accessResponse.body.error).toContain('Access denied');
    });

    test('should enforce admin-only endpoint access', async () => {
      const userToken = global.testUtils.generateTestJWT({ 
        roles: ['user'] 
      });
      const adminToken = global.testUtils.generateTestJWT({ 
        roles: ['admin'],
        permissions: ['audit:read']
      });

      // Regular user should be denied
      const userResponse = await request(app)
        .get('/api/audit/logs')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(userResponse.body).toHaveProperty('success', false);
      expect(userResponse.body.error).toContain('Insufficient permissions');

      // Admin should be allowed
      const adminResponse = await request(app)
        .get('/api/audit/logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(adminResponse.body).toHaveProperty('success', true);
    });

    test('should validate resource ownership', async () => {
      const ownerToken = global.testUtils.generateTestJWT({ sub: 'resource-owner' });
      const otherToken = global.testUtils.generateTestJWT({ sub: 'other-user' });

      // Create a resource as owner
      const csrfToken = await getCsrfToken(ownerToken);
      const createResponse = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-CSRF-Token', csrfToken)
        .attach('file', Buffer.from('owner,data\n1,2'), 'owner-file.csv')
        .expect(200);

      const resourceId = createResponse.body.fileId;

      // Owner should be able to delete
      const deleteAsOwnerResponse = await request(app)
        .delete(`/api/files/${resourceId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-CSRF-Token', csrfToken)
        .expect(200);

      expect(deleteAsOwnerResponse.body).toHaveProperty('success', true);

      // Other user should not be able to delete
      const deleteAsOtherResponse = await request(app)
        .delete(`/api/files/${resourceId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);

      expect(deleteAsOtherResponse.body).toHaveProperty('success', false);
    });
  });

  describe('Security Headers', () => {
    test('should include security headers in all responses', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Check for security headers set by helmet middleware
      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-xss-protection');
      expect(response.headers).toHaveProperty('strict-transport-security');
      expect(response.headers).toHaveProperty('x-download-options', 'noopen');
    });

    test('should set appropriate Content Security Policy', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers).toHaveProperty('content-security-policy');
      const csp = response.headers['content-security-policy'];
      expect(csp).toContain("default-src 'self'");
    });

    test('should include CORS headers for allowed origins', async () => {
      const response = await request(app)
        .options('/api/files')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET')
        .set('Access-Control-Request-Headers', 'Authorization')
        .expect(204);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
      expect(response.headers).toHaveProperty('access-control-allow-headers');
      expect(response.headers).toHaveProperty('access-control-allow-credentials', 'true');
    });

    test('should reject CORS requests from unauthorized origins', async () => {
      const response = await request(app)
        .options('/api/files')
        .set('Origin', 'https://malicious-site.com')
        .set('Access-Control-Request-Method', 'GET')
        .expect(204);

      // Should not include CORS headers for unauthorized origin
      expect(response.headers['access-control-allow-origin']).not.toBe('https://malicious-site.com');
    });
  });

  describe('File Upload Security', () => {
    test('should validate file types and extensions', async () => {
      const validToken = global.testUtils.generateTestJWT();
      const csrfToken = await getCsrfToken(validToken);

      // Try to upload non-CSV file
      const response = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-CSRF-Token', csrfToken)
        .attach('file', Buffer.from('malicious content'), 'malicious.exe')
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('Invalid file type');
    });

    test('should enforce file size limits', async () => {
      const validToken = global.testUtils.generateTestJWT();
      const csrfToken = await getCsrfToken(validToken);

      // Create a large file that exceeds limits
      const largeContent = 'x'.repeat(20 * 1024 * 1024); // 20MB
      
      const response = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-CSRF-Token', csrfToken)
        .attach('file', Buffer.from(largeContent), 'large-file.csv')
        .expect(413);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('File too large');
    });

    test('should scan uploaded files for malicious content', async () => {
      const validToken = global.testUtils.generateTestJWT();
      const csrfToken = await getCsrfToken(validToken);

      // Try to upload file with suspicious content
      const suspiciousContent = 'name,script\ntest,"<script>alert(1)</script>"';
      
      const response = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-CSRF-Token', csrfToken)
        .attach('file', Buffer.from(suspiciousContent), 'suspicious.csv');

      // Should either reject or sanitize the content
      if (response.status === 200) {
        // If accepted, should be sanitized
        expect(response.body.warnings).toContain('Content sanitized');
      } else {
        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Suspicious content detected');
      }
    });
  });

  describe('API Endpoint Security', () => {
    test('should prevent SQL injection attempts', async () => {
      const validToken = global.testUtils.generateTestJWT();

      const sqlInjection = "'; DROP TABLE users; --";
      
      const response = await request(app)
        .get('/api/files')
        .set('Authorization', `Bearer ${validToken}`)
        .query({ search: sqlInjection })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('Invalid search parameter');
    });

    test('should prevent NoSQL injection attempts', async () => {
      const validToken = global.testUtils.generateTestJWT();

      const nosqlInjection = { $ne: null };
      
      const response = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          fileId: nosqlInjection,
          message: 'test message'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('Invalid fileId format');
    });

    test('should prevent command injection', async () => {
      const validToken = global.testUtils.generateTestJWT();

      const commandInjection = 'test; rm -rf /';
      
      const response = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          fileId: 'test-file',
          message: commandInjection
        });

      // Should sanitize or reject the input
      if (response.status === 200) {
        expect(response.body.message).not.toContain('; rm -rf');
      } else {
        expect(response.status).toBe(400);
      }
    });

    test('should handle path traversal attempts', async () => {
      const validToken = global.testUtils.generateTestJWT();

      const response = await request(app)
        .get('/api/files/../../../etc/passwd')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('Invalid path');
    });
  });

  describe('Session Security', () => {
    test('should invalidate sessions on suspicious activity', async () => {
      const validToken = global.testUtils.generateTestJWT();

      // Make multiple failed requests to trigger suspicious activity detection
      const suspiciousRequests = [];
      for (let i = 0; i < 10; i++) {
        suspiciousRequests.push(
          request(app)
            .get('/api/files/non-existent-file-' + i)
            .set('Authorization', `Bearer ${validToken}`)
        );
      }

      await Promise.all(suspiciousRequests);

      // Subsequent request should be blocked due to suspicious activity
      const response = await request(app)
        .get('/api/files')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('Suspicious activity detected');
    });

    test('should detect concurrent session abuse', async () => {
      const validToken = global.testUtils.generateTestJWT();

      // Make many concurrent requests
      const concurrentRequests = [];
      for (let i = 0; i < 50; i++) {
        concurrentRequests.push(
          request(app)
            .get('/api/files')
            .set('Authorization', `Bearer ${validToken}`)
        );
      }

      const responses = await Promise.all(concurrentRequests);
      
      // Some requests should be blocked due to concurrent abuse
      const blockedResponses = responses.filter(res => res.status === 429 || res.status === 403);
      expect(blockedResponses.length).toBeGreaterThan(0);
    });
  });

  // Helper function to get CSRF token
  async function getCsrfToken(authToken) {
    const response = await request(app)
      .get('/api/csrf-token')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);
    
    return response.body.csrfToken;
  }
});
