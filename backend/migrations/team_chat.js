"use strict";

/**
 * Internal team chat schema.
 *
 * Deliberately separate from the customer inbox: no WhatsApp message, contact
 * or conversation row is touched, so employee chatter can never leak into a
 * customer thread or be sent to a provider.
 *
 * Retention is enforced in `services/teamChat.js`: rows older than seven days
 * are deleted from the server. The browser keeps its own device copy, which is
 * why the schema has no archive table — a device-only archive must not become a
 * second server-side history.
 */
async function migrate(db) {
  const q = async (sql, params = []) => (await db.promise().query(sql, params))[0];
  const identity = db.isSqlite
    ? "INTEGER PRIMARY KEY AUTOINCREMENT"
    : "INT AUTO_INCREMENT PRIMARY KEY";
  const suffix = db.isSqlite ? "" : " ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

  await q(`CREATE TABLE IF NOT EXISTS team_chat_channels (
    id ${identity},
    tenant_id INT NOT NULL,
    kind VARCHAR(20) NOT NULL,
    branch_id INT NOT NULL DEFAULT 0,
    dm_key VARCHAR(64) NOT NULL DEFAULT '',
    name VARCHAR(160) DEFAULT NULL,
    description TEXT DEFAULT NULL,
    avatar_url VARCHAR(255) DEFAULT NULL,
    is_archived INT NOT NULL DEFAULT 0,
    created_by INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (tenant_id, kind, branch_id, dm_key)
  )${suffix}`);

  await q(`CREATE TABLE IF NOT EXISTS team_chat_channel_members (
    id ${identity},
    tenant_id INT NOT NULL,
    channel_id INT NOT NULL,
    user_id INT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'member',
    muted INT NOT NULL DEFAULT 0,
    pinned INT NOT NULL DEFAULT 0,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (tenant_id, channel_id, user_id)
  )${suffix}`);

  await q(`CREATE TABLE IF NOT EXISTS team_chat_messages (
    id ${identity},
    tenant_id INT NOT NULL,
    channel_id INT NOT NULL,
    sender_id INT NOT NULL,
    body TEXT NOT NULL,
    client_id VARCHAR(80) DEFAULT NULL,
    reply_to_id INT DEFAULT NULL,
    is_edited INT NOT NULL DEFAULT 0,
    edited_at TIMESTAMP NULL DEFAULT NULL,
    is_deleted INT NOT NULL DEFAULT 0,
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (tenant_id, channel_id, sender_id, client_id)
  )${suffix}`);

  await q(`CREATE TABLE IF NOT EXISTS team_chat_attachments (
    id ${identity},
    tenant_id INT NOT NULL,
    channel_id INT NOT NULL,
    message_id INT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size INT NOT NULL DEFAULT 0,
    mime_type VARCHAR(100) NOT NULL DEFAULT 'application/octet-stream',
    file_url TEXT NOT NULL,
    storage_key VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )${suffix}`);

  await q(`CREATE TABLE IF NOT EXISTS team_chat_reactions (
    id ${identity},
    tenant_id INT NOT NULL,
    channel_id INT NOT NULL,
    message_id INT NOT NULL,
    user_id INT NOT NULL,
    emoji VARCHAR(32) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (tenant_id, message_id, user_id, emoji)
  )${suffix}`);

  await q(`CREATE TABLE IF NOT EXISTS team_chat_pins (
    tenant_id INT NOT NULL,
    channel_id INT NOT NULL,
    message_id INT NOT NULL,
    pinned_by INT NOT NULL,
    pinned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tenant_id, channel_id, message_id)
  )${suffix}`);

  await q(`CREATE TABLE IF NOT EXISTS team_chat_branch_policies (
    id ${identity},
    tenant_id INT NOT NULL,
    branch_a_id INT NOT NULL,
    branch_b_id INT NOT NULL,
    allow_direct INT NOT NULL DEFAULT 1,
    allow_groups INT NOT NULL DEFAULT 1,
    allow_discovery INT NOT NULL DEFAULT 1,
    allow_files INT NOT NULL DEFAULT 1,
    enabled INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (tenant_id, branch_a_id, branch_b_id)
  )${suffix}`);

  await q(`CREATE TABLE IF NOT EXISTS team_chat_audit_logs (
    id ${identity},
    tenant_id INT NOT NULL,
    actor_id INT NOT NULL,
    action VARCHAR(50) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id INT NOT NULL DEFAULT 0,
    details_json TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )${suffix}`);

  await q(`CREATE TABLE IF NOT EXISTS team_chat_reads (
    tenant_id INT NOT NULL,
    channel_id INT NOT NULL,
    user_id INT NOT NULL,
    last_read_id INT NOT NULL DEFAULT 0,
    last_read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tenant_id, channel_id, user_id)
  )${suffix}`);

  await q(`CREATE TABLE IF NOT EXISTS team_chat_settings (
    tenant_id INT PRIMARY KEY,
    cross_branch_dm INT NOT NULL DEFAULT 0,
    retention_days INT NOT NULL DEFAULT 7,
    allow_file_sharing INT NOT NULL DEFAULT 1,
    max_file_size_mb INT NOT NULL DEFAULT 25,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )${suffix}`);

  await q(`CREATE TABLE IF NOT EXISTS team_chat_changes (
    id ${identity}, tenant_id INT NOT NULL, channel_id INT NOT NULL,
    message_id INT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )${suffix}`);

  // Safe non-destructive column additions for existing tables
  const addCol = async (table, col, typeDef) => {
    try {
      await q(`ALTER TABLE ${table} ADD COLUMN ${col} ${typeDef}`);
    } catch (err) {
      if (!/duplicate column|already exists|duplicate key name/i.test(err.message)) {
        throw err;
      }
    }
  };

  await addCol("team_chat_channels", "description", "TEXT DEFAULT NULL");
  await addCol("team_chat_channels", "avatar_url", "VARCHAR(255) DEFAULT NULL");
  await addCol("team_chat_channels", "avatar_mime", "VARCHAR(100) DEFAULT NULL");
  await addCol("team_chat_channels", "is_archived", "INT NOT NULL DEFAULT 0");
  await addCol("team_chat_channels", "updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");

  await addCol("team_chat_messages", "reply_to_id", "INT DEFAULT NULL");
  await addCol("team_chat_messages", "is_edited", "INT NOT NULL DEFAULT 0");
  await addCol("team_chat_messages", "edited_at", "TIMESTAMP NULL DEFAULT NULL");
  await addCol("team_chat_messages", "is_deleted", "INT NOT NULL DEFAULT 0");
  await addCol("team_chat_messages", "deleted_at", "TIMESTAMP NULL DEFAULT NULL");

  await addCol("team_chat_settings", "retention_days", "INT NOT NULL DEFAULT 7");
  await addCol("team_chat_settings", "allow_file_sharing", "INT NOT NULL DEFAULT 1");
  await addCol("team_chat_settings", "max_file_size_mb", "INT NOT NULL DEFAULT 25");
  await addCol("team_chat_attachments", "uploaded_by", "INT DEFAULT NULL");
  await addCol("team_chat_channel_members", "archived", "INT NOT NULL DEFAULT 0");
  await addCol("team_chat_channel_members", "marked_unread", "INT NOT NULL DEFAULT 0");
  await addCol("team_chat_branch_policies", "constraints_json", "TEXT DEFAULT NULL");
  await addCol("team_chat_branch_policies", "version", "INT NOT NULL DEFAULT 0");
  await addCol("team_chat_messages", "state_version", "INT NOT NULL DEFAULT 1");
  await addCol("team_chat_messages", "mention_ids_json", "TEXT DEFAULT NULL");
  await addCol("team_chat_settings", "local_cache_days", "INT NOT NULL DEFAULT 0");
  await addCol("team_chat_settings", "clear_cache_on_logout", "INT NOT NULL DEFAULT 0");
  await q(`CREATE TABLE IF NOT EXISTS team_chat_notification_preferences (
    tenant_id INT NOT NULL, user_id INT NOT NULL,
    in_app INT NOT NULL DEFAULT 1, desktop INT NOT NULL DEFAULT 0,
    mentions_when_muted INT NOT NULL DEFAULT 0,
    PRIMARY KEY (tenant_id, user_id)
  )${suffix}`);

  const indexes = [
    ["team_chat_channels", "idx_team_chat_channel_scope", "tenant_id, kind, branch_id"],
    ["team_chat_channel_members", "idx_team_chat_member_user", "tenant_id, user_id, channel_id"],
    ["team_chat_messages", "idx_team_chat_channel", "tenant_id, channel_id, id"],
    ["team_chat_messages", "idx_team_chat_expiry", "created_at, id"],
    ["team_chat_messages", "idx_team_chat_tenant_expiry", "tenant_id, created_at, id"],
    ["team_chat_messages", "idx_team_chat_reply", "tenant_id, reply_to_id"],
    ["team_chat_attachments", "idx_team_chat_attach_msg", "tenant_id, message_id"],
    ["team_chat_reactions", "idx_team_chat_react_msg", "tenant_id, message_id"],
    ["team_chat_pins", "idx_team_chat_pins_chan", "tenant_id, channel_id"],
    ["team_chat_branch_policies", "idx_team_chat_branch_pairs", "tenant_id, branch_a_id, branch_b_id"],
    ["team_chat_audit_logs", "idx_team_chat_audit_actor", "tenant_id, actor_id, created_at"],
    ["team_chat_reads", "idx_team_chat_reads_user", "tenant_id, user_id"],
    ["team_chat_changes", "idx_team_chat_changes_cursor", "tenant_id, channel_id, id"],
    ["team_chat_changes", "idx_team_chat_changes_message", "tenant_id, message_id"],
    ["team_chat_changes", "idx_team_chat_changes_expiry", "tenant_id, created_at"],
  ];
  for (const [table, name, columns] of indexes) {
    try {
      await q(`CREATE INDEX ${name} ON ${table} (${columns})`);
    } catch (error) {
      if (!/already exists|Duplicate key name/i.test(error.message)) throw error;
    }
  }
  await q(`INSERT INTO team_chat_changes (tenant_id, channel_id, message_id)
    SELECT m.tenant_id, m.channel_id, m.id FROM team_chat_messages m
    WHERE NOT EXISTS (SELECT 1 FROM team_chat_changes c WHERE c.tenant_id = m.tenant_id AND c.message_id = m.id)`);

  const fs = require("node:fs/promises");
  const path = require("node:path");
  const { mediaDir, privateChatDir } = require("../config/runtimePaths");
  await fs.mkdir(privateChatDir, { recursive: true, mode: 0o750 });
  const legacyFiles = await q("SELECT DISTINCT storage_key FROM team_chat_attachments WHERE storage_key IS NOT NULL");
  for (const file of legacyFiles) {
    if (!file.storage_key.startsWith("tc_") || path.basename(file.storage_key) !== file.storage_key) continue;
    const source = path.join(mediaDir, file.storage_key);
    try {
      await fs.access(source);
      await fs.rename(source, path.join(privateChatDir, file.storage_key));
    } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
}

module.exports = { migrate };
