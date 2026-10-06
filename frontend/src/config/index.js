// Whatsapp_CRM API base URL.
//
// Two independent origins matter here:
//
//   API   - HTTP/REST. Left EMPTY in production so every request is SAME-ORIGIN
//           (/api/... on the Vercel domain) and Vercel's rewrite forwards it to
//           the VPS. Same-origin means no CORS preflight, no third-party
//           cookie blocking, and one less thing to break at 2am.
//
//   SOCKET - WebSocket. Vercel only proxies WebSocket upgrades on paid plans, so
//           by default we point the socket straight at the backend origin
//           (REACT_APP_SOCKET_URL). The backend allowlists the Vercel domain in
//           ALLOWED_ORIGINS, so this is a normal cross-origin socket.
//
// If you are on Vercel Pro/Enterprise and would rather keep everything
// same-origin, simply leave REACT_APP_SOCKET_URL unset - the socket then falls
// back to API (i.e. the Vercel domain) and rides the /socket.io rewrite.

const clean = (v) => (v ? String(v).trim().replace(/\/+$/, "") : "");

const getApiUrl = () => {
  const configured = clean(process.env.REACT_APP_API_URL);
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") return ""; // same-origin, proxied by Vercel
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  return `${protocol}//${hostname}:5001`;
};

const getSocketUrl = () => {
  const configured = clean(process.env.REACT_APP_SOCKET_URL);
  if (configured) return configured;
  return getApiUrl() || clean(window.location.origin);
};

const API = getApiUrl();
const SOCKET = getSocketUrl();

export { API, SOCKET };
