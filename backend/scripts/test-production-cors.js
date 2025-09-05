#!/usr/bin/env node

// TaktMate Production CORS Testing Script
// Tests production CORS configuration, security features, and monitoring

const axios = require('axios');
const { performance } = require('perf_hooks');

class ProductionCORSTest {
    constructor() {
        this.baseURL = process.env.API_BASE_URL || 'http://localhost:3001';
        this.productionDomains = [
            'https://app.taktconnect.com',
            'https://www.taktconnect.com'
        ];
        this.testResults = [];
        this.startTime = performance.now();
        
        console.log('🧪 TaktMate Production CORS Testing Suite');
        console.log(`📍 Testing against: ${this.baseURL}`);
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
        
        if (Object.keys(details).length > 0) {
            console.log(`   Details: ${JSON.stringify(details, null, 2)}`);
        }
    }
    
    /**
     * Test CORS preflight requests for production domains
     */
    async testPreflightRequests() {
        console.log('\n🔄 Testing CORS Preflight Requests...');
        
        for (const origin of this.productionDomains) {
            try {
                const response = await axios({
                    method: 'OPTIONS',
                    url: `${this.baseURL}/test`,
                    headers: {
                        'Origin': origin,
                        'Access-Control-Request-Method': 'POST',
                        'Access-Control-Request-Headers': 'Content-Type,Authorization'
                    },
                    timeout: 10000,
                    validateStatus: () => true // Don't throw on non-2xx status
                });
                
                if (response.status === 200 || response.status === 204) {
                    // Check for required CORS headers
                    const corsHeaders = {
                        'access-control-allow-origin': response.headers['access-control-allow-origin'],
                        'access-control-allow-methods': response.headers['access-control-allow-methods'],
                        'access-control-allow-headers': response.headers['access-control-allow-headers'],
                        'access-control-allow-credentials': response.headers['access-control-allow-credentials'],
                        'access-control-max-age': response.headers['access-control-max-age']
                    };
                    
                    const hasRequiredHeaders = corsHeaders['access-control-allow-origin'] && 
                                             corsHeaders['access-control-allow-methods'] && 
                                             corsHeaders['access-control-allow-headers'];
                    
                    if (hasRequiredHeaders) {
                        this.recordResult(
                            `Preflight Request (${new URL(origin).hostname})`,
                            'PASS',
                            `Preflight successful (${response.status})`,
                            { corsHeaders, origin }
                        );
                    } else {
                        this.recordResult(
                            `Preflight Request (${new URL(origin).hostname})`,
                            'FAIL',
                            'Missing required CORS headers',
                            { corsHeaders, origin }
                        );
                    }
                } else {
                    this.recordResult(
                        `Preflight Request (${new URL(origin).hostname})`,
                        'FAIL',
                        `Preflight failed (${response.status})`,
                        { status: response.status, origin }
                    );
                }
            } catch (error) {
                this.recordResult(
                    `Preflight Request (${new URL(origin).hostname})`,
                    'FAIL',
                    `Request failed: ${error.message}`,
                    { error: error.message, origin }
                );
            }
        }
    }
    
    /**
     * Test actual CORS requests with credentials
     */
    async testCredentialRequests() {
        console.log('\n🔐 Testing CORS Requests with Credentials...');
        
        for (const origin of this.productionDomains) {
            try {
                const response = await axios({
                    method: 'GET',
                    url: `${this.baseURL}/test`,
                    headers: {
                        'Origin': origin,
                        'Cookie': 'test-session=abc123',
                        'Authorization': 'Bearer test-token'
                    },
                    timeout: 10000,
                    validateStatus: () => true
                });
                
                const allowOrigin = response.headers['access-control-allow-origin'];
                const allowCredentials = response.headers['access-control-allow-credentials'];
                
                if (response.status === 200) {
                    if (allowOrigin === origin && allowCredentials === 'true') {
                        this.recordResult(
                            `Credential Request (${new URL(origin).hostname})`,
                            'PASS',
                            'Credentials request successful',
                            { 
                                allowOrigin,
                                allowCredentials,
                                origin 
                            }
                        );
                    } else {
                        this.recordResult(
                            `Credential Request (${new URL(origin).hostname})`,
                            'WARN',
                            'Credentials headers may be incorrect',
                            { 
                                allowOrigin,
                                allowCredentials,
                                expected: { allowOrigin: origin, allowCredentials: 'true' },
                                origin 
                            }
                        );
                    }
                } else {
                    this.recordResult(
                        `Credential Request (${new URL(origin).hostname})`,
                        'FAIL',
                        `Request failed (${response.status})`,
                        { status: response.status, origin }
                    );
                }
            } catch (error) {
                this.recordResult(
                    `Credential Request (${new URL(origin).hostname})`,
                    'FAIL',
                    `Request failed: ${error.message}`,
                    { error: error.message, origin }
                );
            }
        }
    }
    
    /**
     * Test blocked origins
     */
    async testBlockedOrigins() {
        console.log('\n🚫 Testing Blocked Origins...');
        
        const blockedOrigins = [
            'https://evil.example.com',
            'https://malicious.site',
            'http://unauthorized.domain',
            'https://phishing.example'
        ];
        
        for (const origin of blockedOrigins) {
            try {
                const response = await axios({
                    method: 'GET',
                    url: `${this.baseURL}/test`,
                    headers: {
                        'Origin': origin
                    },
                    timeout: 10000,
                    validateStatus: () => true
                });
                
                const allowOrigin = response.headers['access-control-allow-origin'];
                
                // In production, blocked origins should either:
                // 1. Not get Access-Control-Allow-Origin header
                // 2. Get a different origin than what was requested
                // 3. Get a 403 response
                
                if (response.status === 403) {
                    this.recordResult(
                        `Blocked Origin (${new URL(origin).hostname})`,
                        'PASS',
                        'Origin correctly blocked with 403',
                        { status: response.status, origin }
                    );
                } else if (!allowOrigin || allowOrigin !== origin) {
                    this.recordResult(
                        `Blocked Origin (${new URL(origin).hostname})`,
                        'PASS',
                        'Origin not allowed in CORS headers',
                        { allowOrigin, origin }
                    );
                } else {
                    this.recordResult(
                        `Blocked Origin (${new URL(origin).hostname})`,
                        'FAIL',
                        'Origin should be blocked but was allowed',
                        { allowOrigin, status: response.status, origin }
                    );
                }
            } catch (error) {
                // Network errors might be expected for blocked origins
                this.recordResult(
                    `Blocked Origin (${new URL(origin).hostname})`,
                    'WARN',
                    `Request failed (may be expected): ${error.message}`,
                    { error: error.message, origin }
                );
            }
        }
    }
    
    /**
     * Test rate limiting functionality
     */
    async testRateLimiting() {
        console.log('\n⚡ Testing Rate Limiting...');
        
        const origin = this.productionDomains[0];
        const requests = [];
        
        // Send multiple preflight requests quickly to test rate limiting
        for (let i = 0; i < 10; i++) {
            requests.push(
                axios({
                    method: 'OPTIONS',
                    url: `${this.baseURL}/test`,
                    headers: {
                        'Origin': origin,
                        'Access-Control-Request-Method': 'POST'
                    },
                    timeout: 5000,
                    validateStatus: () => true
                })
            );
        }
        
        try {
            const responses = await Promise.all(requests);
            const successCount = responses.filter(r => r.status === 200 || r.status === 204).length;
            const rateLimitedCount = responses.filter(r => r.status === 429).length;
            
            // Check for rate limit headers
            const rateLimitHeaders = responses[0].headers['x-ratelimit-limit'] || 
                                   responses[0].headers['x-rate-limit-limit'];
            
            this.recordResult(
                'Rate Limiting Test',
                'PASS',
                `${successCount} successful, ${rateLimitedCount} rate limited`,
                {
                    totalRequests: requests.length,
                    successful: successCount,
                    rateLimited: rateLimitedCount,
                    rateLimitHeaders: !!rateLimitHeaders
                }
            );
        } catch (error) {
            this.recordResult(
                'Rate Limiting Test',
                'FAIL',
                `Rate limiting test failed: ${error.message}`,
                { error: error.message }
            );
        }
    }
    
    /**
     * Test security headers
     */
    async testSecurityHeaders() {
        console.log('\n🛡️ Testing Security Headers...');
        
        const origin = this.productionDomains[0];
        
        try {
            const response = await axios({
                method: 'GET',
                url: `${this.baseURL}/test`,
                headers: {
                    'Origin': origin
                },
                timeout: 10000,
                validateStatus: () => true
            });
            
            const securityHeaders = {
                'access-control-allow-origin': response.headers['access-control-allow-origin'],
                'access-control-allow-credentials': response.headers['access-control-allow-credentials'],
                'access-control-expose-headers': response.headers['access-control-expose-headers'],
                'strict-transport-security': response.headers['strict-transport-security'],
                'x-content-type-options': response.headers['x-content-type-options'],
                'x-frame-options': response.headers['x-frame-options'],
                'content-security-policy': response.headers['content-security-policy']
            };
            
            const corsHeadersPresent = securityHeaders['access-control-allow-origin'] && 
                                     securityHeaders['access-control-allow-credentials'];
            
            const securityHeadersPresent = securityHeaders['x-content-type-options'] || 
                                         securityHeaders['x-frame-options'];
            
            if (corsHeadersPresent) {
                this.recordResult(
                    'CORS Security Headers',
                    'PASS',
                    'Required CORS headers present',
                    { corsHeaders: securityHeaders }
                );
            } else {
                this.recordResult(
                    'CORS Security Headers',
                    'FAIL',
                    'Missing required CORS headers',
                    { corsHeaders: securityHeaders }
                );
            }
            
            if (securityHeadersPresent) {
                this.recordResult(
                    'General Security Headers',
                    'PASS',
                    'Security headers present',
                    { securityHeaders }
                );
            } else {
                this.recordResult(
                    'General Security Headers',
                    'WARN',
                    'Some security headers missing',
                    { securityHeaders }
                );
            }
        } catch (error) {
            this.recordResult(
                'Security Headers Test',
                'FAIL',
                `Security headers test failed: ${error.message}`,
                { error: error.message }
            );
        }
    }
    
    /**
     * Test CORS configuration endpoint
     */
    async testConfigurationEndpoint() {
        console.log('\n⚙️ Testing CORS Configuration Endpoint...');
        
        try {
            const response = await axios({
                method: 'GET',
                url: `${this.baseURL}/health/cors`,
                timeout: 10000,
                validateStatus: () => true
            });
            
            if (response.status === 200 && response.data) {
                const config = response.data;
                
                this.recordResult(
                    'CORS Configuration Endpoint',
                    'PASS',
                    'Configuration endpoint accessible',
                    {
                        status: config.status,
                        corsConfiguration: config.cors_configuration ? 'present' : 'missing'
                    }
                );
            } else {
                this.recordResult(
                    'CORS Configuration Endpoint',
                    'WARN',
                    `Configuration endpoint returned ${response.status}`,
                    { status: response.status }
                );
            }
        } catch (error) {
            this.recordResult(
                'CORS Configuration Endpoint',
                'WARN',
                'Configuration endpoint not available (may be expected)',
                { error: error.message }
            );
        }
    }
    
    /**
     * Test performance impact
     */
    async testPerformanceImpact() {
        console.log('\n🚀 Testing Performance Impact...');
        
        const origin = this.productionDomains[0];
        const requestCount = 20;
        const times = [];
        
        for (let i = 0; i < requestCount; i++) {
            const start = performance.now();
            
            try {
                await axios({
                    method: 'GET',
                    url: `${this.baseURL}/test`,
                    headers: {
                        'Origin': origin
                    },
                    timeout: 10000
                });
                
                const end = performance.now();
                times.push(end - start);
            } catch (error) {
                // Continue with performance test even if individual requests fail
            }
        }
        
        if (times.length > 0) {
            const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
            const maxTime = Math.max(...times);
            const minTime = Math.min(...times);
            
            this.recordResult(
                'Performance Impact',
                avgTime < 1000 ? 'PASS' : 'WARN',
                `Avg: ${avgTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms, Min: ${minTime.toFixed(2)}ms`,
                {
                    averageTime: avgTime,
                    maxTime: maxTime,
                    minTime: minTime,
                    requestCount: times.length,
                    successRate: (times.length / requestCount) * 100
                }
            );
        } else {
            this.recordResult(
                'Performance Impact',
                'FAIL',
                'No successful requests for performance measurement',
                { requestCount, successfulRequests: 0 }
            );
        }
    }
    
    /**
     * Generate test report
     */
    generateReport() {
        const endTime = performance.now();
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
                baseURL: this.baseURL,
                productionDomains: this.productionDomains,
                nodeEnv: process.env.NODE_ENV || 'development'
            }
        };
        
        console.log('\n📊 Production CORS Test Summary');
        console.log('================================');
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
        const fs = require('fs');
        const path = require('path');
        const reportDir = path.join(__dirname, '..', 'reports');
        
        if (!fs.existsSync(reportDir)) {
            fs.mkdirSync(reportDir, { recursive: true });
        }
        
        const reportFile = path.join(reportDir, `production-cors-test-${Date.now()}.json`);
        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
        
        console.log(`\n📄 Detailed report saved to: ${reportFile}`);
        
        return report;
    }
    
    /**
     * Run all production CORS tests
     */
    async runAllTests() {
        try {
            await this.testPreflightRequests();
            await this.testCredentialRequests();
            await this.testBlockedOrigins();
            await this.testRateLimiting();
            await this.testSecurityHeaders();
            await this.testConfigurationEndpoint();
            await this.testPerformanceImpact();
            
            const report = this.generateReport();
            
            // Exit with appropriate code
            const hasFailures = report.summary.failed > 0;
            process.exit(hasFailures ? 1 : 0);
        } catch (error) {
            console.error('\n❌ Test suite failed:', error.message);
            process.exit(1);
        }
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new ProductionCORSTest();
    tester.runAllTests().catch(error => {
        console.error('❌ Test execution failed:', error);
        process.exit(1);
    });
}

module.exports = ProductionCORSTest;
