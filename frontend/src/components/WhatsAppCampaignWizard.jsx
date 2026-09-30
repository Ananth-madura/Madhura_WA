import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import {
  X, Users, MessageSquare, MapPin, Rocket, ChevronRight, ChevronLeft,
  Upload, Image as ImageIcon, Video, Loader2, CheckCircle2, Trash2,
  FileSpreadsheet, UserPlus, Search, Navigation, Clock, Sparkles,
} from "lucide-react";
import axios from "axios";
import { API } from "../config/api";
import { evaluateMessagePlaceholders } from "./WAVariablePicker";

const STEPS = ["Contacts", "Message", "Location", "Review"];
const DELAY_MIN_SECONDS = 7;
const DELAY_MAX_SECONDS = 17; // random gap in this range between every message (7s–17s customizable anti-ban delay)

function normalizePhone(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  return digits.slice(-10);
}

function dedupeContacts(list) {
  const seen = new Set();
  const out = [];
  for (const c of list) {
    const phone = normalizePhone(c.phone);
    if (phone.length !== 10 || seen.has(phone)) continue;
    seen.add(phone);
    out.push({ ...c, phone });
  }
  return out;
}

export default function WhatsAppCampaignWizard({ isOpen, onClose, onSuccess, initialContacts = [] }) {
  const [step, setStep] = useState(1);
  const [error, setError] = useState(null);

  // ── Step 1: contacts ─────────────────────────────────────────────────────
  const [contactsTab, setContactsTab] = useState("crm");
  const [contacts, setContacts] = useState([]);
  const [crmSource, setCrmSource] = useState([]);
  const [crmLoading, setCrmLoading] = useState(false);
  const [crmSearch, setCrmSearch] = useState("");
  const [crmSelected, setCrmSelected] = useState(new Set());
  const [fileRows, setFileRows] = useState([]);
  const [fileError, setFileError] = useState(null);
  const [manualPaste, setManualPaste] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");

  // ── Step 2: message ──────────────────────────────────────────────────────
  const [messageType, setMessageType] = useState("text"); // text | template
  const [messageText, setMessageText] = useState("");
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState("");
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [uploadedMedia, setUploadedMedia] = useState(null); // {url, media_type}
  const [uploading, setUploading] = useState(false);

  // ── Step 3: location ─────────────────────────────────────────────────────
  const [includeLocation, setIncludeLocation] = useState(false);
  const [locName, setLocName] = useState("");
  const [locAddress, setLocAddress] = useState("");
  const [locLat, setLocLat] = useState("");
  const [locLng, setLocLng] = useState("");
  const [locating, setLocating] = useState(false);

  // ── Step 4: review & anti-ban settings ────────────────────────────────────
  const [campaignName, setCampaignName] = useState("");
  const [pacingMode, setPacingMode] = useState("safe_800"); // "safe_800" | "standard"
  const [senderPools, setSenderPools] = useState([]);
  const [selectedPoolId, setSelectedPoolId] = useState("");
  const [routingStrategy, setRoutingStrategy] = useState("round_robin");
  const [spintaxEnabled, setSpintaxEnabled] = useState(true);
  const [warmupMode, setWarmupMode] = useState(false);
  const [launching, setLaunching] = useState(false);

  const headers = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

  useEffect(() => {
    if (!isOpen) return;
    // reset on open
    setStep(1); setError(null); setContacts(dedupeContacts(initialContacts)); setCrmSelected(new Set());
    setFileRows([]); setFileError(null); setManualPaste(""); setManualName(""); setManualPhone("");
    setMessageType("text"); setMessageText(""); setTemplateId("");
    setMediaFile(null); setMediaPreview(null); setUploadedMedia(null);
    setIncludeLocation(false); setLocName(""); setLocAddress(""); setLocLat(""); setLocLng("");
    setCampaignName("");
    setSelectedPoolId("");
    setRoutingStrategy("round_robin");
    setSpintaxEnabled(true);
    setWarmupMode(false);

    setCrmLoading(true);
    axios.get(`${API}/api/wa/groups/sources/all`, { headers: headers() })
      .then(({ data }) => setCrmSource(data || []))
      .catch(() => {})
      .finally(() => setCrmLoading(false));
    axios.get(`${API}/api/wa/templates`, { headers: headers() })
      .then(({ data }) => setTemplates(data || []))
      .catch(() => {});
    axios.get(`${API}/api/wa/campaigns/sender-pools`, { headers: headers() })
      .then(({ data }) => setSenderPools(data || []))
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  // ── Contacts step handlers ───────────────────────────────────────────────
  const filteredCrm = crmSource.filter(c =>
    (c.name || "").toLowerCase().includes(crmSearch.toLowerCase()) || (c.phone || "").includes(crmSearch)
  );

  const toggleCrmContact = (c) => {
    setCrmSelected(prev => {
      const next = new Set(prev);
      if (next.has(c.phone)) next.delete(c.phone); else next.add(c.phone);
      return next;
    });
  };

  const applyCrmSelection = () => {
    const picked = crmSource.filter(c => crmSelected.has(c.phone));
    setContacts(prev => dedupeContacts([...prev, ...picked]));
  };

  const handleFileImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError(null);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        if (!rows.length) { setFileError("File has no rows"); return; }
        const keys = Object.keys(rows[0]);
        const phoneKey = keys.find(k => /phone|mobile|contact|number/i.test(k)) || keys[0];
        const nameKey = keys.find(k => /name/i.test(k)) || keys[1] || keys[0];
        const parsed = rows.map(r => ({ name: String(r[nameKey] || "").trim(), phone: r[phoneKey], source: "Imported File" }));
        const valid = dedupeContacts(parsed);
        setFileRows(valid);
        if (!valid.length) setFileError("No valid 10-digit phone numbers found in this file");
      } catch (err) {
        setFileError("Could not read file: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const applyFileRows = () => {
    setContacts(prev => dedupeContacts([...prev, ...fileRows]));
    setFileRows([]);
  };

  const applyManualPaste = () => {
    const rows = manualPaste.split("\n").map(l => l.trim()).filter(Boolean).map(line => {
      const parts = line.split(",").map(p => p.trim());
      return { phone: parts[0], name: parts[1] || "Contact", source: "Manual" };
    });
    setContacts(prev => dedupeContacts([...prev, ...rows]));
    setManualPaste("");
  };

  const addSingleManual = () => {
    if (!manualPhone.trim()) return;
    setContacts(prev => dedupeContacts([...prev, { name: manualName || "Contact", phone: manualPhone, source: "Manual" }]));
    setManualName(""); setManualPhone("");
  };

  const removeContact = (phone) => setContacts(prev => prev.filter(c => c.phone !== phone));

  // ── Message step handlers ────────────────────────────────────────────────
  const handleMediaSelect = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file again after a failed upload
    if (!file) return;
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await axios.post(`${API}/api/wa/campaigns/upload-media`, formData, { headers: headers() });
      setUploadedMedia(data);
    } catch (err) {
      setError(err.response?.data?.error || "Media upload failed");
      setMediaFile(null); setMediaPreview(null);
    }
    setUploading(false);
  };

  const removeMedia = () => { setMediaFile(null); setMediaPreview(null); setUploadedMedia(null); };

  // ── Location step handlers ───────────────────────────────────────────────
  const useMyLocation = () => {
    if (!navigator.geolocation) { setError("Geolocation is not supported by this browser"); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocLat(pos.coords.latitude.toFixed(6));
        setLocLng(pos.coords.longitude.toFixed(6));
        setLocating(false);
      },
      (err) => { setError("Could not get location: " + err.message); setLocating(false); },
      { timeout: 10000 }
    );
  };

  // ── Step validation ──────────────────────────────────────────────────────
  // Step 2 only blocks on an unfinished template pick — plain text and media are both
  // optional there, since a location-only broadcast (set in step 3) is also valid.
  const canNextFromStep1 = contacts.length > 0;
  const canNextFromStep2 = messageType !== "template" || !!templateId;
  const canNextFromStep3 = !includeLocation || (locLat !== "" && locLng !== "");
  const hasAnyContent = messageType === "template" ? !!templateId : (messageText.trim().length > 0 || !!uploadedMedia || includeLocation);
  const canLaunch = campaignName.trim().length > 0 && canNextFromStep1 && canNextFromStep2 && canNextFromStep3 && hasAnyContent && !uploading;

  const goNext = () => {
    setError(null);
    if (step === 1 && !canNextFromStep1) return setError("Select at least one contact");
    if (step === 2 && !canNextFromStep2) return setError("Pick a template, or switch to Custom Text");
    if (step === 3 && !canNextFromStep3) return setError("Provide latitude & longitude, or turn off location sharing");
    setStep(s => Math.min(4, s + 1));
  };
  const goBack = () => setStep(s => Math.max(1, s - 1));

  const handleLaunch = async () => {
    if (!canLaunch) return;
    setLaunching(true);
    setError(null);
    try {
      const isSafeMode = pacingMode === "safe_800";
      const payload = {
        name: campaignName.trim(),
        contacts: contacts.map(c => ({ name: c.name, phone: c.phone, source: c.source })),
        message: {
          text: messageText.trim() || null,
          template_id: messageType === "template" ? templateId : null,
          media_type: uploadedMedia?.media_type || null,
          media_url: uploadedMedia?.url || null,
        },
        location: includeLocation ? {
          lat: parseFloat(locLat), lng: parseFloat(locLng),
          name: locName || null, address: locAddress || null,
        } : null,
        delay_min: isSafeMode ? 35 : DELAY_MIN_SECONDS,
        delay_max: isSafeMode ? 55 : DELAY_MAX_SECONDS,
        pause_every: 25,
        pause_duration_min: isSafeMode ? 180 : 120,
        daily_limit: isSafeMode ? 800 : 0,
        start_time: "09:00",
        end_time: "20:00",
        pool_id: selectedPoolId ? parseInt(selectedPoolId) : null,
        routing_strategy: routingStrategy,
        spintax_enabled: spintaxEnabled ? 1 : 0,
        warmup_mode: warmupMode ? 1 : 0,
      };
      const { data } = await axios.post(`${API}/api/wa/campaigns/create-wizard`, payload, { headers: headers() });
      if (onSuccess) onSuccess(data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to launch campaign");
    }
    setLaunching(false);
  };

  const selectedTemplate = templates.find(t => String(t.id) === String(templateId));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-shell)]/60 p-4 backdrop-blur-sm">
      <div className="hl-card bg-[var(--color-paper-2)] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-hidden flex flex-col border border-[var(--color-rule)]">
        {/* Header */}
        <div className="hl-commandbar flex items-center justify-between px-6 py-4 border-b border-[var(--color-rule)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[var(--color-accent)] rounded-xl text-[var(--color-accent-ink)]"><Rocket size={20} /></div>
            <div>
              <h2 className="hl-title text-lg font-bold text-[var(--color-ink)]">New WhatsApp Broadcast</h2>
              <p className="hl-subtitle text-xs text-[var(--color-ink-2)]">Step {step} of 4 — {STEPS[step - 1]}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[var(--color-ink-2)] hover:text-[var(--color-ink)]"><X size={20} /></button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center px-6 py-3 border-b border-[var(--color-rule)] shrink-0 gap-1">
          {STEPS.map((label, i) => {
            const n = i + 1;
            const active = n === step, done = n < step;
            return (
              <div key={label} className="flex items-center flex-1 last:flex-none">
                <div className={`flex items-center gap-2 ${n !== 4 ? "flex-1" : ""}`}>
                  <div className={`hl-badge w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition ${
                    done ? "hl-badge-success" : active ? "hl-badge-accent" : ""
                  }`}>
                    {done ? <CheckCircle2 size={14} /> : n}
                  </div>
                  <span className={`hl-badge text-xs font-semibold hidden sm:inline border-0 ${active ? "text-[var(--color-ink)]" : "text-[var(--color-ink-2)]"}`}>{label}</span>
                </div>
                {n !== 4 && <div className={`h-0.5 flex-1 mx-2 ${done ? "bg-[var(--color-accent)]" : "bg-[var(--color-rule)]"}`} />}
              </div>
            );
          })}
        </div>

        {error && (
          <div className="mx-6 mt-3 p-2.5 hl-badge hl-badge-error rounded-lg text-xs shrink-0">{error}</div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* STEP 1: Contacts */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex gap-2">
                {[["crm", "From CRM", Users], ["file", "Import CSV/Excel", FileSpreadsheet], ["manual", "Manual Entry", UserPlus]].map(([key, label, Icon]) => (
                  <button key={key} onClick={() => setContactsTab(key)}
                    className={`hl-badge flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${contactsTab === key ? "hl-badge-accent" : ""}`}>
                    <Icon size={14} /> {label}
                  </button>
                ))}
              </div>

              {contactsTab === "crm" && (
                <div className="hl-card border border-[var(--color-rule)] rounded-xl overflow-hidden">
                  <div className="p-2 border-b border-[var(--color-rule)] flex items-center gap-2 bg-[var(--color-paper)]">
                    <Search size={14} className="text-[var(--color-ink-2)] ml-1" />
                    <input value={crmSearch} onChange={e => setCrmSearch(e.target.value)} placeholder="Search clients, leads..."
                      className="hl-input flex-1 bg-[var(--color-paper-2)] text-sm outline-none py-1 text-[var(--color-ink)] font-[var(--font-body)] border-0" />
                    <span className="text-xs text-[var(--color-ink-2)] pr-2">{crmSelected.size} selected</span>
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    {crmLoading ? (
                      <div className="p-6 text-center"><Loader2 className="animate-spin mx-auto text-[var(--color-ink-2)]" size={20} /></div>
                    ) : filteredCrm.length === 0 ? (
                      <p className="hl-empty p-4 text-xs text-center text-[var(--color-ink-2)]">No CRM contacts with phone numbers found</p>
                    ) : (
                      filteredCrm.map((c, i) => (
                        <label key={i} className="flex items-center gap-3 px-3 py-2 hover:bg-[var(--color-paper)] border-b border-[var(--color-rule)] last:border-0 cursor-pointer">
                          <input type="checkbox" checked={crmSelected.has(c.phone)} onChange={() => toggleCrmContact(c)} className="w-4 h-4 rounded" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-[var(--color-ink)] truncate font-[var(--font-body)]">{c.name}</p>
                            <p className="hl-id text-xs text-[var(--color-ink-2)]">{c.phone} · {c.source}</p>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                  <div className="p-2 border-t border-[var(--color-rule)] bg-[var(--color-paper)]">
                    <button onClick={applyCrmSelection} disabled={!crmSelected.size}
                      className="hl-btn-primary w-full py-2 rounded-lg text-xs font-bold disabled:opacity-40">
                      Add {crmSelected.size || ""} Selected Contact{crmSelected.size === 1 ? "" : "s"}
                    </button>
                  </div>
                </div>
              )}

              {contactsTab === "file" && (
                <div className="hl-card border border-[var(--color-rule)] rounded-xl p-4 space-y-3">
                  <label className="flex flex-col items-center justify-center gap-2 py-6 border-2 border-dashed border-[var(--color-rule)] rounded-xl cursor-pointer hover:border-[var(--color-accent)] transition bg-[var(--color-paper)]">
                    <Upload size={24} className="text-[var(--color-ink-2)]" />
                    <span className="text-sm text-[var(--color-ink)] font-semibold font-[var(--font-body)]">Upload CSV, XLS or XLSX</span>
                    <span className="text-xs text-[var(--color-ink-2)]">Auto-detects Name & Phone columns</span>
                    <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileImport} />
                  </label>
                  {fileError && <p className="text-xs text-[var(--color-error)]">{fileError}</p>}
                  {fileRows.length > 0 && (
                    <>
                      <p className="text-xs text-[var(--color-ink-2)]">{fileRows.length} valid contacts parsed</p>
                      <div className="max-h-40 overflow-y-auto border border-[var(--color-rule)] rounded-lg bg-[var(--color-paper-2)]">
                        {fileRows.slice(0, 50).map((r, i) => (
                          <div key={i} className="flex items-center justify-between px-3 py-1.5 text-xs border-b border-[var(--color-rule)] last:border-0">
                            <span className="text-[var(--color-ink)]">{r.name}</span><span className="hl-id text-[var(--color-ink-2)] font-mono">{r.phone}</span>
                          </div>
                        ))}
                      </div>
                      <button onClick={applyFileRows} className="hl-btn-primary w-full py-2 rounded-lg text-xs font-bold">
                        Add {fileRows.length} Imported Contacts
                      </button>
                    </>
                  )}
                </div>
              )}

              {contactsTab === "manual" && (
                <div className="hl-card border border-[var(--color-rule)] rounded-xl p-4 space-y-3">
                  <div className="flex gap-2">
                    <input value={manualName} onChange={e => setManualName(e.target.value)} placeholder="Name"
                      className="hl-input flex-1 px-3 py-2 border border-[var(--color-rule)] rounded-lg text-sm outline-none" />
                    <input value={manualPhone} onChange={e => setManualPhone(e.target.value)} placeholder="Phone"
                      className="hl-input hl-id flex-1 px-3 py-2 border border-[var(--color-rule)] rounded-lg text-sm outline-none" />
                    <button onClick={addSingleManual} className="hl-btn-secondary px-3 py-2 rounded-lg text-xs font-bold shrink-0">Add</button>
                  </div>
                  <p className="text-xs text-[var(--color-ink-2)]">Or paste multiple lines as "phone, name" (one per line):</p>
                  <textarea value={manualPaste} onChange={e => setManualPaste(e.target.value)} rows={4}
                    placeholder={"9876543210, Rahul Sharma\n9123456780, Priya Singh"}
                    className="hl-input w-full px-3 py-2 border border-[var(--color-rule)] rounded-lg text-sm outline-none resize-none font-mono font-[var(--font-body)]" />
                  <button onClick={applyManualPaste} disabled={!manualPaste.trim()} className="hl-btn-primary w-full py-2 rounded-lg text-xs font-bold disabled:opacity-40">
                    Add Pasted Contacts
                  </button>
                </div>
              )}

              {/* Selected contacts summary */}
              <div className="hl-card bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="hl-section-label text-xs font-bold text-[var(--color-ink)]">{contacts.length} Contact{contacts.length === 1 ? "" : "s"} Selected</span>
                  {contacts.length > 0 && <button onClick={() => setContacts([])} className="hl-btn-danger-ghost text-xs px-2 py-0.5">Clear all</button>}
                </div>
                {contacts.length > 0 && (
                  <div className="max-h-28 overflow-y-auto space-y-1">
                    {contacts.map((c) => (
                      <div key={c.phone} className="flex items-center justify-between text-xs bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-lg px-2.5 py-1">
                        <span className="text-[var(--color-ink)] truncate">{c.name} <span className="hl-id text-[var(--color-ink-2)] font-mono">{c.phone}</span></span>
                        <button onClick={() => removeContact(c.phone)}><Trash2 size={12} className="text-[var(--color-error)]" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: Message */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <button onClick={() => setMessageType("text")}
                  className={`hl-badge flex-1 py-2 rounded-lg text-xs font-bold transition ${messageType === "text" ? "hl-badge-accent" : ""}`}>
                  Custom Text
                </button>
                <button onClick={() => setMessageType("template")}
                  className={`hl-badge flex-1 py-2 rounded-lg text-xs font-bold transition ${messageType === "template" ? "hl-badge-accent" : ""}`}>
                  Approved Template
                </button>
              </div>

              {messageType === "template" ? (
                <div>
                  <select value={templateId} onChange={e => setTemplateId(e.target.value)}
                    className="hl-select w-full px-3 py-2 border border-[var(--color-rule)] rounded-lg text-sm outline-none">
                    <option value="">Select a template</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.category})</option>)}
                  </select>
                  {selectedTemplate && (
                    <div className="mt-3 p-3.5 bg-[var(--color-shell)] rounded-xl border border-[var(--color-rule)] text-[var(--color-paper-2)] space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] text-[var(--color-accent)] font-bold uppercase tracking-wider">
                        <span className="flex items-center gap-1"><Sparkles size={12} /> Template Evaluated Preview:</span>
                        <span className="hl-id text-[9px] font-mono text-[var(--color-accent)]">Dynamic Placeholders Active</span>
                      </div>
                      <div className="p-2.5 bg-[var(--color-shell-2)] rounded-lg text-[var(--color-paper-2)] font-mono text-xs whitespace-pre-wrap leading-relaxed">
                        {evaluateMessagePlaceholders(selectedTemplate.body)}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div>
                    <div className="flex flex-col gap-1 mb-1.5">
                      <div className="flex items-center justify-between">
                        <label className="hl-section-label text-xs font-semibold uppercase text-[var(--color-ink-2)]">Message Text</label>
                        <span className="hl-id text-[10px] font-mono text-[var(--color-ink-2)]">{(messageText || "").length} chars</span>
                      </div>
                      <div className="flex flex-wrap gap-1 text-xs">
                        {[
                          { tag: "{name}", label: "Name" },
                          { tag: "{tomorrow}", label: "Tomorrow Date" },
                          { tag: "{tomorrow_day}", label: "Tomorrow Day" },
                          { tag: "{day}", label: "Day" },
                          { tag: "{date}", label: "Date" },
                          { tag: "{time}", label: "Time" },
                          { tag: "{date_time}", label: "Date & Time" },
                          { tag: "{greeting_time}", label: "Greeting" },
                          { tag: "{company}", label: "Company" },
                          { tag: "{service}", label: "Service" },
                          { tag: "{city}", label: "City" },
                          { tag: "{start_time}", label: "Start Time" },
                          { tag: "{end_time}", label: "End Time" },
                          { tag: "{amount}", label: "Amount" },
                          { tag: "{invoice_no}", label: "Invoice #" },
                          { tag: "{due_date}", label: "Due Date" },
                        ].map(({ tag, label }) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => setMessageText(prev => prev + (prev.length > 0 ? " " : "") + tag)}
                            className="hl-badge px-2 py-0.5 font-mono text-[11px] rounded transition border border-[var(--color-rule)] bg-[var(--color-paper)] text-[var(--color-ink)]"
                            title={`Insert ${label}`}
                          >
                            + {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                    <textarea rows={4} value={messageText} onChange={e => setMessageText(e.target.value)}
                      placeholder="Type your WhatsApp message... Use {Hi|Hello|Dear} {name}! Tomorrow {tomorrow} is {tomorrow_day}."
                      className="hl-input w-full px-3 py-2 border border-[var(--color-rule)] rounded-lg text-sm outline-none resize-none" />

                    {/* Anti-Ban Spintax & Opt-out Quick Buttons */}
                    <div className="mt-2 space-y-1.5 pt-2 border-t border-[var(--color-rule)]">
                      <div className="flex items-center justify-between">
                        <span className="hl-section-label text-[10px] font-bold uppercase text-[var(--color-ink)]">🛡️ Anti-Ban Word Randomizers:</span>
                        <span className="text-[9px] font-semibold text-[var(--color-ink-2)]">100% Unique per contact</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        {[
                          { label: "+ [hii|heloo|welcom|yes we are|how it's|how that all]", val: "[hii|heloo|welcom|yes we are|how it's|how that all]" },
                          { label: "+ {Hi|Hello|Hey|Greetings|Welcome}", val: "{Hi|Hello|Hey|Greetings|Welcome}" },
                          { label: "+ {Hope all is well|Greetings}", val: "{Hope you are doing well|Greetings from our team}" },
                          { label: "+ {We are pleased to offer|Yes we are here with}", val: "{We are pleased to share|Yes we are here with|Excited to introduce}" },
                          { label: "+ {Best regards|Warm wishes}", val: "{Best regards|Warm wishes}" },
                          { label: "+ Opt-out Footer", val: "\n\nReply STOP to unsubscribe" },
                        ].map(s => (
                          <button key={s.label} type="button" onClick={() => setMessageText(prev => prev + (prev.length > 0 ? " " : "") + s.val)}
                            className="hl-badge hl-badge-warn px-2 py-0.5 text-[10px] font-semibold rounded transition shadow-2xs">
                            {s.label}
                          </button>
                        ))}
                      </div>

                      {messageText && (
                        <div className="p-2 bg-[var(--color-shell)] text-[var(--color-paper-2)] rounded-lg text-[11px] font-mono mt-1">
                          <span className="text-[9px] font-bold text-[var(--color-accent)] uppercase block mb-0.5">🎲 Live Random Preview:</span>
                          {evaluateMessagePlaceholders(messageText)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="hl-section-label text-xs font-semibold uppercase mb-1 block text-[var(--color-ink-2)]">Attach Image or Video (optional)</label>
                    {!mediaPreview ? (
                      <label className="flex items-center justify-center gap-2 py-4 border-2 border-dashed border-[var(--color-rule)] rounded-xl cursor-pointer hover:border-[var(--color-accent)] transition bg-[var(--color-paper)]">
                        {uploading ? <Loader2 size={18} className="animate-spin text-[var(--color-ink)]" /> : <ImageIcon size={18} className="text-[var(--color-ink-2)]" />}
                        <span className="text-xs text-[var(--color-ink-2)]">{uploading ? "Uploading..." : "Click to select an image or video"}</span>
                        <input type="file" accept="image/*,video/*" className="hidden" onChange={handleMediaSelect} disabled={uploading} />
                      </label>
                    ) : (
                      <div className="relative border border-[var(--color-rule)] rounded-xl p-2 flex items-center gap-3 bg-[var(--color-paper-2)]">
                        {uploadedMedia?.media_type === "video" ? (
                          <video src={mediaPreview} className="w-16 h-16 rounded-lg object-cover bg-[var(--color-shell)]" />
                        ) : (
                          <img src={mediaPreview} alt="attachment" className="w-16 h-16 rounded-lg object-cover" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-[var(--color-ink)] truncate">{mediaFile?.name}</p>
                          {uploading ? (
                            <span className="text-xs text-[var(--color-focus)] flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Uploading...</span>
                          ) : uploadedMedia ? (
                            <span className="hl-badge hl-badge-success text-xs flex items-center gap-1"><CheckCircle2 size={12} /> Ready to send</span>
                          ) : null}
                        </div>
                        <button onClick={removeMedia} className="p-1.5 hover:bg-[var(--color-paper)] rounded text-[var(--color-error)]"><Trash2 size={14} className="text-[var(--color-error)]" /></button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* STEP 3: Location */}
          {step === 3 && (
            <div className="space-y-4">
              <label className="flex items-center justify-between p-3 bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-xl cursor-pointer">
                <div className="flex items-center gap-2">
                  <MapPin size={18} className="text-[var(--color-focus)]" />
                  <span className="text-sm font-semibold text-[var(--color-ink)] font-[var(--font-body)]">Share a pinned location with this broadcast</span>
                </div>
                <input type="checkbox" checked={includeLocation} onChange={e => setIncludeLocation(e.target.checked)} className="w-5 h-5 rounded" />
              </label>

              {includeLocation && (
                <div className="hl-card space-y-3 border border-[var(--color-rule)] rounded-xl p-4 bg-[var(--color-paper-2)]">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="hl-section-label text-xs font-semibold uppercase mb-1 block text-[var(--color-ink-2)]">Place Name</label>
                      <input value={locName} onChange={e => setLocName(e.target.value)} placeholder="e.g. Madhura Tech Office"
                        className="hl-input w-full px-3 py-2 border border-[var(--color-rule)] rounded-lg text-sm outline-none" />
                    </div>
                    <div>
                      <label className="hl-section-label text-xs font-semibold uppercase mb-1 block text-[var(--color-ink-2)]">Address</label>
                      <input value={locAddress} onChange={e => setLocAddress(e.target.value)} placeholder="Street, City"
                        className="hl-input w-full px-3 py-2 border border-[var(--color-rule)] rounded-lg text-sm outline-none" />
                    </div>
                    <div>
                      <label className="hl-section-label text-xs font-semibold uppercase mb-1 block text-[var(--color-ink-2)]">Latitude *</label>
                      <input value={locLat} onChange={e => setLocLat(e.target.value)} placeholder="12.9716"
                        className="hl-input hl-id w-full px-3 py-2 border border-[var(--color-rule)] rounded-lg text-sm outline-none font-mono" />
                    </div>
                    <div>
                      <label className="hl-section-label text-xs font-semibold uppercase mb-1 block text-[var(--color-ink-2)]">Longitude *</label>
                      <input value={locLng} onChange={e => setLocLng(e.target.value)} placeholder="77.5946"
                        className="hl-input hl-id w-full px-3 py-2 border border-[var(--color-rule)] rounded-lg text-sm outline-none font-mono" />
                    </div>
                  </div>
                  <button onClick={useMyLocation} disabled={locating}
                    className="hl-btn-secondary flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition">
                    {locating ? <Loader2 size={14} className="animate-spin" /> : <Navigation size={14} />}
                    Use My Current Location
                  </button>
                  <p className="text-xs text-[var(--color-ink-2)]">Sent as a native WhatsApp location pin every recipient can tap to open in Maps.</p>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Review & Launch */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <label className="hl-section-label text-xs font-semibold uppercase mb-1 block text-[var(--color-ink-2)]">Campaign Name *</label>
                <input value={campaignName} onChange={e => setCampaignName(e.target.value)} placeholder="e.g. July Special Promotion"
                  className="hl-input w-full px-3 py-2 border border-[var(--color-rule)] rounded-lg text-sm outline-none" />
              </div>

              <div className="hl-kpis grid grid-cols-2 gap-3 text-xs">
                <div className="hl-kpi bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-xl p-3">
                  <p className="hl-kpi-label font-semibold flex items-center gap-1.5 mb-1"><Users size={13} /> Recipients</p>
                  <p className="hl-kpi-num font-bold text-lg">{contacts.length}</p>
                </div>
                <div className="hl-kpi bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-xl p-3">
                  <p className="hl-kpi-label font-semibold flex items-center gap-1.5 mb-1"><MessageSquare size={13} /> Message</p>
                  <p className="text-[var(--color-ink)] truncate">{messageType === "template" ? (selectedTemplate?.name || "—") : (messageText || "(media only)")}</p>
                </div>
                {uploadedMedia && (
                  <div className="hl-kpi bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-xl p-3 flex items-center gap-2">
                    {uploadedMedia.media_type === "video" ? <Video size={14} className="text-[var(--color-ink-2)]" /> : <ImageIcon size={14} className="text-[var(--color-ink-2)]" />}
                    <span className="text-[var(--color-ink)]">1 {uploadedMedia.media_type} attached</span>
                  </div>
                )}
                {includeLocation && (
                  <div className="hl-kpi bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-xl p-3 flex items-center gap-2">
                    <MapPin size={14} className="text-[var(--color-ink-2)]" />
                    <span className="text-[var(--color-ink)] truncate">{locName || `${locLat}, ${locLng}`}</span>
                  </div>
                )}
              </div>

              {((messageType !== "template" && messageText) || (messageType === "template" && selectedTemplate?.body)) && (
                <div className="p-3 bg-[var(--color-shell)] text-[var(--color-paper-2)] rounded-xl border border-[var(--color-rule)] space-y-1 text-xs">
                  <div className="flex items-center justify-between text-[10px] text-[var(--color-accent)] font-bold uppercase">
                    <span>Sample Evaluated Message Preview:</span>
                    <span className="hl-id text-[var(--color-accent)] font-mono">Dynamic Live</span>
                  </div>
                  <div className="p-2 bg-[var(--color-shell-2)] rounded-lg text-[var(--color-paper-2)] font-mono text-[11px] whitespace-pre-wrap leading-relaxed">
                    {evaluateMessagePlaceholders(messageType === "template" ? selectedTemplate.body : messageText)}
                  </div>
                </div>
              )}

              {/* Sender Pool / Load Balancer Selector */}
              <div className="hl-card bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="hl-section-label text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 text-[var(--color-ink)]">
                    🌐 Sender Load Balancer & Multi-Number Pool
                  </span>
                  <span className="text-[10px] font-semibold text-[var(--color-ink-2)]">
                    {senderPools.length > 0 ? `${senderPools.length} Pool(s) Available` : "Direct Account Mode"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="hl-section-label text-[11px] font-semibold block mb-1 text-[var(--color-ink-2)]">Sender Route</label>
                    <select
                      value={selectedPoolId}
                      onChange={(e) => setSelectedPoolId(e.target.value)}
                      className="hl-select w-full px-2.5 py-1.5 border border-[var(--color-rule)] rounded-lg text-xs bg-[var(--color-paper-2)] outline-none"
                    >
                      <option value="">👤 My Linked WhatsApp Number (Single)</option>
                      {senderPools.map((p) => (
                        <option key={p.id} value={p.id}>
                          📦 {p.pool_name} ({p.active_members || 0} numbers)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="hl-section-label text-[11px] font-semibold block mb-1 text-[var(--color-ink-2)]">Distribution Strategy</label>
                    <select
                      value={routingStrategy}
                      onChange={(e) => setRoutingStrategy(e.target.value)}
                      className="hl-select w-full px-2.5 py-1.5 border border-[var(--color-rule)] rounded-lg text-xs bg-[var(--color-paper-2)] outline-none"
                    >
                      <option value="round_robin">🔄 Round-Robin (Equal Distribution)</option>
                      <option value="least_loaded">⚖️ Least-Loaded (Lowest Daily Count)</option>
                      <option value="cloud_first">☁️ Cloud API First (High Volume)</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-[var(--color-rule)] text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={warmupMode}
                      onChange={(e) => setWarmupMode(e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                    <span className="font-semibold text-[var(--color-ink)] font-[var(--font-body)]">New Number Safe Warm-Up Curve</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={spintaxEnabled}
                      onChange={(e) => setSpintaxEnabled(e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                    <span className="font-semibold text-[var(--color-ink)] font-[var(--font-body)]">Dynamic Spintax Variation</span>
                  </label>
                </div>
              </div>

              {/* Anti-Ban Pacing Mode Selector */}
              <div className="hl-card border border-[var(--color-rule)] bg-[var(--color-paper)] rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="hl-section-label text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 text-[var(--color-ink)]">
                    🛡️ Anti-Ban Engine & Daily Safety Cap
                  </span>
                  <span className="hl-badge hl-badge-success text-[10px] font-bold px-2 py-0.5 rounded-full">
                    Safe Sending Mode
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPacingMode("safe_800")}
                    className={`hl-card p-2.5 rounded-xl border text-left transition ${
                      pacingMode === "safe_800"
                        ? "bg-[var(--color-paper-2)] border-[var(--color-accent)]"
                        : "bg-[var(--color-paper)] border-[var(--color-rule)] text-[var(--color-ink-2)]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-[var(--color-ink)]">🛡️ 600–800 / Day Safe</span>
                      {pacingMode === "safe_800" && <CheckCircle2 size={14} className="text-[var(--color-focus)]" />}
                    </div>
                    <p className="text-[11px] text-[var(--color-ink-2)] leading-tight">35–55s gap + 3m rest every 25 msgs. Active 9am–8pm. <strong>Zero Ban Risk</strong>.</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPacingMode("standard")}
                    className={`hl-card p-2.5 rounded-xl border text-left transition ${
                      pacingMode === "standard"
                        ? "bg-[var(--color-paper-2)] border-[var(--color-accent)]"
                        : "bg-[var(--color-paper)] border-[var(--color-rule)] text-[var(--color-ink-2)]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-[var(--color-ink)]">⚡ Standard Pacing</span>
                      {pacingMode === "standard" && <CheckCircle2 size={14} className="text-[var(--color-focus)]" />}
                    </div>
                    <p className="text-[11px] text-[var(--color-ink-2)] leading-tight">7–12s gap for fast small broadcasts (&lt; 200 contacts).</p>
                  </button>
                </div>
              </div>

              {!hasAnyContent && (
                <div className="hl-badge hl-badge-error p-3 rounded-xl text-xs">
                  Add a message, media, or a location (go back a step) before you can launch.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-5 border-t border-[var(--color-rule)] shrink-0">
          <button onClick={step === 1 ? onClose : goBack}
            className="hl-btn-secondary flex items-center gap-1.5 px-4 py-2 border border-[var(--color-rule)] rounded-xl text-sm transition">
            <ChevronLeft size={16} /> {step === 1 ? "Cancel" : "Back"}
          </button>
          {step < 4 ? (
            <button onClick={goNext}
              className="hl-btn-primary flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold transition">
              Next <ChevronRight size={16} />
            </button>
          ) : (
            <button onClick={handleLaunch} disabled={!canLaunch || launching}
              className="hl-btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50 transition shadow-md">
              {launching ? <Loader2 size={16} className="animate-spin" /> : <Rocket size={16} />}
              {launching ? `Launching to ${contacts.length}...` : `Launch to ${contacts.length} Contacts`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
