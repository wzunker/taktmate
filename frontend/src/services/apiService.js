/**
 * API Service for TaktMate Frontend
 * 
 * This service handles all API communications with proper authentication,
 * error handling, and token management.
 */

import React from 'react';
import axios from 'axios';
import { AuthContext } from '../contexts/AuthContext';

// Create axios instance with base configuration
const baseURL = process.env.REACT_APP_API_URL || 'https://taktmate-backend-api-csheb3aeg8f5bcbv.eastus-01.azurewebsites.net';
console.log('🔍 API Service Debug - Base URL:', baseURL);
console.log('🔍 API Service Debug - Environment variable REACT_APP_API_URL:', process.env.REACT_APP_API_URL);

const apiClient = axios.create({
  baseURL: baseURL,
  timeout: 30000, // 30 second timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Authentication context reference
 * This will be set by the AuthProvider
 */
let authContext = null;

/**
 * Set authentication context
 */
export const setAuthContext = (context) => {
  authContext = context;
};

/**
 * Request interceptor to add authentication headers
 */
apiClient.interceptors.request.use(
  async (config) => {
    try {
      if (authContext && authContext.isAuthenticated) {
        const authHeaders = await authContext.getAuthHeaders();
        config.headers = { ...config.headers, ...authHeaders };
      }
    } catch (error) {
      console.error('Failed to add auth headers:', error);
      // Continue with request even if auth headers fail
    }
    
    // Add request timestamp for debugging
    config.metadata = { startTime: new Date() };
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Response interceptor to handle errors and token refresh
 */
apiClient.interceptors.response.use(
  (response) => {
    // Add response time for debugging
    if (response.config.metadata) {
      response.config.metadata.endTime = new Date();
      response.config.metadata.duration = response.config.metadata.endTime - response.config.metadata.startTime;
    }
    
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // Handle 401 Unauthorized errors
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        if (authContext && authContext.isAuthenticated) {
          // Try to refresh the token
          const authHeaders = await authContext.getAuthHeaders(true); // Force refresh
          originalRequest.headers = { ...originalRequest.headers, ...authHeaders };
          
          // Retry the original request
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        
        // If token refresh fails, redirect to login
        if (authContext && authContext.signOut) {
          await authContext.signOut();
        }
        
        return Promise.reject(refreshError);
      }
    }
    
    // Handle other errors
    const enhancedError = {
      ...error,
      timestamp: new Date(),
      requestConfig: {
        url: error.config?.url,
        method: error.config?.method,
        baseURL: error.config?.baseURL,
      },
      response: error.response ? {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
      } : null,
    };
    
    return Promise.reject(enhancedError);
  }
);

/**
 * Generic API request handler
 */
const makeRequest = async (config) => {
  try {
    const response = await apiClient(config);
    return {
      success: true,
      data: response.data,
      status: response.status,
      headers: response.headers,
      duration: response.config.metadata?.duration,
    };
  } catch (error) {
    console.error('API request failed:', error);
    
    return {
      success: false,
      error: {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        code: error.code,
        timestamp: error.timestamp,
      },
    };
  }
};

/**
 * File upload service
 */
export const uploadFile = async (file, onUploadProgress = null) => {
  const formData = new FormData();
  formData.append('file', file);
  
  return makeRequest({
    method: 'POST',
    url: '/upload',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: onUploadProgress ? (progressEvent) => {
      const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
      onUploadProgress(percentCompleted);
    } : undefined,
  });
};

/**
 * Chat service
 */
export const sendChatMessage = async (message, fileId) => {
  return makeRequest({
    method: 'POST',
    url: '/chat',
    data: {
      message,
      fileId,
    },
  });
};

/**
 * File management services
 */
export const getUserFiles = async () => {
  return makeRequest({
    method: 'GET',
    url: '/files',
  });
};

export const getFileById = async (fileId) => {
  return makeRequest({
    method: 'GET',
    url: `/files/${fileId}`,
  });
};

export const deleteFile = async (fileId) => {
  return makeRequest({
    method: 'DELETE',
    url: `/files/${fileId}`,
  });
};

/**
 * User profile service
 */
export const getUserProfile = async () => {
  return makeRequest({
    method: 'GET',
    url: '/profile',
  });
};

/**
 * Health check service
 */
export const healthCheck = async () => {
  return makeRequest({
    method: 'GET',
    url: '/health',
  });
};

/**
 * Error reporting service
 */
export const reportError = async (error, context = {}) => {
  try {
    return makeRequest({
      method: 'POST',
      url: '/error-report',
      data: {
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
        context: {
          ...context,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href,
        },
      },
    });
  } catch (reportingError) {
    console.error('Failed to report error:', reportingError);
    // Don't throw here to avoid infinite loops
  }
};

/**
 * API service class for organized access
 */
class ApiService {
  /**
   * File operations
   */
  files = {
    upload: uploadFile,
    list: getUserFiles,
    get: getFileById,
    delete: deleteFile,
  };

  /**
   * Chat operations
   */
  chat = {
    sendMessage: sendChatMessage,
  };

  /**
   * User operations
   */
  user = {
    getProfile: getUserProfile,
  };

  /**
   * System operations
   */
  system = {
    healthCheck: healthCheck,
    reportError: reportError,
  };

  /**
   * Raw API client access for custom requests
   */
  client = apiClient;

  /**
   * Make custom request
   */
  request = makeRequest;

  /**
   * Set authentication context
   */
  setAuth = setAuthContext;
}

// Export singleton instance
export const apiService = new ApiService();

// Export default instance
export default apiService;

/**
 * Hook for using API service with authentication context
 */
export const useApiService = () => {
  const authContext = React.useContext(AuthContext);
  
  React.useEffect(() => {
    if (authContext) {
      setAuthContext(authContext);
    }
  }, [authContext]);
  
  return apiService;
};
