/**
 * EnterpriseContext.jsx
 *
 * Enterprise multi-tenant & multi-branch global state provider.
 * Manages active organization, active branch, permitted branches, and Axios request headers.
 * Reference: MADHURA_WHATSAPP_ENTERPRISE_SAAS_MASTER_BLUEPRINT.md
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import axios from "axios";
import { API } from "../config/api";

const EnterpriseContext = createContext(null);

export function EnterpriseProvider({ children }) {
  const [activeTenant, setActiveTenant] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [activeBranch, setActiveBranch] = useState(null);
  const [branches, setBranches] = useState([]);
  const [permittedBranchIds, setPermittedBranchIds] = useState([]);
  const [roleInActiveOrg, setRoleInActiveOrg] = useState("agent");
  const [loading, setLoading] = useState(true);

  const getHeaders = useCallback(() => {
    const token = localStorage.getItem("token");
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const savedTenantId = localStorage.getItem("active_tenant_id");
    const savedBranchId = localStorage.getItem("active_branch_id");
    if (savedTenantId) headers["x-tenant-id"] = savedTenantId;
    if (savedBranchId) headers["x-branch-id"] = savedBranchId;
    return headers;
  }, []);

  const refreshEnterpriseContext = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const headers = getHeaders();
      const res = await axios.get(`${API}/api/v2/me`, { headers, timeout: 8000 }).catch(async () => {
        return axios.get(`/api/v2/me`, { headers, timeout: 8000 });
      });

      if (res?.data?.success) {
        const {
          activeOrganization,
          organizations: orgs,
          activeBranch: branch,
          branches: branchList,
          permittedBranchIds: permBranches,
          roleInActiveOrg: role,
        } = res.data;

        setOrganizations(orgs || []);
        setActiveTenant(activeOrganization || (orgs && orgs[0]) || null);
        setBranches(branchList || []);
        setActiveBranch(branch || (branchList && branchList[0]) || null);
        setPermittedBranchIds(permBranches || []);
        setRoleInActiveOrg(role || "agent");

        if (activeOrganization?.id) {
          localStorage.setItem("active_tenant_id", activeOrganization.id);
          axios.defaults.headers.common["x-tenant-id"] = activeOrganization.id;
        }
        if (branch?.id) {
          localStorage.setItem("active_branch_id", branch.id);
          axios.defaults.headers.common["x-branch-id"] = branch.id;
        }
      }
    } catch (err) {
      console.warn("[EnterpriseContext] Notice fetching /api/v2/me:", err?.message);
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    refreshEnterpriseContext();
  }, [refreshEnterpriseContext]);

  const switchOrganization = useCallback(
    async (tenantId) => {
      const targetOrg = organizations.find((o) => o.id === Number(tenantId));
      if (!targetOrg) return;

      localStorage.setItem("active_tenant_id", targetOrg.id);
      localStorage.removeItem("active_branch_id"); // Reset branch when switching company
      axios.defaults.headers.common["x-tenant-id"] = targetOrg.id;
      delete axios.defaults.headers.common["x-branch-id"];

      setActiveTenant(targetOrg);
      setLoading(true);
      await refreshEnterpriseContext();
    },
    [organizations, refreshEnterpriseContext]
  );

  const switchBranch = useCallback(
    (branchId) => {
      const targetBranch = branches.find((b) => b.id === Number(branchId));
      if (!targetBranch) return;

      localStorage.setItem("active_branch_id", targetBranch.id);
      axios.defaults.headers.common["x-branch-id"] = targetBranch.id;
      setActiveBranch(targetBranch);
      window.dispatchEvent(new CustomEvent("branch_changed", { detail: { branch: targetBranch } }));
    },
    [branches]
  );

  const isOwnerOrAdmin =
    roleInActiveOrg === "organization_owner" ||
    roleInActiveOrg === "organization_admin";

  const isBranchManager =
    isOwnerOrAdmin || roleInActiveOrg === "branch_manager";

  return (
    <EnterpriseContext.Provider
      value={{
        activeTenant,
        organizations,
        activeBranch,
        branches,
        permittedBranchIds,
        roleInActiveOrg,
        isOwnerOrAdmin,
        isBranchManager,
        loading,
        switchOrganization,
        switchBranch,
        refreshEnterpriseContext,
        getHeaders,
        enterpriseHeaders: getHeaders(),
      }}
    >
      {children}
    </EnterpriseContext.Provider>
  );
}

export function useEnterprise() {
  const ctx = useContext(EnterpriseContext);
  if (!ctx) {
    return {
      activeTenant: { id: 1, name: "Madhura Primary Organization", plan: "growth" },
      organizations: [],
      activeBranch: { id: 1, name: "Head Office (Main)", code: "HEADOFFICE" },
      branches: [],
      permittedBranchIds: [1],
      roleInActiveOrg: "organization_owner",
      isOwnerOrAdmin: true,
      isBranchManager: true,
      loading: false,
      switchOrganization: () => {},
      switchBranch: () => {},
      refreshEnterpriseContext: () => {},
    };
  }
  return ctx;
}
