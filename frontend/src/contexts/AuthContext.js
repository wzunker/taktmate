import React, { createContext, useContext, useReducer, useEffect } from 'react';

// Initial authentication state
const initialState = {
  isAuthenticated: false,
  user: null,
  isLoading: true,
  error: null
};

// Authentication action types
const AUTH_ACTIONS = {
  SET_LOADING: 'SET_LOADING',
  SET_AUTHENTICATED: 'SET_AUTHENTICATED',
  SET_UNAUTHENTICATED: 'SET_UNAUTHENTICATED',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR'
};

// Authentication reducer
const authReducer = (state, action) => {
  switch (action.type) {
    case AUTH_ACTIONS.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload,
        error: null
      };
    
    case AUTH_ACTIONS.SET_AUTHENTICATED:
      return {
        ...state,
        isAuthenticated: true,
        user: action.payload,
        isLoading: false,
        error: null
      };
    
    case AUTH_ACTIONS.SET_UNAUTHENTICATED:
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: null
      };
    
    case AUTH_ACTIONS.SET_ERROR:
      return {
        ...state,
        error: action.payload,
        isLoading: false
      };
    
    case AUTH_ACTIONS.CLEAR_ERROR:
      return {
        ...state,
        error: null
      };
    
    default:
      return state;
  }
};

// Create the authentication context
const AuthContext = createContext();

// Authentication provider component
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Function to check authentication status
  const checkAuthStatus = async () => {
    try {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
      
      const response = await fetch('/.auth/me');
      const data = await response.json();
      
      // Check if user is authenticated
      if (response.ok && data.clientPrincipal) {
        dispatch({ 
          type: AUTH_ACTIONS.SET_AUTHENTICATED, 
          payload: {
            id: data.clientPrincipal.userId,
            name: data.clientPrincipal.userDetails,
            email: data.clientPrincipal.userDetails,
            roles: data.clientPrincipal.userRoles,
            identityProvider: data.clientPrincipal.identityProvider,
            claims: data.clientPrincipal.claims || []
          }
        });
      } else {
        dispatch({ type: AUTH_ACTIONS.SET_UNAUTHENTICATED });
      }
    } catch (error) {
      console.error('Error checking authentication status:', error);
      dispatch({ 
        type: AUTH_ACTIONS.SET_ERROR, 
        payload: 'Failed to check authentication status' 
      });
    }
  };

  // Function to initiate login
  const login = () => {
    window.location.href = '/.auth/login/entraExternalId';
  };

  // Function to initiate logout
  const logout = () => {
    window.location.href = '/.auth/logout';
  };

  // Function to refresh user data
  const refreshUser = async () => {
    await checkAuthStatus();
  };

  // Function to clear errors
  const clearError = () => {
    dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });
  };

  // Context value
  const value = {
    // State
    isAuthenticated: state.isAuthenticated,
    user: state.user,
    isLoading: state.isLoading,
    error: state.error,
    
    // Actions
    login,
    logout,
    refreshUser,
    clearError,
    checkAuthStatus
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use authentication context
export const useAuthContext = () => {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  
  return context;
};

export default AuthContext;
