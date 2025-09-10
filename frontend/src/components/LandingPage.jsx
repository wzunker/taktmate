/**
 * Direct Redirect Landing Page for TaktMate
 * 
 * Automatically redirects users to External ID authentication.
 * No custom login buttons needed - Microsoft handles the authentication flow.
 */

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIsAuthenticated, useMsal, InteractionStatus } from "@azure/msal-react";
import { loginRequest } from '../config/authConfig';
import SEOHelmet from './SEOHelmet';

// Global flag to prevent multiple redirect attempts across component instances
let globalRedirectAttempted = false;

const LandingPage = () => {
  const { instance, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const navigate = useNavigate();

  // Handle authentication success - redirect to dashboard
  useEffect(() => {
    if (isAuthenticated) {
      // Reset the global flag when user is authenticated
      globalRedirectAttempted = false;
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  // Cleanup: Reset global flag on component unmount
  useEffect(() => {
    return () => {
      // Only reset if user is not authenticated (meaning redirect failed)
      if (!isAuthenticated) {
        globalRedirectAttempted = false;
      }
    };
  }, [isAuthenticated]);

  // Auto-redirect to External ID authentication using global flag
  useEffect(() => {
    console.log('🔍 LandingPage useEffect - Auth check:', {
      isAuthenticated,
      inProgress,
      globalRedirectAttempted,
      interactionStatus: inProgress
    });
    
    if (!isAuthenticated && 
        inProgress === InteractionStatus.None && 
        !globalRedirectAttempted) {
      
      globalRedirectAttempted = true;
      console.log('🚀 Auto-redirecting to External ID authentication...');
      
      // Immediate redirect without timeout - more reliable
      instance.loginRedirect(loginRequest).catch(error => {
        console.error('❌ Redirect failed:', error);
        globalRedirectAttempted = false; // Reset on error
      });
    } else {
      console.log('🚫 Redirect skipped - conditions not met');
    }
  }, [isAuthenticated, inProgress, instance]);

  // Show loading while not authenticated or interaction in progress
  if (!isAuthenticated || inProgress !== InteractionStatus.None) {
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
