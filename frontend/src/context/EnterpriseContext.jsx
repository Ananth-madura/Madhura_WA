/**
 * EnterpriseContext.jsx
 *
 * Enterprise multi-tenant & multi-branch global state provider.
 * Manages active organization, active branch, permitted branches, and Axios request headers.
 * Reference: MADHURA_WHATSAPP_ENTERPRISE_SAAS_MASTER_BLUEPRINT.md
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { API } from "../config/api";
import { hasCookieSession } from "../auth/browserSession";
import { useAuth } from "../auth/AuthContext";

const EnterpriseContext = createContext(null);

export function EnterpriseProvider({ children }) {
  const { user, initializing } = useAuth();
  const version = useRef(0);
  const [activeTenant, setActiveTenant] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [activeBranch, setActiveBranch] = useState(null);
  const [branches, setBranches] = useState([]);
  const [permittedBranchIds, setPermittedBranchIds] = useState([]);
  const [roleInActiveOrg, setRoleInActiveOrg] = useState(null);
  // Exact account role (`admin` / `subadmin` / `employee`), read server-side
  // from the users table. `roleInActiveOrg` cannot distinguish a delegated
  // sub-admin from a full administrator.
  const [actorRole, setActorRole] = useState(null);
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
    const current=++version.current;
    if(initializing)return;
    const token = localStorage.getItem("token");
    if (!user || (!token && !hasCookieSession())) {
      setActiveTenant(null);setOrganizations([]);setActiveBranch(null);setBranches([]);setPermittedBranchIds([]);setRoleInActiveOrg(null);setActorRole(null);
      setLoading(false);
      return;
    }

    try {
      const headers = getHeaders();
      const res = await axios.get(`${API}/api/v2/me`, { headers, timeout: 15000 });
      if(current!==version.current)return;

      if (res?.data?.success) {
        const {
          activeOrganization,
          organizations: orgs,
          activeBranch: branch,
          branches: branchList,
          permittedBranchIds: permBranches,
          roleInActiveOrg: role,
          actorRole: resolvedActorRole,
        } = res.data;

        setOrganizations(orgs || []);
        setActiveTenant(activeOrganization || (orgs && orgs[0]) || null);
        setBranches(branchList || []);
        setActiveBranch(branch || null);
        setPermittedBranchIds(permBranches || []);
        setRoleInActiveOrg(role || "agent");
        setActorRole(resolvedActorRole || null);

        if (activeOrganization?.id) {
          localStorage.setItem("active_tenant_id", activeOrganization.id);
        }
        if (branch?.id) {
          localStorage.setItem("active_branch_id", branch.id);
        } else localStorage.removeItem("active_branch_id");
      }
    } catch (err) {
      console.warn("[EnterpriseContext] Notice fetching /api/v2/me:", err?.message);
    } finally {
      if(current===version.current)setLoading(false);
    }
  }, [getHeaders, initializing, user]);

  useEffect(() => {
    const requests=version;
    refreshEnterpriseContext();
    return()=>{requests.current++;};
  }, [refreshEnterpriseContext]);

  const switchOrganization = useCallback(
    async (tenantId) => {
      const targetOrg = organizations.find((o) => o.id === Number(tenantId));
      if (!targetOrg) return;

      localStorage.setItem("active_tenant_id", targetOrg.id);
      localStorage.removeItem("active_branch_id"); // Reset branch when switching company

      setActiveTenant(targetOrg);
      setActiveBranch(null);setBranches([]);setPermittedBranchIds([]);setRoleInActiveOrg("agent");
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
        actorRole,
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
      activeTenant: null,
      organizations: [],
      activeBranch: null,
      branches: [],
      permittedBranchIds: [],
      roleInActiveOrg: "agent",
      actorRole: null,
      isOwnerOrAdmin: false,
      isBranchManager: false,
      loading: false,
      switchOrganization: () => {},
      switchBranch: () => {},
      refreshEnterpriseContext: () => {},
    };
  }
  return ctx;
}
