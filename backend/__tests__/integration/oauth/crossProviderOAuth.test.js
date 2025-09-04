// Integration tests for Cross-Provider OAuth Scenarios through Azure AD B2C
// Tests provider comparison, switching, and multi-provider account management

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

describe('Cross-Provider OAuth Integration Tests', () => {
  let app;
  let server;

  beforeAll(async () => {
    // Import app after mocks are set up
    const appModule = require('../../../index');
    app = appModule.app || appModule;
    
    // Start server on a test port
    server = app.listen(0, () => {
      console.log(`Cross-Provider OAuth Test server running on port ${server.address().port}`);
    });
    
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  describe('Provider Configuration Comparison', () => {
    test('should provide configuration for all supported providers', async () => {
      const providers = ['google', 'microsoft', 'local'];
      const configs = {};

      for (const provider of providers) {
        const response = await request(app)
          .get(`/auth/config/${provider}`)
          .expect(200);

        configs[provider] = response.body;
      }

      // Verify all providers have required configuration
      Object.keys(configs).forEach(provider => {
        expect(configs[provider]).toHaveProperty('provider', provider);
        expect(configs[provider]).toHaveProperty('clientId');
        expect(configs[provider]).toHaveProperty('authority');
        expect(configs[provider]).toHaveProperty('scopes');
      });

      // Verify provider-specific differences
      expect(configs.google.scopes).toContain('email');
      expect(configs.microsoft.scopes).toContain('User.Read');
      expect(configs.local.scopes).not.toContain('User.Read');
    });

    test('should provide unified provider metadata', async () => {
      const response = await request(app)
        .get('/auth/providers/metadata')
        .expect(200);

      expect(response.body).toHaveProperty('providers');
      expect(response.body.providers).toHaveProperty('google');
      expect(response.body.providers).toHaveProperty('microsoft');
      expect(response.body.providers).toHaveProperty('local');

      // Verify each provider has complete metadata
      Object.values(response.body.providers).forEach(provider => {
        expect(provider).toHaveProperty('name');
        expect(provider).toHaveProperty('displayName');
        expect(provider).toHaveProperty('authorizationEndpoint');
        expect(provider).toHaveProperty('tokenEndpoint');
        expect(provider).toHaveProperty('supported');
      });
    });
  });

  describe('Account Linking Across Providers', () => {
    test('should link Google and Microsoft accounts to same user', async () => {
      // Start with Google account
      const googleToken = global.testUtils.generateTestAzureToken({
        idp: 'google.com',
        emails: ['link@gmail.com'],
        name: 'Link User',
        sub: 'user-link-123'
      });

      const googleResponse = await request(app)
        .post('/auth/google/callback')
        .send({
          id_token: googleToken,
          state: 'google-link-initial'
        })
        .expect(200);

      const userId = googleResponse.body.user.id;

      // Link Microsoft account
      const microsoftToken = global.testUtils.generateTestAzureToken({
        idp: 'live.com',
        emails: ['link@outlook.com'],
        name: 'Link User',
        sub: userId // Same user ID for linking
      });

      const linkResponse = await request(app)
        .post('/auth/microsoft/link')
        .set('Authorization', `Bearer ${googleToken}`)
        .send({
          id_token: microsoftToken,
          state: 'microsoft-link-state'
        })
        .expect(200);

      expect(linkResponse.body).toHaveProperty('success', true);
      expect(linkResponse.body).toHaveProperty('linked', true);
      expect(linkResponse.body.user).toHaveProperty('identityProviders');
      expect(linkResponse.body.user.identityProviders).toContain('google.com');
      expect(linkResponse.body.user.identityProviders).toContain('live.com');

      // Verify linked accounts
      const profileResponse = await request(app)
        .get('/api/user/linked-accounts')
        .set('Authorization', `Bearer ${googleToken}`)
        .expect(200);

      expect(profileResponse.body).toHaveProperty('success', true);
      expect(profileResponse.body).toHaveProperty('linkedAccounts');
      expect(profileResponse.body.linkedAccounts).toHaveLength(2);
      expect(profileResponse.body.linkedAccounts.some(acc => acc.provider === 'google.com')).toBe(true);
      expect(profileResponse.body.linkedAccounts.some(acc => acc.provider === 'live.com')).toBe(true);
    });

    test('should prevent linking accounts with different email domains', async () => {
      const googleToken = global.testUtils.generateTestAzureToken({
        idp: 'google.com',
        emails: ['user@gmail.com'],
        name: 'User One'
      });

      const microsoftToken = global.testUtils.generateTestAzureToken({
        idp: 'live.com',
        emails: ['different@outlook.com'],
        name: 'User Two'
      });

      const linkResponse = await request(app)
        .post('/auth/microsoft/link')
        .set('Authorization', `Bearer ${googleToken}`)
        .send({
          id_token: microsoftToken,
          state: 'microsoft-link-different',
          enforceEmailMatch: true
        })
        .expect(400);

      expect(linkResponse.body).toHaveProperty('success', false);
      expect(linkResponse.body).toHaveProperty('error');
      expect(linkResponse.body.error).toContain('Email mismatch');
    });

    test('should unlink provider accounts', async () => {
      // Setup linked accounts first
      const googleToken = global.testUtils.generateTestAzureToken({
        idp: 'google.com',
        emails: ['unlink@gmail.com'],
        name: 'Unlink User',
        sub: 'user-unlink-123'
      });

      const microsoftToken = global.testUtils.generateTestAzureToken({
        idp: 'live.com',
        emails: ['unlink@outlook.com'],
        name: 'Unlink User',
        sub: 'user-unlink-123'
      });

      // Link accounts
      await request(app)
        .post('/auth/google/callback')
        .send({
          id_token: googleToken,
          state: 'google-unlink-initial'
        })
        .expect(200);

      await request(app)
        .post('/auth/microsoft/link')
        .set('Authorization', `Bearer ${googleToken}`)
        .send({
          id_token: microsoftToken,
          state: 'microsoft-link-for-unlink'
        })
        .expect(200);

      // Unlink Microsoft account
      const unlinkResponse = await request(app)
        .delete('/api/user/unlink/microsoft')
        .set('Authorization', `Bearer ${googleToken}`)
        .expect(200);

      expect(unlinkResponse.body).toHaveProperty('success', true);
      expect(unlinkResponse.body).toHaveProperty('unlinked', true);

      // Verify unlinking
      const profileResponse = await request(app)
        .get('/api/user/linked-accounts')
        .set('Authorization', `Bearer ${googleToken}`)
        .expect(200);

      expect(profileResponse.body.linkedAccounts).toHaveLength(1);
      expect(profileResponse.body.linkedAccounts[0].provider).toBe('google.com');
    });
  });

  describe('Provider Switching', () => {
    test('should switch login provider for same user', async () => {
      const userId = 'user-switch-123';

      // Login with Google
      const googleToken = global.testUtils.generateTestAzureToken({
        idp: 'google.com',
        emails: ['switch@gmail.com'],
        name: 'Switch User',
        sub: userId
      });

      const googleResponse = await request(app)
        .post('/auth/google/callback')
        .send({
          id_token: googleToken,
          state: 'google-switch-login'
        })
        .expect(200);

      expect(googleResponse.body.user).toHaveProperty('identityProvider', 'google.com');

      // Switch to Microsoft
      const microsoftToken = global.testUtils.generateTestAzureToken({
        idp: 'live.com',
        emails: ['switch@outlook.com'],
        name: 'Switch User',
        sub: userId
      });

      const microsoftResponse = await request(app)
        .post('/auth/microsoft/callback')
        .send({
          id_token: microsoftToken,
          state: 'microsoft-switch-login'
        })
        .expect(200);

      expect(microsoftResponse.body.user).toHaveProperty('identityProvider', 'live.com');
      expect(microsoftResponse.body.user.id).toBe(userId);
    });

    test('should maintain session data across provider switches', async () => {
      const userId = 'user-session-switch-123';

      // Login with Google and create some data
      const googleToken = global.testUtils.generateTestAzureToken({
        idp: 'google.com',
        emails: ['session@gmail.com'],
        sub: userId
      });

      await request(app)
        .post('/auth/google/callback')
        .send({
          id_token: googleToken,
          state: 'google-session-login'
        })
        .expect(200);

      // Upload a file
      const csvContent = 'name,value\ntest,123';
      const uploadResponse = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${googleToken}`)
        .attach('file', Buffer.from(csvContent), 'test.csv')
        .expect(200);

      const fileId = uploadResponse.body.fileId;

      // Switch to Microsoft
      const microsoftToken = global.testUtils.generateTestAzureToken({
        idp: 'live.com',
        emails: ['session@outlook.com'],
        sub: userId
      });

      await request(app)
        .post('/auth/microsoft/callback')
        .send({
          id_token: microsoftToken,
          state: 'microsoft-session-login'
        })
        .expect(200);

      // Verify file is still accessible
      const fileResponse = await request(app)
        .get(`/api/files/${fileId}`)
        .set('Authorization', `Bearer ${microsoftToken}`)
        .expect(200);

      expect(fileResponse.body).toHaveProperty('success', true);
      expect(fileResponse.body).toHaveProperty('file');
    });
  });

  describe('Provider-Specific Features Comparison', () => {
    test('should handle provider-specific token claims', async () => {
      // Google token with Google-specific claims
      const googleToken = global.testUtils.generateTestAzureToken({
        idp: 'google.com',
        emails: ['claims@gmail.com'],
        picture: 'https://lh3.googleusercontent.com/a/profile-pic',
        email_verified: true,
        locale: 'en'
      });

      const googleResponse = await request(app)
        .post('/auth/google/callback')
        .send({
          id_token: googleToken,
          state: 'google-claims-test'
        })
        .expect(200);

      expect(googleResponse.body.user).toHaveProperty('picture');
      expect(googleResponse.body.user).toHaveProperty('email_verified', true);
      expect(googleResponse.body.user).toHaveProperty('locale', 'en');

      // Microsoft token with Microsoft-specific claims
      const microsoftToken = global.testUtils.generateTestAzureToken({
        idp: 'live.com',
        emails: ['claims@outlook.com'],
        preferred_username: 'claims@outlook.com',
        tid: 'microsoft-tenant-123'
      });

      const microsoftResponse = await request(app)
        .post('/auth/microsoft/callback')
        .send({
          id_token: microsoftToken,
          state: 'microsoft-claims-test'
        })
        .expect(200);

      expect(microsoftResponse.body.user).toHaveProperty('preferred_username', 'claims@outlook.com');
      expect(microsoftResponse.body.user).toHaveProperty('tenantId', 'microsoft-tenant-123');
    });

    test('should handle provider-specific scope differences', async () => {
      // Test Google-specific scopes
      const googleResponse = await request(app)
        .get('/auth/google/scopes')
        .expect(200);

      expect(googleResponse.body).toHaveProperty('scopes');
      expect(googleResponse.body.scopes).toContain('openid');
      expect(googleResponse.body.scopes).toContain('profile');
      expect(googleResponse.body.scopes).toContain('email');

      // Test Microsoft-specific scopes
      const microsoftResponse = await request(app)
        .get('/auth/microsoft/scopes')
        .expect(200);

      expect(microsoftResponse.body).toHaveProperty('scopes');
      expect(microsoftResponse.body.scopes).toContain('openid');
      expect(microsoftResponse.body.scopes).toContain('profile');
      expect(microsoftResponse.body.scopes).toContain('User.Read');
    });
  });

  describe('Cross-Provider Data Export', () => {
    test('should export data from all linked providers', async () => {
      const userId = 'user-export-123';

      // Setup user with multiple providers
      const googleToken = global.testUtils.generateTestAzureToken({
        idp: 'google.com',
        emails: ['export@gmail.com'],
        sub: userId
      });

      const microsoftToken = global.testUtils.generateTestAzureToken({
        idp: 'live.com',
        emails: ['export@outlook.com'],
        sub: userId
      });

      // Login with both providers
      await request(app)
        .post('/auth/google/callback')
        .send({
          id_token: googleToken,
          state: 'google-export-setup'
        })
        .expect(200);

      await request(app)
        .post('/auth/microsoft/link')
        .set('Authorization', `Bearer ${googleToken}`)
        .send({
          id_token: microsoftToken,
          state: 'microsoft-export-setup'
        })
        .expect(200);

      // Export data from all providers
      const exportResponse = await request(app)
        .get('/api/gdpr/export')
        .set('Authorization', `Bearer ${googleToken}`)
        .query({ 
          format: 'json',
          includeAllProviders: 'true'
        })
        .expect(200);

      expect(exportResponse.body).toHaveProperty('success', true);
      expect(exportResponse.body).toHaveProperty('data');
      expect(exportResponse.body.data).toHaveProperty('identityProviders');
      expect(exportResponse.body.data.identityProviders).toHaveLength(2);
      
      const providers = exportResponse.body.data.identityProviders.map(p => p.provider);
      expect(providers).toContain('google.com');
      expect(providers).toContain('live.com');
    });

    test('should export provider-specific data formats', async () => {
      const googleToken = global.testUtils.generateTestAzureToken({
        idp: 'google.com',
        emails: ['format@gmail.com']
      });

      const exportResponse = await request(app)
        .get('/api/gdpr/export/google')
        .set('Authorization', `Bearer ${googleToken}`)
        .query({ format: 'google-takeout' })
        .expect(200);

      expect(exportResponse.body).toHaveProperty('success', true);
      expect(exportResponse.body).toHaveProperty('exportFormat', 'google-takeout');
      expect(exportResponse.body).toHaveProperty('data');
    });
  });

  describe('Cross-Provider Security', () => {
    test('should prevent cross-provider token confusion', async () => {
      // Create Google token but send to Microsoft endpoint
      const googleToken = global.testUtils.generateTestAzureToken({
        idp: 'google.com',
        emails: ['confusion@gmail.com']
      });

      const response = await request(app)
        .post('/auth/microsoft/callback')
        .send({
          id_token: googleToken,
          state: 'microsoft-confusion-test'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Provider mismatch');
    });

    test('should validate provider-specific token formats', async () => {
      // Microsoft token missing required Microsoft claims
      const invalidMicrosoftToken = global.testUtils.generateTestAzureToken({
        idp: 'live.com',
        emails: ['invalid@outlook.com']
        // Missing preferred_username which might be required for Microsoft
      });

      const response = await request(app)
        .post('/auth/microsoft/callback')
        .send({
          id_token: invalidMicrosoftToken,
          state: 'microsoft-invalid-format'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    test('should handle provider-specific rate limiting', async () => {
      const providers = ['google', 'microsoft'];
      const results = {};

      for (const provider of providers) {
        const requests = [];
        
        for (let i = 0; i < 15; i++) {
          const token = global.testUtils.generateTestAzureToken({
            idp: provider === 'google' ? 'google.com' : 'live.com',
            emails: [`rate-${provider}-${i}@${provider === 'google' ? 'gmail.com' : 'outlook.com'}`]
          });
          
          requests.push(
            request(app)
              .post(`/auth/${provider}/callback`)
              .send({
                id_token: token,
                state: `${provider}-rate-${i}`
              })
          );
        }

        const responses = await Promise.all(requests);
        results[provider] = responses.filter(res => res.status === 429).length;
      }

      // Both providers should have some rate limiting
      expect(results.google + results.microsoft).toBeGreaterThan(0);
    });
  });

  describe('Provider Migration', () => {
    test('should migrate user from one provider to another', async () => {
      // Start with Google account
      const googleToken = global.testUtils.generateTestAzureToken({
        idp: 'google.com',
        emails: ['migrate@gmail.com'],
        name: 'Migrate User'
      });

      const googleResponse = await request(app)
        .post('/auth/google/callback')
        .send({
          id_token: googleToken,
          state: 'google-migrate-initial'
        })
        .expect(200);

      const userId = googleResponse.body.user.id;

      // Create some user data
      const csvContent = 'data,value\nmigrate,test';
      await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${googleToken}`)
        .attach('file', Buffer.from(csvContent), 'migrate.csv')
        .expect(200);

      // Migrate to Microsoft
      const microsoftToken = global.testUtils.generateTestAzureToken({
        idp: 'live.com',
        emails: ['migrate@outlook.com'],
        name: 'Migrate User',
        sub: userId
      });

      const migrationResponse = await request(app)
        .post('/api/user/migrate-provider')
        .set('Authorization', `Bearer ${googleToken}`)
        .send({
          newProvider: 'microsoft',
          newProviderToken: microsoftToken,
          confirmMigration: true
        })
        .expect(200);

      expect(migrationResponse.body).toHaveProperty('success', true);
      expect(migrationResponse.body).toHaveProperty('migrated', true);
      expect(migrationResponse.body).toHaveProperty('newPrimaryProvider', 'live.com');

      // Verify data is preserved
      const filesResponse = await request(app)
        .get('/api/files')
        .set('Authorization', `Bearer ${microsoftToken}`)
        .expect(200);

      expect(filesResponse.body).toHaveProperty('success', true);
      expect(filesResponse.body.files.length).toBeGreaterThan(0);
    });

    test('should handle migration rollback', async () => {
      const userId = 'user-rollback-123';

      // Setup initial state
      const googleToken = global.testUtils.generateTestAzureToken({
        idp: 'google.com',
        emails: ['rollback@gmail.com'],
        sub: userId
      });

      await request(app)
        .post('/auth/google/callback')
        .send({
          id_token: googleToken,
          state: 'google-rollback-setup'
        })
        .expect(200);

      // Attempt migration
      const microsoftToken = global.testUtils.generateTestAzureToken({
        idp: 'live.com',
        emails: ['rollback@outlook.com'],
        sub: userId
      });

      await request(app)
        .post('/api/user/migrate-provider')
        .set('Authorization', `Bearer ${googleToken}`)
        .send({
          newProvider: 'microsoft',
          newProviderToken: microsoftToken,
          confirmMigration: true
        })
        .expect(200);

      // Rollback migration
      const rollbackResponse = await request(app)
        .post('/api/user/rollback-migration')
        .set('Authorization', `Bearer ${microsoftToken}`)
        .send({
          rollbackToProvider: 'google',
          confirmRollback: true
        })
        .expect(200);

      expect(rollbackResponse.body).toHaveProperty('success', true);
      expect(rollbackResponse.body).toHaveProperty('rolledBack', true);
      expect(rollbackResponse.body).toHaveProperty('primaryProvider', 'google.com');
    });
  });
});
