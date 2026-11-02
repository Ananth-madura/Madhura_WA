"use strict";

async function migrate(db) {
  const q = async (sql, params = []) => (await db.promise().query(sql, params))[0];
  const identity = db.isSqlite ? "INTEGER PRIMARY KEY AUTOINCREMENT" : "INT AUTO_INCREMENT PRIMARY KEY";
  const suffix = db.isSqlite ? "" : " ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

  const addColumn = async (table, column, definition) => {
    try {
      const columns = db.isSqlite
        ? await q(`PRAGMA table_info(${table})`)
        : await q("SELECT COLUMN_NAME AS name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ?", [table]);
      if (!columns.some(item => (item.name || item.COLUMN_NAME) === column)) {
        await q(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      }
    } catch (e) {
      if (!/Duplicate column|already exists/i.test(e.message)) console.warn(`[Migration] Add column ${table}.${column} warning:`, e.message);
    }
  };

  // 1. Conversation shares table
  await q(`CREATE TABLE IF NOT EXISTS wa_conversation_shares (
    id ${identity},
    tenant_id INT NOT NULL,
    conversation_id INT NOT NULL,
    owner_user_id INT NOT NULL,
    shared_with_user_id INT NOT NULL,
    shared_by_user_id INT NOT NULL,
    permission_level VARCHAR(20) NOT NULL DEFAULT 'viewer',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    sharing_reason VARCHAR(255) DEFAULT NULL,
    expires_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP NULL DEFAULT NULL,
    UNIQUE KEY uniq_tenant_conv_user (tenant_id, conversation_id, shared_with_user_id)
  )${suffix}`);

  // 2. Add columns to wa_message_logs for employee attribution
  await addColumn("wa_message_logs", "author_id", "INT DEFAULT NULL");
  await addColumn("wa_message_logs", "author_name", "VARCHAR(100) DEFAULT NULL");

  // 3. Add columns to staff_sender_assignments for granular permissions
  await addColumn("staff_sender_assignments", "role_in_sender", "VARCHAR(30) NOT NULL DEFAULT 'member'");
  await addColumn("staff_sender_assignments", "can_view", "INT NOT NULL DEFAULT 1");
  await addColumn("staff_sender_assignments", "can_reply", "INT NOT NULL DEFAULT 1");
  await addColumn("staff_sender_assignments", "can_send_templates", "INT NOT NULL DEFAULT 1");
  await addColumn("staff_sender_assignments", "can_send_attachments", "INT NOT NULL DEFAULT 1");
  await addColumn("staff_sender_assignments", "can_add_notes", "INT NOT NULL DEFAULT 1");
  await addColumn("staff_sender_assignments", "can_transfer", "INT NOT NULL DEFAULT 1");
  await addColumn("staff_sender_assignments", "can_share", "INT NOT NULL DEFAULT 1");
  await addColumn("staff_sender_assignments", "can_manage_collaborators", "INT NOT NULL DEFAULT 1");
  await addColumn("staff_sender_assignments", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
  await addColumn("staff_sender_assignments", "updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");

  // 4. Add department to users
  await addColumn("users", "department", "VARCHAR(100) DEFAULT NULL");

  // 5. Add columns to wa_assignment_events for sharing & transfer history
  await addColumn("wa_assignment_events", "action", "VARCHAR(50) DEFAULT 'assigned'");
  await addColumn("wa_assignment_events", "shared_with_user_id", "INT DEFAULT NULL");
  await addColumn("wa_assignment_events", "details", "TEXT DEFAULT NULL");

  // 6. Indexes for ultra-fast query performance
  const indexes = [
    ["wa_conversation_shares", "idx_shares_user_status", "tenant_id, shared_with_user_id, status, expires_at"],
    ["wa_conversation_shares", "idx_shares_conv_status", "tenant_id, conversation_id, status"],
    ["wa_conversation_shares", "idx_shares_owner", "tenant_id, owner_user_id, status"],
    ["wa_conversation_shares", "idx_shares_expiry", "status, expires_at"],
    ["wa_message_logs", "idx_msg_author", "tenant_id, conversation_id, author_id"],
    ["staff_sender_assignments", "idx_sender_staff", "tenant_id, sender_id, user_id"],
    ["wa_assignment_events", "idx_assign_conv_action", "tenant_id, conversation_id, action, id"]
  ];

  for (const [table, name, fields] of indexes) {
    try {
      await q(`CREATE INDEX ${name} ON ${table} (${fields})`);
    } catch (error) {
      if (!/already exists|Duplicate key name/i.test(error.message)) {
        console.warn(`[Migration] Index ${name} on ${table} notice:`, error.message);
      }
    }
  }

  console.log("✅ Conversation shares & team assignment migration completed successfully");
}

module.exports = { migrate };

