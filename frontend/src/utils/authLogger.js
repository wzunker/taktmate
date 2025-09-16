// Lightweight authentication logger that persists data and doesn't rely on UI rendering

class AuthLogger {
  constructor() {
    this.logKey = 'taktmate_auth_debug_log';
    this.maxLogEntries = 50;
    this.init();
  }

  init() {
    // Log initial page load
    this.log('PAGE_LOAD', {
      url: window.location.href,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString()
    });

    // Track URL changes
    this.trackUrlChanges();
    
    // Track auth state periodically
    this.startAuthMonitoring();
    
    // Add global error handler
    this.trackErrors();
    
    // Test auth endpoints immediately
    this.testAuthEndpoints();
  }

  log(event, data = {}) {
    const entry = {
      event,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      ...data
    };

    // Log to console
    console.log(`🔍 AUTH_DEBUG [${event}]:`, entry);

    // Save to localStorage
    try {
      const existingLogs = JSON.parse(localStorage.getItem(this.logKey) || '[]');
      existingLogs.push(entry);
      
      // Keep only last N entries
      const trimmedLogs = existingLogs.slice(-this.maxLogEntries);
      localStorage.setItem(this.logKey, JSON.stringify(trimmedLogs));
    } catch (e) {
      console.error('Failed to save auth log to localStorage:', e);
    }

    // Send to backend for server-side logging
    this.sendToBackend(entry);
  }

  async sendToBackend(entry) {
    try {
      await fetch('/api/debug-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(entry)
      });
    } catch (e) {
      // Silently fail - don't want logging to break the app
    }
  }

  trackUrlChanges() {
    let lastUrl = window.location.href;
    
    const checkUrlChange = () => {
      if (window.location.href !== lastUrl) {
        this.log('URL_CHANGE', {
          from: lastUrl,
          to: window.location.href,
          referrer: document.referrer
        });
        lastUrl = window.location.href;
      }
    };

    // Check every 100ms for URL changes
    setInterval(checkUrlChange, 100);
    
    // Also listen for popstate
    window.addEventListener('popstate', () => {
      this.log('POPSTATE', { url: window.location.href });
    });
  }

  async testAuthEndpoints() {
    const endpoints = [
      '/.auth/me',
      '/.auth/login/entraExternalId', 
      '/login',
      '/api/debug-auth'
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: 'GET',
          credentials: 'include',
          redirect: 'manual'
        });

        this.log('ENDPOINT_TEST', {
          endpoint,
          status: response.status,
          statusText: response.statusText,
          type: response.type,
          headers: Object.fromEntries(response.headers.entries())
        });

        // For /.auth/me, also log the response body
        if (endpoint === '/.auth/me' && response.status === 200) {
          try {
            const text = await response.text();
            const data = JSON.parse(text);
            this.log('AUTH_ME_RESPONSE', { data });
          } catch (e) {
            this.log('AUTH_ME_PARSE_ERROR', { error: e.message });
          }
        }
      } catch (error) {
        this.log('ENDPOINT_ERROR', {
          endpoint,
          error: error.message
        });
      }
    }
  }

  startAuthMonitoring() {
    const checkAuth = async () => {
      try {
        const response = await fetch('/.auth/me', {
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          this.log('AUTH_CHECK', {
            authenticated: !!data.clientPrincipal,
            clientPrincipal: data.clientPrincipal
          });
        } else {
          this.log('AUTH_CHECK_FAILED', {
            status: response.status,
            statusText: response.statusText
          });
        }
      } catch (error) {
        this.log('AUTH_CHECK_ERROR', { error: error.message });
      }
    };

    // Check auth state every 2 seconds
    setInterval(checkAuth, 2000);
    
    // Also check immediately
    checkAuth();
  }

  trackErrors() {
    window.addEventListener('error', (event) => {
      this.log('JS_ERROR', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.log('UNHANDLED_REJECTION', {
        reason: event.reason?.toString(),
        stack: event.reason?.stack
      });
    });
  }

  // Method to retrieve logs
  getLogs() {
    try {
      return JSON.parse(localStorage.getItem(this.logKey) || '[]');
    } catch (e) {
      return [];
    }
  }

  // Method to clear logs
  clearLogs() {
    localStorage.removeItem(this.logKey);
    console.log('🗑️ Auth debug logs cleared');
  }

  // Method to export logs as downloadable file
  exportLogs() {
    const logs = this.getLogs();
    const dataStr = JSON.stringify(logs, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `taktmate-auth-debug-${new Date().toISOString().slice(0, 19)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Add manual test methods
  async testLogin() {
    this.log('MANUAL_LOGIN_TEST', { action: 'redirecting to login' });
    window.location.href = '/.auth/login/entraExternalId';
  }

  async testLogout() {
    this.log('MANUAL_LOGOUT_TEST', { action: 'redirecting to logout' });
    window.location.href = '/.auth/logout';
  }

  // Method to display logs in console in a readable format
  printLogs() {
    const logs = this.getLogs();
    console.group('🔍 TaktMate Auth Debug Logs');
    logs.forEach((log, index) => {
      console.log(`${index + 1}. [${log.timestamp}] ${log.event}:`, log);
    });
    console.groupEnd();
  }
}

// Auto-initialize when script loads
const authLogger = new AuthLogger();

// Make it globally accessible for manual testing
window.authLogger = authLogger;

// Add some helpful console commands
console.log(`
🔍 TaktMate Auth Debug Logger Initialized!

Available commands:
- window.authLogger.printLogs() - View all logs in console
- window.authLogger.exportLogs() - Download logs as JSON file  
- window.authLogger.clearLogs() - Clear all logs
- window.authLogger.testLogin() - Test login flow
- window.authLogger.testLogout() - Test logout flow
- window.authLogger.getLogs() - Get raw log data

Logs are automatically saved to localStorage and console.
`);

export default authLogger;
