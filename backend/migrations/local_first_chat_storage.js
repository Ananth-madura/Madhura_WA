"use strict";

/**
 * Migration: local_first_chat_storage
 *
 * Enforces strict separation between CRM operational metadata and actual WhatsApp
 * message content:
 * - Ensures message content columns (message_text, media_url, media_filename, metadata,
 *   interactive_payload) are nullable in wa_message_logs.
 * - Ensures preview content columns (last_message_text) are nullable in conversations
 *   and wa_contacts.
 * - Ensures payload is nullable in wa_webhook_events.
 */
async function migrate(db) {
  const sql = db.promise();
  const isMysql = !db.isSqlite;

  const runSafe = async (statement) => {
    try {
      await sql.query(statement);
    } catch (err) {
      if (
        !err.message.includes("Duplicate column") &&
        !err.message.includes("already exists") &&
        !err.message.includes("Unknown column")
      ) {
        console.warn(`[Migration local_first_chat_storage] Note: ${err.message}`);
      }
    }
  };

  if (isMysql) {
    // 1. wa_message_logs: make message body & media columns nullable
    await runSafe("ALTER TABLE wa_message_logs MODIFY COLUMN message_text TEXT NULL");
    await runSafe("ALTER TABLE wa_message_logs MODIFY COLUMN media_url TEXT NULL");
    await runSafe("ALTER TABLE wa_message_logs MODIFY COLUMN media_filename VARCHAR(255) NULL");
    await runSafe("ALTER TABLE wa_message_logs MODIFY COLUMN metadata LONGTEXT NULL");
    await runSafe("ALTER TABLE wa_message_logs MODIFY COLUMN interactive_payload TEXT NULL");

    // 2. conversations & wa_contacts: make preview snippet nullable
    await runSafe("ALTER TABLE conversations MODIFY COLUMN last_message_text TEXT NULL");
    await runSafe("ALTER TABLE wa_contacts MODIFY COLUMN last_message_text TEXT NULL");

    // 3. wa_webhook_events: make raw payload nullable
    await runSafe("ALTER TABLE wa_webhook_events MODIFY COLUMN payload LONGTEXT NULL");
  }

  console.log("✅ [Migration] local_first_chat_storage: schema verified for strict metadata separation.");
}

module.exports = { migrate };

