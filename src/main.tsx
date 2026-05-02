import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Client-side error reporting
window.onerror = (message, source, lineno, colno, error) => {
  fetch('/api/debug/client-error', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, source, lineno, colno, error: error?.stack })
  }).catch(() => {});
};

window.onunhandledrejection = (event) => {
  fetch('/api/debug/client-error', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Unhandled Rejection', reason: event.reason })
  }).catch(() => {});
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
