import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import Card, { CardHeader, CardContent } from './Card';

const ChatBox = ({ fileData, className = '' }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [typingDots, setTypingDots] = useState(0);
  const [messageCount, setMessageCount] = useState(0);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
    // Welcome message when file is uploaded
    if (fileData && (fileData.filename || fileData.name) && fileData.headers) {
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
    } else {
      setMessages([]);
      setMessageCount(0);
    }
  }, [fileData]);

  // Don't render if no file is selected or if fileData is invalid
  if (!fileData || typeof fileData !== 'object') {
    return (
      <Card variant="elevated" className={`flex flex-col h-full ${className}`}>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 mx-auto mb-4 bg-primary-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="heading-5 mb-2 text-secondary-600 font-semibold">TaktMate</h3>
            <p className="body-small text-text-secondary mb-4">Upload and select your files to start an intelligent conversation with your data</p>
            <div className="flex items-center justify-center space-x-4 body-xs text-text-muted">
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-primary-400 rounded-full"></div>
                <span>Ask questions</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-secondary-400 rounded-full"></div>
                <span>Get insights</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-primary-400 rounded-full"></div>
                <span>Analyze trends</span>
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
        message: userMessage
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
                title={<span className="text-secondary-600 font-semibold">taktmate</span>}
        subtitle={`${fileData.filename || fileData.name || 'Unknown File'} • ${fileData.rowCount || 'Unknown'} rows • ${(fileData.headers && Array.isArray(fileData.headers)) ? fileData.headers.length : 'Unknown'} columns`}
        action={
          <div className="flex flex-col sm:flex-row items-end sm:items-center space-y-1 sm:space-y-0 sm:space-x-3">
            {messageCount > 1 && (
              <span className="body-xs text-text-muted hidden sm:block">
                {messageCount - 1} message{messageCount - 1 !== 1 ? 's' : ''}
              </span>
            )}
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="body-xs text-green-700 font-medium">Online</span>
            </div>
          </div>
        }
        className="mb-4"
      />

      {/* Messages */}
      <CardContent className="flex-1 overflow-y-auto space-y-4 sm:space-y-6 px-2 sm:px-4">
        {messages.map((message, index) => (
          <div key={index} className={`flex items-start space-x-2 sm:space-x-3 ${message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
            {/* Avatar */}
            <div className="flex-shrink-0">
              {message.type === 'user' ? (
                <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                </div>
              ) : message.type === 'system' ? (
                <div className="w-8 h-8 bg-secondary-100 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-secondary-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
              ) : message.type === 'error' ? (
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
              ) : (
                <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                    <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
                  </svg>
                </div>
              )}
            </div>
            
            {/* Message Content */}
            <div className={`flex-1 ${message.type === 'user' ? 'text-right' : ''}`}>
              {/* Message Label */}
              <div className={`body-xs text-text-muted mb-1 ${message.type === 'user' ? 'text-right' : ''}`}>
                        {message.type === 'user' ? 'You' : message.type === 'system' ? 'System' : message.type === 'error' ? 'Error' : 'taktmate'}
                {message.timestamp && (
                  <span className="ml-2">
                    {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
              
              {/* Message Bubble */}
              <div
                className={`max-w-xs sm:max-w-lg inline-block px-3 sm:px-4 py-2 sm:py-3 rounded-card transition-all duration-200 ${
                  message.type === 'user'
                    ? 'bg-primary-600 text-white warm-shadow ml-auto'
                    : message.type === 'error'
                    ? 'bg-red-50 text-red-800 border border-red-200 warm-shadow'
                    : message.type === 'system'
                    ? 'bg-secondary-50 text-secondary-800 border border-secondary-200 warm-shadow'
                    : 'bg-background-warm-white text-text-primary border border-gray-200 warm-shadow'
                } ${message.type === 'user' ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
              >
                <div className="body-small sm:body-normal whitespace-pre-wrap leading-relaxed">
                  {message.content}
                </div>
              </div>
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex items-start space-x-2 sm:space-x-3">
            {/* AI Avatar */}
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-primary-600 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                  <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
                </svg>
              </div>
            </div>
            
            {/* Typing Indicator */}
            <div className="flex-1">
                    <div className="body-xs text-text-muted mb-1">taktmate</div>
              <div className="bg-background-warm-white text-text-primary px-3 sm:px-4 py-2 sm:py-3 rounded-card rounded-tl-sm border border-gray-200 warm-shadow">
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
      </CardContent>

      {/* Enhanced Input Area */}
      <div className="pt-3 sm:pt-4 border-t border-gray-200 mt-4 px-2 sm:px-0">
        {/* Quick Suggestions */}
        {messages.length <= 1 && (
          <div className="mb-3">
            <div className="body-xs text-text-muted mb-2">💡 Try asking:</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                "What are the column names?",
                "Show me summary statistics",
                "Find trends in the data",
                "What's the average value?"
              ].map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => setInputMessage(suggestion)}
                  disabled={sending}
                  className="px-3 py-2 bg-primary-50 hover:bg-primary-100 text-primary-700 rounded-badge body-xs font-medium transition-colors disabled:opacity-50 text-left"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* Input Row */}
        <div className="flex items-end space-x-2 sm:space-x-3">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask a question about your CSV data..."
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
                  className="bg-primary-600 text-white p-2.5 sm:p-3 rounded-button hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-200 warm-shadow hover:warm-shadow-lg flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
                  title={!inputMessage.trim() ? "Enter a message" : sending ? "Sending..." : "Send message"}
                >
                  {sending ? (
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      {/* Takt-style arrow with balls at endpoints */}
                      <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      <line x1="14" y1="6" x2="20" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      <line x1="14" y1="18" x2="20" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      {/* Balls at endpoints */}
                      <circle cx="4" cy="12" r="2" fill="currentColor"/>
                      <circle cx="20" cy="12" r="2" fill="currentColor"/>
                    </svg>
                  )}
                </button>
        </div>
        
        {/* Input Helper Text */}
        <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-1 sm:space-y-0 body-xs text-text-muted">
          <span className="hidden sm:block">Press Enter to send, Shift+Enter for new line</span>
          <span className="sm:hidden">Tap send or press Enter</span>
          {sending && <span className="text-primary-600 font-medium">Processing your request...</span>}
        </div>
      </div>
    </Card>
  );
};

export default ChatBox;
