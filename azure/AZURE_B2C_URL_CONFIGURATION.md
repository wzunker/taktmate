# Azure AD B2C URL Configuration Guide for TaktMate

## Overview
This guide provides comprehensive instructions for configuring Azure AD B2C redirect URLs and authentication settings for different environments, including automated scripts for URL management, validation, and troubleshooting.

## 🔐 Azure AD B2C URL Configuration Concepts

### Redirect URLs
- **Sign-in Redirect URLs**: Where users are redirected after successful authentication
- **Logout URLs**: Where users are redirected after signing out
- **Error Redirect URLs**: Where users are redirected if authentication fails

### URL Requirements
- **Production/Staging**: Must use HTTPS
- **Development**: Can use HTTP (localhost only)
- **Format**: Must be exact matches (no wildcards)
- **Case Sensitive**: URLs must match exactly

## 🏗️ Environment Configuration

### Production Environment
```bash
Tenant: taktmate.onmicrosoft.com
Frontend: https://app.taktmate.com
Backend: https://api.taktmate.com
Key Vault: taktmate-kv-prod

Required Redirect URLs:
- https://app.taktmate.com
- https://app.taktmate.com/
- https://app.taktmate.com/auth/callback
- https://app.taktmate.com/auth/redirect

Logout URL:
- https://app.taktmate.com
```

### Staging Environment
```bash
Tenant: taktmate-staging.onmicrosoft.com
Frontend: https://staging.taktmate.com
Backend: https://api-staging.taktmate.com
Key Vault: taktmate-kv-staging

Required Redirect URLs:
- https://staging.taktmate.com
- https://staging.taktmate.com/
- https://staging.taktmate.com/auth/callback
- https://staging.taktmate.com/auth/redirect

Logout URL:
- https://staging.taktmate.com
```

### Development Environment
```bash
Tenant: taktmate-dev.onmicrosoft.com
Frontend: http://localhost:3000
Backend: http://localhost:3001
Key Vault: taktmate-kv-dev

Required Redirect URLs:
- http://localhost:3000
- http://localhost:3000/
- http://localhost:3000/auth/callback
- http://127.0.0.1:3000
- http://127.0.0.1:3000/
- http://127.0.0.1:3000/auth/callback

Logout URL:
- http://localhost:3000
```

## 🛠️ Configuration Scripts

### 1. Configure B2C URLs Script

#### Bash Usage
```bash
cd azure
./configure-b2c-urls.sh production taktmate 12345678-1234-1234-1234-123456789012 https://app.taktmate.com https://api.taktmate.com
./configure-b2c-urls.sh staging taktmate-staging 87654321-4321-4321-4321-210987654321 https://staging.taktmate.com https://api-staging.taktmate.com
./configure-b2c-urls.sh development taktmate-dev 11111111-2222-3333-4444-555555555555 http://localhost:3000 http://localhost:3001
```

#### PowerShell Usage
```powershell
cd azure
.\configure-b2c-urls.ps1 -Environment "production" -TenantName "taktmate" -AppId "12345678-1234-1234-1234-123456789012" -FrontendUrl "https://app.taktmate.com" -BackendUrl "https://api.taktmate.com"
```

#### Script Features
- **Automatic URL Generation**: Creates all required redirect URLs
- **Environment-Specific**: Different configurations per environment
- **Validation**: Checks for HTTPS requirement in production
- **Azure CLI Integration**: Updates Azure AD B2C application directly
- **Backup**: Saves configuration to JSON file
- **CORS Recommendations**: Provides backend CORS configuration guidance

### 2. Test B2C URLs Script

#### Usage
```bash
./test-b2c-urls.sh production taktmate 12345678-1234-1234-1234-123456789012 https://app.taktmate.com
./test-b2c-urls.sh staging taktmate-staging 87654321-4321-4321-4321-210987654321 https://staging.taktmate.com
./test-b2c-urls.sh development taktmate-dev 11111111-2222-3333-4444-555555555555 http://localhost:3000
```

#### Test Categories
- **Application Existence**: Verifies B2C application is accessible
- **Redirect URI Configuration**: Checks all required URLs are configured
- **Logout URL Configuration**: Validates logout redirect
- **Implicit Grant Settings**: Ensures proper token issuance settings
- **HTTPS Requirement**: Validates secure URLs for production/staging
- **Discovery Endpoint**: Tests B2C OpenID Connect discovery
- **Frontend Accessibility**: Checks if frontend URL is reachable

### 3. Manage B2C Configuration Script

#### Generate Environment Variables
```bash
./manage-b2c-config.sh generate-env production
./manage-b2c-config.sh generate-env staging
./manage-b2c-config.sh generate-env development
```

#### Update Key Vault Secrets
```bash
./manage-b2c-config.sh update-secrets production
./manage-b2c-config.sh update-secrets staging
```

#### Validate Configuration
```bash
./manage-b2c-config.sh validate production
./manage-b2c-config.sh validate staging
./manage-b2c-config.sh validate development
```

#### Export/Import Configuration
```bash
# Export configuration
./manage-b2c-config.sh export production b2c-prod-config.json

# Import configuration
./manage-b2c-config.sh import staging b2c-prod-config.json
```

## 📋 Step-by-Step Configuration Process

### Step 1: Prepare Azure AD B2C Application
1. **Create B2C Tenant** (if not exists)
   ```bash
   az account set --subscription "your-subscription-id"
   ```

2. **Get Application ID**
   - Navigate to Azure Portal > Azure AD B2C > App registrations
   - Find your TaktMate application
   - Copy the Application (client) ID

3. **Note Tenant Information**
   - Tenant name (e.g., taktmate)
   - Full tenant domain (e.g., taktmate.onmicrosoft.com)

### Step 2: Configure Redirect URLs
1. **Run Configuration Script**
   ```bash
   ./configure-b2c-urls.sh production taktmate YOUR_APP_ID https://app.taktmate.com https://api.taktmate.com
   ```

2. **Verify Configuration**
   ```bash
   ./test-b2c-urls.sh production taktmate YOUR_APP_ID https://app.taktmate.com
   ```

3. **Update Environment Variables**
   ```bash
   ./manage-b2c-config.sh generate-env production
   ```

### Step 3: Update Application Configuration
1. **Frontend Environment Variables**
   ```bash
   # Copy generated frontend-env-production.env to frontend/.env.production
   cp frontend-env-production.env ../frontend/.env.production
   ```

2. **Backend Environment Variables**
   ```bash
   # Update Key Vault secrets
   ./manage-b2c-config.sh update-secrets production
   
   # Or update environment variables directly
   export AZURE_AD_B2C_TENANT_NAME="taktmate.onmicrosoft.com"
   export AZURE_AD_B2C_CLIENT_ID="your-client-id"
   export AZURE_AD_B2C_CLIENT_SECRET="your-client-secret"
   ```

3. **CORS Configuration**
   Update your backend CORS settings to allow the frontend domain:
   ```javascript
   const corsOptions = {
     origin: [
       'https://app.taktmate.com',      // Production
       'https://staging.taktmate.com',   // Staging
       'http://localhost:3000'          // Development
     ],
     credentials: true
   };
   ```

### Step 4: Test Authentication Flow
1. **Manual Testing**
   - Navigate to your frontend URL
   - Click "Sign In" button
   - Complete B2C authentication
   - Verify successful redirect to callback URL
   - Test sign out functionality

2. **Automated Testing**
   ```bash
   ./test-b2c-urls.sh production taktmate YOUR_APP_ID https://app.taktmate.com
   ```

## 🔧 Environment-Specific Configuration

### Frontend Environment Variables

#### Production (.env.production)
```bash
REACT_APP_AZURE_AD_B2C_CLIENT_ID=your-production-client-id
REACT_APP_AZURE_AD_B2C_AUTHORITY=https://taktmate.b2clogin.com/taktmate.onmicrosoft.com/B2C_1_signupsignin
REACT_APP_AZURE_AD_B2C_KNOWN_AUTHORITY=taktmate.b2clogin.com
REACT_APP_AZURE_AD_B2C_TENANT_NAME=taktmate.onmicrosoft.com
REACT_APP_AZURE_AD_B2C_SCOPE=openid profile
REACT_APP_AZURE_AD_B2C_SIGNUP_SIGNIN_POLICY=B2C_1_signupsignin
REACT_APP_AZURE_AD_B2C_EDIT_PROFILE_POLICY=B2C_1_profileediting
REACT_APP_AZURE_AD_B2C_RESET_PASSWORD_POLICY=B2C_1_passwordreset
REACT_APP_REDIRECT_URI=https://app.taktmate.com/auth/callback
REACT_APP_POST_LOGOUT_REDIRECT_URI=https://app.taktmate.com
REACT_APP_API_BASE_URL=https://api.taktmate.com
```

#### Staging (.env.staging)
```bash
REACT_APP_AZURE_AD_B2C_CLIENT_ID=your-staging-client-id
REACT_APP_AZURE_AD_B2C_AUTHORITY=https://taktmate-staging.b2clogin.com/taktmate-staging.onmicrosoft.com/B2C_1_signupsignin
REACT_APP_AZURE_AD_B2C_KNOWN_AUTHORITY=taktmate-staging.b2clogin.com
REACT_APP_AZURE_AD_B2C_TENANT_NAME=taktmate-staging.onmicrosoft.com
REACT_APP_REDIRECT_URI=https://staging.taktmate.com/auth/callback
REACT_APP_POST_LOGOUT_REDIRECT_URI=https://staging.taktmate.com
REACT_APP_API_BASE_URL=https://api-staging.taktmate.com
```

#### Development (.env.development)
```bash
REACT_APP_AZURE_AD_B2C_CLIENT_ID=your-dev-client-id
REACT_APP_AZURE_AD_B2C_AUTHORITY=https://taktmate-dev.b2clogin.com/taktmate-dev.onmicrosoft.com/B2C_1_signupsignin
REACT_APP_AZURE_AD_B2C_KNOWN_AUTHORITY=taktmate-dev.b2clogin.com
REACT_APP_AZURE_AD_B2C_TENANT_NAME=taktmate-dev.onmicrosoft.com
REACT_APP_REDIRECT_URI=http://localhost:3000/auth/callback
REACT_APP_POST_LOGOUT_REDIRECT_URI=http://localhost:3000
REACT_APP_API_BASE_URL=http://localhost:3001
```

### Backend Environment Variables

#### Key Vault Integration
```bash
# Key Vault URL
KEY_VAULT_URL=https://taktmate-kv-prod.vault.azure.net/

# B2C Configuration (stored in Key Vault)
AZURE_AD_B2C_TENANT_NAME=@Microsoft.KeyVault(VaultName=taktmate-kv-prod;SecretName=Azure-AD-B2C-Tenant-Name)
AZURE_AD_B2C_CLIENT_ID=@Microsoft.KeyVault(VaultName=taktmate-kv-prod;SecretName=Azure-AD-B2C-Client-ID)
AZURE_AD_B2C_CLIENT_SECRET=@Microsoft.KeyVault(VaultName=taktmate-kv-prod;SecretName=Azure-AD-B2C-Client-Secret)
```

#### Direct Environment Variables
```bash
# B2C Configuration
AZURE_AD_B2C_TENANT_NAME=taktmate.onmicrosoft.com
AZURE_AD_B2C_CLIENT_ID=your-client-id
AZURE_AD_B2C_CLIENT_SECRET=your-client-secret
AZURE_AD_B2C_POLICY_NAME=B2C_1_signupsignin

# CORS Configuration
ALLOWED_ORIGINS=https://app.taktmate.com,https://staging.taktmate.com
```

## 🧪 Testing and Validation

### Automated Testing
```bash
# Test all environments
./test-b2c-urls.sh production taktmate YOUR_PROD_APP_ID https://app.taktmate.com
./test-b2c-urls.sh staging taktmate-staging YOUR_STAGING_APP_ID https://staging.taktmate.com
./test-b2c-urls.sh development taktmate-dev YOUR_DEV_APP_ID http://localhost:3000

# Validate configuration
./manage-b2c-config.sh validate production
./manage-b2c-config.sh validate staging
./manage-b2c-config.sh validate development
```

### Manual Testing Checklist
- [ ] Navigate to frontend URL
- [ ] Click "Sign In" button
- [ ] Redirected to B2C login page
- [ ] Complete authentication (email/password or social)
- [ ] Redirected back to frontend callback URL
- [ ] User information displayed correctly
- [ ] Click "Sign Out" button
- [ ] Redirected to B2C logout page
- [ ] Redirected back to frontend home page
- [ ] User session cleared

### Browser Testing
Test in multiple browsers and environments:
- **Chrome**: Regular and incognito mode
- **Firefox**: Regular and private mode
- **Safari**: Regular and private mode
- **Edge**: Regular and InPrivate mode
- **Mobile browsers**: iOS Safari, Android Chrome

## 🔒 Security Considerations

### HTTPS Requirements
- **Production**: All URLs must use HTTPS
- **Staging**: All URLs must use HTTPS
- **Development**: HTTP allowed for localhost only

### URL Validation
- **Exact Match**: B2C requires exact URL matches
- **No Wildcards**: Cannot use wildcard patterns
- **Case Sensitive**: URLs are case-sensitive
- **Trailing Slashes**: Include both with and without trailing slash

### CORS Configuration
```javascript
// Backend CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://app.taktmate.com',
      'https://staging.taktmate.com',
      'http://localhost:3000',
      'http://127.0.0.1:3000'
    ];
    
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
```

## 🚀 Deployment Integration

### GitHub Actions Integration
```yaml
# In .github/workflows/deploy.yml
- name: Configure B2C URLs for Production
  run: |
    cd azure
    ./configure-b2c-urls.sh production taktmate ${{ secrets.B2C_APP_ID }} https://app.taktmate.com https://api.taktmate.com

- name: Test B2C Configuration
  run: |
    cd azure
    ./test-b2c-urls.sh production taktmate ${{ secrets.B2C_APP_ID }} https://app.taktmate.com
```

### Azure DevOps Integration
```yaml
# In azure-pipelines.yml
- script: |
    cd azure
    ./configure-b2c-urls.sh $(Environment) $(TenantName) $(B2CAppId) $(FrontendUrl) $(BackendUrl)
    ./test-b2c-urls.sh $(Environment) $(TenantName) $(B2CAppId) $(FrontendUrl)
  displayName: 'Configure and Test B2C URLs'
```

## 🔧 Troubleshooting

### Common Issues

#### 1. Redirect URI Mismatch
**Error**: `AADB2C90006: The redirect URI provided in the request is not registered for the client id`

**Solutions**:
- Verify redirect URI is exactly configured in B2C application
- Check for trailing slashes, case sensitivity
- Run configuration script to add missing URLs
- Use test script to validate current configuration

#### 2. HTTPS Requirement
**Error**: Authentication fails in production with HTTP URLs

**Solutions**:
- Ensure all production URLs use HTTPS
- Update SSL certificates
- Configure proper DNS records
- Test with curl to verify HTTPS accessibility

#### 3. CORS Issues
**Error**: Frontend cannot access backend API after authentication

**Solutions**:
- Update backend CORS configuration
- Include frontend domain in allowed origins
- Enable credentials in CORS settings
- Test with browser developer tools

#### 4. Token Validation Issues
**Error**: Backend rejects B2C tokens

**Solutions**:
- Verify tenant name in backend configuration
- Check client ID matches B2C application
- Validate JWT signing keys are accessible
- Test token validation with sample requests

### Debug Commands

#### Check B2C Application Configuration
```bash
az ad app show --id YOUR_APP_ID --query "{redirectUris:web.redirectUris, logoutUrl:web.logoutUrl, implicitGrant:web.implicitGrantSettings}"
```

#### Test B2C Discovery Endpoint
```bash
curl -s "https://your-tenant.b2clogin.com/your-tenant.onmicrosoft.com/B2C_1_signupsignin/v2.0/.well-known/openid_configuration" | jq .
```

#### Validate Frontend Configuration
```bash
# Check if frontend environment variables are loaded
curl -s "https://app.taktmate.com" | grep -o "REACT_APP_[^\"]*"
```

#### Test Backend CORS
```bash
curl -H "Origin: https://app.taktmate.com" -H "Access-Control-Request-Method: GET" -H "Access-Control-Request-Headers: Authorization" -X OPTIONS https://api.taktmate.com/api/health
```

## 📊 Monitoring and Maintenance

### B2C Analytics
Monitor authentication metrics in Azure Portal:
- **Sign-in Success Rate**: Track successful vs. failed authentications
- **User Registration**: Monitor new user sign-ups
- **Policy Usage**: Track which authentication flows are used
- **Error Rates**: Monitor authentication errors and failures

### Alerts and Notifications
Set up alerts for:
- High authentication failure rates
- Unusual sign-in patterns
- Configuration changes
- Certificate expiration

### Regular Maintenance
- **Monthly**: Review and rotate client secrets
- **Quarterly**: Update redirect URLs for new environments
- **Annually**: Review and update B2C policies
- **As Needed**: Update URLs for domain changes

## 📚 Additional Resources

### Documentation
- [Azure AD B2C Documentation](https://docs.microsoft.com/en-us/azure/active-directory-b2c/)
- [MSAL.js Documentation](https://docs.microsoft.com/en-us/azure/active-directory/develop/msal-js-initializing-client-applications)
- [B2C Custom Policies](https://docs.microsoft.com/en-us/azure/active-directory-b2c/custom-policy-overview)

### Tools
- [JWT.io](https://jwt.io/) - JWT token decoder
- [B2C Policy Explorer](https://docs.microsoft.com/en-us/azure/active-directory-b2c/troubleshoot-custom-policies)
- [Azure AD B2C Community Samples](https://github.com/azure-ad-b2c/samples)

This comprehensive B2C URL configuration provides production-ready authentication setup with automated deployment, comprehensive testing, and detailed troubleshooting guidance for the TaktMate application.
