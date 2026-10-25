import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import AppErrorBoundary from './components/AppErrorBoundary';

// NOTE: the Socket.IO clients are imported *by the pages that need them*
// (whatsapp.jsx, whatsappAccounts.jsx, WhatsAppNav.jsx,
// WhatsAppInteractiveReminders.jsx). They are deliberately NOT opened here.
//
// Two reasons:
//  1. src/socket/socket.js calls io() twice at module scope, so importing it
//     from the entry point made EVERY visitor - including a visitor sitting on
//     the public landing page - hold two persistent WebSocket connections
//     against the backend.
//  2. Those pages are React.lazy candidates. Importing the socket from index.js
//     put socket.io-client in the main bundle and cancelled the code split.
//
// If any code expects the legacy `window.socket` handle, import it from
// `src/socket/socket` inside the component that needs it instead.

const container = document.getElementById('root');
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <AppErrorBoundary><App /></AppErrorBoundary>
  </React.StrictMode>
);
