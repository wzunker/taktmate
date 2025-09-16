import React, { useState, useEffect, useCallback } from 'react';

const AuthDebugger = () => {
  const [debugData, setDebugData] = useState({
    currentUrl: window.location.href,
    timestamp: new Date().toISOString(),
    authMeResponse: null,
    authMeError: null,
    cookies: {},
    headers: {},
    redirectHistory: []
  });

  const [isExpanded, setIsExpanded] = useState(true);

  // Track URL changes
  useEffect(() => {
    const trackUrlChange = () => {
      setDebugData(prev => ({
        ...prev,
        currentUrl: window.location.href,
        timestamp: new Date().toISOString(),
        redirectHistory: [...prev.redirectHistory, {
          url: window.location.href,
          timestamp: new Date().toISOString(),
          referrer: document.referrer
        }].slice(-10) // Keep last 10 redirects
      }));
    };

    // Listen for navigation changes
    window.addEventListener('popstate', trackUrlChange);
    
    // Track initial load
    trackUrlChange();

    return () => window.removeEventListener('popstate', trackUrlChange);
  }, []);

  // Fetch auth status
  const fetchAuthStatus = useCallback(async () => {
    try {
      const response = await fetch('/.auth/me', {
        method: 'GET',
        credentials: 'include'
      });
      
      const responseText = await response.text();
      let responseData;
      
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        responseData = { rawResponse: responseText };
      }

      setDebugData(prev => ({
        ...prev,
        authMeResponse: {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          data: responseData
        },
        authMeError: null
      }));
    } catch (error) {
      setDebugData(prev => ({
        ...prev,
        authMeResponse: null,
        authMeError: {
          message: error.message,
          stack: error.stack
        }
      }));
    }
  }, []);

  // Get cookies
  const getCookies = () => {
    const cookies = {};
    document.cookie.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      if (name) cookies[name] = value;
    });
    return cookies;
  };

  // Test different auth endpoints
  const testEndpoint = useCallback(async (endpoint) => {
    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        credentials: 'include',
        redirect: 'manual' // Don't follow redirects automatically
      });
      
      return {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        type: response.type
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  }, []);

  const runFullDiagnostic = useCallback(async () => {
    console.log('🔍 Starting comprehensive auth diagnostic...');
    
    const endpoints = [
      '/.auth/me',
      '/.auth/login/entraExternalId',
      '/.auth/logout',
      '/login',
      '/'
    ];

    const results = {};
    for (const endpoint of endpoints) {
      console.log(`Testing ${endpoint}...`);
      results[endpoint] = await testEndpoint(endpoint);
    }

    setDebugData(prev => ({
      ...prev,
      endpointTests: results,
      cookies: getCookies(),
      timestamp: new Date().toISOString()
    }));

    // Also fetch auth status
    await fetchAuthStatus();
  }, [fetchAuthStatus, testEndpoint]);

  useEffect(() => {
    runFullDiagnostic();
  }, [runFullDiagnostic]);

  const clearHistory = () => {
    setDebugData(prev => ({
      ...prev,
      redirectHistory: []
    }));
  };

  if (!isExpanded) {
    return (
      <div className="fixed top-4 right-4 z-50">
        <button 
          onClick={() => setIsExpanded(true)}
          className="bg-red-500 text-white px-3 py-2 rounded shadow-lg"
        >
          🐛 Debug Auth
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-auto">
      <div className="bg-white m-4 p-6 rounded-lg max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-red-600">🐛 Authentication Debugger</h2>
          <div className="space-x-2">
            <button 
              onClick={runFullDiagnostic}
              className="bg-blue-500 text-white px-3 py-1 rounded"
            >
              Refresh
            </button>
            <button 
              onClick={() => setIsExpanded(false)}
              className="bg-gray-500 text-white px-3 py-1 rounded"
            >
              Minimize
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Current State */}
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded">
              <h3 className="font-bold text-blue-800 mb-2">Current State</h3>
              <p><strong>URL:</strong> <code className="text-xs">{debugData.currentUrl}</code></p>
              <p><strong>Timestamp:</strong> {debugData.timestamp}</p>
              <p><strong>Referrer:</strong> <code className="text-xs">{document.referrer || 'None'}</code></p>
            </div>

            {/* Auth Status */}
            <div className="bg-green-50 p-4 rounded">
              <h3 className="font-bold text-green-800 mb-2">/.auth/me Response</h3>
              {debugData.authMeResponse ? (
                <div>
                  <p><strong>Status:</strong> {debugData.authMeResponse.status} {debugData.authMeResponse.statusText}</p>
                  <pre className="text-xs bg-gray-100 p-2 mt-2 rounded overflow-auto max-h-32">
                    {JSON.stringify(debugData.authMeResponse.data, null, 2)}
                  </pre>
                </div>
              ) : debugData.authMeError ? (
                <div className="text-red-600">
                  <p><strong>Error:</strong> {debugData.authMeError.message}</p>
                </div>
              ) : (
                <p>Loading...</p>
              )}
            </div>

            {/* Cookies */}
            <div className="bg-yellow-50 p-4 rounded">
              <h3 className="font-bold text-yellow-800 mb-2">Cookies</h3>
              <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
                {JSON.stringify(debugData.cookies, null, 2)}
              </pre>
            </div>
          </div>

          {/* Endpoint Tests */}
          <div className="space-y-4">
            <div className="bg-purple-50 p-4 rounded">
              <h3 className="font-bold text-purple-800 mb-2">Endpoint Tests</h3>
              {debugData.endpointTests ? (
                <div className="space-y-2">
                  {Object.entries(debugData.endpointTests).map(([endpoint, result]) => (
                    <div key={endpoint} className="border-l-4 border-gray-300 pl-3">
                      <p className="font-mono text-sm"><strong>{endpoint}</strong></p>
                      <pre className="text-xs bg-gray-100 p-1 rounded">
                        {JSON.stringify(result, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              ) : (
                <p>Running tests...</p>
              )}
            </div>
          </div>

          {/* Redirect History */}
          <div className="lg:col-span-2 bg-red-50 p-4 rounded">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-red-800">Redirect History</h3>
              <button 
                onClick={clearHistory}
                className="text-xs bg-red-200 px-2 py-1 rounded"
              >
                Clear
              </button>
            </div>
            {debugData.redirectHistory.length > 0 ? (
              <div className="space-y-1">
                {debugData.redirectHistory.map((redirect, index) => (
                  <div key={index} className="text-xs border-l-2 border-red-300 pl-2">
                    <p><strong>#{index + 1}</strong> {redirect.timestamp}</p>
                    <p><strong>URL:</strong> <code>{redirect.url}</code></p>
                    <p><strong>Referrer:</strong> <code>{redirect.referrer || 'None'}</code></p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No redirects tracked yet</p>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-6 p-4 bg-gray-50 rounded">
          <h3 className="font-bold mb-2">Quick Actions</h3>
          <div className="space-x-2">
            <button 
              onClick={() => window.location.href = '/.auth/login/entraExternalId'}
              className="bg-green-500 text-white px-3 py-1 rounded text-sm"
            >
              Try Login
            </button>
            <button 
              onClick={() => window.location.href = '/.auth/logout'}
              className="bg-red-500 text-white px-3 py-1 rounded text-sm"
            >
              Try Logout
            </button>
            <button 
              onClick={() => window.location.href = '/'}
              className="bg-blue-500 text-white px-3 py-1 rounded text-sm"
            >
              Go to Root
            </button>
            <button 
              onClick={() => {
                // Clear all cookies
                document.cookie.split(";").forEach(c => {
                  const eqPos = c.indexOf("=");
                  const name = eqPos > -1 ? c.substr(0, eqPos) : c;
                  document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
                });
                window.location.reload();
              }}
              className="bg-orange-500 text-white px-3 py-1 rounded text-sm"
            >
              Clear Cookies & Reload
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthDebugger;
