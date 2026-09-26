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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-hidden flex flex-col border border-gray-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-green-100 rounded-xl text-[#25D366]"><Rocket size={20} /></div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">New WhatsApp Broadcast</h2>
              <p className="text-xs text-gray-500">Step {step} of 4 — {STEPS[step - 1]}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center px-6 py-3 border-b border-gray-100 shrink-0 gap-1">
          {STEPS.map((label, i) => {
            const n = i + 1;
            const active = n === step, done = n < step;
            return (
              <div key={label} className="flex items-center flex-1 last:flex-none">
                <div className={`flex items-center gap-2 ${n !== 4 ? "flex-1" : ""}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition ${
                    done ? "bg-[#25D366] text-white" : active ? "bg-[#25D366]/15 text-[#25D366] border-2 border-[#25D366]" : "bg-gray-100 text-gray-400"
                  }`}>
                    {done ? <CheckCircle2 size={14} /> : n}
                  </div>
                  <span className={`text-xs font-semibold hidden sm:inline ${active ? "text-gray-800" : "text-gray-400"}`}>{label}</span>
                </div>
                {n !== 4 && <div className={`h-0.5 flex-1 mx-2 ${done ? "bg-[#25D366]" : "bg-gray-100"}`} />}
              </div>
            );
          })}
        </div>

        {error && (
          <div className="mx-6 mt-3 p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs shrink-0">{error}</div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* STEP 1: Contacts */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex gap-2">
                {[["crm", "From CRM", Users], ["file", "Import CSV/Excel", FileSpreadsheet], ["manual", "Manual Entry", UserPlus]].map(([key, label, Icon]) => (
                  <button key={key} onClick={() => setContactsTab(key)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${contactsTab === key ? "bg-[#25D366] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                    <Icon size={14} /> {label}
                  </button>
                ))}
              </div>

              {contactsTab === "crm" && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="p-2 border-b border-gray-100 flex items-center gap-2 bg-gray-50">
                    <Search size={14} className="text-gray-400 ml-1" />
                    <input value={crmSearch} onChange={e => setCrmSearch(e.target.value)} placeholder="Search clients, leads..."
                      className="flex-1 bg-transparent text-sm outline-none py-1" />
                    <span className="text-xs text-gray-400 pr-2">{crmSelected.size} selected</span>
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    {crmLoading ? (
                      <div className="p-6 text-center"><Loader2 className="animate-spin mx-auto text-gray-400" size={20} /></div>
                    ) : filteredCrm.length === 0 ? (
                      <p className="p-4 text-xs text-gray-400 text-center">No CRM contacts with phone numbers found</p>
                    ) : (
                      filteredCrm.map((c, i) => (
                        <label key={i} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-0 cursor-pointer">
                          <input type="checkbox" checked={crmSelected.has(c.phone)} onChange={() => toggleCrmContact(c)} className="w-4 h-4 rounded" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-700 truncate">{c.name}</p>
                            <p className="text-xs text-gray-400">{c.phone} · {c.source}</p>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                  <div className="p-2 border-t border-gray-100 bg-gray-50">
                    <button onClick={applyCrmSelection} disabled={!crmSelected.size}
                      className="w-full py-2 bg-[#25D366] text-white rounded-lg text-xs font-bold disabled:opacity-40">
                      Add {crmSelected.size || ""} Selected Contact{crmSelected.size === 1 ? "" : "s"}
                    </button>
                  </div>
                </div>
              )}

              {contactsTab === "file" && (
                <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                  <label className="flex flex-col items-center justify-center gap-2 py-6 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-[#25D366] transition">
                    <Upload size={24} className="text-gray-400" />
                    <span className="text-sm text-gray-600 font-semibold">Upload CSV, XLS or XLSX</span>
                    <span className="text-xs text-gray-400">Auto-detects Name & Phone columns</span>
                    <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileImport} />
                  </label>
                  {fileError && <p className="text-xs text-red-500">{fileError}</p>}
                  {fileRows.length > 0 && (
                    <>
                      <p className="text-xs text-gray-500">{fileRows.length} valid contacts parsed</p>
                      <div className="max-h-40 overflow-y-auto border border-gray-100 rounded-lg">
                        {fileRows.slice(0, 50).map((r, i) => (
                          <div key={i} className="flex items-center justify-between px-3 py-1.5 text-xs border-b border-gray-50 last:border-0">
                            <span className="text-gray-700">{r.name}</span><span className="text-gray-400 font-mono">{r.phone}</span>
                          </div>
                        ))}
                      </div>
                      <button onClick={applyFileRows} className="w-full py-2 bg-[#25D366] text-white rounded-lg text-xs font-bold">
                        Add {fileRows.length} Imported Contacts
                      </button>
                    </>
                  )}
                </div>
              )}

              {contactsTab === "manual" && (
                <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                  <div className="flex gap-2">
                    <input value={manualName} onChange={e => setManualName(e.target.value)} placeholder="Name"
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#25D366]" />
                    <input value={manualPhone} onChange={e => setManualPhone(e.target.value)} placeholder="Phone"
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#25D366]" />
                    <button onClick={addSingleManual} className="px-3 py-2 bg-gray-800 text-white rounded-lg text-xs font-bold shrink-0">Add</button>
                  </div>
                  <p className="text-xs text-gray-400">Or paste multiple lines as "phone, name" (one per line):</p>
                  <textarea value={manualPaste} onChange={e => setManualPaste(e.target.value)} rows={4}
                    placeholder={"9876543210, Rahul Sharma\n9123456780, Priya Singh"}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#25D366] resize-none font-mono" />
                  <button onClick={applyManualPaste} disabled={!manualPaste.trim()} className="w-full py-2 bg-[#25D366] text-white rounded-lg text-xs font-bold disabled:opacity-40">
                    Add Pasted Contacts
                  </button>
                </div>
              )}

              {/* Selected contacts summary */}
              <div className="bg-emerald-50/70 border border-emerald-200/60 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-emerald-800">{contacts.length} Contact{contacts.length === 1 ? "" : "s"} Selected</span>
                  {contacts.length > 0 && <button onClick={() => setContacts([])} className="text-xs text-red-500 hover:underline">Clear all</button>}
                </div>
                {contacts.length > 0 && (
                  <div className="max-h-28 overflow-y-auto space-y-1">
                    {contacts.map((c) => (
                      <div key={c.phone} className="flex items-center justify-between text-xs bg-white rounded-lg px-2.5 py-1">
                        <span className="text-gray-700 truncate">{c.name} <span className="text-gray-400 font-mono">{c.phone}</span></span>
                        <button onClick={() => removeContact(c.phone)}><Trash2 size={12} className="text-red-400" /></button>
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
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${messageType === "text" ? "bg-[#25D366] text-white" : "bg-gray-100 text-gray-600"}`}>
                  Custom Text
                </button>
                <button onClick={() => setMessageType("template")}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${messageType === "template" ? "bg-[#25D366] text-white" : "bg-gray-100 text-gray-600"}`}>
                  Approved Template
                </button>
              </div>

              {messageType === "template" ? (
                <div>
                  <select value={templateId} onChange={e => setTemplateId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#25D366]">
                    <option value="">Select a template</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.category})</option>)}
                  </select>
                  {selectedTemplate && (
                    <div className="mt-3 p-3.5 bg-slate-900 rounded-xl border border-slate-800 text-slate-100 space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                        <span className="flex items-center gap-1"><Sparkles size={12} /> Template Evaluated Preview:</span>
                        <span className="text-[9px] text-emerald-400 font-mono">Dynamic Placeholders Active</span>
                      </div>
                      <div className="p-2.5 bg-slate-800/90 rounded-lg text-emerald-300 font-mono text-xs whitespace-pre-wrap leading-relaxed">
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
                        <label className="text-xs font-semibold text-gray-600 uppercase">Message Text</label>
                        <span className="text-[10px] text-gray-400 font-mono">{(messageText || "").length} chars</span>
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
                            className="px-2 py-0.5 bg-gray-100 hover:bg-emerald-50 text-gray-700 hover:text-emerald-700 font-mono text-[11px] rounded transition border border-gray-200"
                            title={`Insert ${label}`}
                          >
                            + {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                    <textarea rows={4} value={messageText} onChange={e => setMessageText(e.target.value)}
                      placeholder="Type your WhatsApp message... Use {Hi|Hello|Dear} {name}! Tomorrow {tomorrow} is {tomorrow_day}."
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#25D366] resize-none" />

                    {/* Anti-Ban Spintax & Opt-out Quick Buttons */}
                    <div className="mt-2 space-y-1.5 pt-2 border-t border-gray-100">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-gray-700 uppercase">🛡️ Anti-Ban Word Randomizers:</span>
                        <span className="text-[9px] text-emerald-700 font-semibold">100% Unique per contact</span>
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
                            className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-semibold rounded transition shadow-2xs">
                            {s.label}
                          </button>
                        ))}
                      </div>

                      {messageText && (
                        <div className="p-2 bg-slate-900 text-slate-100 rounded-lg text-[11px] font-mono mt-1 text-emerald-300">
                          <span className="text-[9px] font-bold text-amber-400 uppercase block mb-0.5">🎲 Live Random Preview:</span>
                          {evaluateMessagePlaceholders(messageText)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase mb-1 block">Attach Image or Video (optional)</label>
                    {!mediaPreview ? (
                      <label className="flex items-center justify-center gap-2 py-4 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-[#25D366] transition">
                        {uploading ? <Loader2 size={18} className="animate-spin text-[#25D366]" /> : <ImageIcon size={18} className="text-gray-400" />}
                        <span className="text-xs text-gray-500">{uploading ? "Uploading..." : "Click to select an image or video"}</span>
                        <input type="file" accept="image/*,video/*" className="hidden" onChange={handleMediaSelect} disabled={uploading} />
                      </label>
                    ) : (
                      <div className="relative border border-gray-200 rounded-xl p-2 flex items-center gap-3">
                        {uploadedMedia?.media_type === "video" ? (
                          <video src={mediaPreview} className="w-16 h-16 rounded-lg object-cover bg-black" />
                        ) : (
                          <img src={mediaPreview} alt="attachment" className="w-16 h-16 rounded-lg object-cover" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-600 truncate">{mediaFile?.name}</p>
                          {uploading ? (
                            <span className="text-xs text-amber-600 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Uploading...</span>
                          ) : uploadedMedia ? (
                            <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 size={12} /> Ready to send</span>
                          ) : null}
                        </div>
                        <button onClick={removeMedia} className="p-1.5 hover:bg-red-50 rounded"><Trash2 size={14} className="text-red-400" /></button>
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
              <label className="flex items-center justify-between p-3 bg-gray-50 rounded-xl cursor-pointer">
                <div className="flex items-center gap-2">
                  <MapPin size={18} className="text-[#25D366]" />
                  <span className="text-sm font-semibold text-gray-700">Share a pinned location with this broadcast</span>
                </div>
                <input type="checkbox" checked={includeLocation} onChange={e => setIncludeLocation(e.target.checked)} className="w-5 h-5 rounded" />
              </label>

              {includeLocation && (
                <div className="space-y-3 border border-gray-200 rounded-xl p-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 uppercase mb-1 block">Place Name</label>
                      <input value={locName} onChange={e => setLocName(e.target.value)} placeholder="e.g. Madhura Tech Office"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#25D366]" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 uppercase mb-1 block">Address</label>
                      <input value={locAddress} onChange={e => setLocAddress(e.target.value)} placeholder="Street, City"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#25D366]" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 uppercase mb-1 block">Latitude *</label>
                      <input value={locLat} onChange={e => setLocLat(e.target.value)} placeholder="12.9716"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#25D366] font-mono" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 uppercase mb-1 block">Longitude *</label>
                      <input value={locLng} onChange={e => setLocLng(e.target.value)} placeholder="77.5946"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#25D366] font-mono" />
                    </div>
                  </div>
                  <button onClick={useMyLocation} disabled={locating}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold hover:bg-blue-100 transition">
                    {locating ? <Loader2 size={14} className="animate-spin" /> : <Navigation size={14} />}
                    Use My Current Location
                  </button>
                  <p className="text-xs text-gray-400">Sent as a native WhatsApp location pin every recipient can tap to open in Maps.</p>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Review & Launch */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase mb-1 block">Campaign Name *</label>
                <input value={campaignName} onChange={e => setCampaignName(e.target.value)} placeholder="e.g. July Special Promotion"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#25D366]" />
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="font-semibold text-gray-500 flex items-center gap-1.5 mb-1"><Users size={13} /> Recipients</p>
                  <p className="text-gray-800 font-bold text-lg">{contacts.length}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="font-semibold text-gray-500 flex items-center gap-1.5 mb-1"><MessageSquare size={13} /> Message</p>
                  <p className="text-gray-800 truncate">{messageType === "template" ? (selectedTemplate?.name || "—") : (messageText || "(media only)")}</p>
                </div>
                {uploadedMedia && (
                  <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-2">
                    {uploadedMedia.media_type === "video" ? <Video size={14} className="text-gray-500" /> : <ImageIcon size={14} className="text-gray-500" />}
                    <span className="text-gray-700">1 {uploadedMedia.media_type} attached</span>
                  </div>
                )}
                {includeLocation && (
                  <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-2">
                    <MapPin size={14} className="text-gray-500" />
                    <span className="text-gray-700 truncate">{locName || `${locLat}, ${locLng}`}</span>
                  </div>
                )}
              </div>

              {((messageType !== "template" && messageText) || (messageType === "template" && selectedTemplate?.body)) && (
                <div className="p-3 bg-slate-900 text-slate-100 rounded-xl border border-slate-800 space-y-1 text-xs">
                  <div className="flex items-center justify-between text-[10px] text-amber-400 font-bold uppercase">
                    <span>Sample Evaluated Message Preview:</span>
                    <span className="text-emerald-400 font-mono">Dynamic Live</span>
                  </div>
                  <div className="p-2 bg-slate-800/80 rounded-lg text-emerald-300 font-mono text-[11px] whitespace-pre-wrap leading-relaxed">
                    {evaluateMessagePlaceholders(messageType === "template" ? selectedTemplate.body : messageText)}
                  </div>
                </div>
              )}

              {/* Sender Pool / Load Balancer Selector */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    🌐 Sender Load Balancer & Multi-Number Pool
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500">
                    {senderPools.length > 0 ? `${senderPools.length} Pool(s) Available` : "Direct Account Mode"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-gray-600 block mb-1">Sender Route</label>
                    <select
                      value={selectedPoolId}
                      onChange={(e) => setSelectedPoolId(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-[#25D366] outline-none"
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
                    <label className="text-[11px] font-semibold text-gray-600 block mb-1">Distribution Strategy</label>
                    <select
                      value={routingStrategy}
                      onChange={(e) => setRoutingStrategy(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-[#25D366] outline-none"
                    >
                      <option value="round_robin">🔄 Round-Robin (Equal Distribution)</option>
                      <option value="least_loaded">⚖️ Least-Loaded (Lowest Daily Count)</option>
                      <option value="cloud_first">☁️ Cloud API First (High Volume)</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={warmupMode}
                      onChange={(e) => setWarmupMode(e.target.checked)}
                      className="w-4 h-4 rounded text-[#25D366] focus:ring-[#25D366]"
                    />
                    <span className="font-semibold text-gray-700">New Number Safe Warm-Up Curve</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={spintaxEnabled}
                      onChange={(e) => setSpintaxEnabled(e.target.checked)}
                      className="w-4 h-4 rounded text-[#25D366] focus:ring-[#25D366]"
                    />
                    <span className="font-semibold text-gray-700">Dynamic Spintax Variation</span>
                  </label>
                </div>
              </div>

              {/* Anti-Ban Pacing Mode Selector */}
              <div className="border border-emerald-200 bg-emerald-50/50 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900 uppercase tracking-wide flex items-center gap-1.5">
                    🛡️ Anti-Ban Engine & Daily Safety Cap
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-800">
                    Safe Sending Mode
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPacingMode("safe_800")}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      pacingMode === "safe_800"
                        ? "bg-white border-[#25D366] shadow-sm ring-2 ring-[#25D366]/20"
                        : "bg-white/60 border-gray-200 hover:bg-white text-gray-500"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-gray-800">🛡️ 600–800 / Day Safe</span>
                      {pacingMode === "safe_800" && <CheckCircle2 size={14} className="text-[#25D366]" />}
                    </div>
                    <p className="text-[11px] text-gray-500 leading-tight">35–55s gap + 3m rest every 25 msgs. Active 9am–8pm. <strong>Zero Ban Risk</strong>.</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPacingMode("standard")}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      pacingMode === "standard"
                        ? "bg-white border-[#25D366] shadow-sm ring-2 ring-[#25D366]/20"
                        : "bg-white/60 border-gray-200 hover:bg-white text-gray-500"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-gray-800">⚡ Standard Pacing</span>
                      {pacingMode === "standard" && <CheckCircle2 size={14} className="text-[#25D366]" />}
                    </div>
                    <p className="text-[11px] text-gray-500 leading-tight">7–12s gap for fast small broadcasts (&lt; 200 contacts).</p>
                  </button>
                </div>
              </div>

              {!hasAnyContent && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  Add a message, media, or a location (go back a step) before you can launch.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-5 border-t border-gray-100 shrink-0">
          <button onClick={step === 1 ? onClose : goBack}
            className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition">
            <ChevronLeft size={16} /> {step === 1 ? "Cancel" : "Back"}
          </button>
          {step < 4 ? (
            <button onClick={goNext}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-[#25D366] text-white rounded-xl text-sm font-bold hover:bg-[#1ebe5d] transition">
              Next <ChevronRight size={16} />
            </button>
          ) : (
            <button onClick={handleLaunch} disabled={!canLaunch || launching}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#25D366] text-white rounded-xl text-sm font-bold hover:bg-[#1ebe5d] disabled:opacity-50 transition shadow-md">
              {launching ? <Loader2 size={16} className="animate-spin" /> : <Rocket size={16} />}
              {launching ? `Launching to ${contacts.length}...` : `Launch to ${contacts.length} Contacts`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
