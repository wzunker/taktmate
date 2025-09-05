/**
 * Authentication Context Provider for TaktMate
 * 
 * This context provides authentication state and methods throughout the application.
 * It wraps the MSAL React library and provides a simplified interface for components.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  useMsal, 
  useAccount, 
  useIsAuthenticated,
  AuthenticatedTemplate,
  UnauthenticatedTemplate 
} from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import { loginRequest, protectedResources, authorities } from '../config/authConfig';

// Create the authentication context
const AuthContext = createContext();

/**
 * Custom hook to use the authentication context
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/**
 * Authentication Provider Component
 */
export const AuthProvider = ({ children }) => {
  const { instance, accounts, inProgress } = useMsal();
  const account = useAccount(accounts[0] || {});
  const isAuthenticated = useIsAuthenticated();
  
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [accessToken, setAccessToken] = useState(null);

  /**
   * Extract user information from the account
   */
  useEffect(() => {
    if (account) {
      const userData = {
        id: account.localAccountId,
        email: account.username,
        name: account.name || account.username,
        givenName: account.idTokenClaims?.given_name,
        familyName: account.idTokenClaims?.family_name,
        jobTitle: account.idTokenClaims?.jobTitle,
        tenantId: account.tenantId,
        homeAccountId: account.homeAccountId,
        environment: account.environment,
        claims: account.idTokenClaims || {},
      };
      setUser(userData);
    } else {
      setUser(null);
    }
  }, [account]);

  /**
   * Update loading state based on MSAL interaction status
   */
  useEffect(() => {
    setIsLoading(inProgress !== InteractionStatus.None);
  }, [inProgress]);

  /**
   * Acquire access token silently
   */
  const acquireAccessToken = async (forceRefresh = false) => {
    if (!account) {
      throw new Error('No account available for token acquisition');
    }

    try {
      const request = {
        ...loginRequest,
        account: account,
        forceRefresh: forceRefresh,
      };

      const response = await instance.acquireTokenSilent(request);
      setAccessToken(response.accessToken);
      setError(null);
      return response.accessToken;
    } catch (error) {
      console.error('Silent token acquisition failed:', error);
      
      // If silent acquisition fails, try interactive acquisition
      try {
        const response = await instance.acquireTokenPopup(request);
        setAccessToken(response.accessToken);
        setError(null);
        return response.accessToken;
      } catch (interactiveError) {
        console.error('Interactive token acquisition failed:', interactiveError);
        setError(interactiveError);
        throw interactiveError;
      }
    }
  };

  /**
   * Sign in with popup
   */
  const signIn = async () => {
    try {
      setError(null);
      const response = await instance.loginPopup(loginRequest);
      console.log('Sign in successful:', response);
      return response;
    } catch (error) {
      console.error('Sign in failed:', error);
      setError(error);
      throw error;
    }
  };

  /**
   * Sign in with redirect
   */
  const signInRedirect = async () => {
    try {
      setError(null);
      await instance.loginRedirect(loginRequest);
    } catch (error) {
      console.error('Sign in redirect failed:', error);
      setError(error);
      throw error;
    }
  };

  /**
   * Sign out
   */
  const signOut = async (signOutType = 'popup') => {
    try {
      setError(null);
      const logoutRequest = {
        account: account,
        postLogoutRedirectUri: window.location.origin,
      };

      if (signOutType === 'redirect') {
        await instance.logoutRedirect(logoutRequest);
      } else {
        await instance.logoutPopup(logoutRequest);
      }
      
      setUser(null);
      setAccessToken(null);
    } catch (error) {
      console.error('Sign out failed:', error);
      setError(error);
      throw error;
    }
  };

  /**
   * Edit profile (redirect to Microsoft Entra External ID profile editing flow)
   */
  const editProfile = async () => {
    try {
      setError(null);
      const editProfileRequest = {
        authority: authorities.editProfile.authority,
        scopes: loginRequest.scopes,
        account: account,
      };

      await instance.loginRedirect(editProfileRequest);
    } catch (error) {
      console.error('Edit profile failed:', error);
      setError(error);
      throw error;
    }
  };

  /**
   * Reset password (redirect to Microsoft Entra External ID password reset flow)
   */
  const resetPassword = async () => {
    try {
      setError(null);
      const resetPasswordRequest = {
        authority: authorities.resetPassword.authority,
        scopes: loginRequest.scopes,
      };

      await instance.loginRedirect(resetPasswordRequest);
    } catch (error) {
      console.error('Reset password failed:', error);
      setError(error);
      throw error;
    }
  };

  /**
   * Get authenticated API headers
   */
  const getAuthHeaders = async (forceRefresh = false) => {
    try {
      const token = accessToken && !forceRefresh ? accessToken : await acquireAccessToken(forceRefresh);
      return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };
    } catch (error) {
      console.error('Failed to get auth headers:', error);
      throw error;
    }
  };

  /**
   * Check if user has specific role or permission
   */
  const hasRole = (role) => {
    if (!user || !user.claims) return false;
    
    // Check for roles in different claim locations
    const roles = user.claims.roles || 
                  user.claims.extension_Role || 
                  user.claims['extension_Role'] ||
                  [];
    
    return Array.isArray(roles) ? roles.includes(role) : roles === role;
  };

  /**
   * Check if user belongs to specific company
   */
  const hasCompany = (company) => {
    if (!user || !user.claims) return false;
    
    const userCompany = user.claims.extension_Company || 
                       user.claims['extension_Company'] ||
                       user.claims.companyName ||
                       '';
    
    return userCompany === company;
  };

  /**
   * Check if email is verified
   */
  const isEmailVerified = () => {
    if (!user || !user.claims) return false;
    
    return user.claims.email_verified === true || 
           user.claims.emails_verified === true ||
           user.claims.verified === true;
  };

  /**
   * Clear error state
   */
  const clearError = () => {
    setError(null);
  };

  /**
   * Context value
   */
  const contextValue = {
    // State
    user,
    isAuthenticated,
    isLoading,
    error,
    accessToken,
    account,
    
    // Authentication methods
    signIn,
    signInRedirect,
    signOut,
    editProfile,
    resetPassword,
    
    // Token management
    acquireAccessToken,
    getAuthHeaders,
    
    // Utility methods
    hasRole,
    hasCompany,
    isEmailVerified,
    clearError,
    
    // MSAL instance (for advanced usage)
    msalInstance: instance,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Higher-order component for authenticated routes
 */
export const withAuth = (Component) => {
  return function AuthenticatedComponent(props) {
    return (
      <AuthenticatedTemplate>
        <Component {...props} />
      </AuthenticatedTemplate>
    );
  };
};

/**
 * Higher-order component for unauthenticated routes
 */
export const withoutAuth = (Component) => {
  return function UnauthenticatedComponent(props) {
    return (
      <UnauthenticatedTemplate>
        <Component {...props} />
      </UnauthenticatedTemplate>
    );
  };
};

/**
 * Component for authenticated content
 */
export const AuthenticatedContent = ({ children, fallback = null }) => {
  return (
    <AuthenticatedTemplate>
      {children}
    </AuthenticatedTemplate>
  );
};

/**
 * Component for unauthenticated content
 */
export const UnauthenticatedContent = ({ children, fallback = null }) => {
  return (
    <UnauthenticatedTemplate>
      {children}
    </UnauthenticatedTemplate>
  );
};
