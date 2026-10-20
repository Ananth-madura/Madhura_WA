import WAFlowEditor from "../components/WAFlowEditor";
import { flowPorts, setFlowPort, removeFlowNodes, duplicateFlowNodes } from "../utils/waFlowGraph";
import WAWorkspaceGuide from "../components/WAWorkspaceGuide";
import WAFlowOutline from "../components/WAFlowOutline";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useLocation, useParams, useSearchParams } from "react-router-dom";
import { createPortal } from "react-dom";
import axios from "axios";
import { API } from "../config/api";
import WAStorageAndSenders from "../components/WAStorageAndSenders";
import WAInteractiveOptions from "../components/WAInteractiveOptions";
import { getInteractiveMessage } from "../utils/waInteractiveMessage";
import { Bot, Plus, Play, Trash2, Loader2, GitFork, Send, X, PhoneCall, Database, Globe, CheckCircle2, Clock, ShieldAlert, ListOrdered, Layers, BarChart2, RefreshCw, Zap, Search, ChevronRight, RotateCcw, Sliders, MessageSquare, AlertCircle, Shield, Sun, Moon } from "lucide-react";

// Standard & Advanced WhatsApp Flow Placeholders
const PLACEHOLDERS = [
  { tag: "{{customer.name}}", label: "Customer Name", desc: "e.g. ANANTH" },
  { tag: "{{customer.phone}}", label: "Phone Number", desc: "+91 9876543210" },
  { tag: "{{customer.email}}", label: "Customer Email", desc: "client@example.com" },
  { tag: "{{customer.city}}", label: "City / Area", desc: "e.g. Bangalore" },
  { tag: "{{customer.company}}", label: "Company Name", desc: "Madhura Tech" },
  { tag: "{{service}}", label: "Service / Product", desc: "AMC Maintenance" },
  { tag: "{{amount}}", label: "Amount / Balance (₹)", desc: "₹45,280.00" },
  { tag: "{{invoice_no}}", label: "Invoice #", desc: "INV-2026-088" },
  { tag: "{{due_date}}", label: "Due Date", desc: "25 Aug 2026" },
  { tag: "{{amc_contract_no}}", label: "AMC Contract #", desc: "AMC-2026-904" },
  { tag: "{{current.date}}", label: "Current Date", desc: "Today's Date" },
  { tag: "{{selected.option}}", label: "Last Selected Option", desc: "Account Balance" },
  { tag: "{{agent.name}}", label: "Assigned Agent", desc: "Support Specialist" },
  { tag: "{{conversation.id}}", label: "Conversation ID", desc: "Flow Session UUID" }
];

// Categorized Component Palette Items for Flow Canvas
const PALETTE_CATEGORIES = [
  {
    id: "triggers",
    name: "TRIGGERS",
    icon: Zap,
    color: "text-amber-500",
    items: [
      { type: "start", label: "Start Entry", icon: "🚀", desc: "Flow kickoff point", defaultType: "start" },
      { type: "keyword_trigger", label: "Keyword Match", icon: "🔑", desc: "Trigger on user keyword", triggerType: "keyword" },
      { type: "all_inbound_trigger", label: "New Message", icon: "⚡", desc: "24/7 Universal reception", triggerType: "all_inbound" },
      { type: "first_inbound_trigger", label: "First Welcome", icon: "👋", desc: "First-time visitor bot", triggerType: "first_inbound" },
    ]
  },
  {
    id: "message",
    name: "MESSAGE",
    icon: MessageSquare,
    color: "text-emerald-500",
    items: [
      { type: "interactive_menu", label: "Interactive Menu", icon: "📱", desc: "Grouped lists and reply buttons", color: "border-emerald-500 bg-emerald-50 text-emerald-900" },
      { type: "send_buttons", label: "Reply Buttons", icon: "🔘", desc: "Quick reply buttons (max 3)", color: "border-teal-500 bg-teal-50 text-teal-900" },
      { type: "send_list", label: "List Menu", icon: "📋", desc: "WhatsApp popup list selector", color: "border-cyan-500 bg-cyan-50 text-cyan-900" },
      { type: "send_message", label: "Text Message", icon: "💬", desc: "Standard text message", color: "border-blue-500 bg-blue-50 text-blue-900" },
      { type: "send_media", label: "Media / PDF", icon: "📷", desc: "Image, Video or PDF catalog", color: "border-indigo-500 bg-indigo-50 text-indigo-900" },
      { type: "send_template", label: "Template", icon: "🧾", desc: "Approved Meta HSM template", color: "border-lime-500 bg-lime-50 text-lime-900" },
      { type: "send_cta", label: "Link Button", icon: "🔗", desc: "Tappable button that opens a URL", color: "border-sky-500 bg-sky-50 text-sky-900" },
    ]
  },
  {
    id: "input",
    name: "INPUT",
    icon: ListOrdered,
    color: "text-purple-500",
    items: [
      { type: "collect_input", label: "Text Input", icon: "📥", desc: "Ask question & capture answer", validation: "none", color: "border-purple-500 bg-purple-50 text-purple-900" },
      { type: "collect_number", label: "Number Input", icon: "🔢", desc: "Collect numeric/income value", validation: "number", color: "border-purple-500 bg-purple-50 text-purple-900" },
      { type: "collect_email", label: "Email Input", icon: "📧", desc: "Validate customer email", validation: "email", color: "border-purple-500 bg-purple-50 text-purple-900" },
      { type: "collect_date", label: "Date Picker", icon: "📅", desc: "Capture booking/service date", validation: "date", color: "border-purple-500 bg-purple-50 text-purple-900" },
    ]
  },
  {
    id: "logic",
    name: "LOGIC",
    icon: GitFork,
    color: "text-amber-500",
    items: [
      { type: "condition", label: "Condition (If/Else)", icon: "🔀", desc: "Branch on Yes/No or value", color: "border-amber-500 bg-amber-50 text-amber-900" },
      { type: "ai_intent", label: "AI Intent Router", icon: "🎯", desc: "LLM Natural language classifier", color: "border-fuchsia-500 bg-fuchsia-50 text-fuchsia-900" },
      { type: "ai_generate", label: "AI Smart Reply", icon: "🧠", desc: "Auto-answer via AI agent", color: "border-fuchsia-500 bg-fuchsia-50 text-fuchsia-900" },
      { type: "delay", label: "Pacing Delay", icon: "⏱️", desc: "Human typing delay pause", color: "border-orange-500 bg-orange-50 text-orange-900" },
    ]
  },
  {
    id: "action",
    name: "ACTION",
    icon: Database,
    color: "text-blue-500",
    items: [
      { type: "crm_lookup", label: "CRM Live Lookup", icon: "🔍", desc: "Fetch balances, invoices, AMC", color: "border-sky-500 bg-sky-50 text-sky-900" },
      { type: "create_lead", label: "Create CRM Lead", icon: "💼", desc: "Save contact as hot sales lead", color: "border-blue-500 bg-blue-50 text-blue-900" },
      { type: "api_webhook", label: "API Webhook", icon: "🌐", desc: "Call external REST API", color: "border-violet-500 bg-violet-50 text-violet-900" },
      { type: "set_variable", label: "Set Variable", icon: "⚙️", desc: "Assign custom session variable", color: "border-slate-500 bg-slate-50 text-slate-900" },
    ]
  },
  {
    id: "control",
    name: "CONTROL",
    icon: Shield,
    color: "text-rose-500",
    items: [
      { type: "handoff", label: "Live Agent Handoff", icon: "👤", desc: "Transfer chat to human agent", color: "border-rose-500 bg-rose-50 text-rose-900" },
      { type: "jump_to_flow", label: "Jump to Flow", icon: "↪️", desc: "Switch to another chatbot flow", color: "border-amber-500 bg-amber-50 text-amber-900" },
      { type: "end", label: "End Flow", icon: "🛑", desc: "Complete conversation session", color: "border-gray-500 bg-gray-100 text-gray-900" },
    ]
  }
];

const makeEntryNode = () => ({
  node_key: "start",
  node_type: "start",
  config: { next_node_key: "" },
  position_x: 100,
  position_y: 100,
});

// ── Graph Helpers (module scope: shared by canvas, pre-flight checks & save) ──
const cloneNodes = (list) => JSON.parse(JSON.stringify(list || []));

// Steps that are allowed to finish a branch without a follow-up wire.
const TERMINAL_NODE_TYPES = new Set(["end", "handoff"]);

// Every outgoing link a node owns. Target keys may be stale — callers decide
// whether a dangling reference is an error (validation) or simply skipped (wires).
const getOutgoingLinks = node => flowPorts(node).filter(port => port.target).map(port => ({ target: String(port.target), label: port.label }));

// n8n-style pre-flight validation: broken wires, dead ends, empty content and
// steps that can never be reached from the entry node.
const getFlowIssues = (list, entryKey) => {
  const issues = [];
  const nodeMap = {};
  if (!list?.length) return [{ severity: "error", nodeKey: null, text: "Add an entry step before publishing." }];
  (list || []).forEach(n => {
    if (!n.node_key?.trim()) issues.push({ severity: "error", nodeKey: n.node_key, text: "Every step needs a unique key." });
    if (nodeMap[n.node_key]) issues.push({ severity: "error", nodeKey: n.node_key, text: `Duplicate step key: ${n.node_key}` });
    nodeMap[n.node_key] = n;
  });

  (list || []).forEach(node => {
    const cfg = node.config || {};
    const links = getOutgoingLinks(node);
    if (["api_webhook", "send_media"].includes(node.node_type) && !String(cfg.url || "").trim()) {
      issues.push({ severity: "error", nodeKey: node.node_key, text: `"${node.node_key}" needs a destination URL.` });
    }
    if ((node.node_type === "start" || node.node_type?.includes("trigger")) && links.length === 0) {
      issues.push({ severity: "error", nodeKey: node.node_key, text: "Connect this entry step to the first conversation step." });
    }
    if (node.node_type === "condition" && (!cfg.true_next || !cfg.false_next)) {
      issues.push({ severity: "error", nodeKey: node.node_key, text: "Connect both the yes and no routes of this condition." });
    }

    links.forEach(l => {
      if (!nodeMap[l.target]) {
        issues.push({
          severity: "error",
          nodeKey: node.node_key,
          text: `Broken link on "${l.label}" → step "${l.target}" does not exist`,
        });
      }
    });

    if (!TERMINAL_NODE_TYPES.has(node.node_type) && links.length === 0) {
      issues.push(
        node.node_type === "condition"
          ? { severity: "error", nodeKey: node.node_key, text: `Condition "${node.node_key}" has no YES/NO branch connected` }
          : { severity: "warn", nodeKey: node.node_key, text: `"${node.node_key}" is a dead end — nothing follows it` }
      );
    }

    const body = cfg.text ?? cfg.prompt_text ?? cfg.body ?? cfg.message ?? "";
    if (
      ["send_message", "interactive_menu", "send_buttons", "send_list", "send_cta", "collect_input"].includes(node.node_type) &&
      !String(body).trim()
    ) {
      issues.push({ severity: "error", nodeKey: node.node_key, text: `"${node.node_key}" has no message text` });
    }

    if (node.node_type === "send_cta" && !String(cfg.url || "").replace(/^https?:\/\/$/i, "").trim()) {
      issues.push({ severity: "warn", nodeKey: node.node_key, text: `"${node.node_key}" has no destination URL` });
    }
  });

  // Reachability sweep from the entry step
  const entry = (entryKey && nodeMap[entryKey]) ? entryKey : (list?.[0]?.node_key);
  if (list && list.length > 0) {
    if (entry && nodeMap[entry]) {
      const seen = new Set([entry]);
      const queue = [entry];
      while (queue.length) {
        const cur = nodeMap[queue.shift()];
        if (!cur) continue;
        getOutgoingLinks(cur).forEach(l => {
          if (nodeMap[l.target] && !seen.has(l.target)) {
            seen.add(l.target);
            queue.push(l.target);
          }
        });
      }
      list.forEach(n => {
        if (!seen.has(n.node_key)) {
          issues.push({ severity: "warn", nodeKey: n.node_key, text: `"${n.node_key}" is unreachable from the entry step` });
        }
      });
    } else {
      issues.push({ severity: "error", nodeKey: null, text: "Entry step could not be resolved" });
    }
  }

  return issues;
};

function FlowTestDialog({ request, flowName, setFlowName, phone, setPhone, sending, savingDraft, error, sent, hasUnsavedChanges = false, onClose, onSubmit, onSaveDraft }) {
  if (!request) return null;
  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-slate-950/60 p-3 sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="flow-test-title" className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="flow-test-title" className="text-lg font-semibold text-[#202c52]">Test this flow</h2>
            <p className="mt-1 text-sm text-slate-600">Send “{flowName || request.flowName}” to one WhatsApp number.</p>
          </div>
          <button type="button" onClick={onClose} className="min-h-10 min-w-10 rounded-md text-slate-500 hover:bg-slate-100" aria-label="Close test dialog"><X size={18} /></button>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          {!request.flowId && <label className="block text-sm font-medium text-slate-700">Flow name<input value={flowName} onChange={(event) => setFlowName(event.target.value)} maxLength={120} placeholder="Name this flow" className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2.5 text-base outline-none focus:border-[#202c52] focus:ring-2 focus:ring-[#202c52]/15" /></label>}
          <label className="block text-sm font-medium text-slate-700">
            Phone number
            <input autoFocus type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+91 98765 43210" className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2.5 text-base outline-none focus:border-[#202c52] focus:ring-2 focus:ring-[#202c52]/15" />
          </label>
          <p className="text-xs text-slate-500">Include the country code. A 10-digit Indian number is sent with +91.</p>
          {!request.flowId && <p className="text-sm text-amber-800" role="status">Save this flow as a draft before sending a live test.</p>}
          {request.flowId && hasUnsavedChanges && <p className="text-sm text-amber-800" role="status">Save your draft first so the test uses the latest version.</p>}
          {error && <p className="text-sm text-rose-700" role="alert">{error}</p>}
          {sent && <p className="text-sm text-emerald-800" role="status">{sent}</p>}
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="min-h-11 rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">Close</button>
            {(!request.flowId || hasUnsavedChanges) && <button type="button" onClick={onSaveDraft} disabled={savingDraft || !flowName.trim()} className="min-h-11 rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">{savingDraft ? "Saving…" : "Save draft"}</button>}
            <button type="submit" disabled={sending || !request.flowId || hasUnsavedChanges || !phone.trim()} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[#202c52] px-4 text-sm font-semibold text-white hover:bg-[#2b385f] disabled:cursor-not-allowed disabled:opacity-50">
              {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              {sending ? "Sending…" : sent ? "Send again" : "Send test"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function WhatsAppFlows() {
  const navigate = useNavigate();
  const location = useLocation();
  const { flowId } = useParams();
  const [searchParams] = useSearchParams();
  const isStudioRoute = location.pathname.includes("/flows/build") || location.pathname.includes("/flows/builder") || location.pathname.endsWith("/flows/create");

  const [flows, setFlows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("flows"); // "flows" | "runs"
  const [searchQuery, setSearchQuery] = useState("");
  const [testRequest, setTestRequest] = useState(null);
  const [testPhone, setTestPhone] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testError, setTestError] = useState("");
  const [testSent, setTestSent] = useState("");
  const [saveNotice, setSaveNotice] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [studioPanelRequest, setStudioPanelRequest] = useState(null);
  const [studioLoadError, setStudioLoadError] = useState("");
  const [studioLoading, setStudioLoading] = useState(false);
  const studioLoadRequest = useRef(0);
  const studioOpenRef = useRef(null);

  useEffect(() => {
    if (!testRequest) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape" && !testSending) setTestRequest(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [testRequest, testSending]);

  // Visual Studio / Editor State
  const [showStudio, setShowStudio] = useState(isStudioRoute);
  const [editingFlowId, setEditingFlowId] = useState(flowId || searchParams.get("id") || null);
  const [flowName, setFlowName] = useState("");
  const [flowDesc, setFlowDesc] = useState("");
  const [flowTriggerType, setFlowTriggerType] = useState("keyword");
  const [flowKeywords, setFlowKeywords] = useState("hi, hello, bank, menu, help");
  const [flowEntryNode, setFlowEntryNode] = useState("start");
  const [nodes, setNodes] = useState([]);
  const [selectedNodeKey, setSelectedNodeKey] = useState(null);
  // Draft buffer for the inspector's node-key rename (committed on blur / Enter)
  const [keyDraft, setKeyDraft] = useState(null); // { nodeKey, value }
  const [saving, setSaving] = useState(false);

  // Editing history (undo / redo) + unsaved-changes tracking — the canvas keeps
  // a stack of node snapshots so every structural change can be reverted.
  const [dirty, setDirty] = useState(false);
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const nodesRef = useRef(nodes);
  const lastConfigSnapshotRef = useRef(0);
  // Latest handler bindings for the global keyboard listener.
  const shortcutsRef = useRef({});
  // Which toolbar dropdown is open: "templates" | "issues" | "more" | null

  // Canvas Viewport State (Pan & Zoom)
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const canvasRef = useRef(null);

  // Node Dragging State

  // Edge Connection Drawing State

  // WhatsApp Smartphone Mockup Simulator State
  const [simDarkTheme, setSimDarkTheme] = useState(true);
  const [simListPopup, setSimListPopup] = useState(null); // { title, rows, buttonText }
  const [simMessages, setSimMessages] = useState([]);
  const [simVars, setSimVars] = useState({
    name: "ANANTH",
    customer_name: "ANANTH",
    company: "Madhura Bank & Tech",
    phone: "+91 76519 05578",
    city: "Bangalore",
    service: "Banking & Loan Services",
    amount: "₹45,280.00",
    invoice_no: "INV-2026-088",
    due_date: "25 Aug 2026",
    date: new Date().toLocaleDateString("en-IN"),
  });
  const [simCurrentNode, setSimCurrentNode] = useState(null);
  const [simLogs, setSimLogs] = useState([]);
  const [simTyping, setSimTyping] = useState(false);
  const [simError, setSimError] = useState("");
  const simRequestRef = useRef(false);
  const simGenerationRef = useRef(0);
  const [simInputText, setSimInputText] = useState("");
  const [simEnded, setSimEnded] = useState(false);
  const simChatBottomRef = useRef(null);

  // Keep a mirror of the canvas graph for the history stack (always the last
  // committed value, so a snapshot taken before a mutation is the pre-state).
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  // Warn before the tab is closed with unsaved canvas changes.
  useEffect(() => {
    if (!dirty) return undefined;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // Auto-scroll phone simulator chat bottom on new message or typing
  useEffect(() => {
    if (simChatBottomRef.current) {
      simChatBottomRef.current.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    }
  }, [simMessages, simTyping]);

  // Expose the newest handlers/state to the window-level keyboard listener.
  // No dependency array on purpose: it always re-binds to the latest render.
  useEffect(() => {
    shortcutsRef.current = {
      active: showStudio,
      simListPopup,
      closePopup: () => setSimListPopup(null),
      undo,
      redo,
      deleteSelected,
      duplicateSelected,
      nudgeSelected,
      zoomBy,
      fitToScreen,
      saveDraft,
    };
  });

  // Global keybindings: Escape cancels active port connection / popups, plus
  // n8n-style canvas shortcuts (undo, redo, delete, duplicate, save, zoom …).
  useEffect(() => {
    const isTypingTarget = (target) => {
      const tag = target?.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || !!target?.isContentEditable;
    };

    const handleKeyDown = (e) => {
      const s = shortcutsRef.current;
      if (!s.active) return;
      const mod = e.ctrlKey || e.metaKey;

      if (e.key === "Escape") {
        if (s.simListPopup) s.closePopup();
        return;
      }

      if (mod && (e.key === "s" || e.key === "S")) { e.preventDefault(); s.saveDraft(); return; }
      if (isTypingTarget(e.target)) return;
      if (mod && (e.key === "z" || e.key === "Z")) { e.preventDefault(); if (e.shiftKey) s.redo(); else s.undo(); return; }
      if (mod && (e.key === "y" || e.key === "Y")) { e.preventDefault(); s.redo(); return; }
      if (mod && (e.key === "d" || e.key === "D")) { e.preventDefault(); s.duplicateSelected(); return; }
      if (mod && e.key === "0") { e.preventDefault(); s.fitToScreen(); return; }
      if (mod && (e.key === "=" || e.key === "+")) { e.preventDefault(); s.zoomBy(0.1); return; }
      if (mod && e.key === "-") { e.preventDefault(); s.zoomBy(-0.1); return; }
      if (mod) return;

      if (isTypingTarget(e.target)) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        s.deleteSelected();
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        const step = e.shiftKey ? 40 : 8;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        s.nudgeSelected(dx, dy);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Wheel / trackpad canvas navigation: scroll pans the board, ctrl/cmd + scroll
  // zooms around the cursor (native non-passive listener so ctrl+scroll does not
  // trigger the browser's page zoom).
  useEffect(() => {
    const el = canvasRef.current;
    if (!showStudio || !el) return undefined;

    const onWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;
        const next = Math.min(1.8, Math.max(0.4, Number((zoom + (e.deltaY > 0 ? -0.08 : 0.08)).toFixed(2))));
        if (next === zoom) return;
        const worldX = (cursorX - pan.x) / zoom;
        const worldY = (cursorY - pan.y) / zoom;
        setPan({ x: Math.round(cursorX - worldX * next), y: Math.round(cursorY - worldY * next) });
        setZoom(next);
      } else {
        setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [showStudio, zoom, pan]);

  // Versions Modal State
  const [showVersionsModal, setShowVersionsModal] = useState(false);
  const [flowVersions, setFlowVersions] = useState([]);
  const [versionChangelog, setVersionChangelog] = useState("");

  // Analytics Modal State
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [selectedAnalyticsFlow, setSelectedAnalyticsFlow] = useState(null);

  // Runs Audit Tab State
  const [runsList, setRunsList] = useState([]);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [runsError, setRunsError] = useState("");

  // Accordion open/close in palette
  const fetchFlows = useCallback(async () => {
    setLoadError("");
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`${API}/api/wa-flows`, { headers });
      setFlows(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setLoadError(err.response?.data?.message || err.response?.data?.error || "Flows could not be loaded. Retry to reconnect.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlows();
  }, [fetchFlows]);

  // ── Fetch Audit Runs ────────────────────────────────────────────────────────
  const fetchRuns = useCallback(async () => {
    setRunsError("");
    try {
      setLoadingRuns(true);
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const results = await Promise.allSettled(flows.map(flow => axios.get(`${API}/api/wa-flows/${flow.id}/runs`, { headers })));
      const runs = results.flatMap((result, index) => result.status === "fulfilled" && Array.isArray(result.value.data) ? result.value.data.map(run => ({ ...run, flow_name: flows[index].name, flow_id: flows[index].id })) : []);
      setRunsList(runs.sort((a, b) => new Date(b.started_at) - new Date(a.started_at)));
      if (results.some(result => result.status === "rejected")) setRunsError("Some flow histories could not be loaded. Retry to refresh the execution list.");
    } catch (err) {
      console.error("Error fetching runs:", err);
      setRunsError("Execution history could not be loaded. Retry to reconnect.");
    } finally {
      setLoadingRuns(false);
    }
  }, [flows]);

  useEffect(() => {
    if (activeTab === "runs") {
      fetchRuns();
    }
  }, [activeTab, fetchRuns]);

  // ── Sync Route with Visual Studio State ─────────────────────────────────────
  useEffect(() => {
    if (isStudioRoute) {
      const targetId = flowId || searchParams.get("id");
      if (targetId) {
        studioOpenRef.current({ id: targetId });
      } else {
        studioOpenRef.current(null);
      }
    } else {
      studioLoadRequest.current++;
      setStudioLoading(false);
      setShowStudio(false);
    }
  }, [isStudioRoute, location.pathname, flowId, searchParams]);

  const handleCloseStudio = () => {
    if (dirty && !window.confirm("You have unsaved canvas changes. Leave the studio anyway?")) {
      return;
    }
    studioLoadRequest.current++;
    setShowStudio(false);
    navigate("/whatsapp/flows");
  };

  // ── Auto-Fit & Center Flow Canvas ───────────────────────────────────────────
  const fitToScreen = useCallback((targetNodes = null) => {
    const list = targetNodes || nodes;
    if (!list || list.length === 0) {
      setZoom(1);
      setPan({ x: 80, y: 50 });
      return;
    }
    const canvasEl = canvasRef.current;
    const canvasWidth = canvasEl ? canvasEl.clientWidth : window.innerWidth;
    const canvasHeight = canvasEl ? canvasEl.clientHeight : (window.innerHeight - 56);

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    list.forEach(n => {
      const x = Number(n.position_x) || 0;
      const y = Number(n.position_y) || 0;
      if (x < minX) minX = x;
      if (x + 180 > maxX) maxX = x + 180;
      if (y < minY) minY = y;
      if (y + Math.max(180, flowPorts(n).length * 24 + 100) > maxY) maxY = y + Math.max(180, flowPorts(n).length * 24 + 100);
    });

    const flowWidth = Math.max(300, maxX - minX);
    const flowHeight = Math.max(300, maxY - minY);
    const paddingX = 80;
    const paddingY = 60;

    const scaleX = (canvasWidth - paddingX * 2) / flowWidth;
    const scaleY = (canvasHeight - paddingY * 2) / flowHeight;
    const computedZoom = Math.min(1.15, Math.max(0.45, Math.min(scaleX, scaleY)));

    const newPanX = (canvasWidth - flowWidth * computedZoom) / 2 - minX * computedZoom;
    const newPanY = Math.max(30, (canvasHeight - flowHeight * computedZoom) / 2 - minY * computedZoom);

    setZoom(Number(computedZoom.toFixed(2)));
    setPan({ x: Math.round(newPanX), y: Math.round(newPanY) });
  }, [nodes]);

  const recordHistory = useCallback((snapshot) => {
    undoStackRef.current.push(snapshot);
    if (undoStackRef.current.length > 60) undoStackRef.current.shift();
    redoStackRef.current = [];
    setDirty(true);
  }, []);

  // Snapshot the graph as it currently stands — call BEFORE mutating nodes.
  const snapshotNodes = useCallback(() => {
    recordHistory(cloneNodes(nodesRef.current));
  }, [recordHistory]);

  // Throttled snapshot for high-frequency edits (typing in the inspector) so a
  // burst of keystrokes collapses into a single undo step.
  const snapshotNodesThrottled = useCallback(() => {
    const now = Date.now();
    if (now - lastConfigSnapshotRef.current > 900) {
      lastConfigSnapshotRef.current = now;
      snapshotNodes();
    }
  }, [snapshotNodes]);

  const undo = useCallback(() => {
    if (!undoStackRef.current.length) return;
    redoStackRef.current.push(cloneNodes(nodesRef.current));
    const prev = undoStackRef.current.pop();
    setNodes(prev);
    setSelectedNodeKey(k => (k && prev.some(n => n.node_key === k) ? k : null));
    setDirty(true);
  }, []);

  const redo = useCallback(() => {
    if (!redoStackRef.current.length) return;
    undoStackRef.current.push(cloneNodes(nodesRef.current));
    const next = redoStackRef.current.pop();
    setNodes(next);
    setSelectedNodeKey(k => (k && next.some(n => n.node_key === k) ? k : null));
    setDirty(true);
  }, []);

  // ── Viewport & editing shortcuts helpers ───────────────────────────────────
  const zoomBy = (delta) => {
    setZoom(z => Math.min(1.8, Math.max(0.4, Number((z + delta).toFixed(2)))));
  };

  const nudgeSelected = (dx, dy) => {
    if (!selectedNodeKey) return;
    snapshotNodesThrottled();
    setNodes(prev => prev.map(n => (
      n.node_key === selectedNodeKey
        ? { ...n, position_x: (Number(n.position_x) || 0) + dx, position_y: (Number(n.position_y) || 0) + dy }
        : n
    )));
  };

  const saveDraft = () => {
    handleSaveFlow(false);
  };

  const deleteSelected = () => {
    if (selectedNodeKey) deleteNode(selectedNodeKey);
  };

  const duplicateSelected = () => {
    const node = nodes.find(n => n.node_key === selectedNodeKey);
    if (node) duplicateNode(node);
  };

  // ── Auto-arrange ("tidy up"): layered left-to-right layout from the entry ──
  const autoLayout = () => {
    if (!nodes.length) return;
    snapshotNodes();

    const nodeMap = {};
    nodes.forEach(n => { nodeMap[n.node_key] = n; });
    const entry = (entryNodeKey && nodeMap[entryNodeKey]) ? entryNodeKey : nodes[0].node_key;

    const depth = { [entry]: 0 };
    const seen = new Set([entry]);
    const queue = [entry];
    while (queue.length) {
      const current = nodeMap[queue.shift()];
      if (!current) continue;
      getOutgoingLinks(current).forEach(l => {
        if (nodeMap[l.target] && !seen.has(l.target)) {
          seen.add(l.target);
          depth[l.target] = depth[current.node_key] + 1;
          queue.push(l.target);
        }
      });
    }

    const deepest = seen.size ? Math.max(...Array.from(seen).map(k => depth[k] || 0)) : 0;
    const columns = {};
    nodes.forEach(n => {
      if (depth[n.node_key] === undefined) depth[n.node_key] = deepest + 1;
      const d = depth[n.node_key];
      (columns[d] = columns[d] || []).push(n.node_key);
    });

    const laid = nodes.map(n => {
      const d = depth[n.node_key];
      const row = columns[d].indexOf(n.node_key);
      return { ...n, position_x: 70 + d * 360, position_y: 80 + row * 265 };
    });

    setNodes(laid);
    setTimeout(() => fitToScreen(laid), 80);
  };

  // ── Open Visual Studio for a Flow ───────────────────────────────────────────
  const openStudio = async (flow = null) => {
    const request = ++studioLoadRequest.current;
    setStudioLoading(Boolean(flow?.id));
    setStudioLoadError("");
    setDirty(false);
    undoStackRef.current = [];
    redoStackRef.current = [];
    setSaveNotice(null);

    setSelectedNodeKey(null);

    if (flow && flow.id) {
      setEditingFlowId(flow.id);
      setFlowName(flow.name || "Untitled Flow");
      setFlowDesc(flow.description || "");
      setFlowTriggerType(flow.trigger_type || "keyword");
      let cfg = flow.trigger_config;
      if (typeof cfg === "string") {
        try { cfg = JSON.parse(cfg); } catch (_) { cfg = {}; }
      }
      const kws = cfg?.keywords || (cfg?.keyword ? [cfg.keyword] : []);
      setFlowKeywords(kws.join(", ") || "hi, hello, menu");
      setFlowEntryNode(flow.entry_node_key || "start");

      // Fetch full nodes from backend
      try {
        const token = localStorage.getItem("token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await axios.get(`${API}/api/wa-flows/${flow.id}`, { headers, timeout: 15000 });
        if (request !== studioLoadRequest.current) return;
        const fullFlow = res.data;
        setFlowName(fullFlow.name || flow.name || "");
        setFlowDesc(fullFlow.description || "");
        setFlowTriggerType(fullFlow.trigger_type || "manual");
        let triggerConfig = fullFlow.trigger_config || {};
        if (typeof triggerConfig === "string") { try { triggerConfig = JSON.parse(triggerConfig); } catch { triggerConfig = {}; } }
        setFlowKeywords((triggerConfig.keywords || (triggerConfig.keyword ? [triggerConfig.keyword] : [])).join(", "));
        setFlowEntryNode(fullFlow.entry_node_key || "start");
        const fetchedNodes = res.data?.nodes || [];
        const loaded = fetchedNodes.length > 0 ? fetchedNodes : [makeEntryNode()];
        setNodes(loaded);
        setTimeout(() => fitToScreen(loaded), 150);
      } catch (e) {
        if (request !== studioLoadRequest.current) return;
        setStudioLoadError("This flow could not be loaded. Retry before editing or saving so the existing conversation is preserved.");
        const fallback = [makeEntryNode()];
        setNodes(fallback);
        setTimeout(() => fitToScreen(fallback), 150);
      } finally { if (request === studioLoadRequest.current) setStudioLoading(false); }
    } else {
      // Start with an honest entry node; templates are an explicit choice.
      setEditingFlowId(null);
      setFlowName("");
      setFlowDesc("");
      setFlowTriggerType("manual");
      setFlowKeywords("");
      setFlowEntryNode("start");
      const defaultNodes = [makeEntryNode()];
      setNodes(defaultNodes);
      setSelectedNodeKey("start");


      setDirty(false);
      undoStackRef.current = [];
      redoStackRef.current = [];
      setTimeout(() => fitToScreen(defaultNodes), 150);
    }

    setShowStudio(true);
    resetSimulation(false);
  };

  studioOpenRef.current = openStudio;

  const openTestDialog = (targetFlowId = null, targetFlowName = flowName) => {
    setTestRequest({ flowId: targetFlowId || editingFlowId, flowName: targetFlowName || "this flow" });
    setTestPhone("");
    setTestError("");
    setTestSent("");
  };

  const triggerFlowForPhone = async (event) => {
    event.preventDefault();
    if (!testRequest?.flowId) {
      setTestError("Save this flow as a draft before sending a live test.");
      return;
    }
    if (dirty) {
      setTestError("Save your draft before sending the test so it matches the latest canvas.");
      return;
    }
    let cleanPhone = String(testPhone || "").replace(/\D/g, "");
    if (cleanPhone.length === 10) cleanPhone = "91" + cleanPhone;
    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      setTestError("Enter a valid phone number with its country code.");
      return;
    }

    setTestSending(true);
    setTestError("");
    setTestSent("");
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.post(`${API}/api/wa-flows/send-menu`, {
        phone: cleanPhone,
        flow_id: testRequest.flowId
      }, { headers });
      setTestSent(res.data.message || `Test message sent to +${cleanPhone}.`);
    } catch (err) {
      setTestError(err.response?.data?.error || "The test message could not be sent. Check the WhatsApp account and try again.");
    } finally {
      setTestSending(false);
    }
  };

  const saveDraftForTest = async () => {
    setTestError("");
    const savedFlowId = await handleSaveFlow(false);
    if (!savedFlowId) return;
    setTestRequest((current) => current ? { ...current, flowId: savedFlowId, flowName: flowName || "this flow" } : current);
    setTestSent("Draft saved. Send a test to check the latest version.");
  };
  // ── Food & Products Flow Bot Template (Catalog, "View All" List, Orders & CRM Leads) ──
  const handleSeedFlows = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.post(`${API}/api/wa-flows/seed`, {}, { headers });
      await fetchFlows();
      alert("✅ Standard conversational flows & banking templates loaded successfully!");
    } catch (e) {
      alert("Failed to seed flows: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Save Current Flow to Backend ────────────────────────────────────────────
  const handleSaveFlow = async (isPublishing = false) => {
    if (saving || studioLoading) return;
    if (studioLoadError) { setSaveNotice({ type: "error", message: studioLoadError }); return; }
    if (!flowName.trim()) {
      setSaveNotice({ type: "error", message: "Name this flow before saving." });
      return;
    }
    setSaveNotice(null);

    // Pre-flight gate before going live: broken wires / unconnected branches
    if (isPublishing) {
      const entryKey = (nodes.some(n => n.node_key === flowEntryNode))
        ? flowEntryNode
        : (nodes.find(n => n.node_type === "start" || n.node_type?.includes("trigger"))?.node_key || nodes[0]?.node_key || null);
      const blocking = getFlowIssues(nodes, entryKey).filter(i => i.severity === "error");
      if (blocking.length > 0) {
        setSaveNotice({ type: "error", message: "Resolve the blocking issues before publishing. Your draft can still be saved." });

        setStudioPanelRequest({ panel: "checks", at: Date.now() });
        return;
      }
      if (flowTriggerType === "keyword" && !flowKeywords.split(",").some(keyword => keyword.trim())) {
        setSaveNotice({ type: "error", message: "Add at least one trigger keyword before publishing." });

        setStudioPanelRequest({ panel: "settings", at: Date.now() });
        return;
      }
    }

    try {
      setSaving(true);
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const keywordsArr = flowKeywords.split(",").map(k => k.trim()).filter(Boolean);
      const actualEntryKey = (nodes.some(n => n.node_key === flowEntryNode))
        ? flowEntryNode
        : (nodes.find(n => n.node_type === "start" || n.node_type?.includes("trigger"))?.node_key || nodes[0]?.node_key || "start");

      const payload = {
        name: flowName.trim(),
        description: flowDesc,
        status: "draft",
        trigger_type: flowTriggerType,
        trigger_config: { keywords: keywordsArr },
        entry_node_key: actualEntryKey,
        nodes: nodes.map(n => ({
          node_key: n.node_key,
          node_type: n.node_type,
          config: n.config || {},
          position_x: Math.round(n.position_x || 0),
          position_y: Math.round(n.position_y || 0)
        }))
      };

      let flowId = editingFlowId;
      if (editingFlowId) {
        await axios.put(`${API}/api/wa-flows/${editingFlowId}`, payload, { headers });
      } else {
        const res = await axios.post(`${API}/api/wa-flows`, payload, { headers });
        flowId = res.data.id;
        setEditingFlowId(flowId);
      }

      if (isPublishing && flowId) {
        await axios.post(`${API}/api/wa-flows/${flowId}/versions/publish`, { changelog: versionChangelog || "Published via Visual Studio" }, { headers });
        await axios.patch(`${API}/api/wa-flows/${flowId}/status`, { status: "active" }, { headers });
        setVersionChangelog("");
      }

      await fetchFlows();
      setDirty(false);
      setSaveNotice({ type: "success", message: isPublishing ? "Flow published." : "Draft saved." });
      return flowId;
    } catch (err) {
      setSaveNotice({ type: "error", message: err.response?.data?.message || err.response?.data?.error || err.message || "The flow could not be saved." });
    } finally {
      setSaving(false);
    }
  };

  // ── Delete Flow ─────────────────────────────────────────────────────────────
  const handleDeleteFlow = async (id, name, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) return;
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.delete(`${API}/api/wa-flows/${id}`, { headers });
      await fetchFlows();
      if (editingFlowId === id) setShowStudio(false);
    } catch (err) {
      alert("Error deleting flow: " + err.message);
    }
  };

  // ── Toggle Active Status ────────────────────────────────────────────────────
  const handleToggleStatus = async (flow, e) => {
    if (e) e.stopPropagation();
    const newStatus = flow.status === "active" ? "draft" : "active";
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      if (newStatus === "active") {
        const { data } = await axios.get(`${API}/api/wa-flows/${flow.id}`, { headers });
        if (getFlowIssues(data.nodes || [], data.entry_node_key).some(issue => issue.severity === "error")) {
          setLoadError(`Open "${flow.name}" and resolve its validation issues before activating it.`);
          return;
        }
      }
      await axios.patch(`${API}/api/wa-flows/${flow.id}/status`, { status: newStatus }, { headers });
      setFlows(prev => prev.map(f => f.id === flow.id ? { ...f, status: newStatus } : f));
    } catch (err) {
      alert("Error changing status: " + err.message);
    }
  };

  // ── Open Analytics Modal ────────────────────────────────────────────────────
  const openAnalytics = async (flow, e) => {
    if (e) e.stopPropagation();
    setSelectedAnalyticsFlow(flow);
    setShowAnalyticsModal(true);
    setAnalyticsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`${API}/api/wa-flows/${flow.id}/analytics`, { headers });
      setAnalyticsData(res.data);
    } catch (err) {
      console.error("Error loading analytics:", err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // ── Open Versions Modal ────────────────────────────────────────────────────
  const openVersions = async (flowId = editingFlowId) => {
    if (!flowId) return;
    setShowVersionsModal(true);
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`${API}/api/wa-flows/${flowId}/versions`, { headers });
      setFlowVersions(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error loading versions:", err);
    }
  };

  const handleRollbackVersion = async (versionId) => {
    if (!window.confirm("Restore this version? Unsaved changes will be replaced.")) return;
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.post(`${API}/api/wa-flows/${editingFlowId}/versions/${versionId}/rollback`, {}, { headers });
      setShowVersionsModal(false);
      // Reload flow in studio
      const res = await axios.get(`${API}/api/wa-flows/${editingFlowId}`, { headers });
      const fetchedFlow = res.data;
      setFlowName(fetchedFlow.name);
      setFlowDesc(fetchedFlow.description || "");
      snapshotNodes(); // restoring a version is itself undoable
      setNodes(fetchedFlow.nodes || []);
      setSelectedNodeKey(fetchedFlow.nodes[0]?.node_key || "start");
      alert("✅ Successfully restored version snapshot!");
    } catch (err) {
      alert("Error rolling back: " + err.message);
    }
  };

  // ── Canvas Dragging & Node Manipulation ─────────────────────────────────────
  const addNodeFromPalette = (item, placement = null, connection = null) => {
    const baseKey = item.type.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
    let uniqueKey = baseKey;
    let counter = 1;
    const existingKeys = new Set(nodes.map(node => node.node_key));
    while (existingKeys.has(uniqueKey)) {
      counter++;
      uniqueKey = `${baseKey}_${counter}`;
    }

    // Default configuration based on item type
    let newConfig = {};
    if (item.type === "interactive_menu") {
      newConfig = {
        text: "Hello {{customer.name}}! Please select from the options below:",
        sections: [
          {
            title: "Main Options",
            buttons: [
              { id: "opt_1", label: "Option 1", nextNodeId: "" },
              { id: "opt_2", label: "Option 2", nextNodeId: "" }
            ]
          }
        ]
      };
    } else if (item.type === "send_buttons") {
      newConfig = {
        text: "Please select an option:",
        buttons: [
          { reply_id: "btn_1", title: "Option 1", next_node_key: "" },
          { reply_id: "btn_2", title: "Option 2", next_node_key: "" }
        ]
      };
    } else if (item.type === "send_list") {
      newConfig = {
        text: "Please choose from the menu:",
        button_text: "View Options",
        rows: [
          { id: "row_1", title: "Item 1", description: "Details 1", next_node_key: "" },
          { id: "row_2", title: "Item 2", description: "Details 2", next_node_key: "" }
        ]
      };
    } else if (item.type === "send_cta") {
      newConfig = {
        text: "Your quotation is ready.",
        button_text: "View Quote",
        url: "https://",
        footer_text: "",
        next_node_key: ""
      };
    } else if (item.type === "send_message") {
      newConfig = { text: "Thank you for contacting us!", next_node_key: "" };
    } else if (item.type === "collect_input" || item.type.startsWith("collect_")) {
      newConfig = {
        prompt_text: "Please enter your response:",
        var_key: uniqueKey,
        validation_type: item.validation || "none",
        next_node_key: ""
      };
    } else if (item.type === "condition") {
      newConfig = {
        subject_key: "input",
        operator: "equals",
        value: "yes",
        true_next: "",
        false_next: ""
      };
    } else if (item.type === "crm_lookup") {
      newConfig = { lookup_type: "customer", next_node_key: "" };
    } else if (item.type === "create_lead") {
      newConfig = { default_service: "General Inquiry", notes: "Captured via bot", next_node_key: "" };
    } else if (item.type === "api_webhook") {
      newConfig = { method: "GET", url: "", next_node_key: "" };
    } else if (item.type === "handoff") {
      newConfig = { note: "Connecting you to our support specialist..." };
    } else if (item.type === "delay") {
      newConfig = { delay_seconds: 3, next_node_key: "" };
    }

    const canvasCenterX = (-pan.x + 400) / zoom;
    const canvasCenterY = (-pan.y + 250) / zoom;

    const newNode = {
      node_key: uniqueKey,
      node_type: item.type === "collect_number" || item.type === "collect_email" || item.type === "collect_date" ? "collect_input" : item.type,
      config: newConfig,
      position_x: Math.round(placement?.x ?? canvasCenterX),
      position_y: Math.round(placement?.y ?? canvasCenterY)
    };

    while (nodes.some(node => Math.abs((Number(node.position_x) || 0) - newNode.position_x) < 170 && Math.abs((Number(node.position_y) || 0) - newNode.position_y) < 160)) newNode.position_y += 180;
    snapshotNodes();
    setNodes(prev => [...prev.map(node => connection && node.node_key === connection.source ? setFlowPort(node, connection.port, uniqueKey) : node), newNode]);
    setSelectedNodeKey(uniqueKey);
  };

  const deleteNode = (nodeKey) => {
    if (nodeKey === "start" || nodeKey === flowEntryNode) {
      alert("The start entry node cannot be deleted.");
      return;
    }
    snapshotNodes();
    setNodes(prev => removeFlowNodes(prev, new Set([nodeKey])));
    if (selectedNodeKey === nodeKey) setSelectedNodeKey(null);
  };

  const duplicateNode = node => {
    const [copy] = duplicateFlowNodes(nodes, [node]);
    snapshotNodes();
    setNodes(previous => [...previous, copy]);
    setSelectedNodeKey(copy.node_key);
  };

  // ── Rename a step: rewrite the key AND every reference pointing at it ─────
  const renameNodeKey = (oldKey, newKey) => {
    if (!newKey || newKey === oldKey) return;
    if (nodes.some(n => n.node_key === newKey)) {
      alert(`A step named "${newKey}" already exists — pick another key.`);
      return;
    }

    const remap = (val) => (val === oldKey ? newKey : val);
    const remapButton = (b) => {
      const nb = { ...b };
      if (nb.next_node_key) nb.next_node_key = remap(nb.next_node_key);
      if (nb.nextNodeId) nb.nextNodeId = remap(nb.nextNodeId);
      return nb;
    };
    const remapConfig = (cfg) => {
      const out = { ...cfg };
      ["next_node_key", "nextNodeId", "true_next", "false_next", "found_next", "not_found_next"].forEach(field => {
        if (out[field]) out[field] = remap(out[field]);
      });
      if (out.branches) {
        const branches = {};
        Object.entries(out.branches).forEach(([k, v]) => { branches[k] = remap(v); });
        out.branches = branches;
      }
      if (Array.isArray(out.buttons)) out.buttons = out.buttons.map(remapButton);
      if (Array.isArray(out.rows)) out.rows = out.rows.map(remapButton);
      if (Array.isArray(out.sections)) {
        out.sections = out.sections.map(s => ({ ...s, buttons: (s.buttons || []).map(remapButton) }));
      }
      return out;
    };

    snapshotNodesThrottled();
    setNodes(prev => prev.map(n => (
      n.node_key === oldKey
        ? { ...n, node_key: newKey }
        : { ...n, config: remapConfig(n.config || {}) }
    )));
    if (flowEntryNode === oldKey) setFlowEntryNode(newKey);
    setSelectedNodeKey(newKey);
  };

  // ── Interactive In-Phone Simulator Engine ───────────────────────────────────
  const resetSimulation = (run = true) => {
    simGenerationRef.current++;
    simRequestRef.current = false;
    setSimMessages([]);
    setSimLogs([]);
    setSimEnded(false);
    setSimCurrentNode(null);
    setSimTyping(false);
    setSimError("");
    // Auto-execute from start
    if (run) executeSimStep("", "", true);
  };

  const executeSimStep = async (userInput = "", displayInput = userInput, restart = false) => {
    if (simRequestRef.current) return;
    simRequestRef.current = true;
    const generation = simGenerationRef.current;
    setSimTyping(true);
    setSimError("");

    const activeFlowDraft = {
      name: flowName,
      trigger_type: flowTriggerType,
      trigger_config: { keywords: flowKeywords.split(",").map(k => k.trim()) },
      entry_node_key: flowEntryNode || "start",
      nodes
    };

    // If user typed/tapped something, append user message pill
    if (userInput) {
      setSimMessages(prev => [
        ...prev,
        { sender: "user", text: displayInput, at: new Date() }
      ]);
    }

    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const payload = {
        flow: activeFlowDraft,
        input: userInput,
        state: !restart && simCurrentNode ? {
          currentNodeKey: simCurrentNode,
          vars: simVars
        } : null
      };

      const res = await axios.post(`${API}/api/wa-flows/draft-simulate`, payload, { headers });
      const result = res.data;

      setTimeout(() => {
        if (generation !== simGenerationRef.current) return;
        if (result.messages && result.messages.length > 0) {
          setSimMessages(prev => [...prev, ...result.messages]);
        }
        if (result.vars) {
          setSimVars(result.vars);
        }
        if (result.logs) {
          setSimLogs(prev => [...prev, ...result.logs]);
        }
        setSimCurrentNode(result.currentNodeKey);
        setSimEnded(result.isEnded || false);
        setSimTyping(false);
        simRequestRef.current = false;
      }, 400);

    } catch (err) {
      if (generation !== simGenerationRef.current) return;
      console.error("Simulation error:", err);
      setSimError(err.response?.data?.error || err.response?.data?.message || "The simulation could not run. Check your connection and restart the preview.");
      setSimTyping(false);
      simRequestRef.current = false;
    }
  };

  const selectedNode = nodes.find(n => n.node_key === selectedNodeKey);

  // ── Pre-flight validation (n8n-style issue list) ───────────────────────────
  const entryNodeKey = useMemo(() => {
    if (nodes.some(n => n.node_key === flowEntryNode)) return flowEntryNode;
    const start = nodes.find(n => n.node_type === "start" || n.node_type?.includes("trigger")) || nodes[0];
    return start ? start.node_key : null;
  }, [nodes, flowEntryNode]);

  const flowIssues = useMemo(() => getFlowIssues(nodes, entryNodeKey), [nodes, entryNodeKey]);

  const renderNodeInspector = () => {
    if (!selectedNode) {
      return (
        <div className="p-6 text-center text-slate-400 space-y-3">
          <Sliders size={32} className="mx-auto text-slate-300" />
          <p className="text-xs font-semibold">Select any node on the canvas to configure its properties & options.</p>
        </div>
      );
    }

    const cfg = selectedNode.config || {};
    const updateConfig = (newCfg) => {
      snapshotNodesThrottled();
      setNodes(prev => prev.map(n => n.node_key === selectedNode.node_key ? { ...n, config: { ...cfg, ...newCfg } } : n));
    };

    return (
      <div className="p-4 space-y-5">
        {/* Node Identifier */}
        <div className="space-y-2 pb-3 border-b border-slate-100">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Step Node Key
          </label>
          <input
            type="text"
            value={keyDraft && keyDraft.nodeKey === selectedNode.node_key ? keyDraft.value : selectedNode.node_key}
            onChange={(e) => setKeyDraft({ nodeKey: selectedNode.node_key, value: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") })}
            onBlur={() => {
              if (keyDraft && keyDraft.nodeKey === selectedNode.node_key && keyDraft.value !== selectedNode.node_key) {
                const target = selectedNode.node_key;
                const value = keyDraft.value;
                setKeyDraft(null);
                renameNodeKey(target, value);
              } else {
                setKeyDraft(null);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setKeyDraft(null);
            }}
            disabled={selectedNode.node_key === "start"}
            title="Rename step — all incoming and outgoing wires are re-pointed automatically"
            className="w-full px-3 py-1.5 text-xs font-mono font-bold bg-slate-50 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* ── INTERACTIVE MENU CONFIGURATION ────────────────────────── */}
        {["interactive_menu", "send_buttons", "send_list"].includes(selectedNode.node_type) && <label className="block text-sm space-y-1">
          <span>Customer menu delivery</span>
          <select className="hl-input w-full p-2" value={cfg.delivery_mode || "native_required"} onChange={(e) => updateConfig({ delivery_mode: e.target.value })}>
            <option value="native_required">Require native buttons/list (Cloud API)</option>
            <option value="allow_text">Allow numbered text fallback (QR/Web)</option>
            <option value="web_text">Use QR/Web numbered text</option>
          </select>
        </label>}
        {selectedNode.node_type === "interactive_menu" && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">Message Text *</label>
                <span className="text-[10px] text-slate-400">Supports variables</span>
              </div>
              <textarea
                value={cfg.text || ""}
                onChange={(e) => updateConfig({ text: e.target.value })}
                rows={3}
                placeholder="Good Afternoon, {{customer.name}} 🍀🙂..."
                className="w-full p-2.5 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-sans"
              />
              {/* Quick Placeholder Inserter */}
              <div className="flex flex-wrap gap-1 mt-1.5">
                {PLACEHOLDERS.slice(0, 6).map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => updateConfig({ text: `${cfg.text || ""} ${p.tag}` })}
                    className="px-1.5 py-0.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 rounded text-[10px] font-mono transition"
                  >
                    + {p.tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Sections & Options Builder */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 uppercase">Sections & Button Options</h4>
                <button
                  type="button"
                  onClick={() => {
                    const secs = [...(cfg.sections || [])];
                    secs.push({
                      title: `SECTION ${secs.length + 1}`,
                      buttons: [{ id: `opt_${Date.now()}`, label: "New Option", nextNodeId: "" }]
                    });
                    updateConfig({ sections: secs });
                  }}
                  className="px-2 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-lg hover:bg-emerald-200 flex items-center gap-1"
                >
                  <Plus size={12} /> Add Section
                </button>
              </div>

              {Array.isArray(cfg.sections) && cfg.sections.map((sec, sIdx) => (
                <div key={sIdx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      value={sec.title || ""}
                      onChange={(e) => {
                        const secs = [...cfg.sections];
                        secs[sIdx].title = e.target.value;
                        updateConfig({ sections: secs });
                      }}
                      placeholder="e.g. Bank Services / Explore more! ⭐"
                      className="flex-1 px-2.5 py-1 text-xs font-bold bg-white border rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const secs = cfg.sections.filter((_, i) => i !== sIdx);
                        updateConfig({ sections: secs });
                      }}
                      className="p-1 text-slate-400 hover:text-rose-600"
                      title="Delete section"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* Options inside Section */}
                  <div className="space-y-1.5 pl-2 border-l-2 border-emerald-500">
                    {(sec.buttons || []).map((btn, bIdx) => (
                      <div key={bIdx} className="p-2 bg-white rounded-lg border border-slate-200 space-y-1.5 shadow-sm">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={btn.label || btn.title || ""}
                            onChange={(e) => {
                              const secs = [...cfg.sections];
                              secs[sIdx].buttons[bIdx].label = e.target.value;
                              secs[sIdx].buttons[bIdx].title = e.target.value;
                              updateConfig({ sections: secs });
                            }}
                            placeholder="Button Label (e.g. Account Balance)"
                            className="flex-1 px-2 py-1 text-xs font-semibold border rounded"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const secs = [...cfg.sections];
                              secs[sIdx].buttons = secs[sIdx].buttons.filter((_, i) => i !== bIdx);
                              updateConfig({ sections: secs });
                            }}
                            className="text-slate-400 hover:text-rose-500"
                          >
                            <X size={13} />
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 shrink-0">Target:</span>
                          <select
                            value={btn.nextNodeId || btn.next_node_key || ""}
                            onChange={(e) => {
                              const secs = [...cfg.sections];
                              secs[sIdx].buttons[bIdx].nextNodeId = e.target.value;
                              secs[sIdx].buttons[bIdx].next_node_key = e.target.value;
                              updateConfig({ sections: secs });
                            }}
                            className="flex-1 px-2 py-1 text-xs bg-slate-50 border rounded font-mono"
                          >
                            <option value="">-- Connect to Next Step --</option>
                            {nodes.map(n => (
                              <option key={n.node_key} value={n.node_key}>
                                {n.node_key} ({n.node_type})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => {
                        const secs = [...cfg.sections];
                        secs[sIdx].buttons.push({
                          id: `btn_${Date.now()}`,
                          label: "New Option",
                          nextNodeId: ""
                        });
                        updateConfig({ sections: secs });
                      }}
                      className="w-full py-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 flex items-center justify-center gap-1 border border-dashed border-emerald-300"
                    >
                      <Plus size={11} /> Add Option Button
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── QUICK REPLY BUTTONS CONFIGURATION ─────────────────────── */}
        {selectedNode.node_type === "send_buttons" && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Header Text (Optional)</label>
              <input
                type="text"
                value={cfg.header_text || ""}
                onChange={(e) => updateConfig({ header_text: e.target.value })}
                placeholder="e.g. Fresh Foods Trading 🍲"
                className="w-full px-3 py-1.5 text-xs border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">Message Body Text *</label>
                <span className="text-[10px] text-slate-400">Supports variables</span>
              </div>
              <textarea
                value={cfg.text || ""}
                onChange={(e) => updateConfig({ text: e.target.value })}
                rows={3}
                placeholder="Welcome to Fresh Foods Trading! What do you want?"
                className="w-full p-2.5 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-sans"
              />
              <div className="flex flex-wrap gap-1 mt-1.5">
                {PLACEHOLDERS.slice(0, 6).map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => updateConfig({ text: `${cfg.text || ""} ${p.tag}` })}
                    className="px-1.5 py-0.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 rounded text-[10px] font-mono transition"
                  >
                    + {p.tag}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Footer Text (Optional)</label>
              <input
                type="text"
                value={cfg.footer_text || ""}
                onChange={(e) => updateConfig({ footer_text: e.target.value })}
                placeholder="e.g. Tap an option or reply with number"
                className="w-full px-3 py-1.5 text-xs border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase">Quick Reply Buttons</h4>
                  <p className="text-[10px] text-slate-400">Max 3 buttons (WhatsApp Cloud API rule)</p>
                </div>
                {(cfg.buttons || []).length < 3 && (
                  <button
                    type="button"
                    onClick={() => {
                      const btns = [...(cfg.buttons || [])];
                      const idx = btns.length + 1;
                      btns.push({
                        id: `btn_${Date.now()}`,
                        reply_id: `BTN_${idx}`,
                        title: `Option ${idx}`,
                        label: `Option ${idx}`,
                        next_node_key: "",
                        nextNodeId: ""
                      });
                      updateConfig({ buttons: btns });
                    }}
                    className="px-2 py-1 bg-teal-100 text-teal-800 text-[10px] font-bold rounded-lg hover:bg-teal-200 flex items-center gap-1"
                  >
                    <Plus size={12} /> Add Button
                  </button>
                )}
              </div>

              {(cfg.buttons || []).map((btn, bIdx) => (
                <div key={bIdx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-teal-700 bg-teal-100 w-5 h-5 rounded-full flex items-center justify-center shrink-0">
                      {bIdx + 1}
                    </span>
                    <input
                      type="text"
                      value={btn.title || btn.label || ""}
                      onChange={(e) => {
                        const btns = [...cfg.buttons];
                        btns[bIdx] = { ...btns[bIdx], title: e.target.value, label: e.target.value };
                        updateConfig({ buttons: btns });
                      }}
                      placeholder="Button Title (e.g. 📦 View Full Menu)"
                      className="flex-1 px-2.5 py-1 text-xs font-semibold bg-white border rounded"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const btns = cfg.buttons.filter((_, i) => i !== bIdx);
                        updateConfig({ buttons: btns });
                      }}
                      className="text-slate-400 hover:text-rose-500 p-1"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 shrink-0">Button ID:</span>
                    <input
                      type="text"
                      value={btn.reply_id || btn.id || ""}
                      onChange={(e) => {
                        const btns = [...cfg.buttons];
                        btns[bIdx] = { ...btns[bIdx], reply_id: e.target.value, id: e.target.value };
                        updateConfig({ buttons: btns });
                      }}
                      placeholder="VIEW_MENU"
                      className="flex-1 px-2 py-0.5 text-[11px] font-mono bg-white border rounded"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 font-semibold shrink-0">Next Step:</span>
                    <select
                      value={btn.next_node_key || btn.nextNodeId || ""}
                      onChange={(e) => {
                        const btns = [...cfg.buttons];
                        btns[bIdx] = { ...btns[bIdx], next_node_key: e.target.value, nextNodeId: e.target.value };
                        updateConfig({ buttons: btns });
                      }}
                      className="flex-1 px-2 py-1 text-xs bg-white border rounded font-mono font-bold text-teal-800"
                    >
                      <option value="">-- Connect Next Node --</option>
                      {nodes.map(n => (
                        <option key={n.node_key} value={n.node_key}>
                          {n.node_key} ({n.node_type})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── LIST MENU ("VIEW ALL") CONFIGURATION ───────────────────── */}
        {selectedNode.node_type === "send_list" && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">Message Body Text *</label>
                <span className="text-[10px] text-slate-400">Supports variables</span>
              </div>
              <textarea
                value={cfg.text || cfg.body || ""}
                onChange={(e) => updateConfig({ text: e.target.value, body: e.target.value })}
                rows={2}
                placeholder="Select a category to see products 👇"
                className="w-full p-2.5 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-sans"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">"View All" Button Text</label>
                <input
                  type="text"
                  value={cfg.button_text || ""}
                  onChange={(e) => updateConfig({ button_text: e.target.value })}
                  placeholder="View All Categories"
                  className="w-full px-2.5 py-1.5 text-xs border rounded-lg outline-none font-bold text-cyan-800"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Popup List Title</label>
                <input
                  type="text"
                  value={cfg.title || ""}
                  onChange={(e) => updateConfig({ title: e.target.value })}
                  placeholder="Our Categories"
                  className="w-full px-2.5 py-1.5 text-xs border rounded-lg outline-none"
                />
              </div>
            </div>

            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase">List Rows / Categories</h4>
                  <p className="text-[10px] text-slate-400">Max 10 items (WhatsApp Cloud API rule)</p>
                </div>
                {(cfg.rows || []).length < 10 && (
                  <button
                    type="button"
                    onClick={() => {
                      const rows = [...(cfg.rows || [])];
                      const idx = rows.length + 1;
                      rows.push({
                        id: `CAT_${idx}`,
                        reply_id: `CAT_${idx}`,
                        title: `Category ${idx}`,
                        description: `Description ${idx}`,
                        next_node_key: "",
                        nextNodeId: ""
                      });
                      updateConfig({ rows, buttons: rows });
                    }}
                    className="px-2 py-1 bg-cyan-100 text-cyan-800 text-[10px] font-bold rounded-lg hover:bg-cyan-200 flex items-center gap-1"
                  >
                    <Plus size={12} /> Add Item
                  </button>
                )}
              </div>

              {(cfg.rows || []).map((row, rIdx) => (
                <div key={rIdx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-cyan-700 bg-cyan-100 w-5 h-5 rounded-full flex items-center justify-center shrink-0">
                      {rIdx + 1}
                    </span>
                    <input
                      type="text"
                      value={row.title || ""}
                      onChange={(e) => {
                        const rows = [...cfg.rows];
                        rows[rIdx] = { ...rows[rIdx], title: e.target.value };
                        updateConfig({ rows, buttons: rows });
                      }}
                      placeholder="Title (e.g. Dry Fruits & Nuts)"
                      className="flex-1 px-2.5 py-1 text-xs font-semibold bg-white border rounded"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const rows = cfg.rows.filter((_, i) => i !== rIdx);
                        updateConfig({ rows, buttons: rows });
                      }}
                      className="text-slate-400 hover:text-rose-500 p-1"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div>
                    <input
                      type="text"
                      value={row.description || ""}
                      onChange={(e) => {
                        const rows = [...cfg.rows];
                        rows[rIdx] = { ...rows[rIdx], description: e.target.value };
                        updateConfig({ rows, buttons: rows });
                      }}
                      placeholder="Short Description (e.g. Premium quality 1kg packs)"
                      className="w-full px-2 py-1 text-[11px] bg-white border rounded"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 font-semibold shrink-0">Next Step:</span>
                    <select
                      value={row.next_node_key || row.nextNodeId || ""}
                      onChange={(e) => {
                        const rows = [...cfg.rows];
                        rows[rIdx] = { ...rows[rIdx], next_node_key: e.target.value, nextNodeId: e.target.value };
                        updateConfig({ rows, buttons: rows });
                      }}
                      className="flex-1 px-2 py-1 text-xs bg-white border rounded font-mono font-bold text-cyan-800"
                    >
                      <option value="">-- Connect Next Node --</option>
                      {nodes.map(n => (
                        <option key={n.node_key} value={n.node_key}>
                          {n.node_key} ({n.node_type})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TEXT MESSAGE CONFIGURATION ────────────────────────────── */}
        {selectedNode.node_type === "send_message" && (
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">Message Text *</label>
                <span className="text-[10px] text-slate-400">Supports variables</span>
              </div>
              <textarea
                value={cfg.text || ""}
                onChange={(e) => updateConfig({ text: e.target.value })}
                rows={4}
                placeholder="Thank you for contacting Fresh Foods Trading!..."
                className="w-full p-2.5 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-sans"
              />
              <div className="flex flex-wrap gap-1 mt-1.5">
                {PLACEHOLDERS.slice(0, 6).map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => updateConfig({ text: `${cfg.text || ""} ${p.tag}` })}
                    className="px-1.5 py-0.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 rounded text-[10px] font-mono transition"
                  >
                    + {p.tag}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Next Step Node</label>
              <select
                value={cfg.next_node_key || ""}
                onChange={(e) => updateConfig({ next_node_key: e.target.value })}
                className="w-full p-2 text-xs border rounded-lg bg-white font-mono"
              >
                <option value="">-- End Flow or Stop --</option>
                {nodes.map(n => <option key={n.node_key} value={n.node_key}>{n.node_key} ({n.node_type})</option>)}
              </select>
            </div>
          </div>
        )}

        {selectedNode.node_type === "send_cta" && (
          <div className="space-y-3">
            <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200 text-[11px] text-sky-900 leading-relaxed">
              A <strong>native CTA URL button</strong>. The link is hidden behind the button label, so the customer
              sees a clean tappable button instead of a pasted URL. Needs the <strong>WhatsApp Cloud API</strong>; on a
              QR/web session the same message goes out as text with the link appended.
              <br />
              Meta allows <strong>one</strong> link button per message, and it cannot be combined with reply buttons.
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">Message Text *</label>
                <span className="text-[10px] text-slate-400">Supports variables</span>
              </div>
              <textarea
                value={cfg.text || ""}
                onChange={(e) => updateConfig({ text: e.target.value })}
                rows={3}
                placeholder="Your quotation {quote_no} is ready."
                className="w-full p-2.5 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-sky-500 font-sans"
              />
              <div className="flex flex-wrap gap-1 mt-1.5">
                {PLACEHOLDERS.slice(0, 6).map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => updateConfig({ text: `${cfg.text || ""} ${p.tag}` })}
                    className="px-1.5 py-0.5 bg-slate-100 hover:bg-sky-50 hover:text-sky-700 text-slate-600 rounded text-[10px] font-mono transition"
                  >
                    + {p.tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Button Label *</label>
                <input
                  value={cfg.button_text || ""}
                  maxLength={20}
                  onChange={(e) => updateConfig({ button_text: e.target.value })}
                  placeholder="View Quote"
                  className="w-full p-2 text-xs border rounded-lg outline-none focus:ring-2 focus:ring-sky-500"
                />
                <span className="text-[10px] text-slate-400">{(cfg.button_text || "").length}/20 chars</span>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Footer (optional)</label>
                <input
                  value={cfg.footer_text || ""}
                  maxLength={60}
                  onChange={(e) => updateConfig({ footer_text: e.target.value })}
                  placeholder="Madhura Tech"
                  className="w-full p-2 text-xs border rounded-lg outline-none focus:ring-2 focus:ring-sky-500"
                />
                <span className="text-[10px] text-slate-400">{(cfg.footer_text || "").length}/60 chars</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Link URL *</label>
              <input
                value={cfg.url || ""}
                onChange={(e) => updateConfig({ url: e.target.value })}
                placeholder="https://madhuratech.com/quote/{quote_no}"
                className="w-full p-2 text-xs border rounded-lg font-mono outline-none focus:ring-2 focus:ring-sky-500"
              />
              {cfg.url && !/^https?:\/\//i.test(cfg.url) ? (
                <span className="text-[10px] text-rose-600 font-semibold">
                  Must start with http:// or https:// — Meta rejects anything else, and this step will be skipped.
                </span>
              ) : (
                <span className="text-[10px] text-slate-400">Variables are substituted before sending</span>
              )}
            </div>

            {/* WhatsApp preview */}
            <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Preview</span>
              <div className="mt-1.5 bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                <p className="text-xs text-slate-800 whitespace-pre-line p-2.5 leading-relaxed">
                  {cfg.text || "Your message text..."}
                </p>
                {cfg.footer_text && <p className="text-[10px] text-slate-400 px-2.5 pb-1.5">{cfg.footer_text}</p>}
                <div className="border-t border-slate-200 py-2 text-center text-[13px] font-medium text-[#00a5f4] flex items-center justify-center gap-1.5">
                  <Globe size={12} />
                  {cfg.button_text || "Button label"}
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Next Step Node</label>
              <select
                value={cfg.next_node_key || ""}
                onChange={(e) => updateConfig({ next_node_key: e.target.value })}
                className="w-full p-2 text-xs border rounded-lg bg-white font-mono"
              >
                <option value="">-- End Flow or Stop --</option>
                {nodes
                  .filter((n) => n.node_key !== selectedNode.node_key)
                  .map((n) => (
                    <option key={n.node_key} value={n.node_key}>
                      {n.node_key} ({n.node_type})
                    </option>
                  ))}
              </select>
              <span className="text-[10px] text-slate-400">
                A link button returns no reply, so the flow continues here immediately after sending.
              </span>
            </div>
          </div>
        )}

        {/* ── MEDIA / PDF CATALOG CONFIGURATION ─────────────────────── */}
        {selectedNode.node_type === "send_media" && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Media URL or Catalog Link</label>
              <input
                type="text"
                value={cfg.url || ""}
                onChange={(e) => updateConfig({ url: e.target.value })}
                placeholder="https://yourdomain.com/catalog.pdf"
                className="w-full p-2 text-xs border rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Media Type</label>
              <select
                value={cfg.media_type || "document"}
                onChange={(e) => updateConfig({ media_type: e.target.value })}
                className="w-full p-2 text-xs border rounded-lg bg-white"
              >
                <option value="document">Document / PDF Catalog</option>
                <option value="image">Product Image (JPEG / PNG)</option>
                <option value="video">Product Video (MP4)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Caption Text</label>
              <input
                type="text"
                value={cfg.caption || ""}
                onChange={(e) => updateConfig({ caption: e.target.value })}
                placeholder="Here is our wholesale catalog!"
                className="w-full p-2 text-xs border rounded-lg"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Next Step Node</label>
              <select
                value={cfg.next_node_key || ""}
                onChange={(e) => updateConfig({ next_node_key: e.target.value })}
                className="w-full p-2 text-xs border rounded-lg bg-white font-mono"
              >
                <option value="">-- Select Next Step --</option>
                {nodes.map(n => <option key={n.node_key} value={n.node_key}>{n.node_key} ({n.node_type})</option>)}
              </select>
            </div>
          </div>
        )}

        {/* ── CONDITION BRANCHING CONFIGURATION ─────────────────────── */}
        {selectedNode.node_type === "condition" && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Subject Variable</label>
              <input
                type="text"
                value={cfg.subject_key || "input"}
                onChange={(e) => updateConfig({ subject_key: e.target.value })}
                placeholder="e.g. income / city / service / selected_option"
                className="w-full p-2 text-xs font-mono border rounded-lg"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Comparison Operator</label>
              <select
                value={cfg.operator || "equals"}
                onChange={(e) => updateConfig({ operator: e.target.value })}
                className="w-full p-2 text-xs border rounded-lg bg-white"
              >
                <option value="equals">Equals (=)</option>
                <option value="not_equals">Not Equals (!=)</option>
                <option value="contains">Contains text</option>
                <option value="greater_or_equal">Greater than or Equal (&gt;=)</option>
                <option value="greater_than">Greater than (&gt;)</option>
                <option value="less_than">Less than (&lt;)</option>
                <option value="is_numeric">Is Numeric</option>
                <option value="is_not_empty">Is Not Empty / Present</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Comparison Target Value</label>
              <input
                type="text"
                value={cfg.value || ""}
                onChange={(e) => updateConfig({ value: e.target.value })}
                placeholder="e.g. 25000 / yes / Bangalore"
                className="w-full p-2 text-xs font-mono border rounded-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <div>
                <label className="text-[10px] font-bold text-emerald-800 uppercase block mb-1">YES (True) Next Step</label>
                <select
                  value={cfg.true_next || ""}
                  onChange={(e) => updateConfig({ true_next: e.target.value })}
                  className="w-full p-1.5 text-xs bg-emerald-50 border border-emerald-300 rounded font-mono"
                >
                  <option value="">-- Target --</option>
                  {nodes.map(n => <option key={n.node_key} value={n.node_key}>{n.node_key}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-amber-800 uppercase block mb-1">NO (False) Next Step</label>
                <select
                  value={cfg.false_next || ""}
                  onChange={(e) => updateConfig({ false_next: e.target.value })}
                  className="w-full p-1.5 text-xs bg-amber-50 border border-amber-300 rounded font-mono"
                >
                  <option value="">-- Target --</option>
                  {nodes.map(n => <option key={n.node_key} value={n.node_key}>{n.node_key}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* ── CRM LOOKUP CONFIGURATION ──────────────────────────────── */}
        {selectedNode.node_type === "crm_lookup" && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">CRM Data to Fetch</label>
              <select
                value={cfg.lookup_type || "customer"}
                onChange={(e) => updateConfig({ lookup_type: e.target.value })}
                className="w-full p-2 text-xs border rounded-lg bg-white"
              >
                <option value="customer">Customer Profile (Name, Phone, City, Balance)</option>
                <option value="invoice">Latest Outstanding Invoice &amp; Due Date</option>
                <option value="amc">Active AMC Maintenance Contract &amp; Expiry</option>
                <option value="service_ticket">Latest Service Ticket Status</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Next Step Node</label>
              <select
                value={cfg.next_node_key || ""}
                onChange={(e) => updateConfig({ next_node_key: e.target.value })}
                className="w-full p-2 text-xs border rounded-lg bg-white font-mono"
              >
                <option value="">-- Select Next Step --</option>
                {nodes.map(n => <option key={n.node_key} value={n.node_key}>{n.node_key} ({n.node_type})</option>)}
              </select>
            </div>
          </div>
        )}

        {/* ── COLLECT INPUT CONFIGURATION ───────────────────────────── */}
        {selectedNode.node_type === "collect_input" && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Question Prompt Text</label>
              <textarea
                value={cfg.prompt_text || ""}
                onChange={(e) => updateConfig({ prompt_text: e.target.value })}
                rows={2}
                placeholder="Please enter your income / details:"
                className="w-full p-2 text-xs border rounded-lg"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Save Answer in Variable</label>
              <input
                type="text"
                value={cfg.var_key || ""}
                onChange={(e) => updateConfig({ var_key: e.target.value })}
                placeholder="e.g. income / email / city"
                className="w-full p-2 text-xs font-mono border rounded-lg"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Next Step Node</label>
              <select
                value={cfg.next_node_key || ""}
                onChange={(e) => updateConfig({ next_node_key: e.target.value })}
                className="w-full p-2 text-xs border rounded-lg bg-white font-mono"
              >
                <option value="">-- Select Next Step --</option>
                {nodes.map(n => <option key={n.node_key} value={n.node_key}>{n.node_key}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* ── LIVE AGENT HANDOFF CONFIGURATION ──────────────────────── */}
        {selectedNode.node_type === "handoff" && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Handoff Notification Note</label>
              <input
                type="text"
                value={cfg.note || ""}
                onChange={(e) => updateConfig({ note: e.target.value })}
                placeholder="Connecting you to our specialist..."
                className="w-full p-2 text-xs border rounded-lg"
              />
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
              <p className="font-bold flex items-center gap-1"><ShieldAlert size={14} /> Agent Transfer Protocol</p>
              <p className="text-[11px] text-amber-800">
                1. Pauses bot automation for 120 minutes.<br />
                2. Alerts live CRM support dashboard with customer variables.<br />
                3. Allows human agents to take over in real time.
              </p>
            </div>
          </div>
        )}

        {/* ── CREATE CRM LEAD CONFIGURATION ─────────────────────────── */}
        {selectedNode.node_type === "create_lead" && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Product or Service Category</label>
              <input
                type="text"
                value={cfg.default_service || ""}
                onChange={(e) => updateConfig({ default_service: e.target.value })}
                placeholder="e.g. Wholesale Food Order / Direct Order"
                className="w-full p-2 text-xs border rounded-lg font-semibold"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Lead Notes Template (supports variables)</label>
              <textarea
                value={cfg.notes || ""}
                onChange={(e) => updateConfig({ notes: e.target.value })}
                rows={2}
                placeholder="Order: {{order_details}} / City: {{city}}"
                className="w-full p-2 text-xs font-mono border rounded-lg"
              />
            </div>
            <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900">
              <p className="font-bold flex items-center gap-1">💼 Auto CRM Lead Capture</p>
              <p className="text-[10px] text-blue-800 leading-relaxed">
                Automatically registers customer phone number, name, inquiry details &amp; city straight into your CRM Telecalls &amp; Leads table.
              </p>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Next Step Node</label>
              <select
                value={cfg.next_node_key || ""}
                onChange={(e) => updateConfig({ next_node_key: e.target.value })}
                className="w-full p-2 text-xs border rounded-lg bg-white font-mono"
              >
                <option value="">-- Select Next Step --</option>
                {nodes.map(n => <option key={n.node_key} value={n.node_key}>{n.node_key} ({n.node_type})</option>)}
              </select>
            </div>
          </div>
        )}

        {/* ── API WEBHOOK REST CALL CONFIGURATION ────────────────────── */}
        {selectedNode.node_type === "api_webhook" && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Method</label>
                <select
                  value={cfg.method || "GET"}
                  onChange={(e) => updateConfig({ method: e.target.value })}
                  className="w-full p-2 text-xs border rounded-lg bg-white font-mono font-bold"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1">Endpoint URL</label>
                <input
                  type="text"
                  value={cfg.url || ""}
                  onChange={(e) => updateConfig({ url: e.target.value })}
                  placeholder="https://api.example.com/order"
                  className="w-full p-2 text-xs border rounded-lg font-mono"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Next Step Node</label>
              <select
                value={cfg.next_node_key || ""}
                onChange={(e) => updateConfig({ next_node_key: e.target.value })}
                className="w-full p-2 text-xs border rounded-lg bg-white font-mono"
              >
                <option value="">-- Select Next Step --</option>
                {nodes.map(n => <option key={n.node_key} value={n.node_key}>{n.node_key} ({n.node_type})</option>)}
              </select>
            </div>
          </div>
        )}

        {/* ── PACING DELAY CONFIGURATION ────────────────────────────── */}
        {selectedNode.node_type === "delay" && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Typing Delay Duration (Seconds)</label>
              <input
                type="number"
                min="1"
                max="30"
                value={cfg.delay_seconds || 2}
                onChange={(e) => updateConfig({ delay_seconds: parseInt(e.target.value, 10) || 1 })}
                className="w-full p-2 text-xs border rounded-lg font-mono font-bold"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Next Step Node</label>
              <select
                value={cfg.next_node_key || ""}
                onChange={(e) => updateConfig({ next_node_key: e.target.value })}
                className="w-full p-2 text-xs border rounded-lg bg-white font-mono"
              >
                <option value="">-- Select Next Step --</option>
                {nodes.map(n => <option key={n.node_key} value={n.node_key}>{n.node_key} ({n.node_type})</option>)}
              </select>
            </div>
          </div>
        )}

        {/* ── FLOW TRIGGERS CONFIGURATION (Start / Inbound / Keywords) ── */}
        {(selectedNode.node_type === "start" || selectedNode.node_type?.includes("trigger")) && (
          <div className="space-y-3">
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
              <span className="font-bold flex items-center gap-1">
                <span>🚀</span>
                <span>Flow Entry Trigger Point</span>
              </span>
              <p className="text-[10px] text-amber-700">
                This is the entry node where incoming WhatsApp messages begin this automated journey.
              </p>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Trigger Description / Label</label>
              <input
                type="text"
                value={cfg.trigger_label || ""}
                onChange={(e) => updateConfig({ trigger_label: e.target.value })}
                placeholder="e.g. Welcome Greeting & Menu"
                className="w-full p-2 text-xs border rounded-lg"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Trigger Keywords (comma-separated)</label>
              <input
                type="text"
                value={Array.isArray(cfg.keywords) ? cfg.keywords.join(", ") : (cfg.keywords || "")}
                onChange={(e) => updateConfig({ keywords: e.target.value.split(",").map(k => k.trim()) })}
                placeholder="e.g. hi, hello, food, menu, order, amc, catalog"
                className="w-full p-2 text-xs font-mono border rounded-lg"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Next Step Node *</label>
              <select
                value={cfg.next_node_key || ""}
                onChange={(e) => updateConfig({ next_node_key: e.target.value })}
                className="w-full p-2 text-xs border rounded-lg bg-white font-mono font-semibold"
              >
                <option value="">-- Select Next Step --</option>
                {nodes.filter(n => n.node_key !== selectedNode.node_key).map(n => (
                  <option key={n.node_key} value={n.node_key}>{n.node_key} ({n.node_type})</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* ── WHATSAPP HSM TEMPLATE CONFIGURATION ─────────────────────── */}
        {selectedNode.node_type === "send_template" && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Approved Template Name *</label>
              <input
                type="text"
                value={cfg.template_name || ""}
                onChange={(e) => updateConfig({ template_name: e.target.value })}
                placeholder="e.g. order_confirmation_v1"
                className="w-full p-2 text-xs font-mono border rounded-lg"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Language Code</label>
              <input
                type="text"
                value={cfg.language_code || "en"}
                onChange={(e) => updateConfig({ language_code: e.target.value })}
                placeholder="e.g. en or hi"
                className="w-full p-2 text-xs font-mono border rounded-lg"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Next Step Node</label>
              <select
                value={cfg.next_node_key || ""}
                onChange={(e) => updateConfig({ next_node_key: e.target.value })}
                className="w-full p-2 text-xs border rounded-lg bg-white font-mono"
              >
                <option value="">-- Select Next Step --</option>
                {nodes.filter(n => n.node_key !== selectedNode.node_key).map(n => (
                  <option key={n.node_key} value={n.node_key}>{n.node_key} ({n.node_type})</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* ── SET SESSION VARIABLE CONFIGURATION ──────────────────────── */}
        {selectedNode.node_type === "set_variable" && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Variable Key Name *</label>
              <input
                type="text"
                value={cfg.var_key || ""}
                onChange={(e) => updateConfig({ var_key: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") })}
                placeholder="e.g. selected_category / order_item"
                className="w-full p-2 text-xs font-mono border rounded-lg"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Variable Value *</label>
              <input
                type="text"
                value={cfg.var_value || ""}
                onChange={(e) => updateConfig({ var_value: e.target.value })}
                placeholder="e.g. Spices & Masala or {{input}}"
                className="w-full p-2 text-xs border rounded-lg"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Next Step Node</label>
              <select
                value={cfg.next_node_key || ""}
                onChange={(e) => updateConfig({ next_node_key: e.target.value })}
                className="w-full p-2 text-xs border rounded-lg bg-white font-mono"
              >
                <option value="">-- Select Next Step --</option>
                {nodes.filter(n => n.node_key !== selectedNode.node_key).map(n => (
                  <option key={n.node_key} value={n.node_key}>{n.node_key} ({n.node_type})</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* ── AI INTENT ROUTER CONFIGURATION ──────────────────────────── */}
        {selectedNode.node_type === "ai_intent" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">Intent Branches</label>
              <button
                type="button"
                onClick={() => {
                  const intentName = prompt("Enter new intent branch key (e.g. pricing, catalog, help):");
                  if (intentName) {
                    const branches = { ...(cfg.branches || {}) };
                    branches[intentName.toLowerCase().trim()] = "";
                    updateConfig({ branches });
                  }
                }}
                className="text-[10px] text-fuchsia-600 font-bold hover:underline flex items-center gap-1"
              >
                + Add Intent
              </button>
            </div>
            <div className="space-y-2">
              {Object.entries(cfg.branches || { sales: "", support: "", pricing: "", fallback: "" }).map(([intent, targetKey], iIdx) => (
                <div key={iIdx} className="p-2 bg-slate-50 border rounded-lg flex items-center justify-between gap-2">
                  <span className="text-xs font-mono font-bold text-fuchsia-800 uppercase">{intent}</span>
                  <select
                    value={targetKey || ""}
                    onChange={(e) => {
                      const branches = { ...(cfg.branches || {}) };
                      branches[intent] = e.target.value;
                      updateConfig({ branches });
                    }}
                    className="flex-1 p-1 text-[11px] border rounded bg-white font-mono"
                  >
                    <option value="">-- Destination Node --</option>
                    {nodes.filter(n => n.node_key !== selectedNode.node_key).map(n => (
                      <option key={n.node_key} value={n.node_key}>{n.node_key}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── AI GENERATE CONFIGURATION ───────────────────────────────── */}
        {selectedNode.node_type === "ai_generate" && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">System Instructions / Context</label>
              <textarea
                value={cfg.prompt || ""}
                onChange={(e) => updateConfig({ prompt: e.target.value })}
                rows={3}
                placeholder="You are a helpful customer support assistant for Madhura..."
                className="w-full p-2 text-xs border rounded-lg"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Next Step Node</label>
              <select
                value={cfg.next_node_key || ""}
                onChange={(e) => updateConfig({ next_node_key: e.target.value })}
                className="w-full p-2 text-xs border rounded-lg bg-white font-mono"
              >
                <option value="">-- Select Next Step --</option>
                {nodes.filter(n => n.node_key !== selectedNode.node_key).map(n => (
                  <option key={n.node_key} value={n.node_key}>{n.node_key} ({n.node_type})</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* ── GENERIC FALLBACK FOR ANY NODE WITH NEXT STEP ────────────── */}
        {!["interactive_menu", "send_buttons", "send_list", "send_message", "send_media", "send_template", "send_cta", "condition", "ai_intent", "ai_generate", "crm_lookup", "collect_input", "create_lead", "delay", "api_webhook", "set_variable", "handoff", "end", "start"].includes(selectedNode.node_type) && !selectedNode.node_type?.includes("trigger") && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Next Step Node</label>
              <select
                value={cfg.next_node_key || ""}
                onChange={(e) => updateConfig({ next_node_key: e.target.value })}
                className="w-full p-2 text-xs border rounded-lg bg-white font-mono"
              >
                <option value="">-- Select Next Step --</option>
                {nodes.filter(n => n.node_key !== selectedNode.node_key).map(n => (
                  <option key={n.node_key} value={n.node_key}>{n.node_key} ({n.node_type})</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Render True-to-Life WhatsApp Smartphone Simulator ──────────────────────
  const renderWhatsAppPhoneSimulator = () => {
    return (
      // Dimensions clamp against the viewport so the device frame always
      // fits the inspector panel and the page on a 320px phone.
      <div
        style={{
          width: "min(340px, 100%)",
          height: "min(580px, calc(100dvh - 9rem))",
        }}
        className={`rounded-[40px] p-3 shadow-2xl flex flex-col border-[6px] transition-colors shrink-0 relative overflow-hidden select-none ${
          simDarkTheme ? "bg-[#0b141a] border-[#1f2c34] text-white" : "bg-[#efeae2] border-slate-800 text-slate-900"
        }`}
      >
        {/* Smartphone Camera Notch */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-24 h-4 bg-[#1f2c34] rounded-full z-30 flex items-center justify-center">
          <div className="w-2.5 h-2.5 rounded-full bg-black/60" />
        </div>

        {/* WhatsApp Top App Bar */}
        <div className={`pt-4 pb-2 px-2 flex items-center justify-between border-b shrink-0 z-20 ${
          simDarkTheme ? "bg-[#202c33] border-[#2a3942] text-white" : "bg-[#008069] border-[#008069] text-white"
        }`}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-xs border border-emerald-400/40">
              🤖
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold truncate max-w-[130px]">{flowName || "Flowbot preview"}</span>
                <CheckCircle2 size={12} className="text-emerald-400 shrink-0 fill-emerald-400/20" />
              </div>
              <p className="text-[9px] text-emerald-400 font-semibold leading-tight">online • automated</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-white/80">
            <PhoneCall size={14} className="hover:text-white cursor-pointer" />
            <button
              onClick={() => setSimDarkTheme(!simDarkTheme)}
              className="p-1 rounded-full hover:bg-white/10"
              title="Toggle Dark/Light theme"
            >
              {simDarkTheme ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <button
              onClick={resetSimulation}
              className="p-1 rounded-full hover:bg-white/10"
              title="Restart Simulation"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>

        {/* WhatsApp Chat Area Background Pattern */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 relative z-10 text-xs font-sans">
          {/* Encryption pill */}
          <div className="text-center my-1">
            <span className={`px-2.5 py-1 rounded-md text-[9px] font-medium inline-flex items-center gap-1 shadow-sm ${
              simDarkTheme ? "bg-[#182229] text-[#ffd279]" : "bg-[#ffeecd] text-amber-900"
            }`}>
              🔒 Preview only ? No messages are sent
            </span>
          </div>

          {/* Render Messages */}
          {simMessages.map((msg, mIdx) => {
            const isBot = msg.sender === "bot";
            const interactiveMenu = getInteractiveMessage(msg);
            const timeStr = new Date(msg.at || Date.now()).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

            return (
              <div key={mIdx} className={`flex flex-col ${isBot ? "items-start" : "items-end"}`}>
                <div className={`max-w-[85%] rounded-2xl p-2.5 shadow-md relative text-xs ${
                  isBot
                    ? (simDarkTheme ? "bg-[#202c33] text-[#e9edef] rounded-tl-sm border border-[#2a3942]" : "bg-white text-slate-800 rounded-tl-sm")
                    : (simDarkTheme ? "bg-[#005c4b] text-[#e9edef] rounded-tr-sm" : "bg-[#d9fdd3] text-slate-800 rounded-tr-sm")
                }`}>
                  {/* Message Main Body */}
                  <p className="whitespace-pre-line leading-relaxed text-[11px] font-sans">
                    {interactiveMenu?.header && <strong className="block mb-1">{interactiveMenu.header}</strong>}
                    {interactiveMenu ? interactiveMenu.body : msg.text}
                  </p>

                  <WAInteractiveOptions
                    menu={interactiveMenu}
                    dark={simDarkTheme}
                    disabled={simTyping || simEnded || mIdx !== simMessages.length - 1}
                    onReply={(value, title) => executeSimStep(value, title)}
                  />

                  {/* Timestamp & Double Checkmarks */}
                  <div className="flex items-center justify-end gap-1 mt-1 text-[9px] opacity-60">
                    <span>{timeStr}</span>
                    {!isBot && <span className="text-emerald-400">✓✓</span>}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Typing Indicator */}
          {simTyping && (
            <div className="flex items-center gap-1.5 p-2 rounded-xl bg-[#202c33] text-[#00a884] text-[10px] w-24">
              <span className="animate-bounce">●</span>
              <span className="animate-bounce delay-100">●</span>
              <span className="animate-bounce delay-200">●</span>
              <span className="italic">typing</span>
            </div>
          )}
          <div ref={simChatBottomRef} />
        </div>

        {/* WhatsApp Bottom Chat Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (simInputText.trim()) {
              const text = simInputText.trim();
              setSimInputText("");
              executeSimStep(text);
            }
          }}
          className={`p-2 rounded-b-[30px] flex items-center gap-1.5 border-t shrink-0 z-20 ${
            simDarkTheme ? "bg-[#202c33] border-[#2a3942]" : "bg-[#f0f2f5] border-slate-200"
          }`}
        >
          <input
            type="text"
            value={simInputText}
            onChange={(e) => setSimInputText(e.target.value)}
            placeholder="Type a message or option #..."
            className={`flex-1 px-3 py-1.5 rounded-full text-xs outline-none ${
              simDarkTheme ? "bg-[#2a3942] text-white placeholder-slate-400" : "bg-white text-slate-900 border"
            }`}
          />
          <button
            type="submit"
            disabled={simTyping || !simInputText.trim()}
            className="w-7 h-7 rounded-full bg-[#00a884] text-white flex items-center justify-center hover:scale-105 transition disabled:opacity-50"
          >
            <Send size={12} />
          </button>
        </form>

        {/* List Selector Popup Drawer in Phone Mockup */}
        {simListPopup && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs z-40 flex flex-col justify-end animate-in fade-in duration-150">
            <div className={`rounded-t-3xl p-3.5 max-h-[75%] flex flex-col shadow-2xl border-t ${
              simDarkTheme ? "bg-[#1f2c34] border-[#2a3942] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}>
              <div className="flex items-center justify-between pb-2 border-b border-slate-700/30 mb-2">
                <div>
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">{simListPopup.title || "Our Categories"}</h4>
                  <p className="text-[10px] text-slate-400">Tap an option to view details</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSimListPopup(null)}
                  className="p-1 rounded-full text-slate-400 hover:text-white"
                >
                  <X size={15} />
                </button>
              </div>
              <div className="overflow-y-auto space-y-1.5 pr-1 max-h-56">
                {simListPopup.rows.map((row, rIdx) => (
                  <button
                    key={rIdx}
                    type="button"
                    onClick={() => {
                      setSimListPopup(null);
                      executeSimStep(row.id || row.title, row.title);
                    }}
                    className={`w-full p-2.5 rounded-xl text-left transition-all border flex items-center justify-between ${
                      simDarkTheme
                        ? "bg-[#111b21] hover:bg-[#202c33] border-[#2a3942] text-white"
                        : "bg-slate-50 hover:bg-emerald-50 border-slate-200 text-slate-900 hover:border-emerald-300"
                    }`}
                  >
                    <div className="pr-2">
                      <div className="text-xs font-bold text-emerald-500">{row.title}</div>
                      {row.description && <div className="text-[10px] text-slate-400 line-clamp-1">{row.description}</div>}
                    </div>
                    <ChevronRight size={13} className="text-emerald-500 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Render Fullscreen Studio Workspace (Portal directly into document.body) ─
  if (showStudio) {
    const studioContent = (
      <div id="madhura-visual-flow-studio" className="flow-studio-shell" style={{ position: "fixed", inset: 0, width: "100%", height: "100dvh", zIndex: 99999 }}>
        <WAFlowEditor
          nodes={nodes} categories={PALETTE_CATEGORIES} selectedKey={selectedNodeKey}
          onSelect={setSelectedNodeKey} onInspect={setSelectedNodeKey}
          onChange={(next, typing = false) => { if (typing) snapshotNodesThrottled(); else snapshotNodes(); setNodes(next); setDirty(true); }}
          onTransientChange={setNodes} onCommit={recordHistory} onAdd={addNodeFromPalette}
          canvasRef={canvasRef} zoom={zoom} pan={pan} setZoom={setZoom} setPan={setPan}
          onFit={fitToScreen} onLayout={autoLayout} onUndo={undo} onRedo={redo}
          canUndo={undoStackRef.current.length > 0} canRedo={redoStackRef.current.length > 0}
          name={flowName} setName={value => { setFlowName(value); setDirty(true); }} dirty={dirty} saving={saving} loading={studioLoading}
          onSave={() => handleSaveFlow(false)} onPublish={() => handleSaveFlow(true)} onExit={handleCloseStudio}
          issues={flowIssues} entry={entryNodeKey} panelRequest={studioPanelRequest}
          settings={<WAFlowOutline view="settings" nodes={nodes} issues={flowIssues} selectedKey={selectedNodeKey} name={flowName} description={flowDesc} trigger={flowTriggerType} keywords={flowKeywords} entry={entryNodeKey} onSelect={key => setSelectedNodeKey(key)} onChange={(key, value) => { ({ name: setFlowName, description: setFlowDesc, trigger: setFlowTriggerType, keywords: setFlowKeywords, entry: setFlowEntryNode })[key](value); setDirty(true); }} />}
          inspector={<div className="flow-studio-inspector-config">{renderNodeInspector()}</div>}
          onStartPreview={() => resetSimulation()}
          preview={<div>{simError && <p role="alert" className="wa-form-error mb-3">{simError}</p>}{renderWhatsAppPhoneSimulator()}</div>}
          logs={<div className="space-y-3 text-xs">{simLogs.length ? simLogs.map((log, index) => <pre key={index} className="whitespace-pre-wrap break-words p-3 bg-slate-50 rounded border">{typeof log === "string" ? log : JSON.stringify(log, null, 2)}</pre>) : <p className="p-4 text-slate-500">No simulation events yet. Open Preview and send a message to trace the conversation.</p>}</div>}
          notice={saveNotice} onDismissNotice={() => setSaveNotice(null)} loadError={studioLoadError} onRetry={() => openStudio({ id: editingFlowId })}
          onTest={() => openTestDialog()} flowId={editingFlowId} onVersions={() => openVersions(editingFlowId)}
          metadata={{ description: flowDesc, trigger_type: flowTriggerType, trigger_config: { keywords: flowKeywords.split(",").map(value => value.trim()).filter(Boolean) } }}
          onImportMetadata={value => { setFlowName(value.name || "Imported flow"); setFlowDesc(value.description || ""); setFlowTriggerType(["manual", "keyword", "all_inbound", "first_inbound"].includes(value.trigger_type) ? value.trigger_type : "manual"); setFlowKeywords((value.trigger_config?.keywords || []).join(", ")); setFlowEntryNode(value.entry_node_key || value.nodes[0].node_key); setDirty(true); }}
        />
        {showVersionsModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowVersionsModal(false)}>
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-4 sm:p-6 space-y-4 shadow-2xl text-slate-100 max-h-[92dvh] overflow-y-auto wa-custom-scrollbar" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Layers className="text-emerald-400" size={18} />
                  <h3 className="font-bold text-sm">Flow Snapshots &amp; Version History</h3>
                </div>
                <button onClick={() => setShowVersionsModal(false)} className="text-slate-400 hover:text-white">
                  <X size={16} />
                </button>
              </div>

              {/* Version History List */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {flowVersions.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">No snapshot versions yet. Publish your first version below.</p>
                ) : (
                  flowVersions.map(ver => (
                    <div key={ver.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-emerald-400">v{ver.version_number}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            ver.status === "published" ? "bg-emerald-900/60 text-emerald-300" : "bg-slate-800 text-slate-400"
                          }`}>
                            {ver.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 mt-0.5">{ver.changelog || "Snapshot"}</p>
                        <span className="text-[9px] text-slate-500">{new Date(ver.created_at).toLocaleString()}</span>
                      </div>

                      <button
                        onClick={() => handleRollbackVersion(ver.id)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700"
                      >
                        Restore
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Publish New Snapshot Form */}
              <div className="pt-3 border-t border-slate-800 space-y-2">
                <label className="text-xs font-bold text-slate-300 block">Publish New Snapshot</label>
                <input
                  type="text"
                  value={versionChangelog}
                  onChange={(e) => setVersionChangelog(e.target.value)}
                  placeholder="Changelog / Release Notes..."
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  onClick={() => handleSaveFlow(true)}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30"
                >
                  Publish Version Snapshot
                </button>
              </div>
            </div>
          </div>
        )}
        <FlowTestDialog
          request={testRequest}
          flowName={flowName}
          setFlowName={(value) => { setFlowName(value); setDirty(true); }}
          phone={testPhone}
          setPhone={setTestPhone}
          sending={testSending}
          savingDraft={saving}
          error={testError}
          sent={testSent}
          hasUnsavedChanges={Boolean(editingFlowId && dirty)}
          onClose={() => setTestRequest(null)}
          onSubmit={triggerFlowForPhone}
          onSaveDraft={saveDraftForTest}
        />
      </div>
    );

    return createPortal(studioContent, document.body);
  }

  // ── Main Flows Dashboard View ───────────────────────────────────────────────
  const filteredFlows = flows.filter(f =>
    (f.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (f.description || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="hl-page wa-flow-list">
      <WAWorkspaceGuide section="flows" />
      <WAStorageAndSenders />

      <div className="w-full min-w-0 space-y-4">
        <header className="hl-commandbar flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="hl-title">Conversation flows</h1>
            <p className="hl-subtitle">Build, validate, and monitor WhatsApp conversations.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button onClick={handleSeedFlows} className="hl-btn-secondary">
              <Database size={15} /> Load templates
            </button>
            <button onClick={() => navigate("/whatsapp/flows/create")} className="hl-btn-primary">
              <Plus size={16} /> Create flow
            </button>
          </div>
        </header>

        {loadError && <div role="alert" className="wa-flow-load-error"><AlertCircle size={17} /><span>{loadError}</span><button type="button" className="hl-btn-secondary" disabled={loading} onClick={fetchFlows}>Retry</button></div>}
        {/* View Tabs & Search Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-1 sm:gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm w-full sm:w-auto overflow-x-auto wa-no-scrollbar">
            <button
              onClick={() => setActiveTab("flows")}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap shrink-0 ${
                activeTab === "flows" ? "bg-emerald-50 text-emerald-800 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <GitFork size={15} />
              <span>Configured Flows ({flows.length})</span>
            </button>
            <button
              onClick={() => setActiveTab("runs")}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap shrink-0 ${
                activeTab === "runs" ? "bg-emerald-50 text-emerald-800 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Clock size={15} />
              <span>Live Run Audit</span>
            </button>
          </div>

          {activeTab === "flows" && (
            <div className="relative w-full sm:w-72 sm:min-w-0">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chatbot flows..."
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-2xl text-xs outline-none focus:ring-2 focus:ring-[#25D366] shadow-sm font-semibold"
              />
            </div>
          )}
        </div>

        {/* ── FLOWS CARD GRID VIEW ──────────────────────────────────── */}
        {activeTab === "flows" && (
          <div>
            {loading ? (
              <div className="py-20 text-center space-y-3">
                <Loader2 size={36} className="animate-spin text-[#25D366] mx-auto" />
                <p className="text-xs text-slate-500 font-bold">Loading Conversational Flows...</p>
              </div>
            ) : filteredFlows.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm space-y-4 max-w-lg mx-auto">
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                  <Bot size={28} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">No Chatbot Flows Configured</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Create a flow or load a starter template to open it in the visual builder.
                  </p>
                </div>
                <div className="flex justify-center gap-2 pt-2">
                  <button
                    onClick={handleSeedFlows}
                    className="px-4 py-2 bg-slate-100 text-slate-800 rounded-xl text-xs font-bold hover:bg-slate-200"
                  >
                    Load Templates
                  </button>
                  <button
                    onClick={() => navigate("/whatsapp/flows/create")}
                    className="px-4 py-2 bg-[#25D366] text-slate-900 rounded-xl text-xs font-bold hover:bg-[#20bd5a]"
                  >
                    Create Flow
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {filteredFlows.map((flow) => {
                  const isActive = flow.status === "active";
                  return (
                    <div
                      key={flow.id}
                      onClick={() => openStudio(flow)}
                      className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm hover:shadow-xl hover:border-emerald-300 transition-all duration-200 cursor-pointer flex flex-col justify-between group relative overflow-hidden"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide flex items-center gap-1 ${
                            isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
                            {flow.status}
                          </span>

                          <span className="text-[10px] font-mono text-slate-400">
                            {flow.trigger_type || "keyword"}
                          </span>
                        </div>

                        <div>
                          <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-700 transition line-clamp-1">
                            {flow.name}
                          </h3>
                          <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                            {flow.description || "No description added for this flow."}
                          </p>
                        </div>
                      </div>

                      {/* Card Footer Metrics & Actions */}
                      <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-3 text-[11px] text-slate-500 font-semibold">
                          <span>{flow.node_count || 0} Steps</span>
                          <span>•</span>
                          <span>{flow.active_runs || 0} Runs</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openTestDialog(flow.id, flow.name);
                            }}
                            className="p-2 text-cyan-600 hover:text-cyan-800 hover:bg-cyan-50 rounded-xl transition"
                            title="Send Flow Bot to Phone Number"
                          >
                            <Send size={15} />
                          </button>
                          <button
                            onClick={(e) => openAnalytics(flow, e)}
                            className="p-2 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition"
                            title="View Funnel Analytics"
                          >
                            <BarChart2 size={15} />
                          </button>
                          <button
                            onClick={(e) => handleToggleStatus(flow, e)}
                            className={`p-2 rounded-xl transition ${
                              isActive ? "text-emerald-600 hover:bg-emerald-50" : "text-slate-400 hover:bg-slate-100"
                            }`}
                            title={isActive ? "Pause Bot" : "Activate Bot"}
                          >
                            <Play size={15} className={isActive ? "fill-emerald-600" : ""} />
                          </button>
                          <button
                            onClick={(e) => handleDeleteFlow(flow.id, flow.name, e)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── LIVE AUDIT RUNS TAB ──────────────────────────────────── */}
        {activeTab === "runs" && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900 min-w-0">Recent flow executions</h3>
              {runsError && <p role="alert" className="text-xs text-red-700">{runsError}</p>}
              <button onClick={fetchRuns} disabled={loadingRuns} aria-label="Refresh execution history" className="p-2 text-slate-400 hover:text-slate-700 rounded-lg shrink-0">
                <RefreshCw size={14} />
              </button>
            </div>

            <div className="overflow-x-auto wa-custom-scrollbar">
              <table className="w-full min-w-[640px] text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3">Current Node</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Started</th>
                    <th className="p-3">Variables Captured</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingRuns ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">Loading execution runs...</td>
                    </tr>
                  ) : runsList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">{runsError || "No executions yet. Publish a flow and start a conversation to see its history."}</td>
                    </tr>
                  ) : (
                    runsList.map(run => {
                      let parsedVars = {};
                      try { parsedVars = typeof run.vars === "string" ? JSON.parse(run.vars) : (run.vars || {}); } catch (_) {}

                      return (
                        <tr key={`${run.flow_id}-${run.id}`} className="hover:bg-slate-50">
                          <td className="p-3 font-bold text-slate-900">{run.contact_name || "Unnamed contact"}<small className="block text-slate-500 font-normal">{run.flow_name}</small></td>
                          <td className="p-3 font-mono text-slate-600">+{run.phone}</td>
                          <td className="p-3 font-mono text-emerald-700 font-bold">{run.current_node_key || "start"}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                              run.status === "completed" ? "bg-emerald-100 text-emerald-800" :
                              run.status === "handed_off" ? "bg-rose-100 text-rose-800" : "bg-blue-100 text-blue-800"
                            }`}>
                              {run.status}
                            </span>
                          </td>
                          <td className="p-3 text-slate-400">{new Date(run.started_at).toLocaleString()}</td>
                          <td className="p-3">
                            <span className="font-mono text-[10px] text-slate-500 truncate max-w-xs block">
                              {Object.keys(parsedVars).length} captured
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── FLOW ANALYTICS MODAL ──────────────────────────────────── */}
        {showAnalyticsModal && selectedAnalyticsFlow && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowAnalyticsModal(false)}>
            <div className="bg-white rounded-3xl w-full max-w-2xl p-4 sm:p-6 space-y-6 shadow-2xl border border-slate-100 max-h-[92dvh] overflow-y-auto wa-custom-scrollbar" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between gap-3 border-b pb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <BarChart2 className="text-emerald-600 shrink-0" size={20} />
                  <div className="min-w-0">
                    <h3 className="font-bold text-base text-slate-900 truncate">Flow Performance &amp; Conversion Funnel</h3>
                    <p className="text-xs text-slate-500 truncate">{selectedAnalyticsFlow.name}</p>
                  </div>
                </div>
                <button onClick={() => setShowAnalyticsModal(false)} className="text-slate-400 hover:text-slate-600 shrink-0 p-1">
                  <X size={18} />
                </button>
              </div>

              {analyticsLoading ? (
                <div className="py-12 text-center text-slate-400 font-semibold">Loading analytics...</div>
              ) : (
                <div className="space-y-6">
                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 text-center">
                    <div className="p-3 bg-slate-50 rounded-2xl border">
                      <div className="text-lg font-extrabold text-slate-900">{analyticsData?.totalRuns || 0}</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Total Runs</div>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
                      <div className="text-lg font-extrabold text-emerald-700">{analyticsData?.completedRuns || 0}</div>
                      <div className="text-[10px] font-bold text-emerald-600 uppercase mt-0.5">Completed</div>
                    </div>
                    <div className="p-3 bg-rose-50 rounded-2xl border border-rose-100">
                      <div className="text-lg font-extrabold text-rose-700">{analyticsData?.handoffRuns || 0}</div>
                      <div className="text-[10px] font-bold text-rose-600 uppercase mt-0.5">Live Handoff</div>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100">
                      <div className="text-lg font-extrabold text-blue-700">{analyticsData?.activeRuns || 0}</div>
                      <div className="text-[10px] font-bold text-blue-600 uppercase mt-0.5">In Progress</div>
                    </div>
                  </div>

                  {/* Step Engagement Breakdown */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-800 uppercase">Top Interacted Steps &amp; Buttons</h4>
                    <div className="space-y-2">
                      {(analyticsData?.nodeDropoffs || []).map((node, i) => (
                        <div key={i} className="space-y-1">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="font-mono text-slate-700">{node.node_key}</span>
                            <span className="text-slate-500">{node.hit_count} hits</span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${Math.min(100, (node.hit_count / (analyticsData?.totalRuns || 1)) * 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        <FlowTestDialog
          request={testRequest}
          flowName={flowName}
          setFlowName={(value) => { setFlowName(value); setDirty(true); }}
          phone={testPhone}
          setPhone={setTestPhone}
          sending={testSending}
          savingDraft={saving}
          error={testError}
          sent={testSent}
          hasUnsavedChanges={false}
          onClose={() => setTestRequest(null)}
          onSubmit={triggerFlowForPhone}
          onSaveDraft={saveDraftForTest}
        />
      </div>
    </div>
  );
}
