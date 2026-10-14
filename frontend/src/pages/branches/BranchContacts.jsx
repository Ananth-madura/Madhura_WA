import React, { useState, useEffect, useCallback } from "react";
import {
  Contact,
  UserPlus,
  Search,
  Phone,
  Mail,
  Tag,
  Download,
  AlertCircle,
  MoreVertical,
  ExternalLink,
  MessageSquare,
  ArrowRightLeft,
  Trash2,
  CheckCircle2,
  X,
  Building,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useBranch } from "../../context/BranchContext";
import {
  getBranchContacts,
  createBranchContact,
  transferBranchContact,
} from "../../api/branches";
import api from "../../config/axios";

export default function BranchContacts() {
  const { activeBranch, accessibleBranches, can } = useBranch();
  const navigate = useNavigate();

  const [contacts, setContacts] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState(null);

  // New Contact Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    tags: "",
    notes: "",
  });
  const [createLoading, setCreateLoading] = useState(false);

  // Transfer Contact Modal
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [selectedContactToTransfer, setSelectedContactToTransfer] = useState(null);
  const [targetBranchId, setTargetBranchId] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [transferLoading, setTransferLoading] = useState(false);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchContacts = useCallback(async () => {
    if (!activeBranch?.id) return;
    try {
      setLoading(true);
      const res = await getBranchContacts(activeBranch.id, {
        search: search.trim() || undefined,
      });

      if (res?.success) {
        setContacts(res.contacts || []);
        setTotalCount(res.total || 0);
      } else {
        // Fallback to wa/contacts query
        const fallback = await api
          .get(`/api/wa/contacts?branchId=${activeBranch.id}&search=${encodeURIComponent(search)}`)
          .catch(() => null);
        if (fallback?.data) {
          const list = Array.isArray(fallback.data) ? fallback.data : fallback.data.contacts || [];
          setContacts(list);
          setTotalCount(fallback.data.total || list.length);
        }
      }
    } catch (err) {
      console.warn("Notice loading branch contacts:", err?.message);
    } finally {
      setLoading(false);
    }
  }, [activeBranch?.id, search]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const handleCreateContact = async (e) => {
    e.preventDefault();
    if (!formData.phone.trim() || !activeBranch?.id) return;

    setCreateLoading(true);
    try {
      await createBranchContact(activeBranch.id, {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        tags: formData.tags.trim(),
        notes: formData.notes.trim(),
      });

      setModalOpen(false);
      setFormData({ name: "", phone: "", email: "", tags: "", notes: "" });
      showToast(`Customer added to ${activeBranch.name}!`);
      await fetchContacts();
    } catch (err) {
      alert(err?.response?.data?.message || err.message || "Failed to create contact");
    } finally {
      setCreateLoading(false);
    }
  };

  const openTransferModal = (contact) => {
    setSelectedContactToTransfer(contact);
    const otherBranches = accessibleBranches.filter((b) => b.id !== activeBranch.id);
    setTargetBranchId(otherBranches[0]?.id ? String(otherBranches[0].id) : "");
    setTransferReason("");
    setTransferModalOpen(true);
  };

  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    if (!selectedContactToTransfer || !targetBranchId || !activeBranch?.id) return;

    setTransferLoading(true);
    try {
      await transferBranchContact(activeBranch.id, selectedContactToTransfer.id, {
        targetBranchId: Number(targetBranchId),
        reason: transferReason || "Branch customer reassignment",
      });

      setTransferModalOpen(false);
      showToast(`Customer transferred to target branch.`);
      await fetchContacts();
    } catch (err) {
      alert(err?.response?.data?.message || err.message || "Failed to transfer customer");
    } finally {
      setTransferLoading(false);
    }
  };

  const handleDeleteContact = async (contact) => {
    if (!window.confirm(`Delete customer "${contact.name || contact.phone}" from ${activeBranch.name}?`)) {
      return;
    }
    try {
      await api.delete(`/api/wa/contacts/${contact.id}`);
      showToast("Customer removed.");
      await fetchContacts();
    } catch (err) {
      alert(err?.response?.data?.message || err.message || "Failed to delete contact");
    }
  };

  const handleExportCsv = () => {
    if (!contacts.length) {
      alert("No contacts to export");
      return;
    }
    const headers = ["Name", "Phone", "Email", "Branch", "Tags", "Created At"];
    const rows = contacts.map((c) => [
      `"${c.name || "Customer"}"`,
      `"${c.phone}"`,
      `"${c.email || ""}"`,
      `"${activeBranch?.name || ""}"`,
      `"${c.tags ? (typeof c.tags === "string" ? c.tags : JSON.stringify(c.tags)) : ""}"`,
      `"${c.created_at || ""}"`,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${activeBranch?.code || "branch"}_contacts.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Toast Alert */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-emerald-950 border border-emerald-500/50 text-emerald-100 rounded-xl shadow-2xl animate-in slide-in-from-top-2 text-xs font-semibold">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Contact size={22} className="text-emerald-400" />
            Branch Contacts Directory
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Customer audience and verified WhatsApp contacts scoped strictly to <strong className="text-emerald-300">{activeBranch?.name}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            disabled={contacts.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 transition-all shadow-sm"
          >
            <Download size={14} />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-lg transition-all"
          >
            <UserPlus size={14} />
            <span>New Customer</span>
          </button>
        </div>
      </div>

      {/* Search & Counter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, or email..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-600 font-medium"
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 px-2 font-mono">
          <Building size={14} className="text-emerald-400" />
          <span>{activeBranch?.code}:</span>
          <strong className="text-slate-200 font-bold">{totalCount}</strong> contact(s)
        </div>
      </div>

      {/* Contacts Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
            <tr>
              <th className="p-3 pl-4">Customer</th>
              <th className="p-3">WhatsApp Phone</th>
              <th className="p-3 hidden md:table-cell">Email</th>
              <th className="p-3 hidden sm:table-cell">Tags</th>
              <th className="p-3 hidden lg:table-cell">Last Active</th>
              <th className="p-3 text-right pr-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {loading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">
                  Loading contacts directory for {activeBranch?.name}...
                </td>
              </tr>
            ) : contacts.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-10 text-center space-y-2">
                  <Contact size={32} className="mx-auto text-slate-600 mb-2" />
                  <p className="text-slate-300 font-semibold text-sm">No contacts in this branch yet</p>
                  <p className="text-slate-500 text-xs max-w-sm mx-auto">
                    Add new customers directly to {activeBranch?.name} or import your client list to begin messaging.
                  </p>
                </td>
              </tr>
            ) : (
              contacts.map((c) => (
                <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-3 pl-4">
                    <div className="font-semibold text-slate-200">{c.name || "Customer"}</div>
                    <div className="text-[10px] text-slate-500 sm:hidden">{c.phone}</div>
                  </td>
                  <td className="p-3 font-mono text-emerald-400 font-bold">{c.phone}</td>
                  <td className="p-3 text-slate-400 hidden md:table-cell">{c.email || "—"}</td>
                  <td className="p-3 hidden sm:table-cell">
                    {c.tags ? (
                      <span className="text-[10px] bg-emerald-950/60 text-emerald-300 border border-emerald-800/50 px-2 py-0.5 rounded-md font-medium">
                        {typeof c.tags === "string" ? c.tags : JSON.stringify(c.tags)}
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="p-3 text-slate-500 font-mono text-[11px] hidden lg:table-cell">
                    {c.last_message_at ? new Date(c.last_message_at).toLocaleDateString() : (c.created_at ? new Date(c.created_at).toLocaleDateString() : "New")}
                  </td>
                  <td className="p-3 text-right pr-4">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => navigate(`/whatsapp?chatPhone=${encodeURIComponent(c.phone)}`)}
                        title="Open WhatsApp Chat"
                        className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors"
                      >
                        <MessageSquare size={14} />
                      </button>

                      <button
                        onClick={() => openTransferModal(c)}
                        title="Transfer customer to another branch"
                        className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors"
                      >
                        <ArrowRightLeft size={14} />
                      </button>

                      <button
                        onClick={() => handleDeleteContact(c)}
                        title="Remove contact"
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* New Customer Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <UserPlus size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Add Customer to {activeBranch.name}</h3>
                  <p className="text-[11px] text-slate-400">
                    New record will be isolated to {activeBranch.code} branch directory.
                  </p>
                </div>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-slate-500 hover:text-slate-300">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateContact} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Customer Full Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Anand Murthy"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  WhatsApp Phone (10 digits) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="9876543210"
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Email (Optional)</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="anand@example.com"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Tags (Comma-separated)</label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="VIP, Retail Customer, Walk-in"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Customer Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  placeholder="Preferred communication times, product inquiries, etc."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3.5 py-2 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading || !formData.phone}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
                >
                  {createLoading ? "Saving..." : "Save Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Customer Modal */}
      {transferModalOpen && selectedContactToTransfer && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <ArrowRightLeft size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Transfer Customer</h3>
                  <p className="text-[11px] text-slate-400">
                    Reassign customer and open conversations to another branch.
                  </p>
                </div>
              </div>
              <button onClick={() => setTransferModalOpen(false)} className="text-slate-500 hover:text-slate-300">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleTransferSubmit} className="space-y-4 text-xs">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Customer</div>
                <div className="text-sm font-bold text-slate-200">{selectedContactToTransfer.name || "Customer"}</div>
                <div className="text-xs font-mono text-emerald-400">{selectedContactToTransfer.phone}</div>
                <div className="text-[11px] text-slate-500">Current Branch: {activeBranch.name}</div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Target Branch</label>
                <select
                  value={targetBranchId}
                  onChange={(e) => setTargetBranchId(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-600"
                >
                  <option value="" disabled>Select destination branch...</option>
                  {accessibleBranches
                    .filter((b) => b.id !== activeBranch.id)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Transfer Note / Reason</label>
                <input
                  type="text"
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  placeholder="e.g. Customer relocated, requested local store support"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setTransferModalOpen(false)}
                  className="px-3.5 py-2 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transferLoading || !targetBranchId}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
                >
                  {transferLoading ? "Transferring..." : "Confirm Transfer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
