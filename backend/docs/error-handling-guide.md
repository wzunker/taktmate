# TaktMate Authentication Error Handling Guide

## Overview

TaktMate implements a comprehensive error handling system for authentication failures, JWT validation errors, and system errors. This guide provides detailed information about error types, response formats, and troubleshooting guidance.

## Error Handling Architecture

### Core Components

1. **TaktMateError Class** - Centralized error handling with context and metadata
2. **JWTErrorHandler** - Specialized handling for JWT validation errors
3. **HTTPErrorHandler** - HTTP client error handling
4. **ErrorTracker** - Application Insights integration for error tracking
5. **Error Middleware** - Express middleware for comprehensive error handling

### Error Context

Every error includes comprehensive context information:
- Request ID for tracking
- User information (if available)
- Endpoint and HTTP method
- IP address and user agent
- Timestamp and additional metadata

## Authentication Error Types

### 1. Authentication Required (401)

**Error Code:** `AUTHENTICATION_REQUIRED`

**Triggers:**
- No JWT token provided in request
- Missing Authorization header
- Empty or invalid Authorization header format

**Response Format:**
```json
{
  "success": false,
  "error": {
    "type": "AUTHENTICATION_REQUIRED",
    "code": "AUTHENTICATION_REQUIRED",
    "message": "Please log in to continue.",
    "action": "redirect_to_login",
    "guidance": "You need to sign in with your account to access this feature.",
    "requestId": "req_1705312345_abc123",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

**User Action:** Redirect to login page

### 2. Invalid Token (401)

**Error Code:** `INVALID_TOKEN`

**Triggers:**
- JWT token with invalid signature
- Token from wrong issuer
- Corrupted token data

**Response Format:**
```json
{
  "success": false,
  "error": {
    "type": "INVALID_TOKEN",
    "code": "INVALID_TOKEN",
    "message": "Your session is invalid. Please sign in again.",
    "action": "redirect_to_login",
    "guidance": "Your authentication token is not valid. Please sign in again to get a new token.",
    "requestId": "req_1705312345_abc124",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

**User Action:** Redirect to login page

### 3. Expired Token (401)

**Error Code:** `EXPIRED_TOKEN`

**Triggers:**
- JWT token past expiration time
- Token used after configured lifetime

**Response Format:**
```json
{
  "success": false,
  "error": {
    "type": "EXPIRED_TOKEN",
    "code": "EXPIRED_TOKEN",
    "message": "Your session has expired. Please sign in again.",
    "action": "redirect_to_login",
    "guidance": "Your session has expired for security reasons. Please sign in again to continue.",
    "requestId": "req_1705312345_abc125",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

**User Action:** Redirect to login page

### 4. Malformed Token (401)

**Error Code:** `MALFORMED_TOKEN`

**Triggers:**
- JWT token with invalid structure
- Missing required JWT parts (header, payload, signature)
- Corrupted token encoding

**Response Format:**
```json
{
  "success": false,
  "error": {
    "type": "MALFORMED_TOKEN",
    "code": "MALFORMED_TOKEN",
    "message": "Authentication error. Please sign in again.",
    "action": "redirect_to_login",
    "guidance": "There was an issue with your authentication token. Please sign in again.",
    "requestId": "req_1705312345_abc126",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

**User Action:** Redirect to login page

### 5. Insufficient Permissions (403)

**Error Code:** `INSUFFICIENT_PERMISSIONS`

**Triggers:**
- User lacks required role
- User not in required company
- Feature requires email verification

**Response Format:**
```json
{
  "success": false,
  "error": {
    "type": "INSUFFICIENT_PERMISSIONS",
    "code": "INSUFFICIENT_PERMISSIONS",
    "message": "You do not have permission to access this resource.",
    "action": "contact_support",
    "guidance": "Your account does not have the required permissions. Contact your administrator if you believe this is an error.",
    "requestId": "req_1705312345_abc127",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

**User Action:** Contact support or administrator

### 6. Account Issues

#### Account Disabled (403)
**Error Code:** `ACCOUNT_DISABLED`
- User account has been disabled by administrator
- **Action:** Contact support

#### Account Locked (423)
**Error Code:** `ACCOUNT_LOCKED`
- Account temporarily locked due to security reasons
- **Action:** Wait and retry, or contact support

### 7. Rate Limiting (429)

**Error Code:** `RATE_LIMIT_EXCEEDED`

**Response Format:**
```json
{
  "success": false,
  "error": {
    "type": "RATE_LIMIT_EXCEEDED",
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please wait before trying again.",
    "action": "wait_and_retry",
    "guidance": "You have made too many requests. Please wait a few minutes before trying again.",
    "retryAfter": 300,
    "requestId": "req_1705312345_abc128",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

**Headers:** `Retry-After: 300`

**User Action:** Wait specified time before retrying

## Azure AD B2C Specific Errors

### 1. Service Unavailable (503)

**Error Code:** `AZURE_AD_B2C_UNAVAILABLE`

**Triggers:**
- Azure AD B2C service outage
- Network connectivity issues
- Service maintenance

**User Action:** Retry after a few minutes

### 2. Configuration Errors

#### Invalid Tenant (401)
**Error Code:** `INVALID_TENANT`
- Incorrect tenant configuration
- **Action:** Contact support

#### Invalid Client (401)
**Error Code:** `INVALID_CLIENT`
- Application registration issues
- **Action:** Contact support

#### JWKS Fetch Error (503)
**Error Code:** `JWKS_FETCH_ERROR`
- Unable to retrieve signing keys
- **Action:** Retry after a few minutes

## System Errors

### 1. Internal Server Error (500)

**Error Code:** `INTERNAL_SERVER_ERROR`

**Triggers:**
- Unexpected system errors
- Database connectivity issues
- Service dependencies unavailable

**User Action:** Try again later, contact support if persistent

### 2. Service Unavailable (503)

**Error Code:** `SERVICE_UNAVAILABLE`

**Triggers:**
- Maintenance mode
- System overload
- External service dependencies down

**User Action:** Try again later

## Error Response Format

All errors follow a standardized format:

```json
{
  "success": false,
  "error": {
    "type": "ERROR_TYPE",
    "code": "ERROR_CODE",
    "message": "User-friendly error message",
    "action": "recommended_action",
    "guidance": "Detailed guidance for user",
    "requestId": "unique_request_identifier",
    "timestamp": "ISO_8601_timestamp",
    "retryAfter": 300  // Only for rate limiting
  },
  "debug": {  // Only in development mode
    "originalMessage": "Technical error details",
    "stack": "Error stack trace",
    "originalError": "Original error message",
    "context": "Request context information"
  }
}
```

### Response Fields

- **success**: Always `false` for errors
- **error.type**: Technical error type for programmatic handling
- **error.code**: Specific error code for categorization
- **error.message**: User-friendly error message
- **error.action**: Recommended action for the user
- **error.guidance**: Detailed guidance for resolving the issue
- **error.requestId**: Unique identifier for tracking and debugging
- **error.timestamp**: When the error occurred
- **error.retryAfter**: Time to wait before retrying (rate limiting only)

## Error Actions

### Action Types

1. **redirect_to_login** - Redirect user to authentication page
2. **contact_support** - User should contact support for assistance
3. **wait_and_retry** - Wait specified time and retry the request
4. **retry_later** - Retry after a few minutes
5. **check_request** - Verify request parameters and try again
6. **verify_email** - Complete email verification process
7. **retry_or_relogin** - Try refreshing or sign in again

### Implementing Error Actions

```javascript
// Frontend error handling example
function handleApiError(error) {
  switch (error.action) {
    case 'redirect_to_login':
      window.location.href = '/login';
      break;
    case 'wait_and_retry':
      setTimeout(() => {
        retryRequest();
      }, error.retryAfter * 1000);
      break;
    case 'contact_support':
      showSupportModal(error.message, error.requestId);
      break;
    case 'retry_later':
      showRetryMessage(error.message);
      break;
    default:
      showGenericError(error.message);
  }
}
```

## Debugging and Monitoring

### Request Tracking

Every error includes a unique `requestId` for tracking:
- Use for correlation with server logs
- Include in support requests
- Track error patterns and frequencies

### Application Insights Integration

Errors are automatically tracked in Application Insights with:
- Error type and code
- User information (if available)
- Request context and metadata
- Performance metrics

### Debug Mode

In development environment, errors include additional debug information:
- Original error messages
- Stack traces
- Request context details
- JWT validation details

Enable debug mode:
```bash
DEBUG_AUTH=true
DEBUG_JWT=true
NODE_ENV=development
```

## Best Practices

### Frontend Implementation

1. **Handle All Error Types**: Implement handlers for all documented error actions
2. **User-Friendly Messages**: Display error.message to users, not technical details
3. **Retry Logic**: Implement automatic retry for transient errors
4. **Error Tracking**: Log errors with requestId for debugging
5. **Graceful Degradation**: Provide fallback functionality when possible

### Backend Implementation

1. **Consistent Error Handling**: Use TaktMateError for all authentication errors
2. **Context Information**: Always provide request context
3. **Security**: Don't expose sensitive information in error messages
4. **Monitoring**: Track error patterns and frequencies
5. **Documentation**: Keep error messages and guidance up to date

### Security Considerations

1. **Information Disclosure**: Avoid revealing system internals in error messages
2. **Rate Limiting**: Implement and respect rate limiting
3. **Audit Trail**: Log all authentication failures for security monitoring
4. **Token Handling**: Never log or expose JWT tokens in errors

## Testing Error Handling

### Automated Testing

Run comprehensive error handling tests:

```bash
# Test all error scenarios
npm run test:error-handling

# Test specific categories
npm run test:error-handling auth
npm run test:error-handling jwt
npm run test:error-handling performance
```

### Manual Testing

1. **Authentication Errors**: Test with missing, invalid, expired tokens
2. **Permission Errors**: Test role and company restrictions
3. **Rate Limiting**: Test with high request volumes
4. **Service Errors**: Test with simulated service outages
5. **Network Errors**: Test with network connectivity issues

### Error Simulation

Create test scenarios for:
- Token expiration
- Invalid signatures
- Service unavailability
- Rate limit exceeded
- Permission denied

## Troubleshooting Common Issues

### Token Validation Failures

1. **Check token format**: Ensure proper Bearer token format
2. **Verify expiration**: Check token exp claim
3. **Validate signature**: Ensure correct signing key
4. **Check issuer**: Verify iss claim matches configuration

### JWKS Key Issues

1. **Network connectivity**: Check Azure AD B2C endpoint accessibility
2. **Key rotation**: Clear JWKS cache after key rotation
3. **Configuration**: Verify tenant and client configuration

### Permission Errors

1. **Role assignment**: Verify user has required roles
2. **Company membership**: Check user company assignment
3. **Email verification**: Ensure email is verified if required

### Rate Limiting

1. **Request frequency**: Reduce request rate
2. **Caching**: Implement client-side caching
3. **Batch operations**: Combine multiple requests

## Support and Escalation

### Error Information to Collect

When reporting authentication errors, include:
- Request ID from error response
- Timestamp of the error
- User email/ID (if available)
- Error type and code
- Steps to reproduce

### Contact Information

- Technical Support: support@taktmate.com
- Emergency Issues: Use priority support channel
- Documentation Issues: Create GitHub issue

## Changelog

### Version 2.0.0
- Implemented comprehensive error handling system
- Added TaktMateError class with context and metadata
- Integrated Application Insights error tracking
- Enhanced JWT validation error handling
- Added user-friendly error messages and guidance

### Version 1.0.0
- Basic authentication error handling
- Simple JWT validation errors
- Limited error context and tracking
