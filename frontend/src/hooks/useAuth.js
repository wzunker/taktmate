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
    
    // Try to get First Name from External ID user flow attributes
    // External ID custom attributes are typically prefixed with extension_
    const firstNameClaim = user.claims?.find(claim => 
      claim.typ === 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname' ||
      claim.typ === 'given_name' ||
      claim.typ === 'extension_FirstName' ||
      claim.typ === 'extension_givenName' ||
      claim.typ === 'FirstName'
    );
    
    if (firstNameClaim) {
      return firstNameClaim.val;
    }
    
    // Try to get name claim
    const nameClaim = user.claims?.find(claim => 
      claim.typ === 'name' ||
      claim.typ === 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'
    );
    
    if (nameClaim) {
      return nameClaim.val;
    }
    
    // Fallback to user details or email
    return user.name || user.userDetails || 'User';
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

  // Helper function to get full name (First + Last)
  const getFullName = () => {
    if (!user) return null;
    
    const firstName = getClaimValue('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname') || 
                     getClaimValue('given_name') || 
                     getClaimValue('extension_FirstName') || 
                     getClaimValue('extension_givenName') ||
                     getClaimValue('FirstName');
    const lastName = getClaimValue('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname') || 
                    getClaimValue('family_name') || 
                    getClaimValue('extension_LastName') || 
                    getClaimValue('extension_surname') ||
                    getClaimValue('LastName');
    
    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    } else if (firstName) {
      return firstName;
    } else if (lastName) {
      return lastName;
    }
    
    return getUserDisplayName();
  };

  // Helper function to get company
  const getCompany = () => {
    if (!user) return null;
    
    return getClaimValue('extension_Company') || 
           getClaimValue('Company') || 
           getClaimValue('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/companyname') ||
           null;
  };

  // Helper function to get job title
  const getJobTitle = () => {
    if (!user) return null;
    
    return getClaimValue('extension_JobTitle') || 
           getClaimValue('JobTitle') || 
           getClaimValue('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/jobtitle') ||
           null;
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
    getFullName,
    getCompany,
    getJobTitle,
    hasRole,
    getClaimValue,
    requireAuth,
    
    // Convenience properties
    isLoggedIn: isAuthenticated,
    isLoggedOut: !isAuthenticated && !isLoading,
    displayName: getUserDisplayName(),
    fullName: getFullName(),
    email: getUserEmail(),
    company: getCompany(),
    jobTitle: getJobTitle()
  };
};

export default useAuth;
