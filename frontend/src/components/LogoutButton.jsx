import React, { useState } from 'react';
import useAuth from '../hooks/useAuth';

/**
 * LogoutButton Component
 * Provides a reusable logout button with optional confirmation
 */
const LogoutButton = ({ 
  className = "bg-secondary-100 hover:bg-secondary-200 text-secondary-800 px-3 py-1.5 rounded-md body-xs font-medium transition-colors",
  showConfirmation = false,
  children = "Sign Out"
}) => {
  const { logout, isLoading } = useAuth();
  const [showConfirm, setShowConfirm] = useState(false);

  const handleLogout = () => {
    if (showConfirmation && !showConfirm) {
      setShowConfirm(true);
      return;
    }
    
    logout();
  };

  const handleCancel = () => {
    setShowConfirm(false);
  };

  // Show confirmation dialog if requested
  if (showConfirm) {
    return (
      <div className="relative inline-block">
        <div className="absolute right-0 top-full mt-2 w-64 bg-background-warm-white border border-gray-200 rounded-lg shadow-lg p-4 z-50">
          <p className="body-small text-text-primary mb-3">
            Are you sure you want to sign out?
          </p>
          <div className="flex space-x-2">
            <button
              onClick={handleLogout}
              disabled={isLoading}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-md body-xs font-medium transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Signing out...' : 'Yes, Sign Out'}
            </button>
            <button
              onClick={handleCancel}
              className="flex-1 bg-secondary-100 hover:bg-secondary-200 text-secondary-800 px-3 py-2 rounded-md body-xs font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
        <button
          onClick={handleCancel}
          className={className}
        >
          {children}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleLogout}
      disabled={isLoading}
      className={`${className} ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
      title="Sign out of your account"
    >
      {isLoading ? 'Signing out...' : children}
    </button>
  );
};

export default LogoutButton;
