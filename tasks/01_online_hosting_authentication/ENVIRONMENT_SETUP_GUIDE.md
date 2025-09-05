# TaktMate Authentication Environment Setup Guide

## 🚀 Overview

This guide provides step-by-step instructions for setting up the environment variables and Azure resources required for the TaktMate authentication system. Follow these checklists to ensure proper configuration before running the comprehensive test suite.

## 📋 Azure Resources Required

### Microsoft Entra External ID Setup Checklist

- [ ] **Create Microsoft Entra External ID Tenant**
  - Go to Azure Portal → Create a resource → Azure Active Directory B2C
  - Choose "Create a new Microsoft Entra External ID Tenant"
  - Organization name: `TaktMate`
  - Initial domain name: `taktmate` (will create `taktmate.onmicrosoft.com`)
  - Country/Region: Select your location
  - **Note**: This will be your `ENTRA_EXTERNAL_ID_TENANT_ID`

- [ ] **Register Application in Microsoft Entra External ID**
  - Navigate to your B2C tenant → App registrations → New registration
  - Name: `TaktMate Web Application`
  - Supported account types: `Accounts in any identity provider or organizational directory`
  - Redirect URI: `https://taktmate.taktconnect.com/auth/callback` (production)
  - For testing: Add `http://localhost:3000/auth/callback`
  - **Save the Application (client) ID** - This is your `ENTRA_EXTERNAL_ID_CLIENT_ID`

- [ ] **Create Client Secret**
  - Go to your app registration → Certificates & secrets
  - New client secret → Description: `TaktMate Web Secret`
  - Expires: 24 months (recommended)
  - **Save the secret value** - This is your `ENTRA_EXTERNAL_ID_CLIENT_SECRET`

- [ ] **Configure User Flows**
  - Go to Microsoft Entra External ID → User flows → New user flow
  - Create these flows:
    - **Sign up and sign in**: `B2C_1_signupsignin1`
    - **Profile editing**: `B2C_1_profileediting1`
    - **Password reset**: `B2C_1_passwordreset1`
  - **Note**: Use `B2C_1_signupsignin1` as your `ENTRA_EXTERNAL_ID_POLICY_NAME`

- [ ] **Configure Identity Providers (Optional)**
  - For Google OAuth: Microsoft Entra External ID → Identity providers → Google
  - For Microsoft OAuth: Microsoft Entra External ID → Identity providers → Microsoft Account
  - Configure redirect URIs and obtain client IDs/secrets

### Application Insights Setup Checklist

- [ ] **Create Application Insights Resource**
  - Azure Portal → Create a resource → Application Insights
  - Name: `TaktMate-AppInsights`
  - Application Type: `Node.js Application`
  - Resource Group: Create new or use existing
  - **Save the Connection String** - This is your `APPLICATION_INSIGHTS_CONNECTION_STRING`

### Azure Key Vault Setup Checklist (Optional but Recommended)

- [ ] **Create Key Vault Resource**
  - Azure Portal → Create a resource → Key Vault
  - Name: `TaktMate-KeyVault`
  - Resource Group: Same as above
  - **Save the Vault URI** - This is your `AZURE_KEY_VAULT_URL`

- [ ] **Configure Access Policies**
  - Add access policy for your application
  - Secret permissions: Get, List
  - **Save the Key Vault credentials**

## 🌐 Domain Configuration

### Using taktconnect.com Domain

Since you already own `taktconnect.com`, here are the recommended subdomain configurations:

- [ ] **Production Environment**
  - Main application: `https://taktmate.taktconnect.com`
  - API endpoints: `https://api.taktmate.taktconnect.com`
  - Authentication callback: `https://taktmate.taktconnect.com/auth/callback`

- [ ] **Staging Environment**
  - Staging application: `https://staging-taktmate.taktconnect.com`
  - Staging API: `https://staging-api.taktmate.taktconnect.com`

- [ ] **DNS Configuration in Porkbun**
  - Add CNAME record: `taktmate` → Your Azure App Service URL
  - Add CNAME record: `api.taktmate` → Your Azure App Service URL
  - Add CNAME record: `staging-taktmate` → Your Azure staging URL
  - Add SSL certificates through Azure App Service or Let's Encrypt

## 🔧 Environment Variables Setup

### Backend Environment Variables

Create a `.env` file in the `backend/` directory with the following variables:

```bash
# ========================================
# NODE ENVIRONMENT
# ========================================
NODE_ENV=development
PORT=5000

# ========================================
# AZURE AD B2C CONFIGURATION
# ========================================
ENTRA_EXTERNAL_ID_TENANT_ID=your-tenant-id.onmicrosoft.com
ENTRA_EXTERNAL_ID_CLIENT_ID=your-client-id-guid
ENTRA_EXTERNAL_ID_CLIENT_SECRET=your-client-secret
ENTRA_EXTERNAL_ID_POLICY_NAME=B2C_1_signupsignin1
ENTRA_EXTERNAL_ID_DOMAIN=your-tenant-id.ciamlogin.com

# ========================================
# APPLICATION INSIGHTS
# ========================================
APPLICATION_INSIGHTS_CONNECTION_STRING=InstrumentationKey=your-key;IngestionEndpoint=https://region.in.applicationinsights.azure.com/;LiveEndpoint=https://region.livediagnostics.monitor.azure.com/

# ========================================
# SECURITY CONFIGURATION
# ========================================
JWT_SECRET=your-super-secure-jwt-secret-at-least-32-characters-long
SESSION_SECRET=your-super-secure-session-secret-at-least-32-characters-long
ENCRYPTION_KEY=your-32-character-encryption-key-here

# ========================================
# CORS CONFIGURATION
# ========================================
FRONTEND_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000,https://taktmate.taktconnect.com

# ========================================
# LOGGING CONFIGURATION
# ========================================
LOG_LEVEL=info
ENABLE_METRICS=true
ENABLE_TRACING=true

# ========================================
# AZURE KEY VAULT (Optional)
# ========================================
AZURE_KEY_VAULT_URL=https://taktmate-keyvault.vault.azure.net/
AZURE_CLIENT_ID=your-service-principal-client-id
AZURE_CLIENT_SECRET=your-service-principal-secret
AZURE_TENANT_ID=your-azure-tenant-id

# ========================================
# RATE LIMITING
# ========================================
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# ========================================
# FILE UPLOAD CONFIGURATION
# ========================================
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads
ALLOWED_FILE_TYPES=.csv,.txt,.json

# ========================================
# GDPR COMPLIANCE
# ========================================
DATA_RETENTION_DAYS=730
AUDIT_LOG_RETENTION_DAYS=2555
ENABLE_GDPR_FEATURES=true

# ========================================
# TESTING CONFIGURATION
# ========================================
TEST_TIMEOUT=30000
ENABLE_TEST_ENDPOINTS=false
```

### Frontend Environment Variables

Create a `.env` file in the `frontend/` directory:

```bash
# ========================================
# REACT CONFIGURATION
# ========================================
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_ENVIRONMENT=development

# ========================================
# AZURE AD B2C FRONTEND CONFIG
# ========================================
REACT_APP_ENTRA_EXTERNAL_ID_TENANT_ID=your-tenant-id.onmicrosoft.com
REACT_APP_ENTRA_EXTERNAL_ID_CLIENT_ID=your-client-id-guid
REACT_APP_ENTRA_EXTERNAL_ID_POLICY_NAME=B2C_1_signupsignin1
REACT_APP_ENTRA_EXTERNAL_ID_DOMAIN=your-tenant-id.ciamlogin.com

# ========================================
# APPLICATION CONFIGURATION
# ========================================
REACT_APP_APP_NAME=TaktMate
REACT_APP_VERSION=1.0.0
REACT_APP_SUPPORT_EMAIL=support@taktconnect.com

# ========================================
# FEATURE FLAGS
# ========================================
REACT_APP_ENABLE_ANALYTICS=true
REACT_APP_ENABLE_CHAT_FEATURE=true
REACT_APP_ENABLE_FILE_UPLOAD=true
```

## ✅ Environment Variables Checklist

### Required Variables (Critical)
- [ ] `NODE_ENV` - Set to `development`, `staging`, or `production`
- [ ] `PORT` - Backend server port (default: 5000)
- [ ] `ENTRA_EXTERNAL_ID_TENANT_ID` - Your B2C tenant domain
- [ ] `ENTRA_EXTERNAL_ID_CLIENT_ID` - Application client ID from Azure
- [ ] `ENTRA_EXTERNAL_ID_CLIENT_SECRET` - Client secret from Azure
- [ ] `ENTRA_EXTERNAL_ID_POLICY_NAME` - User flow name (e.g., B2C_1_signupsignin1)
- [ ] `APPLICATION_INSIGHTS_CONNECTION_STRING` - For monitoring and logging

### Security Variables (Critical)
- [ ] `JWT_SECRET` - At least 32 characters, randomly generated
- [ ] `SESSION_SECRET` - At least 32 characters, randomly generated
- [ ] `ENCRYPTION_KEY` - Exactly 32 characters for AES-256 encryption

### Optional but Recommended
- [ ] `AZURE_KEY_VAULT_URL` - For secure secret management
- [ ] `CORS_ORIGINS` - Allowed frontend origins
- [ ] `LOG_LEVEL` - Logging verbosity (debug, info, warn, error)
- [ ] `RATE_LIMIT_MAX_REQUESTS` - API rate limiting

## 🧪 Test Suite Execution Guide

### Prerequisites Checklist

- [ ] **Node.js Version**
  - Ensure Node.js 16+ is installed
  - Run: `node --version`

- [ ] **Dependencies Installation**
  ```bash
  # Backend dependencies
  cd backend
  npm install
  
  # Frontend dependencies  
  cd ../frontend
  npm install
  ```

- [ ] **Environment Variables**
  - Backend `.env` file configured
  - Frontend `.env` file configured
  - All critical variables set

### Test Suite Execution Checklist

#### 1. Unit Tests
- [ ] **Backend Unit Tests**
  ```bash
  cd backend
  npm run test:unit
  ```
  - Tests: Configuration, middleware, services
  - Expected: 50+ unit tests passing

- [ ] **Frontend Unit Tests**
  ```bash
  cd frontend
  npm run test:auth
  ```
  - Tests: Authentication components, hooks
  - Expected: 400+ component tests passing

#### 2. Integration Tests
- [ ] **Authentication Flow Tests**
  ```bash
  cd backend
  npm run test:integration:auth
  ```
  - Tests: End-to-end authentication flows
  - Expected: 120+ integration tests passing

- [ ] **OAuth Integration Tests**
  ```bash
  cd backend
  npm run test:oauth-integration
  ```
  - Tests: Google and Microsoft OAuth flows
  - Expected: 240+ OAuth tests passing

#### 3. Security Tests
- [ ] **Comprehensive Security Testing**
  ```bash
  cd backend
  npm run test:security-comprehensive
  ```
  - Tests: Token validation, session security, API protection
  - Expected: 310+ security tests passing

#### 4. GDPR Compliance Tests
- [ ] **GDPR Validation**
  ```bash
  cd backend
  npm run test:gdpr
  ```
  - Tests: Data portability, right to erasure, consent management
  - Expected: 410+ GDPR compliance tests passing

#### 5. Load Testing
- [ ] **Performance Load Tests**
  ```bash
  cd backend
  npm run test:load
  ```
  - Tests: Concurrent users, API performance
  - Expected: 45+ load test scenarios passing

#### 6. Deployment Tests
- [ ] **Deployment Validation**
  ```bash
  cd backend
  npm run test:deployment
  ```
  - Tests: Deployment readiness, rollback procedures
  - Expected: 55+ deployment tests passing

### Complete Test Suite
- [ ] **Run All Tests**
  ```bash
  cd backend
  npm run test:coverage
  ```
  - Generates comprehensive test coverage report
  - Target: >80% code coverage

## 🔍 Troubleshooting Guide

### Common Issues and Solutions

#### Microsoft Entra External ID Connection Issues
- [ ] **Verify Tenant Configuration**
  - Check tenant ID format: `your-tenant.onmicrosoft.com`
  - Verify B2C domain: `your-tenant.ciamlogin.com`

- [ ] **Application Registration Issues**
  - Ensure redirect URIs match exactly
  - Verify client secret hasn't expired
  - Check API permissions are granted

#### Environment Variable Issues
- [ ] **Missing Variables**
  - Run: `npm run validate-env` (if available)
  - Check `.env` file exists and is properly formatted
  - Verify no trailing spaces or special characters

#### Test Failures
- [ ] **Module Compatibility Issues**
  - Update Jest configuration for ES modules
  - Check Node.js version compatibility
  - Clear node_modules and reinstall if needed

#### Network and CORS Issues
- [ ] **CORS Configuration**
  - Verify `CORS_ORIGINS` includes frontend URL
  - Check protocol (http vs https) matches
  - Ensure no trailing slashes in URLs

## 📊 Success Criteria

### Test Suite Success Metrics
- [ ] **Unit Tests**: >95% passing (Target: 50+ tests)
- [ ] **Integration Tests**: >90% passing (Target: 360+ tests)  
- [ ] **Security Tests**: >95% passing (Target: 310+ tests)
- [ ] **GDPR Tests**: >90% passing (Target: 410+ tests)
- [ ] **Load Tests**: >80% passing (Target: 45+ scenarios)
- [ ] **Deployment Tests**: >90% passing (Target: 55+ tests)

### Code Coverage Targets
- [ ] **Overall Coverage**: >80%
- [ ] **Authentication Logic**: >95%
- [ ] **Security Middleware**: >90%
- [ ] **GDPR Services**: >85%
- [ ] **API Endpoints**: >80%

## 🚀 Next Steps After Setup

1. **Complete Environment Setup**: Follow all checklists above
2. **Run Test Suite**: Execute all test categories
3. **Review Test Results**: Address any failures
4. **Configure Production**: Set up production environment variables
5. **Deploy to Staging**: Test with staging environment
6. **Production Deployment**: Deploy to production with monitoring

## 📞 Support and Resources

- **Microsoft Entra External ID Documentation**: [https://docs.microsoft.com/en-us/azure/active-directory-b2c/](https://docs.microsoft.com/en-us/azure/active-directory-b2c/)
- **Application Insights Setup**: [https://docs.microsoft.com/en-us/azure/azure-monitor/app/nodejs](https://docs.microsoft.com/en-us/azure/azure-monitor/app/nodejs)
- **DNS Configuration**: Contact Porkbun support for advanced DNS setup
- **SSL Certificates**: Use Azure App Service managed certificates or Let's Encrypt

---

**⚠️ Important Security Notes:**
- Never commit `.env` files to version control
- Use Azure Key Vault for production secrets
- Rotate client secrets every 12-24 months
- Enable audit logging for all authentication events
- Regular security testing and monitoring
