# TaktMate Cloud Hosting Deployment Tasks

## Overview
Deploy TaktMate to Azure with no authentication, using existing Azure resources:
- **Frontend**: Azure Static Web Apps (`taktmate-frontend`)
- **Backend**: Azure App Service (`taktmate-backend-api`)
- **Secrets**: Azure Key Vault (`TaktMate-KeyVault`)
- **Monitoring**: Application Insights (`TaktMate-AppInsights`)

## Prerequisites Checklist
- [ ] Azure CLI installed and logged in
- [ ] Node.js 18+ installed locally
- [ ] Access to existing Azure resources (shown in screenshot)
- [ ] On clean branch from commit `b5fcec9` (or ready to create it)

---

## Phase 1: Backend Preparation and Deployment

### Task 1.1: Prepare Backend for Azure App Service
- [X] **Update `backend/package.json`**
  - [X] Ensure `"start": "node index.js"` script exists
  - [X] Add `"engines": { "node": ">=18" }` for Azure Node version
  - [X] Verify all dependencies are in `dependencies` (not `devDependencies`)

- [X] **Update `backend/index.js` for Azure**
  - [X] Ensure `const port = process.env.PORT || 3001;`
  - [X] Update CORS to allow Static Web App domain
  - [X] Verify all routes use `/api/` prefix (e.g., `/api/health`, `/api/upload`, `/api/chat`)

- [X] **Create minimal environment configuration**
  - [X] Create `backend/.env.example` with required variables
  - [X] Document which variables need to be set in Azure App Settings

### Task 1.2: Configure Azure App Service Settings
- [x] **Existing Configuration (Already Set):**
  - `APPLICATION_INSIGHTS_CONNECTION_STRING` ✅ Already configured
  - `AZURE_KEY_VAULT_URL` ✅ Already configured  
  - `FRONTEND_URL` ✅ Already configured (`https://orange-flower-0b350780f.1.azurestaticapps.net`)
  - `NODE_ENV=production` ✅ Already configured
  - `PORT=80` ✅ Already configured

- [X] **Required New Settings for TaktMate (Option B - Key Vault Reference):**
  
  **Step 1: Add OpenAI API Key to Key Vault (if not already there):**
  
  **First, ensure you have Key Vault permissions:**
  - Go to TaktMate-KeyVault → Access control (IAM)
  - Add role assignment: "Key Vault Secrets Officer" to your account
  - Also add "Key Vault Secrets User" to the App Service managed identity
  
  **Then add the secret:**
  - Go to Azure Portal → TaktMate-KeyVault → Secrets
  - Click "Generate/Import" 
  - Name: `OpenAI-API-Key`
  - Value: Your Azure OpenAI API key
  - Click "Create"
  
  **If permissions fail, temporary workaround:**
  - Use direct environment variable: `OPENAI_API_KEY=your-actual-key`
  
  **Step 2: Add App Service Setting with Key Vault Reference:**
  ```bash
  az webapp config appsettings set \
    --resource-group taktmate \
    --name taktmate-backend-api \
    --settings \
      OPENAI_API_KEY="@Microsoft.KeyVault(VaultName=TaktMate-KeyVault;SecretName=OpenAI-API-Key)"
  ```
  
  **Or via Azure Portal:**
  - Go to taktmate-backend-api → Settings → Environment variables
  - Click "Add" → Name: `OPENAI_API_KEY`
  - Value: `@Microsoft.KeyVault(VaultName=TaktMate-KeyVault;SecretName=OpenAI-API-Key)`
  - Click "Apply"

- [X] **Update CORS_ORIGIN setting:**
  - Current `FRONTEND_URL` can be renamed to `CORS_ORIGIN` for clarity
  - Or add `CORS_ORIGIN` as new setting with same value

- [x] **Key Vault integration:** ✅ Already configured
  - Managed identity appears to be set up
  - Key Vault URL is already configured

### Task 1.3: Deploy Backend to App Service (GitHub Actions)
- [x] **Create GitHub Actions workflow**
  - Created `.github/workflows/deploy-backend.yml`
  - Automated deployment on push to main branch
  - Triggers on backend changes only

- [ ] **Set up Azure deployment credentials**
  - [ ] Get publish profile from Azure App Service
  - [ ] Add `AZURE_WEBAPP_PUBLISH_PROFILE_BACKEND` to GitHub secrets

- [ ] **Deploy by pushing to main branch**
  - [ ] Commit and push changes
  - [ ] GitHub Actions will automatically deploy
  - [ ] Monitor deployment in GitHub Actions tab

- [ ] **Verify backend deployment**
  - [ ] Test: `https://taktmate-backend-api-csheb3aeg8f5bcbv.eastus-01.azurewebsites.net/api/health`
  - [ ] Check GitHub Actions logs for deployment status
  - [ ] Verify all endpoints respond correctly

---

## Phase 2: Frontend Configuration and Deployment

### Task 2.1: Configure Static Web App
- [x] **Existing Static Web App Configuration:**
  - SWA URL: `https://orange-flower-0b350780f.1.azurestaticapps.net` ✅
  - Backend API URL: `https://taktmate-backend-api-csheb3aeg8f5bcbv.eastus-01.azurewebsites.net/api` ✅
  - Environment: Production ✅

- [ ] **Create `frontend/staticwebapp.config.json`**
  ```json
  {
    "navigationFallback": { "rewrite": "/index.html" },
    "routes": [
      {
        "route": "/api/*",
        "rewrite": "https://taktmate-backend-api-csheb3aeg8f5bcbv.eastus-01.azurewebsites.net/api/{*path}"
      },
      {
        "route": "/*",
        "allowedRoles": ["anonymous"]
      }
    ]
  }
  ```

- [ ] **Update frontend API calls**
  - [ ] Ensure all API calls use relative paths (e.g., `fetch('/api/upload')`)
  - [ ] Remove any hardcoded backend URLs
  - [ ] Test API integration locally with proxy

- [ ] **Clean up Static Web App environment variables:**
  - [ ] Remove Entra External ID related variables (no longer needed)
  - [ ] Keep `REACT_APP_API_URL` if needed for development

### Task 2.2: Deploy Frontend to Static Web Apps (GitHub Actions)
- [x] **Create GitHub Actions workflow**
  - Created `.github/workflows/deploy-frontend.yml`
  - Automated deployment on push to main branch
  - Triggers on frontend changes only

- [ ] **Set up Azure Static Web Apps credentials**
  - [ ] Get API token from Azure Static Web Apps
  - [ ] Add `AZURE_STATIC_WEB_APPS_API_TOKEN` to GitHub secrets

- [ ] **Deploy by pushing to main branch**
  - [ ] Commit and push changes
  - [ ] GitHub Actions will automatically deploy
  - [ ] Monitor deployment in GitHub Actions tab

- [ ] **Verify frontend deployment**
  - [ ] Test Static Web App URL loads correctly
  - [ ] Verify SPA routing works (refresh on any route)
  - [ ] Test API proxy: visit `https://<swa-url>/api/health`

---

## Phase 3: Integration Testing and Verification

### Task 3.1: End-to-End Testing
- [ ] **Test core functionality**
  - [ ] Upload a CSV file successfully
  - [ ] Verify file data displays in DataTable component
  - [ ] Test chat functionality with uploaded data
  - [ ] Verify OpenAI integration works

- [ ] **Test from different browsers/devices**
  - [ ] Desktop browsers (Chrome, Firefox, Safari)
  - [ ] Mobile browsers
  - [ ] Incognito/private browsing mode

### Task 3.2: Performance and Monitoring
- [ ] **Configure Application Insights**
  - [ ] Link backend to existing Application Insights resource
  - [ ] Add basic telemetry tracking
  - [ ] Set up error logging

- [ ] **Performance verification**
  - [ ] Test file upload with various CSV sizes
  - [ ] Verify reasonable response times
  - [ ] Check for any console errors or warnings

---

## Phase 4: Production Readiness (Optional Enhancements)

### Task 4.1: Security and Reliability
- [ ] **Add rate limiting to backend**
  - [ ] Implement basic rate limiting for upload/chat endpoints
  - [ ] Add input validation for file uploads

- [ ] **Error handling improvements**
  - [ ] Add proper error boundaries in React
  - [ ] Implement graceful error messages for users
  - [ ] Add retry logic for API failures

### Task 4.2: Monitoring and Alerts
- [ ] **Set up basic monitoring**
  - [ ] Configure availability monitoring
  - [ ] Set up error rate alerts
  - [ ] Monitor API response times

### Task 4.3: Custom Domain (Optional)
- [ ] **Configure custom domain for Static Web App**
  - [ ] Add custom domain in Azure portal
  - [ ] Update CORS settings in backend
  - [ ] Configure SSL certificate

---

## Troubleshooting Guide

### Common Issues and Solutions

**Backend not responding:**
- Check App Service logs in Azure Portal
- Verify environment variables are set correctly
- Ensure `package.json` has correct start script

**Frontend can't reach backend:**
- Verify `staticwebapp.config.json` proxy configuration
- Check CORS settings in backend
- Test backend URL directly first

**File upload failing:**
- Check file size limits in both frontend and backend
- Verify multer configuration in backend
- Check network tab for detailed error messages

**OpenAI integration not working:**
- Verify API key is set in App Service settings
- Check if using Azure OpenAI vs regular OpenAI
- Review API call logs in Application Insights

---

## Success Criteria
- [ ] TaktMate is publicly accessible at Static Web App URL
- [ ] Users can upload CSV files without authentication
- [ ] Chat functionality works with uploaded data
- [ ] No authentication barriers or login prompts
- [ ] Application is responsive and performs well
- [ ] Basic monitoring and error tracking is in place

---

## Rollback Plan
If issues arise:
1. **Frontend rollback**: Revert GitHub commit to trigger new SWA deployment
2. **Backend rollback**: Deploy previous working version via ZIP deployment
3. **Configuration rollback**: Restore previous App Service settings
4. **DNS rollback**: Remove custom domain if configured

---

## Notes
- This deployment uses **no authentication** - the app is publicly accessible
- All Azure resources are already created and ready to use
- The Static Web App proxy eliminates CORS complexity
- Environment variables should be managed through Azure App Service settings, not `.env` files in production
