"use strict";

/**
 * Additive schema migration for:
 * 1. Atomic Credit Lifecycle (usage_reservations, usage_rate_cards, employee_usage_limits,
 *    employee_usage_summary, tenant_usage_periods, workflow_run_costs, usage_events extensions)
 * 2. Automation Versioning & Analytics (wa_automation_versions, wa_automations/logs metrics)
 * Compatible with both MySQL and SQLite.
 */
async function migrate(db) {
  const q = async (sql, params = []) => (await db.promise().query(sql, params))[0];
  const pk = db.isSqlite ? "INTEGER PRIMARY KEY AUTOINCREMENT" : "INT AUTO_INCREMENT PRIMARY KEY";

  async function existingCols(table) {
    try {
      const rows = db.isSqlite
        ? await q(`PRAGMA table_info(${table})`)
        : await q("SELECT COLUMN_NAME AS name FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?", [table]);
      return new Set(rows.map((r) => String(r.name || r.COLUMN_NAME || "").toLowerCase()));
    } catch (_) {
      return null;
    }
  }

  async function ensureCol(table, col, defSql) {
    const cols = await existingCols(table);
    if (!cols || cols.has(col.toLowerCase())) return;
    await q(`ALTER TABLE ${table} ADD COLUMN ${col} ${defSql}`);
  }

  const tables = [
    `CREATE TABLE IF NOT EXISTS usage_reservations (
      id ${pk},
      tenant_id INT NOT NULL,
      account_id INT DEFAULT NULL,
      user_id INT DEFAULT NULL,
      credit_type VARCHAR(50) NOT NULL DEFAULT 'ai_credits',
      operation VARCHAR(80) NOT NULL,
      estimated_amount INT NOT NULL DEFAULT 0,
      consumed_amount INT NOT NULL DEFAULT 0,
      released_amount INT NOT NULL DEFAULT 0,
      status VARCHAR(24) NOT NULL DEFAULT 'reserved',
      reference_id VARCHAR(191) NOT NULL,
      automation_id INT DEFAULT NULL,
      flow_id INT DEFAULT NULL,
      flow_run_id INT DEFAULT NULL,
      expires_at DATETIME DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS usage_rate_cards (
      id ${pk},
      operation_key VARCHAR(80) NOT NULL,
      credit_type VARCHAR(50) NOT NULL DEFAULT 'ai_credits',
      credits_per_unit INT NOT NULL DEFAULT 1,
      provider_cost_minor INT NOT NULL DEFAULT 0,
      currency VARCHAR(10) NOT NULL DEFAULT 'INR',
      version INT NOT NULL DEFAULT 1,
      is_active TINYINT NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS employee_usage_limits (
      id ${pk},
      tenant_id INT NOT NULL,
      user_id INT NOT NULL,
      daily_credit_limit INT DEFAULT NULL,
      monthly_credit_limit INT DEFAULT NULL,
      daily_message_limit INT DEFAULT NULL,
      monthly_message_limit INT DEFAULT NULL,
      allow_ai TINYINT NOT NULL DEFAULT 1,
      allow_campaigns TINYINT NOT NULL DEFAULT 1,
      allow_automations TINYINT NOT NULL DEFAULT 1,
      is_suspended TINYINT NOT NULL DEFAULT 0,
      updated_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS employee_usage_summary (
      id ${pk},
      tenant_id INT NOT NULL,
      user_id INT NOT NULL DEFAULT 0,
      period_key VARCHAR(20) NOT NULL,
      actions_count INT NOT NULL DEFAULT 0,
      ai_credits_used INT NOT NULL DEFAULT 0,
      messages_sent INT NOT NULL DEFAULT 0,
      campaigns_sent INT NOT NULL DEFAULT 0,
      automations_run INT NOT NULL DEFAULT 0,
      flows_run INT NOT NULL DEFAULT 0,
      cost_minor INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS tenant_usage_periods (
      id ${pk},
      tenant_id INT NOT NULL,
      period_key VARCHAR(20) NOT NULL,
      messages_included INT NOT NULL DEFAULT 1000,
      messages_used INT NOT NULL DEFAULT 0,
      ai_credits_included INT NOT NULL DEFAULT 0,
      ai_credits_used INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS workflow_run_costs (
      id ${pk},
      tenant_id INT NOT NULL,
      source_type VARCHAR(30) NOT NULL,
      source_id INT DEFAULT NULL,
      run_id INT DEFAULT NULL,
      user_id INT DEFAULT NULL,
      credits_used INT NOT NULL DEFAULT 0,
      messages_count INT NOT NULL DEFAULT 0,
      provider_cost_minor INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS wa_automation_versions (
      id ${pk},
      tenant_id INT NOT NULL,
      automation_id INT NOT NULL,
      version_number INT NOT NULL DEFAULT 1,
      snapshot_json TEXT NOT NULL,
      status VARCHAR(24) NOT NULL DEFAULT 'published',
      changelog VARCHAR(255) DEFAULT NULL,
      published_by INT DEFAULT NULL,
      published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
  ];

  for (const ddl of tables) {
    await q(ddl);
  }

  // Additive columns on existing tables (if present)
  await ensureCol("usage_events", "user_id", "INT DEFAULT NULL");
  await ensureCol("usage_events", "credit_type", "VARCHAR(50) DEFAULT NULL");
  await ensureCol("usage_events", "cost_credits", "INT NOT NULL DEFAULT 0");
  await ensureCol("usage_events", "provider_cost_minor", "INT NOT NULL DEFAULT 0");
  await ensureCol("usage_events", "source_type", "VARCHAR(40) DEFAULT NULL");
  await ensureCol("usage_events", "source_id", "INT DEFAULT NULL");
  await ensureCol("usage_events", "run_id", "INT DEFAULT NULL");
  await ensureCol("usage_events", "metadata_json", "TEXT DEFAULT NULL");

  await ensureCol("wa_automations", "branch_id", "INT DEFAULT NULL");
  await ensureCol("wa_automations", "published_version_id", "INT DEFAULT NULL");
  await ensureCol("wa_automations", "credits_consumed", "INT NOT NULL DEFAULT 0");
  await ensureCol("wa_automations", "failed_runs_count", "INT NOT NULL DEFAULT 0");
  await ensureCol("wa_automations", "last_executed_at", "DATETIME DEFAULT NULL");

  await ensureCol("wa_automation_logs", "version_id", "INT DEFAULT NULL");
  await ensureCol("wa_automation_logs", "credits_used", "INT NOT NULL DEFAULT 0");
  await ensureCol("wa_automation_logs", "actor_user_id", "INT DEFAULT NULL");
  await ensureCol("wa_automation_logs", "branch_id", "INT DEFAULT NULL");

  const indexes = [
    ["usage_reservations", "uq_usage_res_ref", "tenant_id, reference_id", true],
    ["usage_reservations", "idx_usage_res_status", "tenant_id, status, expires_at", false],
    ["usage_rate_cards", "uq_rate_op_ver", "operation_key, version", true],
    ["employee_usage_limits", "uq_emp_limit_user", "tenant_id, user_id", true],
    ["employee_usage_summary", "uq_emp_sum_period", "tenant_id, user_id, period_key", true],
    ["tenant_usage_periods", "uq_tenant_period", "tenant_id, period_key", true],
    ["workflow_run_costs", "idx_wf_cost_tenant", "tenant_id, source_type, source_id", false],
    ["wa_automation_versions", "idx_auto_ver_lookup", "tenant_id, automation_id, version_number", false],
  ];

  for (const [table, name, cols, unique] of indexes) {
    try {
      await q(`CREATE ${unique ? "UNIQUE " : ""}INDEX ${name} ON ${table} (${cols})`);
    } catch (error) {
      if (!/already exists|Duplicate key name/i.test(error.message)) {
        throw error;
      }
    }
  }

  // Seed default version-1 usage rate cards if missing
  const defaults = [
    ["ai_reply", "ai_credits", 1, 15],
    ["ai_generate", "ai_credits", 1, 15],
    ["ai_intent", "ai_credits", 1, 8],
    ["kb_search", "ai_credits", 1, 5],
    ["outbound_message", "message_credits", 1, 20],
    ["campaign_message", "message_credits", 1, 25],
    ["flow_execution", "ai_credits", 0, 2],
    ["automation_execution", "message_credits", 1, 20],
    ["media_process", "ai_credits", 1, 10],
    ["external_webhook", "ai_credits", 0, 5],
  ];
  for (const [op, creditType, credits, costMinor] of defaults) {
    const existing = await q("SELECT id FROM usage_rate_cards WHERE operation_key=? AND version=1 LIMIT 1", [op]).catch(() => []);
    if (!existing.length) {
      await q(
        "INSERT INTO usage_rate_cards (operation_key,credit_type,credits_per_unit,provider_cost_minor,currency,version,is_active) VALUES (?,?,?,?,'INR',1,1)",
        [op, creditType, credits, costMinor]
      ).catch(() => {});
    }
  }
}

module.exports = { migrate };
