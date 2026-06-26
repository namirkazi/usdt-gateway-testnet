import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#172119',
            color: '#e5e7eb',
            border: '1px solid #243328',
            fontFamily: 'Inter, sans-serif',
          },
          success: { iconTheme: { primary: '#22c55e', secondary: '#0a0f0d' } },
          error:   { iconTheme: { primary: '#ef4444', secondary: '#0a0f0d' } },
        }}
      />
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
