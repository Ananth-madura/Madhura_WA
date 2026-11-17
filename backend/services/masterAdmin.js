"use strict";

/**
 * masterAdmin.js — guaranteed recovery path for the master administrator.
 *
 * The product owner wants one login that always works, in a demo checkout and
 * on a freshly provisioned cloud box:
 *
 *     admin@madhuratech.com / Admin@123
 *
 * A normal login depends on four rows already being present and healthy:
 * the user, the tenant, an active organization membership, and an active
 * branch. On an empty database, or after somebody demoted/deactivated the
 * admin, none of that holds and the credentials are rejected even though they
 * are correct. `ensureMasterAdmin` repairs all four in one pass.
 *
 * Set MASTER_ADMIN_RECOVERY=off to disable the recovery login (for example on
 * a hardened production deployment where the bootstrap account has been
 * replaced). The default is on, matching the zero-config defaults in
 * config/runtimeDefaults.js.
 */

const bcrypt = require("bcryptjs");

const MASTER_ADMIN_EMAIL = "admin@madhuratech.com";
const MASTER_ADMIN_PASSWORD = "Admin@123";
const DISABLED_VALUES = new Set(["0", "false", "no", "off", "disabled"]);

function recoveryEnabled() {
  const flag = String(process.env.MASTER_ADMIN_RECOVERY ?? "").trim().toLowerCase();
  return !DISABLED_VALUES.has(flag);
}

/** True only for the canonical master pair, and only while recovery is on. */
function isMasterCredentials(email, password) {
  if (!recoveryEnabled() || !email || !password) return false;
  return (
    String(email).trim().toLowerCase() === MASTER_ADMIN_EMAIL &&
    String(password) === MASTER_ADMIN_PASSWORD
  );
}

function createQueries(db) {
  return async (sql, params = []) => {
    const [rows] = await db.promise().query(sql, params);
    return rows;
  };
}

async function ensureMasterAdmin(db) {
  const query = createQueries(db);
  const email = MASTER_ADMIN_EMAIL;
  const firstName = "Admin";
  const lastName = "Madhura";
  const empId = "ADMIN001";
  const passwordHash = await bcrypt.hash(MASTER_ADMIN_PASSWORD, 10);

  /* 1. User row — create, or repair role/status/password/tenant. */
  const existing = await query(
    "SELECT id, user_password, tenant_id FROM users WHERE email = ? LIMIT 1",
    [email]
  );

  let userId;
  let tenantId;
  if (existing.length) {
    userId = existing[0].id;
    const currentTenant = Number(existing[0].tenant_id);
    tenantId = Number.isSafeInteger(currentTenant) && currentTenant > 0 ? currentTenant : 1;

    const samePassword =
      existing[0].user_password &&
      (await bcrypt.compare(MASTER_ADMIN_PASSWORD, existing[0].user_password).catch(() => false));

    await query(
      `UPDATE users SET
         first_name = ?,
         last_name = ?,
         user_password = ?,
         role = 'admin',
         status = 'active',
         two_factor_enabled = 0,
         tenant_id = ?,
         whatsapp_access_level = 'full'
       WHERE id = ?`,
      [firstName, lastName, samePassword ? existing[0].user_password : passwordHash, tenantId, userId]
    );
  } else {
    tenantId = 1;
    const result = await query(
      `INSERT INTO users (
         first_name, last_name, emp_id, email, user_password,
         role, status, two_factor_enabled, tenant_id, whatsapp_access_level
       ) VALUES (?, ?, ?, ?, ?, 'admin', 'active', 0, ?, 'full')`,
      [firstName, lastName, empId, email, passwordHash, tenantId]
    );
    userId = result.insertId;
  }

  if (!userId) throw new Error("Master administrator row could not be created");

  /* 2. Tenant — the organization the workspace page needs. */
  const tenants = await query("SELECT id FROM tenants WHERE id = ? LIMIT 1", [tenantId]);
  if (!tenants.length) {
    await query(
      `INSERT INTO tenants (
         id, name, slug, plan, plan_status, max_branches, max_seats,
         max_senders, max_monthly_messages, status
       ) VALUES (?, 'Madhura Primary Organization', 'madhura-primary', 'enterprise', 'active', 50, 150, 50, 1000000, 'active')`,
      [tenantId]
    );
  } else {
    await query("UPDATE tenants SET status = 'active', plan_status = 'active' WHERE id = ?", [tenantId]);
  }

  /* 3. Organization membership — workspaceSession refuses without an active one. */
  const memberships = await query(
    "SELECT id FROM organization_memberships WHERE tenant_id = ? AND user_id = ? LIMIT 1",
    [tenantId, userId]
  );
  if (memberships.length) {
    await query(
      "UPDATE organization_memberships SET role = 'organization_owner', membership_status = 'active' WHERE id = ?",
      [memberships[0].id]
    );
  } else {
    await query(
      "INSERT INTO organization_memberships (tenant_id, user_id, role, membership_status) VALUES (?, ?, 'organization_owner', 'active')",
      [tenantId, userId]
    );
  }

  /* 4. Branch — workspaceSession refuses without an active branch. */
  let branches = await query(
    "SELECT id FROM branches WHERE tenant_id = ? AND status = 'active' ORDER BY is_head_office DESC, id LIMIT 1",
    [tenantId]
  );
  let branchId;
  if (branches.length) {
    branchId = branches[0].id;
  } else {
    const existingBranches = await query(
      "SELECT id FROM branches WHERE tenant_id = ? ORDER BY is_head_office DESC, id LIMIT 1",
      [tenantId]
    );
    if (existingBranches.length) {
      branchId = existingBranches[0].id;
      await query("UPDATE branches SET status = 'active', is_head_office = 1 WHERE id = ?", [branchId]);
    } else {
      const result = await query(
        `INSERT INTO branches (tenant_id, code, name, is_head_office, status, timezone)
         VALUES (?, 'HQ', 'Head Office (Main)', 1, 'active', 'Asia/Kolkata')`,
        [tenantId]
      );
      branchId = result.insertId;
    }
  }

  const branchScopes = await query(
    "SELECT id FROM staff_branch_memberships WHERE tenant_id = ? AND user_id = ? AND branch_id = ? LIMIT 1",
    [tenantId, userId, branchId]
  );
  if (branchScopes.length) {
    await query("UPDATE staff_branch_memberships SET is_primary = 1 WHERE id = ?", [branchScopes[0].id]);
  } else {
    await query(
      "INSERT INTO staff_branch_memberships (tenant_id, branch_id, user_id, is_primary) VALUES (?, ?, ?, 1)",
      [tenantId, branchId, userId]
    );
  }

  /* 5. Employee profile — not required by login, useful everywhere else. */
  try {
    const team = await query(
      "SELECT id FROM teammember WHERE emp_email = ? OR user_id = ? LIMIT 1",
      [email, userId]
    );
    if (team.length) {
      await query(
        `UPDATE teammember SET first_name = ?, last_name = ?, emp_id = ?, emp_email = ?,
           job_title = 'Master Administrator', emp_role = 'Manager', user_id = ?,
           tenant_id = ?, branch_id = ?, whatsapp_access_level = 'full'
         WHERE id = ?`,
        [firstName, lastName, empId, email, userId, tenantId, branchId, team[0].id]
      );
    } else {
      await query(
        `INSERT INTO teammember (
           first_name, last_name, emp_id, emp_email, mobile,
           job_title, emp_role, quotation_count, user_id, tenant_id, branch_id, whatsapp_access_level
         ) VALUES (?, ?, ?, ?, '', 'Master Administrator', 'Manager', 0, ?, ?, ?, 'full')`,
        [firstName, lastName, empId, email, userId, tenantId, branchId]
      );
    }
  } catch (error) {
    console.warn("[master-admin] employee profile sync skipped:", error.message);
  }

  const rows = await query(
    `SELECT id, first_name, last_name, email, role, status, tenant_id, access_code, whatsapp_access_level
       FROM users WHERE id = ? LIMIT 1`,
    [userId]
  );
  return rows[0];
}

module.exports = {
  MASTER_ADMIN_EMAIL,
  MASTER_ADMIN_PASSWORD,
  recoveryEnabled,
  isMasterCredentials,
  ensureMasterAdmin,
};
