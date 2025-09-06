// Integration tests for Google OAuth through Microsoft Entra External ID
// Tests complete OAuth flow with Google as identity provider

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

describe('Google OAuth Integration Tests', () => {
  let app;
  let server;

  beforeAll(async () => {
    // Import app after mocks are set up
    const appModule = require('../../../index');
    app = appModule.app || appModule;
    
    // Start server on a test port
    server = app.listen(0, () => {
      console.log(`Google OAuth Test server running on port ${server.address().port}`);
    });
    
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  describe('Google OAuth Configuration', () => {
    test('should provide Google-specific OAuth configuration', async () => {
      const response = await request(app)
        .get('/auth/config/google')
        .expect(200);

      expect(response.body).toHaveProperty('provider', 'google');
      expect(response.body).toHaveProperty('clientId');
      expect(response.body).toHaveProperty('authority');
      expect(response.body).toHaveProperty('scopes');
      expect(response.body.scopes).toContain('openid');
      expect(response.body.scopes).toContain('profile');
      expect(response.body.scopes).toContain('email');
    });

    test('should generate Google OAuth login URL', async () => {
      const response = await request(app)
        .get('/auth/google/login-url')
        .query({
          state: 'google-state-123',
          nonce: 'google-nonce-456'
        })
        .expect(200);

      expect(response.body).toHaveProperty('loginUrl');
      expect(response.body.loginUrl).toContain('https://');
      expect(response.body.loginUrl).toContain('.ciamlogin.com');
      expect(response.body.loginUrl).toContain('oauth2/v2.0/authorize');
      expect(response.body.loginUrl).toContain('state=google-state-123');
      expect(response.body.loginUrl).toContain('nonce=google-nonce-456');
      expect(response.body.loginUrl).toContain('domain_hint=google.com');
    });

    test('should provide Google OAuth metadata', async () => {
      const response = await request(app)
        .get('/auth/google/metadata')
        .expect(200);

      expect(response.body).toHaveProperty('issuer');
      expect(response.body).toHaveProperty('authorizationEndpoint');
      expect(response.body).toHaveProperty('tokenEndpoint');
      expect(response.body).toHaveProperty('userInfoEndpoint');
      expect(response.body).toHaveProperty('jwksUri');
      expect(response.body.issuer).toContain('.ciamlogin.com');
    });
  });

  describe('Google OAuth Token Processing', () => {
    test('should process Google OAuth callback with valid token', async () => {
      // Create a Google-specific Microsoft Entra External ID token
      const googleToken = global.testUtils.generateTestAzureToken({
        iss: `https://test-tenant.ciamlogin.com/test-tenant-id/v2.0/`,
        aud: process.env.ENTRA_EXTERNAL_ID_CLIENT_ID,
        idp: 'google.com',
        emails: ['user@gmail.com'],
        name: 'John Google User',
        given_name: 'John',
        family_name: 'User',
        picture: 'https://lh3.googleusercontent.com/a/profile-pic',
        email_verified: true,
        idp_access_token: 'google-access-token-123',
        idp_id_token: 'google-id-token-456',
        locale: 'en',
        nonce: 'google-nonce-123'
      });

      const response = await request(app)
        .post('/auth/google/callback')
        .send({
          id_token: googleToken,
          state: 'google-auth-state-123',
          code: 'google-auth-code-456'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('tokens');
      
      // Verify Google-specific user data
      expect(response.body.user).toHaveProperty('identityProvider', 'google.com');
      expect(response.body.user.emails).toContain('user@gmail.com');
      expect(response.body.user).toHaveProperty('given_name', 'John');
      expect(response.body.user).toHaveProperty('family_name', 'User');
      expect(response.body.user).toHaveProperty('picture');
      expect(response.body.user).toHaveProperty('email_verified', true);
      expect(response.body.user).toHaveProperty('locale', 'en');
    });

    test('should handle Google OAuth token with minimal profile', async () => {
      // Test with minimal Google profile data
      const minimalGoogleToken = global.testUtils.generateTestAzureToken({
        iss: `https://test-tenant.ciamlogin.com/test-tenant-id/v2.0/`,
        aud: process.env.ENTRA_EXTERNAL_ID_CLIENT_ID,
        idp: 'google.com',
        emails: ['minimal@gmail.com'],
        name: 'Minimal User',
        email_verified: false
      });

      const response = await request(app)
        .post('/auth/google/callback')
        .send({
          id_token: minimalGoogleToken,
          state: 'google-minimal-state'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.user).toHaveProperty('identityProvider', 'google.com');
      expect(response.body.user.emails).toContain('minimal@gmail.com');
      expect(response.body.user).toHaveProperty('email_verified', false);
    });

    test('should validate Google OAuth token signature', async () => {
      // Create an invalid token (wrong signature)
      const invalidToken = jwt.sign({
        iss: `https://test-tenant.ciamlogin.com/test-tenant-id/v2.0/`,
        aud: process.env.ENTRA_EXTERNAL_ID_CLIENT_ID,
        idp: 'google.com',
        emails: ['invalid@gmail.com']
      }, 'wrong-secret');

      const response = await request(app)
        .post('/auth/google/callback')
        .send({
          id_token: invalidToken,
          state: 'google-invalid-state'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid token signature');
    });

    test('should validate Google OAuth token expiration', async () => {
      // Create an expired Google token
      const expiredToken = global.testUtils.generateTestAzureToken({
        iss: `https://test-tenant.ciamlogin.com/test-tenant-id/v2.0/`,
        aud: process.env.ENTRA_EXTERNAL_ID_CLIENT_ID,
        idp: 'google.com',
        emails: ['expired@gmail.com'],
        exp: Math.floor(Date.now() / 1000) - 3600 // Expired 1 hour ago
      });

      const response = await request(app)
        .post('/auth/google/callback')
        .send({
          id_token: expiredToken,
          state: 'google-expired-state'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Token expired');
    });
  });

  describe('Google Profile Management', () => {
    test('should retrieve Google user profile after authentication', async () => {
      const googleToken = global.testUtils.generateTestAzureToken({
        idp: 'google.com',
        emails: ['profile@gmail.com'],
        name: 'Profile User',
        given_name: 'Profile',
        family_name: 'User',
        picture: 'https://lh3.googleusercontent.com/a/profile-pic',
        locale: 'en-US',
        email_verified: true
      });

      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${googleToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('profile');
      expect(response.body.profile).toHaveProperty('identityProvider', 'google.com');
      expect(response.body.profile).toHaveProperty('picture');
      expect(response.body.profile).toHaveProperty('locale', 'en-US');
      expect(response.body.profile).toHaveProperty('email_verified', true);
    });

    test('should handle Google profile picture updates', async () => {
      const googleToken = global.testUtils.generateTestAzureToken({
        idp: 'google.com',
        emails: ['picture@gmail.com'],
        name: 'Picture User'
      });

      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${googleToken}`)
        .send({
          picture: 'https://lh3.googleusercontent.com/a/new-profile-pic',
          locale: 'es-ES'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('updated', true);
      expect(response.body.profile).toHaveProperty('picture');
      expect(response.body.profile).toHaveProperty('locale', 'es-ES');
    });
  });

  describe('Google OAuth Error Scenarios', () => {
    test('should handle Google OAuth authorization errors', async () => {
      const response = await request(app)
        .post('/auth/google/callback')
        .send({
          error: 'access_denied',
          error_description: 'User denied access',
          state: 'google-denied-state'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'access_denied');
      expect(response.body).toHaveProperty('error_description', 'User denied access');
    });

    test('should handle Google OAuth invalid state parameter', async () => {
      const googleToken = global.testUtils.generateTestAzureToken({
        idp: 'google.com',
        emails: ['state@gmail.com']
      });

      const response = await request(app)
        .post('/auth/google/callback')
        .send({
          id_token: googleToken,
          state: 'invalid-google-state'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid state parameter');
    });

    test('should handle Google OAuth nonce mismatch', async () => {
      const googleToken = global.testUtils.generateTestAzureToken({
        idp: 'google.com',
        emails: ['nonce@gmail.com'],
        nonce: 'correct-nonce-123'
      });

      const response = await request(app)
        .post('/auth/google/callback')
        .send({
          id_token: googleToken,
          state: 'google-nonce-state',
          expectedNonce: 'wrong-nonce-456'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Nonce mismatch');
    });

    test('should handle Google API rate limiting', async () => {
      // Simulate multiple rapid Google OAuth requests
      const requests = [];
      for (let i = 0; i < 20; i++) {
        const token = global.testUtils.generateTestAzureToken({
          idp: 'google.com',
          emails: [`rate-limit-${i}@gmail.com`]
        });
        
        requests.push(
          request(app)
            .post('/auth/google/callback')
            .send({
              id_token: token,
              state: `google-rate-${i}`
            })
        );
      }

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Google OAuth Token Refresh', () => {
    test('should refresh Google OAuth tokens', async () => {
      // Mock Google token refresh endpoint
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'new-google-access-token',
          refresh_token: 'new-google-refresh-token',
          id_token: global.testUtils.generateTestAzureToken({
            idp: 'google.com',
            emails: ['refresh@gmail.com']
          }),
          expires_in: 3600,
          token_type: 'Bearer'
        })
      });
      global.fetch = mockFetch;

      const refreshToken = global.testUtils.generateTestJWT({
        token_use: 'refresh',
        idp: 'google.com',
        exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60 // 7 days
      });

      const response = await request(app)
        .post('/api/token/refresh')
        .send({ 
          refreshToken,
          provider: 'google'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('tokens');
      expect(response.body.tokens).toHaveProperty('accessToken');
      expect(response.body.tokens).toHaveProperty('refreshToken');
      expect(response.body.tokens).toHaveProperty('idToken');
    });

    test('should handle Google token refresh errors', async () => {
      // Mock Google token refresh error
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          error: 'invalid_grant',
          error_description: 'Refresh token is invalid'
        })
      });
      global.fetch = mockFetch;

      const invalidRefreshToken = 'invalid-google-refresh-token';

      const response = await request(app)
        .post('/api/token/refresh')
        .send({ 
          refreshToken: invalidRefreshToken,
          provider: 'google'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('invalid_grant');
    });
  });

  describe('Google OAuth Security', () => {
    test('should validate Google OAuth audience', async () => {
      const wrongAudienceToken = global.testUtils.generateTestAzureToken({
        iss: `https://test-tenant.ciamlogin.com/test-tenant-id/v2.0/`,
        aud: 'wrong-client-id',
        idp: 'google.com',
        emails: ['audience@gmail.com']
      });

      const response = await request(app)
        .post('/auth/google/callback')
        .send({
          id_token: wrongAudienceToken,
          state: 'google-audience-state'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('Invalid audience');
    });

    test('should validate Google OAuth issuer', async () => {
      const wrongIssuerToken = global.testUtils.generateTestAzureToken({
        iss: 'https://malicious-issuer.com/v2.0/',
        aud: process.env.ENTRA_EXTERNAL_ID_CLIENT_ID,
        idp: 'google.com',
        emails: ['issuer@gmail.com']
      });

      const response = await request(app)
        .post('/auth/google/callback')
        .send({
          id_token: wrongIssuerToken,
          state: 'google-issuer-state'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('Invalid issuer');
    });

    test('should detect Google OAuth token replay attacks', async () => {
      const googleToken = global.testUtils.generateTestAzureToken({
        idp: 'google.com',
        emails: ['replay@gmail.com'],
        jti: 'google-unique-token-id-123' // JWT ID for replay detection
      });

      // First use should succeed
      const response1 = await request(app)
        .post('/auth/google/callback')
        .send({
          id_token: googleToken,
          state: 'google-replay-state-1'
        })
        .expect(200);

      expect(response1.body).toHaveProperty('success', true);

      // Second use should be detected as replay
      const response2 = await request(app)
        .post('/auth/google/callback')
        .send({
          id_token: googleToken,
          state: 'google-replay-state-2'
        })
        .expect(400);

      expect(response2.body).toHaveProperty('success', false);
      expect(response2.body.error).toContain('Token replay detected');
    });
  });

  describe('Google OAuth Integration Features', () => {
    test('should handle Google Workspace accounts', async () => {
      const workspaceToken = global.testUtils.generateTestAzureToken({
        idp: 'google.com',
        emails: ['user@company.com'],
        name: 'Workspace User',
        hd: 'company.com', // Hosted domain for G Suite/Workspace
        email_verified: true
      });

      const response = await request(app)
        .post('/auth/google/callback')
        .send({
          id_token: workspaceToken,
          state: 'google-workspace-state'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.user).toHaveProperty('identityProvider', 'google.com');
      expect(response.body.user).toHaveProperty('hostedDomain', 'company.com');
      expect(response.body.user.emails).toContain('user@company.com');
    });

    test('should handle Google account linking', async () => {
      // First login with local account
      const localToken = global.testUtils.generateTestAzureToken({
        emails: ['link@example.com'],
        name: 'Link User'
      });

      const localResponse = await request(app)
        .post('/auth/callback')
        .send({
          id_token: localToken,
          state: 'local-link-state'
        })
        .expect(200);

      const userId = localResponse.body.user.id;

      // Then link Google account
      const googleToken = global.testUtils.generateTestAzureToken({
        idp: 'google.com',
        emails: ['link@gmail.com'],
        name: 'Link User',
        sub: userId // Same user ID to indicate linking
      });

      const linkResponse = await request(app)
        .post('/auth/google/link')
        .set('Authorization', `Bearer ${localToken}`)
        .send({
          id_token: googleToken,
          state: 'google-link-state'
        })
        .expect(200);

      expect(linkResponse.body).toHaveProperty('success', true);
      expect(linkResponse.body).toHaveProperty('linked', true);
      expect(linkResponse.body.user).toHaveProperty('identityProviders');
      expect(linkResponse.body.user.identityProviders).toContain('google.com');
    });

    test('should handle Google OAuth logout', async () => {
      const googleToken = global.testUtils.generateTestAzureToken({
        idp: 'google.com',
        emails: ['logout@gmail.com']
      });

      const logoutResponse = await request(app)
        .post('/auth/google/logout')
        .set('Authorization', `Bearer ${googleToken}`)
        .send({
          postLogoutRedirectUri: 'http://localhost:3000/logged-out'
        })
        .expect(200);

      expect(logoutResponse.body).toHaveProperty('success', true);
      expect(logoutResponse.body).toHaveProperty('logoutUrl');
      expect(logoutResponse.body.logoutUrl).toContain('oauth2/v2.0/logout');
      expect(logoutResponse.body.logoutUrl).toContain('post_logout_redirect_uri');
    });
  });

  describe('Google OAuth Compliance and Privacy', () => {
    test('should handle Google OAuth GDPR data export', async () => {
      const googleToken = global.testUtils.generateTestAzureToken({
        idp: 'google.com',
        emails: ['gdpr@gmail.com'],
        name: 'GDPR User'
      });

      const response = await request(app)
        .get('/api/gdpr/export')
        .set('Authorization', `Bearer ${googleToken}`)
        .query({ format: 'json', includeProvider: 'true' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('identityProvider', 'google.com');
      expect(response.body.data).toHaveProperty('providerSpecificData');
    });

    test('should handle Google OAuth account deletion', async () => {
      const googleToken = global.testUtils.generateTestAzureToken({
        idp: 'google.com',
        emails: ['delete@gmail.com'],
        name: 'Delete User'
      });

      const response = await request(app)
        .post('/api/gdpr/delete-account')
        .set('Authorization', `Bearer ${googleToken}`)
        .send({
          reason: 'user_request',
          confirmEmail: 'delete@gmail.com'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('deletionRequestId');
      expect(response.body).toHaveProperty('estimatedCompletionTime');
    });
  });
});
