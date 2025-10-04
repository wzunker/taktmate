import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Card, { CardHeader, CardContent } from './Card';
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
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [showPrivacyInfo, setShowPrivacyInfo] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [showUploadFilesPopup, setShowUploadFilesPopup] = useState(false);
  const [selectedForDeletion, setSelectedForDeletion] = useState([]);
  const [filesBeingDeleted, setFilesBeingDeleted] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);


  // Get file type from filename
  const getFileType = (fileName, isMissing = false) => {
    if (isMissing) return 'missing';
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

  // Get file type colors and styles
  const getFileTypeStyles = (fileType) => {
    switch (fileType) {
      case 'missing':
        return {
          bgColor: 'bg-red-100',
          textColor: 'text-red-600',
          label: 'MISSING',
          labelBg: 'bg-red-100',
          labelText: 'text-red-700'
        };
      case 'csv':
        return {
          bgColor: 'bg-blue-100',
          textColor: 'text-blue-600',
          label: 'CSV',
          labelBg: 'bg-blue-100',
          labelText: 'text-blue-700'
        };
      case 'pdf':
        return {
          bgColor: 'bg-red-100',
          textColor: 'text-red-600',
          label: 'PDF',
          labelBg: 'bg-red-100',
          labelText: 'text-red-700'
        };
      case 'docx':
        return {
          bgColor: 'bg-indigo-100',
          textColor: 'text-indigo-600',
          label: 'DOCX',
          labelBg: 'bg-indigo-100',
          labelText: 'text-indigo-700'
        };
      case 'xlsx':
        return {
          bgColor: 'bg-green-100',
          textColor: 'text-green-600',
          label: 'XLSX',
          labelBg: 'bg-green-100',
          labelText: 'text-green-700'
        };
      case 'txt':
        return {
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-600',
          label: 'TXT',
          labelBg: 'bg-gray-100',
          labelText: 'text-gray-700'
        };
      default:
        return {
          bgColor: 'bg-secondary-100',
          textColor: 'text-secondary-600',
          label: 'FILE',
          labelBg: 'bg-secondary-100',
          labelText: 'text-secondary-700'
        };
    }
  };



  const handleFileInput = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  const [uploadingCount, setUploadingCount] = useState(0);

  const handleFiles = async (fileList) => {
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
    setUploading(true);
    setUploadingCount(validFiles.length);
    
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
      
    } catch (error) {
      console.error('Upload error:', error);
      setError(error.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
      setUploadingCount(0);
    }
  };

  const openFileDialog = () => {
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

  // Bulk deletion handlers
  const toggleFileForDeletion = (fileName) => {
    setSelectedForDeletion(prev => 
      prev.includes(fileName) 
        ? prev.filter(f => f !== fileName)
        : [...prev, fileName]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedForDeletion.length === 0) return;
    
    const count = selectedForDeletion.length;
    const fileList = selectedForDeletion.length <= 3 
      ? selectedForDeletion.join(', ')
      : `${selectedForDeletion.length} files`;
    
    if (window.confirm(`Are you sure you want to delete ${fileList}?`)) {
      // Store files being deleted and hide them immediately
      const filesToDelete = [...selectedForDeletion];
      setFilesBeingDeleted(filesToDelete);
      setSelectedForDeletion([]);
      
      try {
        // Delete all files in parallel
        await Promise.all(
          filesToDelete.map(fileName => onFileDeleted(fileName))
        );
      } catch (error) {
        console.error('Error during bulk delete:', error);
        setError('Some files failed to delete. Please try again.');
      } finally {
        // Clear the files being deleted state after a short delay
        // This ensures the UI update happens smoothly
        setTimeout(() => {
          setFilesBeingDeleted([]);
        }, 100);
      }
    }
  };

  // Clear selection when popup closes
  useEffect(() => {
    if (!showUploadFilesPopup) {
      setSelectedForDeletion([]);
      setFilesBeingDeleted([]);
    }
  }, [showUploadFilesPopup]);

  // Filter files based on conversation state
  const getDisplayFiles = () => {
    if (isInNewConversationMode) {
      // In new conversation mode - show all files for selection
      return uploadedFiles;
    }

    if (!activeConversation) {
      // Initial state - show no files
      return [];
    }

    // Active conversation - show associated files and missing files
    const conversationFileNames = activeConversation.fileNames || [activeConversation.fileName];
    const existingFiles = uploadedFiles.filter(file => conversationFileNames.includes(file.name));
    const existingFileNames = existingFiles.map(file => file.name);
    
    // Create entries for missing files
    const missingFiles = conversationFileNames
      .filter(fileName => !existingFileNames.includes(fileName))
      .map(fileName => ({
        name: fileName,
        fileId: fileName,
        size: 0,
        type: 'missing',
        isMissing: true
      }));

    return [...existingFiles, ...missingFiles];
  };

  const displayFiles = getDisplayFiles();
  const isViewingActiveConversation = activeConversation && !isInNewConversationMode;

  const handleMenuToggle = (fileId, event) => {
    if (openMenuId === fileId) {
      setOpenMenuId(null);
      return;
    }

    const buttonElement = event.currentTarget;
    const rect = buttonElement.getBoundingClientRect();
    
    setMenuPosition({
      top: rect.bottom + window.scrollY + 4,
      left: rect.right + window.scrollX - 160, // 160px is menu width
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
      <CardHeader
        title={!isCollapsed ? <span className="text-secondary-600 font-semibold lowercase">sources</span> : null}
        action={
          <button
            onClick={() => onToggleCollapse(!isCollapsed)}
            className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
            title={isCollapsed ? "Expand sources" : "Collapse sources"}
          >
            <svg 
              className={`w-4 h-4 transition-transform duration-200 ${isCollapsed ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        }
      />
      
      {!isCollapsed && (
        <CardContent className="flex-1 overflow-y-auto space-y-4 min-h-0">
        {/* Upload Files Button - Full Width */}
        <button
          type="button"
          onClick={() => setShowUploadFilesPopup(true)}
          className="w-full bg-primary-600 text-white px-4 py-2.5 rounded-button body-small font-medium hover:bg-primary-700 transition-colors warm-shadow"
        >
          upload files
        </button>

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
              <div className="flex items-center justify-between py-2 border-b border-gray-200">
                <div className="flex items-center space-x-2">
                  <span className="body-small text-text-muted">
                    ({selectedFileIds.length}/50)
                  </span>
                </div>
                {isFilesLocked && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 616 0z" clipRule="evenodd" />
                    </svg>
                    locked
                  </span>
                )}
              </div>
              <div className="space-y-1">
                {displayFiles.map((file) => {
                  const isSelected = selectedFileIds.includes(file.fileId);
                  const canSelect = isSelected || selectedFileIds.length < 50;
                  const isMissing = file.isMissing;
                  return (
                    <div
                      key={file.fileId}
                      className={`p-3 rounded-card border transition-all duration-200 ${
                        isMissing
                          ? 'cursor-default opacity-75'
                          : isViewingActiveConversation
                            ? 'cursor-default opacity-75'
                            : isFilesLocked
                              ? 'cursor-not-allowed opacity-75'
                              : !canSelect
                                ? 'cursor-not-allowed opacity-50'
                                : 'cursor-pointer'
                      } ${
                        isMissing
                          ? 'bg-red-50 border-red-200'
                          : isSelected
                            ? 'bg-primary-50 border-primary-200 ring-2 ring-primary-100'
                            : isViewingActiveConversation || isFilesLocked
                              ? 'bg-gray-50 border-gray-200'
                              : !canSelect
                                ? 'bg-gray-50 border-gray-200'
                                : 'bg-background-warm-white border-gray-200 hover:bg-primary-25 hover:border-primary-200'
                      }`}
                      onClick={() => {
                        if (isMissing || isViewingActiveConversation || isFilesLocked) return;
                        if (isSelected) {
                          // Remove from selection
                          onFileSelected(selectedFileIds.filter(id => id !== file.fileId));
                        } else if (selectedFileIds.length < 50) {
                          // Add to selection (max 50 files)
                          onFileSelected([...selectedFileIds, file.fileId]);
                        }
                      }}
                    >
                      <div className="flex items-start space-x-3">
                        {/* Checkbox */}
                        <div className="flex-shrink-0 pt-1">
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                            isMissing
                              ? 'border-red-300 bg-red-100'
                              : isSelected 
                                ? isFilesLocked
                                  ? 'bg-gray-400 border-gray-400'
                                  : 'bg-primary-600 border-primary-600'
                                : isFilesLocked
                                  ? 'border-gray-300'
                                  : !canSelect
                                    ? 'border-gray-200 bg-gray-100'
                                    : 'border-gray-300 hover:border-primary-400'
                          }`}>
                            {isSelected && (
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className={`body-small font-medium truncate ${
                              isMissing ? 'text-red-600' : 'text-text-primary'
                            }`}>
                              {file.name}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2 mt-1">
                            {(() => {
                              const fileType = getFileType(file.name, isMissing);
                              const styles = getFileTypeStyles(fileType);
                              return (
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${styles.labelBg} ${styles.labelText}`}>
                                  {styles.label}
                                </span>
                              );
                            })()}
                            <span className="body-xs text-text-muted">
                              {isMissing ? 'File Missing' : `${(file.size / 1024).toFixed(1)} KB`}
                            </span>
                            {isSelected && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-800">
                                Selected
                              </span>
                            )}
                          </div>
                        </div>
                        
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
              {!activeConversation && !isInNewConversationMode ? (
                <>
                  <p className="body-small text-text-muted mb-2">click "new conversation" to select files</p>
                </>
              ) : isInNewConversationMode && uploadedFiles.length === 0 ? (
                <>
                  <p className="body-small text-text-muted mb-2">No files uploaded yet</p>
                  <p className="body-xs text-text-muted">Click "upload files" to upload CSV, PDF, DOCX, XLSX, or TXT files</p>
                </>
              ) : activeConversation ? (
                <>
                  <p className="body-small text-text-muted mb-2">No files for this conversation</p>
                  <p className="body-xs text-text-muted">The files associated with this conversation are not available</p>
                </>
              ) : (
                <>
                  <p className="body-small text-text-muted mb-2">No files uploaded yet</p>
                  <p className="body-xs text-text-muted">Click "upload files" to upload CSV, PDF, DOCX, XLSX, or TXT files</p>
                </>
              )}
            </div>
          )}
        </div>


        </CardContent>
      )}
      
      {/* Portal-based dropdown menu */}
      {openMenuId && createPortal(
        <div 
          data-dropdown-menu
          className="fixed w-40 bg-white rounded-card border border-gray-200 warm-shadow z-50"
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
          </div>
        </div>,
        document.body
      )}

      {/* Upload Files Popup */}
      {showUploadFilesPopup && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-card border border-gray-200 warm-shadow w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Popup Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
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

            {/* Drag and Drop Zone - Pinned */}
            <div className="flex-shrink-0 p-6 pb-4 border-b border-gray-200">
              <div
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={openFileDialog}
                className={`border-2 border-dashed rounded-lg p-8 transition-all cursor-pointer ${
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
                    {isDragging ? 'Drop files here' : 'Upload sources'}
                  </h3>
                  
                  <p className="body-normal text-text-secondary mb-4">
                    Drag & drop or <span className="text-primary-600 font-medium">choose file</span> to upload
                  </p>
                  
                  {/* Supported File Types */}
                  <p className="body-xs text-text-muted">
                    Supported file types: CSV, PDF, DOCX, XLSX, TXT
                  </p>
                </div>
              </div>
            </div>

            {/* Files Section Header - Pinned */}
            {uploadedFiles.filter(file => !filesBeingDeleted.includes(file.name)).length > 0 && (
              <div className="flex-shrink-0 px-6 py-3 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <h4 className="body-small font-medium text-text-primary">Your Files ({uploadedFiles.filter(file => !filesBeingDeleted.includes(file.name)).length}/50)</h4>
                  {selectedForDeletion.length > 0 && (
                    <button
                      onClick={handleBulkDelete}
                      className="body-xs text-red-600 hover:text-red-700 font-medium transition-colors flex items-center space-x-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span>delete selected ({selectedForDeletion.length})</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Files List - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6 min-h-0 mobile-scrollbar">
              {uploading && (
                <div className="mb-4 rounded-card p-3 flex items-center space-x-2" style={{ backgroundColor: '#EEF2ED', borderWidth: '1px', borderColor: '#C8D5C7' }}>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2" style={{ borderBottomColor: '#3E553C' }}></div>
                  <span className="body-small" style={{ color: '#3E553C' }}>Uploading {uploadingCount} file{uploadingCount > 1 ? 's' : ''}...</span>
                </div>
              )}

              {filesBeingDeleted.length > 0 && (
                <div className="mb-4 rounded-card p-3 flex items-center space-x-2" style={{ backgroundColor: '#FFF5E6', borderWidth: '1px', borderColor: '#FFD699' }}>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2" style={{ borderBottomColor: '#FFA51F' }}></div>
                  <span className="body-small" style={{ color: '#CC7A00' }}>Deleting {filesBeingDeleted.length} file{filesBeingDeleted.length > 1 ? 's' : ''}...</span>
                </div>
              )}

              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-card p-3 flex items-start space-x-2">
                  <svg className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <p className="body-small text-red-700">{error}</p>
                </div>
              )}

              {uploadedFiles.filter(file => !filesBeingDeleted.includes(file.name)).length > 0 ? (
                <div className="space-y-3">
                  {uploadedFiles
                    .filter(file => !filesBeingDeleted.includes(file.name))
                    .map((file) => {
                      const fileType = getFileType(file.name);
                      const styles = getFileTypeStyles(fileType);
                      const isSelectedForDeletion = selectedForDeletion.includes(file.name);
                      return (
                      <div
                        key={file.name}
                        className="p-4 rounded-card border border-gray-200 bg-background-warm-white hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3 flex-1 min-w-0">
                            {/* Checkbox for bulk selection */}
                            <label className="flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isSelectedForDeletion}
                                onChange={() => toggleFileForDeletion(file.name)}
                                className="w-4 h-4 border-gray-300 rounded focus:ring-primary-500 cursor-pointer accent-primary-600"
                                style={{ accentColor: '#3E553C' }}
                              />
                            </label>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${styles.labelBg} ${styles.labelText}`}>
                              {styles.label}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="body-small font-medium text-text-primary truncate">{file.name}</p>
                              <p className="body-xs text-text-muted">{(file.size / 1024).toFixed(1)} KB</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => onFileDownload(file)}
                              className="p-2 rounded text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Download file"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm(`Are you sure you want to delete ${file.name}?`)) {
                                  onFileDeleted(file.name);
                                }
                              }}
                              className="p-2 rounded text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Delete file"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="body-small text-text-muted">No files uploaded yet</p>
                  <p className="body-xs text-text-muted mt-1">Use the upload area above to add files</p>
                </div>
              )}
            </div>

            {/* Popup Footer */}
            <div className="border-t border-gray-200 p-1 flex-shrink-0">
              <div className="flex items-center justify-between">
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
