import React, { useState } from 'react';

const ConversationItem = ({ 
  conversation, 
  isActive, 
  onSelect, 
  onRename, 
  onDelete
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(conversation.title || '');

  const handleRename = () => {
    if (newTitle.trim() && newTitle !== conversation.title) {
      onRename(conversation.id, newTitle.trim());
    }
    setIsRenaming(false);
    setIsMenuOpen(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleRename();
    } else if (e.key === 'Escape') {
      setNewTitle(conversation.title || '');
      setIsRenaming(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getStatusIcon = () => {
    if (conversation.status === 'archived') {
      return (
        <div className="w-2 h-2 bg-amber-400 rounded-full" title="Archived" />
      );
    }
    
    return (
      <div className="w-2 h-2 bg-green-400 rounded-full" title="Active" />
    );
  };

  return (
    <div className="relative">
      {isRenaming ? (
        <div className="p-2 rounded-card border border-transparent bg-transparent">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onBlur={handleRename}
            onKeyPress={handleKeyPress}
            className="w-full body-small font-medium bg-white border border-primary-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : (
        <div
          className={`p-2 rounded-card border border-transparent transition-colors cursor-pointer ${
            isActive
              ? 'bg-primary-50'
              : 'bg-transparent hover:bg-background-warm-white'
          }`}
          onClick={() => onSelect(conversation)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              {/* Status indicator */}
              <div className="flex-shrink-0">
                {getStatusIcon()}
              </div>
              
              {/* Title */}
              <div className="flex-1 min-w-0">
                <p className="body-small font-medium truncate text-text-primary">
                  {conversation.title || 'Untitled Conversation'}
                </p>
              </div>
              
              {/* Time */}
              <div className="flex-shrink-0">
                <span className="body-xs text-text-secondary">
                  {formatDate(conversation.updatedAt)}
                </span>
              </div>
            </div>
            
            {/* Context menu button */}
            <div className="flex items-center space-x-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMenuOpen(!isMenuOpen);
                }}
                className="p-2 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                title="More options"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Context menu */}
      {isMenuOpen && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-card border border-gray-200 warm-shadow z-10">
          <div className="py-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsRenaming(true);
                setIsMenuOpen(false);
              }}
              className="w-full px-3 py-2 text-left body-small text-text-primary hover:bg-gray-50 flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span>Rename</span>
            </button>
            
            {/* Delete option */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm('Are you sure you want to delete this conversation?')) {
                  onDelete(conversation.id);
                }
                setIsMenuOpen(false);
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

      {/* Click outside to close menu */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setIsMenuOpen(false)}
        />
      )}
    </div>
  );
};

export default ConversationItem;
