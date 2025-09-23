import React, { useState } from 'react';
import useAuth from '../hooks/useAuth';

/**
 * UserDebug Component
 * Shows all user claims for debugging authentication issues
 * This component should only be used during development/testing
 */
const UserDebug = ({ className = "" }) => {
  const { user, isAuthenticated, displayName, fullName, email, company, jobTitle } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isAuthenticated || !user) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
        <p className="text-red-700 font-medium">User not authenticated</p>
      </div>
    );
  }

  return (
    <div className={`bg-yellow-50 border border-yellow-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-yellow-800">🔍 User Debug Info</h3>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-yellow-600 hover:text-yellow-800 text-sm font-medium"
        >
          {isExpanded ? 'Hide Details' : 'Show Details'}
        </button>
      </div>
      
      {/* Processed Values */}
      <div className="space-y-2 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <span className="font-medium text-yellow-800">Display Name:</span>
          <span className="text-yellow-700">{displayName || 'Not found'}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <span className="font-medium text-yellow-800">Full Name:</span>
          <span className="text-yellow-700">{fullName || 'Not found'}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <span className="font-medium text-yellow-800">Email:</span>
          <span className="text-yellow-700">{email || 'Not found'}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <span className="font-medium text-yellow-800">Company:</span>
          <span className="text-yellow-700">{company || 'Not found'}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <span className="font-medium text-yellow-800">Job Title:</span>
          <span className="text-yellow-700">{jobTitle || 'Not found'}</span>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-yellow-300">
          {/* Basic User Info */}
          <div className="mb-4">
            <h4 className="font-medium text-yellow-800 mb-2">Basic User Info:</h4>
            <div className="bg-yellow-100 rounded p-3 text-xs font-mono overflow-auto">
              <pre>{JSON.stringify({
                id: user.id,
                name: user.name,
                email: user.email,
                identityProvider: user.identityProvider,
                roles: user.roles
              }, null, 2)}</pre>
            </div>
          </div>

          {/* All Claims */}
          <div>
            <h4 className="font-medium text-yellow-800 mb-2">All Claims ({user.claims?.length || 0}):</h4>
            {user.claims && user.claims.length > 0 ? (
              <div className="bg-yellow-100 rounded p-3 text-xs font-mono overflow-auto max-h-64">
                <pre>{JSON.stringify(user.claims, null, 2)}</pre>
              </div>
            ) : (
              <p className="text-yellow-700 text-sm">No claims found</p>
            )}
          </div>

          {/* Instructions */}
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
            <p className="text-blue-800 font-medium mb-1">🔧 Troubleshooting:</p>
            <ul className="text-blue-700 text-xs space-y-1">
              <li>• Look for claims with "extension_" prefix (External ID custom attributes)</li>
              <li>• Check if FirstName, LastName, Company, JobTitle claims exist</li>
              <li>• If claims are missing, verify your Azure user flow configuration</li>
              <li>• Ensure staticwebapp.config.json includes proper scopes</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserDebug;
