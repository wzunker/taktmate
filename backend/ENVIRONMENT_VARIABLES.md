# TaktMate Backend Environment Variables

## Required Variables for Azure Deployment

These variables must be set in Azure App Service Application Settings:

### Azure OpenAI Configuration
- `OPENAI_API_KEY` - Your Azure OpenAI API key (from Azure Key Vault)

### Azure Blob Storage Configuration
- `STORAGE_ACCOUNT_NAME` - Name of the Azure Storage Account (e.g., 'taktmateblob')
  - Used by the storage service to connect to blob storage
  - Authentication handled via Managed Identity (no storage keys required)

### Server Configuration  
- `NODE_ENV=production`
- `PORT=3001` (automatically set by Azure App Service)

### CORS Configuration
- `CORS_ORIGIN=https://taktmate-frontend.azurestaticapps.net` (your Static Web App URL)

### Optional Debug Settings
- `DEBUG_PROMPTS=false` (set to 'true' to enable detailed prompt logging)

## Azure App Service Configuration Command

### Already Configured (✅):
- `APPLICATION_INSIGHTS_CONNECTION_STRING` - Application Insights integration
- `AZURE_KEY_VAULT_URL` - Key Vault integration  
- `FRONTEND_URL` - Static Web App URL
- `NODE_ENV=production` - Production environment
- `PORT=80` - Azure App Service port

### Still Need to Add (Key Vault Reference - Recommended):

**Step 1: Add secret to Key Vault (if not already there):**
- Azure Portal → TaktMate-KeyVault → Secrets → Generate/Import
- Name: `OpenAI-API-Key`
- Value: Your Azure OpenAI API key

**Step 2: Configure App Service setting:**
```bash
az webapp config appsettings set \
  --resource-group taktmate \
  --name taktmate-backend-api \
  --settings \
    OPENAI_API_KEY="@Microsoft.KeyVault(VaultName=TaktMate-KeyVault;SecretName=OpenAI-API-Key)" \
    STORAGE_ACCOUNT_NAME="taktmateblob"
```

**Alternative: Via Azure Portal:**
- Go to taktmate-backend-api → Settings → Environment variables
- Add: `OPENAI_API_KEY` = `@Microsoft.KeyVault(VaultName=TaktMate-KeyVault;SecretName=OpenAI-API-Key)`
- Add: `STORAGE_ACCOUNT_NAME` = `taktmateblob`

### Optional Settings:
```bash
az webapp config appsettings set \
  --resource-group taktmate \
  --name taktmate-backend-api \
  --settings \
    DEBUG_PROMPTS=false
```

## Local Development
For local development, create a `.env` file with these variables set to your development values.
