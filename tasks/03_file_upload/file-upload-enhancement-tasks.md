# File Upload Enhancement Tasks

## Overview
Enhance the current single CSV file upload system to support multiple files with improved UX including drag & drop, file management, and switching between files for viewing.

## Current State Analysis
- **Frontend**: Single file upload with browse-only functionality in `FileUpload.jsx`
- **Backend**: Single file processing with user-scoped file storage in `fileStore.js`
- **State Management**: Simple `fileData` state in `App.jsx` for one active file
- **File Limit**: Currently 1 file, need to expand to 5 CSV files

## Task Breakdown

### 1. Add Drag and Drop Functionality
**File**: `frontend/src/components/FileUpload.jsx`
**Description**: Implement drag & drop zone while maintaining browse capability
**Requirements**:
- Add drag events (dragover, dragenter, dragleave, drop)
- Visual feedback for drag states (hover effects, border changes)
- Maintain existing file input browse functionality
- Keep CSV file type validation
**Estimated Effort**: 2-3 hours

### 2. Support Multiple Files (5 File Limit)
**File**: `frontend/src/components/FileUpload.jsx`
**Description**: Update component to handle multiple file selection and management
**Requirements**:
- Change from single file state to files array
- Implement 5 file maximum limit with user feedback
- Prevent duplicate file uploads (same filename)
- Update file validation to work with multiple files
- Maintain CSV-only restriction
**Estimated Effort**: 2-3 hours

### 3. File List Display UI
**File**: `frontend/src/components/FileUpload.jsx` (or new component)
**Description**: Create clean UI to display all uploaded files
**Requirements**:
- List format showing file names, sizes, upload status
- Visual indicators for file states (uploaded, processing, error)
- Responsive design that works on mobile
- Clean typography and spacing using Tailwind classes
**Estimated Effort**: 2 hours

### 4. File Deletion Functionality
**File**: `frontend/src/components/FileUpload.jsx`
**Description**: Add ability to remove individual files
**Requirements**:
- Trash/X icon buttons for each file
- Confirmation dialog or immediate deletion
- Update file count and re-enable uploads if under limit
- Handle deletion of currently active file gracefully
**Estimated Effort**: 1-2 hours

### 5. Downloadable File Links
**File**: `frontend/src/components/FileUpload.jsx`
**Description**: Make file names clickable to download original files
**Requirements**:
- Clickable file names that trigger download
- Store original file data for download capability
- Proper file download handling (blob URLs or direct download)
- Download filename preservation
**Estimated Effort**: 2 hours

### 6. File View Switching
**File**: `frontend/src/components/FileUpload.jsx` + `App.jsx`
**Description**: Allow switching between files for table/chat view
**Requirements**:
- View/eye icon for each file to set as active
- Visual indication of currently active file
- Update DataTable and ChatBox to use selected file
- Only one file can be active for viewing at a time
**Estimated Effort**: 2-3 hours

### 7. Backend Multiple File Support
**File**: `backend/fileStore.js` + `backend/index.js`
**Description**: Update backend to handle multiple files per user
**Requirements**:
- Modify fileStore to support multiple files per user ID
- Update upload endpoint to handle file collections
- Add endpoints for file listing, deletion, and retrieval
- Maintain existing security (user can only access own files)
**Estimated Effort**: 3-4 hours

### 8. Update App State Management
**File**: `frontend/src/App.jsx`
**Description**: Update main app to handle multiple files and active file selection
**Requirements**:
- Change from single `fileData` to `uploadedFiles` array + `activeFile`
- Update `handleFileUploaded` to manage multiple files
- Pass active file selection handlers to components
- Ensure DataTable and ChatBox use active file data
**Estimated Effort**: 1-2 hours

## Technical Considerations

### File Storage Strategy
- **Frontend**: Keep uploaded files in component state for immediate management
- **Backend**: Extend current in-memory storage to handle multiple files per user
- **File IDs**: Maintain current user-scoped ID generation pattern

### State Management
```javascript
// Current: fileData (single file)
// New: { uploadedFiles: [], activeFileId: null }
```

### API Changes Needed
- `POST /api/upload` - already supports single file, no changes needed
- `GET /api/files` - new endpoint to list user's files
- `DELETE /api/files/:fileId` - new endpoint to delete specific file
- `GET /api/files/:fileId/download` - new endpoint for file download

### UI/UX Considerations
- **File Limit Feedback**: Clear messaging when approaching/reaching 5 file limit
- **Visual States**: Different states for files (uploading, uploaded, active, error)
- **Mobile Responsive**: Ensure file list and controls work well on mobile
- **Accessibility**: Proper ARIA labels and keyboard navigation support

## Success Criteria
- [ ] Users can drag & drop CSV files onto upload area
- [ ] Users can browse and select multiple CSV files (up to 5)
- [ ] All uploaded files are displayed in a clean list format
- [ ] Users can delete individual files using trash/X icons
- [ ] File names are clickable and download the original files
- [ ] Users can click view icons to switch between files for table display
- [ ] Only one file is active for viewing at a time
- [ ] All existing functionality (chat, data table) works with file switching
- [ ] File upload limits and validation work correctly
- [ ] Mobile responsive and accessible

## Implementation Order
1. **Drag & Drop** - Foundation UX improvement
2. **Multiple Files** - Core functionality expansion  
3. **File List Display** - Visual management interface
4. **File Deletion** - File management capability
5. **Downloadable Links** - File access feature
6. **View Switching** - Active file selection
7. **Backend Updates** - Server-side multiple file support
8. **App State Updates** - Integration and state management

## Estimated Total Effort
**16-22 hours** across frontend and backend development

This implementation will significantly improve the user experience while maintaining the current CSV-focused functionality and security model.
