// Unit tests for Azure AD B2C Configuration
// Tests configuration loading, validation, and utility functions

const azureConfig = require('../../../config/azureAdB2C');
const config = azureConfig.config;

describe('Azure AD B2C Configuration', () => {
  describe('Configuration Loading', () => {
    test('should load all required configuration properties', () => {
      expect(config).toBeDefined();
      expect(config.clientId).toBeDefined();
      expect(config.clientSecret).toBeDefined();
      expect(config.tenantName).toBeDefined();
      expect(config.tenantId).toBeDefined();
      expect(config.signUpSignInPolicy).toBeDefined();
      expect(config.redirectUri).toBeDefined();
      expect(config.postLogoutRedirectUri).toBeDefined();
    });

    test('should have valid policy configurations', () => {
      expect(config.signUpSignInPolicy).toBeDefined();
      expect(config.passwordResetPolicy).toBeDefined();
      expect(config.profileEditPolicy).toBeDefined();
      
      expect(config.signUpSignInPolicy).toBe('B2C_1_signupsignin1');
      expect(config.passwordResetPolicy).toBe('B2C_1_passwordreset1');
      expect(config.profileEditPolicy).toBe('B2C_1_profileedit1');
    });

    test('should have valid authority URLs', () => {
      const authorityUrl = azureConfig.getAuthorityUrl();
      const issuerUrl = azureConfig.getIssuerUrl();
      
      expect(authorityUrl).toContain('https://');
      expect(issuerUrl).toContain('https://');
      
      expect(authorityUrl).toContain(config.tenantName);
      expect(issuerUrl).toContain(config.tenantName);
    });

    test('should have valid scopes configuration', () => {
      expect(config.scope).toBeDefined();
      expect(typeof config.scope).toBe('string');
      expect(config.scope.length).toBeGreaterThan(0);
      
      // Should include default scopes
      expect(config.scope).toContain('openid');
      expect(config.scope).toContain('profile');
    });

    test('should have session and token configuration', () => {
      expect(config.sessionTimeout).toBeDefined();
      expect(config.inactivityTimeout).toBeDefined();
      expect(config.tokenRefreshThreshold).toBeDefined();
      expect(config.enableAutomaticTokenRefresh).toBeDefined();
      expect(config.enableTokenRotation).toBeDefined();
      expect(config.refreshTokenLifetime).toBeDefined();
    });

    test('should have security configuration', () => {
      expect(config.enableSessionFingerprinting).toBeDefined();
      expect(config.enableSecureTokenStorage).toBeDefined();
      expect(config.sessionSecurityLevel).toBeDefined();
      
      expect(['standard', 'high', 'maximum']).toContain(config.sessionSecurityLevel);
    });
  });

  describe('Utility Functions', () => {
    test('generateTokenRefreshUrl should return valid URL', () => {
      const url = azureConfig.generateTokenRefreshUrl();
      
      expect(url).toBeDefined();
      expect(url).toContain('https://');
      expect(url).toContain(config.tenantName);
      expect(url).toContain('oauth2/v2.0/token');
    });

    test('getSessionTimeoutConfig should return correct timeout for standard level', () => {
      const timeoutConfig = azureConfig.getSessionTimeoutConfig('standard');
      
      expect(timeoutConfig).toBeDefined();
      expect(timeoutConfig.sessionTimeout).toBeDefined();
      expect(timeoutConfig.inactivityTimeout).toBeDefined();
      expect(timeoutConfig.extendedSessionTimeout).toBeDefined();
      
      expect(typeof timeoutConfig.sessionTimeout).toBe('number');
      expect(typeof timeoutConfig.inactivityTimeout).toBe('number');
      expect(typeof timeoutConfig.extendedSessionTimeout).toBe('number');
    });

    test('getSessionTimeoutConfig should return correct timeout for high level', () => {
      const timeoutConfig = azureConfig.getSessionTimeoutConfig('high');
      
      expect(timeoutConfig).toBeDefined();
      expect(timeoutConfig.sessionTimeout).toBeLessThan(config.sessionTimeout);
      expect(timeoutConfig.inactivityTimeout).toBeLessThan(config.inactivityTimeout);
    });

    test('getSessionTimeoutConfig should return correct timeout for maximum level', () => {
      const timeoutConfig = azureConfig.getSessionTimeoutConfig('maximum');
      
      expect(timeoutConfig).toBeDefined();
      expect(timeoutConfig.sessionTimeout).toBeLessThan(config.sessionTimeout * 0.5);
      expect(timeoutConfig.inactivityTimeout).toBeLessThan(config.inactivityTimeout * 0.5);
    });

    test('needsTokenRefresh should correctly identify tokens needing refresh', () => {
      const now = Date.now();
      const soonToExpire = now + (config.tokenRefreshThreshold - 1000); // 1 second before threshold
      const notExpiringSoon = now + (config.tokenRefreshThreshold + 60000); // 1 minute after threshold
      
      expect(azureConfig.needsTokenRefresh(soonToExpire)).toBe(true);
      expect(azureConfig.needsTokenRefresh(notExpiringSoon)).toBe(false);
    });

    test('needsTokenRefresh should handle custom threshold', () => {
      const now = Date.now();
      const customThreshold = 10 * 60 * 1000; // 10 minutes
      const soonToExpire = now + (customThreshold - 1000);
      const notExpiringSoon = now + (customThreshold + 60000);
      
      expect(azureConfig.needsTokenRefresh(soonToExpire, customThreshold)).toBe(true);
      expect(azureConfig.needsTokenRefresh(notExpiringSoon, customThreshold)).toBe(false);
    });

    test('getTokenLifetimeConfig should return valid configuration', () => {
      const lifetimeConfig = azureConfig.getTokenLifetimeConfig();
      
      expect(lifetimeConfig).toBeDefined();
      expect(lifetimeConfig.refreshTokenLifetime).toBeDefined();
      expect(lifetimeConfig.accessTokenLifetime).toBeDefined();
      expect(lifetimeConfig.idTokenLifetime).toBeDefined();
      expect(lifetimeConfig.tokenRefreshThreshold).toBeDefined();
      expect(lifetimeConfig.sessionTimeout).toBeDefined();
      
      expect(typeof lifetimeConfig.refreshTokenLifetime).toBe('number');
      expect(typeof lifetimeConfig.accessTokenLifetime).toBe('number');
      expect(typeof lifetimeConfig.tokenRefreshThreshold).toBe('number');
    });
  });

  describe('Configuration Validation', () => {
    test('should have non-empty required string values', () => {
      expect(config.clientId).toBeTruthy();
      expect(config.clientSecret).toBeTruthy();
      expect(config.tenantName).toBeTruthy();
      expect(config.tenantId).toBeTruthy();
      expect(config.redirectUri).toBeTruthy();
      expect(config.postLogoutRedirectUri).toBeTruthy();
    });

    test('should have positive numeric values for timeouts', () => {
      expect(config.sessionTimeout).toBeGreaterThan(0);
      expect(config.inactivityTimeout).toBeGreaterThan(0);
      expect(config.extendedSessionTimeout).toBeGreaterThan(0);
      expect(config.tokenRefreshThreshold).toBeGreaterThan(0);
      expect(config.refreshTokenLifetime).toBeGreaterThan(0);
    });

    test('should have logical timeout relationships', () => {
      // Session timeout should be greater than inactivity timeout
      expect(config.sessionTimeout).toBeGreaterThan(config.inactivityTimeout);
      
      // Extended session timeout should be greater than regular session timeout
      expect(config.extendedSessionTimeout).toBeGreaterThan(config.sessionTimeout);
      
      // Refresh token lifetime should be greater than session timeout
      expect(config.refreshTokenLifetime).toBeGreaterThan(config.sessionTimeout);
    });

    test('should have valid redirect URIs', () => {
      expect(config.redirectUri).toMatch(/^https?:\/\/.+/);
      expect(config.postLogoutRedirectUri).toMatch(/^https?:\/\/.+/);
    });
  });

  describe('Environment-specific Configuration', () => {
    test('should handle test environment correctly', () => {
      expect(process.env.NODE_ENV).toBe('test');
      
      // Configuration should still be valid in test environment
      expect(config.clientId).toBe('test-client-id');
      expect(config.tenantName).toBe('test-tenant');
    });

    test('should have appropriate test values', () => {
      expect(config.clientId).toContain('test');
      expect(config.clientSecret).toContain('test');
      expect(config.tenantName).toContain('test');
      expect(config.tenantId).toContain('test');
    });
  });

  describe('Authority URL Generation', () => {
    test('should generate correct authority URLs for all policies', () => {
      const authorityUrl = azureConfig.getAuthorityUrl();
      const loginUrl = azureConfig.generateLoginUrl();
      const passwordResetUrl = azureConfig.generatePasswordResetUrl();
      
      expect(authorityUrl).toContain(`https://${config.domain}`);
      expect(loginUrl).toContain(`https://${config.domain}`);
      expect(passwordResetUrl).toContain(`https://${config.domain}`);
      
      expect(authorityUrl).toContain(config.signUpSignInPolicy);
      expect(passwordResetUrl).toContain(config.passwordResetPolicy);
    });

    test('should handle tenant name variations', () => {
      const authorityUrl = azureConfig.getAuthorityUrl();
      
      // Authority URLs should work with different tenant name formats
      expect(authorityUrl).toContain('.b2clogin.com');
      expect(authorityUrl).not.toContain('..'); // No double dots
      expect(authorityUrl.replace('https://', '')).not.toContain('//'); // No double slashes except after protocol
    });
  });

  describe('Security Level Configuration', () => {
    test('should handle all security levels', () => {
      const levels = ['standard', 'high', 'maximum'];
      
      levels.forEach(level => {
        const timeoutConfig = azureConfig.getSessionTimeoutConfig(level);
        expect(timeoutConfig).toBeDefined();
        expect(timeoutConfig.sessionTimeout).toBeGreaterThan(0);
        expect(timeoutConfig.inactivityTimeout).toBeGreaterThan(0);
      });
    });

    test('should have progressively stricter timeouts for higher security levels', () => {
      const standardConfig = azureConfig.getSessionTimeoutConfig('standard');
      const highConfig = azureConfig.getSessionTimeoutConfig('high');
      const maximumConfig = azureConfig.getSessionTimeoutConfig('maximum');
      
      expect(standardConfig.sessionTimeout).toBeGreaterThan(highConfig.sessionTimeout);
      expect(highConfig.sessionTimeout).toBeGreaterThan(maximumConfig.sessionTimeout);
      
      expect(standardConfig.inactivityTimeout).toBeGreaterThan(highConfig.inactivityTimeout);
      expect(highConfig.inactivityTimeout).toBeGreaterThan(maximumConfig.inactivityTimeout);
    });
  });
});
