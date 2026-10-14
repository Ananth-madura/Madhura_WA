import React, { useState, useRef, useEffect } from "react";
import { GitBranch, ChevronDown, Check, Plus, Search, Building2, Star, Shield } from "lucide-react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useBranch } from "../../context/BranchContext";

export default function BranchSwitcher({ className = "" }) {
  const {
    activeBranch,
    accessibleBranches,
    switchBranch,
    can,
  } = useBranch();

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { slug } = useParams();

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredBranches = accessibleBranches.filter((b) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      b.name?.toLowerCase().includes(term) ||
      b.code?.toLowerCase().includes(term) ||
      b.city?.toLowerCase().includes(term)
    );
  });

  const handleSelectBranch = (targetBranch) => {
    setOpen(false);
    setSearch("");

    // Determine current sub-module path if already in workspace
    const currentPath = location.pathname;
    let targetSubPath = "dashboard";
    const match = currentPath.match(/\/whatsapp\/branches\/[^/]+\/[^/]+\/(.+)$/);
    if (match && match[1]) {
      targetSubPath = match[1];
    }

    switchBranch(targetBranch.id, targetBranch.slug || "workspace", targetSubPath);
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium border border-emerald-700/60 bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-100 rounded-lg transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
        title="Switch Branch Workspace"
      >
        <GitBranch size={14} className="text-emerald-400 shrink-0" />
        <div className="flex flex-col text-left leading-tight">
          <span className="font-semibold text-slate-100 truncate max-w-[130px] sm:max-w-[160px]">
            {activeBranch ? activeBranch.name : "Select Branch"}
          </span>
          {activeBranch?.code && (
            <span className="text-[10px] font-mono text-emerald-400 font-bold">
              {activeBranch.code} {activeBranch.city ? `· ${activeBranch.city}` : ""}
            </span>
          )}
        </div>
        <ChevronDown
          size={13}
          className={`text-emerald-400/80 transition-transform duration-200 ml-1 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-72 origin-top-left rounded-xl bg-slate-900 border border-slate-700/80 shadow-2xl z-50 py-2 animate-in fade-in-50 zoom-in-95">
          {/* Header */}
          <div className="px-3 pb-2 border-b border-slate-800 flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Branches & Workspaces
            </span>
            <span className="text-[10px] bg-emerald-950/80 border border-emerald-800/60 px-2 py-0.5 rounded-full text-emerald-400 font-mono font-bold">
              {accessibleBranches.length} permitted
            </span>
          </div>

          {/* Search */}
          <div className="p-2 border-b border-slate-800/80">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2.5 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, code or city..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-600 transition-colors"
                autoFocus
              />
            </div>
          </div>

          {/* Branch List */}
          <div className="max-h-60 overflow-y-auto py-1">
            {filteredBranches.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-slate-500">
                No matching branch found
              </div>
            ) : (
              filteredBranches.map((branch) => {
                const isSelected = activeBranch && branch.id === activeBranch.id;
                return (
                  <button
                    key={branch.id}
                    onClick={() => handleSelectBranch(branch)}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors ${
                      isSelected
                        ? "bg-emerald-500/15 text-emerald-300 font-medium"
                        : "text-slate-200 hover:bg-slate-800/80"
                    }`}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <div className="flex items-center gap-1.5 font-semibold">
                        <span className="truncate">{branch.name}</span>
                        {branch.is_head_office === 1 && (
                          <Star size={12} className="text-amber-400 fill-amber-400 shrink-0" title="Head Office" />
                        )}
                        {branch.status === "archived" && (
                          <span className="text-[9px] px-1 bg-rose-950 text-rose-400 border border-rose-800 rounded">
                            Archived
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                        <span className="font-mono text-emerald-400/90 font-bold">{branch.code}</span>
                        {branch.city && <span>· {branch.city}</span>}
                        {branch.staff_count !== undefined && <span>· {branch.staff_count} staff</span>}
                      </div>
                    </div>
                    {isSelected && <Check size={14} className="text-emerald-400 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>

          {/* Actions Footer */}
          <div className="border-t border-slate-800/80 pt-2 px-2 flex flex-col gap-1">
            {can("branch.create") && (
              <button
                onClick={() => {
                  setOpen(false);
                  navigate("/whatsapp/branches/new");
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-400 hover:bg-emerald-950/40 hover:text-emerald-300 transition-colors"
              >
                <Plus size={13} />
                <span>Create New Branch Wizard</span>
              </button>
            )}

            <button
              onClick={() => {
                setOpen(false);
                navigate("/whatsapp/branches");
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-slate-800 transition-colors"
            >
              <Building2 size={13} className="text-slate-400" />
              <span>All Branches Directory</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
