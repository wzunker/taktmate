// GDPR Right to Erasure (Right to be Forgotten) Tests
// Tests comprehensive account deletion functionality through Azure AD B2C

const request = require('supertest');
const app = require('../../index');
const { AccountDeletionService } = require('../../services/accountDeletionService');
const { AzureB2CApiService } = require('../../services/azureB2CApiService');

// Mock services
jest.mock('../../services/accountDeletionService');
jest.mock('../../services/azureB2CApiService');
jest.mock('@azure/msal-node');

describe('GDPR Right to Erasure Validation', () => {
  let mockUser;
  let mockAuthToken;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUser = {
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      given_name: 'Test',
      family_name: 'User'
    };
    
    mockAuthToken = 'valid-jwt-token';
    
    // Mock account deletion service
    AccountDeletionService.prototype.initiateDeletion = jest.fn();
    AccountDeletionService.prototype.getDeletionStatus = jest.fn();
    AccountDeletionService.prototype.cancelDeletion = jest.fn();
    
    // Mock Azure B2C API service
    AzureB2CApiService.prototype.deleteUser = jest.fn();
    AzureB2CApiService.prototype.getUserData = jest.fn();
  });

  describe('Deletion Request Processing', () => {
    test('should initiate account deletion for authenticated user', async () => {
      const mockDeletionResponse = {
        success: true,
        deletionId: 'deletion-123',
        status: 'initiated',
        scheduledFor: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        gracePeriod: '7 days'
      };

      AccountDeletionService.prototype.initiateDeletion.mockResolvedValue(mockDeletionResponse);

      const response = await request(app)
        .post('/api/gdpr/delete-account')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send({
          reason: 'user_request',
          confirmDeletion: true
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        deletionId: expect.any(String),
        status: 'initiated',
        gracePeriod: expect.any(String),
        scheduledFor: expect.any(String)
      });

      expect(AccountDeletionService.prototype.initiateDeletion).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({
          reason: 'user_request',
          confirmDeletion: true
        })
      );
    });

    test('should require explicit confirmation for deletion', async () => {
      const response = await request(app)
        .post('/api/gdpr/delete-account')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send({
          reason: 'user_request'
          // Missing confirmDeletion: true
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('explicit confirmation required')
      });
    });

    test('should validate deletion reason', async () => {
      const validReasons = [
        'user_request',
        'gdpr_compliance',
        'account_inactive',
        'legal_requirement'
      ];

      for (const reason of validReasons) {
        AccountDeletionService.prototype.initiateDeletion.mockResolvedValue({
          success: true,
          deletionId: `deletion-${reason}`,
          status: 'initiated'
        });

        const response = await request(app)
          .post('/api/gdpr/delete-account')
          .set('Authorization', `Bearer ${mockAuthToken}`)
          .send({
            reason,
            confirmDeletion: true
          })
          .expect(200);

        expect(response.body.success).toBe(true);
      }
    });

    test('should reject invalid deletion reasons', async () => {
      const response = await request(app)
        .post('/api/gdpr/delete-account')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send({
          reason: 'invalid_reason',
          confirmDeletion: true
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('invalid deletion reason')
      });
    });
  });

  describe('Grace Period and Cancellation', () => {
    test('should provide grace period for deletion cancellation', async () => {
      const deletionId = 'deletion-123';
      
      AccountDeletionService.prototype.getDeletionStatus.mockResolvedValue({
        success: true,
        deletionId,
        status: 'pending',
        gracePeriodEnds: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        canCancel: true
      });

      const response = await request(app)
        .get(`/api/gdpr/deletion-status/${deletionId}`)
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'pending',
        canCancel: true,
        gracePeriodEnds: expect.any(String),
        timeRemaining: expect.any(String)
      });
    });

    test('should allow deletion cancellation within grace period', async () => {
      const deletionId = 'deletion-123';
      
      AccountDeletionService.prototype.cancelDeletion.mockResolvedValue({
        success: true,
        deletionId,
        status: 'cancelled',
        cancelledAt: new Date().toISOString()
      });

      const response = await request(app)
        .post(`/api/gdpr/cancel-deletion/${deletionId}`)
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send({
          reason: 'changed_mind'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        status: 'cancelled',
        message: expect.stringContaining('deletion cancelled')
      });
    });

    test('should prevent cancellation after grace period', async () => {
      const deletionId = 'deletion-123';
      
      AccountDeletionService.prototype.getDeletionStatus.mockResolvedValue({
        success: true,
        deletionId,
        status: 'processing',
        gracePeriodEnds: new Date(Date.now() - 60000).toISOString(), // Expired
        canCancel: false
      });

      const response = await request(app)
        .post(`/api/gdpr/cancel-deletion/${deletionId}`)
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send({
          reason: 'changed_mind'
        })
        .expect(409); // Conflict

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('grace period expired')
      });
    });

    test('should handle configurable grace periods', async () => {
      const testCases = [
        { gracePeriod: '1 day', expectedHours: 24 },
        { gracePeriod: '7 days', expectedHours: 168 },
        { gracePeriod: '30 days', expectedHours: 720 }
      ];

      for (const testCase of testCases) {
        AccountDeletionService.prototype.initiateDeletion.mockResolvedValue({
          success: true,
          deletionId: `deletion-${testCase.gracePeriod}`,
          status: 'initiated',
          gracePeriod: testCase.gracePeriod
        });

        const response = await request(app)
          .post('/api/gdpr/delete-account')
          .set('Authorization', `Bearer ${mockAuthToken}`)
          .send({
            reason: 'user_request',
            confirmDeletion: true,
            gracePeriod: testCase.gracePeriod
          })
          .expect(200);

        expect(response.body.gracePeriod).toBe(testCase.gracePeriod);
      }
    });
  });

  describe('Deletion Process Validation', () => {
    test('should validate complete data removal', async () => {
      const deletionId = 'deletion-complete';
      
      AccountDeletionService.prototype.getDeletionStatus.mockResolvedValue({
        success: true,
        deletionId,
        status: 'completed',
        completedAt: new Date().toISOString(),
        deletionSummary: {
          azureAdB2CProfile: 'deleted',
          applicationData: 'deleted',
          fileUploads: 'deleted',
          sessionData: 'deleted',
          auditLogs: 'anonymized',
          backupData: 'securely_destroyed'
        },
        verificationResults: {
          azureAdB2CVerified: true,
          applicationDataVerified: true,
          fileStorageVerified: true,
          sessionStorageVerified: true
        }
      });

      const response = await request(app)
        .get(`/api/gdpr/deletion-status/${deletionId}`)
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(response.body.status).toBe('completed');
      expect(response.body.deletionSummary).toBeDefined();
      expect(response.body.verificationResults).toBeDefined();
      
      // Verify all data categories are addressed
      const summary = response.body.deletionSummary;
      expect(summary.azureAdB2CProfile).toBe('deleted');
      expect(summary.applicationData).toBe('deleted');
      expect(summary.fileUploads).toBe('deleted');
      expect(summary.sessionData).toBe('deleted');
    });

    test('should handle partial deletion failures', async () => {
      const deletionId = 'deletion-partial-fail';
      
      AccountDeletionService.prototype.getDeletionStatus.mockResolvedValue({
        success: false,
        deletionId,
        status: 'failed',
        failedAt: new Date().toISOString(),
        error: 'Partial deletion failure',
        deletionSummary: {
          azureAdB2CProfile: 'deleted',
          applicationData: 'deleted',
          fileUploads: 'failed',
          sessionData: 'deleted'
        },
        failureReasons: [
          'File storage service unavailable',
          'Some files could not be accessed'
        ],
        retryable: true,
        nextRetryAt: new Date(Date.now() + 3600000).toISOString()
      });

      const response = await request(app)
        .get(`/api/gdpr/deletion-status/${deletionId}`)
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(response.body.status).toBe('failed');
      expect(response.body.failureReasons).toBeDefined();
      expect(response.body.retryable).toBe(true);
      expect(response.body.nextRetryAt).toBeDefined();
    });

    test('should support manual deletion retry', async () => {
      const deletionId = 'deletion-retry';
      
      AccountDeletionService.prototype.initiateDeletion.mockResolvedValue({
        success: true,
        deletionId,
        status: 'retry_initiated',
        retryAttempt: 2,
        previousFailures: ['File storage timeout']
      });

      const response = await request(app)
        .post(`/api/gdpr/retry-deletion/${deletionId}`)
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send({
          reason: 'manual_retry'
        })
        .expect(200);

      expect(response.body.status).toBe('retry_initiated');
      expect(response.body.retryAttempt).toBe(2);
    });
  });

  describe('Data Backup and Recovery', () => {
    test('should create backup before deletion', async () => {
      AccountDeletionService.prototype.initiateDeletion.mockResolvedValue({
        success: true,
        deletionId: 'deletion-with-backup',
        status: 'backup_created',
        backupId: 'backup-123',
        backupLocation: 'secure-storage',
        backupRetentionPeriod: '90 days'
      });

      const response = await request(app)
        .post('/api/gdpr/delete-account')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send({
          reason: 'user_request',
          confirmDeletion: true,
          createBackup: true
        })
        .expect(200);

      expect(response.body.backupId).toBeDefined();
      expect(response.body.backupRetentionPeriod).toBe('90 days');
    });

    test('should handle backup restoration request', async () => {
      const backupId = 'backup-123';
      
      AccountDeletionService.prototype.restoreFromBackup = jest.fn().mockResolvedValue({
        success: true,
        restorationId: 'restore-123',
        status: 'restoration_initiated',
        estimatedCompletion: new Date(Date.now() + 3600000).toISOString()
      });

      const response = await request(app)
        .post(`/api/gdpr/restore-account/${backupId}`)
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send({
          reason: 'accidental_deletion',
          confirmRestore: true
        })
        .expect(200);

      expect(response.body.status).toBe('restoration_initiated');
      expect(response.body.restorationId).toBeDefined();
    });

    test('should validate backup expiration', async () => {
      const expiredBackupId = 'backup-expired';
      
      AccountDeletionService.prototype.restoreFromBackup = jest.fn().mockRejectedValue(
        new Error('Backup has expired and been securely destroyed')
      );

      const response = await request(app)
        .post(`/api/gdpr/restore-account/${expiredBackupId}`)
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send({
          reason: 'accidental_deletion',
          confirmRestore: true
        })
        .expect(410); // Gone

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('backup has expired')
      });
    });
  });

  describe('Legal and Compliance Requirements', () => {
    test('should validate legal basis for deletion', async () => {
      const legalDeletionReasons = [
        {
          reason: 'gdpr_article_17_1a',
          description: 'Personal data no longer necessary'
        },
        {
          reason: 'gdpr_article_17_1b', 
          description: 'Withdrawal of consent'
        },
        {
          reason: 'gdpr_article_17_1c',
          description: 'Objection to processing'
        },
        {
          reason: 'gdpr_article_17_1d',
          description: 'Unlawful processing'
        }
      ];

      for (const legalReason of legalDeletionReasons) {
        AccountDeletionService.prototype.initiateDeletion.mockResolvedValue({
          success: true,
          deletionId: `deletion-${legalReason.reason}`,
          status: 'initiated',
          legalBasis: legalReason.reason
        });

        const response = await request(app)
          .post('/api/gdpr/delete-account')
          .set('Authorization', `Bearer ${mockAuthToken}`)
          .send({
            reason: 'gdpr_compliance',
            legalBasis: legalReason.reason,
            confirmDeletion: true
          })
          .expect(200);

        expect(response.body.legalBasis).toBe(legalReason.reason);
      }
    });

    test('should handle deletion restrictions', async () => {
      AccountDeletionService.prototype.initiateDeletion.mockRejectedValue({
        name: 'DeletionRestrictedError',
        message: 'Deletion restricted due to legal hold',
        restrictions: [
          'Active legal proceedings',
          'Regulatory investigation ongoing',
          'Contractual obligations'
        ]
      });

      const response = await request(app)
        .post('/api/gdpr/delete-account')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send({
          reason: 'user_request',
          confirmDeletion: true
        })
        .expect(409); // Conflict

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('deletion restricted'),
        restrictions: expect.arrayContaining([
          'Active legal proceedings',
          'Regulatory investigation ongoing'
        ])
      });
    });

    test('should maintain audit trail for deletion process', async () => {
      const mockAuditLog = jest.fn();
      jest.doMock('../../services/auditLoggingService', () => ({
        AuditLoggingService: {
          logEvent: mockAuditLog
        }
      }));

      AccountDeletionService.prototype.initiateDeletion.mockResolvedValue({
        success: true,
        deletionId: 'deletion-audit',
        status: 'initiated'
      });

      await request(app)
        .post('/api/gdpr/delete-account')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send({
          reason: 'user_request',
          confirmDeletion: true
        })
        .expect(200);

      expect(mockAuditLog).toHaveBeenCalledWith(
        'GDPR_DELETION_REQUESTED',
        expect.objectContaining({
          userId: mockUser.id,
          reason: 'user_request',
          timestamp: expect.any(String),
          ipAddress: expect.any(String)
        })
      );
    });
  });

  describe('Cross-System Data Removal', () => {
    test('should coordinate deletion across multiple systems', async () => {
      AccountDeletionService.prototype.getDeletionStatus.mockResolvedValue({
        success: true,
        deletionId: 'deletion-cross-system',
        status: 'completed',
        systemDeletions: {
          azureAdB2C: { status: 'completed', deletedAt: '2024-01-01T10:00:00Z' },
          applicationDatabase: { status: 'completed', deletedAt: '2024-01-01T10:01:00Z' },
          fileStorage: { status: 'completed', deletedAt: '2024-01-01T10:02:00Z' },
          analyticsService: { status: 'anonymized', anonymizedAt: '2024-01-01T10:03:00Z' },
          backupSystems: { status: 'purged', purgedAt: '2024-01-01T10:04:00Z' }
        }
      });

      const response = await request(app)
        .get('/api/gdpr/deletion-status/deletion-cross-system')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(response.body.systemDeletions).toBeDefined();
      
      const systems = response.body.systemDeletions;
      expect(systems.azureAdB2C.status).toBe('completed');
      expect(systems.applicationDatabase.status).toBe('completed');
      expect(systems.fileStorage.status).toBe('completed');
      expect(systems.analyticsService.status).toBe('anonymized');
      expect(systems.backupSystems.status).toBe('purged');
    });

    test('should handle third-party system deletion notifications', async () => {
      const deletionId = 'deletion-third-party';
      
      const response = await request(app)
        .post(`/api/gdpr/deletion-notification/${deletionId}`)
        .set('Authorization', 'Bearer third-party-system-token')
        .send({
          system: 'analytics-service',
          status: 'completed',
          deletedRecords: 1250,
          anonymizedRecords: 340,
          completedAt: '2024-01-01T10:00:00Z'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        acknowledged: true,
        system: 'analytics-service'
      });
    });
  });

  describe('Performance and Error Handling', () => {
    test('should handle deletion service unavailability', async () => {
      AccountDeletionService.prototype.initiateDeletion.mockRejectedValue(
        new Error('Deletion service temporarily unavailable')
      );

      const response = await request(app)
        .post('/api/gdpr/delete-account')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send({
          reason: 'user_request',
          confirmDeletion: true
        })
        .expect(503);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('service unavailable'),
        retryable: true,
        retryAfter: expect.any(Number)
      });
    });

    test('should implement deletion request rate limiting', async () => {
      // First deletion request
      AccountDeletionService.prototype.initiateDeletion.mockResolvedValue({
        success: true,
        deletionId: 'deletion-1',
        status: 'initiated'
      });

      await request(app)
        .post('/api/gdpr/delete-account')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send({
          reason: 'user_request',
          confirmDeletion: true
        })
        .expect(200);

      // Second deletion request immediately after
      const response = await request(app)
        .post('/api/gdpr/delete-account')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send({
          reason: 'user_request',
          confirmDeletion: true
        })
        .expect(429); // Too Many Requests

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('rate limit'),
        retryAfter: expect.any(Number)
      });
    });

    test('should handle large-scale deletion operations', async () => {
      const largeDeletionId = 'deletion-large-scale';
      
      AccountDeletionService.prototype.getDeletionStatus.mockResolvedValue({
        success: true,
        deletionId: largeDeletionId,
        status: 'processing',
        progress: {
          totalSteps: 10,
          completedSteps: 6,
          currentStep: 'Deleting file uploads',
          estimatedTimeRemaining: '15 minutes'
        },
        dataVolume: {
          profileData: '2KB',
          fileUploads: '450MB',
          sessionData: '15MB',
          auditLogs: '8MB'
        }
      });

      const response = await request(app)
        .get(`/api/gdpr/deletion-status/${largeDeletionId}`)
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(response.body.progress).toBeDefined();
      expect(response.body.dataVolume).toBeDefined();
      expect(response.body.progress.completedSteps).toBe(6);
      expect(response.body.progress.totalSteps).toBe(10);
    });
  });
});
