// TaktMate Dynamic CORS Configuration Module
// Automatically loads environment-specific CORS settings

const path = require('path');

/**
 * Get the current environment for CORS configuration
 * @returns {string} The environment name (production, staging, development)
 */
function getCurrentEnvironment() {
    // Check environment variables in order of priority
    const env = process.env.NODE_ENV || 
                process.env.ENVIRONMENT || 
                process.env.APP_ENV || 
                'development';
    
    // Normalize environment names
    switch (env.toLowerCase()) {
        case 'prod':
        case 'production':
            return 'production';
        case 'stage':
        case 'staging':
            return 'staging';
        case 'dev':
        case 'development':
        case 'local':
        default:
            return 'development';
    }
}

/**
 * Load environment-specific CORS configuration
 * @param {string} environment - The environment to load configuration for
 * @returns {object} The CORS configuration object
 */
function loadCorsConfiguration(environment = null) {
    const targetEnv = environment || getCurrentEnvironment();
    const configFile = path.join(__dirname, `cors-${targetEnv}.js`);
    
    try {
        const config = require(configFile);
        
        // Validate configuration
        if (typeof config.validate === 'function') {
            config.validate();
        }
        
        console.log(`✅ CORS configuration loaded for ${targetEnv} environment`);
        console.log(`📍 Allowed origins: ${config.allowedOrigins.filter(origin => origin && !origin.includes('localhost')).length} production origins`);
        
        return config;
    } catch (error) {
        console.warn(`⚠️  Failed to load CORS configuration for ${targetEnv}: ${error.message}`);
        console.log(`📋 Falling back to default CORS configuration`);
        
        return getDefaultCorsConfiguration();
    }
}

/**
 * Get default CORS configuration as fallback
 * @returns {object} Default CORS configuration
 */
function getDefaultCorsConfiguration() {
    return {
        allowedOrigins: [
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'https://app.taktconnect.com',
            'https://www.taktconnect.com',
            'https://staging.taktconnect.com',
            'https://dev.taktconnect.com',
            process.env.FRONTEND_URL,
            process.env.CORS_ORIGIN_OVERRIDE
        ].filter(Boolean).filter((value, index, self) => self.indexOf(value) === index),

        corsOptions: {
            origin: function(origin, callback) {
                // Allow requests with no origin (mobile apps, Postman, etc.)
                if (!origin) {
                    return callback(null, true);
                }
                
                const allowedOrigins = getDefaultCorsConfiguration().allowedOrigins;
                
                // Check if origin is in allowed list
                if (allowedOrigins.includes(origin)) {
                    return callback(null, true);
                }
                
                // For development, be more permissive
                if (process.env.NODE_ENV === 'development') {
                    console.log('CORS: Allowing origin in development mode:', origin);
                    return callback(null, true);
                }
                
                // Log blocked origin for debugging
                console.warn('CORS: Blocked origin:', origin);
                return callback(new Error('Not allowed by CORS policy'), false);
            },
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH'],
            allowedHeaders: [
                'Content-Type',
                'Authorization',
                'X-Requested-With',
                'Accept',
                'Origin',
                'Cache-Control',
                'X-File-Name',
                'X-File-Size',
                'X-File-Type',
                'X-MS-CLIENT-PRINCIPAL-ID',
                'X-MS-CLIENT-PRINCIPAL-NAME',
                'X-MS-CLIENT-PRINCIPAL',
                'X-API-Version',
                'X-Request-ID',
                'X-Correlation-ID'
            ],
            exposedHeaders: [
                'X-Total-Count',
                'X-Page-Count',
                'X-Request-ID',
                'X-Correlation-ID',
                'X-Rate-Limit-Limit',
                'X-Rate-Limit-Remaining',
                'X-Rate-Limit-Reset'
            ],
            optionsSuccessStatus: 200,
            maxAge: 86400
        },

        environment: 'default',
        domain: 'taktconnect.com',

        security: {
            strictOriginCheck: false,
            logViolations: true,
            preflightRateLimit: {
                windowMs: 60000,
                max: 1000
            }
        },

        validate: function() {
            console.log('CORS: Using default configuration');
            return true;
        }
    };
}

/**
 * Create Express.js compatible CORS middleware options
 * @param {string} environment - Optional environment override
 * @returns {object} CORS middleware options for Express.js
 */
function createCorsMiddlewareOptions(environment = null) {
    const config = loadCorsConfiguration(environment);
    return config.corsOptions;
}

/**
 * Get allowed origins for the current environment
 * @param {string} environment - Optional environment override
 * @returns {array} Array of allowed origins
 */
function getAllowedOrigins(environment = null) {
    const config = loadCorsConfiguration(environment);
    return config.allowedOrigins;
}

/**
 * Check if an origin is allowed
 * @param {string} origin - The origin to check
 * @param {string} environment - Optional environment override
 * @returns {boolean} True if origin is allowed
 */
function isOriginAllowed(origin, environment = null) {
    if (!origin) {
        return true; // Allow requests with no origin
    }
    
    const allowedOrigins = getAllowedOrigins(environment);
    return allowedOrigins.includes(origin);
}

/**
 * Log CORS configuration for debugging
 * @param {string} environment - Optional environment override
 */
function logCorsConfiguration(environment = null) {
    const config = loadCorsConfiguration(environment);
    
    console.log('🔧 CORS Configuration Summary:');
    console.log(`   Environment: ${config.environment}`);
    console.log(`   Domain: ${config.domain}`);
    console.log(`   Allowed Origins: ${config.allowedOrigins.length}`);
    
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG_CORS === 'true') {
        console.log('   Origins List:');
        config.allowedOrigins.forEach((origin, index) => {
            console.log(`     ${index + 1}. ${origin}`);
        });
    }
    
    console.log(`   Strict Origin Check: ${config.security?.strictOriginCheck || false}`);
    console.log(`   Log Violations: ${config.security?.logViolations || false}`);
}

/**
 * Validate CORS configuration for all environments
 * @returns {object} Validation results
 */
function validateAllEnvironments() {
    const environments = ['production', 'staging', 'development'];
    const results = {};
    
    environments.forEach(env => {
        try {
            const config = loadCorsConfiguration(env);
            results[env] = {
                status: 'valid',
                origins: config.allowedOrigins.length,
                productionOrigins: config.allowedOrigins.filter(origin => origin && !origin.includes('localhost')).length
            };
        } catch (error) {
            results[env] = {
                status: 'error',
                error: error.message
            };
        }
    });
    
    return results;
}

module.exports = {
    getCurrentEnvironment,
    loadCorsConfiguration,
    getDefaultCorsConfiguration,
    createCorsMiddlewareOptions,
    getAllowedOrigins,
    isOriginAllowed,
    logCorsConfiguration,
    validateAllEnvironments
};
