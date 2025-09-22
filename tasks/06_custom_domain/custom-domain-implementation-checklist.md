# TaktMate Custom Domain Implementation Checklist

## Overview
This checklist guides you through adding a custom domain to your TaktMate web application, including both frontend (Azure Static Web Apps) and backend (Azure App Service) with Entra ID authentication.

**Recommended Domain Strategy:**
- Frontend: `app.taktconnect.com` 
- Backend API: `api.taktconnect.com`
- Keep `taktconnect.com` for your marketing website

---

## Phase 1: Domain Strategy and Planning

### Task 1.1: Domain Decision
- [X] **Choose subdomain strategy**
  - [X] Frontend subdomain: `app.taktconnect.com` (recommended)
  - [X] Backend API subdomain: `api.taktconnect.com` (recommended)
  - [X] Alternative: Purchase new domain variation (e.g., `taktconnectapp.com`)
  - [X] Document chosen domains in this checklist

**Chosen Domains:**
- Frontend: `app.taktconnect.com`
- Backend API: `api.taktconnect.com`

### Task 1.2: DNS Prerequisites
- [X] **Verify DNS provider access**
  - [X] Confirm access to Porkbun DNS management console
  - [X] Verify ability to add CNAME and TXT records
  - [X] Note current TTL settings for existing records

---

## Phase 2: DNS Configuration in Porkbun

### Task 2.1: Frontend DNS Setup
- [X] **Add frontend CNAME record**
  - [X] Log into Porkbun DNS manager
  - [X] Add CNAME record:
    - **Name**: `app` (or your chosen subdomain)
    - **Type**: CNAME
    - **Value**: `orange-flower-0b350780f.1.azurestaticapps.net` (current SWA hostname)
    - **TTL**: 300 (5 minutes for initial setup)

### Task 2.2: Backend DNS Setup
- [X] **Add backend CNAME record**
  - [X] Add CNAME record:
    - **Name**: `api` (or your chosen subdomain)
    - **Type**: CNAME  
    - **Value**: `taktmate-backend-api-csheb3aeg8f5bcbv.eastus-01.azurewebsites.net` (current backend hostname)
    - **TTL**: 300 (5 minutes for initial setup)

### Task 2.3: DNS Validation Records (Added Later)
- [ ] **Prepare for Azure validation**
  - [ ] Keep DNS console open for adding TXT validation records
  - [ ] Note: Azure will provide specific TXT records during domain setup

---

## Phase 3: Azure Frontend Domain Configuration

### Task 3.1: Configure Static Web App Custom Domain
- [X] **Add custom domain in Azure Portal**
  - [X] Navigate to: Azure Portal → Static Web Apps → `orange-flower-0b350780f` → Custom domains
  - [X] Click "Add" → "Custom domain on other DNS"
  - [X] Enter domain: `app.taktconnect.com` (or your chosen domain)
  - [X] Choose "CNAME" validation method

- [ ] **Complete DNS validation**
  - [ ] Azure will provide a TXT record for validation
  - [ ] Add the TXT record in Porkbun DNS:
    - **Name**: `_dnsauth.app` (or as specified by Azure)
    - **Type**: TXT
    - **Value**: (Azure-provided validation string)
  - [ ] Click "Validate" in Azure Portal
  - [ ] Wait for validation to complete (can take up to 24 hours)

- [ ] **Enable SSL certificate**
  - [ ] Verify "App Service Managed Certificate" is selected
  - [ ] Wait for SSL certificate provisioning (5-10 minutes)
  - [ ] Confirm HTTPS access works at new domain

### Task 3.2: Update Static Web App Configuration
- [ ] **Update routing configuration**
  - [ ] Verify `frontend/staticwebapp.config.json` routes work with custom domain
  - [ ] Test authentication flows at new domain
  - [ ] Confirm API proxy routing functions correctly

---

## Phase 4: Azure Backend Domain Configuration

### Task 4.1: Configure App Service Custom Domain
- [ ] **Add custom domain to App Service**
  - [ ] Navigate to: Azure Portal → App Services → `taktmate-backend-api` → Custom domains
  - [ ] Click "Add custom domain"
  - [ ] Enter domain: `api.taktconnect.com` (or your chosen domain)
  - [ ] Select "CNAME" validation

- [ ] **Complete domain validation**
  - [ ] Add Azure-provided TXT record to Porkbun DNS
  - [ ] Click "Validate" in Azure Portal
  - [ ] Wait for validation completion

- [ ] **Configure SSL certificate**
  - [ ] Navigate to: TLS/SSL settings → Private Key Certificates (.pfx)
  - [ ] Click "Create App Service Managed Certificate"
  - [ ] Select your custom domain
  - [ ] Wait for certificate creation
  - [ ] Navigate to: TLS/SSL settings → Bindings
  - [ ] Add TLS binding for your custom domain

---

## Phase 5: Authentication Configuration Updates

### Task 5.1: Update Entra ID App Registration
- [ ] **Add new redirect URIs**
  - [ ] Navigate to: Azure Portal → Microsoft Entra ID → App registrations
  - [ ] Find your TaktMate application registration
  - [ ] Go to Authentication → Redirect URIs
  - [ ] Add new redirect URI: `https://app.taktconnect.com/.auth/login/aad/callback`
  - [ ] Keep existing URI: `https://orange-flower-0b350780f.1.azurestaticapps.net/.auth/login/aad/callback`
  - [ ] Save changes

- [ ] **Update CORS settings if needed**
  - [ ] Check if additional CORS origins need to be configured
  - [ ] Add `https://app.taktconnect.com` to allowed origins if required

### Task 5.2: Verify Authentication Configuration
- [ ] **Test authentication flow**
  - [ ] Visit `https://app.taktconnect.com/login`
  - [ ] Complete Entra ID login process
  - [ ] Verify successful redirect back to application
  - [ ] Confirm user session is established correctly

---

## Phase 6: Backend Configuration Updates

### Task 6.1: Update CORS Configuration
- [ ] **Update backend CORS origins**
  - [ ] Locate CORS configuration in `backend/index.js` (lines 30-42)
  - [ ] Add custom domain to `allowedOrigins` array:
    ```javascript
    const allowedOrigins = [
      'http://localhost:3000', 
      'http://127.0.0.1:3000',
      'https://orange-flower-0b350780f.1.azurestaticapps.net',
      'https://app.taktconnect.com'  // Add this line
    ];
    ```
  - [ ] Deploy updated backend code

### Task 6.2: Update Environment Variables
- [ ] **Update Azure App Service settings**
  - [ ] Navigate to: App Service → Environment variables
  - [ ] Update `FRONTEND_URL` or `CORS_ORIGIN` to include new domain
  - [ ] Consider adding both old and new domains during transition:
    ```
    CORS_ORIGIN=https://orange-flower-0b350780f.1.azurestaticapps.net,https://app.taktconnect.com
    ```

### Task 6.3: Update Content Security Policy
- [ ] **Review CSP headers**
  - [ ] Check `backend/index.js` CSP configuration (lines 61-70)
  - [ ] Ensure new domains are included in `connect-src` directive if needed
  - [ ] Update if API calls are made from custom domain

---

## Phase 7: Frontend Configuration Updates

### Task 7.1: Update API Endpoints (If Needed)
- [ ] **Review API endpoint configuration**
  - [ ] Current setup uses relative URLs (`/api/*`) - ✅ No changes needed
  - [ ] If any hardcoded URLs exist, update them to use custom backend domain
  - [ ] Verify Static Web App proxy configuration routes to custom backend domain

### Task 7.2: Update Static Web App Proxy (Optional)
- [ ] **Consider updating staticwebapp.config.json**
  - [ ] Current proxy routes to: `taktmate-backend-api-csheb3aeg8f5bcbv.eastus-01.azurewebsites.net`
  - [ ] Option to update to custom domain: `api.taktconnect.com`
  - [ ] ⚠️ **Recommendation**: Keep Azure hostname for reliability; custom domain as alias

---

## Phase 8: Testing and Validation

### Task 8.1: End-to-End Functionality Testing
- [ ] **Test complete user journey**
  - [ ] Navigate to `https://app.taktconnect.com`
  - [ ] Complete login process via Entra ID
  - [ ] Upload a CSV file successfully
  - [ ] Verify file appears in DataTable component
  - [ ] Test chat functionality with uploaded data
  - [ ] Download a file to verify download flow
  - [ ] Test logout functionality

### Task 8.2: Cross-Browser Testing
- [ ] **Test in multiple browsers**
  - [ ] Chrome desktop
  - [ ] Firefox desktop  
  - [ ] Safari desktop
  - [ ] Mobile Safari (iOS)
  - [ ] Mobile Chrome (Android)
  - [ ] Edge desktop

### Task 8.3: Performance and Security Testing
- [ ] **Verify SSL certificates**
  - [ ] Check SSL certificate validity at frontend domain
  - [ ] Check SSL certificate validity at backend domain
  - [ ] Verify HTTPS redirect works properly
  - [ ] Test with SSL testing tools (e.g., SSL Labs)

- [ ] **Test API connectivity**
  - [ ] Verify direct backend API access: `https://api.taktconnect.com/api/health`
  - [ ] Test CORS functionality from custom frontend domain
  - [ ] Confirm authentication headers pass through correctly

---

## Phase 9: Monitoring and Alerts

### Task 9.1: Update Application Insights
- [ ] **Configure monitoring for custom domains**
  - [ ] Verify Application Insights captures traffic from custom domains
  - [ ] Update any URL-based filters or queries
  - [ ] Set up availability monitoring for custom domains

### Task 9.2: DNS Monitoring
- [ ] **Set up DNS monitoring**
  - [ ] Consider DNS monitoring service for custom domains
  - [ ] Set up alerts for DNS resolution failures
  - [ ] Monitor certificate expiration dates

---

## Phase 10: Go-Live and Cleanup

### Task 10.1: Update Documentation and References
- [ ] **Update internal documentation**
  - [ ] Update any internal wikis or documentation with new URLs
  - [ ] Update development environment configurations
  - [ ] Share new URLs with stakeholders

### Task 10.2: SEO and External References
- [ ] **Update external references**
  - [ ] Update any marketing materials with new domain
  - [ ] Consider SEO implications if publicly referenced
  - [ ] Update any bookmarks or saved links

### Task 10.3: DNS TTL Optimization
- [ ] **Optimize DNS settings**
  - [ ] Increase TTL values to 3600 (1 hour) or higher after successful testing
  - [ ] Monitor DNS propagation globally
  - [ ] Consider CDN integration if needed for global performance

---

## Rollback Plan

### Emergency Rollback Procedures
- [ ] **DNS Rollback**
  - [ ] Remove custom domain CNAME records in Porkbun
  - [ ] Wait for DNS propagation (up to TTL duration)
  - [ ] Verify original Azure hostnames still work

- [ ] **Azure Configuration Rollback**
  - [ ] Remove custom domains from Static Web App
  - [ ] Remove custom domains from App Service
  - [ ] Restore original CORS configuration in backend
  - [ ] Remove custom redirect URIs from Entra ID (keep originals)

- [ ] **Application Rollback**
  - [ ] Revert any code changes related to custom domains
  - [ ] Restore original environment variables
  - [ ] Verify application functionality on original domains

---

## Success Criteria Checklist

### Functional Requirements
- [ ] ✅ Users can access application at `https://app.taktconnect.com`
- [ ] ✅ Authentication works seamlessly with custom domain
- [ ] ✅ File upload functionality works from custom domain
- [ ] ✅ Chat functionality works with uploaded data
- [ ] ✅ File download functionality works
- [ ] ✅ API calls route correctly through custom backend domain
- [ ] ✅ SSL certificates are valid and trusted

### Technical Requirements  
- [ ] ✅ DNS records resolve correctly globally
- [ ] ✅ CORS configuration allows custom domain origins
- [ ] ✅ Authentication redirect URIs include custom domain
- [ ] ✅ Application Insights captures custom domain traffic
- [ ] ✅ No console errors or warnings in browser
- [ ] ✅ Performance is equivalent to original domains

### Business Requirements
- [ ] ✅ Professional branded URLs for user access
- [ ] ✅ Original Azure domains still work as fallback
- [ ] ✅ No disruption to existing users during transition
- [ ] ✅ Monitoring and alerting updated for new domains

---

## Key Configuration Files to Update

Based on codebase analysis, the following files may need updates:

### Backend Files
- [ ] `backend/index.js` - CORS configuration (lines 30-42)
- [ ] Azure App Service Environment Variables - CORS_ORIGIN setting
- [ ] Azure App Service - Custom domain configuration

### Frontend Files  
- [ ] `frontend/staticwebapp.config.json` - Already configured for auth routing ✅
- [ ] Azure Static Web Apps - Custom domain configuration
- [ ] Entra ID App Registration - Redirect URIs

### DNS Configuration
- [ ] Porkbun DNS - CNAME records for both subdomains
- [ ] Porkbun DNS - TXT records for Azure validation

---

## Notes and Considerations

### Authentication Flow
- Current authentication uses Entra External ID with custom OIDC provider
- Login route: `/.auth/login/entraExternalId` 
- Authentication context uses `/.auth/me` endpoint for session validation
- All API calls include `x-ms-client-principal` header with auth data

### API Architecture
- Frontend uses relative URLs (`/api/*`) routed through Static Web App proxy
- Static Web App proxy forwards to backend App Service
- All authentication handled via Static Web App built-in auth
- Backend validates auth via `x-ms-client-principal` header

### Current Domains
- **Frontend**: `https://orange-flower-0b350780f.1.azurestaticapps.net`
- **Backend**: `https://taktmate-backend-api-csheb3aeg8f5bcbv.eastus-01.azurewebsites.net`

### Security Considerations
- Keep original Azure domains active as fallbacks
- Maintain existing security headers and CSP policies
- Ensure SSL certificates auto-renew properly
- Monitor for any authentication bypass attempts

---

## Troubleshooting Guide

### Common Issues and Solutions

**DNS not resolving:**
- Verify CNAME records are correctly configured
- Check DNS propagation using online tools
- Confirm TTL settings allow for timely updates

**SSL certificate issues:**
- Verify domain validation completed successfully
- Check certificate binding in Azure
- Ensure custom domain is properly configured before requesting certificate

**Authentication failures:**
- Verify redirect URIs are correctly configured in Entra ID
- Check that custom domain is included in authentication provider settings
- Confirm Static Web App authentication configuration

**CORS errors:**
- Update backend CORS configuration to include custom domain
- Verify preflight OPTIONS requests are handled correctly
- Check browser developer tools for specific CORS error messages

**API routing issues:**
- Verify Static Web App proxy configuration
- Test backend API directly using custom domain
- Check that authentication headers are passed through correctly

---

## Timeline Estimate

**Phase 1-2 (Planning & DNS)**: 1-2 hours
**Phase 3-4 (Azure Configuration)**: 2-4 hours  
**Phase 5-7 (Authentication & Code Updates)**: 2-3 hours
**Phase 8 (Testing)**: 2-4 hours
**Phase 9-10 (Monitoring & Go-Live)**: 1-2 hours

**Total Estimated Time**: 8-15 hours (including waiting for DNS propagation and SSL certificate provisioning)

**Note**: DNS propagation and SSL certificate provisioning can add 2-24 hours of waiting time, but work can continue in parallel on other phases.
