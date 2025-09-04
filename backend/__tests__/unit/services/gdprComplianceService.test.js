// Unit tests for GDPR Compliance Service
// Tests GDPR compliance features, data export, consent management, and account deletion

const { GDPRComplianceService } = require('../../../services/gdprComplianceService');

// Mock dependencies
jest.mock('../../../services/azureB2CApiService');
const { AzureB2CApiService } = require('../../../services/azureB2CApiService');

jest.mock('applicationinsights', () => ({
  telemetry: {
    trackEvent: jest.fn(),
    trackException: jest.fn()
  }
}));

describe('GDPRComplianceService', () => {
  let gdprService;
  let mockAppInsights;
  let mockAzureB2CApiService;

  beforeEach(() => {
    mockAppInsights = {
      telemetry: {
        trackEvent: jest.fn(),
        trackException: jest.fn()
      }
    };

    mockAzureB2CApiService = {
      initialize: jest.fn().mockResolvedValue(true),
      exportUserData: jest.fn().mockResolvedValue({
        profile: { id: 'test-user', name: 'Test User' },
        signInActivity: [],
        auditLogs: [],
        directoryObjects: []
      }),
      getStatistics: jest.fn().mockReturnValue({
        totalRequests: 100,
        successfulRequests: 95,
        failedRequests: 5
      })
    };

    AzureB2CApiService.mockImplementation(() => mockAzureB2CApiService);

    gdprService = new GDPRComplianceService(mockAppInsights);
  });

  describe('Service Initialization', () => {
    test('should initialize with default configuration', () => {
      expect(gdprService).toBeDefined();
      expect(gdprService.appInsights).toBe(mockAppInsights);
      expect(gdprService.config).toBeDefined();
      expect(gdprService.dataCategories).toBeDefined();
    });

    test('should initialize without Application Insights', () => {
      const service = new GDPRComplianceService();
      expect(service).toBeDefined();
      expect(service.appInsights).toBeNull();
    });

    test('should have correct GDPR configuration', () => {
      expect(gdprService.config.enableGDPRCompliance).toBeDefined();
      expect(gdprService.config.enableConsentManagement).toBeDefined();
      expect(gdprService.config.enableDataExport).toBeDefined();
      expect(gdprService.config.enableAccountDeletion).toBeDefined();
      expect(gdprService.config.dataRetentionPeriod).toBeGreaterThan(0);
    });

    test('should initialize Azure B2C API service during setup', async () => {
      await gdprService.initialize();
      
      expect(mockAzureB2CApiService.initialize).toHaveBeenCalled();
    });
  });

  describe('Azure AD B2C GDPR Capabilities Verification', () => {
    test('should verify Azure AD B2C GDPR capabilities', async () => {
      await gdprService.initialize();
      
      const capabilities = await gdprService.verifyAzureB2CGDPRCapabilities();
      
      expect(capabilities).toBeDefined();
      expect(capabilities.dataExport).toBeDefined();
      expect(capabilities.accountDeletion).toBeDefined();
      expect(capabilities.consentManagement).toBeDefined();
      expect(capabilities.dataRetention).toBeDefined();
      expect(capabilities.auditLogging).toBeDefined();
      expect(capabilities.dataMinimization).toBeDefined();
      expect(capabilities.rightToPortability).toBeDefined();
      expect(capabilities.rightToErasure).toBeDefined();
    });

    test('should identify supported GDPR features', async () => {
      await gdprService.initialize();
      
      const capabilities = await gdprService.verifyAzureB2CGDPRCapabilities();
      
      expect(capabilities.dataExport.supported).toBe(true);
      expect(capabilities.accountDeletion.supported).toBe(true);
      expect(capabilities.consentManagement.supported).toBe(true);
      expect(capabilities.auditLogging.supported).toBe(true);
    });

    test('should provide implementation details for each capability', async () => {
      await gdprService.initialize();
      
      const capabilities = await gdprService.verifyAzureB2CGDPRCapabilities();
      
      expect(capabilities.dataExport.implementation).toContain('Microsoft Graph API');
      expect(capabilities.accountDeletion.implementation).toContain('Azure AD B2C user deletion');
      expect(capabilities.consentManagement.implementation).toContain('Custom attributes');
    });
  });

  describe('Consent Management', () => {
    test('should initialize consent management system', async () => {
      await gdprService.initialize();
      
      const result = await gdprService.initializeConsentManagement();
      
      expect(result.success).toBe(true);
      expect(result.consentTypes).toBeDefined();
      expect(result.consentTypes.length).toBeGreaterThan(0);
    });

    test('should record user consent', async () => {
      const userId = 'test-user-123';
      const consentData = {
        consentType: 'marketing',
        granted: true,
        timestamp: new Date().toISOString(),
        ipAddress: '192.168.1.100',
        userAgent: 'Test Browser'
      };

      const result = await gdprService.recordConsent(userId, consentData);
      
      expect(result.success).toBe(true);
      expect(result.consentId).toBeDefined();
      expect(result.userId).toBe(userId);
      expect(result.consentType).toBe('marketing');
      expect(result.granted).toBe(true);
    });

    test('should record consent withdrawal', async () => {
      const userId = 'test-user-123';
      const consentData = {
        consentType: 'marketing',
        granted: false,
        timestamp: new Date().toISOString(),
        reason: 'User requested withdrawal'
      };

      const result = await gdprService.recordConsent(userId, consentData);
      
      expect(result.success).toBe(true);
      expect(result.granted).toBe(false);
      expect(result.reason).toBe('User requested withdrawal');
    });

    test('should validate consent data', async () => {
      const userId = 'test-user-123';
      const invalidConsentData = {
        // Missing required fields
        granted: true
      };

      const result = await gdprService.recordConsent(userId, invalidConsentData);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid consent data');
    });

    test('should get user consent history', async () => {
      const userId = 'test-user-123';
      
      // Record some consent
      await gdprService.recordConsent(userId, {
        consentType: 'marketing',
        granted: true,
        timestamp: new Date().toISOString()
      });
      
      const history = await gdprService.getUserConsentHistory(userId);
      
      expect(history).toBeDefined();
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].userId).toBe(userId);
    });
  });

  describe('Data Export (Right to Portability)', () => {
    test('should export user data in JSON format', async () => {
      await gdprService.initialize();
      const userId = 'test-user-123';
      
      const result = await gdprService.exportUserData(userId, 'json');
      
      expect(result.success).toBe(true);
      expect(result.format).toBe('json');
      expect(result.data).toBeDefined();
      expect(result.data.personalData).toBeDefined();
      expect(result.data.activityData).toBeDefined();
      expect(result.data.consentData).toBeDefined();
      expect(result.exportId).toBeDefined();
    });

    test('should export user data in CSV format', async () => {
      await gdprService.initialize();
      const userId = 'test-user-123';
      
      const result = await gdprService.exportUserData(userId, 'csv');
      
      expect(result.success).toBe(true);
      expect(result.format).toBe('csv');
      expect(result.data).toBeDefined();
      expect(typeof result.data).toBe('string');
      expect(result.data).toContain('Personal Data');
    });

    test('should export user data in XML format', async () => {
      await gdprService.initialize();
      const userId = 'test-user-123';
      
      const result = await gdprService.exportUserData(userId, 'xml');
      
      expect(result.success).toBe(true);
      expect(result.format).toBe('xml');
      expect(result.data).toBeDefined();
      expect(typeof result.data).toBe('string');
      expect(result.data).toContain('<?xml');
      expect(result.data).toContain('<UserData>');
    });

    test('should include Azure AD B2C data in export', async () => {
      await gdprService.initialize();
      const userId = 'test-user-123';
      
      const result = await gdprService.exportUserData(userId, 'json');
      
      expect(result.data.azureB2CData).toBeDefined();
      expect(mockAzureB2CApiService.exportUserData).toHaveBeenCalledWith(userId);
    });

    test('should handle export request tracking', async () => {
      await gdprService.initialize();
      const userId = 'test-user-123';
      
      const result = await gdprService.exportUserData(userId, 'json');
      
      expect(result.requestId).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.status).toBe('completed');
    });

    test('should sanitize sensitive data in export', async () => {
      await gdprService.initialize();
      const userId = 'test-user-123';
      
      const result = await gdprService.exportUserData(userId, 'json');
      
      // Check that sensitive fields are not included or are redacted
      const dataString = JSON.stringify(result.data);
      expect(dataString).not.toContain('password');
      expect(dataString).not.toContain('secret');
      expect(dataString).not.toContain('token');
    });
  });

  describe('Account Deletion (Right to Erasure)', () => {
    test('should request account deletion', async () => {
      const userId = 'test-user-123';
      const reason = 'user_request';
      
      const result = await gdprService.requestAccountDeletion(userId, reason);
      
      expect(result.success).toBe(true);
      expect(result.deletionRequestId).toBeDefined();
      expect(result.userId).toBe(userId);
      expect(result.reason).toBe(reason);
      expect(result.status).toBe('requested');
    });

    test('should validate deletion request', async () => {
      const userId = '';
      const reason = 'user_request';
      
      const result = await gdprService.requestAccountDeletion(userId, reason);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid user ID');
    });

    test('should track deletion request status', async () => {
      const userId = 'test-user-123';
      
      const deletionResult = await gdprService.requestAccountDeletion(userId);
      const requestId = deletionResult.deletionRequestId;
      
      const status = await gdprService.getDeletionRequestStatus(requestId);
      
      expect(status).toBeDefined();
      expect(status.requestId).toBe(requestId);
      expect(status.userId).toBe(userId);
      expect(status.status).toBeDefined();
    });

    test('should handle deletion dependencies', async () => {
      const userId = 'test-user-123';
      
      const result = await gdprService.requestAccountDeletion(userId);
      
      expect(result.dependencies).toBeDefined();
      expect(result.dependencies.userFiles).toBeDefined();
      expect(result.dependencies.userSessions).toBeDefined();
      expect(result.dependencies.userConsent).toBeDefined();
    });
  });

  describe('Data Retention Compliance', () => {
    test('should check data retention compliance', async () => {
      const result = await gdprService.checkDataRetentionCompliance();
      
      expect(result).toBeDefined();
      expect(result.compliant).toBeDefined();
      expect(result.categories).toBeDefined();
      expect(result.violations).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });

    test('should identify retention violations', async () => {
      const result = await gdprService.checkDataRetentionCompliance();
      
      if (result.violations && result.violations.length > 0) {
        expect(result.violations[0].category).toBeDefined();
        expect(result.violations[0].description).toBeDefined();
        expect(result.violations[0].severity).toBeDefined();
      }
    });

    test('should provide compliance recommendations', async () => {
      const result = await gdprService.checkDataRetentionCompliance();
      
      expect(result.recommendations).toBeDefined();
      if (result.recommendations.length > 0) {
        expect(result.recommendations[0].action).toBeDefined();
        expect(result.recommendations[0].priority).toBeDefined();
      }
    });
  });

  describe('GDPR Request Processing', () => {
    test('should process data subject access request', async () => {
      const userId = 'test-user-123';
      const requestData = {
        requestType: 'access',
        format: 'json',
        includeActivityData: true,
        includeConsentData: true
      };
      
      const result = await gdprService.processGDPRRequest(userId, requestData);
      
      expect(result.success).toBe(true);
      expect(result.requestType).toBe('access');
      expect(result.requestId).toBeDefined();
      expect(result.status).toBeDefined();
    });

    test('should process data rectification request', async () => {
      const userId = 'test-user-123';
      const requestData = {
        requestType: 'rectification',
        updates: {
          name: 'Updated Name',
          email: 'updated@example.com'
        }
      };
      
      const result = await gdprService.processGDPRRequest(userId, requestData);
      
      expect(result.success).toBe(true);
      expect(result.requestType).toBe('rectification');
      expect(result.updates).toBeDefined();
    });

    test('should process data portability request', async () => {
      await gdprService.initialize();
      const userId = 'test-user-123';
      const requestData = {
        requestType: 'portability',
        format: 'json',
        includeAllData: true
      };
      
      const result = await gdprService.processGDPRRequest(userId, requestData);
      
      expect(result.success).toBe(true);
      expect(result.requestType).toBe('portability');
      expect(result.exportData).toBeDefined();
    });

    test('should process erasure request', async () => {
      const userId = 'test-user-123';
      const requestData = {
        requestType: 'erasure',
        reason: 'user_request',
        includeBackup: false
      };
      
      const result = await gdprService.processGDPRRequest(userId, requestData);
      
      expect(result.success).toBe(true);
      expect(result.requestType).toBe('erasure');
      expect(result.deletionRequestId).toBeDefined();
    });

    test('should validate GDPR request data', async () => {
      const userId = 'test-user-123';
      const invalidRequestData = {
        requestType: 'invalid_type'
      };
      
      const result = await gdprService.processGDPRRequest(userId, invalidRequestData);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid request type');
    });
  });

  describe('Compliance Monitoring', () => {
    test('should get compliance status', async () => {
      await gdprService.initialize();
      
      const status = await gdprService.getComplianceStatus();
      
      expect(status).toBeDefined();
      expect(status.gdprCompliance).toBeDefined();
      expect(status.consentManagement).toBeDefined();
      expect(status.dataRetention).toBeDefined();
      expect(status.azureB2CCapabilities).toBeDefined();
      expect(status.azureB2CApiService).toBeDefined();
    });

    test('should track GDPR metrics', async () => {
      const metrics = await gdprService.getGDPRMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.totalRequests).toBeDefined();
      expect(metrics.accessRequests).toBeDefined();
      expect(metrics.rectificationRequests).toBeDefined();
      expect(metrics.portabilityRequests).toBeDefined();
      expect(metrics.erasureRequests).toBeDefined();
      expect(metrics.consentRecords).toBeDefined();
    });

    test('should generate compliance report', async () => {
      const report = await gdprService.generateComplianceReport();
      
      expect(report).toBeDefined();
      expect(report.reportId).toBeDefined();
      expect(report.generatedAt).toBeDefined();
      expect(report.period).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.details).toBeDefined();
    });
  });

  describe('Data Categories and Processing', () => {
    test('should define data categories correctly', () => {
      expect(gdprService.dataCategories).toBeDefined();
      expect(gdprService.dataCategories.IDENTITY_DATA).toBeDefined();
      expect(gdprService.dataCategories.CONTACT_DATA).toBeDefined();
      expect(gdprService.dataCategories.USAGE_DATA).toBeDefined();
      expect(gdprService.dataCategories.TECHNICAL_DATA).toBeDefined();
    });

    test('should have correct legal basis for each category', () => {
      Object.values(gdprService.dataCategories).forEach(category => {
        expect(category.legalBasis).toBeDefined();
        expect(category.legalBasis.length).toBeGreaterThan(0);
        expect(['consent', 'contract', 'legal_obligation', 'vital_interests', 'public_task', 'legitimate_interests'])
          .toContain(category.legalBasis);
      });
    });

    test('should have retention periods for each category', () => {
      Object.values(gdprService.dataCategories).forEach(category => {
        expect(category.retentionPeriod).toBeDefined();
        expect(category.retentionPeriod).toBeGreaterThan(0);
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle Azure B2C API service errors gracefully', async () => {
      mockAzureB2CApiService.exportUserData.mockRejectedValue(new Error('API Error'));
      
      await gdprService.initialize();
      const result = await gdprService.exportUserData('test-user-123', 'json');
      
      expect(result.success).toBe(true); // Should still succeed with local data
      expect(result.data.azureB2CData.error).toBeDefined();
    });

    test('should handle invalid user ID gracefully', async () => {
      const result = await gdprService.exportUserData('', 'json');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid user ID');
    });

    test('should handle unsupported export format gracefully', async () => {
      const result = await gdprService.exportUserData('test-user-123', 'unsupported');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported format');
    });

    test('should track errors in Application Insights', async () => {
      await gdprService.exportUserData('', 'json'); // Invalid user ID
      
      expect(mockAppInsights.telemetry.trackEvent).toHaveBeenCalledWith(
        expect.stringContaining('GDPR_Data_Export'),
        expect.objectContaining({
          success: 'false'
        })
      );
    });
  });

  describe('Statistics and Monitoring', () => {
    test('should track service statistics', async () => {
      await gdprService.initialize();
      
      // Perform some operations
      await gdprService.exportUserData('test-user-123', 'json');
      await gdprService.recordConsent('test-user-123', {
        consentType: 'marketing',
        granted: true,
        timestamp: new Date().toISOString()
      });
      
      const stats = gdprService.getStatistics();
      
      expect(stats.dataExports).toBeGreaterThan(0);
      expect(stats.consentRecords).toBeGreaterThan(0);
      expect(stats.gdprRequests).toBeGreaterThan(0);
    });

    test('should provide performance metrics', () => {
      const stats = gdprService.getStatistics();
      
      expect(stats.averageExportTime).toBeDefined();
      expect(stats.averageRequestProcessingTime).toBeDefined();
      expect(stats.successRate).toBeDefined();
    });
  });
});
