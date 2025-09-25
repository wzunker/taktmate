# Local Development Environment Setup

## Overview

This checklist guides you through setting up a local development environment for TaktMate that allows faster iteration without deploying to Azure. The setup uses a mock user for authentication bypass while connecting to the same production Azure services (OpenAI, Blob Storage, Cosmos DB) for realistic testing.

## Prerequisites

- [ ] Node.js 16+ installed
- [ ] Access to production Azure OpenAI API key
- [ ] Access to production Azure Storage Account (taktmateblob)
- [ ] Access to production Cosmos DB connection details

---

## Phase 1: Backend Configuration

### 1.1 Create Environment Variables File

- [x] Create `backend/.env` file with the following content:

```env
# Development Configuration
NODE_ENV=development
LOCAL_DEVELOPMENT=true
PORT=5000
DEBUG_PROMPTS=true

# CORS Configuration
CORS_ORIGIN=http://localhost:3000

# Azure Services (YOU NEED TO PROVIDE THESE VALUES)
OPENAI_API_KEY=@Microsoft.KeyVault(SecretUri=https://TaktMate-KeyVault.vault.azure.net/secrets/OpenAI-API-Key)
STORAGE_ACCOUNT_NAME=taktmateblob

# Cosmos DB Configuration (YOU NEED TO PROVIDE THESE VALUES)
COSMOS_DB_ENDPOINT=https://taktmate-conversations.documents.azure.com:443/
COSMOS_DB_DATABASE_NAME=taktmate-conversations
COSMOS_DB_CONTAINER_NAME=conversations
```

> **⚠️ ACTION REQUIRED:** Replace the placeholder values above with actual Azure service credentials.

### 1.2 Update Authentication Middleware

- [x] Open `backend/middleware/auth.js`
- [x] Add local development bypass at the beginning of the `requireAuth` function:

```javascript
function requireAuth(req, res, next) {
  // LOCAL DEVELOPMENT BYPASS
  if (process.env.LOCAL_DEVELOPMENT === 'true') {
    req.user = {
      id: 'local-dev-user',
      email: 'dev@localhost',
      name: 'Local Developer',
      identityProvider: 'local-mock',
      roles: ['authenticated'],
      claims: []
    };
    console.log('🔧 Using mock user for local development');
    return next();
  }

  // Existing SWA authentication logic...
  try {
    const clientPrincipalHeader = req.headers['x-ms-client-principal'];
    // ... rest of existing code
```

### 1.3 Verify CORS Configuration

- [x] Open `backend/index.js`
- [x] Ensure CORS is configured to allow localhost:3000
- [x] Look for existing CORS setup and verify it includes development origin

---

## Phase 2: Frontend Configuration

### 2.1 Add API Proxy Configuration

- [ ] Open `frontend/package.json`
- [ ] Add proxy configuration after the main properties:

```json
{
  "name": "taktmate-frontend",
  "version": "1.0.0",
  "private": true,
  "proxy": "http://localhost:5000",
  "dependencies": {
    // ... existing dependencies
```

### 2.2 Update Authentication Context

- [ ] Open `frontend/src/contexts/AuthContext.js`
- [ ] Modify the `checkAuthStatus` function to add local development bypass:

```javascript
const checkAuthStatus = async () => {
  try {
    dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
    
    // LOCAL DEVELOPMENT BYPASS
    if (process.env.NODE_ENV === 'development' && window.location.hostname === 'localhost') {
      console.log('🔧 Using mock authentication for local development');
      dispatch({ 
        type: AUTH_ACTIONS.SET_AUTHENTICATED, 
        payload: {
          id: 'local-dev-user',
          name: 'Local Developer',
          email: 'dev@localhost',
          roles: ['authenticated'],
          identityProvider: 'local-mock',
          claims: []
        }
      });
      return;
    }
    
    // Existing SWA authentication logic...
    const response = await fetch('/.auth/me');
    // ... rest of existing code
```

---

## Phase 3: Install Dependencies and Start Services

### 3.1 Install Backend Dependencies

- [ ] Open terminal and navigate to backend directory:
```bash
cd backend
npm install
```

### 3.2 Install Frontend Dependencies

- [ ] Open another terminal and navigate to frontend directory:
```bash
cd frontend
npm install
```

### 3.3 Start Development Servers

- [ ] Start backend server (from `backend/` directory):
```bash
npm run dev
```

- [ ] Verify backend startup message shows:
  - `🔧 Local development mode enabled`
  - `Debug prompts: ENABLED`
  - Server running on port 5000

- [ ] Start frontend server (from `frontend/` directory):
```bash
npm start
```

- [ ] Verify frontend opens at `http://localhost:3000`

---

## Phase 4: Verification and Testing

### 4.1 Authentication Verification

- [ ] Open `http://localhost:3000` in browser
- [ ] Verify automatic login with mock user (no login screen should appear)
- [ ] Check browser console for mock authentication message
- [ ] Verify user profile shows "Local Developer" in top-right corner

### 4.2 File Upload Testing

- [ ] Click "Add" button to upload a file
- [ ] Upload a small CSV, PDF, DOCX, XLSX, or TXT file
- [ ] Verify successful upload message
- [ ] **OPTIONAL:** Check Azure Portal → Storage Account → taktmateblob → Containers
  - Look for container starting with `u-` (this is your mock user's container)

### 4.3 Chat Functionality Testing

- [ ] Select an uploaded file
- [ ] Send a test message in chat
- [ ] Verify AI response is received
- [ ] Check backend terminal for debug output (if `DEBUG_PROMPTS=true`)

### 4.4 Conversation Persistence Testing

- [ ] Create a conversation with multiple messages
- [ ] Restart both backend and frontend servers
- [ ] Verify conversation history persists
- [ ] **OPTIONAL:** Check Azure Portal → Cosmos DB → Data Explorer
  - Look for documents with `userId = "local-dev-user"`

### 4.5 Data Isolation Verification

- [ ] Upload multiple files and create conversations
- [ ] Verify all data is isolated to the mock user
- [ ] **IMPORTANT:** Confirm no interference with production users

---

## Phase 5: Development Workflow

### 5.1 Daily Development Process

- [ ] Start backend: `cd backend && npm run dev`
- [ ] Start frontend: `cd frontend && npm start`
- [ ] Develop and test features locally
- [ ] When ready, push to main branch for Azure deployment

### 5.2 Debugging and Troubleshooting

- [ ] Enable debug mode with `DEBUG_PROMPTS=true` in `.env`
- [ ] Check backend terminal for detailed API logs
- [ ] Use browser dev tools to inspect network requests
- [ ] Verify mock user authentication in browser console

---

## Cleanup (Optional)

### Development Data Cleanup

If you want to clean up development data:

- [ ] **Azure Blob Storage:** Delete the mock user container (`u-*` pattern)
- [ ] **Cosmos DB:** Delete conversations where `userId = "local-dev-user"`

---

## Troubleshooting

### Common Issues

**Backend won't start:**
- [ ] Check if port 5000 is already in use: `lsof -i :5000`
- [ ] Verify all environment variables are set correctly
- [ ] Check Azure service credentials

**Frontend authentication issues:**
- [ ] Verify proxy is set in `package.json`
- [ ] Check browser console for authentication bypass message
- [ ] Ensure `NODE_ENV=development` in frontend

**API calls failing:**
- [ ] Verify backend is running on port 5000
- [ ] Check CORS configuration allows localhost:3000
- [ ] Inspect network tab for failed requests

**Azure service connection issues:**
- [ ] Verify Azure OpenAI API key is correct
- [ ] Check Cosmos DB connection string format
- [ ] Ensure storage account name is correct

---

## Security Notes

⚠️ **Important Security Considerations:**

- [ ] Never commit `.env` file to version control
- [ ] Mock user bypass only works in development mode
- [ ] Production deployment will use real Azure SWA authentication
- [ ] Mock user data is isolated but uses production Azure services

---

## Success Criteria

✅ **Local development environment is ready when:**

- [ ] Both servers start without errors
- [ ] Mock user is automatically authenticated
- [ ] File uploads work and store in Azure Blob Storage
- [ ] Chat functionality works with Azure OpenAI
- [ ] Conversations persist in Cosmos DB
- [ ] All data is properly isolated to mock user
- [ ] Development workflow is faster than Azure deployment

---

## Next Steps

Once local development is working:

1. **Feature Development:** Use local environment for rapid iteration
2. **Testing:** Verify features work before pushing to production
3. **Deployment:** Push to main branch triggers Azure deployment
4. **Production Verification:** Test deployed features on production site

---

*This setup provides a production-like local development environment while maintaining complete data isolation and security.*
