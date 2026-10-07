/**
 * demoData.js — High-fidelity mock dataset for interactive offline & demo mode.
 * Provides realistic WhatsApp chats, conversations, templates, campaigns, contacts and automations.
 */

export const DEMO_STATUS = {
  connected: true,
  phone: "+91 98765 43210",
  pushname: "Madhura Tech (Demo)",
  platform: "WhatsApp Business API",
  battery: 100,
  plugged: true,
  isBusiness: true,
  demo: true,
  timestamp: Date.now(),
};

export const DEMO_CHATS = [
  {
    id: "919876543211@c.us",
    name: "Rahul Sharma",
    phoneNumber: "+91 98765 43211",
    unreadCount: 1,
    pinned: true,
    labels: ["Lead", "High Priority"],
    timestamp: Math.floor(Date.now() / 1000) - 120, // 2 mins ago
    lastMessage: {
      body: "Could you share the brochure and CRM pricing plans for 20 sales agents?",
      timestamp: Math.floor(Date.now() / 1000) - 120,
      fromMe: false,
      status: "delivered",
    },
    hasMessages: true,
  },
  {
    id: "919876543212@c.us",
    name: "Priya Patel",
    phoneNumber: "+91 98765 43212",
    unreadCount: 0,
    pinned: true,
    labels: ["Customer", "VIP"],
    timestamp: Math.floor(Date.now() / 1000) - 1800, // 30 mins ago
    lastMessage: {
      body: "Payment receipt verified. Thank you for the quick onboarding!",
      timestamp: Math.floor(Date.now() / 1000) - 1800,
      fromMe: true,
      status: "read",
    },
    hasMessages: true,
  },
  {
    id: "919876543213@c.us",
    name: "Vikram Malhotra (Apex Corp)",
    phoneNumber: "+91 98765 43213",
    unreadCount: 2,
    pinned: false,
    labels: ["Meeting Scheduled"],
    timestamp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
    lastMessage: {
      body: "Can we schedule a live integration demo tomorrow at 3 PM IST?",
      timestamp: Math.floor(Date.now() / 1000) - 3600,
      fromMe: false,
      status: "delivered",
    },
    hasMessages: true,
  },
  {
    id: "919876543214@c.us",
    name: "Ananya Sen (Retail Partners)",
    phoneNumber: "+91 98765 43214",
    unreadCount: 0,
    pinned: false,
    labels: ["Qualified", "Campaign Lead"],
    timestamp: Math.floor(Date.now() / 1000) - 14400, // 4 hours ago
    lastMessage: {
      body: "Yes, please add our 5 branch numbers to the broadcast campaign list.",
      timestamp: Math.floor(Date.now() / 1000) - 14400,
      fromMe: false,
      status: "read",
    },
    hasMessages: true,
  },
  {
    id: "919876543215@c.us",
    name: "Suresh Gupta",
    phoneNumber: "+91 98765 43215",
    unreadCount: 0,
    pinned: false,
    labels: ["Support"],
    timestamp: Math.floor(Date.now() / 1000) - 86400, // 1 day ago
    lastMessage: {
      body: "The automated invoice flow worked seamlessly. Thanks team!",
      timestamp: Math.floor(Date.now() / 1000) - 86400,
      fromMe: false,
      status: "read",
    },
    hasMessages: true,
  },
  {
    id: "120363024829384918@g.us",
    name: "Madhura Enterprise Tech Group",
    phoneNumber: "Group",
    isGroup: true,
    unreadCount: 0,
    pinned: false,
    labels: ["Internal"],
    timestamp: Math.floor(Date.now() / 1000) - 172800, // 2 days ago
    lastMessage: {
      body: "Murugan: Latest CRM sweep and WhatsApp worker updates deployed to Render.",
      timestamp: Math.floor(Date.now() / 1000) - 172800,
      fromMe: false,
      status: "read",
    },
    hasMessages: true,
  },
];

export const DEMO_MESSAGES_MAP = {
  "919876543211@c.us": [
    {
      id: "demo_m1",
      from: "919876543211@c.us",
      body: "Hi Madhura Tech team, I came across your WhatsApp CRM solution.",
      timestamp: Math.floor(Date.now() / 1000) - 600,
      isMe: false,
      status: "read",
    },
    {
      id: "demo_m2",
      from: "me",
      body: "Hello Rahul! Thanks for reaching out. We provide multi-agent shared inbox, automated broadcast campaigns, interactive bot flows, and CRM integration.",
      timestamp: Math.floor(Date.now() / 1000) - 480,
      isMe: true,
      status: "read",
    },
    {
      id: "demo_m3",
      from: "919876543211@c.us",
      body: "That sounds perfect. We currently have around 20 agents managing inbound customer chats.",
      timestamp: Math.floor(Date.now() / 1000) - 300,
      isMe: false,
      status: "read",
    },
    {
      id: "demo_m4",
      from: "919876543211@c.us",
      body: "Could you share the brochure and CRM pricing plans for 20 sales agents?",
      timestamp: Math.floor(Date.now() / 1000) - 120,
      isMe: false,
      status: "delivered",
    },
  ],
  "919876543212@c.us": [
    {
      id: "demo_m20",
      from: "919876543212@c.us",
      body: "Hi, I have initiated the annual subscription payment for our workspace.",
      timestamp: Math.floor(Date.now() / 1000) - 7200,
      isMe: false,
      status: "read",
    },
    {
      id: "demo_m21",
      from: "me",
      body: "Payment receipt verified. Thank you for the quick onboarding!",
      timestamp: Math.floor(Date.now() / 1000) - 1800,
      isMe: true,
      status: "read",
    },
  ],
  "919876543213@c.us": [
    {
      id: "demo_m30",
      from: "919876543213@c.us",
      body: "Hello, our team is interested in the automated broadcast campaign feature.",
      timestamp: Math.floor(Date.now() / 1000) - 7200,
      isMe: false,
      status: "read",
    },
    {
      id: "demo_m31",
      from: "919876543213@c.us",
      body: "Can we schedule a live integration demo tomorrow at 3 PM IST?",
      timestamp: Math.floor(Date.now() / 1000) - 3600,
      isMe: false,
      status: "delivered",
    },
  ],
};

export const DEMO_TEMPLATES = [
  {
    id: 1,
    name: "welcome_onboarding_v2",
    category: "MARKETING",
    language: "en",
    status: "APPROVED",
    body: "Hello {{name}}! Welcome to Madhura WhatsApp CRM. Your dedicated account manager is {{manager}}. Reply 1 for support or 2 to view your account dashboard.",
    buttons: '[{"type":"QUICK_REPLY","text":"Chat with Agent"},{"type":"URL","text":"Visit Dashboard","url":"https://madhura-wa.vercel.app"}]',
  },
  {
    id: 2,
    name: "payment_reminder_urgent",
    category: "UTILITY",
    language: "en",
    status: "APPROVED",
    body: "Dear {{name}}, your invoice #{{invoice_id}} for ₹{{amount}} is due on {{due_date}}. You can pay securely using the link below.",
    buttons: '[{"type":"URL","text":"Pay Now","url":"https://crm.madhuratech.com/pay"}]',
  },
  {
    id: 3,
    name: "festival_special_promo",
    category: "MARKETING",
    language: "en",
    status: "APPROVED",
    body: "Special Diwali Offer! Get flat 25% off on all Enterprise CRM modules this week. Use code FESTIVE25 at checkout.",
  },
];

export const DEMO_CAMPAIGNS = [
  {
    id: 1,
    name: "Diwali Enterprise Broadcast 2026",
    status: "completed",
    total_contacts: 1250,
    sent_count: 1250,
    delivered_count: 1228,
    read_count: 1084,
    failed_count: 22,
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: 2,
    name: "Q4 Lead Nurturing Sequence",
    status: "running",
    total_contacts: 450,
    sent_count: 312,
    delivered_count: 308,
    read_count: 265,
    failed_count: 4,
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
];

export const DEMO_CONTACTS = [
  { id: 1, name: "Rahul Sharma", phone: "9876543211", email: "rahul@sharma.in", tags: "Lead, Enterprise", opt_in_status: 1 },
  { id: 2, name: "Priya Patel", phone: "9876543212", email: "priya@patel.com", tags: "Customer, VIP", opt_in_status: 1 },
  { id: 3, name: "Vikram Malhotra", phone: "9876543213", email: "vikram@apex.in", tags: "Prospect", opt_in_status: 1 },
  { id: 4, name: "Ananya Sen", phone: "9876543214", email: "ananya@retail.org", tags: "Partner", opt_in_status: 1 },
  { id: 5, name: "Suresh Gupta", phone: "9876543215", email: "suresh@gupta.biz", tags: "Support", opt_in_status: 1 },
];
