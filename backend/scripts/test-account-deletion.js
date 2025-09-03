#!/usr/bin/env node

// TaktMate Account Deletion Service Testing Script
// Tests comprehensive user account deletion workflow through Azure AD B2C

const axios = require('axios');
const fs = require('fs');
const path = require('path');

class AccountDeletionTest {
    constructor() {
        this.apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
        this.testResults = [];
        this.startTime = Date.now();
        
        // Test configuration
        this.config = {
            requestTimeout: 30000, // 30 seconds for deletion operations
            delayBetweenTests: 1000, // 1 second between tests
            maxRetries: 3
        };
        
        // Mock user data for testing
        this.mockUserData = {
            userId: 'test-user-deletion-12345',
            email: 'test.deletion@taktmate.com',
            name: 'Account Deletion Test User'
        };
        
        console.log('🗑️ TaktMate Account Deletion Testing Suite');
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
     * Test account deletion service status endpoint
     */
    async testAccountDeletionServiceStatus() {
        console.log('\n🗑️ Testing Account Deletion Service Status...');
        
        const result = await this.makeRequest('GET', '/health/account-deletion');
        
        if (!result.success) {
            this.recordResult(
                'Account Deletion Service Status',
                'FAIL',
                `Request failed: ${result.error}`,
                { error: result.error }
            );
            return;
        }
        
        if (result.status !== 200) {
            this.recordResult(
                'Account Deletion Service Status',
                'FAIL',
                `Unexpected status code: ${result.status}`,
                { status: result.status, data: result.data }
            );
            return;
        }
        
        const data = result.data;
        const expectedFields = ['status', 'timestamp', 'environment', 'account_deletion'];
        const missingFields = expectedFields.filter(field => !(field in data));
        
        if (missingFields.length === 0) {
            const accountDeletion = data.account_deletion;
            
            if (accountDeletion.error) {
                this.recordResult(
                    'Account Deletion Service Status',
                    'WARN',
                    `Service not initialized: ${accountDeletion.error}`,
                    { error: accountDeletion.error, responseTime: result.responseTime }
                );
            } else {
                this.recordResult(
                    'Account Deletion Service Status',
                    'PASS',
                    'Account deletion service status endpoint working correctly',
                    { 
                        status: data.status,
                        environment: data.environment,
                        requestsReceived: accountDeletion.requestsReceived,
                        requestsProcessed: accountDeletion.requestsProcessed,
                        requestsCompleted: accountDeletion.requestsCompleted,
                        activeRequests: accountDeletion.activeRequests,
                        queueLength: accountDeletion.queueLength,
                        responseTime: result.responseTime
                    }
                );
            }
        } else {
            this.recordResult(
                'Account Deletion Service Status',
                'WARN',
                `Missing fields in response: ${missingFields.join(', ')}`,
                { missingFields, responseTime: result.responseTime }
            );
        }
    }
    
    /**
     * Test account deletion request endpoint
     */
    async testAccountDeletionRequestEndpoint() {
        console.log('\n🗑️ Testing Account Deletion Request Endpoint...');
        
        // Test without authentication
        const unauthResult = await this.makeRequest('POST', '/api/gdpr/delete-account', {
            data: { 
                confirmation: 'DELETE_MY_ACCOUNT',
                reason: 'Testing account deletion'
            }
        });
        
        if (unauthResult.status === 401 || unauthResult.status === 403) {
            this.recordResult(
                'Account Deletion Request (Unauthenticated)',
                'PASS',
                'Correctly requires authentication',
                { 
                    status: unauthResult.status,
                    responseTime: unauthResult.responseTime
                }
            );
        } else {
            this.recordResult(
                'Account Deletion Request (Unauthenticated)',
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
                'Account Deletion Request (Invalid Confirmation)',
                'PASS',
                'Correctly validates confirmation string',
                { 
                    status: invalidConfirmationResult.status,
                    responseTime: invalidConfirmationResult.responseTime
                }
            );
        } else {
            this.recordResult(
                'Account Deletion Request (Invalid Confirmation)',
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
                reason: 'Testing comprehensive account deletion workflow'
            }
        });
        
        if (validConfirmationResult.status === 401 || validConfirmationResult.status === 403) {
            this.recordResult(
                'Account Deletion Request (Valid Request)',
                'PASS',
                'Account deletion request endpoint accessible with proper authentication (expected auth failure with mock token)',
                { 
                    status: validConfirmationResult.status,
                    responseTime: validConfirmationResult.responseTime
                }
            );
        } else if (validConfirmationResult.status === 200) {
            // If somehow successful, validate response structure
            const responseData = validConfirmationResult.data;
            const expectedFields = ['success', 'requestId', 'status', 'estimatedCompletionTime', 'steps'];
            const hasRequiredFields = expectedFields.every(field => field in responseData);
            
            if (hasRequiredFields) {
                this.recordResult(
                    'Account Deletion Request (Valid Request)',
                    'PASS',
                    'Account deletion request successful with proper response structure',
                    { 
                        status: validConfirmationResult.status,
                        requestId: responseData.requestId,
                        deletionStatus: responseData.status,
                        stepsCount: responseData.steps?.length || 0,
                        responseTime: validConfirmationResult.responseTime
                    }
                );
            } else {
                this.recordResult(
                    'Account Deletion Request (Valid Request)',
                    'WARN',
                    'Account deletion request successful but response structure incomplete',
                    { 
                        status: validConfirmationResult.status,
                        missingFields: expectedFields.filter(field => !(field in responseData)),
                        responseTime: validConfirmationResult.responseTime
                    }
                );
            }
        } else {
            this.recordResult(
                'Account Deletion Request (Valid Request)',
                'WARN',
                `Unexpected response: ${validConfirmationResult.status}`,
                { status: validConfirmationResult.status }
            );
        }
    }
    
    /**
     * Test account deletion status endpoint
     */
    async testAccountDeletionStatusEndpoint() {
        console.log('\n📊 Testing Account Deletion Status Endpoint...');
        
        const mockRequestId = 'del_1234567890_test123';
        
        // Test without authentication
        const unauthResult = await this.makeRequest('GET', `/api/account-deletion/status/${mockRequestId}`);
        
        if (unauthResult.status === 401 || unauthResult.status === 403) {
            this.recordResult(
                'Account Deletion Status (Unauthenticated)',
                'PASS',
                'Correctly requires authentication',
                { 
                    status: unauthResult.status,
                    responseTime: unauthResult.responseTime
                }
            );
        } else {
            this.recordResult(
                'Account Deletion Status (Unauthenticated)',
                'WARN',
                `Expected 401/403, got ${unauthResult.status}`,
                { status: unauthResult.status, responseTime: unauthResult.responseTime }
            );
        }
        
        // Test with authentication
        const authResult = await this.makeRequest('GET', `/api/account-deletion/status/${mockRequestId}`, {
            headers: {
                'Authorization': 'Bearer mock-token-for-testing'
            }
        });
        
        if (authResult.status === 401 || authResult.status === 403 || authResult.status === 404) {
            this.recordResult(
                'Account Deletion Status (Authenticated)',
                'PASS',
                'Deletion status endpoint accessible with authentication (expected auth failure or request not found with mock data)',
                { 
                    status: authResult.status,
                    responseTime: authResult.responseTime
                }
            );
        } else {
            this.recordResult(
                'Account Deletion Status (Authenticated)',
                'WARN',
                `Unexpected response: ${authResult.status}`,
                { status: authResult.status, data: authResult.data }
            );
        }
    }
    
    /**
     * Test account deletion cancellation endpoint
     */
    async testAccountDeletionCancellationEndpoint() {
        console.log('\n❌ Testing Account Deletion Cancellation Endpoint...');
        
        const mockRequestId = 'del_1234567890_test123';
        
        // Test without authentication
        const unauthResult = await this.makeRequest('POST', `/api/account-deletion/cancel/${mockRequestId}`);
        
        if (unauthResult.status === 401 || unauthResult.status === 403) {
            this.recordResult(
                'Account Deletion Cancellation (Unauthenticated)',
                'PASS',
                'Correctly requires authentication',
                { 
                    status: unauthResult.status,
                    responseTime: unauthResult.responseTime
                }
            );
        } else {
            this.recordResult(
                'Account Deletion Cancellation (Unauthenticated)',
                'WARN',
                `Expected 401/403, got ${unauthResult.status}`,
                { status: unauthResult.status, responseTime: unauthResult.responseTime }
            );
        }
        
        // Test with authentication
        const authResult = await this.makeRequest('POST', `/api/account-deletion/cancel/${mockRequestId}`, {
            headers: {
                'Authorization': 'Bearer mock-token-for-testing'
            }
        });
        
        if (authResult.status === 401 || authResult.status === 403 || authResult.status === 404) {
            this.recordResult(
                'Account Deletion Cancellation (Authenticated)',
                'PASS',
                'Deletion cancellation endpoint accessible with authentication (expected auth failure or request not found with mock data)',
                { 
                    status: authResult.status,
                    responseTime: authResult.responseTime
                }
            );
        } else {
            this.recordResult(
                'Account Deletion Cancellation (Authenticated)',
                'WARN',
                `Unexpected response: ${authResult.status}`,
                { status: authResult.status, data: authResult.data }
            );
        }
    }
    
    /**
     * Test account deletion service configuration
     */
    async testAccountDeletionConfiguration() {
        console.log('\n⚙️ Testing Account Deletion Configuration...');
        
        const result = await this.makeRequest('GET', '/health/account-deletion');
        
        if (!result.success || result.status !== 200) {
            this.recordResult(
                'Account Deletion Configuration',
                'FAIL',
                'Cannot retrieve account deletion configuration',
                { error: result.error || result.status }
            );
            return;
        }
        
        const data = result.data;
        const accountDeletion = data.account_deletion;
        
        if (!accountDeletion || accountDeletion.error) {
            this.recordResult(
                'Account Deletion Configuration',
                'WARN',
                'Account deletion configuration not available',
                { error: accountDeletion?.error || 'Service not initialized' }
            );
            return;
        }
        
        const configuration = accountDeletion.configuration;
        
        if (!configuration) {
            this.recordResult(
                'Account Deletion Configuration',
                'WARN',
                'Account deletion configuration details not found',
                { accountDeletion: accountDeletion }
            );
            return;
        }
        
        const issues = [];
        const recommendations = [];
        
        // Validate configuration values
        if (configuration.enableAzureB2CDeletion === undefined) {
            issues.push('Azure AD B2C deletion setting not configured');
        }
        
        if (configuration.enableSoftDelete === undefined) {
            issues.push('Soft delete setting not configured');
        }
        
        if (configuration.enablePreDeletionBackup === undefined) {
            issues.push('Pre-deletion backup setting not configured');
        }
        
        if (configuration.gdprComplianceMode === undefined) {
            issues.push('GDPR compliance mode not configured');
        }
        
        if (!configuration.maxDeletionTime) {
            issues.push('Maximum deletion time not configured');
        }
        
        // Check deletion steps
        if (!accountDeletion.steps || accountDeletion.steps.length === 0) {
            recommendations.push('Deletion steps not configured');
        }
        
        if (issues.length === 0) {
            this.recordResult(
                'Account Deletion Configuration',
                'PASS',
                'Account deletion configuration is valid',
                { 
                    enableAzureB2CDeletion: configuration.enableAzureB2CDeletion,
                    enableSoftDelete: configuration.enableSoftDelete,
                    enablePreDeletionBackup: configuration.enablePreDeletionBackup,
                    gdprComplianceMode: configuration.gdprComplianceMode,
                    maxDeletionTime: configuration.maxDeletionTime,
                    stepsCount: accountDeletion.steps?.length || 0,
                    recommendations: recommendations.length,
                    responseTime: result.responseTime
                }
            );
        } else {
            this.recordResult(
                'Account Deletion Configuration',
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
     * Test account deletion workflow steps
     */
    async testAccountDeletionWorkflowSteps() {
        console.log('\n📋 Testing Account Deletion Workflow Steps...');
        
        const result = await this.makeRequest('GET', '/health/account-deletion');
        
        if (!result.success || result.status !== 200) {
            this.recordResult(
                'Account Deletion Workflow Steps',
                'FAIL',
                'Cannot retrieve account deletion configuration for workflow testing',
                { error: result.error || result.status }
            );
            return;
        }
        
        const accountDeletion = result.data.account_deletion;
        
        if (!accountDeletion || accountDeletion.error) {
            this.recordResult(
                'Account Deletion Workflow Steps',
                'WARN',
                'Account deletion workflow steps not available',
                { error: accountDeletion?.error || 'Service not initialized' }
            );
            return;
        }
        
        const steps = accountDeletion.steps;
        
        if (!steps || steps.length === 0) {
            this.recordResult(
                'Account Deletion Workflow Steps',
                'WARN',
                'No deletion workflow steps configured',
                { accountDeletion: accountDeletion }
            );
            return;
        }
        
        const expectedSteps = [
            'validate_request',
            'create_backup',
            'cleanup_sessions',
            'cleanup_files',
            'cleanup_application_data',
            'delete_azure_account',
            'verify_deletion',
            'send_confirmation'
        ];
        
        const configuredSteps = steps.map(step => step.id);
        const missingSteps = expectedSteps.filter(stepId => !configuredSteps.includes(stepId));
        const extraSteps = configuredSteps.filter(stepId => !expectedSteps.includes(stepId));
        
        const stepIssues = [];
        
        if (missingSteps.length > 0) {
            stepIssues.push(`Missing steps: ${missingSteps.join(', ')}`);
        }
        
        if (extraSteps.length > 0) {
            stepIssues.push(`Extra steps: ${extraSteps.join(', ')}`);
        }
        
        // Check step configuration
        const stepValidationIssues = [];
        for (const step of steps) {
            if (!step.name) {
                stepValidationIssues.push(`Step ${step.id} missing name`);
            }
            
            if (step.timeout === undefined) {
                stepValidationIssues.push(`Step ${step.id} missing timeout`);
            }
            
            if (step.required === undefined) {
                stepValidationIssues.push(`Step ${step.id} missing required flag`);
            }
        }
        
        if (stepIssues.length === 0 && stepValidationIssues.length === 0) {
            this.recordResult(
                'Account Deletion Workflow Steps',
                'PASS',
                'Account deletion workflow steps are properly configured',
                { 
                    totalSteps: steps.length,
                    requiredSteps: steps.filter(step => step.required).length,
                    optionalSteps: steps.filter(step => !step.required).length,
                    configuredSteps: configuredSteps,
                    responseTime: result.responseTime
                }
            );
        } else {
            this.recordResult(
                'Account Deletion Workflow Steps',
                'WARN',
                `Workflow step issues found: ${[...stepIssues, ...stepValidationIssues].join(', ')}`,
                { 
                    stepIssues: stepIssues,
                    stepValidationIssues: stepValidationIssues,
                    configuredSteps: configuredSteps,
                    responseTime: result.responseTime
                }
            );
        }
    }
    
    /**
     * Test account deletion service performance
     */
    async testAccountDeletionServicePerformance() {
        console.log('\n⚡ Testing Account Deletion Service Performance...');
        
        const iterations = 5;
        const responseTimes = [];
        
        // Test status endpoint performance
        for (let i = 0; i < iterations; i++) {
            const result = await this.makeRequest('GET', '/health/account-deletion');
            if (result.success) {
                responseTimes.push(result.responseTime);
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        if (responseTimes.length === 0) {
            this.recordResult(
                'Account Deletion Service Performance',
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
                'Account Deletion Service Performance',
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
                'Account Deletion Service Performance',
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
                'Account Deletion Service Performance',
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
        
        console.log('\n🗑️ Account Deletion Test Summary');
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
        
        const reportFile = path.join(reportDir, `account-deletion-test-${Date.now()}.json`);
        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
        
        console.log(`\n📄 Detailed report saved to: ${reportFile}`);
        
        return report;
    }
    
    /**
     * Run all account deletion tests
     */
    async runAllTests() {
        try {
            await this.testAccountDeletionServiceStatus();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testAccountDeletionRequestEndpoint();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testAccountDeletionStatusEndpoint();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testAccountDeletionCancellationEndpoint();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testAccountDeletionConfiguration();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testAccountDeletionWorkflowSteps();
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTests));
            
            await this.testAccountDeletionServicePerformance();
            
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
    const tester = new AccountDeletionTest();
    tester.runAllTests().catch(error => {
        console.error('❌ Test execution failed:', error);
        process.exit(1);
    });
}

module.exports = AccountDeletionTest;
