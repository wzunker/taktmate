#!/usr/bin/env node

/**
 * Key Vault Configuration and Access Testing
 * Tests Azure Key Vault integration and secret management
 */

const { keyVault } = require('../config/keyVault');

class KeyVaultTester {
    constructor() {
        this.testResults = {
            passed: 0,
            failed: 0,
            warnings: 0,
            tests: []
        };
    }

    /**
     * Run a test and record results
     */
    async runTest(testName, testFunction, isWarning = false) {
        try {
            console.log(`\n🧪 Testing: ${testName}`);
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
     * Test Key Vault initialization
     */
    async testInitialization() {
        return {
            success: keyVault.isEnabled,
            message: keyVault.isEnabled 
                ? 'Key Vault service initialized successfully'
                : 'Key Vault not initialized (using environment variables fallback)',
            details: {
                enabled: keyVault.isEnabled,
                keyVaultUrl: process.env.KEY_VAULT_URL,
                hasClient: !!keyVault.client
            }
        };
    }

    /**
     * Test Key Vault availability
     */
    async testAvailability() {
        const isAvailable = await keyVault.isAvailable();
        return {
            success: isAvailable,
            message: isAvailable 
                ? 'Key Vault is accessible'
                : 'Key Vault is not accessible (may be using env vars fallback)',
            details: { available: isAvailable }
        };
    }

    /**
     * Test secret retrieval
     */
    async testSecretRetrieval() {
        const testSecret = 'JWT-Secret';
        const secretValue = await keyVault.getSecret(testSecret);
        
        return {
            success: !!secretValue,
            message: secretValue 
                ? `Successfully retrieved secret: ${testSecret}`
                : `Failed to retrieve secret: ${testSecret}`,
            details: {
                secretName: testSecret,
                hasValue: !!secretValue,
                valueLength: secretValue ? secretValue.length : 0,
                isPlaceholder: secretValue ? secretValue.includes('placeholder') : false
            }
        };
    }

    /**
     * Test multiple secrets retrieval
     */
    async testMultipleSecrets() {
        const secretNames = [
            'JWT-Secret',
            'Session-Secret',
            'OpenAI-API-Key',
            'Azure-AD-B2C-Client-ID'
        ];
        
        const secrets = await keyVault.getSecrets(secretNames);
        const retrievedCount = Object.values(secrets).filter(v => v !== null).length;
        
        return {
            success: retrievedCount > 0,
            message: `Retrieved ${retrievedCount}/${secretNames.length} secrets`,
            details: {
                requested: secretNames.length,
                retrieved: retrievedCount,
                secrets: Object.keys(secrets).reduce((acc, key) => {
                    acc[key] = {
                        hasValue: !!secrets[key],
                        isPlaceholder: secrets[key] ? secrets[key].includes('placeholder') : false
                    };
                    return acc;
                }, {})
            }
        };
    }

    /**
     * Test application configuration loading
     */
    async testAppConfig() {
        const config = await keyVault.getAppConfig();
        const hasOpenAI = !!config.openai.apiKey;
        const hasB2C = !!config.azureAdB2c.clientId;
        const hasSecurity = !!config.security.jwtSecret;
        
        return {
            success: hasOpenAI || hasB2C || hasSecurity,
            message: `Configuration loaded - OpenAI: ${hasOpenAI}, B2C: ${hasB2C}, Security: ${hasSecurity}`,
            details: {
                openai: {
                    hasApiKey: hasOpenAI,
                    hasEndpoint: !!config.openai.apiEndpoint
                },
                azureAdB2c: {
                    hasClientId: hasB2C,
                    hasClientSecret: !!config.azureAdB2c.clientSecret,
                    hasTenantName: !!config.azureAdB2c.tenantName
                },
                security: {
                    hasJwtSecret: hasSecurity,
                    hasSessionSecret: !!config.security.sessionSecret,
                    hasEncryptionKey: !!config.security.encryptionKey
                }
            }
        };
    }

    /**
     * Test secret validation
     */
    async testSecretValidation() {
        const validation = await keyVault.validateSecrets();
        
        return {
            success: validation.valid,
            message: validation.valid 
                ? 'All required secrets are valid'
                : `Missing required secrets: ${validation.missing.join(', ')}`,
            details: {
                valid: validation.valid,
                available: validation.available,
                missing: validation.missing
            }
        };
    }

    /**
     * Test caching functionality
     */
    async testCaching() {
        // Clear cache first
        keyVault.clearCache();
        
        // Get secret (should cache it)
        const secret1 = await keyVault.getSecret('JWT-Secret');
        const cacheStats1 = keyVault.getCacheStats();
        
        // Get same secret again (should use cache)
        const secret2 = await keyVault.getSecret('JWT-Secret');
        const cacheStats2 = keyVault.getCacheStats();
        
        return {
            success: secret1 === secret2 && cacheStats1.size > 0,
            message: `Caching works - Cache size: ${cacheStats2.size}`,
            details: {
                firstRetrieval: !!secret1,
                secondRetrieval: !!secret2,
                valuesMatch: secret1 === secret2,
                cacheSize: cacheStats2.size,
                cachedKeys: cacheStats2.keys
            }
        };
    }

    /**
     * Test performance
     */
    async testPerformance() {
        const iterations = 5;
        const times = [];
        
        for (let i = 0; i < iterations; i++) {
            const start = Date.now();
            await keyVault.getSecret('JWT-Secret', false); // Don't use cache
            const end = Date.now();
            times.push(end - start);
        }
        
        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        const maxTime = Math.max(...times);
        
        return {
            success: avgTime < 2000, // Less than 2 seconds
            message: `Average retrieval time: ${avgTime.toFixed(0)}ms (max: ${maxTime}ms)`,
            details: {
                iterations,
                times,
                averageMs: avgTime,
                maxMs: maxTime,
                acceptable: avgTime < 2000
            }
        };
    }

    /**
     * Test environment variable fallback
     */
    async testEnvironmentFallback() {
        // Test with a secret that might not exist in Key Vault
        const testEnvVar = 'CUSTOM_TEST_SECRET';
        process.env[testEnvVar] = 'test-value-from-env';
        
        const value = await keyVault.getSecret('Custom-Test-Secret');
        
        // Clean up
        delete process.env[testEnvVar];
        
        return {
            success: value === 'test-value-from-env',
            message: value === 'test-value-from-env' 
                ? 'Environment variable fallback works'
                : 'Environment variable fallback failed',
            details: {
                expectedValue: 'test-value-from-env',
                actualValue: value,
                fallbackWorking: value === 'test-value-from-env'
            }
        };
    }

    /**
     * Test error handling
     */
    async testErrorHandling() {
        // Test with non-existent secret
        const value = await keyVault.getSecret('Non-Existent-Secret-12345');
        
        return {
            success: value === null,
            message: value === null 
                ? 'Error handling works correctly (returns null for missing secrets)'
                : 'Error handling issue (should return null for missing secrets)',
            details: {
                expectedNull: true,
                actualValue: value,
                handlingCorrect: value === null
            }
        };
    }

    /**
     * Run all tests
     */
    async runAllTests() {
        console.log('🔐 Starting Key Vault Integration Tests\n');
        console.log('=' .repeat(50));

        // Core functionality tests
        await this.runTest('Key Vault Initialization', () => this.testInitialization());
        await this.runTest('Key Vault Availability', () => this.testAvailability(), true);
        await this.runTest('Secret Retrieval', () => this.testSecretRetrieval());
        await this.runTest('Multiple Secrets Retrieval', () => this.testMultipleSecrets());
        await this.runTest('Application Configuration', () => this.testAppConfig());
        await this.runTest('Secret Validation', () => this.testSecretValidation(), true);
        
        // Performance and caching tests
        await this.runTest('Caching Functionality', () => this.testCaching());
        await this.runTest('Performance Test', () => this.testPerformance());
        
        // Fallback and error handling tests
        await this.runTest('Environment Variable Fallback', () => this.testEnvironmentFallback());
        await this.runTest('Error Handling', () => this.testErrorHandling());

        // Print summary
        this.printSummary();
    }

    /**
     * Print test summary
     */
    printSummary() {
        console.log('\n' + '=' .repeat(50));
        console.log('📊 Key Vault Test Summary');
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
        
        console.log('\n🔐 Key Vault testing completed!');
        
        // Exit with appropriate code
        if (this.testResults.failed > 0) {
            console.log('\n❌ Some tests failed. Please check the Key Vault configuration.');
            process.exit(1);
        } else {
            console.log('\n✅ All tests passed successfully!');
            process.exit(0);
        }
    }
}

// Run tests if this script is executed directly
if (require.main === module) {
    const tester = new KeyVaultTester();
    tester.runAllTests().catch(error => {
        console.error('💥 Test suite failed:', error);
        process.exit(1);
    });
}

module.exports = KeyVaultTester;
