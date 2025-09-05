# Product Requirements Document (PRD): Azure AD B2C to Microsoft Entra External ID Migration

## 1. Introduction/Overview

This PRD outlines the replacement of Azure AD B2C authentication system with Microsoft Entra External ID for the TaktMate web application. Since no Azure resources have been created and no users exist, this is a clean slate replacement rather than a data migration. The goal is to modernize our authentication infrastructure using Microsoft's current recommended CIAM solution.

## 2. Goals

- **Replace Azure AD B2C references** with Microsoft Entra External ID throughout the codebase
- **Maintain existing functionality** with minimal code changes (80% of code stays the same)
- **Simplify configuration** by removing Azure AD B2C-specific customizations
- **Enable MVP authentication** with Google, Microsoft, and email/password login
- **Preserve GDPR compliance** features for future users
- **Complete replacement within 1-2 weeks** for immediate deployment

## 3. User Stories

- **As a new user**, I want to sign up using Google, Microsoft, or email/password so I can access TaktMate's CSV analysis features
- **As a returning user**, I want to log in seamlessly using my preferred authentication method
- **As a user**, I want my data to be handled in compliance with GDPR regulations
- **As a developer**, I want the authentication system to use Microsoft's current recommended service for long-term support

## 4. Functional Requirements

### 4.1 Authentication Service Replacement
1. **Replace all Azure AD B2C tenant references** with Microsoft Entra External ID tenant configuration
2. **Update authentication endpoints** from `*.b2clogin.com` to `*.ciamlogin.com`
3. **Maintain OAuth 2.0/OpenID Connect protocols** (no changes needed)
4. **Preserve JWT token validation** logic (same token structure)

### 4.2 Configuration Updates
5. **Update environment variables** to use Entra External ID tenant settings
6. **Modify backend configuration files** to point to new authentication endpoints
7. **Update frontend authentication configuration** with new tenant details
8. **Replace documentation references** from Azure AD B2C to Microsoft Entra External ID

### 4.3 Social Login Providers
9. **Maintain Google OAuth integration** through Entra External ID
10. **Maintain Microsoft OAuth integration** through Entra External ID
11. **Support email/password authentication** for users without social accounts

### 4.4 Testing Framework Updates
12. **Update test configurations** to work with Entra External ID endpoints
13. **Remove Azure AD B2C-specific test scenarios** that don't apply to Entra External ID
14. **Maintain core authentication flow tests** with updated service references

## 5. Non-Goals (Out of Scope)

- **User data migration** (no existing users)
- **Backward compatibility** with Azure AD B2C (clean replacement)
- **Complex custom policies** (MVP uses standard user flows)
- **Advanced authentication features** beyond basic OAuth flows
- **Performance optimization** (focus on functional replacement first)

## 6. Design Considerations

### 6.1 Endpoint Changes
- **Authority URL**: Update from `https://{tenant}.b2clogin.com/{tenant}.onmicrosoft.com/{policy}` to `https://{tenant}.ciamlogin.com/{tenant}.onmicrosoft.com/{userflow}`
- **Token endpoints**: Automatic update when authority URL changes
- **JWKS endpoints**: Follow same pattern as Azure AD B2C

### 6.2 Configuration Structure
- **Same MSAL.js library**: Minimal frontend changes required
- **Same JWT validation**: Backend token handling unchanged
- **Same Graph API calls**: User data access remains identical

## 7. Technical Considerations

### 7.1 File Modifications Required
- `backend/config/azureAdB2C.js` → Rename and update to `backend/config/entraExternalId.js`
- All environment variable names: Replace `AZURE_AD_B2C_*` with `ENTRA_EXTERNAL_ID_*`
- Documentation files: Update setup guides and references
- Test files: Update endpoint URLs and service names

### 7.2 Dependencies
- **No new dependencies required**: Same MSAL libraries work with both services
- **Same Azure SDK packages**: Microsoft Graph integration unchanged
- **Existing test frameworks**: Jest and testing utilities remain the same

## 8. Success Metrics

- **All existing tests pass** with updated Entra External ID configuration
- **Authentication flows work** for Google, Microsoft, and email/password
- **JWT token validation succeeds** with new authority endpoints
- **GDPR compliance features function** correctly
- **Documentation reflects** new service accurately

## 9. Implementation Plan

### Phase 1: Configuration Replacement (2-3 days)
- Replace all Azure AD B2C references in configuration files
- Update environment variable names and values
- Modify authentication endpoints throughout codebase

### Phase 2: Testing Updates (1-2 days)
- Update test configurations for Entra External ID
- Remove Azure AD B2C-specific test scenarios
- Verify all authentication tests pass

### Phase 3: Documentation Updates (1 day)
- Update all setup guides and documentation
- Replace Azure AD B2C references with Entra External ID
- Update environment setup instructions

### Phase 4: Verification (1 day)
- Test complete authentication flows
- Verify GDPR compliance features
- Confirm social login providers work correctly

## 10. Open Questions

1. **Custom policies**: Do we need any custom user journeys beyond standard sign-up/sign-in flows?
2. **Branding**: Should we customize the authentication pages with TaktMate branding?
3. **Additional providers**: Do we want to add other social login providers (LinkedIn, GitHub) while we're updating?

## 11. Risk Assessment

### Low Risk
- **Same underlying technology**: Entra External ID is evolution of Azure AD B2C
- **No user data**: Clean slate means no migration complexity
- **Same protocols**: OAuth 2.0/OpenID Connect implementation identical

### Mitigation Strategies
- **Comprehensive testing**: Use existing test suite to verify functionality
- **Documentation updates**: Ensure all guides reflect new service
- **Rollback plan**: Keep Azure AD B2C configuration files as backup until verification complete

## 12. Definition of Done

- [ ] All Azure AD B2C references replaced with Microsoft Entra External ID
- [ ] Authentication flows work for all supported providers (Google, Microsoft, email/password)
- [ ] All relevant tests pass with updated configuration
- [ ] Documentation updated to reflect new service
- [ ] Environment setup guide provides clear instructions for Entra External ID
- [ ] GDPR compliance features function correctly
- [ ] No Azure AD B2C-specific code remains in the codebase
