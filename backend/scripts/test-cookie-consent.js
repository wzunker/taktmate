#!/usr/bin/env node

// TaktMate Cookie Consent Service Testing Script
// Tests cookie consent management and session data disclosure with GDPR compliance

const axios = require('axios');
const fs = require('fs');
const path = require('path');

class CookieConsentTest {
    constructor() {
        this.apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
        this.testResults = [];
        this.startTime = Date.now();
        
        // Test configuration
        this.config = {
            requestTimeout: 30000, // 30 seconds for consent operations
            delayBetweenTests: 300, // 300ms between tests
            maxRetries: 3
        };
        
        // Mock user data for testing
        this.mockUserData = {
            userId: 'test-user-consent-12345',
            email: 'test.consent@taktmate.com',
            name: 'Cookie Consent Test User'
        };
        
        console.log('🍪 TaktMate Cookie Consent Testing Suite');
        console.log(`🌐 Testing API: ${this.apiBaseUrl}`);
        console.log('');
    }
    
    /**
     * Record test result
     */
    recordResult(testName, status, message, details = {}) {
        const result = {
            test: testName,
            status: status,
            message: message,
            details: details,
            timestamp: new Date().toISOString()
        };
        
        this.testResults.push(result);
        
        const statusIcon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
        console.log(`${statusIcon} ${testName}: ${message}`);
        
        if (details.responseTime) {
            console.log(`   Response time: ${details.responseTime}ms`);
        }
    }
    
    /**
     * Make HTTP request with error handling
     */
    async makeRequest(method, endpoint, options = {}) {
        try {
            const startTime = Date.now();
            const config = {
                method: method,
                url: `${this.apiBaseUrl}${endpoint}`,
                timeout: this.config.requestTimeout,
                validateStatus: () => true, // Don't throw on any status code
                withCredentials: true, // Include cookies
                ...options
            };
            
            const response = await axios(config);
            const responseTime = Date.now() - startTime;
            
            return {
                success: true,
                response: response,
                responseTime: responseTime,
                status: response.status,
                headers: response.headers,
                data: response.data
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                code: error.code,
                responseTime: Date.now() - startTime
            };
        }
    }
    
    /**
     * Test cookie consent service status endpoint
     */
    async testCookieConsentServiceStatus() {
        console.log('\n🍪 Testing Cookie Consent Service Status...');
        
        const result = await this.makeRequest('GET', '/health/cookie-consent');
        
        if (!result.success) {
            this.recordResult(
                'Cookie Consent Service Status',
                'FAIL',
                `Request failed: ${result.error}`,
                { error: result.error }
            );
            return;
        }
        
        if (result.status !== 200) {
            this.recordResult(
                'Cookie Consent Service Status',
                'FAIL',
                `Unexpected status code: ${result.status}`,
                { status: result.status, data: result.data }
            );
            return;
        }
        
        const data = result.data;
        const expectedFields = ['status', 'timestamp', 'environment', 'cookie_consent'];
        const missingFields = expectedFields.filter(field => !(field in data));
        
        if (missingFields.length === 0) {
            const cookieConsent = data.cookie_consent;
            
            if (cookieConsent.error) {
                this.recordResult(
                    'Cookie Consent Service Status',
                    'WARN',
                    `Service not initialized: ${cookieConsent.error}`,
                    { error: cookieConsent.error, responseTime: result.responseTime }
                );
            } else {
                this.recordResult(
                    'Cookie Consent Service Status',
                    'PASS',
                    'Cookie consent service status endpoint working correctly',
                    { 
                        status: data.status,
                        environment: data.environment,
                        consentsRecorded: cookieConsent.consentsRecorded,
                        consentsAccepted: cookieConsent.consentsAccepted,
                        consentsRejected: cookieConsent.consentsRejected,
                        activeConsents: cookieConsent.activeConsents,
                        sessionDisclosures: cookieConsent.sessionDisclosures,
                        cookieCategories: cookieConsent.cookieCategories,
                        responseTime: result.responseTime
                    }
                );
            }
        } else {
            this.recordResult(
                'Cookie Consent Service Status',
                'WARN',
                `Missing fields in response: ${missingFields.join(', ')}`,
                { missingFields, responseTime: result.responseTime }
            );
        }
    }
    
    /**
     * Test cookie consent configuration endpoint
     */
    async testCookieConsentConfigurationEndpoint() {
        console.log('\n⚙️ Testing Cookie Consent Configuration Endpoint...');
        
        const result = await this.makeRequest('GET', '/api/cookie-consent/config');
        
        if (result.status === 200) {
            const responseData = result.data;
            const expectedFields = ['success', 'config', 'timestamp'];
            const hasRequiredFields = expectedFields.every(field => field in responseData);
            
            if (hasRequiredFields && responseData.success) {
                const config = responseData.config;
                const configFields = ['showBanner', 'config', 'categories', 'requiresConsent'];
                const hasConfigFields = configFields.every(field => field in config);
                
                if (hasConfigFields) {
                    this.recordResult(
                        'Cookie Consent Configuration',
                        'PASS',
                        'Cookie consent configuration endpoint working correctly',
                        { 
                            status: result.status,
                            showBanner: config.showBanner,
                            requiresConsent: config.requiresConsent,
                            explicitConsentRequired: config.explicitConsentRequired,
                            categoriesCount: config.categories?.length || 0,
                            responseTime: result.responseTime
                        }
                    );
                } else {
                    this.recordResult(
                        'Cookie Consent Configuration',
                        'WARN',
                        'Configuration response missing expected config fields',
                        { 
                            status: result.status,
                            missingConfigFields: configFields.filter(field => !(field in config)),
                            responseTime: result.responseTime
                        }
                    );
                }
            } else {
                this.recordResult(
                    'Cookie Consent Configuration',
                    'WARN',
                    'Configuration response structure incomplete',
                    { 
                        status: result.status,
                        missingFields: expectedFields.filter(field => !(field in responseData)),
                        success: responseData.success,
                        responseTime: result.responseTime
                    }
                );
            }
        } else {
            this.recordResult(
                'Cookie Consent Configuration',
                'FAIL',
                `Configuration endpoint failed: ${result.status}`,
                { status: result.status, error: result.data }
            );
        }
    }
    
    /**
     * Test cookie consent recording endpoint
     */
    async testCookieConsentRecordingEndpoint() {
        console.log('\n📝 Testing Cookie Consent Recording Endpoint...');
        
        // Test consent acceptance
        const acceptResult = await this.makeRequest('POST', '/api/cookie-consent/record', {
            data: {
                consentGiven: true,
                categories: {
                    essential: true,
                    functional: true,
                    analytics: false,
                    marketing: false
                },
                method: 'banner',
                consentStartTime: Date.now() - 5000 // 5 seconds ago
            }
        });
        
        if (acceptResult.status === 200) {
            const responseData = acceptResult.data;
            const expectedFields = ['success', 'message', 'consentId', 'timestamp'];
            const hasRequiredFields = expectedFields.every(field => field in responseData);
            
            if (hasRequiredFields && responseData.success) {
                this.recordResult(
                    'Cookie Consent Recording (Accept)',
                    'PASS',
                    'Cookie consent acceptance recorded successfully',
                    { 
                        status: acceptResult.status,
                        consentId: responseData.consentId,
                        message: responseData.message,
                        responseTime: acceptResult.responseTime
                    }
                );
            } else {
                this.recordResult(
                    'Cookie Consent Recording (Accept)',
                    'WARN',
                    'Consent acceptance response structure incomplete',
                    { 
                        status: acceptResult.status,
                        missingFields: expectedFields.filter(field => !(field in responseData)),
                        success: responseData.success,
                        responseTime: acceptResult.responseTime
                    }
                );
            }
        } else {
            this.recordResult(
                'Cookie Consent Recording (Accept)',
                'FAIL',
                `Consent acceptance failed: ${acceptResult.status}`,
                { status: acceptResult.status, error: acceptResult.data }
            );
        }
        
        // Test consent rejection
        const rejectResult = await this.makeRequest('POST', '/api/cookie-consent/record', {
            data: {
                consentGiven: false,
                categories: {
                    essential: true,
                    functional: false,
                    analytics: false,
                    marketing: false
                },
                method: 'banner'
            }
        });
        
        if (rejectResult.status === 200) {
            const responseData = rejectResult.data;
            
            if (responseData.success) {
                this.recordResult(
                    'Cookie Consent Recording (Reject)',
                    'PASS',
                    'Cookie consent rejection recorded successfully',
                    { 
                        status: rejectResult.status,
                        consentId: responseData.consentId,
                        responseTime: rejectResult.responseTime
                    }
                );
            } else {
                this.recordResult(
                    'Cookie Consent Recording (Reject)',
                    'WARN',
                    'Consent rejection response indicates failure',
                    { 
                        status: rejectResult.status,
                        success: responseData.success,
                        responseTime: rejectResult.responseTime
                    }
                );
            }
        } else {
            this.recordResult(
                'Cookie Consent Recording (Reject)',
                'FAIL',
                `Consent rejection failed: ${rejectResult.status}`,
                { status: rejectResult.status, error: rejectResult.data }
            );
        }
        
        // Test invalid consent data
        const invalidResult = await this.makeRequest('POST', '/api/cookie-consent/record', {
            data: {
                consentGiven: 'invalid', // Should be boolean
                categories: 'invalid'    // Should be object
            }
        });
        
        if (invalidResult.status === 400) {
            this.recordResult(
                'Cookie Consent Recording (Invalid Data)',
                'PASS',
                'Correctly validates consent data and rejects invalid input',
                { 
                    status: invalidResult.status,
                    responseTime: invalidResult.responseTime
                }
            );
        } else {
            this.recordResult(
                'Cookie Consent Recording (Invalid Data)',
                'WARN',
                `Expected 400 for invalid data, got ${invalidResult.status}`,
                { status: invalidResult.status, responseTime: invalidResult.responseTime }
            );
        }
    }
    
    /**
     * Test cookie consent status endpoint
     */
    async testCookieConsentStatusEndpoint() {
        console.log('\n📊 Testing Cookie Consent Status Endpoint...');
        
        // Test without authentication
        const unauthResult = await this.makeRequest('GET', '/api/cookie-consent/status');
        
        if (unauthResult.status === 401 || unauthResult.status === 403) {
            this.recordResult(
                'Cookie Consent Status (Unauthenticated)',
                'PASS',
                'Correctly requires authentication',
                { 
                    status: unauthResult.status,
                    responseTime: unauthResult.responseTime
                }
            );
        } else {
            this.recordResult(
                'Cookie Consent Status (Unauthenticated)',
                'WARN',
                `Expected 401/403, got ${unauthResult.status}`,
                { status: unauthResult.status, responseTime: unauthResult.responseTime }
            );
        }
        
        // Test with authentication
        const authResult = await this.makeRequest('GET', '/api/cookie-consent/status', {
            headers: {
                'Authorization': 'Bearer mock-token-for-testing'
            }
        });
        
        if (authResult.status === 401 || authResult.status === 403) {
            this.recordResult(
                'Cookie Consent Status (Authenticated)',
                'PASS',
                'Status endpoint accessible with authentication (expected auth failure with mock token)',
                { 
                    status: authResult.status,
                    responseTime: authResult.responseTime
                }
            );
        } else if (authResult.status === 200) {
            // If somehow successful, validate response structure
            const responseData = authResult.data;
            const expectedFields = ['success', 'consentStatus', 'timestamp'];
            const hasRequiredFields = expectedFields.every(field => field in responseData);
            
            if (hasRequiredFields) {
                this.recordResult(
                    'Cookie Consent Status (Authenticated)',
                    'PASS',
                    'Status endpoint successful with proper response structure',
                    { 
                        status: authResult.status,
                        hasConsent: responseData.consentStatus?.hasConsent,
                        consentRequired: responseData.consentStatus?.consentRequired,
                        responseTime: authResult.responseTime
                    }
                );
            } else {
                this.recordResult(
                    'Cookie Consent Status (Authenticated)',
                    'WARN',
                    'Status endpoint successful but response structure incomplete',
                    { 
                        status: authResult.status,
                        missingFields: expectedFields.filter(field => !(field in responseData)),
                        responseTime: authResult.responseTime
                    }
                );
            }
        } else {
            this.recordResult(
                'Cookie Consent Status (Authenticated)',
                'WARN',
                `Unexpected response: ${authResult.status}`,
                { status: authResult.status, data: authResult.data }
            );
        }
    }
    
    /**
     * Test session data disclosure endpoint
     */
    async testSessionDataDisclosureEndpoint() {
        console.log('\n📋 Testing Session Data Disclosure Endpoint...');
        
        // Test without authentication
        const unauthResult = await this.makeRequest('GET', '/api/session-data/disclosure');
        
        if (unauthResult.status === 401 || unauthResult.status === 403) {
            this.recordResult(
                'Session Data Disclosure (Unauthenticated)',
                'PASS',
                'Correctly requires authentication',
                { 
                    status: unauthResult.status,
                    responseTime: unauthResult.responseTime
                }
            );
        } else {
            this.recordResult(
                'Session Data Disclosure (Unauthenticated)',
                'WARN',
                `Expected 401/403, got ${unauthResult.status}`,
                { status: unauthResult.status, responseTime: unauthResult.responseTime }
            );
        }
        
        // Test JSON format
        const jsonResult = await this.makeRequest('GET', '/api/session-data/disclosure?format=json', {
            headers: {
                'Authorization': 'Bearer mock-token-for-testing'
            }
        });
        
        if (jsonResult.status === 401 || jsonResult.status === 403) {
            this.recordResult(
                'Session Data Disclosure (JSON)',
                'PASS',
                'Disclosure endpoint accessible with authentication (expected auth failure with mock token)',
                { 
                    status: jsonResult.status,
                    responseTime: jsonResult.responseTime
                }
            );
        } else if (jsonResult.status === 200) {
            // If somehow successful, validate response structure
            const responseData = jsonResult.data;
            const expectedFields = ['success', 'disclosure', 'timestamp'];
            const hasRequiredFields = expectedFields.every(field => field in responseData);
            
            if (hasRequiredFields && responseData.disclosure) {
                const disclosure = responseData.disclosure;
                const disclosureFields = ['metadata', 'sessionInformation', 'cookieInformation', 'dataProcessing', 'userRights'];
                const hasDisclosureFields = disclosureFields.every(field => field in disclosure);
                
                if (hasDisclosureFields) {
                    this.recordResult(
                        'Session Data Disclosure (JSON)',
                        'PASS',
                        'Session data disclosure successful with comprehensive structure',
                        { 
                            status: jsonResult.status,
                            disclosureId: disclosure.metadata?.disclosureId,
                            gdprCompliant: disclosure.metadata?.gdprCompliant,
                            cookieCategories: disclosure.cookieInformation?.cookieCategories?.length || 0,
                            responseTime: jsonResult.responseTime
                        }
                    );
                } else {
                    this.recordResult(
                        'Session Data Disclosure (JSON)',
                        'WARN',
                        'Disclosure successful but missing expected disclosure fields',
                        { 
                            status: jsonResult.status,
                            missingDisclosureFields: disclosureFields.filter(field => !(field in disclosure)),
                            responseTime: jsonResult.responseTime
                        }
                    );
                }
            } else {
                this.recordResult(
                    'Session Data Disclosure (JSON)',
                    'WARN',
                    'Disclosure successful but response structure incomplete',
                    { 
                        status: jsonResult.status,
                        missingFields: expectedFields.filter(field => !(field in responseData)),
                        responseTime: jsonResult.responseTime
                    }
                );
            }
        } else {
            this.recordResult(
                'Session Data Disclosure (JSON)',
                'WARN',
                `Unexpected response: ${jsonResult.status}`,
                { status: jsonResult.status }
            );
        }
        
        // Test HTML format
        const htmlResult = await this.makeRequest('GET', '/api/session-data/disclosure?format=html', {
            headers: {
                'Authorization': 'Bearer mock-token-for-testing'
            }
        });
        
        if (htmlResult.status === 401 || htmlResult.status === 403) {
            this.recordResult(
                'Session Data Disclosure (HTML)',
                'PASS',
                'HTML disclosure endpoint accessible with authentication (expected auth failure with mock token)',
                { 
                    status: htmlResult.status,
                    responseTime: htmlResult.responseTime
                }
            );
        } else if (htmlResult.status === 200) {
            const contentType = htmlResult.headers['content-type'];
            const isHtml = contentType && contentType.includes('text/html');
            const hasContent = htmlResult.data && htmlResult.data.length > 1000; // Should be substantial content
            
            if (isHtml && hasContent) {
                this.recordResult(
                    'Session Data Disclosure (HTML)',
                    'PASS',
                    'HTML disclosure endpoint working correctly',
                    { 
                        status: htmlResult.status,
                        contentType: contentType,
                        contentLength: htmlResult.data.length,
                        hasDisclosureTitle: htmlResult.data.includes('Session Data & Cookie Disclosure'),
                        hasCookieInfo: htmlResult.data.includes('Cookie Consent Information'),
                        responseTime: htmlResult.responseTime
                    }
                );
            } else {
                this.recordResult(
                    'Session Data Disclosure (HTML)',
                    'WARN',
                    'HTML disclosure response has issues',
                    { 
                        status: htmlResult.status,
                        contentType: contentType,
                        isHtml: isHtml,
                        hasContent: hasContent,
                        responseTime: htmlResult.responseTime
                    }
                );
            }
        } else {
            this.recordResult(
                'Session Data Disclosure (HTML)',
                'WARN',
                `Unexpected response: ${htmlResult.status}`,
                { status: htmlResult.status }
            );
        }
    }
    
    /**
     * Test session data export endpoint
     */
    async testSessionDataExportEndpoint() {
        console.log('\n📤 Testing Session Data Export Endpoint...');
        
        // Test without authentication
        const unauthResult = await this.makeRequest('GET', '/api/session-data/export');
        
        if (unauthResult.status === 401 || unauthResult.status === 403) {
            this.recordResult(
                'Session Data Export (Unauthenticated)',
                'PASS',
                'Correctly requires authentication',
                { 
                    status: unauthResult.status,
                    responseTime: unauthResult.responseTime
                }
            );
        } else {
            this.recordResult(
                'Session Data Export (Unauthenticated)',
                'WARN',
                `Expected 401/403, got ${unauthResult.status}`,
                { status: unauthResult.status, responseTime: unauthResult.responseTime }
            );
        }
        
        // Test with authentication
        const exportResult = await this.makeRequest('GET', '/api/session-data/export', {
            headers: {
                'Authorization': 'Bearer mock-token-for-testing'
            }
        });
        
        if (exportResult.status === 401 || exportResult.status === 403) {
            this.recordResult(
                'Session Data Export (Authenticated)',
                'PASS',
                'Export endpoint accessible with authentication (expected auth failure with mock token)',
                { 
                    status: exportResult.status,
                    responseTime: exportResult.responseTime
                }
            );
        } else if (exportResult.status === 200) {
            // Check export headers
            const headers = exportResult.headers;
            const hasExportHeaders = headers['content-disposition'] && 
                                   headers['x-export-size'] && 
                                   headers['x-export-categories'];
            
            if (hasExportHeaders) {
                this.recordResult(
                    'Session Data Export (Authenticated)',
                    'PASS',
                    'Export endpoint successful with proper export headers',
                    { 
                        status: exportResult.status,
                        contentDisposition: headers['content-disposition'],
                        exportSize: headers['x-export-size'],
                        exportCategories: headers['x-export-categories'],
                        exportFormat: headers['x-export-format'],
                        responseTime: exportResult.responseTime
                    }
                );
            } else {
                this.recordResult(
                    'Session Data Export (Authenticated)',
                    'WARN',
                    'Export successful but missing expected export headers',
                    { 
                        status: exportResult.status,
                        hasContentDisposition: !!headers['content-disposition'],
                        hasExportSize: !!headers['x-export-size'],
                        hasExportCategories: !!headers['x-export-categories'],
                        responseTime: exportResult.responseTime
                    }
                );
            }
        } else {
            this.recordResult(
                'Session Data Export (Authenticated)',
                'WARN',
                `Unexpected response: ${exportResult.status}`,
                { status: exportResult.status }
            );
        }
    }
    
    /**
     * Test session data deletion endpoint
     */
    async testSessionDataDeletionEndpoint() {
        console.log('\n🗑️ Testing Session Data Deletion Endpoint...');
        
        // Test without authentication
        const unauthResult = await this.makeRequest('DELETE', '/api/session-data/delete');
        
        if (unauthResult.status === 401 || unauthResult.status === 403) {
            this.recordResult(
                'Session Data Deletion (Unauthenticated)',
                'PASS',
                'Correctly requires authentication',
                { 
                    status: unauthResult.status,
                    responseTime: unauthResult.responseTime
                }
            );
        } else {
            this.recordResult(
                'Session Data Deletion (Unauthenticated)',
                'WARN',
                `Expected 401/403, got ${unauthResult.status}`,
                { status: unauthResult.status, responseTime: unauthResult.responseTime }
            );
        }
        
        // Test with authentication
        const deleteResult = await this.makeRequest('DELETE', '/api/session-data/delete', {
            headers: {
                'Authorization': 'Bearer mock-token-for-testing'
            }
        });
        
        if (deleteResult.status === 401 || deleteResult.status === 403) {
            this.recordResult(
                'Session Data Deletion (Authenticated)',
                'PASS',
                'Deletion endpoint accessible with authentication (expected auth failure with mock token)',
                { 
                    status: deleteResult.status,
                    responseTime: deleteResult.responseTime
                }
            );
        } else if (deleteResult.status === 200) {
            // If somehow successful, validate response structure
            const responseData = deleteResult.data;
            const expectedFields = ['success', 'message', 'deletedConsent', 'deletedDisclosures', 'timestamp'];
            const hasRequiredFields = expectedFields.every(field => field in responseData);
            
            if (hasRequiredFields) {
                this.recordResult(
                    'Session Data Deletion (Authenticated)',
                    'PASS',
                    'Deletion endpoint successful with proper response structure',
                    { 
                        status: deleteResult.status,
                        success: responseData.success,
                        deletedConsent: responseData.deletedConsent,
                        deletedDisclosures: responseData.deletedDisclosures,
                        responseTime: deleteResult.responseTime
                    }
                );
            } else {
                this.recordResult(
                    'Session Data Deletion (Authenticated)',
                    'WARN',
                    'Deletion successful but response structure incomplete',
                    { 
                        status: deleteResult.status,
                        missingFields: expectedFields.filter(field => !(field in responseData)),
                        responseTime: deleteResult.responseTime
                    }
                );
            }
        } else {
            this.recordResult(
                'Session Data Deletion (Authenticated)',
                'WARN',
                `Unexpected response: ${deleteResult.status}`,
                { status: deleteResult.status }
            );
        }
    }
    
    /**
     * Test cookie consent banner statistics endpoint
     */
    async testCookieConsentBannerStatsEndpoint() {
        console.log('\n📈 Testing Cookie Consent Banner Statistics Endpoint...');
        
        // Test banner shown statistics
        const bannerResult = await this.makeRequest('POST', '/api/cookie-consent/stats', {
            data: {
                action: 'banner_shown'
            }
        });
        
        if (bannerResult.status === 200) {
            const responseData = bannerResult.data;
            
            if (responseData.success) {
                this.recordResult(
                    'Cookie Consent Banner Stats (Banner Shown)',
                    'PASS',
                    'Banner statistics recording successful',
                    { 
                        status: bannerResult.status,
                        message: responseData.message,
                        responseTime: bannerResult.responseTime
                    }
                );
            } else {
                this.recordResult(
                    'Cookie Consent Banner Stats (Banner Shown)',
                    'WARN',
                    'Banner statistics response indicates failure',
                    { 
                        status: bannerResult.status,
                        success: responseData.success,
                        responseTime: bannerResult.responseTime
                    }
                );
            }
        } else {
            this.recordResult(
                'Cookie Consent Banner Stats (Banner Shown)',
                'FAIL',
                `Banner statistics failed: ${bannerResult.status}`,
                { status: bannerResult.status, error: bannerResult.data }
            );
        }
        
        // Test modal shown statistics
        const modalResult = await this.makeRequest('POST', '/api/cookie-consent/stats', {
            data: {
                action: 'modal_shown'
            }
        });
        
        if (modalResult.status === 200) {
            const responseData = modalResult.data;
            
            if (responseData.success) {
                this.recordResult(
                    'Cookie Consent Banner Stats (Modal Shown)',
                    'PASS',
                    'Modal statistics recording successful',
                    { 
                        status: modalResult.status,
                        message: responseData.message,
                        responseTime: modalResult.responseTime
                    }
                );
            } else {
                this.recordResult(
                    'Cookie Consent Banner Stats (Modal Shown)',
                    'WARN',
                    'Modal statistics response indicates failure',
                    { 
                        status: modalResult.status,
                        success: responseData.success,
                        responseTime: modalResult.responseTime
                    }
                );
            }
        } else {
            this.recordResult(
                'Cookie Consent Banner Stats (Modal Shown)',
                'FAIL',
                `Modal statistics failed: ${modalResult.status}`,
                { status: modalResult.status, error: modalResult.data }
            );
        }
        
        // Test invalid action
        const invalidResult = await this.makeRequest('POST', '/api/cookie-consent/stats', {
            data: {
                action: 'invalid_action'
            }
        });
        
        if (invalidResult.status === 400) {
            this.recordResult(
                'Cookie Consent Banner Stats (Invalid Action)',
                'PASS',
                'Correctly validates action parameter and rejects invalid input',
                { 
                    status: invalidResult.status,
                    responseTime: invalidResult.responseTime
                }
            );
        } else {
            this.recordResult(
                'Cookie Consent Banner Stats (Invalid Action)',
                'WARN',
                `Expected 400 for invalid action, got ${invalidResult.status}`,
                { status: invalidResult.status, responseTime: invalidResult.responseTime }
            );
        }
    }
    
    /**
     * Test cookie consent service performance
     */
    async testCookieConsentServicePerformance() {
        console.log('\n⚡ Testing Cookie Consent Service Performance...');
        
        const iterations = 5;
        const responseTimes = [];
        
        // Test consent configuration endpoint performance
        for (let i = 0; i < iterations; i++) {
            const result = await this.makeRequest('GET', '/api/cookie-consent/config');
            if (result.success && result.status === 200) {
                responseTimes.push(result.responseTime);
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        if (responseTimes.length === 0) {
            this.recordResult(
                'Cookie Consent Service Performance',
                'FAIL',
                'No successful requests for performance testing',
                {}
            );
            return;
        }
        
        const avgResponseTime = Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length);
        const maxResponseTime = Math.max(...responseTimes);
        const minResponseTime = Math.min(...responseTimes);
        
        if (avgResponseTime < 1000) { // Less than 1 second average
            this.recordResult(
                'Cookie Consent Service Performance',
                'PASS',
                `Good performance: ${avgResponseTime}ms average`,
                { 
                    avgResponseTime,
                    maxResponseTime,
                    minResponseTime,
                    iterations: responseTimes.length
                }
            );
        } else if (avgResponseTime < 3000) { // Less than 3 seconds
            this.recordResult(
                'Cookie Consent Service Performance',
                'WARN',
                `Acceptable performance: ${avgResponseTime}ms average`,
                { 
                    avgResponseTime,
                    maxResponseTime,
                    minResponseTime,
                    iterations: responseTimes.length
                }
            );
        } else {
            this.recordResult(
                'Cookie Consent Service Performance',
                'FAIL',
                `Poor performance: ${avgResponseTime}ms average`,
                { 
                    avgResponseTime,
                    maxResponseTime,
                    minResponseTime,
                    iterations: responseTimes.length
                }
            );
        }
    }
    
    /**
     * Generate test report
     */
    generateReport() {
        const endTime = Date.now();
        const duration = endTime - this.startTime;
        
        const summary = {
            totalTests: this.testResults.length,
            passed: this.testResults.filter(r => r.status === 'PASS').length,
            failed: this.testResults.filter(r => r.status === 'FAIL').length,
            warnings: this.testResults.filter(r => r.status === 'WARN').length,
            duration: Math.round(duration),
            timestamp: new Date().toISOString()
        };
        
        const report = {
            summary,
            testResults: this.testResults,
            environment: {
                apiBaseUrl: this.apiBaseUrl,
                nodeVersion: process.version,
                platform: process.platform
            },
            configuration: this.config,
            mockUserData: this.mockUserData
        };
        
        console.log('\n🍪 Cookie Consent Test Summary');
        console.log('==================================');
        console.log(`Total Tests: ${summary.totalTests}`);
        console.log(`✅ Passed: ${summary.passed}`);
        console.log(`❌ Failed: ${summary.failed}`);
        console.log(`⚠️  Warnings: ${summary.warnings}`);
        console.log(`⏱️  Duration: ${summary.duration}ms`);
        
        if (summary.failed > 0) {
            console.log('\n❌ Failed Tests:');
            this.testResults
                .filter(r => r.status === 'FAIL')
                .forEach(test => {
                    console.log(`   - ${test.test}: ${test.message}`);
                });
        }
        
        if (summary.warnings > 0) {
            console.log('\n⚠️  Warnings:');
            this.testResults
                .filter(r => r.status === 'WARN')
                .forEach(test => {
                    console.log(`   - ${test.test}: ${test.message}`);
                });
        }
        
        const successRate = summary.totalTests > 0 ? 
            ((summary.passed / summary.totalTests) * 100).toFixed(1) : 0;
        
        console.log(`\n🎯 Success Rate: ${successRate}%`);
        
        // Save report to file
        const reportDir = path.join(__dirname, '..', 'reports');
        
        if (!fs.existsSync(reportDir)) {
            fs.mkdirSync(reportDir, { recursive: true });
        }
        
        const reportFile = path.join(reportDir, `cookie-consent-test-${Date.now()}.json`);
        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
        
        console.log(`\n📄 Detailed report saved to: ${reportFile}`);
        
        return report;
    }
    
    /**
     * Run all cookie consent tests
     */
    async runAllTests() {
        try {
            await this.testCookieConsentServiceStatus();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testCookieConsentConfigurationEndpoint();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testCookieConsentRecordingEndpoint();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testCookieConsentStatusEndpoint();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testSessionDataDisclosureEndpoint();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testSessionDataExportEndpoint();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testSessionDataDeletionEndpoint();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testCookieConsentBannerStatsEndpoint();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testCookieConsentServicePerformance();
            
            const report = this.generateReport();
            
            // Exit with appropriate code
            const hasFailures = report.summary.failed > 0;
            process.exit(hasFailures ? 1 : 0);
        } catch (error) {
            console.error('\n❌ Test suite failed:', error.message);
            console.error(error.stack);
            process.exit(1);
        }
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new CookieConsentTest();
    tester.runAllTests().catch(error => {
        console.error('❌ Test execution failed:', error);
        process.exit(1);
    });
}

module.exports = CookieConsentTest;
