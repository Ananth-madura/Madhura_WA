"use strict";

const crypto = require("crypto");

function createDbHelper(db) {
  const getDb = () => db || require("../../config/database");

  async function query(sql, params = []) {
    const conn = getDb();
    if (conn.promise) {
      const [rows] = await conn.promise().query(sql, params);
      return rows;
    }
    if (typeof conn.query === "function") {
      return new Promise((resolve, reject) => {
        conn.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
      });
    }
    const stmt = conn.prepare(sql);
    if (/^\s*(SELECT|PRAGMA)/i.test(sql)) return stmt.all(...params);
    const info = stmt.run(...params);
    return { insertId: info.lastInsertRowid, affectedRows: info.changes };
  }

  async function queryOne(sql, params = []) {
    const rows = await query(sql, params);
    return Array.isArray(rows) ? rows[0] || null : null;
  }

  function isSqlite() {
    return Boolean(getDb().isSqlite);
  }

  function nowIso() {
    return new Date().toISOString().replace("T", " ").slice(0, 19);
  }

  return { query, queryOne, isSqlite, nowIso, getDb };
}

function assertTenantId(tenantId) {
  const tid = Number(tenantId);
  if (!Number.isSafeInteger(tid) || tid < 1) {
    const err = new Error("Valid tenant context is required");
    err.status = 403;
    err.code = "TENANT_REQUIRED";
    throw err;
  }
  return tid;
}

function normalizePhone(raw, defaultCountryCode = "91") {
  if (!raw && raw !== 0) return { valid: false, normalized: "", countryCode: "", reason: "missing_phone" };
  const str = String(raw).trim();
  if (!str) return { valid: false, normalized: "", countryCode: "", reason: "missing_phone" };
  if (/[a-zA-Z]/.test(str.replace(/@c\.us$/i, ""))) {
    return { valid: false, normalized: "", countryCode: "", reason: "invalid_characters" };
  }
  let digits = str.replace(/@c\.us$/i, "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10 && defaultCountryCode) {
    digits = String(defaultCountryCode).replace(/\D/g, "") + digits;
  }
  if (digits.length < 10 || digits.length > 15) {
    return { valid: false, normalized: digits, countryCode: "", reason: "invalid_length" };
  }
  const countryCode = detectIsoCountry(digits);
  return { valid: true, normalized: digits, countryCode, reason: null };
}

function detectIsoCountry(digits) {
  const d = String(digits || "");
  if (d.startsWith("91") && d.length === 12) return "IN";
  if (d.startsWith("1") && d.length === 11) return "US";
  if (d.startsWith("44")) return "GB";
  if (d.startsWith("971")) return "AE";
  if (d.startsWith("65")) return "SG";
  if (d.startsWith("61")) return "AU";
  if (d.startsWith("49")) return "DE";
  if (d.startsWith("55")) return "BR";
  return "OTHER";
}

function safeJsonParse(val, fallback = null) {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "object") return val;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

function generateUid(prefix = "id") {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

function httpError(message, status = 400, code = "BAD_REQUEST") {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

module.exports = {
  createDbHelper,
  assertTenantId,
  normalizePhone,
  detectIsoCountry,
  safeJsonParse,
  generateUid,
  httpError,
};
