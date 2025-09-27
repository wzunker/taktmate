import React, { useState } from 'react';
import Card, { CardHeader, CardContent } from './Card';
import ConversationItem from './ConversationItem';
import { getAuthHeaders } from '../utils/auth';

const ConversationsPanel = ({ 
  uploadedFiles = [],
  selectedFileIds = [],
  conversations = [],
  activeConversationId,
  onConversationSelected,
  onConversationCreated,
  onConversationRename,
  onConversationDelete,
  conversationsLoading = false,
  isCollapsed,
  onToggleCollapse
}) => {

  // Check if all files for a conversation exist (for enabling/disabling)
  const hasAllRequiredFiles = (conversation) => {
    const convFileNames = conversation.fileNames || [conversation.fileName];
    return convFileNames.every(fileName => 
      uploadedFiles.some(file => file.name === fileName)
    );
  };

  // Get all conversations sorted by most recent
  const getAllConversations = () => {
    return conversations
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  };

  const handleCreateNewConversation = () => {
    // Clear active conversation and start fresh - don't actually create a conversation yet
    // This allows users to select files first, then click Start in the ChatBox
    if (onConversationSelected) {
      onConversationSelected(null); // This will clear the active conversation and file selection
    }
  };

  const displayConversations = getAllConversations();

  return (
    <Card className="h-full flex flex-col">
      <CardHeader
        title={!isCollapsed ? <span className="text-secondary-600 font-semibold lowercase">conversations</span> : null}
        action={
          <button
            onClick={() => onToggleCollapse(!isCollapsed)}
            className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
            title={isCollapsed ? "Expand conversations" : "Collapse conversations"}
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
        <CardContent className="flex-1 flex flex-col min-h-0">
          {/* New Conversation Button - Full Width */}
          <button
            onClick={handleCreateNewConversation}
            className="w-full bg-primary-600 text-white px-4 py-2.5 rounded-button body-small font-medium hover:bg-primary-700 transition-colors warm-shadow mb-4"
            title="Start a new conversation"
          >
            new conversation
          </button>

          {/* Conversations List */}
          <div className="flex-1 min-h-0">
            <div className="space-y-2 h-full overflow-y-auto mobile-scrollbar">
              {conversationsLoading ? (
                <div className="flex items-center justify-center py-6">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mr-2"></div>
                  <span className="body-small text-text-muted">Loading conversations...</span>
                </div>
              ) : displayConversations.length > 0 ? (
                displayConversations.map((conversation) => (
                  <ConversationItem
                    key={conversation.id}
                    conversation={conversation}
                    isActive={conversation.id === activeConversationId}
                    onSelect={onConversationSelected}
                    onRename={onConversationRename}
                    onDelete={onConversationDelete}
                    hasValidFile={hasAllRequiredFiles(conversation)}
                  />
                )) 
              ) : (
                <div className="text-center py-8">
                  <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <h3 className="heading-5 text-text-secondary mb-2">no conversations</h3>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
};

export default ConversationsPanel;
