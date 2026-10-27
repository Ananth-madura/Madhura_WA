import WAWorkspaceGuide from "../components/WAWorkspaceGuide";
import TemplateProviderControls from "../components/TemplateProviderControls";
import {useEnterprise} from "../context/EnterpriseContext";
import { useState, useEffect, useCallback } from "react";
import {
  FileText, Plus, Edit2, Trash2, Copy, Loader2, Sparkles,
  Send, Zap, MessageSquare, Tag, Check, CheckCircle2
} from "lucide-react";
import axios from "axios";
import { API } from "../config/api";
import { useAuth } from "../auth/AuthContext";
import { getDemoRecords } from "../auth/demoApi";
import { VARIABLE_GROUPS, evaluateMessagePlaceholders } from "../components/WAVariablePicker";
import { useLocation, useNavigate } from "react-router-dom";

export const PLACEHOLDER_ITEMS = VARIABLE_GROUPS
  .filter((g) => g.id !== "spintax")
  .flatMap((g) =>
    g.variables.map((v) => ({
      key: v.tag,
      label: v.label,
      desc: g.label.replace(/^\S+\s/, ""),
      example: v.sample,
      color: g.color,
    }))
  );

// Sample preview resolver for interactive phone preview
export function renderPreviewText(templateText) {
  if (!templateText) return "Type your message or insert placeholders to preview...";
  return evaluateMessagePlaceholders(templateText, {
    name: "Rajesh Kumar",
    first_name: "Rajesh",
    company: "Madhura Tech",
    address: "12, Mount Road, Guindy",
    city: "Chennai",
    service: "AC Maintenance & AMC",
    invoice_no: "INV-2026-089",
    amount: "₹14,500",
    due_date: "25 Aug 2026",
    agent_name: "Pooja Mehta",
  });
}

export default function WATemplates() {
  const {activeTenant,loading}=useEnterprise();
  return loading?null:<TemplatesWorkspace key={activeTenant?.id||"none"}/>;
}

function TemplatesWorkspace() {
  const navigate = useNavigate();
  const location = useLocation();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [copiedId, setCopiedId] = useState(null);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [savedNotice, setSavedNotice] = useState(
    location.state && location.state.savedName
      ? { name: location.state.savedName, action: location.state.action || "created" }
      : null
  );

  const { demoMode } = useAuth();

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    if (demoMode) {
      setTemplates(getDemoRecords("templates"));
      setLoading(false);
      return;
    }
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.get(`${API}/api/wa/templates`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTemplates(Array.isArray(data) ? data : Array.isArray(data?.templates) ? data.templates : []);
    } catch (err) {
      setTemplates([]);
      setLoadError(err.response?.data?.message || err.response?.data?.error || "Templates could not be loaded. Check your connection and retry.");
    } finally {
      setLoading(false);
    }
  },[demoMode]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    if (!savedNotice) return;
    navigate(".", { replace: true, state: null });
    const timer = setTimeout(() => setSavedNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [savedNotice, navigate]);

  const openCreate = () => navigate("/whatsapp/templates/create");

  const openEdit = (t) =>
    navigate(`/whatsapp/templates/${encodeURIComponent(t.id)}/edit`, { state: { template: t } });

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this template?")) return;
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API}/api/wa/templates/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchTemplates();
    } catch (err) {
      setLoadError(err.response?.data?.message || err.response?.data?.error || "The template could not be deleted.");
    }
  };

  const copyToClipboard = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      setLoadError("Clipboard access is unavailable. Select and copy the template text instead.");
    }
  };

  const handleRestorePrebuilt = async () => {
    setLoadError("");
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API}/api/wa/templates/seed`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchTemplates();
    } catch (err) {
      setLoadError(err.response?.data?.message || err.response?.data?.error || "Prebuilt templates could not be loaded.");
      setLoading(false);
    }
  };

  const filteredTemplates = templates.filter(t => {
    const matchesSearch = (t.name || "").toLowerCase().includes(search.toLowerCase()) || (t.body || "").toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === "ALL" || t.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="hl-page">
      <WAWorkspaceGuide section="templates" />
      {/* Header Banner */}
      <div className="hl-commandbar flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center" style={{ background: "var(--color-paper)", color: "var(--color-ink)", border: "1px solid var(--color-rule)", borderRadius: "var(--radius-input)" }}>
              <FileText size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="hl-title">Message templates</h1>
                <span className="hl-badge hl-badge-success">
                  {templates.length} templates
                </span>
              </div>
              <p className="hl-subtitle">
                Prepare consistent customer messages with reusable CRM variables.
              </p>
            </div>
          </div>
        </div>

        <div className="hl-actions flex items-center gap-2 flex-wrap">
          <button
            onClick={handleRestorePrebuilt}
            className="hl-btn-secondary flex items-center gap-1.5"
          >
            <Sparkles size={14} style={{ color: "var(--color-ink-2)" }} />
            <span>Load starter templates</span>
          </button>
          <button
            onClick={openCreate}
            className="hl-btn-primary flex items-center gap-2"
          >
            <Plus size={16} />
            <span>New Template</span>
          </button>
        </div>
      </div>

      {!demoMode&&<TemplateProviderControls templates={templates} onChanged={fetchTemplates}/>}

      {loadError && (
        <div role="alert" className="hl-card flex flex-wrap items-center justify-between gap-3 p-3 text-sm" style={{ borderColor: "var(--color-error)", color: "var(--color-error)" }}>
          <span>{loadError}</span>
          <button type="button" className="hl-btn-secondary" onClick={fetchTemplates}>Retry</button>
        </div>
      )}

      {/* Save confirmation from the editor page */}
      {savedNotice && (
        <div
          role="status"
          className="hl-card p-3 mb-3 flex items-center justify-between gap-3 text-xs font-semibold"
          style={{ border: "1px solid var(--color-success)", color: "var(--color-success)" }}
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 size={15} />
            Template “{savedNotice.name}” {savedNotice.action}.
          </span>
          <button
            type="button"
            onClick={() => setSavedNotice(null)}
            aria-label="Dismiss confirmation"
            className="shrink-0 hover:opacity-70"
          >
            ✕
          </button>
        </div>
      )}

      {/* Placeholders Quick Reference Bar */}
      <details className="hl-card p-4" style={{ marginBottom: "var(--space-sm)" }}>
        <summary className="wa-template-reference flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag size={15} style={{ color: "var(--color-ink)" }} />
            <span className="hl-section-label">Available Dynamic Placeholders</span>
          </div>
          <span className="text-[11px] hidden sm:inline" style={{ color: "var(--color-ink-2)" }}>Automatically filled from CRM customer records</span>
        </summary>
        <div className="flex flex-wrap gap-2 mt-4">
          {PLACEHOLDER_ITEMS.map((p) => (
            <div
              key={p.key}
              className="hl-badge"
              title={`${p.desc} — Example: ${p.example}`}
            >
              <span className="font-bold">{p.key}</span>
              <span className="text-[10px] opacity-75">({p.label})</span>
            </div>
          ))}
        </div>
      </details>

      {/* Search & Category Filter Tabs */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3" style={{ marginBottom: "var(--space-sm)" }}>
        <div className="hl-tabs flex items-center gap-1 w-full sm:w-auto overflow-x-auto" style={{ background: "var(--color-paper-2)", border: "1px solid var(--color-rule)", borderRadius: "var(--radius-input)", padding: "4px" }}>
          {["ALL", "MARKETING", "UTILITY", "AUTHENTICATION"].map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`hl-tab whitespace-nowrap ${
                selectedCategory === cat
                  ? "is-active"
                  : ""
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-64">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search templates..."
            aria-label="Search message templates"
            className="hl-input w-full"
          />
        </div>
      </div>

      {/* Templates Grid */}
      {loading ? (
        <div role="status" className="flex items-center gap-3 justify-center py-20">
          <Loader2 size={36} className="animate-spin" style={{ color: "var(--color-ink)" }} />
          Loading templates…
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="hl-card hl-empty">
          <FileText size={48} className="mx-auto mb-3" style={{ color: "var(--color-ink-2)", opacity: 0.5 }} />
          <p className="hl-empty-title">{search || selectedCategory !== "ALL" ? "No matching templates" : "No templates yet"}</p>
          <p className="text-xs mt-1 max-w-sm mx-auto" style={{ color: "var(--color-ink-2)" }}>
            {search || selectedCategory !== "ALL" ? "Try another search or reset the category filter." : "Create a reusable message or choose a starter template."}
          </p>
          <button
            onClick={search || selectedCategory !== "ALL" ? () => { setSearch(""); setSelectedCategory("ALL"); } : openCreate}
            className="hl-btn-primary mt-4 inline-flex items-center gap-1.5"
          >
            <Plus size={14} /> {search || selectedCategory !== "ALL" ? "Clear filters" : "Create template"}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTemplates.map((t) => {
            const preview = renderPreviewText(t.body);
            return (
              <div
                key={t.id}
                className="hl-card overflow-hidden flex flex-col justify-between group"
              >
                {/* Card Header */}
                <div className="p-5" style={{ borderBottom: "1px solid var(--color-rule)" }}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h3 className="font-bold text-sm" style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}>
                        {t.name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`hl-badge ${
                          t.category === "MARKETING" ? "hl-badge-info" :
                          t.category === "UTILITY" ? "hl-badge-success" :
                          ""
                        }`}>
                          {t.category}
                        </span>
                        <span className="hl-id uppercase px-1.5 py-0.5">
                          {t.language || "en"}
                        </span>
                        <span className={`hl-badge ${t.meta_status==="APPROVED"&&t.meta_template_id?"hl-badge-success":"hl-badge-warn"}`}>{t.meta_template_id?t.meta_status:"DRAFT"}</span>
                        {t.header_type && (
                          <span className="hl-badge hl-badge-warn px-1.5 py-0.5">
                            {t.header_type}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(t)}
                        className="hl-btn-secondary"
                        style={{ padding: "var(--space-3xs)" }}
                        title="Edit Template"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="hl-btn-danger-ghost"
                        style={{ padding: "var(--space-3xs)" }}
                        title="Delete Template"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Body Text & Sample Preview */}
                  <div
                    className="p-3 text-xs whitespace-pre-wrap leading-relaxed line-clamp-4"
                    style={{ background: "var(--color-paper)", color: "var(--color-ink)", border: "1px solid var(--color-rule)", borderRadius: "var(--radius-input)", fontFamily: "var(--font-body)" }}
                    title={`Live Sample Preview:\n${preview}`}
                  >
                    {t.body}
                  </div>

                  {t.footer && (
                    <p className="text-[11px] italic mt-2 truncate" style={{ color: "var(--color-ink-2)" }}>
                      Footer: {t.footer}
                    </p>
                  )}
                </div>

                {/* Card Quick Actions */}
                <div className="p-4 flex flex-col gap-2" style={{ background: "var(--color-paper)", borderTop: "1px solid var(--color-rule)" }}>
                  <div className="flex items-center justify-between gap-1 text-[11px]">
                    <button
                      onClick={() => copyToClipboard(t.body, t.id)}
                      className="flex items-center gap-1 p-1 rounded transition"
                      style={{ color: "var(--color-ink-2)" }}
                      title="Copy template text"
                    >
                      {copiedId === t.id ? <Check size={13} style={{ color: "var(--color-success)" }} /> : <Copy size={13} />}
                      <span>{copiedId === t.id ? "Copied!" : "Copy"}</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => navigate("/whatsapp/campaigns")}
                        className="hl-badge hl-badge-success flex items-center gap-1 font-bold"
                        title="Open campaigns"
                      >
                        <Send size={11} />
                        <span>Campaign</span>
                      </button>

                      <button
                        onClick={() => navigate("/whatsapp/automations", { state: { templateId: t.id } })}
                        className="hl-badge flex items-center gap-1 font-bold"
                        title="Use in CRM automations"
                      >
                        <Zap size={11} />
                        <span>Automation</span>
                      </button>

                      <button
                        onClick={() => navigate("/whatsapp")}
                        className="hl-badge hl-badge-info flex items-center gap-1 font-bold"
                        title="Open in Live Chat"
                      >
                        <MessageSquare size={11} />
                        <span>Live Chat</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
