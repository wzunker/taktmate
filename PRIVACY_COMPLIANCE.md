# TaktMate Data Privacy & Compliance

## Data Processing Overview

### Data Storage Locations
- **Primary Storage**: Azure Blob Storage (East US region)
- **Application Hosting**: Azure Web App (East US region)
- **Authentication**: Azure Static Web Apps with Entra External ID
- **AI Processing**: Azure OpenAI (East US region)

### Data Types Processed
1. **User Files**: CSV documents uploaded by authenticated users
2. **User Identity**: Authentication tokens and user IDs from Entra External ID
3. **Usage Metadata**: File names, sizes, upload timestamps
4. **Chat Data**: User questions and AI responses (not permanently stored)

## Data Retention Policy

### Automatic Deletion
- **File Storage**: Files are automatically deleted after 90 days of inactivity (when lifecycle policy is enabled)
- **Chat History**: Not permanently stored, only maintained during session
- **Usage Logs**: Diagnostic logs retained for 30 days in Azure Monitor

### User-Initiated Deletion
- Users can delete their files immediately through the application interface
- File deletion removes all associated metadata
- Container deletion occurs automatically when all user files are removed

## Data Security Measures

### Encryption
- **In Transit**: All data encrypted using HTTPS/TLS 1.2+
- **At Rest**: Azure Storage Service Encryption (SSE) with Microsoft-managed keys
- **Application**: Secure communication between all Azure services

### Access Control
- **User Isolation**: Each user has a dedicated container (u-{hash})
- **Authentication**: Azure Entra External ID integration
- **Authorization**: User delegation SAS tokens with minimal permissions
- **Network Security**: CORS restrictions and security headers

### Data Processing Boundaries
- **Geographic**: All processing occurs within Azure East US region
- **Service Boundary**: Data only shared between TaktMate Azure services
- **Third Party**: No data shared with external services except Azure OpenAI for analysis

## Compliance Framework

### GDPR Compliance (if applicable)
- **Right to Access**: Users can view all their uploaded files
- **Right to Deletion**: Users can delete files individually or request full account deletion
- **Right to Portability**: Users can download their files in original format
- **Data Minimization**: Only necessary data is collected and processed
- **Purpose Limitation**: Data only used for document analysis and chat functionality

### User Consent
- Users must acknowledge data processing terms before uploading files
- Clear information provided about data storage duration and processing
- Opt-in consent for file analysis and AI processing

## Data Subject Rights Implementation

### User Data Access
```javascript
// GET /api/files - Lists all user's files with metadata
// GET /api/files/{filename}/sas - Provides download access to user's files
```

### User Data Deletion
```javascript
// DELETE /api/files/{filename} - Deletes specific file
// Future: DELETE /api/user/data - Deletes all user data
```

### Data Portability
- Users can download original files via SAS URLs
- File metadata available through API responses
- No vendor lock-in for file formats

## Monitoring & Auditing

### Access Logging
- All file operations logged in Azure Storage Analytics
- User authentication events tracked in Application Insights
- Failed access attempts monitored and alerted

### Data Processing Audit Trail
- File upload/download events with timestamps
- User consent acknowledgments (when implemented)
- Data deletion events with verification

## Contact Information

For data privacy inquiries or data subject rights requests:
- **Application Owner**: [Your Contact Information]
- **Data Controller**: [Your Organization]
- **Data Protection Officer**: [If applicable]

## Last Updated
{Current Date} - Initial privacy framework for blob storage implementation
