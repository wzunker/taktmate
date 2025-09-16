import React, { useState } from 'react';
import FileUpload from './components/FileUpload';
import ChatBox from './components/ChatBox';
import DataTable from './components/DataTable';
import UserProfile from './components/UserProfile';
import DebugAuth from './components/DebugAuth';
import AuthDebugger from './components/AuthDebugger';
import useAuth from './hooks/useAuth';

function App() {
  const [fileData, setFileData] = useState(null);
  const { isAuthenticated, isLoading, error } = useAuth();

  const handleFileUploaded = (uploadedFileData) => {
    setFileData(uploadedFileData);
  };

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

      {/* Debug Section - Remove this after debugging */}
      <DebugAuth />
      <AuthDebugger />

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* File Upload Section */}
          <FileUpload onFileUploaded={handleFileUploaded} />
          
          {/* Data Table Section */}
          {fileData && <DataTable fileData={fileData} />}
          
          {/* Chat Section */}
          <ChatBox fileData={fileData} />
          
          {/* Info Section */}
          {!fileData && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-blue-900 mb-2">How it works</h3>
              <ol className="list-decimal list-inside space-y-2 text-blue-800">
                <li>Upload a CSV file (max 5MB)</li>
                <li>The AI will analyze your data structure</li>
                <li>Ask questions about your data in natural language</li>
                <li>Get insights and answers based on your CSV content</li>
              </ol>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 bg-white border-t border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-sm text-gray-500">
            TaktMate MVP - Powered by OpenAI GPT-4
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
