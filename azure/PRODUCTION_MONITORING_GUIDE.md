# Production Monitoring Guide for TaktMate

## Overview
This guide provides comprehensive instructions for setting up, configuring, and managing production-grade Application Insights monitoring for the TaktMate application. It covers advanced monitoring strategies, business intelligence dashboards, alerting systems, and operational best practices.

## 🎯 Production Monitoring Architecture

### Monitoring Stack Overview
```
┌─────────────────────────────────────────────────────────────┐
│                Production Monitoring Architecture           │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────┐ │
│  │ Application     │  │ Log Analytics    │  │ Azure       │ │
│  │ Insights        │  │ Workspace        │  │ Monitor     │ │
│  └─────────────────┘  └──────────────────┘  └─────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────┐ │
│  │ Custom          │  │ Business         │  │ Security    │ │
│  │ Dashboards      │  │ Metrics          │  │ Monitoring  │ │
│  └─────────────────┘  └──────────────────┘  └─────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────┐ │
│  │ Alert Rules     │  │ Action Groups    │  │ Availability│ │
│  │ & Notifications │  │ & Escalation     │  │ Tests       │ │
│  └─────────────────┘  └──────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Monitoring Layers
1. **Infrastructure Monitoring**: Azure resources, App Service metrics, resource utilization
2. **Application Performance**: Request/response times, throughput, error rates
3. **Business Intelligence**: User behavior, conversion rates, feature usage
4. **Security Monitoring**: Authentication events, suspicious activities, access patterns
5. **External Dependencies**: OpenAI API performance, third-party service health

## 🛠️ Setup and Configuration

### 1. Production Monitoring Setup Script
**File**: `azure/setup-production-monitoring.sh`

#### Key Features
- **Automated Application Insights setup** with production-optimized configuration
- **Log Analytics Workspace integration** for advanced querying
- **Production-specific dashboards** and workbooks
- **Comprehensive alert rules** with intelligent thresholds
- **Availability tests** for frontend and backend endpoints
- **Security and compliance** configurations

#### Usage Examples
```bash
# Complete production monitoring setup
./setup-production-monitoring.sh production --comprehensive

# Setup specific components
./setup-production-monitoring.sh production --alerts --dashboards --availability

# Staging environment setup
./setup-production-monitoring.sh staging --comprehensive

# Dry run to preview changes
./setup-production-monitoring.sh production --comprehensive --dry-run --verbose
```

### 2. Production Application Insights Configuration
**File**: `backend/config/applicationInsights.production.js`

#### Production-Optimized Features
- **Enhanced security**: Sensitive data filtering, secure telemetry processors
- **Performance optimization**: Intelligent sampling, noise reduction
- **Business intelligence**: Custom telemetry for business metrics
- **Security monitoring**: Authentication events, risk assessment
- **User journey tracking**: Conversion funnels, user behavior analysis

#### Key Configuration Settings
```javascript
const productionConfig = {
    // Security-optimized settings
    enableAutoCollectConsole: false,        // Disabled for performance
    enableWebInstrumentation: false,        // Disabled for security
    enableRequestResponseHeaders: false,    // Disabled for security
    
    // Performance-optimized settings
    samplingPercentage: 100,               // Full sampling for production
    maxBatchSize: 250,                     // Optimized batch size
    maxBatchIntervalMs: 15000,             // 15-second intervals
    
    // Production-specific features
    enableLiveMetrics: true,               // Real-time monitoring
    enableDiskCaching: true,               // Reliability enhancement
    cloudRole: 'taktmate-api-production'   // Role identification
};
```

### 3. Production Monitoring Testing
**File**: `azure/test-production-monitoring.sh`

#### Comprehensive Test Coverage
- **Infrastructure validation**: Application Insights, Log Analytics, App Service integration
- **Telemetry data ingestion**: Request data, exceptions, custom events, dependencies
- **Alert system testing**: Action groups, alert rules, notification channels
- **Dashboard functionality**: Query execution, data visualization, business metrics
- **Availability monitoring**: Endpoint health, response times, service availability
- **Performance validation**: Response times, error rates, throughput metrics

#### Usage Examples
```bash
# Comprehensive production monitoring test
./test-production-monitoring.sh production --comprehensive --report

# Specific test categories
./test-production-monitoring.sh production --telemetry --alerts --performance

# Continuous monitoring validation
./test-production-monitoring.sh production --availability --verbose
```

## 📊 Production Dashboards and Workbooks

### 1. Production Overview Dashboard
**Location**: `azure/dashboards/production-overview-dashboard.json`

#### Key Metrics Displayed
- **Request Performance**: Request count, average duration, success rates
- **Exception Trends**: Exception types, frequency, impact analysis
- **Business Activity**: CSV uploads, chat interactions, user engagement
- **External Dependencies**: OpenAI API performance, response times
- **System Health**: Resource utilization, availability metrics

### 2. Business Metrics Workbook
**Location**: `azure/workbooks/production-business-metrics-workbook.json`

#### Business Intelligence Features
- **User Journey Analysis**: Conversion funnels, step completion rates
- **Feature Usage Metrics**: CSV processing analytics, chat interaction patterns
- **Revenue Impact Tracking**: Business value scoring, cost analysis
- **Security Event Monitoring**: Authentication failures, suspicious activities
- **Operational KPIs**: Production health summary, performance benchmarks

#### Sample Business Queries
```kusto
// User Journey Conversion Funnel
customEvents
| where name startswith 'USER_JOURNEY_'
| extend JourneyName = extract(@'USER_JOURNEY_([^_]+)', 1, name)
| extend Step = tostring(customDimensions.step)
| extend Success = tobool(customDimensions.success)
| summarize 
    TotalSteps = count(),
    SuccessfulSteps = countif(Success),
    ConversionRate = (countif(Success) * 100.0) / count()
    by JourneyName, Step
| order by JourneyName, ConversionRate desc

// OpenAI API Cost Analysis
dependencies
| where target contains 'openai.com'
| extend TokensUsed = todouble(customMeasurements.tokensUsed)
| extend Cost = todouble(customMeasurements.estimatedCost)
| summarize 
    APIRequests = count(),
    TotalTokensUsed = sum(TokensUsed),
    EstimatedTotalCost = sum(Cost),
    CostPerRequest = sum(Cost) / count()
    by bin(timestamp, 1h)
| order by timestamp desc
```

## 🚨 Production Alert Configuration

### Alert Categories and Thresholds

#### Critical Alerts (Severity 1)
```yaml
High Error Rate:
  Threshold: >5% errors in 5 minutes
  Evaluation: Every 1 minute
  Action: Immediate notification + escalation

Low Availability:
  Threshold: <95% availability in 10 minutes
  Evaluation: Every 5 minutes
  Action: Immediate notification + on-call escalation

External Service Failure:
  Threshold: OpenAI API >50% failure rate in 5 minutes
  Evaluation: Every 1 minute
  Action: Immediate notification + service status update
```

#### Warning Alerts (Severity 2)
```yaml
Slow Response Time:
  Threshold: >2000ms average response time in 10 minutes
  Evaluation: Every 5 minutes
  Action: Team notification

High Memory Usage:
  Threshold: >80% memory utilization in 15 minutes
  Evaluation: Every 5 minutes
  Action: Team notification + scaling recommendation

Authentication Issues:
  Threshold: >10 authentication failures in 5 minutes
  Evaluation: Every 2 minutes
  Action: Security team notification
```

#### Information Alerts (Severity 3)
```yaml
High Traffic Volume:
  Threshold: >200% of baseline traffic in 15 minutes
  Evaluation: Every 10 minutes
  Action: Information notification

Business Metric Anomalies:
  Threshold: 50% deviation from baseline in 30 minutes
  Evaluation: Every 15 minutes
  Action: Business team notification
```

### Action Group Configuration
```json
{
  "name": "taktmate-alerts-prod",
  "shortName": "TaktMateAlert",
  "emailReceivers": [
    {
      "name": "Production Team",
      "emailAddress": "alerts@taktmate.com",
      "useCommonAlertSchema": true
    },
    {
      "name": "On-Call Engineer",
      "emailAddress": "oncall@taktmate.com",
      "useCommonAlertSchema": true
    }
  ],
  "smsReceivers": [
    {
      "name": "Emergency Contact",
      "countryCode": "1",
      "phoneNumber": "+1234567890"
    }
  ],
  "webhookReceivers": [
    {
      "name": "Slack Integration",
      "serviceUri": "https://hooks.slack.com/services/...",
      "useCommonAlertSchema": true
    }
  ]
}
```

## 📈 Custom Telemetry and Business Metrics

### Production Telemetry Categories

#### 1. Business Event Tracking
```javascript
// CSV File Upload Business Event
telemetry.trackBusinessEvent('CSV_FILE_UPLOADED', {
    fileSize: file.size,
    fileName: hashFileName(file.name),
    userId: hashUserId(user.id),
    processingTime: endTime - startTime,
    rowCount: parsedData.length,
    sizeCategory: categorizeSizeCategory(file.size)
}, {
    businessValue: 100,
    processingTimeMs: endTime - startTime,
    fileSizeBytes: file.size,
    rowCount: parsedData.length
});

// User Journey Tracking
telemetry.trackUserJourney('CSV_ANALYSIS', 'upload', true, duration, userId);
```

#### 2. Security Event Monitoring
```javascript
// Authentication Failure
telemetry.trackSecurityEvent('FAILED_LOGIN', 'warning', {
    reason: 'invalid_credentials',
    clientIP: req.ip,
    userAgent: req.get('User-Agent'),
    attemptCount: attemptCount
});

// Suspicious Activity Detection
telemetry.trackSecurityEvent('SUSPICIOUS_ACTIVITY', 'error', {
    activityType: 'multiple_failed_logins',
    clientIP: req.ip,
    timeWindow: '5_minutes',
    attemptCount: attemptCount
});
```

#### 3. Performance Monitoring
```javascript
// Operation Performance Tracking
telemetry.trackProductionPerformance('csv_parsing', duration, success, {
    operationType: 'data_processing',
    dataSize: fileSize,
    complexity: calculateComplexity(data)
});

// External Service Performance
telemetry.trackExternalServiceError('openai_api', error, {
    endpoint: 'chat/completions',
    requestSize: requestTokens,
    responseSize: responseTokens,
    model: 'gpt-4'
});
```

### Business Intelligence Metrics

#### Key Performance Indicators (KPIs)
```kusto
// Daily Active Users
customEvents
| where timestamp >= ago(1d)
| where name in ('USER_LOGIN', 'CSV_FILE_UPLOADED', 'CHAT_INTERACTION')
| summarize UniqueUsers = dcount(tostring(customDimensions.userId))

// Conversion Rate (Upload to Analysis)
let uploads = customEvents
| where name == 'CSV_FILE_UPLOADED'
| summarize UploadCount = count();
let analyses = customEvents
| where name == 'CSV_ANALYSIS_COMPLETED'
| summarize AnalysisCount = count();
uploads
| extend ConversionRate = (toscalar(analyses) * 100.0) / UploadCount

// Average Revenue Per User (ARPU) Estimation
customEvents
| where name in ('CSV_FILE_UPLOADED', 'CHAT_INTERACTION', 'EXPORT_GENERATED')
| extend BusinessValue = case(
    name == 'CSV_FILE_UPLOADED', 100,
    name == 'CHAT_INTERACTION', 75,
    name == 'EXPORT_GENERATED', 80,
    0
)
| summarize 
    TotalValue = sum(BusinessValue),
    UniqueUsers = dcount(tostring(customDimensions.userId))
| extend ARPU = TotalValue / UniqueUsers
```

## 🔍 Advanced Monitoring Queries

### Performance Analysis Queries

#### Request Performance Deep Dive
```kusto
requests
| where timestamp >= ago(1d)
| extend ResponseTimeCategory = case(
    duration < 500, 'Excellent (<500ms)',
    duration < 1000, 'Good (500ms-1s)',
    duration < 2000, 'Acceptable (1s-2s)',
    duration < 5000, 'Slow (2s-5s)',
    'Critical (>5s)'
)
| summarize 
    RequestCount = count(),
    AvgDuration = avg(duration),
    P50Duration = percentile(duration, 50),
    P95Duration = percentile(duration, 95),
    P99Duration = percentile(duration, 99),
    SuccessRate = (countif(success) * 100.0) / count()
    by ResponseTimeCategory, bin(timestamp, 1h)
| order by timestamp desc
```

#### Error Analysis and Impact Assessment
```kusto
exceptions
| where timestamp >= ago(24h)
| extend ErrorSeverity = case(
    severityLevel >= 3, 'Critical',
    severityLevel >= 2, 'Error',
    severityLevel >= 1, 'Warning',
    'Info'
)
| extend ErrorCategory = case(
    type contains 'Auth', 'Authentication',
    type contains 'Validation', 'Validation',
    type contains 'Network', 'Network',
    type contains 'External', 'External Service',
    'Application'
)
| summarize 
    ErrorCount = count(),
    UniqueErrors = dcount(type),
    AffectedOperations = dcount(operation_Name),
    FirstOccurrence = min(timestamp),
    LastOccurrence = max(timestamp)
    by ErrorCategory, ErrorSeverity, type
| order by ErrorCount desc
```

### Business Intelligence Queries

#### User Behavior Analysis
```kusto
customEvents
| where timestamp >= ago(7d)
| where name in ('CSV_FILE_UPLOADED', 'CHAT_INTERACTION', 'EXPORT_GENERATED')
| extend UserId = tostring(customDimensions.userId)
| summarize 
    FileUploads = countif(name == 'CSV_FILE_UPLOADED'),
    ChatInteractions = countif(name == 'CHAT_INTERACTION'),
    Exports = countif(name == 'EXPORT_GENERATED'),
    FirstActivity = min(timestamp),
    LastActivity = max(timestamp),
    SessionDuration = max(timestamp) - min(timestamp)
    by UserId
| extend 
    UserType = case(
        FileUploads >= 10, 'Power User',
        FileUploads >= 3, 'Regular User',
        FileUploads >= 1, 'New User',
        'Inactive User'
    ),
    EngagementScore = (FileUploads * 3) + (ChatInteractions * 2) + (Exports * 4)
| order by EngagementScore desc
```

#### Feature Adoption and Usage Patterns
```kusto
customEvents
| where timestamp >= ago(30d)
| where name startswith 'FEATURE_'
| extend Feature = extract(@'FEATURE_([^_]+)', 1, name)
| extend UserId = tostring(customDimensions.userId)
| summarize 
    TotalUsage = count(),
    UniqueUsers = dcount(UserId),
    AdoptionRate = dcount(UserId) * 100.0 / (
        customEvents
        | where timestamp >= ago(30d)
        | where name == 'USER_LOGIN'
        | summarize dcount(tostring(customDimensions.userId))
    ),
    AverageUsagePerUser = count() * 1.0 / dcount(UserId)
    by Feature
| order by AdoptionRate desc
```

## 🔧 Operational Procedures

### Daily Monitoring Checklist

#### Morning Health Check
```bash
# 1. Run comprehensive monitoring test
./test-production-monitoring.sh production --comprehensive --report

# 2. Check overnight alerts and incidents
az monitor activity-log list --start-time "$(date -d '1 day ago' -u +%Y-%m-%dT%H:%M:%SZ)" --status Failed

# 3. Validate key business metrics
# - Daily active users
# - File upload success rate
# - Chat interaction performance
# - OpenAI API cost and usage

# 4. Review error trends and new exceptions
# - Check exception dashboard
# - Analyze error rate trends
# - Identify new error patterns
```

#### Performance Review
```bash
# 1. Analyze response time trends
# 2. Check resource utilization
# 3. Review dependency performance
# 4. Validate availability metrics
# 5. Assess scaling needs
```

### Weekly Monitoring Review

#### Business Intelligence Review
1. **User Engagement Analysis**
   - Weekly active users
   - Feature adoption rates
   - User journey completion rates
   - Conversion funnel performance

2. **Cost and Resource Analysis**
   - OpenAI API usage and costs
   - Azure resource consumption
   - Performance vs. cost optimization opportunities

3. **Security and Compliance Review**
   - Authentication failure patterns
   - Suspicious activity detection
   - Access pattern analysis
   - Compliance metric validation

### Monthly Monitoring Assessment

#### Monitoring Health Assessment
1. **Alert Effectiveness Review**
   - Alert noise analysis
   - False positive rate assessment
   - Response time evaluation
   - Escalation procedure effectiveness

2. **Dashboard and Workbook Optimization**
   - Query performance analysis
   - Business metric relevance review
   - User feedback incorporation
   - New visualization requirements

3. **Capacity Planning and Scaling**
   - Growth trend analysis
   - Resource requirement forecasting
   - Performance bottleneck identification
   - Scaling strategy development

## 🚨 Incident Response and Troubleshooting

### Incident Response Playbook

#### High Error Rate Incident
```bash
# 1. Immediate Assessment
az monitor log-analytics query \
  --workspace taktmate-logs-prod \
  --analytics-query "
    exceptions
    | where timestamp >= ago(15m)
    | summarize count() by type, bin(timestamp, 1m)
    | order by timestamp desc"

# 2. Impact Analysis
az monitor log-analytics query \
  --workspace taktmate-logs-prod \
  --analytics-query "
    requests
    | where timestamp >= ago(15m)
    | summarize 
        TotalRequests = count(),
        FailedRequests = countif(success == false),
        ErrorRate = (countif(success == false) * 100.0) / count()
    | project ErrorRate, TotalRequests, FailedRequests"

# 3. Root Cause Investigation
# - Check recent deployments
# - Analyze dependency failures
# - Review configuration changes
# - Examine external service status
```

#### Performance Degradation Response
```bash
# 1. Performance Metrics Analysis
az monitor log-analytics query \
  --workspace taktmate-logs-prod \
  --analytics-query "
    requests
    | where timestamp >= ago(30m)
    | summarize 
        AvgDuration = avg(duration),
        P95Duration = percentile(duration, 95),
        P99Duration = percentile(duration, 99)
    by bin(timestamp, 5m)
    | order by timestamp desc"

# 2. Resource Utilization Check
az monitor metrics list \
  --resource /subscriptions/SUB_ID/resourceGroups/taktmate-prod-rg/providers/Microsoft.Web/sites/taktmate-api-prod \
  --metric CpuPercentage,MemoryPercentage \
  --interval PT5M \
  --start-time "$(date -d '30 minutes ago' -u +%Y-%m-%dT%H:%M:%SZ)"

# 3. Dependency Performance Analysis
az monitor log-analytics query \
  --workspace taktmate-logs-prod \
  --analytics-query "
    dependencies
    | where timestamp >= ago(30m)
    | summarize 
        AvgDuration = avg(duration),
        FailureRate = (countif(success == false) * 100.0) / count()
    by target, type
    | order by AvgDuration desc"
```

### Common Troubleshooting Scenarios

#### 1. Missing Telemetry Data
**Symptoms**: No data appearing in Application Insights
**Investigation Steps**:
```bash
# Check Application Insights configuration
az webapp config appsettings list \
  --name taktmate-api-prod \
  --resource-group taktmate-prod-rg \
  --query "[?name=='APPLICATIONINSIGHTS_CONNECTION_STRING']"

# Verify App Service logs
az webapp log tail --name taktmate-api-prod --resource-group taktmate-prod-rg

# Test connection string validity
az monitor app-insights component show \
  --app taktmate-appinsights-prod \
  --resource-group taktmate-prod-rg \
  --query "connectionString"
```

#### 2. High Alert Noise
**Symptoms**: Too many false positive alerts
**Resolution Steps**:
1. Analyze alert frequency and patterns
2. Adjust alert thresholds based on baseline metrics
3. Implement alert suppression during maintenance windows
4. Review and optimize alert conditions

#### 3. Dashboard Query Performance Issues
**Symptoms**: Slow dashboard loading, query timeouts
**Optimization Steps**:
```kusto
// Optimize queries with time range filters
requests
| where timestamp >= ago(1d)  // Always include time filter
| summarize count() by bin(timestamp, 1h)

// Use sampling for large datasets
requests
| where timestamp >= ago(7d)
| sample 1000  // Sample for trend analysis
| summarize avg(duration) by bin(timestamp, 1h)

// Pre-aggregate data for common queries
requests
| where timestamp >= ago(1d)
| summarize 
    RequestCount = count(),
    AvgDuration = avg(duration)
    by bin(timestamp, 1h), operation_Name
| order by timestamp desc
```

## 📚 Best Practices and Recommendations

### Monitoring Best Practices

#### 1. Telemetry Strategy
- **Structured Logging**: Use consistent log formats and structured data
- **Correlation IDs**: Implement request correlation across services
- **Sampling Strategy**: Balance data completeness with cost and performance
- **Custom Metrics**: Focus on business-relevant metrics and KPIs

#### 2. Alert Management
- **Alert Fatigue Prevention**: Minimize false positives through proper thresholds
- **Escalation Procedures**: Define clear escalation paths for different severities
- **Alert Documentation**: Maintain runbooks for common alert scenarios
- **Regular Review**: Continuously optimize alert rules based on operational experience

#### 3. Dashboard Design
- **User-Centric Design**: Tailor dashboards to specific user roles and needs
- **Performance Optimization**: Optimize queries for fast loading times
- **Mobile Responsiveness**: Ensure dashboards work well on mobile devices
- **Regular Updates**: Keep dashboards current with changing business needs

### Security and Compliance

#### Data Privacy and Protection
- **PII Filtering**: Automatically remove personally identifiable information
- **Data Retention**: Implement appropriate data retention policies
- **Access Control**: Restrict dashboard and data access based on roles
- **Audit Logging**: Track access to monitoring data and configuration changes

#### Compliance Considerations
- **GDPR Compliance**: Ensure monitoring data handling complies with regulations
- **Data Residency**: Configure data storage in appropriate geographic regions
- **Encryption**: Use encryption for data in transit and at rest
- **Regular Audits**: Conduct periodic compliance assessments

This comprehensive production monitoring setup ensures robust observability, proactive issue detection, and business intelligence capabilities for the TaktMate application in production environments.
