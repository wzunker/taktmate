# TaktMate Authentication Environment Setup Guide

## 🎯 **CURRENT STATUS: Ready to Configure Environment Variables**

Based on your completed Azure resources, you're now at the **configuration stage**. All Azure resources are created - now we need to connect them together.

---

## ✅ **COMPLETED - Azure Resources Created**

### Microsoft Entra External ID ✅
- [X] Tenant created: `taktmate.onmicrosoft.com`
- [X] Application registered with Client ID and Secret
- [X] Authentication settings configured
- [X] Identity providers (i.e. Google) configured (optional)

### Azure Services ✅  
- [X] Application Insights: `TaktMate-AppInsights`
- [X] Key Vault: `TaktMate-KeyVault` with RBAC access
- [X] App Service: `taktmate-backend-api` (Backend API)
- [X] Static Web Apps: `taktmate-frontend` (Frontend)

---

## 🔧 **NEXT STEP: Configure Environment Variables**

### **Step 1: Get Your URLs** *(Do this first)*

You need to collect these URLs from your Azure resources:

- [X] **App Service URL**: Go to App Service → Overview → Copy the URL
  - Should be: `https://taktmate-backend-api-[random].azurewebsites.net`
  
- [X] **Static Web App URL**: Go to Static Web Apps → Overview → Copy the URL  
  - Should be: `https://[random]-[random].azurestaticapps.net`

### **Step 2: Configure Backend Environment Variables**

[X] Go to **App Service** → **Configuration** → **Application settings** and add:

```bash
# Essential Azure settings (CRITICAL)
SCM_DO_BUILD_DURING_DEPLOYMENT=true
WEBSITE_NODE_DEFAULT_VERSION=~20
NODE_ENV=production
PORT=80

# Microsoft Entra External ID (Replace with your values)
ENTRA_EXTERNAL_ID_TENANT_ID=taktmate.onmicrosoft.com
ENTRA_EXTERNAL_ID_CLIENT_ID=[your-client-id-from-app-registration]
ENTRA_EXTERNAL_ID_CLIENT_SECRET=[your-client-secret-value]

# Application Insights
APPLICATION_INSIGHTS_CONNECTION_STRING=[your-connection-string]

# CORS Configuration (Use your Static Web App URL)
FRONTEND_URL=[your-static-web-app-url]

# Optional
AZURE_KEY_VAULT_URL=https://taktmate-keyvault.vault.azure.net/
```

### **Step 3: Configure Frontend Environment Variables**

[X] Go to **Static Web Apps** → **Configuration** → **Application settings** and add:

```bash
# API Connection (Use your App Service URL)
REACT_APP_API_URL=[your-app-service-url]/api

# Microsoft Entra External ID (Same as backend)
REACT_APP_ENTRA_EXTERNAL_ID_TENANT_ID=taktmate.onmicrosoft.com
REACT_APP_ENTRA_EXTERNAL_ID_CLIENT_ID=[your-client-id-from-app-registration]

# App Configuration
REACT_APP_ENVIRONMENT=production
REACT_APP_APP_NAME=TaktMate
```

### **Step 4: Enable Managed Identity for Key Vault**

- [X] **App Service** → **Identity** → **System assigned** → **On** → **Save**
- [X] **Copy the Object (principal) ID**
- [X] **Key Vault** → **Access control (IAM)** → **Add role assignment**
  - **Role**: `Key Vault Secrets User`
  - **Members**: Paste the Object ID → **Review + assign**

---

## 🚀 **AFTER Configuration: Deploy Applications**

### Deploy Backend
- [X] **Commit and push your code** to trigger GitHub Actions deployment
- [X] **Check deployment logs** in App Service → Deployment Center

### Deploy Frontend  
- [X] **GitHub Actions** automatically deploys when you push
- [X] **Check deployment status** in Static Web Apps → GitHub Actions runs

### Test Everything
- [X] **Visit App Service URL** - should not show errors
- [ ] **Visit Static Web App URL** - should load React app
- [ ] **Test authentication flow** - try signing in

---

## 📋 **Your Key Information to Collect**

Write down these values (you'll need them for environment variables):

```
App Service URL: https://taktmate-backend-api-csheb3aeg8f5bcbv.eastus-01.azurewebsites.net (/api/health)
Static Web App URL: https://orange-flower-0b350780f.1.azurestaticapps.net/
Client ID: 
Client Secret: 
Application Insights Connection String: 
```

---

## 🔍 **Common Issues & Solutions**

### Deployment Failures
- **Backend deployment fails**: Check that `SCM_DO_BUILD_DURING_DEPLOYMENT=true` is set
- **Frontend deployment fails**: Verify build location is `/frontend` and output is `build`
- **Missing dependencies**: Check `package.json` files exist in correct locations

### Authentication Issues  
- **Login redirects fail**: Verify redirect URIs match exactly in Entra External ID
- **JWT token errors**: Check Client ID and Secret are correct
- **CORS errors**: Ensure `CORS_ORIGINS` includes your Static Web App URL

### Environment Variables
- **Missing variables**: All `ENTRA_EXTERNAL_ID_*` variables are required
- **Wrong URLs**: Ensure no trailing slashes in URLs
- **Case sensitivity**: Variable names must match exactly

---

## 🌐 **LATER: Custom Domains (Optional)**

After everything is working with Azure URLs, you can optionally configure custom domains:

### Configure Custom Domains
- [ ] **App Service**: Add `api.taktmate.taktconnect.com`
- [ ] **Static Web Apps**: Add `taktmate.taktconnect.com` 
- [ ] **DNS in Porkbun**: Add CNAME records pointing to Azure URLs
- [ ] **Update Redirect URIs**: Add custom domain URLs to Entra External ID

---

## 🔧 **REFERENCE: Complete Environment Variables**

### For Local Development (.env files)

If you want to run locally, create these `.env` files:

**Backend `.env`:**
```bash
NODE_ENV=development
PORT=5000
ENTRA_EXTERNAL_ID_TENANT_ID=taktmate.onmicrosoft.com
ENTRA_EXTERNAL_ID_CLIENT_ID=[your-client-id]
ENTRA_EXTERNAL_ID_CLIENT_SECRET=[your-client-secret]
ENTRA_EXTERNAL_ID_DOMAIN=taktmate.ciamlogin.com
APPLICATION_INSIGHTS_CONNECTION_STRING=[your-connection-string]
FRONTEND_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000
JWT_SECRET=[32-character-random-string]
SESSION_SECRET=[32-character-random-string]
ENCRYPTION_KEY=[exactly-32-characters]
```

**Frontend `.env`:**
```bash
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_ENTRA_EXTERNAL_ID_TENANT_ID=taktmate.onmicrosoft.com
REACT_APP_ENTRA_EXTERNAL_ID_CLIENT_ID=[your-client-id]
REACT_APP_ENTRA_EXTERNAL_ID_DOMAIN=taktmate.ciamlogin.com
REACT_APP_APP_NAME=TaktMate
```

---

## 📞 **Support Resources**

- **Microsoft Entra External ID Docs**: [Official Documentation](https://docs.microsoft.com/en-us/azure/active-directory-b2c/)
- **Application Insights Setup**: [Node.js Integration Guide](https://docs.microsoft.com/en-us/azure/azure-monitor/app/nodejs)
- **Azure App Service**: [Deployment Documentation](https://docs.microsoft.com/en-us/azure/app-service/)
- **Azure Static Web Apps**: [Configuration Guide](https://docs.microsoft.com/en-us/azure/static-web-apps/)

---

## 🎯 **SUMMARY: What You Need to Do Next**

1. **📋 Collect URLs**: Get your App Service and Static Web App URLs from Azure Portal
2. **🔧 Configure Backend**: Add environment variables in App Service → Configuration  
3. **⚙️ Configure Frontend**: Add environment variables in Static Web Apps → Configuration
4. **🔑 Enable Managed Identity**: Set up Key Vault access for your App Service
5. **🚀 Deploy**: Commit and push your code to trigger deployments
6. **✅ Test**: Visit both URLs and test the authentication flow

**You're almost there! The hard part (creating resources) is done. Now it's just configuration.** 🎉
