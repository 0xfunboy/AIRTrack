import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import './wallet';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element not found');

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <ToastProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ToastProvider>
  </React.StrictMode>
);
