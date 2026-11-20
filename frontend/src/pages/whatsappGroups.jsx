import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import {
  Users,
  Plus,
  Trash2,
  Upload,
  Download,
  X,
  Loader2,
  UserPlus,
  Send,
  Search,
  ShieldCheck,
  Calculator,
  CheckCircle2,
  AlertCircle,
  Edit2,
} from "lucide-react";
import api from "../config/axios";
import { campaignApi } from "../api/campaigns";

const SEGMENT_FIELDS = [
  { value: "tags", label: "Contact tags" },
  { value: "name", label: "Full name" },
  { value: "email", label: "Email address" },
  { value: "country_code", label: "Country code" },
  { value: "source", label: "Acquisition source" },
  { value: "crm_ref_type", label: "CRM record type" },
  { value: "last_contacted", label: "Last interaction date" },
  { value: "custom_fields.city", label: "City (custom field)" },
  { value: "custom_fields.company", label: "Company (custom field)" },
  { value: "custom_fields.product_interest", label: "Product interest" },
];

const SEGMENT_OPERATORS = [
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "does not equal" },
  { value: "contains", label: "contains" },
  { value: "not_contains", label: "does not contain" },
  { value: "starts_with", label: "starts with" },
  { value: "within_days", label: "within last N days" },
  { value: "older_than_days", label: "older than N days" },
  { value: "is_not_empty", label: "is not empty" },
  { value: "is_empty", label: "is empty" },
];

export default function WAGroups() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("groups");
  const [notice, setNotice] = useState(null);

  // Contact groups state
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groupsError, setGroupsError] = useState("");
  const [groupSearch, setGroupSearch] = useState("");
  const [groupSort, setGroupSort] = useState("recent");
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [groupContacts, setGroupContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [eligibility, setEligibility] = useState(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);

  // Create / Edit Group modal
  const [groupModal, setGroupModal] = useState(null);
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [savingGroup, setSavingGroup] = useState(false);

  // Add contacts / Upload CSV modal
  const [importOpen, setImportOpen] = useState(false);
  const [singlePhone, setSinglePhone] = useState("");
  const [singleName, setSingleName] = useState("");
  const [singleNotes, setSingleNotes] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [parsedFileContacts, setParsedFileContacts] = useState([]);
  const [fileLabel, setFileLabel] = useState("");
  const [importing, setImporting] = useState(false);

  // CRM Contact Picker modal
  const [pickerOpen, setPickerOpen] = useState(false);
  const [crmSources, setCrmSources] = useState([]);
  const [crmLoading, setCrmLoading] = useState(false);
  const [crmSearch, setCrmSearch] = useState("");
  const [crmSourceFilter, setCrmSourceFilter] = useState("ALL");
  const [selectedPhones, setSelectedPhones] = useState(new Set());
  const [addingFromCrm, setAddingFromCrm] = useState(false);

  // Dynamic Segments state
  const [segments, setSegments] = useState([]);
  const [presets, setPresets] = useState([]);
  const [segmentsLoading, setSegmentsLoading] = useState(false);
  const [segName, setSegName] = useState("");
  const [segDesc, setSegDesc] = useState("");
  const [segLogic, setSegLogic] = useState("AND");
  const [includeRules, setIncludeRules] = useState([{ field: "tags", operator: "contains", value: "VIP" }]);
  const [excludeRules, setExcludeRules] = useState([]);
  const [segEstimate, setSegEstimate] = useState(null);
  const [estimating, setEstimating] = useState(false);
  const [savingSeg, setSavingSeg] = useState(false);

  const memberReqId = useRef(0);

  // Escape key closes open dialogs (R-26, R-32)
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        setGroupModal(null);
        setImportOpen(false);
        setPickerOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const fetchGroups = useCallback(async () => {
    setGroupsLoading(true);
    setGroupsError("");
    try {
      const { data } = await api.get("/api/wa/groups");
      const list = Array.isArray(data) ? data : [];
      setGroups(list);
      if (list.length > 0 && !selectedGroupId) {
        setSelectedGroupId(list[0].id);
      }
    } catch (err) {
      setGroupsError(err.response?.data?.error || err.message || "Could not load contact groups.");
    } finally {
      setGroupsLoading(false);
    }
  }, [selectedGroupId]);

  const fetchSegments = useCallback(async () => {
    setSegmentsLoading(true);
    try {
      const [segs, pre] = await Promise.all([
        campaignApi.listSegments().catch(() => []),
        campaignApi.getPresets().catch(() => ({ presets: [] })),
      ]);
      setSegments(Array.isArray(segs) ? segs : []);
      setPresets(Array.isArray(pre?.presets) ? pre.presets : []);
    } finally {
      setSegmentsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
    fetchSegments();
  }, [fetchGroups, fetchSegments]);

  const loadGroupDetails = useCallback(async (groupId) => {
    if (!groupId) {
      setGroupContacts([]);
      setEligibility(null);
      return;
    }
    const req = ++memberReqId.current;
    setContactsLoading(true);
    setEligibility(null);
    try {
      const { data } = await api.get(`/api/wa/groups/${groupId}`);
      if (req !== memberReqId.current) return;
      setGroupContacts(Array.isArray(data?.contacts) ? data.contacts : []);
    } catch (err) {
      if (req === memberReqId.current) {
        setNotice({ type: "error", text: err.response?.data?.error || "Could not load contacts for this group." });
      }
    } finally {
      if (req === memberReqId.current) setContactsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedGroupId) loadGroupDetails(selectedGroupId);
  }, [selectedGroupId, loadGroupDetails]);

  const visibleGroups = useMemo(() => {
    const q = groupSearch.trim().toLowerCase();
    return groups
      .filter((g) => `${g.name || ""} ${g.description || ""}`.toLowerCase().includes(q))
      .sort((a, b) => {
        if (groupSort === "size") return Number(b.contact_count || 0) - Number(a.contact_count || 0);
        if (groupSort === "name") return String(a.name || "").localeCompare(String(b.name || ""));
        return Number(b.id) - Number(a.id);
      });
  }, [groups, groupSearch, groupSort]);

  const activeGroup = useMemo(
    () => groups.find((g) => Number(g.id) === Number(selectedGroupId)) || null,
    [groups, selectedGroupId]
  );

  const visibleContacts = useMemo(() => {
    const q = contactSearch.trim().toLowerCase();
    if (!q) return groupContacts;
    return groupContacts.filter((c) =>
      `${c.name || ""} ${c.phone || ""} ${c.notes || ""}`.toLowerCase().includes(q)
    );
  }, [groupContacts, contactSearch]);

  const handleSaveGroup = async (e) => {
    e.preventDefault();
    if (!groupName.trim() || savingGroup) return;
    setSavingGroup(true);
    setNotice(null);
    try {
      if (groupModal?.mode === "edit" && groupModal.group) {
        await api.put(`/api/wa/groups/${groupModal.group.id}`, {
          name: groupName.trim(),
          description: groupDesc.trim(),
        });
        setNotice({ type: "success", text: `Updated group "${groupName.trim()}".` });
      } else {
        const { data } = await api.post("/api/wa/groups", {
          name: groupName.trim(),
          description: groupDesc.trim(),
        });
        setSelectedGroupId(data.id);
        setNotice({ type: "success", text: `Created group "${data.name}".` });
      }
      setGroupModal(null);
      setGroupName("");
      setGroupDesc("");
      fetchGroups();
    } catch (err) {
      setNotice({ type: "error", text: err.response?.data?.error || err.message || "Could not save group." });
    } finally {
      setSavingGroup(false);
    }
  };

  const handleDeleteGroup = async (group) => {
    if (!window.confirm(`Delete group "${group.name}" and remove its saved members?`)) return;
    try {
      await api.delete(`/api/wa/groups/${group.id}`);
      if (Number(selectedGroupId) === Number(group.id)) {
        setSelectedGroupId(null);
        setGroupContacts([]);
      }
      setNotice({ type: "success", text: `Deleted group "${group.name}".` });
      fetchGroups();
    } catch (err) {
      setNotice({ type: "error", text: err.response?.data?.error || "Could not delete group." });
    }
  };

  const handleRemoveContact = async (contactId) => {
    if (!activeGroup) return;
    try {
      await api.delete(`/api/wa/groups/${activeGroup.id}/contacts/${contactId}`);
      setGroupContacts((prev) => prev.filter((c) => c.id !== contactId));
      fetchGroups();
    } catch (err) {
      setNotice({ type: "error", text: err.response?.data?.error || "Could not remove contact." });
    }
  };

  const handleAddSingleContact = async (e) => {
    e.preventDefault();
    if (!activeGroup || !singlePhone.trim()) return;
    const digits = singlePhone.replace(/\D/g, "");
    if (digits.length < 10) {
      setNotice({ type: "error", text: "Enter a valid phone number with at least 10 digits." });
      return;
    }
    setImporting(true);
    try {
      await api.post(`/api/wa/groups/${activeGroup.id}/contacts`, {
        contacts: [{ phone: digits, name: singleName.trim() || null, notes: singleNotes.trim() || null }],
      });
      setSinglePhone("");
      setSingleName("");
      setSingleNotes("");
      setNotice({ type: "success", text: "Contact added to group." });
      loadGroupDetails(activeGroup.id);
      fetchGroups();
    } catch (err) {
      setNotice({ type: "error", text: err.response?.data?.error || "Could not add contact." });
    } finally {
      setImporting(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileLabel(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
      const cols = rows.length ? Object.keys(rows[0]) : [];
      const phoneCol = cols.find((c) => /phone|mobile|whatsapp|number/i.test(c)) || cols[0];
      const nameCol = cols.find((c) => /name|customer/i.test(c)) || "";
      const notesCol = cols.find((c) => /note|city|company|tag/i.test(c)) || "";
      const parsed = rows
        .map((r) => ({
          phone: String(r[phoneCol] || "").replace(/\D/g, ""),
          name: nameCol ? String(r[nameCol] || "").trim() : null,
          notes: notesCol ? String(r[notesCol] || "").trim() : null,
        }))
        .filter((r) => r.phone.length >= 10);
      setParsedFileContacts(parsed);
    } catch (err) {
      setNotice({ type: "error", text: `Could not read file: ${err.message}` });
    }
  };

  const handleConfirmImport = async () => {
    if (!activeGroup) return;
    let contacts = [...parsedFileContacts];
    if (bulkText.trim()) {
      const pasted = bulkText
        .trim()
        .split("\n")
        .map((line) => {
          const [p, n, note] = line.split(",").map((s) => s.trim());
          return { phone: String(p || "").replace(/\D/g, ""), name: n || null, notes: note || null };
        })
        .filter((c) => c.phone.length >= 10);
      contacts = [...contacts, ...pasted];
    }
    if (contacts.length === 0) {
      setNotice({ type: "error", text: "Provide at least one valid 10-digit phone number to import." });
      return;
    }
    setImporting(true);
    try {
      await api.post(`/api/wa/groups/${activeGroup.id}/contacts`, { contacts });
      setBulkText("");
      setParsedFileContacts([]);
      setFileLabel("");
      setImportOpen(false);
      setNotice({ type: "success", text: `Added ${contacts.length} contacts to "${activeGroup.name}".` });
      loadGroupDetails(activeGroup.id);
      fetchGroups();
    } catch (err) {
      setNotice({ type: "error", text: err.response?.data?.error || "Import failed." });
    } finally {
      setImporting(false);
    }
  };

  const openCrmPicker = async () => {
    setPickerOpen(true);
    setSelectedPhones(new Set());
    setCrmSearch("");
    setCrmSourceFilter("ALL");
    setCrmLoading(true);
    try {
      const { data } = await api.get("/api/wa/groups/sources/all");
      setCrmSources(Array.isArray(data) ? data : []);
    } catch (err) {
      setCrmSources([]);
      setNotice({ type: "error", text: err.response?.data?.error || "Could not load CRM contacts." });
    } finally {
      setCrmLoading(false);
    }
  };

  const filteredCrmSources = useMemo(() => {
    const q = crmSearch.trim().toLowerCase();
    return crmSources.filter((c) => {
      if (crmSourceFilter !== "ALL" && c.source !== crmSourceFilter) return false;
      if (!q) return true;
      return `${c.name || ""} ${c.phone || ""} ${c.city || ""} ${c.source || ""}`.toLowerCase().includes(q);
    });
  }, [crmSources, crmSearch, crmSourceFilter]);

  const crmSourceTypes = useMemo(
    () => ["ALL", ...Array.from(new Set(crmSources.map((c) => c.source).filter(Boolean)))],
    [crmSources]
  );

  const handleAddSelectedFromCrm = async () => {
    if (!activeGroup || selectedPhones.size === 0) return;
    const chosen = crmSources.filter((c) => selectedPhones.has(c.phone));
    setAddingFromCrm(true);
    try {
      await api.post(`/api/wa/groups/${activeGroup.id}/contacts`, {
        contacts: chosen.map((c) => ({ phone: c.phone, name: c.name, notes: c.city || c.source || null })),
      });
      setPickerOpen(false);
      setNotice({ type: "success", text: `Added ${chosen.length} CRM contacts to "${activeGroup.name}".` });
      loadGroupDetails(activeGroup.id);
      fetchGroups();
    } catch (err) {
      setNotice({ type: "error", text: err.response?.data?.error || "Could not add selected contacts." });
    } finally {
      setAddingFromCrm(false);
    }
  };

  const handleCheckEligibility = async () => {
    if (!activeGroup) return;
    setEligibilityLoading(true);
    try {
      const res = await campaignApi.getGroupEligibility(activeGroup.id, "MARKETING");
      setEligibility(res);
    } catch (err) {
      setNotice({ type: "error", text: err.response?.data?.error || err.message || "Eligibility check failed." });
    } finally {
      setEligibilityLoading(false);
    }
  };

  const handleExportCsv = () => {
    if (!activeGroup || groupContacts.length === 0) return;
    const lines = ["Phone,Name,Notes"];
    for (const c of groupContacts) {
      lines.push(`${c.phone},${JSON.stringify(c.name || "")},${JSON.stringify(c.notes || "")}`);
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeGroup.name.replace(/\s+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const segmentDefinition = { logic: segLogic, include: includeRules, exclude: excludeRules };

  const handleEstimateSegment = async () => {
    setEstimating(true);
    setNotice(null);
    try {
      const res = await campaignApi.estimateLive({ definition: segmentDefinition, category: "MARKETING" });
      setSegEstimate(res);
    } catch (err) {
      setNotice({ type: "error", text: err.response?.data?.error || err.message || "Segment estimation failed." });
    } finally {
      setEstimating(false);
    }
  };

  const handleSaveSegment = async (e) => {
    e.preventDefault();
    if (!segName.trim() || savingSeg) return;
    setSavingSeg(true);
    setNotice(null);
    try {
      const created = await campaignApi.createSegment({
        name: segName.trim(),
        description: segDesc.trim(),
        definition: segmentDefinition,
      });
      await campaignApi.estimateSegment(created.id, { category: "MARKETING" }).catch(() => {});
      setSegName("");
      setSegDesc("");
      setNotice({ type: "success", text: `Saved dynamic segment "${created.name}".` });
      fetchSegments();
    } catch (err) {
      setNotice({ type: "error", text: err.response?.data?.error || err.message || "Could not save segment." });
    } finally {
      setSavingSeg(false);
    }
  };

  const applyPreset = (p) => {
    setSegName(p.name);
    setSegDesc(p.description || "");
    setSegLogic(p.definition?.logic || "AND");
    setIncludeRules(Array.isArray(p.definition?.include) ? p.definition.include : []);
    setExcludeRules(Array.isArray(p.definition?.exclude) ? p.definition.exclude : []);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-5">
        {/* Page Header */}
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Contact Groups &amp; Audience Segments</h1>
            <p className="text-sm text-slate-700 mt-1">
              Manage reusable recipient lists, dynamic CRM filters, and consent eligibility for WhatsApp campaigns.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/whatsapp/campaigns/consent"
              className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-lg bg-white border border-slate-300 text-slate-800 text-xs font-semibold hover:bg-slate-100 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-700" aria-hidden="true" />
              <span>Consent &amp; DNC</span>
            </Link>
            <Link
              to="/whatsapp/campaigns/import"
              className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-lg bg-white border border-slate-300 text-slate-800 text-xs font-semibold hover:bg-slate-100 cursor-pointer"
            >
              <Upload className="w-4 h-4 text-slate-700" aria-hidden="true" />
              <span>Full CSV/XLSX import</span>
            </Link>
            <Link
              to="/whatsapp/campaigns"
              className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-lg bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 cursor-pointer"
            >
              <Send className="w-4 h-4" aria-hidden="true" />
              <span>Campaign center</span>
            </Link>
          </div>
        </header>

        {/* Notice Banner */}
        {notice && (
          <div
            role="status"
            className={`p-3 rounded-lg border text-sm flex items-center justify-between gap-2 ${
              notice.type === "error"
                ? "bg-rose-50 border-rose-300 text-rose-900"
                : "bg-emerald-50 border-emerald-300 text-emerald-900"
            }`}
          >
            <div className="flex items-center gap-2">
              {notice.type === "error" ? (
                <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              )}
              <span>{notice.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="Dismiss notification"
              className="p-1 rounded hover:bg-black/5 cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Mode Switcher Tabs */}
        <div role="tablist" aria-label="Audience views" className="flex flex-wrap gap-2">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "groups"}
            onClick={() => setActiveTab("groups")}
            className={`min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer border transition-colors ${
              activeTab === "groups"
                ? "bg-emerald-700 text-white border-emerald-700"
                : "bg-white text-slate-800 border-slate-300 hover:bg-slate-100"
            }`}
          >
            Contact groups ({groups.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "segments"}
            onClick={() => setActiveTab("segments")}
            className={`min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer border transition-colors ${
              activeTab === "segments"
                ? "bg-emerald-700 text-white border-emerald-700"
                : "bg-white text-slate-800 border-slate-300 hover:bg-slate-100"
            }`}
          >
            Dynamic CRM segments ({segments.length})
          </button>
        </div>

        {/* TAB 1: CONTACT GROUPS (Master-Detail Workspace) */}
        {activeTab === "groups" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left Rail: Groups List */}
            <section aria-label="Contact groups list" className="lg:col-span-4 bg-white rounded-xl border border-slate-300 overflow-hidden">
              <div className="p-4 border-b border-slate-200 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-bold text-slate-900">Your groups</h2>
                  <button
                    type="button"
                    onClick={() => {
                      setGroupName("");
                      setGroupDesc("");
                      setGroupModal({ mode: "create" });
                    }}
                    className="inline-flex items-center gap-1 min-h-[36px] px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>New group</span>
                  </button>
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <label htmlFor="group-search" className="sr-only">Search groups</label>
                    <Search className="w-4 h-4 text-slate-500 absolute left-2.5 top-2.5" aria-hidden="true" />
                    <input
                      id="group-search"
                      value={groupSearch}
                      onChange={(e) => setGroupSearch(e.target.value)}
                      placeholder="Filter groups..."
                      className="w-full pl-8 pr-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>
                  <label htmlFor="group-sort" className="sr-only">Sort groups</label>
                  <select
                    id="group-sort"
                    value={groupSort}
                    onChange={(e) => setGroupSort(e.target.value)}
                    className="px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 cursor-pointer"
                  >
                    <option value="recent">Newest</option>
                    <option value="size">Largest</option>
                    <option value="name">A to Z</option>
                  </select>
                </div>
              </div>

              {groupsLoading ? (
                <div className="p-6 text-center text-xs text-slate-700">
                  <Loader2 className="w-4 h-4 animate-spin inline mr-1.5" aria-hidden="true" />
                  Loading contact groups...
                </div>
              ) : groupsError ? (
                <div className="p-5 text-xs text-rose-800 bg-rose-50 space-y-2">
                  <p>{groupsError}</p>
                  <button type="button" onClick={fetchGroups} className="underline font-semibold cursor-pointer">
                    Try again
                  </button>
                </div>
              ) : visibleGroups.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-700 space-y-2">
                  <p>No contact groups match your filter.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setGroupName("");
                      setGroupDesc("");
                      setGroupModal({ mode: "create" });
                    }}
                    className="px-3 py-2 rounded-lg bg-emerald-700 text-white font-semibold cursor-pointer"
                  >
                    Create your first group
                  </button>
                </div>
              ) : (
                <ul className="divide-y divide-slate-200 max-h-[560px] overflow-y-auto">
                  {visibleGroups.map((g) => {
                    const selected = Number(selectedGroupId) === Number(g.id);
                    return (
                      <li key={g.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedGroupId(g.id)}
                          className={`w-full text-left px-4 py-3 flex items-start justify-between gap-3 cursor-pointer transition-colors ${
                            selected ? "bg-emerald-50 border-l-4 border-emerald-700" : "hover:bg-slate-50"
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900 truncate">{g.name}</div>
                            {g.description && <div className="text-xs text-slate-600 truncate mt-0.5">{g.description}</div>}
                          </div>
                          <span className="shrink-0 px-2 py-0.5 rounded bg-slate-200 text-slate-900 text-xs font-semibold">
                            {g.contact_count ?? g.total_contacts ?? 0}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Right Pane: Selected Group Contacts & Actions */}
            <section aria-label="Selected group details" className="lg:col-span-8 bg-white rounded-xl border border-slate-300 overflow-hidden">
              {!activeGroup ? (
                <div className="p-10 text-center space-y-2">
                  <Users className="w-8 h-8 text-slate-500 mx-auto" aria-hidden="true" />
                  <h2 className="text-base font-semibold text-slate-900">Select a contact group</h2>
                  <p className="text-xs text-slate-600">
                    Choose a group on the left to manage members, verify consent eligibility, or launch a personalized WhatsApp campaign.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {/* Group Action Header */}
                  <div className="p-5 flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-slate-900">{activeGroup.name}</h2>
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-300 text-xs font-semibold text-slate-800">
                          {groupContacts.length} contacts
                        </span>
                      </div>
                      {activeGroup.description && <p className="text-xs text-slate-700 mt-1">{activeGroup.description}</p>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/whatsapp/campaigns/create?group_id=${activeGroup.id}`)}
                        className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-lg bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Create campaign</span>
                      </button>
                      <button
                        type="button"
                        onClick={openCrmPicker}
                        className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-800 text-xs font-semibold hover:bg-slate-100 cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Pick from CRM</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setImportOpen(true)}
                        className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-800 text-xs font-semibold hover:bg-slate-100 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Upload CSV/XLSX</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleCheckEligibility}
                        disabled={eligibilityLoading}
                        className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-800 text-xs font-semibold hover:bg-slate-100 cursor-pointer disabled:cursor-not-allowed"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
                        <span>{eligibilityLoading ? "Checking..." : "Check eligibility"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleExportCsv}
                        disabled={groupContacts.length === 0}
                        aria-label="Export group as CSV"
                        className="min-h-[40px] px-2.5 py-2 rounded-lg bg-white border border-slate-300 text-slate-800 hover:bg-slate-100 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Download className="w-4 h-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setGroupName(activeGroup.name || "");
                          setGroupDesc(activeGroup.description || "");
                          setGroupModal({ mode: "edit", group: activeGroup });
                        }}
                        aria-label="Rename group"
                        className="min-h-[40px] px-2.5 py-2 rounded-lg bg-white border border-slate-300 text-slate-800 hover:bg-slate-100 cursor-pointer"
                      >
                        <Edit2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteGroup(activeGroup)}
                        aria-label="Delete group"
                        className="min-h-[40px] px-2.5 py-2 rounded-lg bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {/* Live Consent & Suppression Eligibility Breakdown */}
                  {eligibility?.stats && (
                    <div className="p-4 bg-slate-50 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                      <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                        <div className="text-slate-600">Eligible now</div>
                        <div className="text-lg font-bold text-emerald-800">{eligibility.stats.eligible_count}</div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                        <div className="text-slate-600">Missing consent</div>
                        <div className="text-lg font-bold text-amber-800">{eligibility.stats.no_consent_count}</div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                        <div className="text-slate-600">Suppressed / DNC</div>
                        <div className="text-lg font-bold text-rose-800">{eligibility.stats.suppressed_count}</div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                        <div className="text-slate-600">Opted out</div>
                        <div className="text-lg font-bold text-rose-800">{eligibility.stats.opted_out_count}</div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                        <div className="text-slate-600">Invalid / Dup</div>
                        <div className="text-lg font-bold text-slate-900">
                          {eligibility.stats.invalid_phone_count + eligibility.stats.duplicate_count}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Quick Inline Add Contact Row */}
                  <form onSubmit={handleAddSingleContact} className="p-4 bg-slate-50/70 grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                    <div>
                      <label htmlFor="quick-phone" className="block text-xs font-semibold text-slate-800 mb-1">Phone *</label>
                      <input
                        id="quick-phone"
                        required
                        value={singlePhone}
                        onChange={(e) => setSinglePhone(e.target.value)}
                        placeholder="+91 9876543210"
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <label htmlFor="quick-name" className="block text-xs font-semibold text-slate-800 mb-1">Contact name</label>
                      <input
                        id="quick-name"
                        value={singleName}
                        onChange={(e) => setSingleName(e.target.value)}
                        placeholder="Your customer name"
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <label htmlFor="quick-notes" className="block text-xs font-semibold text-slate-800 mb-1">City or note</label>
                      <input
                        id="quick-notes"
                        value={singleNotes}
                        onChange={(e) => setSingleNotes(e.target.value)}
                        placeholder="City, tag, or reference"
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={importing}
                      className="min-h-[38px] px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 cursor-pointer disabled:cursor-not-allowed"
                    >
                      {importing ? "Adding..." : "Add contact"}
                    </button>
                  </form>

                  {/* Members Search + Table */}
                  <div className="p-4 space-y-3">
                    <div className="relative max-w-xs">
                      <label htmlFor="member-search" className="sr-only">Filter group members</label>
                      <Search className="w-4 h-4 text-slate-500 absolute left-2.5 top-2.5" aria-hidden="true" />
                      <input
                        id="member-search"
                        value={contactSearch}
                        onChange={(e) => setContactSearch(e.target.value)}
                        placeholder="Search contacts in group..."
                        className="w-full pl-8 pr-3 py-2 text-xs border border-slate-300 rounded-lg"
                      />
                    </div>

                    <div className="overflow-x-auto border border-slate-200 rounded-lg">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-100 text-left text-slate-800 font-semibold">
                          <tr>
                            <th className="px-3 py-2.5">Name</th>
                            <th className="px-3 py-2.5">Phone</th>
                            <th className="px-3 py-2.5">Notes / Context</th>
                            <th className="px-3 py-2.5 text-right">Remove</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {contactsLoading ? (
                            <tr>
                              <td colSpan={4} className="px-3 py-8 text-center text-slate-700">
                                <Loader2 className="w-4 h-4 animate-spin inline mr-1.5" aria-hidden="true" />
                                Loading group members...
                              </td>
                            </tr>
                          ) : visibleContacts.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="px-3 py-8 text-center text-slate-700">
                                No contacts in this group yet. Add a number above, pick from CRM, or upload a CSV/XLSX sheet.
                              </td>
                            </tr>
                          ) : (
                            visibleContacts.map((c) => (
                              <tr key={c.id} className="hover:bg-slate-50">
                                <td className="px-3 py-2.5 font-medium text-slate-900">{c.name || "Unnamed contact"}</td>
                                <td className="px-3 py-2.5 font-mono text-slate-800">{c.phone}</td>
                                <td className="px-3 py-2.5 text-slate-700">{c.notes || ""}</td>
                                <td className="px-3 py-2.5 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveContact(c.id)}
                                    aria-label={`Remove ${c.name || c.phone}`}
                                    className="p-1.5 rounded text-slate-600 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {/* TAB 2: DYNAMIC CRM SEGMENTS */}
        {activeTab === "segments" && (
          <div className="space-y-5">
            {presets.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-300 p-4">
                <div className="text-xs font-bold text-slate-800 mb-2">Starter segment rules</div>
                <div className="flex flex-wrap gap-2">
                  {presets.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => applyPreset(p)}
                      className="min-h-[36px] px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-emerald-50 border border-slate-300 text-slate-800 text-xs font-medium cursor-pointer"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              <form onSubmit={handleSaveSegment} className="lg:col-span-8 bg-white rounded-xl border border-slate-300 p-5 space-y-4">
                <h2 className="text-base font-bold text-slate-900">Build dynamic CRM segment</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="seg-name" className="block text-xs font-semibold text-slate-800 mb-1">Segment name *</label>
                    <input
                      id="seg-name"
                      required
                      value={segName}
                      onChange={(e) => setSegName(e.target.value)}
                      placeholder="VIP customers in Chennai"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label htmlFor="seg-desc" className="block text-xs font-semibold text-slate-800 mb-1">Description</label>
                    <input
                      id="seg-desc"
                      value={segDesc}
                      onChange={(e) => setSegDesc(e.target.value)}
                      placeholder="Who this audience targets"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Include contacts matching</span>
                    <select
                      aria-label="Match logic"
                      value={segLogic}
                      onChange={(e) => setSegLogic(e.target.value)}
                      className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white cursor-pointer"
                    >
                      <option value="AND">All conditions (AND)</option>
                      <option value="OR">Any condition (OR)</option>
                    </select>
                  </div>

                  {includeRules.map((rule, idx) => (
                    <div key={idx} className="flex flex-wrap gap-2 items-center">
                      <select
                        aria-label={`Include field ${idx + 1}`}
                        value={rule.field}
                        onChange={(e) => setIncludeRules((r) => r.map((x, i) => (i === idx ? { ...x, field: e.target.value } : x)))}
                        className="px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white cursor-pointer"
                      >
                        {SEGMENT_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                      <select
                        aria-label={`Include operator ${idx + 1}`}
                        value={rule.operator}
                        onChange={(e) => setIncludeRules((r) => r.map((x, i) => (i === idx ? { ...x, operator: e.target.value } : x)))}
                        className="px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white cursor-pointer"
                      >
                        {SEGMENT_OPERATORS.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
                      </select>
                      <input
                        aria-label={`Include value ${idx + 1}`}
                        value={rule.value}
                        onChange={(e) => setIncludeRules((r) => r.map((x, i) => (i === idx ? { ...x, value: e.target.value } : x)))}
                        placeholder="Value"
                        className="flex-1 min-w-[140px] px-2.5 py-2 text-xs border border-slate-300 rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => setIncludeRules((r) => r.filter((_, i) => i !== idx))}
                        aria-label="Remove include rule"
                        className="p-2 text-slate-600 hover:text-rose-700 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setIncludeRules((r) => [...r, { field: "tags", operator: "contains", value: "" }])}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:underline cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Add include rule
                  </button>
                </div>

                <div className="pt-3 border-t border-slate-200 space-y-2">
                  <span className="text-xs font-bold text-slate-800 block">Exclude contacts matching</span>
                  {excludeRules.map((rule, idx) => (
                    <div key={idx} className="flex flex-wrap gap-2 items-center">
                      <select
                        aria-label={`Exclude field ${idx + 1}`}
                        value={rule.field}
                        onChange={(e) => setExcludeRules((r) => r.map((x, i) => (i === idx ? { ...x, field: e.target.value } : x)))}
                        className="px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white cursor-pointer"
                      >
                        {SEGMENT_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                      <select
                        aria-label={`Exclude operator ${idx + 1}`}
                        value={rule.operator}
                        onChange={(e) => setExcludeRules((r) => r.map((x, i) => (i === idx ? { ...x, operator: e.target.value } : x)))}
                        className="px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white cursor-pointer"
                      >
                        {SEGMENT_OPERATORS.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
                      </select>
                      <input
                        aria-label={`Exclude value ${idx + 1}`}
                        value={rule.value}
                        onChange={(e) => setExcludeRules((r) => r.map((x, i) => (i === idx ? { ...x, value: e.target.value } : x)))}
                        placeholder="Value"
                        className="flex-1 min-w-[140px] px-2.5 py-2 text-xs border border-slate-300 rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => setExcludeRules((r) => r.filter((_, i) => i !== idx))}
                        aria-label="Remove exclude rule"
                        className="p-2 text-slate-600 hover:text-rose-700 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setExcludeRules((r) => [...r, { field: "tags", operator: "contains", value: "" }])}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-rose-800 hover:underline cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Add exclude rule
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleEstimateSegment}
                    disabled={estimating}
                    className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <Calculator className="w-4 h-4" aria-hidden="true" />
                    <span>{estimating ? "Calculating..." : "Estimate eligible recipients"}</span>
                  </button>
                  <button
                    type="submit"
                    disabled={savingSeg}
                    className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-lg bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <Users className="w-4 h-4" aria-hidden="true" />
                    <span>{savingSeg ? "Saving..." : "Save segment"}</span>
                  </button>
                </div>
              </form>

              <aside className="lg:col-span-4 bg-white rounded-xl border border-slate-300 p-5 space-y-3">
                <h3 className="text-sm font-bold text-slate-900">Backend eligibility preview</h3>
                {!segEstimate?.stats ? (
                  <p className="text-xs text-slate-700">
                    Run an estimate to count matched CRM records, consent coverage, opt-outs, and suppressions on the server.
                  </p>
                ) : (
                  <dl className="divide-y divide-slate-200 text-xs">
                    {[
                      ["Matched CRM contacts", segEstimate.stats.total_matched],
                      ["Unique valid phones", segEstimate.stats.unique_phones],
                      ["Missing consent", segEstimate.stats.no_consent_count],
                      ["Opted out", segEstimate.stats.opted_out_count],
                      ["Suppressed", segEstimate.stats.suppressed_count],
                      ["Eligible recipients", segEstimate.stats.eligible_count],
                    ].map(([label, value]) => (
                      <div key={label} className="py-2 flex justify-between">
                        <dt className="text-slate-700">{label}</dt>
                        <dd className="font-bold text-slate-900">{value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </aside>
            </div>

            {/* Saved Segments Table */}
            <div className="bg-white rounded-xl border border-slate-300 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 text-sm font-bold text-slate-900">
                Saved dynamic segments ({segments.length})
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 text-left text-slate-800 font-semibold">
                    <tr>
                      <th className="px-4 py-2.5">Segment name</th>
                      <th className="px-4 py-2.5">Type</th>
                      <th className="px-4 py-2.5">Estimated eligible</th>
                      <th className="px-4 py-2.5 text-right">Campaign</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {segmentsLoading ? (
                      <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-700">Loading segments...</td></tr>
                    ) : segments.length === 0 ? (
                      <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-700">No saved segments yet. Build and save a segment above.</td></tr>
                    ) : (
                      segments.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-semibold text-slate-900">{s.name}</td>
                          <td className="px-4 py-3 text-slate-700">{s.segment_type} (v{s.version})</td>
                          <td className="px-4 py-3 font-bold text-emerald-800">{s.estimated_count || 0}</td>
                          <td className="px-4 py-3 text-right">
                            <Link
                              to={`/whatsapp/campaigns/create?segment_id=${s.id}`}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-700 text-white font-semibold hover:bg-emerald-800 cursor-pointer"
                            >
                              Create campaign
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Create / Edit Group */}
      {groupModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="group-modal-title">
          <form onSubmit={handleSaveGroup} className="bg-white rounded-xl border border-slate-300 w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 id="group-modal-title" className="text-base font-bold text-slate-900">
                {groupModal.mode === "edit" ? "Rename contact group" : "Create contact group"}
              </h2>
              <button type="button" onClick={() => setGroupModal(null)} aria-label="Close modal" className="p-1 rounded hover:bg-slate-100 cursor-pointer">
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
            <div>
              <label htmlFor="modal-group-name" className="block text-xs font-semibold text-slate-800 mb-1">Group name *</label>
              <input
                id="modal-group-name"
                required
                autoFocus
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Festival offer subscribers"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label htmlFor="modal-group-desc" className="block text-xs font-semibold text-slate-800 mb-1">Description</label>
              <textarea
                id="modal-group-desc"
                rows={2}
                value={groupDesc}
                onChange={(e) => setGroupDesc(e.target.value)}
                placeholder="Notes on who belongs in this list"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setGroupModal(null)} className="min-h-[40px] px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold cursor-pointer">
                Cancel
              </button>
              <button type="submit" disabled={savingGroup} className="min-h-[40px] px-4 py-2 rounded-lg bg-emerald-700 text-white text-xs font-semibold cursor-pointer">
                {savingGroup ? "Saving..." : "Save group"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: CSV/XLSX & Bulk Paste Import into Group */}
      {importOpen && activeGroup && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="import-modal-title">
          <div className="bg-white rounded-xl border border-slate-300 w-full max-w-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 id="import-modal-title" className="text-base font-bold text-slate-900">
                Add contacts to {activeGroup.name}
              </h2>
              <button type="button" onClick={() => setImportOpen(false)} aria-label="Close modal" className="p-1 rounded hover:bg-slate-100 cursor-pointer">
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
            <div className="space-y-2">
              <label htmlFor="group-file-upload" className="block text-xs font-semibold text-slate-800">Upload CSV or Excel (.xlsx)</label>
              <input id="group-file-upload" type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} className="block w-full text-xs text-slate-800" />
              {fileLabel && (
                <p className="text-xs text-emerald-800 font-medium">
                  Loaded {fileLabel}: {parsedFileContacts.length} valid contacts ready.
                </p>
              )}
            </div>
            <div>
              <label htmlFor="group-bulk-paste" className="block text-xs font-semibold text-slate-800 mb-1">
                Or paste lines (phone, name, note)
              </label>
              <textarea
                id="group-bulk-paste"
                rows={4}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder="919876543210, Your Name, Chennai"
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setImportOpen(false)} className="min-h-[40px] px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold cursor-pointer">
                Cancel
              </button>
              <button type="button" onClick={handleConfirmImport} disabled={importing} className="min-h-[40px] px-4 py-2 rounded-lg bg-emerald-700 text-white text-xs font-semibold cursor-pointer">
                {importing ? "Importing..." : "Add contacts"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: CRM Contact Picker */}
      {pickerOpen && activeGroup && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="crm-picker-title">
          <div className="bg-white rounded-xl border border-slate-300 w-full max-w-2xl p-5 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between">
              <h2 id="crm-picker-title" className="text-base font-bold text-slate-900">
                Select CRM contacts for {activeGroup.name}
              </h2>
              <button type="button" onClick={() => setPickerOpen(false)} aria-label="Close modal" className="p-1 rounded hover:bg-slate-100 cursor-pointer">
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                aria-label="Search CRM contacts"
                value={crmSearch}
                onChange={(e) => setCrmSearch(e.target.value)}
                placeholder="Search name, phone, city..."
                className="flex-1 min-w-[180px] px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
              <select
                aria-label="Filter by CRM source"
                value={crmSourceFilter}
                onChange={(e) => setCrmSourceFilter(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white cursor-pointer"
              >
                {crmSourceTypes.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button
                type="button"
                onClick={() => setSelectedPhones(new Set(filteredCrmSources.map((c) => c.phone)))}
                className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold cursor-pointer"
              >
                Select visible ({filteredCrmSources.length})
              </button>
            </div>
            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-200">
              {crmLoading ? (
                <div className="p-6 text-center text-xs text-slate-700">Loading CRM contacts...</div>
              ) : filteredCrmSources.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-700">No CRM contacts match your search.</div>
              ) : (
                filteredCrmSources.map((c) => {
                  const checked = selectedPhones.has(c.phone);
                  return (
                    <label key={c.id} className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-slate-50 cursor-pointer text-xs">
                      <span className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const next = new Set(selectedPhones);
                            if (checked) next.delete(c.phone);
                            else next.add(c.phone);
                            setSelectedPhones(next);
                          }}
                        />
                        <span className="font-semibold text-slate-900 truncate">{c.name}</span>
                        <span className="font-mono text-slate-700">{c.phone}</span>
                      </span>
                      <span className="text-slate-600 shrink-0">{c.source}{c.city ? ` (${c.city})` : ""}</span>
                    </label>
                  );
                })
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">{selectedPhones.size} selected</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setPickerOpen(false)} className="min-h-[40px] px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold cursor-pointer">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddSelectedFromCrm}
                  disabled={addingFromCrm || selectedPhones.size === 0}
                  className="min-h-[40px] px-4 py-2 rounded-lg bg-emerald-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addingFromCrm ? "Adding..." : `Add ${selectedPhones.size} to group`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
