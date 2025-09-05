// Unit tests for Token Management Service
// Tests token validation, refresh, session fingerprinting, and security features

const { TokenManagementService } = require('../../../middleware/tokenManagement');
const jwt = require('jsonwebtoken');

// Mock dependencies
jest.mock('applicationinsights', () => ({
  telemetry: {
    trackEvent: jest.fn(),
    trackException: jest.fn()
  }
}));

describe('TokenManagementService', () => {
  let tokenManagement;
  let mockAppInsights;

  beforeEach(() => {
    mockAppInsights = {
      telemetry: {
        trackEvent: jest.fn(),
        trackException: jest.fn()
      }
    };

    tokenManagement = new TokenManagementService(mockAppInsights);
  });

  describe('Service Initialization', () => {
    test('should initialize with default configuration', () => {
      expect(tokenManagement).toBeDefined();
      expect(tokenManagement.appInsights).toBe(mockAppInsights);
      expect(tokenManagement.tokenCache).toBeDefined();
      expect(tokenManagement.sessionFingerprints).toBeDefined();
    });

    test('should initialize without Application Insights', () => {
      const service = new TokenManagementService();
      expect(service).toBeDefined();
      expect(service.appInsights).toBeNull();
    });

    test('should have correct configuration values', () => {
      expect(tokenManagement.config.enableAutomaticTokenRefresh).toBeDefined();
      expect(tokenManagement.config.enableTokenRotation).toBeDefined();
      expect(tokenManagement.config.enableSessionFingerprinting).toBeDefined();
      expect(tokenManagement.config.tokenRefreshThreshold).toBeGreaterThan(0);
      expect(tokenManagement.config.refreshTokenLifetime).toBeGreaterThan(0);
    });
  });

  describe('Token Validation', () => {
    test('should validate a valid JWT token', async () => {
      const validToken = global.testUtils.generateTestAzureToken();
      
      const result = await tokenManagement.validateToken(validToken);
      
      expect(result.isValid).toBe(true);
      expect(result.payload).toBeDefined();
      expect(result.payload.sub).toBe('test-azure-user-id');
      expect(result.payload.name).toBe('Test Azure User');
      expect(result.errors).toHaveLength(0);
    });

    test('should reject an expired token', async () => {
      const expiredToken = global.testUtils.generateTestAzureToken({
        exp: Math.floor(Date.now() / 1000) - 3600 // Expired 1 hour ago
      });
      
      const result = await tokenManagement.validateToken(expiredToken);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Token has expired');
    });

    test('should reject a token with invalid signature', async () => {
      const invalidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.invalid-signature';
      
      const result = await tokenManagement.validateToken(invalidToken);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should reject a malformed token', async () => {
      const malformedToken = 'not.a.valid.jwt.token';
      
      const result = await tokenManagement.validateToken(malformedToken);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Malformed token');
    });

    test('should validate token with custom options', async () => {
      const validToken = global.testUtils.generateTestAzureToken();
      
      const result = await tokenManagement.validateToken(validToken, {
        ignoreExpiration: false,
        clockTolerance: 30,
        validateIssuer: true,
        validateAudience: true
      });
      
      expect(result.isValid).toBe(true);
      expect(result.validationOptions).toBeDefined();
    });

    test('should perform security validations', async () => {
      const validToken = global.testUtils.generateTestAzureToken();
      
      const result = await tokenManagement.validateToken(validToken, {
        performSecurityValidations: true
      });
      
      expect(result.isValid).toBe(true);
      expect(result.securityValidations).toBeDefined();
      expect(result.securityValidations.issuerValidation).toBe(true);
      expect(result.securityValidations.audienceValidation).toBe(true);
    });
  });

  describe('Token Refresh', () => {
    test('should refresh a valid refresh token', async () => {
      const refreshToken = global.testUtils.generateTestAzureToken({
        token_use: 'refresh'
      });
      
      // Mock successful refresh response
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
      
      const result = await tokenManagement.refreshToken(refreshToken);
      
      expect(result.success).toBe(true);
      expect(result.tokens).toBeDefined();
      expect(result.tokens.accessToken).toBe('new-access-token');
      expect(result.tokens.refreshToken).toBe('new-refresh-token');
      expect(result.tokens.expiresIn).toBe(3600);
    });

    test('should handle refresh token failure', async () => {
      const invalidRefreshToken = 'invalid-refresh-token';
      
      // Mock failed refresh response
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          error: 'invalid_grant',
          error_description: 'Refresh token is invalid'
        })
      });
      global.fetch = mockFetch;
      
      const result = await tokenManagement.refreshToken(invalidRefreshToken);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('invalid_grant');
    });

    test('should implement retry logic for refresh failures', async () => {
      const refreshToken = global.testUtils.generateTestAzureToken({
        token_use: 'refresh'
      });
      
      let callCount = 0;
      const mockFetch = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          // Fail first 2 attempts
          return Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({ error: 'server_error' })
          });
        } else {
          // Succeed on 3rd attempt
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              access_token: 'new-access-token',
              refresh_token: 'new-refresh-token',
              expires_in: 3600
            })
          });
        }
      });
      global.fetch = mockFetch;
      
      const result = await tokenManagement.refreshToken(refreshToken, {
        maxRetries: 3,
        retryDelay: 100
      });
      
      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('Session Fingerprinting', () => {
    test('should create session fingerprint', () => {
      const mockRequest = global.testUtils.createMockRequest({
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'accept-language': 'en-US,en;q=0.9'
        },
        ip: '192.168.1.100'
      });
      
      const fingerprint = tokenManagement.createSessionFingerprint(mockRequest);
      
      expect(fingerprint).toBeDefined();
      expect(typeof fingerprint).toBe('string');
      expect(fingerprint.length).toBeGreaterThan(0);
    });

    test('should create consistent fingerprints for same request', () => {
      const mockRequest = global.testUtils.createMockRequest({
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'accept-language': 'en-US,en;q=0.9'
        },
        ip: '192.168.1.100'
      });
      
      const fingerprint1 = tokenManagement.createSessionFingerprint(mockRequest);
      const fingerprint2 = tokenManagement.createSessionFingerprint(mockRequest);
      
      expect(fingerprint1).toBe(fingerprint2);
    });

    test('should create different fingerprints for different requests', () => {
      const mockRequest1 = global.testUtils.createMockRequest({
        headers: { 'user-agent': 'Chrome' },
        ip: '192.168.1.100'
      });
      
      const mockRequest2 = global.testUtils.createMockRequest({
        headers: { 'user-agent': 'Firefox' },
        ip: '192.168.1.101'
      });
      
      const fingerprint1 = tokenManagement.createSessionFingerprint(mockRequest1);
      const fingerprint2 = tokenManagement.createSessionFingerprint(mockRequest2);
      
      expect(fingerprint1).not.toBe(fingerprint2);
    });

    test('should validate session fingerprint', () => {
      const sessionId = 'test-session-123';
      const fingerprint = 'test-fingerprint-hash';
      
      // Store fingerprint
      tokenManagement.sessionFingerprints.set(sessionId, fingerprint);
      
      const isValid = tokenManagement.validateSessionFingerprint(sessionId, fingerprint);
      expect(isValid).toBe(true);
      
      const isInvalid = tokenManagement.validateSessionFingerprint(sessionId, 'different-fingerprint');
      expect(isInvalid).toBe(false);
    });
  });

  describe('Token Caching', () => {
    test('should cache validated tokens', async () => {
      const validToken = global.testUtils.generateTestAzureToken();
      
      const result1 = await tokenManagement.validateToken(validToken, { enableCaching: true });
      const result2 = await tokenManagement.validateToken(validToken, { enableCaching: true });
      
      expect(result1.isValid).toBe(true);
      expect(result2.isValid).toBe(true);
      expect(result2.fromCache).toBe(true);
    });

    test('should respect cache TTL', async () => {
      const validToken = global.testUtils.generateTestAzureToken();
      
      await tokenManagement.validateToken(validToken, { 
        enableCaching: true,
        cacheTTL: 100 // 100ms
      });
      
      // Wait for cache to expire
      await global.testUtils.waitFor(150);
      
      const result = await tokenManagement.validateToken(validToken, { enableCaching: true });
      expect(result.fromCache).toBe(false);
    });

    test('should clear token cache', () => {
      const tokenHash = 'test-token-hash';
      tokenManagement.tokenCache.set(tokenHash, { isValid: true });
      
      expect(tokenManagement.tokenCache.has(tokenHash)).toBe(true);
      
      tokenManagement.clearTokenCache();
      
      expect(tokenManagement.tokenCache.has(tokenHash)).toBe(false);
    });
  });

  describe('Security Validations', () => {
    test('should perform issuer validation', async () => {
      const validToken = global.testUtils.generateTestAzureToken();
      
      const result = await tokenManagement.performSecurityValidations(
        jwt.decode(validToken), 
        validToken,
        { validateIssuer: true }
      );
      
      expect(result.issuerValidation).toBe(true);
    });

    test('should perform audience validation', async () => {
      const validToken = global.testUtils.generateTestAzureToken();
      
      const result = await tokenManagement.performSecurityValidations(
        jwt.decode(validToken), 
        validToken,
        { validateAudience: true }
      );
      
      expect(result.audienceValidation).toBe(true);
    });

    test('should detect token replay attacks', async () => {
      const validToken = global.testUtils.generateTestAzureToken();
      const payload = jwt.decode(validToken);
      
      // First use should be valid
      const result1 = await tokenManagement.performSecurityValidations(payload, validToken, {
        detectReplay: true
      });
      expect(result1.replayDetection).toBe(true);
      
      // Second use should be detected as replay
      const result2 = await tokenManagement.performSecurityValidations(payload, validToken, {
        detectReplay: true
      });
      expect(result2.replayDetection).toBe(false);
    });

    test('should validate token binding', async () => {
      const validToken = global.testUtils.generateTestAzureToken({
        cnf: { 'x5t#S256': 'test-certificate-thumbprint' }
      });
      const payload = jwt.decode(validToken);
      
      const result = await tokenManagement.performSecurityValidations(payload, validToken, {
        validateBinding: true,
        certificateThumbprint: 'test-certificate-thumbprint'
      });
      
      expect(result.bindingValidation).toBe(true);
    });
  });

  describe('Middleware Functions', () => {
    test('should create token middleware', () => {
      const middleware = tokenManagement.createTokenMiddleware();
      
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });

    test('should create auto-refresh middleware', () => {
      const middleware = tokenManagement.createAutoRefreshMiddleware();
      
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });

    test('token middleware should process valid token', async () => {
      const middleware = tokenManagement.createTokenMiddleware();
      const validToken = global.testUtils.generateTestAzureToken();
      
      const req = global.testUtils.createMockRequest({
        headers: { authorization: `Bearer ${validToken}` }
      });
      const res = global.testUtils.createMockResponse();
      const next = global.testUtils.createMockNext();
      
      await middleware(req, res, next);
      
      expect(req.token).toBeDefined();
      expect(req.tokenValidation).toBeDefined();
      expect(req.tokenValidation.isValid).toBe(true);
      expect(next).toHaveBeenCalled();
    });

    test('token middleware should handle missing token', async () => {
      const middleware = tokenManagement.createTokenMiddleware();
      
      const req = global.testUtils.createMockRequest();
      const res = global.testUtils.createMockResponse();
      const next = global.testUtils.createMockNext();
      
      await middleware(req, res, next);
      
      expect(req.token).toBeNull();
      expect(next).toHaveBeenCalled();
    });

    test('auto-refresh middleware should refresh expiring token', async () => {
      const middleware = tokenManagement.createAutoRefreshMiddleware();
      const expiringToken = global.testUtils.generateTestAzureToken({
        exp: Math.floor(Date.now() / 1000) + 300 // Expires in 5 minutes
      });
      
      // Mock successful refresh
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'refreshed-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600
        })
      });
      global.fetch = mockFetch;
      
      const req = global.testUtils.createMockRequest({
        headers: { authorization: `Bearer ${expiringToken}` },
        session: { refreshToken: 'test-refresh-token' }
      });
      const res = global.testUtils.createMockResponse();
      const next = global.testUtils.createMockNext();
      
      await middleware(req, res, next);
      
      expect(req.tokenRefreshed).toBe(true);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Statistics and Monitoring', () => {
    test('should track token validation statistics', async () => {
      const validToken = global.testUtils.generateTestAzureToken();
      
      await tokenManagement.validateToken(validToken);
      
      const stats = tokenManagement.getStatistics();
      expect(stats.tokenValidations).toBeGreaterThan(0);
      expect(stats.validTokens).toBeGreaterThan(0);
    });

    test('should track token refresh statistics', async () => {
      const refreshToken = global.testUtils.generateTestAzureToken({ token_use: 'refresh' });
      
      // Mock successful refresh
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600
        })
      });
      global.fetch = mockFetch;
      
      await tokenManagement.refreshToken(refreshToken);
      
      const stats = tokenManagement.getStatistics();
      expect(stats.tokenRefreshes).toBeGreaterThan(0);
      expect(stats.successfulRefreshes).toBeGreaterThan(0);
    });

    test('should get comprehensive statistics', () => {
      const stats = tokenManagement.getStatistics();
      
      expect(stats).toBeDefined();
      expect(stats.tokenValidations).toBeDefined();
      expect(stats.validTokens).toBeDefined();
      expect(stats.invalidTokens).toBeDefined();
      expect(stats.tokenRefreshes).toBeDefined();
      expect(stats.successfulRefreshes).toBeDefined();
      expect(stats.failedRefreshes).toBeDefined();
      expect(stats.cacheHits).toBeDefined();
      expect(stats.cacheMisses).toBeDefined();
      expect(stats.securityViolations).toBeDefined();
      expect(stats.sessionFingerprints).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle token validation errors gracefully', async () => {
      const malformedToken = 'definitely.not.a.jwt';
      
      const result = await tokenManagement.validateToken(malformedToken);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should handle refresh token errors gracefully', async () => {
      const invalidRefreshToken = 'invalid-refresh-token';
      
      // Mock network error
      const mockFetch = jest.fn().mockRejectedValue(new Error('Network error'));
      global.fetch = mockFetch;
      
      const result = await tokenManagement.refreshToken(invalidRefreshToken);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    test('should track errors in Application Insights', async () => {
      const malformedToken = 'malformed.token';
      
      await tokenManagement.validateToken(malformedToken);
      
      expect(mockAppInsights.telemetry.trackEvent).toHaveBeenCalledWith(
        expect.stringContaining('Token_Validation'),
        expect.objectContaining({
          isValid: 'false'
        })
      );
    });
  });
});
