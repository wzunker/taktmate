/**
 * Authentication utilities for local development
 * Handles the bypass of Azure Static Web Apps authentication in local development
 */

/**
 * Get authentication data with local development bypass
 * @returns {Promise<Object>} Authentication data or mock data for local development
 */
export async function getAuthData() {
  // LOCAL DEVELOPMENT: Return mock auth data
  if (process.env.NODE_ENV === 'development' && window.location.hostname === 'localhost') {
    return {
      clientPrincipal: {
        userId: 'local-dev-user',
        userDetails: 'dev@localhost',
        userRoles: ['authenticated'],
        identityProvider: 'local-mock',
        claims: []
      }
    };
  }

  // PRODUCTION: Use Azure Static Web Apps authentication
  const response = await fetch('/.auth/me');
  return await response.json();
}

/**
 * Get authentication headers for API calls with local development bypass
 * @returns {Promise<Object>} Headers object for API calls
 */
export async function getAuthHeaders() {
  // LOCAL DEVELOPMENT: Return empty headers (backend handles mock user)
  if (process.env.NODE_ENV === 'development' && window.location.hostname === 'localhost') {
    return {
      'Content-Type': 'application/json'
    };
  }

  // PRODUCTION: Get SWA auth headers
  const authData = await getAuthData();
  
  if (!authData.clientPrincipal) {
    throw new Error('Authentication required. Please log in.');
  }

  return {
    'Content-Type': 'application/json',
    'x-ms-client-principal': btoa(JSON.stringify(authData.clientPrincipal))
  };
}
