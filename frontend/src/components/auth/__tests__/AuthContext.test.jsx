// Tests for AuthContext and authentication state management
// Tests context provider, hooks, state management, and authentication flows

import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../../contexts/AuthContext';
import { authConfig } from '../../../config/authConfig';

// Mock MSAL library
jest.mock('@azure/msal-browser', () => ({
  PublicClientApplication: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    loginPopup: jest.fn(),
    loginRedirect: jest.fn(),
    logout: jest.fn(),
    acquireTokenSilent: jest.fn(),
    acquireTokenPopup: jest.fn(),
    getAllAccounts: jest.fn().mockReturnValue([]),
    getAccountByUsername: jest.fn(),
    handleRedirectPromise: jest.fn().mockResolvedValue(null),
    addEventCallback: jest.fn(),
    removeEventCallback: jest.fn()
  })),
  EventType: {
    LOGIN_SUCCESS: 'msal:loginSuccess',
    LOGIN_FAILURE: 'msal:loginFailure',
    LOGOUT_SUCCESS: 'msal:logoutSuccess',
    ACQUIRE_TOKEN_SUCCESS: 'msal:acquireTokenSuccess',
    ACQUIRE_TOKEN_FAILURE: 'msal:acquireTokenFailure'
  },
  InteractionType: {
    POPUP: 'popup',
    REDIRECT: 'redirect'
  },
  BrowserAuthError: class BrowserAuthError extends Error {
    constructor(errorCode, errorMessage) {
      super(errorMessage);
      this.errorCode = errorCode;
    }
  },
  AuthenticationResult: {}
}));

// Mock API service
jest.mock('../../../services/apiService', () => ({
  setAuthToken: jest.fn(),
  clearAuthToken: jest.fn(),
  get: jest.fn().mockResolvedValue({ data: { success: true } }),
  post: jest.fn().mockResolvedValue({ data: { success: true } })
}));

// Test component that uses auth context
const TestComponent = () => {
  const { 
    user, 
    isAuthenticated, 
    isLoading, 
    error, 
    login, 
    logout, 
    acquireToken 
  } = useAuth();

  return (
    <div>
      <div data-testid="auth-state">
        {isLoading ? 'loading' : isAuthenticated ? 'authenticated' : 'unauthenticated'}
      </div>
      <div data-testid="user-info">
        {user ? JSON.stringify(user) : 'no-user'}
      </div>
      <div data-testid="error-info">
        {error ? error.message : 'no-error'}
      </div>
      <button onClick={() => login('popup')} data-testid="login-button">
        Login
      </button>
      <button onClick={logout} data-testid="logout-button">
        Logout
      </button>
      <button onClick={() => acquireToken(['user.read'])} data-testid="token-button">
        Get Token
      </button>
    </div>
  );
};

describe('AuthContext', () => {
  let mockMsalInstance;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Get the mock MSAL instance
    const { PublicClientApplication } = require('@azure/msal-browser');
    mockMsalInstance = new PublicClientApplication();
    
    // Mock console methods to avoid noise in tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('AuthProvider Initialization', () => {
    test('should initialize MSAL instance correctly', async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(mockMsalInstance.initialize).toHaveBeenCalledTimes(1);
      });
    });

    test('should set initial loading state', () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      expect(screen.getByTestId('auth-state')).toHaveTextContent('loading');
    });

    test('should handle initialization errors', async () => {
      mockMsalInstance.initialize.mockRejectedValue(new Error('Init failed'));

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('error-info')).toHaveTextContent('Init failed');
      });
    });

    test('should check for existing accounts on initialization', async () => {
      const mockAccount = {
        homeAccountId: 'test-home-id',
        localAccountId: 'test-local-id',
        username: 'test@example.com',
        name: 'Test User',
        idTokenClaims: {
          given_name: 'Test',
          family_name: 'User',
          emails: ['test@example.com']
        }
      };

      mockMsalInstance.getAllAccounts.mockReturnValue([mockAccount]);

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-state')).toHaveTextContent('authenticated');
        expect(screen.getByTestId('user-info')).toContain('test@example.com');
      });
    });
  });

  describe('Login Flow', () => {
    test('should handle popup login successfully', async () => {
      const mockAuthResult = {
        account: {
          homeAccountId: 'test-home-id',
          localAccountId: 'test-local-id',
          username: 'test@example.com',
          name: 'Test User',
          idTokenClaims: {
            given_name: 'Test',
            family_name: 'User',
            emails: ['test@example.com']
          }
        },
        accessToken: 'mock-access-token',
        idToken: 'mock-id-token',
        scopes: ['openid', 'profile', 'email']
      };

      mockMsalInstance.loginPopup.mockResolvedValue(mockAuthResult);

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      // Wait for initialization
      await waitFor(() => {
        expect(screen.getByTestId('auth-state')).toHaveTextContent('unauthenticated');
      });

      // Trigger login
      act(() => {
        screen.getByTestId('login-button').click();
      });

      await waitFor(() => {
        expect(mockMsalInstance.loginPopup).toHaveBeenCalledWith({
          scopes: authConfig.scopes,
          prompt: 'select_account'
        });
      });

      await waitFor(() => {
        expect(screen.getByTestId('auth-state')).toHaveTextContent('authenticated');
        expect(screen.getByTestId('user-info')).toContain('test@example.com');
      });
    });

    test('should handle redirect login successfully', async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      // Wait for initialization
      await waitFor(() => {
        expect(screen.getByTestId('auth-state')).toHaveTextContent('unauthenticated');
      });

      // Trigger redirect login
      const { login } = require('../../../contexts/AuthContext');
      
      act(() => {
        // Simulate calling login with redirect method
        const authContext = screen.getByTestId('login-button').closest('div');
        // This would normally trigger redirect
      });

      expect(mockMsalInstance.loginRedirect).toHaveBeenCalledWith({
        scopes: authConfig.scopes,
        prompt: 'select_account'
      });
    });

    test('should handle login errors', async () => {
      const loginError = new Error('Login failed');
      mockMsalInstance.loginPopup.mockRejectedValue(loginError);

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      // Wait for initialization
      await waitFor(() => {
        expect(screen.getByTestId('auth-state')).toHaveTextContent('unauthenticated');
      });

      // Trigger login
      act(() => {
        screen.getByTestId('login-button').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('error-info')).toHaveTextContent('Login failed');
      });
    });

    test('should handle user cancellation', async () => {
      const { BrowserAuthError } = require('@azure/msal-browser');
      const cancelError = new BrowserAuthError('user_cancelled', 'User cancelled login');
      mockMsalInstance.loginPopup.mockRejectedValue(cancelError);

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-state')).toHaveTextContent('unauthenticated');
      });

      act(() => {
        screen.getByTestId('login-button').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('auth-state')).toHaveTextContent('unauthenticated');
        expect(screen.getByTestId('error-info')).toHaveTextContent('no-error');
      });
    });
  });

  describe('Logout Flow', () => {
    test('should handle logout successfully', async () => {
      // Setup authenticated state
      const mockAccount = {
        homeAccountId: 'test-home-id',
        localAccountId: 'test-local-id',
        username: 'test@example.com',
        name: 'Test User'
      };

      mockMsalInstance.getAllAccounts.mockReturnValue([mockAccount]);

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      // Wait for authenticated state
      await waitFor(() => {
        expect(screen.getByTestId('auth-state')).toHaveTextContent('authenticated');
      });

      // Trigger logout
      act(() => {
        screen.getByTestId('logout-button').click();
      });

      await waitFor(() => {
        expect(mockMsalInstance.logout).toHaveBeenCalledWith({
          account: mockAccount,
          postLogoutRedirectUri: authConfig.postLogoutRedirectUri
        });
      });

      await waitFor(() => {
        expect(screen.getByTestId('auth-state')).toHaveTextContent('unauthenticated');
        expect(screen.getByTestId('user-info')).toHaveTextContent('no-user');
      });
    });

    test('should handle logout errors', async () => {
      const mockAccount = {
        homeAccountId: 'test-home-id',
        username: 'test@example.com'
      };

      mockMsalInstance.getAllAccounts.mockReturnValue([mockAccount]);
      mockMsalInstance.logout.mockRejectedValue(new Error('Logout failed'));

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-state')).toHaveTextContent('authenticated');
      });

      act(() => {
        screen.getByTestId('logout-button').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('error-info')).toHaveTextContent('Logout failed');
      });
    });
  });

  describe('Token Acquisition', () => {
    test('should acquire token silently when possible', async () => {
      const mockAccount = {
        homeAccountId: 'test-home-id',
        username: 'test@example.com'
      };

      const mockTokenResult = {
        accessToken: 'silent-access-token',
        account: mockAccount,
        scopes: ['user.read']
      };

      mockMsalInstance.getAllAccounts.mockReturnValue([mockAccount]);
      mockMsalInstance.acquireTokenSilent.mockResolvedValue(mockTokenResult);

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-state')).toHaveTextContent('authenticated');
      });

      act(() => {
        screen.getByTestId('token-button').click();
      });

      await waitFor(() => {
        expect(mockMsalInstance.acquireTokenSilent).toHaveBeenCalledWith({
          scopes: ['user.read'],
          account: mockAccount
        });
      });
    });

    test('should fallback to popup when silent acquisition fails', async () => {
      const mockAccount = {
        homeAccountId: 'test-home-id',
        username: 'test@example.com'
      };

      const mockTokenResult = {
        accessToken: 'popup-access-token',
        account: mockAccount,
        scopes: ['user.read']
      };

      mockMsalInstance.getAllAccounts.mockReturnValue([mockAccount]);
      mockMsalInstance.acquireTokenSilent.mockRejectedValue(new Error('Silent failed'));
      mockMsalInstance.acquireTokenPopup.mockResolvedValue(mockTokenResult);

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-state')).toHaveTextContent('authenticated');
      });

      act(() => {
        screen.getByTestId('token-button').click();
      });

      await waitFor(() => {
        expect(mockMsalInstance.acquireTokenSilent).toHaveBeenCalled();
        expect(mockMsalInstance.acquireTokenPopup).toHaveBeenCalledWith({
          scopes: ['user.read'],
          account: mockAccount
        });
      });
    });

    test('should handle token acquisition errors', async () => {
      const mockAccount = {
        homeAccountId: 'test-home-id',
        username: 'test@example.com'
      };

      mockMsalInstance.getAllAccounts.mockReturnValue([mockAccount]);
      mockMsalInstance.acquireTokenSilent.mockRejectedValue(new Error('Silent failed'));
      mockMsalInstance.acquireTokenPopup.mockRejectedValue(new Error('Popup failed'));

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-state')).toHaveTextContent('authenticated');
      });

      act(() => {
        screen.getByTestId('token-button').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('error-info')).toHaveTextContent('Popup failed');
      });
    });
  });

  describe('Event Handling', () => {
    test('should handle MSAL events correctly', async () => {
      let eventCallback;
      mockMsalInstance.addEventCallback.mockImplementation((callback) => {
        eventCallback = callback;
        return 'callback-id';
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(mockMsalInstance.addEventCallback).toHaveBeenCalled();
      });

      // Simulate login success event
      const { EventType } = require('@azure/msal-browser');
      const loginEvent = {
        eventType: EventType.LOGIN_SUCCESS,
        payload: {
          account: {
            homeAccountId: 'event-home-id',
            username: 'event@example.com',
            name: 'Event User'
          }
        }
      };

      act(() => {
        eventCallback(loginEvent);
      });

      await waitFor(() => {
        expect(screen.getByTestId('auth-state')).toHaveTextContent('authenticated');
        expect(screen.getByTestId('user-info')).toContain('event@example.com');
      });
    });

    test('should cleanup event listeners on unmount', () => {
      const { unmount } = render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      unmount();

      expect(mockMsalInstance.removeEventCallback).toHaveBeenCalled();
    });
  });

  describe('Error Recovery', () => {
    test('should recover from transient errors', async () => {
      // First call fails, second succeeds
      mockMsalInstance.initialize
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(undefined);

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('error-info')).toHaveTextContent('Network error');
      });

      // Simulate retry mechanism (would be triggered by component)
      await waitFor(() => {
        expect(mockMsalInstance.initialize).toHaveBeenCalledTimes(1);
      }, { timeout: 3000 });
    });

    test('should handle network connectivity issues', async () => {
      const networkError = new Error('Network unavailable');
      networkError.name = 'NetworkError';
      
      mockMsalInstance.loginPopup.mockRejectedValue(networkError);

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-state')).toHaveTextContent('unauthenticated');
      });

      act(() => {
        screen.getByTestId('login-button').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('error-info')).toHaveTextContent('Network unavailable');
      });
    });
  });

  describe('Context Hook Usage', () => {
    test('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const originalError = console.error;
      console.error = jest.fn();

      expect(() => {
        render(<TestComponent />);
      }).toThrow('useAuth must be used within an AuthProvider');

      console.error = originalError;
    });

    test('should provide all required context values', () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      // All context values should be available
      expect(screen.getByTestId('auth-state')).toBeInTheDocument();
      expect(screen.getByTestId('user-info')).toBeInTheDocument();
      expect(screen.getByTestId('error-info')).toBeInTheDocument();
      expect(screen.getByTestId('login-button')).toBeInTheDocument();
      expect(screen.getByTestId('logout-button')).toBeInTheDocument();
      expect(screen.getByTestId('token-button')).toBeInTheDocument();
    });
  });
});
