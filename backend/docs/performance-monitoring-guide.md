# Performance Monitoring and Dependency Tracking Guide for TaktMate

## Overview

This guide provides comprehensive documentation for the performance monitoring and dependency tracking capabilities in TaktMate. The system provides detailed insights into application performance, system resource utilization, external service dependencies, and operational characteristics.

## Performance Monitoring Architecture

### Core Components

1. **System Performance Monitoring** - CPU, memory, and resource utilization tracking
2. **Request Performance Monitoring** - HTTP request timing and categorization
3. **Dependency Tracking** - External service and API call monitoring
4. **Operation Performance Tracking** - Custom operation timing and success tracking
5. **Resource Utilization Monitoring** - System resource pressure and availability
6. **Startup Performance Tracking** - Application initialization and startup metrics

### Integration Points

The performance monitoring system integrates with:
- **Express Middleware** - Automatic request performance tracking
- **Application Insights** - Comprehensive telemetry and analytics
- **Azure OpenAI** - AI service dependency tracking
- **CSV Processing** - File processing operation monitoring
- **Error Handling** - Performance impact of error scenarios

## System Performance Monitoring

### System Metrics Tracking

The `trackSystemPerformance` function provides comprehensive system monitoring:

```javascript
telemetry.trackSystemPerformance({
  customMetric1: 100,
  customMetric2: 200
});
```

### Tracked System Metrics

#### Memory Metrics
- **Heap Used**: Current heap memory usage
- **Heap Total**: Total allocated heap memory
- **External**: Memory used by C++ objects bound to JavaScript
- **RSS**: Resident Set Size (total memory allocated)
- **Heap Usage Percent**: Percentage of heap memory used

#### CPU Metrics
- **CPU User**: User CPU time in microseconds
- **CPU System**: System CPU time in microseconds
- **CPU Usage**: Derived CPU utilization metrics

#### Process Metrics
- **Uptime**: Process uptime in seconds
- **PID**: Process identifier
- **Memory Pressure**: Categorized memory pressure (low/medium/high)

### Resource Utilization Monitoring

The `trackResourceUtilization` function provides system-wide resource monitoring:

```javascript
telemetry.trackResourceUtilization();
```

### Tracked Resource Metrics

#### System Memory
- **Total Memory**: Total system memory available
- **Free Memory**: Currently available memory
- **Used Memory**: Currently used memory
- **Memory Usage Percent**: System memory utilization percentage

#### CPU Information
- **CPU Count**: Number of CPU cores
- **Load Average**: 1, 5, and 15-minute load averages
- **CPU Pressure**: Categorized CPU pressure based on load average

#### System Information
- **Hostname**: System hostname
- **Platform**: Operating system platform
- **Architecture**: System architecture

### Performance Pressure Indicators

The system calculates and tracks resource pressure indicators:

#### Memory Pressure
- **Low**: < 60% memory usage
- **Medium**: 60-80% memory usage
- **High**: > 80% memory usage

#### CPU Pressure
- **Low**: Load average < 60% of CPU count
- **Medium**: Load average 60-80% of CPU count
- **High**: Load average > 80% of CPU count

## Request Performance Monitoring

### Automatic Request Tracking

The Express middleware automatically tracks all HTTP requests:

```javascript
telemetry.trackRequestPerformance(req, res, duration, {
  userId: req.user?.id,
  userEmail: req.user?.email,
  sessionId: req.sessionID,
  correlationId: req.headers['x-correlation-id']
});
```

### Request Categorization

Requests are automatically categorized for analysis:

#### Request Categories
- **API**: `/api/*` endpoints - Business logic and data operations
- **Auth**: `/auth/*` endpoints - Authentication and authorization
- **Health**: `/health` endpoint - System health checks
- **Other**: All other requests - Static files, unknown endpoints

#### Performance Categories
- **Fast**: < 100ms response time
- **Medium**: 100ms - 1000ms response time
- **Slow**: > 1000ms response time

### Tracked Request Metrics

#### Request Information
- **Method**: HTTP method (GET, POST, PUT, DELETE)
- **URL**: Request URL and path
- **Status Code**: HTTP response status code
- **Success**: Success/failure based on status code (< 400)

#### Performance Metrics
- **Duration**: Total request processing time
- **Response Size**: Response payload size in bytes
- **Request Size**: Request payload size in bytes

#### User Context
- **User Agent**: Client user agent (truncated for privacy)
- **User ID**: Authenticated user identifier
- **Session ID**: Session identifier for correlation
- **Correlation ID**: Request correlation identifier

### Request Performance Events

#### Main Events
- **RequestPerformance** - Comprehensive request performance data
- **Request_Duration** - Request timing metric
- **Request_Throughput** - Request volume metric

## Dependency Tracking

### Enhanced Dependency Monitoring

The `trackDependency` function provides detailed external service tracking:

```javascript
telemetry.trackDependency(
  'OpenAI API',
  'chat.completions.create',
  duration,
  success,
  'HTTP',
  {
    resultCode: 200,
    model: 'gpt-4.1',
    tokenUsage: 150
  }
);
```

### Dependency Categories

#### HTTP Dependencies
- **OpenAI API**: AI service calls for chat completions
- **External APIs**: Third-party service integrations
- **Webhooks**: Outbound webhook calls
- **File Services**: External file storage services

#### Database Dependencies
- **SQL Operations**: Database queries and operations
- **NoSQL Operations**: Document database operations
- **Cache Operations**: Redis or memory cache operations
- **Search Operations**: Search service queries

### Dependency Performance Categories

- **Fast**: < 1000ms response time
- **Medium**: 1000ms - 5000ms response time
- **Slow**: > 5000ms response time

### Tracked Dependency Metrics

#### Performance Metrics
- **Duration**: Total dependency call time
- **Success Rate**: Percentage of successful calls
- **Availability**: Service availability percentage
- **Throughput**: Calls per second

#### Context Information
- **Target**: Dependency service name
- **Command**: Specific operation or method
- **Result Code**: HTTP status or operation result code
- **Performance Category**: Categorized performance level

### Dependency Tracking Wrapper

The `trackDependencyCall` function provides automatic dependency tracking:

```javascript
const result = await performanceMonitoring.trackDependencyCall(
  'OpenAI API',
  'HTTP',
  async () => {
    return await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: messages
    });
  },
  {
    command: 'chat.completions.create',
    model: 'gpt-4.1'
  }
);
```

**Features**:
- **Automatic Timing**: Measures dependency call duration
- **Error Handling**: Tracks failures and error details
- **Result Correlation**: Associates results with performance data
- **Context Preservation**: Maintains operation context

## Operation Performance Tracking

### Custom Operation Monitoring

The `trackOperation` function provides custom operation performance tracking:

```javascript
const result = await performanceMonitoring.trackOperation(
  'CSV_Parsing',
  async () => {
    return await parseCsv(buffer);
  },
  {
    userId: 'user-123',
    filename: 'data.csv',
    fileSize: 1024000
  }
);
```

### Operation Categories

#### File Operations
- **CSV_Parsing**: CSV file parsing operations
- **File_Upload**: File upload processing
- **File_Storage**: File storage operations
- **File_Retrieval**: File access operations

#### Data Operations
- **Data_Analysis**: Data analysis and processing
- **Data_Transformation**: Data format conversions
- **Data_Validation**: Data quality validation
- **Data_Export**: Data export operations

#### Business Operations
- **User_Authentication**: User login and authentication
- **Chat_Processing**: AI chat processing
- **Report_Generation**: Report creation operations
- **Batch_Processing**: Batch operation processing

### Tracked Operation Metrics

#### Performance Data
- **Duration**: Total operation execution time
- **Success Rate**: Percentage of successful operations
- **Error Rate**: Percentage of failed operations
- **Throughput**: Operations per second

#### Context Information
- **Operation Name**: Specific operation identifier
- **User Context**: User and session information
- **Resource Usage**: Memory and CPU impact
- **Business Context**: Business-specific metadata

### Operation Performance Events

#### Main Events
- **OperationPerformance** - Comprehensive operation data
- **Operation_{Name}_Duration** - Operation-specific timing metrics

## Database Operation Tracking

### Database Performance Monitoring

The `trackDatabaseOperation` function tracks database operations:

```javascript
telemetry.trackDatabaseOperation(
  'SELECT',
  'users',
  75,
  true,
  {
    rowCount: 10,
    queryComplexity: 'simple'
  }
);
```

### Database Operation Types

#### Query Operations
- **SELECT**: Data retrieval queries
- **INSERT**: Data insertion operations
- **UPDATE**: Data modification operations
- **DELETE**: Data removal operations

#### Administrative Operations
- **CREATE**: Schema creation operations
- **ALTER**: Schema modification operations
- **INDEX**: Index management operations
- **BACKUP**: Database backup operations

### Database Performance Categories

- **Fast**: < 50ms execution time
- **Medium**: 50ms - 200ms execution time
- **Slow**: > 200ms execution time

### Tracked Database Metrics

#### Performance Metrics
- **Execution Time**: Query execution duration
- **Row Count**: Number of rows affected
- **Query Complexity**: Simple, medium, or complex
- **Resource Usage**: CPU and memory impact

#### Context Information
- **Operation Type**: SQL operation type
- **Table Name**: Target table or collection
- **Success Rate**: Query success percentage
- **Error Details**: Failure information and context

## Startup Performance Tracking

### Application Startup Monitoring

The `trackStartupPerformance` function tracks application initialization:

```javascript
telemetry.trackStartupPerformance({
  properties: {
    version: '2.0.0',
    azureAdB2CConfigured: 'true',
    applicationInsightsConfigured: 'true'
  },
  measurements: {
    startupDuration: 1500,
    moduleLoadTime: 500,
    configurationTime: 200
  }
});
```

### Startup Phases

#### Initialization Phase
- **Module Loading**: Time to load required modules
- **Configuration Loading**: Time to process configuration
- **Service Initialization**: Time to initialize services
- **Middleware Setup**: Time to configure middleware

#### Validation Phase
- **Configuration Validation**: Time to validate settings
- **Dependency Checks**: Time to verify dependencies
- **Health Checks**: Time to perform startup health checks
- **Resource Allocation**: Time to allocate resources

#### Readiness Phase
- **Server Startup**: Time to start HTTP server
- **Route Registration**: Time to register routes
- **Final Validation**: Time for final readiness checks
- **Monitoring Setup**: Time to initialize monitoring

### Tracked Startup Metrics

#### Timing Metrics
- **Startup Duration**: Total application startup time
- **Module Load Time**: Time to load all modules
- **Configuration Time**: Configuration processing time
- **Memory Usage**: Initial memory allocation

#### Configuration Status
- **Feature Flags**: Enabled/disabled features
- **Service Status**: Service initialization status
- **Environment**: Deployment environment
- **Version**: Application version information

## Performance Monitoring Lifecycle

### Starting Performance Monitoring

```javascript
const monitoringInterval = performanceMonitoring.startMonitoring(60000); // Every minute
```

### Monitoring Features

#### Automatic Metrics Collection
- **System Performance**: CPU, memory, and resource metrics
- **Resource Utilization**: System-wide resource monitoring
- **Business Metrics**: Custom business KPIs (if configured)
- **Health Indicators**: Application health and status

#### Configurable Intervals
- **Default**: 60 seconds (60000ms)
- **High Frequency**: 10-30 seconds for detailed monitoring
- **Low Frequency**: 5-10 minutes for production efficiency
- **Custom**: Any interval based on monitoring requirements

### Stopping Performance Monitoring

```javascript
performanceMonitoring.stopMonitoring(monitoringInterval);
```

### Graceful Shutdown

The application handles graceful shutdown with monitoring cleanup:

```javascript
process.on('SIGTERM', () => {
  // Stop performance monitoring
  if (performanceMonitor && appInsights?.performanceMonitoring) {
    appInsights.performanceMonitoring.stopMonitoring(performanceMonitor);
  }
  
  // Flush telemetry data
  if (appInsights) {
    appInsights.flush();
  }
});
```

## Performance Snapshots

### Real-Time Performance Data

The `getPerformanceSnapshot` function provides instant performance data:

```javascript
const snapshot = performanceMonitoring.getPerformanceSnapshot();
```

### Snapshot Data Structure

```javascript
{
  timestamp: "2024-01-15T10:30:00.000Z",
  memory: {
    heapUsed: 45678912,
    heapTotal: 67108864,
    external: 1234567,
    rss: 89012345,
    heapUsagePercent: 68.2
  },
  cpu: {
    user: 1500000,
    system: 750000
  },
  system: {
    uptime: 3600,
    loadAverage: [1.2, 1.5, 1.8],
    totalMemory: 8589934592,
    freeMemory: 2147483648,
    cpuCount: 4
  }
}
```

### Snapshot Use Cases

#### Health Checks
- **Real-time Status**: Current system health
- **Resource Availability**: Available system resources
- **Performance Indicators**: Current performance levels
- **Capacity Planning**: Resource utilization trends

#### Debugging and Troubleshooting
- **Performance Issues**: Identify performance bottlenecks
- **Memory Leaks**: Detect memory usage patterns
- **Resource Contention**: Identify resource conflicts
- **Load Analysis**: Understand system load patterns

## Configuration and Environment Variables

### Performance Monitoring Configuration

```bash
# Enable/disable performance monitoring
APPINSIGHTS_PERFORMANCE_MONITORING_ENABLED=true
APPINSIGHTS_PERFORMANCE_MONITORING_INTERVAL=60000

# Enable specific monitoring features
APPINSIGHTS_SYSTEM_METRICS_ENABLED=true
APPINSIGHTS_REQUEST_PERFORMANCE_ENABLED=true
APPINSIGHTS_DEPENDENCY_TRACKING_ENABLED=true
APPINSIGHTS_OPERATION_TRACKING_ENABLED=true
APPINSIGHTS_RESOURCE_MONITORING_ENABLED=true
APPINSIGHTS_STARTUP_TRACKING_ENABLED=true
```

### Performance Thresholds

```bash
# Performance categorization thresholds
APPINSIGHTS_SLOW_REQUEST_THRESHOLD=1000
APPINSIGHTS_SLOW_DEPENDENCY_THRESHOLD=5000
APPINSIGHTS_HIGH_MEMORY_THRESHOLD=80
APPINSIGHTS_HIGH_CPU_THRESHOLD=80
```

### Sampling Configuration

```bash
# Control telemetry volume and costs
APPINSIGHTS_PERFORMANCE_SAMPLING_PERCENTAGE=100
APPINSIGHTS_SYSTEM_METRICS_SAMPLING_PERCENTAGE=10
```

## Dashboard and Visualization

### Azure Application Insights Dashboards

#### Performance Overview Dashboard
- **Response Time Trends**: Request performance over time
- **Throughput Metrics**: Requests per second and volume
- **Error Rates**: Success/failure rates and trends
- **Resource Utilization**: CPU, memory, and system metrics

#### Dependency Monitoring Dashboard
- **Dependency Map**: Visual service dependency map
- **Dependency Performance**: Response times and availability
- **Failure Analysis**: Dependency failure patterns
- **Service Health**: External service health status

#### System Health Dashboard
- **Resource Metrics**: CPU, memory, and disk utilization
- **Performance Trends**: System performance over time
- **Capacity Planning**: Resource usage forecasting
- **Alert Status**: Current alert status and history

### Custom Queries

#### Performance Analysis Queries

```kusto
// Average response time by endpoint
RequestPerformance
| where timestamp > ago(24h)
| summarize avg(duration), count() by url
| order by avg_duration desc

// System resource utilization trends
ResourceUtilization
| where timestamp > ago(7d)
| summarize avg(memoryUsagePercent), avg(loadAverage1m) by bin(timestamp, 1h)
| render timechart

// Dependency performance analysis
dependencies
| where timestamp > ago(24h)
| summarize avg(duration), success_rate = avg(toint(success)) by target
| order by avg_duration desc
```

#### Business Intelligence Queries

```kusto
// Operation performance by user
OperationPerformance
| where timestamp > ago(24h)
| summarize avg(duration), count() by userId, operationName
| order by count_ desc

// System performance correlation
SystemPerformance
| join ResourceUtilization on timestamp
| where timestamp > ago(24h)
| project timestamp, heapUsagePercent, memoryUsagePercent, loadAverage1m
| render scatterchart
```

### Alert Configuration

#### Performance Alerts
- **High Response Time**: Average response time > 2000ms
- **Low Throughput**: Requests per minute < threshold
- **High Error Rate**: Error rate > 5%
- **Dependency Failure**: Dependency availability < 95%

#### Resource Alerts
- **High Memory Usage**: Memory usage > 85%
- **High CPU Usage**: CPU load > 80% of capacity
- **Low Disk Space**: Available disk space < 10%
- **System Overload**: Load average > 150% of CPU count

#### Business Alerts
- **Operation Failure**: Critical operation failure rate > 1%
- **Performance Degradation**: Operation performance degraded > 50%
- **User Impact**: User-facing errors > threshold
- **Service Availability**: Service availability < 99%

## Testing and Validation

### Performance Monitoring Tests

Run the comprehensive test suite:

```bash
# Test all performance monitoring functionality
npm run test:performance-monitoring

# Test specific components
npm run test:performance-monitoring system      # System performance
npm run test:performance-monitoring request     # Request performance
npm run test:performance-monitoring dependency  # Dependency tracking
npm run test:performance-monitoring operation   # Operation tracking
npm run test:performance-monitoring lifecycle   # Monitoring lifecycle
npm run test:performance-monitoring startup     # Startup performance
npm run test:performance-monitoring load        # Performance under load
```

### Test Categories

#### Function Availability Tests
- Performance monitoring functions availability
- Telemetry function validation
- Configuration option testing
- Integration point validation

#### System Performance Tests
- System metrics collection
- Resource utilization tracking
- Performance snapshot generation
- Pressure indicator calculation

#### Request Performance Tests
- Request timing accuracy
- Category classification
- User context tracking
- Performance metric calculation

#### Dependency Tracking Tests
- Dependency call tracking
- Error handling validation
- Performance categorization
- Availability calculation

#### Operation Performance Tests
- Custom operation tracking
- Success/failure handling
- Context preservation
- Concurrent operation support

#### Lifecycle Tests
- Monitoring start/stop
- Configuration respect
- Resource cleanup
- Graceful shutdown

#### Load Testing
- High-volume operation tracking
- Memory usage under load
- Performance characteristics
- Resource efficiency

### Validation Checklist

- [ ] All performance monitoring functions available
- [ ] System performance tracking working
- [ ] Request performance monitoring active
- [ ] Dependency tracking functional
- [ ] Operation performance tracking working
- [ ] Resource utilization monitoring active
- [ ] Startup performance tracking working
- [ ] Performance snapshots generating
- [ ] Monitoring lifecycle functional
- [ ] Configuration options respected
- [ ] Performance under load acceptable
- [ ] Memory usage within limits
- [ ] Graceful shutdown working
- [ ] Dashboard queries functional
- [ ] Alerts configured and working

## Best Practices

### Performance Optimization

#### Monitoring Frequency
- **Production**: 60-300 seconds for system metrics
- **Development**: 10-60 seconds for detailed monitoring
- **Debugging**: 5-10 seconds for troubleshooting
- **Load Testing**: 1-5 seconds for performance analysis

#### Sampling Strategy
- **High-Volume Systems**: 1-10% sampling for cost control
- **Medium-Volume Systems**: 10-50% sampling for balance
- **Low-Volume Systems**: 50-100% sampling for completeness
- **Critical Operations**: 100% sampling for reliability

#### Resource Management
- **Memory Monitoring**: Track memory usage and prevent leaks
- **CPU Monitoring**: Monitor CPU usage and prevent overload
- **Network Monitoring**: Track network usage and bandwidth
- **Disk Monitoring**: Monitor disk usage and I/O performance

### Troubleshooting

#### Common Issues

1. **High Memory Usage**
   ```
   Symptom: Increasing memory consumption over time
   Solution: Check for memory leaks, optimize sampling, review telemetry volume
   ```

2. **Performance Impact**
   ```
   Symptom: Application performance degradation
   Solution: Reduce monitoring frequency, optimize telemetry processing
   ```

3. **Missing Metrics**
   ```
   Symptom: Performance data not appearing
   Solution: Check configuration, verify Application Insights connection
   ```

4. **High Costs**
   ```
   Symptom: Unexpected Application Insights costs
   Solution: Implement sampling, optimize telemetry volume, review retention
   ```

### Production Deployment

#### Environment Configuration
```bash
# Production settings
APPINSIGHTS_PERFORMANCE_MONITORING_ENABLED=true
APPINSIGHTS_PERFORMANCE_MONITORING_INTERVAL=300000  # 5 minutes
APPINSIGHTS_PERFORMANCE_SAMPLING_PERCENTAGE=10      # 10% sampling
APPINSIGHTS_SYSTEM_METRICS_SAMPLING_PERCENTAGE=5    # 5% sampling
```

#### Monitoring Strategy
- **Start Conservative**: Begin with lower sampling rates
- **Monitor Costs**: Track Application Insights usage and costs
- **Adjust Gradually**: Increase monitoring based on needs
- **Optimize Continuously**: Regular review and optimization

#### Alerting Strategy
- **Critical Alerts**: Immediate notification for critical issues
- **Warning Alerts**: Proactive notification for potential issues
- **Information Alerts**: Trend analysis and capacity planning
- **Escalation**: Automated escalation for unresolved issues

## Integration Examples

### Express Middleware Integration

```javascript
// Automatic request performance monitoring
app.use(appInsights.createExpressMiddleware());

// Custom operation tracking
app.post('/api/process', async (req, res) => {
  const result = await appInsights.performanceMonitoring.trackOperation(
    'DataProcessing',
    async () => {
      return await processData(req.body);
    },
    {
      userId: req.user.id,
      dataSize: JSON.stringify(req.body).length
    }
  );
  
  res.json(result);
});
```

### Dependency Tracking Integration

```javascript
// OpenAI API call with dependency tracking
const completion = await appInsights.performanceMonitoring.trackDependencyCall(
  'OpenAI API',
  'HTTP',
  async () => {
    return await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: messages
    });
  },
  {
    command: 'chat.completions.create',
    model: 'gpt-4.1',
    messageLength: messages.length
  }
);
```

### System Monitoring Integration

```javascript
// Periodic system monitoring
const monitoringInterval = appInsights.performanceMonitoring.startMonitoring(60000);

// Graceful shutdown
process.on('SIGTERM', () => {
  appInsights.performanceMonitoring.stopMonitoring(monitoringInterval);
  appInsights.flush();
});
```

## Conclusion

The performance monitoring and dependency tracking system provides comprehensive insights into TaktMate's operational characteristics, enabling:

- **Proactive Performance Management**: Identify and address performance issues before they impact users
- **Resource Optimization**: Optimize resource utilization and capacity planning
- **Dependency Reliability**: Monitor and ensure external service reliability
- **Business Intelligence**: Track operational KPIs and business metrics
- **Cost Management**: Control monitoring costs through intelligent sampling
- **Scalability Planning**: Plan for growth and scale requirements

The system is designed to be production-ready, cost-effective, and scalable for enterprise deployments while providing actionable insights for continuous improvement.

## Support and Resources

- **Application Insights Performance Monitoring**: https://docs.microsoft.com/en-us/azure/azure-monitor/app/performance-counters
- **Dependency Tracking**: https://docs.microsoft.com/en-us/azure/azure-monitor/app/asp-net-dependencies
- **Custom Metrics**: https://docs.microsoft.com/en-us/azure/azure-monitor/app/api-custom-events-metrics
- **TaktMate Support**: support@taktmate.com
- **Internal Documentation**: `/docs/` directory

## Changelog

### Version 2.0.0
- Complete performance monitoring and dependency tracking implementation
- Comprehensive system resource monitoring
- Advanced request performance tracking
- Automatic dependency tracking with error handling
- Custom operation performance monitoring
- Production-ready configuration and optimization
- Full testing and validation suite
