# Azure Key Vault Setup Guide for TaktMate

## Overview
This guide provides comprehensive instructions for deploying and managing Azure Key Vault for secure API key management in the TaktMate application, including automated deployment, secret management, and App Service integration.

## 🔐 Key Vault Benefits

### Security Features
- **Hardware Security Modules (HSM)**: Premium tier supports HSM-backed keys
- **Access Control**: Fine-grained access policies and RBAC
- **Audit Logging**: Complete audit trail of all operations
- **Network Security**: Virtual network integration and firewall rules
- **Soft Delete**: Protection against accidental deletion
- **Purge Protection**: Additional protection for critical secrets

### Integration Benefits
- **Managed Identity**: Seamless integration with Azure services
- **App Service Integration**: Direct secret references in configuration
- **Automatic Rotation**: Support for secret rotation policies
- **Versioning**: Automatic versioning of secrets
- **Backup/Restore**: Built-in backup and restore capabilities

## 🏗️ Architecture Overview

### TaktMate Key Vault Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    Azure Key Vault                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────┐ │
│  │   API Keys      │  │   Certificates   │  │  Encryption │ │
│  │  - OpenAI       │  │  - SSL Certs     │  │    Keys     │ │
│  │  - Azure AD B2C │  │  - Auth Certs    │  │  - JWT      │ │
│  └─────────────────┘  └──────────────────┘  └─────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────┐ │
│  │ Access Policies │  │   Audit Logs     │  │   Network   │ │
│  │ - App Service   │  │  - All Access    │  │   Security  │ │
│  │ - Administrators│  │  - Changes       │  │  - Firewall │ │
│  └─────────────────┘  └──────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│          App Service (Managed Identity)                    │
│          Backend API (KeyVault Integration)                │
└─────────────────────────────────────────────────────────────┘
```

## 📋 Prerequisites

### Required Tools
- **Azure CLI**: Latest version
- **Azure Subscription**: With Key Vault permissions
- **PowerShell/Bash**: For deployment scripts
- **Node.js**: For backend integration
- **jq**: For JSON processing (Linux/macOS)

### Required Permissions
- **Key Vault Contributor**: To create and manage Key Vault
- **Key Vault Administrator**: To manage access policies
- **Application Developer**: To configure App Service integration

## 🚀 Quick Start

### 1. Deploy Key Vault
```bash
cd azure
./deploy-key-vault.sh production taktmate-prod-rg your-subscription-id your-admin-object-id taktmate-api-prod
```

### 2. Update Secrets
```bash
./manage-secrets.sh set production OpenAI-API-Key "your-openai-key"
./manage-secrets.sh set production Azure-AD-B2C-Client-ID "your-b2c-client-id"
```

### 3. Test Integration
```bash
./test-key-vault.sh production
```

## 📁 File Structure

### Azure Configuration Files
```
azure/
├── key-vault-template.json                   # ARM template
├── key-vault-parameters-production.json      # Production config
├── key-vault-parameters-staging.json         # Staging config
├── deploy-key-vault.sh                       # Bash deployment script
├── deploy-key-vault.ps1                      # PowerShell deployment script
├── manage-secrets.sh                         # Secret management utility
├── test-key-vault.sh                         # Testing and validation script
└── AZURE_KEY_VAULT_SETUP.md                 # This documentation

backend/config/
└── keyVault.js                              # Node.js Key Vault integration
```

## 🛠️ Deployment Methods

### Method 1: Automated Deployment Script

#### Using Bash (Linux/macOS)
```bash
# Navigate to azure directory
cd azure

# Make script executable
chmod +x deploy-key-vault.sh

# Deploy production environment
./deploy-key-vault.sh production taktmate-prod-rg your-subscription-id your-admin-object-id taktmate-api-prod

# Deploy staging environment
./deploy-key-vault.sh staging taktmate-staging-rg your-subscription-id your-admin-object-id taktmate-api-staging
```

#### Using PowerShell (Windows)
```powershell
# Navigate to azure directory
cd azure

# Deploy production environment
.\deploy-key-vault.ps1 -Environment "production" -ResourceGroup "taktmate-prod-rg" -SubscriptionId "your-subscription-id" -AdminObjectId "your-object-id" -AppServiceName "taktmate-api-prod"

# Deploy staging environment
.\deploy-key-vault.ps1 -Environment "staging" -ResourceGroup "taktmate-staging-rg" -SubscriptionId "your-subscription-id" -AdminObjectId "your-object-id" -AppServiceName "taktmate-api-staging"
```

#### Script Features
- **Automatic Identity Setup**: Enables App Service managed identity
- **Access Policy Configuration**: Sets up proper permissions
- **App Service Integration**: Configures Key Vault references
- **Validation**: Tests deployment and access
- **Error Handling**: Comprehensive error checking and rollback

### Method 2: Manual ARM Template Deployment
```bash
# Create resource group
az group create --name taktmate-prod-rg --location "East US 2"

# Get your object ID
ADMIN_OBJECT_ID=$(az ad signed-in-user show --query "id" -o tsv)

# Deploy template
az deployment group create \
  --resource-group taktmate-prod-rg \
  --template-file key-vault-template.json \
  --parameters @key-vault-parameters-production.json \
  --parameters administratorObjectId=$ADMIN_OBJECT_ID
```

## ⚙️ Configuration Details

### Key Vault Configuration

#### Security Settings
```json
{
  "enableSoftDelete": true,
  "enablePurgeProtection": true,
  "softDeleteRetentionInDays": 90,
  "enabledForTemplateDeployment": true,
  "publicNetworkAccess": "Enabled"
}
```

#### Access Policies
```json
{
  "accessPolicies": [
    {
      "tenantId": "your-tenant-id",
      "objectId": "admin-object-id",
      "permissions": {
        "secrets": ["get", "list", "set", "delete", "recover", "backup", "restore"],
        "keys": ["all"],
        "certificates": ["all"]
      }
    },
    {
      "tenantId": "your-tenant-id",
      "objectId": "app-service-principal-id",
      "permissions": {
        "secrets": ["get", "list"],
        "keys": [],
        "certificates": ["get", "list"]
      }
    }
  ]
}
```

### Secrets Configuration

#### Predefined Secrets
```bash
# OpenAI Configuration
OpenAI-API-Key                    # OpenAI API key
OpenAI-API-Endpoint              # Azure OpenAI endpoint URL

# Azure AD B2C Configuration
Azure-AD-B2C-Client-ID           # B2C application client ID
Azure-AD-B2C-Client-Secret       # B2C application client secret
Azure-AD-B2C-Tenant-Name         # B2C tenant name
Azure-AD-B2C-Policy-Name         # B2C policy name (default: B2C_1_signupsignin)

# Security Keys (Auto-generated)
JWT-Secret                       # JWT signing secret
Session-Secret                   # Session encryption secret
Encryption-Key                   # General encryption key

# Database Configuration
Database-Connection-String       # Database connection string (if applicable)
```

#### App Service Integration
```bash
# Environment variables automatically configured
OPENAI_API_KEY=@Microsoft.KeyVault(VaultName=taktmate-kv-prod;SecretName=OpenAI-API-Key)
AZURE_AD_B2C_CLIENT_ID=@Microsoft.KeyVault(VaultName=taktmate-kv-prod;SecretName=Azure-AD-B2C-Client-ID)
JWT_SECRET=@Microsoft.KeyVault(VaultName=taktmate-kv-prod;SecretName=JWT-Secret)
```

## 🔧 Secret Management

### Using the Management Script

#### Set Secrets
```bash
# Set OpenAI API key
./manage-secrets.sh set production OpenAI-API-Key "your-openai-api-key"

# Set Azure AD B2C configuration
./manage-secrets.sh set production Azure-AD-B2C-Client-ID "your-client-id"
./manage-secrets.sh set production Azure-AD-B2C-Client-Secret "your-client-secret"
./manage-secrets.sh set production Azure-AD-B2C-Tenant-Name "your-tenant.onmicrosoft.com"
```

#### Get Secrets
```bash
# Get a specific secret
./manage-secrets.sh get production OpenAI-API-Key

# List all secrets
./manage-secrets.sh list production
```

#### Rotate Secrets
```bash
# Rotate auto-generated secrets
./manage-secrets.sh rotate production JWT-Secret
./manage-secrets.sh rotate production Session-Secret
./manage-secrets.sh rotate production Encryption-Key
```

#### Backup and Restore
```bash
# Backup all secrets
./manage-secrets.sh backup production /path/to/backup.json

# Restore from backup
./manage-secrets.sh restore production /path/to/backup.json
```

### Using Azure CLI Directly
```bash
# Set secret
az keyvault secret set --vault-name taktmate-kv-prod --name "OpenAI-API-Key" --value "your-key"

# Get secret
az keyvault secret show --vault-name taktmate-kv-prod --name "OpenAI-API-Key" --query "value" -o tsv

# List secrets
az keyvault secret list --vault-name taktmate-kv-prod --output table

# Delete secret
az keyvault secret delete --vault-name taktmate-kv-prod --name "secret-name"
```

## 💻 Backend Integration

### Node.js Key Vault Service

#### Basic Usage
```javascript
const { keyVault } = require('./config/keyVault');

// Get a single secret
const openaiKey = await keyVault.getSecret('OpenAI-API-Key');

// Get multiple secrets
const secrets = await keyVault.getSecrets([
  'OpenAI-API-Key',
  'Azure-AD-B2C-Client-ID',
  'JWT-Secret'
]);

// Get application configuration
const config = await keyVault.getAppConfig();
console.log(config.openai.apiKey);
```

#### Advanced Features
```javascript
// Check if Key Vault is available
const isAvailable = await keyVault.isAvailable();

// Validate required secrets
const validation = await keyVault.validateSecrets();
if (!validation.valid) {
  console.error('Missing secrets:', validation.missing);
}

// Rotate secrets
const rotationResult = await keyVault.rotateSecrets(['JWT-Secret']);
console.log('Rotated:', rotationResult.success);

// Clear cache
keyVault.clearCache();

// Get cache statistics
const stats = keyVault.getCacheStats();
console.log('Cache size:', stats.size);
```

### Environment Variables Integration
```javascript
// The service automatically falls back to environment variables
// if Key Vault is not available or accessible

// Priority order:
// 1. Key Vault (if available)
// 2. Environment variables
// 3. Default values (if configured)
```

## 🧪 Testing and Validation

### Automated Testing
```bash
# Run comprehensive tests
./test-key-vault.sh production

# Test categories:
# - Key Vault existence and accessibility
# - Permission validation (read/write/list)
# - Required secrets validation
# - Secret value validation (no placeholders)
# - Access policies verification
# - Network access configuration
# - Performance testing
# - Backup capability testing
```

### Manual Testing
```bash
# Test secret retrieval
az keyvault secret show --vault-name taktmate-kv-prod --name "JWT-Secret"

# Test App Service access
az webapp config appsettings list --name taktmate-api-prod --resource-group taktmate-prod-rg

# Test managed identity
az webapp identity show --name taktmate-api-prod --resource-group taktmate-prod-rg
```

### Integration Testing
```javascript
// Test backend integration
const { keyVault } = require('./backend/config/keyVault');

async function testIntegration() {
  try {
    // Test basic connectivity
    const isAvailable = await keyVault.isAvailable();
    console.log('Key Vault available:', isAvailable);
    
    // Test secret retrieval
    const jwtSecret = await keyVault.getSecret('JWT-Secret');
    console.log('JWT Secret loaded:', !!jwtSecret);
    
    // Test configuration loading
    const config = await keyVault.getAppConfig();
    console.log('Config loaded:', !!config.openai.apiKey);
    
  } catch (error) {
    console.error('Integration test failed:', error.message);
  }
}
```

## 🔒 Security Best Practices

### Access Control
```bash
# Use least privilege principle
# App Service only needs 'get' and 'list' permissions for secrets
# Administrators need full permissions
# Developers should have limited access

# Enable RBAC (alternative to access policies)
az keyvault update --name taktmate-kv-prod --enable-rbac-authorization true
```

### Network Security
```bash
# Restrict network access (production)
az keyvault network-rule add \
  --vault-name taktmate-kv-prod \
  --subnet /subscriptions/sub-id/resourceGroups/rg-name/providers/Microsoft.Network/virtualNetworks/vnet-name/subnets/subnet-name

# Set default deny
az keyvault update \
  --name taktmate-kv-prod \
  --default-action Deny
```

### Monitoring and Auditing
```bash
# Enable diagnostic logging
az monitor diagnostic-settings create \
  --name "KeyVault-Diagnostics" \
  --resource "/subscriptions/sub-id/resourceGroups/rg-name/providers/Microsoft.KeyVault/vaults/taktmate-kv-prod" \
  --logs '[{"category":"AuditEvent","enabled":true,"retentionPolicy":{"enabled":true,"days":90}}]' \
  --workspace "/subscriptions/sub-id/resourceGroups/rg-name/providers/Microsoft.OperationalInsights/workspaces/workspace-name"
```

### Secret Rotation
```bash
# Set up automated secret rotation for supported services
# Manual rotation for API keys
./manage-secrets.sh rotate production JWT-Secret

# Schedule regular rotation (recommended: every 90 days)
# Use Azure Automation or GitHub Actions for automation
```

## 🚀 Production Deployment

### Pre-Deployment Checklist
- [ ] Key Vault deployed and accessible
- [ ] All required secrets configured (no placeholders)
- [ ] App Service managed identity enabled
- [ ] Access policies configured correctly
- [ ] Network security configured (if applicable)
- [ ] Monitoring and logging enabled
- [ ] Backup strategy implemented

### Deployment Steps
1. **Deploy Key Vault**
   ```bash
   ./deploy-key-vault.sh production taktmate-prod-rg
   ```

2. **Configure Secrets**
   ```bash
   # Update all placeholder values
   ./manage-secrets.sh set production OpenAI-API-Key "real-key"
   ./manage-secrets.sh set production Azure-AD-B2C-Client-ID "real-client-id"
   ```

3. **Verify Integration**
   ```bash
   ./test-key-vault.sh production
   ```

4. **Test Application**
   ```bash
   # Verify App Service can access secrets
   curl https://taktmate-api-prod.azurewebsites.net/api/health
   ```

### Post-Deployment
- Monitor Key Vault access logs
- Set up alerts for failed access attempts
- Implement secret rotation schedule
- Document secret management procedures
- Train team on secret management practices

## 🔧 Troubleshooting

### Common Issues

#### Access Denied Errors
```bash
# Check access policies
az keyvault show --name taktmate-kv-prod --query "properties.accessPolicies"

# Verify managed identity
az webapp identity show --name taktmate-api-prod --resource-group taktmate-prod-rg

# Re-enable managed identity if needed
az webapp identity assign --name taktmate-api-prod --resource-group taktmate-prod-rg
```

#### Secret Not Found
```bash
# List all secrets
az keyvault secret list --vault-name taktmate-kv-prod

# Check secret versions
az keyvault secret list-versions --vault-name taktmate-kv-prod --name "secret-name"

# Verify secret value
az keyvault secret show --vault-name taktmate-kv-prod --name "secret-name"
```

#### App Service Integration Issues
```bash
# Check App Service configuration
az webapp config appsettings list --name taktmate-api-prod --resource-group taktmate-prod-rg

# Verify Key Vault references
az webapp config appsettings set \
  --name taktmate-api-prod \
  --resource-group taktmate-prod-rg \
  --settings "TEST_SECRET=@Microsoft.KeyVault(VaultName=taktmate-kv-prod;SecretName=JWT-Secret)"

# Check application logs
az webapp log tail --name taktmate-api-prod --resource-group taktmate-prod-rg
```

### Debug Commands
```bash
# Test Key Vault connectivity
az keyvault show --name taktmate-kv-prod

# Test secret access
az keyvault secret show --vault-name taktmate-kv-prod --name "JWT-Secret" --query "value" -o tsv

# Check network connectivity
nslookup taktmate-kv-prod.vault.azure.net

# Verify permissions
az keyvault show --name taktmate-kv-prod --query "properties.accessPolicies[].permissions"
```

## 📈 Monitoring and Maintenance

### Key Metrics to Monitor
- **Secret Access Frequency**: Monitor usage patterns
- **Failed Access Attempts**: Security monitoring
- **Secret Age**: Track rotation needs
- **Performance**: Secret retrieval times
- **Availability**: Key Vault uptime

### Maintenance Tasks
```bash
# Regular secret rotation (every 90 days)
./manage-secrets.sh rotate production JWT-Secret
./manage-secrets.sh rotate production Session-Secret
./manage-secrets.sh rotate production Encryption-Key

# Backup secrets (monthly)
./manage-secrets.sh backup production "backup-$(date +%Y%m%d).json"

# Review access policies (quarterly)
az keyvault show --name taktmate-kv-prod --query "properties.accessPolicies"

# Update certificates (as needed)
az keyvault certificate import --vault-name taktmate-kv-prod --name "ssl-cert" --file certificate.pfx
```

### Alerts and Notifications
```bash
# Set up alerts for failed access attempts
az monitor metrics alert create \
  --name "KeyVault-Access-Failures" \
  --resource-group taktmate-prod-rg \
  --scopes "/subscriptions/sub-id/resourceGroups/taktmate-prod-rg/providers/Microsoft.KeyVault/vaults/taktmate-kv-prod" \
  --condition "count ServiceApiResult where ResultType != 'Success' > 10" \
  --window-size 5m \
  --evaluation-frequency 1m
```

## 📚 Additional Resources

### Documentation
- [Azure Key Vault Documentation](https://docs.microsoft.com/en-us/azure/key-vault/)
- [App Service Key Vault Integration](https://docs.microsoft.com/en-us/azure/app-service/app-service-key-vault-references)
- [Azure Key Vault SDK for Node.js](https://docs.microsoft.com/en-us/azure/key-vault/secrets/quick-create-node)

### Tools
- [Azure CLI Key Vault Commands](https://docs.microsoft.com/en-us/cli/azure/keyvault)
- [Azure PowerShell Key Vault Module](https://docs.microsoft.com/en-us/powershell/module/az.keyvault)
- [Key Vault Explorer](https://github.com/microsoft/AzureKeyVaultExplorer)

### Best Practices
- [Key Vault Security Best Practices](https://docs.microsoft.com/en-us/azure/key-vault/general/security-features)
- [Secret Management Best Practices](https://docs.microsoft.com/en-us/azure/key-vault/secrets/secrets-best-practices)
- [Key Vault Monitoring Guide](https://docs.microsoft.com/en-us/azure/key-vault/general/logging)

This comprehensive Key Vault setup provides enterprise-grade secret management with automated deployment, comprehensive testing, and production-ready security features for the TaktMate application.
