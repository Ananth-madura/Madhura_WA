import api from "../config/axios";

function unwrapJson(res) {
  const data = res?.data;
  if (typeof data === "string" && /^\s*<!doctype|^\s*<html/i.test(data)) {
    throw new Error("Campaign backend API returned HTML instead of JSON. Please restart the backend server so the new /api/campaigns routes are loaded.");
  }
  return data;
}

const get = (url, cfg) => api.get(url, cfg).then(unwrapJson);
const post = (url, body, cfg) => api.post(url, body, cfg).then(unwrapJson);
const patch = (url, body, cfg) => api.patch(url, body, cfg).then(unwrapJson);
const put = (url, body, cfg) => api.put(url, body, cfg).then(unwrapJson);
const del = (url, cfg) => api.delete(url, cfg).then(unwrapJson);

export const campaignApi = {
  // Dashboard, Universal Native Assets & Campaigns
  getEcosystemSummary: () => get("/api/campaigns/ecosystem-summary"),
  getNativeAssets: () => get("/api/campaigns/native-assets"),
  getGroupEligibility: (groupId, category = "MARKETING") => get(`/api/wa/groups/${groupId}/eligibility`, { params: { category } }),
  getOverview: (params = {}) => get("/api/campaigns/analytics/overview", { params }),
  listCampaigns: (params = {}) => get("/api/campaigns", { params }),
  getCampaign: (id) => get(`/api/campaigns/${id}`),
  createCampaign: (payload) => post("/api/campaigns", payload),
  updateCampaign: (id, payload) => patch(`/api/campaigns/${id}`, payload),
  deleteCampaign: (id) => del(`/api/campaigns/${id}`),
  duplicateCampaign: (id) => post(`/api/campaigns/${id}/duplicate`),
  validateCampaign: (id) => post(`/api/campaigns/${id}/validate`),
  previewCampaign: (id) => post(`/api/campaigns/${id}/preview`),
  testSendCampaign: (id, payload) => post(`/api/campaigns/${id}/test-send`, payload),

  // Lifecycle & Execution
  submitApproval: (id, payload = {}) => post(`/api/campaigns/${id}/submit-approval`, payload),
  approveCampaign: (id, reason = "") => post(`/api/campaigns/${id}/approve`, { reason }),
  rejectCampaign: (id, reason = "") => post(`/api/campaigns/${id}/reject`, { reason }),
  requestChanges: (id, reason = "") => post(`/api/campaigns/${id}/request-changes`, { reason }),
  scheduleCampaign: (id, payload) => post(`/api/campaigns/${id}/schedule`, payload),
  launchCampaign: (id, payload = {}) => post(`/api/campaigns/${id}/launch`, payload),
  dispatchBatch: (id, limit = 100) => post(`/api/campaigns/${id}/dispatch-batch`, { limit }),
  pauseCampaign: (id, reason = "") => post(`/api/campaigns/${id}/pause`, { reason }),
  resumeCampaign: (id, payload = {}) => post(`/api/campaigns/${id}/resume`, payload),
  cancelCampaign: (id, reason = "") => post(`/api/campaigns/${id}/cancel`, { reason }),
  retryFailed: (id) => post(`/api/campaigns/${id}/retry-failed`),
  getRecipients: (id, params = {}) => get(`/api/campaigns/${id}/recipients`, { params }),
  getExclusions: (id) => get(`/api/campaigns/${id}/exclusions`),
  getExecution: (id) => get(`/api/campaigns/${id}/execution`),

  // Audiences & Imports
  getPresets: () => get("/api/campaigns/audiences/presets"),
  listSegments: (params = {}) => get("/api/campaigns/audiences", { params }),
  createSegment: (payload) => post("/api/campaigns/audiences", payload),
  updateSegment: (id, payload) => patch(`/api/campaigns/audiences/${id}`, payload),
  estimateSegment: (id, payload = {}) => post(`/api/campaigns/audiences/${id}/estimate`, payload),
  estimateLive: (payload) => post("/api/campaigns/audiences/estimate-live", payload),
  importAudience: (payload) => post("/api/campaigns/audiences/import", payload),
  listImports: () => get("/api/campaigns/audiences/imports"),
  getImportReport: (id) => get(`/api/campaigns/audiences/import/${id}`),

  // Consent & Suppression
  listConsents: (params = {}) => get("/api/campaigns/consent", { params }),
  recordConsent: (payload) => post("/api/campaigns/consent", payload),
  revokeConsent: (payload) => post("/api/campaigns/consent/revoke", payload),
  checkConsent: (payload) => post("/api/campaigns/consent/check", payload),
  listSuppressions: (params = {}) => get("/api/campaigns/suppressions", { params }),
  addSuppression: (payload) => post("/api/campaigns/suppressions", payload),
  removeSuppression: (id) => del(`/api/campaigns/suppressions/${id}`),

  // Provider Gateway & Senders
  getProviderStatus: () => get("/api/provider/whatsapp/status"),
  getMarketingStatus: (params = {}) => get("/api/provider/whatsapp/marketing-status", { params }),

  // Templates
  listTemplates: (params = {}) => get("/api/whatsapp/templates", { params }),
  createTemplate: (payload) => post("/api/whatsapp/templates", payload),
  syncTemplates: (payload) => post("/api/whatsapp/templates/sync", payload),
  submitTemplate: (id, payload) => post(`/api/whatsapp/templates/${id}/submit`, payload),
  getTemplateStatus: (id) => get(`/api/whatsapp/templates/${id}/status`),

  // WhatsApp Flows (Meta in-app forms)
  listFlows: (params = {}) => get("/api/whatsapp/flows", { params }),
  getFlow: (id) => get(`/api/whatsapp/flows/${id}`),
  createFlow: (payload) => post("/api/whatsapp/flows", payload),
  updateFlow: (id, payload) => patch(`/api/whatsapp/flows/${id}`, payload),
  validateFlow: (id) => post(`/api/whatsapp/flows/${id}/validate`),
  publishFlow: (id, payload = {}) => post(`/api/whatsapp/flows/${id}/publish`, payload),
  deprecateFlow: (id) => post(`/api/whatsapp/flows/${id}/deprecate`),
  cloneFlow: (id, payload = {}) => post(`/api/whatsapp/flows/${id}/clone`, payload),
  listFlowEndpoints: () => get("/api/whatsapp/flows/endpoints"),
  provisionFlowEndpoint: (payload) => post("/api/whatsapp/flows/endpoints/provision", payload),
  listFlowSubmissions: (id) => get(`/api/whatsapp/flows/${id}/submissions`),

  // Flowbots & Campaign Automations
  listFlowbots: () => get("/api/flowbots"),
  attachFlowbot: (flowbotId, payload) => post(`/api/flowbots/${flowbotId}/attach-to-campaign`, payload),
  listCampaignAutomations: (campaignId) => get(`/api/campaigns/${campaignId}/automation`),
  createCampaignAutomation: (campaignId, payload) => post(`/api/campaigns/${campaignId}/automation`, payload),

  // Calendar, Approvals, Analytics, Attribution, Reports, Settings & Ops
  getCalendar: (params = {}) => get("/api/campaigns/calendar", { params }),
  listApprovals: (status = "PENDING") => get("/api/campaigns/approvals", { params: { status } }),
  createApprovalRule: (payload) => post("/api/campaigns/approvals/rules", payload),
  getCampaignAnalytics: (id) => get(`/api/campaigns/${id}/analytics`),
  getAttribution: (id) => get(`/api/campaigns/${id}/attribution`),
  recordConversion: (payload) => post("/api/campaigns/conversions", payload),
  getExperiments: (id) => get(`/api/campaigns/${id}/experiments`),
  createExperiment: (id, payload) => post(`/api/campaigns/${id}/experiments`, payload),
  listReports: () => get("/api/campaigns/reports"),
  createReport: (payload) => post("/api/campaigns/reports", payload),
  getSettings: () => get("/api/campaigns/settings"),
  saveSettings: (payload) => put("/api/campaigns/settings", payload),
  listAgencyClients: () => get("/api/campaigns/agency/clients"),
  linkAgencyClient: (payload) => post("/api/campaigns/agency/clients", payload),
  listAuditLogs: (params = {}) => get("/api/campaigns/audit", { params }),
  getAdminOverview: () => get("/api/admin/campaigns/overview"),
  setDispatchControl: (payload) => post("/api/admin/campaigns/dispatch-controls", payload),
  adminPauseCampaign: (id, payload = {}) => post(`/api/admin/campaigns/${id}/pause`, payload),
  adminRetryFailed: (id, payload = {}) => post(`/api/admin/campaigns/${id}/retry-failed`, payload),
};

export function formatMinorCurrency(minor, currency = "INR") {
  const value = Number(minor || 0) / 100;
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}
