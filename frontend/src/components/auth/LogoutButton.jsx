/**
 * Logout Button Component for TaktMate
 * 
 * This component provides a user-friendly logout interface with confirmation
 * and multiple logout options.
 */

import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const LogoutButton = ({ 
  variant = 'secondary', 
  size = 'sm', 
  showIcon = true,
  showConfirmation = true,
  className = '',
  children = 'Sign Out'
}) => {
  const { signOut, isLoading, error, clearError } = useAuth();
  const [logoutMethod, setLogoutMethod] = useState('popup'); // 'popup' or 'redirect'
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  /**
   * Handle sign out with selected method
   */
  const handleSignOut = async () => {
    if (showConfirmation && !showConfirmDialog) {
      setShowConfirmDialog(true);
      return;
    }

    setIsSigningOut(true);
    setShowConfirmDialog(false);
    clearError();

    try {
      await signOut(logoutMethod);
    } catch (error) {
      console.error('Logout failed:', error);
      // Error is handled by the AuthContext
    } finally {
      setIsSigningOut(false);
    }
  };

  /**
   * Cancel logout
   */
  const handleCancel = () => {
    setShowConfirmDialog(false);
  };

  /**
   * Get button classes based on variant and size
   */
  const getButtonClasses = (isPrimary = false) => {
    const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
    
    const variantClasses = {
      primary: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500',
      secondary: 'bg-gray-600 hover:bg-gray-700 text-white focus:ring-gray-500',
      outline: 'border-2 border-gray-600 text-gray-600 hover:bg-gray-50 focus:ring-gray-500',
      ghost: 'text-gray-600 hover:bg-gray-50 focus:ring-gray-500',
      danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500',
    };
    
    const sizeClasses = {
      sm: 'px-3 py-2 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg',
    };
    
    const finalVariant = isPrimary ? 'danger' : variant;
    return `${baseClasses} ${variantClasses[finalVariant]} ${sizeClasses[size]} ${className}`;
  };

  /**
   * Logout icon SVG
   */
  const LogoutIcon = () => (
    <svg className="w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );

  /**
   * Loading spinner
   */
  const LoadingSpinner = () => (
    <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );

  const isDisabled = isLoading || isSigningOut;

  // Confirmation dialog
  if (showConfirmDialog) {
    return (
      <div className="space-y-3">
        {/* Confirmation Message */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Confirm Sign Out</h3>
              <div className="mt-1 text-sm text-yellow-700">
                Are you sure you want to sign out? You'll need to sign in again to access your files and chat history.
              </div>
            </div>
          </div>
        </div>

        {/* Logout Method Selection */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <div className="text-sm text-gray-700 mb-2">Sign out method:</div>
          <div className="flex items-center space-x-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="popup"
                checked={logoutMethod === 'popup'}
                onChange={(e) => setLogoutMethod(e.target.value)}
                className="mr-2"
                disabled={isDisabled}
              />
              <span className="text-sm">Popup (recommended)</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="redirect"
                checked={logoutMethod === 'redirect'}
                onChange={(e) => setLogoutMethod(e.target.value)}
                className="mr-2"
                disabled={isDisabled}
              />
              <span className="text-sm">Redirect</span>
            </label>
          </div>
          <div className="mt-2 text-xs text-gray-600">
            {logoutMethod === 'popup' 
              ? 'Opens logout in a popup window (stays on current page)'
              : 'Redirects to logout page (leaves current page)'
            }
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-3">
          <button
            onClick={handleCancel}
            disabled={isDisabled}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSignOut}
            disabled={isDisabled}
            className={getButtonClasses(true)}
          >
            {isSigningOut ? (
              <>
                <LoadingSpinner />
                Signing Out...
              </>
            ) : (
              <>
                {showIcon && <LogoutIcon />}
                Confirm Sign Out
              </>
            )}
          </button>
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
                <h3 className="text-sm font-medium text-red-800">Sign out failed</h3>
                <div className="mt-1 text-sm text-red-700">
                  {error.message || 'An unexpected error occurred. Please try again.'}
                </div>
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
      </div>
    );
  }

  // Main logout button
  return (
    <button
      onClick={handleSignOut}
      disabled={isDisabled}
      className={getButtonClasses()}
      aria-label="Sign out"
      title="Sign out of your account"
    >
      {isSigningOut ? (
        <>
          <LoadingSpinner />
          Signing Out...
        </>
      ) : (
        <>
          {showIcon && <LogoutIcon />}
          {children}
        </>
      )}
    </button>
  );
};

export default LogoutButton;
