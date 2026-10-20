import WAWorkspaceGuide from "../components/WAWorkspaceGuide";
import useWADialog from "../hooks/useWADialog";
import { useState, useEffect, useMemo, useRef } from "react";
import { Users, Plus, Trash2, Upload, Download, X, ChevronDown, ChevronRight, Loader2, UserPlus, Send, Search, CheckSquare, Square, Building2, Phone, Filter } from "lucide-react";
import axios from "axios";
import { API } from "../config/api";
import WhatsAppCampaignWizard from "../components/WhatsAppCampaignWizard";

export default function WAGroups() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const groupDialog = useWADialog(showCreate, () => setShowCreate(false), creatingGroup);
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [groupContacts, setGroupContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [importModal, setImportModal] = useState(null);
  const [bulkInput, setBulkInput] = useState("");
  const [selectedGroupForBulk, setSelectedGroupForBulk] = useState([]);
  const [showBulkModal, setShowBulkModal] = useState(false);

  // Contact picker state
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [pickerGroupId, setPickerGroupId] = useState(null);
  const [allClients, setAllClients] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [selectedClients, setSelectedClients] = useState(new Set());
  const [clientSearch, setClientSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("all");
  const [addingContacts, setAddingContacts] = useState(false);
  const [pageNotice, setPageNotice] = useState(null);
  const [groupSearch, setGroupSearch] = useState("");
  const [groupSort, setGroupSort] = useState("name");
  const groupRequest = useRef(0);
  const visibleGroups = groups.filter(group => `${group.name || ""} ${group.description || ""}`.toLowerCase().includes(groupSearch.toLowerCase())).sort((a, b) => groupSort === "size" ? Number(b.contact_count || 0) - Number(a.contact_count || 0) : (a.name || "").localeCompare(b.name || ""));

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.get(`${API}/api/wa/groups`, { headers: { Authorization: `Bearer ${token}` } });
      setGroups(Array.isArray(data) ? data : []);
    } catch (err) { setPageNotice({ type: "error", message: err.response?.data?.message || err.response?.data?.error || "Groups could not be loaded." }); }
    setLoading(false);
  };

  useEffect(() => { fetchGroups(); }, []);

  const handleCreate = async () => {
    if (creatingGroup || !groupName.trim()) return;
    setCreatingGroup(true);
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API}/api/wa/groups`, { name: groupName.trim(), description: groupDesc.trim() }, { headers: { Authorization: `Bearer ${token}` } });
      setShowCreate(false);
      setGroupName("");
      setGroupDesc("");
      fetchGroups();
      setPageNotice({ type: "success", message: "Group created." });
    } catch (err) { setPageNotice({ type: "error", message: err.response?.data?.message || err.response?.data?.error || "Group could not be created." }); }
    finally { setCreatingGroup(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this group and all its contacts?")) return;
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API}/api/wa/groups/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (expandedGroup === id) setExpandedGroup(null);
      fetchGroups();
    } catch (err) { setPageNotice({ type: "error", message: err.response?.data?.message || err.response?.data?.error || "Group could not be deleted." }); }
  };

  const toggleExpand = async (id) => {
    const requestId = ++groupRequest.current;
    if (expandedGroup === id) { setExpandedGroup(null); return; }
    setExpandedGroup(id);
    setGroupContacts([]);
    setContactsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.get(`${API}/api/wa/groups/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (requestId !== groupRequest.current) return;
      setGroupContacts(data.contacts || []);
    } catch (err) { setPageNotice({ type: "error", message: err.response?.data?.message || err.response?.data?.error || "Group contacts could not be loaded." }); }
    if (requestId === groupRequest.current) setContactsLoading(false);
  };

  const handleDeleteContact = async (groupId, contactId) => {
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API}/api/wa/groups/${groupId}/contacts/${contactId}`, { headers: { Authorization: `Bearer ${token}` } });
      setGroupContacts(prev => prev.filter(c => c.id !== contactId));
      fetchGroups();
    } catch (err) { setPageNotice({ type: "error", message: err.response?.data?.message || err.response?.data?.error || "Contact could not be removed." }); }
  };

  const handleBulkImport = async (id) => {
    if (!bulkInput.trim()) return;
    const lines = bulkInput.trim().split("\n").filter(l => l.trim());
    const contacts = lines.map(line => {
      const parts = line.split(",").map(s => s.trim());
      return { phone: parts[0]?.replace(/[^0-9]/g, "").slice(-10), name: parts[1] || null, notes: parts[2] || null };
    }).filter(c => c.phone.length >= 10);

    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API}/api/wa/groups/${id}/contacts`, { contacts }, { headers: { Authorization: `Bearer ${token}` } });
      setBulkInput("");
      setImportModal(null);
      toggleExpand(id);
      fetchGroups();
    } catch (err) { setPageNotice({ type: "error", message: err.response?.data?.message || err.response?.data?.error || "Contacts could not be imported." }); }
  };

  const handleImportCustomers = async (id) => {
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.post(`${API}/api/wa/groups/${id}/import-customers`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setPageNotice({ type: "success", message: `Imported ${data.imported ?? 0} customers. Group total: ${data.totalContacts ?? 0}.` });
      toggleExpand(id);
      fetchGroups();
    } catch (err) { setPageNotice({ type: "error", message: err.response?.data?.error || err.response?.data?.message || "Customer import failed." }); }
  };

  const downloadCSV = (contacts, groupName) => {
    const csv = "Phone,Name,Notes\n" + contacts.map(c => `${c.phone},${c.name || ""},${c.notes || ""}`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${groupName || "contacts"}.csv`;
    a.click();
  };

  // Fetch all CRM clients for contact picker
  const openContactPicker = async (groupId) => {
    setPickerGroupId(groupId);
    setSelectedClients(new Set());
    setClientSearch("");
    setClientFilter("all");
    setShowContactPicker(true);
    setClientsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.get(`${API}/api/contacts`, { headers: { Authorization: `Bearer ${token}` } });
      setAllClients(data.contacts || data || []);
    } catch (err) {
      setAllClients([]);
      setPageNotice({ type: "error", message: err.response?.data?.message || err.response?.data?.error || "CRM contacts could not be loaded." });
    }
    setClientsLoading(false);
  };

  const filteredClients = useMemo(() => {
    let list = allClients;
    if (clientSearch.trim()) {
      const q = clientSearch.toLowerCase();
      list = list.filter(c =>
        (c.name || "").toLowerCase().includes(q) ||
        (c.phone || "").includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        (c.company || "").toLowerCase().includes(q)
      );
    }
    if (clientFilter === "has_phone") {
      list = list.filter(c => c.phone && c.phone.length >= 10);
    }
    return list;
  }, [allClients, clientSearch, clientFilter]);

  const toggleClientSelect = (id) => {
    setSelectedClients(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedClients(new Set(filteredClients.map(c => c.id)));
  };

  const deselectAll = () => {
    setSelectedClients(new Set());
  };

  const addSelectedToGroup = async () => {
    if (selectedClients.size === 0 || !pickerGroupId) return;
    setAddingContacts(true);
    try {
      const token = localStorage.getItem("token");
      const contacts = filteredClients
        .filter(c => selectedClients.has(c.id))
        .map(c => ({
          phone: (c.phone || "").replace(/[^0-9]/g, "").slice(-10),
          name: c.name || null,
          notes: c.company || c.email || null
        }))
        .filter(c => c.phone.length >= 10);

      if (contacts.length === 0) {
        setPageNotice({ type: "error", message: "The selected contacts do not have valid phone numbers." });
        setAddingContacts(false);
        return;
      }

      await axios.post(`${API}/api/wa/groups/${pickerGroupId}/contacts`, { contacts }, { headers: { Authorization: `Bearer ${token}` } });
      setShowContactPicker(false);
      toggleExpand(pickerGroupId);
      fetchGroups();
    } catch (err) {
      setPageNotice({ type: "error", message: err.response?.data?.message || err.response?.data?.error || "Selected contacts could not be added." });
    }
    setAddingContacts(false);
  };

  return (
    <div className="hl-page">
      <WAWorkspaceGuide section="groups" />      <div className="hl-commandbar">
        <div className="flex items-center gap-3">
          <Users size={28} style={{ color: "var(--color-ink)" }} />
          <h1 className="hl-title">Contact Groups</h1>
          <span className="hl-badge">{groups.length} groups</span>
        </div>
        <button onClick={() => setShowCreate(true)} className="hl-btn-primary">
          <Plus size={16} /> New Group
        </button>
      </div>

      {pageNotice && <div role={pageNotice.type === "error" ? "alert" : "status"} className="hl-card flex flex-wrap items-center justify-between gap-3 p-3 text-sm" style={{ borderColor: pageNotice.type === "error" ? "var(--color-error)" : "var(--color-success)", color: pageNotice.type === "error" ? "var(--color-error)" : "var(--color-success)" }}><span>{pageNotice.message}</span><div className="flex gap-2">{pageNotice.type === "error" && <button type="button" className="hl-btn-secondary" onClick={fetchGroups}>Retry</button>}<button type="button" className="hl-btn-secondary" onClick={() => setPageNotice(null)}>Dismiss</button></div></div>}

      <div className="wa-group-toolbar"><label><Search size={16} /><input aria-label="Search contact groups" placeholder="Search groups by name or description" value={groupSearch} onChange={e => setGroupSearch(e.target.value)} /></label><label>Sort by<select value={groupSort} onChange={e => setGroupSort(e.target.value)}><option value="name">Group name</option><option value="size">Most contacts</option></select></label><span aria-live="polite">{visibleGroups.length} groups</span></div>
      {loading ? (
        <div role="status" className="flex items-center justify-center gap-3 py-20"><Loader2 size={24} className="animate-spin" style={{ color: "var(--color-ink)" }} />Loading groups…</div>
      ) : groups.length === 0 ? (
        <div className="hl-card hl-empty">
          <Users size={48} className="mx-auto mb-4 opacity-50" />
          <p className="hl-empty-title">No groups yet</p>
          <p className="text-sm">Create contact groups to organize your audience</p>
        </div>
      ) : visibleGroups.length === 0 ? <div className="hl-card hl-empty"><p className="hl-empty-title">No matching groups</p><p>Try a different group name or clear your search.</p><button type="button" className="hl-btn-secondary mt-4" onClick={() => setGroupSearch("")}>Clear search</button></div> : (
        <div className="space-y-3">
          {visibleGroups.map((g) => (
            <div key={g.id} className="hl-card overflow-hidden">
              <div className="wa-group-row flex items-center justify-between p-4">
                <button type="button" className="wa-group-expand" aria-expanded={expandedGroup === g.id} aria-label={`${expandedGroup === g.id ? "Collapse" : "Expand"} ${g.name}`} onClick={() => toggleExpand(g.id)}>
                <div className="flex items-center gap-3">
                  {expandedGroup === g.id ? <ChevronDown size={18} style={{ color: "var(--color-ink-2)" }} /> : <ChevronRight size={18} style={{ color: "var(--color-ink-2)" }} />}
                  <div>
                    <h3 className="font-semibold" style={{ color: "var(--color-ink)" }}>{g.name}</h3>
                    <p className="hl-subtitle">{g.contact_count || 0} contacts{g.description ? ` — ${g.description}` : ""}</p>
                  </div>
                </div>
                </button>
                <div className="flex items-center gap-2 flex-wrap" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => openContactPicker(g.id)}
                    className="hl-btn-primary"
                    title="Add contacts from CRM"
                  >
                    <UserPlus size={14} />
                    <span>Add Contacts</span>
                  </button>
                  <button
                    onClick={async () => {
                      const token = localStorage.getItem("token");
                      const { data } = await axios.get(`${API}/api/wa/groups/${g.id}`, { headers: { Authorization: `Bearer ${token}` } });
                      setSelectedGroupForBulk(data.contacts || []);
                      setShowBulkModal(true);
                    }}
                    className="hl-btn-secondary"
                    title="Launch WhatsApp broadcast wizard"
                  >
                    <Send size={14} />
                    <span>Send Bulk</span>
                  </button>
                  <button onClick={() => { setImportModal(g.id); setBulkInput(""); }} className="hl-btn-secondary" style={{ padding: "var(--space-2xs) var(--space-xs)" }} title="Manual import (paste numbers)"><Upload size={16} /></button>
                  <button onClick={() => handleDelete(g.id)} className="hl-btn-danger-ghost" style={{ padding: "var(--space-2xs) var(--space-xs)" }}><Trash2 size={16} /></button>
                </div>
              </div>

              {expandedGroup === g.id && (
                <div className="p-4" style={{ borderTop: "1px solid var(--color-rule)", background: "var(--color-paper)" }}>
                  {contactsLoading ? (
                    <div className="flex justify-center py-4"><Loader2 size={20} className="animate-spin" style={{ color: "var(--color-ink-2)" }} /></div>
                  ) : groupContacts.length === 0 ? (
                    <div className="hl-empty">No contacts in this group. Import contacts to start.</div>
                  ) : (
                    <div className="space-y-1">
                      {groupContacts.map((c) => (
                        <div key={c.id} className="hl-card flex items-center justify-between px-3 py-2">
                          <div>
                            <span className="text-sm font-medium" style={{ color: "var(--color-ink)" }}>{c.name || "Unknown"}</span>
                            <span className="hl-id ml-2">+{c.country_code || "91"} {c.phone}</span>
                            {c.notes && <span className="text-xs ml-2" style={{ color: "var(--color-ink-2)" }}>{c.notes}</span>}
                          </div>
                          <div className="flex items-center gap-1">
                            <a
                              href={`/whatsapp?phone=${c.phone}`}
                              className="p-1 rounded transition"
                              style={{ color: "var(--color-ink)" }}
                              title="Open in Live Chat"
                            >
                              <Send size={13} />
                            </a>
                            <button onClick={() => handleDeleteContact(g.id, c.id)} className="p-1 rounded" style={{ color: "var(--color-error)" }} title="Remove from group">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                      <button onClick={() => downloadCSV(groupContacts, g.name)} className="flex items-center gap-1 text-xs mt-2 px-1" style={{ color: "var(--color-ink-2)" }}>
                        <Download size={12} /> Export CSV
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
          <div ref={groupDialog} role="dialog" aria-modal="true" aria-label="Create contact group" className="hl-card w-full max-w-md" onClick={e => e.stopPropagation()}>
            {pageNotice?.type === "error" && <p role="alert" className="wa-form-error m-4">{pageNotice.message}</p>}
            <div className="flex items-center justify-between p-5" style={{ borderBottom: "1px solid var(--color-rule)" }}>
              <h2 className="text-lg font-bold">New Contact Group</h2>
              <button onClick={() => setShowCreate(false)}><X size={20} style={{ color: "var(--color-ink-2)" }} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Group Name *</label>
                <input type="text" value={groupName} onChange={e => setGroupName(e.target.value)} className="hl-input w-full" placeholder="Customers 2024" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <input type="text" value={groupDesc} onChange={e => setGroupDesc(e.target.value)} className="hl-input w-full" placeholder="All active customers" />
              </div>
            </div>
            <div className="flex gap-3 p-5" style={{ borderTop: "1px solid var(--color-rule)" }}>
              <button onClick={() => setShowCreate(false)} className="hl-btn-secondary flex-1">Cancel</button>
              <button onClick={handleCreate} disabled={creatingGroup || !groupName.trim()} className="hl-btn-primary flex-1">{creatingGroup ? "Creating…" : "Create group"}</button>
            </div>
          </div>
        </div>
      )}

      {importModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setImportModal(null)}>
          <div className="hl-card w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5" style={{ borderBottom: "1px solid var(--color-rule)" }}>
              <h2 className="text-lg font-bold">Import Contacts</h2>
              <button onClick={() => setImportModal(null)}><X size={20} style={{ color: "var(--color-ink-2)" }} /></button>
            </div>
            <div className="p-5">
              <p className="text-sm mb-3">One phone number per line. Optionally add name and notes:</p>
              <textarea value={bulkInput} onChange={e => setBulkInput(e.target.value)} rows={8} className="hl-input w-full font-mono" placeholder="9876543210, Rajesh, VIP customer&#10;9876543211, Priya&#10;9876543212" />
              <p className="text-xs mt-1">Format: phone, name, notes (one per line)</p>
            </div>
            <div className="flex gap-3 p-5" style={{ borderTop: "1px solid var(--color-rule)" }}>
              <button onClick={() => setImportModal(null)} className="hl-btn-secondary flex-1">Cancel</button>
              <button onClick={() => handleBulkImport(importModal)} disabled={!bulkInput.trim()} className="hl-btn-primary flex-1">Import</button>
            </div>
          </div>
        </div>
      )}

      {/* Contact Picker Modal - Select from CRM Clients */}
      {showContactPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowContactPicker(false)}>
          <div className="hl-card w-full max-w-2xl max-h-[85dvh] min-h-0 flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 gap-3 shrink-0" style={{ borderBottom: "1px solid var(--color-rule)" }}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--color-paper)" }}>
                  <UserPlus size={20} style={{ color: "var(--color-ink)" }} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base sm:text-lg font-bold truncate">Add Contacts from CRM</h2>
                  <p className="hl-subtitle">{filteredClients.length} clients found {selectedClients.size > 0 && `— ${selectedClients.size} selected`}</p>
                </div>
              </div>
              <button onClick={() => setShowContactPicker(false)} className="p-2 rounded-lg transition shrink-0">
                <X size={20} style={{ color: "var(--color-ink-2)" }} />
              </button>
            </div>

            {/* Search & Filter Bar */}
            <div className="px-5 py-3 shrink-0" style={{ borderBottom: "1px solid var(--color-rule)", background: "var(--color-paper)" }}>
              <div className="flex items-center gap-3">
                <div className="flex-1 relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-ink-2)" }} />
                  <input
                    type="text"
                    value={clientSearch}
                    onChange={e => setClientSearch(e.target.value)}
                    placeholder="Search by name, phone, email, or company..."
                    className="hl-input w-full pl-10 pr-4"
                  />
                  {clientSearch && (
                    <button onClick={() => setClientSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded">
                      <X size={14} style={{ color: "var(--color-ink-2)" }} />
                    </button>
                  )}
                </div>
                <div className="hl-tabs">
                  <button
                    onClick={() => setClientFilter("all")}
                    className={`hl-tab ${clientFilter === "all" ? "is-active" : ""}`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setClientFilter("has_phone")}
                    className={`hl-tab ${clientFilter === "has_phone" ? "is-active" : ""}`}
                  >
                    <Phone size={12} className="inline mr-1" />
                    Has Phone
                  </button>
                </div>
              </div>

              {/* Select All / Deselect */}
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  <button onClick={selectAllFiltered} className="text-xs font-semibold hover:underline" style={{ color: "var(--color-ink)" }}>Select all ({filteredClients.length})</button>
                  {selectedClients.size > 0 && (
                    <button onClick={deselectAll} className="text-xs hover:underline" style={{ color: "var(--color-ink-2)" }}>Clear selection</button>
                  )}
                </div>
                <span className="text-[10px]" style={{ color: "var(--color-ink-2)" }}>{filteredClients.length} of {allClients.length} clients</span>
              </div>
            </div>

            {/* Client List */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {clientsLoading ? (
                <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin" style={{ color: "var(--color-ink)" }} /></div>
              ) : filteredClients.length === 0 ? (
                <div className="hl-empty">
                  <Users size={40} className="mx-auto mb-3 opacity-40" />
                  <p className="hl-empty-title">No clients found</p>
                  <p className="text-xs mt-1">{clientSearch ? "Try a different search term" : "No CRM contacts available"}</p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredClients.map((client) => {
                    const isSelected = selectedClients.has(client.id);
                    const hasPhone = client.phone && client.phone.length >= 10;
                    return (
                      <div
                        key={client.id}
                        onClick={() => hasPhone && toggleClientSelect(client.id)}
                        className={`flex items-center gap-3 px-5 py-3 transition cursor-pointer ${hasPhone ? "hover:bg-[var(--color-paper)]" : "opacity-50 cursor-not-allowed"} ${isSelected ? "bg-[var(--color-accent-soft)]" : ""}`}
                      >
                        <div className="shrink-0">
                          {isSelected ? (
                            <CheckSquare size={18} style={{ color: "var(--color-ink)" }} />
                          ) : (
                            <Square size={18} style={{ color: "var(--color-ink-2)", opacity: hasPhone ? 1 : 0.5 }} />
                          )}
                        </div>
                        <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--color-paper)" }}>
                          <span className="text-sm font-bold" style={{ color: "var(--color-ink)" }}>{(client.name || "?")[0].toUpperCase()}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold truncate" style={{ color: "var(--color-ink)" }}>{client.name || "Unknown"}</span>
                            {client.company && (
                              <span className="hl-badge shrink-0">
                                <Building2 size={9} /> {client.company}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            {client.phone && (
                              <span className="text-xs flex items-center gap-1" style={{ color: "var(--color-ink-2)" }}>
                                <Phone size={10} /> +{client.phone}
                              </span>
                            )}
                            {client.email && (
                              <span className="text-xs truncate" style={{ color: "var(--color-ink-2)" }}>{client.email}</span>
                            )}
                          </div>
                        </div>
                        {hasPhone && (
                          <div className="text-[10px] shrink-0" style={{ color: "var(--color-ink-2)" }}>
                            {isSelected ? "Added" : "Click to add"}
                          </div>
                        )}
                        {!hasPhone && (
                          <span className="hl-badge hl-badge-warn shrink-0">No phone</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between p-5 shrink-0" style={{ borderTop: "1px solid var(--color-rule)", background: "var(--color-paper)" }}>
              <button onClick={() => setShowContactPicker(false)} className="hl-btn-secondary">
                Cancel
              </button>
              <button
                onClick={addSelectedToGroup}
                disabled={selectedClients.size === 0 || addingContacts}
                className="hl-btn-primary"
              >
                {addingContacts ? (
                  <><Loader2 size={14} className="animate-spin" /> Adding...</>
                ) : (
                  <><UserPlus size={14} /> Add {selectedClients.size} Contact{selectedClients.size !== 1 ? "s" : ""} to Group</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <WhatsAppCampaignWizard
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        onSuccess={() => fetchGroups()}
        initialContacts={selectedGroupForBulk || []}
      />
    </div>
  );
}
