# Azure AD B2C Application Registration Guide for TaktMate

This guide provides detailed instructions for registering the TaktMate application in Azure AD B2C with proper security configuration and redirect URLs.

## Overview

Application registration is a critical step that:
- Identifies your application to Azure AD B2C
- Configures authentication endpoints and redirect URLs
- Sets up client credentials for secure communication
- Defines API permissions and token configuration

## Prerequisites

- Azure AD B2C tenant created and configured (Task 1.1)
- User flows or custom policies configured (Tasks 1.2-1.3)
- Access to Azure portal with appropriate permissions

## Step-by-Step Registration Process

### Step 1: Create Application Registration

1. **Navigate to Azure AD B2C**
   - Go to [portal.azure.com](https://portal.azure.com)
   - Switch to your B2C tenant (`taktmate.onmicrosoft.com`)
   - Navigate to Azure AD B2C service

2. **Access App Registrations**
   - In the left menu, click "App registrations"
   - Click "New registration"

3. **Configure Basic Settings**
   ```
   Name: TaktMate CSV Chat Application
   Supported account types: Accounts in any identity provider or organizational directory (for authenticating users with user flows)
   Redirect URI: 
     - Type: Web
     - URL: http://localhost:3000/auth/callback
   ```

4. **Complete Registration**
   - Click "Register"
   - Wait for the application to be created
   - Note the Application (client) ID and Directory (tenant) ID

### Step 2: Configure Authentication Settings

1. **Access Authentication Configuration**
   - In your registered app, go to "Authentication"
   - Review the initial redirect URI

2. **Add Additional Redirect URIs**
   Add these redirect URIs for different environments:
   ```
   Development:
   - http://localhost:3000/auth/callback
   
   Production:
   - https://app.taktconnect.com/auth/callback
   
   Testing:
   - https://jwt.ms
   ```

3. **Configure Token Settings**
   - ✅ Access tokens (used by web APIs)
   - ✅ ID tokens (used for OpenID Connect)
   - Click "Save"

4. **Advanced Settings**
   - Allow public client flows: **No** (keep disabled for security)
   - Supported account types: Keep as configured during registration
   - Live SDK support: **No**

### Step 3: Create and Configure Client Secret

1. **Navigate to Certificates & Secrets**
   - In your app registration, go to "Certificates & secrets"
   - Click "New client secret"

2. **Configure Secret**
   ```
   Description: TaktMate Production Secret
   Expires: 24 months (recommended for production)
   ```
   - Click "Add"

3. **Save Client Secret**
   - **Copy the secret value immediately** (it won't be shown again)
   - Store securely - this will be your `AZURE_AD_B2C_CLIENT_SECRET`

### Step 4: Configure API Permissions

1. **Review Default Permissions**
   - Go to "API permissions"
   - Review existing permissions

2. **Add Required Permissions**
   - Click "Add a permission"
   - Select "Microsoft Graph"
   - Choose "Delegated permissions"
   - Add these permissions:
     - ✅ `openid` (Sign users in)
     - ✅ `profile` (View users' basic profile) 
     - ✅ `email` (View users' email address)
     - ✅ `offline_access` (Maintain access to data you have given it access to)

3. **Grant Admin Consent**
   - Click "Grant admin consent for [tenant-name]"
   - Confirm the consent
   - Verify all permissions show "Granted for [tenant-name]"

### Step 5: Configure Token Configuration (Optional)

1. **Access Token Configuration**
   - Go to "Token configuration"
   - This allows customization of claims in tokens

2. **Add Optional Claims**
   - Click "Add optional claim"
   - Token type: **ID**
   - Select additional claims:
     - `family_name`
     - `given_name`
     - `email`
   - Click "Add"

### Step 6: Integrate with User Flows

1. **Configure User Flow Application**
   - Go to "User flows" in Azure AD B2C
   - Select your `B2C_1_signupsignin1` user flow
   - Go to "Applications"
   - Click "Add"
   - Select "TaktMate CSV Chat Application"
   - Click "OK"

2. **Test Integration**
   - In the user flow, click "Run user flow"
   - Application: Select "TaktMate CSV Chat Application"
   - Reply URL: Choose `https://jwt.ms` for testing
   - Click "Run user flow"
   - Complete authentication and verify token generation

### Step 7: Environment Configuration

Update your `.env` file with the registration details:

```bash
# Azure AD B2C Application Registration
AZURE_AD_B2C_TENANT_ID=your-directory-tenant-id-here
AZURE_AD_B2C_CLIENT_ID=your-application-client-id-here
AZURE_AD_B2C_CLIENT_SECRET=your-client-secret-here

# Development Environment
AZURE_AD_B2C_REDIRECT_URI=http://localhost:3000/auth/callback
AZURE_AD_B2C_POST_LOGOUT_REDIRECT_URI=http://localhost:3000

# Production Environment (update when deploying)
# AZURE_AD_B2C_REDIRECT_URI=https://app.taktconnect.com/auth/callback
# AZURE_AD_B2C_POST_LOGOUT_REDIRECT_URI=https://app.taktconnect.com
```

## Security Best Practices

### Client Secret Management
- **Never commit secrets to version control**
- **Use Azure Key Vault in production**
- **Rotate secrets every 6-12 months**
- **Use different secrets for different environments**

### Redirect URI Security
- **Only add trusted redirect URIs**
- **Use HTTPS in production**
- **Validate redirect URIs match exactly**
- **Remove test URLs from production configuration**

### Permission Management
- **Use least privilege principle**
- **Only request necessary permissions**
- **Review permissions regularly**
- **Monitor permission usage**

## Testing and Validation

### Manual Testing
1. **Test Authentication Flow**
   - Use generated authentication URLs
   - Complete sign-up/sign-in process
   - Verify redirect to callback URL
   - Check JWT token at jwt.ms

2. **Test All Authentication Methods**
   - Local account (email/password)
   - Google OAuth (if configured)
   - Microsoft OAuth (if configured)

3. **Verify Token Claims**
   - User ID (`sub`)
   - Email (`emails` array)
   - Name components (`given_name`, `family_name`)
   - Custom attributes (`extension_Company`, `extension_Role`)

### Automated Testing
```bash
# Validate application configuration
npm run validate:app

# Test specific components
npm run validate:app config
npm run validate:app endpoints
npm run validate:app urls
```

## Common Configuration Issues

### Issue: "Invalid client_id" Error
**Causes:**
- Incorrect client ID in environment variables
- Using wrong tenant (regular AD vs B2C)
- Application not registered in correct tenant

**Solutions:**
- Verify `AZURE_AD_B2C_CLIENT_ID` matches Application (client) ID in portal
- Ensure using B2C tenant, not regular Azure AD
- Check application is registered in correct B2C tenant

### Issue: "Invalid redirect_uri" Error
**Causes:**
- Redirect URI mismatch between app and portal
- Missing protocol (http/https)
- Typo in redirect URI

**Solutions:**
- Verify redirect URI in portal matches `AZURE_AD_B2C_REDIRECT_URI` exactly
- Ensure correct protocol is used
- Check redirect URI is added to Authentication section

### Issue: Missing Custom Claims in Token
**Causes:**
- Custom attributes not added to user flow claims
- User didn't provide values during registration
- Custom policies not properly configured

**Solutions:**
- Add custom attributes to user flow "Application claims"
- Ensure users provide Company and Role during signup
- Verify custom policies include custom claims in output

### Issue: Token Validation Failures
**Causes:**
- Incorrect issuer URL
- Wrong audience in token
- Expired tokens
- Clock skew issues

**Solutions:**
- Verify issuer URL matches B2C tenant and policy
- Check audience matches your client ID
- Ensure proper token lifetime configuration
- Configure clock tolerance for validation

## Application Registration Checklist

- [ ] Application registered in Azure AD B2C
- [ ] Application name: "TaktMate CSV Chat Application"
- [ ] Client ID obtained and saved
- [ ] Client secret created and saved securely
- [ ] Redirect URIs configured for all environments
- [ ] API permissions granted (openid, profile, email, offline_access)
- [ ] Admin consent granted for permissions
- [ ] Token configuration updated (optional claims)
- [ ] Application added to user flows
- [ ] Authentication flow tested successfully
- [ ] Environment variables updated
- [ ] JWT tokens verified to contain expected claims
- [ ] All authentication methods tested (local, Google, Microsoft)

## Next Steps

After completing application registration:

1. **Task 1.5**: Configure JWT token claims validation
2. **Task 1.6**: Test Azure AD B2C user flows and token generation
3. **Task 1.7**: Document Azure AD B2C configuration and setup process
4. **Task 2.0**: Begin backend Azure AD B2C integration

## Support Resources

- [Azure AD B2C App Registration Documentation](https://docs.microsoft.com/en-us/azure/active-directory-b2c/tutorial-register-applications)
- [OpenID Connect with Azure AD B2C](https://docs.microsoft.com/en-us/azure/active-directory-b2c/openid-connect)
- [Azure AD B2C Token Reference](https://docs.microsoft.com/en-us/azure/active-directory-b2c/tokens-overview)

---

**Created for TaktMate Online Hosting Project**  
**Task 1.4: Azure AD B2C Application Registration**  
**Last Updated**: $(date)
