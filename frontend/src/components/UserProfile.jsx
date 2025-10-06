import React, { useState, useRef, useEffect } from 'react';
import useAuth from '../hooks/useAuth';
import LogoutButton from './LogoutButton';

/**
 * UserProfile Component
 * Displays user information and provides logout functionality
 */
const UserProfile = ({ 
  showLogout = true,
  className = ""
}) => {
  const { user, displayName, email, isAuthenticated } = useAuth();
  const [showHelpMenu, setShowHelpMenu] = useState(false);
  const helpMenuRef = useRef(null);

  // Close help menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (helpMenuRef.current && !helpMenuRef.current.contains(event.target)) {
        setShowHelpMenu(false);
      }
    };

    if (showHelpMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showHelpMenu]);

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

  return (
    <div className={`flex items-center space-x-3 bg-background-cream border border-gray-200 rounded-lg px-3 py-2 shadow-sm ${className}`}>
      {/* User Avatar */}
      <div className="w-8 h-8 bg-secondary-500 rounded-full flex items-center justify-center ring-2 ring-secondary-100">
        <span className="text-white font-medium text-sm">{initials}</span>
      </div>
      
      {/* User Info */}
      <div className="flex-1 min-w-0">
        <div className="body-small text-text-primary">
          <span className="text-emphasis">{displayName}</span>
        </div>
        {email && email !== displayName && (
          <div className="body-xs text-text-muted truncate">{email}</div>
        )}
      </div>
      
      {/* Logout Button */}
      {showLogout && (
        <div className="flex-shrink-0">
          <LogoutButton className="bg-secondary-100 hover:bg-secondary-200 text-sm text-text-primary" />
        </div>
      )}
      
      {/* Vertical Divider */}
      <div className="h-8 w-px bg-gray-300"></div>
      
      {/* Help Button */}
      <div className="flex-shrink-0 relative" ref={helpMenuRef}>
        <button
          onClick={() => setShowHelpMenu(!showHelpMenu)}
          className="text-sm text-gray-600 hover:text-primary-600 transition-colors whitespace-nowrap"
          title="Help & Support"
        >
          Have feedback <br /> or need help?
        </button>
        
        {/* Help Menu Dropdown */}
        {showHelpMenu && (
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg border border-gray-200 shadow-lg z-50 p-4">
            <div className="text-sm text-text-secondary">
              <p className="mb-1">Email:</p>
              <a 
                href="mailto:wzunker@mit.edu" 
                className="text-primary-600 hover:text-primary-700 underline break-all"
              >
                wzunker@mit.edu
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfile;
