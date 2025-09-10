/**
 * Direct Redirect Landing Page for TaktMate
 * 
 * Automatically redirects users to External ID authentication.
 * Uses isolated authentication logic to prevent infinite loops.
 */

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIsAuthenticated, useMsal, InteractionStatus } from "@azure/msal-react";
import { handleAuthRedirect } from '../utils/authRedirect';
import { logReactState, logAuthStep } from '../utils/debugLogger';
import SEOHelmet from './SEOHelmet';

const LandingPage = () => {
  const { instance, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const navigate = useNavigate();

  // Debug: Log React state on every render
  useEffect(() => {
    logReactState('LandingPage', {
      isAuthenticated,
      inProgress,
      interactionStatus: inProgress
    });
  });

  // Handle authentication success - redirect to dashboard
  useEffect(() => {
    if (isAuthenticated) {
      logAuthStep('User authenticated, redirecting to dashboard');
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  // Handle authentication redirect - run once on mount
  useEffect(() => {
    logAuthStep('LandingPage mounted, checking auth state', {
      isAuthenticated,
      inProgress,
      interactionStatus: inProgress
    });
    
    if (!isAuthenticated && inProgress === InteractionStatus.None) {
      handleAuthRedirect(instance);
    }
  }, []); // Empty dependency array - run once only

  // Show loading while not authenticated
  if (!isAuthenticated) {
    return (
      <>
        <SEOHelmet 
          title="TaktMate - AI-Powered CSV Data Analysis"
          description="Upload CSV files and chat with your data using AI. Get instant insights from your spreadsheets."
          keywords="CSV analysis, AI data analysis, business intelligence, data chat"
          url="https://taktmate.com/"
        />
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
          <div className="text-center">
            {/* Logo */}
            <div className="h-16 w-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-white font-bold text-2xl">T</span>
            </div>
            
            {/* Loading message */}
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
              TaktMate
            </h1>
            <p className="text-gray-600 mb-6">
              Redirecting to secure sign-in...
            </p>
            
            {/* Loading spinner */}
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        </div>
      </>
    );
  }

  // This should never render since we redirect on load, but just in case
  return null;
};

export default LandingPage;
