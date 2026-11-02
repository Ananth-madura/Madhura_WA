const mammoth = require("mammoth");
const pdfParse = require("pdf-parse");
const db = require("../config/database");

const MAX_CHARS_PER_DOC = 25000; // keep any single doc from dominating the AI prompt
const MAX_TOTAL_CONTEXT_CHARS = 16000; // total budget across all docs injected into a reply

function queryAsync(sql, params) {
  return new Promise((resolve, reject) => {
    db.query(sql, params || [], (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

async function extractText(file) {
  const ext = (file.originalname.split(".").pop() || "").toLowerCase();

  // 1. PDF Documents (.pdf)
  if (ext === "pdf") {
    try {
      const data = await pdfParse(file.buffer);
      return { text: data.text || "", fileType: "pdf" };
    } catch (err) {
      throw new Error(`Failed to parse PDF document: ${err.message}`);
    }
  }

  // 2. Word Documents (.docx)
  if (ext === "docx") {
    try {
      const { value } = await mammoth.extractRawText({ buffer: file.buffer });
      return { text: value, fileType: "docx" };
    } catch (err) {
      throw new Error(`Failed to parse Word document: ${err.message}`);
    }
  }

  // 3. Text, Markdown, CSV, TSV, JSON, HTML
  if (["txt", "md", "csv", "tsv", "json", "html", "xml"].includes(ext)) {
    return { text: file.buffer.toString("utf-8"), fileType: ext };
  }

  throw new Error(`Unsupported document format '.${ext}'. Supported formats: .pdf, .docx, .txt, .md, .csv, .json, .tsv`);
}

async function addDocument(file, userId, tenantId = 1) {
  const { text, fileType } = await extractText(file);
  const trimmed = text.trim().slice(0, MAX_CHARS_PER_DOC);
  if (!trimmed) throw new Error("Document appears to be empty or could not be read");

  const r2Storage = require("./r2StorageService");
  let storageKey = null;
  let storageProvider = "db";

  if (r2Storage.isConfigured()) {
    try {
      const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      storageKey = r2Storage.tenantKey(tenantId, "knowledge-base", `${Date.now()}_${sanitizedName}`);
      const uploadRes = await r2Storage.uploadPrivateObject(file.buffer, storageKey, file.mimetype || "application/octet-stream", {
        filename: file.originalname,
        uploadedBy: String(userId || ""),
        tenantId: String(tenantId),
      });
      if (uploadRes.success) {
        storageProvider = "r2";
      } else {
        storageKey = null;
      }
    } catch (e) {
      console.warn("[KnowledgeBase] R2 upload fallback to database:", e.message);
      storageKey = null;
    }
  }

  const result = await queryAsync(
    "INSERT INTO wa_knowledge_base (filename, file_type, content, char_count, storage_key, storage_provider, uploaded_by) VALUES (?,?,?,?,?,?,?)",
    [file.originalname, fileType, trimmed, trimmed.length, storageKey, storageProvider, userId || null]
  );
  return { id: result.insertId, filename: file.originalname, file_type: fileType, char_count: trimmed.length, storage_key: storageKey, storage_provider: storageProvider };
}

async function listDocuments() {
  return queryAsync("SELECT id, filename, file_type, char_count, storage_key, storage_provider, created_at FROM wa_knowledge_base ORDER BY created_at DESC");
}

async function deleteDocument(id) {
  const rows = await queryAsync("SELECT id, storage_key, storage_provider FROM wa_knowledge_base WHERE id = ?", [id]);
  if (rows && rows[0]?.storage_key && rows[0].storage_provider === "r2") {
    try {
      const r2Storage = require("./r2StorageService");
      if (r2Storage.isConfigured()) {
        await r2Storage.deleteObject(rows[0].storage_key);
      }
    } catch (_) {}
  }
  await queryAsync("DELETE FROM wa_knowledge_base WHERE id = ?", [id]);
}

async function getSourceDocument(id) {
  const rows = await queryAsync("SELECT id, filename, file_type, content, storage_key, storage_provider FROM wa_knowledge_base WHERE id = ?", [id]);
  if (!rows || !rows.length) return null;
  const doc = rows[0];

  const r2Storage = require("./r2StorageService");
  if (doc.storage_key && (doc.storage_provider === "r2" || r2Storage.isConfigured())) {
    try {
      const streamRes = await r2Storage.getMediaStream(doc.storage_key);
      if (streamRes && streamRes.Body) {
        return {
          filename: doc.filename,
          stream: streamRes.Body,
          contentLength: streamRes.ContentLength,
          fileType: doc.file_type,
        };
      }
    } catch (_) {}
  }

  return {
    filename: doc.filename,
    content: doc.content,
    fileType: doc.file_type,
  };
}

// Builds a bounded context block for the AI system prompt from all uploaded docs.
async function buildContext() {
  const docs = await queryAsync("SELECT filename, content FROM wa_knowledge_base ORDER BY created_at DESC");
  if (!docs.length) return "";

  let budget = MAX_TOTAL_CONTEXT_CHARS;
  const parts = [];
  for (const doc of docs) {
    if (budget <= 0) break;
    const chunk = doc.content.slice(0, budget);
    parts.push(`=== DOCUMENT: ${doc.filename} ===\n${chunk}`);
    budget -= chunk.length;
  }
  return parts.join("\n\n");
}

module.exports = { addDocument, listDocuments, deleteDocument, getSourceDocument, buildContext };
