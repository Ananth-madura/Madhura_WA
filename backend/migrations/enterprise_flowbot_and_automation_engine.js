"use strict";

/**
 * enterprise_flowbot_and_automation_engine.js
 *
 * Dual MySQL + SQLite migration for Madhura's two integrated execution engines:
 *   1. Conversational Flowbot Runtime (persisted per-conversation sessions,
 *      steps, trigger priority registry, handover events, 24h service windows).
 *   2. Business Automation Workflow Engine (durable DAG workflows, immutable
 *      versions, persisted runs, step traces, waits, approvals, dead-letters,
 *      transactional outbox, idempotency, CRM deals/tasks, AI knowledge base,
 *      and encrypted integration credentials).
 *
 * Reuses existing Madhura tables (`wa_flows`, `wa_flow_versions`, `wa_automations`,
 * `wa_contacts`, `wa_enquiries`, `conversations`, `campaigns`) without duplicating them.
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
    // ── 1. Real 24-Hour Meta Customer Service Window Tracker ─────────────────
    `CREATE TABLE IF NOT EXISTS wa_service_windows (
      id ${PK},
      tenant_id BIGINT NOT NULL,
      sender_id BIGINT DEFAULT NULL,
      waba_id VARCHAR(120) DEFAULT NULL,
      phone VARCHAR(32) NOT NULL,
      last_inbound_at DATETIME NOT NULL,
      window_expires_at DATETIME NOT NULL,
      last_inbound_message_id VARCHAR(191) DEFAULT NULL,
      last_inbound_type VARCHAR(64) DEFAULT 'text',
      updated_at ${DT}
    )`,

    // ── 2. Flowbot Trigger Priority Registry (binds to existing wa_flows) ────
    `CREATE TABLE IF NOT EXISTS flowbot_triggers (
      id ${PK},
      tenant_id BIGINT NOT NULL,
      workspace_id BIGINT DEFAULT NULL,
      flow_id BIGINT NOT NULL,
      trigger_type VARCHAR(64) NOT NULL,
      match_value VARCHAR(255) DEFAULT NULL,
      campaign_id BIGINT DEFAULT NULL,
      sender_id BIGINT DEFAULT NULL,
      entry_node_key VARCHAR(120) DEFAULT 'start',
      priority INT NOT NULL DEFAULT 50,
      is_active TINYINT NOT NULL DEFAULT 1,
      conditions_json ${JSON_COL} DEFAULT NULL,
      created_by BIGINT DEFAULT NULL,
      created_at ${DT},
      updated_at ${DT}
    )`,

    // ── 3. Flowbot Persisted Conversation Sessions ───────────────────────────
    `CREATE TABLE IF NOT EXISTS flowbot_sessions (
      id ${PK},
      session_uid VARCHAR(64) NOT NULL,
      tenant_id BIGINT NOT NULL,
      workspace_id BIGINT DEFAULT NULL,
      conversation_id BIGINT DEFAULT NULL,
      contact_id BIGINT DEFAULT NULL,
      phone VARCHAR(32) NOT NULL,
      sender_id BIGINT DEFAULT NULL,
      waba_id VARCHAR(120) DEFAULT NULL,
      campaign_id BIGINT DEFAULT NULL,
      flow_id BIGINT NOT NULL,
      flow_version_id BIGINT DEFAULT NULL,
      flow_version_number INT NOT NULL DEFAULT 1,
      status VARCHAR(40) NOT NULL DEFAULT 'NEW',
      current_node_key VARCHAR(120) DEFAULT 'start',
      previous_node_key VARCHAR(120) DEFAULT NULL,
      variables_json ${JSON_COL} DEFAULT NULL,
      collected_data_json ${JSON_COL} DEFAULT NULL,
      subflow_stack_json ${JSON_COL} DEFAULT NULL,
      attempt_count INT NOT NULL DEFAULT 0,
      iteration_count INT NOT NULL DEFAULT 0,
      node_exec_count INT NOT NULL DEFAULT 0,
      waiting_for_variable VARCHAR(120) DEFAULT NULL,
      waiting_until DATETIME DEFAULT NULL,
      resume_event VARCHAR(120) DEFAULT NULL,
      timeout_node_key VARCHAR(120) DEFAULT NULL,
      handover_agent_id BIGINT DEFAULT NULL,
      handover_team_id BIGINT DEFAULT NULL,
      handover_summary TEXT DEFAULT NULL,
      last_error_code VARCHAR(80) DEFAULT NULL,
      last_error_message TEXT DEFAULT NULL,
      is_test_mode TINYINT NOT NULL DEFAULT 0,
      started_at ${DT},
      last_activity_at ${DT},
      completed_at DATETIME DEFAULT NULL,
      updated_at ${DT}
    )`,

    // ── 4. Flowbot Step Execution Trace ──────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS flowbot_execution_steps (
      id ${PK},
      tenant_id BIGINT NOT NULL,
      session_id BIGINT NOT NULL,
      flow_id BIGINT NOT NULL,
      flow_version_id BIGINT DEFAULT NULL,
      node_key VARCHAR(120) NOT NULL,
      node_type VARCHAR(64) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'COMPLETED',
      input_json ${JSON_COL} DEFAULT NULL,
      output_json ${JSON_COL} DEFAULT NULL,
      error_code VARCHAR(80) DEFAULT NULL,
      error_message TEXT DEFAULT NULL,
      duration_ms INT NOT NULL DEFAULT 0,
      is_test_mode TINYINT NOT NULL DEFAULT 0,
      created_at ${DT}
    )`,

    // ── 5. Flowbot Human Handover Events ─────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS flowbot_handover_events (
      id ${PK},
      tenant_id BIGINT NOT NULL,
      workspace_id BIGINT DEFAULT NULL,
      session_id BIGINT NOT NULL,
      conversation_id BIGINT DEFAULT NULL,
      contact_id BIGINT DEFAULT NULL,
      phone VARCHAR(32) NOT NULL,
      routing_strategy VARCHAR(64) NOT NULL DEFAULT 'direct_agent',
      assigned_agent_id BIGINT DEFAULT NULL,
      assigned_team_id BIGINT DEFAULT NULL,
      priority VARCHAR(32) NOT NULL DEFAULT 'normal',
      escalation_channel VARCHAR(64) NOT NULL DEFAULT 'in_chat',
      reason TEXT DEFAULT NULL,
      context_summary TEXT DEFAULT NULL,
      collected_answers_json ${JSON_COL} DEFAULT NULL,
      bot_paused TINYINT NOT NULL DEFAULT 1,
      status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
      resumed_by BIGINT DEFAULT NULL,
      resumed_at DATETIME DEFAULT NULL,
      created_at ${DT}
    )`,

    // ── 6. Enterprise Automation Workflows (DAG definitions) ─────────────────
    `CREATE TABLE IF NOT EXISTS automation_workflows (
      id ${PK},
      workflow_uid VARCHAR(64) NOT NULL,
      tenant_id BIGINT NOT NULL,
      workspace_id BIGINT DEFAULT NULL,
      company_id BIGINT DEFAULT NULL,
      agency_client_id BIGINT DEFAULT NULL,
      legacy_automation_id BIGINT DEFAULT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT DEFAULT NULL,
      category VARCHAR(64) DEFAULT 'general',
      scope VARCHAR(40) DEFAULT 'workspace',
      status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
      current_version INT NOT NULL DEFAULT 1,
      published_version INT DEFAULT NULL,
      trigger_type VARCHAR(80) NOT NULL,
      trigger_config_json ${JSON_COL} DEFAULT NULL,
      graph_json ${JSON_COL} NOT NULL,
      permissions_json ${JSON_COL} DEFAULT NULL,
      max_concurrency INT NOT NULL DEFAULT 25,
      max_iterations INT NOT NULL DEFAULT 100,
      owner_id BIGINT DEFAULT NULL,
      created_by BIGINT DEFAULT NULL,
      updated_by BIGINT DEFAULT NULL,
      published_by BIGINT DEFAULT NULL,
      published_at DATETIME DEFAULT NULL,
      created_at ${DT},
      updated_at ${DT}
    )`,

    // ── 7. Automation Immutable Published Versions ───────────────────────────
    `CREATE TABLE IF NOT EXISTS automation_workflow_versions (
      id ${PK},
      tenant_id BIGINT NOT NULL,
      workflow_id BIGINT NOT NULL,
      version_number INT NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'PUBLISHED',
      trigger_type VARCHAR(80) NOT NULL,
      trigger_config_json ${JSON_COL} DEFAULT NULL,
      graph_json ${JSON_COL} NOT NULL,
      change_summary VARCHAR(255) DEFAULT NULL,
      published_by BIGINT DEFAULT NULL,
      created_at ${DT}
    )`,

    // ── 8. Automation Durable Runs ───────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS automation_workflow_runs (
      id ${PK},
      run_uid VARCHAR(64) NOT NULL,
      tenant_id BIGINT NOT NULL,
      workspace_id BIGINT DEFAULT NULL,
      workflow_id BIGINT NOT NULL,
      workflow_version INT NOT NULL DEFAULT 1,
      parent_run_id BIGINT DEFAULT NULL,
      trigger_event VARCHAR(80) NOT NULL,
      trigger_event_id VARCHAR(191) DEFAULT NULL,
      idempotency_key VARCHAR(191) DEFAULT NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'PENDING',
      current_node_key VARCHAR(120) DEFAULT NULL,
      contact_id BIGINT DEFAULT NULL,
      phone VARCHAR(32) DEFAULT NULL,
      conversation_id BIGINT DEFAULT NULL,
      campaign_id BIGINT DEFAULT NULL,
      sender_id BIGINT DEFAULT NULL,
      lead_id BIGINT DEFAULT NULL,
      deal_id BIGINT DEFAULT NULL,
      order_id VARCHAR(120) DEFAULT NULL,
      context_json ${JSON_COL} DEFAULT NULL,
      completed_nodes_json ${JSON_COL} DEFAULT NULL,
      branch_results_json ${JSON_COL} DEFAULT NULL,
      resume_at DATETIME DEFAULT NULL,
      resume_event VARCHAR(120) DEFAULT NULL,
      wait_timeout_at DATETIME DEFAULT NULL,
      timeout_node_key VARCHAR(120) DEFAULT NULL,
      retry_count INT NOT NULL DEFAULT 0,
      max_retries INT NOT NULL DEFAULT 3,
      next_retry_at DATETIME DEFAULT NULL,
      last_error_category VARCHAR(64) DEFAULT NULL,
      last_error_message TEXT DEFAULT NULL,
      is_test_mode TINYINT NOT NULL DEFAULT 0,
      started_at ${DT},
      completed_at DATETIME DEFAULT NULL,
      updated_at ${DT}
    )`,

    // ── 9. Automation Step Execution Trace (Inspector) ───────────────────────
    `CREATE TABLE IF NOT EXISTS automation_workflow_run_steps (
      id ${PK},
      tenant_id BIGINT NOT NULL,
      run_id BIGINT NOT NULL,
      workflow_id BIGINT NOT NULL,
      node_key VARCHAR(120) NOT NULL,
      node_type VARCHAR(64) NOT NULL,
      branch_id VARCHAR(80) DEFAULT NULL,
      step_idempotency_key VARCHAR(191) DEFAULT NULL,
      attempt_number INT NOT NULL DEFAULT 1,
      status VARCHAR(32) NOT NULL DEFAULT 'COMPLETED',
      input_json ${JSON_COL} DEFAULT NULL,
      output_json ${JSON_COL} DEFAULT NULL,
      error_category VARCHAR(64) DEFAULT NULL,
      error_message TEXT DEFAULT NULL,
      duration_ms INT NOT NULL DEFAULT 0,
      created_at ${DT}
    )`,

    // ── 10. Automation Approval Requests ─────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS automation_workflow_approvals (
      id ${PK},
      tenant_id BIGINT NOT NULL,
      workspace_id BIGINT DEFAULT NULL,
      run_id BIGINT NOT NULL,
      workflow_id BIGINT NOT NULL,
      workflow_version INT NOT NULL DEFAULT 1,
      node_key VARCHAR(120) NOT NULL,
      approval_mode VARCHAR(32) NOT NULL DEFAULT 'single',
      requester_id BIGINT DEFAULT NULL,
      required_approvers_json ${JSON_COL} DEFAULT NULL,
      decisions_json ${JSON_COL} DEFAULT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
      record_ref_type VARCHAR(64) DEFAULT NULL,
      record_ref_id VARCHAR(120) DEFAULT NULL,
      reason TEXT DEFAULT NULL,
      expires_at DATETIME DEFAULT NULL,
      escalate_to_user_id BIGINT DEFAULT NULL,
      decided_by BIGINT DEFAULT NULL,
      decided_at DATETIME DEFAULT NULL,
      created_at ${DT},
      updated_at ${DT}
    )`,

    // ── 11. Automation Dead-Letter Queue ─────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS automation_dead_letters (
      id ${PK},
      tenant_id BIGINT NOT NULL,
      workspace_id BIGINT DEFAULT NULL,
      run_id BIGINT NOT NULL,
      workflow_id BIGINT NOT NULL,
      node_key VARCHAR(120) DEFAULT NULL,
      error_category VARCHAR(64) NOT NULL,
      error_message TEXT NOT NULL,
      payload_json ${JSON_COL} DEFAULT NULL,
      retryable TINYINT NOT NULL DEFAULT 0,
      replay_count INT NOT NULL DEFAULT 0,
      status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
      last_replayed_at DATETIME DEFAULT NULL,
      created_at ${DT}
    )`,

    // ── 12. Shared Event Bus, Outbox & Idempotency ───────────────────────────
    `CREATE TABLE IF NOT EXISTS automation_events (
      id ${PK},
      event_uid VARCHAR(64) NOT NULL,
      tenant_id BIGINT NOT NULL,
      workspace_id BIGINT DEFAULT NULL,
      event_type VARCHAR(80) NOT NULL,
      source VARCHAR(64) NOT NULL DEFAULT 'system',
      idempotency_key VARCHAR(191) DEFAULT NULL,
      contact_id BIGINT DEFAULT NULL,
      phone VARCHAR(32) DEFAULT NULL,
      conversation_id BIGINT DEFAULT NULL,
      campaign_id BIGINT DEFAULT NULL,
      payload_json ${JSON_COL} DEFAULT NULL,
      processed TINYINT NOT NULL DEFAULT 0,
      processed_at DATETIME DEFAULT NULL,
      created_at ${DT}
    )`,

    `CREATE TABLE IF NOT EXISTS event_outbox (
      id ${PK},
      tenant_id BIGINT NOT NULL,
      aggregate_type VARCHAR(64) NOT NULL,
      aggregate_id VARCHAR(120) NOT NULL,
      event_type VARCHAR(80) NOT NULL,
      payload_json ${JSON_COL} NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
      attempts INT NOT NULL DEFAULT 0,
      next_attempt_at DATETIME DEFAULT NULL,
      published_at DATETIME DEFAULT NULL,
      last_error TEXT DEFAULT NULL,
      created_at ${DT}
    )`,

    `CREATE TABLE IF NOT EXISTS execution_idempotency (
      id ${PK},
      tenant_id BIGINT NOT NULL,
      scope VARCHAR(64) NOT NULL,
      idempotency_key VARCHAR(191) NOT NULL,
      result_json ${JSON_COL} DEFAULT NULL,
      created_at ${DT}
    )`,

    // ── 13. CRM Deals & Follow-up Tasks (Shared Business Context) ────────────
    `CREATE TABLE IF NOT EXISTS crm_deals (
      id ${PK},
      tenant_id BIGINT NOT NULL,
      workspace_id BIGINT DEFAULT NULL,
      contact_id BIGINT DEFAULT NULL,
      enquiry_id BIGINT DEFAULT NULL,
      campaign_id BIGINT DEFAULT NULL,
      title VARCHAR(255) NOT NULL,
      stage VARCHAR(64) NOT NULL DEFAULT 'qualified',
      value_minor BIGINT NOT NULL DEFAULT 0,
      currency VARCHAR(10) NOT NULL DEFAULT 'INR',
      assigned_to BIGINT DEFAULT NULL,
      team_id BIGINT DEFAULT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'open',
      metadata_json ${JSON_COL} DEFAULT NULL,
      created_by BIGINT DEFAULT NULL,
      created_at ${DT},
      updated_at ${DT}
    )`,

    `CREATE TABLE IF NOT EXISTS crm_tasks (
      id ${PK},
      tenant_id BIGINT NOT NULL,
      workspace_id BIGINT DEFAULT NULL,
      contact_id BIGINT DEFAULT NULL,
      enquiry_id BIGINT DEFAULT NULL,
      deal_id BIGINT DEFAULT NULL,
      campaign_id BIGINT DEFAULT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT DEFAULT NULL,
      task_type VARCHAR(48) NOT NULL DEFAULT 'follow_up',
      priority VARCHAR(24) NOT NULL DEFAULT 'normal',
      assigned_to BIGINT DEFAULT NULL,
      due_at DATETIME DEFAULT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'open',
      created_by BIGINT DEFAULT NULL,
      created_at ${DT},
      updated_at ${DT}
    )`,

    // ── 14. Tenant-Scoped AI Knowledge Base & Encrypted Integration Creds ────
    `CREATE TABLE IF NOT EXISTS ai_knowledge_articles (
      id ${PK},
      tenant_id BIGINT NOT NULL,
      workspace_id BIGINT DEFAULT NULL,
      category VARCHAR(64) NOT NULL DEFAULT 'faq',
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      tags_json ${JSON_COL} DEFAULT NULL,
      source_url VARCHAR(500) DEFAULT NULL,
      is_active TINYINT NOT NULL DEFAULT 1,
      created_by BIGINT DEFAULT NULL,
      created_at ${DT},
      updated_at ${DT}
    )`,

    `CREATE TABLE IF NOT EXISTS integration_credentials (
      id ${PK},
      tenant_id BIGINT NOT NULL,
      workspace_id BIGINT DEFAULT NULL,
      name VARCHAR(160) NOT NULL,
      provider VARCHAR(64) NOT NULL,
      auth_type VARCHAR(40) NOT NULL DEFAULT 'bearer',
      encrypted_secret TEXT NOT NULL,
      metadata_json ${JSON_COL} DEFAULT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'active',
      last_tested_at DATETIME DEFAULT NULL,
      last_rotated_at DATETIME DEFAULT NULL,
      created_by BIGINT DEFAULT NULL,
      created_at ${DT},
      updated_at ${DT}
    )`,
  ];

  for (const sql of ddl) {
    await db.query(sql);
  }

  // Indexes (idempotent across MySQL & SQLite)
  const indexes = [
    ["idx_wa_sw_tenant_phone", "wa_service_windows", "tenant_id, phone, sender_id"],
    ["idx_fb_trig_tenant_type", "flowbot_triggers", "tenant_id, trigger_type, is_active, priority"],
    ["idx_fb_sess_tenant_phone", "flowbot_sessions", "tenant_id, phone, status"],
    ["idx_fb_sess_wait", "flowbot_sessions", "status, waiting_until"],
    ["idx_fb_steps_sess", "flowbot_execution_steps", "tenant_id, session_id"],
    ["idx_aw_tenant_trigger", "automation_workflows", "tenant_id, trigger_type, status"],
    ["idx_aw_runs_status_resume", "automation_workflow_runs", "status, resume_at"],
    ["idx_aw_runs_tenant_wf", "automation_workflow_runs", "tenant_id, workflow_id, status"],
    ["idx_aw_steps_run", "automation_workflow_run_steps", "tenant_id, run_id"],
    ["idx_aw_approvals_status", "automation_workflow_approvals", "tenant_id, status"],
    ["idx_aw_dlq_tenant", "automation_dead_letters", "tenant_id, status"],
    ["idx_ae_tenant_type", "automation_events", "tenant_id, event_type, processed"],
    ["idx_exec_idem_unique", "execution_idempotency", "tenant_id, scope, idempotency_key"],
    ["idx_crm_deals_tenant", "crm_deals", "tenant_id, contact_id, stage"],
    ["idx_crm_tasks_tenant", "crm_tasks", "tenant_id, assigned_to, status"],
    ["idx_ai_kb_tenant", "ai_knowledge_articles", "tenant_id, is_active, category"],
    ["idx_int_cred_tenant", "integration_credentials", "tenant_id, provider, status"],
  ];

  for (const [name, table, cols] of indexes) {
    try {
      if (isSqlite) {
        const unique = name === "idx_exec_idem_unique" ? "UNIQUE " : "";
        await db.query(`CREATE ${unique}INDEX IF NOT EXISTS ${name} ON ${table} (${cols})`);
      } else {
        const unique = name === "idx_exec_idem_unique" ? "UNIQUE " : "";
        await db.query(`CREATE ${unique}INDEX ${name} ON ${table} (${cols})`);
      }
    } catch (_) {
      // Index already exists on MySQL
    }
  }

  // Ensure wa_flow_versions exists in lightweight/test DBs too
  await db.query(`CREATE TABLE IF NOT EXISTS wa_flow_versions (
    id ${PK},
    flow_id BIGINT NOT NULL,
    tenant_id BIGINT DEFAULT 1,
    version_number INT NOT NULL DEFAULT 1,
    status VARCHAR(32) NOT NULL DEFAULT 'published',
    name VARCHAR(255) DEFAULT NULL,
    trigger_type VARCHAR(64) DEFAULT 'keyword',
    trigger_config ${JSON_COL} DEFAULT NULL,
    entry_node_key VARCHAR(120) DEFAULT 'start',
    nodes_snapshot ${JSON_COL} NOT NULL,
    published_by BIGINT DEFAULT NULL,
    created_at ${DT}
  )`);

  return { migrated: true, tables: ddl.length };
}

module.exports = { migrate };
