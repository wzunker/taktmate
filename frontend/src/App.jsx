import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import SourcesPanel from './components/SourcesPanel';
import ChatBox from './components/ChatBox';
import DataTable from './components/DataTable';
import UserProfile from './components/UserProfile';
import Logo from './components/Logo';
import Card from './components/Card';
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
  const [sourcesCollapsed, setSourcesCollapsed] = useState(false);
  const [previewCollapsed, setPreviewCollapsed] = useState(false);
  const [filesLoading, setFilesLoading] = useState(false);
  
  // Conversation state management
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  
  const { isAuthenticated, isLoading, error } = useAuth();

  // Load files from backend when authenticated
  const loadFiles = useCallback(async (showLoading = false) => {
    if (!isAuthenticated) return;
    if (showLoading) {
      setFilesLoading(true);
    }
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
    } finally {
      if (showLoading) {
        setFilesLoading(false);
      }
    }
  }, [isAuthenticated, activeFileId]);

  // Load conversations from backend
  const loadConversations = useCallback(async (showLoading = false) => {
    if (!isAuthenticated) return;
    if (showLoading) {
      setConversationsLoading(true);
    }
    try {
      // Get auth info from SWA
      const authResponse = await fetch('/.auth/me');
      const authData = await authResponse.json();
      
      if (!authData.clientPrincipal) {
        console.warn('No authentication data available for conversations');
        return;
      }
      
      const response = await axios.get('/api/conversations', {
        headers: {
          'x-ms-client-principal': btoa(JSON.stringify(authData.clientPrincipal))
        },
        timeout: 10000
      });

      if (response.data.success) {
        setConversations(response.data.conversations || []);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
      // Don't show error to user for initial load failure
    } finally {
      if (showLoading) {
        setConversationsLoading(false);
      }
    }
  }, [isAuthenticated]);

  // Load files and conversations when component mounts and user is authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      loadFiles(true); // Show loading spinner on initial load
      loadConversations(true); // Load conversations too
    }
  }, [isAuthenticated, isLoading, loadFiles, loadConversations]);

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

    // Refresh the file list to get updated quota info (no loading spinner)
    loadFiles(false);
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

      // Refresh the file list to get updated quota info (no loading spinner)
      loadFiles(false);
    } catch (err) {
      console.error('Failed to delete file:', err);
      // You might want to show an error message to the user here
      alert(`Failed to delete file: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleFileSelected = (fileId) => {
    setActiveFileId(fileId);
    // Clear active conversation when switching files
    setActiveConversationId(null);
  };

  // Conversation management functions
  const handleConversationSelected = (conversation) => {
    if (!conversation) {
      // Clear active conversation to start fresh
      setActiveConversationId(null);
      return;
    }
    
    setActiveConversationId(conversation.id);
    
    // Auto-load the associated file if it exists
    const associatedFile = uploadedFiles.find(file => file.name === conversation.fileName);
    if (associatedFile) {
      setActiveFileId(associatedFile.name);
    } else {
      console.warn(`File ${conversation.fileName} not found for conversation ${conversation.id}`);
    }
  };

  const handleConversationCreated = (newConversation) => {
    setConversations(prev => [newConversation, ...prev]);
    setActiveConversationId(newConversation.id);
    // No need to reload conversations from backend - we have the data
  };

  const handleConversationUpdated = (conversationId, updates) => {
    setConversations(prev => prev.map(conv => 
      conv.id === conversationId 
        ? { ...conv, ...updates }
        : conv
    ));
  };

  const handleConversationRename = async (conversationId, newTitle) => {
    try {
      // Get auth info from SWA
      const authResponse = await fetch('/.auth/me');
      const authData = await authResponse.json();
      
      if (!authData.clientPrincipal) {
        console.error('No authentication data available');
        return;
      }

      await axios.put(`/api/conversations/${conversationId}`, 
        { title: newTitle },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-ms-client-principal': btoa(JSON.stringify(authData.clientPrincipal))
          },
          timeout: 10000
        }
      );

      // Update local state
      handleConversationUpdated(conversationId, { title: newTitle });
    } catch (err) {
      console.error('Failed to rename conversation:', err);
      alert(`Failed to rename conversation: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleConversationDelete = async (conversationId) => {
    try {
      // Get auth info from SWA
      const authResponse = await fetch('/.auth/me');
      const authData = await authResponse.json();
      
      if (!authData.clientPrincipal) {
        console.error('No authentication data available');
        return;
      }

      await axios.delete(`/api/conversations/${conversationId}`, {
        headers: {
          'x-ms-client-principal': btoa(JSON.stringify(authData.clientPrincipal))
        },
        timeout: 10000
      });

      // Update local state
      setConversations(prev => prev.filter(conv => conv.id !== conversationId));
      
      // Clear active conversation if it was deleted
      if (activeConversationId === conversationId) {
        setActiveConversationId(null);
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
      alert(`Failed to delete conversation: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleConversationExport = async (conversation, format) => {
    try {
      // Get auth info from SWA
      const authResponse = await fetch('/.auth/me');
      const authData = await authResponse.json();
      
      if (!authData.clientPrincipal) {
        console.error('No authentication data available');
        return;
      }

      const response = await axios.get(`/api/conversations/${conversation.id}/export/${format}`, {
        headers: {
          'x-ms-client-principal': btoa(JSON.stringify(authData.clientPrincipal))
        },
        timeout: 10000,
        responseType: 'blob'
      });

      // Create download link
      const blob = new Blob([response.data], { 
        type: format === 'json' ? 'application/json' : 'text/csv' 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${conversation.title || 'conversation'}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export conversation:', err);
      alert(`Failed to export conversation: ${err.response?.data?.error || err.message}`);
    }
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
    <div className="full-height-layout bg-background-cream flex flex-col">
      {/* Header */}
      <header className="bg-gradient-to-r from-background-warm-white to-background-cream shadow-sm border-b border-gray-200 z-50 backdrop-blur-sm bg-opacity-95 sticky-header flex-shrink-0">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between">
                <div className="flex items-center min-w-0 flex-1">
                  {/* Main Takt Logo */}
                  <img 
                    src="/logo-takt.png" 
                    alt="Takt" 
                    className="h-18 sm:h-20 w-auto"
                  />
                </div>
            
            
            {/* User Profile and Logout */}
            {isAuthenticated && (
              <div className="flex-shrink-0">
                <UserProfile />
              </div>
            )}
          </div>
          
        </div>
      </header>


      {/* Main Content - Dynamic Layout */}
      <main className="w-full px-4 sm:px-6 lg:px-8 py-4 flex-1 min-h-0">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          {/* Sources Column - Dynamic width based on collapse */}
          <div className={`h-full ${sourcesCollapsed ? 'lg:col-span-1' : 'lg:col-span-3'} transition-all duration-300`}>
            <SourcesPanel 
              onFileUploaded={handleFileUploaded}
              uploadedFiles={uploadedFiles}
              activeFileId={activeFileId}
              storageQuota={storageQuota}
              onFileSelected={handleFileSelected}
              onFileDownload={handleFileDownload}
              onFileDeleted={handleFileDeleted}
              isCollapsed={sourcesCollapsed}
              onToggleCollapse={setSourcesCollapsed}
              filesLoading={filesLoading}
              // Conversation props
              conversations={conversations}
              activeConversationId={activeConversationId}
              onConversationSelected={handleConversationSelected}
              onConversationRename={handleConversationRename}
              onConversationDelete={handleConversationDelete}
              onConversationExport={handleConversationExport}
              conversationsLoading={conversationsLoading}
            />
          </div>
          
          {/* Chat Column - Dynamic width based on both collapses */}
          <div className={`h-full ${
            sourcesCollapsed && previewCollapsed ? 'lg:col-span-10' :
            sourcesCollapsed ? 'lg:col-span-8' :
            previewCollapsed ? 'lg:col-span-8' :
            'lg:col-span-6'
          } transition-all duration-300`}>
            <ChatBox 
              fileData={activeFileData} 
              className="h-full"
              conversationId={activeConversationId}
              onConversationCreated={handleConversationCreated}
              onConversationUpdated={handleConversationUpdated}
            />
          </div>
          
          {/* Data Table Column - Dynamic width based on collapse */}
          <div className={`h-full ${previewCollapsed ? 'lg:col-span-1' : 'lg:col-span-3'} transition-all duration-300`}>
            {activeFileData ? (
              <DataTable 
                fileData={activeFileData} 
                className="h-full"
                isCollapsed={previewCollapsed}
                onToggleCollapse={setPreviewCollapsed}
              />
            ) : (
              <Card variant="elevated" className="h-full flex items-center justify-center">
                <div className="text-center p-8">
                  <div className="w-16 h-16 mx-auto mb-4 bg-secondary-100 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-secondary-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                    </svg>
                  </div>
                  <h3 className="heading-4 text-text-secondary mb-2">No Data Selected</h3>
                  <p className="body-small text-text-muted">
                    Select a file from Sources to view its data
                  </p>
                </div>
              </Card>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}

export default App;
