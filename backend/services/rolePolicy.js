"use strict";

/**
 * Who may do what to an account.
 *
 * Three roles share one dashboard:
 *
 *   admin    - the organization owner or a full administrator. Manages every
 *              account, including other administrators, and is the only role
 *              that may change a role.
 *   subadmin - a delegated manager. Acts as an administrator for day-to-day
 *              work (people, branches, permissions, the session engine) but
 *              cannot promote anyone, cannot create administrators and cannot
 *              edit, delete or reset a peer/administrator.
 *   employee - a member. Works inside the module grants their administrator
 *              sets; never reaches account management.
 *
 * `agent` is accepted as an alias of `employee` because the branch API and
 * older rows use it. Keeping these rules in one pure module means the routes,
 * the organization service and the tests cannot drift apart.
 */

const ROLE_VALUES = ["admin", "subadmin", "employee", "agent"];

/** Global roles that carry administrative authority for organization work. */
const ADMIN_ROLES = new Set(["admin", "subadmin"]);

/** `organization_owner` is the tenant owner and is never a manageable target. */
const OWNER_MEMBERSHIP = "organization_owner";

/** A sub-admin is stored as an organization administrator server-side. */
function membershipRoleFor(role) {
  return ADMIN_ROLES.has(role) ? "organization_admin" : "agent";
}

function normalizeRole(role) {
  return ROLE_VALUES.includes(role) ? role : "employee";
}

function isAdminRole(role) {
  return ADMIN_ROLES.has(role);
}

function isSubadmin(role) {
  return role === "subadmin";
}

function isOwnerMembership(membershipRole) {
  return membershipRole === OWNER_MEMBERSHIP;
}

/**
 * Resolve the role a request actually carries.
 *
 * Three sources disagree in practice:
 *
 *   globalRole     the JWT claim, valid for up to 14 days
 *   userRole       `users.role`, the account row
 *   membershipRole `organization_memberships.role`, the organization grant
 *
 * The membership is authoritative whenever a row exists, because that is the
 * row an owner edits when promoting or demoting someone. `users.role` only
 * distinguishes a delegated `subadmin` from a full administrator inside an
 * administrative membership. When no membership row exists (legacy accounts and
 * system actors) the account role is used, so old data keeps working.
 *
 * `platform_admin` is never downgraded by an organization row.
 */
function effectiveRole({ globalRole, userRole, membershipRole } = {}) {
  if (globalRole === "platform_admin" || userRole === "platform_admin") return "platform_admin";

  if (membershipRole === undefined || membershipRole === null || membershipRole === "") {
    return userRole === "admin" || userRole === "subadmin" ? userRole : "employee";
  }

  if (isOwnerMembership(membershipRole) || membershipRole === "organization_admin") {
    return userRole === "subadmin" ? "subadmin" : "admin";
  }

  // A membership row that is not administrative wins over a stale admin claim.
  return "employee";
}

/** Only full administrators hand out administrator roles. */
function canCreateRole(actorRole, nextRole) {
  if (!isAdminRole(actorRole)) return false;
  const role = normalizeRole(nextRole);
  if (isSubadmin(actorRole) && isAdminRole(role)) return false;
  return true;
}

/**
 * Can this actor edit the target's record at all?
 *
 * A sub-admin may edit members and their own profile, never a peer
 * administrator and never the tenant owner.
 */
function canManageAccount({ actorRole, actorId, targetId, targetRole, targetMembershipRole } = {}) {
  if (!isAdminRole(actorRole)) return false;
  // Everyone manages their own profile.
  if (Number(actorId) === Number(targetId)) return true;
  if (isOwnerMembership(targetMembershipRole)) return false;
  if (!isSubadmin(actorRole)) return true;
  return !isAdminRole(targetRole);
}

/**
 * Role changes are full-administrator only, never self-service, and never on
 * the tenant owner. This is the single rule `isAdminOnly` protects.
 */
function canChangeRole({ actorRole, actorId, targetId, targetMembershipRole, nextRole } = {}) {
  if (actorRole !== "admin") return false;
  if (!ROLE_VALUES.includes(nextRole)) return false;
  if (isOwnerMembership(targetMembershipRole)) return false;
  if (Number(actorId) === Number(targetId)) return false;
  return true;
}

/**
 * Password resets follow the same shape as editing: a sub-admin cannot reset a
 * peer administrator's password (that would be account takeover), but may
 * reset their own and any member's.
 */
function canResetPassword({ actorRole, actorId, targetId, targetRole, targetMembershipRole } = {}) {
  if (!isAdminRole(actorRole)) return false;
  const self = Number(actorId) === Number(targetId);
  if (isOwnerMembership(targetMembershipRole) && !self) return false;
  if (isSubadmin(actorRole) && !self && isAdminRole(targetRole)) return false;
  return true;
}

/** A sub-admin cannot delete an administrator or the owner. */
function canDeleteAccount({ actorRole, actorId, targetId, targetRole, targetMembershipRole } = {}) {
  if (!isAdminRole(actorRole)) return false;
  if (Number(actorId) === Number(targetId)) return false;
  if (isOwnerMembership(targetMembershipRole)) return false;
  if (isSubadmin(actorRole) && isAdminRole(targetRole)) return false;
  return true;
}

module.exports = {
  ROLE_VALUES,
  ADMIN_ROLES,
  OWNER_MEMBERSHIP,
  normalizeRole,
  membershipRoleFor,
  isAdminRole,
  isSubadmin,
  isOwnerMembership,
  effectiveRole,
  canCreateRole,
  canManageAccount,
  canChangeRole,
  canResetPassword,
  canDeleteAccount,
};
