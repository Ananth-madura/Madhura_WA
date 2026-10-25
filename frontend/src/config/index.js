const clean = value => String(value || "").trim().replace(/\/+$/, "");
export const PRODUCTION_ORIGINS=Object.freeze({app:"https://live.wa.madhuratech.in",marketing:"https://wa.madhuratech.in",api:"https://api.madhuratech.in"});
const localHost=hostname=>["localhost","127.0.0.1","[::1]","::1"].includes(hostname)||/^192\.168\.\d+\.\d+$/.test(hostname)||/^10\.\d+\.\d+\.\d+$/.test(hostname)||/^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(hostname);
export function resolveApiOrigin(configured,location,production=false){
  if(clean(configured)){
    try{
      const target=new URL(clean(configured));
      if(location&&localHost(target.hostname)){
        if(localHost(location.hostname)){target.hostname=location.hostname;return clean(target.href);}
        if(location.hostname==="live.wa.madhuratech.in")return PRODUCTION_ORIGINS.api;
      }
    }catch(_){}
    return clean(configured);
  }
  if(location){
    if(location.hostname==="live.wa.madhuratech.in")return PRODUCTION_ORIGINS.api;
    if(localHost(location.hostname))return `${location.protocol}//${location.hostname}:5001`;
  }
  return production?PRODUCTION_ORIGINS.api:"http://localhost:5001";
}

function apiOrigin() {
  return resolveApiOrigin(process.env.REACT_APP_API_URL,typeof window!=="undefined"?window.location:null,process.env.NODE_ENV==="production");
}

export const API = apiOrigin();
export const SOCKET = clean(process.env.REACT_APP_SOCKET_URL)?resolveApiOrigin(process.env.REACT_APP_SOCKET_URL,typeof window!=="undefined"?window.location:null,process.env.NODE_ENV==="production"):API;
export const LIVE_BACKEND_URL = API;
export const MARKETING = clean(process.env.REACT_APP_MARKETING_URL)||(process.env.NODE_ENV==="production"?PRODUCTION_ORIGINS.marketing:"");
