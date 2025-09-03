// TaktMate Azure AD B2C API Service
// Integrates with Microsoft Graph API for comprehensive user data export using Azure AD B2C APIs

const axios = require('axios');
const { ClientCredentialFlow } = require('@azure/msal-node');
const { config: azureConfig } = require('../config/azureAdB2C');

/**
 * Azure AD B2C API Service
 * Provides comprehensive user data export functionality using Microsoft Graph API
 */
class AzureB2CApiService {
    constructor(appInsights = null) {
        this.appInsights = appInsights;
        
        // Microsoft Graph API configuration
        this.config = {
            // Microsoft Graph API endpoints
            graphApiBaseUrl: 'https://graph.microsoft.com/v1.0',
            graphApiBetaUrl: 'https://graph.microsoft.com/beta',
            
            // Azure AD B2C specific endpoints
            tenantId: azureConfig.config.tenantId,
            clientId: azureConfig.config.clientId,
            clientSecret: azureConfig.config.clientSecret,
            
            // Authentication configuration
            authority: `https://login.microsoftonline.com/${azureConfig.config.tenantId}`,
            scope: 'https://graph.microsoft.com/.default',
            
            // API request configuration
            requestTimeout: parseInt(process.env.GRAPH_API_TIMEOUT) || 30000, // 30 seconds
            maxRetries: parseInt(process.env.GRAPH_API_MAX_RETRIES) || 3,
            retryDelay: parseInt(process.env.GRAPH_API_RETRY_DELAY) || 1000, // 1 second
            
            // Data export configuration
            enableUserProfile: process.env.ENABLE_USER_PROFILE_EXPORT !== 'false',
            enableSignInActivity: process.env.ENABLE_SIGNIN_ACTIVITY_EXPORT !== 'false',
            enableAuditLogs: process.env.ENABLE_AUDIT_LOGS_EXPORT !== 'false',
            enableDirectoryObjects: process.env.ENABLE_DIRECTORY_OBJECTS_EXPORT !== 'false',
            
            // Export limits and pagination
            maxRecordsPerRequest: parseInt(process.env.MAX_RECORDS_PER_REQUEST) || 999,
            maxTotalRecords: parseInt(process.env.MAX_TOTAL_RECORDS) || 10000,
            enablePagination: process.env.ENABLE_PAGINATION !== 'false',
            
            // Security and privacy settings
            enableDataSanitization: process.env.ENABLE_DATA_SANITIZATION !== 'false',
            excludeSensitiveData: process.env.EXCLUDE_SENSITIVE_DATA !== 'false',
            enableFieldFiltering: process.env.ENABLE_FIELD_FILTERING !== 'false',
            
            // Caching configuration
            enableCaching: process.env.ENABLE_GRAPH_API_CACHING !== 'false',
            cacheTtl: parseInt(process.env.GRAPH_API_CACHE_TTL) || 5 * 60 * 1000, // 5 minutes
            cacheMaxSize: parseInt(process.env.GRAPH_API_CACHE_MAX_SIZE) || 1000
        };
        
        // Access token management
        this.accessToken = null;
        this.tokenExpiresAt = null;
        this.tokenRefreshPromise = null;
        
        // Request cache
        this.requestCache = new Map();
        this.lastCacheCleanup = Date.now();
        
        // API statistics
        this.apiStats = {
            requestsTotal: 0,
            requestsSuccessful: 0,
            requestsFailed: 0,
            cacheHits: 0,
            cacheMisses: 0,
            dataExportsCompleted: 0,
            averageResponseTime: 0,
            totalResponseTime: 0
        };
        
        console.log('🔗 Azure AD B2C API Service initialized');
        console.log(`   Graph API Base URL: ${this.config.graphApiBaseUrl}`);
        console.log(`   Tenant ID: ${this.config.tenantId ? this.config.tenantId.substring(0, 8) + '...' : 'Not configured'}`);
        console.log(`   User Profile Export: ${this.config.enableUserProfile ? '✅' : '❌'}`);
        console.log(`   Sign-in Activity Export: ${this.config.enableSignInActivity ? '✅' : '❌'}`);
        console.log(`   Audit Logs Export: ${this.config.enableAuditLogs ? '✅' : '❌'}`);
    }
    
    /**
     * Initialize the service and authenticate with Microsoft Graph API
     */
    async initialize() {
        try {
            // Validate configuration
            this.validateConfiguration();
            
            // Get initial access token
            await this.getAccessToken();
            
            // Test API connectivity
            await this.testApiConnectivity();
            
            console.log('✅ Azure AD B2C API Service initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize Azure AD B2C API Service:', error.message);
            throw error;
        }
    }
    
    /**
     * Validate service configuration
     */
    validateConfiguration() {
        const requiredConfig = [
            'tenantId',
            'clientId',
            'clientSecret'
        ];
        
        const missingConfig = requiredConfig.filter(key => !this.config[key]);
        
        if (missingConfig.length > 0) {
            throw new Error(`Missing required Azure AD B2C API configuration: ${missingConfig.join(', ')}`);
        }
        
        // Validate tenant ID format (GUID)
        const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!guidRegex.test(this.config.tenantId)) {
            throw new Error('Invalid tenant ID format. Expected GUID format.');
        }
        
        console.log('✅ Azure AD B2C API configuration validated');
    }
    
    /**
     * Get access token for Microsoft Graph API using client credentials flow
     */
    async getAccessToken() {
        try {
            // Check if token is still valid
            if (this.accessToken && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt - 60000) {
                return this.accessToken;
            }
            
            // Prevent multiple concurrent token refresh requests
            if (this.tokenRefreshPromise) {
                return await this.tokenRefreshPromise;
            }
            
            this.tokenRefreshPromise = this.refreshAccessToken();
            const result = await this.tokenRefreshPromise;
            this.tokenRefreshPromise = null;
            
            return result;
            
        } catch (error) {
            this.tokenRefreshPromise = null;
            console.error('❌ Failed to get access token:', error.message);
            throw error;
        }
    }
    
    /**
     * Refresh access token
     */
    async refreshAccessToken() {
        try {
            const tokenUrl = `${this.config.authority}/oauth2/v2.0/token`;
            
            const tokenData = new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: this.config.clientId,
                client_secret: this.config.clientSecret,
                scope: this.config.scope
            });
            
            const response = await axios.post(tokenUrl, tokenData, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                timeout: this.config.requestTimeout
            });
            
            if (response.status !== 200) {
                throw new Error(`Token request failed with status ${response.status}`);
            }
            
            const tokenResponse = response.data;
            
            this.accessToken = tokenResponse.access_token;
            this.tokenExpiresAt = Date.now() + (tokenResponse.expires_in * 1000);
            
            console.log('✅ Microsoft Graph API access token refreshed');
            
            // Track token refresh in Application Insights
            if (this.appInsights) {
                this.appInsights.telemetry.trackEvent('Graph_API_Token_Refreshed', {
                    tenantId: this.config.tenantId,
                    expiresIn: tokenResponse.expires_in.toString()
                });
            }
            
            return this.accessToken;
            
        } catch (error) {
            console.error('❌ Failed to refresh access token:', error.message);
            throw new Error(`Microsoft Graph API authentication failed: ${error.message}`);
        }
    }
    
    /**
     * Test API connectivity
     */
    async testApiConnectivity() {
        try {
            const response = await this.makeGraphApiRequest('GET', '/organization');
            
            if (response && response.value && response.value.length > 0) {
                console.log('✅ Microsoft Graph API connectivity test successful');
                return true;
            } else {
                throw new Error('Unexpected response format from Graph API');
            }
            
        } catch (error) {
            console.error('❌ Microsoft Graph API connectivity test failed:', error.message);
            throw error;
        }
    }
    
    /**
     * Make authenticated request to Microsoft Graph API
     */
    async makeGraphApiRequest(method, endpoint, options = {}) {
        const startTime = Date.now();
        let attempt = 0;
        
        while (attempt < this.config.maxRetries) {
            try {
                attempt++;
                
                // Check cache first for GET requests
                if (method === 'GET' && this.config.enableCaching) {
                    const cacheKey = this.generateCacheKey(method, endpoint, options);
                    const cached = this.requestCache.get(cacheKey);
                    
                    if (cached && cached.expiresAt > Date.now()) {
                        this.apiStats.cacheHits++;
                        return cached.data;
                    }
                    this.apiStats.cacheMisses++;
                }
                
                // Get access token
                const accessToken = await this.getAccessToken();
                
                // Prepare request configuration
                const url = endpoint.startsWith('http') ? endpoint : `${this.config.graphApiBaseUrl}${endpoint}`;
                const config = {
                    method: method,
                    url: url,
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                        'ConsistencyLevel': 'eventual', // Required for some advanced queries
                        ...options.headers
                    },
                    timeout: this.config.requestTimeout,
                    ...options
                };
                
                // Add request body for POST/PUT/PATCH requests
                if (options.data && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
                    config.data = options.data;
                }
                
                // Add query parameters
                if (options.params) {
                    config.params = options.params;
                }
                
                const response = await axios(config);
                const responseTime = Date.now() - startTime;
                
                // Update statistics
                this.apiStats.requestsTotal++;
                this.apiStats.requestsSuccessful++;
                this.apiStats.totalResponseTime += responseTime;
                this.apiStats.averageResponseTime = Math.round(this.apiStats.totalResponseTime / this.apiStats.requestsTotal);
                
                // Cache successful GET responses
                if (method === 'GET' && this.config.enableCaching && response.status === 200) {
                    const cacheKey = this.generateCacheKey(method, endpoint, options);
                    this.requestCache.set(cacheKey, {
                        data: response.data,
                        expiresAt: Date.now() + this.config.cacheTtl
                    });
                    
                    // Clean up cache if needed
                    if (Date.now() - this.lastCacheCleanup > this.config.cacheTtl) {
                        this.cleanupCache();
                    }
                }
                
                // Track successful request in Application Insights
                if (this.appInsights) {
                    this.appInsights.telemetry.trackDependency(
                        'Microsoft Graph API',
                        endpoint,
                        `${method} ${endpoint}`,
                        Date.now() - responseTime,
                        responseTime,
                        true
                    );
                }
                
                return response.data;
                
            } catch (error) {
                console.error(`❌ Graph API request attempt ${attempt} failed:`, error.message);
                
                // Update statistics
                this.apiStats.requestsTotal++;
                this.apiStats.requestsFailed++;
                
                // Track failed request in Application Insights
                if (this.appInsights) {
                    this.appInsights.telemetry.trackDependency(
                        'Microsoft Graph API',
                        endpoint,
                        `${method} ${endpoint}`,
                        Date.now() - (Date.now() - startTime),
                        Date.now() - startTime,
                        false
                    );
                }
                
                // Check if error is retryable
                if (!this.isRetryableError(error) || attempt >= this.config.maxRetries) {
                    throw new Error(`Microsoft Graph API request failed after ${attempt} attempts: ${error.message}`);
                }
                
                // Wait before retry
                if (attempt < this.config.maxRetries) {
                    await this.delay(this.config.retryDelay * attempt);
                }
            }
        }
    }
    
    /**
     * Export comprehensive user data from Azure AD B2C
     */
    async exportUserData(userId, options = {}) {
        try {
            console.log(`📤 Starting comprehensive data export for user ${userId}`);
            
            const exportData = {
                metadata: {
                    exportDate: new Date().toISOString(),
                    userId: userId,
                    tenantId: this.config.tenantId,
                    exportedBy: 'Azure AD B2C API Service',
                    version: '2.0'
                },
                userProfile: null,
                signInActivity: null,
                auditLogs: null,
                directoryObjects: null,
                customExtensions: null
            };
            
            // Export user profile data
            if (this.config.enableUserProfile) {
                try {
                    exportData.userProfile = await this.exportUserProfile(userId);
                    console.log('✅ User profile data exported');
                } catch (error) {
                    console.error('❌ Failed to export user profile:', error.message);
                    exportData.userProfile = { error: error.message };
                }
            }
            
            // Export sign-in activity
            if (this.config.enableSignInActivity) {
                try {
                    exportData.signInActivity = await this.exportSignInActivity(userId);
                    console.log('✅ Sign-in activity data exported');
                } catch (error) {
                    console.error('❌ Failed to export sign-in activity:', error.message);
                    exportData.signInActivity = { error: error.message };
                }
            }
            
            // Export audit logs
            if (this.config.enableAuditLogs) {
                try {
                    exportData.auditLogs = await this.exportAuditLogs(userId);
                    console.log('✅ Audit logs data exported');
                } catch (error) {
                    console.error('❌ Failed to export audit logs:', error.message);
                    exportData.auditLogs = { error: error.message };
                }
            }
            
            // Export directory objects
            if (this.config.enableDirectoryObjects) {
                try {
                    exportData.directoryObjects = await this.exportDirectoryObjects(userId);
                    console.log('✅ Directory objects data exported');
                } catch (error) {
                    console.error('❌ Failed to export directory objects:', error.message);
                    exportData.directoryObjects = { error: error.message };
                }
            }
            
            // Export custom extensions
            try {
                exportData.customExtensions = await this.exportCustomExtensions(userId);
                console.log('✅ Custom extensions data exported');
            } catch (error) {
                console.error('❌ Failed to export custom extensions:', error.message);
                exportData.customExtensions = { error: error.message };
            }
            
            // Sanitize data if enabled
            if (this.config.enableDataSanitization) {
                exportData = this.sanitizeExportData(exportData);
            }
            
            // Update statistics
            this.apiStats.dataExportsCompleted++;
            
            // Track successful export in Application Insights
            if (this.appInsights) {
                this.appInsights.telemetry.trackEvent('Azure_B2C_Data_Export_Completed', {
                    userId: userId,
                    tenantId: this.config.tenantId,
                    profileExported: exportData.userProfile ? 'true' : 'false',
                    signInActivityExported: exportData.signInActivity ? 'true' : 'false',
                    auditLogsExported: exportData.auditLogs ? 'true' : 'false',
                    directoryObjectsExported: exportData.directoryObjects ? 'true' : 'false'
                });
            }
            
            console.log(`✅ Comprehensive data export completed for user ${userId}`);
            return exportData;
            
        } catch (error) {
            console.error('❌ Failed to export user data:', error.message);
            
            // Track failed export in Application Insights
            if (this.appInsights) {
                this.appInsights.telemetry.trackEvent('Azure_B2C_Data_Export_Failed', {
                    userId: userId,
                    error: error.message
                });
            }
            
            throw error;
        }
    }
    
    /**
     * Export user profile data
     */
    async exportUserProfile(userId) {
        try {
            const userEndpoint = `/users/${userId}`;
            const selectFields = [
                'id',
                'userPrincipalName',
                'displayName',
                'givenName',
                'surname',
                'mail',
                'mobilePhone',
                'jobTitle',
                'department',
                'companyName',
                'country',
                'city',
                'postalCode',
                'streetAddress',
                'createdDateTime',
                'lastPasswordChangeDateTime',
                'passwordProfile',
                'accountEnabled',
                'userType',
                'identities'
            ];
            
            const userProfile = await this.makeGraphApiRequest('GET', userEndpoint, {
                params: {
                    '$select': selectFields.join(',')
                }
            });
            
            // Get user's custom attributes (extensions)
            const extensionsEndpoint = `/users/${userId}/extensions`;
            let extensions = [];
            
            try {
                const extensionsResponse = await this.makeGraphApiRequest('GET', extensionsEndpoint);
                extensions = extensionsResponse.value || [];
            } catch (error) {
                console.warn('⚠️ Failed to retrieve user extensions:', error.message);
            }
            
            return {
                profile: userProfile,
                extensions: extensions,
                retrievedAt: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('❌ Failed to export user profile:', error.message);
            throw error;
        }
    }
    
    /**
     * Export user sign-in activity
     */
    async exportSignInActivity(userId) {
        try {
            // Get sign-in logs for the user
            const signInLogsEndpoint = '/auditLogs/signIns';
            const filter = `userId eq '${userId}'`;
            const orderBy = 'createdDateTime desc';
            const top = this.config.maxRecordsPerRequest;
            
            const signInLogs = await this.makeGraphApiRequest('GET', signInLogsEndpoint, {
                params: {
                    '$filter': filter,
                    '$orderby': orderBy,
                    '$top': top
                }
            });
            
            // Get user risk events
            let riskEvents = [];
            try {
                const riskEventsEndpoint = '/identityProtection/riskDetections';
                const riskFilter = `userId eq '${userId}'`;
                
                const riskResponse = await this.makeGraphApiRequest('GET', riskEventsEndpoint, {
                    params: {
                        '$filter': riskFilter,
                        '$orderby': 'detectedDateTime desc',
                        '$top': this.config.maxRecordsPerRequest
                    }
                });
                
                riskEvents = riskResponse.value || [];
            } catch (error) {
                console.warn('⚠️ Failed to retrieve risk events:', error.message);
            }
            
            return {
                signInLogs: signInLogs.value || [],
                riskEvents: riskEvents,
                totalSignIns: signInLogs['@odata.count'] || signInLogs.value?.length || 0,
                retrievedAt: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('❌ Failed to export sign-in activity:', error.message);
            throw error;
        }
    }
    
    /**
     * Export audit logs related to the user
     */
    async exportAuditLogs(userId) {
        try {
            const auditLogsEndpoint = '/auditLogs/directoryAudits';
            const filter = `targetResources/any(t: t/id eq '${userId}')`;
            const orderBy = 'activityDateTime desc';
            const top = this.config.maxRecordsPerRequest;
            
            const auditLogs = await this.makeGraphApiRequest('GET', auditLogsEndpoint, {
                params: {
                    '$filter': filter,
                    '$orderby': orderBy,
                    '$top': top
                }
            });
            
            return {
                auditLogs: auditLogs.value || [],
                totalAuditEvents: auditLogs['@odata.count'] || auditLogs.value?.length || 0,
                retrievedAt: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('❌ Failed to export audit logs:', error.message);
            throw error;
        }
    }
    
    /**
     * Export directory objects related to the user
     */
    async exportDirectoryObjects(userId) {
        try {
            const directoryObjects = {
                memberOf: [],
                ownedObjects: [],
                createdObjects: []
            };
            
            // Get groups the user is a member of
            try {
                const memberOfEndpoint = `/users/${userId}/memberOf`;
                const memberOfResponse = await this.makeGraphApiRequest('GET', memberOfEndpoint, {
                    params: {
                        '$select': 'id,displayName,description,groupTypes,createdDateTime'
                    }
                });
                directoryObjects.memberOf = memberOfResponse.value || [];
            } catch (error) {
                console.warn('⚠️ Failed to retrieve memberOf data:', error.message);
            }
            
            // Get objects owned by the user
            try {
                const ownedObjectsEndpoint = `/users/${userId}/ownedObjects`;
                const ownedObjectsResponse = await this.makeGraphApiRequest('GET', ownedObjectsEndpoint, {
                    params: {
                        '$select': 'id,displayName,createdDateTime'
                    }
                });
                directoryObjects.ownedObjects = ownedObjectsResponse.value || [];
            } catch (error) {
                console.warn('⚠️ Failed to retrieve ownedObjects data:', error.message);
            }
            
            // Get objects created by the user
            try {
                const createdObjectsEndpoint = `/users/${userId}/createdObjects`;
                const createdObjectsResponse = await this.makeGraphApiRequest('GET', createdObjectsEndpoint, {
                    params: {
                        '$select': 'id,displayName,createdDateTime'
                    }
                });
                directoryObjects.createdObjects = createdObjectsResponse.value || [];
            } catch (error) {
                console.warn('⚠️ Failed to retrieve createdObjects data:', error.message);
            }
            
            return {
                ...directoryObjects,
                retrievedAt: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('❌ Failed to export directory objects:', error.message);
            throw error;
        }
    }
    
    /**
     * Export custom extensions and attributes
     */
    async exportCustomExtensions(userId) {
        try {
            // Get all extension properties for the application
            const applicationsEndpoint = `/applications`;
            const filter = `appId eq '${this.config.clientId}'`;
            
            const applicationsResponse = await this.makeGraphApiRequest('GET', applicationsEndpoint, {
                params: {
                    '$filter': filter,
                    '$select': 'id,appId,extensionProperties'
                }
            });
            
            const applications = applicationsResponse.value || [];
            let extensionProperties = [];
            
            if (applications.length > 0) {
                const application = applications[0];
                
                // Get extension properties for the application
                const extensionPropertiesEndpoint = `/applications/${application.id}/extensionProperties`;
                const extensionPropertiesResponse = await this.makeGraphApiRequest('GET', extensionPropertiesEndpoint);
                extensionProperties = extensionPropertiesResponse.value || [];
            }
            
            // Get user data with custom extensions
            const userEndpoint = `/users/${userId}`;
            const extensionFields = extensionProperties.map(prop => prop.name);
            
            let userWithExtensions = {};
            if (extensionFields.length > 0) {
                userWithExtensions = await this.makeGraphApiRequest('GET', userEndpoint, {
                    params: {
                        '$select': extensionFields.join(',')
                    }
                });
            }
            
            return {
                extensionProperties: extensionProperties,
                userExtensionData: userWithExtensions,
                retrievedAt: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('❌ Failed to export custom extensions:', error.message);
            throw error;
        }
    }
    
    /**
     * Sanitize export data by removing sensitive information
     */
    sanitizeExportData(exportData) {
        if (!this.config.enableDataSanitization) {
            return exportData;
        }
        
        const sensitiveFields = [
            'passwordProfile',
            'onPremisesSecurityIdentifier',
            'onPremisesSyncEnabled',
            'refreshTokensValidFromDateTime'
        ];
        
        const sanitizedData = JSON.parse(JSON.stringify(exportData));
        
        // Recursively remove sensitive fields
        const removeSensitiveFields = (obj) => {
            if (typeof obj !== 'object' || obj === null) {
                return obj;
            }
            
            if (Array.isArray(obj)) {
                return obj.map(removeSensitiveFields);
            }
            
            const sanitized = {};
            for (const [key, value] of Object.entries(obj)) {
                if (sensitiveFields.includes(key)) {
                    sanitized[key] = '[REDACTED]';
                } else {
                    sanitized[key] = removeSensitiveFields(value);
                }
            }
            
            return sanitized;
        };
        
        return removeSensitiveFields(sanitizedData);
    }
    
    /**
     * Check if error is retryable
     */
    isRetryableError(error) {
        // Network errors are retryable
        if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
            return true;
        }
        
        // HTTP 5xx errors are retryable
        if (error.response && error.response.status >= 500) {
            return true;
        }
        
        // Rate limiting is retryable
        if (error.response && error.response.status === 429) {
            return true;
        }
        
        // Specific Graph API error codes that are retryable
        const retryableErrorCodes = [
            'TooManyRequests',
            'ServiceUnavailable',
            'InternalServerError',
            'BadGateway',
            'GatewayTimeout'
        ];
        
        if (error.response && error.response.data && error.response.data.error) {
            const errorCode = error.response.data.error.code;
            return retryableErrorCodes.includes(errorCode);
        }
        
        return false;
    }
    
    /**
     * Generate cache key for requests
     */
    generateCacheKey(method, endpoint, options) {
        const key = `${method}_${endpoint}_${JSON.stringify(options.params || {})}`;
        return Buffer.from(key).toString('base64');
    }
    
    /**
     * Clean up expired cache entries
     */
    cleanupCache() {
        const now = Date.now();
        let cleanedCount = 0;
        
        for (const [key, cached] of this.requestCache.entries()) {
            if (cached.expiresAt <= now) {
                this.requestCache.delete(key);
                cleanedCount++;
            }
        }
        
        this.lastCacheCleanup = now;
        
        if (cleanedCount > 0) {
            console.log(`🧹 Cleaned up ${cleanedCount} expired Graph API cache entries`);
        }
    }
    
    /**
     * Delay execution
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Get service statistics
     */
    getStatistics() {
        return {
            ...this.apiStats,
            configuration: {
                graphApiBaseUrl: this.config.graphApiBaseUrl,
                tenantId: this.config.tenantId ? this.config.tenantId.substring(0, 8) + '...' : 'Not configured',
                enableUserProfile: this.config.enableUserProfile,
                enableSignInActivity: this.config.enableSignInActivity,
                enableAuditLogs: this.config.enableAuditLogs,
                enableDirectoryObjects: this.config.enableDirectoryObjects,
                enableCaching: this.config.enableCaching,
                enableDataSanitization: this.config.enableDataSanitization
            },
            cache: {
                size: this.requestCache.size,
                maxSize: this.config.cacheMaxSize,
                ttl: this.config.cacheTtl / 1000 + ' seconds',
                lastCleanup: new Date(this.lastCacheCleanup).toISOString()
            },
            token: {
                hasToken: !!this.accessToken,
                expiresAt: this.tokenExpiresAt ? new Date(this.tokenExpiresAt).toISOString() : null,
                timeUntilExpiry: this.tokenExpiresAt ? Math.max(0, this.tokenExpiresAt - Date.now()) : 0
            }
        };
    }
}

module.exports = {
    AzureB2CApiService
};
