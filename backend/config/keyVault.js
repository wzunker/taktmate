/**
 * Azure Key Vault Integration for TaktMate Backend
 * Provides secure access to secrets stored in Azure Key Vault
 */

const { SecretClient } = require('@azure/keyvault-secrets');
const { DefaultAzureCredential } = require('@azure/identity');

class KeyVaultService {
    constructor() {
        this.keyVaultUrl = process.env.KEY_VAULT_URL;
        this.client = null;
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        this.isEnabled = false;
        
        this.initialize();
    }

    /**
     * Initialize Key Vault client
     */
    initialize() {
        try {
            // Check if Key Vault is configured
            if (!this.keyVaultUrl) {
                console.warn('Key Vault URL not configured. Using environment variables directly.');
                return;
            }

            // Initialize Azure credential and Key Vault client
            const credential = new DefaultAzureCredential();
            this.client = new SecretClient(this.keyVaultUrl, credential);
            this.isEnabled = true;
            
            console.log('Key Vault service initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Key Vault service:', error.message);
            console.warn('Falling back to environment variables');
        }
    }

    /**
     * Get a secret from Key Vault with caching
     * @param {string} secretName - Name of the secret
     * @param {boolean} useCache - Whether to use cache (default: true)
     * @returns {Promise<string|null>} Secret value or null if not found
     */
    async getSecret(secretName, useCache = true) {
        try {
            // Check cache first
            if (useCache && this.cache.has(secretName)) {
                const cached = this.cache.get(secretName);
                if (Date.now() - cached.timestamp < this.cacheTimeout) {
                    return cached.value;
                }
                this.cache.delete(secretName);
            }

            let secretValue = null;

            if (this.isEnabled && this.client) {
                // Try to get from Key Vault
                try {
                    const response = await this.client.getSecret(secretName);
                    secretValue = response.value;
                } catch (error) {
                    console.warn(`Failed to get secret '${secretName}' from Key Vault:`, error.message);
                }
            }

            // Fallback to environment variables
            if (!secretValue) {
                const envVarName = this.secretNameToEnvVar(secretName);
                secretValue = process.env[envVarName];
            }

            // Cache the result
            if (secretValue && useCache) {
                this.cache.set(secretName, {
                    value: secretValue,
                    timestamp: Date.now()
                });
            }

            return secretValue;
        } catch (error) {
            console.error(`Error getting secret '${secretName}':`, error.message);
            return null;
        }
    }

    /**
     * Get multiple secrets at once
     * @param {string[]} secretNames - Array of secret names
     * @returns {Promise<Object>} Object with secret names as keys and values
     */
    async getSecrets(secretNames) {
        const secrets = {};
        
        // Use Promise.allSettled to get all secrets even if some fail
        const results = await Promise.allSettled(
            secretNames.map(name => this.getSecret(name))
        );

        secretNames.forEach((name, index) => {
            const result = results[index];
            if (result.status === 'fulfilled' && result.value) {
                secrets[name] = result.value;
            } else {
                console.warn(`Failed to get secret '${name}'`);
                secrets[name] = null;
            }
        });

        return secrets;
    }

    /**
     * Set a secret in Key Vault (requires write permissions)
     * @param {string} secretName - Name of the secret
     * @param {string} secretValue - Value of the secret
     * @returns {Promise<boolean>} Success status
     */
    async setSecret(secretName, secretValue) {
        try {
            if (!this.isEnabled || !this.client) {
                throw new Error('Key Vault client not available');
            }

            await this.client.setSecret(secretName, secretValue);
            
            // Update cache
            this.cache.set(secretName, {
                value: secretValue,
                timestamp: Date.now()
            });

            return true;
        } catch (error) {
            console.error(`Error setting secret '${secretName}':`, error.message);
            return false;
        }
    }

    /**
     * Delete a secret from Key Vault
     * @param {string} secretName - Name of the secret
     * @returns {Promise<boolean>} Success status
     */
    async deleteSecret(secretName) {
        try {
            if (!this.isEnabled || !this.client) {
                throw new Error('Key Vault client not available');
            }

            await this.client.beginDeleteSecret(secretName);
            
            // Remove from cache
            this.cache.delete(secretName);

            return true;
        } catch (error) {
            console.error(`Error deleting secret '${secretName}':`, error.message);
            return false;
        }
    }

    /**
     * List all secrets in Key Vault
     * @returns {Promise<string[]>} Array of secret names
     */
    async listSecrets() {
        try {
            if (!this.isEnabled || !this.client) {
                throw new Error('Key Vault client not available');
            }

            const secretNames = [];
            for await (const secretProperties of this.client.listPropertiesOfSecrets()) {
                secretNames.push(secretProperties.name);
            }

            return secretNames;
        } catch (error) {
            console.error('Error listing secrets:', error.message);
            return [];
        }
    }

    /**
     * Check if Key Vault is available and accessible
     * @returns {Promise<boolean>} Availability status
     */
    async isAvailable() {
        try {
            if (!this.isEnabled || !this.client) {
                return false;
            }

            // Try to list secrets as a connectivity test
            const iterator = this.client.listPropertiesOfSecrets();
            await iterator.next();
            
            return true;
        } catch (error) {
            console.warn('Key Vault availability check failed:', error.message);
            return false;
        }
    }

    /**
     * Clear the secret cache
     */
    clearCache() {
        this.cache.clear();
        console.log('Key Vault cache cleared');
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache statistics
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys()),
            enabled: this.isEnabled
        };
    }

    /**
     * Convert secret name to environment variable name
     * @param {string} secretName - Key Vault secret name
     * @returns {string} Environment variable name
     */
    secretNameToEnvVar(secretName) {
        return secretName
            .replace(/[-\s]/g, '_')
            .toUpperCase();
    }

    /**
     * Get application configuration from Key Vault
     * @returns {Promise<Object>} Configuration object
     */
    async getAppConfig() {
        const secretNames = [
            'OpenAI-API-Key',
            'OpenAI-API-Endpoint',
            'Azure-AD-B2C-Client-ID',
            'Azure-AD-B2C-Client-Secret',
            'Azure-AD-B2C-Tenant-Name',
            'Azure-AD-B2C-Policy-Name',
            'JWT-Secret',
            'Session-Secret',
            'Encryption-Key',
            'Database-Connection-String'
        ];

        const secrets = await this.getSecrets(secretNames);

        return {
            openai: {
                apiKey: secrets['OpenAI-API-Key'],
                apiEndpoint: secrets['OpenAI-API-Endpoint']
            },
            azureAdB2c: {
                clientId: secrets['Azure-AD-B2C-Client-ID'],
                clientSecret: secrets['Azure-AD-B2C-Client-Secret'],
                tenantName: secrets['Azure-AD-B2C-Tenant-Name'],
                policyName: secrets['Azure-AD-B2C-Policy-Name']
            },
            security: {
                jwtSecret: secrets['JWT-Secret'],
                sessionSecret: secrets['Session-Secret'],
                encryptionKey: secrets['Encryption-Key']
            },
            database: {
                connectionString: secrets['Database-Connection-String']
            }
        };
    }

    /**
     * Validate that all required secrets are available
     * @returns {Promise<Object>} Validation result
     */
    async validateSecrets() {
        const requiredSecrets = [
            'OpenAI-API-Key',
            'Azure-AD-B2C-Client-ID',
            'JWT-Secret'
        ];

        const results = {
            valid: true,
            missing: [],
            available: []
        };

        for (const secretName of requiredSecrets) {
            const value = await this.getSecret(secretName);
            if (value && value !== 'placeholder-' + secretName.toLowerCase()) {
                results.available.push(secretName);
            } else {
                results.missing.push(secretName);
                results.valid = false;
            }
        }

        return results;
    }

    /**
     * Rotate auto-generated secrets
     * @param {string[]} secretNames - Names of secrets to rotate
     * @returns {Promise<Object>} Rotation results
     */
    async rotateSecrets(secretNames = ['JWT-Secret', 'Session-Secret', 'Encryption-Key']) {
        const results = {
            success: [],
            failed: []
        };

        for (const secretName of secretNames) {
            try {
                // Generate new secure value
                const newValue = require('crypto').randomBytes(32).toString('base64');
                const success = await this.setSecret(secretName, newValue);
                
                if (success) {
                    results.success.push(secretName);
                } else {
                    results.failed.push(secretName);
                }
            } catch (error) {
                console.error(`Failed to rotate secret '${secretName}':`, error.message);
                results.failed.push(secretName);
            }
        }

        return results;
    }
}

// Create singleton instance
const keyVaultService = new KeyVaultService();

module.exports = {
    KeyVaultService,
    keyVault: keyVaultService
};
