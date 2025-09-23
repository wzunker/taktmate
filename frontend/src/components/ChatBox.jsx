import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import Card, { CardHeader, CardContent } from './Card';
import useAuth from '../hooks/useAuth';

const ChatBox = ({ 
  fileData, 
  className = '', 
  conversationId = null,
  onConversationCreated,
  onConversationUpdated 
}) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [typingDots, setTypingDots] = useState(0);
  const [messageCount, setMessageCount] = useState(0);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState(null);
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

  // Load conversation history
  const loadConversation = async (convId) => {
    if (!convId) return;
    
    setConversationLoading(true);
    try {
      // Get auth info from SWA
      const authResponse = await fetch('/.auth/me');
      const authData = await authResponse.json();
      
      if (!authData.clientPrincipal) {
        console.error('No authentication data available');
        return;
      }

      // Fetch conversation history
      const response = await axios.get(`/api/conversations/${convId}/messages`, {
        headers: {
          'x-ms-client-principal': btoa(JSON.stringify(authData.clientPrincipal))
        },
        timeout: 10000
      });

      if (response.data.success) {
        const conversationMessages = response.data.messages.map(msg => ({
          type: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content,
          timestamp: msg.timestamp
        }));
        
        setMessages(conversationMessages);
        setMessageCount(conversationMessages.length);
        setCurrentConversationId(convId);
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
      // Show error message in chat
      setMessages([{
        type: 'error',
        content: '❌ Failed to load conversation history. Please try again.',
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setConversationLoading(false);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load conversation when conversationId changes
  useEffect(() => {
    if (conversationId && conversationId !== currentConversationId) {
      loadConversation(conversationId);
    } else if (!conversationId && currentConversationId) {
      // Clear conversation when no conversation is selected
      setCurrentConversationId(null);
      setMessages([]);
      setMessageCount(0);
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

  useEffect(() => {
    // Welcome message when file is uploaded (only if no conversation is loaded)
    if (fileData && (fileData.filename || fileData.name) && fileData.headers && !currentConversationId) {
      const fileName = fileData.filename || fileData.name;
      const rowCount = fileData.rowCount || 'unknown';
      const columnCount = Array.isArray(fileData.headers) ? fileData.headers.length : 'unknown';
      const columns = Array.isArray(fileData.headers) ? fileData.headers.slice(0, 5).join(', ') + (fileData.headers.length > 5 ? '...' : '') : 'unknown';
      
      setMessages([{
        type: 'system',
        content: `🎉 Welcome! I've loaded your CSV file "${fileName}". Here's what I can see:\n\n📊 **Dataset Overview:**\n• ${rowCount} rows of data\n• ${columnCount} columns\n• Key columns: ${columns}\n\n💬 **What can I help you with?**\nAsk me to analyze trends, find patterns, calculate statistics, or answer any questions about your data!`,
        timestamp: new Date().toISOString()
      }]);
      setMessageCount(1);
    } else if (!fileData && !currentConversationId) {
      setMessages([]);
      setMessageCount(0);
    }
  }, [fileData, currentConversationId]);

  // Don't render if no file is selected or if fileData is invalid
  if (!fileData || typeof fileData !== 'object') {
    return (
      <Card variant="elevated" className={`flex flex-col h-full ${className}`}>
        <CardHeader
          title={<span className="text-secondary-600 font-semibold lowercase">taktmate</span>}
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 mx-auto mb-4 bg-primary-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="body-small text-text-secondary mb-4">upload and select your files to start an intelligent conversation with your data</p>
            <div className="flex items-center justify-center space-x-4 body-xs text-text-muted">
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-primary-400 rounded-full"></div>
                <span>ask questions</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-secondary-400 rounded-full"></div>
                <span>get insights</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-primary-400 rounded-full"></div>
                <span>analyze trends</span>
              </div>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || sending || !fileData) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setSending(true);

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
      // Get auth info from SWA
      const authResponse = await fetch('/.auth/me');
      const authData = await authResponse.json();
      
      if (!authData.clientPrincipal) {
        setMessages(prev => [...prev, { 
          type: 'error', 
          content: '🔒 Authentication required. Please refresh the page and log in.',
          timestamp: new Date().toISOString()
        }]);
        return;
      }
      
      // Call backend directly with SWA auth data
      const response = await axios.post('/api/chat', {
        fileName: fileData.name || fileData.filename,
        message: userMessage,
        conversationId: currentConversationId // Include conversation context
      }, {
        headers: {
          'Content-Type': 'application/json',
          'x-ms-client-principal': btoa(JSON.stringify(authData.clientPrincipal))
        },
        timeout: 30000 // 30 second timeout for AI responses
      });

      if (response.data.success) {
        setMessages(prev => [...prev, { 
          type: 'assistant', 
          content: response.data.reply,
          timestamp: new Date().toISOString()
        }]);
        setMessageCount(prev => prev + 1);

        // Handle conversation creation/updates
        if (response.data.conversationId) {
          if (!currentConversationId) {
            // New conversation created
            setCurrentConversationId(response.data.conversationId);
            if (onConversationCreated) {
              onConversationCreated(response.data.conversation || {
                id: response.data.conversationId,
                fileName: fileData.name || fileData.filename,
                title: response.data.title || 'New Conversation',
                updatedAt: new Date().toISOString()
              });
            }
          } else if (onConversationUpdated) {
            // Existing conversation updated
            onConversationUpdated(response.data.conversationId, {
              title: response.data.title,
              updatedAt: new Date().toISOString(),
              messageCount: messageCount + 1
            });
          }
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

  if (!fileData) {
    return (
      <Card>
        <div className="text-center">
          <div className="text-4xl mb-4">💬</div>
          <h3 className="heading-5 mb-2 text-text-secondary">Ready to Chat</h3>
          <p className="body-normal text-text-muted">Upload a CSV file to start chatting with your data</p>
        </div>
      </Card>
    );
  }

  return (
    <Card variant="elevated" padding="sm" className={`flex flex-col h-full ${className}`}>
            <CardHeader
                title={
          <div className="flex items-center space-x-2">
            <span className="text-secondary-600 font-semibold lowercase">taktmate</span>
            {currentConversationId && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
                conversation
              </span>
            )}
          </div>
        }
        action={
          messageCount > 0 && (
            <span className="body-xs text-text-muted">
              {currentConversationId ? 
                `${messageCount} message${messageCount !== 1 ? 's' : ''}` :
                `${messageCount - 1} message${messageCount - 1 !== 1 ? 's' : ''}`
              }
            </span>
          )
        }
        className="mb-4"
      />

      {/* Messages */}
      <CardContent className="flex-1 overflow-y-auto space-y-4 sm:space-y-6 px-2 sm:px-4">
        {conversationLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mr-3"></div>
            <span className="body-normal text-text-secondary">Loading conversation...</span>
          </div>
        ) : (
          <>
        {messages.map((message, index) => (
          <div key={index} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
            {/* Message Bubble with Avatar Inside */}
              <div
                className={`max-w-xs sm:max-w-lg px-3 sm:px-4 py-2 sm:py-3 rounded-card transition-all duration-200 flex items-start space-x-2 ${
              message.type === 'user'
                  ? 'bg-primary-600 text-background-cream warm-shadow flex-row-reverse space-x-reverse'
                  : message.type === 'error'
                  ? 'bg-red-50 text-red-800 border border-red-200 warm-shadow'
                  : message.type === 'system'
                  ? 'bg-secondary-50 text-secondary-800 border border-secondary-200 warm-shadow'
                  : 'bg-background-warm-white text-text-primary border border-gray-200 warm-shadow'
              } ${message.type === 'user' ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
            >
              {/* Avatar inside bubble */}
              <div className="flex-shrink-0">
                {message.type === 'user' ? (
                  <div className="w-9 h-9 bg-white bg-opacity-20 rounded-md flex items-center justify-center">
                    <span className="text-white text-sm font-medium">
                      {getUserInitials(displayName)}
                    </span>
                  </div>
                ) : message.type === 'system' ? (
                  <div className="w-9 h-9 bg-secondary-200 rounded-md flex items-center justify-center">
                    <svg className="w-5 h-5 text-secondary-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                ) : message.type === 'error' ? (
                  <div className="w-9 h-9 bg-red-200 rounded-md flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                ) : (
                  <div className="w-9 h-9 bg-primary-100 rounded-md flex flex-col items-center justify-center px-1">
                    {/* Simple text logo - centered */}
                    <div className="text-primary-600 text-xs font-bold leading-tight text-center">
                      <div>takt</div>
                      <div>mate</div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Message Content */}
              <div className="flex-1 min-w-0">
                <div className="body-small sm:body-normal whitespace-pre-wrap leading-relaxed">
                  {message.content}
                </div>
              </div>
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            {/* Typing Indicator Bubble with Avatar Inside */}
            <div className="bg-background-warm-white text-text-primary px-3 sm:px-4 py-2 sm:py-3 rounded-card rounded-tl-sm border border-gray-200 warm-shadow flex items-start space-x-2">
              {/* Avatar inside bubble */}
              <div className="flex-shrink-0">
                <div className="w-9 h-9 bg-primary-100 rounded-md flex flex-col items-center justify-center px-1">
                  {/* Simple text logo with pulse - centered */}
                  <div className="text-primary-600 text-xs font-bold leading-tight text-center animate-pulse">
                    <div>takt</div>
                    <div>mate</div>
                  </div>
                </div>
              </div>
              
              {/* Typing Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-1">
                  <span className="body-small sm:body-normal text-text-secondary">Analyzing your data</span>
                  <div className="flex space-x-1 ml-2">
                    <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 bg-primary-400 rounded-full transition-opacity duration-300 ${typingDots >= 1 ? 'opacity-100' : 'opacity-30'}`}></div>
                    <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 bg-primary-400 rounded-full transition-opacity duration-300 ${typingDots >= 2 ? 'opacity-100' : 'opacity-30'}`}></div>
                    <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 bg-primary-400 rounded-full transition-opacity duration-300 ${typingDots >= 3 ? 'opacity-100' : 'opacity-30'}`}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
          </>
        )}
      </CardContent>

              {/* Enhanced Input Area */}
              <div className="pt-3 sm:pt-4 border-t border-gray-200 mt-4 px-2 sm:px-0">
                {/* Input Row */}
        <div className="flex items-start space-x-2 sm:space-x-3">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
                      placeholder="How can I help you today?"
              className="w-full border border-gray-300 rounded-input px-3 sm:px-4 py-2 sm:py-3 pr-10 sm:pr-12 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent body-small sm:body-normal resize-none transition-all duration-200"
              disabled={sending}
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
                  disabled={!inputMessage.trim() || sending || inputMessage.length > 500}
                  className="bg-primary-600 text-white px-3 sm:px-4 py-2 sm:py-3 rounded-button hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-200 warm-shadow hover:warm-shadow-lg flex-shrink-0 min-w-[44px] h-10 sm:h-12"
                  title={!inputMessage.trim() ? "Enter a message" : sending ? "Sending..." : "Send message"}
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
        
        {/* Processing indicator */}
        {sending && (
          <div className="mt-2 body-xs text-primary-600 font-medium text-center">
            Processing your request...
          </div>
        )}
      </div>
    </Card>
  );
};

export default ChatBox;
