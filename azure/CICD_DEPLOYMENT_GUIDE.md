# CI/CD Deployment Guide for TaktMate

## Overview
This guide provides comprehensive instructions for setting up and managing automated CI/CD pipelines for the TaktMate application, including GitHub Actions, Azure DevOps, and manual deployment orchestration.

## 🚀 Deployment Architecture

### Multi-Environment Strategy
```
┌─────────────────────────────────────────────────────────────┐
│                    CI/CD Pipeline Architecture              │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────┐ │
│  │   Development   │  │     Staging      │  │ Production  │ │
│  │  (PR Previews)  │  │   (develop)      │  │   (main)    │ │
│  └─────────────────┘  └──────────────────┘  └─────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────┐ │
│  │  Build & Test   │  │    Security      │  │  Deploy     │ │
│  │   (All Envs)    │  │   Scanning       │  │ Components  │ │
│  └─────────────────┘  └──────────────────┘  └─────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────┐ │
│  │   Integration   │  │   Performance    │  │ Monitoring  │ │
│  │     Tests       │  │     Tests        │  │   Setup     │ │
│  └─────────────────┘  └──────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Deployment Triggers
- **Production**: Push to `main` branch
- **Staging**: Push to `develop` branch  
- **Preview**: Pull requests to `main` branch
- **Manual**: On-demand deployment via scripts

## 📋 Available CI/CD Options

### 1. GitHub Actions (Recommended)
**File**: `.github/workflows/deploy-full-stack.yml`

#### Features
- **Multi-environment support** (production, staging, preview)
- **Comprehensive testing** (frontend, backend, integration)
- **Security scanning** (CodeQL, Trivy, npm audit)
- **Infrastructure deployment** (Key Vault, App Service, Static Web Apps)
- **Service configuration** (B2C URLs, secrets management)
- **Performance testing** (k6 load testing)
- **Monitoring setup** (dashboards, alerts)
- **Deployment notifications** and summaries

#### Workflow Stages
```yaml
1. Setup → Determine environment and changes
2. Test → Frontend, backend, integration tests
3. Security → Vulnerability scanning
4. Deploy Infrastructure → Azure resources
5. Deploy Backend → App Service deployment
6. Deploy Frontend → Static Web Apps deployment
7. Integration Tests → End-to-end validation
8. Performance Tests → Load testing (production only)
9. Setup Monitoring → Dashboards and alerts
10. Notify → Deployment summary and notifications
```

### 2. Azure DevOps Pipelines
**File**: `azure-pipelines.yml`

#### Features
- **Multi-stage pipeline** with approval gates
- **Azure-native integration** with service connections
- **Comprehensive testing** and security scanning
- **Environment-specific deployments**
- **Performance testing** with detailed reporting
- **Monitoring and alerting setup**

#### Pipeline Stages
```yaml
1. BuildAndTest → Parallel build and test jobs
2. DeployInfrastructure → Azure resource deployment
3. DeployApplications → Backend and frontend deployment
4. TestAndValidate → Integration and performance tests
5. SetupMonitoring → Dashboards and alerts deployment
6. DeploymentSummary → Results and notifications
```

### 3. Manual Deployment Orchestration
**File**: `azure/deploy-full-stack.sh`

#### Features
- **Command-line deployment** with full control
- **Environment-specific configuration**
- **Flexible deployment options** (skip components)
- **Dry-run capability** for testing
- **Comprehensive logging** and reporting
- **Prerequisites validation**

## 🛠️ Setup Instructions

### GitHub Actions Setup

#### 1. Required Secrets
Configure these secrets in GitHub repository settings:

```bash
# Azure Authentication
AZURE_CREDENTIALS='{
  "clientId": "your-service-principal-client-id",
  "clientSecret": "your-service-principal-client-secret",
  "subscriptionId": "your-azure-subscription-id",
  "tenantId": "your-azure-tenant-id"
}'
AZURE_SUBSCRIPTION_ID=your-azure-subscription-id
AZURE_ADMIN_OBJECT_ID=your-admin-object-id

# Microsoft Entra External ID Configuration
B2C_APP_ID_PROD=your-production-b2c-app-id
B2C_APP_ID_STAGING=your-staging-b2c-app-id
B2C_CLIENT_ID=your-b2c-client-id
B2C_CLIENT_SECRET=your-b2c-client-secret

# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key

# Frontend Environment Variables
REACT_APP_ENTRA_EXTERNAL_ID_CLIENT_ID_PROD=your-prod-client-id
REACT_APP_ENTRA_EXTERNAL_ID_AUTHORITY_PROD=your-prod-authority
REACT_APP_ENTRA_EXTERNAL_ID_CLIENT_ID_STAGING=your-staging-client-id
REACT_APP_ENTRA_EXTERNAL_ID_AUTHORITY_STAGING=your-staging-authority

# Azure Static Web Apps
AZURE_STATIC_WEB_APPS_API_TOKEN=your-static-web-apps-token
```

#### 2. Service Principal Setup
```bash
# Create service principal for GitHub Actions
az ad sp create-for-rbac \
  --name "TaktMate-GitHub-Actions" \
  --role contributor \
  --scopes /subscriptions/YOUR_SUBSCRIPTION_ID \
  --sdk-auth

# Grant additional permissions
az role assignment create \
  --assignee YOUR_SERVICE_PRINCIPAL_ID \
  --role "Key Vault Administrator" \
  --scope /subscriptions/YOUR_SUBSCRIPTION_ID

az role assignment create \
  --assignee YOUR_SERVICE_PRINCIPAL_ID \
  --role "Application Administrator" \
  --scope /subscriptions/YOUR_SUBSCRIPTION_ID
```

#### 3. Environment Configuration
Create environment protection rules in GitHub:
- **Production**: Require approval from maintainers
- **Staging**: Auto-deploy from develop branch
- **Preview**: Auto-deploy for pull requests

### Azure DevOps Setup

#### 1. Service Connection
Create Azure Resource Manager service connection:
```
Connection Name: TaktMate-ServiceConnection
Subscription: Your Azure Subscription
Resource Group: Leave empty (pipeline will create)
```

#### 2. Variable Groups
Create variable groups for each environment:

**Production Variables**
```yaml
environment: production
resourceGroup: taktmate-prod-rg
keyVaultName: taktmate-kv-prod
appServiceName: taktmate-api-prod
frontendUrl: https://app.taktmate.com
backendUrl: https://api.taktmate.com
```

**Staging Variables**
```yaml
environment: staging
resourceGroup: taktmate-staging-rg
keyVaultName: taktmate-kv-staging
appServiceName: taktmate-api-staging
frontendUrl: https://staging.taktmate.com
backendUrl: https://api-staging.taktmate.com
```

#### 3. Library Secrets
Store sensitive values in Azure DevOps Library:
- `OPENAI_API_KEY`
- `B2C_CLIENT_ID`
- `B2C_CLIENT_SECRET`
- `AZURE_STATIC_WEB_APPS_API_TOKEN`

### Manual Deployment Setup

#### 1. Prerequisites
```bash
# Install required tools
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash  # Azure CLI
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -  # Node.js 18
sudo apt-get install -y nodejs jq curl

# Login to Azure
az login
az account set --subscription "your-subscription-id"
```

#### 2. Environment Configuration
```bash
# Set environment variables
export B2C_APP_ID="your-b2c-app-id"
export OPENAI_API_KEY="your-openai-key"
export B2C_CLIENT_ID="your-b2c-client-id"
export B2C_CLIENT_SECRET="your-b2c-client-secret"
```

## 🚀 Deployment Workflows

### GitHub Actions Deployment

#### Automatic Deployment
```bash
# Production deployment (push to main)
git checkout main
git merge develop
git push origin main

# Staging deployment (push to develop)
git checkout develop
git push origin develop

# Preview deployment (create PR)
git checkout -b feature/new-feature
git push origin feature/new-feature
# Create PR to main branch
```

#### Manual Deployment
```bash
# Trigger workflow manually
gh workflow run deploy-full-stack.yml \
  --ref main \
  --field environment=production
```

### Azure DevOps Deployment

#### Automatic Deployment
Pipelines trigger automatically on branch pushes based on branch policies.

#### Manual Deployment
```bash
# Trigger pipeline manually
az pipelines run \
  --name "TaktMate-FullStack-Deployment" \
  --branch main \
  --parameters environment=production
```

### Manual Script Deployment

#### Full Deployment
```bash
cd azure
./deploy-full-stack.sh production
```

#### Selective Deployment
```bash
# Deploy only backend
./deploy-full-stack.sh production --skip-frontend --skip-infra

# Deploy with testing disabled
./deploy-full-stack.sh staging --skip-tests

# Dry run (test without deploying)
./deploy-full-stack.sh production --dry-run

# Force deployment despite test failures
./deploy-full-stack.sh production --force
```

## 🧪 Testing Strategy

### Automated Testing Phases

#### 1. Unit Testing
```bash
# Frontend tests
cd frontend && npm test -- --coverage --watchAll=false

# Backend tests
cd backend && npm run test:all
```

#### 2. Integration Testing
```bash
# Key Vault integration
npm run test:key-vault-integration

# B2C configuration
./test-b2c-urls.sh production

# App Service health
./test-app-service.sh production
```

#### 3. Security Testing
```bash
# Dependency vulnerabilities
npm audit --audit-level=high

# Code scanning
# (Automated in CI/CD pipelines)
```

#### 4. Performance Testing
```bash
# Load testing with k6
k6 run loadtest.js

# Response time validation
curl -w "@curl-format.txt" -s -o /dev/null https://api.taktmate.com/api/health
```

### Manual Testing Checklist

#### Pre-Deployment
- [ ] All tests passing locally
- [ ] Security vulnerabilities addressed
- [ ] Environment variables configured
- [ ] Azure resources accessible

#### Post-Deployment
- [ ] Frontend loads correctly
- [ ] Backend API responds to health checks
- [ ] Authentication flow works end-to-end
- [ ] File upload and chat functionality works
- [ ] Monitoring dashboards display data
- [ ] Alerts are configured and firing appropriately

## 📊 Monitoring and Observability

### Application Insights Integration
All deployments automatically configure:
- **Custom telemetry** for application events
- **Performance monitoring** for response times
- **Error tracking** with detailed context
- **Dependency tracking** for external services

### Custom Dashboards
Deployed automatically with each environment:
- **Overview Dashboard**: High-level application health
- **Error Monitoring**: Error rates and details
- **Performance Dashboard**: Response times and throughput
- **Business Intelligence**: User activity and file processing

### Alerting Rules
Configured automatically for:
- **High error rates** (>5% in 5 minutes)
- **Slow response times** (>2s average)
- **High memory usage** (>80%)
- **Authentication failures** (>10 in 5 minutes)

## 🔧 Troubleshooting

### Common Issues

#### 1. Deployment Failures
**Symptoms**: Pipeline fails during deployment
**Solutions**:
```bash
# Check Azure CLI authentication
az account show

# Verify service principal permissions
az role assignment list --assignee YOUR_SP_ID

# Check resource group exists
az group show --name taktmate-prod-rg

# Validate ARM templates
az deployment group validate \
  --resource-group taktmate-prod-rg \
  --template-file azure/app-service-template.json \
  --parameters @azure/app-service-parameters-production.json
```

#### 2. Test Failures
**Symptoms**: Tests fail in CI/CD pipeline
**Solutions**:
```bash
# Run tests locally
cd backend && npm run test:all
cd frontend && npm test

# Check test environment configuration
cat backend/.env.test
cat frontend/.env.test

# Review test logs
cat backend/test-results/junit.xml
```

#### 3. Authentication Issues
**Symptoms**: B2C authentication fails after deployment
**Solutions**:
```bash
# Validate B2C configuration
./azure/test-b2c-urls.sh production

# Check redirect URLs
az ad app show --id YOUR_APP_ID --query "web.redirectUris"

# Verify Key Vault secrets
./azure/manage-secrets.sh validate production
```

#### 4. Performance Issues
**Symptoms**: Slow response times or timeouts
**Solutions**:
```bash
# Check App Service metrics
az monitor metrics list \
  --resource /subscriptions/SUB_ID/resourceGroups/taktmate-prod-rg/providers/Microsoft.Web/sites/taktmate-api-prod \
  --metric CpuPercentage,MemoryPercentage,HttpResponseTime

# Scale up App Service if needed
az appservice plan update \
  --name taktmate-api-plan-prod \
  --resource-group taktmate-prod-rg \
  --sku P2v3
```

### Debug Commands

#### Pipeline Debugging
```bash
# GitHub Actions
gh run list --workflow=deploy-full-stack.yml
gh run view RUN_ID --log

# Azure DevOps
az pipelines runs list --pipeline-name "TaktMate-FullStack-Deployment"
az pipelines runs show --id RUN_ID
```

#### Resource Validation
```bash
# Check all deployed resources
az resource list --resource-group taktmate-prod-rg --output table

# Validate App Service
az webapp show --name taktmate-api-prod --resource-group taktmate-prod-rg

# Check Static Web App
az staticwebapp show --name taktmate-frontend-prod --resource-group taktmate-prod-rg

# Verify Key Vault
az keyvault show --name taktmate-kv-prod
```

## 📈 Best Practices

### Security
- **Least Privilege**: Grant minimal required permissions
- **Secret Rotation**: Regularly rotate API keys and secrets
- **Environment Isolation**: Separate resources per environment
- **Audit Logging**: Enable comprehensive audit logging

### Performance
- **Caching**: Implement appropriate caching strategies
- **CDN**: Use Azure CDN for static assets
- **Auto-scaling**: Configure appropriate scaling rules
- **Monitoring**: Set up comprehensive monitoring and alerting

### Reliability
- **Health Checks**: Implement comprehensive health endpoints
- **Graceful Degradation**: Handle service failures gracefully
- **Backup Strategy**: Regular backups of critical data
- **Disaster Recovery**: Plan for disaster recovery scenarios

### Development Workflow
- **Branch Protection**: Require PR reviews and status checks
- **Automated Testing**: Comprehensive test coverage
- **Progressive Deployment**: Deploy to staging before production
- **Rollback Strategy**: Plan for quick rollbacks if needed

## 📚 Additional Resources

### Documentation
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Azure DevOps Pipelines](https://docs.microsoft.com/en-us/azure/devops/pipelines/)
- [Azure App Service Deployment](https://docs.microsoft.com/en-us/azure/app-service/deploy-continuous-deployment)
- [Azure Static Web Apps](https://docs.microsoft.com/en-us/azure/static-web-apps/)

### Tools
- [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/)
- [GitHub CLI](https://cli.github.com/)
- [k6 Load Testing](https://k6.io/docs/)
- [Azure DevOps CLI](https://docs.microsoft.com/en-us/azure/devops/cli/)

This comprehensive CI/CD setup provides enterprise-grade deployment automation with multiple deployment options, comprehensive testing, security scanning, and production-ready monitoring for the TaktMate application.
