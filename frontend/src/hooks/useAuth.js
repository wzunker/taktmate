import { useAuthContext } from '../contexts/AuthContext';

/**
 * Custom hook for authentication operations
 * Provides a clean interface for authentication-related functionality
 */
const useAuth = () => {
  const {
    isAuthenticated,
    user,
    isLoading,
    error,
    login,
    logout,
    refreshUser,
    clearError,
    checkAuthStatus
  } = useAuthContext();

  // Helper function to get user display name
  const getUserDisplayName = () => {
    if (!user) return null;
    
    // Try to get name from claims first
    const nameClaim = user.claims?.find(claim => 
      claim.typ === 'name' || 
      claim.typ === 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name' ||
      claim.typ === 'preferred_username'
    );
    
    if (nameClaim) return nameClaim.val;
    
    // Fallback to user details or email
    return user.name || user.email || 'User';
  };

  // Helper function to get user email
  const getUserEmail = () => {
    if (!user) return null;
    
    // Try to get email from claims
    const emailClaim = user.claims?.find(claim => 
      claim.typ === 'email' || 
      claim.typ === 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'
    );
    
    if (emailClaim) return emailClaim.val;
    
    // Fallback to user details
    return user.email || null;
  };

  // Helper function to check if user has specific role
  const hasRole = (role) => {
    if (!user || !user.roles) return false;
    return user.roles.includes(role);
  };

  // Helper function to get specific claim value
  const getClaimValue = (claimType) => {
    if (!user || !user.claims) return null;
    
    const claim = user.claims.find(claim => claim.typ === claimType);
    return claim ? claim.val : null;
  };

  // Helper function to check if authentication is required
  const requireAuth = (callback) => {
    if (!isAuthenticated && !isLoading) {
      login();
      return false;
    }
    
    if (isAuthenticated && callback) {
      callback();
    }
    
    return isAuthenticated;
  };

  return {
    // Authentication state
    isAuthenticated,
    user,
    isLoading,
    error,
    
    // Authentication actions
    login,
    logout,
    refreshUser,
    clearError,
    checkAuthStatus,
    
    // Helper functions
    getUserDisplayName,
    getUserEmail,
    hasRole,
    getClaimValue,
    requireAuth,
    
    // Convenience properties
    isLoggedIn: isAuthenticated,
    isLoggedOut: !isAuthenticated && !isLoading,
    displayName: getUserDisplayName(),
    email: getUserEmail()
  };
};

export default useAuth;
