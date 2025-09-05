/**
 * Login Button Component for TaktMate
 * 
 * This component provides a user-friendly login interface with multiple
 * authentication options and error handling.
 */

import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const LoginButton = ({ 
  variant = 'primary', 
  size = 'md', 
  showIcon = true,
  className = '',
  children = 'Sign In'
}) => {
  const { signIn, signInRedirect, isLoading, error, clearError } = useAuth();
  const [loginMethod, setLoginMethod] = useState('popup'); // 'popup' or 'redirect'
  const [isSigningIn, setIsSigningIn] = useState(false);

  /**
   * Handle sign in with selected method
   */
  const handleSignIn = async () => {
    setIsSigningIn(true);
    clearError();

    try {
      if (loginMethod === 'popup') {
        await signIn();
      } else {
        await signInRedirect();
      }
    } catch (error) {
      console.error('Login failed:', error);
      // Error is handled by the AuthContext
    } finally {
      setIsSigningIn(false);
    }
  };

  /**
   * Get button classes based on variant and size
   */
  const getButtonClasses = () => {
    const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
    
    const variantClasses = {
      primary: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500',
      secondary: 'bg-gray-600 hover:bg-gray-700 text-white focus:ring-gray-500',
      outline: 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50 focus:ring-blue-500',
      ghost: 'text-blue-600 hover:bg-blue-50 focus:ring-blue-500',
    };
    
    const sizeClasses = {
      sm: 'px-3 py-2 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg',
    };
    
    return `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;
  };

  /**
   * Microsoft icon SVG
   */
  const MicrosoftIcon = () => (
    <svg className="w-5 h-5 mr-2" viewBox="0 0 23 23" fill="currentColor">
      <path d="M0 0h11v11H0zM12 0h11v11H12zM0 12h11v11H0zM12 12h11v11H12z"/>
    </svg>
  );

  /**
   * Loading spinner
   */
  const LoadingSpinner = () => (
    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );

  const isDisabled = isLoading || isSigningIn;

  return (
    <div className="space-y-3">
      {/* Main Login Button */}
      <button
        onClick={handleSignIn}
        disabled={isDisabled}
        className={getButtonClasses()}
        aria-label="Sign in with Microsoft Entra External ID"
      >
        {isSigningIn ? (
          <>
            <LoadingSpinner />
            Signing In...
          </>
        ) : (
          <>
            {showIcon && <MicrosoftIcon />}
            {children}
          </>
        )}
      </button>

      {/* Login Method Toggle */}
      <div className="flex items-center justify-center space-x-4 text-sm text-gray-600">
        <span>Method:</span>
        <label className="flex items-center">
          <input
            type="radio"
            value="popup"
            checked={loginMethod === 'popup'}
            onChange={(e) => setLoginMethod(e.target.value)}
            className="mr-1"
            disabled={isDisabled}
          />
          Popup
        </label>
        <label className="flex items-center">
          <input
            type="radio"
            value="redirect"
            checked={loginMethod === 'redirect'}
            onChange={(e) => setLoginMethod(e.target.value)}
            className="mr-1"
            disabled={isDisabled}
          />
          Redirect
        </label>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Sign in failed</h3>
              <div className="mt-1 text-sm text-red-700">
                {error.message || 'An unexpected error occurred. Please try again.'}
              </div>
              {error.errorCode && (
                <div className="mt-1 text-xs text-red-600">
                  Error Code: {error.errorCode}
                </div>
              )}
              <div className="mt-2">
                <button
                  onClick={clearError}
                  className="text-sm text-red-800 underline hover:text-red-900"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="text-xs text-gray-500 text-center">
        <p>Sign in with your organizational account</p>
        <p className="mt-1">
          Don't have an account? 
          <button 
            onClick={handleSignIn}
            className="ml-1 text-blue-600 hover:text-blue-700 underline"
            disabled={isDisabled}
          >
            Create one here
          </button>
        </p>
      </div>
    </div>
  );
};

export default LoginButton;
