import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getAuthHeaders } from '../utils/auth';
import Card, { CardHeader, CardContent } from './Card';
import useAuth from '../hooks/useAuth';

// Try to load debug config (local only, not in git)
let SHOW_DEBUG_INFO = false;
try {
  const debugConfig = require('../debug.config.js');
  SHOW_DEBUG_INFO = debugConfig.SHOW_DEBUG_INFO;
  if (SHOW_DEBUG_INFO) console.log('🐛 Debug mode enabled');
} catch (e) {
  // debug.config.js doesn't exist, that's fine
}

const ChatBox = ({ 
  fileData, 
  className = '', 
  conversationId = null,
  onConversationCreated,
  onConversationUpdated,
  selectedFileIds = [],
  onStartConversation,
  isNewConversationMode = false
}) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [typingDots, setTypingDots] = useState(0);
  const [messageCount, setMessageCount] = useState(0);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [startingConversation, setStartingConversation] = useState(false);
  const [hasActivatedInput, setHasActivatedInput] = useState(false);
  const [debugDropdownOpen, setDebugDropdownOpen] = useState({});
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const { displayName } = useAuth();

  // Get user initials for avatar
  const getUserInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(part => part.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Handle suggestion click
  const handleSuggestionClick = async (suggestion) => {
    if (sending || !fileData) return;

    // Clear suggestions immediately since we're about to send the first message
    setSuggestions([]);
    setSending(true);

    // Add user message to chat with timestamp
    const userMessageObj = { 
      type: 'user', 
      content: suggestion,
      timestamp: new Date().toISOString()
    };
    
    const newMessages = [...messages, userMessageObj];
    setMessages(newMessages);
    setMessageCount(prev => prev + 1);

    try {
      // Get authentication headers (handles local development bypass)
      const authHeaders = await getAuthHeaders();
      
      // Prepare request body for single or multiple files
      let requestBody;
      if (Array.isArray(fileData)) {
        if (fileData.length === 1) {
          // Single file in array - use fileName for backward compatibility
          requestBody = {
            fileName: fileData[0].name || fileData[0].filename,
            message: suggestion,
            conversationId: currentConversationId
          };
        } else {
          // Multiple files - use fileNames array
          requestBody = {
            fileNames: fileData.map(file => file.name || file.filename),
            message: suggestion,
            conversationId: currentConversationId
          };
        }
      } else {
        // Single file object (backward compatibility)
        requestBody = {
          fileName: fileData.name || fileData.filename,
          message: suggestion,
          conversationId: currentConversationId
        };
      }
      
      // Call backend with auth headers
      const response = await axios.post('/api/chat', requestBody, {
        headers: authHeaders,
        timeout: 30000
      });

      if (response.data.success) {
        const assistantMessage = { 
          type: 'assistant', 
          content: response.data.reply,
          timestamp: new Date().toISOString()
        };
        
        // Add debug info if available
        if (response.data.debug) {
          assistantMessage.debug = response.data.debug;
        }
        
        setMessages(prev => [...prev, assistantMessage]);
        setMessageCount(prev => prev + 1);

        // Handle conversation updates - notify parent to add/update conversation
        if (response.data.conversationId && onConversationUpdated) {
          const updates = {
            updatedAt: new Date().toISOString(),
            messageCount: messageCount + 1,
            title: response.data.title || (Array.isArray(fileData) 
              ? `Conversation about ${fileData.length} files`
              : `Conversation about ${fileData.name || fileData.filename}`),
            fileNames: Array.isArray(fileData) 
              ? fileData.map(f => f.name || f.filename)
              : [fileData.name || fileData.filename]
          };
          
          onConversationUpdated(response.data.conversationId, updates);
        }
      } else {
        throw new Error(response.data.error || 'Invalid response from server');
      }
    } catch (err) {
      let errorMessage = '❌ I apologize, but I encountered an error processing your request.';
      
      if (err.code === 'ECONNABORTED') {
        errorMessage = '⏱️ The request timed out. Please try asking a simpler question or try again.';
      } else if (err.response?.status === 429) {
        errorMessage = '🚦 Too many requests. Please wait a moment before asking another question.';
      } else if (err.response?.data?.error) {
        errorMessage = `🤖 ${err.response.data.error}`;
      } else if (err.message) {
        errorMessage = `⚠️ ${err.message}`;
      }
      
      setMessages(prev => [...prev, { 
        type: 'error', 
        content: errorMessage,
        timestamp: new Date().toISOString()
      }]);
      setMessageCount(prev => prev + 1);
    } finally {
      setSending(false);
    }
  };

  // Load conversation history and suggestions
  const loadConversation = async (convId) => {
    if (!convId) return;
    
    setConversationLoading(true);
    try {
      // Get authentication headers (handles local development bypass)
      const authHeaders = await getAuthHeaders();

      // Fetch full conversation (includes messages and suggestions)
      const response = await axios.get(`/api/conversations/${convId}`, {
        headers: authHeaders,
        timeout: 10000
      });

      if (response.data.success && response.data.conversation) {
        const conversation = response.data.conversation;
        
        // Load messages
        const conversationMessages = (conversation.messages || []).map(msg => ({
          type: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content,
          timestamp: msg.timestamp
        }));
        
        setMessages(conversationMessages);
        setMessageCount(conversationMessages.length);
        setCurrentConversationId(convId);
        
        // Load suggestions (only if no messages exist yet)
        if (conversation.suggestions && conversationMessages.length === 0) {
          setSuggestions(conversation.suggestions);
          console.log('Loaded suggestions:', conversation.suggestions);
        } else {
          setSuggestions([]);
        }
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
      // Show error message in chat
      setMessages([{
        type: 'error',
        content: '❌ Failed to load conversation history. Please try again.',
        timestamp: new Date().toISOString()
      }]);
      setSuggestions([]);
    } finally {
      setConversationLoading(false);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Reset activation state when entering new conversation mode
  useEffect(() => {
    if (isNewConversationMode) {
      setHasActivatedInput(false);
    }
  }, [isNewConversationMode]);

  // Track previous file selection to detect actual changes
  const prevSelectedFileIdsRef = useRef(selectedFileIds);
  
  // Handle file selection changes in new conversation mode
  useEffect(() => {
    // Only act if we're in new conversation mode, no actual messages, AND files actually changed
    const filesChanged = JSON.stringify(prevSelectedFileIdsRef.current) !== JSON.stringify(selectedFileIds);
    
    if (isNewConversationMode && messageCount === 0 && filesChanged) {
      // Update ref for next comparison
      prevSelectedFileIdsRef.current = selectedFileIds;
      
      // If there's a backend conversation, delete it since we're discarding it
      if (currentConversationId) {
        const deleteConversation = async () => {
          try {
            const authHeaders = await getAuthHeaders();
            await axios.delete(`/api/conversations/${currentConversationId}`, {
              headers: authHeaders,
              timeout: 10000
            });
            console.log('Deleted temporary conversation:', currentConversationId);
          } catch (error) {
            console.error('Failed to delete temporary conversation:', error);
          }
        };
        
        deleteConversation();
      }
      
      // Always clear local state when files change
      setSuggestions([]);
      setHasActivatedInput(false);
      setStartingConversation(false);
      setCurrentConversationId(null);
    }
  }, [selectedFileIds, isNewConversationMode, messageCount, currentConversationId]);

  // Track previous conversationId to detect actual changes from parent
  const prevConversationIdRef = useRef(conversationId);
  
  // Load conversation when conversationId changes (from parent selecting a conversation)
  useEffect(() => {
    const prevConversationId = prevConversationIdRef.current;
    prevConversationIdRef.current = conversationId;
    
    if (conversationId && conversationId !== currentConversationId) {
      // Parent selected a conversation - load it
      loadConversation(conversationId);
      setHasActivatedInput(false);
    } else if (prevConversationId && !conversationId) {
      // Parent cleared conversation (was something, now null) - clear local state
      setCurrentConversationId(null);
      setMessages([]);
      setMessageCount(0);
      setSuggestions([]);
      setHasActivatedInput(false);
    }
  }, [conversationId, currentConversationId]);

  // Typing animation effect
  useEffect(() => {
    let interval;
    if (sending) {
      interval = setInterval(() => {
        setTypingDots(prev => (prev + 1) % 4);
      }, 500);
    } else {
      setTypingDots(0);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [sending]);


  // Handle starting a new conversation
  const handleStartConversation = async () => {
    if (!selectedFileIds || selectedFileIds.length === 0) return;
    
    setStartingConversation(true);
    try {
      if (onStartConversation) {
        await onStartConversation(selectedFileIds);
      }
    } catch (error) {
      console.error('Error starting conversation:', error);
    } finally {
      setStartingConversation(false);
    }
  };

  // Show centered input as default when no messages exist
  const hasSelectedFiles = selectedFileIds && selectedFileIds.length > 0;

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || sending || !fileData || (Array.isArray(fileData) && fileData.length === 0)) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setSending(true);

    // Clear suggestions if this is the first message
    if (suggestions.length > 0) {
      setSuggestions([]);
    }

    // Add user message to chat with timestamp
    const userMessageObj = { 
      type: 'user', 
      content: userMessage,
      timestamp: new Date().toISOString()
    };
    
    const newMessages = [...messages, userMessageObj];
    setMessages(newMessages);
    setMessageCount(prev => prev + 1);

    // Focus back to input after sending
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);

    try {
      // Get authentication headers (handles local development bypass)
      const authHeaders = await getAuthHeaders();
      
      // Prepare request body for single or multiple files
      let requestBody;
      if (Array.isArray(fileData)) {
        if (fileData.length === 1) {
          // Single file in array - use fileName for backward compatibility
          requestBody = {
            fileName: fileData[0].name || fileData[0].filename,
            message: userMessage,
            conversationId: currentConversationId
          };
        } else {
          // Multiple files - use fileNames array
          requestBody = {
            fileNames: fileData.map(file => file.name || file.filename),
            message: userMessage,
            conversationId: currentConversationId
          };
        }
      } else {
        // Single file object (backward compatibility)
        requestBody = {
          fileName: fileData.name || fileData.filename,
          message: userMessage,
          conversationId: currentConversationId
        };
      }
      
      // Call backend with auth headers
      const response = await axios.post('/api/chat', requestBody, {
        headers: authHeaders,
        timeout: 30000 // 30 second timeout for AI responses
      });

      if (response.data.success) {
        const assistantMessage = { 
          type: 'assistant', 
          content: response.data.reply,
          timestamp: new Date().toISOString()
        };
        
        // Add debug info if available
        if (response.data.debug) {
          assistantMessage.debug = response.data.debug;
        }
        
        setMessages(prev => [...prev, assistantMessage]);
        setMessageCount(prev => prev + 1);

        // Handle conversation updates - notify parent to add/update conversation
        if (response.data.conversationId && onConversationUpdated) {
          const updates = {
            updatedAt: new Date().toISOString(),
            messageCount: messageCount + 1,
            title: response.data.title || (Array.isArray(fileData) 
              ? `Conversation about ${fileData.length} files`
              : `Conversation about ${fileData.name || fileData.filename}`),
            fileNames: Array.isArray(fileData) 
              ? fileData.map(f => f.name || f.filename)
              : [fileData.name || fileData.filename]
          };
          
          onConversationUpdated(response.data.conversationId, updates);
        }
      } else {
        throw new Error(response.data.error || 'Invalid response from server');
      }
    } catch (err) {
      let errorMessage = '❌ I apologize, but I encountered an error processing your request.';
      
      if (err.code === 'ECONNABORTED') {
        errorMessage = '⏱️ The request timed out. Please try asking a simpler question or try again.';
      } else if (err.response?.status === 429) {
        errorMessage = '🚦 Too many requests. Please wait a moment before asking another question.';
      } else if (err.response?.data?.error) {
        errorMessage = `🤖 ${err.response.data.error}`;
      } else if (err.message) {
        errorMessage = `⚠️ ${err.message}`;
      }
      
      setMessages(prev => [...prev, { 
        type: 'error', 
        content: errorMessage,
        timestamp: new Date().toISOString()
      }]);
      setMessageCount(prev => prev + 1);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle input focus - triggers conversation creation with suggestions
  const handleInputFocus = async () => {
    // Only trigger if in new conversation mode, has selected files, hasn't been activated yet, and no current conversation
    if (isNewConversationMode && hasSelectedFiles && !hasActivatedInput && !currentConversationId && !startingConversation) {
      setHasActivatedInput(true);
      setStartingConversation(true);
      
      try {
        if (onStartConversation) {
          const conversation = await onStartConversation(selectedFileIds);
          
          if (conversation) {
            // Set the conversation ID locally (parent doesn't know about it yet)
            setCurrentConversationId(conversation.id);
            
            // Load suggestions directly from the returned conversation
            if (conversation.suggestions && conversation.suggestions.length > 0) {
              setSuggestions(conversation.suggestions);
              console.log('Loaded suggestions:', conversation.suggestions);
            }
          }
        }
      } catch (error) {
        console.error('Error starting conversation:', error);
        setHasActivatedInput(false); // Reset on error so they can try again
      } finally {
        setStartingConversation(false);
      }
    }
  };

  // Check if we should show centered input (no messages yet - always show unless loading)
  const showCenteredInput = messages.length === 0 && !conversationLoading;

  return (
    <Card variant="elevated" padding="sm" className={`flex flex-col h-full ${className}`}>


      {/* Messages */}
      <CardContent className={`flex-1 overflow-y-auto mobile-scrollbar px-2 sm:px-4 min-h-0 ${showCenteredInput ? 'flex items-center justify-center' : 'space-y-4 sm:space-y-6'}`}>
        {conversationLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mr-3"></div>
            <span className="body-normal text-text-secondary">Loading conversation...</span>
          </div>
        ) : (
          <>
        {/* Centered Input State - Show when no messages yet */}
        {showCenteredInput && (
          <div className="w-full max-w-2xl space-y-6">
            <div className="text-center">
              <h3 className="heading-1 text-primary-600 mb-3">
                Ready to explore together?
              </h3>
              {!hasSelectedFiles && (
                <p className="body-normal text-text-secondary">
                  upload or select at least one file to get started
                </p>
              )}
            </div>

            {/* Loading state for suggestions */}
            {startingConversation && suggestions.length === 0 && (
              <div className="flex justify-center py-8">
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-3 mb-4">
                    <div className="flex flex-col items-center">
                      <span className="body-normal text-text-primary font-medium">Preparing your conversation</span>
                      <span className="body-xs text-text-muted">Generating suggested questions...</span>
                    </div>
                  </div>
                  
                  {/* Animated dots */}
                  <div className="flex items-center justify-center space-x-2 mt-4">
                    <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}

            {/* Suggested Questions - Show between heading and input */}
            {suggestions.length > 0 && !startingConversation && (
              <div 
                className="space-y-3 animate-fade-in-up"
                role="region"
                aria-label="Suggested questions to get started"
              >
                <div className="text-center mb-4">
                  <h4 className="body-normal text-text-secondary font-medium">
                    Get started with these questions:
                  </h4>
                </div>
                
                {/* Suggestion buttons with staggered animation */}
                <div className="space-y-3">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion)}
                      disabled={sending}
                      className={`
                        group relative block w-full text-left px-5 py-4 
                        bg-gradient-to-r from-background-warm-white to-primary-25
                        border border-gray-200 rounded-lg
                        hover:border-primary-300 hover:from-primary-50 hover:to-primary-100
                        focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
                        transform transition-all duration-300 ease-out
                        hover:scale-[1.02] hover:-translate-y-0.5
                        disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none
                        warm-shadow hover:warm-shadow-lg
                        animate-fade-in-up
                      `}
                      style={{ animationDelay: `${index * 150}ms` }}
                      aria-label={`Ask: ${suggestion}`}
                      tabIndex={0}
                    >
                      {/* Gradient overlay on hover */}
                      <div className="absolute inset-0 bg-gradient-to-r from-primary-100/0 via-primary-100/20 to-primary-200/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg"></div>
                      
                      <div className="relative flex items-start space-x-4">
                        <div className="flex-shrink-0 mt-1">
                          <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center group-hover:bg-primary-200 transition-colors duration-200">
                            <svg className="w-4 h-4 text-primary-600 group-hover:text-primary-700 transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="body-normal text-text-primary leading-relaxed group-hover:text-text-primary font-medium transition-all duration-200">
                            {suggestion}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Centered Input */}
            <div className="flex items-start space-x-3">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  onFocus={handleInputFocus}
                  placeholder={hasSelectedFiles ? "Looks delicious, let me know how I can help..." : "I'm hungry for data..."}
                  className="w-full border border-gray-300 rounded-input px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent body-normal resize-none transition-all duration-200"
                  disabled={sending || !hasSelectedFiles}
                  rows="1"
                  style={{ minHeight: '48px', maxHeight: '150px' }}
                  onInput={(e) => {
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
                  }}
                />
                
                {/* Character Count */}
                {inputMessage.length > 100 && (
                  <div className="absolute bottom-2 right-12 body-xs text-text-muted">
                    {inputMessage.length}/500
                  </div>
                )}
              </div>
              
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || sending || inputMessage.length > 500 || !hasSelectedFiles}
                className="bg-primary-600 text-white px-4 py-3 rounded-button hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-200 warm-shadow hover:warm-shadow-lg flex-shrink-0 h-12"
                title={!hasSelectedFiles ? "Select a file first" : !inputMessage.trim() ? "Enter a message" : sending ? "Sending..." : "Send message"}
              >
                {sending ? (
                  <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <div key={index} className="w-full flex justify-center">
            <div className={`w-full max-w-3xl px-8 ${message.type === 'user' ? 'flex justify-end' : ''}`}>
              {message.type === 'user' ? (
                /* User Message - Bubble with Avatar */
                <div className="max-w-xs sm:max-w-lg px-3 sm:px-4 py-2 sm:py-3 rounded-card transition-all duration-200 flex items-start space-x-2 bg-primary-50 text-text-primary border border-primary-200 warm-shadow flex-row-reverse space-x-reverse rounded-tr-sm">
                  {/* Avatar inside bubble */}
                  <div className="flex-shrink-0">
                    <div className="w-9 h-9 bg-primary-200 rounded-md flex items-center justify-center">
                      <span className="text-primary-700 text-sm font-medium">
                        {getUserInitials(displayName)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Message Content */}
                  <div className="flex-1 min-w-0">
                    <div className="body-small sm:body-normal whitespace-pre-wrap leading-relaxed">
                      {message.content}
                    </div>
                  </div>
                </div>
              ) : message.type === 'error' ? (
                /* Error Message - Bubble */
                <div className="w-full px-3 sm:px-4 py-2 sm:py-3 rounded-card transition-all duration-200 bg-red-50 text-red-800 border border-red-200 warm-shadow">
                  <div className="flex items-start space-x-2">
                    <div className="flex-shrink-0">
                      <div className="w-9 h-9 bg-red-200 rounded-md flex items-center justify-center">
                        <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="body-small sm:body-normal whitespace-pre-wrap leading-relaxed">
                        {message.content}
                      </div>
                    </div>
                  </div>
                </div>
              ) : message.type === 'system' ? (
                /* System Message - Bubble */
                <div className="w-full px-3 sm:px-4 py-2 sm:py-3 rounded-card transition-all duration-200 bg-secondary-50 text-secondary-800 border border-secondary-200 warm-shadow">
                  <div className="flex items-start space-x-2">
                    <div className="flex-shrink-0">
                      <div className="w-9 h-9 bg-secondary-200 rounded-md flex items-center justify-center">
                        <svg className="w-5 h-5 text-secondary-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="body-small sm:body-normal whitespace-pre-wrap leading-relaxed">
                        {message.content}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Assistant Message - Full Width Document Style with Markdown */
                <div className="w-full py-2 text-text-primary prose prose-sm max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      // Headings
                      h1: ({node, ...props}) => <h1 className="text-2xl font-bold text-text-primary mt-6 mb-4" {...props} />,
                      h2: ({node, ...props}) => <h2 className="text-xl font-semibold text-text-primary mt-5 mb-3" {...props} />,
                      h3: ({node, ...props}) => <h3 className="text-lg font-semibold text-text-primary mt-4 mb-2" {...props} />,
                      // Paragraphs
                      p: ({node, ...props}) => <p className="body-normal text-text-primary leading-relaxed mb-3" {...props} />,
                      // Strong/Bold
                      strong: ({node, ...props}) => <strong className="font-semibold text-text-primary" {...props} />,
                      // Lists
                      ul: ({node, ...props}) => <ul className="list-disc list-outside pl-6 mb-3 space-y-1" {...props} />,
                      ol: ({node, ...props}) => <ol className="list-decimal list-outside pl-6 mb-3 space-y-1" {...props} />,
                      li: ({node, ...props}) => <li className="body-normal text-text-primary leading-normal" {...props} />,
                      // Tables
                      table: ({node, ...props}) => (
                        <div className="overflow-x-auto my-4">
                          <table className="min-w-full border-collapse border border-gray-300" {...props} />
                        </div>
                      ),
                      thead: ({node, ...props}) => <thead className="bg-gray-100" {...props} />,
                      tbody: ({node, ...props}) => <tbody {...props} />,
                      tr: ({node, ...props}) => <tr className="border-b border-gray-300" {...props} />,
                      th: ({node, ...props}) => <th className="border border-gray-300 px-4 py-2 text-left font-semibold text-text-primary bg-gray-50" {...props} />,
                      td: ({node, ...props}) => <td className="border border-gray-300 px-4 py-2 body-normal text-text-primary" {...props} />,
                      // Code
                      code: ({node, inline, ...props}) => 
                        inline ? (
                          <code className="bg-gray-100 text-text-primary px-1.5 py-0.5 rounded text-sm font-mono" {...props} />
                        ) : (
                          <code className="block bg-gray-100 text-text-primary p-3 rounded text-sm font-mono overflow-x-auto mb-3" {...props} />
                        ),
                      // Links
                      a: ({node, ...props}) => <a className="text-primary-600 hover:text-primary-700 underline" {...props} />,
                      // Blockquotes
                      blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-gray-300 pl-4 italic text-text-secondary my-3" {...props} />,
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                  
                  {/* Debug Dropdown - Only visible if debug config enabled and debug info present */}
                  {SHOW_DEBUG_INFO && message.debug && (
                    <div className="mt-4 border-t border-gray-200 pt-4">
                      <button
                        onClick={() => setDebugDropdownOpen(prev => ({
                          ...prev,
                          [index]: !prev[index]
                        }))}
                        className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 font-mono mb-2"
                      >
                        <span>{debugDropdownOpen[index] ? '▼' : '▶'}</span>
                        <span>Info</span>
                      </button>
                      
                      {debugDropdownOpen[index] && (
                        <div className="bg-gray-50 rounded p-4 text-xs font-mono space-y-4 overflow-x-auto">
                          {/* User Message */}
                          <div>
                            <div className="font-bold text-gray-700 mb-2">User Message:</div>
                            <div className="bg-white p-2 rounded border border-gray-200">
                              {message.debug.userMessage}
                            </div>
                          </div>
                          
                          {/* System Prompt */}
                          <div>
                            <div className="font-bold text-gray-700 mb-2">System Prompt Sent to OpenAI:</div>
                            <div className="bg-white p-2 rounded border border-gray-200 max-h-96 overflow-y-auto whitespace-pre-wrap">
                              {message.debug.promptSent}
                            </div>
                          </div>
                          
                          {/* OpenAI Response */}
                          <div>
                            <div className="font-bold text-gray-700 mb-2">Full OpenAI Response:</div>
                            <div className="bg-white p-2 rounded border border-gray-200 max-h-96 overflow-y-auto">
                              <pre>{JSON.stringify(message.debug.openaiResponse, null, 2)}</pre>
                            </div>
                          </div>
                          
                          {/* Parsed Reply */}
                          <div>
                            <div className="font-bold text-gray-700 mb-2">Parsed Reply:</div>
                            <div className="bg-white p-2 rounded border border-gray-200 whitespace-pre-wrap">
                              {message.debug.parsedReply}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div className="w-full flex justify-center">
            <div className="w-full max-w-3xl px-8">
              <div className="py-2">
                {/* Typing Indicator - Document Style (No Bubble, No Icon) */}
                <div className="flex items-center space-x-2">
                  <span className="body-normal text-text-secondary">Analyzing your data</span>
                  <div className="flex space-x-1">
                    <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 bg-primary-400 rounded-full transition-opacity duration-300 ${typingDots >= 1 ? 'opacity-100' : 'opacity-30'}`}></div>
                    <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 bg-primary-400 rounded-full transition-opacity duration-300 ${typingDots >= 2 ? 'opacity-100' : 'opacity-30'}`}></div>
                    <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 bg-primary-400 rounded-full transition-opacity duration-300 ${typingDots >= 3 ? 'opacity-100' : 'opacity-30'}`}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* No Files Selected in Active Conversation */}
        {messages.length > 0 && (!fileData || (Array.isArray(fileData) && fileData.length === 0)) && (
          <div className="flex justify-center py-8">
            <div className="bg-primary-50 border-2 border-primary-200 rounded-card px-6 py-4 max-w-md warm-shadow">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="body-normal font-semibold text-text-primary mb-1">
                    No files selected
                  </h4>
                  <p className="body-small text-text-secondary">
                    Please select at least one file to continue chatting.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
          </>
        )}
      </CardContent>

              {/* Enhanced Input Area - Hide when showing centered input */}
              {!showCenteredInput && (
              <div className="pt-3 sm:pt-4 border-t border-transparent mt-4">
                {/* Centered Input Container */}
                <div className="w-full flex justify-center">
                  <div className="w-full max-w-3xl px-8">
                    {/* Input Row */}
                    <div className="flex items-start space-x-2 sm:space-x-3">
                      <div className="flex-1 relative">
                        <textarea
                          ref={inputRef}
                          value={inputMessage}
                          onChange={(e) => setInputMessage(e.target.value)}
                          onKeyPress={handleKeyPress}
                          onFocus={handleInputFocus}
                          placeholder={!fileData ? "Select a file to start chatting..." : "What would you like to investigate next?"}
                          className="w-full border border-gray-300 rounded-input px-3 sm:px-4 py-2 sm:py-3 pr-10 sm:pr-12 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent body-small sm:body-normal resize-none transition-all duration-200"
                          disabled={sending || !fileData}
                          rows="1"
                          style={{ minHeight: '40px', maxHeight: '150px' }}
                          onInput={(e) => {
                            e.target.style.height = 'auto';
                            e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
                          }}
                        />
                        
                        {/* Character Count */}
                        {inputMessage.length > 100 && (
                          <div className="absolute bottom-1 right-10 sm:right-12 body-xs text-text-muted">
                            {inputMessage.length}/500
                          </div>
                        )}
                      </div>
                      
                      <button
                        onClick={handleSendMessage}
                        disabled={!inputMessage.trim() || sending || inputMessage.length > 500 || !fileData}
                        className="bg-primary-600 text-white px-3 sm:px-4 py-2 sm:py-3 rounded-button hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-200 warm-shadow hover:warm-shadow-lg flex-shrink-0 min-w-[44px] h-10 sm:h-12"
                        title={!fileData ? "Select a file first" : !inputMessage.trim() ? "Enter a message" : sending ? "Sending..." : "Send message"}
                      >
                        {sending ? (
                          <svg className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              )}
    </Card>
  );
};

export default ChatBox;
