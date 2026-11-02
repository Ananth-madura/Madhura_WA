"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const db = require("../config/database");
const r2Storage = require("../services/r2StorageService");

async function migrateBlobsToR2({ dryRun = false } = {}) {
  console.log("=== Cloudflare R2 vs MySQL BLOB Migration ===");

  if (!r2Storage.isConfigured()) {
    console.log("ℹ️ Cloudflare R2 is not configured in this environment (CLOUDFLARE_R2_ENABLED is 0 or credentials missing).");
    console.log("   Preserving MySQL storage for all binary documents. No BLOBs were modified.");
    return { skipped: true, reason: "r2_not_configured" };
  }

  const sql = db.promise();

  // 1. Check for documents with BLOB bytes in MySQL
  let rows = [];
  try {
    const [result] = await sql.query(
      "SELECT id, client_id, kind, title, file_name, file_mime, LENGTH(file_bytes) AS byte_len, file_bytes FROM client_portal_documents WHERE file_bytes IS NOT NULL AND (storage_key IS NULL OR storage_key = '')"
    );
    rows = result || [];
  } catch (err) {
    console.error("❌ Failed to query client_portal_documents:", err.message);
    return { error: err.message };
  }

  console.log(`Found ${rows.length} document(s) with MySQL BLOB data eligible for R2 migration.`);

  if (rows.length === 0) {
    console.log("✅ No unmigrated BLOBs found. All documents are already using Cloudflare R2 or metadata-only storage.");
    return { migratedCount: 0, totalBytesFreed: 0 };
  }

  let migratedCount = 0;
  let totalBytesFreed = 0;
  let failedCount = 0;

  for (const row of rows) {
    const docSize = row.byte_len || (row.file_bytes ? row.file_bytes.length : 0);
    const filename = row.file_name || `document_${row.id}.pdf`;
    const mime = row.file_mime || "application/pdf";
    const storageKey = r2Storage.tenantKey(1, "client-portal-docs", `doc-${row.id}-${Date.now()}.pdf`);

    console.log(`- Migrating Document #${row.id} ("${filename}", ${docSize} bytes)...`);

    if (dryRun) {
      console.log(`  [DRY RUN] Would upload to R2 key: ${storageKey}`);
      migratedCount++;
      totalBytesFreed += docSize;
      continue;
    }

    try {
      // 1. Upload to R2 private bucket
      const uploadRes = await r2Storage.uploadPrivateObject(row.file_bytes, storageKey, mime, {
        clientId: String(row.client_id),
        documentId: String(row.id),
        originalFilename: filename,
      });

      if (!uploadRes.success) {
        throw new Error(uploadRes.error || "R2 upload rejected");
      }

      // 2. Verify object retrievability from R2
      const head = await r2Storage.headObject(storageKey);
      if (!head.exists) {
        throw new Error("R2 HeadObject check failed after upload; file not found in bucket");
      }

      // 3. Atomically update DB record: set storage_key, storage_provider='r2', and nullify file_bytes
      await sql.query(
        "UPDATE client_portal_documents SET storage_key = ?, storage_provider = 'r2', file_bytes = NULL WHERE id = ?",
        [storageKey, row.id]
      );

      // 4. Index in app_storage_objects
      try {
        await sql.query(
          `INSERT INTO app_storage_objects 
           (tenant_id, storage_provider, bucket, object_key, original_filename, mime_type, file_size, visibility, category)
           VALUES (?, 'r2', ?, ?, ?, ?, ?, 'private', 'client-portal-docs')`,
          [1, r2Storage.bucket, storageKey, filename, mime, docSize]
        );
      } catch (idxErr) {
        // Non-blocking metadata log
        console.warn(`  [Notice] Metadata index note for doc #${row.id}:`, idxErr.message);
      }

      console.log(`  ✅ Successfully migrated to R2 (${storageKey}). MySQL BLOB freed.`);
      migratedCount++;
      totalBytesFreed += docSize;
    } catch (migErr) {
      console.error(`  ❌ Failed to migrate document #${row.id}: ${migErr.message}`);
      console.error(`     BLOB preserved intact in MySQL for document #${row.id}.`);
      failedCount++;
    }
  }

  console.log("\n--- Migration Summary ---");
  console.log(`Total Eligible: ${rows.length}`);
  console.log(`Successfully Migrated: ${migratedCount}`);
  console.log(`Failed / Retained in MySQL: ${failedCount}`);
  console.log(`Total Database Storage Freed: ${(totalBytesFreed / 1024).toFixed(2)} KB (${totalBytesFreed} bytes)`);
  console.log("-------------------------\n");

  return { migratedCount, failedCount, totalBytesFreed };
}

if (require.main === module) {
  const isDryRun = process.argv.includes("--dry-run");
  migrateBlobsToR2({ dryRun: isDryRun })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Migration fatal error:", err);
      process.exit(1);
    });
}

module.exports = { migrateBlobsToR2 };

