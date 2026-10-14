/**
 * OrganizationSwitcher.jsx
 *
 * Header component allowing instant switching between companies/tenants.
 * Reference: MADHURA_WHATSAPP_ENTERPRISE_SAAS_MASTER_BLUEPRINT.md
 */

import React, { useState, useRef, useEffect } from "react";
import { Building, ChevronDown, Check, Shield } from "lucide-react";
import { useEnterprise } from "../context/EnterpriseContext";

export default function OrganizationSwitcher() {
  const { activeTenant, organizations, switchOrganization } = useEnterprise();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!activeTenant) return null;

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="hl-btn-secondary shrink-0 flex items-center gap-2 px-2.5 sm:px-3 text-xs font-medium border border-slate-700/60 bg-slate-800/80 hover:bg-slate-700/80 text-slate-100 rounded-md transition-all shadow-sm"
        style={{ height: 36 }}
        title="Switch Organization / Company"
      >
        <Building size={14} className="text-amber-400 shrink-0" />
        <span className="max-w-[130px] sm:max-w-[180px] truncate text-left font-semibold">
          {activeTenant.name || "My Organization"}
        </span>
        {activeTenant.plan && (
          <span className="hidden md:inline-flex uppercase px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
            {activeTenant.plan}
          </span>
        )}
        <ChevronDown size={13} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 mt-1.5 w-64 origin-top-left rounded-lg bg-slate-900 border border-slate-700/80 shadow-2xl z-50 py-1.5 animate-in fade-in-50 zoom-in-95">
          <div className="px-3 py-1.5 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Organizations</span>
            <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">
              {organizations.length} available
            </span>
          </div>

          <div className="max-h-60 overflow-y-auto py-1">
            {organizations.map((org) => {
              const isSelected = org.id === activeTenant.id;
              return (
                <button
                  key={org.id}
                  onClick={() => {
                    switchOrganization(org.id);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors ${
                    isSelected
                      ? "bg-amber-500/15 text-amber-300 font-medium"
                      : "text-slate-200 hover:bg-slate-800/80"
                  }`}
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="truncate font-semibold">{org.name}</span>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                      <Shield size={10} className="text-slate-500" />
                      <span className="capitalize">{org.role || "Member"}</span>
                      {org.plan && <span>· {org.plan}</span>}
                    </span>
                  </div>
                  {isSelected && <Check size={14} className="text-amber-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
