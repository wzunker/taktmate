#!/usr/bin/env node

/**
 * Key Vault Integration Testing with Backend Services
 * Tests how Key Vault integrates with the actual application services
 */

const { keyVault } = require('../config/keyVault');

class KeyVaultIntegrationTester {
    constructor() {
        this.testResults = {
            passed: 0,
            failed: 0,
            warnings: 0,
            tests: []
        };
        this.originalEnv = {};
    }

    /**
     * Run a test and record results
     */
    async runTest(testName, testFunction, isWarning = false) {
        try {
            console.log(`\n🔗 Testing: ${testName}`);
            const result = await testFunction();
            
            if (result.success) {
                console.log(`✅ ${testName}: ${result.message || 'PASSED'}`);
                this.testResults.passed++;
                this.testResults.tests.push({
                    name: testName,
                    status: 'passed',
                    message: result.message,
                    details: result.details
                });
            } else {
                if (isWarning) {
                    console.log(`⚠️  ${testName}: ${result.message || 'WARNING'}`);
                    this.testResults.warnings++;
                    this.testResults.tests.push({
                        name: testName,
                        status: 'warning',
                        message: result.message,
                        details: result.details
                    });
                } else {
                    console.log(`❌ ${testName}: ${result.message || 'FAILED'}`);
                    this.testResults.failed++;
                    this.testResults.tests.push({
                        name: testName,
                        status: 'failed',
                        message: result.message,
                        details: result.details
                    });
                }
            }
        } catch (error) {
            console.log(`💥 ${testName}: ${error.message}`);
            this.testResults.failed++;
            this.testResults.tests.push({
                name: testName,
                status: 'error',
                message: error.message,
                details: error.stack
            });
        }
    }

    /**
     * Test OpenAI configuration from Key Vault
     */
    async testOpenAIConfiguration() {
        const config = await keyVault.getAppConfig();
        const hasApiKey = !!config.openai.apiKey;
        const hasEndpoint = !!config.openai.apiEndpoint;
        
        // Test if we can create OpenAI client (without actually calling it)
        let canCreateClient = false;
        try {
            if (hasApiKey) {
                const { OpenAI } = require('openai');
                const client = new OpenAI({
                    apiKey: config.openai.apiKey,
                    baseURL: config.openai.apiEndpoint
                });
                canCreateClient = !!client;
            }
        } catch (error) {
            // Client creation failed
        }
        
        return {
            success: hasApiKey && (hasEndpoint || canCreateClient),
            message: `OpenAI config - API Key: ${hasApiKey}, Endpoint: ${hasEndpoint}, Client: ${canCreateClient}`,
            details: {
                hasApiKey,
                hasEndpoint,
                canCreateClient,
                apiKeyLength: config.openai.apiKey ? config.openai.apiKey.length : 0,
                isPlaceholder: config.openai.apiKey ? config.openai.apiKey.includes('placeholder') : false
            }
        };
    }

    /**
     * Test Azure AD B2C configuration from Key Vault
     */
    async testAzureAdB2CConfiguration() {
        const config = await keyVault.getAppConfig();
        const hasClientId = !!config.azureAdB2c.clientId;
        const hasClientSecret = !!config.azureAdB2c.clientSecret;
        const hasTenantName = !!config.azureAdB2c.tenantName;
        const hasPolicyName = !!config.azureAdB2c.policyName;
        
        // Test if configuration looks valid
        const clientIdValid = hasClientId && config.azureAdB2c.clientId.length > 30;
        const tenantValid = hasTenantName && config.azureAdB2c.tenantName.includes('.onmicrosoft.com');
        
        return {
            success: hasClientId && hasClientSecret && hasTenantName,
            message: `Azure AD B2C config - Complete: ${hasClientId && hasClientSecret && hasTenantName}`,
            details: {
                hasClientId,
                hasClientSecret,
                hasTenantName,
                hasPolicyName,
                clientIdValid,
                tenantValid,
                clientIdPlaceholder: config.azureAdB2c.clientId ? config.azureAdB2c.clientId.includes('placeholder') : false,
                tenantPlaceholder: config.azureAdB2c.tenantName ? config.azureAdB2c.tenantName.includes('placeholder') : false
            }
        };
    }

    /**
     * Test JWT configuration from Key Vault
     */
    async testJWTConfiguration() {
        const config = await keyVault.getAppConfig();
        const hasJwtSecret = !!config.security.jwtSecret;
        const hasSessionSecret = !!config.security.sessionSecret;
        const hasEncryptionKey = !!config.security.encryptionKey;
        
        // Test if secrets are strong enough
        const jwtSecretStrong = hasJwtSecret && config.security.jwtSecret.length >= 32;
        const sessionSecretStrong = hasSessionSecret && config.security.sessionSecret.length >= 32;
        
        // Test if we can use JWT secret
        let canSignJWT = false;
        if (hasJwtSecret) {
            try {
                const jwt = require('jsonwebtoken');
                const token = jwt.sign({ test: true }, config.security.jwtSecret, { expiresIn: '1m' });
                const decoded = jwt.verify(token, config.security.jwtSecret);
                canSignJWT = !!decoded.test;
            } catch (error) {
                // JWT operations failed
            }
        }
        
        return {
            success: hasJwtSecret && hasSessionSecret && jwtSecretStrong,
            message: `JWT config - Strong secrets: ${jwtSecretStrong && sessionSecretStrong}, Can sign: ${canSignJWT}`,
            details: {
                hasJwtSecret,
                hasSessionSecret,
                hasEncryptionKey,
                jwtSecretStrong,
                sessionSecretStrong,
                canSignJWT,
                jwtSecretLength: config.security.jwtSecret ? config.security.jwtSecret.length : 0
            }
        };
    }

    /**
     * Test environment variable integration
     */
    async testEnvironmentIntegration() {
        // Backup current environment
        this.originalEnv = {
            OPENAI_API_KEY: process.env.OPENAI_API_KEY,
            AZURE_AD_B2C_CLIENT_ID: process.env.AZURE_AD_B2C_CLIENT_ID,
            JWT_SECRET: process.env.JWT_SECRET
        };
        
        // Clear environment variables to force Key Vault usage
        delete process.env.OPENAI_API_KEY;
        delete process.env.AZURE_AD_B2C_CLIENT_ID;
        delete process.env.JWT_SECRET;
        
        // Clear cache to force fresh retrieval
        keyVault.clearCache();
        
        // Get configuration
        const config = await keyVault.getAppConfig();
        
        // Restore environment variables
        Object.keys(this.originalEnv).forEach(key => {
            if (this.originalEnv[key]) {
                process.env[key] = this.originalEnv[key];
            }
        });
        
        const hasValues = !!(config.openai.apiKey || config.azureAdB2c.clientId || config.security.jwtSecret);
        
        return {
            success: hasValues,
            message: hasValues 
                ? 'Successfully loaded configuration from Key Vault when env vars are not available'
                : 'Failed to load configuration from Key Vault',
            details: {
                openaiFromKV: !!config.openai.apiKey,
                b2cFromKV: !!config.azureAdB2c.clientId,
                jwtFromKV: !!config.security.jwtSecret,
                anyFromKV: hasValues
            }
        };
    }

    /**
     * Test fallback behavior
     */
    async testFallbackBehavior() {
        // Set environment variables
        process.env.TEST_FALLBACK_SECRET = 'env-value';
        
        // Clear Key Vault cache
        keyVault.clearCache();
        
        // Try to get a secret that doesn't exist in Key Vault
        const value = await keyVault.getSecret('Test-Fallback-Secret');
        
        // Clean up
        delete process.env.TEST_FALLBACK_SECRET;
        
        return {
            success: value === 'env-value',
            message: value === 'env-value' 
                ? 'Fallback to environment variables works correctly'
                : 'Fallback mechanism failed',
            details: {
                expectedValue: 'env-value',
                actualValue: value,
                fallbackWorking: value === 'env-value'
            }
        };
    }

    /**
     * Test configuration loading performance
     */
    async testConfigurationPerformance() {
        const iterations = 3;
        const times = [];
        
        for (let i = 0; i < iterations; i++) {
            keyVault.clearCache(); // Force fresh retrieval
            
            const start = Date.now();
            await keyVault.getAppConfig();
            const end = Date.now();
            
            times.push(end - start);
        }
        
        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        const maxTime = Math.max(...times);
        
        return {
            success: avgTime < 5000, // Less than 5 seconds for full config
            message: `Config loading - Average: ${avgTime.toFixed(0)}ms, Max: ${maxTime}ms`,
            details: {
                iterations,
                times,
                averageMs: avgTime,
                maxMs: maxTime,
                acceptable: avgTime < 5000
            }
        };
    }

    /**
     * Test secret rotation impact
     */
    async testSecretRotation() {
        // Get current JWT secret
        const originalSecret = await keyVault.getSecret('JWT-Secret');
        
        if (!originalSecret) {
            return {
                success: false,
                message: 'Cannot test rotation - JWT secret not available',
                details: { reason: 'No JWT secret found' }
            };
        }
        
        // Simulate rotation by creating a new secret value
        const newSecret = require('crypto').randomBytes(32).toString('base64');
        
        // Try to set the new secret (this might fail if we don't have write permissions)
        const rotationSuccess = await keyVault.setSecret('JWT-Secret', newSecret);
        
        if (rotationSuccess) {
            // Verify we can get the new secret
            keyVault.clearCache();
            const retrievedSecret = await keyVault.getSecret('JWT-Secret');
            
            // Restore original secret
            await keyVault.setSecret('JWT-Secret', originalSecret);
            
            return {
                success: retrievedSecret === newSecret,
                message: retrievedSecret === newSecret 
                    ? 'Secret rotation works correctly'
                    : 'Secret rotation failed - could not retrieve new value',
                details: {
                    canWrite: rotationSuccess,
                    canRead: !!retrievedSecret,
                    rotationWorking: retrievedSecret === newSecret
                }
            };
        } else {
            return {
                success: true, // This is expected in read-only scenarios
                message: 'Secret rotation not available (read-only access)',
                details: {
                    canWrite: false,
                    reason: 'Read-only access to Key Vault'
                }
            };
        }
    }

    /**
     * Test error recovery
     */
    async testErrorRecovery() {
        // Test with invalid Key Vault URL
        const originalUrl = process.env.KEY_VAULT_URL;
        process.env.KEY_VAULT_URL = 'https://invalid-vault.vault.azure.net/';
        
        // Create a new Key Vault instance to test error handling
        const { KeyVaultService } = require('../config/keyVault');
        const testVault = new KeyVaultService();
        
        // Try to get a secret (should fallback to environment)
        process.env.TEST_ERROR_RECOVERY = 'fallback-value';
        const value = await testVault.getSecret('Test-Error-Recovery');
        
        // Clean up
        if (originalUrl) {
            process.env.KEY_VAULT_URL = originalUrl;
        } else {
            delete process.env.KEY_VAULT_URL;
        }
        delete process.env.TEST_ERROR_RECOVERY;
        
        return {
            success: value === 'fallback-value',
            message: value === 'fallback-value'
                ? 'Error recovery works - falls back to environment variables'
                : 'Error recovery failed',
            details: {
                expectedFallback: 'fallback-value',
                actualValue: value,
                recoveryWorking: value === 'fallback-value'
            }
        };
    }

    /**
     * Test concurrent access
     */
    async testConcurrentAccess() {
        const secretNames = ['JWT-Secret', 'Session-Secret', 'OpenAI-API-Key', 'Azure-AD-B2C-Client-ID'];
        
        // Clear cache to ensure fresh retrieval
        keyVault.clearCache();
        
        const start = Date.now();
        
        // Make concurrent requests
        const promises = secretNames.map(name => keyVault.getSecret(name));
        const results = await Promise.allSettled(promises);
        
        const end = Date.now();
        
        const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;
        const failed = results.filter(r => r.status === 'rejected').length;
        
        return {
            success: successful > 0 && failed === 0,
            message: `Concurrent access - ${successful} successful, ${failed} failed in ${end - start}ms`,
            details: {
                requested: secretNames.length,
                successful,
                failed,
                timeMs: end - start,
                results: results.map((r, i) => ({
                    secret: secretNames[i],
                    status: r.status,
                    hasValue: r.status === 'fulfilled' ? !!r.value : false
                }))
            }
        };
    }

    /**
     * Run all integration tests
     */
    async runAllTests() {
        console.log('🔗 Starting Key Vault Integration Tests\n');
        console.log('=' .repeat(50));

        // Configuration integration tests
        await this.runTest('OpenAI Configuration Integration', () => this.testOpenAIConfiguration(), true);
        await this.runTest('Azure AD B2C Configuration Integration', () => this.testAzureAdB2CConfiguration(), true);
        await this.runTest('JWT Configuration Integration', () => this.testJWTConfiguration());
        
        // Environment and fallback tests
        await this.runTest('Environment Variable Integration', () => this.testEnvironmentIntegration(), true);
        await this.runTest('Fallback Behavior', () => this.testFallbackBehavior());
        
        // Performance and reliability tests
        await this.runTest('Configuration Performance', () => this.testConfigurationPerformance());
        await this.runTest('Secret Rotation', () => this.testSecretRotation(), true);
        await this.runTest('Error Recovery', () => this.testErrorRecovery());
        await this.runTest('Concurrent Access', () => this.testConcurrentAccess());

        // Print summary
        this.printSummary();
    }

    /**
     * Print test summary
     */
    printSummary() {
        console.log('\n' + '=' .repeat(50));
        console.log('📊 Key Vault Integration Test Summary');
        console.log('=' .repeat(50));
        
        console.log(`✅ Tests Passed: ${this.testResults.passed}`);
        console.log(`❌ Tests Failed: ${this.testResults.failed}`);
        console.log(`⚠️  Warnings: ${this.testResults.warnings}`);
        console.log(`📝 Total Tests: ${this.testResults.tests.length}`);
        
        const successRate = ((this.testResults.passed / this.testResults.tests.length) * 100).toFixed(1);
        console.log(`📈 Success Rate: ${successRate}%`);
        
        // Show failed tests
        if (this.testResults.failed > 0) {
            console.log('\n❌ Failed Tests:');
            this.testResults.tests
                .filter(test => test.status === 'failed' || test.status === 'error')
                .forEach(test => {
                    console.log(`  - ${test.name}: ${test.message}`);
                });
        }
        
        // Show warnings
        if (this.testResults.warnings > 0) {
            console.log('\n⚠️  Warnings:');
            this.testResults.tests
                .filter(test => test.status === 'warning')
                .forEach(test => {
                    console.log(`  - ${test.name}: ${test.message}`);
                });
        }
        
        // Recommendations
        console.log('\n💡 Recommendations:');
        const warningTests = this.testResults.tests.filter(test => test.status === 'warning');
        
        if (warningTests.some(test => test.details?.clientIdPlaceholder || test.details?.tenantPlaceholder)) {
            console.log('  - Update Azure AD B2C configuration with real values');
        }
        
        if (warningTests.some(test => test.details?.isPlaceholder)) {
            console.log('  - Replace placeholder values with actual API keys');
        }
        
        if (this.testResults.tests.some(test => test.details?.canWrite === false)) {
            console.log('  - Consider setting up write permissions for secret rotation (optional)');
        }
        
        console.log('\n🔗 Key Vault integration testing completed!');
        
        // Exit with appropriate code
        if (this.testResults.failed > 0) {
            console.log('\n❌ Some integration tests failed. Please check the configuration.');
            process.exit(1);
        } else {
            console.log('\n✅ All integration tests passed successfully!');
            process.exit(0);
        }
    }
}

// Run tests if this script is executed directly
if (require.main === module) {
    const tester = new KeyVaultIntegrationTester();
    tester.runAllTests().catch(error => {
        console.error('💥 Integration test suite failed:', error);
        process.exit(1);
    });
}

module.exports = KeyVaultIntegrationTester;
