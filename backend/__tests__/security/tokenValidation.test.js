// Security tests for Token Validation
// Tests comprehensive token security, validation, and attack prevention

const jwt = require('jsonwebtoken');
const { TokenManagementService } = require('../../middleware/tokenManagement');
const { config } = require('../../config/azureAdB2C');

// Mock external dependencies
jest.mock('../../config/applicationInsights', () => ({
  telemetry: {
    trackEvent: jest.fn(),
    trackException: jest.fn(),
    trackDependency: jest.fn()
  }
}));

describe('Token Validation Security Tests', () => {
  let tokenManagement;
  let mockAppInsights;
  let mockSessionManagement;

  beforeEach(() => {
    mockAppInsights = {
      telemetry: {
        trackEvent: jest.fn(),
        trackException: jest.fn(),
        trackDependency: jest.fn()
      }
    };

    mockSessionManagement = {
      createSession: jest.fn(),
      getSession: jest.fn(),
      updateSession: jest.fn(),
      deleteSession: jest.fn()
    };

    tokenManagement = new TokenManagementService(mockAppInsights, mockSessionManagement);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('JWT Token Structure Validation', () => {
    test('should reject malformed JWT tokens', async () => {
      const malformedTokens = [
        'not.a.jwt',
        'header.payload', // Missing signature
        'header..signature', // Empty payload
        '.payload.signature', // Empty header
        'header.payload.', // Empty signature
        '', // Empty string
        null,
        undefined,
        123, // Non-string
        {}
      ];

      for (const token of malformedTokens) {
        const result = await tokenManagement.validateToken(token);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Invalid token format');
      }
    });

    test('should validate JWT token structure components', async () => {
      const validToken = global.testUtils.generateTestJWT({
        sub: 'test-user',
        iss: 'https://test-tenant.b2clogin.com/test-tenant-id/v2.0/',
        aud: config.clientId
      });

      const result = await tokenManagement.validateToken(validToken);
      expect(result.valid).toBe(true);
      expect(result.payload).toHaveProperty('sub', 'test-user');
      expect(result.payload).toHaveProperty('iss');
      expect(result.payload).toHaveProperty('aud');
    });

    test('should reject tokens with invalid JSON in payload', async () => {
      // Create token with malformed JSON payload
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = 'invalid-json-payload';
      const signature = 'fake-signature';
      const malformedToken = `${header}.${payload}.${signature}`;

      const result = await tokenManagement.validateToken(malformedToken);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid token payload');
    });
  });

  describe('Token Signature Validation', () => {
    test('should reject tokens with invalid signatures', async () => {
      const tokenWithWrongSignature = jwt.sign({
        sub: 'test-user',
        iss: 'https://test-tenant.b2clogin.com/test-tenant-id/v2.0/',
        aud: config.clientId,
        exp: Math.floor(Date.now() / 1000) + 3600
      }, 'wrong-secret');

      const result = await tokenManagement.validateToken(tokenWithWrongSignature);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid signature');
    });

    test('should reject tokens signed with weak algorithms', async () => {
      // Test with 'none' algorithm (should be rejected)
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({
        sub: 'test-user',
        exp: Math.floor(Date.now() / 1000) + 3600
      })).toString('base64url');
      const unsignedToken = `${header}.${payload}.`;

      const result = await tokenManagement.validateToken(unsignedToken);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unsupported algorithm');
    });

    test('should validate signature with correct secret', async () => {
      const validToken = global.testUtils.generateTestJWT({
        sub: 'test-user',
        iss: 'https://test-tenant.b2clogin.com/test-tenant-id/v2.0/',
        aud: config.clientId
      });

      const result = await tokenManagement.validateToken(validToken);
      expect(result.valid).toBe(true);
      expect(result.payload).toHaveProperty('sub', 'test-user');
    });
  });

  describe('Token Expiration Security', () => {
    test('should reject expired tokens', async () => {
      const expiredToken = global.testUtils.generateTestJWT({
        sub: 'test-user',
        exp: Math.floor(Date.now() / 1000) - 3600 // Expired 1 hour ago
      });

      const result = await tokenManagement.validateToken(expiredToken);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Token expired');
    });

    test('should reject tokens with future issued time', async () => {
      const futureToken = global.testUtils.generateTestJWT({
        sub: 'test-user',
        iat: Math.floor(Date.now() / 1000) + 3600, // Issued 1 hour in future
        exp: Math.floor(Date.now() / 1000) + 7200
      });

      const result = await tokenManagement.validateToken(futureToken);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Token used before issued');
    });

    test('should reject tokens with not-before time in future', async () => {
      const notYetValidToken = global.testUtils.generateTestJWT({
        sub: 'test-user',
        nbf: Math.floor(Date.now() / 1000) + 3600, // Not valid for 1 hour
        exp: Math.floor(Date.now() / 1000) + 7200
      });

      const result = await tokenManagement.validateToken(notYetValidToken);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Token not yet valid');
    });

    test('should validate tokens within valid time window', async () => {
      const now = Math.floor(Date.now() / 1000);
      const validToken = global.testUtils.generateTestJWT({
        sub: 'test-user',
        iat: now - 300, // Issued 5 minutes ago
        nbf: now - 300, // Valid from 5 minutes ago
        exp: now + 3600 // Expires in 1 hour
      });

      const result = await tokenManagement.validateToken(validToken);
      expect(result.valid).toBe(true);
    });
  });

  describe('Token Claims Validation', () => {
    test('should validate required claims are present', async () => {
      const tokenMissingClaims = global.testUtils.generateTestJWT({
        // Missing 'sub' claim
        iss: 'https://test-tenant.b2clogin.com/test-tenant-id/v2.0/',
        exp: Math.floor(Date.now() / 1000) + 3600
      });

      const result = await tokenManagement.validateToken(tokenMissingClaims, {
        requiredClaims: ['sub', 'iss', 'aud']
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Missing required claim');
    });

    test('should validate issuer claim', async () => {
      const tokenWrongIssuer = global.testUtils.generateTestJWT({
        sub: 'test-user',
        iss: 'https://malicious-issuer.com/v2.0/',
        aud: config.clientId
      });

      const result = await tokenManagement.validateToken(tokenWrongIssuer);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid issuer');
    });

    test('should validate audience claim', async () => {
      const tokenWrongAudience = global.testUtils.generateTestJWT({
        sub: 'test-user',
        iss: 'https://test-tenant.b2clogin.com/test-tenant-id/v2.0/',
        aud: 'wrong-client-id'
      });

      const result = await tokenManagement.validateToken(tokenWrongAudience);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid audience');
    });

    test('should validate custom claims when specified', async () => {
      const token = global.testUtils.generateTestJWT({
        sub: 'test-user',
        iss: 'https://test-tenant.b2clogin.com/test-tenant-id/v2.0/',
        aud: config.clientId,
        role: 'user'
      });

      const result = await tokenManagement.validateToken(token, {
        customValidation: (payload) => {
          if (payload.role !== 'admin') {
            return { valid: false, error: 'Insufficient role' };
          }
          return { valid: true };
        }
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Insufficient role');
    });
  });

  describe('Token Replay Attack Prevention', () => {
    test('should detect and prevent token replay attacks', async () => {
      const token = global.testUtils.generateTestJWT({
        sub: 'test-user',
        jti: 'unique-token-id-123', // JWT ID for replay detection
        iss: 'https://test-tenant.b2clogin.com/test-tenant-id/v2.0/',
        aud: config.clientId
      });

      // First validation should succeed
      const result1 = await tokenManagement.validateToken(token, {
        preventReplay: true
      });
      expect(result1.valid).toBe(true);

      // Second validation of same token should fail
      const result2 = await tokenManagement.validateToken(token, {
        preventReplay: true
      });
      expect(result2.valid).toBe(false);
      expect(result2.error).toContain('Token replay detected');
    });

    test('should handle tokens without JTI when replay protection enabled', async () => {
      const tokenWithoutJti = global.testUtils.generateTestJWT({
        sub: 'test-user',
        iss: 'https://test-tenant.b2clogin.com/test-tenant-id/v2.0/',
        aud: config.clientId
      });

      const result = await tokenManagement.validateToken(tokenWithoutJti, {
        preventReplay: true
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Token ID required for replay protection');
    });
  });

  describe('Token Size and Content Security', () => {
    test('should reject oversized tokens', async () => {
      const largePayload = {
        sub: 'test-user',
        iss: 'https://test-tenant.b2clogin.com/test-tenant-id/v2.0/',
        aud: config.clientId,
        largeData: 'x'.repeat(10000) // Very large claim
      };

      const largeToken = global.testUtils.generateTestJWT(largePayload);
      const result = await tokenManagement.validateToken(largeToken, {
        maxTokenSize: 8192 // 8KB limit
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Token too large');
    });

    test('should sanitize and validate claim values', async () => {
      const tokenWithMaliciousData = global.testUtils.generateTestJWT({
        sub: 'test-user',
        iss: 'https://test-tenant.b2clogin.com/test-tenant-id/v2.0/',
        aud: config.clientId,
        name: '<script>alert("xss")</script>',
        email: 'user@domain.com"; DROP TABLE users; --'
      });

      const result = await tokenManagement.validateToken(tokenWithMaliciousData, {
        sanitizeClaims: true
      });
      expect(result.valid).toBe(true);
      expect(result.payload.name).not.toContain('<script>');
      expect(result.payload.email).not.toContain('DROP TABLE');
    });
  });

  describe('Token Encryption and Storage Security', () => {
    test('should handle encrypted token storage', async () => {
      const token = global.testUtils.generateTestJWT({
        sub: 'test-user',
        iss: 'https://test-tenant.b2clogin.com/test-tenant-id/v2.0/',
        aud: config.clientId
      });

      // Test token encryption
      const encrypted = await tokenManagement.encryptToken(token);
      expect(encrypted).not.toBe(token);
      expect(encrypted).toMatch(/^[A-Za-z0-9+/]+=*$/); // Base64 pattern

      // Test token decryption
      const decrypted = await tokenManagement.decryptToken(encrypted);
      expect(decrypted).toBe(token);
    });

    test('should reject tampered encrypted tokens', async () => {
      const token = global.testUtils.generateTestJWT({
        sub: 'test-user',
        iss: 'https://test-tenant.b2clogin.com/test-tenant-id/v2.0/',
        aud: config.clientId
      });

      const encrypted = await tokenManagement.encryptToken(token);
      const tamperedEncrypted = encrypted.slice(0, -5) + 'XXXXX'; // Tamper with end

      try {
        await tokenManagement.decryptToken(tamperedEncrypted);
        fail('Should have thrown an error for tampered token');
      } catch (error) {
        expect(error.message).toContain('Decryption failed');
      }
    });
  });

  describe('Rate Limiting and Abuse Prevention', () => {
    test('should implement rate limiting for token validation', async () => {
      const token = global.testUtils.generateTestJWT({
        sub: 'test-user',
        iss: 'https://test-tenant.b2clogin.com/test-tenant-id/v2.0/',
        aud: config.clientId
      });

      const clientId = 'test-client-123';
      const requests = [];

      // Make many rapid requests
      for (let i = 0; i < 20; i++) {
        requests.push(tokenManagement.validateToken(token, {
          clientId,
          rateLimitCheck: true
        }));
      }

      const results = await Promise.all(requests);
      const rateLimitedResults = results.filter(r => 
        !r.valid && r.error && r.error.includes('Rate limit exceeded')
      );

      expect(rateLimitedResults.length).toBeGreaterThan(0);
    });

    test('should detect suspicious validation patterns', async () => {
      const suspiciousTokens = [];
      
      // Generate many tokens with similar patterns (potential attack)
      for (let i = 0; i < 10; i++) {
        suspiciousTokens.push(global.testUtils.generateTestJWT({
          sub: `attacker-${i}`,
          iss: 'https://test-tenant.b2clogin.com/test-tenant-id/v2.0/',
          aud: config.clientId
        }));
      }

      const clientId = 'suspicious-client-456';
      const results = [];

      for (const token of suspiciousTokens) {
        const result = await tokenManagement.validateToken(token, {
          clientId,
          detectSuspiciousActivity: true
        });
        results.push(result);
      }

      // Later requests should be flagged as suspicious
      const suspiciousResults = results.filter(r => 
        !r.valid && r.error && r.error.includes('Suspicious activity')
      );
      expect(suspiciousResults.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Logging Security', () => {
    test('should not leak sensitive information in error messages', async () => {
      const sensitiveToken = global.testUtils.generateTestJWT({
        sub: 'test-user',
        iss: 'https://test-tenant.b2clogin.com/test-tenant-id/v2.0/',
        aud: config.clientId,
        secret_data: 'sensitive-information-123'
      });

      // Corrupt the token to cause validation error
      const corruptedToken = sensitiveToken.slice(0, -10) + 'corrupted';
      
      const result = await tokenManagement.validateToken(corruptedToken);
      expect(result.valid).toBe(false);
      expect(result.error).not.toContain('sensitive-information-123');
      expect(result.error).not.toContain(process.env.JWT_SECRET);
    });

    test('should log security events properly', async () => {
      const maliciousToken = 'obviously.malicious.token';
      
      await tokenManagement.validateToken(maliciousToken);
      
      expect(mockAppInsights.telemetry.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'TokenValidationFailed',
          properties: expect.objectContaining({
            reason: expect.any(String),
            timestamp: expect.any(String)
          })
        })
      );
    });
  });

  describe('Multi-Tenant Security', () => {
    test('should validate tenant-specific tokens', async () => {
      const tenant1Token = global.testUtils.generateTestJWT({
        sub: 'test-user',
        iss: 'https://tenant1.b2clogin.com/tenant1-id/v2.0/',
        aud: config.clientId,
        tid: 'tenant1-id'
      });

      const tenant2Token = global.testUtils.generateTestJWT({
        sub: 'test-user',
        iss: 'https://tenant2.b2clogin.com/tenant2-id/v2.0/',
        aud: config.clientId,
        tid: 'tenant2-id'
      });

      // Validate token for specific tenant
      const result1 = await tokenManagement.validateToken(tenant1Token, {
        expectedTenant: 'tenant1-id'
      });
      expect(result1.valid).toBe(true);

      // Should reject token from different tenant
      const result2 = await tokenManagement.validateToken(tenant2Token, {
        expectedTenant: 'tenant1-id'
      });
      expect(result2.valid).toBe(false);
      expect(result2.error).toContain('Invalid tenant');
    });

    test('should prevent tenant confusion attacks', async () => {
      const confusedToken = global.testUtils.generateTestJWT({
        sub: 'test-user',
        iss: 'https://legitimate-tenant.b2clogin.com/legit-id/v2.0/',
        aud: config.clientId,
        tid: 'malicious-tenant-id' // Tenant ID doesn't match issuer
      });

      const result = await tokenManagement.validateToken(confusedToken, {
        validateTenantConsistency: true
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Tenant inconsistency');
    });
  });
});
