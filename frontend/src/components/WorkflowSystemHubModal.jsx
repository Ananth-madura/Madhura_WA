import React, { useEffect, useState } from "react";
import axios from "axios";
import { API } from "../config/api";
import {
  X, Search, Layers, Sparkles, CheckCircle2, Loader2, ArrowRight, Package, Zap, ShieldCheck,
} from "lucide-react";

/**
 * Interactive 10-System Enterprise Template Hub modal.
 * Allows browsing all 10 business systems (75 editable templates including all
 * 10 advanced Appointment workflows), toggling Built-in CRM vs External API mode,
 * cloning a single customizable draft directly into the visual builder, or
 * installing a complete coordinated System Pack in one click.
 */
export default function WorkflowSystemHubModal({ open, onClose, onInstalled, onEditFlow }) {
  const [hub, setHub] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeSystem, setActiveSystem] = useState("all");
  const [search, setSearch] = useState("");
  const [connectionMode, setConnectionMode] = useState("builtin");
  const [autoPublish, setAutoPublish] = useState(false);
  const [busyKey, setBusyKey] = useState("");
  const [banner, setBanner] = useState("");

  const loadHub = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await axios.get(`${API}/api/wa-flows/hub`);
      setHub(data);
    } catch (err) {
      setError(err.response?.data?.error || "Could not load the 10-System Template Hub.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadHub();
      setBanner("");
    }
  }, [open]);

  if (!open) return null;

  const systems = hub?.systems || [];
  const installedMap = hub?.installedByKey || {};

  const visibleTemplates = systems
    .filter((s) => activeSystem === "all" || s.id === activeSystem)
    .flatMap((s) => s.templates || [])
    .filter((t) => {
      if (!search.trim()) return true;
      const needle = search.toLowerCase();
      return `${t.name} ${t.description} ${t.category} ${t.industries || ""} ${t.key} ${(t.trigger_config?.keywords || []).join(" ")}`.toLowerCase().includes(needle);
    })
    .sort((a, b) => Number(Boolean(b.isFlagship)) - Number(Boolean(a.isFlagship)));

  const installTemplate = async (templateKey, openInEditor = false) => {
    setBusyKey(templateKey);
    setError("");
    setBanner("");
    try {
      const { data } = await axios.post(`${API}/api/wa-flows/hub/install`, {
        templateKeys: [templateKey],
        connectionMode,
        autoPublish,
      });
      await loadHub();
      if (onInstalled) await onInstalled();
      const created = data.installed?.[0];
      if (openInEditor && created?.id && onEditFlow) {
        onClose();
        onEditFlow(created.id);
      } else {
        setBanner(`Installed "${created?.name || templateKey}" (${connectionMode === "builtin" ? "Built-in CRM ready" : "External API mode"}).`);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Could not install template.");
    } finally {
      setBusyKey("");
    }
  };

  const installSystemPack = async (systemId) => {
    setBusyKey(`pack:${systemId}`);
    setError("");
    setBanner("");
    try {
      const { data } = await axios.post(`${API}/api/wa-flows/hub/install`, {
        systemId: systemId === "all" ? null : systemId,
        connectionMode,
        autoPublish,
      });
      await loadHub();
      if (onInstalled) await onInstalled();
      const notes = (data.publishNotes || []).length
        ? ` (${data.publishNotes.length} saved as draft because AI key/approval is needed)`
        : "";
      setBanner(`Pack ready: ${data.installedCount} created, ${data.publishedCount} activated, ${data.skippedCount} already installed${notes}.`);
    } catch (err) {
      setError(err.response?.data?.error || "Could not install industry system pack.");
    } finally {
      setBusyKey("");
    }
  };

  const selectedSysObj = systems.find((s) => s.id === activeSystem);

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5" onClick={onClose}>
      <div
        className="bg-white rounded-3xl w-full max-w-6xl h-[88dvh] flex flex-col overflow-hidden shadow-2xl border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
              <Layers size={20} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">10-System Enterprise WhatsApp Automation Hub</h2>
              <p className="text-xs text-slate-500">
                Browse reusable multi-branch templates by industry, customize every step, or deploy an entire coordinated system pack.
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60">
            <X size={18} />
          </button>
        </div>

        {/* Config Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-slate-200 bg-white">
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search bookings, invoice, HR, KB..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="inline-flex rounded-xl border border-slate-200 p-0.5 bg-slate-50">
              <button
                type="button"
                onClick={() => setConnectionMode("builtin")}
                className={`px-2.5 py-1 rounded-lg font-bold transition ${connectionMode === "builtin" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600"}`}
              >
                Built-in CRM (Ready)
              </button>
              <button
                type="button"
                onClick={() => setConnectionMode("business")}
                className={`px-2.5 py-1 rounded-lg font-bold transition ${connectionMode === "business" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600"}`}
              >
                External API Mode
              </button>
            </div>

            <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-700 cursor-pointer">
              <input type="checkbox" checked={autoPublish} onChange={(e) => setAutoPublish(e.target.checked)} />
              <span>Auto-publish &amp; activate</span>
            </label>

            <button
              type="button"
              disabled={Boolean(busyKey)}
              onClick={() => installSystemPack(activeSystem)}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 disabled:opacity-60"
            >
              {busyKey === `pack:${activeSystem}` ? <Loader2 size={14} className="animate-spin" /> : <Package size={14} />}
              <span>
                {activeSystem === "all"
                  ? "Install All 10 Flagship Bots"
                  : `Install Full ${selectedSysObj?.name || ""} Pack (${selectedSysObj?.templates?.length || 0})`}
              </span>
            </button>
          </div>
        </div>

        {(error || banner) && (
          <div className="px-5 pt-3">
            {error && <div role="alert" className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">{error}</div>}
            {banner && <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2"><CheckCircle2 size={15} /><span>{banner}</span></div>}
          </div>
        )}

        {/* Body Split */}
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12">
          {/* Left: 10 Systems Navigation */}
          <aside className="md:col-span-4 lg:col-span-3 border-r border-slate-200 overflow-y-auto p-3 space-y-1 bg-slate-50/70">
            <button
              type="button"
              onClick={() => setActiveSystem("all")}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition ${
                activeSystem === "all" ? "bg-emerald-600 text-white shadow-sm" : "hover:bg-white text-slate-700"
              }`}
            >
              <span>All 10 Automation Systems</span>
              <span className="text-[10px] opacity-80">{hub?.totalTemplates || 75}</span>
            </button>
            {systems.map((sys, idx) => (
              <button
                key={sys.id}
                type="button"
                onClick={() => setActiveSystem(sys.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl transition border ${
                  activeSystem === sys.id
                    ? "bg-white border-emerald-500 text-emerald-900 shadow-sm"
                    : "border-transparent hover:bg-white text-slate-700"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold truncate">{String(idx + 1).padStart(2, "0")}. {sys.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-bold shrink-0">
                    {sys.templates?.length || 0}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 truncate mt-0.5">{sys.industries}</p>
              </button>
            ))}
          </aside>

          {/* Right: Templates Grid */}
          <main className="md:col-span-8 lg:col-span-9 overflow-y-auto p-4 sm:p-5 space-y-4">
            {loading ? (
              <div className="py-16 text-center space-y-2">
                <Loader2 size={30} className="animate-spin text-emerald-600 mx-auto" />
                <p className="text-xs font-semibold text-slate-500">Loading 10-System Enterprise Workflows...</p>
              </div>
            ) : visibleTemplates.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-500">No templates match "{search}".</div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                {visibleTemplates.map((tpl) => {
                  const existing = installedMap[tpl.key];
                  const kws = tpl.trigger_config?.keywords || [];
                  const stepTypes = [...new Set((tpl.nodes || []).map((n) => n.node_type))].slice(0, 6);
                  return (
                    <div key={tpl.key} className="border border-slate-200 rounded-2xl p-4 bg-white hover:border-emerald-300 hover:shadow-md transition flex flex-col justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold uppercase ${
                            tpl.isFlagship ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                          }`}>
                            {tpl.isFlagship ? "Deep Multi-Branch" : "Action Starter"}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold">
                            {tpl.category}
                          </span>
                          {tpl.usesAi && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center gap-1">
                              <Sparkles size={10} /> AI Key Needed
                            </span>
                          )}
                          {existing && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold flex items-center gap-1">
                              <ShieldCheck size={10} /> Installed ({existing.status})
                            </span>
                          )}
                        </div>

                        <h3 className="text-sm font-extrabold text-slate-900 leading-snug">{tpl.name}</h3>
                        <p className="text-xs text-slate-600 leading-relaxed">{tpl.description}</p>

                        <div className="flex flex-wrap items-center gap-1 pt-1">
                          {(tpl.nodes || []).length > 0 && (
                            <span className="text-[10px] font-bold text-slate-500 mr-1">{tpl.nodes.length} steps:</span>
                          )}
                          {stepTypes.map((st) => (
                            <span key={st} className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-slate-600">
                              {st}
                            </span>
                          ))}
                        </div>

                        {kws.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap text-[10px] text-slate-500">
                            <Zap size={11} className="text-amber-500" />
                            <span>Keywords:</span>
                            {kws.slice(0, 5).map((kw) => (
                              <code key={kw} className="px-1.5 py-0.5 bg-amber-50 text-amber-800 rounded font-semibold">{kw}</code>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          disabled={Boolean(busyKey)}
                          onClick={() => installTemplate(tpl.key, true)}
                          className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-60"
                        >
                          {busyKey === tpl.key ? <Loader2 size={13} className="animate-spin" /> : <ArrowRight size={13} />}
                          <span>Use &amp; Edit in Canvas</span>
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(busyKey)}
                          onClick={() => installTemplate(tpl.key, false)}
                          className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold disabled:opacity-60"
                        >
                          Add Only
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
