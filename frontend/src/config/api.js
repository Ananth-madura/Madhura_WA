import { API as API_CONSTANT } from "./index";

export const API = API_CONSTANT;
export const API_PROXY_URL = API_CONSTANT;
export const API_BACKEND = API_CONSTANT;

export const getApiUrl = (path) => {
  if (path.startsWith("/api")) {
    return `${API}${path}`;
  }
  return `${API}${path}`;
};

export default API;
