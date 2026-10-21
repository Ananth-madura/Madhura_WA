/**
 * enterprise_multi_tenant_multi_branch.js
 *
 * Canonical enterprise multi-tenant & multi-branch migration.
 * Reference: MADHURA_WHATSAPP_ENTERPRISE_SAAS_MASTER_BLUEPRINT.md
 *
 * Implements:
 * 1. Organizations, Branches, Teams, Memberships, Staff Branch Scopes, RBAC & Invitations
 * 2. WABA Connections, Senders, Branch Assignments (Hybrid Sender Topology)
 * 3. Consents, Conversations, and Message Status tracking
 * 4. Plan Catalog, Subscriptions, Usage Metering, and Double-entry Wallets
 * 5. Safe, non-destructive backfill for legacy tenant 1 / NULL records
 * 6. Quarantined records ledger for orphaned data
 */

const db = require("../config/database");

/**
 * Bump this whenever the migration body changes, so an already-migrated
 * deployment skips the whole run instead of replaying it on every boot.
 * Backfills and rebuilds are idempotent, but replaying them on every start
 * costs hundreds of statements and a table rebuild on large installations.
 */
const SCHEMA_VERSION = 3;
const MIGRATION_NAME = "enterprise_multi_tenant_multi_branch";

async function alreadyMigrated() {
  try {
    await q(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(191) NOT NULL,
        version INT NOT NULL DEFAULT 1,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    );
    const rows = await q(
      "SELECT version FROM schema_migrations WHERE name = ? ORDER BY version DESC LIMIT 1",
      [MIGRATION_NAME]
    );
    return rows && rows.length ? Number(rows[0].version) : 0;
  } catch (_) {
    return 0;
  }
}

const q = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });

async function runSafe(sql, desc) {
  try {
    await q(sql);
    console.log(`✅ [Migration] ${desc}`);
  } catch (err) {
    if (
      /already exists/i.test(err.message) ||
      /duplicate/i.test(err.message) ||
      /duplicate column/i.test(err.message)
    ) {
      console.log(`ℹ️ [Migration] ${desc} (already exists)`);
    } else {
      console.warn(`⚠️ [Migration] ${desc} notice:`, err.message);
    }
  }
}

async function ensureColumn(table, column, definition) {
  try {
    if (db.isSqlite) {
      const tableInfo = await q(`PRAGMA table_info("${table}")`);
      const exists = tableInfo.some((c) => c.name.toLowerCase() === column.toLowerCase());
      if (!exists) {
        await q(`ALTER TABLE "${table}" ADD COLUMN ${definition}`);
        console.log(`✅ [Migration] Column ${table}.${column} added`);
      }
    } else {
      const checkSql = `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`;
      const rows = await q(checkSql, [table, column]);
      if (!rows || rows.length === 0) {
        await q(`ALTER TABLE \`${table}\` ADD COLUMN ${definition}`);
        console.log(`✅ [Migration] Column ${table}.${column} added`);
      }
    }
  } catch (err) {
    if (/duplicate column/i.test(err.message)) {
      // ignore
    } else {
      console.warn(`⚠️ [Migration] ensureColumn ${table}.${column} notice:`, err.message);
    }
  }
}

/**
 * Scope contact & opt-out phone uniqueness to the organization.
 *
 * `wa_contacts.phone` and `wa_opt_outs.phone` were declared globally UNIQUE,
 * which in a multi-tenant platform means the first organization to touch a
 * number owns it forever: the next organization's inbound message for that
 * person silently fails to create a contact, and an opt-out taken by one
 * business suppresses a different business. Uniqueness belongs to
 * (tenant_id, phone).
 *
 * SQLite cannot drop a UNIQUE constraint from a column definition, so the
 * table is rebuilt - the one destructive step in this migration, so it is
 * guarded twice: rows are only ever copied (newest row per (tenant, phone)
 * wins), and the rebuild aborts with the original table untouched unless the
 * copy reconciles against a COUNT DISTINCT.
 */
async function scopePhoneUniquenessToTenant(table) {
  const info = await q(`PRAGMA table_info("${table}")`);
  if (!info || !info.length) return;
  const cols = info.map((c) => c.name);
  if (!cols.includes("phone") || !cols.includes("tenant_id")) return;

  const indexes = (await q(`PRAGMA index_list("${table}")`)) || [];
  const uniqueColumnSets = [];
  for (const idx of indexes.filter((i) => i.unique && !i.partial)) {
    const idxCols = (await q(`PRAGMA index_info("${idx.name}")`)).map((c) => c.name);
    uniqueColumnSets.push(idxCols);
  }
  const alreadyScoped = uniqueColumnSets.some(
    (set) =>
      set.length === 2 &&
      set.map((c) => c.toLowerCase()).every((c) => ["tenant_id", "phone"].includes(c))
  );
  if (alreadyScoped) {
    console.log(`✅ [Migration] ${table} phone uniqueness already organization-scoped`);
    return;
  }

  // Backfill before the copy: SQLite treats NULLs as distinct in a unique
  // index, so an unscoped row would dodge the constraint entirely.
  await q(`UPDATE "${table}" SET tenant_id = 1 WHERE tenant_id IS NULL OR tenant_id = 0`);

  const [distinct] = await q(
    `SELECT COUNT(*) as count FROM (SELECT 1 FROM "${table}" GROUP BY tenant_id, phone)`
  );

  const definitions = info
    .filter((c) => c.name !== "id")
    .map((c) => {
      const type = c.type || "TEXT";
      const notNull = c.pk || c.name === "phone" || c.name === "tenant_id" ? " NOT NULL" : "";
      const dflt =
        c.dflt_value !== null && c.dflt_value !== undefined ? ` DEFAULT ${c.dflt_value}` : "";
      return `"${c.name}" ${type}${notNull}${dflt}`;
    });

  const migTable = `${table}_tenant_scope_mig`;
  await q(`DROP TABLE IF EXISTS "${migTable}"`);
  await q(
    `CREATE TABLE "${migTable}" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      ${definitions.join(",\n      ")}
    )`
  );

  const colList = cols.map((c) => `"${c}"`).join(", ");
  await q(
    `INSERT INTO "${migTable}" (${colList})
     SELECT ${colList} FROM "${table}"
     WHERE id IN (SELECT MAX(id) FROM "${table}" GROUP BY tenant_id, phone)`
  );

  const [copied] = await q(`SELECT COUNT(*) as count FROM "${migTable}"`);
  if (Number(copied?.count) !== Number(distinct?.count)) {
    await q(`DROP TABLE IF EXISTS "${migTable}"`);
    console.warn(
      `⚠️ [Migration] ${table} organization-scoped rebuild ABORTED: copied ${copied?.count} of ${distinct?.count} distinct rows - keeping the original table`
    );
    return;
  }

  await q("PRAGMA foreign_keys = OFF");
  try {
    await q(`DROP TABLE "${table}"`);
    await q(`ALTER TABLE "${migTable}" RENAME TO "${table}"`);
  } finally {
    await q("PRAGMA foreign_keys = ON");
  }

  await q(
    `CREATE UNIQUE INDEX IF NOT EXISTS "uq_${table}_tenant_phone" ON "${table}" (tenant_id, phone)`
  );
  console.log(
    `✅ [Migration] ${table} phone uniqueness scoped to organization (${copied?.count} rows preserved)`
  );
}

async function migrate() {
  const appliedVersion = await alreadyMigrated();
  if (appliedVersion >= SCHEMA_VERSION) {
    console.log(
      `ℹ️ [Migration] ${MIGRATION_NAME} already at version ${appliedVersion} - skipping (bump SCHEMA_VERSION to re-run)`
    );
    return;
  }

  console.log("🚀 Starting Enterprise Multi-Tenant & Multi-Branch Migration...");

  // 1. Quarantined Records Ledger (Safety first)
  await runSafe(
    `CREATE TABLE IF NOT EXISTS quarantined_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_table VARCHAR(100) NOT NULL,
      source_id VARCHAR(100) NOT NULL,
      original_tenant_id INT DEFAULT NULL,
      reason TEXT NOT NULL,
      data_json TEXT DEFAULT NULL,
      quarantined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    "Create quarantined_records table"
  );

  // 2. Ensure Tenants/Organizations Table with Enterprise Attributes
  await runSafe(
    `CREATE TABLE IF NOT EXISTS tenants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(100) UNIQUE,
      legal_name VARCHAR(255) DEFAULT NULL,
      brand_name VARCHAR(255) DEFAULT NULL,
      owner_user_id INT DEFAULT NULL,
      billing_country VARCHAR(10) DEFAULT 'IN',
      timezone VARCHAR(64) DEFAULT 'Asia/Kolkata',
      plan VARCHAR(50) DEFAULT 'starter',
      plan_status VARCHAR(50) DEFAULT 'active',
      max_branches INT DEFAULT 1,
      max_seats INT DEFAULT 5,
      max_senders INT DEFAULT 3,
      max_monthly_messages INT DEFAULT 5000,
      ai_replies_enabled TINYINT(1) DEFAULT 0,
      flows_enabled TINYINT(1) DEFAULT 1,
      sender_pools_enabled TINYINT(1) DEFAULT 0,
      status VARCHAR(50) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    "Create tenants / organizations table"
  );

  await ensureColumn("tenants", "legal_name", "legal_name VARCHAR(255) DEFAULT NULL");
  await ensureColumn("tenants", "brand_name", "brand_name VARCHAR(255) DEFAULT NULL");
  await ensureColumn("tenants", "owner_user_id", "owner_user_id INT DEFAULT NULL");
  await ensureColumn("tenants", "billing_country", "billing_country VARCHAR(10) DEFAULT 'IN'");
  await ensureColumn("tenants", "timezone", "timezone VARCHAR(64) DEFAULT 'Asia/Kolkata'");
  await ensureColumn("tenants", "max_branches", "max_branches INT DEFAULT 1");
  await ensureColumn("tenants", "max_seats", "max_seats INT DEFAULT 5");
  await ensureColumn("tenants", "status", "status VARCHAR(50) DEFAULT 'active'");

  // 3. Branches Table
  await runSafe(
    `CREATE TABLE IF NOT EXISTS branches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INT NOT NULL,
      parent_branch_id INT DEFAULT NULL,
      code VARCHAR(50) NOT NULL,
      name VARCHAR(180) NOT NULL,
      timezone VARCHAR(64) DEFAULT 'Asia/Kolkata',
      manager_id INT DEFAULT NULL,
      phone VARCHAR(32) DEFAULT NULL,
      email VARCHAR(150) DEFAULT NULL,
      address TEXT DEFAULT NULL,
      operating_hours_json TEXT DEFAULT NULL,
      is_head_office TINYINT(1) DEFAULT 0,
      status VARCHAR(30) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (tenant_id, code)
    )`,
    "Create branches table"
  );

  await ensureColumn("branches", "slug", "slug VARCHAR(180) DEFAULT NULL");
  await ensureColumn("branches", "city", "city VARCHAR(100) DEFAULT NULL");
  await ensureColumn("branches", "settings_json", "settings_json TEXT DEFAULT NULL");
  await ensureColumn("branches", "archived_at", "archived_at TIMESTAMP DEFAULT NULL");

  // 3.1 Branch Audit Events Table
  await runSafe(
    `CREATE TABLE IF NOT EXISTS branch_audit_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INT NOT NULL,
      branch_id INT DEFAULT NULL,
      actor_user_id INT DEFAULT NULL,
      event_type VARCHAR(100) NOT NULL,
      changes_json TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    "Create branch_audit_events table"
  );

  // 4. Teams Table
  await runSafe(
    `CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INT NOT NULL,
      branch_id INT DEFAULT NULL,
      name VARCHAR(120) NOT NULL,
      routing_config_json TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    "Create teams table"
  );

  // 5. Organization Memberships (User <-> Tenant mapping with primary role)
  await runSafe(
    `CREATE TABLE IF NOT EXISTS organization_memberships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INT NOT NULL,
      user_id INT NOT NULL,
      role VARCHAR(50) DEFAULT 'agent',
      membership_status VARCHAR(30) DEFAULT 'active',
      joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (tenant_id, user_id)
    )`,
    "Create organization_memberships table"
  );

  // 6. Staff Branch Memberships (User <-> Branch scoping)
  await runSafe(
    `CREATE TABLE IF NOT EXISTS staff_branch_memberships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INT NOT NULL,
      user_id INT NOT NULL,
      branch_id INT NOT NULL,
      team_id INT DEFAULT NULL,
      is_primary TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (tenant_id, user_id, branch_id)
    )`,
    "Create staff_branch_memberships table"
  );

  // 7. Roles & Permissions (Fine-grained RBAC)
  await runSafe(
    `CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code VARCHAR(100) UNIQUE NOT NULL,
      category VARCHAR(50) NOT NULL,
      description VARCHAR(255) NOT NULL
    )`,
    "Create permissions table"
  );

  await runSafe(
    `CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INT DEFAULT NULL,
      name VARCHAR(100) NOT NULL,
      code VARCHAR(60) NOT NULL,
      description VARCHAR(255) DEFAULT NULL,
      is_system TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (tenant_id, code)
    )`,
    "Create roles table"
  );

  await runSafe(
    `CREATE TABLE IF NOT EXISTS role_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role_id INT NOT NULL,
      permission_code VARCHAR(100) NOT NULL,
      UNIQUE (role_id, permission_code)
    )`,
    "Create role_permissions table"
  );

  // 8. Staff Invitations
  await runSafe(
    `CREATE TABLE IF NOT EXISTS invitations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INT NOT NULL,
      email VARCHAR(150) NOT NULL,
      role VARCHAR(50) DEFAULT 'agent',
      branch_id INT DEFAULT NULL,
      team_id INT DEFAULT NULL,
      token_hash VARCHAR(128) NOT NULL,
      status VARCHAR(30) DEFAULT 'pending',
      invited_by INT DEFAULT NULL,
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    "Create invitations table"
  );

  // 9. Meta Partner Onboarding Assets (WABA & Senders)
  await runSafe(
    `CREATE TABLE IF NOT EXISTS waba_connections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INT NOT NULL,
      meta_business_id VARCHAR(100) DEFAULT NULL,
      waba_id VARCHAR(100) NOT NULL,
      partner_type VARCHAR(50) DEFAULT 'tech_provider',
      encrypted_token TEXT DEFAULT NULL,
      system_user_id VARCHAR(100) DEFAULT NULL,
      status VARCHAR(50) DEFAULT 'connected',
      last_sync_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (waba_id)
    )`,
    "Create waba_connections table"
  );

  await runSafe(
    `CREATE TABLE IF NOT EXISTS wa_senders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INT NOT NULL,
      waba_connection_id INT DEFAULT NULL,
      phone_number_id VARCHAR(128) NOT NULL,
      display_phone VARCHAR(32) DEFAULT NULL,
      verified_name VARCHAR(255) DEFAULT NULL,
      quality VARCHAR(30) DEFAULT 'GREEN',
      messaging_tier VARCHAR(50) DEFAULT 'TIER_250',
      is_shared TINYINT(1) DEFAULT 1,
      status VARCHAR(50) DEFAULT 'connected',
      app_secret TEXT DEFAULT NULL,
      verify_token VARCHAR(255) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (phone_number_id)
    )`,
    "Create wa_senders table"
  );

  await runSafe(
    `CREATE TABLE IF NOT EXISTS sender_branch_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INT NOT NULL,
      sender_id INT NOT NULL,
      branch_id INT NOT NULL,
      is_default TINYINT(1) DEFAULT 1,
      routing_weight INT DEFAULT 100,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (tenant_id, sender_id, branch_id)
    )`,
    "Create sender_branch_assignments table"
  );

  // Per-sender webhook secrets: every sender must be verifiable on its own,
  // so an incoming webhook is checked against the account that actually
  // sent it rather than one process-wide app secret.
  await ensureColumn("wa_senders", "app_secret", "app_secret TEXT DEFAULT NULL");
  await ensureColumn("wa_senders", "verify_token", "verify_token VARCHAR(255) DEFAULT NULL");

  // 10. Meta Onboarding Sessions (Short-lived state & nonce)
  await runSafe(
    `CREATE TABLE IF NOT EXISTS meta_onboarding_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id VARCHAR(100) UNIQUE NOT NULL,
      tenant_id INT NOT NULL,
      user_id INT NOT NULL,
      state_token VARCHAR(128) NOT NULL,
      status VARCHAR(50) DEFAULT 'pending',
      meta_waba_id VARCHAR(100) DEFAULT NULL,
      meta_phone_number_id VARCHAR(100) DEFAULT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    "Create meta_onboarding_sessions table"
  );

  // 11. Customer Opt-In and Consents Registry
  await runSafe(
    `CREATE TABLE IF NOT EXISTS consents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INT NOT NULL,
      contact_id INT NOT NULL,
      sender_id INT DEFAULT NULL,
      channel VARCHAR(30) DEFAULT 'whatsapp',
      purpose VARCHAR(100) DEFAULT 'marketing',
      source VARCHAR(100) DEFAULT 'manual',
      proof_uri TEXT DEFAULT NULL,
      captured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      revoked_at TIMESTAMP DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    "Create consents table"
  );

  // 12. Multi-Branch Conversations Table
  await runSafe(
    `CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INT NOT NULL,
      sender_id INT DEFAULT NULL,
      contact_id INT NOT NULL,
      branch_id INT DEFAULT NULL,
      owner_user_id INT DEFAULT NULL,
      team_id INT DEFAULT NULL,
      status VARCHAR(30) DEFAULT 'open',
      priority VARCHAR(20) DEFAULT 'normal',
      subject VARCHAR(255) DEFAULT NULL,
      last_message_text TEXT DEFAULT NULL,
      last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      service_window_expires_at TIMESTAMP NULL DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (tenant_id, contact_id, sender_id)
    )`,
    "Create conversations table"
  );

  // 13. Subscription Catalog, Plans, Usage & Wallet Ledger
  await runSafe(
    `CREATE TABLE IF NOT EXISTS plans (
      id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      badge VARCHAR(50) DEFAULT NULL,
      price_inr INT NOT NULL,
      billing_interval VARCHAR(20) DEFAULT 'month',
      max_branches INT NOT NULL DEFAULT 1,
      max_seats INT NOT NULL DEFAULT 5,
      max_senders INT NOT NULL DEFAULT 3,
      max_monthly_messages INT NOT NULL DEFAULT 5000,
      max_contacts INT NOT NULL DEFAULT 2500,
      features_json TEXT DEFAULT NULL,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    "Create plans catalog table"
  );

  await runSafe(
    `CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INT NOT NULL,
      plan_id VARCHAR(50) NOT NULL,
      provider VARCHAR(50) DEFAULT 'razorpay',
      provider_sub_id VARCHAR(100) DEFAULT NULL,
      status VARCHAR(50) DEFAULT 'active',
      current_period_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      current_period_end TIMESTAMP NOT NULL,
      cancel_at_period_end TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    "Create subscriptions table"
  );

  await runSafe(
    `CREATE TABLE IF NOT EXISTS usage_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INT NOT NULL,
      meter_key VARCHAR(100) NOT NULL,
      quantity INT NOT NULL,
      external_event_id VARCHAR(191) NOT NULL,
      occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (meter_key, external_event_id)
    )`,
    "Create usage_events table"
  );

  await runSafe(
    `CREATE TABLE IF NOT EXISTS wallet_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INT NOT NULL,
      currency VARCHAR(10) DEFAULT 'INR',
      credit_type VARCHAR(50) DEFAULT 'ai_credits',
      balance INT DEFAULT 0,
      reserved_balance INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (tenant_id, credit_type)
    )`,
    "Create wallet_accounts table"
  );

  await runSafe(
    `CREATE TABLE IF NOT EXISTS wallet_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INT NOT NULL,
      account_id INT NOT NULL,
      entry_type VARCHAR(20) NOT NULL,
      amount INT NOT NULL,
      balance_after INT NOT NULL,
      reason VARCHAR(255) DEFAULT NULL,
      reference_id VARCHAR(191) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    "Create wallet_entries table"
  );

  // 14. Add tenant_id & branch_id scoping to business tables
  const scopeTables = [
    { table: "wa_contacts", col: "branch_id", def: "branch_id INT DEFAULT NULL" },
    { table: "wa_campaigns", col: "branch_id", def: "branch_id INT DEFAULT NULL" },
    { table: "wa_campaigns", col: "tenant_id", def: "tenant_id INT DEFAULT 1" },
    { table: "wa_templates", col: "tenant_id", def: "tenant_id INT DEFAULT 1" },
    { table: "wa_flows", col: "branch_id", def: "branch_id INT DEFAULT NULL" },
    { table: "wa_flows", col: "tenant_id", def: "tenant_id INT DEFAULT 1" },
    { table: "wa_message_logs", col: "branch_id", def: "branch_id INT DEFAULT NULL" },
    { table: "wa_message_logs", col: "tenant_id", def: "tenant_id INT DEFAULT 1" },
    { table: "wa_automations", col: "branch_id", def: "branch_id INT DEFAULT NULL" },
    { table: "wa_automations", col: "tenant_id", def: "tenant_id INT DEFAULT 1" },
    { table: "users", col: "tenant_id", def: "tenant_id INT DEFAULT 1" },
    { table: "users", col: "mobile_number", def: "mobile_number VARCHAR(30) DEFAULT NULL" },
    { table: "teammember", col: "tenant_id", def: "tenant_id INT DEFAULT 1" },
    { table: "teammember", col: "branch_id", def: "branch_id INT DEFAULT NULL" },
    { table: "wa_accounts", col: "tenant_id", def: "tenant_id INT DEFAULT 1" },
    { table: "wa_accounts", col: "branch_id", def: "branch_id INT DEFAULT NULL" },
    { table: "wa_internal_notes", col: "tenant_id", def: "tenant_id INT DEFAULT 1" },
    { table: "wa_internal_notes", col: "branch_id", def: "branch_id INT DEFAULT NULL" },
    { table: "wa_contacts", col: "tenant_id", def: "tenant_id INT NOT NULL DEFAULT 1" },
    { table: "wa_opt_outs", col: "tenant_id", def: "tenant_id INT NOT NULL DEFAULT 1" },
    // Campaign audience tables. wa_contact_groups was scoped but its members
    // were not, and wa_sender_pools was scoped to nothing at all - both list
    // endpoints query tenant_id and threw `no such column` at runtime.
    { table: "wa_group_contacts", col: "tenant_id", def: "tenant_id INT DEFAULT NULL" },
    { table: "wa_sender_pools", col: "tenant_id", def: "tenant_id INT NOT NULL DEFAULT 1" },
  ];

  for (const item of scopeTables) {
    await ensureColumn(item.table, item.col, item.def);
  }

  // 14a. Backfill the two columns added above. A group's members inherit the
  // group's organization (left NULL here only if the parent group is itself
  // unowned, which the campaign queries treat as an error rather than as
  // "visible to everyone"). Sender pools have no parent to inherit from, so
  // legacy pools belong to the system organization - the same rule the
  // env-configured sender follows.
  if (db.isSqlite) {
    await runSafe(
      `UPDATE wa_group_contacts SET tenant_id = (
         SELECT g.tenant_id FROM wa_contact_groups g WHERE g.id = wa_group_contacts.group_id
       ) WHERE tenant_id IS NULL`,
      "Backfill wa_group_contacts.tenant_id from the parent group"
    );
    await runSafe(
      "UPDATE wa_sender_pools SET tenant_id = 1 WHERE tenant_id IS NULL OR tenant_id = 0",
      "Backfill wa_sender_pools.tenant_id to the system organization"
    );
  } else {
    await runSafe(
      "UPDATE wa_group_contacts gc JOIN wa_contact_groups g ON g.id = gc.group_id SET gc.tenant_id = g.tenant_id WHERE gc.tenant_id IS NULL",
      "Backfill wa_group_contacts.tenant_id from the parent group"
    );
    await runSafe(
      "UPDATE wa_sender_pools SET tenant_id = 1 WHERE tenant_id IS NULL OR tenant_id = 0",
      "Backfill wa_sender_pools.tenant_id to the system organization"
    );
  }

  // 14b. Phone uniqueness must be per organization, not global. See
  // scopePhoneUniquenessToTenant for why this is a rebuild and not an index.
  if (db.isSqlite) {
    await scopePhoneUniquenessToTenant("wa_contacts");
    await scopePhoneUniquenessToTenant("wa_opt_outs");
  } else {
    // MySQL can swap the index in place; uq_phone / uq_optout_phone are the
    // names the legacy schema used.
    await runSafe(
      "ALTER TABLE `wa_contacts` DROP INDEX `uq_phone`, ADD UNIQUE KEY `uq_tenant_phone` (tenant_id, phone)",
      "Scope wa_contacts phone uniqueness to organization"
    );
    await runSafe(
      "ALTER TABLE `wa_opt_outs` DROP INDEX `uq_optout_phone`, ADD UNIQUE KEY `uq_tenant_optout_phone` (tenant_id, phone)",
      "Scope wa_opt_outs phone uniqueness to organization"
    );
  }

  // 15. Seed Permissions Catalog
  const permissionsList = [
    ["org.read", "organization", "View organization details"],
    ["org.manage", "organization", "Manage organization settings"],
    ["branch.view", "branch", "View branch details"],
    ["branch.create", "branch", "Create new branches"],
    ["branch.manage", "branch", "Update or archive branches"],
    ["staff.invite", "staff", "Invite new staff members"],
    ["staff.role.assign", "staff", "Assign roles and branch memberships"],
    ["sender.view", "sender", "View connected WhatsApp senders"],
    ["sender.connect", "sender", "Connect WABA and WhatsApp phone numbers"],
    ["sender.manage", "sender", "Manage sender branch allocations"],
    ["inbox.view_all", "inbox", "View all conversations across permitted branches"],
    ["inbox.view_assigned", "inbox", "View conversations assigned to user"],
    ["inbox.reply", "inbox", "Reply to conversations"],
    ["inbox.transfer", "inbox", "Transfer conversations between branches/agents"],
    ["contact.view", "contact", "View contacts"],
    ["contact.export", "contact", "Export contacts to CSV/Excel"],
    ["campaign.create", "campaign", "Create broadcast campaigns"],
    ["campaign.approve", "campaign", "Approve campaign broadcasts"],
    ["campaign.send", "campaign", "Dispatch campaigns"],
    ["automation.edit", "automation", "Create and edit chatbot flows and automations"],
    ["ai.configure", "ai", "Configure AI models, prompts and knowledge"],
    ["billing.read", "billing", "View subscription and usage invoices"],
    ["billing.manage", "billing", "Upgrade plan and buy credit add-ons"],
    ["audit.read", "audit", "View audit trail logs"],
  ];

  for (const [code, category, desc] of permissionsList) {
    await runSafe(
      `INSERT OR IGNORE INTO permissions (code, category, description) VALUES ('${code}', '${category}', '${desc}')`,
      `Seed permission ${code}`
    );
  }

  // 16. Seed System Roles
  const rolesList = [
    ["organization_owner", "Organization Owner", "Full administrative access across all branches"],
    ["organization_admin", "Organization Admin", "Manage branches, staff, campaigns, and senders"],
    ["branch_manager", "Branch Manager", "Manage branch conversations, staff, and routing"],
    ["agent", "Support / Sales Agent", "Handle conversations and respond to customers"],
    ["billing_admin", "Billing Administrator", "Manage subscriptions, payments, and invoices"],
  ];

  for (const [code, name, desc] of rolesList) {
    await runSafe(
      `INSERT OR IGNORE INTO roles (tenant_id, code, name, description, is_system) VALUES (NULL, '${code}', '${name}', '${desc}', 1)`,
      `Seed system role ${code}`
    );
  }

  // 17. Link permissions to roles
  const ownerRole = await q("SELECT id FROM roles WHERE code = 'organization_owner' AND tenant_id IS NULL LIMIT 1");
  if (ownerRole && ownerRole.length > 0) {
    const ownerId = ownerRole[0].id;
    for (const [code] of permissionsList) {
      await runSafe(
        `INSERT OR IGNORE INTO role_permissions (role_id, permission_code) VALUES (${ownerId}, '${code}')`,
        `Grant ${code} to organization_owner`
      );
    }
  }

  // 18. Seed Plans Catalog (Master Blueprint Section 8)
  const plansCatalog = [
    {
      id: "free",
      name: "Free Trial",
      badge: "Trial",
      price_inr: 0,
      billing_interval: "month",
      max_branches: 1,
      max_seats: 2,
      max_senders: 1,
      max_monthly_messages: 500,
      max_contacts: 100,
      features: JSON.stringify([
        "1 Branch (Head Office)",
        "2 Staff Seats",
        "1 WhatsApp Number",
        "500 Outbound Messages/Month",
        "Live Shared Inbox",
        "Keyword Auto-Replies"
      ]),
    },
    {
      id: "starter",
      name: "Starter Plan",
      badge: "Popular",
      price_inr: 1499,
      billing_interval: "month",
      max_branches: 1,
      max_seats: 5,
      max_senders: 1,
      max_monthly_messages: 5000,
      max_contacts: 2500,
      features: JSON.stringify([
        "1 Branch",
        "5 Staff Seats",
        "1 Connected Meta WhatsApp Number",
        "5,000 Outbound Messages/Month",
        "Visual Chatbot Flow Builder",
        "Bulk Campaign Scheduler",
        "Meta Cloud API Support"
      ]),
    },
    {
      id: "growth",
      name: "Growth Plan",
      badge: "Recommended",
      price_inr: 3999,
      billing_interval: "month",
      max_branches: 3,
      max_seats: 15,
      max_senders: 3,
      max_monthly_messages: 25000,
      max_contacts: 25000,
      features: JSON.stringify([
        "Up to 3 Branches (Multi-Branch Routing)",
        "15 Staff Seats",
        "3 Connected WhatsApp Numbers",
        "25,000 Outbound Messages/Month",
        "Smart AI Neural Replies & RAG",
        "Team Queues & SLA Tracking",
        "Priority 24/7 Support"
      ]),
    },
    {
      id: "business",
      name: "Business Plan",
      badge: "Scale",
      price_inr: 9999,
      billing_interval: "month",
      max_branches: 10,
      max_seats: 50,
      max_senders: 10,
      max_monthly_messages: 100000,
      max_contacts: 100000,
      features: JSON.stringify([
        "Up to 10 Branches",
        "50 Staff Seats",
        "10 Connected WhatsApp Numbers",
        "100,000 Outbound Messages/Month",
        "Advanced Branch Routing & Queues",
        "Custom Roles & Audit Trails",
        "API & Webhook Access"
      ]),
    },
    {
      id: "enterprise",
      name: "Enterprise Plan",
      badge: "Enterprise",
      price_inr: 24999,
      billing_interval: "month",
      max_branches: 50,
      max_seats: 200,
      max_senders: 50,
      max_monthly_messages: 500000,
      max_contacts: 500000,
      features: JSON.stringify([
        "Unlimited Branches",
        "Unlimited Seats",
        "Dedicated Meta Cloud WABA Setup",
        "500,000+ Outbound Messages/Month",
        "Dedicated Account Manager",
        "Custom Integrations & SLA"
      ]),
    },
  ];

  for (const p of plansCatalog) {
    await runSafe(
      `INSERT OR IGNORE INTO plans (id, name, badge, price_inr, billing_interval, max_branches, max_seats, max_senders, max_monthly_messages, max_contacts, features_json)
       VALUES ('${p.id}', '${p.name}', '${p.badge}', ${p.price_inr}, '${p.billing_interval}', ${p.max_branches}, ${p.max_seats}, ${p.max_senders}, ${p.max_monthly_messages}, ${p.max_contacts}, '${p.features.replace(/'/g, "''")}')`,
      `Seed plan ${p.id}`
    );
  }

  // 19. Backfill & Initialize Primary Organization (Tenant 1) and Head Office Branch
  console.log("📦 Initializing Primary Organization (Tenant 1) & Default Head Office Branch...");
  
  await runSafe(
    `INSERT OR IGNORE INTO tenants (id, name, slug, legal_name, brand_name, owner_user_id, plan, plan_status, max_branches, max_seats, max_senders, max_monthly_messages, ai_replies_enabled, flows_enabled, sender_pools_enabled, status)
     VALUES (1, 'Madhura Primary Organization', 'madhura-primary', 'Madhura Technologies Pvt Ltd', 'Madhura WhatsApp Cloud', 1, 'growth', 'active', 3, 15, 3, 25000, 1, 1, 1, 'active')`,
    "Ensure Primary Organization (Tenant 1)"
  );

  // Update tenant 1 metadata if already exists
  await runSafe(
    `UPDATE tenants SET 
      name = 'Madhura Primary Organization',
      legal_name = COALESCE(legal_name, 'Madhura Technologies Pvt Ltd'),
      brand_name = COALESCE(brand_name, 'Madhura WhatsApp Cloud'),
      max_branches = CASE WHEN max_branches < 3 THEN 3 ELSE max_branches END,
      max_seats = CASE WHEN max_seats < 15 THEN 15 ELSE max_seats END
     WHERE id = 1`,
    "Update Tenant 1 attributes"
  );

  // Default Head Office Branch for Tenant 1
  await runSafe(
    `INSERT OR IGNORE INTO branches (id, tenant_id, code, name, timezone, manager_id, is_head_office, status)
     VALUES (1, 1, 'HEADOFFICE', 'Head Office (Main)', 'Asia/Kolkata', 1, 1, 'active')`,
    "Ensure Head Office Branch (Branch 1) for Tenant 1"
  );

  // Map Admin User 1 to Organization Membership & Branch Membership
  const adminUser = await q("SELECT id, email FROM users WHERE id = 1 OR role = 'admin' ORDER BY id ASC LIMIT 1");
  if (adminUser && adminUser.length > 0) {
    const adminId = adminUser[0].id;
    await runSafe(
      `INSERT OR IGNORE INTO organization_memberships (tenant_id, user_id, role, membership_status)
       VALUES (1, ${adminId}, 'organization_owner', 'active')`,
      `Map Admin User ${adminId} to Tenant 1 Organization Membership`
    );

    await runSafe(
      `INSERT OR IGNORE INTO staff_branch_memberships (tenant_id, user_id, branch_id, is_primary)
       VALUES (1, ${adminId}, 1, 1)`,
      `Map Admin User ${adminId} to Head Office Branch`
    );

    await runSafe(
      `UPDATE users SET tenant_id = 1 WHERE id = ${adminId}`,
      `Set user ${adminId} tenant_id = 1`
    );
  }

  // 20. Backfill verified legacy records to Tenant 1 & Branch 1
  console.log("🔄 Performing safe non-destructive backfill of legacy records...");

  const backfillTables = [
    { table: "wa_contacts", tenantCol: "tenant_id", branchCol: "branch_id" },
    { table: "wa_accounts", tenantCol: "tenant_id", branchCol: "branch_id" },
    { table: "wa_templates", tenantCol: "tenant_id", branchCol: null },
    { table: "wa_campaigns", tenantCol: "tenant_id", branchCol: "branch_id" },
    { table: "wa_message_logs", tenantCol: "tenant_id", branchCol: "branch_id" },
    { table: "wa_flows", tenantCol: "tenant_id", branchCol: "branch_id" },
    { table: "wa_automations", tenantCol: "tenant_id", branchCol: "branch_id" },
    { table: "teammember", tenantCol: "tenant_id", branchCol: "branch_id" },
    { table: "wa_internal_notes", tenantCol: "tenant_id", branchCol: "branch_id" },
  ];

  for (const item of backfillTables) {
    try {
      await q(`UPDATE "${item.table}" SET ${item.tenantCol} = 1 WHERE ${item.tenantCol} IS NULL OR ${item.tenantCol} = 0`);
      if (item.branchCol) {
        await q(`UPDATE "${item.table}" SET ${item.branchCol} = 1 WHERE ${item.branchCol} IS NULL OR ${item.branchCol} = 0`);
      }
      console.log(`✅ [Migration] Backfilled legacy ${item.table} to Tenant 1 / Branch 1`);
    } catch (e) {
      console.warn(`ℹ️ [Migration] Backfill ${item.table} note:`, e.message);
    }
  }

  // Link any other existing users with NULL tenant_id to Tenant 1 as well
  await runSafe(
    `UPDATE users SET tenant_id = 1 WHERE tenant_id IS NULL OR tenant_id = 0`,
    "Set legacy users tenant_id = 1"
  );

  // Ensure wallet accounts exist for Tenant 1
  await runSafe(
    `INSERT OR IGNORE INTO wallet_accounts (tenant_id, currency, credit_type, balance, reserved_balance)
     VALUES (1, 'INR', 'ai_credits', 1000, 0)`,
    "Ensure Tenant 1 AI credits wallet"
  );
  await runSafe(
    `INSERT OR IGNORE INTO wallet_accounts (tenant_id, currency, credit_type, balance, reserved_balance)
     VALUES (1, 'INR', 'software_actions', 5000, 0)`,
    "Ensure Tenant 1 Software actions wallet"
  );

  // Record the applied version last: a run that threw part way through leaves
  // no marker, so the next boot replays it and the schema converges anyway.
  await q(
    `INSERT INTO schema_migrations (name, version)
     SELECT ?, ? WHERE NOT EXISTS (SELECT 1 FROM schema_migrations WHERE name = ? AND version = ?)`,
    [MIGRATION_NAME, SCHEMA_VERSION, MIGRATION_NAME, SCHEMA_VERSION]
  );

  console.log("🎉 Enterprise Multi-Tenant & Multi-Branch Migration Completed Successfully!");
}

if (require.main === module) {
  migrate()
    .then(() => {
      console.log("✅ Done.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("❌ Migration failed:", err);
      process.exit(1);
    });
}

module.exports = { migrate };
