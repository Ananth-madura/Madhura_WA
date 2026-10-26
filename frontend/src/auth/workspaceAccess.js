/**
 * Role and module policy for the shared WhatsApp workspace.
 *
 * There is a single dashboard. What changes between people is which rail tabs
 * appear and which routes they may open:
 *
 *   • Administrators (organization owner/admin, platform admin, and delegated
 *     `subadmin` accounts) can open everything.
 *   • Every other member can open the operational workspaces, minus the
 *     administration surfaces listed in ADMIN_ONLY_PATHS, and minus any module
 *     their administrator has not granted.
 */

export const WORKSPACE_ADMIN_ORG_ROLES = ["organization_owner", "organization_admin"];
export const WORKSPACE_ADMIN_GLOBAL_ROLES = ["platform_admin", "admin", "subadmin"];

/** Administration surfaces that stay with administrators in every case. */
export const ADMIN_ONLY_PATHS = [
  "/whatsapp/employees",
  "/whatsapp/accounts",
  "/whatsapp/branches",
  "/whatsapp/billing",
];

export const MODULE_LABELS = {
  customers: "Customers",
  tasks: "Tasks",
  leads: "Leads",
  deals: "Deals",
  activities: "Activities",
  transfers: "Transfers",
  exports: "Customer export",
  contacts: "Contacts",
  enquiries: "Enquiries",
  templates: "Templates",
  groups: "Groups",
  campaigns: "Campaigns",
  automations: "Automations",
  flows: "Chatbot flows",
  analytics: "Analytics",
  client_portal: "Client portal",
};

export const CUSTOMER_MODULES = [
  "customers",
  "tasks",
  "leads",
  "deals",
  "activities",
  "transfers",
  "exports",
];

export const WHATSAPP_MODULES = [
  "contacts",
  "enquiries",
  "templates",
  "groups",
  "campaigns",
  "automations",
  "flows",
  "analytics",
  "client_portal",
];

export function isWorkspaceAdmin({ demoMode, isOwnerOrAdmin, orgRole, globalRole } = {}) {
  return (
    Boolean(demoMode) ||
    Boolean(isOwnerOrAdmin) ||
    WORKSPACE_ADMIN_ORG_ROLES.includes(orgRole) ||
    WORKSPACE_ADMIN_GLOBAL_ROLES.includes(globalRole)
  );
}

export function normalizeWorkspacePath(pathname) {
  const value = String(pathname || "/whatsapp");
  return value.length > 1 ? value.replace(/\/+$/, "") : value;
}

export function canOpenWorkspacePath(pathname, admin) {
  if (admin) return true;
  const path = normalizeWorkspacePath(pathname);
  return !ADMIN_ONLY_PATHS.some(
    blocked => path === blocked || path.startsWith(`${blocked}/`)
  );
}

/**
 * Route → module map for the shared dashboard. Longest prefixes first so
 * `/whatsapp/workspace/campaigns` is not swallowed by `/whatsapp/workspace`.
 */
const ROUTE_MODULES = [
  ["/whatsapp/workspace/campaigns", "campaigns"],
  ["/whatsapp/workspace", "customers"],
  ["/whatsapp/contacts", "contacts"],
  ["/whatsapp/enquiries", "enquiries"],
  ["/whatsapp/templates", "templates"],
  ["/whatsapp/groups", "groups"],
  ["/whatsapp/campaigns", "campaigns"],
  ["/whatsapp/automations", "automations"],
  ["/whatsapp/flows", "flows"],
  ["/whatsapp/analytics", "analytics"],
  ["/whatsapp/client-portal", "client_portal"],
];

export function workspaceModuleForPath(pathname) {
  const path = normalizeWorkspacePath(pathname);
  const match = ROUTE_MODULES.find(
    ([prefix]) => path === prefix || path.startsWith(`${prefix}/`)
  );
  return match ? match[1] : null;
}

export function moduleLabel(module) {
  return MODULE_LABELS[module] || module;
}
