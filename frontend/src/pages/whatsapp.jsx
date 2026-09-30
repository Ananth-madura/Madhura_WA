import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import {
  MessageCircle,
  MessageSquare,
  LogOut,
  RefreshCw,
  Send,
  Loader2,
  Smartphone,
  ChevronLeft,
  Plus,
  UserPlus,
  X,
  FileText,
  Paperclip,
  MapPin,
  Navigation,
  CreditCard,
  Search,
  Info,
  PhoneCall,
  Pin,
  VolumeX,
  Volume2,
  Sparkles,
  Image,
  Music,
  Zap,
  BarChart3,
  ListOrdered,
  SendHorizontal,
  CheckCircle2,
  Database,
  Key,
  Globe,
  Mic,
  Smile,
  ChevronDown,
  Copy,
  Download,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Bell,
  Star,
  Forward,
  MoreVertical,
  ArrowDown,
  Square,
  Play,
  Pause,
  ExternalLink,
  CornerDownLeft,
  Phone,
  Users,
  PanelLeftClose,
  PanelLeftOpen,
  Columns,
} from "lucide-react";
import axios from "axios";
import { API } from "../config/api";
import WhatsAppNav from "../components/WhatsAppNav";
import socket from "../socket/socket";
import RichMessageContent from "../components/RichMessageContent";
import WAVariablePicker, { evaluateMessagePlaceholders } from "../components/WAVariablePicker";
import WAConfigPrompt from "../components/WAConfigPrompt";
import WAContactAvatar from "../components/WAContactAvatar";

function formatChatTime(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp * 1000);
  const now = new Date();

  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }

  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: "long" });
  }

  return date.toLocaleDateString([], { day: "2-digit", month: "2-digit", year: "numeric" });
}

function isFilename(str) {
  if (!str || typeof str !== "string") return false;
  return /\.(md|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|zip|rar|7z|tar|gz|json|png|jpg|jpeg|webp|gif|mp4|mov|mp3|ogg|wav)$/i.test(str.trim());
}

// Day divider label above the first message of each day, like WhatsApp's
// sticky TODAY / YESTERDAY / date chips.
function formatDayDivider(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp * 1000);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "TODAY";
  if (date.toDateString() === yesterday.toDateString()) return "YESTERDAY";

  const diffDays = Math.floor((today - date) / (1000 * 60 * 60 * 24));
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: "long" }).toUpperCase();
  return date.toLocaleDateString([], { day: "2-digit", month: "long", year: "numeric" });
}

// A compact everyday set — enough to cover normal business chat without
// pulling in a full emoji-picker dependency for a few hundred glyphs.
const EMOJI_GROUPS = [
  {
    label: "Frequent",
    emojis: ["👍", "🙏", "✅", "❤️", "😊", "😂", "🎉", "🔥", "👌", "💯", "🙌", "😍", "🤝", "⭐", "✨", "💪"],
  },
  {
    label: "Smileys",
    emojis: ["😀", "😃", "😄", "😁", "😅", "🤣", "🙂", "😉", "😇", "🥰", "😘", "😋", "😎", "🤩", "🥳", "🤔",
             "😐", "😴", "😢", "😭", "😤", "😠", "😱", "🤗", "🤫", "😬", "🙄", "😌", "😷", "🤒", "🥺", "😳"],
  },
  {
    label: "Gestures & People",
    emojis: ["👋", "🤚", "✋", "👏", "🙋", "🤷", "🙇", "💁", "👇", "👉", "👈", "☝️", "✌️", "🤞", "👊", "🫰"],
  },
  {
    label: "Business",
    emojis: ["📅", "📆", "⏰", "📞", "📱", "💬", "📩", "📄", "📎", "📷", "📍", "🏠", "🏢", "🛠️", "⚡", "🧾",
             "💳", "💰", "📊", "📈", "🚚", "🔧", "❄️", "🧯", "🔔", "🎁", "🚀", "🏆", "❌", "⚠️", "🆗", "🔴"],
  },
];

const DEFAULT_SPEED_REPLIES = [
  {
    id: "sr_greet",
    label: "⚡ Greeting",
    text: "Hello {first_name}! Thank you for contacting Madhura Tech. How can we help you today?",
  },
  {
    id: "sr_bank",
    label: "💳 Bank Details",
    text: "Here are our official Bank Details for RTGS / NEFT / IMPS:\nBank: HDFC Bank\nA/C Name: Madhura Technologies\nA/C No: 50200012345678\nIFSC: HDFC0001234\nBranch: Guindy, Chennai",
  },
  {
    id: "sr_location",
    label: "📍 Office Location",
    text: "Visit us at: Madhura Tech, No. 12/4 Anna Salai, Guindy, Chennai - 600032.\nTimings: Mon-Sat 9:30 AM to 6:30 PM.",
  },
  {
    id: "sr_invoice",
    label: "🧾 Invoice Due",
    text: "Dear {first_name}, kindly note that your invoice payment is pending. Please share the payment screenshot once completed. Thank you!",
  },
  {
    id: "sr_menu",
    label: "🤖 Self-Help Menu",
    text: "Hello! Please reply with *MENU* to view our interactive services catalog, quotation status, and self-help options.",
  },
  {
    id: "sr_callback",
    label: "📞 Callback Request",
    text: "We have registered a callback request with our customer support engineer. We will call you shortly on this number.",
  },
  {
    id: "sr_amc",
    label: "🛠️ AMC Service",
    text: "Hello {first_name}, your Annual Maintenance Contract (AMC) service visit is scheduled. Our certified technician will arrive at your premises.",
  },
];

function sameDay(a, b) {
  if (!a || !b) return false;
  return new Date(a * 1000).toDateString() === new Date(b * 1000).toDateString();
}

/**
 * Real WhatsApp delivery ticks. The old UI hardcoded a blue ✓✓ on every
 * outgoing message, so a queued or failed send still looked "read".
 * pending → clock, sent → single ✓, delivered → grey ✓✓, read → blue ✓✓.
 */
function MessageTicks({ status, className = "" }) {
  if (!status) return null;

  if (status === "failed" || status === "error") {
    return <span className={`hl-badge hl-badge-error font-bold ${className}`} title="Failed to send">!</span>;
  }
  if (status === "pending" || status === "queued" || status === "sending") {
    return (
      <svg viewBox="0 0 16 16" className={`w-3.5 h-3.5 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.5" aria-label="Pending">
        <circle cx="8" cy="8" r="6" />
        <path d="M8 4.5V8l2.5 1.5" strokeLinecap="round" />
      </svg>
    );
  }

  const isRead = status === "read" || status === "played";
  const isSingle = status === "sent";
  const color = isRead ? "text-[var(--color-info)]" : "text-[var(--color-ink-2)]";

  return (
    <span className="wa-tick-transition inline-flex">
      <svg
        viewBox="0 0 18 12"
        className={`w-4 h-3 ${color} ${className}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-label={isRead ? "Read" : isSingle ? "Sent" : "Delivered"}
      >
        <path d="M1 6.5 L4.2 9.7 L10.2 2.6" />
        {!isSingle && <path d="M7 6.5 L10.2 9.7 L16.2 2.6" />}
      </svg>
    </span>
  );
}

/** WhatsApp-style typing indicator with 3 bouncing dots */
function TypingIndicator() {
  return (
    <div className="flex justify-start mb-2 wa-bubble-enter">
      <div className="hl-card rounded-lg rounded-tl-none px-3 py-2.5 flex items-center gap-0.5">
        <span className="wa-typing-dot" />
        <span className="wa-typing-dot" />
        <span className="wa-typing-dot" />
      </div>
    </div>
  );
}

// WhatsApp's tiled doodle wallpaper, inlined as an SVG data URI so it needs no
// asset request and survives any CSP.
const CHAT_WALLPAPER =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='260' height='260' viewBox='0 0 260 260'%3E%3Cg fill='none' stroke='%23ffffff' stroke-opacity='0.035' stroke-width='1.6' stroke-linecap='round'%3E%3Cpath d='M22 34c6-8 16-8 22 0M30 52v14M18 60h24'/%3E%3Ccircle cx='96' cy='30' r='9'/%3E%3Cpath d='M92 30l3 3 6-7'/%3E%3Cpath d='M150 22h26v18h-9l-5 6-4-6h-8z'/%3E%3Cpath d='M214 26c5 0 9 4 9 9s-4 9-9 9h-3l-5 5v-5c-4-1-7-4-7-9 0-5 4-9 9-9z'/%3E%3Cpath d='M34 108c0-7 5-12 12-12s12 5 12 12-5 12-12 12h-4l-6 5v-6c-1-2-2-6-2-11z'/%3E%3Cpath d='M104 100l8 14h-16z'/%3E%3Ccircle cx='170' cy='108' r='10'/%3E%3Cpath d='M166 108h8M170 104v8'/%3E%3Cpath d='M212 98h20v16h-20zM216 98v-4h12v4'/%3E%3Cpath d='M24 178c4-6 12-6 16 0M32 190v10'/%3E%3Cpath d='M84 172h22l-4 20H88z'/%3E%3Cpath d='M150 176c6-4 14 0 14 7 0 6-6 9-10 13l-4 4-4-4c-4-4-10-7-10-13 0-7 8-11 14-7z'/%3E%3Ccircle cx='218' cy='184' r='11'/%3E%3Cpath d='M213 184l4 4 7-8'/%3E%3Cpath d='M60 232h18v14H60zM64 232v-4h10v4'/%3E%3Cpath d='M126 236l7 12h-14z'/%3E%3Cpath d='M186 228c5-3 12 0 12 6 0 5-5 8-8 11l-4 3-3-3c-3-3-8-6-8-11 0-6 6-9 11-6z'/%3E%3C/g%3E%3C/svg%3E\")";

// Mirrors the backend's describeLastMessage() — a live-pushed media/location
// message has no body text, so give the sidebar preview a label instead of
// leaving it blank (which read as "no messages yet").
function previewText(message) {
  if (message.body) return message.body;
  if (message.location) return "📍 Location";
  if (message.hasMedia) return "📎 Attachment";
  return "";
}

function MediaBubble({ chatId, messageId, filename = "", mediaUrl = null, mimetype = null, isMe = false, onPreview = null }) {
  const [media, setMedia] = useState(mediaUrl ? { url: mediaUrl, filename, mimetype } : null);
  const [loading, setLoading] = useState(!mediaUrl);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (mediaUrl) return;
    if (!chatId || !messageId) return;
    setLoading(true);
    setError(false);
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.get(`${API}/api/whatsapp/chat/${encodeURIComponent(chatId)}/media/${messageId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data && (data.url || data.data)) {
        setMedia(data);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    }
    setLoading(false);
  }, [chatId, messageId, mediaUrl]);

  useEffect(() => {
    if (mediaUrl) {
      setMedia({ url: mediaUrl, filename, mimetype });
      setLoading(false);
    } else {
      load();
    }
  }, [load, mediaUrl, filename, mimetype]);

  const rawFilename = filename || media?.filename || `Document_${messageId}`;
  const fileExt = (rawFilename.match(/\.([a-zA-Z0-9]+)$/) || [])[1]?.toLowerCase() ||
    (media?.mimetype ? media.mimetype.split("/")[1]?.split(";")[0]?.toLowerCase() : "file");

  const getBadgeStyle = (ext) => {
    switch (ext) {
      case "pdf": return "hl-badge hl-badge-error";
      case "doc":
      case "docx": return "hl-badge hl-badge-info";
      case "xls":
      case "xlsx":
      case "csv": return "hl-badge hl-badge-success";
      case "ppt":
      case "pptx": return "hl-badge hl-badge-warn";
      case "md":
      case "txt":
      case "json": return "hl-badge hl-badge-info";
      case "zip":
      case "rar":
      case "7z": return "hl-badge hl-badge-warn";
      case "png":
      case "jpg":
      case "jpeg":
      case "webp": return "hl-badge";
      default: return "hl-badge";
    }
  };

  const src = media?.url
    ? (media.url.startsWith("http") || media.url.startsWith("blob:") ? media.url : `${API || ""}${media.url.startsWith("/") ? "" : "/"}${media.url}`)
    : (media?.data ? `data:${media.mimetype || "application/octet-stream"};base64,${media.data}` : null);

  if (media && src) {
    if (media.mimetype?.startsWith("audio/") || media.mimetype?.includes("ogg") || ["mp3", "ogg", "wav", "m4a", "aac"].includes(fileExt)) {
      return (
        <div className="py-1 space-y-1">
          <audio src={src} controls className="max-w-[270px] h-9 rounded-lg" />
          <div className="hl-section-label flex items-center justify-between text-[11px] font-bold text-[var(--color-ink)] px-1">
            <span className="hl-id text-[var(--color-ink-2)] text-[10px] truncate max-w-[160px]">{rawFilename}</span>
            <a href={src} download={rawFilename} target="_blank" rel="noreferrer" className="hover:underline">
              Download ⬇️
            </a>
          </div>
        </div>
      );
    }
    if (media.mimetype?.startsWith("video/") || ["mp4", "mov", "webm", "3gp", "mkv"].includes(fileExt)) {
      return (
        <div className="space-y-1.5">
          <video src={src} controls className="max-w-[290px] max-h-[340px] rounded-xl shadow-md border border-[var(--color-rule)]" />
          <div className="hl-section-label flex items-center justify-between text-[11px] font-bold text-[var(--color-ink)] px-1">
            <span className="hl-id text-[var(--color-ink-2)] text-[10px] truncate max-w-[180px]">{rawFilename}</span>
            <a href={src} download={rawFilename} target="_blank" rel="noreferrer" className="hover:underline">
              Download ⬇️
            </a>
          </div>
        </div>
      );
    }
    if (media.mimetype?.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif"].includes(fileExt)) {
      const handleView = () => (onPreview ? onPreview(src, rawFilename) : window.open(src, "_blank"));
      return (
        <div className="space-y-1.5">
          <img
            src={src}
            alt={rawFilename}
            className="max-w-[320px] max-h-[360px] object-cover rounded-xl shadow-md cursor-pointer hover:opacity-95 transition border border-[var(--color-rule)]"
            onClick={handleView}
          />
          <div className="hl-section-label flex items-center justify-between text-xs font-bold text-[var(--color-ink)] pt-1 px-1">
            <button onClick={handleView} className="hover:underline flex items-center gap-1">
              🔍 Preview
            </button>
            <a href={src} download={rawFilename} target="_blank" rel="noreferrer" className="hover:underline flex items-center gap-1">
              Download ⬇️
            </a>
          </div>
        </div>
      );
    }
  }

  // Document attachment card (PDF, Excel .xlsx/.csv, Word doc, PowerPoint, Zip, etc.)
  return (
    <div className={`hl-card rounded-xl p-3 space-y-2.5 min-w-[240px] max-w-[330px] ${isMe ? "bg-[var(--color-accent-soft)] text-[var(--color-ink)]" : "bg-[var(--color-paper-2)] text-[var(--color-ink)]"}`}>
      <div className="flex items-center gap-3">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-xs uppercase shrink-0 border ${getBadgeStyle(fileExt)}`}>
          {fileExt.slice(0, 4)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-[var(--color-paper-2)] truncate" title={rawFilename}>{rawFilename}</p>
          <p className="hl-id text-[10px] text-[var(--color-ink-2)] mt-0.5 uppercase">{fileExt} Attachment</p>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-[var(--color-rule)] pt-2 text-xs font-bold text-[var(--color-ink)]">
        {src ? (
          <>
            <button onClick={() => window.open(src, "_blank")} className="hover:underline flex items-center gap-1">
              Open ↗
            </button>
            <a href={src} download={rawFilename} target="_blank" rel="noreferrer" className="hover:underline flex items-center gap-1">
              Download ⬇️
            </a>
          </>
        ) : error ? (
          <button onClick={load} className="text-[var(--color-ink)] hover:underline flex items-center gap-1">
            ⚠️ Retry Loading
          </button>
        ) : (
          <>
            <button onClick={load} disabled={loading} className="hover:underline flex items-center gap-1">
              {loading ? "Loading..." : "Open ↗"}
            </button>
            <button onClick={load} disabled={loading} className="hover:underline flex items-center gap-1">
              {loading ? "Loading..." : "Download ⬇️"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// Synthesize a pleasant, crystal-clear WhatsApp notification chime using Web Audio API
const playNotificationSound = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (_) {}
};

const formatPhoneNumber = (phone) => {
  if (!phone) return "";
  const digits = String(phone).replace(/\D/g, "");
  if (!digits) return phone;
  // 14+ digits not starting with 120363 is an internal WhatsApp LID, not a real phone number
  if (digits.length >= 14 && !digits.startsWith("120363")) return "";
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (digits.length > 10) {
    return `+${digits.slice(0, digits.length - 10)} ${digits.slice(-10, -5)} ${digits.slice(-5)}`;
  }
  return `+${digits}`;
};

export default function WhatsAppPage() {
  const [initialChecking, setInitialChecking] = useState(true);
  const [status, setStatus] = useState({ connected: false, initializing: true, hasQr: false });
  const [qrCode, setQrCode] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const hasLoadedChatsOnce = useRef(false);
  const hasTriggeredQrFetch = useRef(false);
  const [chats, setChats] = useState(() => {
    try {
      const saved = sessionStorage.getItem("wa_cached_chats");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [selectedChat, setSelectedChat] = useState(null);
  // Bot pause state for the open chat. The bot mutes itself for 24h whenever an
  // agent replies by hand, so the operator needs to see that and be able to
  // hand the conversation back.
  const [botStatus, setBotStatus] = useState(null);
  const [botResuming, setBotResuming] = useState(false);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [chatsLoading, setChatsLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatPhone, setNewChatPhone] = useState("");
  const [newChatName, setNewChatName] = useState("");
  const [newChatMessage, setNewChatMessage] = useState("");
  const [newChatLoading, setNewChatLoading] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [mediaSending, setMediaSending] = useState(false);
  const [locationSending, setLocationSending] = useState(false);
  const [accountDetails, setAccountDetails] = useState(null);
  const [syncing, setSyncing] = useState(false);

  // Performance & On-Demand Balance States
  const [msgLimit, setMsgLimit] = useState(10);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showAccountBalanceModal, setShowAccountBalanceModal] = useState(false);
  const [accountBalance, setAccountBalance] = useState(null);
  const [accountBalanceLoading, setAccountBalanceLoading] = useState(false);

  // Lightbox Modal, Contact Info Drawer, Sidebar Filters
  const [sidebarTab, setSidebarTab] = useState("all"); // 'all', 'unread', 'favourites', 'groups', 'bot'
  const [sidebarMode, setSidebarMode] = useState(() => {
    try {
      return localStorage.getItem("wa_sidebar_mode") || "normal"; // "normal", "compact", "wide"
    } catch {
      return "normal";
    }
  });

  const toggleSidebarMode = useCallback(() => {
    setSidebarMode((prev) => {
      const next = prev === "normal" ? "compact" : prev === "compact" ? "wide" : "normal";
      try { localStorage.setItem("wa_sidebar_mode", next); } catch (_) {}
      return next;
    });
  }, []);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [lightboxZoom, setLightboxZoom] = useState(1);
  const [lightboxRotation, setLightboxRotation] = useState(0);
  const openLightbox = useCallback((img) => {
    setLightboxZoom(1);
    setLightboxRotation(0);
    setLightboxImage(img);
  }, []);
  const [showContactInfoDrawer, setShowContactInfoDrawer] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Quick Tools & Actions state
  const navigate = useNavigate();
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [flows, setFlows] = useState([]);
  const [flowsLoading, setFlowsLoading] = useState(false);
  const [showFlowModal, setShowFlowModal] = useState(false);
  const [selectedFlowId, setSelectedFlowId] = useState("");
  const [triggeringFlow, setTriggeringFlow] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [optionsMenuTitle, setOptionsMenuTitle] = useState("Welcome to Madhura Tech! Please choose an option below:");
  const [optionsMenuBotFlowId, setOptionsMenuBotFlowId] = useState("");
  const [optionsMenuItems, setOptionsMenuItems] = useState([
    { type: "reply", text: "English" },
    { type: "reply", text: "मराठी" },
    { type: "reply", text: "हिन्दी" },
    { type: "call", text: "Call Now", phone: "+91 98765 43210" },
    { type: "url", text: "Apply Now", url: "https://suran.edu/apply" },
  ]);

  // Quote reply, Quick replies, CRM sidebar details
  const [replyingTo, setReplyingTo] = useState(null);
  const [quickReplies, setQuickReplies] = useState([]);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [crmDetails, setCrmDetails] = useState(null);
  const [crmDetailsLoading, setCrmDetailsLoading] = useState(false);
  const [aiPaused, setAiPaused] = useState(false);

  // Team Inbox, Notes & Ticket Status
  const [teamMembers, setTeamMembers] = useState([]);
  const [ticketStatus, setTicketStatus] = useState("open");
  const [assignedAgentName, setAssignedAgentName] = useState("");
  const [showNotesDrawer, setShowNotesDrawer] = useState(false);
  const [internalNotes, setInternalNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);

  // WhatsApp Native Payments State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDesc, setPaymentDesc] = useState("Service & Solution Payment");
  const [creatingPayment, setCreatingPayment] = useState(false);

  // Drip Campaigns State
  const [showDripModal, setShowDripModal] = useState(false);
  const [dripSequences, setDripSequences] = useState([]);
  const [dripLoading, setDripLoading] = useState(false);
  const [selectedDripId, setSelectedDripId] = useState("");
  const [enrollingDrip, setEnrollingDrip] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Interactive Reminders state
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderType, setReminderType] = useState("appointment_reminder");
  const [reminderTitle, setReminderTitle] = useState("Service Appointment Confirmation");
  const [reminderText, setReminderText] = useState("Hello {name}! This is a reminder regarding your scheduled service with Madhura Tech tomorrow. Please confirm your availability:");
  const [reminderOptions, setReminderOptions] = useState([
    { id: "btn_confirm", label: "✅ Confirm Visit", action: "confirm_appointment" },
    { id: "btn_reschedule", label: "🔄 Reschedule", action: "reschedule_appointment" },
    { id: "btn_cancel", label: "📞 Call Support", action: "request_callback" },
  ]);
  const [reminderFlowId, setReminderFlowId] = useState("");
  const [sendingReminder, setSendingReminder] = useState(false);

  // Campaign Groups enrollment state
  const [showAddToGroupModal, setShowAddToGroupModal] = useState(false);
  const [campaignGroups, setCampaignGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [selectedGroupIds, setSelectedGroupIds] = useState([]);
  const [addingToGroup, setAddingToGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);

  // Automations triggering state
  const [showAutomationModal, setShowAutomationModal] = useState(false);
  const [automations, setAutomations] = useState([]);
  const [automationsLoading, setAutomationsLoading] = useState(false);
  const [selectedAutomationId, setSelectedAutomationId] = useState("");
  const [runningAutomation, setRunningAutomation] = useState(false);

  // Add as CRM Client state
  const [showAddClientForm, setShowAddClientForm] = useState(false);
  const [addClientData, setAddClientData] = useState({ name: "", company_name: "", email: "", city: "", service: "", notes: "" });
  const [addClientLoading, setAddClientLoading] = useState(false);
  const [addClientResult, setAddClientResult] = useState(null); // { success, message, isExisting, client }

  // Voice note recording
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const recorderRef = useRef(null);
  const recordTimerRef = useRef(null);
  const recordCancelRef = useRef(false);

  // "Jump to latest" affordance & WhatsApp Parallax Scroll Engine
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [unreadWhileScrolled, setUnreadWhileScrolled] = useState(0);
  const threadRef = useRef(null);
  const wallpaperRef = useRef(null);
  const parallaxRaf = useRef(null);

  // ── New UX Enhancement States ─────────────────────────────────────────────
  // Typing indicator state
  const [contactTyping, setContactTyping] = useState(false);
  const typingTimeoutRef = useRef(null);

  // Context menu
  const [contextMenu, setContextMenu] = useState(null); // { x, y, message }

  // Active bot flow status
  const [activeFlowRun, setActiveFlowRun] = useState(null); // { flowName, currentNode, flowId }

  // Sound & notification toggle
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try { return localStorage.getItem("wa_sound_enabled") !== "false"; } catch { return true; }
  });
  const [desktopNotifs, setDesktopNotifs] = useState(() => {
    try { return localStorage.getItem("wa_desktop_notifs") === "true"; } catch { return false; }
  });

  // Online contacts set
  const [onlineContacts, setOnlineContacts] = useState(new Set());

  // Emoji search
  const [emojiSearch, setEmojiSearch] = useState("");
  const [recentEmojis, setRecentEmojis] = useState(() => {
    try { return JSON.parse(localStorage.getItem("wa_recent_emojis") || "[]"); } catch { return []; }
  });

  // Starred messages
  const [starredMsgIds, setStarredMsgIds] = useState(new Set());

  // Mobile swipe
  const touchStartRef = useRef(null);
  const textareaRef = useRef(null);

  const messagesEndRef = useRef(null);
  const pollRef = useRef(null);

  const messagesCacheRef = useRef({});

  const selectedChatRef = useRef(selectedChat);
  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  const chatsRef = useRef(chats);
  useEffect(() => {
    chatsRef.current = chats;
    if (Array.isArray(chats) && chats.length > 0) {
      try {
        sessionStorage.setItem("wa_cached_chats", JSON.stringify(chats));
      } catch (_) {}
    } else if (Array.isArray(chats) && chats.length === 0) {
      try {
        sessionStorage.removeItem("wa_cached_chats");
      } catch (_) {}
    }
  }, [chats]);

  useEffect(() => {
    try {
      if (status && status.connected) {
        sessionStorage.setItem("wa_cached_status", JSON.stringify(status));
      } else {
        sessionStorage.removeItem("wa_cached_status");
      }
    } catch (_) {}
  }, [status]);

  // Clean, deterministic scroll to bottom targeting threadRef directly without window jitter
  const scrollToBottom = useCallback((smooth = true) => {
    if (!threadRef.current) return;
    try {
      threadRef.current.scrollTo({
        top: threadRef.current.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
    } catch {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, []);

  // WhatsApp Doodle Wallpaper Parallax Scroll Handler:
  // Decoupled via requestAnimationFrame to guarantee silky 60fps/120fps hardware acceleration
  const handleThreadScroll = useCallback((e) => {
    const el = e.currentTarget;
    const isAway = el.scrollHeight - el.scrollTop - el.clientHeight > 180;
    setIsScrolledUp(isAway);
    if (!isAway) {
      setUnreadWhileScrolled(0);
    }

    if (!parallaxRaf.current) {
      parallaxRaf.current = requestAnimationFrame(() => {
        if (wallpaperRef.current) {
          const parallaxOffset = (el.scrollTop * 0.18) % 260;
          wallpaperRef.current.style.transform = `translate3d(0, -${parallaxOffset}px, 0)`;
        }
        parallaxRaf.current = null;
      });
    }
  }, []);

  useEffect(() => {
    return () => {
      if (parallaxRaf.current) {
        cancelAnimationFrame(parallaxRaf.current);
      }
    };
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      let res;
      try {
        res = await axios.get(`${API}/api/whatsapp/unified-status`, { headers, timeout: 10000 });
      } catch (e1) {
        try {
          res = await axios.get(`/api/whatsapp/unified-status`, { headers, timeout: 10000 });
        } catch (e2) {
          res = await axios.get(`${API}/api/whatsapp/status`, { headers, timeout: 10000 });
        }
      }
      const raw = res.data;
      const isCloud = Boolean(raw.cloud?.configured || raw.isCloud);
      const isWeb = Boolean(raw.web?.connected || raw.isWeb);
      const isConnected = Boolean(raw.connected || isCloud || isWeb);
      const activePhone = raw.phone || raw.web?.phone || raw.cloud?.display_phone_number || raw.cloud?.phoneNumberId || null;
      const serverQr = raw.qr || raw.web?.qr || null;

      const flat = {
        connected: isConnected,
        isCloud,
        isWeb,
        phone: activePhone,
        activeEngine: raw.activeEngine || (isCloud && isWeb ? "Dual (Cloud API + Web)" : isCloud ? "Meta Cloud API" : isWeb ? "WhatsApp Web" : "Disconnected"),
        initializing: raw.web?.initializing || false,
        hasQr: Boolean(raw.web?.hasQr || serverQr),
        cloud: raw.cloud || null,
        web: raw.web || null,
      };

      setStatus((prev) => {
        if (
          prev &&
          prev.connected === isConnected &&
          prev.phone === activePhone &&
          prev.isCloud === isCloud &&
          prev.isWeb === isWeb &&
          prev.hasQr === Boolean(raw.web?.hasQr || serverQr) &&
          prev.activeEngine === flat.activeEngine
        ) {
          return prev;
        }
        return flat;
      });

      if (flat.connected) {
        setQrCode((prev) => (prev ? null : prev));
        setQrDataUrl((prev) => (prev ? null : prev));
        setQrLoading(false);
      } else if (serverQr) {
        setQrCode((prev) => (prev === serverQr ? prev : serverQr));
        if (raw.qrDataUrl || raw.web?.qrDataUrl) {
          const dUrl = raw.qrDataUrl || raw.web?.qrDataUrl;
          setQrDataUrl((prev) => (prev === dUrl ? prev : dUrl));
        }
        setQrLoading(false);
        setError(null);
      }
      setInitialChecking(false);
      return flat;
    } catch {
      setInitialChecking(false);
      return null;
    }
  }, []);

  const fetchQr = useCallback(async (force = false) => {
    setQrLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const endpoint = force ? "/api/whatsapp/qr?refresh=true" : "/api/whatsapp/qr";
      let res;
      try {
        res = await axios.get(`${API}${endpoint}`, { headers, timeout: 20000 });
      } catch (e1) {
        res = await axios.get(endpoint, { headers, timeout: 20000 });
      }
      if (res.data && res.data.qr) {
        setQrCode(res.data.qr);
        if (res.data.qrDataUrl) setQrDataUrl(res.data.qrDataUrl);
        setStatus((s) => ({ ...s, hasQr: true }));
        setQrLoading(false);
      } else if (res.data && res.data.initializing) {
        // Still initializing in background — keep spinner, websocket and status polling will pick it up
        setQrLoading(true);
      } else if (res.data && res.data.error) {
        setError(res.data.error);
        setQrLoading(false);
      } else {
        // Connected or completed without QR
        setQrDataUrl(null);
        fetchStatus();
        setQrLoading(false);
      }
    } catch (err) {
      if (err.response?.status === 504 || err.code === "ECONNABORTED") {
        console.warn("ℹ️ WhatsApp QR generation in progress in background...");
        // Keep loading state alive for WebSocket wa_qr or status polling
        setQrLoading(true);
      } else {
        const msg = err.response?.data?.error || err.message || "Failed to generate QR code. Please click Fresh QR / Reset.";
        setError(msg);
        setQrLoading(false);
      }
    }
  }, [fetchStatus]);

  const fetchChats = useCallback(async (refresh = false) => {
    if (!hasLoadedChatsOnce.current && (!chatsRef.current || chatsRef.current.length === 0)) {
      setChatsLoading(true);
    }
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const endpoint = refresh ? `/api/whatsapp/chats?refresh=true` : `/api/whatsapp/chats`;
      let res;
      try {
        res = await axios.get(`${API}${endpoint}`, { headers });
      } catch (e1) {
        res = await axios.get(endpoint, { headers });
      }
      if (res.data && Array.isArray(res.data)) {
        hasLoadedChatsOnce.current = true;
        setChats((prev) => {
          if (prev && prev.length === res.data.length) {
            const hasChanged = res.data.some((c, i) => !prev[i] || prev[i].id !== c.id || prev[i].timestamp !== c.timestamp || prev[i].unreadCount !== c.unreadCount || prev[i].lastMessage?.body !== c.lastMessage?.body);
            if (!hasChanged) return prev;
          }
          return res.data;
        });
      }
    } catch { }
    setChatsLoading(false);
  }, []);

  const fetchAccountDetails = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const { data } = await axios.get(`${API}/api/whatsapp/account`, { headers });
      setAccountDetails(data);
    } catch (_) { }
  }, []);

  const handleSyncWhatsApp = async () => {
    setSyncing(true);
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.post(`${API}/api/whatsapp/sync-contacts`, {}, { headers }).catch(() => { });
      await axios.post(`${API}/api/whatsapp/sync-chats`, {}, { headers }).catch(() => { });
      await fetchChats(true);
      await fetchAccountDetails();
    } catch (_) { }
    setSyncing(false);
  };

  const fetchMessages = useCallback(async (chatId, limit = 10) => {
    const hasCached = Boolean(messagesCacheRef.current[chatId] && messagesCacheRef.current[chatId].length > 0);
    if (!hasCached) {
      if (limit === 10) setMessagesLoading(true);
      else setLoadingMore(true);
    }
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API}/api/whatsapp/chat/${encodeURIComponent(chatId)}/messages?limit=${limit}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = res.data || [];
      messagesCacheRef.current[chatId] = data;
      setMessages(data);
      if (limit === 10) scrollToBottom(false);
    } catch { }
    setMessagesLoading(false);
    setLoadingMore(false);
  }, [scrollToBottom]);

  const handleLoadMoreMessages = async () => {
    if (!selectedChat || loadingMore) return;
    const prevScrollHeight = threadRef.current?.scrollHeight || 0;
    const prevScrollTop = threadRef.current?.scrollTop || 0;
    const nextLimit = msgLimit + 40;
    setMsgLimit(nextLimit);
    await fetchMessages(selectedChat.id, nextLimit);
    requestAnimationFrame(() => {
      if (threadRef.current) {
        const newScrollHeight = threadRef.current.scrollHeight;
        threadRef.current.scrollTop = newScrollHeight - prevScrollHeight + prevScrollTop;
      }
    });
  };

  const fetchAccountBalance = async () => {
    setAccountBalanceLoading(true);
    setShowAccountBalanceModal(true);
    setAccountBalance(null);
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.get(`${API}/api/whatsapp/account-balance`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAccountBalance(data);
    } catch (_) {
      setAccountBalance({ error: "Failed to fetch WhatsApp account stats" });
    }
    setAccountBalanceLoading(false);
  };

  const fetchTemplates = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.get(`${API}/api/wa/templates`, { headers: { Authorization: `Bearer ${token}` } });
      setTemplates(data || []);
    } catch { }
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const [showCreateTemplateModal, setShowCreateTemplateModal] = useState(false);
  const [newTmplName, setNewTmplName] = useState("");
  const [newTmplCategory, setNewTmplCategory] = useState("MARKETING");
  const [newTmplBody, setNewTmplBody] = useState("");
  const [tmplLoading, setTmplLoading] = useState(false);

  const handleSeedTemplates = async () => {
    setTmplLoading(true);
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.post(`${API}/api/wa/templates/seed`, {}, { headers: { Authorization: `Bearer ${token}` } });
      if (data.templates) setTemplates(data.templates);
      else fetchTemplates();
    } catch (e) {
      alert("Failed to seed default templates: " + (e.response?.data?.error || e.message));
    }
    setTmplLoading(false);
  };

  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    if (!newTmplName.trim() || !newTmplBody.trim()) return;
    setTmplLoading(true);
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.post(
        `${API}/api/wa/templates`,
        { name: newTmplName.trim(), category: newTmplCategory, body: newTmplBody.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTemplates((prev) => [data, ...prev]);
      insertTemplate(data);
      setShowCreateTemplateModal(false);
      setNewTmplName("");
      setNewTmplBody("");
    } catch (e) {
      alert("Failed to create template: " + (e.response?.data?.error || e.message));
    }
    setTmplLoading(false);
  };

  const insertTemplate = (tmpl) => {
    const name = selectedChat?.name && !selectedChat.name.startsWith("+") ? selectedChat.name : "";
    const phone = selectedChat?.phone || selectedChat?.id?.replace(/@.*$/, "") || "";
    const filled = evaluateMessagePlaceholders(tmpl.body || "", {
      name: name || "there",
      first_name: name ? name.split(" ")[0] : "there",
      phone: phone,
    });
    setMessageInput(filled);
    setShowTemplatePicker(false);
  };

  const handleSelectChat = (chat) => {
    setSelectedChat(chat);
    setChats((prev) => prev.map((c) => (c.id === chat.id ? { ...c, unreadCount: 0 } : c)));
    setShowMobileChat(true);
    setMsgLimit(10);
    setUnreadWhileScrolled(0);
    setShowAddClientForm(false);
    setAddClientResult(null);
    setAddClientData({ name: "", company_name: "", email: "", city: "", service: "", notes: "" });

    // Instant message display from cache in 0ms!
    if (messagesCacheRef.current[chat.id]) {
      setMessages(messagesCacheRef.current[chat.id]);
      setTimeout(() => scrollToBottom(false), 20);
    }

    // Mark as read on WhatsApp server & DB
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      axios.post(`${API}/api/whatsapp/chat/${encodeURIComponent(chat.id)}/read`, {}, { headers }).catch(() => {});
    } catch (_) {}

    fetchMessages(chat.id, 10);
  };

  const handleSend = async () => {
    if (!messageInput.trim() || !selectedChat) return;
    const textToSend = messageInput.trim();
    setMessageInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setError(null);

    // Instant Optimistic UI update: push message immediately to chat thread
    const tempId = "temp_" + Date.now();
    const tempMsg = {
      id: tempId,
      from: "me",
      body: textToSend,
      timestamp: Math.floor(Date.now() / 1000),
      isMe: true,
      status: "sending",
    };
    setMessages((prev) => [tempMsg, ...prev]);
    setTimeout(scrollToBottom, 50);

    // Immediately update sidebar chat position and preview
    setChats((prev) => {
      const idx = prev.findIndex((c) => c.id === selectedChat.id);
      if (idx !== -1) {
        const current = prev[idx];
        const updated = {
          ...current,
          hasMessages: true,
          lastMessage: { body: textToSend, timestamp: Math.floor(Date.now() / 1000), fromMe: true },
          timestamp: Math.floor(Date.now() / 1000),
          unreadCount: 0,
        };
        return [updated, ...prev.slice(0, idx), ...prev.slice(idx + 1)];
      }
      return prev;
    });

    const quotedId = replyingTo?.id || null;
    const quotedText = replyingTo?.body || null;
    setReplyingTo(null);

    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      let res;
      try {
        res = await axios.post(`${API}/api/whatsapp/send`, {
          chatId: selectedChat.id,
          message: textToSend,
          quotedMessageId: quotedId,
          replyToMessageId: quotedId,
        }, { headers });
      } catch (e1) {
        res = await axios.post(`/api/whatsapp/send`, {
          chatId: selectedChat.id,
          message: textToSend,
          quotedMessageId: quotedId,
          replyToMessageId: quotedId,
        }, { headers });
      }

      // Mark message as delivered/sent in thread
      const realId = res.data?.id || res.data?.result?.id || tempId;
      setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, id: realId, status: "sent", quotedMsg: quotedText ? { body: quotedText } : null } : m));

      // Replying by hand pauses the bot server-side — surface that immediately.
      fetchBotStatus(selectedChat.id);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || "Failed to send message";
      setError(`Failed to send message: ${msg}`);
      setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, status: "failed" } : m));
    }
  };

  const handleReact = async (messageId, emoji) => {
    if (!selectedChat || !messageId) return;
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(`${API}/api/whatsapp/react`, {
        chatId: selectedChat.id,
        messageId,
        emoji,
      }, { headers });

      // Optimistically update reactions on message
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === messageId) {
            const existingReactions = Array.isArray(m.reactions) ? [...m.reactions] : [];
            const foundIdx = existingReactions.findIndex((r) => r.isMe || r.emoji === emoji);
            if (foundIdx >= 0) {
              existingReactions[foundIdx] = { emoji, isMe: true };
            } else {
              existingReactions.push({ emoji, isMe: true });
            }
            return { ...m, reactions: existingReactions };
          }
          return m;
        })
      );
    } catch (err) {
      console.warn("Reaction failed:", err.message);
    }
  };

  const fetchContactCrmDetails = async (phone) => {
    if (!phone) return;
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    setCrmDetailsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API}/api/whatsapp/contact-crm-details/${cleanPhone}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCrmDetails(res.data);
    } catch (err) {
      console.warn("Failed to fetch CRM details:", err.message);
      setCrmDetails(null);
    }
    setCrmDetailsLoading(false);
  };

  const fetchQuickReplies = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API}/api/whatsapp/quick-replies`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setQuickReplies(res.data || []);
    } catch (_) { }
  };

  const extractMessageButtons = (msg) => {
    if (!msg) return [];
    const buttons = [];

    const normalizeBtn = (b) => {
      if (!b) return null;
      if (typeof b === "string") {
        const s = b.trim();
        if (!s) return null;
        if (s.startsWith("📞") || s.toLowerCase().startsWith("call")) {
          const ph = (s.match(/\+?\d[\d\s-]{8,15}/) || [])[0] || "";
          return { type: "call", title: s.replace(/^📞\s*/, "").replace(/:\s*\+?\d[\d\s-]{8,15}/, "").trim() || "Call Now", phone: ph };
        }
        if (s.startsWith("↗") || s.startsWith("🔗") || s.includes("http")) {
          const u = (s.match(/https?:\/\/[^\s)]+/) || [])[0] || "";
          return { type: "url", title: s.replace(/^[↗🔗]\s*/, "").replace(/:\s*https?:\/\/[^\s)]+/, "").trim() || "Apply Now", url: u };
        }
        const cleanTitle = s.replace(/^[↩🔘•\d.)\s\u20E3]+/u, "").trim();
        return { type: "reply", title: cleanTitle || s, id: cleanTitle || s };
      }
      const title = b.title || b.text || b.displayText || b.id || "";
      const type = b.type || (b.url ? "url" : b.phone ? "call" : "reply");
      return {
        type,
        title: String(title).trim(),
        id: b.id || title,
        url: b.url || (type === "url" ? b.id : undefined),
        phone: b.phone || (type === "call" ? b.id : undefined),
      };
    };

    // 1. Direct buttons array (from bot flows or API)
    if (Array.isArray(msg.buttons) && msg.buttons.length > 0) {
      msg.buttons.forEach((b) => {
        const norm = normalizeBtn(b);
        if (norm && norm.title) buttons.push(norm);
      });
    }

    // 2. Direct rows array (interactive lists)
    if (buttons.length === 0 && Array.isArray(msg.rows) && msg.rows.length > 0) {
      msg.rows.forEach((r) => {
        const norm = normalizeBtn(r);
        if (norm && norm.title) buttons.push(norm);
      });
    }

    // 3. Interactive payload (official Meta / WhatsApp Cloud / Flow Engine)
    if (buttons.length === 0) {
      const interactive = msg.interactive || (typeof msg.interactive_payload === "string" ? (() => { try { return JSON.parse(msg.interactive_payload); } catch { return null; } })() : msg.interactive_payload);
      if (interactive) {
        if (Array.isArray(interactive.buttons)) {
          interactive.buttons.forEach((b) => {
            const btnData = b.reply || b.button || b;
            const norm = normalizeBtn(btnData);
            if (norm && norm.title) buttons.push(norm);
          });
        }
        if (Array.isArray(interactive.action?.buttons)) {
          interactive.action.buttons.forEach((b) => {
            const btnData = b.reply || b.button || b;
            const norm = normalizeBtn(btnData);
            if (norm && norm.title) buttons.push(norm);
          });
        }
        if (Array.isArray(interactive.rows)) {
          interactive.rows.forEach((r) => {
            const norm = normalizeBtn(r);
            if (norm && norm.title) buttons.push(norm);
          });
        }
        if (Array.isArray(interactive.action?.sections)) {
          interactive.action.sections.forEach((sec) => {
            if (Array.isArray(sec.rows)) {
              sec.rows.forEach((r) => {
                const norm = normalizeBtn(r);
                if (norm && norm.title) buttons.push(norm);
              });
            }
          });
        }
      }
    }

    // 4. Parse from message body text (flow menus, numbered choices, call/apply links)
    if (buttons.length === 0) {
      const body = msg.body || "";
      if (body.includes("\n")) {
        const lines = body.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          // Call button: "📞 Call Now" or "📞 Call: +91..."
          if (trimmed.startsWith("📞") || trimmed.toLowerCase().startsWith("call now") || trimmed.toLowerCase().startsWith("call:")) {
            const ph = (trimmed.match(/\+?\d[\d\s-]{8,15}/) || [])[0] || "";
            const t = trimmed.replace(/^📞\s*/, "").replace(/:\s*\+?\d[\d\s-]{8,15}/, "").trim();
            buttons.push({ type: "call", title: t || "Call Now", phone: ph });
            continue;
          }

          // URL button: "↗ Apply Now" or "↗ Link: https://..."
          if (trimmed.startsWith("↗") || trimmed.startsWith("🔗") || trimmed.toLowerCase().startsWith("apply now") || trimmed.toLowerCase().startsWith("apply:")) {
            const u = (trimmed.match(/https?:\/\/[^\s)]+/) || [])[0] || "";
            const t = trimmed.replace(/^[↗🔗]\s*/, "").replace(/:\s*https?:\/\/[^\s)]+/, "").trim();
            buttons.push({ type: "url", title: t || "Apply Now", url: u });
            continue;
          }

          // Reply button: "↩ English" or "1️⃣ English" or "1. English" or "• English"
          if (trimmed.startsWith("↩")) {
            const t = trimmed.replace(/^↩\s*/, "").trim();
            if (t) buttons.push({ type: "reply", title: t, id: t });
            continue;
          }

          const match = trimmed.match(/^(?:\*|•|-)?\s*(?:\d+[\s.)-]+|[\u0030-\u0039]\uFE0F?\u20E3)\s*\*?(.*?)\*?$/);
          if (match && match[1]) {
            const clean = match[1].trim().replace(/\*+/g, "");
            if (clean.length >= 2 && !clean.toLowerCase().startsWith("reply with") && !clean.toLowerCase().startsWith("or reply") && !clean.toLowerCase().startsWith("reply 0")) {
              buttons.push({ type: "reply", title: clean, id: clean });
            }
          }
        }
      }
    }

    return buttons;
  };

  const getMessageDisplayBody = (msg, buttons) => {
    let body = msg.body || "";
    if (!buttons || buttons.length === 0 || !body.includes("\n")) return body;
    const lines = body.split("\n");
    let lastContentIdx = lines.length - 1;

    while (lastContentIdx >= 0) {
      const line = lines[lastContentIdx].trim();
      if (!line) {
        lastContentIdx--;
        continue;
      }
      const isBtnLine =
        line.startsWith("↩") ||
        line.startsWith("📞") ||
        line.startsWith("↗") ||
        line.toLowerCase().startsWith("call now") ||
        line.toLowerCase().startsWith("apply now") ||
        line.toLowerCase().startsWith("reply with a number") ||
        line.toLowerCase().startsWith("reply with") ||
        line.toLowerCase().startsWith("choose an option") ||
        buttons.some((b) => {
          const t = (b.title || b.text || "").toLowerCase();
          return t && line.toLowerCase().includes(t);
        });

      if (isBtnLine) {
        lastContentIdx--;
      } else {
        break;
      }
    }

    const cleaned = lines.slice(0, lastContentIdx + 1).join("\n").trim();
    return cleaned || body;
  };

  const extractQuickReplies = extractMessageButtons;

  const handleSendDirect = async (textToSend) => {
    if (!textToSend || !selectedChat) return;
    const cleanText = String(textToSend).trim();
    if (!cleanText) return;

    setError(null);
    const tempId = "temp_" + Date.now();
    const tempMsg = {
      id: tempId,
      from: "me",
      body: cleanText,
      timestamp: Math.floor(Date.now() / 1000),
      isMe: true,
      status: "sending",
    };
    setMessages((prev) => [tempMsg, ...prev]);
    setTimeout(scrollToBottom, 50);

    setChats((prev) => {
      const idx = prev.findIndex((c) => c.id === selectedChat.id);
      if (idx !== -1) {
        const current = prev[idx];
        const updated = {
          ...current,
          hasMessages: true,
          lastMessage: { body: cleanText, timestamp: Math.floor(Date.now() / 1000), fromMe: true },
          timestamp: Math.floor(Date.now() / 1000),
          unreadCount: 0,
        };
        return [updated, ...prev.slice(0, idx), ...prev.slice(idx + 1)];
      }
      return prev;
    });

    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      let res;
      try {
        res = await axios.post(`${API}/api/whatsapp/send`, {
          chatId: selectedChat.id,
          message: cleanText,
        }, { headers });
      } catch (e1) {
        res = await axios.post(`/api/whatsapp/send`, {
          chatId: selectedChat.id,
          message: cleanText,
        }, { headers });
      }

      const realId = res.data?.id || res.data?.result?.id || tempId;
      setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, id: realId, status: "sent" } : m));
    } catch (err) {
      console.warn("handleSendDirect error:", err.message);
    }
  };

  const handleTriggerFlowForChat = async (flowId) => {
    if (!selectedChat || !flowId) return;
    const rawTarget = selectedChat.phoneNumber || selectedChat.phone || selectedChat.id?.replace(/@.*$/, "") || "";
    let cleanPhone = rawTarget.replace(/\D/g, "");
    if (cleanPhone.length === 10) cleanPhone = "91" + cleanPhone;
    setTriggeringFlow(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(`${API}/api/wa/flows/${flowId}/trigger-phone`, {
        phone: cleanPhone || selectedChat.id,
        chatId: selectedChat.id,
      }, { headers: { Authorization: `Bearer ${token}` } });
      const selFlow = flows.find((f) => String(f.id) === String(flowId));
      setActiveFlowRun({
        flowId,
        flowName: selFlow?.name || "Automated Bot Flow",
        currentNode: "Starting...",
        phone: res.data?.phone || cleanPhone,
        chatId: selectedChat.id,
      });
      setShowFlowModal(false);
      await fetchMessages(selectedChat.id, 25);
    } catch (err) {
      alert("Failed to start flow: " + (err.response?.data?.error || err.message));
    }
    setTriggeringFlow(false);
  };

  const fetchFlows = useCallback(async () => {
    try {
      setFlowsLoading(true);
      const token = localStorage.getItem("token");
      const { data } = await axios.get(`${API}/api/wa/flows`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setFlows(Array.isArray(data) ? data : []);
    } catch (e) {
      console.warn("Could not load flows:", e.message);
    } finally {
      setFlowsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuickReplies();
    fetchFlows();
  }, [fetchFlows]);

  // Shared upload+send path for anything file-shaped: attachments from the
  // paperclip menu and recorded voice notes both route through here.
  const sendFileToChat = async (file, customMediaType = "document") => {
    if (!file || !selectedChat) return;
    setMediaSending(true);
    setShowAttachMenu(false);
    setError(null);

    const tempId = "temp_" + Date.now();
    let localBlobUrl = "";
    try {
      localBlobUrl = URL.createObjectURL(file);
    } catch (_) {}

    const optimisticMsg = {
      id: tempId,
      from: "me",
      body: file.name,
      timestamp: Math.floor(Date.now() / 1000),
      isMe: true,
      hasMedia: true,
      mediaUrl: localBlobUrl,
      type: customMediaType || "document",
      filename: file.name,
      status: "sending",
    };
    setMessages((prev) => [optimisticMsg, ...prev]);
    scrollToBottom();

    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const formData = new FormData();
      formData.append("file", file);
      
      let uploaded = null;
      try {
        const resUp = await axios.post(`${API}/api/whatsapp/upload-media`, formData, { headers, timeout: 60000 });
        uploaded = resUp.data;
      } catch (_) {
        try {
          const resFallback = await axios.post(`${API}/api/wa/campaigns/upload-media`, formData, { headers, timeout: 60000 });
          uploaded = resFallback.data;
        } catch (_) {
          const resRel = await axios.post(`/api/whatsapp/upload-media`, formData, { headers, timeout: 60000 });
          uploaded = resRel.data;
        }
      }

      if (!uploaded || !uploaded.url) {
        throw new Error("File upload failed. Please verify network connection or try a smaller file.");
      }

      const mediaType = uploaded.media_type || customMediaType || "document";
      let res;
      try {
        res = await axios.post(`${API}/api/whatsapp/send-media`, {
          chatId: selectedChat.id,
          mediaUrl: uploaded.url,
          mediaType,
          filename: uploaded.filename || file.name,
        }, { headers, timeout: 60000 });
      } catch (e1) {
        res = await axios.post(`/api/whatsapp/send-media`, {
          chatId: selectedChat.id,
          mediaUrl: uploaded.url,
          mediaType,
          filename: uploaded.filename || file.name,
        }, { headers, timeout: 60000 });
      }

      const realId = res.data?.id || tempId;
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, id: realId, mediaUrl: uploaded.url, status: "sent" } : m)));
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message || "Failed to send attachment";
      setError(`Attachment error: ${errMsg}`);
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, status: "failed" } : m)));
    }
    setMediaSending(false);
  };

  const handleAttachMedia = async (e, customMediaType = "document") => {
    const file = e.target.files?.[0];
    e.target.value = "";
    setShowAttachMenu(false);
    await sendFileToChat(file, customMediaType);
  };

  // ── Voice notes ────────────────────────────────────────────────────────────
  // Browsers record webm/opus; WhatsApp's native voice notes are ogg/opus, so
  // this arrives as a playable audio attachment rather than a true PTT bubble.
  // ponytail: transcode server-side to ogg/opus if a real waveform PTT matters.
  const startRecording = async () => {
    if (!selectedChat || recording) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Voice recording is not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = { recorder, stream, chunks };
      recordCancelRef.current = false;

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunks.push(ev.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        clearInterval(recordTimerRef.current);
        setRecording(false);
        setRecordSecs(0);
        if (recordCancelRef.current || !chunks.length) return;

        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        const ext = (recorder.mimeType || "audio/webm").includes("ogg") ? "ogg" : "webm";
        const file = new File([blob], `voice-note-${Date.now()}.${ext}`, { type: blob.type });
        await sendFileToChat(file, "audio");
      };

      recorder.start();
      setRecording(true);
      setRecordSecs(0);
      recordTimerRef.current = setInterval(() => setRecordSecs((s) => s + 1), 1000);
    } catch (err) {
      setError("Microphone access denied or unavailable.");
    }
  };

  const stopRecording = (cancel = false) => {
    recordCancelRef.current = cancel;
    const active = recorderRef.current;
    if (active?.recorder && active.recorder.state !== "inactive") {
      active.recorder.stop();
    } else {
      clearInterval(recordTimerRef.current);
      setRecording(false);
      setRecordSecs(0);
    }
  };

  // Never leave the mic hot if the page unmounts mid-recording
  useEffect(() => {
    return () => {
      clearInterval(recordTimerRef.current);
      const active = recorderRef.current;
      try {
        if (active?.recorder && active.recorder.state !== "inactive") {
          recordCancelRef.current = true;
          active.recorder.stop();
        }
        active?.stream?.getTracks?.().forEach((t) => t.stop());
      } catch (_) {}
    };
  }, []);

  const handleTriggerFlow = async (flowId) => {
    if (!selectedChat || !flowId) return;
    setTriggeringFlow(true);
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      let phone = selectedChat.id.replace(/\D/g, "");
      if (phone.length === 10) phone = "91" + phone;
      const res = await axios.post(`${API}/api/wa/flows/${flowId}/trigger-phone`, { phone }, { headers });
      const selFlow = flows.find((f) => String(f.id) === String(flowId));
      setActiveFlowRun({
        flowId,
        flowName: selFlow?.name || "Automated Bot Flow",
        currentNode: "Active",
        phone,
      });
      setShowFlowModal(false);
      setShowAttachMenu(false);
      await fetchMessages(selectedChat.id);
    } catch (err) {
      alert("Failed to trigger flow: " + (err.response?.data?.error || err.message));
    } finally {
      setTriggeringFlow(false);
    }
  };

  const handleSendInteractiveMenuNow = async () => {
    if (!selectedChat || !optionsMenuTitle) return;

    const validButtons = optionsMenuItems.filter((item) => {
      if (typeof item === "string") return item.trim().length > 0;
      return item && item.text && item.text.trim().length > 0;
    }).map((item) => {
      if (typeof item === "string") return { type: "reply", text: item.trim(), title: item.trim() };
      return {
        type: item.type || "reply",
        text: item.text.trim(),
        title: item.text.trim(),
        phone: item.phone ? item.phone.trim() : undefined,
        url: item.url ? item.url.trim() : undefined,
      };
    });

    const bodyText = optionsMenuTitle.trim();

    // 1. If user selected a Bot Flow to trigger
    if (optionsMenuBotFlowId) {
      await handleTriggerFlowForChat(optionsMenuBotFlowId);
      setShowOptionsModal(false);
      setShowAttachMenu(false);
      return;
    }

    // 2. Build formatted text with buttons
    const formattedSendText = `${bodyText}\n\n${validButtons.map((b) => {
      if (b.type === "call") return `📞 ${b.text}${b.phone ? ` (${b.phone})` : ""}`;
      if (b.type === "url") return `↗ ${b.text}${b.url ? ` (${b.url})` : ""}`;
      return `↩ ${b.text}`;
    }).join("\n")}`;

    // Optimistic UI update
    const tempId = "temp_" + Date.now();
    const tempMsg = {
      id: tempId,
      from: "me",
      body: formattedSendText,
      timestamp: Math.floor(Date.now() / 1000),
      isMe: true,
      status: "sending",
      buttons: validButtons,
      interactive: {
        type: "buttons",
        buttons: validButtons,
      },
    };
    setMessages((prev) => [tempMsg, ...prev]);
    setShowOptionsModal(false);
    setShowAttachMenu(false);
    setTimeout(scrollToBottom, 50);

    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.post(`${API}/api/whatsapp/send`, {
        chatId: selectedChat.id,
        message: formattedSendText,
        buttons: validButtons,
      }, { headers });
      fetchMessages(selectedChat.id, 15);
    } catch (err) {
      console.warn("Failed to send interactive options menu:", err.message);
    }
  };

  const handleInsertOptionsMenuToComposer = () => {
    if (!selectedChat || !optionsMenuTitle) return;
    const validButtons = optionsMenuItems.filter((item) => {
      if (typeof item === "string") return item.trim().length > 0;
      return item && item.text && item.text.trim().length > 0;
    }).map((item) => (typeof item === "string" ? { type: "reply", text: item.trim() } : item));

    const formatted = `${optionsMenuTitle.trim()}\n\n${validButtons.map((b) => {
      if (b.type === "call") return `📞 ${b.text}${b.phone ? ` (${b.phone})` : ""}`;
      if (b.type === "url") return `↗ ${b.text}${b.url ? ` (${b.url})` : ""}`;
      return `↩ ${b.text}`;
    }).join("\n")}`;

    setMessageInput(formatted);
    setShowOptionsModal(false);
    setShowAttachMenu(false);
    textareaRef.current?.focus();
  };

  const handleSendOptionsMenu = handleSendInteractiveMenuNow;

  const fetchTeamMembers = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const { data } = await axios.get(`${API}/api/teammember`, { headers });
      setTeamMembers(Array.isArray(data) ? data : []);
    } catch {
      setTeamMembers([]);
    }
  }, []);

  const handleAssignAgent = async (agentId, agentName) => {
    if (!selectedChat) return;
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(`${API}/api/whatsapp/chat/${selectedChat.id}/assign`, { agentId, agentName }, { headers });
      setAssignedAgentName(agentName);
    } catch (err) {
      alert("Failed to assign agent: " + (err.response?.data?.error || err.message));
    }
  };

  const handleUpdateTicketStatus = async (status) => {
    if (!selectedChat) return;
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(`${API}/api/whatsapp/chat/${selectedChat.id}/ticket-status`, { status }, { headers });
      setTicketStatus(status);
    } catch (err) {
      alert("Failed to update status: " + (err.response?.data?.error || err.message));
    }
  };

  const fetchInternalNotes = async (phone) => {
    if (!phone) return;
    setNotesLoading(true);
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const cleanPhone = phone.replace(/\D/g, "");
      const { data } = await axios.get(`${API}/api/whatsapp/chat/${cleanPhone}/notes`, { headers });
      setInternalNotes(Array.isArray(data) ? data : []);
    } catch {
      setInternalNotes([]);
    } finally {
      setNotesLoading(false);
    }
  };

  const handleCreateInternalNote = async (e) => {
    e?.preventDefault();
    if (!selectedChat || !newNoteText.trim()) return;
    setSubmittingNote(true);
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const cleanPhone = selectedChat.id.replace(/\D/g, "");
      await axios.post(
        `${API}/api/whatsapp/chat/${cleanPhone}/notes`,
        { note: newNoteText, authorName: localStorage.getItem("userName") || "Agent" },
        { headers }
      );
      setNewNoteText("");
      await fetchInternalNotes(cleanPhone);
    } catch (err) {
      alert("Failed to save note: " + (err.response?.data?.error || err.message));
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleCreatePaymentRequest = async (e) => {
    e?.preventDefault();
    if (!selectedChat || !paymentAmount || Number(paymentAmount) <= 0) return;
    setCreatingPayment(true);
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const cleanPhone = selectedChat.id.replace(/\D/g, "");
      await axios.post(
        `${API}/api/wa/payments/create-link`,
        {
          phone: cleanPhone,
          contact_name: selectedChat.name,
          amount: paymentAmount,
          description: paymentDesc,
          send_to_whatsapp: true,
        },
        { headers }
      );
      setShowPaymentModal(false);
      setPaymentAmount("");
      await fetchMessages(selectedChat.id);
    } catch (err) {
      alert("Failed to create payment link: " + (err.response?.data?.error || err.message));
    } finally {
      setCreatingPayment(false);
    }
  };

  const fetchDripSequences = async () => {
    setDripLoading(true);
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const { data } = await axios.get(`${API}/api/wa/drip`, { headers });
      setDripSequences(Array.isArray(data) ? data : []);
    } catch {
      setDripSequences([]);
    } finally {
      setDripLoading(false);
    }
  };

  const handleEnrollDrip = async (sequenceId) => {
    if (!selectedChat || !sequenceId) return;
    setEnrollingDrip(true);
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const cleanPhone = selectedChat.id.replace(/\D/g, "");
      await axios.post(
        `${API}/api/wa/drip/${sequenceId}/enroll`,
        {
          phones: [cleanPhone],
          contact_names: { [cleanPhone]: selectedChat.name },
        },
        { headers }
      );
      setShowDripModal(false);
      alert(`Contact successfully enrolled in automated drip sequence!`);
    } catch (err) {
      alert("Failed to enroll: " + (err.response?.data?.error || err.message));
    } finally {
      setEnrollingDrip(false);
    }
  };

  const REMINDER_PRESETS = {
    appointment_reminder: {
      title: "Service Appointment Confirmation",
      text: "Hello {name}! This is a reminder regarding your scheduled visit with Madhura Tech tomorrow. Please confirm your availability:",
      options: [
        { id: "btn_confirm", label: "✅ Confirm Visit", action: "confirm_appointment" },
        { id: "btn_reschedule", label: "🔄 Reschedule", action: "reschedule_appointment" },
        { id: "btn_cancel", label: "📞 Call Support", action: "request_callback" },
      ]
    },
    payment_due: {
      title: "Payment Due & Invoice Notice",
      text: "Hello {name}! A friendly reminder regarding your pending invoice from Madhura Tech. Total amount due: ₹{amount}. Please choose an option below:",
      options: [
        { id: "btn_paid", label: "💳 Already Paid", action: "confirm_payment" },
        { id: "btn_invoice", label: "📄 Send Invoice", action: "send_invoice_copy" },
        { id: "btn_call_acc", label: "📞 Speak to Accounts", action: "request_callback" },
      ]
    },
    quotation_followup: {
      title: "Quotation & Proposal Follow-up",
      text: "Hello {name}! We wanted to follow up on the commercial quotation {quotation_no} we prepared for you. Would you like to proceed or discuss changes?",
      options: [
        { id: "btn_approve_quote", label: "👍 Approve & Proceed", action: "approve_quotation" },
        { id: "btn_modify_quote", label: "💬 Need Changes", action: "request_callback" },
        { id: "btn_reject_quote", label: "❌ Not Interested", action: "reject_quotation" },
      ]
    },
    amc_renewal: {
      title: "AMC Contract Expiry & Renewal",
      text: "Hello {name}! Your comprehensive AMC service maintenance contract is due for renewal soon. Ensure continuous coverage and prioritized support:",
      options: [
        { id: "btn_renew_amc", label: "🛡️ Renew AMC", action: "renew_amc" },
        { id: "btn_inspect", label: "📋 Schedule Inspection", action: "reschedule_appointment" },
        { id: "btn_call_amc", label: "📞 Speak to Engineer", action: "request_callback" },
      ]
    },
  };

  const handleReminderTypeChange = (type) => {
    setReminderType(type);
    const p = REMINDER_PRESETS[type] || REMINDER_PRESETS.appointment_reminder;
    setReminderTitle(p.title);
    setReminderText(p.text);
    setReminderOptions([...p.options]);
  };

  const handleSendReminderNow = async () => {
    if (!selectedChat) return;
    setSendingReminder(true);
    try {
      const token = localStorage.getItem("token");
      let phone = selectedChat.id.replace(/\D/g, "");
      if (phone.length === 10) phone = "91" + phone;

      await axios.post(
        `${API}/api/wa/reminders/send-now`,
        {
          phone,
          contact_name: selectedChat.name,
          reminder_type: reminderType,
          title: reminderTitle,
          message_text: reminderText,
          options: reminderOptions,
          flow_id: reminderFlowId || null,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setShowReminderModal(false);
      await fetchMessages(selectedChat.id, 15);
      alert(`✅ Interactive reminder sent to ${selectedChat.name}!`);
    } catch (err) {
      alert("Failed to send reminder: " + (err.response?.data?.error || err.message));
    } finally {
      setSendingReminder(false);
    }
  };

  const fetchCampaignGroups = useCallback(async () => {
    try {
      setGroupsLoading(true);
      const token = localStorage.getItem("token");
      const { data } = await axios.get(`${API}/api/wa/groups`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCampaignGroups(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn("Failed to load groups:", err.message);
    } finally {
      setGroupsLoading(false);
    }
  }, []);

  const handleAddToCampaignGroups = async () => {
    if (!selectedChat || selectedGroupIds.length === 0) return;
    setAddingToGroup(true);
    try {
      const token = localStorage.getItem("token");
      let cleanPhone = selectedChat.id.replace(/\D/g, "").slice(-10);
      for (const groupId of selectedGroupIds) {
        await axios.post(
          `${API}/api/wa/groups/${groupId}/contacts`,
          {
            contacts: [{
              name: selectedChat.name,
              phone: cleanPhone,
              country_code: "91",
              notes: `Enrolled from WhatsApp Chat on ${new Date().toLocaleDateString("en-IN")}`
            }]
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      setShowAddToGroupModal(false);
      setSelectedGroupIds([]);
      alert(`👥 ${selectedChat.name} added to ${selectedGroupIds.length} campaign group(s)!`);
    } catch (err) {
      alert("Failed to add to group: " + (err.response?.data?.error || err.message));
    } finally {
      setAddingToGroup(false);
    }
  };

  const handleCreateNewGroupAndAdd = async () => {
    if (!newGroupName.trim() || !selectedChat) return;
    setCreatingGroup(true);
    try {
      const token = localStorage.getItem("token");
      const { data: newGrp } = await axios.post(
        `${API}/api/wa/groups`,
        { name: newGroupName.trim(), description: "Created from WhatsApp Chat" },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      let cleanPhone = selectedChat.id.replace(/\D/g, "").slice(-10);
      await axios.post(
        `${API}/api/wa/groups/${newGrp.id}/contacts`,
        {
          contacts: [{
            name: selectedChat.name,
            phone: cleanPhone,
            country_code: "91",
            notes: "Added upon group creation in Chat"
          }]
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNewGroupName("");
      await fetchCampaignGroups();
      setShowAddToGroupModal(false);
      alert(`✅ Created group "${newGrp.name}" and added ${selectedChat.name}!`);
    } catch (err) {
      alert("Failed to create group: " + (err.response?.data?.error || err.message));
    } finally {
      setCreatingGroup(false);
    }
  };

  const fetchAutomations = useCallback(async () => {
    try {
      setAutomationsLoading(true);
      const token = localStorage.getItem("token");
      const { data } = await axios.get(`${API}/api/wa/automations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAutomations(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn("Failed to load automations:", err.message);
    } finally {
      setAutomationsLoading(false);
    }
  }, []);

  const handleTriggerAutomation = async (automationId) => {
    if (!selectedChat || !automationId) return;
    setRunningAutomation(true);
    try {
      const token = localStorage.getItem("token");
      const rawTarget = selectedChat.phoneNumber || selectedChat.phone || selectedChat.id?.replace(/@.*$/, "") || "";
      let phone = rawTarget.replace(/\D/g, "");
      if (phone.length === 10) phone = "91" + phone;

      await axios.post(
        `${API}/api/wa/automations/${automationId}/trigger`,
        {
          phone: phone || selectedChat.id,
          chatId: selectedChat.id,
          contact_name: selectedChat.name,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setShowAutomationModal(false);
      await fetchMessages(selectedChat.id, 25);
      alert(`⚡ Automation triggered successfully for ${selectedChat.name || phone}!`);
    } catch (err) {
      alert("Failed to trigger automation: " + (err.response?.data?.error || err.message));
    } finally {
      setRunningAutomation(false);
    }
  };

  const handleShareLocation = () => {
    if (!selectedChat) return;
    if (!navigator.geolocation) { setError("Geolocation is not supported by this browser"); return; }
    setLocationSending(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const token = localStorage.getItem("token");
          const headers = { Authorization: `Bearer ${token}` };
          await axios.post(`${API}/api/whatsapp/send-location`, {
            chatId: selectedChat.id, lat: pos.coords.latitude, lng: pos.coords.longitude,
          }, { headers });
          await fetchMessages(selectedChat.id);
        } catch (err) {
          setError(err.response?.data?.error || err.message || "Failed to share location");
        }
        setLocationSending(false);
      },
      (err) => { setError("Could not get location: " + err.message); setLocationSending(false); },
      { timeout: 10000 }
    );
  };

  const handleStartNewChat = async (e) => {
    e.preventDefault();
    const cleanPhone = newChatPhone.replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < 10) {
      alert("Please enter a valid phone number (at least 10 digits)");
      return;
    }
    const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const chatId = `${formattedPhone}@c.us`;
    const contactName = newChatName.trim() || `+${formattedPhone}`;

    const newChatObj = {
      id: chatId,
      name: contactName,
      source: "Direct",
      unreadCount: 0,
      timestamp: Math.floor(Date.now() / 1000),
      lastMessage: newChatMessage.trim() ? { body: newChatMessage.trim(), timestamp: Math.floor(Date.now() / 1000) } : null,
    };

    setChats((prev) => {
      const exists = prev.find((c) => c.id === chatId);
      if (exists) return prev;
      return [newChatObj, ...prev];
    });

    setSelectedChat(newChatObj);
    setShowMobileChat(true);
    setError(null);

    if (newChatMessage.trim()) {
      setNewChatLoading(true);
      try {
        const token = localStorage.getItem("token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        let res;
        try {
          res = await axios.post(`${API}/api/whatsapp/send`, { chatId, message: newChatMessage.trim() }, { headers });
        } catch (e1) {
          res = await axios.post(`/api/whatsapp/send`, { chatId, message: newChatMessage.trim() }, { headers });
        }
        setNewChatMessage("");
      } catch (err) {
        alert("Chat created, but message failed to send: " + (err.response?.data?.error || err.message));
      }
      setNewChatLoading(false);
    }

    setShowNewChatModal(false);
    setNewChatPhone("");
    setNewChatName("");
    await fetchMessages(chatId);
  };

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API}/api/whatsapp/logout`,
        { purge: true },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch { }
    try {
      sessionStorage.removeItem("wa_cached_status");
      sessionStorage.removeItem("wa_cached_chats");
      sessionStorage.removeItem("wa_active_chat");
      localStorage.removeItem("wa_cached_status");
      localStorage.removeItem("wa_cached_chats");
      localStorage.removeItem("wa_active_chat");
    } catch (_) {}
    messagesCacheRef.current = {};
    setStatus({ connected: false, initializing: false, hasQr: false });
    setQrCode(null);
    setChats([]);
    setSelectedChat(null);
    setMessages([]);
    setAccountDetails(null);
    fetchQr(true);
  };

  const handleRefresh = () => {
    if (status.connected) {
      fetchChats();
    } else {
      setQrCode(null);
      fetchQr(true);
    }
  };

  const [connectMode, setConnectMode] = useState("qr"); // 'qr', 'pairing', 'api'
  const [pairingPhone, setPairingPhone] = useState("");
  const [pairingCode, setPairingCode] = useState(null);
  const [pairingLoading, setPairingLoading] = useState(false);
  const [pairingError, setPairingError] = useState(null);

  useEffect(() => {
    // Initial fetch on mount
    fetchStatus();
    fetchChats(false);
    fetchAccountDetails();
  }, [fetchStatus, fetchChats, fetchAccountDetails]);

  useEffect(() => {
    // Status polling in background
    const interval = setInterval(fetchStatus, status.connected ? 15000 : 4000);
    return () => clearInterval(interval);
  }, [fetchStatus, status.connected]);

  // Auto-fetch QR code once on mount if not connected and no QR yet
  useEffect(() => {
    if (status.connected) {
      hasTriggeredQrFetch.current = false;
      return;
    }
    if (!status.connected && !qrCode && !qrLoading && connectMode === "qr" && !hasTriggeredQrFetch.current) {
      hasTriggeredQrFetch.current = true;
      fetchQr();
    }
  }, [status.connected, qrCode, qrLoading, connectMode, fetchQr]);

  const handleRequestPairingCode = async (e) => {
    e.preventDefault();
    if (!pairingPhone.trim()) return;
    setPairingLoading(true);
    setPairingError(null);
    setPairingCode(null);
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      let res;
      try {
        res = await axios.get(`${API}/api/whatsapp/pairing-code?phone=${encodeURIComponent(pairingPhone.trim())}`, { headers, timeout: 40000 });
      } catch (e1) {
        res = await axios.get(`/api/whatsapp/pairing-code?phone=${encodeURIComponent(pairingPhone.trim())}`, { headers, timeout: 40000 });
      }
      if (res.data && res.data.code) {
        setPairingCode(res.data.code);
      } else {
        setPairingError(res.data?.error || "Failed to generate pairing code");
      }
    } catch (err) {
      setPairingError(err.response?.data?.error || err.message || "Failed to request pairing code");
    }
    setPairingLoading(false);
  };

  // Auto-fetch chats & account details immediately when connected
  useEffect(() => {
    if (status.connected) {
      fetchChats(true);
      fetchAccountDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.connected]);

  useEffect(() => {
    if (status.connected) {
      if (pollRef.current) clearInterval(pollRef.current);
      // Real-time updates arrive over the socket below — this is just a slow
      // fallback in case a socket event is missed.
      pollRef.current = setInterval(() => {
        fetchChats();
        if (selectedChat) fetchMessages(selectedChat.id);
      }, 20000);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [status.connected, fetchChats, fetchMessages, selectedChat]);

  // Real-time socket listener for instant WhatsApp updates. The server now
  // pushes the actual message payload instead of just a "something changed"
  // ping, so we apply it directly to state — no round-trip fetch needed to
  // see a message land, which is what made incoming/outgoing messages feel
  // laggy or missing before.
  useEffect(() => {
    const handleRealtimeUpdate = (data) => {
      const { chatId, message, phone } = data || {};
      if (!chatId && !phone) {
        fetchChats();
        if (selectedChatRef.current) fetchMessages(selectedChatRef.current.id);
        return;
      }

      const activeSelected = selectedChatRef.current;
      const targetChatId = chatId || (phone ? `${phone}@c.us` : "");
      const selClean = (activeSelected?.phoneNumber || activeSelected?.phone || activeSelected?.id || "").replace(/\D/g, "");
      const msgClean = (targetChatId || phone || "").replace(/\D/g, "");
      const sel10 = selClean.slice(-10);
      const msg10 = msgClean.slice(-10);
      const isCurrentChat = Boolean(
        (activeSelected?.id && (activeSelected.id === targetChatId || activeSelected.id === chatId)) ||
        (sel10 && msg10 && sel10 === msg10)
      );

      const msgObj = message || {
        id: data?.id || `ws_${Date.now()}`,
        body: data?.body || previewText(data || {}),
        timestamp: data?.timestamp || Math.floor(Date.now() / 1000),
        isMe: Boolean(data?.isMe),
      };

      // Play pleasant audio chime on inbound messages (respects sound toggle)
      if (!msgObj.isMe && soundEnabledRef.current) {
        playNotificationSound();
      }
      // Desktop notification when tab not focused
      if (!msgObj.isMe && document.hidden && desktopNotifsRef.current) {
        try {
          if (Notification.permission === "granted") {
            const contactName = data?.fromName || data?.contactName || "WhatsApp";
            new Notification(contactName, {
              body: msgObj.body || "New message",
              icon: "/favicon.ico",
              tag: `wa-${msgObj.id}`,
              silent: true,
            });
          }
        } catch (_) {}
      }

      if (isCurrentChat && msgObj) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msgObj.id || (m.serializedId && m.serializedId === msgObj.serializedId))) {
            return prev;
          }
          return [msgObj, ...prev];
        });
        const isNearBottom = threadRef.current
          ? threadRef.current.scrollHeight - threadRef.current.scrollTop - threadRef.current.clientHeight <= 220
          : true;
        if (isNearBottom) {
          setTimeout(() => scrollToBottom(true), 50);
        } else {
          setUnreadWhileScrolled((prev) => prev + 1);
        }
      }

      setChats((prev) => {
        const cleanDigits = (targetChatId || phone || "").replace(/\D/g, "");
        const clean10Digits = cleanDigits.slice(-10);
        const idx = prev.findIndex((c) => {
          const cPhone = (c.phoneNumber || c.id || c.phone || "").replace(/\D/g, "");
          return c.id === targetChatId || cPhone === cleanDigits || (clean10Digits && cPhone.slice(-10) === clean10Digits);
        });

        const msgBody = previewText(msgObj) || msgObj.body || (msgObj.isMe ? "Sent message" : "Incoming message");
        const msgTime = msgObj.timestamp || Math.floor(Date.now() / 1000);

        if (idx !== -1) {
          const current = prev[idx];
          const updated = {
            ...current,
            hasMessages: true,
            lastMessage: { body: msgBody, timestamp: msgTime, fromMe: Boolean(msgObj.isMe) },
            timestamp: msgTime,
            unreadCount: msgObj.isMe || isCurrentChat ? 0 : (current.unreadCount || 0) + 1,
          };
          return [updated, ...prev.slice(0, idx), ...prev.slice(idx + 1)];
        } else {
          const realPhone = cleanDigits.length <= 13 ? cleanDigits : null;
          const newChat = {
            id: targetChatId || `${cleanDigits}@c.us`,
            phoneNumber: realPhone,
            formattedPhone: realPhone ? formatPhoneNumber(realPhone) : "",
            name: msgObj.fromName || (realPhone ? formatPhoneNumber(realPhone) : "WhatsApp Contact"),
            phone: cleanDigits,
            hasMessages: true,
            lastMessage: { body: msgBody, timestamp: msgTime, fromMe: Boolean(msgObj.isMe) },
            timestamp: msgTime,
            unreadCount: msgObj.isMe || isCurrentChat ? 0 : 1,
          };
          return [newChat, ...prev];
        }
      });
    };

    const handleChatHistoryUpdated = (data) => {
      const { chatId } = data || {};
      const activeSelected = selectedChatRef.current;
      if (activeSelected && chatId) {
        const selClean = (activeSelected.id || "").replace(/\D/g, "").slice(-10);
        const eventClean = (chatId || "").replace(/\D/g, "").slice(-10);
        if (selClean === eventClean) {
          fetchMessages(activeSelected.id);
        }
      }
    };

    const handleReaction = (data) => {
      const { id, serializedId, reaction } = data || {};
      if (!id && !serializedId) return;
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === id || m.serializedId === serializedId) {
            return { ...m, reactionEmoji: reaction };
          }
          return m;
        })
      );
    };

    const handleRevoked = (data) => {
      const { id, serializedId } = data || {};
      if (!id && !serializedId) return;
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === id || m.serializedId === serializedId) {
            return { ...m, body: "🚫 This message was deleted", hasMedia: false, isDeleted: true };
          }
          return m;
        })
      );
    };

    socket.on("wa_message_received", handleRealtimeUpdate);
    socket.on("wa_message_sent", handleRealtimeUpdate);
    socket.on("wa_message", handleRealtimeUpdate);
    socket.on("wa_message_reaction", handleReaction);
    socket.on("wa_message_revoked", handleRevoked);
    socket.on("wa_chat_history_updated", handleChatHistoryUpdated);

    const handleHandoffAlert = (data) => {
      if (data?.phone) {
        fetchChats(true);
      }
    };
    socket.on("wa_agent_handoff", handleHandoffAlert);

    const handleWaReady = (data) => {
      setQrCode(null);
      setQrLoading(false);
      setError(null);
      setStatus((s) => ({
        ...s,
        connected: true,
        isWeb: true,
        initializing: false,
        hasQr: false,
        phone: data?.phone || s.phone,
      }));
      fetchStatus();
      fetchAccountDetails();
      fetchChats(true);
    };
    const handleWaSynced = () => {
      fetchChats(true);
      fetchAccountDetails();
    };

    const handleWaQr = (data) => {
      const qrVal = data?.qr || data?.message?.qr || (typeof data === "string" ? data : null);
      if (qrVal) {
        setQrCode(qrVal);
        if (data?.qrDataUrl) setQrDataUrl(data.qrDataUrl);
        setQrLoading(false);
        setError(null);
        setStatus((s) => ({ ...s, hasQr: true, connected: false }));
      }
    };
    const handleWaDisconnected = (data) => {
      console.log("ℹ️ WhatsApp disconnected event received:", data);
      try {
        sessionStorage.removeItem("wa_cached_status");
        sessionStorage.removeItem("wa_cached_chats");
        sessionStorage.removeItem("wa_active_chat");
        localStorage.removeItem("wa_cached_status");
        localStorage.removeItem("wa_cached_chats");
        localStorage.removeItem("wa_active_chat");
      } catch (_) {}
      messagesCacheRef.current = {};
      setStatus((s) => ({ ...s, connected: false, isWeb: false, hasQr: false }));
      setChats([]);
      setSelectedChat(null);
      setMessages([]);
      setAccountDetails(null);
      fetchStatus();
    };

    socket.on("wa_qr", handleWaQr);
    socket.on("wa_authenticated", handleWaReady);
    socket.on("wa_connected", handleWaReady);
    socket.on("wa_ready", handleWaReady);
    socket.on("wa_disconnected", handleWaDisconnected);
    socket.on("wa_contacts_synced", handleWaSynced);
    socket.on("wa_chats_synced", handleWaSynced);

    const handleChatReadEvent = (data) => {
      const { chatId, phone } = data || {};
      const clean10 = (phone || chatId || "").replace(/\D/g, "").slice(-10);
      if (clean10) {
        setChats((prev) =>
          prev.map((c) => {
            const c10 = (c.id || c.phone || "").replace(/\D/g, "").slice(-10);
            return c10 === clean10 ? { ...c, unreadCount: 0 } : c;
          })
        );
      }
    };
    socket.on("wa_chat_read", handleChatReadEvent);

    // Delivery receipts — advance the tick marks in place (sent → delivered → read)
    const handleMessageAck = (data) => {
      const { message, phone } = data || {};
      if (!message?.id && !message?.serializedId) return;
      const status = message.status;
      if (!status) return;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === message.id || m.serializedId === message.serializedId
            ? { ...m, status, ack: message.ack }
            : m
        )
      );

      const clean10 = (phone || "").replace(/\D/g, "").slice(-10);
      if (clean10) {
        setChats((prev) =>
          prev.map((c) => {
            const c10 = (c.id || c.phone || "").replace(/\D/g, "").slice(-10);
            if (c10 !== clean10 || !c.lastMessage?.fromMe) return c;
            return { ...c, lastMessage: { ...c.lastMessage, status } };
          })
        );
      }
    };
    socket.on("wa_message_ack", handleMessageAck);

    // Check if user was navigated here with a phone parameter from Contacts / Groups / Templates
    const urlParams = new URLSearchParams(window.location.search);
    const phoneParam = urlParams.get("phone");
    if (phoneParam) {
      const clean = phoneParam.replace(/\D/g, "");
      const formatted = clean.length === 10 ? `91${clean}` : clean;
      const targetId = `${formatted}@c.us`;
      setSelectedChat({ id: targetId, name: `+${formatted}`, isGroup: false });
      setShowMobileChat(true);
      fetchMessages(targetId);
      fetchContactCrmDetails(clean);
    }

    // Typing indicator from contact
    const handleTyping = (data) => {
      const { chatId, phone } = data || {};
      const clean10 = (phone || chatId || "").replace(/\D/g, "").slice(-10);
      const activeSel = selectedChatRef.current;
      const sel10 = (activeSel?.id || "").replace(/\D/g, "").slice(-10);
      if (clean10 && sel10 === clean10) {
        setContactTyping(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setContactTyping(false), 4000);
      }
    };
    socket.on("wa_typing", handleTyping);
    socket.on("wa_chat_typing", handleTyping);

    // Online status
    const handlePresence = (data) => {
      const { phone, online } = data || {};
      if (phone) {
        setOnlineContacts((prev) => {
          const next = new Set(prev);
          if (online) next.add(phone.replace(/\D/g, "").slice(-10));
          else next.delete(phone.replace(/\D/g, "").slice(-10));
          return next;
        });
      }
    };
    socket.on("wa_presence", handlePresence);
    socket.on("wa_user_status", handlePresence);

    // Active flow status
    const handleFlowAdvanced = (data) => {
      const { phone, flowName, currentNode, flowId, status: flowStatus } = data || {};
      const activeSel = selectedChatRef.current;
      const sel10 = (activeSel?.id || "").replace(/\D/g, "").slice(-10);
      const evt10 = (phone || "").replace(/\D/g, "").slice(-10);
      if (sel10 && sel10 === evt10) {
        if (flowStatus === "completed" || flowStatus === "stopped") {
          setActiveFlowRun(null);
        } else {
          setActiveFlowRun({ flowName, currentNode, flowId });
        }
      }
    };
    socket.on("wa_flow_advanced", handleFlowAdvanced);
    socket.on("wa_flow_status", handleFlowAdvanced);

    return () => {
      socket.off("wa_message_received", handleRealtimeUpdate);
      socket.off("wa_message_sent", handleRealtimeUpdate);
      socket.off("wa_message", handleRealtimeUpdate);
      socket.off("wa_message_reaction", handleReaction);
      socket.off("wa_message_revoked", handleRevoked);
      socket.off("wa_chat_history_updated", handleChatHistoryUpdated);
      socket.off("wa_agent_handoff", handleHandoffAlert);
      socket.off("wa_qr", handleWaQr);
      socket.off("wa_authenticated", handleWaReady);
      socket.off("wa_connected", handleWaReady);
      socket.off("wa_ready", handleWaReady);
      socket.off("wa_disconnected", handleWaDisconnected);
      socket.off("wa_contacts_synced", handleWaSynced);
      socket.off("wa_chats_synced", handleWaSynced);
      socket.off("wa_chat_read", handleChatReadEvent);
      socket.off("wa_message_ack", handleMessageAck);
      socket.off("wa_typing", handleTyping);
      socket.off("wa_chat_typing", handleTyping);
      socket.off("wa_presence", handlePresence);
      socket.off("wa_user_status", handlePresence);
      socket.off("wa_flow_advanced", handleFlowAdvanced);
      socket.off("wa_flow_status", handleFlowAdvanced);
    };
  }, [fetchChats, fetchMessages, fetchStatus, fetchAccountDetails]);

  // Refs for sound/notification toggles (accessed inside socket callbacks)
  const soundEnabledRef = useRef(soundEnabled);
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);
  const desktopNotifsRef = useRef(desktopNotifs);
  useEffect(() => { desktopNotifsRef.current = desktopNotifs; }, [desktopNotifs]);

  // Persist sound/notification preferences
  useEffect(() => { localStorage.setItem("wa_sound_enabled", soundEnabled); }, [soundEnabled]);
  useEffect(() => { localStorage.setItem("wa_desktop_notifs", desktopNotifs); }, [desktopNotifs]);

  // Request desktop notification permission
  const requestNotifPermission = useCallback(async () => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      const perm = await Notification.requestPermission();
      if (perm === "granted") setDesktopNotifs(true);
    } else if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      setDesktopNotifs(true);
    }
  }, []);

  // Auto-grow textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [messageInput]);

  // Mobile swipe-to-back gesture
  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    const handleTouchStart = (e) => {
      const touch = e.touches[0];
      if (touch.clientX < 30) {
        touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
      }
    };
    const handleTouchEnd = (e) => {
      if (!touchStartRef.current) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStartRef.current.x;
      const dy = Math.abs(touch.clientY - touchStartRef.current.y);
      const dt = Date.now() - touchStartRef.current.time;
      if (dx > 80 && dy < 100 && dt < 400) {
        setShowMobileChat(false);
      }
      touchStartRef.current = null;
    };
    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [selectedChat]);

  // ── Bot pause indicator ────────────────────────────────────────────────────
  const fetchBotStatus = useCallback(async (chatId) => {
    if (!chatId || chatId.includes("@g.us")) return setBotStatus(null);
    const phone = chatId.replace(/\D/g, "");
    if (!phone) return setBotStatus(null);
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const { data } = await axios.get(`${API}/api/whatsapp/chat/${phone}/bot-status`, { headers, timeout: 8000 });
      setBotStatus(data);
    } catch (_) {
      setBotStatus(null); // pill simply hides if the lookup fails
    }
  }, []);

  useEffect(() => {
    fetchBotStatus(selectedChat?.id);
  }, [selectedChat?.id, fetchBotStatus]);

  const handleResumeBot = async () => {
    if (!selectedChat?.id) return;
    setBotResuming(true);
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const phone = selectedChat.id.replace(/\D/g, "");
      // This endpoint re-enables the bot AND clears ai_paused_until.
      await axios.patch(`${API}/api/whatsapp/chat/${phone}/ai`, { enabled: true }, { headers });
      await fetchBotStatus(selectedChat.id);
    } catch (err) {
      alert(err.response?.data?.error || "Could not hand the chat back to the bot");
    }
    setBotResuming(false);
  };

  // Close context menu on scroll or click outside
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    document.addEventListener("click", close);
    document.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("scroll", close, true);
    };
  }, [contextMenu]);

  // Lightbox keyboard shortcuts (Esc, +, -, r)
  useEffect(() => {
    if (!lightboxImage) return;
    const handleKey = (e) => {
      if (e.key === "Escape") setLightboxImage(null);
      if (e.key === "+" || e.key === "=") setLightboxZoom((z) => Math.min(3, Number((z + 0.25).toFixed(2))));
      if (e.key === "-") setLightboxZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))));
      if (e.key === "r" || e.key === "R") setLightboxRotation((r) => (r + 90) % 360);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lightboxImage]);

  // Emoji helpers
  const addRecentEmoji = useCallback((emoji) => {
    setRecentEmojis((prev) => {
      const next = [emoji, ...prev.filter((e) => e !== emoji)].slice(0, 16);
      try { localStorage.setItem("wa_recent_emojis", JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  // Copy message text
  const handleCopyMessage = useCallback((text) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
  }, []);

  // Star/unstar message
  const handleToggleStar = useCallback((msgId) => {
    setStarredMsgIds((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId); else next.add(msgId);
      return next;
    });
  }, []);

  // Check if contact is online
  const isContactOnline = useCallback((chatId) => {
    const clean10 = (chatId || "").replace(/\D/g, "").slice(-10);
    return onlineContacts.has(clean10);
  }, [onlineContacts]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    // Shift+Enter creates a new line naturally in textarea
  };

  // Filter chat categories for sidebar tabs & search (Always defined at top scope)
  const isGroupChat = (c) => Boolean(c.isGroup || (c.id && c.id.includes("@g.us")));

  // Defensive frontend deduplication: strictly one entry per group JID or normalized 10-digit phone
  const deduplicatedChats = useMemo(() => {
    const seen = new Set();
    return (chats || []).filter((c) => {
      if (!c || !c.id) return false;
      let key;
      if (isGroupChat(c)) {
        key = c.id;
      } else {
        const phone = c.phoneNumber || (c.id && !c.id.includes("@lid") ? c.id : "");
        const clean10 = phone.replace(/\D/g, "").slice(-10);
        key = clean10 && clean10.length === 10 ? clean10 : c.id;
      }
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [chats]);

  const allChatsList = deduplicatedChats;
  const directChatsList = deduplicatedChats.filter((c) => !isGroupChat(c));
  const groupChatsList = deduplicatedChats.filter((c) => isGroupChat(c));
  const unreadChatsList = deduplicatedChats.filter((c) => (c.unreadCount || 0) > 0);
  const favChatsList = deduplicatedChats.filter((c) => c.isPinned);
  const botChatsList = deduplicatedChats.filter(
    (c) => Boolean(c.inFlow || c.activeFlow || c.isBotActive || (activeFlowRun && (activeFlowRun.chatId === c.id || activeFlowRun.phone === c.phoneNumber)))
  );

  let displayChats = [];
  const searchLower = (searchTerm || "").toLowerCase().trim();
  let baseList = allChatsList;
  if (sidebarTab === "all") {
    baseList = allChatsList;
  } else if (sidebarTab === "direct") {
    baseList = directChatsList;
  } else if (sidebarTab === "unread") {
    baseList = unreadChatsList;
  } else if (sidebarTab === "favourites") {
    baseList = favChatsList;
  } else if (sidebarTab === "groups") {
    baseList = groupChatsList;
  } else if (sidebarTab === "bot") {
    baseList = botChatsList;
  }

  if (searchLower) {
    displayChats = baseList.filter(
      (c) =>
        (c.name || "").toLowerCase().includes(searchLower) ||
        (c.phoneNumber || "").includes(searchLower) ||
        (c.formattedPhone || "").toLowerCase().includes(searchLower) ||
        (c.id || "").includes(searchLower) ||
        (c.lastMessage?.body || "").toLowerCase().includes(searchLower)
    );
  } else {
    displayChats = baseList;
  }

  if (initialChecking) {
    return (
      <div className="w-full flex-1 flex flex-col min-h-screen items-center justify-center bg-[var(--color-paper-2)] text-[var(--color-ink-2)]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-paper)] border border-[var(--color-rule)] flex items-center justify-center text-[var(--color-ink)] animate-pulse">
            <MessageCircle size={36} className="text-[var(--color-ink)]" />
          </div>
          <div className="flex items-center gap-2 text-sm text-[var(--color-ink-2)] font-medium">
            <Loader2 size={18} className="animate-spin text-[var(--color-ink)]" />
            Loading WhatsApp Workspace...
          </div>
        </div>
      </div>
    );
  }

  if (!status.connected) {
    return (
      <div className="w-full flex-1 flex flex-col min-h-screen p-3 md:p-5 bg-[var(--color-paper)] text-[var(--color-ink)] pb-16">
        <WhatsAppNav />
        {showConfigModal && (
          <WAConfigPrompt
            onClose={() => {
              setShowConfigModal(false);
              fetchStatus();
            }}
          />
        )}

        <div className="hl-commandbar hl-card flex-col sm:flex-row sm:items-center gap-3 mb-6 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-ink)] text-[var(--color-paper-2)] flex items-center justify-center">
              <MessageCircle size={22} />
            </div>
            <div>
              <h1 className="hl-title">WhatsApp Connection Center</h1>
              <p className="hl-subtitle">Connect via Official Meta Cloud API (No QR needed) or Scan QR Code</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowConfigModal(true)}
              className="hl-btn-primary flex items-center gap-1.5"
            >
              <Key size={14} />
              <span>Configure Meta API</span>
            </button>
            <button
              onClick={() => fetchQr(true)}
              disabled={qrLoading}
              className="hl-btn-secondary flex items-center gap-1.5"
            >
              <RefreshCw size={14} className={qrLoading ? "animate-spin" : ""} />
              <span>{qrLoading ? "Generating..." : "Fresh QR / Reset"}</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="hl-card mb-4 p-3 text-xs font-semibold border-[var(--color-error)] text-[var(--color-error)]">
            {error}
          </div>
        )}

        {/* Quick Meta API Callout Banner */}
        <div className="hl-card mb-6 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-paper)] border border-[var(--color-rule)] text-[var(--color-ink)] flex items-center justify-center shrink-0">
              <Key size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-[var(--color-ink)]">Using Official Meta WhatsApp Cloud API?</p>
              <p className="hl-subtitle">You don't need to scan a QR code! Connect your Phone Number ID and Access Token to open immediately.</p>
            </div>
          </div>
          <button
            onClick={() => setShowConfigModal(true)}
            className="hl-btn-secondary shrink-0"
          >
            Enter Meta API Keys ⚡
          </button>
        </div>

        {/* Connection Options Sub-Tabs */}
        <div className="hl-card p-6 max-w-2xl mx-auto w-full">
          <div className="hl-tabs flex items-center justify-center gap-2 mb-6 pb-4">
            <button
              onClick={() => { setConnectMode("qr"); if (!qrCode) fetchQr(); }}
              className={`hl-tab px-4 py-2 text-xs font-bold transition ${connectMode === "qr" ? "is-active" : ""}`}
            >
              📱 Scan QR Code
            </button>
            <button
              onClick={() => setConnectMode("pairing")}
              className={`hl-tab px-4 py-2 text-xs font-bold transition ${connectMode === "pairing" ? "is-active" : ""}`}
            >
              🔢 Phone Pairing Code
            </button>
            <button
              onClick={() => setShowConfigModal(true)}
              className="hl-btn-secondary text-xs font-bold transition"
            >
              ☁️ Meta Cloud API
            </button>
          </div>

          {/* Mode 1: QR Code Scan */}
          {connectMode === "qr" && (
            <div className="flex flex-col items-center justify-center text-center py-4">
              {qrLoading ? (
                <div className="py-10 text-center">
                  <Loader2 size={44} className="animate-spin text-[var(--color-ink)] mx-auto mb-4" />
                  <p className="hl-empty-title">Generating WhatsApp QR Code...</p>
                  <p className="hl-subtitle mt-1">Please wait a few seconds</p>
                </div>
              ) : qrCode ? (
                <div>
                  <div className="hl-card p-4 inline-block mb-4">
                    {qrDataUrl ? (
                      <img src={qrDataUrl} alt="WhatsApp Web QR Code" className="w-[240px] h-[240px] object-contain" />
                    ) : (
                      <QRCodeSVG value={qrCode} size={240} level="M" />
                    )}
                  </div>
                  <h3 className="hl-empty-title mb-1">Scan with your WhatsApp App</h3>
                  <p className="hl-subtitle max-w-md mx-auto mb-4">
                    Open WhatsApp on your phone → Settings / Menu → <strong>Linked Devices</strong> → <strong>Link a Device</strong> and scan this code.
                  </p>
                  <button
                    onClick={() => fetchQr(true)}
                    className="hl-btn-secondary px-4 py-2 text-xs font-semibold transition"
                  >
                    Refresh QR Code
                  </button>
                </div>
              ) : (
                <div className="py-6 text-center">
                  <Smartphone size={52} className="text-[var(--color-ink)] mx-auto mb-3" />
                  <h3 className="hl-empty-title mb-1">Ready to Link WhatsApp Phone</h3>
                  <p className="hl-subtitle max-w-sm mx-auto mb-4">Click below to generate a QR code to scan with your phone.</p>
                  <button
                    onClick={() => fetchQr()}
                    className="hl-btn-primary font-bold text-xs"
                  >
                    Display QR Code Now
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Mode 2: Phone Pairing Code */}
          {connectMode === "pairing" && (
            <div className="py-4">
              <h3 className="hl-empty-title mb-1 text-center">Link via Mobile Number</h3>
              <p className="hl-subtitle text-center mb-6 max-w-md mx-auto">
                Enter your mobile number with country code (e.g. 919876543210) to receive an 8-character WhatsApp pairing code.
              </p>

              {pairingError && (
                <div className="hl-card mb-4 p-3 text-xs text-center font-semibold border-[var(--color-error)] text-[var(--color-error)]">
                  {pairingError}
                </div>
              )}

              {pairingCode ? (
                <div className="hl-card text-center py-4 p-6">
                  <p className="hl-section-label mb-2">YOUR WHATSAPP PAIRING CODE</p>
                  <div className="hl-kpi-num tracking-widest py-3 px-6 rounded-xl border border-[var(--color-rule)] bg-[var(--color-paper)] inline-block mb-3">
                    {pairingCode}
                  </div>
                  <p className="hl-subtitle max-w-sm mx-auto">
                    Open WhatsApp on phone → Linked Devices → <strong>Link with phone number instead</strong> → Enter this code.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleRequestPairingCode} className="space-y-4 max-w-md mx-auto">
                  <div>
                    <label className="hl-section-label block mb-1">Mobile Number (with Country Code)</label>
                    <input
                      type="text"
                      placeholder="e.g. 919876543210"
                      value={pairingPhone}
                      onChange={(e) => setPairingPhone(e.target.value)}
                      className="hl-input w-full px-4 py-2.5 text-xs"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={pairingLoading || !pairingPhone}
                    className="hl-btn-primary w-full py-3 font-bold text-xs flex items-center justify-center gap-2"
                  >
                    {pairingLoading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Generating Code...</span>
                      </>
                    ) : (
                      <span>Get 8-Digit Pairing Code</span>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Render Helpers for Contact CRM Intelligence & Team Notes ──────────────
  const renderContactInfoContent = (isDocked = false) => {
    if (!selectedChat) return null;
    return (
      <div className={`flex flex-col h-full min-h-0 bg-[var(--color-paper-2)] ${isDocked ? "w-full" : ""}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-rule)] bg-[var(--color-paper-2)] shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-lg bg-[var(--color-paper)] border border-[var(--color-rule)] text-[var(--color-ink)] shrink-0">
              <Info size={16} />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-xs sm:text-sm text-[var(--color-ink)] truncate">Contact Profile & CRM</h3>
              <p className="text-[10px] text-[var(--color-ink-2)] truncate">Live CRM Intelligence & Fast Tools</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowContactInfoDrawer(false)}
            className="p-1.5 rounded-lg text-[var(--color-ink-2)] hover:text-[var(--color-ink)] hover:bg-[var(--color-paper)] transition"
            title="Close CRM details"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body - Parallel Independent Scroll */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 wa-parallel-scroll wa-custom-scrollbar overscroll-contain">
          {/* Avatar and basic info */}
          <div className="text-center pb-4 border-b border-[var(--color-rule)]">
            <div className="flex flex-col items-center justify-center mx-auto mb-2">
              <WAContactAvatar
                src={selectedChat.profilePicUrl}
                name={selectedChat.name}
                phone={selectedChat.id}
                isGroup={selectedChat.isGroup}
                size="2xl"
                clickable={true}
                className="shadow-lg shadow-black/10"
              />
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await axios.get(`${API}/api/whatsapp/chat/${encodeURIComponent(selectedChat.id)}/profile-pic`, {
                      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
                    });
                    if (res.data?.profilePicUrl) {
                      setSelectedChat(prev => ({ ...prev, profilePicUrl: res.data.profilePicUrl }));
                      setChats(prev => prev.map(c => c.id === selectedChat.id ? { ...c, profilePicUrl: res.data.profilePicUrl } : c));
                    }
                  } catch (_) {}
                }}
                className="mt-2 text-[10px] text-[var(--color-ink)] font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw size={11} />
                <span>Refresh WhatsApp Photo</span>
              </button>
            </div>
            <h3 className="hl-title truncate">{selectedChat.name}</h3>
            <p className="hl-id text-xs text-[var(--color-ink-2)] mt-0.5">+{selectedChat.id?.replace(/\D/g, "")}</p>

            {selectedChat.source && (
              <span className="hl-badge hl-badge-info inline-block mt-2 text-xs font-bold px-3 py-1 rounded-full">
                {selectedChat.source}
              </span>
            )}
          </div>

          {/* CRM Invoices, Quotations, and AMC History */}
          <div className="py-2 border-b border-[var(--color-rule)] space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="hl-section-label text-xs font-bold text-[var(--color-ink-2)] uppercase tracking-wider">Linked CRM Records</h4>
              <button
                onClick={() => fetchContactCrmDetails(selectedChat.id)}
                className="text-[10px] text-[var(--color-ink)] font-bold hover:underline"
              >
                Refresh
              </button>
            </div>

            {crmDetailsLoading ? (
              <div className="py-3 text-center">
                <Loader2 size={18} className="animate-spin text-[var(--color-ink)] mx-auto" />
              </div>
            ) : crmDetails ? (
              <div className="space-y-3 text-xs">
                {/* Invoices list */}
                {crmDetails.invoices && crmDetails.invoices.length > 0 && (
                  <div className="hl-card bg-[var(--color-paper-2)] p-2.5 rounded-xl border border-[var(--color-rule)]">
                    <p className="hl-section-label font-bold text-[var(--color-ink-2)] mb-1.5 text-[11px]">Recent Invoices ({crmDetails.invoices.length})</p>
                    <div className="space-y-1">
                      {crmDetails.invoices.slice(0, 3).map((inv) => (
                        <div key={inv.id} className="hl-id flex justify-between text-[11px]">
                          <span className="text-[var(--color-ink-2)] truncate">{inv.invoice_number || `INV-#${inv.id}`}</span>
                          <span className="hl-section-label font-bold">₹{parseFloat(inv.grand_total || inv.total_amount || 0).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quotations list */}
                {crmDetails.quotations && crmDetails.quotations.length > 0 && (
                  <div className="hl-card bg-[var(--color-paper-2)] p-2.5 rounded-xl border border-[var(--color-rule)]">
                    <p className="hl-section-label font-bold text-[var(--color-ink-2)] mb-1.5 text-[11px]">Quotations ({crmDetails.quotations.length})</p>
                    <div className="space-y-1">
                      {crmDetails.quotations.slice(0, 3).map((q) => (
                        <div key={q.id} className="hl-id flex justify-between text-[11px]">
                          <span className="text-[var(--color-ink-2)] truncate">{q.quotation_number || `QTN-#${q.id}`}</span>
                          <span className="hl-section-label font-bold text-[var(--color-ink)]">₹{parseFloat(q.grand_total || q.total_amount || 0).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* AMC Contracts */}
                {crmDetails.amc && crmDetails.amc.length > 0 && (
                  <div className="hl-card bg-[var(--color-paper)] p-2.5 rounded-xl border border-[var(--color-rule)]">
                    <p className="hl-section-label font-bold text-[var(--color-ink)] mb-1 text-[11px]">Active AMC Contract</p>
                    <p className="hl-kpi-label">{crmDetails.amc[0].contract_title || "Annual Maintenance"}</p>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => fetchContactCrmDetails(selectedChat.id)}
                className="hl-btn-secondary w-full py-2 bg-[var(--color-paper-2)] text-[var(--color-ink-2)] rounded-lg text-xs font-semibold hover:bg-[var(--color-paper-2)] transition border border-[var(--color-rule)]"
              >
                Load CRM Invoices & Quotes
              </button>
            )}
          </div>

          {/* Add as CRM Client */}
          <div className="py-2 border-b border-[var(--color-rule)] space-y-2.5">
            <h4 className="hl-section-label text-xs font-bold text-[var(--color-ink-2)] uppercase tracking-wider">CRM Client Status</h4>

            {crmDetails?.client ? (
              <div className="hl-card bg-[var(--color-paper)] p-3 rounded-xl border border-[var(--color-rule)] space-y-1.5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-[var(--color-ink)] shrink-0" />
                  <span className="text-xs font-bold text-[var(--color-ink)]">Linked CRM Client</span>
                  {crmDetails.client.source && (
                    <span className="hl-badge hl-badge-success ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {crmDetails.client.source}
                    </span>
                  )}
                </div>
                <p className="hl-kpi-label font-semibold">{crmDetails.client.name || crmDetails.client.company_name}</p>
                {crmDetails.client.company_name && crmDetails.client.name !== crmDetails.client.company_name && (
                  <p className="text-[10px] text-[var(--color-ink)]">{crmDetails.client.company_name}</p>
                )}
                {crmDetails.client.email && (
                  <p className="text-[10px] text-[var(--color-ink)]">{crmDetails.client.email}</p>
                )}
                <button
                  onClick={() => navigate(`/whatsapp/contacts`)}
                  className="mt-1 text-[10px] text-[var(--color-ink)] font-bold hover:underline flex items-center gap-1"
                >
                  <ExternalLink size={10} /> View in CRM Clients
                </button>
              </div>
            ) : addClientResult?.success ? (
              <div className={`hl-card p-3 space-y-1.5 ${addClientResult.isExisting ? "border-[var(--color-info)]" : "border-[var(--color-success)]"}`}>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className={addClientResult.isExisting ? "text-[var(--color-info)]" : "text-[var(--color-success)]"} />
                  <span className={`text-xs font-bold ${addClientResult.isExisting ? "text-[var(--color-info)]" : "text-[var(--color-success)]"}`}>
                    {addClientResult.isExisting ? "Already in CRM" : "✅ Added to CRM!"}
                  </span>
                  <span className="hl-badge hl-badge-success ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full">
                    WhatsApp
                  </span>
                </div>
                <p className="hl-id font-semibold">{addClientResult.client?.name}</p>
                {addClientResult.client?.company_name && (
                  <p className="hl-id text-[10px] text-[var(--color-ink-2)]">{addClientResult.client.company_name}</p>
                )}
                <button
                  onClick={() => navigate(`/whatsapp/contacts`)}
                  className="mt-1 text-[10px] text-[var(--color-ink)] font-bold hover:underline flex items-center gap-1"
                >
                  <ExternalLink size={10} /> View in CRM Clients
                </button>
              </div>
            ) : showAddClientForm ? (
              <div className="hl-card bg-[var(--color-paper-2)] p-3 rounded-xl border border-[var(--color-rule)] space-y-2">
                <div className="space-y-1.5">
                  <input
                    type="text"
                    placeholder="Customer Name *"
                    value={addClientData.name}
                    onChange={(e) => setAddClientData(prev => ({ ...prev, name: e.target.value }))}
                    className="hl-input w-full px-2.5 py-1.5 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Company Name"
                    value={addClientData.company_name}
                    onChange={(e) => setAddClientData(prev => ({ ...prev, company_name: e.target.value }))}
                    className="hl-input w-full px-2.5 py-1.5 text-xs"
                  />
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      type="email"
                      placeholder="Email"
                      value={addClientData.email}
                      onChange={(e) => setAddClientData(prev => ({ ...prev, email: e.target.value }))}
                      className="hl-input px-2.5 py-1.5 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="City"
                      value={addClientData.city}
                      onChange={(e) => setAddClientData(prev => ({ ...prev, city: e.target.value }))}
                      className="hl-input px-2.5 py-1.5 text-xs"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Service / Product Interest"
                    value={addClientData.service}
                    onChange={(e) => setAddClientData(prev => ({ ...prev, service: e.target.value }))}
                    className="hl-input w-full px-2.5 py-1.5 text-xs"
                  />
                  <textarea
                    placeholder="Notes (optional)"
                    value={addClientData.notes}
                    onChange={(e) => setAddClientData(prev => ({ ...prev, notes: e.target.value }))}
                    rows={2}
                    className="hl-input w-full px-2.5 py-1.5 text-xs resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={addClientLoading || !addClientData.name.trim()}
                    onClick={async () => {
                      setAddClientLoading(true);
                      try {
                        const token = localStorage.getItem("token");
                        const cleanPhone = selectedChat.id?.replace(/\D/g, "").slice(-10);
                        const res = await axios.post(`${API}/api/whatsapp/add-to-crm-client`, {
                          phone: cleanPhone,
                          ...addClientData,
                        }, { headers: { Authorization: `Bearer ${token}` } });
                        setAddClientResult(res.data);
                        setShowAddClientForm(false);
                        fetchContactCrmDetails(selectedChat.id);
                      } catch (err) {
                        alert(err.response?.data?.error || "Failed to add client");
                      }
                      setAddClientLoading(false);
                    }}
                    className="hl-btn-primary flex-1 py-2 bg-[var(--color-paper)] hover:bg-[var(--color-paper)] text-[var(--color-paper-2)] rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                  >
                    {addClientLoading ? (
                      <><Loader2 size={13} className="animate-spin" /> Saving...</>
                    ) : (
                      <><UserPlus size={13} /> Save as Client</>
                    )}
                  </button>
                  <button
                    onClick={() => { setShowAddClientForm(false); setAddClientData({ name: "", company_name: "", email: "", city: "", service: "", notes: "" }); }}
                    className="hl-btn-secondary px-3 py-2 bg-[var(--color-paper-2)] hover:bg-[var(--color-paper-2)] text-[var(--color-ink-2)] rounded-lg text-xs font-semibold transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => {
                  setAddClientData({
                    name: selectedChat.name || "",
                    company_name: "",
                    email: "",
                    city: "",
                    service: "",
                    notes: "",
                  });
                  setAddClientResult(null);
                  setShowAddClientForm(true);
                }}
                className="hl-btn-secondary w-full py-2 px-3 bg-[var(--color-paper)] hover:bg-[var(--color-paper)] text-[var(--color-ink)] border border-[var(--color-rule)] rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition"
              >
                <UserPlus size={14} className="text-[var(--color-ink)]" />
                <span>Add as CRM Client (Source: WhatsApp)</span>
              </button>
            )}
          </div>

          {/* Unified WhatsApp Hub Navigation Bar */}
          <div className="py-2 border-b border-[var(--color-rule)] space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="hl-section-label text-xs font-bold text-[var(--color-ink-2)] uppercase tracking-wider">⚡ Unified WhatsApp Hub</h4>
              <span className="hl-badge hl-badge-success text-[10px] font-bold px-2 py-0.5 rounded-full">All Linked</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => navigate("/whatsapp/campaigns")}
                className="hl-btn-secondary flex items-center gap-2 p-2 bg-[var(--color-paper)] hover:bg-[var(--color-paper)] text-[var(--color-ink)] rounded-xl transition text-xs font-semibold text-left border border-[var(--color-rule)]"
              >
                <SendHorizontal size={14} className="text-[var(--color-ink)] shrink-0" />
                <span className="truncate">Bulk Campaigns</span>
              </button>

              <button
                onClick={() => navigate("/whatsapp/automations")}
                className="hl-btn-secondary flex items-center gap-2 p-2 bg-[var(--color-paper)] hover:bg-[var(--color-paper)] text-[var(--color-ink)] rounded-xl transition text-xs font-semibold text-left border border-[var(--color-rule)]"
              >
                <Sparkles size={14} className="text-[var(--color-ink)] shrink-0" />
                <span className="truncate">Automations</span>
              </button>

              <button
                onClick={() => navigate("/whatsapp/flows")}
                className="hl-btn-secondary flex items-center gap-2 p-2 bg-[var(--color-paper)] hover:bg-[var(--color-paper)] text-[var(--color-ink)] rounded-xl transition text-xs font-semibold text-left border border-[var(--color-rule)]"
              >
                <Zap size={14} className="text-[var(--color-ink)] shrink-0" />
                <span className="truncate">Chatbot Flows</span>
              </button>

              <button
                onClick={() => navigate("/whatsapp/reminders")}
                className="hl-btn-secondary flex items-center gap-2 p-2 bg-[var(--color-paper)] hover:bg-[var(--color-paper)] text-[var(--color-ink)] rounded-xl transition text-xs font-semibold text-left border border-[var(--color-rule)]"
              >
                <Bell size={14} className="text-[var(--color-ink)] shrink-0" />
                <span className="truncate">Reminders</span>
              </button>
            </div>
          </div>

          {/* Quick Actions & Instant Bot Tools */}
          <div className="py-2 space-y-2">
            <h4 className="hl-section-label text-xs font-bold text-[var(--color-ink-2)] uppercase tracking-wider">Execute for this Contact</h4>
            
            <button
              onClick={() => {
                setShowContactInfoDrawer(false);
                fetchCampaignGroups();
                setShowAddToGroupModal(true);
              }}
              className="hl-btn-secondary w-full py-2 px-3 bg-[var(--color-paper)] hover:bg-[var(--color-paper)] text-[var(--color-ink)] border border-[var(--color-rule)] rounded-xl text-xs font-bold flex items-center justify-between transition"
            >
              <div className="flex items-center gap-2">
                <Users size={14} className="text-[var(--color-ink)]" />
                <span>Enroll in Campaign Group</span>
              </div>
              <span className="hl-badge hl-badge-info text-[10px] px-2 py-0.5 rounded-full">Bulk</span>
            </button>

            <button
              onClick={() => {
                setShowContactInfoDrawer(false);
                fetchDripSequences();
                setShowDripModal(true);
              }}
              className="hl-btn-secondary w-full py-2 px-3 bg-[var(--color-paper)] hover:bg-[var(--color-paper)] text-[var(--color-ink)] border border-[var(--color-rule)] rounded-xl text-xs font-bold flex items-center justify-between transition"
            >
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-[var(--color-ink)]" />
                <span>Enroll in Drip Sequence</span>
              </div>
              <span className="hl-badge hl-badge-info text-[10px] px-2 py-0.5 rounded-full">Nurture</span>
            </button>

            <button
              onClick={() => {
                setShowContactInfoDrawer(false);
                setShowOptionsModal(true);
              }}
              className="hl-btn-secondary w-full py-2 px-3 bg-[var(--color-paper-2)] hover:bg-[var(--color-paper-2)] text-[var(--color-ink)] border border-[var(--color-rule)] rounded-xl text-xs font-bold flex items-center justify-between transition"
            >
              <div className="flex items-center gap-2">
                <ListOrdered size={14} className="text-[var(--color-ink-2)]" />
                <span>Send Inquiry Options Menu</span>
              </div>
              <span className="hl-badge text-[10px] px-2 py-0.5 rounded-full">Quick</span>
            </button>

            <a
              href={`tel:+${selectedChat.id?.replace(/\D/g, "")}`}
              className="hl-btn-secondary w-full py-2 px-3 bg-[var(--color-paper)] hover:bg-[var(--color-paper)] text-[var(--color-ink)] border border-[var(--color-rule)] rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition"
            >
              <PhoneCall size={14} className="text-[var(--color-ink)]" />
              <span>Direct Call +{selectedChat.id?.replace(/\D/g, "")}</span>
            </a>
          </div>
        </div>
      </div>
    );
  };

  const renderNotesContent = (isDocked = false) => {
    return (
      <div className={`flex flex-col h-full min-h-0 bg-[var(--color-paper-2)] ${isDocked ? "w-full" : ""}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-rule)] bg-[var(--color-paper-2)] shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-lg bg-[var(--color-paper)] border border-[var(--color-rule)] text-[var(--color-ink)] shrink-0">
              <FileText size={16} />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-xs sm:text-sm text-[var(--color-ink)] truncate">Internal Team Notes</h3>
              <p className="text-[10px] text-[var(--color-ink-2)] truncate">Private CRM notes (hidden from customer)</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowNotesDrawer(false)}
            className="p-1.5 rounded-lg text-[var(--color-ink-2)] hover:text-[var(--color-ink)] hover:bg-[var(--color-paper)] transition"
            title="Close team notes"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Notes List - Parallel Scroll */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 wa-parallel-scroll wa-custom-scrollbar overscroll-contain">
          {notesLoading ? (
            <div className="py-10 text-center">
              <Loader2 size={24} className="animate-spin text-[var(--color-ink)] mx-auto" />
            </div>
          ) : internalNotes.length === 0 ? (
            <div className="hl-empty py-12 text-center text-xs text-[var(--color-ink-2)] space-y-1">
              <p className="font-bold text-[var(--color-ink-2)]">No internal notes yet</p>
              <p>Add private notes below to collaborate with colleagues.</p>
            </div>
          ) : (
            internalNotes.map((note) => (
              <div key={note.id} className="hl-card p-3 bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-xl space-y-1.5 shadow-xs">
                <div className="hl-id flex items-center justify-between text-[11px]">
                  <span className="font-bold text-[var(--color-ink)] flex items-center gap-1">
                    👤 {note.author_name}
                  </span>
                  <span className="text-[10px] text-[var(--color-ink-2)]">
                    {new Date(note.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="text-xs text-[var(--color-ink)] whitespace-pre-wrap">{note.note_text}</p>
              </div>
            ))
          )}
        </div>

        {/* Add Note Input */}
        <form onSubmit={handleCreateInternalNote} className="p-3 border-t border-[var(--color-rule)] bg-[var(--color-paper-2)] shrink-0 space-y-2">
          <textarea
            rows={3}
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            placeholder="Type private note or @colleague mention..."
            className="hl-input w-full px-3 py-2 text-xs resize-none"
            required
          />
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-[var(--color-ink-2)]">🔒 Only visible to team members</span>
            <button
              type="submit"
              disabled={submittingNote || !newNoteText.trim()}
              className="hl-btn-primary px-3.5 py-1.5 font-bold text-xs rounded-lg transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {submittingNote ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              <span>Save Note</span>
            </button>
          </div>
        </form>
      </div>
    );
  };

  return (
    <div className="w-full flex-1 flex flex-col h-full max-h-full min-h-0 bg-[var(--color-paper-2)] text-[var(--color-ink)] rounded-xl border border-[var(--color-rule)] shadow-sm overflow-hidden select-text wa-parallel-container">
      <div className="shrink-0 px-2 pt-2">
        <WhatsAppNav
          onAccountBalance={fetchAccountBalance}
          onSyncWhatsApp={handleSyncWhatsApp}
          onLogout={handleLogout}
          isSyncing={syncing}
          statusPhone={status.phone}
        />
      </div>

      {error && (
        <div className="p-2.5 text-xs font-semibold flex items-center justify-between shrink-0 bg-[var(--color-paper-2)] border-b border-[var(--color-error)] text-[var(--color-error)]">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-[var(--color-error)] hover:opacity-80">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Sound & Notification Toggles Bar */}
      <div className="flex items-center justify-end gap-1.5 px-3 py-1 bg-[var(--color-paper-2)] border-b border-[var(--color-rule)] shrink-0">
        <button
          onClick={() => setSoundEnabled((v) => !v)}
          className={`hl-badge flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold transition ${soundEnabled ? "hl-badge-accent" : ""}`}
          title={soundEnabled ? "Mute notification sounds" : "Unmute notification sounds"}
        >
          {soundEnabled ? <Volume2 size={12} /> : <VolumeX size={12} />}
          <span className="hidden sm:inline">{soundEnabled ? "Sound On" : "Muted"}</span>
        </button>
        <button
          onClick={() => {
            if (desktopNotifs) {
              setDesktopNotifs(false);
            } else {
              requestNotifPermission();
            }
          }}
          className={`hl-badge flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold transition ${desktopNotifs ? "hl-badge-info" : ""}`}
          title={desktopNotifs ? "Disable desktop notifications" : "Enable desktop notifications"}
        >
          <Bell size={12} />
          <span className="hidden sm:inline">{desktopNotifs ? "Notifs On" : "Notifs Off"}</span>
        </button>
      </div>

      {/* Main WhatsApp App Canvas */}
      <div className="flex-1 min-h-0 flex overflow-hidden w-full relative bg-[var(--color-paper)]">

        {/* Chats Sidebar Column (Independent Parallel Scrolling) */}
        <div
          className={`border-r border-[var(--color-rule)] bg-[var(--color-paper-2)] flex flex-col h-full min-h-0 shrink-0 select-none transition-all duration-200 ${
            sidebarMode === "compact"
              ? "wa-sidebar-compact"
              : sidebarMode === "wide"
              ? "wa-sidebar-wide"
              : "w-full md:w-80 lg:w-88 xl:w-[360px]"
          } ${showMobileChat ? "hidden md:flex" : "flex"}`}
        >
          {/* Search Bar & Action Buttons */}
          <div className="p-2.5 border-b border-[var(--color-rule)] flex items-center gap-1.5 shrink-0 bg-[var(--color-paper-2)]">
            {sidebarMode === "compact" ? (
              <div className="flex flex-col items-center gap-2 w-full py-1">
                <button
                  type="button"
                  onClick={toggleSidebarMode}
                  className="hl-btn-secondary p-2 rounded-lg text-[var(--color-ink)] hover:bg-[var(--color-paper)]"
                  title="Expand sidebar view"
                >
                  <PanelLeftOpen size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewChatModal(true)}
                  className="hl-btn-primary p-2 rounded-lg"
                  title="Start new chat"
                >
                  <Plus size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => fetchChats(true)}
                  className="hl-btn-secondary p-2 rounded-lg"
                  title="Refresh chats"
                >
                  <RefreshCw size={14} className={chatsLoading ? "animate-spin text-[var(--color-ink)]" : ""} />
                </button>
              </div>
            ) : (
              <>
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-2.5 text-[var(--color-ink-2)]" />
                  <input
                    type="text"
                    placeholder="Search or start a new chat..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="hl-input w-full pl-9 pr-7 py-1.5 text-xs rounded-lg"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm("")}
                      className="absolute right-2 top-2 text-[var(--color-ink-2)] hover:text-[var(--color-ink)] p-0.5 rounded-full"
                      title="Clear search"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewChatModal(true)}
                  className="hl-btn-secondary p-1.5 rounded-lg shrink-0"
                  title="Start new chat"
                >
                  <Plus size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => fetchChats(true)}
                  className="hl-btn-secondary p-1.5 rounded-lg shrink-0"
                  title="Refresh chat list"
                >
                  <RefreshCw size={14} className={chatsLoading ? "animate-spin text-[var(--color-ink)]" : ""} />
                </button>
                <button
                  type="button"
                  onClick={toggleSidebarMode}
                  className="hl-btn-secondary p-1.5 rounded-lg shrink-0 hidden md:flex items-center justify-center text-[var(--color-ink-2)] hover:text-[var(--color-ink)]"
                  title={`Sidebar view: ${sidebarMode} (Click to toggle Compact / Normal / Wide)`}
                >
                  <Columns size={15} />
                </button>
              </>
            )}
          </div>

          {/* Filter Capsules / Pills (All, Direct, Unread, Groups, Bot, Favourites) */}
          {sidebarMode !== "compact" && (
            <div className="hl-tabs px-3 py-1.5 flex items-center gap-1.5 shrink-0 overflow-x-auto wa-no-scrollbar border-b border-[var(--color-rule)] bg-[var(--color-paper-2)]">
              <button
                onClick={() => setSidebarTab("all")}
                className={`hl-tab px-2.5 py-1 text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${sidebarTab === "all" ? "is-active" : ""}`}
              >
                <span>All</span>
                <span className="hl-badge text-[10px] px-1.5 py-0.2 font-semibold">
                  {allChatsList.length}
                </span>
              </button>
              <button
                onClick={() => setSidebarTab("unread")}
                className={`hl-tab px-2.5 py-1 text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${sidebarTab === "unread" ? "is-active" : ""}`}
              >
                <span>Unread</span>
                {unreadChatsList.length > 0 && (
                  <span className="hl-badge hl-badge-error text-[10px] px-1.5 py-0.2 font-black animate-pulse">
                    {unreadChatsList.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setSidebarTab("direct")}
                className={`hl-tab px-2.5 py-1 text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${sidebarTab === "direct" ? "is-active" : ""}`}
              >
                <span>Direct</span>
                <span className="hl-badge text-[10px] px-1.5 py-0.2 font-semibold">
                  {directChatsList.length}
                </span>
              </button>
              <button
                onClick={() => setSidebarTab("groups")}
                className={`hl-tab px-2.5 py-1 text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${sidebarTab === "groups" ? "is-active" : ""}`}
              >
                <span>Groups</span>
                {groupChatsList.length > 0 && (
                  <span className={`hl-badge text-[10px] px-1.5 py-0.2 font-bold ${sidebarTab === "groups" ? "hl-badge-accent" : ""}`}>
                    {groupChatsList.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setSidebarTab("bot")}
                className={`hl-tab px-2.5 py-1 text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${sidebarTab === "bot" ? "is-active" : ""}`}
                title="Chats currently in automated bot flow"
              >
                <span>🤖 Bot</span>
                {botChatsList.length > 0 && (
                  <span className="hl-badge hl-badge-warn text-[10px] px-1.5 py-0.2 font-bold">
                    {botChatsList.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setSidebarTab("favourites")}
                className={`hl-tab px-2.5 py-1 text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${sidebarTab === "favourites" ? "is-active" : ""}`}
              >
                <Star size={11} className={sidebarTab === "favourites" ? "text-[var(--color-focus)] fill-[var(--color-focus)]" : ""} />
                <span>Favourites</span>
              </button>
            </div>
          )}

          {/* Chat List Items (Parallel Independent Column Scroll #1) */}
          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-[var(--color-rule)] overscroll-contain wa-custom-scrollbar wa-parallel-scroll scroll-smooth">
            {chatsLoading && chats.length === 0 ? (
              <div className="hl-empty flex flex-col items-center justify-center h-48 space-y-2">
                <Loader2 size={28} className="animate-spin text-[var(--color-ink)]" />
                <p className="text-xs font-medium">Loading conversations...</p>
              </div>
            ) : displayChats.length === 0 ? (
              <div className="hl-empty flex flex-col items-center justify-center p-8 text-center">
                <MessageSquare size={36} className="mb-2 text-[var(--color-ink)] opacity-80" />
                <p className="hl-empty-title mb-1">
                  {searchTerm
                    ? "No chats match your search"
                    : sidebarTab === "unread"
                    ? "No unread messages"
                    : sidebarTab === "direct"
                    ? "No 1-on-1 direct conversations"
                    : sidebarTab === "favourites"
                    ? "No starred or pinned chats"
                    : sidebarTab === "groups"
                    ? "No group chats found"
                    : "No WhatsApp chats yet"}
                </p>
                <p className="hl-subtitle mb-4 max-w-xs">
                  {searchTerm
                    ? "Try searching with a different name, phone number, or message"
                    : "Start a conversation directly with any contact or phone number"}
                </p>
                <button
                  onClick={() => setShowNewChatModal(true)}
                  className="hl-btn-primary text-xs flex items-center gap-1.5"
                >
                  <UserPlus size={14} />
                  <span>Start New Chat</span>
                </button>
              </div>
            ) : (
              displayChats.map((chat) => {
                const isActive = selectedChat?.id === chat.id;
                const timeStr = formatChatTime(chat.timestamp || chat.lastMessage?.timestamp);
                const hasUnread = (chat.unreadCount || 0) > 0;

                if (sidebarMode === "compact") {
                  return (
                    <div
                      key={chat.id}
                      onClick={() => handleSelectChat(chat)}
                      className={`w-full py-3 flex flex-col items-center justify-center cursor-pointer relative group transition-all duration-150 border-l-2 ${
                        isActive
                          ? "bg-[var(--color-paper)] border-[var(--color-accent)]"
                          : "border-transparent hover:bg-[var(--color-paper)]/70"
                      }`}
                      title={`${chat.name || chat.phoneNumber || "Contact"}\n${chat.lastMessage?.body || "Open conversation"}`}
                    >
                      <div className="relative">
                        <WAContactAvatar
                          src={chat.profilePicUrl}
                          name={chat.name}
                          phone={chat.id}
                          isGroup={chat.isGroup}
                          size="md"
                        />
                        {isContactOnline(chat.id) && !chat.isGroup && (
                          <span className="wa-online-dot" title="Online" />
                        )}
                        {hasUnread && (
                          <span className="absolute -top-1 -right-1 bg-[var(--color-accent)] text-[var(--color-accent-ink)] font-black text-[9px] px-1.5 py-0.5 rounded-full shadow-sm animate-pulse">
                            {chat.unreadCount}
                          </span>
                        )}
                        {chat.isPinned && (
                          <span className="absolute -bottom-1 -left-1 text-[var(--color-focus)] text-[10px] leading-none">
                            ★
                          </span>
                        )}
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={chat.id}
                    onClick={() => handleSelectChat(chat)}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 hover:bg-[var(--color-paper)] transition text-left cursor-pointer border-l-4 ${isActive ? "bg-[var(--color-paper)] border-[var(--color-accent)]" : "border-transparent"
                      }`}
                  >
                    {/* Contact Profile Picture / Avatar with Online Status */}
                    <div className="relative shrink-0">
                      <WAContactAvatar
                        src={chat.profilePicUrl}
                        name={chat.name}
                        phone={chat.id}
                        isGroup={chat.isGroup}
                        size="md"
                      />
                      {isContactOnline(chat.id) && !chat.isGroup && (
                        <span className="wa-online-dot" title="Online" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="font-bold text-sm truncate text-[var(--color-ink)]">
                          {(() => {
                            const n = chat.name || "";
                            if (n.replace(/\D/g, "").length >= 13 || n.includes("@lid")) {
                              return chat.formattedPhone || formatPhoneNumber(chat.phoneNumber) || "WhatsApp Contact";
                            }
                            if (n.startsWith("+91") && n.length === 13) {
                              return `+91 ${n.slice(3, 8)} ${n.slice(8)}`;
                            }
                            return n || chat.formattedPhone || "WhatsApp Contact";
                          })()}
                        </span>
                        <span className="hl-id font-semibold shrink-0">
                          {timeStr}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1 min-w-0 text-xs text-[var(--color-ink-2)] truncate">
                          {chat.lastMessage?.fromMe && (
                            <MessageTicks status={chat.lastMessage.status || "sent"} className="shrink-0" />
                          )}
                          {(() => {
                            const lm = chat.lastMessage || {};
                            const t = lm.type;
                            const icon =
                              lm.location ? "📍" :
                              t === "image" ? "📷" :
                              t === "video" ? "🎥" :
                              t === "audio" || t === "ptt" ? "🎤" :
                              t === "sticker" ? "🩹" :
                              (lm.hasMedia || t === "document") ? "📄" : null;
                            return icon ? <span className="shrink-0">{icon}</span> : null;
                          })()}
                          <span className="truncate">
                            {selectedChat?.id === chat.id && contactTyping ? (
                              <span className="hl-badge hl-badge-accent font-semibold italic animate-pulse">typing...</span>
                            ) : (
                              chat.lastMessage?.body || "Tap to open conversation"
                            )}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {chat.isMuted && <VolumeX size={13} className="text-[var(--color-ink-2)]" />}
                          {chat.isPinned && <Pin size={13} className="text-[var(--color-ink-2)] rotate-45" />}
                          {hasUnread && (
                            <span className="hl-badge hl-badge-accent text-[10px] px-1.5 py-0.5 font-extrabold min-w-[18px] text-center">
                              {chat.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Main Conversation Window / Empty State */}
        <div className={`flex-1 flex flex-col h-full min-h-0 min-w-0 bg-[var(--color-paper)] relative ${!showMobileChat ? "hidden md:flex" : "flex"}`}>
          {!selectedChat ? (
            <div className="hl-empty flex-1 flex flex-col items-center justify-center p-8 select-none">
              <div className="max-w-md w-full text-center space-y-6">
                <div className="w-20 h-20 mx-auto rounded-full bg-[var(--color-paper)] border border-[var(--color-rule)] flex items-center justify-center text-[var(--color-ink)]">
                  <MessageCircle size={44} />
                </div>
                <div>
                  <h2 className="hl-title tracking-wide">WhatsApp Desktop & CRM Live</h2>
                  <p className="hl-subtitle mt-1">
                    Send and receive live messages without keeping your phone online. Connected with Madhura Tech CRM.
                  </p>
                </div>

                {/* Quick Action Shortcut Buttons (Matching Screenshot) */}
                <div className="flex items-center justify-center gap-4 pt-2">
                  <button
                    onClick={() => setShowNewChatModal(true)}
                    className="hl-card flex flex-col items-center gap-2 p-3.5 transition w-28 group"
                  >
                    <div className="p-2.5 rounded-xl bg-[var(--color-paper)] text-[var(--color-ink)] group-hover:scale-110 transition">
                      <FileText size={20} />
                    </div>
                    <span className="hl-kpi-label">Send document</span>
                  </button>

                  <button
                    onClick={() => setShowNewChatModal(true)}
                    className="hl-card flex flex-col items-center gap-2 p-3.5 transition w-28 group"
                  >
                    <div className="p-2.5 rounded-xl bg-[var(--color-paper)] text-[var(--color-ink)] group-hover:scale-110 transition">
                      <UserPlus size={20} />
                    </div>
                    <span className="hl-kpi-label">Add contact</span>
                  </button>

                  <button
                    onClick={() => setShowNewChatModal(true)}
                    className="hl-card flex flex-col items-center gap-2 p-3.5 transition w-28 group"
                  >
                    <div className="p-2.5 rounded-xl bg-[var(--color-paper)] text-[var(--color-ink)] group-hover:scale-110 transition">
                      <Sparkles size={20} />
                    </div>
                    <span className="hl-kpi-label">Ask Meta AI</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Active Chat Header */}
              <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-[var(--color-rule)] bg-[var(--color-paper-2)] shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <button onClick={() => setShowMobileChat(false)} className="md:hidden p-1 text-[var(--color-ink-2)] hover:text-[var(--color-ink)] rounded">
                    <ChevronLeft size={20} />
                  </button>
                  <div
                    onClick={() => {
                      fetchContactCrmDetails(selectedChat.id);
                      setShowContactInfoDrawer(true);
                    }}
                    className="cursor-pointer"
                  >
                    <WAContactAvatar
                      src={selectedChat.profilePicUrl}
                      name={selectedChat.name}
                      phone={selectedChat.id}
                      isGroup={selectedChat.isGroup}
                      size="md"
                      clickable={true}
                    />
                  </div>
                  <div
                    onClick={() => {
                      fetchContactCrmDetails(selectedChat.id);
                      setShowContactInfoDrawer(true);
                    }}
                    className="cursor-pointer group min-w-0"
                  >
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-[var(--color-ink)] text-sm transition truncate">
                        {(() => {
                          const n = selectedChat.name || "";
                          if (n.replace(/\D/g, "").length >= 13 || n.includes("@lid")) {
                            return selectedChat.formattedPhone || formatPhoneNumber(selectedChat.phoneNumber) || "WhatsApp Contact";
                          }
                          return n || selectedChat.formattedPhone || "WhatsApp Contact";
                        })()}
                      </p>
                      {selectedChat.source && (
                        <span className="hl-badge hl-badge-success text-[10px] font-bold px-2 py-0.5 shrink-0">
                          {selectedChat.source}
                        </span>
                      )}
                      {crmDetails?.client ? (
                        <span className="hl-badge hl-badge-accent text-[10px] font-bold px-2 py-0.5 shrink-0 flex items-center gap-1" title="Linked CRM Client">
                          🏢 CRM Client
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setAddClientData({
                              name: selectedChat.name && !selectedChat.name.startsWith("+") ? selectedChat.name : "",
                              company_name: "",
                              email: "",
                              city: "",
                              service: "",
                              notes: "",
                            });
                            setShowAddClientForm(true);
                          }}
                          className="hl-badge text-[10px] font-semibold px-2 py-0.5 hover:bg-[var(--color-paper)] transition text-[var(--color-ink-2)] hover:text-[var(--color-ink)]"
                          title="Register contact in CRM as Client / Lead"
                        >
                          + Add to CRM
                        </button>
                      )}
                    </div>
                    {selectedChat.isGroup ? (
                      <p className="text-xs text-[var(--color-ink-2)]">Group Chat</p>
                    ) : contactTyping ? (
                      <p className="hl-badge hl-badge-success text-xs font-semibold animate-pulse">typing...</p>
                    ) : isContactOnline(selectedChat.id) ? (
                      <p className="hl-badge hl-badge-success text-xs font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] inline-block"></span> online
                      </p>
                    ) : (
                      <p className="text-xs text-[var(--color-ink-2)]">
                        {selectedChat.formattedPhone ||
                          formatPhoneNumber(selectedChat.phoneNumber || selectedChat.id) ||
                          (selectedChat.id?.includes("@lid") ? "WhatsApp Contact" : `+${selectedChat.id?.replace(/\D/g, "")}`)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2">
                  {/* Bot paused indicator — the bot mutes itself for 24h once an
                      agent replies by hand, so make that visible and undoable. */}
                  {botStatus?.paused && !selectedChat.isGroup && (
                    <div
                      className="hl-badge flex items-center gap-1.5 px-2.5 py-1.5"
                      title={
                        botStatus.pausedUntil
                          ? `Bot is quiet until ${new Date(botStatus.pausedUntil).toLocaleString()}`
                          : "Bot is switched off for this contact"
                      }
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-ink-2)] inline-block shrink-0" />
                      <span className="text-[11px] font-bold text-[var(--color-ink-2)] whitespace-nowrap">
                        {botStatus.assignedAgentName
                          ? `You have this chat (${botStatus.assignedAgentName})`
                          : "Bot paused"}
                      </span>
                      <button
                        onClick={handleResumeBot}
                        disabled={botResuming}
                        className="text-[11px] font-bold text-[var(--color-ink)] disabled:opacity-50 whitespace-nowrap"
                        title="Let the bot answer this contact again"
                      >
                        {botResuming ? "..." : "Let bot reply"}
                      </button>
                    </div>
                  )}

                  {/* Trigger Chatbot Flow Button */}
                  <button
                    onClick={() => setShowFlowModal(true)}
                    className="hl-badge hl-badge-warn flex items-center gap-1.5 px-2.5 py-1.5 transition text-xs font-semibold"
                    title="Launch an interactive Chatbot Flow for this contact"
                  >
                    <Zap size={14} />
                    <span className="hidden sm:inline">Flow Bot</span>
                  </button>

                  {/* Trigger CRM Automation Button */}
                  <button
                    onClick={() => {
                      fetchAutomations();
                      setShowAutomationModal(true);
                    }}
                    className="hl-badge hl-badge-info flex items-center gap-1.5 px-2.5 py-1.5 transition text-xs font-semibold"
                    title="Execute CRM Workflow Automation Rule"
                  >
                    <Sparkles size={14} />
                    <span className="hidden md:inline">Automation</span>
                  </button>

                  {/* Send Interactive Reminder Button */}
                  <button
                    onClick={() => setShowReminderModal(true)}
                    className="hl-badge hl-badge-warn flex items-center gap-1.5 px-2.5 py-1.5 transition text-xs font-semibold"
                    title="Send 2-Way Interactive Confirmation Notice"
                  >
                    <Bell size={14} />
                    <span className="hidden md:inline">Reminder</span>
                  </button>

                  {/* Add to Campaign Group Button */}
                  <button
                    onClick={() => {
                      fetchCampaignGroups();
                      setShowAddToGroupModal(true);
                    }}
                    className="hl-badge hl-badge-info flex items-center gap-1.5 px-2.5 py-1.5 transition text-xs font-semibold"
                    title="Enroll contact into Bulk Campaign Target Groups"
                  >
                    <Users size={14} />
                    <span className="hidden lg:inline">Campaigns</span>
                  </button>

                  {/* Template Picker Button */}
                  <button
                    onClick={() => setShowTemplatePicker((v) => !v)}
                    className="hl-badge hl-badge-success flex items-center gap-1.5 px-2.5 py-1.5 transition text-xs font-semibold"
                    title="Insert WhatsApp message template"
                  >
                    <FileText size={14} />
                    <span className="hidden sm:inline">Templates</span>
                  </button>

                  {/* CRM Info & Hub Drawer Toggle */}
                  <button
                    onClick={() => {
                      if (showContactInfoDrawer) {
                        setShowContactInfoDrawer(false);
                      } else {
                        setShowNotesDrawer(false);
                        fetchContactCrmDetails(selectedChat.id);
                        setShowContactInfoDrawer(true);
                      }
                    }}
                    className={`p-2 rounded-lg transition flex items-center gap-1.5 text-xs font-semibold ${
                      showContactInfoDrawer
                        ? "bg-[var(--color-paper)] text-[var(--color-ink)] border border-[var(--color-rule)] shadow-xs"
                        : "text-[var(--color-ink-2)] hover:text-[var(--color-ink)] hover:bg-[var(--color-paper)]"
                    }`}
                    title="Toggle Contact Profile, CRM Inquiries & Quick Links"
                  >
                    <Info size={17} />
                    <span className="hidden xl:inline">Contact CRM</span>
                  </button>
                </div>
              </div>

              {/* Shared Team Inbox Collaboration & Ticket Status Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-[var(--color-paper-2)] border-b border-[var(--color-rule)] text-xs shrink-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Ticket Status Selector */}
                  <div className="flex items-center gap-1">
                    <span className="hl-section-label text-[11px] font-bold text-[var(--color-ink-2)] uppercase tracking-wider">Status:</span>
                    {["open", "pending", "resolved", "spam"].map((st) => (
                      <button
                        key={st}
                        onClick={() => handleUpdateTicketStatus(st)}
                        className={`hl-badge px-2.5 py-0.5 text-[10px] font-extrabold uppercase transition ${
                          ticketStatus === st
                            ? st === "open"
                              ? "hl-badge-success"
                              : st === "pending"
                              ? "hl-badge-warn"
                              : st === "resolved"
                              ? "hl-badge-info"
                              : "hl-badge-error"
                            : ""
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>

                  {/* Agent Assignment Selector */}
                  <div className="flex items-center gap-1.5 ml-2 border-l border-[var(--color-rule)] pl-2">
                    <span className="text-[11px] font-bold text-[var(--color-ink-2)]">Agent:</span>
                    <select
                      value={assignedAgentName}
                      onChange={(e) => {
                        const sel = teamMembers.find((m) => `${m.first_name} ${m.last_name || ""}`.trim() === e.target.value);
                        handleAssignAgent(sel?.id || null, e.target.value);
                      }}
                      className="hl-select px-2 py-1 text-xs cursor-pointer"
                    >
                      <option value="">👤 Unassigned</option>
                      {teamMembers.map((m) => {
                        const name = `${m.first_name} ${m.last_name || ""}`.trim();
                        return (
                          <option key={m.id} value={name}>
                            👤 {name} ({m.emp_role || "Agent"})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Launch Chatbot Flow Button */}
                  <button
                    onClick={() => {
                      fetchFlows();
                      setShowFlowModal(true);
                    }}
                    className="hl-badge hl-badge-success flex items-center gap-1.5 px-2.5 py-1 font-bold text-[11px] transition"
                    title="Launch a smart chatbot flow for this customer"
                  >
                    <span>🤖 Launch Flow</span>
                  </button>

                  {/* Internal Team Notes Drawer Toggle */}
                  <button
                    onClick={() => {
                      if (showNotesDrawer) {
                        setShowNotesDrawer(false);
                      } else {
                        setShowContactInfoDrawer(false);
                        fetchInternalNotes(selectedChat.id);
                        setShowNotesDrawer(true);
                      }
                    }}
                    className={`hl-badge flex items-center gap-1.5 px-2.5 py-1 font-bold text-[11px] transition ${
                      showNotesDrawer ? "hl-badge-accent shadow-xs ring-1 ring-[var(--color-accent)]" : "hl-badge-warn"
                    }`}
                    title="Toggle Team Internal Collaboration Notes"
                  >
                    <span>📝 Team Notes</span>
                    {internalNotes.length > 0 && (
                      <span className="hl-badge hl-badge-accent px-1.5 py-0.2 font-extrabold text-[10px]">
                        {internalNotes.length}
                      </span>
                    )}
                  </button>

                  {/* Engine Badge */}
                  {status.isCloud ? (
                    <span className="hl-badge hl-badge-info hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-paper)] animate-pulse"></span>
                      <span>☁️ Meta Official API • {status.phone ? `+${status.phone}` : "Active"}</span>
                    </span>
                  ) : (
                    <span className="hl-badge hl-badge-success hidden lg:inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-paper)] animate-pulse"></span>
                      <span>📱 Web Linked • {status.phone ? `+${status.phone}` : "Active"}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Active Bot Flow Banner */}
              {activeFlowRun && (
                <div className="px-4 py-2 flex items-center justify-between z-20 shrink-0 bg-[var(--color-paper-2)] border-b border-[var(--color-rule)] animate-fadeIn">
                  <div className="flex items-center gap-2.5 text-xs min-w-0">
                    <span className="relative flex h-2.5 w-2.5 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-paper)] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--color-paper)]"></span>
                    </span>
                    <span className="font-bold text-[var(--color-ink)] shrink-0">🤖 Bot Flow Active:</span>
                    <span className="text-[var(--color-paper-2)] font-medium truncate">{activeFlowRun.flowName || "Automated Flow"}</span>
                    {activeFlowRun.currentNode && (
                      <span className="hl-badge shrink-0 hidden sm:inline">
                        Step: {activeFlowRun.currentNode}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setActiveFlowRun(null)}
                      className="hl-btn-danger-ghost px-2.5 py-1 text-[11px] font-bold transition flex items-center gap-1"
                      title="Stop this automated bot flow"
                    >
                      <Square size={11} fill="currentColor" /> Stop Bot
                    </button>
                  </div>
                </div>
              )}

              {/* Chat Thread Canvas with Parallax Doodle Background */}
              <div className="flex-1 min-h-0 relative flex flex-col overflow-hidden bg-[var(--color-paper-2)]">
                {/* Parallax WhatsApp Doodle Wallpaper Layer */}
                <div
                  ref={wallpaperRef}
                  className="absolute inset-0 pointer-events-none will-change-transform opacity-95 transition-transform duration-75 ease-out"
                  style={{
                    backgroundImage: CHAT_WALLPAPER,
                    backgroundRepeat: "repeat",
                    backgroundSize: "260px 260px",
                    transform: "translate3d(0, 0px, 0)",
                  }}
                />

                {/* Messages Thread Scroll Area (Independent Parallel Column Scroll) */}
                <div
                  ref={threadRef}
                  onScroll={handleThreadScroll}
                  className="relative z-10 flex-1 min-h-0 overflow-y-auto px-3 sm:px-6 py-4 overscroll-contain wa-parallel-scroll wa-custom-scrollbar scroll-smooth"
                >
                {messages.length >= msgLimit && (
                  <div className="flex justify-center mb-3">
                    <button
                      onClick={handleLoadMoreMessages}
                      disabled={loadingMore}
                      className="hl-btn-secondary px-4 py-1.5 bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-xs font-semibold text-[var(--color-ink-2)] rounded-full hover:bg-[var(--color-paper-2)] transition shadow flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {loadingMore ? <Loader2 size={13} className="animate-spin text-[var(--color-ink)]" /> : <RefreshCw size={13} />}
                      <span>Load older messages</span>
                    </button>
                  </div>
                )}
                {messagesLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 size={28} className="animate-spin text-[var(--color-ink)]" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-[var(--color-ink-2)] text-sm">
                    <MessageSquare size={44} className="mb-2 text-[var(--color-ink)] opacity-80" />
                    <p className="font-bold text-[var(--color-ink)] text-base">No message history yet</p>
                    <p className="text-xs text-[var(--color-ink-2)]">Send a message below to start chatting with {selectedChat.name}</p>
                  </div>
                ) : (
                  [...messages].reverse().map((msg, mIdx, ordered) => {
                    const prev = ordered[mIdx - 1];
                    const next = ordered[mIdx + 1];
                    // WhatsApp stacks a run of messages from the same sender:
                    // the tail sits only on the first bubble, the rest tuck in tight.
                    const startsRun = !prev || prev.isMe !== msg.isMe || !sameDay(prev.timestamp, msg.timestamp);
                    const endsRun = !next || next.isMe !== msg.isMe || !sameDay(next.timestamp, msg.timestamp);
                    const showDayDivider = !prev || !sameDay(prev.timestamp, msg.timestamp);

                    return (
                    <React.Fragment key={msg.id || msg.timestamp}>
                    {showDayDivider && (
                      <div className="wa-sticky-date-chip">
                        <span className="hl-badge px-3.5 py-1 text-[11px] font-bold tracking-wide uppercase bg-[var(--color-paper-2)]/95 backdrop-blur-md shadow-xs border border-[var(--color-rule)]">
                          {formatDayDivider(msg.timestamp)}
                        </span>
                      </div>
                    )}
                    <div
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({
                          x: Math.min(e.clientX, window.innerWidth - 230),
                          y: Math.min(e.clientY, window.innerHeight - 270),
                          message: msg,
                        });
                      }}
                      className={`flex ${msg.isMe ? "justify-end" : "justify-start"} group relative wa-bubble-enter ${endsRun ? "mb-2.5" : "mb-0.5"}`}
                    >
                      {/* Hover action toolbar for reactions & quote reply */}
                      <div className="hl-badge opacity-0 group-hover:opacity-100 transition flex items-center gap-1 px-2 py-0.5 absolute -top-3 z-10 select-none">
                        {["👍", "❤️", "😂", "😮", "🙏"].map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => handleReact(msg.id, emoji)}
                            className="hover:scale-125 transition text-xs p-0.5"
                            title={`React ${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}
                        <button
                          onClick={() => setReplyingTo(msg)}
                          className="text-[var(--color-ink-2)] hover:text-[var(--color-ink)] ml-1 text-xs px-1 hover:bg-[var(--color-paper-2)] rounded"
                          title="Quote reply"
                        >
                          ↩️
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            setContextMenu({
                              x: Math.min(rect.left, window.innerWidth - 230),
                              y: Math.min(rect.bottom + 5, window.innerHeight - 270),
                              message: msg,
                            });
                          }}
                          className="text-[var(--color-ink-2)] hover:text-[var(--color-ink)] ml-0.5 text-xs px-1 hover:bg-[var(--color-paper-2)] rounded"
                          title="More options"
                        >
                          <MoreVertical size={12} />
                        </button>
                      </div>

                      <div
                        className={`max-w-[75%] md:max-w-[65%] px-2.5 py-1.5 rounded-lg text-sm shadow-sm relative ${msg.isMe
                            ? `bg-[var(--color-accent-soft)] text-[var(--color-ink)] ${startsRun ? "rounded-tr-none" : ""}`
                            : `bg-[var(--color-paper-2)] text-[var(--color-ink)] border border-[var(--color-rule)] ${startsRun ? "rounded-tl-none" : ""}`
                          }`}
                      >
                        {/* Bubble tail — only on the first message of a run */}
                        {startsRun && (
                          <span
                            aria-hidden="true"
                            className={`absolute top-0 w-2 h-3 ${msg.isMe ? "-right-2" : "-left-2"}`}
                            style={{
                              backgroundColor: msg.isMe ? "var(--color-accent-soft)" : "var(--color-paper-2)",
                              clipPath: msg.isMe ? "polygon(0 0, 100% 0, 0 100%)" : "polygon(0 0, 100% 0, 100% 100%)",
                            }}
                          />
                        )}
                        {/* Quoted Message Preview in bubble */}
                        {msg.quotedMsg && (
                          <div className="mb-2 p-1.5 rounded-lg border-l-2 border-[var(--color-accent)] bg-[var(--color-paper)] text-xs text-[var(--color-ink-2)]">
                            <p className="hl-section-label">Quoted Message</p>
                            <p className="truncate text-[var(--color-ink)]">{msg.quotedMsg.body || "Attachment"}</p>
                          </div>
                        )}

                        {(() => {
                          const msgButtons = extractMessageButtons(msg);
                          const displayBody = getMessageDisplayBody(msg, msgButtons);
                          return (
                            <>
                              {msg.location ? (
                                <a
                                  href={`https://www.google.com/maps?q=${msg.location.lat},${msg.location.lng}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-2 underline font-semibold text-[var(--color-ink)]"
                                >
                                  <MapPin size={14} /> {msg.location.name || "Shared location"}
                                </a>
                              ) : (msg.hasMedia || msg.type === "image" || msg.type === "video" || msg.type === "audio" || msg.type === "ptt" || msg.type === "document" || msg.type === "sticker" || isFilename(msg.body) || isFilename(msg.filename)) ? (
                                <div className="space-y-1">
                                  <MediaBubble
                                    chatId={selectedChat.id}
                                    messageId={msg.id}
                                    filename={msg.filename || msg.body}
                                    isMe={msg.isMe}
                                    onPreview={(src, title) => openLightbox({ src, title })}
                                  />
                                  {msg.body && !isFilename(msg.body) && !msg.body.startsWith("http") ? (
                                    <p className="whitespace-pre-wrap break-words">{displayBody || msg.body}</p>
                                  ) : null}
                                </div>
                              ) : (
                                <RichMessageContent
                                  text={displayBody || previewText(msg) || (msg.isMe ? "Sent message" : "Incoming message")}
                                  isMe={msg.isMe}
                                />
                              )}

                              {/* Reaction badges on bubble */}
                              {Array.isArray(msg.reactions) && msg.reactions.length > 0 && (
                                <div className="flex gap-1 mt-1 -mb-1">
                                  {msg.reactions.map((r, rIdx) => (
                                    <span key={rIdx} className="hl-badge px-1.5 py-0.2 text-[11px]">
                                      {r.emoji}
                                    </span>
                                  ))}
                                </div>
                              )}

                              <div className="hl-id flex items-center justify-end gap-1 -mt-0.5 -mb-0.5 font-normal leading-none pt-1">
                                <span>
                                  {msg.timestamp
                                    ? new Date(msg.timestamp * 1000).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                    : ""}
                                </span>
                                {starredMsgIds.has(msg.id) && (
                                  <Star size={10} className="text-[var(--color-focus)] fill-[var(--color-focus)] inline" />
                                )}
                                {msg.isMe && <MessageTicks status={msg.status || "sent"} />}
                              </div>

                              {/* WhatsApp Authentic Full-Width Action Buttons (Call Now / Apply Now / Quick Replies) */}
                              {msgButtons && msgButtons.length > 0 && (
                                <div className="mt-2 -mx-2.5 -mb-1.5 border-t border-[var(--color-rule)] divide-y divide-[var(--color-rule)] overflow-hidden rounded-b-lg select-none bg-[var(--color-paper)]">
                                  {msgButtons.map((btn, bIdx) => (
                                    <button
                                      key={bIdx}
                                      type="button"
                                      onClick={() => {
                                        if (btn.type === "url" && btn.url) {
                                          window.open(btn.url, "_blank", "noopener,noreferrer");
                                        } else if (btn.type === "call" && btn.phone) {
                                          window.location.href = `tel:${btn.phone.replace(/\s+/g, "")}`;
                                        } else {
                                          handleSendDirect(btn.title || btn.text || btn);
                                        }
                                      }}
                                      className="w-full py-2.5 px-3 flex items-center justify-center gap-2 text-xs font-semibold text-[var(--color-ink)] hover:bg-[var(--color-paper-2)] active:bg-[var(--color-paper-2)] transition-colors text-center group/btn"
                                      title={btn.type === "call" ? `Call ${btn.phone || ""}` : btn.type === "url" ? `Open link ${btn.url || ""}` : `Send "${btn.title || btn.text || btn}"`}
                                    >
                                      {btn.type === "call" ? (
                                        <Phone size={14} className="text-[var(--color-ink)] shrink-0" />
                                      ) : btn.type === "url" ? (
                                        <ExternalLink size={14} className="text-[var(--color-ink)] shrink-0" />
                                      ) : (
                                        <CornerDownLeft size={14} className="text-[var(--color-ink)] shrink-0" />
                                      )}
                                      <span className="truncate group-hover/btn:underline">{btn.title || btn.text || btn}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    </React.Fragment>
                    );
                  })
                )}
                {contactTyping && <TypingIndicator />}
                <div ref={messagesEndRef} />
              </div>

              {/* Jump to latest floating pill with badge & smooth spring transition */}
              <div
                className={`absolute bottom-4 right-4 sm:right-6 z-30 transition-all duration-300 transform ${
                  isScrolledUp ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-90 pointer-events-none"
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    scrollToBottom(true);
                    setUnreadWhileScrolled(0);
                  }}
                  className="hl-btn-secondary relative w-10 h-10 rounded-full hover:scale-105 active:scale-95 transition flex items-center justify-center group"
                  title="Jump to latest messages"
                >
                  <ChevronDown size={20} className="group-hover:translate-y-0.5 transition-transform text-[var(--color-ink-2)]" />
                  {unreadWhileScrolled > 0 && (
                    <span className="hl-badge hl-badge-accent absolute -top-1.5 -right-1.5 text-[10px] font-extrabold px-1.5 py-0.5 min-w-[18px] text-center animate-pulse">
                      {unreadWhileScrolled}
                    </span>
                  )}
                </button>
              </div>
            </div>

              {/* Quote Reply Banner above composer */}
              {replyingTo && (
                <div className="px-4 py-2 bg-[var(--color-paper-2)] border-t border-[var(--color-rule)] flex items-center justify-between text-xs text-[var(--color-ink-2)] shrink-0">
                  <div className="border-l-2 border-[var(--color-accent)] pl-2 truncate">
                    <span className="font-bold text-[var(--color-ink)]">Replying to {replyingTo.isMe ? "You" : selectedChat.name}:</span>{" "}
                    <span className="text-[var(--color-ink-2)]">{replyingTo.body?.slice(0, 80) || "Attachment"}</span>
                  </div>
                  <button onClick={() => setReplyingTo(null)} className="text-[var(--color-ink-2)] hover:text-[var(--color-ink)] p-1">
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Dynamic Quick Reply Speed Bar (1-Click CRM Macros) */}
              <div className="wa-speed-bar wa-custom-scrollbar shrink-0 select-none">
                <span className="text-[10px] font-bold text-[var(--color-ink-2)] uppercase tracking-wider shrink-0 flex items-center gap-1 mr-1">
                  <Zap size={11} className="text-[var(--color-accent)]" /> Quick:
                </span>
                {DEFAULT_SPEED_REPLIES.map((macro) => (
                  <button
                    key={macro.id}
                    type="button"
                    onClick={() => {
                      const name = selectedChat?.name && !selectedChat.name.startsWith("+") ? selectedChat.name : "";
                      const phone = selectedChat?.phone || selectedChat?.id?.replace(/@.*$/, "") || "";
                      const filled = evaluateMessagePlaceholders(macro.text, {
                        name: name || "Customer",
                        first_name: name ? name.split(" ")[0] : "Customer",
                        phone: phone,
                      });
                      setMessageInput(filled);
                      if (textareaRef.current) {
                        textareaRef.current.focus();
                      }
                    }}
                    className="wa-speed-chip hover:shadow-xs"
                    title={macro.text}
                  >
                    <span>{macro.label}</span>
                  </button>
                ))}
                {quickReplies.length > 0 && quickReplies.slice(0, 6).map((qr) => (
                  <button
                    key={qr.id}
                    type="button"
                    onClick={() => {
                      const name = selectedChat?.name && !selectedChat.name.startsWith("+") ? selectedChat.name : "";
                      const phone = selectedChat?.phone || selectedChat?.id?.replace(/@.*$/, "") || "";
                      const filled = evaluateMessagePlaceholders(qr.content || "", {
                        name: name || "Customer",
                        first_name: name ? name.split(" ")[0] : "Customer",
                        phone: phone,
                      });
                      setMessageInput(filled);
                      if (textareaRef.current) {
                        textareaRef.current.focus();
                      }
                    }}
                    className="wa-speed-chip bg-[var(--color-paper-2)] border-dashed hover:border-solid"
                    title={qr.content}
                  >
                    <span>/{qr.shortcut || qr.title}</span>
                  </button>
                ))}
              </div>

              {/* Input Area & Tool Suite */}
              <div className="relative flex items-center gap-2 p-3 border-t border-[var(--color-rule)] bg-[var(--color-paper-2)] shrink-0">
                {/* Hidden File Inputs for Different Media Types */}
                <input
                  id="wa-doc-upload-input"
                  type="file"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.zip,.rar,.7z,.md,.json"
                  className="hidden"
                  onChange={(e) => handleAttachMedia(e, "document")}
                  disabled={mediaSending}
                />
                <input
                  id="wa-excel-upload-input"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => handleAttachMedia(e, "document")}
                  disabled={mediaSending}
                />
                <input
                  id="wa-media-upload-input"
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(e) => handleAttachMedia(e, "media")}
                  disabled={mediaSending}
                />
                <input
                  id="wa-audio-upload-input"
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => handleAttachMedia(e, "audio")}
                  disabled={mediaSending}
                />

                {/* Floating Attachment & Action Popover Menu / Mobile Bottom Sheet */}
                {showAttachMenu && (
                  <>
                    <div
                      className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-xs"
                      onClick={() => setShowAttachMenu(false)}
                    />
                    <div className="hl-card fixed inset-x-0 bottom-0 z-50 md:absolute md:inset-x-auto md:bottom-full md:left-3 md:mb-3 md:w-72 p-3 md:p-2 wa-bottom-sheet max-h-[75vh] overflow-y-auto">
                      <div className="wa-swipe-indicator md:hidden" />
                      <div className="px-3 py-2 border-b border-[var(--color-rule)] flex items-center justify-between text-xs font-bold text-[var(--color-ink)]">
                        <span className="flex items-center gap-1.5"><Paperclip size={14} /> Share Media & Quick Tools</span>
                        <button onClick={() => setShowAttachMenu(false)} className="text-[var(--color-ink-2)] hover:text-[var(--color-ink)] p-1">
                          <X size={16} />
                        </button>
                      </div>

                    <div className="p-1.5 space-y-1">
                      {/* Document / PDF */}
                      <button
                        onClick={() => {
                          setShowAttachMenu(false);
                          document.getElementById("wa-doc-upload-input")?.click();
                        }}
                        className="w-full text-left flex items-center gap-3 p-2.5 hover:bg-[var(--color-paper)] rounded-xl transition text-xs font-medium text-[var(--color-ink)] group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-[var(--color-paper)] border border-[var(--color-rule)] text-[var(--color-ink)] flex items-center justify-center group-hover:scale-105 transition">
                          <FileText size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[var(--color-ink)] group-hover:text-[var(--color-error)]">PDF & Document</p>
                          <p className="text-[10px] text-[var(--color-ink-2)] truncate">.pdf, .doc, .docx, .txt, .zip</p>
                        </div>
                      </button>

                      {/* Excel / Spreadsheet */}
                      <button
                        onClick={() => {
                          setShowAttachMenu(false);
                          document.getElementById("wa-excel-upload-input")?.click();
                        }}
                        className="w-full text-left flex items-center gap-3 p-2.5 hover:bg-[var(--color-paper)] rounded-xl transition text-xs font-medium text-[var(--color-ink)] group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-[var(--color-paper)] border border-[var(--color-rule)] text-[var(--color-ink)] flex items-center justify-center group-hover:scale-105 transition">
                          <Database size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[var(--color-ink)] group-hover:text-[var(--color-ink)]">Excel / Spreadsheet</p>
                          <p className="text-[10px] text-[var(--color-ink-2)] truncate">.xlsx, .xls, .csv spreadsheets</p>
                        </div>
                      </button>

                      {/* Photos & Videos */}
                      <button
                        onClick={() => {
                          setShowAttachMenu(false);
                          document.getElementById("wa-media-upload-input")?.click();
                        }}
                        className="w-full text-left flex items-center gap-3 p-2.5 hover:bg-[var(--color-paper)] rounded-xl transition text-xs font-medium text-[var(--color-ink)] group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-[var(--color-paper)] border border-[var(--color-rule)] text-[var(--color-ink)] flex items-center justify-center group-hover:scale-105 transition">
                          <Image size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[var(--color-ink)] group-hover:text-[var(--color-ink)]">Photos & Videos</p>
                          <p className="text-[10px] text-[var(--color-ink-2)] truncate">Images (.png, .jpg), Videos (.mp4)</p>
                        </div>
                      </button>

                      {/* Audio / Voice Note */}
                      <button
                        onClick={() => {
                          setShowAttachMenu(false);
                          document.getElementById("wa-audio-upload-input")?.click();
                        }}
                        className="w-full text-left flex items-center gap-3 p-2.5 hover:bg-[var(--color-paper)] rounded-xl transition text-xs font-medium text-[var(--color-ink)] group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-[var(--color-paper)] border border-[var(--color-rule)] text-[var(--color-ink)] flex items-center justify-center group-hover:scale-105 transition">
                          <Music size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[var(--color-ink)] group-hover:text-[var(--color-ink)]">Audio / Voice</p>
                          <p className="text-[10px] text-[var(--color-ink-2)] truncate">.mp3, .ogg, .wav audio files</p>
                        </div>
                      </button>

                      {/* Trigger Chatbot Flow */}
                      <button
                        onClick={() => {
                          setShowAttachMenu(false);
                          setShowFlowModal(true);
                        }}
                        className="w-full text-left flex items-center gap-3 p-2.5 hover:bg-[var(--color-paper)] rounded-xl transition text-xs font-medium text-[var(--color-ink)] group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-[var(--color-paper)] border border-[var(--color-rule)] text-[var(--color-ink)] flex items-center justify-center group-hover:scale-105 transition">
                          <Zap size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[var(--color-ink)] group-hover:text-[var(--color-ink)]">Trigger Chatbot Flow</p>
                          <p className="text-[10px] text-[var(--color-ink-2)] truncate">Automated customer flow & bot reply</p>
                        </div>
                      </button>

                      {/* Trigger CRM Automation */}
                      <button
                        onClick={() => {
                          setShowAttachMenu(false);
                          fetchAutomations();
                          setShowAutomationModal(true);
                        }}
                        className="w-full text-left flex items-center gap-3 p-2.5 hover:bg-[var(--color-paper)] rounded-xl transition text-xs font-medium text-[var(--color-ink)] group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-[var(--color-paper)] border border-[var(--color-rule)] text-[var(--color-ink)] flex items-center justify-center group-hover:scale-105 transition">
                          <Sparkles size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[var(--color-ink)] group-hover:text-[var(--color-ink)]">Trigger CRM Automation</p>
                          <p className="text-[10px] text-[var(--color-ink-2)] truncate">Run automated invoice, receipt, or welcome rule</p>
                        </div>
                      </button>

                      {/* Send Interactive Reminder */}
                      <button
                        onClick={() => {
                          setShowAttachMenu(false);
                          setShowReminderModal(true);
                        }}
                        className="w-full text-left flex items-center gap-3 p-2.5 hover:bg-[var(--color-paper)] rounded-xl transition text-xs font-medium text-[var(--color-ink)] group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-[var(--color-paper)] border border-[var(--color-rule)] text-[var(--color-ink)] flex items-center justify-center group-hover:scale-105 transition">
                          <Bell size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[var(--color-ink)] group-hover:text-[var(--color-ink)]">Send Interactive Reminder</p>
                          <p className="text-[10px] text-[var(--color-ink-2)] truncate">2-way buttons: Confirm, Reschedule, Call</p>
                        </div>
                      </button>

                      {/* Enroll in Campaign Group */}
                      <button
                        onClick={() => {
                          setShowAttachMenu(false);
                          fetchCampaignGroups();
                          setShowAddToGroupModal(true);
                        }}
                        className="w-full text-left flex items-center gap-3 p-2.5 hover:bg-[var(--color-paper)] rounded-xl transition text-xs font-medium text-[var(--color-ink)] group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-[var(--color-paper)] border border-[var(--color-rule)] text-[var(--color-ink)] flex items-center justify-center group-hover:scale-105 transition">
                          <Users size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[var(--color-ink)] group-hover:text-[var(--color-ink)]">Enroll in Campaign Group</p>
                          <p className="text-[10px] text-[var(--color-ink-2)] truncate">Add contact to bulk campaign target audience</p>
                        </div>
                      </button>

                      {/* Send Inquiry Options Menu */}
                      <button
                        onClick={() => {
                          setShowAttachMenu(false);
                          setShowOptionsModal(true);
                        }}
                        className="w-full text-left flex items-center gap-3 p-2.5 hover:bg-[var(--color-paper)] rounded-xl transition text-xs font-medium text-[var(--color-ink)] group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-[var(--color-paper)] border border-[var(--color-rule)] text-[var(--color-ink)] flex items-center justify-center group-hover:scale-105 transition">
                          <ListOrdered size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[var(--color-ink)] group-hover:text-[var(--color-ink)]">Send Options / Inquiry Menu</p>
                          <p className="text-[10px] text-[var(--color-ink-2)] truncate">Numbered inquiry buttons & quick replies</p>
                        </div>
                      </button>

                      {/* Insert Template */}
                      <button
                        onClick={() => {
                          setShowAttachMenu(false);
                          setShowTemplatePicker(true);
                        }}
                        className="w-full text-left flex items-center gap-3 p-2.5 hover:bg-[var(--color-paper)] rounded-xl transition text-xs font-medium text-[var(--color-ink)] group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-[var(--color-paper)] border border-[var(--color-rule)] text-[var(--color-ink)] flex items-center justify-center group-hover:scale-105 transition">
                          <FileText size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[var(--color-ink)] group-hover:text-[var(--color-ink)]">Approved Template</p>
                          <p className="text-[10px] text-[var(--color-ink-2)] truncate">Insert WhatsApp formatted template</p>
                        </div>
                      </button>

                      {/* Request WhatsApp Payment */}
                      <button
                        onClick={() => {
                          setShowAttachMenu(false);
                          setShowPaymentModal(true);
                        }}
                        className="w-full text-left flex items-center gap-3 p-2.5 hover:bg-[var(--color-paper)] rounded-xl transition text-xs font-medium text-[var(--color-ink)] group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-[var(--color-paper)] border border-[var(--color-rule)] text-[var(--color-ink)] flex items-center justify-center group-hover:scale-105 transition">
                          <CreditCard size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[var(--color-ink)] group-hover:text-[var(--color-ink)]">Request WhatsApp Payment</p>
                          <p className="text-[10px] text-[var(--color-ink-2)] truncate">Generate 0% markup UPI / payment link</p>
                        </div>
                      </button>

                      {/* Enroll in Drip Sequence */}
                      <button
                        onClick={() => {
                          setShowAttachMenu(false);
                          fetchDripSequences();
                          setShowDripModal(true);
                        }}
                        className="w-full text-left flex items-center gap-3 p-2.5 hover:bg-[var(--color-paper)] rounded-xl transition text-xs font-medium text-[var(--color-ink)] group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-[var(--color-paper)] border border-[var(--color-rule)] text-[var(--color-ink)] flex items-center justify-center group-hover:scale-105 transition">
                          <Sparkles size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[var(--color-ink)] group-hover:text-[var(--color-ink)]">Enroll in Drip Sequence</p>
                          <p className="text-[10px] text-[var(--color-ink-2)] truncate">Automated multi-day lead nurturing</p>
                        </div>
                      </button>

                      {/* Share Location */}
                      <button
                        onClick={() => {
                          setShowAttachMenu(false);
                          handleShareLocation();
                        }}
                        disabled={locationSending}
                        className="w-full text-left flex items-center gap-3 p-2.5 hover:bg-[var(--color-paper)] rounded-xl transition text-xs font-medium text-[var(--color-ink)] group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-[var(--color-paper)] border border-[var(--color-rule)] text-[var(--color-ink)] flex items-center justify-center group-hover:scale-105 transition">
                          <Navigation size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[var(--color-ink)] group-hover:text-[var(--color-error)]">Share GPS Location</p>
                          <p className="text-[10px] text-[var(--color-ink-2)] truncate">Send current office / live coordinates</p>
                        </div>
                      </button>
                    </div>
                  </div>
                  </>
                )}

                {/* Slash commands quick-replies popup */}
                {messageInput.startsWith("/") && (
                  <div className="hl-card absolute bottom-full left-3 mb-2 w-80 max-h-60 overflow-y-auto z-30 p-2 space-y-1">
                    <div className="hl-section-label px-2 py-1 text-[10px] uppercase font-bold text-[var(--color-ink)]">Quick Replies (Click to insert)</div>
                    {quickReplies
                      .filter((qr) => qr.shortcut?.toLowerCase().includes(messageInput.slice(1).toLowerCase()) || qr.title?.toLowerCase().includes(messageInput.slice(1).toLowerCase()))
                      .map((qr) => (
                        <div
                          key={qr.id}
                          onClick={() => {
                            const name = selectedChat?.name && !selectedChat.name.startsWith("+") ? selectedChat.name : "";
                            const phone = selectedChat?.phone || selectedChat?.id?.replace(/@.*$/, "") || "";
                            const filled = evaluateMessagePlaceholders(qr.content || "", {
                              name: name || "Customer",
                              first_name: name ? name.split(" ")[0] : "Customer",
                              phone: phone,
                            });
                            setMessageInput(filled);
                          }}
                          className="p-2 hover:bg-[var(--color-paper)] rounded-xl cursor-pointer transition"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-[var(--color-ink)]">/{qr.shortcut}</span>
                            <span className="text-[10px] text-[var(--color-ink-2)] font-semibold">{qr.title}</span>
                          </div>
                          <p className="text-[11px] text-[var(--color-ink-2)] truncate mt-0.5">{qr.content}</p>
                        </div>
                      ))}
                  </div>
                )}

                {/* Message Template Picker Modal Popup */}
                {showTemplatePicker && (
                  <div className="hl-card absolute bottom-full left-3 mb-2 max-h-80 overflow-y-auto z-30">
                    <div className="px-3 py-2 bg-[var(--color-paper-2)] border-b border-[var(--color-rule)] text-xs font-bold text-[var(--color-ink)] flex items-center justify-between">
                      <span>Insert Message Template</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setShowTemplatePicker(false); setShowCreateTemplateModal(true); }}
                          className="text-[10px] font-bold text-[var(--color-ink)] hover:underline"
                        >
                          + Create Template
                        </button>
                        <button onClick={() => setShowTemplatePicker(false)} className="text-[var(--color-ink-2)] hover:text-[var(--color-ink)]">
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                    {templates.length === 0 ? (
                      <div className="hl-empty p-4 text-xs text-[var(--color-ink-2)] text-center space-y-2">
                        <p>No templates loaded yet</p>
                        <div className="flex justify-center gap-2 pt-1">
                          <button
                            onClick={handleSeedTemplates}
                            disabled={tmplLoading}
                            className="hl-btn-primary px-3 py-1 bg-[var(--color-ink)] text-[var(--color-paper-2)] rounded text-xs font-bold hover:bg-[var(--color-ink)]"
                          >
                            {tmplLoading ? "Seeding..." : "Seed 8 Default Templates"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="divide-y divide-[var(--color-rule)]">
                        <div className="hl-id p-2 flex justify-between items-center bg-[var(--color-paper-2)] border-t border-[var(--color-rule)]">
                          <span className="text-[var(--color-ink-2)]">{templates.length} templates available</span>
                          <button onClick={() => { setShowTemplatePicker(false); setShowCreateTemplateModal(true); }} className="text-[var(--color-ink)] font-bold hover:underline">
                            + New Template
                          </button>
                        </div>
                        {templates.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => insertTemplate(t)}
                            className="w-full text-left px-3 py-2.5 hover:bg-[var(--color-paper)] transition group text-[var(--color-ink)]"
                          >
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-bold text-[var(--color-ink)] group-hover:text-[var(--color-ink)]">{t.name}</p>
                              {t.category && (
                                <span className="hl-badge px-1.5 py-0.2">
                                  {t.category}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[var(--color-ink-2)] truncate mt-0.5">{t.body}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Paperclip Button (Opens Attachments & Quick Tools) */}
                <button
                  type="button"
                  onClick={() => setShowAttachMenu((v) => !v)}
                  className={`hl-btn-secondary p-2.5 rounded-full transition shrink-0 ${showAttachMenu ? "bg-[var(--color-accent)] text-[var(--color-accent-ink)] border-[var(--color-accent)]" : ""}`}
                  title="Share document, photo, video, audio, trigger flows or inquiry menu"
                >
                  {mediaSending ? <Loader2 size={18} className="animate-spin text-[var(--color-ink)]" /> : <Paperclip size={18} />}
                </button>

                {/* Templates Quick Button */}
                <button
                  type="button"
                  onClick={() => setShowTemplatePicker((v) => !v)}
                  className="hl-btn-secondary p-2.5 text-[var(--color-ink-2)] hover:text-[var(--color-ink)] hover:bg-[var(--color-paper-2)] rounded-full transition shrink-0"
                  title="Insert a saved template"
                >
                  <FileText size={18} />
                </button>

                {/* Quick Flow Trigger Button */}
                <button
                  type="button"
                  onClick={() => setShowFlowModal(true)}
                  className="hl-btn-secondary p-2.5 text-[var(--color-ink)] hover:text-[var(--color-ink)] hover:bg-[var(--color-paper-2)] rounded-full transition shrink-0"
                  title="Trigger Chatbot Flow"
                >
                  <Zap size={18} />
                </button>

                {/* Quick Interactive Buttons & Flow Menu */}
                <button
                  type="button"
                  onClick={() => setShowOptionsModal(true)}
                  className="hl-btn-secondary p-2.5 text-[var(--color-ink)] hover:text-[var(--color-ink)] hover:bg-[var(--color-paper-2)] rounded-full transition shrink-0"
                  title="Send WhatsApp Interactive Buttons & Flow Menu (Call, Links, Quick Replies)"
                >
                  <ListOrdered size={18} />
                </button>

                {/* Emoji Picker Button */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker((v) => !v)}
                    className={`hl-btn-secondary p-2 rounded-full transition ${showEmojiPicker ? "bg-[var(--color-accent)] text-[var(--color-accent-ink)] border-[var(--color-accent)]" : ""}`}
                    title="Emoji"
                  >
                    <Smile size={21} />
                  </button>

                  {showEmojiPicker && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setShowEmojiPicker(false)} />
                      <div className="hl-card absolute bottom-12 left-0 z-40 w-80 max-h-72 flex flex-col p-2.5">
                        {/* Search Bar in Emoji Picker */}
                        <div className="mb-2 relative">
                          <Search size={13} className="absolute left-2.5 top-2 text-[var(--color-ink-2)]" />
                          <input
                            type="text"
                            placeholder="Search emojis..."
                            value={emojiSearch}
                            onChange={(e) => setEmojiSearch(e.target.value)}
                            className="hl-input w-full pl-8 pr-7 py-1 text-xs"
                          />
                          {emojiSearch && (
                            <button onClick={() => setEmojiSearch("")} className="absolute right-2 top-1.5 text-[var(--color-ink-2)] hover:text-[var(--color-ink)]">
                              <X size={12} />
                            </button>
                          )}
                        </div>

                        <div className="flex-1 overflow-y-auto wa-custom-scrollbar pr-1">
                          {/* Recently Used Emojis */}
                          {!emojiSearch && recentEmojis.length > 0 && (
                            <div className="mb-2">
                              <div className="hl-section-label text-[10px] font-bold uppercase text-[var(--color-ink)] px-1 mb-1">Recent</div>
                              <div className="grid grid-cols-8 gap-0.5">
                                {recentEmojis.map((emo) => (
                                  <button
                                    key={emo}
                                    type="button"
                                    onClick={() => {
                                      setMessageInput((prev) => prev + emo);
                                      addRecentEmoji(emo);
                                    }}
                                    className="text-lg leading-none p-1 rounded hover:bg-[var(--color-paper)] active:scale-90 transition text-[var(--color-ink)]"
                                  >
                                    {emo}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {EMOJI_GROUPS.map((group) => {
                            const filtered = emojiSearch
                              ? group.emojis.filter((e) => group.label.toLowerCase().includes(emojiSearch.toLowerCase()))
                              : group.emojis;
                            if (filtered.length === 0) return null;
                            return (
                              <div key={group.label} className="mb-2 last:mb-0">
                                <div className="hl-section-label text-[10px] font-bold uppercase text-[var(--color-ink-2)] px-1 mb-1">{group.label}</div>
                                <div className="grid grid-cols-8 gap-0.5">
                                  {filtered.map((emo) => (
                                    <button
                                      key={emo}
                                      type="button"
                                      onClick={() => {
                                        setMessageInput((prev) => prev + emo);
                                        addRecentEmoji(emo);
                                      }}
                                      className="text-lg leading-none p-1 rounded hover:bg-[var(--color-paper)] active:scale-90 transition text-[var(--color-ink)]"
                                    >
                                      {emo}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Message Input Box — replaced by the recording bar while recording */}
                {recording ? (
                  <div className="hl-card flex-1 flex items-center gap-3 px-4 py-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-error)] animate-pulse shrink-0" />
                    <span className="hl-id text-sm tabular-nums">
                      {String(Math.floor(recordSecs / 60)).padStart(2, "0")}:{String(recordSecs % 60).padStart(2, "0")}
                    </span>
                    <span className="text-xs text-[var(--color-ink-2)] truncate">Recording voice note…</span>
                    <button
                      type="button"
                      onClick={() => stopRecording(true)}
                      className="hl-btn-danger-ghost ml-auto text-xs font-bold px-2 py-1 shrink-0"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={messageInput}
                    onChange={(e) => {
                      setMessageInput(e.target.value);
                      e.target.style.height = "auto";
                      e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={`Message ${selectedChat.name}... (Type / for quick replies, Shift+Enter for new line)`}
                    className="hl-input flex-1 px-4 py-2 rounded-2xl text-sm wa-auto-textarea leading-relaxed max-h-32 transition-[height] duration-75"
                    disabled={sending}
                  />
                )}

                {/* Mic when there's nothing to send, Send arrow once you type — like WhatsApp */}
                {messageInput.trim() || sending ? (
                  <button
                    onClick={handleSend}
                    disabled={!messageInput.trim() || sending}
                    className="hl-btn-primary p-2.5 rounded-full font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Send"
                  >
                    {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                  </button>
                ) : (
                  <button
                    onClick={() => (recording ? stopRecording(false) : startRecording())}
                    disabled={mediaSending}
                    className={`hl-btn-primary p-2.5 rounded-full transition disabled:opacity-50 ${recording
                        ? "hl-btn-danger-ghost"
                        : ""
                      }`}
                    title={recording ? "Send voice note" : "Record voice note"}
                  >
                    {mediaSending ? <Loader2 size={18} className="animate-spin" /> : recording ? <Send size={18} /> : <Mic size={18} />}
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Desktop Docked 3rd Parallel Column: Contact CRM Profile or Team Notes */}
        {selectedChat && (showContactInfoDrawer || showNotesDrawer) && (
          <aside className="hidden xl:flex w-88 xl:w-96 shrink-0 h-full border-l border-[var(--color-rule)] bg-[var(--color-paper-2)] flex-col min-h-0 wa-parallel-pane overflow-hidden animate-fadeIn">
            {showContactInfoDrawer && renderContactInfoContent(true)}
            {showNotesDrawer && renderNotesContent(true)}
          </aside>
        )}
      </div>

      {/* New Direct Chat & CRM Contact Picker Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setShowNewChatModal(false)}>
          <div className="hl-card w-full max-w-md p-6 relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowNewChatModal(false)} className="absolute top-4 right-4 text-[var(--color-ink-2)] hover:text-[var(--color-ink)]">
              <X size={20} />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-[var(--color-paper)] border border-[var(--color-rule)] text-[var(--color-ink)]">
                <UserPlus size={24} />
              </div>
              <div>
                <h3 className="hl-title">Start New WhatsApp Chat</h3>
                <p className="text-xs text-[var(--color-ink-2)]">Enter a phone number to start a new chat directly</p>
              </div>
            </div>

            <form onSubmit={handleStartNewChat} className="space-y-4">
              <div>
                <label className="hl-section-label block text-xs font-semibold text-[var(--color-ink-2)] uppercase mb-1">Mobile Number *</label>
                <div className="flex items-center gap-2">
                  <span className="hl-input px-3 py-2 text-sm font-semibold">+91</span>
                  <input
                    type="text"
                    placeholder="e.g. 9876543210"
                    value={newChatPhone}
                    onChange={(e) => setNewChatPhone(e.target.value)}
                    className="hl-input flex-1 px-3.5 py-2 text-sm"
                    required
                  />
                </div>
                <p className="text-[11px] text-[var(--color-ink-2)] mt-1">Enter 10-digit mobile number</p>
              </div>

              <div>
                <label className="hl-section-label block text-xs font-semibold text-[var(--color-ink-2)] uppercase mb-1">Contact Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={newChatName}
                  onChange={(e) => setNewChatName(e.target.value)}
                  className="hl-input w-full px-3.5 py-2 text-sm"
                />
              </div>

              <div>
                <label className="hl-section-label block text-xs font-semibold text-[var(--color-ink-2)] uppercase mb-1">First Message (Optional)</label>
                <textarea
                  rows={3}
                  placeholder="Hello! Welcome to Madhura Tech..."
                  value={newChatMessage}
                  onChange={(e) => setNewChatMessage(e.target.value)}
                  className="hl-input w-full px-3.5 py-2 text-sm resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowNewChatModal(false)} className="hl-btn-secondary px-4 py-2 border rounded-lg text-xs text-[var(--color-ink-2)] hover:bg-[var(--color-paper-2)]">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={newChatLoading || !newChatPhone.trim()}
                  className="hl-btn-primary px-5 py-2 bg-[var(--color-ink)] text-[var(--color-paper-2)] rounded-lg text-xs font-bold hover:bg-[var(--color-ink)] flex items-center gap-2 shadow-md disabled:opacity-50"
                >
                  {newChatLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  <span>Start Chat & Send</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Slide-over Contact Profile Drawer (Mobile & Tablet) */}
      {showContactInfoDrawer && selectedChat && (
        <div className="xl:hidden fixed inset-0 bg-black/40 z-50 flex justify-end backdrop-blur-sm animate-fadeIn" onClick={() => setShowContactInfoDrawer(false)}>
          <div className="hl-card w-full max-w-sm h-full overflow-hidden relative shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {renderContactInfoContent(false)}
          </div>
        </div>
      )}

      {/* Trigger Chatbot Flow Modal */}
      {showFlowModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setShowFlowModal(false)}>
          <div className="hl-card w-full max-w-lg p-6 relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowFlowModal(false)} className="absolute top-4 right-4 text-[var(--color-ink-2)] hover:text-[var(--color-ink)]">
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-4 border-b border-[var(--color-rule)] pb-3">
              <div className="p-3 rounded-xl bg-[var(--color-paper)] border border-[var(--color-rule)] text-[var(--color-ink)]">
                <Zap size={24} />
              </div>
              <div>
                <h3 className="hl-title">Trigger Chatbot Flow</h3>
                <p className="text-xs text-[var(--color-ink-2)]">Launch an automated multi-step chatbot flow for <span className="text-[var(--color-ink)] font-semibold">{selectedChat?.name}</span></p>
              </div>
            </div>

            {flowsLoading ? (
              <div className="py-12 text-center">
                <Loader2 size={32} className="animate-spin text-[var(--color-ink)] mx-auto mb-3" />
                <p className="text-xs text-[var(--color-ink-2)]">Loading chatbot flows...</p>
              </div>
            ) : flows.length === 0 ? (
              <div className="hl-empty p-6 text-center text-xs text-[var(--color-ink-2)] space-y-3">
                <p>No Chatbot Flows created yet.</p>
                <button
                  onClick={() => navigate("/whatsapp/flows")}
                  className="hl-btn-primary px-4 py-2 bg-[var(--color-ink)] text-[var(--color-paper-2)] rounded-xl text-xs font-bold hover:bg-[var(--color-ink)] transition"
                >
                  Create Flow in Flow Builder
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-[var(--color-ink-2)]">Select a flow to execute:</p>
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {flows.map((fl) => (
                    <div
                      key={fl.id}
                      onClick={() => setSelectedFlowId(fl.id)}
                      className={`hl-card p-3.5 cursor-pointer transition flex items-center justify-between ${selectedFlowId === fl.id ? "border-[var(--color-accent)]" : ""}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-xs truncate">{fl.name}</p>
                          <span className="hl-badge text-[10px] px-2 py-0.5 rounded-full">
                            {fl.node_count || 1} nodes
                          </span>
                        </div>
                        {fl.description && <p className="text-[11px] text-[var(--color-ink-2)] truncate mt-0.5">{fl.description}</p>}
                      </div>
                      {selectedFlowId === fl.id && <CheckCircle2 size={18} className="text-[var(--color-ink)] shrink-0 ml-2" />}
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-[var(--color-rule)]">
                  <button
                    onClick={() => navigate("/whatsapp/flows")}
                    className="text-xs text-[var(--color-ink)] hover:underline font-bold"
                  >
                    Open Flow Builder →
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowFlowModal(false)}
                      className="hl-btn-secondary px-4 py-2 bg-[var(--color-paper-2)] hover:bg-[var(--color-paper-2)] rounded-xl text-xs text-[var(--color-ink-2)] font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!selectedFlowId || triggeringFlow}
                      onClick={() => handleTriggerFlow(selectedFlowId)}
                      className="hl-btn-primary px-5 py-2 bg-[var(--color-ink)] text-[var(--color-paper-2)] rounded-xl text-xs font-bold hover:bg-[var(--color-ink)] transition flex items-center gap-1.5 disabled:opacity-50 shadow"
                    >
                      {triggeringFlow ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                      <span>Launch Flow</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Send Inquiry Options / Interactive Buttons Modal */}
      {showOptionsModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setShowOptionsModal(false)}>
          <div className="hl-card w-full max-w-xl p-5 md:p-6 relative max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowOptionsModal(false)} className="absolute top-4 right-4 text-[var(--color-ink-2)] hover:text-[var(--color-ink)] p-1 rounded-lg hover:bg-[var(--color-paper)] transition">
              <X size={20} />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3 mb-4 border-b border-[var(--color-rule)] pb-3 shrink-0">
              <div className="p-3 rounded-xl bg-[var(--color-paper)] border border-[var(--color-rule)] text-[var(--color-ink)]">
                <ListOrdered size={24} />
              </div>
              <div>
                <h3 className="hl-title flex items-center gap-2">
                  <span>Send WhatsApp Interactive Buttons & Flow Menu</span>
                </h3>
                <p className="text-xs text-[var(--color-ink-2)]">
                  Send authentic action buttons (Call Now, Web Links & Quick Replies) or launch a Chatbot Flow for <span className="text-[var(--color-ink)] font-semibold">{selectedChat?.name || "Customer"}</span>
                </p>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="space-y-4 overflow-y-auto wa-custom-scrollbar pr-1 flex-1">
              {/* Optional Flow Bot Selector */}
              <div className="hl-card p-3 bg-[var(--color-paper-2)] rounded-xl border border-[var(--color-rule)]">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-[var(--color-ink)] flex items-center gap-1.5">
                    <Zap size={14} className="text-[var(--color-ink)]" />
                    <span>Attach Chatbot Flow (Optional)</span>
                  </label>
                  {optionsMenuBotFlowId && (
                    <button
                      type="button"
                      onClick={() => setOptionsMenuBotFlowId("")}
                      className="text-[10px] text-[var(--color-ink)] hover:underline"
                    >
                      Clear Flow
                    </button>
                  )}
                </div>
                <select
                  value={optionsMenuBotFlowId}
                  onChange={(e) => setOptionsMenuBotFlowId(e.target.value)}
                  className="hl-input w-full px-3 py-2 text-xs"
                >
                  <option value="">None (Standard Interactive Buttons)</option>
                  {flows.map((fl) => (
                    <option key={fl.id} value={fl.id}>
                      🤖 Flow Bot: {fl.name} ({fl.node_count || 1} nodes)
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-[var(--color-ink-2)] mt-1.5">
                  {optionsMenuBotFlowId ? (
                    <span className="text-[var(--color-ink)] font-medium">⚡ Customer clicking options will trigger automated multi-step chatbot replies from this flow!</span>
                  ) : (
                    "When customer clicks a button, it responds with the selected action or quick reply text."
                  )}
                </p>
              </div>

              {/* Message Header / Body Prompt */}
              <div>
                <label className="hl-section-label block text-xs font-bold text-[var(--color-ink-2)] uppercase mb-1">
                  Message Header / Prompt Text
                </label>
                <textarea
                  rows={3}
                  value={optionsMenuTitle}
                  onChange={(e) => setOptionsMenuTitle(e.target.value)}
                  placeholder="e.g. Welcome to Madhura Tech! Please choose an option below:"
                  className="hl-input w-full px-3.5 py-2.5 text-xs resize-none"
                />
              </div>

              {/* Buttons Editor */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="hl-section-label text-xs font-bold text-[var(--color-ink-2)] uppercase">
                    Interactive Buttons ({optionsMenuItems.length})
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setOptionsMenuItems((prev) => [...prev, { type: "reply", text: `Option ${prev.length + 1}` }])}
                      className="hl-badge hl-badge-accent px-2 py-1 text-[11px] font-bold transition flex items-center gap-1"
                      title="Add Quick Reply Button"
                    >
                      <CornerDownLeft size={12} />
                      <span>+ Reply</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setOptionsMenuItems((prev) => [...prev, { type: "call", text: "Call Now", phone: "+91 " }])}
                      className="hl-badge hl-badge-success px-2 py-1 text-[11px] font-bold transition flex items-center gap-1"
                      title="Add Call Now Button"
                    >
                      <Phone size={12} />
                      <span>+ Call</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setOptionsMenuItems((prev) => [...prev, { type: "url", text: "Apply Now", url: "https://" }])}
                      className="hl-badge hl-badge-info px-2 py-1 text-[11px] font-bold transition flex items-center gap-1"
                      title="Add Web URL Button"
                    >
                      <ExternalLink size={12} />
                      <span>+ Link</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto wa-custom-scrollbar pr-1">
                  {optionsMenuItems.map((item, idx) => {
                    const itemObj = typeof item === "string" ? { type: "reply", text: item } : item;
                    return (
                      <div key={idx} className="hl-card p-2.5 bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-xl space-y-2">
                        <div className="flex items-center gap-2">
                          <select
                            value={itemObj.type || "reply"}
                            onChange={(e) => {
                              const updated = [...optionsMenuItems];
                              const newType = e.target.value;
                              updated[idx] = {
                                ...itemObj,
                                type: newType,
                                phone: newType === "call" ? (itemObj.phone || "+91 ") : undefined,
                                url: newType === "url" ? (itemObj.url || "https://") : undefined,
                              };
                              setOptionsMenuItems(updated);
                            }}
                            className="hl-select font-bold text-xs px-2 py-1.5 outline-none"
                          >
                            <option value="reply">↩ Reply</option>
                            <option value="call">📞 Call</option>
                            <option value="url">↗ Link</option>
                          </select>

                          <input
                            type="text"
                            value={itemObj.text || ""}
                            onChange={(e) => {
                              const updated = [...optionsMenuItems];
                              updated[idx] = { ...itemObj, text: e.target.value };
                              setOptionsMenuItems(updated);
                            }}
                            placeholder="Button label (e.g. English, Call Now)"
                            className="hl-input flex-1 px-3 py-1.5 text-xs"
                          />

                          {optionsMenuItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setOptionsMenuItems(optionsMenuItems.filter((_, i) => i !== idx))}
                              className="p-1.5 text-[var(--color-ink-2)] hover:text-[var(--color-error)] hover:bg-[var(--color-paper)] rounded-lg transition"
                              title="Delete button"
                            >
                              <X size={15} />
                            </button>
                          )}
                        </div>

                        {itemObj.type === "call" && (
                          <div className="flex items-center gap-2 pl-2">
                            <Phone size={13} className="text-[var(--color-ink)] shrink-0" />
                            <input
                              type="tel"
                              value={itemObj.phone || ""}
                              onChange={(e) => {
                                const updated = [...optionsMenuItems];
                                updated[idx] = { ...itemObj, phone: e.target.value };
                                setOptionsMenuItems(updated);
                              }}
                              placeholder="Phone Number (e.g. +91 98765 43210)"
                              className="hl-input flex-1 px-2.5 py-1 text-xs"
                            />
                          </div>
                        )}

                        {itemObj.type === "url" && (
                          <div className="flex items-center gap-2 pl-2">
                            <ExternalLink size={13} className="text-[var(--color-ink)] shrink-0" />
                            <input
                              type="url"
                              value={itemObj.url || ""}
                              onChange={(e) => {
                                const updated = [...optionsMenuItems];
                                updated[idx] = { ...itemObj, url: e.target.value };
                                setOptionsMenuItems(updated);
                              }}
                              placeholder="Web URL (e.g. https://example.com/apply)"
                              className="hl-input flex-1 px-2.5 py-1 text-xs"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* WhatsApp Authentic Live Preview */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="hl-section-label text-[10px] font-bold text-[var(--color-ink)] uppercase tracking-wider">
                    Live WhatsApp Customer Preview:
                  </p>
                  <span className="text-[10px] text-[var(--color-ink-2)]">Matches official WhatsApp client UI</span>
                </div>

                <div className="hl-card p-3 bg-[var(--color-paper-2)] rounded-xl border border-[var(--color-rule)] flex justify-start">
                  <div className="hl-card max-w-[85%] rounded-lg p-2.5 text-xs relative">
                    <p className="whitespace-pre-wrap break-words">{optionsMenuTitle || "Please choose an option:"}</p>
                    <div className="hl-id flex justify-end mt-1">
                      <span>1:58 pm</span>
                    </div>

                    {/* Button Rows */}
                    {optionsMenuItems.filter((it) => (typeof it === "string" ? it.trim() : it.text?.trim())).length > 0 && (
                      <div className="mt-2 -mx-2.5 -mb-2.5 border-t border-[var(--color-rule)] divide-y divide-[var(--color-rule)] overflow-hidden rounded-b-lg bg-[var(--color-paper)]">
                        {optionsMenuItems
                          .filter((it) => (typeof it === "string" ? it.trim() : it.text?.trim()))
                          .map((it, bIdx) => {
                            const btn = typeof it === "string" ? { type: "reply", text: it } : it;
                            return (
                              <div
                                key={bIdx}
                                className="w-full py-2.5 px-3 flex items-center justify-center gap-2 text-xs font-semibold text-[var(--color-ink)] bg-[var(--color-paper-2)]"
                              >
                                {btn.type === "call" ? (
                                  <Phone size={13} className="text-[var(--color-ink)] shrink-0" />
                                ) : btn.type === "url" ? (
                                  <ExternalLink size={13} className="text-[var(--color-ink)] shrink-0" />
                                ) : (
                                  <CornerDownLeft size={13} className="text-[var(--color-ink)] shrink-0" />
                                )}
                                <span className="truncate">{btn.text || "Option"}</span>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Action Buttons */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-2 pt-4 border-t border-[var(--color-rule)] mt-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowOptionsModal(false)}
                className="hl-btn-secondary w-full sm:w-auto px-4 py-2 bg-[var(--color-paper-2)] hover:bg-[var(--color-paper-2)] rounded-xl text-xs text-[var(--color-ink-2)] font-semibold transition"
              >
                Cancel
              </button>
              <div className="flex w-full sm:w-auto gap-2">
                <button
                  type="button"
                  onClick={handleInsertOptionsMenuToComposer}
                  className="hl-btn-secondary flex-1 sm:flex-initial px-4 py-2 bg-[var(--color-paper-2)] hover:bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-[var(--color-ink)] rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                  title="Insert formatted text into the message composer"
                >
                  <Send size={14} />
                  <span>Insert into Composer</span>
                </button>
                <button
                  type="button"
                  onClick={handleSendInteractiveMenuNow}
                  className="hl-btn-primary flex-1 sm:flex-initial px-5 py-2 text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95"
                  title="Send interactive buttons directly into chat"
                >
                  <Zap size={14} />
                  <span>Send Buttons Now</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Payment Request Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setShowPaymentModal(false)}>
          <div className="hl-card w-full max-w-md p-6 relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowPaymentModal(false)} className="absolute top-4 right-4 text-[var(--color-ink-2)] hover:text-[var(--color-ink)]">
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-4 border-b border-[var(--color-rule)] pb-3">
              <div className="p-3 rounded-xl bg-[var(--color-paper)] border border-[var(--color-rule)] text-[var(--color-ink)]">
                <CreditCard size={24} />
              </div>
              <div>
                <h3 className="hl-title">Request WhatsApp Payment</h3>
                <p className="text-xs text-[var(--color-ink-2)]">Generate 0% markup direct payment link for <span className="text-[var(--color-ink)] font-semibold">{selectedChat?.name}</span></p>
              </div>
            </div>

            <form onSubmit={handleCreatePaymentRequest} className="space-y-4">
              <div>
                <label className="hl-section-label block text-xs font-bold text-[var(--color-ink-2)] uppercase mb-1">Amount Due (INR ₹) *</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-[var(--color-ink-2)] font-bold">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    placeholder="e.g. 5000"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    required
                    className="hl-input w-full pl-8 pr-3.5 py-2.5 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="hl-section-label block text-xs font-bold text-[var(--color-ink-2)] uppercase mb-1">Payment Description *</label>
                <input
                  type="text"
                  value={paymentDesc}
                  onChange={(e) => setPaymentDesc(e.target.value)}
                  placeholder="e.g. Annual Maintenance Contract / Service A"
                  required
                  className="hl-input w-full px-3.5 py-2.5 text-xs"
                />
              </div>

              <div className="hl-card p-3 bg-[var(--color-paper-2)] rounded-xl border border-[var(--color-rule)] space-y-1 text-xs">
                <p className="hl-section-label text-[10px] font-bold text-[var(--color-ink)] uppercase tracking-wider">0% Markup Guarantee:</p>
                <p className="text-[var(--color-ink-2)] text-[11px]">Instant UPI / Payment link generated directly without 3rd-party aggregator markup fees. Real-time webhook marks invoice paid.</p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-rule)]">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="hl-btn-secondary px-4 py-2 bg-[var(--color-paper-2)] hover:bg-[var(--color-paper-2)] rounded-xl text-xs text-[var(--color-ink-2)] font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingPayment || !paymentAmount}
                  className="hl-btn-primary px-5 py-2 bg-[var(--color-ink)] text-[var(--color-paper-2)] rounded-xl text-xs font-bold hover:bg-[var(--color-ink)] transition flex items-center gap-1.5 disabled:opacity-50 shadow"
                >
                  {creatingPayment ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  <span>Send Payment Link to WhatsApp</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Drip Sequence Enrollment Modal */}
      {showDripModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setShowDripModal(false)}>
          <div className="hl-card w-full max-w-lg p-6 relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowDripModal(false)} className="absolute top-4 right-4 text-[var(--color-ink-2)] hover:text-[var(--color-ink)]">
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-4 border-b border-[var(--color-rule)] pb-3">
              <div className="p-3 rounded-xl bg-[var(--color-paper)] border border-[var(--color-rule)] text-[var(--color-ink)]">
                <Sparkles size={24} />
              </div>
              <div>
                <h3 className="hl-title">Enroll in Drip Sequence</h3>
                <p className="text-xs text-[var(--color-ink-2)]">Automated multi-day follow-up and nurturing for <span className="text-[var(--color-ink)] font-semibold">{selectedChat?.name}</span></p>
              </div>
            </div>

            {dripLoading ? (
              <div className="py-12 text-center">
                <Loader2 size={32} className="animate-spin text-[var(--color-ink)] mx-auto mb-3" />
                <p className="text-xs text-[var(--color-ink-2)]">Loading drip sequences...</p>
              </div>
            ) : dripSequences.length === 0 ? (
              <div className="hl-empty p-6 text-center text-xs text-[var(--color-ink-2)] space-y-3">
                <p>No active drip campaigns created yet.</p>
                <button
                  onClick={() => navigate("/whatsapp/automations")}
                  className="hl-btn-primary px-4 py-2 bg-[var(--color-ink)] text-[var(--color-paper-2)] rounded-xl text-xs font-bold hover:bg-[var(--color-ink)] transition"
                >
                  Create Drip Sequence in Automations
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-[var(--color-ink-2)]">Select a drip sequence:</p>
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {dripSequences.map((seq) => (
                    <div
                      key={seq.id}
                      onClick={() => setSelectedDripId(seq.id)}
                      className={`hl-card p-3.5 cursor-pointer transition flex items-center justify-between ${selectedDripId === seq.id ? "border-[var(--color-accent)]" : ""}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-xs truncate">{seq.name}</p>
                          <span className="hl-badge text-[10px] px-2 py-0.5 rounded-full">
                            {seq.step_count || 1} steps
                          </span>
                        </div>
                        {seq.description && <p className="text-[11px] text-[var(--color-ink-2)] truncate mt-0.5">{seq.description}</p>}
                      </div>
                      {selectedDripId === seq.id && <CheckCircle2 size={18} className="text-[var(--color-ink)] shrink-0 ml-2" />}
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-[var(--color-rule)]">
                  <button
                    onClick={() => navigate("/whatsapp/automations")}
                    className="text-xs text-[var(--color-ink)] hover:underline font-bold"
                  >
                    Manage Sequences →
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowDripModal(false)}
                      className="hl-btn-secondary px-4 py-2 bg-[var(--color-paper-2)] hover:bg-[var(--color-paper-2)] rounded-xl text-xs text-[var(--color-ink-2)] font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!selectedDripId || enrollingDrip}
                      onClick={() => handleEnrollDrip(selectedDripId)}
                      className="hl-btn-primary px-5 py-2 bg-[var(--color-ink)] text-[var(--color-paper-2)] rounded-xl text-xs font-bold hover:bg-[var(--color-ink)] transition flex items-center gap-1.5 disabled:opacity-50 shadow"
                    >
                      {enrollingDrip ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      <span>Enroll Contact</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Shared Team Inbox Internal Notes Slide-over Drawer (Mobile & Tablet) */}
      {showNotesDrawer && (
        <div className="xl:hidden fixed inset-0 bg-black/50 z-50 flex justify-end backdrop-blur-xs animate-fadeIn" onClick={() => setShowNotesDrawer(false)}>
          <div className="hl-card w-full max-w-sm border-l h-full overflow-hidden relative shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {renderNotesContent(false)}
          </div>
        </div>
      )}

      {/* Account Messaging Quota Balance Modal */}
      {showAccountBalanceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setShowAccountBalanceModal(false)}>
          <div className="hl-card w-full max-w-md p-6 relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowAccountBalanceModal(false)} className="absolute top-4 right-4 text-[var(--color-ink-2)] hover:text-[var(--color-ink)]">
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-5 border-b border-[var(--color-rule)] pb-3">
              <div className="p-3 rounded-xl bg-[var(--color-paper)] border border-[var(--color-rule)] text-[var(--color-ink)]">
                <CreditCard size={24} />
              </div>
              <div>
                <h3 className="hl-title">WhatsApp Engine & Quota Balance</h3>
                <p className="text-xs text-[var(--color-ink-2)]">Live messaging analytics and connection status</p>
              </div>
            </div>

            {accountBalanceLoading ? (
              <div className="py-12 text-center">
                <Loader2 size={32} className="animate-spin text-[var(--color-ink)] mx-auto mb-3" />
                <p className="text-sm font-semibold text-[var(--color-ink-2)]">Checking account quota balance...</p>
              </div>
            ) : accountBalance?.error ? (
              <div className="hl-card p-4 bg-[var(--color-error)] text-[var(--color-error)] rounded-xl text-xs font-semibold">
                {accountBalance.error}
              </div>
            ) : accountBalance ? (
              <div className="space-y-4">
                <div className="hl-card bg-[var(--color-paper-2)] p-4 rounded-xl space-y-2 border border-[var(--color-rule)]">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-[var(--color-ink-2)] font-medium">Connection Status:</span>
                    <span className={`hl-badge font-bold px-2.5 py-0.5 text-xs flex items-center gap-1 ${accountBalance.connected ? "hl-badge-success" : "hl-badge-error"}`}>
                      <span className={`w-2 h-2 rounded-full ${accountBalance.connected ? "bg-[var(--color-success)] animate-pulse" : "bg-[var(--color-error)]"}`}></span>
                      {accountBalance.connected ? "Connected & Active" : "Disconnected"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-[var(--color-ink-2)] font-medium">Active Engine:</span>
                    <span className="hl-badge hl-badge-info px-2 py-0.5 rounded text-xs">
                      {accountBalance.activeEngine}
                    </span>
                  </div>
                  {accountBalance.phone && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-[var(--color-ink-2)] font-medium">Sender Number:</span>
                      <span className="hl-id">+{accountBalance.phone}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="hl-card bg-[var(--color-paper)] border border-[var(--color-rule)] p-3 rounded-xl">
                    <p className="hl-section-label text-[10px] font-bold uppercase text-[var(--color-ink)]">Messages Today</p>
                    <p className="hl-kpi-num mt-1">{accountBalance.todaySent.toLocaleString()}</p>
                  </div>
                  <div className="hl-card bg-[var(--color-paper)] border border-[var(--color-rule)] p-3 rounded-xl">
                    <p className="hl-section-label text-[10px] font-bold uppercase text-[var(--color-ink)]">Total Outbound</p>
                    <p className="hl-kpi-num mt-1">{accountBalance.totalSent.toLocaleString()}</p>
                  </div>
                  <div className="hl-card bg-[var(--color-paper)] border border-[var(--color-rule)] p-3 rounded-xl">
                    <p className="hl-section-label text-[10px] font-bold uppercase text-[var(--color-ink)]">Delivered</p>
                    <p className="hl-kpi-num mt-1">{accountBalance.totalDelivered.toLocaleString()}</p>
                  </div>
                  <div className="hl-card bg-[var(--color-paper-2)] border border-[var(--color-rule)] p-3 rounded-xl">
                    <p className="hl-section-label text-[10px] font-bold uppercase text-[var(--color-ink-2)]">Failed / Bounced</p>
                    <p className="hl-kpi-num mt-1">{accountBalance.totalFailed.toLocaleString()}</p>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => setShowAccountBalanceModal(false)}
                    className="hl-btn-primary px-5 py-2 bg-[var(--color-ink)] text-[var(--color-paper-2)] rounded-lg text-xs font-bold hover:bg-[var(--color-ink)] transition shadow"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Create New Template Modal */}
      {showCreateTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setShowCreateTemplateModal(false)}>
          <div className="hl-card w-full max-w-lg p-6 relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowCreateTemplateModal(false)} className="absolute top-4 right-4 text-[var(--color-ink-2)] hover:text-[var(--color-ink)]">
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-4 border-b border-[var(--color-rule)] pb-3">
              <div className="p-3 rounded-xl bg-[var(--color-paper)] border border-[var(--color-rule)] text-[var(--color-ink)]">
                <FileText size={24} />
              </div>
              <div>
                <h3 className="hl-title">Create WhatsApp Template</h3>
                <p className="text-xs text-[var(--color-ink-2)]">Draft & save template with full Markdown support</p>
              </div>
            </div>

            <form onSubmit={handleCreateTemplate} className="space-y-4">
              <div>
                <label className="hl-section-label block text-xs font-semibold text-[var(--color-ink-2)] uppercase mb-1">Template Identifier *</label>
                <input
                  type="text"
                  placeholder="e.g. promotional_discount_offer"
                  value={newTmplName}
                  onChange={(e) => setNewTmplName(e.target.value)}
                  className="hl-input w-full px-3.5 py-2 text-xs"
                  required
                />
              </div>

              <div>
                <label className="hl-section-label block text-xs font-semibold text-[var(--color-ink-2)] uppercase mb-1">Category</label>
                <select
                  value={newTmplCategory}
                  onChange={(e) => setNewTmplCategory(e.target.value)}
                  className="hl-input w-full px-3.5 py-2 text-xs"
                >
                  <option value="MARKETING">MARKETING</option>
                  <option value="UTILITY">UTILITY</option>
                  <option value="AUTHENTICATION">AUTHENTICATION</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="hl-section-label block text-xs font-semibold text-[var(--color-ink-2)] uppercase">Template Content (Supports Markdown & Dynamic Placeholders) *</label>
                  <span className="hl-id text-[10px] text-[var(--color-ink-2)]">{(newTmplBody || "").length} chars</span>
                </div>
                <WAVariablePicker
                  onInsert={(tag) => setNewTmplBody((prev) => (prev || "") + " " + tag)}
                  className="mb-2"
                />
                <textarea
                  rows={4}
                  placeholder={`Hello {name}!\n\nYour appointment tomorrow is on {tomorrow} ({tomorrow_day}).\n\n## Special Offer\nUse code **DISCOUNT20** to get 20% off.`}
                  value={newTmplBody}
                  onChange={(e) => setNewTmplBody(e.target.value)}
                  className="hl-input w-full px-3.5 py-2 text-xs leading-relaxed resize-none"
                  required
                />
                <p className="hl-id text-[10px] text-[var(--color-ink-2)] mt-1">Supports Markdown headers (#), bold (**), and dynamic tokens ({"{tomorrow}"}, {"{tomorrow_day}"}, {"{day}"}, {"{time}"}, {"{date}"})</p>
              </div>

              {/* Live Markdown & Dynamic Evaluated Preview */}
              {newTmplBody.trim() && (
                <div className="hl-card p-3 bg-[var(--color-paper-2)] rounded-xl border border-[var(--color-rule)] text-[var(--color-paper-2)] space-y-1">
                  <div className="hl-section-label flex items-center justify-between text-[10px] font-bold text-[var(--color-ink)] uppercase tracking-wider mb-1">
                    <span>Live Chat Evaluated Preview:</span>
                    <span className="hl-id text-[var(--color-ink)] text-[9px]">Multi-Dynamic Active</span>
                  </div>
                  <RichMessageContent text={evaluateMessagePlaceholders(newTmplBody, { name: selectedChat?.name && !selectedChat.name.startsWith("+") ? selectedChat.name : "Rajesh Kumar" })} isMe={true} />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateTemplateModal(false)} className="hl-btn-secondary px-4 py-2 border rounded-lg text-xs text-[var(--color-ink-2)] hover:bg-[var(--color-paper-2)]">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={tmplLoading || !newTmplName.trim() || !newTmplBody.trim()}
                  className="hl-btn-primary px-5 py-2 bg-[var(--color-ink)] text-[var(--color-paper-2)] rounded-lg text-xs font-bold hover:bg-[var(--color-ink)] flex items-center gap-2 shadow-md disabled:opacity-50"
                >
                  {tmplLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  <span>Save & Insert Template</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Send Interactive Reminder Modal */}
      {showReminderModal && selectedChat && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setShowReminderModal(false)}>
          <div className="hl-card w-full max-w-lg p-6 relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowReminderModal(false)} className="absolute top-4 right-4 text-[var(--color-ink-2)] hover:text-[var(--color-ink)]">
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-4 border-b border-[var(--color-rule)] pb-3">
              <div className="p-3 rounded-xl bg-[var(--color-paper)] border border-[var(--color-rule)] text-[var(--color-ink)]">
                <Bell size={24} />
              </div>
              <div>
                <h3 className="hl-title">Send Interactive Reminder</h3>
                <p className="text-xs text-[var(--color-ink-2)]">
                  Deliver 2-way confirmation notice to <span className="text-[var(--color-ink)] font-semibold">{selectedChat.name}</span> (+{selectedChat.id.replace(/\D/g, "")})
                </p>
              </div>
            </div>

            <div className="space-y-4 max-h-[72vh] overflow-y-auto pr-1">
              <div>
                <label className="hl-section-label block text-xs font-bold text-[var(--color-ink-2)] uppercase mb-1.5">Reminder Category</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "appointment_reminder", label: "📅 Service Visit / Appointment" },
                    { id: "payment_due", label: "💰 Payment Due Notice" },
                    { id: "quotation_followup", label: "💼 Quotation Follow-up" },
                    { id: "amc_renewal", label: "🛡️ AMC Renewal Due" },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => handleReminderTypeChange(cat.id)}
                      className={`hl-card p-2.5 text-xs font-semibold text-left transition ${
                        reminderType === cat.id
                          ? "border-[var(--color-accent)]"
                          : ""
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="hl-section-label block text-xs font-bold text-[var(--color-ink-2)] uppercase mb-1">Title / Notification Tag</label>
                <input
                  type="text"
                  value={reminderTitle}
                  onChange={(e) => setReminderTitle(e.target.value)}
                  className="hl-input w-full px-3 py-2 text-xs"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="hl-section-label block text-xs font-bold text-[var(--color-ink-2)] uppercase">Message Body</label>
                  <span className="hl-id text-[10px] text-[var(--color-ink)]">Placeholders Supported</span>
                </div>
                <textarea
                  value={reminderText}
                  onChange={(e) => setReminderText(e.target.value)}
                  rows={3}
                  className="hl-input w-full px-3 py-2 text-xs resize-none"
                />
              </div>

              <div>
                <label className="hl-section-label block text-xs font-bold text-[var(--color-ink-2)] uppercase mb-1.5">
                  Interactive Response Buttons (Customer taps on WhatsApp)
                </label>
                <div className="space-y-1.5">
                  {reminderOptions.map((opt, idx) => (
                    <div key={opt.id || idx} className="flex items-center gap-2">
                      <span className="hl-id text-xs text-[var(--color-ink-2)] w-5 text-right">{idx + 1}.</span>
                      <input
                        type="text"
                        value={opt.label}
                        onChange={(e) => {
                          const updated = [...reminderOptions];
                          updated[idx] = { ...updated[idx], label: e.target.value };
                          setReminderOptions(updated);
                        }}
                        className="hl-input flex-1 px-3 py-1.5 text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="hl-card p-3 bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-xl">
                <label className="block text-xs font-bold text-[var(--color-ink)] uppercase mb-1 flex items-center gap-1.5">
                  <Zap size={13} className="text-[var(--color-ink)]" />
                  Auto-Launch Flow Bot on Response (Optional)
                </label>
                <select
                  value={reminderFlowId}
                  onChange={(e) => setReminderFlowId(e.target.value)}
                  className="hl-input w-full px-3 py-2 text-xs"
                >
                  <option value="">None (Standard Confirmation Acknowledgment)</option>
                  {flows.map((fl) => (
                    <option key={fl.id} value={fl.id}>
                      🤖 {fl.name}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-[var(--color-ink)] mt-1 leading-relaxed">
                  When the customer responds to this reminder, our bot engine will automatically engage them in this conversational flow!
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-[var(--color-rule)] mt-4">
              <button
                type="button"
                onClick={() => setShowReminderModal(false)}
                className="hl-btn-secondary px-4 py-2 bg-[var(--color-paper-2)] hover:bg-[var(--color-paper-2)] rounded-xl text-xs text-[var(--color-ink-2)] font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={sendingReminder || !reminderText.trim()}
                onClick={handleSendReminderNow}
                className="hl-btn-primary px-5 py-2 text-[var(--color-paper-2)] rounded-xl text-xs font-bold  disabled:opacity-50 transition shadow-lg flex items-center gap-1.5"
              >
                {sendingReminder ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                <span>{sendingReminder ? "Sending..." : "Send Reminder Now"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Contact to Campaign Group Modal */}
      {showAddToGroupModal && selectedChat && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setShowAddToGroupModal(false)}>
          <div className="hl-card w-full max-w-lg p-6 relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowAddToGroupModal(false)} className="absolute top-4 right-4 text-[var(--color-ink-2)] hover:text-[var(--color-ink)]">
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-4 border-b border-[var(--color-rule)] pb-3">
              <div className="p-3 rounded-xl bg-[var(--color-paper)] border border-[var(--color-rule)] text-[var(--color-ink)]">
                <Users size={24} />
              </div>
              <div>
                <h3 className="hl-title">Enroll in Bulk Campaign Group</h3>
                <p className="text-xs text-[var(--color-ink-2)]">
                  Add <span className="text-[var(--color-ink)] font-semibold">{selectedChat.name}</span> (+{selectedChat.id.replace(/\D/g, "")}) to campaign target lists
                </p>
              </div>
            </div>

            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
              <div>
                <p className="hl-section-label text-xs font-bold text-[var(--color-ink-2)] uppercase mb-2">Select Target Group(s):</p>
                {groupsLoading ? (
                  <div className="hl-empty py-8 text-center text-xs text-[var(--color-ink-2)]">
                    <Loader2 size={24} className="animate-spin text-[var(--color-ink)] mx-auto mb-2" />
                    Loading campaign groups...
                  </div>
                ) : campaignGroups.length === 0 ? (
                  <p className="hl-empty text-xs text-[var(--color-ink-2)] py-3 text-center">No campaign groups found. Create one below!</p>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto">
                    {campaignGroups.map((grp) => {
                      const isSelected = selectedGroupIds.includes(grp.id);
                      return (
                        <div
                          key={grp.id}
                          onClick={() => {
                            setSelectedGroupIds((prev) =>
                              prev.includes(grp.id) ? prev.filter((id) => id !== grp.id) : [...prev, grp.id]
                            );
                          }}
                          className={`hl-card p-3 cursor-pointer transition flex items-center justify-between ${
                            isSelected
                              ? "border-[var(--color-accent)]"
                              : ""
                          }`}
                        >
                          <div>
                            <p className="text-xs font-bold">{grp.name}</p>
                            {grp.description && <p className="text-[11px] text-[var(--color-ink-2)] mt-0.5">{grp.description}</p>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="hl-badge text-[10px] px-2 py-0.5 rounded-full">
                              {grp.contact_count || grp.total_contacts || 0} contacts
                            </span>
                            <div className={`w-4 h-4 rounded border border-[var(--color-rule)] flex items-center justify-center ${isSelected ? "bg-[var(--color-accent)] border-[var(--color-accent)] text-[var(--color-accent-ink)]" : ""}`}>
                              {isSelected && <CheckCircle2 size={12} />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Create new group inline */}
              <div className="hl-card p-3 bg-[var(--color-paper-2)] rounded-xl border border-[var(--color-rule)] space-y-2">
                <label className="hl-section-label block text-[11px] font-bold text-[var(--color-ink-2)] uppercase">Or Create New Campaign Group</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="e.g. High-Value Clients, Festive 2026..."
                    className="hl-input flex-1 px-3 py-1.5 text-xs"
                  />
                  <button
                    type="button"
                    disabled={creatingGroup || !newGroupName.trim()}
                    onClick={handleCreateNewGroupAndAdd}
                    className="hl-btn-primary px-3 py-1.5 bg-[var(--color-ink)] text-[var(--color-paper-2)] rounded-lg text-xs font-bold hover:bg-[var(--color-ink)] disabled:opacity-50 transition shrink-0"
                  >
                    {creatingGroup ? "Creating..." : "Create & Add"}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-[var(--color-rule)] mt-4">
              <button
                type="button"
                onClick={() => navigate("/whatsapp/campaigns")}
                className="text-xs text-[var(--color-ink)] hover:underline font-bold"
              >
                Open Campaigns Manager →
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddToGroupModal(false)}
                  className="hl-btn-secondary px-4 py-2 bg-[var(--color-paper-2)] hover:bg-[var(--color-paper-2)] rounded-xl text-xs text-[var(--color-ink-2)] font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={addingToGroup || selectedGroupIds.length === 0}
                  onClick={handleAddToCampaignGroups}
                  className="hl-btn-primary px-5 py-2 bg-[var(--color-paper)] text-[var(--color-paper-2)] rounded-xl text-xs font-bold hover:bg-[var(--color-paper)] disabled:opacity-50 transition shadow flex items-center gap-1.5"
                >
                  {addingToGroup ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />}
                  <span>{addingToGroup ? "Adding..." : `Add to ${selectedGroupIds.length} Group(s)`}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trigger CRM Automation Modal */}
      {showAutomationModal && selectedChat && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setShowAutomationModal(false)}>
          <div className="hl-card w-full max-w-lg p-6 relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowAutomationModal(false)} className="absolute top-4 right-4 text-[var(--color-ink-2)] hover:text-[var(--color-ink)]">
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-4 border-b border-[var(--color-rule)] pb-3">
              <div className="p-3 rounded-xl bg-[var(--color-paper)] border border-[var(--color-rule)] text-[var(--color-ink)]">
                <Sparkles size={24} />
              </div>
              <div>
                <h3 className="hl-title">Execute CRM Automation Workflow</h3>
                <p className="text-xs text-[var(--color-ink-2)]">
                  Trigger automated CRM message sequence for <span className="text-[var(--color-ink)] font-semibold">{selectedChat.name}</span>
                </p>
              </div>
            </div>

            <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
              <p className="hl-section-label text-xs font-bold text-[var(--color-ink-2)] uppercase">Select Active Automation Rule:</p>
              {automationsLoading ? (
                <div className="hl-empty py-8 text-center text-xs text-[var(--color-ink-2)]">
                  <Loader2 size={24} className="animate-spin text-[var(--color-ink)] mx-auto mb-2" />
                  Loading automation rules...
                </div>
              ) : automations.length === 0 ? (
                <p className="hl-empty text-xs text-[var(--color-ink-2)] py-4 text-center">No active automations found.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {automations.map((rule) => {
                    const isSelected = selectedAutomationId === rule.id;
                    return (
                      <div
                        key={rule.id}
                        onClick={() => setSelectedAutomationId(rule.id)}
                        className={`hl-card p-3 cursor-pointer transition flex items-center justify-between ${
                          isSelected
                            ? "border-[var(--color-accent)]"
                            : ""
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs font-bold text-[var(--color-ink)]">{rule.name}</p>
                            <span className="hl-badge text-[10px] px-2 py-0.5 rounded-full">
                              {rule.trigger_label || rule.trigger_type}
                            </span>
                            {rule.flow_name && (
                              <span className="hl-badge hl-badge-warn text-[10px] px-2 py-0.5 rounded-full">
                                🤖 {rule.flow_name}
                              </span>
                            )}
                          </div>
                          {rule.message_text && (
                            <p className="text-[11px] text-[var(--color-ink-2)] truncate mt-1">{rule.message_text}</p>
                          )}
                        </div>
                        {isSelected && <CheckCircle2 size={18} className="text-[var(--color-ink)] shrink-0 ml-2" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-[var(--color-rule)] mt-4">
              <button
                type="button"
                onClick={() => navigate("/whatsapp/automations")}
                className="text-xs text-[var(--color-ink)] hover:underline font-bold"
              >
                Open Automations Manager →
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAutomationModal(false)}
                  className="hl-btn-secondary px-4 py-2 bg-[var(--color-paper-2)] hover:bg-[var(--color-paper-2)] rounded-xl text-xs text-[var(--color-ink-2)] font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={runningAutomation || !selectedAutomationId}
                  onClick={() => handleTriggerAutomation(selectedAutomationId)}
                  className="hl-btn-primary px-5 py-2 text-[var(--color-paper-2)] rounded-xl text-xs font-bold  disabled:opacity-50 transition shadow flex items-center gap-1.5"
                >
                  {runningAutomation ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  <span>{runningAutomation ? "Executing..." : "Execute Automation"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Floating Context Menu */}
      {contextMenu && (
        <div
          className="hl-card fixed z-50 py-1.5 w-52 text-xs wa-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Quick Reactions Bar inside context menu */}
          <div className="flex items-center justify-around px-2 py-1.5 border-b border-[var(--color-rule)] mb-1">
            {["👍", "❤️", "😂", "😮", "🙏", "🔥"].map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  handleReact(contextMenu.message.id, emoji);
                  setContextMenu(null);
                }}
                className="text-base hover:scale-125 transition active:scale-95 p-0.5"
                title={`React ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              setReplyingTo(contextMenu.message);
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-2 hover:bg-[var(--color-paper)] flex items-center gap-2.5 transition text-[var(--color-ink)]"
          >
            <ChevronLeft size={14} className="rotate-180" />
            <span>Reply</span>
          </button>

          {contextMenu.message?.body && (
            <button
              type="button"
              onClick={() => {
                handleCopyMessage(contextMenu.message.body);
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-2 hover:bg-[var(--color-paper)] flex items-center gap-2.5 transition text-[var(--color-ink)]"
            >
              <Copy size={14} />
              <span>Copy Text</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              handleToggleStar(contextMenu.message.id);
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-2 hover:bg-[var(--color-paper)] flex items-center gap-2.5 transition text-[var(--color-ink)]"
          >
            <Star size={14} className={starredMsgIds.has(contextMenu.message.id) ? "text-[var(--color-focus)] fill-[var(--color-focus)]" : ""} />
            <span>{starredMsgIds.has(contextMenu.message.id) ? "Unstar Message" : "Star Message"}</span>
          </button>

          {contextMenu.message?.body && (
            <button
              type="button"
              onClick={() => {
                setMessageInput(`Forwarded: "${contextMenu.message.body}"\n`);
                setContextMenu(null);
                textareaRef.current?.focus();
              }}
              className="w-full text-left px-3 py-2 hover:bg-[var(--color-paper)] flex items-center gap-2.5 transition text-[var(--color-ink)]"
            >
              <Forward size={14} />
              <span>Forward</span>
            </button>
          )}
        </div>
      )}

      {/* Fullscreen Photo Lightbox Modal with Zoom, Rotate, & Keyboard Controls */}
      {lightboxImage && (
        <div className="fixed inset-0 bg-black/95 z-50 flex flex-col items-center justify-between p-4 backdrop-blur-md select-none wa-lightbox-enter">
          {/* Top Lightbox Toolbar */}
          <div className="w-full flex items-center justify-between z-10 px-2 py-1 max-w-5xl">
            <div className="flex items-center gap-2">
              <span className="text-[var(--color-paper-2)] text-sm font-semibold truncate max-w-xs sm:max-w-md">
                {lightboxImage.title || "Photo Preview"}
              </span>
              <span className="text-[var(--color-paper-2)] text-xs hidden sm:inline">• {Math.round(lightboxZoom * 100)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setLightboxZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
                className="hl-btn-secondary p-2 text-[var(--color-paper-2)] hover:text-[var(--color-ink)] bg-[var(--color-paper-2)] hover:bg-[var(--color-paper-2)] rounded-full transition"
                title="Zoom Out (-)"
              >
                <ZoomOut size={18} />
              </button>
              <button
                type="button"
                onClick={() => setLightboxZoom((z) => Math.min(3, Number((z + 0.25).toFixed(2))))}
                className="hl-btn-secondary p-2 text-[var(--color-paper-2)] hover:text-[var(--color-ink)] bg-[var(--color-paper-2)] hover:bg-[var(--color-paper-2)] rounded-full transition"
                title="Zoom In (+)"
              >
                <ZoomIn size={18} />
              </button>
              <button
                type="button"
                onClick={() => setLightboxRotation((r) => (r + 90) % 360)}
                className="hl-btn-secondary p-2 text-[var(--color-paper-2)] hover:text-[var(--color-ink)] bg-[var(--color-paper-2)] hover:bg-[var(--color-paper-2)] rounded-full transition"
                title="Rotate Clockwise (R)"
              >
                <RotateCw size={18} />
              </button>
              <a
                href={lightboxImage.src}
                download={lightboxImage.title || "photo.jpg"}
                className="hl-btn-primary px-3 py-1.5 bg-[var(--color-ink)] hover:bg-[var(--color-ink)] text-[var(--color-paper-2)] rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-lg"
                title="Download"
              >
                <Download size={14} />
                <span className="hidden sm:inline">Download</span>
              </a>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="hl-btn-secondary p-2 text-[var(--color-paper-2)] hover:text-[var(--color-ink)] bg-[var(--color-paper-2)] hover:bg-[var(--color-paper-2)] rounded-full transition ml-1"
                title="Close (Esc)"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Central Image Viewport */}
          <div className="flex-1 w-full flex items-center justify-center overflow-hidden my-2">
            <img
              src={lightboxImage.src}
              alt="Preview"
              className="max-w-[90vw] max-h-[78vh] object-contain transition-transform duration-200 shadow-2xl rounded-lg"
              style={{
                transform: `scale(${lightboxZoom}) rotate(${lightboxRotation}deg)`,
              }}
            />
          </div>

          {/* Bottom Caption / Reset Bar */}
          <div className="flex items-center gap-3 z-10">
            {lightboxZoom !== 1 || lightboxRotation !== 0 ? (
              <button
                type="button"
                onClick={() => {
                  setLightboxZoom(1);
                  setLightboxRotation(0);
                }}
                className="hl-badge px-3 py-1 transition"
              >
                Reset View
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
