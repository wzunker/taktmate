// GDPR Audit Logging and Compliance Monitoring Tests
// Tests comprehensive audit trail, compliance monitoring, and regulatory reporting

const request = require('supertest');
const app = require('../../index');
const { AuditLoggingService } = require('../../services/auditLoggingService');
const { DataRetentionService } = require('../../services/dataRetentionService');

// Mock services
jest.mock('../../services/auditLoggingService');
jest.mock('../../services/dataRetentionService');
jest.mock('@azure/msal-node');

describe('GDPR Audit and Compliance Validation', () => {
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
    
    // Mock audit logging service
    AuditLoggingService.logEvent = jest.fn();
    AuditLoggingService.queryLogs = jest.fn();
    AuditLoggingService.generateReport = jest.fn();
    AuditLoggingService.getStatistics = jest.fn();
    
    // Mock data retention service
    DataRetentionService.prototype.getRetentionStatus = jest.fn();
    DataRetentionService.prototype.enforceRetention = jest.fn();
    DataRetentionService.prototype.generateRetentionReport = jest.fn();
  });

  describe('Audit Event Logging', () => {
    test('should log data access events', async () => {
      const mockAuditEvents = [
        {
          eventId: 'audit-1',
          eventType: 'DATA_ACCESS',
          category: 'DATA_SUBJECT_REQUEST',
          userId: mockUser.id,
          timestamp: new Date().toISOString(),
          details: {
            dataType: 'profile',
            accessMethod: 'api',
            purpose: 'user_profile_view'
          }
        }
      ];

      AuditLoggingService.queryLogs.mockResolvedValue({
        success: true,
        events: mockAuditEvents,
        totalCount: 1
      });

      const response = await request(app)
        .get('/api/gdpr/audit/data-access')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .query({
          userId: mockUser.id,
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        events: expect.arrayContaining([
          expect.objectContaining({
            eventType: 'DATA_ACCESS',
            category: 'DATA_SUBJECT_REQUEST',
            userId: mockUser.id
          })
        ])
      });
    });

    test('should log data modification events', async () => {
      const mockModificationEvents = [
        {
          eventId: 'audit-mod-1',
          eventType: 'DATA_MODIFICATION',
          category: 'PROFILE_UPDATE',
          userId: mockUser.id,
          timestamp: new Date().toISOString(),
          details: {
            modifiedFields: ['given_name', 'family_name'],
            previousValues: { given_name: 'Old', family_name: 'Name' },
            newValues: { given_name: 'New', family_name: 'Name' },
            modificationReason: 'user_request'
          }
        }
      ];

      AuditLoggingService.queryLogs.mockResolvedValue({
        success: true,
        events: mockModificationEvents,
        totalCount: 1
      });

      const response = await request(app)
        .get('/api/gdpr/audit/data-modifications')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .query({
          userId: mockUser.id,
          eventType: 'DATA_MODIFICATION'
        })
        .expect(200);

      expect(response.body.events[0].details.modifiedFields).toEqual(['given_name', 'family_name']);
      expect(response.body.events[0].details.previousValues).toBeDefined();
      expect(response.body.events[0].details.newValues).toBeDefined();
    });

    test('should log consent management events', async () => {
      const mockConsentEvents = [
        {
          eventId: 'audit-consent-1',
          eventType: 'CONSENT_GRANTED',
          category: 'CONSENT_MANAGEMENT',
          userId: mockUser.id,
          timestamp: new Date().toISOString(),
          details: {
            consentCategories: ['analytics', 'marketing'],
            consentMethod: 'explicit',
            consentVersion: '2.1',
            ipAddress: '192.168.1.1'
          }
        },
        {
          eventId: 'audit-consent-2',
          eventType: 'CONSENT_WITHDRAWN',
          category: 'CONSENT_MANAGEMENT',
          userId: mockUser.id,
          timestamp: new Date().toISOString(),
          details: {
            withdrawnCategories: ['marketing'],
            withdrawalReason: 'privacy_preference',
            remainingConsent: ['necessary', 'analytics']
          }
        }
      ];

      AuditLoggingService.queryLogs.mockResolvedValue({
        success: true,
        events: mockConsentEvents,
        totalCount: 2
      });

      const response = await request(app)
        .get('/api/gdpr/audit/consent-events')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .query({
          userId: mockUser.id,
          category: 'CONSENT_MANAGEMENT'
        })
        .expect(200);

      expect(response.body.events).toHaveLength(2);
      expect(response.body.events[0].eventType).toBe('CONSENT_GRANTED');
      expect(response.body.events[1].eventType).toBe('CONSENT_WITHDRAWN');
    });

    test('should log data deletion events', async () => {
      const mockDeletionEvents = [
        {
          eventId: 'audit-deletion-1',
          eventType: 'DELETION_REQUESTED',
          category: 'DATA_ERASURE',
          userId: mockUser.id,
          timestamp: new Date().toISOString(),
          details: {
            deletionReason: 'user_request',
            deletionId: 'deletion-123',
            gracePeriod: '7 days',
            scheduledFor: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          }
        },
        {
          eventId: 'audit-deletion-2',
          eventType: 'DELETION_COMPLETED',
          category: 'DATA_ERASURE',
          userId: mockUser.id,
          timestamp: new Date().toISOString(),
          details: {
            deletionId: 'deletion-123',
            deletedDataTypes: ['profile', 'files', 'sessions'],
            verificationStatus: 'verified',
            completedAt: new Date().toISOString()
          }
        }
      ];

      AuditLoggingService.queryLogs.mockResolvedValue({
        success: true,
        events: mockDeletionEvents,
        totalCount: 2
      });

      const response = await request(app)
        .get('/api/gdpr/audit/deletion-events')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .query({
          userId: mockUser.id,
          category: 'DATA_ERASURE'
        })
        .expect(200);

      expect(response.body.events).toHaveLength(2);
      expect(response.body.events[0].eventType).toBe('DELETION_REQUESTED');
      expect(response.body.events[1].eventType).toBe('DELETION_COMPLETED');
    });
  });

  describe('Compliance Monitoring and Reporting', () => {
    test('should generate GDPR compliance report', async () => {
      const mockComplianceReport = {
        reportId: 'compliance-2024-01',
        period: {
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-31T23:59:59Z'
        },
        summary: {
          totalDataSubjects: 1250,
          dataAccessRequests: 45,
          dataExportRequests: 23,
          dataDeletionRequests: 12,
          consentUpdates: 156,
          complianceViolations: 0
        },
        dataProcessingActivities: {
          profileManagement: {
            lawfulBasis: 'contract',
            dataCategories: ['identity', 'contact'],
            retentionPeriod: '2 years',
            subjects: 1250
          },
          analytics: {
            lawfulBasis: 'legitimate_interest',
            dataCategories: ['usage', 'behavioral'],
            retentionPeriod: '13 months',
            subjects: 890
          }
        },
        riskAssessment: {
          overallRisk: 'low',
          identifiedRisks: [],
          mitigationMeasures: [
            'Regular security audits',
            'Data encryption at rest and in transit',
            'Access control and monitoring'
          ]
        }
      };

      AuditLoggingService.generateReport.mockResolvedValue({
        success: true,
        report: mockComplianceReport
      });

      const response = await request(app)
        .get('/api/gdpr/compliance/report')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          reportType: 'gdpr_compliance'
        })
        .expect(200);

      expect(response.body.report.summary).toBeDefined();
      expect(response.body.report.dataProcessingActivities).toBeDefined();
      expect(response.body.report.riskAssessment.overallRisk).toBe('low');
    });

    test('should monitor data retention compliance', async () => {
      const mockRetentionStatus = {
        userId: mockUser.id,
        dataCategories: {
          profile: {
            retentionPeriod: '2 years',
            createdAt: '2022-01-01T00:00:00Z',
            expiresAt: '2024-01-01T00:00:00Z',
            status: 'active',
            daysRemaining: 45
          },
          analytics: {
            retentionPeriod: '13 months',
            createdAt: '2023-01-01T00:00:00Z',
            expiresAt: '2024-02-01T00:00:00Z',
            status: 'active',
            daysRemaining: 75
          },
          marketing: {
            retentionPeriod: '1 year',
            createdAt: '2022-06-01T00:00:00Z',
            expiresAt: '2023-06-01T00:00:00Z',
            status: 'expired',
            scheduledDeletion: '2023-06-08T00:00:00Z'
          }
        },
        complianceStatus: 'partial_compliance',
        actionsRequired: ['Delete expired marketing data']
      };

      DataRetentionService.prototype.getRetentionStatus.mockResolvedValue({
        success: true,
        retention: mockRetentionStatus
      });

      const response = await request(app)
        .get('/api/gdpr/retention/status')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .query({ userId: mockUser.id })
        .expect(200);

      expect(response.body.retention.complianceStatus).toBe('partial_compliance');
      expect(response.body.retention.actionsRequired).toContain('Delete expired marketing data');
    });

    test('should track data breach incidents', async () => {
      const mockBreachEvents = [
        {
          eventId: 'breach-1',
          eventType: 'DATA_BREACH_DETECTED',
          category: 'SECURITY_INCIDENT',
          severity: 'high',
          timestamp: new Date().toISOString(),
          details: {
            breachType: 'unauthorized_access',
            affectedUsers: 150,
            affectedDataTypes: ['email', 'profile'],
            detectionMethod: 'automated_monitoring',
            containmentActions: ['Access revoked', 'Passwords reset'],
            notificationStatus: 'authorities_notified',
            notificationDeadline: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
          }
        }
      ];

      AuditLoggingService.queryLogs.mockResolvedValue({
        success: true,
        events: mockBreachEvents,
        totalCount: 1
      });

      const response = await request(app)
        .get('/api/gdpr/audit/security-incidents')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .query({
          eventType: 'DATA_BREACH_DETECTED',
          severity: 'high'
        })
        .expect(200);

      expect(response.body.events[0].details.affectedUsers).toBe(150);
      expect(response.body.events[0].details.notificationStatus).toBe('authorities_notified');
    });
  });

  describe('Data Subject Rights Tracking', () => {
    test('should track right to access requests', async () => {
      const mockAccessRequests = [
        {
          requestId: 'access-req-1',
          userId: mockUser.id,
          requestType: 'data_access',
          status: 'completed',
          requestedAt: '2024-01-15T10:00:00Z',
          completedAt: '2024-01-16T14:30:00Z',
          processingTime: '1 day 4 hours 30 minutes',
          dataProvided: ['profile', 'activity_logs', 'consent_history'],
          deliveryMethod: 'secure_download'
        }
      ];

      AuditLoggingService.queryLogs.mockResolvedValue({
        success: true,
        events: mockAccessRequests.map(req => ({
          eventId: req.requestId,
          eventType: 'DATA_ACCESS_REQUEST',
          category: 'DATA_SUBJECT_REQUEST',
          userId: req.userId,
          timestamp: req.requestedAt,
          details: req
        })),
        totalCount: 1
      });

      const response = await request(app)
        .get('/api/gdpr/audit/access-requests')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .query({
          userId: mockUser.id,
          requestType: 'data_access'
        })
        .expect(200);

      expect(response.body.events[0].details.status).toBe('completed');
      expect(response.body.events[0].details.processingTime).toBe('1 day 4 hours 30 minutes');
    });

    test('should track right to rectification requests', async () => {
      const mockRectificationRequests = [
        {
          requestId: 'rectify-req-1',
          userId: mockUser.id,
          requestType: 'data_rectification',
          status: 'completed',
          requestedAt: '2024-01-20T09:00:00Z',
          completedAt: '2024-01-20T15:45:00Z',
          fieldsUpdated: ['email', 'phone_number'],
          previousValues: { email: 'old@example.com', phone_number: '+1234567890' },
          newValues: { email: 'new@example.com', phone_number: '+0987654321' },
          verificationMethod: 'email_confirmation'
        }
      ];

      AuditLoggingService.queryLogs.mockResolvedValue({
        success: true,
        events: mockRectificationRequests.map(req => ({
          eventId: req.requestId,
          eventType: 'DATA_RECTIFICATION_REQUEST',
          category: 'DATA_SUBJECT_REQUEST',
          userId: req.userId,
          timestamp: req.requestedAt,
          details: req
        })),
        totalCount: 1
      });

      const response = await request(app)
        .get('/api/gdpr/audit/rectification-requests')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .query({
          userId: mockUser.id,
          requestType: 'data_rectification'
        })
        .expect(200);

      expect(response.body.events[0].details.fieldsUpdated).toEqual(['email', 'phone_number']);
      expect(response.body.events[0].details.verificationMethod).toBe('email_confirmation');
    });

    test('should track right to portability requests', async () => {
      const mockPortabilityRequests = [
        {
          requestId: 'port-req-1',
          userId: mockUser.id,
          requestType: 'data_portability',
          status: 'completed',
          requestedAt: '2024-01-25T11:00:00Z',
          completedAt: '2024-01-25T16:20:00Z',
          exportFormat: 'json',
          dataCategories: ['profile', 'preferences', 'activity'],
          fileSize: '2.5MB',
          downloadUrl: 'https://secure-download.example.com/export-123.json',
          expiresAt: '2024-02-01T16:20:00Z'
        }
      ];

      AuditLoggingService.queryLogs.mockResolvedValue({
        success: true,
        events: mockPortabilityRequests.map(req => ({
          eventId: req.requestId,
          eventType: 'DATA_PORTABILITY_REQUEST',
          category: 'DATA_SUBJECT_REQUEST',
          userId: req.userId,
          timestamp: req.requestedAt,
          details: req
        })),
        totalCount: 1
      });

      const response = await request(app)
        .get('/api/gdpr/audit/portability-requests')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .query({
          userId: mockUser.id,
          requestType: 'data_portability'
        })
        .expect(200);

      expect(response.body.events[0].details.exportFormat).toBe('json');
      expect(response.body.events[0].details.fileSize).toBe('2.5MB');
    });
  });

  describe('Performance and Statistics', () => {
    test('should provide GDPR compliance statistics', async () => {
      const mockStatistics = {
        period: {
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-31T23:59:59Z'
        },
        requests: {
          totalRequests: 125,
          accessRequests: 45,
          rectificationRequests: 23,
          erasureRequests: 12,
          portabilityRequests: 28,
          restrictionRequests: 8,
          objectionRequests: 9
        },
        processingTimes: {
          averageAccessTime: '18 hours',
          averageRectificationTime: '4 hours',
          averageErasureTime: '5 days',
          averagePortabilityTime: '6 hours'
        },
        complianceMetrics: {
          requestsWithinDeadline: 98.4,
          averageResponseTime: '12 hours',
          customerSatisfactionScore: 4.2,
          complianceViolations: 0
        }
      };

      AuditLoggingService.getStatistics.mockResolvedValue({
        success: true,
        statistics: mockStatistics
      });

      const response = await request(app)
        .get('/api/gdpr/statistics')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        })
        .expect(200);

      expect(response.body.statistics.requests.totalRequests).toBe(125);
      expect(response.body.statistics.complianceMetrics.requestsWithinDeadline).toBe(98.4);
    });

    test('should track processing deadline compliance', async () => {
      const mockDeadlineTracking = {
        activeRequests: [
          {
            requestId: 'req-1',
            requestType: 'data_access',
            requestedAt: '2024-01-30T10:00:00Z',
            deadline: '2024-02-29T10:00:00Z', // 30 days for access
            daysRemaining: 28,
            status: 'in_progress',
            riskLevel: 'low'
          },
          {
            requestId: 'req-2',
            requestType: 'data_erasure',
            requestedAt: '2024-01-25T14:00:00Z',
            deadline: '2024-02-24T14:00:00Z', // 30 days for erasure
            daysRemaining: 23,
            status: 'pending_approval',
            riskLevel: 'medium'
          }
        ],
        overdue: [],
        upcomingDeadlines: [
          {
            requestId: 'req-3',
            deadline: '2024-02-02T09:00:00Z',
            daysRemaining: 1,
            riskLevel: 'high'
          }
        ]
      };

      AuditLoggingService.getDeadlineTracking = jest.fn().mockResolvedValue({
        success: true,
        tracking: mockDeadlineTracking
      });

      const response = await request(app)
        .get('/api/gdpr/deadlines')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(response.body.tracking.activeRequests).toHaveLength(2);
      expect(response.body.tracking.overdue).toHaveLength(0);
      expect(response.body.tracking.upcomingDeadlines).toHaveLength(1);
    });

    test('should generate regulatory reporting', async () => {
      const mockRegulatoryReport = {
        reportType: 'dpa_annual_report',
        reportingPeriod: {
          start: '2023-01-01T00:00:00Z',
          end: '2023-12-31T23:59:59Z'
        },
        organization: {
          name: 'TaktMate',
          dataController: true,
          dataProcessor: false,
          dpoContact: 'dpo@taktmate.com'
        },
        processingActivities: {
          userAccountManagement: {
            purpose: 'Account management and service provision',
            lawfulBasis: 'contract',
            dataCategories: ['identity', 'contact', 'profile'],
            dataSubjects: 5420,
            retentionPeriod: '2 years after account closure',
            thirdPartySharing: false
          },
          analyticsAndImprovement: {
            purpose: 'Service improvement and analytics',
            lawfulBasis: 'legitimate_interest',
            dataCategories: ['usage', 'behavioral', 'technical'],
            dataSubjects: 4890,
            retentionPeriod: '13 months',
            thirdPartySharing: true,
            thirdParties: ['Analytics Service Provider']
          }
        },
        dataSubjectRequests: {
          total: 456,
          access: 234,
          rectification: 89,
          erasure: 67,
          portability: 45,
          restriction: 12,
          objection: 9,
          averageResponseTime: '8.5 days',
          withinDeadline: 98.9
        },
        securityIncidents: {
          total: 1,
          notifiableBreaches: 0,
          affectedDataSubjects: 0,
          averageContainmentTime: 'N/A'
        }
      };

      AuditLoggingService.generateRegulatoryReport = jest.fn().mockResolvedValue({
        success: true,
        report: mockRegulatoryReport
      });

      const response = await request(app)
        .get('/api/gdpr/regulatory-report')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .query({
          reportType: 'dpa_annual_report',
          year: '2023'
        })
        .expect(200);

      expect(response.body.report.dataSubjectRequests.withinDeadline).toBe(98.9);
      expect(response.body.report.securityIncidents.notifiableBreaches).toBe(0);
    });
  });

  describe('Data Quality and Integrity', () => {
    test('should validate audit log integrity', async () => {
      const mockIntegrityCheck = {
        checkId: 'integrity-check-1',
        checkedAt: new Date().toISOString(),
        period: {
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-31T23:59:59Z'
        },
        results: {
          totalLogs: 12540,
          verifiedLogs: 12540,
          tamperedLogs: 0,
          missingLogs: 0,
          integrityScore: 100.0,
          hashVerification: 'passed',
          timestampVerification: 'passed',
          sequenceVerification: 'passed'
        },
        issues: [],
        recommendations: []
      };

      AuditLoggingService.verifyIntegrity = jest.fn().mockResolvedValue({
        success: true,
        integrity: mockIntegrityCheck
      });

      const response = await request(app)
        .get('/api/gdpr/audit/integrity-check')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        })
        .expect(200);

      expect(response.body.integrity.results.integrityScore).toBe(100.0);
      expect(response.body.integrity.results.tamperedLogs).toBe(0);
      expect(response.body.integrity.issues).toHaveLength(0);
    });

    test('should detect audit log anomalies', async () => {
      const mockAnomalyDetection = {
        detectionId: 'anomaly-detect-1',
        analyzedPeriod: {
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-31T23:59:59Z'
        },
        anomalies: [
          {
            type: 'unusual_access_pattern',
            severity: 'medium',
            description: 'Unusual number of data access requests from single user',
            affectedUser: 'user-suspicious-1',
            eventCount: 45,
            timeframe: '2024-01-15 to 2024-01-16',
            riskLevel: 'medium'
          },
          {
            type: 'bulk_deletion_request',
            severity: 'high',
            description: 'Multiple deletion requests in short timeframe',
            eventCount: 8,
            timeframe: '2024-01-20 14:00-16:00',
            riskLevel: 'high'
          }
        ],
        recommendations: [
          'Investigate unusual access patterns',
          'Review bulk deletion requests for legitimacy',
          'Consider implementing additional monitoring'
        ]
      };

      AuditLoggingService.detectAnomalies = jest.fn().mockResolvedValue({
        success: true,
        detection: mockAnomalyDetection
      });

      const response = await request(app)
        .get('/api/gdpr/audit/anomaly-detection')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        })
        .expect(200);

      expect(response.body.detection.anomalies).toHaveLength(2);
      expect(response.body.detection.anomalies[1].severity).toBe('high');
    });
  });
});
