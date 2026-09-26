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
    return <span className={`text-red-400 font-bold ${className}`} title="Failed to send">!</span>;
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
  const color = isRead ? "text-[#53bdeb]" : "text-slate-300/70";

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
      <div className="bg-[#202c33] rounded-lg rounded-tl-none px-3 py-2.5 flex items-center gap-0.5 shadow-sm">
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
      case "pdf": return "bg-red-500/20 text-red-400 border-red-500/40";
      case "doc":
      case "docx": return "bg-blue-500/20 text-blue-400 border-blue-500/40";
      case "xls":
      case "xlsx":
      case "csv": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";
      case "ppt":
      case "pptx": return "bg-orange-500/20 text-orange-400 border-orange-500/40";
      case "md":
      case "txt":
      case "json": return "bg-indigo-500/20 text-indigo-300 border-indigo-500/40";
      case "zip":
      case "rar":
      case "7z": return "bg-amber-500/20 text-amber-400 border-amber-500/40";
      case "png":
      case "jpg":
      case "jpeg":
      case "webp": return "bg-purple-500/20 text-purple-300 border-purple-500/40";
      default: return "bg-[#00a884]/20 text-[#00a884] border-[#00a884]/40";
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
          <div className="flex items-center justify-between text-[11px] font-bold text-[#00a884] px-1">
            <span className="text-slate-300 text-[10px] font-mono truncate max-w-[160px]">{rawFilename}</span>
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
          <video src={src} controls className="max-w-[290px] max-h-[340px] rounded-xl shadow-md border border-white/10" />
          <div className="flex items-center justify-between text-[11px] font-bold text-[#00a884] px-1">
            <span className="text-slate-300 text-[10px] font-mono truncate max-w-[180px]">{rawFilename}</span>
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
            className="max-w-[320px] max-h-[360px] object-cover rounded-xl shadow-md cursor-pointer hover:opacity-95 transition border border-white/10"
            onClick={handleView}
          />
          <div className="flex items-center justify-between text-xs font-bold text-[#00a884] pt-1 px-1">
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
    <div className={`rounded-xl p-3 border space-y-2.5 min-w-[240px] max-w-[330px] ${isMe ? "bg-[#025142] border-emerald-800/40 text-white" : "bg-[#111b21] border-slate-700/50 text-white"}`}>
      <div className="flex items-center gap-3">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-xs uppercase shrink-0 border ${getBadgeStyle(fileExt)}`}>
          {fileExt.slice(0, 4)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-white truncate" title={rawFilename}>{rawFilename}</p>
          <p className="text-[10px] text-slate-300 font-mono mt-0.5 uppercase">{fileExt} Attachment</p>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-white/10 pt-2 text-xs font-bold text-[#00a884]">
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
          <button onClick={load} className="text-amber-400 hover:underline flex items-center gap-1">
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
  const [sidebarTab, setSidebarTab] = useState("all"); // 'all', 'unread', 'favourites', 'groups'
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
    let cleanPhone = selectedChat.id.replace(/\D/g, "");
    if (cleanPhone.length === 10) cleanPhone = "91" + cleanPhone;
    setTriggeringFlow(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(`${API}/api/wa/flows/${flowId}/trigger-phone`, {
        phone: cleanPhone
      }, { headers: { Authorization: `Bearer ${token}` } });
      const selFlow = flows.find((f) => String(f.id) === String(flowId));
      setActiveFlowRun({
        flowId,
        flowName: selFlow?.name || "Automated Bot Flow",
        currentNode: "Starting...",
        phone: cleanPhone,
      });
      setShowFlowModal(false);
      await fetchMessages(selectedChat.id, 15);
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
      let phone = selectedChat.id.replace(/\D/g, "");
      if (phone.length === 10) phone = "91" + phone;

      await axios.post(
        `${API}/api/wa/automations/${automationId}/trigger`,
        {
          phone,
          contact_name: selectedChat.name,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setShowAutomationModal(false);
      await fetchMessages(selectedChat.id, 15);
      alert(`⚡ Automation triggered successfully for ${selectedChat.name}!`);
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
      const selClean = (activeSelected?.id || activeSelected?.phone || "").replace(/\D/g, "");
      const msgClean = (targetChatId || phone || "").replace(/\D/g, "");
      const sel10 = selClean.slice(-10);
      const msg10 = msgClean.slice(-10);
      const isCurrentChat = Boolean(sel10 && msg10 && sel10 === msg10);

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

  const contactChatsList = deduplicatedChats.filter((c) => !isGroupChat(c));
  const groupChatsList = deduplicatedChats.filter((c) => isGroupChat(c));
  const unreadChatsList = deduplicatedChats.filter((c) => (c.unreadCount || 0) > 0);
  const favChatsList = deduplicatedChats.filter((c) => c.isPinned);

  let displayChats = [];
  const searchLower = (searchTerm || "").toLowerCase().trim();
  let baseList = contactChatsList;
  if (sidebarTab === "all") {
    baseList = contactChatsList;
  } else if (sidebarTab === "unread") {
    baseList = unreadChatsList;
  } else if (sidebarTab === "favourites") {
    baseList = favChatsList;
  } else if (sidebarTab === "groups") {
    baseList = groupChatsList;
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
      <div className="w-full flex-1 flex flex-col min-h-screen items-center justify-center bg-[#0b141a] text-slate-300">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[#00a884]/20 border border-[#00a884]/40 flex items-center justify-center animate-pulse">
            <MessageCircle size={36} className="text-[#00a884]" />
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-300 font-medium">
            <Loader2 size={18} className="animate-spin text-[#00a884]" />
            Loading WhatsApp Workspace...
          </div>
        </div>
      </div>
    );
  }

  if (!status.connected) {
    return (
      <div className="w-full flex-1 flex flex-col min-h-screen p-3 md:p-5 bg-[#0b141a] text-slate-100 pb-16">
        <WhatsAppNav />
        {showConfigModal && (
          <WAConfigPrompt
            onClose={() => {
              setShowConfigModal(false);
              fetchStatus();
            }}
          />
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 bg-[#111b21] p-4 rounded-2xl border border-[#222d34] shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#25D366] to-emerald-700 text-white flex items-center justify-center shadow-md">
              <MessageCircle size={22} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#e9edef]">WhatsApp Connection Center</h1>
              <p className="text-xs text-[#8696a0]">Connect via Official Meta Cloud API (No QR needed) or Scan QR Code</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowConfigModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#00a884] hover:bg-[#02906f] text-white rounded-xl text-xs font-bold transition shadow-sm"
            >
              <Key size={14} />
              <span>Configure Meta API</span>
            </button>
            <button
              onClick={() => fetchQr(true)}
              disabled={qrLoading}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#202c33] hover:bg-[#2a3942] text-[#e9edef] rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50 border border-[#2a3942]"
            >
              <RefreshCw size={14} className={qrLoading ? "animate-spin" : ""} />
              <span>{qrLoading ? "Generating..." : "Fresh QR / Reset"}</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-950/80 border border-red-800 rounded-xl text-red-200 text-xs font-semibold">
            {error}
          </div>
        )}

        {/* Quick Meta API Callout Banner */}
        <div className="mb-6 p-4 bg-[#111b21] border border-[#222d34] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-500/40 text-blue-400 flex items-center justify-center shrink-0 shadow-sm">
              <Key size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-[#e9edef]">Using Official Meta WhatsApp Cloud API?</p>
              <p className="text-[11px] text-[#8696a0]">You don't need to scan a QR code! Connect your Phone Number ID and Access Token to open immediately.</p>
            </div>
          </div>
          <button
            onClick={() => setShowConfigModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition shrink-0 shadow-md shadow-blue-500/20"
          >
            Enter Meta API Keys ⚡
          </button>
        </div>

        {/* Connection Options Sub-Tabs */}
        <div className="bg-[#111b21] rounded-2xl border border-[#222d34] p-6 shadow-sm max-w-2xl mx-auto w-full">
          <div className="flex items-center justify-center gap-2 mb-6 border-b border-[#222d34] pb-4">
            <button
              onClick={() => { setConnectMode("qr"); if (!qrCode) fetchQr(); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${connectMode === "qr" ? "bg-[#00a884] text-white shadow" : "bg-[#202c33] text-[#8696a0] hover:bg-[#2a3942] hover:text-[#e9edef]"}`}
            >
              📱 Scan QR Code
            </button>
            <button
              onClick={() => setConnectMode("pairing")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${connectMode === "pairing" ? "bg-[#00a884] text-white shadow" : "bg-[#202c33] text-[#8696a0] hover:bg-[#2a3942] hover:text-[#e9edef]"}`}
            >
              🔢 Phone Pairing Code
            </button>
            <button
              onClick={() => setShowConfigModal(true)}
              className="px-4 py-2 rounded-xl text-xs font-bold transition bg-blue-900/30 text-blue-300 hover:bg-blue-900/50 border border-blue-700/50"
            >
              ☁️ Meta Cloud API
            </button>
          </div>

          {/* Mode 1: QR Code Scan */}
          {connectMode === "qr" && (
            <div className="flex flex-col items-center justify-center text-center py-4">
              {qrLoading ? (
                <div className="py-10 text-center">
                  <Loader2 size={44} className="animate-spin text-[#00a884] mx-auto mb-4" />
                  <p className="text-[#e9edef] font-bold text-sm">Generating WhatsApp QR Code...</p>
                  <p className="text-[#8696a0] text-xs mt-1">Please wait a few seconds</p>
                </div>
              ) : qrCode ? (
                <div>
                  <div className="bg-white p-4 rounded-2xl shadow-xl border border-gray-100 inline-block mb-4">
                    {qrDataUrl ? (
                      <img src={qrDataUrl} alt="WhatsApp Web QR Code" className="w-[240px] h-[240px] object-contain" />
                    ) : (
                      <QRCodeSVG value={qrCode} size={240} level="M" />
                    )}
                  </div>
                  <h3 className="text-base font-bold text-[#e9edef] mb-1">Scan with your WhatsApp App</h3>
                  <p className="text-[#8696a0] text-xs max-w-md mx-auto mb-4">
                    Open WhatsApp on your phone → Settings / Menu → <strong>Linked Devices</strong> → <strong>Link a Device</strong> and scan this code.
                  </p>
                  <button
                    onClick={() => fetchQr(true)}
                    className="px-4 py-2 border border-[#2a3942] rounded-xl text-xs font-semibold text-[#e9edef] bg-[#202c33] hover:bg-[#2a3942] transition"
                  >
                    Refresh QR Code
                  </button>
                </div>
              ) : (
                <div className="py-6 text-center">
                  <Smartphone size={52} className="text-[#8696a0] mx-auto mb-3" />
                  <h3 className="text-base font-bold text-[#e9edef] mb-1">Ready to Link WhatsApp Phone</h3>
                  <p className="text-[#8696a0] text-xs max-w-sm mx-auto mb-4">Click below to generate a QR code to scan with your phone.</p>
                  <button
                    onClick={() => fetchQr()}
                    className="px-6 py-2.5 bg-[#00a884] text-white rounded-xl hover:bg-[#02906f] transition font-bold text-xs shadow-md"
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
              <h3 className="text-base font-bold text-[#e9edef] mb-1 text-center">Link via Mobile Number</h3>
              <p className="text-[#8696a0] text-xs text-center mb-6 max-w-md mx-auto">
                Enter your mobile number with country code (e.g. 919876543210) to receive an 8-character WhatsApp pairing code.
              </p>

              {pairingError && (
                <div className="mb-4 p-3 bg-red-950/80 border border-red-800 text-red-200 text-xs rounded-xl text-center font-semibold">
                  {pairingError}
                </div>
              )}

              {pairingCode ? (
                <div className="text-center py-4 bg-emerald-950/40 border border-emerald-800 rounded-2xl p-6">
                  <p className="text-xs text-emerald-400 font-semibold mb-2">YOUR WHATSAPP PAIRING CODE</p>
                  <div className="text-3xl font-mono font-black text-emerald-300 tracking-widest bg-[#111b21] py-3 px-6 rounded-xl border border-emerald-700/60 inline-block mb-3 shadow-inner">
                    {pairingCode}
                  </div>
                  <p className="text-xs text-emerald-300/80 max-w-sm mx-auto">
                    Open WhatsApp on phone → Linked Devices → <strong>Link with phone number instead</strong> → Enter this code.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleRequestPairingCode} className="space-y-4 max-w-md mx-auto">
                  <div>
                    <label className="block text-xs font-bold text-[#8696a0] uppercase mb-1">Mobile Number (with Country Code)</label>
                    <input
                      type="text"
                      placeholder="e.g. 919876543210"
                      value={pairingPhone}
                      onChange={(e) => setPairingPhone(e.target.value)}
                      className="w-full px-4 py-2.5 bg-[#202c33] border border-[#2a3942] text-[#e9edef] rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#00a884]"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={pairingLoading || !pairingPhone}
                    className="w-full py-3 bg-[#00a884] text-white rounded-xl font-bold text-xs hover:bg-[#02906f] transition flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
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

  return (
    <div className="w-full flex-1 flex flex-col wa-h-screen wa-max-h-screen min-h-0 bg-[#0b141a] text-slate-100 overflow-hidden shadow-2xl">
      <WhatsAppNav
        onAccountBalance={fetchAccountBalance}
        onSyncWhatsApp={handleSyncWhatsApp}
        onLogout={handleLogout}
        isSyncing={syncing}
        statusPhone={status.phone}
      />

      {error && (
        <div className="p-3 bg-red-950/80 border-b border-red-800 text-red-200 text-xs font-semibold flex items-center justify-between shrink-0">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Sound & Notification Toggles Bar */}
      <div className="flex items-center justify-end gap-1.5 px-3 py-1 bg-[#111b21] border-b border-[#222d34] shrink-0">
        <button
          onClick={() => setSoundEnabled((v) => !v)}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition ${soundEnabled ? "bg-[#00a884]/20 text-[#00a884] border border-[#00a884]/30" : "bg-[#202c33] text-slate-400 border border-transparent hover:text-slate-200"}`}
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
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition ${desktopNotifs ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "bg-[#202c33] text-slate-400 border border-transparent hover:text-slate-200"}`}
          title={desktopNotifs ? "Disable desktop notifications" : "Enable desktop notifications"}
        >
          <Bell size={12} />
          <span className="hidden sm:inline">{desktopNotifs ? "Notifs On" : "Notifs Off"}</span>
        </button>
      </div>

      {/* Main WhatsApp App Canvas */}
      <div className="flex-1 min-h-0 flex overflow-hidden w-full relative">

        {/* Chats Sidebar Column (Independent Parallel Scrolling) */}
        <div className={`w-full md:w-96 lg:w-[420px] bg-[#111b21] border-r border-[#222d34] flex flex-col h-full min-h-0 shrink-0 ${showMobileChat ? "hidden md:flex" : "flex"}`}>
          {/* Search Bar & Action Buttons */}
          <div className="p-3 border-b border-[#222d34] flex items-center gap-2 shrink-0">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search or start a new chat"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#202c33] text-slate-100 placeholder-slate-400 rounded-xl text-xs outline-none focus:ring-1 focus:ring-[#00a884] border border-transparent"
              />
            </div>
            <button
              onClick={() => setShowNewChatModal(true)}
              className="p-2 bg-[#202c33] text-slate-300 hover:text-white hover:bg-[#2a3942] rounded-xl transition shrink-0"
              title="Start new chat"
            >
              <Plus size={16} />
            </button>
            <button
              onClick={() => fetchChats(true)}
              className="p-2 bg-[#202c33] text-slate-300 hover:text-white hover:bg-[#2a3942] rounded-xl transition shrink-0"
              title="Refresh chat list"
            >
              <RefreshCw size={15} className={chatsLoading ? "animate-spin text-[#00a884]" : ""} />
            </button>
          </div>

          {/* Filter Capsules / Pills (All, Unread, Favourites, Groups) */}
          <div className="px-3 py-2 border-b border-[#222d34] flex items-center gap-1.5 shrink-0 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setSidebarTab("all")}
              className={`px-3 py-1 rounded-full text-xs font-bold transition whitespace-nowrap ${sidebarTab === "all"
                  ? "bg-[#00a884] text-white shadow-sm"
                  : "bg-[#202c33] text-slate-300 hover:bg-[#2a3942]"
                }`}
            >
              All
            </button>
            <button
              onClick={() => setSidebarTab("unread")}
              className={`px-3 py-1 rounded-full text-xs font-bold transition whitespace-nowrap flex items-center gap-1 ${sidebarTab === "unread"
                  ? "bg-[#00a884] text-white shadow-sm"
                  : "bg-[#202c33] text-slate-300 hover:bg-[#2a3942]"
                }`}
            >
              <span>Unread</span>
              {unreadChatsList.length > 0 && (
                <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                  {unreadChatsList.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setSidebarTab("favourites")}
              className={`px-3 py-1 rounded-full text-xs font-bold transition whitespace-nowrap ${sidebarTab === "favourites"
                  ? "bg-[#00a884] text-white shadow-sm"
                  : "bg-[#202c33] text-slate-300 hover:bg-[#2a3942]"
                }`}
            >
              Favourites
            </button>
            <button
              onClick={() => setSidebarTab("groups")}
              className={`px-3 py-1 rounded-full text-xs font-bold transition whitespace-nowrap flex items-center gap-1 ${sidebarTab === "groups"
                  ? "bg-[#00a884] text-white shadow-sm"
                  : "bg-[#202c33] text-slate-300 hover:bg-[#2a3942]"
                }`}
            >
              <span>Groups</span>
              {groupChatsList.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${sidebarTab === "groups" ? "bg-white/20 text-white" : "bg-[#111b21] text-slate-300"}`}>
                  {groupChatsList.length}
                </span>
              )}
            </button>
          </div>

          {/* Chat List Items (Parallel Independent Column Scroll) */}
          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-[#222d34]/60 overscroll-contain wa-custom-scrollbar scroll-smooth">
            {chatsLoading && chats.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 space-y-2 text-slate-400">
                <Loader2 size={28} className="animate-spin text-[#00a884]" />
                <p className="text-xs font-medium">Loading conversations...</p>
              </div>
            ) : displayChats.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-slate-400 text-center">
                <MessageSquare size={36} className="mb-2 text-[#00a884] opacity-80" />
                <p className="font-semibold text-slate-200 text-sm mb-1">
                  {searchTerm
                    ? "No chats match your search"
                    : sidebarTab === "unread"
                    ? "No unread messages"
                    : sidebarTab === "favourites"
                    ? "No starred or pinned chats"
                    : sidebarTab === "groups"
                    ? "No group chats found"
                    : "No WhatsApp chats yet"}
                </p>
                <p className="text-xs text-slate-400 mb-4 max-w-xs">
                  {searchTerm
                    ? "Try searching with a different name, phone number, or message"
                    : "Start a conversation directly with any contact or phone number"}
                </p>
                <button
                  onClick={() => setShowNewChatModal(true)}
                  className="px-4 py-2 bg-[#00a884] text-white rounded-xl text-xs font-bold hover:bg-[#008f70] transition shadow-md flex items-center gap-1.5"
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

                return (
                  <div
                    key={chat.id}
                    onClick={() => handleSelectChat(chat)}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 hover:bg-[#202c33] transition text-left cursor-pointer border-l-4 ${isActive ? "bg-[#2a3942] border-[#00a884]" : "border-transparent"
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
                        <span className={`font-bold text-sm truncate ${isActive ? "text-white" : "text-slate-100"}`}>
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
                        <span className={`text-[11px] font-semibold shrink-0 ${hasUnread ? "text-[#00a884]" : "text-slate-400"}`}>
                          {timeStr}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1 min-w-0 text-xs text-slate-400 truncate">
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
                              <span className="text-[#25D366] font-semibold italic animate-pulse">typing...</span>
                            ) : (
                              chat.lastMessage?.body || "Tap to open conversation"
                            )}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {chat.isMuted && <VolumeX size={13} className="text-slate-400" />}
                          {chat.isPinned && <Pin size={13} className="text-slate-400 rotate-45" />}
                          {hasUnread && (
                            <span className="bg-[#00a884] text-[#111b21] text-[10px] px-1.5 py-0.5 rounded-full font-extrabold min-w-[18px] text-center shadow">
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
        <div className={`flex-1 flex flex-col h-full min-h-0 min-w-0 bg-[#0b141a] relative ${!showMobileChat ? "hidden md:flex" : "flex"}`}>
          {!selectedChat ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#111b21] text-slate-400 select-none">
              <div className="max-w-md w-full text-center space-y-6">
                <div className="w-20 h-20 mx-auto rounded-full bg-[#202c33] flex items-center justify-center text-[#00a884] shadow-inner">
                  <MessageCircle size={44} />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-slate-100 tracking-wide">WhatsApp Desktop & CRM Live</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Send and receive live messages without keeping your phone online. Connected with Madhura Tech CRM.
                  </p>
                </div>

                {/* Quick Action Shortcut Buttons (Matching Screenshot) */}
                <div className="flex items-center justify-center gap-4 pt-2">
                  <button
                    onClick={() => setShowNewChatModal(true)}
                    className="flex flex-col items-center gap-2 p-3.5 bg-[#202c33] hover:bg-[#2a3942] rounded-2xl transition w-28 border border-white/5 group shadow-md"
                  >
                    <div className="p-2.5 bg-[#111b21] rounded-xl text-[#00a884] group-hover:scale-110 transition">
                      <FileText size={20} />
                    </div>
                    <span className="text-[11px] font-bold text-slate-200">Send document</span>
                  </button>

                  <button
                    onClick={() => setShowNewChatModal(true)}
                    className="flex flex-col items-center gap-2 p-3.5 bg-[#202c33] hover:bg-[#2a3942] rounded-2xl transition w-28 border border-white/5 group shadow-md"
                  >
                    <div className="p-2.5 bg-[#111b21] rounded-xl text-[#00a884] group-hover:scale-110 transition">
                      <UserPlus size={20} />
                    </div>
                    <span className="text-[11px] font-bold text-slate-200">Add contact</span>
                  </button>

                  <button
                    onClick={() => setShowNewChatModal(true)}
                    className="flex flex-col items-center gap-2 p-3.5 bg-[#202c33] hover:bg-[#2a3942] rounded-2xl transition w-28 border border-white/5 group shadow-md"
                  >
                    <div className="p-2.5 bg-[#111b21] rounded-xl text-purple-400 group-hover:scale-110 transition">
                      <Sparkles size={20} />
                    </div>
                    <span className="text-[11px] font-bold text-slate-200">Ask Meta AI</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Active Chat Header */}
              <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-[#222d34] bg-[#202c33] shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <button onClick={() => setShowMobileChat(false)} className="md:hidden p-1 text-slate-300 hover:text-white rounded">
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
                      <p className="font-bold text-white text-sm group-hover:text-[#00a884] transition truncate">
                        {(() => {
                          const n = selectedChat.name || "";
                          if (n.replace(/\D/g, "").length >= 13 || n.includes("@lid")) {
                            return selectedChat.formattedPhone || formatPhoneNumber(selectedChat.phoneNumber) || "WhatsApp Contact";
                          }
                          return n || selectedChat.formattedPhone || "WhatsApp Contact";
                        })()}
                      </p>
                      {selectedChat.source && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/40 shrink-0">
                          {selectedChat.source}
                        </span>
                      )}
                    </div>
                    {selectedChat.isGroup ? (
                      <p className="text-xs text-slate-400">Group Chat</p>
                    ) : contactTyping ? (
                      <p className="text-xs text-[#25D366] font-semibold animate-pulse">typing...</p>
                    ) : isContactOnline(selectedChat.id) ? (
                      <p className="text-xs text-[#25D366] font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] inline-block"></span> online
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400">
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
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/80 border border-slate-600/50 shadow-sm"
                      title={
                        botStatus.pausedUntil
                          ? `Bot is quiet until ${new Date(botStatus.pausedUntil).toLocaleString()}`
                          : "Bot is switched off for this contact"
                      }
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block shrink-0" />
                      <span className="text-[11px] font-bold text-slate-300 whitespace-nowrap">
                        {botStatus.assignedAgentName
                          ? `You have this chat (${botStatus.assignedAgentName})`
                          : "Bot paused"}
                      </span>
                      <button
                        onClick={handleResumeBot}
                        disabled={botResuming}
                        className="text-[11px] font-bold text-[#00a884] hover:text-[#25D366] disabled:opacity-50 whitespace-nowrap"
                        title="Let the bot answer this contact again"
                      >
                        {botResuming ? "..." : "Let bot reply"}
                      </button>
                    </div>
                  )}

                  {/* Trigger Chatbot Flow Button */}
                  <button
                    onClick={() => setShowFlowModal(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-950/60 text-amber-300 hover:bg-amber-900/50 rounded-lg transition text-xs font-semibold border border-amber-800/40 shadow-sm"
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
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-purple-950/60 text-purple-300 hover:bg-purple-900/50 rounded-lg transition text-xs font-semibold border border-purple-800/40 shadow-sm"
                    title="Execute CRM Workflow Automation Rule"
                  >
                    <Sparkles size={14} />
                    <span className="hidden md:inline">Automation</span>
                  </button>

                  {/* Send Interactive Reminder Button */}
                  <button
                    onClick={() => setShowReminderModal(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-orange-950/60 text-orange-300 hover:bg-orange-900/50 rounded-lg transition text-xs font-semibold border border-orange-800/40 shadow-sm"
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
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-950/60 text-blue-300 hover:bg-blue-900/50 rounded-lg transition text-xs font-semibold border border-blue-800/40 shadow-sm"
                    title="Enroll contact into Bulk Campaign Target Groups"
                  >
                    <Users size={14} />
                    <span className="hidden lg:inline">Campaigns</span>
                  </button>

                  {/* Template Picker Button */}
                  <button
                    onClick={() => setShowTemplatePicker((v) => !v)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-950/60 text-emerald-300 hover:bg-emerald-900/50 rounded-lg transition text-xs font-semibold border border-emerald-800/40 shadow-sm"
                    title="Insert WhatsApp message template"
                  >
                    <FileText size={14} />
                    <span className="hidden sm:inline">Templates</span>
                  </button>

                  {/* CRM Info & Hub Drawer */}
                  <button
                    onClick={() => {
                      fetchContactCrmDetails(selectedChat.id);
                      setShowContactInfoDrawer(true);
                    }}
                    className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition"
                    title="View Contact Profile, CRM Inquiries & Quick Links"
                  >
                    <Info size={18} />
                  </button>
                </div>
              </div>

              {/* Shared Team Inbox Collaboration & Ticket Status Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-[#182229] border-b border-[#222d34] text-xs shrink-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Ticket Status Selector */}
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status:</span>
                    {["open", "pending", "resolved", "spam"].map((st) => (
                      <button
                        key={st}
                        onClick={() => handleUpdateTicketStatus(st)}
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase transition ${
                          ticketStatus === st
                            ? st === "open"
                              ? "bg-emerald-500/30 text-emerald-300 border border-emerald-400"
                              : st === "pending"
                              ? "bg-amber-500/30 text-amber-300 border border-amber-400"
                              : st === "resolved"
                              ? "bg-blue-500/30 text-blue-300 border border-blue-400"
                              : "bg-red-500/30 text-red-300 border border-red-400"
                            : "bg-[#202c33] text-slate-400 hover:text-slate-200 border border-transparent"
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>

                  {/* Agent Assignment Selector */}
                  <div className="flex items-center gap-1.5 ml-2 border-l border-slate-700/60 pl-2">
                    <span className="text-[11px] font-bold text-slate-400">Agent:</span>
                    <select
                      value={assignedAgentName}
                      onChange={(e) => {
                        const sel = teamMembers.find((m) => `${m.first_name} ${m.last_name || ""}`.trim() === e.target.value);
                        handleAssignAgent(sel?.id || null, e.target.value);
                      }}
                      className="bg-[#202c33] text-slate-200 border border-[#2a3942] rounded-lg px-2 py-1 text-xs outline-none cursor-pointer focus:border-[#00a884]"
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
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-lg font-bold text-[11px] transition shadow-sm"
                    title="Launch a smart chatbot flow for this customer"
                  >
                    <span>🤖 Launch Flow</span>
                  </button>

                  {/* Internal Team Notes Drawer Toggle */}
                  <button
                    onClick={() => {
                      fetchInternalNotes(selectedChat.id);
                      setShowNotesDrawer(true);
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg font-bold text-[11px] transition shadow-sm"
                  >
                    <span>📝 Team Notes</span>
                    {internalNotes.length > 0 && (
                      <span className="px-1.5 py-0.2 bg-amber-400 text-black font-extrabold text-[10px] rounded-full">
                        {internalNotes.length}
                      </span>
                    )}
                  </button>

                  {/* Engine Badge */}
                  {status.isCloud ? (
                    <span className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-950/80 text-blue-300 border border-blue-500/40 rounded-lg text-[10px] font-bold shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                      <span>☁️ Meta Official API • {status.phone ? `+${status.phone}` : "Active"}</span>
                    </span>
                  ) : (
                    <span className="hidden lg:inline-flex items-center gap-1 px-2.5 py-1 bg-[#202c33] text-emerald-400 border border-emerald-500/30 rounded-lg text-[10px] font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span>📱 Web Linked • {status.phone ? `+${status.phone}` : "Active"}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Active Bot Flow Banner */}
              {activeFlowRun && (
                <div className="bg-[#182229] border-b border-emerald-500/40 px-4 py-2 flex items-center justify-between z-20 shadow-md animate-fadeIn shrink-0">
                  <div className="flex items-center gap-2.5 text-xs min-w-0">
                    <span className="relative flex h-2.5 w-2.5 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                    <span className="font-bold text-emerald-400 shrink-0">🤖 Bot Flow Active:</span>
                    <span className="text-white font-medium truncate">{activeFlowRun.flowName || "Automated Flow"}</span>
                    {activeFlowRun.currentNode && (
                      <span className="text-slate-300 text-[11px] bg-white/10 px-2 py-0.5 rounded border border-white/10 shrink-0 hidden sm:inline">
                        Step: {activeFlowRun.currentNode}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setActiveFlowRun(null)}
                      className="px-2.5 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 rounded-lg text-[11px] font-bold transition flex items-center gap-1 shadow-sm"
                      title="Stop this automated bot flow"
                    >
                      <Square size={11} fill="currentColor" /> Stop Bot
                    </button>
                  </div>
                </div>
              )}

              {/* Chat Thread Canvas with Parallax Doodle Background */}
              <div className="flex-1 min-h-0 relative flex flex-col overflow-hidden bg-[#0b141a]">
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
                  className="relative z-10 flex-1 min-h-0 overflow-y-auto px-3 sm:px-6 py-4 overscroll-contain wa-custom-scrollbar scroll-smooth"
                >
                {messages.length >= msgLimit && (
                  <div className="flex justify-center mb-3">
                    <button
                      onClick={handleLoadMoreMessages}
                      disabled={loadingMore}
                      className="px-4 py-1.5 bg-[#202c33] border border-white/10 text-xs font-semibold text-slate-300 rounded-full hover:bg-[#2a3942] transition shadow flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {loadingMore ? <Loader2 size={13} className="animate-spin text-[#00a884]" /> : <RefreshCw size={13} />}
                      <span>Load older messages</span>
                    </button>
                  </div>
                )}
                {messagesLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 size={28} className="animate-spin text-[#00a884]" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm">
                    <MessageSquare size={44} className="mb-2 text-[#00a884] opacity-80" />
                    <p className="font-bold text-slate-200 text-base">No message history yet</p>
                    <p className="text-xs text-slate-400">Send a message below to start chatting with {selectedChat.name}</p>
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
                      <div className="sticky top-2 z-20 flex justify-center my-3 pointer-events-none select-none">
                        <span className="px-3.5 py-1 bg-[#182229]/90 backdrop-blur-md text-[11px] font-bold tracking-wide text-slate-300 rounded-lg shadow-md uppercase border border-white/10">
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
                      <div className="opacity-0 group-hover:opacity-100 transition flex items-center gap-1 bg-[#111b21] px-2 py-0.5 rounded-full shadow border border-slate-700/60 absolute -top-3 z-10 select-none">
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
                          className="text-slate-400 hover:text-white ml-1 text-xs px-1 hover:bg-white/10 rounded"
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
                          className="text-slate-400 hover:text-white ml-0.5 text-xs px-1 hover:bg-white/10 rounded"
                          title="More options"
                        >
                          <MoreVertical size={12} />
                        </button>
                      </div>

                      <div
                        className={`max-w-[75%] md:max-w-[65%] px-2.5 py-1.5 rounded-lg text-sm shadow-sm relative ${msg.isMe
                            ? `bg-[#005c4b] text-white ${startsRun ? "rounded-tr-none" : ""}`
                            : `bg-[#202c33] text-white ${startsRun ? "rounded-tl-none" : ""}`
                          }`}
                      >
                        {/* Bubble tail — only on the first message of a run */}
                        {startsRun && (
                          <span
                            aria-hidden="true"
                            className={`absolute top-0 w-2 h-3 ${msg.isMe ? "-right-2" : "-left-2"}`}
                            style={{
                              backgroundColor: msg.isMe ? "#005c4b" : "#202c33",
                              clipPath: msg.isMe ? "polygon(0 0, 100% 0, 0 100%)" : "polygon(0 0, 100% 0, 100% 100%)",
                            }}
                          />
                        )}
                        {/* Quoted Message Preview in bubble */}
                        {msg.quotedMsg && (
                          <div className="mb-2 p-1.5 bg-black/25 rounded-lg border-l-2 border-[#00a884] text-xs text-slate-300">
                            <p className="font-bold text-[10px] text-[#00a884]">Quoted Message</p>
                            <p className="truncate text-slate-200">{msg.quotedMsg.body || "Attachment"}</p>
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
                                  className="flex items-center gap-2 underline font-semibold text-emerald-300"
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
                                    <span key={rIdx} className="bg-[#111b21]/90 border border-slate-700/80 px-1.5 py-0.2 rounded-full text-[11px] shadow">
                                      {r.emoji}
                                    </span>
                                  ))}
                                </div>
                              )}

                              <div className="flex items-center justify-end gap-1 text-[11px] -mt-0.5 -mb-0.5 text-slate-300/60 font-normal leading-none pt-1">
                                <span>
                                  {msg.timestamp
                                    ? new Date(msg.timestamp * 1000).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                    : ""}
                                </span>
                                {starredMsgIds.has(msg.id) && (
                                  <Star size={10} className="text-amber-400 fill-amber-400 inline" />
                                )}
                                {msg.isMe && <MessageTicks status={msg.status || "sent"} />}
                              </div>

                              {/* WhatsApp Authentic Full-Width Action Buttons (Call Now / Apply Now / Quick Replies) */}
                              {msgButtons && msgButtons.length > 0 && (
                                <div className="mt-2 -mx-2.5 -mb-1.5 border-t border-white/10 divide-y divide-white/10 overflow-hidden rounded-b-lg select-none bg-black/10">
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
                                      className="w-full py-2.5 px-3 flex items-center justify-center gap-2 text-xs font-semibold text-[#00a884] hover:bg-white/5 active:bg-white/10 transition-colors text-center group/btn"
                                      title={btn.type === "call" ? `Call ${btn.phone || ""}` : btn.type === "url" ? `Open link ${btn.url || ""}` : `Send "${btn.title || btn.text || btn}"`}
                                    >
                                      {btn.type === "call" ? (
                                        <Phone size={14} className="text-[#00a884] shrink-0" />
                                      ) : btn.type === "url" ? (
                                        <ExternalLink size={14} className="text-[#00a884] shrink-0" />
                                      ) : (
                                        <CornerDownLeft size={14} className="text-[#00a884] shrink-0" />
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
                  className="relative w-10 h-10 rounded-full bg-[#202c33] hover:bg-[#2a3942] border border-slate-700/80 text-slate-200 shadow-2xl hover:scale-105 active:scale-95 transition flex items-center justify-center group"
                  title="Jump to latest messages"
                >
                  <ChevronDown size={20} className="group-hover:translate-y-0.5 transition-transform text-slate-300" />
                  {unreadWhileScrolled > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-[#00a884] text-[#111b21] text-[10px] font-extrabold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow animate-pulse">
                      {unreadWhileScrolled}
                    </span>
                  )}
                </button>
              </div>
            </div>

              {/* Quote Reply Banner above composer */}
              {replyingTo && (
                <div className="px-4 py-2 bg-[#182229] border-t border-[#222d34] flex items-center justify-between text-xs text-slate-300 shrink-0">
                  <div className="border-l-2 border-[#00a884] pl-2 truncate">
                    <span className="font-bold text-[#00a884]">Replying to {replyingTo.isMe ? "You" : selectedChat.name}:</span>{" "}
                    <span className="text-slate-300">{replyingTo.body?.slice(0, 80) || "Attachment"}</span>
                  </div>
                  <button onClick={() => setReplyingTo(null)} className="text-slate-400 hover:text-white p-1">
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Input Area & Tool Suite */}
              <div className="relative flex items-center gap-2 p-3 border-t border-[#222d34] bg-[#202c33] shrink-0">
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
                    <div className="fixed inset-x-0 bottom-0 z-50 md:absolute md:inset-x-auto md:bottom-full md:left-3 md:mb-3 md:w-72 bg-[#111b21] border-t md:border border-[#222d34] rounded-t-3xl md:rounded-2xl shadow-2xl p-3 md:p-2 text-slate-200 wa-bottom-sheet max-h-[75vh] overflow-y-auto">
                      <div className="wa-swipe-indicator md:hidden" />
                      <div className="px-3 py-2 border-b border-[#222d34] flex items-center justify-between text-xs font-bold text-[#00a884]">
                        <span className="flex items-center gap-1.5"><Paperclip size={14} /> Share Media & Quick Tools</span>
                        <button onClick={() => setShowAttachMenu(false)} className="text-slate-400 hover:text-white p-1">
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
                        className="w-full text-left flex items-center gap-3 p-2.5 hover:bg-[#202c33] rounded-xl transition text-xs font-medium text-slate-200 group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center group-hover:scale-105 transition">
                          <FileText size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-100 group-hover:text-red-400">PDF & Document</p>
                          <p className="text-[10px] text-slate-400 truncate">.pdf, .doc, .docx, .txt, .zip</p>
                        </div>
                      </button>

                      {/* Excel / Spreadsheet */}
                      <button
                        onClick={() => {
                          setShowAttachMenu(false);
                          document.getElementById("wa-excel-upload-input")?.click();
                        }}
                        className="w-full text-left flex items-center gap-3 p-2.5 hover:bg-[#202c33] rounded-xl transition text-xs font-medium text-slate-200 group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition">
                          <Database size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-100 group-hover:text-emerald-400">Excel / Spreadsheet</p>
                          <p className="text-[10px] text-slate-400 truncate">.xlsx, .xls, .csv spreadsheets</p>
                        </div>
                      </button>

                      {/* Photos & Videos */}
                      <button
                        onClick={() => {
                          setShowAttachMenu(false);
                          document.getElementById("wa-media-upload-input")?.click();
                        }}
                        className="w-full text-left flex items-center gap-3 p-2.5 hover:bg-[#202c33] rounded-xl transition text-xs font-medium text-slate-200 group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center group-hover:scale-105 transition">
                          <Image size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-100 group-hover:text-purple-400">Photos & Videos</p>
                          <p className="text-[10px] text-slate-400 truncate">Images (.png, .jpg), Videos (.mp4)</p>
                        </div>
                      </button>

                      {/* Audio / Voice Note */}
                      <button
                        onClick={() => {
                          setShowAttachMenu(false);
                          document.getElementById("wa-audio-upload-input")?.click();
                        }}
                        className="w-full text-left flex items-center gap-3 p-2.5 hover:bg-[#202c33] rounded-xl transition text-xs font-medium text-slate-200 group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center group-hover:scale-105 transition">
                          <Music size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-100 group-hover:text-[#00a884]">Audio / Voice</p>
                          <p className="text-[10px] text-slate-400 truncate">.mp3, .ogg, .wav audio files</p>
                        </div>
                      </button>

                      {/* Trigger Chatbot Flow */}
                      <button
                        onClick={() => {
                          setShowAttachMenu(false);
                          setShowFlowModal(true);
                        }}
                        className="w-full text-left flex items-center gap-3 p-2.5 hover:bg-[#202c33] rounded-xl transition text-xs font-medium text-slate-200 group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center group-hover:scale-105 transition">
                          <Zap size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-100 group-hover:text-amber-300">Trigger Chatbot Flow</p>
                          <p className="text-[10px] text-slate-400 truncate">Automated customer flow & bot reply</p>
                        </div>
                      </button>

                      {/* Trigger CRM Automation */}
                      <button
                        onClick={() => {
                          setShowAttachMenu(false);
                          fetchAutomations();
                          setShowAutomationModal(true);
                        }}
                        className="w-full text-left flex items-center gap-3 p-2.5 hover:bg-[#202c33] rounded-xl transition text-xs font-medium text-slate-200 group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center group-hover:scale-105 transition">
                          <Sparkles size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-100 group-hover:text-purple-300">Trigger CRM Automation</p>
                          <p className="text-[10px] text-slate-400 truncate">Run automated invoice, receipt, or welcome rule</p>
                        </div>
                      </button>

                      {/* Send Interactive Reminder */}
                      <button
                        onClick={() => {
                          setShowAttachMenu(false);
                          setShowReminderModal(true);
                        }}
                        className="w-full text-left flex items-center gap-3 p-2.5 hover:bg-[#202c33] rounded-xl transition text-xs font-medium text-slate-200 group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center group-hover:scale-105 transition">
                          <Bell size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-100 group-hover:text-orange-300">Send Interactive Reminder</p>
                          <p className="text-[10px] text-slate-400 truncate">2-way buttons: Confirm, Reschedule, Call</p>
                        </div>
                      </button>

                      {/* Enroll in Campaign Group */}
                      <button
                        onClick={() => {
                          setShowAttachMenu(false);
                          fetchCampaignGroups();
                          setShowAddToGroupModal(true);
                        }}
                        className="w-full text-left flex items-center gap-3 p-2.5 hover:bg-[#202c33] rounded-xl transition text-xs font-medium text-slate-200 group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center group-hover:scale-105 transition">
                          <Users size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-100 group-hover:text-blue-300">Enroll in Campaign Group</p>
                          <p className="text-[10px] text-slate-400 truncate">Add contact to bulk campaign target audience</p>
                        </div>
                      </button>

                      {/* Send Inquiry Options Menu */}
                      <button
                        onClick={() => {
                          setShowAttachMenu(false);
                          setShowOptionsModal(true);
                        }}
                        className="w-full text-left flex items-center gap-3 p-2.5 hover:bg-[#202c33] rounded-xl transition text-xs font-medium text-slate-200 group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center group-hover:scale-105 transition">
                          <ListOrdered size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-100 group-hover:text-blue-300">Send Options / Inquiry Menu</p>
                          <p className="text-[10px] text-slate-400 truncate">Numbered inquiry buttons & quick replies</p>
                        </div>
                      </button>

                      {/* Insert Template */}
                      <button
                        onClick={() => {
                          setShowAttachMenu(false);
                          setShowTemplatePicker(true);
                        }}
                        className="w-full text-left flex items-center gap-3 p-2.5 hover:bg-[#202c33] rounded-xl transition text-xs font-medium text-slate-200 group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition">
                          <FileText size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-100 group-hover:text-[#00a884]">Approved Template</p>
                          <p className="text-[10px] text-slate-400 truncate">Insert WhatsApp formatted template</p>
                        </div>
                      </button>

                      {/* Request WhatsApp Payment */}
                      <button
                        onClick={() => {
                          setShowAttachMenu(false);
                          setShowPaymentModal(true);
                        }}
                        className="w-full text-left flex items-center gap-3 p-2.5 hover:bg-[#202c33] rounded-xl transition text-xs font-medium text-slate-200 group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition">
                          <CreditCard size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-100 group-hover:text-emerald-300">Request WhatsApp Payment</p>
                          <p className="text-[10px] text-slate-400 truncate">Generate 0% markup UPI / payment link</p>
                        </div>
                      </button>

                      {/* Enroll in Drip Sequence */}
                      <button
                        onClick={() => {
                          setShowAttachMenu(false);
                          fetchDripSequences();
                          setShowDripModal(true);
                        }}
                        className="w-full text-left flex items-center gap-3 p-2.5 hover:bg-[#202c33] rounded-xl transition text-xs font-medium text-slate-200 group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center group-hover:scale-105 transition">
                          <Sparkles size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-100 group-hover:text-indigo-300">Enroll in Drip Sequence</p>
                          <p className="text-[10px] text-slate-400 truncate">Automated multi-day lead nurturing</p>
                        </div>
                      </button>

                      {/* Share Location */}
                      <button
                        onClick={() => {
                          setShowAttachMenu(false);
                          handleShareLocation();
                        }}
                        disabled={locationSending}
                        className="w-full text-left flex items-center gap-3 p-2.5 hover:bg-[#202c33] rounded-xl transition text-xs font-medium text-slate-200 group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center group-hover:scale-105 transition">
                          <Navigation size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-100 group-hover:text-rose-300">Share GPS Location</p>
                          <p className="text-[10px] text-slate-400 truncate">Send current office / live coordinates</p>
                        </div>
                      </button>
                    </div>
                  </div>
                  </>
                )}

                {/* Slash commands quick-replies popup */}
                {messageInput.startsWith("/") && (
                  <div className="absolute bottom-full left-3 mb-2 w-80 max-h-60 overflow-y-auto bg-[#111b21] border border-[#222d34] rounded-2xl shadow-2xl z-30 p-2 space-y-1 text-slate-200">
                    <div className="px-2 py-1 text-[10px] uppercase font-bold text-[#00a884]">Quick Replies (Click to insert)</div>
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
                          className="p-2 hover:bg-[#202c33] rounded-xl cursor-pointer transition"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-[#00a884]">/{qr.shortcut}</span>
                            <span className="text-[10px] text-slate-400 font-semibold">{qr.title}</span>
                          </div>
                          <p className="text-[11px] text-slate-300 truncate mt-0.5">{qr.content}</p>
                        </div>
                      ))}
                  </div>
                )}

                {/* Message Template Picker Modal Popup */}
                {showTemplatePicker && (
                  <div className="absolute bottom-full left-3 mb-2 w-88 max-h-80 overflow-y-auto bg-[#111b21] border border-[#222d34] rounded-2xl shadow-2xl z-30 text-slate-200">
                    <div className="px-3 py-2 bg-[#202c33] border-b border-[#222d34] text-xs font-bold text-slate-200 flex items-center justify-between">
                      <span>Insert Message Template</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setShowTemplatePicker(false); setShowCreateTemplateModal(true); }}
                          className="text-[10px] font-bold text-[#00a884] hover:underline"
                        >
                          + Create Template
                        </button>
                        <button onClick={() => setShowTemplatePicker(false)} className="text-slate-400 hover:text-white">
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                    {templates.length === 0 ? (
                      <div className="p-4 text-xs text-slate-400 text-center space-y-2">
                        <p>No templates loaded yet</p>
                        <div className="flex justify-center gap-2 pt-1">
                          <button
                            onClick={handleSeedTemplates}
                            disabled={tmplLoading}
                            className="px-3 py-1 bg-[#00a884] text-[#111b21] rounded text-xs font-bold hover:bg-[#008f70]"
                          >
                            {tmplLoading ? "Seeding..." : "Seed 8 Default Templates"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="divide-y divide-[#222d34]">
                        <div className="p-2 bg-[#111b21] flex justify-between items-center text-[10px]">
                          <span className="text-slate-400">{templates.length} templates available</span>
                          <button onClick={() => { setShowTemplatePicker(false); setShowCreateTemplateModal(true); }} className="text-[#00a884] font-bold hover:underline">
                            + New Template
                          </button>
                        </div>
                        {templates.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => insertTemplate(t)}
                            className="w-full text-left px-3 py-2.5 hover:bg-[#202c33] transition group"
                          >
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-bold text-slate-200 group-hover:text-[#00a884]">{t.name}</p>
                              {t.category && (
                                <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-white/10 text-slate-300">
                                  {t.category}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 truncate mt-0.5">{t.body}</p>
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
                  className={`p-2.5 rounded-full transition shrink-0 ${showAttachMenu ? "bg-[#00a884] text-[#111b21]" : "text-slate-400 hover:text-[#00a884] hover:bg-[#2a3942]"}`}
                  title="Share document, photo, video, audio, trigger flows or inquiry menu"
                >
                  {mediaSending ? <Loader2 size={18} className="animate-spin text-[#00a884]" /> : <Paperclip size={18} />}
                </button>

                {/* Templates Quick Button */}
                <button
                  type="button"
                  onClick={() => setShowTemplatePicker((v) => !v)}
                  className="p-2.5 text-slate-400 hover:text-[#00a884] hover:bg-[#2a3942] rounded-full transition shrink-0"
                  title="Insert a saved template"
                >
                  <FileText size={18} />
                </button>

                {/* Quick Flow Trigger Button */}
                <button
                  type="button"
                  onClick={() => setShowFlowModal(true)}
                  className="p-2.5 text-amber-400 hover:text-amber-300 hover:bg-[#2a3942] rounded-full transition shrink-0"
                  title="Trigger Chatbot Flow"
                >
                  <Zap size={18} />
                </button>

                {/* Quick Interactive Buttons & Flow Menu */}
                <button
                  type="button"
                  onClick={() => setShowOptionsModal(true)}
                  className="p-2.5 text-blue-400 hover:text-blue-300 hover:bg-[#2a3942] rounded-full transition shrink-0"
                  title="Send WhatsApp Interactive Buttons & Flow Menu (Call, Links, Quick Replies)"
                >
                  <ListOrdered size={18} />
                </button>

                {/* Emoji Picker Button */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker((v) => !v)}
                    className={`p-2 rounded-full transition ${showEmojiPicker ? "text-[#00a884] bg-white/10" : "text-slate-400 hover:text-slate-200"}`}
                    title="Emoji"
                  >
                    <Smile size={21} />
                  </button>

                  {showEmojiPicker && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setShowEmojiPicker(false)} />
                      <div className="absolute bottom-12 left-0 z-40 w-80 max-h-72 flex flex-col bg-[#233138] border border-slate-700 rounded-2xl shadow-2xl p-2.5">
                        {/* Search Bar in Emoji Picker */}
                        <div className="mb-2 relative">
                          <Search size={13} className="absolute left-2.5 top-2 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Search emojis..."
                            value={emojiSearch}
                            onChange={(e) => setEmojiSearch(e.target.value)}
                            className="w-full pl-8 pr-7 py-1 bg-[#111b21] text-slate-100 placeholder-slate-400 text-xs rounded-lg outline-none border border-white/10 focus:border-[#00a884]"
                          />
                          {emojiSearch && (
                            <button onClick={() => setEmojiSearch("")} className="absolute right-2 top-1.5 text-slate-400 hover:text-white">
                              <X size={12} />
                            </button>
                          )}
                        </div>

                        <div className="flex-1 overflow-y-auto wa-custom-scrollbar pr-1">
                          {/* Recently Used Emojis */}
                          {!emojiSearch && recentEmojis.length > 0 && (
                            <div className="mb-2">
                              <div className="text-[10px] font-bold uppercase text-[#00a884] px-1 mb-1">Recent</div>
                              <div className="grid grid-cols-8 gap-0.5">
                                {recentEmojis.map((emo) => (
                                  <button
                                    key={emo}
                                    type="button"
                                    onClick={() => {
                                      setMessageInput((prev) => prev + emo);
                                      addRecentEmoji(emo);
                                    }}
                                    className="text-lg leading-none p-1 rounded hover:bg-white/10 active:scale-90 transition"
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
                                <div className="text-[10px] font-bold uppercase text-slate-400 px-1 mb-1">{group.label}</div>
                                <div className="grid grid-cols-8 gap-0.5">
                                  {filtered.map((emo) => (
                                    <button
                                      key={emo}
                                      type="button"
                                      onClick={() => {
                                        setMessageInput((prev) => prev + emo);
                                        addRecentEmoji(emo);
                                      }}
                                      className="text-lg leading-none p-1 rounded hover:bg-white/10 active:scale-90 transition"
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
                  <div className="flex-1 flex items-center gap-3 px-4 py-2.5 bg-[#2a3942] rounded-xl">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                    <span className="text-sm font-mono text-slate-100 tabular-nums">
                      {String(Math.floor(recordSecs / 60)).padStart(2, "0")}:{String(recordSecs % 60).padStart(2, "0")}
                    </span>
                    <span className="text-xs text-slate-400 truncate">Recording voice note…</span>
                    <button
                      type="button"
                      onClick={() => stopRecording(true)}
                      className="ml-auto text-xs font-bold text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-white/5 shrink-0"
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
                    className="flex-1 px-4 py-2 bg-[#2a3942] text-slate-100 placeholder-slate-400 rounded-2xl text-sm outline-none border border-transparent focus:border-[#00a884] wa-auto-textarea leading-relaxed max-h-32 transition-[height] duration-75"
                    disabled={sending}
                  />
                )}

                {/* Mic when there's nothing to send, Send arrow once you type — like WhatsApp */}
                {messageInput.trim() || sending ? (
                  <button
                    onClick={handleSend}
                    disabled={!messageInput.trim() || sending}
                    className="p-2.5 bg-[#00a884] text-[#111b21] font-bold rounded-full hover:bg-[#008f70] transition disabled:opacity-50 disabled:cursor-not-allowed shadow"
                    title="Send"
                  >
                    {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                  </button>
                ) : (
                  <button
                    onClick={() => (recording ? stopRecording(false) : startRecording())}
                    disabled={mediaSending}
                    className={`p-2.5 rounded-full transition shadow disabled:opacity-50 ${recording
                        ? "bg-red-500 text-white hover:bg-red-600"
                        : "bg-[#00a884] text-[#111b21] hover:bg-[#008f70]"
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
      </div>

      {/* New Direct Chat & CRM Contact Picker Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setShowNewChatModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowNewChatModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-emerald-100 text-[#25D366] rounded-xl">
                <UserPlus size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">Start New WhatsApp Chat</h3>
                <p className="text-xs text-gray-500">Enter a phone number to start a new chat directly</p>
              </div>
            </div>

            <form onSubmit={handleStartNewChat} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Mobile Number *</label>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-600 font-semibold">+91</span>
                  <input
                    type="text"
                    placeholder="e.g. 9876543210"
                    value={newChatPhone}
                    onChange={(e) => setNewChatPhone(e.target.value)}
                    className="flex-1 px-3.5 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#25D366]"
                    required
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-1">Enter 10-digit mobile number</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Contact Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={newChatName}
                  onChange={(e) => setNewChatName(e.target.value)}
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#25D366]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">First Message (Optional)</label>
                <textarea
                  rows={3}
                  placeholder="Hello! Welcome to Madhura Tech..."
                  value={newChatMessage}
                  onChange={(e) => setNewChatMessage(e.target.value)}
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#25D366] resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowNewChatModal(false)} className="px-4 py-2 border rounded-lg text-xs text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={newChatLoading || !newChatPhone.trim()}
                  className="px-5 py-2 bg-[#25D366] text-white rounded-lg text-xs font-bold hover:bg-[#1ebe5d] flex items-center gap-2 shadow-md disabled:opacity-50"
                >
                  {newChatLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  <span>Start Chat & Send</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Slide-over Contact Profile Drawer */}
      {showContactInfoDrawer && selectedChat && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end backdrop-blur-sm" onClick={() => setShowContactInfoDrawer(false)}>
          <div className="w-full max-w-sm bg-white h-full shadow-2xl p-6 overflow-y-auto relative animate-fadeIn" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowContactInfoDrawer(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>

            <div className="text-center pb-6 border-b border-gray-100">
              <div className="flex flex-col items-center justify-center mx-auto mb-3">
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
                  className="mt-2 text-[10px] text-[#00a884] font-bold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw size={11} />
                  <span>Refresh WhatsApp Photo</span>
                </button>
              </div>
              <h3 className="text-lg font-bold text-gray-800">{selectedChat.name}</h3>
              <p className="text-xs font-mono text-gray-500 mt-0.5">+{selectedChat.id?.replace(/\D/g, "")}</p>

              {selectedChat.source && (
                <span className="inline-block mt-2 text-xs font-bold px-3 py-1 rounded-full bg-blue-100 text-blue-700">
                  {selectedChat.source}
                </span>
              )}
            </div>

            {/* CRM Invoices, Quotations, and AMC History */}
            <div className="py-4 border-b border-gray-100 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Linked CRM Records</h4>
                <button
                  onClick={() => fetchContactCrmDetails(selectedChat.id)}
                  className="text-[10px] text-[#00a884] font-bold hover:underline"
                >
                  Refresh
                </button>
              </div>

              {crmDetailsLoading ? (
                <div className="py-3 text-center">
                  <Loader2 size={18} className="animate-spin text-[#00a884] mx-auto" />
                </div>
              ) : crmDetails ? (
                <div className="space-y-3 text-xs">
                  {/* Invoices list */}
                  {crmDetails.invoices && crmDetails.invoices.length > 0 && (
                    <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                      <p className="font-bold text-gray-700 mb-1.5 text-[11px]">Recent Invoices ({crmDetails.invoices.length})</p>
                      <div className="space-y-1">
                        {crmDetails.invoices.slice(0, 3).map((inv) => (
                          <div key={inv.id} className="flex justify-between text-[11px]">
                            <span className="text-gray-600 truncate">{inv.invoice_number || `INV-#${inv.id}`}</span>
                            <span className="font-bold text-gray-800">₹{parseFloat(inv.grand_total || inv.total_amount || 0).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quotations list */}
                  {crmDetails.quotations && crmDetails.quotations.length > 0 && (
                    <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                      <p className="font-bold text-gray-700 mb-1.5 text-[11px]">Quotations ({crmDetails.quotations.length})</p>
                      <div className="space-y-1">
                        {crmDetails.quotations.slice(0, 3).map((q) => (
                          <div key={q.id} className="flex justify-between text-[11px]">
                            <span className="text-gray-600 truncate">{q.quotation_number || `QTN-#${q.id}`}</span>
                            <span className="font-bold text-emerald-700">₹{parseFloat(q.grand_total || q.total_amount || 0).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AMC Contracts */}
                  {crmDetails.amc && crmDetails.amc.length > 0 && (
                    <div className="bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200/60">
                      <p className="font-bold text-emerald-800 mb-1 text-[11px]">Active AMC Contract</p>
                      <p className="text-[11px] text-emerald-900">{crmDetails.amc[0].contract_title || "Annual Maintenance"}</p>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => fetchContactCrmDetails(selectedChat.id)}
                  className="w-full py-2 bg-gray-50 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-100 transition border border-gray-200"
                >
                  Load CRM Invoices & Quotes
                </button>
              )}
            </div>

            {/* ── Add as CRM Client ─────────────────────────────────────── */}
            <div className="py-4 border-b border-gray-100 space-y-2.5">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">CRM Client Status</h4>

              {/* Already a client — show linked info */}
              {crmDetails?.client ? (
                <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200/60 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span className="text-xs font-bold text-emerald-800">Linked CRM Client</span>
                    {crmDetails.client.source && (
                      <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300/60">
                        {crmDetails.client.source}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-emerald-900 font-semibold">{crmDetails.client.name || crmDetails.client.company_name}</p>
                  {crmDetails.client.company_name && crmDetails.client.name !== crmDetails.client.company_name && (
                    <p className="text-[10px] text-emerald-700">{crmDetails.client.company_name}</p>
                  )}
                  {crmDetails.client.email && (
                    <p className="text-[10px] text-emerald-700">{crmDetails.client.email}</p>
                  )}
                  <button
                    onClick={() => navigate(`/whatsapp/contacts`)}
                    className="mt-1 text-[10px] text-emerald-700 font-bold hover:underline flex items-center gap-1"
                  >
                    <ExternalLink size={10} /> View in CRM Clients
                  </button>
                </div>
              ) : addClientResult?.success ? (
                /* Just added — show success */
                <div className={`p-3 rounded-xl border space-y-1.5 ${addClientResult.isExisting ? "bg-blue-50 border-blue-200/60" : "bg-emerald-50 border-emerald-200/60"}`}>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className={addClientResult.isExisting ? "text-blue-600" : "text-emerald-600"} />
                    <span className={`text-xs font-bold ${addClientResult.isExisting ? "text-blue-800" : "text-emerald-800"}`}>
                      {addClientResult.isExisting ? "Already in CRM" : "✅ Added to CRM!"}
                    </span>
                    <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-300/60">
                      WhatsApp
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-800 font-semibold">{addClientResult.client?.name}</p>
                  {addClientResult.client?.company_name && (
                    <p className="text-[10px] text-gray-600">{addClientResult.client.company_name}</p>
                  )}
                  <button
                    onClick={() => navigate(`/whatsapp/contacts`)}
                    className="mt-1 text-[10px] text-emerald-700 font-bold hover:underline flex items-center gap-1"
                  >
                    <ExternalLink size={10} /> View in CRM Clients
                  </button>
                </div>
              ) : showAddClientForm ? (
                /* Inline add form */
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-2">
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      placeholder="Customer Name *"
                      value={addClientData.name}
                      onChange={(e) => setAddClientData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:ring-1 focus:ring-emerald-400 focus:border-emerald-400 outline-none text-gray-800"
                    />
                    <input
                      type="text"
                      placeholder="Company Name"
                      value={addClientData.company_name}
                      onChange={(e) => setAddClientData(prev => ({ ...prev, company_name: e.target.value }))}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:ring-1 focus:ring-emerald-400 focus:border-emerald-400 outline-none text-gray-800"
                    />
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        type="email"
                        placeholder="Email"
                        value={addClientData.email}
                        onChange={(e) => setAddClientData(prev => ({ ...prev, email: e.target.value }))}
                        className="px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:ring-1 focus:ring-emerald-400 focus:border-emerald-400 outline-none text-gray-800"
                      />
                      <input
                        type="text"
                        placeholder="City"
                        value={addClientData.city}
                        onChange={(e) => setAddClientData(prev => ({ ...prev, city: e.target.value }))}
                        className="px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:ring-1 focus:ring-emerald-400 focus:border-emerald-400 outline-none text-gray-800"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Service / Product Interest"
                      value={addClientData.service}
                      onChange={(e) => setAddClientData(prev => ({ ...prev, service: e.target.value }))}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:ring-1 focus:ring-emerald-400 focus:border-emerald-400 outline-none text-gray-800"
                    />
                    <textarea
                      placeholder="Notes (optional)"
                      value={addClientData.notes}
                      onChange={(e) => setAddClientData(prev => ({ ...prev, notes: e.target.value }))}
                      rows={2}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:ring-1 focus:ring-emerald-400 focus:border-emerald-400 outline-none text-gray-800 resize-none"
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
                          // Refresh CRM details
                          fetchContactCrmDetails(selectedChat.id);
                        } catch (err) {
                          alert(err.response?.data?.error || "Failed to add client");
                        }
                        setAddClientLoading(false);
                      }}
                      className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                    >
                      {addClientLoading ? (
                        <><Loader2 size={13} className="animate-spin" /> Saving...</>
                      ) : (
                        <><UserPlus size={13} /> Save as Client</>
                      )}
                    </button>
                    <button
                      onClick={() => { setShowAddClientForm(false); setAddClientData({ name: "", company_name: "", email: "", city: "", service: "", notes: "" }); }}
                      className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-xs font-semibold transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* Show "Add as Client" button */
                <button
                  onClick={() => {
                    // Pre-fill name from chat
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
                  className="w-full py-2.5 px-3.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300/80 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition"
                >
                  <UserPlus size={15} className="text-emerald-600" />
                  <span>Add as CRM Client (Source: WhatsApp)</span>
                </button>
              )}
            </div>

            {/* WhatsApp CRM & Marketing Hub Navigation Bar */}
            <div className="py-4 border-b border-gray-100 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">⚡ Unified WhatsApp Hub</h4>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">All Linked</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => navigate("/whatsapp/campaigns")}
                  className="flex items-center gap-2 p-2.5 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-xl transition text-xs font-semibold text-left border border-blue-200/60"
                >
                  <SendHorizontal size={15} className="text-blue-600 shrink-0" />
                  <span className="truncate">Bulk Campaigns</span>
                </button>

                <button
                  onClick={() => navigate("/whatsapp/automations")}
                  className="flex items-center gap-2 p-2.5 bg-purple-50 hover:bg-purple-100 text-purple-800 rounded-xl transition text-xs font-semibold text-left border border-purple-200/60"
                >
                  <Sparkles size={15} className="text-purple-600 shrink-0" />
                  <span className="truncate">Automations</span>
                </button>

                <button
                  onClick={() => navigate("/whatsapp/flows")}
                  className="flex items-center gap-2 p-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl transition text-xs font-semibold text-left border border-amber-200/60"
                >
                  <Zap size={15} className="text-amber-600 shrink-0" />
                  <span className="truncate">Chatbot Flows</span>
                </button>

                <button
                  onClick={() => navigate("/whatsapp/reminders")}
                  className="flex items-center gap-2 p-2.5 bg-orange-50 hover:bg-orange-100 text-orange-800 rounded-xl transition text-xs font-semibold text-left border border-orange-200/60"
                >
                  <Bell size={15} className="text-orange-600 shrink-0" />
                  <span className="truncate">Reminders</span>
                </button>
              </div>
            </div>

            {/* Quick Actions & Instant Bot Tools */}
            <div className="py-4 space-y-2.5">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Execute for this Contact</h4>
              
              <button
                onClick={() => {
                  setShowContactInfoDrawer(false);
                  setShowFlowModal(true);
                }}
                className="w-full py-2.5 px-3.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300/80 rounded-xl text-xs font-bold flex items-center justify-between transition"
              >
                <div className="flex items-center gap-2">
                  <Zap size={15} className="text-amber-600" />
                  <span>Launch Chatbot Flow</span>
                </div>
                <span className="text-[10px] bg-amber-200/70 px-2 py-0.5 rounded-full font-mono">5 Bots</span>
              </button>

              <button
                onClick={() => {
                  setShowContactInfoDrawer(false);
                  fetchAutomations();
                  setShowAutomationModal(true);
                }}
                className="w-full py-2.5 px-3.5 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-300/80 rounded-xl text-xs font-bold flex items-center justify-between transition"
              >
                <div className="flex items-center gap-2">
                  <Sparkles size={15} className="text-purple-600" />
                  <span>Trigger CRM Automation</span>
                </div>
                <span className="text-[10px] bg-purple-200/70 px-2 py-0.5 rounded-full font-mono">11 Rules</span>
              </button>

              <button
                onClick={() => {
                  setShowContactInfoDrawer(false);
                  setShowReminderModal(true);
                }}
                className="w-full py-2.5 px-3.5 bg-orange-50 hover:bg-orange-100 text-orange-900 border border-orange-300/80 rounded-xl text-xs font-bold flex items-center justify-between transition"
              >
                <div className="flex items-center gap-2">
                  <Bell size={15} className="text-orange-600" />
                  <span>Send 2-Way Interactive Reminder</span>
                </div>
                <span className="text-[10px] bg-orange-200/70 px-2 py-0.5 rounded-full font-mono">Buttons</span>
              </button>

              <button
                onClick={() => {
                  setShowContactInfoDrawer(false);
                  fetchCampaignGroups();
                  setShowAddToGroupModal(true);
                }}
                className="w-full py-2.5 px-3.5 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-300/80 rounded-xl text-xs font-bold flex items-center justify-between transition"
              >
                <div className="flex items-center gap-2">
                  <Users size={15} className="text-blue-600" />
                  <span>Enroll in Campaign Group</span>
                </div>
                <span className="text-[10px] bg-blue-200/70 px-2 py-0.5 rounded-full font-mono">Bulk</span>
              </button>

              <button
                onClick={() => {
                  setShowContactInfoDrawer(false);
                  fetchDripSequences();
                  setShowDripModal(true);
                }}
                className="w-full py-2.5 px-3.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-300/80 rounded-xl text-xs font-bold flex items-center justify-between transition"
              >
                <div className="flex items-center gap-2">
                  <Sparkles size={15} className="text-indigo-600" />
                  <span>Enroll in Drip Sequence</span>
                </div>
                <span className="text-[10px] bg-indigo-200/70 px-2 py-0.5 rounded-full font-mono">Nurture</span>
              </button>

              <button
                onClick={() => {
                  setShowContactInfoDrawer(false);
                  setShowOptionsModal(true);
                }}
                className="w-full py-2.5 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300/80 rounded-xl text-xs font-bold flex items-center justify-between transition"
              >
                <div className="flex items-center gap-2">
                  <ListOrdered size={15} className="text-slate-600" />
                  <span>Send Inquiry Options Menu</span>
                </div>
                <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded-full font-mono">Quick</span>
              </button>

              <a
                href={`tel:+${selectedChat.id?.replace(/\D/g, "")}`}
                className="w-full py-2.5 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300/80 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition"
              >
                <PhoneCall size={15} className="text-emerald-600" />
                <span>Direct Call +{selectedChat.id?.replace(/\D/g, "")}</span>
              </a>

              <button
                onClick={() => setShowContactInfoDrawer(false)}
                className="w-full py-2.5 px-4 bg-[#00a884] text-white rounded-xl text-xs font-bold hover:bg-[#008f70] transition shadow"
              >
                Return to Chat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trigger Chatbot Flow Modal */}
      {showFlowModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setShowFlowModal(false)}>
          <div className="bg-[#111b21] border border-[#222d34] rounded-2xl w-full max-w-lg p-6 shadow-2xl relative text-slate-200" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowFlowModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-4 border-b border-[#222d34] pb-3">
              <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl">
                <Zap size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Trigger Chatbot Flow</h3>
                <p className="text-xs text-slate-400">Launch an automated multi-step chatbot flow for <span className="text-[#00a884] font-semibold">{selectedChat?.name}</span></p>
              </div>
            </div>

            {flowsLoading ? (
              <div className="py-12 text-center">
                <Loader2 size={32} className="animate-spin text-[#00a884] mx-auto mb-3" />
                <p className="text-xs text-slate-400">Loading chatbot flows...</p>
              </div>
            ) : flows.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 space-y-3">
                <p>No Chatbot Flows created yet.</p>
                <button
                  onClick={() => navigate("/whatsapp/flows")}
                  className="px-4 py-2 bg-[#00a884] text-[#111b21] rounded-xl text-xs font-bold hover:bg-[#008f70] transition"
                >
                  Create Flow in Flow Builder
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-300">Select a flow to execute:</p>
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {flows.map((fl) => (
                    <div
                      key={fl.id}
                      onClick={() => setSelectedFlowId(fl.id)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition flex items-center justify-between ${selectedFlowId === fl.id ? "bg-[#005c4b]/40 border-[#00a884] text-white" : "bg-[#202c33] border-[#2a3942] hover:bg-[#2a3942] text-slate-200"}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-xs truncate">{fl.name}</p>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/40 text-slate-300 font-mono">
                            {fl.node_count || 1} nodes
                          </span>
                        </div>
                        {fl.description && <p className="text-[11px] text-slate-400 truncate mt-0.5">{fl.description}</p>}
                      </div>
                      {selectedFlowId === fl.id && <CheckCircle2 size={18} className="text-[#00a884] shrink-0 ml-2" />}
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-[#222d34]">
                  <button
                    onClick={() => navigate("/whatsapp/flows")}
                    className="text-xs text-[#00a884] hover:underline font-bold"
                  >
                    Open Flow Builder →
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowFlowModal(false)}
                      className="px-4 py-2 bg-[#202c33] hover:bg-[#2a3942] rounded-xl text-xs text-slate-300 font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!selectedFlowId || triggeringFlow}
                      onClick={() => handleTriggerFlow(selectedFlowId)}
                      className="px-5 py-2 bg-[#00a884] text-[#111b21] rounded-xl text-xs font-bold hover:bg-[#008f70] transition flex items-center gap-1.5 disabled:opacity-50 shadow"
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
          <div className="bg-[#111b21] border border-[#222d34] rounded-2xl w-full max-w-xl p-5 md:p-6 shadow-2xl relative text-slate-200 max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowOptionsModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition">
              <X size={20} />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3 mb-4 border-b border-[#222d34] pb-3 shrink-0">
              <div className="p-3 bg-[#00a884]/20 text-[#00a884] rounded-xl">
                <ListOrdered size={24} />
              </div>
              <div>
                <h3 className="text-base md:text-lg font-bold text-white flex items-center gap-2">
                  <span>Send WhatsApp Interactive Buttons & Flow Menu</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Send authentic action buttons (Call Now, Web Links & Quick Replies) or launch a Chatbot Flow for <span className="text-[#00a884] font-semibold">{selectedChat?.name || "Customer"}</span>
                </p>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="space-y-4 overflow-y-auto wa-custom-scrollbar pr-1 flex-1">
              {/* Optional Flow Bot Selector */}
              <div className="p-3 bg-[#202c33]/60 rounded-xl border border-[#2a3942]">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Zap size={14} className="text-amber-400" />
                    <span>Attach Chatbot Flow (Optional)</span>
                  </label>
                  {optionsMenuBotFlowId && (
                    <button
                      type="button"
                      onClick={() => setOptionsMenuBotFlowId("")}
                      className="text-[10px] text-amber-400 hover:underline"
                    >
                      Clear Flow
                    </button>
                  )}
                </div>
                <select
                  value={optionsMenuBotFlowId}
                  onChange={(e) => setOptionsMenuBotFlowId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#111b21] border border-[#2a3942] rounded-lg text-xs text-slate-200 outline-none focus:border-[#00a884]"
                >
                  <option value="">None (Standard Interactive Buttons)</option>
                  {flows.map((fl) => (
                    <option key={fl.id} value={fl.id}>
                      🤖 Flow Bot: {fl.name} ({fl.node_count || 1} nodes)
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  {optionsMenuBotFlowId ? (
                    <span className="text-amber-300 font-medium">⚡ Customer clicking options will trigger automated multi-step chatbot replies from this flow!</span>
                  ) : (
                    "When customer clicks a button, it responds with the selected action or quick reply text."
                  )}
                </p>
              </div>

              {/* Message Header / Body Prompt */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                  Message Header / Prompt Text
                </label>
                <textarea
                  rows={3}
                  value={optionsMenuTitle}
                  onChange={(e) => setOptionsMenuTitle(e.target.value)}
                  placeholder="e.g. Welcome to Madhura Tech! Please choose an option below:"
                  className="w-full px-3.5 py-2.5 bg-[#202c33] border border-[#2a3942] rounded-xl text-xs text-white outline-none focus:border-[#00a884] resize-none"
                />
              </div>

              {/* Buttons Editor */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-300 uppercase">
                    Interactive Buttons ({optionsMenuItems.length})
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setOptionsMenuItems((prev) => [...prev, { type: "reply", text: `Option ${prev.length + 1}` }])}
                      className="px-2 py-1 bg-[#00a884]/20 hover:bg-[#00a884]/30 text-[#00a884] rounded-lg text-[11px] font-bold transition flex items-center gap-1"
                      title="Add Quick Reply Button"
                    >
                      <CornerDownLeft size={12} />
                      <span>+ Reply</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setOptionsMenuItems((prev) => [...prev, { type: "call", text: "Call Now", phone: "+91 " }])}
                      className="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg text-[11px] font-bold transition flex items-center gap-1"
                      title="Add Call Now Button"
                    >
                      <Phone size={12} />
                      <span>+ Call</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setOptionsMenuItems((prev) => [...prev, { type: "url", text: "Apply Now", url: "https://" }])}
                      className="px-2 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg text-[11px] font-bold transition flex items-center gap-1"
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
                      <div key={idx} className="p-2.5 bg-[#202c33] border border-[#2a3942] rounded-xl space-y-2">
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
                            className="bg-[#111b21] border border-[#2a3942] text-[#00a884] font-bold text-xs rounded-lg px-2 py-1.5 outline-none"
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
                            className="flex-1 px-3 py-1.5 bg-[#111b21] border border-[#2a3942] rounded-lg text-xs text-white outline-none focus:border-[#00a884]"
                          />

                          {optionsMenuItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setOptionsMenuItems(optionsMenuItems.filter((_, i) => i !== idx))}
                              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-white/5 rounded-lg transition"
                              title="Delete button"
                            >
                              <X size={15} />
                            </button>
                          )}
                        </div>

                        {itemObj.type === "call" && (
                          <div className="flex items-center gap-2 pl-2">
                            <Phone size={13} className="text-emerald-400 shrink-0" />
                            <input
                              type="tel"
                              value={itemObj.phone || ""}
                              onChange={(e) => {
                                const updated = [...optionsMenuItems];
                                updated[idx] = { ...itemObj, phone: e.target.value };
                                setOptionsMenuItems(updated);
                              }}
                              placeholder="Phone Number (e.g. +91 98765 43210)"
                              className="flex-1 px-2.5 py-1 bg-[#111b21] border border-[#2a3942] rounded-lg text-xs text-emerald-300 outline-none focus:border-emerald-400"
                            />
                          </div>
                        )}

                        {itemObj.type === "url" && (
                          <div className="flex items-center gap-2 pl-2">
                            <ExternalLink size={13} className="text-blue-400 shrink-0" />
                            <input
                              type="url"
                              value={itemObj.url || ""}
                              onChange={(e) => {
                                const updated = [...optionsMenuItems];
                                updated[idx] = { ...itemObj, url: e.target.value };
                                setOptionsMenuItems(updated);
                              }}
                              placeholder="Web URL (e.g. https://example.com/apply)"
                              className="flex-1 px-2.5 py-1 bg-[#111b21] border border-[#2a3942] rounded-lg text-xs text-blue-300 outline-none focus:border-blue-400"
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
                  <p className="text-[10px] font-bold text-[#00a884] uppercase tracking-wider">
                    Live WhatsApp Customer Preview:
                  </p>
                  <span className="text-[10px] text-slate-400">Matches official WhatsApp client UI</span>
                </div>

                <div className="p-3 bg-[#0b141a] rounded-xl border border-white/10 flex justify-start">
                  <div className="max-w-[85%] bg-[#202c33] rounded-lg p-2.5 text-xs text-white shadow-md relative">
                    <p className="whitespace-pre-wrap break-words">{optionsMenuTitle || "Please choose an option:"}</p>
                    <div className="flex justify-end mt-1 text-[10px] text-slate-400">
                      <span>1:58 pm</span>
                    </div>

                    {/* Button Rows */}
                    {optionsMenuItems.filter((it) => (typeof it === "string" ? it.trim() : it.text?.trim())).length > 0 && (
                      <div className="mt-2 -mx-2.5 -mb-2.5 border-t border-white/10 divide-y divide-white/10 overflow-hidden rounded-b-lg">
                        {optionsMenuItems
                          .filter((it) => (typeof it === "string" ? it.trim() : it.text?.trim()))
                          .map((it, bIdx) => {
                            const btn = typeof it === "string" ? { type: "reply", text: it } : it;
                            return (
                              <div
                                key={bIdx}
                                className="w-full py-2.5 px-3 flex items-center justify-center gap-2 text-xs font-semibold text-[#00a884] bg-white/[0.02]"
                              >
                                {btn.type === "call" ? (
                                  <Phone size={13} className="text-[#00a884] shrink-0" />
                                ) : btn.type === "url" ? (
                                  <ExternalLink size={13} className="text-[#00a884] shrink-0" />
                                ) : (
                                  <CornerDownLeft size={13} className="text-[#00a884] shrink-0" />
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
            <div className="flex flex-col sm:flex-row justify-between items-center gap-2 pt-4 border-t border-[#222d34] mt-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowOptionsModal(false)}
                className="w-full sm:w-auto px-4 py-2 bg-[#202c33] hover:bg-[#2a3942] rounded-xl text-xs text-slate-300 font-semibold transition"
              >
                Cancel
              </button>
              <div className="flex w-full sm:w-auto gap-2">
                <button
                  type="button"
                  onClick={handleInsertOptionsMenuToComposer}
                  className="flex-1 sm:flex-initial px-4 py-2 bg-[#202c33] hover:bg-[#2a3942] border border-[#2a3942] text-slate-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                  title="Insert formatted text into the message composer"
                >
                  <Send size={14} />
                  <span>Insert into Composer</span>
                </button>
                <button
                  type="button"
                  onClick={handleSendInteractiveMenuNow}
                  className="flex-1 sm:flex-initial px-5 py-2 bg-[#00a884] hover:bg-[#008f70] text-[#111b21] rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-lg active:scale-95"
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
          <div className="bg-[#111b21] border border-[#222d34] rounded-2xl w-full max-w-md p-6 shadow-2xl relative text-slate-200" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowPaymentModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-4 border-b border-[#222d34] pb-3">
              <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl">
                <CreditCard size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Request WhatsApp Payment</h3>
                <p className="text-xs text-slate-400">Generate 0% markup direct payment link for <span className="text-[#00a884] font-semibold">{selectedChat?.name}</span></p>
              </div>
            </div>

            <form onSubmit={handleCreatePaymentRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Amount Due (INR ₹) *</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    placeholder="e.g. 5000"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    required
                    className="w-full pl-8 pr-3.5 py-2.5 bg-[#202c33] border border-[#2a3942] rounded-xl text-white font-bold outline-none focus:border-[#00a884]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Payment Description *</label>
                <input
                  type="text"
                  value={paymentDesc}
                  onChange={(e) => setPaymentDesc(e.target.value)}
                  placeholder="e.g. Annual Maintenance Contract / Service A"
                  required
                  className="w-full px-3.5 py-2.5 bg-[#202c33] border border-[#2a3942] rounded-xl text-xs text-white outline-none focus:border-[#00a884]"
                />
              </div>

              <div className="p-3 bg-[#0b141a] rounded-xl border border-white/10 space-y-1 text-xs">
                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">0% Markup Guarantee:</p>
                <p className="text-slate-300 text-[11px]">Instant UPI / Payment link generated directly without 3rd-party aggregator markup fees. Real-time webhook marks invoice paid.</p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#222d34]">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 bg-[#202c33] hover:bg-[#2a3942] rounded-xl text-xs text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingPayment || !paymentAmount}
                  className="px-5 py-2 bg-[#00a884] text-[#111b21] rounded-xl text-xs font-bold hover:bg-[#008f70] transition flex items-center gap-1.5 disabled:opacity-50 shadow"
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
          <div className="bg-[#111b21] border border-[#222d34] rounded-2xl w-full max-w-lg p-6 shadow-2xl relative text-slate-200" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowDripModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-4 border-b border-[#222d34] pb-3">
              <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-xl">
                <Sparkles size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Enroll in Drip Sequence</h3>
                <p className="text-xs text-slate-400">Automated multi-day follow-up and nurturing for <span className="text-[#00a884] font-semibold">{selectedChat?.name}</span></p>
              </div>
            </div>

            {dripLoading ? (
              <div className="py-12 text-center">
                <Loader2 size={32} className="animate-spin text-[#00a884] mx-auto mb-3" />
                <p className="text-xs text-slate-400">Loading drip sequences...</p>
              </div>
            ) : dripSequences.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 space-y-3">
                <p>No active drip campaigns created yet.</p>
                <button
                  onClick={() => navigate("/whatsapp/automations")}
                  className="px-4 py-2 bg-[#00a884] text-[#111b21] rounded-xl text-xs font-bold hover:bg-[#008f70] transition"
                >
                  Create Drip Sequence in Automations
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-300">Select a drip sequence:</p>
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {dripSequences.map((seq) => (
                    <div
                      key={seq.id}
                      onClick={() => setSelectedDripId(seq.id)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition flex items-center justify-between ${selectedDripId === seq.id ? "bg-indigo-950/60 border-indigo-500 text-white" : "bg-[#202c33] border-[#2a3942] hover:bg-[#2a3942] text-slate-200"}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-xs truncate">{seq.name}</p>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/40 text-indigo-300 font-mono">
                            {seq.step_count || 1} steps
                          </span>
                        </div>
                        {seq.description && <p className="text-[11px] text-slate-400 truncate mt-0.5">{seq.description}</p>}
                      </div>
                      {selectedDripId === seq.id && <CheckCircle2 size={18} className="text-[#00a884] shrink-0 ml-2" />}
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-[#222d34]">
                  <button
                    onClick={() => navigate("/whatsapp/automations")}
                    className="text-xs text-[#00a884] hover:underline font-bold"
                  >
                    Manage Sequences →
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowDripModal(false)}
                      className="px-4 py-2 bg-[#202c33] hover:bg-[#2a3942] rounded-xl text-xs text-slate-300 font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!selectedDripId || enrollingDrip}
                      onClick={() => handleEnrollDrip(selectedDripId)}
                      className="px-5 py-2 bg-[#00a884] text-[#111b21] rounded-xl text-xs font-bold hover:bg-[#008f70] transition flex items-center gap-1.5 disabled:opacity-50 shadow"
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

      {/* Shared Team Inbox Internal Notes Slide-over Drawer */}
      {showNotesDrawer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-end backdrop-blur-xs animate-fadeIn" onClick={() => setShowNotesDrawer(false)}>
          <div className="w-full max-w-sm bg-[#111b21] border-l border-[#222d34] h-full flex flex-col shadow-2xl p-5 text-slate-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-[#222d34]">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
                  <FileText size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Internal Team Notes</h3>
                  <p className="text-[11px] text-slate-400">Private notes for CRM agents (hidden from customer)</p>
                </div>
              </div>
              <button onClick={() => setShowNotesDrawer(false)} className="p-1 text-slate-400 hover:text-white rounded-full">
                <X size={18} />
              </button>
            </div>

            {/* Notes List */}
            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {notesLoading ? (
                <div className="py-10 text-center">
                  <Loader2 size={24} className="animate-spin text-[#00a884] mx-auto" />
                </div>
              ) : internalNotes.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 space-y-1">
                  <p className="font-bold text-slate-300">No internal notes yet</p>
                  <p>Add private notes below to collaborate with colleagues.</p>
                </div>
              ) : (
                internalNotes.map((note) => (
                  <div key={note.id} className="p-3 bg-[#1e293b] border border-amber-500/30 rounded-xl space-y-1.5 shadow-sm">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-amber-400 flex items-center gap-1">
                        👤 {note.author_name}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(note.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-200 whitespace-pre-wrap">{note.note_text}</p>
                  </div>
                ))
              )}
            </div>

            {/* Add Note Input */}
            <form onSubmit={handleCreateInternalNote} className="pt-3 border-t border-[#222d34] space-y-2">
              <textarea
                rows={3}
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                placeholder="Type private note or @colleague mention..."
                className="w-full px-3 py-2 bg-[#202c33] border border-[#2a3942] rounded-xl text-xs text-white outline-none focus:border-amber-400 resize-none"
                required
              />
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-amber-400/80">🔒 Only visible to team members</span>
                <button
                  type="submit"
                  disabled={submittingNote || !newNoteText.trim()}
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs rounded-lg transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submittingNote ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                  <span>Save Note</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Account Messaging Quota Balance Modal */}
      {showAccountBalanceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setShowAccountBalanceModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowAccountBalanceModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-5 border-b border-gray-100 pb-3">
              <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl">
                <CreditCard size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">WhatsApp Engine & Quota Balance</h3>
                <p className="text-xs text-gray-500">Live messaging analytics and connection status</p>
              </div>
            </div>

            {accountBalanceLoading ? (
              <div className="py-12 text-center">
                <Loader2 size={32} className="animate-spin text-emerald-600 mx-auto mb-3" />
                <p className="text-sm font-semibold text-gray-600">Checking account quota balance...</p>
              </div>
            ) : accountBalance?.error ? (
              <div className="p-4 bg-red-50 text-red-700 rounded-xl text-xs font-semibold">
                {accountBalance.error}
              </div>
            ) : accountBalance ? (
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-xl space-y-2 border border-gray-100">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500 font-medium">Connection Status:</span>
                    <span className={`font-bold px-2.5 py-0.5 rounded-full text-xs flex items-center gap-1 ${accountBalance.connected ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"}`}>
                      <span className={`w-2 h-2 rounded-full ${accountBalance.connected ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`}></span>
                      {accountBalance.connected ? "Connected & Active" : "Disconnected"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500 font-medium">Active Engine:</span>
                    <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-xs">
                      {accountBalance.activeEngine}
                    </span>
                  </div>
                  {accountBalance.phone && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500 font-medium">Sender Number:</span>
                      <span className="font-mono text-gray-800">+{accountBalance.phone}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl">
                    <p className="text-[10px] font-bold uppercase text-emerald-700">Messages Today</p>
                    <p className="text-xl font-extrabold text-emerald-900 mt-1">{accountBalance.todaySent.toLocaleString()}</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl">
                    <p className="text-[10px] font-bold uppercase text-blue-700">Total Outbound</p>
                    <p className="text-xl font-extrabold text-blue-900 mt-1">{accountBalance.totalSent.toLocaleString()}</p>
                  </div>
                  <div className="bg-teal-50 border border-teal-100 p-3 rounded-xl">
                    <p className="text-[10px] font-bold uppercase text-teal-700">Delivered</p>
                    <p className="text-xl font-extrabold text-teal-900 mt-1">{accountBalance.totalDelivered.toLocaleString()}</p>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 p-3 rounded-xl">
                    <p className="text-[10px] font-bold uppercase text-gray-600">Failed / Bounced</p>
                    <p className="text-xl font-extrabold text-gray-700 mt-1">{accountBalance.totalFailed.toLocaleString()}</p>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => setShowAccountBalanceModal(false)}
                    className="px-5 py-2 bg-[#25D366] text-white rounded-lg text-xs font-bold hover:bg-[#1ebe5d] transition shadow"
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
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowCreateTemplateModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-4 border-b border-gray-100 pb-3">
              <div className="p-3 bg-emerald-100 text-[#25D366] rounded-xl">
                <FileText size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">Create WhatsApp Template</h3>
                <p className="text-xs text-gray-500">Draft & save template with full Markdown support</p>
              </div>
            </div>

            <form onSubmit={handleCreateTemplate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Template Identifier *</label>
                <input
                  type="text"
                  placeholder="e.g. promotional_discount_offer"
                  value={newTmplName}
                  onChange={(e) => setNewTmplName(e.target.value)}
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[#25D366]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Category</label>
                <select
                  value={newTmplCategory}
                  onChange={(e) => setNewTmplCategory(e.target.value)}
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[#25D366]"
                >
                  <option value="MARKETING">MARKETING</option>
                  <option value="UTILITY">UTILITY</option>
                  <option value="AUTHENTICATION">AUTHENTICATION</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-gray-600 uppercase">Template Content (Supports Markdown & Dynamic Placeholders) *</label>
                  <span className="text-[10px] text-gray-400 font-mono">{(newTmplBody || "").length} chars</span>
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
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[#25D366] font-mono leading-relaxed resize-none"
                  required
                />
                <p className="text-[10px] text-gray-400 mt-1">Supports Markdown headers (#), bold (**), and dynamic tokens ({"{tomorrow}"}, {"{tomorrow_day}"}, {"{day}"}, {"{time}"}, {"{date}"})</p>
              </div>

              {/* Live Markdown & Dynamic Evaluated Preview */}
              {newTmplBody.trim() && (
                <div className="p-3 bg-[#0b141a] rounded-xl border border-white/10 text-white space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">
                    <span>Live Chat Evaluated Preview:</span>
                    <span className="text-amber-300 font-mono text-[9px]">Multi-Dynamic Active</span>
                  </div>
                  <RichMessageContent text={evaluateMessagePlaceholders(newTmplBody, { name: selectedChat?.name && !selectedChat.name.startsWith("+") ? selectedChat.name : "Rajesh Kumar" })} isMe={true} />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateTemplateModal(false)} className="px-4 py-2 border rounded-lg text-xs text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={tmplLoading || !newTmplName.trim() || !newTmplBody.trim()}
                  className="px-5 py-2 bg-[#25D366] text-white rounded-lg text-xs font-bold hover:bg-[#1ebe5d] flex items-center gap-2 shadow-md disabled:opacity-50"
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
          <div className="bg-[#111b21] border border-[#222d34] rounded-2xl w-full max-w-lg p-6 shadow-2xl relative text-slate-200" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowReminderModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-4 border-b border-[#222d34] pb-3">
              <div className="p-3 bg-orange-500/20 text-orange-400 rounded-xl">
                <Bell size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Send Interactive Reminder</h3>
                <p className="text-xs text-slate-400">
                  Deliver 2-way confirmation notice to <span className="text-[#00a884] font-semibold">{selectedChat.name}</span> (+{selectedChat.id.replace(/\D/g, "")})
                </p>
              </div>
            </div>

            <div className="space-y-4 max-h-[72vh] overflow-y-auto pr-1">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">Reminder Category</label>
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
                      className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition ${
                        reminderType === cat.id
                          ? "bg-orange-500/20 border-orange-500 text-orange-200"
                          : "bg-[#202c33] border-[#2a3942] text-slate-300 hover:bg-[#2a3942]"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Title / Notification Tag</label>
                <input
                  type="text"
                  value={reminderTitle}
                  onChange={(e) => setReminderTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-[#202c33] border border-[#2a3942] rounded-xl text-xs text-slate-200 outline-none focus:border-[#00a884]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-300 uppercase">Message Body</label>
                  <span className="text-[10px] text-[#00a884] font-mono">Placeholders Supported</span>
                </div>
                <textarea
                  value={reminderText}
                  onChange={(e) => setReminderText(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 bg-[#202c33] border border-[#2a3942] rounded-xl text-xs text-slate-200 outline-none focus:border-[#00a884] resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">
                  Interactive Response Buttons (Customer taps on WhatsApp)
                </label>
                <div className="space-y-1.5">
                  {reminderOptions.map((opt, idx) => (
                    <div key={opt.id || idx} className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-400 w-5 text-right">{idx + 1}.</span>
                      <input
                        type="text"
                        value={opt.label}
                        onChange={(e) => {
                          const updated = [...reminderOptions];
                          updated[idx] = { ...updated[idx], label: e.target.value };
                          setReminderOptions(updated);
                        }}
                        className="flex-1 px-3 py-1.5 bg-[#202c33] border border-[#2a3942] rounded-lg text-xs text-slate-200 outline-none focus:border-[#00a884]"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                <label className="block text-xs font-bold text-amber-300 uppercase mb-1 flex items-center gap-1.5">
                  <Zap size={13} className="text-amber-400" />
                  Auto-Launch Flow Bot on Response (Optional)
                </label>
                <select
                  value={reminderFlowId}
                  onChange={(e) => setReminderFlowId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#202c33] border border-amber-500/40 rounded-xl text-xs text-slate-200 outline-none focus:border-amber-400"
                >
                  <option value="">None (Standard Confirmation Acknowledgment)</option>
                  {flows.map((fl) => (
                    <option key={fl.id} value={fl.id}>
                      🤖 {fl.name}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-amber-300/80 mt-1 leading-relaxed">
                  When the customer responds to this reminder, our bot engine will automatically engage them in this conversational flow!
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-[#222d34] mt-4">
              <button
                type="button"
                onClick={() => setShowReminderModal(false)}
                className="px-4 py-2 bg-[#202c33] hover:bg-[#2a3942] rounded-xl text-xs text-slate-300 font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={sendingReminder || !reminderText.trim()}
                onClick={handleSendReminderNow}
                className="px-5 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl text-xs font-bold hover:brightness-110 disabled:opacity-50 transition shadow-lg flex items-center gap-1.5"
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
          <div className="bg-[#111b21] border border-[#222d34] rounded-2xl w-full max-w-lg p-6 shadow-2xl relative text-slate-200" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowAddToGroupModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-4 border-b border-[#222d34] pb-3">
              <div className="p-3 bg-blue-500/20 text-blue-400 rounded-xl">
                <Users size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Enroll in Bulk Campaign Group</h3>
                <p className="text-xs text-slate-400">
                  Add <span className="text-[#00a884] font-semibold">{selectedChat.name}</span> (+{selectedChat.id.replace(/\D/g, "")}) to campaign target lists
                </p>
              </div>
            </div>

            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
              <div>
                <p className="text-xs font-bold text-slate-300 uppercase mb-2">Select Target Group(s):</p>
                {groupsLoading ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    <Loader2 size={24} className="animate-spin text-[#00a884] mx-auto mb-2" />
                    Loading campaign groups...
                  </div>
                ) : campaignGroups.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3 text-center">No campaign groups found. Create one below!</p>
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
                          className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                            isSelected
                              ? "bg-blue-500/20 border-blue-500 text-white"
                              : "bg-[#202c33] border-[#2a3942] text-slate-300 hover:bg-[#2a3942]"
                          }`}
                        >
                          <div>
                            <p className="text-xs font-bold">{grp.name}</p>
                            {grp.description && <p className="text-[11px] text-slate-400 mt-0.5">{grp.description}</p>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/40 text-slate-300 font-mono">
                              {grp.contact_count || grp.total_contacts || 0} contacts
                            </span>
                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? "bg-blue-500 border-blue-500 text-white" : "border-slate-500"}`}>
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
              <div className="p-3 bg-[#182229] rounded-xl border border-[#222d34] space-y-2">
                <label className="block text-[11px] font-bold text-slate-400 uppercase">Or Create New Campaign Group</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="e.g. High-Value Clients, Festive 2026..."
                    className="flex-1 px-3 py-1.5 bg-[#202c33] border border-[#2a3942] rounded-lg text-xs text-slate-200 outline-none focus:border-[#00a884]"
                  />
                  <button
                    type="button"
                    disabled={creatingGroup || !newGroupName.trim()}
                    onClick={handleCreateNewGroupAndAdd}
                    className="px-3 py-1.5 bg-[#00a884] text-[#111b21] rounded-lg text-xs font-bold hover:bg-[#008f70] disabled:opacity-50 transition shrink-0"
                  >
                    {creatingGroup ? "Creating..." : "Create & Add"}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-[#222d34] mt-4">
              <button
                type="button"
                onClick={() => navigate("/whatsapp/campaigns")}
                className="text-xs text-blue-400 hover:underline font-bold"
              >
                Open Campaigns Manager →
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddToGroupModal(false)}
                  className="px-4 py-2 bg-[#202c33] hover:bg-[#2a3942] rounded-xl text-xs text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={addingToGroup || selectedGroupIds.length === 0}
                  onClick={handleAddToCampaignGroups}
                  className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-500 disabled:opacity-50 transition shadow flex items-center gap-1.5"
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
          <div className="bg-[#111b21] border border-[#222d34] rounded-2xl w-full max-w-lg p-6 shadow-2xl relative text-slate-200" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowAutomationModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-4 border-b border-[#222d34] pb-3">
              <div className="p-3 bg-purple-500/20 text-purple-400 rounded-xl">
                <Sparkles size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Execute CRM Automation Workflow</h3>
                <p className="text-xs text-slate-400">
                  Trigger automated CRM message sequence for <span className="text-[#00a884] font-semibold">{selectedChat.name}</span>
                </p>
              </div>
            </div>

            <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
              <p className="text-xs font-bold text-slate-300 uppercase">Select Active Automation Rule:</p>
              {automationsLoading ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  <Loader2 size={24} className="animate-spin text-purple-400 mx-auto mb-2" />
                  Loading automation rules...
                </div>
              ) : automations.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">No active automations found.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {automations.map((rule) => {
                    const isSelected = selectedAutomationId === rule.id;
                    return (
                      <div
                        key={rule.id}
                        onClick={() => setSelectedAutomationId(rule.id)}
                        className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                          isSelected
                            ? "bg-purple-500/20 border-purple-500 text-white"
                            : "bg-[#202c33] border-[#2a3942] text-slate-300 hover:bg-[#2a3942]"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs font-bold text-slate-100">{rule.name}</p>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/40 text-purple-300 font-mono">
                              {rule.trigger_label || rule.trigger_type}
                            </span>
                            {rule.flow_name && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                                🤖 {rule.flow_name}
                              </span>
                            )}
                          </div>
                          {rule.message_text && (
                            <p className="text-[11px] text-slate-400 truncate mt-1">{rule.message_text}</p>
                          )}
                        </div>
                        {isSelected && <CheckCircle2 size={18} className="text-purple-400 shrink-0 ml-2" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-[#222d34] mt-4">
              <button
                type="button"
                onClick={() => navigate("/whatsapp/automations")}
                className="text-xs text-purple-400 hover:underline font-bold"
              >
                Open Automations Manager →
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAutomationModal(false)}
                  className="px-4 py-2 bg-[#202c33] hover:bg-[#2a3942] rounded-xl text-xs text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={runningAutomation || !selectedAutomationId}
                  onClick={() => handleTriggerAutomation(selectedAutomationId)}
                  className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl text-xs font-bold hover:brightness-110 disabled:opacity-50 transition shadow flex items-center gap-1.5"
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
          className="fixed z-50 bg-[#233138] border border-slate-700/80 rounded-xl shadow-2xl py-1.5 w-52 text-slate-200 text-xs wa-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Quick Reactions Bar inside context menu */}
          <div className="flex items-center justify-around px-2 py-1.5 border-b border-white/10 mb-1">
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
            className="w-full text-left px-3 py-2 hover:bg-[#182229] flex items-center gap-2.5 transition"
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
              className="w-full text-left px-3 py-2 hover:bg-[#182229] flex items-center gap-2.5 transition"
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
            className="w-full text-left px-3 py-2 hover:bg-[#182229] flex items-center gap-2.5 transition"
          >
            <Star size={14} className={starredMsgIds.has(contextMenu.message.id) ? "text-amber-400 fill-amber-400" : ""} />
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
              className="w-full text-left px-3 py-2 hover:bg-[#182229] flex items-center gap-2.5 transition"
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
              <span className="text-white/90 text-sm font-semibold truncate max-w-xs sm:max-w-md">
                {lightboxImage.title || "Photo Preview"}
              </span>
              <span className="text-white/40 text-xs hidden sm:inline">• {Math.round(lightboxZoom * 100)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setLightboxZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
                className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition"
                title="Zoom Out (-)"
              >
                <ZoomOut size={18} />
              </button>
              <button
                type="button"
                onClick={() => setLightboxZoom((z) => Math.min(3, Number((z + 0.25).toFixed(2))))}
                className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition"
                title="Zoom In (+)"
              >
                <ZoomIn size={18} />
              </button>
              <button
                type="button"
                onClick={() => setLightboxRotation((r) => (r + 90) % 360)}
                className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition"
                title="Rotate Clockwise (R)"
              >
                <RotateCw size={18} />
              </button>
              <a
                href={lightboxImage.src}
                download={lightboxImage.title || "photo.jpg"}
                className="px-3 py-1.5 bg-[#00a884] hover:bg-[#008f70] text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-lg"
                title="Download"
              >
                <Download size={14} />
                <span className="hidden sm:inline">Download</span>
              </a>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition ml-1"
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
                className="text-xs text-white/70 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1 rounded-full transition"
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
