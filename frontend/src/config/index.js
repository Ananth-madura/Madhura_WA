// Whatsapp_CRM API base URL.
// Dev default targets the standalone WA backend on :5001 (NOT the CRM :5000).
// Production builds use same-origin ("") behind nginx; or set REACT_APP_API_URL.
const getApiUrl = () => {
  if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;
  if (process.env.NODE_ENV === "production") return "";
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  return `${protocol}//${hostname}:5001`;
};

const API = getApiUrl();

export { API };
