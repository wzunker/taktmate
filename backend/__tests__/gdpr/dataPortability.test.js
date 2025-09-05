// GDPR Data Portability (Right to Data Portability) Tests
// Tests comprehensive data export functionality through Microsoft Entra External ID

const request = require('supertest');
const app = require('../../index');
const { GDPRComplianceService } = require('../../services/gdprComplianceService');
const { EntraExternalIdApiService } = require('../../services/entraExternalIdApiService');

// Mock Microsoft Entra External ID API service
jest.mock('../../services/entraExternalIdApiService');
jest.mock('@azure/msal-node');

describe('GDPR Data Portability Validation', () => {
  let mockUser;
  let mockAuthToken;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUser = {
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      given_name: 'Test',
      family_name: 'User',
      identityProvider: 'local'
    };
    
    mockAuthToken = 'valid-jwt-token';
    
    // Mock Azure B2C API service
    EntraExternalIdApiService.prototype.getUserData = jest.fn();
    EntraExternalIdApiService.prototype.getUserAttributes = jest.fn();
    EntraExternalIdApiService.prototype.getUserSignInLogs = jest.fn();
  });

  describe('Data Export Request Processing', () => {
    test('should initiate data export for authenticated user', async () => {
      const mockExportData = {
        exportId: 'export-123',
        status: 'initiated',
        requestedAt: new Date().toISOString(),
        estimatedCompletion: new Date(Date.now() + 300000).toISOString() // 5 minutes
      };

      EntraExternalIdApiService.prototype.getUserData.mockResolvedValue({
        success: true,
        data: {
          profile: mockUser,
          attributes: { department: 'engineering', role: 'developer' },
          signInActivity: [
            { timestamp: '2024-01-01T10:00:00Z', ipAddress: '192.168.1.1' },
            { timestamp: '2024-01-02T10:00:00Z', ipAddress: '192.168.1.2' }
          ]
        }
      });

      const response = await request(app)
        .get('/api/gdpr/export')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        exportId: expect.any(String),
        status: 'initiated',
        message: expect.stringContaining('export initiated')
      });

      expect(EntraExternalIdApiService.prototype.getUserData).toHaveBeenCalledWith(mockUser.id);
    });

    test('should handle large dataset export with pagination', async () => {
      const largeDataset = {
        profile: mockUser,
        attributes: { department: 'engineering' },
        signInActivity: Array.from({ length: 1000 }, (_, i) => ({
          timestamp: new Date(Date.now() - i * 86400000).toISOString(),
          ipAddress: `192.168.1.${i % 255 + 1}`
        })),
        fileActivity: Array.from({ length: 500 }, (_, i) => ({
          fileName: `file-${i}.csv`,
          uploadedAt: new Date(Date.now() - i * 3600000).toISOString(),
          size: Math.floor(Math.random() * 1000000)
        }))
      };

      EntraExternalIdApiService.prototype.getUserData.mockResolvedValue({
        success: true,
        data: largeDataset
      });

      const response = await request(app)
        .get('/api/gdpr/export')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.estimatedSize).toBeGreaterThan(0);
      expect(response.body.compressionEnabled).toBe(true);
    });

    test('should validate export request frequency limits', async () => {
      // First export request
      await request(app)
        .get('/api/gdpr/export')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      // Second export request immediately after
      const response = await request(app)
        .get('/api/gdpr/export')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(429); // Too Many Requests

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('rate limit'),
        retryAfter: expect.any(Number)
      });
    });

    test('should handle export request for user with minimal data', async () => {
      const minimalUser = {
        id: 'minimal-user',
        email: 'minimal@example.com',
        name: 'Minimal User'
      };

      EntraExternalIdApiService.prototype.getUserData.mockResolvedValue({
        success: true,
        data: {
          profile: minimalUser,
          attributes: {},
          signInActivity: [],
          fileActivity: []
        }
      });

      const response = await request(app)
        .get('/api/gdpr/export')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.dataCategories).toEqual(['profile']);
      expect(response.body.estimatedSize).toBeLessThan(1000); // Small export
    });
  });

  describe('Data Export Formats and Structure', () => {
    test('should export data in JSON format by default', async () => {
      EntraExternalIdApiService.prototype.getUserData.mockResolvedValue({
        success: true,
        data: {
          profile: mockUser,
          attributes: { role: 'admin' },
          signInActivity: [{ timestamp: '2024-01-01T10:00:00Z' }]
        }
      });

      const response = await request(app)
        .get('/api/gdpr/export')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(response.body.format).toBe('json');
      expect(response.body.downloadUrl).toMatch(/\.json$/);
    });

    test('should support CSV format export', async () => {
      EntraExternalIdApiService.prototype.getUserData.mockResolvedValue({
        success: true,
        data: {
          profile: mockUser,
          signInActivity: [
            { timestamp: '2024-01-01T10:00:00Z', ipAddress: '192.168.1.1' },
            { timestamp: '2024-01-02T10:00:00Z', ipAddress: '192.168.1.2' }
          ]
        }
      });

      const response = await request(app)
        .get('/api/gdpr/export?format=csv')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(response.body.format).toBe('csv');
      expect(response.body.files).toContain('profile.csv');
      expect(response.body.files).toContain('signin_activity.csv');
    });

    test('should support XML format export', async () => {
      EntraExternalIdApiService.prototype.getUserData.mockResolvedValue({
        success: true,
        data: { profile: mockUser }
      });

      const response = await request(app)
        .get('/api/gdpr/export?format=xml')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(response.body.format).toBe('xml');
      expect(response.body.downloadUrl).toMatch(/\.xml$/);
    });

    test('should include data schema and metadata', async () => {
      EntraExternalIdApiService.prototype.getUserData.mockResolvedValue({
        success: true,
        data: { profile: mockUser }
      });

      const response = await request(app)
        .get('/api/gdpr/export?includeSchema=true')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(response.body.includesSchema).toBe(true);
      expect(response.body.schemaVersion).toMatch(/^\d+\.\d+\.\d+$/);
      expect(response.body.files).toContain('schema.json');
      expect(response.body.files).toContain('metadata.json');
    });
  });

  describe('Data Categories and Completeness', () => {
    test('should export all GDPR-relevant data categories', async () => {
      const completeUserData = {
        profile: mockUser,
        attributes: { department: 'engineering', role: 'developer' },
        signInActivity: [{ timestamp: '2024-01-01T10:00:00Z' }],
        fileActivity: [{ fileName: 'test.csv', uploadedAt: '2024-01-01T10:00:00Z' }],
        consentRecords: [{ 
          category: 'analytics', 
          granted: true, 
          timestamp: '2024-01-01T10:00:00Z' 
        }],
        sessionData: [{ 
          sessionId: 'session-123', 
          createdAt: '2024-01-01T10:00:00Z' 
        }],
        auditLogs: [{ 
          action: 'profile_update', 
          timestamp: '2024-01-01T10:00:00Z' 
        }]
      };

      EntraExternalIdApiService.prototype.getUserData.mockResolvedValue({
        success: true,
        data: completeUserData
      });

      const response = await request(app)
        .get('/api/gdpr/export')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      const expectedCategories = [
        'profile',
        'attributes', 
        'signInActivity',
        'fileActivity',
        'consentRecords',
        'sessionData',
        'auditLogs'
      ];

      expect(response.body.dataCategories).toEqual(
        expect.arrayContaining(expectedCategories)
      );
    });

    test('should sanitize sensitive data in export', async () => {
      const sensitiveUserData = {
        profile: {
          ...mockUser,
          internalId: 'internal-123',
          passwordHash: 'hashed-password',
          securityQuestions: ['secret-answer']
        },
        attributes: {
          role: 'admin',
          internalNotes: 'confidential notes',
          systemFlags: ['debug', 'test']
        }
      };

      EntraExternalIdApiService.prototype.getUserData.mockResolvedValue({
        success: true,
        data: sensitiveUserData
      });

      const response = await request(app)
        .get('/api/gdpr/export')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(response.body.sanitizedFields).toContain('passwordHash');
      expect(response.body.sanitizedFields).toContain('internalId');
      expect(response.body.sanitizedFields).toContain('securityQuestions');
      expect(response.body.sanitizedFields).toContain('internalNotes');
    });

    test('should include data processing lawful basis information', async () => {
      EntraExternalIdApiService.prototype.getUserData.mockResolvedValue({
        success: true,
        data: { profile: mockUser }
      });

      const response = await request(app)
        .get('/api/gdpr/export?includeLegalBasis=true')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(response.body.legalBasisInfo).toBeDefined();
      expect(response.body.legalBasisInfo).toMatchObject({
        profile: 'contract',
        analytics: 'legitimate_interest',
        marketing: 'consent'
      });
    });
  });

  describe('Export Security and Access Control', () => {
    test('should require valid authentication for export', async () => {
      const response = await request(app)
        .get('/api/gdpr/export')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('authentication required')
      });
    });

    test('should validate user identity before export', async () => {
      const invalidToken = 'invalid-token';

      const response = await request(app)
        .get('/api/gdpr/export')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('invalid token')
      });
    });

    test('should generate secure download URLs with expiration', async () => {
      EntraExternalIdApiService.prototype.getUserData.mockResolvedValue({
        success: true,
        data: { profile: mockUser }
      });

      const response = await request(app)
        .get('/api/gdpr/export')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(response.body.downloadUrl).toMatch(/^https:\/\//);
      expect(response.body.downloadUrl).toContain('expires=');
      expect(response.body.downloadUrl).toContain('signature=');
      expect(response.body.expiresAt).toBeDefined();
      
      const expiresAt = new Date(response.body.expiresAt);
      const now = new Date();
      expect(expiresAt.getTime()).toBeGreaterThan(now.getTime());
      expect(expiresAt.getTime()).toBeLessThan(now.getTime() + 24 * 60 * 60 * 1000); // Within 24 hours
    });

    test('should log export requests for audit trail', async () => {
      const mockAuditLog = jest.fn();
      jest.doMock('../../services/auditLoggingService', () => ({
        AuditLoggingService: {
          logEvent: mockAuditLog
        }
      }));

      EntraExternalIdApiService.prototype.getUserData.mockResolvedValue({
        success: true,
        data: { profile: mockUser }
      });

      await request(app)
        .get('/api/gdpr/export')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(mockAuditLog).toHaveBeenCalledWith(
        'GDPR_DATA_EXPORT_REQUESTED',
        expect.objectContaining({
          userId: mockUser.id,
          requestedAt: expect.any(String),
          ipAddress: expect.any(String)
        })
      );
    });
  });

  describe('Export Status and Progress Tracking', () => {
    test('should provide export status endpoint', async () => {
      const exportId = 'export-123';

      const response = await request(app)
        .get(`/api/gdpr/export/status/${exportId}`)
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        exportId,
        status: expect.oneOf(['initiated', 'processing', 'completed', 'failed']),
        progress: expect.any(Number),
        estimatedCompletion: expect.any(String)
      });
    });

    test('should handle export completion notification', async () => {
      const exportId = 'export-123';

      const response = await request(app)
        .get(`/api/gdpr/export/status/${exportId}`)
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      if (response.body.status === 'completed') {
        expect(response.body.downloadUrl).toBeDefined();
        expect(response.body.completedAt).toBeDefined();
        expect(response.body.fileSize).toBeGreaterThan(0);
      }
    });

    test('should handle export failure scenarios', async () => {
      EntraExternalIdApiService.prototype.getUserData.mockRejectedValue(
        new Error('Azure AD B2C service unavailable')
      );

      const response = await request(app)
        .get('/api/gdpr/export')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(503);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('service unavailable'),
        retryable: true,
        retryAfter: expect.any(Number)
      });
    });
  });

  describe('Data Export Compliance Validation', () => {
    test('should include GDPR compliance metadata', async () => {
      EntraExternalIdApiService.prototype.getUserData.mockResolvedValue({
        success: true,
        data: { profile: mockUser }
      });

      const response = await request(app)
        .get('/api/gdpr/export')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(response.body.gdprCompliance).toMatchObject({
        article: 'Article 20 - Right to data portability',
        dataController: expect.any(String),
        dataProcessorContact: expect.any(String),
        exportDate: expect.any(String),
        retentionPeriod: expect.any(String)
      });
    });

    test('should validate data completeness certification', async () => {
      EntraExternalIdApiService.prototype.getUserData.mockResolvedValue({
        success: true,
        data: { 
          profile: mockUser,
          completenessCheck: {
            totalCategories: 7,
            exportedCategories: 7,
            missingCategories: [],
            dataIntegrityHash: 'sha256-hash'
          }
        }
      });

      const response = await request(app)
        .get('/api/gdpr/export')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(response.body.completenessCheck).toMatchObject({
        complete: true,
        exportedCategories: 7,
        missingCategories: [],
        integrityVerified: true
      });
    });

    test('should handle cross-border data transfer compliance', async () => {
      EntraExternalIdApiService.prototype.getUserData.mockResolvedValue({
        success: true,
        data: { profile: mockUser }
      });

      const response = await request(app)
        .get('/api/gdpr/export')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .set('X-User-Country', 'DE') // German user
        .expect(200);

      expect(response.body.transferCompliance).toMatchObject({
        adequacyDecision: true,
        safeguards: expect.arrayContaining(['Standard Contractual Clauses']),
        dataLocation: expect.any(String)
      });
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle concurrent export requests', async () => {
      EntraExternalIdApiService.prototype.getUserData.mockResolvedValue({
        success: true,
        data: { profile: mockUser }
      });

      const concurrentRequests = Array.from({ length: 5 }, (_, i) =>
        request(app)
          .get('/api/gdpr/export')
          .set('Authorization', `Bearer ${mockAuthToken}-${i}`)
      );

      const responses = await Promise.all(concurrentRequests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    test('should implement export queue for high load', async () => {
      // Simulate high load scenario
      const queuedResponse = {
        success: true,
        exportId: 'export-queued-123',
        status: 'queued',
        queuePosition: 5,
        estimatedWaitTime: '15 minutes'
      };

      EntraExternalIdApiService.prototype.getUserData.mockResolvedValue({
        success: true,
        data: { profile: mockUser },
        queued: true
      });

      const response = await request(app)
        .get('/api/gdpr/export')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(202); // Accepted but queued

      expect(response.body).toMatchObject({
        status: 'queued',
        queuePosition: expect.any(Number),
        estimatedWaitTime: expect.any(String)
      });
    });

    test('should optimize export for large datasets', async () => {
      const largeDataset = {
        profile: mockUser,
        signInActivity: Array.from({ length: 10000 }, (_, i) => ({
          timestamp: new Date(Date.now() - i * 60000).toISOString(),
          ipAddress: `192.168.${Math.floor(i / 255)}.${i % 255 + 1}`
        }))
      };

      EntraExternalIdApiService.prototype.getUserData.mockResolvedValue({
        success: true,
        data: largeDataset
      });

      const response = await request(app)
        .get('/api/gdpr/export')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(response.body.optimization).toMatchObject({
        compressionEnabled: true,
        streamingEnabled: true,
        chunkSize: expect.any(Number),
        estimatedDownloadTime: expect.any(String)
      });
    });
  });
});
