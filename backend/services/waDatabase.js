const db = require("../config/database");

// Promisify the connection's query since it's a mysql2 connection (not pool)
function queryAsync(sql, params) {
  return new Promise((resolve, reject) => {
    db.query(sql, params || [], (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
}

async function ensureWATables() {
  const tables = [
    `CREATE TABLE IF NOT EXISTS wa_templates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      category VARCHAR(50) DEFAULT 'MARKETING',
      language VARCHAR(10) DEFAULT 'en',
      header_type VARCHAR(50) DEFAULT NULL,
      header_value TEXT DEFAULT NULL,
      body TEXT NOT NULL,
      footer TEXT DEFAULT NULL,
      button_type VARCHAR(50) DEFAULT NULL,
      buttons JSON DEFAULT NULL,
      variables JSON DEFAULT NULL,
      meta_template_id VARCHAR(100) DEFAULT NULL,
      meta_status VARCHAR(50) DEFAULT 'APPROVED',
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS wa_contact_groups (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT DEFAULT NULL,
      total_contacts INT DEFAULT 0,
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS wa_group_contacts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      group_id INT NOT NULL,
      name VARCHAR(255) DEFAULT NULL,
      phone VARCHAR(20) NOT NULL,
      country_code VARCHAR(5) DEFAULT '91',
      notes TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (group_id) REFERENCES wa_contact_groups(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Dedicated WA contacts (distinct from group_contacts — these are your permanent WA contact book)
    `CREATE TABLE IF NOT EXISTS wa_contacts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(20) NOT NULL,
      country_code VARCHAR(5) DEFAULT '91',
      email VARCHAR(255) DEFAULT NULL,
      tags JSON DEFAULT NULL,
      custom_fields JSON DEFAULT NULL,
      opt_in_status TINYINT(1) DEFAULT 1,
      last_contacted DATETIME DEFAULT NULL,
      is_blocked TINYINT(1) DEFAULT 0,
      is_unsubscribed TINYINT(1) DEFAULT 0,
      source VARCHAR(100) DEFAULT NULL,
      crm_ref_type VARCHAR(50) DEFAULT NULL,
      crm_ref_id INT DEFAULT NULL,
      notes TEXT DEFAULT NULL,
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_phone (phone)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Track opt-outs (when user replies STOP / UNSUBSCRIBE)
    `CREATE TABLE IF NOT EXISTS wa_opt_outs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      phone VARCHAR(20) NOT NULL,
      reason VARCHAR(100) DEFAULT 'user_request',
      opt_out_keyword VARCHAR(50) DEFAULT NULL,
      opted_out_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_optout_phone (phone)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Multiple WhatsApp Business account configurations
    `CREATE TABLE IF NOT EXISTS wa_accounts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      account_name VARCHAR(255) NOT NULL,
      phone_number VARCHAR(30) DEFAULT NULL,
      phone_number_id VARCHAR(255) DEFAULT NULL,
      access_token TEXT DEFAULT NULL,
      waba_id VARCHAR(255) DEFAULT NULL,
      app_secret TEXT DEFAULT NULL,
      verify_token VARCHAR(255) DEFAULT 'crm_verify_123',
      business_account_id VARCHAR(255) DEFAULT NULL,
      connection_type ENUM('cloud_api','web_session') DEFAULT 'cloud_api',
      is_active TINYINT(1) DEFAULT 1,
      is_default TINYINT(1) DEFAULT 0,
      quality_rating VARCHAR(20) DEFAULT NULL,
      messaging_limit VARCHAR(50) DEFAULT NULL,
      webhook_url TEXT DEFAULT NULL,
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Automation rules
    `CREATE TABLE IF NOT EXISTS wa_automations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      trigger_type VARCHAR(50) NOT NULL,
      template_id INT DEFAULT NULL,
      message_text TEXT DEFAULT NULL,
      media_type VARCHAR(20) DEFAULT NULL,
      media_url TEXT DEFAULT NULL,
      sequence_delay_seconds INT DEFAULT 7,
      followup_message_text TEXT DEFAULT NULL,
      followup_media_type VARCHAR(20) DEFAULT NULL,
      followup_media_url TEXT DEFAULT NULL,
      followup_template_id INT DEFAULT NULL,
      flow_id INT DEFAULT NULL,
      group_id INT DEFAULT NULL,
      delay_minutes INT DEFAULT 0,
      conditions JSON DEFAULT NULL,
      is_active TINYINT(1) DEFAULT 1,
      run_count INT DEFAULT 0,
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Clickable quick-reply options attached to an automation's message
    `CREATE TABLE IF NOT EXISTS wa_automation_options (
      id INT AUTO_INCREMENT PRIMARY KEY,
      automation_id INT NOT NULL,
      label VARCHAR(255) NOT NULL,
      reply_text TEXT NOT NULL,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (automation_id) REFERENCES wa_automations(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Tracks the most recent menu sent to a phone, so the next inbound
    // message/button-tap can be matched back to its options
    `CREATE TABLE IF NOT EXISTS wa_pending_menus (
      phone VARCHAR(20) PRIMARY KEY,
      automation_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (automation_id) REFERENCES wa_automations(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Automation execution history
    `CREATE TABLE IF NOT EXISTS wa_automation_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      automation_id INT NOT NULL,
      phone VARCHAR(20) NOT NULL,
      contact_name VARCHAR(255) DEFAULT NULL,
      trigger_data JSON DEFAULT NULL,
      status ENUM('sent','failed','skipped') DEFAULT 'sent',
      error TEXT DEFAULT NULL,
      sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (automation_id) REFERENCES wa_automations(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS wa_campaigns (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT DEFAULT NULL,
      type ENUM('text','template','media') DEFAULT 'text',
      template_id INT DEFAULT NULL,
      message_text TEXT DEFAULT NULL,
      media_type VARCHAR(20) DEFAULT NULL,
      media_url TEXT DEFAULT NULL,
      group_id INT DEFAULT NULL,
      whatsapp_number VARCHAR(30) DEFAULT NULL,
      status ENUM('draft','scheduled','running','completed','paused','failed','cancelled') DEFAULT 'draft',
      scheduled_at DATETIME DEFAULT NULL,
      started_at DATETIME DEFAULT NULL,
      completed_at DATETIME DEFAULT NULL,
      total_contacts INT DEFAULT 0,
      sent_count INT DEFAULT 0,
      delivered_count INT DEFAULT 0,
      read_count INT DEFAULT 0,
      failed_count INT DEFAULT 0,
      daily_limit INT DEFAULT 0,
      sent_today INT DEFAULT 0,
      last_sent_date DATE DEFAULT NULL,
      start_time VARCHAR(10) DEFAULT '09:00',
      end_time VARCHAR(10) DEFAULT '21:00',
      timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
      random_delay_min INT DEFAULT 8,
      random_delay_max INT DEFAULT 15,
      pause_every INT DEFAULT 25,
      pause_duration_min INT DEFAULT 120,
      pause_duration_max INT DEFAULT 300,
      retry_failed TINYINT(1) DEFAULT 1,
      max_retries INT DEFAULT 3,
      retry_delay_min INT DEFAULT 15,
      retry_delay_max INT DEFAULT 30,
      exclude_prev_recipients TINYINT(1) DEFAULT 0,
      duplicate_filter TINYINT(1) DEFAULT 1,
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS wa_campaign_messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      campaign_id INT NOT NULL,
      phone VARCHAR(20) NOT NULL,
      contact_name VARCHAR(255) DEFAULT NULL,
      message_text TEXT DEFAULT NULL,
      template_name VARCHAR(255) DEFAULT NULL,
      template_components JSON DEFAULT NULL,
      status ENUM('queued','sending','sent','delivered','read','failed','skipped','opted_out') DEFAULT 'queued',
      wa_message_id VARCHAR(255) DEFAULT NULL,
      error TEXT DEFAULT NULL,
      attempts INT DEFAULT 0,
      next_retry_at DATETIME DEFAULT NULL,
      reply_received TINYINT(1) DEFAULT 0,
      opt_out TINYINT(1) DEFAULT 0,
      scheduled_time DATETIME DEFAULT NULL,
      sent_at DATETIME DEFAULT NULL,
      delivered_at DATETIME DEFAULT NULL,
      read_at DATETIME DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (campaign_id) REFERENCES wa_campaigns(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS wa_message_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      campaign_id INT DEFAULT NULL,
      campaign_message_id INT DEFAULT NULL,
      phone VARCHAR(20) NOT NULL,
      direction ENUM('outbound','inbound') DEFAULT 'outbound',
      message_type ENUM('text','template','media','interactive') DEFAULT 'text',
      message_text TEXT DEFAULT NULL,
      template_name VARCHAR(255) DEFAULT NULL,
      wa_message_id VARCHAR(255) DEFAULT NULL,
      status ENUM('queued','sent','delivered','read','failed') DEFAULT 'queued',
      error TEXT DEFAULT NULL,
      metadata JSON DEFAULT NULL,
      sent_at DATETIME DEFAULT NULL,
      delivered_at DATETIME DEFAULT NULL,
      read_at DATETIME DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS wa_webhook_events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      event_type VARCHAR(100) DEFAULT NULL,
      wa_message_id VARCHAR(255) DEFAULT NULL,
      phone VARCHAR(20) DEFAULT NULL,
      status VARCHAR(50) DEFAULT NULL,
      payload JSON DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // AI knowledge base documents (.txt/.md/.csv/.docx) — extracted text is
    // injected into the AI auto-reply's system prompt as reference context
    `CREATE TABLE IF NOT EXISTS wa_knowledge_base (
      id INT AUTO_INCREMENT PRIMARY KEY,
      filename VARCHAR(255) NOT NULL,
      file_type VARCHAR(20) NOT NULL,
      content LONGTEXT NOT NULL,
      char_count INT DEFAULT 0,
      uploaded_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // AI auto-reply settings (single row, id=1)
    `CREATE TABLE IF NOT EXISTS wa_ai_settings (
      id INT PRIMARY KEY DEFAULT 1,
      enabled TINYINT(1) DEFAULT 0,
      provider VARCHAR(50) DEFAULT 'openrouter',
      model VARCHAR(255) DEFAULT 'meta-llama/llama-3.3-70b-instruct:free',
      api_key TEXT DEFAULT NULL,
      system_prompt TEXT DEFAULT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS user_wa_configs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL UNIQUE,
      phone_number_id VARCHAR(255) NOT NULL,
      access_token TEXT NOT NULL,
      waba_id VARCHAR(255) DEFAULT NULL,
      app_secret TEXT DEFAULT NULL,
      verify_token VARCHAR(255) DEFAULT 'crm_verify_123',
      business_account_id VARCHAR(255) DEFAULT NULL,
      is_enabled TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Welcome Auto-Reply Configuration (single row, id=1)
    `CREATE TABLE IF NOT EXISTS wa_welcome_settings (
      id INT PRIMARY KEY DEFAULT 1,
      enabled TINYINT(1) DEFAULT 1,
      welcome_type ENUM('text','template','ai','buttons') DEFAULT 'text',
      welcome_text TEXT DEFAULT NULL,
      template_id INT DEFAULT NULL,
      cooldown_hours INT DEFAULT 24,
      working_hours_only TINYINT(1) DEFAULT 0,
      start_time VARCHAR(10) DEFAULT '09:00',
      end_time VARCHAR(10) DEFAULT '21:00',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Saved Quick Reply Snippets (/shortcut)
    `CREATE TABLE IF NOT EXISTS wa_quick_replies (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      shortcut VARCHAR(50) NOT NULL,
      message_text TEXT NOT NULL,
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Interactive WhatsApp Reminders & Confirmations (2-way multi-gated)
    `CREATE TABLE IF NOT EXISTS wa_interactive_reminders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      phone VARCHAR(20) NOT NULL,
      contact_name VARCHAR(255) DEFAULT NULL,
      reminder_type VARCHAR(50) NOT NULL,
      reference_table VARCHAR(50) DEFAULT NULL,
      reference_id INT DEFAULT NULL,
      title VARCHAR(255) NOT NULL,
      message_text TEXT NOT NULL,
      options_payload JSON DEFAULT NULL,
      status ENUM('pending', 'sent', 'confirmed', 'rescheduled', 'cancelled', 'paid', 'expired', 'failed') DEFAULT 'pending',
      scheduled_for DATETIME DEFAULT NULL,
      sent_at DATETIME DEFAULT NULL,
      response_received_at DATETIME DEFAULT NULL,
      response_text VARCHAR(255) DEFAULT NULL,
      response_action VARCHAR(50) DEFAULT NULL,
      assigned_staff_name VARCHAR(100) DEFAULT NULL,
      notes TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_phone_status (phone, status),
      INDEX idx_reminder_type (reminder_type),
      INDEX idx_scheduled_for (scheduled_for)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Reminders & Confirmation Global Engine Settings (single row, id=1)
    `CREATE TABLE IF NOT EXISTS wa_reminder_settings (
      id INT PRIMARY KEY DEFAULT 1,
      appointment_reminders_enabled TINYINT(1) DEFAULT 1,
      appointment_reminder_hours_before INT DEFAULT 24,
      payment_due_reminders_enabled TINYINT(1) DEFAULT 1,
      payment_due_days_before INT DEFAULT 1,
      lead_followup_reminders_enabled TINYINT(1) DEFAULT 1,
      amc_renewal_reminders_enabled TINYINT(1) DEFAULT 1,
      amc_renewal_days_before INT DEFAULT 7,
      confirmation_auto_update_crm TINYINT(1) DEFAULT 1,
      notify_staff_on_response TINYINT(1) DEFAULT 1,
      default_confirm_prompt TEXT DEFAULT NULL,
      default_reschedule_prompt TEXT DEFAULT NULL,
      default_cancel_prompt TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Emoji reactions on messages
    `CREATE TABLE IF NOT EXISTS wa_reactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      wa_message_id VARCHAR(255) NOT NULL,
      phone VARCHAR(20) NOT NULL,
      emoji VARCHAR(30) NOT NULL,
      sender_type ENUM('agent','customer') DEFAULT 'agent',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_reaction_msg (wa_message_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Chatbot Visual Flows & State Machine
    `CREATE TABLE IF NOT EXISTS wa_flows (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT DEFAULT NULL,
      status ENUM('draft','active','archived') DEFAULT 'draft',
      trigger_type VARCHAR(50) DEFAULT 'keyword',
      trigger_config JSON DEFAULT NULL,
      entry_node_key VARCHAR(100) DEFAULT 'start',
      fallback_policy JSON DEFAULT NULL,
      execution_count INT DEFAULT 0,
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Flow Nodes (graph steps)
    `CREATE TABLE IF NOT EXISTS wa_flow_nodes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      flow_id INT NOT NULL,
      node_key VARCHAR(100) NOT NULL,
      node_type VARCHAR(50) NOT NULL,
      config JSON DEFAULT NULL,
      position_x FLOAT DEFAULT 0,
      position_y FLOAT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (flow_id) REFERENCES wa_flows(id) ON DELETE CASCADE,
      UNIQUE KEY uq_flow_node (flow_id, node_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Active flow runs per customer
    `CREATE TABLE IF NOT EXISTS wa_flow_runs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      flow_id INT NOT NULL,
      phone VARCHAR(20) NOT NULL,
      contact_name VARCHAR(255) DEFAULT NULL,
      status ENUM('active','completed','handed_off','timed_out','paused_by_agent','failed') DEFAULT 'active',
      current_node_key VARCHAR(100) DEFAULT NULL,
      last_prompt_msg_id VARCHAR(255) DEFAULT NULL,
      vars JSON DEFAULT NULL,
      reprompt_count INT DEFAULT 0,
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_advanced_at DATETIME DEFAULT NULL,
      ended_at DATETIME DEFAULT NULL,
      end_reason VARCHAR(255) DEFAULT NULL,
      FOREIGN KEY (flow_id) REFERENCES wa_flows(id) ON DELETE CASCADE,
      INDEX idx_active_phone_flow (phone, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Flow run execution audit events
    `CREATE TABLE IF NOT EXISTS wa_flow_run_events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      run_id INT NOT NULL,
      node_key VARCHAR(100) DEFAULT NULL,
      event_type VARCHAR(50) DEFAULT NULL,
      payload JSON DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (run_id) REFERENCES wa_flow_runs(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Flow Snapshots & Version History (Draft, Testing, Published, Archived)
    `CREATE TABLE IF NOT EXISTS wa_flow_versions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      flow_id INT NOT NULL,
      version_number INT NOT NULL DEFAULT 1,
      name VARCHAR(255) NOT NULL,
      description TEXT DEFAULT NULL,
      trigger_type VARCHAR(50) DEFAULT 'keyword',
      trigger_config JSON DEFAULT NULL,
      entry_node_key VARCHAR(100) DEFAULT 'start',
      nodes_snapshot JSON NOT NULL,
      status ENUM('draft','testing','published','archived') DEFAULT 'draft',
      changelog TEXT DEFAULT NULL,
      published_at DATETIME DEFAULT NULL,
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (flow_id) REFERENCES wa_flows(id) ON DELETE CASCADE,
      INDEX idx_flow_ver (flow_id, version_number)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Scoped Public API Keys
    `CREATE TABLE IF NOT EXISTS wa_api_keys (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      key_prefix VARCHAR(30) NOT NULL,
      key_hash VARCHAR(100) NOT NULL UNIQUE,
      scopes JSON DEFAULT NULL,
      last_used_at DATETIME DEFAULT NULL,
      expires_at DATETIME DEFAULT NULL,
      revoked_at DATETIME DEFAULT NULL,
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Knowledge Base Chunks (for hybrid / RAG retrieval)
    `CREATE TABLE IF NOT EXISTS wa_knowledge_chunks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      document_id INT NOT NULL,
      chunk_index INT NOT NULL,
      content LONGTEXT NOT NULL,
      char_count INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (document_id) REFERENCES wa_knowledge_base(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Native WhatsApp Payments & Transaction Tracking
    `CREATE TABLE IF NOT EXISTS wa_payments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      phone VARCHAR(20) NOT NULL,
      contact_name VARCHAR(255) DEFAULT NULL,
      amount DECIMAL(10,2) NOT NULL,
      currency VARCHAR(10) DEFAULT 'INR',
      description TEXT DEFAULT NULL,
      payment_link TEXT DEFAULT NULL,
      provider VARCHAR(50) DEFAULT 'razorpay',
      status ENUM('created','pending','paid','failed','expired','cancelled') DEFAULT 'created',
      transaction_id VARCHAR(255) DEFAULT NULL,
      invoice_id INT DEFAULT NULL,
      quotation_id INT DEFAULT NULL,
      created_by INT DEFAULT NULL,
      paid_at DATETIME DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Drip Campaigns & Multi-Day Sequences
    `CREATE TABLE IF NOT EXISTS wa_drip_sequences (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT DEFAULT NULL,
      trigger_type ENUM('new_lead','tag_added','manual','invoice_created','walkin_created') DEFAULT 'manual',
      trigger_config JSON DEFAULT NULL,
      is_active TINYINT(1) DEFAULT 1,
      stop_on_reply TINYINT(1) DEFAULT 1,
      stop_on_payment TINYINT(1) DEFAULT 1,
      total_enrolled INT DEFAULT 0,
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS wa_drip_steps (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sequence_id INT NOT NULL,
      step_number INT NOT NULL,
      delay_days INT DEFAULT 0,
      delay_hours INT DEFAULT 0,
      template_id INT DEFAULT NULL,
      message_text TEXT DEFAULT NULL,
      media_url TEXT DEFAULT NULL,
      media_type VARCHAR(20) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sequence_id) REFERENCES wa_drip_sequences(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS wa_drip_enrollments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sequence_id INT NOT NULL,
      phone VARCHAR(20) NOT NULL,
      contact_name VARCHAR(255) DEFAULT NULL,
      current_step INT DEFAULT 0,
      status ENUM('active','completed','stopped_by_reply','stopped_by_payment','cancelled','failed') DEFAULT 'active',
      next_run_at DATETIME DEFAULT NULL,
      last_executed_at DATETIME DEFAULT NULL,
      enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sequence_id) REFERENCES wa_drip_sequences(id) ON DELETE CASCADE,
      INDEX idx_drip_phone_status (phone, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // 0% Markup Direct Meta Category Ledger
    `CREATE TABLE IF NOT EXISTS wa_meta_ledger (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_key VARCHAR(64) DEFAULT NULL,
      phone VARCHAR(20) NOT NULL,
      category ENUM('MARKETING','UTILITY','AUTHENTICATION','SERVICE') DEFAULT 'SERVICE',
      cost_inr DECIMAL(8,4) DEFAULT 0.0000,
      markup_inr DECIMAL(8,4) DEFAULT 0.0000,
      total_billed_inr DECIMAL(8,4) DEFAULT 0.0000,
      conversation_id VARCHAR(255) DEFAULT NULL,
      wa_message_id VARCHAR(255) DEFAULT NULL,
      campaign_id INT DEFAULT NULL,
      status VARCHAR(50) DEFAULT 'delivered',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Shared Team Inbox Internal Collaboration Notes
    `CREATE TABLE IF NOT EXISTS wa_internal_notes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      phone VARCHAR(20) NOT NULL,
      author_id INT NOT NULL,
      author_name VARCHAR(100) NOT NULL,
      note_text TEXT NOT NULL,
      mentions JSON DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  ];

  for (const sql of tables) {
    try {
      await queryAsync(sql);
    } catch (err) {
      if (!err.message.includes("already exists")) {
        console.error("Error creating WhatsApp table:", err.message);
      }
    }
  }

  // Safe helper to add columns to MySQL tables
  const addColumnIfNotExists = async (table, column, definition) => {
    try {
      const rows = await queryAsync(
        "SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
        [table, column]
      );
      if (!rows || rows.length === 0) {
        await queryAsync(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
      }
    } catch (err) {
      if (!err.message.includes("Duplicate column") && !err.message.includes("already exists")) {
        console.warn(`⚠️ Warning adding ${table}.${column}:`, err.message);
      }
    }
  };

  const addIndexIfNotExists = async (table, indexName, columnsSql) => {
    try {
      const rows = await queryAsync(
        "SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?",
        [table, indexName]
      );
      if (!rows || rows.length === 0) {
        await queryAsync(`ALTER TABLE \`${table}\` ADD INDEX \`${indexName}\` (${columnsSql})`);
      }
    } catch (err) {
      if (!err.message.includes("Duplicate key") && !err.message.includes("already exists")) {
        console.warn(`⚠️ Warning adding index ${table}.${indexName}:`, err.message);
      }
    }
  };

  // 1. wa_automations column additions & type changes
  try { await queryAsync("ALTER TABLE wa_automations MODIFY COLUMN trigger_type VARCHAR(100) NOT NULL"); } catch (_) {}
  // wa_welcome_settings: native interactive welcome menu
  // 'buttons' lets the welcome auto-reply send real tappable WhatsApp reply
  // buttons instead of a "reply with 1/2/3" text menu. welcome_buttons holds
  // [{id,title}] — the id is the stable action key, never the shown title.
  try { await queryAsync("ALTER TABLE wa_welcome_settings MODIFY COLUMN welcome_type ENUM('text','template','ai','buttons') DEFAULT 'text'"); } catch (_) {}
  await addColumnIfNotExists("wa_welcome_settings", "welcome_buttons", "TEXT DEFAULT NULL");
  await addColumnIfNotExists("wa_welcome_settings", "welcome_footer", "VARCHAR(60) DEFAULT NULL");

  await addColumnIfNotExists("wa_automations", "media_type", "VARCHAR(20) DEFAULT NULL");
  await addColumnIfNotExists("wa_automations", "media_url", "TEXT DEFAULT NULL");
  await addColumnIfNotExists("wa_automations", "sequence_delay_seconds", "INT DEFAULT 7");
  await addColumnIfNotExists("wa_automations", "followup_message_text", "TEXT DEFAULT NULL");
  await addColumnIfNotExists("wa_automations", "followup_media_type", "VARCHAR(20) DEFAULT NULL");
  await addColumnIfNotExists("wa_automations", "followup_media_url", "TEXT DEFAULT NULL");
  await addColumnIfNotExists("wa_automations", "followup_template_id", "INT DEFAULT NULL");
  await addColumnIfNotExists("wa_automations", "flow_id", "INT DEFAULT NULL");
  await addColumnIfNotExists("wa_automations", "group_id", "INT DEFAULT NULL");

  // 1b. Durable delayed automations: a rule with delay_minutes used to live only
  // in an in-process setTimeout, so a restart lost it silently. The row now
  // carries its own due time and the sweeper picks up anything the timer missed.
  await addColumnIfNotExists("wa_automation_logs", "scheduled_for", "DATETIME DEFAULT NULL");
  try {
    await queryAsync("ALTER TABLE wa_automation_logs MODIFY COLUMN status ENUM('scheduled','sending','sent','failed','skipped') DEFAULT 'sent'");
  } catch (_) {}
  await addIndexIfNotExists("wa_automation_logs", "idx_wa_autolog_due", "status, scheduled_for");

  // 2. wa_campaigns column additions
  await addColumnIfNotExists("wa_campaigns", "whatsapp_number", "VARCHAR(30) DEFAULT NULL");
  await addColumnIfNotExists("wa_campaigns", "daily_limit", "INT DEFAULT 0");
  await addColumnIfNotExists("wa_campaigns", "sent_today", "INT DEFAULT 0");
  await addColumnIfNotExists("wa_campaigns", "last_sent_date", "DATE DEFAULT NULL");
  await addColumnIfNotExists("wa_campaigns", "start_time", "VARCHAR(10) DEFAULT '09:00'");
  await addColumnIfNotExists("wa_campaigns", "end_time", "VARCHAR(10) DEFAULT '21:00'");
  await addColumnIfNotExists("wa_campaigns", "timezone", "VARCHAR(50) DEFAULT 'Asia/Kolkata'");
  await addColumnIfNotExists("wa_campaigns", "random_delay_min", "INT DEFAULT 7");
  await addColumnIfNotExists("wa_campaigns", "random_delay_max", "INT DEFAULT 12");
  await addColumnIfNotExists("wa_campaigns", "pause_every", "INT DEFAULT 25");
  await addColumnIfNotExists("wa_campaigns", "pause_duration_min", "INT DEFAULT 120");
  await addColumnIfNotExists("wa_campaigns", "pause_duration_max", "INT DEFAULT 300");
  await addColumnIfNotExists("wa_campaigns", "retry_failed", "TINYINT(1) DEFAULT 1");
  await addColumnIfNotExists("wa_campaigns", "max_retries", "INT DEFAULT 3");
  await addColumnIfNotExists("wa_campaigns", "retry_delay_min", "INT DEFAULT 15");
  await addColumnIfNotExists("wa_campaigns", "retry_delay_max", "INT DEFAULT 30");
  await addColumnIfNotExists("wa_campaigns", "exclude_prev_recipients", "TINYINT(1) DEFAULT 0");
  await addColumnIfNotExists("wa_campaigns", "duplicate_filter", "TINYINT(1) DEFAULT 1");
  await addColumnIfNotExists("wa_campaigns", "session_key", "VARCHAR(64) DEFAULT NULL");
  await addColumnIfNotExists("wa_campaigns", "flow_id", "INT DEFAULT NULL");
  await addColumnIfNotExists("wa_interactive_reminders", "flow_id", "INT DEFAULT NULL");
  await addColumnIfNotExists("wa_interactive_reminders", "template_id", "INT DEFAULT NULL");
  try {
    await queryAsync("ALTER TABLE wa_campaigns MODIFY COLUMN status ENUM('draft','scheduled','running','completed','paused','failed','cancelled') DEFAULT 'draft'");
  } catch (_) {}

  // 3. wa_campaign_messages column additions
  await addColumnIfNotExists("wa_campaign_messages", "attempts", "INT DEFAULT 0");
  await addColumnIfNotExists("wa_campaign_messages", "next_retry_at", "DATETIME DEFAULT NULL");
  await addColumnIfNotExists("wa_campaign_messages", "reply_received", "TINYINT(1) DEFAULT 0");
  await addColumnIfNotExists("wa_campaign_messages", "opt_out", "TINYINT(1) DEFAULT 0");
  await addColumnIfNotExists("wa_campaign_messages", "scheduled_time", "DATETIME DEFAULT NULL");
  await addColumnIfNotExists("wa_campaign_messages", "media_type", "VARCHAR(20) DEFAULT NULL");
  await addColumnIfNotExists("wa_campaign_messages", "media_url", "TEXT DEFAULT NULL");
  await addColumnIfNotExists("wa_campaign_messages", "location_lat", "DOUBLE DEFAULT NULL");
  await addColumnIfNotExists("wa_campaign_messages", "location_lng", "DOUBLE DEFAULT NULL");
  await addColumnIfNotExists("wa_campaign_messages", "location_name", "VARCHAR(255) DEFAULT NULL");
  await addColumnIfNotExists("wa_campaign_messages", "location_address", "VARCHAR(500) DEFAULT NULL");

  // 4. CRM reminder dedupe flags
  await addColumnIfNotExists("clientinvoices", "wa_payment_due_sent", "TINYINT(1) DEFAULT 0");
  await addColumnIfNotExists("telecalls", "wa_followup_sent_date", "DATE DEFAULT NULL");
  await addColumnIfNotExists("walkins", "wa_followup_sent_date", "DATE DEFAULT NULL");
  await addColumnIfNotExists("fields", "wa_followup_sent_date", "DATE DEFAULT NULL");

  // 5. wa_message_logs column additions & indexes
  await addColumnIfNotExists("wa_message_logs", "session_key", "VARCHAR(64) DEFAULT NULL");
  await addColumnIfNotExists("wa_message_logs", "reply_to_message_id", "VARCHAR(255) DEFAULT NULL");
  await addColumnIfNotExists("wa_message_logs", "interactive_reply_id", "VARCHAR(100) DEFAULT NULL");
  await addColumnIfNotExists("wa_message_logs", "interactive_payload", "JSON DEFAULT NULL");
  await addColumnIfNotExists("wa_message_logs", "media_mime_type", "VARCHAR(100) DEFAULT NULL");
  await addColumnIfNotExists("wa_message_logs", "media_size", "INT DEFAULT NULL");
  await addColumnIfNotExists("wa_message_logs", "has_media", "TINYINT(1) DEFAULT 0");
  await addColumnIfNotExists("wa_message_logs", "is_read", "TINYINT(1) DEFAULT 0");
  await addColumnIfNotExists("wa_message_logs", "is_starred", "TINYINT(1) DEFAULT 0");
  await addColumnIfNotExists("wa_message_logs", "assigned_agent_id", "INT DEFAULT NULL");
  await addColumnIfNotExists("wa_message_logs", "is_internal", "TINYINT(1) DEFAULT 0");
  await addColumnIfNotExists("wa_message_logs", "author_name", "VARCHAR(100) DEFAULT NULL");
  await addColumnIfNotExists("wa_message_logs", "conversation_category", "ENUM('MARKETING','UTILITY','AUTHENTICATION','SERVICE') DEFAULT 'SERVICE'");
  await addColumnIfNotExists("wa_message_logs", "cost_inr", "DECIMAL(8,4) DEFAULT 0.0000");
  await addColumnIfNotExists("wa_message_logs", "markup_inr", "DECIMAL(8,4) DEFAULT 0.0000");
  try { await queryAsync("ALTER TABLE wa_message_logs MODIFY COLUMN message_type VARCHAR(20) DEFAULT 'text'"); } catch (_) {}
  await addIndexIfNotExists("wa_message_logs", "idx_session_phone", "session_key, phone");

  // 6. wa_contacts column additions
  await addColumnIfNotExists("wa_contacts", "ai_enabled", "TINYINT(1) DEFAULT 1");
  await addColumnIfNotExists("wa_contacts", "ai_paused_until", "DATETIME DEFAULT NULL");
  await addColumnIfNotExists("wa_contacts", "ai_reply_count", "INT DEFAULT 0");
  await addColumnIfNotExists("wa_contacts", "ai_autoreply_disabled", "TINYINT(1) DEFAULT 0");
  await addColumnIfNotExists("wa_contacts", "assigned_agent_id", "INT DEFAULT NULL");
  await addColumnIfNotExists("wa_contacts", "assigned_agent_name", "VARCHAR(100) DEFAULT NULL");
  await addColumnIfNotExists("wa_contacts", "ticket_status", "ENUM('open','pending','resolved','spam') DEFAULT 'open'");
  await addColumnIfNotExists("wa_contacts", "last_message_text", "TEXT DEFAULT NULL");
  await addColumnIfNotExists("wa_contacts", "last_message_at", "DATETIME DEFAULT NULL");
  await addColumnIfNotExists("wa_contacts", "unread_count", "INT DEFAULT 0");
  await addColumnIfNotExists("wa_contacts", "profile_pic_url", "TEXT DEFAULT NULL");
  await addColumnIfNotExists("wa_contacts", "avatar_url", "TEXT DEFAULT NULL");

  // 7. wa_flows trigger_type
  try { await queryAsync("ALTER TABLE wa_flows MODIFY COLUMN trigger_type VARCHAR(50) DEFAULT 'keyword'"); } catch (_) {}

  // 8. wa_ai_settings column additions
  await addColumnIfNotExists("wa_ai_settings", "provider", "VARCHAR(50) DEFAULT 'openrouter'");
  await addColumnIfNotExists("wa_ai_settings", "custom_api_url", "VARCHAR(255) DEFAULT NULL");
  await addColumnIfNotExists("wa_ai_settings", "auto_lead_capture", "TINYINT(1) DEFAULT 1");
  await addColumnIfNotExists("wa_ai_settings", "human_handoff_keywords", "VARCHAR(255) DEFAULT 'human, agent, executive, support, speak to person, call me'");
  await addColumnIfNotExists("wa_ai_settings", "handoff_cooldown_min", "INT DEFAULT 180");
  await addColumnIfNotExists("wa_ai_settings", "typing_delay_sec", "INT DEFAULT 2");
  await addColumnIfNotExists("wa_ai_settings", "temperature", "DECIMAL(3,2) DEFAULT 0.70");
  await addColumnIfNotExists("wa_ai_settings", "max_tokens", "INT DEFAULT 350");
  await addColumnIfNotExists("wa_ai_settings", "working_hours_only", "TINYINT(1) DEFAULT 0");
  await addColumnIfNotExists("wa_ai_settings", "work_start_time", "VARCHAR(10) DEFAULT '09:00'");
  await addColumnIfNotExists("wa_ai_settings", "work_end_time", "VARCHAR(10) DEFAULT '20:00'");
  await addColumnIfNotExists("wa_ai_settings", "fallback_message", "TEXT DEFAULT NULL");
  await addColumnIfNotExists("wa_ai_settings", "enable_crm_tools", "TINYINT(1) DEFAULT 1");

  // 9. wa_automation_options column additions
  await addColumnIfNotExists("wa_automation_options", "action_type", "VARCHAR(50) DEFAULT 'reply_text'");
  await addColumnIfNotExists("wa_automation_options", "action_payload", "JSON DEFAULT NULL");
  await addColumnIfNotExists("wa_automation_options", "next_step_text", "TEXT DEFAULT NULL");

  // 10. Multi-Tenant SaaS, Load Balancer & Anti-Ban Architecture Tables & Columns
  const multiTenantTables = [
    `CREATE TABLE IF NOT EXISTS wa_sender_pools (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT DEFAULT 1,
      pool_name VARCHAR(255) NOT NULL,
      routing_strategy ENUM('round_robin', 'least_loaded', 'weighted', 'health_scored', 'cloud_first') DEFAULT 'round_robin',
      is_active TINYINT(1) DEFAULT 1,
      description TEXT DEFAULT NULL,
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_tenant (tenant_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS wa_sender_pool_members (
      id INT AUTO_INCREMENT PRIMARY KEY,
      pool_id INT NOT NULL,
      tenant_id INT DEFAULT 1,
      account_id INT DEFAULT NULL,
      session_key VARCHAR(100) DEFAULT NULL,
      phone_number VARCHAR(30) NOT NULL,
      sender_type ENUM('cloud_api', 'web_session') DEFAULT 'web_session',
      weight INT DEFAULT 1,
      daily_limit INT DEFAULT 1000,
      hourly_limit INT DEFAULT 150,
      sent_today INT DEFAULT 0,
      sent_this_hour INT DEFAULT 0,
      last_sent_date DATE DEFAULT NULL,
      last_sent_hour INT DEFAULT NULL,
      consecutive_errors INT DEFAULT 0,
      in_cooldown_until DATETIME DEFAULT NULL,
      health_status ENUM('healthy', 'warning', 'cooldown', 'offline') DEFAULT 'healthy',
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (pool_id) REFERENCES wa_sender_pools(id) ON DELETE CASCADE,
      INDEX idx_pool (pool_id),
      INDEX idx_tenant (tenant_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS wa_anti_ban_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT DEFAULT 1,
      user_id INT DEFAULT NULL,
      warmup_enabled TINYINT(1) DEFAULT 1,
      warmup_start_date DATE DEFAULT NULL,
      min_delay_sec INT DEFAULT 8,
      max_delay_sec INT DEFAULT 20,
      pause_every_messages INT DEFAULT 30,
      pause_duration_sec INT DEFAULT 180,
      daily_limit INT DEFAULT 1000,
      hourly_limit INT DEFAULT 150,
      spintax_enabled TINYINT(1) DEFAULT 1,
      opt_out_auto_detect TINYINT(1) DEFAULT 1,
      working_hours_enabled TINYINT(1) DEFAULT 1,
      start_time VARCHAR(10) DEFAULT '09:00',
      end_time VARCHAR(10) DEFAULT '20:00',
      timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_tenant_user (tenant_id, user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  ];

  for (const tbl of multiTenantTables) {
    try {
      await queryAsync(tbl);
    } catch (e) {
      console.warn("⚠️ Pool table warning:", e.message);
    }
  }

  // Multi-Tenant Isolation column upgrades across all WhatsApp tables
  const tenantScopedTables = [
    "wa_campaigns", "wa_campaign_messages", "wa_accounts", "wa_contacts",
    "wa_opt_outs", "wa_message_logs", "wa_templates", "wa_contact_groups",
    "wa_automations", "wa_interactive_reminders", "wa_flows"
  ];
  for (const tbl of tenantScopedTables) {
    await addColumnIfNotExists(tbl, "tenant_id", "INT DEFAULT 1");
    await addIndexIfNotExists(tbl, `idx_${tbl}_tenant`, "tenant_id");
  }

  // Load balancing & Anti-ban columns on campaigns & message logs
  await addColumnIfNotExists("wa_campaigns", "pool_id", "INT DEFAULT NULL");
  await addColumnIfNotExists("wa_campaigns", "routing_strategy", "VARCHAR(50) DEFAULT 'round_robin'");
  await addColumnIfNotExists("wa_campaigns", "spintax_enabled", "TINYINT(1) DEFAULT 1");
  await addColumnIfNotExists("wa_campaigns", "warmup_mode", "TINYINT(1) DEFAULT 0");

  await addColumnIfNotExists("wa_campaign_messages", "sender_phone", "VARCHAR(30) DEFAULT NULL");
  await addColumnIfNotExists("wa_campaign_messages", "sender_account_id", "INT DEFAULT NULL");
  await addColumnIfNotExists("wa_campaign_messages", "pool_id", "INT DEFAULT NULL");

  await addColumnIfNotExists("wa_message_logs", "sender_phone", "VARCHAR(30) DEFAULT NULL");
  await addColumnIfNotExists("wa_message_logs", "sender_account_id", "INT DEFAULT NULL");
  await addColumnIfNotExists("wa_message_logs", "pool_id", "INT DEFAULT NULL");
  await addColumnIfNotExists("wa_message_logs", "tenant_id", "INT DEFAULT 1");

  // Performance Indexes for Instant (<5ms) Chat & Message Loading
  await addIndexIfNotExists("wa_message_logs", "idx_msg_phone_time", "phone, created_at");
  await addIndexIfNotExists("wa_message_logs", "idx_msg_session_time", "session_key, created_at");
  await addIndexIfNotExists("wa_contacts", "idx_contact_phone", "phone");
  await addIndexIfNotExists("wa_contacts", "idx_contact_last_msg", "last_message_at");

  // ── Seed Prebuilt Templates, Reminders and Automation Rules ───────────────────────────
  try {
    const reminderSettingsCount = await queryAsync("SELECT COUNT(*) as count FROM wa_reminder_settings");
    if (reminderSettingsCount[0].count === 0) {
      await queryAsync(
        `INSERT INTO wa_reminder_settings (
          id, appointment_reminders_enabled, appointment_reminder_hours_before,
          payment_due_reminders_enabled, payment_due_days_before,
          lead_followup_reminders_enabled, amc_renewal_reminders_enabled, amc_renewal_days_before,
          confirmation_auto_update_crm, notify_staff_on_response,
          default_confirm_prompt, default_reschedule_prompt, default_cancel_prompt
        ) VALUES (
          1, 1, 24, 1, 1, 1, 1, 7, 1, 1,
          '🎉 Thank you {name}! Your appointment has been CONFIRMED for {date} at {time}. Our executive will be on time.',
          'We understand! When would you like to reschedule your visit? Reply with your preferred date/time or reply CALL ME to speak with our support team.',
          'Your appointment has been CANCELLED as requested. If you need any assistance in the future, feel free to message us anytime!'
        )`
      );
      console.log("✅ Seeded default WhatsApp Reminder & Confirmation settings");
    }
    const templatesCount = await queryAsync("SELECT COUNT(*) as count FROM wa_templates");
    if (templatesCount[0].count === 0) {
      const defaultTemplates = [
        ["welcome_greeting", "UTILITY", "en", "Welcome to Madhura Tech", "Hello {name}! Welcome to Madhura Tech. We are delighted to assist you. Feel free to reply anytime!", "Thank you, Team Madhura Tech", "APPROVED"],
        ["new_lead_acknowledgement", "MARKETING", "en", "Inquiry Received", "Hi {name}, thank you for reaching out to us! Our team received your inquiry for {service}. We will connect with you shortly.", "Madhura Tech Sales", "APPROVED"],
        ["invoice_generated_notice", "UTILITY", "en", "Invoice Notice", "Hello {name}, your invoice {invoice_no} for amount {amount} has been generated. Due date: {due_date}. Thank you for choosing Madhura Tech!", "Madhura Tech Billing", "APPROVED"],
        ["payment_received_receipt", "UTILITY", "en", "Payment Received", "Dear {name}, we received your payment of {amount} for invoice {invoice_no} on {date}. Thank you for your prompt payment!", "Madhura Tech Accounts", "APPROVED"],
        ["payment_due_reminder_notice", "UTILITY", "en", "Payment Due Reminder", "Hi {name}, gentle reminder that payment for invoice {invoice_no} (amount {amount}) is due on {due_date}. Please reply if you need help.", "Madhura Tech Accounts", "APPROVED"],
        ["quotation_proposal_notice", "MARKETING", "en", "Proposal & Quotation", "Hello {name}, here is your quotation for {service} with total estimate {amount}. Let us know if you have any questions!", "Madhura Tech Business", "APPROVED"],
        ["amc_service_due_reminder", "UTILITY", "en", "AMC Service Due", "Hi {name}, your AMC service for {service} is due on {date}. Our technical team will visit your location shortly.", "Madhura Tech Support", "APPROVED"],
        ["walkin_appointment_reminder", "UTILITY", "en", "Appointment Reminder", "Hi {name}, reminder for your upcoming visit/appointment with Madhura Tech on {date}. Reply CONFIRM to confirm or RESCHEDULE.", "Madhura Tech Desk", "APPROVED"],
        ["birthday_wishes_discount", "MARKETING", "en", "Happy Birthday!", "🎉 Happy Birthday {name}! Wishing you a wonderful year ahead. Enjoy 15% off on your next service with Madhura Tech!", "Special Gift", "APPROVED"],
        ["service_ticket_feedback", "UTILITY", "en", "Support Feedback", "Hello {name}, your support request for {service} has been resolved. We would love your feedback!", "Madhura Tech Care", "APPROVED"],
      ];

      for (const t of defaultTemplates) {
        await queryAsync(
          `INSERT INTO wa_templates (name, category, language, header_value, body, footer, meta_status) VALUES (?,?,?,?,?,?,?)`,
          t
        );
      }
      console.log("✅ Seeded 10 universal WhatsApp template presets");
    }

    const automationsCount = await queryAsync("SELECT COUNT(*) as count FROM wa_automations");
    if (automationsCount[0].count === 0) {
      const defaultAutomations = [
        ["Auto Welcome New Leads", "new_lead", "Hi {name}! Thank you for your inquiry regarding {service}. Our representative will contact you shortly!", 0, 0],
        ["Instant Invoice WhatsApp Notice", "invoice_created", "Hello {name}, your invoice {invoice_no} for {amount} has been generated. Due Date: {due_date}. Thank you!", 0, 0],
        ["Payment Receipt Acknowledgement", "payment_received", "Dear {name}, thank you! We received your payment of {amount} for invoice {invoice_no} on {date}.", 0, 0],
        ["New Client Welcome Onboarding", "welcome_message", "Welcome to Madhura Tech, {name}! We are excited to work with {company}. Let us know if you have any questions.", 0, 0],
        ["Payment Due 1-Day Reminder", "payment_due", "Hi {name}, friendly reminder that payment for invoice {invoice_no} ({amount}) is due on {due_date}.", 0, 0],
        ["Lead Follow-Up Nudge", "lead_followup", "Hi {name}, following up regarding your interest in {service}. Let us know if you'd like a quick demo or call!", 0, 0],
      ];

      for (const a of defaultAutomations) {
        await queryAsync(
          `INSERT INTO wa_automations (name, trigger_type, message_text, delay_minutes, is_active) VALUES (?,?,?,?,?)`,
          a
        );
      }
      console.log("✅ Seeded 6 prebuilt WhatsApp automation rules (disabled by default for user safety)");
    }

    const welcomeSettingsCount = await queryAsync("SELECT COUNT(*) as count FROM wa_welcome_settings");
    if (welcomeSettingsCount[0].count === 0) {
      await queryAsync(
        `INSERT INTO wa_welcome_settings (id, enabled, welcome_type, welcome_text, cooldown_hours)
         VALUES (1, 0, 'text', 'Hello {name}! Welcome to Madhura Tech. Thank you for reaching out to us. How can we help you today?', 24)`
      );
      console.log("✅ Seeded default Welcome Auto-Reply settings (disabled by default)");
    }

    // ── Safe Rebranding Data Migration: Update any existing rows containing 'ACHME' / 'Achme' ──
    try {
      await queryAsync(
        `UPDATE wa_welcome_settings
         SET welcome_text = REPLACE(REPLACE(welcome_text, 'ACHME', 'Madhura Tech'), 'Achme', 'Madhura Tech')
         WHERE welcome_text LIKE '%ACHME%' OR welcome_text LIKE '%Achme%'`
      );
      await queryAsync(
        `UPDATE wa_templates
         SET header_value = REPLACE(REPLACE(header_value, 'ACHME', 'Madhura Tech'), 'Achme', 'Madhura Tech'),
             body = REPLACE(REPLACE(body, 'ACHME', 'Madhura Tech'), 'Achme', 'Madhura Tech'),
             footer = REPLACE(REPLACE(footer, 'ACHME', 'Madhura Tech'), 'Achme', 'Madhura Tech')
         WHERE header_value LIKE '%ACHME%' OR body LIKE '%ACHME%' OR footer LIKE '%ACHME%'
            OR header_value LIKE '%Achme%' OR body LIKE '%Achme%' OR footer LIKE '%Achme%'`
      );
      await queryAsync(
        `UPDATE wa_automations
         SET message_text = REPLACE(REPLACE(message_text, 'ACHME', 'Madhura Tech'), 'Achme', 'Madhura Tech'),
             followup_message_text = REPLACE(REPLACE(followup_message_text, 'ACHME', 'Madhura Tech'), 'Achme', 'Madhura Tech')
         WHERE message_text LIKE '%ACHME%' OR followup_message_text LIKE '%ACHME%'
            OR message_text LIKE '%Achme%' OR followup_message_text LIKE '%Achme%'`
      );
    } catch (migErr) {
      console.warn("⚠️ WhatsApp rebranding data migration note:", migErr.message);
    }

    const aiSettingsCount = await queryAsync("SELECT COUNT(*) as count FROM wa_ai_settings");
    if (aiSettingsCount[0].count === 0) {
      await queryAsync(
        "INSERT INTO wa_ai_settings (id, enabled, provider, model) VALUES (1, 0, 'openrouter', 'meta-llama/llama-3.3-70b-instruct:free')"
      );
      console.log("✅ Seeded default WhatsApp AI auto-reply settings (disabled)");
    }

    // ── Seed Comprehensive Flow Bots & Activate Automations on Boot ─────────
    try {
      const waFlowSeedService = require("./waFlowSeedService");
      await waFlowSeedService.seedAll(false);
    } catch (seedFlowErr) {
      console.warn("⚠️ Flow & Automation auto-seed notice:", seedFlowErr.message);
    }
  } catch (seedErr) {
    console.error("Error seeding prebuilt WhatsApp data:", seedErr.message);
  }

  console.log("✅ WhatsApp Cloud API & Load Balancer tables ready");
}

module.exports = { ensureWATables };