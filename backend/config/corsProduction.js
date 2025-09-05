// TaktMate Production CORS Configuration
// Enhanced production-ready CORS configuration with security middleware integration

const CORSSecurityMiddleware = require('../middleware/corsSecurityMiddleware');

/**
 * Production CORS Configuration Factory
 * Creates production-optimized CORS configuration with enhanced security
 */
class ProductionCORSConfig {
    constructor(appInsights = null) {
        this.appInsights = appInsights;
        
        // Production domains for TaktMate
        this.productionDomains = [
            'https://app.taktconnect.com',
            'https://www.taktconnect.com'
        ];
        
        // Additional allowed origins from environment
        this.environmentOrigins = [
            process.env.FRONTEND_URL,
            process.env.CORS_ORIGIN_OVERRIDE,
            process.env.ADDITIONAL_CORS_ORIGIN
        ].filter(Boolean);
        
        // Combined allowed origins
        this.allowedOrigins = [
            ...this.productionDomains,
            ...this.environmentOrigins
        ].filter((value, index, self) => self.indexOf(value) === index); // Remove duplicates
        
        // Initialize security middleware
        this.securityMiddleware = new CORSSecurityMiddleware(appInsights, {
            environment: 'production',
            domain: 'taktconnect.com',
            preflightRateLimit: {
                windowMs: 60000, // 1 minute
                max: 100, // 100 preflight requests per minute per IP
                message: 'Too many preflight requests from this IP, please try again later.'
            },
            slowDown: {
                windowMs: 60000, // 1 minute
                delayAfter: 30, // Start slowing down after 30 requests
                delayMs: 1000, // Add 1 second delay per request
                maxDelayMs: 30000 // Maximum 30 second delay
            },
            security: {
                logViolations: true,
                blockSuspiciousPatterns: true,
                enableMetrics: true,
                enableAlerts: true
            },
            thresholds: {
                violationRate: 0.05, // 5% violation rate triggers alert
                suspiciousOriginThreshold: 3, // 3 requests from blocked origin
                anomalyDetectionWindow: 300000 // 5 minutes
            }
        });
        
        // Production CORS options
        this.corsOptions = {
            origin: this.securityMiddleware.createSecureOriginValidator(this.allowedOrigins),
            credentials: true, // Enable cookies and authorization headers
            methods: [
                'GET', 
                'POST', 
                'PUT', 
                'DELETE', 
                'OPTIONS', 
                'HEAD',
                'PATCH'
            ],
            allowedHeaders: [
                // Standard headers
                'Content-Type',
                'Authorization',
                'X-Requested-With',
                'Accept',
                'Origin',
                'Cache-Control',
                
                // File upload headers
                'X-File-Name',
                'X-File-Size',
                'X-File-Type',
                'Content-Disposition',
                
                // Microsoft Entra External ID headers
                'X-MS-CLIENT-PRINCIPAL-ID',
                'X-MS-CLIENT-PRINCIPAL-NAME',
                'X-MS-CLIENT-PRINCIPAL',
                'X-MS-CLIENT-PRINCIPAL-IDP',
                
                // Custom application headers
                'X-API-Version',
                'X-Request-ID',
                'X-Correlation-ID',
                'X-Client-Version',
                'X-Feature-Flags',
                
                // Security headers
                'X-CSRF-Token',
                'X-Session-ID'
            ],
            exposedHeaders: [
                // Pagination headers
                'X-Total-Count',
                'X-Page-Count',
                'X-Current-Page',
                'X-Per-Page',
                
                // Request tracking headers
                'X-Request-ID',
                'X-Correlation-ID',
                'X-Response-Time',
                
                // Rate limiting headers
                'X-Rate-Limit-Limit',
                'X-Rate-Limit-Remaining',
                'X-Rate-Limit-Reset',
                'X-Rate-Limit-Retry-After',
                
                // API versioning headers
                'X-API-Version',
                'X-API-Deprecated',
                
                // Security headers
                'X-Content-Security-Policy-Report-Only',
                
                // File operation headers
                'X-File-Processing-Status',
                'X-File-Processing-ID'
            ],
            optionsSuccessStatus: 200, // Some legacy browsers (IE11) choke on 204
            maxAge: 86400, // 24 hours - cache preflight response
            preflightContinue: false, // Pass control to next handler after preflight
            
            // Custom CORS configuration for production
            credentials: true // Essential for authentication flows
        };
        
        console.log('✅ Production CORS configuration initialized');
        console.log(`📍 Allowed production domains: ${this.productionDomains.length}`);
        console.log(`🔒 Security middleware enabled with monitoring`);
        console.log(`⚡ Rate limiting: 100 preflight requests/minute per IP`);
    }
    
    /**
     * Get CORS middleware for Express.js
     */
    getCORSMiddleware() {
        const cors = require('cors');
        return cors(this.corsOptions);
    }
    
    /**
     * Get security middleware
     */
    getSecurityMiddleware() {
        return this.securityMiddleware.middleware();
    }
    
    /**
     * Get combined middleware stack
     */
    getMiddlewareStack() {
        return [
            this.getSecurityMiddleware(),
            this.getCORSMiddleware()
        ];
    }
    
    /**
     * Validate production CORS configuration
     */
    validate() {
        const issues = [];
        
        // Check for production domains
        if (this.productionDomains.length === 0) {
            issues.push('No production domains configured');
        }
        
        // Validate production domain format
        this.productionDomains.forEach(domain => {
            if (!domain.startsWith('https://')) {
                issues.push(`Production domain must use HTTPS: ${domain}`);
            }
            
            if (!domain.includes('taktconnect.com')) {
                issues.push(`Production domain should be on taktconnect.com: ${domain}`);
            }
        });
        
        // Check for wildcard origins in production
        if (this.allowedOrigins.includes('*')) {
            issues.push('Wildcard origins not allowed in production');
        }
        
        // Check for HTTP origins in production
        const httpOrigins = this.allowedOrigins.filter(origin => origin && origin.startsWith('http://'));
        if (httpOrigins.length > 0) {
            issues.push(`HTTP origins not recommended in production: ${httpOrigins.join(', ')}`);
        }
        
        // Validate security configuration
        if (!this.securityMiddleware) {
            issues.push('Security middleware not initialized');
        }
        
        if (issues.length > 0) {
            console.warn('⚠️  Production CORS configuration issues:');
            issues.forEach(issue => console.warn(`   - ${issue}`));
            return false;
        }
        
        console.log('✅ Production CORS configuration validation passed');
        return true;
    }
    
    /**
     * Get current configuration summary
     */
    getConfigSummary() {
        return {
            environment: 'production',
            domain: 'taktconnect.com',
            allowedOrigins: this.allowedOrigins,
            productionDomains: this.productionDomains,
            environmentOrigins: this.environmentOrigins,
            security: {
                rateLimiting: true,
                violationTracking: true,
                suspiciousPatternDetection: true,
                metricsEnabled: true,
                alertsEnabled: true
            },
            corsOptions: {
                credentials: this.corsOptions.credentials,
                methods: this.corsOptions.methods,
                allowedHeaders: this.corsOptions.allowedHeaders.length,
                exposedHeaders: this.corsOptions.exposedHeaders.length,
                maxAge: this.corsOptions.maxAge
            }
        };
    }
    
    /**
     * Get security metrics
     */
    getSecurityMetrics() {
        return this.securityMiddleware ? this.securityMiddleware.getMetrics() : null;
    }
    
    /**
     * Test production CORS configuration
     */
    async testConfiguration() {
        console.log('🧪 Testing production CORS configuration...');
        
        const testResults = {
            validation: this.validate(),
            origins: {},
            security: {
                rateLimiting: true,
                monitoring: !!this.appInsights
            }
        };
        
        // Test each production domain
        for (const origin of this.productionDomains) {
            try {
                // Simulate origin validation
                const isValid = this.allowedOrigins.includes(origin);
                testResults.origins[origin] = {
                    allowed: isValid,
                    https: origin.startsWith('https://'),
                    domain: origin.includes('taktconnect.com')
                };
            } catch (error) {
                testResults.origins[origin] = {
                    error: error.message
                };
            }
        }
        
        console.log('✅ Production CORS configuration test completed');
        return testResults;
    }
    
    /**
     * Enable enhanced monitoring for production
     */
    enableEnhancedMonitoring() {
        if (!this.appInsights) {
            console.warn('⚠️  Application Insights not available for enhanced monitoring');
            return;
        }
        
        // Track CORS configuration initialization
        this.appInsights.telemetry.trackEvent('CORS_Production_Config_Initialized', {
            allowedOrigins: this.allowedOrigins.length,
            productionDomains: this.productionDomains.length,
            securityEnabled: true,
            rateLimitingEnabled: true
        });
        
        // Set up periodic health checks
        setInterval(() => {
            this.performHealthCheck();
        }, 300000); // Every 5 minutes
        
        console.log('📊 Enhanced CORS monitoring enabled');
    }
    
    /**
     * Perform periodic health checks
     */
    performHealthCheck() {
        const metrics = this.getSecurityMetrics();
        const configSummary = this.getConfigSummary();
        
        if (this.appInsights && metrics) {
            // Report health status
            this.appInsights.telemetry.trackEvent('CORS_Health_Check', {
                totalRequests: metrics.totalRequests,
                corsViolations: metrics.corsViolations,
                violationRate: metrics.violationRate,
                preflightRequests: metrics.preflightRequests,
                blockedOriginsCount: metrics.blockedOrigins.length,
                suspiciousRequestsCount: metrics.suspiciousPatterns.length,
                configurationValid: this.validate()
            });
            
            // Check for anomalies
            if (metrics.violationRate > 0.1) { // 10% violation rate
                this.appInsights.telemetry.trackException(
                    new Error('High CORS violation rate detected'), 
                    {
                        violationRate: metrics.violationRate,
                        totalRequests: metrics.totalRequests,
                        corsViolations: metrics.corsViolations
                    }
                );
            }
        }
    }
}

/**
 * Create and configure production CORS
 */
function createProductionCORS(appInsights = null) {
    const config = new ProductionCORSConfig(appInsights);
    
    // Validate configuration
    if (!config.validate()) {
        throw new Error('Production CORS configuration validation failed');
    }
    
    // Enable enhanced monitoring if Application Insights is available
    if (appInsights) {
        config.enableEnhancedMonitoring();
    }
    
    return config;
}

/**
 * Get production CORS middleware stack
 */
function getProductionCORSMiddleware(appInsights = null) {
    const config = createProductionCORS(appInsights);
    return config.getMiddlewareStack();
}

/**
 * Test production CORS configuration
 */
async function testProductionCORS(appInsights = null) {
    const config = createProductionCORS(appInsights);
    return await config.testConfiguration();
}

module.exports = {
    ProductionCORSConfig,
    createProductionCORS,
    getProductionCORSMiddleware,
    testProductionCORS
};
