import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import FileUpload from './components/FileUpload';
import ChatBox from './components/ChatBox';
import DataTable from './components/DataTable';
import UserProfile from './components/UserProfile';
import useAuth from './hooks/useAuth';

function App() {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [activeFileId, setActiveFileId] = useState(null);
  const [storageQuota, setStorageQuota] = useState({ used: 0, total: 200 * 1024 * 1024 }); // 200MB default
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
      
      const backendURL = process.env.REACT_APP_API_URL || 'https://taktmate-backend-api-csheb3aeg8f5bcbv.eastus-01.azurewebsites.net';
      
      const response = await axios.get(`${backendURL}/api/files`, {
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
          used: response.data.quota.used,
          total: response.data.quota.total
        });

        // Set first file as active if none is selected
        if (filesData.length > 0 && !activeFileId) {
          setActiveFileId(filesData[0].fileId);
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
        setActiveFileId(newFile.fileId);
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
      
      const backendURL = process.env.REACT_APP_API_URL || 'https://taktmate-backend-api-csheb3aeg8f5bcbv.eastus-01.azurewebsites.net';
      
      // Call backend delete endpoint
      await axios.delete(`${backendURL}/api/files/${encodeURIComponent(fileId)}`, {
        headers: {
          'x-ms-client-principal': btoa(JSON.stringify(authData.clientPrincipal))
        },
        timeout: 10000
      });

      // Update local state immediately for better UX
      setUploadedFiles(prevFiles => prevFiles.filter(file => file.fileId !== fileId));
      
      // If the deleted file was active, set the first remaining file as active
      if (activeFileId === fileId) {
        const remainingFiles = uploadedFiles.filter(file => file.fileId !== fileId);
        setActiveFileId(remainingFiles.length > 0 ? remainingFiles[0].fileId : null);
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
      
      const backendURL = process.env.REACT_APP_API_URL || 'https://taktmate-backend-api-csheb3aeg8f5bcbv.eastus-01.azurewebsites.net';
      
      // Request download SAS token from backend
      const response = await axios.get(`${backendURL}/api/files/${encodeURIComponent(file.name)}/sas`, {
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
  const activeFileData = uploadedFiles.find(file => file.fileId === activeFileId) || null;

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Show error state if there's an authentication error
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
            <h2 className="text-lg font-medium text-red-900 mb-2">Authentication Error</h2>
            <p className="text-red-700 mb-4">{error}</p>
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">TaktMate</h1>
              <span className="ml-2 text-sm text-gray-500">CSV Chat MVP</span>
            </div>
            
            {/* User Profile and Logout */}
            {isAuthenticated && (
              <UserProfile />
            )}
          </div>
          <p className="mt-1 text-sm text-gray-600">
            Upload a CSV file and chat with your data using AI
          </p>
        </div>
      </header>


      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* File Upload Section */}
          <FileUpload 
            onFileUploaded={handleFileUploaded} 
            uploadedFilesCount={uploadedFiles.length} 
          />
          
          {/* Uploaded Files Section */}
          {uploadedFiles.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-800">Uploaded Files</h2>
                <div className="text-sm text-gray-500 space-y-1">
                  <div>{uploadedFiles.length} file{uploadedFiles.length > 1 ? 's' : ''} in storage</div>
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${Math.min(100, (storageQuota.used / storageQuota.total) * 100)}%` }}
                      ></div>
                    </div>
                    <span className="text-xs whitespace-nowrap">
                      {(storageQuota.used / 1024 / 1024).toFixed(1)}/{(storageQuota.total / 1024 / 1024).toFixed(0)}MB
                    </span>
                  </div>
                </div>
              </div>
              <div className="border border-gray-200 rounded-lg bg-white">
                <div className="divide-y divide-gray-100">
                  {uploadedFiles.map((file) => (
                    <div key={file.fileId} className={`px-4 py-3 transition-colors ${
                      activeFileId === file.fileId ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'hover:bg-gray-50'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          {/* File Icon */}
                          <div className="flex-shrink-0">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              activeFileId === file.fileId ? 'bg-blue-100' : 'bg-green-100'
                            }`}>
                              <svg className={`w-4 h-4 ${
                                activeFileId === file.fileId ? 'text-blue-600' : 'text-green-600'
                              }`} fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            </div>
                          </div>
                          
                          {/* File Details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleFileDownload(file)}
                                className="text-sm font-medium text-gray-900 truncate hover:text-blue-600 transition-colors cursor-pointer text-left"
                                title="Click to download file"
                              >
                                {file.name}
                              </button>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                CSV
                              </span>
                              {activeFileId === file.fileId && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  Active
                                </span>
                              )}
                            </div>
                            <div className="flex items-center mt-1 space-x-4 text-xs text-gray-500">
                              <span>{(file.size / 1024).toFixed(1)} KB</span>
                              <span>•</span>
                              <span>{new Date(file.lastModified).toLocaleDateString()}</span>
                              <span>•</span>
                              <span className="inline-flex items-center">
                                <div className="w-2 h-2 bg-green-400 rounded-full mr-1"></div>
                                In Storage
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex items-center space-x-2 ml-4">
                          <button
                            type="button"
                            onClick={() => handleFileSelected(file.fileId)}
                            className={`p-1 transition-colors ${
                              activeFileId === file.fileId 
                                ? 'text-blue-600' 
                                : 'text-gray-400 hover:text-blue-600'
                            }`}
                            title="View file data"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFileDownload(file)}
                            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                            title="Download file"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFileDeleted(file.fileId)}
                            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                            title="Delete file from storage"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {/* Data Table Section */}
          {activeFileData && <DataTable fileData={activeFileData} />}
          
          {/* Chat Section */}
          <ChatBox fileData={activeFileData} />
          
          {/* Info Section */}
          {uploadedFiles.length === 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-blue-900 mb-2">How it works</h3>
              <ol className="list-decimal list-inside space-y-2 text-blue-800">
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
      <footer className="mt-16 bg-white border-t border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center space-y-2">
            <p className="text-sm text-gray-500">
              TaktMate MVP - Powered by OpenAI GPT-4
            </p>
            <div className="flex justify-center items-center space-x-4 text-xs text-gray-400">
              <span>🔒 Enterprise-grade security</span>
              <span>•</span>
              <span>📁 Files auto-deleted after 90 days</span>
              <span>•</span>
              <span>🛡️ Your data stays private</span>
            </div>
            <p className="text-xs text-gray-400 max-w-2xl mx-auto">
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
