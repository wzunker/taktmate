# Azure AD B2C Integration for TaktMate

This directory contains all Azure AD B2C authentication setup and configuration files for the TaktMate CSV chat application.

## 🚀 Quick Start

### Prerequisites
- Azure subscription with Azure AD B2C access
- Node.js 18+ and npm
- Domain name (recommended: `app.taktconnect.com`)

### Setup Commands
```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
cp backend/env.example backend/.env
# Edit .env with your Azure AD B2C settings

# 3. Run configuration tests
npm run test:config

# 4. Test complete setup
npm run test:all
```

## 📚 Documentation

| Document | Purpose | When to Use |
|----------|---------|-------------|
| **[AZURE_AD_B2C_COMPLETE_SETUP_GUIDE.md](AZURE_AD_B2C_COMPLETE_SETUP_GUIDE.md)** | Complete setup from scratch | Initial setup and configuration |
| **[AZURE_AD_B2C_SETUP.md](AZURE_AD_B2C_SETUP.md)** | Detailed technical reference | Development and troubleshooting |
| **[AZURE_AD_B2C_TESTING_GUIDE.md](AZURE_AD_B2C_TESTING_GUIDE.md)** | Testing procedures | Validation and quality assurance |
| **[AZURE_APP_REGISTRATION_GUIDE.md](AZURE_APP_REGISTRATION_GUIDE.md)** | Application registration | App setup and configuration |

## 🛠️ Configuration Files

### Core Configuration
- **`backend/config/azureAdB2C.js`** - Main configuration module
- **`backend/env.example`** - Environment variables template
- **`backend/middleware/jwtValidation.js`** - JWT token validation middleware

### Testing Scripts
- **`backend/scripts/test-user-flows.js`** - User flow testing
- **`backend/scripts/test-jwt-claims.js`** - JWT token validation testing
- **`backend/scripts/test-e2e-flows.js`** - End-to-end integration testing
- **`backend/scripts/validate-app-registration.js`** - Application validation
- **`backend/scripts/generate-custom-policies.js`** - Custom policy generator

## 🧪 Testing Commands

```bash
# Complete test suite
npm run test:all

# Individual test categories  
npm run test:config          # Configuration validation
npm run test:user-flows      # User flow testing
npm run test:jwt-claims      # JWT token claims testing
npm run test:e2e             # End-to-end testing
npm run test:connectivity    # Endpoint connectivity
npm run test:performance     # Performance benchmarks

# Validation utilities
npm run validate:app         # Application registration validation
npm run generate:policies    # Generate custom policy XML files
```

## 🏗️ Architecture Overview

```
Frontend (React)     Azure AD B2C Tenant     Backend (Node.js)
┌─────────────────┐  ┌──────────────────┐    ┌─────────────────┐
│ • Authentication│◄─┤ • User Flows     │───►│ • JWT Validation│
│ • Protected     │  │ • Custom Policies│    │ • User Profile  │
│   Routes        │  │ • Identity       │    │ • Protected     │
│ • User Profile  │  │   Providers      │    │   Endpoints     │
└─────────────────┘  └──────────────────┘    └─────────────────┘
```

## 🔑 Key Features

### Authentication Methods
- ✅ **Email/Password** - Traditional account creation and login
- ✅ **Google OAuth** - Social login with Google accounts  
- ✅ **Microsoft OAuth** - Social login with Microsoft/work accounts
- ✅ **Password Reset** - Self-service password recovery
- ✅ **Profile Editing** - User profile management

### User Profile Information
- ✅ **Basic Info** - Name, email, verified status
- ✅ **Company Details** - Company name and industry
- ✅ **Role Information** - Job title and responsibilities
- ✅ **Authentication Metadata** - Provider, verification status

### Security Features
- ✅ **JWT Token Validation** - RS256 signature verification
- ✅ **Token Expiration** - Configurable token lifetimes
- ✅ **JWKS Key Caching** - Performance-optimized key retrieval
- ✅ **Role-Based Access** - Flexible authorization middleware
- ✅ **Audit Logging** - Comprehensive security monitoring

## ⚙️ Configuration

### Required Environment Variables
```env
# Azure AD B2C Tenant
AZURE_AD_B2C_TENANT_NAME=taktmate
AZURE_AD_B2C_TENANT_ID=your-tenant-id
AZURE_AD_B2C_CLIENT_ID=your-client-id
AZURE_AD_B2C_CLIENT_SECRET=your-client-secret

# User Flow Policies
AZURE_AD_B2C_SIGNUP_SIGNIN_POLICY=B2C_1_signupsignin1
AZURE_AD_B2C_PASSWORD_RESET_POLICY=B2C_1_passwordreset1
AZURE_AD_B2C_PROFILE_EDIT_POLICY=B2C_1_profileedit1

# Application URLs
FRONTEND_URL=https://app.taktconnect.com
BACKEND_URL=https://api.taktconnect.com
```

### User Flow Configuration
- **Sign-up/Sign-in**: Collects name, email, company, role
- **Password Reset**: Email-based password recovery
- **Profile Edit**: Updates user information
- **Token Lifetime**: 60 minutes (configurable)
- **Session Lifetime**: 7 days with sliding window

## 🚦 Setup Status

### Task 1.0: Azure AD B2C Setup and Configuration
- [x] **1.1** Create Azure AD B2C tenant and configure basic settings
- [x] **1.2** Set up user flows for sign-up and sign-in with Google, Microsoft, and email/password
- [x] **1.3** Configure custom policies to collect additional user attributes (company, role)
- [x] **1.4** Register TaktMate application in Azure AD B2C with proper redirect URLs
- [x] **1.5** Configure JWT token claims to include user profile information
- [x] **1.6** Test Azure AD B2C user flows and token generation
- [x] **1.7** Document Azure AD B2C configuration and setup process

### Next Steps: Backend Integration
- [ ] **2.1** Install and configure Azure AD B2C authentication dependencies
- [ ] **2.2** Create Azure AD B2C configuration module with environment variables
- [ ] **2.3** Implement JWT token validation middleware for API protection
- [ ] **2.4** Create authentication routes for login, logout, and user profile

## 🔧 Development Workflow

### 1. Initial Setup
```bash
# Follow complete setup guide
open AZURE_AD_B2C_COMPLETE_SETUP_GUIDE.md

# Configure Azure AD B2C tenant
# Set up user flows and custom policies
# Register application
```

### 2. Configuration
```bash
# Copy environment template
cp backend/env.example backend/.env

# Update with your Azure AD B2C settings
# Test configuration
npm run test:config
```

### 3. Testing
```bash
# Run comprehensive tests
npm run test:all

# Manual testing with Azure portal
# Test authentication flows
# Verify token claims
```

### 4. Integration
```bash
# Implement backend middleware
# Add frontend authentication
# Test end-to-end integration
```

## 🐛 Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Configuration validation failed | Missing environment variables | Check `.env` file against `env.example` |
| JWKS endpoint connectivity failed | Network or tenant issues | Verify tenant name and connectivity |
| Token validation failed | Clock skew or config issues | Check system time and issuer/audience |
| Missing custom claims | User flow configuration | Verify application claims in user flow |
| Social login not working | Provider configuration | Check client ID/secret and redirect URIs |

### Diagnostic Commands
```bash
npm run test:config          # Check configuration
npm run test:connectivity    # Test endpoints
npm run test:jwt-claims      # Validate tokens
npm run validate:app         # Check app registration
```

## 📖 Additional Resources

### Azure Documentation
- [Azure AD B2C Overview](https://docs.microsoft.com/azure/active-directory-b2c/)
- [User Flows](https://docs.microsoft.com/azure/active-directory-b2c/user-flow-overview)
- [Custom Policies](https://docs.microsoft.com/azure/active-directory-b2c/custom-policy-overview)
- [Application Registration](https://docs.microsoft.com/azure/active-directory-b2c/tutorial-register-applications)

### TaktMate Specific
- **Configuration Module**: `backend/config/azureAdB2C.js`
- **JWT Middleware**: `backend/middleware/jwtValidation.js`
- **Testing Scripts**: `backend/scripts/test-*.js`
- **Environment Template**: `backend/env.example`

## 🤝 Contributing

When making changes to Azure AD B2C configuration:

1. **Update Documentation** - Keep all guides current
2. **Test Changes** - Run full test suite
3. **Update Scripts** - Modify testing utilities as needed
4. **Environment Variables** - Update `env.example` template
5. **Validate** - Ensure all tests pass before deployment

## 📞 Support

For Azure AD B2C setup and configuration issues:

1. **Check Documentation** - Review setup guides and troubleshooting
2. **Run Diagnostics** - Use testing scripts to identify issues  
3. **Review Logs** - Check application and Azure AD B2C audit logs
4. **Test Configuration** - Use validation scripts to verify setup

---

**Ready to get started?** Follow the [Complete Setup Guide](AZURE_AD_B2C_COMPLETE_SETUP_GUIDE.md) for step-by-step instructions.
