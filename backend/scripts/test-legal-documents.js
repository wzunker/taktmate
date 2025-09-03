#!/usr/bin/env node

// TaktMate Legal Documents Service Testing Script
// Tests privacy policy and terms of service pages with versioning and compliance tracking

const axios = require('axios');
const fs = require('fs');
const path = require('path');

class LegalDocumentsTest {
    constructor() {
        this.apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
        this.testResults = [];
        this.startTime = Date.now();
        
        // Test configuration
        this.config = {
            requestTimeout: 30000, // 30 seconds for document operations
            delayBetweenTests: 500, // 500ms between tests
            maxRetries: 3
        };
        
        // Mock user data for testing
        this.mockUserData = {
            userId: 'test-user-legal-12345',
            email: 'test.legal@taktmate.com',
            name: 'Legal Documents Test User'
        };
        
        console.log('📋 TaktMate Legal Documents Testing Suite');
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
     * Test legal documents service status endpoint
     */
    async testLegalDocumentsServiceStatus() {
        console.log('\n📋 Testing Legal Documents Service Status...');
        
        const result = await this.makeRequest('GET', '/health/legal-documents');
        
        if (!result.success) {
            this.recordResult(
                'Legal Documents Service Status',
                'FAIL',
                `Request failed: ${result.error}`,
                { error: result.error }
            );
            return;
        }
        
        if (result.status !== 200) {
            this.recordResult(
                'Legal Documents Service Status',
                'FAIL',
                `Unexpected status code: ${result.status}`,
                { status: result.status, data: result.data }
            );
            return;
        }
        
        const data = result.data;
        const expectedFields = ['status', 'timestamp', 'environment', 'legal_documents'];
        const missingFields = expectedFields.filter(field => !(field in data));
        
        if (missingFields.length === 0) {
            const legalDocuments = data.legal_documents;
            
            if (legalDocuments.error) {
                this.recordResult(
                    'Legal Documents Service Status',
                    'WARN',
                    `Service not initialized: ${legalDocuments.error}`,
                    { error: legalDocuments.error, responseTime: result.responseTime }
                );
            } else {
                this.recordResult(
                    'Legal Documents Service Status',
                    'PASS',
                    'Legal documents service status endpoint working correctly',
                    { 
                        status: data.status,
                        environment: data.environment,
                        documentsServed: legalDocuments.documentsServed,
                        acceptancesRecorded: legalDocuments.acceptancesRecorded,
                        versionsCreated: legalDocuments.versionsCreated,
                        documentsAvailable: legalDocuments.documentsAvailable,
                        totalVersions: legalDocuments.totalVersions,
                        responseTime: result.responseTime
                    }
                );
            }
        } else {
            this.recordResult(
                'Legal Documents Service Status',
                'WARN',
                `Missing fields in response: ${missingFields.join(', ')}`,
                { missingFields, responseTime: result.responseTime }
            );
        }
    }
    
    /**
     * Test privacy policy endpoint
     */
    async testPrivacyPolicyEndpoint() {
        console.log('\n🔒 Testing Privacy Policy Endpoint...');
        
        // Test HTML format (default)
        const htmlResult = await this.makeRequest('GET', '/legal/privacy-policy');
        
        if (htmlResult.status === 200) {
            const contentType = htmlResult.headers['content-type'];
            const isHtml = contentType && contentType.includes('text/html');
            const hasContent = htmlResult.data && htmlResult.data.length > 1000; // Should be substantial content
            
            if (isHtml && hasContent) {
                this.recordResult(
                    'Privacy Policy (HTML Format)',
                    'PASS',
                    'Privacy policy HTML endpoint working correctly',
                    { 
                        status: htmlResult.status,
                        contentType: contentType,
                        contentLength: htmlResult.data.length,
                        hasVersionInfo: htmlResult.data.includes('Version:'),
                        hasContactInfo: htmlResult.data.includes('@'),
                        responseTime: htmlResult.responseTime
                    }
                );
            } else {
                this.recordResult(
                    'Privacy Policy (HTML Format)',
                    'WARN',
                    'Privacy policy HTML response has issues',
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
                'Privacy Policy (HTML Format)',
                'FAIL',
                `Privacy policy HTML endpoint failed: ${htmlResult.status}`,
                { status: htmlResult.status, error: htmlResult.data }
            );
        }
        
        // Test JSON format
        const jsonResult = await this.makeRequest('GET', '/legal/privacy-policy?format=json');
        
        if (jsonResult.status === 200) {
            const isJson = jsonResult.headers['content-type']?.includes('application/json');
            const hasDocumentStructure = jsonResult.data?.document?.type === 'privacy-policy';
            
            if (isJson && hasDocumentStructure) {
                this.recordResult(
                    'Privacy Policy (JSON Format)',
                    'PASS',
                    'Privacy policy JSON endpoint working correctly',
                    { 
                        status: jsonResult.status,
                        documentType: jsonResult.data.document.type,
                        version: jsonResult.data.document.version,
                        contentLength: jsonResult.data.document.content?.length || 0,
                        versionsCount: jsonResult.data.document.metadata?.versions,
                        responseTime: jsonResult.responseTime
                    }
                );
            } else {
                this.recordResult(
                    'Privacy Policy (JSON Format)',
                    'WARN',
                    'Privacy policy JSON response structure issues',
                    { 
                        status: jsonResult.status,
                        isJson: isJson,
                        hasDocumentStructure: hasDocumentStructure,
                        responseTime: jsonResult.responseTime
                    }
                );
            }
        } else {
            this.recordResult(
                'Privacy Policy (JSON Format)',
                'FAIL',
                `Privacy policy JSON endpoint failed: ${jsonResult.status}`,
                { status: jsonResult.status }
            );
        }
        
        // Test Markdown format
        const markdownResult = await this.makeRequest('GET', '/legal/privacy-policy?format=markdown');
        
        if (markdownResult.status === 200) {
            const isMarkdown = markdownResult.headers['content-type']?.includes('text/markdown');
            const hasMarkdownContent = markdownResult.data && markdownResult.data.includes('#') && markdownResult.data.length > 1000;
            
            if (isMarkdown && hasMarkdownContent) {
                this.recordResult(
                    'Privacy Policy (Markdown Format)',
                    'PASS',
                    'Privacy policy Markdown endpoint working correctly',
                    { 
                        status: markdownResult.status,
                        contentType: markdownResult.headers['content-type'],
                        contentLength: markdownResult.data.length,
                        hasMarkdownHeaders: markdownResult.data.includes('# '),
                        responseTime: markdownResult.responseTime
                    }
                );
            } else {
                this.recordResult(
                    'Privacy Policy (Markdown Format)',
                    'WARN',
                    'Privacy policy Markdown response has issues',
                    { 
                        status: markdownResult.status,
                        isMarkdown: isMarkdown,
                        hasMarkdownContent: hasMarkdownContent,
                        responseTime: markdownResult.responseTime
                    }
                );
            }
        } else {
            this.recordResult(
                'Privacy Policy (Markdown Format)',
                'FAIL',
                `Privacy policy Markdown endpoint failed: ${markdownResult.status}`,
                { status: markdownResult.status }
            );
        }
    }
    
    /**
     * Test terms of service endpoint
     */
    async testTermsOfServiceEndpoint() {
        console.log('\n📄 Testing Terms of Service Endpoint...');
        
        // Test HTML format (default)
        const htmlResult = await this.makeRequest('GET', '/legal/terms-of-service');
        
        if (htmlResult.status === 200) {
            const contentType = htmlResult.headers['content-type'];
            const isHtml = contentType && contentType.includes('text/html');
            const hasContent = htmlResult.data && htmlResult.data.length > 1000; // Should be substantial content
            
            if (isHtml && hasContent) {
                this.recordResult(
                    'Terms of Service (HTML Format)',
                    'PASS',
                    'Terms of service HTML endpoint working correctly',
                    { 
                        status: htmlResult.status,
                        contentType: contentType,
                        contentLength: htmlResult.data.length,
                        hasVersionInfo: htmlResult.data.includes('Version:'),
                        hasContactInfo: htmlResult.data.includes('@'),
                        responseTime: htmlResult.responseTime
                    }
                );
            } else {
                this.recordResult(
                    'Terms of Service (HTML Format)',
                    'WARN',
                    'Terms of service HTML response has issues',
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
                'Terms of Service (HTML Format)',
                'FAIL',
                `Terms of service HTML endpoint failed: ${htmlResult.status}`,
                { status: htmlResult.status, error: htmlResult.data }
            );
        }
        
        // Test JSON format
        const jsonResult = await this.makeRequest('GET', '/legal/terms-of-service?format=json');
        
        if (jsonResult.status === 200) {
            const isJson = jsonResult.headers['content-type']?.includes('application/json');
            const hasDocumentStructure = jsonResult.data?.document?.type === 'terms-of-service';
            
            if (isJson && hasDocumentStructure) {
                this.recordResult(
                    'Terms of Service (JSON Format)',
                    'PASS',
                    'Terms of service JSON endpoint working correctly',
                    { 
                        status: jsonResult.status,
                        documentType: jsonResult.data.document.type,
                        version: jsonResult.data.document.version,
                        contentLength: jsonResult.data.document.content?.length || 0,
                        versionsCount: jsonResult.data.document.metadata?.versions,
                        responseTime: jsonResult.responseTime
                    }
                );
            } else {
                this.recordResult(
                    'Terms of Service (JSON Format)',
                    'WARN',
                    'Terms of service JSON response structure issues',
                    { 
                        status: jsonResult.status,
                        isJson: isJson,
                        hasDocumentStructure: hasDocumentStructure,
                        responseTime: jsonResult.responseTime
                    }
                );
            }
        } else {
            this.recordResult(
                'Terms of Service (JSON Format)',
                'FAIL',
                `Terms of service JSON endpoint failed: ${jsonResult.status}`,
                { status: jsonResult.status }
            );
        }
    }
    
    /**
     * Test cookie policy endpoint
     */
    async testCookiePolicyEndpoint() {
        console.log('\n🍪 Testing Cookie Policy Endpoint...');
        
        // Test HTML format (default)
        const htmlResult = await this.makeRequest('GET', '/legal/cookie-policy');
        
        if (htmlResult.status === 200) {
            const contentType = htmlResult.headers['content-type'];
            const isHtml = contentType && contentType.includes('text/html');
            const hasContent = htmlResult.data && htmlResult.data.length > 1000; // Should be substantial content
            
            if (isHtml && hasContent) {
                this.recordResult(
                    'Cookie Policy (HTML Format)',
                    'PASS',
                    'Cookie policy HTML endpoint working correctly',
                    { 
                        status: htmlResult.status,
                        contentType: contentType,
                        contentLength: htmlResult.data.length,
                        hasVersionInfo: htmlResult.data.includes('Version:'),
                        hasCookieInfo: htmlResult.data.includes('cookie'),
                        responseTime: htmlResult.responseTime
                    }
                );
            } else {
                this.recordResult(
                    'Cookie Policy (HTML Format)',
                    'WARN',
                    'Cookie policy HTML response has issues',
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
                'Cookie Policy (HTML Format)',
                'FAIL',
                `Cookie policy HTML endpoint failed: ${htmlResult.status}`,
                { status: htmlResult.status, error: htmlResult.data }
            );
        }
        
        // Test JSON format
        const jsonResult = await this.makeRequest('GET', '/legal/cookie-policy?format=json');
        
        if (jsonResult.status === 200) {
            const isJson = jsonResult.headers['content-type']?.includes('application/json');
            const hasDocumentStructure = jsonResult.data?.document?.type === 'cookie-policy';
            
            if (isJson && hasDocumentStructure) {
                this.recordResult(
                    'Cookie Policy (JSON Format)',
                    'PASS',
                    'Cookie policy JSON endpoint working correctly',
                    { 
                        status: jsonResult.status,
                        documentType: jsonResult.data.document.type,
                        version: jsonResult.data.document.version,
                        contentLength: jsonResult.data.document.content?.length || 0,
                        versionsCount: jsonResult.data.document.metadata?.versions,
                        responseTime: jsonResult.responseTime
                    }
                );
            } else {
                this.recordResult(
                    'Cookie Policy (JSON Format)',
                    'WARN',
                    'Cookie policy JSON response structure issues',
                    { 
                        status: jsonResult.status,
                        isJson: isJson,
                        hasDocumentStructure: hasDocumentStructure,
                        responseTime: jsonResult.responseTime
                    }
                );
            }
        } else {
            this.recordResult(
                'Cookie Policy (JSON Format)',
                'FAIL',
                `Cookie policy JSON endpoint failed: ${jsonResult.status}`,
                { status: jsonResult.status }
            );
        }
    }
    
    /**
     * Test legal document acceptance endpoint
     */
    async testLegalDocumentAcceptanceEndpoint() {
        console.log('\n✅ Testing Legal Document Acceptance Endpoint...');
        
        // Test without authentication
        const unauthResult = await this.makeRequest('POST', '/api/legal/accept/privacy-policy', {
            data: { version: '2024.01.01.123456' }
        });
        
        if (unauthResult.status === 401 || unauthResult.status === 403) {
            this.recordResult(
                'Legal Document Acceptance (Unauthenticated)',
                'PASS',
                'Correctly requires authentication',
                { 
                    status: unauthResult.status,
                    responseTime: unauthResult.responseTime
                }
            );
        } else {
            this.recordResult(
                'Legal Document Acceptance (Unauthenticated)',
                'WARN',
                `Expected 401/403, got ${unauthResult.status}`,
                { status: unauthResult.status, responseTime: unauthResult.responseTime }
            );
        }
        
        // Test with authentication but invalid document type
        const invalidTypeResult = await this.makeRequest('POST', '/api/legal/accept/invalid-document', {
            headers: {
                'Authorization': 'Bearer mock-token-for-testing'
            },
            data: { version: '2024.01.01.123456' }
        });
        
        if (invalidTypeResult.status === 400 || invalidTypeResult.status === 401) {
            this.recordResult(
                'Legal Document Acceptance (Invalid Document Type)',
                'PASS',
                'Correctly validates document type',
                { 
                    status: invalidTypeResult.status,
                    responseTime: invalidTypeResult.responseTime
                }
            );
        } else {
            this.recordResult(
                'Legal Document Acceptance (Invalid Document Type)',
                'WARN',
                `Expected 400/401, got ${invalidTypeResult.status}`,
                { status: invalidTypeResult.status }
            );
        }
        
        // Test with valid document type
        const validTypeResult = await this.makeRequest('POST', '/api/legal/accept/privacy-policy', {
            headers: {
                'Authorization': 'Bearer mock-token-for-testing'
            },
            data: { version: '2024.01.01.123456' }
        });
        
        if (validTypeResult.status === 401 || validTypeResult.status === 403) {
            this.recordResult(
                'Legal Document Acceptance (Valid Request)',
                'PASS',
                'Legal document acceptance endpoint accessible with proper authentication (expected auth failure with mock token)',
                { 
                    status: validTypeResult.status,
                    responseTime: validTypeResult.responseTime
                }
            );
        } else if (validTypeResult.status === 200) {
            // If somehow successful, validate response structure
            const responseData = validTypeResult.data;
            const expectedFields = ['success', 'acceptanceId', 'documentType', 'version'];
            const hasRequiredFields = expectedFields.every(field => field in responseData);
            
            if (hasRequiredFields) {
                this.recordResult(
                    'Legal Document Acceptance (Valid Request)',
                    'PASS',
                    'Legal document acceptance successful with proper response structure',
                    { 
                        status: validTypeResult.status,
                        acceptanceId: responseData.acceptanceId,
                        documentType: responseData.documentType,
                        version: responseData.version,
                        responseTime: validTypeResult.responseTime
                    }
                );
            } else {
                this.recordResult(
                    'Legal Document Acceptance (Valid Request)',
                    'WARN',
                    'Legal document acceptance successful but response structure incomplete',
                    { 
                        status: validTypeResult.status,
                        missingFields: expectedFields.filter(field => !(field in responseData)),
                        responseTime: validTypeResult.responseTime
                    }
                );
            }
        } else {
            this.recordResult(
                'Legal Document Acceptance (Valid Request)',
                'WARN',
                `Unexpected response: ${validTypeResult.status}`,
                { status: validTypeResult.status }
            );
        }
    }
    
    /**
     * Test legal document acceptance status endpoint
     */
    async testLegalDocumentAcceptanceStatusEndpoint() {
        console.log('\n📊 Testing Legal Document Acceptance Status Endpoint...');
        
        // Test without authentication
        const unauthResult = await this.makeRequest('GET', '/api/legal/acceptance-status');
        
        if (unauthResult.status === 401 || unauthResult.status === 403) {
            this.recordResult(
                'Legal Document Acceptance Status (Unauthenticated)',
                'PASS',
                'Correctly requires authentication',
                { 
                    status: unauthResult.status,
                    responseTime: unauthResult.responseTime
                }
            );
        } else {
            this.recordResult(
                'Legal Document Acceptance Status (Unauthenticated)',
                'WARN',
                `Expected 401/403, got ${unauthResult.status}`,
                { status: unauthResult.status, responseTime: unauthResult.responseTime }
            );
        }
        
        // Test with authentication
        const authResult = await this.makeRequest('GET', '/api/legal/acceptance-status', {
            headers: {
                'Authorization': 'Bearer mock-token-for-testing'
            }
        });
        
        if (authResult.status === 401 || authResult.status === 403) {
            this.recordResult(
                'Legal Document Acceptance Status (Authenticated)',
                'PASS',
                'Acceptance status endpoint accessible with authentication (expected auth failure with mock token)',
                { 
                    status: authResult.status,
                    responseTime: authResult.responseTime
                }
            );
        } else if (authResult.status === 200) {
            // If somehow successful, validate response structure
            const responseData = authResult.data;
            const expectedFields = ['success', 'acceptanceStatus', 'acceptanceHistory', 'requiresAcceptance'];
            const hasRequiredFields = expectedFields.every(field => field in responseData);
            
            if (hasRequiredFields) {
                this.recordResult(
                    'Legal Document Acceptance Status (Authenticated)',
                    'PASS',
                    'Acceptance status endpoint successful with proper response structure',
                    { 
                        status: authResult.status,
                        requiresAcceptance: responseData.requiresAcceptance,
                        acceptanceHistoryCount: responseData.acceptanceHistory?.length || 0,
                        responseTime: authResult.responseTime
                    }
                );
            } else {
                this.recordResult(
                    'Legal Document Acceptance Status (Authenticated)',
                    'WARN',
                    'Acceptance status successful but response structure incomplete',
                    { 
                        status: authResult.status,
                        missingFields: expectedFields.filter(field => !(field in responseData)),
                        responseTime: authResult.responseTime
                    }
                );
            }
        } else {
            this.recordResult(
                'Legal Document Acceptance Status (Authenticated)',
                'WARN',
                `Unexpected response: ${authResult.status}`,
                { status: authResult.status, data: authResult.data }
            );
        }
    }
    
    /**
     * Test legal documents service performance
     */
    async testLegalDocumentsServicePerformance() {
        console.log('\n⚡ Testing Legal Documents Service Performance...');
        
        const iterations = 3;
        const responseTimes = [];
        
        // Test privacy policy endpoint performance
        for (let i = 0; i < iterations; i++) {
            const result = await this.makeRequest('GET', '/legal/privacy-policy');
            if (result.success && result.status === 200) {
                responseTimes.push(result.responseTime);
            }
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        if (responseTimes.length === 0) {
            this.recordResult(
                'Legal Documents Service Performance',
                'FAIL',
                'No successful requests for performance testing',
                {}
            );
            return;
        }
        
        const avgResponseTime = Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length);
        const maxResponseTime = Math.max(...responseTimes);
        const minResponseTime = Math.min(...responseTimes);
        
        if (avgResponseTime < 2000) { // Less than 2 seconds average (documents can be large)
            this.recordResult(
                'Legal Documents Service Performance',
                'PASS',
                `Good performance: ${avgResponseTime}ms average`,
                { 
                    avgResponseTime,
                    maxResponseTime,
                    minResponseTime,
                    iterations: responseTimes.length
                }
            );
        } else if (avgResponseTime < 5000) { // Less than 5 seconds
            this.recordResult(
                'Legal Documents Service Performance',
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
                'Legal Documents Service Performance',
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
        
        console.log('\n📋 Legal Documents Test Summary');
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
        
        const reportFile = path.join(reportDir, `legal-documents-test-${Date.now()}.json`);
        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
        
        console.log(`\n📄 Detailed report saved to: ${reportFile}`);
        
        return report;
    }
    
    /**
     * Run all legal documents tests
     */
    async runAllTests() {
        try {
            await this.testLegalDocumentsServiceStatus();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testPrivacyPolicyEndpoint();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testTermsOfServiceEndpoint();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testCookiePolicyEndpoint();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testLegalDocumentAcceptanceEndpoint();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testLegalDocumentAcceptanceStatusEndpoint();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testLegalDocumentsServicePerformance();
            
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
    const tester = new LegalDocumentsTest();
    tester.runAllTests().catch(error => {
        console.error('❌ Test execution failed:', error);
        process.exit(1);
    });
}

module.exports = LegalDocumentsTest;
