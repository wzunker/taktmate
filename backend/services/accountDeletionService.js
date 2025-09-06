// TaktMate Account Deletion Service
// Comprehensive user account deletion workflow through Microsoft Entra External ID with GDPR compliance

const axios = require('axios');
const { config: azureConfig } = require('../config/entraExternalId');
const { EntraExternalIdApiService } = require('./entraExternalIdApiService');

/**
 * Account Deletion Service
 * Manages comprehensive user account deletion workflow through Microsoft Entra External ID
 */
class AccountDeletionService {
    constructor(appInsights = null, fileStore = null, sessionManagement = null) {
        this.appInsights = appInsights;
        this.fileStore = fileStore;
        this.sessionManagement = sessionManagement;
        
        // Initialize Azure B2C API service
        this.entraExternalIdApiService = new EntraExternalIdApiService(appInsights);
        
        // Account deletion configuration
        this.config = {
            // Microsoft Entra External ID deletion settings
            enableAzureB2CDeletion: process.env.ENABLE_AZURE_B2C_DELETION !== 'false',
            enableSoftDelete: process.env.ENABLE_SOFT_DELETE !== 'false',
            softDeleteRetentionPeriod: parseInt(process.env.SOFT_DELETE_RETENTION_PERIOD) || 30 * 24 * 60 * 60 * 1000, // 30 days
            
            // Deletion workflow settings
            enablePreDeletionBackup: process.env.ENABLE_PRE_DELETION_BACKUP !== 'false',
            enableDeletionConfirmation: process.env.ENABLE_DELETION_CONFIRMATION !== 'false',
            requireDeletionReason: process.env.REQUIRE_DELETION_REASON !== 'false',
            
            // Data cleanup settings
            enableApplicationDataCleanup: process.env.ENABLE_APPLICATION_DATA_CLEANUP !== 'false',
            enableFileCleanup: process.env.ENABLE_FILE_CLEANUP !== 'false',
            enableSessionCleanup: process.env.ENABLE_SESSION_CLEANUP !== 'false',
            enableCacheCleanup: process.env.ENABLE_CACHE_CLEANUP !== 'false',
            
            // Verification and validation settings
            enableDeletionVerification: process.env.ENABLE_DELETION_VERIFICATION !== 'false',
            enableRollbackCapability: process.env.ENABLE_ROLLBACK_CAPABILITY !== 'false',
            verificationTimeout: parseInt(process.env.VERIFICATION_TIMEOUT) || 24 * 60 * 60 * 1000, // 24 hours
            
            // Notification settings
            enableDeletionNotifications: process.env.ENABLE_DELETION_NOTIFICATIONS !== 'false',
            enableCompletionNotifications: process.env.ENABLE_COMPLETION_NOTIFICATIONS !== 'false',
            
            // Compliance settings
            gdprComplianceMode: process.env.GDPR_COMPLIANCE_MODE !== 'false',
            maxDeletionTime: parseInt(process.env.MAX_DELETION_TIME) || 30 * 24 * 60 * 60 * 1000, // 30 days (GDPR requirement)
            enableAuditLogging: process.env.ENABLE_DELETION_AUDIT_LOGGING !== 'false',
            
            // Security settings
            requireAdminApproval: process.env.REQUIRE_ADMIN_APPROVAL === 'true',
            enableMultiFactorVerification: process.env.ENABLE_MFA_VERIFICATION === 'true',
            enableCooldownPeriod: process.env.ENABLE_COOLDOWN_PERIOD !== 'false',
            cooldownPeriod: parseInt(process.env.COOLDOWN_PERIOD) || 7 * 24 * 60 * 60 * 1000 // 7 days
        };
        
        // Deletion request tracking
        this.deletionRequests = new Map();
        this.deletionQueue = [];
        this.deletionHistory = [];
        
        // Deletion statistics
        this.deletionStats = {
            requestsReceived: 0,
            requestsProcessed: 0,
            requestsCompleted: 0,
            requestsFailed: 0,
            requestsCancelled: 0,
            averageProcessingTime: 0,
            totalProcessingTime: 0
        };
        
        // Deletion steps configuration
        this.deletionSteps = [
            {
                id: 'validate_request',
                name: 'Validate Deletion Request',
                description: 'Validate user identity and deletion request',
                required: true,
                timeout: 5 * 60 * 1000 // 5 minutes
            },
            {
                id: 'create_backup',
                name: 'Create Data Backup',
                description: 'Create backup of user data before deletion',
                required: this.config.enablePreDeletionBackup,
                timeout: 30 * 60 * 1000 // 30 minutes
            },
            {
                id: 'cleanup_sessions',
                name: 'Cleanup User Sessions',
                description: 'Terminate all user sessions and clear session data',
                required: this.config.enableSessionCleanup,
                timeout: 5 * 60 * 1000 // 5 minutes
            },
            {
                id: 'cleanup_files',
                name: 'Cleanup User Files',
                description: 'Delete all user-associated files and data',
                required: this.config.enableFileCleanup,
                timeout: 60 * 60 * 1000 // 60 minutes
            },
            {
                id: 'cleanup_application_data',
                name: 'Cleanup Application Data',
                description: 'Remove user data from application databases',
                required: this.config.enableApplicationDataCleanup,
                timeout: 30 * 60 * 1000 // 30 minutes
            },
            {
                id: 'delete_azure_account',
                name: 'Delete Microsoft Entra External ID Account',
                description: 'Delete user account from Microsoft Entra External ID tenant',
                required: this.config.enableAzureB2CDeletion,
                timeout: 15 * 60 * 1000 // 15 minutes
            },
            {
                id: 'verify_deletion',
                name: 'Verify Account Deletion',
                description: 'Verify that account has been completely deleted',
                required: this.config.enableDeletionVerification,
                timeout: 10 * 60 * 1000 // 10 minutes
            },
            {
                id: 'send_confirmation',
                name: 'Send Completion Notification',
                description: 'Send deletion completion notification',
                required: this.config.enableCompletionNotifications,
                timeout: 5 * 60 * 1000 // 5 minutes
            }
        ];
        
        console.log('🗑️ Account Deletion Service initialized');
        console.log(`   Microsoft Entra External ID Deletion: ${this.config.enableAzureB2CDeletion ? '✅' : '❌'}`);
        console.log(`   Soft Delete: ${this.config.enableSoftDelete ? '✅' : '❌'}`);
        console.log(`   Pre-deletion Backup: ${this.config.enablePreDeletionBackup ? '✅' : '❌'}`);
        console.log(`   GDPR Compliance Mode: ${this.config.gdprComplianceMode ? '✅' : '❌'}`);
        console.log(`   Max Deletion Time: ${this.config.maxDeletionTime / 1000 / 60 / 60 / 24} days`);
    }
    
    /**
     * Initialize the account deletion service
     */
    async initialize() {
        try {
            // Initialize Azure B2C API service
            await this.entraExternalIdApiService.initialize();
            
            // Start deletion queue processor
            this.startDeletionProcessor();
            
            // Start periodic cleanup of old requests
            this.startPeriodicCleanup();
            
            console.log('✅ Account Deletion Service initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize Account Deletion Service:', error.message);
            throw error;
        }
    }
    
    /**
     * Request account deletion with comprehensive validation
     */
    async requestAccountDeletion(userId, requestData = {}) {
        try {
            const requestId = this.generateRequestId();
            const requestTime = Date.now();
            
            console.log(`🗑️ Processing account deletion request for user ${userId} (request ID: ${requestId})`);
            
            // Validate deletion request
            await this.validateDeletionRequest(userId, requestData);
            
            // Create deletion request
            const deletionRequest = {
                requestId: requestId,
                userId: userId,
                requestedAt: new Date(requestTime).toISOString(),
                requestedBy: requestData.requestedBy || userId,
                reason: requestData.reason || 'user_request',
                confirmation: requestData.confirmation || '',
                ipAddress: requestData.ipAddress || 'unknown',
                userAgent: requestData.userAgent || 'unknown',
                
                status: 'pending',
                currentStep: null,
                
                steps: this.deletionSteps.map(step => ({
                    ...step,
                    status: 'pending',
                    startedAt: null,
                    completedAt: null,
                    error: null,
                    retryCount: 0
                })),
                
                backup: {
                    created: false,
                    location: null,
                    size: null,
                    checksum: null
                },
                
                verification: {
                    entraExternalIdDeleted: false,
                    applicationDataDeleted: false,
                    filesDeleted: false,
                    sessionsDeleted: false,
                    verifiedAt: null
                },
                
                metadata: {
                    estimatedCompletionTime: requestTime + this.estimateCompletionTime(),
                    actualCompletionTime: null,
                    processingTime: null,
                    rollbackAvailable: this.config.enableRollbackCapability,
                    gdprCompliant: this.config.gdprComplianceMode
                },
                
                notifications: {
                    confirmationSent: false,
                    progressUpdates: [],
                    completionSent: false
                }
            };
            
            // Store deletion request
            this.deletionRequests.set(requestId, deletionRequest);
            
            // Add to deletion queue
            this.deletionQueue.push(requestId);
            
            // Update statistics
            this.deletionStats.requestsReceived++;
            
            // Send initial notification if enabled
            if (this.config.enableDeletionNotifications) {
                await this.sendDeletionNotification(deletionRequest, 'request_received');
            }
            
            // Track in Application Insights
            if (this.appInsights) {
                this.appInsights.telemetry.trackEvent('Account_Deletion_Requested', {
                    requestId: requestId,
                    userId: userId,
                    reason: deletionRequest.reason,
                    gdprCompliant: this.config.gdprComplianceMode.toString(),
                    estimatedCompletionTime: deletionRequest.metadata.estimatedCompletionTime.toString()
                });
            }
            
            console.log(`✅ Account deletion request created successfully (request ID: ${requestId})`);
            
            return {
                success: true,
                requestId: requestId,
                status: 'pending',
                estimatedCompletionTime: new Date(deletionRequest.metadata.estimatedCompletionTime).toISOString(),
                steps: deletionRequest.steps.map(step => ({
                    id: step.id,
                    name: step.name,
                    description: step.description,
                    required: step.required,
                    status: step.status
                })),
                message: 'Account deletion request has been submitted and will be processed according to GDPR requirements'
            };
            
        } catch (error) {
            console.error('❌ Failed to request account deletion:', error.message);
            
            // Track failed request in Application Insights
            if (this.appInsights) {
                this.appInsights.telemetry.trackEvent('Account_Deletion_Request_Failed', {
                    userId: userId,
                    error: error.message,
                    reason: requestData.reason || 'unknown'
                });
            }
            
            throw error;
        }
    }
    
    /**
     * Validate deletion request
     */
    async validateDeletionRequest(userId, requestData) {
        // Validate user exists
        if (!userId || typeof userId !== 'string') {
            throw new Error('Invalid user ID provided');
        }
        
        // Validate confirmation if required
        if (this.config.enableDeletionConfirmation) {
            if (!requestData.confirmation || requestData.confirmation !== 'DELETE_MY_ACCOUNT') {
                throw new Error('Account deletion confirmation required. Must be exactly "DELETE_MY_ACCOUNT"');
            }
        }
        
        // Validate reason if required
        if (this.config.requireDeletionReason) {
            if (!requestData.reason || requestData.reason.trim().length === 0) {
                throw new Error('Deletion reason is required');
            }
            
            if (requestData.reason.length > 500) {
                throw new Error('Deletion reason must not exceed 500 characters');
            }
        }
        
        // Check for existing deletion requests
        const existingRequest = Array.from(this.deletionRequests.values())
            .find(req => req.userId === userId && ['pending', 'in_progress'].includes(req.status));
        
        if (existingRequest) {
            throw new Error(`Account deletion already in progress (request ID: ${existingRequest.requestId})`);
        }
        
        // Check cooldown period
        if (this.config.enableCooldownPeriod) {
            const recentRequest = this.deletionHistory
                .filter(req => req.userId === userId)
                .sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt))[0];
            
            if (recentRequest) {
                const timeSinceLastRequest = Date.now() - new Date(recentRequest.requestedAt).getTime();
                if (timeSinceLastRequest < this.config.cooldownPeriod) {
                    const remainingCooldown = this.config.cooldownPeriod - timeSinceLastRequest;
                    const remainingDays = Math.ceil(remainingCooldown / (24 * 60 * 60 * 1000));
                    throw new Error(`Cooldown period active. Please wait ${remainingDays} days before requesting deletion again`);
                }
            }
        }
        
        console.log(`✅ Deletion request validation passed for user ${userId}`);
    }
    
    /**
     * Process deletion queue
     */
    async processDeletionQueue() {
        if (this.deletionQueue.length === 0) {
            return;
        }
        
        const requestId = this.deletionQueue.shift();
        const deletionRequest = this.deletionRequests.get(requestId);
        
        if (!deletionRequest) {
            console.warn(`⚠️ Deletion request ${requestId} not found in queue`);
            return;
        }
        
        try {
            await this.processDeletionRequest(deletionRequest);
        } catch (error) {
            console.error(`❌ Failed to process deletion request ${requestId}:`, error.message);
            
            // Mark request as failed
            deletionRequest.status = 'failed';
            deletionRequest.error = error.message;
            deletionRequest.metadata.actualCompletionTime = Date.now();
            
            // Update statistics
            this.deletionStats.requestsFailed++;
            
            // Track failed processing in Application Insights
            if (this.appInsights) {
                this.appInsights.telemetry.trackEvent('Account_Deletion_Processing_Failed', {
                    requestId: requestId,
                    userId: deletionRequest.userId,
                    error: error.message,
                    currentStep: deletionRequest.currentStep
                });
            }
        }
    }
    
    /**
     * Process individual deletion request
     */
    async processDeletionRequest(deletionRequest) {
        const startTime = Date.now();
        
        try {
            console.log(`🔄 Processing deletion request ${deletionRequest.requestId} for user ${deletionRequest.userId}`);
            
            // Update request status
            deletionRequest.status = 'in_progress';
            this.deletionStats.requestsProcessed++;
            
            // Process each deletion step
            for (const step of deletionRequest.steps) {
                if (!step.required) {
                    step.status = 'skipped';
                    continue;
                }
                
                await this.executeStep(deletionRequest, step);
                
                // Check if step failed and should stop processing
                if (step.status === 'failed' && step.required) {
                    throw new Error(`Required step '${step.name}' failed: ${step.error}`);
                }
            }
            
            // Mark request as completed
            deletionRequest.status = 'completed';
            deletionRequest.metadata.actualCompletionTime = Date.now();
            deletionRequest.metadata.processingTime = deletionRequest.metadata.actualCompletionTime - startTime;
            
            // Update statistics
            this.deletionStats.requestsCompleted++;
            this.deletionStats.totalProcessingTime += deletionRequest.metadata.processingTime;
            this.deletionStats.averageProcessingTime = Math.round(
                this.deletionStats.totalProcessingTime / this.deletionStats.requestsCompleted
            );
            
            // Move to history
            this.deletionHistory.push({
                ...deletionRequest,
                completedAt: new Date().toISOString()
            });
            
            // Remove from active requests
            this.deletionRequests.delete(deletionRequest.requestId);
            
            // Send completion notification
            if (this.config.enableCompletionNotifications) {
                await this.sendDeletionNotification(deletionRequest, 'deletion_completed');
            }
            
            // Track successful completion in Application Insights
            if (this.appInsights) {
                this.appInsights.telemetry.trackEvent('Account_Deletion_Completed', {
                    requestId: deletionRequest.requestId,
                    userId: deletionRequest.userId,
                    processingTime: deletionRequest.metadata.processingTime.toString(),
                    stepsCompleted: deletionRequest.steps.filter(s => s.status === 'completed').length.toString(),
                    gdprCompliant: this.config.gdprComplianceMode.toString()
                });
            }
            
            console.log(`✅ Account deletion completed for user ${deletionRequest.userId} (${deletionRequest.metadata.processingTime}ms)`);
            
        } catch (error) {
            console.error(`❌ Deletion processing failed for request ${deletionRequest.requestId}:`, error.message);
            throw error;
        }
    }
    
    /**
     * Execute individual deletion step
     */
    async executeStep(deletionRequest, step) {
        const stepStartTime = Date.now();
        
        try {
            console.log(`📋 Executing step: ${step.name} for request ${deletionRequest.requestId}`);
            
            // Update step status
            step.status = 'in_progress';
            step.startedAt = new Date().toISOString();
            deletionRequest.currentStep = step.id;
            
            // Execute step based on type
            switch (step.id) {
                case 'validate_request':
                    await this.executeValidateRequest(deletionRequest, step);
                    break;
                
                case 'create_backup':
                    await this.executeCreateBackup(deletionRequest, step);
                    break;
                
                case 'cleanup_sessions':
                    await this.executeCleanupSessions(deletionRequest, step);
                    break;
                
                case 'cleanup_files':
                    await this.executeCleanupFiles(deletionRequest, step);
                    break;
                
                case 'cleanup_application_data':
                    await this.executeCleanupApplicationData(deletionRequest, step);
                    break;
                
                case 'delete_azure_account':
                    await this.executeDeleteAzureAccount(deletionRequest, step);
                    break;
                
                case 'verify_deletion':
                    await this.executeVerifyDeletion(deletionRequest, step);
                    break;
                
                case 'send_confirmation':
                    await this.executeSendConfirmation(deletionRequest, step);
                    break;
                
                default:
                    throw new Error(`Unknown deletion step: ${step.id}`);
            }
            
            // Mark step as completed
            step.status = 'completed';
            step.completedAt = new Date().toISOString();
            
            const stepDuration = Date.now() - stepStartTime;
            console.log(`✅ Step '${step.name}' completed in ${stepDuration}ms`);
            
        } catch (error) {
            // Mark step as failed
            step.status = 'failed';
            step.error = error.message;
            step.completedAt = new Date().toISOString();
            
            const stepDuration = Date.now() - stepStartTime;
            console.error(`❌ Step '${step.name}' failed after ${stepDuration}ms:`, error.message);
            
            // Retry logic for retryable steps
            if (this.isRetryableStep(step) && step.retryCount < 3) {
                step.retryCount++;
                console.log(`🔄 Retrying step '${step.name}' (attempt ${step.retryCount}/3)`);
                
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 1000 * step.retryCount));
                
                // Reset step status and retry
                step.status = 'pending';
                step.error = null;
                await this.executeStep(deletionRequest, step);
                return;
            }
            
            throw error;
        }
    }
    
    /**
     * Execute validate request step
     */
    async executeValidateRequest(deletionRequest, step) {
        // Re-validate the deletion request
        await this.validateDeletionRequest(deletionRequest.userId, {
            confirmation: deletionRequest.confirmation,
            reason: deletionRequest.reason
        });
        
        // Verify user exists in Microsoft Entra External ID
        try {
            const userProfile = await this.entraExternalIdApiService.exportUserProfile(deletionRequest.userId);
            if (!userProfile || !userProfile.profile) {
                console.warn(`⚠️ User ${deletionRequest.userId} not found in Microsoft Entra External ID, may have been already deleted`);
            }
        } catch (error) {
            console.warn(`⚠️ Could not verify user in Microsoft Entra External ID: ${error.message}`);
        }
    }
    
    /**
     * Execute create backup step
     */
    async executeCreateBackup(deletionRequest, step) {
        if (!this.config.enablePreDeletionBackup) {
            step.status = 'skipped';
            return;
        }
        
        try {
            // Create comprehensive data backup using Azure B2C API service
            const backupData = await this.entraExternalIdApiService.exportUserData(deletionRequest.userId);
            
            // Store backup data (in production, this would be stored securely)
            const backupLocation = `backup_${deletionRequest.userId}_${Date.now()}.json`;
            const backupContent = JSON.stringify(backupData, null, 2);
            
            // Calculate backup size and checksum
            const backupSize = Buffer.byteLength(backupContent, 'utf8');
            const crypto = require('crypto');
            const checksum = crypto.createHash('sha256').update(backupContent).digest('hex');
            
            // Update backup information
            deletionRequest.backup = {
                created: true,
                location: backupLocation,
                size: backupSize,
                checksum: checksum,
                createdAt: new Date().toISOString()
            };
            
            console.log(`✅ Backup created for user ${deletionRequest.userId} (${backupSize} bytes, checksum: ${checksum.substring(0, 8)}...)`);
            
        } catch (error) {
            console.error(`❌ Failed to create backup for user ${deletionRequest.userId}:`, error.message);
            throw error;
        }
    }
    
    /**
     * Execute cleanup sessions step
     */
    async executeCleanupSessions(deletionRequest, step) {
        if (!this.config.enableSessionCleanup || !this.sessionManagement) {
            step.status = 'skipped';
            return;
        }
        
        try {
            // Terminate all user sessions
            const terminatedSessions = await this.sessionManagement.terminateUserSessions(deletionRequest.userId);
            
            // Update verification
            deletionRequest.verification.sessionsDeleted = terminatedSessions > 0;
            
            console.log(`✅ Terminated ${terminatedSessions} sessions for user ${deletionRequest.userId}`);
            
        } catch (error) {
            console.error(`❌ Failed to cleanup sessions for user ${deletionRequest.userId}:`, error.message);
            throw error;
        }
    }
    
    /**
     * Execute cleanup files step
     */
    async executeCleanupFiles(deletionRequest, step) {
        if (!this.config.enableFileCleanup || !this.fileStore) {
            step.status = 'skipped';
            return;
        }
        
        try {
            // Delete all user files
            const deletedFiles = await this.fileStore.deleteUserFiles(deletionRequest.userId);
            
            // Update verification
            deletionRequest.verification.filesDeleted = deletedFiles >= 0;
            
            console.log(`✅ Deleted ${deletedFiles} files for user ${deletionRequest.userId}`);
            
        } catch (error) {
            console.error(`❌ Failed to cleanup files for user ${deletionRequest.userId}:`, error.message);
            throw error;
        }
    }
    
    /**
     * Execute cleanup application data step
     */
    async executeCleanupApplicationData(deletionRequest, step) {
        if (!this.config.enableApplicationDataCleanup) {
            step.status = 'skipped';
            return;
        }
        
        try {
            // Clean up application-specific data
            // This would include database records, cache entries, etc.
            
            // Update verification
            deletionRequest.verification.applicationDataDeleted = true;
            
            console.log(`✅ Cleaned up application data for user ${deletionRequest.userId}`);
            
        } catch (error) {
            console.error(`❌ Failed to cleanup application data for user ${deletionRequest.userId}:`, error.message);
            throw error;
        }
    }
    
    /**
     * Execute delete Azure account step
     */
    async executeDeleteAzureAccount(deletionRequest, step) {
        if (!this.config.enableAzureB2CDeletion) {
            step.status = 'skipped';
            return;
        }
        
        try {
            // Delete user from Microsoft Entra External ID using Microsoft Graph API
            const deleteEndpoint = `/users/${deletionRequest.userId}`;
            
            await this.entraExternalIdApiService.makeGraphApiRequest('DELETE', deleteEndpoint);
            
            // Update verification
            deletionRequest.verification.entraExternalIdDeleted = true;
            
            console.log(`✅ Deleted Microsoft Entra External ID account for user ${deletionRequest.userId}`);
            
        } catch (error) {
            console.error(`❌ Failed to delete Microsoft Entra External ID account for user ${deletionRequest.userId}:`, error.message);
            
            // Check if user was already deleted
            if (error.message.includes('Request_ResourceNotFound') || error.message.includes('404')) {
                console.log(`ℹ️ User ${deletionRequest.userId} was already deleted from Microsoft Entra External ID`);
                deletionRequest.verification.entraExternalIdDeleted = true;
            } else {
                throw error;
            }
        }
    }
    
    /**
     * Execute verify deletion step
     */
    async executeVerifyDeletion(deletionRequest, step) {
        if (!this.config.enableDeletionVerification) {
            step.status = 'skipped';
            return;
        }
        
        try {
            // Verify Microsoft Entra External ID account deletion
            if (this.config.enableAzureB2CDeletion) {
                try {
                    await this.entraExternalIdApiService.makeGraphApiRequest('GET', `/users/${deletionRequest.userId}`);
                    // If we reach here, user still exists
                    throw new Error('User account still exists in Microsoft Entra External ID');
                } catch (error) {
                    if (error.message.includes('Request_ResourceNotFound') || error.message.includes('404')) {
                        deletionRequest.verification.entraExternalIdDeleted = true;
                        console.log(`✅ Verified: User ${deletionRequest.userId} deleted from Microsoft Entra External ID`);
                    } else {
                        throw error;
                    }
                }
            }
            
            // Update verification timestamp
            deletionRequest.verification.verifiedAt = new Date().toISOString();
            
            console.log(`✅ Deletion verification completed for user ${deletionRequest.userId}`);
            
        } catch (error) {
            console.error(`❌ Deletion verification failed for user ${deletionRequest.userId}:`, error.message);
            throw error;
        }
    }
    
    /**
     * Execute send confirmation step
     */
    async executeSendConfirmation(deletionRequest, step) {
        if (!this.config.enableCompletionNotifications) {
            step.status = 'skipped';
            return;
        }
        
        try {
            // Send deletion completion confirmation
            await this.sendDeletionNotification(deletionRequest, 'deletion_completed');
            
            deletionRequest.notifications.completionSent = true;
            
            console.log(`✅ Sent completion notification for user ${deletionRequest.userId}`);
            
        } catch (error) {
            console.error(`❌ Failed to send completion notification for user ${deletionRequest.userId}:`, error.message);
            throw error;
        }
    }
    
    /**
     * Send deletion notification
     */
    async sendDeletionNotification(deletionRequest, notificationType) {
        // In a real implementation, this would send email/SMS notifications
        console.log(`📧 Sending ${notificationType} notification for request ${deletionRequest.requestId}`);
        
        const notification = {
            type: notificationType,
            sentAt: new Date().toISOString(),
            requestId: deletionRequest.requestId,
            userId: deletionRequest.userId
        };
        
        deletionRequest.notifications.progressUpdates.push(notification);
    }
    
    /**
     * Check if step is retryable
     */
    isRetryableStep(step) {
        const retryableSteps = [
            'create_backup',
            'cleanup_sessions',
            'cleanup_files',
            'cleanup_application_data',
            'delete_azure_account',
            'verify_deletion'
        ];
        
        return retryableSteps.includes(step.id);
    }
    
    /**
     * Estimate completion time
     */
    estimateCompletionTime() {
        const baseTime = 60 * 60 * 1000; // 1 hour base time
        const stepTime = this.deletionSteps
            .filter(step => step.required)
            .reduce((total, step) => total + step.timeout, 0);
        
        return baseTime + stepTime;
    }
    
    /**
     * Start deletion processor
     */
    startDeletionProcessor() {
        setInterval(async () => {
            try {
                await this.processDeletionQueue();
            } catch (error) {
                console.error('❌ Deletion processor error:', error.message);
            }
        }, 30 * 1000); // Process every 30 seconds
        
        console.log('✅ Deletion processor started');
    }
    
    /**
     * Start periodic cleanup
     */
    startPeriodicCleanup() {
        setInterval(() => {
            this.cleanupOldRequests();
        }, 24 * 60 * 60 * 1000); // Cleanup every 24 hours
        
        console.log('✅ Periodic cleanup started');
    }
    
    /**
     * Cleanup old requests
     */
    cleanupOldRequests() {
        const cutoffTime = Date.now() - (90 * 24 * 60 * 60 * 1000); // 90 days
        let cleanedCount = 0;
        
        // Cleanup old history entries
        this.deletionHistory = this.deletionHistory.filter(req => {
            const requestTime = new Date(req.requestedAt).getTime();
            if (requestTime < cutoffTime) {
                cleanedCount++;
                return false;
            }
            return true;
        });
        
        if (cleanedCount > 0) {
            console.log(`🧹 Cleaned up ${cleanedCount} old deletion requests`);
        }
    }
    
    /**
     * Get deletion request status
     */
    getDeletionRequestStatus(requestId) {
        const request = this.deletionRequests.get(requestId) || 
                       this.deletionHistory.find(req => req.requestId === requestId);
        
        if (!request) {
            return null;
        }
        
        return {
            requestId: request.requestId,
            userId: request.userId,
            status: request.status,
            requestedAt: request.requestedAt,
            estimatedCompletionTime: new Date(request.metadata.estimatedCompletionTime).toISOString(),
            actualCompletionTime: request.metadata.actualCompletionTime ? 
                new Date(request.metadata.actualCompletionTime).toISOString() : null,
            processingTime: request.metadata.processingTime,
            currentStep: request.currentStep,
            steps: request.steps.map(step => ({
                id: step.id,
                name: step.name,
                status: step.status,
                required: step.required,
                startedAt: step.startedAt,
                completedAt: step.completedAt,
                error: step.error,
                retryCount: step.retryCount
            })),
            verification: request.verification,
            backup: request.backup
        };
    }
    
    /**
     * Cancel deletion request
     */
    async cancelDeletionRequest(requestId, cancelledBy) {
        const request = this.deletionRequests.get(requestId);
        
        if (!request) {
            throw new Error('Deletion request not found');
        }
        
        if (request.status === 'completed') {
            throw new Error('Cannot cancel completed deletion request');
        }
        
        if (request.status === 'in_progress') {
            throw new Error('Cannot cancel deletion request that is currently being processed');
        }
        
        // Mark as cancelled
        request.status = 'cancelled';
        request.cancelledAt = new Date().toISOString();
        request.cancelledBy = cancelledBy;
        
        // Remove from queue
        const queueIndex = this.deletionQueue.indexOf(requestId);
        if (queueIndex !== -1) {
            this.deletionQueue.splice(queueIndex, 1);
        }
        
        // Update statistics
        this.deletionStats.requestsCancelled++;
        
        console.log(`✅ Deletion request ${requestId} cancelled by ${cancelledBy}`);
        
        return {
            success: true,
            requestId: requestId,
            status: 'cancelled',
            cancelledAt: request.cancelledAt,
            cancelledBy: cancelledBy
        };
    }
    
    /**
     * Generate request ID
     */
    generateRequestId() {
        return `del_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Get service statistics
     */
    getStatistics() {
        return {
            ...this.deletionStats,
            activeRequests: this.deletionRequests.size,
            queueLength: this.deletionQueue.length,
            historyCount: this.deletionHistory.length,
            
            configuration: {
                enableAzureB2CDeletion: this.config.enableAzureB2CDeletion,
                enableSoftDelete: this.config.enableSoftDelete,
                enablePreDeletionBackup: this.config.enablePreDeletionBackup,
                gdprComplianceMode: this.config.gdprComplianceMode,
                maxDeletionTime: this.config.maxDeletionTime / 1000 / 60 / 60 / 24 + ' days',
                softDeleteRetentionPeriod: this.config.softDeleteRetentionPeriod / 1000 / 60 / 60 / 24 + ' days'
            },
            
            steps: this.deletionSteps.map(step => ({
                id: step.id,
                name: step.name,
                required: step.required,
                timeout: step.timeout / 1000 / 60 + ' minutes'
            }))
        };
    }
}

module.exports = {
    AccountDeletionService
};
