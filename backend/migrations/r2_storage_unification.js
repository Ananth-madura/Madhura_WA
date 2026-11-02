"use strict";

/**
 * Migration: r2_storage_unification
 *
 * Prepares MySQL schema for Cloudflare R2 object storage migration:
 * - Adds storage_key and storage_provider to client_portal_documents (eliminates BLOB dependence).
 * - Adds storage_key and storage_provider to wa_knowledge_base (preserves source document binaries).
 * - Adds storage_provider to team_chat_attachments (enables private R2 streaming).
 * - Creates app_storage_objects for unified metadata indexing across all R2 assets.
 */
async function migrate(db) {
  const sql = db.promise();
  const isMysql = !db.isSqlite;

  const runSafe = async (statement) => {
    try {
      await sql.query(statement);
    } catch (err) {
      const msg = err.message || "";
      if (
        !msg.includes("Duplicate column") &&
        !msg.includes("already exists") &&
        !msg.includes("Unknown column")
      ) {
        console.warn(`[Migration r2_storage_unification] Note: ${msg}`);
      }
    }
  };

  // 1. client_portal_documents: add storage_key and make file_bytes nullable
  await runSafe("ALTER TABLE client_portal_documents ADD COLUMN storage_key VARCHAR(255) NULL");
  await runSafe("ALTER TABLE client_portal_documents ADD COLUMN storage_provider VARCHAR(32) NOT NULL DEFAULT 'r2'");
  if (isMysql) {
    await runSafe("ALTER TABLE client_portal_documents MODIFY COLUMN file_bytes LONGBLOB NULL");
  }

  // 2. wa_knowledge_base: add storage_key and storage_provider
  await runSafe("ALTER TABLE wa_knowledge_base ADD COLUMN storage_key VARCHAR(255) NULL");
  await runSafe("ALTER TABLE wa_knowledge_base ADD COLUMN storage_provider VARCHAR(32) NOT NULL DEFAULT 'r2'");

  // 3. team_chat_attachments: add storage_provider
  await runSafe("ALTER TABLE team_chat_attachments ADD COLUMN storage_provider VARCHAR(32) NOT NULL DEFAULT 'local'");

  // 4. app_storage_objects: unified metadata tracking table
  const idCol = isMysql ? "INT AUTO_INCREMENT PRIMARY KEY" : "INTEGER PRIMARY KEY AUTOINCREMENT";
  const suffix = isMysql ? " ENGINE=InnoDB DEFAULT CHARSET=utf8mb4" : "";

  await runSafe(`
    CREATE TABLE IF NOT EXISTS app_storage_objects (
      id ${idCol},
      tenant_id INT NOT NULL DEFAULT 1,
      storage_provider VARCHAR(32) NOT NULL DEFAULT 'r2',
      bucket VARCHAR(128) NOT NULL,
      object_key VARCHAR(512) NOT NULL,
      original_filename VARCHAR(255) NOT NULL,
      mime_type VARCHAR(128) NOT NULL,
      file_size BIGINT NOT NULL DEFAULT 0,
      checksum VARCHAR(128) NULL,
      visibility VARCHAR(20) NOT NULL DEFAULT 'private',
      uploaded_by INT NULL,
      category VARCHAR(64) NOT NULL DEFAULT 'general',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )${suffix}
  `);

  if (isMysql) {
    await runSafe("CREATE INDEX idx_aso_tenant_cat ON app_storage_objects (tenant_id, category)");
    await runSafe("CREATE INDEX idx_aso_obj_key ON app_storage_objects (object_key(191))");
  }

  console.log("✅ [Migration] r2_storage_unification: schema successfully prepared for Cloudflare R2 object storage.");
}

module.exports = { migrate };

