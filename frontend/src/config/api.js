import { API as API_CONSTANT, SOCKET as SOCKET_CONSTANT, LIVE_BACKEND_URL as LIVE_BACKEND_CONSTANT } from "./index";

export const API = API_CONSTANT;
export const SOCKET = SOCKET_CONSTANT;
export const API_PROXY_URL = API_CONSTANT;
export const API_BACKEND = API_CONSTANT;
export const LIVE_BACKEND_URL = LIVE_BACKEND_CONSTANT;

export const getApiUrl = (path) => `${API}${path}`;

export default API;
