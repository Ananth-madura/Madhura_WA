const clean = value => String(value || "").trim().replace(/\/+$/, "");
export const PRODUCTION_ORIGINS=Object.freeze({app:"https://live.wa.madhuratech.in",marketing:"https://wa.madhuratech.in",api:"https://api.madhuratech.in"});

// Direct address of the cloud backend. Baked in because a browser can only fall
// back to it if it knows the address before the first request; override it with
// REACT_APP_CLOUD_API_URL when the box moves. HTTPS pages cannot call an http
// origin (mixed content), so this candidate is only offered on http pages.
export const CLOUD_API_ORIGIN = clean(process.env.REACT_APP_CLOUD_API_URL) || "http://187.127.215.13:5001";

// A working origin discovered at login time survives reloads here. Keeping it
// in localStorage rather than in the bundle means the same build can point at
// localhost, the VPS IP or the production domain without a rebuild.
const API_OVERRIDE_KEY = "wa_api_origin";

const localHost=hostname=>["localhost","127.0.0.1","[::1]","::1"].includes(hostname)||/^192\.168\.\d+\.\d+$/.test(hostname)||/^10\.\d+\.\d+\.\d+$/.test(hostname)||/^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(hostname);
// The known cloud box serves the app and the API from the same address, so a
// page loaded from it must call its own :5001, not the visitor's localhost.
const cloudHost=hostname=>hostname==="187.127.215.13";
const sameServerHost=hostname=>localHost(hostname)||cloudHost(hostname);
const appHost=hostname=>["live.wa.madhuratech.in","live.madhuratech.in"].includes(hostname);

function normaliseOrigin(value) {
  const raw = clean(value);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return clean(url.origin);
  } catch (_) {
    return "";
  }
}

export function readApiOverride() {
  try { return normaliseOrigin(localStorage.getItem(API_OVERRIDE_KEY)); } catch (_) { return ""; }
}

export function saveApiOverride(origin) {
  const normalised = normaliseOrigin(origin);
  try {
    if (normalised) localStorage.setItem(API_OVERRIDE_KEY, normalised);
  } catch (_) {}
  return normalised;
}

export function clearApiOverride() {
  try { localStorage.removeItem(API_OVERRIDE_KEY); } catch (_) {}
}

export function resolveApiOrigin(configured,location,production=false){
  if(clean(configured)){
    try{
      const target=new URL(clean(configured));
      if(location&&localHost(target.hostname)){
        if(sameServerHost(location.hostname)){target.hostname=location.hostname;return clean(target.href);}
        if(production||appHost(location.hostname))return PRODUCTION_ORIGINS.api;
      }
    }catch(_){}
    return clean(configured);
  }
  if(location){
    if(appHost(location.hostname))return PRODUCTION_ORIGINS.api;
    if(sameServerHost(location.hostname)){
      // The box can serve the app and proxy /api from the same port (see
      // deploy/nginx-ip.conf), which is what an IP-only install does. Nothing
      // to configure: a page opened on the plain port calls its own origin.
      if(cloudHost(location.hostname)&&!location.port)return `${location.protocol}//${location.hostname}`;
      return `${location.protocol}//${location.hostname}:5001`;
    }
  }
  return production?PRODUCTION_ORIGINS.api:"http://localhost:5001";
}

export function resolveMarketingOrigin(configured,location,production=false){
  const fallback=location&&sameServerHost(location.hostname)?`${location.protocol}//${location.hostname}:3002`:production?PRODUCTION_ORIGINS.marketing:"http://localhost:3002";
  if(!clean(configured))return fallback;
  try{
    const target=new URL(clean(configured));
    if(!["http:","https:"].includes(target.protocol))return fallback;
    if(location&&localHost(target.hostname)){
      if(sameServerHost(location.hostname))target.hostname=location.hostname;
      else if(production||appHost(location.hostname))return fallback;
    }
    return clean(target.href);
  }catch(_){return fallback;}
}

function apiOrigin() {
  const override = readApiOverride();
  if (override) return override;
  return resolveApiOrigin(process.env.REACT_APP_API_URL,typeof window!=="undefined"?window.location:null,process.env.NODE_ENV==="production");
}

function socketOrigin() {
  const override = readApiOverride();
  if (override) return override;
  return clean(process.env.REACT_APP_SOCKET_URL)?resolveApiOrigin(process.env.REACT_APP_SOCKET_URL,typeof window!=="undefined"?window.location:null,process.env.NODE_ENV==="production"):API;
}

/**
 * Ordered list of backends to try while signing in.
 *
 * The primary origin comes first so normal deployments pay no extra latency.
 * The cloud IP is only reachable from an http page; including it on https would
 * just produce a mixed-content console error before every login.
 */
export function apiCandidates(location) {
  const here = location || (typeof window !== "undefined" ? window.location : null);
  const candidates = [];
  const add = value => {
    const origin = normaliseOrigin(value);
    if (origin && !candidates.includes(origin)) candidates.push(origin);
  };
  add(readApiOverride());
  // An IP-only install serves the app and proxies /api on one port. Trying that
  // origin first keeps login working with no CORS and no exposed API port.
  if (here && cloudHost(here.hostname) && !here.port && here.origin) add(here.origin);
  add(apiOrigin());
  if (!here || here.protocol !== "https:") add(CLOUD_API_ORIGIN);
  add(PRODUCTION_ORIGINS.api);
  return candidates;
}

export const API = apiOrigin();
export const SOCKET = socketOrigin();
export const LIVE_BACKEND_URL = API;
export const MARKETING = resolveMarketingOrigin(process.env.REACT_APP_MARKETING_URL,typeof window!=="undefined"?window.location:null,process.env.NODE_ENV==="production");
