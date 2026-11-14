import WAWorkspaceGuide from "../components/WAWorkspaceGuide";
import { useLocation, useNavigate } from "react-router-dom";
import React, { useState, useEffect, useRef } from "react";
import {
  Zap, Plus, X, Loader2, CheckCircle2, Play,
  Clock, ToggleLeft, ToggleRight, FileText, ListChecks, Trash2,
  Sparkles, RefreshCw, Webhook,
  Users, Bot, ArrowRight, ArrowLeft, ShieldCheck,
  Smartphone, Bell, AlertCircle,
  CreditCard, GitBranch, MessageSquare, HelpCircle,
  Building2, Tag, Search
} from "lucide-react";
import axios from "axios";
import { API } from "../config/api";
import WhatsAppInteractiveReminders from "../components/WhatsAppInteractiveReminders";
import WAVariablePicker, { evaluateMessagePlaceholders } from "../components/WAVariablePicker";
import WAConditionEditor, { parseConditions } from "../components/WAConditionEditor";
import { useEnterprise } from "../context/EnterpriseContext";
import { useAuth } from "../auth/AuthContext";
import AutomationDraftPreview from "../components/AutomationDraftPreview";
import AutomationFollowupOptions from "../components/AutomationFollowupOptions";
import AutomationRuleActivity from "../components/AutomationRuleActivity";
import AutomationPipelineParams from "../components/AutomationPipelineParams";
import ExternalWebhookModal from "../components/ExternalWebhookModal";
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

const CREATE_PATH = "/whatsapp/automations/create";
const DEFAULT_SCHEDULE = {
  reminder_type: "relative",
  delay_value: 1,
  delay_unit: "days",
  cancel_on_event: "invoice_paid",
  business_hours_only: false,
  max_attempts: 3,
};

// Shown on the create page when the tenant has not loaded any blueprints yet.
const QUICK_STARTERS = [
  { name: "Invoice Created", trigger_type: "invoice_created", category: "billing", message_text: PRESET_MESSAGES.invoice_created },
  { name: "New Lead Welcome", trigger_type: "new_lead", category: "sales", message_text: PRESET_MESSAGES.new_lead },
  { name: "Appointment Reminder", trigger_type: "appointment_reminder", category: "support", message_text: PRESET_MESSAGES.appointment_reminder },
  { name: "Payment Received", trigger_type: "payment_received", category: "billing", message_text: PRESET_MESSAGES.payment_received },
];

const INDUSTRY_STARTERS = [
  {
    name: "Hospital: Appointment Booking & Consultation Confirmation",
    trigger_type: "appointment_booked",
    category: "support",
    message_text: "🏥 Care Confirmation: Hello {name}, your appointment with {company} has been scheduled for {appointment.date}. Reply 1 to Confirm or 2 to Reschedule.",
    delay_minutes: 0,
    is_active: 1,
    actions_json: JSON.stringify([
      { id: "act_1", type: "send_message", title: "Send Appointment Confirmation" },
      { id: "act_2", type: "ask_question", title: "Ask for Patient Confirmation", params: { expected_type: "choice" } }
    ])
  },
  {
    name: "Billing: Auto-Send Invoice PDF with Payment Button",
    trigger_type: "invoice_created",
    category: "billing",
    message_text: "🧾 Hello {name}, your invoice #{invoice_no} ({amount}) is ready. Please tap below to pay securely.",
    delay_minutes: 0,
    is_active: 1,
    actions_json: JSON.stringify([
      { id: "act_1", type: "send_bill", title: "Deliver Invoice PDF Document" },
      { id: "act_2", type: "send_payment_link", title: "Attach Instant Payment Checkout Link" }
    ])
  },
  {
    name: "Real Estate: Property Enquiry & Site Visit Confirmation",
    trigger_type: "new_lead",
    category: "sales",
    message_text: "🏡 Hello {name}! Thank you for inquiring about our luxury residences. Would you like to schedule a VIP site visit?",
    delay_minutes: 0,
    is_active: 1,
    actions_json: JSON.stringify([
      { id: "act_1", type: "send_message", title: "Send Brochure & Project Overview" },
      { id: "act_2", type: "ask_question", title: "Ask for Site Visit Preference", params: { expected_type: "choice" } }
    ])
  },
  {
    name: "Automobile: Vehicle Service Completed & PDF Bill",
    trigger_type: "service_visit_scheduled",
    category: "support",
    message_text: "🚗 Great news {name}! Your vehicle service is completed. Your inspection checklist and bill are ready.",
    delay_minutes: 0,
    is_active: 1,
    actions_json: JSON.stringify([
      { id: "act_1", type: "send_bill", title: "Deliver Service Job Card & Invoice PDF" }
    ])
  },
  {
    name: "SaaS: Trial Expiry Nudge & Upgrade Offer",
    trigger_type: "deal_won",
    category: "sales",
    message_text: "⚡ Hello {name}, congratulations on exploring {company}! Your dedicated account manager is ready to assist.",
    delay_minutes: 0,
    is_active: 1
  }
];

const DEMO_STARTER_RULES = [
  {
    id: 1,
    name: "Auto-Send Invoice PDF & Payment Button",
    trigger_type: "invoice_created",
    trigger_label: "Invoice Created",
    category: "billing",
    is_active: 1,
    message_text: PRESET_MESSAGES.invoice_created,
    template_name: "invoice_ready_v1",
    actions_json: JSON.stringify([
      { type: "send_bill", title: "Send Invoice PDF with Payment Link" },
      { type: "ask_question", title: "Confirm Receipt (YES/NO)", params: { expected_type: "choice" } },
      { type: "wait_delay", title: "Wait 2 days for payment" }
    ]),
    schedule_json: JSON.stringify({ reminder_type: "relative", delay_value: 1, delay_unit: "days", cancel_on_event: "invoice_paid" }),
    created_at: new Date().toISOString()
  },
  {
    id: 2,
    name: "VIP New Lead Fast-Response & Agent Assignment",
    trigger_type: "new_lead",
    trigger_label: "New Lead Added",
    category: "sales",
    is_active: 1,
    message_text: PRESET_MESSAGES.new_lead,
    template_name: "lead_welcome_v1",
    actions_json: JSON.stringify([
      { type: "send_message", title: "Send Welcome Greeting" },
      { type: "assign_employee", title: "Assign Available Sales Specialist" }
    ]),
    created_at: new Date().toISOString()
  },
  {
    id: 3,
    name: "Appointment 24h Reminder & Confirmation Checkpoint",
    trigger_type: "appointment_reminder",
    trigger_label: "Appointment Reminder",
    category: "support",
    is_active: 1,
    message_text: PRESET_MESSAGES.appointment_reminder,
    template_name: "appointment_reminder_v1",
    actions_json: JSON.stringify([
      { type: "ask_question", title: "Collect Confirmation (YES/NO)", params: { expected_type: "choice" } }
    ]),
    created_at: new Date().toISOString()
  }
];

const DEMO_CHECKPOINTS = [
  {
    id: 1,
    automation_id: 1,
    automation_name: "Auto-Send Invoice PDF",
    phone: "919876543210",
    question_key: "confirm_receipt",
    question_context: { question_text: "Reply YES to confirm receiving your bill." },
    expected_type: "choice",
    status: "waiting",
    created_at: new Date().toISOString()
  },
  {
    id: 2,
    automation_id: 3,
    automation_name: "Appointment 24h Reminder",
    phone: "919811223344",
    question_key: "confirm_slot",
    question_context: { question_text: "Reply YES to confirm your appointment for tomorrow." },
    expected_type: "choice",
    status: "waiting",
    created_at: new Date().toISOString()
  }
];

const DEMO_BILLING_SUMMARY = {
  invoices: [
    { id: "INV-2026-089", invoice_no: "INV-2026-089", client_name: "Rahul Sharma", client_phone: "919876543210", total_amount: 1500, status: "unpaid", due_date: "2026-11-10" },
    { id: "INV-2026-090", invoice_no: "INV-2026-090", client_name: "Priya Patel", client_phone: "919822334455", total_amount: 3200, status: "unpaid", due_date: "2026-11-12" },
    { id: "INV-2026-091", invoice_no: "INV-2026-091", client_name: "Anil Mehta", client_phone: "919833445566", total_amount: 850, status: "paid", due_date: "2026-11-05" }
  ],
  totalInvoices: 3,
  unpaidCount: 2
};

const DEMO_SENDERS = [
  { id: 1, name: "Official WhatsApp Business", phone_number: "+91 98765 43210", status: "connected" }
];

const DEMO_TEMPLATES = [
  { id: 1, name: "invoice_ready_v1", status: "APPROVED", meta_status: "APPROVED", category: "UTILITY", language: "en" },
  { id: 2, name: "lead_welcome_v1", status: "APPROVED", meta_status: "APPROVED", category: "MARKETING", language: "en" },
  { id: 3, name: "appointment_reminder_v1", status: "APPROVED", meta_status: "APPROVED", category: "UTILITY", language: "en" }
];

const blankForm = (overrides = {}) => ({
  sender_id: "",
  branch_id: "",
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
  schedule: { ...DEFAULT_SCHEDULE },
  ...overrides,
});

const ACTION_TYPES = [
  { type: "send_message", label: "Send WhatsApp Message / Template", icon: MessageSquare, desc: "Deliver dynamic text, media, or Meta approved template" },
  { type: "send_bill", label: "Send Invoice / Quotation PDF", icon: FileText, desc: "Retrieve CRM invoice or quotation and send with pay button" },
  { type: "send_receipt", label: "Send Payment Receipt", icon: CheckCircle2, desc: "Send verified payment receipt with timestamp and invoice ID" },
  { type: "send_payment_link", label: "Send Payment Link", icon: CreditCard, desc: "Send verified payment URL for instant online settlement" },
  { type: "start_flow", label: "Start Conversational Flow Bot", icon: Bot, desc: "Launch an active visual conversational flow" },
  { type: "ask_question", label: "Ask Customer Question (Checkpoint)", icon: HelpCircle, desc: "Collect text, number, date or button choice and wait for response" },
  { type: "wait_delay", label: "Wait / Delay Duration", icon: Clock, desc: "Durable delay before advancing to the next action step" },
  { type: "branch_condition", label: "Condition Gate (If/Else)", icon: GitBranch, desc: "Stop or skip next step based on CRM event values" },
  { type: "update_crm", label: "Update CRM Record", icon: Tag, desc: "Update lead status, stage, custom field or contact notes" },
  { type: "assign_employee", label: "Assign Employee / Agent", icon: Users, desc: "Route contact or enquiry to a specific team member" },
  { type: "internal_notification", label: "Internal Team Alert", icon: Bell, desc: "Send live dashboard alert to admins or assigned staff" },
  { type: "call_webhook", label: "Call External HTTPS Webhook", icon: ArrowRight, desc: "Invoke n8n / ERP endpoint with SSRF guard" },
  { type: "ai_process", label: "AI Process & Summarize", icon: Sparkles, desc: "Run metered AI instruction and store output variable" },
];

function useSafeAuth() {
  try {
    return useAuth();
  } catch (_) {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      return { user, demoMode: Boolean(user?.demoMode) };
    } catch (_) {
      return { user: null, demoMode: false };
    }
  }
}

export default function WhatsAppAutomations() {
  const { activeTenant } = useEnterprise();
  return <AutomationWorkspace key={activeTenant?.id || "none"} />;
}

function AutomationWorkspace() {
  const { demoMode } = useSafeAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const editRouteId = location.pathname.match(/\/automations\/(\d+)\/edit\/?$/)?.[1];
  const isEditorPage = Boolean(editRouteId) || location.pathname.replace(/\/$/, "").endsWith("/automations/create");

  // Core Data State: real empty defaults (no demo leak into production tenants)
  const [automations, setAutomations] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [senders, setSenders] = useState([]);
  const [branches, setBranches] = useState([]);
  const [groups, setGroups] = useState([]);
  const [flows, setFlows] = useState([]);
  const [logs, setLogs] = useState([]);
  const [checkpoints, setCheckpoints] = useState([]);
  const [starters, setStarters] = useState(INDUSTRY_STARTERS);
  const [billingSummary, setBillingSummary] = useState({ invoices: [], totalInvoices: 0, unpaidCount: 0, wallets: {} });
  const [stats, setStats] = useState({ totalRules: 0, activeRules: 0, totalRuns: 0, sentCount: 0, failedCount: 0, scheduledCount: 0 });
  const [loading, setLoading] = useState(true);
  const [sectionErrors, setSectionErrors] = useState({});
  const [pageNotice, setPageNotice] = useState(null);

  // Active Command Center Tab:
  // "rules" | "pipeline" | "reminders" | "checkpoints" | "billing" | "welcome" | "starters" | "logs"
  const [activeTab, setActiveTab] = useState("rules");

  // Filter, Search & Bulk Selection State
  const [ruleSearch, setRuleSearch] = useState("");
  const [ruleStatus, setRuleStatus] = useState("all");
  const [ruleCategory, setRuleCategory] = useState("all");
  const [ruleTriggerFilter, setRuleTriggerFilter] = useState("all");
  const [ruleBranchFilter, setRuleBranchFilter] = useState("all");
  const [selectedRuleIds, setSelectedRuleIds] = useState([]);
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [cancellingRun, setCancellingRun] = useState(null);

  // Editor State
  const [savingRule, setSavingRule] = useState(false);
  const [ruleError, setRuleError] = useState("");
  const [editAutomation, setEditAutomation] = useState(null);
  const [editorLoading, setEditorLoading] = useState(false);
  const [starterIndex, setStarterIndex] = useState("0");
  const editorRequest = useRef(0);

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
  const [showWebhookModal, setShowWebhookModal] = useState(false);

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

  // Editor Form State
  const [form, setForm] = useState(() => blankForm({ message_text: PRESET_MESSAGES.welcome_message }));

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
    setSectionErrors({});

    if (demoMode) {
      setAutomations(DEMO_STARTER_RULES);
      setTemplates(DEMO_TEMPLATES);
      setSenders(DEMO_SENDERS);
      setCheckpoints(DEMO_CHECKPOINTS);
      setBillingSummary(DEMO_BILLING_SUMMARY);
      setStarters(INDUSTRY_STARTERS);
      setStats({ totalRules: 3, activeRules: 3, totalRuns: 18, sentCount: 16, failedCount: 0, scheduledCount: 0 });
      setLoading(false);
      return;
    }

    const keys = ["rules", "references", "logs", "welcome", "stats", "checkpoints", "billing", "starters"];
    const results = await Promise.allSettled([
      axios.get(`${API}/api/wa/automations`, { headers: headers() }),
      axios.get(`${API}/api/wa/automations/references`, { headers: headers() }),
      axios.get(`${API}/api/wa/automations/logs/recent?limit=50`, { headers: headers() }),
      axios.get(`${API}/api/wa/automations/welcome-settings`, { headers: headers() }),
      axios.get(`${API}/api/wa/automations/stats`, { headers: headers() }),
      axios.get(`${API}/api/wa/automations/checkpoints`, { headers: headers() }),
      axios.get(`${API}/api/wa/automations/billing/summary`, { headers: headers() }),
      axios.get(`${API}/api/wa/automations/starters`, { headers: headers() }),
    ]);

    const errs = {};
    const val = (idx) => {
      const r = results[idx];
      if (r.status === "fulfilled") return r.value?.data;
      errs[keys[idx]] = r.reason?.response?.data?.error || r.reason?.message || `Failed to load ${keys[idx]}`;
      return null;
    };

    const rulesData = val(0);
    const refData = val(1);
    const logsData = val(2);
    const welcomeData = val(3);
    const statsData = val(4);
    const chkData = val(5);
    const billData = val(6);
    const starterData = val(7);

    setAutomations(Array.isArray(rulesData) ? rulesData : []);
    setTemplates(Array.isArray(refData?.templates) ? refData.templates : []);
    setFlows(Array.isArray(refData?.flows) ? refData.flows : []);
    setGroups(Array.isArray(refData?.groups) ? refData.groups : []);
    setSenders(Array.isArray(refData?.senders) ? refData.senders : []);
    setBranches(Array.isArray(refData?.branches) ? refData.branches : []);
    setLogs(Array.isArray(logsData) ? logsData : []);
    if (welcomeData) setWelcomeSettings(welcomeData);
    setStats(statsData && typeof statsData === "object" ? statsData : { totalRules: 0, activeRules: 0, totalRuns: 0, sentCount: 0, failedCount: 0, scheduledCount: 0 });
    setCheckpoints(Array.isArray(chkData) ? chkData : []);
    setBillingSummary(billData && Array.isArray(billData.invoices) ? billData : { invoices: [], totalInvoices: 0, unpaidCount: 0, wallets: {} });
    setStarters(Array.isArray(starterData) && starterData.length ? starterData : INDUSTRY_STARTERS);
    setSectionErrors(errs);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const anyActive = (Array.isArray(automations) ? automations : []).some((a) => a?.is_active === 1);

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

  const defaultSenderId = () => {
    const connected = (Array.isArray(senders) ? senders : []).filter((s) => s?.status === "connected");
    return connected.length === 1 ? connected[0].id : (connected[0]?.id || "");
  };

  const resetCreateForm = (draft = null) => {
    editorRequest.current++;
    setRuleError("");
    setEditorLoading(false);
    setEditAutomation(null);
    setConditions(draft?.conditions || { match: "all", rules: [] });
    setMenuOptions(draft?.options || []);
    setForm(blankForm({ sender_id: defaultSenderId(), ...(draft?.form || {}) }));
  };

  const openCreate = (draft = null) => {
    const safeDraft = draft && typeof draft === "object" && !("nativeEvent" in draft) ? draft : null;
    if (isEditorPage) {
      resetCreateForm(safeDraft);
      return;
    }
    navigate(CREATE_PATH, safeDraft ? { state: { draft: safeDraft } } : undefined);
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
      loadedActions = a.actions_json ? (typeof a.actions_json === "string" ? JSON.parse(a.actions_json) : a.actions_json) : [];
    } catch (_) {}
    if (!Array.isArray(loadedActions)) loadedActions = [];

    let loadedSchedule = { ...DEFAULT_SCHEDULE };
    try {
      if (a.schedule_json) {
        const parsed = typeof a.schedule_json === "string" ? JSON.parse(a.schedule_json) : a.schedule_json;
        loadedSchedule = { ...loadedSchedule, ...parsed };
      }
    } catch (_) {}

    setForm(blankForm({
      sender_id: a.sender_id || "",
      branch_id: a.branch_id || "",
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
    }));

    setMenuOptions(a.options || []);
  };

  useEffect(() => {
    if (editRouteId) {
      openEdit({ id: editRouteId });
      return;
    }
    if (isEditorPage) {
      resetCreateForm(location.state?.draft || null);
      return;
    }
    if (location.state?.templateId) {
      navigate(CREATE_PATH, {
        state: { draft: { form: { msg_kind: "template", template_id: location.state.templateId } } },
        replace: true,
      });
    }
  }, [location.pathname, location.state]);

  const closeEditor = () => {
    editorRequest.current++;
    setRuleError("");
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
      ...(editAutomation ? { revision: editAutomation.revision } : {}),
      sender_id: form.sender_id || null,
      branch_id: form.branch_id || null,
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

  const toggleRuleSelection = (id) => {
    setSelectedRuleIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const handleBulkSelection = async (action) => {
    if (!selectedRuleIds.length) return;
    if (action === "delete" && !window.confirm(`Delete ${selectedRuleIds.length} selected automation rule(s)?`)) return;
    setBulkToggling(true);
    try {
      const { data } = await axios.post(`${API}/api/wa/automations/bulk`, { ids: selectedRuleIds, action }, { headers: headers() });
      setSelectedRuleIds([]);
      await fetchData();
      setPageNotice({ type: "success", message: `Bulk ${action}: ${data.count || selectedRuleIds.length} rule(s) updated.` });
    } catch (err) {
      setPageNotice({ type: "error", message: err.response?.data?.error || `Bulk ${action} failed.` });
    } finally {
      setBulkToggling(false);
    }
  };

  const handleExportSelected = () => {
    const picked = (Array.isArray(automations) ? automations : []).filter((a) => !selectedRuleIds.length || selectedRuleIds.includes(a.id));
    const blob = new Blob([JSON.stringify(picked, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `whatsapp-automations-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
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

  const starterDraft = (starter) => {
    if (!starter) return null;
    let acts = [];
    try {
      acts = starter.actions_json ? (typeof starter.actions_json === "string" ? JSON.parse(starter.actions_json) : starter.actions_json) : [];
    } catch (_) {}
    if (!Array.isArray(acts)) acts = [];
    let sched = { ...DEFAULT_SCHEDULE };
    try {
      if (starter.schedule_json) {
        const parsed = typeof starter.schedule_json === "string" ? JSON.parse(starter.schedule_json) : starter.schedule_json;
        sched = { ...sched, ...parsed };
      }
    } catch (_) {}

    const hasSeq = Boolean(starter.followup_message_text || starter.followup_media_url || starter.followup_template_id);
    return {
      form: {
        sender_id: defaultSenderId(),
        name: starter.name,
        trigger_type: starter.trigger_type,
        category: starter.category || "general",
        mode: acts.length > 0 ? "pipeline" : "single",
        msg_kind: starter.template_id ? "template" : starter.media_url ? "media" : "text",
        template_id: starter.template_id || "",
        message_text: starter.message_text || "",
        media_type: starter.media_type || "image",
        media_url: starter.media_url || "",
        enable_sequence: hasSeq,
        sequence_delay_seconds: starter.sequence_delay_seconds || 7,
        followup_msg_kind: starter.followup_template_id ? "template" : starter.followup_media_url ? "media" : "text",
        followup_message_text: starter.followup_message_text || "",
        followup_media_type: starter.followup_media_type || "image",
        followup_media_url: starter.followup_media_url || "",
        followup_template_id: starter.followup_template_id || "",
        flow_id: starter.flow_id || "",
        group_id: starter.group_id || "",
        delay_minutes: starter.delay_minutes || 0,
        is_active: 1,
        actions: acts,
        schedule: sched,
      },
      conditions: parseConditions(starter.conditions || { match: "all", rules: [] }),
      options: [],
    };
  };

  const adoptStarter = (starter) => {
    const draft = starterDraft(starter);
    if (!draft) return;
    openCreate(draft);
  };

  // Applies a blueprint directly inside the create page.
  const applyStarter = (starter) => {
    const draft = starterDraft(starter);
    if (!draft) return;
    setRuleError("");
    setConditions(draft.conditions);
    setMenuOptions(draft.options);
    setForm((previous) => blankForm({ ...draft.form, sender_id: draft.form.sender_id || previous.sender_id }));
  };

  const safeAutomations = Array.isArray(automations) ? automations : [];
  const filteredAutomations = safeAutomations.filter((a) => {
    if (!a) return false;
    if (ruleStatus === "enabled" && a.is_active !== 1) return false;
    if (ruleStatus === "paused" && a.is_active !== 0) return false;
    if (ruleCategory !== "all" && a.category !== ruleCategory) return false;
    if (ruleTriggerFilter !== "all" && a.trigger_type !== ruleTriggerFilter) return false;
    if (ruleBranchFilter !== "all" && String(a.branch_id || "") !== String(ruleBranchFilter)) return false;
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

  const triggerLabel = TRIGGER_TYPES.find((t) => t.value === form.trigger_type)?.label || form.trigger_type;
  const starterChoices = QUICK_STARTERS.concat(
    Array.isArray(starters) ? starters.filter((s) => !QUICK_STARTERS.some((q) => q.name === s.name)) : []
  );
  const editing = Boolean(editRouteId) || Boolean(editAutomation);
  const addOption = () => setMenuOptions((list) => (list.length >= 3 ? list : [...list, { label: "", reply_text: "" }]));
  const updateOption = (index, patch) =>
    setMenuOptions((list) => list.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  const removeOption = (index) => setMenuOptions((list) => list.filter((_, i) => i !== index));

  if (isEditorPage) {
    return (
      <div className="mx-auto w-full max-w-[1440px] space-y-5 p-4 sm:p-6 lg:p-8">
        <WAWorkspaceGuide section="automations" />

        {/* ── Page header ── */}
        <div>
          <button
            type="button"
            onClick={closeEditor}
            disabled={savingRule}
            className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-50"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to automations
          </button>

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-xs shrink-0"
                style={{ background: "var(--color-ink, #202C52)" }}
              >
                <Zap className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1
                    className="text-xl font-bold tracking-tight sm:text-2xl m-0"
                    style={{ color: "var(--color-ink, #202C52)", fontFamily: "Poppins, sans-serif" }}
                  >
                    {editing ? "Edit WhatsApp Automation" : "Create WhatsApp Automation"}
                  </h1>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide border ${
                      form.is_active
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : "bg-slate-100 text-slate-600 border-slate-200"
                    }`}
                  >
                    {form.is_active ? "Active on save" : "Saved paused"}
                  </span>
                </div>
                <p className="mt-1 text-xs sm:text-sm" style={{ color: "var(--color-ink-2, #667085)", margin: 0 }}>
                  Choose a CRM event, add conditions, craft the message, then review the execution plan before saving.
                </p>
              </div>
            </div>

            <div className="hidden items-center gap-2 text-xs sm:flex" style={{ color: "var(--color-ink-2, #667085)" }}>
              {editorLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-600" /> Loading rule…
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  {draftIssues.length ? `${draftIssues.length} item${draftIssues.length === 1 ? "" : "s"} to complete` : "All checks passed"}
                </>
              )}
            </div>
          </div>
        </div>

        {ruleError && (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800 shadow-xs">
            {ruleError}
          </div>
        )}

        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              handleSave();
            }}
            className="overflow-hidden rounded-2xl border shadow-xs"
            style={{
              background: "var(--color-paper-2, #ffffff)",
              borderColor: "var(--color-rule, #E8E8E8)",
            }}
          >
            <div className="divide-y" style={{ borderColor: "var(--color-rule, #E8E8E8)" }}>
              {/* Quick start */}
              {!editing && starterChoices.length > 0 && (
                <section
                  className="space-y-3 p-5 sm:p-6"
                  style={{ background: "var(--color-surface, #F5F5F5)" }}
                >
                  <div>
                    <h2 className="flex items-center gap-2 text-sm font-bold m-0" style={{ color: "var(--color-ink, #202C52)", fontFamily: "Poppins, sans-serif" }}>
                      <Sparkles className="h-4 w-4 text-amber-500" /> Start from a blueprint
                    </h2>
                    <p className="mt-1 text-xs" style={{ color: "var(--color-ink-2, #667085)", margin: 0 }}>
                      Load a ready-made rule, then adjust the trigger, message and delivery below.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <select
                      aria-label="Starter blueprint"
                      value={starterIndex}
                      onChange={(event) => setStarterIndex(event.target.value)}
                      className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 shadow-xs focus:border-slate-800 focus:outline-none"
                    >
                      {starterChoices.map((starter, index) => (
                        <option key={`${starter.name}-${index}`} value={String(index)}>
                          {starter.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => applyStarter(starterChoices[Number(starterIndex)] || starterChoices[0])}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-100"
                    >
                      Apply starter
                    </button>
                  </div>
                </section>
              )}

              {/* Basics */}
              <section className="space-y-4 p-5 sm:p-6">
                <div>
                  <h2
                    className="flex items-center gap-2 text-sm font-bold m-0"
                    style={{ color: "var(--color-ink, #202C52)", fontFamily: "Poppins, sans-serif" }}
                  >
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white shrink-0"
                      style={{ background: "var(--color-ink, #202C52)" }}
                    >
                      1
                    </span>
                    Rule basics
                  </h2>
                  <p className="mt-1 text-xs" style={{ color: "var(--color-ink-2, #667085)" }}>
                    Name the rule and pick the CRM event that starts it.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="automation-rule-name" className="mb-1 block text-xs font-semibold" style={{ color: "var(--color-ink, #202C52)" }}>
                      Rule Name *
                    </label>
                    <input
                      id="automation-rule-name"
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Instant Invoice WhatsApp Notice"
                      className="w-full rounded-lg border px-3 py-2 text-xs shadow-xs focus:outline-none"
                      style={{
                        borderColor: "var(--color-rule, #E8E8E8)",
                        background: "var(--color-paper-2, #ffffff)",
                        color: "var(--color-ink, #202C52)",
                      }}
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="automation-trigger-event" className="mb-1 block text-xs font-semibold" style={{ color: "var(--color-ink, #202C52)" }}>
                      Trigger Event *
                    </label>
                    <select
                      id="automation-trigger-event"
                      value={form.trigger_type}
                      onChange={(e) => {
                        const t = e.target.value;
                        setForm((f) => ({
                          ...f,
                          trigger_type: t,
                          message_text: !f.message_text?.trim() || f.message_text === PRESET_MESSAGES[f.trigger_type] ? PRESET_MESSAGES[t] || "" : f.message_text,
                        }));
                      }}
                      className="w-full rounded-lg border px-3 py-2 text-xs shadow-xs focus:outline-none"
                      style={{
                        borderColor: "var(--color-rule, #E8E8E8)",
                        background: "var(--color-paper-2, #ffffff)",
                        color: "var(--color-ink, #202C52)",
                      }}
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
                    <p className="mt-1 text-[11px]" style={{ color: "var(--color-ink-2, #667085)" }}>
                      {TRIGGER_TYPES.find((t) => t.value === form.trigger_type)?.desc}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold" style={{ color: "var(--color-ink, #202C52)" }}>
                      WhatsApp Meta Sender *
                    </label>
                    <select
                      value={form.sender_id || ""}
                      onChange={(e) => setForm((f) => ({ ...f, sender_id: e.target.value }))}
                      className="w-full rounded-lg border px-3 py-2 text-xs shadow-xs focus:outline-none"
                      style={{
                        borderColor: "var(--color-rule, #E8E8E8)",
                        background: "var(--color-paper-2, #ffffff)",
                        color: "var(--color-ink, #202C52)",
                      }}
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
                    <label className="mb-1 block text-xs font-semibold" style={{ color: "var(--color-ink, #202C52)" }}>
                      Branch Scope (optional)
                    </label>
                    <select
                      value={form.branch_id || ""}
                      onChange={(e) => setForm((f) => ({ ...f, branch_id: e.target.value }))}
                      className="w-full rounded-lg border px-3 py-2 text-xs shadow-xs focus:outline-none"
                      style={{
                        borderColor: "var(--color-rule, #E8E8E8)",
                        background: "var(--color-paper-2, #ffffff)",
                        color: "var(--color-ink, #202C52)",
                      }}
                    >
                      <option value="">Organization-Wide (All Branches)</option>
                      {branches.map((br) => (
                        <option key={br.id} value={br.id}>
                          {br.name} ({br.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold" style={{ color: "var(--color-ink, #202C52)" }}>
                      Category
                    </label>
                    <select
                      value={form.category || "general"}
                      onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                      className="w-full rounded-lg border px-3 py-2 text-xs shadow-xs focus:outline-none"
                      style={{
                        borderColor: "var(--color-rule, #E8E8E8)",
                        background: "var(--color-paper-2, #ffffff)",
                        color: "var(--color-ink, #202C52)",
                      }}
                    >
                      <option value="general">General</option>
                      <option value="sales">Sales &amp; Leads</option>
                      <option value="billing">Billing &amp; Invoices</option>
                      <option value="support">Support &amp; Appointments</option>
                      <option value="onboarding">Onboarding</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* Conditions */}
              <section className="space-y-4 p-5 sm:p-6">
                <div>
                  <h2
                    className="flex items-center gap-2 text-sm font-bold m-0"
                    style={{ color: "var(--color-ink, #202C52)", fontFamily: "Poppins, sans-serif" }}
                  >
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white shrink-0"
                      style={{ background: "var(--color-ink, #202C52)" }}
                    >
                      2
                    </span>
                    Conditions
                  </h2>
                  <p className="mt-1 text-xs" style={{ color: "var(--color-ink-2, #667085)" }}>
                    Optional filters. Leave empty to run for every matching event.
                  </p>
                </div>
                <WAConditionEditor value={conditions} onChange={setConditions} />
              </section>

              {/* Message */}
              <section className="space-y-4 p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2
                      className="flex items-center gap-2 text-sm font-bold m-0"
                      style={{ color: "var(--color-ink, #202C52)", fontFamily: "Poppins, sans-serif" }}
                    >
                      <span
                        className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white shrink-0"
                        style={{ background: "var(--color-ink, #202C52)" }}
                      >
                        3
                      </span>
                      Message content
                    </h2>
                    <p className="mt-1 text-xs" style={{ color: "var(--color-ink-2, #667085)" }}>
                      Send one message, or build a multi-step workflow pipeline.
                    </p>
                  </div>
                  <div
                    className="flex items-center gap-1 rounded-lg border p-1"
                    style={{
                      background: "var(--color-surface, #F5F5F5)",
                      borderColor: "var(--color-rule, #E8E8E8)",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, mode: "single" }))}
                      className="rounded-md px-3 py-1.5 text-xs font-semibold transition"
                      style={{
                        background: form.mode === "single" ? "var(--color-paper-2, #ffffff)" : "transparent",
                        color: "var(--color-ink, #202C52)",
                        border: form.mode === "single" ? "1px solid var(--color-rule, #E8E8E8)" : "none",
                      }}
                    >
                      Direct message
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, mode: "pipeline" }))}
                      className="rounded-md px-3 py-1.5 text-xs font-semibold transition"
                      style={{
                        background: form.mode === "pipeline" ? "var(--color-ink, #202C52)" : "transparent",
                        color: form.mode === "pipeline" ? "#ffffff" : "var(--color-ink, #202C52)",
                      }}
                    >
                      🔀 Workflow pipeline
                    </button>
                  </div>
                </div>

                {form.mode === "pipeline" ? (
                  <div
                    className="space-y-4 rounded-xl border p-4"
                    style={{
                      background: "var(--color-surface, #F5F5F5)",
                      borderColor: "var(--color-rule, #E8E8E8)",
                    }}
                  >
                    <div
                      className="flex items-center justify-between border-b pb-2"
                      style={{ borderColor: "var(--color-rule, #E8E8E8)" }}
                    >
                      <span className="flex items-center gap-1.5 text-xs font-bold" style={{ color: "var(--color-ink, #202C52)" }}>
                        <GitBranch className="h-4 w-4" /> Action pipeline ({form.actions.length} steps)
                      </span>
                      <span className="text-[11px]" style={{ color: "var(--color-ink-2, #667085)" }}>
                        Actions run in consecutive order.
                      </span>
                    </div>

                    {form.actions.length === 0 ? (
                      <div
                        className="rounded-lg border border-dashed p-4 text-center text-xs"
                        style={{
                          background: "var(--color-paper-2, #ffffff)",
                          borderColor: "var(--color-rule, #E8E8E8)",
                          color: "var(--color-ink-2, #667085)",
                        }}
                      >
                        No actions added yet. Add steps from the action library below.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {form.actions.map((act, aIdx) => (
                          <div
                            key={aIdx}
                            className="space-y-2 rounded-lg border p-3.5 shadow-2xs"
                            style={{
                              background: "var(--color-paper-2, #ffffff)",
                              borderColor: "var(--color-rule, #E8E8E8)",
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold" style={{ color: "var(--color-ink, #202C52)" }}>
                                Step {aIdx + 1}: {ACTION_TYPES.find((t) => t.type === act.type)?.label || act.type}
                              </span>
                              <button
                                type="button"
                                onClick={() => setForm((f) => ({ ...f, actions: f.actions.filter((_, i) => i !== aIdx) }))}
                                className="text-xs font-semibold text-rose-600 hover:text-rose-700"
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
                                className="w-full rounded border p-2 text-xs focus:outline-none"
                                style={{
                                  borderColor: "var(--color-rule, #E8E8E8)",
                                  background: "var(--color-paper-2, #ffffff)",
                                  color: "var(--color-ink, #202C52)",
                                }}
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
                                  className="w-full rounded border p-2 text-xs focus:outline-none"
                                  style={{
                                    borderColor: "var(--color-rule, #E8E8E8)",
                                    background: "var(--color-paper-2, #ffffff)",
                                    color: "var(--color-ink, #202C52)",
                                  }}
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
                                    className="rounded border p-1.5 text-xs focus:outline-none"
                                    style={{
                                      borderColor: "var(--color-rule, #E8E8E8)",
                                      background: "var(--color-paper-2, #ffffff)",
                                      color: "var(--color-ink, #202C52)",
                                    }}
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
                                    className="rounded border p-1.5 text-xs focus:outline-none"
                                    style={{
                                      borderColor: "var(--color-rule, #E8E8E8)",
                                      background: "var(--color-paper-2, #ffffff)",
                                      color: "var(--color-ink, #202C52)",
                                    }}
                                  />
                                </div>
                              </div>
                            )}

                            {act.type === "wait_delay" && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs" style={{ color: "var(--color-ink-2, #667085)" }}>Delay for:</span>
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
                                  className="w-24 rounded border p-1 text-xs focus:outline-none font-mono"
                                  style={{
                                    borderColor: "var(--color-rule, #E8E8E8)",
                                    background: "var(--color-paper-2, #ffffff)",
                                    color: "var(--color-ink, #202C52)",
                                  }}
                                />
                                <span className="text-xs" style={{ color: "var(--color-ink-2, #667085)" }}>minutes</span>
                              </div>
                            )}

                            <AutomationPipelineParams
                              action={act}
                              flows={flows}
                              onPatchParams={(nextParams) =>
                                setForm((f) => ({
                                  ...f,
                                  actions: f.actions.map((item, i) => (i === aIdx ? { ...item, params: nextParams } : item)),
                                }))
                              }
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="pt-2">
                      <span className="mb-2 block text-xs font-semibold" style={{ color: "var(--color-ink, #202C52)" }}>
                        Add step to pipeline:
                      </span>
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
                                  { id: `act_${f.actions.length + 1}`, type: at.type, title: at.label, params: {} },
                                ],
                              }));
                            }}
                            className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-semibold shadow-2xs transition hover:opacity-90"
                            style={{
                              borderColor: "var(--color-rule, #E8E8E8)",
                              background: "var(--color-paper-2, #ffffff)",
                              color: "var(--color-ink, #202C52)",
                            }}
                          >
                            <Plus className="h-3 w-3" style={{ color: "var(--color-ink-2, #667085)" }} />
                            <span>{at.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className="space-y-4 rounded-xl border p-4 shadow-xs"
                    style={{
                      background: "var(--color-paper-2, #ffffff)",
                      borderColor: "var(--color-rule, #E8E8E8)",
                    }}
                  >
                    <div
                      className="flex items-center justify-between border-b pb-2"
                      style={{ borderColor: "var(--color-rule, #E8E8E8)" }}
                    >
                      <span className="text-xs font-bold" style={{ color: "var(--color-ink, #202C52)" }}>
                        Main WhatsApp message
                      </span>
                      <div className="flex items-center gap-1">
                        {["text", "media", "template"].map((kind) => (
                          <button
                            key={kind}
                            type="button"
                            onClick={() => setForm((f) => ({ ...f, msg_kind: kind }))}
                            className="rounded-md px-2.5 py-1 text-xs font-semibold uppercase transition"
                            style={{
                              background: form.msg_kind === kind ? "var(--color-ink, #202C52)" : "transparent",
                              color: form.msg_kind === kind ? "#ffffff" : "var(--color-ink, #202C52)",
                            }}
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
                        <label className="block text-xs font-semibold" style={{ color: "var(--color-ink, #202C52)" }}>
                          Main message text
                          <textarea
                            aria-label="Main message text"
                            rows={4}
                            value={form.message_text || ""}
                            onChange={(e) => setForm((f) => ({ ...f, message_text: e.target.value }))}
                            className="mt-1 w-full rounded-lg border p-3 text-xs shadow-xs focus:outline-none"
                            style={{
                              borderColor: "var(--color-rule, #E8E8E8)",
                              background: "var(--color-paper-2, #ffffff)",
                              color: "var(--color-ink, #202C52)",
                            }}
                            placeholder="Type message here with placeholders..."
                          />
                        </label>
                        {form.message_text && (
                          <div
                            className="rounded-lg border p-3 text-xs"
                            style={{
                              background: "var(--color-surface, #F5F5F5)",
                              borderColor: "var(--color-rule, #E8E8E8)",
                            }}
                          >
                            <span className="mb-1 block font-semibold" style={{ color: "var(--color-ink, #202C52)" }}>
                              Live preview with sample data:
                            </span>
                            <p className="whitespace-pre-wrap font-mono text-[11px] m-0" style={{ color: "var(--color-ink, #202C52)" }}>
                              {evaluateMessagePlaceholders(form.message_text)}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {form.msg_kind === "template" && (
                      <div>
                        <label className="mb-1 block text-xs font-semibold" style={{ color: "var(--color-ink, #202C52)" }}>
                          Select approved template
                        </label>
                        <select
                          value={form.template_id}
                          onChange={(e) => setForm((f) => ({ ...f, template_id: e.target.value }))}
                          className="w-full rounded-lg border p-2.5 text-xs focus:outline-none"
                          style={{
                            borderColor: "var(--color-rule, #E8E8E8)",
                            background: "var(--color-paper-2, #ffffff)",
                            color: "var(--color-ink, #202C52)",
                          }}
                        >
                          <option value="">-- Choose template --</option>
                          {templates.filter(isApprovedTemplate).map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} ({t.category})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {form.msg_kind === "media" && (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <div>
                          <label className="mb-1 block text-xs font-semibold" style={{ color: "var(--color-ink, #202C52)" }}>
                            Media type
                          </label>
                          <select
                            value={form.media_type}
                            onChange={(e) => setForm((f) => ({ ...f, media_type: e.target.value }))}
                            className="w-full rounded border p-2 text-xs focus:outline-none"
                            style={{
                              borderColor: "var(--color-rule, #E8E8E8)",
                              background: "var(--color-paper-2, #ffffff)",
                              color: "var(--color-ink, #202C52)",
                            }}
                          >
                            <option value="image">📷 Image</option>
                            <option value="document">📄 PDF document</option>
                            <option value="video">🎥 Video</option>
                            <option value="audio">🎵 Audio</option>
                            <option value="excel">📊 Excel</option>
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="mb-1 block text-xs font-semibold" style={{ color: "var(--color-ink, #202C52)" }}>
                            HTTPS media URL
                          </label>
                          <input
                            type="text"
                            value={form.media_url || ""}
                            onChange={(e) => setForm((f) => ({ ...f, media_url: e.target.value }))}
                            placeholder="https://example.com/invoice.pdf"
                            className="w-full rounded border p-2 text-xs focus:outline-none"
                            style={{
                              borderColor: "var(--color-rule, #E8E8E8)",
                              background: "var(--color-paper-2, #ffffff)",
                              color: "var(--color-ink, #202C52)",
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* Follow-up */}
              {form.mode === "single" && (
                <section className="space-y-4 p-5 sm:p-6">
                  <div>
                    <h2
                      className="flex items-center gap-2 text-sm font-bold m-0"
                      style={{ color: "var(--color-ink, #202C52)", fontFamily: "Poppins, sans-serif" }}
                    >
                      <span
                        className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white shrink-0"
                        style={{ background: "var(--color-ink, #202C52)" }}
                      >
                        4
                      </span>
                      Follow-up message
                    </h2>
                    <p className="mt-1 text-xs" style={{ color: "var(--color-ink-2, #667085)" }}>
                      Optionally send a second message a few seconds later.
                    </p>
                  </div>

                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer" style={{ color: "var(--color-ink, #202C52)" }}>
                    <input
                      type="checkbox"
                      checked={Boolean(form.enable_sequence)}
                      onChange={(e) => setForm((f) => ({ ...f, enable_sequence: e.target.checked }))}
                      className="h-4 w-4 rounded text-slate-900"
                    />
                    Enable a follow-up message
                  </label>

                  {form.enable_sequence && (
                    <div
                      className="space-y-4 rounded-xl border p-4"
                      style={{
                        background: "var(--color-surface, #F5F5F5)",
                        borderColor: "var(--color-rule, #E8E8E8)",
                      }}
                    >
                      <AutomationFollowupOptions form={form} setForm={setForm} templates={templates} />
                      <label className="block text-xs font-semibold" style={{ color: "var(--color-ink, #202C52)" }}>
                        Follow-up delay (seconds)
                        <input
                          type="number"
                          min="5"
                          max="60"
                          value={form.sequence_delay_seconds}
                          onChange={(e) => setForm((f) => ({ ...f, sequence_delay_seconds: e.target.value }))}
                          className="mt-1 w-32 rounded-lg border px-3 py-2 text-xs shadow-xs focus:outline-none font-mono"
                          style={{
                            borderColor: "var(--color-rule, #E8E8E8)",
                            background: "var(--color-paper-2, #ffffff)",
                            color: "var(--color-ink, #202C52)",
                          }}
                        />
                      </label>
                    </div>
                  )}
                </section>
              )}

              {/* Reply options */}
              <section className="space-y-4 p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2
                      className="flex items-center gap-2 text-sm font-bold m-0"
                      style={{ color: "var(--color-ink, #202C52)", fontFamily: "Poppins, sans-serif" }}
                    >
                      <span
                        className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white shrink-0"
                        style={{ background: "var(--color-ink, #202C52)" }}
                      >
                        5
                      </span>
                      Quick reply options
                    </h2>
                    <p className="mt-1 text-xs" style={{ color: "var(--color-ink-2, #667085)" }}>
                      Up to three buttons customers can tap to get an instant answer.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addOption}
                    disabled={menuOptions.length >= 3}
                    className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-semibold shadow-xs hover:opacity-90 disabled:opacity-50"
                    style={{
                      borderColor: "var(--color-rule, #E8E8E8)",
                      background: "var(--color-paper-2, #ffffff)",
                      color: "var(--color-ink, #202C52)",
                    }}
                  >
                    <Plus className="h-3 w-3" /> Add reply option
                  </button>
                </div>

                {menuOptions.length === 0 ? (
                  <p
                    className="rounded-lg border border-dashed p-4 text-center text-xs"
                    style={{
                      background: "var(--color-surface, #F5F5F5)",
                      borderColor: "var(--color-rule, #E8E8E8)",
                      color: "var(--color-ink-2, #667085)",
                    }}
                  >
                    No quick replies yet. Add a button label and the response it should send.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {menuOptions.map((option, index) => (
                      <div
                        key={index}
                        className="space-y-2 rounded-lg border p-3 shadow-2xs"
                        style={{
                          background: "var(--color-paper-2, #ffffff)",
                          borderColor: "var(--color-rule, #E8E8E8)",
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold" style={{ color: "var(--color-ink, #202C52)" }}>
                            Reply {index + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeOption(index)}
                            className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                          >
                            Remove
                          </button>
                        </div>
                        <input
                          type="text"
                          aria-label={`Reply ${index + 1} label`}
                          maxLength={20}
                          value={option.label}
                          onChange={(e) => updateOption(index, { label: e.target.value })}
                          placeholder="Button label (max 20 characters)"
                          className="w-full rounded-lg border px-3 py-2 text-xs shadow-xs focus:outline-none"
                          style={{
                            borderColor: "var(--color-rule, #E8E8E8)",
                            background: "var(--color-paper-2, #ffffff)",
                            color: "var(--color-ink, #202C52)",
                          }}
                        />
                        <textarea
                          aria-label="Response message"
                          rows={2}
                          value={option.reply_text}
                          onChange={(e) => updateOption(index, { reply_text: e.target.value })}
                          placeholder="Message sent when the customer taps this button"
                          className="w-full rounded-lg border px-3 py-2 text-xs shadow-xs focus:outline-none"
                          style={{
                            borderColor: "var(--color-rule, #E8E8E8)",
                            background: "var(--color-paper-2, #ffffff)",
                            color: "var(--color-ink, #202C52)",
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Delivery */}
              <section className="space-y-4 p-5 sm:p-6">
                <div>
                  <h2
                    className="flex items-center gap-2 text-sm font-bold m-0"
                    style={{ color: "var(--color-ink, #202C52)", fontFamily: "Poppins, sans-serif" }}
                  >
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white shrink-0"
                      style={{ background: "var(--color-ink, #202C52)" }}
                    >
                      6
                    </span>
                    Delivery &amp; activation
                  </h2>
                  <p className="mt-1 text-xs" style={{ color: "var(--color-ink-2, #667085)" }}>
                    Control timing, optional hand-offs and whether the rule starts immediately.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold" style={{ color: "var(--color-ink, #202C52)" }}>
                      Send delay (minutes)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="43200"
                      value={form.delay_minutes}
                      onChange={(e) => setForm((f) => ({ ...f, delay_minutes: e.target.value }))}
                      className="w-full rounded-lg border px-3 py-2 text-xs shadow-xs focus:outline-none font-mono"
                      style={{
                        borderColor: "var(--color-rule, #E8E8E8)",
                        background: "var(--color-paper-2, #ffffff)",
                        color: "var(--color-ink, #202C52)",
                      }}
                    />
                    <span className="text-[10px]" style={{ color: "var(--color-ink-2, #667085)" }}>
                      0 sends instantly on trigger.
                    </span>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold" style={{ color: "var(--color-ink, #202C52)" }}>
                      Start flow bot (optional)
                    </label>
                    <select
                      value={form.flow_id || ""}
                      onChange={(e) => setForm((f) => ({ ...f, flow_id: e.target.value }))}
                      className="w-full rounded-lg border px-3 py-2 text-xs shadow-xs focus:outline-none"
                      style={{
                        borderColor: "var(--color-rule, #E8E8E8)",
                        background: "var(--color-paper-2, #ffffff)",
                        color: "var(--color-ink, #202C52)",
                      }}
                    >
                      <option value="">-- Do not start a flow --</option>
                      {flows.map((fl) => (
                        <option key={fl.id} value={fl.id}>
                          {fl.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold" style={{ color: "var(--color-ink, #202C52)" }}>
                      Add to contact group (optional)
                    </label>
                    <select
                      value={form.group_id || ""}
                      onChange={(e) => setForm((f) => ({ ...f, group_id: e.target.value }))}
                      className="w-full rounded-lg border px-3 py-2 text-xs shadow-xs focus:outline-none"
                      style={{
                        borderColor: "var(--color-rule, #E8E8E8)",
                        background: "var(--color-paper-2, #ffffff)",
                        color: "var(--color-ink, #202C52)",
                      }}
                    >
                      <option value="">-- Do not add to a group --</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div
                  className="grid grid-cols-1 gap-3 sm:grid-cols-3 rounded-lg border p-3 text-xs"
                  style={{
                    background: "var(--color-surface, #F5F5F5)",
                    borderColor: "var(--color-rule, #E8E8E8)",
                  }}
                >
                  <label className="block">
                    <span className="font-semibold" style={{ color: "var(--color-ink, #202C52)" }}>Timezone</span>
                    <input
                      type="text"
                      value={form.schedule?.timezone || "Asia/Kolkata"}
                      onChange={(e) => setForm((f) => ({ ...f, schedule: { ...(f.schedule || {}), timezone: e.target.value } }))}
                      className="mt-1 w-full rounded border px-2.5 py-1.5 text-xs focus:outline-none"
                      style={{
                        borderColor: "var(--color-rule, #E8E8E8)",
                        background: "var(--color-paper-2, #ffffff)",
                        color: "var(--color-ink, #202C52)",
                      }}
                    />
                  </label>
                  <label className="block">
                    <span className="font-semibold" style={{ color: "var(--color-ink, #202C52)" }}>
                      Cancel pending send if event occurs
                    </span>
                    <input
                      type="text"
                      placeholder="e.g. invoice_paid"
                      value={form.schedule?.cancel_on_event || ""}
                      onChange={(e) => setForm((f) => ({ ...f, schedule: { ...(f.schedule || {}), cancel_on_event: e.target.value } }))}
                      className="mt-1 w-full rounded border px-2.5 py-1.5 text-xs font-mono focus:outline-none"
                      style={{
                        borderColor: "var(--color-rule, #E8E8E8)",
                        background: "var(--color-paper-2, #ffffff)",
                        color: "var(--color-ink, #202C52)",
                      }}
                    />
                  </label>
                  <label className="flex items-center gap-2 pt-4 font-semibold" style={{ color: "var(--color-ink, #202C52)" }}>
                    <input
                      type="checkbox"
                      checked={Boolean(form.schedule?.business_hours_only)}
                      onChange={(e) => setForm((f) => ({ ...f, schedule: { ...(f.schedule || {}), business_hours_only: e.target.checked } }))}
                      className="h-4 w-4 rounded text-slate-900"
                    />
                    Respect quiet / working hours only
                  </label>
                </div>

                <label className="flex items-center gap-2 pt-1 text-xs font-bold cursor-pointer" style={{ color: "var(--color-ink, #202C52)" }}>
                  <input
                    type="checkbox"
                    checked={Boolean(form.is_active)}
                    onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked ? 1 : 0 }))}
                    className="h-4 w-4 rounded text-slate-900"
                  />
                  Enable when saved
                </label>
              </section>
            </div>

            {/* Sticky footer */}
            <div
              className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-2 border-t px-5 py-3 backdrop-blur sm:px-6"
              style={{
                borderColor: "var(--color-rule, #E8E8E8)",
                background: "rgba(255, 255, 255, 0.95)",
              }}
            >
              <span className="text-xs" style={{ color: "var(--color-ink-2, #667085)" }}>
                {draftIssues.length ? `${draftIssues.length} item${draftIssues.length === 1 ? "" : "s"} to complete` : "All checks passed"}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeEditor}
                  disabled={savingRule}
                  className="rounded-lg border px-4 py-2 text-xs font-semibold shadow-xs hover:opacity-90"
                  style={{
                    borderColor: "var(--color-rule, #E8E8E8)",
                    background: "var(--color-paper-2, #ffffff)",
                    color: "var(--color-ink, #202C52)",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingRule || editorLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg px-5 py-2 text-xs font-semibold text-white shadow-xs hover:opacity-95 disabled:opacity-60"
                  style={{ background: "var(--color-ink, #202C52)" }}
                >
                  {savingRule ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
                  <span>{savingRule ? "Saving…" : editing ? "Save rule" : "Create rule"}</span>
                </button>
              </div>
            </div>
          </form>

          <AutomationDraftPreview
            form={form}
            conditions={conditions}
            options={menuOptions}
            templates={templates}
            flows={flows}
            groups={groups}
            issues={draftIssues}
            triggerLabel={triggerLabel}
          />
        </div>

        {editAutomation && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <AutomationRuleActivity id={editAutomation.id} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <WAWorkspaceGuide section="automations" />
      {/* ── TOP HEADER: Command Center Overview ── */}
      <div
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b"
        style={{ borderColor: "var(--color-rule, #E8E8E8)" }}
      >
        <div>
          <div className="flex items-center gap-2.5">
            <div
              className="w-10 h-10 rounded-xl text-white flex items-center justify-center shadow-xs shrink-0"
              style={{ background: "var(--color-ink, #202C52)" }}
            >
              <Zap className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1
                className="text-xl sm:text-2xl font-bold tracking-tight m-0"
                style={{ color: "var(--color-ink, #202C52)", fontFamily: "Poppins, sans-serif" }}
              >
                WhatsApp Automation Command Center
              </h1>
              <p className="text-xs sm:text-sm mt-1" style={{ color: "var(--color-ink-2, #667085)", margin: 0 }}>
                Unified orchestration for Event Automations, Workflow Pipelines, Flow Bots, Smart Reminders &amp; Billing.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => openCreate()}
            className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-xs transition hover:opacity-95"
            style={{ background: "var(--color-ink, #202C52)" }}
          >
            <Plus className="w-4 h-4" /> New Automation
          </button>

          <button
            type="button"
            onClick={() => setShowWebhookModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs sm:text-sm font-semibold shadow-xs transition hover:bg-slate-50"
            style={{
              background: "var(--color-paper-2, #ffffff)",
              borderColor: "var(--color-rule, #E8E8E8)",
              color: "var(--color-ink, #202C52)",
            }}
          >
            <Webhook className="w-4 h-4" />
            <span>External Webhooks</span>
          </button>

          <button
            type="button"
            onClick={handleBulkToggle}
            disabled={bulkToggling || automations.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs sm:text-sm font-semibold shadow-xs transition hover:bg-slate-50 disabled:opacity-50"
            style={{
              background: "var(--color-paper-2, #ffffff)",
              borderColor: "var(--color-rule, #E8E8E8)",
              color: "var(--color-ink, #202C52)",
            }}
          >
            {anyActive ? <ToggleRight className="w-4 h-4 text-emerald-600" /> : <ToggleLeft className="w-4 h-4 text-slate-400" />}
            <span>{anyActive ? "Pause All" : "Resume All"}</span>
          </button>

          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="rounded-xl border p-2 shadow-xs transition hover:bg-slate-50 disabled:opacity-50"
            style={{
              background: "var(--color-paper-2, #ffffff)",
              borderColor: "var(--color-rule, #E8E8E8)",
              color: "var(--color-ink, #202C52)",
            }}
            title="Refresh workspace data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-emerald-600" : ""}`} />
          </button>
        </div>
      </div>

      {pageNotice && (
        <div
          role="alert"
          className="flex items-center justify-between rounded-xl p-3.5 text-xs sm:text-sm border shadow-xs"
          style={{
            background: pageNotice.type === "error" ? "#FEF3F2" : "#ECFDF3",
            borderColor: pageNotice.type === "error" ? "#FECACA" : "#ABEFC6",
            color: pageNotice.type === "error" ? "#B42318" : "#067647",
          }}
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

      {Object.keys(sectionErrors).length > 0 && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3.5 text-xs shadow-xs"
          style={{
            background: "#FFFBEB",
            borderColor: "#FDE68A",
            color: "#92400E",
          }}
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Some sections failed to load ({Object.keys(sectionErrors).join(", ")}): {Object.values(sectionErrors)[0]}
            </span>
          </div>
          <button
            type="button"
            onClick={fetchData}
            className="rounded-lg border px-2.5 py-1 font-semibold transition hover:bg-amber-100"
            style={{
              background: "#ffffff",
              borderColor: "#F59E0B",
              color: "#92400E",
            }}
          >
            Retry failed sections
          </button>
        </div>
      )}

      {/* ── METRIC STAT CARDS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div
          className="rounded-2xl border p-4 shadow-xs transition-all"
          style={{
            background: "var(--color-paper-2, #ffffff)",
            borderColor: "var(--color-rule, #E8E8E8)",
          }}
        >
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-ink-2, #667085)" }}>Total Rules</span>
          <p className="mt-1 text-2xl font-bold font-mono" style={{ color: "var(--color-ink, #202C52)", fontFamily: "JetBrains Mono, monospace" }}>
            {stats.totalRules || automations.length}
          </p>
          <span className="text-[10px]" style={{ color: "var(--color-ink-2, #667085)" }}>{stats.activeRules || 0} active now</span>
        </div>

        <div
          className="rounded-2xl border p-4 shadow-xs transition-all"
          style={{
            background: "var(--color-paper-2, #ffffff)",
            borderColor: "var(--color-rule, #E8E8E8)",
          }}
        >
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-ink-2, #667085)" }}>Executions</span>
          <p className="mt-1 text-2xl font-bold font-mono" style={{ color: "var(--color-ink, #202C52)", fontFamily: "JetBrains Mono, monospace" }}>
            {stats.totalRuns || 0}
          </p>
          <span className="text-[10px] font-medium" style={{ color: "var(--color-success, #16803C)" }}>{stats.sentCount || 0} delivered</span>
        </div>

        <div
          className="rounded-2xl border p-4 shadow-xs transition-all"
          style={{
            background: "var(--color-paper-2, #ffffff)",
            borderColor: "var(--color-rule, #E8E8E8)",
          }}
        >
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-ink-2, #667085)" }}>Scheduled / Waiting</span>
          <p className="mt-1 text-2xl font-bold font-mono" style={{ color: "var(--color-accent-ink, #D97706)", fontFamily: "JetBrains Mono, monospace" }}>
            {stats.scheduledCount || 0}
          </p>
          <span className="text-[10px]" style={{ color: "var(--color-ink-2, #667085)" }}>Due queue</span>
        </div>

        <div
          className="rounded-2xl border p-4 shadow-xs transition-all"
          style={{
            background: "var(--color-paper-2, #ffffff)",
            borderColor: "var(--color-rule, #E8E8E8)",
          }}
        >
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-ink-2, #667085)" }}>Checkpoints</span>
          <p className="mt-1 text-2xl font-bold font-mono" style={{ color: "var(--color-info, #2563EB)", fontFamily: "JetBrains Mono, monospace" }}>
            {checkpoints.filter((c) => c.status === "waiting").length}
          </p>
          <span className="text-[10px]" style={{ color: "var(--color-ink-2, #667085)" }}>Pending answers</span>
        </div>

        <div
          className="rounded-2xl border p-4 shadow-xs transition-all"
          style={{
            background: "var(--color-paper-2, #ffffff)",
            borderColor: "var(--color-rule, #E8E8E8)",
          }}
        >
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-ink-2, #667085)" }}>Unpaid Invoices</span>
          <p className="mt-1 text-2xl font-bold font-mono" style={{ color: "#B42318", fontFamily: "JetBrains Mono, monospace" }}>
            {billingSummary.unpaidCount || 0}
          </p>
          <span className="text-[10px]" style={{ color: "var(--color-ink-2, #667085)" }}>Auto-recovery</span>
        </div>

        <div
          className="rounded-2xl border p-4 shadow-xs transition-all"
          style={{
            background: "var(--color-paper-2, #ffffff)",
            borderColor: "var(--color-rule, #E8E8E8)",
          }}
        >
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-ink-2, #667085)" }}>Delivery Health</span>
          <p className="mt-1 text-2xl font-bold font-mono" style={{ color: "var(--color-success, #16803C)", fontFamily: "JetBrains Mono, monospace" }}>
            {stats.totalRuns ? `${Math.round(((stats.sentCount || 0) / (stats.totalRuns || 1)) * 100)}%` : "100%"}
          </p>
          <span className="text-[10px]" style={{ color: "var(--color-ink-2, #667085)" }}>{stats.failedCount || 0} failures</span>
        </div>
      </div>

      {/* ── COMMAND CENTER NAVIGATION TABS ── */}
      <div
        className="flex items-center gap-1.5 overflow-x-auto border-b pb-2.5 text-xs sm:text-sm font-medium"
        style={{ borderColor: "var(--color-rule, #E8E8E8)" }}
      >
        {[
          { id: "rules", label: "Event Automations", icon: Zap, count: (Array.isArray(automations) ? automations : []).length },
          { id: "pipeline", label: "Workflow Pipelines", icon: GitBranch, count: (Array.isArray(automations) ? automations : []).filter((a) => a?.actions_json).length },
          { id: "reminders", label: "Smart Reminders", icon: Bell },
          { id: "checkpoints", label: "Conversation Checkpoints", icon: HelpCircle, count: (Array.isArray(checkpoints) ? checkpoints : []).filter((c) => c?.status === "waiting").length },
          { id: "billing", label: "Billing & Invoices", icon: CreditCard, count: billingSummary?.unpaidCount || (Array.isArray(billingSummary?.invoices) ? billingSummary.invoices.filter(i => String(i?.status).toLowerCase() !== "paid").length : 0) },
          { id: "welcome", label: "Welcome & Onboarding", icon: Users },
          { id: "starters", label: "Industry Blueprints", icon: Building2, count: (Array.isArray(starters) ? starters : []).length || 11 },
          { id: "logs", label: "Execution Diagnostics", icon: ListChecks, count: (Array.isArray(logs) ? logs : []).length },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 whitespace-nowrap text-xs sm:text-sm font-semibold transition-all ${
                isActive ? "shadow-xs" : "hover:bg-slate-100/60"
              }`}
              style={{
                background: isActive ? "var(--color-ink, #202C52)" : "transparent",
                color: isActive ? "#ffffff" : "var(--color-ink, #202C52)",
              }}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className="rounded-full px-1.5 py-0.2 text-[10px] font-bold font-mono"
                  style={{
                    background: isActive ? "var(--color-accent, #FCBD16)" : "rgba(32, 44, 82, 0.08)",
                    color: isActive ? "var(--color-accent-ink, #202C52)" : "var(--color-ink, #202C52)",
                  }}
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
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg border text-xs shadow-xs focus:outline-none"
                  style={{
                    borderColor: "var(--color-rule, #E8E8E8)",
                    background: "var(--color-paper-2, #ffffff)",
                    color: "var(--color-ink, #202C52)",
                  }}
                />
              </div>

              <select
                value={ruleStatus}
                onChange={(e) => setRuleStatus(e.target.value)}
                className="rounded-lg border px-2.5 py-1.5 text-xs shadow-xs focus:outline-none"
                style={{
                  borderColor: "var(--color-rule, #E8E8E8)",
                  background: "var(--color-paper-2, #ffffff)",
                  color: "var(--color-ink, #202C52)",
                }}
              >
                <option value="all">All Statuses</option>
                <option value="enabled">Active Only</option>
                <option value="paused">Paused Only</option>
              </select>

              <select
                value={ruleCategory}
                onChange={(e) => setRuleCategory(e.target.value)}
                className="rounded-lg border px-2.5 py-1.5 text-xs shadow-xs focus:outline-none"
                style={{
                  borderColor: "var(--color-rule, #E8E8E8)",
                  background: "var(--color-paper-2, #ffffff)",
                  color: "var(--color-ink, #202C52)",
                }}
              >
                <option value="all">All Categories</option>
                <option value="sales">Sales &amp; Leads</option>
                <option value="billing">Billing &amp; Invoices</option>
                <option value="support">Support &amp; Appointments</option>
                <option value="onboarding">Onboarding</option>
              </select>

              <select
                value={ruleTriggerFilter}
                onChange={(e) => setRuleTriggerFilter(e.target.value)}
                className="rounded-lg border px-2.5 py-1.5 text-xs shadow-xs focus:outline-none"
                style={{
                  borderColor: "var(--color-rule, #E8E8E8)",
                  background: "var(--color-paper-2, #ffffff)",
                  color: "var(--color-ink, #202C52)",
                }}
              >
                <option value="all">All Triggers</option>
                {TRIGGER_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>

              {branches.length > 0 && (
                <select
                  value={ruleBranchFilter}
                  onChange={(e) => setRuleBranchFilter(e.target.value)}
                  className="rounded-lg border px-2.5 py-1.5 text-xs shadow-xs focus:outline-none"
                  style={{
                    borderColor: "var(--color-rule, #E8E8E8)",
                    background: "var(--color-paper-2, #ffffff)",
                    color: "var(--color-ink, #202C52)",
                  }}
                >
                  <option value="all">All Branches</option>
                  {branches.map((br) => (
                    <option key={br.id} value={br.id}>{br.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExportSelected}
                disabled={safeAutomations.length === 0}
                className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold shadow-xs hover:opacity-90 disabled:opacity-50"
                style={{
                  borderColor: "var(--color-rule, #E8E8E8)",
                  background: "var(--color-paper-2, #ffffff)",
                  color: "var(--color-ink, #202C52)",
                }}
              >
                Export JSON
              </button>
              <button
                type="button"
                onClick={handleSeedPrebuilt}
                disabled={seeding}
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-xs hover:opacity-90 transition"
                style={{
                  borderColor: "var(--color-rule, #E8E8E8)",
                  background: "var(--color-paper-2, #ffffff)",
                  color: "var(--color-ink, #202C52)",
                }}
              >
                <Building2 className="w-3.5 h-3.5" style={{ color: "var(--color-ink-2, #667085)" }} />
                <span>{seeding ? "Installing…" : "Install All Industry Blueprints"}</span>
              </button>
            </div>
          </div>

          {selectedRuleIds.length > 0 && (
            <div
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3.5 py-2 text-xs text-white"
              style={{
                background: "var(--color-ink, #202C52)",
                borderColor: "rgba(255,255,255,0.15)",
              }}
            >
              <span className="font-semibold">{selectedRuleIds.length} rule(s) selected</span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button type="button" disabled={bulkToggling} onClick={() => handleBulkSelection("activate")} className="rounded bg-emerald-600 px-2.5 py-1 font-semibold hover:bg-emerald-500">Activate</button>
                <button type="button" disabled={bulkToggling} onClick={() => handleBulkSelection("pause")} className="rounded bg-amber-600 px-2.5 py-1 font-semibold hover:bg-amber-500">Pause</button>
                <button type="button" disabled={bulkToggling} onClick={() => handleBulkSelection("duplicate")} className="rounded bg-slate-700 px-2.5 py-1 font-semibold hover:bg-slate-600">Duplicate</button>
                <button type="button" disabled={bulkToggling} onClick={() => handleBulkSelection("delete")} className="rounded bg-rose-600 px-2.5 py-1 font-semibold hover:bg-rose-500">Delete</button>
                <button type="button" onClick={() => setSelectedRuleIds([])} className="rounded px-2 py-1 text-slate-300 hover:text-white">Clear</button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--color-ink-2, #667085)" }} />
            </div>
          ) : filteredAutomations.length === 0 ? (
            <div
              className="rounded-2xl border border-dashed p-12 text-center"
              style={{
                background: "var(--color-paper-2, #ffffff)",
                borderColor: "var(--color-rule, #E8E8E8)",
              }}
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
                style={{ background: "var(--color-surface, #F5F5F5)" }}
              >
                <Zap className="w-6 h-6" style={{ color: "var(--color-ink-2, #667085)" }} />
              </div>
              <h3
                className="text-base font-semibold m-0"
                style={{ color: "var(--color-ink, #202C52)", fontFamily: "Poppins, sans-serif" }}
              >
                No automation rules found
              </h3>
              <p className="text-xs mt-1 max-w-sm mx-auto" style={{ color: "var(--color-ink-2, #667085)" }}>
                Create a customized trigger rule or install industry starter blueprints to get started.
              </p>
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => openCreate()}
                  className="rounded-lg px-4 py-2 text-xs font-semibold text-white shadow-xs hover:opacity-95"
                  style={{ background: "var(--color-ink, #202C52)" }}
                >
                  Create Rule
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("starters")}
                  className="rounded-lg border px-4 py-2 text-xs font-semibold shadow-xs hover:opacity-95"
                  style={{
                    borderColor: "var(--color-rule, #E8E8E8)",
                    background: "var(--color-paper-2, #ffffff)",
                    color: "var(--color-ink, #202C52)",
                  }}
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
                    className="flex flex-col justify-between rounded-xl border p-4 shadow-2xs hover:shadow-xs transition"
                    style={{
                      background: "var(--color-paper-2, #ffffff)",
                      borderColor: "var(--color-rule, #E8E8E8)",
                    }}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            aria-label={`Select ${a.name}`}
                            checked={selectedRuleIds.includes(a.id)}
                            onChange={() => toggleRuleSelection(a.id)}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900"
                          />
                          <span className="text-lg">{trig?.emoji || "⚡"}</span>
                          <div>
                            <span
                              className="text-[10px] font-bold uppercase tracking-wider block"
                              style={{ color: "var(--color-ink-2, #667085)" }}
                            >
                              {a.trigger_label || a.trigger_type}
                            </span>
                            <h3
                              className="text-sm font-semibold line-clamp-1 m-0"
                              style={{ color: "var(--color-ink, #202C52)", fontFamily: "Poppins, sans-serif" }}
                            >
                              {a.name}
                            </h3>
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

                      <div className="mt-3 space-y-1.5 text-xs">
                        {hasPipeline ? (
                          <div
                            className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold"
                            style={{
                              background: "rgba(32, 44, 82, 0.08)",
                              color: "var(--color-ink, #202C52)",
                            }}
                          >
                            <GitBranch className="w-3.5 h-3.5" /> Multi-Step Workflow Pipeline
                          </div>
                        ) : (
                          <p className="line-clamp-2 italic m-0" style={{ color: "var(--color-ink-2, #667085)" }}>
                            "{a.template_name ? `Template: ${a.template_name}` : a.message_text || "No message content"}"
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]" style={{ color: "var(--color-ink-2, #667085)" }}>
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
                          {a.branch_name && (
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3 h-3" /> {a.branch_name}
                            </span>
                          )}
                          {a.created_by_name && (
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" /> {a.created_by_name}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Play className="w-3 h-3 text-slate-400" /> {a.run_count || 0} runs
                            {Number(a.failed_runs_count) > 0 && <span className="text-rose-600 font-semibold">· {a.failed_runs_count} fail</span>}
                          </span>
                          {Number(a.credits_consumed) > 0 && (
                            <span className="flex items-center gap-1 text-amber-700 font-semibold font-mono">
                              <CreditCard className="w-3 h-3" /> {a.credits_consumed} cr
                            </span>
                          )}
                          {a.published_version_id && (
                            <span
                              className="rounded px-1.5 py-0.5 text-[10px] font-mono"
                              style={{ background: "var(--color-surface, #F5F5F5)", color: "var(--color-ink, #202C52)" }}
                            >
                              v{a.revision || 1}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div
                      className="mt-4 flex items-center justify-between border-t pt-3"
                      style={{ borderColor: "var(--color-rule, #E8E8E8)" }}
                    >
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setTestModal(a);
                            setTestResult(null);
                          }}
                          className="rounded-md border px-2.5 py-1 text-xs font-semibold shadow-2xs hover:opacity-90 transition"
                          style={{
                            borderColor: "var(--color-rule, #E8E8E8)",
                            background: "var(--color-paper-2, #ffffff)",
                            color: "var(--color-ink, #202C52)",
                          }}
                        >
                          Simulate
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(a)}
                          className="rounded-md border px-2.5 py-1 text-xs font-semibold shadow-2xs hover:opacity-90 transition"
                          style={{
                            borderColor: "var(--color-rule, #E8E8E8)",
                            background: "var(--color-paper-2, #ffffff)",
                            color: "var(--color-ink, #202C52)",
                          }}
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
          <div
            className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b"
            style={{ borderColor: "var(--color-rule, #E8E8E8)" }}
          >
            <div>
              <h2
                className="text-base font-bold m-0"
                style={{ color: "var(--color-ink, #202C52)", fontFamily: "Poppins, sans-serif" }}
              >
                Multi-Step Automation Pipelines
              </h2>
              <p className="text-xs mt-1" style={{ color: "var(--color-ink-2, #667085)" }}>
                Connect triggers, condition gates, document delivery, Flow Bots, customer questioning, and CRM updates in a single durable pipeline.
              </p>
            </div>
            <button
              type="button"
              onClick={() => openCreate({ form: { mode: "pipeline", name: "Custom Workflow Pipeline" } })}
              className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:opacity-95"
              style={{ background: "var(--color-ink, #202C52)" }}
            >
              <Plus className="w-4 h-4" /> Create Workflow Pipeline
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {automations.filter((a) => a.actions_json).length === 0 ? (
              <div
                className="rounded-xl border border-dashed p-8 text-center"
                style={{
                  background: "var(--color-paper-2, #ffffff)",
                  borderColor: "var(--color-rule, #E8E8E8)",
                }}
              >
                <GitBranch className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--color-ink-2, #667085)" }} />
                <h3
                  className="text-sm font-semibold m-0"
                  style={{ color: "var(--color-ink, #202C52)", fontFamily: "Poppins, sans-serif" }}
                >
                  No multi-step pipelines created yet
                </h3>
                <p className="text-xs mt-1 max-w-md mx-auto" style={{ color: "var(--color-ink-2, #667085)" }}>
                  Multi-step pipelines allow chaining templates, bills, Flow Bots, question checkpoints, and CRM actions.
                </p>
                <button
                  type="button"
                  onClick={() => openCreate({ form: { mode: "pipeline", name: "Custom Workflow Pipeline" } })}
                  className="mt-3 rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:opacity-95"
                  style={{ background: "var(--color-ink, #202C52)" }}
                >
                  Build First Pipeline
                </button>
              </div>
            ) : (
              (Array.isArray(automations) ? automations : [])
                .filter((a) => a && a.actions_json)
                .map((a) => {
                  let acts = [];
                  try {
                    acts = typeof a.actions_json === "string" ? JSON.parse(a.actions_json) : (Array.isArray(a.actions_json) ? a.actions_json : []);
                  } catch (_) { acts = []; }
                  if (!Array.isArray(acts)) acts = [];

                  return (
                    <div
                      key={a.id}
                      className="rounded-xl border p-5 shadow-xs"
                      style={{
                        background: "var(--color-paper-2, #ffffff)",
                        borderColor: "var(--color-rule, #E8E8E8)",
                      }}
                    >
                      <div
                        className="flex items-center justify-between pb-3 border-b"
                        style={{ borderColor: "var(--color-rule, #E8E8E8)" }}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="rounded-lg p-2 font-bold text-xs"
                            style={{ background: "var(--color-surface, #F5F5F5)", color: "var(--color-ink, #202C52)" }}
                          >
                            {a.trigger_label}
                          </span>
                          <div>
                            <h3
                              className="text-sm font-bold m-0"
                              style={{ color: "var(--color-ink, #202C52)", fontFamily: "Poppins, sans-serif" }}
                            >
                              {a.name}
                            </h3>
                            <span className="text-[11px]" style={{ color: "var(--color-ink-2, #667085)" }}>
                              {acts.length} pipeline step(s)
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(a)}
                            className="rounded-md border px-2.5 py-1 text-xs font-semibold shadow-2xs hover:opacity-90"
                            style={{
                              borderColor: "var(--color-rule, #E8E8E8)",
                              background: "var(--color-paper-2, #ffffff)",
                              color: "var(--color-ink, #202C52)",
                            }}
                          >
                            Edit Pipeline
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggle(a)}
                            className="text-xs font-semibold"
                          >
                            {a.is_active ? (
                              <span className="text-emerald-600 font-semibold">Active</span>
                            ) : (
                              <span style={{ color: "var(--color-ink-2, #667085)" }}>Paused</span>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Visual Flow Steps */}
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <div
                          className="rounded-lg border px-3 py-2 text-xs"
                          style={{
                            background: "var(--color-surface, #F5F5F5)",
                            borderColor: "var(--color-rule, #E8E8E8)",
                          }}
                        >
                          <span className="font-semibold" style={{ color: "var(--color-ink, #202C52)" }}>Trigger:</span>{" "}
                          <span style={{ color: "var(--color-ink-2, #667085)" }}>{a.trigger_label}</span>
                        </div>
                        <ArrowRight className="w-4 h-4 shrink-0" style={{ color: "var(--color-ink-2, #667085)" }} />

                        {acts.map((act, idx) => (
                          <React.Fragment key={idx}>
                            <div
                              className="rounded-lg border px-3 py-2 text-xs shadow-2xs"
                              style={{
                                background: "var(--color-paper-2, #ffffff)",
                                borderColor: "var(--color-rule, #E8E8E8)",
                              }}
                            >
                              <span className="font-bold" style={{ color: "var(--color-ink, #202C52)" }}>Step {idx + 1}:</span>{" "}
                              <span style={{ color: "var(--color-ink, #202C52)" }}>{act.title || act.type}</span>
                            </div>
                            {idx < acts.length - 1 && (
                              <ArrowRight className="w-4 h-4 shrink-0" style={{ color: "var(--color-ink-2, #667085)" }} />
                            )}
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
          <div
            className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b"
            style={{ borderColor: "var(--color-rule, #E8E8E8)" }}
          >
            <div>
              <h2
                className="text-base font-bold m-0"
                style={{ color: "var(--color-ink, #202C52)", fontFamily: "Poppins, sans-serif" }}
              >
                Durable Conversational Checkpoints
              </h2>
              <p className="text-xs mt-1" style={{ color: "var(--color-ink-2, #667085)" }}>
                In-flight customer questions awaiting answers. Persisted across server restarts and correlated with incoming WhatsApp replies.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchData}
              className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold shadow-2xs hover:opacity-90"
              style={{
                borderColor: "var(--color-rule, #E8E8E8)",
                background: "var(--color-paper-2, #ffffff)",
                color: "var(--color-ink, #202C52)",
              }}
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh Checkpoints
            </button>
          </div>

          {checkpoints.length === 0 ? (
            <div
              className="rounded-xl border border-dashed p-8 text-center text-xs"
              style={{
                background: "var(--color-paper-2, #ffffff)",
                borderColor: "var(--color-rule, #E8E8E8)",
                color: "var(--color-ink-2, #667085)",
              }}
            >
              No conversational checkpoints waiting. When a rule executes "Ask Customer Question", pending responses appear here.
            </div>
          ) : (
            <div
              className="rounded-xl border overflow-hidden shadow-xs"
              style={{
                background: "var(--color-paper-2, #ffffff)",
                borderColor: "var(--color-rule, #E8E8E8)",
              }}
            >
              <table className="w-full text-left text-xs">
                <thead
                  className="border-b font-semibold"
                  style={{
                    background: "var(--color-surface, #F5F5F5)",
                    borderColor: "var(--color-rule, #E8E8E8)",
                    color: "var(--color-ink, #202C52)",
                  }}
                >
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
                <tbody className="divide-y text-slate-800" style={{ borderColor: "var(--color-rule, #E8E8E8)" }}>
                  {(Array.isArray(checkpoints) ? checkpoints : []).map((chk) => {
                    const qCtx = typeof chk?.question_context === "string" ? (() => { try { return JSON.parse(chk.question_context); } catch(_) { return {}; } })() : (chk?.question_context || {});
                    const cAns = typeof chk?.collected_answers === "string" ? (() => { try { return JSON.parse(chk.collected_answers); } catch(_) { return {}; } })() : (chk?.collected_answers || {});

                    return (
                    <tr key={chk.id} className="hover:bg-slate-50/50">
                      <td className="p-3 font-mono font-medium" style={{ color: "var(--color-ink, #202C52)" }}>+{chk.phone}</td>
                      <td className="p-3">
                        <span className="font-semibold" style={{ color: "var(--color-ink, #202C52)" }}>{chk.automation_name || `Rule #${chk.automation_id}`}</span>
                        <span className="block text-[10px]" style={{ color: "var(--color-ink-2, #667085)" }}>Step {chk.current_step || 1}</span>
                      </td>
                      <td className="p-3">
                        <span
                          className="rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase"
                          style={{ background: "var(--color-surface, #F5F5F5)", color: "var(--color-ink, #202C52)" }}
                        >
                          {chk.expected_type || "text"}
                        </span>
                      </td>
                      <td className="p-3 max-w-[220px] truncate" title={qCtx?.question_text || chk.question_text}>
                        {qCtx?.question_text || chk.question_text || "-"}
                      </td>
                      <td className="p-3">
                        {cAns && Object.keys(cAns).length > 0 ? (
                          <span className="font-mono text-[11px]" style={{ color: "var(--color-ink-2, #667085)" }}>
                            {JSON.stringify(cAns)}
                          </span>
                        ) : (
                          <span style={{ color: "var(--color-ink-2, #667085)" }}>None yet</span>
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
                    );
                  })}
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
          <div
            className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b"
            style={{ borderColor: "var(--color-rule, #E8E8E8)" }}
          >
            <div>
              <h2
                className="text-base font-bold m-0"
                style={{ color: "var(--color-ink, #202C52)", fontFamily: "Poppins, sans-serif" }}
              >
                CRM Billing &amp; Invoice Automations
              </h2>
              <p className="text-xs mt-1" style={{ color: "var(--color-ink-2, #667085)" }}>
                Automate invoice PDF delivery, payment links, verified receipts, and overdue balance recovery via WhatsApp.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                openCreate({
                  form: {
                    name: "Instant Invoice PDF Notice & Payment Link",
                    trigger_type: "invoice_created",
                    category: "billing",
                    message_text: PRESET_MESSAGES.invoice_created,
                  },
                })
              }
              className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:opacity-95"
              style={{ background: "var(--color-ink, #202C52)" }}
            >
              <Plus className="w-4 h-4" /> New Billing Automation
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              className="rounded-xl border p-4 shadow-2xs hover:shadow-xs transition"
              style={{
                background: "var(--color-paper-2, #ffffff)",
                borderColor: "var(--color-rule, #E8E8E8)",
              }}
            >
              <span
                className="text-xs font-bold uppercase tracking-wider block"
                style={{ color: "var(--color-ink-2, #667085)" }}
              >
                Invoice PDF Delivery
              </span>
              <p
                className="mt-1 text-sm font-semibold m-0"
                style={{ color: "var(--color-ink, #202C52)", fontFamily: "Poppins, sans-serif" }}
              >
                Send Invoice on Generation
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--color-ink-2, #667085)" }}>
                Automatically dispatches generated CRM invoices to clients with interactive payment buttons.
              </p>
              <button
                type="button"
                onClick={() => {
                  const starter = starters.find((s) => s.trigger_type === "invoice_created");
                  if (starter) adoptStarter(starter);
                }}
                className="mt-3 rounded-md border px-2.5 py-1 text-xs font-semibold shadow-2xs hover:opacity-90"
                style={{
                  borderColor: "var(--color-rule, #E8E8E8)",
                  background: "var(--color-paper-2, #ffffff)",
                  color: "var(--color-ink, #202C52)",
                }}
              >
                Configure Action
              </button>
            </div>

            <div
              className="rounded-xl border p-4 shadow-2xs hover:shadow-xs transition"
              style={{
                background: "var(--color-paper-2, #ffffff)",
                borderColor: "var(--color-rule, #E8E8E8)",
              }}
            >
              <span
                className="text-xs font-bold uppercase tracking-wider block"
                style={{ color: "var(--color-ink-2, #667085)" }}
              >
                Payment Due Reminder
              </span>
              <p
                className="mt-1 text-sm font-semibold m-0"
                style={{ color: "var(--color-ink, #202C52)", fontFamily: "Poppins, sans-serif" }}
              >
                1-3 Days Prior Due Date
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--color-ink-2, #667085)" }}>
                Sends automated payment reminder with direct payment link; automatically cancels if invoice is paid.
              </p>
              <button
                type="button"
                onClick={() => {
                  const starter = starters.find((s) => s.trigger_type === "payment_due");
                  if (starter) adoptStarter(starter);
                }}
                className="mt-3 rounded-md border px-2.5 py-1 text-xs font-semibold shadow-2xs hover:opacity-90"
                style={{
                  borderColor: "var(--color-rule, #E8E8E8)",
                  background: "var(--color-paper-2, #ffffff)",
                  color: "var(--color-ink, #202C52)",
                }}
              >
                Configure Action
              </button>
            </div>

            <div
              className="rounded-xl border p-4 shadow-2xs hover:shadow-xs transition"
              style={{
                background: "var(--color-paper-2, #ffffff)",
                borderColor: "var(--color-rule, #E8E8E8)",
              }}
            >
              <span
                className="text-xs font-bold uppercase tracking-wider block"
                style={{ color: "var(--color-ink-2, #667085)" }}
              >
                Verified Settlement
              </span>
              <p
                className="mt-1 text-sm font-semibold m-0"
                style={{ color: "var(--color-ink, #202C52)", fontFamily: "Poppins, sans-serif" }}
              >
                Payment Receipt Acknowledgement
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--color-ink-2, #667085)" }}>
                Instantly issues an official verified receipt via WhatsApp once webhook or accounts confirms payment.
              </p>
              <button
                type="button"
                onClick={() => {
                  const starter = starters.find((s) => s.trigger_type === "payment_received");
                  if (starter) adoptStarter(starter);
                }}
                className="mt-3 rounded-md border px-2.5 py-1 text-xs font-semibold shadow-2xs hover:opacity-90"
                style={{
                  borderColor: "var(--color-rule, #E8E8E8)",
                  background: "var(--color-paper-2, #ffffff)",
                  color: "var(--color-ink, #202C52)",
                }}
              >
                Configure Action
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <h3
              className="text-sm font-bold m-0"
              style={{ color: "var(--color-ink, #202C52)", fontFamily: "Poppins, sans-serif" }}
            >
              Tracked CRM Invoices ({(Array.isArray(billingSummary?.invoices) ? billingSummary.invoices : []).length})
            </h3>
            {(Array.isArray(billingSummary?.invoices) ? billingSummary.invoices : []).length === 0 ? (
              <p className="text-xs italic" style={{ color: "var(--color-ink-2, #667085)" }}>No invoices recorded yet in CRM.</p>
            ) : (
              <div
                className="rounded-xl border overflow-hidden shadow-xs"
                style={{
                  background: "var(--color-paper-2, #ffffff)",
                  borderColor: "var(--color-rule, #E8E8E8)",
                }}
              >
                <table className="w-full text-left text-xs">
                  <thead
                    className="border-b font-semibold"
                    style={{
                      background: "var(--color-surface, #F5F5F5)",
                      borderColor: "var(--color-rule, #E8E8E8)",
                      color: "var(--color-ink, #202C52)",
                    }}
                  >
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
                  <tbody className="divide-y text-slate-800" style={{ borderColor: "var(--color-rule, #E8E8E8)" }}>
                    {(Array.isArray(billingSummary?.invoices) ? billingSummary.invoices : []).slice(0, 15).map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-mono font-medium" style={{ color: "var(--color-ink, #202C52)" }}>{inv.invoice_no || `INV-${inv.id}`}</td>
                        <td className="p-3 font-semibold" style={{ color: "var(--color-ink, #202C52)" }}>{inv.client_company || inv.client_name || "-"}</td>
                        <td className="p-3 font-mono" style={{ color: "var(--color-ink-2, #667085)" }}>{inv.client_phone || "-"}</td>
                        <td className="p-3 font-bold font-mono" style={{ color: "var(--color-ink, #202C52)" }}>₹{inv.total_amount ?? inv.grand_total ?? "0"}</td>
                        <td className="p-3" style={{ color: "var(--color-ink-2, #667085)" }}>{inv.due_date || "-"}</td>
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
                            className="rounded-md border px-2 py-1 text-[11px] font-semibold shadow-2xs hover:opacity-90"
                            style={{
                              borderColor: "var(--color-rule, #E8E8E8)",
                              background: "var(--color-paper-2, #ffffff)",
                              color: "var(--color-ink, #202C52)",
                            }}
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
        <div
          className="rounded-xl border p-6 shadow-xs space-y-6 max-w-3xl"
          style={{
            background: "var(--color-paper-2, #ffffff)",
            borderColor: "var(--color-rule, #E8E8E8)",
          }}
        >
          <div
            className="flex items-center justify-between pb-4 border-b"
            style={{ borderColor: "var(--color-rule, #E8E8E8)" }}
          >
            <div>
              <h2
                className="text-base font-bold m-0"
                style={{ color: "var(--color-ink, #202C52)", fontFamily: "Poppins, sans-serif" }}
              >
                Welcome Auto-Reply &amp; Cooldown
              </h2>
              <p className="text-xs mt-1" style={{ color: "var(--color-ink-2, #667085)" }}>
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
              <span className="text-xs font-bold" style={{ color: "var(--color-ink, #202C52)" }}>Enable Auto-Reply</span>
            </label>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold block mb-1" style={{ color: "var(--color-ink, #202C52)" }}>
                Greeting Message Text
              </label>
              <textarea
                rows={4}
                value={welcomeSettings.welcome_text || ""}
                onChange={(e) => setWelcomeSettings((w) => ({ ...w, welcome_text: e.target.value }))}
                className="w-full rounded-lg border p-3 text-xs shadow-xs focus:outline-none"
                style={{
                  borderColor: "var(--color-rule, #E8E8E8)",
                  background: "var(--color-paper-2, #ffffff)",
                  color: "var(--color-ink, #202C52)",
                }}
                placeholder="Hello {name}! Welcome to {company}..."
              />
              <span className="text-[11px] mt-1 block" style={{ color: "var(--color-ink-2, #667085)" }}>
                Supports placeholders: <code>{"{name}"}</code>, <code>{"{company}"}</code>, <code>{"{greeting_time}"}</code>.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: "var(--color-ink, #202C52)" }}>
                  Cooldown Duration (Hours)
                </label>
                <input
                  type="number"
                  min="1"
                  max="720"
                  value={welcomeSettings.cooldown_hours || 24}
                  onChange={(e) => setWelcomeSettings((w) => ({ ...w, cooldown_hours: parseInt(e.target.value, 10) }))}
                  className="w-full rounded-lg border px-3 py-2 text-xs shadow-xs focus:outline-none"
                  style={{
                    borderColor: "var(--color-rule, #E8E8E8)",
                    background: "var(--color-paper-2, #ffffff)",
                    color: "var(--color-ink, #202C52)",
                  }}
                />
                <span className="text-[10px]" style={{ color: "var(--color-ink-2, #667085)" }}>
                  Wait this long before greeting the same phone number again.
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: "var(--color-ink, #202C52)" }}>
                  Working Hours Only
                </label>
                <select
                  value={welcomeSettings.working_hours_only ? "1" : "0"}
                  onChange={(e) => setWelcomeSettings((w) => ({ ...w, working_hours_only: e.target.value === "1" ? 1 : 0 }))}
                  className="w-full rounded-lg border px-3 py-2 text-xs shadow-xs focus:outline-none"
                  style={{
                    borderColor: "var(--color-rule, #E8E8E8)",
                    background: "var(--color-paper-2, #ffffff)",
                    color: "var(--color-ink, #202C52)",
                  }}
                >
                  <option value="0">24/7 (Always Send)</option>
                  <option value="1">Business Hours Only (09:00 - 21:00 IST)</option>
                </select>
              </div>
            </div>

            <div
              className="pt-3 flex items-center justify-between border-t"
              style={{ borderColor: "var(--color-rule, #E8E8E8)" }}
            >
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
                className="rounded-lg px-4 py-2 text-xs font-semibold text-white shadow-xs hover:opacity-95"
                style={{ background: "var(--color-ink, #202C52)" }}
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
          <div
            className="pb-3 border-b"
            style={{ borderColor: "var(--color-rule, #E8E8E8)" }}
          >
            <h2
              className="text-base font-bold m-0"
              style={{ color: "var(--color-ink, #202C52)", fontFamily: "Poppins, sans-serif" }}
            >
              Industry Automation Starter Blueprints
            </h2>
            <p className="text-xs mt-1" style={{ color: "var(--color-ink-2, #667085)" }}>
              Pre-configured, production-ready workflows built for hospitals, real estate, education, restaurants, SaaS, and service businesses.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(Array.isArray(starters) ? starters : []).map((starter, idx) => (
              <div
                key={starter.name || idx}
                className="flex flex-col justify-between rounded-xl border p-5 shadow-2xs hover:shadow-xs transition"
                style={{
                  background: "var(--color-paper-2, #ffffff)",
                  borderColor: "var(--color-rule, #E8E8E8)",
                }}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded-md px-2 py-0.5 text-xs font-bold"
                      style={{ background: "var(--color-surface, #F5F5F5)", color: "var(--color-ink, #202C52)" }}
                    >
                      {starter?.category ? starter.category.toUpperCase() : "BLUEPRINT"}
                    </span>
                    <span className="text-[10px] font-mono" style={{ color: "var(--color-ink-2, #667085)" }}>
                      {starter?.trigger_type}
                    </span>
                  </div>

                  <h3
                    className="mt-2 text-sm font-bold m-0"
                    style={{ color: "var(--color-ink, #202C52)", fontFamily: "Poppins, sans-serif" }}
                  >
                    {starter?.name}
                  </h3>
                  <p className="mt-1 text-xs line-clamp-3 italic" style={{ color: "var(--color-ink-2, #667085)" }}>
                    "{starter?.message_text}"
                  </p>

                  {starter?.actions_json && (
                    <div
                      className="mt-2 text-[11px] font-semibold flex items-center gap-1"
                      style={{ color: "var(--color-ink, #202C52)" }}
                    >
                      ⚡ Includes multi-step question/bill pipeline
                    </div>
                  )}
                </div>

                <div
                  className="mt-4 pt-3 border-t"
                  style={{ borderColor: "var(--color-rule, #E8E8E8)" }}
                >
                  <button
                    type="button"
                    onClick={() => adoptStarter(starter)}
                    className="w-full rounded-lg py-1.5 text-xs font-semibold text-white shadow-xs hover:opacity-95 transition"
                    style={{ background: "var(--color-ink, #202C52)" }}
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
          <div
            className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b"
            style={{ borderColor: "var(--color-rule, #E8E8E8)" }}
          >
            <div>
              <h2
                className="text-base font-bold m-0"
                style={{ color: "var(--color-ink, #202C52)", fontFamily: "Poppins, sans-serif" }}
              >
                Execution Timeline &amp; Diagnostics
              </h2>
              <p className="text-xs mt-1" style={{ color: "var(--color-ink-2, #667085)" }}>
                Detailed audit trail of all evaluated triggers, condition outcomes, and Meta delivery statuses.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchData}
              className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold shadow-2xs hover:opacity-90"
              style={{
                borderColor: "var(--color-rule, #E8E8E8)",
                background: "var(--color-paper-2, #ffffff)",
                color: "var(--color-ink, #202C52)",
              }}
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh Logs
            </button>
          </div>

          {(Array.isArray(logs) ? logs : []).length === 0 ? (
            <div
              className="rounded-xl border border-dashed p-8 text-center text-xs"
              style={{
                background: "var(--color-paper-2, #ffffff)",
                borderColor: "var(--color-rule, #E8E8E8)",
                color: "var(--color-ink-2, #667085)",
              }}
            >
              No executions logged yet. When events trigger automations, their execution records and diagnostics will appear here.
            </div>
          ) : (
            <div
              className="rounded-xl border overflow-hidden shadow-xs"
              style={{
                background: "var(--color-paper-2, #ffffff)",
                borderColor: "var(--color-rule, #E8E8E8)",
              }}
            >
              <table className="w-full text-left text-xs">
                <thead
                  className="border-b font-semibold"
                  style={{
                    background: "var(--color-surface, #F5F5F5)",
                    borderColor: "var(--color-rule, #E8E8E8)",
                    color: "var(--color-ink, #202C52)",
                  }}
                >
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
                <tbody className="divide-y text-slate-800" style={{ borderColor: "var(--color-rule, #E8E8E8)" }}>
                  {(Array.isArray(logs) ? logs : []).map((log) => {
                    const isExpanded = expandedLogId === log.id;
                    const diags = Array.isArray(log?.diagnostics)
                      ? log.diagnostics
                      : typeof log?.diagnostics === "string"
                      ? (() => { try { const p = JSON.parse(log.diagnostics); return Array.isArray(p) ? p : []; } catch(_) { return []; } })()
                      : typeof log?.diagnostics_json === "string"
                      ? (() => { try { const p = JSON.parse(log.diagnostics_json); return Array.isArray(p) ? p : []; } catch(_) { return []; } })()
                      : [];
                    const hasDiag = diags.length > 0;

                    return (
                      <React.Fragment key={log.id}>
                        <tr className="hover:bg-slate-50/50">
                          <td className="p-3 font-mono font-bold" style={{ color: "var(--color-ink, #202C52)" }}>#{log.id}</td>
                          <td className="p-3">
                            <span className="font-semibold" style={{ color: "var(--color-ink, #202C52)" }}>{log.automation_name || `Rule #${log.automation_id}`}</span>
                            <span className="block text-[10px]" style={{ color: "var(--color-ink-2, #667085)" }}>{log.trigger_type}</span>
                          </td>
                          <td className="p-3 font-mono" style={{ color: "var(--color-ink-2, #667085)" }}>+{log.phone}</td>
                          <td className="p-3" style={{ color: "var(--color-ink, #202C52)" }}>{log.contact_name || "-"}</td>
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
                          <td className="p-3 font-mono text-[11px] max-w-[140px] truncate" style={{ color: "var(--color-ink-2, #667085)" }}>
                            {log.wa_message_id || "-"}
                          </td>
                          <td className="p-3 text-[11px]" style={{ color: "var(--color-ink-2, #667085)" }}>
                            {log.status === "scheduled"
                              ? `Due: ${new Date(log.scheduled_for).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                              : log.sent_at
                              ? new Date(log.sent_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                              : "-"}
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
                                  className="rounded px-2 py-1 text-[11px] font-semibold border shadow-2xs hover:opacity-90"
                                  style={{
                                    borderColor: "var(--color-rule, #E8E8E8)",
                                    background: "var(--color-paper-2, #ffffff)",
                                    color: "var(--color-ink, #202C52)",
                                  }}
                                >
                                  {isExpanded ? "Hide" : "Details"}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {isExpanded && hasDiag && (
                          <tr style={{ background: "var(--color-surface, #F5F5F5)" }}>
                            <td colSpan={8} className="p-3 border-t" style={{ borderColor: "var(--color-rule, #E8E8E8)" }}>
                              <div className="space-y-1.5 text-xs">
                                <span className="font-semibold block" style={{ color: "var(--color-ink, #202C52)" }}>
                                  Condition Diagnostics Evaluation:
                                </span>
                                <div className="space-y-1 max-h-40 overflow-y-auto">
                                  {diags.map((d, dIdx) => (
                                    <div
                                      key={dIdx}
                                      className={`flex items-center justify-between rounded p-1.5 font-mono text-[11px] ${
                                        d.passed ? "bg-emerald-50 text-emerald-900 border border-emerald-200" : "bg-rose-50 text-rose-900 border border-rose-200"
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
      {/* SIMULATOR MODAL                                               */}
      {/* ───────────────────────────────────────────────────────────── */}
      {testModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3"
          onClick={() => setTestModal(null)}
        >
          <div
            className="rounded-2xl border w-full max-w-lg p-6 shadow-xl space-y-4"
            style={{
              background: "var(--color-paper-2, #ffffff)",
              borderColor: "var(--color-rule, #E8E8E8)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between pb-3 border-b"
              style={{ borderColor: "var(--color-rule, #E8E8E8)" }}
            >
              <div>
                <h3
                  className="text-base font-bold m-0"
                  style={{ color: "var(--color-ink, #202C52)", fontFamily: "Poppins, sans-serif" }}
                >
                  Simulate Rule Execution
                </h3>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-ink-2, #667085)" }}>{testModal.name}</p>
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
                <label className="text-xs font-semibold block mb-1" style={{ color: "var(--color-ink, #202C52)" }}>
                  Test Recipient Phone
                </label>
                <input
                  type="text"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full rounded-lg border px-3 py-2 text-xs shadow-xs focus:outline-none"
                  style={{
                    borderColor: "var(--color-rule, #E8E8E8)",
                    background: "var(--color-paper-2, #ffffff)",
                    color: "var(--color-ink, #202C52)",
                  }}
                />
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: "var(--color-ink, #202C52)" }}>
                  Simulated Customer Name
                </label>
                <input
                  type="text"
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  placeholder="Rahul Sharma"
                  className="w-full rounded-lg border px-3 py-2 text-xs shadow-xs focus:outline-none"
                  style={{
                    borderColor: "var(--color-rule, #E8E8E8)",
                    background: "var(--color-paper-2, #ffffff)",
                    color: "var(--color-ink, #202C52)",
                  }}
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
                className="w-full rounded-lg py-2 text-xs font-semibold text-white shadow-xs hover:opacity-95"
                style={{ background: "var(--color-ink, #202C52)" }}
              >
                {testingTrigger ? "Evaluating…" : "Run Diagnostic Simulation"}
              </button>

              {testResult && (
                <div
                  className="rounded-lg border p-3 space-y-2 text-xs"
                  style={{
                    background: "var(--color-surface, #F5F5F5)",
                    borderColor: "var(--color-rule, #E8E8E8)",
                  }}
                >
                  <span className="font-semibold block" style={{ color: "var(--color-ink, #202C52)" }}>
                    Simulation Diagnostic Outcome:
                  </span>
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

      <ExternalWebhookModal
        open={showWebhookModal}
        onClose={() => setShowWebhookModal(false)}
        apiBase={API}
        authHeaders={headers}
      />
    </div>
  );
}
