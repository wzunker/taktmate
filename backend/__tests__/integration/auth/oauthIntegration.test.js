// Integration tests for OAuth and Social Login Integration
// Tests Microsoft Entra External ID OAuth flows with Google and Microsoft accounts

const request = require('supertest');
const jwt = require('jsonwebtoken');

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

describe('OAuth Integration Tests', () => {
  let app;
  let server;

  beforeAll(async () => {
    // Import app after mocks are set up
    const appModule = require('../../../index');
    app = appModule.app || appModule;
    
    // Start server on a test port
    server = app.listen(0, () => {
      console.log(`OAuth Test server running on port ${server.address().port}`);
    });
    
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  describe('Microsoft Entra External ID OAuth Configuration', () => {
    test('should provide OAuth configuration endpoints', async () => {
      const response = await request(app)
        .get('/auth/config')
        .expect(200);

      expect(response.body).toHaveProperty('clientId');
      expect(response.body).toHaveProperty('authority');
      expect(response.body).toHaveProperty('scopes');
      expect(response.body).toHaveProperty('redirectUri');
      expect(response.body).toHaveProperty('policies');
    });

    test('should provide JWKS endpoint information', async () => {
      const response = await request(app)
        .get('/auth/jwks-uri')
        .expect(200);

      expect(response.body).toHaveProperty('jwksUri');
      expect(response.body.jwksUri).toContain('https://');
      expect(response.body.jwksUri).toContain('.ciamlogin.com');
    });

    test('should provide metadata endpoint information', async () => {
      const response = await request(app)
        .get('/auth/metadata')
        .expect(200);

      expect(response.body).toHaveProperty('metadataUrl');
      expect(response.body).toHaveProperty('issuer');
      expect(response.body).toHaveProperty('authorizationEndpoint');
      expect(response.body).toHaveProperty('tokenEndpoint');
    });
  });

  describe('OAuth Authorization Flow', () => {
    test('should generate login URL for sign-up/sign-in flow', async () => {
      const response = await request(app)
        .get('/auth/login-url')
        .query({
          state: 'test-state-123',
          nonce: 'test-nonce-456'
        })
        .expect(200);

      expect(response.body).toHaveProperty('loginUrl');
      expect(response.body.loginUrl).toContain('https://');
      expect(response.body.loginUrl).toContain('oauth2/v2.0/authorize');
      expect(response.body.loginUrl).toContain('response_type=id_token');
      expect(response.body.loginUrl).toContain('state=test-state-123');
      expect(response.body.loginUrl).toContain('nonce=test-nonce-456');
    });

    test('should generate password reset URL', async () => {
      const response = await request(app)
        .get('/auth/password-reset-url')
        .query({
          state: 'reset-state-123'
        })
        .expect(200);

      expect(response.body).toHaveProperty('resetUrl');
      expect(response.body.resetUrl).toContain('B2C_1_passwordreset');
      expect(response.body.resetUrl).toContain('state=reset-state-123');
    });

    test('should generate profile edit URL', async () => {
      const response = await request(app)
        .get('/auth/profile-edit-url')
        .query({
          state: 'edit-state-123'
        })
        .expect(200);

      expect(response.body).toHaveProperty('editUrl');
      expect(response.body.editUrl).toContain('B2C_1_profileedit');
      expect(response.body.editUrl).toContain('state=edit-state-123');
    });

    test('should generate logout URL', async () => {
      const response = await request(app)
        .get('/auth/logout-url')
        .query({
          postLogoutRedirectUri: 'http://localhost:3000/logged-out'
        })
        .expect(200);

      expect(response.body).toHaveProperty('logoutUrl');
      expect(response.body.logoutUrl).toContain('oauth2/v2.0/logout');
      expect(response.body.logoutUrl).toContain('post_logout_redirect_uri');
    });
  });

  describe('OAuth Token Processing', () => {
    test('should process OAuth callback with valid token', async () => {
      // Simulate OAuth callback with ID token
      const idToken = global.testUtils.generateTestAzureToken({
        aud: process.env.ENTRA_EXTERNAL_ID_CLIENT_ID,
        iss: `https://test-tenant.ciamlogin.com/test-tenant-id/v2.0/`,
        nonce: 'test-nonce-123',
        c_hash: 'test-code-hash'
      });

      const response = await request(app)
        .post('/auth/callback')
        .send({
          id_token: idToken,
          state: 'test-state-123',
          code: 'auth-code-456'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('tokens');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('name');
      expect(response.body.user).toHaveProperty('emails');
    });

    test('should reject OAuth callback with invalid token', async () => {
      const response = await request(app)
        .post('/auth/callback')
        .send({
          id_token: 'invalid-token',
          state: 'test-state-123'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid token');
    });

    test('should validate state parameter in OAuth callback', async () => {
      const idToken = global.testUtils.generateTestAzureToken();

      const response = await request(app)
        .post('/auth/callback')
        .send({
          id_token: idToken,
          state: 'invalid-state-parameter'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid state parameter');
    });

    test('should handle nonce validation in OAuth callback', async () => {
      const idToken = global.testUtils.generateTestAzureToken({
        nonce: 'correct-nonce-123'
      });

      const response = await request(app)
        .post('/auth/callback')
        .send({
          id_token: idToken,
          state: 'test-state-123',
          expectedNonce: 'correct-nonce-123'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('user');
    });
  });

  describe('Social Login Integration', () => {
    test('should handle Google OAuth tokens', async () => {
      // Simulate token from Google identity provider through Microsoft Entra External ID
      const googleToken = global.testUtils.generateTestAzureToken({
        iss: `https://test-tenant.ciamlogin.com/test-tenant-id/v2.0/`,
        idp: 'google.com',
        emails: ['user@gmail.com'],
        name: 'Google User',
        given_name: 'Google',
        family_name: 'User',
        idp_access_token: 'google-access-token-123'
      });

      const response = await request(app)
        .post('/auth/callback')
        .send({
          id_token: googleToken,
          state: 'google-auth-state'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.user).toHaveProperty('identityProvider', 'google.com');
      expect(response.body.user.emails).toContain('user@gmail.com');
      expect(response.body.user).toHaveProperty('given_name', 'Google');
      expect(response.body.user).toHaveProperty('family_name', 'User');
    });

    test('should handle Microsoft OAuth tokens', async () => {
      // Simulate token from Microsoft identity provider through Microsoft Entra External ID
      const microsoftToken = global.testUtils.generateTestAzureToken({
        iss: `https://test-tenant.ciamlogin.com/test-tenant-id/v2.0/`,
        idp: 'live.com',
        emails: ['user@outlook.com'],
        name: 'Microsoft User',
        given_name: 'Microsoft',
        family_name: 'User',
        idp_access_token: 'microsoft-access-token-456'
      });

      const response = await request(app)
        .post('/auth/callback')
        .send({
          id_token: microsoftToken,
          state: 'microsoft-auth-state'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.user).toHaveProperty('identityProvider', 'live.com');
      expect(response.body.user.emails).toContain('user@outlook.com');
      expect(response.body.user).toHaveProperty('given_name', 'Microsoft');
      expect(response.body.user).toHaveProperty('family_name', 'User');
    });

    test('should handle local account tokens', async () => {
      // Simulate token from local account (email/password) through Microsoft Entra External ID
      const localToken = global.testUtils.generateTestAzureToken({
        iss: `https://test-tenant.ciamlogin.com/test-tenant-id/v2.0/`,
        emails: ['local@example.com'],
        name: 'Local User',
        signInNames: ['local@example.com'],
        newUser: false
      });

      const response = await request(app)
        .post('/auth/callback')
        .send({
          id_token: localToken,
          state: 'local-auth-state'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.user.emails).toContain('local@example.com');
      expect(response.body.user).toHaveProperty('name', 'Local User');
      expect(response.body.user.signInNames).toContain('local@example.com');
    });
  });

  describe('User Profile Management', () => {
    test('should retrieve user profile after authentication', async () => {
      const authenticatedToken = global.testUtils.generateTestAzureToken({
        given_name: 'Test',
        family_name: 'User',
        emails: ['test.user@example.com'],
        city: 'San Francisco',
        country: 'United States',
        jobTitle: 'Software Engineer'
      });

      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${authenticatedToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('profile');
      expect(response.body.profile).toHaveProperty('given_name', 'Test');
      expect(response.body.profile).toHaveProperty('family_name', 'User');
      expect(response.body.profile).toHaveProperty('city', 'San Francisco');
      expect(response.body.profile).toHaveProperty('jobTitle', 'Software Engineer');
    });

    test('should update user profile with valid authentication', async () => {
      const authenticatedToken = global.testUtils.generateTestAzureToken();

      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${authenticatedToken}`)
        .send({
          given_name: 'Updated',
          family_name: 'Name',
          city: 'New York',
          jobTitle: 'Senior Engineer'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('updated', true);
      expect(response.body).toHaveProperty('profile');
    });

    test('should handle profile edit flow', async () => {
      // Get profile edit URL
      const editUrlResponse = await request(app)
        .get('/auth/profile-edit-url')
        .query({ state: 'edit-profile-state' })
        .expect(200);

      expect(editUrlResponse.body).toHaveProperty('editUrl');

      // Simulate profile edit completion
      const updatedToken = global.testUtils.generateTestAzureToken({
        given_name: 'Updated',
        family_name: 'Profile',
        city: 'Updated City'
      });

      const callbackResponse = await request(app)
        .post('/auth/callback')
        .send({
          id_token: updatedToken,
          state: 'edit-profile-state'
        })
        .expect(200);

      expect(callbackResponse.body).toHaveProperty('success', true);
      expect(callbackResponse.body.user).toHaveProperty('given_name', 'Updated');
      expect(callbackResponse.body.user).toHaveProperty('family_name', 'Profile');
    });
  });

  describe('Multi-Factor Authentication (MFA)', () => {
    test('should handle MFA-enabled user tokens', async () => {
      const mfaToken = global.testUtils.generateTestAzureToken({
        amr: ['pwd', 'mfa'], // Authentication methods: password and MFA
        acr: 'b2c_1a_mfa_policy',
        emails: ['mfa.user@example.com'],
        name: 'MFA User'
      });

      const response = await request(app)
        .post('/auth/callback')
        .send({
          id_token: mfaToken,
          state: 'mfa-auth-state'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.user).toHaveProperty('mfaEnabled', true);
      expect(response.body.user.authenticationMethods).toContain('mfa');
    });

    test('should identify authentication strength', async () => {
      const strongAuthToken = global.testUtils.generateTestAzureToken({
        amr: ['pwd', 'mfa', 'sms'],
        acr: 'b2c_1a_strong_auth_policy'
      });

      const response = await request(app)
        .post('/auth/callback')
        .send({
          id_token: strongAuthToken,
          state: 'strong-auth-state'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.user).toHaveProperty('authenticationStrength', 'strong');
      expect(response.body.user.authenticationMethods).toEqual(['pwd', 'mfa', 'sms']);
    });
  });

  describe('Token Exchange and Refresh', () => {
    test('should exchange authorization code for tokens', async () => {
      // Mock the token exchange endpoint
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'exchanged-access-token',
          id_token: global.testUtils.generateTestAzureToken(),
          refresh_token: 'exchanged-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer'
        })
      });
      global.fetch = mockFetch;

      const response = await request(app)
        .post('/auth/token-exchange')
        .send({
          code: 'authorization-code-123',
          state: 'token-exchange-state',
          redirect_uri: 'http://localhost:3000/auth/callback'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('tokens');
      expect(response.body.tokens).toHaveProperty('accessToken');
      expect(response.body.tokens).toHaveProperty('idToken');
      expect(response.body.tokens).toHaveProperty('refreshToken');
    });

    test('should handle token exchange errors', async () => {
      // Mock failed token exchange
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          error: 'invalid_grant',
          error_description: 'Authorization code is invalid'
        })
      });
      global.fetch = mockFetch;

      const response = await request(app)
        .post('/auth/token-exchange')
        .send({
          code: 'invalid-authorization-code',
          state: 'token-exchange-state'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('invalid_grant');
    });
  });

  describe('Session and Security', () => {
    test('should handle concurrent login attempts', async () => {
      const user1Token = global.testUtils.generateTestAzureToken({
        sub: 'concurrent-user-1',
        sessionId: 'session-1'
      });

      const user2Token = global.testUtils.generateTestAzureToken({
        sub: 'concurrent-user-2',
        sessionId: 'session-2'
      });

      // Simulate concurrent login callbacks
      const [response1, response2] = await Promise.all([
        request(app)
          .post('/auth/callback')
          .send({
            id_token: user1Token,
            state: 'concurrent-state-1'
          }),
        request(app)
          .post('/auth/callback')
          .send({
            id_token: user2Token,
            state: 'concurrent-state-2'
          })
      ]);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(response1.body.user.sub).not.toBe(response2.body.user.sub);
    });

    test('should detect and prevent token replay attacks', async () => {
      const replayToken = global.testUtils.generateTestAzureToken({
        jti: 'unique-token-id-123' // JWT ID for replay detection
      });

      // First use of the token should succeed
      const response1 = await request(app)
        .post('/auth/callback')
        .send({
          id_token: replayToken,
          state: 'replay-test-state-1'
        })
        .expect(200);

      expect(response1.body).toHaveProperty('success', true);

      // Second use of the same token should be detected as replay
      const response2 = await request(app)
        .post('/auth/callback')
        .send({
          id_token: replayToken,
          state: 'replay-test-state-2'
        })
        .expect(400);

      expect(response2.body).toHaveProperty('success', false);
      expect(response2.body.error).toContain('Token replay detected');
    });

    test('should validate token audience and issuer', async () => {
      const wrongAudienceToken = global.testUtils.generateTestAzureToken({
        aud: 'wrong-client-id'
      });

      const response = await request(app)
        .post('/auth/callback')
        .send({
          id_token: wrongAudienceToken,
          state: 'audience-test-state'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('Invalid audience');
    });
  });

  describe('Error Scenarios and Edge Cases', () => {
    test('should handle network timeouts gracefully', async () => {
      // Mock network timeout
      const mockFetch = jest.fn().mockRejectedValue(new Error('Network timeout'));
      global.fetch = mockFetch;

      const response = await request(app)
        .post('/auth/token-exchange')
        .send({
          code: 'test-code',
          state: 'timeout-test-state'
        })
        .expect(500);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Network timeout');
    });

    test('should handle malformed OAuth responses', async () => {
      // Mock malformed response
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          // Missing required fields
          token_type: 'Bearer'
        })
      });
      global.fetch = mockFetch;

      const response = await request(app)
        .post('/auth/token-exchange')
        .send({
          code: 'test-code',
          state: 'malformed-test-state'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    test('should handle missing required claims in tokens', async () => {
      const incompleteToken = jwt.sign({
        iss: `https://test-tenant.ciamlogin.com/test-tenant-id/v2.0/`,
        aud: process.env.ENTRA_EXTERNAL_ID_CLIENT_ID,
        // Missing required claims like 'sub', 'exp', etc.
        iat: Math.floor(Date.now() / 1000)
      }, process.env.JWT_SECRET);

      const response = await request(app)
        .post('/auth/callback')
        .send({
          id_token: incompleteToken,
          state: 'incomplete-token-state'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('Missing required claims');
    });
  });
});
