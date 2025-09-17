# Azure Blob Storage Implementation Tasks

## Project Analysis Summary

Based on code review, TaktMate currently uses:
- **Authentication**: Azure Static Web Apps with Entra External ID (x-ms-client-principal header)
- **File Handling**: In-memory storage with multer, 5MB limit, 5 file max, CSV parsing
- **Security**: User isolation via file ID prefixing (`${user.id}_${timestamp}_${random}`)
- **Backend**: Node.js/Express with Azure OpenAI integration
- **Frontend**: React with axios for file uploads

## Implementation Plan Overview

**Goal**: Replace in-memory file storage with persistent, secure Azure Blob Storage using per-user containers, managed identity authentication, and SAS-based direct upload/download.

**Architecture**: Backend acts as trusted SAS token issuer, frontend uploads/downloads directly to/from Blob Storage.

---

## Phase 1: Azure Infrastructure Setup

### Task 1.1: Provision Azure Storage Account
**Priority**: High | **Estimated Time**: 30 minutes

- [X] Create Azure Storage Account (Standard, GPv2)
  - [X] Choose same resource group as existing Web App
  - [X] Select region close to users (match existing services)
  - [X] Disable public blob access at account level
  - [X] Enable versioning and soft delete (optional but recommended)
- [X] Document storage account name and resource details
- [X] Test connectivity from Azure portal

**Deliverables**: Storage account ready with connection details

### Task 1.2: Configure Managed Identity & RBAC
**Priority**: High | **Estimated Time**: 20 minutes

- [X] Enable System-assigned Managed Identity on existing Azure Web App (backend)
- [X] Grant "Storage Blob Data Contributor" role to Web App's managed identity at storage account level
- [X] Test managed identity access from Web App
- [X] Document role assignment details

**Deliverables**: Backend Web App can authenticate to storage account

### Task 1.3: Enable Access Time Tracking & Lifecycle Policy (SKIPPED FOR NOW)
**Priority**: Medium | **Estimated Time**: 15 minutes

- [ ] Enable Last Access Time Tracking on storage account
  ```powershell
  Enable-AzStorageBlobLastAccessTimeTracking -ResourceGroupName "<rg>" -AccountName "<storage>"
  ```
- [ ] Create Lifecycle Management policy
  - [ ] Rule: Delete blobs after 90 days since last access
  - [ ] Apply to all containers with prefix "u-" (user containers)
- [ ] Test policy configuration

**Deliverables**: Automatic cleanup after 90 days of inactivity

---

## Phase 2: Backend Implementation

### Task 2.1: Install Azure Storage Dependencies
**Priority**: High | **Estimated Time**: 10 minutes

- [X] Add to `backend/package.json`:
  ```json
  "@azure/identity": "^4.0.1",
  "@azure/storage-blob": "^12.17.0"
  ```
- [X] Run `npm install` in backend directory
- [X] Update environment variables documentation

**Deliverables**: Required Azure SDK packages installed

### Task 2.2: Create Storage Service Layer
**Priority**: High | **Estimated Time**: 2 hours

- [X] Create `backend/services/storage.js` with functions:
  - [X] `serviceClient()` - Initialize BlobServiceClient with DefaultAzureCredential
  - [X] `ensureUserContainer(userId)` - Create/get user container (`u-${userId.toLowerCase()}`)
  - [X] `listUserFiles(userId)` - List blobs in user container
  - [X] `sumBytes(userId)` - Calculate total storage used by user
  - [X] `sasForUpload(userId, blobName, contentType, minutes)` - Generate write SAS
  - [X] `sasForRead(userId, blobName, minutes)` - Generate read SAS  
  - [X] `deleteBlob(userId, blobName)` - Delete specific blob
- [X] Implement user delegation SAS (not account key based)
- [X] Add proper error handling and logging
- [X] Add JSDoc documentation

**Deliverables**: Complete storage abstraction layer

### Task 2.3: Create File Management Routes
**Priority**: High | **Estimated Time**: 1.5 hours

- [X] Create `backend/routes/files.js` with endpoints:
  - [X] `GET /api/files` - List user's files (replace in-memory listing)
  - [X] `POST /api/files/sas` - Request upload SAS token
  - [X] `GET /api/files/:blobName/sas` - Request download SAS token
  - [X] `DELETE /api/files/:blobName` - Delete file
- [X] Implement 200MB quota check before issuing upload SAS
- [X] Maintain 5-file analysis limit in UI (separate from storage)
- [X] Add request validation and error handling
- [X] Integrate with existing `requireAuth` middleware

**Deliverables**: RESTful file management API

### Task 2.4: Update Main Application
**Priority**: High | **Estimated Time**: 45 minutes

- [X] Add storage account name to environment variables
- [X] Register new routes in `backend/index.js`
- [X] Update CORS configuration if needed
- [X] Remove or deprecate old multer-based upload endpoint
- [X] Update health check to verify storage connectivity
- [X] Add storage service initialization

**Deliverables**: Backend integrated with new storage system

### Task 2.5: Migrate File Processing
**Priority**: High | **Estimated Time**: 1 hour

- [X] Update chat endpoint to work with blob storage:
  - [X] Fetch CSV content from blob instead of memory
  - [ ] Cache parsed CSV data temporarily (optional optimization - skipped for MVP)
  - [X] Maintain existing security checks (user can only access own files)
- [X] Update `processCsv.js` to handle blob streams if needed
- [X] Test CSV parsing with blob-stored files
- [X] Ensure no regression in chat functionality

**Deliverables**: Chat feature works with blob-stored files

### Task 2.6: Hard Transition to Pure Blob Storage
**Priority**: High | **Estimated Time**: 45 minutes

Since there are no active users, perform a clean hard transition to eliminate all legacy in-memory storage:

- [X] Remove in-memory file storage system:
  - [X] Delete `backend/fileStore.js` (no longer needed)
  - [X] Remove `fileStore` import and usage from `backend/index.js`
  - [X] Remove all in-memory file handling code
- [X] Clean up legacy upload endpoint:
  - [X] Remove `POST /api/upload` endpoint entirely
  - [X] Remove multer configuration and imports
  - [X] Remove associated OPTIONS handler for upload
  - [X] Clean up multer error handling middleware
- [X] Simplify chat endpoint:
  - [X] Remove dual storage support (fileId vs fileName)
  - [X] Use only `fileName` parameter for blob storage
  - [X] Remove legacy file ID logic and memory fallback
  - [X] Simplify response format (remove `source` field)
- [X] Update API documentation:
  - [X] Document that chat endpoint now requires `fileName` instead of `fileId`
  - [X] Update any API examples or documentation
- [X] Clean up imports and dependencies:
  - [X] Remove unused multer dependency from package.json
  - [X] Clean up any other unused legacy imports
- [X] Update error messages:
  - [X] Remove references to "upload CSV file first" (legacy workflow)
  - [X] Update to reference blob storage workflow

**Benefits of Hard Transition**:
- Simpler, cleaner codebase
- No dual-path complexity
- Easier to maintain and debug
- Clear migration to persistent storage
- Removes volatile in-memory storage completely

**Deliverables**: Clean blob-storage-only backend with no legacy code

---

## Phase 3: Frontend Implementation

### Task 3.1: Update File Upload Component
**Priority**: High | **Estimated Time**: 2 hours

- [x] Modify `FileUpload.jsx` to use SAS-based uploads:
  - [x] Replace direct multer upload with two-step process:
    1. Request SAS token from backend
    2. PUT file directly to blob storage
  - [x] Update progress indication for two-step process
  - [x] Handle SAS token expiration gracefully
  - [x] Add proper error handling for blob upload failures
- [x] Update file validation (maintain CSV-only restriction)
- [x] Preserve existing drag-and-drop functionality
- [x] Update UI to show storage vs. analysis limits separately

**Deliverables**: Frontend uploads directly to blob storage

### Task 3.2: Update File Listing & Management
**Priority**: High | **Estimated Time**: 1.5 hours

- [x] Update file listing to call new `/api/files` endpoint
- [x] Implement download via SAS tokens:
  - [x] Request download SAS from backend
  - [x] Open SAS URL for download
  - [x] Handle SAS token expiration
- [x] Update delete functionality to call new delete endpoint
- [x] Add file size and last modified display
- [x] Show storage quota usage (current/200MB)

**Deliverables**: Complete file management UI

### Task 3.3: Update Data Table Component
**Priority**: Medium | **Estimated Time**: 1 hour

- [x] Modify `DataTable.jsx` if needed for blob-based files
- [x] Ensure file preview still works with new backend
- [x] Update any file-related state management
- [x] Test data display with blob-stored files

**Deliverables**: Data preview works with blob storage

### Task 3.4: Enable Multi-File Type Support (SKIPPED FOR NOW)
**Priority**: High | **Estimated Time**: 1 hour

Enable support for four specific file types while maintaining CSV-only parsing for now:

**Backend Updates**:
- [ ] Update `ALLOWED_CONTENT_TYPES` in `backend/routes/files.js` to include:
  - [ ] `text/csv` (existing)
  - [ ] `application/csv` (existing)
  - [ ] `text/plain` (existing - for .txt files)
  - [ ] `application/pdf` (PDF files)
  - [ ] `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (DOCX files)
  - [ ] `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (XLSX files)
  - [ ] `application/msword` (legacy DOC files - optional)
  - [ ] `application/vnd.ms-excel` (legacy XLS files - optional)
- [ ] Update error messages to reflect "Supported file types: CSV, DOCX, XLSX, PDF"
- [ ] Update validation logic to handle multiple file extensions
- [ ] Add file extension validation as secondary check (.csv, .docx, .xlsx, .pdf)

**Frontend Updates**:
- [ ] Remove CSV-only restriction in `FileUpload.jsx`
- [ ] Update file type validation to accept: `.csv`, `.docx`, `.xlsx`, `.pdf`
- [ ] Update UI text from "CSV files" to "document files" or "supported files"
- [ ] Update drag-and-drop messages to mention multiple file types
- [ ] Update file type badges/indicators to show actual file type
- [ ] Update upload button text to be file-type agnostic

**DataTable Component Updates**:
- [ ] Add file type detection in `DataTable.jsx`
- [ ] Only attempt CSV parsing for `.csv` files
- [ ] Show appropriate message for non-CSV files: "Preview available for CSV files only"
- [ ] Add file type icons/indicators for different file types
- [ ] Maintain existing CSV parsing and display logic

**Chat Integration Preparation**:
- [ ] Update chat endpoint to accept different file types
- [ ] For now, only process CSV files in chat (others show "CSV files only" message)
- [ ] Add file type detection before attempting CSV parsing
- [ ] Preserve existing CSV processing workflow

**UI/UX Updates**:
- [ ] Update application title/description to be less CSV-specific
- [ ] Update help text and instructions to mention supported file types
- [ ] Add file type icons in file listings (PDF icon, Excel icon, Word icon, CSV icon)
- [ ] Update file upload area to show supported formats
- [ ] Update any remaining "CSV Chat" references to "Document Chat" or similar

**Validation & Security**:
- [ ] Ensure file size limits apply to all file types (10MB per file, 200MB total)
- [ ] Validate both MIME type and file extension for security
- [ ] Add file signature validation for enhanced security (optional)
- [ ] Test upload/download/delete for all supported file types
- [ ] Ensure blob storage handles all file types correctly

**Testing Requirements**:
- [ ] Test file upload for each supported file type
- [ ] Verify file type detection and validation
- [ ] Test file download for each file type
- [ ] Ensure CSV files still work with data preview and chat
- [ ] Verify non-CSV files show appropriate messages
- [ ] Test file deletion for all file types
- [ ] Verify quota enforcement works across file types

**Future Preparation**:
- [ ] Document where to add parsing logic for DOCX/XLSX/PDF when ready
- [ ] Add TODO comments for future file type processing
- [ ] Ensure architecture supports adding new parsers later
- [ ] Document content type mappings for future reference

**Deliverables**: 
- Support for CSV, DOCX, XLSX, and PDF file uploads/storage
- CSV files continue to work with preview and chat
- Other file types stored securely but show "parsing coming soon" messages
- Foundation ready for future multi-file-type processing

---

## Phase 4: Security & Compliance

### Task 4.1: Implement Security Best Practices
**Priority**: High | **Estimated Time**: 1 hour

- [x] Validate container naming (ensure compliance with Azure rules)
- [x] Implement SAS token scoping (blob-level, not container-level)
- [x] Set appropriate SAS token TTL (5-10 minutes)
- [x] Add request rate limiting for SAS token generation
- [x] Validate file names to prevent path traversal
- [x] Add CORS headers for blob storage domain

**Deliverables**: Security hardened implementation

### Task 4.2: Add Monitoring & Logging (SKIPPED FOR NOW)
**Priority**: Medium | **Estimated Time**: 45 minutes

- [ ] Add structured logging for storage operations
- [ ] Log SAS token generation events
- [ ] Add metrics for storage usage by user
- [ ] Monitor failed upload/download attempts
- [ ] Add alerts for quota violations
- [ ] Document monitoring setup

**Deliverables**: Comprehensive monitoring in place

### Task 4.3: Data Privacy & Compliance
**Priority**: Medium | **Estimated Time**: 30 minutes

- [x] Add user consent messaging for file storage
- [x] Implement user data deletion capability
- [x] Document data processing locations
- [x] Add privacy policy updates if needed

**Deliverables**: Privacy-compliant implementation

---

## Phase 5: Testing & Migration

### Task 5.1: Unit & Integration Testing
**Priority**: High | **Estimated Time**: 2 hours

- [ ] Test storage service functions:
  - [ ] Container creation and naming
  - [ ] SAS token generation and validation
  - [ ] File upload/download/delete operations
  - [ ] Quota enforcement
- [ ] Test API endpoints:
  - [ ] Authentication integration
  - [ ] Error handling
  - [ ] Cross-user access prevention
- [ ] Test frontend integration:
  - [ ] Upload flow
  - [ ] Download flow
  - [ ] File management operations

**Deliverables**: Comprehensive test coverage

### Task 5.3: Performance Testing
**Priority**: Medium | **Estimated Time**: 1 hour

- [ ] Test upload performance with various file sizes
- [ ] Test concurrent user scenarios
- [ ] Verify SAS token performance under load
- [ ] Test storage quota enforcement accuracy
- [ ] Benchmark against current in-memory performance

**Deliverables**: Performance validated

---

## Phase 6: Deployment & Monitoring

### Task 6.1: Environment Configuration
**Priority**: High | **Estimated Time**: 30 minutes

- [ ] Add environment variables to Azure Web App:
  - [ ] `STORAGE_ACCOUNT_NAME`
  - [ ] Any additional configuration needed
- [ ] Update deployment scripts if needed
- [ ] Configure staging environment for testing
- [ ] Document environment setup

**Deliverables**: Production environment ready

### Task 6.2: Production Deployment
**Priority**: High | **Estimated Time**: 1 hour

- [ ] Deploy backend changes
- [ ] Deploy frontend changes
- [ ] Verify all endpoints working
- [ ] Test end-to-end user flow
- [ ] Monitor for errors
- [ ] Rollback plan ready

**Deliverables**: Production deployment successful

### Task 6.3: Post-Deployment Monitoring
**Priority**: High | **Estimated Time**: 30 minutes

- [ ] Monitor storage account metrics
- [ ] Check application logs for errors
- [ ] Verify user uploads/downloads working
- [ ] Monitor quota enforcement
- [ ] Check lifecycle policy activation
- [ ] User acceptance testing

**Deliverables**: System stable and monitored

---

## Implementation Notes

### Container Naming Strategy
- Use `u-${userId.toLowerCase()}` format
- Ensures compliance with Azure container naming rules
- Provides clear user isolation
- Easy to identify and manage

### Quota Management
- **Storage Quota**: 200MB per user (enforced before SAS generation)
- **Analysis Quota**: 5 files max (UI-level restriction, separate from storage)
- Users can store more than 5 files but analyze only 5 at a time

### SAS Token Configuration
- **Upload SAS**: `cw` permissions (create + write), 10-minute TTL
- **Download SAS**: `r` permission (read), 10-minute TTL
- **Scope**: Individual blob level (not container level)
- **Type**: User delegation SAS (Azure AD based, not account key)

### Error Handling
- Graceful degradation for SAS token expiration
- Clear error messages for quota violations
- Retry logic for transient failures
- Proper HTTP status codes

### Security Considerations
- No storage account keys in application code
- Managed identity for backend authentication
- Short-lived SAS tokens with minimal permissions
- User isolation via container separation
- CORS properly configured for blob storage domain

---

## Risk Assessment

### High Risk
- **Data Migration**: Moving from in-memory to persistent storage
- **Authentication Changes**: New SAS-based flow
- **User Experience**: Two-step upload process

### Medium Risk
- **Performance Impact**: Network latency for blob operations
- **Quota Enforcement**: Ensuring accurate size calculations
- **Browser Compatibility**: Direct blob upload support

### Low Risk
- **Cost Impact**: Blob storage costs are minimal for expected usage
- **Scalability**: Azure Blob Storage handles scale automatically

---

## Success Criteria

- [ ] Users can upload CSV files directly to blob storage
- [ ] Files persist across sessions and server restarts
- [ ] 200MB per-user quota enforced accurately
- [ ] Files automatically deleted after 90 days of inactivity
- [ ] Chat functionality works with blob-stored files
- [ ] No degradation in upload/download performance
- [ ] All security requirements met
- [ ] Zero data loss during migration

---

## Estimated Total Timeline
- **Phase 1**: 1.5 hours (Infrastructure)
- **Phase 2**: 6.25 hours (Backend - includes hard transition cleanup)
- **Phase 3**: 4.5 hours (Frontend)
- **Phase 4**: 2.25 hours (Security)
- **Phase 5**: 4 hours (Testing)
- **Phase 6**: 2 hours (Deployment)

**Total**: ~20.5 hours of development time

---

## Dependencies

### External Dependencies
- Azure Storage Account provisioned
- Managed Identity configured
- Required npm packages installed

### Internal Dependencies
- Current authentication system (ready)
- Existing file upload UI (needs modification)
- CSV processing logic (minor updates needed)

---

## Next Steps

1. **Start with Phase 1**: Set up Azure infrastructure first
2. **Parallel Development**: Backend and frontend can be developed in parallel after infrastructure is ready
3. **Incremental Testing**: Test each component as it's developed
4. **Staged Rollout**: Consider deploying to staging environment first

This implementation will provide TaktMate with persistent, scalable, and secure file storage while maintaining the existing user experience and adding automatic cleanup capabilities.
