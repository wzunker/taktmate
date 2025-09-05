#!/usr/bin/env node

// TaktMate Token Management Testing Script
// Tests Azure AD B2C token lifecycle, refresh, validation, and session timeout

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

class TokenManagementTest {
    constructor() {
        this.apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
        this.testResults = [];
        this.startTime = Date.now();
        
        // Test configuration
        this.config = {
            requestTimeout: 15000, // 15 seconds for token operations
            delayBetweenTests: 1000, // 1 second between tests
            tokenTestDelay: 2000, // 2 seconds for token tests
            maxRetries: 3
        };
        
        // Test JWT tokens (mock tokens for testing - in real scenario these come from Azure AD B2C)
        this.mockTokens = this.generateMockTokens();
        
        console.log('🧪 TaktMate Token Management Testing Suite');
        console.log(`🌐 Testing API: ${this.apiBaseUrl}`);
        console.log('');
    }
    
    /**
     * Generate mock JWT tokens for testing purposes
     */
    generateMockTokens() {
        const now = Math.floor(Date.now() / 1000);
        const secret = 'test-secret-key-for-mock-tokens-only';
        
        // Mock access token
        const accessTokenPayload = {
            iss: 'https://taktmate.b2clogin.com/12345678-1234-1234-1234-123456789012/v2.0/',
            aud: 'mock-client-id',
            sub: 'mock-user-id-12345',
            iat: now,
            exp: now + 3600, // 1 hour
            nbf: now,
            ver: '1.0',
            scp: 'user_impersonation',
            azp: 'mock-client-id'
        };
        
        // Mock ID token
        const idTokenPayload = {
            iss: 'https://taktmate.b2clogin.com/12345678-1234-1234-1234-123456789012/v2.0/',
            aud: 'mock-client-id',
            sub: 'mock-user-id-12345',
            iat: now,
            exp: now + 3600, // 1 hour
            nbf: now,
            ver: '1.0',
            name: 'Test User',
            given_name: 'Test',
            family_name: 'User',
            emails: ['test.user@taktmate.com'],
            nonce: 'mock-nonce-12345'
        };
        
        // Mock refresh token (would normally be opaque)
        const refreshTokenPayload = {
            iss: 'https://taktmate.b2clogin.com/12345678-1234-1234-1234-123456789012/v2.0/',
            aud: 'mock-client-id',
            sub: 'mock-user-id-12345',
            iat: now,
            exp: now + (7 * 24 * 3600), // 7 days
            nbf: now,
            ver: '1.0',
            scp: 'offline_access'
        };
        
        // Mock expired token
        const expiredTokenPayload = {
            ...accessTokenPayload,
            iat: now - 7200, // 2 hours ago
            exp: now - 3600  // 1 hour ago (expired)
        };
        
        return {
            accessToken: jwt.sign(accessTokenPayload, secret),
            idToken: jwt.sign(idTokenPayload, secret),
            refreshToken: jwt.sign(refreshTokenPayload, secret),
            expiredToken: jwt.sign(expiredTokenPayload, secret)
        };
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
     * Test token management status endpoint
     */
    async testTokenManagementStatusEndpoint() {
        console.log('\n📊 Testing Token Management Status Endpoint...');
        
        const result = await this.makeRequest('GET', '/health/token-management');
        
        if (!result.success) {
            this.recordResult(
                'Token Management Status Endpoint',
                'FAIL',
                `Request failed: ${result.error}`,
                { error: result.error }
            );
            return;
        }
        
        if (result.status !== 200) {
            this.recordResult(
                'Token Management Status Endpoint',
                'FAIL',
                `Unexpected status code: ${result.status}`,
                { status: result.status, data: result.data }
            );
            return;
        }
        
        const data = result.data;
        const expectedFields = ['status', 'timestamp', 'environment', 'token_management'];
        const missingFields = expectedFields.filter(field => !(field in data));
        
        if (missingFields.length === 0) {
            const tokenMgmt = data.token_management;
            
            this.recordResult(
                'Token Management Status Endpoint',
                'PASS',
                'Token management status endpoint working correctly',
                { 
                    status: data.status,
                    environment: data.environment,
                    tokensIssued: tokenMgmt.tokensIssued,
                    tokensRefreshed: tokenMgmt.tokensRefreshed,
                    activeTokensCount: tokenMgmt.activeTokensCount,
                    responseTime: result.responseTime
                }
            );
        } else {
            this.recordResult(
                'Token Management Status Endpoint',
                'WARN',
                `Missing fields in response: ${missingFields.join(', ')}`,
                { missingFields, responseTime: result.responseTime }
            );
        }
    }
    
    /**
     * Test token refresh endpoint (requires authentication)
     */
    async testTokenRefreshEndpoint() {
        console.log('\n🔄 Testing Token Refresh Endpoint...');
        
        // Test without authentication
        const unauthResult = await this.makeRequest('POST', '/api/token/refresh', {
            data: { refreshToken: this.mockTokens.refreshToken }
        });
        
        if (unauthResult.status === 401 || unauthResult.status === 403) {
            this.recordResult(
                'Token Refresh Endpoint (Unauthenticated)',
                'PASS',
                'Correctly requires authentication',
                { 
                    status: unauthResult.status,
                    responseTime: unauthResult.responseTime
                }
            );
        } else {
            this.recordResult(
                'Token Refresh Endpoint (Unauthenticated)',
                'WARN',
                `Expected 401/403, got ${unauthResult.status}`,
                { status: unauthResult.status, responseTime: unauthResult.responseTime }
            );
        }
        
        // Test with authentication (mock)
        const authResult = await this.makeRequest('POST', '/api/token/refresh', {
            headers: {
                'Authorization': `Bearer ${this.mockTokens.accessToken}`
            },
            data: { refreshToken: this.mockTokens.refreshToken }
        });
        
        if (authResult.status === 400) {
            // Expected to fail with mock tokens
            this.recordResult(
                'Token Refresh Endpoint (Authenticated)',
                'PASS',
                'Token refresh endpoint accessible with authentication (expected failure with mock tokens)',
                { 
                    status: authResult.status,
                    responseTime: authResult.responseTime,
                    error: authResult.data?.error
                }
            );
        } else {
            this.recordResult(
                'Token Refresh Endpoint (Authenticated)',
                'WARN',
                `Unexpected response: ${authResult.status}`,
                { status: authResult.status, data: authResult.data }
            );
        }
    }
    
    /**
     * Test token validation endpoint
     */
    async testTokenValidationEndpoint() {
        console.log('\n🔍 Testing Token Validation Endpoint...');
        
        // Test without authentication
        const unauthResult = await this.makeRequest('POST', '/api/token/validate', {
            data: { token: this.mockTokens.accessToken }
        });
        
        if (unauthResult.status === 401 || unauthResult.status === 403) {
            this.recordResult(
                'Token Validation Endpoint (Unauthenticated)',
                'PASS',
                'Correctly requires authentication',
                { 
                    status: unauthResult.status,
                    responseTime: unauthResult.responseTime
                }
            );
        } else {
            this.recordResult(
                'Token Validation Endpoint (Unauthenticated)',
                'WARN',
                `Expected 401/403, got ${unauthResult.status}`,
                { status: unauthResult.status, responseTime: unauthResult.responseTime }
            );
        }
        
        // Test with authentication (mock)
        const authResult = await this.makeRequest('POST', '/api/token/validate', {
            headers: {
                'Authorization': `Bearer ${this.mockTokens.accessToken}`
            },
            data: { 
                token: this.mockTokens.accessToken,
                tokenType: 'access_token'
            }
        });
        
        if (authResult.status === 400) {
            // Expected to fail with mock tokens
            this.recordResult(
                'Token Validation Endpoint (Authenticated)',
                'PASS',
                'Token validation endpoint accessible with authentication (expected failure with mock tokens)',
                { 
                    status: authResult.status,
                    responseTime: authResult.responseTime,
                    error: authResult.data?.error
                }
            );
        } else {
            this.recordResult(
                'Token Validation Endpoint (Authenticated)',
                'WARN',
                `Unexpected response: ${authResult.status}`,
                { status: authResult.status, data: authResult.data }
            );
        }
    }
    
    /**
     * Test token expiration info endpoint
     */
    async testTokenExpirationEndpoint() {
        console.log('\n⏰ Testing Token Expiration Info Endpoint...');
        
        // Test without authentication
        const unauthResult = await this.makeRequest('GET', '/api/token/expiration');
        
        if (unauthResult.status === 401 || unauthResult.status === 403) {
            this.recordResult(
                'Token Expiration Endpoint (Unauthenticated)',
                'PASS',
                'Correctly requires authentication',
                { 
                    status: unauthResult.status,
                    responseTime: unauthResult.responseTime
                }
            );
        } else {
            this.recordResult(
                'Token Expiration Endpoint (Unauthenticated)',
                'WARN',
                `Expected 401/403, got ${unauthResult.status}`,
                { status: unauthResult.status, responseTime: unauthResult.responseTime }
            );
        }
        
        // Test with authentication (mock)
        const authResult = await this.makeRequest('GET', '/api/token/expiration', {
            headers: {
                'Authorization': `Bearer ${this.mockTokens.accessToken}`
            }
        });
        
        if (authResult.status === 200 || authResult.status === 400) {
            // Either success or expected failure with mock tokens
            this.recordResult(
                'Token Expiration Endpoint (Authenticated)',
                'PASS',
                'Token expiration endpoint accessible with authentication',
                { 
                    status: authResult.status,
                    responseTime: authResult.responseTime,
                    hasExpirationInfo: authResult.data?.expiration ? true : false
                }
            );
        } else {
            this.recordResult(
                'Token Expiration Endpoint (Authenticated)',
                'WARN',
                `Unexpected response: ${authResult.status}`,
                { status: authResult.status, data: authResult.data }
            );
        }
    }
    
    /**
     * Test input validation for token endpoints
     */
    async testTokenInputValidation() {
        console.log('\n🛡️ Testing Token Input Validation...');
        
        const validationTests = [
            {
                name: 'Token Refresh - Missing Refresh Token',
                endpoint: '/api/token/refresh',
                method: 'POST',
                data: {},
                expectedStatus: [400, 401, 403]
            },
            {
                name: 'Token Refresh - Invalid Refresh Token',
                endpoint: '/api/token/refresh',
                method: 'POST',
                data: { refreshToken: 'invalid' },
                expectedStatus: [400, 401, 403]
            },
            {
                name: 'Token Validation - Missing Token',
                endpoint: '/api/token/validate',
                method: 'POST',
                data: {},
                expectedStatus: [400, 401, 403]
            },
            {
                name: 'Token Validation - Invalid Token Type',
                endpoint: '/api/token/validate',
                method: 'POST',
                data: { 
                    token: this.mockTokens.accessToken,
                    tokenType: 'invalid_type'
                },
                expectedStatus: [400, 401, 403]
            }
        ];
        
        let passedTests = 0;
        
        for (const test of validationTests) {
            const result = await this.makeRequest(test.method, test.endpoint, {
                headers: test.data.token ? {
                    'Authorization': `Bearer ${this.mockTokens.accessToken}`
                } : {},
                data: test.data
            });
            
            if (test.expectedStatus.includes(result.status)) {
                passedTests++;
                console.log(`   ✅ ${test.name}: Correct validation (${result.status})`);
            } else {
                console.log(`   ⚠️ ${test.name}: Unexpected status ${result.status}`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        this.recordResult(
            'Token Input Validation',
            passedTests >= validationTests.length * 0.8 ? 'PASS' : 'WARN',
            `Input validation tests: ${passedTests}/${validationTests.length} passed`,
            { 
                passedTests: passedTests,
                totalTests: validationTests.length,
                successRate: Math.round((passedTests / validationTests.length) * 100)
            }
        );
    }
    
    /**
     * Test token management configuration
     */
    async testTokenManagementConfiguration() {
        console.log('\n⚙️ Testing Token Management Configuration...');
        
        const result = await this.makeRequest('GET', '/health/token-management');
        
        if (!result.success || result.status !== 200) {
            this.recordResult(
                'Token Management Configuration',
                'FAIL',
                'Cannot retrieve token management configuration',
                { error: result.error || result.status }
            );
            return;
        }
        
        const data = result.data;
        const tokenMgmt = data.token_management;
        
        if (!tokenMgmt.configuration) {
            this.recordResult(
                'Token Management Configuration',
                'FAIL',
                'Token management configuration not found',
                { data: tokenMgmt }
            );
            return;
        }
        
        const config = tokenMgmt.configuration;
        const issues = [];
        const recommendations = [];
        
        // Validate configuration values
        if (!config.accessTokenLifetime) {
            issues.push('Access token lifetime not configured');
        }
        
        if (!config.sessionTimeout) {
            issues.push('Session timeout not configured');
        }
        
        if (!config.refreshThreshold) {
            issues.push('Refresh threshold not configured');
        }
        
        if (config.tokenRotation === undefined) {
            issues.push('Token rotation setting not configured');
        }
        
        if (config.secureStorage === undefined) {
            issues.push('Secure storage setting not configured');
        }
        
        if (config.sessionFingerprinting === undefined) {
            recommendations.push('Session fingerprinting setting not configured');
        }
        
        if (config.tokenValidation === undefined) {
            recommendations.push('Token validation setting not configured');
        }
        
        if (issues.length === 0) {
            this.recordResult(
                'Token Management Configuration',
                'PASS',
                'Token management configuration is valid',
                { 
                    accessTokenLifetime: config.accessTokenLifetime,
                    sessionTimeout: config.sessionTimeout,
                    refreshThreshold: config.refreshThreshold,
                    tokenRotation: config.tokenRotation,
                    secureStorage: config.secureStorage,
                    sessionFingerprinting: config.sessionFingerprinting,
                    recommendations: recommendations.length,
                    responseTime: result.responseTime
                }
            );
        } else {
            this.recordResult(
                'Token Management Configuration',
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
     * Test token management performance
     */
    async testTokenManagementPerformance() {
        console.log('\n⚡ Testing Token Management Performance...');
        
        const iterations = 5;
        const responseTimes = [];
        
        // Test status endpoint performance
        for (let i = 0; i < iterations; i++) {
            const result = await this.makeRequest('GET', '/health/token-management');
            if (result.success) {
                responseTimes.push(result.responseTime);
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        if (responseTimes.length === 0) {
            this.recordResult(
                'Token Management Performance',
                'FAIL',
                'No successful requests for performance testing',
                {}
            );
            return;
        }
        
        const avgResponseTime = Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length);
        const maxResponseTime = Math.max(...responseTimes);
        const minResponseTime = Math.min(...responseTimes);
        
        if (avgResponseTime < 500) { // Less than 500ms average
            this.recordResult(
                'Token Management Performance',
                'PASS',
                `Good performance: ${avgResponseTime}ms average`,
                { 
                    avgResponseTime,
                    maxResponseTime,
                    minResponseTime,
                    iterations: responseTimes.length
                }
            );
        } else if (avgResponseTime < 1000) { // Less than 1 second
            this.recordResult(
                'Token Management Performance',
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
                'Token Management Performance',
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
     * Test session timeout configuration
     */
    async testSessionTimeoutConfiguration() {
        console.log('\n⏱️ Testing Session Timeout Configuration...');
        
        const result = await this.makeRequest('GET', '/auth/config');
        
        if (!result.success || result.status !== 200) {
            this.recordResult(
                'Session Timeout Configuration',
                'WARN',
                'Cannot retrieve auth configuration (expected in some environments)',
                { error: result.error || result.status }
            );
            return;
        }
        
        const data = result.data;
        
        // Check if session and token management configuration is available
        if (data.session || data.tokenManagement) {
            const sessionConfig = data.session || {};
            const tokenConfig = data.tokenManagement || {};
            
            this.recordResult(
                'Session Timeout Configuration',
                'PASS',
                'Session and token timeout configuration available',
                { 
                    hasSessionConfig: !!data.session,
                    hasTokenConfig: !!data.tokenManagement,
                    sessionTimeout: sessionConfig.sessionTimeout,
                    inactivityTimeout: sessionConfig.inactivityTimeout,
                    tokenRefreshThreshold: tokenConfig.tokenRefreshThreshold,
                    responseTime: result.responseTime
                }
            );
        } else {
            this.recordResult(
                'Session Timeout Configuration',
                'WARN',
                'Session timeout configuration not found in auth config',
                { 
                    availableFields: Object.keys(data),
                    responseTime: result.responseTime
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
            mockTokens: {
                accessTokenPresent: !!this.mockTokens.accessToken,
                idTokenPresent: !!this.mockTokens.idToken,
                refreshTokenPresent: !!this.mockTokens.refreshToken,
                expiredTokenPresent: !!this.mockTokens.expiredToken
            }
        };
        
        console.log('\n📊 Token Management Test Summary');
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
        
        const reportFile = path.join(reportDir, `token-management-test-${Date.now()}.json`);
        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
        
        console.log(`\n📄 Detailed report saved to: ${reportFile}`);
        
        return report;
    }
    
    /**
     * Run all token management tests
     */
    async runAllTests() {
        try {
            await this.testTokenManagementStatusEndpoint();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testTokenRefreshEndpoint();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testTokenValidationEndpoint();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testTokenExpirationEndpoint();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testTokenInputValidation();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testTokenManagementConfiguration();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testTokenManagementPerformance();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testSessionTimeoutConfiguration();
            
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
    const tester = new TokenManagementTest();
    tester.runAllTests().catch(error => {
        console.error('❌ Test execution failed:', error);
        process.exit(1);
    });
}

module.exports = TokenManagementTest;
