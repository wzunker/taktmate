// Unit tests for Audit Logging Service
// Tests audit event logging, real-time monitoring, encryption, and compliance features

const { AuditLoggingService } = require('../../../services/auditLoggingService');
const fs = require('fs').promises;
const path = require('path');

// Mock dependencies
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
    appendFile: jest.fn().mockResolvedValue(undefined),
    stat: jest.fn().mockResolvedValue({ size: 1024 }),
    rename: jest.fn().mockResolvedValue(undefined),
    unlink: jest.fn().mockResolvedValue(undefined)
  }
}));

jest.mock('applicationinsights', () => ({
  telemetry: {
    trackEvent: jest.fn(),
    trackException: jest.fn()
  }
}));

describe('AuditLoggingService', () => {
  let auditService;
  let mockAppInsights;

  beforeEach(() => {
    mockAppInsights = {
      telemetry: {
        trackEvent: jest.fn(),
        trackException: jest.fn()
      }
    };

    auditService = new AuditLoggingService(mockAppInsights);
    
    // Clear any existing timers
    if (auditService.flushTimer) {
      clearInterval(auditService.flushTimer);
      auditService.flushTimer = null;
    }
  });

  afterEach(() => {
    if (auditService.flushTimer) {
      clearInterval(auditService.flushTimer);
    }
  });

  describe('Service Initialization', () => {
    test('should initialize with default configuration', () => {
      expect(auditService).toBeDefined();
      expect(auditService.appInsights).toBe(mockAppInsights);
      expect(auditService.config).toBeDefined();
      expect(auditService.auditEventTypes).toBeDefined();
      expect(auditService.auditLogStats).toBeDefined();
    });

    test('should initialize without Application Insights', () => {
      const service = new AuditLoggingService();
      expect(service).toBeDefined();
      expect(service.appInsights).toBeNull();
    });

    test('should have correct audit categories', () => {
      const categories = auditService.config.auditCategories;
      
      expect(categories.DATA_ACCESS).toBeDefined();
      expect(categories.DATA_MODIFICATION).toBeDefined();
      expect(categories.AUTHENTICATION).toBeDefined();
      expect(categories.ADMIN_ACTIONS).toBeDefined();
      expect(categories.SYSTEM_EVENTS).toBeDefined();
      expect(categories.PRIVACY_COMPLIANCE).toBeDefined();
      expect(categories.SECURITY_EVENTS).toBeDefined();
      expect(categories.FILE_OPERATIONS).toBeDefined();
    });

    test('should have correct event types', () => {
      const eventTypes = auditService.auditEventTypes;
      
      expect(eventTypes.DATA_READ).toBeDefined();
      expect(eventTypes.DATA_CREATE).toBeDefined();
      expect(eventTypes.AUTH_LOGIN).toBeDefined();
      expect(eventTypes.ADMIN_USER_CREATE).toBeDefined();
      expect(eventTypes.SYSTEM_STARTUP).toBeDefined();
      expect(eventTypes.GDPR_DATA_EXPORT).toBeDefined();
      expect(eventTypes.SECURITY_BREACH_DETECTED).toBeDefined();
      expect(eventTypes.FILE_UPLOAD).toBeDefined();
    });

    test('should initialize audit storage directory', async () => {
      await auditService.initialize();
      
      expect(fs.mkdir).toHaveBeenCalledWith(
        auditService.config.auditStoragePath,
        { recursive: true }
      );
    });

    test('should start periodic flush when enabled', async () => {
      auditService.config.enableAsyncAudit = true;
      
      await auditService.initialize();
      
      expect(auditService.flushTimer).toBeDefined();
    });
  });

  describe('Audit Event Logging', () => {
    test('should log audit event successfully', async () => {
      const eventData = {
        resource: 'user_profile',
        action: 'view'
      };
      const options = {
        userId: 'test-user-123',
        sessionId: 'session-456',
        ipAddress: '192.168.1.100'
      };

      await auditService.logAuditEvent('DATA_READ', eventData, options);
      
      expect(auditService.auditLogStats.totalEvents).toBe(1);
      expect(auditService.auditLogStats.eventsByCategory.DATA_ACCESS).toBe(1);
    });

    test('should sanitize sensitive data in event', async () => {
      const eventData = {
        user: {
          name: 'Test User',
          password: 'secret123',
          token: 'auth-token-456'
        }
      };

      await auditService.logAuditEvent('DATA_CREATE', eventData);
      
      // Check that buffer contains sanitized data
      expect(auditService.auditLogBuffer.length).toBe(1);
      const loggedEvent = auditService.auditLogBuffer[0];
      expect(loggedEvent.eventData.user.password).toBe('[REDACTED]');
      expect(loggedEvent.eventData.user.token).toBe('[REDACTED]');
      expect(loggedEvent.eventData.user.name).toBe('Test User');
    });

    test('should calculate audit hash for integrity', async () => {
      await auditService.logAuditEvent('DATA_READ', { test: 'data' });
      
      const loggedEvent = auditService.auditLogBuffer[0];
      expect(loggedEvent.auditMetadata.hash).toBeDefined();
      expect(typeof loggedEvent.auditMetadata.hash).toBe('string');
      expect(loggedEvent.auditMetadata.hash.length).toBeGreaterThan(0);
    });

    test('should include system information in audit entry', async () => {
      await auditService.logAuditEvent('SYSTEM_STARTUP', {});
      
      const loggedEvent = auditService.auditLogBuffer[0];
      expect(loggedEvent.systemInfo).toBeDefined();
      expect(loggedEvent.systemInfo.hostname).toBeDefined();
      expect(loggedEvent.systemInfo.pid).toBeDefined();
      expect(loggedEvent.systemInfo.memory).toBeDefined();
      expect(loggedEvent.systemInfo.uptime).toBeDefined();
    });

    test('should handle disabled audit categories', async () => {
      auditService.config.auditCategories.DATA_ACCESS.enabled = false;
      
      await auditService.logAuditEvent('DATA_READ', { test: 'data' });
      
      expect(auditService.auditLogStats.totalEvents).toBe(0);
      expect(auditService.auditLogBuffer.length).toBe(0);
    });

    test('should handle unknown event types gracefully', async () => {
      await auditService.logAuditEvent('UNKNOWN_EVENT', { test: 'data' });
      
      expect(auditService.auditLogStats.totalEvents).toBe(0);
      expect(auditService.auditLogBuffer.length).toBe(0);
    });
  });

  describe('Audit Data Encryption', () => {
    beforeEach(() => {
      auditService.config.enableAuditEncryption = true;
      auditService.encryptionKey = Buffer.from('test-encryption-key-32-bytes-long!');
    });

    test('should encrypt sensitive audit entries', () => {
      const auditEntry = {
        eventData: { sensitive: 'data' },
        userId: 'test-user',
        sessionId: 'test-session',
        ipAddress: '192.168.1.100',
        userAgent: 'Test Browser',
        auditMetadata: { encrypted: true }
      };

      const encryptedEntry = auditService.encryptAuditEntry(auditEntry);
      
      expect(encryptedEntry.encryptedData).toBeDefined();
      expect(encryptedEntry.encryptionIv).toBeDefined();
      expect(encryptedEntry.eventData).toBeUndefined();
      expect(encryptedEntry.userId).toBeUndefined();
    });

    test('should decrypt encrypted audit entries', () => {
      const originalEntry = {
        eventData: { sensitive: 'data' },
        userId: 'test-user',
        sessionId: 'test-session',
        ipAddress: '192.168.1.100',
        userAgent: 'Test Browser',
        auditMetadata: { encrypted: true }
      };

      const encryptedEntry = auditService.encryptAuditEntry({ ...originalEntry });
      const decryptedEntry = auditService.decryptAuditEntry(encryptedEntry);
      
      expect(decryptedEntry.eventData).toEqual({ sensitive: 'data' });
      expect(decryptedEntry.userId).toBe('test-user');
      expect(decryptedEntry.sessionId).toBe('test-session');
    });

    test('should handle entries that do not require encryption', () => {
      const auditEntry = {
        eventData: { public: 'data' },
        auditMetadata: { encrypted: false }
      };

      const result = auditService.encryptAuditEntry(auditEntry);
      
      expect(result).toEqual(auditEntry);
      expect(result.encryptedData).toBeUndefined();
    });
  });

  describe('Real-time Monitoring and Alerts', () => {
    beforeEach(() => {
      auditService.config.enableRealTimeAlerts = true;
    });

    test('should trigger alert for failed authentication threshold', async () => {
      // Mock recent events count
      auditService.countRecentEvents = jest.fn().mockResolvedValue(6);
      auditService.triggerAlert = jest.fn();
      
      await auditService.logAuditEvent('AUTH_FAILED', {
        userId: 'test-user',
        ipAddress: '192.168.1.100'
      });
      
      expect(auditService.triggerAlert).toHaveBeenCalledWith(
        'FAILED_AUTH_THRESHOLD_EXCEEDED',
        expect.objectContaining({
          count: 6,
          threshold: auditService.config.alertThresholds.failedAuthAttempts
        })
      );
    });

    test('should trigger alert for data access volume threshold', async () => {
      auditService.countRecentEvents = jest.fn().mockResolvedValue(101);
      auditService.triggerAlert = jest.fn();
      
      await auditService.logAuditEvent('DATA_READ', {
        userId: 'test-user'
      });
      
      expect(auditService.triggerAlert).toHaveBeenCalledWith(
        'DATA_ACCESS_VOLUME_EXCEEDED',
        expect.objectContaining({
          count: 101,
          threshold: auditService.config.alertThresholds.dataAccessVolume
        })
      );
    });

    test('should trigger alert for admin action volume threshold', async () => {
      auditService.countRecentEvents = jest.fn().mockResolvedValue(21);
      auditService.triggerAlert = jest.fn();
      
      await auditService.logAuditEvent('ADMIN_USER_CREATE', {
        userId: 'admin-user'
      });
      
      expect(auditService.triggerAlert).toHaveBeenCalledWith(
        'ADMIN_ACTION_VOLUME_EXCEEDED',
        expect.objectContaining({
          count: 21,
          threshold: auditService.config.alertThresholds.adminActionVolume
        })
      );
    });

    test('should trigger alert for security event volume threshold', async () => {
      auditService.countRecentEvents = jest.fn().mockResolvedValue(4);
      auditService.triggerAlert = jest.fn();
      
      await auditService.logAuditEvent('SECURITY_BREACH_DETECTED', {
        eventType: 'SECURITY_BREACH_DETECTED'
      });
      
      expect(auditService.triggerAlert).toHaveBeenCalledWith(
        'SECURITY_EVENT_VOLUME_EXCEEDED',
        expect.objectContaining({
          count: 4,
          threshold: auditService.config.alertThresholds.securityEventVolume
        })
      );
    });

    test('should create alert with proper structure', async () => {
      const alertType = 'TEST_ALERT';
      const alertData = { test: 'data' };
      
      auditService.logAuditEvent = jest.fn();
      
      await auditService.triggerAlert(alertType, alertData);
      
      expect(auditService.logAuditEvent).toHaveBeenCalledWith(
        'SECURITY_BREACH_DETECTED',
        expect.objectContaining({
          alert: expect.objectContaining({
            alertId: expect.any(String),
            alertType: alertType,
            timestamp: expect.any(String),
            severity: 'HIGH',
            alertData: alertData,
            acknowledged: false
          })
        })
      );
      
      expect(auditService.auditLogStats.alertsTriggered).toBe(1);
    });
  });

  describe('Audit Log Buffering and Flushing', () => {
    test('should buffer audit events when async mode enabled', async () => {
      auditService.config.enableAsyncAudit = true;
      auditService.config.auditBufferSize = 5;
      
      await auditService.logAuditEvent('DATA_READ', { test: 'data1' });
      await auditService.logAuditEvent('DATA_READ', { test: 'data2' });
      
      expect(auditService.auditLogBuffer.length).toBe(2);
      expect(auditService.auditLogStats.bufferSize).toBe(2);
    });

    test('should auto-flush when buffer is full', async () => {
      auditService.config.enableAsyncAudit = true;
      auditService.config.auditBufferSize = 2;
      auditService.flushAuditBuffer = jest.fn();
      
      await auditService.logAuditEvent('DATA_READ', { test: 'data1' });
      await auditService.logAuditEvent('DATA_READ', { test: 'data2' });
      
      expect(auditService.flushAuditBuffer).toHaveBeenCalled();
    });

    test('should flush buffer to storage', async () => {
      auditService.auditLogBuffer = [
        { eventType: 'DATA_READ', timestamp: new Date().toISOString() },
        { eventType: 'DATA_CREATE', timestamp: new Date().toISOString() }
      ];
      auditService.writeAuditEntry = jest.fn();
      
      await auditService.flushAuditBuffer();
      
      expect(auditService.writeAuditEntry).toHaveBeenCalledTimes(2);
      expect(auditService.auditLogBuffer.length).toBe(0);
      expect(auditService.auditLogStats.flushCount).toBe(1);
    });

    test('should handle flush errors gracefully', async () => {
      const testEntries = [
        { eventType: 'DATA_READ', timestamp: new Date().toISOString() }
      ];
      auditService.auditLogBuffer = [...testEntries];
      auditService.writeAuditEntry = jest.fn().mockRejectedValue(new Error('Write error'));
      
      await auditService.flushAuditBuffer();
      
      // Buffer should be restored on error
      expect(auditService.auditLogBuffer.length).toBe(1);
    });
  });

  describe('Audit Log Storage', () => {
    test('should write audit entry to file', async () => {
      const auditEntry = {
        eventId: 'test-id',
        eventType: 'DATA_READ',
        timestamp: new Date().toISOString(),
        auditMetadata: { encrypted: false }
      };
      
      await auditService.writeAuditEntry(auditEntry);
      
      expect(fs.appendFile).toHaveBeenCalledWith(
        expect.stringContaining('audit_'),
        expect.stringContaining('"eventType":"DATA_READ"')
      );
    });

    test('should check for log rotation when enabled', async () => {
      auditService.config.enableAuditRotation = true;
      auditService.checkLogRotation = jest.fn();
      
      const auditEntry = {
        eventId: 'test-id',
        eventType: 'DATA_READ',
        timestamp: new Date().toISOString(),
        auditMetadata: { encrypted: false }
      };
      
      await auditService.writeAuditEntry(auditEntry);
      
      expect(auditService.checkLogRotation).toHaveBeenCalled();
    });

    test('should rotate log file when size threshold exceeded', async () => {
      fs.stat.mockResolvedValue({ size: auditService.config.auditLogRotationSize + 1000 });
      
      const logFilePath = '/test/audit_2024-01-01.jsonl';
      
      await auditService.checkLogRotation(logFilePath);
      
      expect(fs.rename).toHaveBeenCalledWith(
        logFilePath,
        expect.stringMatching(/audit_2024-01-01_.*\.jsonl/)
      );
    });
  });

  describe('Audit Log Querying', () => {
    beforeEach(() => {
      auditService.auditLogBuffer = [
        {
          eventId: '1',
          eventType: 'DATA_READ',
          category: 'DATA_ACCESS',
          userId: 'user1',
          severity: 'INFO',
          timestamp: '2024-01-01T10:00:00.000Z'
        },
        {
          eventId: '2',
          eventType: 'AUTH_LOGIN',
          category: 'AUTHENTICATION',
          userId: 'user2',
          severity: 'WARN',
          timestamp: '2024-01-01T11:00:00.000Z'
        },
        {
          eventId: '3',
          eventType: 'ADMIN_USER_CREATE',
          category: 'ADMIN_ACTIONS',
          userId: 'admin1',
          severity: 'ERROR',
          timestamp: '2024-01-01T12:00:00.000Z'
        }
      ];
    });

    test('should query audit logs without filters', async () => {
      const result = await auditService.queryAuditLogs({});
      
      expect(result.success).toBe(true);
      expect(result.results.length).toBe(3);
      expect(result.totalCount).toBe(3);
    });

    test('should filter by event type', async () => {
      const result = await auditService.queryAuditLogs({
        eventType: 'DATA_READ'
      });
      
      expect(result.success).toBe(true);
      expect(result.results.length).toBe(1);
      expect(result.results[0].eventType).toBe('DATA_READ');
    });

    test('should filter by category', async () => {
      const result = await auditService.queryAuditLogs({
        category: 'AUTHENTICATION'
      });
      
      expect(result.success).toBe(true);
      expect(result.results.length).toBe(1);
      expect(result.results[0].category).toBe('AUTHENTICATION');
    });

    test('should filter by user ID', async () => {
      const result = await auditService.queryAuditLogs({
        userId: 'user1'
      });
      
      expect(result.success).toBe(true);
      expect(result.results.length).toBe(1);
      expect(result.results[0].userId).toBe('user1');
    });

    test('should filter by severity', async () => {
      const result = await auditService.queryAuditLogs({
        severity: 'ERROR'
      });
      
      expect(result.success).toBe(true);
      expect(result.results.length).toBe(1);
      expect(result.results[0].severity).toBe('ERROR');
    });

    test('should filter by date range', async () => {
      const result = await auditService.queryAuditLogs({
        startDate: '2024-01-01T10:30:00.000Z',
        endDate: '2024-01-01T12:30:00.000Z'
      });
      
      expect(result.success).toBe(true);
      expect(result.results.length).toBe(2);
    });

    test('should apply pagination', async () => {
      const result = await auditService.queryAuditLogs({
        limit: 2,
        offset: 1
      });
      
      expect(result.success).toBe(true);
      expect(result.results.length).toBe(2);
      expect(result.totalCount).toBe(3);
    });

    test('should sort results by timestamp descending', async () => {
      const result = await auditService.queryAuditLogs({});
      
      expect(result.success).toBe(true);
      expect(result.results.length).toBe(3);
      expect(new Date(result.results[0].timestamp).getTime())
        .toBeGreaterThan(new Date(result.results[1].timestamp).getTime());
    });
  });

  describe('Audit Middleware', () => {
    test('should create audit middleware function', () => {
      const middleware = auditService.createAuditMiddleware();
      
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });

    test('should log request audit event', async () => {
      const middleware = auditService.createAuditMiddleware();
      auditService.logAuditEvent = jest.fn();
      
      const req = global.testUtils.createMockRequest({
        originalUrl: '/api/users',
        method: 'GET',
        headers: { 'user-agent': 'Test Browser' },
        ip: '192.168.1.100',
        user: { id: 'test-user' }
      });
      const res = global.testUtils.createMockResponse();
      const next = global.testUtils.createMockNext();
      
      await middleware(req, res, next);
      
      expect(req.auditRequestId).toBeDefined();
      expect(auditService.logAuditEvent).toHaveBeenCalledWith(
        'DATA_ACCESS',
        expect.objectContaining({
          requestId: req.auditRequestId,
          endpoint: '/api/users',
          httpMethod: 'GET'
        }),
        expect.objectContaining({
          userId: 'test-user'
        })
      );
      expect(next).toHaveBeenCalled();
    });

    test('should sanitize request headers', async () => {
      const middleware = auditService.createAuditMiddleware();
      auditService.logAuditEvent = jest.fn();
      
      const req = global.testUtils.createMockRequest({
        headers: {
          'authorization': 'Bearer secret-token',
          'cookie': 'session=secret-session',
          'user-agent': 'Test Browser'
        }
      });
      const res = global.testUtils.createMockResponse();
      const next = global.testUtils.createMockNext();
      
      await middleware(req, res, next);
      
      const loggedEventData = auditService.logAuditEvent.mock.calls[0][1];
      expect(loggedEventData.requestHeaders.authorization).toBe('[REDACTED]');
      expect(loggedEventData.requestHeaders.cookie).toBe('[REDACTED]');
      expect(loggedEventData.requestHeaders['user-agent']).toBe('Test Browser');
    });

    test('should handle middleware errors gracefully', async () => {
      const middleware = auditService.createAuditMiddleware();
      auditService.logAuditEvent = jest.fn().mockRejectedValue(new Error('Audit error'));
      
      const req = global.testUtils.createMockRequest();
      const res = global.testUtils.createMockResponse();
      const next = global.testUtils.createMockNext();
      
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalled(); // Should continue even if audit fails
    });
  });

  describe('Statistics and Monitoring', () => {
    test('should track audit statistics', async () => {
      await auditService.logAuditEvent('DATA_READ', {});
      await auditService.logAuditEvent('AUTH_LOGIN', {});
      await auditService.logAuditEvent('ADMIN_USER_CREATE', {});
      
      const stats = auditService.getAuditStatistics();
      
      expect(stats.totalEvents).toBe(3);
      expect(stats.eventsByCategory.DATA_ACCESS).toBe(1);
      expect(stats.eventsByCategory.AUTHENTICATION).toBe(1);
      expect(stats.eventsByCategory.ADMIN_ACTIONS).toBe(1);
      expect(stats.eventsBySeverity.INFO).toBe(1);
      expect(stats.eventsBySeverity.WARN).toBe(1);
      expect(stats.eventsBySeverity.ERROR).toBe(1);
    });

    test('should provide configuration in statistics', () => {
      const stats = auditService.getAuditStatistics();
      
      expect(stats.configuration).toBeDefined();
      expect(stats.configuration.enableAuditLogging).toBeDefined();
      expect(stats.configuration.enableRealTimeAudit).toBeDefined();
      expect(stats.configuration.enableAuditEncryption).toBeDefined();
      expect(stats.configuration.auditCategories).toBeDefined();
      expect(stats.configuration.eventTypes).toBeDefined();
    });

    test('should provide category details in statistics', () => {
      const stats = auditService.getAuditStatistics();
      
      expect(stats.categories).toBeDefined();
      expect(stats.categories.DATA_ACCESS).toBeDefined();
      expect(stats.categories.DATA_ACCESS.name).toBe('Data Access');
      expect(stats.categories.DATA_ACCESS.enabled).toBeDefined();
      expect(stats.categories.DATA_ACCESS.retention).toBeDefined();
      expect(stats.categories.DATA_ACCESS.severity).toBeDefined();
    });

    test('should provide performance metrics', () => {
      const stats = auditService.getAuditStatistics();
      
      expect(stats.performance).toBeDefined();
      expect(stats.performance.bufferUtilization).toBeDefined();
      expect(stats.performance.flushCount).toBeDefined();
      expect(stats.performance.errorRate).toBeDefined();
    });
  });

  describe('Service Lifecycle', () => {
    test('should stop service gracefully', async () => {
      auditService.flushTimer = setInterval(() => {}, 1000);
      auditService.flushAuditBuffer = jest.fn();
      auditService.logAuditEvent = jest.fn();
      
      await auditService.stop();
      
      expect(auditService.flushTimer).toBeNull();
      expect(auditService.flushAuditBuffer).toHaveBeenCalled();
      expect(auditService.logAuditEvent).toHaveBeenCalledWith(
        'SYSTEM_SHUTDOWN',
        expect.objectContaining({
          shutdownTime: expect.any(String),
          auditStats: expect.any(Object)
        })
      );
    });

    test('should handle stop errors gracefully', async () => {
      auditService.flushAuditBuffer = jest.fn().mockRejectedValue(new Error('Flush error'));
      
      await expect(auditService.stop()).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    test('should handle audit logging errors gracefully', async () => {
      auditService.updateAuditStatistics = jest.fn().mockImplementation(() => {
        throw new Error('Statistics error');
      });
      
      await auditService.logAuditEvent('DATA_READ', {});
      
      expect(auditService.auditLogStats.errorCount).toBe(1);
    });

    test('should track errors in Application Insights', async () => {
      auditService.sanitizeEventData = jest.fn().mockImplementation(() => {
        throw new Error('Sanitization error');
      });
      
      await auditService.logAuditEvent('DATA_READ', {});
      
      expect(mockAppInsights.telemetry.trackEvent).toHaveBeenCalledWith(
        'Audit_Logging_Error',
        expect.objectContaining({
          eventType: 'DATA_READ'
        })
      );
    });
  });
});
