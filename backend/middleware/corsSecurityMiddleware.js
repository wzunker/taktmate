// TaktMate Production CORS Security Middleware
// Enhanced CORS security with monitoring, rate limiting, and violation tracking

const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');

/**
 * Production CORS Security Middleware
 * Provides enhanced security features for CORS handling in production
 */
class CORSSecurityMiddleware {
    constructor(appInsights = null, config = {}) {
        this.appInsights = appInsights;
        this.config = {
            // Rate limiting configuration
            preflightRateLimit: {
                windowMs: config.preflightRateLimit?.windowMs || 60000, // 1 minute
                max: config.preflightRateLimit?.max || 100, // requests per window
                message: 'Too many preflight requests, please try again later.',
                standardHeaders: true,
                legacyHeaders: false
            },
            
            // Slow down configuration for suspicious patterns
            slowDown: {
                windowMs: config.slowDown?.windowMs || 60000, // 1 minute
                delayAfter: config.slowDown?.delayAfter || 50, // allow 50 requests per window without delay
                delayMs: config.slowDown?.delayMs || 500, // add 500ms delay per request after delayAfter
                maxDelayMs: config.slowDown?.maxDelayMs || 20000 // max delay of 20 seconds
            },
            
            // Security settings
            security: {
                logViolations: config.security?.logViolations !== false,
                blockSuspiciousPatterns: config.security?.blockSuspiciousPatterns !== false,
                enableMetrics: config.security?.enableMetrics !== false,
                enableAlerts: config.security?.enableAlerts !== false
            },
            
            // Monitoring thresholds
            thresholds: {
                violationRate: config.thresholds?.violationRate || 0.1, // 10% violation rate triggers alert
                suspiciousOriginThreshold: config.thresholds?.suspiciousOriginThreshold || 5, // 5 requests from blocked origin
                anomalyDetectionWindow: config.thresholds?.anomalyDetectionWindow || 300000 // 5 minutes
            },
            
            // Environment settings
            environment: config.environment || process.env.NODE_ENV || 'development',
            domain: config.domain || 'taktconnect.com'
        };
        
        // Initialize metrics tracking
        this.metrics = {
            totalRequests: 0,
            corsViolations: 0,
            preflightRequests: 0,
            blockedOrigins: new Map(),
            allowedOrigins: new Map(),
            suspiciousPatterns: new Map(),
            lastReset: Date.now()
        };
        
        // Initialize rate limiters
        this.initializeRateLimiters();
        
        // Start periodic metrics reporting
        if (this.config.security.enableMetrics) {
            this.startMetricsReporting();
        }
    }
    
    /**
     * Initialize rate limiting middleware
     */
    initializeRateLimiters() {
        // Preflight request rate limiter
        this.preflightLimiter = rateLimit({
            windowMs: this.config.preflightRateLimit.windowMs,
            max: this.config.preflightRateLimit.max,
            message: this.config.preflightRateLimit.message,
            standardHeaders: this.config.preflightRateLimit.standardHeaders,
            legacyHeaders: this.config.preflightRateLimit.legacyHeaders,
            skip: (req) => req.method !== 'OPTIONS',
            handler: (req, res) => {
                this.trackRateLimitViolation(req, 'preflight_rate_limit');
                res.status(429).json({
                    error: 'Rate limit exceeded',
                    message: this.config.preflightRateLimit.message,
                    retryAfter: Math.ceil(this.config.preflightRateLimit.windowMs / 1000)
                });
            }
        });
        
        // Slow down middleware for suspicious patterns
        this.slowDownMiddleware = slowDown({
            windowMs: this.config.slowDown.windowMs,
            delayAfter: this.config.slowDown.delayAfter,
            delayMs: this.config.slowDown.delayMs,
            maxDelayMs: this.config.slowDown.maxDelayMs,
            skip: (req) => this.config.environment === 'development'
        });
    }
    
    /**
     * Main CORS security middleware
     */
    middleware() {
        return (req, res, next) => {
            // Track request metrics
            this.trackRequest(req);
            
            // Apply rate limiting for preflight requests
            if (req.method === 'OPTIONS') {
                return this.preflightLimiter(req, res, (err) => {
                    if (err) return next(err);
                    this.handlePreflightRequest(req, res, next);
                });
            }
            
            // Apply slow down for suspicious patterns
            this.slowDownMiddleware(req, res, (err) => {
                if (err) return next(err);
                this.handleRegularRequest(req, res, next);
            });
        };
    }
    
    /**
     * Handle preflight OPTIONS requests
     */
    handlePreflightRequest(req, res, next) {
        const origin = req.get('Origin');
        
        // Track preflight request
        this.metrics.preflightRequests++;
        this.trackOriginRequest(origin, 'preflight');
        
        // Log preflight request for monitoring
        if (this.config.security.logViolations) {
            console.log(`CORS Preflight: ${req.method} ${req.path} from ${origin || 'no-origin'}`);
        }
        
        // Track preflight telemetry
        if (this.appInsights) {
            this.appInsights.telemetry.trackEvent('CORS_Preflight_Request', {
                origin: origin || 'no-origin',
                method: req.get('Access-Control-Request-Method') || 'unknown',
                headers: req.get('Access-Control-Request-Headers') || 'none',
                path: req.path,
                userAgent: req.get('User-Agent') || 'unknown'
            });
        }
        
        next();
    }
    
    /**
     * Handle regular requests
     */
    handleRegularRequest(req, res, next) {
        const origin = req.get('Origin');
        
        // Track origin request
        this.trackOriginRequest(origin, 'request');
        
        // Detect suspicious patterns
        if (this.config.security.blockSuspiciousPatterns) {
            const suspiciousScore = this.calculateSuspiciousScore(req);
            if (suspiciousScore > 0.7) {
                this.handleSuspiciousRequest(req, res, suspiciousScore);
                return;
            }
        }
        
        next();
    }
    
    /**
     * Track CORS violations
     */
    trackCORSViolation(req, origin, reason) {
        this.metrics.corsViolations++;
        
        // Track blocked origin
        const blockedCount = this.metrics.blockedOrigins.get(origin) || 0;
        this.metrics.blockedOrigins.set(origin, blockedCount + 1);
        
        // Log violation
        if (this.config.security.logViolations) {
            console.warn(`CORS Violation: ${reason} - Origin: ${origin}, Path: ${req.path}, Method: ${req.method}`);
        }
        
        // Track telemetry
        if (this.appInsights) {
            this.appInsights.telemetry.trackEvent('CORS_Violation', {
                origin: origin || 'no-origin',
                reason: reason,
                path: req.path,
                method: req.method,
                userAgent: req.get('User-Agent') || 'unknown',
                referer: req.get('Referer') || 'none'
            });
            
            // Track as custom metric
            this.appInsights.telemetry.trackMetric('CORS_Violations', 1, {
                origin: origin,
                reason: reason
            });
        }
        
        // Check for alert thresholds
        this.checkAlertThresholds();
    }
    
    /**
     * Track rate limit violations
     */
    trackRateLimitViolation(req, type) {
        const origin = req.get('Origin');
        
        // Log violation
        if (this.config.security.logViolations) {
            console.warn(`Rate Limit Violation: ${type} - Origin: ${origin}, Path: ${req.path}`);
        }
        
        // Track telemetry
        if (this.appInsights) {
            this.appInsights.telemetry.trackEvent('CORS_Rate_Limit_Violation', {
                type: type,
                origin: origin || 'no-origin',
                path: req.path,
                method: req.method,
                userAgent: req.get('User-Agent') || 'unknown'
            });
        }
    }
    
    /**
     * Track individual requests
     */
    trackRequest(req) {
        this.metrics.totalRequests++;
        
        // Reset metrics periodically
        const now = Date.now();
        if (now - this.metrics.lastReset > this.config.thresholds.anomalyDetectionWindow) {
            this.resetPeriodMetrics();
        }
    }
    
    /**
     * Track origin-specific requests
     */
    trackOriginRequest(origin, type) {
        if (!origin) return;
        
        const key = `${origin}:${type}`;
        const count = this.metrics.allowedOrigins.get(key) || 0;
        this.metrics.allowedOrigins.set(key, count + 1);
    }
    
    /**
     * Calculate suspicious score for requests
     */
    calculateSuspiciousScore(req) {
        let score = 0;
        const origin = req.get('Origin');
        const userAgent = req.get('User-Agent') || '';
        const referer = req.get('Referer') || '';
        
        // Check for suspicious origins
        if (origin) {
            // Suspicious TLDs
            if (/\.(tk|ml|ga|cf)$/.test(origin)) score += 0.3;
            
            // IP addresses as origins
            if (/https?:\/\/\d+\.\d+\.\d+\.\d+/.test(origin)) score += 0.4;
            
            // Suspicious subdomains
            if (/\b(admin|test|dev|staging|api)\b/.test(origin) && !origin.includes(this.config.domain)) score += 0.2;
        }
        
        // Check for suspicious user agents
        if (userAgent) {
            // Bot patterns
            if (/bot|crawler|spider|scraper/i.test(userAgent)) score += 0.2;
            
            // Empty or minimal user agents
            if (userAgent.length < 20) score += 0.3;
        }
        
        // Check for suspicious patterns in headers
        const headers = req.headers;
        if (headers['x-forwarded-for'] && headers['x-forwarded-for'].split(',').length > 5) {
            score += 0.2; // Multiple proxy hops
        }
        
        // Check request frequency from same origin
        const blockedCount = this.metrics.blockedOrigins.get(origin) || 0;
        if (blockedCount > this.config.thresholds.suspiciousOriginThreshold) {
            score += 0.4;
        }
        
        return Math.min(score, 1.0);
    }
    
    /**
     * Handle suspicious requests
     */
    handleSuspiciousRequest(req, res, score) {
        const origin = req.get('Origin');
        
        // Track suspicious pattern
        const patternKey = `${origin}:suspicious`;
        const count = this.metrics.suspiciousPatterns.get(patternKey) || 0;
        this.metrics.suspiciousPatterns.set(patternKey, count + 1);
        
        // Log suspicious request
        if (this.config.security.logViolations) {
            console.warn(`Suspicious CORS Request: Score ${score.toFixed(2)} - Origin: ${origin}, Path: ${req.path}`);
        }
        
        // Track telemetry
        if (this.appInsights) {
            this.appInsights.telemetry.trackEvent('CORS_Suspicious_Request', {
                origin: origin || 'no-origin',
                suspiciousScore: score,
                path: req.path,
                method: req.method,
                userAgent: req.get('User-Agent') || 'unknown',
                referer: req.get('Referer') || 'none'
            });
        }
        
        // Block request with appropriate response
        res.status(403).json({
            error: 'Request blocked',
            message: 'Suspicious activity detected',
            code: 'CORS_SECURITY_VIOLATION'
        });
    }
    
    /**
     * Check alert thresholds and trigger alerts if needed
     */
    checkAlertThresholds() {
        if (!this.config.security.enableAlerts) return;
        
        const violationRate = this.metrics.totalRequests > 0 ? 
            this.metrics.corsViolations / this.metrics.totalRequests : 0;
        
        if (violationRate > this.config.thresholds.violationRate) {
            this.triggerAlert('high_violation_rate', {
                violationRate: violationRate,
                totalRequests: this.metrics.totalRequests,
                corsViolations: this.metrics.corsViolations
            });
        }
    }
    
    /**
     * Trigger security alerts
     */
    triggerAlert(type, data) {
        // Log alert
        console.error(`CORS Security Alert: ${type}`, data);
        
        // Track alert telemetry
        if (this.appInsights) {
            this.appInsights.telemetry.trackEvent('CORS_Security_Alert', {
                alertType: type,
                ...data
            });
            
            // Track as exception for visibility
            this.appInsights.telemetry.trackException(new Error(`CORS Security Alert: ${type}`), {
                alertType: type,
                severity: 'warning',
                ...data
            });
        }
    }
    
    /**
     * Start periodic metrics reporting
     */
    startMetricsReporting() {
        setInterval(() => {
            this.reportMetrics();
        }, 60000); // Report every minute
    }
    
    /**
     * Report current metrics
     */
    reportMetrics() {
        if (!this.appInsights) return;
        
        // Report basic metrics
        this.appInsights.telemetry.trackMetric('CORS_Total_Requests', this.metrics.totalRequests);
        this.appInsights.telemetry.trackMetric('CORS_Violations', this.metrics.corsViolations);
        this.appInsights.telemetry.trackMetric('CORS_Preflight_Requests', this.metrics.preflightRequests);
        
        // Report violation rate
        const violationRate = this.metrics.totalRequests > 0 ? 
            this.metrics.corsViolations / this.metrics.totalRequests : 0;
        this.appInsights.telemetry.trackMetric('CORS_Violation_Rate', violationRate);
        
        // Report top blocked origins
        const topBlockedOrigins = Array.from(this.metrics.blockedOrigins.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
        
        topBlockedOrigins.forEach(([origin, count]) => {
            this.appInsights.telemetry.trackMetric('CORS_Blocked_Origin_Requests', count, {
                origin: origin
            });
        });
        
        // Report suspicious patterns
        const suspiciousCount = Array.from(this.metrics.suspiciousPatterns.values())
            .reduce((sum, count) => sum + count, 0);
        this.appInsights.telemetry.trackMetric('CORS_Suspicious_Requests', suspiciousCount);
    }
    
    /**
     * Reset periodic metrics
     */
    resetPeriodMetrics() {
        // Keep cumulative metrics but reset rate-based metrics
        this.metrics.blockedOrigins.clear();
        this.metrics.allowedOrigins.clear();
        this.metrics.suspiciousPatterns.clear();
        this.metrics.lastReset = Date.now();
    }
    
    /**
     * Get current metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            violationRate: this.metrics.totalRequests > 0 ? 
                this.metrics.corsViolations / this.metrics.totalRequests : 0,
            blockedOrigins: Array.from(this.metrics.blockedOrigins.entries()),
            allowedOrigins: Array.from(this.metrics.allowedOrigins.entries()),
            suspiciousPatterns: Array.from(this.metrics.suspiciousPatterns.entries())
        };
    }
    
    /**
     * Create enhanced CORS origin validator with security checks
     */
    createSecureOriginValidator(allowedOrigins) {
        return (origin, callback) => {
            // Allow requests with no origin (mobile apps, Postman, etc.)
            if (!origin) {
                return callback(null, true);
            }
            
            // Check if origin is in allowed list
            if (allowedOrigins.includes(origin)) {
                this.trackOriginRequest(origin, 'allowed');
                return callback(null, true);
            }
            
            // For development, be more permissive but still track
            if (this.config.environment === 'development') {
                console.log('CORS: Allowing origin in development mode:', origin);
                this.trackOriginRequest(origin, 'dev_allowed');
                return callback(null, true);
            }
            
            // Track violation
            this.trackCORSViolation({ get: () => origin, path: 'unknown', method: 'unknown' }, origin, 'origin_not_allowed');
            
            // Block origin
            return callback(new Error('Not allowed by CORS policy'), false);
        };
    }
}

module.exports = CORSSecurityMiddleware;
