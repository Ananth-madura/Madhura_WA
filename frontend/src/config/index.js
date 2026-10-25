const clean = value => String(value || "").trim().replace(/\/+$/, "");

function apiOrigin() {
  const configured = clean(process.env.REACT_APP_API_URL);
  if (configured) return configured;
  if (typeof window !== "undefined") {
    const { hostname, protocol } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1" || /^192\.168\.\d+\.\d+$/.test(hostname) || /^10\.\d+\.\d+\.\d+$/.test(hostname)) return `${protocol}//${hostname}:5001`;
  }
  return process.env.NODE_ENV === "production" ? "" : "http://localhost:5001";
}

export const API = apiOrigin();
export const SOCKET = clean(process.env.REACT_APP_SOCKET_URL) || API;
export const LIVE_BACKEND_URL = API;
