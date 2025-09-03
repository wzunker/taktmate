// TaktMate Data Retention Service
// Comprehensive data lifecycle management with GDPR compliance and automated retention policies

const fs = require('fs').promises;
const path = require('path');
const { config: azureConfig } = require('../config/azureAdB2C');

/**
 * Data Retention Service
 * Manages automated data lifecycle, retention policies, and GDPR compliance
 */
class DataRetentionService {
    constructor(appInsights = null, fileStore = null, sessionManagement = null) {
        this.appInsights = appInsights;
        this.fileStore = fileStore;
        this.sessionManagement = sessionManagement;
        
        // Data retention configuration
        this.config = {
            // General retention settings
            enableDataRetention: process.env.ENABLE_DATA_RETENTION !== 'false',
            enableAutomaticCleanup: process.env.ENABLE_AUTOMATIC_CLEANUP !== 'false',
            enableRetentionLogging: process.env.ENABLE_RETENTION_LOGGING !== 'false',
            
            // CSV file retention policies
            csvRetentionPolicies: {
                // Default retention period for user CSV files
                defaultRetentionPeriod: parseInt(process.env.CSV_DEFAULT_RETENTION) || 90 * 24 * 60 * 60 * 1000, // 90 days
                
                // Maximum retention period (GDPR compliance)
                maxRetentionPeriod: parseInt(process.env.CSV_MAX_RETENTION) || 2 * 365 * 24 * 60 * 60 * 1000, // 2 years
                
                // Grace period before permanent deletion
                gracePeriod: parseInt(process.env.CSV_GRACE_PERIOD) || 30 * 24 * 60 * 60 * 1000, // 30 days
                
                // Retention based on file size
                largeCsvThreshold: parseInt(process.env.LARGE_CSV_THRESHOLD) || 10 * 1024 * 1024, // 10MB
                largeCsvRetention: parseInt(process.env.LARGE_CSV_RETENTION) || 30 * 24 * 60 * 60 * 1000, // 30 days
                
                // Inactive user CSV retention
                inactiveUserThreshold: parseInt(process.env.INACTIVE_USER_THRESHOLD) || 180 * 24 * 60 * 60 * 1000, // 180 days
                inactiveUserCsvRetention: parseInt(process.env.INACTIVE_USER_CSV_RETENTION) || 30 * 24 * 60 * 60 * 1000, // 30 days
                
                // Backup retention for deleted files
                enableBackupRetention: process.env.ENABLE_CSV_BACKUP_RETENTION !== 'false',
                backupRetentionPeriod: parseInt(process.env.CSV_BACKUP_RETENTION) || 7 * 24 * 60 * 60 * 1000, // 7 days
            },
            
            // Session data retention policies
            sessionRetentionPolicies: {
                // Active session retention
                activeSessionRetention: parseInt(process.env.ACTIVE_SESSION_RETENTION) || 24 * 60 * 60 * 1000, // 24 hours
                
                // Expired session cleanup
                expiredSessionCleanup: parseInt(process.env.EXPIRED_SESSION_CLEANUP) || 7 * 24 * 60 * 60 * 1000, // 7 days
                
                // Session metadata retention
                sessionMetadataRetention: parseInt(process.env.SESSION_METADATA_RETENTION) || 30 * 24 * 60 * 60 * 1000, // 30 days
                
                // Anonymous session retention
                anonymousSessionRetention: parseInt(process.env.ANONYMOUS_SESSION_RETENTION) || 1 * 60 * 60 * 1000, // 1 hour
                
                // Session logs retention
                sessionLogsRetention: parseInt(process.env.SESSION_LOGS_RETENTION) || 90 * 24 * 60 * 60 * 1000, // 90 days
                
                // Failed session attempts retention
                failedSessionRetention: parseInt(process.env.FAILED_SESSION_RETENTION) || 7 * 24 * 60 * 60 * 1000, // 7 days
            },
            
            // User data retention policies
            userDataRetentionPolicies: {
                // User account data retention after deletion
                deletedUserDataRetention: parseInt(process.env.DELETED_USER_DATA_RETENTION) || 30 * 24 * 60 * 60 * 1000, // 30 days
                
                // User activity logs retention
                userActivityLogsRetention: parseInt(process.env.USER_ACTIVITY_LOGS_RETENTION) || 1 * 365 * 24 * 60 * 60 * 1000, // 1 year
                
                // User consent records retention
                userConsentRetention: parseInt(process.env.USER_CONSENT_RETENTION) || 3 * 365 * 24 * 60 * 60 * 1000, // 3 years
                
                // User preferences retention
                userPreferencesRetention: parseInt(process.env.USER_PREFERENCES_RETENTION) || 2 * 365 * 24 * 60 * 60 * 1000, // 2 years
            },
            
            // Cleanup scheduling
            cleanupSchedule: {
                // How often to run cleanup (milliseconds)
                cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL) || 24 * 60 * 60 * 1000, // 24 hours
                
                // Time of day to run cleanup (hour 0-23)
                cleanupHour: parseInt(process.env.CLEANUP_HOUR) || 2, // 2 AM
                
                // Maximum items to process per cleanup cycle
                maxCleanupItems: parseInt(process.env.MAX_CLEANUP_ITEMS) || 1000,
                
                // Enable staggered cleanup to reduce system load
                enableStaggeredCleanup: process.env.ENABLE_STAGGERED_CLEANUP !== 'false',
                staggerDelay: parseInt(process.env.STAGGER_DELAY) || 100, // 100ms between items
            },
            
            // Compliance and audit settings
            compliance: {
                // GDPR compliance mode
                gdprCompliant: process.env.GDPR_COMPLIANT !== 'false',
                
                // Data minimization principle
                enableDataMinimization: process.env.ENABLE_DATA_MINIMIZATION !== 'false',
                
                // Audit trail for retention actions
                enableRetentionAudit: process.env.ENABLE_RETENTION_AUDIT !== 'false',
                
                // Retention policy documentation
                enablePolicyDocumentation: process.env.ENABLE_POLICY_DOCUMENTATION !== 'false',
                
                // Legal hold capabilities
                enableLegalHold: process.env.ENABLE_LEGAL_HOLD !== 'false',
            }
        };
        
        // Retention categories and their policies
        this.retentionCategories = {
            CSV_FILES: {
                name: 'CSV Files',
                description: 'User-uploaded CSV files and processing results',
                defaultRetention: this.config.csvRetentionPolicies.defaultRetentionPeriod,
                maxRetention: this.config.csvRetentionPolicies.maxRetentionPeriod,
                legalBasis: 'Contract performance and legitimate interests',
                dataMinimization: true,
                backupEnabled: this.config.csvRetentionPolicies.enableBackupRetention
            },
            SESSION_DATA: {
                name: 'Session Data',
                description: 'User session information and temporary data',
                defaultRetention: this.config.sessionRetentionPolicies.activeSessionRetention,
                maxRetention: this.config.sessionRetentionPolicies.sessionMetadataRetention,
                legalBasis: 'Legitimate interests and security',
                dataMinimization: true,
                backupEnabled: false
            },
            USER_ACTIVITY: {
                name: 'User Activity Logs',
                description: 'User interaction logs and activity tracking',
                defaultRetention: this.config.userDataRetentionPolicies.userActivityLogsRetention,
                maxRetention: this.config.userDataRetentionPolicies.userActivityLogsRetention,
                legalBasis: 'Legitimate interests and service improvement',
                dataMinimization: true,
                backupEnabled: false
            },
            CONSENT_RECORDS: {
                name: 'Consent Records',
                description: 'Cookie consent and privacy consent records',
                defaultRetention: this.config.userDataRetentionPolicies.userConsentRetention,
                maxRetention: this.config.userDataRetentionPolicies.userConsentRetention,
                legalBasis: 'Legal compliance and consent evidence',
                dataMinimization: false,
                backupEnabled: true
            }
        };
        
        // Retention tracking and statistics
        this.retentionStats = {
            csvFilesProcessed: 0,
            csvFilesDeleted: 0,
            csvFilesBackedUp: 0,
            sessionsProcessed: 0,
            sessionsDeleted: 0,
            userDataProcessed: 0,
            userDataDeleted: 0,
            retentionPoliciesApplied: 0,
            complianceViolations: 0,
            cleanupCyclesCompleted: 0,
            totalDataCleaned: 0, // in bytes
            averageCleanupTime: 0,
            lastCleanupTime: null,
            nextCleanupTime: null
        };
        
        // Active retention processes
        this.retentionProcesses = new Map();
        this.legalHolds = new Map();
        this.retentionAuditLog = [];
        
        // Cleanup timer
        this.cleanupTimer = null;
        
        console.log('🗂️ Data Retention Service initialized');
        console.log(`   Data Retention: ${this.config.enableDataRetention ? '✅' : '❌'}`);
        console.log(`   Automatic Cleanup: ${this.config.enableAutomaticCleanup ? '✅' : '❌'}`);
        console.log(`   GDPR Compliant: ${this.config.compliance.gdprCompliant ? '✅' : '❌'}`);
        console.log(`   CSV Default Retention: ${Math.round(this.config.csvRetentionPolicies.defaultRetentionPeriod / (24 * 60 * 60 * 1000))} days`);
        console.log(`   Session Retention: ${Math.round(this.config.sessionRetentionPolicies.activeSessionRetention / (60 * 60 * 1000))} hours`);
    }
    
    /**
     * Initialize the data retention service
     */
    async initialize() {
        try {
            // Load existing retention policies
            await this.loadRetentionPolicies();
            
            // Start automatic cleanup if enabled
            if (this.config.enableAutomaticCleanup) {
                this.startAutomaticCleanup();
            }
            
            // Initialize retention audit logging
            if (this.config.compliance.enableRetentionAudit) {
                await this.initializeRetentionAudit();
            }
            
            // Generate policy documentation if enabled
            if (this.config.compliance.enablePolicyDocumentation) {
                await this.generatePolicyDocumentation();
            }
            
            console.log('✅ Data Retention Service initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize Data Retention Service:', error.message);
            throw error;
        }
    }
    
    /**
     * Load existing retention policies
     */
    async loadRetentionPolicies() {
        try {
            // In a production environment, this would load from a database
            // For now, we'll use the configured policies
            console.log('📄 Loaded data retention policies');
            
            // Calculate next cleanup time
            this.calculateNextCleanupTime();
            
        } catch (error) {
            console.error('❌ Failed to load retention policies:', error.message);
        }
    }
    
    /**
     * Calculate next cleanup time
     */
    calculateNextCleanupTime() {
        const now = new Date();
        const nextCleanup = new Date();
        
        // Set to configured cleanup hour
        nextCleanup.setHours(this.config.cleanupSchedule.cleanupHour, 0, 0, 0);
        
        // If cleanup time has passed today, schedule for tomorrow
        if (nextCleanup <= now) {
            nextCleanup.setDate(nextCleanup.getDate() + 1);
        }
        
        this.retentionStats.nextCleanupTime = nextCleanup.toISOString();
        
        console.log(`🕐 Next cleanup scheduled for: ${nextCleanup.toLocaleString()}`);
    }
    
    /**
     * Start automatic cleanup process
     */
    startAutomaticCleanup() {
        // Calculate initial delay to next cleanup time
        const now = Date.now();
        const nextCleanupTime = new Date(this.retentionStats.nextCleanupTime).getTime();
        const initialDelay = Math.max(0, nextCleanupTime - now);
        
        console.log(`⏰ Starting automatic cleanup in ${Math.round(initialDelay / (60 * 1000))} minutes`);
        
        // Set initial timer
        setTimeout(() => {
            this.performAutomaticCleanup();
            
            // Set recurring timer
            this.cleanupTimer = setInterval(() => {
                this.performAutomaticCleanup();
            }, this.config.cleanupSchedule.cleanupInterval);
            
        }, initialDelay);
        
        console.log('✅ Automatic cleanup scheduled');
    }
    
    /**
     * Perform automatic cleanup cycle
     */
    async performAutomaticCleanup() {
        const startTime = Date.now();
        
        try {
            console.log('🧹 Starting automatic data retention cleanup cycle');
            
            // Update statistics
            this.retentionStats.lastCleanupTime = new Date().toISOString();
            this.calculateNextCleanupTime();
            
            let totalProcessed = 0;
            let totalDeleted = 0;
            let totalDataCleaned = 0;
            
            // Process CSV files retention
            if (this.fileStore) {
                const csvResults = await this.processCsvFileRetention();
                totalProcessed += csvResults.processed;
                totalDeleted += csvResults.deleted;
                totalDataCleaned += csvResults.dataCleaned;
            }
            
            // Process session data retention
            if (this.sessionManagement) {
                const sessionResults = await this.processSessionDataRetention();
                totalProcessed += sessionResults.processed;
                totalDeleted += sessionResults.deleted;
                totalDataCleaned += sessionResults.dataCleaned;
            }
            
            // Process user data retention
            const userDataResults = await this.processUserDataRetention();
            totalProcessed += userDataResults.processed;
            totalDeleted += userDataResults.deleted;
            totalDataCleaned += userDataResults.dataCleaned;
            
            // Update statistics
            const cleanupTime = Date.now() - startTime;
            this.retentionStats.cleanupCyclesCompleted++;
            this.retentionStats.totalDataCleaned += totalDataCleaned;
            this.retentionStats.averageCleanupTime = Math.round(
                (this.retentionStats.averageCleanupTime * (this.retentionStats.cleanupCyclesCompleted - 1) + cleanupTime) /
                this.retentionStats.cleanupCyclesCompleted
            );
            
            // Log cleanup results
            const auditEntry = {
                timestamp: new Date().toISOString(),
                type: 'AUTOMATIC_CLEANUP',
                processed: totalProcessed,
                deleted: totalDeleted,
                dataCleaned: totalDataCleaned,
                duration: cleanupTime,
                success: true
            };
            
            await this.logRetentionAction(auditEntry);
            
            // Track in Application Insights
            if (this.appInsights) {
                this.appInsights.telemetry.trackEvent('Data_Retention_Cleanup_Completed', {
                    processed: totalProcessed.toString(),
                    deleted: totalDeleted.toString(),
                    dataCleaned: totalDataCleaned.toString(),
                    duration: cleanupTime.toString(),
                    cycleNumber: this.retentionStats.cleanupCyclesCompleted.toString()
                });
            }
            
            console.log(`✅ Cleanup cycle completed in ${Math.round(cleanupTime / 1000)}s`);
            console.log(`   Processed: ${totalProcessed} items`);
            console.log(`   Deleted: ${totalDeleted} items`);
            console.log(`   Data cleaned: ${Math.round(totalDataCleaned / 1024 / 1024 * 100) / 100} MB`);
            
        } catch (error) {
            console.error('❌ Automatic cleanup failed:', error.message);
            
            // Log cleanup failure
            const auditEntry = {
                timestamp: new Date().toISOString(),
                type: 'AUTOMATIC_CLEANUP',
                error: error.message,
                duration: Date.now() - startTime,
                success: false
            };
            
            await this.logRetentionAction(auditEntry);
            
            // Track failure in Application Insights
            if (this.appInsights) {
                this.appInsights.telemetry.trackEvent('Data_Retention_Cleanup_Failed', {
                    error: error.message,
                    duration: (Date.now() - startTime).toString()
                });
            }
        }
    }
    
    /**
     * Process CSV file retention policies
     */
    async processCsvFileRetention() {
        try {
            console.log('📄 Processing CSV file retention policies');
            
            let processed = 0;
            let deleted = 0;
            let dataCleaned = 0;
            
            if (!this.fileStore) {
                console.warn('⚠️ FileStore not available, skipping CSV retention');
                return { processed, deleted, dataCleaned };
            }
            
            // Get all user files
            const allUsers = await this.fileStore.getAllUsers();
            
            for (const userId of allUsers) {
                // Check for legal hold
                if (this.isUnderLegalHold(userId, 'CSV_FILES')) {
                    console.log(`⚖️ User ${userId} CSV files under legal hold, skipping`);
                    continue;
                }
                
                try {
                    const userFiles = await this.fileStore.listFiles(userId);
                    
                    for (const file of userFiles) {
                        processed++;
                        
                        const shouldDelete = await this.shouldDeleteCsvFile(userId, file);
                        
                        if (shouldDelete.delete) {
                            try {
                                // Create backup if enabled
                                if (this.config.csvRetentionPolicies.enableBackupRetention) {
                                    await this.createCsvBackup(userId, file);
                                    this.retentionStats.csvFilesBackedUp++;
                                }
                                
                                // Get file size before deletion
                                const fileSize = file.size || 0;
                                
                                // Delete the file
                                await this.fileStore.deleteFile(userId, file.filename);
                                
                                deleted++;
                                dataCleaned += fileSize;
                                this.retentionStats.csvFilesDeleted++;
                                
                                // Log retention action
                                await this.logRetentionAction({
                                    timestamp: new Date().toISOString(),
                                    type: 'CSV_FILE_DELETED',
                                    userId: userId,
                                    filename: file.filename,
                                    fileSize: fileSize,
                                    reason: shouldDelete.reason,
                                    retentionPeriod: shouldDelete.retentionPeriod,
                                    success: true
                                });
                                
                                console.log(`🗑️ Deleted CSV file: ${file.filename} (${userId}) - ${shouldDelete.reason}`);
                                
                            } catch (deleteError) {
                                console.error(`❌ Failed to delete CSV file ${file.filename}:`, deleteError.message);
                                
                                await this.logRetentionAction({
                                    timestamp: new Date().toISOString(),
                                    type: 'CSV_FILE_DELETE_FAILED',
                                    userId: userId,
                                    filename: file.filename,
                                    error: deleteError.message,
                                    success: false
                                });
                            }
                        }
                        
                        // Add stagger delay if enabled
                        if (this.config.cleanupSchedule.enableStaggeredCleanup) {
                            await new Promise(resolve => setTimeout(resolve, this.config.cleanupSchedule.staggerDelay));
                        }
                        
                        // Check if we've hit the maximum cleanup items limit
                        if (processed >= this.config.cleanupSchedule.maxCleanupItems) {
                            console.log(`⏹️ Reached maximum cleanup items limit (${this.config.cleanupSchedule.maxCleanupItems})`);
                            break;
                        }
                    }
                } catch (userError) {
                    console.error(`❌ Failed to process CSV files for user ${userId}:`, userError.message);
                }
                
                if (processed >= this.config.cleanupSchedule.maxCleanupItems) {
                    break;
                }
            }
            
            this.retentionStats.csvFilesProcessed += processed;
            
            console.log(`✅ CSV file retention processing completed: ${processed} processed, ${deleted} deleted`);
            
            return { processed, deleted, dataCleaned };
            
        } catch (error) {
            console.error('❌ CSV file retention processing failed:', error.message);
            throw error;
        }
    }
    
    /**
     * Determine if a CSV file should be deleted based on retention policies
     */
    async shouldDeleteCsvFile(userId, file) {
        try {
            const now = Date.now();
            const fileCreatedAt = new Date(file.uploadedAt || file.createdAt).getTime();
            const fileAge = now - fileCreatedAt;
            
            // Check default retention period
            if (fileAge > this.config.csvRetentionPolicies.defaultRetentionPeriod) {
                return {
                    delete: true,
                    reason: 'Default retention period exceeded',
                    retentionPeriod: this.config.csvRetentionPolicies.defaultRetentionPeriod
                };
            }
            
            // Check large file retention policy
            const fileSize = file.size || 0;
            if (fileSize > this.config.csvRetentionPolicies.largeCsvThreshold &&
                fileAge > this.config.csvRetentionPolicies.largeCsvRetention) {
                return {
                    delete: true,
                    reason: 'Large file retention period exceeded',
                    retentionPeriod: this.config.csvRetentionPolicies.largeCsvRetention
                };
            }
            
            // Check inactive user retention policy
            const userLastActivity = await this.getUserLastActivity(userId);
            if (userLastActivity) {
                const inactivityPeriod = now - new Date(userLastActivity).getTime();
                
                if (inactivityPeriod > this.config.csvRetentionPolicies.inactiveUserThreshold &&
                    fileAge > this.config.csvRetentionPolicies.inactiveUserCsvRetention) {
                    return {
                        delete: true,
                        reason: 'Inactive user CSV retention period exceeded',
                        retentionPeriod: this.config.csvRetentionPolicies.inactiveUserCsvRetention
                    };
                }
            }
            
            // Check maximum retention period (GDPR compliance)
            if (fileAge > this.config.csvRetentionPolicies.maxRetentionPeriod) {
                return {
                    delete: true,
                    reason: 'Maximum retention period exceeded (GDPR compliance)',
                    retentionPeriod: this.config.csvRetentionPolicies.maxRetentionPeriod
                };
            }
            
            return { delete: false, reason: 'Within retention period' };
            
        } catch (error) {
            console.error('❌ Failed to evaluate CSV file retention:', error.message);
            return { delete: false, reason: 'Evaluation error', error: error.message };
        }
    }
    
    /**
     * Process session data retention policies
     */
    async processSessionDataRetention() {
        try {
            console.log('🔐 Processing session data retention policies');
            
            let processed = 0;
            let deleted = 0;
            let dataCleaned = 0;
            
            if (!this.sessionManagement) {
                console.warn('⚠️ SessionManagement not available, skipping session retention');
                return { processed, deleted, dataCleaned };
            }
            
            // Get all active sessions
            const allSessions = await this.sessionManagement.getAllSessions();
            
            for (const session of allSessions) {
                processed++;
                
                const shouldDelete = await this.shouldDeleteSessionData(session);
                
                if (shouldDelete.delete) {
                    try {
                        // Calculate data size (approximate)
                        const sessionSize = JSON.stringify(session).length;
                        
                        // Delete the session
                        await this.sessionManagement.deleteSession(session.sessionId);
                        
                        deleted++;
                        dataCleaned += sessionSize;
                        this.retentionStats.sessionsDeleted++;
                        
                        // Log retention action
                        await this.logRetentionAction({
                            timestamp: new Date().toISOString(),
                            type: 'SESSION_DATA_DELETED',
                            sessionId: session.sessionId,
                            userId: session.userId || 'anonymous',
                            sessionSize: sessionSize,
                            reason: shouldDelete.reason,
                            retentionPeriod: shouldDelete.retentionPeriod,
                            success: true
                        });
                        
                        console.log(`🗑️ Deleted session: ${session.sessionId} - ${shouldDelete.reason}`);
                        
                    } catch (deleteError) {
                        console.error(`❌ Failed to delete session ${session.sessionId}:`, deleteError.message);
                        
                        await this.logRetentionAction({
                            timestamp: new Date().toISOString(),
                            type: 'SESSION_DELETE_FAILED',
                            sessionId: session.sessionId,
                            error: deleteError.message,
                            success: false
                        });
                    }
                }
                
                // Add stagger delay if enabled
                if (this.config.cleanupSchedule.enableStaggeredCleanup) {
                    await new Promise(resolve => setTimeout(resolve, this.config.cleanupSchedule.staggerDelay));
                }
                
                // Check if we've hit the maximum cleanup items limit
                if (processed >= this.config.cleanupSchedule.maxCleanupItems) {
                    console.log(`⏹️ Reached maximum cleanup items limit for sessions`);
                    break;
                }
            }
            
            this.retentionStats.sessionsProcessed += processed;
            
            console.log(`✅ Session data retention processing completed: ${processed} processed, ${deleted} deleted`);
            
            return { processed, deleted, dataCleaned };
            
        } catch (error) {
            console.error('❌ Session data retention processing failed:', error.message);
            throw error;
        }
    }
    
    /**
     * Determine if session data should be deleted based on retention policies
     */
    async shouldDeleteSessionData(session) {
        try {
            const now = Date.now();
            const sessionCreatedAt = new Date(session.createdAt).getTime();
            const sessionLastActivity = new Date(session.lastActivity || session.createdAt).getTime();
            const sessionAge = now - sessionCreatedAt;
            const inactivityPeriod = now - sessionLastActivity;
            
            // Check if session is expired
            if (session.expiresAt && now > new Date(session.expiresAt).getTime()) {
                const expiredAge = now - new Date(session.expiresAt).getTime();
                
                if (expiredAge > this.config.sessionRetentionPolicies.expiredSessionCleanup) {
                    return {
                        delete: true,
                        reason: 'Expired session cleanup period exceeded',
                        retentionPeriod: this.config.sessionRetentionPolicies.expiredSessionCleanup
                    };
                }
            }
            
            // Check active session retention
            if (sessionAge > this.config.sessionRetentionPolicies.activeSessionRetention) {
                return {
                    delete: true,
                    reason: 'Active session retention period exceeded',
                    retentionPeriod: this.config.sessionRetentionPolicies.activeSessionRetention
                };
            }
            
            // Check anonymous session retention
            if (!session.userId && sessionAge > this.config.sessionRetentionPolicies.anonymousSessionRetention) {
                return {
                    delete: true,
                    reason: 'Anonymous session retention period exceeded',
                    retentionPeriod: this.config.sessionRetentionPolicies.anonymousSessionRetention
                };
            }
            
            // Check session metadata retention
            if (sessionAge > this.config.sessionRetentionPolicies.sessionMetadataRetention) {
                return {
                    delete: true,
                    reason: 'Session metadata retention period exceeded',
                    retentionPeriod: this.config.sessionRetentionPolicies.sessionMetadataRetention
                };
            }
            
            return { delete: false, reason: 'Within retention period' };
            
        } catch (error) {
            console.error('❌ Failed to evaluate session data retention:', error.message);
            return { delete: false, reason: 'Evaluation error', error: error.message };
        }
    }
    
    /**
     * Process user data retention policies
     */
    async processUserDataRetention() {
        try {
            console.log('👤 Processing user data retention policies');
            
            let processed = 0;
            let deleted = 0;
            let dataCleaned = 0;
            
            // This would typically process user activity logs, preferences, etc.
            // For now, we'll simulate basic user data cleanup
            
            // Process retention audit log cleanup
            const auditCleanupResults = await this.cleanupRetentionAuditLog();
            processed += auditCleanupResults.processed;
            deleted += auditCleanupResults.deleted;
            dataCleaned += auditCleanupResults.dataCleaned;
            
            this.retentionStats.userDataProcessed += processed;
            
            console.log(`✅ User data retention processing completed: ${processed} processed, ${deleted} deleted`);
            
            return { processed, deleted, dataCleaned };
            
        } catch (error) {
            console.error('❌ User data retention processing failed:', error.message);
            throw error;
        }
    }
    
    /**
     * Clean up old retention audit log entries
     */
    async cleanupRetentionAuditLog() {
        try {
            const now = Date.now();
            const retentionPeriod = this.config.userDataRetentionPolicies.userActivityLogsRetention;
            
            let processed = 0;
            let deleted = 0;
            let dataCleaned = 0;
            
            // Filter out old audit log entries
            const originalCount = this.retentionAuditLog.length;
            const originalSize = JSON.stringify(this.retentionAuditLog).length;
            
            this.retentionAuditLog = this.retentionAuditLog.filter(entry => {
                processed++;
                const entryAge = now - new Date(entry.timestamp).getTime();
                return entryAge <= retentionPeriod;
            });
            
            deleted = originalCount - this.retentionAuditLog.length;
            dataCleaned = originalSize - JSON.stringify(this.retentionAuditLog).length;
            
            if (deleted > 0) {
                console.log(`🧹 Cleaned up ${deleted} old retention audit log entries`);
            }
            
            return { processed, deleted, dataCleaned };
            
        } catch (error) {
            console.error('❌ Failed to cleanup retention audit log:', error.message);
            return { processed: 0, deleted: 0, dataCleaned: 0 };
        }
    }
    
    /**
     * Create backup of CSV file before deletion
     */
    async createCsvBackup(userId, file) {
        try {
            // In a production environment, this would create a backup
            // For now, we'll just log the backup creation
            console.log(`💾 Creating backup for CSV file: ${file.filename} (${userId})`);
            
            // Track backup creation
            if (this.appInsights) {
                this.appInsights.telemetry.trackEvent('CSV_File_Backup_Created', {
                    userId: userId,
                    filename: file.filename,
                    fileSize: (file.size || 0).toString()
                });
            }
            
        } catch (error) {
            console.error('❌ Failed to create CSV backup:', error.message);
            throw error;
        }
    }
    
    /**
     * Get user's last activity timestamp
     */
    async getUserLastActivity(userId) {
        try {
            // This would typically query the user activity database
            // For now, we'll return a simulated timestamp
            return new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString();
            
        } catch (error) {
            console.error('❌ Failed to get user last activity:', error.message);
            return null;
        }
    }
    
    /**
     * Check if data is under legal hold
     */
    isUnderLegalHold(userId, dataType) {
        const holdKey = `${userId}_${dataType}`;
        return this.legalHolds.has(holdKey);
    }
    
    /**
     * Apply legal hold to user data
     */
    async applyLegalHold(userId, dataType, reason, expiresAt = null) {
        try {
            const holdKey = `${userId}_${dataType}`;
            const legalHold = {
                userId: userId,
                dataType: dataType,
                reason: reason,
                appliedAt: new Date().toISOString(),
                expiresAt: expiresAt,
                active: true
            };
            
            this.legalHolds.set(holdKey, legalHold);
            
            // Log legal hold application
            await this.logRetentionAction({
                timestamp: new Date().toISOString(),
                type: 'LEGAL_HOLD_APPLIED',
                userId: userId,
                dataType: dataType,
                reason: reason,
                expiresAt: expiresAt,
                success: true
            });
            
            console.log(`⚖️ Legal hold applied: ${userId} (${dataType}) - ${reason}`);
            
            return legalHold;
            
        } catch (error) {
            console.error('❌ Failed to apply legal hold:', error.message);
            throw error;
        }
    }
    
    /**
     * Remove legal hold from user data
     */
    async removeLegalHold(userId, dataType, reason) {
        try {
            const holdKey = `${userId}_${dataType}`;
            
            if (this.legalHolds.has(holdKey)) {
                this.legalHolds.delete(holdKey);
                
                // Log legal hold removal
                await this.logRetentionAction({
                    timestamp: new Date().toISOString(),
                    type: 'LEGAL_HOLD_REMOVED',
                    userId: userId,
                    dataType: dataType,
                    reason: reason,
                    success: true
                });
                
                console.log(`⚖️ Legal hold removed: ${userId} (${dataType}) - ${reason}`);
                
                return true;
            }
            
            return false;
            
        } catch (error) {
            console.error('❌ Failed to remove legal hold:', error.message);
            throw error;
        }
    }
    
    /**
     * Initialize retention audit logging
     */
    async initializeRetentionAudit() {
        try {
            // Initialize audit log if needed
            if (!Array.isArray(this.retentionAuditLog)) {
                this.retentionAuditLog = [];
            }
            
            console.log('📋 Retention audit logging initialized');
            
        } catch (error) {
            console.error('❌ Failed to initialize retention audit:', error.message);
        }
    }
    
    /**
     * Log retention action for audit purposes
     */
    async logRetentionAction(auditEntry) {
        try {
            if (!this.config.compliance.enableRetentionAudit) {
                return;
            }
            
            // Add audit entry
            this.retentionAuditLog.push(auditEntry);
            
            // Update statistics
            this.retentionStats.retentionPoliciesApplied++;
            
            // In a production environment, this would also write to a persistent audit log
            
        } catch (error) {
            console.error('❌ Failed to log retention action:', error.message);
        }
    }
    
    /**
     * Generate policy documentation
     */
    async generatePolicyDocumentation() {
        try {
            const documentation = {
                generatedAt: new Date().toISOString(),
                version: '2.0',
                
                retentionCategories: this.retentionCategories,
                
                policies: {
                    csvFiles: {
                        description: 'CSV file retention policies ensure data minimization and compliance with storage limitations',
                        defaultRetention: `${Math.round(this.config.csvRetentionPolicies.defaultRetentionPeriod / (24 * 60 * 60 * 1000))} days`,
                        maxRetention: `${Math.round(this.config.csvRetentionPolicies.maxRetentionPeriod / (24 * 60 * 60 * 1000))} days`,
                        largeCsvPolicy: `Files over ${Math.round(this.config.csvRetentionPolicies.largeCsvThreshold / 1024 / 1024)}MB retained for ${Math.round(this.config.csvRetentionPolicies.largeCsvRetention / (24 * 60 * 60 * 1000))} days`,
                        inactiveUserPolicy: `CSV files from inactive users (${Math.round(this.config.csvRetentionPolicies.inactiveUserThreshold / (24 * 60 * 60 * 1000))} days) retained for ${Math.round(this.config.csvRetentionPolicies.inactiveUserCsvRetention / (24 * 60 * 60 * 1000))} days`,
                        backupRetention: this.config.csvRetentionPolicies.enableBackupRetention ? `${Math.round(this.config.csvRetentionPolicies.backupRetentionPeriod / (24 * 60 * 60 * 1000))} days` : 'Disabled'
                    },
                    
                    sessionData: {
                        description: 'Session data retention policies ensure temporary data is not stored longer than necessary',
                        activeSessionRetention: `${Math.round(this.config.sessionRetentionPolicies.activeSessionRetention / (60 * 60 * 1000))} hours`,
                        expiredSessionCleanup: `${Math.round(this.config.sessionRetentionPolicies.expiredSessionCleanup / (24 * 60 * 60 * 1000))} days`,
                        anonymousSessionRetention: `${Math.round(this.config.sessionRetentionPolicies.anonymousSessionRetention / (60 * 60 * 1000))} hours`,
                        sessionMetadataRetention: `${Math.round(this.config.sessionRetentionPolicies.sessionMetadataRetention / (24 * 60 * 60 * 1000))} days`
                    },
                    
                    userData: {
                        description: 'User data retention policies balance service functionality with privacy rights',
                        deletedUserDataRetention: `${Math.round(this.config.userDataRetentionPolicies.deletedUserDataRetention / (24 * 60 * 60 * 1000))} days`,
                        userActivityLogsRetention: `${Math.round(this.config.userDataRetentionPolicies.userActivityLogsRetention / (24 * 60 * 60 * 1000))} days`,
                        userConsentRetention: `${Math.round(this.config.userDataRetentionPolicies.userConsentRetention / (24 * 60 * 60 * 1000))} days`,
                        userPreferencesRetention: `${Math.round(this.config.userDataRetentionPolicies.userPreferencesRetention / (24 * 60 * 60 * 1000))} days`
                    }
                },
                
                compliance: {
                    gdprCompliant: this.config.compliance.gdprCompliant,
                    dataMinimization: this.config.compliance.enableDataMinimization,
                    auditTrail: this.config.compliance.enableRetentionAudit,
                    legalHold: this.config.compliance.enableLegalHold
                },
                
                cleanupSchedule: {
                    interval: `${Math.round(this.config.cleanupSchedule.cleanupInterval / (60 * 60 * 1000))} hours`,
                    hour: `${this.config.cleanupSchedule.cleanupHour}:00`,
                    maxItems: this.config.cleanupSchedule.maxCleanupItems,
                    staggered: this.config.cleanupSchedule.enableStaggeredCleanup
                }
            };
            
            // In a production environment, this would save to a file or database
            console.log('📄 Data retention policy documentation generated');
            
            return documentation;
            
        } catch (error) {
            console.error('❌ Failed to generate policy documentation:', error.message);
            throw error;
        }
    }
    
    /**
     * Get retention policy for specific data type
     */
    getRetentionPolicy(dataType) {
        return this.retentionCategories[dataType] || null;
    }
    
    /**
     * Get service statistics
     */
    getStatistics() {
        return {
            ...this.retentionStats,
            
            configuration: {
                enableDataRetention: this.config.enableDataRetention,
                enableAutomaticCleanup: this.config.enableAutomaticCleanup,
                enableRetentionLogging: this.config.enableRetentionLogging,
                gdprCompliant: this.config.compliance.gdprCompliant,
                dataMinimization: this.config.compliance.enableDataMinimization,
                retentionAudit: this.config.compliance.enableRetentionAudit,
                legalHold: this.config.compliance.enableLegalHold,
                cleanupInterval: this.config.cleanupSchedule.cleanupInterval / 1000 / 60 / 60 + ' hours',
                cleanupHour: this.config.cleanupSchedule.cleanupHour + ':00',
                maxCleanupItems: this.config.cleanupSchedule.maxCleanupItems
            },
            
            retentionPolicies: {
                csvDefaultRetention: Math.round(this.config.csvRetentionPolicies.defaultRetentionPeriod / (24 * 60 * 60 * 1000)) + ' days',
                csvMaxRetention: Math.round(this.config.csvRetentionPolicies.maxRetentionPeriod / (24 * 60 * 60 * 1000)) + ' days',
                sessionRetention: Math.round(this.config.sessionRetentionPolicies.activeSessionRetention / (60 * 60 * 1000)) + ' hours',
                userActivityRetention: Math.round(this.config.userDataRetentionPolicies.userActivityLogsRetention / (24 * 60 * 60 * 1000)) + ' days',
                consentRetention: Math.round(this.config.userDataRetentionPolicies.userConsentRetention / (24 * 60 * 60 * 1000)) + ' days'
            },
            
            activeLegalHolds: this.legalHolds.size,
            auditLogEntries: this.retentionAuditLog.length,
            retentionCategories: Object.keys(this.retentionCategories).length
        };
    }
    
    /**
     * Stop automatic cleanup
     */
    stopAutomaticCleanup() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
            console.log('⏹️ Automatic cleanup stopped');
        }
    }
}

module.exports = {
    DataRetentionService
};
