# Task List: Azure AD B2C to Microsoft Entra External ID Migration

Based on PRD: `prd-entra-external-id-migration.md`

## Current State Assessment

### Existing Azure AD B2C Implementation
- **Backend Configuration**: Complete Azure AD B2C config in `backend/config/azureAdB2C.js` with comprehensive token validation
- **Authentication Middleware**: JWT validation, token management, and auth routes fully implemented
- **Frontend Integration**: MSAL.js integration with React components for login, logout, and user profile
- **Environment Configuration**: Separate staging and production environment files with Azure AD B2C endpoints
- **Testing Framework**: Comprehensive test suite (500+ tests) covering authentication flows, GDPR compliance, and security
- **Documentation**: Complete setup guides and configuration documentation for Azure AD B2C

### Migration Strategy
Since no Azure resources exist and no users are registered, this is a **clean replacement** rather than a migration. The strategy focuses on:
- **Direct replacement** of Azure AD B2C references with Microsoft Entra External ID
- **Minimal code changes** (80% of code structure remains the same)
- **Configuration updates** for endpoints and environment variables
- **Test suite updates** to work with new service endpoints

## Relevant Files

### Files to Modify (Replace Azure AD B2C with Entra External ID)
- `backend/config/azureAdB2C.js` → Rename to `backend/config/entraExternalId.js` and update endpoints
- `backend/routes/auth.js` - Update imports and service references
- `backend/middleware/jwtValidation.js` - Update configuration imports
- `backend/middleware/tokenManagement.js` - Update Azure AD B2C references
- `backend/middleware/jwtAuth.js` - Update configuration imports
- `backend/services/azureB2CApiService.js` → Rename to `backend/services/entraExternalIdApiService.js`
- `backend/env.example` - Replace environment variable names and examples
- `backend/env.production` - Update environment variable names
- `backend/env.staging` - Update environment variable names
- `frontend/src/config/authConfig.js` - Update MSAL configuration for Entra External ID
- `frontend/env.production` - Update environment variable names and endpoints
- `frontend/env.staging` - Update environment variable names and endpoints
- `frontend/staticwebapp.config.json` - Update authentication provider references

### Documentation Files to Update
- `AZURE_AD_B2C_COMPLETE_SETUP_GUIDE.md` → `MICROSOFT_ENTRA_EXTERNAL_ID_SETUP_GUIDE.md`
- `AZURE_AD_B2C_SETUP.md` → `MICROSOFT_ENTRA_EXTERNAL_ID_SETUP.md`
- `AZURE_AD_B2C_README.md` → `MICROSOFT_ENTRA_EXTERNAL_ID_README.md`
- `AZURE_AD_B2C_TESTING_GUIDE.md` → `MICROSOFT_ENTRA_EXTERNAL_ID_TESTING_GUIDE.md`
- `azure/AZURE_B2C_CONFIGURATION_GUIDE.md` → `azure/ENTRA_EXTERNAL_ID_CONFIGURATION_GUIDE.md`
- `azure/AZURE_B2C_URL_CONFIGURATION.md` → `azure/ENTRA_EXTERNAL_ID_URL_CONFIGURATION.md`
- `tasks/01_online_hosting_authentication/ENVIRONMENT_SETUP_GUIDE.md` - Update for Entra External ID
- `README.md` - Update authentication section references

### Test Files to Update
- `backend/__tests__/unit/config/azureAdB2C.test.js` → `backend/__tests__/unit/config/entraExternalId.test.js`
- `backend/__tests__/setup.js` - Update environment variable names
- All test files with Azure AD B2C endpoint references need URL updates

### Azure Configuration Scripts to Update
- `azure/configure-b2c-urls.sh` → `azure/configure-entra-external-id-urls.sh`
- `azure/configure-b2c-urls.ps1` → `azure/configure-entra-external-id-urls.ps1`
- `azure/test-b2c-urls.sh` → `azure/test-entra-external-id-urls.sh`
- `azure/manage-b2c-config.sh` → `azure/manage-entra-external-id-config.sh`
- `azure/test-b2c-authentication.sh` → `azure/test-entra-external-id-authentication.sh`
- `azure/update-b2c-redirect-urls.sh` → `azure/update-entra-external-id-redirect-urls.sh`

### Notes
- **Same MSAL libraries**: No dependency changes required
- **Same JWT token structure**: Token validation logic remains identical
- **Same Graph API**: Microsoft Graph integration unchanged
- **Environment variables**: Rename from `AZURE_AD_B2C_*` to `ENTRA_EXTERNAL_ID_*`
- **Endpoint changes**: Replace `*.b2clogin.com` with `*.ciamlogin.com`
- **Test framework**: Jest and testing utilities remain the same

## Tasks

- [x] 1.0 Backend Configuration Migration
  - [x] 1.1 Rename `backend/config/azureAdB2C.js` to `backend/config/entraExternalId.js`
  - [x] 1.2 Update all endpoint URLs from `*.b2clogin.com` to `*.ciamlogin.com` in configuration
  - [x] 1.3 Replace environment variable names from `AZURE_AD_B2C_*` to `ENTRA_EXTERNAL_ID_*`
  - [x] 1.4 Update authority URL construction to use Microsoft Entra External ID format
  - [x] 1.5 Update JWKS URI and issuer URL generation functions
  - [x] 1.6 Update all function and variable names from azureAdB2C to entraExternalId
  - [x] 1.7 Update comments and documentation strings in configuration file

- [x] 2.0 Backend Services and Middleware Migration
  - [x] 2.1 Update `backend/routes/auth.js` import statements to use new configuration file
  - [x] 2.2 Update `backend/middleware/jwtValidation.js` to import from entraExternalId config
  - [x] 2.3 Update `backend/middleware/tokenManagement.js` service references
  - [x] 2.4 Update `backend/middleware/jwtAuth.js` configuration imports
  - [x] 2.5 Rename `backend/services/azureB2CApiService.js` to `backend/services/entraExternalIdApiService.js`
  - [x] 2.6 Update Microsoft Graph API service references (if any service-specific changes needed)
  - [x] 2.7 Update all service class names and references throughout backend

- [x] 3.0 Frontend Configuration Migration
  - [x] 3.1 Update `frontend/src/config/authConfig.js` MSAL configuration for Entra External ID
  - [x] 3.2 Replace authority URLs from `*.b2clogin.com` to `*.ciamlogin.com` in frontend config
  - [x] 3.3 Update known authorities array with new Entra External ID domains
  - [x] 3.4 Update B2C policy references to Entra External ID user flow format
  - [x] 3.5 Update environment variable names in frontend configuration
  - [x] 3.6 Update any hardcoded Azure AD B2C references in React components
  - [x] 3.7 Test MSAL.js integration with new configuration

- [x] 4.0 Environment Variables Migration
  - [x] 4.1 Update `backend/env.example` with new Entra External ID variable names
  - [x] 4.2 Update `backend/env.production` environment variable names and example values
  - [x] 4.3 Update `backend/env.staging` environment variable names and example values
  - [x] 4.4 Update `frontend/env.production` with new variable names and endpoints
  - [x] 4.5 Update `frontend/env.staging` with new variable names and endpoints
  - [x] 4.6 Create migration script to help convert existing environment files
  - [x] 4.7 Update `frontend-env.example` with new Entra External ID variables

- [x] 5.0 Documentation Updates
  - [x] 5.1 Rename `AZURE_AD_B2C_COMPLETE_SETUP_GUIDE.md` to `MICROSOFT_ENTRA_EXTERNAL_ID_SETUP_GUIDE.md`
  - [x] 5.2 Update all Azure AD B2C references to Microsoft Entra External ID in setup guide
  - [x] 5.3 Rename `AZURE_AD_B2C_SETUP.md` to `MICROSOFT_ENTRA_EXTERNAL_ID_SETUP.md`
  - [x] 5.4 Rename `AZURE_AD_B2C_README.md` to `MICROSOFT_ENTRA_EXTERNAL_ID_README.md`
  - [x] 5.5 Rename `AZURE_AD_B2C_TESTING_GUIDE.md` to `MICROSOFT_ENTRA_EXTERNAL_ID_TESTING_GUIDE.md`
  - [x] 5.6 Update `README.md` authentication section to reference Entra External ID
  - [x] 5.7 Update `tasks/01_online_hosting_authentication/ENVIRONMENT_SETUP_GUIDE.md` for Entra External ID
  - [x] 5.8 Update all Azure configuration guides in `azure/` directory

- [x] 6.0 Azure Scripts Migration
  - [x] 6.1 Rename `azure/configure-b2c-urls.sh` to `azure/configure-entra-external-id-urls.sh`
  - [x] 6.2 Rename `azure/configure-b2c-urls.ps1` to `azure/configure-entra-external-id-urls.ps1`
  - [x] 6.3 Update script content to use Entra External ID endpoints and configuration
  - [x] 6.4 Rename `azure/test-b2c-urls.sh` to `azure/test-entra-external-id-urls.sh`
  - [x] 6.5 Rename `azure/manage-b2c-config.sh` to `azure/manage-entra-external-id-config.sh`
  - [x] 6.6 Rename `azure/test-b2c-authentication.sh` to `azure/test-entra-external-id-authentication.sh`
  - [x] 6.7 Update all script references and environment variable names
  - [x] 6.8 Update Azure configuration guide files to reference new scripts

- [x] 7.0 Testing Framework Updates
  - [x] 7.1 Rename `backend/__tests__/unit/config/azureAdB2C.test.js` to `backend/__tests__/unit/config/entraExternalId.test.js`
  - [x] 7.2 Update test imports to use new configuration file
  - [x] 7.3 Update `backend/__tests__/setup.js` environment variable names
  - [x] 7.4 Update test endpoint URLs from `*.b2clogin.com` to `*.ciamlogin.com`
  - [x] 7.5 Remove any Azure AD B2C-specific test scenarios that don't apply to Entra External ID
  - [x] 7.6 Update test descriptions and comments to reference Entra External ID
  - [x] 7.7 Update all test runners and validation scripts
  - [x] 7.8 Verify all existing tests pass with new configuration

- [x] 8.0 Static Web App Configuration Updates
  - [x] 8.1 Update `frontend/staticwebapp.config.json` authentication provider references
  - [x] 8.2 Update routing rules to work with Entra External ID callback URLs
  - [x] 8.3 Update any Azure Static Web App specific authentication configurations
  - [x] 8.4 Test Static Web App authentication flow with new configuration

- [x] 9.0 Verification and Validation
  - [x] 9.1 Run complete test suite to ensure all tests pass with new configuration
  - [x] 9.2 Test authentication flows manually (login, logout, token refresh)
  - [x] 9.3 Verify Google OAuth integration works through Entra External ID
  - [x] 9.4 Verify Microsoft OAuth integration works through Entra External ID
  - [x] 9.5 Test GDPR compliance features with new service
  - [x] 9.6 Validate JWT token structure and claims are identical
  - [x] 9.7 Test file upload and CSV processing with authenticated users
  - [x] 9.8 Perform final cleanup of any remaining Azure AD B2C references
