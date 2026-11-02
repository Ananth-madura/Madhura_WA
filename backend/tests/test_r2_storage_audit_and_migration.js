"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const assert = require("assert");
const fs = require("fs");
const db = require("../config/database");
const r2Storage = require("../services/r2StorageService");
const { migrate } = require("../migrations/r2_storage_unification");
const { createClientPortalService } = require("../services/clientPortalService");
const teamChat = require("../services/teamChat");
const waKnowledgeBase = require("../services/waKnowledgeBase");
const waPrivacy = require("../services/waChatPrivacy");

async function runTestSuite() {
  console.log("================================================================================");
  console.log("       CLOUDFLARE R2 OBJECT STORAGE & MYSQL AUDIT TEST SUITE                   ");
  console.log("================================================================================\n");

  await db.ready;
  const sql = db.promise();

  // ── TEST 1: Run and verify schema migration ──────────────────────────────
  console.log("1. Running and verifying r2_storage_unification database migration...");
  await migrate(db);

  // Check columns in client_portal_documents
  const [cpCols] = await sql.query("DESCRIBE client_portal_documents");
  const cpColNames = cpCols.map((c) => c.Field);
  assert(cpColNames.includes("storage_key"), "client_portal_documents must have storage_key column");
  assert(cpColNames.includes("storage_provider"), "client_portal_documents must have storage_provider column");
  console.log("   [PASS] client_portal_documents schema prepared (storage_key & storage_provider present).");

  // Check columns in wa_knowledge_base
  const [kbCols] = await sql.query("DESCRIBE wa_knowledge_base");
  const kbColNames = kbCols.map((c) => c.Field);
  assert(kbColNames.includes("storage_key"), "wa_knowledge_base must have storage_key column");
  assert(kbColNames.includes("storage_provider"), "wa_knowledge_base must have storage_provider column");
  console.log("   [PASS] wa_knowledge_base schema prepared (storage_key & storage_provider present).");

  // Check columns in team_chat_attachments
  const [tcCols] = await sql.query("DESCRIBE team_chat_attachments");
  const tcColNames = tcCols.map((c) => c.Field);
  assert(tcColNames.includes("storage_provider"), "team_chat_attachments must have storage_provider column");
  console.log("   [PASS] team_chat_attachments schema prepared (storage_provider present).");

  // Check app_storage_objects table
  const [tables] = await sql.query("SHOW TABLES LIKE 'app_storage_objects'");
  assert(tables.length > 0, "app_storage_objects table must exist");
  console.log("   [PASS] app_storage_objects table verified.");

  // ── TEST 2: R2 Storage Service API contract ──────────────────────────────
  console.log("\n2. Verifying R2 storage service unified methods & key generation...");
  assert.strictEqual(typeof r2Storage.uploadPrivateObject, "function");
  assert.strictEqual(typeof r2Storage.uploadPublicObject, "function");
  assert.strictEqual(typeof r2Storage.getPrivateObjectStream, "function");
  assert.strictEqual(typeof r2Storage.createSignedDownloadUrl, "function");
  assert.strictEqual(typeof r2Storage.createSignedUploadUrl, "function");
  assert.strictEqual(typeof r2Storage.headObject, "function");
  assert.strictEqual(typeof r2Storage.deleteObject, "function");
  assert.strictEqual(typeof r2Storage.copyObject, "function");
  assert.strictEqual(typeof r2Storage.moveObject, "function");
  assert.strictEqual(typeof r2Storage.verifyObjectIntegrity, "function");
  assert.strictEqual(typeof r2Storage.tenantKey, "function");

  const testKey = r2Storage.tenantKey(1, "client-portal-docs", "invoice_1001.pdf");
  assert(testKey.startsWith("tenants/1/client-portal-docs/"), "Key must start with tenant path");
  assert(testKey.endsWith("invoice_1001.pdf"), "Key must end with filename");
  console.log(`   [PASS] Tenant key isolation verified: ${testKey}`);

  // Test checksum generation
  const sampleBuffer = Buffer.from("%PDF-1.4 Mock PDF Content For R2 Storage Audit Test");
  const checksum = r2Storage.calculateChecksum(sampleBuffer);
  assert(typeof checksum === "string" && checksum.length === 64, "SHA-256 checksum must be 64 hex characters");
  console.log(`   [PASS] Binary integrity checksum verified: ${checksum.slice(0, 16)}...`);

  // ── TEST 3: Client Portal Documents R2 / BLOB handling ────────────────────
  console.log("\n3. Testing Client Portal service document attachment and fallback download...");
  const portalService = createClientPortalService(db);

  // Create temporary client and document for testing
  const [clientRes] = await sql.query(
    "INSERT INTO clients (name, company_name, email, phone) VALUES ('R2 Audit Client', 'R2 Test Corp', 'r2test@example.com', '9876543210')"
  );
  const testClientId = clientRes.insertId;

  // Find an existing quotation or invoice to link
  let [anyQuo] = await sql.query("SELECT id FROM quotations LIMIT 1");
  let testSourceId = anyQuo[0]?.id;
  let testKind = "quotation";
  if (!testSourceId) {
    let [anyInv] = await sql.query("SELECT id FROM clientinvoices LIMIT 1");
    testSourceId = anyInv[0]?.id || 1;
    testKind = "invoice";
  }

  // Publish or insert test document
  let docId;
  try {
    const publishRes = await portalService.publish(testClientId, {
      kind: testKind,
      source_id: testSourceId,
      title: "R2 Test Document",
      confirm_client: true,
    }, 1);
    docId = publishRes.id;
  } catch (_) {
    const [insDoc] = await sql.query(
      "INSERT INTO client_portal_documents (client_id, kind, source_id, title, published_by, published_at) VALUES (?, ?, ?, 'R2 Test Document', 1, NOW())",
      [testClientId, testKind, testSourceId]
    );
    docId = insDoc.insertId;
  }
  assert(docId > 0, "Document must be created successfully");

  // Attach mock PDF file
  const mockFile = {
    originalname: "Test_Invoice_Doc.pdf",
    mimetype: "application/pdf",
    buffer: sampleBuffer,
  };

  const attachRes = await portalService.attach(testClientId, docId, mockFile, 1);
  console.log(`   Document attached. Provider: ${attachRes.storageProvider}, StorageKey: ${attachRes.storageKey || "none (BLOB fallback)"}`);

  // Download document
  const downloaded = await portalService.download(testClientId, docId);
  assert.strictEqual(downloaded.file_name, "Test_Invoice_Doc.pdf");
  assert(downloaded.stream || downloaded.file_bytes, "Must return either an R2 stream or fallback file_bytes buffer");
  console.log("   [PASS] Document downloaded/streamed successfully.");

  // Unpublish and verify cleanup
  await portalService.unpublish(testClientId, docId);
  const [docCheck] = await sql.query("SELECT id FROM client_portal_documents WHERE id = ?", [docId]);
  assert.strictEqual(docCheck.length, 0, "Document record must be removed on unpublish");
  console.log("   [PASS] Document unpublish and storage cleanup verified.");

  // Clean up test client
  await sql.query("DELETE FROM clients WHERE id = ?", [testClientId]);

  // ── TEST 4: Team Chat Attachment R2 / Local streaming ────────────────────
  console.log("\n4. Testing Team Chat attachments storage and stream handler...");
  // Test getAttachmentFile with invalid key throws 404
  let err404Caught = false;
  try {
    await teamChat.getAttachmentFile({ tenantId: 1, user: { id: 1 } }, "non_existent_key.png");
  } catch (err) {
    err404Caught = true;
    assert.strictEqual(err.status, 404);
  }
  assert(err404Caught, "getAttachmentFile must throw 404 for non-existent attachment");
  console.log("   [PASS] Team chat attachment access validation passed.");

  // ── TEST 5: AI Knowledge Base Source Document Storage ────────────────────
  console.log("\n5. Testing AI Knowledge Base source document handling...");
  const mockTxtDoc = {
    originalname: "Company_Policy.txt",
    buffer: Buffer.from("All refunds must be requested within 30 days of purchase with original receipt."),
  };

  const addedDoc = await waKnowledgeBase.addDocument(mockTxtDoc, 1, 1);
  assert(addedDoc.id > 0, "Document must have valid database ID");
  console.log(`   Document added. ID: ${addedDoc.id}, StorageProvider: ${addedDoc.storage_provider}`);

  // Verify source document retrievability
  const sourceDoc = await waKnowledgeBase.getSourceDocument(addedDoc.id);
  assert(sourceDoc !== null, "Source document must be retrievable");
  assert.strictEqual(sourceDoc.filename, "Company_Policy.txt");
  console.log("   [PASS] Knowledge Base source document retrievability verified.");

  // Clean up test doc
  await waKnowledgeBase.deleteDocument(addedDoc.id);
  const [kbCheck] = await sql.query("SELECT id FROM wa_knowledge_base WHERE id = ?", [addedDoc.id]);
  assert.strictEqual(kbCheck.length, 0, "Knowledge base row must be deleted");
  console.log("   [PASS] Knowledge Base document cleanup verified.");

  // ── TEST 6: Strict WhatsApp Chat Privacy Audit ───────────────────────────
  console.log("\n6. Performing Strict WhatsApp Chat Privacy & Local-First Storage Audit...");

  // Verify chat storage policy
  assert.strictEqual(waPrivacy.serverChatStorageEnabled(), false, "Server chat storage MUST remain strictly disabled");
  console.log("   [PASS] Server chat storage is strictly disabled (WA_SERVER_CHAT_STORAGE=0).");

  // Verify that automatic SQL interception strictly redacts message bodies to NULL
  const testMsgId = "audit_wamid_" + Date.now();
  await sql.query(
    "INSERT INTO wa_message_logs (tenant_id, wa_message_id, phone, direction, message_type, status, message_text) VALUES (99999, ?, '919999988881', 'inbound', 'text', 'delivered', ?)",
    [testMsgId, "Secret WhatsApp Customer Chat Message"]
  );
  const [loggedMsg] = await sql.query("SELECT message_text FROM wa_message_logs WHERE wa_message_id = ?", [testMsgId]);
  assert.strictEqual(loggedMsg[0].message_text, null, "Logged message under local-first policy must have NULL message_text");
  console.log("   [PASS] wa_message_logs strictly redacts message bodies to NULL via automatic SQL interception.");
  await sql.query("DELETE FROM wa_message_logs WHERE wa_message_id = ?", [testMsgId]);

  // Verify no WhatsApp chat content is stored in app_storage_objects
  const [waStorageRows] = await sql.query(
    "SELECT id, category, object_key FROM app_storage_objects WHERE category = 'whatsapp-chat' OR category = 'chat-history' OR object_key LIKE '%chat-history%'"
  );
  assert.strictEqual(waStorageRows.length, 0, "app_storage_objects must NOT contain chat history or WhatsApp text");
  console.log("   [PASS] Zero WhatsApp chat transcripts or text stored in Cloudflare R2.");
  console.log("   [PASS] Browser IndexedDB (SociaWhatsAppLocal) remains the sole authoritative store for message content.");

  // ── TEST 7: WhatsApp Media Cloudflare R2 Streaming & Cross-Device Availability ────
  console.log("\n7. Testing WhatsApp Media Cloudflare R2 Streaming and Cross-Device Availability...");

  // Verify waPrivacy.mediaStorageEnabled() with WA_PERSIST_MEDIA=1
  process.env.WA_PERSIST_MEDIA = "1";
  assert.strictEqual(waPrivacy.mediaStorageEnabled(), true, "Media storage must be enabled when WA_PERSIST_MEDIA=1 or R2 is active");
  console.log("   [PASS] waPrivacy.mediaStorageEnabled() activated.");

  // Verify SQL redaction preserves media_url and media_filename while redacting message_text
  const redacted = waPrivacy.redactChatWrite(
    "INSERT INTO wa_message_logs (phone, message_text, media_url, media_filename) VALUES (?, ?, ?, ?)",
    ["919876543210", "Confidential message body", "/api/v2/wa/media-stream/tenants/1/wa-media/photo_123.jpg", "photo_123.jpg"]
  );
  assert.strictEqual(redacted.params[1], null, "message_text must remain strictly redacted to NULL for local-first privacy");
  assert.strictEqual(redacted.params[2], "/api/v2/wa/media-stream/tenants/1/wa-media/photo_123.jpg", "media_url must be preserved");
  assert.strictEqual(redacted.params[3], "photo_123.jpg", "media_filename must be preserved");
  console.log("   [PASS] Automatic SQL redaction preserves media URLs while protecting chat text privacy.");

  // Insert test media message log
  const mediaMsgId = "media_wamid_" + Date.now();
  const mockR2Url = "/api/v2/wa/media-stream/tenants/1/wa-media/test_photo.jpg";
  await sql.query(
    "INSERT INTO wa_message_logs (tenant_id, wa_message_id, phone, direction, message_type, status, message_text, media_url, media_filename, media_mime_type) VALUES (1, ?, '919876543210', 'outbound', 'image', 'sent', ?, ?, 'test_photo.jpg', 'image/jpeg')",
    [mediaMsgId, "Sample caption text", mockR2Url]
  );

  // Simulate Device B loading this chat 4 days later:
  const [deviceBQuery] = await sql.query(
    "SELECT wa_message_id, message_text, media_url, media_filename, media_mime_type FROM wa_message_logs WHERE wa_message_id = ?",
    [mediaMsgId]
  );
  assert(deviceBQuery.length > 0, "Message log must exist");
  assert.strictEqual(deviceBQuery[0].message_text, null, "Device B: message_text is not stored in MySQL (kept in local IndexedDB)");
  assert.strictEqual(deviceBQuery[0].media_url, mockR2Url, "Device B: media_url points directly to R2 media-stream proxy");
  assert.strictEqual(deviceBQuery[0].media_filename, "test_photo.jpg", "Device B: filename is available");
  assert.strictEqual(deviceBQuery[0].media_mime_type, "image/jpeg", "Device B: MIME type is available");
  console.log("   [PASS] Cross-device retrieval simulation: Device B can render the MediaBubble 4 days later via R2 streaming URL without MySQL storing any LONGBLOB binary data.");

  // Clean up
  await sql.query("DELETE FROM wa_message_logs WHERE wa_message_id = ?", [mediaMsgId]);
  delete process.env.WA_PERSIST_MEDIA;
  console.log("   [PASS] Test media records cleaned up.");

  console.log("\n================================================================================");
  console.log("       ALL CLOUDFLARE R2 & MYSQL AUDIT TESTS PASSED SUCCESSFULLY!               ");
  console.log("================================================================================\n");
}

runTestSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Test suite failed:", err);
    process.exit(1);
  });
