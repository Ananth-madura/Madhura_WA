import api from "../config/axios";

/**
 * Enquiries (lead triage) API client
 * Wraps /api/wa/enquiries — tenant-scoped leads with a cold/warm/hot
 * temperature and a Convert-to-Client action.
 */

export const getEnquiries = async (params = {}) => {
  const res = await api.get("/api/wa/enquiries", { params });
  return res.data;
};

export const getEnquirySummary = async () => {
  const res = await api.get("/api/wa/enquiries/summary");
  return res.data;
};

export const getEnquiry = async (id) => {
  const res = await api.get(`/api/wa/enquiries/${id}`);
  return res.data;
};

export const createEnquiry = async (data) => {
  const res = await api.post("/api/wa/enquiries", data);
  return res.data;
};

export const updateEnquiry = async (id, data) => {
  const res = await api.put(`/api/wa/enquiries/${id}`, data);
  return res.data;
};

export const deleteEnquiry = async (id) => {
  const res = await api.delete(`/api/wa/enquiries/${id}`);
  return res.data;
};

/**
 * Converts an enquiry into a CRM client. Returns
 * `{ enquiry, client, deduped }` — `deduped: true` means an existing client
 * with the same phone/email was linked instead of a duplicate being created.
 */
export const convertEnquiry = async (id) => {
  const res = await api.post(`/api/wa/enquiries/${id}/convert`);
  return res.data;
};
