import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

const ChatBox = ({ fileData }) => {
  const [messages, setMessages] = useState([]);

  // Don't render if no file is selected
  if (!fileData) {
    return (
      <div className="bg-white rounded-lg shadow-md flex flex-col h-96">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <div className="text-4xl mb-4">💬</div>
            <p className="text-lg font-medium mb-2">No file selected</p>
            <p className="text-sm">Upload and select a CSV file to start chatting with your data</p>
          </div>
        </div>
      </div>
    );
  }
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
    if (fileData) {
      setMessages([{
        type: 'system',
        content: `CSV file "${fileData.filename}" uploaded successfully! It contains ${fileData.rowCount} rows with columns: ${fileData.headers.join(', ')}. Ask me anything about this data!`
      }]);
    }
  }, [fileData]);

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
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center text-gray-500">
          <div className="text-4xl mb-4">💬</div>
          <h3 className="text-lg font-medium mb-2">Ready to Chat</h3>
          <p>Upload a CSV file to start chatting with your data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md flex flex-col h-96">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">
          Chat with {fileData.filename || fileData.name || 'Unknown File'}
        </h2>
        <p className="text-sm text-gray-600">
          {fileData.rowCount || 'Unknown'} rows • {fileData.headers?.length || 'Unknown'} columns
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${
              message.type === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-4xl px-4 py-2 rounded-lg ${
                message.type === 'user'
                  ? 'bg-primary-600 text-white'
                  : message.type === 'error'
                  ? 'bg-red-100 text-red-800 border border-red-200'
                  : message.type === 'system'
                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap font-mono">{message.content}</p>
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-800 px-4 py-2 rounded-lg">
              <p className="text-sm">Thinking...</p>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex space-x-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask a question about your CSV data..."
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            disabled={sending}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || sending}
            className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatBox;
