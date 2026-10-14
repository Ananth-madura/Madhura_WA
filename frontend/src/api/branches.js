import api from "../config/axios";

/**
 * Enterprise Multi-Branch API Client
 * Wraps all /api/v2/branches REST endpoints under strict tenant and branch isolation.
 */

export const getBranches = async (params = {}) => {
  const res = await api.get("/api/v2/branches", { params });
  return res.data;
};

export const getMyBranches = async () => {
  const res = await api.get("/api/v2/me/branches");
  return res.data;
};

export const getEffectivePermissions = async (branchId) => {
  const res = await api.get("/api/v2/me/permissions", {
    params: branchId ? { branchId } : {},
    headers: branchId ? { "x-branch-id": branchId } : {},
  });
  return res.data;
};

export const getBranch = async (branchId) => {
  const res = await api.get(`/api/v2/branches/${branchId}`, {
    headers: { "x-branch-id": branchId },
  });
  return res.data;
};

export const createBranch = async (branchData) => {
  const res = await api.post("/api/v2/branches", branchData);
  return res.data;
};

export const updateBranch = async (branchId, updateData) => {
  const res = await api.patch(`/api/v2/branches/${branchId}`, updateData, {
    headers: { "x-branch-id": branchId },
  });
  return res.data;
};

export const archiveBranch = async (branchId) => {
  const res = await api.post(`/api/v2/branches/${branchId}/archive`, {}, {
    headers: { "x-branch-id": branchId },
  });
  return res.data;
};

export const restoreBranch = async (branchId) => {
  const res = await api.post(`/api/v2/branches/${branchId}/restore`, {}, {
    headers: { "x-branch-id": branchId },
  });
  return res.data;
};

export const getBranchMembers = async (branchId) => {
  const res = await api.get(`/api/v2/branches/${branchId}/members`, {
    headers: { "x-branch-id": branchId },
  });
  return res.data;
};

export const addBranchMember = async (branchId, memberData) => {
  const res = await api.post(`/api/v2/branches/${branchId}/members`, memberData, {
    headers: { "x-branch-id": branchId },
  });
  return res.data;
};

export const removeBranchMember = async (branchId, userId) => {
  const res = await api.delete(`/api/v2/branches/${branchId}/members/${userId}`, {
    headers: { "x-branch-id": branchId },
  });
  return res.data;
};

export const transferBranchManager = async (branchId, newManagerUserId) => {
  const res = await api.post(
    `/api/v2/branches/${branchId}/manager`,
    { newManagerUserId },
    { headers: { "x-branch-id": branchId } }
  );
  return res.data;
};

export const getBranchSenders = async (branchId) => {
  const res = await api.get(`/api/v2/branches/${branchId}/senders`, {
    headers: { "x-branch-id": branchId },
  });
  return res.data;
};

export const assignBranchSender = async (branchId, senderData) => {
  const res = await api.post(`/api/v2/branches/${branchId}/senders`, senderData, {
    headers: { "x-branch-id": branchId },
  });
  return res.data;
};

export const unassignBranchSender = async (branchId, senderId) => {
  const res = await api.delete(`/api/v2/branches/${branchId}/senders/${senderId}`, {
    headers: { "x-branch-id": branchId },
  });
  return res.data;
};

export const getBranchConversations = async (branchId, params = {}) => {
  const res = await api.get(`/api/v2/branches/${branchId}/conversations`, {
    params,
    headers: { "x-branch-id": branchId },
  });
  return res.data;
};

export const transferConversation = async (branchId, conversationId, data) => {
  const res = await api.post(
    `/api/v2/branches/${branchId}/conversations/${conversationId}/transfer`,
    data,
    { headers: { "x-branch-id": branchId } }
  );
  return res.data;
};

export const getBranchAnalytics = async (branchId, params = {}) => {
  const res = await api.get(`/api/v2/branches/${branchId}/analytics`, {
    params,
    headers: { "x-branch-id": branchId },
  });
  return res.data;
};

export const getBranchSettings = async (branchId) => {
  const res = await api.get(`/api/v2/branches/${branchId}/settings`, {
    headers: { "x-branch-id": branchId },
  });
  return res.data;
};

export const updateBranchSettings = async (branchId, settingsData) => {
  const res = await api.patch(`/api/v2/branches/${branchId}/settings`, settingsData, {
    headers: { "x-branch-id": branchId },
  });
  return res.data;
};

export const getBranchContacts = async (branchId, params = {}) => {
  const res = await api.get(`/api/v2/branches/${branchId}/contacts`, {
    params,
    headers: { "x-branch-id": branchId },
  });
  return res.data;
};

export const createBranchContact = async (branchId, contactData) => {
  const res = await api.post(`/api/v2/branches/${branchId}/contacts`, contactData, {
    headers: { "x-branch-id": branchId },
  });
  return res.data;
};

export const transferBranchContact = async (branchId, contactId, data) => {
  const res = await api.post(`/api/v2/branches/${branchId}/contacts/${contactId}/transfer`, data, {
    headers: { "x-branch-id": branchId },
  });
  return res.data;
};

export const createBranchEmployee = async (branchId, employeeData) => {
  const res = await api.post(`/api/v2/branches/${branchId}/employees`, employeeData, {
    headers: { "x-branch-id": branchId },
  });
  return res.data;
};

