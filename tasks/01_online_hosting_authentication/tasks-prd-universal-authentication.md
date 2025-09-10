# Task List: Universal Authentication for TaktMate

Based on PRD: `prd-universal-authentication.md`

## Current State Assessment

### Existing Architecture
- **Frontend**: React 18 with clean landing page, three authentication buttons (Microsoft, Google, Email)
- **Backend**: Express.js with Microsoft Entra External ID JWT validation, production-ready security middleware
- **Authentication**: Microsoft Entra ID with External Identities (B2C) tenant with configured identity providers and user flow
- **Deployment**: Azure App Service (backend) and Azure Static Web Apps (frontend) with CI/CD
- **Current Issue**: All three authentication buttons route to Microsoft login instead of provider-specific pages

### Key Components to Leverage
- Existing `AuthContext.js` with MSAL.js integration
- Working JWT validation middleware in backend
- Configured Microsoft Entra ID External Identities tenant with `TaktMateSignUpSignIn` user flow
- Clean landing page design with provider-specific buttons
- Production-ready CORS and security configuration

### Major Changes Required
- Fix provider-specific routing in `AuthContext.js`
- Verify Azure user flow includes all three identity providers
- Test and validate each authentication provider works correctly
- Ensure proper error handling and debug logging

## Relevant Files

### Files to Modify
- `frontend/src/contexts/AuthContext.js` - Add `identity_provider` parameter for direct provider routing
- `frontend/src/config/authConfig.js` - May need user flow endpoint configuration updates
- `frontend/src/components/LandingPage.jsx` - Already has provider-specific buttons, may need error handling updates

### Files to Verify/Test
- Microsoft Entra ID External Identities user flow configuration (`TaktMateSignUpSignIn`)
- Azure App Registration settings (account type support)
- Azure Identity Provider configurations (Google, Microsoft, Email)
- `frontend/staticwebapp.config.json` - Content Security Policy for all auth domains

### Files for Testing
- Manual testing scripts for each authentication provider
- Debug logging validation for authentication attempts
- Error handling verification across all providers

### Notes
- Current system already has most infrastructure in place
- Focus is on fixing routing and verifying Azure configuration
- No new major components needed - primarily configuration and parameter fixes

## Tasks

- [ ] 1.0 Verify and Fix Microsoft Authentication (Priority 1)
  - [X] 1.1 Verify Azure App Registration is set to "Accounts in any organizational directory (Any Microsoft Entra ID tenant - Multitenant)" - this is correct for External ID
  - [X] 1.2 **CRITICAL**: Implemented direct redirect approach - eliminated custom authentication buttons
  - [X] 1.3 Fixed frontend authority URL - now using correct External ID `.ciamlogin.com` endpoint  
  - [X] 1.4 Simplified authentication flow - users auto-redirect to External ID on app load
  - [X] 1.5 Removed provider-specific routing complexity - External ID handles all providers
  - [X] 1.6 Cleaned up landing page - removed custom authentication buttons and provider logic
  - [X] 1.7 Updated `AuthContext.js` to use simplified External ID authentication protocols
  - [ ] 1.8 Test direct redirect authentication flow works correctly
  - [ ] 1.9 Verify all authentication providers (Microsoft, Google, Email) work through External ID user flow

- [ ] 2.0 Verify and Fix Google Authentication (Priority 2)
  - [ ] 2.1 Verify Google identity provider is properly configured in Microsoft Entra ID External Identities tenant
  - [ ] 2.2 Check Google OAuth credentials and redirect URIs in Azure configuration
  - [ ] 2.3 Update `AuthContext.js` to use `identity_provider=Google` parameter for Google routing
  - [ ] 2.4 Test Google button routing to ensure it goes directly to Google account selection
  - [ ] 2.5 Validate Google authentication flow with test Gmail accounts

- [ ] 3.0 Verify and Fix Email/Password Authentication (Priority 3)
  - [ ] 3.1 Verify Local Account provider is enabled in Microsoft Entra ID External Identities user flow
  - [ ] 3.2 Check email/password authentication settings in `TaktMateSignUpSignIn` user flow
  - [ ] 3.3 Update `AuthContext.js` to use correct parameters for local account authentication
  - [ ] 3.4 Test email button routing to email/password sign-up form
  - [ ] 3.5 Validate email/password authentication with various email domains

- [ ] 4.0 Implement Provider-Specific Routing (Core Implementation)
  - [ ] 4.1 Research correct Microsoft Entra ID External Identities `identity_provider` parameter values for each provider
  - [ ] 4.2 Update `signIn()` method in `AuthContext.js` to use `extraQueryParameters` with `identity_provider`
  - [ ] 4.3 Update `signInRedirect()` method with same provider-specific parameters
  - [ ] 4.4 Add comprehensive debug logging for each authentication attempt
  - [ ] 4.5 Test provider-specific routing works correctly for all three buttons

- [ ] 5.0 Azure Configuration Verification
  - [ ] 5.1 Verify `TaktMateSignUpSignIn` user flow includes all three identity providers (Microsoft, Google, Local)
  - [ ] 5.2 Check that Google identity provider configuration is complete and correct
  - [ ] 5.3 Validate App Registration redirect URIs support all authentication flows
  - [ ] 5.4 Confirm Content Security Policy allows all required authentication domains
  - [ ] 5.5 Test user flow directly in Azure portal to ensure all providers appear
  - [ ] 5.6 Verify Application management settings align with Microsoft Entra ID best practices
  - [ ] 5.7 Validate Role-based access control (RBAC) is properly configured for the application

- [ ] 6.0 Testing and Validation
  - [ ] 6.1 Test Microsoft authentication with multiple account types (@outlook.com, @hotmail.com, organizational)
  - [ ] 6.2 Test Google authentication with Gmail and Google Workspace accounts
  - [ ] 6.3 Test email/password authentication with various email providers
  - [ ] 6.4 Verify error handling displays clear messages for authentication failures
  - [ ] 6.5 Confirm post-authentication redirect to `/dashboard` works for all providers
  - [ ] 6.6 Validate debug logging captures provider information for troubleshooting
  - [ ] 6.7 Verify Monitoring and health capabilities are enabled for authentication flows
  - [ ] 6.8 Test Conditional Access policies if applicable to the application setup
