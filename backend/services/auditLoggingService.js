// TaktMate Audit Logging Service
// Comprehensive audit trail for data access, modifications, and administrative actions

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { config: azureConfig } = require('../config/azureAdB2C');

/**
 * Audit Logging Service
 * Provides comprehensive audit trails for compliance, security monitoring, and forensic analysis
 */
class AuditLoggingService {
    constructor(appInsights = null, fileStore = null, sessionManagement = null) {
        this.appInsights = appInsights;
        this.fileStore = fileStore;
        this.sessionManagement = sessionManagement;
        
        // Audit logging configuration
        this.config = {
            // General audit settings
            enableAuditLogging: process.env.ENABLE_AUDIT_LOGGING !== 'false',
            enableRealTimeAudit: process.env.ENABLE_REAL_TIME_AUDIT !== 'false',
            enableAuditEncryption: process.env.ENABLE_AUDIT_ENCRYPTION !== 'false',
            
            // Audit log retention
            auditLogRetention: parseInt(process.env.AUDIT_LOG_RETENTION) || 7 * 365 * 24 * 60 * 60 * 1000, // 7 years
            auditLogMaxSize: parseInt(process.env.AUDIT_LOG_MAX_SIZE) || 100 * 1024 * 1024, // 100MB
            auditLogRotationSize: parseInt(process.env.AUDIT_LOG_ROTATION_SIZE) || 10 * 1024 * 1024, // 10MB
            
            // Audit categories
            auditCategories: {
                DATA_ACCESS: {
                    name: 'Data Access',
                    description: 'User data access and retrieval operations',
                    enabled: process.env.AUDIT_DATA_ACCESS !== 'false',
                    retention: parseInt(process.env.AUDIT_DATA_ACCESS_RETENTION) || 2 * 365 * 24 * 60 * 60 * 1000, // 2 years
                    severity: 'INFO',
                    requiresEncryption: true
                },
                DATA_MODIFICATION: {
                    name: 'Data Modification',
                    description: 'Data creation, updates, and deletion operations',
                    enabled: process.env.AUDIT_DATA_MODIFICATION !== 'false',
                    retention: parseInt(process.env.AUDIT_DATA_MODIFICATION_RETENTION) || 7 * 365 * 24 * 60 * 60 * 1000, // 7 years
                    severity: 'WARN',
                    requiresEncryption: true
                },
                AUTHENTICATION: {
                    name: 'Authentication',
                    description: 'User authentication, authorization, and session management',
                    enabled: process.env.AUDIT_AUTHENTICATION !== 'false',
                    retention: parseInt(process.env.AUDIT_AUTHENTICATION_RETENTION) || 1 * 365 * 24 * 60 * 60 * 1000, // 1 year
                    severity: 'WARN',
                    requiresEncryption: true
                },
                ADMIN_ACTIONS: {
                    name: 'Administrative Actions',
                    description: 'Administrative operations and system changes',
                    enabled: process.env.AUDIT_ADMIN_ACTIONS !== 'false',
                    retention: parseInt(process.env.AUDIT_ADMIN_ACTIONS_RETENTION) || 7 * 365 * 24 * 60 * 60 * 1000, // 7 years
                    severity: 'ERROR',
                    requiresEncryption: true
                },
                SYSTEM_EVENTS: {
                    name: 'System Events',
                    description: 'System startup, shutdown, configuration changes',
                    enabled: process.env.AUDIT_SYSTEM_EVENTS !== 'false',
                    retention: parseInt(process.env.AUDIT_SYSTEM_EVENTS_RETENTION) || 3 * 365 * 24 * 60 * 60 * 1000, // 3 years
                    severity: 'INFO',
                    requiresEncryption: false
                },
                PRIVACY_COMPLIANCE: {
                    name: 'Privacy Compliance',
                    description: 'GDPR requests, consent management, data retention actions',
                    enabled: process.env.AUDIT_PRIVACY_COMPLIANCE !== 'false',
                    retention: parseInt(process.env.AUDIT_PRIVACY_COMPLIANCE_RETENTION) || 7 * 365 * 24 * 60 * 60 * 1000, // 7 years
                    severity: 'ERROR',
                    requiresEncryption: true
                },
                SECURITY_EVENTS: {
                    name: 'Security Events',
                    description: 'Security incidents, failed authentication, suspicious activities',
                    enabled: process.env.AUDIT_SECURITY_EVENTS !== 'false',
                    retention: parseInt(process.env.AUDIT_SECURITY_EVENTS_RETENTION) || 5 * 365 * 24 * 60 * 60 * 1000, // 5 years
                    severity: 'ERROR',
                    requiresEncryption: true
                },
                FILE_OPERATIONS: {
                    name: 'File Operations',
                    description: 'File uploads, downloads, deletions, and processing',
                    enabled: process.env.AUDIT_FILE_OPERATIONS !== 'false',
                    retention: parseInt(process.env.AUDIT_FILE_OPERATIONS_RETENTION) || 2 * 365 * 24 * 60 * 60 * 1000, // 2 years
                    severity: 'INFO',
                    requiresEncryption: true
                }
            },
            
            // Audit storage settings
            auditStoragePath: process.env.AUDIT_STORAGE_PATH || path.join(__dirname, '..', 'audit_logs'),
            enableAuditRotation: process.env.ENABLE_AUDIT_ROTATION !== 'false',
            enableAuditCompression: process.env.ENABLE_AUDIT_COMPRESSION !== 'false',
            enableAuditBackup: process.env.ENABLE_AUDIT_BACKUP !== 'false',
            
            // Real-time monitoring
            enableRealTimeAlerts: process.env.ENABLE_REAL_TIME_ALERTS !== 'false',
            alertThresholds: {
                failedAuthAttempts: parseInt(process.env.ALERT_FAILED_AUTH_ATTEMPTS) || 5,
                dataAccessVolume: parseInt(process.env.ALERT_DATA_ACCESS_VOLUME) || 100,
                adminActionVolume: parseInt(process.env.ALERT_ADMIN_ACTION_VOLUME) || 20,
                securityEventVolume: parseInt(process.env.ALERT_SECURITY_EVENT_VOLUME) || 3
            },
            
            // Performance settings
            auditBufferSize: parseInt(process.env.AUDIT_BUFFER_SIZE) || 100,
            auditFlushInterval: parseInt(process.env.AUDIT_FLUSH_INTERVAL) || 5000, // 5 seconds
            enableAsyncAudit: process.env.ENABLE_ASYNC_AUDIT !== 'false',
            auditQueueMaxSize: parseInt(process.env.AUDIT_QUEUE_MAX_SIZE) || 10000
        };
        
        // Audit event types
        this.auditEventTypes = {
            // Data access events
            DATA_READ: { category: 'DATA_ACCESS', action: 'READ', description: 'Data read operation' },
            DATA_QUERY: { category: 'DATA_ACCESS', action: 'QUERY', description: 'Data query operation' },
            DATA_EXPORT: { category: 'DATA_ACCESS', action: 'EXPORT', description: 'Data export operation' },
            DATA_DOWNLOAD: { category: 'DATA_ACCESS', action: 'DOWNLOAD', description: 'Data download operation' },
            
            // Data modification events
            DATA_CREATE: { category: 'DATA_MODIFICATION', action: 'CREATE', description: 'Data creation operation' },
            DATA_UPDATE: { category: 'DATA_MODIFICATION', action: 'UPDATE', description: 'Data update operation' },
            DATA_DELETE: { category: 'DATA_MODIFICATION', action: 'DELETE', description: 'Data deletion operation' },
            DATA_IMPORT: { category: 'DATA_MODIFICATION', action: 'IMPORT', description: 'Data import operation' },
            
            // Authentication events
            AUTH_LOGIN: { category: 'AUTHENTICATION', action: 'LOGIN', description: 'User login attempt' },
            AUTH_LOGOUT: { category: 'AUTHENTICATION', action: 'LOGOUT', description: 'User logout' },
            AUTH_TOKEN_REFRESH: { category: 'AUTHENTICATION', action: 'TOKEN_REFRESH', description: 'Token refresh operation' },
            AUTH_SESSION_CREATE: { category: 'AUTHENTICATION', action: 'SESSION_CREATE', description: 'Session creation' },
            AUTH_SESSION_EXPIRE: { category: 'AUTHENTICATION', action: 'SESSION_EXPIRE', description: 'Session expiration' },
            AUTH_FAILED: { category: 'AUTHENTICATION', action: 'FAILED', description: 'Authentication failure' },
            
            // Administrative events
            ADMIN_USER_CREATE: { category: 'ADMIN_ACTIONS', action: 'USER_CREATE', description: 'User account creation' },
            ADMIN_USER_DELETE: { category: 'ADMIN_ACTIONS', action: 'USER_DELETE', description: 'User account deletion' },
            ADMIN_USER_MODIFY: { category: 'ADMIN_ACTIONS', action: 'USER_MODIFY', description: 'User account modification' },
            ADMIN_PERMISSION_CHANGE: { category: 'ADMIN_ACTIONS', action: 'PERMISSION_CHANGE', description: 'Permission modification' },
            ADMIN_CONFIG_CHANGE: { category: 'ADMIN_ACTIONS', action: 'CONFIG_CHANGE', description: 'Configuration change' },
            ADMIN_SYSTEM_MAINTENANCE: { category: 'ADMIN_ACTIONS', action: 'SYSTEM_MAINTENANCE', description: 'System maintenance operation' },
            
            // System events
            SYSTEM_STARTUP: { category: 'SYSTEM_EVENTS', action: 'STARTUP', description: 'System startup' },
            SYSTEM_SHUTDOWN: { category: 'SYSTEM_EVENTS', action: 'SHUTDOWN', description: 'System shutdown' },
            SYSTEM_ERROR: { category: 'SYSTEM_EVENTS', action: 'ERROR', description: 'System error' },
            SYSTEM_CONFIG_RELOAD: { category: 'SYSTEM_EVENTS', action: 'CONFIG_RELOAD', description: 'Configuration reload' },
            
            // Privacy compliance events
            GDPR_DATA_EXPORT: { category: 'PRIVACY_COMPLIANCE', action: 'DATA_EXPORT', description: 'GDPR data export request' },
            GDPR_DATA_DELETE: { category: 'PRIVACY_COMPLIANCE', action: 'DATA_DELETE', description: 'GDPR data deletion request' },
            GDPR_CONSENT_RECORD: { category: 'PRIVACY_COMPLIANCE', action: 'CONSENT_RECORD', description: 'Consent recording' },
            GDPR_CONSENT_WITHDRAW: { category: 'PRIVACY_COMPLIANCE', action: 'CONSENT_WITHDRAW', description: 'Consent withdrawal' },
            RETENTION_POLICY_APPLIED: { category: 'PRIVACY_COMPLIANCE', action: 'RETENTION_APPLIED', description: 'Data retention policy applied' },
            LEGAL_HOLD_APPLIED: { category: 'PRIVACY_COMPLIANCE', action: 'LEGAL_HOLD_APPLIED', description: 'Legal hold applied' },
            LEGAL_HOLD_REMOVED: { category: 'PRIVACY_COMPLIANCE', action: 'LEGAL_HOLD_REMOVED', description: 'Legal hold removed' },
            
            // Security events
            SECURITY_BREACH_DETECTED: { category: 'SECURITY_EVENTS', action: 'BREACH_DETECTED', description: 'Security breach detected' },
            SECURITY_SUSPICIOUS_ACTIVITY: { category: 'SECURITY_EVENTS', action: 'SUSPICIOUS_ACTIVITY', description: 'Suspicious activity detected' },
            SECURITY_RATE_LIMIT_EXCEEDED: { category: 'SECURITY_EVENTS', action: 'RATE_LIMIT_EXCEEDED', description: 'Rate limit exceeded' },
            SECURITY_UNAUTHORIZED_ACCESS: { category: 'SECURITY_EVENTS', action: 'UNAUTHORIZED_ACCESS', description: 'Unauthorized access attempt' },
            SECURITY_CSRF_DETECTED: { category: 'SECURITY_EVENTS', action: 'CSRF_DETECTED', description: 'CSRF attack detected' },
            
            // File operation events
            FILE_UPLOAD: { category: 'FILE_OPERATIONS', action: 'UPLOAD', description: 'File upload operation' },
            FILE_DOWNLOAD: { category: 'FILE_OPERATIONS', action: 'DOWNLOAD', description: 'File download operation' },
            FILE_DELETE: { category: 'FILE_OPERATIONS', action: 'DELETE', description: 'File deletion operation' },
            FILE_PROCESS: { category: 'FILE_OPERATIONS', action: 'PROCESS', description: 'File processing operation' },
            FILE_SHARE: { category: 'FILE_OPERATIONS', action: 'SHARE', description: 'File sharing operation' }
        };
        
        // Audit log storage
        this.auditLogBuffer = [];
        this.auditLogQueue = [];
        this.auditLogStats = {
            totalEvents: 0,
            eventsToday: 0,
            eventsByCategory: {},
            eventsBySeverity: { INFO: 0, WARN: 0, ERROR: 0 },
            lastEventTime: null,
            bufferSize: 0,
            queueSize: 0,
            flushCount: 0,
            errorCount: 0,
            alertsTriggered: 0
        };
        
        // Initialize event counters
        Object.keys(this.config.auditCategories).forEach(category => {
            this.auditLogStats.eventsByCategory[category] = 0;
        });
        
        // Audit log encryption key
        this.encryptionKey = null;
        
        // Flush timer
        this.flushTimer = null;
        
        console.log('📋 Audit Logging Service initialized');
        console.log(`   Audit Logging: ${this.config.enableAuditLogging ? '✅' : '❌'}`);
        console.log(`   Real-time Audit: ${this.config.enableRealTimeAudit ? '✅' : '❌'}`);
        console.log(`   Audit Encryption: ${this.config.enableAuditEncryption ? '✅' : '❌'}`);
        console.log(`   Audit Categories: ${Object.keys(this.config.auditCategories).length}`);
        console.log(`   Event Types: ${Object.keys(this.auditEventTypes).length}`);
        console.log(`   Storage Path: ${this.config.auditStoragePath}`);
    }
    
    /**
     * Initialize the audit logging service
     */
    async initialize() {
        try {
            // Create audit storage directory
            await this.createAuditStorageDirectory();
            
            // Initialize encryption if enabled
            if (this.config.enableAuditEncryption) {
                await this.initializeEncryption();
            }
            
            // Start periodic flush if enabled
            if (this.config.enableAsyncAudit) {
                this.startPeriodicFlush();
            }
            
            // Log system startup
            await this.logAuditEvent('SYSTEM_STARTUP', {
                systemInfo: {
                    nodeVersion: process.version,
                    platform: process.platform,
                    environment: process.env.NODE_ENV || 'development',
                    auditConfig: {
                        enableAuditLogging: this.config.enableAuditLogging,
                        enableRealTimeAudit: this.config.enableRealTimeAudit,
                        enableAuditEncryption: this.config.enableAuditEncryption,
                        auditCategories: Object.keys(this.config.auditCategories).length,
                        eventTypes: Object.keys(this.auditEventTypes).length
                    }
                }
            });
            
            console.log('✅ Audit Logging Service initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize Audit Logging Service:', error.message);
            throw error;
        }
    }
    
    /**
     * Create audit storage directory
     */
    async createAuditStorageDirectory() {
        try {
            await fs.mkdir(this.config.auditStoragePath, { recursive: true });
            console.log(`📁 Audit storage directory created: ${this.config.auditStoragePath}`);
        } catch (error) {
            if (error.code !== 'EEXIST') {
                console.error('❌ Failed to create audit storage directory:', error.message);
                throw error;
            }
        }
    }
    
    /**
     * Initialize audit log encryption
     */
    async initializeEncryption() {
        try {
            // Generate or load encryption key
            this.encryptionKey = process.env.AUDIT_ENCRYPTION_KEY || crypto.randomBytes(32);
            
            if (typeof this.encryptionKey === 'string') {
                this.encryptionKey = Buffer.from(this.encryptionKey, 'hex');
            }
            
            console.log('🔐 Audit log encryption initialized');
        } catch (error) {
            console.error('❌ Failed to initialize audit encryption:', error.message);
            throw error;
        }
    }
    
    /**
     * Start periodic audit log flush
     */
    startPeriodicFlush() {
        this.flushTimer = setInterval(async () => {
            await this.flushAuditBuffer();
        }, this.config.auditFlushInterval);
        
        console.log(`⏰ Periodic audit flush started (${this.config.auditFlushInterval}ms interval)`);
    }
    
    /**
     * Log audit event
     */
    async logAuditEvent(eventType, eventData = {}, options = {}) {
        try {
            if (!this.config.enableAuditLogging) {
                return;
            }
            
            const eventTypeConfig = this.auditEventTypes[eventType];
            if (!eventTypeConfig) {
                console.warn(`⚠️ Unknown audit event type: ${eventType}`);
                return;
            }
            
            const categoryConfig = this.config.auditCategories[eventTypeConfig.category];
            if (!categoryConfig || !categoryConfig.enabled) {
                return;
            }
            
            // Create audit entry
            const auditEntry = {
                // Basic audit information
                eventId: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
                eventType: eventType,
                category: eventTypeConfig.category,
                action: eventTypeConfig.action,
                description: eventTypeConfig.description,
                severity: categoryConfig.severity,
                
                // User and session information
                userId: options.userId || eventData.userId || null,
                sessionId: options.sessionId || eventData.sessionId || null,
                userAgent: options.userAgent || eventData.userAgent || null,
                ipAddress: options.ipAddress || eventData.ipAddress || null,
                
                // Request information
                requestId: options.requestId || eventData.requestId || null,
                endpoint: options.endpoint || eventData.endpoint || null,
                httpMethod: options.httpMethod || eventData.httpMethod || null,
                statusCode: options.statusCode || eventData.statusCode || null,
                
                // Event-specific data
                eventData: this.sanitizeEventData(eventData),
                
                // System information
                systemInfo: {
                    hostname: require('os').hostname(),
                    pid: process.pid,
                    memory: process.memoryUsage(),
                    uptime: process.uptime()
                },
                
                // Audit metadata
                auditMetadata: {
                    version: '2.0',
                    source: 'TaktMate-AuditLoggingService',
                    encrypted: categoryConfig.requiresEncryption && this.config.enableAuditEncryption,
                    retention: categoryConfig.retention,
                    hash: null // Will be calculated later
                }
            };
            
            // Calculate audit entry hash for integrity
            auditEntry.auditMetadata.hash = this.calculateAuditHash(auditEntry);
            
            // Add to buffer or queue
            if (this.config.enableAsyncAudit) {
                this.auditLogBuffer.push(auditEntry);
                this.auditLogStats.bufferSize = this.auditLogBuffer.length;
                
                // Flush if buffer is full
                if (this.auditLogBuffer.length >= this.config.auditBufferSize) {
                    await this.flushAuditBuffer();
                }
            } else {
                // Synchronous logging
                await this.writeAuditEntry(auditEntry);
            }
            
            // Update statistics
            this.updateAuditStatistics(auditEntry);
            
            // Check for real-time alerts
            if (this.config.enableRealTimeAlerts) {
                await this.checkRealTimeAlerts(auditEntry);
            }
            
            // Track in Application Insights
            if (this.appInsights) {
                this.appInsights.telemetry.trackEvent('Audit_Event_Logged', {
                    eventType: eventType,
                    category: eventTypeConfig.category,
                    action: eventTypeConfig.action,
                    severity: categoryConfig.severity,
                    userId: auditEntry.userId || 'anonymous',
                    encrypted: auditEntry.auditMetadata.encrypted.toString()
                });
            }
            
        } catch (error) {
            console.error('❌ Failed to log audit event:', error.message);
            this.auditLogStats.errorCount++;
            
            // Track error in Application Insights
            if (this.appInsights) {
                this.appInsights.telemetry.trackEvent('Audit_Logging_Error', {
                    error: error.message,
                    eventType: eventType
                });
            }
        }
    }
    
    /**
     * Sanitize event data for logging
     */
    sanitizeEventData(eventData) {
        try {
            const sanitized = JSON.parse(JSON.stringify(eventData));
            
            // Remove sensitive fields
            const sensitiveFields = ['password', 'token', 'secret', 'key', 'credential', 'authorization'];
            
            function recursiveSanitize(obj) {
                if (typeof obj !== 'object' || obj === null) {
                    return obj;
                }
                
                for (const key in obj) {
                    if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
                        obj[key] = '[REDACTED]';
                    } else if (typeof obj[key] === 'object') {
                        recursiveSanitize(obj[key]);
                    }
                }
                
                return obj;
            }
            
            return recursiveSanitize(sanitized);
        } catch (error) {
            console.error('❌ Failed to sanitize event data:', error.message);
            return { error: 'Failed to sanitize event data' };
        }
    }
    
    /**
     * Calculate audit entry hash for integrity verification
     */
    calculateAuditHash(auditEntry) {
        try {
            // Create hash input without the hash field itself
            const hashInput = {
                eventId: auditEntry.eventId,
                timestamp: auditEntry.timestamp,
                eventType: auditEntry.eventType,
                category: auditEntry.category,
                action: auditEntry.action,
                userId: auditEntry.userId,
                sessionId: auditEntry.sessionId,
                eventData: auditEntry.eventData
            };
            
            const hashString = JSON.stringify(hashInput);
            return crypto.createHash('sha256').update(hashString).digest('hex');
        } catch (error) {
            console.error('❌ Failed to calculate audit hash:', error.message);
            return null;
        }
    }
    
    /**
     * Encrypt audit entry if required
     */
    encryptAuditEntry(auditEntry) {
        try {
            if (!this.config.enableAuditEncryption || !this.encryptionKey || !auditEntry.auditMetadata.encrypted) {
                return auditEntry;
            }
            
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
            
            // Encrypt sensitive fields
            const sensitiveData = {
                eventData: auditEntry.eventData,
                userId: auditEntry.userId,
                sessionId: auditEntry.sessionId,
                ipAddress: auditEntry.ipAddress,
                userAgent: auditEntry.userAgent
            };
            
            let encrypted = cipher.update(JSON.stringify(sensitiveData), 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            // Replace sensitive fields with encrypted data
            auditEntry.encryptedData = encrypted;
            auditEntry.encryptionIv = iv.toString('hex');
            
            // Remove original sensitive data
            delete auditEntry.eventData;
            delete auditEntry.userId;
            delete auditEntry.sessionId;
            delete auditEntry.ipAddress;
            delete auditEntry.userAgent;
            
            return auditEntry;
        } catch (error) {
            console.error('❌ Failed to encrypt audit entry:', error.message);
            return auditEntry;
        }
    }
    
    /**
     * Decrypt audit entry
     */
    decryptAuditEntry(auditEntry) {
        try {
            if (!auditEntry.encryptedData || !auditEntry.encryptionIv || !this.encryptionKey) {
                return auditEntry;
            }
            
            const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
            
            let decrypted = decipher.update(auditEntry.encryptedData, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            const sensitiveData = JSON.parse(decrypted);
            
            // Restore decrypted fields
            Object.assign(auditEntry, sensitiveData);
            
            // Remove encrypted fields
            delete auditEntry.encryptedData;
            delete auditEntry.encryptionIv;
            
            return auditEntry;
        } catch (error) {
            console.error('❌ Failed to decrypt audit entry:', error.message);
            return auditEntry;
        }
    }
    
    /**
     * Write audit entry to storage
     */
    async writeAuditEntry(auditEntry) {
        try {
            // Encrypt if required
            const processedEntry = this.encryptAuditEntry(auditEntry);
            
            // Determine log file path
            const logDate = new Date().toISOString().split('T')[0];
            const logFileName = `audit_${logDate}.jsonl`;
            const logFilePath = path.join(this.config.auditStoragePath, logFileName);
            
            // Write to log file
            const logLine = JSON.stringify(processedEntry) + '\n';
            await fs.appendFile(logFilePath, logLine);
            
            // Check for log rotation
            if (this.config.enableAuditRotation) {
                await this.checkLogRotation(logFilePath);
            }
            
        } catch (error) {
            console.error('❌ Failed to write audit entry:', error.message);
            throw error;
        }
    }
    
    /**
     * Flush audit buffer to storage
     */
    async flushAuditBuffer() {
        try {
            if (this.auditLogBuffer.length === 0) {
                return;
            }
            
            const entriesToFlush = [...this.auditLogBuffer];
            this.auditLogBuffer = [];
            this.auditLogStats.bufferSize = 0;
            
            // Write all entries
            for (const entry of entriesToFlush) {
                await this.writeAuditEntry(entry);
            }
            
            this.auditLogStats.flushCount++;
            
            console.log(`📋 Flushed ${entriesToFlush.length} audit entries to storage`);
            
        } catch (error) {
            console.error('❌ Failed to flush audit buffer:', error.message);
            
            // Return entries to buffer on failure
            this.auditLogBuffer.unshift(...entriesToFlush);
            this.auditLogStats.bufferSize = this.auditLogBuffer.length;
            
            throw error;
        }
    }
    
    /**
     * Check for log rotation
     */
    async checkLogRotation(logFilePath) {
        try {
            const stats = await fs.stat(logFilePath);
            
            if (stats.size > this.config.auditLogRotationSize) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const rotatedPath = logFilePath.replace('.jsonl', `_${timestamp}.jsonl`);
                
                await fs.rename(logFilePath, rotatedPath);
                
                // Compress if enabled
                if (this.config.enableAuditCompression) {
                    await this.compressLogFile(rotatedPath);
                }
                
                console.log(`🔄 Rotated audit log: ${rotatedPath}`);
            }
        } catch (error) {
            // Log rotation is not critical, continue
            console.warn('⚠️ Failed to check log rotation:', error.message);
        }
    }
    
    /**
     * Compress log file
     */
    async compressLogFile(logFilePath) {
        try {
            const zlib = require('zlib');
            const { pipeline } = require('stream/promises');
            
            const readStream = require('fs').createReadStream(logFilePath);
            const writeStream = require('fs').createWriteStream(logFilePath + '.gz');
            const gzipStream = zlib.createGzip();
            
            await pipeline(readStream, gzipStream, writeStream);
            
            // Remove original file
            await fs.unlink(logFilePath);
            
            console.log(`🗜️ Compressed audit log: ${logFilePath}.gz`);
        } catch (error) {
            console.error('❌ Failed to compress log file:', error.message);
        }
    }
    
    /**
     * Update audit statistics
     */
    updateAuditStatistics(auditEntry) {
        try {
            this.auditLogStats.totalEvents++;
            this.auditLogStats.lastEventTime = auditEntry.timestamp;
            
            // Update daily counter
            const today = new Date().toDateString();
            const eventDate = new Date(auditEntry.timestamp).toDateString();
            
            if (today === eventDate) {
                this.auditLogStats.eventsToday++;
            }
            
            // Update category counter
            if (this.auditLogStats.eventsByCategory[auditEntry.category] !== undefined) {
                this.auditLogStats.eventsByCategory[auditEntry.category]++;
            }
            
            // Update severity counter
            if (this.auditLogStats.eventsBySeverity[auditEntry.severity] !== undefined) {
                this.auditLogStats.eventsBySeverity[auditEntry.severity]++;
            }
            
        } catch (error) {
            console.error('❌ Failed to update audit statistics:', error.message);
        }
    }
    
    /**
     * Check for real-time alerts
     */
    async checkRealTimeAlerts(auditEntry) {
        try {
            const now = Date.now();
            const oneHourAgo = now - (60 * 60 * 1000);
            
            // Check failed authentication attempts
            if (auditEntry.eventType === 'AUTH_FAILED') {
                const recentFailedAttempts = await this.countRecentEvents('AUTH_FAILED', oneHourAgo);
                
                if (recentFailedAttempts >= this.config.alertThresholds.failedAuthAttempts) {
                    await this.triggerAlert('FAILED_AUTH_THRESHOLD_EXCEEDED', {
                        count: recentFailedAttempts,
                        threshold: this.config.alertThresholds.failedAuthAttempts,
                        timeWindow: '1 hour',
                        userId: auditEntry.userId,
                        ipAddress: auditEntry.ipAddress
                    });
                }
            }
            
            // Check data access volume
            if (auditEntry.category === 'DATA_ACCESS') {
                const recentDataAccess = await this.countRecentEvents('DATA_ACCESS', oneHourAgo);
                
                if (recentDataAccess >= this.config.alertThresholds.dataAccessVolume) {
                    await this.triggerAlert('DATA_ACCESS_VOLUME_EXCEEDED', {
                        count: recentDataAccess,
                        threshold: this.config.alertThresholds.dataAccessVolume,
                        timeWindow: '1 hour',
                        userId: auditEntry.userId
                    });
                }
            }
            
            // Check admin action volume
            if (auditEntry.category === 'ADMIN_ACTIONS') {
                const recentAdminActions = await this.countRecentEvents('ADMIN_ACTIONS', oneHourAgo);
                
                if (recentAdminActions >= this.config.alertThresholds.adminActionVolume) {
                    await this.triggerAlert('ADMIN_ACTION_VOLUME_EXCEEDED', {
                        count: recentAdminActions,
                        threshold: this.config.alertThresholds.adminActionVolume,
                        timeWindow: '1 hour',
                        userId: auditEntry.userId
                    });
                }
            }
            
            // Check security event volume
            if (auditEntry.category === 'SECURITY_EVENTS') {
                const recentSecurityEvents = await this.countRecentEvents('SECURITY_EVENTS', oneHourAgo);
                
                if (recentSecurityEvents >= this.config.alertThresholds.securityEventVolume) {
                    await this.triggerAlert('SECURITY_EVENT_VOLUME_EXCEEDED', {
                        count: recentSecurityEvents,
                        threshold: this.config.alertThresholds.securityEventVolume,
                        timeWindow: '1 hour',
                        eventType: auditEntry.eventType
                    });
                }
            }
            
        } catch (error) {
            console.error('❌ Failed to check real-time alerts:', error.message);
        }
    }
    
    /**
     * Count recent events
     */
    async countRecentEvents(eventTypeOrCategory, sinceTimestamp) {
        try {
            // This is a simplified implementation
            // In production, this would query the audit log storage
            let count = 0;
            
            // Check buffer
            for (const entry of this.auditLogBuffer) {
                const entryTime = new Date(entry.timestamp).getTime();
                if (entryTime >= sinceTimestamp) {
                    if (entry.eventType === eventTypeOrCategory || entry.category === eventTypeOrCategory) {
                        count++;
                    }
                }
            }
            
            return count;
        } catch (error) {
            console.error('❌ Failed to count recent events:', error.message);
            return 0;
        }
    }
    
    /**
     * Trigger real-time alert
     */
    async triggerAlert(alertType, alertData) {
        try {
            const alert = {
                alertId: crypto.randomUUID(),
                alertType: alertType,
                timestamp: new Date().toISOString(),
                severity: 'HIGH',
                alertData: alertData,
                acknowledged: false
            };
            
            // Log alert as audit event
            await this.logAuditEvent('SECURITY_BREACH_DETECTED', {
                alert: alert,
                alertType: alertType,
                alertData: alertData
            });
            
            // Track alert in statistics
            this.auditLogStats.alertsTriggered++;
            
            // Send to Application Insights
            if (this.appInsights) {
                this.appInsights.telemetry.trackEvent('Audit_Alert_Triggered', {
                    alertType: alertType,
                    severity: alert.severity,
                    alertData: JSON.stringify(alertData)
                });
            }
            
            console.log(`🚨 Audit alert triggered: ${alertType}`, alertData);
            
        } catch (error) {
            console.error('❌ Failed to trigger alert:', error.message);
        }
    }
    
    /**
     * Query audit logs
     */
    async queryAuditLogs(query = {}) {
        try {
            const {
                startDate,
                endDate,
                eventType,
                category,
                userId,
                severity,
                limit = 100,
                offset = 0
            } = query;
            
            // This is a simplified implementation
            // In production, this would query the actual audit log storage
            
            let results = [];
            
            // Search in buffer first
            for (const entry of this.auditLogBuffer) {
                if (this.matchesQuery(entry, query)) {
                    results.push(entry);
                }
            }
            
            // Sort by timestamp (newest first)
            results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            // Apply pagination
            const paginatedResults = results.slice(offset, offset + limit);
            
            return {
                success: true,
                results: paginatedResults,
                totalCount: results.length,
                query: query,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('❌ Failed to query audit logs:', error.message);
            return {
                success: false,
                error: error.message,
                results: [],
                totalCount: 0
            };
        }
    }
    
    /**
     * Check if audit entry matches query
     */
    matchesQuery(entry, query) {
        try {
            const {
                startDate,
                endDate,
                eventType,
                category,
                userId,
                severity
            } = query;
            
            // Check date range
            if (startDate && new Date(entry.timestamp) < new Date(startDate)) {
                return false;
            }
            
            if (endDate && new Date(entry.timestamp) > new Date(endDate)) {
                return false;
            }
            
            // Check event type
            if (eventType && entry.eventType !== eventType) {
                return false;
            }
            
            // Check category
            if (category && entry.category !== category) {
                return false;
            }
            
            // Check user ID
            if (userId && entry.userId !== userId) {
                return false;
            }
            
            // Check severity
            if (severity && entry.severity !== severity) {
                return false;
            }
            
            return true;
        } catch (error) {
            console.error('❌ Failed to match query:', error.message);
            return false;
        }
    }
    
    /**
     * Get audit statistics
     */
    getAuditStatistics() {
        return {
            ...this.auditLogStats,
            
            configuration: {
                enableAuditLogging: this.config.enableAuditLogging,
                enableRealTimeAudit: this.config.enableRealTimeAudit,
                enableAuditEncryption: this.config.enableAuditEncryption,
                auditCategories: Object.keys(this.config.auditCategories).length,
                eventTypes: Object.keys(this.auditEventTypes).length,
                auditLogRetention: Math.round(this.config.auditLogRetention / (24 * 60 * 60 * 1000)) + ' days',
                auditLogMaxSize: Math.round(this.config.auditLogMaxSize / 1024 / 1024) + ' MB',
                auditBufferSize: this.config.auditBufferSize,
                auditFlushInterval: this.config.auditFlushInterval / 1000 + ' seconds'
            },
            
            categories: Object.keys(this.config.auditCategories).reduce((acc, key) => {
                const category = this.config.auditCategories[key];
                acc[key] = {
                    name: category.name,
                    enabled: category.enabled,
                    retention: Math.round(category.retention / (24 * 60 * 60 * 1000)) + ' days',
                    severity: category.severity,
                    eventCount: this.auditLogStats.eventsByCategory[key] || 0
                };
                return acc;
            }, {}),
            
            alertThresholds: this.config.alertThresholds,
            
            performance: {
                bufferUtilization: this.config.auditBufferSize > 0 ? 
                    ((this.auditLogStats.bufferSize / this.config.auditBufferSize) * 100).toFixed(1) + '%' : '0%',
                flushCount: this.auditLogStats.flushCount,
                errorRate: this.auditLogStats.totalEvents > 0 ? 
                    ((this.auditLogStats.errorCount / this.auditLogStats.totalEvents) * 100).toFixed(2) + '%' : '0%'
            }
        };
    }
    
    /**
     * Create audit middleware for Express
     */
    createAuditMiddleware() {
        return async (req, res, next) => {
            try {
                // Capture request start time
                const startTime = Date.now();
                
                // Generate request ID
                req.auditRequestId = crypto.randomUUID();
                
                // Extract user information
                const userId = req.user?.id || req.user?.userId || null;
                const sessionId = req.sessionId || req.session?.id || null;
                
                // Log request start
                await this.logAuditEvent('DATA_ACCESS', {
                    requestId: req.auditRequestId,
                    endpoint: req.originalUrl || req.url,
                    httpMethod: req.method,
                    userAgent: req.get('User-Agent'),
                    ipAddress: req.ip || req.connection.remoteAddress,
                    requestHeaders: this.sanitizeHeaders(req.headers),
                    requestBody: req.method !== 'GET' ? this.sanitizeEventData(req.body) : undefined
                }, {
                    userId: userId,
                    sessionId: sessionId,
                    requestId: req.auditRequestId,
                    endpoint: req.originalUrl || req.url,
                    httpMethod: req.method,
                    userAgent: req.get('User-Agent'),
                    ipAddress: req.ip || req.connection.remoteAddress
                });
                
                // Override res.json to capture response
                const originalJson = res.json;
                res.json = function(data) {
                    // Log response
                    const responseTime = Date.now() - startTime;
                    
                    // Don't await this to avoid blocking response
                    this.logAuditEvent('DATA_ACCESS', {
                        requestId: req.auditRequestId,
                        endpoint: req.originalUrl || req.url,
                        httpMethod: req.method,
                        statusCode: res.statusCode,
                        responseTime: responseTime,
                        responseSize: JSON.stringify(data).length
                    }, {
                        userId: userId,
                        sessionId: sessionId,
                        requestId: req.auditRequestId,
                        endpoint: req.originalUrl || req.url,
                        httpMethod: req.method,
                        statusCode: res.statusCode
                    }).catch(error => {
                        console.error('❌ Failed to log response audit event:', error.message);
                    });
                    
                    return originalJson.call(this, data);
                }.bind(this);
                
                next();
            } catch (error) {
                console.error('❌ Audit middleware error:', error.message);
                next(); // Continue processing even if audit fails
            }
        };
    }
    
    /**
     * Sanitize HTTP headers for logging
     */
    sanitizeHeaders(headers) {
        const sanitized = { ...headers };
        const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
        
        sensitiveHeaders.forEach(header => {
            if (sanitized[header]) {
                sanitized[header] = '[REDACTED]';
            }
        });
        
        return sanitized;
    }
    
    /**
     * Stop audit logging service
     */
    async stop() {
        try {
            // Stop flush timer
            if (this.flushTimer) {
                clearInterval(this.flushTimer);
                this.flushTimer = null;
            }
            
            // Flush remaining buffer
            await this.flushAuditBuffer();
            
            // Log system shutdown
            await this.logAuditEvent('SYSTEM_SHUTDOWN', {
                shutdownTime: new Date().toISOString(),
                auditStats: this.auditLogStats
            });
            
            console.log('🛑 Audit Logging Service stopped');
        } catch (error) {
            console.error('❌ Failed to stop Audit Logging Service:', error.message);
        }
    }
}

module.exports = {
    AuditLoggingService
};
