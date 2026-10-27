import axios from "axios";
import { API } from "../config/api";
import {validateJsonResponse} from "../utils/apiPayload";
import { demoAdapter, isDemoPreview } from "./demoApi";

let pendingRefresh;
const installed=new WeakSet();
export function hasCookieSession() {
  try{return JSON.parse(localStorage.getItem("user")||"null")?.cookieSession===true;}catch(_){return false;}
}
export async function confirmBrowserSession(data){
  if(!(data?.cookieSession||data?.user?.cookieSession))return data;
  let response,profile;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{
    response=await fetch(`${API}/api/auth/session`,{credentials:"include",headers:{"X-Browser-Session":"1"},signal:controller.signal});
    profile=await response.json().catch(()=>null);
  }catch(_){throw Object.assign(new Error("The sign-in session could not be checked. Check the API connection and sign in again."),{friendlyMessage:"The sign-in session could not be checked. Check the API connection and sign in again."});}
  finally{clearTimeout(timer);}
  if(!response.ok||!profile?.success||Number(profile.user?.id)!==Number(data.user?.id)){
    const message=response.status>=500?"The session service is unavailable. Sign in again when the backend is ready.":"Your browser could not keep the sign-in session. Use matching app and API hostnames and allow cookies, then sign in again.";
    throw Object.assign(new Error(message),{code:"BROWSER_SESSION_UNAVAILABLE",friendlyMessage:message});
  }
  return data;
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
    if(isDemoPreview() && !/\/auth\/(login|self-signup|verify-2fa|logout|refresh|session)$/.test(new URL(config.url,config.baseURL||API).pathname)) {
      config.adapter=demoAdapter;
      config.withCredentials=false;
      config.headers=config.headers||{};
      for(const name of ["Authorization","authorization","X-Browser-Session"]) {
        if(config.headers.delete)config.headers.delete(name);else delete config.headers[name];
      }
      return config;
    }
    if((config.method||"get").toLowerCase()==="get"&&!config.timeout)config.timeout=15000;
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
  client.interceptors.response.use(response=>backendRequest(response.config||{})?validateJsonResponse(response):response,async error=>{
    const config=error.config;
    if(!config||!backendRequest(config)||!hasCookieSession()||error.response?.status!==401||config._browserRetried||/\/auth\//.test(config.url))throw error;
    config._browserRetried=true;
    try{await refreshBrowserSession();return client(config);}catch(refreshError){if([401,403].includes(refreshError.status))window.dispatchEvent(new CustomEvent("wa_auth_expired"));throw refreshError;}
  });
}
installBrowserSession(axios);
