// Tests for LogoutButton component
// Tests logout functionality, confirmation dialogs, error handling, and user interactions

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LogoutButton from '../LogoutButton';

// Mock the auth context
const mockAuthContext = {
  isAuthenticated: true,
  isLoading: false,
  error: null,
  logout: jest.fn(),
  user: {
    name: 'Test User',
    email: 'test@example.com',
    id: 'test-user-id'
  }
};

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => mockAuthContext
}));

// Mock framer-motion for animations
jest.mock('framer-motion', () => ({
  motion: {
    button: ({ children, ...props }) => <button {...props}>{children}</button>,
    div: ({ children, ...props }) => <div {...props}>{children}</div>
  },
  AnimatePresence: ({ children }) => <>{children}</>,
  variants: {}
}));

// Mock confirmation dialog
const mockConfirmationDialog = {
  show: jest.fn(),
  hide: jest.fn(),
  isVisible: false
};

jest.mock('../../../hooks/useConfirmationDialog', () => ({
  useConfirmationDialog: () => mockConfirmationDialog
}));

describe('LogoutButton', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock context to default state
    mockAuthContext.isAuthenticated = true;
    mockAuthContext.isLoading = false;
    mockAuthContext.error = null;
    mockAuthContext.logout.mockClear();
    mockConfirmationDialog.show.mockClear();
    mockConfirmationDialog.hide.mockClear();
    mockConfirmationDialog.isVisible = false;
  });

  describe('Rendering and Display', () => {
    test('should render logout button when authenticated', () => {
      render(<LogoutButton />);
      
      expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
      expect(screen.getByText(/sign out/i)).toBeInTheDocument();
    });

    test('should not render when not authenticated', () => {
      mockAuthContext.isAuthenticated = false;
      mockAuthContext.user = null;
      
      render(<LogoutButton />);
      
      expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument();
    });

    test('should show loading state during logout', () => {
      mockAuthContext.isLoading = true;
      
      render(<LogoutButton />);
      
      expect(screen.getByRole('button')).toBeDisabled();
      expect(screen.getByText(/signing out/i)).toBeInTheDocument();
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    test('should display custom text when provided', () => {
      render(<LogoutButton text="Log Out" />);
      
      expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument();
      expect(screen.getByText(/log out/i)).toBeInTheDocument();
    });

    test('should apply custom CSS classes', () => {
      render(<LogoutButton className="custom-logout-btn" />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-logout-btn');
    });

    test('should show different variants correctly', () => {
      const { rerender } = render(<LogoutButton variant="danger" />);
      expect(screen.getByRole('button')).toHaveClass('btn-danger');
      
      rerender(<LogoutButton variant="ghost" />);
      expect(screen.getByRole('button')).toHaveClass('btn-ghost');
      
      rerender(<LogoutButton variant="minimal" />);
      expect(screen.getByRole('button')).toHaveClass('btn-minimal');
    });

    test('should display user information when showUserInfo is true', () => {
      render(<LogoutButton showUserInfo={true} />);
      
      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });
  });

  describe('Logout Functionality', () => {
    test('should trigger logout without confirmation by default', async () => {
      render(<LogoutButton />);
      
      const logoutButton = screen.getByRole('button');
      await user.click(logoutButton);
      
      expect(mockAuthContext.logout).toHaveBeenCalledTimes(1);
    });

    test('should show confirmation dialog when requireConfirmation is true', async () => {
      render(<LogoutButton requireConfirmation={true} />);
      
      const logoutButton = screen.getByRole('button');
      await user.click(logoutButton);
      
      expect(mockConfirmationDialog.show).toHaveBeenCalledWith({
        title: 'Confirm Sign Out',
        message: 'Are you sure you want to sign out?',
        confirmText: 'Sign Out',
        cancelText: 'Cancel',
        onConfirm: expect.any(Function),
        onCancel: expect.any(Function)
      });
      
      expect(mockAuthContext.logout).not.toHaveBeenCalled();
    });

    test('should logout when confirmation is accepted', async () => {
      mockConfirmationDialog.show.mockImplementation(({ onConfirm }) => {
        onConfirm();
      });
      
      render(<LogoutButton requireConfirmation={true} />);
      
      const logoutButton = screen.getByRole('button');
      await user.click(logoutButton);
      
      expect(mockAuthContext.logout).toHaveBeenCalledTimes(1);
    });

    test('should not logout when confirmation is cancelled', async () => {
      mockConfirmationDialog.show.mockImplementation(({ onCancel }) => {
        onCancel();
      });
      
      render(<LogoutButton requireConfirmation={true} />);
      
      const logoutButton = screen.getByRole('button');
      await user.click(logoutButton);
      
      expect(mockAuthContext.logout).not.toHaveBeenCalled();
    });

    test('should handle custom confirmation message', async () => {
      const customMessage = 'This will end your session. Continue?';
      
      render(
        <LogoutButton 
          requireConfirmation={true} 
          confirmationMessage={customMessage}
        />
      );
      
      const logoutButton = screen.getByRole('button');
      await user.click(logoutButton);
      
      expect(mockConfirmationDialog.show).toHaveBeenCalledWith(
        expect.objectContaining({
          message: customMessage
        })
      );
    });
  });

  describe('Error Handling', () => {
    test('should display logout error', () => {
      mockAuthContext.error = { message: 'Logout failed' };
      
      render(<LogoutButton />);
      
      expect(screen.getByText(/logout failed/i)).toBeInTheDocument();
      expect(screen.getByTestId('error-message')).toHaveClass('error-display');
    });

    test('should clear error on retry', async () => {
      mockAuthContext.error = { message: 'Logout failed' };
      const clearError = jest.fn();
      mockAuthContext.clearError = clearError;
      
      render(<LogoutButton />);
      
      const retryButton = screen.getByRole('button', { name: /try again/i });
      await user.click(retryButton);
      
      expect(clearError).toHaveBeenCalled();
      expect(mockAuthContext.logout).toHaveBeenCalled();
    });

    test('should handle network errors gracefully', () => {
      mockAuthContext.error = { 
        message: 'Network error during logout',
        code: 'NETWORK_ERROR',
        recoverable: true
      };
      
      render(<LogoutButton />);
      
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    test('should handle session timeout errors', () => {
      mockAuthContext.error = { 
        message: 'Session expired',
        code: 'SESSION_EXPIRED'
      };
      
      render(<LogoutButton />);
      
      expect(screen.getByText(/session.*expired/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in again/i })).toBeInTheDocument();
    });

    test('should show generic error message for unknown errors', () => {
      mockAuthContext.error = { message: 'Unknown logout error' };
      
      render(<LogoutButton />);
      
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('should have proper ARIA attributes', () => {
      render(<LogoutButton />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Sign out of your account');
      expect(button).toHaveAttribute('type', 'button');
    });

    test('should be keyboard accessible', async () => {
      render(<LogoutButton />);
      
      const button = screen.getByRole('button');
      button.focus();
      
      expect(button).toHaveFocus();
      
      fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' });
      expect(mockAuthContext.logout).toHaveBeenCalled();
      
      mockAuthContext.logout.mockClear();
      fireEvent.keyDown(button, { key: ' ', code: 'Space' });
      expect(mockAuthContext.logout).toHaveBeenCalled();
    });

    test('should have proper focus management during loading', () => {
      mockAuthContext.isLoading = true;
      
      render(<LogoutButton />);
      
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('aria-busy', 'true');
    });

    test('should announce loading state to screen readers', () => {
      mockAuthContext.isLoading = true;
      
      render(<LogoutButton />);
      
      expect(screen.getByText(/signing out/i)).toHaveAttribute('aria-live', 'polite');
    });

    test('should handle confirmation dialog accessibility', async () => {
      mockConfirmationDialog.isVisible = true;
      
      render(<LogoutButton requireConfirmation={true} />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      // Should manage focus properly when dialog opens
      expect(document.activeElement).toHaveAttribute('role', 'dialog');
    });
  });

  describe('User Interactions', () => {
    test('should handle click events', async () => {
      render(<LogoutButton />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(mockAuthContext.logout).toHaveBeenCalledTimes(1);
    });

    test('should prevent double-clicking during loading', async () => {
      render(<LogoutButton />);
      
      const button = screen.getByRole('button');
      
      // First click
      await user.click(button);
      mockAuthContext.isLoading = true;
      
      // Second click while loading
      await user.click(button);
      
      expect(mockAuthContext.logout).toHaveBeenCalledTimes(1);
    });

    test('should handle rapid successive clicks', async () => {
      render(<LogoutButton />);
      
      const button = screen.getByRole('button');
      
      // Multiple rapid clicks
      await user.click(button);
      await user.click(button);
      await user.click(button);
      
      // Should debounce and only call once
      expect(mockAuthContext.logout).toHaveBeenCalledTimes(1);
    });

    test('should handle hover events', async () => {
      render(<LogoutButton />);
      
      const button = screen.getByRole('button');
      
      await user.hover(button);
      expect(button).toHaveClass('hover:bg-red-600');
      
      await user.unhover(button);
      expect(button).not.toHaveClass('hover:bg-red-600');
    });
  });

  describe('Visual States and Animations', () => {
    test('should show different visual states', () => {
      const { rerender } = render(<LogoutButton />);
      
      // Default state
      expect(screen.getByRole('button')).toHaveClass('btn-default');
      
      // Loading state
      mockAuthContext.isLoading = true;
      rerender(<LogoutButton />);
      expect(screen.getByRole('button')).toHaveClass('btn-loading');
      
      // Error state
      mockAuthContext.isLoading = false;
      mockAuthContext.error = { message: 'Error' };
      rerender(<LogoutButton />);
      expect(screen.getByRole('button')).toHaveClass('btn-error');
    });

    test('should animate loading spinner', () => {
      mockAuthContext.isLoading = true;
      
      render(<LogoutButton />);
      
      const spinner = screen.getByTestId('loading-spinner');
      expect(spinner).toHaveClass('animate-spin');
    });

    test('should show success animation after logout', async () => {
      const { rerender } = render(<LogoutButton />);
      
      // Simulate logout success
      mockAuthContext.isAuthenticated = false;
      mockAuthContext.isLoading = false;
      mockAuthContext.user = null;
      
      rerender(<LogoutButton />);
      
      // Should show success state briefly before component unmounts
      expect(screen.queryByTestId('success-animation')).toBeInTheDocument();
    });

    test('should show warning state for confirmation', async () => {
      mockConfirmationDialog.isVisible = true;
      
      render(<LogoutButton requireConfirmation={true} />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(button).toHaveClass('btn-warning');
    });
  });

  describe('Integration Features', () => {
    test('should integrate with dropdown menu', () => {
      render(<LogoutButton asMenuItem={true} />);
      
      const menuItem = screen.getByRole('menuitem');
      expect(menuItem).toBeInTheDocument();
      expect(menuItem).toHaveClass('dropdown-item');
    });

    test('should show icon only version', () => {
      render(<LogoutButton iconOnly={true} />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Sign out of your account');
      expect(screen.getByTestId('logout-icon')).toBeInTheDocument();
      expect(screen.queryByText(/sign out/i)).not.toBeInTheDocument();
    });

    test('should handle custom logout callback', async () => {
      const customCallback = jest.fn();
      
      render(<LogoutButton onLogout={customCallback} />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(customCallback).toHaveBeenCalledWith(mockAuthContext.user);
      expect(mockAuthContext.logout).toHaveBeenCalled();
    });

    test('should prevent logout when callback returns false', async () => {
      const preventCallback = jest.fn().mockReturnValue(false);
      
      render(<LogoutButton onLogout={preventCallback} />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(preventCallback).toHaveBeenCalled();
      expect(mockAuthContext.logout).not.toHaveBeenCalled();
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
      
      render(<LogoutButton />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('mobile-responsive');
    });

    test('should show compact version on small screens', () => {
      render(<LogoutButton compact={true} />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('btn-compact');
    });

    test('should handle different screen orientations', () => {
      // Mock landscape orientation
      Object.defineProperty(screen, 'orientation', {
        writable: true,
        configurable: true,
        value: { angle: 90 },
      });
      
      render(<LogoutButton />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('landscape-optimized');
    });
  });

  describe('Security Features', () => {
    test('should handle session cleanup on logout', async () => {
      const sessionCleanup = jest.fn();
      mockAuthContext.sessionCleanup = sessionCleanup;
      
      render(<LogoutButton />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(sessionCleanup).toHaveBeenCalled();
      expect(mockAuthContext.logout).toHaveBeenCalled();
    });

    test('should clear sensitive data on logout', async () => {
      const clearSensitiveData = jest.fn();
      
      render(<LogoutButton onBeforeLogout={clearSensitiveData} />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(clearSensitiveData).toHaveBeenCalled();
    });

    test('should handle forced logout scenarios', () => {
      mockAuthContext.error = { 
        message: 'Session expired',
        code: 'FORCED_LOGOUT',
        forced: true
      };
      
      render(<LogoutButton />);
      
      expect(screen.getByText(/session.*expired/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument();
    });
  });

  describe('Data Management', () => {
    test('should offer data export before logout', async () => {
      render(<LogoutButton offerDataExport={true} />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(screen.getByText(/export.*data/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument();
    });

    test('should handle data cleanup preferences', async () => {
      render(<LogoutButton showDataCleanupOptions={true} />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(screen.getByText(/data cleanup/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/keep.*data/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/delete.*data/i)).toBeInTheDocument();
    });
  });
});
