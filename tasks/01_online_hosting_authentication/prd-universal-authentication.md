# Product Requirements Document: Universal Authentication for TaktMate

## 1. Introduction/Overview

TaktMate currently supports authentication for a single email address (`wzunker@taktconnect.com`) through Microsoft Entra External ID. This PRD outlines the requirements to expand authentication support to **any valid email address** through three streamlined authentication providers: Microsoft, Google, and Email/Password.

The goal is to create a modern, friction-free authentication experience where users can choose their preferred sign-in method and successfully access TaktMate regardless of their email provider.

**Problem**: Current authentication is limited to specific accounts, creating barriers for potential users.
**Solution**: Implement universal authentication with provider-specific routing and proper user flow configuration.

## 2. Goals

1. **Enable Microsoft account authentication** for any valid Microsoft/Outlook account (personal and organizational)
2. **Enable Google account authentication** for any valid Gmail or Google Workspace account  
3. **Enable Email/Password authentication** for any email address not covered by Microsoft or Google
4. **Fix provider-specific button routing** so each authentication button goes directly to its respective provider
5. **Verify Azure user flow configuration** to ensure all three providers are properly integrated
6. **Maintain current security standards** and production-ready implementation

## 3. User Stories

### Primary User Stories
1. **As a Microsoft user**, I want to click "Continue with Microsoft" and be taken directly to Microsoft's login page so I can sign in with my existing Microsoft account
2. **As a Google user**, I want to click "Continue with Google" and be taken directly to Google's login page so I can sign in with my existing Google account  
3. **As a user with any email**, I want to click "Continue with Email" and be able to create an account with my email address and a password
4. **As a returning user**, I want to sign in with the same method I originally used without confusion about which option to choose

### Secondary User Stories
5. **As a user with multiple accounts**, I want to be prevented from creating duplicate accounts with the same email address across different providers
6. **As a user experiencing login issues**, I want clear error messages that help me understand what went wrong and how to try again

## 4. Functional Requirements

### 4.1 Microsoft Authentication (Priority 1)
1. **The system must** allow any valid Microsoft account (personal @outlook.com, @hotmail.com, or organizational) to sign in
2. **The system must** route users who click "Continue with Microsoft" directly to Microsoft's authentication page
3. **The system must** properly handle both personal Microsoft accounts and organizational accounts
4. **The system must** maintain existing functionality for `wzunker@taktconnect.com`

### 4.2 Google Authentication (Priority 2)  
5. **The system must** allow any valid Google account (@gmail.com or Google Workspace) to sign in
6. **The system must** route users who click "Continue with Google" directly to Google's authentication page
7. **The system must** properly integrate with the existing Google identity provider in Azure
8. **The system must** handle Google account selection and consent flows

### 4.3 Email/Password Authentication (Priority 3)
9. **The system must** allow users to create accounts with any valid email address
10. **The system must** route users who click "Continue with Email" to an email/password sign-up/sign-in form
11. **The system must** implement secure password requirements and validation
12. **The system must** handle email verification if required by the identity provider

### 4.4 Provider-Specific Routing
13. **The system must** use the `identity_provider` parameter for direct provider routing in External ID user flows
14. **The system must** pass provider-specific parameters to MSAL.js authentication calls using `extraQueryParameters`
15. **The system must** log authentication attempts with provider information for debugging
16. **The system must** use the correct External ID user flow endpoint format for multi-provider authentication

### 4.5 Azure Configuration Verification
16. **The system must** verify that the Azure External ID user flow includes all three identity providers
17. **The system must** confirm that app registration supports multi-tenant and personal Microsoft accounts
18. **The system must** validate that Google identity provider configuration is correct in Azure
19. **The system must** ensure email/password local accounts are properly enabled

### 4.6 Error Handling & User Experience
20. **The system must** display clear error messages when authentication fails
21. **The system must** provide debug logging for troubleshooting authentication issues
22. **The system must** handle authentication timeouts gracefully
23. **The system must** maintain the current clean, single-screen landing page design

## 5. Non-Goals (Out of Scope)

1. **Account linking between providers** - Users with same email across providers will be treated as separate accounts initially
2. **Social media providers beyond Google** - No Facebook, Twitter, LinkedIn, etc.
3. **Enterprise SSO integration** - No SAML or custom organizational identity providers  
4. **Multi-factor authentication configuration** - Use Azure default MFA settings
5. **Custom user registration flows** - Use standard Azure External ID user flows
6. **Password complexity customization** - Use Azure External ID default password policies
7. **Account recovery beyond standard flows** - Use Azure External ID built-in password reset

## 6. Technical Considerations

### 6.1 Current Architecture Leveraging
- **Existing Microsoft Entra External ID tenant** with configured identity providers
- **Current MSAL.js integration** in `frontend/src/config/authConfig.js`
- **Working JWT validation** in backend middleware
- **Established user flow** (`TaktMateSignUpSignIn`) in Azure
- **Production-ready security middleware** and CORS configuration

### 6.2 Key Technical Changes Required
- **Update `AuthContext.js`** to use `identity_provider` parameter for direct provider routing
- **Verify Azure user flow configuration** includes all three identity providers  
- **Test External ID user flow endpoint** with provider-specific parameters
- **Validate app registration** supports the correct account types
- **Ensure Content Security Policy** allows all required authentication domains

### 6.3 Dependencies & Integration Points
- **Microsoft Entra External ID service** - Primary authentication service
- **MSAL.js library** - Frontend authentication library  
- **Azure App Registration** - Must support multi-tenant and personal accounts
- **Google Cloud Console** - For Google OAuth configuration (if needed)
- **Azure Static Web Apps** - Frontend hosting with environment variables
- **Azure App Service** - Backend hosting with JWT validation

## 7. Design Considerations

### 7.1 Current UI Design (Maintain)
- **Clean, centered landing page** with three stacked authentication buttons
- **Provider-specific styling** - Blue for Microsoft, Red for Google, Gray for Email
- **Consistent button design** with proper icons and hover states
- **No scrolling required** - Single screen experience

### 7.2 Authentication Flow Design
- **Direct provider routing** - Each button goes to its specific provider
- **Consistent post-authentication redirect** - All users land on `/dashboard` after successful login
- **Error handling UI** - Clear error messages displayed on the landing page
- **Loading states** - Visual feedback during authentication process

## 8. Success Metrics

### 8.1 Primary Success Criteria
1. **All three authentication buttons work correctly** - Microsoft button goes to Microsoft, Google to Google, Email to Email/Password
2. **Any valid email address can create an account** through one of the three methods
3. **Existing `wzunker@taktconnect.com` functionality remains intact**
4. **Authentication errors are properly logged and debugged**

### 8.2 Technical Validation Metrics  
1. **Microsoft authentication** - Test with @outlook.com, @hotmail.com, and organizational accounts
2. **Google authentication** - Test with @gmail.com and Google Workspace accounts
3. **Email authentication** - Test with various email domains (@yahoo.com, @protonmail.com, etc.)
4. **Error handling** - Verify clear error messages for failed authentication attempts

### 8.3 User Experience Metrics
1. **Reduced authentication confusion** - Users understand which button to click
2. **Successful authentication on first attempt** for valid accounts
3. **Clear error messaging** when authentication fails
4. **Consistent post-login experience** regardless of provider chosen

## 9. Implementation Priority & Phases

### Phase 1: Microsoft Authentication Expansion (Priority 1)
- Verify app registration supports all Microsoft account types
- Test authentication with various Microsoft account types
- Fix any Microsoft-specific routing issues
- Ensure proper domain hints for Microsoft accounts

### Phase 2: Google Authentication Verification (Priority 2)
- Verify Google identity provider configuration in Azure
- Test Google authentication button routing
- Validate Google OAuth configuration
- Fix any Google-specific authentication issues

### Phase 3: Email/Password Authentication (Priority 3)  
- Verify local account configuration in Azure user flow
- Test email/password authentication flow
- Validate email verification process
- Ensure password requirements are properly enforced

### Phase 4: Integration Testing & Validation
- Test all three authentication methods end-to-end
- Verify no duplicate account creation (same email across providers)
- Validate error handling and user experience
- Confirm debug logging works for troubleshooting

## 10. Technical Implementation Notes

### 10.1 Frontend Changes Required
- **Provider-specific authentication calls** in `AuthContext.js` using `identity_provider` parameter
- **External ID user flow endpoint configuration** with provider routing support
- **Debug logging** for authentication attempts with provider information
- **Error handling** for provider-specific authentication failures

### 10.2 Azure Configuration Verification
- **User flow validation** - Ensure `TaktMateSignUpSignIn` includes all three providers
- **App registration validation** - Confirm support for multi-tenant and personal accounts  
- **Identity provider validation** - Verify Google and Microsoft providers are properly configured
- **Redirect URI validation** - Ensure all authentication flows have correct redirect URLs

### 10.3 Backend Considerations
- **JWT validation remains unchanged** - All providers issue compatible JWT tokens
- **User profile handling** - Ensure user data is properly extracted regardless of provider
- **Session management** - Maintain consistent session handling across providers

## 11. Open Questions

1. **Google OAuth Configuration**: Are the Google OAuth credentials in Azure External ID correctly configured with the right redirect URIs?
2. **User Flow Testing**: Has the `TaktMateSignUpSignIn` user flow been tested with all three providers?
3. **Identity Provider Parameter Effectiveness**: Does the `identity_provider` parameter in External ID user flows actually route to the correct providers?
4. **App Registration Settings**: Is the app registration configured for "Accounts in any organizational directory and personal Microsoft accounts"?
5. **Error Debugging**: What specific debug information should be logged for failed authentication attempts?

## 12. Acceptance Criteria

### 12.1 Functional Acceptance
- [ ] Microsoft button routes directly to Microsoft authentication
- [ ] Google button routes directly to Google authentication  
- [ ] Email button routes directly to Email/Password form
- [ ] Any valid Microsoft account can sign in successfully
- [ ] Any valid Google account can sign in successfully
- [ ] Any valid email can create an account with password
- [ ] Existing `wzunker@taktconnect.com` authentication continues to work

### 12.2 Technical Acceptance
- [ ] Provider-specific parameters are passed to MSAL authentication calls
- [ ] Debug logging shows which provider is being attempted
- [ ] Azure user flow includes all three identity providers
- [ ] App registration supports required account types
- [ ] Error messages are clear and actionable

### 12.3 User Experience Acceptance
- [ ] Landing page design remains clean and focused
- [ ] Authentication buttons have clear, distinct styling
- [ ] Loading states provide appropriate user feedback
- [ ] Error states don't break the user interface
- [ ] Post-authentication redirect works consistently

---

**Document Created**: January 9, 2025  
**Version**: 1.0  
**Target Audience**: Junior Developer  
**Estimated Complexity**: Medium (leverages existing infrastructure)
