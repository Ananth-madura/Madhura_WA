import React, { useState, useEffect } from "react";
import {
  Zap, Plus, X, Edit2, Loader2, CheckCircle2, XCircle, Play,
  Clock, ToggleLeft, ToggleRight, FileText, ListChecks, Trash2,
  OctagonMinus, PlayCircle, Cpu, Send, Save, Sparkles, RefreshCw,
  Image, Video, Users, Bot, Layers, Upload, ArrowRight, ShieldCheck,
  Smartphone, BarChart2, Bell, Check, AlertCircle, Info, ExternalLink
} from "lucide-react";
import axios from "axios";
import { API } from "../config/api";
import WhatsAppNav from "../components/WhatsAppNav";
import WhatsAppInteractiveReminders from "../components/WhatsAppInteractiveReminders";
import WAVariablePicker, { evaluateMessagePlaceholders } from "../components/WAVariablePicker";

const TRIGGER_TYPES = [
  { value: "welcome_message", label: "Welcome Message", desc: "First inbound message / contact added", emoji: "👋" },
  { value: "new_lead", label: "New Lead Added", desc: "Triggered when a new lead is added in CRM", emoji: "🎯" },
  { value: "invoice_created", label: "Invoice Created", desc: "Send invoice PDF & payment link via WhatsApp", emoji: "🧾" },
  { value: "quotation_created", label: "Quotation / Proposal Created", desc: "Send quotation & proposal details", emoji: "💼" },
  { value: "amc_created", label: "AMC Contract Created", desc: "Send maintenance agreement confirmation", emoji: "🛡️" },
  { value: "payment_received", label: "Payment Received", desc: "Instant payment receipt acknowledgement", emoji: "✅" },
  { value: "payment_due", label: "Payment Due Reminder", desc: "Automated payment reminder before due date", emoji: "💰" },
  { value: "service_visit_scheduled", label: "Service Visit Scheduled", desc: "Technician appointment confirmation", emoji: "📅" },
  { value: "walkin_created", label: "Walkin Lead Added", desc: "Shop/office visit thank you & welcome", emoji: "🚶" },
  { value: "ticket_closed", label: "Service Completed", desc: "Post-resolution feedback request", emoji: "🎫" },
  { value: "birthday", label: "Birthday Greeting", desc: "Customer birthday wishes & special discount", emoji: "🎂" },
  { value: "appointment_reminder", label: "Appointment Reminder", desc: "Reminder before scheduled visit", emoji: "🔔" },
  { value: "lead_followup", label: "Lead Follow-Up Nudge", desc: "Nudge inactive leads after 7 days", emoji: "⏳" },
  { value: "abandoned_cart", label: "Pending Quotation Recovery", desc: "Recover pending quotes with special offer", emoji: "🛒" },
  { value: "custom", label: "Custom Background Trigger", desc: "Define custom event background trigger", emoji: "⚡" },
];

const PRESET_MESSAGES = {
  welcome_message: "Hello {name}! Welcome to {company}. Thank you for connecting with us. How can we help you today?",
  new_lead: "Hi {name}! 👋 Thank you for your inquiry regarding {service}. Our team will contact you shortly!",
  invoice_created: "Hello {name}, your invoice *{invoice_no}* for amount *{amount}* has been generated. Due Date: {due_date}. Thank you for choosing {company}!",
  quotation_created: "Hello {name}, your quotation proposal *{quotation_no}* for *{service}* (Total: {amount}) has been generated. Let us know if you have any questions!",
  amc_created: "🛡️ *AMC Contract Active:* Dear {name}, your maintenance contract *{amc_contract_no}* for {service} is active until {due_date}. Thank you for trusting {company}!",
  payment_received: "Dear {name}, thank you! We received your payment of *{amount}* for invoice *{invoice_no}* on {date}.",
  payment_due: "Hi {name}, gentle reminder that payment for invoice *{invoice_no}* ({amount}) is due on *{due_date}*. Please reply if you need invoice copy.",
  service_visit_scheduled: "📅 *Service Visit Confirmed:* Hi {name}, our technician has been scheduled for your *{service}* on *{service_date}*. Thank you!",
  walkin_created: "Hi {name}! Thank you for visiting {company} today regarding {service}. It was a pleasure meeting you. Feel free to message us anytime!",
  ticket_closed: "Hi {name}, your service request regarding {service} has been resolved. We would love your feedback!",
  birthday: "🎉 Happy Birthday {name}! 🎂 Team {company} wishes you a wonderful year. Enjoy 15% OFF on your next service!",
  appointment_reminder: "Hi {name}, gentle reminder for your upcoming appointment with {company} on {date}. Reply CONFIRM to confirm.",
  lead_followup: "Hi {name}, following up regarding your interest in {service}. Let us know if you'd like a quick demo or technical call!",
  abandoned_cart: "Hi {name}, you have a pending quotation for {service}! Complete your inquiry today for priority scheduling.",
  custom: "Hello {name}! Thank you for choosing {company}.",
};

const PLACEHOLDERS = [
  { tag: "{name}", label: "Name" },
  { tag: "{tomorrow}", label: "Tomorrow Date" },
  { tag: "{tomorrow_day}", label: "Tomorrow Day Name" },
  { tag: "{day}", label: "Today's Day" },
  { tag: "{date}", label: "Today's Date" },
  { tag: "{time}", label: "Live Time" },
  { tag: "{date_time}", label: "Date & Time" },
  { tag: "{greeting_time}", label: "Smart Greeting" },
  { tag: "{company}", label: "Company" },
  { tag: "{service}", label: "Service / AMC" },
  { tag: "{invoice_no}", label: "Invoice #" },
  { tag: "{quotation_no}", label: "Quotation #" },
  { tag: "{amc_contract_no}", label: "AMC Contract #" },
  { tag: "{amount}", label: "Amount (₹)" },
  { tag: "{due_date}", label: "Due Date" },
  { tag: "{service_date}", label: "Service Date" },
  { tag: "{city}", label: "City / Area" },
];

export default function WhatsAppAutomations() {
  const [automations, setAutomations] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [groups, setGroups] = useState([]);
  const [flows, setFlows] = useState([]);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ totalRules: 0, activeRules: 0, totalRuns: 0, sentCount: 0, failedCount: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("rules"); // "rules" | "welcome" | "logs"

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editAutomation, setEditAutomation] = useState(null);
  const [toggling, setToggling] = useState(null);
  const [seeding, setSeeding] = useState(false);

  // Test Modal
  const [testModal, setTestModal] = useState(null);
  const [testPhone, setTestPhone] = useState("");
  const [testName, setTestName] = useState("Rahul Sharma");
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // CRM Trigger Simulator Modal State
  const [showSimulateModal, setShowSimulateModal] = useState(false);
  const [simTriggerType, setSimTriggerType] = useState("new_lead");
  const [simPhone, setSimPhone] = useState("");
  const [simName, setSimName] = useState("Rahul Sharma");
  const [simSendReal, setSimSendReal] = useState(false);
  const [simLoading, setSimLoading] = useState(false);
  const [simResult, setSimResult] = useState(null);
  const [showExplainer, setShowExplainer] = useState(true);

  // Welcome Auto-Reply Settings (Disabled by default for safety)
  const [welcomeSettings, setWelcomeSettings] = useState({
    enabled: false,
    welcome_type: "text",
    welcome_text: "Hello {name}! Welcome to Madhura Tech. Thank you for reaching out to us. How can we help you today?",
    welcome_buttons: [],
    welcome_footer: "",
    cooldown_hours: 24,
    working_hours_only: false,
    start_time: "09:00",
    end_time: "21:00",
  });
  const [welcomeSaving, setWelcomeSaving] = useState(false);
  const [welcomeTestPhone, setWelcomeTestPhone] = useState("");
  const [welcomeTestLoading, setWelcomeTestLoading] = useState(false);
  const [welcomeTestResult, setWelcomeTestResult] = useState(null);

  // Form State
  const [form, setForm] = useState({
    name: "",
    trigger_type: "welcome_message",
    msg_kind: "text", // 'text' | 'media' | 'template'
    template_id: "",
    message_text: "",
    media_type: "image",
    media_url: "",
    // Sequence / 2nd Step Settings
    enable_sequence: false,
    sequence_delay_seconds: 7,
    followup_msg_kind: "text",
    followup_message_text: "",
    followup_media_type: "image",
    followup_media_url: "",
    followup_template_id: "",
    // Cross Module Linkage
    flow_id: "",
    group_id: "",
    delay_minutes: 0,
    is_active: 1,
  });

  const [menuOptions, setMenuOptions] = useState([]);
  const [bulkToggling, setBulkToggling] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadingFollowupMedia, setUploadingFollowupMedia] = useState(false);

  const headers = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });
  const anyActive = automations.some((a) => a.is_active);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [aRes, tRes, lRes, wRes, gRes, fRes, sRes] = await Promise.all([
        axios.get(`${API}/api/wa/automations`, { headers: headers() }),
        axios.get(`${API}/api/wa/templates`, { headers: headers() }),
        axios.get(`${API}/api/wa/automations/logs/recent?limit=40`, { headers: headers() }),
        axios.get(`${API}/api/wa/automations/welcome-settings`, { headers: headers() }).catch(() => ({ data: null })),
        axios.get(`${API}/api/wa/groups`, { headers: headers() }).catch(() => ({ data: [] })),
        axios.get(`${API}/api/wa/flows`, { headers: headers() }).catch(() => ({ data: [] })),
        axios.get(`${API}/api/wa/automations/stats`, { headers: headers() }).catch(() => ({ data: null })),
      ]);
      setAutomations(aRes.data || []);
      setTemplates(tRes.data || []);
      setLogs(lRes.data || []);
      if (wRes.data) setWelcomeSettings(wRes.data);
      if (gRes.data) setGroups(gRes.data || []);
      if (fRes.data) setFlows(fRes.data || []);
      if (sRes.data) setStats(sRes.data);
    } catch (err) {
      console.error("Error fetching automations:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleBulkToggle = async () => {
    const action = anyActive ? "stop-all" : "resume-all";
    if (anyActive && !window.confirm("Pause all background automation rules right now?")) return;
    setBulkToggling(true);
    try {
      await axios.post(`${API}/api/wa/automations/${action}`, {}, { headers: headers() });
      await fetchData();
    } catch {}
    setBulkToggling(false);
  };

  const handleSeedPrebuilt = async () => {
    setSeeding(true);
    try {
      const { data } = await axios.post(`${API}/api/wa/automations/seed`, {}, { headers: headers() });
      await fetchData();
      alert(`🎉 Successfully installed ${data.count || 10} prebuilt CRM automation rules!`);
    } catch (err) {
      alert("Failed to seed automations: " + (err.response?.data?.error || err.message));
    }
    setSeeding(false);
  };

  const openCreate = () => {
    setEditAutomation(null);
    setForm({
      name: "",
      trigger_type: "welcome_message",
      msg_kind: "text",
      template_id: "",
      message_text: PRESET_MESSAGES.welcome_message,
      media_type: "image",
      media_url: "",
      enable_sequence: false,
      sequence_delay_seconds: 7,
      followup_msg_kind: "text",
      followup_message_text: "",
      followup_media_type: "image",
      followup_media_url: "",
      followup_template_id: "",
      flow_id: "",
      group_id: "",
      delay_minutes: 0,
      is_active: 1,
    });
    setMenuOptions([]);
    setShowModal(true);
  };

  const openEdit = async (a) => {
    setEditAutomation(a);
    const hasSeq = Boolean(a.followup_message_text || a.followup_media_url || a.followup_template_id);
    const msgKind = a.template_id ? "template" : a.media_type && a.media_url ? "media" : "text";
    const followKind = a.followup_template_id ? "template" : a.followup_media_type && a.followup_media_url ? "media" : "text";

    setForm({
      name: a.name,
      trigger_type: a.trigger_type,
      msg_kind: msgKind,
      template_id: a.template_id || "",
      message_text: a.message_text || "",
      media_type: a.media_type || "image",
      media_url: a.media_url || "",
      enable_sequence: hasSeq,
      sequence_delay_seconds: a.sequence_delay_seconds || 7,
      followup_msg_kind: followKind,
      followup_message_text: a.followup_message_text || "",
      followup_media_type: a.followup_media_type || "image",
      followup_media_url: a.followup_media_url || "",
      followup_template_id: a.followup_template_id || "",
      flow_id: a.flow_id || "",
      group_id: a.group_id || "",
      delay_minutes: a.delay_minutes || 0,
      is_active: a.is_active,
    });
    setMenuOptions([]);
    setShowModal(true);
    try {
      const { data } = await axios.get(`${API}/api/wa/automations/${a.id}/options`, { headers: headers() });
      setMenuOptions((data || []).map((o) => ({ label: o.label, reply_text: o.reply_text })));
    } catch {}
  };

  const handleToggle = async (a) => {
    setToggling(a.id);
    try {
      await axios.post(`${API}/api/wa/automations/${a.id}/toggle`, {}, { headers: headers() });
      setAutomations((prev) =>
        prev.map((item) => (item.id === a.id ? { ...item, is_active: item.is_active ? 0 : 1 } : item))
      );
    } catch {}
    setToggling(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this automation rule?")) return;
    try {
      await axios.delete(`${API}/api/wa/automations/${id}`, { headers: headers() });
      fetchData();
    } catch {}
  };

  const insertPlaceholder = (field, tag) => {
    setForm((prev) => ({ ...prev, [field]: (prev[field] || "") + (prev[field] ? " " : "") + tag }));
  };

  const handleSave = async () => {
    if (!form.name || !form.trigger_type) return alert("Rule name and trigger type are required");

    const payload = {
      name: form.name,
      trigger_type: form.trigger_type,
      template_id: form.msg_kind === "template" ? form.template_id || null : null,
      message_text: form.msg_kind !== "template" ? form.message_text : null,
      media_type: form.msg_kind === "media" ? form.media_type : null,
      media_url: form.msg_kind === "media" ? form.media_url : null,
      sequence_delay_seconds: form.enable_sequence ? parseInt(form.sequence_delay_seconds, 10) || 7 : 7,
      followup_message_text: form.enable_sequence && form.followup_msg_kind !== "template" ? form.followup_message_text : null,
      followup_media_type: form.enable_sequence && form.followup_msg_kind === "media" ? form.followup_media_type : null,
      followup_media_url: form.enable_sequence && form.followup_msg_kind === "media" ? form.followup_media_url : null,
      followup_template_id: form.enable_sequence && form.followup_msg_kind === "template" ? form.followup_template_id || null : null,
      flow_id: form.flow_id || null,
      group_id: form.group_id || null,
      delay_minutes: parseInt(form.delay_minutes, 10) || 0,
      is_active: form.is_active ? 1 : 0,
    };

    try {
      let automationId = editAutomation?.id;
      if (editAutomation) {
        await axios.put(`${API}/api/wa/automations/${editAutomation.id}`, payload, { headers: headers() });
      } else {
        const { data } = await axios.post(`${API}/api/wa/automations`, payload, { headers: headers() });
        automationId = data.id;
      }
      const validOptions = menuOptions.filter((o) => o.label.trim() && o.reply_text.trim());
      await axios.put(`${API}/api/wa/automations/${automationId}/options`, { options: validOptions }, { headers: headers() });
      setShowModal(false);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || "Save failed");
    }
  };

  const handleTestTrigger = async () => {
    if (!testPhone.trim() || !testModal) return;
    setTestLoading(true);
    setTestResult(null);

    try {
      const { data } = await axios.post(
        `${API}/api/wa/automations/${testModal.id}/trigger`,
        { phone: testPhone.trim(), contact_name: testName.trim() },
        { headers: headers()}
      );
      setTestResult({ success: true, message: data.message });
      fetchData();
    } catch (err) {
      setTestResult({ success: false, message: err.response?.data?.error || "Trigger failed" });
    }
    setTestLoading(false);
  };

  const handleSimulateTrigger = async () => {
    setSimLoading(true);
    setSimResult(null);
    try {
      const { data } = await axios.post(
        `${API}/api/wa/automations/simulate-trigger`,
        {
          trigger_type: simTriggerType,
          phone: simPhone.trim(),
          contact_name: simName.trim(),
          send_real_message: simSendReal && !!simPhone.trim(),
        },
        { headers: headers() }
      );
      setSimResult(data);
      if (simSendReal) fetchData();
    } catch (err) {
      setSimResult({
        success: false,
        error: err.response?.data?.error || err.message,
      });
    }
    setSimLoading(false);
  };

  const handleSaveWelcomeSettings = async () => {
    setWelcomeSaving(true);
    try {
      const { data } = await axios.put(`${API}/api/wa/automations/welcome-settings`, welcomeSettings, { headers: headers() });
      setWelcomeSettings(data);
      alert("✅ Welcome Auto-Reply settings saved successfully!");
    } catch (err) {
      alert(err.response?.data?.error || "Failed to save welcome settings");
    }
    setWelcomeSaving(false);
  };

  const handleTestWelcome = async () => {
    if (!welcomeTestPhone.trim()) return;
    setWelcomeTestLoading(true);
    setWelcomeTestResult(null);
    try {
      const { data } = await axios.post(`${API}/api/wa/automations/test-welcome`, { phone: welcomeTestPhone }, { headers: headers() });
      setWelcomeTestResult({
        success: true,
        message: `Welcome message sent via ${data.engineUsed || "WhatsApp"}`,
        // native === false means no Cloud API sender was available, so the
        // customer received the numbered-text version, not tappable buttons.
        warning:
          welcomeSettings.welcome_type === "buttons" && data.native === false
            ? "Delivered as numbered text — native buttons need the WhatsApp Cloud API connected."
            : null,
      });
    } catch (err) {
      setWelcomeTestResult({ success: false, message: err.response?.data?.error || "Send failed" });
    }
    setWelcomeTestLoading(false);
  };

  return (
    <div className="w-full pb-12 bg-slate-50/50 min-h-screen">
      <WhatsAppNav />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-md shadow-orange-500/20">
            <Zap size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-gray-900">WhatsApp Event Automations</h1>
              <span className="text-xs font-bold bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full border border-amber-200">
                {automations.length} Active Rules
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Hands-off background rules: Automatic invoice notices, instant payment receipts, lead greetings, and AMC alerts.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => {
              setSimResult(null);
              setShowSimulateModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition text-xs font-bold shadow-md shadow-blue-500/20"
          >
            <PlayCircle size={15} />
            <span>⚡ Test Any CRM Trigger</span>
          </button>

          <button
            onClick={handleSeedPrebuilt}
            disabled={seeding}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-amber-50 to-orange-50 text-amber-900 border border-amber-300 rounded-xl hover:bg-amber-100 transition text-xs font-bold shadow-sm"
          >
            {seeding ? <Loader2 size={15} className="animate-spin text-amber-700" /> : <Sparkles size={15} className="text-amber-700" />}
            <span>Load 12 Prebuilt Smart Rules</span>
          </button>

          <button
            onClick={handleBulkToggle}
            disabled={bulkToggling || automations.length === 0}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 border rounded-xl text-xs font-bold transition shadow-sm ${
              anyActive
                ? "bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100"
                : "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100"
            }`}
          >
            {bulkToggling ? <Loader2 size={14} className="animate-spin" /> : anyActive ? <OctagonMinus size={14} /> : <PlayCircle size={14} />}
            <span>{anyActive ? "Pause All" : "Resume All"}</span>
          </button>

          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white rounded-xl transition text-xs font-bold shadow-md shadow-[#25D366]/20"
          >
            <Plus size={16} />
            <span>Create Automation Rule</span>
          </button>
        </div>
      </div>

      {/* Metrics Summary Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Zap size={20} />
          </div>
          <div>
            <div className="text-lg font-bold text-gray-900">{stats.totalRules}</div>
            <div className="text-[11px] text-gray-500 font-medium">Configured Rules</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <ShieldCheck size={20} />
          </div>
          <div>
            <div className="text-lg font-bold text-emerald-600">{stats.activeRules}</div>
            <div className="text-[11px] text-gray-500 font-medium">Active (Listening)</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <Send size={20} />
          </div>
          <div>
            <div className="text-lg font-bold text-purple-600">{stats.totalRuns}</div>
            <div className="text-[11px] text-gray-500 font-medium">Total Auto-Sends</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <div className="text-lg font-bold text-amber-600">{stats.sentCount}</div>
            <div className="text-[11px] text-gray-500 font-medium">Delivered Successfully</div>
          </div>
        </div>
      </div>

      {/* Educational Explainer Banner */}
      {showExplainer && (
        <div className="mb-6 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 shadow-xl border border-indigo-500/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
            <Cpu size={140} />
          </div>

          <div className="flex items-start justify-between gap-4 relative z-10 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-400/20 text-amber-400 flex items-center justify-center border border-amber-400/30">
                <Sparkles size={22} />
              </div>
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>How WhatsApp Automations Work</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-extrabold border border-emerald-400/30">
                    ⚡ 100% Hands-Off Background Engine
                  </span>
                </h2>
                <p className="text-xs text-indigo-200 mt-0.5">
                  Automations trigger automatically whenever staff performs actions inside the CRM database.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowExplainer(false)}
              className="text-indigo-300 hover:text-white p-1 transition"
              title="Dismiss banner"
            >
              <X size={18} />
            </button>
          </div>

          {/* 3 Module Architecture Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 relative z-10">
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-amber-400/30 space-y-2 hover:bg-white/10 transition">
              <div className="flex items-center justify-between text-xs font-bold text-amber-300">
                <span>⚡ 1. CRM Automations</span>
                <span className="text-[10px] bg-amber-400/20 px-2 py-0.5 rounded-full">Set & Forget</span>
              </div>
              <p className="text-[11px] text-gray-300 leading-relaxed">
                Triggered by <strong>CRM Database Events</strong> (Invoices created, payments received, lead added, AMC expiry). Sends 1-to-1 instant updates in &lt; 2s.
              </p>
              <div className="text-[10px] text-amber-300/90 font-mono bg-black/30 p-2 rounded-xl border border-white/5">
                New Invoice ➔ Auto Send PDF & Pay Link
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-blue-400/20 space-y-2 hover:bg-white/10 transition">
              <div className="flex items-center justify-between text-xs font-bold text-blue-300">
                <span>📢 2. Bulk Campaigns</span>
                <span className="text-[10px] bg-blue-400/20 px-2 py-0.5 rounded-full">1-to-Many Blast</span>
              </div>
              <p className="text-[11px] text-gray-300 leading-relaxed">
                <strong>Outbound Marketing Broadcasts</strong> sent by the marketer to 600–800 selected contacts with photos, catalog PDFs, and anti-ban pacing.
              </p>
              <div className="text-[10px] text-blue-300/90 font-mono bg-black/30 p-2 rounded-xl border border-white/5">
                Diwali Offer ➔ Send to 500 Walkin Leads
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-emerald-400/20 space-y-2 hover:bg-white/10 transition">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-300">
                <span>🔀 3. Chatbot Flows</span>
                <span className="text-[10px] bg-emerald-400/20 px-2 py-0.5 rounded-full">Interactive Bot</span>
              </div>
              <p className="text-[11px] text-gray-300 leading-relaxed">
                <strong>24/7 Conversational State Machine</strong>. When customer sends "Hi" or taps a button, the bot asks qualifying questions and books appointments.
              </p>
              <div className="text-[10px] text-emerald-300/90 font-mono bg-black/30 p-2 rounded-xl border border-white/5">
                Customer types "1" ➔ Shows Price Menu
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-gray-200 pb-2">
        <button
          onClick={() => setActiveTab("rules")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === "rules" ? "bg-amber-600 text-white shadow-sm" : "bg-white text-gray-600 border hover:bg-gray-50"
          }`}
        >
          <Zap size={15} />
          <span>Event Trigger Rules ({automations.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("welcome")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === "welcome" ? "bg-amber-600 text-white shadow-sm" : "bg-white text-gray-600 border hover:bg-gray-50"
          }`}
        >
          <Users size={15} />
          <span>Welcome Auto-Reply & Cooldown</span>
        </button>

        <button
          onClick={() => setActiveTab("reminders")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === "reminders" ? "bg-amber-600 text-white shadow-sm" : "bg-white text-gray-600 border hover:bg-gray-50"
          }`}
        >
          <Bell size={15} />
          <span>🔔 Interactive Reminders & 2-Way Confirmations</span>
        </button>

        <button
          onClick={() => setActiveTab("logs")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === "logs" ? "bg-amber-600 text-white shadow-sm" : "bg-white text-gray-600 border hover:bg-gray-50"
          }`}
        >
          <ListChecks size={15} />
          <span>Execution Audit Logs ({logs.length})</span>
        </button>
      </div>

      {/* ── TAB 4: Interactive Reminders & 2-Way Confirmations ── */}
      {activeTab === "reminders" && (
        <WhatsAppInteractiveReminders />
      )}

      {/* ── TAB 1: Rules List ── */}
      {activeTab === "rules" && (
        <>
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 size={36} className="animate-spin text-amber-600" />
            </div>
          ) : automations.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-gray-200 shadow-sm p-8 max-w-lg mx-auto">
              <Zap size={48} className="mx-auto mb-3 text-amber-500/60" />
              <h3 className="text-base font-bold text-gray-800">No Automation Rules Configured</h3>
              <p className="text-xs text-gray-500 mt-1 mb-5 leading-relaxed">
                Install 10 prebuilt automated rules (Invoice notice, Payment receipt, AMC alerts, Lead greetings) with 1 click.
              </p>
              <button
                onClick={handleSeedPrebuilt}
                className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-xs font-bold shadow-md hover:opacity-90 transition flex items-center gap-2 mx-auto"
              >
                <Sparkles size={15} />
                <span>Load Prebuilt Rules</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {automations.map((a) => {
                const tr = TRIGGER_TYPES.find((t) => t.value === a.trigger_type) || { emoji: "⚡", label: a.trigger_type };
                const hasSeq = Boolean(a.followup_message_text || a.followup_media_url || a.followup_template_name);

                return (
                  <div
                    key={a.id}
                    className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between group"
                  >
                    <div>
                      {/* Top Bar: Trigger emoji badge & toggle */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <span>{tr.emoji}</span>
                          <span>{tr.label}</span>
                        </span>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => { setTestModal(a); setTestResult(null); }}
                            className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                            title="Test trigger"
                          >
                            <Play size={14} />
                          </button>
                          <button
                            onClick={() => openEdit(a)}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Edit rule"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(a.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Delete rule"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      <h3 className="text-sm font-bold text-gray-900 group-hover:text-amber-700 transition line-clamp-1">
                        {a.name}
                      </h3>

                      <p className="text-xs text-gray-600 mt-2 bg-gray-50 p-2.5 rounded-xl border border-gray-100 line-clamp-3 font-sans leading-relaxed">
                        {a.template_body || a.message_text || "Automated template send"}
                      </p>

                      {/* Multi-Step & Linking Badges */}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {hasSeq && (
                          <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-md text-[10px] font-bold flex items-center gap-1">
                            <Layers size={10} />
                            <span>Step 2 ({a.sequence_delay_seconds || 7}s delay)</span>
                          </span>
                        )}

                        {a.group_name && (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-[10px] font-bold flex items-center gap-1">
                            <Users size={10} />
                            <span>{a.group_name}</span>
                          </span>
                        )}

                        {a.flow_name && (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-[10px] font-bold flex items-center gap-1">
                            <Bot size={10} />
                            <span>{a.flow_name}</span>
                          </span>
                        )}

                        {a.option_count > 0 && (
                          <span className="px-2 py-0.5 bg-teal-50 text-teal-700 border border-teal-200 rounded-md text-[10px] font-bold">
                            🔘 {a.option_count} Quick Options
                          </span>
                        )}
                      </div>

                      {/* Details row */}
                      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                        <span>Delay: {a.delay_minutes > 0 ? `${a.delay_minutes}m` : "Instant"}</span>
                        <span className="font-bold text-amber-700">{a.run_count || 0} executions</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                      <button
                        onClick={() => handleToggle(a)}
                        disabled={toggling === a.id}
                        className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl transition ${
                          a.is_active
                            ? "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        }`}
                      >
                        {a.is_active ? <ToggleRight size={18} className="text-emerald-600" /> : <ToggleLeft size={18} />}
                        <span>{a.is_active ? "Active" : "Paused"}</span>
                      </button>

                      <button
                        onClick={() => { setTestModal(a); setTestResult(null); }}
                        className="text-xs font-bold text-gray-600 hover:text-emerald-700 flex items-center gap-1"
                      >
                        <Play size={12} />
                        <span>Test Send</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── TAB 2: Welcome Auto-Reply Settings ── */}
      {activeTab === "welcome" && (
        <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm max-w-3xl mx-auto space-y-6">
          <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl flex items-start gap-3">
            <ShieldCheck className="text-emerald-700 mt-0.5 shrink-0" size={20} />
            <div className="text-xs text-emerald-950 space-y-1.5">
              <p className="font-bold text-emerald-900 flex items-center gap-2">
                <span>Safe User-Initiated Welcome Engine</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 font-extrabold">
                  🛡️ Anti-Spam & Quarantine Protected
                </span>
              </p>
              <ul className="list-disc list-inside text-emerald-800 space-y-0.5 text-[11px] leading-relaxed">
                <li><strong>Connecting a WhatsApp number will NEVER send messages.</strong> Historic and synced messages are safely quarantined.</li>
                <li>Triggers <strong>ONLY</strong> when a customer sends the first incoming message to start a conversation.</li>
                <li><strong>Bulk campaigns are isolated:</strong> Replies to promotional broadcasts will never trigger this welcome message.</li>
                <li>If your company or staff contacted the customer in the last 24h, the welcome greeting is suppressed.</li>
                <li>Guaranteed <strong>one-time delivery</strong> per contact according to the cooldown window below.</li>
              </ul>
            </div>
          </div>

          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h2 className="text-base font-bold text-gray-900">Welcome Auto-Reply & Cooldown Manager</h2>
              <p className="text-xs text-gray-500 mt-0.5">Greets new contacts on their first inbound message with strict one-time cooldown protection</p>
            </div>

            <button
              onClick={() => setWelcomeSettings((s) => ({ ...s, enabled: !s.enabled }))}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                welcomeSettings.enabled
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-sm"
                  : "bg-gray-100 text-gray-600 border border-gray-300"
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${welcomeSettings.enabled ? "bg-emerald-500 animate-pulse" : "bg-gray-400"}`} />
              <span>{welcomeSettings.enabled ? "Active (Auto-Reply ON)" : "Disabled (Safe Mode)"}</span>
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-gray-700 uppercase">Welcome Message Copy</label>
                <span className="text-[10px] text-gray-400 font-mono">Dynamic Multi-Keywords</span>
              </div>
              <WAVariablePicker
                onInsert={(tag) => setWelcomeSettings((s) => ({ ...s, welcome_text: (s.welcome_text || "") + " " + tag }))}
                className="mb-2"
              />
              <textarea
                rows={3}
                value={welcomeSettings.welcome_text || ""}
                onChange={(e) => setWelcomeSettings((s) => ({ ...s, welcome_text: e.target.value }))}
                className="w-full p-3 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-amber-500 bg-gray-50"
                placeholder="Hello {name}! Welcome to Madhura Tech..."
              />
            </div>

            {/* Message Type: plain text vs REAL tappable WhatsApp buttons */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">Welcome Message Type</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "text", label: "Plain Text", hint: "Simple greeting, no options" },
                  { key: "buttons", label: "Tappable Buttons", hint: "Native WhatsApp reply buttons" },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() =>
                      setWelcomeSettings((s) => ({
                        ...s,
                        welcome_type: opt.key,
                        // Seed one button so switching to 'buttons' is never an invalid save
                        welcome_buttons:
                          opt.key === "buttons" && !(s.welcome_buttons || []).length
                            ? [{ id: "welcome_services", title: "Our Services" }]
                            : s.welcome_buttons || [],
                      }))
                    }
                    className={`text-left p-3 rounded-xl border transition ${
                      (welcomeSettings.welcome_type || "text") === opt.key
                        ? "border-amber-500 bg-amber-50 shadow-sm"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <span className="block text-xs font-bold text-gray-900">{opt.label}</span>
                    <span className="block text-[11px] text-gray-500 mt-0.5">{opt.hint}</span>
                  </button>
                ))}
              </div>
              {welcomeSettings.welcome_type === "buttons" && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 mt-2">
                  Native buttons are delivered by the <strong>WhatsApp Cloud API</strong>. If only a QR/web session is
                  connected, the same message is delivered as a numbered text menu instead — customers still get it.
                </p>
              )}
            </div>

            {welcomeSettings.welcome_type === "buttons" && (
              <div className="space-y-3 p-3.5 rounded-2xl border border-gray-200 bg-gray-50/60">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-gray-700 uppercase">
                    Reply Buttons ({(welcomeSettings.welcome_buttons || []).length}/3)
                  </label>
                  <button
                    type="button"
                    disabled={(welcomeSettings.welcome_buttons || []).length >= 3}
                    onClick={() =>
                      setWelcomeSettings((s) => ({
                        ...s,
                        welcome_buttons: [
                          ...(s.welcome_buttons || []),
                          { id: `welcome_opt_${(s.welcome_buttons || []).length + 1}`, title: "" },
                        ],
                      }))
                    }
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    <Plus size={12} /> Add Button
                  </button>
                </div>

                {(welcomeSettings.welcome_buttons || []).map((btn, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-start">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-0.5">Title (shown)</label>
                      <input
                        value={btn.title || ""}
                        maxLength={20}
                        onChange={(e) =>
                          setWelcomeSettings((s) => {
                            const btns = [...(s.welcome_buttons || [])];
                            btns[idx] = { ...btns[idx], title: e.target.value };
                            return { ...s, welcome_buttons: btns };
                          })
                        }
                        className="w-full px-2.5 py-1.5 border rounded-lg text-xs bg-white outline-none focus:ring-2 focus:ring-amber-500"
                        placeholder="Check my quote"
                      />
                      <span className="text-[10px] text-gray-400">{(btn.title || "").length}/20 chars</span>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-0.5">Action ID (stable)</label>
                      <input
                        value={btn.id || ""}
                        onChange={(e) =>
                          setWelcomeSettings((s) => {
                            const btns = [...(s.welcome_buttons || [])];
                            // Keep ids machine-safe: automations key on these, not on the title
                            btns[idx] = { ...btns[idx], id: e.target.value.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase() };
                            return { ...s, welcome_buttons: btns };
                          })
                        }
                        className="w-full px-2.5 py-1.5 border rounded-lg text-xs bg-white font-mono outline-none focus:ring-2 focus:ring-amber-500"
                        placeholder="quote_view"
                      />
                      <span className="text-[10px] text-gray-400">Never renamed when the title changes</span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setWelcomeSettings((s) => ({
                          ...s,
                          welcome_buttons: (s.welcome_buttons || []).filter((_, i) => i !== idx),
                        }))
                      }
                      className="mt-5 p-1.5 rounded-lg text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200"
                      title="Remove button"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-0.5">Footer (optional)</label>
                  <input
                    value={welcomeSettings.welcome_footer || ""}
                    maxLength={60}
                    onChange={(e) => setWelcomeSettings((s) => ({ ...s, welcome_footer: e.target.value }))}
                    className="w-full px-2.5 py-1.5 border rounded-lg text-xs bg-white outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="Madhura Tech • Reply MENU anytime"
                  />
                  <span className="text-[10px] text-gray-400">{(welcomeSettings.welcome_footer || "").length}/60 chars</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Cooldown Period: {welcomeSettings.cooldown_hours === 0 ? "Only Once (Lifetime)" : `${welcomeSettings.cooldown_hours || 24} Hours`}
                </label>
                <input
                  type="range"
                  min={0}
                  max={72}
                  step={6}
                  value={welcomeSettings.cooldown_hours != null ? welcomeSettings.cooldown_hours : 24}
                  onChange={(e) => setWelcomeSettings((s) => ({ ...s, cooldown_hours: parseInt(e.target.value, 10) }))}
                  className="w-full accent-amber-600"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  {welcomeSettings.cooldown_hours === 0
                    ? "Lifetime protection: Customer will receive the welcome greeting only once in their lifetime."
                    : `Prevents sending duplicate welcome messages to the same customer within ${welcomeSettings.cooldown_hours || 24} hours.`}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Business Working Hours Filter</label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="checkbox"
                    id="wh_only"
                    checked={welcomeSettings.working_hours_only || false}
                    onChange={(e) => setWelcomeSettings((s) => ({ ...s, working_hours_only: e.target.checked }))}
                    className="w-4 h-4 accent-amber-600 rounded"
                  />
                  <label htmlFor="wh_only" className="text-xs text-gray-700 font-medium">Restricted to working hours only</label>
                </div>
                {welcomeSettings.working_hours_only && (
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="time"
                      value={welcomeSettings.start_time || "09:00"}
                      onChange={(e) => setWelcomeSettings((s) => ({ ...s, start_time: e.target.value }))}
                      className="px-2.5 py-1 border rounded-lg text-xs bg-white font-mono"
                    />
                    <span className="text-xs text-gray-400">to</span>
                    <input
                      type="time"
                      value={welcomeSettings.end_time || "21:00"}
                      onChange={(e) => setWelcomeSettings((s) => ({ ...s, end_time: e.target.value }))}
                      className="px-2.5 py-1 border rounded-lg text-xs bg-white font-mono"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Live Message Preview — mirrors how WhatsApp renders the bubble */}
            <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-emerald-800 tracking-wider">Live Customer Preview</span>
                <span className="text-[10px] text-emerald-700/70">UI preview only — not a live send</span>
              </div>
              <div className="mt-2 bg-white p-3 rounded-xl border border-emerald-100 shadow-sm">
                <p className="text-xs text-emerald-950 whitespace-pre-line leading-relaxed font-sans">
                  {evaluateMessagePlaceholders(welcomeSettings.welcome_text || "Hello {name}! Welcome to Madhura Tech.")}
                </p>

                {welcomeSettings.welcome_type === "buttons" && welcomeSettings.welcome_footer && (
                  <p className="text-[11px] text-gray-400 mt-1.5">{welcomeSettings.welcome_footer}</p>
                )}

                {welcomeSettings.welcome_type === "buttons" &&
                  (welcomeSettings.welcome_buttons || []).filter((b) => b.title).length > 0 && (
                    <div className="mt-2.5 -mx-3 -mb-3">
                      {(welcomeSettings.welcome_buttons || [])
                        .filter((b) => b.title)
                        .map((b, i) => (
                          <div
                            key={i}
                            className="border-t border-gray-200 py-2 text-center text-[13px] font-medium text-[#00a5f4]"
                            title={`Action ID: ${b.id || "(none)"}`}
                          >
                            {b.title}
                          </div>
                        ))}
                    </div>
                  )}
              </div>

              {welcomeSettings.welcome_type === "buttons" && (
                <p className="text-[10px] text-emerald-800/80 mt-2">
                  Taps return the <strong>Action ID</strong>, not the label — so renaming a button never breaks an automation.
                </p>
              )}
            </div>

            <div className="pt-4 border-t flex justify-end">
              <button
                onClick={handleSaveWelcomeSettings}
                disabled={welcomeSaving}
                className="px-6 py-2.5 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 transition shadow-md flex items-center gap-1.5"
              >
                {welcomeSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                <span>Save Welcome Settings</span>
              </button>
            </div>
          </div>

          {/* Test Welcome Send */}
          <div className="p-4 bg-gray-50 rounded-2xl border space-y-3">
            <h3 className="text-xs font-bold text-gray-800 uppercase">Test Welcome Reply on Real Phone</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={welcomeTestPhone}
                onChange={(e) => setWelcomeTestPhone(e.target.value)}
                placeholder="Enter 10-digit mobile number..."
                className="flex-1 px-3 py-2 border rounded-xl text-xs font-mono bg-white outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                onClick={handleTestWelcome}
                disabled={!welcomeTestPhone.trim() || welcomeTestLoading}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition flex items-center gap-1.5"
              >
                {welcomeTestLoading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                <span>Send Test</span>
              </button>
            </div>
            {welcomeTestResult && (
              <div className="space-y-1">
                <p className={`text-xs font-semibold ${welcomeTestResult.success ? "text-emerald-700" : "text-rose-700"}`}>
                  {welcomeTestResult.message}
                </p>
                {welcomeTestResult.warning && (
                  <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                    ⚠️ {welcomeTestResult.warning}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 3: Execution Audit Logs ── */}
      {activeTab === "logs" && (
        <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-gray-900">Automation Trigger Audit Logs</h2>
              <p className="text-xs text-gray-500">Live feed of all automated messages triggered by CRM events</p>
            </div>
            <button onClick={fetchData} className="p-2 border rounded-xl hover:bg-gray-50 text-gray-600">
              <RefreshCw size={15} />
            </button>
          </div>

          {logs.length === 0 ? (
            <div className="text-center py-14 text-gray-400">
              <ListChecks size={36} className="mx-auto mb-2 text-gray-300" />
              <p className="text-xs font-bold">No automation triggers executed yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50 text-gray-600 uppercase font-bold text-[10px]">
                    <th className="py-2.5 px-3">Rule Name</th>
                    <th className="py-2.5 px-3">Trigger Type</th>
                    <th className="py-2.5 px-3">Recipient</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Event Data</th>
                    <th className="py-2.5 px-3">Executed At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map((log) => {
                    let triggerData = {};
                    try {
                      triggerData = typeof log.trigger_data === "string" ? JSON.parse(log.trigger_data) : (log.trigger_data || {});
                    } catch (_) {}

                    return (
                      <tr key={log.id} className="hover:bg-gray-50/80">
                        <td className="py-3 px-3 font-bold text-gray-900">{log.automation_name || "Automation"}</td>
                        <td className="py-3 px-3 uppercase text-[10px] font-bold text-amber-800">{log.trigger_type}</td>
                        <td className="py-3 px-3 font-mono">
                          +{log.phone}
                          {log.contact_name && <span className="block text-[11px] font-normal text-gray-500">{log.contact_name}</span>}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              log.status === "sent" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 max-w-xs truncate text-gray-500 font-mono text-[11px]">
                          {JSON.stringify(triggerData)}
                        </td>
                        <td className="py-3 px-3 text-gray-400 text-[11px]">
                          {log.sent_at ? new Date(log.sent_at).toLocaleString("en-IN") : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── MODAL: Create / Edit Automation ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col border shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b flex items-center justify-between bg-gray-50/90">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <Zap size={18} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">
                    {editAutomation ? "Edit Automation Rule" : "Create WhatsApp Automation"}
                  </h2>
                  <p className="text-xs text-gray-500">Configure background event triggers, anti-ban pacing, and follow-ups</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Rule Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Instant Invoice WhatsApp Notice"
                    className="w-full px-3.5 py-2.5 border rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Trigger Event *</label>
                  <select
                    value={form.trigger_type}
                    onChange={(e) => {
                      const t = e.target.value;
                      setForm((f) => ({
                        ...f,
                        trigger_type: t,
                        message_text: PRESET_MESSAGES[t] || f.message_text,
                      }));
                    }}
                    className="w-full px-3 py-2.5 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-amber-500 bg-white font-medium"
                  >
                    {TRIGGER_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.emoji} {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Step 1: Main Message Box */}
              <div className="p-4 bg-amber-50/40 rounded-2xl border border-amber-200/70 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900 uppercase flex items-center gap-1.5">
                    <span>1️⃣</span>
                    <span>Step 1: Main WhatsApp Message</span>
                  </span>

                  <div className="flex items-center gap-1.5">
                    {["text", "media", "template"].map((kind) => (
                      <button
                        key={kind}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, msg_kind: kind }))}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase transition ${
                          form.msg_kind === kind ? "bg-amber-600 text-white shadow-sm" : "bg-white text-gray-600 border hover:bg-gray-50"
                        }`}
                      >
                        {kind}
                      </button>
                    ))}
                  </div>
                </div>

                {form.msg_kind === "text" && (
                  <div className="space-y-2">
                    <WAVariablePicker
                      onInsert={(tag) => setForm((f) => ({ ...f, message_text: (f.message_text || "") + " " + tag }))}
                    />

                    <textarea
                      rows={4}
                      value={form.message_text || ""}
                      onChange={(e) => setForm((f) => ({ ...f, message_text: e.target.value }))}
                      className="w-full p-3 border rounded-xl text-xs bg-white outline-none focus:ring-2 focus:ring-amber-500 resize-none font-sans"
                      placeholder="Type dynamic message here, e.g. Hello {{name}}! Your invoice {{invoice_no}} for {{amount}} is due on {{due_date}}..."
                    />

                    {form.message_text && (
                      <div className="p-3 bg-slate-900 text-slate-100 rounded-xl border border-slate-800 space-y-1 text-xs">
                        <div className="flex items-center justify-between text-[10px] text-amber-400 font-bold uppercase">
                          <span className="flex items-center gap-1"><Sparkles size={11} /> Live Preview:</span>
                          <span className="text-[9px] text-emerald-400 font-mono">Dynamic Per Recipient</span>
                        </div>
                        <div className="p-2 bg-slate-800/80 rounded-lg text-emerald-300 font-mono text-[11px] whitespace-pre-wrap">
                          {evaluateMessagePlaceholders(form.message_text)}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {form.msg_kind === "media" && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] text-gray-500 font-bold uppercase">Media Type</label>
                        <select
                          value={form.media_type}
                          onChange={(e) => setForm((f) => ({ ...f, media_type: e.target.value }))}
                          className="w-full p-2 border rounded-xl text-xs bg-white font-medium"
                        >
                          <option value="image">📷 Image (PNG, JPG, WEBP)</option>
                          <option value="video">🎥 Video (MP4, MOV, 3GP)</option>
                          <option value="audio">🎵 Audio / Voice (MP3, WAV, OGG)</option>
                          <option value="document">📄 PDF / Word Document</option>
                          <option value="excel">📊 Excel / Spreadsheet (XLSX, CSV)</option>
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] text-gray-500 font-bold uppercase">Media Public URL or Upload</label>
                        <input
                          type="text"
                          value={form.media_url || ""}
                          onChange={(e) => setForm((f) => ({ ...f, media_url: e.target.value }))}
                          placeholder="https://madhuratech.com/catalog.pdf"
                          className="w-full p-2 border rounded-xl text-xs font-mono bg-white"
                        />
                      </div>
                    </div>

                    <textarea
                      rows={2}
                      value={form.message_text || ""}
                      onChange={(e) => setForm((f) => ({ ...f, message_text: e.target.value }))}
                      className="w-full p-2.5 border rounded-xl text-xs bg-white resize-none"
                      placeholder="Optional Media Caption..."
                    />
                  </div>
                )}

                {form.msg_kind === "template" && (
                  <div className="space-y-2">
                    <label className="block text-[10px] text-gray-500 font-bold uppercase mb-1">Select Approved WhatsApp Template</label>
                    <select
                      value={form.template_id}
                      onChange={(e) => setForm((f) => ({ ...f, template_id: e.target.value }))}
                      className="w-full p-2.5 border rounded-xl text-xs bg-white font-semibold"
                    >
                      <option value="">-- Choose Template --</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
                      ))}
                    </select>

                    {form.template_id && (() => {
                      const tmpl = templates.find(t => String(t.id) === String(form.template_id));
                      if (!tmpl) return null;
                      return (
                        <div className="p-3 bg-slate-900 text-slate-100 rounded-xl border border-slate-800 space-y-1 text-xs">
                          <div className="flex items-center justify-between text-[10px] text-amber-400 font-bold uppercase">
                            <span className="flex items-center gap-1"><Sparkles size={11} /> Template Evaluated Preview:</span>
                            <span className="text-[9px] text-emerald-400 font-mono">Dynamic Live</span>
                          </div>
                          <div className="p-2 bg-slate-800/80 rounded-lg text-emerald-300 font-mono text-[11px] whitespace-pre-wrap">
                            {evaluateMessagePlaceholders(tmpl.body || "")}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Step 2: Multi-Message Sequence (Anti-Ban Paced Follow-up) */}
              <div className="p-4 bg-purple-50/40 rounded-2xl border border-purple-200/70 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="enable_seq"
                      checked={form.enable_sequence}
                      onChange={(e) => setForm((f) => ({ ...f, enable_sequence: e.target.checked }))}
                      className="w-4 h-4 accent-purple-600 rounded"
                    />
                    <label htmlFor="enable_seq" className="text-xs font-bold text-purple-900 uppercase cursor-pointer">
                      2️⃣ Enable Step 2 Follow-Up Message (Multi-Step Drip)
                    </label>
                  </div>

                  {form.enable_sequence && (
                    <span className="text-[11px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                      ⏱️ {form.sequence_delay_seconds || 7}s Human Pacing
                    </span>
                  )}
                </div>

                {form.enable_sequence && (
                  <div className="space-y-3 pt-2">
                    <div>
                      <label className="block text-[10px] text-gray-500 font-bold uppercase mb-1">
                        Pacing Delay Gap ({form.sequence_delay_seconds || 7} seconds)
                      </label>
                      <input
                        type="range"
                        min={5}
                        max={60}
                        value={form.sequence_delay_seconds || 7}
                        onChange={(e) => setForm((f) => ({ ...f, sequence_delay_seconds: parseInt(e.target.value, 10) }))}
                        className="w-full accent-purple-600"
                      />
                    </div>

                    <textarea
                      rows={2}
                      value={form.followup_message_text || ""}
                      onChange={(e) => setForm((f) => ({ ...f, followup_message_text: e.target.value }))}
                      className="w-full p-2.5 border rounded-xl text-xs bg-white"
                      placeholder="Follow-up message (e.g. 📄 Download our PDF brochure here: https://...)"
                    />

                    {form.followup_message_text && (
                      <div className="p-2.5 bg-slate-900 text-slate-100 rounded-xl border border-slate-800 space-y-1 text-xs">
                        <div className="flex items-center justify-between text-[10px] text-purple-300 font-bold uppercase">
                          <span className="flex items-center gap-1"><Sparkles size={11} /> Step 2 Follow-Up Preview:</span>
                          <span className="text-[9px] text-emerald-400 font-mono">Dynamic</span>
                        </div>
                        <div className="p-2 bg-slate-800/80 rounded-lg text-emerald-300 font-mono text-[11px] whitespace-pre-wrap">
                          {evaluateMessagePlaceholders(form.followup_message_text)}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Cross-Module Linkages: Contact Group & Chatbot Flow */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-2xl border">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1 flex items-center gap-1">
                    <Users size={12} className="text-blue-600" />
                    <span>Auto-Enroll into Contact Group</span>
                  </label>
                  <select
                    value={form.group_id || ""}
                    onChange={(e) => setForm((f) => ({ ...f, group_id: e.target.value }))}
                    className="w-full p-2 border rounded-xl text-xs bg-white"
                  >
                    <option value="">-- Do Not Enroll in Group --</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>{g.name} ({g.total_contacts || 0} contacts)</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1 flex items-center gap-1">
                    <Bot size={12} className="text-emerald-600" />
                    <span>Auto-Trigger Chatbot Flow</span>
                  </label>
                  <select
                    value={form.flow_id || ""}
                    onChange={(e) => setForm((f) => ({ ...f, flow_id: e.target.value }))}
                    className="w-full p-2 border rounded-xl text-xs bg-white"
                  >
                    <option value="">-- Do Not Trigger Flow --</option>
                    {flows.map((fl) => (
                      <option key={fl.id} value={fl.id}>{fl.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3 p-4 border-t bg-white">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 border rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="flex-1 py-2.5 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 transition shadow-md flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 size={15} />
                <span>{editAutomation ? "Update Rule" : "Create Automation"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Test Trigger on Real Phone ── */}
      {testModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setTestModal(null)}>
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Play size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Test Send Automation</h3>
                  <p className="text-xs text-gray-500 truncate max-w-[220px]">{testModal.name}</p>
                </div>
              </div>
              <button onClick={() => setTestModal(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Target 10-Digit Mobile Number</label>
                <input
                  type="text"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full px-3.5 py-2.5 border rounded-xl text-xs font-mono bg-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Simulated Contact Name</label>
                <input
                  type="text"
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full px-3.5 py-2.5 border rounded-xl text-xs bg-white"
                />
              </div>

              {testModal && (testModal.message_text || testModal.template_body) && (
                <div className="p-3 bg-slate-900 text-slate-100 rounded-xl border border-slate-800 space-y-1 text-xs">
                  <div className="flex items-center justify-between text-[10px] text-amber-400 font-bold uppercase">
                    <span className="flex items-center gap-1"><Sparkles size={11} /> Evaluated Message Preview:</span>
                    <span className="text-[9px] text-emerald-400 font-mono">Dynamic Preview</span>
                  </div>
                  <div className="p-2 bg-slate-800/80 rounded-lg text-emerald-300 font-mono text-[11px] whitespace-pre-wrap leading-relaxed">
                    {evaluateMessagePlaceholders(testModal.message_text || testModal.template_body || "", { name: testName || "Customer" })}
                  </div>
                </div>
              )}

              {testResult && (
                <div className={`p-3 rounded-xl text-xs font-bold ${testResult.success ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>
                  {testResult.message}
                </div>
              )}

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setTestModal(null)}
                  className="flex-1 py-2 border rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleTestTrigger}
                  disabled={!testPhone.trim() || testLoading}
                  className="flex-1 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 transition shadow-md flex items-center justify-center gap-1.5"
                >
                  {testLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  <span>Execute Send</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CRM Trigger Simulator & Test Runner ── */}
      {showSimulateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowSimulateModal(false)}>
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl border" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5 border-b pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                  <PlayCircle size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">CRM Event Trigger Simulator</h3>
                  <p className="text-xs text-gray-500">Test how WhatsApp rules respond to CRM database events</p>
                </div>
              </div>
              <button onClick={() => setShowSimulateModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Select CRM Event to Simulate</label>
                  <select
                    value={simTriggerType}
                    onChange={(e) => setSimTriggerType(e.target.value)}
                    className="w-full px-3 py-2.5 border rounded-xl text-xs font-semibold bg-white outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {TRIGGER_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.emoji} {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Simulated Customer Name</label>
                  <input
                    type="text"
                    value={simName}
                    onChange={(e) => setSimName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full px-3.5 py-2.5 border rounded-xl text-xs bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Test WhatsApp Number (Optional)
                </label>
                <input
                  type="text"
                  value={simPhone}
                  onChange={(e) => setSimPhone(e.target.value)}
                  placeholder="e.g. 9876543210 (Leave blank for simulation only)"
                  className="w-full px-3.5 py-2.5 border rounded-xl text-xs font-mono bg-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 p-3 bg-blue-50/60 rounded-xl border border-blue-200/80">
                <input
                  type="checkbox"
                  id="sim_real_send"
                  checked={simSendReal}
                  onChange={(e) => setSimSendReal(e.target.checked)}
                  className="w-4 h-4 accent-blue-600 rounded"
                />
                <label htmlFor="sim_real_send" className="text-xs font-bold text-blue-900 cursor-pointer">
                  Send actual WhatsApp message to this number during simulation
                </label>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSimulateModal(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSimulateTrigger}
                  disabled={simLoading}
                  className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-md flex items-center gap-2 disabled:opacity-50"
                >
                  {simLoading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                  <span>Run Event Simulation</span>
                </button>
              </div>

              {/* Simulation Results Output Panel */}
              {simResult && (
                <div className="mt-5 p-4 bg-slate-900 text-white rounded-2xl border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                        Simulation Result: {simResult.matched_rules_count || 0} Rule(s) Matched
                      </h4>
                    </div>
                    {simResult.real_message_dispatched && (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-400/30">
                        ✅ Live Message Dispatched
                      </span>
                    )}
                  </div>

                  {simResult.evaluated_rules?.length === 0 ? (
                    <div className="py-4 text-center text-xs text-gray-400">
                      <AlertCircle size={20} className="mx-auto mb-1 text-amber-400" />
                      <p className="font-bold text-gray-300">No active rules configured for "{simTriggerType}"</p>
                      <p className="text-[11px] text-gray-500 mt-1">Create an automation rule for this trigger or click "Load 12 Prebuilt Smart Rules".</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {simResult.evaluated_rules?.map((r, rIdx) => (
                        <div key={rIdx} className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/80 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-amber-300">Rule: {r.name}</span>
                            <span className="text-[10px] text-gray-400 font-mono">Delay: {r.delay_minutes > 0 ? `${r.delay_minutes}m` : "Instant"}</span>
                          </div>

                          <div className="bg-[#0b141a] p-3 rounded-xl text-xs font-sans text-gray-100 whitespace-pre-line border border-emerald-500/20 shadow-inner">
                            <div className="text-[10px] font-bold uppercase text-emerald-400 mb-1">1️⃣ Step 1 Output Message:</div>
                            {r.step1_text}
                          </div>

                          {r.step2_followup_text && (
                            <div className="bg-[#0b141a] p-3 rounded-xl text-xs font-sans text-purple-200 whitespace-pre-line border border-purple-500/20 shadow-inner">
                              <div className="text-[10px] font-bold uppercase text-purple-400 mb-1">
                                2️⃣ Step 2 Follow-Up Message (after {r.sequence_delay_seconds}s):
                              </div>
                              {r.step2_followup_text}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
