// Integration tests for Microsoft OAuth through Microsoft Entra External ID
// Tests complete OAuth flow with Microsoft as identity provider

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

describe('Microsoft OAuth Integration Tests', () => {
  let app;
  let server;

  beforeAll(async () => {
    // Import app after mocks are set up
    const appModule = require('../../../index');
    app = appModule.app || appModule;
    
    // Start server on a test port
    server = app.listen(0, () => {
      console.log(`Microsoft OAuth Test server running on port ${server.address().port}`);
    });
    
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  describe('Microsoft OAuth Configuration', () => {
    test('should provide Microsoft-specific OAuth configuration', async () => {
      const response = await request(app)
        .get('/auth/config/microsoft')
        .expect(200);

      expect(response.body).toHaveProperty('provider', 'microsoft');
      expect(response.body).toHaveProperty('clientId');
      expect(response.body).toHaveProperty('authority');
      expect(response.body).toHaveProperty('scopes');
      expect(response.body.scopes).toContain('openid');
      expect(response.body.scopes).toContain('profile');
      expect(response.body.scopes).toContain('email');
      expect(response.body.scopes).toContain('User.Read');
    });

    test('should generate Microsoft OAuth login URL', async () => {
      const response = await request(app)
        .get('/auth/microsoft/login-url')
        .query({
          state: 'microsoft-state-123',
          nonce: 'microsoft-nonce-456'
        })
        .expect(200);

      expect(response.body).toHaveProperty('loginUrl');
      expect(response.body.loginUrl).toContain('https://');
      expect(response.body.loginUrl).toContain('.ciamlogin.com');
      expect(response.body.loginUrl).toContain('oauth2/v2.0/authorize');
      expect(response.body.loginUrl).toContain('state=microsoft-state-123');
      expect(response.body.loginUrl).toContain('nonce=microsoft-nonce-456');
      expect(response.body.loginUrl).toContain('domain_hint=live.com');
    });

    test('should provide Microsoft OAuth metadata', async () => {
      const response = await request(app)
        .get('/auth/microsoft/metadata')
        .expect(200);

      expect(response.body).toHaveProperty('issuer');
      expect(response.body).toHaveProperty('authorizationEndpoint');
      expect(response.body).toHaveProperty('tokenEndpoint');
      expect(response.body).toHaveProperty('userInfoEndpoint');
      expect(response.body).toHaveProperty('jwksUri');
      expect(response.body.issuer).toContain('.ciamlogin.com');
    });
  });

  describe('Microsoft OAuth Token Processing', () => {
    test('should process Microsoft OAuth callback with valid token', async () => {
      // Create a Microsoft-specific Microsoft Entra External ID token
      const microsoftToken = global.testUtils.generateTestAzureToken({
        iss: `https://test-tenant.ciamlogin.com/test-tenant-id/v2.0/`,
        aud: process.env.ENTRA_EXTERNAL_ID_CLIENT_ID,
        idp: 'live.com',
        emails: ['user@outlook.com'],
        name: 'John Microsoft User',
        given_name: 'John',
        family_name: 'User',
        preferred_username: 'john.user@outlook.com',
        idp_access_token: 'microsoft-access-token-123',
        idp_id_token: 'microsoft-id-token-456',
        tid: 'microsoft-tenant-id-789',
        nonce: 'microsoft-nonce-123'
      });

      const response = await request(app)
        .post('/auth/microsoft/callback')
        .send({
          id_token: microsoftToken,
          state: 'microsoft-auth-state-123',
          code: 'microsoft-auth-code-456'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('tokens');
      
      // Verify Microsoft-specific user data
      expect(response.body.user).toHaveProperty('identityProvider', 'live.com');
      expect(response.body.user.emails).toContain('user@outlook.com');
      expect(response.body.user).toHaveProperty('given_name', 'John');
      expect(response.body.user).toHaveProperty('family_name', 'User');
      expect(response.body.user).toHaveProperty('preferred_username', 'john.user@outlook.com');
      expect(response.body.user).toHaveProperty('tenantId', 'microsoft-tenant-id-789');
    });

    test('should handle Microsoft Work/School account token', async () => {
      // Test with Microsoft Work/School account (Azure AD)
      const workToken = global.testUtils.generateTestAzureToken({
        iss: `https://test-tenant.ciamlogin.com/test-tenant-id/v2.0/`,
        aud: process.env.ENTRA_EXTERNAL_ID_CLIENT_ID,
        idp: 'https://sts.windows.net/work-tenant-id/',
        emails: ['user@company.com'],
        name: 'Work User',
        given_name: 'Work',
        family_name: 'User',
        preferred_username: 'work.user@company.com',
        tid: 'work-tenant-id-123',
        upn: 'work.user@company.com'
      });

      const response = await request(app)
        .post('/auth/microsoft/callback')
        .send({
          id_token: workToken,
          state: 'microsoft-work-state'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.user).toHaveProperty('identityProvider', 'https://sts.windows.net/work-tenant-id/');
      expect(response.body.user.emails).toContain('user@company.com');
      expect(response.body.user).toHaveProperty('upn', 'work.user@company.com');
      expect(response.body.user).toHaveProperty('tenantId', 'work-tenant-id-123');
      expect(response.body.user).toHaveProperty('accountType', 'work');
    });

    test('should handle Microsoft Personal account token', async () => {
      // Test with Microsoft Personal account (MSA)
      const personalToken = global.testUtils.generateTestAzureToken({
        iss: `https://test-tenant.ciamlogin.com/test-tenant-id/v2.0/`,
        aud: process.env.ENTRA_EXTERNAL_ID_CLIENT_ID,
        idp: 'live.com',
        emails: ['user@hotmail.com'],
        name: 'Personal User',
        given_name: 'Personal',
        family_name: 'User',
        preferred_username: 'personal.user@hotmail.com'
      });

      const response = await request(app)
        .post('/auth/microsoft/callback')
        .send({
          id_token: personalToken,
          state: 'microsoft-personal-state'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.user).toHaveProperty('identityProvider', 'live.com');
      expect(response.body.user.emails).toContain('user@hotmail.com');
      expect(response.body.user).toHaveProperty('accountType', 'personal');
    });

    test('should validate Microsoft OAuth token signature', async () => {
      // Create an invalid token (wrong signature)
      const invalidToken = jwt.sign({
        iss: `https://test-tenant.ciamlogin.com/test-tenant-id/v2.0/`,
        aud: process.env.ENTRA_EXTERNAL_ID_CLIENT_ID,
        idp: 'live.com',
        emails: ['invalid@outlook.com']
      }, 'wrong-secret');

      const response = await request(app)
        .post('/auth/microsoft/callback')
        .send({
          id_token: invalidToken,
          state: 'microsoft-invalid-state'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid token signature');
    });

    test('should validate Microsoft OAuth token expiration', async () => {
      // Create an expired Microsoft token
      const expiredToken = global.testUtils.generateTestAzureToken({
        iss: `https://test-tenant.ciamlogin.com/test-tenant-id/v2.0/`,
        aud: process.env.ENTRA_EXTERNAL_ID_CLIENT_ID,
        idp: 'live.com',
        emails: ['expired@outlook.com'],
        exp: Math.floor(Date.now() / 1000) - 3600 // Expired 1 hour ago
      });

      const response = await request(app)
        .post('/auth/microsoft/callback')
        .send({
          id_token: expiredToken,
          state: 'microsoft-expired-state'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Token expired');
    });
  });

  describe('Microsoft Profile Management', () => {
    test('should retrieve Microsoft user profile after authentication', async () => {
      const microsoftToken = global.testUtils.generateTestAzureToken({
        idp: 'live.com',
        emails: ['profile@outlook.com'],
        name: 'Profile User',
        given_name: 'Profile',
        family_name: 'User',
        preferred_username: 'profile.user@outlook.com',
        tid: 'microsoft-tenant-123'
      });

      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${microsoftToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('profile');
      expect(response.body.profile).toHaveProperty('identityProvider', 'live.com');
      expect(response.body.profile).toHaveProperty('preferred_username', 'profile.user@outlook.com');
      expect(response.body.profile).toHaveProperty('tenantId', 'microsoft-tenant-123');
    });

    test('should handle Microsoft profile updates', async () => {
      const microsoftToken = global.testUtils.generateTestAzureToken({
        idp: 'live.com',
        emails: ['update@outlook.com'],
        name: 'Update User'
      });

      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${microsoftToken}`)
        .send({
          given_name: 'Updated',
          family_name: 'Name',
          preferred_username: 'updated.name@outlook.com'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('updated', true);
      expect(response.body.profile).toHaveProperty('given_name', 'Updated');
      expect(response.body.profile).toHaveProperty('family_name', 'Name');
    });
  });

  describe('Microsoft OAuth Error Scenarios', () => {
    test('should handle Microsoft OAuth authorization errors', async () => {
      const response = await request(app)
        .post('/auth/microsoft/callback')
        .send({
          error: 'access_denied',
          error_description: 'User denied access',
          state: 'microsoft-denied-state'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'access_denied');
      expect(response.body).toHaveProperty('error_description', 'User denied access');
    });

    test('should handle Microsoft OAuth consent required error', async () => {
      const response = await request(app)
        .post('/auth/microsoft/callback')
        .send({
          error: 'consent_required',
          error_description: 'User consent is required',
          state: 'microsoft-consent-state'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'consent_required');
      expect(response.body).toHaveProperty('consentUrl');
    });

    test('should handle Microsoft OAuth invalid state parameter', async () => {
      const microsoftToken = global.testUtils.generateTestAzureToken({
        idp: 'live.com',
        emails: ['state@outlook.com']
      });

      const response = await request(app)
        .post('/auth/microsoft/callback')
        .send({
          id_token: microsoftToken,
          state: 'invalid-microsoft-state'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid state parameter');
    });

    test('should handle Microsoft API throttling', async () => {
      // Simulate multiple rapid Microsoft OAuth requests
      const requests = [];
      for (let i = 0; i < 25; i++) {
        const token = global.testUtils.generateTestAzureToken({
          idp: 'live.com',
          emails: [`throttle-${i}@outlook.com`]
        });
        
        requests.push(
          request(app)
            .post('/auth/microsoft/callback')
            .send({
              id_token: token,
              state: `microsoft-throttle-${i}`
            })
        );
      }

      const responses = await Promise.all(requests);
      
      // Some requests should be throttled
      const throttledResponses = responses.filter(res => res.status === 429);
      expect(throttledResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Microsoft OAuth Token Refresh', () => {
    test('should refresh Microsoft OAuth tokens', async () => {
      // Mock Microsoft token refresh endpoint
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'new-microsoft-access-token',
          refresh_token: 'new-microsoft-refresh-token',
          id_token: global.testUtils.generateTestAzureToken({
            idp: 'live.com',
            emails: ['refresh@outlook.com']
          }),
          expires_in: 3600,
          token_type: 'Bearer'
        })
      });
      global.fetch = mockFetch;

      const refreshToken = global.testUtils.generateTestJWT({
        token_use: 'refresh',
        idp: 'live.com',
        exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60 // 7 days
      });

      const response = await request(app)
        .post('/api/token/refresh')
        .send({ 
          refreshToken,
          provider: 'microsoft'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('tokens');
      expect(response.body.tokens).toHaveProperty('accessToken');
      expect(response.body.tokens).toHaveProperty('refreshToken');
      expect(response.body.tokens).toHaveProperty('idToken');
    });

    test('should handle Microsoft token refresh errors', async () => {
      // Mock Microsoft token refresh error
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          error: 'invalid_grant',
          error_description: 'Refresh token is expired'
        })
      });
      global.fetch = mockFetch;

      const expiredRefreshToken = global.testUtils.generateTestJWT({
        token_use: 'refresh',
        idp: 'live.com',
        exp: Math.floor(Date.now() / 1000) - 3600 // Expired
      });

      const response = await request(app)
        .post('/api/token/refresh')
        .send({ 
          refreshToken: expiredRefreshToken,
          provider: 'microsoft'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('invalid_grant');
    });
  });

  describe('Microsoft OAuth Security', () => {
    test('should validate Microsoft OAuth audience', async () => {
      const wrongAudienceToken = global.testUtils.generateTestAzureToken({
        iss: `https://test-tenant.ciamlogin.com/test-tenant-id/v2.0/`,
        aud: 'wrong-client-id',
        idp: 'live.com',
        emails: ['audience@outlook.com']
      });

      const response = await request(app)
        .post('/auth/microsoft/callback')
        .send({
          id_token: wrongAudienceToken,
          state: 'microsoft-audience-state'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('Invalid audience');
    });

    test('should validate Microsoft OAuth issuer', async () => {
      const wrongIssuerToken = global.testUtils.generateTestAzureToken({
        iss: 'https://malicious-issuer.com/v2.0/',
        aud: process.env.ENTRA_EXTERNAL_ID_CLIENT_ID,
        idp: 'live.com',
        emails: ['issuer@outlook.com']
      });

      const response = await request(app)
        .post('/auth/microsoft/callback')
        .send({
          id_token: wrongIssuerToken,
          state: 'microsoft-issuer-state'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('Invalid issuer');
    });

    test('should detect Microsoft OAuth token replay attacks', async () => {
      const microsoftToken = global.testUtils.generateTestAzureToken({
        idp: 'live.com',
        emails: ['replay@outlook.com'],
        jti: 'microsoft-unique-token-id-123' // JWT ID for replay detection
      });

      // First use should succeed
      const response1 = await request(app)
        .post('/auth/microsoft/callback')
        .send({
          id_token: microsoftToken,
          state: 'microsoft-replay-state-1'
        })
        .expect(200);

      expect(response1.body).toHaveProperty('success', true);

      // Second use should be detected as replay
      const response2 = await request(app)
        .post('/auth/microsoft/callback')
        .send({
          id_token: microsoftToken,
          state: 'microsoft-replay-state-2'
        })
        .expect(400);

      expect(response2.body).toHaveProperty('success', false);
      expect(response2.body.error).toContain('Token replay detected');
    });
  });

  describe('Microsoft OAuth Integration Features', () => {
    test('should handle Microsoft 365 accounts', async () => {
      const m365Token = global.testUtils.generateTestAzureToken({
        idp: 'https://sts.windows.net/m365-tenant-id/',
        emails: ['user@company.onmicrosoft.com'],
        name: 'M365 User',
        given_name: 'M365',
        family_name: 'User',
        tid: 'm365-tenant-id-123',
        upn: 'user@company.onmicrosoft.com',
        roles: ['User', 'Member']
      });

      const response = await request(app)
        .post('/auth/microsoft/callback')
        .send({
          id_token: m365Token,
          state: 'microsoft-m365-state'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.user).toHaveProperty('identityProvider', 'https://sts.windows.net/m365-tenant-id/');
      expect(response.body.user).toHaveProperty('tenantId', 'm365-tenant-id-123');
      expect(response.body.user).toHaveProperty('roles');
      expect(response.body.user.roles).toContain('User');
      expect(response.body.user).toHaveProperty('accountType', 'work');
    });

    test('should handle Microsoft account linking', async () => {
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

      // Then link Microsoft account
      const microsoftToken = global.testUtils.generateTestAzureToken({
        idp: 'live.com',
        emails: ['link@outlook.com'],
        name: 'Link User',
        sub: userId // Same user ID to indicate linking
      });

      const linkResponse = await request(app)
        .post('/auth/microsoft/link')
        .set('Authorization', `Bearer ${localToken}`)
        .send({
          id_token: microsoftToken,
          state: 'microsoft-link-state'
        })
        .expect(200);

      expect(linkResponse.body).toHaveProperty('success', true);
      expect(linkResponse.body).toHaveProperty('linked', true);
      expect(linkResponse.body.user).toHaveProperty('identityProviders');
      expect(linkResponse.body.user.identityProviders).toContain('live.com');
    });

    test('should handle Microsoft OAuth logout', async () => {
      const microsoftToken = global.testUtils.generateTestAzureToken({
        idp: 'live.com',
        emails: ['logout@outlook.com']
      });

      const logoutResponse = await request(app)
        .post('/auth/microsoft/logout')
        .set('Authorization', `Bearer ${microsoftToken}`)
        .send({
          postLogoutRedirectUri: 'http://localhost:3000/logged-out'
        })
        .expect(200);

      expect(logoutResponse.body).toHaveProperty('success', true);
      expect(logoutResponse.body).toHaveProperty('logoutUrl');
      expect(logoutResponse.body.logoutUrl).toContain('oauth2/v2.0/logout');
      expect(logoutResponse.body.logoutUrl).toContain('post_logout_redirect_uri');
    });

    test('should handle Microsoft Graph API integration', async () => {
      const microsoftToken = global.testUtils.generateTestAzureToken({
        idp: 'live.com',
        emails: ['graph@outlook.com'],
        name: 'Graph User',
        scp: 'User.Read Mail.Read' // Microsoft Graph scopes
      });

      // Mock Microsoft Graph API response
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          '@odata.context': 'https://graph.microsoft.com/v1.0/$metadata#users/$entity',
          id: 'graph-user-id-123',
          displayName: 'Graph User',
          mail: 'graph@outlook.com',
          userPrincipalName: 'graph@outlook.com'
        })
      });
      global.fetch = mockFetch;

      const response = await request(app)
        .get('/api/user/microsoft-profile')
        .set('Authorization', `Bearer ${microsoftToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('microsoftProfile');
      expect(response.body.microsoftProfile).toHaveProperty('id', 'graph-user-id-123');
      expect(response.body.microsoftProfile).toHaveProperty('displayName', 'Graph User');
    });
  });

  describe('Microsoft OAuth Compliance and Privacy', () => {
    test('should handle Microsoft OAuth GDPR data export', async () => {
      const microsoftToken = global.testUtils.generateTestAzureToken({
        idp: 'live.com',
        emails: ['gdpr@outlook.com'],
        name: 'GDPR User'
      });

      const response = await request(app)
        .get('/api/gdpr/export')
        .set('Authorization', `Bearer ${microsoftToken}`)
        .query({ format: 'json', includeProvider: 'true' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('identityProvider', 'live.com');
      expect(response.body.data).toHaveProperty('providerSpecificData');
    });

    test('should handle Microsoft OAuth account deletion', async () => {
      const microsoftToken = global.testUtils.generateTestAzureToken({
        idp: 'live.com',
        emails: ['delete@outlook.com'],
        name: 'Delete User'
      });

      const response = await request(app)
        .post('/api/gdpr/delete-account')
        .set('Authorization', `Bearer ${microsoftToken}`)
        .send({
          reason: 'user_request',
          confirmEmail: 'delete@outlook.com'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('deletionRequestId');
      expect(response.body).toHaveProperty('estimatedCompletionTime');
    });

    test('should handle Microsoft tenant-specific privacy policies', async () => {
      const workToken = global.testUtils.generateTestAzureToken({
        idp: 'https://sts.windows.net/work-tenant-id/',
        emails: ['privacy@company.com'],
        tid: 'work-tenant-id-123',
        upn: 'privacy@company.com'
      });

      const response = await request(app)
        .get('/api/privacy/microsoft-tenant-policy')
        .set('Authorization', `Bearer ${workToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('tenantId', 'work-tenant-id-123');
      expect(response.body).toHaveProperty('privacyPolicy');
      expect(response.body).toHaveProperty('dataProcessingAgreement');
    });
  });
});
