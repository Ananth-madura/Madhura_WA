import { useState, useEffect, useRef } from "react";
import {
  FileText, Plus, Edit2, Trash2, Copy, X, Loader2, Sparkles,
  Send, Zap, CheckCircle2, MessageSquare, Tag, Check
} from "lucide-react";
import axios from "axios";
import { API } from "../config/api";
import WhatsAppNav from "../components/WhatsAppNav";
import WAVariablePicker, { VARIABLE_GROUPS, evaluateMessagePlaceholders } from "../components/WAVariablePicker";
import { useNavigate } from "react-router-dom";

const PLACEHOLDER_ITEMS = VARIABLE_GROUPS
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
function renderPreviewText(templateText) {
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
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");

  const [form, setForm] = useState({
    name: "",
    category: "MARKETING",
    language: "en",
    header_type: "",
    header_value: "",
    body: "",
    footer: "",
    button_type: "",
    buttons: "",
  });
  const [saving, setSaving] = useState(false);
  const bodyTextareaRef = useRef(null);

  const fetchTemplates = async () => {
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.get(`${API}/api/wa/templates`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTemplates(data || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: "",
      category: "MARKETING",
      language: "en",
      header_type: "",
      header_value: "",
      body: "Hello {name}! Thank you for choosing {company}. We are delighted to assist you with {service}. Our working hours in {city} are {start_time} to {end_time}.",
      footer: "Madhura Tech Customer Support",
      button_type: "",
      buttons: "",
    });
    setShowModal(true);
  };

  const openEdit = (t) => {
    setEditing(t);
    setForm({
      name: t.name,
      category: t.category,
      language: t.language,
      header_type: t.header_type || "",
      header_value: t.header_value || "",
      body: t.body,
      footer: t.footer || "",
      button_type: t.button_type || "",
      buttons: t.buttons ? (typeof t.buttons === "string" ? t.buttons : JSON.stringify(t.buttons)) : ""
    });
    setShowModal(true);
  };

  const insertPlaceholder = (placeholderKey) => {
    const textarea = bodyTextareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart || 0;
      const end = textarea.selectionEnd || 0;
      const current = form.body || "";
      const updated = current.substring(0, start) + placeholderKey + current.substring(end);
      setForm(prev => ({ ...prev, body: updated }));
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + placeholderKey.length, start + placeholderKey.length);
      }, 50);
    } else {
      setForm(prev => ({ ...prev, body: (prev.body || "") + " " + placeholderKey }));
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.body) return;
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const payload = {
        ...form,
        buttons: form.buttons ? (() => { try { return JSON.parse(form.buttons); } catch { return form.buttons; } })() : null
      };
      if (editing) {
        await axios.put(`${API}/api/wa/templates/${editing.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`${API}/api/wa/templates`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      setShowModal(false);
      fetchTemplates();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to save template");
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this template?")) return;
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API}/api/wa/templates/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchTemplates();
    } catch (err) {
      console.error(err);
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleRestorePrebuilt = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API}/api/wa/templates/seed`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchTemplates();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to load prebuilt templates");
    }
    setLoading(false);
  };

  const filteredTemplates = templates.filter(t => {
    const matchesSearch = (t.name || "").toLowerCase().includes(search.toLowerCase()) || (t.body || "").toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === "ALL" || t.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="w-full pb-10">
      <WhatsAppNav />

      {/* Header Banner */}
      <div className="hl-commandbar flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center" style={{ background: "var(--color-paper)", color: "var(--color-ink)", border: "1px solid var(--color-rule)", borderRadius: "var(--radius-input)" }}>
              <FileText size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="hl-title">WhatsApp Message Templates</h1>
                <span className="hl-badge hl-badge-success">
                  {templates.length} Active Templates
                </span>
              </div>
              <p className="hl-subtitle">
                Create reusable message templates with dynamic CRM placeholders and one-click campaign launch.
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
            <span>Load Prebuilt Templates</span>
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

      {/* Placeholders Quick Reference Bar */}
      <div className="hl-card p-4" style={{ marginBottom: "var(--space-sm)" }}>
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <Tag size={15} style={{ color: "var(--color-ink)" }} />
            <span className="hl-section-label">Available Dynamic Placeholders</span>
          </div>
          <span className="text-[11px] hidden sm:inline" style={{ color: "var(--color-ink-2)" }}>Automatically filled from CRM customer records</span>
        </div>
        <div className="flex flex-wrap gap-2">
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
      </div>

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
            className="hl-input w-full"
          />
        </div>
      </div>

      {/* Templates Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={36} className="animate-spin" style={{ color: "var(--color-ink)" }} />
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="hl-card hl-empty">
          <FileText size={48} className="mx-auto mb-3" style={{ color: "var(--color-ink-2)", opacity: 0.5 }} />
          <p className="hl-empty-title">No Templates Found</p>
          <p className="text-xs mt-1 max-w-sm mx-auto" style={{ color: "var(--color-ink-2)" }}>
            Click "New Template" or "Load Prebuilt Templates" to start creating customized WhatsApp templates.
          </p>
          <button
            onClick={openCreate}
            className="hl-btn-primary mt-4 inline-flex items-center gap-1.5"
          >
            <Plus size={14} /> Create First Template
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
                        title="Launch bulk campaign with this template"
                      >
                        <Send size={11} />
                        <span>Campaign</span>
                      </button>

                      <button
                        onClick={() => navigate("/whatsapp/automations")}
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

      {/* Create / Edit Template Modal with Live WhatsApp Bubble Preview */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="hl-card w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: "1px solid var(--color-rule)" }}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 flex items-center justify-center font-bold" style={{ background: "var(--color-paper)", color: "var(--color-ink)", border: "1px solid var(--color-rule)", borderRadius: "var(--radius-input)" }}>
                  <FileText size={16} />
                </div>
                <div>
                  <h2 className="text-base font-bold" style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}>{editing ? "Edit Message Template" : "Create New Message Template"}</h2>
                  <p className="hl-subtitle">Add dynamic variable placeholders and preview live WhatsApp appearance</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-xl transition" style={{ color: "var(--color-ink-2)" }}>
                <X size={20} />
              </button>
            </div>

            {/* Modal Body: 2 Columns (Editor + Live Preview) */}
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Form Editor (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                <div>
                  <label className="hl-section-label block mb-1">Template Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })}
                    className="hl-input w-full font-mono"
                    placeholder="e.g. appointment_reminder_v1"
                  />
                  <p className="text-[10px] mt-1" style={{ color: "var(--color-ink-2)" }}>Lowercase letters, numbers, and underscores only.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="hl-section-label block mb-1">Category</label>
                    <select
                      value={form.category}
                      onChange={e => setForm({ ...form, category: e.target.value })}
                      className="hl-select w-full font-semibold"
                    >
                      <option value="MARKETING">MARKETING</option>
                      <option value="UTILITY">UTILITY</option>
                      <option value="AUTHENTICATION">AUTHENTICATION</option>
                    </select>
                  </div>
                  <div>
                    <label className="hl-section-label block mb-1">Language</label>
                    <input
                      type="text"
                      value={form.language}
                      onChange={e => setForm({ ...form, language: e.target.value })}
                      className="hl-input w-full"
                      placeholder="en"
                    />
                  </div>
                </div>

                {/* Header configuration */}
                <div className="grid grid-cols-2 gap-3 p-3" style={{ background: "var(--color-paper)", border: "1px solid var(--color-rule)", borderRadius: "var(--radius-input)" }}>
                  <div>
                    <label className="hl-section-label block mb-1">Header Type</label>
                    <select
                      value={form.header_type}
                      onChange={e => setForm({ ...form, header_type: e.target.value })}
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
                    <label className="hl-section-label block mb-1">Header Title / Value</label>
                    <input
                      type="text"
                      value={form.header_value}
                      onChange={e => setForm({ ...form, header_value: e.target.value })}
                      disabled={!form.header_type}
                      className="hl-input w-full disabled:opacity-40"
                      placeholder={form.header_type === "TEXT" ? "Special Announcement" : "URL or Header Caption"}
                    />
                  </div>
                </div>

                {/* Body Textarea with Clickable Placeholders */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="hl-section-label">Message Body *</label>
                    <span className="hl-id">{(form.body || "").length} chars</span>
                  </div>

                  <WAVariablePicker
                    onInsert={(tag) => insertPlaceholder(tag)}
                    className="mb-2"
                  />

                  <textarea
                    ref={bodyTextareaRef}
                    value={form.body}
                    onChange={e => setForm({ ...form, body: e.target.value })}
                    rows={6}
                    className="hl-input w-full resize-none leading-relaxed"
                    placeholder="Hello {name}! Thank you for choosing {company}. Your {service} scheduled on {date} at {city} is confirmed."
                  />
                </div>

                {/* Footer Text */}
                <div>
                  <label className="hl-section-label block mb-1">Footer (Optional)</label>
                  <input
                    type="text"
                    value={form.footer}
                    onChange={e => setForm({ ...form, footer: e.target.value })}
                    className="hl-input w-full"
                    placeholder="e.g. Reply STOP to unsubscribe"
                  />
                </div>

                {/* Interactive Buttons */}
                <div className="grid grid-cols-2 gap-3 p-3" style={{ background: "var(--color-paper)", border: "1px solid var(--color-rule)", borderRadius: "var(--radius-input)" }}>
                  <div>
                    <label className="hl-section-label block mb-1">Button Type</label>
                    <select
                      value={form.button_type}
                      onChange={e => setForm({ ...form, button_type: e.target.value })}
                      className="hl-select w-full"
                    >
                      <option value="">No Buttons</option>
                      <option value="QUICK_REPLY">Quick Reply Buttons</option>
                      <option value="URL">Visit Website URL</option>
                      <option value="PHONE_NUMBER">Call Phone Number</option>
                    </select>
                  </div>
                  <div>
                    <label className="hl-section-label block mb-1">Buttons Config</label>
                    <input
                      type="text"
                      value={form.buttons}
                      onChange={e => setForm({ ...form, buttons: e.target.value })}
                      disabled={!form.button_type}
                      className="hl-input w-full font-mono disabled:opacity-40"
                      placeholder='[{"text":"Confirm"},{"text":"Reschedule"}]'
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Live WhatsApp Phone Mockup Preview (5 cols) */}
              <div className="lg:col-span-5 rounded-3xl p-4 flex flex-col justify-between border-4" style={{ background: "var(--color-shell)", borderColor: "var(--color-shell-2)" }}>
                <div>
                  {/* Phone Mockup Top Bar */}
                  <div className="flex items-center justify-between px-2 py-2 mb-3" style={{ borderBottom: "1px solid var(--color-shell-2)", color: "var(--color-paper-2)" }}>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs" style={{ background: "var(--color-paper-2)", color: "var(--color-ink)" }}>
                        MT
                      </div>
                      <div>
                        <p className="text-xs font-bold leading-tight" style={{ color: "var(--color-paper-2)" }}>Madhura Tech Customer Care</p>
                        <p className="text-[10px]" style={{ color: "var(--color-paper-2)", opacity: 0.75 }}>Official Business Account</p>
                      </div>
                    </div>
                    <span className="text-[10px] hl-id" style={{ color: "var(--color-paper-2)", opacity: 0.7 }}>11:30 AM</span>
                  </div>

                  {/* WhatsApp Message Bubble */}
                  <div className="rounded-2xl p-4 text-xs space-y-2 relative max-w-full" style={{ background: "var(--color-paper-2)", color: "var(--color-ink)", border: "1px solid var(--color-rule)" }}>
                    {/* Header */}
                    {form.header_type && (
                      <div className="font-bold text-sm pb-1.5" style={{ color: "var(--color-ink)", borderBottom: "1px solid var(--color-rule)" }}>
                        {form.header_type === "TEXT" ? (form.header_value || "Header Title") : `[📷 ${form.header_type} Header]`}
                      </div>
                    )}

                    {/* Body text with live preview */}
                    <div className="whitespace-pre-wrap leading-relaxed" style={{ color: "var(--color-ink)" }}>
                      {renderPreviewText(form.body)}
                    </div>

                    {/* Footer */}
                    {form.footer && (
                      <div className="text-[10px] pt-1 italic" style={{ color: "var(--color-ink-2)", borderTop: "1px solid var(--color-rule)" }}>
                        {form.footer}
                      </div>
                    )}

                    {/* Timestamp */}
                    <div className="text-[9px] text-right hl-id">
                      {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} ✓✓
                    </div>
                  </div>

                  {/* Simulated WhatsApp Buttons */}
                  {form.button_type && (
                    <div className="mt-2 space-y-1.5">
                      <div className="py-2 px-3 rounded-xl text-center font-bold text-xs transition cursor-pointer" style={{ background: "var(--color-paper-2)", color: "var(--color-ink)", border: "1px solid var(--color-rule)" }}>
                        {form.button_type === "URL" ? "🌐 Visit Website" : form.button_type === "PHONE_NUMBER" ? "📞 Call Us" : "✅ Confirm Appointment"}
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom live stats */}
                <div className="mt-4 p-3 rounded-2xl text-[11px] space-y-1" style={{ background: "var(--color-shell-2)", color: "var(--color-paper-2)", border: "1px solid var(--color-shell-2)" }}>
                  <div className="flex items-center justify-between">
                    <span>Variables count:</span>
                    <span className="font-bold font-mono hl-id" style={{ color: "var(--color-paper-2)" }}>{((form.body || "").match(/\{[^{}]+\}/g) || []).length} tags</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Meta Cloud API support:</span>
                    <span className="font-bold" style={{ color: "var(--color-paper-2)" }}>Ready</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between gap-3 px-6 py-4 shrink-0" style={{ borderTop: "1px solid var(--color-rule)", background: "var(--color-paper)" }}>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="hl-btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!form.name || !form.body || saving}
                className="hl-btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                <span>{editing ? "Save Changes" : "Create Template"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}