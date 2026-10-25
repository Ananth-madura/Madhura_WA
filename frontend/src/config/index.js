const clean = value => String(value || "").trim().replace(/\/+$/, "");
export const PRODUCTION_ORIGINS=Object.freeze({app:"https://live.wa.madhuratech.in",marketing:"https://wa.madhuratech.in",api:"https://api.madhuratech.in"});
export function resolveApiOrigin(configured,location,production=false){
  if(clean(configured))return clean(configured);
  if(location){
    if(location.hostname==="live.wa.madhuratech.in")return PRODUCTION_ORIGINS.api;
    if(location.hostname==="localhost"||location.hostname==="127.0.0.1"||/^192\.168\.\d+\.\d+$/.test(location.hostname)||/^10\.\d+\.\d+\.\d+$/.test(location.hostname))return `${location.protocol}//${location.hostname}:5001`;
  }
  return production?PRODUCTION_ORIGINS.api:"http://localhost:5001";
}

function apiOrigin() {
  return resolveApiOrigin(process.env.REACT_APP_API_URL,typeof window!=="undefined"?window.location:null,process.env.NODE_ENV==="production");
}

export const API = apiOrigin();
export const SOCKET = clean(process.env.REACT_APP_SOCKET_URL) || API;
export const LIVE_BACKEND_URL = API;
export const MARKETING = clean(process.env.REACT_APP_MARKETING_URL)||(process.env.NODE_ENV==="production"?PRODUCTION_ORIGINS.marketing:"");
