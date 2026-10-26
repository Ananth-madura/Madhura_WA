"use strict";

/**
 * Account-management rules for the three roles that share the dashboard.
 *
 * These are the checks behind `/auth/create-user`, `/auth/employees/*`,
 * `/auth/change-role`, `/auth/reset-password` and the branch employee API.
 * They live in one pure module so the routes and the tests can never disagree
 * about who may promote, edit, reset or delete whom.
 */

const assert = require("node:assert/strict");
const policy = require("../services/rolePolicy");

const owner = { targetMembershipRole: "organization_owner" };

function main() {
  // ── Role ↔ membership mapping ─────────────────────────────────────────────
  assert.deepEqual(policy.ROLE_VALUES, ["admin", "subadmin", "employee", "agent"]);
  assert.equal(policy.membershipRoleFor("admin"), "organization_admin");
  assert.equal(policy.membershipRoleFor("subadmin"), "organization_admin", "sub-admin is an organization administrator server-side");
  assert.equal(policy.membershipRoleFor("employee"), "agent");
  assert.equal(policy.membershipRoleFor("agent"), "agent");
  assert.equal(policy.normalizeRole("subadmin"), "subadmin");
  assert.equal(policy.normalizeRole("root"), "employee", "unknown roles fall back to the least privileged role");
  assert.equal(policy.isAdminRole("subadmin"), true);
  assert.equal(policy.isAdminRole("employee"), false);
  assert.equal(policy.isSubadmin("subadmin"), true);

  // ── One resolver for the role a request actually carries ──────────────────
  // The membership row wins over a stale JWT claim, because that is the row an
  // owner edits when promoting or demoting someone.
  assert.equal(
    policy.effectiveRole({ globalRole: "admin", userRole: "employee", membershipRole: "agent" }),
    "employee",
    "a demoted administrator loses access before the token expires"
  );
  assert.equal(
    policy.effectiveRole({ globalRole: "employee", userRole: "admin", membershipRole: "organization_admin" }),
    "admin",
    "a promoted administrator works before the token refreshes"
  );
  assert.equal(
    policy.effectiveRole({ globalRole: "admin", userRole: "subadmin", membershipRole: "organization_admin" }),
    "subadmin",
    "users.role distinguishes a delegated sub-admin inside an admin membership"
  );
  assert.equal(
    policy.effectiveRole({ globalRole: "admin", userRole: "admin", membershipRole: "organization_owner" }),
    "admin",
    "the owner resolves to a full administrator"
  );
  assert.equal(
    policy.effectiveRole({ globalRole: "admin", userRole: "subadmin", membershipRole: "organization_owner" }),
    "subadmin",
    "a sub-admin account never silently becomes an owner-level administrator"
  );
  assert.equal(
    policy.effectiveRole({ globalRole: "admin", userRole: "admin", membershipRole: null }),
    "admin",
    "with no membership row the account role is used"
  );
  assert.equal(
    policy.effectiveRole({ globalRole: "agent", userRole: "agent", membershipRole: null }),
    "employee",
    "an account role with no admin bit resolves to a member"
  );
  assert.equal(
    policy.effectiveRole({ globalRole: "platform_admin", userRole: "employee", membershipRole: "agent" }),
    "platform_admin",
    "a platform administrator is never downgraded by an organization row"
  );
  assert.equal(
    policy.effectiveRole({ globalRole: "employee", userRole: "platform_admin", membershipRole: null }),
    "platform_admin",
    "the account row alone is enough to keep platform authority"
  );
  assert.equal(policy.effectiveRole(), "employee", "an empty request resolves to the least privileged role");

  // ── Creation ──────────────────────────────────────────────────────────────
  assert.equal(policy.canCreateRole("admin", "employee"), true);
  assert.equal(policy.canCreateRole("admin", "subadmin"), true);
  assert.equal(policy.canCreateRole("admin", "admin"), true);
  assert.equal(policy.canCreateRole("subadmin", "employee"), true);
  assert.equal(policy.canCreateRole("subadmin", "agent"), true);
  assert.equal(policy.canCreateRole("subadmin", "subadmin"), false, "a sub-admin must not mint a peer");
  assert.equal(policy.canCreateRole("subadmin", "admin"), false, "a sub-admin must not mint an admin");
  assert.equal(policy.canCreateRole("employee", "employee"), false, "members never create accounts");
  assert.equal(policy.canCreateRole("agent", "employee"), false);

  // ── Editing ───────────────────────────────────────────────────────────────
  const adminEditor = { actorRole: "admin", actorId: 1 };
  const subEditor = { actorRole: "subadmin", actorId: 2 };

  assert.equal(policy.canManageAccount({ ...adminEditor, targetId: 3, targetRole: "employee" }), true);
  assert.equal(policy.canManageAccount({ ...adminEditor, targetId: 3, targetRole: "subadmin" }), true);
  assert.equal(policy.canManageAccount({ ...adminEditor, targetId: 3, targetRole: "admin" }), true);
  assert.equal(policy.canManageAccount({ ...adminEditor, targetId: 3, targetRole: "admin", targetMembershipRole: "organization_owner" }), false, "the owner is never a manage target");
  assert.equal(policy.canManageAccount({ ...adminEditor, actorId: 3, targetId: 3, targetMembershipRole: "organization_owner" }), true, "the owner may edit their own profile");

  assert.equal(policy.canManageAccount({ ...subEditor, targetId: 9, targetRole: "employee" }), true, "a sub-admin manages members");
  assert.equal(policy.canManageAccount({ ...subEditor, targetId: 9, targetRole: "agent" }), true);
  assert.equal(policy.canManageAccount({ ...subEditor, targetId: 9, targetRole: "subadmin" }), false, "never a peer sub-admin");
  assert.equal(policy.canManageAccount({ ...subEditor, targetId: 9, targetRole: "admin" }), false, "never an administrator");
  assert.equal(policy.canManageAccount({ ...subEditor, targetId: 9, targetRole: "employee", targetMembershipRole: "organization_owner" }), false, "never the owner");
  assert.equal(policy.canManageAccount({ ...subEditor, targetId: 2, targetRole: "subadmin" }), true, "a sub-admin manages their own profile");
  assert.equal(policy.canManageAccount({ actorRole: "employee", actorId: 5, targetId: 5, targetRole: "employee" }), false, "a member is not an account manager");

  // ── Role changes ──────────────────────────────────────────────────────────
  assert.equal(policy.canChangeRole({ actorRole: "admin", actorId: 1, targetId: 3, nextRole: "employee" }), true);
  assert.equal(policy.canChangeRole({ actorRole: "admin", actorId: 1, targetId: 3, nextRole: "subadmin" }), true);
  assert.equal(policy.canChangeRole({ actorRole: "admin", actorId: 1, targetId: 1, nextRole: "employee" }), false, "no self-demotion");
  assert.equal(policy.canChangeRole({ actorRole: "admin", actorId: 1, targetId: 3, nextRole: "root" }), false, "unknown roles are refused");
  assert.equal(policy.canChangeRole({ actorRole: "admin", actorId: 1, targetId: 3, nextRole: "employee", ...owner }), false, "the owner's role is fixed");
  assert.equal(policy.canChangeRole({ actorRole: "subadmin", actorId: 2, targetId: 9, nextRole: "employee" }), false, "role changes are full-admin only");

  // ── Password resets are account takeover ──────────────────────────────────
  assert.equal(policy.canResetPassword({ actorRole: "admin", actorId: 1, targetId: 3, targetRole: "admin" }), true);
  assert.equal(policy.canResetPassword({ actorRole: "admin", actorId: 1, targetId: 3, targetRole: "admin", ...owner }), false, "nobody resets the owner's password");
  assert.equal(policy.canResetPassword({ actorRole: "admin", actorId: 1, targetId: 1, targetRole: "admin", ...owner }), true, "the owner may reset their own");
  assert.equal(policy.canResetPassword({ actorRole: "subadmin", actorId: 2, targetId: 9, targetRole: "employee" }), true, "a sub-admin resets a member");
  assert.equal(policy.canResetPassword({ actorRole: "subadmin", actorId: 2, targetId: 3, targetRole: "admin" }), false, "a sub-admin must not seize an admin");
  assert.equal(policy.canResetPassword({ actorRole: "subadmin", actorId: 2, targetId: 2, targetRole: "subadmin" }), true, "a sub-admin resets their own");

  // ── Deletion ──────────────────────────────────────────────────────────────
  assert.equal(policy.canDeleteAccount({ actorRole: "admin", actorId: 1, targetId: 3, targetRole: "employee" }), true);
  assert.equal(policy.canDeleteAccount({ actorRole: "admin", actorId: 1, targetId: 1, targetRole: "admin" }), false, "no self-delete");
  assert.equal(policy.canDeleteAccount({ actorRole: "admin", actorId: 1, targetId: 3, targetRole: "admin", ...owner }), false, "the owner is never deleted");
  assert.equal(policy.canDeleteAccount({ actorRole: "subadmin", actorId: 2, targetId: 9, targetRole: "employee" }), true);
  assert.equal(policy.canDeleteAccount({ actorRole: "subadmin", actorId: 2, targetId: 9, targetRole: "admin" }), false, "a sub-admin must not delete an admin");
  assert.equal(policy.canDeleteAccount({ actorRole: "subadmin", actorId: 2, targetId: 2, targetRole: "subadmin" }), false, "not even themselves through the admin path");
  assert.equal(policy.canDeleteAccount({ actorRole: "employee", actorId: 5, targetId: 6, targetRole: "employee" }), false);

  console.log("PASS: role policy — creation, editing, role changes, password resets and deletion stay inside the admin / sub-admin / member boundaries.");
}

main();
