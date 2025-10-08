import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Card, { CardContent } from './Card';
import { getAuthHeaders } from '../utils/auth';

const SourcesPanel = ({ 
  onFileUploaded, 
  uploadedFiles, 
  selectedFileIds = [], // Changed from activeFileId to selectedFileIds array
  onFileSelected, 
  onFileDownload, 
  onFileDeleted,
  isCollapsed,
  onToggleCollapse,
  filesLoading,
  isFilesLocked = false,
  activeConversation = null,
  isInNewConversationMode = false
}) => {
  const [error, setError] = useState(null);
  const [showPrivacyInfo] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [showUploadFilesPopup, setShowUploadFilesPopup] = useState(false);
  const [filesBeingDeleted, setFilesBeingDeleted] = useState([]);
  const [filesBeingUploaded, setFilesBeingUploaded] = useState([]); // Array of {name, size} for files currently uploading
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const uploadTimeoutRef = useRef(null);


  // Get file type from filename
  const getFileType = (fileName) => {
    const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
    switch (extension) {
      case '.csv': return 'csv';
      case '.pdf': return 'pdf';
      case '.docx': return 'docx';
      case '.xlsx': return 'xlsx';
      case '.txt': return 'txt';
      default: return 'unknown';
    }
  };

  // Get file type icon
  const getFileTypeIcon = (fileType) => {
    switch (fileType) {
      case 'uploading':
        return (
          <div className="w-6 h-6 flex items-center justify-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600"></div>
          </div>
        );
      case 'csv':
        return (
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="18" height="18" rx="2" fill="#FFA51F"/>
            {/* 2x2 white cells */}
            <rect x="5" y="5" width="6" height="2.5" rx="0.5" className="fill-white"/>
            <rect x="13" y="5" width="6" height="2.5" rx="0.5" className="fill-white"/>
            <rect x="5" y="9" width="6" height="2.5" rx="0.5" className="fill-white"/>
            <rect x="13" y="9" width="6" height="2.5" rx="0.5" className="fill-white"/>
            <text x="12" y="18.5" fontSize="7" fontWeight="bold" textAnchor="middle" className="fill-white">CSV</text>
          </svg>
        );
      case 'pdf':
        return (
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" className="fill-red-100 stroke-red-600" strokeWidth="1.5"/>
            <path d="M14 2v6h6" className="stroke-red-600" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <text x="12" y="16" fontSize="7" fontWeight="bold" textAnchor="middle" className="fill-red-600">PDF</text>
          </svg>
        );
      case 'docx':
        return (
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" className="fill-indigo-100 stroke-indigo-600" strokeWidth="1.5"/>
            <path d="M14 2v6h6" className="stroke-indigo-600" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <text x="12" y="17" fontSize="9" fontWeight="bold" textAnchor="middle" className="fill-indigo-600">W</text>
          </svg>
        );
      case 'xlsx':
        return (
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="18" height="18" rx="2" className="fill-green-600"/>
            {/* 2x2 white cells */}
            <rect x="5" y="5" width="6" height="2.5" rx="0.5" className="fill-white"/>
            <rect x="13" y="5" width="6" height="2.5" rx="0.5" className="fill-white"/>
            <rect x="5" y="9" width="6" height="2.5" rx="0.5" className="fill-white"/>
            <rect x="13" y="9" width="6" height="2.5" rx="0.5" className="fill-white"/>
            <text x="12" y="18.5" fontSize="7" fontWeight="bold" textAnchor="middle" className="fill-white">XLS</text>
          </svg>
        );
      case 'txt':
        return (
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" className="fill-gray-100 stroke-gray-600" strokeWidth="1.5"/>
            <path d="M14 2v6h6" className="stroke-gray-600" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <text x="12" y="16" fontSize="8" fontWeight="bold" textAnchor="middle" className="fill-gray-600">txt</text>
          </svg>
        );
      default:
        return (
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" className="fill-gray-100 stroke-gray-600" strokeWidth="1.5"/>
            <path d="M14 2v6h6" className="stroke-gray-600" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      // Reset the input value to allow selecting the same files again
      e.target.value = '';
    }
  };

  const handleFiles = async (fileList) => {
    // Close the popup immediately when files are selected
    setShowUploadFilesPopup(false);
    
    // Clear any pending upload timeout and reset uploading/deletion state
    if (uploadTimeoutRef.current) {
      clearTimeout(uploadTimeoutRef.current);
      uploadTimeoutRef.current = null;
    }
    setFilesBeingUploaded([]);
    setFilesBeingDeleted([]); // Clear deleted files state to allow re-uploading same file names
    
    const files = Array.from(fileList);
    const maxFilesPerUpload = 50; // controls how many files can be uploaded at once
    const maxTotalFiles = 50; // max total files a user can have in storage
    
    // Validate we don't exceed per-upload file limit
    if (files.length > maxFilesPerUpload) {
      setError(`Please select no more than ${maxFilesPerUpload} files at once`);
      return;
    }
    
    // Validate we don't exceed total file storage limit
    if (uploadedFiles.length + files.length > maxTotalFiles) {
      const availableSlots = maxTotalFiles - uploadedFiles.length;
      setError(`Cannot upload ${files.length} files. You can only have ${maxTotalFiles} files total. Currently have ${uploadedFiles.length} files (${availableSlots} slots remaining).`);
      return;
    }
    
    // Validate each file
    const validFiles = [];
    const errors = [];
    
    for (const file of files) {
      // Validate file type
      const allowedExtensions = ['.csv', '.pdf', '.docx', '.xlsx', '.txt'];
      const fileName = file.name.toLowerCase();
      const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));
      
      if (!hasValidExtension) {
        errors.push(`${file.name}: Must be a CSV, PDF, DOCX, XLSX, or TXT file`);
        continue;
      }
      
      // Validate file size (100MB limit)
      if (file.size > 100 * 1024 * 1024) {
        errors.push(`${file.name}: File size must be less than 100MB`);
        continue;
      }
      
      validFiles.push(file);
    }
    
    if (errors.length > 0) {
      setError(errors.join(', '));
      return;
    }
    
    if (validFiles.length === 0) {
      setError('No valid files to upload');
      return;
    }

    setError(null);
    
    // Immediately show all files being uploaded with loading state
    const uploadingFiles = validFiles.map(file => ({
      name: file.name,
      size: file.size,
      isUploading: true
    }));
    setFilesBeingUploaded(uploadingFiles);
    
    try {
      // Get authentication headers (handles local development bypass)
      const authHeaders = await getAuthHeaders();

      // Track successfully uploaded files
      const uploadedFilesList = [];

      // Upload each file
      for (const file of validFiles) {
        // Step 1: Request SAS token from backend
        const sasResponse = await fetch('/api/files/sas', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            fileName: file.name,
            contentType: file.type || 'text/csv',
            sizeBytes: file.size
          })
        });

        const sasData = await sasResponse.json();
        
        if (!sasData.success) {
          throw new Error(`Failed to get upload URL for ${file.name}: ${sasData.message || sasData.error || 'Unknown error'}`);
        }

        // Step 2: Upload file to Azure Blob Storage
        const uploadResponse = await fetch(sasData.uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': file.type || 'text/csv',
            'x-ms-blob-type': 'BlockBlob'
          },
          body: file
        });

        if (!uploadResponse.ok) {
          throw new Error(`Upload failed for ${file.name}: ${uploadResponse.statusText}`);
        }

        // Add to successfully uploaded list
        uploadedFilesList.push({
          name: file.name,
          size: file.size,
          type: file.type || 'text/csv',
          lastModified: new Date().toISOString()
        });
      }

      // Step 3: Notify parent component of all successful uploads at once
      for (const fileData of uploadedFilesList) {
        await onFileUploaded(fileData);
      }
      
      // Clear the uploading state after parent has processed all files
      // Add a small delay to ensure parent state has updated and re-rendered
      uploadTimeoutRef.current = setTimeout(() => {
        setFilesBeingUploaded([]);
        uploadTimeoutRef.current = null;
      }, 100);
      
    } catch (error) {
      console.error('Upload error:', error);
      setError(error.message || 'Upload failed. Please try again.');
      // Clear uploading state immediately on error
      if (uploadTimeoutRef.current) {
        clearTimeout(uploadTimeoutRef.current);
        uploadTimeoutRef.current = null;
      }
      setFilesBeingUploaded([]);
    }
  };

  const openFileDialog = () => {
    // Clear error state when opening file dialog
    setError(null);
    fileInputRef.current?.click();
  };

  // Drag and drop handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set dragging to false if we're leaving the drop zone entirely
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  // Clear error state when popup opens
  useEffect(() => {
    if (showUploadFilesPopup) {
      setError(null);
      if (uploadTimeoutRef.current) {
        clearTimeout(uploadTimeoutRef.current);
        uploadTimeoutRef.current = null;
      }
    }
  }, [showUploadFilesPopup]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (uploadTimeoutRef.current) {
        clearTimeout(uploadTimeoutRef.current);
      }
    };
  }, []);

  // Filter files based on conversation state
  const getDisplayFiles = () => {
    // Always show all uploaded files, except those being deleted
    let filesToDisplay = uploadedFiles.filter(file => !filesBeingDeleted.includes(file.name));
    
    // Add files that are currently uploading
    const uploadingFilesDisplay = filesBeingUploaded.map(file => ({
      name: file.name,
      fileId: file.name + '_uploading',
      size: file.size,
      type: 'uploading',
      isUploading: true
    }));
    filesToDisplay = [...filesToDisplay, ...uploadingFilesDisplay];
    
    return filesToDisplay;
  };

  const displayFiles = getDisplayFiles();

  const handleMenuToggle = (fileId, event) => {
    if (openMenuId === fileId) {
      setOpenMenuId(null);
      return;
    }

    const buttonElement = event.currentTarget;
    const rect = buttonElement.getBoundingClientRect();
    
    // Menu dimensions
    // Check if this file would show the "Delete Selected" option
    const hasDeleteSelected = selectedFileIds.includes(fileId) && selectedFileIds.length >= 2;
    const menuHeight = hasDeleteSelected ? 120 : 80; // 3 items vs 2 items
    const menuWidth = 160;
    const spacing = 4;
    
    // Check if there's enough space below
    const spaceBelow = window.innerHeight - rect.bottom;
    const shouldOpenUpward = spaceBelow < menuHeight;
    
    setMenuPosition({
      top: shouldOpenUpward 
        ? rect.top + window.scrollY - menuHeight - spacing
        : rect.bottom + window.scrollY + spacing,
      left: rect.right + window.scrollX - menuWidth,
    });
    
    setOpenMenuId(fileId);
  };

  // Handle clicking outside to close menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openMenuId && !event.target.closest('[data-dropdown-menu]') && !event.target.closest('button[title="More options"]')) {
        setOpenMenuId(null);
      }
    };

    if (openMenuId) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openMenuId]);

  // Handle clicking outside to close upload files popup
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showUploadFilesPopup && event.target.classList.contains('fixed')) {
        setShowUploadFilesPopup(false);
      }
    };

    if (showUploadFilesPopup) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showUploadFilesPopup]);

  return (
    <Card 
      variant="elevated" 
      className="h-full flex flex-col transition-all duration-200 hover:bg-primary-25"
    >
      {/* Custom compact header with divider */}
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-200 -mx-6 px-6">
        <div className="flex-1 min-w-0">
          {!isCollapsed && (
            <h3 className="heading-4"><span className="text-secondary-600 font-semibold lowercase">sources</span></h3>
          )}
        </div>
        <div className={`flex-shrink-0 ${isCollapsed ? 'w-full flex justify-center' : 'ml-4'}`}>
          <button
            onClick={() => onToggleCollapse(!isCollapsed)}
            className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors flex items-center justify-center"
            title={isCollapsed ? "Expand sources" : "Collapse sources"}
          >
            <svg 
              className="w-4 h-4"
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              {/* Rounded square box */}
              <rect x="1" y="1" width="22" height="22" rx="2" strokeWidth="2" />
              {/* Vertical divider line at 1/3 from left */}
              <line x1="9.33" y1="1" x2="9.33" y2="23" strokeWidth="2" />
            </svg>
          </button>
        </div>
      </div>
      
      {isCollapsed ? (
        <CardContent className="flex-1 flex flex-col items-center space-y-3 overflow-y-auto mobile-scrollbar min-h-0 py-4">
          {/* Compact Upload Button - Circle */}
          <button
            type="button"
            onClick={() => setShowUploadFilesPopup(true)}
            className="w-10 h-10 bg-secondary-500 text-white rounded-full hover:bg-secondary-700 transition-colors warm-shadow flex items-center justify-center flex-shrink-0"
            style={{ borderRadius: '50%' }}
            title="Upload files"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>

          {/* File Type Icons */}
          <div className="flex flex-col items-center space-y-2 w-full px-2">
            {displayFiles.map((file) => {
              const fileType = file.isUploading ? 'uploading' : getFileType(file.name);
              const isSelected = selectedFileIds.includes(file.fileId);
              
              return (
                <div
                  key={file.fileId}
                  onClick={() => {
                    if (file.isUploading) return;
                    if (isSelected) {
                      onFileSelected(selectedFileIds.filter(id => id !== file.fileId));
                    } else if (selectedFileIds.length < 50) {
                      onFileSelected([...selectedFileIds, file.fileId]);
                    }
                  }}
                  className={`relative group p-2 rounded-lg transition-all ${
                    file.isUploading
                      ? 'cursor-default opacity-75'
                      : 'cursor-pointer hover:bg-primary-50'
                  } ${
                    isSelected ? 'bg-primary-100 ring-2 ring-primary-600' : ''
                  }`}
                  title={file.name}
                >
                  {getFileTypeIcon(fileType)}
                </div>
              );
            })}
            
            {displayFiles.length === 0 && !filesLoading && (
              <p className="body-xs text-text-muted text-center mt-4">No files</p>
            )}
          </div>
        </CardContent>
      ) : (
        <CardContent className="flex-1 flex flex-col min-h-0">
          {/* Upload Files Button - Full Width - Pinned */}
          <button
            type="button"
            onClick={() => setShowUploadFilesPopup(true)}
            className="w-full bg-secondary-500 text-white px-4 py-2.5 rounded-button body-small font-medium hover:bg-secondary-700 transition-colors warm-shadow mb-4"
          >
            upload files
          </button>

          {/* Scrollable Content Area */}
          <div className="flex-1 min-h-0">
            <div className="space-y-4 h-full overflow-y-auto mobile-scrollbar">{/* Content wrapper for scrolling */}

        {/* Privacy Info Expandable */}
        {showPrivacyInfo && (
          <div className="space-y-3">
            <div className="bg-amber-50 border border-amber-200 rounded-card p-4 space-y-2">
              <div className="flex items-start space-x-2">
                <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div>
                  <h4 className="body-small font-medium text-amber-800">Data Privacy & Security</h4>
                  <p className="body-xs text-amber-700 mt-1">
                    Files are securely stored in Azure with enterprise-grade encryption. 
                    Data is automatically deleted after 90 days and remains private to your workspace.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-card p-4 space-y-2">
              <div className="flex items-start space-x-2">
                <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div>
                  <h4 className="body-small font-medium text-blue-800">Supported File Types</h4>
                  <div className="body-xs text-blue-700 mt-2 space-y-1">
                    <p><span className="font-medium">CSV:</span> Analyze structured data, perform calculations, filter records</p>
                    <p><span className="font-medium">PDF:</span> Extract and search text content from documents</p>
                    <p><span className="font-medium">DOCX:</span> Analyze text, find information, summarize content</p>
                    <p><span className="font-medium">XLSX:</span> Process spreadsheet data from multiple sheets and tables</p>
                    <p><span className="font-medium">TXT:</span> Analyze plain text content, extract information, answer questions</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.pdf,.docx,.xlsx,.txt"
          multiple
          onChange={handleFileInput}
          className="hidden"
        />


        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-card p-3 flex items-start space-x-2">
            <svg className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="body-small text-red-700">{error}</p>
          </div>
        )}

        {/* File List */}
        <div>
          {filesLoading ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              <p className="body-small text-text-muted">Loading files...</p>
            </div>
          ) : displayFiles.length > 0 ? (
            <div className="space-y-2">
              {/* File Selection Header */}
              <div className="flex items-center justify-between py-2 border-transparent border-gray-200">
                <div 
                  className="flex items-center space-x-2 cursor-pointer"
                  onClick={() => {
                    const selectableFiles = displayFiles.filter(f => !f.isUploading);
                    if (selectedFileIds.length === selectableFiles.length && selectableFiles.length > 0) {
                      onFileSelected([]);
                    } else {
                      onFileSelected(selectableFiles.map(f => f.fileId));
                    }
                  }}
                >
                  {/* Select All Checkbox */}
                  <div className={`ml-2 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                    displayFiles.filter(f => !f.isUploading).length > 0 && selectedFileIds.length === displayFiles.filter(f => !f.isUploading).length
                      ? 'bg-primary-600 border-primary-600'
                      : 'border-gray-300 hover:border-primary-400'
                  }`}>
                    {displayFiles.filter(f => !f.isUploading).length > 0 && selectedFileIds.length === displayFiles.filter(f => !f.isUploading).length && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="body-small text-text-primary font-medium">
Select All
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                {displayFiles.map((file) => {
                  const isSelected = selectedFileIds.includes(file.fileId);
                  const canSelect = isSelected || selectedFileIds.length < 50;
                  const isUploading = file.isUploading;
                  return (
                    <div
                      key={file.fileId}
                      className={`p-2 rounded-card border border-transparent bg-transparent transition-colors ${
                        isUploading
                          ? 'cursor-default opacity-75'
                          : !canSelect
                            ? 'cursor-not-allowed opacity-50'
                            : 'hover:bg-background-warm-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div 
                          className={`flex items-center space-x-3 flex-1 min-w-0 ${!isUploading ? 'cursor-pointer' : 'cursor-default'}`}
                          onClick={() => {
                            if (isUploading) return;
                            if (isSelected) {
                              onFileSelected(selectedFileIds.filter(id => id !== file.fileId));
                            } else if (selectedFileIds.length < 50) {
                              onFileSelected([...selectedFileIds, file.fileId]);
                            }
                          }}
                        >
                          {/* Checkbox */}
                          <div className="flex-shrink-0">
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                              isUploading
                                ? 'border-gray-200 bg-gray-100'
                                : isSelected 
                                  ? 'bg-primary-600 border-primary-600'
                                  : !canSelect
                                    ? 'border-gray-200 bg-gray-100'
                                    : 'border-gray-300 hover:border-primary-400'
                            }`}>
                              {isSelected && !isUploading && (
                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                          </div>
                          
                          {/* File Type Icon */}
                          <div className="flex-shrink-0">
                            {isUploading ? getFileTypeIcon('uploading') : getFileTypeIcon(getFileType(file.name))}
                          </div>
                          
                          {/* File Name */}
                          <div className="flex-1 min-w-0">
                            <p className={`body-small font-medium truncate ${
                              isUploading ? 'text-text-muted' : 'text-text-primary'
                            }`}>
                              {file.name}
                            </p>
                          </div>
                        </div>
                        
                        {/* Actions Menu */}
                        {!isUploading && (
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMenuToggle(file.fileId, e);
                              }}
                              className="p-2 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                              title="More options"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                </svg>
              </div>
              <p className="body-small text-text-muted mb-2">No files uploaded yet</p>
              <p className="body-xs text-text-muted">Click "upload files" to upload CSV, PDF, DOCX, XLSX, or TXT files</p>
            </div>
          )}
        </div>
            </div>{/* End scrollable wrapper */}
          </div>{/* End flex-1 min-h-0 container */}
        </CardContent>
      )}
      
      {/* Portal-based dropdown menu */}
      {openMenuId && createPortal(
        <div 
          data-dropdown-menu
          className="fixed w-50 bg-white rounded-card border border-gray-200 warm-shadow z-50"
          style={{
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`,
          }}
        >
          <div className="py-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                const file = displayFiles.find(f => f.fileId === openMenuId);
                if (file) onFileDownload(file);
                setOpenMenuId(null);
              }}
              className="w-full px-3 py-2 text-left body-small text-text-primary hover:bg-gray-50 flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Download</span>
            </button>
            
            <hr className="my-1 border-gray-200" />
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                const file = displayFiles.find(f => f.fileId === openMenuId);
                if (file && window.confirm(`Are you sure you want to delete ${file.name}?`)) {
                  onFileDeleted(file.fileId);
                }
                setOpenMenuId(null);
              }}
              className="w-full px-3 py-2 text-left body-small text-red-600 hover:bg-red-50 flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Delete</span>
            </button>
            
            {/* Delete Selected - only show for selected files when at least one other file is selected */}
            {selectedFileIds.includes(openMenuId) && selectedFileIds.length >= 2 && (
              <>
                <hr className="my-1 border-gray-200" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const filesToDelete = displayFiles
                      .filter(f => selectedFileIds.includes(f.fileId) && !f.isUploading)
                      .map(f => f.name);
                    
                    if (filesToDelete.length > 0 && window.confirm(`Are you sure you want to delete ${filesToDelete.length} file${filesToDelete.length > 1 ? 's' : ''}?`)) {
                      setFilesBeingDeleted(filesToDelete);
                      Promise.all(filesToDelete.map(fileName => onFileDeleted(fileName)))
                        .finally(() => {
                          setTimeout(() => setFilesBeingDeleted([]), 100);
                        });
                    }
                    setOpenMenuId(null);
                  }}
                  className="w-full px-3 py-2 text-left body-small text-red-600 hover:bg-red-50 flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span>Delete Selected ({selectedFileIds.length})</span>
                </button>
              </>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Portal-based upload popup */}
      {showUploadFilesPopup && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowUploadFilesPopup(false)}>
          <div className="bg-white rounded-card border border-gray-200 warm-shadow w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            {/* Popup Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="heading-4 text-text-primary">upload files</h2>
              <button
                onClick={() => setShowUploadFilesPopup(false)}
                className="p-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Drag and Drop Zone */}
            <div className="p-6">
                <div
                  onDragEnter={handleDragEnter}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={openFileDialog}
                  className={`border-2 border-dashed rounded-lg p-12 min-h-[400px] w-full transition-all cursor-pointer flex items-center justify-center ${
                    isDragging 
                      ? 'border-primary-500 bg-primary-50' 
                      : 'border-gray-300 bg-gray-50 hover:border-primary-400 hover:bg-primary-25'
                  }`}
                >
                  <div className="flex flex-col items-center justify-center text-center">
                  {/* Upload Icon */}
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors ${
                    isDragging ? 'bg-primary-200' : 'bg-primary-100'
                  }`}>
                    <svg 
                      className={`w-8 h-8 transition-colors ${
                        isDragging ? 'text-primary-700' : 'text-primary-600'
                      }`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" 
                      />
                    </svg>
                  </div>
                  
                  {/* Upload Text */}
                  <h3 className="heading-small text-text-primary mb-2">
                    {isDragging ? 'drop files here' : 'upload sources'}
                  </h3>
                  
                  <p className="body-normal text-text-secondary mb-4">
                    drag & drop or <span className="text-primary-600 font-medium">choose file</span>
                  </p>
                  
                  {/* Supported File Types */}
                  <p className="body-xs text-text-muted">
                    Supported file types: CSV, PDF, DOCX, XLSX, TXT
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </Card>
  );
};

export default SourcesPanel;
