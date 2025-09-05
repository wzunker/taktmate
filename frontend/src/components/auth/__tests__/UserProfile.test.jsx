// Tests for UserProfile component
// Tests user profile display, editing, data management, and privacy features

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserProfile from '../UserProfile';
import { AuthProvider } from '../../../contexts/AuthContext';

// Mock the auth context
const mockAuthContext = {
  isAuthenticated: true,
  isLoading: false,
  error: null,
  user: {
    id: 'test-user-id',
    name: 'Test User',
    email: 'test@example.com',
    given_name: 'Test',
    family_name: 'User',
    picture: 'https://example.com/avatar.jpg',
    jobTitle: 'Software Engineer',
    city: 'San Francisco',
    country: 'United States',
    identityProvider: 'local',
    roles: ['user'],
    permissions: ['read', 'write']
  },
  updateProfile: jest.fn(),
  refreshUserData: jest.fn()
};

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => mockAuthContext
}));

// Mock API service
jest.mock('../../../services/apiService', () => ({
  get: jest.fn(),
  put: jest.fn(),
  post: jest.fn(),
  delete: jest.fn()
}));

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
    form: ({ children, ...props }) => <form {...props}>{children}</form>,
    button: ({ children, ...props }) => <button {...props}>{children}</button>
  },
  AnimatePresence: ({ children }) => <>{children}</>,
  variants: {}
}));

describe('UserProfile', () => {
  const user = userEvent.setup();
  const mockApiService = require('../../../services/apiService');

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthContext.updateProfile.mockClear();
    mockAuthContext.refreshUserData.mockClear();
    mockApiService.get.mockResolvedValue({ data: { success: true } });
    mockApiService.put.mockResolvedValue({ data: { success: true } });
  });

  describe('Profile Display', () => {
    test('should render user profile information', () => {
      render(<UserProfile />);
      
      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
      expect(screen.getByText('Software Engineer')).toBeInTheDocument();
      expect(screen.getByText('San Francisco, United States')).toBeInTheDocument();
    });

    test('should display user avatar', () => {
      render(<UserProfile />);
      
      const avatar = screen.getByRole('img', { name: /profile picture/i });
      expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.jpg');
      expect(avatar).toHaveAttribute('alt', 'Test User profile picture');
    });

    test('should show default avatar when picture is not available', () => {
      mockAuthContext.user.picture = null;
      
      render(<UserProfile />);
      
      const defaultAvatar = screen.getByTestId('default-avatar');
      expect(defaultAvatar).toBeInTheDocument();
      expect(defaultAvatar).toHaveTextContent('TU'); // Initials
    });

    test('should display identity provider information', () => {
      render(<UserProfile />);
      
      expect(screen.getByText(/signed in with/i)).toBeInTheDocument();
      expect(screen.getByText(/local account/i)).toBeInTheDocument();
    });

    test('should show social provider icons', () => {
      mockAuthContext.user.identityProvider = 'google.com';
      
      render(<UserProfile />);
      
      expect(screen.getByTestId('google-provider-icon')).toBeInTheDocument();
      expect(screen.getByText(/google/i)).toBeInTheDocument();
    });

    test('should display user roles and permissions', () => {
      render(<UserProfile showRoles={true} />);
      
      expect(screen.getByText(/roles/i)).toBeInTheDocument();
      expect(screen.getByText('user')).toBeInTheDocument();
      expect(screen.getByText(/permissions/i)).toBeInTheDocument();
      expect(screen.getByText('read, write')).toBeInTheDocument();
    });
  });

  describe('Profile Editing', () => {
    test('should enter edit mode when edit button is clicked', async () => {
      render(<UserProfile />);
      
      const editButton = screen.getByRole('button', { name: /edit profile/i });
      await user.click(editButton);
      
      expect(screen.getByRole('textbox', { name: /first name/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /last name/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /job title/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    test('should populate form fields with current user data', async () => {
      render(<UserProfile />);
      
      const editButton = screen.getByRole('button', { name: /edit profile/i });
      await user.click(editButton);
      
      expect(screen.getByDisplayValue('Test')).toBeInTheDocument();
      expect(screen.getByDisplayValue('User')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Software Engineer')).toBeInTheDocument();
      expect(screen.getByDisplayValue('San Francisco')).toBeInTheDocument();
    });

    test('should validate form inputs', async () => {
      render(<UserProfile />);
      
      const editButton = screen.getByRole('button', { name: /edit profile/i });
      await user.click(editButton);
      
      const firstNameInput = screen.getByRole('textbox', { name: /first name/i });
      await user.clear(firstNameInput);
      
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);
      
      expect(screen.getByText(/first name is required/i)).toBeInTheDocument();
    });

    test('should save profile changes', async () => {
      mockApiService.put.mockResolvedValue({
        data: {
          success: true,
          user: {
            ...mockAuthContext.user,
            given_name: 'Updated',
            jobTitle: 'Senior Engineer'
          }
        }
      });
      
      render(<UserProfile />);
      
      const editButton = screen.getByRole('button', { name: /edit profile/i });
      await user.click(editButton);
      
      const firstNameInput = screen.getByRole('textbox', { name: /first name/i });
      const jobTitleInput = screen.getByRole('textbox', { name: /job title/i });
      
      await user.clear(firstNameInput);
      await user.type(firstNameInput, 'Updated');
      await user.clear(jobTitleInput);
      await user.type(jobTitleInput, 'Senior Engineer');
      
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);
      
      await waitFor(() => {
        expect(mockApiService.put).toHaveBeenCalledWith('/api/user/profile', {
          given_name: 'Updated',
          family_name: 'User',
          jobTitle: 'Senior Engineer',
          city: 'San Francisco',
          country: 'United States'
        });
      });
      
      expect(mockAuthContext.updateProfile).toHaveBeenCalled();
      expect(screen.getByText(/profile updated successfully/i)).toBeInTheDocument();
    });

    test('should cancel editing and revert changes', async () => {
      render(<UserProfile />);
      
      const editButton = screen.getByRole('button', { name: /edit profile/i });
      await user.click(editButton);
      
      const firstNameInput = screen.getByRole('textbox', { name: /first name/i });
      await user.clear(firstNameInput);
      await user.type(firstNameInput, 'Changed');
      
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);
      
      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.queryByDisplayValue('Changed')).not.toBeInTheDocument();
    });

    test('should handle save errors', async () => {
      mockApiService.put.mockRejectedValue(new Error('Save failed'));
      
      render(<UserProfile />);
      
      const editButton = screen.getByRole('button', { name: /edit profile/i });
      await user.click(editButton);
      
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);
      
      await waitFor(() => {
        expect(screen.getByText(/failed to update profile/i)).toBeInTheDocument();
      });
    });
  });

  describe('Avatar Management', () => {
    test('should show avatar upload option', async () => {
      render(<UserProfile allowAvatarUpload={true} />);
      
      const editButton = screen.getByRole('button', { name: /edit profile/i });
      await user.click(editButton);
      
      expect(screen.getByText(/change profile picture/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/upload new picture/i)).toBeInTheDocument();
    });

    test('should handle avatar file upload', async () => {
      const mockFile = new File(['avatar'], 'avatar.jpg', { type: 'image/jpeg' });
      mockApiService.post.mockResolvedValue({
        data: {
          success: true,
          pictureUrl: 'https://example.com/new-avatar.jpg'
        }
      });
      
      render(<UserProfile allowAvatarUpload={true} />);
      
      const editButton = screen.getByRole('button', { name: /edit profile/i });
      await user.click(editButton);
      
      const fileInput = screen.getByLabelText(/upload new picture/i);
      await user.upload(fileInput, mockFile);
      
      await waitFor(() => {
        expect(mockApiService.post).toHaveBeenCalledWith(
          '/api/user/avatar',
          expect.any(FormData),
          expect.objectContaining({
            headers: { 'Content-Type': 'multipart/form-data' }
          })
        );
      });
    });

    test('should validate avatar file type', async () => {
      const invalidFile = new File(['text'], 'document.txt', { type: 'text/plain' });
      
      render(<UserProfile allowAvatarUpload={true} />);
      
      const editButton = screen.getByRole('button', { name: /edit profile/i });
      await user.click(editButton);
      
      const fileInput = screen.getByLabelText(/upload new picture/i);
      await user.upload(fileInput, invalidFile);
      
      expect(screen.getByText(/please select a valid image file/i)).toBeInTheDocument();
    });

    test('should validate avatar file size', async () => {
      const largeFile = new File([new ArrayBuffer(10 * 1024 * 1024)], 'large.jpg', { 
        type: 'image/jpeg' 
      });
      
      render(<UserProfile allowAvatarUpload={true} />);
      
      const editButton = screen.getByRole('button', { name: /edit profile/i });
      await user.click(editButton);
      
      const fileInput = screen.getByLabelText(/upload new picture/i);
      await user.upload(fileInput, largeFile);
      
      expect(screen.getByText(/file size must be less than/i)).toBeInTheDocument();
    });
  });

  describe('Privacy and Security', () => {
    test('should show privacy settings section', () => {
      render(<UserProfile showPrivacySettings={true} />);
      
      expect(screen.getByText(/privacy settings/i)).toBeInTheDocument();
      expect(screen.getByText(/data visibility/i)).toBeInTheDocument();
      expect(screen.getByText(/profile visibility/i)).toBeInTheDocument();
    });

    test('should handle data export request', async () => {
      mockApiService.get.mockResolvedValue({
        data: {
          success: true,
          exportId: 'export-123',
          downloadUrl: 'https://example.com/export.json'
        }
      });
      
      render(<UserProfile showDataManagement={true} />);
      
      const exportButton = screen.getByRole('button', { name: /export my data/i });
      await user.click(exportButton);
      
      await waitFor(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('/api/gdpr/export');
      });
      
      expect(screen.getByText(/data export initiated/i)).toBeInTheDocument();
    });

    test('should handle account deletion request', async () => {
      const confirmDelete = jest.fn().mockResolvedValue(true);
      window.confirm = confirmDelete;
      
      render(<UserProfile showDataManagement={true} />);
      
      const deleteButton = screen.getByRole('button', { name: /delete account/i });
      await user.click(deleteButton);
      
      expect(confirmDelete).toHaveBeenCalledWith(
        expect.stringContaining('permanently delete your account')
      );
    });

    test('should show linked accounts', () => {
      mockAuthContext.user.linkedAccounts = [
        { provider: 'google.com', email: 'test@gmail.com' },
        { provider: 'live.com', email: 'test@outlook.com' }
      ];
      
      render(<UserProfile showLinkedAccounts={true} />);
      
      expect(screen.getByText(/linked accounts/i)).toBeInTheDocument();
      expect(screen.getByText('test@gmail.com')).toBeInTheDocument();
      expect(screen.getByText('test@outlook.com')).toBeInTheDocument();
    });

    test('should handle account unlinking', async () => {
      mockAuthContext.user.linkedAccounts = [
        { provider: 'google.com', email: 'test@gmail.com' }
      ];
      
      mockApiService.delete.mockResolvedValue({ data: { success: true } });
      
      render(<UserProfile showLinkedAccounts={true} />);
      
      const unlinkButton = screen.getByRole('button', { name: /unlink google/i });
      await user.click(unlinkButton);
      
      await waitFor(() => {
        expect(mockApiService.delete).toHaveBeenCalledWith('/api/user/unlink/google');
      });
    });
  });

  describe('Accessibility', () => {
    test('should have proper heading structure', () => {
      render(<UserProfile />);
      
      expect(screen.getByRole('heading', { level: 1, name: /user profile/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: /personal information/i })).toBeInTheDocument();
    });

    test('should have proper form labels', async () => {
      render(<UserProfile />);
      
      const editButton = screen.getByRole('button', { name: /edit profile/i });
      await user.click(editButton);
      
      expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/job title/i)).toBeInTheDocument();
    });

    test('should announce form validation errors', async () => {
      render(<UserProfile />);
      
      const editButton = screen.getByRole('button', { name: /edit profile/i });
      await user.click(editButton);
      
      const firstNameInput = screen.getByLabelText(/first name/i);
      await user.clear(firstNameInput);
      
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);
      
      const errorMessage = screen.getByText(/first name is required/i);
      expect(errorMessage).toHaveAttribute('aria-live', 'polite');
    });

    test('should be keyboard navigable', async () => {
      render(<UserProfile />);
      
      const editButton = screen.getByRole('button', { name: /edit profile/i });
      editButton.focus();
      
      fireEvent.keyDown(editButton, { key: 'Enter' });
      
      await waitFor(() => {
        expect(screen.getByRole('textbox', { name: /first name/i })).toHaveFocus();
      });
    });

    test('should support screen readers', () => {
      render(<UserProfile />);
      
      const profileSection = screen.getByRole('region', { name: /user profile/i });
      expect(profileSection).toBeInTheDocument();
      
      const avatar = screen.getByRole('img');
      expect(avatar).toHaveAttribute('alt', 'Test User profile picture');
    });
  });

  describe('Responsive Design', () => {
    test('should adapt to mobile viewport', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });
      
      render(<UserProfile />);
      
      const profileContainer = screen.getByTestId('profile-container');
      expect(profileContainer).toHaveClass('mobile-layout');
    });

    test('should stack elements vertically on small screens', () => {
      render(<UserProfile compact={true} />);
      
      const profileLayout = screen.getByTestId('profile-layout');
      expect(profileLayout).toHaveClass('flex-col');
    });

    test('should adjust avatar size for different screen sizes', () => {
      const { rerender } = render(<UserProfile />);
      
      // Desktop
      expect(screen.getByRole('img')).toHaveClass('w-24 h-24');
      
      // Mobile
      rerender(<UserProfile mobile={true} />);
      expect(screen.getByRole('img')).toHaveClass('w-16 h-16');
    });
  });

  describe('Loading and Error States', () => {
    test('should show loading state while fetching profile', () => {
      mockAuthContext.isLoading = true;
      
      render(<UserProfile />);
      
      expect(screen.getByTestId('profile-loading')).toBeInTheDocument();
      expect(screen.getByText(/loading profile/i)).toBeInTheDocument();
    });

    test('should show error state when profile fails to load', () => {
      mockAuthContext.error = { message: 'Failed to load profile' };
      
      render(<UserProfile />);
      
      expect(screen.getByText(/failed to load profile/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    test('should retry loading profile on error', async () => {
      mockAuthContext.error = { message: 'Failed to load profile' };
      
      render(<UserProfile />);
      
      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);
      
      expect(mockAuthContext.refreshUserData).toHaveBeenCalled();
    });

    test('should show saving state during profile update', async () => {
      let resolvePromise;
      mockApiService.put.mockReturnValue(
        new Promise(resolve => { resolvePromise = resolve; })
      );
      
      render(<UserProfile />);
      
      const editButton = screen.getByRole('button', { name: /edit profile/i });
      await user.click(editButton);
      
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);
      
      expect(screen.getByText(/saving/i)).toBeInTheDocument();
      expect(saveButton).toBeDisabled();
      
      resolvePromise({ data: { success: true } });
    });
  });

  describe('Data Validation', () => {
    test('should validate email format', async () => {
      render(<UserProfile allowEmailChange={true} />);
      
      const editButton = screen.getByRole('button', { name: /edit profile/i });
      await user.click(editButton);
      
      const emailInput = screen.getByRole('textbox', { name: /email/i });
      await user.clear(emailInput);
      await user.type(emailInput, 'invalid-email');
      
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);
      
      expect(screen.getByText(/please enter a valid email/i)).toBeInTheDocument();
    });

    test('should validate required fields', async () => {
      render(<UserProfile />);
      
      const editButton = screen.getByRole('button', { name: /edit profile/i });
      await user.click(editButton);
      
      const firstNameInput = screen.getByRole('textbox', { name: /first name/i });
      const lastNameInput = screen.getByRole('textbox', { name: /last name/i });
      
      await user.clear(firstNameInput);
      await user.clear(lastNameInput);
      
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);
      
      expect(screen.getByText(/first name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/last name is required/i)).toBeInTheDocument();
    });

    test('should validate field lengths', async () => {
      render(<UserProfile />);
      
      const editButton = screen.getByRole('button', { name: /edit profile/i });
      await user.click(editButton);
      
      const jobTitleInput = screen.getByRole('textbox', { name: /job title/i });
      await user.clear(jobTitleInput);
      await user.type(jobTitleInput, 'x'.repeat(101)); // Exceed max length
      
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);
      
      expect(screen.getByText(/job title must be less than 100 characters/i)).toBeInTheDocument();
    });
  });
});
