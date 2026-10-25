import axios from "axios";
import { API } from "./index";
import { installBrowserSession, hasCookieSession } from "../auth/browserSession";

const api = axios.create({
  baseURL: API,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token && !hasCookieSession()) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const tenantId = localStorage.getItem("active_tenant_id");
  if (tenantId) {
    config.headers["x-tenant-id"] = tenantId;
  }
  const branchId = localStorage.getItem("active_branch_id");
  if (branchId) {
    config.headers["x-branch-id"] = branchId;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Session token expired or revoked
    if (error.response?.status === 401 && !hasCookieSession()) {
      const isAuthRoute =
        error.config?.url?.includes("/auth/login") ||
        error.config?.url?.includes("/auth/verify");
      if (!isAuthRoute && typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("wa_auth_expired", { detail: { error } })
        );
      }
    }
    // Network connectivity / timeout
    if (error.code === "ECONNABORTED" || error.message?.includes("Network Error")) {
      error.isNetworkError = true;
      error.friendlyMessage =
        "Network timeout or unreachable backend. Please check your connection.";
    }
    return Promise.reject(error);
  }
);
installBrowserSession(api);

export default api;

export const API_PROXY_URL = API;
