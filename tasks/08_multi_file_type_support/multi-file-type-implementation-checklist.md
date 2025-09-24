# Multi-File Type Support Implementation Checklist

## Overview
Extend TaktMate's current CSV-only upload system to support PDF, Word (DOCX), and Excel (XLSX) documents. This MVP implementation focuses on core functionality to get multi-file type support working without advanced features like OCR, chunking, or async processing.

## Current State Analysis
- **Frontend**: CSV-only file validation in `SourcesPanel.jsx` (line 100: `!file.name.toLowerCase().endsWith('.csv')`)
- **Backend**: CSV-specific content type validation in `routes/files.js` (lines 78-82: `ALLOWED_CONTENT_TYPES`)
- **Processing**: CSV parsing only in `processCsv.js` using `csv-parser` library
- **Storage**: Raw files stored in Azure Blob Storage, parsed content handled in-memory
- **Chat Integration**: CSV data formatted as text and sent to GPT-4.1 via `/api/chat` endpoint

## Implementation Plan

### Phase 1: Backend File Processing

#### 1.1 Add Document Parsing Dependencies
**Files**: `backend/package.json`
**Description**: Install libraries for parsing PDF, DOCX, and XLSX files
**Requirements**:
- [x] Add `pdf-parse` dependency for PDF text extraction
- [x] Add `mammoth` dependency for DOCX to HTML/text conversion
- [x] Add `xlsx` (SheetJS) dependency for Excel file parsing
- [x] Update package-lock.json with `npm install`
**Estimated Effort**: 15 minutes

#### 1.2 Create Document Processing Utilities
**Files**: Create new files in `backend/` directory
**Description**: Build parsing utilities for each file type
**Requirements**:

**Create `backend/processPdf.js`**:
- [ ] Export `parsePdf(buffer)` function using `pdf-parse`
- [ ] Return plain text string from PDF content
- [ ] Handle parsing errors gracefully with try/catch
- [ ] Add basic validation for PDF buffer format

**Create `backend/processDocx.js`**:
- [ ] Export `parseDocx(buffer)` function using `mammoth`
- [ ] Convert DOCX to HTML then strip to plain text
- [ ] Handle parsing errors gracefully with try/catch
- [ ] Preserve basic formatting (paragraphs, line breaks)

**Create `backend/processXlsx.js`**:
- [ ] Export `parseXlsx(buffer)` function using `xlsx`
- [ ] Convert each worksheet to CSV format
- [ ] Concatenate multiple sheets with sheet name headers
- [ ] Return combined text representation of all sheets
- [ ] Handle parsing errors gracefully with try/catch

**Estimated Effort**: 2-3 hours

#### 1.3 Update Content Type Validation
**Files**: `backend/routes/files.js`
**Description**: Extend allowed content types for new file formats
**Requirements**:
- [ ] Update `ALLOWED_CONTENT_TYPES` array (lines 78-82) to include:
  - `'application/pdf'` for PDF files
  - `'application/vnd.openxmlformats-officedocument.wordprocessingml.document'` for DOCX
  - `'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'` for XLSX
  - Keep existing CSV types: `'text/csv'`, `'application/csv'`, `'text/plain'`
- [ ] Update validation error message to reflect supported file types
**Estimated Effort**: 15 minutes

#### 1.4 Update File Extension Validation
**Files**: `backend/routes/files.js`
**Description**: Enhance file name validation to accept new extensions
**Requirements**:
- [ ] Update `validateFileName()` function to accept `.pdf`, `.docx`, `.xlsx` extensions
- [ ] Ensure case-insensitive extension checking
- [ ] Update error messages to reflect supported file types
**Estimated Effort**: 30 minutes

#### 1.5 Integrate Document Parsing in Chat Endpoint
**Files**: `backend/index.js`
**Description**: Update chat endpoint to handle multiple file types
**Requirements**:
- [ ] Import new parsing utilities (`processPdf.js`, `processDocx.js`, `processXlsx.js`)
- [ ] Update `/api/chat` endpoint (around line 155) to:
  - Detect file type by extension or MIME type
  - Call appropriate parser based on file type
  - Fall back to CSV parsing for `.csv` files
  - Handle parsing errors with user-friendly messages
- [ ] Update `formatCsvForPrompt()` or create `formatDocumentForPrompt()` function
- [ ] Ensure parsed content is properly formatted for GPT-4.1 context
**Estimated Effort**: 1-2 hours

### Phase 2: Frontend File Upload Support

#### 2.1 Update File Upload Component
**Files**: `frontend/src/components/SourcesPanel.jsx`
**Description**: Extend file upload to accept multiple file types
**Requirements**:
- [ ] Update file input `accept` attribute (around line 100) to:
  ```html
  accept=".csv,.pdf,.docx,.xlsx"
  ```
- [ ] Update file validation logic in `handleFiles()` function:
  - Remove CSV-only check (`!file.name.toLowerCase().endsWith('.csv')`)
  - Add multi-extension validation for `.csv`, `.pdf`, `.docx`, `.xlsx`
  - Update error messages to reflect supported file types
- [ ] Keep existing file size limit (5MB) and file count limit (5 files)
**Estimated Effort**: 30 minutes

#### 2.2 Add File Type Icons and Labels
**Files**: `frontend/src/components/SourcesPanel.jsx`
**Description**: Improve UX with visual file type indicators
**Requirements**:
- [ ] Add file type detection function based on extension
- [ ] Display file type badges/labels next to file names
- [ ] Use different colors or icons for each file type:
  - CSV: Blue/data icon
  - PDF: Red/document icon  
  - DOCX: Blue/word icon
  - XLSX: Green/spreadsheet icon
- [ ] Update file list display to show file type information
**Estimated Effort**: 1 hour

#### 2.3 Update Upload Instructions and Help Text
**Files**: `frontend/src/components/SourcesPanel.jsx`
**Description**: Update user-facing text to reflect new capabilities
**Requirements**:
- [ ] Update drag & drop area text to mention supported file types
- [ ] Update help text and tooltips to include PDF, DOCX, XLSX
- [ ] Update error messages for unsupported file types
- [ ] Add brief explanation of what data can be extracted from each file type
**Estimated Effort**: 30 minutes

### Phase 3: System Integration and Testing

#### 3.1 Update API Documentation
**Files**: `README.md`
**Description**: Update documentation to reflect new file type support
**Requirements**:
- [ ] Update "Features" section to mention multi-file type support
- [ ] Update "Usage" section with examples for different file types
- [ ] Update API endpoint documentation for `/upload` and `/chat`
- [ ] Add example questions for different document types
- [ ] Update limitations section with any new constraints
**Estimated Effort**: 30 minutes

#### 3.2 Basic Manual Testing
**Description**: Verify core functionality works with sample files
**Requirements**:
- [ ] Test PDF upload and chat functionality with sample PDF
- [ ] Test DOCX upload and chat functionality with sample Word document  
- [ ] Test XLSX upload and chat functionality with sample Excel file
- [ ] Test CSV upload still works (regression testing)
- [ ] Verify file type validation works correctly
- [ ] Test error handling for corrupted/invalid files
- [ ] Verify file size limits still enforced
- [ ] Test multi-file upload with mixed file types
**Estimated Effort**: 1-2 hours

#### 3.3 Update Environment Configuration
**Files**: `backend/package.json`, deployment configs
**Description**: Ensure new dependencies are included in production
**Requirements**:
- [ ] Verify `pdf-parse`, `mammoth`, and `xlsx` are in production dependencies
- [ ] Test that Azure App Service can install and run new dependencies
- [ ] Update any deployment scripts if needed
- [ ] Verify memory usage is acceptable with new parsing libraries
**Estimated Effort**: 30 minutes

### Phase 4: Error Handling and Edge Cases

#### 4.1 Robust Error Handling
**Files**: All parsing utilities and chat endpoint
**Description**: Handle edge cases and parsing failures gracefully
**Requirements**:
- [ ] Add timeout handling for large file parsing
- [ ] Handle password-protected or encrypted files
- [ ] Provide meaningful error messages for parsing failures
- [ ] Handle empty or corrupted files gracefully
- [ ] Add logging for parsing errors and file type detection
- [ ] Ensure system remains stable if parsing library throws exceptions
**Estimated Effort**: 1 hour

#### 4.2 Content Size Validation
**Files**: `backend/index.js`, parsing utilities
**Description**: Ensure parsed content fits within GPT-4.1 context limits
**Requirements**:
- [ ] Add content length checking after parsing
- [ ] Truncate or summarize very large documents if needed
- [ ] Warn users when documents are too large for full analysis
- [ ] Consider basic content chunking for oversized documents
- [ ] Update error messages to guide users on document size limits
**Estimated Effort**: 1 hour

## File Structure Changes

### New Files to Create
```
backend/
├── processPdf.js          # PDF parsing utility
├── processDocx.js         # DOCX parsing utility  
├── processXlsx.js         # XLSX parsing utility
└── package.json           # Updated with new dependencies
```

### Files to Modify
```
backend/
├── index.js               # Update chat endpoint for multi-file types
├── routes/files.js        # Update content type validation
└── package.json           # Add parsing dependencies

frontend/src/components/
└── SourcesPanel.jsx       # Update file upload validation and UI

README.md                  # Update documentation
```

## Success Criteria

### MVP Completion Checklist
- [ ] Users can upload PDF, DOCX, and XLSX files through the existing interface
- [ ] Uploaded documents are parsed and their content extracted as plain text
- [ ] Users can chat with document content using natural language
- [ ] GPT-4.1 receives document content and responds appropriately
- [ ] File type validation works correctly for all supported formats
- [ ] Existing CSV functionality remains unaffected (no regressions)
- [ ] Error handling provides clear feedback for unsupported or corrupted files
- [ ] System performance remains acceptable with new parsing libraries

### Technical Validation
- [ ] All new parsing utilities handle errors gracefully
- [ ] File uploads respect existing size and count limits
- [ ] Parsed content is properly formatted for LLM consumption
- [ ] Memory usage remains within acceptable bounds
- [ ] Azure deployment includes all new dependencies

### User Experience Validation
- [ ] File type indicators help users understand what was uploaded
- [ ] Error messages are clear and actionable
- [ ] Upload process feels consistent across all file types
- [ ] Chat responses demonstrate understanding of document content
- [ ] Users can successfully analyze data from Excel files
- [ ] Users can successfully ask questions about PDF content
- [ ] Users can successfully query Word document information

## Implementation Notes

### Dependencies Overview
- **pdf-parse**: Lightweight PDF text extraction, works with most PDF formats
- **mammoth**: Converts DOCX to HTML/text, preserves basic formatting
- **xlsx**: Industry standard for Excel file processing, handles multiple sheets

### Azure Considerations
- All parsing happens in-memory on Azure App Service
- No additional Azure services required for MVP
- Existing Blob Storage continues to store raw files
- Parsed content sent directly to Azure OpenAI (no intermediate storage)

### Performance Expectations
- PDF parsing: ~100-500ms for typical documents
- DOCX parsing: ~50-200ms for typical documents  
- XLSX parsing: ~100-300ms for typical spreadsheets
- Memory usage: +20-50MB per concurrent parsing operation

### Future Enhancement Opportunities (Not in MVP)
- OCR support for scanned PDFs using Azure Document Intelligence
- Advanced Excel chart and formula extraction
- Document chunking for very large files
- Asynchronous processing pipeline with job queues
- Document preview generation
- Advanced formatting preservation
- Multi-language document support
