import { DEMO_CONTACTS, DEMO_CAMPAIGNS, DEMO_TEMPLATES, DEMO_STATUS, DEMO_CHATS, DEMO_MESSAGES_MAP } from "./demoData";
import { MODULE_LABELS } from "./workspaceAccess";

const copy = value => JSON.parse(JSON.stringify(value));
const key = "wa_demo_data_v1";
const permissions = () => Object.fromEntries(Object.keys(MODULE_LABELS).map(module => [module, { view: true, edit: true }]));
export function isDemoPreview() {
  try { return JSON.parse(localStorage.getItem("user") || "null")?.isStrictDemo === true; } catch { return false; }
}
const organization = { id: -1, name: "Madhura Demo Organization", slug: "demo", plan: "enterprise", plan_status: "active", status: "active", max_branches: 5, max_seats: 20, max_senders: 5, max_monthly_messages: 10000 };
const headquarters = { id: 1, tenant_id: -1, code: "HQ", name: "Demo Head Office", slug: "head-office", status: "active", is_head_office: 1 };
const sender = { id: 1, tenant_id: -1, status: "connected", display_phone: "+91 98765 43210", verified_name: "Demo business number", is_shared: 1, branch_id: 1 };
function initialState() {
  return { nextId: 100, organizations: [copy(organization)], branches: [copy(headquarters)], contacts: DEMO_CONTACTS.map(row => ({ ...row, tenant_id: -1, branch_id: 1, assigned_agent_id: -2, is_blocked: 0, is_unsubscribed: 0, lifecycle_stage: "lead", source: "demo" })), templates: copy(DEMO_TEMPLATES), campaigns: copy(DEMO_CAMPAIGNS), groups: [], automations: [], flows: [], enquiries: [], tasks: [], leads: [], deals: [], activities: [], transfers: [], notes: [], senders: [copy(sender)], employees: [{ id: -2, user_id: -2, first_name: "Demo Staff", name: "Demo Staff", email: "staff@demo.example", role: "employee", status: "active", branch_id: 1, tenant_id: -1, whatsapp_access_level: "full" }], settings: {} };
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
  return { success: true, user, activeOrganization: state.organizations[0], organizations: state.organizations, activeBranch: branch, branches: state.branches, permittedBranchIds: state.branches.map(row => row.id), roleInActiveOrg: user?.role === "employee" ? "agent" : "organization_owner", actorRole: user?.role || "admin" };
}
function previewError(config, message) {
  return Object.assign(new Error(message), { code: "DEMO_PREVIEW_ONLY", config, response: { status: 409, data: { success: false, message, code: "DEMO_PREVIEW_ONLY" } } });
}
function payload(config) {
  let data = config.data || {};
  if (typeof data === "string") { try { data = JSON.parse(data); } catch { data = {}; } }
  if (typeof FormData !== "undefined" && data instanceof FormData) data = Object.fromEntries([...data.entries()].filter(([, value]) => typeof value === "string"));
  return Object.fromEntries(Object.entries(data).filter(([name]) => !/password|secret|access_token|api_key/i.test(name)));
}

export async function demoAdapter(config) {
  const url = new URL(config.url, config.baseURL || window.location.origin);
  const path = url.pathname.replace(/\/$/, ""), method = (config.method || "get").toLowerCase();
  const state = readDemoState(), body = payload(config), read = ["get", "head", "options"].includes(method);
  const response = data => ({ data: copy(data), status: 200, statusText: "OK", headers: { "content-type": "application/json" }, config });
  if (/\/(checkout|confirm-payment|topup|onboarding\/sessions|onboarding\/complete)$/.test(path)) throw previewError(config, "This is demo mode. Exit demo and create or sign in to your organization to purchase a plan or connect live services.");
  if (path === "/api/v2/me") return response(demoContext(JSON.parse(localStorage.getItem("user") || "null")));
  if (path.endsWith("/me/permissions")) return response({ permissions: permissions() });
  if (path === "/health") return response({ ok: true, sharedInboxReady: true, demo: true });
  if (/\/whatsapp\/(unified-status|status|account)$/.test(path)) return response({ ...DEMO_STATUS, success: true, activeEngine: "Demo preview", cloud: { configured: true }, isCloud: true });
  if (path.endsWith("/unread-count")) return response({ totalUnread: 1, count: 1 });
  if (path.endsWith("/account-balance") || path.endsWith("/contact-balance")) return response({ balance: 0, accounts: [], demo: true });
  if (path.endsWith("/user-config")) return response({ success: true, configured: true, demo: true });
  if (path === "/api/wa/ai/knowledge") return response([]);
  if (path.includes("/billing/")) {
    if (path.endsWith("/plans")) {
      try {
        const result=await fetch(url.href,{credentials:"omit",headers:{Accept:"application/json"},signal:AbortSignal.timeout(10000)});
        const data=await result.json();
        if(result.ok && Array.isArray(data.plans))return response({success:true,plans:data.plans});
      } catch {}
      return response({success:true,plans:[]});
    }
    if (path.endsWith("/gateway")) return response({ success: true, configured: false, checkoutEnabled: false, canManage: false, demo: true });
    if (path.endsWith("/orders")) return response({ success: true, orders: [] });
    return response({ success: true, organization: { ...organization, features: [], pending_plan_id: null, price_inr: 0 }, subscription: { provider: "demo", status: "preview", current_period_end: null }, usage: { branches: { used: state.branches.length, max: 5 }, seats: { used: 2, max: 20 }, senders: { used: 1, max: 5 }, monthly_messages: { used: 0, max: 10000 } }, wallets: {} });
  }
  if (path.includes("/analytics/")) {
    if (path.endsWith("/dashboard")) return response({ totalContacts: state.contacts.length, totalCampaigns: state.campaigns.length, activeCampaigns: state.campaigns.filter(row => row.status === "running").length, totalFlows: state.flows.length, totalAccounts: 1, generatedAt: new Date().toISOString() });
    if (path.endsWith("/logs")) return response({ logs: [], total: 0 });
    if (path.endsWith("/quality-rating")) return response({ quality_rating: "GREEN", demo: true });
    return response([]);
  }
  if (/\/workspace\/analytics$/.test(path)) return response({ customers: state.contacts.length, open_tasks: state.tasks.filter(row => row.status !== "completed").length, leads: state.leads.length, deals: state.deals.length, conversations: state.contacts.length });
  if (path.endsWith("/stats/summary")) return response({ total: state.contacts.length, opted_in: state.contacts.filter(row => row.opt_in_status).length, blocked: state.contacts.filter(row => row.is_blocked).length });
  if (path.endsWith("/enquiries/summary")) return response({ total: state.enquiries.length, new: state.enquiries.length, hot: 0, warm: 0, cold: 0 });
  if (/\/meta\/(senders|numbers)$/.test(path) || path.endsWith("/campaigns/senders")) return response({ success: true, senders: state.senders, numbers: state.senders });
  if (path.endsWith("/routing/employees")) return response({ employees: state.employees });
  if (path.endsWith("/routing/settings")) return response({ strategy: "round_robin", employees: state.employees });
  if (/\/inbox\/conversations/.test(path)) {
    const id = Number(path.match(/conversations\/(\d+)/)?.[1]);
    const contact = state.contacts.find(row => row.id === id) || state.contacts[0];
    const conversation = { id: contact.id, tenant_id: -1, sender_id: 1, contact_id: contact.id, contact_name: contact.name, contact_phone: contact.phone, owner_user_id: -2, branch_id: 1, status: "open", automation_mode: "human", service_window_expires_at: new Date(Date.now() + 86400000).toISOString() };
    if (path.endsWith("/messages")) return response({ messages: DEMO_MESSAGES_MAP[DEMO_CHATS[0].id], nextCursor: null });
    if (path.endsWith("/notes")) {
      if (!read) { state.notes.push({ id: state.nextId++, conversation_id: id, note_text: body.text, author_name: "Demo user" }); save(state); }
      return response({ success: true, notes: state.notes.filter(row => row.conversation_id === id) });
    }
    if (path.endsWith("/contact")) return response({ contact });
    if (path.endsWith("/assignments")) return response({ assignments: [] });
    if (id) return response({ success: true, conversation, message: { id: `demo-${state.nextId++}`, body: body.text, isMe: true, status: "preview" } });
    return response({ success: true, conversations: state.contacts.map(row => ({ ...conversation, id: row.id, contact_id: row.id, contact_name: row.name, contact_phone: row.phone })), nextCursor: null, canManage: true, canSend: true });
  }
  if (/\/workspace\/customers\/(\d+)$/.test(path)) {
    const id = Number(path.split("/").pop());
    return response({ customer: state.contacts.find(row => row.id === id), conversations: [], permissions: permissions(), analytics: {} });
  }
  const nested = path.match(/\/workspace\/customers\/(\d+)\/(tasks|leads|deals|activities|transfers)(?:\/(\d+))?$/);
  if (nested) {
    const [, contactId, collection, recordId] = nested;
    if (!read) {
      if (recordId) state[collection] = state[collection].map(row => row.id === Number(recordId) ? { ...row, ...body } : row);
      else state[collection].push({ id: state.nextId++, contact_id: Number(contactId), status: "open", created_at: new Date().toISOString(), ...body });
      save(state);
    }
    return response({ success: true, records: state[collection].filter(row => row.contact_id === Number(contactId)), nextCursor: null });
  }
  if (path.endsWith("/campaigns/templates")) return response({ templates: state.templates });
  if (path.endsWith("/campaigns/recipients")) return response({ records: state.contacts, nextCursor: null });
  const match = path.match(/\/(contacts|customers|templates|campaigns|groups|automations|flows|wa-flows|branches|organizations|enquiries|employees|teammember|reminders)(?:\/(\d+))?(?:\/([^/]+))?$/);
  if (match) {
    const collection = ({ customers: "contacts", "wa-flows": "flows", teammember: "employees", reminders: "tasks" })[match[1]] || match[1];
    const id = Number(match[2]), action = match[3];
    let rows = state[collection] || [], record = rows.find(row => row.id === id);
    if (path.endsWith("/library")) return response([]);
    if (!read) {
      if (method === "delete") rows = rows.filter(row => row.id !== id);
      else if (record) {
        const status = ({ start: "running", resume: "running", pause: "paused", stop: "cancelled", cancel: "cancelled", publish: "active" })[action];
        Object.assign(record, body, status ? { status } : {}, action === "block" ? { is_blocked: 1 } : action === "unblock" ? { is_blocked: 0 } : {});
      } else { record = { id: state.nextId++, tenant_id: -1, branch_id: 1, status: collection === "campaigns" || collection === "flows" ? "draft" : "active", created_at: new Date().toISOString(), ...body }; rows.push(record); }
      state[collection] = rows; save(state);
    }
    if (id) return response({ ...record, success: true, ...(collection === "campaigns" && path.includes("/workspace/") ? { campaign: record, records: [], summary: {}, nextCursor: null, canEdit: true } : {}) });
    const query = String(config.params?.search || url.searchParams.get("search") || "").toLowerCase();
    const filtered = query ? rows.filter(row => `${row.name} ${row.phone}`.toLowerCase().includes(query)) : rows;
    if (path.includes("/workspace/campaigns")) return response({ records: filtered, nextCursor: null, canEdit: true });
    if (match[1] === "customers") return response({ customers: filtered, nextCursor: null });
    if (collection === "contacts") return response({ ...record, success: true, contacts: filtered, total: filtered.length, totalPages: 1 });
    if (collection === "enquiries") return response({ ...record, success: true, enquiries: filtered, total: filtered.length, totalPages: 1 });
    if (collection === "branches" || collection === "organizations") return response({ ...record, success: true, [collection]: filtered, branch: record, organization: record });
    if (match[1] === "employees") return response({ ...record, success: true, employees: filtered, analytics: {} });
    return response(read ? filtered : { ...record, success: true, message: "Saved in demo mode only." });
  }
  if (!read) { state.settings[path] = body; save(state); return response({ success: true, ...body, message: "Demo change saved in this tab. No live service was contacted." }); }
  if (/\/(stats|settings|summary|config|permissions)$/.test(path)) return response({ success: true, ...state.settings[path], permissions: permissions(), enabled: false });
  if (path.includes("/ai/") || path.includes("/v1/")) return response({ success: true, enabled: false, configured: false, documents: [], logs: [] });
  return response([]);
}
