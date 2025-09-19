import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import Card, { CardHeader, CardContent } from './Card';

const ChatBox = ({ fileData }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Welcome message when file is uploaded
    if (fileData && fileData.filename && fileData.headers) {
      setMessages([{
        type: 'system',
        content: `CSV file "${fileData.filename || fileData.name}" uploaded successfully! It contains ${fileData.rowCount || 'unknown'} rows with columns: ${Array.isArray(fileData.headers) ? fileData.headers.join(', ') : 'unknown'}. Ask me anything about this data!`
      }]);
    }
  }, [fileData]);

  // Don't render if no file is selected or if fileData is invalid
  if (!fileData || typeof fileData !== 'object') {
    return (
      <Card className="flex flex-col h-96">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-4">💬</div>
            <p className="heading-5 mb-2 text-text-secondary">No file selected</p>
            <p className="body-small text-text-muted">Upload and select a CSV file to start chatting with your data</p>
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

    // Add user message to chat
    const newMessages = [...messages, { type: 'user', content: userMessage }];
    setMessages(newMessages);

    try {
      // Get auth info from SWA
      const authResponse = await fetch('/.auth/me');
      const authData = await authResponse.json();
      
      if (!authData.clientPrincipal) {
        setMessages(prev => [...prev, { 
          type: 'error', 
          content: 'Authentication required. Please refresh the page and log in.'
        }]);
        return;
      }
      
      // Call backend directly with SWA auth data
      // Use relative URL to go through Static Web App proxy
      
      const response = await axios.post('/api/chat', {
        fileName: fileData.name || fileData.filename,
        message: userMessage
      }, {
        headers: {
          'Content-Type': 'application/json',
          'x-ms-client-principal': btoa(JSON.stringify(authData.clientPrincipal))
        }
      });

      if (response.data.success) {
        setMessages(prev => [...prev, { 
          type: 'assistant', 
          content: response.data.reply
        }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { 
        type: 'error', 
        content: err.response?.data?.error || 'Failed to get response' 
      }]);
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
    <Card padding="sm" className="flex flex-col h-96">
      <CardHeader
        title={`Chat with ${fileData.filename || fileData.name || 'Unknown File'}`}
        subtitle={`${fileData.rowCount || 'Unknown'} rows • ${(fileData.headers && Array.isArray(fileData.headers)) ? fileData.headers.length : 'Unknown'} columns`}
        className="mb-4"
      />

      {/* Messages */}
      <CardContent className="flex-1 overflow-y-auto space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${
              message.type === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-4xl px-4 py-3 rounded-card ${
                message.type === 'user'
                  ? 'bg-primary-600 text-white warm-shadow'
                  : message.type === 'error'
                  ? 'bg-red-50 text-red-800 border border-red-200 warm-shadow'
                  : message.type === 'system'
                  ? 'bg-secondary-50 text-secondary-800 border border-secondary-200 warm-shadow'
                  : 'bg-background-cream text-text-primary warm-shadow'
              }`}
            >
              <p className="body-small whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-background-cream text-text-primary px-4 py-3 rounded-card warm-shadow">
              <p className="body-small">Thinking...</p>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </CardContent>

      {/* Input */}
      <div className="pt-4 border-t border-gray-200 mt-4">
        <div className="flex space-x-3">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask a question about your CSV data..."
            className="flex-1 border border-gray-300 rounded-input px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent body-normal"
            disabled={sending}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || sending}
            className="bg-primary-600 text-white px-4 py-2 rounded-button hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors body-small font-medium warm-shadow"
          >
            Send
          </button>
        </div>
      </div>
    </Card>
  );
};

export default ChatBox;
