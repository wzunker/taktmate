// Tests for ProtectedRoute component
// Tests route protection, role-based access, redirects, and loading states

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProtectedRoute from '../ProtectedRoute';

// Mock the auth context
const mockAuthContext = {
  isAuthenticated: false,
  isLoading: false,
  error: null,
  user: null
};

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => mockAuthContext
}));

// Mock React Router
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  Navigate: ({ to, replace }) => <div data-testid="navigate" data-to={to} data-replace={replace} />,
  useLocation: () => ({ pathname: '/protected', search: '', hash: '', state: null })
}));

// Test component to be protected
const TestProtectedComponent = ({ testProp }) => (
  <div data-testid="protected-content">
    Protected Content
    {testProp && <span data-testid="test-prop">{testProp}</span>}
  </div>
);

describe('ProtectedRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock context to default state
    mockAuthContext.isAuthenticated = false;
    mockAuthContext.isLoading = false;
    mockAuthContext.error = null;
    mockAuthContext.user = null;
  });

  describe('Authentication Protection', () => {
    test('should redirect to login when not authenticated', () => {
      render(
        <MemoryRouter>
          <ProtectedRoute>
            <TestProtectedComponent />
          </ProtectedRoute>
        </MemoryRouter>
      );
      
      const navigate = screen.getByTestId('navigate');
      expect(navigate).toHaveAttribute('data-to', '/login');
      expect(navigate).toHaveAttribute('data-replace', 'true');
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });

    test('should render protected content when authenticated', () => {
      mockAuthContext.isAuthenticated = true;
      mockAuthContext.user = { id: 'test-user', name: 'Test User' };
      
      render(
        <MemoryRouter>
          <ProtectedRoute>
            <TestProtectedComponent testProp="test-value" />
          </ProtectedRoute>
        </MemoryRouter>
      );
      
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      expect(screen.getByTestId('test-prop')).toHaveTextContent('test-value');
      expect(screen.queryByTestId('navigate')).not.toBeInTheDocument();
    });

    test('should show loading state while authentication is being determined', () => {
      mockAuthContext.isLoading = true;
      
      render(
        <MemoryRouter>
          <ProtectedRoute>
            <TestProtectedComponent />
          </ProtectedRoute>
        </MemoryRouter>
      );
      
      expect(screen.getByTestId('auth-loading')).toBeInTheDocument();
      expect(screen.getByText(/checking authentication/i)).toBeInTheDocument();
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
      expect(screen.queryByTestId('navigate')).not.toBeInTheDocument();
    });

    test('should use custom redirect path', () => {
      render(
        <MemoryRouter>
          <ProtectedRoute redirectTo="/custom-login">
            <TestProtectedComponent />
          </ProtectedRoute>
        </MemoryRouter>
      );
      
      const navigate = screen.getByTestId('navigate');
      expect(navigate).toHaveAttribute('data-to', '/custom-login');
    });

    test('should preserve current location for redirect after login', () => {
      const mockLocation = { pathname: '/protected-page', search: '?param=value' };
      const { useLocation } = require('react-router-dom');
      useLocation.mockReturnValue(mockLocation);
      
      render(
        <MemoryRouter>
          <ProtectedRoute>
            <TestProtectedComponent />
          </ProtectedRoute>
        </MemoryRouter>
      );
      
      const navigate = screen.getByTestId('navigate');
      expect(navigate).toHaveAttribute('data-to', '/login?returnUrl=%2Fprotected-page%3Fparam%3Dvalue');
    });
  });

  describe('Role-Based Access Control', () => {
    beforeEach(() => {
      mockAuthContext.isAuthenticated = true;
    });

    test('should allow access when user has required role', () => {
      mockAuthContext.user = {
        id: 'test-user',
        roles: ['admin', 'user']
      };
      
      render(
        <MemoryRouter>
          <ProtectedRoute requiredRoles={['admin']}>
            <TestProtectedComponent />
          </ProtectedRoute>
        </MemoryRouter>
      );
      
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });

    test('should deny access when user lacks required role', () => {
      mockAuthContext.user = {
        id: 'test-user',
        roles: ['user']
      };
      
      render(
        <MemoryRouter>
          <ProtectedRoute requiredRoles={['admin']}>
            <TestProtectedComponent />
          </ProtectedRoute>
        </MemoryRouter>
      );
      
      expect(screen.getByTestId('access-denied')).toBeInTheDocument();
      expect(screen.getByText(/insufficient permissions/i)).toBeInTheDocument();
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });

    test('should allow access when user has any of the required roles', () => {
      mockAuthContext.user = {
        id: 'test-user',
        roles: ['editor']
      };
      
      render(
        <MemoryRouter>
          <ProtectedRoute requiredRoles={['admin', 'editor', 'moderator']}>
            <TestProtectedComponent />
          </ProtectedRoute>
        </MemoryRouter>
      );
      
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });

    test('should handle missing roles gracefully', () => {
      mockAuthContext.user = {
        id: 'test-user'
        // No roles property
      };
      
      render(
        <MemoryRouter>
          <ProtectedRoute requiredRoles={['admin']}>
            <TestProtectedComponent />
          </ProtectedRoute>
        </MemoryRouter>
      );
      
      expect(screen.getByTestId('access-denied')).toBeInTheDocument();
    });

    test('should redirect to custom unauthorized page', () => {
      mockAuthContext.user = {
        id: 'test-user',
        roles: ['user']
      };
      
      render(
        <MemoryRouter>
          <ProtectedRoute 
            requiredRoles={['admin']} 
            unauthorizedRedirect="/unauthorized"
          >
            <TestProtectedComponent />
          </ProtectedRoute>
        </MemoryRouter>
      );
      
      const navigate = screen.getByTestId('navigate');
      expect(navigate).toHaveAttribute('data-to', '/unauthorized');
    });
  });

  describe('Permission-Based Access Control', () => {
    beforeEach(() => {
      mockAuthContext.isAuthenticated = true;
    });

    test('should allow access when user has required permission', () => {
      mockAuthContext.user = {
        id: 'test-user',
        permissions: ['read', 'write', 'delete']
      };
      
      render(
        <MemoryRouter>
          <ProtectedRoute requiredPermissions={['write']}>
            <TestProtectedComponent />
          </ProtectedRoute>
        </MemoryRouter>
      );
      
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });

    test('should deny access when user lacks required permission', () => {
      mockAuthContext.user = {
        id: 'test-user',
        permissions: ['read']
      };
      
      render(
        <MemoryRouter>
          <ProtectedRoute requiredPermissions={['admin:write']}>
            <TestProtectedComponent />
          </ProtectedRoute>
        </MemoryRouter>
      );
      
      expect(screen.getByTestId('access-denied')).toBeInTheDocument();
      expect(screen.getByText(/insufficient permissions/i)).toBeInTheDocument();
    });

    test('should require all permissions when requireAll is true', () => {
      mockAuthContext.user = {
        id: 'test-user',
        permissions: ['read', 'write']
      };
      
      render(
        <MemoryRouter>
          <ProtectedRoute 
            requiredPermissions={['read', 'write', 'delete']}
            requireAll={true}
          >
            <TestProtectedComponent />
          </ProtectedRoute>
        </MemoryRouter>
      );
      
      expect(screen.getByTestId('access-denied')).toBeInTheDocument();
    });

    test('should allow access with any permission when requireAll is false', () => {
      mockAuthContext.user = {
        id: 'test-user',
        permissions: ['read']
      };
      
      render(
        <MemoryRouter>
          <ProtectedRoute 
            requiredPermissions={['read', 'write', 'delete']}
            requireAll={false}
          >
            <TestProtectedComponent />
          </ProtectedRoute>
        </MemoryRouter>
      );
      
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });
  });

  describe('Combined Role and Permission Checks', () => {
    beforeEach(() => {
      mockAuthContext.isAuthenticated = true;
    });

    test('should require both role and permission', () => {
      mockAuthContext.user = {
        id: 'test-user',
        roles: ['admin'],
        permissions: ['write']
      };
      
      render(
        <MemoryRouter>
          <ProtectedRoute 
            requiredRoles={['admin']}
            requiredPermissions={['write']}
          >
            <TestProtectedComponent />
          </ProtectedRoute>
        </MemoryRouter>
      );
      
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });

    test('should deny access when role is missing', () => {
      mockAuthContext.user = {
        id: 'test-user',
        roles: ['user'],
        permissions: ['write']
      };
      
      render(
        <MemoryRouter>
          <ProtectedRoute 
            requiredRoles={['admin']}
            requiredPermissions={['write']}
          >
            <TestProtectedComponent />
          </ProtectedRoute>
        </MemoryRouter>
      );
      
      expect(screen.getByTestId('access-denied')).toBeInTheDocument();
    });

    test('should deny access when permission is missing', () => {
      mockAuthContext.user = {
        id: 'test-user',
        roles: ['admin'],
        permissions: ['read']
      };
      
      render(
        <MemoryRouter>
          <ProtectedRoute 
            requiredRoles={['admin']}
            requiredPermissions={['write']}
          >
            <TestProtectedComponent />
          </ProtectedRoute>
        </MemoryRouter>
      );
      
      expect(screen.getByTestId('access-denied')).toBeInTheDocument();
    });
  });

  describe('Custom Authorization Logic', () => {
    beforeEach(() => {
      mockAuthContext.isAuthenticated = true;
      mockAuthContext.user = {
        id: 'test-user',
        roles: ['user'],
        permissions: ['read'],
        department: 'engineering',
        level: 'senior'
      };
    });

    test('should use custom authorization function', () => {
      const customAuth = (user) => {
        return user.department === 'engineering' && user.level === 'senior';
      };
      
      render(
        <MemoryRouter>
          <ProtectedRoute customAuth={customAuth}>
            <TestProtectedComponent />
          </ProtectedRoute>
        </MemoryRouter>
      );
      
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });

    test('should deny access when custom authorization fails', () => {
      const customAuth = (user) => {
        return user.department === 'marketing';
      };
      
      render(
        <MemoryRouter>
          <ProtectedRoute customAuth={customAuth}>
            <TestProtectedComponent />
          </ProtectedRoute>
        </MemoryRouter>
      );
      
      expect(screen.getByTestId('access-denied')).toBeInTheDocument();
    });

    test('should handle custom authorization errors', () => {
      const customAuth = (user) => {
        throw new Error('Authorization service unavailable');
      };
      
      render(
        <MemoryRouter>
          <ProtectedRoute customAuth={customAuth}>
            <TestProtectedComponent />
          </ProtectedRoute>
        </MemoryRouter>
      );
      
      expect(screen.getByTestId('access-denied')).toBeInTheDocument();
      expect(screen.getByText(/authorization error/i)).toBeInTheDocument();
    });
  });

  describe('Loading and Error States', () => {
    test('should show custom loading component', () => {
      mockAuthContext.isLoading = true;
      
      const CustomLoader = () => <div data-testid="custom-loader">Custom Loading...</div>;
      
      render(
        <MemoryRouter>
          <ProtectedRoute loadingComponent={<CustomLoader />}>
            <TestProtectedComponent />
          </ProtectedRoute>
        </MemoryRouter>
      );
      
      expect(screen.getByTestId('custom-loader')).toBeInTheDocument();
      expect(screen.queryByTestId('auth-loading')).not.toBeInTheDocument();
    });

    test('should show custom access denied component', () => {
      mockAuthContext.isAuthenticated = true;
      mockAuthContext.user = { id: 'test-user', roles: ['user'] };
      
      const CustomAccessDenied = () => (
        <div data-testid="custom-access-denied">Custom Access Denied</div>
      );
      
      render(
        <MemoryRouter>
          <ProtectedRoute 
            requiredRoles={['admin']}
            accessDeniedComponent={<CustomAccessDenied />}
          >
            <TestProtectedComponent />
          </ProtectedRoute>
        </MemoryRouter>
      );
      
      expect(screen.getByTestId('custom-access-denied')).toBeInTheDocument();
      expect(screen.queryByTestId('access-denied')).not.toBeInTheDocument();
    });

    test('should handle authentication errors', () => {
      mockAuthContext.error = { message: 'Authentication failed' };
      
      render(
        <MemoryRouter>
          <ProtectedRoute>
            <TestProtectedComponent />
          </ProtectedRoute>
        </MemoryRouter>
      );
      
      expect(screen.getByTestId('auth-error')).toBeInTheDocument();
      expect(screen.getByText(/authentication failed/i)).toBeInTheDocument();
    });

    test('should provide retry option on authentication error', () => {
      mockAuthContext.error = { 
        message: 'Network error', 
        recoverable: true 
      };
      const retryAuth = jest.fn();
      mockAuthContext.retryAuth = retryAuth;
      
      render(
        <MemoryRouter>
          <ProtectedRoute>
            <TestProtectedComponent />
          </ProtectedRoute>
        </MemoryRouter>
      );
      
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });

  describe('Route Transition Animations', () => {
    test('should apply enter animation when content loads', async () => {
      mockAuthContext.isAuthenticated = true;
      mockAuthContext.user = { id: 'test-user' };
      
      render(
        <MemoryRouter>
          <ProtectedRoute enableTransitions={true}>
            <TestProtectedComponent />
          </ProtectedRoute>
        </MemoryRouter>
      );
      
      const content = screen.getByTestId('protected-content');
      expect(content.parentElement).toHaveClass('route-enter');
      
      await waitFor(() => {
        expect(content.parentElement).toHaveClass('route-enter-active');
      });
    });

    test('should apply exit animation when redirecting', () => {
      mockAuthContext.isAuthenticated = false;
      
      const { rerender } = render(
        <MemoryRouter>
          <ProtectedRoute enableTransitions={true}>
            <TestProtectedComponent />
          </ProtectedRoute>
        </MemoryRouter>
      );
      
      // Simulate authentication state change
      mockAuthContext.isAuthenticated = true;
      mockAuthContext.user = { id: 'test-user' };
      
      rerender(
        <MemoryRouter>
          <ProtectedRoute enableTransitions={true}>
            <TestProtectedComponent />
          </ProtectedRoute>
        </MemoryRouter>
      );
      
      expect(screen.getByTestId('route-transition')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('should announce route changes to screen readers', () => {
      mockAuthContext.isAuthenticated = true;
      mockAuthContext.user = { id: 'test-user' };
      
      render(
        <MemoryRouter>
          <ProtectedRoute announceRouteChanges={true}>
            <TestProtectedComponent />
          </ProtectedRoute>
        </MemoryRouter>
      );
      
      expect(screen.getByText(/navigated to protected content/i)).toHaveAttribute('aria-live', 'polite');
    });

    test('should have proper focus management', async () => {
      mockAuthContext.isLoading = true;
      
      const { rerender } = render(
        <MemoryRouter>
          <ProtectedRoute>
            <TestProtectedComponent />
          </ProtectedRoute>
        </MemoryRouter>
      );
      
      // Complete loading
      mockAuthContext.isLoading = false;
      mockAuthContext.isAuthenticated = true;
      mockAuthContext.user = { id: 'test-user' };
      
      rerender(
        <MemoryRouter>
          <ProtectedRoute>
            <TestProtectedComponent />
          </ProtectedRoute>
        </MemoryRouter>
      );
      
      await waitFor(() => {
        expect(document.activeElement).toHaveAttribute('data-testid', 'protected-content');
      });
    });

    test('should provide skip links for keyboard navigation', () => {
      mockAuthContext.isAuthenticated = true;
      mockAuthContext.user = { id: 'test-user' };
      
      render(
        <MemoryRouter>
          <ProtectedRoute showSkipLinks={true}>
            <TestProtectedComponent />
          </ProtectedRoute>
        </MemoryRouter>
      );
      
      expect(screen.getByRole('link', { name: /skip to main content/i })).toBeInTheDocument();
    });
  });

  describe('Performance Optimization', () => {
    test('should lazy load protected content', async () => {
      const LazyComponent = React.lazy(() => 
        Promise.resolve({ default: TestProtectedComponent })
      );
      
      mockAuthContext.isAuthenticated = true;
      mockAuthContext.user = { id: 'test-user' };
      
      render(
        <MemoryRouter>
          <ProtectedRoute>
            <React.Suspense fallback={<div>Loading component...</div>}>
              <LazyComponent />
            </React.Suspense>
          </ProtectedRoute>
        </MemoryRouter>
      );
      
      expect(screen.getByText('Loading component...')).toBeInTheDocument();
      
      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      });
    });

    test('should memoize authorization checks', () => {
      mockAuthContext.isAuthenticated = true;
      mockAuthContext.user = { id: 'test-user', roles: ['admin'] };
      
      const authCheckSpy = jest.fn(() => true);
      
      const { rerender } = render(
        <MemoryRouter>
          <ProtectedRoute 
            requiredRoles={['admin']}
            customAuth={authCheckSpy}
          >
            <TestProtectedComponent />
          </ProtectedRoute>
        </MemoryRouter>
      );
      
      // Re-render with same props
      rerender(
        <MemoryRouter>
          <ProtectedRoute 
            requiredRoles={['admin']}
            customAuth={authCheckSpy}
          >
            <TestProtectedComponent />
          </ProtectedRoute>
        </MemoryRouter>
      );
      
      // Should only call auth check once due to memoization
      expect(authCheckSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Integration with Router', () => {
    test('should preserve route parameters', () => {
      const mockLocation = { 
        pathname: '/protected/123', 
        search: '?tab=settings',
        state: { from: 'dashboard' }
      };
      const { useLocation } = require('react-router-dom');
      useLocation.mockReturnValue(mockLocation);
      
      render(
        <MemoryRouter>
          <ProtectedRoute>
            <TestProtectedComponent />
          </ProtectedRoute>
        </MemoryRouter>
      );
      
      const navigate = screen.getByTestId('navigate');
      expect(navigate).toHaveAttribute(
        'data-to', 
        '/login?returnUrl=%2Fprotected%2F123%3Ftab%3Dsettings'
      );
    });

    test('should handle nested routes correctly', () => {
      mockAuthContext.isAuthenticated = true;
      mockAuthContext.user = { id: 'test-user' };
      
      render(
        <MemoryRouter initialEntries={['/protected/nested']}>
          <ProtectedRoute>
            <div data-testid="parent-content">
              <ProtectedRoute requiredRoles={['admin']}>
                <div data-testid="nested-content">Nested Content</div>
              </ProtectedRoute>
            </div>
          </ProtectedRoute>
        </MemoryRouter>
      );
      
      expect(screen.getByTestId('parent-content')).toBeInTheDocument();
      expect(screen.getByTestId('access-denied')).toBeInTheDocument(); // Nested route denied
    });
  });
});
