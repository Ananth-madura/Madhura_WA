import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../config/axios";
import {
  getMyBranches,
  getBranch,
  getEffectivePermissions,
  getBranchSenders,
  getBranchMembers,
} from "../api/branches";

const BranchContext = createContext(null);

export function BranchProvider({ children }) {
  const navigate = useNavigate();
  const { branchId: paramBranchId } = useParams();

  const [activeBranch, setActiveBranch] = useState(null);
  const [accessibleBranches, setAccessibleBranches] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [userRole, setUserRole] = useState(null);
  const [senders, setSenders] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load accessible branches for current tenant/user
  const refreshAccessibleBranches = useCallback(async () => {
    try {
      const data = await getMyBranches();
      if (data?.success) {
        setAccessibleBranches(data.branches || []);
        return data.branches || [];
      }
    } catch (err) {
      console.warn("[BranchContext] Failed to load branches list:", err?.message);
    }
    return [];
  }, []);

  // Load specific branch details, permissions, senders, and members
  const loadBranchDetails = useCallback(
    async (branchId) => {
      if (!branchId) return;
      setLoading(true);
      setError(null);

      try {
        // Set Axios default header and localStorage for enterprise requests
        localStorage.setItem("active_branch_id", branchId);
        api.defaults.headers.common["x-branch-id"] = branchId;

        const [branchRes, permRes, sendersRes, membersRes] = await Promise.allSettled([
          getBranch(branchId),
          getEffectivePermissions(branchId),
          getBranchSenders(branchId),
          getBranchMembers(branchId),
        ]);

        if (branchRes.status === "fulfilled" && branchRes.value?.success) {
          setActiveBranch(branchRes.value.branch);
        } else {
          const errStatus = branchRes.reason?.response?.status;
          const errMsg =
            branchRes.reason?.response?.data?.message ||
            (errStatus === 403 ? "You do not have access to this branch." : "Branch not found.");
          setError({ status: errStatus || 404, message: errMsg });
          setActiveBranch(null);
          setLoading(false);
          return;
        }

        if (permRes.status === "fulfilled" && permRes.value?.success) {
          setPermissions(permRes.value.permissions || []);
          setUserRole(permRes.value.role || "member");
        } else {
          setPermissions([]);
        }

        if (sendersRes.status === "fulfilled" && sendersRes.value?.success) {
          setSenders(sendersRes.value.senders || []);
        } else {
          setSenders([]);
        }

        if (membersRes.status === "fulfilled" && membersRes.value?.success) {
          setMembers(membersRes.value.members || []);
        } else {
          setMembers([]);
        }
      } catch (err) {
        setError({
          status: err?.response?.status || 500,
          message: err?.response?.data?.message || err?.message || "Failed to load branch workspace",
        });
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Switch branch seamlessly: updates state, storage, and navigates
  const switchBranch = useCallback(
    async (targetBranchId, targetSlug, subPath = "dashboard") => {
      if (!targetBranchId) return;

      // Invalidate old active branch caches & local tokens
      localStorage.setItem("active_branch_id", targetBranchId);
      api.defaults.headers.common["x-branch-id"] = targetBranchId;

      // Realtime event trigger to reload any socket rooms
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("wa_branch_switched", {
            detail: { branchId: targetBranchId },
          })
        );
      }

      await loadBranchDetails(targetBranchId);

      const branchObj = accessibleBranches.find((b) => b.id === Number(targetBranchId));
      const slug = targetSlug || branchObj?.slug || "workspace";
      navigate(`/whatsapp/branches/${targetBranchId}/${slug}/${subPath}`);
    },
    [accessibleBranches, loadBranchDetails, navigate]
  );

  // Helper permission gate
  const can = useCallback(
    (permissionKey) => {
      if (userRole === "organization_owner" || userRole === "organization_admin") return true;
      if (permissions.includes("*")) return true;
      return permissions.includes(permissionKey);
    },
    [permissions, userRole]
  );

  // Initial mount or route change sync
  useEffect(() => {
    let isMounted = true;

    async function init() {
      const branches = await refreshAccessibleBranches();
      if (!isMounted) return;

      const targetId = paramBranchId || localStorage.getItem("active_branch_id") || branches[0]?.id;
      if (targetId) {
        await loadBranchDetails(targetId);
      } else {
        setLoading(false);
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, [paramBranchId, refreshAccessibleBranches, loadBranchDetails]);

  const value = {
    activeBranch,
    accessibleBranches,
    permissions,
    userRole,
    senders,
    members,
    loading,
    error,
    can,
    switchBranch,
    refreshBranch: () => activeBranch?.id && loadBranchDetails(activeBranch.id),
    refreshAccessibleBranches,
  };

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}

export function useBranch() {
  const ctx = useContext(BranchContext);
  if (!ctx) {
    throw new Error("useBranch must be used within a BranchProvider");
  }
  return ctx;
}
