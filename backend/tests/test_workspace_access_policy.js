"use strict";

/**
 * Policy coverage for the shared dashboard authorization boundary.
 *
 * These tests pin the rules that keep one dashboard safe for every role:
 * administrators reach everything, members reach the operational plane through
 * module grants, and the WhatsApp session engine stays closed to members except
 * for the two sync actions the contacts workspace needs.
 *
 * The auth and tenant middlewares are stubbed so this runs without a server or
 * a database — the assertions are about the policy, not the plumbing.
 */

const assert = require("node:assert/strict");

function stub(request, exports) {
  const resolved = require.resolve(request);
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
}

stub("../middleware/authMiddleware", { verifyToken: (req, res, next) => next() });
stub("../middleware/tenantMiddleware", { requireTenantContext: (req, res, next) => next() });

let grantRows = [];
const fakeDatabase = {
  query: (sql, params, callback) => callback(null, []),
  promise: () => ({ query: async () => [grantRows] }),
};
stub("../config/database", fakeDatabase);

const guard = require("../middleware/sharedWorkspaceGuard");
const { workspaceModule, MODULES, DEFAULT_EDIT } = require("../middleware/workspaceModule");
const { createEmployeeWorkspace } = require("../services/employeeWorkspace");

/** Runs the guard and reports whether it forwarded or rejected. */
function runGuard({ path, method = "GET", userRole = "agent", role = "employee", tenantId = 1 }) {
  return new Promise((resolve) => {
    const req = { path, method, userRole, tenantId, user: { id: 7, role } };
    const res = {
      statusCode: 200,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; resolve({ passed: false, status: this.statusCode, body, req }); return this; },
    };
    guard(req, res, () => resolve({ passed: true, status: 200, req }));
  });
}

/** Runs a module gate for a member against a canned grant row set. */
async function runModuleGate(module, { method = "GET", options, role = "employee", userRole = "agent", tenantId = 1, userId = 7 } = {}) {
  const req = { method, tenantId, userRole, user: { id: userId, role } };
  const res = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  let forwarded = false;
  await workspaceModule(module, options)(req, res, () => { forwarded = true; });
  return { passed: forwarded, status: res.statusCode, body: res.body };
}

const member = { userRole: "agent", role: "employee" };
const orgAdmin = { userRole: "organization_admin", role: "admin" };

async function main() {
  // ── Session engine is closed to members ───────────────────────────────────
  for (const path of ["/whatsapp", "/whatsapp/qr", "/whatsapp/test-send", "/whatsapp/unread-count", "/whatsapp/logout"]) {
    const result = await runGuard({ path, ...member });
    assert.equal(result.passed, false, `${path} must not be reachable by a member`);
    assert.equal(result.status, 403);
    assert.equal(result.body.code, "ADMIN_ONLY");
  }

  for (const path of ["/whatsapp/chats", "/whatsapp/chat/1/messages", "/whatsapp/unified-status"]) {
    assert.equal((await runGuard({ path, ...member })).passed, true, "Member chat reads reach their ownership checks");
  }

  // ── The contacts workspace keeps its two sync actions ─────────────────────
  for (const path of ["/whatsapp/sync-contacts", "/whatsapp/sync-profile-pics"]) {
    assert.equal((await runGuard({ path, method: "POST", ...member })).passed, true, `${path} stays open to members`);
  }
  assert.equal((await runGuard({ path: "/whatsapp/sync-contacts-admin", method: "POST", ...member })).passed, false, "prefix matching must not leak neighbours");

  // ── Administration surfaces stay administrator-only ───────────────────────
  for (const path of ["/auth/employees", "/teammember", "/v2/branches", "/v2/billing/checkout", "/v2/meta/senders", "/wa/config/user-config", "/wa/ai/settings", "/v2/workspace/permissions/7", "/v2/workspace/audit"]) {
    const result = await runGuard({ path, ...member });
    assert.equal(result.passed, false, `${path} must stay administrator-only`);
    assert.equal(result.status, 403);
  }

  // ── Member operational plane and its own grants endpoint ──────────────────
  for (const path of ["/v2/inbox/conversations", "/v2/workspace/me/permissions", "/wa/templates", "/wa/groups", "/wa/campaigns", "/wa/analytics/dashboard", "/wa/enquiries", "/wa/contacts", "/wa-flows", "/wa/automations"]) {
    assert.equal((await runGuard({ path, ...member })).passed, true, `${path} must reach its module gate`);
  }

  // ── Public and out-of-plane paths stay untouched ──────────────────────────
  assert.equal((await runGuard({ path: "/v2/billing/plans", ...member })).passed, true);
  assert.equal((await runGuard({ path: "/client-portal/admin/settings", ...member })).passed, true);
  assert.equal((await runGuard({ path: "/health", ...member })).passed, true);

  // ── Administrators bypass the whole policy ────────────────────────────────
  for (const path of ["/whatsapp/chats", "/auth/employees", "/v2/branches", "/v2/workspace/permissions/7"]) {
    assert.equal((await runGuard({ path, ...orgAdmin })).passed, true, `${path} must open for an administrator`);
  }
  // ── Membership is the authority, never the JWT role claim ─────────────────
  assert.equal(
    (await runGuard({ path: "/whatsapp/qr", userRole: "agent", role: "subadmin" })).passed,
    false,
    "a stale administrator role claim must not outlive a demotion"
  );
  assert.equal(
    (await runGuard({ path: "/whatsapp/qr", userRole: "agent", role: "admin" })).passed,
    false,
    "a stale admin claim must not outlive a demotion"
  );
  assert.equal(
    (await runGuard({ path: "/whatsapp/chats", userRole: "organization_admin", role: "employee" })).passed,
    true,
    "a freshly promoted administrator works before their token refreshes"
  );

  // ── A sub-admin is an administrator for routing, never for role changes ───
  const subAdmin = await runGuard({ path: "/whatsapp/chats", userRole: "organization_admin", role: "subadmin" });
  assert.equal(subAdmin.passed, true, "a sub-admin reaches the shared dashboard");
  assert.equal(subAdmin.req.user.role, "subadmin", "the guard keeps the sub-admin distinction for downstream checks");
  assert.equal(subAdmin.req.actorRole, "subadmin");

  const promoted = await runGuard({ path: "/whatsapp/chats", userRole: "organization_admin", role: "employee" });
  assert.equal(promoted.passed, true);
  assert.equal(promoted.req.user.role, "admin", "a membership administrator is normalized to admin even with a stale member claim");

  const demoted = await runGuard({ path: "/whatsapp/qr", userRole: "agent", role: "subadmin" });
  assert.equal(demoted.passed, false, "a demoted sub-admin does not keep administrative routing");
  assert.equal(demoted.req.user.role, "employee", "a stale administrative claim is rewritten before any handler reads it");
  assert.equal(demoted.req.actorRole, "employee");

  // A genuine member is canonicalized to `employee` so route-level checks that
  // look for `role === "employee"` behave the same for both legacy aliases.
  const memberRequest = await runGuard({ path: "/wa/templates", userRole: "agent", role: "agent" });
  assert.equal(memberRequest.passed, true);
  assert.equal(memberRequest.req.user.role, "employee", "the legacy agent alias resolves to employee");
  assert.equal(memberRequest.req.actorRole, "employee");

  // ── Module gate: administrators bypass grants, stale claims do not ────────
  grantRows = [];
  assert.equal(
    (await runModuleGate("campaigns", { method: "POST", ...orgAdmin })).passed,
    true,
    "an organization administrator bypasses module grants"
  );
  assert.equal(
    (await runModuleGate("campaigns", { method: "POST", userRole: "organization_admin", role: "subadmin" })).passed,
    true,
    "a sub-admin bypasses module grants"
  );
  assert.equal(
    (await runModuleGate("campaigns", { method: "POST", userRole: "agent", role: "admin" })).passed,
    false,
    "a stale administrator claim alone does not bypass grants"
  );

  // ── Module gate: default grants mirror the backend service ────────────────
  assert.equal(MODULES.length, 16, "the catalog is one list, not a copy");
  assert.ok(DEFAULT_EDIT.has("customers") && !DEFAULT_EDIT.has("campaigns"));

  grantRows = [];
  assert.equal((await runModuleGate("campaigns")).passed, true, "no row means view access");
  assert.equal((await runModuleGate("campaigns", { method: "POST" })).passed, false, "no row means no edit on operational modules");
  assert.equal((await runModuleGate("campaigns", { method: "POST" })).body.code, "MODULE_FORBIDDEN");
  assert.equal((await runModuleGate("customers", { method: "POST" })).passed, true, "legacy customer modules stay editable by default");

  // ── Module gate: saved grants win over defaults ───────────────────────────
  grantRows = [{ can_view: 0, can_edit: 1 }];
  assert.equal((await runModuleGate("contacts")).passed, false, "view 0 blocks reads regardless of edit");

  grantRows = [{ can_view: 1, can_edit: 0 }];
  assert.equal((await runModuleGate("contacts")).passed, true);
  assert.equal((await runModuleGate("contacts", { method: "POST" })).passed, false, "view-only must not write");

  grantRows = [{ can_view: 1, can_edit: 1 }];
  assert.equal((await runModuleGate("contacts", { method: "POST" })).passed, true);

  // ── Module gate: analytics is a read-only surface ─────────────────────────
  grantRows = [{ can_view: 1, can_edit: 0 }];
  assert.equal((await runModuleGate("analytics", { method: "POST", options: { level: "view" } })).passed, true);

  // ── Module gate: unknown modules and missing tenancy fail closed ──────────
  assert.throws(() => workspaceModule("nope"), /Unknown workspace module/);
  const noTenant = await runModuleGate("campaigns", { tenantId: null });
  assert.equal(noTenant.passed, false);
  assert.equal(noTenant.body.code, "TENANT_REQUIRED");

  // ── Resolved grants for the rail match the gate ───────────────────────────
  const workspace = createEmployeeWorkspace(fakeDatabase);
  grantRows = [{ module: "contacts", can_view: 1, can_edit: 0 }];
  const memberGrants = await workspace.permissionsFor({ tenantId: 1, userRole: "agent", user: { id: 7, role: "employee" } });
  assert.equal(Object.keys(memberGrants).length, MODULES.length);
  assert.deepEqual(memberGrants.contacts, { view: true, edit: false });
  assert.deepEqual(memberGrants.campaigns, { view: true, edit: false }, "ungranted operational modules default to read-only");
  assert.deepEqual(memberGrants.customers, { view: true, edit: true }, "ungranted customer modules keep edit");

  const adminGrants = await workspace.permissionsFor({ tenantId: 1, userRole: "organization_admin", user: { id: 1, role: "admin" } });
  assert.ok(Object.values(adminGrants).every((grant) => grant.view && grant.edit));

  console.log("PASS: shared workspace policy — engine stays admin-only, member plane gated by module grants, defaults match the service, administrators bypass.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
