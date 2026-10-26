import { useEffect, useMemo, useState } from "react";
import api from "../config/axios";
import { useAuth } from "../auth/AuthContext";
import { useEnterprise } from "../context/EnterpriseContext";
import { isWorkspaceAdmin, isWorkspaceSubadmin } from "../auth/workspaceAccess";

/**
 * Resolves what the signed-in person may do inside the shared workspace.
 *
 * Administrators short-circuit to full access. Members ask the backend for
 * their own resolved grants (`GET /api/v2/workspace/me/permissions`) so the
 * rail and the route guard agree with the server instead of guessing.
 */
export default function useWorkspaceAccess() {
  const { user, demoMode } = useAuth();
  const { isOwnerOrAdmin, roleInActiveOrg, actorRole, activeTenant } = useEnterprise();
  const admin = isWorkspaceAdmin({
    demoMode,
    isOwnerOrAdmin,
    orgRole: roleInActiveOrg,
    globalRole: user?.role,
  });
  const subadmin = isWorkspaceSubadmin({ actorRole, globalRole: user?.role });
  const tenantId = activeTenant?.id ?? null;
  const [permissions, setPermissions] = useState(null);
  const [ready, setReady] = useState(admin);

  useEffect(() => {
    let active = true;
    if (admin) {
      setPermissions(null);
      setReady(true);
      return () => { active = false; };
    }
    setReady(false);
    api
      .get("/api/v2/workspace/me/permissions")
      .then(({ data }) => { if (active) setPermissions(data.permissions || {}); })
      .catch(() => { if (active) setPermissions({}); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [admin, tenantId]);

  return useMemo(() => {
    const grant = module => permissions?.[module] || { view: true, edit: false };
    return {
      admin,
      subadmin,
      ready,
      permissions,
      canView: module => admin || (ready && grant(module).view),
      canEdit: module => admin || (ready && Boolean(permissions?.[module]?.edit)),
    };
  }, [admin, subadmin, permissions, ready]);
}
