"use strict";

/**
 * Additive schema migration for the 10-System Enterprise WhatsApp Workflow Hub.
 * Creates operational tables for appointments, waitlist, support tickets,
 * catalog/orders, HR requests, approvals, and workflow error alerts.
 * Compatible with both MySQL and SQLite test adapters.
 */
async function migrate(db) {
  const q = async (sql, params = []) => (await db.promise().query(sql, params))[0];
  const pk = db.isSqlite ? "INTEGER PRIMARY KEY AUTOINCREMENT" : "INT AUTO_INCREMENT PRIMARY KEY";

  const tables = [
    `CREATE TABLE IF NOT EXISTS wa_appointments (
      id ${pk},
      tenant_id INT NOT NULL,
      branch_id INT DEFAULT NULL,
      conversation_id INT DEFAULT NULL,
      contact_id INT DEFAULT NULL,
      phone VARCHAR(30) NOT NULL,
      customer_name VARCHAR(150) DEFAULT NULL,
      reference_code VARCHAR(40) NOT NULL,
      category VARCHAR(40) NOT NULL DEFAULT 'appointment',
      service_name VARCHAR(180) NOT NULL,
      branch_name VARCHAR(120) DEFAULT 'Main',
      slot_date VARCHAR(20) DEFAULT NULL,
      slot_time VARCHAR(40) DEFAULT NULL,
      guests_count INT DEFAULT 1,
      staff_user_id INT DEFAULT NULL,
      staff_name VARCHAR(150) DEFAULT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'held',
      notes TEXT DEFAULT NULL,
      reminder_scheduled_at DATETIME DEFAULT NULL,
      rating INT DEFAULT NULL,
      idempotency_key VARCHAR(128) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS wa_appointment_waitlist (
      id ${pk},
      tenant_id INT NOT NULL,
      phone VARCHAR(30) NOT NULL,
      customer_name VARCHAR(150) DEFAULT NULL,
      service_name VARCHAR(180) NOT NULL,
      branch_name VARCHAR(120) DEFAULT 'Main',
      preferred_date VARCHAR(20) DEFAULT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'waiting',
      idempotency_key VARCHAR(128) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS wa_support_tickets (
      id ${pk},
      tenant_id INT NOT NULL,
      conversation_id INT DEFAULT NULL,
      contact_id INT DEFAULT NULL,
      phone VARCHAR(30) NOT NULL,
      customer_name VARCHAR(150) DEFAULT NULL,
      ticket_no VARCHAR(40) NOT NULL,
      category VARCHAR(40) NOT NULL DEFAULT 'support',
      subject VARCHAR(255) NOT NULL,
      description TEXT DEFAULT NULL,
      priority VARCHAR(20) NOT NULL DEFAULT 'normal',
      status VARCHAR(30) NOT NULL DEFAULT 'open',
      assigned_user_id INT DEFAULT NULL,
      sla_due_at DATETIME DEFAULT NULL,
      csat_rating INT DEFAULT NULL,
      csat_comment TEXT DEFAULT NULL,
      idempotency_key VARCHAR(128) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS wa_crm_products (
      id ${pk},
      tenant_id INT NOT NULL,
      sku VARCHAR(64) NOT NULL,
      name VARCHAR(180) NOT NULL,
      category VARCHAR(80) DEFAULT 'general',
      description TEXT DEFAULT NULL,
      price DECIMAL(12,2) NOT NULL DEFAULT 0,
      currency VARCHAR(10) NOT NULL DEFAULT 'INR',
      stock_qty INT NOT NULL DEFAULT 0,
      variants_json TEXT DEFAULT NULL,
      media_url VARCHAR(500) DEFAULT NULL,
      is_active TINYINT NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS wa_crm_orders (
      id ${pk},
      tenant_id INT NOT NULL,
      conversation_id INT DEFAULT NULL,
      contact_id INT DEFAULT NULL,
      phone VARCHAR(30) NOT NULL,
      customer_name VARCHAR(150) DEFAULT NULL,
      order_no VARCHAR(40) NOT NULL,
      items_json TEXT NOT NULL,
      total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      currency VARCHAR(10) NOT NULL DEFAULT 'INR',
      payment_status VARCHAR(30) NOT NULL DEFAULT 'unpaid',
      payment_ref VARCHAR(120) DEFAULT NULL,
      fulfillment_status VARCHAR(30) NOT NULL DEFAULT 'pending',
      tracking_no VARCHAR(80) DEFAULT NULL,
      shipping_address TEXT DEFAULT NULL,
      pod_note TEXT DEFAULT NULL,
      rating INT DEFAULT NULL,
      idempotency_key VARCHAR(128) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS wa_hr_requests (
      id ${pk},
      tenant_id INT NOT NULL,
      employee_phone VARCHAR(30) NOT NULL,
      employee_name VARCHAR(150) DEFAULT NULL,
      request_no VARCHAR(40) NOT NULL,
      request_type VARCHAR(40) NOT NULL,
      target_date VARCHAR(20) DEFAULT NULL,
      target_time VARCHAR(40) DEFAULT NULL,
      details TEXT DEFAULT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'pending',
      approver_user_id INT DEFAULT NULL,
      decision_note TEXT DEFAULT NULL,
      idempotency_key VARCHAR(128) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS wa_approval_requests (
      id ${pk},
      tenant_id INT NOT NULL,
      requester_phone VARCHAR(30) NOT NULL,
      requester_name VARCHAR(150) DEFAULT NULL,
      approval_no VARCHAR(40) NOT NULL,
      request_type VARCHAR(40) NOT NULL,
      item_name VARCHAR(180) DEFAULT NULL,
      quantity INT DEFAULT 1,
      amount DECIMAL(12,2) DEFAULT 0,
      branch_name VARCHAR(120) DEFAULT NULL,
      details TEXT DEFAULT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'pending',
      approver_user_id INT DEFAULT NULL,
      decision_note TEXT DEFAULT NULL,
      idempotency_key VARCHAR(128) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS wa_flow_error_alerts (
      id ${pk},
      tenant_id INT NOT NULL,
      flow_id INT DEFAULT NULL,
      flow_name VARCHAR(180) DEFAULT NULL,
      run_id INT DEFAULT NULL,
      conversation_id INT DEFAULT NULL,
      phone VARCHAR(30) DEFAULT NULL,
      node_key VARCHAR(80) DEFAULT NULL,
      error_code VARCHAR(80) DEFAULT NULL,
      error_message TEXT DEFAULT NULL,
      notified_user_id INT DEFAULT NULL,
      status VARCHAR(24) NOT NULL DEFAULT 'open',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
  ];

  for (const ddl of tables) {
    await q(ddl);
  }

  const indexes = [
    ["wa_appointments", "idx_wa_apt_tenant_phone", "tenant_id, phone", false],
    ["wa_appointments", "idx_wa_apt_slot", "tenant_id, branch_name, slot_date, status", false],
    ["wa_appointments", "uq_wa_apt_idem", "tenant_id, idempotency_key", true],
    ["wa_appointment_waitlist", "idx_wa_wl_tenant_date", "tenant_id, preferred_date, status", false],
    ["wa_appointment_waitlist", "uq_wa_wl_idem", "tenant_id, idempotency_key", true],
    ["wa_support_tickets", "idx_wa_tkt_tenant_phone", "tenant_id, phone, status", false],
    ["wa_support_tickets", "uq_wa_tkt_idem", "tenant_id, idempotency_key", true],
    ["wa_crm_products", "idx_wa_prod_tenant_sku", "tenant_id, sku", true],
    ["wa_crm_orders", "idx_wa_ord_tenant_phone", "tenant_id, phone, fulfillment_status", false],
    ["wa_crm_orders", "uq_wa_ord_idem", "tenant_id, idempotency_key", true],
    ["wa_hr_requests", "idx_wa_hr_tenant_phone", "tenant_id, employee_phone, status", false],
    ["wa_hr_requests", "uq_wa_hr_idem", "tenant_id, idempotency_key", true],
    ["wa_approval_requests", "idx_wa_apr_tenant_status", "tenant_id, status, request_type", false],
    ["wa_approval_requests", "uq_wa_apr_idem", "tenant_id, idempotency_key", true],
    ["wa_flow_error_alerts", "idx_wa_err_tenant_status", "tenant_id, status, created_at", false],
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
}

module.exports = { migrate };

