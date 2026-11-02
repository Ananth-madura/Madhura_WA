import WAWorkspaceGuide from "../components/WAWorkspaceGuide";
import useWADialog from "../hooks/useWADialog";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import React, { useState, useEffect, useRef } from "react";
import {
  Zap, Plus, X, Edit2, Loader2, CheckCircle2, XCircle, Play,
  Clock, ToggleLeft, ToggleRight, FileText, ListChecks, Trash2,
  OctagonMinus, PlayCircle, Cpu, Send, Save, Sparkles, RefreshCw,
  Image, Video, Users, Bot, Layers, Upload, ArrowRight, ShieldCheck,
  Smartphone, BarChart2, Bell, Check, AlertCircle, Info, ExternalLink,
  CreditCard, GitBranch, MessageSquare, HelpCircle, ChevronDown, ChevronRight,
  Calendar, Building2, Briefcase, Tag, Search
} from "lucide-react";
import axios from "axios";
import { API } from "../config/api";
import WhatsAppInteractiveReminders from "../components/WhatsAppInteractiveReminders";
import WAVariablePicker, { evaluateMessagePlaceholders } from "../components/WAVariablePicker";
import WAConditionEditor, { parseConditions } from "../components/WAConditionEditor";
import { useEnterprise } from "../context/EnterpriseContext";
import AutomationDraftPreview from "../components/AutomationDraftPreview";
import AutomationFollowupOptions from "../components/AutomationFollowupOptions";
import AutomationWorkspaceSummary from "../components/AutomationWorkspaceSummary";
import AutomationRuleActivity from "../components/AutomationRuleActivity";
import { automationIssues, isApprovedTemplate } from "../utils/automationDraft";

const TRIGGER_CATEGORIES = [
  {
    category: "🎯 Leads & Sales",
    triggers: [
      { value: "new_lead", label: "New Lead Added", desc: "Triggered when a new lead is added in CRM", emoji: "🎯" },
      { value: "lead_status_changed", label: "Lead Status Changed", desc: "Stage progression or lead qualification", emoji: "📈" },
      { value: "deal_created", label: "Deal Created", desc: "When a new deal enters the pipeline", emoji: "💼" },
      { value: "deal_won", label: "Deal Won", desc: "Congratulate and send onboarding materials", emoji: "🏆" },
      { value: "quotation_created", label: "Quotation / Proposal Created", desc: "Send quotation & proposal details", emoji: "📄" },
      { value: "walkin_created", label: "Walkin Lead Added", desc: "Shop/office visit thank you & welcome", emoji: "🚶" },
      { value: "lead_followup", label: "Lead Follow-Up Nudge", desc: "Nudge inactive leads after inactivity", emoji: "⏳" },
      { value: "abandoned_cart", label: "Pending Quotation Recovery", desc: "Recover pending quotes with special offer", emoji: "🛒" },
    ],
  },
  {
    category: "🧾 Billing & Invoices",
    triggers: [
      { value: "invoice_created", label: "Invoice Created", desc: "Send invoice PDF & payment link via WhatsApp", emoji: "🧾" },
      { value: "invoice_due", label: "Invoice Due Soon", desc: "Upcoming payment reminder 1-3 days prior", emoji: "⏰" },
      { value: "invoice_overdue", label: "Invoice Overdue Notice", desc: "Urgent recovery notice for unpaid invoices", emoji: "⚠️" },
      { value: "payment_received", label: "Payment Received", desc: "Instant payment receipt acknowledgement", emoji: "✅" },
      { value: "payment_due", label: "Payment Due Reminder", desc: "Automated payment reminder before due date", emoji: "💰" },
      { value: "amc_created", label: "AMC Contract Created", desc: "Send maintenance agreement confirmation", emoji: "🛡️" },
    ],
  },
  {
    category: "📅 Appointments & Support",
    triggers: [
      { value: "appointment_booked", label: "Appointment Booked", desc: "Booking confirmation with date/time", emoji: "📅" },
      { value: "appointment_reminder", label: "Appointment Reminder", desc: "Reminder before scheduled visit", emoji: "🔔" },
      { value: "service_visit_scheduled", label: "Technician Dispatch", desc: "Technician appointment confirmation", emoji: "🛠️" },
      { value: "ticket_created", label: "Support Ticket Raised", desc: "Acknowledgement with ticket ID", emoji: "🎫" },
      { value: "ticket_closed", label: "Service Completed", desc: "Post-resolution feedback request", emoji: "⭐" },
      { value: "birthday", label: "Birthday Greeting", desc: "Customer birthday wishes & special discount", emoji: "🎂" },
    ],
  },
  {
    category: "💬 Inbound & General",
    triggers: [
      { value: "welcome_message", label: "Welcome Message", desc: "First inbound message / contact added", emoji: "👋" },
      { value: "incoming_message", label: "Keyword / Inbound Match", desc: "Triggered on matching customer keywords", emoji: "💬" },
      { value: "custom", label: "Custom Background Trigger", desc: "Define custom event background trigger", emoji: "⚡" },
    ],
  },
];

const TRIGGER_TYPES = TRIGGER_CATEGORIES.flatMap((c) => c.triggers);

const PRESET_MESSAGES = {
  welcome_message: "Hello {name}! Welcome to {company}. Thank you for connecting with us. How can we help you today?",
  new_lead: "Hi {name}! 👋 Thank you for your inquiry regarding {service}. Our team will contact you shortly!",
  lead_status_changed: "Hi {name}, your inquiry status has been updated to *{lead.status}*. Let us know if you need assistance!",
  deal_created: "Hello {name}, your deal proposal for {service} is active. Our specialist will guide you through the next steps.",
  deal_won: "🎉 Congratulations {name}! Welcome onboard with {company}. Your onboarding package is ready.",
  invoice_created: "Hello {name}, your invoice *{invoice_no}* for amount *{amount}* has been generated. Due Date: {due_date}. Thank you for choosing {company}!",
  invoice_due: "Hi {name}, gentle reminder that invoice *{invoice_no}* ({amount}) is due on *{due_date}*. Please tap below to pay securely.",
  invoice_overdue: "⚠️ *Urgent Notice:* Dear {name}, invoice *{invoice_no}* ({amount}) is past its due date ({due_date}). Please settle immediately to avoid interruption.",
  quotation_created: "Hello {name}, your quotation proposal *{quotation_no}* for *{service}* (Total: {amount}) has been generated. Let us know if you have any questions!",
  amc_created: "🛡️ *AMC Contract Active:* Dear {name}, your maintenance contract *{amc_contract_no}* for {service} is active until {due_date}. Thank you for trusting {company}!",
  payment_received: "Dear {name}, thank you! We received your payment of *{amount}* for invoice *{invoice_no}* on {date}.",
  payment_due: "Hi {name}, gentle reminder that payment for invoice *{invoice_no}* ({amount}) is due on *{due_date}*. Please reply if you need invoice copy.",
  appointment_booked: "📅 *Appointment Confirmed:* Hello {name}, your consultation is booked for *{appointment.date}*. Reply CONFIRM to verify.",
  service_visit_scheduled: "📅 *Service Visit Confirmed:* Hi {name}, our technician has been scheduled for your *{service}* on *{service_date}*. Thank you!",
  walkin_created: "Hi {name}! Thank you for visiting {company} today regarding {service}. It was a pleasure meeting you. Feel free to message us anytime!",
  ticket_created: "Hello {name}, your support ticket regarding {service} has been logged. Our helpdesk team is reviewing it.",
  ticket_closed: "Hi {name}, your service request regarding {service} has been resolved. We would love your feedback!",
  birthday: "🎉 Happy Birthday {name}! 🎂 Team {company} wishes you a wonderful year. Enjoy 15% OFF on your next service!",
  appointment_reminder: "Hi {name}, gentle reminder for your upcoming appointment with {company} on {date}. Reply CONFIRM to confirm.",
  lead_followup: "Hi {name}, following up regarding your interest in {service}. Let us know if you'd like a quick demo or technical call!",
  abandoned_cart: "Hi {name}, you have a pending quotation for {service}! Complete your inquiry today for priority scheduling.",
  incoming_message: "Hello {name}! Thank you for reaching out to {company}. How may we assist you today?",
  custom: "Hello {name}! Thank you for choosing {company}.",
};

const ACTION_TYPES = [
  { type: "send_message", label: "Send WhatsApp Message / Template", icon: MessageSquare, desc: "Deliver dynamic text, media, or Meta approved template" },
  { type: "send_bill", label: "Send Invoice / Quotation PDF", icon: FileText, desc: "Retrieve CRM invoice or quotation and send with pay button" },
  { type: "send_receipt", label: "Send Payment Receipt", icon: CheckCircle2, desc: "Send verified payment receipt with timestamp and invoice ID" },
  { type: "send_payment_link", label: "Send Payment Link", icon: CreditCard, desc: "Send verified payment URL for instant online settlement" },
  { type: "start_flow", label: "Start Conversational Flow Bot", icon: Bot, desc: "Launch an active visual conversational flow" },
  { type: "ask_question", label: "Ask Customer Question (Checkpoint)", icon: HelpCircle, desc: "Collect text, number, date or button choice and wait for response" },
  { type: "wait_delay", label: "Wait / Delay Duration", icon: Clock, desc: "Durable delay before advancing to the next action step" },
  { type: "update_crm", label: "Update CRM Record", icon: Tag, desc: "Update lead status, stage, custom field or contact notes" },
  { type: "assign_employee", label: "Assign Employee / Agent", icon: Users, desc: "Route contact or enquiry to a specific team member" },
];

export default function WhatsAppAutomations() {
  const { activeTenant } = useEnterprise();
  return <AutomationWorkspace key={activeTenant?.id || "none"} />;
}

function AutomationWorkspace() {
  const location = useLocation();
  const navigate = useNavigate();
  const editRouteId = location.pathname.match(/\/automations\/(\d+)\/edit\/?$/)?.[1];
  const isEditorPage = Boolean(editRouteId) || location.pathname.replace(/\/$/, "").endsWith("/automations/create");
  const [searchParams] = useSearchParams();

  // Core Data State
  const [automations, setAutomations] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [senders, setSenders] = useState([]);
  const [groups, setGroups] = useState([]);
  const [flows, setFlows] = useState([]);
  const [logs, setLogs] = useState([]);
  const [checkpoints, setCheckpoints] = useState([]);
  const [starters, setStarters] = useState([]);
  const [billingSummary, setBillingSummary] = useState({ invoices: [], totalInvoices: 0, unpaidCount: 0 });
  const [stats, setStats] = useState({ totalRules: 0, activeRules: 0, totalRuns: 0, sentCount: 0, failedCount: 0 });
  const [loading, setLoading] = useState(true);
  const [pageNotice, setPageNotice] = useState(null);

  // Active Command Center Tab:
  // "rules" | "pipeline" | "reminders" | "checkpoints" | "billing" | "welcome" | "starters" | "logs"
  const [activeTab, setActiveTab] = useState("rules");

  // Filter & Search State
  const [ruleSearch, setRuleSearch] = useState("");
  const [ruleStatus, setRuleStatus] = useState("all");
  const [ruleCategory, setRuleCategory] = useState("all");
  const [logStatus, setLogStatus] = useState("");
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [cancellingRun, setCancellingRun] = useState(null);

  // Editor Modal State
  const [showModal, setShowModal] = useState(false);
  const [savingRule, setSavingRule] = useState(false);
  const [ruleError, setRuleError] = useState("");
  const [editAutomation, setEditAutomation] = useState(null);
  const [editorLoading, setEditorLoading] = useState(false);
  const editorRequest = useRef(0);
  const automationDialog = useWADialog(showModal && !isEditorPage, () => setShowModal(false), savingRule);

  // Toggling & Seeding
  const [toggling, setToggling] = useState(null);
  const [bulkToggling, setBulkToggling] = useState(false);
  const [seeding, setSeeding] = useState(false);

  // Test Modal
  const [testModal, setTestModal] = useState(null);
  const [testPhone, setTestPhone] = useState("");
  const [testName, setTestName] = useState("Rahul Sharma");
  const [testingTrigger, setTestingTrigger] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Welcome Auto-Reply Settings
  const [welcomeSettings, setWelcomeSettings] = useState({
    enabled: 0,
    welcome_type: "text",
    welcome_text: "Hello {name}! Welcome to {company}.",
    welcome_buttons: [],
    welcome_footer: "",
    template_id: null,
    cooldown_hours: 24,
    working_hours_only: 0,
    start_time: "09:00",
    end_time: "21:00",
  });
  const [savingWelcome, setSavingWelcome] = useState(false);
  const [testingWelcome, setTestingWelcome] = useState(false);
  const [welcomeNotice, setWelcomeNotice] = useState(null);
  const [welcomeTestPhone, setWelcomeTestPhone] = useState("");

  // Editor Form State
  const [form, setForm] = useState({
    sender_id: "",
    name: "",
    trigger_type: "welcome_message",
    category: "general",
    mode: "single", // "single" | "pipeline"
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
    actions: [],
    schedule: {
      reminder_type: "relative",
      delay_value: 1,
      delay_unit: "days",
      cancel_on_event: "invoice_paid",
      business_hours_only: false,
      max_attempts: 3,
    },
  });

  const [conditions, setConditions] = useState({ match: "all", rules: [] });
  const [menuOptions, setMenuOptions] = useState([]);
  const [draftIssues, setDraftIssues] = useState([]);

  // Live issue validation
  useEffect(() => {
    const issues = automationIssues(form, conditions, menuOptions, templates, flows, senders);
    setDraftIssues(issues);
  }, [form, conditions, menuOptions, templates, flows, senders]);

  const headers = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchData = async () => {
    setLoading(true);
    setPageNotice(null);
    try {
      const [aRes, tRes, lRes, wRes, sRes, cRes, bRes, strRes] = await Promise.all([
        axios.get(`${API}/api/wa/automations`, { headers: headers() }),
        axios.get(`${API}/api/wa/automations/references`, { headers: headers() }),
        axios.get(`${API}/api/wa/automations/logs/recent?limit=50`, { headers: headers() }),
        axios.get(`${API}/api/wa/automations/welcome-settings`, { headers: headers() }).catch(() => ({ data: null })),
        axios.get(`${API}/api/wa/automations/stats`, { headers: headers() }).catch(() => ({ data: null })),
        axios.get(`${API}/api/wa/automations/checkpoints`, { headers: headers() }).catch(() => ({ data: [] })),
        axios.get(`${API}/api/wa/automations/billing/summary`, { headers: headers() }).catch(() => ({ data: { invoices: [] } })),
        axios.get(`${API}/api/wa/automations/starters`, { headers: headers() }).catch(() => ({ data: [] })),
      ]);

      setAutomations(aRes.data || []);
      setTemplates(tRes.data.templates || []);
      setFlows(tRes.data.flows || []);
      setGroups(tRes.data.groups || []);
      setSenders(tRes.data.senders || []);
      setLogs(lRes.data || []);
      if (wRes.data) setWelcomeSettings(wRes.data);
      if (sRes.data) setStats(sRes.data);
      if (cRes.data) setCheckpoints(cRes.data);
      if (bRes.data) setBillingSummary(bRes.data);
      if (strRes.data) setStarters(strRes.data);
    } catch (err) {
      console.error("Error fetching automations:", err);
      setPageNotice({
        type: "error",
        message: err.response?.data?.message || err.response?.data?.error || "Automation Command Center data could not be loaded.",
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const anyActive = automations.some((a) => a.is_active === 1);

  const handleBulkToggle = async () => {
    const action = anyActive ? "stop-all" : "resume-all";
    if (anyActive && !window.confirm("Pause all background automation rules right now?")) return;
    setBulkToggling(true);
    try {
      await axios.post(`${API}/api/wa/automations/${action}`, {}, { headers: headers() });
      await fetchData();
    } catch (err) {
      setPageNotice({ type: "error", message: err.response?.data?.message || err.response?.data?.error || "Failed to update rules." });
    }
    setBulkToggling(false);
  };

  const handleSeedPrebuilt = async () => {
    setSeeding(true);
    try {
      const { data } = await axios.post(`${API}/api/wa/automations/seed`, {}, { headers: headers() });
      await fetchData();
      setPageNotice({ type: "success", message: `${data.count ?? 0} industry automation blueprints installed successfully.` });
    } catch (err) {
      setPageNotice({ type: "error", message: err.response?.data?.error || "Failed to install blueprints." });
    }
    setSeeding(false);
  };

  const openCreate = () => {
    editorRequest.current++;
    setRuleError("");
    setConditions({ match: "all", rules: [] });
    setEditAutomation(null);
    setForm({
      sender_id: senders.filter((s) => s.status === "connected").length === 1 ? senders.find((s) => s.status === "connected").id : "",
      name: "",
      trigger_type: "welcome_message",
      category: "general",
      mode: "single",
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
      actions: [],
      schedule: {
        reminder_type: "relative",
        delay_value: 1,
        delay_unit: "days",
        cancel_on_event: "invoice_paid",
        business_hours_only: false,
        max_attempts: 3,
      },
    });
    setMenuOptions([]);
    setShowModal(true);
  };

  const openEdit = async (a) => {
    if (!isEditorPage) {
      navigate(`/whatsapp/automations/${a.id}/edit`);
      return;
    }
    const ticket = ++editorRequest.current;
    setEditAutomation(null);
    setEditorLoading(true);
    try {
      a = (await axios.get(`${API}/api/wa/automations/${a.id}`, { headers: headers() })).data;
      if (ticket !== editorRequest.current) return;
    } catch (error) {
      if (ticket !== editorRequest.current) return;
      setRuleError(error.response?.data?.error || "Could not load this rule.");
      setEditorLoading(false);
      return;
    }
    setEditorLoading(false);
    setRuleError("");
    setConditions(parseConditions(a.conditions));
    setEditAutomation(a);

    const hasSeq = Boolean(a.followup_message_text || a.followup_media_url || a.followup_template_id);
    const msgKind = a.template_id ? "template" : a.media_type && a.media_url ? "media" : "text";
    const followKind = a.followup_template_id ? "template" : a.followup_media_type && a.followup_media_url ? "media" : "text";

    let loadedActions = [];
    try {
      loadedActions = a.actions_json ? JSON.parse(a.actions_json) : [];
    } catch (_) {}

    let loadedSchedule = {
      reminder_type: "relative",
      delay_value: 1,
      delay_unit: "days",
      cancel_on_event: "invoice_paid",
      business_hours_only: false,
      max_attempts: 3,
    };
    try {
      if (a.schedule_json) loadedSchedule = { ...loadedSchedule, ...JSON.parse(a.schedule_json) };
    } catch (_) {}

    setForm({
      sender_id: a.sender_id || "",
      name: a.name || "",
      trigger_type: a.trigger_type || "welcome_message",
      category: a.category || "general",
      mode: loadedActions.length > 0 ? "pipeline" : "single",
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
      is_active: a.is_active ?? 1,
      actions: loadedActions,
      schedule: loadedSchedule,
    });

    setMenuOptions(a.options || []);
    setShowModal(true);
  };

  useEffect(() => {
    if (editRouteId) openEdit({ id: editRouteId });
    else if (isEditorPage) openCreate();
    else setShowModal(false);
  }, [location.pathname]);

  const closeEditor = () => {
    editorRequest.current++;
    setShowModal(false);
    if (isEditorPage) navigate("/whatsapp/automations", { replace: true });
  };

  const handleSave = async () => {
    if (savingRule || editorLoading) return;
    setRuleError("");
    if (draftIssues.length) {
      setRuleError(draftIssues.join(" "));
      return;
    }
    setSavingRule(true);

    const payload = {
      sender_id: form.sender_id || null,
      name: form.name.trim(),
      trigger_type: form.trigger_type,
      category: form.category || "general",
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
      conditions,
      is_active: form.is_active ? 1 : 0,
      options: menuOptions,
      actions_json: form.mode === "pipeline" && form.actions.length > 0 ? JSON.stringify(form.actions) : null,
      schedule_json: form.schedule ? JSON.stringify(form.schedule) : null,
    };

    try {
      if (editAutomation) {
        await axios.put(`${API}/api/wa/automations/${editAutomation.id}`, payload, { headers: headers() });
      } else {
        await axios.post(`${API}/api/wa/automations`, payload, { headers: headers() });
      }
      await fetchData();
      closeEditor();
      setPageNotice({ type: "success", message: `Automation rule "${form.name}" saved successfully!` });
    } catch (err) {
      setRuleError(err.response?.data?.error || err.message || "Failed to save rule.");
    }
    setSavingRule(false);
  };

  const handleToggle = async (a) => {
    setToggling(a.id);
    try {
      await axios.post(`${API}/api/wa/automations/${a.id}/toggle`, {}, { headers: headers() });
      await fetchData();
    } catch (err) {
      setPageNotice({ type: "error", message: err.response?.data?.error || "Could not toggle automation." });
    }
    setToggling(null);
  };

  const handleDelete = async (a) => {
    if (!window.confirm(`Delete automation rule "${a.name}"? This cannot be undone.`)) return;
    try {
      await axios.delete(`${API}/api/wa/automations/${a.id}`, { headers: headers() });
      await fetchData();
      setPageNotice({ type: "success", message: `Rule "${a.name}" deleted.` });
    } catch (err) {
      setPageNotice({ type: "error", message: err.response?.data?.error || "Could not delete automation." });
    }
  };

  const handleCancelRun = async (log) => {
    if (!window.confirm(`Cancel scheduled dispatch for ${log.phone}?`)) return;
    setCancellingRun(log.id);
    try {
      await axios.post(`${API}/api/wa/automations/${log.automation_id}/executions/${log.id}/cancel`, {}, { headers: headers() });
      await fetchData();
      setPageNotice({ type: "success", message: `Scheduled dispatch #${log.id} cancelled.` });
    } catch (err) {
      setPageNotice({ type: "error", message: err.response?.data?.error || "Could not cancel execution." });
    }
    setCancellingRun(null);
  };

  const handleCancelCheckpoint = async (chk) => {
    if (!window.confirm(`Cancel waiting checkpoint for ${chk.phone}?`)) return;
    try {
      await axios.post(`${API}/api/wa/automations/checkpoints/${chk.id}/cancel`, {}, { headers: headers() });
      await fetchData();
      setPageNotice({ type: "success", message: `Checkpoint for ${chk.phone} cancelled.` });
    } catch (err) {
      setPageNotice({ type: "error", message: err.response?.data?.error || "Could not cancel checkpoint." });
    }
  };

  const adoptStarter = (starter) => {
    setConditions(parseConditions(starter.conditions || { match: "all", rules: [] }));
    let acts = [];
    try {
      acts = starter.actions_json ? JSON.parse(starter.actions_json) : [];
    } catch (_) {}
    let sched = {
      reminder_type: "relative",
      delay_value: 1,
      delay_unit: "days",
      cancel_on_event: "invoice_paid",
      business_hours_only: false,
      max_attempts: 3,
    };
    try {
      if (starter.schedule_json) sched = { ...sched, ...JSON.parse(starter.schedule_json) };
    } catch (_) {}

    setForm({
      sender_id: senders.find((s) => s.status === "connected")?.id || "",
      name: starter.name,
      trigger_type: starter.trigger_type,
      category: starter.category || "general",
      mode: acts.length > 0 ? "pipeline" : "single",
      msg_kind: "text",
      template_id: "",
      message_text: starter.message_text || "",
      media_type: "image",
      media_url: "",
      enable_sequence: Boolean(starter.followup_message_text),
      sequence_delay_seconds: starter.sequence_delay_seconds || 7,
      followup_msg_kind: "text",
      followup_message_text: starter.followup_message_text || "",
      followup_media_type: "image",
      followup_media_url: "",
      followup_template_id: "",
      flow_id: "",
      group_id: "",
      delay_minutes: starter.delay_minutes || 0,
      is_active: 0,
      actions: acts,
      schedule: sched,
    });
    setMenuOptions([]);
    setShowModal(true);
  };

  const filteredAutomations = automations.filter((a) => {
    if (ruleStatus === "enabled" && a.is_active !== 1) return false;
    if (ruleStatus === "paused" && a.is_active !== 0) return false;
    if (ruleCategory !== "all" && a.category !== ruleCategory) return false;
    if (ruleSearch.trim()) {
      const q = ruleSearch.toLowerCase();
      return (
        a.name?.toLowerCase().includes(q) ||
        a.trigger_type?.toLowerCase().includes(q) ||
        a.message_text?.toLowerCase().includes(q) ||
        a.template_name?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* ── TOP HEADER: Command Center Overview ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <Zap className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 font-[var(--font-display)]">
                WhatsApp Automation Command Center
              </h1>
              <p className="text-xs sm:text-sm text-slate-600">
                Unified orchestration for Event Automations, Workflow Pipelines, Flow Bots, Smart Reminders & Billing.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-slate-800 transition"
          >
            <Plus className="w-4 h-4" /> New Automation
          </button>

          <button
            type="button"
            onClick={handleBulkToggle}
            disabled={bulkToggling || automations.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50 transition"
          >
            {anyActive ? <ToggleRight className="w-4 h-4 text-emerald-600" /> : <ToggleLeft className="w-4 h-4 text-slate-400" />}
            <span>{anyActive ? "Pause All" : "Resume All"}</span>
          </button>

          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="rounded-lg border border-slate-300 bg-white p-2 text-slate-600 shadow-xs hover:bg-slate-50 transition"
            title="Refresh workspace data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {pageNotice && (
        <div
          role="alert"
          className={`flex items-center justify-between rounded-lg p-3 text-sm ${
            pageNotice.type === "error" ? "bg-rose-50 text-rose-800 border border-rose-200" : "bg-emerald-50 text-emerald-800 border border-emerald-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {pageNotice.type === "error" ? <AlertCircle className="w-4 h-4 text-rose-600" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
            <span>{pageNotice.message}</span>
          </div>
          <button type="button" onClick={() => setPageNotice(null)} className="text-xs opacity-75 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── METRIC STAT CARDS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total Rules</span>
          <p className="mt-1 text-2xl font-bold text-slate-900">{stats.totalRules || automations.length}</p>
          <span className="text-[10px] text-slate-500">{stats.activeRules || 0} active now</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Executions</span>
          <p className="mt-1 text-2xl font-bold text-slate-900">{stats.totalRuns || 0}</p>
          <span className="text-[10px] text-emerald-600 font-medium">{stats.sentCount || 0} delivered</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Scheduled / Waiting</span>
          <p className="mt-1 text-2xl font-bold text-amber-600">{stats.scheduledCount || 0}</p>
          <span className="text-[10px] text-slate-500">Due queue</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Checkpoints</span>
          <p className="mt-1 text-2xl font-bold text-blue-600">{checkpoints.filter((c) => c.status === "waiting").length}</p>
          <span className="text-[10px] text-slate-500">Pending answers</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Unpaid Invoices</span>
          <p className="mt-1 text-2xl font-bold text-rose-600">{billingSummary.unpaidCount || 0}</p>
          <span className="text-[10px] text-slate-500">Auto-recovery</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Delivery Health</span>
          <p className="mt-1 text-2xl font-bold text-emerald-600">
            {stats.totalRuns ? `${Math.round(((stats.sentCount || 0) / (stats.totalRuns || 1)) * 100)}%` : "100%"}
          </p>
          <span className="text-[10px] text-slate-500">{stats.failedCount || 0} failures</span>
        </div>
      </div>

      {/* ── COMMAND CENTER NAVIGATION TABS ── */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-200 pb-2.5 text-xs sm:text-sm font-medium">
        {[
          { id: "rules", label: "Event Automations", icon: Zap, count: automations.length },
          { id: "pipeline", label: "Workflow Pipelines", icon: GitBranch, count: automations.filter((a) => a.actions_json).length },
          { id: "reminders", label: "Smart Reminders", icon: Bell },
          { id: "checkpoints", label: "Conversation Checkpoints", icon: HelpCircle, count: checkpoints.filter((c) => c.status === "waiting").length },
          { id: "billing", label: "Billing & Invoices", icon: CreditCard, count: billingSummary.unpaidCount },
          { id: "welcome", label: "Welcome & Onboarding", icon: Users },
          { id: "starters", label: "Industry Blueprints", icon: Building2, count: starters.length || 10 },
          { id: "logs", label: "Execution Diagnostics", icon: ListChecks, count: logs.length },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 whitespace-nowrap transition ${
                isActive ? "bg-slate-900 text-white shadow-xs font-semibold" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                    isActive ? "bg-slate-800 text-amber-300" : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 1: EVENT AUTOMATIONS                                      */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === "rules" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search rules by name, event, template..."
                  value={ruleSearch}
                  onChange={(e) => setRuleSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-800 shadow-xs focus:border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-800"
                />
              </div>

              <select
                value={ruleStatus}
                onChange={(e) => setRuleStatus(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 shadow-xs focus:border-slate-800 focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="enabled">Active Only</option>
                <option value="paused">Paused Only</option>
              </select>

              <select
                value={ruleCategory}
                onChange={(e) => setRuleCategory(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 shadow-xs focus:border-slate-800 focus:outline-none"
              >
                <option value="all">All Categories</option>
                <option value="sales">Sales & Leads</option>
                <option value="billing">Billing & Invoices</option>
                <option value="support">Support & Appointments</option>
                <option value="onboarding">Onboarding</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSeedPrebuilt}
                disabled={seeding}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 transition"
              >
                <Building2 className="w-3.5 h-3.5 text-slate-600" />
                <span>{seeding ? "Installing…" : "Install All Industry Blueprints"}</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : filteredAutomations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <Zap className="w-6 h-6 text-slate-400" />
              </div>
              <h3 className="text-base font-semibold text-slate-800">No automation rules found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Create a customized trigger rule or install industry starter blueprints to get started.
              </p>
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={openCreate}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800"
                >
                  Create Rule
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("starters")}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50"
                >
                  Browse Blueprints
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAutomations.map((a) => {
                const isEnabled = a.is_active === 1;
                const isTogglingThis = toggling === a.id;
                const trig = TRIGGER_TYPES.find((t) => t.value === a.trigger_type);
                const hasPipeline = Boolean(a.actions_json);

                return (
                  <div
                    key={a.id}
                    className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-xs hover:border-slate-300 transition"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{trig?.emoji || "⚡"}</span>
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              {a.trigger_label || a.trigger_type}
                            </span>
                            <h3 className="text-sm font-semibold text-slate-900 line-clamp-1">{a.name}</h3>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleToggle(a)}
                          disabled={isTogglingThis}
                          className="text-slate-400 hover:text-slate-700 transition"
                          title={isEnabled ? "Click to pause" : "Click to activate"}
                        >
                          {isEnabled ? (
                            <ToggleRight className="w-6 h-6 text-emerald-600" />
                          ) : (
                            <ToggleLeft className="w-6 h-6 text-slate-400" />
                          )}
                        </button>
                      </div>

                      <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                        {hasPipeline ? (
                          <div className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                            <GitBranch className="w-3.5 h-3.5" /> Multi-Step Workflow Pipeline
                          </div>
                        ) : (
                          <p className="line-clamp-2 text-slate-600 italic">
                            "{a.template_name ? `Template: ${a.template_name}` : a.message_text || "No message content"}"
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-500">
                          {a.delay_minutes > 0 && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {a.delay_minutes}m delay
                            </span>
                          )}
                          {a.sender_phone && (
                            <span className="flex items-center gap-1">
                              <Smartphone className="w-3 h-3" /> {a.sender_phone}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Play className="w-3 h-3 text-slate-400" /> {a.run_count || 0} runs
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setTestModal(a);
                            setTestResult(null);
                          }}
                          className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition"
                        >
                          Simulate
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(a)}
                          className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition"
                        >
                          Edit
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDelete(a)}
                        className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                        title="Delete rule"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 2: WORKFLOW PIPELINES                                     */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === "pipeline" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-200">
            <div>
              <h2 className="text-base font-bold text-slate-900">Multi-Step Automation Pipelines</h2>
              <p className="text-xs text-slate-600">
                Connect triggers, condition gates, document delivery, Flow Bots, customer questioning, and CRM updates in a single durable pipeline.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                openCreate();
                setForm((f) => ({ ...f, mode: "pipeline", name: "Custom Workflow Pipeline" }));
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800"
            >
              <Plus className="w-4 h-4" /> Create Workflow Pipeline
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {automations.filter((a) => a.actions_json).length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
                <GitBranch className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <h3 className="text-sm font-semibold text-slate-800">No multi-step pipelines created yet</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Multi-step pipelines allow chaining templates, bills, Flow Bots, question checkpoints, and CRM actions.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    openCreate();
                    setForm((f) => ({ ...f, mode: "pipeline", name: "Custom Workflow Pipeline" }));
                  }}
                  className="mt-3 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-xs"
                >
                  Build First Pipeline
                </button>
              </div>
            ) : (
              automations
                .filter((a) => a.actions_json)
                .map((a) => {
                  let acts = [];
                  try {
                    acts = JSON.parse(a.actions_json);
                  } catch (_) {}

                  return (
                    <div key={a.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="rounded-lg bg-slate-100 p-2 text-slate-800 font-bold text-xs">
                            {a.trigger_label}
                          </span>
                          <div>
                            <h3 className="text-sm font-bold text-slate-900">{a.name}</h3>
                            <span className="text-[11px] text-slate-500">{acts.length} pipeline step(s)</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(a)}
                            className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Edit Pipeline
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggle(a)}
                            className="text-xs font-medium text-slate-600"
                          >
                            {a.is_active ? (
                              <span className="text-emerald-600 font-semibold">Active</span>
                            ) : (
                              <span className="text-slate-400 font-semibold">Paused</span>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Visual Flow Steps */}
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                          <span className="font-semibold text-slate-800">Trigger:</span>{" "}
                          <span className="text-slate-600">{a.trigger_label}</span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />

                        {acts.map((act, idx) => (
                          <React.Fragment key={idx}>
                            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-2xs">
                              <span className="font-bold text-slate-900">Step {idx + 1}:</span>{" "}
                              <span className="text-slate-700">{act.title || act.type}</span>
                            </div>
                            {idx < acts.length - 1 && <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 3: SMART REMINDERS                                        */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === "reminders" && <WhatsAppInteractiveReminders />}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 4: CONVERSATION CHECKPOINTS                               */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === "checkpoints" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
            <div>
              <h2 className="text-base font-bold text-slate-900">Durable Conversational Checkpoints</h2>
              <p className="text-xs text-slate-600">
                In-flight customer questions awaiting answers. Persisted across server restarts and correlated with incoming WhatsApp replies.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchData}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh Checkpoints
            </button>
          </div>

          {checkpoints.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-xs text-slate-500">
              No conversational checkpoints waiting. When a rule executes "Ask Customer Question", pending responses appear here.
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-700">
                  <tr>
                    <th className="p-3">Customer Phone</th>
                    <th className="p-3">Automation / Step</th>
                    <th className="p-3">Expected Type</th>
                    <th className="p-3">Question Context</th>
                    <th className="p-3">Collected Answers</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {checkpoints.map((chk) => (
                    <tr key={chk.id} className="hover:bg-slate-50/50">
                      <td className="p-3 font-mono font-medium">+{chk.phone}</td>
                      <td className="p-3">
                        <span className="font-semibold text-slate-900">{chk.automation_name || `Rule #${chk.automation_id}`}</span>
                        <span className="block text-[10px] text-slate-500">Step {chk.current_step}</span>
                      </td>
                      <td className="p-3">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 uppercase">
                          {chk.expected_type || "text"}
                        </span>
                      </td>
                      <td className="p-3 max-w-[220px] truncate" title={chk.question_context?.question_text}>
                        {chk.question_context?.question_text || "—"}
                      </td>
                      <td className="p-3">
                        {chk.collected_answers && Object.keys(chk.collected_answers).length > 0 ? (
                          <span className="text-slate-600 font-mono text-[11px]">
                            {JSON.stringify(chk.collected_answers)}
                          </span>
                        ) : (
                          <span className="text-slate-400">None yet</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            chk.status === "waiting"
                              ? "bg-amber-100 text-amber-800"
                              : chk.status === "resumed" || chk.status === "completed"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {chk.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {chk.status === "waiting" && (
                          <button
                            type="button"
                            onClick={() => handleCancelCheckpoint(chk)}
                            className="rounded px-2 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-50"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 5: BILLING & INVOICES                                     */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === "billing" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-200">
            <div>
              <h2 className="text-base font-bold text-slate-900">CRM Billing & Invoice Automations</h2>
              <p className="text-xs text-slate-600">
                Automate invoice PDF delivery, payment links, verified receipts, and overdue balance recovery via WhatsApp.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                openCreate();
                setForm((f) => ({
                  ...f,
                  name: "Instant Invoice PDF Notice & Payment Link",
                  trigger_type: "invoice_created",
                  category: "billing",
                  message_text: PRESET_MESSAGES.invoice_created,
                }));
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800"
            >
              <Plus className="w-4 h-4" /> New Billing Automation
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Invoice PDF Delivery</span>
              <p className="mt-1 text-sm font-semibold text-slate-900">Send Invoice on Generation</p>
              <p className="mt-1 text-xs text-slate-600">
                Automatically dispatches generated CRM invoices to clients with interactive payment buttons.
              </p>
              <button
                type="button"
                onClick={() => {
                  const starter = starters.find((s) => s.trigger_type === "invoice_created");
                  if (starter) adoptStarter(starter);
                }}
                className="mt-3 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Configure Action
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Payment Due Reminder</span>
              <p className="mt-1 text-sm font-semibold text-slate-900">1-3 Days Prior Due Date</p>
              <p className="mt-1 text-xs text-slate-600">
                Sends automated payment reminder with direct payment link; automatically cancels if invoice is paid.
              </p>
              <button
                type="button"
                onClick={() => {
                  const starter = starters.find((s) => s.trigger_type === "payment_due");
                  if (starter) adoptStarter(starter);
                }}
                className="mt-3 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Configure Action
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Verified Settlement</span>
              <p className="mt-1 text-sm font-semibold text-slate-900">Payment Receipt Acknowledgement</p>
              <p className="mt-1 text-xs text-slate-600">
                Instantly issues an official verified receipt via WhatsApp once webhook or accounts confirms payment.
              </p>
              <button
                type="button"
                onClick={() => {
                  const starter = starters.find((s) => s.trigger_type === "payment_received");
                  if (starter) adoptStarter(starter);
                }}
                className="mt-3 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Configure Action
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Tracked CRM Invoices ({billingSummary.invoices?.length || 0})</h3>
            {billingSummary.invoices?.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No invoices recorded yet in CRM.</p>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-700">
                    <tr>
                      <th className="p-3">Invoice #</th>
                      <th className="p-3">Client / Company</th>
                      <th className="p-3">Phone</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Due Date</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Instant Dispatch</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {billingSummary.invoices.slice(0, 15).map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-mono font-medium text-slate-900">{inv.invoice_no || `INV-${inv.id}`}</td>
                        <td className="p-3 font-semibold">{inv.client_company || inv.client_name || "—"}</td>
                        <td className="p-3 font-mono text-slate-600">{inv.client_phone || "—"}</td>
                        <td className="p-3 font-bold text-slate-900">₹{inv.total_amount ?? inv.grand_total ?? "0"}</td>
                        <td className="p-3 text-slate-600">{inv.due_date || "—"}</td>
                        <td className="p-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              String(inv.status).toLowerCase() === "paid"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {inv.status || "unpaid"}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              if (!inv.client_phone) {
                                alert("No phone number attached to this invoice.");
                                return;
                              }
                              setTestPhone(inv.client_phone.replace(/\D/g, ""));
                              const invRule = automations.find((a) => a.trigger_type === "invoice_created") || automations[0];
                              if (invRule) {
                                setTestModal(invRule);
                              } else {
                                alert("Please create an invoice automation rule first.");
                              }
                            }}
                            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Send WhatsApp
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 6: WELCOME AUTO-REPLY                                     */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === "welcome" && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-6 max-w-3xl">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <div>
              <h2 className="text-base font-bold text-slate-900">Welcome Auto-Reply & Cooldown</h2>
              <p className="text-xs text-slate-600">
                Greet new or returning customers on their first message with dynamic variables or interactive buttons.
              </p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(welcomeSettings.enabled)}
                onChange={(e) => setWelcomeSettings((w) => ({ ...w, enabled: e.target.checked ? 1 : 0 }))}
                className="w-4 h-4 rounded text-slate-900"
              />
              <span className="text-xs font-bold text-slate-800">Enable Auto-Reply</span>
            </label>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Greeting Message Text</label>
              <textarea
                rows={4}
                value={welcomeSettings.welcome_text || ""}
                onChange={(e) => setWelcomeSettings((w) => ({ ...w, welcome_text: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 p-3 text-xs text-slate-800 shadow-xs focus:border-slate-800 focus:outline-none"
                placeholder="Hello {name}! Welcome to {company}..."
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Supports placeholders: <code>{"{name}"}</code>, <code>{"{company}"}</code>, <code>{"{greeting_time}"}</code>.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Cooldown Duration (Hours)</label>
                <input
                  type="number"
                  min="1"
                  max="720"
                  value={welcomeSettings.cooldown_hours || 24}
                  onChange={(e) => setWelcomeSettings((w) => ({ ...w, cooldown_hours: parseInt(e.target.value, 10) }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 shadow-xs"
                />
                <span className="text-[10px] text-slate-500">Wait this long before greeting the same phone number again.</span>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Working Hours Only</label>
                <select
                  value={welcomeSettings.working_hours_only ? "1" : "0"}
                  onChange={(e) => setWelcomeSettings((w) => ({ ...w, working_hours_only: e.target.value === "1" ? 1 : 0 }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 shadow-xs"
                >
                  <option value="0">24/7 (Always Send)</option>
                  <option value="1">Business Hours Only (09:00 - 21:00 IST)</option>
                </select>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-100">
              <button
                type="button"
                onClick={async () => {
                  setSavingWelcome(true);
                  try {
                    await axios.put(`${API}/api/wa/automations/welcome-settings`, welcomeSettings, { headers: headers() });
                    setPageNotice({ type: "success", message: "Welcome settings updated successfully." });
                  } catch (err) {
                    setPageNotice({ type: "error", message: err.response?.data?.error || "Could not save welcome settings." });
                  }
                  setSavingWelcome(false);
                }}
                disabled={savingWelcome}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800"
              >
                {savingWelcome ? "Saving…" : "Save Welcome Settings"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 7: INDUSTRY BLUEPRINTS                                    */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === "starters" && (
        <div className="space-y-4">
          <div className="pb-2 border-b border-slate-200">
            <h2 className="text-base font-bold text-slate-900">Industry Automation Starter Blueprints</h2>
            <p className="text-xs text-slate-600">
              Pre-configured, production-ready workflows built for hospitals, real estate, education, restaurants, SaaS, and service businesses.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {starters.map((starter, idx) => (
              <div
                key={idx}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-xs hover:border-slate-300 transition"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-slate-100 p-1.5 text-xs font-bold text-slate-700">
                      {starter.category ? starter.category.toUpperCase() : "BLUEPRINT"}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">{starter.trigger_type}</span>
                  </div>

                  <h3 className="mt-2 text-sm font-bold text-slate-900">{starter.name}</h3>
                  <p className="mt-1 text-xs text-slate-600 line-clamp-3">
                    "{starter.message_text}"
                  </p>

                  {starter.actions_json && (
                    <div className="mt-2 text-[11px] text-blue-700 font-medium">
                      ⚡ Includes multi-step question/bill pipeline
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => adoptStarter(starter)}
                    className="w-full rounded-lg bg-slate-900 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition"
                  >
                    Adopt This Blueprint
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 8: EXECUTION DIAGNOSTICS & LOGS                           */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === "logs" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
            <div>
              <h2 className="text-base font-bold text-slate-900">Execution Timeline & Diagnostics</h2>
              <p className="text-xs text-slate-600">
                Detailed audit trail of all evaluated triggers, condition outcomes, and Meta delivery statuses.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchData}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh Logs
            </button>
          </div>

          {logs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-xs text-slate-500">
              No executions logged yet. When events trigger automations, their execution records and diagnostics will appear here.
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-700">
                  <tr>
                    <th className="p-3">Execution ID</th>
                    <th className="p-3">Automation</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3">Contact</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Meta Message ID</th>
                    <th className="p-3">Timestamp / Scheduled</th>
                    <th className="p-3 text-right">Diagnostics</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {logs.map((log) => {
                    const isExpanded = expandedLogId === log.id;
                    const hasDiag = log.diagnostics && log.diagnostics.length > 0;

                    return (
                      <React.Fragment key={log.id}>
                        <tr className="hover:bg-slate-50/50">
                          <td className="p-3 font-mono font-bold text-slate-700">#{log.id}</td>
                          <td className="p-3">
                            <span className="font-semibold text-slate-900">{log.automation_name || `Rule #${log.automation_id}`}</span>
                            <span className="block text-[10px] text-slate-500">{log.trigger_type}</span>
                          </td>
                          <td className="p-3 font-mono text-slate-600">+{log.phone}</td>
                          <td className="p-3">{log.contact_name || "—"}</td>
                          <td className="p-3">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                log.status === "sent"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : log.status === "scheduled"
                                  ? "bg-amber-100 text-amber-800"
                                  : log.status === "skipped"
                                  ? "bg-slate-100 text-slate-600"
                                  : "bg-rose-100 text-rose-800"
                              }`}
                            >
                              {log.status}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-[11px] text-slate-500 max-w-[140px] truncate">
                            {log.wa_message_id || "—"}
                          </td>
                          <td className="p-3 text-slate-500 text-[11px]">
                            {log.status === "scheduled"
                              ? `Due: ${new Date(log.scheduled_for).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                              : log.sent_at
                              ? new Date(log.sent_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                              : "—"}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {log.status === "scheduled" && (
                                <button
                                  type="button"
                                  onClick={() => handleCancelRun(log)}
                                  disabled={cancellingRun === log.id}
                                  className="rounded px-2 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-50"
                                >
                                  Cancel
                                </button>
                              )}
                              {hasDiag && (
                                <button
                                  type="button"
                                  onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                  className="rounded px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                                >
                                  {isExpanded ? "Hide" : "Details"}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {isExpanded && hasDiag && (
                          <tr className="bg-slate-50/70">
                            <td colSpan={8} className="p-3 border-t border-slate-200">
                              <div className="space-y-1.5 text-xs">
                                <span className="font-semibold text-slate-900 block">Condition Diagnostics Evaluation:</span>
                                <div className="space-y-1 max-h-40 overflow-y-auto">
                                  {log.diagnostics.map((d, dIdx) => (
                                    <div
                                      key={dIdx}
                                      className={`flex items-center justify-between rounded p-1.5 font-mono text-[11px] ${
                                        d.passed ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-900"
                                      }`}
                                    >
                                      <span>
                                        <strong>{d.field}</strong> {d.operator} expected: <code>{JSON.stringify(d.expectedValue)}</code> (actual: <code>{JSON.stringify(d.actualValue)}</code>)
                                      </span>
                                      <span className="font-bold">{d.passed ? "PASSED" : "FAILED"}</span>
                                    </div>
                                  ))}
                                </div>
                                {log.error && <p className="text-xs text-rose-600 font-semibold mt-1">Error: {log.error}</p>}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL: Full Automation & Pipeline Editor                     */}
      {/* ───────────────────────────────────────────────────────────── */}
      {(showModal || isEditorPage) && (
        <div
          className={
            isEditorPage
              ? "w-full"
              : "fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3"
          }
          onClick={isEditorPage ? undefined : () => { if (!savingRule) closeEditor(); }}
        >
          <div
            ref={isEditorPage ? undefined : automationDialog}
            role={isEditorPage ? "region" : "dialog"}
            aria-modal={isEditorPage ? undefined : true}
            className={
              isEditorPage
                ? "rounded-2xl border border-slate-200 bg-white w-full flex flex-col shadow-sm"
                : "rounded-2xl border border-slate-200 bg-white w-full max-w-4xl max-h-[92dvh] min-h-0 flex flex-col overflow-hidden shadow-xl"
            }
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                  <Zap className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {editAutomation ? "Edit Automation Rule" : "Create WhatsApp Automation"}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Configure triggers, condition filters, and multi-step actions.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={savingRule || editorLoading}
                onClick={closeEditor}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 min-h-0 wa-custom-scrollbar">
              {ruleError && (
                <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
                  {ruleError}
                </div>
              )}

              {/* Mode Switcher */}
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-2">
                <span className="text-xs font-semibold text-slate-700 px-2">Automation Workflow Mode:</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, mode: "single" }))}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      form.mode === "single" ? "bg-white text-slate-900 shadow-xs border border-slate-200" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Direct Message & Follow-up
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, mode: "pipeline" }))}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      form.mode === "pipeline" ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    🔀 Multi-Step Workflow Pipeline
                  </button>
                </div>
              </div>

              {/* Basic Setup */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Rule Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Instant Invoice WhatsApp Notice"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 shadow-xs focus:border-slate-800 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Trigger Event *</label>
                  <select
                    value={form.trigger_type}
                    onChange={(e) => {
                      const t = e.target.value;
                      setForm((f) => ({
                        ...f,
                        trigger_type: t,
                        message_text: !f.message_text?.trim() || f.message_text === PRESET_MESSAGES[f.trigger_type] ? PRESET_MESSAGES[t] || "" : f.message_text,
                      }));
                    }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 shadow-xs focus:border-slate-800 focus:outline-none"
                  >
                    {TRIGGER_CATEGORIES.map((cat) => (
                      <optgroup key={cat.category} label={cat.category}>
                        {cat.triggers.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.emoji} {t.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>

              {/* Sender & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">WhatsApp Meta Sender *</label>
                  <select
                    value={form.sender_id || ""}
                    onChange={(e) => setForm((f) => ({ ...f, sender_id: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 shadow-xs focus:border-slate-800 focus:outline-none"
                  >
                    <option value="">Choose a connected Meta sender</option>
                    {senders.map((s) => (
                      <option key={s.id} value={s.id} disabled={s.status !== "connected"}>
                        {s.display_phone || `Sender #${s.id}`} ({s.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Category</label>
                  <select
                    value={form.category || "general"}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 shadow-xs"
                  >
                    <option value="general">General</option>
                    <option value="sales">Sales & Leads</option>
                    <option value="billing">Billing & Invoices</option>
                    <option value="support">Support & Appointments</option>
                    <option value="onboarding">Onboarding</option>
                  </select>
                </div>
              </div>

              {/* Multi-Condition Engine */}
              <div>
                <WAConditionEditor value={conditions} onChange={setConditions} />
              </div>

              {/* Pipeline Actions Builder (When in Pipeline Mode) */}
              {form.mode === "pipeline" ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <GitBranch className="w-4 h-4 text-slate-700" /> Multi-Step Action Pipeline ({form.actions.length} Steps)
                    </span>
                    <span className="text-[11px] text-slate-500">Actions run in consecutive order.</span>
                  </div>

                  {form.actions.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500">
                      No actions added yet. Add steps from the action library below.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {form.actions.map((act, aIdx) => (
                        <div key={aIdx} className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900">
                              Step {aIdx + 1}: {ACTION_TYPES.find((t) => t.type === act.type)?.label || act.type}
                            </span>
                            <button
                              type="button"
                              onClick={() => setForm((f) => ({ ...f, actions: f.actions.filter((_, i) => i !== aIdx) }))}
                              className="text-xs text-rose-600 hover:text-rose-700 font-medium"
                            >
                              Remove
                            </button>
                          </div>

                          {act.type === "send_message" && (
                            <textarea
                              rows={2}
                              value={act.params?.text || ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                setForm((f) => ({
                                  ...f,
                                  actions: f.actions.map((item, i) => (i === aIdx ? { ...item, params: { ...item.params, text: val } } : item)),
                                }));
                              }}
                              placeholder="Message text with variables (e.g. Hello {name}!)..."
                              className="w-full rounded border border-slate-300 p-2 text-xs"
                            />
                          )}

                          {act.type === "ask_question" && (
                            <div className="space-y-2">
                              <input
                                type="text"
                                placeholder="Question text to customer..."
                                value={act.params?.question_text || ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setForm((f) => ({
                                    ...f,
                                    actions: f.actions.map((item, i) => (i === aIdx ? { ...item, params: { ...item.params, question_text: val } } : item)),
                                  }));
                                }}
                                className="w-full rounded border border-slate-300 p-2 text-xs"
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <select
                                  value={act.params?.expected_type || "button"}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setForm((f) => ({
                                      ...f,
                                      actions: f.actions.map((item, i) => (i === aIdx ? { ...item, params: { ...item.params, expected_type: val } } : item)),
                                    }));
                                  }}
                                  className="rounded border border-slate-300 p-1.5 text-xs"
                                >
                                  <option value="button">Quick Reply Button Choice</option>
                                  <option value="text">Free Text Answer</option>
                                  <option value="number">Number</option>
                                  <option value="email">Email Address</option>
                                  <option value="date">Date</option>
                                </select>
                                <input
                                  type="text"
                                  placeholder="Map answer to CRM field (e.g. city, service)"
                                  value={act.params?.crm_field || ""}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setForm((f) => ({
                                      ...f,
                                      actions: f.actions.map((item, i) => (i === aIdx ? { ...item, params: { ...item.params, crm_field: val } } : item)),
                                    }));
                                  }}
                                  className="rounded border border-slate-300 p-1.5 text-xs"
                                />
                              </div>
                            </div>
                          )}

                          {act.type === "wait_delay" && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-600">Delay for:</span>
                              <input
                                type="number"
                                min="1"
                                max="10080"
                                value={act.params?.minutes || 60}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10);
                                  setForm((f) => ({
                                    ...f,
                                    actions: f.actions.map((item, i) => (i === aIdx ? { ...item, params: { ...item.params, minutes: val } } : item)),
                                  }));
                                }}
                                className="w-24 rounded border border-slate-300 p-1 text-xs"
                              />
                              <span className="text-xs text-slate-600">minutes</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Action Library Buttons */}
                  <div className="pt-2">
                    <span className="text-xs font-semibold text-slate-700 block mb-2">Add Step to Pipeline:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {ACTION_TYPES.map((at) => (
                        <button
                          key={at.type}
                          type="button"
                          onClick={() => {
                            setForm((f) => ({
                              ...f,
                              actions: [
                                ...f.actions,
                                {
                                  id: `act_${f.actions.length + 1}`,
                                  type: at.type,
                                  title: at.label,
                                  params: {},
                                },
                              ],
                            }));
                          }}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition"
                        >
                          <Plus className="w-3 h-3 text-slate-500" />
                          <span>{at.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* Direct Message Box */
                <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-900">Main WhatsApp Message Content</span>
                    <div className="flex items-center gap-1">
                      {["text", "media", "template"].map((kind) => (
                        <button
                          key={kind}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, msg_kind: kind }))}
                          className={`rounded-md px-2.5 py-1 text-xs font-semibold uppercase transition ${
                            form.msg_kind === kind ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          {kind}
                        </button>
                      ))}
                    </div>
                  </div>

                  {form.msg_kind === "text" && (
                    <div className="space-y-3">
                      <WAVariablePicker
                        onInsert={(tag) => setForm((f) => ({ ...f, message_text: (f.message_text || "") + " " + tag }))}
                      />
                      <textarea
                        rows={4}
                        value={form.message_text || ""}
                        onChange={(e) => setForm((f) => ({ ...f, message_text: e.target.value }))}
                        className="w-full rounded-lg border border-slate-300 p-3 text-xs text-slate-900 shadow-xs focus:border-slate-800 focus:outline-none"
                        placeholder="Type message here with placeholders..."
                      />
                      {form.message_text && (
                        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs">
                          <span className="font-semibold text-slate-700 block mb-1">Live Preview with Sample Data:</span>
                          <p className="text-slate-800 whitespace-pre-wrap font-mono text-[11px]">
                            {evaluateMessagePlaceholders(form.message_text)}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {form.msg_kind === "template" && (
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-700 block mb-1">Select Approved Template</label>
                      <select
                        value={form.template_id}
                        onChange={(e) => setForm((f) => ({ ...f, template_id: e.target.value }))}
                        className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900"
                      >
                        <option value="">-- Choose Template --</option>
                        {templates.filter(isApprovedTemplate).map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} ({t.category})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {form.msg_kind === "media" && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">Media Type</label>
                        <select
                          value={form.media_type}
                          onChange={(e) => setForm((f) => ({ ...f, media_type: e.target.value }))}
                          className="w-full rounded border border-slate-300 p-2 text-xs"
                        >
                          <option value="image">📷 Image</option>
                          <option value="document">📄 PDF Document</option>
                          <option value="video">🎥 Video</option>
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-xs font-semibold text-slate-700 block mb-1">HTTPS Media URL</label>
                        <input
                          type="text"
                          value={form.media_url || ""}
                          onChange={(e) => setForm((f) => ({ ...f, media_url: e.target.value }))}
                          placeholder="https://example.com/invoice.pdf"
                          className="w-full rounded border border-slate-300 p-2 text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Delivery Timing & Group */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Send Delay (Minutes)</label>
                  <input
                    type="number"
                    min="0"
                    max="43200"
                    value={form.delay_minutes}
                    onChange={(e) => setForm((f) => ({ ...f, delay_minutes: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 shadow-xs"
                  />
                  <span className="text-[10px] text-slate-500">Set 0 for instant execution on trigger.</span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Auto-Trigger Flow Bot (Optional)</label>
                  <select
                    value={form.flow_id || ""}
                    onChange={(e) => setForm((f) => ({ ...f, flow_id: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 shadow-xs"
                  >
                    <option value="">-- Do Not Trigger Flow --</option>
                    {flows.map((fl) => (
                      <option key={fl.id} value={fl.id}>
                        {fl.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-2">
                <input
                  type="checkbox"
                  checked={Boolean(form.is_active)}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked ? 1 : 0 }))}
                  className="w-4 h-4 rounded text-slate-900"
                />
                <span className="text-xs font-bold text-slate-800">Activate rule immediately upon saving</span>
              </label>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-end gap-2 bg-slate-50/50">
              <button
                type="button"
                onClick={closeEditor}
                disabled={savingRule}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={savingRule}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800"
              >
                {savingRule ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                <span>{savingRule ? "Saving…" : editAutomation ? "Save Rule" : "Create Rule"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* SIMULATOR MODAL                                               */}
      {/* ───────────────────────────────────────────────────────────── */}
      {testModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3"
          onClick={() => setTestModal(null)}
        >
          <div
            className="rounded-2xl border border-slate-200 bg-white w-full max-w-lg p-6 shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900">Simulate Rule Execution</h3>
                <p className="text-xs text-slate-500">{testModal.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setTestModal(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Test Recipient Phone</label>
                <input
                  type="text"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 shadow-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Simulated Customer Name</label>
                <input
                  type="text"
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  placeholder="Rahul Sharma"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 shadow-xs"
                />
              </div>

              <button
                type="button"
                onClick={async () => {
                  setTestingTrigger(true);
                  try {
                    const res = await axios.post(
                      `${API}/api/wa/automations/simulate-trigger`,
                      {
                        trigger_type: testModal.trigger_type,
                        contact_name: testName,
                        custom_data: { name: testName, phone: testPhone, amount: 6500, city: "Mumbai" },
                      },
                      { headers: headers() }
                    );
                    setTestResult(res.data);
                  } catch (err) {
                    alert(err.response?.data?.error || "Simulation failed.");
                  }
                  setTestingTrigger(false);
                }}
                disabled={testingTrigger}
                className="w-full rounded-lg bg-slate-900 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800"
              >
                {testingTrigger ? "Evaluating…" : "Run Diagnostic Simulation"}
              </button>

              {testResult && (
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-2 text-xs">
                  <span className="font-semibold text-slate-900 block">Simulation Diagnostic Outcome:</span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        testResult.matched_rules_count > 0 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {testResult.matched_rules_count > 0 ? "Conditions Matched" : "Conditions Filtered Out"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
