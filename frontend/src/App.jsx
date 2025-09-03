import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MsalProvider } from '@azure/msal-react';
import { PublicClientApplication } from '@azure/msal-browser';

// Configuration
import { msalConfig } from './config/authConfig';

// Context Providers
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Components
import FileUpload from './components/FileUpload';
import ChatBox from './components/ChatBox';
import DataTable from './components/DataTable';
import LoginButton from './components/auth/LoginButton';
import UserProfile from './components/auth/UserProfile';
import ProtectedRoute from './components/auth/ProtectedRoute';

// Services
import { setAuthContext } from './services/apiService';

// Create MSAL instance
const msalInstance = new PublicClientApplication(msalConfig);

/**
 * Main application content component
 */
function AppContent() {
  const [fileData, setFileData] = useState(null);
  const { isAuthenticated, isLoading, user } = useAuth();

  const handleFileUploaded = (uploadedFileData) => {
    setFileData(uploadedFileData);
  };

  // Set auth context for API service
  useEffect(() => {
    const authContext = useAuth();
    setAuthContext(authContext);
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading TaktMate...</p>
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
              <span className="ml-2 text-sm text-gray-500">CSV Chat Platform</span>
            </div>
            
            {/* Authentication Status */}
            <div className="flex items-center space-x-4">
              {isAuthenticated ? (
                <UserProfile variant="dropdown" showDetailedInfo={false} />
              ) : (
                <LoginButton variant="primary" size="sm">
                  Sign In
                </LoginButton>
              )}
            </div>
          </div>
          
          <div className="mt-2 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {isAuthenticated 
                ? `Welcome back, ${user?.name || user?.email || 'User'}! Upload a CSV file and chat with your data using AI.`
                : 'Sign in to upload CSV files and chat with your data using AI'
              }
            </p>
            
            {isAuthenticated && (
              <div className="text-xs text-gray-500">
                Signed in as {user?.email}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isAuthenticated ? (
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
                  <li>Upload a CSV file (max 5MB) - your files are securely associated with your account</li>
                  <li>The AI will analyze your data structure and content</li>
                  <li>Ask questions about your data in natural language</li>
                  <li>Get insights and answers based on your CSV content</li>
                  <li>Your chat history and files are saved for future access</li>
                </ol>
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="text-sm font-medium text-green-900">🔒 Security & Privacy</h4>
                  <p className="mt-1 text-sm text-green-800">
                    Your files and conversations are private and secure. Only you can access your data, 
                    and all communications are encrypted.
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Unauthenticated Landing */
          <div className="text-center py-12">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-4xl font-bold text-gray-900 mb-6">
                Chat with Your CSV Data Using AI
              </h2>
              <p className="text-xl text-gray-600 mb-8">
                Upload your CSV files and get instant insights through natural language conversations. 
                Powered by advanced AI and secured with enterprise-grade authentication.
              </p>
              
              <div className="mb-12">
                <LoginButton variant="primary" size="lg" className="px-8 py-4">
                  Get Started - Sign In
                </LoginButton>
              </div>
              
              <div className="grid md:grid-cols-3 gap-8 text-left">
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="text-blue-600 mb-4">
                    <svg className="h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Secure Upload</h3>
                  <p className="text-gray-600">
                    Upload CSV files up to 5MB with enterprise-grade security. 
                    Your data is encrypted and only accessible by you.
                  </p>
                </div>
                
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="text-green-600 mb-4">
                    <svg className="h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">AI Chat</h3>
                  <p className="text-gray-600">
                    Ask questions about your data in plain English. 
                    Get insights, summaries, and analysis powered by GPT-4.
                  </p>
                </div>
                
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="text-purple-600 mb-4">
                    <svg className="h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Data Insights</h3>
                  <p className="text-gray-600">
                    Discover patterns, trends, and insights in your data. 
                    Get answers to complex questions with simple conversations.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-16 bg-white border-t border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              TaktMate - Secure CSV Chat Platform powered by OpenAI GPT-4
            </p>
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <span>Protected by Azure AD B2C</span>
              {isAuthenticated && (
                <span>User: {user?.email}</span>
              )}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

/**
 * Login page component
 */
function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">TaktMate</h1>
          <h2 className="text-xl font-semibold text-gray-700 mb-6">
            Sign In to Your Account
          </h2>
          <p className="text-sm text-gray-600 mb-8">
            Access your secure CSV chat platform
          </p>
        </div>
        
        <LoginButton 
          variant="primary"
          size="lg"
          className="w-full"
        >
          Sign In with Azure AD
        </LoginButton>
        
        <div className="text-center">
          <p className="text-xs text-gray-500">
            Secure authentication powered by Microsoft Azure AD B2C
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Main App component with routing and authentication
 */
function App() {
  return (
    <MsalProvider instance={msalInstance}>
      <AuthProvider>
        <Router>
          <Routes>
            {/* Login route */}
            <Route path="/login" element={<LoginPage />} />
            
            {/* Protected main application */}
            <Route 
              path="/" 
              element={
                <ProtectedRoute showLoginPrompt={false}>
                  <AppContent />
                </ProtectedRoute>
              } 
            />
            
            {/* Redirect all other routes to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </MsalProvider>
  );
}

export default App;
