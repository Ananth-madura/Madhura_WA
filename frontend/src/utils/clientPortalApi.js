import axios from 'axios';
import { API } from '../config/api';
import { installBrowserSession } from '../auth/browserSession';
export const PORTAL_TOKEN = 'client_portal_token';
export function portalToken() { return sessionStorage.getItem(PORTAL_TOKEN); }
export function setPortalToken(value) { if (value) sessionStorage.setItem(PORTAL_TOKEN, value); else sessionStorage.removeItem(PORTAL_TOKEN); }
export function portalApi(staff = false) {
  const client = axios.create({ baseURL: `${API}/api/client-portal${staff ? '/admin' : ''}`, timeout: 20000 });
  client.interceptors.request.use((config) => {
    const token = staff ? localStorage.getItem('token') : portalToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
  client.interceptors.response.use((response) => response, (error) => {
    if (!staff && error.response?.status === 401 && !error.config?.url?.startsWith('/auth/')) {
      setPortalToken(null); window.dispatchEvent(new Event('client_portal_auth_expired'));
    }
    return Promise.reject(error);
  });
  if (staff) installBrowserSession(client);
  return client;
}
export const portalError = (error) => error.response?.data?.error || (error.code === 'ECONNABORTED' ? 'The request timed out. Your draft is still here; try again.' : 'The service could not be reached. Please try again.');
export const submissionKey = () => window.crypto?.randomUUID?.() || `portal_${Date.now()}_${Math.random().toString(36).slice(2)}`;
export function portalDate(value, includeTime = false) {
  if (!value) return 'Not provided';
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:/.test(String(value)) ? `${value.replace(' ', 'T')}Z` : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return 'Not provided';
  return includeTime ? date.toLocaleString('en-IN') : date.toLocaleDateString('en-IN', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
}
export function portalMoney(value) { return value == null ? 'Amount not provided' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value); }
