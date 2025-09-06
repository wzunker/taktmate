// TaktMate Rate Limiting and Security Headers Middleware
// Comprehensive rate limiting, security headers, and abuse protection

const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const helmet = require('helmet');
const crypto = require('crypto');

/**
 * Advanced Rate Limiting and Security Service
 * Provides comprehensive protection against abuse, DDoS, and security vulnerabilities
 */
class RateLimitSecurityService {
    constructor(appInsights = null) {
        this.appInsights = appInsights;
        
        // Rate limiting configurations for different endpoint types
        this.rateLimitConfigs = {
            // General API endpoints
            general: {
                windowMs: 15 * 60 * 1000, // 15 minutes
                max: 100, // 100 requests per window per IP
                message: {
                    error: 'Too many requests',
                    message: 'You have exceeded the rate limit. Please try again later.',
                    retryAfter: 15 * 60, // 15 minutes
                    code: 'RATE_LIMIT_EXCEEDED'
                },
                standardHeaders: true,
                legacyHeaders: false,
                skipSuccessfulRequests: false,
                skipFailedRequests: false
            },
            
            // Authentication endpoints (more restrictive)
            auth: {
                windowMs: 15 * 60 * 1000, // 15 minutes
                max: 10, // 10 login attempts per window per IP
                message: {
                    error: 'Too many authentication attempts',
                    message: 'Too many login attempts from this IP address. Please try again later.',
                    retryAfter: 15 * 60,
                    code: 'AUTH_RATE_LIMIT_EXCEEDED'
                },
                standardHeaders: true,
                legacyHeaders: false,
                skipSuccessfulRequests: true, // Don't count successful logins
                skipFailedRequests: false
            },
            
            // File upload endpoints
            upload: {
                windowMs: 60 * 1000, // 1 minute
                max: 5, // 5 uploads per minute per IP
                message: {
                    error: 'Too many file uploads',
                    message: 'You are uploading files too quickly. Please wait before uploading again.',
                    retryAfter: 60,
                    code: 'UPLOAD_RATE_LIMIT_EXCEEDED'
                },
                standardHeaders: true,
                legacyHeaders: false
            },
            
            // Chat/AI endpoints (expensive operations)
            chat: {
                windowMs: 60 * 1000, // 1 minute
                max: 20, // 20 chat requests per minute per IP
                message: {
                    error: 'Too many chat requests',
                    message: 'You are sending messages too quickly. Please wait before sending another message.',
                    retryAfter: 60,
                    code: 'CHAT_RATE_LIMIT_EXCEEDED'
                },
                standardHeaders: true,
                legacyHeaders: false
            },
            
            // Password reset and sensitive operations
            sensitive: {
                windowMs: 60 * 60 * 1000, // 1 hour
                max: 3, // 3 attempts per hour per IP
                message: {
                    error: 'Too many sensitive operations',
                    message: 'Too many sensitive operations attempted. Please try again later.',
                    retryAfter: 60 * 60,
                    code: 'SENSITIVE_RATE_LIMIT_EXCEEDED'
                },
                standardHeaders: true,
                legacyHeaders: false
            },
            
            // Public/health check endpoints (more permissive)
            public: {
                windowMs: 60 * 1000, // 1 minute
                max: 200, // 200 requests per minute per IP
                message: {
                    error: 'Rate limit exceeded',
                    message: 'Too many requests to public endpoints.',
                    retryAfter: 60,
                    code: 'PUBLIC_RATE_LIMIT_EXCEEDED'
                },
                standardHeaders: true,
                legacyHeaders: false
            }
        };
        
        // Slow down configurations for gradual response delay
        this.slowDownConfigs = {
            // General slow down for suspicious activity
            general: {
                windowMs: 15 * 60 * 1000, // 15 minutes
                delayAfter: 50, // Start slowing down after 50 requests
                delayMs: 500, // Add 500ms delay per request
                maxDelayMs: 20000, // Maximum 20 second delay
                skipFailedRequests: false,
                skipSuccessfulRequests: false
            },
            
            // Chat slow down (prevent spam)
            chat: {
                windowMs: 60 * 1000, // 1 minute
                delayAfter: 10, // Start slowing down after 10 requests
                delayMs: 1000, // Add 1 second delay per request
                maxDelayMs: 10000, // Maximum 10 second delay
            },
            
            // Upload slow down
            upload: {
                windowMs: 60 * 1000, // 1 minute
                delayAfter: 3, // Start slowing down after 3 uploads
                delayMs: 2000, // Add 2 second delay per upload
                maxDelayMs: 30000, // Maximum 30 second delay
            }
        };
        
        // Security headers configuration
        this.securityHeaders = {
            // Content Security Policy
            csp: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: [
                        "'self'", 
                        "'unsafe-inline'", // Required for React development
                        "https://login.microsoftonline.com",
                        "https://*.ciamlogin.com"
                    ],
                    styleSrc: [
                        "'self'", 
                        "'unsafe-inline'", // Required for CSS-in-JS
                        "https://fonts.googleapis.com"
                    ],
                    imgSrc: [
                        "'self'", 
                        "data:", 
                        "https:",
                        "blob:"
                    ],
                    fontSrc: [
                        "'self'", 
                        "data:",
                        "https://fonts.gstatic.com"
                    ],
                    connectSrc: [
                        "'self'",
                        "https://*.ciamlogin.com",
                        "https://*.openai.com",
                        "https://*.applicationinsights.azure.com",
                        "wss://localhost:*", // WebSocket for development
                        process.env.NODE_ENV === 'development' ? "ws://localhost:*" : null
                    ].filter(Boolean),
                    frameSrc: [
                        "'self'",
                        "https://*.ciamlogin.com"
                    ],
                    objectSrc: ["'none'"],
                    mediaSrc: ["'self'"],
                    manifestSrc: ["'self'"],
                    workerSrc: ["'self'", "blob:"],
                    childSrc: ["'self'"],
                    formAction: ["'self'"],
                    upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
                }
            },
            
            // HTTP Strict Transport Security
            hsts: {
                maxAge: 31536000, // 1 year
                includeSubDomains: true,
                preload: true
            },
            
            // Other security headers
            other: {
                crossOriginEmbedderPolicy: false, // Disable for compatibility
                crossOriginOpenerPolicy: false,   // Disable for compatibility
                crossOriginResourcePolicy: { policy: "cross-origin" },
                dnsPrefetchControl: { allow: false },
                frameguard: { action: 'deny' },
                hidePoweredBy: true,
                ieNoOpen: true,
                noSniff: true,
                originAgentCluster: true,
                permittedCrossDomainPolicies: false,
                referrerPolicy: { policy: "no-referrer-when-downgrade" },
                xssFilter: true
            }
        };
        
        // Abuse detection patterns
        this.abusePatterns = {
            // Suspicious request patterns
            rapidFire: {
                threshold: 100, // 100 requests
                timeWindow: 60 * 1000, // in 1 minute
                action: 'block',
                duration: 15 * 60 * 1000 // Block for 15 minutes
            },
            
            // Failed authentication attempts
            authFailures: {
                threshold: 5, // 5 failed attempts
                timeWindow: 15 * 60 * 1000, // in 15 minutes
                action: 'slow',
                duration: 60 * 60 * 1000 // Slow down for 1 hour
            },
            
            // Large payload attacks
            largePayloads: {
                threshold: 3, // 3 large payloads
                timeWindow: 60 * 1000, // in 1 minute
                action: 'block',
                duration: 30 * 60 * 1000 // Block for 30 minutes
            }
        };
        
        // In-memory store for tracking abuse (in production, use Redis)
        this.abuseTracker = new Map();
        this.blockedIPs = new Map();
        
        console.log('🛡️ Rate Limiting and Security Service initialized');
    }
    
    /**
     * Create rate limiter for specific endpoint type
     */
    createRateLimiter(type = 'general', customConfig = {}) {
        const config = { ...this.rateLimitConfigs[type], ...customConfig };
        
        return rateLimit({
            ...config,
            handler: (req, res) => {
                // Track rate limit violation
                this.trackRateLimitViolation(req, type);
                
                // Send rate limit response
                res.status(429).json({
                    ...config.message,
                    timestamp: new Date().toISOString(),
                    ip: req.ip,
                    endpoint: req.path
                });
            },
            onLimitReached: (req, res) => {
                // Track when limit is reached
                this.trackRateLimitReached(req, type);
            }
        });
    }
    
    /**
     * Create slow down middleware for specific endpoint type
     */
    createSlowDown(type = 'general', customConfig = {}) {
        const config = { ...this.slowDownConfigs[type], ...customConfig };
        
        return slowDown({
            ...config,
            onLimitReached: (req, res) => {
                this.trackSlowDownActivated(req, type);
            }
        });
    }
    
    /**
     * Security headers middleware
     */
    createSecurityHeaders() {
        const helmetConfig = {
            contentSecurityPolicy: this.securityHeaders.csp,
            hsts: process.env.NODE_ENV === 'production' ? this.securityHeaders.hsts : false,
            ...this.securityHeaders.other
        };
        
        return [
            helmet(helmetConfig),
            
            // Custom security headers
            (req, res, next) => {
                // Add custom security headers
                res.setHeader('X-API-Version', '1.0');
                res.setHeader('X-Request-ID', this.generateRequestId());
                res.setHeader('X-Content-Type-Options', 'nosniff');
                res.setHeader('X-Frame-Options', 'DENY');
                res.setHeader('X-XSS-Protection', '1; mode=block');
                res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade');
                
                // Add security headers for API responses
                if (req.path.startsWith('/api/') || req.path.startsWith('/upload') || req.path.startsWith('/chat')) {
                    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
                    res.setHeader('Pragma', 'no-cache');
                    res.setHeader('Expires', '0');
                }
                
                // Add CORS security headers (if not handled by CORS middleware)
                if (!res.getHeader('Access-Control-Allow-Origin')) {
                    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
                }
                
                // Add performance and monitoring headers
                res.setHeader('X-Response-Time-Start', Date.now().toString());
                
                // Track security header application
                this.trackSecurityHeaders(req);
                
                next();
            },
            
            // Response time tracking
            (req, res, next) => {
                const startTime = Date.now();
                
                // Capture original end method to set header before response finishes
                const originalEnd = res.end;
                res.end = function(chunk, encoding) {
                    const responseTime = Date.now() - startTime;
                    
                    // Set header before response is sent
                    if (!res.headersSent) {
                        res.setHeader('X-Response-Time', `${responseTime}ms`);
                    }
                    
                    // Track response time for monitoring (don't pass 'this' context issue)
                    try {
                        // Note: 'this' context removed to prevent method access issues
                        console.log(`Response time: ${responseTime}ms for ${req.method} ${req.path}`);
                    } catch (error) {
                        // Silently handle any tracking errors
                    }
                    
                    // Call original end method
                    originalEnd.call(res, chunk, encoding);
                };
                
                next();
            }
        ];
    }
    
    /**
     * Abuse detection middleware
     */
    createAbuseDetection() {
        return (req, res, next) => {
            const clientIP = this.getClientIP(req);
            const now = Date.now();
            
            // Check if IP is currently blocked
            if (this.blockedIPs.has(clientIP)) {
                const blockInfo = this.blockedIPs.get(clientIP);
                if (now < blockInfo.until) {
                    this.trackBlockedRequest(req, blockInfo.reason);
                    return res.status(429).json({
                        error: 'IP temporarily blocked',
                        message: 'Your IP address has been temporarily blocked due to suspicious activity.',
                        reason: blockInfo.reason,
                        blockedUntil: new Date(blockInfo.until).toISOString(),
                        code: 'IP_BLOCKED'
                    });
                } else {
                    // Block has expired, remove it
                    this.blockedIPs.delete(clientIP);
                }
            }
            
            // Track request for abuse detection
            this.trackRequestForAbuse(req);
            
            // Check for abuse patterns
            this.detectAbusePatterns(req);
            
            next();
        };
    }
    
    /**
     * Advanced request tracking for abuse detection
     */
    trackRequestForAbuse(req) {
        const clientIP = this.getClientIP(req);
        const now = Date.now();
        const key = `${clientIP}:${req.path}`;
        
        if (!this.abuseTracker.has(clientIP)) {
            this.abuseTracker.set(clientIP, {
                requests: [],
                authFailures: [],
                largePayloads: [],
                suspiciousActivity: []
            });
        }
        
        const tracker = this.abuseTracker.get(clientIP);
        
        // Track general requests
        tracker.requests.push({
            timestamp: now,
            path: req.path,
            method: req.method,
            userAgent: req.get('User-Agent'),
            contentLength: parseInt(req.get('Content-Length') || '0')
        });
        
        // Clean old entries (keep only last hour)
        const oneHour = 60 * 60 * 1000;
        tracker.requests = tracker.requests.filter(r => now - r.timestamp < oneHour);
        tracker.authFailures = tracker.authFailures.filter(r => now - r.timestamp < oneHour);
        tracker.largePayloads = tracker.largePayloads.filter(r => now - r.timestamp < oneHour);
        tracker.suspiciousActivity = tracker.suspiciousActivity.filter(r => now - r.timestamp < oneHour);
        
        // Track large payloads
        const contentLength = parseInt(req.get('Content-Length') || '0');
        if (contentLength > 5 * 1024 * 1024) { // > 5MB
            tracker.largePayloads.push({
                timestamp: now,
                size: contentLength,
                path: req.path
            });
        }
    }
    
    /**
     * Detect abuse patterns and take action
     */
    detectAbusePatterns(req) {
        const clientIP = this.getClientIP(req);
        const tracker = this.abuseTracker.get(clientIP);
        const now = Date.now();
        
        if (!tracker) return;
        
        // Check for rapid fire requests
        const recentRequests = tracker.requests.filter(r => 
            now - r.timestamp < this.abusePatterns.rapidFire.timeWindow
        );
        
        if (recentRequests.length >= this.abusePatterns.rapidFire.threshold) {
            this.blockIP(clientIP, 'rapid_fire', this.abusePatterns.rapidFire.duration);
            this.trackAbuseDetected(req, 'rapid_fire', recentRequests.length);
        }
        
        // Check for large payload abuse
        const recentLargePayloads = tracker.largePayloads.filter(r => 
            now - r.timestamp < this.abusePatterns.largePayloads.timeWindow
        );
        
        if (recentLargePayloads.length >= this.abusePatterns.largePayloads.threshold) {
            this.blockIP(clientIP, 'large_payloads', this.abusePatterns.largePayloads.duration);
            this.trackAbuseDetected(req, 'large_payloads', recentLargePayloads.length);
        }
    }
    
    /**
     * Block IP address
     */
    blockIP(ip, reason, duration) {
        const until = Date.now() + duration;
        this.blockedIPs.set(ip, {
            reason: reason,
            until: until,
            blockedAt: Date.now()
        });
        
        console.warn(`🚫 Blocked IP ${ip} for ${reason} until ${new Date(until).toISOString()}`);
        
        // Track IP blocking event
        if (this.appInsights) {
            this.appInsights.telemetry.trackEvent('IP_Blocked', {
                ip: ip,
                reason: reason,
                duration: duration,
                until: new Date(until).toISOString()
            });
        }
    }
    
    /**
     * Get client IP address with proxy support
     */
    getClientIP(req) {
        return req.ip || 
               req.connection.remoteAddress || 
               req.socket.remoteAddress ||
               (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
               '0.0.0.0';
    }
    
    /**
     * Generate unique request ID
     */
    generateRequestId() {
        return crypto.randomBytes(16).toString('hex');
    }
    
    /**
     * Track rate limit violation
     */
    trackRateLimitViolation(req, limitType) {
        const clientIP = this.getClientIP(req);
        
        console.warn(`⚠️ Rate limit violation: ${limitType} from ${clientIP} on ${req.path}`);
        
        if (this.appInsights) {
            this.appInsights.telemetry.trackEvent('Rate_Limit_Violation', {
                limitType: limitType,
                ip: clientIP,
                path: req.path,
                method: req.method,
                userAgent: req.get('User-Agent'),
                timestamp: new Date().toISOString()
            });
        }
        
        // Track auth failures for abuse detection
        if (limitType === 'auth') {
            const tracker = this.abuseTracker.get(clientIP);
            if (tracker) {
                tracker.authFailures.push({
                    timestamp: Date.now(),
                    path: req.path
                });
            }
        }
    }
    
    /**
     * Track when rate limit threshold is reached
     */
    trackRateLimitReached(req, limitType) {
        if (this.appInsights) {
            this.appInsights.telemetry.trackEvent('Rate_Limit_Reached', {
                limitType: limitType,
                ip: this.getClientIP(req),
                path: req.path,
                method: req.method
            });
        }
    }
    
    /**
     * Track slow down activation
     */
    trackSlowDownActivated(req, slowDownType) {
        if (this.appInsights) {
            this.appInsights.telemetry.trackEvent('Slow_Down_Activated', {
                slowDownType: slowDownType,
                ip: this.getClientIP(req),
                path: req.path,
                method: req.method
            });
        }
    }
    
    /**
     * Track security headers application
     */
    trackSecurityHeaders(req) {
        if (this.appInsights) {
            this.appInsights.telemetry.trackEvent('Security_Headers_Applied', {
                path: req.path,
                method: req.method,
                userAgent: req.get('User-Agent')
            });
        }
    }
    
    /**
     * Track response time for monitoring
     */
    trackResponseTime(req, responseTime) {
        if (this.appInsights) {
            this.appInsights.telemetry.trackMetric('Response_Time', responseTime, {
                path: req.path,
                method: req.method,
                statusCode: req.res?.statusCode
            });
            
            // Alert on slow responses
            if (responseTime > 5000) { // > 5 seconds
                this.appInsights.telemetry.trackEvent('Slow_Response', {
                    path: req.path,
                    method: req.method,
                    responseTime: responseTime,
                    ip: this.getClientIP(req)
                });
            }
        }
    }
    
    /**
     * Track blocked requests
     */
    trackBlockedRequest(req, reason) {
        if (this.appInsights) {
            this.appInsights.telemetry.trackEvent('Blocked_Request', {
                reason: reason,
                ip: this.getClientIP(req),
                path: req.path,
                method: req.method,
                userAgent: req.get('User-Agent')
            });
        }
    }
    
    /**
     * Track abuse detection events
     */
    trackAbuseDetected(req, abuseType, count) {
        console.warn(`🚨 Abuse detected: ${abuseType} from ${this.getClientIP(req)} (${count} occurrences)`);
        
        if (this.appInsights) {
            this.appInsights.telemetry.trackEvent('Abuse_Detected', {
                abuseType: abuseType,
                count: count,
                ip: this.getClientIP(req),
                path: req.path,
                method: req.method,
                userAgent: req.get('User-Agent'),
                severity: 'high'
            });
        }
    }
    
    /**
     * Get rate limiting status for health checks
     */
    getRateLimitStatus() {
        return {
            activeBlocks: this.blockedIPs.size,
            trackedIPs: this.abuseTracker.size,
            configurations: Object.keys(this.rateLimitConfigs),
            securityHeaders: {
                csp: !!this.securityHeaders.csp,
                hsts: !!this.securityHeaders.hsts,
                other: Object.keys(this.securityHeaders.other).length
            },
            abusePatterns: Object.keys(this.abusePatterns).length
        };
    }
    
    /**
     * Clean up expired entries periodically
     */
    cleanup() {
        const now = Date.now();
        
        // Clean up expired IP blocks
        for (const [ip, blockInfo] of this.blockedIPs) {
            if (now >= blockInfo.until) {
                this.blockedIPs.delete(ip);
                console.log(`✅ Unblocked IP ${ip} (block expired)`);
            }
        }
        
        // Clean up old abuse tracking data
        for (const [ip, tracker] of this.abuseTracker) {
            const oneHour = 60 * 60 * 1000;
            tracker.requests = tracker.requests.filter(r => now - r.timestamp < oneHour);
            tracker.authFailures = tracker.authFailures.filter(r => now - r.timestamp < oneHour);
            tracker.largePayloads = tracker.largePayloads.filter(r => now - r.timestamp < oneHour);
            tracker.suspiciousActivity = tracker.suspiciousActivity.filter(r => now - r.timestamp < oneHour);
            
            // Remove tracker if no recent activity
            if (tracker.requests.length === 0 && 
                tracker.authFailures.length === 0 && 
                tracker.largePayloads.length === 0 && 
                tracker.suspiciousActivity.length === 0) {
                this.abuseTracker.delete(ip);
            }
        }
    }
}

module.exports = {
    RateLimitSecurityService
};
