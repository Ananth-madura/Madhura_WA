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
  "bg-blue-100 text-blue-700 border-blue-200",
  "bg-emerald-100 text-emerald-700 border-emerald-200",
  "bg-purple-100 text-purple-700 border-purple-200",
  "bg-amber-100 text-amber-700 border-amber-200",
  "bg-rose-100 text-rose-700 border-rose-200",
  "bg-teal-100 text-teal-700 border-teal-200",
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
    <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${color} shadow-sm`}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-2xl font-black text-gray-900 tracking-tight">{value?.toLocaleString() ?? 0}</p>
        <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">{label}</p>
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
    <div className="w-full pb-12 bg-slate-50/50 min-h-screen">
      <WhatsAppNav />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#25D366] to-emerald-700 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
            <UserCheck size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-gray-900">WhatsApp Contacts Manager</h1>
              <span className="text-xs font-bold bg-emerald-50 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-200">
                {total.toLocaleString()} Contacts
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Sync, import, tag, and manage customer phone numbers with opt-in status compliance.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleSyncWhatsAppContacts}
            disabled={importing}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition text-xs font-bold shadow-sm disabled:opacity-50"
            title="Sync all contacts directly from connected WhatsApp phone"
          >
            {importing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            <span>Sync from WhatsApp</span>
          </button>

          <button
            onClick={handleSyncProfilePics}
            disabled={syncingPics}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-xl hover:bg-purple-100 transition text-xs font-bold shadow-sm disabled:opacity-50"
            title="Fetch real WhatsApp profile photos for all contacts"
          >
            {syncingPics ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            <span>Sync Profile Photos</span>
          </button>

          {/* CRM Import Dropdown */}
          <div className="relative group">
            <button
              disabled={importing}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition text-xs font-bold shadow-sm disabled:opacity-50"
            >
              {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              <span>Import from CRM</span>
              <ChevronDown size={12} />
            </button>
            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-2xl shadow-xl z-20 w-48 hidden group-hover:block p-1">
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
                  className="block w-full px-3 py-2 text-left text-xs font-semibold text-gray-700 hover:bg-slate-50 rounded-xl transition"
                >
                  {src.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => setShowCsvModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-gray-700 rounded-xl text-xs font-bold transition shadow-sm"
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
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-gray-700 rounded-xl text-xs font-bold transition shadow-sm"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>

          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#25D366] text-white rounded-xl hover:bg-[#1ebe5d] transition text-xs font-bold shadow-md shadow-[#25D366]/20"
          >
            <Plus size={15} />
            <span>Add Contact</span>
          </button>
        </div>
      </div>

      {/* Import Result Alert */}
      {importResult && (
        <div
          className={`mb-6 p-4 rounded-2xl text-xs font-semibold flex items-center justify-between border shadow-sm ${
            importResult.error
              ? "bg-rose-50 border-rose-200 text-rose-800"
              : "bg-emerald-50 border-emerald-200 text-emerald-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {importResult.error ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            <span>
              {importResult.error || `Successfully imported ${importResult.inserted} contacts (${importResult.skipped} duplicates skipped).`}
            </span>
          </div>
          <button onClick={() => setImportResult(null)} className="p-1 hover:bg-emerald-100 rounded-lg">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 mb-6">
        <StatCard label="Total Contacts" value={stats.total} color="bg-gray-100 text-gray-600" icon={Users} />
        <StatCard label="Opted-In" value={stats.opted_in} color="bg-emerald-100 text-emerald-700" icon={UserCheck} />
        <StatCard label="Blocked" value={stats.blocked} color="bg-rose-100 text-rose-700" icon={ShieldOff} />
        <StatCard label="Unsubscribed" value={stats.unsubscribed} color="bg-amber-100 text-amber-700" icon={UserX} />
        <StatCard label="Opt-Out Requests" value={stats.opt_outs} color="bg-purple-100 text-purple-700" icon={AlertCircle} />
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-gray-200/80 shadow-sm mb-5">
        <div className="flex items-center gap-1.5 overflow-x-auto">
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
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                  active
                    ? "bg-[#25D366] text-white shadow-sm font-extrabold"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <Icon size={13} />
                <span>{f.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs text-gray-700 focus-within:ring-2 focus-within:ring-[#25D366]/20">
            <Search size={14} className="text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, phone, email..."
              className="bg-transparent outline-none text-xs w-52"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-gray-400 hover:text-gray-600">
                <X size={12} />
              </button>
            )}
          </div>

          <button
            onClick={() => fetchContacts(page, filter, search)}
            className="p-2 hover:bg-slate-100 rounded-xl border border-gray-200 text-gray-600 shadow-sm transition"
            title="Refresh list"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-emerald-600" : ""} />
          </button>
        </div>
      </div>

      {/* Contacts Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-gray-200 text-gray-600 font-bold">
              <tr>
                <th className="px-4 py-3 text-left">Contact Profile</th>
                <th className="px-4 py-3 text-left">Phone Number</th>
                <th className="px-4 py-3 text-left">Tags</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-left">Source</th>
                <th className="px-4 py-3 text-left">Last Contacted</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <Loader2 size={32} className="animate-spin text-[#25D366] mx-auto" />
                  </td>
                </tr>
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-gray-400">
                    <UserCheck size={44} className="mx-auto mb-2 text-gray-300" />
                    <p className="font-bold text-gray-600">No contacts found matching filter</p>
                    <p className="text-[11px] mt-0.5">Click "Import from CRM" or "Add Contact" to populate.</p>
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
                    <tr key={c.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <WAContactAvatar
                            src={c.profile_pic_url || c.avatar_url}
                            name={c.name}
                            phone={c.phone}
                            size="sm"
                            clickable={true}
                          />
                          <div>
                            <p className="font-bold text-gray-900">{c.name}</p>
                            {c.email && <p className="text-[11px] text-gray-400">{c.email}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-gray-800 font-semibold">
                          +{c.country_code || "91"} {c.phone}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {tags.slice(0, 3).map((t, idx) => (
                            <span key={idx} className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${tagColor(t)}`}>
                              {t}
                            </span>
                          ))}
                          {tags.length > 3 && (
                            <span className="text-[10px] text-gray-400 font-bold px-1">+{tags.length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {c.is_blocked ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                            <ShieldOff size={10} /> Blocked
                          </span>
                        ) : c.is_unsubscribed ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            <UserX size={10} /> Opted Out
                          </span>
                        ) : c.opt_in_status ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <UserCheck size={10} /> Opted In
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            No Consent
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 font-medium">{c.source || "Direct"}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {c.last_contacted ? new Date(c.last_contacted).toLocaleDateString("en-IN") : "Never"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => navigate(`/whatsapp?phone=${c.phone}`)}
                            className="p-1.5 hover:bg-emerald-50 text-emerald-600 hover:text-emerald-700 rounded-lg transition"
                            title="Open in WhatsApp Live Chat"
                          >
                            <MessageSquare size={14} />
                          </button>
                          <button
                            onClick={() => openEdit(c)}
                            className="p-1.5 hover:bg-slate-100 text-gray-500 hover:text-gray-700 rounded-lg transition"
                            title="Edit Contact"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleBlock(c.id, c.is_blocked)}
                            disabled={actionLoading === c.id}
                            className={`p-1.5 rounded-lg transition ${
                              c.is_blocked ? "hover:bg-emerald-50 text-emerald-600" : "hover:bg-rose-50 text-rose-500"
                            }`}
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
                            className="p-1.5 hover:bg-rose-50 text-rose-400 hover:text-rose-600 rounded-lg transition"
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
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-slate-50/50">
            <p className="text-xs text-gray-500 font-medium">
              Page {page} of {totalPages} ({total} contacts)
            </p>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => {
                  setPage((p) => p - 1);
                  fetchContacts(page - 1, filter, search);
                }}
                className="px-3.5 py-1.5 text-xs font-bold bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40 shadow-sm"
              >
                ← Prev
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => {
                  setPage((p) => p + 1);
                  fetchContacts(page + 1, filter, search);
                }}
                className="px-3.5 py-1.5 text-xs font-bold bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40 shadow-sm"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Contact Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-[#25D366] to-emerald-700 p-5 text-white flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-base font-bold">{editContact ? "Edit Contact" : "Add WhatsApp Contact"}</h2>
                <p className="text-xs text-emerald-100 mt-0.5">Save customer profile for bulk campaigns and automations</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-white/20 rounded-full transition">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-gray-700 uppercase mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#25D366]"
                    placeholder="Customer Name"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 uppercase mb-1">Phone Number * (10 Digits)</label>
                  <div className="flex items-center gap-1.5">
                    <span className="px-2.5 py-2 bg-slate-100 border border-gray-200 rounded-xl font-bold text-gray-600">+91</span>
                    <input
                      type="text"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="flex-1 px-3.5 py-2 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#25D366]"
                      placeholder="9876543210"
                      maxLength={10}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase mb-1">Email Address</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#25D366]"
                  placeholder="client@example.com"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase mb-1">Tags (Comma-separated)</label>
                <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl">
                  <Tag size={14} className="text-gray-400" />
                  <input
                    type="text"
                    value={form.tags}
                    onChange={(e) => setForm({ ...form, tags: e.target.value })}
                    className="flex-1 text-xs outline-none bg-transparent"
                    placeholder="VIP, AMC Client, Chennai..."
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase mb-1">Notes / Remarks</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#25D366] resize-none"
                  placeholder="Optional internal remarks..."
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border">
                <div>
                  <p className="font-bold text-gray-800">WhatsApp Opt-in Consent</p>
                  <p className="text-[11px] text-gray-500">Contact has agreed to receive messages</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, opt_in_status: form.opt_in_status ? 0 : 1 })}
                  className={`px-3.5 py-1.5 rounded-full font-bold transition text-xs ${
                    form.opt_in_status
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {form.opt_in_status ? "✓ Opted In" : "✗ No Consent"}
                </button>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!form.name || !form.phone}
                  className="flex-1 py-2.5 bg-[#25D366] text-white rounded-xl font-bold hover:bg-[#1ebe5d] disabled:opacity-50 transition shadow-md shadow-[#25D366]/20"
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowCsvModal(false)}>
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-5 text-white flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-base font-bold">Import Contacts from CSV / Excel</h2>
                <p className="text-xs text-blue-100 mt-0.5">Upload a CSV file containing Name and Phone numbers</p>
              </div>
              <button onClick={() => setShowCsvModal(false)} className="p-1.5 hover:bg-white/20 rounded-full transition">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
              <div className="border-2 border-dashed border-gray-300 rounded-2xl p-6 text-center hover:border-blue-500 transition cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <Upload size={32} className="mx-auto text-blue-500 mb-2" />
                <p className="font-bold text-gray-800">Click to select CSV File</p>
                <p className="text-[11px] text-gray-500 mt-1">Columns: Name, Phone (10 digits), Email, Tags, Notes</p>
                <input ref={fileInputRef} type="file" accept=".csv" onChange={handleCsvFileChange} className="hidden" />
              </div>

              {csvFile && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-blue-600" />
                    <span className="font-bold text-blue-900">{csvFile.name}</span>
                  </div>
                  <span className="text-[11px] text-blue-700 font-semibold">{Math.round(csvFile.size / 1024)} KB</span>
                </div>
              )}

              {csvPreview.length > 0 && (
                <div>
                  <p className="font-bold text-gray-700 mb-1.5">Preview (First {csvPreview.length} contacts):</p>
                  <div className="max-h-40 overflow-y-auto border rounded-xl divide-y">
                    {csvPreview.map((item, i) => (
                      <div key={i} className="p-2 flex justify-between items-center text-[11px]">
                        <span className="font-bold text-gray-800">{item.name}</span>
                        <span className="font-mono text-gray-600">+{item.phone}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCsvModal(false)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUploadParsedCsv}
                  disabled={!csvFile || csvUploading}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition shadow-md shadow-blue-500/20 flex items-center justify-center gap-2"
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
