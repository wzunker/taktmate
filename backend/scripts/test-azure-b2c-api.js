#!/usr/bin/env node

// TaktMate Microsoft Entra External ID API Service Testing Script
// Tests Microsoft Graph API integration, user data export, and Microsoft Entra External ID API functionality

const axios = require('axios');
const fs = require('fs');
const path = require('path');

class AzureB2CApiTest {
    constructor() {
        this.apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
        this.testResults = [];
        this.startTime = Date.now();
        
        // Test configuration
        this.config = {
            requestTimeout: 30000, // 30 seconds for API operations
            delayBetweenTests: 1000, // 1 second between tests
            maxRetries: 3
        };
        
        // Mock user data for testing
        this.mockUserData = {
            userId: 'test-user-b2c-12345',
            email: 'test.user@taktmate.onmicrosoft.com',
            name: 'Microsoft Entra External ID Test User'
        };
        
        console.log('🔗 TaktMate Microsoft Entra External ID API Testing Suite');
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
     * Test GDPR compliance status with Microsoft Entra External ID API integration
     */
    async testGDPRComplianceWithAzureB2C() {
        console.log('\n🔗 Testing GDPR Compliance with Microsoft Entra External ID API Integration...');
        
        const result = await this.makeRequest('GET', '/health/gdpr-compliance');
        
        if (!result.success) {
            this.recordResult(
                'GDPR Compliance with Microsoft Entra External ID API',
                'FAIL',
                `Request failed: ${result.error}`,
                { error: result.error }
            );
            return;
        }
        
        if (result.status !== 200) {
            this.recordResult(
                'GDPR Compliance with Microsoft Entra External ID API',
                'FAIL',
                `Unexpected status code: ${result.status}`,
                { status: result.status, data: result.data }
            );
            return;
        }
        
        const data = result.data;
        const gdprCompliance = data.gdpr_compliance;
        
        if (!gdprCompliance) {
            this.recordResult(
                'GDPR Compliance with Microsoft Entra External ID API',
                'FAIL',
                'GDPR compliance data not found',
                { data: data }
            );
            return;
        }
        
        // Check if Microsoft Entra External ID API service is integrated
        const entraExternalIdApiService = gdprCompliance.entraExternalIdApiService;
        
        if (!entraExternalIdApiService) {
            this.recordResult(
                'GDPR Compliance with Microsoft Entra External ID API',
                'WARN',
                'Microsoft Entra External ID API Service integration not found',
                { gdprCompliance: gdprCompliance }
            );
            return;
        }
        
        if (entraExternalIdApiService.error) {
            this.recordResult(
                'GDPR Compliance with Microsoft Entra External ID API',
                'WARN',
                `Microsoft Entra External ID API Service error: ${entraExternalIdApiService.error}`,
                { error: entraExternalIdApiService.error, responseTime: result.responseTime }
            );
            return;
        }
        
        // Validate Microsoft Entra External ID API service configuration
        const config = entraExternalIdApiService.configuration;
        const issues = [];
        
        if (!config.graphApiBaseUrl) {
            issues.push('Graph API base URL not configured');
        }
        
        if (!config.tenantId || config.tenantId === 'Not configured') {
            issues.push('Tenant ID not configured');
        }
        
        if (config.enableUserProfile === undefined) {
            issues.push('User profile export setting not configured');
        }
        
        if (config.enableSignInActivity === undefined) {
            issues.push('Sign-in activity export setting not configured');
        }
        
        if (issues.length === 0) {
            this.recordResult(
                'GDPR Compliance with Microsoft Entra External ID API',
                'PASS',
                'Microsoft Entra External ID API Service successfully integrated with GDPR compliance',
                { 
                    graphApiBaseUrl: config.graphApiBaseUrl,
                    tenantId: config.tenantId,
                    enableUserProfile: config.enableUserProfile,
                    enableSignInActivity: config.enableSignInActivity,
                    enableAuditLogs: config.enableAuditLogs,
                    enableDirectoryObjects: config.enableDirectoryObjects,
                    requestsTotal: entraExternalIdApiService.requestsTotal,
                    requestsSuccessful: entraExternalIdApiService.requestsSuccessful,
                    dataExportsCompleted: entraExternalIdApiService.dataExportsCompleted,
                    responseTime: result.responseTime
                }
            );
        } else {
            this.recordResult(
                'GDPR Compliance with Microsoft Entra External ID API',
                'WARN',
                `Microsoft Entra External ID API configuration issues: ${issues.join(', ')}`,
                { 
                    issues: issues,
                    configuration: config,
                    responseTime: result.responseTime
                }
            );
        }
    }
    
    /**
     * Test Microsoft Entra External ID API service statistics
     */
    async testAzureB2CApiStatistics() {
        console.log('\n📊 Testing Microsoft Entra External ID API Service Statistics...');
        
        const result = await this.makeRequest('GET', '/health/gdpr-compliance');
        
        if (!result.success || result.status !== 200) {
            this.recordResult(
                'Microsoft Entra External ID API Statistics',
                'FAIL',
                'Cannot retrieve GDPR compliance data for statistics testing',
                { error: result.error || result.status }
            );
            return;
        }
        
        const gdprCompliance = result.data.gdpr_compliance;
        const entraExternalIdApiService = gdprCompliance?.entraExternalIdApiService;
        
        if (!entraExternalIdApiService || entraExternalIdApiService.error) {
            this.recordResult(
                'Microsoft Entra External ID API Statistics',
                'WARN',
                'Microsoft Entra External ID API Service statistics not available',
                { error: entraExternalIdApiService?.error || 'Service not initialized' }
            );
            return;
        }
        
        // Validate statistics structure
        const expectedStats = [
            'requestsTotal',
            'requestsSuccessful',
            'requestsFailed',
            'cacheHits',
            'cacheMisses',
            'dataExportsCompleted',
            'averageResponseTime'
        ];
        
        const missingStats = expectedStats.filter(stat => 
            entraExternalIdApiService[stat] === undefined
        );
        
        if (missingStats.length === 0) {
            const successRate = entraExternalIdApiService.requestsTotal > 0 ? 
                (entraExternalIdApiService.requestsSuccessful / entraExternalIdApiService.requestsTotal * 100).toFixed(1) : 0;
            
            const cacheHitRate = (entraExternalIdApiService.cacheHits + entraExternalIdApiService.cacheMisses) > 0 ? 
                (entraExternalIdApiService.cacheHits / (entraExternalIdApiService.cacheHits + entraExternalIdApiService.cacheMisses) * 100).toFixed(1) : 0;
            
            this.recordResult(
                'Microsoft Entra External ID API Statistics',
                'PASS',
                'Microsoft Entra External ID API Service statistics are comprehensive',
                { 
                    requestsTotal: entraExternalIdApiService.requestsTotal,
                    requestsSuccessful: entraExternalIdApiService.requestsSuccessful,
                    requestsFailed: entraExternalIdApiService.requestsFailed,
                    successRate: successRate + '%',
                    cacheHits: entraExternalIdApiService.cacheHits,
                    cacheMisses: entraExternalIdApiService.cacheMisses,
                    cacheHitRate: cacheHitRate + '%',
                    dataExportsCompleted: entraExternalIdApiService.dataExportsCompleted,
                    averageResponseTime: entraExternalIdApiService.averageResponseTime + 'ms',
                    responseTime: result.responseTime
                }
            );
        } else {
            this.recordResult(
                'Microsoft Entra External ID API Statistics',
                'WARN',
                `Missing statistics fields: ${missingStats.join(', ')}`,
                { 
                    missingStats: missingStats,
                    availableStats: Object.keys(entraExternalIdApiService),
                    responseTime: result.responseTime
                }
            );
        }
    }
    
    /**
     * Test Microsoft Entra External ID API cache configuration
     */
    async testAzureB2CApiCacheConfiguration() {
        console.log('\n🗄️ Testing Microsoft Entra External ID API Cache Configuration...');
        
        const result = await this.makeRequest('GET', '/health/gdpr-compliance');
        
        if (!result.success || result.status !== 200) {
            this.recordResult(
                'Microsoft Entra External ID API Cache Configuration',
                'FAIL',
                'Cannot retrieve GDPR compliance data for cache testing',
                { error: result.error || result.status }
            );
            return;
        }
        
        const gdprCompliance = result.data.gdpr_compliance;
        const entraExternalIdApiService = gdprCompliance?.entraExternalIdApiService;
        
        if (!entraExternalIdApiService || entraExternalIdApiService.error) {
            this.recordResult(
                'Microsoft Entra External ID API Cache Configuration',
                'WARN',
                'Microsoft Entra External ID API Service cache configuration not available',
                { error: entraExternalIdApiService?.error || 'Service not initialized' }
            );
            return;
        }
        
        const cache = entraExternalIdApiService.cache;
        
        if (!cache) {
            this.recordResult(
                'Microsoft Entra External ID API Cache Configuration',
                'WARN',
                'Cache configuration not found in Microsoft Entra External ID API Service',
                { entraExternalIdApiService: entraExternalIdApiService }
            );
            return;
        }
        
        const cacheIssues = [];
        const cacheRecommendations = [];
        
        if (cache.size === undefined) {
            cacheIssues.push('Cache size not reported');
        }
        
        if (cache.maxSize === undefined) {
            cacheIssues.push('Cache max size not configured');
        }
        
        if (cache.ttl === undefined) {
            cacheIssues.push('Cache TTL not configured');
        }
        
        if (cache.lastCleanup === undefined) {
            cacheIssues.push('Cache cleanup status not reported');
        }
        
        // Check cache efficiency
        if (cache.size !== undefined && cache.maxSize !== undefined) {
            const cacheUsage = (cache.size / cache.maxSize * 100);
            if (cacheUsage > 80) {
                cacheRecommendations.push(`Cache usage is high (${cacheUsage.toFixed(1)}%)`);
            }
        }
        
        if (cacheIssues.length === 0) {
            this.recordResult(
                'Microsoft Entra External ID API Cache Configuration',
                'PASS',
                'Microsoft Entra External ID API Service cache configuration is valid',
                { 
                    cacheSize: cache.size,
                    maxSize: cache.maxSize,
                    ttl: cache.ttl,
                    lastCleanup: cache.lastCleanup,
                    recommendations: cacheRecommendations.length,
                    responseTime: result.responseTime
                }
            );
        } else {
            this.recordResult(
                'Microsoft Entra External ID API Cache Configuration',
                'WARN',
                `Cache configuration issues: ${cacheIssues.join(', ')}`,
                { 
                    issues: cacheIssues,
                    recommendations: cacheRecommendations,
                    cache: cache,
                    responseTime: result.responseTime
                }
            );
        }
    }
    
    /**
     * Test Microsoft Entra External ID API token management
     */
    async testAzureB2CApiTokenManagement() {
        console.log('\n🔐 Testing Microsoft Entra External ID API Token Management...');
        
        const result = await this.makeRequest('GET', '/health/gdpr-compliance');
        
        if (!result.success || result.status !== 200) {
            this.recordResult(
                'Microsoft Entra External ID API Token Management',
                'FAIL',
                'Cannot retrieve GDPR compliance data for token testing',
                { error: result.error || result.status }
            );
            return;
        }
        
        const gdprCompliance = result.data.gdpr_compliance;
        const entraExternalIdApiService = gdprCompliance?.entraExternalIdApiService;
        
        if (!entraExternalIdApiService || entraExternalIdApiService.error) {
            this.recordResult(
                'Microsoft Entra External ID API Token Management',
                'WARN',
                'Microsoft Entra External ID API Service token management not available',
                { error: entraExternalIdApiService?.error || 'Service not initialized' }
            );
            return;
        }
        
        const token = entraExternalIdApiService.token;
        
        if (!token) {
            this.recordResult(
                'Microsoft Entra External ID API Token Management',
                'WARN',
                'Token management information not found in Microsoft Entra External ID API Service',
                { entraExternalIdApiService: entraExternalIdApiService }
            );
            return;
        }
        
        const tokenIssues = [];
        const tokenRecommendations = [];
        
        if (token.hasToken === undefined) {
            tokenIssues.push('Token presence status not reported');
        }
        
        if (token.expiresAt === undefined) {
            tokenIssues.push('Token expiration not reported');
        }
        
        if (token.timeUntilExpiry === undefined) {
            tokenIssues.push('Time until token expiry not calculated');
        }
        
        // Check token expiry
        if (token.timeUntilExpiry !== undefined) {
            const minutesUntilExpiry = token.timeUntilExpiry / 1000 / 60;
            
            if (minutesUntilExpiry < 5) {
                tokenRecommendations.push(`Token expires soon (${minutesUntilExpiry.toFixed(1)} minutes)`);
            } else if (minutesUntilExpiry < 15) {
                tokenRecommendations.push(`Token expires within 15 minutes (${minutesUntilExpiry.toFixed(1)} minutes)`);
            }
        }
        
        if (tokenIssues.length === 0) {
            this.recordResult(
                'Microsoft Entra External ID API Token Management',
                'PASS',
                'Microsoft Entra External ID API Service token management is functional',
                { 
                    hasToken: token.hasToken,
                    expiresAt: token.expiresAt,
                    timeUntilExpiry: token.timeUntilExpiry ? Math.round(token.timeUntilExpiry / 1000 / 60) + ' minutes' : null,
                    recommendations: tokenRecommendations.length,
                    responseTime: result.responseTime
                }
            );
        } else {
            this.recordResult(
                'Microsoft Entra External ID API Token Management',
                'WARN',
                `Token management issues: ${tokenIssues.join(', ')}`,
                { 
                    issues: tokenIssues,
                    recommendations: tokenRecommendations,
                    token: token,
                    responseTime: result.responseTime
                }
            );
        }
    }
    
    /**
     * Test GDPR data export with Microsoft Entra External ID API integration
     */
    async testGDPRDataExportWithAzureB2C() {
        console.log('\n📤 Testing GDPR Data Export with Microsoft Entra External ID API Integration...');
        
        // Test data export endpoint (requires authentication)
        const exportResult = await this.makeRequest('GET', '/api/gdpr/export?format=json', {
            headers: {
                'Authorization': 'Bearer mock-token-for-testing'
            }
        });
        
        if (exportResult.status === 401 || exportResult.status === 403) {
            this.recordResult(
                'GDPR Data Export with Microsoft Entra External ID API',
                'PASS',
                'Data export endpoint correctly requires authentication (Microsoft Entra External ID API integration ready)',
                { 
                    status: exportResult.status,
                    responseTime: exportResult.responseTime
                }
            );
        } else if (exportResult.status === 200) {
            // If somehow it returns 200, check if it contains Microsoft Entra External ID data structure
            const hasAzureB2CStructure = exportResult.data && 
                (exportResult.data.azureAdB2CData || 
                 (typeof exportResult.data === 'string' && exportResult.data.includes('azureAdB2CData')));
            
            if (hasAzureB2CStructure) {
                this.recordResult(
                    'GDPR Data Export with Microsoft Entra External ID API',
                    'PASS',
                    'Data export includes Microsoft Entra External ID data structure',
                    { 
                        status: exportResult.status,
                        hasAzureB2CData: true,
                        dataSize: exportResult.data?.length || 0,
                        responseTime: exportResult.responseTime
                    }
                );
            } else {
                this.recordResult(
                    'GDPR Data Export with Microsoft Entra External ID API',
                    'WARN',
                    'Data export successful but Microsoft Entra External ID data structure not detected',
                    { 
                        status: exportResult.status,
                        hasAzureB2CData: false,
                        responseTime: exportResult.responseTime
                    }
                );
            }
        } else {
            this.recordResult(
                'GDPR Data Export with Microsoft Entra External ID API',
                'WARN',
                `Unexpected response from data export endpoint: ${exportResult.status}`,
                { 
                    status: exportResult.status,
                    data: exportResult.data,
                    responseTime: exportResult.responseTime
                }
            );
        }
    }
    
    /**
     * Test Microsoft Entra External ID API service performance
     */
    async testAzureB2CApiPerformance() {
        console.log('\n⚡ Testing Microsoft Entra External ID API Service Performance...');
        
        const iterations = 3;
        const responseTimes = [];
        
        // Test GDPR compliance endpoint performance multiple times
        for (let i = 0; i < iterations; i++) {
            const result = await this.makeRequest('GET', '/health/gdpr-compliance');
            if (result.success && result.status === 200) {
                responseTimes.push(result.responseTime);
            }
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        if (responseTimes.length === 0) {
            this.recordResult(
                'Microsoft Entra External ID API Service Performance',
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
                'Microsoft Entra External ID API Service Performance',
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
                'Microsoft Entra External ID API Service Performance',
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
                'Microsoft Entra External ID API Service Performance',
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
        
        console.log('\n🔗 Microsoft Entra External ID API Test Summary');
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
        
        const reportFile = path.join(reportDir, `azure-b2c-api-test-${Date.now()}.json`);
        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
        
        console.log(`\n📄 Detailed report saved to: ${reportFile}`);
        
        return report;
    }
    
    /**
     * Run all Microsoft Entra External ID API tests
     */
    async runAllTests() {
        try {
            await this.testGDPRComplianceWithAzureB2C();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testAzureB2CApiStatistics();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testAzureB2CApiCacheConfiguration();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testAzureB2CApiTokenManagement();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testGDPRDataExportWithAzureB2C();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testAzureB2CApiPerformance();
            
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
    const tester = new AzureB2CApiTest();
    tester.runAllTests().catch(error => {
        console.error('❌ Test execution failed:', error);
        process.exit(1);
    });
}

module.exports = AzureB2CApiTest;
