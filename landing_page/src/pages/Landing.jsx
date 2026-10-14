import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Inbox,
  MessageCircle,
  MessageSquare,
  QrCode,
  Send,
  Smartphone,
  Sparkles,
  Terminal,
  TrendingUp,
  Users,
  Zap,
  X,
  Shield,
  Lock,
  Globe,
  Radio,
  FileText,
  Sliders,
  Play,
  RotateCw,
  Search,
  Paperclip,
  Smile,
  Mic,
  PhoneCall,
  Filter,
  Download,
  Menu,
  Plus,
  RefreshCw,
  Building,
  CheckCheck,
  Activity,
  Award,
  BarChart3,
  Percent,
} from "lucide-react";
import { appUrl, mailto } from "../config/site";
import SiteFooter from "../components/SiteFooter";
import { LANDING_NAV } from "./marketing/siteNav";

/* ── Lightweight Web Audio Synthesizer for Real App Sensory Feedback ───────────── */

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

/* ── 3D-Styled Glossy Blue Icons for Section 2 ─────────────────────────────────── */

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

/* ── Initial Mock Data for Local Storage Persistence ──────────────────────────── */

const INITIAL_HERO_CHATS = {
  michael: {
    id: "michael",
    name: "Michael Scott",
    company: "Dunder Mifflin Inc",
    role: "Regional Director",
    avatar: "MS",
    status: "online",
    badge: "VIP Client",
    messages: [
      { id: 1, sender: "incoming", text: "Can you confirm the demo for tomorrow at 11am?", time: "10:42 AM" },
      { id: 2, sender: "outgoing", text: "Yes, confirmed. See you then! Thank you!", time: "10:43 AM" },
    ],
  },
  sarah: {
    id: "sarah",
    name: "Sarah Jenkins",
    company: "Acme Health Systems",
    role: "Procurement Lead",
    avatar: "SJ",
    status: "online",
    badge: "Hospital Branch",
    messages: [
      { id: 1, sender: "incoming", text: "Hi! How does the multi-branch sender routing work for our hospital branches?", time: "09:30 AM" },
      { id: 2, sender: "outgoing", text: "Each hospital branch can have its own dedicated WhatsApp number or share a single verified number with automatic department routing!", time: "09:32 AM" },
    ],
  },
  techcorp: {
    id: "techcorp",
    name: "Tech Corp HQ",
    company: "Enterprise IT Services",
    role: "IT Director",
    avatar: "TC",
    status: "online",
    badge: "50 Seats",
    messages: [
      { id: 1, sender: "incoming", text: "We need 50 seats with isolated access codes for our support executives.", time: "Yesterday" },
      { id: 2, sender: "outgoing", text: "Absolutely! Madhura generates unique WA-XXXXXX access codes so staff can log in securely without admin passwords.", time: "Yesterday" },
    ],
  },
  vikram: {
    id: "vikram",
    name: "Vikramaditya Rao",
    company: "FinTech India Pvt Ltd",
    role: "CTO",
    avatar: "VR",
    status: "away",
    badge: "API Partner",
    messages: [
      { id: 1, sender: "incoming", text: "Do you provide webhook callbacks for Razorpay and UPI payment confirmations?", time: "Oct 12" },
      { id: 2, sender: "outgoing", text: "Yes, our HMAC-verified webhooks process payment events and dispatch WhatsApp receipts in under 400ms.", time: "Oct 12" },
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

/* ── Main Landing Page Component ────────────────────────────────────────────── */

export default function Landing() {
  // 1. Hero Chat state with LocalStorage persistence
  const [heroChats, setHeroChats] = useState(() => {
    try {
      const saved = localStorage.getItem("madhura_hero_crm_state_v2");
      return saved ? JSON.parse(saved) : INITIAL_HERO_CHATS;
    } catch (_) {
      return INITIAL_HERO_CHATS;
    }
  });

  const [activeHeroContactId, setActiveHeroContactId] = useState("michael");
  const [heroContactSearch, setHeroContactSearch] = useState("");
  const [heroMessageInput, setHeroMessageInput] = useState("");
  const [isHeroTyping, setIsHeroTyping] = useState(false);

  // Save hero chats to local storage whenever updated
  useEffect(() => {
    try {
      localStorage.setItem("madhura_hero_crm_state_v2", JSON.stringify(heroChats));
    } catch (_) {}
  }, [heroChats]);

  const activeHeroContact = heroChats[activeHeroContactId] || heroChats.michael;

  // Filtered contacts in hero sidebar
  const filteredHeroContacts = useMemo(() => {
    return Object.values(heroChats).filter((c) =>
      c.name.toLowerCase().includes(heroContactSearch.toLowerCase()) ||
      c.company.toLowerCase().includes(heroContactSearch.toLowerCase())
    );
  }, [heroChats, heroContactSearch]);

  // Handle Hero message sending
  const handleHeroSendMessage = (textToSend = null) => {
    const text = (textToSend || heroMessageInput).trim();
    if (!text) return;

    playAppSound("sent");
    const userMsg = {
      id: Date.now(),
      sender: "outgoing",
      text,
      time: "Just now",
    };

    setHeroChats((prev) => {
      const contact = prev[activeHeroContactId] || prev.michael;
      return {
        ...prev,
        [activeHeroContactId]: {
          ...contact,
          messages: [...contact.messages, userMsg],
        },
      };
    });

    setHeroMessageInput("");
    setIsHeroTyping(true);

    // Dynamic intelligent reply simulation
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

      const botMsg = {
        id: Date.now() + 1,
        sender: "incoming",
        text: replyText,
        time: "Just now",
      };

      setHeroChats((prev) => {
        const contact = prev[activeHeroContactId] || prev.michael;
        return {
          ...prev,
          [activeHeroContactId]: {
            ...contact,
            messages: [...contact.messages, botMsg],
          },
        };
      });
    }, 1300);
  };

  // 2. Section 3 (Core Suite) State & LocalStorage
  const [activeFeatureTab, setActiveFeatureTab] = useState(0);

  // Tab 0: Live Inbox Chat inside Suite
  const [suiteInboxMessage, setSuiteInboxMessage] = useState("");
  const [suiteMessages, setSuiteMessages] = useState(() => {
    try {
      const saved = localStorage.getItem("madhura_suite_inbox_v2");
      return saved ? JSON.parse(saved) : [
        { id: 1, sender: "customer", text: "Hi! Could you send me the pricing details for the enterprise tier?", time: "11:02 AM" },
        { id: 2, sender: "agent", text: "Hello Devansh! Absolutely, here is the enterprise breakdown. Would you also like a live demo?", time: "11:03 AM" },
      ];
    } catch (_) {
      return [
        { id: 1, sender: "customer", text: "Hi! Could you send me the pricing details for the enterprise tier?", time: "11:02 AM" },
        { id: 2, sender: "agent", text: "Hello Devansh! Absolutely, here is the enterprise breakdown. Would you also like a live demo?", time: "11:03 AM" },
      ];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("madhura_suite_inbox_v2", JSON.stringify(suiteMessages));
    } catch (_) {}
  }, [suiteMessages]);

  const handleSendSuiteMessage = (e) => {
    e?.preventDefault();
    if (!suiteInboxMessage.trim()) return;
    playAppSound("sent");
    const newMsg = {
      id: Date.now(),
      sender: "agent",
      text: suiteInboxMessage.trim(),
      time: "Just now",
    };
    setSuiteMessages((prev) => [...prev, newMsg]);
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

  // Tab 1: Contacts Table inside Suite
  const [contactsList, setContactsList] = useState(() => {
    try {
      const saved = localStorage.getItem("madhura_suite_contacts_v2");
      return saved ? JSON.parse(saved) : INITIAL_CONTACTS;
    } catch (_) {
      return INITIAL_CONTACTS;
    }
  });
  const [contactsFilter, setContactsFilter] = useState("all");
  const [contactSearchQuery, setContactSearchQuery] = useState("");
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [newContactForm, setNewContactForm] = useState({ name: "", phone: "", company: "", branch: "Head Office (Main)" });

  useEffect(() => {
    try {
      localStorage.setItem("madhura_suite_contacts_v2", JSON.stringify(contactsList));
    } catch (_) {}
  }, [contactsList]);

  const handleAddContactSubmit = (e) => {
    e.preventDefault();
    if (!newContactForm.name || !newContactForm.phone) return;
    playAppSound("click");
    const created = {
      id: Date.now(),
      name: newContactForm.name,
      phone: newContactForm.phone,
      email: `${newContactForm.name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
      company: newContactForm.company || "Independent Client",
      branch: newContactForm.branch,
      tags: ["New Lead", "Web Form"],
      status: "Active",
    };
    setContactsList((prev) => [created, ...prev]);
    setShowAddContactModal(false);
    setNewContactForm({ name: "", phone: "", company: "", branch: "Head Office (Main)" });
  };

  // Tab 2: Campaigns inside Suite
  const [campaignsList, setCampaignsList] = useState(() => {
    try {
      const saved = localStorage.getItem("madhura_suite_campaigns_v2");
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
  const [demoForm, setDemoForm] = useState({ name: "", email: "", phone: "", company: "", teamSize: "1-10" });
  const [demoSubmitted, setDemoSubmitted] = useState(false);

  /* The authenticated workspace ships as the `frontend` project on its own
     origin, so demo hand-offs hand the browser over instead of writing a
     session token this origin cannot use. The login screen opens on its demo
     tab (?tab=demo) with one click from there. */
  const handleInstantDemoLogin = () => {
    playAppSound("click");
    window.location.href = appUrl("/login?tab=demo");
  };

  const handleDemoSubmit = (e) => {
    e.preventDefault();
    playAppSound("received");
    setDemoSubmitted(true);
    setTimeout(() => {
      window.location.href = appUrl("/login?tab=demo");
    }, 1800);
  };

  // Section 4 Phone action feedback
  const [phoneActionFeedback, setPhoneActionFeedback] = useState(null);

  // Feature tab configurations
  const FEATURE_TABS = [
    { id: "inbox", title: "Live Inbox", desc: "Shared inbox with multi-agent collision detection", icon: Inbox },
    { id: "contacts", title: "Contacts & Groups", desc: "Segment and manage customer lists with tags", icon: Users },
    { id: "campaigns", title: "Campaigns", desc: "Broadcast at scale without getting banned", icon: Send },
    { id: "templates", title: "Templates", desc: "Pre-approved Meta templates with variables", icon: FileText },
    { id: "analytics", title: "Analytics", desc: "Response times & engagement rates", icon: TrendingUp },
  ];

  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#070b16] text-slate-100 font-sans selection:bg-blue-600 selection:text-white">
      {/* ─────────────────────────────────────────────────────────────────────────
          HEADER / NAVBAR
          ───────────────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-[#070b16]/90 backdrop-blur-md border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group shrink-0" aria-label="MADHURA home">
            <img
              src="/Group.png"
              alt="Madhura WhatsApp CRM"
              className="h-10 w-auto object-contain transition group-hover:scale-105"
            />
          </Link>

          {/* Nav Links — every item is a real public URL, never an in-page anchor */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300" aria-label="Primary">
            {LANDING_NAV.map((item) => (
              <Link key={item.path} to={item.path} className="hover:text-white transition">
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-3.5">
            <a
              href={appUrl("/login")}
              className="hidden sm:inline text-xs sm:text-sm font-semibold text-slate-300 hover:text-white px-3 py-2 transition"
            >
              Sign In
            </a>
            <button
              onClick={() => {
                playAppSound("click");
                setShowDemoModal(true);
              }}
              className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold px-5 py-2.5 rounded-full shadow-lg shadow-blue-600/30 transition hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Book a Demo</span>
              <ArrowRight size={14} />
            </button>
            <button
              type="button"
              onClick={() => setMobileNavOpen((v) => !v)}
              aria-expanded={mobileNavOpen}
              aria-controls="landing-mobile-nav"
              aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
              className="md:hidden text-slate-200 hover:text-white p-2 -mr-2"
            >
              {mobileNavOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {mobileNavOpen && (
          <div
            id="landing-mobile-nav"
            className="md:hidden border-t border-white/[0.08] bg-[#070b16] max-h-[calc(100vh-5rem)] overflow-y-auto"
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-4">
              <ul className="space-y-1">
                {LANDING_NAV.map((item) => (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      onClick={() => setMobileNavOpen(false)}
                      className="block text-sm font-medium text-slate-200 hover:text-white py-2"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="pt-4 border-t border-white/[0.08] flex flex-col gap-2">
                <a
                  href={appUrl("/signup")}
                  className="text-center bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm px-5 py-3 rounded-full"
                >
                  Start free trial
                </a>
                <a
                  href={appUrl("/login")}
                  className="text-center text-sm font-semibold text-slate-300 hover:text-white py-2"
                >
                  Sign in
                </a>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ─────────────────────────────────────────────────────────────────────────
          SECTION 1: HERO
          ───────────────────────────────────────────────────────────────────────── */}
      <section className="relative pt-10 pb-16 lg:pt-14 lg:pb-24 overflow-hidden bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(37,99,235,0.22),transparent_70%)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left Column (Headline & CTAs) */}
            <div className="lg:col-span-5 space-y-6">
              {/* Feature Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-950/60 border border-blue-500/30 text-blue-300 text-xs font-semibold backdrop-blur-sm shadow-sm">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                <span>New Feature | Unified WhatsApp Cloud &amp; Web</span>
              </div>

              {/* Main Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-black tracking-tight leading-[1.08] text-white">
                Turn WhatsApp <br />
                conversations into <br />
                <span className="text-[#f59e0b] drop-shadow-[0_2px_12px_rgba(245,158,11,0.25)]">
                  business workflows
                </span>
              </h1>

              {/* Subtitle */}
              <p className="text-base sm:text-lg text-slate-300 font-normal leading-relaxed">
                Messaging, team inbox, billing, and campaign automation tailored for modern businesses.
                Centralize your team and automate customer engagement.
              </p>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <button
                  onClick={() => {
                    playAppSound("click");
                    setShowDemoModal(true);
                  }}
                  className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm sm:text-base px-7 py-3.5 rounded-full shadow-xl shadow-blue-600/35 transition hover:scale-105 active:scale-95"
                >
                  <span>Book a Demo</span>
                  <ArrowRight size={16} />
                </button>

                <button
                  onClick={handleInstantDemoLogin}
                  className="inline-flex items-center justify-center gap-2 bg-white/[0.07] hover:bg-white/[0.12] text-white font-semibold text-sm sm:text-base px-6 py-3.5 rounded-full border border-white/15 backdrop-blur-sm transition"
                >
                  <Sparkles size={16} className="text-amber-400" />
                  <span>Explore Product</span>
                </button>
              </div>

              {/* Micro-Features */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-3 text-xs sm:text-sm text-slate-400">
                <div className="flex items-center gap-1.5">
                  <Check size={14} className="text-blue-400 stroke-[3]" />
                  <span>Fast Setup</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check size={14} className="text-blue-400 stroke-[3]" />
                  <span>Team Inbox</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check size={14} className="text-blue-400 stroke-[3]" />
                  <span>Automations</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check size={14} className="text-blue-400 stroke-[3]" />
                  <span>CRM Integration</span>
                </div>
              </div>
            </div>

            {/* Right Column: Deeply Interactive Real-App Mockup (Persisted in LocalStorage) */}
            <div className="lg:col-span-7 relative">
              {/* WhatsApp Floating Orb */}
              <div className="absolute -top-5 -left-4 z-20 w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xl shadow-emerald-500/40 ring-4 ring-[#070b16]">
                <MessageCircle size={24} />
              </div>

              {/* Main App Window Card */}
              <div className="relative rounded-2xl bg-[#0c1427] border border-white/[0.14] shadow-2xl shadow-blue-950/70 backdrop-blur-xl overflow-hidden ring-1 ring-white/10">
                {/* Window Chrome Header with System Controls */}
                <div className="px-4 py-2.5 bg-[#080e1c] border-b border-white/[0.08] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/80 hover:opacity-80 cursor-pointer" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80 hover:opacity-80 cursor-pointer" />
                    <div className="w-3 h-3 rounded-full bg-green-500/80 hover:opacity-80 cursor-pointer" />
                    <span className="ml-2 font-mono text-[11px] text-slate-400 hidden sm:inline">
                      https://madhura.app/workspace/inbox
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        localStorage.removeItem("madhura_hero_crm_state_v2");
                        setHeroChats(INITIAL_HERO_CHATS);
                        playAppSound("click");
                      }}
                      title="Reset sample chat storage"
                      className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-white/5"
                    >
                      <RotateCw size={10} />
                      <span>Reset</span>
                    </button>
                    <div className="flex items-center gap-1.5 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[10px] font-bold text-emerald-300">Live Simulation</span>
                    </div>
                  </div>
                </div>

                {/* Internal CRM Dual-Pane Grid */}
                <div className="grid grid-cols-12 min-h-[430px]">
                  {/* Left Channels List Pane (4 Cols) */}
                  <div className="col-span-12 sm:col-span-5 bg-[#091022] border-r border-white/[0.08] flex flex-col justify-between">
                    <div>
                      {/* Search & Header */}
                      <div className="p-3 border-b border-white/[0.06] space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-white">
                            Conversations
                          </span>
                          <span className="text-[10px] font-mono text-emerald-300 bg-emerald-950/80 px-1.5 py-0.2 rounded border border-emerald-500/30">
                            {Object.keys(heroChats).length} Active
                          </span>
                        </div>
                        <div className="relative">
                          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/70" />
                          <input
                            type="text"
                            value={heroContactSearch}
                            onChange={(e) => setHeroContactSearch(e.target.value)}
                            placeholder="Filter contacts..."
                            className="w-full bg-[#131d36] border border-white/10 rounded-lg pl-7 pr-2 py-1 text-[11px] text-white placeholder-white/50 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>

                      {/* Contact Items List */}
                      <div className="p-1.5 space-y-1 max-h-[300px] overflow-y-auto">
                        {filteredHeroContacts.map((contact) => {
                          const isSelected = contact.id === activeHeroContactId;
                          const lastMsg = contact.messages[contact.messages.length - 1];
                          return (
                            <button
                              key={contact.id}
                              onClick={() => {
                                playAppSound("click");
                                setActiveHeroContactId(contact.id);
                              }}
                              className={`w-full text-left p-2 rounded-xl transition flex items-start gap-2.5 ${
                                isSelected
                                  ? "bg-blue-600/35 border border-blue-500/50 text-white shadow-sm"
                                  : "hover:bg-white/[0.06] text-white border border-transparent"
                              }`}
                            >
                              <div className="relative shrink-0">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-700 to-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                                  {contact.avatar}
                                </div>
                                <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-[#091022] ${contact.status === "online" ? "bg-emerald-400" : "bg-amber-400"}`} />
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-xs truncate text-white">{contact.name}</span>
                                  <span className="text-[9px] text-white font-medium">{lastMsg?.time || "Now"}</span>
                                </div>
                                <p className="text-[10px] text-white/90 truncate mt-0.5">
                                  {lastMsg?.text || "No messages yet"}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Quick App Bottom Bar */}
                    <div className="p-2.5 bg-[#080d1a] border-t border-white/[0.06] flex items-center justify-between text-[10px] text-white/80">
                      <span>Saved locally</span>
                      <span className="text-emerald-300 font-semibold">Ready</span>
                    </div>
                  </div>

                  {/* Right Chat Area (7 Cols) */}
                  <div className="col-span-12 sm:col-span-7 flex flex-col justify-between bg-[#0b1429]">
                    {/* Active Chat Header */}
                    <div className="p-3 bg-[#0a1224] border-b border-white/[0.08] flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-emerald-700/80 text-white font-bold text-xs flex items-center justify-center border border-emerald-500/40">
                          {activeHeroContact.avatar}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white flex items-center gap-1.5">
                            <span className="text-white">{activeHeroContact.name}</span>
                            <span className="text-[9px] font-semibold bg-blue-900/60 text-white border border-blue-500/30 px-1.5 py-0.2 rounded-full">
                              {activeHeroContact.badge}
                            </span>
                          </div>
                          <div className="text-[10px] text-white/80 truncate max-w-[180px]">
                            {activeHeroContact.company}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            playAppSound("click");
                            alert(`Initiating verified WhatsApp Voice Call to ${activeHeroContact.name}...`);
                          }}
                          title="Call on WhatsApp"
                          className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition"
                        >
                          <PhoneCall size={13} />
                        </button>
                        <button
                          onClick={handleInstantDemoLogin}
                          title="Open Full Workspace"
                          className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition"
                        >
                          <ExternalLink size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Message Timeline */}
                    <div 
                      className="p-4 space-y-3 overflow-y-auto max-h-[250px] min-h-[200px] text-xs text-white !text-white"
                      style={{ color: "#ffffff" }}
                    >
                      {activeHeroContact.messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.sender === "outgoing" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-md text-white !text-white ${
                              msg.sender === "outgoing"
                                ? "bg-emerald-600 text-white !text-white rounded-tr-none shadow-emerald-950/40"
                                : "bg-[#18233c] text-white !text-white rounded-tl-none border border-white/[0.16]"
                            }`}
                            style={{ color: "#ffffff" }}
                          >
                            <p 
                              className="leading-snug text-white !text-white font-medium"
                              style={{ color: "#ffffff" }}
                            >
                              {msg.text}
                            </p>
                            <span 
                              className="block text-[9px] mt-1 text-right text-white !text-white font-medium"
                              style={{ color: "#ffffff" }}
                            >
                              {msg.time} {msg.sender === "outgoing" && "✓✓"}
                            </span>
                          </div>
                        </div>
                      ))}

                      {isHeroTyping && (
                        <div className="flex justify-start">
                          <div 
                            className="bg-[#18233c] text-white !text-white border border-white/[0.16] rounded-2xl rounded-tl-none px-3.5 py-2 text-[11px] flex items-center gap-2"
                            style={{ color: "#ffffff" }}
                          >
                            <span 
                              className="animate-pulse text-white !text-white font-medium"
                              style={{ color: "#ffffff" }}
                            >
                              {activeHeroContact.name} is typing
                            </span>
                            <span className="flex gap-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" />
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce [animation-delay:0.15s]" />
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce [animation-delay:0.3s]" />
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Quick Canned Suggestions */}
                    <div className="px-3 pt-1 flex items-center gap-1.5 overflow-x-auto text-[10px]">
                      <button
                        onClick={() => handleHeroSendMessage("Can you send me the enterprise pricing breakdown?")}
                        className="whitespace-nowrap px-2.5 py-1 rounded-full bg-[#131d38] hover:bg-blue-600 text-white !text-white border border-white/20 transition font-medium"
                        style={{ color: "#ffffff" }}
                      >
                        💰 Ask Pricing
                      </button>
                      <button
                        onClick={() => handleHeroSendMessage("How do multi-branch access codes work?")}
                        className="whitespace-nowrap px-2.5 py-1 rounded-full bg-[#131d38] hover:bg-blue-600 text-white !text-white border border-white/20 transition font-medium"
                        style={{ color: "#ffffff" }}
                      >
                        🏢 Multi-Branch Access
                      </button>
                      <button
                        onClick={() => handleHeroSendMessage("Can we schedule a 1-on-1 team onboarding?")}
                        className="whitespace-nowrap px-2.5 py-1 rounded-full bg-[#131d38] hover:bg-blue-600 text-white !text-white border border-white/20 transition font-medium"
                        style={{ color: "#ffffff" }}
                      >
                        📅 Book Onboarding
                      </button>
                    </div>

                    {/* Interactive Input Form */}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleHeroSendMessage();
                      }}
                      className="p-3 border-t border-white/[0.08] flex items-center gap-2 bg-[#091022]"
                    >
                      <input
                        type="text"
                        value={heroMessageInput}
                        onChange={(e) => setHeroMessageInput(e.target.value)}
                        placeholder={`Message ${activeHeroContact.name}...`}
                        className="flex-1 bg-[#131d36] border border-white/[0.12] rounded-xl px-3.5 py-2 text-xs text-white !text-white placeholder-white/60 focus:outline-none focus:border-blue-500"
                        style={{ color: "#ffffff" }}
                      />
                      <button
                        type="submit"
                        className="w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-md transition active:scale-95"
                      >
                        <Send size={14} />
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────
          SECTION 2: 4 GLOSSY 3D FEATURE BENTO CARDS
          ───────────────────────────────────────────────────────────────────────── */}
      <section id="features" className="relative pt-16 pb-20 bg-gradient-to-b from-[#070b16] via-[#091530] to-[#f8fafc] text-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
            <span className="text-xs font-bold tracking-widest text-blue-400 uppercase">
              POWERFUL CAPABILITIES
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-4xl font-extrabold text-white tracking-tight">
              Everything you need to manage WhatsApp at scale.
            </h2>
          </div>

          {/* 4 Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Card 1: Live WhatsApp Inbox */}
            <div className="group relative rounded-2xl bg-gradient-to-b from-[#0e1a38] to-[#070e24] p-7 text-center border border-blue-500/20 hover:border-blue-400/50 shadow-2xl shadow-blue-950/70 hover:-translate-y-1.5 transition-all duration-300">
              <div className="flex justify-center mb-5">
                <Icon3DInbox className="w-24 h-24 transform group-hover:scale-110 transition duration-300" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Live WhatsApp Inbox</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Centralized shared inbox for sales and support with collision detection and ticket tracking.
              </p>
            </div>

            {/* Card 2: Campaigns */}
            <div className="group relative rounded-2xl bg-gradient-to-b from-[#0e1a38] to-[#070e24] p-7 text-center border border-blue-500/20 hover:border-blue-400/50 shadow-2xl shadow-blue-950/70 hover:-translate-y-1.5 transition-all duration-300">
              <div className="flex justify-center mb-5">
                <Icon3DCampaigns className="w-24 h-24 transform group-hover:scale-110 transition duration-300" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Campaigns</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Broadcast personalized messages to thousands with intelligent rate limiting and opt-out registries.
              </p>
            </div>

            {/* Card 3: Automation */}
            <div className="group relative rounded-2xl bg-gradient-to-b from-[#0e1a38] to-[#070e24] p-7 text-center border border-blue-500/20 hover:border-blue-400/50 shadow-2xl shadow-blue-950/70 hover:-translate-y-1.5 transition-all duration-300">
              <div className="flex justify-center mb-5">
                <Icon3DAutomation className="w-24 h-24 transform group-hover:scale-110 transition duration-300" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Automation</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Visual chatbot flows, interactive list menus, and instant trigger actions from your CRM events.
              </p>
            </div>

            {/* Card 4: Analytics */}
            <div className="group relative rounded-2xl bg-gradient-to-b from-[#0e1a38] to-[#070e24] p-7 text-center border border-blue-500/20 hover:border-blue-400/50 shadow-2xl shadow-blue-950/70 hover:-translate-y-1.5 transition-all duration-300">
              <div className="flex justify-center mb-5">
                <Icon3DAnalytics className="w-24 h-24 transform group-hover:scale-110 transition duration-300" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Analytics</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Real-time delivery KPIs, agent resolution speeds, campaign read ratios, and billing transparency.
              </p>
            </div>
          </div>

          {/* Under-Card Summary Subtext */}
          <div className="text-center max-w-2xl mx-auto mt-8">
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              From multi-agent live chat to smart drip campaigns and unified billing, Madhura provides complete operational control across every customer touchpoint.
            </p>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────
          SECTION 3: POWERFUL FEATURES FOR REAL BUSINESS COMMUNICATION
          (Deeply Interactive Core Suite Grid with Fully Functional Sub-Apps)
          ───────────────────────────────────────────────────────────────────────── */}
      <section id="suite" className="py-20 bg-white text-slate-900 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="max-w-2xl mb-12">
            <span className="text-xs font-bold tracking-widest text-blue-600 uppercase">
              CORE SUITE
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-1 mb-3">
              Powerful features for real business communication.
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Empower your sales, customer support, and operations with synchronized messaging, smart workflows, and deep CRM integrations all from one unified dashboard.
            </p>
          </div>

          {/* 2-Column Interactive Workspace Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: 5 Interactive Feature Cards */}
            <div className="lg:col-span-5 space-y-3">
              {FEATURE_TABS.map((tab, idx) => {
                const TabIcon = tab.icon;
                const isSelected = activeFeatureTab === idx;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      playAppSound("click");
                      setActiveFeatureTab(idx);
                    }}
                    className={`w-full text-left p-4 rounded-xl transition-all duration-200 border flex items-start gap-4 ${
                      isSelected
                        ? "bg-blue-50/90 border-blue-500 shadow-md ring-1 ring-blue-500/30"
                        : "bg-slate-50 hover:bg-slate-100 border-slate-200"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition ${
                        isSelected ? "bg-blue-600 text-white shadow-md shadow-blue-500/25" : "bg-white text-slate-500 border border-slate-200"
                      }`}
                    >
                      <TabIcon size={20} />
                    </div>
                    <div>
                      <h4 className={`text-sm font-bold ${isSelected ? "text-blue-950" : "text-slate-800"}`}>
                        {tab.title}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5 leading-normal">
                        {tab.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Right Column: Dynamic Deep Interactive Sub-Application Screen */}
            <div className="lg:col-span-7">
              <div className="rounded-2xl border border-slate-200/90 shadow-2xl bg-white overflow-hidden ring-1 ring-slate-900/5 min-h-[460px] flex flex-col justify-between">
                {/* Browser Frame Header */}
                <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-amber-400" />
                    <div className="w-3 h-3 rounded-full bg-emerald-400" />
                    <span className="ml-2 font-mono text-[11px] text-slate-600 font-medium">
                      https://madhura.app/workspace/{FEATURE_TABS[activeFeatureTab].id}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Interactive Feature Demo
                    </span>
                  </div>
                </div>

                {/* TAB 0: LIVE INBOX VIEW */}
                {activeFeatureTab === 0 && (
                  <div className="grid grid-cols-12 flex-1 min-h-[400px]">
                    <div className="col-span-4 bg-slate-50 border-r border-slate-200 p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800 pb-1">
                        <span>Inbox Queue</span>
                        <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.2 rounded-full">3</span>
                      </div>
                      <div className="p-2 rounded-lg bg-blue-100/70 border border-blue-300 text-xs">
                        <div className="font-bold text-slate-900">Devansh Mishra</div>
                        <p className="text-[10px] text-slate-500 truncate">Enterprise inquiry</p>
                      </div>
                      <div className="p-2 rounded-lg hover:bg-slate-100 text-xs text-slate-600">
                        <div className="font-semibold text-slate-800">Priya Sharma</div>
                        <p className="text-[10px] text-slate-400 truncate">Payment receipt requested</p>
                      </div>
                    </div>

                    <div className="col-span-8 flex flex-col justify-between p-4 bg-[#fcfdfe]">
                      <div className="pb-2 border-b border-slate-200 flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-slate-900 flex items-center gap-1">
                            <span>Devansh Mishra</span>
                            <CheckCircle2 size={11} className="text-emerald-500" />
                          </div>
                          <div className="text-[10px] text-slate-500">Apex Global Corp • Assigned: You</div>
                        </div>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                          Live
                        </span>
                      </div>

                      <div className="py-3 space-y-2.5 overflow-y-auto max-h-[220px]">
                        {suiteMessages.map((m) => (
                          <div key={m.id} className={`flex ${m.sender === "agent" ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs shadow-sm ${m.sender === "agent" ? "bg-[#dcf8c6] text-slate-900 rounded-tr-none" : "bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200"}`}>
                              <p>{m.text}</p>
                              <span className="block text-[8px] mt-1 text-right text-slate-500">{m.time} {m.sender === "agent" && "✓✓"}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <form onSubmit={handleSendSuiteMessage} className="pt-2 border-t border-slate-200 flex items-center gap-2">
                        <input
                          type="text"
                          value={suiteInboxMessage}
                          onChange={(e) => setSuiteInboxMessage(e.target.value)}
                          placeholder="Type reply or press enter..."
                          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                        />
                        <button type="submit" className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm transition">
                          Send
                        </button>
                      </form>
                    </div>
                  </div>
                )}

                {/* TAB 1: CONTACTS & GROUPS VIEW */}
                {activeFeatureTab === 1 && (
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={contactSearchQuery}
                          onChange={(e) => setContactSearchQuery(e.target.value)}
                          placeholder="Search customer phone, name..."
                          className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 w-48"
                        />
                        <span className="text-xs font-bold text-slate-500">
                          {contactsList.length} Contacts
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            playAppSound("click");
                            setShowAddContactModal(true);
                          }}
                          className="inline-flex items-center gap-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm transition"
                        >
                          <Plus size={13} />
                          <span>Add Contact</span>
                        </button>
                      </div>
                    </div>

                    {/* Interactive Contacts Table */}
                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                          <tr>
                            <th className="py-2.5 px-3">Name</th>
                            <th className="py-2.5 px-3">WhatsApp Number</th>
                            <th className="py-2.5 px-3">Branch Scope</th>
                            <th className="py-2.5 px-3">Tags</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {contactsList
                            .filter((c) =>
                              c.name.toLowerCase().includes(contactSearchQuery.toLowerCase()) ||
                              c.phone.includes(contactSearchQuery)
                            )
                            .map((contact) => (
                              <tr key={contact.id} className="hover:bg-slate-50/80">
                                <td className="py-2.5 px-3 font-bold text-slate-900">{contact.name}</td>
                                <td className="py-2.5 px-3 font-mono text-slate-600">{contact.phone}</td>
                                <td className="py-2.5 px-3 text-slate-500">📍 {contact.branch}</td>
                                <td className="py-2.5 px-3">
                                  {contact.tags.map((t, idx) => (
                                    <span key={idx} className="bg-blue-50 text-blue-700 text-[10px] font-semibold px-2 py-0.5 rounded-full mr-1 border border-blue-200">
                                      {t}
                                    </span>
                                  ))}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="text-[11px] text-slate-500 flex justify-between items-center pt-2">
                      <span>Stored in your local session. All contacts persist across reloads.</span>
                      <button onClick={handleInstantDemoLogin} className="text-blue-600 font-bold hover:underline">
                        Open Full CRM Contacts →
                      </button>
                    </div>
                  </div>
                )}

                {/* TAB 2: CAMPAIGNS BROADCAST ENGINE */}
                {activeFeatureTab === 2 && (
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">Broadcast Campaigns</h4>
                        <p className="text-xs text-slate-500">Automated pacing with 0% Meta account ban risk</p>
                      </div>
                      <button
                        onClick={handleLaunchCampaignSimulation}
                        disabled={isDispatchingCampaign}
                        className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm transition flex items-center gap-1.5"
                      >
                        <Play size={12} />
                        <span>{isDispatchingCampaign ? "Pacing & Dispatching..." : "+ Launch Test Blast"}</span>
                      </button>
                    </div>

                    {isDispatchingCampaign && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1.5">
                        <div className="flex justify-between text-xs font-bold text-emerald-900">
                          <span>Dispatching Flash Campaign via Meta Cloud API...</span>
                          <span>{campaignProgress}%</span>
                        </div>
                        <div className="w-full h-2 bg-emerald-200 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-600 transition-all duration-300" style={{ width: `${campaignProgress}%` }} />
                        </div>
                        <span className="text-[10px] text-emerald-700 font-medium">Paced at 25 messages / second with duplicate suppression.</span>
                      </div>
                    )}

                    <div className="space-y-2 overflow-y-auto max-h-[240px]">
                      {campaignsList.map((camp) => (
                        <div key={camp.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                          <div>
                            <div className="font-bold text-xs text-slate-900">{camp.name}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">Audience: {camp.audience} • Rate: {camp.rate}</div>
                          </div>
                          <div className="text-right">
                            <span className="text-[11px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                              {camp.status} ({camp.readRatio})
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="text-[11px] text-slate-500 flex justify-between items-center pt-2 border-t border-slate-100">
                      <span>Rate limiting &amp; opt-out checks enforced automatically.</span>
                      <button onClick={handleInstantDemoLogin} className="text-blue-600 font-bold hover:underline">
                        Create Real Campaign →
                      </button>
                    </div>
                  </div>
                )}

                {/* TAB 3: TEMPLATES VIEW */}
                {activeFeatureTab === 3 && (
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                    <div className="pb-2 border-b border-slate-200">
                      <h4 className="font-bold text-slate-900 text-sm">Official Meta Approved Templates</h4>
                      <p className="text-xs text-slate-500">Live preview with interactive variable substitution</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                      {/* Interactive Variable Inputs */}
                      <div className="space-y-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                        <span className="font-bold text-slate-800 block text-[11px] uppercase tracking-wider">
                          Test Template Variables
                        </span>
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 block">Customer Name {"{{1}}"}</label>
                          <input
                            type="text"
                            value={templateVar1}
                            onChange={(e) => setTemplateVar1(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 block">Invoice Amount {"{{2}}"}</label>
                          <input
                            type="text"
                            value={templateVar2}
                            onChange={(e) => setTemplateVar2(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 block">Due Date {"{{3}}"}</label>
                          <input
                            type="text"
                            value={templateVar3}
                            onChange={(e) => setTemplateVar3(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>

                      {/* Live WhatsApp Bubble Preview */}
                      <div className="p-3 bg-[#e5ddd5] rounded-xl shadow-inner min-h-[160px] flex flex-col justify-between">
                        <div className="bg-white p-3 rounded-xl shadow text-xs space-y-1.5 text-slate-900">
                          <p className="font-bold text-emerald-700 text-[11px]">MADHURA TECHNOLOGIES</p>
                          <p className="leading-relaxed">
                            Hello <strong>{templateVar1 || "Customer"}</strong>, your tax invoice of <strong>{templateVar2 || "₹0"}</strong> is ready. Due date: <strong>{templateVar3 || "Immediate"}</strong>.
                          </p>
                          <div className="pt-2 border-t border-slate-100 flex flex-col gap-1">
                            <span className="bg-slate-100 text-blue-600 font-bold text-[10px] py-1 text-center rounded border border-slate-200">
                              💳 Pay Now via UPI
                            </span>
                            <span className="bg-slate-100 text-slate-700 font-bold text-[10px] py-1 text-center rounded border border-slate-200">
                              📄 Download Invoice PDF
                            </span>
                          </div>
                        </div>
                        <span className="text-[9px] text-right text-slate-600 mt-1">Status: Verified Approved (Meta v22.0)</span>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-500 flex justify-between items-center pt-2 border-t border-slate-100">
                      <span>Synchronized with Meta Graph API in real time.</span>
                      <button onClick={handleInstantDemoLogin} className="text-blue-600 font-bold hover:underline">
                        Explore All 24 Templates →
                      </button>
                    </div>
                  </div>
                )}

                {/* TAB 4: ANALYTICS VIEW */}
                {activeFeatureTab === 4 && (
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">Real-Time WhatsApp Analytics</h4>
                        <p className="text-xs text-slate-500">Live agent SLA, response times, and read rates</p>
                      </div>
                      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs">
                        <button
                          onClick={() => setAnalyticsPeriod("today")}
                          className={`px-2.5 py-1 rounded font-bold transition ${analyticsPeriod === "today" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}
                        >
                          Today
                        </button>
                        <button
                          onClick={() => setAnalyticsPeriod("7d")}
                          className={`px-2.5 py-1 rounded font-bold transition ${analyticsPeriod === "7d" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}
                        >
                          7 Days
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Messages Dispatched</span>
                        <div className="text-lg font-black text-slate-900 mt-1">48,920</div>
                        <span className="text-[9px] text-emerald-600 font-bold">↑ 14.8% vs last week</span>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">First Response Time</span>
                        <div className="text-lg font-black text-blue-600 mt-1">42 sec</div>
                        <span className="text-[9px] text-emerald-600 font-bold">18s faster SLA</span>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Delivery Ratio</span>
                        <div className="text-lg font-black text-emerald-600 mt-1">99.4%</div>
                        <span className="text-[9px] text-slate-500 font-medium">Meta Tier 1 Verified</span>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">CSAT Score</span>
                        <div className="text-lg font-black text-amber-500 mt-1">4.9 / 5.0</div>
                        <span className="text-[9px] text-slate-500 font-medium">Based on 1,420 ratings</span>
                      </div>
                    </div>

                    {/* Team Leaderboard */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                      <div className="font-bold text-slate-900 mb-2 flex justify-between">
                        <span>Top Support &amp; Sales Performers</span>
                        <span className="text-slate-500 font-normal">Active Today</span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="font-semibold text-slate-800">1. Ananya Sharma (Mumbai)</span>
                          <span className="font-bold text-blue-700">142 Resolved • 38s avg</span>
                        </div>
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="font-semibold text-slate-800">2. Rohan Verma (Bengaluru)</span>
                          <span className="font-bold text-blue-700">118 Resolved • 44s avg</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-500 flex justify-between items-center pt-2 border-t border-slate-100">
                      <span>Export daily and monthly PDF executive reports in 1-click.</span>
                      <button onClick={handleInstantDemoLogin} className="text-blue-600 font-bold hover:underline">
                        Open Full Analytics Suite →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────
          SECTION 4: VISUAL WORKFLOW AUTOMATION ENGINE
          ───────────────────────────────────────────────────────────────────────── */}
      <section id="automations" className="py-20 bg-[#060c18] text-white border-t border-white/[0.08] relative overflow-hidden">
        <div className="absolute top-1/4 -right-20 w-96 h-96 rounded-full bg-blue-600/15 blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 -left-20 w-80 h-80 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Column: Heading & Features */}
            <div className="lg:col-span-5 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-950/70 border border-blue-500/40 text-blue-300 text-xs font-semibold">
                <Zap size={13} className="text-amber-400" />
                <span>AUTOMATION ENGINE</span>
              </div>

              <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight text-white">
                Turn business events into <br />
                <span className="text-[#f59e0b] drop-shadow-[0_2px_12px_rgba(245,158,11,0.25)]">
                  WhatsApp actions.
                </span>
              </h2>

              <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal">
                Trigger automated flows when customer status changes in your CRM or payment gateways.
                Deliver personalized notifications, order updates, OTPs, and dynamic surveys.
              </p>

              {/* Feature Checklist */}
              <div className="space-y-2.5 text-xs sm:text-sm text-slate-300">
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                    <Check size={12} strokeWidth={3} />
                  </div>
                  <span>Shopify, Razorpay &amp; CRM webhooks</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                    <Check size={12} strokeWidth={3} />
                  </div>
                  <span>Smart WhatsApp routing &amp; fallbacks</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                    <Check size={12} strokeWidth={3} />
                  </div>
                  <span>Flow builders with branching logic</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                    <Check size={12} strokeWidth={3} />
                  </div>
                  <span>Pre-built campaign recipes</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                    <Check size={12} strokeWidth={3} />
                  </div>
                  <span>Interactive list and button messages</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                    <Check size={12} strokeWidth={3} />
                  </div>
                  <span>Pay-per-use Razorpay &amp; Stripe triggers</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => {
                    playAppSound("click");
                    setShowDemoModal(true);
                  }}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm px-6 py-3 rounded-full shadow-lg shadow-blue-600/30 transition hover:scale-105"
                >
                  <span>Explore Automations</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>

            {/* Right Column: Node Diagram + Smartphone Mockup */}
            <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              {/* Flowchart Nodes */}
              <div className="md:col-span-6 space-y-4">
                <div className="rounded-xl bg-[#0e172c] border border-blue-500/30 p-3.5 shadow-lg shadow-blue-950/50">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-blue-400 uppercase tracking-wider">
                    <Radio size={12} className="text-emerald-400 animate-pulse" />
                    <span>Trigger Event</span>
                  </div>
                  <div className="text-xs font-bold text-white mt-1">Shopify: Order Confirmed</div>
                  <div className="text-[11px] text-slate-400">Order #ORD-9842 (₹2,499)</div>
                </div>

                <div className="flex justify-center -my-2">
                  <div className="w-0.5 h-6 bg-gradient-to-b from-blue-500 to-cyan-400" />
                </div>

                <div className="rounded-xl bg-[#0e172c] border border-cyan-500/30 p-3.5 shadow-lg shadow-blue-950/50">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
                    <Sliders size={12} />
                    <span>Customer Segmentation</span>
                  </div>
                  <div className="text-xs font-bold text-white mt-1">Check VIP / Purchase History</div>
                  <div className="text-[11px] text-slate-400">Branching routing logic applied</div>
                </div>

                <div className="flex justify-center -my-2">
                  <div className="w-0.5 h-6 bg-gradient-to-b from-cyan-400 to-emerald-400" />
                </div>

                <div className="rounded-xl bg-[#092225] border border-emerald-500/40 p-3.5 shadow-lg shadow-emerald-950/40">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                    <MessageCircle size={12} />
                    <span>Action: WhatsApp Cloud</span>
                  </div>
                  <div className="text-xs font-bold text-white mt-1">Dispatch Interactive Quick-Reply Card</div>
                  <div className="text-[11px] text-slate-400">Paced deliverability via Meta Cloud API</div>
                </div>
              </div>

              {/* Smartphone Mockup */}
              <div className="md:col-span-6 flex justify-center">
                <div className="w-full max-w-[270px] rounded-[36px] bg-[#020617] border-4 border-slate-700/80 p-2.5 shadow-2xl shadow-blue-900/40 relative">
                  <div className="w-24 h-4 bg-slate-800 rounded-full mx-auto mb-2" />

                  <div className="rounded-[24px] bg-[#0b141a] overflow-hidden text-xs min-h-[360px] flex flex-col justify-between border border-white/5">
                    <div className="bg-[#1f2c34] p-3 flex items-center gap-2 text-white">
                      <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-[10px]">
                        M
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-[11px] leading-none flex items-center gap-1">
                          <span>Madhura Store</span>
                          <CheckCircle2 size={10} className="text-emerald-400" />
                        </div>
                        <span className="text-[9px] text-emerald-400">Official Business Account</span>
                      </div>
                    </div>

                    <div className="p-3 space-y-2">
                      <div className="rounded-2xl bg-[#1f2c34] p-3 text-slate-100 shadow">
                        <p className="font-bold text-emerald-400 text-[11px] mb-1">📦 Order Confirmed!</p>
                        <p className="text-[10px] text-slate-200 leading-normal">
                          Hi Ramesh, your order <strong>#ORD-9842</strong> is confirmed and being packed!
                        </p>
                        <span className="block text-[8px] text-right text-slate-400 mt-1">10:45 AM ✓✓</span>
                      </div>

                      <div className="space-y-1.5 pt-1">
                        <button
                          onClick={() => {
                            playAppSound("click");
                            setPhoneActionFeedback("Tracking details sent to your WhatsApp!");
                          }}
                          className="w-full py-2 bg-[#2a3942] hover:bg-emerald-700/60 text-emerald-400 hover:text-white rounded-xl text-[10px] font-semibold flex items-center justify-center gap-1 border border-emerald-500/20 transition active:scale-95"
                        >
                          <span>Track Order</span>
                          <ExternalLink size={10} />
                        </button>
                        <button
                          onClick={() => {
                            playAppSound("click");
                            setPhoneActionFeedback("Connecting to live support agent...");
                          }}
                          className="w-full py-2 bg-[#2a3942] hover:bg-blue-600 text-blue-300 hover:text-white rounded-xl text-[10px] font-semibold flex items-center justify-center gap-1 border border-blue-500/20 transition active:scale-95"
                        >
                          <span>Chat with Agent</span>
                          <MessageSquare size={10} />
                        </button>
                      </div>

                      {phoneActionFeedback && (
                        <div className="text-center p-1.5 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-[9px] text-emerald-300 animate-fade-in">
                          {phoneActionFeedback}
                        </div>
                      )}
                    </div>

                    <div className="p-2 bg-[#1f2c34] text-[9px] text-slate-500 text-center">
                      🔒 End-to-end encrypted
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────
          SECTION 5: INTEGRATION ECOSYSTEM
          ───────────────────────────────────────────────────────────────────────── */}
      <section id="integrations" className="py-20 bg-[#f8fafc] text-slate-900 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
            <span className="text-xs font-bold tracking-widest text-blue-600 uppercase">
              INTEGRATIONS
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Keep WhatsApp connected to the systems you already use.
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">
              Connect directly with your CRM, payment gateways, and databases without writing custom backend code.
              Bi-directional webhooks and native connectors keep data in sync in real-time.
            </p>
          </div>

          <div className="max-w-4xl mx-auto mb-16 rounded-2xl bg-white border border-slate-200 p-6 sm:p-8 shadow-xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center text-center">
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center mx-auto mb-2 font-bold text-xs">
                  CRM
                </div>
                <h4 className="font-bold text-sm text-slate-900">Your CRM &amp; ERP</h4>
                <p className="text-xs text-slate-500 mt-1">HubSpot • Zoho • Shopify • Salesforce</p>
              </div>

              <div className="p-6 rounded-2xl bg-blue-50/80 border-2 border-blue-500 shadow-lg shadow-blue-500/10 relative">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center mx-auto mb-2 shadow-md">
                  <MessageCircle size={24} />
                </div>
                <h4 className="font-black text-sm text-blue-950">MADHURA WhatsApp CRM</h4>
                <p className="text-[11px] text-blue-700 font-semibold mt-1">Real-time Bi-directional Engine</p>
              </div>

              <div className="p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-2 font-bold text-xs">
                  WA
                </div>
                <h4 className="font-bold text-sm text-slate-900">WhatsApp Network</h4>
                <p className="text-xs text-slate-500 mt-1">Official Cloud API &amp; Web Pairing</p>
              </div>
            </div>
          </div>

          {/* 4 Connectivity Method Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-md hover:shadow-lg transition">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <QrCode size={20} />
                </div>
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  Fast
                </span>
              </div>
              <h4 className="font-bold text-slate-900 text-base mb-1.5">QR Pairing</h4>
              <p className="text-xs text-slate-500 leading-relaxed mb-4">
                Scan via WhatsApp Web on existing mobile numbers for immediate multi-agent operations.
              </p>
              <button
                onClick={handleInstantDemoLogin}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
              >
                <span>LEARN MORE</span>
                <ChevronRight size={14} />
              </button>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-md hover:shadow-lg transition">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Smartphone size={20} />
                </div>
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  Easy
                </span>
              </div>
              <h4 className="font-bold text-slate-900 text-base mb-1.5">Phone Pairing Code</h4>
              <p className="text-xs text-slate-500 leading-relaxed mb-4">
                Headless linking via 8-digit OTP code directly inside WhatsApp mobile application.
              </p>
              <button
                onClick={handleInstantDemoLogin}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
              >
                <span>LEARN MORE</span>
                <ChevronRight size={14} />
              </button>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-md hover:shadow-lg transition">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Zap size={20} />
                </div>
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  Official
                </span>
              </div>
              <h4 className="font-bold text-slate-900 text-base mb-1.5">Meta Cloud API</h4>
              <p className="text-xs text-slate-500 leading-relaxed mb-4">
                Official BSP integration with green badge eligibility, high throughput, and zero ban risk.
              </p>
              <button
                onClick={handleInstantDemoLogin}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
              >
                <span>LEARN MORE</span>
                <ChevronRight size={14} />
              </button>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-md hover:shadow-lg transition">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Terminal size={20} />
                </div>
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  Flexible
                </span>
              </div>
              <h4 className="font-bold text-slate-900 text-base mb-1.5">REST API</h4>
              <p className="text-xs text-slate-500 leading-relaxed mb-4">
                Programmatic webhooks, SDKs, and JSON endpoints to integrate with custom in-house software.
              </p>
              <button
                onClick={handleInstantDemoLogin}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
              >
                <span>LEARN MORE</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────
          SECTION 6: PRE-FOOTER CONVERSION SECTION
          ───────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 bg-gradient-to-b from-[#070b16] via-[#091530] to-[#0a1224] text-white border-t border-white/[0.08] relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-600/15 via-transparent to-transparent pointer-events-none" />
        
        <div className="max-w-5xl mx-auto px-4 text-center space-y-6 relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-400/25 text-blue-300 text-xs font-semibold">
            <Sparkles size={14} className="text-amber-400 animate-pulse" />
            <span>Ready to scale your WhatsApp operations?</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
            Ready to transform your WhatsApp customer engagement?
          </h2>
          
          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Empower your distributed branch network with automated journeys, compliant broadcasts, and shared multi-agent inboxes. Get started in minutes.
          </p>

          <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => {
                playAppSound("click");
                setShowDemoModal(true);
              }}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm sm:text-base px-8 py-4 rounded-full shadow-xl shadow-blue-600/35 transition hover:scale-105 active:scale-95"
            >
              <span>Book a Demo</span>
              <ArrowRight size={16} />
            </button>

            <button
              onClick={handleInstantDemoLogin}
              className="inline-flex items-center gap-2 bg-white/[0.08] hover:bg-white/[0.14] text-white font-semibold text-sm sm:text-base px-7 py-4 rounded-full border border-white/20 backdrop-blur-sm transition hover:scale-105 active:scale-95"
            >
              <Zap size={16} className="text-amber-400" />
              <span>Launch Free Workspace</span>
            </button>

            <button
              onClick={() => {
                playAppSound("click");
                window.location.href = "mailto:sales@madhuratech.com?subject=Madhura%20WhatsApp%20Enterprise%20Inquiry";
              }}
              className="inline-flex items-center gap-2 bg-transparent hover:bg-white/[0.05] text-slate-300 hover:text-white font-semibold text-sm sm:text-base px-6 py-4 rounded-full border border-white/10 transition"
            >
              <span>Talk to Sales</span>
            </button>
          </div>

          <div className="pt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <Check size={14} className="text-emerald-400 stroke-[3]" />
              <span>Instant Setup</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check size={14} className="text-emerald-400 stroke-[3]" />
              <span>No Credit Card Required</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check size={14} className="text-emerald-400 stroke-[3]" />
              <span>Official Meta Cloud API</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check size={14} className="text-emerald-400 stroke-[3]" />
              <span>Multi-Tenant Multi-Branch Ready</span>
            </div>
          </div>
        </div>
      </section>

            {/* ─────────────────────────────────────────────────────────────────────────
          SECTION 7: ENTERPRISE FOOTER
          Shared component: the same 9-group IA drives this page and every
          marketing URL. Data lives in marketing/siteNav.js (FOOTER_GROUPS).
          ───────────────────────────────────────────────────────────────────────── */}
      <SiteFooter />

      {/* ─────────────────────────────────────────────────────────────────────────
          MODAL: ADD CONTACT MODAL (FOR SECTION 3 CONTACTS TAB)
          ───────────────────────────────────────────────────────────────────────── */}
      {showAddContactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in text-slate-900">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Users size={16} className="text-blue-600" />
                <span>Add Customer to Directory</span>
              </h3>
              <button
                onClick={() => setShowAddContactModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddContactSubmit} className="pt-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newContactForm.name}
                  onChange={(e) => setNewContactForm({ ...newContactForm, name: e.target.value })}
                  placeholder="e.g. Ramesh Patel"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">WhatsApp Phone *</label>
                <input
                  type="text"
                  required
                  value={newContactForm.phone}
                  onChange={(e) => setNewContactForm({ ...newContactForm, phone: e.target.value })}
                  placeholder="+91 98111 22334"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Company / Organization</label>
                <input
                  type="text"
                  value={newContactForm.company}
                  onChange={(e) => setNewContactForm({ ...newContactForm, company: e.target.value })}
                  placeholder="e.g. TechCorp Solutions"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Branch Scope</label>
                <select
                  value={newContactForm.branch}
                  onChange={(e) => setNewContactForm({ ...newContactForm, branch: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900 focus:outline-none focus:border-blue-500"
                >
                  <option value="Head Office (Main)">Head Office (Main)</option>
                  <option value="Mumbai Metro">Mumbai Metro Branch</option>
                  <option value="Bengaluru South">Bengaluru South Branch</option>
                  <option value="Delhi Central">Delhi Central Branch</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddContactModal(false)}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 text-slate-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-sm"
                >
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────
          MODAL: BOOK A DEMO / INSTANT DEMO WORKSPACE
          ───────────────────────────────────────────────────────────────────────── */}
      {showDemoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-[#0c1427] border border-white/15 p-6 sm:p-8 text-white shadow-2xl relative">
            <button
              onClick={() => {
                setShowDemoModal(false);
                setDemoSubmitted(false);
              }}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
            >
              <X size={18} />
            </button>

            {demoSubmitted ? (
              <div className="text-center py-8 space-y-3">
                <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-2">
                  <CheckCircle2 size={32} />
                </div>
                <h3 className="text-xl font-bold text-white">Demo Request Confirmed!</h3>
                <p className="text-xs text-slate-300 max-w-sm mx-auto">
                  Thank you, {demoForm.name || "Customer"}. We have received your request. Redirecting you to the live interactive demo workspace right now...
                </p>
                <div className="pt-2">
                  <RotateCw size={18} className="animate-spin text-blue-400 mx-auto" />
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-6">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-900/60 text-blue-300 text-[11px] font-semibold mb-2">
                    <Sparkles size={12} className="text-amber-400" />
                    <span>Personalized Walkthrough</span>
                  </div>
                  <h3 className="text-2xl font-bold text-white">Book a 1-on-1 Demo</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    See how Madhura automates customer messaging, multi-branch operations, and campaigns for your industry.
                  </p>
                </div>

                <form onSubmit={handleDemoSubmit} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={demoForm.name}
                      onChange={(e) => setDemoForm({ ...demoForm, name: e.target.value })}
                      placeholder="e.g. Vikramaditya Sharma"
                      className="w-full bg-[#131d38] border border-white/15 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Work Email *</label>
                      <input
                        type="email"
                        required
                        value={demoForm.email}
                        onChange={(e) => setDemoForm({ ...demoForm, email: e.target.value })}
                        placeholder="name@company.com"
                        className="w-full bg-[#131d38] border border-white/15 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">WhatsApp Number *</label>
                      <input
                        type="tel"
                        required
                        value={demoForm.phone}
                        onChange={(e) => setDemoForm({ ...demoForm, phone: e.target.value })}
                        placeholder="+91 98765 43210"
                        className="w-full bg-[#131d38] border border-white/15 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Company Name</label>
                      <input
                        type="text"
                        value={demoForm.company}
                        onChange={(e) => setDemoForm({ ...demoForm, company: e.target.value })}
                        placeholder="e.g. Acme Enterprises"
                        className="w-full bg-[#131d38] border border-white/15 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Team Size</label>
                      <select
                        value={demoForm.teamSize}
                        onChange={(e) => setDemoForm({ ...demoForm, teamSize: e.target.value })}
                        className="w-full bg-[#131d38] border border-white/15 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-blue-500"
                      >
                        <option value="1-10">1-10 team members</option>
                        <option value="11-50">11-50 team members</option>
                        <option value="51-200">51-200 team members</option>
                        <option value="200+">200+ Enterprise</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-col gap-2.5">
                    <button
                      type="submit"
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-600/30 transition text-sm"
                    >
                      Confirm Demo Booking
                    </button>

                    <div className="relative flex py-1 items-center">
                      <div className="flex-grow border-t border-white/10"></div>
                      <span className="flex-shrink mx-3 text-[10px] text-slate-500 uppercase tracking-widest">or</span>
                      <div className="flex-grow border-t border-white/10"></div>
                    </div>

                    <button
                      type="button"
                      onClick={handleInstantDemoLogin}
                      className="w-full bg-white/[0.08] hover:bg-white/[0.14] text-white font-semibold py-2.5 rounded-xl border border-white/15 transition text-xs flex items-center justify-center gap-1.5"
                    >
                      <Sparkles size={13} className="text-amber-400" />
                      <span>Launch Instant Demo Workspace (No waiting)</span>
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
