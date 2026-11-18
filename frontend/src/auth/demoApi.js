import { DEMO_CONTACTS, DEMO_CAMPAIGNS, DEMO_TEMPLATES, DEMO_STATUS, DEMO_CHATS, DEMO_MESSAGES_MAP } from "./demoData";
import { MODULE_LABELS } from "./workspaceAccess";

const copy = value => JSON.parse(JSON.stringify(value));
const key = "wa_demo_data_v1";
const permissions = () => Object.fromEntries(Object.keys(MODULE_LABELS).map(module => [module, { view: true, edit: true }]));

export function isDemoPreview() {
  try { return JSON.parse(localStorage.getItem("user") || "null")?.isStrictDemo === true; } catch { return false; }
}

const organization = {
  id: -1,
  name: "Madhura Demo Organization",
  slug: "demo",
  plan: "enterprise",
  plan_status: "active",
  status: "active",
  max_branches: 5,
  max_seats: 20,
  max_senders: 5,
  max_monthly_messages: 10000
};

const headquarters = {
  id: 1,
  tenant_id: -1,
  code: "HQ",
  name: "Demo Head Office",
  slug: "head-office",
  status: "active",
  is_head_office: 1
};

const sender = {
  id: 1,
  tenant_id: -1,
  status: "connected",
  display_phone: "+91 98765 43210",
  phone_number_id: "102938475610293",
  waba_id: "109876543210987",
  verified_name: "Demo business number",
  quality_rating: "GREEN",
  messaging_tier: "TIER_10K",
  is_shared: 1,
  branch_id: 1,
  department_name: "Customer Support",
  is_default: 1
};

const demoAutomations = [
  {
    id: 1,
    name: "Lead Instant Welcome & Brochure",
    event_type: "new_contact",
    trigger_type: "new_contact",
    status: "active",
    execution_count: 142,
    actions_count: 2,
    created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
    description: "Dispatches welcome greeting and interactive brochure when a new contact messages via WhatsApp."
  },
  {
    id: 2,
    name: "Payment Received Confirmation",
    event_type: "payment_received",
    trigger_type: "payment_received",
    status: "active",
    execution_count: 89,
    actions_count: 3,
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    description: "Sends immediate PDF receipt and invoice details via WhatsApp upon verified payment."
  },
  {
    id: 3,
    name: "24h Service Follow-up Reminder",
    event_type: "idle_reminder",
    trigger_type: "idle_reminder",
    status: "active",
    execution_count: 64,
    actions_count: 1,
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    description: "Re-engages leads who showed interest but did not reply within 24 hours."
  }
];

const demoFlows = [
  {
    id: 1,
    name: "Support Triage & Department Routing",
    flow_id: "flow_triage_001",
    status: "active",
    categories: ["Customer Support", "Routing"],
    response_count: 215,
    created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
    preview_url: "https://wa.me",
    screens: [{ id: "CATEGORY", title: "Select Department" }, { id: "DETAILS", title: "Describe Issue" }]
  },
  {
    id: 2,
    name: "VIP Service Appointment Booking",
    flow_id: "flow_booking_002",
    status: "active",
    categories: ["Sales", "Appointments"],
    response_count: 98,
    created_at: new Date(Date.now() - 86400000 * 6).toISOString(),
    screens: [{ id: "DATETIME", title: "Pick Date & Time" }, { id: "BRANCH", title: "Choose Branch" }]
  }
];

const demoEnquiries = [
  {
    id: 1,
    contact_name: "Dr. Suresh Nair",
    phone: "+91 98450 11223",
    type: "enterprise_demo",
    status: "hot",
    message: "Need multi-branch setup for 6 hospital clinics in Bangalore.",
    created_at: new Date(Date.now() - 3600000 * 4).toISOString()
  },
  {
    id: 2,
    contact_name: "Anita Deshmukh",
    phone: "+91 97654 33445",
    type: "pricing_inquiry",
    status: "warm",
    message: "Interested in the Growth plan for 3 retail outlets.",
    created_at: new Date(Date.now() - 3600000 * 12).toISOString()
  }
];

const demoTasks = [
  {
    id: 1,
    title: "Follow up with Dr. Suresh on HIPAA compliance",
    status: "pending",
    priority: "high",
    due_date: new Date(Date.now() + 86400000).toISOString().split("T")[0],
    assigned_to: "Demo Admin",
    contact_name: "Dr. Suresh Nair",
    created_at: new Date().toISOString()
  },
  {
    id: 2,
    title: "Send quotation PDF to Anita Deshmukh",
    status: "completed",
    priority: "normal",
    due_date: new Date().toISOString().split("T")[0],
    assigned_to: "Demo Staff",
    contact_name: "Anita Deshmukh",
    created_at: new Date(Date.now() - 86400000).toISOString()
  }
];

const demoLeads = [
  {
    id: 1,
    name: "Suresh Healthcare 6-Branch CRM",
    contact_name: "Dr. Suresh Nair",
    phone: "+91 98450 11223",
    value: 120000,
    stage: "negotiation",
    status: "active",
    source: "WhatsApp Direct",
    created_at: new Date(Date.now() - 86400000 * 2).toISOString()
  },
  {
    id: 2,
    name: "Anita Retail Hubs Expansion",
    contact_name: "Anita Deshmukh",
    phone: "+91 97654 33445",
    value: 48000,
    stage: "qualified",
    status: "active",
    source: "Website Form",
    created_at: new Date(Date.now() - 86400000 * 4).toISOString()
  }
];

const demoDeals = [
  {
    id: 1,
    title: "Suresh Healthcare Enterprise Annual",
    contact_name: "Dr. Suresh Nair",
    value: 120000,
    currency: "INR",
    stage: "proposal_sent",
    expected_close: new Date(Date.now() + 86400000 * 7).toISOString().split("T")[0],
    created_at: new Date().toISOString()
  }
];

function initialState() {
  return {
    nextId: 100,
    organizations: [copy(organization)],
    branches: [copy(headquarters)],
    contacts: DEMO_CONTACTS.map(row => ({
      ...row,
      tenant_id: -1,
      branch_id: 1,
      assigned_agent_id: -2,
      is_blocked: 0,
      is_unsubscribed: 0,
      lifecycle_stage: "lead",
      source: "demo"
    })),
    templates: copy(DEMO_TEMPLATES),
    campaigns: copy(DEMO_CAMPAIGNS),
    groups: [],
    automations: copy(demoAutomations),
    flows: copy(demoFlows),
    enquiries: copy(demoEnquiries),
    tasks: copy(demoTasks),
    leads: copy(demoLeads),
    deals: copy(demoDeals),
    activities: [],
    transfers: [],
    notes: [],
    senders: [copy(sender)],
    employees: [
      {
        id: -2,
        user_id: -2,
        first_name: "Demo Staff",
        name: "Demo Staff",
        email: "staff@demo.example",
        role: "employee",
        status: "active",
        branch_id: 1,
        tenant_id: -1,
        whatsapp_access_level: "full"
      }
    ],
    settings: {}
  };
}

export function readDemoState() {
  try { return JSON.parse(sessionStorage.getItem(key)) || initialState(); } catch { return initialState(); }
}

function save(state) { sessionStorage.setItem(key, JSON.stringify(state)); }
export function resetDemoData() { sessionStorage.removeItem(key); }
export function getDemoRecords(collection) { return copy(readDemoState()[collection] || []); }

export function demoContext(user) {
  const state = readDemoState();
  const branch = state.branches.find(row => String(row.id) === localStorage.getItem("active_branch_id")) || state.branches[0];
  return {
    success: true,
    user,
    activeOrganization: state.organizations[0],
    organizations: state.organizations,
    activeBranch: branch,
    branches: state.branches,
    permittedBranchIds: state.branches.map(row => row.id),
    roleInActiveOrg: user?.role === "employee" ? "agent" : "organization_owner",
    actorRole: user?.role || "admin"
  };
}

function previewError(config, message) {
  return Object.assign(new Error(message), {
    code: "DEMO_PREVIEW_ONLY",
    config,
    response: { status: 409, data: { success: false, message, code: "DEMO_PREVIEW_ONLY" } }
  });
}

function payload(config) {
  let data = config.data || {};
  if (typeof data === "string") { try { data = JSON.parse(data); } catch { data = {}; } }
  if (typeof FormData !== "undefined" && data instanceof FormData) {
    data = Object.fromEntries([...data.entries()].filter(([, value]) => typeof value === "string"));
  }
  return Object.fromEntries(Object.entries(data).filter(([name]) => !/password|secret|access_token|api_key/i.test(name)));
}

export async function demoAdapter(config) {
  const url = new URL(config.url, config.baseURL || window.location.origin);
  const path = url.pathname.replace(/\/$/, "");
  const method = (config.method || "get").toLowerCase();
  const state = readDemoState();
  const body = payload(config);
  const read = ["get", "head", "options"].includes(method);
  const response = data => ({ data: copy(data), status: 200, statusText: "OK", headers: { "content-type": "application/json" }, config });

  if (/\/(checkout|confirm-payment|topup|onboarding\/sessions|onboarding\/complete)$/.test(path)) {
    throw previewError(config, "This is demo mode. Exit demo and create or sign in to your organization to purchase a plan or connect live services.");
  }
  if (path === "/api/v2/me") return response(demoContext(JSON.parse(localStorage.getItem("user") || "null")));
  if (path.endsWith("/me/permissions")) return response({ permissions: permissions() });
  if (path === "/health") return response({ ok: true, sharedInboxReady: true, demo: true, database: "ready" });
  if (/\/whatsapp\/(unified-status|status|account)$/.test(path)) return response({ ...DEMO_STATUS, success: true, activeEngine: "Demo preview", cloud: { configured: true }, isCloud: true });
  if (path.endsWith("/unread-count")) return response({ totalUnread: 1, count: 1 });
  if (path.endsWith("/account-balance") || path.endsWith("/contact-balance")) return response({ balance: 0, accounts: [], demo: true });
  if (path.endsWith("/user-config")) return response({ success: true, configured: true, demo: true });
  if (path === "/api/wa/ai/knowledge") return response([]);

  // Meta Cloud API & BYO-API Simulation
  if (/\/meta\/setup$/.test(path)) {
    return response({
      success: true,
      configured: true,
      waba_id: "109876543210987",
      phone_number_id: "102938475610293",
      display_phone: "+91 98765 43210",
      verified_name: "Demo business number",
      access_token: "EAAB...demo_token_valid",
      app_secret: "demo_app_secret_verified",
      webhook_url: "https://api.madhuratech.in/webhook",
      verify_token: "madhura_wa_verify_2026",
      quality_rating: "GREEN",
      mode: "byo",
      canSend: true
    });
  }
  if (path.endsWith("/billing/mode")) {
    return response({ success: true, mode: "byo", canSend: true, allowed: true, billing_type: "direct" });
  }
  if (/\/meta\/assets\/discover$/.test(path)) {
    return response({
      success: true,
      portfolios: [{ id: "port_101", name: "Madhura Enterprise Portfolio" }],
      wabas: [
        {
          id: "109876543210987",
          name: "Madhura Primary WABA",
          currency: "INR",
          phoneNumbers: [
            {
              id: "102938475610293",
              displayPhone: "+91 98765 43210",
              verifiedName: "Demo business number",
              quality: "GREEN",
              messagingTier: "TIER_10K",
              codeVerificationStatus: "VERIFIED",
              alreadyConnected: true
            },
            {
              id: "102938475610294",
              displayPhone: "+91 98765 43215",
              verifiedName: "Madhura Support Desk",
              quality: "GREEN",
              messagingTier: "TIER_10K",
              codeVerificationStatus: "VERIFIED",
              alreadyConnected: false
            }
          ]
        }
      ]
    });
  }
  if (/\/meta\/senders\/connect-batch$/.test(path)) {
    const numbers = body.numbers || [];
    numbers.forEach((num) => {
      state.senders.push({
        id: state.nextId++,
        tenant_id: -1,
        branch_id: 1,
        status: "connected",
        display_phone: num.displayPhone || "+91 98765 43215",
        phone_number_id: num.id || num.phoneId || "102938475610294",
        waba_id: body.wabaId || "109876543210987",
        verified_name: num.verifiedName || "Support Desk",
        quality_rating: num.quality || "GREEN",
        is_shared: 1,
        department_name: num.departmentName || "General",
        is_default: 0
      });
    });
    save(state);
    return response({ success: true, totalConnected: numbers.length, senders: state.senders });
  }
  if (/\/meta\/senders\/manual$/.test(path)) {
    const newSender = {
      id: state.nextId++,
      tenant_id: -1,
      branch_id: 1,
      status: "connected",
      display_phone: body.displayPhone || body.phoneNumber || "+91 98765 43216",
      phone_number_id: body.phoneNumberId || "102938475610295",
      waba_id: body.wabaId || "109876543210988",
      verified_name: body.verifiedName || "Custom Meta Sender",
      quality_rating: "GREEN",
      is_shared: body.isShared !== false ? 1 : 0,
      department_name: body.departmentName || "Sales",
      is_default: 0
    };
    state.senders.push(newSender);
    save(state);
    return response({ success: true, sender: newSender });
  }
  if (/\/meta\/senders\/\d+\/ping$/.test(path)) {
    return response({ success: true, latencyMs: 38, quality: "GREEN", status: "connected", verified_name: "Demo business number" });
  }
  if (/\/meta\/senders\/\d+\/test-send$/.test(path)) {
    return response({ success: true, messageId: `wamid.HBgLM${Date.now()}demo`, status: "sent", delivered: true, recipient: body.recipient || body.to || "+919876543210" });
  }
  if (/\/meta\/senders\/\d+\/register$/.test(path)) {
    return response({ success: true, message: "Two-step verification PIN registered with Meta." });
  }
  if (/\/meta\/senders\/\d+\/webhook$/.test(path)) {
    return response({ success: true, callbackUrl: "https://api.madhuratech.in/webhook", verifyToken: "madhura_wa_verify_2026", subscribed: true });
  }

  if (path.includes("/billing/")) {
    if (path.endsWith("/plans")) {
      try {
        const result = await fetch(url.href, { credentials: "omit", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10000) });
        const data = await result.json();
        if (result.ok && Array.isArray(data.plans)) return response({ success: true, plans: data.plans });
      } catch {}
      return response({ success: true, plans: [] });
    }
    if (path.endsWith("/gateway")) return response({ success: true, configured: false, checkoutEnabled: false, canManage: false, demo: true });
    if (path.endsWith("/orders")) return response({ success: true, orders: [] });
    return response({
      success: true,
      organization: { ...organization, features: [], pending_plan_id: null, price_inr: 0 },
      subscription: { provider: "demo", status: "preview", current_period_end: null },
      usage: {
        branches: { used: state.branches.length, max: 5 },
        seats: { used: 2, max: 20 },
        senders: { used: state.senders.length, max: 5 },
        monthly_messages: { used: 142, max: 10000 }
      },
      wallets: {}
    });
  }

  if (path.includes("/analytics/")) {
    if (path.endsWith("/dashboard")) {
      return response({
        totalContacts: state.contacts.length,
        totalCampaigns: state.campaigns.length,
        activeCampaigns: state.campaigns.filter(row => row.status === "running").length,
        totalFlows: state.flows.length,
        totalAccounts: state.senders.length,
        generatedAt: new Date().toISOString()
      });
    }
    if (path.endsWith("/logs")) return response({ logs: [], total: 0 });
    if (path.endsWith("/quality-rating")) return response({ quality_rating: "GREEN", demo: true });
    return response([]);
  }

  if (/\/workspace\/analytics$/.test(path)) {
    return response({
      customers: state.contacts.length,
      open_tasks: state.tasks.filter(row => row.status !== "completed").length,
      leads: state.leads.length,
      deals: state.deals.length,
      conversations: state.contacts.length
    });
  }

  if (path.endsWith("/stats/summary")) {
    return response({
      total: state.contacts.length,
      opted_in: state.contacts.filter(row => row.opt_in_status).length,
      blocked: state.contacts.filter(row => row.is_blocked).length
    });
  }

  if (path.endsWith("/enquiries/summary")) {
    return response({
      total: state.enquiries.length,
      new: state.enquiries.filter(e => e.status === "hot" || e.status === "new").length,
      hot: state.enquiries.filter(e => e.status === "hot").length,
      warm: state.enquiries.filter(e => e.status === "warm").length,
      cold: state.enquiries.filter(e => e.status === "cold").length
    });
  }

  if (/\/meta\/(senders|numbers)$/.test(path) || path.endsWith("/campaigns/senders")) {
    return response({ success: true, senders: state.senders, numbers: state.senders });
  }

  if (path.endsWith("/routing/employees")) return response({ employees: state.employees });
  if (path.endsWith("/routing/settings")) return response({ strategy: "round_robin", employees: state.employees });

  if (/\/inbox\/conversations/.test(path)) {
    const id = Number(path.match(/conversations\/(\d+)/)?.[1]);
    const contact = state.contacts.find(row => row.id === id) || state.contacts[0];
    const conversation = {
      id: contact.id,
      tenant_id: -1,
      sender_id: 1,
      contact_id: contact.id,
      contact_name: contact.name,
      contact_phone: contact.phone,
      owner_user_id: -2,
      branch_id: 1,
      status: "open",
      automation_mode: "human",
      service_window_expires_at: new Date(Date.now() + 86400000).toISOString()
    };
    if (path.endsWith("/messages")) {
      const chatKey = DEMO_CHATS[0]?.id || "demo-chat-1";
      return response({ messages: DEMO_MESSAGES_MAP[chatKey] || [], nextCursor: null });
    }
    if (path.endsWith("/notes")) {
      if (!read) {
        state.notes.push({ id: state.nextId++, conversation_id: id, note_text: body.text, author_name: "Demo user" });
        save(state);
      }
      return response({ success: true, notes: state.notes.filter(row => row.conversation_id === id) });
    }
    if (path.endsWith("/contact")) return response({ contact });
    if (path.endsWith("/assignments")) return response({ assignments: [] });
    if (id) {
      const msg = { id: `demo-${state.nextId++}`, body: body.text, isMe: true, status: "sent", timestamp: Math.floor(Date.now() / 1000) };
      return response({ success: true, conversation, message: msg });
    }
    return response({
      success: true,
      conversations: state.contacts.map(row => ({
        ...conversation,
        id: row.id,
        contact_id: row.id,
        contact_name: row.name,
        contact_phone: row.phone
      })),
      nextCursor: null,
      canManage: true,
      canSend: true
    });
  }

  if (/\/workspace\/customers\/(\d+)$/.test(path)) {
    const id = Number(path.split("/").pop());
    return response({ customer: state.contacts.find(row => row.id === id), conversations: [], permissions: permissions(), analytics: {} });
  }

  const nested = path.match(/\/workspace\/customers\/(\d+)\/(tasks|leads|deals|activities|transfers)(?:\/(\d+))?$/);
  if (nested) {
    const [, contactId, collection, recordId] = nested;
    if (!read) {
      if (recordId) {
        state[collection] = state[collection].map(row => row.id === Number(recordId) ? { ...row, ...body } : row);
      } else {
        state[collection].push({ id: state.nextId++, contact_id: Number(contactId), status: "open", created_at: new Date().toISOString(), ...body });
      }
      save(state);
    }
    return response({ success: true, records: (state[collection] || []).filter(row => row.contact_id === Number(contactId)), nextCursor: null });
  }

  if (path.endsWith("/campaigns/templates")) return response({ templates: state.templates });
  if (path.endsWith("/campaigns/recipients")) return response({ records: state.contacts, nextCursor: null });

  const match = path.match(/\/(contacts|customers|templates|campaigns|groups|automations|flows|wa-flows|branches|organizations|enquiries|employees|teammember|reminders|tasks|leads|deals)(?:\/(\d+))?(?:\/([^/]+))?$/);
  if (match) {
    const collection = ({
      customers: "contacts",
      "wa-flows": "flows",
      teammember: "employees",
      reminders: "tasks"
    })[match[1]] || match[1];

    const id = Number(match[2]), action = match[3];
    let rows = state[collection] || [], record = rows.find(row => row.id === id);

    if (path.endsWith("/library")) return response([]);

    if (!read) {
      if (method === "delete") {
        rows = rows.filter(row => row.id !== id);
      } else if (record) {
        const status = ({
          start: "running",
          resume: "running",
          pause: "paused",
          stop: "cancelled",
          cancel: "cancelled",
          publish: "active"
        })[action];
        Object.assign(record, body, status ? { status } : {}, action === "block" ? { is_blocked: 1 } : action === "unblock" ? { is_blocked: 0 } : {});
      } else {
        record = {
          id: state.nextId++,
          tenant_id: -1,
          branch_id: 1,
          status: collection === "campaigns" || collection === "flows" ? "draft" : "active",
          created_at: new Date().toISOString(),
          ...body
        };
        rows.push(record);
      }
      state[collection] = rows;
      save(state);
    }

    if (id) {
      return response({
        ...record,
        success: true,
        ...(collection === "campaigns" && path.includes("/workspace/")
          ? { campaign: record, records: [], summary: {}, nextCursor: null, canEdit: true }
          : {})
      });
    }

    const query = String(config.params?.search || url.searchParams.get("search") || "").toLowerCase();
    const filtered = query
      ? rows.filter(row => `${row.name || row.title || row.contact_name || ""} ${row.phone || ""}`.toLowerCase().includes(query))
      : rows;

    if (path.includes("/workspace/campaigns")) return response({ records: filtered, nextCursor: null, canEdit: true });
    if (match[1] === "customers") return response({ customers: filtered, nextCursor: null });
    if (collection === "contacts") return response({ ...record, success: true, contacts: filtered, total: filtered.length, totalPages: 1 });
    if (collection === "enquiries") return response({ ...record, success: true, enquiries: filtered, total: filtered.length, totalPages: 1 });
    if (collection === "branches" || collection === "organizations") return response({ ...record, success: true, [collection]: filtered, branch: record, organization: record });
    if (match[1] === "employees") return response({ ...record, success: true, employees: filtered, analytics: {} });
    return response(read ? filtered : { ...record, success: true, message: "Saved in demo mode only." });
  }

  if (!read) {
    state.settings[path] = body;
    save(state);
    return response({ success: true, ...body, message: "Demo change saved in this tab. No live service was contacted." });
  }

  if (/\/(stats|settings|summary|config|permissions)$/.test(path)) {
    return response({ success: true, ...state.settings[path], permissions: permissions(), enabled: false });
  }

  if (path.includes("/ai/") || path.includes("/v1/")) {
    return response({ success: true, enabled: false, configured: false, documents: [], logs: [] });
  }

  return response([]);
}
