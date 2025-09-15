// TaktMate App using Azure Static Web Apps Built-in Authentication
import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { HelmetProvider } from 'react-helmet-async';

// Components
import FileUpload from './components/FileUpload';
import ChatBox from './components/ChatBox';
import DataTable from './components/DataTable';
import SEOHelmet, { SEOConfigs } from './components/SEOHelmet';

/**
 * Page transition animations
 */
const pageVariants = {
  initial: { opacity: 0, y: 20 },
  in: { opacity: 1, y: 0 },
  out: { opacity: 0, y: -20 }
};

const pageTransition = {
  type: "tween",
  ease: "anticipate",
  duration: 0.4
};

/**
 * Main application content component
 */
function AppContent() {
  const [fileData, setFileData] = useState(null);
  const location = useLocation();

  const handleFileUploaded = (uploadedFileData) => {
    setFileData(uploadedFileData);
  };

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
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <h1 className="text-2xl font-bold text-gray-900">TaktMate</h1>
                <span className="ml-2 text-sm text-gray-500">CSV Chat Platform</span>
              </div>
              
              {/* User info will be available via Azure Static Web Apps /.auth/me endpoint */}
              <div className="flex items-center space-x-4">
                <a href="/.auth/logout" className="text-sm text-gray-600 hover:text-gray-900">
                  Sign Out
                </a>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* File Upload Section */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload CSV File</h2>
              <FileUpload onFileUploaded={handleFileUploaded} />
            </div>

            {/* Chat Section */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Chat with Your Data</h2>
              <ChatBox fileData={fileData} />
            </div>
          </div>

          {/* Data Table Section */}
          {fileData && (
            <div className="mt-8 bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Data Preview</h2>
              <DataTable data={fileData} />
            </div>
          )}
        </main>
      </motion.div>
    </>
  );
}

/**
 * Animated Routes Component
 */
function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<AppContent />} />
        <Route path="/dashboard" element={<AppContent />} />
        <Route path="*" element={<AppContent />} />
      </Routes>
    </AnimatePresence>
  );
}

/**
 * Main App component
 */
function App() {
  return (
    <HelmetProvider>
      <Router>
        <AnimatedRoutes />
      </Router>
    </HelmetProvider>
  );
}

export default App;