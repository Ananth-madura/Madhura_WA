import axios from "axios";
import { API } from "../config/api";

function authHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function unwrap(res) {
  if (typeof res?.data === "string" && /^\s*<!doctype|^\s*<html/i.test(res.data)) {
    throw new Error("Orchestration API returned HTML instead of JSON. Restart the backend server so the new engine routes are active.");
  }
  return res?.data;
}

const get = (path, params) => axios.get(`${API}${path}`, { headers: authHeaders(), params }).then(unwrap);
const post = (path, data = {}) => axios.post(`${API}${path}`, data, { headers: authHeaders() }).then(unwrap);

export const flowbotEngineApi = {
  getDashboard: () => get("/api/flowbot-engine/dashboard"),
  listSessions: (params) => get("/api/flowbot-engine/sessions", params),
  getSessionTrace: (id) => get(`/api/flowbot-engine/sessions/${id}/trace`),
  resumeHandover: (id, payload = {}) => post(`/api/flowbot-engine/sessions/${id}/resume-handover`, payload),
  listVersions: (flowId) => get(`/api/flowbot-engine/flows/${flowId}/versions`),
  publishVersion: (flowId, payload = {}) => post(`/api/flowbot-engine/flows/${flowId}/publish`, payload),
  rollbackVersion: (flowId, version_number) => post(`/api/flowbot-engine/flows/${flowId}/rollback`, { version_number }),
  simulate: (flowId, payload) => post(`/api/flowbot-engine/flows/${flowId}/simulate`, payload),
  listTriggers: () => get("/api/flowbot-engine/triggers"),
  createTrigger: (payload) => post("/api/flowbot-engine/triggers", payload),
  getServiceWindow: (phone) => get(`/api/flowbot-engine/service-window/${encodeURIComponent(phone)}`),
  listKnowledge: () => get("/api/flowbot-engine/knowledge-base"),
  createKnowledge: (payload) => post("/api/flowbot-engine/knowledge-base", payload),
  resumeDueWorker: () => post("/api/flowbot-engine/worker/resume-due"),
};

export const automationEngineApi = {
  getDashboard: () => get("/api/automation-engine/dashboard"),
  listWorkflows: (params) => get("/api/automation-engine/workflows", params),
  createWorkflow: (payload) => post("/api/automation-engine/workflows", payload),
  getWorkflow: (id) => get(`/api/automation-engine/workflows/${id}`),
  publishWorkflow: (id, payload = {}) => post(`/api/automation-engine/workflows/${id}/publish`, payload),
  executeWorkflow: (id, payload = {}) => post(`/api/automation-engine/workflows/${id}/execute`, payload),
  emitEvent: (payload) => post("/api/automation-engine/events", payload),
  listRuns: (params) => get("/api/automation-engine/runs", params),
  getRunInspector: (id) => get(`/api/automation-engine/runs/${id}/inspector`),
  cancelRun: (id, reason) => post(`/api/automation-engine/runs/${id}/cancel`, { reason }),
  listApprovals: () => get("/api/automation-engine/approvals"),
  decideApproval: (id, decision, reason = "") => post(`/api/automation-engine/approvals/${id}/decide`, { decision, reason }),
  listDeadLetters: () => get("/api/automation-engine/dead-letters"),
  replayDeadLetter: (id) => post(`/api/automation-engine/dead-letters/${id}/replay`),
  listCredentials: () => get("/api/automation-engine/credentials"),
  saveCredential: (payload) => post("/api/automation-engine/credentials", payload),
  processDueWorker: () => post("/api/automation-engine/worker/process-due"),
};
