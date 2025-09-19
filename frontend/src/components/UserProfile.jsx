import React from 'react';
import useAuth from '../hooks/useAuth';
import LogoutButton from './LogoutButton';

/**
 * UserProfile Component
 * Displays user information and provides logout functionality
 */
const UserProfile = ({ 
  showLogout = true, 
  layout = "horizontal", // "horizontal" or "vertical"
  className = ""
}) => {
  const { user, displayName, email, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) {
    return null;
  }

  // Get user initials for avatar
  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(part => part.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  };

  const initials = getInitials(displayName);

  if (layout === "vertical") {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
        <div className="text-center">
          {/* User Avatar */}
          <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-white font-medium text-lg">{initials}</span>
          </div>
          
          {/* User Info */}
          <div className="mb-4">
            <h3 className="font-medium text-gray-900">{displayName}</h3>
            {email && email !== displayName && (
              <p className="text-sm text-gray-500 mt-1">{email}</p>
            )}
            {user.identityProvider && user.identityProvider !== 'unknown' && (
              <p className="text-xs text-gray-400 mt-1">
                via {user.identityProvider}
              </p>
            )}
          </div>
          
          {/* Logout Button */}
          {showLogout && (
            <LogoutButton 
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded text-sm transition-colors"
              showConfirmation={true}
            />
          )}
        </div>
      </div>
    );
  }

  // Horizontal layout (default)
  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      {/* User Avatar */}
      <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
        <span className="text-white font-medium text-sm">{initials}</span>
      </div>
      
      {/* User Info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm text-gray-700">
          Welcome, <span className="font-medium">{displayName}</span>
        </div>
        {email && email !== displayName && (
          <div className="text-xs text-gray-500 truncate">{email}</div>
        )}
      </div>
      
      {/* Logout Button */}
      {showLogout && (
        <LogoutButton />
      )}
    </div>
  );
};

export default UserProfile;
