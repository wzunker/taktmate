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

- [X] **Create Authentication Context**: Implement React context for authentication state management
  - Create `src/contexts/AuthContext.js`
  - Provide authentication state and user information
  - Handle loading states during authentication checks

- [X] **Create useAuth Hook**: Implement custom hook for authentication operations
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

- [X] **Wrap App with AuthProvider**: Add authentication context to the app root
- [X] **Add Authentication Check**: Implement authentication check on app load
- [X] **Add Loading State**: Show loading indicator while checking authentication status
- [X] **Update Header**: Add user information and logout button to header

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

- [X] **Create LogoutButton Component**: Component for logout functionality
  - Create `src/components/LogoutButton.jsx`
  - Handle redirection to `/.auth/logout`
  - Include optional confirmation dialog
  - Support custom styling and loading states

- [X] **Create UserProfile Component**: Display user information
  - Create `src/components/UserProfile.jsx`
  - Show user name, email, avatar with initials
  - Include logout functionality
  - Support horizontal and vertical layouts

**Note**: LoginButton component not needed since Azure Static Web Apps automatically redirects unauthenticated users to External ID sign-in. AuthGuard component not needed since route protection is handled by `staticwebapp.config.json`.

**Acceptance Criteria:**
- All authentication components are properly styled and functional
- Components handle loading and error states appropriately
- User experience is smooth and intuitive

---

### Phase 3: Backend Security Implementation (Simplified SWA Approach)

#### Task 7: Create SWA Authentication Middleware
**Priority:** High  
**Estimated Time:** 30 minutes

- [ ] **Create SWA Header Validation Middleware**: Parse Azure Static Web Apps authentication headers
  - Create `middleware/auth.js`
  - Parse `x-ms-client-principal` header from SWA proxy
  - Extract user information from SWA-provided headers
  - Handle unauthenticated requests gracefully

**Why This Approach:**
- ✅ **Simpler**: No JWT validation, JWKS clients, or token management needed
- ✅ **Secure**: SWA handles all token validation before proxying requests
- ✅ **No CORS issues**: All traffic flows through SWA domain
- ✅ **Automatic refresh**: SWA manages token lifecycle automatically
- ✅ **Fast implementation**: Minimal code, maximum security

**Middleware Implementation:**
```javascript
// middleware/auth.js
function requireAuth(req, res, next) {
  const header = req.headers['x-ms-client-principal'];
  if (!header) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const encoded = Buffer.from(header, 'base64').toString('utf8');
    req.user = JSON.parse(encoded);
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid authentication" });
  }
}

module.exports = { requireAuth };
```

**SWA User Object Structure:**
```json
{
  "identityProvider": "entraExternalId",
  "userId": "12345678-90ab-cdef-1234-567890abcdef",
  "userDetails": "user@example.com",
  "userRoles": ["authenticated"],
  "claims": [...]
}
```

**Acceptance Criteria:**
- Middleware properly parses SWA authentication headers
- User information is extracted and made available to route handlers
- Unauthenticated requests are properly rejected
- Error handling is robust and user-friendly

---

#### Task 8: Update API Endpoints with SWA Authentication
**Priority:** High  
**Estimated Time:** 45 minutes

- [ ] **Apply SWA Authentication Middleware**: Add auth middleware to protected endpoints
  - Update `/api/upload` endpoint to require authentication
  - Update `/api/chat` endpoint to require authentication
  - Keep `/api/health` and `/api/test` endpoints public for monitoring

- [ ] **Simplify CORS Configuration**: Update CORS for SWA proxy pattern
  - CORS configuration can be simplified since all requests come through SWA
  - Ensure SWA domain is included in allowed origins
  - Remove complex authentication headers (SWA handles this)

- [ ] **Add User Context to Requests**: Include user information in request processing
  - Add user ID to file storage for multi-user support
  - Log user actions for audit purposes
  - Implement user-specific data isolation using SWA user context

**Implementation Example:**
```javascript
const { requireAuth } = require('./middleware/auth');

// Protected endpoints
app.post('/api/upload', requireAuth, (req, res) => {
  const user = req.user; // From SWA headers
  console.log(`User ${user.userDetails} uploading file`);
  // ... existing upload logic
});

app.post('/api/chat', requireAuth, (req, res) => {
  const user = req.user;
  console.log(`User ${user.userDetails} sending chat message`);
  // ... existing chat logic
});
```

**Acceptance Criteria:**
- All protected API endpoints require valid SWA authentication
- Unauthenticated requests are properly rejected
- User context from SWA headers is available in API handlers
- CORS configuration works with SWA proxy pattern
- User actions are properly logged and isolated

---

### Phase 4: Testing and Validation

#### Task 9: Implement Comprehensive Testing
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

#### Task 10: Update Documentation
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

#### Task 11: Final Deployment and Validation
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
- **Backend authentication**: Simplified to use SWA headers instead of JWT validation

### Azure Static Web Apps Authentication Approach

#### 🚀 Why Use SWA Header Authentication:

1. **Simplified Backend**: No need for JWT libraries, JWKS clients, or token validation logic
2. **Automatic Security**: SWA validates all tokens before proxying requests to backend
3. **No CORS Complexity**: All requests flow through SWA domain, eliminating CORS issues
4. **Session Management**: SWA handles token refresh and session lifecycle automatically
5. **Faster Development**: Minimal code required for robust authentication

#### 🔧 How SWA Authentication Works:

1. User authenticates via External ID through SWA
2. SWA validates and manages the authentication session
3. For API calls, SWA adds `x-ms-client-principal` header to requests
4. Backend middleware parses this header to get user context
5. No direct token validation needed in backend

#### 📋 SWA Authentication Headers:

- `x-ms-client-principal`: Base64-encoded JSON with user information
- Contains: `identityProvider`, `userId`, `userDetails`, `userRoles`, `claims`
- Automatically injected by SWA for authenticated users
- Empty/missing for unauthenticated requests

#### ⚡ Alternative: Full JWT Validation

If you need your backend to accept direct API calls (bypassing SWA), you can implement full JWT validation as a Phase 4 enhancement. This would involve:
- Installing `jsonwebtoken` and `jwks-rsa` packages
- Validating tokens against External ID JWKS endpoint
- Handling token expiry and refresh logic
- Managing CORS for direct API access

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

**Total Estimated Implementation Time**: 5-6 hours (reduced due to SWA simplified approach)
**Recommended Implementation Order**: Complete phases sequentially, testing thoroughly after each phase
**Critical Dependencies**: Azure Static Web App Standard plan, Microsoft Entra External ID tenant setup
