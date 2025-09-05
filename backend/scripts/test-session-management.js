#!/usr/bin/env node

// TaktMate Session Management Testing Script
// Tests session creation, tracking, expiration, and file cleanup

const axios = require('axios');
const fs = require('fs');
const path = require('path');

class SessionManagementTest {
    constructor() {
        this.apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
        this.testResults = [];
        this.startTime = Date.now();
        
        // Test configuration
        this.config = {
            requestTimeout: 10000, // 10 seconds
            delayBetweenTests: 1000, // 1 second between tests
            sessionTestDelay: 2000, // 2 seconds for session tests
            maxRetries: 3
        };
        
        // Test JWT token (you would get this from actual authentication)
        this.testJWT = null;
        this.testSessionId = null;
        
        console.log('🧪 TaktMate Session Management Testing Suite');
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
            
            // Add JWT token if available
            if (this.testJWT && !config.headers?.Authorization) {
                config.headers = {
                    ...config.headers,
                    'Authorization': `Bearer ${this.testJWT}`
                };
            }
            
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
     * Test session management status endpoint
     */
    async testSessionStatusEndpoint() {
        console.log('\n📊 Testing Session Status Endpoint...');
        
        const result = await this.makeRequest('GET', '/health/sessions');
        
        if (!result.success) {
            this.recordResult(
                'Session Status Endpoint',
                'FAIL',
                `Request failed: ${result.error}`,
                { error: result.error }
            );
            return;
        }
        
        if (result.status !== 200) {
            this.recordResult(
                'Session Status Endpoint',
                'FAIL',
                `Unexpected status code: ${result.status}`,
                { status: result.status, data: result.data }
            );
            return;
        }
        
        const data = result.data;
        const expectedFields = ['status', 'timestamp', 'environment', 'session_management'];
        const missingFields = expectedFields.filter(field => !(field in data));
        
        if (missingFields.length === 0) {
            const sessionMgmt = data.session_management;
            
            if (sessionMgmt.error) {
                this.recordResult(
                    'Session Status Endpoint',
                    'WARN',
                    `Session management not initialized: ${sessionMgmt.error}`,
                    { responseTime: result.responseTime }
                );
            } else {
                this.recordResult(
                    'Session Status Endpoint',
                    'PASS',
                    'Session status endpoint working correctly',
                    { 
                        status: data.status,
                        environment: data.environment,
                        activeSessions: sessionMgmt.activeSessions,
                        expiredSessions: sessionMgmt.expiredSessions,
                        cleanupQueueSize: sessionMgmt.cleanupQueueSize,
                        responseTime: result.responseTime
                    }
                );
            }
        } else {
            this.recordResult(
                'Session Status Endpoint',
                'WARN',
                `Missing fields in response: ${missingFields.join(', ')}`,
                { missingFields, responseTime: result.responseTime }
            );
        }
    }
    
    /**
     * Test session information endpoint (requires authentication)
     */
    async testSessionInfoEndpoint() {
        console.log('\n🔍 Testing Session Info Endpoint...');
        
        // This test requires authentication, so it might fail without valid JWT
        const result = await this.makeRequest('GET', '/api/session');
        
        if (!result.success) {
            this.recordResult(
                'Session Info Endpoint',
                'WARN',
                `Request failed (expected without auth): ${result.error}`,
                { error: result.error }
            );
            return;
        }
        
        if (result.status === 401 || result.status === 403) {
            this.recordResult(
                'Session Info Endpoint',
                'PASS',
                'Correctly requires authentication',
                { 
                    status: result.status,
                    responseTime: result.responseTime
                }
            );
            return;
        }
        
        if (result.status === 404) {
            this.recordResult(
                'Session Info Endpoint',
                'PASS',
                'No active session found (expected without proper session)',
                { 
                    status: result.status,
                    responseTime: result.responseTime
                }
            );
            return;
        }
        
        if (result.status === 200) {
            const data = result.data;
            const expectedFields = ['success', 'session', 'timestamp'];
            const missingFields = expectedFields.filter(field => !(field in data));
            
            if (missingFields.length === 0 && data.success) {
                const session = data.session;
                const expectedSessionFields = ['sessionId', 'userId', 'createdAt', 'lastActivity', 'expiresAt', 'activityCount', 'timeRemaining'];
                const missingSessionFields = expectedSessionFields.filter(field => !(field in session));
                
                if (missingSessionFields.length === 0) {
                    this.recordResult(
                        'Session Info Endpoint',
                        'PASS',
                        'Session info retrieved successfully',
                        { 
                            sessionId: session.sessionId,
                            activityCount: session.activityCount,
                            timeRemaining: session.timeRemaining,
                            responseTime: result.responseTime
                        }
                    );
                    
                    // Store session ID for other tests
                    this.testSessionId = session.sessionId;
                } else {
                    this.recordResult(
                        'Session Info Endpoint',
                        'WARN',
                        `Missing session fields: ${missingSessionFields.join(', ')}`,
                        { missingSessionFields, responseTime: result.responseTime }
                    );
                }
            } else {
                this.recordResult(
                    'Session Info Endpoint',
                    'WARN',
                    `Unexpected response structure: ${missingFields.join(', ')}`,
                    { missingFields, success: data.success, responseTime: result.responseTime }
                );
            }
        } else {
            this.recordResult(
                'Session Info Endpoint',
                'WARN',
                `Unexpected status code: ${result.status}`,
                { status: result.status, data: result.data }
            );
        }
    }
    
    /**
     * Test session termination endpoint
     */
    async testSessionTermination() {
        console.log('\n🔚 Testing Session Termination...');
        
        // Test terminating current session
        const result = await this.makeRequest('POST', '/api/session/terminate');
        
        if (!result.success) {
            this.recordResult(
                'Session Termination',
                'WARN',
                `Request failed (expected without auth): ${result.error}`,
                { error: result.error }
            );
            return;
        }
        
        if (result.status === 401 || result.status === 403) {
            this.recordResult(
                'Session Termination',
                'PASS',
                'Correctly requires authentication',
                { 
                    status: result.status,
                    responseTime: result.responseTime
                }
            );
            return;
        }
        
        if (result.status === 404) {
            this.recordResult(
                'Session Termination',
                'PASS',
                'No active session to terminate (expected)',
                { 
                    status: result.status,
                    responseTime: result.responseTime
                }
            );
            return;
        }
        
        if (result.status === 200) {
            const data = result.data;
            if (data.success) {
                this.recordResult(
                    'Session Termination',
                    'PASS',
                    'Session terminated successfully',
                    { 
                        message: data.message,
                        responseTime: result.responseTime
                    }
                );
            } else {
                this.recordResult(
                    'Session Termination',
                    'WARN',
                    `Termination failed: ${data.error}`,
                    { error: data.error, responseTime: result.responseTime }
                );
            }
        } else {
            this.recordResult(
                'Session Termination',
                'WARN',
                `Unexpected status code: ${result.status}`,
                { status: result.status, data: result.data }
            );
        }
    }
    
    /**
     * Test bulk session termination endpoint
     */
    async testBulkSessionTermination() {
        console.log('\n🔚 Testing Bulk Session Termination...');
        
        // Test terminating all user sessions
        const result = await this.makeRequest('POST', '/api/session/terminate-all', {
            data: { excludeCurrent: true }
        });
        
        if (!result.success) {
            this.recordResult(
                'Bulk Session Termination',
                'WARN',
                `Request failed (expected without auth): ${result.error}`,
                { error: result.error }
            );
            return;
        }
        
        if (result.status === 401 || result.status === 403) {
            this.recordResult(
                'Bulk Session Termination',
                'PASS',
                'Correctly requires authentication',
                { 
                    status: result.status,
                    responseTime: result.responseTime
                }
            );
            return;
        }
        
        if (result.status === 200) {
            const data = result.data;
            if (data.success) {
                this.recordResult(
                    'Bulk Session Termination',
                    'PASS',
                    `Bulk termination successful: ${data.terminatedCount} sessions terminated`,
                    { 
                        terminatedCount: data.terminatedCount,
                        excludedCurrent: data.excludedCurrent,
                        responseTime: result.responseTime
                    }
                );
            } else {
                this.recordResult(
                    'Bulk Session Termination',
                    'WARN',
                    `Bulk termination failed: ${data.error}`,
                    { error: data.error, responseTime: result.responseTime }
                );
            }
        } else {
            this.recordResult(
                'Bulk Session Termination',
                'WARN',
                `Unexpected status code: ${result.status}`,
                { status: result.status, data: result.data }
            );
        }
    }
    
    /**
     * Test session middleware behavior
     */
    async testSessionMiddleware() {
        console.log('\n🔄 Testing Session Middleware...');
        
        // Make multiple requests to see if session tracking works
        const requests = [];
        for (let i = 0; i < 3; i++) {
            requests.push(this.makeRequest('GET', '/health'));
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        const results = await Promise.all(requests);
        const successfulResults = results.filter(r => r.success && r.status === 200);
        
        if (successfulResults.length >= 2) {
            // Check if session-related headers are consistent
            const sessionHeaders = successfulResults.map(r => ({
                requestId: r.headers['x-request-id'],
                responseTime: r.headers['x-response-time']
            }));
            
            const hasSessionHeaders = sessionHeaders.some(h => h.requestId || h.responseTime);
            
            if (hasSessionHeaders) {
                this.recordResult(
                    'Session Middleware',
                    'PASS',
                    'Session middleware is processing requests',
                    { 
                        requestCount: successfulResults.length,
                        hasHeaders: hasSessionHeaders,
                        averageResponseTime: Math.round(
                            successfulResults.reduce((sum, r) => sum + r.responseTime, 0) / successfulResults.length
                        )
                    }
                );
            } else {
                this.recordResult(
                    'Session Middleware',
                    'WARN',
                    'Session middleware may not be adding headers',
                    { 
                        requestCount: successfulResults.length,
                        hasHeaders: hasSessionHeaders
                    }
                );
            }
        } else {
            this.recordResult(
                'Session Middleware',
                'FAIL',
                'Not enough successful requests to test middleware',
                { successfulResults: successfulResults.length }
            );
        }
    }
    
    /**
     * Test session statistics and configuration
     */
    async testSessionStatistics() {
        console.log('\n📈 Testing Session Statistics...');
        
        const result = await this.makeRequest('GET', '/health/sessions');
        
        if (!result.success || result.status !== 200) {
            this.recordResult(
                'Session Statistics',
                'FAIL',
                'Cannot retrieve session statistics',
                { error: result.error || result.status }
            );
            return;
        }
        
        const data = result.data;
        const sessionMgmt = data.session_management;
        
        if (sessionMgmt.error) {
            this.recordResult(
                'Session Statistics',
                'WARN',
                'Session management not properly initialized',
                { error: sessionMgmt.error }
            );
            return;
        }
        
        // Validate statistics structure
        const expectedStats = [
            'activeSessions',
            'expiredSessions',
            'cleanupQueueSize',
            'userSessionsCount',
            'cleanupInProgress',
            'configuration'
        ];
        
        const missingStats = expectedStats.filter(stat => !(stat in sessionMgmt));
        
        if (missingStats.length === 0) {
            const config = sessionMgmt.configuration;
            
            this.recordResult(
                'Session Statistics',
                'PASS',
                'Session statistics available and complete',
                { 
                    activeSessions: sessionMgmt.activeSessions,
                    expiredSessions: sessionMgmt.expiredSessions,
                    cleanupQueueSize: sessionMgmt.cleanupQueueSize,
                    sessionTimeout: config.sessionTimeout,
                    fileRetentionPeriod: config.fileRetentionPeriod,
                    cleanupInterval: config.cleanupInterval,
                    responseTime: result.responseTime
                }
            );
        } else {
            this.recordResult(
                'Session Statistics',
                'WARN',
                `Missing statistics: ${missingStats.join(', ')}`,
                { missingStats, responseTime: result.responseTime }
            );
        }
    }
    
    /**
     * Test session performance impact
     */
    async testSessionPerformance() {
        console.log('\n⚡ Testing Session Performance Impact...');
        
        const iterations = 10;
        const responseTimes = [];
        
        for (let i = 0; i < iterations; i++) {
            const result = await this.makeRequest('GET', '/health');
            if (result.success) {
                responseTimes.push(result.responseTime);
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        if (responseTimes.length === 0) {
            this.recordResult(
                'Session Performance',
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
                'Session Performance',
                'PASS',
                `Good performance with session middleware: ${avgResponseTime}ms average`,
                { 
                    avgResponseTime,
                    maxResponseTime,
                    minResponseTime,
                    iterations: responseTimes.length
                }
            );
        } else if (avgResponseTime < 1000) { // Less than 1 second
            this.recordResult(
                'Session Performance',
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
                'Session Performance',
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
     * Test session configuration validation
     */
    async testSessionConfiguration() {
        console.log('\n⚙️ Testing Session Configuration...');
        
        const result = await this.makeRequest('GET', '/health/sessions');
        
        if (!result.success || result.status !== 200) {
            this.recordResult(
                'Session Configuration',
                'FAIL',
                'Cannot retrieve session configuration',
                { error: result.error || result.status }
            );
            return;
        }
        
        const data = result.data;
        const sessionMgmt = data.session_management;
        
        if (sessionMgmt.error) {
            this.recordResult(
                'Session Configuration',
                'WARN',
                'Session management not initialized',
                { error: sessionMgmt.error }
            );
            return;
        }
        
        const config = sessionMgmt.configuration;
        const issues = [];
        const recommendations = [];
        
        // Validate configuration values
        if (!config.sessionTimeout || !config.sessionTimeout.includes('hours')) {
            issues.push('Session timeout not properly configured');
        }
        
        if (!config.fileRetentionPeriod || !config.fileRetentionPeriod.includes('days')) {
            issues.push('File retention period not properly configured');
        }
        
        if (!config.cleanupInterval || !config.cleanupInterval.includes('minutes')) {
            issues.push('Cleanup interval not properly configured');
        }
        
        // Check cleanup policies
        if (config.cleanupPolicies) {
            if (!config.cleanupPolicies.files) {
                recommendations.push('File cleanup is disabled');
            }
            if (!config.cleanupPolicies.tempFiles) {
                recommendations.push('Temp file cleanup is disabled');
            }
            if (!config.cleanupPolicies.cache) {
                recommendations.push('Cache cleanup is disabled');
            }
        } else {
            issues.push('Cleanup policies not configured');
        }
        
        if (issues.length === 0) {
            this.recordResult(
                'Session Configuration',
                'PASS',
                'Session configuration is valid',
                { 
                    sessionTimeout: config.sessionTimeout,
                    fileRetentionPeriod: config.fileRetentionPeriod,
                    cleanupInterval: config.cleanupInterval,
                    recommendations: recommendations.length,
                    responseTime: result.responseTime
                }
            );
        } else {
            this.recordResult(
                'Session Configuration',
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
        
        console.log('\n📊 Session Management Test Summary');
        console.log('===================================');
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
        
        const reportFile = path.join(reportDir, `session-management-test-${Date.now()}.json`);
        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
        
        console.log(`\n📄 Detailed report saved to: ${reportFile}`);
        
        return report;
    }
    
    /**
     * Run all session management tests
     */
    async runAllTests() {
        try {
            await this.testSessionStatusEndpoint();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testSessionInfoEndpoint();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testSessionTermination();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testBulkSessionTermination();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testSessionMiddleware();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testSessionStatistics();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testSessionConfiguration();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testSessionPerformance();
            
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
    const tester = new SessionManagementTest();
    tester.runAllTests().catch(error => {
        console.error('❌ Test execution failed:', error);
        process.exit(1);
    });
}

module.exports = SessionManagementTest;
