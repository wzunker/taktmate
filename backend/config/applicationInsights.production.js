/**
 * TaktMate Production Application Insights Configuration
 * Optimized for production monitoring with enhanced security, performance, and business metrics
 */

const appInsights = require('applicationinsights');

// Production-specific configuration
const productionConfig = {
    // Connection and Authentication
    connectionString: process.env.APPINSIGHTS_CONNECTION_STRING || process.env.APPLICATIONINSIGHTS_CONNECTION_STRING,
    
    // Cloud Role Configuration for Production
    cloudRole: 'taktmate-api-production',
    cloudRoleInstance: process.env.WEBSITE_INSTANCE_ID || `${require('os').hostname()}-prod`,
    
    // Sampling Configuration (optimized for production)
    samplingPercentage: 100, // Full sampling for production monitoring
    
    // Auto-Collection Settings (production-optimized)
    enableAutoCollectRequests: true,
    enableAutoCollectPerformance: true,
    enableAutoCollectExceptions: true,
    enableAutoCollectDependencies: true,
    enableAutoCollectConsole: false, // Disabled in production for performance
    enableAutoCollectHeartbeat: true,
    
    // Live Metrics (enabled for production monitoring)
    enableLiveMetrics: true,
    enableWebInstrumentation: false, // Disabled for security
    
    // Disk Caching (enabled for reliability)
    enableDiskCaching: true,
    diskCacheSize: 50, // MB
    
    // Production-specific features
    enableInternalDebugging: false,
    enableInternalWarning: false,
    enableCorrelationHeaders: true,
    enableRequestResponseHeaders: false, // Disabled for security
    
    // Performance optimizations
    maxBatchSize: 250,
    maxBatchIntervalMs: 15000,
    disableAllExtendedMetrics: false,
    
    // Security settings
    enableSendLiveMetrics: true,
    proxyHttpUrl: undefined,
    proxyHttpsUrl: undefined,
    httpAgent: undefined,
    httpsAgent: undefined
};

// Production-specific telemetry processors
const setupProductionTelemetryProcessors = (appInsights) => {
    // Security filter - remove sensitive data
    appInsights.defaultClient.addTelemetryProcessor((envelope) => {
        if (envelope.data.baseData) {
            // Remove sensitive headers
            if (envelope.data.baseData.properties) {
                delete envelope.data.baseData.properties['authorization'];
                delete envelope.data.baseData.properties['cookie'];
                delete envelope.data.baseData.properties['x-api-key'];
                delete envelope.data.baseData.properties['x-auth-token'];
            }
            
            // Remove sensitive URL parameters
            if (envelope.data.baseData.url) {
                envelope.data.baseData.url = envelope.data.baseData.url.replace(/([?&])(api_key|token|password|secret)=[^&]*/gi, '$1$2=***');
            }
            
            // Remove sensitive custom properties
            if (envelope.data.baseData.customDimensions) {
                delete envelope.data.baseData.customDimensions['password'];
                delete envelope.data.baseData.customDimensions['secret'];
                delete envelope.data.baseData.customDimensions['token'];
                delete envelope.data.baseData.customDimensions['apiKey'];
            }
        }
        return true;
    });
    
    // Performance optimization processor
    appInsights.defaultClient.addTelemetryProcessor((envelope) => {
        // Skip health check requests for noise reduction
        if (envelope.data.baseData && envelope.data.baseData.name === 'GET /api/health') {
            return false;
        }
        
        // Skip static file requests
        if (envelope.data.baseData && envelope.data.baseData.url) {
            const url = envelope.data.baseData.url.toLowerCase();
            if (url.includes('.css') || url.includes('.js') || url.includes('.png') || 
                url.includes('.jpg') || url.includes('.ico') || url.includes('.svg')) {
                return false;
            }
        }
        
        return true;
    });
    
    // Business metrics enrichment processor
    appInsights.defaultClient.addTelemetryProcessor((envelope) => {
        if (envelope.data.baseData) {
            // Add production environment context
            if (!envelope.data.baseData.properties) {
                envelope.data.baseData.properties = {};
            }
            
            envelope.data.baseData.properties['environment'] = 'production';
            envelope.data.baseData.properties['version'] = process.env.APP_VERSION || '1.0.0';
            envelope.data.baseData.properties['buildNumber'] = process.env.BUILD_NUMBER || 'unknown';
            envelope.data.baseData.properties['region'] = process.env.AZURE_REGION || 'eastus';
        }
        return true;
    });
};

// Production-specific custom telemetry functions
const createProductionTelemetry = (client) => {
    return {
        // Production-optimized error tracking
        trackProductionError: (error, context = {}) => {
            const errorContext = {
                timestamp: new Date().toISOString(),
                environment: 'production',
                severity: determineSeverity(error),
                category: categorizeError(error),
                impact: assessErrorImpact(error),
                ...context
            };
            
            client.trackException({
                exception: error,
                properties: errorContext,
                measurements: {
                    errorCount: 1,
                    impactScore: calculateImpactScore(error)
                },
                severity: mapSeverityToAppInsights(errorContext.severity)
            });
        },
        
        // Business-critical event tracking
        trackBusinessEvent: (eventName, properties = {}, measurements = {}) => {
            const businessContext = {
                timestamp: new Date().toISOString(),
                environment: 'production',
                businessCritical: true,
                ...properties
            };
            
            client.trackEvent({
                name: eventName,
                properties: businessContext,
                measurements: {
                    businessValue: calculateBusinessValue(eventName),
                    ...measurements
                }
            });
        },
        
        // Production performance tracking
        trackProductionPerformance: (operationName, duration, success, context = {}) => {
            const performanceContext = {
                timestamp: new Date().toISOString(),
                environment: 'production',
                operationName,
                success,
                performanceCategory: categorizePerformance(duration),
                ...context
            };
            
            client.trackDependency({
                target: 'internal-operation',
                name: operationName,
                data: operationName,
                duration: duration,
                resultCode: success ? 200 : 500,
                success: success,
                dependencyTypeName: 'InternalOperation',
                properties: performanceContext,
                measurements: {
                    duration: duration,
                    performanceScore: calculatePerformanceScore(duration)
                }
            });
        },
        
        // Production security event tracking
        trackSecurityEvent: (eventType, severity, details = {}) => {
            const securityContext = {
                timestamp: new Date().toISOString(),
                environment: 'production',
                eventType,
                severity,
                securityCategory: 'authentication',
                riskLevel: assessSecurityRisk(eventType, severity),
                ...details
            };
            
            client.trackEvent({
                name: `SECURITY_${eventType.toUpperCase()}`,
                properties: securityContext,
                measurements: {
                    riskScore: calculateRiskScore(eventType, severity),
                    securityEventCount: 1
                }
            });
        },
        
        // Production availability tracking
        trackAvailabilityResult: (testName, success, duration, location = 'production') => {
            client.trackAvailability({
                name: testName,
                success: success,
                duration: duration,
                runLocation: location,
                properties: {
                    timestamp: new Date().toISOString(),
                    environment: 'production',
                    testType: 'internal',
                    availabilityCategory: success ? 'healthy' : 'degraded'
                },
                measurements: {
                    availabilityScore: success ? 100 : 0,
                    responseTime: duration
                }
            });
        },
        
        // Production user journey tracking
        trackUserJourney: (journeyName, step, success, duration, userId = null) => {
            const journeyContext = {
                timestamp: new Date().toISOString(),
                environment: 'production',
                journeyName,
                step,
                success,
                userId: userId ? hashUserId(userId) : 'anonymous', // Hash for privacy
                journeyStage: categorizeJourneyStep(step)
            };
            
            client.trackEvent({
                name: `USER_JOURNEY_${journeyName.toUpperCase()}`,
                properties: journeyContext,
                measurements: {
                    stepDuration: duration,
                    journeyProgress: calculateJourneyProgress(journeyName, step),
                    conversionScore: calculateConversionScore(journeyName, step, success)
                }
            });
        }
    };
};

// Helper functions for production telemetry
const determineSeverity = (error) => {
    if (error.name === 'ValidationError') return 'warning';
    if (error.name === 'AuthenticationError') return 'error';
    if (error.name === 'AuthorizationError') return 'error';
    if (error.status >= 500) return 'critical';
    if (error.status >= 400) return 'warning';
    return 'info';
};

const categorizeError = (error) => {
    if (error.name?.includes('Auth')) return 'authentication';
    if (error.name?.includes('Validation')) return 'validation';
    if (error.name?.includes('Network')) return 'network';
    if (error.name?.includes('Database')) return 'database';
    if (error.name?.includes('External')) return 'external_service';
    return 'application';
};

const assessErrorImpact = (error) => {
    if (error.status >= 500) return 'high';
    if (error.status >= 400) return 'medium';
    return 'low';
};

const calculateImpactScore = (error) => {
    const severityScore = { critical: 100, error: 75, warning: 50, info: 25 };
    const impactScore = { high: 100, medium: 50, low: 25 };
    return (severityScore[determineSeverity(error)] || 25) + (impactScore[assessErrorImpact(error)] || 25);
};

const mapSeverityToAppInsights = (severity) => {
    const mapping = {
        critical: 4, // Critical
        error: 3,    // Error
        warning: 2,  // Warning
        info: 1      // Information
    };
    return mapping[severity] || 1;
};

const calculateBusinessValue = (eventName) => {
    const businessValues = {
        'CSV_FILE_UPLOADED': 100,
        'CHAT_INTERACTION': 75,
        'CSV_ANALYSIS_COMPLETED': 90,
        'USER_REGISTRATION': 150,
        'USER_LOGIN': 50,
        'EXPORT_GENERATED': 80
    };
    return businessValues[eventName] || 25;
};

const categorizePerformance = (duration) => {
    if (duration < 500) return 'excellent';
    if (duration < 1000) return 'good';
    if (duration < 2000) return 'acceptable';
    if (duration < 5000) return 'slow';
    return 'critical';
};

const calculatePerformanceScore = (duration) => {
    if (duration < 500) return 100;
    if (duration < 1000) return 80;
    if (duration < 2000) return 60;
    if (duration < 5000) return 40;
    return 20;
};

const assessSecurityRisk = (eventType, severity) => {
    const riskMatrix = {
        'FAILED_LOGIN': { critical: 'high', error: 'medium', warning: 'low' },
        'UNAUTHORIZED_ACCESS': { critical: 'critical', error: 'high', warning: 'medium' },
        'SUSPICIOUS_ACTIVITY': { critical: 'high', error: 'medium', warning: 'low' },
        'TOKEN_VALIDATION_FAILED': { critical: 'medium', error: 'medium', warning: 'low' }
    };
    return riskMatrix[eventType]?.[severity] || 'low';
};

const calculateRiskScore = (eventType, severity) => {
    const eventScores = {
        'FAILED_LOGIN': 25,
        'UNAUTHORIZED_ACCESS': 75,
        'SUSPICIOUS_ACTIVITY': 50,
        'TOKEN_VALIDATION_FAILED': 40
    };
    const severityMultiplier = { critical: 4, error: 3, warning: 2, info: 1 };
    return (eventScores[eventType] || 25) * (severityMultiplier[severity] || 1);
};

const hashUserId = (userId) => {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(userId.toString()).digest('hex').substring(0, 16);
};

const categorizeJourneyStep = (step) => {
    if (step.includes('login') || step.includes('register')) return 'authentication';
    if (step.includes('upload') || step.includes('file')) return 'data_input';
    if (step.includes('chat') || step.includes('analysis')) return 'interaction';
    if (step.includes('export') || step.includes('download')) return 'output';
    return 'navigation';
};

const calculateJourneyProgress = (journeyName, step) => {
    const journeySteps = {
        'CSV_ANALYSIS': ['upload', 'parse', 'analyze', 'interact', 'export'],
        'USER_ONBOARDING': ['register', 'verify', 'profile', 'first_upload', 'first_analysis']
    };
    const steps = journeySteps[journeyName] || [];
    const stepIndex = steps.indexOf(step);
    return stepIndex >= 0 ? ((stepIndex + 1) / steps.length) * 100 : 0;
};

const calculateConversionScore = (journeyName, step, success) => {
    if (!success) return 0;
    const conversionValues = {
        'CSV_ANALYSIS': { upload: 20, parse: 40, analyze: 60, interact: 80, export: 100 },
        'USER_ONBOARDING': { register: 30, verify: 50, profile: 70, first_upload: 90, first_analysis: 100 }
    };
    return conversionValues[journeyName]?.[step] || 0;
};

// Production initialization function
const initializeProductionAppInsights = () => {
    if (!productionConfig.connectionString) {
        console.error('❌ Application Insights connection string not configured for production');
        return null;
    }
    
    try {
        // Initialize Application Insights with production configuration
        appInsights.setup(productionConfig.connectionString)
            .setAutoCollectRequests(productionConfig.enableAutoCollectRequests)
            .setAutoCollectPerformance(productionConfig.enableAutoCollectPerformance, productionConfig.enableAutoCollectPerformance)
            .setAutoCollectExceptions(productionConfig.enableAutoCollectExceptions)
            .setAutoCollectDependencies(productionConfig.enableAutoCollectDependencies)
            .setAutoCollectConsole(productionConfig.enableAutoCollectConsole)
            .setAutoCollectHeartbeat(productionConfig.enableAutoCollectHeartbeat)
            .setUseDiskRetryCaching(productionConfig.enableDiskCaching)
            .setSendLiveMetrics(productionConfig.enableLiveMetrics)
            .setInternalLogging(productionConfig.enableInternalDebugging, productionConfig.enableInternalWarning)
            .enableWebInstrumentation(productionConfig.enableWebInstrumentation);
        
        // Set cloud role information
        appInsights.defaultClient.context.tags[appInsights.defaultClient.context.keys.cloudRole] = productionConfig.cloudRole;
        appInsights.defaultClient.context.tags[appInsights.defaultClient.context.keys.cloudRoleInstance] = productionConfig.cloudRoleInstance;
        
        // Configure sampling
        appInsights.Configuration.samplingPercentage = productionConfig.samplingPercentage;
        
        // Start Application Insights
        appInsights.start();
        
        // Setup production telemetry processors
        setupProductionTelemetryProcessors(appInsights);
        
        console.log('✅ Production Application Insights initialized successfully');
        console.log(`📊 Cloud Role: ${productionConfig.cloudRole}`);
        console.log(`🔍 Sampling: ${productionConfig.samplingPercentage}%`);
        console.log(`💾 Disk Caching: ${productionConfig.enableDiskCaching ? 'Enabled' : 'Disabled'}`);
        console.log(`📈 Live Metrics: ${productionConfig.enableLiveMetrics ? 'Enabled' : 'Disabled'}`);
        
        return {
            client: appInsights.defaultClient,
            telemetry: createProductionTelemetry(appInsights.defaultClient),
            config: productionConfig
        };
        
    } catch (error) {
        console.error('❌ Failed to initialize Production Application Insights:', error);
        return null;
    }
};

// Production health check function
const checkProductionMonitoringHealth = () => {
    const healthStatus = {
        timestamp: new Date().toISOString(),
        applicationInsights: {
            configured: !!productionConfig.connectionString,
            initialized: !!appInsights.defaultClient,
            cloudRole: productionConfig.cloudRole,
            samplingPercentage: productionConfig.samplingPercentage
        },
        features: {
            autoCollectRequests: productionConfig.enableAutoCollectRequests,
            autoCollectPerformance: productionConfig.enableAutoCollectPerformance,
            autoCollectExceptions: productionConfig.enableAutoCollectExceptions,
            autoCollectDependencies: productionConfig.enableAutoCollectDependencies,
            liveMetrics: productionConfig.enableLiveMetrics,
            diskCaching: productionConfig.enableDiskCaching
        },
        security: {
            webInstrumentation: productionConfig.enableWebInstrumentation,
            internalDebugging: productionConfig.enableInternalDebugging,
            requestResponseHeaders: productionConfig.enableRequestResponseHeaders
        }
    };
    
    return healthStatus;
};

module.exports = {
    initializeProductionAppInsights,
    checkProductionMonitoringHealth,
    productionConfig
};
