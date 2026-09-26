import React, { useState, useEffect, useRef } from "react";
import {
  Bell, CheckCircle2, RefreshCw, XCircle, Clock, Send,
  Settings, Play, Plus, Loader2, Sparkles, Check, AlertCircle,
  Calendar, CreditCard, ShieldCheck, FileText, UserCheck, Trash2,
  Layers, MessageSquare, ArrowRight, CornerDownRight, CheckSquare, Save,
  Smartphone, Bot, Zap, Filter, Search, Users, CheckCheck, ChevronRight,
  Eye, Copy, Sliders, Wand2, PhoneCall, ExternalLink, HelpCircle
} from "lucide-react";
import axios from "axios";
import { API } from "../config/api";
import socket from "../socket/socket";
import { evaluateMessagePlaceholders } from "./WAVariablePicker";

// ── 1. Persona Definitions & Tone Profiles ─────────────────────────────────────
const PERSONA_STYLES = [
  {
    id: "professional",
    label: "💼 Corporate & Formal",
    desc: "Polite, crisp, concise, enterprise-grade",
    badgeColor: "bg-blue-100 text-blue-800 border-blue-200",
  },
  {
    id: "friendly",
    label: "😊 Warm & Friendly",
    desc: "Approachable, conversational, positive emojis",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  {
    id: "urgent",
    label: "⚡ Urgent & Action-Driven",
    desc: "Clear deadline focus, priority action call",
    badgeColor: "bg-rose-100 text-rose-800 border-rose-200",
  },
  {
    id: "vip",
    label: "👑 VIP Executive",
    desc: "White-glove concierge treatment, premium tone",
    badgeColor: "bg-purple-100 text-purple-800 border-purple-200",
  },
  {
    id: "technical",
    label: "🛠️ Technical & Field",
    desc: "Logistics-focused, site inspection details",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
  },
];

// ── 2. Context Variables & Dynamic Tags ────────────────────────────────────────
const DYNAMIC_VARIABLES = [
  { tag: "{name}", label: "Customer Name", sample: "Rahul Sharma" },
  { tag: "{first_name}", label: "First Name", sample: "Rahul" },
  { tag: "{tomorrow}", label: "Tomorrow Date", sample: "Tomorrow's Date" },
  { tag: "{tomorrow_day}", label: "Tomorrow Day Name", sample: "Tomorrow's Day Name" },
  { tag: "{day}", label: "Today's Day", sample: "Wednesday" },
  { tag: "{day_name}", label: "Day Name", sample: "Wednesday" },
  { tag: "{date}", label: "Date", sample: "Today's Date" },
  { tag: "{time}", label: "Time", sample: "11:00 AM" },
  { tag: "{date_time}", label: "Live Date & Time", sample: "Date & Time" },
  { tag: "{greeting_time}", label: "Smart Greeting", sample: "Good morning / afternoon" },
  { tag: "{company}", label: "Company", sample: "Apex Technologies" },
  { tag: "{phone}", label: "Phone", sample: "9876543210" },
  { tag: "{city}", label: "City", sample: "Chennai" },
  { tag: "{service_name}", label: "Service Name", sample: "AC Overhaul & Maintenance" },
  { tag: "{engineer_name}", label: "Engineer", sample: "Ramesh Kumar" },
  { tag: "{amount}", label: "Amount", sample: "₹18,500" },
  { tag: "{invoice_no}", label: "Invoice #", sample: "INV-2026-089" },
  { tag: "{due_date}", label: "Due Date", sample: "Tomorrow" },
  { tag: "{quote_no}", label: "Quote #", sample: "QT-202608-41" },
  { tag: "{contract_title}", label: "Contract", sample: "HVAC Annual AMC" },
  { tag: "{expiry_date}", label: "Expiry Date", sample: "31 Aug 2026" },
];

// ── 3. Multi-Dynamic Template Presets by Category & Persona ────────────────────
const REMINDER_TEMPLATES = {
  appointment_reminder: {
    professional: "Dear {name}, this is a reminder for your scheduled {service_name} with our technician {engineer_name} on {date} at {time}. Please confirm your availability:",
    friendly: "Hi {name}! 👋 Looking forward to visiting you for {service_name} on {date} at {time}. Our technician {engineer_name} will be there. Could you please confirm if this time works?",
    urgent: "Action Required: Your {service_name} appointment is scheduled for {date} at {time}. Please confirm right away to secure your technician slot:",
    vip: "Dear {name}, our senior specialist {engineer_name} is reserved exclusively for your {service_name} on {date} at {time}. Kindly confirm if the schedule suits your convenience:",
    technical: "Technical Notice: Scheduled {service_name} for site on {date} at {time}. Assigned Engineer: {engineer_name}. Please confirm site access and equipment readiness:",
  },
  payment_due: {
    professional: "Dear {name}, gentle reminder that invoice {invoice_no} for {amount} is due for payment on {due_date}. Please choose your preferred payment option below:",
    friendly: "Hi {name}! 😊 Just a friendly reminder from our accounts team regarding invoice {invoice_no} ({amount}) due on {due_date}. Please let us know if you need assistance or have already paid:",
    urgent: "Payment Notice: Invoice {invoice_no} ({amount}) is due on {due_date}. Please settle promptly or contact accounts to prevent service suspension:",
    vip: "Dear {name}, your quarterly account statement indicates invoice {invoice_no} ({amount}) is scheduled for settlement on {due_date}. Please let us know how we may assist:",
    technical: "Accounts Notice: Invoice {invoice_no} totaling {amount} due on {due_date}. Please confirm payment reference or request official receipt copy:",
  },
  quotation_followup: {
    professional: "Dear {name}, following up on quotation proposal {quote_no} for {service_name} ({amount}). Please confirm if you wish to approve and proceed:",
    friendly: "Hi {name}! Hope your week is going great. We wanted to check in on proposal {quote_no} for {service_name}. Would you like to get started?",
    urgent: "Special Rate Notice: Quotation {quote_no} pricing for {amount} is valid for a limited period. Would you like to approve and lock in this proposal today?",
    vip: "Dear {name}, regarding proposal {quote_no} customized for {company}. We are ready to initiate white-glove onboarding at your earliest convenience:",
    technical: "Scope Review: Following up on technical quotation {quote_no} for {service_name}. Let us know if you require adjustments to the bill of quantities:",
  },
  amc_renewal: {
    professional: "Dear {name}, your Annual Maintenance Contract (AMC) for {contract_title} expires on {expiry_date}. Please confirm your renewal preference:",
    friendly: "Hi {name}! Your AMC protection for {contract_title} expires on {expiry_date}. Let's renew today so you enjoy zero equipment downtime!",
    urgent: "Urgent: Your AMC warranty for {contract_title} expires on {expiry_date}. Please confirm renewal to prevent lapse in emergency technician coverage:",
    vip: "Dear {name}, your dedicated priority AMC coverage for {contract_title} is up for annual renewal on {expiry_date}. We have pre-approved your renewal package:",
    technical: "Preventive Maintenance Notice: Contract {contract_title} expires on {expiry_date}. Please authorize renewal for scheduled quarterly servicing:",
  },
  lead_followup: {
    professional: "Dear {name}, thank you for inquiring about {service_name}. Would you be available for a brief 10-minute consultation with our team?",
    friendly: "Hi {name}! 👋 Great to connect with you. Would you like to book a quick demo or chat with our specialist regarding {service_name}?",
    urgent: "Priority Inbound: We received your inquiry for {service_name}. Let us know your availability today so our senior executive can connect:",
    vip: "Dear {name}, our executive leadership has prepared tailored insights for {company} regarding {service_name}. How may we best connect?",
    technical: "Technical Assessment: Regarding your requirement for {service_name}. Let us schedule an on-site feasibility review at your convenience:",
  },
};

const REMINDER_TYPES = [
  {
    value: "appointment_reminder",
    label: "📅 Service & Appointment Visit",
    desc: "Pre-visit confirmation gateway with technician details",
    icon: Calendar,
    color: "bg-blue-50 text-blue-700 border-blue-200",
    defaultOptions: [
      { id: "btn_confirm", label: "✅ Confirm Visit", action: "confirm_appointment" },
      { id: "btn_reschedule", label: "🔄 Reschedule", action: "reschedule_appointment" },
      { id: "btn_cancel", label: "❌ Cancel", action: "cancel_appointment" },
    ],
  },
  {
    value: "payment_due",
    label: "💰 Payment Due Invoice",
    desc: "Automated invoice collection & payment receipt gateway",
    icon: CreditCard,
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    defaultOptions: [
      { id: "btn_paid", label: "💳 Already Paid", action: "confirm_payment" },
      { id: "btn_invoice", label: "📄 Send Invoice", action: "send_invoice_copy" },
      { id: "btn_call_acc", label: "📞 Speak to Accounts", action: "request_callback" },
    ],
  },
  {
    value: "quotation_followup",
    label: "💼 Quotation & Proposal Followup",
    desc: "Close high-value quotes with 1-tap customer approvals",
    icon: FileText,
    color: "bg-purple-50 text-purple-700 border-purple-200",
    defaultOptions: [
      { id: "btn_approve_quote", label: "👍 Approve & Proceed", action: "approve_quotation" },
      { id: "btn_modify_quote", label: "💬 Need Changes", action: "request_callback" },
      { id: "btn_reject_quote", label: "❌ Not Interested", action: "reject_quotation" },
    ],
  },
  {
    value: "amc_renewal",
    label: "🛡️ AMC Contract Renewal",
    desc: "Prevent contract churn with timed renewal triggers",
    icon: ShieldCheck,
    color: "bg-amber-50 text-amber-700 border-amber-200",
    defaultOptions: [
      { id: "btn_renew_amc", label: "🛡️ Renew AMC", action: "renew_amc" },
      { id: "btn_call_amc", label: "📞 Speak to Engineer", action: "request_callback" },
    ],
  },
  {
    value: "lead_followup",
    label: "🎯 Lead Interest Check",
    desc: "Qualify fresh leads with demo and callback options",
    icon: UserCheck,
    color: "bg-indigo-50 text-indigo-700 border-indigo-200",
    defaultOptions: [
      { id: "btn_interested", label: "👍 Interested", action: "confirm_lead_interest" },
      { id: "btn_demo", label: "📅 Book Demo", action: "reschedule_appointment" },
      { id: "btn_not_now", label: "❌ Not Now", action: "cancel_appointment" },
    ],
  },
];

// Helper to replace {tags} with variables or fallback samples
function interpolateText(text = "", vars = {}) {
  if (!text) return "";
  return evaluateMessagePlaceholders(text, vars);
}

export default function WhatsAppInteractiveReminders() {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState("queue"); // "queue" | "logs" | "cadence"

  // Summary KPIs
  const [summary, setSummary] = useState({
    total: 0,
    confirmed: 0,
    rescheduled: 0,
    cancelled: 0,
    paid: 0,
    pending: 0,
    failed: 0,
    responseRate: 0,
  });

  // Data lists
  const [reminders, setReminders] = useState([]);
  const [queueItems, setQueueItems] = useState([]);
  const [cadenceRules, setCadenceRules] = useState([]);
  const [settings, setSettings] = useState({
    appointment_reminders_enabled: true,
    appointment_reminder_hours_before: 24,
    payment_due_reminders_enabled: true,
    payment_due_days_before: 1,
    lead_followup_reminders_enabled: true,
    amc_renewal_reminders_enabled: true,
    amc_renewal_days_before: 7,
    confirmation_auto_update_crm: true,
    notify_staff_on_response: true,
    default_confirm_prompt: "",
    default_reschedule_prompt: "",
    default_cancel_prompt: "",
  });

  // Filter & search states
  const [loading, setLoading] = useState(true);
  const [queueLoading, setQueueLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [queueTypeFilter, setQueueTypeFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Bulk selection in queue
  const [selectedQueueIds, setSelectedQueueIds] = useState(new Set());
  const [bulkDispatching, setBulkDispatching] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState("");

  // Instant Send Modal State
  const [showSendModal, setShowSendModal] = useState(false);
  const [activePersona, setActivePersona] = useState("professional");
  const [contactSearchQuery, setContactSearchQuery] = useState("");
  const [contactSuggestions, setContactSuggestions] = useState([]);
  const [searchingContacts, setSearchingContacts] = useState(false);

  const [sendForm, setSendForm] = useState({
    phone: "",
    contact_name: "",
    company: "",
    reminder_type: "appointment_reminder",
    title: "Service Visit Confirmation",
    message_text: REMINDER_TEMPLATES.appointment_reminder.professional,
    options: REMINDER_TYPES[0].defaultOptions,
    ref_table: null,
    ref_id: null,
    variables: {
      name: "Rahul Sharma",
      first_name: "Rahul",
      company: "Apex Technologies",
      service_name: "AC Overhaul & Maintenance",
      engineer_name: "Ramesh Kumar",
      date: "Tomorrow",
      time: "11:00 AM",
      amount: "₹18,500",
      invoice_no: "INV-2026-089",
      quote_no: "QT-202608-41",
      contract_title: "HVAC Annual AMC",
      expiry_date: "31 Aug 2026",
    },
  });
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  // Simulation Modal State (2-Way Test)
  const [showSimModal, setShowSimModal] = useState(false);
  const [simTarget, setSimTarget] = useState(null);
  const [simulating, setSimulating] = useState(false);
  const [simFeedback, setSimFeedback] = useState("");
  const [customSimText, setCustomSimText] = useState("");

  // Settings Modal State
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Trigger Schedulers State
  const [triggeringCheck, setTriggeringCheck] = useState(false);
  const [triggerMessage, setTriggerMessage] = useState("");

  // Cadence Rules Saving
  const [savingCadence, setSavingCadence] = useState(false);
  const [cadenceFeedback, setCadenceFeedback] = useState("");

  const messageTextAreaRef = useRef(null);

  const headers = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

  // ── Fetch Master Data ────────────────────────────────────────────────────────
  const fetchData = async () => {
    setLoading(true);
    try {
      const [sumRes, remRes, setRes, cadRes] = await Promise.all([
        axios.get(`${API}/api/wa/reminders/summary`, { headers: headers() }).catch(() => null),
        axios.get(`${API}/api/wa/reminders/list`, { headers: headers() }).catch(() => null),
        axios.get(`${API}/api/wa/reminders/settings`, { headers: headers() }).catch(() => null),
        axios.get(`${API}/api/wa/reminders/cadence-rules`, { headers: headers() }).catch(() => null),
      ]);

      if (sumRes?.data) setSummary(sumRes.data);
      if (remRes?.data) setReminders(remRes.data);
      if (setRes?.data) setSettings(setRes.data);
      if (cadRes?.data) setCadenceRules(cadRes.data);
    } catch (err) {
      console.error("Error loading interactive reminders:", err);
    }
    setLoading(false);
  };

  const fetchQueue = async () => {
    setQueueLoading(true);
    try {
      const { data } = await axios.get(`${API}/api/wa/reminders/pending-queue`, { headers: headers() });
      if (data?.items) {
        setQueueItems(data.items);
      }
    } catch (err) {
      console.error("Error loading pending queue:", err);
    }
    setQueueLoading(false);
  };

  useEffect(() => {
    fetchData();
    fetchQueue();

    const handleUpdate = () => {
      fetchData();
      fetchQueue();
    };

    socket.on("data_changed", handleUpdate);
    socket.on("wa_message_received", handleUpdate);
    socket.on("wa_reminder_updated", handleUpdate);

    return () => {
      socket.off("data_changed", handleUpdate);
      socket.off("wa_message_received", handleUpdate);
      socket.off("wa_reminder_updated", handleUpdate);
    };
  }, []);

  // ── CRM Contact Search Auto-Suggest ──────────────────────────────────────────
  useEffect(() => {
    if (!contactSearchQuery || contactSearchQuery.trim().length < 2) {
      setContactSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchingContacts(true);
      try {
        const { data } = await axios.get(`${API}/api/wa/reminders/search-crm-contacts?q=${encodeURIComponent(contactSearchQuery)}`, {
          headers: headers(),
        });
        setContactSuggestions(data || []);
      } catch (e) {
        setContactSuggestions([]);
      }
      setSearchingContacts(false);
    }, 280);

    return () => clearTimeout(timer);
  }, [contactSearchQuery]);

  const handleSelectContact = (c) => {
    const firstName = (c.name || "Customer").split(" ")[0];
    setSendForm((prev) => ({
      ...prev,
      phone: c.phone,
      contact_name: c.name,
      company: c.company || "",
      variables: {
        ...prev.variables,
        name: c.name,
        first_name: firstName,
        company: c.company || c.name,
        phone: c.phone,
        city: c.city || "Local",
        service_name: c.service || prev.variables.service_name,
      },
    }));
    setContactSearchQuery("");
    setContactSuggestions([]);
  };

  // ── Persona & Type Switching ────────────────────────────────────────────────
  const handlePersonaChange = (personaId) => {
    setActivePersona(personaId);
    const typeTemplates = REMINDER_TEMPLATES[sendForm.reminder_type] || REMINDER_TEMPLATES.appointment_reminder;
    const chosenTemplate = typeTemplates[personaId] || typeTemplates.professional;
    setSendForm((prev) => ({
      ...prev,
      message_text: chosenTemplate,
    }));
  };

  const handleReminderTypeChange = (typeVal) => {
    const matched = REMINDER_TYPES.find((t) => t.value === typeVal) || REMINDER_TYPES[0];
    const typeTemplates = REMINDER_TEMPLATES[typeVal] || REMINDER_TEMPLATES.appointment_reminder;
    const chosenTemplate = typeTemplates[activePersona] || typeTemplates.professional;

    setSendForm((prev) => ({
      ...prev,
      reminder_type: typeVal,
      title: `${matched.label.replace(/[^a-zA-Z &]/g, "").trim()}`,
      message_text: chosenTemplate,
      options: matched.defaultOptions,
    }));
  };

  // Insert Variable Chip at cursor
  const insertVariableTag = (tag) => {
    const textarea = messageTextAreaRef.current;
    if (!textarea) {
      setSendForm((prev) => ({ ...prev, message_text: prev.message_text + " " + tag }));
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const oldText = sendForm.message_text;
    const newText = oldText.substring(0, start) + tag + oldText.substring(end);
    setSendForm((prev) => ({ ...prev, message_text: newText }));
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length);
    }, 50);
  };

  // ── Instant Send Handler ────────────────────────────────────────────────────
  const handleSendNow = async (e) => {
    e.preventDefault();
    if (!sendForm.phone.trim()) return alert("Mobile number is required");
    setSending(true);
    setSendSuccess(false);

    try {
      const finalMessage = interpolateText(sendForm.message_text, sendForm.variables);

      await axios.post(
        `${API}/api/wa/reminders/send-now`,
        {
          ...sendForm,
          message_text: finalMessage,
        },
        { headers: headers() }
      );

      setSendSuccess(true);
      fetchData();
      fetchQueue();
      setTimeout(() => {
        setSendSuccess(false);
        setShowSendModal(false);
      }, 1500);
    } catch (err) {
      alert(err.response?.data?.error || err.message || "Failed to dispatch interactive reminder");
    }
    setSending(false);
  };

  // ── 1-Click Send from Queue ─────────────────────────────────────────────────
  const handleSendFromQueue = async (item) => {
    try {
      const finalMsg = interpolateText(item.suggested_text, item.variables);
      await axios.post(
        `${API}/api/wa/reminders/send-now`,
        {
          phone: item.phone,
          contact_name: item.customer_name,
          reminder_type: item.reminder_type,
          title: item.context_title,
          message_text: finalMsg,
          options: item.options,
          ref_table: item.ref_table,
          ref_id: item.ref_id,
        },
        { headers: headers() }
      );
      fetchData();
      fetchQueue();
    } catch (err) {
      alert(err.response?.data?.error || "Send failed");
    }
  };

  const handleOpenCustomizeQueueItem = (item) => {
    setSendForm({
      phone: item.phone,
      contact_name: item.customer_name,
      company: item.company || "",
      reminder_type: item.reminder_type,
      title: item.context_title,
      message_text: item.suggested_text,
      options: item.options,
      ref_table: item.ref_table,
      ref_id: item.ref_id,
      variables: item.variables,
    });
    setShowSendModal(true);
  };

  // ── Bulk Dispatch from Queue ────────────────────────────────────────────────
  const toggleQueueSelect = (qid) => {
    setSelectedQueueIds((prev) => {
      const next = new Set(prev);
      if (next.has(qid)) next.delete(qid);
      else next.add(qid);
      return next;
    });
  };

  const toggleSelectAllQueue = () => {
    if (selectedQueueIds.size === filteredQueue.length) {
      setSelectedQueueIds(new Set());
    } else {
      setSelectedQueueIds(new Set(filteredQueue.map((q) => q.queue_id)));
    }
  };

  const handleBulkDispatchSelected = async () => {
    if (selectedQueueIds.size === 0) return;
    if (!window.confirm(`Dispatch ${selectedQueueIds.size} personalized WhatsApp reminders now?`)) return;

    setBulkDispatching(true);
    setBulkFeedback("");
    const toSend = queueItems.filter((q) => selectedQueueIds.has(q.queue_id));

    try {
      const { data } = await axios.post(`${API}/api/wa/reminders/bulk-send`, { items: toSend }, { headers: headers() });
      setBulkFeedback(data.message || `Dispatched ${data.sentCount} reminders!`);
      setSelectedQueueIds(new Set());
      fetchData();
      fetchQueue();
      setTimeout(() => setBulkFeedback(""), 5000);
    } catch (err) {
      alert(err.response?.data?.error || "Bulk dispatch failed");
    }
    setBulkDispatching(false);
  };

  // ── 2-Way Interactive Simulator ─────────────────────────────────────────────
  const openSimulationModal = (reminder) => {
    setSimTarget(reminder);
    setSimFeedback("");
    setCustomSimText("");
    setShowSimModal(true);
  };

  const handleExecuteSimulation = async (action, text = null) => {
    if (!simTarget) return;
    setSimulating(true);
    setSimFeedback("");

    try {
      const { data } = await axios.post(
        `${API}/api/wa/reminders/simulate-reply`,
        {
          reminderId: simTarget.id,
          action,
          text: text || action.replace(/_/g, " "),
        },
        { headers: headers() }
      );

      setSimFeedback(data.message || "Simulated customer response handled!");
      fetchData();
      fetchQueue();
      setTimeout(() => {
        setShowSimModal(false);
        setSimFeedback("");
      }, 1600);
    } catch (err) {
      alert(err.response?.data?.error || "Simulation failed");
    }
    setSimulating(false);
  };

  // ── Schedulers Run Trigger ──────────────────────────────────────────────────
  const handleTriggerSchedulers = async () => {
    setTriggeringCheck(true);
    setTriggerMessage("");
    try {
      const { data } = await axios.post(`${API}/api/wa/reminders/trigger-check`, { scheduler_type: "all" }, { headers: headers() });
      setTriggerMessage(data.message || "Automated reminder checks executed!");
      fetchData();
      fetchQueue();
      setTimeout(() => setTriggerMessage(""), 4500);
    } catch (err) {
      alert(err.response?.data?.error || "Check failed");
    }
    setTriggeringCheck(false);
  };

  // ── Cadence Rules Save ──────────────────────────────────────────────────────
  const handleSaveCadenceRules = async () => {
    setSavingCadence(true);
    setCadenceFeedback("");
    try {
      await axios.put(`${API}/api/wa/reminders/cadence-rules`, cadenceRules, { headers: headers() });
      setCadenceFeedback("Cadence Automation Rules saved successfully!");
      setTimeout(() => setCadenceFeedback(""), 3500);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to save cadence rules");
    }
    setSavingCadence(false);
  };

  const handleToggleCadenceCategory = (catIdx) => {
    setCadenceRules((prev) => {
      const copy = [...prev];
      copy[catIdx].enabled = !copy[catIdx].enabled;
      return copy;
    });
  };

  // ── Resend & Delete Logs ────────────────────────────────────────────────────
  const handleResend = async (id) => {
    if (!window.confirm("Resend this interactive reminder to customer?")) return;
    try {
      await axios.post(`${API}/api/wa/reminders/${id}/resend`, {}, { headers: headers() });
      alert("Reminder resent successfully!");
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || "Resend failed");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this reminder record?")) return;
    try {
      await axios.delete(`${API}/api/wa/reminders/${id}`, { headers: headers() });
      fetchData();
    } catch {}
  };

  // Filtered Queue
  const filteredQueue = queueItems.filter((q) => {
    if (queueTypeFilter !== "all" && q.reminder_type !== queueTypeFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        (q.customer_name && q.customer_name.toLowerCase().includes(term)) ||
        (q.phone && q.phone.includes(term)) ||
        (q.context_title && q.context_title.toLowerCase().includes(term))
      );
    }
    return true;
  });

  // Filtered Logs
  const filteredReminders = reminders.filter((r) => {
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    if (filterType !== "all" && r.reminder_type !== filterType) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        (r.contact_name && r.contact_name.toLowerCase().includes(term)) ||
        (r.phone && r.phone.includes(term)) ||
        (r.title && r.title.toLowerCase().includes(term))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* ── Top Summary & Response Rate Bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-1 hover:border-amber-400 transition">
          <div className="flex items-center justify-between text-gray-500 text-xs font-bold uppercase">
            <span>Total Sent</span>
            <Send size={15} className="text-gray-400" />
          </div>
          <p className="text-2xl font-black text-gray-900">{summary.total || 0}</p>
          <span className="text-[11px] text-gray-400">Interactive Requests</span>
        </div>

        <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200 shadow-sm space-y-1 hover:border-emerald-400 transition">
          <div className="flex items-center justify-between text-emerald-800 text-xs font-bold uppercase">
            <span>Confirmed</span>
            <CheckCircle2 size={16} className="text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-900">{summary.confirmed || 0}</p>
          <span className="text-[11px] font-bold text-emerald-700">
            {summary.total > 0 ? `${Math.round((summary.confirmed / summary.total) * 100)}% Conversion` : "0%"}
          </span>
        </div>

        <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200 shadow-sm space-y-1 hover:border-amber-400 transition">
          <div className="flex items-center justify-between text-amber-800 text-xs font-bold uppercase">
            <span>Rescheduled</span>
            <Clock size={16} className="text-amber-600" />
          </div>
          <p className="text-2xl font-black text-amber-900">{summary.rescheduled || 0}</p>
          <span className="text-[11px] text-amber-700 font-semibold">Gated Followup Set</span>
        </div>

        <div className="bg-rose-50/70 p-4 rounded-2xl border border-rose-200 shadow-sm space-y-1 hover:border-rose-400 transition">
          <div className="flex items-center justify-between text-rose-800 text-xs font-bold uppercase">
            <span>Cancelled</span>
            <XCircle size={16} className="text-rose-600" />
          </div>
          <p className="text-2xl font-black text-rose-900">{summary.cancelled || 0}</p>
          <span className="text-[11px] text-rose-700 font-semibold">CRM Auto-Closed</span>
        </div>

        <div className="bg-purple-50/70 p-4 rounded-2xl border border-purple-200 shadow-sm space-y-1 hover:border-purple-400 transition">
          <div className="flex items-center justify-between text-purple-800 text-xs font-bold uppercase">
            <span>Paid / Approved</span>
            <CreditCard size={16} className="text-purple-600" />
          </div>
          <p className="text-2xl font-black text-purple-900">{summary.paid || 0}</p>
          <span className="text-[11px] text-purple-700 font-semibold">Collections Recorded</span>
        </div>

        <div className="bg-indigo-50/70 p-4 rounded-2xl border border-indigo-200 shadow-sm space-y-1 hover:border-indigo-400 transition">
          <div className="flex items-center justify-between text-indigo-800 text-xs font-bold uppercase">
            <span>Response Rate</span>
            <Sparkles size={16} className="text-indigo-600" />
          </div>
          <p className="text-2xl font-black text-indigo-900">{summary.responseRate || 0}%</p>
          <span className="text-[11px] font-bold text-indigo-700">2-Way Action Gate</span>
        </div>
      </div>

      {/* ── Control Bar & Action Buttons ── */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Bot size={20} className="text-amber-600" />
              <span>Multi-Dynamic Personalized Reminders</span>
            </h2>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
              <Zap size={11} className="text-emerald-600" />
              <span>Auto-Pilot Ready</span>
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Scans CRM schedules, tailors personalized tone personas, dispatches interactive button gates, and auto-syncs CRM statuses.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {triggerMessage && (
            <span className="text-xs text-emerald-700 font-bold bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 animate-fade-in flex items-center gap-1.5">
              <CheckCircle2 size={13} />
              <span>{triggerMessage}</span>
            </span>
          )}

          <button
            onClick={handleTriggerSchedulers}
            disabled={triggeringCheck}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-gray-700 rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50"
            title="Scan CRM tables and trigger automated cron routines right now"
          >
            {triggeringCheck ? <Loader2 size={14} className="animate-spin text-amber-600" /> : <Play size={14} />}
            <span>Run Schedulers Now</span>
          </button>

          <button
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-gray-700 rounded-xl text-xs font-bold transition shadow-sm"
          >
            <Settings size={14} />
            <span>Settings</span>
          </button>

          <button
            onClick={() => setShowSendModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-amber-600/20"
          >
            <Plus size={15} />
            <span>Instant Personalized Send</span>
          </button>
        </div>
      </div>

      {/* ── Main Workspace Navigation Tabs ── */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-1">
        <button
          onClick={() => setActiveTab("queue")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition relative ${
            activeTab === "queue"
              ? "bg-amber-600 text-white shadow-md shadow-amber-600/20"
              : "bg-slate-100 text-gray-600 hover:bg-slate-200"
          }`}
        >
          <Zap size={14} />
          <span>⚡ Automated CRM Queue</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
            activeTab === "queue" ? "bg-white/20 text-white" : "bg-amber-100 text-amber-800"
          }`}>
            {queueItems.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("logs")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
            activeTab === "logs"
              ? "bg-amber-600 text-white shadow-md shadow-amber-600/20"
              : "bg-slate-100 text-gray-600 hover:bg-slate-200"
          }`}
        >
          <Layers size={14} />
          <span>📊 Live Reminder Logs & Confirmations</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
            activeTab === "logs" ? "bg-white/20 text-white" : "bg-slate-200 text-gray-700"
          }`}>
            {reminders.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("cadence")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
            activeTab === "cadence"
              ? "bg-amber-600 text-white shadow-md shadow-amber-600/20"
              : "bg-slate-100 text-gray-600 hover:bg-slate-200"
          }`}
        >
          <Sliders size={14} />
          <span>🤖 Multi-Stage Cadence & Personas</span>
        </button>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          TAB 1: AUTOMATED CRM QUEUE (1-Click & Bulk Batch Dispatch)
      ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === "queue" && (
        <div className="space-y-4">
          {/* Queue Filter & Bulk Bar */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-bold text-gray-700 mr-1">Pipeline:</span>
              {[
                { id: "all", label: "All Pipelines" },
                { id: "appointment_reminder", label: "📅 Visits" },
                { id: "quotation_followup", label: "💼 Quotations" },
                { id: "amc_renewal", label: "🛡️ AMC Renewals" },
                { id: "payment_due", label: "💰 Invoices" },
              ].map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => setQueueTypeFilter(pill.id)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition ${
                    queueTypeFilter === pill.id
                      ? "bg-amber-600 text-white shadow-sm"
                      : "bg-slate-100 text-gray-600 hover:bg-slate-200"
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              {bulkFeedback && (
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 animate-fade-in">
                  {bulkFeedback}
                </span>
              )}

              {selectedQueueIds.size > 0 && (
                <button
                  onClick={handleBulkDispatchSelected}
                  disabled={bulkDispatching}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold shadow-md transition disabled:opacity-50"
                >
                  {bulkDispatching ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
                  <span>Bulk Dispatch ({selectedQueueIds.size})</span>
                </button>
              )}

              <button
                onClick={fetchQueue}
                className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-gray-600 transition shrink-0"
                title="Refresh CRM Queue"
              >
                <RefreshCw size={14} className={queueLoading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          {/* Queue Items Table / Cards */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden text-xs">
            {queueLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 size={32} className="animate-spin text-amber-600" />
              </div>
            ) : filteredQueue.length === 0 ? (
              <div className="text-center py-16 p-6">
                <CheckCircle2 size={36} className="mx-auto mb-2 text-emerald-500" />
                <p className="font-bold text-gray-800">All automated reminder pipelines are up to date!</p>
                <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
                  No pending appointment visits, quotations, invoices, or AMC contracts require followups right now.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-gray-200 text-gray-600 font-bold uppercase text-[10px]">
                      <th className="py-3 px-4 w-10">
                        <input
                          type="checkbox"
                          checked={selectedQueueIds.size === filteredQueue.length && filteredQueue.length > 0}
                          onChange={toggleSelectAllQueue}
                          className="rounded text-amber-600"
                        />
                      </th>
                      <th className="py-3 px-4">Customer & Phone</th>
                      <th className="py-3 px-4">Event Context & Title</th>
                      <th className="py-3 px-4">Timing & Urgency</th>
                      <th className="py-3 px-4">Personalized Preview</th>
                      <th className="py-3 px-4">Last Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredQueue.map((item) => {
                      const isSelected = selectedQueueIds.has(item.queue_id);
                      return (
                        <tr
                          key={item.queue_id}
                          className={`transition ${isSelected ? "bg-amber-50/50" : "hover:bg-slate-50/80"}`}
                        >
                          <td className="py-3.5 px-4">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleQueueSelect(item.queue_id)}
                              className="rounded text-amber-600"
                            />
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-bold text-gray-900">{item.customer_name}</div>
                            <div className="text-[11px] text-gray-500 font-mono">+{item.phone}</div>
                            {item.company && item.company !== item.customer_name && (
                              <div className="text-[10px] text-gray-400">{item.company}</div>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="font-bold text-gray-800 block">{item.context_title}</span>
                            <span className="text-[10px] text-gray-400">
                              Table: {item.ref_table} #{item.ref_id} {item.amount ? `(${item.amount})` : ""}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                              <Clock size={10} />
                              <span>{item.due_label}</span>
                            </span>
                          </td>

                          <td className="py-3.5 px-4 max-w-xs">
                            <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 text-gray-700 text-[11px] truncate">
                              "{interpolateText(item.suggested_text, item.variables)}"
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            {item.already_sent ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-gray-700 border border-gray-300">
                                <CheckCheck size={11} className="text-emerald-600" />
                                <span>Sent ({item.last_status || "sent"})</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span>⚡ Ready to Send</span>
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleSendFromQueue(item)}
                                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold transition shadow-sm flex items-center gap-1"
                              >
                                <Send size={11} />
                                <span>Send</span>
                              </button>
                              <button
                                onClick={() => handleOpenCustomizeQueueItem(item)}
                                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-gray-700 rounded-lg text-[11px] font-bold transition"
                                title="Customize template & tone before sending"
                              >
                                Customize
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          TAB 2: LIVE REMINDERS LOGS & 2-WAY CONFIRMATIONS
      ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === "logs" && (
        <div className="space-y-4">
          {/* Status Filters & Search Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-bold text-gray-700 mr-1">Status:</span>
              {["all", "confirmed", "rescheduled", "cancelled", "paid", "sent"].map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition capitalize ${
                    filterStatus === st
                      ? "bg-amber-600 text-white shadow-sm"
                      : "bg-slate-100 text-gray-600 hover:bg-slate-200"
                  }`}
                >
                  {st === "sent" ? "Pending Reply" : st}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search recipient, mobile, title..."
                className="px-3.5 py-1.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 w-full sm:w-60 text-xs"
              />
              <button
                onClick={fetchData}
                className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-gray-600 transition shrink-0"
                title="Refresh logs"
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          {/* Logs Table */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden text-xs">
            {loading ? (
              <div className="flex justify-center py-20">
                <Loader2 size={32} className="animate-spin text-amber-600" />
              </div>
            ) : filteredReminders.length === 0 ? (
              <div className="text-center py-16 p-6">
                <Bell size={36} className="mx-auto mb-2 text-gray-300" />
                <p className="font-bold text-gray-700">No reminder logs found</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Click "Instant Personalized Send" or "Bulk Dispatch" to send interactive confirmations.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-gray-200 text-gray-600 font-bold uppercase text-[10px]">
                      <th className="py-3 px-4">Recipient</th>
                      <th className="py-3 px-4">Reminder Type & Title</th>
                      <th className="py-3 px-4">Sent / Scheduled</th>
                      <th className="py-3 px-4">Status & Gated Action</th>
                      <th className="py-3 px-4">Customer Response</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredReminders.map((rem) => {
                      const isConfirmed = rem.status === "confirmed";
                      const isRescheduled = rem.status === "rescheduled";
                      const isCancelled = rem.status === "cancelled";
                      const isPaid = rem.status === "paid";

                      const statusBadgeClass = isConfirmed
                        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                        : isRescheduled
                        ? "bg-amber-100 text-amber-800 border-amber-300"
                        : isCancelled
                        ? "bg-rose-100 text-rose-800 border-rose-300"
                        : isPaid
                        ? "bg-purple-100 text-purple-800 border-purple-300"
                        : "bg-gray-100 text-gray-700 border-gray-200";

                      return (
                        <tr key={rem.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-gray-900">{rem.contact_name || "Customer"}</div>
                            <div className="text-[11px] text-gray-500 font-mono">+{rem.phone}</div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="font-bold text-gray-800 capitalize block">{rem.title}</span>
                            <span className="text-[10px] text-gray-400 font-medium">
                              Type: {rem.reminder_type.replace(/_/g, " ")} {rem.reference_table ? `(${rem.reference_table} #${rem.reference_id})` : ""}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-[11px] text-gray-600">
                            <div>{new Date(rem.sent_at || rem.created_at).toLocaleDateString("en-IN")}</div>
                            <div className="text-[10px] text-gray-400">
                              {new Date(rem.sent_at || rem.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${statusBadgeClass}`}>
                              {isConfirmed ? <CheckCircle2 size={12} /> : isRescheduled ? <Clock size={12} /> : isCancelled ? <XCircle size={12} /> : <Clock size={12} />}
                              <span className="capitalize">{rem.status}</span>
                            </span>
                            {rem.response_action && (
                              <div className="text-[10px] text-gray-500 mt-1 font-mono">
                                Action: {rem.response_action}
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4 max-w-xs">
                            {rem.response_text ? (
                              <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 text-gray-800 text-[11px]">
                                <span className="font-semibold text-gray-900 block truncate">"{rem.response_text}"</span>
                                <span className="text-[9px] text-gray-400">
                                  Received {new Date(rem.response_received_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-gray-400 italic">Awaiting customer reply...</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* 2-Way Simulator Button */}
                              <button
                                onClick={() => openSimulationModal(rem)}
                                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[11px] font-bold transition flex items-center gap-1"
                                title="Simulate incoming customer click or reply to test CRM auto-updates"
                              >
                                <Wand2 size={11} />
                                <span>Test Reply</span>
                              </button>

                              <button
                                onClick={() => handleResend(rem.id)}
                                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-gray-700 rounded-lg text-[11px] font-bold transition"
                                title="Resend to recipient"
                              >
                                Resend
                              </button>
                              <button
                                onClick={() => handleDelete(rem.id)}
                                className="p-1 text-gray-400 hover:text-rose-600 transition"
                                title="Delete record"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          TAB 3: MULTI-STAGE CADENCE RULES & PERSONA ENGINE
      ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === "cadence" && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Sliders size={18} className="text-amber-600" />
                <span>Multi-Stage Cadence Pipelines & Tone Personas</span>
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Configure automated timing intervals, tone persona profiles, dynamic template variables, and response button actions.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {cadenceFeedback && (
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 animate-fade-in">
                  {cadenceFeedback}
                </span>
              )}
              <button
                onClick={handleSaveCadenceRules}
                disabled={savingCadence}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md transition disabled:opacity-50"
              >
                {savingCadence ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                <span>Save Cadence Rules</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {cadenceRules.map((rule, rIdx) => (
              <div key={rule.category} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-gray-900 text-sm">{rule.label}</h4>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      rule.enabled ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-500"
                    }`}>
                      {rule.enabled ? "Active" : "Disabled"}
                    </span>
                  </div>

                  <button
                    onClick={() => handleToggleCadenceCategory(rIdx)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                      rule.enabled ? "bg-rose-50 text-rose-700 hover:bg-rose-100" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    }`}
                  >
                    {rule.enabled ? "Disable" : "Enable"}
                  </button>
                </div>

                <div className="space-y-3">
                  {rule.stages?.map((stage, sIdx) => (
                    <div key={stage.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-800">{stage.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white text-gray-600 border border-gray-200">
                            {stage.triggerLabel}
                          </span>
                          <input
                            type="time"
                            value={stage.time || "09:00"}
                            onChange={(e) => {
                              const copy = [...cadenceRules];
                              copy[rIdx].stages[sIdx].time = e.target.value;
                              setCadenceRules(copy);
                            }}
                            className="px-2 py-0.5 bg-white border border-gray-200 rounded font-mono text-[11px]"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Message Template</label>
                        <textarea
                          rows={2}
                          value={stage.template}
                          onChange={(e) => {
                            const copy = [...cadenceRules];
                            copy[rIdx].stages[sIdx].template = e.target.value;
                            setCadenceRules(copy);
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-amber-500 resize-none font-sans"
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[10px] font-bold text-gray-400 uppercase">Response Options:</span>
                        {stage.options?.map((opt) => (
                          <span key={opt.id} className="text-[10px] font-semibold bg-white text-gray-700 px-2 py-0.5 rounded border border-gray-200">
                            {opt.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          MODAL 1: INSTANT MULTI-DYNAMIC PERSONALIZED SEND WITH SMARTPHONE SIMULATOR
      ────────────────────────────────────────────────────────────────────────── */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-5xl w-full p-5 sm:p-7 shadow-2xl border border-gray-100 text-xs space-y-5 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-black text-gray-900 text-lg flex items-center gap-2">
                  <Sparkles size={20} className="text-amber-600" />
                  <span>Multi-Dynamic Personalized WhatsApp Sender</span>
                </h3>
                <p className="text-gray-500 text-xs mt-0.5">
                  Select CRM contact, tune the tone persona, insert dynamic tags, and preview live on smartphone simulator.
                </p>
              </div>
              <button
                onClick={() => setShowSendModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-gray-500 font-bold flex items-center justify-center transition"
              >
                ✕
              </button>
            </div>

            {sendSuccess && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center gap-2 animate-fade-in">
                <CheckCircle2 size={18} />
                <span>Interactive Personalized Reminder Dispatched Successfully!</span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Form Controls (7 cols) */}
              <form onSubmit={handleSendNow} className="lg:col-span-7 space-y-4">
                {/* 1. Quick CRM Contact Search */}
                <div className="relative">
                  <label className="block font-bold text-gray-700 uppercase tracking-wide text-[10px] mb-1">
                    🔍 Quick Search & Auto-Fill from CRM Contacts
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={contactSearchQuery}
                      onChange={(e) => setContactSearchQuery(e.target.value)}
                      placeholder="Type name, company, or phone number to auto-fill..."
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 text-xs"
                    />
                    {searchingContacts && (
                      <Loader2 size={14} className="animate-spin text-amber-600 absolute right-3 top-3" />
                    )}
                  </div>

                  {contactSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-2xl shadow-xl z-30 max-h-48 overflow-y-auto divide-y divide-gray-100">
                      {contactSuggestions.map((c) => (
                        <div
                          key={`${c.source}_${c.id}`}
                          onClick={() => handleSelectContact(c)}
                          className="p-2.5 hover:bg-amber-50 cursor-pointer flex items-center justify-between text-xs transition"
                        >
                          <div>
                            <span className="font-bold text-gray-900 block">{c.name}</span>
                            <span className="text-[11px] text-gray-500 font-mono">+{c.phone} {c.company ? `• ${c.company}` : ""}</span>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-gray-600 capitalize">
                            {c.source}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recipient Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-gray-700 uppercase tracking-wide text-[10px] mb-1">
                      Recipient Mobile *
                    </label>
                    <div className="flex items-center gap-1">
                      <span className="px-3 py-2 bg-slate-100 border border-gray-200 rounded-xl font-bold text-gray-600">+91</span>
                      <input
                        type="text"
                        value={sendForm.phone}
                        onChange={(e) => {
                          const p = e.target.value;
                          setSendForm({
                            ...sendForm,
                            phone: p,
                            variables: { ...sendForm.variables, phone: p },
                          });
                        }}
                        placeholder="9876543210"
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 uppercase tracking-wide text-[10px] mb-1">
                      Customer Name
                    </label>
                    <input
                      type="text"
                      value={sendForm.contact_name}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSendForm({
                          ...sendForm,
                          contact_name: val,
                          variables: {
                            ...sendForm.variables,
                            name: val || "Customer",
                            first_name: (val || "Customer").split(" ")[0],
                          },
                        });
                      }}
                      placeholder="Rahul Sharma"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                {/* Category & Persona Tone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-gray-700 uppercase tracking-wide text-[10px] mb-1">
                      Reminder Pipeline
                    </label>
                    <select
                      value={sendForm.reminder_type}
                      onChange={(e) => handleReminderTypeChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 bg-white font-semibold text-gray-800"
                    >
                      {REMINDER_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 uppercase tracking-wide text-[10px] mb-1">
                      Tone Persona Preset
                    </label>
                    <select
                      value={activePersona}
                      onChange={(e) => handlePersonaChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 bg-white font-semibold text-gray-800"
                    >
                      {PERSONA_STYLES.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Dynamic Variable Chips */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-gray-700 uppercase tracking-wide text-[10px]">
                      ⚡ Insert Dynamic Variable Tag (Click to insert):
                    </span>
                    <span className="text-[10px] text-gray-400">Replaced with real values</span>
                  </div>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-1.5 bg-slate-50 border border-gray-200 rounded-xl">
                    {DYNAMIC_VARIABLES.map((v) => (
                      <button
                        key={v.tag}
                        type="button"
                        onClick={() => insertVariableTag(v.tag)}
                        className="px-2 py-0.5 bg-white hover:bg-amber-50 text-amber-900 border border-gray-200 hover:border-amber-300 rounded-lg text-[10px] font-bold transition shadow-2xs flex items-center gap-1"
                        title={`Sample: ${v.sample}`}
                      >
                        <Plus size={9} />
                        <span>{v.tag}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Message Body Textarea */}
                <div>
                  <label className="block font-bold text-gray-700 uppercase tracking-wide text-[10px] mb-1">
                    Message Body (with Dynamic Tags & WhatsApp Markdown) *
                  </label>
                  <textarea
                    ref={messageTextAreaRef}
                    rows={4}
                    value={sendForm.message_text}
                    onChange={(e) => setSendForm({ ...sendForm, message_text: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 resize-none font-sans text-xs leading-relaxed"
                    required
                  />
                </div>

                {/* Interactive Buttons Config */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <span className="text-[10px] font-bold text-gray-700 uppercase tracking-wider block">
                    Interactive Confirmation Buttons (Max 3 for WhatsApp):
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {sendForm.options?.map((opt) => (
                      <div
                        key={opt.id}
                        className="px-3 py-1.5 bg-white text-gray-800 border border-gray-300 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs"
                      >
                        <CheckSquare size={13} className="text-emerald-600" />
                        <span>{opt.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Submit Actions */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowSendModal(false)}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-700 font-bold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={sending || !sendForm.phone}
                    className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold rounded-xl transition shadow-md shadow-amber-600/20 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    <span>Dispatch to WhatsApp</span>
                  </button>
                </div>
              </form>

              {/* Right Column: Live Smartphone Simulator (5 cols) */}
              <div className="lg:col-span-5 flex flex-col items-center">
                <div className="w-full max-w-[310px] bg-slate-900 rounded-[38px] p-3 shadow-2xl border-[5px] border-slate-800 relative">
                  {/* Phone Speaker & Camera Notch */}
                  <div className="w-24 h-4 bg-slate-800 rounded-full mx-auto mb-2 flex items-center justify-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-700" />
                    <span className="w-8 h-1 bg-slate-700 rounded-full" />
                  </div>

                  {/* Smartphone Screen */}
                  <div className="bg-[#0b141a] rounded-[28px] overflow-hidden text-white flex flex-col h-[490px] shadow-inner relative border border-slate-800">
                    {/* WhatsApp Top Header Bar */}
                    <div className="bg-[#202c33] p-3 flex items-center gap-2.5 border-b border-[#2a3942]">
                      <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                        MC
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-xs truncate">Madhura Official</span>
                          <span className="w-3 h-3 rounded-full bg-emerald-500 text-black flex items-center justify-center text-[8px] font-bold">✓</span>
                        </div>
                        <span className="text-[10px] text-emerald-400 block truncate">online</span>
                      </div>
                    </div>

                    {/* Chat Background & Realistic Message Bubble */}
                    <div className="flex-1 p-3 overflow-y-auto space-y-3 bg-[#0b141a] flex flex-col justify-end">
                      <div className="text-center">
                        <span className="text-[9px] bg-[#182229] text-gray-400 px-2.5 py-0.5 rounded-md font-mono">
                          TODAY
                        </span>
                      </div>

                      {/* The WhatsApp Outbound Interactive Message Bubble */}
                      <div className="max-w-[92%] self-end bg-[#005c4b] text-white rounded-2xl rounded-tr-none p-3 shadow-md space-y-2 border border-[#02735e]/40">
                        <p className="text-[11px] leading-relaxed whitespace-pre-wrap font-sans">
                          {interpolateText(sendForm.message_text, sendForm.variables)}
                        </p>

                        <div className="flex items-center justify-end gap-1 text-[9px] text-emerald-200/70 pt-0.5">
                          <span>{new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                          <CheckCheck size={13} className="text-sky-400" />
                        </div>
                      </div>

                      {/* The Clickable Interactive Action Buttons */}
                      <div className="max-w-[92%] self-end w-full space-y-1">
                        {sendForm.options?.map((btn) => (
                          <div
                            key={btn.id}
                            className="w-full py-2 bg-[#202c33] hover:bg-[#2a3942] text-sky-400 text-center rounded-xl text-xs font-bold border border-[#2a3942] shadow-sm transition flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <span>{btn.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Fake WhatsApp Input Box */}
                    <div className="p-2 bg-[#202c33] flex items-center gap-2 border-t border-[#2a3942]">
                      <div className="flex-1 bg-[#2a3942] rounded-full px-3 py-1 text-[11px] text-gray-400">
                        Type a message...
                      </div>
                      <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center text-white">
                        <Send size={11} />
                      </div>
                    </div>
                  </div>
                </div>
                <span className="text-[10px] text-gray-400 mt-2 font-mono">Live Interactive WhatsApp Preview</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          MODAL 2: 2-WAY INTERACTIVE TEST SIMULATOR (Test CRM Auto-Sync Live)
      ────────────────────────────────────────────────────────────────────────── */}
      {showSimModal && simTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 text-xs space-y-4 animate-fade-in">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                  <Wand2 size={18} className="text-amber-600" />
                  <span>Simulate Customer Response (2-Way Gateway)</span>
                </h3>
                <p className="text-gray-500 text-[11px] mt-0.5">
                  Click a button or type text to simulate recipient action and verify automated CRM updates in real time.
                </p>
              </div>
              <button onClick={() => setShowSimModal(false)} className="text-gray-400 hover:text-gray-600 p-1">
                ✕
              </button>
            </div>

            {simFeedback && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
                <CheckCircle2 size={16} />
                <span>{simFeedback}</span>
              </div>
            )}

            {/* Target Details */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-900">{simTarget.contact_name}</span>
                <span className="font-mono text-gray-500 text-[11px]">+{simTarget.phone}</span>
              </div>
              <span className="text-[10px] text-gray-400 block">{simTarget.title}</span>
            </div>

            {/* Simulated Buttons */}
            <div className="space-y-2">
              <span className="font-bold text-gray-700 uppercase text-[10px] block">
                Simulate Tapping Interactive Button:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(() => {
                  let opts = [];
                  try {
                    opts = typeof simTarget.options_payload === "string"
                      ? JSON.parse(simTarget.options_payload)
                      : simTarget.options_payload || [];
                  } catch (_) {}

                  if (!opts || opts.length === 0) {
                    opts = [
                      { id: "btn_confirm", label: "✅ Confirm Visit", action: "confirm_appointment" },
                      { id: "btn_reschedule", label: "🔄 Reschedule", action: "reschedule_appointment" },
                      { id: "btn_cancel", label: "❌ Cancel", action: "cancel_appointment" },
                    ];
                  }

                  return opts.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => handleExecuteSimulation(opt.action, opt.label)}
                      disabled={simulating}
                      className="p-3 bg-slate-900 hover:bg-slate-800 text-emerald-300 font-bold rounded-xl border border-slate-800 shadow-sm transition text-left flex items-center justify-between disabled:opacity-50"
                    >
                      <span>{opt.label}</span>
                      <ArrowRight size={13} className="text-gray-400" />
                    </button>
                  ));
                })()}
              </div>
            </div>

            {/* Or Simulate Custom Text Reply */}
            <div className="pt-2 border-t border-gray-100 space-y-2">
              <span className="font-bold text-gray-700 uppercase text-[10px] block">
                Or Simulate Inbound Text Reply (Fuzzy Match Intent):
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={customSimText}
                  onChange={(e) => setCustomSimText(e.target.value)}
                  placeholder="e.g. 'I will pay tomorrow morning' or 'Please reschedule'"
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 text-xs"
                />
                <button
                  type="button"
                  onClick={() => handleExecuteSimulation("custom_text", customSimText)}
                  disabled={simulating || !customSimText.trim()}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition disabled:opacity-50"
                >
                  {simulating ? <Loader2 size={13} className="animate-spin" /> : "Send"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          MODAL 3: ENGINE SETTINGS & PROMPTS
      ────────────────────────────────────────────────────────────────────────── */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-gray-100 text-xs space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                  <Settings size={18} className="text-amber-600" />
                  <span>Reminder Engine Settings & Confirmation Prompts</span>
                </h3>
                <p className="text-gray-500 text-[11px] mt-0.5">
                  Configure automated cron triggers, hours before dispatch, and dynamic confirmation response messages.
                </p>
              </div>
              <button onClick={() => setShowSettingsModal(false)} className="text-gray-400 hover:text-gray-600 p-1">
                ✕
              </button>
            </div>

            {settingsSaved && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
                <CheckCircle2 size={16} />
                <span>Settings Saved Successfully!</span>
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setSavingSettings(true);
                setSettingsSaved(false);
                try {
                  await axios.put(`${API}/api/wa/reminders/settings`, settings, { headers: headers() });
                  setSettingsSaved(true);
                  setTimeout(() => {
                    setSettingsSaved(false);
                    setShowSettingsModal(false);
                  }, 1400);
                } catch (err) {
                  alert(err.response?.data?.error || "Failed to save settings");
                }
                setSavingSettings(false);
              }}
              className="space-y-4"
            >
              <div className="space-y-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-gray-900 block">Service & Appointment Reminders</span>
                    <span className="text-[11px] text-gray-500">Auto-send 24h before technician visit</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.appointment_reminders_enabled}
                    onChange={(e) => setSettings({ ...settings, appointment_reminders_enabled: e.target.checked })}
                    className="w-4 h-4 text-amber-600 rounded"
                  />
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-gray-900 block">Payment Due Invoice Reminders</span>
                    <span className="text-[11px] text-gray-500">Auto-send 1 day before invoice due date</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.payment_due_reminders_enabled}
                    onChange={(e) => setSettings({ ...settings, payment_due_reminders_enabled: e.target.checked })}
                    className="w-4 h-4 text-amber-600 rounded"
                  />
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-gray-900 block">AMC Contract Expiry Reminders</span>
                    <span className="text-[11px] text-gray-500">Auto-send 7 days before agreement expires</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.amc_renewal_reminders_enabled}
                    onChange={(e) => setSettings({ ...settings, amc_renewal_reminders_enabled: e.target.checked })}
                    className="w-4 h-4 text-amber-600 rounded"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-gray-100 space-y-3">
                <div>
                  <label className="block font-bold text-gray-700 uppercase mb-1">Dynamic Confirmation Receipt Message</label>
                  <textarea
                    rows={2}
                    value={settings.default_confirm_prompt}
                    onChange={(e) => setSettings({ ...settings, default_confirm_prompt: e.target.value })}
                    placeholder="🎉 Thank you {name}! Your appointment has been CONFIRMED. Our executive will arrive on time."
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 resize-none text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 uppercase mb-1">Dynamic Reschedule Prompt Message</label>
                  <textarea
                    rows={2}
                    value={settings.default_reschedule_prompt}
                    onChange={(e) => setSettings({ ...settings, default_reschedule_prompt: e.target.value })}
                    placeholder="We understand! When would you like to reschedule your visit? Please reply with your preferred date/time."
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 resize-none text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-700 font-bold transition"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition shadow-md flex items-center gap-1.5"
                >
                  {savingSettings ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>Save Settings</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
