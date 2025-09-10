/**
 * Authentication Redirect Utility
 * 
 * Handles MSAL authentication redirects outside of React's rendering cycle
 * to prevent infinite loops caused by component re-renders.
 */

import { logMsalState, logAuthStep, logError, createTimer } from './debugLogger';

// Global state to prevent multiple redirects
let redirectInProgress = false;
let authChecked = false;

/**
 * Handle authentication redirect logic
 * Completely isolated from React's rendering cycle
 */
export const handleAuthRedirect = async (msalInstance) => {
  const timer = createTimer('handleAuthRedirect');
  
  // Prevent multiple simultaneous redirects
  if (redirectInProgress) {
    logAuthStep('Redirect already in progress, skipping', { redirectInProgress, authChecked });
    return;
  }

  // Only check once per page load
  if (authChecked) {
    logAuthStep('Auth already checked, skipping', { redirectInProgress, authChecked });
    return;
  }

  try {
    redirectInProgress = true;
    authChecked = true;

    logAuthStep('Starting authentication check', { redirectInProgress, authChecked });
    logMsalState(msalInstance, 'Before Auth Check');

    // Wait for MSAL to be ready
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check if there's an active account
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      logAuthStep('User already authenticated', { accountCount: accounts.length });
      timer.end();
      return;
    }

    // Check interaction status
    const interactionStatus = msalInstance.getInteractionStatus();
    if (interactionStatus !== 'None') {
      logAuthStep('Interaction already in progress', { interactionStatus });
      timer.end();
      return;
    }

    logAuthStep('Starting authentication redirect', { 
      accountCount: accounts.length, 
      interactionStatus 
    });
    
    // Import login request here to avoid circular dependencies
    const { loginRequest } = await import('../config/authConfig');
    logAuthStep('Login request imported', { scopes: loginRequest.scopes });
    
    // Perform redirect
    await msalInstance.loginRedirect(loginRequest);
    logAuthStep('Redirect initiated successfully');
    timer.end();
    
  } catch (error) {
    logError('handleAuthRedirect', error, { 
      redirectInProgress, 
      authChecked,
      msalConfig: msalInstance.getConfiguration()
    });
    redirectInProgress = false; // Reset on error
    authChecked = false; // Allow retry on error
    timer.end();
  }
};

/**
 * Reset function for testing and debugging
 */
export const resetAuthState = () => {
  redirectInProgress = false;
  authChecked = false;
  console.log('🔄 Auth state reset');
};

/**
 * Get current auth state for debugging
 */
export const getAuthState = () => ({
  redirectInProgress,
  authChecked
});
