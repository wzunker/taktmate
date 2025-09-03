/**
 * Protected Route Component for TaktMate
 * 
 * This component wraps routes that require authentication and provides
 * role-based access control and loading states.
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import LoginButton from './LoginButton';

const ProtectedRoute = ({ 
  children, 
  requiredRoles = [], 
  requiredCompany = null,
  requireEmailVerification = false,
  fallbackComponent = null,
  redirectTo = '/login',
  showLoginPrompt = true
}) => {
  const { 
    isAuthenticated, 
    isLoading, 
    user, 
    hasRole, 
    hasCompany, 
    isEmailVerified 
  } = useAuth();
  const location = useLocation();

  // Show loading spinner while authentication status is being determined
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, show login prompt or redirect
  if (!isAuthenticated) {
    if (showLoginPrompt && !fallbackComponent) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full space-y-8 p-8">
            <div className="text-center">
              <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                Authentication Required
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                Please sign in to access this page
              </p>
            </div>
            <div className="mt-8">
              <LoginButton 
                variant="primary"
                size="lg"
                className="w-full"
              >
                Sign In to Continue
              </LoginButton>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">
                You'll be redirected back to this page after signing in
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (fallbackComponent) {
      return fallbackComponent;
    }

    // Redirect to login page with return URL
    return (
      <Navigate 
        to={redirectTo} 
        state={{ from: location }} 
        replace 
      />
    );
  }

  // Check email verification requirement
  if (requireEmailVerification && !isEmailVerified()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8 p-8">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 text-yellow-400">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.93L13.732 4.242a2 2 0 00-3.464 0L3.34 16.07c-.77 1.263.192 2.93 1.732 2.93z" />
              </svg>
            </div>
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              Email Verification Required
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Please verify your email address to access this page
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Check your inbox for a verification email from Azure AD B2C
            </p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-sm text-blue-800">
              <p className="font-medium">Need help?</p>
              <ul className="mt-2 space-y-1 list-disc list-inside">
                <li>Check your spam folder</li>
                <li>Make sure you clicked the verification link</li>
                <li>Try signing out and signing back in</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Check role requirements
  if (requiredRoles.length > 0) {
    const hasRequiredRole = requiredRoles.some(role => hasRole(role));
    
    if (!hasRequiredRole) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full space-y-8 p-8">
            <div className="text-center">
              <div className="mx-auto h-12 w-12 text-red-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 0h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                Access Denied
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                You don't have the required permissions to access this page
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Required roles: {requiredRoles.join(', ')}
              </p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="text-sm text-red-800">
                <p className="font-medium">Need access?</p>
                <p className="mt-1">Contact your administrator to request the appropriate permissions.</p>
              </div>
            </div>
          </div>
        </div>
      );
    }
  }

  // Check company requirement
  if (requiredCompany && !hasCompany(requiredCompany)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8 p-8">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 text-red-400">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              Organization Access Required
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              This page is restricted to members of {requiredCompany}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Your current organization: {user?.claims?.extension_Company || 'Not specified'}
            </p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-sm text-red-800">
              <p className="font-medium">Wrong organization?</p>
              <p className="mt-1">Make sure you're signed in with the correct organizational account.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // All checks passed, render the protected content
  return children;
};

/**
 * Higher-order component for protecting routes
 */
export const withProtectedRoute = (Component, options = {}) => {
  return function ProtectedComponent(props) {
    return (
      <ProtectedRoute {...options}>
        <Component {...props} />
      </ProtectedRoute>
    );
  };
};

/**
 * Component for admin-only routes
 */
export const AdminRoute = ({ children, ...props }) => {
  return (
    <ProtectedRoute 
      requiredRoles={['Admin', 'Administrator']}
      requireEmailVerification={true}
      {...props}
    >
      {children}
    </ProtectedRoute>
  );
};

/**
 * Component for manager-level routes
 */
export const ManagerRoute = ({ children, ...props }) => {
  return (
    <ProtectedRoute 
      requiredRoles={['Admin', 'Administrator', 'Manager']}
      requireEmailVerification={true}
      {...props}
    >
      {children}
    </ProtectedRoute>
  );
};

/**
 * Component for user routes (any authenticated user)
 */
export const UserRoute = ({ children, ...props }) => {
  return (
    <ProtectedRoute 
      requireEmailVerification={false}
      {...props}
    >
      {children}
    </ProtectedRoute>
  );
};

export default ProtectedRoute;
