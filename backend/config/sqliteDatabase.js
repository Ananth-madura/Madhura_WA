/**
 * sqliteDatabase.js — Embedded SQLite engine backed by Cloudflare R2 Persistent Storage.
 *
 * Implements a drop-in MySQL2-compatible database driver interface on top of
 * Node.js's built-in node:sqlite module (DatabaseSync).
 *
 * Automatically restores from Cloudflare R2 on container boot, runs all CRM & WhatsApp
 * operations with sub-millisecond local latency, and periodically backs up the
 * SQLite database snapshot to Cloudflare R2 so state persists forever across
 * Render restarts and deployments.
 */

const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { DatabaseSync } = require("node:sqlite");
const r2Storage = require("../services/r2StorageService");
const { dataDir, uploadsDir } = require("./runtimePaths");

function mysqlToSqliteSchema(sql) {
  return sql
    .replace(/\bINT\s+AUTO_INCREMENT\s+PRIMARY\s+KEY\b/gi, "INTEGER PRIMARY KEY AUTOINCREMENT")
    .replace(/\bAUTO_INCREMENT\b/gi, "")
    .replace(/\bENGINE\s*=\s*InnoDB[^\;]*/gi, "")
    .replace(/\bDEFAULT\s+CHARSET\s*=\s*[a-zA-Z0-9_-]+/gi, "")
    .replace(/\bCOLLATE\s*=\s*[a-zA-Z0-9_.-]+/gi, "")
    .replace(/\bDEFAULT\s+CURRENT_TIMESTAMP\s+ON\s+UPDATE\s+CURRENT_TIMESTAMP\b/gi, "DEFAULT CURRENT_TIMESTAMP")
    .replace(/\bENUM\s*\([^\)]+\)/gi, "TEXT")
    .replace(/\bJSON\b/gi, "TEXT")
    .replace(/\bTINYINT\s*\([0-9]+\)/gi, "INTEGER")
    .replace(/\bTINYINT\b/gi, "INTEGER")
    .replace(/\bSMALLINT\s*\([0-9]+\)/gi, "INTEGER")
    .replace(/\bINT\s*\([0-9]+\)/gi, "INTEGER")
    .replace(/\bBIGINT\s*\([0-9]+\)/gi, "INTEGER")
    .replace(/\bVARCHAR\s*\([0-9]+\)/gi, "TEXT")
    .replace(/\bCHAR\s*\([0-9]+\)/gi, "TEXT")
    .replace(/\bDECIMAL\s*\([0-9,\s]+\)/gi, "REAL")
    .replace(/\bDOUBLE\b/gi, "REAL")
    .replace(/\bFLOAT\b/gi, "REAL")
    .replace(/\bDATETIME\b/gi, "TEXT")
    .replace(/\bTIMESTAMP\b/gi, "TEXT")
    .replace(/\bUNIQUE\s+KEY\s+[a-zA-Z0-9_]+\s*\(/gi, "UNIQUE (")
    .replace(/,\s*KEY\s+[a-zA-Z0-9_]+\s*\([^\)]+\)/gi, "")
    .replace(/,\s*INDEX\s+[a-zA-Z0-9_]+\s*\([^\)]+\)/gi, "");
}

function translateMySqlToSqlite(sql) {
  let s = String(sql || "").trim();
  // Strip trailing semicolon
  if (s.endsWith(";")) s = s.slice(0, -1);

  // If SHOW TABLES
  if (/^SHOW\s+TABLES\b/i.test(s)) {
    return "SELECT name AS Tables_in_database FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'";
  }

  // Handle MySQL ALTER TABLE ... ADD INDEX / ADD UNIQUE INDEX / ADD UNIQUE KEY
  const addIndexMatch = s.match(/^ALTER\s+TABLE\s+[`"']?([a-zA-Z0-9_]+)[`"']?\s+ADD\s+(UNIQUE\s+)?(?:INDEX|KEY)\s+[`"']?([a-zA-Z0-9_]+)[`"']?\s*\((.+)\)/i);
  if (addIndexMatch) {
    const tbl = addIndexMatch[1];
    const isUnique = Boolean(addIndexMatch[2]);
    const idxName = addIndexMatch[3];
    const cols = addIndexMatch[4];
    return `CREATE ${isUnique ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS "${idxName}" ON "${tbl}" (${cols})`;
  }

  // Handle ALTER TABLE table ADD UNIQUE (cols)
  const addUniqueMatch = s.match(/^ALTER\s+TABLE\s+[`"']?([a-zA-Z0-9_]+)[`"']?\s+ADD\s+UNIQUE\s*(?:\((.+)\)|\`?([a-zA-Z0-9_]+)\`?\s*\((.+)\))/i);
  if (addUniqueMatch) {
    const tbl = addUniqueMatch[1];
    const idxName = addUniqueMatch[3] || `uniq_${tbl}_${Date.now()}`;
    const cols = addUniqueMatch[4] || addUniqueMatch[2];
    return `CREATE UNIQUE INDEX IF NOT EXISTS "${idxName}" ON "${tbl}" (${cols})`;
  }

  // Handle ALTER TABLE ... MODIFY / CHANGE COLUMN (no-op in SQLite)
  if (/^ALTER\s+TABLE\s+[`"']?[a-zA-Z0-9_]+[`"']?\s+(MODIFY|CHANGE)\b/i.test(s)) {
    return "SELECT 1";
  }

  // Handle ALTER TABLE ... DROP INDEX / FOREIGN KEY / CONSTRAINT
  const dropIdxMatch = s.match(/^ALTER\s+TABLE\s+[`"']?[a-zA-Z0-9_]+[`"']?\s+DROP\s+INDEX\s+[`"']?([a-zA-Z0-9_]+)[`"']?/i);
  if (dropIdxMatch) {
    return `DROP INDEX IF EXISTS "${dropIdxMatch[1]}"`;
  }
  if (/^ALTER\s+TABLE\s+[`"']?[a-zA-Z0-9_]+[`"']?\s+(DROP\s+FOREIGN\s+KEY|DROP\s+CONSTRAINT|ADD\s+CONSTRAINT)\b/i.test(s)) {
    return "SELECT 1";
  }

  // If CREATE TABLE or ALTER TABLE, apply schema conversion
  if (/^(CREATE|ALTER)\s+TABLE\b/i.test(s)) {
    s = mysqlToSqliteSchema(s);
  }

  // Convert INSERT IGNORE to INSERT OR IGNORE
  s = s.replace(/\bINSERT\s+IGNORE\b/gi, "INSERT OR IGNORE");

  // Convert VALUES(col) inside ON DUPLICATE KEY UPDATE to excluded.col
  s = s.replace(/\bVALUES\s*\(\s*([a-zA-Z0-9_]+)\s*\)/gi, "excluded.$1");

  // Convert ON DUPLICATE KEY UPDATE to ON CONFLICT DO UPDATE SET
  s = s.replace(/\bON\s+DUPLICATE\s+KEY\s+UPDATE\b/gi, "ON CONFLICT DO UPDATE SET");

  // ── Date and Interval Expressions Translation ──
  // 1. DATE_SUB(dateExpr, INTERVAL n UNIT) or DATE_SUB(dateExpr, INTERVAL ? UNIT)
  s = s.replace(/DATE_SUB\s*\(\s*(NOW\(\)|CURRENT_TIMESTAMP)\s*,\s*INTERVAL\s+([0-9]+)\s+([a-zA-Z]+)\s*\)/gi, (m, d, n, u) => {
    return `datetime('now', '-${n} ${u.toLowerCase()}')`;
  });
  s = s.replace(/DATE_SUB\s*\(\s*(NOW\(\)|CURRENT_TIMESTAMP)\s*,\s*INTERVAL\s+(\?)\s+([a-zA-Z]+)\s*\)/gi, (m, d, q, u) => {
    return `datetime('now', '-' || ? || ' ${u.toLowerCase()}')`;
  });
  s = s.replace(/DATE_SUB\s*\(\s*CURDATE\(\)\s*,\s*INTERVAL\s+([0-9]+)\s+([a-zA-Z]+)\s*\)/gi, (m, n, u) => {
    return `date('now', '-${n} ${u.toLowerCase()}')`;
  });
  s = s.replace(/DATE_SUB\s*\(\s*CURDATE\(\)\s*,\s*INTERVAL\s+(\?)\s+([a-zA-Z]+)\s*\)/gi, (m, q, u) => {
    return `date('now', '-' || ? || ' ${u.toLowerCase()}')`;
  });
  s = s.replace(/DATE_SUB\s*\(\s*([a-zA-Z0-9_.]+)\s*,\s*INTERVAL\s+([0-9]+)\s+([a-zA-Z]+)\s*\)/gi, (m, col, n, u) => {
    return `datetime(${col}, '-${n} ${u.toLowerCase()}')`;
  });
  s = s.replace(/DATE_SUB\s*\(\s*([a-zA-Z0-9_.]+)\s*,\s*INTERVAL\s+(\?)\s+([a-zA-Z]+)\s*\)/gi, (m, col, q, u) => {
    return `datetime(${col}, '-' || ? || ' ${u.toLowerCase()}')`;
  });

  // 2. DATE_ADD(dateExpr, INTERVAL n UNIT) or DATE_ADD(dateExpr, INTERVAL ? UNIT)
  s = s.replace(/DATE_ADD\s*\(\s*(NOW\(\)|CURRENT_TIMESTAMP)\s*,\s*INTERVAL\s+([0-9]+)\s+([a-zA-Z]+)\s*\)/gi, (m, d, n, u) => {
    return `datetime('now', '+${n} ${u.toLowerCase()}')`;
  });
  s = s.replace(/DATE_ADD\s*\(\s*(NOW\(\)|CURRENT_TIMESTAMP)\s*,\s*INTERVAL\s+(\?)\s+([a-zA-Z]+)\s*\)/gi, (m, d, q, u) => {
    return `datetime('now', '+' || ? || ' ${u.toLowerCase()}')`;
  });
  s = s.replace(/DATE_ADD\s*\(\s*CURDATE\(\)\s*,\s*INTERVAL\s+([0-9]+)\s+([a-zA-Z]+)\s*\)/gi, (m, n, u) => {
    return `date('now', '+${n} ${u.toLowerCase()}')`;
  });
  s = s.replace(/DATE_ADD\s*\(\s*CURDATE\(\)\s*,\s*INTERVAL\s+(\?)\s+([a-zA-Z]+)\s*\)/gi, (m, q, u) => {
    return `date('now', '+' || ? || ' ${u.toLowerCase()}')`;
  });
  s = s.replace(/DATE_ADD\s*\(\s*([a-zA-Z0-9_.]+)\s*,\s*INTERVAL\s+([0-9]+)\s+([a-zA-Z]+)\s*\)/gi, (m, col, n, u) => {
    return `datetime(${col}, '+${n} ${u.toLowerCase()}')`;
  });
  s = s.replace(/DATE_ADD\s*\(\s*([a-zA-Z0-9_.]+)\s*,\s*INTERVAL\s+(\?)\s+([a-zA-Z]+)\s*\)/gi, (m, col, q, u) => {
    return `datetime(${col}, '+' || ? || ' ${u.toLowerCase()}')`;
  });

  // 3. NOW() - INTERVAL / NOW() + INTERVAL
  s = s.replace(/NOW\(\)\s*-\s*INTERVAL\s+([0-9]+)\s+([a-zA-Z]+)/gi, (m, n, u) => {
    return `datetime('now', '-${n} ${u.toLowerCase()}')`;
  });
  s = s.replace(/NOW\(\)\s*-\s*INTERVAL\s+(\?)\s+([a-zA-Z]+)/gi, (m, q, u) => {
    return `datetime('now', '-' || ? || ' ${u.toLowerCase()}')`;
  });
  s = s.replace(/NOW\(\)\s*\+\s*INTERVAL\s+([0-9]+)\s+([a-zA-Z]+)/gi, (m, n, u) => {
    return `datetime('now', '+${n} ${u.toLowerCase()}')`;
  });
  s = s.replace(/NOW\(\)\s*\+\s*INTERVAL\s+(\?)\s+([a-zA-Z]+)/gi, (m, q, u) => {
    return `datetime('now', '+' || ? || ' ${u.toLowerCase()}')`;
  });

  // 4. CURDATE() + INTERVAL / CURDATE() - INTERVAL
  s = s.replace(/CURDATE\(\)\s*\+\s*INTERVAL\s+([0-9]+)\s+([a-zA-Z]+)/gi, (m, n, u) => {
    return `date('now', '+${n} ${u.toLowerCase()}')`;
  });
  s = s.replace(/CURDATE\(\)\s*-\s*INTERVAL\s+([0-9]+)\s+([a-zA-Z]+)/gi, (m, n, u) => {
    return `date('now', '-${n} ${u.toLowerCase()}')`;
  });

  return s;
}

class SQLiteDatabaseAdapter {
  constructor() {
    this.sqlite = null;
    this.dbPath = null;
    this.isReady = false;
    this.isSqlite = true;
    this.r2Enabled = false;
    this.initPromise = null;
  }

  async initialize(customDbPath = null) {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this._doInitialize(customDbPath);
    return this.initPromise;
  }

  async _doInitialize(customDbPath = null) {
    const defaultDir = dataDir || path.join(__dirname, "..");
    if (!fs.existsSync(defaultDir)) {
      try { fs.mkdirSync(defaultDir, { recursive: true }); } catch (_) {}
    }

    this.dbPath = customDbPath || path.join(defaultDir, "database.sqlite");

    // 1. Check & restore from Cloudflare R2 if configured
    if (r2Storage.isConfigured()) {
      try {
        const restoreResult = await r2Storage.downloadDatabaseFromR2(this.dbPath);
        if (restoreResult.restored) {
          this.r2Enabled = true;
        }
      } catch (err) {
        console.warn("⚠️ [Cloudflare R2] Initial restore attempt skipped:", err.message);
      }
    }

    // 2. Open SQLite database with WAL mode for high concurrency
    const parent = path.dirname(this.dbPath);
    if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true });

    this.sqlite = new DatabaseSync(this.dbPath);
    this.sqlite.exec("PRAGMA journal_mode = WAL;");
    this.sqlite.exec("PRAGMA synchronous = NORMAL;");
    this.sqlite.exec("PRAGMA foreign_keys = ON;");
    this.sqlite.exec("PRAGMA busy_timeout = 5000;");
    this.sqlite.exec("PRAGMA cache_size = -64000;");
    this.sqlite.exec("PRAGMA temp_store = MEMORY;");
    this.sqlite.exec("PRAGMA mmap_size = 268435456;");

    // 3. Register MySQL-compatible user-defined SQL functions
    this.sqlite.function("now", () => new Date().toISOString().replace("T", " ").substring(0, 19));
    this.sqlite.function("curdate", () => new Date().toISOString().split("T")[0]);
    this.sqlite.function("concat", (...args) => args.map((a) => (a === null || a === undefined ? "" : a)).join(""));
    this.sqlite.function("ifnull", (a, b) => (a !== null && a !== undefined ? a : b));
    this.sqlite.function("if", (cond, valTrue, valFalse) => cond ? valTrue : valFalse);
    this.sqlite.function("database", () => "madhurawa");
    this.sqlite.function("rand", () => Math.random());
    this.sqlite.function("substring", (str, start, len) => len !== undefined ? String(str || "").substring(start - 1, start - 1 + len) : String(str || "").substring(start - 1));
    this.sqlite.function("datediff", (d1, d2) => Math.round((new Date(d1) - new Date(d2)) / (1000 * 60 * 60 * 24)));
    this.sqlite.function("unix_timestamp", (d) => (d ? Math.floor(new Date(d).getTime() / 1000) : Math.floor(Date.now() / 1000)));

    // 4. Create all CRM and WhatsApp tables and seed initial users
    this.createCoreTables();
    await this.seedDefaultAdmin();

    // 5. Start Cloudflare R2 automated background sync schedule
    if (r2Storage.isConfigured()) {
      this.r2Enabled = true;
      r2Storage.beforeUploadCallback = () => this.checkpoint();
      r2Storage.startSyncSchedule(this.dbPath, 120000); // sync every 2 mins
      setTimeout(() => {
        r2Storage.uploadDatabaseToR2(this.dbPath).catch(() => {});
      }, 3000);
    }

    this.isReady = true;
    console.log(`✨ [SQLite Engine] Active at "${this.dbPath}" ${this.r2Enabled ? "(Backed by Cloudflare R2)" : "(Local persistence)"}`);
    return this;
  }

  checkpoint() {
    if (this.sqlite) {
      try {
        this.sqlite.exec("PRAGMA wal_checkpoint(TRUNCATE);");
      } catch (_) {}
    }
  }

  createCoreTables() {
    const schemas = [
      // ── Auth & Users ──
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT DEFAULT NULL,
        last_name TEXT DEFAULT NULL,
        emp_id TEXT DEFAULT NULL,
        email TEXT NOT NULL UNIQUE,
        user_password TEXT DEFAULT NULL,
        role TEXT DEFAULT 'admin',
        status TEXT DEFAULT 'active',
        two_factor_enabled INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS teammember (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT DEFAULT NULL,
        last_name TEXT DEFAULT NULL,
        emp_id TEXT DEFAULT 'EMP001',
        emp_email TEXT DEFAULT NULL,
        mobile TEXT DEFAULT NULL,
        mobile_number TEXT DEFAULT NULL,
        emp_address TEXT DEFAULT NULL,
        job_title TEXT DEFAULT 'Administrator',
        emp_role TEXT DEFAULT 'Admin',
        quotation_count INTEGER DEFAULT 0,
        user_id INTEGER DEFAULT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS email_otp (
        email TEXT PRIMARY KEY,
        otp TEXT DEFAULT NULL,
        expires_at TEXT DEFAULT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS user_email_configs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE,
        email_user TEXT NOT NULL,
        email_pass TEXT NOT NULL,
        smtp_host TEXT DEFAULT 'smtp.gmail.com',
        smtp_port INTEGER DEFAULT 587,
        smtp_secure TEXT DEFAULT 'STARTTLS',
        from_email_address TEXT DEFAULT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS admin_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT DEFAULT 'registration',
        user_id INTEGER DEFAULT NULL,
        message TEXT DEFAULT NULL,
        related_id INTEGER DEFAULT NULL,
        related_type TEXT DEFAULT NULL,
        created_by INTEGER DEFAULT NULL,
        priority TEXT DEFAULT 'normal',
        is_read INTEGER DEFAULT 0,
        is_archived INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS profile_change_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        field TEXT NOT NULL,
        new_value TEXT DEFAULT NULL,
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        admin_response_at TEXT DEFAULT NULL
      )`,

      // ── CRM Clients & Leads ──
      `CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        company_name TEXT DEFAULT NULL,
        email TEXT DEFAULT NULL,
        phone TEXT DEFAULT NULL,
        alternate_phone TEXT DEFAULT NULL,
        address TEXT DEFAULT NULL,
        city TEXT DEFAULT NULL,
        state TEXT DEFAULT NULL,
        pincode TEXT DEFAULT NULL,
        service TEXT DEFAULT NULL,
        gst_number TEXT DEFAULT NULL,
        notes TEXT DEFAULT NULL,
        client_status TEXT DEFAULT 'active',
        created_by INTEGER DEFAULT NULL,
        assigned_teammember_id INTEGER DEFAULT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS client_shares (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        shared_by INTEGER DEFAULT NULL,
        shared_to INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_name TEXT NOT NULL,
        mobile_number TEXT DEFAULT NULL,
        email TEXT DEFAULT NULL,
        gst_number TEXT DEFAULT NULL,
        location_city TEXT DEFAULT NULL,
        created_by INTEGER DEFAULT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS telecalls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_name TEXT DEFAULT NULL,
        company_name TEXT DEFAULT NULL,
        mobile_number TEXT DEFAULT NULL,
        email TEXT DEFAULT NULL,
        status TEXT DEFAULT 'Pending',
        service TEXT DEFAULT NULL,
        service_name TEXT DEFAULT NULL,
        remarks TEXT DEFAULT NULL,
        location_city TEXT DEFAULT NULL,
        followup_date TEXT DEFAULT NULL,
        followup_notes TEXT DEFAULT NULL,
        source TEXT DEFAULT 'Telecalling',
        wa_followup_sent_date TEXT DEFAULT NULL,
        created_by INTEGER DEFAULT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS walkins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_name TEXT DEFAULT NULL,
        company_name TEXT DEFAULT NULL,
        mobile_number TEXT DEFAULT NULL,
        email TEXT DEFAULT NULL,
        status TEXT DEFAULT 'Pending',
        service TEXT DEFAULT NULL,
        remarks TEXT DEFAULT NULL,
        location_city TEXT DEFAULT NULL,
        assigned_to INTEGER DEFAULT NULL,
        created_by INTEGER DEFAULT NULL,
        wa_notified INTEGER DEFAULT 0,
        wa_followup_sent_date TEXT DEFAULT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS fields (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_name TEXT DEFAULT NULL,
        company_name TEXT DEFAULT NULL,
        mobile_number TEXT DEFAULT NULL,
        email TEXT DEFAULT NULL,
        status TEXT DEFAULT 'Pending',
        service TEXT DEFAULT NULL,
        remarks TEXT DEFAULT NULL,
        location_city TEXT DEFAULT NULL,
        assigned_to INTEGER DEFAULT NULL,
        created_by INTEGER DEFAULT NULL,
        wa_followup_sent_date TEXT DEFAULT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS contracts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_company TEXT DEFAULT NULL,
        customer_name TEXT DEFAULT NULL,
        mobile_number TEXT DEFAULT NULL,
        email TEXT DEFAULT NULL,
        contract_type TEXT DEFAULT 'Service',
        quotation_id INTEGER DEFAULT NULL,
        amount_value REAL DEFAULT 0,
        remaining REAL DEFAULT 0,
        location_city TEXT DEFAULT NULL,
        created_by INTEGER DEFAULT NULL,
        wa_notified INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,

      // ── Quotations & Invoices ──
      `CREATE TABLE IF NOT EXISTS quotations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        quotation_date TEXT NOT NULL,
        subtotal REAL DEFAULT 0,
        total_tax REAL DEFAULT 0,
        total_discount REAL DEFAULT 0,
        grand_total REAL DEFAULT 0,
        created_by INTEGER DEFAULT NULL,
        total_cgst REAL DEFAULT 0,
        total_sgst REAL DEFAULT 0,
        total_igst REAL DEFAULT 0,
        reference_no TEXT DEFAULT NULL,
        client_company TEXT DEFAULT NULL,
        client_city TEXT DEFAULT NULL,
        exec_name TEXT DEFAULT NULL,
        exec_phone TEXT DEFAULT NULL,
        exec_email TEXT DEFAULT NULL,
        status TEXT DEFAULT 'Pending',
        wa_notified INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS quotation_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quotation_id INTEGER NOT NULL,
        product_number INTEGER NOT NULL,
        description TEXT NOT NULL,
        brand_model TEXT DEFAULT NULL,
        price REAL NOT NULL,
        quantity INTEGER NOT NULL,
        subtotal REAL NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS clientinvoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_company TEXT DEFAULT NULL,
        project_names TEXT DEFAULT NULL,
        invoice_date TEXT DEFAULT NULL,
        invoice_duedate TEXT DEFAULT NULL,
        category TEXT DEFAULT 'Default',
        created_by INTEGER DEFAULT NULL,
        wa_payment_due_sent INTEGER DEFAULT 0,
        wa_notified INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS performainvoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        invoice_date TEXT NOT NULL,
        subtotal REAL DEFAULT 0,
        total_tax REAL DEFAULT 0,
        grand_total REAL DEFAULT 0,
        created_by INTEGER DEFAULT NULL,
        reference_no TEXT DEFAULT NULL,
        client_company TEXT DEFAULT NULL,
        status TEXT DEFAULT 'Pending',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS performainvoice_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER NOT NULL,
        product_number INTEGER NOT NULL,
        description TEXT NOT NULL,
        price REAL NOT NULL,
        quantity INTEGER NOT NULL,
        subtotal REAL NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS estimate_invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        invoice_date TEXT NOT NULL,
        grand_total REAL DEFAULT 0,
        client_company TEXT DEFAULT NULL,
        created_by INTEGER DEFAULT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS estimate_invoice_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER NOT NULL,
        description TEXT NOT NULL,
        price REAL NOT NULL,
        quantity INTEGER NOT NULL,
        subtotal REAL NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS estimate_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        estimate_id INTEGER NOT NULL,
        description TEXT NOT NULL,
        price REAL NOT NULL,
        quantity INTEGER NOT NULL,
        subtotal REAL NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER DEFAULT NULL,
        amount REAL NOT NULL,
        payment_date TEXT NOT NULL,
        payment_method TEXT DEFAULT 'Paypal',
        Transaction_ID TEXT DEFAULT NULL,
        invoice_email TEXT DEFAULT NULL,
        wa_notified INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS pi_from_addresses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        label TEXT NOT NULL,
        address TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER DEFAULT NULL,
        receiver_id INTEGER DEFAULT NULL,
        message TEXT DEFAULT NULL,
        type TEXT DEFAULT NULL,
        seen INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,

      // ── Services & Field Maintenance ──
      `CREATE TABLE IF NOT EXISTS services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client TEXT DEFAULT NULL,
        material TEXT DEFAULT NULL,
        warranty TEXT DEFAULT NULL,
        amc INTEGER DEFAULT 0,
        date TEXT DEFAULT NULL,
        engineer_name TEXT DEFAULT NULL,
        created_by INTEGER DEFAULT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS service_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service_id INTEGER NOT NULL,
        product_number INTEGER NOT NULL,
        description TEXT NOT NULL,
        price REAL NOT NULL,
        quantity INTEGER NOT NULL,
        subtotal REAL NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS service_estimations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        invoice_date TEXT NOT NULL,
        grand_total REAL DEFAULT 0,
        client_company TEXT DEFAULT NULL,
        created_by INTEGER DEFAULT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS service_estimation_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER NOT NULL,
        description TEXT NOT NULL,
        price REAL NOT NULL,
        quantity INTEGER NOT NULL,
        subtotal REAL NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS amc_alc_services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contract_id INTEGER NOT NULL,
        service_type TEXT DEFAULT 'AMC',
        customer_name TEXT DEFAULT NULL,
        mobile_number TEXT DEFAULT NULL,
        location_city TEXT DEFAULT NULL,
        service_date TEXT NOT NULL,
        technician TEXT DEFAULT NULL,
        sales_person TEXT DEFAULT NULL,
        status TEXT DEFAULT 'Completed',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS service_activity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service_id INTEGER DEFAULT NULL,
        activity_type TEXT DEFAULT NULL,
        description TEXT DEFAULT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS call_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER DEFAULT NULL,
        client_name TEXT DEFAULT NULL,
        customer_name TEXT DEFAULT NULL,
        phone TEXT DEFAULT NULL,
        technician TEXT DEFAULT NULL,
        sales_person TEXT DEFAULT NULL,
        status TEXT DEFAULT 'Completed',
        call_details TEXT DEFAULT NULL,
        created_by INTEGER DEFAULT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,

      // ── Tasks & Goals ──
      `CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        task_description TEXT DEFAULT NULL,
        assigned_to TEXT DEFAULT NULL,
        assigned_teammember_id INTEGER DEFAULT NULL,
        status TEXT DEFAULT 'Pending',
        priority TEXT DEFAULT 'Normal',
        due_date TEXT DEFAULT NULL,
        created_by INTEGER DEFAULT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS task_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER DEFAULT NULL,
        assigned_to_user_id INTEGER DEFAULT NULL,
        assigned_to_user_name TEXT DEFAULT NULL,
        status TEXT DEFAULT 'Pending',
        due_date TEXT DEFAULT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS task_activity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER DEFAULT NULL,
        action TEXT DEFAULT NULL,
        message TEXT DEFAULT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS task_targets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER DEFAULT NULL,
        teammember_id INTEGER DEFAULT NULL,
        user_name TEXT NOT NULL,
        yearly_target REAL DEFAULT 0,
        monthly_target REAL DEFAULT 0,
        carry_forward REAL DEFAULT 0,
        effective_target REAL DEFAULT 0,
        created_by_admin INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS task_achievements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER DEFAULT NULL,
        target_id INTEGER NOT NULL,
        month_year TEXT NOT NULL,
        achieved_amount REAL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS task_updates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER DEFAULT NULL,
        target_id INTEGER NOT NULL,
        month_year TEXT NOT NULL,
        amount REAL DEFAULT 0,
        description TEXT DEFAULT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER DEFAULT 0,
        user_id INTEGER DEFAULT NULL,
        type TEXT DEFAULT NULL,
        title TEXT DEFAULT NULL,
        description TEXT DEFAULT NULL,
        is_read INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS lead_reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id INTEGER NOT NULL,
        lead_type TEXT DEFAULT 'telecall',
        reminder_date TEXT DEFAULT NULL,
        reminder_notes TEXT DEFAULT NULL,
        status TEXT DEFAULT 'Pending',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS lead_activity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id INTEGER NOT NULL,
        lead_type TEXT DEFAULT 'telecall',
        action TEXT DEFAULT NULL,
        details TEXT DEFAULT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS lead_escalations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id INTEGER NOT NULL,
        lead_type TEXT DEFAULT 'telecall',
        customer_name TEXT DEFAULT NULL,
        status TEXT DEFAULT 'Open',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,

      // ── WhatsApp Stack ──
      `CREATE TABLE IF NOT EXISTS wa_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT DEFAULT 'MARKETING',
        language TEXT DEFAULT 'en',
        header_type TEXT DEFAULT NULL,
        header_value TEXT DEFAULT NULL,
        body TEXT NOT NULL,
        footer TEXT DEFAULT NULL,
        button_type TEXT DEFAULT NULL,
        buttons TEXT DEFAULT NULL,
        variables TEXT DEFAULT NULL,
        meta_template_id TEXT DEFAULT NULL,
        meta_status TEXT DEFAULT 'APPROVED',
        created_by INTEGER DEFAULT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS wa_contact_groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT DEFAULT NULL,
        total_contacts INTEGER DEFAULT 0,
        created_by INTEGER DEFAULT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS wa_group_contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL,
        name TEXT DEFAULT NULL,
        phone TEXT NOT NULL,
        country_code TEXT DEFAULT '91',
        notes TEXT DEFAULT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS wa_contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT NOT NULL UNIQUE,
        name TEXT DEFAULT NULL,
        country_code TEXT DEFAULT '91',
        email TEXT DEFAULT NULL,
        tags TEXT DEFAULT NULL,
        custom_fields TEXT DEFAULT NULL,
        opt_in_status INTEGER DEFAULT 1,
        is_blocked INTEGER DEFAULT 0,
        is_unsubscribed INTEGER DEFAULT 0,
        source TEXT DEFAULT NULL,
        notes TEXT DEFAULT NULL,
        profile_pic_url TEXT DEFAULT NULL,
        avatar_url TEXT DEFAULT NULL,
        created_by INTEGER DEFAULT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS wa_opt_outs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT NOT NULL UNIQUE,
        reason TEXT DEFAULT 'user_request',
        opted_out_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS wa_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_name TEXT NOT NULL,
        phone_number TEXT NOT NULL UNIQUE,
        connection_type TEXT DEFAULT 'web_session',
        is_active INTEGER DEFAULT 1,
        is_default INTEGER DEFAULT 0,
        meta_phone_number_id TEXT DEFAULT NULL,
        meta_waba_id TEXT DEFAULT NULL,
        meta_access_token TEXT DEFAULT NULL,
        app_secret TEXT DEFAULT NULL,
        verify_token TEXT DEFAULT 'crm_verify_123',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS wa_automations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        trigger_type TEXT NOT NULL,
        template_id INTEGER DEFAULT NULL,
        message_text TEXT DEFAULT NULL,
        media_type TEXT DEFAULT NULL,
        media_url TEXT DEFAULT NULL,
        sequence_delay_seconds INTEGER DEFAULT 7,
        followup_message_text TEXT DEFAULT NULL,
        followup_media_type TEXT DEFAULT NULL,
        followup_media_url TEXT DEFAULT NULL,
        followup_template_id INTEGER DEFAULT NULL,
        flow_id INTEGER DEFAULT NULL,
        group_id INTEGER DEFAULT NULL,
        delay_minutes INTEGER DEFAULT 0,
        conditions TEXT DEFAULT NULL,
        is_active INTEGER DEFAULT 1,
        run_count INTEGER DEFAULT 0,
        tenant_id INTEGER DEFAULT 1,
        created_by INTEGER DEFAULT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS wa_automation_options (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        automation_id INTEGER NOT NULL,
        label TEXT NOT NULL,
        reply_text TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0,
        action_type TEXT DEFAULT 'reply',
        action_payload TEXT DEFAULT NULL,
        next_step_text TEXT DEFAULT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS wa_pending_menus (
        phone TEXT PRIMARY KEY,
        automation_id INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS wa_automation_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        automation_id INTEGER NOT NULL,
        phone TEXT NOT NULL,
        contact_name TEXT DEFAULT NULL,
        status TEXT DEFAULT 'sent',
        error TEXT DEFAULT NULL,
        sent_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS wa_campaigns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT DEFAULT NULL,
        type TEXT DEFAULT 'text',
        template_id INTEGER DEFAULT NULL,
        message_text TEXT DEFAULT NULL,
        media_type TEXT DEFAULT NULL,
        media_url TEXT DEFAULT NULL,
        group_id INTEGER DEFAULT NULL,
        status TEXT DEFAULT 'draft',
        scheduled_at TEXT DEFAULT NULL,
        started_at TEXT DEFAULT NULL,
        completed_at TEXT DEFAULT NULL,
        total_contacts INTEGER DEFAULT 0,
        sent_count INTEGER DEFAULT 0,
        delivered_count INTEGER DEFAULT 0,
        read_count INTEGER DEFAULT 0,
        failed_count INTEGER DEFAULT 0,
        created_by INTEGER DEFAULT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS wa_campaign_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id INTEGER NOT NULL,
        phone TEXT NOT NULL,
        contact_name TEXT DEFAULT NULL,
        message_text TEXT DEFAULT NULL,
        status TEXT DEFAULT 'queued',
        wa_message_id TEXT DEFAULT NULL,
        error TEXT DEFAULT NULL,
        sent_at TEXT DEFAULT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS wa_message_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id INTEGER DEFAULT NULL,
        phone TEXT NOT NULL,
        direction TEXT NOT NULL,
        message_text TEXT DEFAULT NULL,
        message_type TEXT DEFAULT 'text',
        status TEXT DEFAULT 'sent',
        session_key TEXT DEFAULT NULL,
        wa_message_id TEXT DEFAULT NULL,
        media_url TEXT DEFAULT NULL,
        media_filename TEXT DEFAULT NULL,
        media_mime_type TEXT DEFAULT NULL,
        error TEXT DEFAULT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS wa_webhook_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT DEFAULT NULL,
        wa_message_id TEXT DEFAULT NULL,
        phone TEXT DEFAULT NULL,
        status TEXT DEFAULT NULL,
        payload TEXT DEFAULT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS wa_knowledge_base (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        file_type TEXT NOT NULL,
        content TEXT NOT NULL,
        char_count INTEGER DEFAULT 0,
        uploaded_by INTEGER DEFAULT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS wa_knowledge_chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER NOT NULL,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        char_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS wa_ai_settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        enabled INTEGER DEFAULT 0,
        provider TEXT DEFAULT 'openrouter',
        model TEXT DEFAULT 'meta-llama/llama-3.3-70b-instruct:free',
        api_key TEXT DEFAULT NULL,
        system_prompt TEXT DEFAULT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS user_wa_configs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE,
        phone_number_id TEXT NOT NULL,
        access_token TEXT NOT NULL,
        waba_id TEXT DEFAULT NULL,
        is_enabled INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS wa_welcome_settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        enabled INTEGER DEFAULT 1,
        welcome_type TEXT DEFAULT 'text',
        welcome_text TEXT DEFAULT NULL,
        template_id INTEGER DEFAULT NULL,
        cooldown_hours INTEGER DEFAULT 24,
        working_hours_only INTEGER DEFAULT 0,
        start_time TEXT DEFAULT '09:00',
        end_time TEXT DEFAULT '21:00',
        welcome_buttons TEXT DEFAULT NULL,
        welcome_footer TEXT DEFAULT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS wa_quick_replies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        shortcut TEXT NOT NULL,
        message_text TEXT NOT NULL,
        created_by INTEGER DEFAULT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS wa_interactive_reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT NOT NULL,
        contact_name TEXT DEFAULT NULL,
        reminder_type TEXT NOT NULL,
        reference_table TEXT DEFAULT NULL,
        reference_id INTEGER DEFAULT NULL,
        title TEXT NOT NULL,
        message_text TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        scheduled_for TEXT DEFAULT NULL,
        sent_at TEXT DEFAULT NULL,
        response_received_at TEXT DEFAULT NULL,
        response_text TEXT DEFAULT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS wa_reminder_settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        appointment_reminders_enabled INTEGER DEFAULT 1,
        appointment_reminder_hours_before INTEGER DEFAULT 24,
        payment_due_reminders_enabled INTEGER DEFAULT 1,
        payment_due_days_before INTEGER DEFAULT 1,
        lead_followup_reminders_enabled INTEGER DEFAULT 1,
        amc_renewal_reminders_enabled INTEGER DEFAULT 1,
        amc_renewal_days_before INTEGER DEFAULT 7,
        confirmation_auto_update_crm INTEGER DEFAULT 1,
        notify_staff_on_response INTEGER DEFAULT 1,
        default_confirm_prompt TEXT DEFAULT NULL,
        default_reschedule_prompt TEXT DEFAULT NULL,
        default_cancel_prompt TEXT DEFAULT NULL,
        cadence_rules TEXT DEFAULT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS wa_reactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wa_message_id TEXT NOT NULL,
        phone TEXT NOT NULL,
        emoji TEXT NOT NULL,
        sender_type TEXT DEFAULT 'agent',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS wa_flows (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT DEFAULT NULL,
        status TEXT DEFAULT 'draft',
        trigger_type TEXT DEFAULT 'keyword',
        trigger_config TEXT DEFAULT NULL,
        entry_node_key TEXT DEFAULT 'start',
        fallback_policy TEXT DEFAULT NULL,
        execution_count INTEGER DEFAULT 0,
        created_by INTEGER DEFAULT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS wa_flow_nodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        flow_id INTEGER NOT NULL,
        node_key TEXT NOT NULL,
        node_type TEXT NOT NULL,
        config TEXT DEFAULT NULL,
        position_x REAL DEFAULT 0,
        position_y REAL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS wa_flow_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        flow_id INTEGER NOT NULL,
        phone TEXT NOT NULL,
        contact_name TEXT DEFAULT NULL,
        status TEXT DEFAULT 'active',
        current_node_key TEXT DEFAULT NULL,
        last_prompt_msg_id TEXT DEFAULT NULL,
        vars TEXT DEFAULT NULL,
        reprompt_count INTEGER DEFAULT 0,
        started_at TEXT DEFAULT CURRENT_TIMESTAMP,
        last_advanced_at TEXT DEFAULT NULL,
        ended_at TEXT DEFAULT NULL,
        end_reason TEXT DEFAULT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS wa_flow_run_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id INTEGER NOT NULL,
        node_key TEXT DEFAULT NULL,
        event_type TEXT DEFAULT NULL,
        payload TEXT DEFAULT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS wa_flow_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        flow_id INTEGER NOT NULL,
        version_number INTEGER NOT NULL DEFAULT 1,
        name TEXT NOT NULL,
        description TEXT DEFAULT NULL,
        trigger_type TEXT DEFAULT 'keyword',
        trigger_config TEXT DEFAULT NULL,
        entry_node_key TEXT DEFAULT 'start',
        nodes_snapshot TEXT NOT NULL,
        status TEXT DEFAULT 'draft',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS wa_api_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        key_prefix TEXT NOT NULL,
        key_hash TEXT NOT NULL UNIQUE,
        scopes TEXT DEFAULT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS wa_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT NOT NULL,
        contact_name TEXT DEFAULT NULL,
        amount REAL NOT NULL,
        currency TEXT DEFAULT 'INR',
        description TEXT DEFAULT NULL,
        status TEXT DEFAULT 'created',
        transaction_id TEXT DEFAULT NULL,
        invoice_id INTEGER DEFAULT NULL,
        quotation_id INTEGER DEFAULT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS wa_drip_sequences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT DEFAULT NULL,
        trigger_type TEXT DEFAULT 'manual',
        is_active INTEGER DEFAULT 1,
        total_enrolled INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS wa_drip_steps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sequence_id INTEGER NOT NULL,
        step_number INTEGER NOT NULL,
        delay_days INTEGER DEFAULT 0,
        delay_hours INTEGER DEFAULT 0,
        message_text TEXT DEFAULT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS wa_drip_enrollments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sequence_id INTEGER NOT NULL,
        phone TEXT NOT NULL,
        contact_name TEXT DEFAULT NULL,
        status TEXT DEFAULT 'active',
        enrolled_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS wa_meta_ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_key TEXT DEFAULT NULL,
        phone TEXT NOT NULL,
        category TEXT DEFAULT 'SERVICE',
        cost_inr REAL DEFAULT 0,
        total_billed_inr REAL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS wa_internal_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT NOT NULL,
        author_id INTEGER NOT NULL,
        author_name TEXT NOT NULL,
        note_text TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS wa_bot_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_key TEXT DEFAULT 'default' UNIQUE,
        is_enabled INTEGER DEFAULT 1,
        default_reply TEXT DEFAULT NULL,
        greeting_message TEXT DEFAULT NULL,
        fallback_message TEXT DEFAULT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS wa_anti_ban_settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        is_enabled INTEGER DEFAULT 1,
        min_delay_ms INTEGER DEFAULT 2000,
        max_delay_ms INTEGER DEFAULT 6000,
        daily_limit INTEGER DEFAULT 500,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS wa_sender_pools (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pool_name TEXT NOT NULL,
        distribution_strategy TEXT DEFAULT 'round_robin',
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS wa_sender_pool_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pool_id INTEGER NOT NULL,
        account_id INTEGER NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const ddl of schemas) {
      try {
        this.sqlite.exec(ddl);
      } catch (err) {
        if (!err.message.includes("already exists")) {
          console.warn("⚠️ SQLite DDL notice:", err.message);
        }
      }

      // Automatically reconcile missing columns for tables that existed from older snapshots
      try {
        const tableMatch = ddl.match(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+([a-zA-Z0-9_]+)\s*\(([\s\S]+)\)/i);
        if (tableMatch) {
          const tableName = tableMatch[1];
          const body = tableMatch[2];
          const existingCols = new Set(
            this.sqlite.prepare(`PRAGMA table_info("${tableName}")`).all().map((r) => r.name.toLowerCase())
          );

          const lines = body.split("\n");
          for (const rawLine of lines) {
            const line = rawLine.trim().replace(/,\s*$/, "");
            if (!line || /^(PRIMARY|UNIQUE|KEY|FOREIGN|CHECK|CONSTRAINT)\b/i.test(line)) continue;
            const colMatch = line.match(/^([a-zA-Z0-9_]+)\s+([a-zA-Z0-9_()]+(?:\s+DEFAULT\s+[^,]+)?)/i);
            if (colMatch) {
              const colName = colMatch[1];
              if (!existingCols.has(colName.toLowerCase())) {
                try {
                  let colDef = colMatch[2];
                  colDef = colDef.replace(/\bPRIMARY\s+KEY\b/gi, "").replace(/\bUNIQUE\b/gi, "");
                  this.sqlite.exec(`ALTER TABLE "${tableName}" ADD COLUMN "${colName}" ${colDef}`);
                  existingCols.add(colName.toLowerCase());
                } catch (_) {}
              }
            }
          }
        }
      } catch (_) {}
    }
  }

  async seedDefaultAdmin() {
    try {
      const checkStmt = this.sqlite.prepare("SELECT id FROM users WHERE email = ? LIMIT 1");
      const existing = checkStmt.get("admin@madhuratech.com");
      if (!existing) {
        const hash = await bcrypt.hash("Admin@123", 10);
        const insertStmt = this.sqlite.prepare(`
          INSERT INTO users (first_name, last_name, emp_id, email, user_password, role, status)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        insertStmt.run("Admin", "User", "EMP001", "admin@madhuratech.com", hash, "admin", "active");

        const teamStmt = this.sqlite.prepare(`
          INSERT INTO teammember (first_name, last_name, emp_id, emp_email, mobile, job_title, emp_role, quotation_count, user_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1)
        `);
        teamStmt.run("Admin", "User", "EMP001", "admin@madhuratech.com", "9876543210", "Administrator", "Admin");
        console.log("✅ [SQLite Engine] Seeded default Admin user (admin@madhuratech.com)");
      }
    } catch (err) {
      console.warn("⚠️ [SQLite Engine] Admin seed warning:", err.message);
    }
  }

  /**
   * Core query execution compatible with MySQL2
   */
  executeSql(sql, values = []) {
    const rawSql = String(sql || "").trim();
    if (!rawSql) return [ [], [] ];

    // MySQL SET commands (SET FOREIGN_KEY_CHECKS, SET NAMES, etc.) - no-op in SQLite
    if (/^SET\s+/i.test(rawSql) && !/^UPDATE\b/i.test(rawSql)) {
      return [ [], [] ];
    }

    // Intercept information_schema.statistics check if queried
    if (/information_schema\.statistics/i.test(rawSql)) {
      const tableMatch = rawSql.match(/table_name\s*=\s*['"]?([a-zA-Z0-9_]+)['"]?/i) || [];
      const idxMatch = rawSql.match(/index_name\s*=\s*['"]?([a-zA-Z0-9_]+)['"]?/i) || [];
      const tbl = tableMatch[1] || (Array.isArray(values) && values.find((v) => typeof v === "string" && !v.includes("%") && v.length < 50));
      const idx = idxMatch[1] || (Array.isArray(values) && values[values.length - 1]);

      if (tbl && idx) {
        try {
          const indexRows = this.sqlite.prepare(`PRAGMA index_list("${tbl}")`).all();
          const found = indexRows.filter((r) => r.name.toLowerCase() === String(idx).toLowerCase());
          if (found.length > 0) {
            return [found.map(() => ({ 1: 1, INDEX_NAME: idx })), []];
          }
        } catch (_) {}
      }
      return [ [], [] ];
    }

    // Intercept information_schema.columns check if queried
    if (/information_schema\.columns/i.test(rawSql)) {
      const tableMatch = rawSql.match(/table_name\s*=\s*['"]?([a-zA-Z0-9_]+)['"]?/i) || [];
      const colMatch = rawSql.match(/column_name\s*=\s*['"]?([a-zA-Z0-9_]+)['"]?/i) || [];
      const tbl = tableMatch[1] || (Array.isArray(values) && values.find((v) => typeof v === "string" && !v.includes("%") && v.length < 50));
      const col = colMatch[1] || (Array.isArray(values) && values[values.length - 1]);

      if (tbl) {
        try {
          const pragmaRows = this.sqlite.prepare(`PRAGMA table_info("${tbl}")`).all();
          const matched = col ? pragmaRows.filter((r) => r.name.toLowerCase() === String(col).toLowerCase()) : pragmaRows;
          const rows = matched.map((r) => ({
            1: 1,
            column_name: r.name,
            COLUMN_NAME: r.name,
            data_type: (r.type || "text").toLowerCase(),
            DATA_TYPE: (r.type || "text").toLowerCase(),
          }));
          return [rows, []];
        } catch (_) {
          return [ [], [] ];
        }
      }
      return [ [], [] ];
    }

    const isSelect = /^(SELECT|PRAGMA|EXPLAIN)\b/i.test(rawSql);
    const isWrite = /^(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(rawSql);

    const translated = translateMySqlToSqlite(rawSql);

    // If DDL (CREATE / ALTER / DROP)
    if (/^(CREATE|ALTER|DROP)\b/i.test(translated)) {
      try {
        this.sqlite.exec(translated);
      } catch (ddlErr) {
        if (!ddlErr.message.includes("already exists") && !ddlErr.message.includes("duplicate column")) {
          throw ddlErr;
        }
      }
      return [ { affectedRows: 0 }, [] ];
    }

    const stmt = this.sqlite.prepare(translated);

    // Normalize params
    const params = Array.isArray(values) ? values : values !== undefined ? [values] : [];

    if (isSelect) {
      const rows = stmt.all(...params);
      return [rows, []];
    }

    const result = stmt.run(...params);
    const info = {
      insertId: Number(result.lastInsertRowid || 0),
      affectedRows: Number(result.changes || 0),
      changedRows: Number(result.changes || 0),
    };

    if (isWrite && r2Storage.isConfigured()) {
      r2Storage.triggerDebouncedSync(this.dbPath);
    }

    return [info, []];
  }

  /**
   * Callback-based MySQL2 query method: db.query(sql, params, callback)
   */
  query(sql, params, callback) {
    let cb = callback;
    let vals = params;
    if (typeof params === "function") {
      cb = params;
      vals = [];
    }

    if (!this.isReady) {
      if (!this.initPromise) this.initialize();
      this.initPromise
        .then(() => this.query(sql, vals, cb))
        .catch((err) => {
          if (typeof cb === "function") cb(err);
        });
      return this;
    }

    try {
      const [res, fields] = this.executeSql(sql, vals);
      if (typeof cb === "function") cb(null, res, fields);
      return this;
    } catch (err) {
      if (typeof cb === "function") cb(err);
      return this;
    }
  }

  /**
   * Promise-based MySQL2 query method: db.promise().query(sql, params)
   */
  promise() {
    return {
      query: async (sql, params = []) => {
        if (!this.isReady) {
          if (!this.initPromise) this.initialize();
          await this.initPromise;
        }
        const [res, fields] = this.executeSql(sql, params);
        return [res, fields];
      },
      execute: async (sql, params = []) => {
        if (!this.isReady) {
          if (!this.initPromise) this.initialize();
          await this.initPromise;
        }
        const [res, fields] = this.executeSql(sql, params);
        return [res, fields];
      },
    };
  }
}

const sqliteAdapter = new SQLiteDatabaseAdapter();
module.exports = sqliteAdapter;
