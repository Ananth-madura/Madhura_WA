import axios from "axios";
import { API } from "../config/api";

let pendingRefresh;
const installed=new WeakSet();
export function hasCookieSession() {
  try{return JSON.parse(localStorage.getItem("user")||"null")?.cookieSession===true;}catch(_){return false;}
}
function backendRequest(config) {
  try{return new URL(config.url,config.baseURL||API||window.location.origin).origin===new URL(API||window.location.origin).origin;}catch(_){return false;}
}
export function refreshBrowserSession() {
  if(!pendingRefresh) {
    const request=async()=>{
      const response=await fetch(`${API}/api/auth/refresh`,{method:"POST",credentials:"include",headers:{"X-Browser-Session":"1"}});
      if(!response.ok)throw Object.assign(new Error(response.status===401?"Your browser session expired. Sign in again.":"The session service is unavailable."),{status:response.status});
      return response.json();
    };
    pendingRefresh=(typeof navigator!=="undefined"&&navigator.locks?navigator.locks.request("wa-session-refresh",request):request()).finally(()=>{pendingRefresh=null;});
  }
  return pendingRefresh;
}
export function installBrowserSession(client) {
  if(installed.has(client))return;
  installed.add(client);
  client.interceptors.request.use(config=>{
    if(!backendRequest(config))return config;
    config.withCredentials=true;
    config.headers=config.headers||{};
    config.headers["X-Browser-Session"]="1";
    const tenant=localStorage.getItem("active_tenant_id"),branch=localStorage.getItem("active_branch_id");
    if(tenant && !config.headers["x-tenant-id"])config.headers["x-tenant-id"]=tenant;
    if(branch && !config.headers["x-branch-id"])config.headers["x-branch-id"]=branch;
    if(hasCookieSession()) {
      if(config.headers.delete)config.headers.delete("Authorization");
      else {delete config.headers.Authorization;delete config.headers.authorization;}
    }
    return config;
  });
  client.interceptors.response.use(response=>response,async error=>{
    const config=error.config;
    if(!config||!backendRequest(config)||!hasCookieSession()||error.response?.status!==401||config._browserRetried||/\/auth\//.test(config.url))throw error;
    config._browserRetried=true;
    try{await refreshBrowserSession();return client(config);}catch(refreshError){if([401,403].includes(refreshError.status))window.dispatchEvent(new CustomEvent("wa_auth_expired"));throw refreshError;}
  });
}
installBrowserSession(axios);
