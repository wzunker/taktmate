import React, { useState, useRef } from 'react';
import Card, { CardHeader, CardContent } from './Card';

const SourcesPanel = ({ 
  onFileUploaded, 
  uploadedFiles, 
  activeFileId, 
  storageQuota, 
  onFileSelected, 
  onFileDownload, 
  onFileDeleted 
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [showPrivacyInfo, setShowPrivacyInfo] = useState(false);
  const fileInputRef = useRef(null);

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
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const handleFiles = async (files) => {
    const file = files[0];
    
    // Validate file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please select a CSV file');
      return;
    }
    
    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    setError(null);
    setUploading(true);
    
    try {
      await onFileUploaded(file);
    } catch (error) {
      setError(error.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <Card variant="elevated" className="h-full flex flex-col">
      <CardHeader
        title="Sources"
        subtitle={`${uploadedFiles.length} file${uploadedFiles.length !== 1 ? 's' : ''} • ${storageQuota.usedDisplay}/${storageQuota.limitDisplay}`}
        action={
          <button
            onClick={() => setShowPrivacyInfo(!showPrivacyInfo)}
            className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
            title="Privacy & Security Information"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </button>
        }
      />
      
      <CardContent className="flex-1 flex flex-col space-y-4">
        {/* Privacy Info Expandable */}
        {showPrivacyInfo && (
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
        )}

        {/* Drag and Drop Upload Area */}
        <div
          className={`relative border-2 border-dashed rounded-card p-6 text-center transition-all duration-200 ${
            dragActive 
              ? 'border-primary-400 bg-primary-50' 
              : 'border-gray-300 hover:border-primary-300 hover:bg-primary-25'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileInput}
            className="hidden"
          />
          
          <div className="space-y-3">
            <div className="w-12 h-12 mx-auto bg-primary-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            
            <div>
              <p className="body-small font-medium text-text-primary">
                {dragActive ? 'Drop your CSV file here' : 'Drag & drop CSV files'}
              </p>
              <p className="body-xs text-text-muted mt-1">
                Up to 5MB each
              </p>
            </div>
            
            <button
              type="button"
              onClick={openFileDialog}
              disabled={uploading}
              className="bg-primary-600 text-white px-4 py-2 rounded-button body-small font-medium hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors warm-shadow"
            >
              {uploading ? 'Uploading...' : 'Add'}
            </button>
          </div>
        </div>

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
          {uploadedFiles.length > 0 ? (
            <div className="space-y-2">
              <h4 className="body-small font-medium text-text-secondary">Files ({uploadedFiles.length})</h4>
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
                      <div className={`w-8 h-8 rounded flex items-center justify-center flex-shrink-0 ${
                        activeFileId === file.fileId ? 'bg-primary-100' : 'bg-secondary-100'
                      }`}>
                        <svg className={`w-4 h-4 ${
                          activeFileId === file.fileId ? 'text-primary-600' : 'text-secondary-600'
                        }`} fill="currentColor" viewBox="0 0 24 24">
                          <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                        </svg>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="body-small font-medium text-text-primary truncate">
                          {file.name}
                        </p>
                        <div className="flex items-center space-x-2 mt-1">
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
          ) : (
            <div className="text-center py-8">
              <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                </svg>
              </div>
              <p className="body-small text-text-muted">No files uploaded yet</p>
            </div>
          )}
        </div>

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
      </CardContent>
    </Card>
  );
};

export default SourcesPanel;
