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

async function addDocument(file, userId) {
  const { text, fileType } = await extractText(file);
  const trimmed = text.trim().slice(0, MAX_CHARS_PER_DOC);
  if (!trimmed) throw new Error("Document appears to be empty or could not be read");

  const result = await queryAsync(
    "INSERT INTO wa_knowledge_base (filename, file_type, content, char_count, uploaded_by) VALUES (?,?,?,?,?)",
    [file.originalname, fileType, trimmed, trimmed.length, userId || null]
  );
  return { id: result.insertId, filename: file.originalname, file_type: fileType, char_count: trimmed.length };
}

async function listDocuments() {
  return queryAsync("SELECT id, filename, file_type, char_count, created_at FROM wa_knowledge_base ORDER BY created_at DESC");
}

async function deleteDocument(id) {
  await queryAsync("DELETE FROM wa_knowledge_base WHERE id = ?", [id]);
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

module.exports = { addDocument, listDocuments, deleteDocument, buildContext };
