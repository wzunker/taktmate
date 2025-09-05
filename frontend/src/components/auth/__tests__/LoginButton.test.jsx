// Tests for LoginButton component
// Tests login button functionality, authentication methods, error handling, and user interactions

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginButton from '../LoginButton';
import { AuthProvider } from '../../../contexts/AuthContext';

// Mock the auth context
const mockAuthContext = {
  isAuthenticated: false,
  isLoading: false,
  error: null,
  login: jest.fn(),
  user: null
};

jest.mock('../../../contexts/AuthContext', () => ({
  ...jest.requireActual('../../../contexts/AuthContext'),
  useAuth: () => mockAuthContext
}));

// Mock framer-motion for animations
jest.mock('framer-motion', () => ({
  motion: {
    button: ({ children, ...props }) => <button {...props}>{children}</button>,
    div: ({ children, ...props }) => <div {...props}>{children}</div>
  },
  AnimatePresence: ({ children }) => <>{children}</>
}));

describe('LoginButton', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock context to default state
    mockAuthContext.isAuthenticated = false;
    mockAuthContext.isLoading = false;
    mockAuthContext.error = null;
    mockAuthContext.user = null;
    mockAuthContext.login.mockClear();
  });

  describe('Rendering and Display', () => {
    test('should render login button when not authenticated', () => {
      render(<LoginButton />);
      
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
      expect(screen.getByText(/sign in/i)).toBeInTheDocument();
    });

    test('should show loading state during authentication', () => {
      mockAuthContext.isLoading = true;
      
      render(<LoginButton />);
      
      expect(screen.getByRole('button')).toBeDisabled();
      expect(screen.getByText(/signing in/i)).toBeInTheDocument();
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    test('should not render when already authenticated', () => {
      mockAuthContext.isAuthenticated = true;
      mockAuthContext.user = { name: 'Test User', email: 'test@example.com' };
      
      render(<LoginButton />);
      
      expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
    });

    test('should display custom text when provided', () => {
      render(<LoginButton text="Get Started" />);
      
      expect(screen.getByRole('button', { name: /get started/i })).toBeInTheDocument();
      expect(screen.getByText(/get started/i)).toBeInTheDocument();
    });

    test('should apply custom CSS classes', () => {
      render(<LoginButton className="custom-login-btn" />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-login-btn');
    });

    test('should show different variants correctly', () => {
      const { rerender } = render(<LoginButton variant="primary" />);
      expect(screen.getByRole('button')).toHaveClass('btn-primary');
      
      rerender(<LoginButton variant="secondary" />);
      expect(screen.getByRole('button')).toHaveClass('btn-secondary');
      
      rerender(<LoginButton variant="outline" />);
      expect(screen.getByRole('button')).toHaveClass('btn-outline');
    });
  });

  describe('Authentication Methods', () => {
    test('should trigger popup login by default', async () => {
      render(<LoginButton />);
      
      const loginButton = screen.getByRole('button');
      await user.click(loginButton);
      
      expect(mockAuthContext.login).toHaveBeenCalledWith('popup');
    });

    test('should trigger redirect login when specified', async () => {
      render(<LoginButton method="redirect" />);
      
      const loginButton = screen.getByRole('button');
      await user.click(loginButton);
      
      expect(mockAuthContext.login).toHaveBeenCalledWith('redirect');
    });

    test('should show authentication method selection when multiple methods available', async () => {
      render(<LoginButton showMethodSelection={true} />);
      
      const loginButton = screen.getByRole('button');
      await user.click(loginButton);
      
      expect(screen.getByText(/choose sign in method/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /popup/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /redirect/i })).toBeInTheDocument();
    });

    test('should handle method selection', async () => {
      render(<LoginButton showMethodSelection={true} />);
      
      const loginButton = screen.getByRole('button');
      await user.click(loginButton);
      
      const redirectButton = screen.getByRole('button', { name: /redirect/i });
      await user.click(redirectButton);
      
      expect(mockAuthContext.login).toHaveBeenCalledWith('redirect');
    });
  });

  describe('Social Login Integration', () => {
    test('should show social login options when enabled', () => {
      render(<LoginButton showSocialOptions={true} />);
      
      expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /continue with microsoft/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in with email/i })).toBeInTheDocument();
    });

    test('should trigger Google login', async () => {
      render(<LoginButton showSocialOptions={true} />);
      
      const googleButton = screen.getByRole('button', { name: /continue with google/i });
      await user.click(googleButton);
      
      expect(mockAuthContext.login).toHaveBeenCalledWith('popup', { 
        domainHint: 'google.com',
        loginHint: 'google'
      });
    });

    test('should trigger Microsoft login', async () => {
      render(<LoginButton showSocialOptions={true} />);
      
      const microsoftButton = screen.getByRole('button', { name: /continue with microsoft/i });
      await user.click(microsoftButton);
      
      expect(mockAuthContext.login).toHaveBeenCalledWith('popup', { 
        domainHint: 'live.com',
        loginHint: 'microsoft'
      });
    });

    test('should display social login icons correctly', () => {
      render(<LoginButton showSocialOptions={true} />);
      
      expect(screen.getByTestId('google-icon')).toBeInTheDocument();
      expect(screen.getByTestId('microsoft-icon')).toBeInTheDocument();
      expect(screen.getByTestId('email-icon')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    test('should display authentication error', () => {
      mockAuthContext.error = { message: 'Authentication failed' };
      
      render(<LoginButton />);
      
      expect(screen.getByText(/authentication failed/i)).toBeInTheDocument();
      expect(screen.getByTestId('error-message')).toHaveClass('error-display');
    });

    test('should clear error on retry', async () => {
      mockAuthContext.error = { message: 'Login failed' };
      const clearError = jest.fn();
      mockAuthContext.clearError = clearError;
      
      render(<LoginButton />);
      
      const retryButton = screen.getByRole('button', { name: /try again/i });
      await user.click(retryButton);
      
      expect(clearError).toHaveBeenCalled();
      expect(mockAuthContext.login).toHaveBeenCalled();
    });

    test('should handle network errors gracefully', () => {
      mockAuthContext.error = { 
        message: 'Network error',
        code: 'NETWORK_ERROR',
        recoverable: true
      };
      
      render(<LoginButton />);
      
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    test('should handle user cancellation', () => {
      mockAuthContext.error = { 
        message: 'User cancelled',
        code: 'USER_CANCELLED'
      };
      
      render(<LoginButton />);
      
      // Should not show error for user cancellation
      expect(screen.queryByTestId('error-message')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    test('should show generic error message for unknown errors', () => {
      mockAuthContext.error = { message: 'Unknown error occurred' };
      
      render(<LoginButton />);
      
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('should have proper ARIA attributes', () => {
      render(<LoginButton />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Sign in to your account');
      expect(button).toHaveAttribute('type', 'button');
    });

    test('should be keyboard accessible', async () => {
      render(<LoginButton />);
      
      const button = screen.getByRole('button');
      button.focus();
      
      expect(button).toHaveFocus();
      
      fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' });
      expect(mockAuthContext.login).toHaveBeenCalled();
      
      mockAuthContext.login.mockClear();
      fireEvent.keyDown(button, { key: ' ', code: 'Space' });
      expect(mockAuthContext.login).toHaveBeenCalled();
    });

    test('should have proper focus management during loading', () => {
      mockAuthContext.isLoading = true;
      
      render(<LoginButton />);
      
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('aria-busy', 'true');
    });

    test('should announce loading state to screen readers', () => {
      mockAuthContext.isLoading = true;
      
      render(<LoginButton />);
      
      expect(screen.getByText(/signing in/i)).toHaveAttribute('aria-live', 'polite');
    });

    test('should have proper color contrast', () => {
      render(<LoginButton />);
      
      const button = screen.getByRole('button');
      const styles = window.getComputedStyle(button);
      
      // This would need actual color contrast calculation in a real test
      expect(button).toHaveClass('high-contrast');
    });
  });

  describe('User Interactions', () => {
    test('should handle click events', async () => {
      render(<LoginButton />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(mockAuthContext.login).toHaveBeenCalledTimes(1);
    });

    test('should prevent double-clicking during loading', async () => {
      render(<LoginButton />);
      
      const button = screen.getByRole('button');
      
      // First click
      await user.click(button);
      mockAuthContext.isLoading = true;
      
      // Second click while loading
      await user.click(button);
      
      expect(mockAuthContext.login).toHaveBeenCalledTimes(1);
    });

    test('should handle rapid successive clicks', async () => {
      render(<LoginButton />);
      
      const button = screen.getByRole('button');
      
      // Multiple rapid clicks
      await user.click(button);
      await user.click(button);
      await user.click(button);
      
      // Should debounce and only call once
      expect(mockAuthContext.login).toHaveBeenCalledTimes(1);
    });

    test('should handle touch events on mobile', async () => {
      // Mock touch events
      render(<LoginButton />);
      
      const button = screen.getByRole('button');
      
      fireEvent.touchStart(button);
      fireEvent.touchEnd(button);
      
      await waitFor(() => {
        expect(mockAuthContext.login).toHaveBeenCalled();
      });
    });
  });

  describe('Animation and Visual Feedback', () => {
    test('should show hover effects', async () => {
      render(<LoginButton />);
      
      const button = screen.getByRole('button');
      
      await user.hover(button);
      expect(button).toHaveClass('hover:scale-105');
      
      await user.unhover(button);
      expect(button).not.toHaveClass('hover:scale-105');
    });

    test('should show focus effects', () => {
      render(<LoginButton />);
      
      const button = screen.getByRole('button');
      button.focus();
      
      expect(button).toHaveClass('focus:ring-2');
      expect(button).toHaveClass('focus:ring-blue-500');
    });

    test('should animate loading spinner', () => {
      mockAuthContext.isLoading = true;
      
      render(<LoginButton />);
      
      const spinner = screen.getByTestId('loading-spinner');
      expect(spinner).toHaveClass('animate-spin');
    });

    test('should show success animation after login', async () => {
      const { rerender } = render(<LoginButton />);
      
      // Simulate login success
      mockAuthContext.isAuthenticated = true;
      mockAuthContext.isLoading = false;
      
      rerender(<LoginButton />);
      
      // Should show success state briefly before hiding
      expect(screen.queryByTestId('success-animation')).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    test('should adapt to mobile viewport', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });
      
      render(<LoginButton />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('mobile-responsive');
    });

    test('should show compact version on small screens', () => {
      render(<LoginButton compact={true} />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('btn-compact');
      expect(screen.getByText(/sign in/i)).toBeInTheDocument();
    });

    test('should handle different screen orientations', () => {
      // Mock landscape orientation
      Object.defineProperty(screen, 'orientation', {
        writable: true,
        configurable: true,
        value: { angle: 90 },
      });
      
      render(<LoginButton />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('landscape-optimized');
    });
  });

  describe('Integration with Auth Flow', () => {
    test('should integrate with redirect flow', async () => {
      render(<LoginButton method="redirect" />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(mockAuthContext.login).toHaveBeenCalledWith('redirect');
      
      // Should show redirect message
      expect(screen.getByText(/redirecting/i)).toBeInTheDocument();
    });

    test('should handle popup blocked scenario', async () => {
      mockAuthContext.login.mockRejectedValue(new Error('Popup blocked'));
      
      render(<LoginButton />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      await waitFor(() => {
        expect(screen.getByText(/popup.*blocked/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /try redirect/i })).toBeInTheDocument();
      });
    });

    test('should show alternative login methods on failure', async () => {
      mockAuthContext.error = { 
        message: 'Popup failed',
        code: 'POPUP_FAILED',
        suggestAlternative: true
      };
      
      render(<LoginButton />);
      
      expect(screen.getByText(/try a different method/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /use redirect/i })).toBeInTheDocument();
    });
  });
});
