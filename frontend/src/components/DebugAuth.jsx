import React, { useState, useEffect } from 'react';

/**
 * Debug component to help troubleshoot authentication issues
 * Shows detailed information about the current authentication state
 */
const DebugAuth = () => {
  const [authInfo, setAuthInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAuthInfo = async () => {
      try {
        setLoading(true);
        
        // Test the /.auth/me endpoint
        const response = await fetch('/.auth/me');
        const data = await response.json();
        
        setAuthInfo({
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          data: data
        });
        
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAuthInfo();
  }, []);

  const testLoginEndpoint = async () => {
    try {
      const response = await fetch('/.auth/login/entraExternalId', {
        redirect: 'manual'
      });
      
      console.log('Login endpoint test:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        url: response.url
      });
      
      alert(`Login endpoint returned: ${response.status} ${response.statusText}\nCheck console for details`);
    } catch (err) {
      console.error('Login endpoint error:', err);
      alert(`Login endpoint error: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 m-4">
        <h3 className="font-medium text-yellow-900">Loading auth debug info...</h3>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 m-4">
      <h3 className="font-medium text-gray-900 mb-4">🔍 Authentication Debug Info</h3>
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
          <p className="text-red-700">Error: {error}</p>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <h4 className="font-medium text-gray-700">/.auth/me Response:</h4>
          <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
            {JSON.stringify(authInfo, null, 2)}
          </pre>
        </div>

        <div className="flex space-x-2">
          <button
            onClick={testLoginEndpoint}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Test Login Endpoint
          </button>
          
          <button
            onClick={() => window.location.href = '/.auth/login/entraExternalId'}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Try Direct Login
          </button>
        </div>

        <div>
          <h4 className="font-medium text-gray-700">Current URL Info:</h4>
          <pre className="bg-gray-100 p-3 rounded text-sm">
{`URL: ${window.location.href}
Origin: ${window.location.origin}
Pathname: ${window.location.pathname}
Search: ${window.location.search}`}
          </pre>
        </div>

        <div>
          <h4 className="font-medium text-gray-700">Expected Behavior:</h4>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
            <li>/.auth/me should return clientPrincipal: null when not authenticated</li>
            <li>/.auth/login/entraExternalId should redirect to External ID login</li>
            <li>Main page should redirect to login if staticwebapp.config.json is working</li>
            <li>After login, /.auth/me should return user information</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default DebugAuth;
