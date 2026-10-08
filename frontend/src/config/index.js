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

export const LIVE_BACKEND_URL = "https://madhura-wa-backend.onrender.com";

const getApiUrl = () => {
  const configured = clean(process.env.REACT_APP_API_URL);

  if (typeof window !== "undefined") {
    const { hostname, protocol } = window.location;
    // On Vercel cloud deployment
    if (hostname.includes("vercel.app")) {
      return configured || LIVE_BACKEND_URL;
    }
    // If configured explicitly with a public HTTPS backend (e.g. Render / domain), honor it
    if (configured && configured.startsWith("https://")) {
      return configured;
    }
    // In local / LAN browser environment, dynamically bind to the current host
    // so localhost, 127.0.0.1, or local LAN IP (e.g. 192.168.x.x) always talks to backend port 5001
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      /^192\.168\.\d+\.\d+$/.test(hostname) ||
      /^10\.\d+\.\d+\.\d+$/.test(hostname)
    ) {
      return `${protocol}//${hostname}:5001`;
    }
  }

  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    return LIVE_BACKEND_URL;
  }
  return "http://localhost:5001";
};

const getSocketUrl = () => {
  const configured = clean(process.env.REACT_APP_SOCKET_URL);
  if (configured) return configured;
  // Vercel Hobby plan does not proxy WebSocket upgrades. Point directly to Render backend.
  if (typeof window !== "undefined" && window.location.hostname.includes("vercel.app")) {
    return LIVE_BACKEND_URL;
  }
  if (process.env.NODE_ENV === "production") {
    return LIVE_BACKEND_URL;
  }
  return getApiUrl();
};

const API = getApiUrl();
const SOCKET = getSocketUrl();

export { API, SOCKET };
