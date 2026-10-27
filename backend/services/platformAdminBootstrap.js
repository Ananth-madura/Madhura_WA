"use strict";
const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const { createInboxService } = require("./sharedInboxService");
const PREFIX = "platform-internal-";

async function isInternalTenant(tenant, query) {
  if (!tenant?.slug?.startsWith(PREFIX)) return false;
  const [owner] = await query("SELECT u.id FROM organization_memberships m JOIN users u ON u.id=m.user_id WHERE m.tenant_id=? AND m.role='organization_owner' AND m.membership_status='active' AND u.role='platform_admin' AND u.status='active' LIMIT 1", [tenant.id]);
  return Boolean(owner);
}

async function provisionPlatformAdmin(db, { email, password, name = "Madhura Platform Admin", resetPassword = false }) {
  email = String(email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Configure a valid PLATFORM_ADMIN_EMAIL");
  if (password && String(password).length < 12) throw new Error("Platform admin password must contain at least 12 characters");
  if (db.isSqlite) throw new Error("Platform admin provisioning requires MySQL");
  const hash = password ? await bcrypt.hash(String(password), 12) : null;
  const slug = PREFIX + crypto.createHash("sha256").update(email).digest("hex").slice(0, 20);
  return createInboxService(db).transaction(async query => {
    const [plan] = await query("SELECT id FROM plans WHERE id='enterprise' AND is_active=1");
    if (!plan) throw new Error("Provisioning requires the enterprise plan catalog");
    let [user] = await query("SELECT id,role,user_password FROM users WHERE email=? FOR UPDATE", [email]);
    if ((!user || user.role !== "platform_admin" || resetPassword) && !hash) throw new Error("PLATFORM_ADMIN_PASSWORD is required to create or promote this account");
    const updatePassword = !user || user.role !== "platform_admin" || resetPassword;
    if (!user) {
      const result = await query("INSERT INTO users (email,first_name,user_password,role,status,whatsapp_access_level,emp_id) VALUES (?,?,?,'platform_admin','active','full',?)", [email, name, hash, `PLATFORM-${crypto.randomBytes(8).toString("hex")}`]);
      user = { id: result.insertId, role: "platform_admin" };
    }
    let [tenant] = await query("SELECT id,owner_user_id FROM tenants WHERE slug=? FOR UPDATE", [slug]);
    if (tenant && Number(tenant.owner_user_id) !== Number(user.id)) throw new Error("The internal organization belongs to a different account");
    if (!tenant) {
      const result = await query("INSERT INTO tenants (name,slug,legal_name,brand_name,owner_user_id,plan,plan_status,pending_plan_id,max_branches,max_seats,max_senders,max_monthly_messages,status) VALUES (?,?,?,?,?,'enterprise','active',NULL,2147483647,2147483647,2147483647,2147483647,'active')", ["Madhura Tech Administration", slug, "Madhura Tech", "Madhura Tech", user.id]);
      tenant = { id: result.insertId };
    }
    await query("UPDATE tenants SET plan='enterprise',plan_status='active',pending_plan_id=NULL,max_branches=2147483647,max_seats=2147483647,max_senders=2147483647,max_monthly_messages=2147483647,status='active' WHERE id=?", [tenant.id]);
    await query(`UPDATE users SET role='platform_admin',status='active',whatsapp_access_level='full',tenant_id=?${updatePassword ? ",user_password=?" : ""} WHERE id=?`, [tenant.id, ...(updatePassword ? [hash] : []), user.id]);
    await query("INSERT INTO organization_memberships (tenant_id,user_id,role,membership_status) VALUES (?,?,'organization_owner','active') ON DUPLICATE KEY UPDATE role='organization_owner',membership_status='active'", [tenant.id, user.id]);
    let [branch] = await query("SELECT id FROM branches WHERE tenant_id=? AND code='PLATFORMHQ' LIMIT 1", [tenant.id]);
    if (!branch) {
      const result = await query("INSERT INTO branches (tenant_id,code,name,timezone,manager_id,is_head_office,status) VALUES (?,'PLATFORMHQ','Administration','Asia/Kolkata',?,1,'active')", [tenant.id, user.id]);
      branch = { id: result.insertId };
    }
    await query("INSERT INTO staff_branch_memberships (tenant_id,user_id,branch_id,is_primary) VALUES (?,?,?,1) ON DUPLICATE KEY UPDATE is_primary=1", [tenant.id, user.id, branch.id]);
    for (const creditType of ["ai_credits", "software_actions"]) {
      const reference = `platform-bootstrap:${tenant.id}:${creditType}`;
      await query("INSERT IGNORE INTO wallet_accounts (tenant_id,currency,credit_type,balance,reserved_balance) VALUES (?,'INR',?,0,0)", [tenant.id, creditType]);
      const [account] = await query("SELECT id,balance FROM wallet_accounts WHERE tenant_id=? AND credit_type=? FOR UPDATE", [tenant.id, creditType]);
      const [credited] = await query("SELECT id FROM wallet_entries WHERE tenant_id=? AND reference_id=? LIMIT 1", [tenant.id, reference]);
      if (!credited) {
        const grant = 1000000, balance = Number(account.balance) + grant;
        await query("UPDATE wallet_accounts SET balance=? WHERE id=?", [balance, account.id]);
        await query("INSERT INTO wallet_entries (tenant_id,account_id,entry_type,amount,balance_after,reason,reference_id) VALUES (?,?,'credit',?,?,'Internal platform account allocation',?)", [tenant.id, account.id, grant, balance, reference]);
      }
    }
    return { userId: user.id, tenantId: tenant.id, branchId: branch.id };
  });
}

async function provisionConfiguredAdmin(db, env = process.env) {
  if (!env.PLATFORM_ADMIN_EMAIL && !env.PLATFORM_ADMIN_PASSWORD) return null;
  return provisionPlatformAdmin(db, { email: env.PLATFORM_ADMIN_EMAIL, password: env.PLATFORM_ADMIN_PASSWORD });
}
module.exports = { provisionPlatformAdmin, provisionConfiguredAdmin, isInternalTenant };
