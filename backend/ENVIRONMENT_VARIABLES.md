# TaktMate Backend Environment Variables

## Required Variables for Azure Deployment

These variables must be set in Azure App Service Application Settings:

### Azure OpenAI Configuration
- `OPENAI_API_KEY` - Your Azure OpenAI API key (from Azure Key Vault)
- `AZURE_OPENAI_DEPLOYMENT_GPT4` - Deployment name for GPT-4.1 model (default: `gpt-4.1`)
  - Used for stable operations: title generation, summarization, suggestions
- `AZURE_OPENAI_DEPLOYMENT_GPT5_MINI` - Deployment name for GPT-5-mini model (default: `gpt-5-mini`)
  - Used for tool calling and parallel function execution
- `ACTIVE_MODEL` - Which model to use for main chat operations (options: `gpt-4.1` or `gpt-5-mini`)
  - Set to `gpt-5-mini` to enable tool calling functionality
  - Set to `gpt-4.1` for standard chat without tools (fallback mode)

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
    STORAGE_ACCOUNT_NAME="taktmateblob" \
    AZURE_OPENAI_DEPLOYMENT_GPT4="gpt-4.1" \
    AZURE_OPENAI_DEPLOYMENT_GPT5_MINI="gpt-5-mini" \
    ACTIVE_MODEL="gpt-5-mini"
```

**Alternative: Via Azure Portal:**
- Go to taktmate-backend-api → Settings → Environment variables
- Add: `OPENAI_API_KEY` = `@Microsoft.KeyVault(VaultName=TaktMate-KeyVault;SecretName=OpenAI-API-Key)`
- Add: `STORAGE_ACCOUNT_NAME` = `taktmateblob`
- Add: `AZURE_OPENAI_DEPLOYMENT_GPT4` = `gpt-4.1`
- Add: `AZURE_OPENAI_DEPLOYMENT_GPT5_MINI` = `gpt-5-mini`
- Add: `ACTIVE_MODEL` = `gpt-5-mini`

### Optional Settings:
```bash
az webapp config appsettings set \
  --resource-group taktmate \
  --name taktmate-backend-api \
  --settings \
    DEBUG_PROMPTS=false
```

## Local Development

For local development, create a `/backend/.env` file with these variables:

```bash
# Development Configuration
NODE_ENV=development
LOCAL_DEVELOPMENT=true
PORT=3001

# Azure OpenAI Configuration
OPENAI_API_KEY=your-api-key-here

# Model Deployments (both in taktmate resource)
AZURE_OPENAI_DEPLOYMENT_GPT4=gpt-4.1
AZURE_OPENAI_DEPLOYMENT_GPT5_MINI=gpt-5-mini

# Active Model - Switch between gpt-4.1 and gpt-5-mini
# Set to gpt-5-mini to enable tool calling
# Set to gpt-4.1 for standard chat without tools
ACTIVE_MODEL=gpt-5-mini

# Azure Blob Storage
STORAGE_ACCOUNT_NAME=taktmateblob

# Cosmos DB Configuration
COSMOS_DB_ENDPOINT=your-cosmos-endpoint
COSMOS_DB_DATABASE_NAME=your-database-name
COSMOS_DB_CONTAINER_NAME=conversations

# CORS Configuration (for local frontend)
CORS_ORIGIN=http://localhost:3000

# Optional Debug Settings
DEBUG_PROMPTS=false
```

**Note**: The `.env` file is already in `.gitignore` and will not be committed to version control.
