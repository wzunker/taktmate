# TaktMate Backend Environment Variables

## Required Variables for Azure Deployment

These variables must be set in Azure App Service Application Settings:

### Azure OpenAI Configuration
- `OPENAI_API_KEY` - Your Azure OpenAI API key (from Azure Key Vault)

### Server Configuration  
- `NODE_ENV=production`
- `PORT=3001` (automatically set by Azure App Service)

### CORS Configuration
- `CORS_ORIGIN=https://taktmate-frontend.azurestaticapps.net` (your Static Web App URL)

### Optional Debug Settings
- `DEBUG_PROMPTS=false` (set to 'true' to enable detailed prompt logging)

## Azure App Service Configuration Command

```bash
az webapp config appsettings set \
  --resource-group taktmate \
  --name taktmate-backend-api \
  --settings \
    NODE_ENV=production \
    OPENAI_API_KEY="<your-azure-openai-key>" \
    CORS_ORIGIN="https://taktmate-frontend.azurestaticapps.net" \
    DEBUG_PROMPTS=false
```

## Local Development
For local development, create a `.env` file with these variables set to your development values.
