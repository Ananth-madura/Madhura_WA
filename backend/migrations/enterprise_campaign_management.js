"use strict";

/**
 * enterprise_campaign_management.js
 *
 * Additive, idempotent schema migration for the Madhura Enterprise Campaign
 * Management System (Campaigns, Versioning, Audiences, Consent/Suppression,
 * Templates, WhatsApp Flows, Flowbot/Automation Bindings, Bulk Execution,
 * Approvals, Budgets, Agency Isolation, Analytics, Attribution & Experiments).
 *
 * Compatible with both MySQL 8+ and SQLite (node:sqlite / local-first runtime).
 */

async function migrate(db) {
  const q = async (sql, params = []) => {
    const res = await db.promise().query(sql, params);
    return Array.isArray(res) ? res[0] : res;
  };
  const pk = db.isSqlite
    ? "INTEGER PRIMARY KEY AUTOINCREMENT"
    : "INT AUTO_INCREMENT PRIMARY KEY";

  const tables = [
    // ── Agency Client Isolation ─────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS campaign_agency_clients (
      id ${pk},
      agency_tenant_id INT NOT NULL,
      client_tenant_id INT NOT NULL,
      client_name VARCHAR(255) NOT NULL,
      brand_logo_url TEXT DEFAULT NULL,
      brand_primary_color VARCHAR(32) DEFAULT NULL,
      brand_domain VARCHAR(255) DEFAULT NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'active',
      permissions_json TEXT DEFAULT NULL,
      created_by INT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (agency_tenant_id, client_tenant_id)
    )`,

    // ── Core Enterprise Campaigns & Versioning ──────────────────────────────
    `CREATE TABLE IF NOT EXISTS campaigns (
      id ${pk},
      campaign_uid VARCHAR(64) NOT NULL,
      tenant_id INT NOT NULL,
      company_id INT DEFAULT NULL,
      workspace_id INT DEFAULT NULL,
      branch_id INT DEFAULT NULL,
      agency_client_id INT DEFAULT NULL,
      team_id INT DEFAULT NULL,
      owner_id INT DEFAULT NULL,
      scope VARCHAR(40) NOT NULL DEFAULT 'workspace',
      name VARCHAR(255) NOT NULL,
      description TEXT DEFAULT NULL,
      objective VARCHAR(64) NOT NULL DEFAULT 'product_promotion',
      campaign_type VARCHAR(64) NOT NULL DEFAULT 'broadcast',
      category VARCHAR(40) NOT NULL DEFAULT 'MARKETING',
      priority INT NOT NULL DEFAULT 5,
      internal_reference VARCHAR(120) DEFAULT NULL,
      tags_json TEXT DEFAULT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
      current_version INT NOT NULL DEFAULT 1,
      approved_version INT DEFAULT NULL,
      approval_status VARCHAR(40) NOT NULL DEFAULT 'not_required',
      provider_route VARCHAR(64) NOT NULL DEFAULT 'whatsapp_cloud_api',
      provider_route_status VARCHAR(80) DEFAULT 'pending_validation',
      waba_id VARCHAR(120) DEFAULT NULL,
      sender_id INT DEFAULT NULL,
      sender_mode VARCHAR(40) NOT NULL DEFAULT 'single',
      template_id INT DEFAULT NULL,
      template_name VARCHAR(255) DEFAULT NULL,
      template_language VARCHAR(20) DEFAULT 'en',
      whatsapp_flow_id INT DEFAULT NULL,
      flowbot_id INT DEFAULT NULL,
      segment_id INT DEFAULT NULL,
      snapshot_id INT DEFAULT NULL,
      reporting_timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
      start_date DATETIME DEFAULT NULL,
      end_date DATETIME DEFAULT NULL,
      scheduled_at DATETIME DEFAULT NULL,
      started_at DATETIME DEFAULT NULL,
      paused_at DATETIME DEFAULT NULL,
      completed_at DATETIME DEFAULT NULL,
      cancelled_at DATETIME DEFAULT NULL,
      pause_reason TEXT DEFAULT NULL,
      cancel_reason TEXT DEFAULT NULL,
      cancelled_by INT DEFAULT NULL,
      max_recipients INT DEFAULT NULL,
      budget_limit_minor INT DEFAULT NULL,
      estimated_cost_minor INT NOT NULL DEFAULT 0,
      confirmed_cost_minor INT NOT NULL DEFAULT 0,
      currency VARCHAR(10) NOT NULL DEFAULT 'INR',
      billing_mode VARCHAR(40) NOT NULL DEFAULT 'direct_meta',
      is_ab_test TINYINT NOT NULL DEFAULT 0,
      is_recurring TINYINT NOT NULL DEFAULT 0,
      is_test_mode TINYINT NOT NULL DEFAULT 0,
      total_matched INT NOT NULL DEFAULT 0,
      total_eligible INT NOT NULL DEFAULT 0,
      total_excluded INT NOT NULL DEFAULT 0,
      submitted_count INT NOT NULL DEFAULT 0,
      delivered_count INT NOT NULL DEFAULT 0,
      read_count INT NOT NULL DEFAULT 0,
      failed_count INT NOT NULL DEFAULT 0,
      reply_count INT NOT NULL DEFAULT 0,
      flow_completed_count INT NOT NULL DEFAULT 0,
      conversion_count INT NOT NULL DEFAULT 0,
      attributed_revenue_minor INT NOT NULL DEFAULT 0,
      config_json TEXT DEFAULT NULL,
      created_by INT DEFAULT NULL,
      updated_by INT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (campaign_uid)
    )`,

    `CREATE TABLE IF NOT EXISTS campaign_versions (
      id ${pk},
      tenant_id INT NOT NULL,
      campaign_id INT NOT NULL,
      version_number INT NOT NULL,
      snapshot_json TEXT NOT NULL,
      change_summary TEXT DEFAULT NULL,
      critical_change TINYINT NOT NULL DEFAULT 0,
      frozen TINYINT NOT NULL DEFAULT 0,
      created_by INT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (campaign_id, version_number)
    )`,

    `CREATE TABLE IF NOT EXISTS campaign_settings (
      id ${pk},
      tenant_id INT NOT NULL,
      workspace_id INT DEFAULT NULL,
      campaign_id INT DEFAULT NULL,
      quiet_hours_enabled TINYINT NOT NULL DEFAULT 0,
      quiet_hours_start VARCHAR(10) DEFAULT '21:00',
      quiet_hours_end VARCHAR(10) DEFAULT '09:00',
      allowed_days_json TEXT DEFAULT NULL,
      holidays_json TEXT DEFAULT NULL,
      max_messages_per_contact_24h INT NOT NULL DEFAULT 2,
      max_marketing_per_contact_7d INT NOT NULL DEFAULT 3,
      repeat_campaign_cooldown_hours INT NOT NULL DEFAULT 24,
      batch_size INT NOT NULL DEFAULT 200,
      rate_limit_per_sec INT NOT NULL DEFAULT 20,
      allow_cloud_fallback TINYINT NOT NULL DEFAULT 0,
      require_four_eyes_approval TINYINT NOT NULL DEFAULT 0,
      approval_threshold_recipients INT NOT NULL DEFAULT 1000,
      approval_threshold_cost_minor INT NOT NULL DEFAULT 50000,
      missing_variable_policy VARCHAR(40) NOT NULL DEFAULT 'exclude',
      default_timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS campaign_senders (
      id ${pk},
      tenant_id INT NOT NULL,
      campaign_id INT NOT NULL,
      sender_id INT NOT NULL,
      waba_id VARCHAR(120) DEFAULT NULL,
      phone_number_id VARCHAR(128) DEFAULT NULL,
      role VARCHAR(40) NOT NULL DEFAULT 'primary',
      allocation_weight INT NOT NULL DEFAULT 100,
      allocation_cap INT DEFAULT NULL,
      routing_rule_json TEXT DEFAULT NULL,
      is_active TINYINT NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // ── Enterprise Approvals & Governance ───────────────────────────────────
    `CREATE TABLE IF NOT EXISTS campaign_approval_rules (
      id ${pk},
      tenant_id INT NOT NULL,
      workspace_id INT DEFAULT NULL,
      name VARCHAR(255) NOT NULL,
      condition_json TEXT NOT NULL,
      stages_json TEXT NOT NULL,
      require_four_eyes TINYINT NOT NULL DEFAULT 1,
      is_active TINYINT NOT NULL DEFAULT 1,
      priority INT NOT NULL DEFAULT 10,
      created_by INT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS campaign_approvals (
      id ${pk},
      tenant_id INT NOT NULL,
      workspace_id INT DEFAULT NULL,
      campaign_id INT NOT NULL,
      campaign_version INT NOT NULL DEFAULT 1,
      stage_index INT NOT NULL DEFAULT 0,
      stage_name VARCHAR(80) NOT NULL DEFAULT 'marketing_approval',
      required_role VARCHAR(64) NOT NULL DEFAULT 'organization_admin',
      status VARCHAR(40) NOT NULL DEFAULT 'PENDING',
      requested_by INT NOT NULL,
      decided_by INT DEFAULT NULL,
      decision_reason TEXT DEFAULT NULL,
      require_four_eyes TINYINT NOT NULL DEFAULT 1,
      invalidated_reason TEXT DEFAULT NULL,
      requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      decided_at DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS campaign_approval_events (
      id ${pk},
      tenant_id INT NOT NULL,
      campaign_id INT NOT NULL,
      approval_id INT NOT NULL,
      campaign_version INT NOT NULL DEFAULT 1,
      actor_id INT NOT NULL,
      action VARCHAR(40) NOT NULL,
      note TEXT DEFAULT NULL,
      diff_json TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS campaign_schedules (
      id ${pk},
      tenant_id INT NOT NULL,
      workspace_id INT DEFAULT NULL,
      campaign_id INT NOT NULL,
      schedule_type VARCHAR(40) NOT NULL DEFAULT 'once',
      timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
      use_recipient_local_time TINYINT NOT NULL DEFAULT 0,
      run_at_utc DATETIME DEFAULT NULL,
      recurrence_rule_json TEXT DEFAULT NULL,
      send_window_start VARCHAR(10) DEFAULT NULL,
      send_window_end VARCHAR(10) DEFAULT NULL,
      next_run_at_utc DATETIME DEFAULT NULL,
      last_run_at_utc DATETIME DEFAULT NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'active',
      created_by INT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS campaign_executions (
      id ${pk},
      execution_uid VARCHAR(64) NOT NULL,
      tenant_id INT NOT NULL,
      workspace_id INT DEFAULT NULL,
      campaign_id INT NOT NULL,
      campaign_version INT NOT NULL DEFAULT 1,
      schedule_id INT DEFAULT NULL,
      snapshot_id INT DEFAULT NULL,
      trigger_type VARCHAR(40) NOT NULL DEFAULT 'manual',
      provider_route VARCHAR(64) NOT NULL DEFAULT 'whatsapp_cloud_api',
      status VARCHAR(40) NOT NULL DEFAULT 'PREPARING',
      total_recipients INT NOT NULL DEFAULT 0,
      queued_count INT NOT NULL DEFAULT 0,
      submitted_count INT NOT NULL DEFAULT 0,
      delivered_count INT NOT NULL DEFAULT 0,
      read_count INT NOT NULL DEFAULT 0,
      failed_count INT NOT NULL DEFAULT 0,
      blocked_count INT NOT NULL DEFAULT 0,
      cancelled_count INT NOT NULL DEFAULT 0,
      started_by INT DEFAULT NULL,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME DEFAULT NULL,
      error_summary TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (execution_uid)
    )`,

    `CREATE TABLE IF NOT EXISTS campaign_execution_events (
      id ${pk},
      tenant_id INT NOT NULL,
      campaign_id INT NOT NULL,
      execution_id INT DEFAULT NULL,
      recipient_id INT DEFAULT NULL,
      event_type VARCHAR(64) NOT NULL,
      severity VARCHAR(20) NOT NULL DEFAULT 'info',
      actor_id INT DEFAULT NULL,
      payload_json TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // ── Audience Segments, Snapshots, Recipients & Imports ──────────────────
    `CREATE TABLE IF NOT EXISTS campaign_segments (
      id ${pk},
      tenant_id INT NOT NULL,
      workspace_id INT DEFAULT NULL,
      agency_client_id INT DEFAULT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT DEFAULT NULL,
      segment_type VARCHAR(30) NOT NULL DEFAULT 'dynamic',
      visibility VARCHAR(30) NOT NULL DEFAULT 'workspace',
      preset_key VARCHAR(64) DEFAULT NULL,
      definition_json TEXT NOT NULL,
      version INT NOT NULL DEFAULT 1,
      estimated_count INT NOT NULL DEFAULT 0,
      last_evaluated_at DATETIME DEFAULT NULL,
      created_by INT DEFAULT NULL,
      updated_by INT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS campaign_segment_versions (
      id ${pk},
      tenant_id INT NOT NULL,
      segment_id INT NOT NULL,
      version INT NOT NULL,
      definition_json TEXT NOT NULL,
      created_by INT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (segment_id, version)
    )`,

    `CREATE TABLE IF NOT EXISTS campaign_audience_snapshots (
      id ${pk},
      tenant_id INT NOT NULL,
      workspace_id INT DEFAULT NULL,
      campaign_id INT DEFAULT NULL,
      segment_id INT DEFAULT NULL,
      segment_version INT DEFAULT NULL,
      query_params_json TEXT DEFAULT NULL,
      total_matched INT NOT NULL DEFAULT 0,
      unique_phones INT NOT NULL DEFAULT 0,
      duplicate_count INT NOT NULL DEFAULT 0,
      invalid_phone_count INT NOT NULL DEFAULT 0,
      missing_variable_count INT NOT NULL DEFAULT 0,
      no_consent_count INT NOT NULL DEFAULT 0,
      opted_out_count INT NOT NULL DEFAULT 0,
      suppressed_count INT NOT NULL DEFAULT 0,
      eligible_count INT NOT NULL DEFAULT 0,
      created_by INT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS campaign_recipients (
      id ${pk},
      tenant_id INT NOT NULL,
      workspace_id INT DEFAULT NULL,
      campaign_id INT NOT NULL,
      execution_id INT DEFAULT NULL,
      snapshot_id INT DEFAULT NULL,
      campaign_version INT NOT NULL DEFAULT 1,
      contact_id INT DEFAULT NULL,
      phone VARCHAR(32) NOT NULL,
      normalized_phone VARCHAR(32) NOT NULL,
      country_code VARCHAR(10) DEFAULT 'IN',
      contact_name VARCHAR(255) DEFAULT NULL,
      sender_id INT DEFAULT NULL,
      waba_id VARCHAR(120) DEFAULT NULL,
      provider_route VARCHAR(64) DEFAULT NULL,
      experiment_id INT DEFAULT NULL,
      variant_id INT DEFAULT NULL,
      consent_id INT DEFAULT NULL,
      consent_evidence_ref VARCHAR(128) DEFAULT NULL,
      rendered_variables_json TEXT DEFAULT NULL,
      rendered_preview TEXT DEFAULT NULL,
      flow_token VARCHAR(128) DEFAULT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
      exclusion_reason VARCHAR(120) DEFAULT NULL,
      error_class VARCHAR(40) DEFAULT NULL,
      error_code VARCHAR(64) DEFAULT NULL,
      error_message TEXT DEFAULT NULL,
      idempotency_key VARCHAR(160) DEFAULT NULL,
      wamid VARCHAR(160) DEFAULT NULL,
      attempts INT NOT NULL DEFAULT 0,
      scheduled_for_utc DATETIME DEFAULT NULL,
      submitted_at DATETIME DEFAULT NULL,
      sent_at DATETIME DEFAULT NULL,
      delivered_at DATETIME DEFAULT NULL,
      read_at DATETIME DEFAULT NULL,
      replied_at DATETIME DEFAULT NULL,
      flow_completed_at DATETIME DEFAULT NULL,
      converted_at DATETIME DEFAULT NULL,
      estimated_cost_minor INT NOT NULL DEFAULT 0,
      confirmed_cost_minor INT NOT NULL DEFAULT 0,
      billing_record_id INT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (idempotency_key)
    )`,

    `CREATE TABLE IF NOT EXISTS campaign_recipient_exclusions (
      id ${pk},
      tenant_id INT NOT NULL,
      campaign_id INT NOT NULL,
      execution_id INT DEFAULT NULL,
      snapshot_id INT DEFAULT NULL,
      contact_id INT DEFAULT NULL,
      phone VARCHAR(32) DEFAULT NULL,
      reason_code VARCHAR(64) NOT NULL,
      reason_detail TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS audience_imports (
      id ${pk},
      tenant_id INT NOT NULL,
      workspace_id INT DEFAULT NULL,
      filename VARCHAR(255) NOT NULL,
      file_type VARCHAR(20) NOT NULL DEFAULT 'csv',
      duplicate_policy VARCHAR(30) NOT NULL DEFAULT 'skip',
      column_mapping_json TEXT DEFAULT NULL,
      consent_mapping_json TEXT DEFAULT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
      total_rows INT NOT NULL DEFAULT 0,
      imported_count INT NOT NULL DEFAULT 0,
      created_count INT NOT NULL DEFAULT 0,
      updated_count INT NOT NULL DEFAULT 0,
      skipped_count INT NOT NULL DEFAULT 0,
      invalid_count INT NOT NULL DEFAULT 0,
      duplicate_count INT NOT NULL DEFAULT 0,
      consent_failed_count INT NOT NULL DEFAULT 0,
      error_count INT NOT NULL DEFAULT 0,
      segment_id INT DEFAULT NULL,
      created_by INT DEFAULT NULL,
      completed_at DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS audience_import_rows (
      id ${pk},
      tenant_id INT NOT NULL,
      import_id INT NOT NULL,
      row_number INT NOT NULL,
      raw_phone VARCHAR(64) DEFAULT NULL,
      normalized_phone VARCHAR(32) DEFAULT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'pending',
      error_code VARCHAR(64) DEFAULT NULL,
      error_message TEXT DEFAULT NULL,
      contact_id INT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // ── Consent, Evidence, Opt-out & Suppression ────────────────────────────
    `CREATE TABLE IF NOT EXISTS contact_consents (
      id ${pk},
      tenant_id INT NOT NULL,
      workspace_id INT DEFAULT NULL,
      contact_id INT DEFAULT NULL,
      normalized_phone VARCHAR(32) NOT NULL,
      purpose VARCHAR(64) NOT NULL DEFAULT 'marketing',
      category VARCHAR(40) NOT NULL DEFAULT 'MARKETING',
      status VARCHAR(30) NOT NULL DEFAULT 'GRANTED',
      source VARCHAR(64) NOT NULL,
      collection_method VARCHAR(64) NOT NULL,
      form_reference TEXT DEFAULT NULL,
      campaign_reference VARCHAR(120) DEFAULT NULL,
      captured_wording TEXT DEFAULT NULL,
      wording_version VARCHAR(40) DEFAULT NULL,
      evidence_ref VARCHAR(128) DEFAULT NULL,
      granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      revoked_at DATETIME DEFAULT NULL,
      updated_by INT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (tenant_id, normalized_phone, purpose)
    )`,

    `CREATE TABLE IF NOT EXISTS consent_evidence (
      id ${pk},
      evidence_uid VARCHAR(64) NOT NULL,
      tenant_id INT NOT NULL,
      consent_id INT NOT NULL,
      evidence_type VARCHAR(64) NOT NULL,
      source_url TEXT DEFAULT NULL,
      ip_hash VARCHAR(64) DEFAULT NULL,
      payload_json TEXT DEFAULT NULL,
      captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by INT DEFAULT NULL,
      UNIQUE (evidence_uid)
    )`,

    `CREATE TABLE IF NOT EXISTS consent_events (
      id ${pk},
      tenant_id INT NOT NULL,
      consent_id INT DEFAULT NULL,
      contact_id INT DEFAULT NULL,
      normalized_phone VARCHAR(32) NOT NULL,
      purpose VARCHAR(64) NOT NULL,
      action VARCHAR(40) NOT NULL,
      source VARCHAR(64) NOT NULL,
      reason TEXT DEFAULT NULL,
      actor_id INT DEFAULT NULL,
      metadata_json TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS suppression_lists (
      id ${pk},
      tenant_id INT NOT NULL,
      workspace_id INT DEFAULT NULL,
      agency_client_id INT DEFAULT NULL,
      name VARCHAR(255) NOT NULL,
      scope VARCHAR(40) NOT NULL DEFAULT 'company',
      category VARCHAR(40) DEFAULT 'ALL',
      description TEXT DEFAULT NULL,
      is_active TINYINT NOT NULL DEFAULT 1,
      created_by INT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS contact_suppressions (
      id ${pk},
      tenant_id INT NOT NULL,
      workspace_id INT DEFAULT NULL,
      agency_client_id INT DEFAULT NULL,
      list_id INT DEFAULT NULL,
      contact_id INT DEFAULT NULL,
      normalized_phone VARCHAR(32) NOT NULL,
      scope VARCHAR(40) NOT NULL DEFAULT 'company',
      category VARCHAR(40) NOT NULL DEFAULT 'ALL',
      reason VARCHAR(120) NOT NULL DEFAULT 'opt_out',
      source VARCHAR(64) NOT NULL DEFAULT 'system',
      is_active TINYINT NOT NULL DEFAULT 1,
      expires_at DATETIME DEFAULT NULL,
      created_by INT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS communication_preferences (
      id ${pk},
      tenant_id INT NOT NULL,
      contact_id INT DEFAULT NULL,
      normalized_phone VARCHAR(32) NOT NULL,
      marketing_enabled TINYINT NOT NULL DEFAULT 0,
      utility_enabled TINYINT NOT NULL DEFAULT 1,
      appointment_enabled TINYINT NOT NULL DEFAULT 1,
      preferred_language VARCHAR(20) DEFAULT 'en',
      timezone VARCHAR(64) DEFAULT NULL,
      quiet_hours_start VARCHAR(10) DEFAULT NULL,
      quiet_hours_end VARCHAR(10) DEFAULT NULL,
      max_messages_per_week INT DEFAULT NULL,
      updated_by INT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (tenant_id, normalized_phone)
    )`,

    `CREATE TABLE IF NOT EXISTS recipient_eligibility_decisions (
      id ${pk},
      tenant_id INT NOT NULL,
      campaign_id INT NOT NULL,
      execution_id INT DEFAULT NULL,
      recipient_id INT DEFAULT NULL,
      normalized_phone VARCHAR(32) NOT NULL,
      stage VARCHAR(40) NOT NULL DEFAULT 'pre_send',
      eligible TINYINT NOT NULL DEFAULT 0,
      decision_code VARCHAR(64) NOT NULL,
      checks_json TEXT DEFAULT NULL,
      decided_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // ── Templates Extensions ────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS whatsapp_template_versions (
      id ${pk},
      tenant_id INT NOT NULL,
      template_id INT NOT NULL,
      version INT NOT NULL DEFAULT 1,
      components_json TEXT NOT NULL,
      category VARCHAR(40) NOT NULL,
      language VARCHAR(20) NOT NULL,
      meta_status VARCHAR(40) NOT NULL DEFAULT 'DRAFT',
      quality_score VARCHAR(40) DEFAULT NULL,
      rejection_reason TEXT DEFAULT NULL,
      created_by INT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS whatsapp_template_sync_logs (
      id ${pk},
      tenant_id INT NOT NULL,
      waba_id VARCHAR(120) NOT NULL,
      sender_id INT DEFAULT NULL,
      synced_count INT NOT NULL DEFAULT 0,
      status VARCHAR(30) NOT NULL DEFAULT 'success',
      error_message TEXT DEFAULT NULL,
      synced_by INT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS whatsapp_template_status_events (
      id ${pk},
      tenant_id INT NOT NULL,
      template_id INT DEFAULT NULL,
      meta_template_id VARCHAR(128) DEFAULT NULL,
      waba_id VARCHAR(120) DEFAULT NULL,
      previous_status VARCHAR(40) DEFAULT NULL,
      new_status VARCHAR(40) NOT NULL,
      previous_category VARCHAR(40) DEFAULT NULL,
      new_category VARCHAR(40) DEFAULT NULL,
      reason TEXT DEFAULT NULL,
      source VARCHAR(40) NOT NULL DEFAULT 'webhook',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS campaign_template_mappings (
      id ${pk},
      tenant_id INT NOT NULL,
      campaign_id INT NOT NULL,
      template_id INT NOT NULL,
      variable_mappings_json TEXT NOT NULL,
      conditional_rules_json TEXT DEFAULT NULL,
      media_asset_id INT DEFAULT NULL,
      tracked_url_config_json TEXT DEFAULT NULL,
      locale_fallback_language VARCHAR(20) DEFAULT 'en',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS campaign_media_assets (
      id ${pk},
      tenant_id INT NOT NULL,
      workspace_id INT DEFAULT NULL,
      name VARCHAR(255) NOT NULL,
      media_type VARCHAR(30) NOT NULL,
      mime_type VARCHAR(100) DEFAULT NULL,
      file_size INT DEFAULT NULL,
      storage_key TEXT DEFAULT NULL,
      public_url TEXT DEFAULT NULL,
      meta_media_id VARCHAR(128) DEFAULT NULL,
      waba_id VARCHAR(120) DEFAULT NULL,
      created_by INT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // ── Meta WhatsApp Flows (Distinct from Madhura Flowbot) ─────────────────
    `CREATE TABLE IF NOT EXISTS whatsapp_flows (
      id ${pk},
      tenant_id INT NOT NULL,
      workspace_id INT DEFAULT NULL,
      waba_id VARCHAR(120) DEFAULT NULL,
      sender_id INT DEFAULT NULL,
      meta_flow_id VARCHAR(128) DEFAULT NULL,
      name VARCHAR(255) NOT NULL,
      category VARCHAR(64) NOT NULL DEFAULT 'LEAD_GENERATION',
      flow_mode VARCHAR(30) NOT NULL DEFAULT 'static',
      json_version VARCHAR(20) NOT NULL DEFAULT '6.0',
      local_version INT NOT NULL DEFAULT 1,
      meta_status VARCHAR(40) NOT NULL DEFAULT 'DRAFT',
      flow_json TEXT NOT NULL,
      data_api_version VARCHAR(20) DEFAULT '3.0',
      endpoint_uri TEXT DEFAULT NULL,
      preview_url TEXT DEFAULT NULL,
      preview_expires_at DATETIME DEFAULT NULL,
      validation_errors_json TEXT DEFAULT NULL,
      previous_flow_id INT DEFAULT NULL,
      published_at DATETIME DEFAULT NULL,
      deprecated_at DATETIME DEFAULT NULL,
      created_by INT DEFAULT NULL,
      updated_by INT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS whatsapp_flow_versions (
      id ${pk},
      tenant_id INT NOT NULL,
      flow_id INT NOT NULL,
      version_number INT NOT NULL,
      json_version VARCHAR(20) NOT NULL DEFAULT '6.0',
      flow_json TEXT NOT NULL,
      meta_status VARCHAR(40) NOT NULL DEFAULT 'DRAFT',
      is_immutable TINYINT NOT NULL DEFAULT 0,
      created_by INT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (flow_id, version_number)
    )`,

    `CREATE TABLE IF NOT EXISTS whatsapp_flow_validations (
      id ${pk},
      tenant_id INT NOT NULL,
      flow_id INT NOT NULL,
      valid TINYINT NOT NULL DEFAULT 0,
      errors_json TEXT DEFAULT NULL,
      warnings_json TEXT DEFAULT NULL,
      source VARCHAR(30) NOT NULL DEFAULT 'local_schema',
      validated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS whatsapp_flow_publications (
      id ${pk},
      tenant_id INT NOT NULL,
      flow_id INT NOT NULL,
      meta_flow_id VARCHAR(128) DEFAULT NULL,
      version_number INT NOT NULL,
      published_by INT DEFAULT NULL,
      meta_response_json TEXT DEFAULT NULL,
      published_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS whatsapp_flow_endpoints (
      id ${pk},
      tenant_id INT NOT NULL,
      waba_id VARCHAR(120) DEFAULT NULL,
      phone_number_id VARCHAR(128) DEFAULT NULL,
      endpoint_uri TEXT NOT NULL,
      public_key_pem TEXT NOT NULL,
      encrypted_private_key_pem TEXT NOT NULL,
      key_fingerprint VARCHAR(128) DEFAULT NULL,
      meta_uploaded TINYINT NOT NULL DEFAULT 0,
      health_status VARCHAR(40) NOT NULL DEFAULT 'unverified',
      last_health_check_at DATETIME DEFAULT NULL,
      created_by INT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS whatsapp_flow_executions (
      id ${pk},
      tenant_id INT NOT NULL,
      flow_id INT NOT NULL,
      meta_flow_id VARCHAR(128) DEFAULT NULL,
      campaign_id INT DEFAULT NULL,
      recipient_id INT DEFAULT NULL,
      contact_id INT DEFAULT NULL,
      normalized_phone VARCHAR(32) DEFAULT NULL,
      flow_token VARCHAR(128) NOT NULL,
      current_screen VARCHAR(120) DEFAULT NULL,
      screens_visited_json TEXT DEFAULT NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'INITIATED',
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME DEFAULT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (flow_token)
    )`,

    `CREATE TABLE IF NOT EXISTS whatsapp_flow_submissions (
      id ${pk},
      tenant_id INT NOT NULL,
      flow_id INT DEFAULT NULL,
      execution_id INT DEFAULT NULL,
      campaign_id INT DEFAULT NULL,
      recipient_id INT DEFAULT NULL,
      contact_id INT DEFAULT NULL,
      normalized_phone VARCHAR(32) NOT NULL,
      flow_token VARCHAR(128) DEFAULT NULL,
      wamid VARCHAR(160) DEFAULT NULL,
      response_payload_json TEXT NOT NULL,
      validation_status VARCHAR(30) NOT NULL DEFAULT 'valid',
      crm_actions_json TEXT DEFAULT NULL,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // ── Flowbot & Automation Campaign Bindings & E-Commerce Triggers ────────
    `CREATE TABLE IF NOT EXISTS campaign_flowbot_bindings (
      id ${pk},
      tenant_id INT NOT NULL,
      campaign_id INT NOT NULL,
      flowbot_id INT NOT NULL,
      trigger_on VARCHAR(64) NOT NULL DEFAULT 'reply',
      handover_rules_json TEXT DEFAULT NULL,
      is_active TINYINT NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS flowbot_conversation_states (
      id ${pk},
      tenant_id INT NOT NULL,
      flowbot_id INT NOT NULL,
      campaign_id INT DEFAULT NULL,
      recipient_id INT DEFAULT NULL,
      contact_id INT DEFAULT NULL,
      normalized_phone VARCHAR(32) NOT NULL,
      current_node_id VARCHAR(120) DEFAULT NULL,
      flow_version INT NOT NULL DEFAULT 1,
      state_status VARCHAR(40) NOT NULL DEFAULT 'ACTIVE',
      collected_answers_json TEXT DEFAULT NULL,
      waiting_condition_json TEXT DEFAULT NULL,
      handover_active TINYINT NOT NULL DEFAULT 0,
      assigned_agent_id INT DEFAULT NULL,
      error_count INT NOT NULL DEFAULT 0,
      last_action_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      timeout_at DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS campaign_automation_bindings (
      id ${pk},
      tenant_id INT NOT NULL,
      campaign_id INT NOT NULL,
      automation_id INT DEFAULT NULL,
      name VARCHAR(255) NOT NULL,
      trigger_event VARCHAR(64) NOT NULL,
      conditions_json TEXT DEFAULT NULL,
      actions_json TEXT NOT NULL,
      stop_conditions_json TEXT DEFAULT NULL,
      reentry_policy VARCHAR(40) NOT NULL DEFAULT 'one_time',
      reentry_cooldown_hours INT NOT NULL DEFAULT 0,
      max_duration_hours INT NOT NULL DEFAULT 720,
      is_active TINYINT NOT NULL DEFAULT 1,
      version INT NOT NULL DEFAULT 1,
      created_by INT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS campaign_journey_enrollments (
      id ${pk},
      tenant_id INT NOT NULL,
      campaign_id INT NOT NULL,
      binding_id INT NOT NULL,
      recipient_id INT DEFAULT NULL,
      contact_id INT DEFAULT NULL,
      normalized_phone VARCHAR(32) NOT NULL,
      source_event_key VARCHAR(160) DEFAULT NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'ACTIVE',
      current_step INT NOT NULL DEFAULT 0,
      stop_reason VARCHAR(120) DEFAULT NULL,
      context_json TEXT DEFAULT NULL,
      next_action_at DATETIME DEFAULT NULL,
      enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME DEFAULT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (binding_id, normalized_phone, source_event_key)
    )`,

    `CREATE TABLE IF NOT EXISTS campaign_ecommerce_events (
      id ${pk},
      tenant_id INT NOT NULL,
      provider VARCHAR(40) NOT NULL,
      event_type VARCHAR(64) NOT NULL,
      idempotency_key VARCHAR(160) NOT NULL,
      external_order_id VARCHAR(128) DEFAULT NULL,
      external_cart_id VARCHAR(128) DEFAULT NULL,
      contact_id INT DEFAULT NULL,
      normalized_phone VARCHAR(32) DEFAULT NULL,
      amount_minor INT DEFAULT NULL,
      currency VARCHAR(10) DEFAULT 'INR',
      payload_json TEXT NOT NULL,
      processed TINYINT NOT NULL DEFAULT 0,
      matched_campaign_id INT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (tenant_id, provider, idempotency_key)
    )`,

    // ── Execution Queue, Attempts, Delivery, Retries, Locks & Idempotency ───
    `CREATE TABLE IF NOT EXISTS campaign_jobs (
      id ${pk},
      job_uid VARCHAR(128) NOT NULL,
      queue_name VARCHAR(64) NOT NULL,
      tenant_id INT NOT NULL,
      workspace_id INT DEFAULT NULL,
      campaign_id INT NOT NULL,
      execution_id INT DEFAULT NULL,
      recipient_id INT DEFAULT NULL,
      sender_id INT DEFAULT NULL,
      waba_id VARCHAR(120) DEFAULT NULL,
      provider_route VARCHAR(64) DEFAULT NULL,
      campaign_version INT NOT NULL DEFAULT 1,
      idempotency_key VARCHAR(160) NOT NULL,
      priority INT NOT NULL DEFAULT 5,
      status VARCHAR(40) NOT NULL DEFAULT 'QUEUED',
      attempts INT NOT NULL DEFAULT 0,
      max_attempts INT NOT NULL DEFAULT 3,
      error_class VARCHAR(40) DEFAULT NULL,
      last_error TEXT DEFAULT NULL,
      payload_json TEXT DEFAULT NULL,
      scheduled_for DATETIME DEFAULT CURRENT_TIMESTAMP,
      started_at DATETIME DEFAULT NULL,
      completed_at DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (idempotency_key)
    )`,

    `CREATE TABLE IF NOT EXISTS campaign_message_attempts (
      id ${pk},
      tenant_id INT NOT NULL,
      campaign_id INT NOT NULL,
      execution_id INT DEFAULT NULL,
      recipient_id INT NOT NULL,
      attempt_number INT NOT NULL DEFAULT 1,
      sender_id INT DEFAULT NULL,
      waba_id VARCHAR(120) DEFAULT NULL,
      provider_route VARCHAR(64) NOT NULL,
      request_payload_json TEXT DEFAULT NULL,
      response_status INT DEFAULT NULL,
      response_payload_json TEXT DEFAULT NULL,
      wamid VARCHAR(160) DEFAULT NULL,
      outcome VARCHAR(50) NOT NULL,
      error_class VARCHAR(40) DEFAULT NULL,
      error_code VARCHAR(64) DEFAULT NULL,
      error_message TEXT DEFAULT NULL,
      latency_ms INT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS campaign_delivery_events (
      id ${pk},
      tenant_id INT NOT NULL,
      campaign_id INT DEFAULT NULL,
      recipient_id INT DEFAULT NULL,
      wamid VARCHAR(160) NOT NULL,
      event_status VARCHAR(40) NOT NULL,
      provider_timestamp DATETIME DEFAULT NULL,
      error_code VARCHAR(64) DEFAULT NULL,
      error_title VARCHAR(255) DEFAULT NULL,
      pricing_json TEXT DEFAULT NULL,
      raw_payload_json TEXT DEFAULT NULL,
      received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (tenant_id, wamid, event_status)
    )`,

    `CREATE TABLE IF NOT EXISTS campaign_retry_records (
      id ${pk},
      tenant_id INT NOT NULL,
      campaign_id INT NOT NULL,
      job_id INT NOT NULL,
      recipient_id INT DEFAULT NULL,
      attempt_number INT NOT NULL,
      error_class VARCHAR(40) NOT NULL,
      backoff_ms INT NOT NULL DEFAULT 0,
      next_retry_at DATETIME DEFAULT NULL,
      reason TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS campaign_execution_locks (
      lock_key VARCHAR(160) PRIMARY KEY,
      tenant_id INT NOT NULL,
      owner_token VARCHAR(128) NOT NULL,
      acquired_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL
    )`,

    `CREATE TABLE IF NOT EXISTS campaign_idempotency_records (
      id ${pk},
      tenant_id INT NOT NULL,
      scope VARCHAR(64) NOT NULL,
      idempotency_key VARCHAR(160) NOT NULL,
      result_json TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (tenant_id, scope, idempotency_key)
    )`,

    // ── Budgets, Spend, Policy & Audit Logs ─────────────────────────────────
    `CREATE TABLE IF NOT EXISTS campaign_budgets (
      id ${pk},
      tenant_id INT NOT NULL,
      workspace_id INT DEFAULT NULL,
      campaign_id INT DEFAULT NULL,
      scope VARCHAR(30) NOT NULL DEFAULT 'campaign',
      max_spend_minor INT DEFAULT NULL,
      max_daily_spend_minor INT DEFAULT NULL,
      max_monthly_spend_minor INT DEFAULT NULL,
      max_recipients INT DEFAULT NULL,
      approval_threshold_minor INT DEFAULT NULL,
      spent_minor INT NOT NULL DEFAULT 0,
      reserved_minor INT NOT NULL DEFAULT 0,
      currency VARCHAR(10) NOT NULL DEFAULT 'INR',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS campaign_spend_records (
      id ${pk},
      tenant_id INT NOT NULL,
      campaign_id INT NOT NULL,
      recipient_id INT DEFAULT NULL,
      billing_mode VARCHAR(40) NOT NULL,
      record_type VARCHAR(40) NOT NULL,
      amount_minor INT NOT NULL DEFAULT 0,
      currency VARCHAR(10) NOT NULL DEFAULT 'INR',
      rate_card_version VARCHAR(64) DEFAULT NULL,
      reference_id VARCHAR(160) DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS campaign_policy_decisions (
      id ${pk},
      tenant_id INT NOT NULL,
      campaign_id INT NOT NULL,
      policy_name VARCHAR(80) NOT NULL,
      outcome VARCHAR(30) NOT NULL,
      details_json TEXT DEFAULT NULL,
      evaluated_by INT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS campaign_audit_logs (
      id ${pk},
      tenant_id INT NOT NULL,
      workspace_id INT DEFAULT NULL,
      campaign_id INT DEFAULT NULL,
      entity_type VARCHAR(64) NOT NULL,
      entity_id VARCHAR(64) DEFAULT NULL,
      action VARCHAR(80) NOT NULL,
      actor_id INT DEFAULT NULL,
      actor_role VARCHAR(64) DEFAULT NULL,
      before_json TEXT DEFAULT NULL,
      after_json TEXT DEFAULT NULL,
      metadata_json TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // ── Analytics, Engagement, Attribution, Conversions, Experiments, Reports
    `CREATE TABLE IF NOT EXISTS campaign_engagement_events (
      id ${pk},
      tenant_id INT NOT NULL,
      campaign_id INT NOT NULL,
      recipient_id INT DEFAULT NULL,
      contact_id INT DEFAULT NULL,
      normalized_phone VARCHAR(32) DEFAULT NULL,
      event_type VARCHAR(50) NOT NULL,
      wamid VARCHAR(160) DEFAULT NULL,
      metadata_json TEXT DEFAULT NULL,
      occurred_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS campaign_tracked_links (
      id ${pk},
      tenant_id INT NOT NULL,
      campaign_id INT NOT NULL,
      recipient_id INT DEFAULT NULL,
      short_code VARCHAR(64) NOT NULL,
      destination_url TEXT NOT NULL,
      utm_json TEXT DEFAULT NULL,
      click_count INT NOT NULL DEFAULT 0,
      last_clicked_at DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (short_code)
    )`,

    `CREATE TABLE IF NOT EXISTS campaign_attributions (
      id ${pk},
      tenant_id INT NOT NULL,
      campaign_id INT NOT NULL,
      recipient_id INT DEFAULT NULL,
      contact_id INT DEFAULT NULL,
      variant_id INT DEFAULT NULL,
      attribution_model VARCHAR(40) NOT NULL DEFAULT 'last_touch',
      attribution_window_hours INT NOT NULL DEFAULT 168,
      source_type VARCHAR(50) NOT NULL,
      source_ref_id VARCHAR(128) NOT NULL,
      evidence_json TEXT DEFAULT NULL,
      attributed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (tenant_id, source_type, source_ref_id)
    )`,

    `CREATE TABLE IF NOT EXISTS campaign_conversions (
      id ${pk},
      tenant_id INT NOT NULL,
      campaign_id INT NOT NULL,
      recipient_id INT DEFAULT NULL,
      contact_id INT DEFAULT NULL,
      attribution_id INT DEFAULT NULL,
      conversion_type VARCHAR(40) NOT NULL,
      entity_type VARCHAR(40) NOT NULL,
      entity_id VARCHAR(128) NOT NULL,
      revenue_minor INT NOT NULL DEFAULT 0,
      currency VARCHAR(10) NOT NULL DEFAULT 'INR',
      verified TINYINT NOT NULL DEFAULT 1,
      evidence_json TEXT DEFAULT NULL,
      converted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (tenant_id, entity_type, entity_id)
    )`,

    `CREATE TABLE IF NOT EXISTS campaign_metrics (
      id ${pk},
      tenant_id INT NOT NULL,
      campaign_id INT NOT NULL,
      metric_date VARCHAR(10) NOT NULL,
      sender_id INT DEFAULT NULL,
      country_code VARCHAR(10) DEFAULT NULL,
      variant_id INT DEFAULT NULL,
      submitted_count INT NOT NULL DEFAULT 0,
      delivered_count INT NOT NULL DEFAULT 0,
      read_count INT NOT NULL DEFAULT 0,
      failed_count INT NOT NULL DEFAULT 0,
      reply_count INT NOT NULL DEFAULT 0,
      click_count INT NOT NULL DEFAULT 0,
      flow_completed_count INT NOT NULL DEFAULT 0,
      opt_out_count INT NOT NULL DEFAULT 0,
      conversion_count INT NOT NULL DEFAULT 0,
      revenue_minor INT NOT NULL DEFAULT 0,
      estimated_cost_minor INT NOT NULL DEFAULT 0,
      confirmed_cost_minor INT NOT NULL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS campaign_experiments (
      id ${pk},
      tenant_id INT NOT NULL,
      campaign_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'DRAFT',
      winning_metric VARCHAR(40) NOT NULL DEFAULT 'reply_rate',
      holdout_pct INT NOT NULL DEFAULT 0,
      min_sample_size INT NOT NULL DEFAULT 100,
      min_observation_hours INT NOT NULL DEFAULT 24,
      confidence_level REAL NOT NULL DEFAULT 0.95,
      winner_variant_id INT DEFAULT NULL,
      winner_reason TEXT DEFAULT NULL,
      started_at DATETIME DEFAULT NULL,
      ended_at DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS campaign_experiment_variants (
      id ${pk},
      tenant_id INT NOT NULL,
      experiment_id INT NOT NULL,
      variant_key VARCHAR(20) NOT NULL,
      name VARCHAR(120) NOT NULL,
      allocation_pct INT NOT NULL DEFAULT 50,
      template_id INT DEFAULT NULL,
      template_name VARCHAR(255) DEFAULT NULL,
      template_language VARCHAR(20) DEFAULT 'en',
      variable_overrides_json TEXT DEFAULT NULL,
      send_delay_minutes INT NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS campaign_experiment_assignments (
      id ${pk},
      tenant_id INT NOT NULL,
      experiment_id INT NOT NULL,
      variant_id INT DEFAULT NULL,
      recipient_id INT NOT NULL,
      normalized_phone VARCHAR(32) NOT NULL,
      is_holdout TINYINT NOT NULL DEFAULT 0,
      assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (experiment_id, recipient_id)
    )`,

    `CREATE TABLE IF NOT EXISTS campaign_custom_reports (
      id ${pk},
      tenant_id INT NOT NULL,
      workspace_id INT DEFAULT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT DEFAULT NULL,
      metrics_json TEXT NOT NULL,
      dimensions_json TEXT NOT NULL,
      filters_json TEXT DEFAULT NULL,
      schedule_cron VARCHAR(64) DEFAULT NULL,
      recipients_json TEXT DEFAULT NULL,
      created_by INT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // ── Platform Admin Operational Controls (Pause Tenant / WABA / Sender) ──
    `CREATE TABLE IF NOT EXISTS campaign_dispatch_controls (
      id ${pk},
      scope_type VARCHAR(30) NOT NULL,
      scope_id VARCHAR(128) NOT NULL,
      is_paused TINYINT NOT NULL DEFAULT 0,
      reason TEXT DEFAULT NULL,
      updated_by INT DEFAULT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (scope_type, scope_id)
    )`,
  ];

  for (const ddl of tables) {
    let sql = ddl;
    if (db.isSqlite) {
      sql = sql.replace(/UNIQUE KEY\s+\w+\s*\(([^)]+)\)/gi, "UNIQUE ($1)");
    }
    await q(sql);
  }

  async function ensureColumn(table, column, typeDef) {
    try {
      const columns = db.isSqlite
        ? await q(`PRAGMA table_info(${table})`)
        : await q(
            `SELECT COLUMN_NAME AS name FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=?`,
            [table]
          );
      const exists = (columns || []).some((c) => (c.name || c.COLUMN_NAME) === column);
      if (!exists) {
        await q(`ALTER TABLE ${table} ADD COLUMN ${column} ${typeDef}`);
      }
    } catch (_) {}
  }

  // Extend waba_connections with Marketing Messages API onboarding state
  await ensureColumn("waba_connections", "marketing_messages_lite_api_status", "VARCHAR(80) DEFAULT 'UNKNOWN'");
  await ensureColumn("waba_connections", "marketing_messages_onboarding_status", "VARCHAR(80) DEFAULT 'UNKNOWN'");
  await ensureColumn("waba_connections", "marketing_messages_terms_accepted", "TINYINT NOT NULL DEFAULT 0");
  await ensureColumn("waba_connections", "marketing_messages_synced_at", "DATETIME DEFAULT NULL");
  await ensureColumn("waba_connections", "agency_client_id", "INT DEFAULT NULL");

  // Extend wa_templates with quality, rejection reason & flow linkage
  await ensureColumn("wa_templates", "tenant_id", "INT DEFAULT NULL");
  await ensureColumn("wa_templates", "waba_id", "VARCHAR(120) DEFAULT NULL");
  await ensureColumn("wa_templates", "sender_id", "INT DEFAULT NULL");
  await ensureColumn("wa_templates", "quality_score", "VARCHAR(40) DEFAULT NULL");
  await ensureColumn("wa_templates", "rejection_reason", "TEXT DEFAULT NULL");
  await ensureColumn("wa_templates", "last_synced_at", "DATETIME DEFAULT NULL");
  await ensureColumn("wa_templates", "archived", "TINYINT NOT NULL DEFAULT 0");

  // Extend wa_senders with pause flag for ops control
  await ensureColumn("wa_senders", "dispatch_paused", "TINYINT NOT NULL DEFAULT 0");
  await ensureColumn("wa_senders", "pause_reason", "TEXT DEFAULT NULL");

  // Indexes (idempotent across MySQL & SQLite)
  const indexes = [
    ["idx_campaigns_tenant_status", "campaigns", "tenant_id, status"],
    ["idx_campaigns_tenant_sched", "campaigns", "tenant_id, scheduled_at"],
    ["idx_campaign_recipients_camp_status", "campaign_recipients", "tenant_id, campaign_id, status"],
    ["idx_campaign_recipients_wamid", "campaign_recipients", "wamid"],
    ["idx_campaign_recipients_phone", "campaign_recipients", "tenant_id, normalized_phone"],
    ["idx_campaign_jobs_queue_status", "campaign_jobs", "queue_name, status, scheduled_for"],
    ["idx_campaign_jobs_tenant_camp", "campaign_jobs", "tenant_id, campaign_id"],
    ["idx_contact_consents_lookup", "contact_consents", "tenant_id, normalized_phone, purpose, status"],
    ["idx_contact_suppressions_lookup", "contact_suppressions", "tenant_id, normalized_phone, is_active"],
    ["idx_flow_executions_camp", "whatsapp_flow_executions", "tenant_id, campaign_id"],
    ["idx_campaign_audit_tenant", "campaign_audit_logs", "tenant_id, campaign_id, created_at"],
    ["idx_campaign_delivery_wamid", "campaign_delivery_events", "wamid"],
  ];

  for (const [idxName, table, cols] of indexes) {
    try {
      if (db.isSqlite) {
        await q(`CREATE INDEX IF NOT EXISTS ${idxName} ON ${table} (${cols})`);
      } else {
        const existing = await q(
          `SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name=? AND index_name=? LIMIT 1`,
          [table, idxName]
        );
        if (!existing || existing.length === 0) {
          await q(`CREATE INDEX ${idxName} ON ${table} (${cols})`);
        }
      }
    } catch (_) {}
  }
}

module.exports = { migrate };
