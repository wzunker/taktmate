# Custom Dashboards Guide for TaktMate

## Overview

This guide provides comprehensive documentation for the custom Application Insights dashboards for TaktMate. The dashboard system provides detailed insights into application performance, user behavior, error patterns, and business metrics through Azure Application Insights.

## Dashboard Architecture

### Core Components

1. **Overview Dashboard** - Main application health and performance overview
2. **Error Monitoring Dashboard** - Comprehensive error tracking and analysis
3. **Performance Dashboard** - System performance and response time monitoring
4. **Business Intelligence Dashboard** - User engagement and business metrics

### Data Sources

All dashboards use Azure Application Insights as the primary data source, leveraging:
- **Request Telemetry** - HTTP request performance and success rates
- **Custom Events** - Application-specific events (file uploads, chat interactions, etc.)
- **Exception Telemetry** - Error and exception tracking
- **Dependency Telemetry** - External service call monitoring
- **Custom Metrics** - Performance counters and business metrics

## Dashboard Deployment

### Prerequisites

1. **Azure Subscription** - Active Azure subscription with Application Insights
2. **Resource Group** - Target resource group for dashboard deployment
3. **Application Insights** - Configured Application Insights instance
4. **Azure CLI or PowerShell** - For automated deployment

### Environment Variables

Set the following environment variables before deployment:

```bash
export AZURE_SUBSCRIPTION_ID="your-subscription-id"
export AZURE_RESOURCE_GROUP="your-resource-group"
export APPINSIGHTS_RESOURCE_ID="/subscriptions/your-subscription-id/resourceGroups/your-rg/providers/microsoft.insights/components/your-app-insights"
```

### Automated Deployment

```bash
# Generate deployment scripts
npm run deploy:dashboards generate

# Execute generated deployment script
./dashboard-deployment/deploy-dashboards.sh
```

### Manual Deployment

```bash
# Deploy individual dashboard
az deployment group create \
  --resource-group "your-resource-group" \
  --template-file "dashboards/overview-dashboard.json" \
  --parameters \
    dashboardName="TaktMate - Application Overview" \
    applicationInsightsResourceId="/subscriptions/.../components/your-app-insights"
```

## Overview Dashboard

### Purpose
Provides a high-level view of application health, performance, and user activity.

### Key Metrics

#### Application Health Summary
- **Total Requests** - Number of HTTP requests in the last 24 hours
- **Success Rate** - Percentage of successful requests
- **Error Rate** - Percentage of failed requests
- **Average Duration** - Mean response time
- **P95 Duration** - 95th percentile response time

**Query Example:**
```kusto
requests
| where timestamp > ago(1d)
| summarize 
    TotalRequests = count(),
    SuccessfulRequests = countif(success == true),
    FailedRequests = countif(success == false),
    AvgDuration = avg(duration),
    P95Duration = percentile(duration, 95)
| extend 
    SuccessRate = round((todouble(SuccessfulRequests) / todouble(TotalRequests)) * 100, 2),
    ErrorRate = round((todouble(FailedRequests) / todouble(TotalRequests)) * 100, 2)
```

#### Request Volume Trends
- **Hourly Request Count** - Request volume over time
- **Traffic Patterns** - Peak usage identification
- **Growth Trends** - Usage growth analysis

#### Response Time Percentiles
- **P50, P75, P95, P99** - Response time distribution
- **Performance Trends** - Response time changes over time
- **Performance Baseline** - Expected performance levels

#### Top Endpoints Analysis
- **Request Count by Endpoint** - Most used endpoints
- **Average Duration** - Performance by endpoint
- **Error Rate by Endpoint** - Reliability by endpoint

#### User Activity Summary
- **Active Users** - Users active in different time periods
- **Daily/Weekly Active Users** - User engagement metrics
- **Session Count** - User session analytics

#### CSV Processing Summary
- **Files Processed** - Number of CSV files uploaded
- **Total Data Size** - Amount of data processed
- **Processing Performance** - Average processing times

#### System Performance Overview
- **Memory Usage** - Heap and system memory utilization
- **CPU Usage** - Process CPU utilization
- **Resource Trends** - System resource usage over time

### Use Cases

1. **Daily Health Check** - Quick assessment of application status
2. **Performance Monitoring** - Identify performance trends and issues
3. **Capacity Planning** - Understand usage patterns and growth
4. **Executive Reporting** - High-level metrics for stakeholders

## Error Monitoring Dashboard

### Purpose
Comprehensive error tracking, analysis, and troubleshooting support.

### Key Metrics

#### Error Rate Trends
- **Error Percentage Over Time** - Error rate trends
- **Error Spikes** - Sudden increases in errors
- **Error Recovery** - Error resolution patterns

**Query Example:**
```kusto
requests
| where timestamp > ago(24h)
| summarize 
    TotalRequests = count(),
    ErrorRequests = countif(success == false)
    by bin(timestamp, 1h)
| extend ErrorRate = round((todouble(ErrorRequests) / todouble(TotalRequests)) * 100, 2)
| order by timestamp asc
| render timechart
```

#### Error Distribution by Category
- **Error Categories** - Application, network, database, authentication, etc.
- **Severity Levels** - Critical, error, warning classification
- **Error Volume** - Count of errors by category

#### Top Errors by Frequency
- **Most Common Errors** - Errors with highest occurrence
- **User Impact** - Number of users affected
- **Error Patterns** - Recurring error types

#### Authentication Error Analysis
- **Auth Failures** - Authentication and authorization errors
- **Token Issues** - JWT token problems
- **Security Incidents** - Potential security issues

#### External Service Errors
- **Dependency Failures** - External service errors
- **API Errors** - Third-party API issues
- **Service Availability** - External service health

#### Error Impact on Users
- **User Error Rates** - Errors per user
- **Affected Components** - Components with errors
- **Error Correlation** - Related error patterns

#### Critical Errors and Unhandled Exceptions
- **System-Level Errors** - Unhandled exceptions
- **Critical Failures** - High-severity errors
- **Process Crashes** - Application stability issues

#### Validation Errors by Field
- **Data Validation** - Input validation failures
- **Field-Specific Errors** - Most problematic fields
- **Validation Patterns** - Common validation issues

#### Error Resolution Time Analysis
- **Time to Resolution** - How long errors persist
- **Error Lifecycle** - From occurrence to resolution
- **Resolution Effectiveness** - Error recurrence rates

#### Error Correlation Analysis
- **Related Errors** - Errors occurring together
- **Error Chains** - Cascading error patterns
- **Root Cause Analysis** - Primary error sources

### Use Cases

1. **Incident Response** - Quickly identify and respond to errors
2. **Root Cause Analysis** - Understand error patterns and causes
3. **Quality Assurance** - Monitor application reliability
4. **Security Monitoring** - Identify potential security issues

## Performance Dashboard

### Purpose
Monitor application performance, response times, and system resource utilization.

### Key Metrics

#### Response Time Trends
- **Average Response Time** - Mean response time over time
- **Percentile Trends** - P50, P95, P99 response times
- **Performance Degradation** - Increasing response times

#### Request Throughput Analysis
- **Requests per Minute** - Application load over time
- **Traffic Patterns** - Peak and off-peak usage
- **Capacity Utilization** - System load analysis

#### Endpoint Performance Analysis
- **Performance by Endpoint** - Response times per endpoint
- **Throughput by Endpoint** - Request volume per endpoint
- **Performance Rankings** - Fastest and slowest endpoints

**Query Example:**
```kusto
requests
| where timestamp > ago(24h)
| summarize 
    RequestCount = count(),
    AvgDuration = avg(duration),
    P95Duration = percentile(duration, 95),
    ErrorRate = round((todouble(countif(success == false)) / todouble(count())) * 100, 2)
    by name
| order by RequestCount desc
| take 15
```

#### System Resource Utilization
- **Memory Usage** - System and process memory
- **CPU Utilization** - CPU load and pressure
- **Resource Trends** - Resource usage over time

#### Dependency Performance
- **External Service Performance** - Third-party service response times
- **Database Performance** - Database query performance
- **API Call Performance** - External API response times

#### CSV Processing Performance
- **Processing Time by File Size** - Performance scaling
- **Throughput Analysis** - Rows processed per second
- **Processing Efficiency** - Performance optimization opportunities

#### Chat Performance Analysis
- **Response Time by Complexity** - Chat performance patterns
- **AI Service Performance** - OpenAI API performance
- **Chat Success Rates** - Chat interaction reliability

#### Memory Pressure Trends
- **Heap Usage** - Application memory usage
- **Memory Leaks** - Increasing memory usage patterns
- **Garbage Collection** - Memory management efficiency

#### Performance Alerts
- **Slow Requests** - Requests exceeding thresholds
- **High Memory Usage** - Memory pressure alerts
- **High Error Rates** - Performance-impacting errors

#### Top Slow Operations
- **Slowest Operations** - Operations with highest latency
- **Performance Bottlenecks** - System performance constraints
- **Optimization Opportunities** - Areas for improvement

### Use Cases

1. **Performance Optimization** - Identify and fix performance issues
2. **Capacity Planning** - Plan for scaling and resource needs
3. **SLA Monitoring** - Ensure service level agreements
4. **System Health** - Monitor overall system performance

## Business Intelligence Dashboard

### Purpose
Track user engagement, business metrics, and application usage analytics.

### Key Metrics

#### User Activity Overview
- **Total Users** - Unique user count
- **Daily/Weekly Active Users** - User engagement levels
- **Session Analytics** - User session patterns
- **User Interactions** - Activity per user

#### CSV Processing Business Metrics
- **Files Processed** - Business volume metrics
- **Data Volume** - Amount of data processed
- **Processing Efficiency** - Business process performance
- **User Adoption** - Feature usage patterns

**Query Example:**
```kusto
customEvents
| where timestamp > ago(7d) and name == 'CSVFileUpload'
| extend 
    fileSize = todouble(customMeasurements.fileSize),
    rowCount = todouble(customMeasurements.rowCount)
| summarize 
    FilesProcessed = count(),
    TotalDataProcessedMB = round(sum(fileSize) / 1024 / 1024, 2),
    TotalRowsProcessed = sum(rowCount),
    AvgFileSize = round(avg(fileSize) / 1024 / 1024, 2)
```

#### Chat Interaction Analytics
- **Chat Volume** - Number of chat interactions
- **Chat Success Rates** - Successful chat completions
- **User Engagement** - Chat usage patterns
- **AI Performance** - Chat response quality

#### Daily User Engagement Trends
- **Engagement Over Time** - User activity trends
- **Feature Usage** - Most used features
- **User Journey** - User behavior patterns

#### User Behavior Patterns
- **User Segmentation** - Active, casual, power users
- **Feature Adoption** - How users use features
- **User Retention** - User return patterns

#### Top Users by Activity
- **Most Active Users** - Power user identification
- **User Contributions** - User-generated content
- **User Value** - High-value user analysis

#### File Processing Efficiency
- **Processing Performance** - Business process efficiency
- **Success Rates** - Processing reliability
- **Quality Metrics** - Data quality indicators

#### Chat Engagement Quality
- **Engagement Depth** - Chat interaction quality
- **User Satisfaction** - Inferred satisfaction metrics
- **Content Quality** - Chat content analysis

#### Business Value Metrics
- **Data Processed** - Total business value delivered
- **User Productivity** - Efficiency improvements
- **Cost Savings** - Business impact metrics

#### User Retention Analysis
- **Cohort Analysis** - User retention over time
- **Churn Analysis** - User departure patterns
- **Retention Strategies** - Engagement improvement opportunities

### Use Cases

1. **Product Management** - Understand feature usage and user needs
2. **Business Intelligence** - Track business metrics and KPIs
3. **User Experience** - Improve user engagement and satisfaction
4. **Growth Analysis** - Understand user acquisition and retention

## Custom KQL Queries

### Query Categories

#### Application Health Queries
```kusto
// Overall Application Health Summary
requests
| where timestamp > ago(24h)
| summarize 
    TotalRequests = count(),
    SuccessfulRequests = countif(success == true),
    FailedRequests = countif(success == false),
    AvgDuration = avg(duration),
    P95Duration = percentile(duration, 95)
| extend 
    SuccessRate = round((todouble(SuccessfulRequests) / todouble(TotalRequests)) * 100, 2),
    ErrorRate = round((todouble(FailedRequests) / todouble(TotalRequests)) * 100, 2)
```

#### Error Analysis Queries
```kusto
// Top Errors by Frequency and Impact
exceptions
| where timestamp > ago(24h)
| summarize 
    ErrorCount = count(),
    UniqueUsers = dcount(tostring(customDimensions.userId)),
    FirstOccurrence = min(timestamp),
    LastOccurrence = max(timestamp)
    by type, outerMessage
| order by ErrorCount desc
| take 20
```

#### Performance Analysis Queries
```kusto
// Response Time Percentiles by Endpoint
requests
| where timestamp > ago(24h)
| summarize 
    RequestCount = count(),
    P50 = percentile(duration, 50),
    P75 = percentile(duration, 75),
    P95 = percentile(duration, 95),
    P99 = percentile(duration, 99)
    by name
| where RequestCount > 10
| order by P95 desc
```

#### User Behavior Analysis Queries
```kusto
// User Activity Summary
customEvents
| where timestamp > ago(7d)
| where name in ('FileUpload', 'ChatInteraction', 'FileAccess')
| extend userId = tostring(customDimensions.userId)
| where isnotempty(userId) and userId != 'anonymous'
| summarize 
    FileUploads = countif(name == 'FileUpload'),
    ChatInteractions = countif(name == 'ChatInteraction'),
    FileAccesses = countif(name == 'FileAccess'),
    FirstActivity = min(timestamp),
    LastActivity = max(timestamp)
    by userId
| order by (FileUploads + ChatInteractions + FileAccesses) desc
```

#### Business Intelligence Queries
```kusto
// Monthly Business Metrics
let fileUploads = customEvents | where timestamp > ago(30d) and name == 'CSVFileUpload';
let chatInteractions = customEvents | where timestamp > ago(30d) and name == 'CSVChatInteraction';
union
    (fileUploads | summarize Value = count() | extend Metric = 'Files Processed'),
    (fileUploads | extend fileSize = todouble(customMeasurements.fileSize) | summarize Value = round(sum(fileSize) / 1024 / 1024 / 1024, 2) | extend Metric = 'Data Processed (GB)'),
    (chatInteractions | summarize Value = count() | extend Metric = 'Chat Interactions')
```

### Advanced Query Patterns

#### Error Spike Detection
```kusto
// Detect sudden increases in error rates
let baseline = requests
| where timestamp between (ago(7d) .. ago(1d))
| summarize BaselineErrorRate = (todouble(countif(success == false)) / todouble(count())) * 100;
let current = requests
| where timestamp > ago(1h)
| summarize CurrentErrorRate = (todouble(countif(success == false)) / todouble(count())) * 100;
union baseline, current
| summarize 
    BaselineRate = max(BaselineErrorRate),
    CurrentRate = max(CurrentErrorRate)
| extend 
    Difference = CurrentRate - BaselineRate,
    Alert = case(Difference > 5, 'Critical Spike', Difference > 2, 'Warning Spike', 'Normal')
```

#### Performance Regression Detection
```kusto
// Detect performance degradation compared to baseline
let baseline = requests
| where timestamp between (ago(7d) .. ago(1d))
| summarize BaselineP95 = percentile(duration, 95) by name;
let current = requests
| where timestamp > ago(1h)
| summarize CurrentP95 = percentile(duration, 95) by name;
baseline
| join current on name
| extend 
    Degradation = ((CurrentP95 - BaselineP95) / BaselineP95) * 100,
    Alert = case(Degradation > 50, 'Critical', Degradation > 25, 'Warning', 'Normal')
| where Degradation > 10
| order by Degradation desc
```

## Dashboard Testing and Validation

### Testing Framework

Run comprehensive dashboard tests:

```bash
# Test all dashboard components
npm run test:dashboards

# Test specific components
npm run test:dashboards templates    # Template validation
npm run test:dashboards queries      # Query validation
npm run test:dashboards deployment   # Deployment testing
npm run test:dashboards completeness # Completeness check
npm run test:dashboards compatibility # Data source compatibility
npm run test:dashboards performance  # Performance analysis
```

### Validation Checklist

#### Template Validation
- [ ] JSON syntax validity
- [ ] ARM template structure
- [ ] Required parameters present
- [ ] Resource definitions correct

#### Query Validation
- [ ] KQL syntax correctness
- [ ] Data source compatibility
- [ ] Query performance acceptable
- [ ] Chart rendering functional

#### Deployment Validation
- [ ] Environment variables configured
- [ ] Azure credentials available
- [ ] Resource permissions adequate
- [ ] Deployment scripts functional

#### Completeness Validation
- [ ] All expected charts present
- [ ] Chart titles descriptive
- [ ] Data visualization appropriate
- [ ] Dashboard navigation intuitive

#### Compatibility Validation
- [ ] Telemetry data sources available
- [ ] Custom events and metrics defined
- [ ] Application Insights integration functional
- [ ] Query results meaningful

#### Performance Validation
- [ ] Dashboard loading time acceptable
- [ ] Query execution time reasonable
- [ ] Template size manageable
- [ ] Resource usage efficient

## Troubleshooting

### Common Issues

#### Dashboard Deployment Failures
**Symptom**: ARM template deployment fails
**Solution**: 
- Verify Azure credentials and permissions
- Check Application Insights resource ID format
- Validate template JSON syntax
- Review Azure CLI/PowerShell output for specific errors

#### Missing Data in Dashboards
**Symptom**: Charts show no data or empty results
**Solution**:
- Verify Application Insights is receiving telemetry
- Check custom event and metric names
- Validate time range settings
- Review KQL query syntax and logic

#### Slow Dashboard Performance
**Symptom**: Dashboards load slowly or time out
**Solution**:
- Optimize KQL queries for performance
- Reduce time range for large datasets
- Use sampling for high-volume data
- Consider query caching strategies

#### Incorrect Chart Visualizations
**Symptom**: Charts display unexpected data or formats
**Solution**:
- Review query results and data types
- Verify chart type appropriateness
- Check data aggregation logic
- Validate time series formatting

### Performance Optimization

#### Query Optimization
- Use appropriate time ranges
- Leverage query caching
- Optimize aggregation operations
- Use sampling for large datasets

#### Dashboard Optimization
- Minimize number of concurrent queries
- Use efficient chart types
- Implement progressive loading
- Cache frequently accessed data

## Security and Compliance

### Access Control
- **Role-Based Access** - Control dashboard access by Azure AD roles
- **Resource Permissions** - Limit access to Application Insights data
- **Dashboard Sharing** - Secure dashboard sharing mechanisms

### Data Privacy
- **PII Protection** - Ensure no personally identifiable information in dashboards
- **Data Masking** - Mask sensitive data in visualizations
- **Compliance** - Adhere to GDPR and other regulatory requirements

### Audit and Monitoring
- **Access Logging** - Track dashboard access and usage
- **Change Management** - Version control for dashboard modifications
- **Security Reviews** - Regular security assessments

## Best Practices

### Dashboard Design
1. **Clear Purpose** - Each dashboard should have a specific purpose
2. **Logical Layout** - Organize charts in a logical flow
3. **Consistent Styling** - Use consistent colors and formatting
4. **Meaningful Titles** - Use descriptive chart and dashboard titles
5. **Appropriate Visualizations** - Choose the right chart type for data

### Query Design
1. **Performance First** - Write efficient queries
2. **Readable Code** - Use clear, commented KQL
3. **Error Handling** - Handle edge cases and missing data
4. **Reusable Patterns** - Create reusable query patterns
5. **Testing** - Test queries thoroughly before deployment

### Maintenance
1. **Regular Reviews** - Periodically review dashboard relevance
2. **Performance Monitoring** - Monitor dashboard performance
3. **User Feedback** - Collect and act on user feedback
4. **Updates** - Keep dashboards updated with application changes
5. **Documentation** - Maintain up-to-date documentation

## Support and Resources

### Documentation
- **Azure Application Insights**: https://docs.microsoft.com/en-us/azure/azure-monitor/app/
- **KQL Reference**: https://docs.microsoft.com/en-us/azure/data-explorer/kusto/query/
- **ARM Templates**: https://docs.microsoft.com/en-us/azure/azure-resource-manager/templates/

### Tools
- **Azure Portal** - Dashboard management and viewing
- **Azure CLI** - Automated deployment and management
- **KQL Query Editor** - Query development and testing
- **Visual Studio Code** - Template and query development

### Support
- **TaktMate Support** - support@taktmate.com
- **Internal Documentation** - `/docs/` directory
- **Azure Support** - Azure support channels for infrastructure issues

## Changelog

### Version 2.0.0
- Complete custom dashboard implementation
- Four comprehensive dashboards (Overview, Error Monitoring, Performance, Business Intelligence)
- 40+ custom KQL queries for analysis
- Automated deployment scripts and testing
- Comprehensive documentation and troubleshooting guides
- Production-ready templates and configurations
