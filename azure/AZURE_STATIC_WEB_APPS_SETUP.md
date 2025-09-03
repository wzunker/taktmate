# Azure Static Web Apps Setup Guide for TaktMate Frontend

## Overview
This guide provides comprehensive instructions for deploying the TaktMate frontend application using Azure Static Web Apps, including automated CI/CD, custom domains, and production-ready configuration.

## 🏗️ Architecture Overview

### Azure Static Web Apps Benefits
- **Global CDN**: Automatic global content distribution
- **Built-in CI/CD**: GitHub Actions integration
- **Custom Domains**: Free SSL certificates
- **Staging Environments**: Pull request previews
- **Authentication**: Built-in Azure AD integration
- **API Integration**: Serverless function support
- **Free Tier**: No cost for small applications

### TaktMate Frontend Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    Azure Static Web Apps                    │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────┐ │
│  │   React App     │  │   Static Assets  │  │   Routing   │ │
│  │  (TaktMate UI)  │  │  (CSS, Images)   │  │   Config    │ │
│  └─────────────────┘  └──────────────────┘  └─────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────┐ │
│  │   Azure CDN     │  │   SSL/TLS Cert   │  │  Custom     │ │
│  │  (Global Edge)  │  │  (Automatic)     │  │  Domain     │ │
│  └─────────────────┘  └──────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend API (Azure App Service)          │
│                    Azure AD B2C Authentication              │
└─────────────────────────────────────────────────────────────┘
```

## 📋 Prerequisites

### Required Tools
- **Azure CLI**: Latest version
- **Azure Subscription**: With contributor access
- **GitHub Account**: Repository access
- **Node.js**: 18.x or later
- **Git**: For repository management

### Required Permissions
- **Azure**: Contributor role on subscription
- **GitHub**: Admin access to repository
- **Domain**: DNS management (for custom domains)

## 🚀 Quick Start

### 1. Clone Repository
```bash
git clone https://github.com/your-org/taktmate.git
cd taktmate
```

### 2. Install Dependencies
```bash
cd frontend
npm install
```

### 3. Build and Test
```bash
npm run build
npm test
```

### 4. Deploy to Azure
```bash
cd ../azure
./deploy-static-web-app.sh production
```

## 📁 File Structure

### Azure Configuration Files
```
azure/
├── static-web-app-template.json          # ARM template
├── static-web-app-parameters-production.json # Production config
├── static-web-app-parameters-staging.json    # Staging config
├── deploy-static-web-app.sh             # Bash deployment script
├── setup-static-web-app.ps1             # PowerShell deployment script
└── AZURE_STATIC_WEB_APPS_SETUP.md       # This documentation

frontend/
├── staticwebapp.config.json             # Static Web App configuration
└── .github/
    └── workflows/
        └── azure-static-web-apps.yml    # GitHub Actions workflow
```

## 🛠️ Deployment Methods

### Method 1: ARM Template Deployment

#### Using Azure CLI (Linux/macOS)
```bash
# Navigate to azure directory
cd azure

# Make script executable
chmod +x deploy-static-web-app.sh

# Deploy production environment
./deploy-static-web-app.sh production taktmate-prod-rg your-subscription-id

# Deploy staging environment
./deploy-static-web-app.sh staging taktmate-staging-rg your-subscription-id
```

#### Using PowerShell (Windows)
```powershell
# Navigate to azure directory
cd azure

# Deploy production environment
.\setup-static-web-app.ps1 -Environment "production" -ResourceGroup "taktmate-prod-rg" -SubscriptionId "your-subscription-id"

# Deploy staging environment
.\setup-static-web-app.ps1 -Environment "staging" -ResourceGroup "taktmate-staging-rg" -SubscriptionId "your-subscription-id"
```

#### Manual ARM Template Deployment
```bash
# Create resource group
az group create --name taktmate-prod-rg --location "East US 2"

# Deploy template
az deployment group create \
  --resource-group taktmate-prod-rg \
  --template-file static-web-app-template.json \
  --parameters @static-web-app-parameters-production.json
```

### Method 2: Azure Portal Deployment

1. **Navigate to Azure Portal**
   - Go to [portal.azure.com](https://portal.azure.com)
   - Search for "Static Web Apps"

2. **Create New Static Web App**
   - Click "+ Create"
   - Select subscription and resource group
   - Enter app name: `taktmate-frontend-prod`
   - Choose "GitHub" as deployment source

3. **Configure GitHub Integration**
   - Authorize GitHub access
   - Select repository: `your-org/taktmate`
   - Select branch: `main`
   - App location: `/frontend`
   - Output location: `build`

4. **Review and Create**
   - Verify configuration
   - Click "Create"

### Method 3: GitHub Actions (Automated)

The GitHub Actions workflow automatically deploys on:
- **Push to main**: Production deployment
- **Push to develop**: Staging deployment
- **Pull Requests**: Preview deployments

## ⚙️ Configuration Details

### Static Web App Configuration (`staticwebapp.config.json`)

#### Routing Configuration
```json
{
  "routes": [
    {
      "route": "/login",
      "serve": "/index.html"
    },
    {
      "route": "/*",
      "serve": "/index.html",
      "statusCode": 200
    }
  ]
}
```

#### Security Headers
```json
{
  "globalHeaders": {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' https://login.microsoftonline.com"
  }
}
```

#### Environment Variables
```json
{
  "environmentVariables": [
    "REACT_APP_AZURE_AD_B2C_CLIENT_ID",
    "REACT_APP_AZURE_AD_B2C_AUTHORITY",
    "REACT_APP_API_BASE_URL"
  ]
}
```

### GitHub Actions Workflow

#### Trigger Configuration
```yaml
on:
  push:
    branches: [main, develop]
    paths: ['frontend/**']
  pull_request:
    branches: [main]
    paths: ['frontend/**']
```

#### Build Process
```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '18.x'
    cache: 'npm'

- name: Install dependencies
  run: |
    cd frontend
    npm ci

- name: Run tests
  run: |
    cd frontend
    npm test -- --coverage --watchAll=false

- name: Build application
  run: |
    cd frontend
    npm run build
```

## 🌐 Custom Domain Configuration

### DNS Configuration
For custom domain `app.taktmate.com`:

1. **Add CNAME Record**
   ```
   Type: CNAME
   Name: app
   Value: [generated-static-web-app-domain].azurestaticapps.net
   TTL: 3600
   ```

2. **Verify Domain**
   - Azure will automatically validate domain ownership
   - SSL certificate will be provisioned automatically

### Domain Validation
```bash
# Check domain status
az staticwebapp hostname show \
  --name taktmate-frontend-prod \
  --hostname app.taktmate.com
```

## 🔒 Security Configuration

### Authentication Integration
Static Web Apps integrates with Azure AD B2C:

1. **Configure Redirect URLs**
   ```
   Production: https://app.taktmate.com
   Staging: https://staging.taktmate.com
   ```

2. **Update Azure AD B2C Settings**
   - Add redirect URLs in Azure AD B2C app registration
   - Configure logout URLs
   - Update CORS settings

### Content Security Policy
```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval' 
  https://login.microsoftonline.com 
  https://*.b2clogin.com;
connect-src 'self' 
  https://login.microsoftonline.com 
  https://*.b2clogin.com 
  https://your-backend-api.azurewebsites.net;
```

## 📊 Monitoring and Analytics

### Application Insights Integration
```javascript
// Frontend Application Insights configuration
import { ApplicationInsights } from '@microsoft/applicationinsights-web';

const appInsights = new ApplicationInsights({
  config: {
    instrumentationKey: 'your-instrumentation-key',
    enableAutoRouteTracking: true,
    enableCorsCorrelation: true
  }
});
```

### Performance Monitoring
- **Core Web Vitals**: Lighthouse CI integration
- **Real User Monitoring**: Application Insights
- **Uptime Monitoring**: Azure Monitor
- **Custom Metrics**: Business KPIs

## 🧪 Testing Strategy

### Local Testing
```bash
# Install dependencies
cd frontend
npm install

# Run tests
npm test

# Build and serve locally
npm run build
npx serve -s build -p 3000
```

### Staging Environment Testing
```bash
# Deploy to staging
./deploy-static-web-app.sh staging

# Test staging deployment
curl -I https://staging.taktmate.com
```

### Production Validation
```bash
# Check production deployment
curl -I https://app.taktmate.com

# Validate SSL certificate
openssl s_client -connect app.taktmate.com:443 -servername app.taktmate.com
```

## 📋 Environment Configuration

### Production Environment
```json
{
  "staticWebAppName": "taktmate-frontend-prod",
  "customDomainName": "app.taktmate.com",
  "branch": "main",
  "environment": "Production"
}
```

### Staging Environment
```json
{
  "staticWebAppName": "taktmate-frontend-staging", 
  "customDomainName": "staging.taktmate.com",
  "branch": "develop",
  "environment": "Staging"
}
```

### Environment Variables

#### Production
```bash
REACT_APP_AZURE_AD_B2C_CLIENT_ID=prod-client-id
REACT_APP_AZURE_AD_B2C_AUTHORITY=https://taktmate.b2clogin.com/taktmate.onmicrosoft.com/B2C_1_signupsignin
REACT_APP_API_BASE_URL=https://taktmate-api-prod.azurewebsites.net
REACT_APP_REDIRECT_URI=https://app.taktmate.com
```

#### Staging
```bash
REACT_APP_AZURE_AD_B2C_CLIENT_ID=staging-client-id
REACT_APP_AZURE_AD_B2C_AUTHORITY=https://taktmate-staging.b2clogin.com/taktmate-staging.onmicrosoft.com/B2C_1_signupsignin
REACT_APP_API_BASE_URL=https://taktmate-api-staging.azurewebsites.net
REACT_APP_REDIRECT_URI=https://staging.taktmate.com
```

## 🔧 Troubleshooting

### Common Issues

#### Build Failures
```bash
# Check Node.js version
node --version  # Should be 18.x

# Clear npm cache
npm cache clean --force

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

#### Deployment Failures
```bash
# Check Azure CLI login
az account show

# Verify resource group
az group show --name taktmate-prod-rg

# Check deployment status
az deployment group show --name [deployment-name] --resource-group taktmate-prod-rg
```

#### Custom Domain Issues
```bash
# Check DNS propagation
nslookup app.taktmate.com

# Verify CNAME record
dig CNAME app.taktmate.com

# Check SSL certificate
curl -I https://app.taktmate.com
```

### Debug Commands
```bash
# View Static Web App details
az staticwebapp show --name taktmate-frontend-prod

# List custom domains
az staticwebapp hostname list --name taktmate-frontend-prod

# Get deployment token
az staticwebapp secrets list --name taktmate-frontend-prod
```

## 📈 Performance Optimization

### Build Optimization
```json
{
  "scripts": {
    "build": "GENERATE_SOURCEMAP=false react-scripts build",
    "build:analyze": "npm run build && npx bundle-analyzer build/static/js/*.js"
  }
}
```

### Caching Strategy
```json
{
  "globalHeaders": {
    "Cache-Control": "public, max-age=31536000, immutable"
  },
  "routes": [
    {
      "route": "/static/**",
      "headers": {
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    }
  ]
}
```

### CDN Optimization
- **Automatic**: Azure CDN included
- **Global**: Edge locations worldwide
- **Compression**: Gzip/Brotli enabled
- **Minification**: Build process optimization

## 🚀 Deployment Checklist

### Pre-Deployment
- [ ] Code review completed
- [ ] Tests passing
- [ ] Build successful
- [ ] Environment variables configured
- [ ] Azure AD B2C settings updated

### Deployment
- [ ] ARM template validated
- [ ] Resource group created
- [ ] Static Web App deployed
- [ ] GitHub Actions configured
- [ ] Deployment token secured

### Post-Deployment
- [ ] Custom domain configured
- [ ] SSL certificate verified
- [ ] DNS records updated
- [ ] Azure AD B2C redirect URLs updated
- [ ] Application functionality tested
- [ ] Performance metrics baseline
- [ ] Monitoring alerts configured

## 📚 Additional Resources

### Documentation
- [Azure Static Web Apps Documentation](https://docs.microsoft.com/en-us/azure/static-web-apps/)
- [GitHub Actions for Static Web Apps](https://docs.microsoft.com/en-us/azure/static-web-apps/github-actions-workflow)
- [Custom Domains in Static Web Apps](https://docs.microsoft.com/en-us/azure/static-web-apps/custom-domain)

### Tools
- [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/)
- [Azure Resource Manager](https://docs.microsoft.com/en-us/azure/azure-resource-manager/)
- [GitHub Actions](https://docs.github.com/en/actions)

### Support
- **Azure Support**: Create support ticket in Azure portal
- **GitHub Issues**: Repository issue tracker
- **Documentation**: Team wiki and documentation

This comprehensive setup provides a production-ready deployment pipeline for the TaktMate frontend using Azure Static Web Apps with automated CI/CD, security best practices, and monitoring capabilities.
