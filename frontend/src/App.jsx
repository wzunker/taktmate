import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { MsalProvider } from '@azure/msal-react';
import { PublicClientApplication } from '@azure/msal-browser';
import { AnimatePresence, motion } from 'framer-motion';
import { HelmetProvider } from 'react-helmet-async';

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
// import ProtectedRoute from './components/auth/ProtectedRoute'; // Unused for now
import LandingPage from './components/LandingPage';
import SEOHelmet, { SEOConfigs } from './components/SEOHelmet';

// Services
import { setAuthContext } from './services/apiService';

// Create MSAL instance
const msalInstance = new PublicClientApplication(msalConfig);

/**
 * Page transition animations
 */
const pageVariants = {
  initial: {
    opacity: 0,
    y: 20,
    scale: 0.98
  },
  in: {
    opacity: 1,
    y: 0,
    scale: 1
  },
  out: {
    opacity: 0,
    y: -20,
    scale: 1.02
  }
};

const pageTransition = {
  type: "tween",
  ease: "anticipate",
  duration: 0.4
};

const loadingVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 }
};

/**
 * Loading component with smooth transitions
 */
function LoadingScreen({ message = "Loading TaktMate..." }) {
  return (
    <motion.div 
      variants={loadingVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50"
    >
      <div className="text-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"
        />
        <motion.p 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-4 text-gray-600"
        >
          {message}
        </motion.p>
      </div>
    </motion.div>
  );
}

/**
 * Main application content component with transitions
 */
function AppContent() {
  const [fileData, setFileData] = useState(null);
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  const handleFileUploaded = (uploadedFileData) => {
    setFileData(uploadedFileData);
  };

  // Get auth context for API service
  const authContext = useAuth();
  
  // Set auth context for API service
  useEffect(() => {
    setAuthContext(authContext);
  }, [authContext]);

  // Loading state with transitions
  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <>
      <SEOHelmet {...SEOConfigs.dashboard} />
      <motion.div 
        key={location.pathname}
        variants={pageVariants}
        initial="initial"
        animate="in"
        exit="out"
        transition={pageTransition}
        className="min-h-screen bg-gray-50"
      >
      {/* Header with smooth entrance */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="bg-white shadow-sm border-b border-gray-200"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, duration: 0.3 }}
              className="flex items-center"
            >
              <h1 className="text-2xl font-bold text-gray-900">TaktMate</h1>
              <span className="ml-2 text-sm text-gray-500">CSV Chat Platform</span>
            </motion.div>
            
            {/* Authentication Status with animation */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, duration: 0.3 }}
              className="flex items-center space-x-4"
            >
              <AnimatePresence mode="wait">
                {isAuthenticated ? (
                  <motion.div
                    key="authenticated"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                  >
                    <UserProfile variant="dropdown" showDetailedInfo={false} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="unauthenticated"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                  >
                    <LoginButton variant="primary" size="sm">
                      Sign In
                    </LoginButton>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
          
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.3 }}
            className="mt-2 flex items-center justify-between"
          >
            <p className="text-sm text-gray-600">
              {isAuthenticated 
                ? `Welcome back, ${user?.name || user?.email || 'User'}! Upload a CSV file and chat with your data using AI.`
                : 'Sign in to upload CSV files and chat with your data using AI'
              }
            </p>
            
            {isAuthenticated && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.3 }}
                className="text-xs text-gray-500"
              >
                Signed in as {user?.email}
              </motion.div>
            )}
          </motion.div>
        </div>
      </motion.header>

      {/* Main Content with stagger animations */}
      <motion.main 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
      >
        <AnimatePresence mode="wait">
          {isAuthenticated ? (
            <motion.div 
              key="authenticated-content"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* File Upload Section with stagger */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.3 }}
              >
                <FileUpload onFileUploaded={handleFileUploaded} />
              </motion.div>
              
              {/* Data Table Section */}
              <AnimatePresence>
                {fileData && (
                  <motion.div
                    initial={{ opacity: 0, y: 20, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, y: -20, height: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <DataTable fileData={fileData} />
                  </motion.div>
                )}
              </AnimatePresence>
              
              {/* Chat Section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.3 }}
              >
                <ChatBox fileData={fileData} />
              </motion.div>
              
              {/* Info Section */}
              <AnimatePresence>
                {!fileData && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: 0.3, duration: 0.3 }}
                    className="bg-blue-50 border border-blue-200 rounded-lg p-6"
                  >
                    <h3 className="text-lg font-medium text-blue-900 mb-2">How it works</h3>
                    <ol className="list-decimal list-inside space-y-2 text-blue-800">
                      <li>Upload a CSV file (max 5MB) - your files are securely associated with your account</li>
                      <li>The AI will analyze your data structure and content</li>
                      <li>Ask questions about your data in natural language</li>
                      <li>Get insights and answers based on your CSV content</li>
                      <li>Your chat history and files are saved for future access</li>
                    </ol>
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5, duration: 0.3 }}
                      className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg"
                    >
                      <h4 className="text-sm font-medium text-green-900">🔒 Security & Privacy</h4>
                      <p className="mt-1 text-sm text-green-800">
                        Your files and conversations are private and secure. Only you can access your data, 
                        and all communications are encrypted.
                      </p>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : (
            /* Unauthenticated Landing with smooth transition */
            <motion.div 
              key="unauthenticated-content"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.4 }}
              className="text-center py-12"
            >
              <div className="max-w-3xl mx-auto">
                <motion.h2 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.4 }}
                  className="text-4xl font-bold text-gray-900 mb-6"
                >
                  Chat with Your CSV Data Using AI
                </motion.h2>
                <motion.p 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.4 }}
                  className="text-xl text-gray-600 mb-8"
                >
                  Upload your CSV files and get instant insights through natural language conversations. 
                  Powered by advanced AI and secured with enterprise-grade authentication.
                </motion.p>
                
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.4 }}
                  className="mb-12"
                >
                  <LoginButton variant="primary" size="lg" className="px-8 py-4">
                    Get Started - Sign In
                  </LoginButton>
                </motion.div>
                
                <motion.div 
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                  className="grid md:grid-cols-3 gap-8 text-left"
                >
                  {[
                    {
                      icon: "M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12",
                      title: "Secure Upload",
                      description: "Upload CSV files up to 5MB with enterprise-grade security. Your data is encrypted and only accessible by you.",
                      color: "text-blue-600"
                    },
                    {
                      icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
                      title: "AI Chat",
                      description: "Ask questions about your data in plain English. Get insights, summaries, and analysis powered by GPT-4.",
                      color: "text-green-600"
                    },
                    {
                      icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
                      title: "Data Insights",
                      description: "Discover patterns, trends, and insights in your data. Get answers to complex questions with simple conversations.",
                      color: "text-purple-600"
                    }
                  ].map((feature, index) => (
                    <motion.div
                      key={feature.title}
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 + index * 0.1, duration: 0.4 }}
                      whileHover={{ y: -5, transition: { duration: 0.2 } }}
                      className="bg-white rounded-lg shadow p-6"
                    >
                      <div className={`${feature.color} mb-4`}>
                        <svg className="h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={feature.icon} />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                      <p className="text-gray-600">{feature.description}</p>
                    </motion.div>
                  ))}
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.main>

      {/* Footer with entrance animation */}
      <motion.footer 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.3 }}
        className="mt-16 bg-white border-t border-gray-200"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              TaktMate - Secure CSV Chat Platform powered by OpenAI GPT-4
            </p>
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <span>Protected by Microsoft Entra External ID</span>
              <AnimatePresence>
                {isAuthenticated && (
                  <motion.span
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    User: {user?.email}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.footer>
      </motion.div>
    </>
  );
}

/**
 * Enhanced Login page component with smooth transitions
 */
function LoginPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Redirect if already authenticated
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (isLoading) {
    return <LoadingScreen message="Checking authentication..." />;
  }

  return (
    <>
      <SEOHelmet {...SEOConfigs.login} />
      <motion.div 
        key={location.pathname}
        variants={pageVariants}
        initial="initial"
        animate="in"
        exit="out"
        transition={pageTransition}
        className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50"
      >
      <motion.div 
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="max-w-md w-full space-y-8 p-8"
      >
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="text-center"
        >
          {/* Logo */}
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, duration: 0.4, type: "spring", stiffness: 200 }}
            className="flex justify-center mb-6"
          >
            <div className="h-16 w-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-2xl">T</span>
            </div>
          </motion.div>
          
          <h2 className="text-3xl font-extrabold text-gray-900">
            Sign in to TaktMate
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Access your secure CSV chat platform
          </p>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="mt-8"
        >
          <LoginButton variant="primary" size="lg" className="w-full">
            Sign In with Microsoft Entra External ID
          </LoginButton>
        </motion.div>
        
        {/* Additional info */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          className="text-center text-xs text-gray-500"
        >
          <div className="space-y-2">
            <p>🔒 Enterprise-grade security with Microsoft Entra External ID</p>
            <p>💼 Chat with your CSV data using AI</p>
            <p>⚡ Instant insights powered by GPT-4</p>
          </div>
        </motion.div>
      </motion.div>
      </motion.div>
    </>
  );
}

/**
 * Route wrapper with smooth transitions
 */
function AnimatedRoutes() {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Landing page route */}
        <Route path="/welcome" element={<LandingPageWrapper />} />
        
        {/* Login route */}
        <Route path="/login" element={<LoginPage />} />
        
        {/* Main application route */}
        <Route 
          path="/" 
          element={<AppContentWrapper />} 
        />
        
        {/* Redirect all other routes to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

/**
 * Landing page wrapper with route awareness
 */
function LandingPageWrapper() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  
  // Redirect to main app if authenticated
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      <SEOHelmet {...SEOConfigs.home} />
      <motion.div
        key={location.pathname}
        variants={pageVariants}
        initial="initial"
        animate="in"
        exit="out"
        transition={pageTransition}
      >
        <LandingPage />
      </motion.div>
    </>
  );
}

/**
 * App content wrapper with authentication logic
 */
function AppContentWrapper() {
  const { isAuthenticated, isLoading } = useAuth();
  // const location = useLocation(); // Unused for now

  if (isLoading) {
    return <LoadingScreen />;
  }

  // If not authenticated, show landing page with smooth transition
  if (!isAuthenticated) {
    return (
      <>
        <SEOHelmet {...SEOConfigs.home} />
        <motion.div
          key="landing-page"
          variants={pageVariants}
          initial="initial"
          animate="in"
          exit="out"
          transition={pageTransition}
        >
          <LandingPage />
        </motion.div>
      </>
    );
  }

  // Show authenticated content
  return <AppContent />;
}

/**
 * Main App component with enhanced routing and transitions
 */
function App() {
  return (
    <HelmetProvider>
      <MsalProvider instance={msalInstance}>
        <AuthProvider>
          <Router>
            <AnimatedRoutes />
          </Router>
        </AuthProvider>
      </MsalProvider>
    </HelmetProvider>
  );
}

export default App;


