import React from "react";
import { ShieldAlert } from "lucide-react";
import { useBranch } from "../../context/BranchContext";

/**
 * BranchPermissionGate
 * Conditionally renders children if active user has the specified permission.
 * Otherwise shows an optional fallback or a clean, non-intrusive permission notice.
 */
export default function BranchPermissionGate({
  permission,
  children,
  fallback = null,
  showNotice = false,
  noticeTitle = "Access Restricted",
  noticeMessage = "You do not have the required branch permissions to view or perform this action.",
}) {
  const { can, loading } = useBranch();

  if (loading) return null;

  const isAllowed = can(permission);

  if (isAllowed) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (showNotice) {
    return (
      <div className="p-6 my-4 rounded-xl border border-amber-500/30 bg-amber-950/20 text-amber-200 flex items-start gap-4">
        <ShieldAlert size={22} className="text-amber-400 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-semibold text-sm text-amber-300">{noticeTitle}</h4>
          <p className="text-xs text-amber-400/80 mt-1">{noticeMessage}</p>
          <div className="mt-2 text-[11px] font-mono text-amber-400/60 bg-amber-900/30 px-2 py-0.5 rounded inline-block">
            Required capability: {permission}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
