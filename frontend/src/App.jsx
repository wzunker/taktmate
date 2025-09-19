import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import FileUpload from './components/FileUpload';
import ChatBox from './components/ChatBox';
import DataTable from './components/DataTable';
import UserProfile from './components/UserProfile';
import Logo, { LogoWithText } from './components/Logo';
import Card, { CardHeader, CardContent, StatCard } from './components/Card';
import useAuth from './hooks/useAuth';

function App() {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [activeFileId, setActiveFileId] = useState(null);
  const [storageQuota, setStorageQuota] = useState({ 
    used: 0, 
    total: 200 * 1024 * 1024, 
    usedDisplay: '0 KB', 
    limitDisplay: '200 MB' 
  });
  const { isAuthenticated, isLoading, error } = useAuth();

  // Load files from backend when authenticated
  const loadFiles = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      // Get auth info from SWA
      const authResponse = await fetch('/.auth/me');
      const authData = await authResponse.json();
      
      if (!authData.clientPrincipal) {
        console.warn('No authentication data available');
        return;
      }
      
      const response = await axios.get('/api/files', {
        headers: {
          'x-ms-client-principal': btoa(JSON.stringify(authData.clientPrincipal))
        },
        timeout: 10000
      });

      if (response.data.success) {
        const filesData = response.data.files.map(file => ({
          name: file.name,
          size: file.size,
          type: file.type || 'text/csv',
          lastModified: file.lastModified,
          // Use file name as ID for blob storage (no longer using fileId)
          fileId: file.name
        }));
        
        setUploadedFiles(filesData);
        setStorageQuota({
          used: response.data.quota.used || 0,
          total: response.data.quota.limit || (200 * 1024 * 1024),
          usedDisplay: response.data.quota.usedDisplay || '0 KB',
          limitDisplay: response.data.quota.limitDisplay || '200 MB'
        });

        // Set first file as active if none is selected
        if (filesData.length > 0 && !activeFileId) {
          setActiveFileId(filesData[0].name);
        }
      }
    } catch (err) {
      console.error('Failed to load files:', err);
      // Don't show error to user for initial load failure
    }
  }, [isAuthenticated, activeFileId]);

  // Load files when component mounts and user is authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      loadFiles();
    }
  }, [isAuthenticated, isLoading, loadFiles]);

  const handleFileUploaded = (uploadedFileData) => {
    // Add the new file to the list immediately for better UX
    const newFile = {
      name: uploadedFileData.name,
      size: uploadedFileData.size,
      type: uploadedFileData.type || 'text/csv',
      lastModified: uploadedFileData.lastModified,
      fileId: uploadedFileData.name // Use name as ID for blob storage
    };

    setUploadedFiles(prevFiles => {
      const newFiles = [...prevFiles, newFile];
      // Set the first uploaded file as active if no file is currently active
      if (!activeFileId) {
        setActiveFileId(newFile.name);
      }
      return newFiles;
    });

    // Refresh the file list to get updated quota info
    loadFiles();
  };

  const handleFileDeleted = async (fileId) => {
    try {
      // Get auth info from SWA
      const authResponse = await fetch('/.auth/me');
      const authData = await authResponse.json();
      
      if (!authData.clientPrincipal) {
        console.error('No authentication data available for delete');
        return;
      }
      
      // Call backend delete endpoint
      await axios.delete(`/api/files/${encodeURIComponent(fileId)}`, {
        headers: {
          'x-ms-client-principal': btoa(JSON.stringify(authData.clientPrincipal))
        },
        timeout: 10000
      });

      // Update local state immediately for better UX
      setUploadedFiles(prevFiles => prevFiles.filter(file => file.name !== fileId));
      
      // If the deleted file was active, set the first remaining file as active
      if (activeFileId === fileId) {
        const remainingFiles = uploadedFiles.filter(file => file.name !== fileId);
        setActiveFileId(remainingFiles.length > 0 ? remainingFiles[0].name : null);
      }

      // Refresh the file list to get updated quota info
      loadFiles();
    } catch (err) {
      console.error('Failed to delete file:', err);
      // You might want to show an error message to the user here
      alert(`Failed to delete file: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleFileSelected = (fileId) => {
    setActiveFileId(fileId);
  };

  const handleFileDownload = async (file) => {
    try {
      // Get auth info from SWA
      const authResponse = await fetch('/.auth/me');
      const authData = await authResponse.json();
      
      if (!authData.clientPrincipal) {
        console.error('No authentication data available for download');
        return;
      }
      
      // Request download SAS token from backend
      const response = await axios.get(`/api/files/${encodeURIComponent(file.name)}/sas`, {
        headers: {
          'x-ms-client-principal': btoa(JSON.stringify(authData.clientPrincipal))
        },
        timeout: 10000
      });

      if (response.data.success && response.data.downloadUrl) {
        // Open the SAS URL for download
        const link = document.createElement('a');
        link.href = response.data.downloadUrl;
        link.download = file.name;
        link.target = '_blank'; // Open in new tab as fallback
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        throw new Error('Failed to get download URL');
      }
    } catch (err) {
      console.error('Failed to download file:', err);
      alert(`Failed to download file: ${err.response?.data?.error || err.message}`);
    }
  };

  // Get the currently active file data
  const activeFileData = uploadedFiles.find(file => file.name === activeFileId) || null;

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background-cream flex items-center justify-center">
        <div className="text-center">
          <Logo variant="solo" size="lg" animate={true} className="mx-auto mb-4" />
          <p className="body-normal text-text-secondary">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Show error state if there's an authentication error
  if (error) {
    return (
      <div className="min-h-screen bg-background-cream flex items-center justify-center">
        <div className="text-center">
          <Logo variant="solo" size="md" className="mx-auto mb-6" />
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
            <h2 className="heading-5 text-red-900 mb-2">Authentication Error</h2>
            <p className="body-normal text-red-700 mb-4">{error}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-cream">
      {/* Header */}
      <header className="bg-gradient-to-r from-background-warm-white to-background-cream shadow-sm border-b border-gray-200 sticky top-0 z-50 backdrop-blur-sm bg-opacity-95 sticky-header">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <LogoWithText 
                text="TaktMate" 
                subtitle="CSV Chat MVP"
                size="md"
                className="sm:flex hidden"
              />
              {/* Mobile logo - just the symbol and text, no subtitle */}
              <LogoWithText 
                text="TaktMate" 
                subtitle=""
                size="sm"
                className="sm:hidden flex"
              />
            </div>
            
            {/* Status Indicator - shows current context (hidden on mobile) */}
            <div className="flex-1 justify-center hidden md:flex">
              {activeFileData && (
                <div className="flex items-center space-x-2 bg-primary-50 border border-primary-200 rounded-full px-3 py-1">
                  <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse"></div>
                  <span className="body-xs text-primary-800 font-medium">
                    Analyzing: {activeFileData.name}
                  </span>
                </div>
              )}
            </div>
            
            {/* User Profile and Logout */}
            {isAuthenticated && (
              <UserProfile />
            )}
          </div>
          <p className="mt-1 body-small">
            Upload a CSV file and chat with your data using AI
          </p>
        </div>
      </header>


      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* File Upload Section */}
          <FileUpload 
            onFileUploaded={handleFileUploaded} 
            uploadedFilesCount={uploadedFiles.length} 
          />
          
          {/* Uploaded Files Section */}
          {uploadedFiles.length > 0 && (
            <Card variant="elevated">
              <CardHeader
                title="File Management"
                subtitle="Manage your uploaded CSV files and storage"
                action={
                  <div className="flex items-center space-x-4">
                    {/* File Count Badge */}
                    <div className="bg-secondary-100 text-secondary-800 px-3 py-1 rounded-badge body-xs font-medium">
                      {uploadedFiles.length} file{uploadedFiles.length > 1 ? 's' : ''}
                    </div>
                    {/* Storage Quota Display */}
                    <div className="text-right">
                      <div className="body-xs text-text-secondary mb-1">Storage Usage</div>
                      <div className="flex items-center space-x-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-primary-600 h-2 rounded-full transition-all duration-300" 
                            style={{ width: `${Math.min(100, (storageQuota.used / storageQuota.total) * 100)}%` }}
                          ></div>
                        </div>
                        <span className="body-xs text-text-muted whitespace-nowrap">
                          {storageQuota.usedDisplay}/{storageQuota.limitDisplay}
                        </span>
                      </div>
                    </div>
                  </div>
                }
              />
              <CardContent>
                <div className="border border-gray-200 rounded-card bg-background-warm-white warm-shadow">
                  <div className="divide-y divide-gray-100">
                  {uploadedFiles.map((file) => (
                    <div key={file.fileId} className={`px-6 py-4 transition-colors ${
                      activeFileId === file.fileId ? 'bg-primary-50 border-l-4 border-l-primary-500' : 'hover:bg-background-cream'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          {/* File Icon */}
                          <div className="flex-shrink-0">
                            <div className={`w-12 h-12 rounded-card flex items-center justify-center transition-colors duration-300 ${
                              activeFileId === file.fileId 
                                ? 'bg-primary-100 ring-2 ring-primary-200' 
                                : 'bg-secondary-100 hover:bg-secondary-200'
                            }`}>
                              <svg className={`w-6 h-6 transition-colors duration-300 ${
                                activeFileId === file.fileId ? 'text-primary-600' : 'text-secondary-600'
                              }`} fill="currentColor" viewBox="0 0 24 24">
                                <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                                <path d="M8,12H16V14H8V12M8,16H13V18H8V16Z" fill="currentColor" fillOpacity="0.6"/>
                              </svg>
                            </div>
                          </div>
                          
                          {/* File Details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-3 flex-wrap">
                              <button
                                onClick={() => handleFileDownload(file)}
                                className="text-emphasis truncate hover:text-primary-600 transition-colors cursor-pointer text-left font-medium"
                                title="Click to download file"
                              >
                                {file.name}
                              </button>
                              <div className="flex items-center space-x-2">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-badge text-xs font-medium bg-secondary-100 text-secondary-800">
                                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                                  </svg>
                                  CSV
                                </span>
                                {activeFileId === file.fileId && (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-badge text-xs font-medium bg-primary-100 text-primary-800">
                                    <div className="w-2 h-2 bg-primary-500 rounded-full mr-1.5 animate-pulse"></div>
                                    Active
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center mt-2 space-x-4 body-xs text-text-secondary">
                              <div className="flex items-center space-x-1">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                                <span className="font-medium">{(file.size / 1024).toFixed(1)} KB</span>
                              </div>
                              <span>•</span>
                              <div className="flex items-center space-x-1">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                                </svg>
                                <span>{new Date(file.lastModified).toLocaleDateString()}</span>
                              </div>
                              <span>•</span>
                              <div className="inline-flex items-center space-x-1">
                                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                <span className="font-medium text-green-700">Stored</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex items-center space-x-1 ml-4">
                          <button
                            type="button"
                            onClick={() => handleFileSelected(file.fileId)}
                            className={`p-2 rounded-button transition-all duration-200 ${
                              activeFileId === file.fileId 
                                ? 'text-primary-600 bg-primary-100 ring-2 ring-primary-200' 
                                : 'text-gray-400 hover:text-primary-600 hover:bg-primary-50'
                            }`}
                            title={activeFileId === file.fileId ? "Currently viewing" : "View file data"}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFileDownload(file)}
                            className="p-2 rounded-button text-gray-400 hover:text-secondary-600 hover:bg-secondary-50 transition-all duration-200"
                            title="Download file"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFileDeleted(file.fileId)}
                            className="p-2 rounded-button text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all duration-200"
                            title="Delete file from storage"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Data Table Section */}
          {activeFileData && <DataTable fileData={activeFileData} />}
          
          {/* Chat Section */}
          <ChatBox fileData={activeFileData} />
          
          {/* Info Section */}
          {uploadedFiles.length === 0 && (
            <div className="bg-primary-50 border border-primary-200 rounded-card p-8 card-shadow">
              <h3 className="heading-5 text-primary-800 mb-2">How it works</h3>
              <ol className="list-decimal list-inside space-y-2 body-normal text-primary-700">
                <li>Upload CSV files (up to 5 files, max 5MB each)</li>
                <li>The AI will analyze your data structure</li>
                <li>Click on any file to view its data in the table</li>
                <li>Ask questions about your data in natural language</li>
                <li>Switch between files to analyze different datasets</li>
              </ol>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-20 bg-background-warm-white border-t border-gray-200 warm-shadow">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center space-y-2">
            <p className="body-small">
              TaktMate MVP - Powered by OpenAI GPT-4
            </p>
            <div className="flex justify-center items-center space-x-4 body-xs">
              <span>🔒 Enterprise-grade security</span>
              <span>•</span>
              <span>📁 Files auto-deleted after 90 days</span>
              <span>•</span>
              <span>🛡️ Your data stays private</span>
            </div>
            <p className="body-xs max-w-2xl mx-auto">
              Files are securely stored in Azure with encryption at rest and in transit. 
              Data is processed only for document analysis and remains within your private workspace.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
