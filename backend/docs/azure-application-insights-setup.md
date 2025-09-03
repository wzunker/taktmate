# Azure Application Insights Setup Guide for TaktMate

## Overview

This guide provides step-by-step instructions for setting up Azure Application Insights to monitor the TaktMate backend application. Application Insights provides comprehensive monitoring, performance tracking, error detection, and user analytics.

## Prerequisites

- Azure subscription with appropriate permissions
- Azure CLI or Azure Portal access
- Resource Group for TaktMate resources
- Basic understanding of Azure services

## Step 1: Create Application Insights Resource

### Option A: Using Azure Portal

1. **Navigate to Azure Portal**
   - Go to [https://portal.azure.com](https://portal.azure.com)
   - Sign in with your Azure account

2. **Create Application Insights Resource**
   - Click "Create a resource" (+)
   - Search for "Application Insights"
   - Select "Application Insights" from Microsoft
   - Click "Create"

3. **Configure Basic Settings**
   ```
   Subscription: [Your Azure Subscription]
   Resource Group: taktmate-resources (create new if needed)
   Name: taktmate-app-insights
   Region: East US (or your preferred region)
   Resource Mode: Classic (recommended for Node.js)
   ```

4. **Review and Create**
   - Review your configuration
   - Click "Create"
   - Wait for deployment to complete

### Option B: Using Azure CLI

```bash
# Set variables
RESOURCE_GROUP="taktmate-resources"
APP_INSIGHTS_NAME="taktmate-app-insights"
LOCATION="eastus"
SUBSCRIPTION_ID="your-subscription-id"

# Create resource group (if it doesn't exist)
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create Application Insights resource
az monitor app-insights component create \
  --app $APP_INSIGHTS_NAME \
  --location $LOCATION \
  --resource-group $RESOURCE_GROUP \
  --application-type web \
  --kind web

# Get the connection string
az monitor app-insights component show \
  --app $APP_INSIGHTS_NAME \
  --resource-group $RESOURCE_GROUP \
  --query connectionString \
  --output tsv
```

### Option C: Using ARM Template

Create `application-insights-template.json`:

```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "applicationInsightsName": {
      "type": "string",
      "defaultValue": "taktmate-app-insights",
      "metadata": {
        "description": "Name of the Application Insights resource"
      }
    },
    "location": {
      "type": "string",
      "defaultValue": "[resourceGroup().location]",
      "metadata": {
        "description": "Location for the Application Insights resource"
      }
    },
    "applicationType": {
      "type": "string",
      "defaultValue": "web",
      "allowedValues": [
        "web",
        "other"
      ],
      "metadata": {
        "description": "Type of application being monitored"
      }
    }
  },
  "resources": [
    {
      "type": "Microsoft.Insights/components",
      "apiVersion": "2020-02-02",
      "name": "[parameters('applicationInsightsName')]",
      "location": "[parameters('location')]",
      "kind": "[parameters('applicationType')]",
      "properties": {
        "Application_Type": "[parameters('applicationType')]",
        "Flow_Type": "Redfield",
        "Request_Source": "rest",
        "RetentionInDays": 90,
        "WorkspaceResourceId": "",
        "IngestionMode": "ApplicationInsights",
        "publicNetworkAccessForIngestion": "Enabled",
        "publicNetworkAccessForQuery": "Enabled"
      }
    }
  ],
  "outputs": {
    "applicationInsightsName": {
      "type": "string",
      "value": "[parameters('applicationInsightsName')]"
    },
    "connectionString": {
      "type": "string",
      "value": "[reference(resourceId('Microsoft.Insights/components', parameters('applicationInsightsName'))).ConnectionString]"
    },
    "instrumentationKey": {
      "type": "string",
      "value": "[reference(resourceId('Microsoft.Insights/components', parameters('applicationInsightsName'))).InstrumentationKey]"
    }
  }
}
```

Deploy the template:

```bash
az deployment group create \
  --resource-group taktmate-resources \
  --template-file application-insights-template.json \
  --parameters applicationInsightsName=taktmate-app-insights
```

## Step 2: Retrieve Connection Information

### Get Connection String (Recommended)

**Using Azure Portal:**
1. Navigate to your Application Insights resource
2. Go to "Overview" section
3. Copy the "Connection String"

**Using Azure CLI:**
```bash
az monitor app-insights component show \
  --app taktmate-app-insights \
  --resource-group taktmate-resources \
  --query connectionString \
  --output tsv
```

### Get Instrumentation Key (Legacy)

**Using Azure Portal:**
1. Navigate to your Application Insights resource
2. Go to "Overview" section
3. Copy the "Instrumentation Key"

**Using Azure CLI:**
```bash
az monitor app-insights component show \
  --app taktmate-app-insights \
  --resource-group taktmate-resources \
  --query instrumentationKey \
  --output tsv
```

## Step 3: Configure Environment Variables

Add the following environment variables to your `.env` file:

```bash
# Application Insights Configuration (Required)
APPLICATIONINSIGHTS_CONNECTION_STRING="InstrumentationKey=your-instrumentation-key;IngestionEndpoint=https://eastus-8.in.applicationinsights.azure.com/;LiveEndpoint=https://eastus.livediagnostics.monitor.azure.com/"

# Alternative: Instrumentation Key (Legacy - use connection string instead)
# APPINSIGHTS_INSTRUMENTATIONKEY="your-instrumentation-key"

# Cloud Role Configuration
APPINSIGHTS_CLOUD_ROLE="taktmate-backend"
APPINSIGHTS_CLOUD_ROLE_INSTANCE="taktmate-backend-${HOSTNAME}-${PID}"

# Sampling Configuration
APPINSIGHTS_SAMPLING_PERCENTAGE=100
APPINSIGHTS_MAX_SAMPLES_PER_SECOND=20

# Feature Toggles
APPINSIGHTS_ENABLE_LIVE_METRICS=true
APPINSIGHTS_ENABLE_CUSTOM_TELEMETRY=true
APPINSIGHTS_ENABLE_USER_TRACKING=true
APPINSIGHTS_ENABLE_BUSINESS_METRICS=true
APPINSIGHTS_ENABLE_SECURITY_MONITORING=true

# Auto-Collection Settings
APPINSIGHTS_AUTO_COLLECT_REQUESTS=true
APPINSIGHTS_AUTO_COLLECT_PERFORMANCE=true
APPINSIGHTS_AUTO_COLLECT_EXCEPTIONS=true
APPINSIGHTS_AUTO_COLLECT_DEPENDENCIES=true
APPINSIGHTS_AUTO_COLLECT_CONSOLE=true
APPINSIGHTS_AUTO_COLLECT_HEARTBEAT=true

# Performance Settings
APPINSIGHTS_USE_DISK_RETRY_CACHING=true
APPINSIGHTS_RESEND_INTERVAL=60000
APPINSIGHTS_MAX_BYTES_ON_DISK=52428800

# Debug Settings (Development Only)
APPINSIGHTS_DEBUG_LOGGING=false
APPINSIGHTS_VERBOSE_LOGGING=false

# Azure Resource Information
AZURE_SUBSCRIPTION_ID="your-subscription-id"
AZURE_RESOURCE_GROUP="taktmate-resources"
AZURE_REGION="eastus"

# Application Information
APP_VERSION="2.0.0"
DEPLOYMENT_ID="deploy-$(date +%s)"
```

## Step 4: Verify Configuration

### Test Connection

Run the backend application and check the logs for successful initialization:

```bash
npm start
```

Look for:
```
✅ Application Insights initialized successfully
   Cloud Role: taktmate-backend
   Environment: development
   Version: 2.0.0
   Sampling: 100%
   Live Metrics: Enabled
```

### Test Telemetry

Make a few API requests to generate telemetry:

```bash
# Health check
curl http://localhost:3001/health

# Test authentication (should fail)
curl http://localhost:3001/api/files

# Upload a file (with authentication)
curl -X POST http://localhost:3001/upload \
  -H "Authorization: Bearer your-jwt-token" \
  -F "csvFile=@sample.csv"
```

### Verify in Azure Portal

1. Navigate to your Application Insights resource
2. Go to "Live Metrics" to see real-time data
3. Check "Overview" for request and performance metrics
4. Review "Logs" for custom telemetry events

## Step 5: Configure Advanced Features

### Live Metrics Authentication

For production environments, secure Live Metrics:

1. **Generate API Key:**
   - In Application Insights, go to "API Access"
   - Click "Create API Key"
   - Select "Authenticate SDK control channel"
   - Copy the generated key

2. **Add to Environment:**
   ```bash
   APPINSIGHTS_LIVE_METRICS_API_KEY="your-api-key"
   ```

### Custom Dashboards

Create custom dashboards for TaktMate metrics:

1. **Navigate to Dashboards:**
   - In Azure Portal, go to "Dashboard"
   - Click "New dashboard"

2. **Add TaktMate Tiles:**
   - Request count and response times
   - Authentication success/failure rates
   - File upload metrics
   - Chat interaction analytics
   - Error rates and exceptions

3. **Sample Dashboard Configuration:**
   ```json
   {
     "title": "TaktMate Application Monitoring",
     "tiles": [
       {
         "type": "requests",
         "title": "API Requests",
         "timeRange": "PT1H"
       },
       {
         "type": "customMetric",
         "title": "Authentication Success Rate",
         "metric": "AuthenticationSuccess"
       },
       {
         "type": "customMetric",
         "title": "File Uploads",
         "metric": "FileUpload"
       },
       {
         "type": "exceptions",
         "title": "Application Errors",
         "timeRange": "PT1H"
       }
     ]
   }
   ```

### Alerts and Notifications

Set up alerts for critical metrics:

1. **Authentication Failure Alert:**
   ```bash
   az monitor metrics alert create \
     --name "TaktMate Auth Failures" \
     --resource-group taktmate-resources \
     --scopes "/subscriptions/{subscription-id}/resourceGroups/taktmate-resources/providers/Microsoft.Insights/components/taktmate-app-insights" \
     --condition "count customMetrics/AuthenticationFailure > 5" \
     --window-size 5m \
     --evaluation-frequency 1m \
     --severity 2
   ```

2. **High Error Rate Alert:**
   ```bash
   az monitor metrics alert create \
     --name "TaktMate High Error Rate" \
     --resource-group taktmate-resources \
     --scopes "/subscriptions/{subscription-id}/resourceGroups/taktmate-resources/providers/Microsoft.Insights/components/taktmate-app-insights" \
     --condition "percentage requests/failed > 10" \
     --window-size 5m \
     --evaluation-frequency 1m \
     --severity 1
   ```

3. **Response Time Alert:**
   ```bash
   az monitor metrics alert create \
     --name "TaktMate Slow Response" \
     --resource-group taktmate-resources \
     --scopes "/subscriptions/{subscription-id}/resourceGroups/taktmate-resources/providers/Microsoft.Insights/components/taktmate-app-insights" \
     --condition "average requests/duration > 2000" \
     --window-size 5m \
     --evaluation-frequency 1m \
     --severity 3
   ```

## Step 6: Production Configuration

### Security Considerations

1. **Network Access:**
   - Configure firewall rules if needed
   - Use private endpoints for enhanced security
   - Restrict public network access if required

2. **Data Retention:**
   - Configure appropriate retention periods
   - Set up data export for long-term storage
   - Implement data purging policies

3. **Access Control:**
   - Use Azure RBAC for resource access
   - Implement least privilege access
   - Regular access reviews

### Performance Optimization

1. **Sampling Configuration:**
   ```bash
   # Production sampling (reduce costs)
   APPINSIGHTS_SAMPLING_PERCENTAGE=10
   APPINSIGHTS_MAX_SAMPLES_PER_SECOND=5
   ```

2. **Selective Collection:**
   ```bash
   # Disable console collection in production
   APPINSIGHTS_AUTO_COLLECT_CONSOLE=false
   
   # Reduce heartbeat frequency
   APPINSIGHTS_AUTO_COLLECT_HEARTBEAT=false
   ```

3. **Disk Caching:**
   ```bash
   # Optimize for production
   APPINSIGHTS_USE_DISK_RETRY_CACHING=true
   APPINSIGHTS_MAX_BYTES_ON_DISK=104857600  # 100MB
   ```

### Monitoring and Alerting

1. **Key Metrics to Monitor:**
   - Request rate and response times
   - Authentication success/failure rates
   - File upload success rates
   - Error rates and exceptions
   - Dependency call performance
   - User activity patterns

2. **Alert Thresholds:**
   - Error rate > 5%
   - Response time > 2 seconds
   - Authentication failures > 10/minute
   - Dependency failures > 2%
   - Memory usage > 80%

## Step 7: Integration with CI/CD

### Azure DevOps Integration

Add Application Insights to your pipeline:

```yaml
# azure-pipelines.yml
variables:
  appInsightsConnectionString: $(APPLICATIONINSIGHTS_CONNECTION_STRING)

steps:
- task: AzureCLI@2
  displayName: 'Configure Application Insights'
  inputs:
    azureSubscription: 'Azure-Subscription'
    scriptType: 'bash'
    scriptLocation: 'inlineScript'
    inlineScript: |
      # Set Application Insights connection string
      az webapp config appsettings set \
        --name taktmate-backend \
        --resource-group taktmate-resources \
        --settings APPLICATIONINSIGHTS_CONNECTION_STRING="$(appInsightsConnectionString)"
```

### GitHub Actions Integration

```yaml
# .github/workflows/deploy.yml
- name: Configure Application Insights
  run: |
    az webapp config appsettings set \
      --name taktmate-backend \
      --resource-group taktmate-resources \
      --settings APPLICATIONINSIGHTS_CONNECTION_STRING="${{ secrets.APPLICATIONINSIGHTS_CONNECTION_STRING }}"
```

## Step 8: Testing and Validation

### Automated Testing

Create tests to validate Application Insights integration:

```bash
# Run Application Insights tests
npm run test:app-insights

# Validate telemetry
npm run test:telemetry

# Check configuration
npm run test:app-insights-config
```

### Manual Validation

1. **Check Live Metrics:**
   - Navigate to Live Metrics in Azure Portal
   - Verify real-time data flow
   - Check for errors or warnings

2. **Review Telemetry:**
   - Check custom events in Logs
   - Verify user tracking
   - Validate business metrics

3. **Test Alerts:**
   - Trigger test conditions
   - Verify alert notifications
   - Check alert resolution

## Troubleshooting

### Common Issues

1. **Connection String Not Working:**
   - Verify connection string format
   - Check network connectivity
   - Validate resource permissions

2. **No Telemetry Data:**
   - Check sampling configuration
   - Verify initialization logs
   - Check firewall settings

3. **High Costs:**
   - Adjust sampling percentage
   - Review data retention settings
   - Optimize telemetry collection

4. **Performance Impact:**
   - Reduce sampling rate
   - Disable unnecessary collection
   - Use async telemetry sending

### Debug Commands

```bash
# Check Application Insights status
curl http://localhost:3001/api/status

# Validate configuration
node -e "console.log(require('./backend/config/applicationInsights').getConfigurationStatus())"

# Test telemetry
node -e "
const { telemetry } = require('./backend/config/applicationInsights');
telemetry.trackEvent('TestEvent', { test: 'true' });
console.log('Test event sent');
"
```

### Log Analysis

Common log patterns to look for:

```bash
# Successful initialization
✅ Application Insights initialized successfully

# Configuration issues
⚠️  Application Insights not configured - skipping initialization

# Connection problems
❌ Failed to initialize Application Insights: connection error

# Telemetry sending
🔧 Application Insights setup with connection string
```

## Cost Optimization

### Data Volume Management

1. **Sampling Strategy:**
   - Development: 100% sampling
   - Staging: 50% sampling
   - Production: 10-20% sampling

2. **Data Types:**
   - Prioritize errors and exceptions
   - Reduce request telemetry in high-traffic scenarios
   - Limit custom event frequency

3. **Retention Policies:**
   - Set appropriate retention periods
   - Use continuous export for archival
   - Implement data lifecycle management

### Cost Monitoring

Set up cost alerts:

```bash
az consumption budget create \
  --resource-group taktmate-resources \
  --budget-name "ApplicationInsights-Budget" \
  --amount 100 \
  --category cost \
  --time-grain monthly \
  --time-period start-date=2024-01-01 \
  --notifications \
    enabled=true \
    operator=GreaterThan \
    threshold=80 \
    contact-emails="admin@taktmate.com"
```

## Next Steps

After completing the Application Insights setup:

1. **Configure Custom Dashboards** - Create TaktMate-specific monitoring views
2. **Set Up Alerts** - Implement proactive monitoring and notifications
3. **Integrate with DevOps** - Add monitoring to deployment pipelines
4. **User Analytics** - Implement user behavior tracking
5. **Performance Optimization** - Use insights to optimize application performance

## Support and Resources

- **Azure Application Insights Documentation:** https://docs.microsoft.com/en-us/azure/azure-monitor/app/app-insights-overview
- **Node.js SDK Documentation:** https://docs.microsoft.com/en-us/azure/azure-monitor/app/nodejs
- **TaktMate Support:** support@taktmate.com
- **Azure Support:** https://azure.microsoft.com/support/

## Changelog

### Version 2.0.0
- Comprehensive Application Insights setup guide
- Advanced configuration options
- Production optimization guidelines
- Security and compliance considerations
- Cost optimization strategies
