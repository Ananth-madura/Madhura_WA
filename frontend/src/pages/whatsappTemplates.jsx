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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#25D366]/15 text-[#25D366] flex items-center justify-center shadow-sm">
              <FileText size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-800">WhatsApp Message Templates</h1>
                <span className="text-xs font-semibold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
                  {templates.length} Active Templates
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Create reusable message templates with dynamic CRM placeholders and one-click campaign launch.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleRestorePrebuilt}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white text-emerald-700 border border-emerald-300 rounded-xl hover:bg-emerald-50 transition text-xs font-bold shadow-sm"
          >
            <Sparkles size={14} className="text-emerald-600" />
            <span>Load Prebuilt Templates</span>
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-[#25D366] text-white rounded-xl hover:bg-[#1ebe5d] transition text-xs font-bold shadow-md shadow-[#25D366]/20"
          >
            <Plus size={16} />
            <span>New Template</span>
          </button>
        </div>
      </div>

      {/* Placeholders Quick Reference Bar */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-6 shadow-sm">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <Tag size={15} className="text-[#25D366]" />
            <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">Available Dynamic Placeholders</span>
          </div>
          <span className="text-[11px] text-gray-500 hidden sm:inline">Automatically filled from CRM customer records</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {PLACEHOLDER_ITEMS.map((p) => (
            <div
              key={p.key}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono transition shadow-2xs ${p.color}`}
              title={`${p.desc} — Example: ${p.example}`}
            >
              <span className="font-bold">{p.key}</span>
              <span className="text-[10px] opacity-75 font-sans">({p.label})</span>
            </div>
          ))}
        </div>
      </div>

      {/* Search & Category Filter Tabs */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-200 w-full sm:w-auto overflow-x-auto">
          {["ALL", "MARKETING", "UTILITY", "AUTHENTICATION"].map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                selectedCategory === cat
                  ? "bg-[#25D366] text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
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
            className="w-full px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#25D366]"
          />
        </div>
      </div>

      {/* Templates Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={36} className="animate-spin text-[#25D366]" />
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="text-center py-20 text-gray-400 bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          <FileText size={48} className="mx-auto mb-3 text-gray-300" />
          <p className="text-base font-bold text-gray-700">No Templates Found</p>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            Click "New Template" or "Load Prebuilt Templates" to start creating customized WhatsApp templates.
          </p>
          <button
            onClick={openCreate}
            className="mt-4 px-4 py-2 bg-[#25D366] text-white rounded-xl text-xs font-bold hover:bg-[#1ebe5d] transition inline-flex items-center gap-1.5"
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
                className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition flex flex-col justify-between group"
              >
                {/* Card Header */}
                <div className="p-5 border-b border-gray-100">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h3 className="font-bold text-gray-800 text-sm group-hover:text-emerald-700 transition">
                        {t.name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          t.category === "MARKETING" ? "bg-blue-100 text-blue-700" :
                          t.category === "UTILITY" ? "bg-emerald-100 text-emerald-700" :
                          "bg-purple-100 text-purple-700"
                        }`}>
                          {t.category}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono uppercase bg-gray-100 px-1.5 py-0.5 rounded">
                          {t.language || "en"}
                        </span>
                        {t.header_type && (
                          <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                            {t.header_type}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(t)}
                        className="p-1.5 hover:bg-gray-100 text-gray-500 rounded-lg transition"
                        title="Edit Template"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="p-1.5 hover:bg-red-50 text-red-400 hover:text-red-600 rounded-lg transition"
                        title="Delete Template"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Body Text & Sample Preview */}
                  <div
                    className="bg-gray-50/80 rounded-xl p-3 border border-gray-100 text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed line-clamp-4"
                    title={`Live Sample Preview:\n${preview}`}
                  >
                    {t.body}
                  </div>

                  {t.footer && (
                    <p className="text-[11px] text-gray-400 italic mt-2 truncate">
                      Footer: {t.footer}
                    </p>
                  )}
                </div>

                {/* Card Quick Actions */}
                <div className="p-4 bg-gray-50/50 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-1 text-[11px]">
                    <button
                      onClick={() => copyToClipboard(t.body, t.id)}
                      className="flex items-center gap-1 text-gray-500 hover:text-gray-800 p-1 rounded transition"
                      title="Copy template text"
                    >
                      {copiedId === t.id ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                      <span>{copiedId === t.id ? "Copied!" : "Copy"}</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => navigate("/whatsapp/campaigns")}
                        className="flex items-center gap-1 px-2 py-1 bg-emerald-100/80 text-emerald-800 hover:bg-emerald-200 rounded-lg font-bold transition"
                        title="Launch bulk campaign with this template"
                      >
                        <Send size={11} />
                        <span>Campaign</span>
                      </button>

                      <button
                        onClick={() => navigate("/whatsapp/automations")}
                        className="flex items-center gap-1 px-2 py-1 bg-purple-100/80 text-purple-800 hover:bg-purple-200 rounded-lg font-bold transition"
                        title="Use in CRM automations"
                      >
                        <Zap size={11} />
                        <span>Automation</span>
                      </button>

                      <button
                        onClick={() => navigate("/whatsapp")}
                        className="flex items-center gap-1 px-2 py-1 bg-blue-100/80 text-blue-800 hover:bg-blue-200 rounded-lg font-bold transition"
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
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl border border-gray-100" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <FileText size={16} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-800">{editing ? "Edit Message Template" : "Create New Message Template"}</h2>
                  <p className="text-xs text-gray-500">Add dynamic variable placeholders and preview live WhatsApp appearance</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-xl transition">
                <X size={20} />
              </button>
            </div>

            {/* Modal Body: 2 Columns (Editor + Live Preview) */}
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Form Editor (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Template Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-[#25D366]"
                    placeholder="e.g. appointment_reminder_v1"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Lowercase letters, numbers, and underscores only.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Category</label>
                    <select
                      value={form.category}
                      onChange={e => setForm({ ...form, category: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-[#25D366] bg-white"
                    >
                      <option value="MARKETING">MARKETING</option>
                      <option value="UTILITY">UTILITY</option>
                      <option value="AUTHENTICATION">AUTHENTICATION</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Language</label>
                    <input
                      type="text"
                      value={form.language}
                      onChange={e => setForm({ ...form, language: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#25D366]"
                      placeholder="en"
                    />
                  </div>
                </div>

                {/* Header configuration */}
                <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Header Type</label>
                    <select
                      value={form.header_type}
                      onChange={e => setForm({ ...form, header_type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#25D366] bg-white"
                    >
                      <option value="">None</option>
                      <option value="TEXT">Text Header</option>
                      <option value="IMAGE">Image Header</option>
                      <option value="VIDEO">Video Header</option>
                      <option value="DOCUMENT">Document (PDF)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Header Title / Value</label>
                    <input
                      type="text"
                      value={form.header_value}
                      onChange={e => setForm({ ...form, header_value: e.target.value })}
                      disabled={!form.header_type}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#25D366] disabled:opacity-40"
                      placeholder={form.header_type === "TEXT" ? "Special Announcement" : "URL or Header Caption"}
                    />
                  </div>
                </div>

                {/* Body Textarea with Clickable Placeholders */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold uppercase text-gray-700">Message Body *</label>
                    <span className="text-[10px] text-gray-400 font-mono">{(form.body || "").length} chars</span>
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
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#25D366] bg-white resize-none font-sans leading-relaxed"
                    placeholder="Hello {name}! Thank you for choosing {company}. Your {service} scheduled on {date} at {city} is confirmed."
                  />
                </div>

                {/* Footer Text */}
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Footer (Optional)</label>
                  <input
                    type="text"
                    value={form.footer}
                    onChange={e => setForm({ ...form, footer: e.target.value })}
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#25D366]"
                    placeholder="e.g. Reply STOP to unsubscribe"
                  />
                </div>

                {/* Interactive Buttons */}
                <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Button Type</label>
                    <select
                      value={form.button_type}
                      onChange={e => setForm({ ...form, button_type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#25D366] bg-white"
                    >
                      <option value="">No Buttons</option>
                      <option value="QUICK_REPLY">Quick Reply Buttons</option>
                      <option value="URL">Visit Website URL</option>
                      <option value="PHONE_NUMBER">Call Phone Number</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Buttons Config</label>
                    <input
                      type="text"
                      value={form.buttons}
                      onChange={e => setForm({ ...form, buttons: e.target.value })}
                      disabled={!form.button_type}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-[#25D366] disabled:opacity-40"
                      placeholder='[{"text":"Confirm"},{"text":"Reschedule"}]'
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Live WhatsApp Phone Mockup Preview (5 cols) */}
              <div className="lg:col-span-5 bg-slate-900 rounded-3xl p-4 flex flex-col justify-between border-4 border-slate-800 shadow-xl">
                <div>
                  {/* Phone Mockup Top Bar */}
                  <div className="flex items-center justify-between px-2 py-2 border-b border-slate-800 text-white mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center text-white font-bold text-xs">
                        MT
                      </div>
                      <div>
                        <p className="text-xs font-bold leading-tight">Madhura Tech Customer Care</p>
                        <p className="text-[10px] text-emerald-400">Official Business Account</p>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400">11:30 AM</span>
                  </div>

                  {/* WhatsApp Message Bubble */}
                  <div className="bg-[#E7FFDB] rounded-2xl p-4 shadow-md text-gray-800 text-xs space-y-2 relative border border-emerald-200/60 max-w-full">
                    {/* Header */}
                    {form.header_type && (
                      <div className="font-bold text-emerald-950 text-sm border-b border-emerald-200/50 pb-1.5">
                        {form.header_type === "TEXT" ? (form.header_value || "Header Title") : `[📷 ${form.header_type} Header]`}
                      </div>
                    )}

                    {/* Body text with live preview */}
                    <div className="whitespace-pre-wrap leading-relaxed text-gray-800">
                      {renderPreviewText(form.body)}
                    </div>

                    {/* Footer */}
                    {form.footer && (
                      <div className="text-[10px] text-gray-500 pt-1 border-t border-emerald-200/40 italic">
                        {form.footer}
                      </div>
                    )}

                    {/* Timestamp */}
                    <div className="text-[9px] text-gray-400 text-right">
                      {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} ✓✓
                    </div>
                  </div>

                  {/* Simulated WhatsApp Buttons */}
                  {form.button_type && (
                    <div className="mt-2 space-y-1.5">
                      <div className="bg-white/90 text-[#00A884] py-2 px-3 rounded-xl text-center font-bold text-xs shadow-sm hover:bg-white transition cursor-pointer">
                        {form.button_type === "URL" ? "🌐 Visit Website" : form.button_type === "PHONE_NUMBER" ? "📞 Call Us" : "✅ Confirm Appointment"}
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom live stats */}
                <div className="mt-4 p-3 bg-slate-800/80 rounded-2xl border border-slate-700/50 text-slate-300 text-[11px] space-y-1">
                  <div className="flex items-center justify-between">
                    <span>Variables count:</span>
                    <span className="font-bold text-emerald-400 font-mono">{((form.body || "").match(/\{[^{}]+\}/g) || []).length} tags</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Meta Cloud API support:</span>
                    <span className="font-bold text-teal-300">Ready</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 shrink-0">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-5 py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!form.name || !form.body || saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#25D366] text-white rounded-xl text-xs font-bold hover:bg-[#1ebe5d] disabled:opacity-50 transition shadow-md shadow-[#25D366]/20"
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