/**
 * User Profile Component for TaktMate
 * 
 * This component displays user information and provides profile management options.
 */

import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import LogoutButton from './LogoutButton';

const UserProfile = ({ 
  variant = 'dropdown', // 'dropdown', 'card', 'inline'
  showProfileActions = true,
  showDetailedInfo = false,
  className = ''
}) => {
  const { 
    user, 
    isAuthenticated, 
    editProfile, 
    resetPassword, 
    // hasRole,  // Unused for now
    // hasCompany,  // Unused for now 
    isEmailVerified,
    error,
    clearError 
  } = useAuth();
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isProfileActionsLoading, setIsProfileActionsLoading] = useState(false);

  if (!isAuthenticated || !user) {
    return null;
  }

  /**
   * Handle profile editing
   */
  const handleEditProfile = async () => {
    setIsProfileActionsLoading(true);
    try {
      await editProfile();
    } catch (error) {
      console.error('Edit profile failed:', error);
    } finally {
      setIsProfileActionsLoading(false);
    }
  };

  /**
   * Handle password reset
   */
  const handleResetPassword = async () => {
    setIsProfileActionsLoading(true);
    try {
      await resetPassword();
    } catch (error) {
      console.error('Reset password failed:', error);
    } finally {
      setIsProfileActionsLoading(false);
    }
  };

  /**
   * Get user initials for avatar
   */
  const getUserInitials = () => {
    if (user.givenName && user.familyName) {
      return `${user.givenName.charAt(0)}${user.familyName.charAt(0)}`.toUpperCase();
    }
    if (user.name) {
      const nameParts = user.name.split(' ');
      if (nameParts.length >= 2) {
        return `${nameParts[0].charAt(0)}${nameParts[nameParts.length - 1].charAt(0)}`.toUpperCase();
      }
      return nameParts[0].substring(0, 2).toUpperCase();
    }
    return user.email?.substring(0, 2).toUpperCase() || 'U';
  };

  /**
   * User avatar component
   */
  const UserAvatar = ({ size = 'md' }) => {
    const sizeClasses = {
      sm: 'h-8 w-8 text-xs',
      md: 'h-10 w-10 text-sm',
      lg: 'h-12 w-12 text-base',
      xl: 'h-16 w-16 text-lg',
    };

    return (
      <div className={`${sizeClasses[size]} bg-blue-600 rounded-full flex items-center justify-center text-white font-medium`}>
        {getUserInitials()}
      </div>
    );
  };

  /**
   * User info component
   */
  const UserInfo = ({ detailed = false }) => (
    <div className="flex-1 min-w-0">
      <div className="flex items-center space-x-2">
        <p className="text-sm font-medium text-gray-900 truncate">
          {user.name || user.email}
        </p>
        {!isEmailVerified() && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
            Unverified
          </span>
        )}
      </div>
      <p className="text-sm text-gray-500 truncate">{user.email}</p>
      {detailed && (
        <div className="mt-2 space-y-1">
          {user.jobTitle && (
            <p className="text-xs text-gray-500">{user.jobTitle}</p>
          )}
          {user.claims?.extension_Company && (
            <p className="text-xs text-gray-500">Company: {user.claims.extension_Company}</p>
          )}
          {user.claims?.roles && (
            <p className="text-xs text-gray-500">
              Roles: {Array.isArray(user.claims.roles) ? user.claims.roles.join(', ') : user.claims.roles}
            </p>
          )}
        </div>
      )}
    </div>
  );

  /**
   * Profile actions menu
   */
  const ProfileActions = () => (
    <div className="space-y-2">
      <button
        onClick={handleEditProfile}
        disabled={isProfileActionsLoading}
        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Edit Profile
      </button>
      <button
        onClick={handleResetPassword}
        disabled={isProfileActionsLoading}
        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Change Password
      </button>
      <hr className="my-2" />
      <div className="px-4 py-2">
        <LogoutButton 
          variant="ghost" 
          size="sm" 
          showIcon={true}
          showConfirmation={false}
          className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          Sign Out
        </LogoutButton>
      </div>
    </div>
  );

  // Dropdown variant
  if (variant === 'dropdown') {
    return (
      <div className={`relative ${className}`}>
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          aria-expanded={isDropdownOpen}
          aria-haspopup="true"
        >
          <UserAvatar size="sm" />
          <div className="hidden md:block">
            <UserInfo />
          </div>
          <svg 
            className={`w-4 h-4 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} 
            xmlns="http://www.w3.org/2000/svg" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isDropdownOpen && (
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 z-50">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <UserAvatar size="md" />
                <UserInfo detailed={showDetailedInfo} />
              </div>
            </div>
            {showProfileActions && <ProfileActions />}
          </div>
        )}

        {/* Backdrop */}
        {isDropdownOpen && (
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsDropdownOpen(false)}
          />
        )}
      </div>
    );
  }

  // Card variant
  if (variant === 'card') {
    return (
      <div className={`bg-white rounded-lg shadow border border-gray-200 p-6 ${className}`}>
        <div className="flex items-start space-x-4">
          <UserAvatar size="lg" />
          <div className="flex-1">
            <UserInfo detailed={showDetailedInfo} />
            {showProfileActions && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={handleEditProfile}
                  disabled={isProfileActionsLoading}
                  className="px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Edit Profile
                </button>
                <button
                  onClick={handleResetPassword}
                  disabled={isProfileActionsLoading}
                  className="px-3 py-2 text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Change Password
                </button>
                <LogoutButton 
                  variant="outline" 
                  size="sm" 
                  showIcon={false}
                  showConfirmation={true}
                  className="text-red-600 border-red-600 hover:bg-red-50"
                >
                  Sign Out
                </LogoutButton>
              </div>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Profile action failed</h3>
                <div className="mt-1 text-sm text-red-700">
                  {error.message || 'An unexpected error occurred.'}
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

  // Inline variant
  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      <UserAvatar size="sm" />
      <UserInfo detailed={showDetailedInfo} />
      {showProfileActions && (
        <div className="flex items-center space-x-2">
          <button
            onClick={handleEditProfile}
            disabled={isProfileActionsLoading}
            className="text-sm text-blue-600 hover:text-blue-700 underline focus:outline-none disabled:opacity-50"
          >
            Edit
          </button>
          <LogoutButton 
            variant="ghost" 
            size="sm" 
            showIcon={false}
            showConfirmation={false}
            className="text-red-600 hover:text-red-700"
          >
            Sign Out
          </LogoutButton>
        </div>
      )}
    </div>
  );
};

export default UserProfile;
