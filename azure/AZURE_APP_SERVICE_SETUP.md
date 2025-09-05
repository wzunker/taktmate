# Azure App Service Setup Guide for TaktMate Backend API

## Overview
This guide provides comprehensive instructions for deploying the TaktMate backend API using Azure App Service, including automated CI/CD, Application Insights integration, auto-scaling, and production-ready configuration.

## 🏗️ Architecture Overview

### Azure App Service Benefits
- **Managed Platform**: No server management required
- **Auto-scaling**: Automatic scaling based on demand
- **Built-in Security**: SSL/TLS, authentication, and network security
- **CI/CD Integration**: GitHub Actions and Azure DevOps support
- **Application Insights**: Built-in monitoring and diagnostics
- **Custom Domains**: Support for custom domains with SSL
- **Deployment Slots**: Blue-green deployments and testing

### TaktMate Backend Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    Azure App Service                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────┐ │
│  │   Node.js API   │  │  Express Server  │  │   Middleware│ │
│  │  (TaktMate)     │  │   (Port 8080)    │  │   (Auth)    │ │
│  └─────────────────┘  └──────────────────┘  └─────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────┐ │
│  │   Load Balancer │  │   Auto-scaling   │  │  SSL/TLS    │ │
│  │   (Built-in)    │  │   (CPU/Memory)   │  │  (Managed)  │ │
│  └─────────────────┘  └──────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│          Application Insights + Log Analytics               │
│          Microsoft Entra External ID + OpenAI Integration                 │
└─────────────────────────────────────────────────────────────┘
```

## 📋 Prerequisites

### Required Tools
- **Azure CLI**: Latest version
- **Azure Subscription**: With contributor access
- **GitHub Account**: Repository access with Actions
- **Node.js**: 18.x LTS
- **Git**: For repository management

### Required Services
- **Microsoft Entra External ID**: Authentication provider
- **OpenAI**: API access for chat functionality
- **GitHub**: Repository hosting and CI/CD

## 🚀 Quick Start

### 1. Clone Repository
```bash
git clone https://github.com/your-org/taktmate.git
cd taktmate
```

### 2. Test Backend Locally
```bash
cd backend
npm install
npm test
npm start
```

### 3. Deploy to Azure
```bash
cd ../azure
./deploy-app-service.sh production
```

## 📁 File Structure

### Azure Configuration Files
```
azure/
├── app-service-template.json                 # ARM template
├── app-service-parameters-production.json    # Production config
├── app-service-parameters-staging.json       # Staging config
├── deploy-app-service.sh                     # Bash deployment script
├── deploy-app-service.ps1                    # PowerShell deployment script
├── test-app-service.sh                       # Testing and validation script
└── AZURE_APP_SERVICE_SETUP.md               # This documentation

.github/workflows/
└── azure-app-service.yml                    # GitHub Actions CI/CD workflow
```

## 🛠️ Deployment Methods

### Method 1: ARM Template Deployment

#### Using Azure CLI (Linux/macOS)
```bash
# Navigate to azure directory
cd azure

# Make script executable
chmod +x deploy-app-service.sh

# Deploy production environment
./deploy-app-service.sh production taktmate-prod-rg your-subscription-id

# Deploy staging environment
./deploy-app-service.sh staging taktmate-staging-rg your-subscription-id
```

#### Using PowerShell (Windows)
```powershell
# Navigate to azure directory
cd azure

# Deploy production environment
.\deploy-app-service.ps1 -Environment "production" -ResourceGroup "taktmate-prod-rg" -SubscriptionId "your-subscription-id"

# Deploy staging environment
.\deploy-app-service.ps1 -Environment "staging" -ResourceGroup "taktmate-staging-rg" -SubscriptionId "your-subscription-id"
```

#### Manual ARM Template Deployment
```bash
# Create resource group
az group create --name taktmate-prod-rg --location "East US 2"

# Deploy template
az deployment group create \
  --resource-group taktmate-prod-rg \
  --template-file app-service-template.json \
  --parameters @app-service-parameters-production.json
```

### Method 2: GitHub Actions (Automated)

The GitHub Actions workflow automatically deploys on:
- **Push to main**: Production deployment
- **Push to develop**: Staging deployment
- **Pull Requests**: Build and test only

#### Required GitHub Secrets
```
# Azure App Service
AZURE_WEBAPP_NAME_PRODUCTION=taktmate-api-prod
AZURE_WEBAPP_PUBLISH_PROFILE_PRODUCTION=<publish-profile-xml>
AZURE_WEBAPP_NAME_STAGING=taktmate-api-staging
AZURE_WEBAPP_PUBLISH_PROFILE_STAGING=<publish-profile-xml>

# API URLs for testing
PRODUCTION_API_URL=https://taktmate-api-prod.azurewebsites.net
STAGING_API_URL=https://taktmate-api-staging.azurewebsites.net
```

## ⚙️ Configuration Details

### App Service Configuration

#### Runtime Settings
```json
{
  "linuxFxVersion": "NODE|18-lts",
  "alwaysOn": true,
  "http20Enabled": true,
  "minTlsVersion": "1.2",
  "ftpsState": "Disabled",
  "healthCheckPath": "/api/health"
}
```

#### Application Settings
```bash
NODE_ENV=production
PORT=8080
APPLICATIONINSIGHTS_CONNECTION_STRING=<auto-configured>
WEBSITE_NODE_DEFAULT_VERSION=~18
SCM_DO_BUILD_DURING_DEPLOYMENT=true
ENABLE_ORYX_BUILD=true
```

#### Auto-scaling Rules
```json
{
  "profiles": [
    {
      "capacity": { "minimum": "1", "maximum": "5", "default": "1" },
      "rules": [
        {
          "metricTrigger": {
            "metricName": "CpuPercentage",
            "operator": "GreaterThan",
            "threshold": 70
          },
          "scaleAction": { "direction": "Increase", "value": "1" }
        }
      ]
    }
  ]
}
```

### Application Insights Integration

#### Automatic Configuration
- **Connection String**: Automatically configured
- **Instrumentation Key**: Available in app settings
- **Telemetry**: Custom telemetry from backend code
- **Dependencies**: OpenAI API and Microsoft Entra External ID tracking

#### Custom Telemetry
```javascript
// Already implemented in backend code
appInsights.telemetry.trackFileUpload(metadata);
appInsights.telemetry.trackChatInteraction(interaction);
appInsights.telemetry.trackCSVParsing(parsingData);
```

## 🌐 Environment Configuration

### Production Environment
```json
{
  "appServiceName": "taktmate-api-prod",
  "skuName": "P1v3",
  "skuCapacity": 2,
  "enableAutoScale": true,
  "customDomainName": "api.taktmate.com"
}
```

### Staging Environment
```json
{
  "appServiceName": "taktmate-api-staging",
  "skuName": "B2",
  "skuCapacity": 1,
  "enableAutoScale": false,
  "customDomainName": "api-staging.taktmate.com"
}
```

### Environment Variables

#### Production
```bash
# Microsoft Entra External ID Configuration
AZURE_AD_B2C_TENANT_NAME=taktmate.onmicrosoft.com
AZURE_AD_B2C_CLIENT_ID=production-client-id
AZURE_AD_B2C_CLIENT_SECRET=production-client-secret
AZURE_AD_B2C_POLICY_NAME=B2C_1_signupsignin

# OpenAI Configuration
OPENAI_API_KEY=production-openai-key
OPENAI_API_ENDPOINT=https://taktmate-openai-prod.openai.azure.com/

# CORS Configuration
ALLOWED_ORIGINS=https://app.taktmate.com

# Application Insights (auto-configured)
APPLICATIONINSIGHTS_CONNECTION_STRING=InstrumentationKey=...
```

#### Staging
```bash
# Microsoft Entra External ID Configuration
AZURE_AD_B2C_TENANT_NAME=taktmate-staging.onmicrosoft.com
AZURE_AD_B2C_CLIENT_ID=staging-client-id
AZURE_AD_B2C_CLIENT_SECRET=staging-client-secret
AZURE_AD_B2C_POLICY_NAME=B2C_1_signupsignin

# OpenAI Configuration
OPENAI_API_KEY=staging-openai-key
OPENAI_API_ENDPOINT=https://taktmate-openai-staging.openai.azure.com/

# CORS Configuration
ALLOWED_ORIGINS=https://staging.taktmate.com
```

## 🔒 Security Configuration

### Built-in Security Features
- **HTTPS Only**: Enforced at App Service level
- **TLS 1.2+**: Minimum TLS version requirement
- **FTPS Disabled**: Secure file transfer only
- **Always On**: Prevents cold starts
- **Health Checks**: Automatic health monitoring

### Custom Security Headers
```javascript
// Implemented in backend security middleware
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
});
```

### CORS Configuration
```javascript
// Configured for specific origins
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
```

## 📊 Monitoring and Diagnostics

### Application Insights Metrics
- **Request Performance**: Response times and throughput
- **Dependency Tracking**: OpenAI API and Microsoft Entra External ID calls
- **Custom Events**: File uploads, chat interactions, CSV processing
- **Error Tracking**: Exceptions and failed requests
- **User Analytics**: Session tracking and user flows

### Health Monitoring
```bash
# Health endpoint
GET /api/health

# Response
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "version": "1.0.0",
  "environment": "production",
  "dependencies": {
    "openai": "healthy",
    "azureAdB2C": "healthy"
  }
}
```

### Log Analytics
- **Application Logs**: Custom logging from backend
- **HTTP Logs**: Request/response logging
- **Failed Request Tracing**: Detailed error analysis
- **Deployment Logs**: CI/CD pipeline logs

## 🧪 Testing Strategy

### Automated Testing
```bash
# Run comprehensive tests
./test-app-service.sh production https://taktmate-api-prod.azurewebsites.net

# Test categories
- Basic connectivity and health checks
- Security headers and HTTPS enforcement
- API endpoint functionality
- Authentication and authorization
- Performance and response times
- Application Insights integration
- Error handling and rate limiting
```

### Load Testing
```javascript
// K6 load testing script (included in CI/CD)
export let options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 10 },
    { duration: '30s', target: 0 },
  ],
};
```

### Security Testing
- **SAST Scanning**: GitHub Super Linter
- **Dependency Scanning**: npm audit
- **Vulnerability Assessment**: Automated security checks

## 🚀 Deployment Slots and Blue-Green Deployment

### Deployment Slots Configuration
```bash
# Create staging slot
az webapp deployment slot create \
  --name taktmate-api-prod \
  --resource-group taktmate-prod-rg \
  --slot staging

# Deploy to staging slot
az webapp deployment source config \
  --name taktmate-api-prod \
  --resource-group taktmate-prod-rg \
  --slot staging \
  --repo-url https://github.com/your-org/taktmate \
  --branch develop
```

### Slot Swapping
```bash
# Swap staging to production
az webapp deployment slot swap \
  --name taktmate-api-prod \
  --resource-group taktmate-prod-rg \
  --slot staging \
  --target-slot production
```

## 🔧 Troubleshooting

### Common Issues

#### Deployment Failures
```bash
# Check deployment logs
az webapp log deployment show --name taktmate-api-prod --resource-group taktmate-prod-rg

# Stream application logs
az webapp log tail --name taktmate-api-prod --resource-group taktmate-prod-rg
```

#### Performance Issues
```bash
# Check App Service metrics
az monitor metrics list \
  --resource /subscriptions/{subscription}/resourceGroups/taktmate-prod-rg/providers/Microsoft.Web/sites/taktmate-api-prod \
  --metric CpuPercentage,MemoryPercentage,HttpResponseTime

# Scale up if needed
az appservice plan update \
  --name taktmate-api-plan-prod \
  --resource-group taktmate-prod-rg \
  --sku P2v3
```

#### SSL Certificate Issues
```bash
# Check SSL binding
az webapp config ssl list --resource-group taktmate-prod-rg

# Add custom domain
az webapp config hostname add \
  --webapp-name taktmate-api-prod \
  --resource-group taktmate-prod-rg \
  --hostname api.taktmate.com
```

### Debug Commands
```bash
# App Service details
az webapp show --name taktmate-api-prod --resource-group taktmate-prod-rg

# Configuration settings
az webapp config appsettings list --name taktmate-api-prod --resource-group taktmate-prod-rg

# Connection strings
az webapp config connection-string list --name taktmate-api-prod --resource-group taktmate-prod-rg
```

## 📈 Performance Optimization

### App Service Plan Sizing
```bash
# Production: P1v3 (2 cores, 8GB RAM)
# Staging: B2 (2 cores, 3.5GB RAM)
# Development: F1 (1 core, 1GB RAM) - Free tier
```

### Caching Strategy
```javascript
// Implemented in backend
app.use('/api', cache('5 minutes')); // API response caching
app.use('/static', cache('1 day'));  // Static asset caching
```

### Database Connection Pooling
```javascript
// Connection pooling for external services
const pool = new Pool({
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

## 🚀 Production Deployment Checklist

### Pre-Deployment
- [ ] Code review completed
- [ ] Tests passing locally and in CI
- [ ] Environment variables configured
- [ ] Microsoft Entra External ID settings updated
- [ ] OpenAI API keys configured
- [ ] Custom domain DNS configured

### Deployment
- [ ] ARM template validated
- [ ] Resource group created
- [ ] App Service deployed successfully
- [ ] Application Insights configured
- [ ] Auto-scaling rules enabled
- [ ] GitHub Actions configured

### Post-Deployment
- [ ] Health endpoint responding
- [ ] API endpoints functional
- [ ] Authentication working
- [ ] CORS configured correctly
- [ ] SSL certificate valid
- [ ] Monitoring alerts configured
- [ ] Performance baseline established
- [ ] Documentation updated

## 📚 Additional Resources

### Documentation
- [Azure App Service Documentation](https://docs.microsoft.com/en-us/azure/app-service/)
- [Application Insights for Node.js](https://docs.microsoft.com/en-us/azure/azure-monitor/app/nodejs)
- [GitHub Actions for Azure](https://docs.microsoft.com/en-us/azure/developer/github/)

### Tools
- [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/)
- [Azure Resource Manager](https://docs.microsoft.com/en-us/azure/azure-resource-manager/)
- [GitHub Actions](https://docs.github.com/en/actions)

### Support
- **Azure Support**: Create support ticket in Azure portal
- **GitHub Issues**: Repository issue tracker
- **Documentation**: Team wiki and documentation

This comprehensive setup provides a production-ready deployment pipeline for the TaktMate backend API using Azure App Service with automated CI/CD, comprehensive monitoring, security best practices, and scalability features.
