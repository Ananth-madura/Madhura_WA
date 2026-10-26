import api from "../config/axios";

/**
 * Enquiries (lead triage) API client
 * Wraps /api/wa/enquiries — tenant-scoped leads with a cold/warm/hot
 * temperature and a Convert-to-Client action.
 */

// Mirrors backend/services/enquiryService.js ENQUIRY_TYPES. `source` stays
// provenance (manual / whatsapp_chat); this describes what the enquiry is about.
export const ENQUIRY_TYPES = [
  { value: "general", label: "General enquiry" },
  { value: "product", label: "Product / service" },
  { value: "pricing", label: "Pricing / quote" },
  { value: "support", label: "Support" },
  { value: "appointment", label: "Appointment" },
  { value: "partnership", label: "Partnership" },
];

export const enquiryTypeLabel = (value) => {
  const match = ENQUIRY_TYPES.find((type) => type.value === String(value || "").toLowerCase());
  return match ? match.label : "General enquiry";
};

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
