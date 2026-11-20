"use strict";

/**
 * campaign_wati_upgrade_pack.js
 *
 * Dual MySQL + SQLite migration for Madhura's WATI Competitive Upgrade Pack:
 *   - Smart Behavioral Retargeting rules & anti-repeat run logs
 *   - Multi-step Drip Campaign Sequences, durable enrollments & step metrics
 *   - Configurable Retry Policies & Meta Template Pacing Recovery incidents
 *   - Optional Cross-Channel Fallback (SMS/RCS/Email) configs & separate ledgers
 *   - Guided First-Campaign pending Meta approval auto-launch monitor
 */

const { createDbHelper } = require("../services/campaign/dbHelper");

async function migrate(dbRaw) {
  const db = createDbHelper(dbRaw);
  const isSqlite = db.isSqlite;
  const PK = isSqlite
    ? "INTEGER PRIMARY KEY AUTOINCREMENT"
    : "BIGINT AUTO_INCREMENT PRIMARY KEY";
  const JSON_COL = isSqlite ? "TEXT" : "LONGTEXT";
  const DT = "DATETIME DEFAULT CURRENT_TIMESTAMP";

  const ddl = [
    // 1. Smart Behavioral Retargeting
    `CREATE TABLE IF NOT EXISTS campaign_retargeting_rules (
      id ${PK},
      tenant_id BIGINT NOT NULL,
      workspace_id BIGINT DEFAULT NULL,
      name VARCHAR(255) NOT NULL,
      source_campaign_id BIGINT NOT NULL,
      engagement_segment VARCHAR(64) NOT NULL,
      delay_hours INT NOT NULL DEFAULT 24,
      target_template_id BIGINT DEFAULT NULL,
      target_flowbot_id BIGINT DEFAULT NULL,
      target_automation_id BIGINT DEFAULT NULL,
      stop_conditions_json ${JSON_COL} DEFAULT NULL,
      is_active TINYINT NOT NULL DEFAULT 1,
      last_evaluated_at DATETIME DEFAULT NULL,
      created_by BIGINT DEFAULT NULL,
      created_at ${DT},
      updated_at ${DT}
    )`,

    `CREATE TABLE IF NOT EXISTS campaign_retargeting_runs (
      id ${PK},
      tenant_id BIGINT NOT NULL,
      rule_id BIGINT DEFAULT NULL,
      source_campaign_id BIGINT NOT NULL,
      engagement_segment VARCHAR(64) NOT NULL,
      created_segment_id BIGINT DEFAULT NULL,
      created_campaign_id BIGINT DEFAULT NULL,
      matched_count INT NOT NULL DEFAULT 0,
      eligible_count INT NOT NULL DEFAULT 0,
      excluded_count INT NOT NULL DEFAULT 0,
      repeat_blocked_count INT NOT NULL DEFAULT 0,
      status VARCHAR(32) NOT NULL DEFAULT 'COMPLETED',
      summary_json ${JSON_COL} DEFAULT NULL,
      created_by BIGINT DEFAULT NULL,
      created_at ${DT}
    )`,

    `CREATE TABLE IF NOT EXISTS campaign_retargeting_history (
      id ${PK},
      tenant_id BIGINT NOT NULL,
      source_campaign_id BIGINT NOT NULL,
      engagement_segment VARCHAR(64) NOT NULL,
      normalized_phone VARCHAR(32) NOT NULL,
      target_campaign_id BIGINT DEFAULT NULL,
      created_at ${DT}
    )`,

    // 2. Drip Campaigns & Multi-Step Sequence Engine
    `CREATE TABLE IF NOT EXISTS drip_sequences (
      id ${PK},
      sequence_uid VARCHAR(64) NOT NULL,
      tenant_id BIGINT NOT NULL,
      workspace_id BIGINT DEFAULT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT DEFAULT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
      current_version INT NOT NULL DEFAULT 1,
      sender_id BIGINT DEFAULT NULL,
      waba_id VARCHAR(120) DEFAULT NULL,
      group_id BIGINT DEFAULT NULL,
      segment_id BIGINT DEFAULT NULL,
      steps_json ${JSON_COL} NOT NULL,
      schedule_config_json ${JSON_COL} DEFAULT NULL,
      stop_conditions_json ${JSON_COL} DEFAULT NULL,
      reply_behavior VARCHAR(40) NOT NULL DEFAULT 'stop',
      reply_flowbot_id BIGINT DEFAULT NULL,
      expires_at DATETIME DEFAULT NULL,
      created_by BIGINT DEFAULT NULL,
      created_at ${DT},
      updated_at ${DT}
    )`,

    `CREATE TABLE IF NOT EXISTS drip_sequence_enrollments (
      id ${PK},
      tenant_id BIGINT NOT NULL,
      sequence_id BIGINT NOT NULL,
      sequence_version INT NOT NULL DEFAULT 1,
      contact_id BIGINT DEFAULT NULL,
      normalized_phone VARCHAR(32) NOT NULL,
      contact_name VARCHAR(255) DEFAULT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
      current_step_index INT NOT NULL DEFAULT 0,
      next_run_at DATETIME DEFAULT NULL,
      last_wamid VARCHAR(191) DEFAULT NULL,
      exit_reason VARCHAR(120) DEFAULT NULL,
      converted TINYINT NOT NULL DEFAULT 0,
      revenue_minor BIGINT NOT NULL DEFAULT 0,
      state_json ${JSON_COL} DEFAULT NULL,
      enrolled_at ${DT},
      completed_at DATETIME DEFAULT NULL,
      updated_at ${DT}
    )`,

    `CREATE TABLE IF NOT EXISTS drip_sequence_step_logs (
      id ${PK},
      tenant_id BIGINT NOT NULL,
      sequence_id BIGINT NOT NULL,
      enrollment_id BIGINT NOT NULL,
      step_index INT NOT NULL,
      step_type VARCHAR(48) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'REACHED',
      wamid VARCHAR(191) DEFAULT NULL,
      error_code VARCHAR(80) DEFAULT NULL,
      error_message TEXT DEFAULT NULL,
      payload_json ${JSON_COL} DEFAULT NULL,
      created_at ${DT}
    )`,

    // 3. Configurable Retry Policies & Meta Template Pacing Recovery
    `CREATE TABLE IF NOT EXISTS campaign_retry_policies (
      id ${PK},
      tenant_id BIGINT NOT NULL,
      workspace_id BIGINT DEFAULT NULL,
      campaign_id BIGINT DEFAULT NULL,
      name VARCHAR(160) NOT NULL DEFAULT 'Default Retry Policy',
      retry_delays_seconds_json ${JSON_COL} NOT NULL,
      max_attempts INT NOT NULL DEFAULT 3,
      jitter_pct INT NOT NULL DEFAULT 20,
      deadline_hours INT NOT NULL DEFAULT 24,
      is_active TINYINT NOT NULL DEFAULT 1,
      created_by BIGINT DEFAULT NULL,
      created_at ${DT},
      updated_at ${DT}
    )`,

    `CREATE TABLE IF NOT EXISTS campaign_template_pacing_incidents (
      id ${PK},
      tenant_id BIGINT NOT NULL,
      campaign_id BIGINT NOT NULL,
      template_id BIGINT DEFAULT NULL,
      template_name VARCHAR(255) DEFAULT NULL,
      error_code VARCHAR(80) NOT NULL,
      error_message TEXT DEFAULT NULL,
      preserved_accepted_count INT NOT NULL DEFAULT 0,
      affected_pending_count INT NOT NULL DEFAULT 0,
      replacement_template_id BIGINT DEFAULT NULL,
      recovery_campaign_id BIGINT DEFAULT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
      detected_at ${DT},
      recovered_at DATETIME DEFAULT NULL,
      updated_at ${DT}
    )`,

    // 4. Optional Cross-Channel Fallback (SMS / RCS / Email) with Separate Ledgers
    `CREATE TABLE IF NOT EXISTS campaign_fallback_channels (
      id ${PK},
      tenant_id BIGINT NOT NULL,
      workspace_id BIGINT DEFAULT NULL,
      channel VARCHAR(24) NOT NULL,
      provider_name VARCHAR(64) NOT NULL,
      sender_identity VARCHAR(120) DEFAULT NULL,
      config_json ${JSON_COL} DEFAULT NULL,
      allow_promotional_fallback TINYINT NOT NULL DEFAULT 0,
      cost_per_message_minor INT NOT NULL DEFAULT 25,
      currency VARCHAR(10) NOT NULL DEFAULT 'INR',
      is_active TINYINT NOT NULL DEFAULT 1,
      created_by BIGINT DEFAULT NULL,
      created_at ${DT},
      updated_at ${DT}
    )`,

    `CREATE TABLE IF NOT EXISTS campaign_fallback_dispatches (
      id ${PK},
      tenant_id BIGINT NOT NULL,
      campaign_id BIGINT NOT NULL,
      recipient_id BIGINT NOT NULL,
      channel VARCHAR(24) NOT NULL,
      provider_name VARCHAR(64) NOT NULL,
      normalized_destination VARCHAR(255) NOT NULL,
      channel_message_id VARCHAR(191) DEFAULT NULL,
      consent_evidence_ref VARCHAR(160) DEFAULT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'SUBMITTED',
      cost_minor INT NOT NULL DEFAULT 0,
      currency VARCHAR(10) NOT NULL DEFAULT 'INR',
      error_message TEXT DEFAULT NULL,
      created_at ${DT}
    )`,

    // 5. Guided First-Campaign Pending Approval Auto-Launch Monitor
    `CREATE TABLE IF NOT EXISTS campaign_pending_auto_launches (
      id ${PK},
      tenant_id BIGINT NOT NULL,
      campaign_id BIGINT NOT NULL,
      template_id BIGINT NOT NULL,
      auto_launch_enabled TINYINT NOT NULL DEFAULT 0,
      status VARCHAR(40) NOT NULL DEFAULT 'WAITING_TEMPLATE_APPROVAL',
      last_checked_at DATETIME DEFAULT NULL,
      last_blockers_json ${JSON_COL} DEFAULT NULL,
      launched_at DATETIME DEFAULT NULL,
      created_by BIGINT DEFAULT NULL,
      created_at ${DT},
      updated_at ${DT}
    )`,
  ];

  for (const sql of ddl) {
    await db.query(sql);
  }

  const indexes = [
    ["idx_retarg_hist_unique", "campaign_retargeting_history", "tenant_id, source_campaign_id, engagement_segment, normalized_phone", true],
    ["idx_drip_enr_due", "drip_sequence_enrollments", "status, next_run_at", false],
    ["idx_drip_enr_tenant_phone", "drip_sequence_enrollments", "tenant_id, normalized_phone, status", false],
    ["idx_drip_logs_seq", "drip_sequence_step_logs", "tenant_id, sequence_id, step_index", false],
    ["idx_pacing_tenant_camp", "campaign_template_pacing_incidents", "tenant_id, campaign_id, status", false],
    ["idx_fallback_disp_camp", "campaign_fallback_dispatches", "tenant_id, campaign_id, channel", false],
    ["idx_pending_auto_launch", "campaign_pending_auto_launches", "tenant_id, status, template_id", false],
  ];

  for (const [name, table, cols, unique] of indexes) {
    try {
      const u = unique ? "UNIQUE " : "";
      if (isSqlite) {
        await db.query(`CREATE ${u}INDEX IF NOT EXISTS ${name} ON ${table} (${cols})`);
      } else {
        await db.query(`CREATE ${u}INDEX ${name} ON ${table} (${cols})`);
      }
    } catch (_) {}
  }

  return { migrated: true, tables: ddl.length };
}

module.exports = { migrate };
