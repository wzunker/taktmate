/**
 * Enhanced Debug Logger for Authentication Issues
 * 
 * Provides detailed logging and debugging capabilities for MSAL authentication
 */

/**
 * Log detailed MSAL state information
 */
export const logMsalState = (msalInstance, context = '') => {
  try {
    const accounts = msalInstance.getAllAccounts();
    const activeAccount = msalInstance.getActiveAccount();
    const interactionStatus = msalInstance.getInteractionStatus();
    
    console.group(`🔍 MSAL State Debug ${context ? `(${context})` : ''}`);
    console.log('📊 Accounts:', accounts.length, accounts.map(acc => ({
      username: acc.username,
      localAccountId: acc.localAccountId,
      tenantId: acc.tenantId
    })));
    console.log('👤 Active Account:', activeAccount ? {
      username: activeAccount.username,
      localAccountId: activeAccount.localAccountId
    } : 'None');
    console.log('🔄 Interaction Status:', interactionStatus);
    console.log('🌐 Instance ID:', msalInstance.getConfiguration().auth.clientId);
    console.log('🏠 Authority:', msalInstance.getConfiguration().auth.authority);
    console.groupEnd();
  } catch (error) {
    console.error('❌ Error logging MSAL state:', error);
  }
};

/**
 * Log React component state
 */
export const logReactState = (componentName, state) => {
  console.group(`⚛️ React State Debug (${componentName})`);
  Object.entries(state).forEach(([key, value]) => {
    console.log(`${key}:`, value);
  });
  console.groupEnd();
};

/**
 * Log authentication flow step
 */
export const logAuthStep = (step, details = {}) => {
  const timestamp = new Date().toISOString();
  console.log(`🚀 [${timestamp}] Auth Step: ${step}`, details);
};

/**
 * Log error with context
 */
export const logError = (context, error, additionalInfo = {}) => {
  console.group(`❌ Error in ${context}`);
  console.error('Error:', error);
  console.log('Error Code:', error.errorCode || 'N/A');
  console.log('Error Message:', error.message || error.toString());
  console.log('Stack:', error.stack);
  console.log('Additional Info:', additionalInfo);
  console.groupEnd();
};

/**
 * Performance timer for debugging slow operations
 */
export const createTimer = (label) => {
  const start = performance.now();
  return {
    end: () => {
      const duration = performance.now() - start;
      console.log(`⏱️ ${label}: ${duration.toFixed(2)}ms`);
      return duration;
    }
  };
};
