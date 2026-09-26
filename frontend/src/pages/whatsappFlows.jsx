import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation, useParams, useSearchParams } from "react-router-dom";
import { createPortal } from "react-dom";
import axios from "axios";
import { API } from "../config/api";
import WhatsAppNav from "../components/WhatsAppNav";
import WAVariablePicker from "../components/WAVariablePicker";
import {
  Bot, Plus, Play, Edit2, Trash2, Loader2, GitFork, Send, X,
  Sparkles, PhoneCall, ArrowRight, Smartphone, Database, Globe,
  CheckCircle2, Clock, UserCheck, ShieldAlert, Cpu, ListOrdered,
  Layers, BarChart2, RefreshCw, HelpCircle, FileText,
  MoveUp, MoveDown, Zap, Search, Eye, Check, ChevronDown, ChevronRight,
  ZoomIn, ZoomOut, Maximize2, Minimize2, Grid, RotateCcw, Copy,
  ArrowDownRight, CheckSquare, Settings2, Sliders, MessageSquare,
  AlertCircle, Compass, Share2, Tag, Shield, Terminal, ArrowUpRight,
  Sun, Moon, CornerDownRight, HelpCircle as QuestionIcon, ChevronLeft
} from "lucide-react";

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
      { type: "interactive_menu", label: "Interactive Menu", icon: "📱", desc: "Multi-section button options", color: "border-emerald-500 bg-emerald-50 text-emerald-900" },
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

export default function WhatsAppFlows() {
  const navigate = useNavigate();
  const location = useLocation();
  const { flowId } = useParams();
  const [searchParams] = useSearchParams();
  const isBuildRoute = location.pathname.includes("/flows/build") || location.pathname.includes("/flows/builder");

  const [flows, setFlows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("flows"); // "flows" | "runs"
  const [searchQuery, setSearchQuery] = useState("");

  // Visual Studio / Editor State
  const [showStudio, setShowStudio] = useState(isBuildRoute);
  const [editingFlowId, setEditingFlowId] = useState(flowId || searchParams.get("id") || null);
  const [flowName, setFlowName] = useState("");
  const [flowDesc, setFlowDesc] = useState("");
  const [flowTriggerType, setFlowTriggerType] = useState("keyword");
  const [flowKeywords, setFlowKeywords] = useState("hi, hello, bank, menu, help");
  const [flowEntryNode, setFlowEntryNode] = useState("start");
  const [nodes, setNodes] = useState([]);
  const [selectedNodeKey, setSelectedNodeKey] = useState(null);
  const [activeInspectorTab, setActiveInspectorTab] = useState("config"); // "config" | "preview" | "audit"
  const [saving, setSaving] = useState(false);

  // Canvas Viewport State (Pan & Zoom)
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const canvasRef = useRef(null);

  // Node Dragging State
  const [draggingNodeKey, setDraggingNodeKey] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Edge Connection Drawing State
  const [connectingFrom, setConnectingFrom] = useState(null); // { nodeKey, portId, portType: 'button'|'true'|'false'|'next'|'intent', extraData }
  const [connectingMousePos, setConnectingMousePos] = useState({ x: 0, y: 0 });

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
  const [simInputText, setSimInputText] = useState("");
  const [simEnded, setSimEnded] = useState(false);
  const [showPalette, setShowPalette] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [paletteFilter, setPaletteFilter] = useState("");
  const simChatBottomRef = useRef(null);

  // Auto-scroll phone simulator chat bottom on new message or typing
  useEffect(() => {
    if (simChatBottomRef.current) {
      simChatBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [simMessages, simTyping]);

  // Global keybindings: Escape cancels active port connection / popups
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (connectingFrom) {
          setConnectingFrom(null);
        }
        if (simListPopup) {
          setSimListPopup(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [connectingFrom, simListPopup]);

  // Versions Modal State
  const [showVersionsModal, setShowVersionsModal] = useState(false);
  const [flowVersions, setFlowVersions] = useState([]);
  const [versionChangelog, setVersionChangelog] = useState("");
  const [publishingVersion, setPublishingVersion] = useState(false);

  // Analytics Modal State
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [selectedAnalyticsFlow, setSelectedAnalyticsFlow] = useState(null);

  // Runs Audit Tab State
  const [runsList, setRunsList] = useState([]);
  const [loadingRuns, setLoadingRuns] = useState(false);

  // Accordion open/close in palette
  const [openCategories, setOpenCategories] = useState({
    triggers: true,
    message: true,
    input: true,
    logic: true,
    action: true,
    control: true
  });

  const toggleCategory = (catId) => {
    setOpenCategories(prev => ({ ...prev, [catId]: !prev[catId] }));
  };

  // ── Fetch Flows List ────────────────────────────────────────────────────────
  const fetchFlows = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`${API}/api/wa-flows`, { headers });
      setFlows(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching flows:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlows();
  }, [fetchFlows]);

  // ── Fetch Audit Runs ────────────────────────────────────────────────────────
  const fetchRuns = async () => {
    try {
      setLoadingRuns(true);
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      // Fetch latest runs across active flows
      if (flows.length > 0) {
        const res = await axios.get(`${API}/api/wa-flows/${flows[0].id}/runs`, { headers });
        setRunsList(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {
      console.error("Error fetching runs:", err);
    } finally {
      setLoadingRuns(false);
    }
  };

  useEffect(() => {
    if (activeTab === "runs") {
      fetchRuns();
    }
  }, [activeTab]);

  // ── Sync Route with Visual Studio State ─────────────────────────────────────
  useEffect(() => {
    if (isBuildRoute) {
      const targetId = flowId || searchParams.get("id");
      if (targetId) {
        openStudio({ id: targetId });
      } else {
        openStudio(null);
      }
    } else {
      setShowStudio(false);
    }
  }, [location.pathname, flowId]);

  const handleCloseStudio = () => {
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
    const canvasWidth = canvasEl ? canvasEl.clientWidth : (window.innerWidth - (showPalette ? 260 : 0) - (showRightPanel ? 400 : 0));
    const canvasHeight = canvasEl ? canvasEl.clientHeight : (window.innerHeight - 56);

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    list.forEach(n => {
      const x = Number(n.position_x) || 0;
      const y = Number(n.position_y) || 0;
      if (x < minX) minX = x;
      if (x + 280 > maxX) maxX = x + 280;
      if (y < minY) minY = y;
      if (y + 200 > maxY) maxY = y + 200;
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
  }, [nodes, showPalette, showRightPanel]);

  const togglePreview = () => {
    if (showRightPanel && activeInspectorTab === "preview") {
      setShowRightPanel(false);
    } else {
      setShowRightPanel(true);
      setActiveInspectorTab("preview");
    }
  };

  const toggleInspector = () => {
    if (showRightPanel && activeInspectorTab === "config") {
      setShowRightPanel(false);
    } else {
      setShowRightPanel(true);
      setActiveInspectorTab("config");
    }
  };

  // ── Open Visual Studio for a Flow ───────────────────────────────────────────
  const openStudio = async (flow = null) => {
    setShowRightPanel(false);
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
        const res = await axios.get(`${API}/api/wa-flows/${flow.id}`, { headers });
        const fetchedNodes = res.data?.nodes || [];
        const loaded = fetchedNodes.length > 0 ? fetchedNodes : getDefaultStarterNodes();
        setNodes(loaded);
        setTimeout(() => fitToScreen(loaded), 150);
      } catch (e) {
        const fallback = getDefaultStarterNodes();
        setNodes(fallback);
        setTimeout(() => fitToScreen(fallback), 150);
      }
    } else {
      // Create new flow - Default to Food & Products interactive catalog bot
      setEditingFlowId(null);
      setFlowName("Food & Products Flow Bot");
      setFlowDesc("Interactive flow bot: Quick buttons -> Category List (View All Categories) -> Products -> Instant Orders & Bulk Quote");
      setFlowTriggerType("manual");
      setFlowKeywords("menu");
      setFlowEntryNode("start");
      const defaultNodes = getFoodBotStarterNodes();
      setNodes(defaultNodes);
      setSelectedNodeKey("welcome_menu");
      setTimeout(() => fitToScreen(defaultNodes), 150);
    }

    setShowStudio(true);
    resetSimulation();
  };

  const triggerFlowForPhone = async (phone, explicitFlowId = null) => {
    try {
      const targetFlowId = explicitFlowId || editingFlowId;
      if (!targetFlowId) {
        alert("Please save your flow first before sending it to a phone number.");
        return;
      }
      let cleanPhone = String(phone || "").replace(/\D/g, "");
      if (cleanPhone.length === 10) cleanPhone = "91" + cleanPhone;
      if (!cleanPhone || cleanPhone.length < 10) {
        alert("Please enter a valid phone number with country code (e.g. 919876543210)");
        return;
      }
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.post(`${API}/api/wa-flows/send-menu`, {
        phone: cleanPhone,
        flow_id: targetFlowId
      }, { headers });
      alert(`✅ Flow Bot sent successfully!\n${res.data.message || `Sent to +${cleanPhone}`}`);
    } catch (err) {
      alert(`❌ Error sending Flow Bot to WhatsApp: ${err.response?.data?.error || err.message}`);
    }
  };

  // ── Food & Products Flow Bot Template (Catalog, "View All" List, Orders & CRM Leads) ──
  const getFoodBotStarterNodes = () => [
    {
      node_key: "start",
      node_type: "start",
      config: { next_node_key: "welcome_menu" },
      position_x: 520,
      position_y: 40
    },
    {
      node_key: "welcome_menu",
      node_type: "send_buttons",
      config: {
        header_text: "Fresh Foods Trading 🍲",
        text: "Welcome to Fresh Foods Trading! 🍲\nWe have all food items - Retail & Wholesale.\n\nWhat do you want?",
        footer_text: "Tap an option or reply with number",
        buttons: [
          { id: "btn_menu", reply_id: "VIEW_MENU", title: "📦 View Full Menu", label: "📦 View Full Menu", next_node_key: "category_list", nextNodeId: "category_list" },
          { id: "btn_price", reply_id: "GET_PRICE", title: "💰 Get Bulk Price", label: "💰 Get Bulk Price", next_node_key: "ask_bulk_details", nextNodeId: "ask_bulk_details" },
          { id: "btn_sales", reply_id: "TALK_HUMAN", title: "👨💼 Talk to Sales", label: "👨💼 Talk to Sales", next_node_key: "sales_handoff", nextNodeId: "sales_handoff" }
        ]
      },
      position_x: 520,
      position_y: 180
    },
    {
      node_key: "category_list",
      node_type: "send_list",
      config: {
        text: "Select a category to see products 👇",
        button_text: "View All Categories",
        title: "Our Categories",
        rows: [
          { id: "CAT_DRYFRUITS", reply_id: "CAT_DRYFRUITS", title: "Dry Fruits & Nuts", description: "Premium quality 1kg packs", next_node_key: "dryfruits_products", nextNodeId: "dryfruits_products" },
          { id: "CAT_PICKLE", reply_id: "CAT_PICKLE", title: "Pickles & Podi", description: "Homemade 500g glass jars", next_node_key: "pickles_products", nextNodeId: "pickles_products" },
          { id: "CAT_RICE", reply_id: "CAT_RICE", title: "Rice & Grains", description: "Basmati, Millets & Ponni", next_node_key: "rice_products", nextNodeId: "rice_products" },
          { id: "CAT_MASALA", reply_id: "CAT_MASALA", title: "Masala & Spices", description: "Fresh ground spice kit", next_node_key: "masala_products", nextNodeId: "masala_products" }
        ]
      },
      position_x: 200,
      position_y: 420
    },
    {
      node_key: "dryfruits_products",
      node_type: "send_buttons",
      config: {
        header_text: "🌰 Dry Fruits & Nuts",
        text: "🌰 *Best Dry Fruits & Nuts:*\n\n1. Premium Almonds (Badam) - ₹720/kg\n2. Cashews (Kaju) W320 - ₹850/kg\n3. Walnut Kernels - ₹980/kg\n4. Golden Raisins - ₹320/kg\n\n100% fresh stock with airtight packaging.",
        footer_text: "Click below to order or get bulk rate",
        buttons: [
          { id: "btn_ord_df", reply_id: "ORDER_NOW", title: "🛒 Order Now", label: "🛒 Order Now", next_node_key: "ask_order_address", nextNodeId: "ask_order_address" },
          { id: "btn_prc_df", reply_id: "GET_PRICE", title: "💰 Bulk Price", label: "💰 Bulk Price", next_node_key: "ask_bulk_details", nextNodeId: "ask_bulk_details" },
          { id: "btn_bck_df", reply_id: "BACK_MENU", title: "🔙 Back to Menu", label: "🔙 Back to Menu", next_node_key: "welcome_menu", nextNodeId: "welcome_menu" }
        ]
      },
      position_x: 40,
      position_y: 680
    },
    {
      node_key: "pickles_products",
      node_type: "send_buttons",
      config: {
        header_text: "🌶️ Pickles & Podi",
        text: "🌶️ *Homemade Pickles & Podi:*\n\n1. Andhra Mango Avakaya (500g) - ₹180\n2. Lemon Pickle (500g) - ₹150\n3. Garlic Spicy Pickle (500g) - ₹210\n4. Traditional Idli/Dosa Podi (250g) - ₹120\n\nAuthentic grandma recipe with zero preservatives.",
        footer_text: "Click below to order or return to menu",
        buttons: [
          { id: "btn_ord_pk", reply_id: "ORDER_NOW", title: "🛒 Order Now", label: "🛒 Order Now", next_node_key: "ask_order_address", nextNodeId: "ask_order_address" },
          { id: "btn_prc_pk", reply_id: "GET_PRICE", title: "💰 Bulk Price", label: "💰 Bulk Price", next_node_key: "ask_bulk_details", nextNodeId: "ask_bulk_details" },
          { id: "btn_bck_pk", reply_id: "BACK_MENU", title: "🔙 Back to Menu", label: "🔙 Back to Menu", next_node_key: "welcome_menu", nextNodeId: "welcome_menu" }
        ]
      },
      position_x: 360,
      position_y: 680
    },
    {
      node_key: "rice_products",
      node_type: "send_buttons",
      config: {
        header_text: "🌾 Rice & Grains",
        text: "🌾 *Premium Rice & Grains:*\n\n1. Royal XXL Basmati Rice - ₹110/kg\n2. Sona Masoori Raw Rice - ₹58/kg\n3. Organic Foxtail Millet - ₹75/kg\n4. Unpolished Red/Brown Rice - ₹68/kg\n\nAvailable in retail 5kg/10kg and wholesale 25kg bags.",
        buttons: [
          { id: "btn_ord_rc", reply_id: "ORDER_NOW", title: "🛒 Order Now", label: "🛒 Order Now", next_node_key: "ask_order_address", nextNodeId: "ask_order_address" },
          { id: "btn_prc_rc", reply_id: "GET_PRICE", title: "💰 Bulk Price", label: "💰 Bulk Price", next_node_key: "ask_bulk_details", nextNodeId: "ask_bulk_details" },
          { id: "btn_bck_rc", reply_id: "BACK_MENU", title: "🔙 Back to Menu", label: "🔙 Back to Menu", next_node_key: "welcome_menu", nextNodeId: "welcome_menu" }
        ]
      },
      position_x: 680,
      position_y: 680
    },
    {
      node_key: "masala_products",
      node_type: "send_buttons",
      config: {
        header_text: "🌿 Masala & Spices",
        text: "🌿 *Pure Ground Spices:*\n\n1. Guntur Red Chilli Powder (1kg) - ₹340\n2. Salem Turmeric Powder (1kg) - ₹280\n3. Malabar Black Pepper (500g) - ₹420\n4. Garam Masala Blend (500g) - ₹290\n\nCold-ground for maximum aroma and flavor.",
        buttons: [
          { id: "btn_ord_ms", reply_id: "ORDER_NOW", title: "🛒 Order Now", label: "🛒 Order Now", next_node_key: "ask_order_address", nextNodeId: "ask_order_address" },
          { id: "btn_prc_ms", reply_id: "GET_PRICE", title: "💰 Bulk Price", label: "💰 Bulk Price", next_node_key: "ask_bulk_details", nextNodeId: "ask_bulk_details" },
          { id: "btn_bck_ms", reply_id: "BACK_MENU", title: "🔙 Back to Menu", label: "🔙 Back to Menu", next_node_key: "welcome_menu", nextNodeId: "welcome_menu" }
        ]
      },
      position_x: 1000,
      position_y: 680
    },
    {
      node_key: "ask_bulk_details",
      node_type: "collect_input",
      config: {
        prompt_text: "Great! Please reply with:\n1. Product Name\n2. Quantity you need (e.g. 10kg, 50kg)\n3. Your City\n\nOur team will send wholesale discounted price in 2 mins.",
        var_key: "bulk_enquiry",
        validation_type: "none",
        next_node_key: "save_bulk_lead"
      },
      position_x: 600,
      position_y: 420
    },
    {
      node_key: "save_bulk_lead",
      node_type: "create_lead",
      config: {
        default_service: "Wholesale Food Enquiry",
        notes: "Bulk Requirement: {{bulk_enquiry}}",
        next_node_key: "confirm_bulk"
      },
      position_x: 600,
      position_y: 580
    },
    {
      node_key: "confirm_bulk",
      node_type: "send_buttons",
      config: {
        header_text: "Quotation Requested ✅",
        text: "Thank you! We received your bulk requirement:\n\n\"{{bulk_enquiry}}\"\n\nOur wholesale executive is preparing your best quote right now.",
        buttons: [
          { id: "btn_bm", reply_id: "BACK_MENU", title: "🏠 Main Menu", label: "🏠 Main Menu", next_node_key: "welcome_menu", nextNodeId: "welcome_menu" },
          { id: "btn_th", reply_id: "TALK_HUMAN", title: "👨💼 Talk to Sales", label: "👨💼 Talk to Sales", next_node_key: "sales_handoff", nextNodeId: "sales_handoff" }
        ]
      },
      position_x: 600,
      position_y: 740
    },
    {
      node_key: "ask_order_address",
      node_type: "collect_input",
      config: {
        prompt_text: "Perfect! Please reply with your full delivery address and quantity.\nExample: 2kg Dry Fruits Mix, 1kg Pickle - Avinashi, Tiruppur",
        var_key: "order_details",
        validation_type: "none",
        next_node_key: "save_order_lead"
      },
      position_x: 200,
      position_y: 940
    },
    {
      node_key: "save_order_lead",
      node_type: "create_lead",
      config: {
        default_service: "Direct Food Order",
        notes: "Customer Order: {{order_details}}",
        next_node_key: "confirm_order"
      },
      position_x: 200,
      position_y: 1100
    },
    {
      node_key: "confirm_order",
      node_type: "send_buttons",
      config: {
        header_text: "Order Received 🎉",
        text: "Thank you for ordering! 📦\n\n*Delivery Details:*\n{{order_details}}\n\nOur team has registered your order and will message invoice & dispatch tracker in 10 mins.",
        buttons: [
          { id: "btn_mno", reply_id: "BACK_MENU", title: "🏠 Main Menu", label: "🏠 Main Menu", next_node_key: "welcome_menu", nextNodeId: "welcome_menu" },
          { id: "btn_tso", reply_id: "TALK_HUMAN", title: "👨💼 Talk to Sales", label: "👨💼 Talk to Sales", next_node_key: "sales_handoff", nextNodeId: "sales_handoff" }
        ]
      },
      position_x: 200,
      position_y: 1260
    },
    {
      node_key: "sales_handoff",
      node_type: "handoff",
      config: {
        note: "Connecting you to sales team... 👨💼\nOur executive will call you in 10 mins. Or call us directly: +91 9876543210"
      },
      position_x: 980,
      position_y: 420
    }
  ];

  // ── Starter Nodes Template (Default Banking / Interactive Menu) ─────────────
  const getDefaultStarterNodes = () => [
    {
      node_key: "start",
      node_type: "start",
      config: { next_node_key: "banking_menu" },
      position_x: 260,
      position_y: 40
    },
    {
      node_key: "banking_menu",
      node_type: "interactive_menu",
      config: {
        text: "Good Afternoon, {{customer.name}} 🍀🙂\n\nPlease type any bank related query or select from the options below",
        sections: [
          {
            title: "Bank Services",
            buttons: [
              { id: "account_balance", label: "Account Balance", nextNodeId: "lookup_balance" },
              { id: "instant_fd", label: "Instant FD", nextNodeId: "fd_calculator" },
              { id: "credit_card_due", label: "Credit Card Bill Due", nextNodeId: "card_bill_flow" }
            ]
          },
          {
            title: "Explore more! ⭐",
            buttons: [
              { id: "credit_card_fd", label: "Credit Card on FD", nextNodeId: "card_fd_flow" },
              { id: "apply_card", label: "Apply New Card", nextNodeId: "apply_card_flow" },
              { id: "loan_offers", label: "Loan Offers", nextNodeId: "loan_flow" }
            ]
          },
          {
            title: "Looking for something else? 🔍",
            buttons: [
              { id: "live_agent", label: "Live Agent", nextNodeId: "agent_handoff" }
            ]
          }
        ]
      },
      position_x: 260,
      position_y: 180
    },
    {
      node_key: "lookup_balance",
      node_type: "crm_lookup",
      config: {
        lookup_type: "customer",
        next_node_key: "balance_card"
      },
      position_x: 30,
      position_y: 380
    },
    {
      node_key: "balance_card",
      node_type: "interactive_menu",
      config: {
        text: "💳 *Account Summary for {{customer.name}}:*\n\n• Available Balance: *₹45,280.00*\n• Account: *XXXX-XXXX-4812*\n• Last Updated: {{current.date}}\n\nNeed a detailed mini statement?",
        sections: [
          {
            title: "Actions",
            buttons: [
              { id: "mini_stmt", label: "Mini Statement (PDF)", nextNodeId: "send_stmt_pdf" },
              { id: "back_main", label: "🏠 Main Menu", nextNodeId: "banking_menu" }
            ]
          }
        ]
      },
      position_x: 30,
      position_y: 540
    },
    {
      node_key: "send_stmt_pdf",
      node_type: "send_message",
      config: {
        text: "📄 Your last 10 transactions statement has been generated: https://madhurabank.example.com/stmt_4812.pdf\n\nReply MENU to return to main options.",
        next_node_key: "end"
      },
      position_x: 30,
      position_y: 720
    },
    {
      node_key: "fd_calculator",
      node_type: "interactive_menu",
      config: {
        text: "💰 *Instant Fixed Deposit (FD)*\n\nEarn up to *7.85% p.a.* interest with zero paperwork!\n\nChoose your preferred tenure:",
        sections: [
          {
            title: "Tenures",
            buttons: [
              { id: "fd_1yr", label: "1 Year @ 7.25%", nextNodeId: "book_fd_lead" },
              { id: "fd_3yr", label: "3 Years @ 7.85%", nextNodeId: "book_fd_lead" },
              { id: "back_main2", label: "🏠 Main Menu", nextNodeId: "banking_menu" }
            ]
          }
        ]
      },
      position_x: 290,
      position_y: 380
    },
    {
      node_key: "book_fd_lead",
      node_type: "create_lead",
      config: {
        default_service: "Instant FD Application",
        notes: "Customer applied for Fixed Deposit via WhatsApp bot. Selected: {{selected.option}}",
        next_node_key: "fd_success_msg"
      },
      position_x: 290,
      position_y: 540
    },
    {
      node_key: "fd_success_msg",
      node_type: "send_message",
      config: {
        text: "✅ Congratulations! Your Instant FD request has been initiated. Our relationship manager will verify your details within 15 minutes.\n\nReference ID: #FD-{{current.date}}-8891",
        next_node_key: "end"
      },
      position_x: 290,
      position_y: 720
    },
    {
      node_key: "card_bill_flow",
      node_type: "interactive_menu",
      config: {
        text: "💳 *Credit Card Bill Status*\n\nCard: *Platinum Rewards (ending 9021)*\n• Total Due: *₹18,450.00*\n• Minimum Due: *₹1,200.00*\n• Due Date: *10th of this month*",
        sections: [
          {
            title: "Payment Options",
            buttons: [
              { id: "pay_now", label: "Pay Total Due (UPI)", nextNodeId: "send_pay_link" },
              { id: "back_main3", label: "🏠 Main Menu", nextNodeId: "banking_menu" }
            ]
          }
        ]
      },
      position_x: 550,
      position_y: 380
    },
    {
      node_key: "send_pay_link",
      node_type: "send_message",
      config: {
        text: "⚡ Instant UPI Payment Link: https://pay.madhurabank.example.com/bill/9021\n\nInstant confirmation will be sent upon payment receipt.",
        next_node_key: "end"
      },
      position_x: 550,
      position_y: 540
    },
    {
      node_key: "card_fd_flow",
      node_type: "send_message",
      config: {
        text: "🌟 *Credit Card Against FD*\nGet 90% credit limit against your fixed deposit with zero CIBIL checks and instant activation!\n\nLink to apply: https://cards.madhurabank.example.com/card-on-fd",
        next_node_key: "end"
      },
      position_x: 810,
      position_y: 380
    },
    {
      node_key: "apply_card_flow",
      node_type: "collect_input",
      config: {
        prompt_text: "Please enter your monthly take-home income (e.g. 50000):",
        var_key: "income",
        next_node_key: "check_card_eligibility"
      },
      position_x: 810,
      position_y: 540
    },
    {
      node_key: "check_card_eligibility",
      node_type: "condition",
      config: {
        subject_key: "income",
        operator: "greater_or_equal",
        value: "25000",
        true_next: "card_approved_msg",
        false_next: "card_fd_flow"
      },
      position_x: 810,
      position_y: 700
    },
    {
      node_key: "card_approved_msg",
      node_type: "send_message",
      config: {
        text: "🎉 You are pre-approved for our *Lifetime Free Titanium Card* with ₹1,50,000 credit limit!\n\nComplete your KYC in 2 mins: https://cards.madhurabank.example.com/kyc",
        next_node_key: "end"
      },
      position_x: 810,
      position_y: 840
    },
    {
      node_key: "loan_flow",
      node_type: "interactive_menu",
      config: {
        text: "🏡 *Instant Loan Offers for {{customer.name}}*\n\nSelect a loan type to check customized interest rates & eligibility:",
        sections: [
          {
            title: "Loan Types",
            buttons: [
              { id: "home_loan", label: "Home Loan @ 8.40%", nextNodeId: "lead_loan" },
              { id: "personal_loan", label: "Personal Loan @ 10.5%", nextNodeId: "lead_loan" },
              { id: "car_loan", label: "Car Loan @ 8.75%", nextNodeId: "lead_loan" }
            ]
          }
        ]
      },
      position_x: 1070,
      position_y: 380
    },
    {
      node_key: "lead_loan",
      node_type: "create_lead",
      config: {
        default_service: "Loan Inquiry",
        notes: "Customer inquired about loan offers via WhatsApp bot. Selected: {{selected.option}}",
        next_node_key: "loan_ack_msg"
      },
      position_x: 1070,
      position_y: 540
    },
    {
      node_key: "loan_ack_msg",
      node_type: "send_message",
      config: {
        text: "✅ Thank you! Our loan expert will call you within 30 minutes with customized sanction terms & EMI schedule.",
        next_node_key: "end"
      },
      position_x: 1070,
      position_y: 700
    },
    {
      node_key: "agent_handoff",
      node_type: "handoff",
      config: {
        note: "Customer requested live support specialist from interactive menu"
      },
      position_x: 1320,
      position_y: 380
    },
    {
      node_key: "end",
      node_type: "end",
      config: {},
      position_x: 600,
      position_y: 1000
    }
  ];

  // ── Seed Prebuilt Flows ─────────────────────────────────────────────────────
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
    if (!flowName.trim()) {
      alert("Please enter a flow name");
      return;
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
        name: flowName,
        description: flowDesc,
        status: isPublishing ? "active" : "draft",
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
        setVersionChangelog("");
      }

      await fetchFlows();
      return flowId;
    } catch (err) {
      alert("Error saving flow: " + (err.response?.data?.error || err.message));
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
      setNodes(fetchedFlow.nodes || []);
      setSelectedNodeKey(fetchedFlow.nodes[0]?.node_key || "start");
      alert("✅ Successfully restored version snapshot!");
    } catch (err) {
      alert("Error rolling back: " + err.message);
    }
  };

  // ── Canvas Dragging & Node Manipulation ─────────────────────────────────────
  const handleCanvasMouseDown = (e) => {
    if (connectingFrom) {
      // Clicking on empty canvas cancels the active port connection mode
      setConnectingFrom(null);
      return;
    }
    if (e.target === canvasRef.current || e.target.tagName === "svg" || e.target.classList?.contains("canvas-grid")) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleCanvasMouseMove = (e) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    } else if (draggingNodeKey) {
      const newX = (e.clientX - pan.x - dragOffset.x) / zoom;
      const newY = (e.clientY - pan.y - dragOffset.y) / zoom;
      setNodes(prev => prev.map(n => n.node_key === draggingNodeKey ? { ...n, position_x: Math.max(0, newX), position_y: Math.max(0, newY) } : n));
    } else if (connectingFrom) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        setConnectingMousePos({
          x: (e.clientX - rect.left - pan.x) / zoom,
          y: (e.clientY - rect.top - pan.y) / zoom
        });
      }
    }
  };

  const handleCanvasMouseUp = () => {
    setIsPanning(false);
    setDraggingNodeKey(null);
    // Keep connectingFrom active so user can click-to-connect by clicking the destination node
  };

  const handleNodeMouseDown = (nodeKey, e) => {
    e.stopPropagation();
    if (connectingFrom && connectingFrom.nodeKey !== nodeKey) {
      // Connect to this node on click
      completeConnection(nodeKey, e);
      return;
    }
    setSelectedNodeKey(nodeKey);
    setDraggingNodeKey(nodeKey);
    const node = nodes.find(n => n.node_key === nodeKey);
    if (node) {
      setDragOffset({
        x: (e.clientX - pan.x) - (node.position_x * zoom),
        y: (e.clientY - pan.y) - (node.position_y * zoom)
      });
    }
  };

  // ── Port Connection Logic ───────────────────────────────────────────────────
  const startConnecting = (nodeKey, portId, portType, extra = {}, e) => {
    if (e?.stopPropagation) e.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect();
    const clientX = e?.clientX ?? (e?.touches && e.touches[0]?.clientX) ?? 0;
    const clientY = e?.clientY ?? (e?.touches && e.touches[0]?.clientY) ?? 0;
    const startX = rect ? (clientX - rect.left - pan.x) / zoom : 0;
    const startY = rect ? (clientY - rect.top - pan.y) / zoom : 0;

    setConnectingFrom({ nodeKey, portId, portType, x: startX, y: startY, ...extra });
    setConnectingMousePos({ x: startX, y: startY });
  };

  const completeConnection = (targetNodeKey, e) => {
    if (e?.stopPropagation) e.stopPropagation();
    if (!connectingFrom || connectingFrom.nodeKey === targetNodeKey) {
      setConnectingFrom(null);
      return;
    }

    const { nodeKey: srcKey, portType, sectionIdx, buttonIdx, intentKey } = connectingFrom;

    setNodes(prev => prev.map(n => {
      if (n.node_key !== srcKey) return n;
      const cfg = { ...(n.config || {}) };

      if (portType === "button" && n.node_type === "interactive_menu") {
        const secs = [...(cfg.sections || [])];
        if (sectionIdx !== undefined && secs[sectionIdx] && secs[sectionIdx].buttons && secs[sectionIdx].buttons[buttonIdx]) {
          secs[sectionIdx].buttons[buttonIdx] = {
            ...secs[sectionIdx].buttons[buttonIdx],
            nextNodeId: targetNodeKey,
            next_node_key: targetNodeKey
          };
          cfg.sections = secs;
        } else if (cfg.buttons && cfg.buttons[buttonIdx]) {
          const btns = [...cfg.buttons];
          btns[buttonIdx] = {
            ...btns[buttonIdx],
            nextNodeId: targetNodeKey,
            next_node_key: targetNodeKey
          };
          cfg.buttons = btns;
        }
      } else if (portType === "button" && (n.node_type === "send_buttons" || n.node_type === "send_list")) {
        const isList = n.node_type === "send_list";
        const btns = [...(isList ? (cfg.rows || cfg.buttons || []) : (cfg.buttons || cfg.rows || []))];
        if (btns[buttonIdx]) {
          btns[buttonIdx] = {
            ...btns[buttonIdx],
            next_node_key: targetNodeKey,
            nextNodeId: targetNodeKey
          };
          cfg.buttons = btns;
          cfg.rows = btns;
        }
      } else if (portType === "true") {
        cfg.true_next = targetNodeKey;
      } else if (portType === "false") {
        cfg.false_next = targetNodeKey;
      } else if (portType === "intent") {
        const branches = { ...(cfg.branches || {}) };
        branches[intentKey || "intent"] = targetNodeKey;
        cfg.branches = branches;
      } else if (portType === "found") {
        cfg.found_next = targetNodeKey;
      } else if (portType === "not_found") {
        cfg.not_found_next = targetNodeKey;
      } else {
        cfg.next_node_key = targetNodeKey;
      }

      return { ...n, config: cfg };
    }));

    setConnectingFrom(null);
  };

  // Disconnect / detach wire link directly from canvas
  const disconnectWire = (wire) => {
    if (!wire || !wire.srcKey) return;
    setNodes(prev => prev.map(n => {
      if (n.node_key !== wire.srcKey) return n;
      const cfg = JSON.parse(JSON.stringify(n.config || {}));

      if (wire.portType === "button" && n.node_type === "interactive_menu") {
        if (wire.sectionIdx !== undefined && cfg.sections?.[wire.sectionIdx]?.buttons?.[wire.buttonIdx]) {
          cfg.sections[wire.sectionIdx].buttons[wire.buttonIdx].nextNodeId = "";
          cfg.sections[wire.sectionIdx].buttons[wire.buttonIdx].next_node_key = "";
        } else if (cfg.buttons?.[wire.buttonIdx]) {
          cfg.buttons[wire.buttonIdx].nextNodeId = "";
          cfg.buttons[wire.buttonIdx].next_node_key = "";
        }
      } else if (wire.portType === "button" && (n.node_type === "send_buttons" || n.node_type === "send_list")) {
        const isList = n.node_type === "send_list";
        const arr = isList ? (cfg.rows || cfg.buttons || []) : (cfg.buttons || cfg.rows || []);
        if (arr[wire.buttonIdx]) {
          arr[wire.buttonIdx].next_node_key = "";
          arr[wire.buttonIdx].nextNodeId = "";
          if (isList) { cfg.rows = arr; cfg.buttons = arr; }
          else { cfg.buttons = arr; cfg.rows = arr; }
        }
      } else if (wire.portType === "true") {
        cfg.true_next = "";
      } else if (wire.portType === "false") {
        cfg.false_next = "";
      } else if (wire.portType === "intent") {
        if (cfg.branches) delete cfg.branches[wire.intentKey];
      } else if (wire.portType === "found") {
        cfg.found_next = "";
      } else if (wire.portType === "not_found") {
        cfg.not_found_next = "";
      } else {
        cfg.next_node_key = "";
      }

      return { ...n, config: cfg };
    }));
  };

  // ── Add Node to Canvas ──────────────────────────────────────────────────────
  const addNodeFromPalette = (item) => {
    const baseKey = item.type.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
    let uniqueKey = baseKey;
    let counter = 1;
    while (nodes.some(n => n.node_key === uniqueKey)) {
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
      newConfig = { method: "GET", url: "https://api.example.com/check", next_node_key: "" };
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
      position_x: Math.max(50, canvasCenterX + (Math.random() * 40 - 20)),
      position_y: Math.max(50, canvasCenterY + (Math.random() * 40 - 20))
    };

    setNodes(prev => [...prev, newNode]);
    setSelectedNodeKey(uniqueKey);
  };

  const deleteNode = (nodeKey) => {
    if (nodeKey === "start") {
      alert("The start entry node cannot be deleted.");
      return;
    }
    setNodes(prev => prev.filter(n => n.node_key !== nodeKey));
    if (selectedNodeKey === nodeKey) setSelectedNodeKey(null);
  };

  const duplicateNode = (node) => {
    const newKey = `${node.node_key}_copy_${Math.floor(Math.random() * 1000)}`;
    const copy = {
      ...node,
      node_key: newKey,
      position_x: (node.position_x || 0) + 40,
      position_y: (node.position_y || 0) + 40
    };
    setNodes(prev => [...prev, copy]);
    setSelectedNodeKey(newKey);
  };

  // ── Interactive In-Phone Simulator Engine ───────────────────────────────────
  const resetSimulation = () => {
    setSimMessages([]);
    setSimLogs([]);
    setSimEnded(false);
    setSimCurrentNode(null);
    setSimTyping(false);
    // Auto-execute from start
    executeSimStep("");
  };

  const executeSimStep = async (userInput = "") => {
    if (simTyping) return;
    setSimTyping(true);

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
        { sender: "user", text: userInput, at: new Date() }
      ]);
    }

    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const payload = {
        flow: activeFlowDraft,
        input: userInput,
        state: simCurrentNode ? {
          currentNodeKey: simCurrentNode,
          vars: simVars
        } : null
      };

      const res = await axios.post(`${API}/api/wa-flows/draft-simulate`, payload, { headers });
      const result = res.data;

      setTimeout(() => {
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
      }, 400);

    } catch (err) {
      console.error("Simulation error:", err);
      setSimTyping(false);
    }
  };

  const selectedNode = nodes.find(n => n.node_key === selectedNodeKey);

  // ── Calculate SVG Connections between Nodes ─────────────────────────────────
  const getWirePaths = () => {
    const wires = [];
    const nodeMap = {};
    nodes.forEach(n => { nodeMap[n.node_key] = n; });

    nodes.forEach(src => {
      const srcX = src.position_x || 0;
      const srcY = src.position_y || 0;
      const cfg = src.config || {};

      const addWire = (targetKey, portLabel, portColor = "#10B981", offsetY = 60, extra = {}) => {
        if (!targetKey || !nodeMap[targetKey]) return;
        const tgt = nodeMap[targetKey];
        const tgtX = tgt.position_x || 0;
        const tgtY = tgt.position_y || 0;

        const startX = srcX + 270; // right side of source card (270px width)
        const startY = srcY + offsetY;
        const endX = tgtX; // left side of target card
        const endY = tgtY + 45;

        // Bezier control points for smooth routing
        const dx = Math.abs(endX - startX) * 0.55;
        const pathD = `M ${startX} ${startY} C ${startX + Math.max(50, dx)} ${startY}, ${endX - Math.max(50, dx)} ${endY}, ${endX} ${endY}`;

        wires.push({
          id: `${src.node_key}->${targetKey}-${portLabel}-${offsetY}`,
          srcKey: src.node_key,
          targetKey,
          pathD,
          color: portColor,
          label: portLabel,
          startX, startY, endX, endY,
          ...extra
        });
      };

      if (src.node_type === "interactive_menu") {
        let btnOffset = 85;
        if (Array.isArray(cfg.sections) && cfg.sections.length > 0) {
          cfg.sections.forEach((sec, sIdx) => {
            btnOffset += 24; // section title space
            (sec.buttons || []).forEach((b, bIdx) => {
              const target = b.nextNodeId || b.next_node_key;
              if (target) addWire(target, b.label || b.title || "Option", "#10B981", btnOffset, { portType: "button", sectionIdx: sIdx, buttonIdx: bIdx });
              btnOffset += 34;
            });
          });
        } else if (Array.isArray(cfg.buttons)) {
          cfg.buttons.forEach((b, bIdx) => {
            const target = b.nextNodeId || b.next_node_key;
            if (target) addWire(target, b.label || b.title || "Option", "#10B981", btnOffset, { portType: "button", buttonIdx: bIdx });
            btnOffset += 34;
          });
        }
      } else if (src.node_type === "send_buttons") {
        let btnOffset = 85;
        (cfg.buttons || []).forEach((b, bIdx) => {
          const target = b.next_node_key || b.nextNodeId;
          if (target) addWire(target, b.title || b.label || "Option", "#0D9488", btnOffset, { portType: "button", buttonIdx: bIdx });
          btnOffset += 34;
        });
      } else if (src.node_type === "send_list") {
        let btnOffset = 110;
        (cfg.rows || cfg.buttons || []).forEach((b, rIdx) => {
          const target = b.next_node_key || b.nextNodeId;
          if (target) addWire(target, b.title || b.label || "Option", "#06B6D4", btnOffset, { portType: "button", buttonIdx: rIdx, rowIdx: rIdx });
          btnOffset += 38;
        });
      } else if (src.node_type === "condition") {
        if (cfg.true_next) addWire(cfg.true_next, "YES (True)", "#10B981", 90, { portType: "true" });
        if (cfg.false_next) addWire(cfg.false_next, "NO (False)", "#F59E0B", 130, { portType: "false" });
      } else if (src.node_type === "ai_intent") {
        let branchOffset = 75;
        const branchObj = cfg.branches || { sales: "", support: "", pricing: "", fallback: "" };
        Object.entries(branchObj).forEach(([intent, tgt]) => {
          if (tgt) addWire(tgt, intent, "#A855F7", branchOffset, { portType: "intent", intentKey: intent });
          branchOffset += 28;
        });
      } else if (src.node_type === "crm_lookup") {
        if (cfg.found_next) addWire(cfg.found_next, "Found", "#10B981", 80, { portType: "found" });
        if (cfg.not_found_next) addWire(cfg.not_found_next, "Not Found", "#EF4444", 110, { portType: "not_found" });
        if (cfg.next_node_key) addWire(cfg.next_node_key, "Next", "#3B82F6", 80, { portType: "next" });
      } else if (src.config?.next_node_key) {
        addWire(src.config.next_node_key, "Next", "#3B82F6", 75, { portType: "next" });
      }
    });

    return wires;
  };

  // ── Render Node Card in Canvas ──────────────────────────────────────────────
  const renderCanvasNode = (node) => {
    const isSelected = selectedNodeKey === node.node_key;
    const isEntry = flowEntryNode === node.node_key || node.node_key === "start";
    const isConnectingTarget = connectingFrom && connectingFrom.nodeKey !== node.node_key;
    const isConnectingSource = connectingFrom && connectingFrom.nodeKey === node.node_key;

    // Palette metadata icon and color
    let typeMeta = { icon: "⚡", label: node.node_type, color: "bg-slate-50 border-slate-300 text-slate-800" };
    PALETTE_CATEGORIES.forEach(cat => {
      const found = cat.items.find(i => i.type === node.node_type);
      if (found) typeMeta = found;
    });

    return (
      <div
        key={node.node_key}
        onMouseDown={(e) => handleNodeMouseDown(node.node_key, e)}
        onClick={(e) => {
          e.stopPropagation();
          if (connectingFrom && connectingFrom.nodeKey !== node.node_key) {
            completeConnection(node.node_key, e);
          } else {
            setSelectedNodeKey(node.node_key);
            setShowRightPanel(true);
            setActiveInspectorTab("config");
          }
        }}
        onMouseUp={(e) => {
          if (connectingFrom && connectingFrom.nodeKey !== node.node_key) {
            completeConnection(node.node_key, e);
          }
        }}
        style={{
          transform: `translate(${node.position_x}px, ${node.position_y}px)`,
          width: "270px"
        }}
        className={`absolute rounded-2xl bg-white shadow-lg border-2 transition-all select-none cursor-move z-10 ${
          isConnectingTarget
            ? "border-emerald-500 ring-4 ring-emerald-400/80 shadow-2xl cursor-pointer hover:scale-[1.02]"
            : isConnectingSource
              ? "border-blue-500 ring-4 ring-blue-400/70 shadow-xl"
              : isSelected
                ? "border-emerald-500 ring-4 ring-emerald-500/20 shadow-2xl"
                : "border-slate-200 hover:border-slate-300 hover:shadow-md"
        }`}
      >
        {/* Click to Connect Top Banner Cue */}
        {isConnectingTarget && (
          <div className="bg-emerald-600 text-white text-[9px] font-bold text-center py-0.5 rounded-t-xl animate-pulse flex items-center justify-center gap-1">
            <span>✦ Click to Connect Step Here</span>
          </div>
        )}

        {/* Input Port Anchor (Left) */}
        {node.node_key !== "start" && (
          <div
            onClick={(e) => completeConnection(node.node_key, e)}
            onMouseUp={(e) => completeConnection(node.node_key, e)}
            className={`absolute -left-3.5 top-10 w-7 h-7 rounded-full bg-white border-2 flex items-center justify-center shadow-md transition-all z-20 cursor-pointer ${
              isConnectingTarget
                ? "border-emerald-500 bg-emerald-100 scale-125 ring-4 ring-emerald-400/50"
                : "border-slate-300 hover:border-emerald-500 hover:scale-125"
            }`}
            title="Drop or click here to connect"
          >
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
          </div>
        )}

        {/* Node Header */}
        <div className={`px-3.5 py-2.5 border-b border-slate-100 bg-slate-50/90 flex items-center justify-between ${
          isConnectingTarget ? "" : "rounded-t-2xl"
        }`}>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base">{typeMeta.icon || "⚡"}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-800 truncate">{node.node_key}</span>
                {isEntry && (
                  <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 font-extrabold text-[9px] rounded-full uppercase">
                    Entry
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400 truncate">{typeMeta.label}</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); duplicateNode(node); }}
              className="p-1 text-slate-400 hover:text-slate-600 rounded"
              title="Duplicate"
            >
              <Copy size={12} />
            </button>
            {node.node_key !== "start" && (
              <button
                onClick={(e) => { e.stopPropagation(); deleteNode(node.node_key); }}
                className="p-1 text-slate-400 hover:text-rose-600 rounded"
                title="Delete"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Node Body Content Preview */}
        <div className="p-3 text-xs space-y-2">
          {/* Triggers (start, keyword_trigger, all_inbound_trigger, first_inbound_trigger) */}
          {(node.node_type === "start" || node.node_type?.includes("trigger")) && (
            <div className="space-y-1.5">
              <div className="p-2 bg-amber-50/80 border border-amber-200 rounded-lg text-[11px]">
                <div className="font-bold text-amber-900 flex items-center gap-1">
                  <span>🚀</span>
                  <span>{node.node_type === "start" ? "Entry Kickoff Point" : (node.config?.trigger_label || "Inbound Trigger")}</span>
                </div>
                {node.config?.keywords && (
                  <p className="text-[10px] text-amber-700 mt-1 font-mono line-clamp-1">
                    Keywords: {Array.isArray(node.config.keywords) ? node.config.keywords.join(", ") : node.config.keywords}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between pt-1 text-[11px] text-slate-600 font-semibold">
                <span>Start Flow ➔</span>
                <div
                  onMouseDown={(e) => startConnecting(node.node_key, "next", "next", {}, e)}
                  className="w-5 h-5 rounded-full bg-amber-500 hover:bg-amber-600 flex items-center justify-center text-white cursor-crosshair hover:scale-125 transition shadow-sm shrink-0"
                  title="Drag or click to connect next step"
                >
                  <ChevronRight size={12} />
                </div>
              </div>
            </div>
          )}

          {/* Interactive Menu multi-section display */}
          {node.node_type === "interactive_menu" && (
            <div className="space-y-2">
              <p className="text-slate-600 text-[11px] line-clamp-2 italic bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                "{node.config?.text || "Choose an option:"}"
              </p>

              {Array.isArray(node.config?.sections) ? (
                node.config.sections.map((sec, sIdx) => (
                  <div key={sIdx} className="space-y-1">
                    {sec.title && (
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
                        {sec.title}
                      </span>
                    )}
                    <div className="space-y-1">
                      {(sec.buttons || []).map((b, bIdx) => (
                        <div
                          key={bIdx}
                          className="flex items-center justify-between px-2 py-1.5 bg-emerald-50/70 border border-emerald-200 text-emerald-900 rounded-lg text-[11px] font-semibold group"
                        >
                          <span className="truncate">{b.label || b.title || `Option ${bIdx + 1}`}</span>
                          <div
                            onMouseDown={(e) => startConnecting(node.node_key, b.id || `btn_${bIdx}`, "button", { sectionIdx: sIdx, buttonIdx: bIdx }, e)}
                            className="w-4 h-4 rounded-full bg-emerald-600 flex items-center justify-center text-white cursor-crosshair hover:scale-125 transition-transform shrink-0"
                            title="Drag or click to connect target node"
                          >
                            <ChevronRight size={10} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="space-y-1">
                  {(node.config?.buttons || []).map((b, bIdx) => (
                    <div
                      key={bIdx}
                      className="flex items-center justify-between px-2 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg text-[11px] font-semibold"
                    >
                      <span className="truncate">{b.label || b.title || `Option ${bIdx + 1}`}</span>
                      <div
                        onMouseDown={(e) => startConnecting(node.node_key, b.id || `btn_${bIdx}`, "button", { buttonIdx: bIdx }, e)}
                        className="w-4 h-4 rounded-full bg-emerald-600 flex items-center justify-center text-white cursor-crosshair hover:scale-125 shrink-0"
                        title="Drag or click to connect target node"
                      >
                        <ChevronRight size={10} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Quick Reply Buttons Preview */}
          {node.node_type === "send_buttons" && (
            <div className="space-y-1.5">
              {node.config?.header_text && (
                <div className="text-[10px] font-bold text-teal-700 uppercase tracking-wide truncate">
                  {node.config.header_text}
                </div>
              )}
              <p className="text-slate-600 text-[11px] line-clamp-2 italic bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                "{node.config?.text || "Please choose:"}"
              </p>
              <div className="space-y-1">
                {(node.config?.buttons || []).map((b, bIdx) => (
                  <div
                    key={bIdx}
                    className="flex items-center justify-between px-2 py-1.5 bg-teal-50 border border-teal-200 text-teal-900 rounded-lg text-[11px] font-semibold shadow-xs"
                  >
                    <span className="truncate">{b.title || b.label || `Option ${bIdx + 1}`}</span>
                    <div
                      onMouseDown={(e) => startConnecting(node.node_key, b.reply_id || b.id || `btn_${bIdx}`, "button", { buttonIdx: bIdx }, e)}
                      className="w-4 h-4 rounded-full bg-teal-600 flex items-center justify-center text-white cursor-crosshair hover:scale-125 transition shrink-0"
                      title="Drag or click to connect target node"
                    >
                      <ChevronRight size={10} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* WhatsApp List Menu ("View All") Preview */}
          {node.node_type === "send_list" && (
            <div className="space-y-1.5">
              <p className="text-slate-600 text-[11px] line-clamp-2 italic bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                "{node.config?.text || node.config?.body || "Select an item:"}"
              </p>
              <div className="px-2 py-1 bg-cyan-100/80 border border-cyan-300 text-cyan-950 rounded-lg text-[10px] font-bold flex items-center gap-1.5">
                <ListOrdered size={12} className="text-cyan-700 shrink-0" />
                <span className="truncate">Button: "{node.config?.button_text || "View All Categories"}"</span>
              </div>
              <div className="space-y-1">
                {(node.config?.rows || node.config?.buttons || []).map((r, rIdx) => (
                  <div
                    key={rIdx}
                    className="flex items-center justify-between px-2 py-1.5 bg-cyan-50 border border-cyan-200 text-cyan-950 rounded-lg text-[11px] font-semibold shadow-xs"
                  >
                    <div className="truncate pr-1.5">
                      <span className="block truncate">{r.title || `Item ${rIdx + 1}`}</span>
                      {r.description && <span className="block text-[9px] text-cyan-700 font-normal truncate">{r.description}</span>}
                    </div>
                    <div
                      onMouseDown={(e) => startConnecting(node.node_key, r.id || r.reply_id || `row_${rIdx}`, "button", { buttonIdx: rIdx }, e)}
                      className="w-4 h-4 rounded-full bg-cyan-600 flex items-center justify-center text-white cursor-crosshair hover:scale-125 transition shrink-0"
                      title="Drag or click to connect target node"
                    >
                      <ChevronRight size={10} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Text Message Preview */}
          {node.node_type === "send_message" && (
            <div className="space-y-1.5">
              <p className="text-slate-700 text-xs line-clamp-3 bg-blue-50/50 p-2 rounded-lg border border-blue-100 font-mono">
                {node.config?.text || "Text content"}
              </p>
              <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                <span>Next Step</span>
                <div
                  onMouseDown={(e) => startConnecting(node.node_key, "next", "next", {}, e)}
                  className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center text-white cursor-crosshair hover:scale-125"
                  title="Connect next step"
                >
                  <ChevronRight size={10} />
                </div>
              </div>
            </div>
          )}

          {/* Media / PDF Catalog Preview */}
          {node.node_type === "send_media" && (
            <div className="space-y-1.5">
              <div className="p-1.5 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded text-[11px] flex items-center gap-1.5">
                <FileText size={12} className="text-indigo-600 shrink-0" />
                <span className="font-semibold uppercase">{node.config?.media_type || "image"}</span>
                <span className="text-[10px] text-slate-500 truncate">{node.config?.media_url ? "URL configured" : "No URL"}</span>
              </div>
              {node.config?.caption && (
                <p className="text-[10px] text-slate-600 line-clamp-2 italic bg-slate-50 p-1.5 rounded border border-slate-100">
                  "{node.config.caption}"
                </p>
              )}
              <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                <span>Next Step</span>
                <div
                  onMouseDown={(e) => startConnecting(node.node_key, "next", "next", {}, e)}
                  className="w-4 h-4 rounded-full bg-indigo-600 flex items-center justify-center text-white cursor-crosshair hover:scale-125 transition shrink-0"
                  title="Connect next step"
                >
                  <ChevronRight size={10} />
                </div>
              </div>
            </div>
          )}

          {/* WhatsApp Approved Template Preview */}
          {node.node_type === "send_template" && (
            <div className="space-y-1.5">
              <div className="p-1.5 bg-lime-50 border border-lime-200 text-lime-900 rounded text-[11px] font-semibold truncate">
                🧾 HSM: {node.config?.template_name || "welcome_hsm"}
              </div>
              <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                <span>Next Step</span>
                <div
                  onMouseDown={(e) => startConnecting(node.node_key, "next", "next", {}, e)}
                  className="w-4 h-4 rounded-full bg-lime-600 flex items-center justify-center text-white cursor-crosshair hover:scale-125 transition shrink-0"
                  title="Connect next step"
                >
                  <ChevronRight size={10} />
                </div>
              </div>
            </div>
          )}

          {/* Condition Preview */}
          {node.node_type === "condition" && (
            <div className="space-y-2">
              <div className="p-2 bg-amber-50 rounded-lg border border-amber-200 text-[11px] font-mono text-amber-900">
                if ({node.config?.subject_key || "input"} {node.config?.operator || "=="} "{node.config?.value || ""}")
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div
                  onMouseDown={(e) => startConnecting(node.node_key, "true", "true", {}, e)}
                  className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px] flex items-center justify-between cursor-crosshair hover:bg-emerald-200"
                  title="Connect YES outcome"
                >
                  <span>YES (True)</span>
                  <ChevronRight size={12} />
                </div>
                <div
                  onMouseDown={(e) => startConnecting(node.node_key, "false", "false", {}, e)}
                  className="px-2 py-1 bg-amber-100 text-amber-800 rounded font-bold text-[10px] flex items-center justify-between cursor-crosshair hover:bg-amber-200"
                  title="Connect NO outcome"
                >
                  <span>NO (False)</span>
                  <ChevronRight size={12} />
                </div>
              </div>
            </div>
          )}

          {/* AI Intent Router Preview */}
          {node.node_type === "ai_intent" && (
            <div className="space-y-1.5">
              <div className="p-1.5 bg-fuchsia-50 border border-fuchsia-200 text-fuchsia-900 rounded text-[11px] font-semibold flex items-center gap-1.5">
                <Sparkles size={12} className="text-fuchsia-600" />
                <span>AI Intent Branches</span>
              </div>
              <div className="space-y-1">
                {Object.keys(node.config?.branches || { sales: "", support: "", pricing: "", fallback: "" }).map((intent, iIdx) => (
                  <div
                    key={iIdx}
                    className="flex items-center justify-between px-2 py-1 bg-fuchsia-50/70 border border-fuchsia-200 text-fuchsia-950 rounded text-[10px] font-bold"
                  >
                    <span className="truncate uppercase">{intent}</span>
                    <div
                      onMouseDown={(e) => startConnecting(node.node_key, `intent_${intent}`, "intent", { intentKey: intent }, e)}
                      className="w-3.5 h-3.5 rounded-full bg-fuchsia-600 flex items-center justify-center text-white cursor-crosshair hover:scale-125 transition shrink-0"
                      title={`Connect branch: ${intent}`}
                    >
                      <ChevronRight size={9} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Smart Dynamic Response */}
          {node.node_type === "ai_generate" && (
            <div className="space-y-1.5">
              <div className="p-2 bg-fuchsia-50 border border-fuchsia-200 text-fuchsia-900 rounded-lg text-[11px]">
                <div className="font-bold flex items-center gap-1.5">
                  <Cpu size={12} className="text-fuchsia-600" />
                  <span>AI Smart Dynamic Response</span>
                </div>
                <p className="text-[10px] text-fuchsia-700 italic line-clamp-2 mt-0.5">
                  "{node.config?.prompt || "Answer customer queries naturally"}"
                </p>
              </div>
              <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                <span>Next Step</span>
                <div
                  onMouseDown={(e) => startConnecting(node.node_key, "next", "next", {}, e)}
                  className="w-4 h-4 rounded-full bg-fuchsia-600 flex items-center justify-center text-white cursor-crosshair hover:scale-125 transition shrink-0"
                  title="Connect next step"
                >
                  <ChevronRight size={10} />
                </div>
              </div>
            </div>
          )}

          {/* CRM Lookup Preview */}
          {node.node_type === "crm_lookup" && (
            <div className="space-y-1.5">
              <div className="p-1.5 bg-sky-50 text-sky-900 border border-sky-200 rounded text-[11px] flex items-center gap-1.5">
                <Database size={12} />
                <span>Fetch: <b>{node.config?.lookup_type || "customer"}</b></span>
              </div>
              <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                <span>Continue</span>
                <div
                  onMouseDown={(e) => startConnecting(node.node_key, "next", "next", {}, e)}
                  className="w-4 h-4 rounded-full bg-sky-600 flex items-center justify-center text-white cursor-crosshair hover:scale-125"
                  title="Connect next step"
                >
                  <ChevronRight size={10} />
                </div>
              </div>
            </div>
          )}

          {/* Collect Input Preview */}
          {node.node_type === "collect_input" && (
            <div className="space-y-1.5">
              <p className="text-slate-600 text-[11px] italic bg-purple-50 p-1.5 rounded border border-purple-100">
                "{node.config?.prompt_text || "Enter value:"}"
              </p>
              <div className="flex items-center justify-between text-[11px] text-purple-700">
                <span>Save to: <code>vars.{node.config?.var_key || "input"}</code></span>
                <div
                  onMouseDown={(e) => startConnecting(node.node_key, "next", "next", {}, e)}
                  className="w-4 h-4 rounded-full bg-purple-600 flex items-center justify-center text-white cursor-crosshair hover:scale-125"
                  title="Connect next step"
                >
                  <ChevronRight size={10} />
                </div>
              </div>
            </div>
          )}

          {/* Create CRM Lead Preview */}
          {node.node_type === "create_lead" && (
            <div className="space-y-1.5">
              <div className="p-2 bg-blue-50 border border-blue-200 text-blue-900 rounded-lg text-[11px]">
                <div className="font-bold flex items-center gap-1.5">
                  <Database size={12} className="text-blue-600" />
                  <span>Create CRM Lead</span>
                </div>
                <div className="text-[10px] text-blue-700 mt-1">
                  Status: <span className="font-bold">{node.config?.status || "hot"}</span> • Source: {node.config?.source || "WhatsApp Bot"}
                </div>
              </div>
              <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                <span>Next Step</span>
                <div
                  onMouseDown={(e) => startConnecting(node.node_key, "next", "next", {}, e)}
                  className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center text-white cursor-crosshair hover:scale-125 transition shrink-0"
                  title="Connect next step"
                >
                  <ChevronRight size={10} />
                </div>
              </div>
            </div>
          )}

          {/* Pacing Typing Delay */}
          {node.node_type === "delay" && (
            <div className="space-y-1.5">
              <div className="p-2 bg-orange-50 border border-orange-200 text-orange-900 rounded-lg text-[11px] flex items-center gap-1.5">
                <Clock size={12} className="text-orange-600" />
                <span>Typing Delay: <b>{node.config?.delay_seconds || 2}s</b></span>
              </div>
              <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                <span>Next Step</span>
                <div
                  onMouseDown={(e) => startConnecting(node.node_key, "next", "next", {}, e)}
                  className="w-4 h-4 rounded-full bg-orange-600 flex items-center justify-center text-white cursor-crosshair hover:scale-125 transition shrink-0"
                  title="Connect next step"
                >
                  <ChevronRight size={10} />
                </div>
              </div>
            </div>
          )}

          {/* API Webhook */}
          {node.node_type === "api_webhook" && (
            <div className="space-y-1.5">
              <div className="p-2 bg-violet-50 border border-violet-200 text-violet-900 rounded-lg text-[11px]">
                <div className="font-bold flex items-center gap-1.5">
                  <Globe size={12} className="text-violet-600" />
                  <span>{node.config?.method || "POST"} Webhook</span>
                </div>
                <p className="text-[10px] text-violet-700 truncate font-mono mt-0.5">
                  {node.config?.url || "https://api.example.com/hook"}
                </p>
              </div>
              <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                <span>Next Step</span>
                <div
                  onMouseDown={(e) => startConnecting(node.node_key, "next", "next", {}, e)}
                  className="w-4 h-4 rounded-full bg-violet-600 flex items-center justify-center text-white cursor-crosshair hover:scale-125 transition shrink-0"
                  title="Connect next step"
                >
                  <ChevronRight size={10} />
                </div>
              </div>
            </div>
          )}

          {/* Set Variable */}
          {node.node_type === "set_variable" && (
            <div className="space-y-1.5">
              <div className="p-2 bg-slate-100 border border-slate-200 text-slate-800 rounded-lg text-[11px]">
                <div className="font-bold flex items-center gap-1.5">
                  <Settings2 size={12} className="text-slate-600" />
                  <span>Set: <code>{node.config?.var_key || "custom_var"}</code></span>
                </div>
                <p className="text-[10px] text-slate-500 truncate mt-0.5 font-mono">
                  = "{node.config?.var_value || ""}"
                </p>
              </div>
              <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                <span>Next Step</span>
                <div
                  onMouseDown={(e) => startConnecting(node.node_key, "next", "next", {}, e)}
                  className="w-4 h-4 rounded-full bg-slate-600 flex items-center justify-center text-white cursor-crosshair hover:scale-125 transition shrink-0"
                  title="Connect next step"
                >
                  <ChevronRight size={10} />
                </div>
              </div>
            </div>
          )}

          {/* Live Agent Handoff Preview */}
          {node.node_type === "handoff" && (
            <div className="p-2 bg-rose-50 border border-rose-200 text-rose-900 rounded-lg text-[11px] space-y-1">
              <div className="flex items-center gap-1 font-bold">
                <UserCheck size={12} />
                <span>Transfers to Live Agent</span>
              </div>
              <p className="text-[10px] text-rose-700">Pauses automation & notifies CRM chat team.</p>
            </div>
          )}

          {/* End Node Preview */}
          {node.node_type === "end" && (
            <div className="p-2 bg-slate-100 text-slate-700 rounded-lg text-center font-bold text-[11px]">
              🛑 End of Conversation
            </div>
          )}

          {/* Generic fallback for any other node with next_node_key */}
          {!["interactive_menu", "send_buttons", "send_list", "send_message", "send_media", "send_template", "send_cta", "condition", "ai_intent", "ai_generate", "crm_lookup", "collect_input", "create_lead", "delay", "api_webhook", "set_variable", "handoff", "end", "start"].includes(node.node_type) && !node.node_type?.includes("trigger") && (
            <div className="space-y-1.5">
              <p className="text-slate-500 text-[10px] italic">Custom node configuration</p>
              <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                <span>Next Step</span>
                <div
                  onMouseDown={(e) => startConnecting(node.node_key, "next", "next", {}, e)}
                  className="w-4 h-4 rounded-full bg-slate-600 flex items-center justify-center text-white cursor-crosshair hover:scale-125 transition shrink-0"
                  title="Connect next step"
                >
                  <ChevronRight size={10} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Render Node Configuration Inspector (Right Panel) ───────────────────────
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
            value={selectedNode.node_key}
            onChange={(e) => {
              const newKey = e.target.value.replace(/[^a-zA-Z0-9_]/g, "");
              setNodes(prev => prev.map(n => n.node_key === selectedNode.node_key ? { ...n, node_key: newKey } : n));
              setSelectedNodeKey(newKey);
            }}
            disabled={selectedNode.node_key === "start"}
            className="w-full px-3 py-1.5 text-xs font-mono font-bold bg-slate-50 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* ── INTERACTIVE MENU CONFIGURATION ────────────────────────── */}
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
            <div className="grid grid-cols-3 gap-2">
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
              <div className="col-span-2">
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
      <div className={`w-[340px] h-[580px] rounded-[40px] p-3 shadow-2xl flex flex-col border-[6px] transition-colors shrink-0 relative overflow-hidden select-none ${
        simDarkTheme ? "bg-[#0b141a] border-[#1f2c34] text-white" : "bg-[#efeae2] border-slate-800 text-slate-900"
      }`}>
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
                <span className="text-xs font-bold truncate max-w-[130px]">Madhura Bank Bot</span>
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
        <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0 relative z-10 text-xs font-sans">
          {/* Encryption pill */}
          <div className="text-center my-1">
            <span className={`px-2.5 py-1 rounded-md text-[9px] font-medium inline-flex items-center gap-1 shadow-sm ${
              simDarkTheme ? "bg-[#182229] text-[#ffd279]" : "bg-[#ffeecd] text-amber-900"
            }`}>
              🔒 Messages are end-to-end encrypted
            </span>
          </div>

          {/* Render Messages */}
          {simMessages.map((msg, mIdx) => {
            const isBot = msg.sender === "bot";
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
                    {msg.text}
                  </p>

                  {/* Multi-Section Interactive Buttons Display */}
                  {msg.type === "interactive_menu" && Array.isArray(msg.sections) && (
                    <div className="mt-2.5 space-y-2 border-t border-slate-600/30 pt-2">
                      {msg.sections.map((sec, sIdx) => (
                        <div key={sIdx} className="space-y-1">
                          {sec.title && (
                            <span className={`text-[10px] font-bold tracking-wide block ${
                              simDarkTheme ? "text-[#00a884]" : "text-emerald-700"
                            }`}>
                              {sec.title}
                            </span>
                          )}
                          <div className="space-y-1">
                            {(sec.buttons || []).map((btn, bIdx) => (
                              <button
                                key={bIdx}
                                type="button"
                                onClick={() => executeSimStep(btn.label || btn.title || btn.id)}
                                className={`w-full py-1.5 px-2.5 rounded-xl text-center text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 ${
                                  simDarkTheme
                                    ? "bg-[#111b21] hover:bg-[#202c33] text-[#00a884] border border-[#2a3942] active:scale-95"
                                    : "bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-200 active:scale-95"
                                }`}
                              >
                                <span>{btn.label || btn.title}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Standard Reply Buttons Display */}
                  {msg.type === "buttons" && Array.isArray(msg.buttons) && (
                    <div className="mt-2 space-y-1 border-t border-slate-600/30 pt-1.5">
                      {msg.buttons.map((btn, bIdx) => (
                        <button
                          key={bIdx}
                          type="button"
                          onClick={() => executeSimStep(btn.title || btn.id)}
                          className={`w-full py-1.5 px-2 rounded-xl text-center text-xs font-bold transition-all ${
                            simDarkTheme
                              ? "bg-[#111b21] hover:bg-[#202c33] text-[#00a884] border border-[#2a3942]"
                              : "bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-200"
                          }`}
                        >
                          {btn.title}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* WhatsApp Interactive List Menu Display ("View All Categories" / "View Options") */}
                  {msg.type === "list" && Array.isArray(msg.rows) && (
                    <div className="mt-2 border-t border-slate-600/30 pt-1.5 space-y-1">
                      <button
                        type="button"
                        onClick={() => setSimListPopup({
                          title: msg.title || "Our Categories",
                          rows: msg.rows || [],
                          buttonText: msg.button_text || "View Options"
                        })}
                        className={`w-full py-2 px-3 rounded-xl text-center text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 active:scale-95 ${
                          simDarkTheme
                            ? "bg-[#00a884] hover:bg-[#008f6f] text-white"
                            : "bg-[#008069] hover:bg-[#006a57] text-white"
                        }`}
                      >
                        <ListOrdered size={14} />
                        <span>{msg.button_text || "View All Categories"}</span>
                      </button>
                    </div>
                  )}

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

        {/* Quick Test Chips Bar */}
        <div className={`px-2 py-1.5 flex items-center gap-1.5 overflow-x-auto shrink-0 border-t ${
          simDarkTheme ? "bg-[#1f2c34] border-[#2a3942]" : "bg-slate-100 border-slate-200"
        }`}>
          {["🍲 View All", "1", "2", "3", "📦 Order", "👤 Agent", "🔄 Restart"].map((chip, cIdx) => (
            <button
              key={cIdx}
              type="button"
              onClick={() => {
                if (chip === "🔄 Restart") resetSimulation();
                else if (chip === "🍲 View All") executeSimStep("View All Categories");
                else if (chip === "📦 Order") executeSimStep("Place Order");
                else if (chip === "👤 Agent") executeSimStep("Human Support");
                else executeSimStep(chip);
              }}
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap transition-colors shrink-0 shadow-xs ${
                simDarkTheme
                  ? "bg-[#2a3942] hover:bg-[#00a884] text-emerald-400 hover:text-white"
                  : "bg-white hover:bg-emerald-600 text-emerald-800 hover:text-white border border-emerald-200"
              }`}
            >
              {chip}
            </button>
          ))}
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
                      executeSimStep(row.title || row.id);
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
    const wires = getWirePaths();

    const filteredPaletteCategories = PALETTE_CATEGORIES.map(cat => ({
      ...cat,
      items: cat.items.filter(item =>
        paletteFilter ? (item.label.toLowerCase().includes(paletteFilter.toLowerCase()) || item.desc.toLowerCase().includes(paletteFilter.toLowerCase())) : true
      )
    })).filter(cat => cat.items.length > 0);

    const studioContent = (
      <div
        id="madhura-visual-flow-studio"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: "100vw",
          height: "100vh",
          zIndex: 99999,
          margin: 0,
          padding: 0
        }}
        className="bg-slate-900 text-slate-100 flex flex-col font-sans select-none overflow-hidden"
      >
        {/* Top Studio Action Bar */}
        <div className="h-14 w-full bg-slate-950 border-b border-slate-800 px-3 sm:px-4 flex items-center justify-between shrink-0 z-30 relative gap-2">
          {/* Left: Exit + Title + Trigger Info + Blocks Toggle */}
          <div className="flex items-center gap-2.5 shrink-0 min-w-0">
            <button
              onClick={handleCloseStudio}
              className="px-2.5 py-1.5 text-slate-300 hover:text-white rounded-xl hover:bg-slate-800 transition flex items-center gap-1.5 text-xs font-semibold shrink-0"
              title="Close Studio & Return to Flows"
            >
              <ChevronLeft size={16} />
              <span className="hidden sm:inline">Exit</span>
            </button>

            <div className="flex items-center gap-2 border-l border-slate-800 pl-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold shrink-0">
                <GitFork size={16} />
              </div>
              <div className="min-w-0">
                <input
                  type="text"
                  value={flowName}
                  onChange={(e) => setFlowName(e.target.value)}
                  placeholder="Flow Name..."
                  className="bg-transparent text-xs sm:text-sm font-bold text-white outline-none hover:bg-slate-800/60 px-1.5 py-0.5 rounded focus:ring-1 focus:ring-emerald-500 max-w-[140px] sm:max-w-xs truncate"
                />
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 px-1.5">
                  <span>Trigger:</span>
                  <select
                    value={flowTriggerType || "manual"}
                    onChange={(e) => setFlowTriggerType(e.target.value)}
                    className="bg-slate-800 text-emerald-400 font-bold rounded px-1.5 py-0.5 text-[10px] border border-slate-700 outline-none cursor-pointer"
                  >
                    <option value="manual">Manual / Given Number Only</option>
                    <option value="keyword">Keyword Command Only</option>
                  </select>
                  <span>•</span>
                  <span>{nodes.length} Nodes</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowPalette(p => !p)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 shrink-0 ${
                showPalette
                  ? "bg-slate-800 text-white border-slate-700"
                  : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
              }`}
              title="Toggle Component Palette"
            >
              <Grid size={13} className={showPalette ? "text-emerald-400" : ""} />
              <span className="hidden md:inline">Blocks</span>
            </button>
          </div>

          {/* Center: Canvas View Controls Toolbar */}
          <div className="hidden lg:flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl shrink-0">
            <button
              onClick={() => setZoom(z => Math.max(0.4, Number((z - 0.1).toFixed(2))))}
              className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
              title="Zoom Out"
            >
              <ZoomOut size={14} />
            </button>
            <span className="text-[11px] font-mono font-bold px-1.5 text-slate-300 min-w-[42px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(z => Math.min(1.8, Number((z + 0.1).toFixed(2))))}
              className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
              title="Zoom In"
            >
              <ZoomIn size={14} />
            </button>
            <div className="h-3.5 w-px bg-slate-800 mx-0.5" />
            <button
              onClick={() => fitToScreen()}
              className="px-2 py-1 text-[10px] font-bold text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40 rounded flex items-center gap-1 transition"
              title="Auto-Fit All Flow Nodes to Screen"
            >
              <Maximize2 size={11} />
              <span>Fit Screen</span>
            </button>
            <button
              onClick={() => { setZoom(1); setPan({ x: 80, y: 80 }); }}
              className="px-2 py-1 text-[10px] font-bold text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
              title="Reset View"
            >
              Reset
            </button>
          </div>

          {/* Right: Actions (Templates, Simulator, Inspector, Save, Publish) */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Quick Template Switcher */}
            <div className="relative group">
              <button
                type="button"
                className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition"
              >
                <Sparkles size={13} className="text-amber-400" />
                <span className="hidden sm:inline">Templates</span>
                <ChevronDown size={11} />
              </button>
              <div className="absolute right-0 mt-1 w-64 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-2 hidden group-hover:block z-50 animate-in fade-in duration-100">
                <button
                  type="button"
                  onClick={() => {
                    setFlowName("Food & Products Flow Bot");
                    setFlowDesc("Interactive flow bot: Buttons -> View All Categories -> Products -> Orders & Inquiries");
                    setFlowTriggerType("manual");
                    setFlowKeywords("menu");
                    const starter = getFoodBotStarterNodes();
                    setNodes(starter);
                    setSelectedNodeKey("welcome_menu");
                    resetSimulation();
                    setTimeout(() => fitToScreen(starter), 150);
                  }}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-emerald-500/20 text-xs font-semibold text-white flex items-start gap-2.5 transition"
                >
                  <span className="text-lg">🍲</span>
                  <div>
                    <div className="font-bold text-emerald-400">Food &amp; Products Flow</div>
                    <div className="text-[10px] text-slate-400">Buttons &rarr; View All Categories &rarr; Products &rarr; Order</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFlowName("Interactive Banking & Account Services Bot");
                    setFlowDesc("Multi-section interactive banking menu");
                    setFlowTriggerType("manual");
                    setFlowKeywords("menu, banking");
                    const starter = getDefaultStarterNodes();
                    setNodes(starter);
                    setSelectedNodeKey("banking_menu");
                    resetSimulation();
                    setTimeout(() => fitToScreen(starter), 150);
                  }}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-slate-800 text-xs font-semibold text-white flex items-start gap-2.5 transition mt-1"
                >
                  <span className="text-lg">🏦</span>
                  <div>
                    <div className="font-bold text-slate-200">Banking &amp; Finance Bot</div>
                    <div className="text-[10px] text-slate-400">Multi-section balance &amp; loan menu</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Test on real WhatsApp Phone */}
            <button
              onClick={() => {
                const phone = prompt("Enter customer phone number to test-send WhatsApp menu (e.g. 919876543210):");
                if (phone) triggerFlowForPhone(phone);
              }}
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/60 flex items-center gap-1.5 transition"
              title="Send flow menu directly to WhatsApp phone"
            >
              <Send size={13} />
              <span className="hidden md:inline">Test Phone</span>
            </button>

            {/* WhatsApp Phone Simulator Toggle */}
            <button
              onClick={togglePreview}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
                showRightPanel && activeInspectorTab === "preview"
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm ring-1 ring-emerald-500/30"
                  : "bg-slate-800 text-slate-300 border-slate-700 hover:text-white"
              }`}
              title="Toggle WhatsApp Phone Simulator"
            >
              <Smartphone size={14} className={showRightPanel && activeInspectorTab === "preview" ? "text-emerald-400 animate-pulse" : "text-slate-400"} />
              <span className="hidden sm:inline">WhatsApp Preview</span>
            </button>

            {/* Node Inspector Toggle */}
            <button
              onClick={toggleInspector}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
                showRightPanel && activeInspectorTab === "config"
                  ? "bg-slate-700 text-white border-slate-600 shadow-sm"
                  : "bg-slate-800 text-slate-300 border-slate-700 hover:text-white"
              }`}
              title="Toggle Node Inspector"
            >
              <Sliders size={13} />
              <span className="hidden sm:inline">Inspector</span>
            </button>

            {editingFlowId && (
              <button
                onClick={() => openVersions(editingFlowId)}
                className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition"
                title="Version History"
              >
                <Layers size={13} />
                <span className="hidden lg:inline">Versions</span>
              </button>
            )}

            <button
              onClick={() => handleSaveFlow(false)}
              disabled={saving}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              <span className="hidden sm:inline">Save Draft</span>
            </button>

            <button
              onClick={() => handleSaveFlow(true)}
              disabled={saving}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 transition hover:scale-105"
            >
              <Play size={13} />
              <span>Publish Live</span>
            </button>
          </div>
        </div>

        {/* Studio Workspace Layout */}
        <div className="flex-1 flex w-full min-h-0 relative overflow-hidden">
          {/* Left Component Palette Sidebar (Collapsible) */}
          {showPalette && (
            <div className="w-72 bg-slate-950 border-r border-slate-800 flex flex-col shrink-0 z-20 select-none transition-all duration-150">
              <div className="p-3 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-extrabold text-slate-300 uppercase tracking-wider">
                    Component Palette
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-md font-bold">
                    Click to add
                  </span>
                </div>
                <button
                  onClick={() => setShowPalette(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                  title="Collapse Palette"
                >
                  <ChevronLeft size={16} />
                </button>
              </div>

              {/* Palette Search Input */}
              <div className="p-2 border-b border-slate-800/80">
                <div className="relative">
                  <Search size={12} className="absolute left-2.5 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    value={paletteFilter}
                    onChange={(e) => setPaletteFilter(e.target.value)}
                    placeholder="Search blocks..."
                    className="w-full pl-7 pr-2 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 outline-none focus:border-emerald-500"
                  />
                  {paletteFilter && (
                    <button
                      onClick={() => setPaletteFilter("")}
                      className="absolute right-2 top-2 text-slate-500 hover:text-white text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {filteredPaletteCategories.map(cat => (
                  <div key={cat.id} className="border border-slate-800/80 rounded-xl overflow-hidden bg-slate-900/40">
                    <button
                      type="button"
                      onClick={() => toggleCategory(cat.id)}
                      className="w-full px-3 py-2 flex items-center justify-between text-xs font-bold text-slate-300 hover:bg-slate-800/60 transition"
                    >
                      <span className="flex items-center gap-2">
                        <cat.icon size={13} className={cat.color} />
                        {cat.name}
                      </span>
                      {openCategories[cat.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>

                    {(openCategories[cat.id] || paletteFilter) && (
                      <div className="p-1.5 grid grid-cols-1 gap-1 border-t border-slate-800/60 bg-slate-950/60">
                        {cat.items.map((item, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => addNodeFromPalette(item)}
                            className="w-full text-left p-2 rounded-lg hover:bg-slate-800/80 border border-transparent hover:border-slate-700 transition flex items-center gap-2.5 group"
                          >
                            <span className="text-base group-hover:scale-110 transition-transform">{item.icon}</span>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-semibold text-slate-200 truncate">{item.label}</div>
                              <div className="text-[10px] text-slate-500 truncate">{item.desc}</div>
                            </div>
                            <Plus size={12} className="text-slate-500 group-hover:text-emerald-400 opacity-0 group-hover:opacity-100 transition" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 2D Canvas Graph Area ───────────────────────────────── */}
          <div
            ref={canvasRef}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            className="flex-1 min-w-0 h-full bg-[#090d16] relative overflow-hidden cursor-crosshair canvas-grid"
            style={{
              backgroundImage: "radial-gradient(#1e293b 1.5px, transparent 1.5px)",
              backgroundSize: `${24 * zoom}px ${24 * zoom}px`
            }}
          >
            {/* Floating Re-open Palette Button when Palette is collapsed */}
            {!showPalette && (
              <button
                onClick={() => setShowPalette(true)}
                className="absolute top-4 left-4 z-20 px-3 py-2 bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-white text-xs font-bold rounded-xl shadow-xl flex items-center gap-2 backdrop-blur transition hover:scale-105"
                title="Open Component Palette"
              >
                <Plus size={14} className="text-emerald-400" />
                <span>Add Blocks</span>
              </button>
            )}

            {/* SVG Connector Wires Layer */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none z-0"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "0 0"
              }}
            >
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#10B981" />
                </marker>
                <marker id="arrow-active" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#3B82F6" />
                </marker>
              </defs>

              {/* Render Existing Edges */}
              {wires.map(w => {
                const midX = (w.startX + w.endX) / 2;
                const midY = (w.startY + w.endY) / 2;
                return (
                  <g key={w.id} className="group pointer-events-auto">
                    {/* Wider hit path for easy hover */}
                    <path
                      d={w.pathD}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={14}
                      className="cursor-pointer"
                    />
                    <path
                      d={w.pathD}
                      fill="none"
                      stroke={w.color}
                      strokeWidth={2.5}
                      markerEnd="url(#arrow)"
                      className="transition-all group-hover:stroke-emerald-400 group-hover:stroke-[3.5]"
                    />
                    {/* Wire Label & Delete Click Pill */}
                    <g
                      transform={`translate(${midX}, ${midY})`}
                      onClick={(e) => {
                        e.stopPropagation();
                        disconnectWire(w);
                      }}
                      className="cursor-pointer group/pill"
                    >
                      <rect
                        x={-34}
                        y={-10}
                        width={68}
                        height={20}
                        rx={10}
                        fill="#0f172a"
                        stroke={w.color}
                        strokeWidth={1.5}
                        className="transition-colors group-hover/pill:fill-rose-950 group-hover/pill:stroke-rose-500 shadow-md"
                      />
                      <text
                        x={-4}
                        y={3}
                        fill="#e2e8f0"
                        fontSize="9"
                        fontWeight="bold"
                        textAnchor="middle"
                        className="group-hover/pill:fill-rose-200 select-none pointer-events-none"
                      >
                        {w.label.slice(0, 8)}
                      </text>
                      <text
                        x={22}
                        y={3.5}
                        fill="#94a3b8"
                        fontSize="10"
                        fontWeight="bold"
                        textAnchor="middle"
                        className="group-hover/pill:fill-rose-400 select-none pointer-events-none"
                      >
                        ✕
                      </text>
                    </g>
                  </g>
                );
              })}

              {/* Render Dynamic Connecting Wire (Smooth Bezier curve) */}
              {connectingFrom && (
                <g>
                  <path
                    d={`M ${connectingFrom.x || 0} ${connectingFrom.y || 0} C ${(connectingFrom.x || 0) + Math.max(50, Math.abs(connectingMousePos.x - (connectingFrom.x || 0)) * 0.55)} ${connectingFrom.y || 0}, ${connectingMousePos.x - Math.max(50, Math.abs(connectingMousePos.x - (connectingFrom.x || 0)) * 0.55)} ${connectingMousePos.y}, ${connectingMousePos.x} ${connectingMousePos.y}`}
                    fill="none"
                    stroke="#10B981"
                    strokeWidth={3}
                    strokeDasharray="6,4"
                    markerEnd="url(#arrow-active)"
                    className="animate-pulse"
                  />
                  <circle
                    cx={connectingMousePos.x}
                    cy={connectingMousePos.y}
                    r={5}
                    fill="#10B981"
                  />
                </g>
              )}
            </svg>

            {/* Nodes Render Container */}
            <div
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "0 0"
              }}
              className="absolute inset-0 pointer-events-none"
            >
              <div className="pointer-events-auto">
                {nodes.map(node => renderCanvasNode(node))}
              </div>
            </div>

            {/* Floating Bottom Center Canvas Quick Toolbar */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-slate-900/90 border border-slate-800/80 backdrop-blur-md px-3.5 py-2 rounded-2xl shadow-2xl text-xs text-slate-300 select-none">
              <button
                onClick={() => fitToScreen()}
                className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 font-bold rounded-lg transition flex items-center gap-1.5"
                title="Fit all flow nodes to screen view"
              >
                <Maximize2 size={13} />
                <span>Fit View</span>
              </button>
              <div className="h-3 w-px bg-slate-700" />
              <button
                onClick={() => setZoom(z => Math.max(0.4, Number((z - 0.1).toFixed(2))))}
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition"
                title="Zoom Out"
              >
                <ZoomOut size={13} />
              </button>
              <span className="font-mono text-[11px] font-bold text-slate-200 min-w-[36px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom(z => Math.min(1.8, Number((z + 0.1).toFixed(2))))}
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition"
                title="Zoom In"
              >
                <ZoomIn size={13} />
              </button>
              <div className="h-3 w-px bg-slate-700" />
              <span className="text-[10px] text-slate-400 hidden sm:inline">
                Drag canvas to pan • Click node to edit • Drag dots to wire
              </span>
            </div>
          </div>

          {/* Right Node Inspector / WhatsApp Simulator Panel (Dockable & Collapsible) */}
          {showRightPanel && (
            <div className="w-[420px] max-w-[92vw] shrink-0 h-full bg-slate-950 border-l border-slate-800 flex flex-col z-30 select-none shadow-2xl animate-in slide-in-from-right duration-150">
              {/* Inspector Top Tabs + Close ✕ */}
              <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 p-1.5">
                <div className="flex items-center gap-1 flex-1">
                  <button
                    onClick={() => setActiveInspectorTab("config")}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                      activeInspectorTab === "config" ? "bg-slate-800 text-white shadow" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <Sliders size={13} />
                    <span>Inspector</span>
                  </button>
                  <button
                    onClick={() => setActiveInspectorTab("preview")}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                      activeInspectorTab === "preview" ? "bg-emerald-600/30 text-emerald-300 shadow" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <Smartphone size={13} />
                    <span>Preview</span>
                  </button>
                  <button
                    onClick={() => setActiveInspectorTab("audit")}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                      activeInspectorTab === "audit" ? "bg-slate-800 text-white shadow" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <Terminal size={13} />
                    <span>Logs ({simLogs.length})</span>
                  </button>
                </div>

                <button
                  onClick={() => setShowRightPanel(false)}
                  className="ml-2 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition shrink-0"
                  title="Close Inspector / Simulator Panel"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Tab Contents */}
              <div className="flex-1 overflow-y-auto min-h-0 bg-white text-slate-900 w-full">
                {activeInspectorTab === "config" && renderNodeInspector()}

                {activeInspectorTab === "preview" && (
                  <div className="p-4 flex items-center justify-center bg-slate-900 min-h-full">
                    {renderWhatsAppPhoneSimulator()}
                  </div>
                )}

                {activeInspectorTab === "audit" && (
                  <div className="p-4 space-y-4 bg-slate-900 text-slate-100 min-h-full font-mono text-xs">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <span className="font-bold text-emerald-400">⚡ Execution State</span>
                      <button onClick={resetSimulation} className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1">
                        <RotateCcw size={10} /> Reset
                      </button>
                    </div>

                    <div className="space-y-1">
                      <div className="text-[11px] text-slate-400">Current Node: <b className="text-white">{simCurrentNode || "start"}</b></div>
                      <div className="text-[11px] text-slate-400">Status: <b className={simEnded ? "text-rose-400" : "text-emerald-400"}>{simEnded ? "Completed" : "Waiting for reply"}</b></div>
                    </div>

                    {/* Variables Snapshot */}
                    <div className="space-y-1">
                      <span className="text-[11px] font-bold text-slate-300">Variables Snapshot:</span>
                      <pre className="p-2 bg-slate-950 rounded-lg text-[10px] text-emerald-300 overflow-x-auto max-h-40">
                        {JSON.stringify(simVars, null, 2)}
                      </pre>
                    </div>

                    {/* Execution Event Log */}
                    <div className="space-y-1">
                      <span className="text-[11px] font-bold text-slate-300">Event Trace:</span>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {simLogs.map((log, idx) => (
                          <div key={idx} className="p-1.5 bg-slate-950/80 rounded text-[10px] text-slate-300 border-l-2 border-emerald-500">
                            {log}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── FLOW VERSIONS MODAL ────────────────────────────────────── */}
        {showVersionsModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowVersionsModal(false)}>
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 space-y-4 shadow-2xl text-slate-100" onClick={e => e.stopPropagation()}>
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
    <div className="min-h-screen bg-slate-50 font-sans">
      <WhatsAppNav />

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Header Hero Banner */}
        <div className="bg-gradient-to-r from-[#0b141a] via-[#111b21] to-[#005c4b] rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 text-emerald-300 text-xs font-extrabold rounded-full border border-emerald-500/30">
              <Sparkles size={14} /> WhatsApp Visual Conversational Platform
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Interactive Bot Flows &amp; State Engine
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100/80 leading-relaxed">
              Design multi-section interactive WhatsApp menus with structured buttons, dynamic CRM lookups, API webhooks, condition branches, and real-time smartphone simulators.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 relative z-10">
            <button
              onClick={handleSeedFlows}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-2xl backdrop-blur-sm border border-white/10 flex items-center gap-2 transition"
            >
              <Database size={15} />
              <span>Load Starter Templates</span>
            </button>
            <button
              onClick={() => openStudio(null)}
              className="px-5 py-2.5 bg-[#25D366] hover:bg-[#20bd5a] text-slate-900 text-xs font-extrabold rounded-2xl shadow-lg shadow-emerald-500/30 flex items-center gap-2 transition hover:scale-105"
            >
              <Plus size={16} />
              <span>Create Visual Flow</span>
            </button>
          </div>
        </div>

        {/* View Tabs & Search Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
            <button
              onClick={() => setActiveTab("flows")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeTab === "flows" ? "bg-emerald-50 text-emerald-800 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <GitFork size={15} />
              <span>Configured Flows ({flows.length})</span>
            </button>
            <button
              onClick={() => setActiveTab("runs")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeTab === "runs" ? "bg-emerald-50 text-emerald-800 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Clock size={15} />
              <span>Live Run Audit</span>
            </button>
          </div>

          {activeTab === "flows" && (
            <div className="relative min-w-[280px]">
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
                    Create a new flow or load our preconfigured Banking &amp; Financial bot templates to get started.
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
                    onClick={() => openStudio(null)}
                    className="px-4 py-2 bg-[#25D366] text-slate-900 rounded-xl text-xs font-bold hover:bg-[#20bd5a]"
                  >
                    Create Flow
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                            {flow.description || "Interactive conversational flow with state machine and CRM lookups."}
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
                              const phone = prompt(`Enter customer phone number to send "${flow.name}" to (e.g. 919876543210):`);
                              if (phone) triggerFlowForPhone(phone, flow.id);
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
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Recent Conversational Session Executions</h3>
              <button onClick={fetchRuns} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg">
                <RefreshCw size={14} />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
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
                      <td colSpan={6} className="p-8 text-center text-slate-400">No active execution runs recorded yet.</td>
                    </tr>
                  ) : (
                    runsList.map(run => {
                      let parsedVars = {};
                      try { parsedVars = typeof run.vars === "string" ? JSON.parse(run.vars) : (run.vars || {}); } catch (_) {}

                      return (
                        <tr key={run.id} className="hover:bg-slate-50">
                          <td className="p-3 font-bold text-slate-900">{run.contact_name || "Valued Customer"}</td>
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
            <div className="bg-white rounded-3xl w-full max-w-2xl p-6 space-y-6 shadow-2xl border border-slate-100" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <BarChart2 className="text-emerald-600" size={20} />
                  <div>
                    <h3 className="font-bold text-base text-slate-900">Flow Performance &amp; Conversion Funnel</h3>
                    <p className="text-xs text-slate-500">{selectedAnalyticsFlow.name}</p>
                  </div>
                </div>
                <button onClick={() => setShowAnalyticsModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              {analyticsLoading ? (
                <div className="py-12 text-center text-slate-400 font-semibold">Loading analytics...</div>
              ) : (
                <div className="space-y-6">
                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-4 gap-3 text-center">
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
      </div>
    </div>
  );
}
