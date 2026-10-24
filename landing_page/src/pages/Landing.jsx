import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Building2,
  Check,
  CheckCircle2,
  ExternalLink,
  FileText,
  Inbox,
  Lock,
  Mail,
  Menu,
  MessageCircle,
  MessageSquare,
  Paperclip,
  Phone,
  PhoneCall,
  Play,
  Plus,
  QrCode,
  Radio,
  RotateCw,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Sliders,
  Sparkles,
  Terminal,
  TrendingUp,
  User,
  Users,
  X,
  Zap,
} from "lucide-react";
import { appUrl, LIVE_APP_URL } from "../config/site";
import BrandLogo from "../components/BrandLogo";
import LandingFooter from "../components/LandingFooter";
import LandingHeader from "../components/LandingHeader";
import { LANDING_NAV } from "./marketing/siteNav";

/* ── Palette notes ───────────────────────────────────────────────────────────
   `blue` is remapped to brand gold by tailwind.config.js, so every surface that
   must read as blue (CTAs, eyebrows, integration cards) uses `azure-*`.
   `slate` is remapped to a navy-tinted neutral, which is exactly what the light
   sections want for body copy and hairline borders.
   ──────────────────────────────────────────────────────────────────────────── */

const INK = "text-[#0b1b3f]";
const AMBER = "text-[#f5a623]";

/* ── Lightweight Web Audio Synthesizer for Real App Sensory Feedback ───────── */

function playAppSound(type = "sent") {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "sent") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.09);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } else if (type === "received") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(780, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1100, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
      osc.start();
      osc.stop(ctx.currentTime + 0.14);
    } else {
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    }
  } catch (_) {}
}

/* ── Layout helpers ────────────────────────────────────────────────────────── */

function Container({ className = "", children }) {
  return (
    <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>
  );
}

function Eyebrow({ children, className = "" }) {
  return (
    <span
      className={`inline-block text-[11px] font-bold uppercase tracking-[0.18em] text-azure-600 ${className}`}
    >
      {children}
    </span>
  );
}

/* ── WhatsApp brand glyph (hero badge) ─────────────────────────────────────── */

function WhatsAppGlyph({ className = "h-5 w-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413" />
    </svg>
  );
}

/* ── Tiny scroll-reveal wrapper (IntersectionObserver, no dependency) ───────── */

function Reveal({ delay = 0, as: Tag = "div", className = "", children, ...rest }) {
  const ref = React.useRef(null);
  const [shown, setShown] = React.useState(false);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={`${className} transition-all duration-700 ease-out ${
        shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      }`}
      style={{ transitionDelay: `${delay}ms` }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/* ── 3D-Styled Glossy Blue Icons for the product overview cards ────────────── */

function Icon3DInbox({ className = "w-20 h-20" }) {
  return (
    <svg className={className} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="inboxGlow" cx="0%" cy="0%" r="100%">
          <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.8" />
          <stop offset="60%" stopColor="#2563eb" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="mainBubble" x1="20" y1="20" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="35%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
        <linearGradient id="bubbleShine" x1="30" y1="25" x2="70" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <filter id="shadowInbox" x="0" y="0" width="120" height="120" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#1d4ed8" floodOpacity="0.45" />
        </filter>
      </defs>
      <circle cx="60" cy="60" r="55" fill="url(#inboxGlow)" />
      <g filter="url(#shadowInbox)">
        <path
          d="M26 54C26 37.4315 39.4315 24 56 24H68C84.5685 24 98 37.4315 98 54C98 70.5685 84.5685 84 68 84H50L30 96V78.5C27.5 71.5 26 63 26 54Z"
          fill="url(#mainBubble)"
        />
        <path
          d="M32 50C32 39 40 30 52 28C64 26 78 28 84 34C72 34 50 38 42 52C38 60 36 68 36 74C33 67 32 58 32 50Z"
          fill="url(#bubbleShine)"
        />
        <circle cx="48" cy="54" r="5.5" fill="#ffffff" />
        <circle cx="62" cy="54" r="5.5" fill="#ffffff" />
        <circle cx="76" cy="54" r="5.5" fill="#ffffff" />
      </g>
    </svg>
  );
}

function Icon3DCampaigns({ className = "w-20 h-20" }) {
  return (
    <svg className={className} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="campGlow" cx="0%" cy="0%" r="100%">
          <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="speakerCone" x1="25" y1="40" x2="85" y2="75" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="40%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
        <linearGradient id="speakerRing" x1="75" y1="30" x2="90" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="30%" stopColor="#bfdbfe" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
        <filter id="shadowCamp" x="0" y="0" width="120" height="120" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#2563eb" floodOpacity="0.45" />
        </filter>
      </defs>
      <circle cx="60" cy="60" r="55" fill="url(#campGlow)" />
      <g filter="url(#shadowCamp)">
        <path d="M42 66L35 84C34 87 37 90 41 89L49 84L47 66Z" fill="#1e40af" />
        <path d="M28 48C28 44.5 31 42 35 43L78 32C80 31.5 82 33 82 35V85C82 87 80 88.5 78 88L35 77C31 78 28 75.5 28 72V48Z" fill="url(#speakerCone)" />
        <ellipse cx="28" cy="60" rx="6" ry="12" fill="#60a5fa" />
        <ellipse cx="82" cy="60" rx="8" ry="28" fill="url(#speakerRing)" />
        <ellipse cx="82" cy="60" rx="5" ry="22" fill="#1e3a8a" />
        <path d="M96 46C100 50 102 55 102 60C102 65 100 70 96 74" stroke="#60a5fa" strokeWidth="4" strokeLinecap="round" />
        <path d="M104 38C110 44 113 52 113 60C113 68 110 76 104 82" stroke="#93c5fd" strokeWidth="3.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

function Icon3DAutomation({ className = "w-20 h-20" }) {
  return (
    <svg className={className} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="autoGlow" cx="0%" cy="0%" r="100%">
          <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="gearGrad1" x1="25" y1="25" x2="85" y2="85" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#bfdbfe" />
          <stop offset="30%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1e40af" />
        </linearGradient>
        <linearGradient id="gearGrad2" x1="60" y1="55" x2="105" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="60%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#172554" />
        </linearGradient>
        <filter id="shadowAuto" x="0" y="0" width="120" height="120" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#2563eb" floodOpacity="0.45" />
        </filter>
      </defs>
      <circle cx="60" cy="60" r="55" fill="url(#autoGlow)" />
      <g filter="url(#shadowAuto)">
        <g transform="translate(48, 50)">
          <circle cx="0" cy="0" r="28" fill="url(#gearGrad1)" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
            <rect
              key={i}
              x="-5"
              y="-34"
              width="10"
              height="12"
              rx="3"
              fill="url(#gearGrad1)"
              transform={`rotate(${angle})`}
            />
          ))}
          <circle cx="0" cy="0" r="14" fill="#0b1739" />
          <circle cx="0" cy="0" r="8" fill="#60a5fa" />
        </g>
        <g transform="translate(82, 78)">
          <circle cx="0" cy="0" r="18" fill="url(#gearGrad2)" />
          {[0, 60, 120, 180, 240, 300].map((angle, i) => (
            <rect
              key={i}
              x="-3.5"
              y="-23"
              width="7"
              height="9"
              rx="2"
              fill="url(#gearGrad2)"
              transform={`rotate(${angle})`}
            />
          ))}
          <circle cx="0" cy="0" r="9" fill="#0b1739" />
          <circle cx="0" cy="0" r="5" fill="#93c5fd" />
        </g>
      </g>
    </svg>
  );
}

function Icon3DAnalytics({ className = "w-20 h-20" }) {
  return (
    <svg className={className} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="anaGlow" cx="0%" cy="0%" r="100%">
          <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="bar1" x1="25" y1="50" x2="35" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
        <linearGradient id="bar2" x1="45" y1="35" x2="55" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#bfdbfe" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
        <linearGradient id="bar3" x1="65" y1="25" x2="75" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="40%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#1e40af" />
        </linearGradient>
        <linearGradient id="arrowGrad" x1="20" y1="60" x2="90" y2="25" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="50%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
        <filter id="shadowAna" x="0" y="0" width="120" height="120" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#2563eb" floodOpacity="0.45" />
        </filter>
      </defs>
      <circle cx="60" cy="60" r="55" fill="url(#anaGlow)" />
      <g filter="url(#shadowAna)">
        <ellipse cx="60" cy="94" rx="42" ry="10" fill="#1e3a8a" opacity="0.6" />
        <rect x="26" y="58" width="14" height="34" rx="4" fill="url(#bar1)" />
        <rect x="46" y="44" width="14" height="48" rx="4" fill="url(#bar2)" />
        <rect x="66" y="28" width="14" height="64" rx="4" fill="url(#bar3)" />
        <path d="M22 66L42 50L62 42L86 20" stroke="url(#arrowGrad)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
        <polygon points="88,14 88,26 76,20" fill="#ffffff" />
        <circle cx="86" cy="20" r="4.5" fill="#38bdf8" />
      </g>
    </svg>
  );
}

/* ── Static page data ──────────────────────────────────────────────────────── */

const PRODUCT_CARDS = [
  { title: "Live WhatsApp Inbox", Icon: Icon3DInbox },
  { title: "Campaigns", Icon: Icon3DCampaigns },
  { title: "Automation", Icon: Icon3DAutomation },
  { title: "Analytics", Icon: Icon3DAnalytics },
];

const FEATURE_TABS = [
  { id: "inbox", title: "Live Inbox", desc: "Handle every conversation", icon: Inbox },
  { id: "contacts", title: "Contacts & Groups", desc: "Organize customer records", icon: Users },
  { id: "campaigns", title: "Campaigns", desc: "Reach the right audience", icon: Send },
  { id: "templates", title: "Templates", desc: "Simplify message lifecycle", icon: FileText },
  { id: "analytics", title: "Analytics", desc: "See what improves", icon: TrendingUp },
];

/** Sidebar of the workspace mockups — mirrors the real app's module rail. */
const WORKSPACE_NAV = [
  { id: "inbox", label: "Inbox", Icon: Inbox },
  { id: "contacts", label: "Contacts", Icon: Users },
  { id: "campaigns", label: "Campaigns", Icon: Send },
  { id: "templates", label: "Templates", Icon: FileText },
  { id: "automations", label: "Automation", Icon: Sliders },
  { id: "analytics", label: "Analytics", Icon: BarChart3 },
];

const AUTOMATION_CHECKS = [
  "Start from CRM events",
  "Send WhatsApp messages",
  "Use buttons and lists",
  "Add delays and conditions",
  "Track each contact's run history",
  "Handoff to your team when needed",
];

const INTEGRATION_CARDS = [
  { title: "QR Pairing", badge: "Basic", desc: "Connect using QR code.", Icon: QrCode },
  { title: "Phone Pairing Code", badge: "Easy", desc: "Connect through phone pairing.", Icon: Smartphone },
  { title: "Meta Cloud API", badge: "Official", desc: "Connect via Meta Cloud API.", Icon: Zap },
  { title: "REST API", badge: "Flexible", desc: "Integrate with your systems.", Icon: Terminal },
];

const HERO_PERKS = ["Live Inbox", "Campaigns", "Automation", "CRM integration"];

/* ── Initial Mock Data for Local Storage Persistence ───────────────────────── */

const INITIAL_HERO_CHATS = {
  rohan: {
    id: "rohan",
    name: "Rohan Mehta",
    company: "Vertex Retail",
    role: "Store Owner",
    avatar: "RM",
    status: "online",
    badge: "Retail",
    messages: [
      { id: 1, sender: "incoming", text: "Hi, I wanted to confirm my payment status.", time: "10:24 AM" },
      { id: 2, sender: "outgoing", text: "Your payment has been received. Thank you!", time: "10:26 AM" },
    ],
  },
  priya: {
    id: "priya",
    name: "Priya Sharma",
    company: "Nova Wellness",
    role: "Operations Lead",
    avatar: "PS",
    status: "online",
    badge: "Priority",
    messages: [
      { id: 1, sender: "incoming", text: "Thanks for the quick support — that fixed it.", time: "10:12 AM" },
    ],
  },
  ankit: {
    id: "ankit",
    name: "Ankit Verma",
    company: "Bluewave Logistics",
    role: "Coordinator",
    avatar: "AV",
    status: "away",
    badge: "Logistics",
    messages: [
      { id: 1, sender: "incoming", text: "Can you share the invoice for last month?", time: "Yesterday" },
    ],
  },
  neha: {
    id: "neha",
    name: "Neha Kapoor",
    company: "Sunrise Clinics",
    role: "Front Desk",
    avatar: "NK",
    status: "online",
    badge: "Healthcare",
    messages: [
      { id: 1, sender: "incoming", text: "The delivery was smooth — reminders work great.", time: "Yesterday" },
    ],
  },
  vikram: {
    id: "vikram",
    name: "Vikram Singh",
    company: "Orbit Travels",
    role: "Manager",
    avatar: "VS",
    status: "away",
    badge: "Travel",
    messages: [
      { id: 1, sender: "incoming", text: "Please update my contact number on the account.", time: "12 Oct" },
    ],
  },
  ajay: {
    id: "ajay",
    name: "Ajay Desai",
    company: "Craft & Co",
    role: "Founder",
    avatar: "AD",
    status: "away",
    badge: "Retail",
    messages: [
      { id: 1, sender: "incoming", text: "When is the next festive offer going live?", time: "11 Oct" },
    ],
  },
};

const INITIAL_CONTACTS = [
  { id: 1, name: "Devansh Mishra", phone: "+91 98765 43210", email: "devansh@apexcorp.com", company: "Apex Global Corp", branch: "Head Office (Main)", tags: ["VIP", "Enterprise"], status: "Active" },
  { id: 2, name: "Priya Sharma", phone: "+91 98123 45678", email: "priya@relianceretail.in", company: "Reliance Retail Hub", branch: "Mumbai Metro", tags: ["Retail", "High Value"], status: "Active" },
  { id: 3, name: "Rahul Verma", phone: "+91 97654 32109", email: "rahul@zomatologistics.com", company: "Zomato Logistics", branch: "Bengaluru South", tags: ["Logistics", "Broadcast"], status: "Active" },
  { id: 4, name: "Anita Desai", phone: "+91 99887 76655", email: "anita@apollohospitals.org", company: "Apollo Healthcare", branch: "Delhi Central", tags: ["Healthcare", "Verified"], status: "Active" },
  { id: 5, name: "Siddharth Rao", phone: "+91 98450 11223", email: "siddharth@tatadigital.com", company: "Tata Digital", branch: "Pune Tech Park", tags: ["SLA Critical"], status: "Active" },
];

const INITIAL_CAMPAIGNS = [
  { id: 1, name: "Diwali Festive 50% Early Bird", audience: "18,450 contacts", branch: "All Branches", progress: 100, status: "Completed", rate: "25 msgs/s", readRatio: "98.4%" },
  { id: 2, name: "Monthly SaaS Product Feature Roundup", audience: "9,200 contacts", branch: "Head Office", progress: 68, status: "Sending", rate: "20 msgs/s", readRatio: "89.2%" },
  { id: 3, name: "Abandoned Cart Recovery Flow", audience: "3,140 contacts", branch: "Mumbai Metro", progress: 100, status: "Automated", rate: "Real-time", readRatio: "94.8%" },
];

/* ── Mockup chrome pieces ──────────────────────────────────────────────────── */

function WindowDots() {
  return (
    <span className="flex items-center gap-1.5" aria-hidden="true">
      <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
      <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
      <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
    </span>
  );
}

function FlowNode({ icon, label, title, tone = "default" }) {
  const tones = {
    default: "border-white/10 bg-white/[0.05]",
    blue: "border-azure-500/40 bg-azure-500/10",
    green: "border-emerald-500/40 bg-emerald-500/10",
  };
  return (
    <div className={`rounded-xl border p-3.5 backdrop-blur-sm ${tones[tone]}`}>
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/10 text-azure-300">
          {icon}
        </span>
        <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.14em] text-azure-300">{label}</span>
      </div>
      <div className="mt-2 text-sm font-bold text-white">{title}</div>
    </div>
  );
}

function FlowConnector() {
  return (
    <div className="flex justify-center py-1" aria-hidden="true">
      <span className="h-6 w-px bg-gradient-to-b from-azure-500/70 to-azure-500/20" />
    </div>
  );
}

/* ── Main Landing Page Component ──────────────────────────────────────────── */

export default function Landing() {
  // 1. Hero Chat state with LocalStorage persistence
  const [heroChats, setHeroChats] = useState(() => {
    try {
      const saved = localStorage.getItem("madhura_hero_crm_state_v3");
      return saved ? JSON.parse(saved) : INITIAL_HERO_CHATS;
    } catch (_) {
      return INITIAL_HERO_CHATS;
    }
  });

  const [activeHeroContactId, setActiveHeroContactId] = useState("rohan");
  const [heroContactSearch, setHeroContactSearch] = useState("");
  const [heroMessageInput, setHeroMessageInput] = useState("");
  const [isHeroTyping, setIsHeroTyping] = useState(false);
  const [heroRailActive, setHeroRailActive] = useState("inbox");

  // WhatsApp-style in-mockup call overlay (replaces alert())
  const [heroCall, setHeroCall] = useState(null); // { phase: "calling"|"ringing"|"connected", seconds }
  const [heroEmojiOpen, setHeroEmojiOpen] = useState(false);

  useEffect(() => {
    if (!heroCall) return;
    if (heroCall.phase === "connected") return;
    const t = setTimeout(
      () => setHeroCall((c) => (c ? { ...c, phase: c.phase === "calling" ? "ringing" : "connected" } : c)),
      heroCall.phase === "calling" ? 1500 : 2500
    );
    return () => clearTimeout(t);
  }, [heroCall]);

  useEffect(() => {
    if (!heroCall || heroCall.phase !== "connected") return;
    const iv = setInterval(() => setHeroCall((c) => (c ? { ...c, seconds: (c.seconds || 0) + 1 } : c)), 1000);
    return () => clearInterval(iv);
  }, [heroCall?.phase]);

  useEffect(() => {
    try {
      localStorage.setItem("madhura_hero_crm_state_v3", JSON.stringify(heroChats));
    } catch (_) {}
  }, [heroChats]);

  const activeHeroContact = heroChats[activeHeroContactId] || heroChats.rohan;

  const filteredHeroContacts = useMemo(() => {
    return Object.values(heroChats).filter(
      (c) =>
        c.name.toLowerCase().includes(heroContactSearch.toLowerCase()) ||
        c.company.toLowerCase().includes(heroContactSearch.toLowerCase())
    );
  }, [heroChats, heroContactSearch]);

  const handleHeroSendMessage = (textToSend = null) => {
    const text = (textToSend || heroMessageInput).trim();
    if (!text) return;

    playAppSound("sent");
    const msgId = Date.now();
    const userMsg = { id: msgId, sender: "outgoing", text, time: "Just now", status: "sent" };

    setHeroChats((prev) => {
      const contact = prev[activeHeroContactId] || prev.rohan;
      return { ...prev, [activeHeroContactId]: { ...contact, messages: [...contact.messages, userMsg] } };
    });

    setHeroMessageInput("");
    setIsHeroTyping(true);

    // WhatsApp receipt progression: sent → delivered → read
    setTimeout(() => {
      setHeroChats((prev) => {
        const contact = prev[activeHeroContactId] || prev.rohan;
        return {
          ...prev,
          [activeHeroContactId]: {
            ...contact,
            messages: contact.messages.map((m) => (m.id === msgId ? { ...m, status: "delivered" } : m)),
          },
        };
      });
    }, 700);
    setTimeout(() => {
      setHeroChats((prev) => {
        const contact = prev[activeHeroContactId] || prev.rohan;
        return {
          ...prev,
          [activeHeroContactId]: {
            ...contact,
            messages: contact.messages.map((m) => (m.id === msgId ? { ...m, status: "read" } : m)),
          },
        };
      });
    }, 1600);

    setTimeout(() => {
      setIsHeroTyping(false);
      playAppSound("received");

      let replyText = "Received! Our team has updated the record in your WhatsApp CRM workspace.";
      const lower = text.toLowerCase();
      if (lower.includes("demo") || lower.includes("meeting") || lower.includes("call")) {
        replyText = "Super! I have locked in our slot and attached the meeting link to your workspace calendar.";
      } else if (lower.includes("price") || lower.includes("pricing") || lower.includes("cost") || lower.includes("rate")) {
        replyText = "Here are our transparent enterprise plans: Starter (₹1,499), Growth (₹3,499), and Unlimited Enterprise. All include multi-branch isolation!";
      } else if (lower.includes("branch") || lower.includes("employee") || lower.includes("code")) {
        replyText = "Yes! Each branch can have its own employees with access codes (`WA-XXXXXX`), isolated live chat, and dedicated WhatsApp sender lines.";
      }

      const botMsg = { id: Date.now() + 1, sender: "incoming", text: replyText, time: "Just now" };

      setHeroChats((prev) => {
        const contact = prev[activeHeroContactId] || prev.rohan;
        return { ...prev, [activeHeroContactId]: { ...contact, messages: [...contact.messages, botMsg] } };
      });
    }, 1300);
  };

  // Double-click a bubble to toggle a 👍 reaction (like WhatsApp quick reactions)
  const toggleHeroReaction = (msgId) => {
    playAppSound("click");
    setHeroChats((prev) => {
      const contact = prev[activeHeroContactId] || prev.rohan;
      return {
        ...prev,
        [activeHeroContactId]: {
          ...contact,
          messages: contact.messages.map((m) =>
            m.id === msgId ? { ...m, reaction: m.reaction ? null : "👍" } : m
          ),
        },
      };
    });
  };

  const HERO_EMOJIS = ["👍", "❤️", "😊", "🎉", "🙏", "✅"];

  // 2. Section 3 (Core Suite) State & LocalStorage
  const [activeFeatureTab, setActiveFeatureTab] = useState(0);

  // Sticky header shadow once the page is scrolled.
  // (Used by the commented-out ALTERNATE header further down — keep them.)
  const [headerScrolled, setHeaderScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setHeaderScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const [suiteInboxMessage, setSuiteInboxMessage] = useState("");
  const [suiteMessages, setSuiteMessages] = useState(() => {
    const seed = [
      { id: 1, sender: "customer", text: "Hi! Could you send me the pricing details for the enterprise tier?", time: "11:02 AM" },
      { id: 2, sender: "agent", text: "Hello Devansh! Absolutely, here is the enterprise breakdown. Would you also like a live demo?", time: "11:03 AM" },
    ];
    try {
      const saved = localStorage.getItem("madhura_suite_inbox_v3");
      return saved ? JSON.parse(saved) : seed;
    } catch (_) {
      return seed;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("madhura_suite_inbox_v3", JSON.stringify(suiteMessages));
    } catch (_) {}
  }, [suiteMessages]);

  const handleSendSuiteMessage = (e) => {
    e?.preventDefault();
    if (!suiteInboxMessage.trim()) return;
    playAppSound("sent");
    setSuiteMessages((prev) => [
      ...prev,
      { id: Date.now(), sender: "agent", text: suiteInboxMessage.trim(), time: "Just now" },
    ]);
    setSuiteInboxMessage("");

    setTimeout(() => {
      playAppSound("received");
      setSuiteMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: "customer",
          text: "Thank you for the instant response! Our team will review and connect for onboarding.",
          time: "Just now",
        },
      ]);
    }, 1200);
  };

  const [contactsList, setContactsList] = useState(() => {
    try {
      const saved = localStorage.getItem("madhura_suite_contacts_v3");
      return saved ? JSON.parse(saved) : INITIAL_CONTACTS;
    } catch (_) {
      return INITIAL_CONTACTS;
    }
  });
  const [contactSearchQuery, setContactSearchQuery] = useState("");
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [newContactForm, setNewContactForm] = useState({ name: "", phone: "", company: "", branch: "Head Office (Main)" });

  useEffect(() => {
    try {
      localStorage.setItem("madhura_suite_contacts_v3", JSON.stringify(contactsList));
    } catch (_) {}
  }, [contactsList]);

  const handleAddContactSubmit = (e) => {
    e.preventDefault();
    if (!newContactForm.name || !newContactForm.phone) return;
    playAppSound("click");
    setContactsList((prev) => [
      {
        id: Date.now(),
        name: newContactForm.name,
        phone: newContactForm.phone,
        email: `${newContactForm.name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
        company: newContactForm.company || "Independent Client",
        branch: newContactForm.branch,
        tags: ["New Lead", "Web Form"],
        status: "Active",
      },
      ...prev,
    ]);
    setShowAddContactModal(false);
    setNewContactForm({ name: "", phone: "", company: "", branch: "Head Office (Main)" });
  };

  const [campaignsList, setCampaignsList] = useState(() => {
    try {
      const saved = localStorage.getItem("madhura_suite_campaigns_v3");
      return saved ? JSON.parse(saved) : INITIAL_CAMPAIGNS;
    } catch (_) {
      return INITIAL_CAMPAIGNS;
    }
  });
  const [isDispatchingCampaign, setIsDispatchingCampaign] = useState(false);
  const [campaignProgress, setCampaignProgress] = useState(0);

  const handleLaunchCampaignSimulation = () => {
    setIsDispatchingCampaign(true);
    setCampaignProgress(0);
    playAppSound("click");
    let current = 0;
    const interval = setInterval(() => {
      current += 15;
      if (current >= 100) {
        clearInterval(interval);
        setCampaignProgress(100);
        setIsDispatchingCampaign(false);
        playAppSound("received");
        setCampaignsList((prev) => [
          {
            id: Date.now(),
            name: "Flash Broadcast Blast",
            audience: "5,000 customers",
            branch: "Head Office",
            progress: 100,
            status: "Completed",
            rate: "25 msgs/s",
            readRatio: "97.6%",
          },
          ...prev,
        ]);
      } else {
        setCampaignProgress(current);
      }
    }, 280);
  };

  // Tab 3: Interactive Template customizer
  const [templateVar1, setTemplateVar1] = useState("Vikram");
  const [templateVar2, setTemplateVar2] = useState("₹48,500");
  const [templateVar3, setTemplateVar3] = useState("18th October");

  // Tab 4: Analytics Period selector
  const [analyticsPeriod, setAnalyticsPeriod] = useState("today");

  // 3. Demo Modal state
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [demoForm, setDemoForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    teamSize: "11-50",
    useCase: "multi-branch",
  });
  const [demoSubmitted, setDemoSubmitted] = useState(false);

  /* Direct access to live cloud workspace */
  const handleInstantDemoLogin = () => {
    playAppSound("click");
    window.location.href = LIVE_APP_URL || appUrl("/login?tab=demo");
  };

  const handleDemoSubmit = (e) => {
    e.preventDefault();
    playAppSound("received");
    setDemoSubmitted(true);
    setTimeout(() => {
      window.location.href = LIVE_APP_URL || appUrl("/login?tab=demo");
    }, 2400);
  };

  // Section 4 Phone action feedback
  const [phoneActionFeedback, setPhoneActionFeedback] = useState(null);

  // Mobile drawer state (Used by the commented-out ALTERNATE header — keep.)
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  /* ── Reusable mockup pieces (need access to component state) ─────────────── */

  const renderWorkspaceRail = (activeId, onSelect) => (
    <div className="flex gap-2 overflow-x-auto pb-1 md:flex-col md:gap-1 md:overflow-visible md:pb-0">
      {WORKSPACE_NAV.map((item) => {
        const isActive = item.id === activeId;
        const className = `flex shrink-0 items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-semibold transition ${
          isActive
            ? "bg-azure-600 text-white shadow-[0_6px_16px_rgba(37,99,235,0.35)]"
            : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
        }`;

        if (item.id === "automations") {
          return (
            <Link key={item.id} to="/product/automations" className={className}>
              <item.Icon size={15} />
              <span>{item.label}</span>
            </Link>
          );
        }
        return (
          <button key={item.id} type="button" onClick={() => onSelect(item.id)} className={className}>
            <item.Icon size={15} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );

  const renderConversationList = () => (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="border-b border-slate-200 p-3">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={heroContactSearch}
            onChange={(e) => setHeroContactSearch(e.target.value)}
            placeholder="Search conversations..."
            aria-label="Search conversations"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-azure-400 focus:outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto max-h-[240px] lg:max-h-none">
        {filteredHeroContacts.map((contact) => {
          const isSelected = contact.id === activeHeroContactId;
          const lastMsg = contact.messages[contact.messages.length - 1];
          return (
            <button
              key={contact.id}
              type="button"
              onClick={() => {
                playAppSound("click");
                setActiveHeroContactId(contact.id);
              }}
              className={`flex w-full items-start gap-3 border-b border-slate-100 px-3 py-2.5 text-left transition ${
                isSelected ? "bg-azure-50" : "hover:bg-slate-50"
              }`}
            >
              <span className="relative shrink-0">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(145deg,#3b82f6,#1d4ed8)] text-[11px] font-bold text-white">
                  {contact.avatar}
                </span>
                <span
                  className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${
                    contact.status === "online" ? "bg-emerald-400" : "bg-amber-400"
                  }`}
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className={`truncate text-xs font-bold ${isSelected ? "text-azure-700" : "text-slate-800"}`}>
                    {contact.name}
                  </span>
                  <span className="shrink-0 text-[10px] text-slate-400">{lastMsg?.time || "Now"}</span>
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                  {lastMsg?.text || "No messages yet"}
                </span>
              </span>
            </button>
          );
        })}
        {filteredHeroContacts.length === 0 && (
          <p className="px-3 py-6 text-center text-xs text-slate-400">No conversation matches that search.</p>
        )}
      </div>
    </div>
  );

  const heroThreadRef = React.useRef(null);
  useEffect(() => {
    const el = heroThreadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [activeHeroContactId, activeHeroContact.messages.length, isHeroTyping]);

  const renderChatPane = () => (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(145deg,#3b82f6,#1d4ed8)] text-[11px] font-bold text-white">
            {activeHeroContact.avatar}
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-sm font-bold text-slate-900">{activeHeroContact.name}</span>
              <span className="rounded-full border border-azure-200 bg-azure-50 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-azure-700">
                {activeHeroContact.badge}
              </span>
            </span>
            <span className="flex items-center gap-1 text-[11px] text-emerald-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              online
            </span>
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              playAppSound("click");
              setHeroCall({ phase: "calling", seconds: 0 });
            }}
            title="Call on WhatsApp"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-azure-600"
          >
            <PhoneCall size={15} />
          </button>
          <button
            type="button"
            onClick={handleInstantDemoLogin}
            title="Open full workspace"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-azure-600"
          >
            <ExternalLink size={15} />
          </button>
        </div>
      </div>

      <div
        ref={heroThreadRef}
        className="min-h-[190px] flex-1 space-y-3 overflow-y-auto bg-[#f6f8fc] px-4 py-4 lg:max-h-[400px]"
      >
        {activeHeroContact.messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === "outgoing" ? "justify-end" : "justify-start"}`}>
            <button
              type="button"
              onDoubleClick={() => toggleHeroReaction(msg.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                toggleHeroReaction(msg.id);
              }}
              title="Double-click to react"
              className={`relative max-w-[86%] rounded-2xl px-3.5 py-2.5 text-left text-xs shadow-sm transition hover:shadow-md ${
                msg.sender === "outgoing"
                  ? "rounded-tr-none bg-emerald-500 text-white"
                  : "rounded-tl-none border border-slate-200 bg-white text-slate-700"
              }`}
            >
              <p className="leading-relaxed">{msg.text}</p>
              <span
                className={`mt-1 block text-right text-[9px] ${
                  msg.sender === "outgoing" ? "text-white/80" : "text-slate-400"
                }`}
              >
                {msg.time}
                {msg.sender === "outgoing" && (
                  <span className="ml-1" aria-label={msg.status || "read"}>
                    {msg.status === "sent" ? "✓" : "✓✓"}
                  </span>
                )}
              </span>
              {msg.reaction && (
                <span className="absolute -bottom-2 left-2 rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] leading-none shadow-sm">
                  {msg.reaction}
                </span>
              )}
            </button>
          </div>
        ))}

        {isHeroTyping && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl rounded-tl-none border border-slate-200 bg-white px-3.5 py-2 text-[11px] text-slate-500">
              <span>{activeHeroContact.name} is typing</span>
              <span className="flex gap-0.5">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-azure-400" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-azure-400 [animation-delay:0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-azure-400 [animation-delay:0.3s]" />
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Emoji picker + composer */}
      <div className="relative border-t border-slate-200 bg-white">
        {heroEmojiOpen && (
          <div className="absolute bottom-full left-3 z-10 mb-1 flex gap-1 rounded-xl border border-slate-200 bg-white px-2 py-1.5 shadow-lg animate-scale-in">
            {HERO_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  playAppSound("click");
                  setHeroMessageInput((v) => v + emoji);
                  setHeroEmojiOpen(false);
                }}
                className="rounded p-1 text-base transition hover:scale-125 hover:bg-slate-100"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleHeroSendMessage();
          }}
          className="flex items-center gap-2 px-3 py-3"
        >
          <button
            type="button"
            aria-label="Emoji"
            aria-expanded={heroEmojiOpen}
            onClick={() => {
              playAppSound("click");
              setHeroEmojiOpen((v) => !v);
            }}
            className={`shrink-0 rounded-lg p-1.5 transition hover:bg-slate-100 ${
              heroEmojiOpen ? "text-azure-600" : "text-slate-400 hover:text-azure-600"
            }`}
          >
            <span className="text-sm leading-none">😊</span>
          </button>
          <button
            type="button"
            aria-label="Attach file"
            title="Attach a document"
            onClick={() => {
              playAppSound("sent");
              setHeroChats((prev) => {
                const contact = prev[activeHeroContactId] || prev.rohan;
                return {
                  ...prev,
                  [activeHeroContactId]: {
                    ...contact,
                    messages: [
                      ...contact.messages,
                      { id: Date.now(), sender: "outgoing", text: "📎 Invoice_October.pdf — 248 KB", time: "Just now", status: "read" },
                    ],
                  },
                };
              });
            }}
            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-azure-600"
          >
            <Paperclip size={15} />
          </button>
          <input
            type="text"
            value={heroMessageInput}
            onChange={(e) => setHeroMessageInput(e.target.value)}
            placeholder={`Type a message...`}
            aria-label={`Message ${activeHeroContact.name}`}
            className="min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-azure-400 focus:outline-none"
          />
          <button
            type="submit"
            aria-label="Send message"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_6px_16px_rgba(16,185,129,0.35)] transition hover:bg-emerald-600 active:scale-95 disabled:opacity-50"
            disabled={!heroMessageInput.trim()}
          >
            <Send size={15} />
          </button>
        </form>
      </div>
    </div>
  );

  /* ── Page ────────────────────────────────────────────────────────────────── */

  return (
    <div className="min-h-screen overflow-x-hidden bg-white font-sans selection:bg-azure-600 selection:text-white">
      {/* ─────────────────────────────────────────────────────────────────────
          HEADER / NAVBAR
          The home header now lives in src/components/LandingHeader.jsx so the
          identical header renders on every marketing URL too.
          The richer ALTERNATE header variant is still commented out below.
          ───────────────────────────────────────────────────────────────────── */}
      <LandingHeader
        onBookDemo={() => {
          playAppSound("click");
          setShowDemoModal(true);
        }}
      />

      {/*
        ══════════════════════════════════════════════════════════════════════
        ALTERNATE HEADER — richer link set (currently disabled).
        To use it: delete the <LandingHeader /> component call above, then
        uncomment this block (it still uses the headerScrolled / mobileNavOpen
        state declared at the top of this file).
        Cmd+/ or Ctrl+/ to uncomment.
        ══════════════════════════════════════════════════════════════════════
      <header
        className={`sticky top-0 z-50 border-b bg-white/95 backdrop-blur-md transition-shadow duration-300 ${
          headerScrolled ? "border-slate-200 shadow-[0_10px_30px_-12px_rgba(11,27,63,0.18)]" : "border-slate-200/80"
        }`}
      >
        <Container className="flex h-16 items-center justify-between gap-4 lg:h-[72px]">
          <Link to="/" className="flex shrink-0 items-center" aria-label="MADHURA home">
            <BrandLogo variant="on-light" className="h-8 lg:h-9" />
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 lg:flex" aria-label="Primary">
            <Link to="/" className="transition hover:text-azure-600">Home</Link>
            <Link to="/product/live-inbox" className="transition hover:text-azure-600">Product</Link>
            <a href="#features" className="transition hover:text-azure-600">Features</a>
            <a href="#suite" className="transition hover:text-azure-600">Automation</a>
            <a href="#integrations" className="transition hover:text-azure-600">Integrations</a>
            <Link to="/company/about" className="transition hover:text-azure-600">About</Link>
            <Link to="/docs" className="transition hover:text-azure-600">Docs</Link>
            <Link to="/company/contact" className="transition hover:text-azure-600">Contact</Link>
          </nav>

          <div className="flex items-center gap-2">
            <a
              href={appUrl("/login")}
              className="hidden inline-flex items-center rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-azure-400 hover:text-azure-600 md:inline-flex"
            >
              Sign in
            </a>
            <button
              type="button"
              onClick={() => {
                playAppSound("click");
                setShowDemoModal(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-azure-600 px-5 py-2.5 text-sm font-bold text-white shadow-[0_8px_20px_rgba(37,99,235,0.28)] transition hover:bg-azure-700 active:scale-[0.98]"
            >
              <span>Book a Demo</span>
              <ArrowRight size={14} />
            </button>
            <button
              type="button"
              onClick={() => setMobileNavOpen((v) => !v)}
              aria-expanded={mobileNavOpen}
              aria-controls="landing-mobile-nav-alt"
              aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
              className="-mr-2 p-2 text-slate-600 transition hover:text-azure-600 lg:hidden"
            >
              {mobileNavOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </Container>

        {mobileNavOpen && (
          <div
            id="landing-mobile-nav-alt"
            className="max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-slate-200 bg-white lg:hidden"
          >
            <Container className="space-y-4 py-5">
              <ul className="space-y-1">
                {[
                  { label: "Home", path: "/" },
                  { label: "Product", path: "/product/live-inbox" },
                  { label: "About", path: "/company/about" },
                  { label: "Docs", path: "/docs" },
                  { label: "Contact", path: "/company/contact" },
                ].map((item) => (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      onClick={() => setMobileNavOpen(false)}
                      className="block py-2 text-sm font-medium text-slate-700 transition hover:text-azure-600"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="flex flex-col gap-2 border-t border-slate-200 pt-4">
                <a
                  href={appUrl("/login")}
                  className="rounded-full border border-slate-300 py-2.5 text-center text-sm font-semibold text-slate-700"
                >
                  Sign in
                </a>
              </div>
            </Container>
          </div>
        )}
      </header>
      */}

      {/* ─────────────────────────────────────────────────────────────────────
          SECTION 1: HERO
          ───────────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#060d2b] text-white">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(65%_60%_at_12%_0%,rgba(37,99,235,0.34),transparent_62%)]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(50%_50%_at_88%_35%,rgba(59,130,246,0.18),transparent_70%)]"
        />

        <Container className="relative z-10 py-14 lg:py-20">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-10">
            {/* Left Column */}
            <div className="space-y-6 lg:col-span-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300 backdrop-blur-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-[#f5a623]" />
                <span>WhatsApp CRM &amp; Automation</span>
              </div>

              <h1 className="text-4xl font-black leading-[1.06] tracking-tight text-white sm:text-5xl lg:text-[54px]">
                Turn WhatsApp
                <br />
                conversations into
                <br />
                <span className={`${AMBER} drop-shadow-[0_2px_16px_rgba(245,166,35,0.28)]`}>
                  business workflows
                </span>
              </h1>

              <p className="max-w-md text-base leading-relaxed text-slate-300 sm:text-lg">
                Manage conversations, campaigns, automation and customer events from one connected workspace.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <a
                  href={LIVE_APP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 px-7 py-3.5 text-sm font-bold text-white shadow-[0_14px_32px_rgba(16,185,129,0.38)] transition-all hover:from-emerald-600 hover:to-teal-700 hover:shadow-[0_18px_38px_rgba(16,185,129,0.48)] hover:scale-[1.03] active:scale-95 sm:text-base"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-white"></span>
                  </span>
                  <span>Try Now · Live App</span>
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                </a>

                <button
                  type="button"
                  onClick={() => {
                    playAppSound("click");
                    setShowDemoModal(true);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/[0.04] px-6 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/[0.1] active:scale-95 sm:text-base"
                >
                  <span>Book a Demo</span>
                  <ArrowRight size={15} />
                </button>
              </div>

              <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 text-xs text-slate-400 sm:text-[13px]">
                {HERO_PERKS.map((perk) => (
                  <li key={perk} className="flex items-center gap-1.5 whitespace-nowrap">
                    <Check size={14} className="text-azure-400" strokeWidth={3} />
                    <span>{perk}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right Column: Interactive CRM workspace mockup */}
            <div className="relative lg:col-span-7">
              <div className="absolute -top-5 left-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-[#25d366] text-white shadow-[0_12px_28px_rgba(37,211,102,0.5)] ring-4 ring-[#060d2b]">
                <WhatsAppGlyph className="h-7 w-7" />
              </div>

              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0a1330] shadow-[0_40px_90px_-30px_rgba(2,6,23,0.9)]">
                {/* Window chrome */}
                <div className="flex items-center gap-3 border-b border-white/[0.08] bg-[#070f26] px-4 py-2.5">
                  <WindowDots />
                  <span className="flex-1 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                    Madhura · {WORKSPACE_NAV.find((n) => n.id === heroRailActive)?.label || "Inbox"}
                  </span>
                  <button
                    type="button"
                    title="Reset sample chat storage"
                    aria-label="Reset sample chat storage"
                    onClick={() => {
                      localStorage.removeItem("madhura_hero_crm_state_v3");
                      setHeroChats(INITIAL_HERO_CHATS);
                      playAppSound("click");
                    }}
                    className="rounded-md p-1 text-slate-500 transition hover:bg-white/10 hover:text-white"
                  >
                    <RotateCw size={13} />
                  </button>
                </div>

                <div className="grid grid-cols-12">
                  {/* Module rail — interactive */}
                  <aside
                    aria-label="Workspace modules"
                    className="col-span-12 hidden flex-col justify-between border-r border-white/[0.07] bg-[#070f28] p-3 lg:col-span-3 lg:flex"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 px-1">
                        <BrandLogo variant="on-dark" className="h-6" />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        {WORKSPACE_NAV.map((item) => {
                          const isActive = item.id === heroRailActive;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              aria-pressed={isActive}
                              onClick={() => {
                                playAppSound("click");
                                setHeroRailActive(item.id);
                              }}
                              className={`group flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition duration-200 active:scale-[0.98] ${
                                isActive
                                  ? "bg-azure-600 text-white shadow-[0_6px_16px_rgba(37,99,235,0.35)]"
                                  : "text-slate-400 hover:translate-x-0.5 hover:bg-white/[0.07] hover:text-white"
                              }`}
                            >
                              <item.Icon
                                size={13}
                                className={`transition duration-200 ${
                                  isActive ? "" : "group-hover:scale-110"
                                }`}
                              />
                              <span>{item.label}</span>
                              <span
                                aria-hidden="true"
                                className={`ml-auto h-1.5 w-1.5 rounded-full transition duration-200 ${
                                  isActive ? "bg-white" : "scale-0 bg-azure-400 group-hover:scale-100"
                                }`}
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => playAppSound("click")}
                      className="group mt-4 flex w-full items-center gap-2 rounded-lg border-t border-white/10 px-1 pt-3 text-[11px] text-slate-400 transition hover:text-white"
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[9px] font-bold text-white transition group-hover:bg-azure-600">
                        A
                      </span>
                      <span>Admin</span>
                    </button>
                  </aside>

                  {/* Conversation list */}
                  <div className="col-span-12 border-b border-slate-200 sm:col-span-5 sm:border-b-0 sm:border-r lg:col-span-4">
                    {renderConversationList()}
                  </div>

                  {/* Chat */}
                  <div className="col-span-12 sm:col-span-7 lg:col-span-5">{renderChatPane()}</div>
                </div>

                {/* WhatsApp-style call overlay */}
                {heroCall && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[#0b1120]/95 text-white animate-fade-in">
                    <span className="relative">
                      <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[linear-gradient(145deg,#3b82f6,#1d4ed8)] text-xl font-bold text-white">
                        {activeHeroContact.avatar}
                      </span>
                      {heroCall.phase !== "connected" && (
                        <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-white/20" />
                      )}
                    </span>
                    <span className="text-sm font-bold">{activeHeroContact.name}</span>
                    <span className="text-xs text-slate-400" aria-live="polite">
                      {heroCall.phase === "calling" && "Calling…"}
                      {heroCall.phase === "ringing" && "Ringing…"}
                      {heroCall.phase === "connected" &&
                        `Connected · ${String(Math.floor(heroCall.seconds / 60)).padStart(2, "0")}:${String(
                          heroCall.seconds % 60
                        ).padStart(2, "0")}`}
                    </span>

                    <div className="mt-3 flex items-center gap-5">
                      <button
                        type="button"
                        title="Mute"
                        onClick={() => playAppSound("click")}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
                      >
                        <span className="text-sm">🎙</span>
                      </button>
                      <button
                        type="button"
                        title="End call"
                        onClick={() => {
                          playAppSound("click");
                          setHeroCall(null);
                        }}
                        className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500 text-white shadow-[0_8px_24px_rgba(239,68,68,0.5)] transition hover:bg-red-600 active:scale-95"
                      >
                        <PhoneCall size={18} className="rotate-[135deg]" />
                      </button>
                      <button
                        type="button"
                        title="Speaker"
                        onClick={() => playAppSound("click")}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
                      >
                        <span className="text-sm">🔊</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Solid divider band into the light sections */}
      <div
        aria-hidden="true"
        className="h-10 bg-white lg:h-14"
      />

      {/* ─────────────────────────────────────────────────────────────────────
          SECTION 2: PRODUCT OVERVIEW — 4 GLOSSY 3D BENTO CARDS
          ───────────────────────────────────────────────────────────────────── */}
      <section id="features" className="bg-white py-16 lg:py-20">
        <Container>
          <div className="mx-auto mb-12 max-w-3xl space-y-3 text-center">
            <Eyebrow>Product Overview</Eyebrow>
            <h2 className={`text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-[40px] ${INK}`}>
              Everything you need to manage WhatsApp at scale.
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PRODUCT_CARDS.map(({ title, Icon }, idx) => (
              <Reveal key={title} delay={idx * 120}>
                <div className="group relative flex h-full aspect-[4/3] flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(120%_110%_at_0%_0%,#17306b_0%,#0a1436_58%,#070f28_100%)] p-5 shadow-[0_24px_50px_-24px_rgba(10,20,54,0.75)] transition duration-300 hover:-translate-y-2 hover:border-azure-400/40 hover:shadow-[0_34px_64px_-24px_rgba(37,99,235,0.55)]">
                  {/* Glow sweep on hover */}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -inset-px rounded-2xl bg-[radial-gradient(60%_50%_at_50%_0%,rgba(96,165,250,0.22),transparent_70%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  />
                  <div className="relative flex flex-1 items-center justify-center">
                    <span
                      className="inline-flex animate-float transition duration-300 group-hover:scale-110 group-hover:-rotate-2"
                      style={{ animationDelay: `${idx * 220}ms` }}
                    >
                      <Icon className="h-28 w-28 lg:h-32 lg:w-32" />
                    </span>
                  </div>
                  <h3 className="relative text-base font-bold text-white lg:text-lg">{title}</h3>
                </div>
              </Reveal>
            ))}
          </div>

          <p className="mx-auto mt-8 max-w-2xl text-center text-sm leading-relaxed text-slate-500">
            From conversations to campaigns and automation, Madhura brings your customer communication into one
            connected workspace.
          </p>
        </Container>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────
          SECTION 3: FEATURES — INTERACTIVE WORKSPACE
          ───────────────────────────────────────────────────────────────────── */}
      <section id="suite" className="border-t border-slate-200 bg-white py-16 lg:py-20">
        <Container>
          <div className="mb-10 max-w-2xl">
            <Eyebrow>Features</Eyebrow>
            <h2 className={`mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-[40px] ${INK}`}>
              Powerful features for real business communication.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-500 sm:text-base">
              Manage customers, run campaigns, use templates, collaborate with your team and get complete visibility
              — all in one place.
            </p>
          </div>

          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
            {/* Left Column: 5 feature cards */}
            <div className="space-y-3 lg:col-span-5">
              {FEATURE_TABS.map((tab, idx) => {
                const TabIcon = tab.icon;
                const isSelected = activeFeatureTab === idx;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      playAppSound("click");
                      setActiveFeatureTab(idx);
                    }}
                    aria-pressed={isSelected}
                    className={`flex w-full items-start gap-4 rounded-xl border p-4 text-left transition-all duration-200 ${
                      isSelected
                        ? "border-azure-400 bg-azure-50/70 shadow-[0_10px_26px_-14px_rgba(37,99,235,0.55)] ring-1 ring-azure-500/25"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-azure-600 text-white shadow-[0_8px_18px_rgba(37,99,235,0.28)]">
                      <TabIcon size={19} />
                    </span>
                    <span>
                      <span className={`block text-sm font-bold ${isSelected ? "text-azure-700" : "text-slate-800"}`}>
                        {tab.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">{tab.desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Right Column: Dynamic workspace screen */}
            <div className="lg:col-span-7">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_30px_70px_-30px_rgba(15,30,80,0.45)]">
                {/* Browser chrome */}
                <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-100 px-4 py-3">
                  <WindowDots />
                  <span className="flex-1 truncate text-center text-[11px] font-semibold text-slate-500">
                    madhura.app/workspace/{FEATURE_TABS[activeFeatureTab].id}
                  </span>
                  <span className="hidden rounded-full bg-azure-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-azure-700 sm:inline">
                    Live demo
                  </span>
                </div>

                <div className="grid grid-cols-12 md:min-h-[440px]">
                  {/* Module rail */}
                  <aside className="col-span-12 border-b border-white/10 bg-[#070f28] p-3 md:col-span-3 md:border-b-0 md:border-r">
                    <div className="mb-3 hidden items-center gap-2 px-1 md:flex">
                      <BrandLogo variant="on-dark" className="h-6" />
                    </div>
                    {renderWorkspaceRail(FEATURE_TABS[activeFeatureTab].id, (id) => {
                      const index = FEATURE_TABS.findIndex((t) => t.id === id);
                      if (index >= 0) setActiveFeatureTab(index);
                    })}
                  </aside>

                  <div className="col-span-12 md:col-span-9">
                    {/* TAB 0: LIVE INBOX VIEW */}
                    {activeFeatureTab === 0 && (
                      <div className="grid grid-cols-12">
                        <div className="col-span-12 border-b border-slate-200 sm:col-span-5 sm:border-b-0 sm:border-r md:col-span-5">
                          {renderConversationList()}
                        </div>
                        <div className="col-span-12 sm:col-span-7 md:col-span-7">{renderChatPane()}</div>
                      </div>
                    )}

                    {/* TAB 1: CONTACTS & GROUPS VIEW */}
                    {activeFeatureTab === 1 && (
                      <div className="flex h-full flex-col justify-between space-y-4 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={contactSearchQuery}
                              onChange={(e) => setContactSearchQuery(e.target.value)}
                              placeholder="Search customer phone, name..."
                              className="w-48 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 focus:border-azure-400 focus:outline-none"
                            />
                            <span className="text-xs font-bold text-slate-500">{contactsList.length} Contacts</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              playAppSound("click");
                              setShowAddContactModal(true);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-azure-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-azure-700"
                          >
                            <Plus size={13} />
                            <span>Add Contact</span>
                          </button>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                          <table className="w-full text-left text-xs">
                            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                              <tr>
                                <th className="px-3 py-2.5">Name</th>
                                <th className="px-3 py-2.5">WhatsApp Number</th>
                                <th className="px-3 py-2.5">Branch Scope</th>
                                <th className="px-3 py-2.5">Tags</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {contactsList
                                .filter(
                                  (c) =>
                                    c.name.toLowerCase().includes(contactSearchQuery.toLowerCase()) ||
                                    c.phone.includes(contactSearchQuery)
                                )
                                .map((contact) => (
                                  <tr key={contact.id} className="transition hover:bg-slate-50/80">
                                    <td className="px-3 py-2.5 font-bold text-slate-900">{contact.name}</td>
                                    <td className="px-3 py-2.5 font-mono text-slate-600">{contact.phone}</td>
                                    <td className="px-3 py-2.5 text-slate-500">{contact.branch}</td>
                                    <td className="px-3 py-2.5">
                                      {contact.tags.map((t, idx) => (
                                        <span
                                          key={idx}
                                          className="mr-1 rounded-full border border-azure-200 bg-azure-50 px-2 py-0.5 text-[10px] font-semibold text-azure-700"
                                        >
                                          {t}
                                        </span>
                                      ))}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="flex items-center justify-between pt-2 text-[11px] text-slate-500">
                          <span>Stored in your local session. Contacts persist across reloads.</span>
                          <button
                            type="button"
                            onClick={handleInstantDemoLogin}
                            className="font-bold text-azure-600 hover:underline"
                          >
                            Open Full CRM Contacts →
                          </button>
                        </div>
                      </div>
                    )}

                    {/* TAB 2: CAMPAIGNS BROADCAST ENGINE */}
                    {activeFeatureTab === 2 && (
                      <div className="flex h-full flex-col justify-between space-y-4 p-4">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                          <div>
                            <h4 className="text-sm font-bold text-slate-900">Broadcast Campaigns</h4>
                            <p className="text-xs text-slate-500">Automated pacing with 0% Meta account ban risk</p>
                          </div>
                          <button
                            type="button"
                            onClick={handleLaunchCampaignSimulation}
                            disabled={isDispatchingCampaign}
                            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-50"
                          >
                            <Play size={12} />
                            <span>{isDispatchingCampaign ? "Pacing & Dispatching..." : "+ Launch Test Blast"}</span>
                          </button>
                        </div>

                        {isDispatchingCampaign && (
                          <div className="space-y-1.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                            <div className="flex justify-between text-xs font-bold text-emerald-900">
                              <span>Dispatching Flash Campaign via Meta Cloud API...</span>
                              <span>{campaignProgress}%</span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-emerald-200">
                              <div
                                className="h-full bg-emerald-600 transition-all duration-300"
                                style={{ width: `${campaignProgress}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-medium text-emerald-700">
                              Paced at 25 messages / second with duplicate suppression.
                            </span>
                          </div>
                        )}

                        <div className="max-h-[240px] space-y-2 overflow-y-auto">
                          {campaignsList.map((camp) => (
                            <div
                              key={camp.id}
                              className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3"
                            >
                              <div>
                                <div className="text-xs font-bold text-slate-900">{camp.name}</div>
                                <div className="mt-0.5 text-[11px] text-slate-500">
                                  Audience: {camp.audience} • Rate: {camp.rate}
                                </div>
                              </div>
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                                {camp.status} ({camp.readRatio})
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                          <span>Rate limiting &amp; opt-out checks enforced automatically.</span>
                          <button
                            type="button"
                            onClick={handleInstantDemoLogin}
                            className="font-bold text-azure-600 hover:underline"
                          >
                            Create Real Campaign →
                          </button>
                        </div>
                      </div>
                    )}

                    {/* TAB 3: TEMPLATES VIEW */}
                    {activeFeatureTab === 3 && (
                      <div className="flex h-full flex-col justify-between space-y-4 p-4">
                        <div className="border-b border-slate-200 pb-2">
                          <h4 className="text-sm font-bold text-slate-900">Official Meta Approved Templates</h4>
                          <p className="text-xs text-slate-500">Live preview with interactive variable substitution</p>
                        </div>

                        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
                          <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                            <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-800">
                              Test Template Variables
                            </span>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-600">
                                Customer Name {"{{1}}"}
                              </label>
                              <input
                                type="text"
                                value={templateVar1}
                                onChange={(e) => setTemplateVar1(e.target.value)}
                                className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 focus:border-azure-400 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-600">
                                Invoice Amount {"{{2}}"}
                              </label>
                              <input
                                type="text"
                                value={templateVar2}
                                onChange={(e) => setTemplateVar2(e.target.value)}
                                className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 focus:border-azure-400 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-600">Due Date {"{{3}}"}</label>
                              <input
                                type="text"
                                value={templateVar3}
                                onChange={(e) => setTemplateVar3(e.target.value)}
                                className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 focus:border-azure-400 focus:outline-none"
                              />
                            </div>
                          </div>

                          <div className="flex min-h-[170px] flex-col justify-between rounded-xl bg-[#e5ddd5] p-3 shadow-inner">
                            <div className="space-y-1.5 rounded-xl bg-white p-3 text-xs text-slate-900 shadow">
                              <p className="text-[11px] font-bold text-emerald-700">MADHURA TECHNOLOGIES</p>
                              <p className="leading-relaxed">
                                Hello <strong>{templateVar1 || "Customer"}</strong>, your tax invoice of{" "}
                                <strong>{templateVar2 || "₹0"}</strong> is ready. Due date:{" "}
                                <strong>{templateVar3 || "Immediate"}</strong>.
                              </p>
                              <div className="flex flex-col gap-1 border-t border-slate-100 pt-2">
                                <span className="rounded border border-slate-200 bg-slate-100 py-1 text-center text-[10px] font-bold text-azure-600">
                                  Pay Now via UPI
                                </span>
                                <span className="rounded border border-slate-200 bg-slate-100 py-1 text-center text-[10px] font-bold text-slate-700">
                                  Download Invoice PDF
                                </span>
                              </div>
                            </div>
                            <span className="mt-1 text-right text-[9px] text-slate-600">
                              Status: Verified Approved (Meta v22.0)
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                          <span>Synchronized with Meta Graph API in real time.</span>
                          <button
                            type="button"
                            onClick={handleInstantDemoLogin}
                            className="font-bold text-azure-600 hover:underline"
                          >
                            Explore All 24 Templates →
                          </button>
                        </div>
                      </div>
                    )}

                    {/* TAB 4: ANALYTICS VIEW */}
                    {activeFeatureTab === 4 && (
                      <div className="flex h-full flex-col justify-between space-y-4 p-4">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                          <div>
                            <h4 className="text-sm font-bold text-slate-900">Real-Time WhatsApp Analytics</h4>
                            <p className="text-xs text-slate-500">Live agent SLA, response times, and read rates</p>
                          </div>
                          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 text-xs">
                            <button
                              type="button"
                              onClick={() => setAnalyticsPeriod("today")}
                              className={`rounded px-2.5 py-1 font-bold transition ${
                                analyticsPeriod === "today" ? "bg-white text-azure-700 shadow-sm" : "text-slate-500"
                              }`}
                            >
                              Today
                            </button>
                            <button
                              type="button"
                              onClick={() => setAnalyticsPeriod("7d")}
                              className={`rounded px-2.5 py-1 font-bold transition ${
                                analyticsPeriod === "7d" ? "bg-white text-azure-700 shadow-sm" : "text-slate-500"
                              }`}
                            >
                              7 Days
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <span className="text-[10px] font-bold uppercase text-slate-500">Messages Dispatched</span>
                            <div className="mt-1 text-lg font-black text-slate-900">48,920</div>
                            <span className="text-[9px] font-bold text-emerald-600">↑ 14.8% vs last week</span>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <span className="text-[10px] font-bold uppercase text-slate-500">First Response Time</span>
                            <div className="mt-1 text-lg font-black text-azure-600">42 sec</div>
                            <span className="text-[9px] font-bold text-emerald-600">18s faster SLA</span>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <span className="text-[10px] font-bold uppercase text-slate-500">Delivery Ratio</span>
                            <div className="mt-1 text-lg font-black text-emerald-600">99.4%</div>
                            <span className="text-[9px] font-medium text-slate-500">Meta Tier 1 Verified</span>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <span className="text-[10px] font-bold uppercase text-slate-500">CSAT Score</span>
                            <div className="mt-1 text-lg font-black text-amber-500">4.9 / 5.0</div>
                            <span className="text-[9px] font-medium text-slate-500">Based on 1,420 ratings</span>
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                          <div className="mb-2 flex justify-between font-bold text-slate-900">
                            <span>Top Support &amp; Sales Performers</span>
                            <span className="font-normal text-slate-500">Active Today</span>
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="font-semibold text-slate-800">1. Ananya Sharma (Mumbai)</span>
                              <span className="font-bold text-azure-700">142 Resolved • 38s avg</span>
                            </div>
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="font-semibold text-slate-800">2. Rohan Verma (Bengaluru)</span>
                              <span className="font-bold text-azure-700">118 Resolved • 44s avg</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                          <span>Export daily and monthly PDF executive reports in 1-click.</span>
                          <button
                            type="button"
                            onClick={handleInstantDemoLogin}
                            className="font-bold text-azure-600 hover:underline"
                          >
                            Open Full Analytics Suite →
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────
          SECTION 4: VISUAL WORKFLOW AUTOMATION ENGINE
          ───────────────────────────────────────────────────────────────────── */}
      <section id="automations" className="relative overflow-hidden bg-[#060d2b] py-16 text-white lg:py-24">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 top-0 h-[28rem] w-[28rem] rounded-full bg-azure-600/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 bottom-0 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl"
        />

        <Container className="relative z-10">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
            {/* Left Column */}
            <div className="space-y-6 lg:col-span-6">
              <span className="inline-flex items-center rounded-full border border-azure-500/40 bg-azure-500/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-azure-300">
                Automation
              </span>

              <h2 className="text-3xl font-black leading-tight tracking-tight sm:text-4xl lg:text-[30px] xl:text-[36px]">
                Turn business events into
                <br />
                <span className={`${AMBER} drop-shadow-[0_2px_16px_rgba(245,166,35,0.28)]`}>WhatsApp actions.</span>
              </h2>

              <p className="max-w-lg text-sm leading-relaxed text-slate-300 sm:text-base">
                Build visual workflows that respond to CRM events such as invoice creation, lead changes, or payment
                updates. Send alerts with messages, buttons, delays and conditional branches.
              </p>

              <ul className="space-y-2.5 text-sm text-slate-300">
                {AUTOMATION_CHECKS.map((item) => (
                  <li key={item} className="flex items-center gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-azure-500/40 bg-azure-500/15 text-azure-300">
                      <Check size={11} strokeWidth={3} />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    playAppSound("click");
                    setShowDemoModal(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-full bg-azure-600 px-6 py-3 text-sm font-bold text-white shadow-[0_14px_32px_rgba(37,99,235,0.38)] transition hover:bg-azure-700 hover:scale-[1.03] active:scale-95"
                >
                  <span>Explore Automation</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>

            {/* Right Column: flow diagram + payment card */}
            <div className="grid grid-cols-1 items-center gap-8 lg:col-span-6 md:grid-cols-12">
              <div className="space-y-3 md:col-span-7">
                <FlowNode
                  icon={<Radio size={13} />}
                  label="CRM Event"
                  title="Invoice Created"
                  tone="blue"
                />
                <FlowConnector />
                <FlowNode
                  icon={<MessageCircle size={13} />}
                  label="Send WhatsApp Message"
                  title="Payment reminder"
                  tone="blue"
                />

                <div className="flex flex-wrap gap-3 pl-1">
                  <span className="rounded-lg bg-azure-600 px-4 py-2 text-xs font-semibold text-white shadow-[0_8px_18px_rgba(37,99,235,0.35)]">
                    Pay Now
                  </span>
                  <span className="rounded-lg border border-white/20 px-4 py-2 text-xs font-semibold text-white">
                    Need help
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FlowNode icon={<CheckCircle2 size={13} />} label="Update CRM" title="Mark as Paid" tone="green" />
                  <FlowNode icon={<Zap size={13} />} label="Trigger Account" title="Notify Accounts" />
                </div>
              </div>

              {/* Payment notification card */}
              <div className="relative md:col-span-5">
                <div className="absolute -right-3 -top-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_12px_28px_rgba(16,185,129,0.45)]">
                  <MessageCircle size={20} />
                </div>

                <div className="rounded-3xl bg-white p-5 text-slate-900 shadow-[0_30px_70px_-25px_rgba(2,6,23,0.8)]">
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span>Payment due</span>
                  </div>

                  <h4 className={`mt-2 text-xl font-extrabold tracking-tight ${INK}`}>Your payment is due</h4>

                  <div className="mt-2 space-y-0.5 text-xs text-slate-500">
                    <p>Amount: ₹12,500</p>
                    <p>Due date: 20 Oct 2024</p>
                  </div>

                  <div className="mt-4 space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        playAppSound("click");
                        setPhoneActionFeedback("Opening UPI intent for ₹12,500...");
                      }}
                      className="w-full rounded-lg bg-azure-600 py-2.5 text-xs font-bold text-white shadow-[0_8px_18px_rgba(37,99,235,0.3)] transition hover:bg-azure-700 active:scale-[0.98]"
                    >
                      Pay Now / UPI
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        playAppSound("click");
                        setPhoneActionFeedback("Invoice PDF sent to this chat.");
                      }}
                      className="w-full rounded-lg bg-slate-100 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-200 active:scale-[0.98]"
                    >
                      Send PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        playAppSound("click");
                        setPhoneActionFeedback("Connecting you to the Accounts desk...");
                      }}
                      className="w-full rounded-lg bg-slate-100 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-200 active:scale-[0.98]"
                    >
                      Call Accounts
                    </button>
                  </div>

                  {phoneActionFeedback && (
                    <p className="mt-3 rounded-lg border border-azure-200 bg-azure-50 p-2 text-center text-[11px] font-semibold text-azure-700 animate-fade-in">
                      {phoneActionFeedback}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────
          SECTION 5: INTEGRATION ECOSYSTEM
          ───────────────────────────────────────────────────────────────────── */}
      <section id="integrations" className="bg-white py-16 lg:py-20">
        <Container>
          <div className="mx-auto mb-12 max-w-3xl space-y-3 text-center">
            <Eyebrow>Integrations</Eyebrow>
            <h2 className={`text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-[40px] ${INK}`}>
              Keep WhatsApp connected to the systems you already use.
            </h2>
            <p className="mx-auto max-w-2xl text-sm leading-relaxed text-slate-500 sm:text-base">
              Connect Madhura with your CRM through APIs, webhooks and event-driven integrations, allowing customer
              and business events to move between your systems and WhatsApp workflows.
            </p>
          </div>

          {/* CRM → Madhura → WhatsApp bridge (animated flow lines) */}
          <div className="mx-auto mb-14 max-w-5xl rounded-3xl border border-slate-200 bg-[#f7f9fe] p-6 sm:p-8">
            <div className="grid grid-cols-1 items-center gap-5 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
              <div className="group rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm transition duration-300 hover:-translate-y-1 hover:border-azure-300 hover:shadow-[0_16px_32px_-16px_rgba(37,99,235,0.35)]">
                <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-azure-50 text-azure-600 transition duration-300 group-hover:scale-110 group-hover:bg-azure-600 group-hover:text-white">
                  <Users size={20} />
                </span>
                <h4 className={`mt-3 text-sm font-bold ${INK}`}>Your CRM</h4>
                <p className="mt-0.5 text-xs text-slate-500">Customer Events</p>
              </div>

              <div className="flex flex-col items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">API / Webhooks</span>
                <span className="relative hidden h-1 w-16 overflow-hidden rounded-full bg-slate-200 md:block">
                  <span className="absolute inset-y-0 left-0 w-1/3 animate-bridge-flow rounded-full bg-gradient-to-r from-transparent via-azure-500 to-azure-600" />
                </span>
                <ArrowRight size={14} className="animate-pulse text-azure-500 md:hidden" />
              </div>

              <div className="group rounded-2xl border-2 border-azure-500 bg-white p-5 text-center shadow-[0_16px_36px_-18px_rgba(37,99,235,0.6)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_48px_-18px_rgba(37,99,235,0.7)]">
                <span className="mx-auto block transition duration-300 group-hover:scale-110">
                  <BrandLogo variant="on-light" className="mx-auto h-9" />
                </span>
                <p className="mt-3 text-xs font-semibold text-azure-600">WhatsApp CRM</p>
              </div>

              <div className="flex flex-col items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Conversations</span>
                <span className="relative hidden h-1 w-16 overflow-hidden rounded-full bg-slate-200 md:block">
                  <span className="absolute inset-y-0 left-0 w-1/3 animate-bridge-flow rounded-full bg-gradient-to-r from-transparent via-emerald-500 to-emerald-600" style={{ animationDelay: "0.8s" }} />
                </span>
                <ArrowRight size={14} className="animate-pulse text-azure-500 md:hidden" />
              </div>

              <div className="group rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm transition duration-300 hover:-translate-y-1 hover:border-emerald-300 hover:shadow-[0_16px_32px_-16px_rgba(16,185,129,0.35)]">
                <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition duration-300 group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white">
                  <MessageCircle size={20} />
                </span>
                <h4 className={`mt-3 text-sm font-bold ${INK}`}>WhatsApp</h4>
                <p className="mt-0.5 text-xs text-slate-500">Conversations</p>
              </div>
            </div>
          </div>

          {/* 4 connectivity method cards */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {INTEGRATION_CARDS.map(({ title, badge, desc, Icon }) => (
              <div
                key={title}
                className="group relative flex min-h-[190px] flex-col overflow-hidden rounded-2xl bg-[linear-gradient(155deg,#3b82f6_0%,#2563eb_55%,#1a44c4_100%)] p-5 text-white shadow-[0_22px_44px_-22px_rgba(37,99,235,0.8)] transition duration-300 hover:-translate-y-2 hover:shadow-[0_30px_58px_-20px_rgba(37,99,235,0.95)]"
              >
                {/* Shine sweep on hover */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -inset-y-2 left-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-hover:animate-shine-sweep"
                />
                <div className="relative flex items-start justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/18 text-white ring-1 ring-white/25 transition duration-300 group-hover:scale-110 group-hover:bg-white/30">
                    <Icon size={19} />
                  </span>
                  <span className="rounded-full bg-white/18 px-2.5 py-0.5 text-[10px] font-bold ring-1 ring-white/25 transition duration-300 group-hover:bg-white/30">
                    {badge}
                  </span>
                </div>

                <h4 className="relative mt-5 text-base font-bold">{title}</h4>
                <p className="relative mt-1 text-xs leading-relaxed text-white/80">{desc}</p>

                <button
                  type="button"
                  onClick={handleInstantDemoLogin}
                  className="relative mt-auto inline-flex items-center gap-1 pt-4 text-xs font-bold text-white transition hover:gap-2"
                >
                  <span>Learn more</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────
          SECTION 6: PRE-FOOTER CONVERSION SECTION
          ───────────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#060d2b] py-20 text-white lg:py-24">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_70%_at_50%_0%,rgba(37,99,235,0.3),transparent_70%)]"
        />

        <Container className="relative z-10">
          <div className="mx-auto max-w-3xl space-y-5 text-center">
            <h2 className="text-3xl font-black leading-tight tracking-tight sm:text-4xl lg:text-[44px]">
              Make WhatsApp part of your business workflow.
            </h2>

            <p className="mx-auto max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
              Bring conversations, campaigns, automation and CRM events together with Madhura WhatsApp CRM.
            </p>

            <div className="flex justify-center pt-3">
              <button
                type="button"
                onClick={() => {
                  playAppSound("click");
                  setShowDemoModal(true);
                }}
                className="inline-flex items-center gap-2 rounded-full bg-azure-600 px-8 py-4 text-sm font-bold text-white shadow-[0_18px_40px_rgba(37,99,235,0.42)] transition hover:bg-azure-700 hover:scale-[1.03] active:scale-95 sm:text-base"
              >
                <span>Book a Demo</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </Container>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────
          SECTION 7: LANDING FOOTER
          ───────────────────────────────────────────────────────────────────── */}
      <LandingFooter />

      {/* ─────────────────────────────────────────────────────────────────────
          MODAL: ADD CONTACT
          ───────────────────────────────────────────────────────────────────── */}
      {showAddContactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
                <Users size={16} className="text-azure-600" />
                <span>Add Customer to Directory</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddContactModal(false)}
                aria-label="Close"
                className="rounded-lg p-1 text-slate-400 transition hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddContactSubmit} className="space-y-3.5 pt-4 text-xs">
              <div>
                <label className="mb-1 block font-bold text-slate-700">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newContactForm.name}
                  onChange={(e) => setNewContactForm({ ...newContactForm, name: e.target.value })}
                  placeholder="e.g. Ramesh Patel"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-900 focus:border-azure-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block font-bold text-slate-700">WhatsApp Phone *</label>
                <input
                  type="text"
                  required
                  value={newContactForm.phone}
                  onChange={(e) => setNewContactForm({ ...newContactForm, phone: e.target.value })}
                  placeholder="+91 98111 22334"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-900 focus:border-azure-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block font-bold text-slate-700">Company / Organization</label>
                <input
                  type="text"
                  value={newContactForm.company}
                  onChange={(e) => setNewContactForm({ ...newContactForm, company: e.target.value })}
                  placeholder="e.g. TechCorp Solutions"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-900 focus:border-azure-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block font-bold text-slate-700">Branch Scope</label>
                <select
                  value={newContactForm.branch}
                  onChange={(e) => setNewContactForm({ ...newContactForm, branch: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-900 focus:border-azure-400 focus:outline-none"
                >
                  <option value="Head Office (Main)">Head Office (Main)</option>
                  <option value="Mumbai Metro">Mumbai Metro Branch</option>
                  <option value="Bengaluru South">Bengaluru South Branch</option>
                  <option value="Delhi Central">Delhi Central Branch</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddContactModal(false)}
                  className="rounded-lg border border-slate-200 px-3.5 py-2 font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-azure-600 px-4 py-2 font-bold text-white shadow-sm transition hover:bg-azure-700"
                >
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────
          MODAL: BOOK A DEMO
          ───────────────────────────────────────────────────────────────────── */}
      {/* ─────────────────────────────────────────────────────────────────────
          MODAL: ENTERPRISE 1-ON-1 DEMO INTAKE
          ───────────────────────────────────────────────────────────────────── */}
      {showDemoModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 sm:p-5 backdrop-blur-md animate-fade-in overflow-y-auto"
        >
          {/* Backdrop Click Dismiss */}
          <div
            className="fixed inset-0 -z-10"
            onClick={() => {
              setShowDemoModal(false);
              setDemoSubmitted(false);
            }}
          />

          <div className="relative my-auto w-full max-w-4xl max-h-[92vh] overflow-hidden rounded-3xl border border-azure-500/25 bg-[#070e26] text-white shadow-[0_25px_80px_-15px_rgba(2,6,23,0.95)] flex flex-col">
            {/* Top gradient highlight strip */}
            <div className="h-1 w-full bg-gradient-to-r from-azure-500 via-[#f5a623] to-emerald-400 shrink-0" />

            {/* Close Button */}
            <button
              type="button"
              onClick={() => {
                setShowDemoModal(false);
                setDemoSubmitted(false);
              }}
              aria-label="Close modal"
              className="absolute right-4 top-4 z-20 rounded-full border border-white/10 bg-white/5 p-2 text-slate-400 backdrop-blur-sm transition hover:bg-white/15 hover:text-white"
            >
              <X size={18} />
            </button>

            {demoSubmitted ? (
              <div className="flex flex-col items-center justify-center p-8 sm:p-14 text-center my-auto">
                <div className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 ring-8 ring-emerald-500/10">
                  <CheckCircle2 size={44} className="animate-scale-in" />
                  <span className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-4 w-4 rounded-full bg-emerald-500" />
                  </span>
                </div>

                <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-300 mb-3">
                  <ShieldCheck size={14} />
                  <span>Enterprise Request Confirmed</span>
                </div>

                <h3 className="text-2xl sm:text-3xl font-black text-white">
                  Demo Consultation Scheduled!
                </h3>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-300">
                  Thank you, <strong className="text-white">{demoForm.name || "Customer"}</strong>. Our enterprise solution architect has received your inquiry for <strong className="text-white">{demoForm.company || "your business"}</strong>.
                </p>

                <div className="mt-6 flex flex-col sm:flex-row items-center gap-3 w-full max-w-sm">
                  <a
                    href={LIVE_APP_URL}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-3.5 text-sm font-bold text-white shadow-[0_8px_20px_rgba(16,185,129,0.35)] transition hover:from-emerald-600 hover:to-teal-700"
                  >
                    <span>Launch Live Workspace Now</span>
                    <ArrowRight size={16} />
                  </a>
                </div>

                <div className="mt-6 flex items-center gap-2 text-xs text-slate-400">
                  <RotateCw size={14} className="animate-spin text-azure-400" />
                  <span>Auto-redirecting to live workspace in a moment...</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-12 overflow-y-auto">
                {/* ── Left Column: Enterprise Value Proposition & Credentials ── */}
                <div className="md:col-span-5 bg-gradient-to-b from-[#091538] to-[#060c22] p-6 lg:p-8 flex flex-col justify-between border-b md:border-b-0 md:border-r border-white/10">
                  <div className="space-y-6">
                    <div>
                      <BrandLogo variant="on-dark" className="h-8 lg:h-9" />
                      <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-300">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                        </span>
                        <span>Official Cloud API Tier</span>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xl lg:text-2xl font-black text-white leading-tight">
                        Tailored Architecture for WhatsApp Operations
                      </h3>
                      <p className="mt-2 text-xs leading-relaxed text-slate-300">
                        Experience how regional brands and multi-branch organizations streamline customer messaging with enterprise governance.
                      </p>
                    </div>

                    <div className="space-y-3.5 pt-2">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-azure-500/15 text-azure-400 border border-azure-500/25">
                          <ShieldCheck size={16} />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white">Multi-Branch Team Routing</div>
                          <div className="text-[11px] text-slate-400">1 shared number partitioned across branch teams with auto-assignment.</div>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                          <Lock size={15} />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white">Audit Trails &amp; Retention</div>
                          <div className="text-[11px] text-slate-400">Role-based controls, ephemeral message caching &amp; compliance exports.</div>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/25">
                          <Zap size={15} />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white">Direct Meta Cloud API</div>
                          <div className="text-[11px] text-slate-400">Direct webhook delivery, campaign rate-limiting &amp; 99.95% uptime SLA.</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 pt-6 border-t border-white/10 space-y-3">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                      <span>SOC2 Compliant</span>
                      <span>·</span>
                      <span>GDPR Ready</span>
                      <span>·</span>
                      <span>ISO 27001</span>
                    </div>

                    <a
                      href={LIVE_APP_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] p-3 text-xs text-slate-200 transition hover:bg-white/[0.08] hover:border-azure-500/40"
                    >
                      <span className="flex items-center gap-2">
                        <Sparkles size={14} className="text-[#f5a623]" />
                        <span>Skip form? Try Live Workspace</span>
                      </span>
                      <ArrowRight size={13} className="text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-white" />
                    </a>
                  </div>
                </div>

                {/* ── Right Column: Enterprise Intake Form ── */}
                <div className="md:col-span-7 p-6 lg:p-8 bg-[#070e26]">
                  <div className="mb-5">
                    <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-azure-400">
                      Guided 1-on-1 Consultation
                    </span>
                    <h4 className="text-xl font-black text-white mt-0.5">
                      Schedule Enterprise Demo
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Our solution engineering team will demonstrate specific workflows for your team size.
                    </p>
                  </div>

                  <form onSubmit={handleDemoSubmit} className="space-y-3.5 text-xs">
                    {/* Name & Work Email */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block font-semibold text-slate-300">
                          Full Name <span className="text-rose-400">*</span>
                        </label>
                        <div className="relative">
                          <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                          <input
                            type="text"
                            required
                            value={demoForm.name}
                            onChange={(e) => setDemoForm({ ...demoForm, name: e.target.value })}
                            placeholder="e.g. Vikramaditya Sharma"
                            className="w-full rounded-xl border border-white/15 bg-white/[0.05] py-2.5 pl-9 pr-3 text-white placeholder-slate-500 focus:border-azure-500 focus:bg-white/[0.08] focus:outline-none transition"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block font-semibold text-slate-300">
                          Work Email <span className="text-rose-400">*</span>
                        </label>
                        <div className="relative">
                          <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                          <input
                            type="email"
                            required
                            value={demoForm.email}
                            onChange={(e) => setDemoForm({ ...demoForm, email: e.target.value })}
                            placeholder="name@company.com"
                            className="w-full rounded-xl border border-white/15 bg-white/[0.05] py-2.5 pl-9 pr-3 text-white placeholder-slate-500 focus:border-azure-500 focus:bg-white/[0.08] focus:outline-none transition"
                          />
                        </div>
                      </div>
                    </div>

                    {/* WhatsApp Phone & Company */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block font-semibold text-slate-300">
                          WhatsApp Business Phone <span className="text-rose-400">*</span>
                        </label>
                        <div className="relative">
                          <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                          <input
                            type="tel"
                            required
                            value={demoForm.phone}
                            onChange={(e) => setDemoForm({ ...demoForm, phone: e.target.value })}
                            placeholder="+91 98765 43210"
                            className="w-full rounded-xl border border-white/15 bg-white/[0.05] py-2.5 pl-9 pr-3 text-white placeholder-slate-500 focus:border-azure-500 focus:bg-white/[0.08] focus:outline-none transition"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block font-semibold text-slate-300">
                          Company / Organization <span className="text-rose-400">*</span>
                        </label>
                        <div className="relative">
                          <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                          <input
                            type="text"
                            required
                            value={demoForm.company}
                            onChange={(e) => setDemoForm({ ...demoForm, company: e.target.value })}
                            placeholder="e.g. Acme Enterprises"
                            className="w-full rounded-xl border border-white/15 bg-white/[0.05] py-2.5 pl-9 pr-3 text-white placeholder-slate-500 focus:border-azure-500 focus:bg-white/[0.08] focus:outline-none transition"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Team Size Segmented Control */}
                    <div>
                      <label className="mb-1.5 block font-semibold text-slate-300">
                        Team Size &amp; Operational Scale
                      </label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[
                          { id: "1-10", label: "1 - 10" },
                          { id: "11-50", label: "11 - 50" },
                          { id: "51-200", label: "51 - 200" },
                          { id: "200+", label: "200+ Org" },
                        ].map((size) => (
                          <button
                            key={size.id}
                            type="button"
                            onClick={() => setDemoForm({ ...demoForm, teamSize: size.id })}
                            className={`rounded-lg py-2 text-center text-xs font-semibold transition border ${
                              demoForm.teamSize === size.id
                                ? "bg-azure-600 text-white border-azure-400 shadow-md"
                                : "bg-white/[0.04] text-slate-400 border-white/10 hover:bg-white/[0.08] hover:text-white"
                            }`}
                          >
                            {size.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Primary Interest / Use Case Pills */}
                    <div>
                      <label className="mb-1.5 block font-semibold text-slate-300">
                        Primary Implementation Focus
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: "multi-branch", label: "🏢 Multi-Branch Shared Inbox" },
                          { id: "campaigns", label: "📢 Broadcast Campaigns" },
                          { id: "automation", label: "🤖 Chatbots & Workflows" },
                          { id: "api-sync", label: "🔗 CRM / ERP Webhook Sync" },
                        ].map((useCase) => (
                          <button
                            key={useCase.id}
                            type="button"
                            onClick={() => setDemoForm({ ...demoForm, useCase: useCase.id })}
                            className={`rounded-xl px-3 py-2 text-left text-[11px] font-semibold transition border flex items-center justify-between ${
                              demoForm.useCase === useCase.id
                                ? "bg-azure-500/20 text-azure-300 border-azure-400/50"
                                : "bg-white/[0.03] text-slate-400 border-white/10 hover:bg-white/[0.06] hover:text-slate-200"
                            }`}
                          >
                            <span>{useCase.label}</span>
                            {demoForm.useCase === useCase.id && (
                              <Check size={13} className="text-azure-400" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Submit Actions */}
                    <div className="pt-2 space-y-2.5">
                      <button
                        type="submit"
                        className="group w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-azure-600 to-azure-700 py-3.5 text-sm font-bold text-white shadow-[0_10px_25px_rgba(37,99,235,0.4)] transition hover:from-azure-500 hover:to-azure-600 hover:scale-[1.01] active:scale-[0.99]"
                      >
                        <span>Schedule 1-on-1 Architecture Demo</span>
                        <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
                      </button>

                      <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
                        <Lock size={12} className="text-slate-400" />
                        <span>Confidential Enterprise Review · NDA Protected · No obligation</span>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
