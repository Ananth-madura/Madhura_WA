/**
 * seed-master-admin.js
 *
 * Injects and guarantees the master administrator account in the local database:
 * - Email: admin@madhuratech.com
 * - Password: Admin@123
 * - Role: admin (Full system administrator)
 * - Organization: Madhura Primary Organization (Tenant 1)
 * - Membership: organization_owner (active)
 * - Branch: Head Office Main (Branch 1) - primary
 * - Plan: Enterprise (Unlimited / Premium Grade)
 * - 2FA: Disabled (Direct instant login without OTP requirement)
 * - Wallets: Generous premium credits for AI and software automations
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const bcrypt = require("bcryptjs");
const db = require("../config/database");

async function injectMasterAdmin() {
  console.log("==================================================");
  console.log("   Madhura WhatsApp CRM — Master Admin Seeder    ");
  console.log("==================================================");

  // Wait for database pool / sqlite adapter readiness
  await db.ready;

  const email = (process.env.ADMIN_SEED_EMAIL || "admin@madhuratech.com").trim().toLowerCase();
  const rawPassword = process.env.ADMIN_SEED_PASSWORD || "Admin@123";
  const firstName = "Admin";
  const lastName = "Madhura";
  const empId = "ADMIN001";
  const tenantId = 1;
  const branchId = 1;

  console.log(`[1/7] Hashing password for '${email}'...`);
  const passwordHash = await bcrypt.hash(rawPassword, 10);

  // 1. Ensure or Update User in `users`
  console.log(`[2/7] Injecting into 'users' table...`);
  const [existingUser] = await db.promise().query(
    "SELECT id, email, role, status FROM users WHERE email = ? LIMIT 1",
    [email]
  );

  let userId;
  if (existingUser && existingUser.length > 0) {
    userId = existingUser[0].id;
    await db.promise().query(
      `UPDATE users SET
        first_name = ?,
        last_name = ?,
        emp_id = ?,
        user_password = ?,
        role = 'admin',
        status = 'active',
        two_factor_enabled = 0,
        tenant_id = ?,
        whatsapp_access_level = 'full',
        department = 'Management'
      WHERE id = ?`,
      [firstName, lastName, empId, passwordHash, tenantId, userId]
    );
    console.log(`  [OK] Updated existing admin user (ID: ${userId}) with fresh hash & full access.`);
  } else {
    const [result] = await db.promise().query(
      `INSERT INTO users (
        first_name, last_name, emp_id, email, user_password,
        role, status, two_factor_enabled, tenant_id, whatsapp_access_level, department
      ) VALUES (?, ?, ?, ?, ?, 'admin', 'active', 0, ?, 'full', 'Management')`,
      [firstName, lastName, empId, email, passwordHash, tenantId]
    );
    userId = result.insertId;
    console.log(`  [OK] Created new admin user (ID: ${userId}).`);
  }

  // 2. Ensure or Update Teammember Record
  console.log(`[3/7] Syncing 'teammember' employee profile...`);
  const [existingTeam] = await db.promise().query(
    "SELECT id FROM teammember WHERE emp_email = ? OR user_id = ? LIMIT 1",
    [email, userId]
  );

  if (existingTeam && existingTeam.length > 0) {
    await db.promise().query(
      `UPDATE teammember SET
        first_name = ?,
        last_name = ?,
        emp_id = ?,
        emp_email = ?,
        job_title = 'Master Administrator',
        emp_role = 'Manager',
        user_id = ?,
        tenant_id = ?,
        branch_id = ?,
        whatsapp_access_level = 'full'
      WHERE id = ?`,
      [firstName, lastName, empId, email, userId, tenantId, branchId, existingTeam[0].id]
    );
    console.log(`  [OK] Updated teammember record (ID: ${existingTeam[0].id}).`);
  } else {
    await db.promise().query(
      `INSERT INTO teammember (
        first_name, last_name, emp_id, emp_email, mobile,
        job_title, emp_role, quotation_count, user_id, tenant_id, branch_id, whatsapp_access_level
      ) VALUES (?, ?, ?, ?, '', 'Master Administrator', 'Manager', 0, ?, ?, ?, 'full')`,
      [firstName, lastName, empId, email, userId, tenantId, branchId]
    );
    console.log(`  [OK] Created teammember record.`);
  }

  // 3. Upgrade Tenant 1 to Enterprise Premium Grade
  console.log(`[4/7] Upgrading Tenant 1 to Enterprise Premium Tier...`);
  await db.promise().query(
    `UPDATE tenants SET
      name = 'Madhura Primary Organization',
      slug = 'madhura-primary',
      legal_name = 'Madhura Technologies Pvt Ltd',
      brand_name = 'Madhura WhatsApp Cloud',
      owner_user_id = ?,
      plan = 'enterprise',
      plan_status = 'active',
      max_branches = 50,
      max_seats = 150,
      max_senders = 50,
      max_monthly_messages = 1000000,
      ai_replies_enabled = 1,
      flows_enabled = 1,
      sender_pools_enabled = 1,
      status = 'active',
      pending_plan_id = NULL
    WHERE id = ?`,
    [userId, tenantId]
  );
  console.log(`  [OK] Tenant 1 upgraded to Enterprise (50 branches, 150 seats, 50 senders, 1M msgs).`);

  // 4. Ensure Organization Membership as 'organization_owner'
  console.log(`[5/7] Granting 'organization_owner' role in organization_memberships...`);
  const [membership] = await db.promise().query(
    "SELECT id FROM organization_memberships WHERE tenant_id = ? AND user_id = ? LIMIT 1",
    [tenantId, userId]
  );

  if (membership && membership.length > 0) {
    await db.promise().query(
      "UPDATE organization_memberships SET role = 'organization_owner', membership_status = 'active' WHERE id = ?",
      [membership[0].id]
    );
    console.log(`  [OK] Updated membership (ID: ${membership[0].id}) to organization_owner.`);
  } else {
    await db.promise().query(
      "INSERT INTO organization_memberships (tenant_id, user_id, role, membership_status) VALUES (?, ?, 'organization_owner', 'active')",
      [tenantId, userId]
    );
    console.log(`  [OK] Created organization_owner membership.`);
  }

  // 5. Ensure Staff Branch Membership in Head Office (Branch 1)
  console.log(`[6/7] Assigning Primary Head Office branch scope...`);
  const [branchMembership] = await db.promise().query(
    "SELECT id FROM staff_branch_memberships WHERE tenant_id = ? AND user_id = ? AND branch_id = ? LIMIT 1",
    [tenantId, userId, branchId]
  );

  if (branchMembership && branchMembership.length > 0) {
    await db.promise().query(
      "UPDATE staff_branch_memberships SET is_primary = 1, is_available = 1, auto_assign_enabled = 1, max_open_chats = 1000, max_open_leads = 1000 WHERE id = ?",
      [branchMembership[0].id]
    );
    console.log(`  [OK] Updated staff branch scope.`);
  } else {
    await db.promise().query(
      `INSERT INTO staff_branch_memberships (
        tenant_id, branch_id, user_id, is_primary, is_available, auto_assign_enabled, max_open_chats, max_open_leads
      ) VALUES (?, ?, ?, 1, 1, 1, 1000, 1000)`,
      [tenantId, branchId, userId]
    );
    console.log(`  [OK] Assigned primary branch scope to Head Office.`);
  }

  // 6. Subscriptions & Wallets
  console.log(`[7/7] Injecting active Enterprise subscription and wallet credits...`);
  const [subs] = await db.promise().query(
    "SELECT id FROM subscriptions WHERE tenant_id = ? LIMIT 1",
    [tenantId]
  );

  const oneYearFromNow = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace("T", " ");
  if (subs && subs.length > 0) {
    await db.promise().query(
      `UPDATE subscriptions SET
        plan_id = 'enterprise',
        provider = 'system',
        provider_sub_id = 'sub_enterprise_master_admin',
        status = 'active',
        current_period_end = ?,
        cancel_at_period_end = 0
      WHERE id = ?`,
      [oneYearFromNow, subs[0].id]
    );
    console.log(`  [OK] Subscription updated to Enterprise active.`);
  } else {
    await db.promise().query(
      `INSERT INTO subscriptions (
        tenant_id, plan_id, provider, provider_sub_id, status, current_period_end, cancel_at_period_end
      ) VALUES (?, 'enterprise', 'system', 'sub_enterprise_master_admin', 'active', ?, 0)`,
      [tenantId, oneYearFromNow]
    );
    console.log(`  [OK] Subscription created as Enterprise active.`);
  }

  // Wallets: AI Credits & Software Actions
  const creditTypes = ["ai_credits", "software_actions", "message_credits"];
  for (const cType of creditTypes) {
    try {
      const [wallet] = await db.promise().query(
        "SELECT id FROM wallet_accounts WHERE tenant_id = ? AND credit_type = ? LIMIT 1",
        [tenantId, cType]
      );
      if (wallet && wallet.length > 0) {
        await db.promise().query(
          "UPDATE wallet_accounts SET balance = 50000, reserved_balance = 0 WHERE id = ?",
          [wallet[0].id]
        );
      } else {
        await db.promise().query(
          "INSERT INTO wallet_accounts (tenant_id, currency, credit_type, balance, reserved_balance) VALUES (?, 'INR', ?, 50000, 0)",
          [tenantId, cType]
        );
      }
      console.log(`  [OK] Wallet '${cType}' loaded with 50,000 balance.`);
    } catch (wErr) {
      // credit_type or currency may differ slightly across engines
      console.log(`  [Notice] Wallet '${cType}' note:`, wErr.message);
    }
  }

  console.log("==================================================");
  console.log("✅ Master Admin Account Configured Successfully!");
  console.log(`   Email:    ${email}`);
  console.log(`   Password: ${rawPassword}`);
  console.log(`   Role:     admin (organization_owner)`);
  console.log(`   Plan:     enterprise`);
  console.log(`   2FA:      Disabled (Instant login)`);
  console.log("==================================================");
}

if (require.main === module) {
  injectMasterAdmin()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Failed to inject master admin:", err);
      process.exit(1);
    });
}

module.exports = { injectMasterAdmin };

