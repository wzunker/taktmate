/**
 * Simplified Landing Page Component for TaktMate
 * 
 * Clean, focused landing page with just the essentials:
 * - Brief description of TaktMate
 * - Three authentication options (Microsoft, Google, Email/Password)
 * - No scrolling required
 */

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import SEOHelmet from './SEOHelmet';

const LandingPage = () => {
  const { isAuthenticated, isLoading, signIn } = useAuth();
  const navigate = useNavigate();

  // Handle authentication success
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, isLoading, navigate]);

  // Authentication handlers for different providers
  const handleMicrosoftSignIn = async () => {
    try {
      await signIn('microsoft');
    } catch (error) {
      console.error('Microsoft sign-in failed:', error);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signIn('google');
    } catch (error) {
      console.error('Google sign-in failed:', error);
    }
  };

  const handleEmailSignIn = async () => {
    try {
      await signIn('email');
    } catch (error) {
      console.error('Email sign-in failed:', error);
    }
  };

  return (
    <>
      <SEOHelmet 
        title="TaktMate - AI-Powered CSV Data Analysis"
        description="Upload CSV files and chat with your data using AI. Get instant insights from your spreadsheets."
        keywords="CSV analysis, AI data analysis, business intelligence, data chat"
        url="https://taktmate.com/"
      />
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="max-w-md w-full mx-auto px-6">
          {/* Logo and Title */}
          <div className="text-center mb-8">
            <div className="h-16 w-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-white font-bold text-2xl">T</span>
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
              TaktMate
            </h1>
            <p className="text-gray-600 text-lg">
              Stop wrestling with spreadsheets. Just ask your data questions.
            </p>
          </div>

          {/* Authentication Buttons */}
          <div className="space-y-4">
            {/* Microsoft Sign In */}
            <button
              onClick={handleMicrosoftSignIn}
              disabled={isLoading}
              className="w-full flex items-center justify-center px-6 py-4 border-2 border-blue-600 text-blue-600 bg-white hover:bg-blue-50 rounded-lg font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            >
              <svg className="w-5 h-5 mr-3" viewBox="0 0 23 23" fill="currentColor">
                <path d="M0 0h11v11H0zM12 0h11v11H12zM0 12h11v11H0zM12 12h11v11H12z"/>
              </svg>
              {isLoading ? 'Signing in...' : 'Continue with Microsoft'}
            </button>

            {/* Google Sign In */}
            <button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full flex items-center justify-center px-6 py-4 border-2 border-red-500 text-red-500 bg-white hover:bg-red-50 rounded-lg font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
            >
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {isLoading ? 'Signing in...' : 'Continue with Google'}
            </button>

            {/* Email/Password Sign In */}
            <button
              onClick={handleEmailSignIn}
              disabled={isLoading}
              className="w-full flex items-center justify-center px-6 py-4 border-2 border-gray-600 text-gray-600 bg-white hover:bg-gray-50 rounded-lg font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50"
            >
              <svg className="w-5 h-5 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
              </svg>
              {isLoading ? 'Signing in...' : 'Continue with Email'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default LandingPage;
