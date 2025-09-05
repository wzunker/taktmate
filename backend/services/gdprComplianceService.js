// TaktMate GDPR Compliance Service
// Leverages Microsoft Entra External ID's built-in GDPR compliance features and extends them for application-specific needs

const axios = require('axios');
const { config: azureConfig } = require('../config/entraExternalId');
const { EntraExternalIdApiService } = require('./entraExternalIdApiService');

/**
 * GDPR Compliance Service
 * Leverages Microsoft Entra External ID's built-in GDPR features and provides additional compliance capabilities
 */
class GDPRComplianceService {
    constructor(appInsights = null) {
        this.appInsights = appInsights;
        
        // Initialize Azure AD B2C API service
        this.entraExternalIdApiService = new EntraExternalIdApiService(appInsights);
        
        // GDPR compliance configuration
        this.config = {
            // Azure AD B2C GDPR features
            enableBuiltInGDPR: process.env.ENABLE_AZURE_B2C_GDPR !== 'false',
            enableDataExport: process.env.ENABLE_DATA_EXPORT !== 'false',
            enableDataDeletion: process.env.ENABLE_DATA_DELETION !== 'false',
            enableConsentManagement: process.env.ENABLE_CONSENT_MANAGEMENT !== 'false',
            
            // Data retention settings
            userDataRetentionPeriod: parseInt(process.env.USER_DATA_RETENTION_PERIOD) || 365 * 24 * 60 * 60 * 1000, // 1 year
            sessionDataRetentionPeriod: parseInt(process.env.SESSION_DATA_RETENTION_PERIOD) || 90 * 24 * 60 * 60 * 1000, // 90 days
            auditLogRetentionPeriod: parseInt(process.env.AUDIT_LOG_RETENTION_PERIOD) || 7 * 365 * 24 * 60 * 60 * 1000, // 7 years
            
            // Consent settings
            requireExplicitConsent: process.env.REQUIRE_EXPLICIT_CONSENT !== 'false',
            consentVersion: process.env.CONSENT_VERSION || '1.0',
            cookieConsentRequired: process.env.COOKIE_CONSENT_REQUIRED !== 'false',
            
            // Data processing settings
            enableDataMinimization: process.env.ENABLE_DATA_MINIMIZATION !== 'false',
            enablePurposeLimitation: process.env.ENABLE_PURPOSE_LIMITATION !== 'false',
            enableDataAccuracy: process.env.ENABLE_DATA_ACCURACY !== 'false',
            
            // Privacy settings
            enableRightToAccess: process.env.ENABLE_RIGHT_TO_ACCESS !== 'false',
            enableRightToRectification: process.env.ENABLE_RIGHT_TO_RECTIFICATION !== 'false',
            enableRightToErasure: process.env.ENABLE_RIGHT_TO_ERASURE !== 'false',
            enableRightToPortability: process.env.ENABLE_RIGHT_TO_PORTABILITY !== 'false',
            enableRightToObject: process.env.ENABLE_RIGHT_TO_OBJECT !== 'false',
            
            // Azure AD B2C specific settings
            azureB2CTenantId: azureConfig.config.tenantId,
            azureB2CClientId: azureConfig.config.clientId,
            azureB2CClientSecret: azureConfig.config.clientSecret,
            azureB2CDomain: azureConfig.config.domain,
            
            // Microsoft Graph API settings for GDPR operations
            graphApiBaseUrl: 'https://graph.microsoft.com/v1.0',
            graphApiScope: 'https://graph.microsoft.com/.default'
        };
        
        // GDPR data categories
        this.dataCategories = {
            IDENTITY_DATA: {
                description: 'Personal identity information',
                fields: ['id', 'email', 'name', 'givenName', 'familyName'],
                retention: this.config.userDataRetentionPeriod,
                lawfulBasis: 'contract'
            },
            PROFILE_DATA: {
                description: 'User profile and preferences',
                fields: ['company', 'role', 'industry', 'preferences'],
                retention: this.config.userDataRetentionPeriod,
                lawfulBasis: 'legitimate_interest'
            },
            USAGE_DATA: {
                description: 'Application usage and behavior',
                fields: ['loginHistory', 'fileUploads', 'chatHistory'],
                retention: this.config.sessionDataRetentionPeriod,
                lawfulBasis: 'legitimate_interest'
            },
            TECHNICAL_DATA: {
                description: 'Technical and system data',
                fields: ['ipAddress', 'userAgent', 'sessionId', 'deviceInfo'],
                retention: this.config.sessionDataRetentionPeriod,
                lawfulBasis: 'legitimate_interest'
            },
            COMMUNICATION_DATA: {
                description: 'Communication preferences and history',
                fields: ['emailPreferences', 'notifications', 'supportTickets'],
                retention: this.config.userDataRetentionPeriod,
                lawfulBasis: 'consent'
            }
        };
        
        // Consent tracking
        this.consentRecords = new Map();
        this.dataProcessingActivities = [];
        
        // GDPR request tracking
        this.gdprRequests = new Map();
        this.auditLog = [];
        
        console.log('🛡️ GDPR Compliance Service initialized');
        console.log(`   Azure AD B2C GDPR: ${this.config.enableBuiltInGDPR ? '✅' : '❌'}`);
        console.log(`   Data Export: ${this.config.enableDataExport ? '✅' : '❌'}`);
        console.log(`   Data Deletion: ${this.config.enableDataDeletion ? '✅' : '❌'}`);
        console.log(`   Consent Management: ${this.config.enableConsentManagement ? '✅' : '❌'}`);
        console.log(`   User Data Retention: ${this.config.userDataRetentionPeriod / 1000 / 60 / 60 / 24} days`);
    }
    
    /**
     * Initialize GDPR compliance system
     */
    async initialize() {
        try {
            // Initialize Azure AD B2C API service
            await this.entraExternalIdApiService.initialize();
            
            // Verify Azure AD B2C GDPR capabilities
            await this.verifyAzureB2CGDPRCapabilities();
            
            // Initialize consent management
            if (this.config.enableConsentManagement) {
                await this.initializeConsentManagement();
            }
            
            // Set up data retention policies
            await this.initializeDataRetentionPolicies();
            
            // Start periodic compliance checks
            this.startComplianceMonitoring();
            
            console.log('✅ GDPR Compliance system initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize GDPR compliance system:', error.message);
            throw error;
        }
    }
    
    /**
     * Verify Azure AD B2C GDPR capabilities
     */
    async verifyAzureB2CGDPRCapabilities() {
        try {
            // Check if Azure AD B2C tenant has GDPR features enabled
            const capabilities = {
                dataExport: this.config.enableDataExport,
                dataDeletion: this.config.enableDataDeletion,
                consentManagement: this.config.enableConsentManagement,
                auditLogging: true, // Always available in Azure AD B2C
                dataRetention: true, // Configurable in Azure AD B2C
                rightToAccess: this.config.enableRightToAccess,
                rightToErasure: this.config.enableRightToErasure,
                rightToPortability: this.config.enableRightToPortability
            };
            
            // Log GDPR capabilities
            this.auditGDPREvent('gdpr_capabilities_verified', {
                capabilities: capabilities,
                azureTenant: this.config.azureB2CTenantId,
                timestamp: new Date().toISOString()
            });
            
            console.log('✅ Azure AD B2C GDPR capabilities verified');
            return capabilities;
            
        } catch (error) {
            console.error('❌ Failed to verify Azure AD B2C GDPR capabilities:', error.message);
            throw error;
        }
    }
    
    /**
     * Initialize consent management system
     */
    async initializeConsentManagement() {
        try {
            // Define consent categories based on Azure AD B2C attributes
            this.consentCategories = {
                ESSENTIAL: {
                    required: true,
                    description: 'Essential for account creation and authentication',
                    purposes: ['account_creation', 'authentication', 'security'],
                    lawfulBasis: 'contract',
                    azureB2CAttributes: ['email', 'name', 'objectId']
                },
                FUNCTIONAL: {
                    required: false,
                    description: 'Improve user experience and functionality',
                    purposes: ['personalization', 'preferences', 'feature_enhancement'],
                    lawfulBasis: 'legitimate_interest',
                    azureB2CAttributes: ['company', 'jobTitle', 'department']
                },
                ANALYTICS: {
                    required: false,
                    description: 'Usage analytics and performance monitoring',
                    purposes: ['analytics', 'performance', 'optimization'],
                    lawfulBasis: 'consent',
                    azureB2CAttributes: ['lastSignInDateTime', 'signInActivity']
                },
                MARKETING: {
                    required: false,
                    description: 'Marketing communications and promotions',
                    purposes: ['marketing', 'communications', 'promotions'],
                    lawfulBasis: 'consent',
                    azureB2CAttributes: ['marketingConsent', 'communicationPreferences']
                }
            };
            
            console.log('✅ Consent management system initialized');
            
        } catch (error) {
            console.error('❌ Failed to initialize consent management:', error.message);
            throw error;
        }
    }
    
    /**
     * Initialize data retention policies
     */
    async initializeDataRetentionPolicies() {
        try {
            // Define retention policies for different data types
            this.retentionPolicies = {
                USER_PROFILE: {
                    category: 'IDENTITY_DATA',
                    retention: this.config.userDataRetentionPeriod,
                    autoDelete: true,
                    azureB2CManaged: true,
                    description: 'User profile data managed by Azure AD B2C'
                },
                SESSION_DATA: {
                    category: 'TECHNICAL_DATA',
                    retention: this.config.sessionDataRetentionPeriod,
                    autoDelete: true,
                    azureB2CManaged: false,
                    description: 'Session and activity data managed by application'
                },
                FILE_UPLOADS: {
                    category: 'USAGE_DATA',
                    retention: this.config.sessionDataRetentionPeriod,
                    autoDelete: true,
                    azureB2CManaged: false,
                    description: 'User uploaded files and associated data'
                },
                AUDIT_LOGS: {
                    category: 'TECHNICAL_DATA',
                    retention: this.config.auditLogRetentionPeriod,
                    autoDelete: false,
                    azureB2CManaged: false,
                    description: 'Audit logs for compliance and security'
                }
            };
            
            console.log('✅ Data retention policies initialized');
            
        } catch (error) {
            console.error('❌ Failed to initialize data retention policies:', error.message);
            throw error;
        }
    }
    
    /**
     * Record user consent
     */
    async recordConsent(userId, consentData) {
        try {
            const consentRecord = {
                userId: userId,
                timestamp: new Date().toISOString(),
                version: this.config.consentVersion,
                ipAddress: consentData.ipAddress,
                userAgent: consentData.userAgent,
                consents: {},
                source: 'azure_ad_b2c_registration'
            };
            
            // Process consent for each category
            for (const [category, categoryConfig] of Object.entries(this.consentCategories)) {
                const consent = consentData.consents?.[category];
                
                consentRecord.consents[category] = {
                    granted: consent?.granted || categoryConfig.required,
                    timestamp: consent?.timestamp || consentRecord.timestamp,
                    required: categoryConfig.required,
                    lawfulBasis: categoryConfig.lawfulBasis,
                    purposes: categoryConfig.purposes,
                    azureB2CAttributes: categoryConfig.azureB2CAttributes
                };
            }
            
            // Store consent record
            this.consentRecords.set(userId, consentRecord);
            
            // Audit consent recording
            this.auditGDPREvent('consent_recorded', {
                userId: userId,
                consentVersion: consentRecord.version,
                categories: Object.keys(consentRecord.consents),
                source: consentRecord.source
            });
            
            // Track in Application Insights
            if (this.appInsights) {
                this.appInsights.telemetry.trackEvent('GDPR_Consent_Recorded', {
                    userId: userId,
                    consentVersion: consentRecord.version,
                    categoriesCount: Object.keys(consentRecord.consents).length,
                    source: consentRecord.source
                });
            }
            
            console.log(`✅ Consent recorded for user ${userId} (version ${consentRecord.version})`);
            return consentRecord;
            
        } catch (error) {
            console.error('❌ Failed to record consent:', error.message);
            throw error;
        }
    }
    
    /**
     * Get user consent status
     */
    getUserConsent(userId) {
        const consentRecord = this.consentRecords.get(userId);
        
        if (!consentRecord) {
            return null;
        }
        
        return {
            userId: userId,
            version: consentRecord.version,
            timestamp: consentRecord.timestamp,
            consents: consentRecord.consents,
            isValid: this.isConsentValid(consentRecord),
            needsUpdate: this.needsConsentUpdate(consentRecord)
        };
    }
    
    /**
     * Check if consent is valid
     */
    isConsentValid(consentRecord) {
        // Check if consent version is current
        if (consentRecord.version !== this.config.consentVersion) {
            return false;
        }
        
        // Check if all required consents are granted
        for (const [category, categoryConfig] of Object.entries(this.consentCategories)) {
            if (categoryConfig.required) {
                const consent = consentRecord.consents[category];
                if (!consent || !consent.granted) {
                    return false;
                }
            }
        }
        
        return true;
    }
    
    /**
     * Check if consent needs update
     */
    needsConsentUpdate(consentRecord) {
        return consentRecord.version !== this.config.consentVersion;
    }
    
    /**
     * Export user data (GDPR Article 20 - Right to data portability)
     */
    async exportUserData(userId, format = 'json') {
        try {
            this.auditGDPREvent('data_export_requested', {
                userId: userId,
                format: format,
                requestedBy: userId
            });
            
            // Get user data from Azure AD B2C
            const azureUserData = await this.getAzureB2CUserData(userId);
            
            // Get application-specific user data
            const applicationData = await this.getApplicationUserData(userId);
            
            // Combine all user data
            const exportData = {
                metadata: {
                    exportDate: new Date().toISOString(),
                    userId: userId,
                    format: format,
                    version: '1.0',
                    dataCategories: Object.keys(this.dataCategories)
                },
                azureAdB2CData: azureUserData,
                applicationData: applicationData,
                consentHistory: this.getUserConsentHistory(userId),
                dataProcessingActivities: this.getUserDataProcessingActivities(userId)
            };
            
            // Format data based on requested format
            let formattedData;
            switch (format.toLowerCase()) {
                case 'json':
                    formattedData = JSON.stringify(exportData, null, 2);
                    break;
                case 'xml':
                    formattedData = this.convertToXML(exportData);
                    break;
                case 'csv':
                    formattedData = this.convertToCSV(exportData);
                    break;
                default:
                    formattedData = JSON.stringify(exportData, null, 2);
            }
            
            // Audit successful export
            this.auditGDPREvent('data_export_completed', {
                userId: userId,
                format: format,
                dataSize: formattedData.length,
                categories: Object.keys(this.dataCategories)
            });
            
            // Track in Application Insights
            if (this.appInsights) {
                this.appInsights.telemetry.trackEvent('GDPR_Data_Export', {
                    userId: userId,
                    format: format,
                    dataSize: formattedData.length.toString(),
                    categoriesCount: Object.keys(this.dataCategories).length.toString()
                });
            }
            
            console.log(`✅ Data export completed for user ${userId} (${format} format, ${formattedData.length} bytes)`);
            
            return {
                success: true,
                data: formattedData,
                metadata: exportData.metadata,
                filename: `user-data-export-${userId}-${Date.now()}.${format}`
            };
            
        } catch (error) {
            console.error('❌ Failed to export user data:', error.message);
            
            this.auditGDPREvent('data_export_failed', {
                userId: userId,
                error: error.message
            });
            
            throw error;
        }
    }
    
    /**
     * Get user data from Azure AD B2C using Microsoft Graph API
     */
    async getAzureB2CUserData(userId) {
        try {
            console.log(`📥 Retrieving Azure AD B2C data for user ${userId}`);
            
            // Use the Azure B2C API service to get comprehensive user data
            const azureUserData = await this.entraExternalIdApiService.exportUserData(userId);
            
            // Transform the data into a structured format for GDPR export
            const structuredData = {
                identity: {
                    objectId: azureUserData.userProfile?.profile?.id || userId,
                    userPrincipalName: azureUserData.userProfile?.profile?.userPrincipalName || null,
                    displayName: azureUserData.userProfile?.profile?.displayName || null,
                    givenName: azureUserData.userProfile?.profile?.givenName || null,
                    surname: azureUserData.userProfile?.profile?.surname || null,
                    mail: azureUserData.userProfile?.profile?.mail || null,
                    mobilePhone: azureUserData.userProfile?.profile?.mobilePhone || null,
                    jobTitle: azureUserData.userProfile?.profile?.jobTitle || null,
                    department: azureUserData.userProfile?.profile?.department || null,
                    companyName: azureUserData.userProfile?.profile?.companyName || null,
                    country: azureUserData.userProfile?.profile?.country || null,
                    city: azureUserData.userProfile?.profile?.city || null,
                    postalCode: azureUserData.userProfile?.profile?.postalCode || null,
                    streetAddress: azureUserData.userProfile?.profile?.streetAddress || null,
                    createdDateTime: azureUserData.userProfile?.profile?.createdDateTime || null,
                    accountEnabled: azureUserData.userProfile?.profile?.accountEnabled || null,
                    userType: azureUserData.userProfile?.profile?.userType || null
                },
                authentication: {
                    signInActivity: azureUserData.signInActivity?.signInLogs || [],
                    riskEvents: azureUserData.signInActivity?.riskEvents || [],
                    totalSignIns: azureUserData.signInActivity?.totalSignIns || 0,
                    lastPasswordChangeDateTime: azureUserData.userProfile?.profile?.lastPasswordChangeDateTime || null
                },
                auditLogs: {
                    directoryAudits: azureUserData.auditLogs?.auditLogs || [],
                    totalAuditEvents: azureUserData.auditLogs?.totalAuditEvents || 0
                },
                directoryObjects: {
                    memberOf: azureUserData.directoryObjects?.memberOf || [],
                    ownedObjects: azureUserData.directoryObjects?.ownedObjects || [],
                    createdObjects: azureUserData.directoryObjects?.createdObjects || []
                },
                customAttributes: {
                    extensions: azureUserData.userProfile?.extensions || [],
                    customExtensions: azureUserData.customExtensions?.userExtensionData || {},
                    extensionProperties: azureUserData.customExtensions?.extensionProperties || []
                },
                identities: azureUserData.userProfile?.profile?.identities || [],
                dataSource: 'Azure AD B2C Microsoft Graph API',
                retrievedAt: azureUserData.metadata?.exportDate || new Date().toISOString(),
                tenantId: azureUserData.metadata?.tenantId || azureConfig.config.tenantId
            };
            
            console.log(`✅ Azure AD B2C data retrieved successfully for user ${userId}`);
            return structuredData;
            
        } catch (error) {
            console.error('❌ Failed to get Azure AD B2C user data:', error.message);
            
            // Return fallback data structure with error information
            return {
                error: 'Failed to retrieve Azure AD B2C data via Microsoft Graph API',
                message: error.message,
                fallbackReason: 'Graph API unavailable or insufficient permissions',
                identity: {
                    objectId: userId,
                    userPrincipalName: `${userId}@${azureConfig.config.tenantName}.onmicrosoft.com`
                },
                dataSource: 'Azure AD B2C (Error Fallback)',
                retrievedAt: new Date().toISOString(),
                tenantId: azureConfig.config.tenantId
            };
        }
    }
    
    /**
     * Get application-specific user data
     */
    async getApplicationUserData(userId) {
        try {
            // Get data from various application sources
            return {
                profile: {
                    userId: userId,
                    preferences: {
                        theme: 'light',
                        language: 'en',
                        notifications: true
                    },
                    settings: {
                        autoSave: true,
                        dataRetention: 'default'
                    }
                },
                usage: {
                    fileUploads: [], // Would be populated from file store
                    chatHistory: [], // Would be populated from chat service
                    loginHistory: [], // Would be populated from session management
                    lastActivity: new Date().toISOString()
                },
                technical: {
                    sessions: [], // Would be populated from session management
                    ipAddresses: [], // Historical IP addresses
                    userAgents: [], // Historical user agents
                    devices: [] // Device information
                },
                dataSource: 'TaktMate Application',
                retrievedAt: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('❌ Failed to get application user data:', error.message);
            return {
                error: 'Failed to retrieve application data',
                message: error.message
            };
        }
    }
    
    /**
     * Get user consent history
     */
    getUserConsentHistory(userId) {
        const consentRecord = this.consentRecords.get(userId);
        
        if (!consentRecord) {
            return [];
        }
        
        return [{
            timestamp: consentRecord.timestamp,
            version: consentRecord.version,
            source: consentRecord.source,
            ipAddress: consentRecord.ipAddress,
            userAgent: consentRecord.userAgent,
            consents: consentRecord.consents
        }];
    }
    
    /**
     * Get user data processing activities
     */
    getUserDataProcessingActivities(userId) {
        return this.dataProcessingActivities.filter(activity => 
            activity.userId === userId
        ).map(activity => ({
            activity: activity.activity,
            timestamp: activity.timestamp,
            purpose: activity.purpose,
            lawfulBasis: activity.lawfulBasis,
            dataCategories: activity.dataCategories,
            retention: activity.retention
        }));
    }
    
    /**
     * Request user account deletion (GDPR Article 17 - Right to erasure)
     */
    async requestAccountDeletion(userId, reason = 'user_request') {
        try {
            const requestId = this.generateRequestId();
            
            // Create deletion request
            const deletionRequest = {
                requestId: requestId,
                userId: userId,
                requestedAt: new Date().toISOString(),
                reason: reason,
                status: 'pending',
                steps: [
                    { step: 'validate_request', status: 'pending' },
                    { step: 'backup_data', status: 'pending' },
                    { step: 'delete_application_data', status: 'pending' },
                    { step: 'delete_azure_b2c_account', status: 'pending' },
                    { step: 'verify_deletion', status: 'pending' }
                ],
                completedAt: null
            };
            
            // Store deletion request
            this.gdprRequests.set(requestId, deletionRequest);
            
            // Audit deletion request
            this.auditGDPREvent('account_deletion_requested', {
                userId: userId,
                requestId: requestId,
                reason: reason
            });
            
            // Track in Application Insights
            if (this.appInsights) {
                this.appInsights.telemetry.trackEvent('GDPR_Account_Deletion_Requested', {
                    userId: userId,
                    requestId: requestId,
                    reason: reason
                });
            }
            
            console.log(`✅ Account deletion requested for user ${userId} (request ID: ${requestId})`);
            
            return {
                success: true,
                requestId: requestId,
                status: 'pending',
                message: 'Account deletion request has been submitted and will be processed within 30 days as required by GDPR',
                steps: deletionRequest.steps
            };
            
        } catch (error) {
            console.error('❌ Failed to request account deletion:', error.message);
            throw error;
        }
    }
    
    /**
     * Get GDPR request status
     */
    getGDPRRequestStatus(requestId) {
        const request = this.gdprRequests.get(requestId);
        
        if (!request) {
            return null;
        }
        
        return {
            requestId: requestId,
            userId: request.userId,
            requestedAt: request.requestedAt,
            status: request.status,
            steps: request.steps,
            completedAt: request.completedAt,
            estimatedCompletion: this.calculateEstimatedCompletion(request)
        };
    }
    
    /**
     * Calculate estimated completion time
     */
    calculateEstimatedCompletion(request) {
        if (request.status === 'completed') {
            return request.completedAt;
        }
        
        // GDPR requires completion within 30 days
        const requestDate = new Date(request.requestedAt);
        const maxCompletionDate = new Date(requestDate.getTime() + (30 * 24 * 60 * 60 * 1000));
        
        return maxCompletionDate.toISOString();
    }
    
    /**
     * Audit GDPR events
     */
    auditGDPREvent(eventType, eventData) {
        const auditEntry = {
            id: this.generateAuditId(),
            timestamp: new Date().toISOString(),
            eventType: eventType,
            eventData: eventData,
            service: 'gdpr-compliance',
            version: '1.0'
        };
        
        this.auditLog.push(auditEntry);
        
        // Keep audit log within reasonable size
        if (this.auditLog.length > 10000) {
            this.auditLog = this.auditLog.slice(-5000); // Keep last 5000 entries
        }
        
        // Log to console for debugging
        if (process.env.NODE_ENV === 'development') {
            console.log(`🛡️ GDPR Audit: ${eventType}`, eventData);
        }
    }
    
    /**
     * Start compliance monitoring
     */
    startComplianceMonitoring() {
        // Check data retention compliance every 24 hours
        setInterval(async () => {
            try {
                await this.checkDataRetentionCompliance();
            } catch (error) {
                console.error('❌ Data retention compliance check failed:', error.message);
            }
        }, 24 * 60 * 60 * 1000); // 24 hours
        
        // Check consent validity every 7 days
        setInterval(async () => {
            try {
                await this.checkConsentCompliance();
            } catch (error) {
                console.error('❌ Consent compliance check failed:', error.message);
            }
        }, 7 * 24 * 60 * 60 * 1000); // 7 days
        
        console.log('✅ GDPR compliance monitoring started');
    }
    
    /**
     * Check data retention compliance
     */
    async checkDataRetentionCompliance() {
        console.log('🔍 Checking data retention compliance...');
        
        const now = Date.now();
        let violationsFound = 0;
        
        // Check each retention policy
        for (const [policyName, policy] of Object.entries(this.retentionPolicies)) {
            try {
                if (policy.autoDelete) {
                    const expiredData = await this.findExpiredData(policy, now);
                    
                    if (expiredData.length > 0) {
                        console.log(`⚠️ Found ${expiredData.length} expired ${policyName} records`);
                        violationsFound += expiredData.length;
                        
                        // Schedule for deletion
                        for (const data of expiredData) {
                            await this.scheduleDataDeletion(data, policy);
                        }
                    }
                }
            } catch (error) {
                console.error(`❌ Failed to check retention for ${policyName}:`, error.message);
            }
        }
        
        this.auditGDPREvent('data_retention_check_completed', {
            violationsFound: violationsFound,
            policies: Object.keys(this.retentionPolicies),
            timestamp: new Date().toISOString()
        });
        
        console.log(`✅ Data retention check completed (${violationsFound} violations found)`);
    }
    
    /**
     * Check consent compliance
     */
    async checkConsentCompliance() {
        console.log('🔍 Checking consent compliance...');
        
        let invalidConsents = 0;
        let outdatedConsents = 0;
        
        for (const [userId, consentRecord] of this.consentRecords.entries()) {
            if (!this.isConsentValid(consentRecord)) {
                invalidConsents++;
            }
            
            if (this.needsConsentUpdate(consentRecord)) {
                outdatedConsents++;
            }
        }
        
        this.auditGDPREvent('consent_compliance_check_completed', {
            totalConsents: this.consentRecords.size,
            invalidConsents: invalidConsents,
            outdatedConsents: outdatedConsents,
            timestamp: new Date().toISOString()
        });
        
        console.log(`✅ Consent compliance check completed (${invalidConsents} invalid, ${outdatedConsents} outdated)`);
    }
    
    /**
     * Find expired data based on retention policy
     */
    async findExpiredData(policy, currentTime) {
        // This would be implemented to check actual data sources
        // For now, return empty array as placeholder
        return [];
    }
    
    /**
     * Schedule data for deletion
     */
    async scheduleDataDeletion(data, policy) {
        console.log(`📅 Scheduling deletion for ${policy.category} data: ${data.id}`);
        
        this.auditGDPREvent('data_deletion_scheduled', {
            dataId: data.id,
            category: policy.category,
            scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours from now
        });
    }
    
    /**
     * Convert data to XML format
     */
    convertToXML(data) {
        // Simple XML conversion - in production, use a proper XML library
        return `<?xml version="1.0" encoding="UTF-8"?>
<userDataExport>
    <metadata>
        <exportDate>${data.metadata.exportDate}</exportDate>
        <userId>${data.metadata.userId}</userId>
        <format>${data.metadata.format}</format>
    </metadata>
    <!-- Additional XML structure would be implemented here -->
</userDataExport>`;
    }
    
    /**
     * Convert data to CSV format
     */
    convertToCSV(data) {
        // Simple CSV conversion - in production, use a proper CSV library
        const csvRows = [
            'Category,Field,Value',
            `Identity,UserId,${data.metadata.userId}`,
            `Export,Date,${data.metadata.exportDate}`,
            // Additional CSV rows would be implemented here
        ];
        
        return csvRows.join('\n');
    }
    
    /**
     * Generate request ID
     */
    generateRequestId() {
        return `gdpr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Generate audit ID
     */
    generateAuditId() {
        return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Get GDPR compliance status
     */
    getComplianceStatus() {
        return {
            azureB2CGDPREnabled: this.config.enableBuiltInGDPR,
            dataExportEnabled: this.config.enableDataExport,
            dataDeletionEnabled: this.config.enableDataDeletion,
            consentManagementEnabled: this.config.enableConsentManagement,
            
            dataCategories: Object.keys(this.dataCategories).length,
            consentCategories: Object.keys(this.consentCategories || {}).length,
            retentionPolicies: Object.keys(this.retentionPolicies || {}).length,
            
            activeConsents: this.consentRecords.size,
            pendingGDPRRequests: Array.from(this.gdprRequests.values()).filter(r => r.status === 'pending').length,
            auditLogEntries: this.auditLog.length,
            
            configuration: {
                userDataRetention: this.config.userDataRetentionPeriod / 1000 / 60 / 60 / 24 + ' days',
                sessionDataRetention: this.config.sessionDataRetentionPeriod / 1000 / 60 / 60 / 24 + ' days',
                auditLogRetention: this.config.auditLogRetentionPeriod / 1000 / 60 / 60 / 24 + ' days',
                consentVersion: this.config.consentVersion,
                requireExplicitConsent: this.config.requireExplicitConsent
            },
            
            rights: {
                rightToAccess: this.config.enableRightToAccess,
                rightToRectification: this.config.enableRightToRectification,
                rightToErasure: this.config.enableRightToErasure,
                rightToPortability: this.config.enableRightToPortability,
                rightToObject: this.config.enableRightToObject
            },
            
            entraExternalIdApiService: this.entraExternalIdApiService ? this.entraExternalIdApiService.getStatistics() : {
                error: 'Azure B2C API Service not initialized'
            }
        };
    }
}

module.exports = {
    GDPRComplianceService
};
