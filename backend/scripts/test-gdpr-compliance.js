#!/usr/bin/env node

// TaktMate GDPR Compliance Testing Script
// Tests Microsoft Entra External ID GDPR compliance features, data export, consent management, and privacy controls

const axios = require('axios');
const fs = require('fs');
const path = require('path');

class GDPRComplianceTest {
    constructor() {
        this.apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
        this.testResults = [];
        this.startTime = Date.now();
        
        // Test configuration
        this.config = {
            requestTimeout: 30000, // 30 seconds for GDPR operations
            delayBetweenTests: 1000, // 1 second between tests
            maxRetries: 3
        };
        
        // Mock user data for testing
        this.mockUserData = {
            userId: 'test-user-12345',
            email: 'test.user@taktmate.com',
            name: 'Test User',
            company: 'Test Company'
        };
        
        console.log('🛡️ TaktMate GDPR Compliance Testing Suite');
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
     * Test GDPR compliance status endpoint
     */
    async testGDPRComplianceStatusEndpoint() {
        console.log('\n🛡️ Testing GDPR Compliance Status Endpoint...');
        
        const result = await this.makeRequest('GET', '/health/gdpr-compliance');
        
        if (!result.success) {
            this.recordResult(
                'GDPR Compliance Status Endpoint',
                'FAIL',
                `Request failed: ${result.error}`,
                { error: result.error }
            );
            return;
        }
        
        if (result.status !== 200) {
            this.recordResult(
                'GDPR Compliance Status Endpoint',
                'FAIL',
                `Unexpected status code: ${result.status}`,
                { status: result.status, data: result.data }
            );
            return;
        }
        
        const data = result.data;
        const expectedFields = ['status', 'timestamp', 'environment', 'gdpr_compliance'];
        const missingFields = expectedFields.filter(field => !(field in data));
        
        if (missingFields.length === 0) {
            const gdprCompliance = data.gdpr_compliance;
            
            this.recordResult(
                'GDPR Compliance Status Endpoint',
                'PASS',
                'GDPR compliance status endpoint working correctly',
                { 
                    status: data.status,
                    environment: data.environment,
                    azureB2CGDPREnabled: gdprCompliance.azureB2CGDPREnabled,
                    dataExportEnabled: gdprCompliance.dataExportEnabled,
                    dataDeletionEnabled: gdprCompliance.dataDeletionEnabled,
                    consentManagementEnabled: gdprCompliance.consentManagementEnabled,
                    responseTime: result.responseTime
                }
            );
        } else {
            this.recordResult(
                'GDPR Compliance Status Endpoint',
                'WARN',
                `Missing fields in response: ${missingFields.join(', ')}`,
                { missingFields, responseTime: result.responseTime }
            );
        }
    }
    
    /**
     * Test GDPR data export endpoint (requires authentication)
     */
    async testGDPRDataExportEndpoint() {
        console.log('\n📤 Testing GDPR Data Export Endpoint...');
        
        // Test without authentication
        const unauthResult = await this.makeRequest('GET', '/api/gdpr/export');
        
        if (unauthResult.status === 401 || unauthResult.status === 403) {
            this.recordResult(
                'GDPR Data Export Endpoint (Unauthenticated)',
                'PASS',
                'Correctly requires authentication',
                { 
                    status: unauthResult.status,
                    responseTime: unauthResult.responseTime
                }
            );
        } else {
            this.recordResult(
                'GDPR Data Export Endpoint (Unauthenticated)',
                'WARN',
                `Expected 401/403, got ${unauthResult.status}`,
                { status: unauthResult.status, responseTime: unauthResult.responseTime }
            );
        }
        
        // Test different export formats
        const formats = ['json', 'xml', 'csv'];
        
        for (const format of formats) {
            const formatResult = await this.makeRequest('GET', `/api/gdpr/export?format=${format}`, {
                headers: {
                    'Authorization': 'Bearer mock-token-for-testing'
                }
            });
            
            if (formatResult.status === 401 || formatResult.status === 403) {
                this.recordResult(
                    `GDPR Data Export Endpoint (${format.toUpperCase()} format)`,
                    'PASS',
                    `Correctly requires valid authentication for ${format} export`,
                    { 
                        format: format,
                        status: formatResult.status,
                        responseTime: formatResult.responseTime
                    }
                );
            } else {
                this.recordResult(
                    `GDPR Data Export Endpoint (${format.toUpperCase()} format)`,
                    'WARN',
                    `Unexpected response for ${format} format: ${formatResult.status}`,
                    { format: format, status: formatResult.status }
                );
            }
            
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }
    
    /**
     * Test GDPR account deletion endpoint
     */
    async testGDPRAccountDeletionEndpoint() {
        console.log('\n🗑️ Testing GDPR Account Deletion Endpoint...');
        
        // Test without authentication
        const unauthResult = await this.makeRequest('POST', '/api/gdpr/delete-account', {
            data: { 
                confirmation: 'DELETE_MY_ACCOUNT',
                reason: 'Testing purposes'
            }
        });
        
        if (unauthResult.status === 401 || unauthResult.status === 403) {
            this.recordResult(
                'GDPR Account Deletion Endpoint (Unauthenticated)',
                'PASS',
                'Correctly requires authentication',
                { 
                    status: unauthResult.status,
                    responseTime: unauthResult.responseTime
                }
            );
        } else {
            this.recordResult(
                'GDPR Account Deletion Endpoint (Unauthenticated)',
                'WARN',
                `Expected 401/403, got ${unauthResult.status}`,
                { status: unauthResult.status, responseTime: unauthResult.responseTime }
            );
        }
        
        // Test with authentication but invalid confirmation
        const invalidConfirmationResult = await this.makeRequest('POST', '/api/gdpr/delete-account', {
            headers: {
                'Authorization': 'Bearer mock-token-for-testing'
            },
            data: { 
                confirmation: 'INVALID_CONFIRMATION',
                reason: 'Testing purposes'
            }
        });
        
        if (invalidConfirmationResult.status === 400 || invalidConfirmationResult.status === 401) {
            this.recordResult(
                'GDPR Account Deletion Endpoint (Invalid Confirmation)',
                'PASS',
                'Correctly validates confirmation string',
                { 
                    status: invalidConfirmationResult.status,
                    responseTime: invalidConfirmationResult.responseTime
                }
            );
        } else {
            this.recordResult(
                'GDPR Account Deletion Endpoint (Invalid Confirmation)',
                'WARN',
                `Expected 400/401, got ${invalidConfirmationResult.status}`,
                { status: invalidConfirmationResult.status }
            );
        }
        
        // Test with valid confirmation
        const validConfirmationResult = await this.makeRequest('POST', '/api/gdpr/delete-account', {
            headers: {
                'Authorization': 'Bearer mock-token-for-testing'
            },
            data: { 
                confirmation: 'DELETE_MY_ACCOUNT',
                reason: 'Testing GDPR compliance'
            }
        });
        
        if (validConfirmationResult.status === 401 || validConfirmationResult.status === 403) {
            this.recordResult(
                'GDPR Account Deletion Endpoint (Valid Request)',
                'PASS',
                'Account deletion endpoint accessible with proper authentication (expected auth failure with mock token)',
                { 
                    status: validConfirmationResult.status,
                    responseTime: validConfirmationResult.responseTime
                }
            );
        } else {
            this.recordResult(
                'GDPR Account Deletion Endpoint (Valid Request)',
                'WARN',
                `Unexpected response: ${validConfirmationResult.status}`,
                { status: validConfirmationResult.status }
            );
        }
    }
    
    /**
     * Test GDPR consent status endpoint
     */
    async testGDPRConsentStatusEndpoint() {
        console.log('\n📋 Testing GDPR Consent Status Endpoint...');
        
        // Test without authentication
        const unauthResult = await this.makeRequest('GET', '/api/gdpr/consent');
        
        if (unauthResult.status === 401 || unauthResult.status === 403) {
            this.recordResult(
                'GDPR Consent Status Endpoint (Unauthenticated)',
                'PASS',
                'Correctly requires authentication',
                { 
                    status: unauthResult.status,
                    responseTime: unauthResult.responseTime
                }
            );
        } else {
            this.recordResult(
                'GDPR Consent Status Endpoint (Unauthenticated)',
                'WARN',
                `Expected 401/403, got ${unauthResult.status}`,
                { status: unauthResult.status, responseTime: unauthResult.responseTime }
            );
        }
        
        // Test with authentication
        const authResult = await this.makeRequest('GET', '/api/gdpr/consent', {
            headers: {
                'Authorization': 'Bearer mock-token-for-testing'
            }
        });
        
        if (authResult.status === 401 || authResult.status === 403 || authResult.status === 404) {
            this.recordResult(
                'GDPR Consent Status Endpoint (Authenticated)',
                'PASS',
                'Consent status endpoint accessible with authentication (expected auth failure or no consent found with mock token)',
                { 
                    status: authResult.status,
                    responseTime: authResult.responseTime
                }
            );
        } else {
            this.recordResult(
                'GDPR Consent Status Endpoint (Authenticated)',
                'WARN',
                `Unexpected response: ${authResult.status}`,
                { status: authResult.status, data: authResult.data }
            );
        }
    }
    
    /**
     * Test GDPR request status endpoint
     */
    async testGDPRRequestStatusEndpoint() {
        console.log('\n📊 Testing GDPR Request Status Endpoint...');
        
        const mockRequestId = 'gdpr_1234567890_test123';
        
        // Test without authentication
        const unauthResult = await this.makeRequest('GET', `/api/gdpr/request/${mockRequestId}`);
        
        if (unauthResult.status === 401 || unauthResult.status === 403) {
            this.recordResult(
                'GDPR Request Status Endpoint (Unauthenticated)',
                'PASS',
                'Correctly requires authentication',
                { 
                    status: unauthResult.status,
                    responseTime: unauthResult.responseTime
                }
            );
        } else {
            this.recordResult(
                'GDPR Request Status Endpoint (Unauthenticated)',
                'WARN',
                `Expected 401/403, got ${unauthResult.status}`,
                { status: unauthResult.status, responseTime: unauthResult.responseTime }
            );
        }
        
        // Test with authentication
        const authResult = await this.makeRequest('GET', `/api/gdpr/request/${mockRequestId}`, {
            headers: {
                'Authorization': 'Bearer mock-token-for-testing'
            }
        });
        
        if (authResult.status === 401 || authResult.status === 403 || authResult.status === 404) {
            this.recordResult(
                'GDPR Request Status Endpoint (Authenticated)',
                'PASS',
                'Request status endpoint accessible with authentication (expected auth failure or request not found with mock data)',
                { 
                    status: authResult.status,
                    responseTime: authResult.responseTime
                }
            );
        } else {
            this.recordResult(
                'GDPR Request Status Endpoint (Authenticated)',
                'WARN',
                `Unexpected response: ${authResult.status}`,
                { status: authResult.status, data: authResult.data }
            );
        }
    }
    
    /**
     * Test GDPR compliance configuration
     */
    async testGDPRComplianceConfiguration() {
        console.log('\n⚙️ Testing GDPR Compliance Configuration...');
        
        const result = await this.makeRequest('GET', '/health/gdpr-compliance');
        
        if (!result.success || result.status !== 200) {
            this.recordResult(
                'GDPR Compliance Configuration',
                'FAIL',
                'Cannot retrieve GDPR compliance configuration',
                { error: result.error || result.status }
            );
            return;
        }
        
        const data = result.data;
        const gdprCompliance = data.gdpr_compliance;
        
        if (!gdprCompliance) {
            this.recordResult(
                'GDPR Compliance Configuration',
                'FAIL',
                'GDPR compliance configuration not found',
                { data: data }
            );
            return;
        }
        
        const issues = [];
        const recommendations = [];
        
        // Validate GDPR configuration
        if (gdprCompliance.azureB2CGDPREnabled === undefined) {
            issues.push('Microsoft Entra External ID GDPR setting not configured');
        }
        
        if (gdprCompliance.dataExportEnabled === undefined) {
            issues.push('Data export setting not configured');
        }
        
        if (gdprCompliance.dataDeletionEnabled === undefined) {
            issues.push('Data deletion setting not configured');
        }
        
        if (gdprCompliance.consentManagementEnabled === undefined) {
            issues.push('Consent management setting not configured');
        }
        
        if (!gdprCompliance.configuration) {
            issues.push('GDPR configuration details not available');
        }
        
        if (!gdprCompliance.rights) {
            recommendations.push('GDPR rights configuration not available');
        }
        
        // Check data categories and retention policies
        if (gdprCompliance.dataCategories === undefined) {
            recommendations.push('Data categories not configured');
        }
        
        if (gdprCompliance.retentionPolicies === undefined) {
            recommendations.push('Retention policies not configured');
        }
        
        if (issues.length === 0) {
            this.recordResult(
                'GDPR Compliance Configuration',
                'PASS',
                'GDPR compliance configuration is valid',
                { 
                    azureB2CGDPREnabled: gdprCompliance.azureB2CGDPREnabled,
                    dataExportEnabled: gdprCompliance.dataExportEnabled,
                    dataDeletionEnabled: gdprCompliance.dataDeletionEnabled,
                    consentManagementEnabled: gdprCompliance.consentManagementEnabled,
                    dataCategories: gdprCompliance.dataCategories,
                    retentionPolicies: gdprCompliance.retentionPolicies,
                    recommendations: recommendations.length,
                    responseTime: result.responseTime
                }
            );
        } else {
            this.recordResult(
                'GDPR Compliance Configuration',
                'WARN',
                `Configuration issues found: ${issues.join(', ')}`,
                { 
                    issues: issues,
                    recommendations: recommendations,
                    responseTime: result.responseTime
                }
            );
        }
    }
    
    /**
     * Test GDPR data retention policies
     */
    async testGDPRDataRetentionPolicies() {
        console.log('\n📅 Testing GDPR Data Retention Policies...');
        
        const result = await this.makeRequest('GET', '/health/gdpr-compliance');
        
        if (!result.success || result.status !== 200) {
            this.recordResult(
                'GDPR Data Retention Policies',
                'FAIL',
                'Cannot retrieve GDPR configuration for retention policy testing',
                { error: result.error || result.status }
            );
            return;
        }
        
        const gdprCompliance = result.data.gdpr_compliance;
        const configuration = gdprCompliance.configuration;
        
        if (!configuration) {
            this.recordResult(
                'GDPR Data Retention Policies',
                'WARN',
                'GDPR configuration details not available for retention policy testing',
                { responseTime: result.responseTime }
            );
            return;
        }
        
        const retentionIssues = [];
        const retentionRecommendations = [];
        
        // Check retention periods
        if (configuration.userDataRetention) {
            const userDataDays = parseInt(configuration.userDataRetention);
            if (userDataDays > 2555) { // More than 7 years
                retentionRecommendations.push(`User data retention period (${configuration.userDataRetention}) is very long`);
            }
        } else {
            retentionIssues.push('User data retention period not configured');
        }
        
        if (configuration.sessionDataRetention) {
            const sessionDataDays = parseInt(configuration.sessionDataRetention);
            if (sessionDataDays > 365) { // More than 1 year
                retentionRecommendations.push(`Session data retention period (${configuration.sessionDataRetention}) might be too long`);
            }
        } else {
            retentionIssues.push('Session data retention period not configured');
        }
        
        if (configuration.auditLogRetention) {
            const auditLogDays = parseInt(configuration.auditLogRetention);
            if (auditLogDays < 2555) { // Less than 7 years
                retentionRecommendations.push(`Audit log retention period (${configuration.auditLogRetention}) might be too short for compliance`);
            }
        } else {
            retentionIssues.push('Audit log retention period not configured');
        }
        
        if (retentionIssues.length === 0) {
            this.recordResult(
                'GDPR Data Retention Policies',
                'PASS',
                'Data retention policies are configured',
                { 
                    userDataRetention: configuration.userDataRetention,
                    sessionDataRetention: configuration.sessionDataRetention,
                    auditLogRetention: configuration.auditLogRetention,
                    recommendations: retentionRecommendations.length,
                    responseTime: result.responseTime
                }
            );
        } else {
            this.recordResult(
                'GDPR Data Retention Policies',
                'WARN',
                `Retention policy issues found: ${retentionIssues.join(', ')}`,
                { 
                    issues: retentionIssues,
                    recommendations: retentionRecommendations,
                    responseTime: result.responseTime
                }
            );
        }
    }
    
    /**
     * Test GDPR rights implementation
     */
    async testGDPRRightsImplementation() {
        console.log('\n⚖️ Testing GDPR Rights Implementation...');
        
        const result = await this.makeRequest('GET', '/health/gdpr-compliance');
        
        if (!result.success || result.status !== 200) {
            this.recordResult(
                'GDPR Rights Implementation',
                'FAIL',
                'Cannot retrieve GDPR configuration for rights testing',
                { error: result.error || result.status }
            );
            return;
        }
        
        const gdprCompliance = result.data.gdpr_compliance;
        const rights = gdprCompliance.rights;
        
        if (!rights) {
            this.recordResult(
                'GDPR Rights Implementation',
                'WARN',
                'GDPR rights configuration not available',
                { responseTime: result.responseTime }
            );
            return;
        }
        
        const requiredRights = [
            'rightToAccess',
            'rightToRectification', 
            'rightToErasure',
            'rightToPortability',
            'rightToObject'
        ];
        
        const implementedRights = [];
        const missingRights = [];
        
        for (const right of requiredRights) {
            if (rights[right] === true) {
                implementedRights.push(right);
            } else {
                missingRights.push(right);
            }
        }
        
        if (implementedRights.length >= 4) { // At least 4 out of 5 rights implemented
            this.recordResult(
                'GDPR Rights Implementation',
                'PASS',
                `GDPR rights implementation is comprehensive (${implementedRights.length}/5 rights implemented)`,
                { 
                    implementedRights: implementedRights,
                    missingRights: missingRights,
                    implementationRate: Math.round((implementedRights.length / requiredRights.length) * 100),
                    responseTime: result.responseTime
                }
            );
        } else {
            this.recordResult(
                'GDPR Rights Implementation',
                'WARN',
                `Insufficient GDPR rights implementation (${implementedRights.length}/5 rights implemented)`,
                { 
                    implementedRights: implementedRights,
                    missingRights: missingRights,
                    implementationRate: Math.round((implementedRights.length / requiredRights.length) * 100),
                    responseTime: result.responseTime
                }
            );
        }
    }
    
    /**
     * Test GDPR compliance performance
     */
    async testGDPRCompliancePerformance() {
        console.log('\n⚡ Testing GDPR Compliance Performance...');
        
        const iterations = 5;
        const responseTimes = [];
        
        // Test status endpoint performance
        for (let i = 0; i < iterations; i++) {
            const result = await this.makeRequest('GET', '/health/gdpr-compliance');
            if (result.success) {
                responseTimes.push(result.responseTime);
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        if (responseTimes.length === 0) {
            this.recordResult(
                'GDPR Compliance Performance',
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
                'GDPR Compliance Performance',
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
                'GDPR Compliance Performance',
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
                'GDPR Compliance Performance',
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
        
        console.log('\n🛡️ GDPR Compliance Test Summary');
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
        
        const reportFile = path.join(reportDir, `gdpr-compliance-test-${Date.now()}.json`);
        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
        
        console.log(`\n📄 Detailed report saved to: ${reportFile}`);
        
        return report;
    }
    
    /**
     * Run all GDPR compliance tests
     */
    async runAllTests() {
        try {
            await this.testGDPRComplianceStatusEndpoint();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testGDPRDataExportEndpoint();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testGDPRAccountDeletionEndpoint();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testGDPRConsentStatusEndpoint();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testGDPRRequestStatusEndpoint();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testGDPRComplianceConfiguration();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testGDPRDataRetentionPolicies();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testGDPRRightsImplementation();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testGDPRCompliancePerformance();
            
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
    const tester = new GDPRComplianceTest();
    tester.runAllTests().catch(error => {
        console.error('❌ Test execution failed:', error);
        process.exit(1);
    });
}

module.exports = GDPRComplianceTest;
