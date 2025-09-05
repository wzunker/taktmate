// TaktMate Cookie Consent Service
// Comprehensive cookie consent management and session data disclosure with GDPR compliance

const fs = require('fs').promises;
const path = require('path');
const { config: azureConfig } = require('../config/entraExternalId');

/**
 * Cookie Consent Service
 * Manages cookie consent, session data disclosure, and privacy compliance
 */
class CookieConsentService {
    constructor(appInsights = null, sessionManagement = null) {
        this.appInsights = appInsights;
        this.sessionManagement = sessionManagement;
        
        // Cookie consent configuration
        this.config = {
            // Consent management settings
            enableCookieConsent: process.env.ENABLE_COOKIE_CONSENT !== 'false',
            enableSessionDataDisclosure: process.env.ENABLE_SESSION_DATA_DISCLOSURE !== 'false',
            requireExplicitConsent: process.env.REQUIRE_EXPLICIT_CONSENT !== 'false',
            
            // Consent storage settings
            consentStorageMethod: process.env.CONSENT_STORAGE_METHOD || 'cookie', // cookie, localStorage, database
            consentCookieName: process.env.CONSENT_COOKIE_NAME || 'taktmate_consent',
            consentCookieExpiry: parseInt(process.env.CONSENT_COOKIE_EXPIRY) || 365 * 24 * 60 * 60 * 1000, // 1 year
            
            // Consent categories
            enableCategoryManagement: process.env.ENABLE_CATEGORY_MANAGEMENT !== 'false',
            defaultConsentCategories: {
                essential: true,    // Always required, cannot be disabled
                functional: false,  // User preference storage, UI state
                analytics: false,   // Usage analytics, performance monitoring
                marketing: false    // Marketing cookies (not currently used)
            },
            
            // Session disclosure settings
            enableSessionDisclosure: process.env.ENABLE_SESSION_DISCLOSURE !== 'false',
            enableDataExport: process.env.ENABLE_SESSION_DATA_EXPORT !== 'false',
            enableDataDeletion: process.env.ENABLE_SESSION_DATA_DELETION !== 'false',
            
            // Compliance settings
            gdprCompliant: process.env.GDPR_COMPLIANT !== 'false',
            ePrivacyCompliant: process.env.EPRIVACY_COMPLIANT !== 'false',
            ccpaCompliant: process.env.CCPA_COMPLIANT !== 'false',
            
            // Banner and UI settings
            enableConsentBanner: process.env.ENABLE_CONSENT_BANNER !== 'false',
            bannerPosition: process.env.BANNER_POSITION || 'bottom', // top, bottom, modal
            enableConsentModal: process.env.ENABLE_CONSENT_MODAL !== 'false',
            enableConsentCenter: process.env.ENABLE_CONSENT_CENTER !== 'false',
            
            // Notification settings
            enableConsentNotifications: process.env.ENABLE_CONSENT_NOTIFICATIONS !== 'false',
            enableConsentReminders: process.env.ENABLE_CONSENT_REMINDERS !== 'false',
            reminderInterval: parseInt(process.env.CONSENT_REMINDER_INTERVAL) || 90 * 24 * 60 * 60 * 1000, // 90 days
            
            // Company information
            companyName: process.env.COMPANY_NAME || 'TaktMate',
            privacyPolicyUrl: process.env.PRIVACY_POLICY_URL || '/legal/privacy-policy',
            cookiePolicyUrl: process.env.COOKIE_POLICY_URL || '/legal/cookie-policy',
            contactEmail: process.env.PRIVACY_OFFICER_EMAIL || 'privacy@taktmate.com'
        };
        
        // Cookie categories and definitions
        this.cookieCategories = {
            essential: {
                name: 'Essential Cookies',
                description: 'These cookies are necessary for the website to function and cannot be switched off in our systems.',
                required: true,
                cookies: [
                    {
                        name: 'session_id',
                        purpose: 'Session identifier for maintaining user login state',
                        expiry: 'Session',
                        type: 'HTTP Cookie',
                        domain: 'taktmate.com'
                    },
                    {
                        name: 'csrf_token',
                        purpose: 'Cross-Site Request Forgery protection token',
                        expiry: 'Session',
                        type: 'HTTP Cookie',
                        domain: 'taktmate.com'
                    },
                    {
                        name: 'auth_token',
                        purpose: 'Authentication token for Azure AD B2C integration',
                        expiry: '24 hours',
                        type: 'HTTP Cookie',
                        domain: 'taktmate.com'
                    }
                ]
            },
            functional: {
                name: 'Functional Cookies',
                description: 'These cookies enable the website to provide enhanced functionality and personalisation.',
                required: false,
                cookies: [
                    {
                        name: 'user_preferences',
                        purpose: 'Store user interface preferences and settings',
                        expiry: '1 year',
                        type: 'HTTP Cookie',
                        domain: 'taktmate.com'
                    },
                    {
                        name: 'ui_state',
                        purpose: 'Remember interface state and layout preferences',
                        expiry: '6 months',
                        type: 'HTTP Cookie',
                        domain: 'taktmate.com'
                    },
                    {
                        name: 'feature_flags',
                        purpose: 'Enable or disable specific features based on user choices',
                        expiry: '3 months',
                        type: 'HTTP Cookie',
                        domain: 'taktmate.com'
                    }
                ]
            },
            analytics: {
                name: 'Analytics Cookies',
                description: 'These cookies allow us to count visits and traffic sources so we can measure and improve the performance of our site.',
                required: false,
                cookies: [
                    {
                        name: 'ai_session',
                        purpose: 'Azure Application Insights session tracking',
                        expiry: '30 minutes',
                        type: 'HTTP Cookie',
                        domain: 'taktmate.com'
                    },
                    {
                        name: 'ai_user',
                        purpose: 'Azure Application Insights user identification',
                        expiry: '1 year',
                        type: 'HTTP Cookie',
                        domain: 'taktmate.com'
                    },
                    {
                        name: 'performance_metrics',
                        purpose: 'Performance monitoring and optimization data',
                        expiry: '7 days',
                        type: 'HTTP Cookie',
                        domain: 'taktmate.com'
                    }
                ]
            },
            marketing: {
                name: 'Marketing Cookies',
                description: 'These cookies may be set through our site by our advertising partners.',
                required: false,
                cookies: []
            }
        };
        
        // User consent records
        this.userConsents = new Map();
        this.sessionDisclosures = new Map();
        
        // Service statistics
        this.consentStats = {
            consentsRecorded: 0,
            consentsAccepted: 0,
            consentsRejected: 0,
            consentsBannerShown: 0,
            consentsModalShown: 0,
            sessionDisclosuresProvided: 0,
            dataExportsRequested: 0,
            dataDeletionsRequested: 0,
            averageConsentTime: 0,
            totalConsentTime: 0
        };
        
        console.log('🍪 Cookie Consent Service initialized');
        console.log(`   Cookie Consent: ${this.config.enableCookieConsent ? '✅' : '❌'}`);
        console.log(`   Session Data Disclosure: ${this.config.enableSessionDataDisclosure ? '✅' : '❌'}`);
        console.log(`   GDPR Compliant: ${this.config.gdprCompliant ? '✅' : '❌'}`);
        console.log(`   ePrivacy Compliant: ${this.config.ePrivacyCompliant ? '✅' : '❌'}`);
        console.log(`   Consent Categories: ${Object.keys(this.cookieCategories).length}`);
    }
    
    /**
     * Initialize the cookie consent service
     */
    async initialize() {
        try {
            // Load existing consent records
            await this.loadConsentRecords();
            
            // Start periodic cleanup
            this.startPeriodicCleanup();
            
            // Initialize consent banner configuration
            this.initializeConsentBannerConfig();
            
            console.log('✅ Cookie Consent Service initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize Cookie Consent Service:', error.message);
            throw error;
        }
    }
    
    /**
     * Load existing consent records
     */
    async loadConsentRecords() {
        try {
            // In a production environment, this would load from a database
            // For now, we'll initialize with empty records
            console.log('📄 Initialized consent records storage');
        } catch (error) {
            console.error('❌ Failed to load consent records:', error.message);
        }
    }
    
    /**
     * Initialize consent banner configuration
     */
    initializeConsentBannerConfig() {
        this.bannerConfig = {
            title: 'We use cookies',
            message: `We use cookies to enhance your experience, analyze site usage, and assist in our marketing efforts. By continuing to browse this site, you acknowledge that you have read and understand our ${this.config.cookiePolicyUrl ? `<a href="${this.config.cookiePolicyUrl}" target="_blank">Cookie Policy</a>` : 'Cookie Policy'} and ${this.config.privacyPolicyUrl ? `<a href="${this.config.privacyPolicyUrl}" target="_blank">Privacy Policy</a>` : 'Privacy Policy'}.`,
            acceptAllText: 'Accept All',
            rejectAllText: 'Reject All',
            customizeText: 'Customize Settings',
            position: this.config.bannerPosition,
            showCloseButton: true,
            showCategoryToggles: this.config.enableCategoryManagement,
            categories: Object.entries(this.cookieCategories).map(([key, category]) => ({
                id: key,
                name: category.name,
                description: category.description,
                required: category.required,
                enabled: this.config.defaultConsentCategories[key] || category.required
            }))
        };
    }
    
    /**
     * Record user consent
     */
    async recordConsent(userId, consentData, metadata = {}) {
        try {
            const consentId = this.generateConsentId();
            const consentTime = Date.now();
            
            console.log(`🍪 Recording cookie consent for user ${userId} (consent ID: ${consentId})`);
            
            // Validate consent data
            this.validateConsentData(consentData);
            
            // Create consent record
            const consentRecord = {
                consentId: consentId,
                userId: userId,
                timestamp: new Date(consentTime).toISOString(),
                consentGiven: consentData.consentGiven || false,
                categories: consentData.categories || this.config.defaultConsentCategories,
                version: consentData.version || '1.0',
                method: consentData.method || 'banner', // banner, modal, settings
                
                // Metadata
                ipAddress: metadata.ipAddress || 'unknown',
                userAgent: metadata.userAgent || 'unknown',
                referrer: metadata.referrer || 'unknown',
                sessionId: metadata.sessionId || 'unknown',
                
                // Consent details
                explicitConsent: this.config.requireExplicitConsent,
                consentString: this.generateConsentString(consentData.categories),
                
                // Expiry information
                expiresAt: new Date(consentTime + this.config.consentCookieExpiry).toISOString(),
                
                // Compliance flags
                gdprCompliant: this.config.gdprCompliant,
                ePrivacyCompliant: this.config.ePrivacyCompliant,
                ccpaCompliant: this.config.ccpaCompliant
            };
            
            // Store consent record
            this.userConsents.set(userId, consentRecord);
            
            // Update statistics
            this.consentStats.consentsRecorded++;
            if (consentData.consentGiven) {
                this.consentStats.consentsAccepted++;
            } else {
                this.consentStats.consentsRejected++;
            }
            
            // Calculate consent time if provided
            if (metadata.consentStartTime) {
                const consentDuration = consentTime - metadata.consentStartTime;
                this.consentStats.totalConsentTime += consentDuration;
                this.consentStats.averageConsentTime = Math.round(
                    this.consentStats.totalConsentTime / this.consentStats.consentsRecorded
                );
            }
            
            // Track in Application Insights
            if (this.appInsights) {
                this.appInsights.telemetry.trackEvent('Cookie_Consent_Recorded', {
                    consentId: consentId,
                    userId: userId,
                    consentGiven: consentData.consentGiven.toString(),
                    method: consentData.method || 'banner',
                    categoriesAccepted: Object.keys(consentData.categories || {}).filter(
                        key => consentData.categories[key]
                    ).join(','),
                    gdprCompliant: this.config.gdprCompliant.toString()
                });
            }
            
            console.log(`✅ Cookie consent recorded successfully (consent ID: ${consentId})`);
            
            return {
                success: true,
                consentId: consentId,
                consentRecord: consentRecord,
                message: 'Cookie consent recorded successfully'
            };
            
        } catch (error) {
            console.error('❌ Failed to record cookie consent:', error.message);
            
            // Track failed consent in Application Insights
            if (this.appInsights) {
                this.appInsights.telemetry.trackEvent('Cookie_Consent_Recording_Failed', {
                    userId: userId,
                    error: error.message
                });
            }
            
            throw error;
        }
    }
    
    /**
     * Validate consent data
     */
    validateConsentData(consentData) {
        if (typeof consentData !== 'object' || consentData === null) {
            throw new Error('Consent data must be an object');
        }
        
        if (typeof consentData.consentGiven !== 'boolean') {
            throw new Error('consentGiven must be a boolean');
        }
        
        if (consentData.categories && typeof consentData.categories !== 'object') {
            throw new Error('categories must be an object');
        }
        
        // Validate category keys
        if (consentData.categories) {
            const validCategories = Object.keys(this.cookieCategories);
            const providedCategories = Object.keys(consentData.categories);
            
            const invalidCategories = providedCategories.filter(
                category => !validCategories.includes(category)
            );
            
            if (invalidCategories.length > 0) {
                throw new Error(`Invalid consent categories: ${invalidCategories.join(', ')}`);
            }
        }
        
        console.log('✅ Consent data validation passed');
    }
    
    /**
     * Generate consent string
     */
    generateConsentString(categories) {
        const categoryKeys = Object.keys(this.cookieCategories);
        const consentArray = categoryKeys.map(key => {
            return categories && categories[key] ? '1' : '0';
        });
        
        return consentArray.join('');
    }
    
    /**
     * Get user consent status
     */
    getUserConsentStatus(userId) {
        const consentRecord = this.userConsents.get(userId);
        
        if (!consentRecord) {
            return {
                hasConsent: false,
                consentRequired: this.config.enableCookieConsent,
                message: 'No consent record found'
            };
        }
        
        // Check if consent has expired
        const now = new Date();
        const expiresAt = new Date(consentRecord.expiresAt);
        
        if (now > expiresAt) {
            return {
                hasConsent: false,
                consentRequired: this.config.enableCookieConsent,
                expired: true,
                message: 'Consent has expired'
            };
        }
        
        return {
            hasConsent: true,
            consentRecord: consentRecord,
            categories: consentRecord.categories,
            consentGiven: consentRecord.consentGiven,
            expiresAt: consentRecord.expiresAt,
            message: 'Valid consent found'
        };
    }
    
    /**
     * Generate session data disclosure
     */
    async generateSessionDataDisclosure(userId, sessionId) {
        try {
            console.log(`📊 Generating session data disclosure for user ${userId}, session ${sessionId}`);
            
            // Get session data from session management service
            let sessionData = {};
            if (this.sessionManagement) {
                try {
                    sessionData = await this.sessionManagement.getSessionData(sessionId);
                } catch (error) {
                    console.warn('⚠️ Could not retrieve session data:', error.message);
                }
            }
            
            // Get user consent information
            const consentStatus = this.getUserConsentStatus(userId);
            
            // Generate comprehensive disclosure
            const disclosure = {
                metadata: {
                    disclosureId: this.generateDisclosureId(),
                    userId: userId,
                    sessionId: sessionId,
                    generatedAt: new Date().toISOString(),
                    disclosureVersion: '2.0',
                    gdprCompliant: this.config.gdprCompliant
                },
                
                sessionInformation: {
                    sessionId: sessionId,
                    sessionCreated: sessionData.createdAt || 'Unknown',
                    sessionLastActivity: sessionData.lastActivity || 'Unknown',
                    sessionExpiry: sessionData.expiresAt || 'Unknown',
                    sessionDuration: sessionData.duration || 'Unknown',
                    ipAddress: sessionData.ipAddress || 'Unknown',
                    userAgent: sessionData.userAgent || 'Unknown'
                },
                
                cookieInformation: {
                    consentStatus: consentStatus.hasConsent ? 'Given' : 'Required',
                    consentGiven: consentStatus.consentGiven || false,
                    consentDate: consentStatus.consentRecord?.timestamp || null,
                    consentExpiry: consentStatus.consentRecord?.expiresAt || null,
                    consentCategories: consentStatus.categories || {},
                    
                    cookiesUsed: this.generateCookieUsageReport(consentStatus.categories || {}),
                    
                    cookieCategories: Object.entries(this.cookieCategories).map(([key, category]) => ({
                        category: key,
                        name: category.name,
                        description: category.description,
                        required: category.required,
                        consented: consentStatus.categories ? consentStatus.categories[key] : false,
                        cookies: category.cookies
                    }))
                },
                
                dataProcessing: {
                    purposes: [
                        'Authentication and session management',
                        'Security and fraud prevention',
                        'Service functionality and user preferences',
                        consentStatus.categories?.analytics ? 'Usage analytics and performance monitoring' : null,
                        consentStatus.categories?.marketing ? 'Marketing and advertising' : null
                    ].filter(Boolean),
                    
                    legalBasis: this.config.gdprCompliant ? [
                        'Contractual necessity (essential cookies)',
                        'Legitimate interests (security and fraud prevention)',
                        consentStatus.consentGiven ? 'Consent (non-essential cookies)' : null
                    ].filter(Boolean) : ['Consent'],
                    
                    dataRetention: {
                        sessionData: '24 hours after session ends',
                        essentialCookies: 'Session duration or until logout',
                        functionalCookies: 'Up to 1 year or until consent withdrawn',
                        analyticsCookies: 'Up to 2 years or until consent withdrawn'
                    },
                    
                    thirdPartySharing: [
                        {
                            service: 'Microsoft Azure AD B2C',
                            purpose: 'Authentication and identity management',
                            dataShared: 'Authentication tokens and session identifiers'
                        },
                        {
                            service: 'Microsoft Azure Application Insights',
                            purpose: 'Performance monitoring and error tracking',
                            dataShared: 'Usage analytics and performance metrics',
                            conditional: 'Only if analytics consent given'
                        },
                        {
                            service: 'OpenAI',
                            purpose: 'AI-powered chat functionality',
                            dataShared: 'Chat messages and context (not stored in cookies)'
                        }
                    ]
                },
                
                userRights: {
                    rightToAccess: 'Request access to your personal data and cookies',
                    rightToRectification: 'Request correction of inaccurate data',
                    rightToErasure: 'Request deletion of your data and withdrawal of consent',
                    rightToPortability: 'Request export of your data in machine-readable format',
                    rightToObject: 'Object to processing based on legitimate interests',
                    rightToWithdrawConsent: 'Withdraw cookie consent at any time',
                    
                    howToExercise: {
                        consentManagement: '/settings/privacy',
                        dataExport: '/api/gdpr/export',
                        accountDeletion: '/api/gdpr/delete-account',
                        contactEmail: this.config.contactEmail
                    }
                },
                
                contactInformation: {
                    dataProtectionOfficer: this.config.contactEmail,
                    privacyPolicy: this.config.privacyPolicyUrl,
                    cookiePolicy: this.config.cookiePolicyUrl,
                    companyName: this.config.companyName
                }
            };
            
            // Store disclosure record
            this.sessionDisclosures.set(`${userId}_${sessionId}`, {
                ...disclosure,
                requestedAt: new Date().toISOString()
            });
            
            // Update statistics
            this.consentStats.sessionDisclosuresProvided++;
            
            // Track in Application Insights
            if (this.appInsights) {
                this.appInsights.telemetry.trackEvent('Session_Data_Disclosure_Generated', {
                    userId: userId,
                    sessionId: sessionId,
                    disclosureId: disclosure.metadata.disclosureId,
                    consentGiven: consentStatus.consentGiven?.toString() || 'false'
                });
            }
            
            console.log(`✅ Session data disclosure generated (ID: ${disclosure.metadata.disclosureId})`);
            
            return disclosure;
            
        } catch (error) {
            console.error('❌ Failed to generate session data disclosure:', error.message);
            throw error;
        }
    }
    
    /**
     * Generate cookie usage report
     */
    generateCookieUsageReport(consentCategories) {
        const cookiesUsed = [];
        
        Object.entries(this.cookieCategories).forEach(([categoryKey, category]) => {
            const categoryConsented = consentCategories[categoryKey] || category.required;
            
            if (categoryConsented) {
                category.cookies.forEach(cookie => {
                    cookiesUsed.push({
                        ...cookie,
                        category: categoryKey,
                        categoryName: category.name,
                        consentBasis: category.required ? 'Essential' : 'Consent'
                    });
                });
            }
        });
        
        return cookiesUsed;
    }
    
    /**
     * Get consent banner configuration
     */
    getConsentBannerConfig(userId = null) {
        // Check if user already has valid consent
        let showBanner = this.config.enableConsentBanner;
        
        if (userId) {
            const consentStatus = this.getUserConsentStatus(userId);
            showBanner = !consentStatus.hasConsent && this.config.enableConsentBanner;
        }
        
        return {
            showBanner: showBanner,
            config: this.bannerConfig,
            categories: this.bannerConfig.categories,
            requiresConsent: this.config.enableCookieConsent,
            explicitConsentRequired: this.config.requireExplicitConsent
        };
    }
    
    /**
     * Update consent banner statistics
     */
    updateBannerStats(action) {
        switch (action) {
            case 'banner_shown':
                this.consentStats.consentsBannerShown++;
                break;
            case 'modal_shown':
                this.consentStats.consentsModalShown++;
                break;
        }
    }
    
    /**
     * Export user session data
     */
    async exportUserSessionData(userId, format = 'json') {
        try {
            console.log(`📤 Exporting session data for user ${userId} in ${format} format`);
            
            // Get all session disclosures for user
            const userDisclosures = Array.from(this.sessionDisclosures.entries())
                .filter(([key]) => key.startsWith(`${userId}_`))
                .map(([key, disclosure]) => disclosure);
            
            // Get current consent status
            const consentStatus = this.getUserConsentStatus(userId);
            
            // Generate comprehensive export
            const exportData = {
                metadata: {
                    exportId: this.generateExportId(),
                    userId: userId,
                    exportedAt: new Date().toISOString(),
                    format: format,
                    version: '2.0'
                },
                
                consentInformation: consentStatus,
                sessionDisclosures: userDisclosures,
                cookieCategories: this.cookieCategories,
                
                summary: {
                    totalSessionDisclosures: userDisclosures.length,
                    currentConsentStatus: consentStatus.hasConsent ? 'Active' : 'Required',
                    consentCategories: Object.keys(consentStatus.categories || {}).length,
                    cookieCategoriesAvailable: Object.keys(this.cookieCategories).length
                }
            };
            
            // Update statistics
            this.consentStats.dataExportsRequested++;
            
            // Track in Application Insights
            if (this.appInsights) {
                this.appInsights.telemetry.trackEvent('Session_Data_Export_Requested', {
                    userId: userId,
                    format: format,
                    exportId: exportData.metadata.exportId
                });
            }
            
            console.log(`✅ Session data export completed (export ID: ${exportData.metadata.exportId})`);
            
            return exportData;
            
        } catch (error) {
            console.error('❌ Failed to export user session data:', error.message);
            throw error;
        }
    }
    
    /**
     * Delete user session data
     */
    async deleteUserSessionData(userId) {
        try {
            console.log(`🗑️ Deleting session data for user ${userId}`);
            
            // Remove consent record
            const hadConsent = this.userConsents.has(userId);
            if (hadConsent) {
                this.userConsents.delete(userId);
            }
            
            // Remove session disclosures
            const disclosureKeys = Array.from(this.sessionDisclosures.keys())
                .filter(key => key.startsWith(`${userId}_`));
            
            disclosureKeys.forEach(key => {
                this.sessionDisclosures.delete(key);
            });
            
            // Update statistics
            this.consentStats.dataDeletionsRequested++;
            
            // Track in Application Insights
            if (this.appInsights) {
                this.appInsights.telemetry.trackEvent('Session_Data_Deletion_Requested', {
                    userId: userId,
                    hadConsent: hadConsent.toString(),
                    disclosuresDeleted: disclosureKeys.length.toString()
                });
            }
            
            console.log(`✅ Session data deleted for user ${userId} (${disclosureKeys.length} disclosures, consent: ${hadConsent})`);
            
            return {
                success: true,
                deletedConsent: hadConsent,
                deletedDisclosures: disclosureKeys.length,
                message: 'Session data deleted successfully'
            };
            
        } catch (error) {
            console.error('❌ Failed to delete user session data:', error.message);
            throw error;
        }
    }
    
    /**
     * Start periodic cleanup
     */
    startPeriodicCleanup() {
        setInterval(() => {
            this.cleanupExpiredConsents();
            this.cleanupOldDisclosures();
        }, 24 * 60 * 60 * 1000); // Cleanup every 24 hours
        
        console.log('✅ Periodic cleanup started for cookie consent service');
    }
    
    /**
     * Cleanup expired consent records
     */
    cleanupExpiredConsents() {
        const now = new Date();
        let cleanedCount = 0;
        
        for (const [userId, consentRecord] of this.userConsents.entries()) {
            const expiresAt = new Date(consentRecord.expiresAt);
            
            if (now > expiresAt) {
                this.userConsents.delete(userId);
                cleanedCount++;
            }
        }
        
        if (cleanedCount > 0) {
            console.log(`🧹 Cleaned up ${cleanedCount} expired consent records`);
        }
    }
    
    /**
     * Cleanup old session disclosures
     */
    cleanupOldDisclosures() {
        const cutoffTime = Date.now() - (90 * 24 * 60 * 60 * 1000); // 90 days
        let cleanedCount = 0;
        
        for (const [key, disclosure] of this.sessionDisclosures.entries()) {
            const requestTime = new Date(disclosure.requestedAt).getTime();
            
            if (requestTime < cutoffTime) {
                this.sessionDisclosures.delete(key);
                cleanedCount++;
            }
        }
        
        if (cleanedCount > 0) {
            console.log(`🧹 Cleaned up ${cleanedCount} old session disclosures`);
        }
    }
    
    /**
     * Generate consent ID
     */
    generateConsentId() {
        return `consent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Generate disclosure ID
     */
    generateDisclosureId() {
        return `disclosure_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Generate export ID
     */
    generateExportId() {
        return `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Get service statistics
     */
    getStatistics() {
        return {
            ...this.consentStats,
            activeConsents: this.userConsents.size,
            sessionDisclosures: this.sessionDisclosures.size,
            
            configuration: {
                enableCookieConsent: this.config.enableCookieConsent,
                enableSessionDataDisclosure: this.config.enableSessionDataDisclosure,
                requireExplicitConsent: this.config.requireExplicitConsent,
                enableCategoryManagement: this.config.enableCategoryManagement,
                gdprCompliant: this.config.gdprCompliant,
                ePrivacyCompliant: this.config.ePrivacyCompliant,
                ccpaCompliant: this.config.ccpaCompliant,
                enableConsentBanner: this.config.enableConsentBanner,
                bannerPosition: this.config.bannerPosition,
                consentCookieExpiry: this.config.consentCookieExpiry / 1000 / 60 / 60 / 24 + ' days'
            },
            
            cookieCategories: Object.keys(this.cookieCategories).length,
            totalCookiesDefined: Object.values(this.cookieCategories)
                .reduce((total, category) => total + category.cookies.length, 0)
        };
    }
}

module.exports = {
    CookieConsentService
};
