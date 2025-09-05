// TaktMate Comprehensive Error Handling and Logging System
// Advanced error logging, categorization, alerting, and monitoring

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * Advanced Error Logging and Monitoring Service
 * Provides comprehensive error handling, structured logging, alerting, and monitoring
 */
class ErrorLoggingService {
    constructor(appInsights = null) {
        this.appInsights = appInsights;
        
        // Configuration
        this.config = {
            // Logging levels
            logLevel: process.env.LOG_LEVEL || 'info',
            enableFileLogging: process.env.ENABLE_FILE_LOGGING !== 'false',
            enableConsoleLogging: process.env.ENABLE_CONSOLE_LOGGING !== 'false',
            enableRemoteLogging: process.env.ENABLE_REMOTE_LOGGING === 'true',
            
            // File logging settings
            logDirectory: process.env.LOG_DIRECTORY || path.join(process.cwd(), 'logs'),
            maxLogFileSize: parseInt(process.env.MAX_LOG_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
            maxLogFiles: parseInt(process.env.MAX_LOG_FILES) || 10,
            logRotationInterval: parseInt(process.env.LOG_ROTATION_INTERVAL) || 24 * 60 * 60 * 1000, // 24 hours
            
            // Error categorization
            enableErrorCategorization: true,
            enableErrorAggregation: true,
            errorAggregationWindow: 5 * 60 * 1000, // 5 minutes
            
            // Alerting settings
            enableAlerting: process.env.ENABLE_ERROR_ALERTING === 'true',
            alertThresholds: {
                critical: 5,  // 5 critical errors in window
                error: 20,    // 20 errors in window
                warning: 50   // 50 warnings in window
            },
            alertWindow: 15 * 60 * 1000, // 15 minutes
            
            // Performance monitoring
            enablePerformanceLogging: true,
            slowRequestThreshold: 5000, // 5 seconds
            
            // Privacy and security
            enableDataSanitization: true,
            sanitizeFields: ['password', 'token', 'secret', 'key', 'authorization'],
            enablePIIDetection: true,
            
            // Retention settings
            logRetentionPeriod: 30 * 24 * 60 * 60 * 1000, // 30 days
            errorReportRetention: 7 * 24 * 60 * 60 * 1000   // 7 days
        };
        
        // Log levels hierarchy
        this.logLevels = {
            error: 0,
            warn: 1,
            info: 2,
            http: 3,
            verbose: 4,
            debug: 5,
            silly: 6
        };
        
        // Error categories and patterns
        this.errorCategories = {
            AUTHENTICATION: {
                patterns: ['auth', 'token', 'jwt', 'login', 'permission', 'unauthorized'],
                severity: 'high',
                alertable: true,
                description: 'Authentication and authorization errors'
            },
            VALIDATION: {
                patterns: ['validation', 'invalid', 'malformed', 'schema', 'format'],
                severity: 'medium',
                alertable: false,
                description: 'Input validation and format errors'
            },
            SYSTEM: {
                patterns: ['database', 'connection', 'timeout', 'service', 'unavailable'],
                severity: 'high',
                alertable: true,
                description: 'System and infrastructure errors'
            },
            SECURITY: {
                patterns: ['security', 'attack', 'suspicious', 'blocked', 'abuse'],
                severity: 'critical',
                alertable: true,
                description: 'Security-related errors and threats'
            },
            PERFORMANCE: {
                patterns: ['slow', 'timeout', 'memory', 'cpu', 'performance'],
                severity: 'medium',
                alertable: true,
                description: 'Performance-related issues'
            },
            EXTERNAL: {
                patterns: ['external', 'api', 'third-party', 'azure', 'service'],
                severity: 'medium',
                alertable: true,
                description: 'External service integration errors'
            },
            USER: {
                patterns: ['user', 'client', 'request', 'input'],
                severity: 'low',
                alertable: false,
                description: 'User-related errors and bad requests'
            }
        };
        
        // Error aggregation and statistics
        this.errorStats = {
            totalErrors: 0,
            errorsByCategory: {},
            errorsByLevel: {},
            errorsByEndpoint: {},
            errorsByUser: {},
            recentErrors: [],
            alertsSent: 0,
            lastAlert: null
        };
        
        // Error aggregation window
        this.errorAggregation = new Map();
        
        // Alert tracking
        this.alertHistory = [];
        this.alertCooldown = new Map();
        
        // Log file management
        this.currentLogFile = null;
        this.logFileHandle = null;
        
        console.log('📋 Error Logging Service initialized');
        console.log(`   Log Level: ${this.config.logLevel}`);
        console.log(`   File Logging: ${this.config.enableFileLogging ? '✅' : '❌'}`);
        console.log(`   Console Logging: ${this.config.enableConsoleLogging ? '✅' : '❌'}`);
        console.log(`   Remote Logging: ${this.config.enableRemoteLogging ? '✅' : '❌'}`);
        console.log(`   Error Categorization: ${this.config.enableErrorCategorization ? '✅' : '❌'}`);
        console.log(`   Alerting: ${this.config.enableAlerting ? '✅' : '❌'}`);
    }
    
    /**
     * Initialize logging system
     */
    async initialize() {
        try {
            // Create log directory if it doesn't exist
            if (this.config.enableFileLogging) {
                await this.ensureLogDirectory();
                await this.initializeLogFile();
            }
            
            // Start log rotation timer
            this.startLogRotation();
            
            // Start error aggregation cleanup
            this.startErrorAggregationCleanup();
            
            // Start alert processing
            this.startAlertProcessing();
            
            console.log('✅ Error logging system initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize error logging system:', error.message);
        }
    }
    
    /**
     * Log an error with comprehensive context and analysis
     */
    async logError(error, context = {}, request = null) {
        try {
            const logEntry = await this.createLogEntry('error', error, context, request);
            
            // Categorize error
            if (this.config.enableErrorCategorization) {
                logEntry.category = this.categorizeError(error, logEntry);
                logEntry.severity = this.determineSeverity(error, logEntry);
            }
            
            // Add to statistics
            this.updateErrorStatistics(logEntry);
            
            // Add to aggregation
            if (this.config.enableErrorAggregation) {
                this.addToAggregation(logEntry);
            }
            
            // Write to logs
            await this.writeToLogs(logEntry);
            
            // Send to Application Insights
            if (this.appInsights) {
                this.sendToApplicationInsights(logEntry);
            }
            
            // Check for alerting conditions
            if (this.config.enableAlerting) {
                await this.checkAlertConditions(logEntry);
            }
            
            // Track in recent errors for monitoring
            this.trackRecentError(logEntry);
            
        } catch (loggingError) {
            // Fallback logging - don't let logging errors break the application
            console.error('❌ Error logging failed:', loggingError.message);
            console.error('   Original error:', error.message);
        }
    }
    
    /**
     * Log a warning with context
     */
    async logWarning(message, context = {}, request = null) {
        try {
            const logEntry = await this.createLogEntry('warn', { message }, context, request);
            
            // Categorize warning
            if (this.config.enableErrorCategorization) {
                logEntry.category = this.categorizeError({ message }, logEntry);
                logEntry.severity = 'medium';
            }
            
            // Update statistics
            this.updateErrorStatistics(logEntry);
            
            // Write to logs
            await this.writeToLogs(logEntry);
            
            // Send to Application Insights
            if (this.appInsights) {
                this.sendToApplicationInsights(logEntry);
            }
            
        } catch (loggingError) {
            console.error('❌ Warning logging failed:', loggingError.message);
        }
    }
    
    /**
     * Log general information
     */
    async logInfo(message, context = {}, request = null) {
        if (this.shouldLog('info')) {
            try {
                const logEntry = await this.createLogEntry('info', { message }, context, request);
                
                // Write to logs
                await this.writeToLogs(logEntry);
                
                // Send to Application Insights for important info
                if (this.appInsights && context.important) {
                    this.sendToApplicationInsights(logEntry);
                }
                
            } catch (loggingError) {
                console.error('❌ Info logging failed:', loggingError.message);
            }
        }
    }
    
    /**
     * Log HTTP request/response information
     */
    async logHTTP(request, response, duration, error = null) {
        if (this.shouldLog('http')) {
            try {
                const logEntry = await this.createHTTPLogEntry(request, response, duration, error);
                
                // Check for slow requests
                if (duration > this.config.slowRequestThreshold) {
                    logEntry.slow = true;
                    logEntry.level = 'warn';
                    logEntry.category = 'PERFORMANCE';
                }
                
                // Write to logs
                await this.writeToLogs(logEntry);
                
                // Send performance data to Application Insights
                if (this.appInsights && this.config.enablePerformanceLogging) {
                    this.sendPerformanceData(logEntry);
                }
                
            } catch (loggingError) {
                console.error('❌ HTTP logging failed:', loggingError.message);
            }
        }
    }
    
    /**
     * Create comprehensive log entry
     */
    async createLogEntry(level, error, context = {}, request = null) {
        const timestamp = new Date().toISOString();
        const requestId = this.generateRequestId();
        
        const logEntry = {
            timestamp: timestamp,
            level: level,
            requestId: requestId,
            
            // Error information
            error: {
                message: error.message || error.toString(),
                name: error.name || 'Error',
                stack: error.stack || null,
                code: error.code || error.errorCode || null,
                type: error.type || null,
                statusCode: error.statusCode || null
            },
            
            // Request context
            request: request ? {
                method: request.method,
                url: request.originalUrl || request.url,
                path: request.path,
                query: this.sanitizeData(request.query || {}),
                params: this.sanitizeData(request.params || {}),
                headers: this.sanitizeHeaders(request.headers || {}),
                userAgent: request.headers?.['user-agent'],
                ip: request.ip || request.connection?.remoteAddress,
                sessionId: request.sessionID || request.sessionId,
                correlationId: request.headers?.['x-correlation-id']
            } : null,
            
            // User context
            user: request?.user ? {
                id: request.user.id,
                email: request.user.email,
                roles: request.user.roles,
                tenant: request.user.tenant
            } : context.user || null,
            
            // Additional context
            context: {
                ...context,
                environment: process.env.NODE_ENV || 'development',
                server: {
                    hostname: require('os').hostname(),
                    pid: process.pid,
                    memory: process.memoryUsage(),
                    uptime: process.uptime()
                }
            },
            
            // Metadata
            metadata: {
                version: '2.0',
                service: 'taktmate-backend',
                component: context.component || 'unknown'
            }
        };
        
        // Add performance information if available
        if (request?.startTime) {
            logEntry.performance = {
                duration: Date.now() - request.startTime,
                startTime: request.startTime
            };
        }
        
        return logEntry;
    }
    
    /**
     * Create HTTP-specific log entry
     */
    async createHTTPLogEntry(request, response, duration, error = null) {
        const timestamp = new Date().toISOString();
        
        return {
            timestamp: timestamp,
            level: error ? 'error' : (duration > this.config.slowRequestThreshold ? 'warn' : 'http'),
            type: 'http_request',
            
            request: {
                method: request.method,
                url: request.originalUrl || request.url,
                path: request.path,
                query: this.sanitizeData(request.query || {}),
                headers: this.sanitizeHeaders(request.headers || {}),
                userAgent: request.headers?.['user-agent'],
                ip: request.ip || request.connection?.remoteAddress,
                sessionId: request.sessionID || request.sessionId,
                correlationId: request.headers?.['x-correlation-id'],
                contentLength: request.headers?.['content-length']
            },
            
            response: {
                statusCode: response.statusCode,
                statusMessage: response.statusMessage,
                headers: this.sanitizeHeaders(response.getHeaders ? response.getHeaders() : {}),
                contentLength: response.get ? response.get('content-length') : null
            },
            
            performance: {
                duration: duration,
                slow: duration > this.config.slowRequestThreshold
            },
            
            user: request.user ? {
                id: request.user.id,
                email: request.user.email
            } : null,
            
            error: error ? {
                message: error.message,
                stack: error.stack,
                code: error.code
            } : null,
            
            metadata: {
                version: '2.0',
                service: 'taktmate-backend',
                component: 'http'
            }
        };
    }
    
    /**
     * Categorize error based on patterns and context
     */
    categorizeError(error, logEntry) {
        const errorText = (error.message || error.toString()).toLowerCase();
        const contextText = JSON.stringify(logEntry.context || {}).toLowerCase();
        const requestPath = logEntry.request?.path?.toLowerCase() || '';
        
        const searchText = `${errorText} ${contextText} ${requestPath}`;
        
        for (const [category, config] of Object.entries(this.errorCategories)) {
            for (const pattern of config.patterns) {
                if (searchText.includes(pattern)) {
                    return category;
                }
            }
        }
        
        return 'UNKNOWN';
    }
    
    /**
     * Determine error severity
     */
    determineSeverity(error, logEntry) {
        // Check if error has explicit severity
        if (error.severity) {
            return error.severity;
        }
        
        // Determine by status code
        if (error.statusCode) {
            if (error.statusCode >= 500) return 'high';
            if (error.statusCode >= 400) return 'medium';
            return 'low';
        }
        
        // Determine by category
        const category = logEntry.category;
        if (category && this.errorCategories[category]) {
            return this.errorCategories[category].severity;
        }
        
        // Determine by error type
        if (error.name === 'SecurityError' || error.name === 'AuthenticationError') {
            return 'high';
        }
        
        if (error.name === 'ValidationError') {
            return 'medium';
        }
        
        return 'medium';
    }
    
    /**
     * Update error statistics
     */
    updateErrorStatistics(logEntry) {
        this.errorStats.totalErrors++;
        
        // By category
        const category = logEntry.category || 'UNKNOWN';
        this.errorStats.errorsByCategory[category] = (this.errorStats.errorsByCategory[category] || 0) + 1;
        
        // By level
        const level = logEntry.level;
        this.errorStats.errorsByLevel[level] = (this.errorStats.errorsByLevel[level] || 0) + 1;
        
        // By endpoint
        if (logEntry.request?.path) {
            const endpoint = logEntry.request.path;
            this.errorStats.errorsByEndpoint[endpoint] = (this.errorStats.errorsByEndpoint[endpoint] || 0) + 1;
        }
        
        // By user
        if (logEntry.user?.id) {
            const userId = logEntry.user.id;
            this.errorStats.errorsByUser[userId] = (this.errorStats.errorsByUser[userId] || 0) + 1;
        }
    }
    
    /**
     * Add error to aggregation window
     */
    addToAggregation(logEntry) {
        const now = Date.now();
        const windowStart = now - this.config.errorAggregationWindow;
        
        // Create aggregation key
        const key = `${logEntry.category}_${logEntry.error.message}`;
        
        if (!this.errorAggregation.has(key)) {
            this.errorAggregation.set(key, {
                count: 0,
                firstSeen: now,
                lastSeen: now,
                category: logEntry.category,
                message: logEntry.error.message,
                severity: logEntry.severity,
                occurrences: []
            });
        }
        
        const aggregation = this.errorAggregation.get(key);
        aggregation.count++;
        aggregation.lastSeen = now;
        aggregation.occurrences.push({
            timestamp: now,
            requestId: logEntry.requestId,
            user: logEntry.user?.id,
            endpoint: logEntry.request?.path
        });
        
        // Keep only recent occurrences
        aggregation.occurrences = aggregation.occurrences.filter(
            occ => occ.timestamp > windowStart
        );
    }
    
    /**
     * Write log entry to configured outputs
     */
    async writeToLogs(logEntry) {
        // Console logging
        if (this.config.enableConsoleLogging && this.shouldLog(logEntry.level)) {
            this.writeToConsole(logEntry);
        }
        
        // File logging
        if (this.config.enableFileLogging && this.shouldLog(logEntry.level)) {
            await this.writeToFile(logEntry);
        }
        
        // Remote logging (if configured)
        if (this.config.enableRemoteLogging) {
            await this.writeToRemote(logEntry);
        }
    }
    
    /**
     * Write to console with formatting
     */
    writeToConsole(logEntry) {
        const timestamp = new Date(logEntry.timestamp).toLocaleString();
        const level = logEntry.level.toUpperCase().padEnd(5);
        const category = logEntry.category ? `[${logEntry.category}]` : '';
        
        let icon = '📋';
        let color = '\x1b[37m'; // White
        
        switch (logEntry.level) {
            case 'error':
                icon = '❌';
                color = '\x1b[31m'; // Red
                break;
            case 'warn':
                icon = '⚠️';
                color = '\x1b[33m'; // Yellow
                break;
            case 'info':
                icon = 'ℹ️';
                color = '\x1b[36m'; // Cyan
                break;
            case 'http':
                icon = '🌐';
                color = '\x1b[32m'; // Green
                break;
            case 'debug':
                icon = '🔍';
                color = '\x1b[35m'; // Magenta
                break;
        }
        
        const message = logEntry.error?.message || logEntry.message || 'Log entry';
        const requestId = logEntry.requestId ? ` [${logEntry.requestId}]` : '';
        
        console.log(`${color}${icon} ${timestamp} ${level} ${category}${requestId} ${message}\x1b[0m`);
        
        // Show additional context for errors
        if (logEntry.level === 'error' && logEntry.error?.stack) {
            console.log(`   Stack: ${logEntry.error.stack.split('\n')[1]?.trim()}`);
        }
        
        if (logEntry.request?.method && logEntry.request?.path) {
            console.log(`   Request: ${logEntry.request.method} ${logEntry.request.path}`);
        }
        
        if (logEntry.user?.id) {
            console.log(`   User: ${logEntry.user.id} (${logEntry.user.email || 'unknown'})`);
        }
        
        if (logEntry.performance?.duration) {
            console.log(`   Duration: ${logEntry.performance.duration}ms`);
        }
    }
    
    /**
     * Write to log file
     */
    async writeToFile(logEntry) {
        try {
            if (!this.logFileHandle) {
                await this.initializeLogFile();
            }
            
            const logLine = JSON.stringify(logEntry) + '\n';
            await this.logFileHandle.write(logLine);
            
            // Check if log rotation is needed
            const stats = await this.logFileHandle.stat();
            if (stats.size > this.config.maxLogFileSize) {
                await this.rotateLogFile();
            }
            
        } catch (error) {
            console.error('❌ Failed to write to log file:', error.message);
        }
    }
    
    /**
     * Send to Application Insights
     */
    sendToApplicationInsights(logEntry) {
        try {
            if (!this.appInsights?.telemetry) {
                return;
            }
            
            const properties = {
                level: logEntry.level,
                category: logEntry.category,
                severity: logEntry.severity,
                requestId: logEntry.requestId,
                component: logEntry.metadata?.component,
                endpoint: logEntry.request?.path,
                method: logEntry.request?.method,
                userAgent: logEntry.request?.userAgent,
                correlationId: logEntry.request?.correlationId,
                userId: logEntry.user?.id,
                userEmail: logEntry.user?.email
            };
            
            const metrics = {
                statusCode: logEntry.error?.statusCode || logEntry.response?.statusCode || 0,
                duration: logEntry.performance?.duration || 0,
                timestamp: Date.now()
            };
            
            if (logEntry.level === 'error') {
                // Create error object for Application Insights
                const error = new Error(logEntry.error.message);
                error.name = logEntry.error.name;
                error.stack = logEntry.error.stack;
                
                this.appInsights.telemetry.trackError(error, logEntry.user?.id, properties, metrics);
            } else if (logEntry.level === 'warn') {
                this.appInsights.telemetry.trackTrace(logEntry.error?.message || logEntry.message, 2, properties); // Warning level
            } else if (logEntry.type === 'http_request') {
                this.appInsights.telemetry.trackRequest(
                    `${logEntry.request.method} ${logEntry.request.path}`,
                    logEntry.request.url,
                    logEntry.performance.duration,
                    logEntry.response.statusCode.toString(),
                    logEntry.response.statusCode < 400,
                    properties
                );
            } else {
                this.appInsights.telemetry.trackTrace(logEntry.error?.message || logEntry.message, 1, properties); // Info level
            }
            
        } catch (error) {
            console.error('❌ Failed to send to Application Insights:', error.message);
        }
    }
    
    /**
     * Send performance data to Application Insights
     */
    sendPerformanceData(logEntry) {
        try {
            if (!this.appInsights?.telemetry || !logEntry.performance) {
                return;
            }
            
            this.appInsights.telemetry.trackMetric('HTTP_Request_Duration', logEntry.performance.duration, {
                endpoint: logEntry.request.path,
                method: logEntry.request.method,
                statusCode: logEntry.response.statusCode.toString(),
                slow: logEntry.performance.slow.toString()
            });
            
            if (logEntry.performance.slow) {
                this.appInsights.telemetry.trackEvent('Slow_Request', {
                    endpoint: logEntry.request.path,
                    method: logEntry.request.method,
                    duration: logEntry.performance.duration.toString(),
                    threshold: this.config.slowRequestThreshold.toString()
                });
            }
            
        } catch (error) {
            console.error('❌ Failed to send performance data:', error.message);
        }
    }
    
    /**
     * Check if alerting conditions are met
     */
    async checkAlertConditions(logEntry) {
        try {
            const now = Date.now();
            const windowStart = now - this.config.alertWindow;
            
            // Count errors in alert window by level
            const recentErrors = this.errorStats.recentErrors.filter(
                error => error.timestamp > windowStart
            );
            
            const errorCounts = {
                critical: recentErrors.filter(e => e.severity === 'critical').length,
                error: recentErrors.filter(e => e.level === 'error').length,
                warning: recentErrors.filter(e => e.level === 'warn').length
            };
            
            // Check thresholds
            let alertLevel = null;
            let alertMessage = null;
            
            if (errorCounts.critical >= this.config.alertThresholds.critical) {
                alertLevel = 'critical';
                alertMessage = `${errorCounts.critical} critical errors in ${this.config.alertWindow / 60000} minutes`;
            } else if (errorCounts.error >= this.config.alertThresholds.error) {
                alertLevel = 'error';
                alertMessage = `${errorCounts.error} errors in ${this.config.alertWindow / 60000} minutes`;
            } else if (errorCounts.warning >= this.config.alertThresholds.warning) {
                alertLevel = 'warning';
                alertMessage = `${errorCounts.warning} warnings in ${this.config.alertWindow / 60000} minutes`;
            }
            
            // Send alert if threshold exceeded and not in cooldown
            if (alertLevel && !this.isInAlertCooldown(alertLevel)) {
                await this.sendAlert(alertLevel, alertMessage, {
                    errorCounts: errorCounts,
                    recentErrors: recentErrors.slice(0, 10), // Include last 10 errors
                    category: logEntry.category,
                    endpoint: logEntry.request?.path
                });
                
                // Set cooldown
                this.setAlertCooldown(alertLevel, 30 * 60 * 1000); // 30 minutes cooldown
            }
            
        } catch (error) {
            console.error('❌ Alert checking failed:', error.message);
        }
    }
    
    /**
     * Send alert notification
     */
    async sendAlert(level, message, context) {
        try {
            const alert = {
                id: this.generateAlertId(),
                timestamp: new Date().toISOString(),
                level: level,
                message: message,
                context: context,
                service: 'taktmate-backend',
                environment: process.env.NODE_ENV || 'development'
            };
            
            // Track alert
            this.alertHistory.push(alert);
            this.errorStats.alertsSent++;
            this.errorStats.lastAlert = alert.timestamp;
            
            // Log alert
            console.error(`🚨 ALERT [${level.toUpperCase()}]: ${message}`);
            
            // Send to Application Insights
            if (this.appInsights) {
                this.appInsights.telemetry.trackEvent('Error_Alert', {
                    alertId: alert.id,
                    alertLevel: level,
                    alertMessage: message,
                    errorCounts: JSON.stringify(context.errorCounts),
                    category: context.category,
                    endpoint: context.endpoint
                });
            }
            
            // Send to external alerting systems (webhook, email, etc.)
            await this.sendExternalAlert(alert);
            
        } catch (error) {
            console.error('❌ Alert sending failed:', error.message);
        }
    }
    
    /**
     * Track recent error for monitoring
     */
    trackRecentError(logEntry) {
        const recentError = {
            timestamp: Date.now(),
            level: logEntry.level,
            category: logEntry.category,
            severity: logEntry.severity,
            message: logEntry.error?.message,
            endpoint: logEntry.request?.path,
            user: logEntry.user?.id
        };
        
        this.errorStats.recentErrors.push(recentError);
        
        // Keep only recent errors (last 1000 or last hour)
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        this.errorStats.recentErrors = this.errorStats.recentErrors
            .filter(error => error.timestamp > oneHourAgo)
            .slice(-1000);
    }
    
    /**
     * Sanitize sensitive data from logs
     */
    sanitizeData(data) {
        if (!this.config.enableDataSanitization) {
            return data;
        }
        
        const sanitized = { ...data };
        
        for (const field of this.config.sanitizeFields) {
            if (sanitized[field]) {
                sanitized[field] = '[REDACTED]';
            }
        }
        
        // Detect and sanitize potential PII
        if (this.config.enablePIIDetection) {
            for (const [key, value] of Object.entries(sanitized)) {
                if (typeof value === 'string') {
                    // Email pattern
                    if (value.includes('@') && value.includes('.')) {
                        sanitized[key] = '[EMAIL_REDACTED]';
                    }
                    // Credit card pattern (basic)
                    if (/^\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}$/.test(value)) {
                        sanitized[key] = '[CARD_REDACTED]';
                    }
                    // Phone number pattern (basic)
                    if (/^\+?[\d\s\-\(\)]{10,}$/.test(value)) {
                        sanitized[key] = '[PHONE_REDACTED]';
                    }
                }
            }
        }
        
        return sanitized;
    }
    
    /**
     * Sanitize HTTP headers
     */
    sanitizeHeaders(headers) {
        const sanitized = { ...headers };
        
        // Always sanitize these headers
        const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
        
        for (const header of sensitiveHeaders) {
            if (sanitized[header]) {
                sanitized[header] = '[REDACTED]';
            }
        }
        
        return sanitized;
    }
    
    /**
     * Check if should log at given level
     */
    shouldLog(level) {
        const currentLevel = this.logLevels[this.config.logLevel] || this.logLevels.info;
        const messageLevel = this.logLevels[level] || this.logLevels.info;
        
        return messageLevel <= currentLevel;
    }
    
    /**
     * Generate unique request ID
     */
    generateRequestId() {
        return `log_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }
    
    /**
     * Generate unique alert ID
     */
    generateAlertId() {
        return `alert_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }
    
    /**
     * Check if alert type is in cooldown
     */
    isInAlertCooldown(alertLevel) {
        const cooldownEnd = this.alertCooldown.get(alertLevel);
        return cooldownEnd && Date.now() < cooldownEnd;
    }
    
    /**
     * Set alert cooldown
     */
    setAlertCooldown(alertLevel, duration) {
        this.alertCooldown.set(alertLevel, Date.now() + duration);
    }
    
    /**
     * Ensure log directory exists
     */
    async ensureLogDirectory() {
        try {
            await fs.access(this.config.logDirectory);
        } catch (error) {
            await fs.mkdir(this.config.logDirectory, { recursive: true });
        }
    }
    
    /**
     * Initialize log file
     */
    async initializeLogFile() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `taktmate-${timestamp}.log`;
        this.currentLogFile = path.join(this.config.logDirectory, filename);
        
        this.logFileHandle = await fs.open(this.currentLogFile, 'a');
    }
    
    /**
     * Rotate log file
     */
    async rotateLogFile() {
        try {
            if (this.logFileHandle) {
                await this.logFileHandle.close();
            }
            
            // Initialize new log file
            await this.initializeLogFile();
            
            // Clean up old log files
            await this.cleanupOldLogFiles();
            
            console.log(`📋 Log file rotated: ${this.currentLogFile}`);
            
        } catch (error) {
            console.error('❌ Log rotation failed:', error.message);
        }
    }
    
    /**
     * Clean up old log files
     */
    async cleanupOldLogFiles() {
        try {
            const files = await fs.readdir(this.config.logDirectory);
            const logFiles = files
                .filter(file => file.startsWith('taktmate-') && file.endsWith('.log'))
                .map(file => ({
                    name: file,
                    path: path.join(this.config.logDirectory, file),
                    mtime: 0
                }));
            
            // Get file stats
            for (const file of logFiles) {
                try {
                    const stats = await fs.stat(file.path);
                    file.mtime = stats.mtime.getTime();
                } catch (error) {
                    // File might have been deleted, skip
                }
            }
            
            // Sort by modification time (oldest first)
            logFiles.sort((a, b) => a.mtime - b.mtime);
            
            // Remove excess files
            const filesToDelete = logFiles.slice(0, Math.max(0, logFiles.length - this.config.maxLogFiles));
            
            for (const file of filesToDelete) {
                try {
                    await fs.unlink(file.path);
                    console.log(`🗑️ Deleted old log file: ${file.name}`);
                } catch (error) {
                    console.error(`❌ Failed to delete log file ${file.name}:`, error.message);
                }
            }
            
        } catch (error) {
            console.error('❌ Log cleanup failed:', error.message);
        }
    }
    
    /**
     * Start log rotation timer
     */
    startLogRotation() {
        setInterval(async () => {
            try {
                if (this.logFileHandle) {
                    const stats = await this.logFileHandle.stat();
                    if (stats.size > this.config.maxLogFileSize) {
                        await this.rotateLogFile();
                    }
                }
            } catch (error) {
                console.error('❌ Log rotation check failed:', error.message);
            }
        }, this.config.logRotationInterval);
    }
    
    /**
     * Start error aggregation cleanup
     */
    startErrorAggregationCleanup() {
        setInterval(() => {
            try {
                const now = Date.now();
                const cutoff = now - this.config.errorAggregationWindow;
                
                for (const [key, aggregation] of this.errorAggregation.entries()) {
                    if (aggregation.lastSeen < cutoff) {
                        this.errorAggregation.delete(key);
                    }
                }
            } catch (error) {
                console.error('❌ Error aggregation cleanup failed:', error.message);
            }
        }, 5 * 60 * 1000); // Cleanup every 5 minutes
    }
    
    /**
     * Start alert processing
     */
    startAlertProcessing() {
        setInterval(() => {
            try {
                // Clean up old alert cooldowns
                const now = Date.now();
                for (const [alertLevel, cooldownEnd] of this.alertCooldown.entries()) {
                    if (now >= cooldownEnd) {
                        this.alertCooldown.delete(alertLevel);
                    }
                }
                
                // Clean up old alert history
                const cutoff = now - (24 * 60 * 60 * 1000); // 24 hours
                this.alertHistory = this.alertHistory.filter(alert => 
                    new Date(alert.timestamp).getTime() > cutoff
                );
                
            } catch (error) {
                console.error('❌ Alert processing failed:', error.message);
            }
        }, 10 * 60 * 1000); // Process every 10 minutes
    }
    
    /**
     * Send alert to external systems
     */
    async sendExternalAlert(alert) {
        // Placeholder for external alerting integrations
        // This could integrate with:
        // - Webhook endpoints
        // - Email services
        // - Slack/Teams notifications
        // - PagerDuty/OpsGenie
        // - SMS services
        
        console.log(`🚨 External alert would be sent: ${alert.level} - ${alert.message}`);
    }
    
    /**
     * Get error statistics and health information
     */
    getErrorStatistics() {
        return {
            ...this.errorStats,
            configuration: {
                logLevel: this.config.logLevel,
                enableFileLogging: this.config.enableFileLogging,
                enableConsoleLogging: this.config.enableConsoleLogging,
                enableAlerting: this.config.enableAlerting,
                alertThresholds: this.config.alertThresholds,
                errorAggregationWindow: this.config.errorAggregationWindow / 1000 / 60 + ' minutes',
                alertWindow: this.config.alertWindow / 1000 / 60 + ' minutes'
            },
            aggregation: {
                activeAggregations: this.errorAggregation.size,
                topErrors: Array.from(this.errorAggregation.values())
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 10)
                    .map(agg => ({
                        category: agg.category,
                        message: agg.message,
                        count: agg.count,
                        severity: agg.severity,
                        firstSeen: new Date(agg.firstSeen).toISOString(),
                        lastSeen: new Date(agg.lastSeen).toISOString()
                    }))
            },
            alerts: {
                totalAlerts: this.alertHistory.length,
                recentAlerts: this.alertHistory.slice(-5),
                activeCooldowns: Array.from(this.alertCooldown.entries()).map(([level, end]) => ({
                    level: level,
                    expiresAt: new Date(end).toISOString()
                }))
            }
        };
    }
    
    /**
     * Create Express middleware for request/response logging
     */
    createHTTPLoggingMiddleware() {
        return (req, res, next) => {
            const startTime = Date.now();
            req.startTime = startTime;
            
            // Capture original end method
            const originalEnd = res.end;
            
            // Override end method to log response
            res.end = async function(chunk, encoding) {
                const duration = Date.now() - startTime;
                
                // Log HTTP request/response
                try {
                    await this.logHTTP(req, res, duration);
                } catch (error) {
                    console.error('❌ HTTP logging failed:', error.message);
                }
                
                // Call original end method
                originalEnd.call(this, chunk, encoding);
            }.bind(this);
            
            next();
        };
    }
}

module.exports = {
    ErrorLoggingService
};
