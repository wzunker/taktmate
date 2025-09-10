import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  // Temporarily disabled StrictMode to fix infinite redirect loop
  // React 18 StrictMode intentionally double-mounts components which triggers multiple MSAL redirects
  // <React.StrictMode>
    <App />
  // </React.StrictMode>
);
