import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Users, Plus, Search, RefreshCw, UserCheck, UserX, ShieldOff, Shield,
  Download, Upload, X, Edit2, Phone, Tag, ChevronDown, Loader2, CheckCircle2,
  AlertCircle, FileText, Check, MessageSquare, ArrowUpRight, Filter, Trash2,
  Sparkles
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API } from "../config/api";
import WhatsAppNav from "../components/WhatsAppNav";
import WAContactAvatar from "../components/WAContactAvatar";

const FILTERS = [
  { id: "all", label: "All Contacts", icon: Users },
  { id: "opted_in", label: "Opted In", icon: UserCheck },
  { id: "blocked", label: "Blocked", icon: ShieldOff },
  { id: "unsubscribed", label: "Unsubscribed", icon: UserX },
];

const TAG_COLORS = [
  "hl-badge-info",
  "hl-badge-success",
  "hl-badge-accent",
  "hl-badge-warn",
  "hl-badge-error",
];

function tagColor(tag) {
  if (!tag) return TAG_COLORS[0];
  const idx = Math.abs(tag.charCodeAt(0)) % TAG_COLORS.length;
  return TAG_COLORS[idx];
}

// CSV Export Utility
const exportToCsv = (filename, headers, rows) => {
  if (!rows || !rows.length) {
    alert("No contacts available to export.");
    return;
  }
  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => {
          let val = row[header] ?? "";
          if (Array.isArray(val)) val = val.join("; ");
          const str = String(val).replace(/"/g, '""');
          return `"${str}"`;
        })
        .join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}_${new Date().toISOString().split("T")[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

function StatCard({ label, value, color, icon: Icon }) {
  return (
    <div className="hl-kpi flex items-center gap-4">
      <div className="w-12 h-12 flex items-center justify-center" style={{ borderRadius: "var(--radius-card)", background: "var(--color-paper)", border: "1px solid var(--color-rule)", color: "var(--color-ink)" }}>
        <Icon size={22} />
      </div>
      <div>
        <p className="hl-kpi-num">{value?.toLocaleString() ?? 0}</p>
        <p className="hl-kpi-label">{label}</p>
      </div>
    </div>
  );
}

export default function WhatsAppContacts() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [stats, setStats] = useState({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editContact, setEditContact] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [form, setForm] = useState({ name: "", phone: "", country_code: "91", email: "", tags: "", notes: "", opt_in_status: 1 });

  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [csvPreview, setCsvPreview] = useState([]);
  const [csvUploading, setCsvUploading] = useState(false);

  const fileInputRef = useRef(null);

  const token = () => localStorage.getItem("token");
  const headers = () => ({ Authorization: `Bearer ${token()}` });

  const fetchContacts = useCallback(async (p = page, f = filter, s = search) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, limit: 50, ...(f !== "all" && { filter: f }), ...(s && { search: s }) });
      const { data } = await axios.get(`${API}/api/wa/contacts?${params}`, { headers: headers() });
      setContacts(data.contacts || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch {}
    setLoading(false);
  }, [page, filter, search]);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/api/wa/contacts/stats/summary`, { headers: headers() });
      setStats(data || {});
    } catch {}
  }, []);

  useEffect(() => {
    fetchContacts(1, filter, search);
    fetchStats();
  }, [filter]);

  useEffect(() => {
    const t = setTimeout(() => {
      fetchContacts(1, filter, search);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const openCreate = () => {
    setEditContact(null);
    setForm({ name: "", phone: "", country_code: "91", email: "", tags: "", notes: "", opt_in_status: 1 });
    setShowModal(true);
  };

  const openEdit = (c) => {
    setEditContact(c);
    setForm({
      name: c.name,
      phone: c.phone,
      country_code: c.country_code || "91",
      email: c.email || "",
      tags: Array.isArray(c.tags) ? c.tags.join(", ") : (typeof c.tags === "string" ? c.tags : ""),
      notes: c.notes || "",
      opt_in_status: c.opt_in_status ? 1 : 0,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.phone) return;
    const tagsArr = form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [];
    const payload = { ...form, tags: tagsArr };
    try {
      if (editContact) {
        await axios.put(`${API}/api/wa/contacts/${editContact.id}`, payload, { headers: headers() });
      } else {
        await axios.post(`${API}/api/wa/contacts`, payload, { headers: headers() });
      }
      setShowModal(false);
      fetchContacts(page, filter, search);
      fetchStats();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to save contact");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this contact permanently?")) return;
    await axios.delete(`${API}/api/wa/contacts/${id}`, { headers: headers() });
    fetchContacts(page, filter, search);
    fetchStats();
  };

  const handleBlock = async (id, blocked) => {
    setActionLoading(id);
    await axios.post(`${API}/api/wa/contacts/${id}/${blocked ? "unblock" : "block"}`, {}, { headers: headers() });
    setActionLoading(null);
    fetchContacts(page, filter, search);
    fetchStats();
  };

  const handleImport = async (source) => {
    setImporting(true);
    setImportResult(null);
    try {
      const { data } = await axios.post(`${API}/api/wa/contacts/bulk-import`, { source }, { headers: headers() });
      setImportResult(data);
      fetchContacts(1, filter, search);
      fetchStats();
    } catch (err) {
      setImportResult({ error: err.response?.data?.error || "Import failed" });
    }
    setImporting(false);
  };

  const [syncingPics, setSyncingPics] = useState(false);
  const handleSyncProfilePics = async () => {
    setSyncingPics(true);
    try {
      const { data } = await axios.post(`${API}/api/whatsapp/sync-profile-pics`, {}, { headers: headers() });
      fetchContacts(1, filter, search);
      alert(`Synced ${data.syncedCount || 0} profile photos from WhatsApp!`);
    } catch (err) {
      alert("Failed to sync profile photos: " + (err.response?.data?.error || err.message));
    }
    setSyncingPics(false);
  };

  const handleSyncWhatsAppContacts = async () => {
    setImporting(true);
    setImportResult(null);
    try {
      const { data } = await axios.post(`${API}/api/whatsapp/sync-contacts`, {}, { headers: headers() });
      if (data.success) {
        setImportResult({ inserted: data.inserted || 0, skipped: (data.count || 0) - (data.inserted || 0) });
      } else {
        setImportResult({ error: data.message || data.error || "Sync failed" });
      }
      fetchContacts(1, filter, search);
      fetchStats();
    } catch (err) {
      setImportResult({ error: err.response?.data?.error || "Sync failed" });
    }
    setImporting(false);
  };

  // CSV File Upload Parser
  const handleCsvFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (lines.length < 2) return;

      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));
      const nameIdx = headers.findIndex((h) => h.includes("name"));
      const phoneIdx = headers.findIndex((h) => h.includes("phone") || h.includes("mobile") || h.includes("contact"));
      const emailIdx = headers.findIndex((h) => h.includes("email"));
      const tagsIdx = headers.findIndex((h) => h.includes("tag"));
      const notesIdx = headers.findIndex((h) => h.includes("note"));

      const parsed = [];
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(",").map((p) => p.trim().replace(/^["']|["']$/g, ""));
        const phone = phoneIdx !== -1 ? parts[phoneIdx] : parts[1] || parts[0];
        const name = nameIdx !== -1 ? parts[nameIdx] : parts[0];
        if (phone) {
          parsed.push({
            name: name || "Contact",
            phone: phone.replace(/\D/g, "").slice(-10),
            email: emailIdx !== -1 ? parts[emailIdx] : "",
            tags: tagsIdx !== -1 ? parts[tagsIdx] : "",
            notes: notesIdx !== -1 ? parts[notesIdx] : "",
          });
        }
      }
      setCsvPreview(parsed.slice(0, 10));
    };
    reader.readAsText(file);
  };

  const handleUploadParsedCsv = async () => {
    if (!csvFile) return;
    setCsvUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result;
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));
      const nameIdx = headers.findIndex((h) => h.includes("name"));
      const phoneIdx = headers.findIndex((h) => h.includes("phone") || h.includes("mobile") || h.includes("contact"));
      const emailIdx = headers.findIndex((h) => h.includes("email"));
      const tagsIdx = headers.findIndex((h) => h.includes("tag"));
      const notesIdx = headers.findIndex((h) => h.includes("note"));

      const contactsToUpload = [];
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(",").map((p) => p.trim().replace(/^["']|["']$/g, ""));
        const phone = phoneIdx !== -1 ? parts[phoneIdx] : parts[1] || parts[0];
        const name = nameIdx !== -1 ? parts[nameIdx] : parts[0];
        const cleanPhone = (phone || "").replace(/\D/g, "").slice(-10);
        if (cleanPhone.length === 10) {
          contactsToUpload.push({
            name: name || "Contact",
            phone: cleanPhone,
            country_code: "91",
            email: emailIdx !== -1 ? parts[emailIdx] : null,
            tags: tagsIdx !== -1 ? parts[tagsIdx] : null,
            notes: notesIdx !== -1 ? parts[notesIdx] : null,
            source: "CSV Import",
          });
        }
      }

      try {
        const { data } = await axios.post(`${API}/api/wa/contacts/bulk-import`, { contacts: contactsToUpload }, { headers: headers() });
        setImportResult(data);
        setShowCsvModal(false);
        setCsvFile(null);
        setCsvPreview([]);
        fetchContacts(1, filter, search);
        fetchStats();
      } catch (err) {
        alert(err.response?.data?.error || "CSV upload failed");
      }
      setCsvUploading(false);
    };
    reader.readAsText(csvFile);
  };

  return (
    <div className="hl-page" style={{ background: "var(--color-paper)", fontFamily: "var(--font-body)" }}>
      <WhatsAppNav />

      {/* Header Banner */}
      <div className="hl-commandbar hl-card flex-col md:flex-row md:items-center gap-3" style={{ padding: "var(--space-sm)" }}>
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 flex items-center justify-center" style={{ borderRadius: "var(--radius-card)", background: "var(--color-ink)", color: "var(--color-paper-2)", fontFamily: "var(--font-display)" }}>
            <UserCheck size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="hl-title">WhatsApp Contacts Manager</h1>
              <span className="hl-badge">
                {total.toLocaleString()} Contacts
              </span>
            </div>
            <p className="hl-subtitle">
              Sync, import, tag, and manage customer phone numbers with opt-in status compliance.
            </p>
          </div>
        </div>

        <div className="hl-actions flex items-center flex-wrap">
          <button
            onClick={handleSyncWhatsAppContacts}
            disabled={importing}
            className="hl-btn-secondary"
            title="Sync all contacts directly from connected WhatsApp phone"
          >
            {importing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            <span>Sync from WhatsApp</span>
          </button>

          <button
            onClick={handleSyncProfilePics}
            disabled={syncingPics}
            className="hl-btn-secondary"
            title="Fetch real WhatsApp profile photos for all contacts"
          >
            {syncingPics ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            <span>Sync Profile Photos</span>
          </button>

          {/* CRM Import Dropdown */}
          <div className="relative group">
            <button
              disabled={importing}
              className="hl-btn-secondary"
            >
              {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              <span>Import from CRM</span>
              <ChevronDown size={12} />
            </button>
            <div className="hl-card absolute right-0 top-full z-20 w-48 hidden group-hover:block" style={{ padding: "var(--space-3xs)", marginTop: "var(--space-3xs)" }}>
              {[
                { key: "all", label: "✨ All CRM Sources" },
                { key: "clients", label: "💼 Clients (Accounts)" },
                { key: "telecalls", label: "📞 Telecalling Leads" },
                { key: "walkins", label: "🚶 Walkin Leads" },
                { key: "fields", label: "📍 Field Visits" },
              ].map((src) => (
                <button
                  key={src.key}
                  onClick={() => handleImport(src.key === "all" ? null : src.key)}
                  className="block w-full px-3 py-2 text-left"
                  style={{ color: "var(--color-ink)", fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", fontWeight: 600 }}
                >
                  {src.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => setShowCsvModal(true)}
            className="hl-btn-secondary"
          >
            <FileText size={14} />
            <span>Upload CSV</span>
          </button>

          <button
            onClick={() =>
              exportToCsv(
                "WhatsApp_Contacts_Export",
                ["name", "phone", "country_code", "email", "tags", "opt_in_status", "is_blocked", "is_unsubscribed", "source", "notes", "created_at"],
                contacts
              )
            }
            className="hl-btn-secondary"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>

          <button
            onClick={openCreate}
            className="hl-btn-primary"
          >
            <Plus size={15} />
            <span>Add Contact</span>
          </button>
        </div>
      </div>

      {/* Import Result Alert */}
      {importResult && (
        <div
          className="hl-card flex items-center justify-between"
          style={{ padding: "var(--space-xs)", marginBottom: "var(--space-sm)", borderColor: importResult.error ? "var(--color-error)" : "var(--color-success)", color: importResult.error ? "var(--color-error)" : "var(--color-success)", fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", fontWeight: 600 }}
        >
          <div className="flex items-center gap-2">
            {importResult.error ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            <span>
              {importResult.error || `Successfully imported ${importResult.inserted} contacts (${importResult.skipped} duplicates skipped).`}
            </span>
          </div>
          <button onClick={() => setImportResult(null)} className="p-1" style={{ color: "inherit" }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Stats Summary Cards */}
      <div className="hl-kpis">
        <StatCard label="Total Contacts" value={stats.total} color="hl-badge" icon={Users} />
        <StatCard label="Opted-In" value={stats.opted_in} color="hl-badge-success" icon={UserCheck} />
        <StatCard label="Blocked" value={stats.blocked} color="hl-badge-error" icon={ShieldOff} />
        <StatCard label="Unsubscribed" value={stats.unsubscribed} color="hl-badge-warn" icon={UserX} />
        <StatCard label="Opt-Out Requests" value={stats.opt_outs} color="hl-badge-info" icon={AlertCircle} />
      </div>

      {/* Filter & Search Bar */}
      <div className="hl-card flex flex-wrap items-center justify-between gap-2" style={{ padding: "var(--space-xs)", marginBottom: "var(--space-sm)" }}>
        <div className="hl-tabs flex items-center w-full sm:w-auto sm:flex-1 min-w-0 overflow-x-auto">
          {FILTERS.map((f) => {
            const Icon = f.icon;
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => {
                  setFilter(f.id);
                  setPage(1);
                }}
                className={`hl-tab flex items-center ${active ? "is-active" : ""}`}
              >
                <Icon size={13} />
                <span>{f.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto flex-1 sm:flex-none min-w-0">
          <div className="hl-input flex items-center gap-2 flex-1 min-w-0 sm:flex-none" style={{ display: "flex", alignItems: "center" }}>
            <Search size={14} className="shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, phone, email..."
              className="w-full sm:w-52 min-w-0"
              style={{ background: "transparent", border: "none", outline: "none", fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", color: "var(--color-ink)", minHeight: "auto", padding: 0 }}
            />
            {search && (
              <button onClick={() => setSearch("")} className="flex items-center shrink-0" style={{ color: "var(--color-ink-2)" }}>
                <X size={12} />
              </button>
            )}
          </div>

          <button
            onClick={() => fetchContacts(page, filter, search)}
            className="hl-btn-secondary shrink-0"
            title="Refresh list"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Contacts Table */}
      <div className="hl-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="hl-table w-full min-w-[640px]">
            <thead>
              <tr>
                <th className="text-left">Contact Profile</th>
                <th className="text-left">Phone Number</th>
                <th className="text-left">Tags</th>
                <th className="text-center">Status</th>
                <th className="text-left">Source</th>
                <th className="text-left">Last Contacted</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center" style={{ padding: "var(--space-xl)" }}>
                    <Loader2 size={32} className="animate-spin mx-auto" style={{ color: "var(--color-ink)" }} />
                  </td>
                </tr>
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="hl-empty">
                    <UserCheck size={44} className="mx-auto mb-2" style={{ color: "var(--color-ink-2)" }} />
                    <p className="hl-empty-title">No contacts found matching filter</p>
                    <p className="hl-subtitle">Click "Import from CRM" or "Add Contact" to populate.</p>
                  </td>
                </tr>
              ) : (
                contacts.map((c) => {
                  let tags = [];
                  if (Array.isArray(c.tags)) {
                    tags = c.tags;
                  } else if (typeof c.tags === "string" && c.tags.trim()) {
                    try {
                      tags = JSON.parse(c.tags);
                    } catch {
                      tags = c.tags.split(",").map((t) => t.trim());
                    }
                  }

                  return (
                    <tr key={c.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <WAContactAvatar
                            src={c.profile_pic_url || c.avatar_url}
                            name={c.name}
                            phone={c.phone}
                            size="sm"
                            clickable={true}
                          />
                          <div>
                            <p className="font-bold" style={{ color: "var(--color-ink)", fontFamily: "var(--font-body)" }}>{c.name}</p>
                            {c.email && <p className="hl-id">{c.email}</p>}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="hl-id">
                          +{c.country_code || "91"} {c.phone}
                        </span>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {tags.slice(0, 3).map((t, idx) => (
                            <span key={idx} className={`hl-badge ${tagColor(t)}`}>
                              {t}
                            </span>
                          ))}
                          {tags.length > 3 && (
                            <span className="hl-badge">+{tags.length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td className="text-center">
                        {c.is_blocked ? (
                          <span className="hl-badge hl-badge-error">
                            <ShieldOff size={10} /> Blocked
                          </span>
                        ) : c.is_unsubscribed ? (
                          <span className="hl-badge hl-badge-warn">
                            <UserX size={10} /> Opted Out
                          </span>
                        ) : c.opt_in_status ? (
                          <span className="hl-badge hl-badge-success">
                            <UserCheck size={10} /> Opted In
                          </span>
                        ) : (
                          <span className="hl-badge">
                            No Consent
                          </span>
                        )}
                      </td>
                      <td style={{ color: "var(--color-ink-2)", fontFamily: "var(--font-body)" }}>{c.source || "Direct"}</td>
                      <td style={{ color: "var(--color-ink-2)", fontFamily: "var(--font-body)" }}>
                        {c.last_contacted ? new Date(c.last_contacted).toLocaleDateString("en-IN") : "Never"}
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => navigate(`/whatsapp?phone=${c.phone}`)}
                            className="p-1.5 flex items-center"
                            style={{ color: "var(--color-ink)" }}
                            title="Open in WhatsApp Live Chat"
                          >
                            <MessageSquare size={14} />
                          </button>
                          <button
                            onClick={() => openEdit(c)}
                            className="p-1.5 flex items-center"
                            style={{ color: "var(--color-ink-2)" }}
                            title="Edit Contact"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleBlock(c.id, c.is_blocked)}
                            disabled={actionLoading === c.id}
                            className="p-1.5 flex items-center"
                            style={{ color: c.is_blocked ? "var(--color-success)" : "var(--color-error)" }}
                            title={c.is_blocked ? "Unblock Contact" : "Block Contact"}
                          >
                            {actionLoading === c.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : c.is_blocked ? (
                              <Shield size={14} />
                            ) : (
                              <ShieldOff size={14} />
                            )}
                          </button>
                          <button
                            onClick={() => handleDelete(c.id)}
                            className="hl-btn-danger-ghost"
                            style={{ padding: "0.375rem 0.5rem" }}
                            title="Delete Contact"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between" style={{ padding: "var(--space-xs) var(--space-sm)", borderTop: "1px solid var(--color-rule)", background: "var(--color-paper)" }}>
            <p className="hl-subtitle">
              Page {page} of {totalPages} ({total} contacts)
            </p>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => {
                  setPage((p) => p - 1);
                  fetchContacts(page - 1, filter, search);
                }}
                className="hl-btn-secondary"
              >
                ← Prev
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => {
                  setPage((p) => p + 1);
                  fetchContacts(page + 1, filter, search);
                }}
                className="hl-btn-secondary"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Contact Modal */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: "color-mix(in srgb, var(--color-shell) 60%, transparent)" }} onClick={() => setShowModal(false)}>
          <div className="hl-card w-full max-w-lg flex flex-col overflow-hidden" style={{ maxHeight: "92dvh" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between shrink-0" style={{ padding: "var(--space-sm)", background: "var(--color-ink)", color: "var(--color-paper-2)" }}>
              <div>
                <h2 className="hl-title" style={{ color: "var(--color-paper-2)", fontSize: "var(--text-md)" }}>{editContact ? "Edit Contact" : "Add WhatsApp Contact"}</h2>
                <p className="hl-subtitle" style={{ color: "var(--color-paper-2)", opacity: 0.8 }}>Save customer profile for bulk campaigns and automations</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1.5 flex items-center" style={{ color: "var(--color-paper-2)" }}>
                <X size={18} />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 min-h-0 wa-custom-scrollbar overscroll-contain" style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-sm)" }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="hl-section-label block mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="hl-input w-full"
                    placeholder="Customer Name"
                  />
                </div>
                <div>
                  <label className="hl-section-label block mb-1">Phone Number * (10 Digits)</label>
                  <div className="flex items-center gap-1.5">
                    <span className="hl-badge">+91</span>
                    <input
                      type="text"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="hl-input flex-1"
                      placeholder="9876543210"
                      maxLength={10}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="hl-section-label block mb-1">Email Address</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="hl-input w-full"
                  placeholder="client@example.com"
                />
              </div>

              <div>
                <label className="hl-section-label block mb-1">Tags (Comma-separated)</label>
                <div className="hl-input flex items-center gap-2">
                  <Tag size={14} />
                  <input
                    type="text"
                    value={form.tags}
                    onChange={(e) => setForm({ ...form, tags: e.target.value })}
                    className="flex-1"
                    style={{ background: "transparent", border: "none", outline: "none", fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", color: "var(--color-ink)", minHeight: "auto", padding: 0 }}
                    placeholder="VIP, AMC Client, Chennai..."
                  />
                </div>
              </div>

              <div>
                <label className="hl-section-label block mb-1">Notes / Remarks</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="hl-input w-full resize-none"
                  placeholder="Optional internal remarks..."
                />
              </div>

              <div className="hl-card flex items-center justify-between" style={{ padding: "var(--space-xs)" }}>
                <div>
                  <p className="font-bold" style={{ color: "var(--color-ink)", fontFamily: "var(--font-body)" }}>WhatsApp Opt-in Consent</p>
                  <p className="hl-subtitle">Contact has agreed to receive messages</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, opt_in_status: form.opt_in_status ? 0 : 1 })}
                  className={`hl-badge ${form.opt_in_status ? "hl-badge-success" : ""}`}
                >
                  {form.opt_in_status ? "✓ Opted In" : "✗ No Consent"}
                </button>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="hl-btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!form.name || !form.phone}
                  className="hl-btn-primary flex-1"
                >
                  {editContact ? "Save Changes" : "Create Contact"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showCsvModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: "color-mix(in srgb, var(--color-shell) 60%, transparent)" }} onClick={() => setShowCsvModal(false)}>
          <div className="hl-card w-full max-w-lg flex flex-col overflow-hidden" style={{ maxHeight: "92dvh" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between shrink-0" style={{ padding: "var(--space-sm)", background: "var(--color-ink)", color: "var(--color-paper-2)" }}>
              <div>
                <h2 className="hl-title" style={{ color: "var(--color-paper-2)", fontSize: "var(--text-md)" }}>Import Contacts from CSV / Excel</h2>
                <p className="hl-subtitle" style={{ color: "var(--color-paper-2)", opacity: 0.8 }}>Upload a CSV file containing Name and Phone numbers</p>
              </div>
              <button onClick={() => setShowCsvModal(false)} className="p-1.5 flex items-center" style={{ color: "var(--color-paper-2)" }}>
                <X size={18} />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 min-h-0 wa-custom-scrollbar overscroll-contain" style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-sm)" }}>
              <div className="hl-card p-6 text-center cursor-pointer" style={{ borderStyle: "dashed", padding: "var(--space-md)" }} onClick={() => fileInputRef.current?.click()}>
                <Upload size={32} className="mx-auto mb-2" style={{ color: "var(--color-ink)" }} />
                <p className="font-bold" style={{ color: "var(--color-ink)", fontFamily: "var(--font-body)" }}>Click to select CSV File</p>
                <p className="hl-subtitle">Columns: Name, Phone (10 digits), Email, Tags, Notes</p>
                <input ref={fileInputRef} type="file" accept=".csv" onChange={handleCsvFileChange} className="hidden" />
              </div>

              {csvFile && (
                <div className="hl-card flex items-center justify-between" style={{ padding: "var(--space-xs)" }}>
                  <div className="flex items-center gap-2">
                    <FileText size={16} style={{ color: "var(--color-ink)" }} />
                    <span className="font-bold" style={{ color: "var(--color-ink)", fontFamily: "var(--font-body)" }}>{csvFile.name}</span>
                  </div>
                  <span className="hl-id">{Math.round(csvFile.size / 1024)} KB</span>
                </div>
              )}

              {csvPreview.length > 0 && (
                <div>
                  <p className="hl-section-label mb-1.5">Preview (First {csvPreview.length} contacts):</p>
                  <div className="hl-card max-h-40 overflow-y-auto" style={{ padding: 0 }}>
                    {csvPreview.map((item, i) => (
                      <div key={i} className="p-2 flex justify-between items-center" style={{ borderBottom: "1px solid var(--color-rule)" }}>
                        <span className="font-bold" style={{ color: "var(--color-ink)", fontFamily: "var(--font-body)" }}>{item.name}</span>
                        <span className="hl-id">+{item.phone}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCsvModal(false)}
                  className="hl-btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUploadParsedCsv}
                  disabled={!csvFile || csvUploading}
                  className="hl-btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {csvUploading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  <span>{csvUploading ? "Importing..." : "Start Import"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
