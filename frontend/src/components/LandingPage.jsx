/**
 * Landing Page for TaktMate using Azure Static Web Apps Built-in Authentication
 * 
 * Uses Azure Static Web Apps EasyAuth instead of client-side MSAL
 */

import React from 'react';
import SEOHelmet from './SEOHelmet';

const LandingPage = () => {
  return (
    <>
      <SEOHelmet 
        title="TaktMate - AI-Powered CSV Data Analysis"
        description="Upload CSV files and chat with your data using AI. Get instant insights from your spreadsheets."
        keywords="CSV analysis, AI data analysis, business intelligence, data chat"
        url="https://taktmate.com/"
      />
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          {/* Logo */}
          <div className="h-16 w-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <span className="text-white font-bold text-2xl">T</span>
          </div>
          
          {/* Title */}
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
            TaktMate
          </h1>
          
          {/* Description */}
          <p className="text-gray-600 mb-8 text-lg">
            AI-powered CSV data analysis. Upload your files and chat with your data to get instant insights.
          </p>
          
          {/* Authentication will be handled automatically by Azure Static Web Apps */}
          {/* Users will be redirected to login if not authenticated */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h2 className="font-semibold text-blue-800 mb-2">🔐 Secure Access</h2>
            <p className="text-blue-700 text-sm mb-4">
              This application uses Microsoft Entra External ID for secure authentication.
            </p>
            <p className="text-blue-600 text-sm">
              You will be automatically redirected to sign in if not already authenticated.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default LandingPage;
