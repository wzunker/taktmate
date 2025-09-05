#!/usr/bin/env node

// TaktMate CSRF Protection Testing Script
// Tests CSRF token generation, validation, and protection mechanisms

const axios = require('axios');
const fs = require('fs');
const path = require('path');

class CSRFProtectionTest {
    constructor() {
        this.apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
        this.testResults = [];
        this.startTime = Date.now();
        
        // Test configuration
        this.config = {
            requestTimeout: 5000, // 5 seconds
            delayBetweenTests: 500, // 500ms between tests
            maxRetries: 3
        };
        
        console.log('🧪 TaktMate CSRF Protection Testing Suite');
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
                data: response.data,
                cookies: this.extractCookies(response.headers)
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
     * Extract cookies from response headers
     */
    extractCookies(headers) {
        const setCookieHeader = headers['set-cookie'];
        if (!setCookieHeader) return {};
        
        const cookies = {};
        setCookieHeader.forEach(cookieStr => {
            const [nameValue] = cookieStr.split(';');
            const [name, value] = nameValue.split('=');
            if (name && value) {
                cookies[name.trim()] = value.trim();
            }
        });
        
        return cookies;
    }
    
    /**
     * Test CSRF token generation endpoint
     */
    async testCSRFTokenGeneration() {
        console.log('\n🎫 Testing CSRF Token Generation...');
        
        const result = await this.makeRequest('GET', '/csrf-token');
        
        if (!result.success) {
            this.recordResult(
                'CSRF Token Generation',
                'FAIL',
                `Request failed: ${result.error}`,
                { error: result.error }
            );
            return null;
        }
        
        if (result.status !== 200) {
            this.recordResult(
                'CSRF Token Generation',
                'FAIL',
                `Unexpected status code: ${result.status}`,
                { status: result.status, data: result.data }
            );
            return null;
        }
        
        const data = result.data;
        
        // Validate response structure
        const expectedFields = ['success', 'csrf', 'message', 'timestamp'];
        const missingFields = expectedFields.filter(field => !(field in data));
        
        if (missingFields.length > 0) {
            this.recordResult(
                'CSRF Token Generation',
                'FAIL',
                `Missing fields in response: ${missingFields.join(', ')}`,
                { missingFields, data }
            );
            return null;
        }
        
        // Validate CSRF token structure
        const csrf = data.csrf;
        const expectedCSRFFields = ['token', 'expires', 'headerName', 'fieldName'];
        const missingCSRFFields = expectedCSRFFields.filter(field => !(field in csrf));
        
        if (missingCSRFFields.length > 0) {
            this.recordResult(
                'CSRF Token Structure',
                'FAIL',
                `Missing CSRF fields: ${missingCSRFFields.join(', ')}`,
                { missingCSRFFields, csrf }
            );
            return null;
        }
        
        // Validate token format
        if (!csrf.token || csrf.token.length < 10) {
            this.recordResult(
                'CSRF Token Format',
                'FAIL',
                'CSRF token is too short or missing',
                { tokenLength: csrf.token ? csrf.token.length : 0 }
            );
            return null;
        }
        
        // Check for CSRF cookie
        const csrfCookie = result.cookies['_csrf_token'];
        if (!csrfCookie) {
            this.recordResult(
                'CSRF Cookie',
                'WARN',
                'CSRF cookie not set (may be intentional for API-only endpoints)',
                { cookies: Object.keys(result.cookies) }
            );
        } else if (csrfCookie !== csrf.token) {
            this.recordResult(
                'CSRF Cookie Validation',
                'FAIL',
                'CSRF cookie does not match token',
                { cookieToken: csrfCookie, responseToken: csrf.token }
            );
            return null;
        } else {
            this.recordResult(
                'CSRF Cookie Validation',
                'PASS',
                'CSRF cookie matches token',
                { tokenLength: csrf.token.length }
            );
        }
        
        this.recordResult(
            'CSRF Token Generation',
            'PASS',
            'CSRF token generated successfully',
            { 
                tokenLength: csrf.token.length,
                headerName: csrf.headerName,
                fieldName: csrf.fieldName,
                expires: csrf.expires,
                responseTime: result.responseTime
            }
        );
        
        return {
            token: csrf.token,
            headerName: csrf.headerName,
            fieldName: csrf.fieldName,
            cookies: result.cookies
        };
    }
    
    /**
     * Test CSRF protection status endpoint
     */
    async testCSRFStatusEndpoint() {
        console.log('\n📋 Testing CSRF Status Endpoint...');
        
        const result = await this.makeRequest('GET', '/health/csrf');
        
        if (!result.success) {
            this.recordResult(
                'CSRF Status Endpoint',
                'FAIL',
                `Request failed: ${result.error}`,
                { error: result.error }
            );
            return;
        }
        
        if (result.status !== 200) {
            this.recordResult(
                'CSRF Status Endpoint',
                'FAIL',
                `Unexpected status code: ${result.status}`,
                { status: result.status, data: result.data }
            );
            return;
        }
        
        const data = result.data;
        const expectedFields = ['status', 'timestamp', 'environment', 'csrf_protection'];
        const missingFields = expectedFields.filter(field => !(field in data));
        
        if (missingFields.length === 0) {
            const csrfConfig = data.csrf_protection;
            
            this.recordResult(
                'CSRF Status Endpoint',
                'PASS',
                'CSRF status endpoint working correctly',
                { 
                    status: data.status,
                    environment: data.environment,
                    enabled: csrfConfig.enabled,
                    doubleSubmitCookie: csrfConfig.configuration?.doubleSubmitCookie,
                    encryptTokens: csrfConfig.configuration?.encryptTokens,
                    responseTime: result.responseTime
                }
            );
        } else {
            this.recordResult(
                'CSRF Status Endpoint',
                'WARN',
                `Missing fields in response: ${missingFields.join(', ')}`,
                { missingFields, responseTime: result.responseTime }
            );
        }
    }
    
    /**
     * Test CSRF protection for protected endpoints
     */
    async testCSRFProtection() {
        console.log('\n🛡️ Testing CSRF Protection...');
        
        // First get a CSRF token
        const tokenData = await this.testCSRFTokenGeneration();
        if (!tokenData) {
            this.recordResult(
                'CSRF Protection Test',
                'FAIL',
                'Cannot test CSRF protection without valid token',
                {}
            );
            return;
        }
        
        await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
        
        // Test 1: Request without CSRF token should fail
        const resultWithoutToken = await this.makeRequest('POST', '/upload', {
            data: { test: 'data' },
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (resultWithoutToken.success && resultWithoutToken.status === 403) {
            this.recordResult(
                'CSRF Protection - No Token',
                'PASS',
                'Request without CSRF token correctly rejected',
                { 
                    status: resultWithoutToken.status,
                    responseTime: resultWithoutToken.responseTime,
                    errorCode: resultWithoutToken.data?.code
                }
            );
        } else {
            this.recordResult(
                'CSRF Protection - No Token',
                'FAIL',
                `Request without CSRF token should be rejected (got ${resultWithoutToken.status})`,
                { 
                    status: resultWithoutToken.status,
                    data: resultWithoutToken.data
                }
            );
        }
        
        await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
        
        // Test 2: Request with invalid CSRF token should fail
        const resultWithInvalidToken = await this.makeRequest('POST', '/upload', {
            data: { test: 'data' },
            headers: { 
                'Content-Type': 'application/json',
                [tokenData.headerName]: 'invalid-token-12345'
            }
        });
        
        if (resultWithInvalidToken.success && resultWithInvalidToken.status === 403) {
            this.recordResult(
                'CSRF Protection - Invalid Token',
                'PASS',
                'Request with invalid CSRF token correctly rejected',
                { 
                    status: resultWithInvalidToken.status,
                    responseTime: resultWithInvalidToken.responseTime,
                    errorCode: resultWithInvalidToken.data?.code
                }
            );
        } else {
            this.recordResult(
                'CSRF Protection - Invalid Token',
                'FAIL',
                `Request with invalid CSRF token should be rejected (got ${resultWithInvalidToken.status})`,
                { 
                    status: resultWithInvalidToken.status,
                    data: resultWithInvalidToken.data
                }
            );
        }
        
        await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
        
        // Test 3: Request with valid CSRF token in header
        const resultWithValidHeaderToken = await this.makeRequest('POST', '/upload', {
            data: { test: 'data' },
            headers: { 
                'Content-Type': 'application/json',
                [tokenData.headerName]: tokenData.token
            },
            // Include cookies for double submit validation
            headers: {
                ...{ [tokenData.headerName]: tokenData.token },
                'Content-Type': 'application/json',
                'Cookie': `_csrf_token=${tokenData.token}`
            }
        });
        
        // Note: This might fail due to authentication requirements, but CSRF should pass
        if (resultWithValidHeaderToken.success) {
            if (resultWithValidHeaderToken.status === 401 || resultWithValidHeaderToken.status === 403) {
                // Check if the error is authentication-related, not CSRF-related
                const errorCode = resultWithValidHeaderToken.data?.code;
                if (errorCode && !errorCode.includes('CSRF')) {
                    this.recordResult(
                        'CSRF Protection - Valid Header Token',
                        'PASS',
                        'CSRF validation passed (failed on authentication as expected)',
                        { 
                            status: resultWithValidHeaderToken.status,
                            errorCode: errorCode,
                            responseTime: resultWithValidHeaderToken.responseTime
                        }
                    );
                } else {
                    this.recordResult(
                        'CSRF Protection - Valid Header Token',
                        'FAIL',
                        'Valid CSRF token was rejected',
                        { 
                            status: resultWithValidHeaderToken.status,
                            errorCode: errorCode,
                            data: resultWithValidHeaderToken.data
                        }
                    );
                }
            } else {
                this.recordResult(
                    'CSRF Protection - Valid Header Token',
                    'PASS',
                    'Request with valid CSRF token in header accepted',
                    { 
                        status: resultWithValidHeaderToken.status,
                        responseTime: resultWithValidHeaderToken.responseTime
                    }
                );
            }
        } else {
            this.recordResult(
                'CSRF Protection - Valid Header Token',
                'WARN',
                'Request failed, cannot determine CSRF validation result',
                { error: resultWithValidHeaderToken.error }
            );
        }
    }
    
    /**
     * Test CSRF token expiry
     */
    async testCSRFTokenExpiry() {
        console.log('\n⏰ Testing CSRF Token Expiry...');
        
        // Generate a token
        const result = await this.makeRequest('GET', '/csrf-token');
        
        if (!result.success || result.status !== 200) {
            this.recordResult(
                'CSRF Token Expiry Test',
                'FAIL',
                'Cannot test token expiry without valid token generation',
                {}
            );
            return;
        }
        
        const tokenData = result.data.csrf;
        const expiryTime = new Date(tokenData.expires);
        const now = new Date();
        const timeUntilExpiry = expiryTime.getTime() - now.getTime();
        
        if (timeUntilExpiry > 0) {
            this.recordResult(
                'CSRF Token Expiry',
                'PASS',
                `Token expires in ${Math.round(timeUntilExpiry / 1000 / 60)} minutes`,
                { 
                    expires: tokenData.expires,
                    timeUntilExpiry: timeUntilExpiry,
                    expiryMinutes: Math.round(timeUntilExpiry / 1000 / 60)
                }
            );
        } else {
            this.recordResult(
                'CSRF Token Expiry',
                'FAIL',
                'Token appears to be already expired',
                { 
                    expires: tokenData.expires,
                    now: now.toISOString(),
                    timeUntilExpiry: timeUntilExpiry
                }
            );
        }
    }
    
    /**
     * Test CSRF headers and configuration
     */
    async testCSRFHeaders() {
        console.log('\n📤 Testing CSRF Headers...');
        
        const result = await this.makeRequest('GET', '/csrf-token');
        
        if (!result.success || result.status !== 200) {
            this.recordResult(
                'CSRF Headers Test',
                'FAIL',
                'Cannot test headers without successful token generation',
                {}
            );
            return;
        }
        
        // Check for security headers related to CSRF
        const headers = result.headers;
        const securityHeaders = {
            'x-frame-options': 'Should prevent clickjacking',
            'x-content-type-options': 'Should prevent MIME sniffing',
            'referrer-policy': 'Should control referrer information'
        };
        
        let presentHeaders = 0;
        let missingHeaders = [];
        
        Object.keys(securityHeaders).forEach(headerName => {
            if (headers[headerName] || headers[headerName.toLowerCase()]) {
                presentHeaders++;
            } else {
                missingHeaders.push(headerName);
            }
        });
        
        if (missingHeaders.length === 0) {
            this.recordResult(
                'CSRF Security Headers',
                'PASS',
                `All CSRF-related security headers present (${presentHeaders})`,
                { presentHeaders: Object.keys(securityHeaders) }
            );
        } else {
            this.recordResult(
                'CSRF Security Headers',
                'WARN',
                `Some CSRF-related headers missing: ${missingHeaders.join(', ')}`,
                { presentHeaders: presentHeaders, missingHeaders }
            );
        }
        
        // Check cookie settings
        const setCookieHeader = headers['set-cookie'];
        if (setCookieHeader) {
            const csrfCookieHeader = setCookieHeader.find(cookie => cookie.includes('_csrf_token'));
            if (csrfCookieHeader) {
                const hasHttpOnly = csrfCookieHeader.includes('HttpOnly');
                const hasSecure = csrfCookieHeader.includes('Secure');
                const hasSameSite = csrfCookieHeader.includes('SameSite');
                
                const cookieFlags = [];
                if (hasHttpOnly) cookieFlags.push('HttpOnly');
                if (hasSecure) cookieFlags.push('Secure');
                if (hasSameSite) cookieFlags.push('SameSite');
                
                if (cookieFlags.length >= 2) { // At least HttpOnly and SameSite
                    this.recordResult(
                        'CSRF Cookie Security',
                        'PASS',
                        `CSRF cookie has security flags: ${cookieFlags.join(', ')}`,
                        { cookieFlags, cookieHeader: csrfCookieHeader }
                    );
                } else {
                    this.recordResult(
                        'CSRF Cookie Security',
                        'WARN',
                        `CSRF cookie missing some security flags: ${cookieFlags.join(', ')}`,
                        { cookieFlags, cookieHeader: csrfCookieHeader }
                    );
                }
            } else {
                this.recordResult(
                    'CSRF Cookie Security',
                    'WARN',
                    'CSRF cookie not found in response',
                    { setCookieHeaders: setCookieHeader }
                );
            }
        }
    }
    
    /**
     * Test performance impact of CSRF protection
     */
    async testCSRFPerformance() {
        console.log('\n⚡ Testing CSRF Performance Impact...');
        
        const iterations = 10;
        const responseTimes = [];
        
        for (let i = 0; i < iterations; i++) {
            const result = await this.makeRequest('GET', '/csrf-token');
            if (result.success) {
                responseTimes.push(result.responseTime);
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        if (responseTimes.length === 0) {
            this.recordResult(
                'CSRF Performance',
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
                'CSRF Performance',
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
                'CSRF Performance',
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
                'CSRF Performance',
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
            configuration: this.config
        };
        
        console.log('\n📊 CSRF Protection Test Summary');
        console.log('=================================');
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
        
        const reportFile = path.join(reportDir, `csrf-protection-test-${Date.now()}.json`);
        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
        
        console.log(`\n📄 Detailed report saved to: ${reportFile}`);
        
        return report;
    }
    
    /**
     * Run all CSRF protection tests
     */
    async runAllTests() {
        try {
            await this.testCSRFTokenGeneration();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testCSRFStatusEndpoint();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testCSRFProtection();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testCSRFTokenExpiry();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testCSRFHeaders();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testCSRFPerformance();
            
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
    const tester = new CSRFProtectionTest();
    tester.runAllTests().catch(error => {
        console.error('❌ Test execution failed:', error);
        process.exit(1);
    });
}

module.exports = CSRFProtectionTest;
