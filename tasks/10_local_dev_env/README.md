# TaktMate Local Development Environment

This guide provides complete instructions for setting up and running TaktMate locally for development, including troubleshooting and Azure permissions setup.

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ installed
- Azure CLI installed and logged in
- Access to the TaktMate Azure subscription

### Start the Application
```bash
# From project root
npm run dev
```

This starts both backend (port 3001) and frontend (port 3000) simultaneously using `concurrently`.

**Access the app:** http://localhost:3000

## 📋 Detailed Setup Instructions

### 1. Install Dependencies
```bash
# Install all dependencies (root, backend, frontend)
npm run install-all
```

### 2. Configure Environment Variables
Create `backend/.env` file:
```env
# Development Configuration
NODE_ENV=development
LOCAL_DEVELOPMENT=true
PORT=3001
DEBUG_PROMPTS=true

# CORS Configuration
CORS_ORIGIN=http://localhost:3000

# Azure Services
OPENAI_API_KEY=@Microsoft.KeyVault(SecretUri=https://TaktMate-KeyVault.vault.azure.net/secrets/OpenAI-API-Key)
STORAGE_ACCOUNT_NAME=taktmateblob

# Cosmos DB Configuration
COSMOS_DB_ENDPOINT=https://taktmate-conversations.documents.azure.com:443/
COSMOS_DB_DATABASE_NAME=taktmate-conversations
COSMOS_DB_CONTAINER_NAME=conversations
```

### 3. Azure Permissions Setup (For New Developers)

**⚠️ IMPORTANT:** New developers need Azure RBAC permissions to access Cosmos DB and Blob Storage locally.

#### Check Your Azure Login
```bash
# Verify you're logged in to Azure CLI
az account show --query user.name -o tsv
```

#### Grant Cosmos DB Permissions
```bash
# Grant Cosmos DB Built-in Data Contributor role
az cosmosdb sql role assignment create \
  --account-name taktmate-conversations \
  --resource-group taktmate \
  --scope "/" \
  --principal-id $(az ad user show --id YOUR_EMAIL@taktconnect.com --query id -o tsv) \
  --role-definition-id 00000000-0000-0000-0000-000000000002
```

#### Grant Blob Storage Permissions
```bash
# Grant Storage Blob Data Contributor role
az role assignment create \
  --assignee $(az ad user show --id YOUR_EMAIL@taktconnect.com --query id -o tsv) \
  --role "Storage Blob Data Contributor" \
  --scope "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/taktmate/providers/Microsoft.Storage/storageAccounts/taktmateblob"
```

**Replace `YOUR_EMAIL@taktconnect.com` with your actual email address.**

### 4. Start Development Servers

#### Option 1: Start Both Services (Recommended)
```bash
npm run dev
```

#### Option 2: Start Services Separately
```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend  
cd frontend && npm start
```

## 🔧 Development Commands

### Basic Commands
```bash
# Start both backend and frontend
npm run dev

# Start backend only
npm run backend

# Start frontend only
npm run frontend

# Install all dependencies
npm run install-all

# Build frontend for production
npm run build
```

### Individual Service Commands
```bash
# Backend commands (from backend/ directory)
npm run dev          # Start with nodemon (auto-restart)
npm start           # Start without auto-restart

# Frontend commands (from frontend/ directory)
npm start           # Start development server
npm run build       # Build for production
npm test            # Run tests
```

## 🩺 Health Checks and Monitoring

### Check Service Health
```bash
# Backend health endpoint
curl http://localhost:3001/health

# Test API endpoints
curl http://localhost:3001/api/files
curl http://localhost:3001/api/conversations
```

### View Logs
```bash
# View backend logs (if running in background)
tail -f backend/backend.log

# View live backend logs
cd backend && npm run dev

# Check what's running on ports
lsof -i :3000  # Frontend
lsof -i :3001  # Backend
```

### Debug Authentication
The backend logs show authentication debug info:
```
🔍 Auth Debug: {
  LOCAL_DEVELOPMENT: 'true',
  NODE_ENV: 'development',
  hostname: 'localhost',
  host: 'localhost:3001'
}
🔧 Using mock user for local development
```

## 🛠️ Process Management

### Kill Processes
```bash
# Kill processes by port
lsof -ti:3000 | xargs kill -9  # Kill frontend
lsof -ti:3001 | xargs kill -9  # Kill backend

# Kill by process name
pkill -f "nodemon"             # Kill nodemon processes
pkill -f "react-scripts"       # Kill React dev server
pkill -f "node.*index.js"      # Kill Node.js backend

# Nuclear option - kill all Node processes (use carefully!)
pkill -f "node"
```

### Check Running Processes
```bash
# See what's running on ports
lsof -i :3000
lsof -i :3001

# See all Node processes
ps aux | grep node | grep -v grep

# See specific processes
ps aux | grep nodemon
ps aux | grep react-scripts
```

### Restart Services
```bash
# If services are stuck, kill and restart
pkill -f "nodemon\|react-scripts" && sleep 2 && npm run dev
```

## 🔍 Troubleshooting

### Common Issues and Solutions

#### Port Already in Use
```bash
# Error: EADDRINUSE :::3001
lsof -ti:3001 | xargs kill -9
# Then restart the service
```

#### Authentication Issues
- Check Azure CLI login: `az account show`
- Verify RBAC permissions are granted (see setup section)
- Check debug logs for authentication bypass messages

#### API Timeouts
- Ensure backend is running and healthy
- Check Azure permissions for your user account
- Verify environment variables are set correctly

#### Frontend Not Loading Files
- Check browser console for errors
- Verify API proxy is working (Network tab in DevTools)
- Ensure backend authentication bypass is working

#### Azure Permissions Issues
```bash
# Re-grant permissions if needed
# (Use the permission commands from setup section)

# Clear Azure CLI cache (if permissions seem cached)
rm -rf ~/.azure/msal_token_cache.json
az logout && az login
```

### Debug Mode
Enable detailed logging by setting `DEBUG_PROMPTS=true` in `backend/.env`.

## 🏗️ How Local Development Works

### Authentication Flow
1. **Frontend**: Bypasses Azure Static Web Apps auth, auto-logs in as "Local Developer"
2. **Backend**: Detects local development, skips SWA header validation, uses mock user
3. **Mock User**: `local-dev-user` with isolated Azure resources

### Azure Services Integration
- **OpenAI**: Uses production Azure OpenAI service for chat responses
- **Blob Storage**: Creates isolated container for mock user (`u-{hash}`)
- **Cosmos DB**: Uses production database with mock user partition
- **Authentication**: RBAC permissions allow your Azure user to access services

### File Storage
- **Production**: Each user gets `u-{hash-of-real-user-id}` container
- **Local Dev**: Mock user gets `u-b544b040654823d061987a571c2a1fa8` container
- **Isolation**: Complete separation between development and production data

## 📊 Monitoring and Logs

### Backend Logs Show
```
TaktMate Backend running on port 3001
Storage Account: taktmateblob
Cosmos DB: https://taktmate-conversations.documents.azure.com:443/
Storage connectivity: healthy
✅ Cosmos DB connection established successfully
✅ Summarizer service initialized successfully

🔧 Using mock user for local development
Listing files for user: local-dev-user
Found 0 files for user local-dev-user
✅ Retrieved 0 conversations for user: local-dev-user
```

### Success Indicators
- ✅ All Azure services show "healthy" status
- ✅ Mock user authentication working
- ✅ API endpoints responding successfully
- ✅ No permission errors in logs

## 🔒 Security Notes

- **Mock user data** is isolated from production users
- **Azure RBAC permissions** are required for each developer
- **No production data** is accessible from local development
- **Environment variables** should never be committed to git

## 🚀 Production vs Local Development

| Feature | Production | Local Development |
|---------|------------|-------------------|
| **Authentication** | Azure SWA + Entra ID | Mock user bypass |
| **Frontend** | Static Web App | React dev server |
| **Backend** | App Service | Local Node.js |
| **OpenAI** | Managed Identity | Your Azure user |
| **Blob Storage** | Managed Identity | Your Azure user |
| **Cosmos DB** | Managed Identity | Your Azure user |
| **Data Isolation** | Real user containers | Mock user container |

## 📝 Development Workflow

1. **Start Development**: `npm run dev`
2. **Make Changes**: Edit code with hot reload
3. **Test Locally**: Upload files, test chat functionality
4. **Commit Changes**: `git add . && git commit -m "description"`
5. **Push to Develop**: `git push origin develop`
6. **Deploy to Production**: Merge develop → main

## 🆘 Getting Help

If you encounter issues:

1. **Check this README** for common solutions
2. **Review the logs** for error messages
3. **Verify Azure permissions** are correctly set
4. **Ensure all services are running** and healthy
5. **Check the main project README** for additional context

## 📚 Additional Resources

- [Main Project README](../../README.md) - Full project documentation
- [Azure Setup Guide](../../AZURE_SETUP.md) - Azure service configuration
- [Environment Variables Guide](../backend/ENVIRONMENT_VARIABLES.md) - Deployment variables

---

*This local development environment provides the same functionality as production with faster iteration and complete data isolation.*
