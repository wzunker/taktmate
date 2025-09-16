# Microsoft Entra External ID Authentication Implementation Tasks

## Overview
This document outlines the tasks required to implement Microsoft Entra External ID authentication for the TaktMate web application. The implementation will ensure that unauthenticated users are redirected through a custom sign-in/sign-up flow before accessing the main application, with proper logout functionality.

## Current Setup Status
✅ **Already Completed:**
- External tenant "TaktMate" created
- TaktMate Web Application registered in Entra External ID
- Custom user flow "TaktMateSignUpSignIn" created
- Environment variables configured in Azure
- Redirect URIs configured in External ID app registration

## Implementation Tasks

### Phase 1: Infrastructure & Configuration

#### Task 1: Verify Azure Static Web App Plan
**Priority:** Critical  
**Estimated Time:** 15 minutes

- [X] **Verify Standard Plan**: Confirm Azure Static Web App is on Standard plan (required for custom authentication)
  - Navigate to Azure Portal → Static Web Apps → Your App → Plan/Pricing tier
  - If on Free/Basic plan, upgrade to Standard plan
  - Document the current plan status

**Acceptance Criteria:**
- Static Web App is confirmed to be on Standard plan
- Custom authentication features are available

---

#### Task 2: Configure staticwebapp.config.json
**Priority:** Critical  
**Estimated Time:** 45 minutes

- [X] **Update Configuration File**: Replace current `staticwebapp.config.json` with Microsoft Entra External ID configuration
  - Current config only allows anonymous access - needs complete rewrite
  - **IMPORTANT**: Use `customOpenIdConnectProviders` (not `azureActiveDirectory`) since External ID with custom user flows is treated as a custom OIDC provider
  - Configure route protection for authenticated users only
  - Set up login/logout routes with correct provider name

**Configuration Details:**
```json
{
  "navigationFallback": {
    "rewrite": "/index.html"
  },
  "routes": [
    {
      "route": "/*",
      "allowedRoles": ["authenticated"]
    },
    {
      "route": "/login",
      "rewrite": "/.auth/login/entraExternalId"
    },
    {
      "route": "/logout",
      "redirect": "/.auth/logout"
    }
  ],
  "responseOverrides": {
    "401": {
      "statusCode": 302,
      "redirect": "/login"
    }
  },
  "auth": {
    "identityProviders": {
      "customOpenIdConnectProviders": {
        "entraExternalId": {
          "registration": {
            "clientIdSettingName": "ENTRA_EXTERNAL_ID_CLIENT_ID",
            "clientCredential": {
              "clientSecretSettingName": "ENTRA_EXTERNAL_ID_CLIENT_SECRET"
            },
            "openIdConnectConfiguration": {
              "wellKnownOpenIdConfiguration": "https://taktmate.ciamlogin.com/taktmate.onmicrosoft.com/v2.0/.well-known/openid-configuration?appid=3f1869f7-716b-4885-ac8a-86e78515f3a4"
            }
          },
          "login": {
            "nameClaimType": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"
          }
        }
      }
    }
  }
}
```

**Acceptance Criteria:**
- Configuration file properly defines Entra External ID as identity provider
- All routes require authentication except auth endpoints
- Unauthenticated users are redirected to login flow
- Login/logout routes are properly configured

---

#### Task 3: Verify Environment Variables
**Priority:** Critical  
**Estimated Time:** 20 minutes

- [X] **Confirm Static Web App Environment Variables**: Verify all required environment variables are set
  - `ENTRA_EXTERNAL_ID_CLIENT_ID`
  - `ENTRA_EXTERNAL_ID_CLIENT_SECRET`
  - Ensure variable names exactly match those in `staticwebapp.config.json`
  
- [X] **Verify Backend Environment Variables**: Confirm backend has access to:
  - `ENTRA_EXTERNAL_ID_CLIENT_ID`
  - `ENTRA_EXTERNAL_ID_CLIENT_SECRET`
  - `ENTRA_EXTERNAL_ID_TENANT_ID`

**Acceptance Criteria:**
- All environment variables are properly set and accessible
- Variable names match configuration file references
- Both frontend and backend have necessary credentials

---

### Phase 2: Frontend Authentication Implementation

#### Task 4: Create Authentication Context and Hooks
**Priority:** High  
**Estimated Time:** 60 minutes

- [ ] **Create Authentication Context**: Implement React context for authentication state management
  - Create `src/contexts/AuthContext.js`
  - Provide authentication state and user information
  - Handle loading states during authentication checks

- [ ] **Create useAuth Hook**: Implement custom hook for authentication operations
  - Create `src/hooks/useAuth.js`
  - Provide methods for checking authentication status
  - Handle login/logout operations
  - Fetch user information from `/.auth/me` endpoint

**Key Features:**
```javascript
// AuthContext should provide:
// - isAuthenticated: boolean
// - user: object | null
// - isLoading: boolean
// - login: function
// - logout: function
```

**Acceptance Criteria:**
- Authentication context properly manages state across the application
- useAuth hook provides clean interface for authentication operations
- Loading states are handled during authentication checks

---

#### Task 5: Update App.jsx with Authentication Logic
**Priority:** High  
**Estimated Time:** 45 minutes

- [ ] **Wrap App with AuthProvider**: Add authentication context to the app root
- [ ] **Add Authentication Check**: Implement authentication check on app load
- [ ] **Add Loading State**: Show loading indicator while checking authentication status
- [ ] **Update Header**: Add user information and logout button to header

**Implementation Details:**
- Check authentication status on component mount
- Display user information when authenticated
- Provide logout functionality in the header
- Handle unauthenticated state gracefully (though users should be redirected by SWA)

**Acceptance Criteria:**
- App properly checks authentication status on load
- User information is displayed when authenticated
- Logout functionality is accessible and working
- Loading states provide good user experience

---

#### Task 6: Create Authentication Components
**Priority:** Medium  
**Estimated Time:** 90 minutes

- [ ] **Create LoginButton Component**: Component for login functionality
  - Create `src/components/LoginButton.jsx`
  - Handle redirection to `/.auth/login/entraExternalId`
  - Include appropriate styling and loading states

- [ ] **Create LogoutButton Component**: Component for logout functionality
  - Create `src/components/LogoutButton.jsx`
  - Handle redirection to `/.auth/logout`
  - Include confirmation dialog if needed

- [ ] **Create UserProfile Component**: Display user information
  - Create `src/components/UserProfile.jsx`
  - Show user name, email, and other relevant information
  - Include logout functionality

- [ ] **Create AuthGuard Component**: Protect routes that require authentication
  - Create `src/components/AuthGuard.jsx`
  - Redirect to login if not authenticated
  - Show loading state while checking authentication

**Acceptance Criteria:**
- All authentication components are properly styled and functional
- Components handle loading and error states appropriately
- User experience is smooth and intuitive

---

### Phase 3: Backend Security Implementation

#### Task 7: Install Authentication Dependencies
**Priority:** High  
**Estimated Time:** 15 minutes

- [ ] **Install JWT Validation Libraries**: Add necessary packages for token validation
  - Install `jsonwebtoken` for JWT token validation
  - Install `jwks-rsa` for retrieving public keys from Microsoft
  - Install `axios` if not already present for HTTP requests
  - Update `package.json` dependencies

**Command:**
```bash
cd backend
npm install jsonwebtoken jwks-rsa axios
```

**Acceptance Criteria:**
- All required authentication libraries are installed
- Package.json is updated with new dependencies

---

#### Task 8: Create Authentication Middleware
**Priority:** High  
**Estimated Time:** 120 minutes

- [ ] **Create Token Validation Middleware**: Implement JWT token validation
  - Create `middleware/auth.js`
  - Validate JWT tokens from Authorization header or SWA headers
  - Verify token signature using Microsoft's public keys
  - Extract user information from validated tokens

- [ ] **Implement JWKS Client**: Set up client for retrieving Microsoft public keys
  - Configure JWKS client for Microsoft Entra External ID
  - Handle key rotation and caching
  - Implement proper error handling

**Middleware Features:**
```javascript
// auth.js should provide:
// - validateToken: middleware function
// - extractUserInfo: utility function
// - handleAuthError: error handling
```

**Key Configuration for External ID:**
- JWKS URI: `https://taktmate.ciamlogin.com/7d673488-6daf-4406-b9ce-d2d1f2b5c0db/discovery/v2.0/keys?appid=3f1869f7-716b-4885-ac8a-86e78515f3a4`
- Issuer: `https://7d673488-6daf-4406-b9ce-d2d1f2b5c0db.ciamlogin.com/7d673488-6daf-4406-b9ce-d2d1f2b5c0db/v2.0`
- Audience: Your client ID (`ENTRA_EXTERNAL_ID_CLIENT_ID`)
- **Note**: These URLs come from your External ID OpenID configuration, not regular Entra ID endpoints

**Acceptance Criteria:**
- Middleware properly validates JWT tokens from Microsoft Entra External ID
- Invalid tokens are rejected with appropriate error messages
- User information is extracted and made available to route handlers
- Error handling is robust and secure

---

#### Task 9: Update API Endpoints with Authentication
**Priority:** High  
**Estimated Time:** 60 minutes

- [ ] **Apply Authentication Middleware**: Add auth middleware to protected endpoints
  - Update `/api/upload` endpoint to require authentication
  - Update `/api/chat` endpoint to require authentication
  - Keep `/api/health` and `/api/test` endpoints public for monitoring

- [ ] **Update CORS Configuration**: Ensure CORS settings work with authentication
  - Update CORS origin to include Static Web App domain
  - Ensure credentials are properly handled
  - Add necessary headers for authentication

- [ ] **Add User Context to Requests**: Include user information in request processing
  - Add user ID to file storage for multi-user support
  - Log user actions for audit purposes
  - Implement user-specific data isolation if needed

**Acceptance Criteria:**
- All protected API endpoints require valid authentication
- Unauthenticated requests are properly rejected
- User context is available in API handlers
- CORS configuration supports authenticated requests

---

### Phase 4: Testing and Validation

#### Task 10: Implement Comprehensive Testing
**Priority:** High  
**Estimated Time:** 90 minutes

- [ ] **Test Authentication Flow**: Verify complete authentication workflow
  - Navigate to app URL and confirm redirect to login
  - Complete sign-up/sign-in process
  - Verify successful return to application
  - Test user information display

- [ ] **Test Logout Functionality**: Verify logout process
  - Test logout button functionality
  - Confirm session is properly cleared
  - Verify redirect to login on subsequent access

- [ ] **Test API Authentication**: Verify backend security
  - Test API calls with valid authentication
  - Test API calls without authentication (should fail)
  - Test API calls with invalid tokens (should fail)
  - Verify error messages are appropriate

- [ ] **Test Edge Cases**: Handle various scenarios
  - Test expired tokens
  - Test network failures during authentication
  - Test browser refresh during authenticated session
  - Test direct URL access to protected routes

**Test Scenarios:**
1. **Happy Path**: User signs up → gets redirected → can use app → can log out
2. **Unauthenticated Access**: Direct URL access → redirected to login
3. **API Security**: Unauthenticated API calls → proper error responses
4. **Session Management**: Token expiry → proper re-authentication flow

**Acceptance Criteria:**
- All authentication flows work as expected
- Security measures are properly implemented
- Error handling provides good user experience
- Edge cases are handled gracefully

---

### Phase 5: Documentation and Deployment

#### Task 11: Update Documentation
**Priority:** Medium  
**Estimated Time:** 45 minutes

- [ ] **Update README**: Document authentication implementation
  - Add authentication setup instructions
  - Document environment variables required
  - Include troubleshooting guide

- [ ] **Create Deployment Guide**: Document deployment process with authentication
  - List all Azure configuration requirements
  - Document environment variable setup
  - Include verification steps

- [ ] **Document API Changes**: Update API documentation
  - Document authentication requirements for endpoints
  - Include example authenticated requests
  - Document error responses

**Acceptance Criteria:**
- Documentation is comprehensive and up-to-date
- Setup instructions are clear and complete
- Troubleshooting information is helpful

---

#### Task 12: Final Deployment and Validation
**Priority:** Critical  
**Estimated Time:** 30 minutes

- [ ] **Deploy Updated Configuration**: Push changes to Azure Static Web App
  - Commit and push `staticwebapp.config.json` changes
  - Deploy frontend changes with authentication components
  - Deploy backend changes with authentication middleware

- [ ] **Verify Production Deployment**: Test authentication in production environment
  - Test complete authentication flow in production
  - Verify all environment variables are properly configured
  - Test API endpoints with authentication
  - Monitor for any deployment issues

- [ ] **Performance and Security Review**: Final checks
  - Verify authentication doesn't impact performance significantly
  - Review security headers and configurations
  - Check for any console errors or warnings
  - Validate SSL/TLS configuration

**Acceptance Criteria:**
- Application successfully deployed with authentication
- All functionality works in production environment
- No security vulnerabilities identified
- Performance is acceptable

---

## Technical Implementation Notes

### Key URLs and Endpoints
- **OpenID Configuration**: `https://taktmate.ciamlogin.com/taktmate.onmicrosoft.com/v2.0/.well-known/openid-configuration?appid=3f1869f7-716b-4885-ac8a-86e78515f3a4`
- **JWKS URI**: `https://taktmate.ciamlogin.com/7d673488-6daf-4406-b9ce-d2d1f2b5c0db/discovery/v2.0/keys?appid=3f1869f7-716b-4885-ac8a-86e78515f3a4`
- **Issuer**: `https://7d673488-6daf-4406-b9ce-d2d1f2b5c0db.ciamlogin.com/7d673488-6daf-4406-b9ce-d2d1f2b5c0db/v2.0`
- **Login Endpoint**: `/.auth/login/entraExternalId`
- **Logout Endpoint**: `/.auth/logout`
- **User Info Endpoint**: `/.auth/me`

**Important Note**: Since you're using Microsoft Entra External ID with custom user flows, the configuration uses `customOpenIdConnectProviders` rather than the standard `azureActiveDirectory` provider. This allows for proper integration with your TaktMateSignUpSignIn user flow.

### Microsoft Entra External ID vs Regular Entra ID - Key Differences

#### 🔑 What Changes with External ID + Custom User Flows:

1. **Auth Provider Configuration**:
   - ❌ **Don't use**: `"azureActiveDirectory": { ... }`
   - ✅ **Use**: `"customOpenIdConnectProviders": { "entraExternalId": { ... } }`
   - External ID with custom user flows is treated as a **custom OIDC provider**, not first-party AAD

2. **Well-Known Configuration URL**:
   - ❌ **Regular Entra ID**: `https://login.microsoftonline.com/<TENANT_ID>/v2.0/.well-known/openid-configuration`
   - ✅ **External ID**: `https://taktmate.ciamlogin.com/taktmate.onmicrosoft.com/v2.0/.well-known/openid-configuration?appid=<APP_ID>`
   - The `appid=` parameter ensures integration with your specific app registration

3. **Login/Logout Endpoints**:
   - Login URL: `/.auth/login/entraExternalId` (matches your chosen provider name)
   - Callback URI in External ID: `https://<yourswa>.azurestaticapps.net/.auth/login/entraExternalId/callback`

4. **User Flow Integration**:
   - Your TaktMateSignUpSignIn user flow is automatically used based on the app registration
   - No need for additional `p=` parameter in the well-known URL when using `appid=`

#### ✅ What Stays the Same:

- **Static Web Apps plan requirement**: Still need Standard plan for custom OIDC
- **Route protection**: Same `allowedRoles: ["authenticated"]` and `401` override logic  
- **Environment variables**: Same `ENTRA_EXTERNAL_ID_CLIENT_ID` and `ENTRA_EXTERNAL_ID_CLIENT_SECRET`
- **Frontend integration**: Still uses `/.auth/me`, `/.auth/logout` endpoints
- **Backend token validation**: Still validates JWT tokens (with External ID issuer/keys)

### Environment Variables Required

**Frontend (Static Web App):**
- `ENTRA_EXTERNAL_ID_CLIENT_ID`
- `ENTRA_EXTERNAL_ID_CLIENT_SECRET`

**Backend (Web App):**
- `ENTRA_EXTERNAL_ID_CLIENT_ID`
- `ENTRA_EXTERNAL_ID_CLIENT_SECRET`
- `ENTRA_EXTERNAL_ID_TENANT_ID`

### Security Considerations
- All API endpoints should validate JWT tokens
- User data should be isolated by user ID
- Proper error handling to prevent information disclosure
- Regular security updates for authentication libraries
- Monitor for suspicious authentication attempts

### Common Troubleshooting Issues

#### General Issues:
1. **Redirect URI Mismatch**: Ensure redirect URIs in Azure exactly match the configured endpoints
2. **Environment Variable Issues**: Verify variable names match exactly between config and Azure settings  
3. **Plan Limitations**: Confirm Static Web App is on Standard plan
4. **CORS Issues**: Ensure CORS settings include authentication headers

#### External ID Specific Issues:
5. **Provider Configuration**: Using `azureActiveDirectory` instead of `customOpenIdConnectProviders` - External ID requires custom OIDC configuration
6. **Wrong Well-Known URL**: Using regular Entra ID endpoints instead of External ID ciamlogin.com URLs
7. **Missing appid Parameter**: Well-known configuration URL must include `?appid=<YOUR_APP_ID>` for proper app registration integration
8. **Token Validation Errors**: Check issuer configuration - External ID uses tenant-specific issuer URLs (not login.microsoftonline.com)
9. **User Flow Issues**: Ensure your app registration is properly associated with your TaktMateSignUpSignIn user flow
10. **Callback URL Format**: Must be `/.auth/login/<PROVIDER_NAME>/callback` where PROVIDER_NAME matches your config (entraExternalId)

## Success Criteria
- ✅ Unauthenticated users are automatically redirected to Microsoft Entra External ID login
- ✅ Users can successfully sign up and sign in through the custom user flow
- ✅ Authenticated users can access all application functionality
- ✅ Users can successfully log out and are required to re-authenticate
- ✅ All API endpoints are properly secured with token validation
- ✅ User experience is smooth and professional
- ✅ No security vulnerabilities in the authentication implementation

## Risk Mitigation
- **Authentication Bypass**: Implement multiple layers of security (frontend + backend validation)
- **Token Expiry**: Handle token refresh gracefully with proper user messaging
- **Service Outages**: Implement proper error handling for authentication service failures
- **Configuration Errors**: Thorough testing in staging environment before production deployment

---

**Total Estimated Implementation Time**: 8-10 hours
**Recommended Implementation Order**: Complete phases sequentially, testing thoroughly after each phase
**Critical Dependencies**: Azure Static Web App Standard plan, Microsoft Entra External ID tenant setup
