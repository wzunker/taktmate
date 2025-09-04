// Unit tests for JWT Authentication Middleware
// Tests JWT token verification, user extraction, and authentication flow

const { jwtAuthMiddleware } = require('../../../middleware/jwtAuth');
const jwt = require('jsonwebtoken');

describe('JWT Authentication Middleware', () => {
  describe('Middleware Creation', () => {
    test('should create JWT auth middleware function', () => {
      const middleware = jwtAuthMiddleware();
      
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });

    test('should create middleware with custom options', () => {
      const middleware = jwtAuthMiddleware({
        algorithms: ['HS256', 'RS256'],
        issuer: 'custom-issuer',
        audience: 'custom-audience'
      });
      
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });
  });

  describe('Token Extraction', () => {
    test('should extract token from Authorization header', async () => {
      const middleware = jwtAuthMiddleware();
      const validToken = global.testUtils.generateTestJWT();
      
      const req = global.testUtils.createMockRequest({
        headers: { authorization: `Bearer ${validToken}` }
      });
      const res = global.testUtils.createMockResponse();
      const next = global.testUtils.createMockNext();
      
      await middleware(req, res, next);
      
      expect(req.user).toBeDefined();
      expect(req.user.sub).toBe('test-user-id');
      expect(req.user.email).toBe('test@example.com');
      expect(next).toHaveBeenCalled();
    });

    test('should handle missing Authorization header', async () => {
      const middleware = jwtAuthMiddleware();
      
      const req = global.testUtils.createMockRequest();
      const res = global.testUtils.createMockResponse();
      const next = global.testUtils.createMockNext();
      
      await middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'No token provided',
        code: 'NO_TOKEN'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should handle malformed Authorization header', async () => {
      const middleware = jwtAuthMiddleware();
      
      const req = global.testUtils.createMockRequest({
        headers: { authorization: 'InvalidFormat token' }
      });
      const res = global.testUtils.createMockResponse();
      const next = global.testUtils.createMockNext();
      
      await middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid token format',
        code: 'INVALID_TOKEN_FORMAT'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should handle empty Bearer token', async () => {
      const middleware = jwtAuthMiddleware();
      
      const req = global.testUtils.createMockRequest({
        headers: { authorization: 'Bearer ' }
      });
      const res = global.testUtils.createMockResponse();
      const next = global.testUtils.createMockNext();
      
      await middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'No token provided',
        code: 'NO_TOKEN'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Token Validation', () => {
    test('should validate valid JWT token', async () => {
      const middleware = jwtAuthMiddleware();
      const validToken = global.testUtils.generateTestJWT();
      
      const req = global.testUtils.createMockRequest({
        headers: { authorization: `Bearer ${validToken}` }
      });
      const res = global.testUtils.createMockResponse();
      const next = global.testUtils.createMockNext();
      
      await middleware(req, res, next);
      
      expect(req.user).toBeDefined();
      expect(req.user.sub).toBe('test-user-id');
      expect(req.user.name).toBe('Test User');
      expect(req.user.email).toBe('test@example.com');
      expect(next).toHaveBeenCalled();
    });

    test('should reject expired JWT token', async () => {
      const middleware = jwtAuthMiddleware();
      const expiredToken = global.testUtils.generateTestJWT({
        exp: Math.floor(Date.now() / 1000) - 3600 // Expired 1 hour ago
      });
      
      const req = global.testUtils.createMockRequest({
        headers: { authorization: `Bearer ${expiredToken}` }
      });
      const res = global.testUtils.createMockResponse();
      const next = global.testUtils.createMockNext();
      
      await middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should reject token with invalid signature', async () => {
      const middleware = jwtAuthMiddleware();
      const invalidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.invalid-signature';
      
      const req = global.testUtils.createMockRequest({
        headers: { authorization: `Bearer ${invalidToken}` }
      });
      const res = global.testUtils.createMockResponse();
      const next = global.testUtils.createMockNext();
      
      await middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should reject malformed JWT token', async () => {
      const middleware = jwtAuthMiddleware();
      const malformedToken = 'not.a.valid.jwt.token.at.all';
      
      const req = global.testUtils.createMockRequest({
        headers: { authorization: `Bearer ${malformedToken}` }
      });
      const res = global.testUtils.createMockResponse();
      const next = global.testUtils.createMockNext();
      
      await middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('User Extraction', () => {
    test('should extract user information from valid token', async () => {
      const middleware = jwtAuthMiddleware();
      const userPayload = {
        sub: 'user-123',
        name: 'John Doe',
        email: 'john.doe@example.com',
        oid: 'object-id-456',
        roles: ['user', 'premium']
      };
      const validToken = global.testUtils.generateTestJWT(userPayload);
      
      const req = global.testUtils.createMockRequest({
        headers: { authorization: `Bearer ${validToken}` }
      });
      const res = global.testUtils.createMockResponse();
      const next = global.testUtils.createMockNext();
      
      await middleware(req, res, next);
      
      expect(req.user).toBeDefined();
      expect(req.user.sub).toBe('user-123');
      expect(req.user.name).toBe('John Doe');
      expect(req.user.email).toBe('john.doe@example.com');
      expect(req.user.oid).toBe('object-id-456');
      expect(req.user.roles).toEqual(['user', 'premium']);
      expect(next).toHaveBeenCalled();
    });

    test('should handle Azure AD B2C token format', async () => {
      const middleware = jwtAuthMiddleware();
      const azureToken = global.testUtils.generateTestAzureToken({
        sub: 'azure-user-123',
        name: 'Azure User',
        emails: ['azure.user@example.com'],
        oid: 'azure-object-id',
        tfp: 'B2C_1_signupsignin1'
      });
      
      const req = global.testUtils.createMockRequest({
        headers: { authorization: `Bearer ${azureToken}` }
      });
      const res = global.testUtils.createMockResponse();
      const next = global.testUtils.createMockNext();
      
      await middleware(req, res, next);
      
      expect(req.user).toBeDefined();
      expect(req.user.sub).toBe('azure-user-123');
      expect(req.user.name).toBe('Azure User');
      expect(req.user.emails).toEqual(['azure.user@example.com']);
      expect(req.user.oid).toBe('azure-object-id');
      expect(req.user.tfp).toBe('B2C_1_signupsignin1');
      expect(next).toHaveBeenCalled();
    });

    test('should normalize user ID from different token formats', async () => {
      const middleware = jwtAuthMiddleware();
      
      // Test with 'sub' field
      const tokenWithSub = global.testUtils.generateTestJWT({ sub: 'user-sub-123' });
      const req1 = global.testUtils.createMockRequest({
        headers: { authorization: `Bearer ${tokenWithSub}` }
      });
      const res1 = global.testUtils.createMockResponse();
      const next1 = global.testUtils.createMockNext();
      
      await middleware(req1, res1, next1);
      expect(req1.user.id).toBe('user-sub-123');
      
      // Test with 'oid' field (Azure AD B2C) - create token without 'sub' field
      const jwt = require('jsonwebtoken');
      const oidOnlyPayload = {
        iss: `https://test-tenant.b2clogin.com/test-tenant-id/v2.0/`,
        aud: process.env.AZURE_CLIENT_ID,
        name: 'Test Azure User',
        emails: ['test@example.com'],
        oid: 'user-oid-456',
        tfp: process.env.AZURE_POLICY_SIGN_UP_SIGN_IN,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
        // Note: no 'sub' field to test oid fallback
      };
      const tokenWithOid = jwt.sign(oidOnlyPayload, process.env.JWT_SECRET);
      const req2 = global.testUtils.createMockRequest({
        headers: { authorization: `Bearer ${tokenWithOid}` }
      });
      const res2 = global.testUtils.createMockResponse();
      const next2 = global.testUtils.createMockNext();
      
      await middleware(req2, res2, next2);
      expect(req2.user.id).toBe('user-oid-456');
    });
  });

  describe('Custom Validation Options', () => {
    test('should validate issuer when specified', async () => {
      const customIssuer = 'https://custom-issuer.example.com';
      const middleware = jwtAuthMiddleware({ issuer: customIssuer });
      
      const validToken = global.testUtils.generateTestJWT({ iss: customIssuer });
      
      const req = global.testUtils.createMockRequest({
        headers: { authorization: `Bearer ${validToken}` }
      });
      const res = global.testUtils.createMockResponse();
      const next = global.testUtils.createMockNext();
      
      await middleware(req, res, next);
      
      expect(req.user).toBeDefined();
      expect(next).toHaveBeenCalled();
    });

    test('should reject token with invalid issuer', async () => {
      const expectedIssuer = 'https://expected-issuer.example.com';
      const actualIssuer = 'https://malicious-issuer.example.com';
      const middleware = jwtAuthMiddleware({ issuer: expectedIssuer });
      
      const invalidToken = global.testUtils.generateTestJWT({ iss: actualIssuer });
      
      const req = global.testUtils.createMockRequest({
        headers: { authorization: `Bearer ${invalidToken}` }
      });
      const res = global.testUtils.createMockResponse();
      const next = global.testUtils.createMockNext();
      
      await middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should validate audience when specified', async () => {
      const customAudience = 'custom-audience-123';
      const middleware = jwtAuthMiddleware({ audience: customAudience });
      
      const validToken = global.testUtils.generateTestJWT({ aud: customAudience });
      
      const req = global.testUtils.createMockRequest({
        headers: { authorization: `Bearer ${validToken}` }
      });
      const res = global.testUtils.createMockResponse();
      const next = global.testUtils.createMockNext();
      
      await middleware(req, res, next);
      
      expect(req.user).toBeDefined();
      expect(next).toHaveBeenCalled();
    });

    test('should use custom algorithms when specified', async () => {
      const middleware = jwtAuthMiddleware({ algorithms: ['HS256'] });
      const validToken = global.testUtils.generateTestJWT();
      
      const req = global.testUtils.createMockRequest({
        headers: { authorization: `Bearer ${validToken}` }
      });
      const res = global.testUtils.createMockResponse();
      const next = global.testUtils.createMockNext();
      
      await middleware(req, res, next);
      
      expect(req.user).toBeDefined();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should handle JWT verification errors gracefully', async () => {
      const middleware = jwtAuthMiddleware();
      
      // Mock JWT verification to throw an error
      const originalVerify = jwt.verify;
      jwt.verify = jest.fn().mockImplementation(() => {
        throw new Error('Custom JWT error');
      });
      
      const req = global.testUtils.createMockRequest({
        headers: { authorization: 'Bearer some-token' }
      });
      const res = global.testUtils.createMockResponse();
      const next = global.testUtils.createMockNext();
      
      await middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
      expect(next).not.toHaveBeenCalled();
      
      // Restore original function
      jwt.verify = originalVerify;
    });

    test('should handle missing JWT secret gracefully', async () => {
      // Temporarily remove JWT secret
      const originalSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;
      
      const middleware = jwtAuthMiddleware();
      const req = global.testUtils.createMockRequest({
        headers: { authorization: 'Bearer some-token' }
      });
      const res = global.testUtils.createMockResponse();
      const next = global.testUtils.createMockNext();
      
      await middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication configuration error',
        code: 'AUTH_CONFIG_ERROR'
      });
      expect(next).not.toHaveBeenCalled();
      
      // Restore JWT secret
      process.env.JWT_SECRET = originalSecret;
    });
  });

  describe('Optional Authentication', () => {
    test('should support optional authentication mode', async () => {
      const middleware = jwtAuthMiddleware({ optional: true });
      
      const req = global.testUtils.createMockRequest();
      const res = global.testUtils.createMockResponse();
      const next = global.testUtils.createMockNext();
      
      await middleware(req, res, next);
      
      expect(req.user).toBeNull();
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should still validate token in optional mode when provided', async () => {
      const middleware = jwtAuthMiddleware({ optional: true });
      const validToken = global.testUtils.generateTestJWT();
      
      const req = global.testUtils.createMockRequest({
        headers: { authorization: `Bearer ${validToken}` }
      });
      const res = global.testUtils.createMockResponse();
      const next = global.testUtils.createMockNext();
      
      await middleware(req, res, next);
      
      expect(req.user).toBeDefined();
      expect(req.user.sub).toBe('test-user-id');
      expect(next).toHaveBeenCalled();
    });

    test('should reject invalid token even in optional mode', async () => {
      const middleware = jwtAuthMiddleware({ optional: true });
      const invalidToken = 'invalid-token';
      
      const req = global.testUtils.createMockRequest({
        headers: { authorization: `Bearer ${invalidToken}` }
      });
      const res = global.testUtils.createMockResponse();
      const next = global.testUtils.createMockNext();
      
      await middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Token Information Extraction', () => {
    test('should extract token metadata', async () => {
      const middleware = jwtAuthMiddleware();
      const tokenPayload = {
        sub: 'user-123',
        iat: Math.floor(Date.now() / 1000) - 300, // Issued 5 minutes ago
        exp: Math.floor(Date.now() / 1000) + 3600, // Expires in 1 hour
        jti: 'token-id-123'
      };
      const validToken = global.testUtils.generateTestJWT(tokenPayload);
      
      const req = global.testUtils.createMockRequest({
        headers: { authorization: `Bearer ${validToken}` }
      });
      const res = global.testUtils.createMockResponse();
      const next = global.testUtils.createMockNext();
      
      await middleware(req, res, next);
      
      expect(req.token).toBeDefined();
      expect(req.tokenInfo).toBeDefined();
      expect(req.tokenInfo.issuedAt).toBeDefined();
      expect(req.tokenInfo.expiresAt).toBeDefined();
      expect(req.tokenInfo.tokenId).toBe('token-id-123');
      expect(next).toHaveBeenCalled();
    });

    test('should calculate token age and remaining time', async () => {
      const middleware = jwtAuthMiddleware();
      const now = Math.floor(Date.now() / 1000);
      const tokenPayload = {
        sub: 'user-123',
        iat: now - 600, // Issued 10 minutes ago
        exp: now + 3000 // Expires in 50 minutes
      };
      const validToken = global.testUtils.generateTestJWT(tokenPayload);
      
      const req = global.testUtils.createMockRequest({
        headers: { authorization: `Bearer ${validToken}` }
      });
      const res = global.testUtils.createMockResponse();
      const next = global.testUtils.createMockNext();
      
      await middleware(req, res, next);
      
      expect(req.tokenInfo.age).toBeGreaterThan(590); // Approximately 10 minutes
      expect(req.tokenInfo.age).toBeLessThan(610);
      expect(req.tokenInfo.remainingTime).toBeGreaterThan(2990); // Approximately 50 minutes
      expect(req.tokenInfo.remainingTime).toBeLessThan(3010);
      expect(next).toHaveBeenCalled();
    });
  });
});
