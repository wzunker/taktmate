#!/usr/bin/env node

// TaktMate Rate Limiting and Security Testing Script
// Tests rate limiting, security headers, and abuse protection

const axios = require('axios');
const fs = require('fs');
const path = require('path');

class RateLimitSecurityTest {
    constructor() {
        this.apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
        this.testResults = [];
        this.startTime = Date.now();
        
        // Test configuration
        this.config = {
            // Test timeouts and delays
            requestTimeout: 5000, // 5 seconds
            delayBetweenTests: 1000, // 1 second
            rateLimitTestDelay: 100, // 100ms between rapid requests
            
            // Rate limit thresholds (should match backend config)
            rateLimits: {
                general: { max: 100, window: 15 * 60 * 1000 }, // 100 per 15 minutes
                upload: { max: 5, window: 60 * 1000 }, // 5 per minute
                chat: { max: 20, window: 60 * 1000 }, // 20 per minute
                auth: { max: 10, window: 15 * 60 * 1000 }, // 10 per 15 minutes
                sensitive: { max: 3, window: 60 * 60 * 1000 }, // 3 per hour
                public: { max: 200, window: 60 * 1000 } // 200 per minute
            },
            
            // Security headers to check
            expectedHeaders: [
                'x-content-type-options',
                'x-frame-options',
                'x-xss-protection',
                'referrer-policy',
                'content-security-policy',
                'x-api-version',
                'x-request-id'
            ]
        };
        
        console.log('🧪 TaktMate Rate Limiting and Security Testing Suite');
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
        
        if (Object.keys(details).length > 0 && details.responseTime) {
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
     * Test security headers
     */
    async testSecurityHeaders() {
        console.log('\n🛡️ Testing Security Headers...');
        
        const endpoints = [
            '/health',
            '/health/security',
            '/api/status'
        ];
        
        for (const endpoint of endpoints) {
            const result = await this.makeRequest('GET', endpoint);
            
            if (!result.success) {
                this.recordResult(
                    `Security Headers: ${endpoint}`,
                    'FAIL',
                    `Request failed: ${result.error}`,
                    { endpoint, error: result.error }
                );
                continue;
            }
            
            const missingHeaders = [];
            const presentHeaders = [];
            
            this.config.expectedHeaders.forEach(headerName => {
                if (result.headers[headerName] || result.headers[headerName.toLowerCase()]) {
                    presentHeaders.push(headerName);
                } else {
                    missingHeaders.push(headerName);
                }
            });
            
            if (missingHeaders.length === 0) {
                this.recordResult(
                    `Security Headers: ${endpoint}`,
                    'PASS',
                    `All expected headers present (${presentHeaders.length})`,
                    { 
                        endpoint,
                        presentHeaders,
                        responseTime: result.responseTime,
                        status: result.status
                    }
                );
            } else {
                this.recordResult(
                    `Security Headers: ${endpoint}`,
                    'WARN',
                    `Some headers missing: ${missingHeaders.join(', ')}`,
                    { 
                        endpoint,
                        presentHeaders,
                        missingHeaders,
                        responseTime: result.responseTime
                    }
                );
            }
        }
    }
    
    /**
     * Test Content Security Policy
     */
    async testContentSecurityPolicy() {
        console.log('\n🔒 Testing Content Security Policy...');
        
        const result = await this.makeRequest('GET', '/health');
        
        if (!result.success) {
            this.recordResult(
                'CSP Header',
                'FAIL',
                `Request failed: ${result.error}`,
                { error: result.error }
            );
            return;
        }
        
        const cspHeader = result.headers['content-security-policy'] || result.headers['Content-Security-Policy'];
        
        if (!cspHeader) {
            this.recordResult(
                'CSP Header',
                'FAIL',
                'Content-Security-Policy header not found',
                { status: result.status }
            );
            return;
        }
        
        // Check for essential CSP directives
        const expectedDirectives = [
            'default-src',
            'script-src',
            'style-src',
            'img-src',
            'connect-src',
            'font-src',
            'object-src',
            'frame-src'
        ];
        
        const missingDirectives = [];
        const presentDirectives = [];
        
        expectedDirectives.forEach(directive => {
            if (cspHeader.includes(directive)) {
                presentDirectives.push(directive);
            } else {
                missingDirectives.push(directive);
            }
        });
        
        if (missingDirectives.length === 0) {
            this.recordResult(
                'CSP Directives',
                'PASS',
                `All essential directives present (${presentDirectives.length})`,
                { 
                    presentDirectives,
                    cspHeader: cspHeader.substring(0, 100) + '...',
                    responseTime: result.responseTime
                }
            );
        } else {
            this.recordResult(
                'CSP Directives',
                'WARN',
                `Some directives missing: ${missingDirectives.join(', ')}`,
                { 
                    presentDirectives,
                    missingDirectives,
                    cspHeader: cspHeader.substring(0, 100) + '...'
                }
            );
        }
        
        // Check for unsafe directives
        const unsafeDirectives = ["'unsafe-eval'", "'unsafe-inline'"];
        const foundUnsafe = [];
        
        unsafeDirectives.forEach(unsafe => {
            if (cspHeader.includes(unsafe)) {
                foundUnsafe.push(unsafe);
            }
        });
        
        if (foundUnsafe.length > 0) {
            this.recordResult(
                'CSP Security',
                'WARN',
                `Potentially unsafe directives found: ${foundUnsafe.join(', ')}`,
                { foundUnsafe, note: 'May be required for React development' }
            );
        } else {
            this.recordResult(
                'CSP Security',
                'PASS',
                'No unsafe directives detected',
                {}
            );
        }
    }
    
    /**
     * Test rate limiting for general endpoints
     */
    async testGeneralRateLimit() {
        console.log('\n🚦 Testing General Rate Limiting...');
        
        const endpoint = '/health';
        const limit = this.config.rateLimits.general;
        
        // Make requests up to the limit
        const requests = [];
        for (let i = 0; i < Math.min(limit.max + 5, 20); i++) { // Test up to 20 requests
            requests.push(this.makeRequest('GET', endpoint));
            await new Promise(resolve => setTimeout(resolve, this.config.rateLimitTestDelay));
        }
        
        const results = await Promise.all(requests);
        
        const successfulRequests = results.filter(r => r.success && r.status === 200);
        const rateLimitedRequests = results.filter(r => r.success && r.status === 429);
        
        if (rateLimitedRequests.length > 0) {
            this.recordResult(
                'General Rate Limiting',
                'PASS',
                `Rate limiting active: ${successfulRequests.length} successful, ${rateLimitedRequests.length} rate limited`,
                { 
                    successfulRequests: successfulRequests.length,
                    rateLimitedRequests: rateLimitedRequests.length,
                    totalRequests: results.length,
                    firstRateLimitAt: successfulRequests.length + 1
                }
            );
        } else {
            this.recordResult(
                'General Rate Limiting',
                'WARN',
                `No rate limiting detected in ${results.length} requests`,
                { 
                    successfulRequests: successfulRequests.length,
                    totalRequests: results.length,
                    note: 'Rate limit may not be reached with current test'
                }
            );
        }
    }
    
    /**
     * Test rate limiting headers
     */
    async testRateLimitHeaders() {
        console.log('\n📊 Testing Rate Limit Headers...');
        
        const result = await this.makeRequest('GET', '/health');
        
        if (!result.success) {
            this.recordResult(
                'Rate Limit Headers',
                'FAIL',
                `Request failed: ${result.error}`,
                { error: result.error }
            );
            return;
        }
        
        const rateLimitHeaders = [
            'x-ratelimit-limit',
            'x-ratelimit-remaining',
            'x-ratelimit-reset'
        ];
        
        const presentHeaders = [];
        const missingHeaders = [];
        
        rateLimitHeaders.forEach(header => {
            if (result.headers[header] || result.headers[header.toLowerCase()]) {
                presentHeaders.push(header);
            } else {
                missingHeaders.push(header);
            }
        });
        
        if (presentHeaders.length > 0) {
            this.recordResult(
                'Rate Limit Headers',
                'PASS',
                `Rate limit headers present: ${presentHeaders.join(', ')}`,
                { 
                    presentHeaders,
                    missingHeaders,
                    responseTime: result.responseTime
                }
            );
        } else {
            this.recordResult(
                'Rate Limit Headers',
                'WARN',
                'No rate limit headers found',
                { 
                    note: 'Headers may only appear after rate limiting is triggered',
                    responseTime: result.responseTime
                }
            );
        }
    }
    
    /**
     * Test public endpoint rate limiting
     */
    async testPublicRateLimit() {
        console.log('\n🌐 Testing Public Endpoint Rate Limiting...');
        
        const endpoint = '/health/security';
        
        // Make multiple requests to test public rate limiting
        const requests = [];
        for (let i = 0; i < 10; i++) {
            requests.push(this.makeRequest('GET', endpoint));
            await new Promise(resolve => setTimeout(resolve, 50)); // 50ms delay
        }
        
        const results = await Promise.all(requests);
        
        const successfulRequests = results.filter(r => r.success && r.status === 200);
        const failedRequests = results.filter(r => !r.success || r.status !== 200);
        
        if (successfulRequests.length >= 8) { // Should allow most public requests
            this.recordResult(
                'Public Rate Limiting',
                'PASS',
                `Public endpoints accessible: ${successfulRequests.length}/${results.length} successful`,
                { 
                    successfulRequests: successfulRequests.length,
                    failedRequests: failedRequests.length,
                    totalRequests: results.length,
                    averageResponseTime: Math.round(
                        successfulRequests.reduce((sum, r) => sum + r.responseTime, 0) / successfulRequests.length
                    )
                }
            );
        } else {
            this.recordResult(
                'Public Rate Limiting',
                'WARN',
                `Public endpoints may be too restrictive: ${successfulRequests.length}/${results.length} successful`,
                { 
                    successfulRequests: successfulRequests.length,
                    failedRequests: failedRequests.length,
                    totalRequests: results.length
                }
            );
        }
    }
    
    /**
     * Test security status endpoint
     */
    async testSecurityStatusEndpoint() {
        console.log('\n📋 Testing Security Status Endpoint...');
        
        const result = await this.makeRequest('GET', '/health/security');
        
        if (!result.success) {
            this.recordResult(
                'Security Status Endpoint',
                'FAIL',
                `Request failed: ${result.error}`,
                { error: result.error }
            );
            return;
        }
        
        if (result.status !== 200) {
            this.recordResult(
                'Security Status Endpoint',
                'FAIL',
                `Unexpected status code: ${result.status}`,
                { status: result.status, data: result.data }
            );
            return;
        }
        
        const data = result.data;
        const expectedFields = [
            'status',
            'timestamp',
            'environment',
            'rate_limiting',
            'security_headers',
            'abuse_protection'
        ];
        
        const missingFields = expectedFields.filter(field => !(field in data));
        
        if (missingFields.length === 0) {
            this.recordResult(
                'Security Status Endpoint',
                'PASS',
                'Security status endpoint working correctly',
                { 
                    status: data.status,
                    environment: data.environment,
                    activeBlocks: data.rate_limiting?.activeBlocks || 0,
                    trackedIPs: data.rate_limiting?.trackedIPs || 0,
                    responseTime: result.responseTime
                }
            );
        } else {
            this.recordResult(
                'Security Status Endpoint',
                'WARN',
                `Missing fields in response: ${missingFields.join(', ')}`,
                { 
                    missingFields,
                    presentFields: expectedFields.filter(field => field in data),
                    responseTime: result.responseTime
                }
            );
        }
    }
    
    /**
     * Test response time performance
     */
    async testResponseTimePerformance() {
        console.log('\n⚡ Testing Response Time Performance...');
        
        const endpoints = [
            '/health',
            '/health/security',
            '/api/status'
        ];
        
        for (const endpoint of endpoints) {
            const requests = [];
            for (let i = 0; i < 5; i++) {
                requests.push(this.makeRequest('GET', endpoint));
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            const results = await Promise.all(requests);
            const successfulResults = results.filter(r => r.success);
            
            if (successfulResults.length === 0) {
                this.recordResult(
                    `Performance: ${endpoint}`,
                    'FAIL',
                    'No successful requests',
                    { endpoint }
                );
                continue;
            }
            
            const responseTimes = successfulResults.map(r => r.responseTime);
            const averageTime = Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length);
            const maxTime = Math.max(...responseTimes);
            const minTime = Math.min(...responseTimes);
            
            if (averageTime < 1000) { // Less than 1 second average
                this.recordResult(
                    `Performance: ${endpoint}`,
                    'PASS',
                    `Good performance: ${averageTime}ms average`,
                    { 
                        endpoint,
                        averageTime,
                        maxTime,
                        minTime,
                        requestCount: successfulResults.length
                    }
                );
            } else if (averageTime < 3000) { // Less than 3 seconds
                this.recordResult(
                    `Performance: ${endpoint}`,
                    'WARN',
                    `Acceptable performance: ${averageTime}ms average`,
                    { 
                        endpoint,
                        averageTime,
                        maxTime,
                        minTime,
                        requestCount: successfulResults.length
                    }
                );
            } else {
                this.recordResult(
                    `Performance: ${endpoint}`,
                    'FAIL',
                    `Poor performance: ${averageTime}ms average`,
                    { 
                        endpoint,
                        averageTime,
                        maxTime,
                        minTime,
                        requestCount: successfulResults.length
                    }
                );
            }
        }
    }
    
    /**
     * Test security against common attacks
     */
    async testSecurityAttacks() {
        console.log('\n🔍 Testing Security Against Common Attacks...');
        
        // Test XSS in query parameters
        const xssPayloads = [
            '<script>alert("XSS")</script>',
            'javascript:alert("XSS")',
            '<img src=x onerror=alert("XSS")>',
            '"><script>alert("XSS")</script>'
        ];
        
        for (const payload of xssPayloads) {
            const result = await this.makeRequest('GET', `/health?test=${encodeURIComponent(payload)}`);
            
            if (result.success) {
                // Check if the payload was reflected in the response
                const responseText = JSON.stringify(result.data);
                if (responseText.includes('<script>') || responseText.includes('javascript:')) {
                    this.recordResult(
                        'XSS Protection',
                        'FAIL',
                        'XSS payload may have been reflected',
                        { payload, responseStatus: result.status }
                    );
                } else {
                    this.recordResult(
                        'XSS Protection',
                        'PASS',
                        'XSS payload properly handled',
                        { payload, responseStatus: result.status }
                    );
                }
            }
        }
        
        // Test SQL injection patterns (though we don't use SQL)
        const sqlPayloads = [
            "'; DROP TABLE users; --",
            "1' OR '1'='1",
            "1' UNION SELECT * FROM users --"
        ];
        
        for (const payload of sqlPayloads) {
            const result = await this.makeRequest('GET', `/health?id=${encodeURIComponent(payload)}`);
            
            if (result.success && result.status === 200) {
                this.recordResult(
                    'SQL Injection Protection',
                    'PASS',
                    'SQL injection payload properly handled',
                    { payload, responseStatus: result.status }
                );
            }
        }
        
        // Test path traversal
        const pathTraversalPayloads = [
            '../../../etc/passwd',
            '..\\..\\..\\windows\\system32\\drivers\\etc\\hosts',
            '....//....//....//etc/passwd'
        ];
        
        for (const payload of pathTraversalPayloads) {
            const result = await this.makeRequest('GET', `/${payload}`);
            
            if (result.success && result.status === 404) {
                this.recordResult(
                    'Path Traversal Protection',
                    'PASS',
                    'Path traversal attempt properly blocked',
                    { payload, responseStatus: result.status }
                );
            } else if (result.success && result.status === 200) {
                this.recordResult(
                    'Path Traversal Protection',
                    'FAIL',
                    'Path traversal may have succeeded',
                    { payload, responseStatus: result.status }
                );
            }
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
        
        console.log('\n📊 Rate Limiting and Security Test Summary');
        console.log('============================================');
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
        
        const reportFile = path.join(reportDir, `rate-limit-security-test-${Date.now()}.json`);
        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
        
        console.log(`\n📄 Detailed report saved to: ${reportFile}`);
        
        return report;
    }
    
    /**
     * Run all rate limiting and security tests
     */
    async runAllTests() {
        try {
            await this.testSecurityHeaders();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testContentSecurityPolicy();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testRateLimitHeaders();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testGeneralRateLimit();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testPublicRateLimit();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testSecurityStatusEndpoint();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testResponseTimePerformance();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testSecurityAttacks();
            
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
    const tester = new RateLimitSecurityTest();
    tester.runAllTests().catch(error => {
        console.error('❌ Test execution failed:', error);
        process.exit(1);
    });
}

module.exports = RateLimitSecurityTest;
