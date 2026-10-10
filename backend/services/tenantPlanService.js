const db = require("../config/database");

const PLANS = {
  free: {
    id: "free",
    name: "Free Tier",
    badge: "Free",
    price: "₹0",
    billing: "Free forever",
    maxSenders: 1,
    maxMonthlyMessages: 500,
    maxContacts: 100,
    features: [
      "1 Connected WhatsApp Number",
      "500 Outbound Messages/Month",
      "Live Chat Inbox & History",
      "Standard Message Templates",
      "Basic Keyword Auto-Reply",
      "Web Session Engine Access"
    ],
    aiReplies: false,
    flows: false,
    senderPools: false,
  },
  starter: {
    id: "starter",
    name: "Starter Plan",
    badge: "Popular",
    price: "₹1,499",
    billing: "per month",
    maxSenders: 3,
    maxMonthlyMessages: 5000,
    maxContacts: 2500,
    features: [
      "3 Connected WhatsApp Numbers",
      "5,000 Outbound Messages/Month",
      "Full Visual Chatbot Flow Builder",
      "Automated Reminders & Invoices",
      "Bulk Campaign Scheduler & CSV Import",
      "Anti-Ban Humanized Pacing Presets",
      "Meta Cloud API + Web Engine Support"
    ],
    aiReplies: false,
    flows: true,
    senderPools: false,
  },
  growth: {
    id: "growth",
    name: "Growth Plan",
    badge: "Recommended",
    price: "₹3,999",
    billing: "per month",
    maxSenders: 10,
    maxMonthlyMessages: 25000,
    maxContacts: 25000,
    features: [
      "10 Connected WhatsApp Numbers",
      "25,000 Outbound Messages/Month",
      "Smart AI Neural Replies (OpenAI)",
      "Multi-Sender Pool Load Balancing",
      "Visual Chatbot Flow Builder",
      "Automated Drip Sequences & Followups",
      "Interactive List & Button Messages",
      "Priority 24/7 SLA Support"
    ],
    aiReplies: true,
    flows: true,
    senderPools: true,
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise Plan",
    badge: "Enterprise",
    price: "₹9,999",
    billing: "per month",
    maxSenders: 50,
    maxMonthlyMessages: 100000,
    maxContacts: 100000,
    features: [
      "50+ Connected WhatsApp Numbers",
      "100,000+ Outbound Messages/Month",
      "Dedicated Meta Cloud API Engine Setup",
      "Unlimited Team Members & Agents",
      "Real-Time Webhook & CRM REST API",
      "Dedicated IP & Phone Isolation",
      "Custom SLA & Dedicated Account Manager"
    ],
    aiReplies: true,
    flows: true,
    senderPools: true,
  }
};

function queryAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      db.query(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    } catch (e) {
      reject(e);
    }
  });
}

function getAvailablePlans() {
  return Object.values(PLANS);
}

function getPlan(planId) {
  const key = String(planId || "starter").toLowerCase();
  return PLANS[key] || PLANS.starter;
}

/**
 * Ensures the tenants table exists and default tenant #1 is seeded.
 */
async function ensureTenantsTable() {
  try {
    const createSql = db.isSqlite
      ? `CREATE TABLE IF NOT EXISTS tenants (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          slug TEXT UNIQUE,
          plan TEXT DEFAULT 'growth',
          plan_status TEXT DEFAULT 'active',
          max_senders INTEGER DEFAULT 10,
          max_monthly_messages INTEGER DEFAULT 25000,
          ai_replies_enabled INTEGER DEFAULT 1,
          flows_enabled INTEGER DEFAULT 1,
          sender_pools_enabled INTEGER DEFAULT 1,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`
      : `CREATE TABLE IF NOT EXISTS tenants (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          slug VARCHAR(100) UNIQUE,
          plan VARCHAR(50) DEFAULT 'growth',
          plan_status VARCHAR(50) DEFAULT 'active',
          max_senders INT DEFAULT 10,
          max_monthly_messages INT DEFAULT 25000,
          ai_replies_enabled TINYINT(1) DEFAULT 1,
          flows_enabled TINYINT(1) DEFAULT 1,
          sender_pools_enabled TINYINT(1) DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_slug (slug),
          INDEX idx_plan (plan)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

    await queryAsync(createSql);

    // Check if default tenant 1 exists
    const rows = await queryAsync("SELECT id FROM tenants WHERE id = 1 LIMIT 1");
    if (!rows || rows.length === 0) {
      const seedSql = db.isSqlite
        ? `INSERT OR IGNORE INTO tenants (id, name, slug, plan, plan_status, max_senders, max_monthly_messages, ai_replies_enabled, flows_enabled, sender_pools_enabled)
           VALUES (1, 'Madhura Tech CRM Workspace', 'madhura-primary', 'growth', 'active', 10, 25000, 1, 1, 1)`
        : `INSERT IGNORE INTO tenants (id, name, slug, plan, plan_status, max_senders, max_monthly_messages, ai_replies_enabled, flows_enabled, sender_pools_enabled)
           VALUES (1, 'Madhura Tech CRM Workspace', 'madhura-primary', 'growth', 'active', 10, 25000, 1, 1, 1)`;
      await queryAsync(seedSql);
    }
  } catch (err) {
    // Non-fatal if table already exists or DB starting up
    console.warn("[tenantPlanService] ensureTenantsTable warning:", err.message);
  }
}

/**
 * Retrieves a tenant by ID with plan details
 */
async function getTenantById(tenantId = 1) {
  try {
    const tid = Number(tenantId) || 1;
    const rows = await queryAsync("SELECT * FROM tenants WHERE id = ? LIMIT 1", [tid]);
    if (rows && rows.length > 0) {
      const tenant = rows[0];
      const planMeta = getPlan(tenant.plan);
      return {
        ...tenant,
        planMeta,
      };
    }
  } catch (err) {
    console.warn("[tenantPlanService] getTenantById error:", err.message);
  }

  // Graceful fallback
  return {
    id: Number(tenantId) || 1,
    name: "Madhura Tech Workspace",
    slug: "default",
    plan: "growth",
    plan_status: "active",
    max_senders: 10,
    max_monthly_messages: 25000,
    planMeta: PLANS.growth,
  };
}

/**
 * Creates a new tenant workspace for self-signup
 */
async function createTenant({ name, slug, plan = "starter" }) {
  await ensureTenantsTable();
  const cleanPlan = String(plan || "starter").toLowerCase();
  const planConfig = getPlan(cleanPlan);
  const cleanName = (name || "New Workspace").trim();
  const baseSlug = (slug || cleanName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "workspace";
  const uniqueSlug = `${baseSlug}-${Date.now().toString(36)}`;

  const insertSql = `INSERT INTO tenants 
    (name, slug, plan, plan_status, max_senders, max_monthly_messages, ai_replies_enabled, flows_enabled, sender_pools_enabled)
    VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?)`;

  const result = await queryAsync(insertSql, [
    cleanName,
    uniqueSlug,
    cleanPlan,
    planConfig.maxSenders,
    planConfig.maxMonthlyMessages,
    planConfig.aiReplies ? 1 : 0,
    planConfig.flows ? 1 : 0,
    planConfig.senderPools ? 1 : 0,
  ]);

  const newId = result.insertId || result.lastID;
  return {
    id: newId,
    name: cleanName,
    slug: uniqueSlug,
    plan: cleanPlan,
    plan_status: "active",
    max_senders: planConfig.maxSenders,
    max_monthly_messages: planConfig.maxMonthlyMessages,
    planMeta: planConfig,
  };
}

/**
 * Updates a tenant's plan
 */
async function switchTenantPlan(tenantId, newPlanId) {
  const planConfig = getPlan(newPlanId);
  const updateSql = `UPDATE tenants SET 
    plan = ?, 
    max_senders = ?, 
    max_monthly_messages = ?, 
    ai_replies_enabled = ?, 
    flows_enabled = ?, 
    sender_pools_enabled = ?,
    updated_at = CURRENT_TIMESTAMP
    WHERE id = ?`;

  await queryAsync(updateSql, [
    planConfig.id,
    planConfig.maxSenders,
    planConfig.maxMonthlyMessages,
    planConfig.aiReplies ? 1 : 0,
    planConfig.flows ? 1 : 0,
    planConfig.senderPools ? 1 : 0,
    tenantId,
  ]);

  return getTenantById(tenantId);
}

/**
 * Calculates current usage for the tenant (accounts, messages sent this month)
 */
async function getTenantUsage(tenantId = 1) {
  const tenant = await getTenantById(tenantId);
  let activeSendersCount = 0;
  let monthlyMessagesSent = 0;

  try {
    const accRows = await queryAsync(
      "SELECT COUNT(*) as count FROM wa_accounts WHERE tenant_id = ? AND is_active = 1",
      [tenant.id]
    );
    activeSendersCount = accRows?.[0]?.count || 0;
  } catch (_) {
    // If table not present or column missing
    try {
      const fallbackAcc = await queryAsync("SELECT COUNT(*) as count FROM wa_accounts WHERE is_active = 1");
      activeSendersCount = fallbackAcc?.[0]?.count || 0;
    } catch (_) {}
  }

  try {
    const msgRows = await queryAsync(
      db.isSqlite
        ? `SELECT COUNT(*) as count FROM wa_message_logs 
           WHERE (tenant_id = ? OR tenant_id IS NULL) 
             AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')`
        : `SELECT COUNT(*) as count FROM wa_message_logs 
           WHERE (tenant_id = ? OR tenant_id IS NULL) 
             AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')`,
      [tenant.id]
    );
    monthlyMessagesSent = msgRows?.[0]?.count || 0;
  } catch (_) {}

  return {
    tenant,
    usage: {
      sendersUsed: Number(activeSendersCount),
      sendersLimit: tenant.max_senders || tenant.planMeta?.maxSenders || 3,
      messagesUsedThisMonth: Number(monthlyMessagesSent),
      messagesLimit: tenant.max_monthly_messages || tenant.planMeta?.maxMonthlyMessages || 5000,
      usagePercent: Math.min(100, Math.round((monthlyMessagesSent / (tenant.max_monthly_messages || 5000)) * 100)),
    },
  };
}

module.exports = {
  PLANS,
  getAvailablePlans,
  getPlan,
  ensureTenantsTable,
  getTenantById,
  createTenant,
  switchTenantPlan,
  getTenantUsage,
};
