import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import SourcesPanel from './components/SourcesPanel';
import ConversationsPanel from './components/ConversationsPanel';
import ChatBox from './components/ChatBox';
import UserProfile from './components/UserProfile';
import Logo from './components/Logo';
import useAuth from './hooks/useAuth';
import { getAuthHeaders } from './utils/auth';

function App() {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [selectedFileIds, setSelectedFileIds] = useState([]); // Changed from activeFileId to selectedFileIds array
  const [sourcesCollapsed, setSourcesCollapsed] = useState(false);
  const [conversationsCollapsed, setConversationsCollapsed] = useState(false);
  const [filesLoading, setFilesLoading] = useState(false);
  
  // Conversation state management
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [isInNewConversationMode, setIsInNewConversationMode] = useState(true); // Start in new conversation mode by default
  
  const { isAuthenticated, isLoading, error } = useAuth();

  // Load files from backend when authenticated
  const loadFiles = useCallback(async (showLoading = false) => {
    if (!isAuthenticated) return;
    if (showLoading) {
      setFilesLoading(true);
    }
    try {
      // Get authentication headers (handles local development bypass)
      const authHeaders = await getAuthHeaders();
      
      const response = await axios.get('/api/files', {
        headers: authHeaders,
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

        // Don't auto-select files - let users explicitly choose to start a conversation
      }
    } catch (err) {
      console.error('Failed to load files:', err);
      // Don't show error to user for initial load failure
    } finally {
      if (showLoading) {
        setFilesLoading(false);
      }
    }
  }, [isAuthenticated]);

  // Load conversations from backend
  const loadConversations = useCallback(async (showLoading = false) => {
    if (!isAuthenticated) return;
    if (showLoading) {
      setConversationsLoading(true);
    }
    try {
      // Get authentication headers (handles local development bypass)
      const authHeaders = await getAuthHeaders();
      
      const response = await axios.get('/api/conversations', {
        headers: authHeaders,
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

  // Clear active conversation when entering new conversation mode
  // This ensures clicking "new conversation" from an active conversation properly resets
  useEffect(() => {
    if (isInNewConversationMode && activeConversationId) {
      // Always clear activeConversationId when in new conversation mode
      // This handles the case of clicking "new conversation" from an existing conversation
      setActiveConversationId(null);
    }
  }, [isInNewConversationMode, activeConversationId]);

  // Update selected files when uploadedFiles changes and we have an active conversation
  // This handles the case where files are re-uploaded while viewing a conversation
  useEffect(() => {
    if (activeConversationId && !isInNewConversationMode) {
      const activeConversation = conversations.find(conv => conv.id === activeConversationId);
      if (activeConversation) {
        const conversationFileNames = activeConversation.fileNames || [activeConversation.fileName];
        const associatedFiles = uploadedFiles.filter(file => conversationFileNames.includes(file.name));
        
        if (associatedFiles.length > 0) {
          setSelectedFileIds(associatedFiles.map(file => file.name));
        }
      }
    }
  }, [uploadedFiles, activeConversationId, conversations, isInNewConversationMode]);

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
      // Don't auto-select uploaded files - let users explicitly choose
      return newFiles;
    });

    // Refresh the file list to get updated quota info (no loading spinner)
    loadFiles(false);
    
    // Refresh conversations to update any file associations (handles re-uploaded files)
    loadConversations(false);
  };

  const handleFileDeleted = async (fileId) => {
    try {
      // Get authentication headers (handles local development bypass)
      const authHeaders = await getAuthHeaders();
      
      // Call backend delete endpoint
      await axios.delete(`/api/files/${encodeURIComponent(fileId)}`, {
        headers: authHeaders,
        timeout: 10000
      });

      // Update local state immediately for better UX
      setUploadedFiles(prevFiles => prevFiles.filter(file => file.name !== fileId));
      
      // If the deleted file was selected, remove it from selection but stay on the conversation
      if (selectedFileIds.includes(fileId)) {
        setSelectedFileIds(prev => prev.filter(id => id !== fileId));
      }

      // Refresh the file list to get updated quota info (no loading spinner)
      loadFiles(false);
    } catch (err) {
      console.error('Failed to delete file:', err);
      // You might want to show an error message to the user here
      alert(`Failed to delete file: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleFileSelected = async (fileIdsOrId) => {
    // Handle both array (new multi-select) and single fileId (backward compatibility)
    let newSelectedIds = [];
    if (Array.isArray(fileIdsOrId)) {
      newSelectedIds = fileIdsOrId;
    } else {
      // Single file selection - toggle behavior
      if (selectedFileIds.includes(fileIdsOrId)) {
        newSelectedIds = selectedFileIds.filter(id => id !== fileIdsOrId);
      } else {
        newSelectedIds = [...selectedFileIds, fileIdsOrId];
      }
    }
    
    setSelectedFileIds(newSelectedIds);
    // Don't clear active conversation when changing file selection - allow dynamic file changes
  };

  // Conversation management functions
  const handleConversationSelected = (conversation) => {
    if (!conversation) {
      // Clear active conversation to start fresh
      setActiveConversationId(null);
      // Clear file selection when starting a new conversation
      setSelectedFileIds([]);
      // Enter new conversation mode
      setIsInNewConversationMode(true);
      return;
    }
    
    setActiveConversationId(conversation.id);
    // Exit new conversation mode
    setIsInNewConversationMode(false);
    
    // Auto-load the associated file(s) if they exist
    const conversationFileNames = conversation.fileNames || [conversation.fileName];
    const associatedFiles = uploadedFiles.filter(file => conversationFileNames.includes(file.name));
    
    if (associatedFiles.length > 0) {
      setSelectedFileIds(associatedFiles.map(file => file.name));
    } else {
      console.warn(`Files ${conversationFileNames.join(', ')} not found for conversation ${conversation.id}`);
    }
  };

  const handleConversationCreated = (newConversation) => {
    setConversations(prev => [newConversation, ...prev]);
    setActiveConversationId(newConversation.id);
    // No need to reload conversations from backend - we have the data
  };

  const handleStartConversation = async (fileIds) => {
    try {
      const selectedFiles = uploadedFiles.filter(file => fileIds.includes(file.name));
      if (selectedFiles.length === 0) {
        console.error('Selected files not found');
        return;
      }

      // Get authentication headers (handles local development bypass)
      const authHeaders = await getAuthHeaders();

      console.log('Creating conversation with suggestions for selected files:', selectedFiles.map(f => f.name));

      // Create new conversation with suggestions
      const requestBody = selectedFiles.length === 1 
        ? { fileName: selectedFiles[0].name, title: `Conversation about ${selectedFiles[0].name}` }
        : { fileNames: selectedFiles.map(f => f.name), title: `Conversation about ${selectedFiles.length} files` };

      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.conversation) {
          console.log('Created conversation with suggestions:', data.conversation);
          
          // DON'T set activeConversationId yet - let ChatBox handle it internally
          // The conversation exists in backend but not in our frontend list
          // Stay in new conversation mode until first message is sent
          
          // Return the conversation so ChatBox can use it
          return data.conversation;
        }
      } else {
        const errorData = await response.text();
        console.error('Failed to create conversation:', response.statusText, errorData);
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  };

  const handleConversationUpdated = (conversationId, updates) => {
    // Check if this conversation exists in our list
    const existingConv = conversations.find(conv => conv.id === conversationId);
    
    if (existingConv) {
      // Update existing conversation
      setConversations(prev => prev.map(conv => 
        conv.id === conversationId 
          ? { ...conv, ...updates }
          : conv
      ));
    } else if (updates.messageCount && updates.messageCount > 0) {
      // First message sent - add conversation to list now
      setConversations(prev => [{
        id: conversationId,
        ...updates
      }, ...prev]);
      
      // Set this as the active conversation
      setActiveConversationId(conversationId);
    }
    
    // Exit new conversation mode when first message is sent (messageCount > 0)
    if (isInNewConversationMode && updates.messageCount && updates.messageCount > 0) {
      setIsInNewConversationMode(false);
    }
  };

  const handleConversationRename = async (conversationId, newTitle) => {
    try {
      // Get authentication headers (handles local development bypass)
      const authHeaders = await getAuthHeaders();

      await axios.put(`/api/conversations/${conversationId}`, 
        { title: newTitle },
        {
          headers: authHeaders,
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
      // Get authentication headers (handles local development bypass)
      const authHeaders = await getAuthHeaders();

      await axios.delete(`/api/conversations/${conversationId}`, {
        headers: authHeaders,
        timeout: 10000
      });

      // Update local state
      setConversations(prev => prev.filter(conv => conv.id !== conversationId));
      
      // Clear active conversation if it was deleted and reset to initial state
      if (activeConversationId === conversationId) {
        setActiveConversationId(null);
        setSelectedFileIds([]);
        setIsInNewConversationMode(false);
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
      alert(`Failed to delete conversation: ${err.response?.data?.error || err.message}`);
    }
  };


  const handleFileDownload = async (file) => {
    try {
      // Get authentication headers (handles local development bypass)
      const authHeaders = await getAuthHeaders();
      
      // Request download SAS token from backend
      const response = await axios.get(`/api/files/${encodeURIComponent(file.name)}/sas`, {
        headers: authHeaders,
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

  // Get the currently selected files data
  const selectedFilesData = uploadedFiles.filter(file => selectedFileIds.includes(file.name));

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
    <div className="full-height-layout bg-background-cream">
      {/* Header */}
      <header className="bg-gradient-to-r from-background-warm-white to-background-cream shadow-sm border-b border-gray-200 z-50 backdrop-blur-sm bg-opacity-95 sticky-header">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-0 sm:py-1">
          <div className="flex items-center justify-between">
                <div className="flex items-center min-w-0 flex-1">
                  {/* Main Takt Logo */}
                  <img 
                    src="/logo-takt.png" 
                    alt="Takt" 
                    className="h-14 sm:h-16 w-auto"
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full min-h-0">
          {/* Conversations Column - Dynamic width based on collapse */}
          <div className={`h-full overflow-y-auto min-h-0 ${conversationsCollapsed ? 'lg:col-span-1' : 'lg:col-span-3'} transition-all duration-300`}>
            <ConversationsPanel 
              uploadedFiles={uploadedFiles}
              selectedFileIds={selectedFileIds}
              conversations={conversations}
              activeConversationId={activeConversationId}
              onConversationSelected={handleConversationSelected}
              onConversationCreated={handleConversationCreated}
              onConversationRename={handleConversationRename}
              onConversationDelete={handleConversationDelete}
              conversationsLoading={conversationsLoading}
              isCollapsed={conversationsCollapsed}
              onToggleCollapse={setConversationsCollapsed}
            />
          </div>
          
          {/* Chat Column - Dynamic width based on both collapses */}
          <div className={`h-full overflow-y-auto min-h-0 ${
            conversationsCollapsed && sourcesCollapsed ? 'lg:col-span-10' :
            conversationsCollapsed ? 'lg:col-span-8' :
            sourcesCollapsed ? 'lg:col-span-8' :
            'lg:col-span-6'
          } transition-all duration-300`}>
            <ChatBox 
              fileData={selectedFilesData} 
              className="h-full"
              conversationId={activeConversationId}
              onConversationCreated={handleConversationCreated}
              onConversationUpdated={handleConversationUpdated}
              selectedFileIds={selectedFileIds}
              onStartConversation={handleStartConversation}
              isNewConversationMode={isInNewConversationMode}
            />
          </div>
          
          {/* Sources Column - Dynamic width based on collapse */}
          <div className={`h-full overflow-y-auto min-h-0 ${sourcesCollapsed ? 'lg:col-span-1' : 'lg:col-span-3'} transition-all duration-300`}>
            <SourcesPanel 
              onFileUploaded={handleFileUploaded}
              uploadedFiles={uploadedFiles}
              selectedFileIds={selectedFileIds}
              onFileSelected={handleFileSelected}
              onFileDownload={handleFileDownload}
              onFileDeleted={handleFileDeleted}
              isCollapsed={sourcesCollapsed}
              onToggleCollapse={setSourcesCollapsed}
              filesLoading={filesLoading}
              isFilesLocked={false}
              activeConversation={conversations.find(conv => conv.id === activeConversationId)}
              isInNewConversationMode={isInNewConversationMode}
            />
          </div>
        </div>

      </main>
    </div>
  );
}

export default App;
