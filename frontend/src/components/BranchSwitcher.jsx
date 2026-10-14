/**
 * BranchSwitcher.jsx
 *
 * Header component allowing instant switching between branches within the active organization.
 * Reference: MADHURA_WHATSAPP_ENTERPRISE_SAAS_MASTER_BLUEPRINT.md
 */

import React, { useState, useRef, useEffect } from "react";
import { GitBranch, ChevronDown, Check, Settings, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEnterprise } from "../context/EnterpriseContext";

export default function BranchSwitcher() {
  const { activeBranch, branches, permittedBranchIds, switchBranch, isBranchManager } = useEnterprise();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!activeBranch) return null;

  const accessibleBranches = branches.filter((b) =>
    permittedBranchIds.length === 0 || permittedBranchIds.includes(b.id)
  );

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="hl-btn-secondary shrink-0 flex items-center gap-2 px-2.5 sm:px-3 text-xs font-medium border border-emerald-700/60 bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-100 rounded-md transition-all shadow-sm"
        style={{ height: 36 }}
        title="Switch Branch Queue"
      >
        <GitBranch size={14} className="text-emerald-400 shrink-0" />
        <span className="max-w-[110px] sm:max-w-[150px] truncate text-left font-semibold">
          {activeBranch.name}
        </span>
        <span className="hidden lg:inline-flex px-1.5 py-0.2 text-[9px] font-mono font-bold rounded bg-emerald-800/60 text-emerald-300">
          {activeBranch.code}
        </span>
        <ChevronDown size={13} className={`text-emerald-400/80 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 mt-1.5 w-64 origin-top-left rounded-lg bg-slate-900 border border-slate-700/80 shadow-2xl z-50 py-1.5 animate-in fade-in-50 zoom-in-95">
          <div className="px-3 py-1.5 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Branch Queues</span>
            <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-emerald-400 font-mono">
              {accessibleBranches.length} branches
            </span>
          </div>

          <div className="max-h-60 overflow-y-auto py-1">
            {accessibleBranches.map((branch) => {
              const isSelected = branch.id === activeBranch.id;
              return (
                <button
                  key={branch.id}
                  onClick={() => {
                    switchBranch(branch.id);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors ${
                    isSelected
                      ? "bg-emerald-500/15 text-emerald-300 font-medium"
                      : "text-slate-200 hover:bg-slate-800/80"
                  }`}
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="truncate font-semibold flex items-center gap-1.5">
                      {branch.name}
                      {branch.is_head_office === 1 && (
                        <Star size={11} className="text-amber-400 fill-amber-400 shrink-0" title="Head Office" />
                      )}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                      Code: {branch.code} {branch.staff_count ? `· ${branch.staff_count} staff` : ""}
                    </span>
                  </div>
                  {isSelected && <Check size={14} className="text-emerald-400 shrink-0" />}
                </button>
              );
            })}
          </div>

          {isBranchManager && (
            <div className="border-t border-slate-800 pt-1 mt-1 px-1">
              <button
                onClick={() => {
                  setOpen(false);
                  navigate("/whatsapp/branches");
                }}
                className="w-full text-left px-2.5 py-1.5 text-xs text-emerald-400 hover:bg-slate-800 rounded flex items-center gap-2 transition-colors font-medium"
              >
                <Settings size={13} />
                <span>Manage Branches & Hours</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
