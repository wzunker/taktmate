# Microsoft Entra External ID Testing Guide for TaktMate

This document provides comprehensive testing procedures for Microsoft Entra External ID integration in the TaktMate application.

## Overview

Testing Microsoft Entra External ID integration involves multiple layers:
1. **Configuration Testing** - Verify all settings are correct
2. **Connectivity Testing** - Ensure endpoints are accessible
3. **User Flow Testing** - Test authentication scenarios
4. **Token Validation Testing** - Verify JWT tokens work correctly
5. **Performance Testing** - Ensure acceptable response times
6. **Security Testing** - Validate security measures
7. **Integration Testing** - Test with frontend and backend

## Quick Start Testing

### Automated Testing Commands

```bash
# Run all tests
npm run test:all

# Test individual components
npm run test:config          # Configuration validation
npm run test:jwt-claims      # JWT token claims testing
npm run test:e2e             # End-to-end flow testing
npm run test:connectivity    # Endpoint connectivity
npm run test:performance     # Performance benchmarks

# Generate custom policies (if needed)
npm run generate:policies

# Validate application registration
npm run validate:app
```

### Expected Results

✅ **All tests should pass** before proceeding to production deployment.

## Detailed Testing Procedures

### 1. Configuration Testing

**Purpose**: Verify all Microsoft Entra External ID configuration is correct.

**Command**: `npm run test:config`

**What it tests**:
- Environment variables are set correctly
- Tenant configuration is valid
- Application registration details are correct
- User flow/policy names are configured
- URLs are properly formatted

**Expected Output**:
```
✅ Tenant name configured
✅ Client ID configured  
✅ Sign-up/sign-in policy configured
✅ Issuer URL generation
✅ JWKS URI generation
```

**Troubleshooting**:
- Check `backend/env.example` for required environment variables
- Verify tenant name matches Azure portal
- Ensure client ID matches application registration

### 2. Connectivity Testing

**Purpose**: Verify Microsoft Entra External ID endpoints are accessible.

**Command**: `npm run test:connectivity`

**What it tests**:
- JWKS endpoint connectivity
- OpenID configuration endpoint
- OAuth2 authorization endpoint
- Response times and status codes

**Expected Output**:
```
✅ JWKS Endpoint connectivity (150ms)
✅ OpenID Configuration connectivity (200ms)
✅ OAuth2 Authorization Endpoint connectivity (300ms)
✅ JWKS keys available
```

**Troubleshooting**:
- Check internet connectivity
- Verify tenant name and policy names
- Ensure Microsoft Entra External ID tenant is active

### 3. JWT Token Claims Testing

**Purpose**: Test JWT token structure and claims validation.

**Command**: `npm run test:jwt-claims`

**What it tests**:
- Token structure validation
- Required claims presence
- User profile extraction
- Claims mapping (user flows vs custom policies)
- Token validation scenarios

**Expected Output**:
```
✅ User profile extraction from token payload
✅ Invalid token handling: Expired token
✅ Invalid token handling: Invalid issuer
✅ Invalid token handling: Missing subject
```

**Troubleshooting**:
- Review user flow application claims configuration
- Check custom policy output claims
- Verify claims mapping in `azureAdB2C.js`

### 4. End-to-End Flow Testing

**Purpose**: Comprehensive testing of all authentication flows.

**Command**: `npm run test:e2e`

**What it tests**:
- User flow URL generation
- JWKS performance and caching
- Configuration validation
- Error handling scenarios
- Performance benchmarks

**Expected Output**:
```
✅ Sign-up/Sign-in URL generation
✅ JWKS key fetch (120ms)
✅ JWKS caching performance (8ms)
✅ Configuration validation
✅ Invalid JWKS endpoint handling
```

**Troubleshooting**:
- Check all previous test categories
- Verify network connectivity
- Review error messages for specific issues

### 5. Performance Testing

**Purpose**: Ensure acceptable performance for production use.

**Command**: `npm run test:performance`

**Performance Targets**:
- **JWKS key retrieval (cached)**: < 10ms
- **User profile extraction**: < 50ms
- **Login URL generation**: < 5ms
- **JWT token validation**: < 100ms

**Expected Output**:
```
✅ JWKS key retrieval (cached) performance (8ms)
✅ User profile extraction performance (12ms)
✅ Login URL generation performance (2ms)
```

**Troubleshooting**:
- Check network latency to Azure endpoints
- Verify JWKS caching is working correctly
- Review code efficiency in profile extraction

## Manual Testing Procedures

### 1. Azure Portal User Flow Testing

**Steps**:
1. Go to Microsoft Entra External ID > User flows
2. Select `B2C_1_signupsignin1`
3. Click "Run user flow"
4. Select your TaktMate application
5. Set Reply URL to `https://jwt.ms`
6. Click "Run user flow"
7. Complete authentication process
8. Verify token is displayed at jwt.ms

**What to verify**:
- ✅ Authentication flow completes successfully
- ✅ Token contains all required claims
- ✅ Custom attributes (company, role) are present
- ✅ Token signature is valid

### 2. New User Registration Testing

**Test Scenario**: First-time user sign-up

**Steps**:
1. Navigate to generated sign-up URL
2. Click "Sign up now"
3. Fill in registration form:
   - Email address
   - Password (meeting complexity requirements)
   - Given name
   - Surname  
   - Company name
   - Job title/role
4. Complete email verification (if required)
5. Verify successful registration

**Expected Results**:
- ✅ Registration form accepts all required information
- ✅ Password complexity requirements are enforced
- ✅ Email verification is sent (if configured)
- ✅ JWT token contains all custom attributes
- ✅ User can login immediately after registration

### 3. Existing User Login Testing

**Test Scenario**: Returning user authentication

**Steps**:
1. Navigate to sign-in URL
2. Enter existing user credentials
3. Complete authentication
4. Verify token generation

**Expected Results**:
- ✅ Valid credentials allow successful login
- ✅ Invalid credentials are rejected with clear error
- ✅ JWT token contains updated user information
- ✅ Session is established properly

### 4. Social Login Testing

#### Google Authentication
**Steps**:
1. Navigate to sign-in URL
2. Click "Google" button
3. Complete Google OAuth flow
4. Provide additional information if first login
5. Verify token generation

**Expected Results**:
- ✅ Google OAuth popup opens correctly
- ✅ User can authorize the application
- ✅ Profile information is imported from Google
- ✅ Additional attributes are collected
- ✅ JWT token contains both Google and custom claims

#### Microsoft Authentication
**Steps**:
1. Navigate to sign-in URL
2. Click "Microsoft" button
3. Complete Microsoft OAuth flow
4. Verify token generation

**Expected Results**:
- ✅ Microsoft OAuth flow completes successfully
- ✅ Work/school accounts are supported
- ✅ Profile information is imported correctly
- ✅ JWT token contains Microsoft and custom claims

### 5. Password Reset Testing

**Steps**:
1. Click "Forgot password?" link
2. Enter email address
3. Check email for reset link
4. Click reset link and set new password
5. Login with new password

**Expected Results**:
- ✅ Reset email is sent promptly
- ✅ Reset link is secure and time-limited
- ✅ New password meets complexity requirements
- ✅ User can login with new password
- ✅ Old password no longer works

### 6. Profile Edit Testing

**Steps**:
1. Navigate to profile edit URL (authenticated user)
2. Modify profile information
3. Save changes
4. Verify updates in new tokens

**Expected Results**:
- ✅ Profile form loads with current information
- ✅ Changes can be saved successfully
- ✅ Updated information appears in JWT tokens
- ✅ Changes persist across sessions

## Cross-Browser Testing

### Desktop Browsers
Test authentication flows in:
- ✅ Chrome (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Edge (latest)

### Mobile Browsers
Test authentication flows in:
- ✅ Chrome Mobile (Android)
- ✅ Safari Mobile (iOS)
- ✅ Samsung Internet
- ✅ Firefox Mobile

### Specific Test Cases
- ✅ Social login popup handling
- ✅ Redirect flow completion
- ✅ Token storage and retrieval
- ✅ Session persistence

## Security Testing

### Token Security Validation

**Tests to perform**:
1. **Token Signature Verification**
   - Verify tokens are signed with RS256
   - Confirm JWKS keys validate signatures
   - Test with modified tokens (should fail)

2. **Token Expiration**
   - Verify expired tokens are rejected
   - Test clock tolerance settings
   - Confirm refresh token behavior

3. **Issuer and Audience Validation**
   - Test tokens from wrong issuer (should fail)
   - Test tokens for wrong audience (should fail)
   - Verify proper validation parameters

### Authentication Security

**Tests to perform**:
1. **Password Policy Enforcement**
   - Test weak passwords (should be rejected)
   - Verify complexity requirements
   - Test password reuse policies

2. **Account Protection**
   - Test multiple failed login attempts
   - Verify account lockout mechanisms
   - Test account unlock procedures

3. **Session Security**
   - Verify session expiration
   - Test logout functionality
   - Check session hijacking protection

## Performance Benchmarks

### Target Performance Metrics

| Operation | Target | Acceptable | Critical |
|-----------|--------|------------|----------|
| Authentication Flow | < 3s | < 5s | > 10s |
| JWT Token Validation | < 100ms | < 200ms | > 500ms |
| JWKS Key Retrieval (cached) | < 10ms | < 50ms | > 100ms |
| User Profile Extraction | < 50ms | < 100ms | > 200ms |
| Login URL Generation | < 5ms | < 10ms | > 50ms |

### Load Testing

**Concurrent User Testing**:
- Test 10 simultaneous authentications
- Measure response times and success rates
- Verify no degradation in performance

**JWKS Caching Testing**:
- Verify keys are cached appropriately
- Test cache invalidation and refresh
- Measure cache hit rates

## Error Handling Testing

### Common Error Scenarios

1. **Network Connectivity Issues**
   - Test with no internet connection
   - Test with slow network
   - Verify graceful degradation

2. **Configuration Errors**
   - Test with invalid tenant name
   - Test with wrong client ID
   - Test with missing environment variables

3. **Token Validation Errors**
   - Test with expired tokens
   - Test with invalid signatures
   - Test with malformed tokens

4. **User Flow Errors**
   - Test cancelled authentication
   - Test denied permissions
   - Test invalid user input

### Expected Error Handling

- ✅ Clear, user-friendly error messages
- ✅ Appropriate HTTP status codes
- ✅ Proper logging of errors
- ✅ Graceful fallback behavior
- ✅ Security-conscious error responses

## Integration Testing

### Frontend Integration

**Tests to perform**:
1. **React Application Integration**
   - Test authentication context
   - Verify protected route behavior
   - Test token storage in browser
   - Verify logout functionality

2. **API Integration**
   - Test protected API endpoints
   - Verify user profile extraction
   - Test role-based access control
   - Verify audit logging

### Backend Integration

**Tests to perform**:
1. **Middleware Integration**
   - Test JWT validation middleware
   - Test optional authentication
   - Test role-based authorization
   - Test error handling

2. **Database Integration**
   - Test user profile storage (if applicable)
   - Test audit logging
   - Test session management

## Automated Testing Setup

### Jest Test Suite

Create automated tests for continuous validation:

```javascript
// Example test structure
describe('Microsoft Entra External ID Integration', () => {
  describe('Configuration', () => {
    test('should validate configuration correctly', () => {
      // Test implementation
    });
  });
  
  describe('JWT Token Validation', () => {
    test('should validate valid tokens', async () => {
      // Test implementation
    });
    
    test('should reject invalid tokens', async () => {
      // Test implementation
    });
  });
  
  describe('User Profile Extraction', () => {
    test('should extract user profile from token', () => {
      // Test implementation
    });
  });
});
```

### CI/CD Integration

**Pre-deployment Testing**:
- Configuration validation
- Connectivity testing
- Unit test execution

**Post-deployment Testing**:
- End-to-end flow testing
- Performance benchmarking
- Security validation

**Monitoring Setup**:
- Authentication success rate monitoring
- Token validation error tracking
- Performance metrics collection

## Troubleshooting Guide

### Common Issues and Solutions

1. **"Configuration validation failed"**
   - **Cause**: Missing or invalid environment variables
   - **Solution**: Check `backend/env.example` and update `.env` file
   - **Verification**: Run `npm run test:config`

2. **"JWKS Endpoint connectivity failed"**
   - **Cause**: Network issues or invalid tenant configuration
   - **Solution**: Verify tenant name and internet connectivity
   - **Verification**: Run `npm run test:connectivity`

3. **"No JWKS keys found"**
   - **Cause**: Application not properly registered or policies not configured
   - **Solution**: Check application registration and user flow configuration
   - **Verification**: Review Azure portal settings

4. **"Token validation failed"**
   - **Cause**: Clock skew, invalid configuration, or expired tokens
   - **Solution**: Check system time, verify issuer/audience settings
   - **Verification**: Run `npm run test:jwt-claims`

5. **"User profile extraction failed"**
   - **Cause**: Missing claims in user flow or custom policy
   - **Solution**: Configure application claims in user flow
   - **Verification**: Test token generation and inspect claims

### Getting Help

1. **Review Documentation**
   - Check `ENTRA_EXTERNAL_ID_SETUP.md` for setup instructions
   - Review `AZURE_APP_REGISTRATION_GUIDE.md` for registration details

2. **Run Diagnostic Tools**
   - Use `npm run test:all` for comprehensive testing
   - Check specific test categories for targeted diagnosis

3. **Check Azure Portal**
   - Verify tenant configuration
   - Review user flow settings
   - Check application registration details

4. **Consult Logs**
   - Review application logs for errors
   - Check Microsoft Entra External ID audit logs
   - Monitor Application Insights (if configured)

## Test Results Documentation

### Test Execution Checklist

Before marking testing complete, verify:

- [ ] All automated tests pass (`npm run test:all`)
- [ ] Manual user flow testing completed successfully
- [ ] Cross-browser testing completed
- [ ] Performance benchmarks meet targets
- [ ] Security testing validates all requirements
- [ ] Integration testing with frontend and backend completed
- [ ] Error handling scenarios tested and validated
- [ ] Documentation updated with any configuration changes

### Success Criteria

**Testing is considered successful when**:
- ✅ 90%+ of automated tests pass
- ✅ All manual authentication flows work correctly
- ✅ Performance meets or exceeds targets
- ✅ Security requirements are validated
- ✅ Integration with application components works
- ✅ Error handling is appropriate and user-friendly

### Next Steps After Testing

1. **Document any configuration changes**
2. **Update team on testing results**
3. **Proceed to Task 1.7: Documentation completion**
4. **Begin Task 2.0: Backend integration implementation**
5. **Set up monitoring and alerting for production**

---

## Quick Reference

### Testing Commands
```bash
npm run test:all           # Complete test suite
npm run test:config        # Configuration validation
npm run test:jwt-claims    # JWT token testing
npm run test:e2e           # End-to-end testing
npm run test:connectivity  # Connectivity testing
npm run test:performance   # Performance benchmarks
```

### Key URLs for Manual Testing
- **Login**: Generated by `generateLoginUrl('https://jwt.ms')`
- **Password Reset**: Generated by `generatePasswordResetUrl('https://jwt.ms')`
- **Profile Edit**: Generated by `generateProfileEditUrl('https://jwt.ms')`
- **Token Decoder**: https://jwt.ms

### Configuration Files
- **Environment**: `backend/.env`
- **Config Module**: `backend/config/azureAdB2C.js`
- **Middleware**: `backend/middleware/jwtValidation.js`
- **Testing Scripts**: `backend/scripts/test-*.js`
