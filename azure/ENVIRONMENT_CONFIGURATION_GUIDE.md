# Environment Configuration Guide for TaktMate

## Overview
This guide provides comprehensive instructions for configuring environment variables across all deployment environments (production, staging, development) for the TaktMate application. It covers automated configuration management, validation, testing, and deployment best practices.

## 🏗️ Configuration Architecture

### Multi-Environment Strategy
```
┌─────────────────────────────────────────────────────────────┐
│                Environment Configuration Architecture        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────┐ │
│  │   Development   │  │     Staging      │  │ Production  │ │
│  │  Local/Debug    │  │  Pre-Production  │  │  Live Site  │ │
│  └─────────────────┘  └──────────────────┘  └─────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────┐ │
│  │  Configuration  │  │   Azure Key      │  │   CI/CD     │ │
│  │   Templates     │  │     Vault        │  │ Integration │ │
│  └─────────────────┘  └──────────────────┘  └─────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────┐ │
│  │   Validation    │  │     Testing      │  │ Monitoring  │ │
│  │   & Backup      │  │   & Reporting    │  │ & Alerting  │ │
│  └─────────────────┘  └──────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 📁 Configuration Structure

### File Organization
```
azure/
├── config/                          # Generated configuration files
│   ├── backend-production.env       # Backend production config
│   ├── backend-staging.env          # Backend staging config
│   ├── frontend-production.env      # Frontend production config
│   ├── frontend-staging.env         # Frontend staging config
│   ├── app-service-production.json  # App Service production config
│   ├── app-service-staging.json     # App Service staging config
│   ├── static-web-app-production.json
│   └── static-web-app-staging.json
├── backups/                         # Configuration backups
├── reports/                         # Test and validation reports
├── configure-environment-variables.sh    # Main configuration script
├── configure-environment-variables.ps1   # PowerShell version
├── test-environment-config.sh       # Configuration testing script
└── ENVIRONMENT_CONFIGURATION_GUIDE.md

backend/
├── env.production                   # Production environment template
├── env.staging                      # Staging environment template
└── env.example                      # Development template

frontend/
├── env.production                   # Frontend production template
├── env.staging                      # Frontend staging template
└── frontend-env.example             # Frontend development template
```

## 🛠️ Configuration Management Tools

### 1. Environment Configuration Script
**File**: `azure/configure-environment-variables.sh`

#### Key Features
- **Multi-environment support** (production, staging, development)
- **Automated configuration generation** from templates
- **Azure service integration** (App Service, Static Web Apps, Key Vault)
- **Validation and testing** capabilities
- **Backup and restore** functionality
- **Cross-platform support** (Bash and PowerShell versions)

#### Usage Examples
```bash
# Generate all configuration files for production
./configure-environment-variables.sh production generate --validate

# Deploy configuration to Azure services
./configure-environment-variables.sh staging deploy --backup --validate

# Validate existing configuration
./configure-environment-variables.sh production validate

# Generate with backup and validation
./configure-environment-variables.sh staging generate --backup --validate --verbose

# Dry run to preview changes
./configure-environment-variables.sh production deploy --dry-run --verbose
```

### 2. Configuration Testing Script
**File**: `azure/test-environment-config.sh`

#### Key Features
- **Comprehensive configuration testing**
- **Azure resource connectivity validation**
- **External service endpoint testing**
- **Environment consistency checks**
- **Detailed reporting and logging**
- **Issue detection and recommendations**

#### Usage Examples
```bash
# Test production environment configuration
./test-environment-config.sh production

# Comprehensive testing with detailed report
./test-environment-config.sh staging --comprehensive --report

# Test all environments
./test-environment-config.sh all --verbose

# Test with issue fixing
./test-environment-config.sh production --fix --report
```

## 🔧 Environment-Specific Configurations

### Production Environment
**Characteristics**:
- **High security** with strict CSP and HTTPS enforcement
- **Performance optimized** with caching and compression
- **Minimal logging** (warn level) for performance
- **Error details hidden** from end users
- **Advanced monitoring** and alerting enabled

**Key Settings**:
```env
NODE_ENV=production
LOG_LEVEL=warn
DEBUG=false
SECURE_COOKIES=true
FORCE_HTTPS=true
ENABLE_ERROR_REPORTING=true
SEND_ERROR_DETAILS=false
```

### Staging Environment
**Characteristics**:
- **Pre-production testing** environment
- **Enhanced debugging** capabilities
- **Feature flag testing** with experimental features
- **Detailed logging** (info level)
- **Error details visible** for debugging
- **Monitoring enabled** for validation

**Key Settings**:
```env
NODE_ENV=staging
LOG_LEVEL=info
DEBUG=false
SECURE_COOKIES=true
FORCE_HTTPS=true
ENABLE_ERROR_REPORTING=true
SEND_ERROR_DETAILS=true
ENABLE_DEBUG_ROUTES=true
```

### Development Environment
**Characteristics**:
- **Local development** focused
- **Full debugging** enabled
- **Relaxed security** for development ease
- **Verbose logging** (debug level)
- **Hot reloading** and dev tools enabled
- **Mock services** available

**Key Settings**:
```env
NODE_ENV=development
LOG_LEVEL=debug
DEBUG=true
SECURE_COOKIES=false
FORCE_HTTPS=false
ENABLE_ERROR_REPORTING=false
SEND_ERROR_DETAILS=true
```

## 🔐 Security and Secret Management

### Azure Key Vault Integration
All sensitive configuration values are stored in Azure Key Vault and referenced using the Key Vault reference syntax:

```env
# Key Vault Reference Format
SETTING_NAME=@Microsoft.KeyVault(VaultName=vault-name;SecretName=secret-name)

# Examples
OPENAI_API_KEY=@Microsoft.KeyVault(VaultName=taktmate-kv-prod;SecretName=OpenAI-API-Key)
JWT_SECRET=@Microsoft.KeyVault(VaultName=taktmate-kv-prod;SecretName=JWT-Secret)
AZURE_AD_B2C_CLIENT_SECRET=@Microsoft.KeyVault(VaultName=taktmate-kv-prod;SecretName=Azure-AD-B2C-Client-Secret)
```

### Secret Categories
1. **Authentication Secrets**: JWT secrets, session secrets, B2C client secrets
2. **External API Keys**: OpenAI API key, third-party service keys
3. **Database Credentials**: Connection strings, passwords
4. **Certificates**: SSL certificates, signing certificates
5. **Application Insights**: Connection strings, instrumentation keys

## 📋 Configuration Variables Reference

### Backend Configuration Variables

#### Azure Configuration
```env
# Azure Key Vault
AZURE_KEY_VAULT_NAME=taktmate-kv-{environment}
AZURE_KEY_VAULT_URL=https://{vault-name}.vault.azure.net/

# Application Insights
APPINSIGHTS_CONNECTION_STRING=@Microsoft.KeyVault(...)
APPINSIGHTS_INSTRUMENTATION_KEY=@Microsoft.KeyVault(...)
APPLICATIONINSIGHTS_CONNECTION_STRING=@Microsoft.KeyVault(...)
```

#### Azure AD B2C Configuration
```env
# Tenant Configuration
AZURE_AD_B2C_TENANT_NAME={tenant-name}
AZURE_AD_B2C_TENANT_ID=@Microsoft.KeyVault(...)
AZURE_AD_B2C_CLIENT_ID=@Microsoft.KeyVault(...)
AZURE_AD_B2C_CLIENT_SECRET=@Microsoft.KeyVault(...)

# Endpoints
AZURE_AD_B2C_AUTHORITY=https://{tenant}.b2clogin.com/{tenant}.onmicrosoft.com/B2C_1_SignUpSignIn
AZURE_AD_B2C_KNOWN_AUTHORITY={tenant}.b2clogin.com
AZURE_AD_B2C_DISCOVERY_ENDPOINT=https://{tenant}.b2clogin.com/{tenant}.onmicrosoft.com/B2C_1_SignUpSignIn/v2.0/.well-known/openid_configuration

# Policies
AZURE_AD_B2C_SIGNUP_SIGNIN_POLICY=B2C_1_SignUpSignIn
AZURE_AD_B2C_EDIT_PROFILE_POLICY=B2C_1_EditProfile
AZURE_AD_B2C_RESET_PASSWORD_POLICY=B2C_1_ResetPassword

# Scopes
AZURE_AD_B2C_SCOPE=https://{tenant}.onmicrosoft.com/api/read
```

#### Application Configuration
```env
# Server Configuration
NODE_ENV={environment}
PORT=3001
HOST=0.0.0.0

# CORS Configuration
CORS_ORIGIN=https://{frontend-domain}
CORS_CREDENTIALS=true

# Security Configuration
JWT_SECRET=@Microsoft.KeyVault(...)
SESSION_SECRET=@Microsoft.KeyVault(...)

# File Upload Configuration
MAX_FILE_SIZE=5242880
ALLOWED_FILE_TYPES=text/csv,application/vnd.ms-excel
UPLOAD_TIMEOUT=30000
```

#### Monitoring Configuration
```env
# Logging Configuration
LOG_LEVEL={warn|info|debug}
LOG_FORMAT=json
LOG_FILE_ENABLED=true
LOG_CONSOLE_ENABLED=true

# Application Insights Features
APPINSIGHTS_ENABLE_AUTO_COLLECT_CONSOLE=true
APPINSIGHTS_ENABLE_AUTO_COLLECT_EXCEPTIONS=true
APPINSIGHTS_ENABLE_AUTO_COLLECT_REQUESTS=true
APPINSIGHTS_ENABLE_AUTO_COLLECT_PERFORMANCE=true
APPINSIGHTS_ENABLE_AUTO_COLLECT_DEPENDENCIES=true
APPINSIGHTS_ENABLE_AUTO_COLLECT_HEARTBEAT=true
APPINSIGHTS_ENABLE_LIVE_METRICS=true
APPINSIGHTS_SAMPLING_PERCENTAGE=100

# Custom Telemetry
ENABLE_CUSTOM_TELEMETRY={true|false}
ENABLE_CSV_TELEMETRY={true|false}
ENABLE_PERFORMANCE_MONITORING={true|false}
ENABLE_ERROR_TRACKING={true|false}
ENABLE_RESOURCE_MONITORING={true|false}
```

### Frontend Configuration Variables

#### Azure AD B2C Configuration
```env
# Client Configuration
REACT_APP_AZURE_AD_B2C_CLIENT_ID=${AZURE_AD_B2C_CLIENT_ID}
REACT_APP_AZURE_AD_B2C_AUTHORITY=https://{tenant}.b2clogin.com/{tenant}.onmicrosoft.com/B2C_1_SignUpSignIn
REACT_APP_AZURE_AD_B2C_KNOWN_AUTHORITY={tenant}.b2clogin.com
REACT_APP_AZURE_AD_B2C_TENANT_NAME={tenant}

# Policies
REACT_APP_AZURE_AD_B2C_SIGNUP_SIGNIN_POLICY=B2C_1_SignUpSignIn
REACT_APP_AZURE_AD_B2C_EDIT_PROFILE_POLICY=B2C_1_EditProfile
REACT_APP_AZURE_AD_B2C_RESET_PASSWORD_POLICY=B2C_1_ResetPassword

# Scopes
REACT_APP_AZURE_AD_B2C_SCOPE=https://{tenant}.onmicrosoft.com/api/read
```

#### API Configuration
```env
# Backend API
REACT_APP_API_BASE_URL=https://{backend-domain}
REACT_APP_API_TIMEOUT=30000
REACT_APP_API_RETRY_ATTEMPTS=3
REACT_APP_API_RETRY_DELAY=1000
```

#### Authentication URLs
```env
REACT_APP_REDIRECT_URI=https://{frontend-domain}/auth/callback
REACT_APP_POST_LOGOUT_REDIRECT_URI=https://{frontend-domain}
REACT_APP_ERROR_REDIRECT_URI=https://{frontend-domain}/auth/error
```

#### Feature Flags
```env
# Core Features
REACT_APP_FEATURE_DARK_MODE={true|false}
REACT_APP_FEATURE_EXPORT_DATA={true|false}
REACT_APP_FEATURE_SHARE_RESULTS={true|false}
REACT_APP_FEATURE_ADVANCED_FILTERS={true|false}
REACT_APP_FEATURE_REAL_TIME_UPDATES={true|false}

# Experimental Features (staging/development)
REACT_APP_FEATURE_BETA_UI={true|false}
REACT_APP_FEATURE_EXPERIMENTAL_CHARTS={true|false}
REACT_APP_FEATURE_ADVANCED_SEARCH={true|false}
```

## 🚀 Deployment Integration

### GitHub Actions Integration
Environment variables are automatically configured during CI/CD deployment:

```yaml
# .github/workflows/deploy-full-stack.yml
- name: Set Environment Variables
  run: |
    cd azure
    ./configure-environment-variables.sh ${{ needs.setup.outputs.environment }} generate --validate
    
- name: Deploy Configuration
  run: |
    cd azure
    ./configure-environment-variables.sh ${{ needs.setup.outputs.environment }} deploy --backup
```

### Azure DevOps Integration
```yaml
# azure-pipelines.yml
- script: |
    cd azure
    chmod +x configure-environment-variables.sh
    ./configure-environment-variables.sh $(environment) generate --validate
  displayName: 'Generate Environment Configuration'

- script: |
    cd azure
    ./configure-environment-variables.sh $(environment) deploy --backup
  displayName: 'Deploy Environment Configuration'
```

### Manual Deployment
```bash
# Step-by-step manual deployment
cd azure

# 1. Generate configuration files
./configure-environment-variables.sh production generate --validate

# 2. Review generated files
ls -la config/

# 3. Deploy to Azure services
./configure-environment-variables.sh production deploy --backup --validate

# 4. Test configuration
./test-environment-config.sh production --comprehensive --report
```

## 🧪 Testing and Validation

### Automated Testing
The configuration testing script performs comprehensive validation:

#### File Validation
- **Configuration file existence** and syntax
- **Required variable presence** and format
- **JSON syntax validation** for Azure service configs
- **Key Vault reference validation**

#### Azure Resource Validation
- **Azure CLI authentication** status
- **Resource group existence** and accessibility
- **Key Vault access** and secret availability
- **App Service status** and configuration
- **Static Web App** deployment status

#### External Service Validation
- **OpenAI API connectivity** (if comprehensive testing enabled)
- **Azure AD B2C endpoint** availability
- **Discovery endpoint** validation

#### Environment Consistency
- **Cross-service variable consistency** (backend vs frontend)
- **Environment-specific value validation**
- **Tenant name consistency** across services

### Test Report Generation
```bash
# Generate comprehensive test report
./test-environment-config.sh production --comprehensive --report

# Report location
ls -la azure/reports/environment-test-report-production-*.json
```

### Example Test Report
```json
{
  "environment": "production",
  "timestamp": "2024-01-15T10:30:00Z",
  "summary": {
    "total_tests": 25,
    "passed": 23,
    "failed": 1,
    "warnings": 1,
    "success_rate": 92.0
  },
  "tests": [
    {
      "test": "Backend Config File Exists",
      "status": "PASS",
      "message": "File found at config/backend-production.env",
      "environment": "production",
      "timestamp": "2024-01-15T10:30:01Z"
    }
  ]
}
```

## 🔄 Configuration Management Workflows

### Development Workflow
```bash
# 1. Create/update configuration templates
vim backend/env.development
vim frontend/env.development

# 2. Generate configuration files
./configure-environment-variables.sh development generate

# 3. Test locally
npm run dev

# 4. Validate configuration
./test-environment-config.sh development
```

### Staging Deployment Workflow
```bash
# 1. Generate staging configuration
./configure-environment-variables.sh staging generate --validate

# 2. Deploy to staging services
./configure-environment-variables.sh staging deploy --backup

# 3. Run comprehensive tests
./test-environment-config.sh staging --comprehensive --report

# 4. Validate deployment
curl https://api-staging.taktmate.com/api/health
```

### Production Deployment Workflow
```bash
# 1. Backup current configuration
./configure-environment-variables.sh production backup

# 2. Generate production configuration
./configure-environment-variables.sh production generate --validate

# 3. Deploy with validation
./configure-environment-variables.sh production deploy --backup --validate

# 4. Comprehensive testing
./test-environment-config.sh production --comprehensive --report

# 5. Monitor deployment
# Check Application Insights dashboards
# Verify health endpoints
```

## 🚨 Troubleshooting

### Common Issues and Solutions

#### 1. Configuration File Not Found
**Error**: `Backend configuration file not found`
**Solution**:
```bash
# Regenerate configuration files
./configure-environment-variables.sh production generate --validate

# Check file permissions
ls -la azure/config/
```

#### 2. Azure CLI Authentication Failed
**Error**: `Azure CLI not authenticated`
**Solution**:
```bash
# Login to Azure CLI
az login

# Set correct subscription
az account set --subscription "your-subscription-id"

# Verify authentication
az account show
```

#### 3. Key Vault Access Denied
**Error**: `Cannot access Key Vault secrets`
**Solution**:
```bash
# Check Key Vault access policies
az keyvault show --name taktmate-kv-prod --query "properties.accessPolicies"

# Add access policy if needed
az keyvault set-policy --name taktmate-kv-prod --object-id YOUR_OBJECT_ID --secret-permissions get list
```

#### 4. Environment Inconsistency
**Error**: `Tenant names do not match`
**Solution**:
```bash
# Check configuration files
grep "TENANT_NAME" azure/config/backend-production.env
grep "TENANT_NAME" azure/config/frontend-production.env

# Regenerate with correct values
./configure-environment-variables.sh production generate --validate
```

#### 5. App Service Configuration Deployment Failed
**Error**: `Failed to deploy App Service configuration`
**Solution**:
```bash
# Check App Service exists
az webapp show --name taktmate-api-prod --resource-group taktmate-prod-rg

# Manual configuration update
az webapp config appsettings set --name taktmate-api-prod --resource-group taktmate-prod-rg --settings NODE_ENV=production

# Retry deployment
./configure-environment-variables.sh production deploy --force
```

### Debug Commands

#### Configuration Debugging
```bash
# List all configuration files
find azure/config -name "*.env" -o -name "*.json" | sort

# Check specific environment variables
grep -n "AZURE_AD_B2C" azure/config/backend-production.env

# Validate JSON syntax
jq empty azure/config/app-service-production.json

# Compare configurations
diff azure/config/backend-production.env azure/config/backend-staging.env
```

#### Azure Resource Debugging
```bash
# List all resources in resource group
az resource list --resource-group taktmate-prod-rg --output table

# Check App Service configuration
az webapp config show --name taktmate-api-prod --resource-group taktmate-prod-rg

# List Key Vault secrets
az keyvault secret list --vault-name taktmate-kv-prod --output table

# Check Static Web App status
az staticwebapp show --name taktmate-frontend-prod --resource-group taktmate-prod-rg
```

## 📊 Monitoring and Maintenance

### Configuration Monitoring
- **Regular validation** of environment configurations
- **Automated testing** in CI/CD pipelines
- **Configuration drift detection** between environments
- **Secret rotation** and expiration monitoring

### Maintenance Tasks
1. **Monthly configuration review** and validation
2. **Quarterly secret rotation** for sensitive values
3. **Environment consistency audits**
4. **Configuration backup verification**
5. **Access policy reviews** for Key Vault

### Best Practices
1. **Never commit secrets** to version control
2. **Use Key Vault references** for all sensitive data
3. **Validate configurations** before deployment
4. **Maintain environment consistency** across deployments
5. **Document configuration changes** and rationale
6. **Test configurations** thoroughly before production
7. **Monitor configuration** health and performance
8. **Regular backup** and restore testing

This comprehensive environment configuration system ensures secure, consistent, and maintainable deployment across all TaktMate environments while providing robust testing, validation, and troubleshooting capabilities.
