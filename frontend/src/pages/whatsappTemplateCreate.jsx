import { useEffect, useMemo, useRef, useState } from "react";
import WAWorkspaceGuide from "../components/WAWorkspaceGuide";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, AlertTriangle, CheckCircle2, FileText, Loader2, Trash2, Plus
} from "lucide-react";
import axios from "axios";
import {useEnterprise} from "../context/EnterpriseContext";
import { API } from "../config/api";
import { useAuth } from "../auth/AuthContext";
import { getDemoRecords } from "../auth/demoApi";
import WAVariablePicker from "../components/WAVariablePicker";
import { PLACEHOLDER_ITEMS, renderPreviewText } from "./whatsappTemplates";

const CREATE_DEFAULTS = {
  name: "",
  category: "MARKETING",
  language: "en",
  header_type: "",
  header_value: "",
  body: "Hello {name}! Thank you for choosing {company}. We are delighted to assist you with {service}. Our working hours in {city} are {start_time} to {end_time}.",
  footer: "Madhura Tech Customer Support",
  button_type: "",
  buttons: "",
};

const EMPTY_FORM = {
  name: "",
  category: "MARKETING",
  language: "en",
  header_type: "",
  header_value: "",
  body: "",
  footer: "",
  button_type: "",
  buttons: "",
};

function toFormValues(template) {
  return {
    name: template.name || "",
    category: template.category || "MARKETING",
    language: template.language || "en",
    header_type: template.header_type || "",
    header_value: template.header_value || "",
    body: template.body || "",
    footer: template.footer || "",
    button_type: template.button_type || "",
    buttons: template.buttons
      ? (typeof template.buttons === "string" ? template.buttons : JSON.stringify(template.buttons))
      : "",
  };
}

function parseButtons(raw) {
  const value = (raw || "").trim();
  if (!value) return { ok: true, value: null };
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed) && typeof parsed !== "object") return { ok: false, value: null };
    return { ok: true, value: parsed };
  } catch {
    return { ok: false, value: null };
  }
}

function validate(form, opts = {}) {
  const errors = {};
  if (!form.name) errors.name = "Template name is required.";
  else if (!opts.skipNamePattern && !/^[a-z0-9_]+$/.test(form.name)) errors.name = "Lowercase letters, numbers and underscores only.";
  if (!(form.body || "").trim()) errors.body = "Message body is required.";
  if (!(form.language || "").trim()) errors.language = "Language code is required, e.g. en.";
  if ((form.buttons || "").trim() && !parseButtons(form.buttons).ok) {
    errors.buttons = 'Buttons must be valid JSON, e.g. [{"text":"Confirm"},{"text":"Reschedule"}]';
  }
  return errors;
}

const iconBox = {
  background: "var(--color-paper)",
  color: "var(--color-ink)",
  border: "1px solid var(--color-rule)",
  borderRadius: "var(--radius-input)",
};

export default function WATemplateCreate() {
  const {activeTenant,loading}=useEnterprise();
  return loading?null:<TemplateEditorWorkspace key={activeTenant?.id||"none"}/>;
}

function TemplateEditorWorkspace() {
  const { templateId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { demoMode } = useAuth();

  const isEdit = Boolean(templateId);

  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(isEdit ? EMPTY_FORM : CREATE_DEFAULTS);
  const [baseline, setBaseline] = useState(null);
  const [loadingTemplate, setLoadingTemplate] = useState(isEdit);
  const [loadError, setLoadError] = useState("");
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showSample, setShowSample] = useState(true);
  const bodyTextareaRef = useRef(null);
  const saveRef = useRef(null);

  const authHeaders = { Authorization: `Bearer ${localStorage.getItem("token")}` };

  /* ── Load existing template in edit mode ─────────────────────────────── */
  useEffect(() => {
    if (!isEdit) {
      setEditing(null);
      setForm(CREATE_DEFAULTS);
      setBaseline(JSON.stringify(CREATE_DEFAULTS));
      setLoadingTemplate(false);
      setLoadError("");
      return;
    }

    const passed = demoMode && location.state && location.state.template &&
      String(location.state.template.id) === String(templateId);

    if (passed) {
      const values = toFormValues(location.state.template);
      setEditing(location.state.template);
      setForm(values);
      setBaseline(JSON.stringify(values));
      setLoadError("");
      setLoadingTemplate(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoadingTemplate(true);
      setLoadError("");
      try {
        const source = demoMode
          ? getDemoRecords("templates")
          : (await axios.get(`${API}/api/wa/templates`, { headers: authHeaders })).data;
        const found = (source || []).find(t => String(t.id) === String(templateId));
        if (!found) {
          if (!cancelled) setLoadError("That template no longer exists. It may have been deleted.");
          return;
        }
        if (cancelled) return;
        const values = toFormValues(found);
        setEditing(found);
        setForm(values);
        setBaseline(JSON.stringify(values));
      } catch (err) {
        if (!cancelled) {
          setLoadError(err.response?.data?.error || "We couldn't load this template. Check your connection and try again.");
        }
      } finally {
        if (!cancelled) setLoadingTemplate(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId, demoMode]);

  const dirty = baseline !== null && JSON.stringify(form) !== baseline;

  /* ── Warn before losing unsaved work ─────────────────────────────────── */
  useEffect(() => {
    if (!dirty) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const setField = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setApiError("");
  };

  const handleSave = async () => {
    const baselineName = baseline !== null ? JSON.parse(baseline).name : null;
    const found = validate(form, {
      // Legacy templates may predate the naming rule — don't block an edit over it.
      skipNamePattern: Boolean(isEdit && baselineName && baselineName === form.name),
    });
    setErrors(found);
    if (Object.keys(found).length) {
      setApiError("Fix the highlighted fields before saving.");
      return;
    }
    setSaving(true);
    setApiError("");
    try {
      const payload = { ...form, buttons: parseButtons(form.buttons).value };
      if (editing) {
        await axios.put(`${API}/api/wa/templates/${editing.id}`, payload, { headers: authHeaders });
      } else {
        await axios.post(`${API}/api/wa/templates`, payload, { headers: authHeaders });
      }
      navigate("/whatsapp/templates", { state: { savedName: form.name, action: editing ? "updated" : "created" } });
    } catch (err) {
      setApiError(
        err.response?.data?.error ||
        (demoMode
          ? "The sample template could not be saved in this tab. Please retry."
          : "Failed to save template. Please try again.")
      );
    }
    setSaving(false);
  };

  saveRef.current = handleSave;

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === "s") {
        e.preventDefault();
        if (saveRef.current) saveRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleDelete = async () => {
    if (!editing || deleting) return;
    if (!window.confirm("Delete this template?")) return;
    setDeleting(true);
    setApiError("");
    try {
      await axios.delete(`${API}/api/wa/templates/${editing.id}`, { headers: authHeaders });
      navigate("/whatsapp/templates");
    } catch (err) {
      setApiError(err.response?.data?.error || "Failed to delete template.");
      setDeleting(false);
    }
  };

  const handleBack = () => {
    if (dirty && !window.confirm("You have unsaved changes. Leave without saving?")) return;
    navigate("/whatsapp/templates");
  };

  const insertPlaceholder = (placeholderKey) => {
    const textarea = bodyTextareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart || 0;
      const end = textarea.selectionEnd || 0;
      const current = form.body || "";
      const updated = current.substring(0, start) + placeholderKey + current.substring(end);
      setField("body", updated);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + placeholderKey.length, start + placeholderKey.length);
      }, 50);
    } else {
      setField("body", `${form.body || ""} ${placeholderKey}`);
    }
  };

  const usedTags = useMemo(
    () => Array.from(new Set((form.body || "").match(/\{[^{}]+\}/g) || [])),
    [form.body]
  );

  const previewButtons = useMemo(() => {
    if (!form.button_type) return [];
    const parsed = parseButtons(form.buttons);
    const fallback = form.button_type === "URL"
      ? ["🌐 Visit Website"]
      : form.button_type === "PHONE_NUMBER"
        ? ["📞 Call Us"]
        : ["✅ Confirm"];
    if (!parsed.value) return fallback;
    const list = Array.isArray(parsed.value) ? parsed.value : [parsed.value];
    return list.slice(0, 3).map((b, i) => {
      const text = typeof b === "string" ? b : (b && (b.text || b.value)) || "";
      if (form.button_type === "URL") return `🌐 ${text || "Visit Website"}`;
      if (form.button_type === "PHONE_NUMBER") return `📞 ${text || "Call Us"}`;
      return `✅ ${text || `Reply ${i + 1}`}`;
    });
  }, [form.button_type, form.buttons]);

  const sampleText = showSample ? renderPreviewText(form.body) : (form.body || "");
  const charCount = (form.body || "").length;

  const buttonList = useMemo(() => {
    if (!form.button_type) return [];
    const parsed = parseButtons(form.buttons);
    if (!parsed.ok || !parsed.value) return [];
    const list = Array.isArray(parsed.value) ? parsed.value : [parsed.value];
    return list.slice(0, 3).map((b) => (typeof b === "string" ? { text: b } : (b && typeof b === "object" ? b : { text: "" })));
  }, [form.button_type, form.buttons]);

  const syncButtons = (list) => {
    setField("buttons", list.length ? JSON.stringify(list) : "");
  };
  const addButton = () => {
    if (buttonList.length >= 3) return;
    syncButtons([...buttonList, { text: "" }]);
  };
  const removeButton = (index) => {
    syncButtons(buttonList.filter((_, i) => i !== index));
  };
  const updateButtonText = (index, value) => {
    const next = buttonList.map((b, i) => (i === index ? { ...b, text: value } : b));
    syncButtons(next);
  };

  /* ── Loading / not-found states ──────────────────────────────────────── */
  if (loadingTemplate) {
    return (
      <div className="hl-page flex flex-col items-center justify-center py-24 gap-4">
        <Loader2 size={30} className="animate-spin" style={{ color: "var(--color-ink)" }} />
        <p className="text-xs" style={{ color: "var(--color-ink-2)" }}>Loading template…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="hl-page">
        <div className="hl-commandbar">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => navigate("/whatsapp/templates")} className="hl-btn-secondary" style={{ padding: "10px 11px" }} title="Back to templates" aria-label="Back to templates">
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 className="hl-title">Message Template</h1>
              <p className="hl-subtitle">Template editor</p>
            </div>
          </div>
        </div>
        <div className="hl-card hl-empty">
          <AlertTriangle size={44} className="mx-auto mb-3" style={{ color: "var(--color-ink-2)", opacity: 0.6 }} />
          <p className="hl-empty-title">Template unavailable</p>
          <p className="text-xs mt-1 max-w-sm mx-auto" style={{ color: "var(--color-ink-2)" }}>{loadError}</p>
          <button type="button" onClick={() => navigate("/whatsapp/templates")} className="hl-btn-primary mt-4 inline-flex items-center gap-1.5">
            <ArrowLeft size={14} /> Back to Templates
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="hl-page">
      <WAWorkspaceGuide section="templates" />
      {/* Page Header */}
      <div className="hl-commandbar flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <button
            type="button"
            onClick={handleBack}
            className="hl-btn-secondary shrink-0"
            style={{ padding: "10px 11px" }}
            title="Back to templates"
            aria-label="Back to templates"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 hidden sm:flex items-center justify-center shrink-0" style={iconBox}>
              <FileText size={22} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="hl-title">{isEdit ? "Edit Message Template" : "Create Message Template"}</h1>
                {dirty && <span className="hl-badge hl-badge-warn">Unsaved changes</span>}
                {editing && <span className="hl-badge hl-badge-success">{editing.category || form.category}</span>}
              </div>
              <p className="hl-subtitle">
                {isEdit
                  ? "Changes apply to future sends — campaigns and automations pick them up automatically."
                  : "Build the message, drop in CRM placeholders and watch the WhatsApp preview update live."}
              </p>
            </div>
          </div>
        </div>

        <div className="hl-actions flex items-center gap-2 flex-wrap">
          {isEdit && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || saving}
              className="hl-btn-danger-ghost flex items-center gap-1.5 disabled:opacity-50"
            >
              {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              <span>Delete</span>
            </button>
          )}
          <button type="button" onClick={handleBack} className="hl-btn-secondary">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="hl-btn-primary flex items-center gap-2 disabled:opacity-50"
            title="Save template (Ctrl+S)"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            <span>{isEdit ? "Save Changes" : "Create Template"}</span>
          </button>
        </div>
      </div>

      {apiError && (
        <div
          role="alert"
          className="hl-card p-3 mb-3 flex items-start justify-between gap-3 text-xs font-semibold"
          style={{ border: "1px solid var(--color-error)", color: "var(--color-error)" }}
        >
          <span className="flex items-start gap-2">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            <span>{apiError}</span>
          </span>
          <button type="button" onClick={() => setApiError("")} aria-label="Dismiss error" className="shrink-0 hover:opacity-70">
            ✕
          </button>
        </div>
      )}

      {/* Editor + Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start">
        {/* ── Left column: form ── */}
        <div className="lg:col-span-7 space-y-4">
          {/* Basics */}
          <div className="hl-card p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className="hl-section-label">1. Template basics</span>
            </div>

            <div>
              <label className="hl-section-label block mb-1" htmlFor="tpl-name">Template Name *</label>
              <input
                id="tpl-name"
                type="text"
                value={form.name}
                onChange={e => setField("name", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                className="hl-input w-full font-mono"
                placeholder="e.g. appointment_reminder_v1"
                aria-invalid={Boolean(errors.name)}
              />
              <p className="text-[10px] mt-1" style={{ color: errors.name ? "var(--color-error)" : "var(--color-ink-2)" }}>
                {errors.name || "Lowercase letters, numbers, and underscores only."}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="hl-section-label block mb-1" htmlFor="tpl-category">Category</label>
                <select
                  id="tpl-category"
                  value={form.category}
                  onChange={e => setField("category", e.target.value)}
                  className="hl-select w-full font-semibold"
                >
                  <option value="MARKETING">MARKETING</option>
                  <option value="UTILITY">UTILITY</option>
                  <option value="AUTHENTICATION">AUTHENTICATION</option>
                </select>
              </div>
              <div>
                <label className="hl-section-label block mb-1" htmlFor="tpl-language">Language</label>
                <input
                  id="tpl-language"
                  type="text"
                  value={form.language}
                  onChange={e => setField("language", e.target.value)}
                  className="hl-input w-full"
                  placeholder="en"
                  aria-invalid={Boolean(errors.language)}
                />
                {errors.language && (
                  <p className="text-[10px] mt-1" style={{ color: "var(--color-error)" }}>{errors.language}</p>
                )}
              </div>
            </div>
          </div>

          {/* Header */}
          <div className="hl-card p-4 sm:p-5 space-y-3">
            <span className="hl-section-label">2. Header (optional)</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="hl-section-label block mb-1" htmlFor="tpl-header-type">Header Type</label>
                <select
                  id="tpl-header-type"
                  value={form.header_type}
                  onChange={e => setField("header_type", e.target.value)}
                  className="hl-select w-full"
                >
                  <option value="">None</option>
                  <option value="TEXT">Text Header</option>
                  <option value="IMAGE">Image Header</option>
                  <option value="VIDEO">Video Header</option>
                  <option value="DOCUMENT">Document (PDF)</option>
                </select>
              </div>
              <div>
                <label className="hl-section-label block mb-1" htmlFor="tpl-header-value">Header Title / Value</label>
                <input
                  id="tpl-header-value"
                  type="text"
                  value={form.header_value}
                  onChange={e => setField("header_value", e.target.value)}
                  disabled={!form.header_type}
                  className="hl-input w-full disabled:opacity-40"
                  placeholder={form.header_type === "TEXT" ? "Special Announcement" : "URL or Header Caption"}
                />
              </div>
            </div>
            {form.header_type && form.header_type !== "TEXT" && (
              <p className="text-[10px]" style={{ color: "var(--color-ink-2)" }}>
                A {form.header_type.toLowerCase()} header needs media uploaded when the campaign is sent — the preview shows it as a placeholder.
              </p>
            )}
          </div>

          {/* Body */}
          <div className="hl-card p-4 sm:p-5">
            <div className="flex items-center justify-between mb-1.5 gap-3 flex-wrap">
              <label className="hl-section-label" htmlFor="tpl-body">Message Body *</label>
              <span className="hl-id">{charCount} chars · {usedTags.length} placeholders</span>
            </div>

            <textarea
              id="tpl-body"
              ref={bodyTextareaRef}
              value={form.body}
              onChange={e => setField("body", e.target.value)}
              rows={30}
              style={{ minHeight: "240px" }}
              className="hl-input w-full resize-none leading-relaxed"
              placeholder="Hello {name}! Thank you for choosing {company}. Your {service} scheduled on {date} at {city} is confirmed."
              aria-invalid={Boolean(errors.body)}
            />
            <p className="text-[10px] mt-1" style={{ color: errors.body ? "var(--color-error)" : "var(--color-ink-2)" }}>
              {errors.body || "Placeholders are replaced per-contact from CRM records when the message is sent."}
            </p>

            <div className="flex items-center justify-between mb-1.5 mt-4">
              <label className="hl-section-label" htmlFor="tpl-footer">Footer (Optional)</label>
            </div>
            <input
              id="tpl-footer"
              type="text"
              value={form.footer}
              onChange={e => setField("footer", e.target.value)}
              className="hl-input w-full"
              placeholder="e.g. Reply STOP to unsubscribe"
            />
          </div>

          {/* Buttons */}
          <div className="hl-card p-4 sm:p-5 space-y-3">
            <span className="hl-section-label">3. Buttons (optional)</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="hl-section-label block mb-1" htmlFor="tpl-button-type">Button Type</label>
                <select
                  id="tpl-button-type"
                  value={form.button_type}
                  onChange={e => setField("button_type", e.target.value)}
                  className="hl-select w-full"
                >
                  <option value="">No Buttons</option>
                  <option value="QUICK_REPLY">Quick Reply Buttons</option>
                  <option value="URL">Visit Website URL</option>
                  <option value="PHONE_NUMBER">Call Phone Number</option>
                </select>
              </div>
              <div>
                <label className="hl-section-label block mb-1">Button Texts (max 3)</label>
                {form.button_type ? (
                  <div className="space-y-2">
                    {buttonList.map((btn, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={btn.text || ""}
                          onChange={(e) => updateButtonText(i, e.target.value)}
                          className="hl-input w-full"
                          placeholder={`Button ${i + 1} label`}
                          aria-label={`Button ${i + 1} label`}
                        />
                        <button
                          type="button"
                          onClick={() => removeButton(i)}
                          className="hl-btn-danger-ghost shrink-0"
                          aria-label={`Remove button ${i + 1}`}
                          title="Remove button"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addButton}
                      disabled={buttonList.length >= 3}
                      className="hl-btn-secondary flex items-center gap-1.5 disabled:opacity-40"
                    >
                      <Plus size={14} /> Add button
                    </button>
                    <p className="text-[10px]" style={{ color: "var(--color-ink-2)" }}>
                      {buttonList.length}/3 buttons · {buttonList.length >= 3 ? "Maximum reached." : "Add up to 3 buttons."}
                    </p>
                  </div>
                ) : (
                  <p className="text-[10px]" style={{ color: "var(--color-ink-2)" }}>
                    Select a button type first.
                  </p>
                )}
              </div>
            </div>
            <p className="text-[10px]" style={{ color: errors.buttons ? "var(--color-error)" : "var(--color-ink-2)" }}>
              {errors.buttons || (form.button_type ? "Buttons sync automatically to the preview (max 3)." : "No buttons on this template.")}
            </p>
          </div>

          {/* Bottom actions */}
          <div className="flex items-center justify-between gap-3 pt-1 pb-2">
            <span className="text-[10px]" style={{ color: "var(--color-ink-2)" }}>
              {dirty ? "Unsaved changes" : "All changes saved"} · Ctrl+S to save
            </span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleBack} className="hl-btn-secondary">Cancel</button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="hl-btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                <span>{isEdit ? "Save Changes" : "Create Template"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Right column: live preview ── */}
        <div className="lg:col-span-5 lg:sticky lg:top-4 self-start space-y-4">
          <div className="rounded-3xl p-4 flex flex-col justify-between border-4" style={{ background: "var(--color-shell)", borderColor: "var(--color-shell-2)" }}>
            <div>
              <div className="flex items-center justify-between px-2 py-2 mb-3 gap-2" style={{ borderBottom: "1px solid var(--color-shell-2)" }}>
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0" style={{ background: "var(--color-paper-2)", color: "var(--color-ink)" }}>
                    MT
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold leading-tight truncate" style={{ color: "var(--color-paper-2)" }}>Madhura Tech Customer Care</p>
                    <p className="text-[10px]" style={{ color: "var(--color-paper-2)", opacity: 0.75 }}>Official Business Account</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowSample(v => !v)}
                    className="text-[10px] px-2 py-1 rounded transition"
                    style={{
                      color: "var(--color-paper-2)",
                      background: showSample ? "rgba(255,255,255,.14)" : "transparent",
                      border: "1px solid rgba(255,255,255,.22)",
                    }}
                    title={showSample ? "Showing sample CRM data" : "Showing raw placeholders"}
                  >
                    {showSample ? "Sample data" : "Placeholders"}
                  </button>
                  <span className="text-[10px] hl-id" style={{ color: "var(--color-paper-2)", opacity: 0.7 }}>
                    {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>

              {/* Message bubble */}
              <div className="rounded-2xl p-4 text-xs space-y-2 relative max-w-full" style={{ background: "var(--color-paper-2)", color: "var(--color-ink)", border: "1px solid var(--color-rule)" }}>
                {form.header_type && (
                  <div className="font-bold text-sm pb-1.5" style={{ color: "var(--color-ink)", borderBottom: "1px solid var(--color-rule)" }}>
                    {form.header_type === "TEXT" ? (form.header_value || "Header Title") : `[📷 ${form.header_type} Header]`}
                  </div>
                )}

                <div className="whitespace-pre-wrap leading-relaxed" style={{ color: "var(--color-ink)" }}>
                  {sampleText || <span style={{ color: "var(--color-ink-2)" }}>Type your message or insert placeholders to preview…</span>}
                </div>

                {form.footer && (
                  <div className="text-[10px] pt-1 italic" style={{ color: "var(--color-ink-2)", borderTop: "1px solid var(--color-rule)" }}>
                    {form.footer}
                  </div>
                )}

                <div className="text-[9px] text-right hl-id">
                  {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} ✓✓
                </div>
              </div>

              {/* Buttons */}
              {previewButtons.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {previewButtons.map((label, i) => (
                    <div key={`${label}-${i}`} className="py-2 px-3 rounded-xl text-center font-bold text-xs" style={{ background: "var(--color-paper-2)", color: "var(--color-ink)", border: "1px solid var(--color-rule)" }}>
                      {label}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Live stats */}
            <div className="mt-4 p-3 rounded-2xl text-[11px] space-y-1" style={{ background: "var(--color-shell-2)", color: "var(--color-paper-2)", border: "1px solid var(--color-shell-2)" }}>
              <div className="flex items-center justify-between">
                <span>Variables count:</span>
                <span className="font-bold font-mono hl-id" style={{ color: "var(--color-paper-2)" }}>{usedTags.length} tags</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Body length:</span>
                <span className="font-bold font-mono hl-id" style={{ color: "var(--color-paper-2)" }}>{charCount} chars</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Meta Cloud API support:</span>
                <span className="font-bold" style={{ color: "var(--color-paper-2)" }}>Ready</span>
              </div>
            </div>
          </div>

          <WAVariablePicker onInsert={insertPlaceholder} className="mt-4" />

        </div>
      </div>
    </div>
  );
}
