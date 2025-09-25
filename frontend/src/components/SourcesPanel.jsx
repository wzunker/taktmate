import React, { useState, useRef } from 'react';
import Card, { CardHeader, CardContent } from './Card';
import ConversationItem from './ConversationItem';

const SourcesPanel = ({ 
  onFileUploaded, 
  uploadedFiles, 
  activeFileId, 
  storageQuota, 
  onFileSelected, 
  onFileDownload, 
  onFileDeleted,
  isCollapsed,
  onToggleCollapse,
  filesLoading,
  // New conversation-related props
  conversations = [],
  activeConversationId,
  onConversationSelected,
  onConversationCreated,
  onConversationRename,
  onConversationDelete,
  onConversationExport,
  conversationsLoading = false
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [showPrivacyInfo, setShowPrivacyInfo] = useState(false);
  const [showConversations, setShowConversations] = useState(false);
  const [creatingConversation, setCreatingConversation] = useState(false);
  const fileInputRef = useRef(null);

  // Get conversations for the currently selected file
  const getFileConversations = () => {
    if (!activeFileId) return [];
    const activeFile = uploadedFiles.find(f => f.fileId === activeFileId);
    if (!activeFile) return [];
    
    return conversations.filter(conv => conv.fileName === activeFile.name);
  };

  // Get recent conversations (when no file is selected)
  const getRecentConversations = () => {
    return conversations
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 5);
  };

  // Check if a conversation's file still exists
  const hasValidFile = (conversation) => {
    return uploadedFiles.some(file => file.name === conversation.fileName);
  };

  // Get conversation count for a file
  const getFileConversationCount = (fileName) => {
    return conversations.filter(conv => conv.fileName === fileName).length;
  };

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

  // Get file type icon SVG
  const getFileTypeIcon = (fileType) => {
    switch (fileType) {
      case 'csv':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
            <path d="M9,13H11V15H9V13M9,16H11V18H9V16M12,13H14V15H12V13M12,16H14V18H12V16M15,13H17V15H15V13M15,16H17V18H15V16Z" />
          </svg>
        );
      case 'pdf':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
            <path d="M9,13H11V15H9V13M9,16H11V18H9V16M12,13H14V15H12V13M15,13H17V15H15V13Z" />
          </svg>
        );
      case 'docx':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
            <path d="M8,12H16V13.5H8V12M8,14.5H16V16H8V14.5M8,17H13V18.5H8V17Z" />
          </svg>
        );
      case 'xlsx':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
            <path d="M8,12H10V14H8V12M10,12H12V14H10V12M12,12H14V14H12V12M14,12H16V14H14V12M8,14H10V16H8V14M10,14H12V16H10V14M12,14H14V16H12V14M14,14H16V16H14V14M8,16H10V18H8V16M10,16H12V18H10V16M12,16H14V18H12V16M14,16H16V18H14V16Z" />
          </svg>
        );
      case 'txt':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
            <path d="M8,12H16V13H8V12M8,14H16V15H8V14M8,16H13V17H8V16Z" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
          </svg>
        );
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
      // Get auth info from SWA
      const authResponse = await fetch('/.auth/me');
      const authData = await authResponse.json();
      
      if (!authData.clientPrincipal) {
        throw new Error('Authentication required. Please log in.');
      }

      const authHeaders = {
        'Content-Type': 'application/json',
        'x-ms-client-principal': btoa(JSON.stringify(authData.clientPrincipal))
      };

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
              <h4 className="body-small font-medium text-text-secondary">Files ({uploadedFiles.length}/5)</h4>
              <div className="space-y-1 max-h-full overflow-y-auto mobile-scrollbar">
                {uploadedFiles.map((file) => (
                  <div
                    key={file.fileId}
                    className={`p-3 rounded-card border transition-all duration-200 cursor-pointer ${
                      activeFileId === file.fileId
                        ? 'bg-primary-50 border-primary-200 ring-2 ring-primary-100'
                        : 'bg-background-warm-white border-gray-200 hover:bg-primary-25 hover:border-primary-200'
                    }`}
                    onClick={() => onFileSelected(file.fileId)}
                  >
                    <div className="flex items-start space-x-2">
                      {(() => {
                        const fileType = getFileType(file.name);
                        const styles = getFileTypeStyles(fileType);
                        return (
                          <div className={`w-8 h-8 rounded flex items-center justify-center flex-shrink-0 ${
                            activeFileId === file.fileId ? 'bg-primary-100' : styles.bgColor
                          }`}>
                            <div className={`${
                              activeFileId === file.fileId ? 'text-primary-600' : styles.textColor
                            }`}>
                              {getFileTypeIcon(fileType)}
                            </div>
                          </div>
                        );
                      })()}
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="body-small font-medium text-text-primary truncate">
                            {file.name}
                          </p>
                          {getFileConversationCount(file.name) > 0 && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-secondary-100 text-secondary-700 ml-2">
                              {getFileConversationCount(file.name)}
                            </span>
                          )}
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
                          {activeFileId === file.fileId && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-800">
                              Active
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex space-x-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onFileDownload(file);
                          }}
                          className="p-1 rounded text-gray-400 hover:text-secondary-600 hover:bg-secondary-50 transition-colors"
                          title="Download"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onFileDeleted(file.fileId);
                          }}
                          className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
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

        {/* Conversations Section */}
        {(uploadedFiles.length > 0 || conversations.length > 0) && (
          <div className="border-t border-gray-200 pt-4">
            {/* Conversations Header */}
            <div className="flex items-center justify-between mb-3">
              <h4 className="body-small font-medium text-text-secondary">
                {activeFileId ? 'File Conversations' : 'Recent Conversations'}
              </h4>
              <div className="flex items-center space-x-1">
                {activeFileId && (
                  <button
                    onClick={async () => {
                      if (creatingConversation) return;
                      
                      setCreatingConversation(true);
                      try {
                        // Get the active file
                        const activeFile = uploadedFiles.find(file => file.name === activeFileId);
                        if (!activeFile) {
                          console.error('Active file not found');
                          return;
                        }

                        // Get auth info from SWA
                        const authResponse = await fetch('/.auth/me');
                        const authData = await authResponse.json();
                        
                        if (!authData.clientPrincipal) {
                          console.error('No authentication data available');
                          return;
                        }

                        console.log('Creating new conversation with suggestions for:', activeFile.name);

                        // Create new conversation with suggestions
                        const response = await fetch('/api/conversations', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'x-ms-client-principal': btoa(JSON.stringify(authData.clientPrincipal))
                          },
                          body: JSON.stringify({
                            fileName: activeFile.name,
                            title: `New conversation about ${activeFile.name}`
                          })
                        });

                        if (response.ok) {
                          const data = await response.json();
                          if (data.success && data.conversation) {
                            console.log('Created conversation with suggestions:', data.conversation);
                            console.log('🔍 New Chat Backend Response Analysis:');
                            console.log('  - Suggestions received:', data.conversation.suggestions);
                            console.log('  - Suggestions count:', data.conversation.suggestions?.length);
                            console.log('  - Are these GPT-generated or fallbacks?', 
                              data.conversation.suggestions?.[0]?.includes('main themes') ? 'FALLBACKS (generic)' : 'LIKELY GPT-GENERATED (specific)');
                            
                            // Select the new conversation
                            if (onConversationSelected) {
                              onConversationSelected(data.conversation);
                            }
                            // Notify parent about new conversation
                            if (onConversationCreated) {
                              onConversationCreated(data.conversation);
                            }
                          } else {
                            console.error('Conversation creation failed:', data);
                          }
                        } else {
                          const errorData = await response.text();
                          console.error('Failed to create conversation:', response.statusText, errorData);
                        }
                      } catch (error) {
                        console.error('Error creating new conversation:', error);
                      } finally {
                        setCreatingConversation(false);
                      }
                    }}
                    disabled={creatingConversation}
                    className="px-2 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Start new conversation with this file"
                  >
                    {creatingConversation ? (
                      <div className="flex items-center space-x-1">
                        <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Creating...</span>
                      </div>
                    ) : (
                      'New Chat'
                    )}
                  </button>
                )}
                <button
                  onClick={() => setShowConversations(!showConversations)}
                  className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                  title={showConversations ? "Collapse conversations" : "Expand conversations"}
                >
                  <svg 
                    className={`w-4 h-4 transition-transform duration-200 ${showConversations ? 'rotate-90' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Conversations List */}
            {showConversations && (
              <div className="space-y-2 max-h-64 overflow-y-auto mobile-scrollbar">
                {conversationsLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mr-2"></div>
                    <span className="body-small text-text-muted">Loading conversations...</span>
                  </div>
                ) : (() => {
                  const displayConversations = activeFileId ? getFileConversations() : getRecentConversations();
                  
                  return displayConversations.length > 0 ? (
                    displayConversations.map((conversation) => (
                      <ConversationItem
                        key={conversation.id}
                        conversation={conversation}
                        isActive={conversation.id === activeConversationId}
                        onSelect={onConversationSelected}
                        onRename={onConversationRename}
                        onDelete={onConversationDelete}
                        onExport={onConversationExport}
                        hasValidFile={hasValidFile(conversation)}
                      />
                    ))
                  ) : (
                    <div className="text-center py-6">
                      <div className="w-8 h-8 mx-auto mb-2 bg-gray-100 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </div>
                      <p className="body-small text-text-muted">
                        {activeFileId ? 'No conversations for this file yet' : 'No conversations yet'}
                      </p>
                      <p className="body-xs text-text-muted mt-1">
                        Start chatting to create conversation history
                      </p>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
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
