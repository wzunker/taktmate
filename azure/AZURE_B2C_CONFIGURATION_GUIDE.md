# Azure AD B2C Configuration Guide for TaktMate

## Overview
This guide provides comprehensive instructions for configuring Azure AD B2C redirect URLs and authentication settings for the TaktMate application's custom domains. It covers redirect URL management, policy configuration, authentication flow testing, and integration with custom domains across all environments.

## 🏗️ Azure AD B2C Architecture

### B2C Authentication Flow with Custom Domains
```
┌─────────────────────────────────────────────────────────────┐
│                TaktMate B2C Authentication Flow            │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌──────────────────┐    ┌─────────┐ │
│  │     User        │    │   Custom Domain  │    │  Azure  │ │
│  │   Browser       │    │   Frontend       │    │ AD B2C  │ │
│  │                 │    │                  │    │ Tenant  │ │
│  │ 1. Access App   │───▶│ 2. Redirect to   │───▶│ 3. Auth │ │
│  │ 8. Access App   │◀───│ 7. Auth Callback │◀───│ 4. Login│ │
│  │    with Token   │    │    with Code     │    │ 5. Code │ │
│  │                 │    │ 6. Exchange Code │───▶│ 6. Token│ │
│  └─────────────────┘    │    for Token     │    │         │ │
│                         └──────────────────┘    └─────────┘ │
├─────────────────────────────────────────────────────────────┤
│                     Custom Domain URLs                     │
├─────────────────────────────────────────────────────────────┤
│  Production:   https://app.taktconnect.com                 │
│  Staging:      https://staging.taktconnect.com             │
│  Development:  https://dev.taktconnect.com                 │
└─────────────────────────────────────────────────────────────┘
```

### B2C Redirect URL Configuration
```yaml
Redirect URL Types:
  Web Redirect URIs:
    - Authentication callback URLs
    - Post-logout redirect URLs
    - Error handling URLs
  
  SPA Redirect URIs:
    - Single Page Application callback URLs
    - Silent authentication URLs
    - Token renewal URLs

URL Patterns:
  Callback URLs: https://{domain}/auth/callback
  Base URLs: https://{domain}/
  Logout URLs: https://{domain}/
  
Environment Mapping:
  Production: app.taktconnect.com, www.taktconnect.com
  Staging: staging.taktconnect.com
  Development: dev.taktconnect.com
```

## 🛠️ B2C Configuration Management Tools

### 1. B2C Redirect URL Management Script
**File**: `azure/update-b2c-redirect-urls.sh`

#### Key Features
- **Multi-environment B2C configuration** management
- **Automated redirect URL updates** via Microsoft Graph API
- **Configuration backup and restore** capabilities
- **B2C policy integration** and validation
- **Custom domain URL generation** for all environments
- **Comprehensive validation** and testing

#### Usage Examples
```bash
# Update production B2C redirect URLs with backup
./update-b2c-redirect-urls.sh production taktconnect.com --update --validate --backup

# Validate all environments' B2C configuration
./update-b2c-redirect-urls.sh all taktconnect.com --validate --verbose

# Test B2C authentication flow with custom domains
./update-b2c-redirect-urls.sh staging taktconnect.com --test --dry-run
```

### 2. B2C Authentication Testing Script
**File**: `azure/test-b2c-authentication.sh`

#### Testing Capabilities
- **B2C endpoint accessibility** testing across all policies
- **Policy configuration validation** (SignUp/SignIn, Edit Profile, Reset Password)
- **Redirect URL configuration** verification
- **Token endpoint functionality** testing
- **CORS configuration** validation for B2C integration
- **Comprehensive authentication flow** testing

#### Usage Examples
```bash
# Comprehensive B2C authentication testing with report
./test-b2c-authentication.sh production taktconnect.com --comprehensive --report

# Test specific B2C components
./test-b2c-authentication.sh all taktconnect.com --endpoints --policies --redirects

# CORS and redirect testing
./test-b2c-authentication.sh staging taktconnect.com --redirects --cors --verbose
```

## 📋 B2C Configuration Setup Process

### Prerequisites
1. **Azure AD B2C tenant** created and configured
2. **B2C application registration** with appropriate permissions
3. **Custom domains** configured and accessible (Tasks 7.1-7.3)
4. **Azure CLI** with Microsoft Graph permissions
5. **B2C policies** created and published

### Step 1: Environment Variables Configuration
```bash
# Set B2C configuration (add to environment or .env file)
export B2C_TENANT_NAME="taktmate"
export B2C_TENANT_ID="your-tenant-id"
export B2C_CLIENT_ID="your-client-id"
export B2C_SIGNUP_SIGNIN_POLICY="B2C_1_signupsignin1"
export B2C_EDIT_PROFILE_POLICY="B2C_1_profileediting1"
export B2C_RESET_PASSWORD_POLICY="B2C_1_passwordreset1"
```

### Step 2: Azure CLI Authentication
```bash
# Login to Azure CLI with appropriate permissions
az login

# Install Microsoft Graph extension for B2C management
az extension add --name application

# Verify access to B2C tenant
az rest --method GET --url "https://graph.microsoft.com/v1.0/applications" --query "value[0].id"
```

### Step 3: Backup Current Configuration
```bash
# Backup existing B2C configuration before changes
./update-b2c-redirect-urls.sh production taktconnect.com --backup --verbose

# Verify backup was created
ls -la azure/b2c-backups/
```

### Step 4: Update B2C Redirect URLs
```bash
# Update production environment
./update-b2c-redirect-urls.sh production taktconnect.com --update --validate

# Update all environments
./update-b2c-redirect-urls.sh all taktconnect.com --update --validate --backup
```

### Step 5: Validate B2C Configuration
```bash
# Comprehensive validation and testing
./test-b2c-authentication.sh all taktconnect.com --comprehensive --report

# Verify redirect URLs are working
./update-b2c-redirect-urls.sh all taktconnect.com --test --verbose
```

## 🎯 Environment-Specific B2C Configuration

### Production Environment
**Domains**: `app.taktconnect.com`, `www.taktconnect.com`
**B2C Configuration**:

#### Redirect URLs
```yaml
Web Redirect URIs:
  - https://app.taktconnect.com/auth/callback
  - https://app.taktconnect.com/
  - https://www.taktconnect.com/auth/callback
  - https://www.taktconnect.com/

SPA Redirect URIs:
  - https://app.taktconnect.com/auth/callback
  - https://www.taktconnect.com/auth/callback

Logout URLs:
  - https://app.taktconnect.com/
  - https://www.taktconnect.com/
```

#### Configuration Commands
```bash
# Update production B2C configuration
./update-b2c-redirect-urls.sh production taktconnect.com --update --validate --backup

# Test production B2C authentication
./test-b2c-authentication.sh production taktconnect.com --comprehensive --report

# Validate production configuration
./update-b2c-redirect-urls.sh production taktconnect.com --validate --verbose
```

### Staging Environment
**Domain**: `staging.taktconnect.com`
**B2C Configuration**:

#### Redirect URLs
```yaml
Web Redirect URIs:
  - https://staging.taktconnect.com/auth/callback
  - https://staging.taktconnect.com/

SPA Redirect URIs:
  - https://staging.taktconnect.com/auth/callback

Logout URLs:
  - https://staging.taktconnect.com/
```

#### Configuration Commands
```bash
# Update staging B2C configuration
./update-b2c-redirect-urls.sh staging taktconnect.com --update --validate

# Test staging B2C authentication
./test-b2c-authentication.sh staging taktconnect.com --comprehensive

# Validate staging configuration
./update-b2c-redirect-urls.sh staging taktconnect.com --test --verbose
```

### Development Environment
**Domain**: `dev.taktconnect.com`
**B2C Configuration**:

#### Redirect URLs
```yaml
Web Redirect URIs:
  - https://dev.taktconnect.com/auth/callback
  - https://dev.taktconnect.com/

SPA Redirect URIs:
  - https://dev.taktconnect.com/auth/callback

Logout URLs:
  - https://dev.taktconnect.com/
```

#### Configuration Commands
```bash
# Update development B2C configuration
./update-b2c-redirect-urls.sh development taktconnect.com --update --validate

# Test development B2C authentication
./test-b2c-authentication.sh development taktconnect.com --endpoints --policies

# Validate development configuration
./update-b2c-redirect-urls.sh development taktconnect.com --test
```

## 🔧 B2C Policy Configuration

### B2C Policy Types and URLs

#### 1. Sign Up / Sign In Policy
```yaml
Policy Name: B2C_1_signupsignin1
Discovery URL: https://taktmate.b2clogin.com/taktmate.onmicrosoft.com/B2C_1_signupsignin1/v2.0/.well-known/openid_configuration
Authorization URL: https://taktmate.b2clogin.com/taktmate.onmicrosoft.com/B2C_1_signupsignin1/oauth2/v2.0/authorize
Token URL: https://taktmate.b2clogin.com/taktmate.onmicrosoft.com/B2C_1_signupsignin1/oauth2/v2.0/token
JWKS URL: https://taktmate.b2clogin.com/taktmate.onmicrosoft.com/B2C_1_signupsignin1/discovery/v2.0/keys
```

#### 2. Edit Profile Policy
```yaml
Policy Name: B2C_1_profileediting1
Discovery URL: https://taktmate.b2clogin.com/taktmate.onmicrosoft.com/B2C_1_profileediting1/v2.0/.well-known/openid_configuration
Authorization URL: https://taktmate.b2clogin.com/taktmate.onmicrosoft.com/B2C_1_profileediting1/oauth2/v2.0/authorize
Token URL: https://taktmate.b2clogin.com/taktmate.onmicrosoft.com/B2C_1_profileediting1/oauth2/v2.0/token
```

#### 3. Password Reset Policy
```yaml
Policy Name: B2C_1_passwordreset1
Discovery URL: https://taktmate.b2clogin.com/taktmate.onmicrosoft.com/B2C_1_passwordreset1/v2.0/.well-known/openid_configuration
Authorization URL: https://taktmate.b2clogin.com/taktmate.onmicrosoft.com/B2C_1_passwordreset1/oauth2/v2.0/authorize
Token URL: https://taktmate.b2clogin.com/taktmate.onmicrosoft.com/B2C_1_passwordreset1/oauth2/v2.0/token
```

### Policy Testing and Validation
```bash
# Test all B2C policies for production
./test-b2c-authentication.sh production taktconnect.com --policies --endpoints

# Validate policy configurations
./test-b2c-authentication.sh all taktconnect.com --policies --verbose

# Test specific policy endpoints
curl -s "https://taktmate.b2clogin.com/taktmate.onmicrosoft.com/B2C_1_signupsignin1/v2.0/.well-known/openid_configuration" | jq .
```

## 🧪 B2C Authentication Testing

### Authentication Flow Testing

#### 1. B2C Endpoint Accessibility Testing
```bash
# Test B2C discovery endpoints
./test-b2c-authentication.sh production taktconnect.com --endpoints --verbose

# Expected results:
# ✅ B2C Discovery Endpoint (SignUp/SignIn): Endpoint accessible
# ✅ B2C Discovery Document (SignUp/SignIn): Valid JSON document returned
# ✅ Authorization Endpoint (SignUp/SignIn): Found
# ✅ Token Endpoint (SignUp/SignIn): Found
# ✅ JWKS Endpoint (SignUp/SignIn): Found
```

#### 2. Policy Configuration Testing
```bash
# Test B2C policy configurations
./test-b2c-authentication.sh production taktconnect.com --policies --verbose

# Expected results:
# ✅ Authorization URL (SignUp/SignIn - app): HTTP 200 - Policy accessible
# ✅ Authorization URL (Edit Profile - app): HTTP 200 - Policy accessible
# ✅ Authorization URL (Reset Password - app): HTTP 200 - Policy accessible
```

#### 3. Redirect URL Configuration Testing
```bash
# Test redirect URL configurations
./test-b2c-authentication.sh production taktconnect.com --redirects --verbose

# Expected results:
# ✅ Web Redirect URI (app): Configured: https://app.taktconnect.com/auth/callback
# ✅ Base Redirect URI (app): Configured: https://app.taktconnect.com/
# ✅ Domain Accessibility (app): Domain accessible: https://app.taktconnect.com
```

#### 4. Token Endpoint Testing
```bash
# Test B2C token endpoints
./test-b2c-authentication.sh production taktconnect.com --tokens --verbose

# Expected results:
# ✅ JWKS Endpoint (SignUp/SignIn): Accessible
# ✅ JWKS Keys (SignUp/SignIn): 2 keys available
# ✅ Token Endpoint (SignUp/SignIn): Accessible (HTTP 400 - expected for invalid request)
```

#### 5. CORS Configuration Testing
```bash
# Test CORS configuration for B2C integration
./test-b2c-authentication.sh production taktconnect.com --cors --verbose

# Expected results:
# ✅ CORS Preflight (app): CORS preflight successful (HTTP 200)
# ✅ CORS Headers (app): CORS headers present
# ✅ B2C CORS Configuration: B2C accepts CORS requests from custom domain
```

### Comprehensive Authentication Testing
```bash
# Run complete B2C authentication test suite
./test-b2c-authentication.sh all taktconnect.com --comprehensive --report

# Test results summary:
# Total Tests: 45
# Passed: 42
# Failed: 0
# Warnings: 3
# Success Rate: 93.3%
```

## 🚨 B2C Configuration Troubleshooting

### Common B2C Issues and Solutions

#### 1. Redirect URL Not Configured
**Symptoms**: B2C authentication fails with redirect_uri_mismatch error
**Solutions**:
```bash
# Check current B2C configuration
az rest --method GET --url "https://graph.microsoft.com/v1.0/applications/$B2C_CLIENT_ID" --query "web.redirectUris"

# Update redirect URLs for all environments
./update-b2c-redirect-urls.sh all taktconnect.com --update --validate

# Verify redirect URLs are configured
./test-b2c-authentication.sh production taktconnect.com --redirects --verbose
```

#### 2. B2C Policy Not Accessible
**Symptoms**: B2C discovery endpoints return 404 or 500 errors
**Solutions**:
```bash
# Test B2C policy accessibility
./test-b2c-authentication.sh production taktconnect.com --policies --verbose

# Check B2C policy configuration in Azure portal
# Verify policy is published and active
# Check policy name matches environment variables

# Test specific policy endpoint
curl -I "https://taktmate.b2clogin.com/taktmate.onmicrosoft.com/B2C_1_signupsignin1/v2.0/.well-known/openid_configuration"
```

#### 3. CORS Issues with B2C
**Symptoms**: Browser CORS errors during B2C authentication
**Solutions**:
```bash
# Test CORS configuration
./test-b2c-authentication.sh production taktconnect.com --cors --verbose

# Update backend CORS configuration to include B2C domain
# Add https://taktmate.b2clogin.com to allowed origins

# Test CORS preflight requests
curl -H "Origin: https://taktmate.b2clogin.com" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS https://app.taktconnect.com
```

#### 4. Custom Domain Not Accessible
**Symptoms**: B2C redirect fails because custom domain is not accessible
**Solutions**:
```bash
# Test custom domain accessibility
curl -I https://app.taktconnect.com

# Verify DNS configuration
nslookup app.taktconnect.com
dig app.taktconnect.com CNAME

# Check SSL certificate
echo | openssl s_client -servername app.taktconnect.com -connect app.taktconnect.com:443

# Verify Static Web App configuration
az staticwebapp hostname show --name taktmate-frontend-prod --resource-group taktmate-prod-rg --hostname app.taktconnect.com
```

#### 5. B2C Application Configuration Issues
**Symptoms**: B2C authentication fails with invalid_client or configuration errors
**Solutions**:
```bash
# Verify B2C application configuration
az rest --method GET --url "https://graph.microsoft.com/v1.0/applications/$B2C_CLIENT_ID"

# Check client ID and tenant configuration
echo "Tenant: $B2C_TENANT_NAME"
echo "Client ID: $B2C_CLIENT_ID"

# Validate B2C configuration
./update-b2c-redirect-urls.sh production taktconnect.com --validate --verbose

# Test B2C application permissions
az rest --method GET --url "https://graph.microsoft.com/v1.0/applications/$B2C_CLIENT_ID/requiredResourceAccess"
```

### B2C Configuration Validation
```bash
# Comprehensive B2C configuration validation
validate_b2c_configuration() {
  local env="$1"
  
  echo "Validating B2C configuration for $env environment..."
  
  # Test B2C endpoints
  ./test-b2c-authentication.sh "$env" taktconnect.com --endpoints
  
  # Test policy configurations
  ./test-b2c-authentication.sh "$env" taktconnect.com --policies
  
  # Test redirect URLs
  ./test-b2c-authentication.sh "$env" taktconnect.com --redirects
  
  # Test CORS configuration
  ./test-b2c-authentication.sh "$env" taktconnect.com --cors
  
  echo "B2C validation completed for $env environment"
}

# Validate all environments
for env in production staging development; do
  validate_b2c_configuration "$env"
done
```

## 📊 B2C Monitoring and Maintenance

### B2C Configuration Monitoring

#### 1. Daily B2C Health Checks
```bash
#!/bin/bash
# Daily B2C health check script

environments=("production" "staging" "development")

for env in "${environments[@]}"; do
  echo "=== $env Environment B2C Health Check ==="
  
  # Test B2C endpoints
  ./test-b2c-authentication.sh "$env" taktconnect.com --endpoints --verbose
  
  # Test redirect configurations
  ./test-b2c-authentication.sh "$env" taktconnect.com --redirects
  
  echo ""
done
```

#### 2. B2C Configuration Backup
```bash
# Weekly B2C configuration backup
backup_b2c_configuration() {
  local timestamp=$(date +%Y%m%d-%H%M%S)
  local backup_file="azure/b2c-backups/weekly-backup-$timestamp.json"
  
  # Backup current B2C application configuration
  az rest --method GET --url "https://graph.microsoft.com/v1.0/applications/$B2C_CLIENT_ID" > "$backup_file"
  
  echo "B2C configuration backed up to: $backup_file"
}

backup_b2c_configuration
```

#### 3. B2C Performance Monitoring
```bash
# Monitor B2C endpoint response times
monitor_b2c_performance() {
  local policy="B2C_1_signupsignin1"
  local discovery_url="https://taktmate.b2clogin.com/taktmate.onmicrosoft.com/$policy/v2.0/.well-known/openid_configuration"
  
  local response_time=$(curl -w "%{time_total}" -o /dev/null -s "$discovery_url")
  local response_time_ms=$(echo "$response_time * 1000" | bc | cut -d'.' -f1)
  
  echo "B2C discovery endpoint response time: ${response_time_ms}ms"
  
  if [ $response_time_ms -gt 2000 ]; then
    echo "⚠️  Slow B2C response time detected"
  fi
}

monitor_b2c_performance
```

### B2C Configuration Updates

#### 1. Adding New Redirect URLs
```bash
# Add new redirect URL for a specific environment
add_redirect_url() {
  local env="$1"
  local new_url="$2"
  
  # Update B2C configuration with new URL
  ./update-b2c-redirect-urls.sh "$env" taktconnect.com --update --validate --backup
  
  # Verify new URL is configured
  ./test-b2c-authentication.sh "$env" taktconnect.com --redirects --verbose
}

# Example: Add new redirect URL for production
add_redirect_url "production" "https://app.taktconnect.com/auth/silent-callback"
```

#### 2. B2C Configuration Rollback
```bash
# Rollback B2C configuration to previous backup
rollback_b2c_configuration() {
  local backup_file="$1"
  
  if [ -f "$backup_file" ]; then
    # Restore B2C configuration from backup
    ./update-b2c-redirect-urls.sh production taktconnect.com --restore
    
    # Validate restored configuration
    ./test-b2c-authentication.sh all taktconnect.com --comprehensive --report
  else
    echo "Backup file not found: $backup_file"
  fi
}

# Example: Rollback to specific backup
rollback_b2c_configuration "azure/b2c-backups/b2c-config-backup-production-20240115-143000.json"
```

## 📈 B2C Integration Best Practices

### Security Best Practices

#### 1. B2C Application Security
```yaml
Security Configuration:
  Redirect URIs: Use HTTPS only, validate all redirect URLs
  Implicit Grant: Disable unless specifically required
  Access Tokens: Use authorization code flow with PKCE
  Token Lifetime: Configure appropriate token expiration
  Refresh Tokens: Enable refresh token rotation
  
Application Permissions:
  Microsoft Graph: Minimal required permissions only
  Azure AD Graph: Avoid deprecated Graph API
  Custom APIs: Least privilege principle
  
Monitoring:
  Sign-in Logs: Monitor for suspicious activity
  Audit Logs: Track configuration changes
  Failed Authentications: Alert on repeated failures
```

#### 2. Custom Domain Security
```yaml
Domain Security:
  SSL/TLS: Enforce HTTPS for all B2C redirect URLs
  HSTS: Enable HTTP Strict Transport Security
  Certificate Validation: Ensure valid SSL certificates
  DNS Security: Implement DNS security measures
  
CORS Configuration:
  Allowed Origins: Restrict to B2C domains only
  Allowed Methods: Limit to required HTTP methods
  Allowed Headers: Specify required headers only
  Credentials: Enable only when necessary
```

### Performance Optimization

#### 1. B2C Response Optimization
```yaml
Performance Tuning:
  Token Caching: Implement proper token caching
  Silent Authentication: Use iframe for token renewal
  Connection Pooling: Optimize HTTP connections
  CDN Integration: Use CDN for static B2C assets
  
Monitoring:
  Response Times: Monitor B2C endpoint performance
  Success Rates: Track authentication success rates
  Error Rates: Monitor and alert on high error rates
  User Experience: Measure authentication flow performance
```

#### 2. Integration Optimization
```yaml
Integration Best Practices:
  Error Handling: Implement comprehensive error handling
  Retry Logic: Add retry mechanisms for transient failures
  Fallback Mechanisms: Provide fallback authentication options
  User Experience: Optimize authentication flow UX
  
Testing:
  Automated Testing: Regular B2C configuration testing
  Load Testing: Test B2C integration under load
  Security Testing: Regular security assessments
  User Acceptance Testing: Validate user experience
```

This comprehensive B2C configuration system ensures secure, reliable, and maintainable authentication integration with custom domains across all TaktMate environments.
