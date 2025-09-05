// GDPR Consent Management Tests
// Tests user consent recording, tracking, and management through Azure AD B2C

const request = require('supertest');
const app = require('../../index');
const { CookieConsentService } = require('../../services/cookieConsentService');
const { AuditLoggingService } = require('../../services/auditLoggingService');

// Mock services
jest.mock('../../services/cookieConsentService');
jest.mock('../../services/auditLoggingService');
jest.mock('@azure/msal-node');

describe('GDPR Consent Management Validation', () => {
  let mockUser;
  let mockAuthToken;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUser = {
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User'
    };
    
    mockAuthToken = 'valid-jwt-token';
    
    // Mock cookie consent service
    CookieConsentService.prototype.recordConsent = jest.fn();
    CookieConsentService.prototype.getConsentHistory = jest.fn();
    CookieConsentService.prototype.updateConsent = jest.fn();
    CookieConsentService.prototype.withdrawConsent = jest.fn();
    
    // Mock audit logging service
    AuditLoggingService.logEvent = jest.fn();
  });

  describe('Consent Recording and Validation', () => {
    test('should record initial consent preferences', async () => {
      const consentData = {
        necessary: true,
        analytics: true,
        marketing: false,
        personalization: true,
        timestamp: new Date().toISOString(),
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0...',
        consentMethod: 'explicit'
      };

      CookieConsentService.prototype.recordConsent.mockResolvedValue({
        success: true,
        consentId: 'consent-123',
        recordedAt: consentData.timestamp
      });

      const response = await request(app)
        .post('/api/gdpr/consent')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send(consentData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        consentId: expect.any(String),
        recordedAt: expect.any(String)
      });

      expect(CookieConsentService.prototype.recordConsent).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({
          necessary: true,
          analytics: true,
          marketing: false,
          personalization: true
        })
      );
    });

    test('should validate consent categories', async () => {
      const validCategories = [
        'necessary',
        'analytics', 
        'marketing',
        'personalization',
        'functional',
        'performance'
      ];

      const consentData = {};
      validCategories.forEach(category => {
        consentData[category] = Math.random() > 0.5;
      });

      CookieConsentService.prototype.recordConsent.mockResolvedValue({
        success: true,
        consentId: 'consent-valid',
        categories: validCategories
      });

      const response = await request(app)
        .post('/api/gdpr/consent')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send(consentData)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should reject invalid consent categories', async () => {
      const invalidConsentData = {
        necessary: true,
        invalidCategory: true,
        anotherInvalid: false
      };

      const response = await request(app)
        .post('/api/gdpr/consent')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send(invalidConsentData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('invalid consent categories'),
        invalidCategories: ['invalidCategory', 'anotherInvalid']
      });
    });

    test('should require necessary cookies consent', async () => {
      const consentWithoutNecessary = {
        analytics: true,
        marketing: false
        // Missing necessary: true
      };

      const response = await request(app)
        .post('/api/gdpr/consent')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send(consentWithoutNecessary)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('necessary cookies consent required')
      });
    });

    test('should capture consent metadata', async () => {
      const consentData = {
        necessary: true,
        analytics: true,
        consentMethod: 'explicit',
        consentVersion: '2.1',
        privacyPolicyVersion: '1.3',
        cookiePolicyVersion: '1.1'
      };

      CookieConsentService.prototype.recordConsent.mockResolvedValue({
        success: true,
        consentId: 'consent-metadata',
        metadata: {
          method: 'explicit',
          version: '2.1',
          privacyPolicyVersion: '1.3',
          cookiePolicyVersion: '1.1'
        }
      });

      const response = await request(app)
        .post('/api/gdpr/consent')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send(consentData)
        .expect(200);

      expect(response.body.metadata).toBeDefined();
      expect(response.body.metadata.method).toBe('explicit');
      expect(response.body.metadata.version).toBe('2.1');
    });
  });

  describe('Consent History and Tracking', () => {
    test('should retrieve user consent history', async () => {
      const mockConsentHistory = [
        {
          consentId: 'consent-1',
          timestamp: '2024-01-01T10:00:00Z',
          categories: { necessary: true, analytics: true, marketing: false },
          method: 'explicit',
          version: '2.0'
        },
        {
          consentId: 'consent-2',
          timestamp: '2024-01-15T14:30:00Z',
          categories: { necessary: true, analytics: true, marketing: true },
          method: 'updated',
          version: '2.1'
        }
      ];

      CookieConsentService.prototype.getConsentHistory.mockResolvedValue({
        success: true,
        history: mockConsentHistory,
        totalRecords: 2
      });

      const response = await request(app)
        .get('/api/gdpr/consent/history')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        history: expect.arrayContaining([
          expect.objectContaining({
            consentId: expect.any(String),
            timestamp: expect.any(String),
            categories: expect.any(Object),
            method: expect.any(String)
          })
        ]),
        totalRecords: 2
      });
    });

    test('should support consent history pagination', async () => {
      const mockPaginatedHistory = {
        history: Array.from({ length: 10 }, (_, i) => ({
          consentId: `consent-${i + 1}`,
          timestamp: new Date(Date.now() - i * 86400000).toISOString(),
          categories: { necessary: true, analytics: i % 2 === 0 }
        })),
        totalRecords: 25,
        page: 1,
        limit: 10,
        hasMore: true
      };

      CookieConsentService.prototype.getConsentHistory.mockResolvedValue({
        success: true,
        ...mockPaginatedHistory
      });

      const response = await request(app)
        .get('/api/gdpr/consent/history?page=1&limit=10')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(response.body.history).toHaveLength(10);
      expect(response.body.totalRecords).toBe(25);
      expect(response.body.hasMore).toBe(true);
    });

    test('should filter consent history by date range', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';

      CookieConsentService.prototype.getConsentHistory.mockResolvedValue({
        success: true,
        history: [
          {
            consentId: 'consent-filtered',
            timestamp: '2024-01-15T10:00:00Z',
            categories: { necessary: true, analytics: true }
          }
        ],
        dateRange: { start: startDate, end: endDate },
        totalRecords: 1
      });

      const response = await request(app)
        .get(`/api/gdpr/consent/history?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(response.body.dateRange).toEqual({
        start: startDate,
        end: endDate
      });
      expect(response.body.history).toHaveLength(1);
    });
  });

  describe('Consent Updates and Modifications', () => {
    test('should update existing consent preferences', async () => {
      const updatedConsent = {
        necessary: true,
        analytics: false, // Changed from true
        marketing: true,  // Changed from false
        personalization: true,
        updateReason: 'user_preference_change'
      };

      CookieConsentService.prototype.updateConsent.mockResolvedValue({
        success: true,
        consentId: 'consent-updated',
        previousConsent: {
          necessary: true,
          analytics: true,
          marketing: false,
          personalization: true
        },
        newConsent: updatedConsent,
        changes: [
          { category: 'analytics', from: true, to: false },
          { category: 'marketing', from: false, to: true }
        ]
      });

      const response = await request(app)
        .put('/api/gdpr/consent')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send(updatedConsent)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        changes: expect.arrayContaining([
          expect.objectContaining({
            category: 'analytics',
            from: true,
            to: false
          }),
          expect.objectContaining({
            category: 'marketing',
            from: false,
            to: true
          })
        ])
      });
    });

    test('should validate consent update permissions', async () => {
      const unauthorizedUpdate = {
        necessary: false, // Cannot be set to false
        analytics: true
      };

      const response = await request(app)
        .put('/api/gdpr/consent')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send(unauthorizedUpdate)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('necessary cookies cannot be disabled')
      });
    });

    test('should handle batch consent updates', async () => {
      const batchUpdate = {
        updates: [
          { category: 'analytics', consent: false },
          { category: 'marketing', consent: true },
          { category: 'personalization', consent: false }
        ],
        reason: 'privacy_preference_update'
      };

      CookieConsentService.prototype.updateConsent.mockResolvedValue({
        success: true,
        batchId: 'batch-123',
        processedUpdates: 3,
        failedUpdates: 0,
        results: batchUpdate.updates.map(update => ({
          category: update.category,
          success: true,
          previousValue: !update.consent,
          newValue: update.consent
        }))
      });

      const response = await request(app)
        .put('/api/gdpr/consent/batch')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send(batchUpdate)
        .expect(200);

      expect(response.body.processedUpdates).toBe(3);
      expect(response.body.failedUpdates).toBe(0);
    });
  });

  describe('Consent Withdrawal', () => {
    test('should allow withdrawal of non-necessary consent', async () => {
      const withdrawalRequest = {
        categories: ['analytics', 'marketing', 'personalization'],
        reason: 'privacy_concerns',
        confirmWithdrawal: true
      };

      CookieConsentService.prototype.withdrawConsent.mockResolvedValue({
        success: true,
        withdrawalId: 'withdrawal-123',
        withdrawnCategories: ['analytics', 'marketing', 'personalization'],
        remainingConsent: { necessary: true },
        effectiveAt: new Date().toISOString()
      });

      const response = await request(app)
        .post('/api/gdpr/consent/withdraw')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send(withdrawalRequest)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        withdrawnCategories: ['analytics', 'marketing', 'personalization'],
        remainingConsent: { necessary: true }
      });
    });

    test('should prevent withdrawal of necessary consent', async () => {
      const invalidWithdrawal = {
        categories: ['necessary', 'analytics'],
        reason: 'complete_withdrawal',
        confirmWithdrawal: true
      };

      const response = await request(app)
        .post('/api/gdpr/consent/withdraw')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send(invalidWithdrawal)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('necessary consent cannot be withdrawn')
      });
    });

    test('should require explicit confirmation for withdrawal', async () => {
      const withdrawalWithoutConfirmation = {
        categories: ['analytics', 'marketing'],
        reason: 'privacy_concerns'
        // Missing confirmWithdrawal: true
      };

      const response = await request(app)
        .post('/api/gdpr/consent/withdraw')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send(withdrawalWithoutConfirmation)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('explicit confirmation required')
      });
    });

    test('should handle complete consent withdrawal (account deletion)', async () => {
      const completeWithdrawal = {
        categories: ['all'],
        reason: 'account_deletion',
        confirmWithdrawal: true,
        deleteAccount: true
      };

      CookieConsentService.prototype.withdrawConsent.mockResolvedValue({
        success: true,
        withdrawalId: 'withdrawal-complete',
        accountDeletionTriggered: true,
        deletionId: 'deletion-456',
        effectiveAt: new Date().toISOString()
      });

      const response = await request(app)
        .post('/api/gdpr/consent/withdraw')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send(completeWithdrawal)
        .expect(200);

      expect(response.body.accountDeletionTriggered).toBe(true);
      expect(response.body.deletionId).toBeDefined();
    });
  });

  describe('Consent Verification and Validation', () => {
    test('should verify current consent status', async () => {
      const mockCurrentConsent = {
        consentId: 'consent-current',
        userId: mockUser.id,
        categories: {
          necessary: true,
          analytics: true,
          marketing: false,
          personalization: true
        },
        lastUpdated: '2024-01-15T10:00:00Z',
        version: '2.1',
        valid: true,
        expiresAt: '2025-01-15T10:00:00Z'
      };

      CookieConsentService.prototype.getCurrentConsent = jest.fn().mockResolvedValue({
        success: true,
        consent: mockCurrentConsent
      });

      const response = await request(app)
        .get('/api/gdpr/consent/current')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        consent: expect.objectContaining({
          categories: expect.any(Object),
          valid: true,
          expiresAt: expect.any(String)
        })
      });
    });

    test('should detect expired consent', async () => {
      const expiredConsent = {
        consentId: 'consent-expired',
        valid: false,
        expiresAt: '2023-12-31T23:59:59Z',
        expired: true,
        renewalRequired: true
      };

      CookieConsentService.prototype.getCurrentConsent = jest.fn().mockResolvedValue({
        success: true,
        consent: expiredConsent
      });

      const response = await request(app)
        .get('/api/gdpr/consent/current')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(response.body.consent.expired).toBe(true);
      expect(response.body.consent.renewalRequired).toBe(true);
    });

    test('should validate consent against current policy versions', async () => {
      const consentValidation = {
        consentId: 'consent-validation',
        currentPolicyVersions: {
          privacy: '1.4',
          cookies: '1.2',
          terms: '2.1'
        },
        consentPolicyVersions: {
          privacy: '1.3', // Outdated
          cookies: '1.2', // Current
          terms: '2.1'    // Current
        },
        validationResult: {
          valid: false,
          outdatedPolicies: ['privacy'],
          renewalRequired: true
        }
      };

      CookieConsentService.prototype.validateConsent = jest.fn().mockResolvedValue({
        success: true,
        validation: consentValidation
      });

      const response = await request(app)
        .get('/api/gdpr/consent/validate')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(response.body.validation.valid).toBe(false);
      expect(response.body.validation.outdatedPolicies).toContain('privacy');
      expect(response.body.validation.renewalRequired).toBe(true);
    });
  });

  describe('Consent Audit and Compliance', () => {
    test('should log consent changes for audit trail', async () => {
      const consentData = {
        necessary: true,
        analytics: true,
        marketing: false
      };

      CookieConsentService.prototype.recordConsent.mockResolvedValue({
        success: true,
        consentId: 'consent-audit'
      });

      await request(app)
        .post('/api/gdpr/consent')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send(consentData)
        .expect(200);

      expect(AuditLoggingService.logEvent).toHaveBeenCalledWith(
        'CONSENT_RECORDED',
        expect.objectContaining({
          userId: mockUser.id,
          consentCategories: expect.any(Object),
          timestamp: expect.any(String),
          ipAddress: expect.any(String)
        })
      );
    });

    test('should generate consent compliance report', async () => {
      const complianceReport = {
        userId: mockUser.id,
        reportPeriod: {
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-31T23:59:59Z'
        },
        consentEvents: [
          { type: 'initial_consent', timestamp: '2024-01-01T10:00:00Z' },
          { type: 'consent_updated', timestamp: '2024-01-15T14:30:00Z' },
          { type: 'consent_renewed', timestamp: '2024-01-30T09:15:00Z' }
        ],
        complianceStatus: {
          hasValidConsent: true,
          consentUpToDate: true,
          allCategoriesCovered: true,
          auditTrailComplete: true
        },
        recommendations: []
      };

      CookieConsentService.prototype.generateComplianceReport = jest.fn().mockResolvedValue({
        success: true,
        report: complianceReport
      });

      const response = await request(app)
        .get('/api/gdpr/consent/compliance-report')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        })
        .expect(200);

      expect(response.body.report.complianceStatus.hasValidConsent).toBe(true);
      expect(response.body.report.consentEvents).toHaveLength(3);
    });

    test('should support consent data export for GDPR requests', async () => {
      const consentExport = {
        userId: mockUser.id,
        exportFormat: 'json',
        consentHistory: [
          {
            consentId: 'consent-1',
            timestamp: '2024-01-01T10:00:00Z',
            categories: { necessary: true, analytics: true },
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0...'
          }
        ],
        currentConsent: {
          categories: { necessary: true, analytics: true, marketing: false },
          lastUpdated: '2024-01-15T14:30:00Z'
        },
        metadata: {
          totalConsentRecords: 5,
          firstConsentDate: '2024-01-01T10:00:00Z',
          lastConsentUpdate: '2024-01-15T14:30:00Z'
        }
      };

      CookieConsentService.prototype.exportConsentData = jest.fn().mockResolvedValue({
        success: true,
        export: consentExport,
        downloadUrl: 'https://secure-download.example.com/consent-export.json'
      });

      const response = await request(app)
        .get('/api/gdpr/consent/export')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .query({ format: 'json' })
        .expect(200);

      expect(response.body.export.consentHistory).toBeDefined();
      expect(response.body.export.currentConsent).toBeDefined();
      expect(response.body.downloadUrl).toMatch(/^https:/);
    });
  });

  describe('Cross-Border and Regional Compliance', () => {
    test('should handle GDPR-specific consent requirements', async () => {
      const gdprConsent = {
        necessary: true,
        analytics: true,
        marketing: false,
        region: 'EU',
        gdprCompliant: true,
        lawfulBasis: {
          analytics: 'legitimate_interest',
          marketing: 'consent'
        }
      };

      CookieConsentService.prototype.recordConsent.mockResolvedValue({
        success: true,
        consentId: 'consent-gdpr',
        gdprCompliance: {
          lawfulBasisDocumented: true,
          consentSpecific: true,
          consentInformed: true,
          consentUnambiguous: true,
          consentWithdrawable: true
        }
      });

      const response = await request(app)
        .post('/api/gdpr/consent')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .set('X-User-Region', 'EU')
        .send(gdprConsent)
        .expect(200);

      expect(response.body.gdprCompliance).toBeDefined();
      expect(response.body.gdprCompliance.lawfulBasisDocumented).toBe(true);
    });

    test('should handle CCPA-specific consent requirements', async () => {
      const ccpaConsent = {
        necessary: true,
        analytics: true,
        saleOfPersonalInfo: false, // CCPA-specific
        region: 'CA',
        ccpaCompliant: true,
        doNotSellOptOut: true
      };

      CookieConsentService.prototype.recordConsent.mockResolvedValue({
        success: true,
        consentId: 'consent-ccpa',
        ccpaCompliance: {
          doNotSellRightProvided: true,
          optOutMechanismAvailable: true,
          personalInfoSaleDisclosed: true
        }
      });

      const response = await request(app)
        .post('/api/gdpr/consent')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .set('X-User-Region', 'CA')
        .send(ccpaConsent)
        .expect(200);

      expect(response.body.ccpaCompliance).toBeDefined();
      expect(response.body.ccpaCompliance.doNotSellRightProvided).toBe(true);
    });

    test('should adapt consent requirements by user location', async () => {
      const regions = [
        { region: 'EU', framework: 'GDPR' },
        { region: 'CA', framework: 'CCPA' },
        { region: 'US', framework: 'Generic' },
        { region: 'BR', framework: 'LGPD' }
      ];

      for (const { region, framework } of regions) {
        CookieConsentService.prototype.getConsentRequirements = jest.fn().mockResolvedValue({
          success: true,
          region,
          framework,
          requirements: {
            explicitConsent: framework === 'GDPR',
            optOutAvailable: ['CCPA', 'LGPD'].includes(framework),
            granularConsent: ['GDPR', 'LGPD'].includes(framework)
          }
        });

        const response = await request(app)
          .get('/api/gdpr/consent/requirements')
          .set('Authorization', `Bearer ${mockAuthToken}`)
          .set('X-User-Region', region)
          .expect(200);

        expect(response.body.framework).toBe(framework);
        expect(response.body.requirements).toBeDefined();
      }
    });
  });
});
