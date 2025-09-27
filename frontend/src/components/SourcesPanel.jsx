import React, { useState, useRef } from 'react';
import Card, { CardHeader, CardContent } from './Card';
import { getAuthHeaders } from '../utils/auth';

const SourcesPanel = ({ 
  onFileUploaded, 
  uploadedFiles, 
  selectedFileIds = [], // Changed from activeFileId to selectedFileIds array
  storageQuota, 
  onFileSelected, 
  onFileDownload, 
  onFileDeleted,
  isCollapsed,
  onToggleCollapse,
  filesLoading,
  isFilesLocked = false
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [showPrivacyInfo, setShowPrivacyInfo] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const fileInputRef = useRef(null);


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

  // Get file type colors and styles
  const getFileTypeStyles = (fileType) => {
    switch (fileType) {
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


  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList);
    const maxFiles = 5;
    
    // Validate we don't exceed file limit
    if (files.length > maxFiles) {
      setError(`Please select no more than ${maxFiles} files at once`);
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
      
      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        errors.push(`${file.name}: File size must be less than 5MB`);
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
    
    try {
      // Get authentication headers (handles local development bypass)
      const authHeaders = await getAuthHeaders();

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

        // Step 3: Notify parent component for each successful upload
        await onFileUploaded({
          name: file.name,
          size: file.size,
          type: file.type || 'text/csv',
          lastModified: new Date().toISOString()
        });
      }
      
    } catch (error) {
      console.error('Upload error:', error);
      setError(error.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <Card 
      variant="elevated" 
      className={`h-full flex flex-col transition-all duration-200 ${
        dragActive 
          ? 'ring-2 ring-primary-400 bg-primary-50' 
          : 'hover:bg-primary-25'
      }`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
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
        <CardContent className="flex-1 flex flex-col space-y-4">
        {/* Add Button - Full Width */}
        <button
          type="button"
          onClick={openFileDialog}
          disabled={uploading}
          className="w-full bg-primary-600 text-white px-4 py-2.5 rounded-button body-small font-medium hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors warm-shadow"
        >
          {uploading ? 'Uploading...' : 'add'}
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

        {/* Drag and drop hint when dragging */}
        {dragActive && (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-primary-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="body-large font-medium text-primary-600">Drop your files here</p>
            <p className="body-small text-primary-500 mt-1">Up to 5MB each</p>
          </div>
        )}

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
        <div className="flex-1 min-h-0">
          {filesLoading ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              <p className="body-small text-text-muted">Loading files...</p>
            </div>
          ) : uploadedFiles.length > 0 ? (
            <div className="space-y-2">
              {/* File Selection Header */}
              <div className="flex items-center justify-between py-2 border-b border-gray-200">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      if (isFilesLocked) return;
                      if (selectedFileIds.length === uploadedFiles.length) {
                        // Unselect all
                        onFileSelected([]);
                      } else {
                        // Select all
                        onFileSelected(uploadedFiles.map(file => file.fileId));
                      }
                    }}
                    className={`body-small font-medium transition-colors ${
                      isFilesLocked 
                        ? 'text-gray-400 cursor-not-allowed' 
                        : 'text-primary-600 hover:text-primary-700'
                    }`}
                    disabled={isFilesLocked}
                    title={isFilesLocked ? 'Cannot change files while conversation has messages' : ''}
                  >
                    {selectedFileIds.length === uploadedFiles.length ? 'Unselect All' : 'Select All'}
                  </button>
                  {selectedFileIds.length > 0 && (
                    <span className="body-xs text-text-muted">
                      ({selectedFileIds.length} selected)
                    </span>
                  )}
                </div>
                {selectedFileIds.length > 0 && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                    {selectedFileIds.length} file{selectedFileIds.length !== 1 ? 's' : ''} selected
                  </span>
                )}
                {isFilesLocked && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                    locked
                  </span>
                )}
              </div>
              <div className="space-y-1 max-h-full overflow-y-auto mobile-scrollbar">
                {uploadedFiles.map((file) => {
                  const isSelected = selectedFileIds.includes(file.fileId);
                  return (
                    <div
                      key={file.fileId}
                      className={`p-3 rounded-card border transition-all duration-200 ${
                        isFilesLocked 
                          ? 'cursor-not-allowed opacity-75'
                          : 'cursor-pointer'
                      } ${
                        isSelected
                          ? 'bg-primary-50 border-primary-200 ring-2 ring-primary-100'
                          : isFilesLocked
                            ? 'bg-gray-50 border-gray-200'
                            : 'bg-background-warm-white border-gray-200 hover:bg-primary-25 hover:border-primary-200'
                      }`}
                      onClick={() => {
                        if (isFilesLocked) return;
                        if (isSelected) {
                          // Remove from selection
                          onFileSelected(selectedFileIds.filter(id => id !== file.fileId));
                        } else {
                          // Add to selection
                          onFileSelected([...selectedFileIds, file.fileId]);
                        }
                      }}
                    >
                      <div className="flex items-start space-x-3">
                        {/* Checkbox */}
                        <div className="flex-shrink-0 pt-1">
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                            isSelected 
                              ? isFilesLocked
                                ? 'bg-gray-400 border-gray-400'
                                : 'bg-primary-600 border-primary-600'
                              : isFilesLocked
                                ? 'border-gray-300'
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
                            <p className="body-small font-medium text-text-primary truncate">
                              {file.name}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2 mt-1">
                            {(() => {
                              const fileType = getFileType(file.name);
                              const styles = getFileTypeStyles(fileType);
                              return (
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${styles.labelBg} ${styles.labelText}`}>
                                  {styles.label}
                                </span>
                              );
                            })()}
                            <span className="body-xs text-text-muted">
                              {(file.size / 1024).toFixed(1)} KB
                            </span>
                            {isSelected && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-800">
                                Selected
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="relative">
                        {/* Three dots menu button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === file.fileId ? null : file.fileId);
                          }}
                          className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                          title="More options"
                        >
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                          </svg>
                        </button>

                        {/* Dropdown menu */}
                        {openMenuId === file.fileId && (
                          <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-card border border-gray-200 warm-shadow z-10">
                            <div className="py-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onFileDownload(file);
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
                                  if (window.confirm(`Are you sure you want to delete ${file.name}?`)) {
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
                          </div>
                        )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : !dragActive ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                </svg>
              </div>
              <p className="body-small text-text-muted mb-2">No files uploaded yet</p>
              <p className="body-xs text-text-muted">Drag & drop CSV, PDF, DOCX, XLSX, or TXT files or click Add</p>
            </div>
          ) : null}
        </div>

        {/* Click outside to close menu */}
        {openMenuId && (
          <div
            className="fixed inset-0 z-0"
            onClick={() => setOpenMenuId(null)}
          />
        )}

        {/* Storage Quota */}
        <div className="pt-3 border-t border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="body-xs text-text-secondary">Storage</span>
            <span className="body-xs text-text-muted">
              {storageQuota.usedDisplay}/{storageQuota.limitDisplay}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-primary-600 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${Math.min(100, (storageQuota.used / storageQuota.total) * 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Info Button - Bottom Right */}
        <div className="flex justify-end">
          <button
            onClick={() => setShowPrivacyInfo(!showPrivacyInfo)}
            className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
            title="Privacy & File Type Information"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        </CardContent>
      )}
    </Card>
  );
};

export default SourcesPanel;
