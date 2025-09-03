# CSV Telemetry and Analytics Guide for TaktMate

## Overview

This guide provides comprehensive documentation for the CSV processing telemetry and analytics capabilities in TaktMate. The system tracks detailed metrics across the entire CSV processing pipeline, from file upload to chat interactions, providing insights into performance, usage patterns, and business metrics.

## Telemetry Architecture

### Core Telemetry Functions

The CSV telemetry system includes the following specialized tracking functions:

1. **`trackFileUpload`** - Enhanced file upload tracking with comprehensive metrics
2. **`trackChatInteraction`** - Detailed chat interaction analytics
3. **`trackCSVParsing`** - CSV parsing performance and structure analysis
4. **`trackCSVAnalysis`** - Data analysis operation tracking
5. **`trackCSVFileOperation`** - File management operation tracking
6. **`trackCSVError`** - Comprehensive error tracking with context
7. **`trackCSVBusinessMetrics`** - Business KPI and metrics tracking

### Telemetry Categories

#### 1. Performance Metrics
- File processing times and rates
- Chat response times and efficiency
- Parsing performance and throughput
- Memory usage and resource utilization

#### 2. Usage Analytics
- File upload patterns and sizes
- User interaction behaviors
- Feature utilization rates
- Session analytics and engagement

#### 3. Quality Metrics
- Error rates and types
- Success rates across operations
- Data quality indicators
- System reliability metrics

#### 4. Business Intelligence
- Cost per operation metrics
- User satisfaction indicators
- Revenue-related analytics
- Operational efficiency KPIs

## File Upload Telemetry

### Enhanced File Upload Tracking

The `trackFileUpload` function provides comprehensive metrics for CSV file uploads:

```javascript
appInsights.telemetry.trackFileUpload(
  userId,           // User identifier
  filename,         // Original filename
  fileSize,         // File size in bytes
  rowCount,         // Number of data rows
  processingTime,   // Upload processing time in ms
  success,          // Success/failure flag
  additionalProps   // Extended properties
);
```

### Tracked Metrics

#### Primary Metrics
- **File Size**: Raw file size in bytes
- **Row Count**: Number of data rows processed
- **Processing Time**: Total upload processing time
- **Processing Rate**: Rows processed per second
- **Bytes Per Row**: Average bytes per data row

#### Categorization
- **Size Categories**: small (< 100KB), medium (< 1MB), large (< 5MB), xlarge (> 5MB)
- **Row Categories**: small (< 1k), medium (< 10k), large (< 100k), xlarge (> 100k)
- **Performance Categories**: slow, medium, fast (based on processing rate)

#### Additional Properties
```javascript
{
  userEmail: 'user@example.com',
  userDisplayName: 'John Doe',
  description: 'Sales data Q3',
  tags: 'sales,quarterly,revenue',
  isPublic: false,
  allowSharing: true,
  retentionDays: 30,
  userAgent: 'Mozilla/5.0...',
  ip: '192.168.1.1',
  columnCount: 15,
  encoding: 'utf-8',
  delimiter: 'comma',
  hasEmptyRows: false,
  hasSpecialCharacters: true
}
```

### Events Generated

1. **CSVFileUpload** - Main upload event with comprehensive metrics
2. **CSV_UploadBySize** - Size-categorized upload tracking
3. **CSV_UploadByRowCount** - Row-count-categorized tracking
4. **CSV_ProcessingPerformance** - Performance characteristics tracking

### Metrics Generated

- `CSV_FileSize` - File size metric with categorization
- `CSV_RowCount` - Row count metric with categorization  
- `CSV_ProcessingTime` - Processing time with performance category
- `CSV_ProcessingRate` - Processing rate with performance category

## CSV Parsing Telemetry

### Parsing Operation Tracking

The `trackCSVParsing` function tracks detailed CSV parsing metrics:

```javascript
appInsights.telemetry.trackCSVParsing(
  userId,           // User identifier
  filename,         // Filename being parsed
  fileSize,         // File size in bytes
  rowCount,         // Rows successfully parsed
  columnCount,      // Number of columns detected
  parseTime,        // Parsing time in milliseconds
  success,          // Parse success/failure
  additionalProps   // Extended parsing context
);
```

### Parsing Metrics

#### Performance Metrics
- **Parse Rate**: Rows parsed per second
- **Bytes Per Second**: Data throughput rate
- **Average Bytes Per Row**: Data density metric
- **Average Bytes Per Column**: Column density metric

#### Structure Analysis
- **Structure Complexity**: simple (< 20 cols), medium (< 50 cols), complex (> 50 cols)
- **Data Quality Indicators**: empty rows, special characters, encoding issues
- **Format Analysis**: delimiter type, encoding, data types

#### Memory and Resource Usage
- **Memory Usage**: Peak memory consumption during parsing
- **CPU Utilization**: Processing resource usage
- **I/O Performance**: Disk read performance metrics

### Events Generated

1. **CSV_ParsingOperation** - Main parsing event
2. **CSV_ParseTime** - Parse time metric
3. **CSV_ParseRate** - Parse rate metric

## Chat Interaction Telemetry

### Enhanced Chat Tracking

The `trackChatInteraction` function provides comprehensive chat analytics:

```javascript
appInsights.telemetry.trackChatInteraction(
  userId,           // User identifier
  fileId,           // Associated file ID
  filename,         // Associated filename
  messageLength,    // User message length
  responseTime,     // AI response time in ms
  success,          // Interaction success/failure
  additionalProps   // Extended chat context
);
```

### Chat Analytics

#### Interaction Metrics
- **Message Complexity**: simple (< 100 chars), medium (< 500 chars), complex (> 500 chars)
- **Response Speed**: fast (< 1s), medium (< 5s), slow (> 5s)
- **Words Per Second**: Processing efficiency metric
- **Response Efficiency**: Responses per second capability

#### AI Model Metrics
- **Token Usage**: Total tokens consumed
- **Prompt Tokens**: Input tokens used
- **Completion Tokens**: Output tokens generated
- **Cost Per Interaction**: Token-based cost calculation

#### Context Analysis
- **File Context**: File size, row count, access patterns
- **User Behavior**: Interaction patterns, session analytics
- **Query Analysis**: Question complexity, domain analysis

### Events Generated

1. **CSVChatInteraction** - Main chat event
2. **CSV_ChatByComplexity** - Complexity-categorized interactions
3. **CSV_ChatBySpeed** - Speed-categorized interactions
4. **CSV_FileContextChat** - File-specific chat analytics

### Metrics Generated

- `CSV_ChatResponseTime` - Response time with categorization
- `CSV_MessageLength` - Message length with complexity category
- `CSV_OpenAITokenUsage` - Token usage tracking

## Data Analysis Telemetry

### Analysis Operation Tracking

The `trackCSVAnalysis` function tracks data analysis operations:

```javascript
appInsights.telemetry.trackCSVAnalysis(
  userId,           // User identifier
  fileId,           // File being analyzed
  filename,         // Filename
  analysisType,     // Type of analysis performed
  analysisTime,     // Analysis duration in ms
  success,          // Analysis success/failure
  additionalProps   // Analysis context
);
```

### Analysis Types

#### Statistical Analysis
- **Summary Statistics**: mean, median, mode, standard deviation
- **Distribution Analysis**: histograms, percentiles, outliers
- **Correlation Analysis**: correlation matrices, relationships
- **Trend Analysis**: time series analysis, patterns

#### Data Quality Analysis
- **Completeness**: missing value analysis
- **Consistency**: data format validation
- **Accuracy**: outlier detection, anomaly identification
- **Uniqueness**: duplicate detection and analysis

#### Business Analysis
- **Performance Metrics**: KPI calculations, benchmarking
- **Segmentation**: customer segments, market analysis
- **Forecasting**: predictive analytics, trend projection
- **Optimization**: efficiency analysis, recommendations

### Analysis Complexity Categories

- **Simple**: < 1s analysis time, basic operations
- **Medium**: 1-5s analysis time, moderate complexity
- **Complex**: > 5s analysis time, advanced analytics

## File Operations Telemetry

### Operation Tracking

The `trackCSVFileOperation` function tracks file management operations:

```javascript
appInsights.telemetry.trackCSVFileOperation(
  userId,           // User identifier
  fileId,           // File identifier (null for list operations)
  filename,         // Filename or operation type
  operation,        // Operation type: view, list, delete, download
  operationTime,    // Operation duration in ms
  success,          // Operation success/failure
  additionalProps   // Operation context
);
```

### Supported Operations

#### File Management
- **View**: File metadata retrieval and display
- **List**: User file listing with pagination
- **Delete**: File removal operations
- **Download**: File export and download

#### Performance Metrics
- **Operation Speed**: Time to complete operations
- **Resource Usage**: Memory and CPU utilization
- **Cache Efficiency**: Cache hit rates and performance
- **Concurrent Operations**: Multi-user operation handling

### Events Generated

1. **CSV_FileOperation** - Main file operation event
2. **CSV_{operation}Time** - Operation-specific timing metrics

## Error Tracking and Analysis

### Comprehensive Error Tracking

The `trackCSVError` function provides detailed error analytics:

```javascript
appInsights.telemetry.trackCSVError(
  error,            // Error object
  userId,           // User identifier
  fileId,           // Associated file ID
  filename,         // Associated filename
  operation,        // Operation where error occurred
  additionalContext // Error context and details
);
```

### Error Categories

#### Upload Errors
- **File Format Errors**: Invalid CSV format, encoding issues
- **Size Limit Errors**: File too large, quota exceeded
- **Permission Errors**: Access denied, authentication failures
- **Network Errors**: Upload timeouts, connection issues

#### Processing Errors
- **Parsing Errors**: Malformed CSV, invalid data types
- **Memory Errors**: Out of memory, resource exhaustion
- **Validation Errors**: Data validation failures
- **System Errors**: Internal server errors, database issues

#### Chat Errors
- **AI Model Errors**: OpenAI API failures, rate limiting
- **Context Errors**: File not found, access denied
- **Query Errors**: Invalid queries, processing failures
- **Network Errors**: API timeouts, connectivity issues

### Error Analysis Metrics

#### Error Rates
- **Overall Error Rate**: Percentage of failed operations
- **Operation-Specific Rates**: Error rates by operation type
- **User-Specific Rates**: Error patterns by user
- **Time-Based Patterns**: Error trends over time

#### Error Resolution
- **Mean Time to Detection**: Average error detection time
- **Mean Time to Resolution**: Average error resolution time
- **Recovery Rates**: Percentage of recoverable errors
- **User Impact**: Affected users and sessions

## Business Metrics and KPIs

### Business Intelligence Tracking

The `trackCSVBusinessMetrics` function tracks key business indicators:

```javascript
appInsights.telemetry.trackCSVBusinessMetrics(
  userId,           // User identifier
  fileId,           // Associated file ID
  filename,         // Associated filename
  metrics,          // Business metrics object
  additionalProps   // Business context
);
```

### Key Performance Indicators

#### Operational KPIs
- **Upload Success Rate**: Percentage of successful uploads
- **Processing Efficiency**: Data processed per unit time
- **System Availability**: Uptime and reliability metrics
- **User Satisfaction**: User experience indicators

#### Financial KPIs
- **Cost Per Operation**: Resource cost per operation
- **Revenue Per User**: User value metrics
- **Cost Optimization**: Efficiency improvements
- **ROI Metrics**: Return on investment indicators

#### Usage KPIs
- **Active Users**: Daily/monthly active users
- **Feature Adoption**: Feature utilization rates
- **Session Metrics**: Session duration and engagement
- **Retention Rates**: User retention and churn

### Business Metrics Examples

```javascript
const businessMetrics = {
  // Operational metrics
  totalFilesUploaded: 150,
  totalDataPointsProcessed: 2500000,
  averageFileSize: 2.5 * 1024 * 1024, // 2.5MB
  processingEfficiency: 15000, // rows/second
  
  // User engagement metrics
  totalChatInteractions: 850,
  averageResponseTime: 1800, // ms
  userSatisfactionScore: 4.3, // 1-5 scale
  sessionDuration: 1200, // seconds
  
  // Cost and efficiency metrics
  totalTokensUsed: 125000,
  costPerProcessedRow: 0.0015, // dollars
  dataEfficiency: 95, // tokens per 1000 rows
  resourceUtilization: 0.68, // 0-1 scale
  
  // Quality metrics
  uploadSuccessRate: 0.97, // 97%
  chatSuccessRate: 0.94, // 94%
  dataQualityScore: 0.89, // 89%
  systemAvailability: 0.999 // 99.9%
};
```

## Dashboard and Visualization

### Azure Application Insights Dashboards

#### Performance Dashboard
- **File Upload Performance**: Upload times, success rates, throughput
- **Chat Response Performance**: Response times, token usage, efficiency
- **System Performance**: CPU, memory, network utilization
- **Error Rates**: Error trends, failure patterns, resolution times

#### Usage Analytics Dashboard
- **User Activity**: Active users, session patterns, feature usage
- **File Analytics**: Upload patterns, file sizes, data volumes
- **Chat Analytics**: Interaction patterns, query complexity, satisfaction
- **Geographic Analytics**: User locations, regional patterns

#### Business Intelligence Dashboard
- **KPI Metrics**: Success rates, efficiency metrics, satisfaction scores
- **Cost Analysis**: Operational costs, cost per user, optimization opportunities
- **Revenue Metrics**: User value, feature monetization, growth indicators
- **Trend Analysis**: Growth trends, seasonal patterns, forecasts

### Custom Queries and Alerts

#### Performance Monitoring Queries

```kusto
// Average file upload time by size category
CSVFileUpload
| where timestamp > ago(24h)
| summarize avg(processingTime), count() by sizeCategory
| order by avg_processingTime desc

// Chat response time trends
CSVChatInteraction
| where timestamp > ago(7d)
| summarize avg(responseTime) by bin(timestamp, 1h)
| render timechart

// Error rate analysis
CSV_ProcessingError
| where timestamp > ago(24h)
| summarize count() by errorType, operation
| order by count_ desc
```

#### Business Intelligence Queries

```kusto
// User engagement metrics
CSVChatInteraction
| where timestamp > ago(30d)
| summarize 
    totalInteractions = count(),
    avgResponseTime = avg(responseTime),
    uniqueUsers = dcount(userId)
| extend engagementScore = totalInteractions / uniqueUsers

// Cost analysis
CSV_OpenAITokenUsage
| where timestamp > ago(30d)
| summarize totalTokens = sum(value)
| extend estimatedCost = totalTokens * 0.002 / 1000 // $0.002 per 1k tokens
```

### Alert Configuration

#### Critical Alerts
- **High Error Rate**: > 5% error rate in 15 minutes
- **Slow Response Times**: > 10s average response time
- **System Overload**: > 90% resource utilization
- **Service Unavailability**: No successful operations in 5 minutes

#### Warning Alerts
- **Elevated Error Rate**: > 2% error rate in 30 minutes
- **Slow Performance**: > 5s average response time
- **High Token Usage**: > 150% of daily average token usage
- **Low User Satisfaction**: < 4.0 satisfaction score

## Implementation Guide

### Setting Up CSV Telemetry

#### 1. Configuration
Ensure Application Insights is configured with CSV telemetry enabled:

```bash
# Environment variables
APPINSIGHTS_ENABLE_CUSTOM_TELEMETRY=true
APPINSIGHTS_ENABLE_BUSINESS_METRICS=true
APPINSIGHTS_ENABLE_USER_TRACKING=true
APPINSIGHTS_SAMPLING_PERCENTAGE=100  # Adjust for production
```

#### 2. Integration Points

**File Upload Endpoint**:
```javascript
// In upload endpoint
appInsights.telemetry.trackFileUpload(
  req.user.id,
  filename,
  buffer.length,
  rows.length,
  duration,
  true,
  { /* additional properties */ }
);
```

**Chat Endpoint**:
```javascript
// In chat endpoint
appInsights.telemetry.trackChatInteraction(
  req.user.id,
  fileId,
  filename,
  message.length,
  duration,
  true,
  { /* additional properties */ }
);
```

**Error Handling**:
```javascript
// In error handlers
appInsights.telemetry.trackCSVError(
  error,
  userId,
  fileId,
  filename,
  operation,
  { /* error context */ }
);
```

#### 3. Testing and Validation

Run the comprehensive test suite:

```bash
# Test all CSV telemetry functions
npm run test:csv-telemetry

# Test specific components
npm run test:csv-telemetry upload
npm run test:csv-telemetry chat
npm run test:csv-telemetry performance
```

### Best Practices

#### Performance Optimization
1. **Sampling**: Use appropriate sampling rates for production
2. **Batching**: Batch telemetry calls for high-volume scenarios
3. **Async Processing**: Use asynchronous telemetry to avoid blocking
4. **Resource Management**: Monitor memory usage and cleanup

#### Data Quality
1. **Validation**: Validate telemetry data before sending
2. **Consistency**: Use consistent property names and formats
3. **Completeness**: Ensure all critical metrics are captured
4. **Accuracy**: Verify metric calculations and units

#### Privacy and Security
1. **Data Filtering**: Remove sensitive information from telemetry
2. **User Consent**: Respect user privacy preferences
3. **Compliance**: Follow GDPR and other privacy regulations
4. **Access Control**: Restrict access to telemetry data

#### Cost Management
1. **Sampling Strategy**: Implement cost-effective sampling
2. **Data Retention**: Configure appropriate retention periods
3. **Query Optimization**: Optimize dashboard queries for cost
4. **Monitoring**: Monitor Application Insights costs and usage

## Troubleshooting

### Common Issues

#### Telemetry Not Appearing
1. Check Application Insights connection string
2. Verify sampling configuration
3. Check network connectivity
4. Validate telemetry function calls

#### Performance Impact
1. Review sampling rates
2. Check batching configuration
3. Monitor memory usage
4. Optimize telemetry volume

#### Data Quality Issues
1. Validate metric calculations
2. Check property consistency
3. Verify data types
4. Review filtering logic

### Debug Commands

```bash
# Test telemetry functions
node -e "
const ai = require('./config/applicationInsights');
ai.telemetry.trackFileUpload('test', 'test.csv', 1024, 100, 50, true);
console.log('Telemetry sent successfully');
"

# Test configuration
npm run test:csv-telemetry functions

# Performance testing
npm run test:csv-telemetry performance
```

## Monitoring and Maintenance

### Regular Monitoring Tasks

#### Daily
- Review error rates and trends
- Monitor performance metrics
- Check system availability
- Validate alert configurations

#### Weekly
- Analyze usage patterns
- Review cost and optimization opportunities
- Update dashboard queries
- Validate data quality

#### Monthly
- Business metrics review
- Performance trend analysis
- Cost optimization review
- User feedback analysis

### Maintenance Activities

#### Quarterly
- Review and update KPIs
- Optimize dashboard performance
- Update alert thresholds
- Conduct cost-benefit analysis

#### Annually
- Strategic metrics review
- Technology stack evaluation
- Compliance audit
- ROI assessment

## Advanced Features

### Custom Telemetry Processors

Enhance telemetry data with custom processors:

```javascript
// Add custom data enrichment
appInsights.defaultClient.addTelemetryProcessor((envelope) => {
  // Add business context
  envelope.data.baseData.properties.businessUnit = 'analytics';
  envelope.data.baseData.properties.costCenter = 'engineering';
  
  // Add geographic information
  envelope.data.baseData.properties.region = 'us-east-1';
  envelope.data.baseData.properties.datacenter = 'primary';
  
  return true;
});
```

### Machine Learning Integration

Integrate with Azure ML for advanced analytics:

```javascript
// Track ML model performance
appInsights.telemetry.trackCSVBusinessMetrics(
  userId,
  fileId,
  filename,
  {
    modelAccuracy: 0.94,
    predictionConfidence: 0.87,
    modelVersion: '2.1.0',
    trainingDataSize: 50000
  }
);
```

### Real-time Analytics

Implement real-time analytics dashboards:

```javascript
// Stream telemetry for real-time processing
const streamAnalytics = {
  trackRealTimeMetric: (metric, value) => {
    appInsights.telemetry.trackMetric(metric, value, {
      realTime: true,
      timestamp: Date.now()
    });
  }
};
```

## Conclusion

The CSV telemetry system provides comprehensive monitoring and analytics capabilities for TaktMate's CSV processing pipeline. By tracking detailed metrics across uploads, processing, chat interactions, and business operations, the system enables:

- **Performance Optimization**: Identify bottlenecks and optimization opportunities
- **User Experience Enhancement**: Monitor and improve user satisfaction
- **Business Intelligence**: Track KPIs and business metrics
- **Operational Excellence**: Maintain high availability and reliability
- **Cost Management**: Optimize resource usage and costs

The telemetry system is designed to be scalable, performant, and cost-effective while providing actionable insights for continuous improvement of the TaktMate platform.

## Support and Resources

- **Application Insights Documentation**: https://docs.microsoft.com/en-us/azure/azure-monitor/app/
- **Kusto Query Language**: https://docs.microsoft.com/en-us/azure/data-explorer/kusto/
- **TaktMate Support**: support@taktmate.com
- **Internal Documentation**: `/docs/` directory

## Changelog

### Version 2.0.0
- Complete CSV telemetry implementation
- Comprehensive metrics tracking across all operations
- Business intelligence and KPI monitoring
- Performance optimization and cost management
- Production-ready monitoring and alerting
