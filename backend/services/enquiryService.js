// Enquiries (lead triage → client conversion)
//
// Single source of truth for the wa_enquiries table. Uses the self-ensuring
// pattern from clientPortalService.js so the DDL lives in exactly one place and
// runs on both engines (MySQL + SQLite) without touching either DDL list.

const db = require("../config/database");

const q = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const TEMPERATURES = ["new", "cold", "warm", "hot"];
const STATUSES = ["open", "converted", "lost"];

// What the enquiry is *about*. `source` stays provenance (manual, whatsapp_chat),
// so a type never has to be smuggled into the provenance column.
const ENQUIRY_TYPES = ["general", "product", "pricing", "support", "appointment", "partnership"];
const ENQUIRY_TYPE_LABELS = {
  general: "General enquiry",
  product: "Product / service",
  pricing: "Pricing / quote",
  support: "Support",
  appointment: "Appointment",
  partnership: "Partnership",
};

function normaliseEnquiryType(value, fallback = "general") {
  const raw = String(value || "").trim().toLowerCase().replace(/[\s/-]+/g, "_");
  if (!raw) return fallback;
  const alias = {
    general_enquiry: "general",
    product_service: "product",
    product_or_service: "product",
    pricing_quote: "pricing",
    quote: "pricing",
    appointment_booking: "appointment",
    partner: "partnership",
  };
  const mapped = alias[raw] || raw;
  return ENQUIRY_TYPES.includes(mapped) ? mapped : fallback;
}

let ensured = false;

function stamp(date = new Date()) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

// Digits-only form of a phone number, used for cross-format dedupe
// ("+91 98765-43210" and "919876543210" must collide).
function digits(value) {
  return String(value || "").replace(/\D+/g, "");
}

async function ensureEnquiryTables() {
  if (ensured) return;
  const sqlite = db.isSqlite;
  const id = sqlite ? "INTEGER PRIMARY KEY AUTOINCREMENT" : "INT AUTO_INCREMENT PRIMARY KEY";
  const ts = sqlite ? "TEXT DEFAULT CURRENT_TIMESTAMP" : "DATETIME DEFAULT CURRENT_TIMESTAMP";
  const suffix = sqlite ? "" : " ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

  await q(`CREATE TABLE IF NOT EXISTS wa_enquiries (
    id ${id},
    tenant_id INT NOT NULL,
    contact_id INT DEFAULT NULL,
    branch_id INT DEFAULT NULL,
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(40) DEFAULT NULL,
    email VARCHAR(180) DEFAULT NULL,
    company VARCHAR(150) DEFAULT NULL,
    source VARCHAR(60) DEFAULT 'manual',
    enquiry_type VARCHAR(24) DEFAULT 'general',
    message TEXT,
    temperature VARCHAR(12) DEFAULT 'new',
    status VARCHAR(16) DEFAULT 'open',
    notes TEXT,
    converted_client_id INT DEFAULT NULL,
    crm_lead_id INT DEFAULT NULL,
    converted_at ${ts.replace(" DEFAULT CURRENT_TIMESTAMP", "")},
    converted_by INT DEFAULT NULL,
    created_by INT DEFAULT NULL,
    created_at ${ts},
    updated_at ${ts}
  )${suffix}`);

  try {
    await q("CREATE INDEX idx_wa_enquiries_tenant ON wa_enquiries (tenant_id)");
  } catch (_) { /* index already exists */ }
  try {
    await q("CREATE INDEX idx_wa_enquiries_temp ON wa_enquiries (tenant_id, temperature)");
  } catch (_) { /* index already exists */ }

  // Reconcile columns added after the table first shipped.
  const wanted = [
    ["contact_id", "INT DEFAULT NULL"],
    ["branch_id", "INT DEFAULT NULL"],
    ["source", "VARCHAR(60) DEFAULT 'manual'"],
    ["enquiry_type", "VARCHAR(24) DEFAULT 'general'"],
    ["message", "TEXT"],
    ["notes", "TEXT"],
    ["converted_client_id", "INT DEFAULT NULL"],
    ["crm_lead_id", "INT DEFAULT NULL"],
    ["converted_at", sqlite ? "TEXT" : "DATETIME"],
    ["converted_by", "INT DEFAULT NULL"],
    ["created_by", "INT DEFAULT NULL"],
    ["created_at", sqlite ? "TEXT" : ts],
    ["updated_at", sqlite ? "TEXT" : ts],
  ];

  let existing = [];
  try {
    if (sqlite) {
      existing = (await q("PRAGMA table_info(wa_enquiries)")).map((r) => r.name.toLowerCase());
    } else {
      const rows = await q("SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ?", ["wa_enquiries"]);
      existing = rows.map((r) => String(r.column_name).toLowerCase());
    }
  } catch (_) { /* leave empty; CREATE above already ran */ }

  for (const [col, def] of wanted) {
    if (existing.includes(col)) continue;
    try {
      await q(`ALTER TABLE wa_enquiries ADD COLUMN ${col} ${def}`);
    } catch (_) { /* race with another process */ }
  }

  ensured = true;
}

// Column introspection that works on both engines. Returns a Set of lowercase
// names, or an empty Set when the table cannot be read.
async function tableColumns(table) {
  try {
    if (db.isSqlite) {
      const rows = await q(`PRAGMA table_info(${table})`);
      return new Set(rows.map((r) => String(r.name).toLowerCase()));
    }
    const rows = await q(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ?",
      [table]
    );
    return new Set(rows.map((r) => String(r.column_name).toLowerCase()));
  } catch (_) {
    return new Set();
  }
}

// A branch id is only accepted when it belongs to the caller's organization.
// Older installs may not have `branches` at all, in which case the value is
// kept untouched rather than silently dropped.
async function resolveBranchId(tenantId, requested) {
  const branchId = Number(requested);
  if (!Number.isFinite(branchId) || branchId <= 0) return null;
  try {
    const cols = await tableColumns("branches");
    // Cannot verify ownership (no branches table) → refuse the id rather than
    // storing a branch that may belong to another organization.
    if (!cols.size) return null;
    const rows = cols.has("tenant_id")
      ? await q("SELECT id FROM branches WHERE id = ? AND tenant_id = ? LIMIT 1", [branchId, tenantId])
      : await q("SELECT id FROM branches WHERE id = ? LIMIT 1", [branchId]);
    return rows.length ? branchId : null;
  } catch (_) {
    return null;
  }
}

// List rows carry the creator's display name so the UI can show who logged the
// enquiry. Missing users / older schemas simply leave the field empty.
async function attachCreatorNames(rows) {
  const list = (Array.isArray(rows) ? rows : []).filter(Boolean);
  if (list.length === 0) return list;
  const ids = [...new Set(list.map((r) => Number(r.created_by)).filter((id) => id > 0))];
  if (!ids.length) return list;
  try {
    const placeholders = ids.map(() => "?").join(", ");
    const users = await q(
      `SELECT id, first_name, last_name FROM users WHERE id IN (${placeholders})`,
      ids
    );
    const byId = new Map(
      users.map((u) => [Number(u.id), `${u.first_name || ""} ${u.last_name || ""}`.trim()])
    );
    return list.map((r) => ({
      ...r,
      created_by_name: byId.get(Number(r.created_by)) || null,
    }));
  } catch (_) {
    return list;
  }
}

// Provenance columns on `clients` exist on the production MySQL clone but not
// on the embedded SQLite schema. Add what is missing so a converted enquiry can
// stamp the CRM lead it came from and the CRM client list can show it.
let bridgeEnsured = false;

async function ensureClientBridgeColumns() {
  if (bridgeEnsured) return;
  const sqlite = Boolean(db.isSqlite);
  const wanted = [
    ["tenant_id", "INT DEFAULT NULL"],
    ["source", sqlite ? "TEXT DEFAULT NULL" : "VARCHAR(100) DEFAULT NULL"],
    ["original_lead_id", "INT DEFAULT NULL"],
    ["original_lead_type", sqlite ? "TEXT DEFAULT NULL" : "ENUM('telecall','walkin','field') DEFAULT NULL"],
    ["converted_at", sqlite ? "TEXT DEFAULT NULL" : "TIMESTAMP NULL DEFAULT NULL"],
    ["lead_reference", sqlite ? "TEXT DEFAULT NULL" : "VARCHAR(255) DEFAULT NULL"],
    ["lead_id_display", sqlite ? "TEXT DEFAULT NULL" : "VARCHAR(50) DEFAULT NULL"],
  ];

  const existing = await tableColumns("clients");
  for (const [col, def] of wanted) {
    if (existing.has(col)) continue;
    try {
      await q(`ALTER TABLE clients ADD COLUMN ${col} ${def}`);
    } catch (_) { /* race with another process */ }
  }
  bridgeEnsured = true;
}

const LEAD_TEMPERATURES = ["cold", "warm", "hot"];
const OUTCOME_BY_TEMPERATURE = {
  cold: "Cold Case",
  warm: "Warm Case",
  hot: "Hot Case",
  converted: "Converted",
};

// Enquiry → Lead bridge.
//
// Qualifying an enquiry (temperature new → cold/warm/hot) must create a real
// CRM lead in `telecalls`, exactly like an inbound WhatsApp message does, so
// the lead shows up in every CRM lead list. The lead id is stored on the
// enquiry so a later temperature change updates the same row instead of
// creating duplicates.
async function ensureCrmLead(enquiry, tenantId) {
  if (!enquiry) return null;

  let leadId = Number(enquiry.crm_lead_id) || null;
  if (leadId) return leadId;

  const phone = String(enquiry.phone || "").trim();
  if (digits(phone).length < 10) return null;

  try {
    const { captureLeadFromWhatsApp } = require("./waLeadCapture");
    const result = await captureLeadFromWhatsApp({
      phone,
      name: enquiry.name,
      company: enquiry.company,
      email: enquiry.email,
      notes: enquiry.message || enquiry.notes || `WhatsApp enquiry #${enquiry.id}`,
      sourceDetail: "WhatsApp Enquiry",
      tenantId,
    });
    if (!result || !result.success || !result.leadId) return null;
    leadId = Number(result.leadId) || null;
  } catch (err) {
    console.warn(`[enquiries] CRM lead capture failed for enquiry ${enquiry.id}:`, err.message);
    return null;
  }

  try {
    await q(
      "UPDATE wa_enquiries SET crm_lead_id = ?, updated_at = ? WHERE id = ? AND tenant_id = ?",
      [leadId, stamp(), enquiry.id, tenantId]
    );
  } catch (_) { /* lead exists even if the back-reference fails */ }

  return leadId;
}

// Mirror the pipeline stage onto the CRM lead (cold/warm/hot/converted).
async function setLeadOutcome(leadId, temperature, tenantId) {
  const outcome = OUTCOME_BY_TEMPERATURE[String(temperature || "").toLowerCase()];
  if (!leadId || !outcome) return;
  try {
    await q("UPDATE telecalls SET call_outcome = ? WHERE id = ? AND tenant_id=?", [outcome, leadId, tenantId]);
  } catch (_) { /* older schemas without call_outcome: non-fatal */ }
}

// Sync a fully qualified enquiry to the CRM lead table and return the lead id.
async function syncEnquiryLead(enquiry, tenantId) {
  if (!enquiry) return null;
  const temperature = String(enquiry.temperature || "").toLowerCase();
  if (!LEAD_TEMPERATURES.includes(temperature)) return Number(enquiry.crm_lead_id) || null;
  const leadId = await ensureCrmLead(enquiry, tenantId);
  if (leadId) await setLeadOutcome(leadId, temperature, tenantId);
  return leadId;
}

async function stats(tenantId) {
  await ensureEnquiryTables();
  const rows = await q(
    "SELECT temperature, COUNT(*) AS total FROM wa_enquiries WHERE tenant_id = ? GROUP BY temperature",
    [tenantId]
  );
  const out = { total: 0, new: 0, cold: 0, warm: 0, hot: 0, converted: 0 };
  for (const r of rows) {
    out.total += Number(r.total) || 0;
    if (out[r.temperature] !== undefined) out[r.temperature] = Number(r.total) || 0;
  }
  const conv = await q(
    "SELECT COUNT(*) AS total FROM wa_enquiries WHERE tenant_id = ? AND status = 'converted'",
    [tenantId]
  );
  out.converted = Number(conv[0]?.total) || 0;
  return out;
}

async function list(tenantId, opts = {}) {
  await ensureEnquiryTables();
  const { temperature, status, search, enquiry_type, page = 1, limit = 50 } = opts;
  const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 50));
  const offset = (Math.max(1, parseInt(page) || 1) - 1) * limitNum;

  const where = ["tenant_id = ?"];
  const params = [tenantId];

  if (temperature && TEMPERATURES.includes(temperature)) {
    where.push("temperature = ?");
    params.push(temperature);
  }
  if (status && STATUSES.includes(status)) {
    where.push("status = ?");
    params.push(status);
  }
  const type = normaliseEnquiryType(enquiry_type, null);
  if (type) {
    where.push("enquiry_type = ?");
    params.push(type);
  }
  if (search) {
    where.push("(name LIKE ? OR phone LIKE ? OR email LIKE ? OR company LIKE ? OR message LIKE ?)");
    const like = `%${String(search).trim()}%`;
    params.push(like, like, like, like, like);
  }

  const whereSql = where.join(" AND ");
  const rows = await q(
    `SELECT * FROM wa_enquiries WHERE ${whereSql} ORDER BY created_at DESC, id DESC LIMIT ${limitNum} OFFSET ${offset}`,
    params
  );
  const countRows = await q(`SELECT COUNT(*) AS total FROM wa_enquiries WHERE ${whereSql}`, params);
  const total = Number(countRows[0]?.total) || 0;

  return {
    enquiries: await attachCreatorNames(rows),
    total,
    page: Math.max(1, parseInt(page) || 1),
    totalPages: Math.max(1, Math.ceil(total / limitNum)),
  };
}

async function getById(id, tenantId) {
  await ensureEnquiryTables();
  const rows = await q("SELECT * FROM wa_enquiries WHERE id = ? AND tenant_id = ?", [id, tenantId]);
  return rows[0] || null;
}

async function create(tenantId, payload, userId) {
  await ensureEnquiryTables();
  const temperature = TEMPERATURES.includes(payload.temperature) ? payload.temperature : "new";
  const name = String(payload.name || "").trim();
  const phone = String(payload.phone || "").trim() || null;
  const email = String(payload.email || "").trim() || null;
  const company = String(payload.company || "").trim() || null;
  const source = String(payload.source || "manual").trim().slice(0, 60) || "manual";
  const enquiryType = normaliseEnquiryType(payload.enquiry_type);
  const message = payload.message ? String(payload.message).trim() : null;
  const notes = payload.notes ? String(payload.notes).trim() : null;
  const branchId = await resolveBranchId(tenantId, payload.branch_id);
  const phoneDigits = digits(phone);
  const canonicalPhone = phoneDigits.length === 10 ? `91${phoneDigits}` : phoneDigits;
  const write = async query => {
    let contactId = null;
    if (/^\d{10,15}$/.test(canonicalPhone)) {
      await query(`INSERT INTO wa_contacts (tenant_id,name,phone,email,source,branch_id,opt_in_status) VALUES (?,?,?,?,?,?,0) ON DUPLICATE KEY UPDATE phone=VALUES(phone)`,[tenantId,name,canonicalPhone,email,source,branchId]);
      const [contact] = await query("SELECT id FROM wa_contacts WHERE tenant_id=? AND phone=?",[tenantId,canonicalPhone]);
      contactId = contact?.id || null;
    }
    const result = await query(
    `INSERT INTO wa_enquiries (tenant_id, contact_id, branch_id, name, phone, email, company, source, enquiry_type, message, temperature, status, notes, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?)`,
    [
      tenantId,
      contactId,
      branchId,
      name,
      phone,
      email,
      company,
      source,
      enquiryType,
      message,
      temperature,
      notes,
      userId || null,
      stamp(),
      stamp(),
    ]
  );
    if (contactId && !db.isSqlite) await require("./crmIntake").createCrmIntake(db).assign(query,{tenantId,contactId,branchId,actorId:userId||0});
    return result;
  };
  const res = db.isSqlite ? await write(q) : await require("./sharedInboxService").createInboxService(db).transaction(write);
  const created = await getById(res.insertId, tenantId);

  // Creating an enquiry that is already qualified also creates its CRM lead.
  if (created && LEAD_TEMPERATURES.includes(String(created.temperature || "").toLowerCase())) {
    await syncEnquiryLead(created, tenantId);
    const qualified = await getById(res.insertId, tenantId);
    return (await attachCreatorNames([qualified]))[0];
  }

  return (await attachCreatorNames([created]))[0];
}

async function update(id, tenantId, payload) {
  await ensureEnquiryTables();
  const current = await getById(id, tenantId);
  if (!current) return null;

  const sets = [];
  const params = [];

  const textCols = ["name", "phone", "email", "company", "source", "message", "notes"];
  for (const col of textCols) {
    if (payload[col] !== undefined) {
      sets.push(`${col} = ?`);
      params.push(payload[col] === null || payload[col] === "" ? null : String(payload[col]).trim());
    }
  }
  if (payload.temperature !== undefined) {
    if (!TEMPERATURES.includes(payload.temperature)) {
      const err = new Error("temperature must be one of: new, cold, warm, hot");
      err.status = 400;
      throw err;
    }
    sets.push("temperature = ?");
    params.push(payload.temperature);
  }
  if (payload.enquiry_type !== undefined && payload.enquiry_type !== null && payload.enquiry_type !== "") {
    const type = normaliseEnquiryType(payload.enquiry_type, null);
    if (!type) {
      const err = new Error(`enquiry_type must be one of: ${ENQUIRY_TYPES.join(", ")}`);
      err.status = 400;
      throw err;
    }
    sets.push("enquiry_type = ?");
    params.push(type);
  }
  if (payload.status !== undefined) {
    if (!STATUSES.includes(payload.status)) {
      const err = new Error("status must be one of: open, converted, lost");
      err.status = 400;
      throw err;
    }
    // Conversion is forward-only: once converted, only the convert endpoint
    // owns this row's lifecycle.
    if (current.status === "converted" && payload.status !== "converted") {
      const err = new Error("A converted enquiry cannot be reopened");
      err.status = 409;
      throw err;
    }
    sets.push("status = ?");
    params.push(payload.status);
  }
  if (payload.branch_id !== undefined) {
    const branchId = await resolveBranchId(tenantId, payload.branch_id);
    sets.push("branch_id = ?");
    params.push(branchId);
  }

  if (!sets.length) return current;

  sets.push("updated_at = ?");
  params.push(stamp());
  params.push(id, tenantId);

  await q(`UPDATE wa_enquiries SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ?`, params);

  const updated = await getById(id, tenantId);

  // Qualifying (new → cold/warm/hot) creates the CRM lead; changing the
  // temperature afterwards keeps that same lead's outcome in sync. A converted
  // enquiry is owned by the convert endpoint, so leave its lead alone.
  if (
    updated &&
    updated.status !== "converted" &&
    LEAD_TEMPERATURES.includes(String(updated.temperature || "").toLowerCase())
  ) {
    await syncEnquiryLead(updated, tenantId);
    return getById(id, tenantId);
  }

  return updated;
}

async function remove(id, tenantId) {
  await ensureEnquiryTables();
  const current = await getById(id, tenantId);
  if (!current) return false;
  const res = await q("DELETE FROM wa_enquiries WHERE id = ? AND tenant_id = ?", [id, tenantId]);
  return Number(res.affectedRows) > 0;
}

// Stamp the CRM lead a client came from. Only columns that exist are written,
// and COALESCE keeps the first provenance if the client was already linked.
async function stampClientProvenance(client, enquiry, leadId) {
  if (!client || !client.id) return client;
  const cols = await tableColumns("clients");
  const sets = [];
  const params = [];
  const put = (col, value) => {
    if (!cols.has(col)) return;
    sets.push(`${col} = COALESCE(${col}, ?)`);
    params.push(value);
  };

  if (leadId) {
    put("original_lead_id", leadId);
    put("original_lead_type", "telecall");
    put("lead_reference", `WhatsApp enquiry #${enquiry.id}`);
    put("lead_id_display", `WA-${enquiry.id}`);
    put("source", "WhatsApp");
  }
  put("converted_at", stamp());

  if (!sets.length) return client;
  sets.push("updated_at = ?");
  params.push(stamp(), client.id, enquiry.tenant_id);

  try {
    await q(`UPDATE clients SET ${sets.join(", ")} WHERE id = ? AND tenant_id=?`, params);
    const refreshed = await q("SELECT * FROM clients WHERE id = ? AND tenant_id=?", [client.id, enquiry.tenant_id]);
    return refreshed[0] || client;
  } catch (_) {
    return client;
  }
}

// ── Convert to client ────────────────────────────────────────────────────────
// Idempotent and forward-only:
//   1. already converted  → return the existing client (no-op)
//   2. a CRM lead is created/linked in `telecalls` if qualification did not
//      already do it, so the client keeps its lead provenance
//   3. phone/email matches an existing client → link to it, never duplicate
//   4. otherwise INSERT into `clients` with the columns common to both engines
//   5. stamp the enquiry, the lead (Converted) and the client (lead reference),
//      relink wa_contacts to the client, emit the `lead_converted` notification
async function convert(id, tenantId, userId) {
  await ensureEnquiryTables();
  await ensureClientBridgeColumns();
  const enquiry = await getById(id, tenantId);
  if (!enquiry) {
    const err = new Error("Enquiry not found");
    err.status = 404;
    throw err;
  }
  if (enquiry.status === "converted" && enquiry.converted_client_id) {
    const existing = await q("SELECT * FROM clients WHERE id = ? AND tenant_id=?", [enquiry.converted_client_id, tenantId]);
    return { enquiry: await getById(id, tenantId), client: existing[0] || null, deduped: true };
  }

  // A lead may be converted without ever being qualify-staged. Create/link the
  // CRM lead now so the client still carries the lead it came from.
  const leadId = await ensureCrmLead(enquiry, tenantId);

  const phone = String(enquiry.phone || "").trim();
  const email = String(enquiry.email || "").trim();
  const d = digits(phone);
  const last10 = d.length >= 10 ? d.slice(-10) : null;

  // Dedupe: exact email, punctuation-insensitive phone, then country-code-tolerant suffix.
  const normalizedPhone = phone.replace(/[+\-\s()]/g, "");
  const dupWhere = ["1 = 0"];
  const dupParams = [];
  if (email) {
    dupWhere.push("LOWER(email) = LOWER(?)");
    dupParams.push(email);
  }
  if (normalizedPhone) {
    dupWhere.push("REPLACE(REPLACE(REPLACE(REPLACE(phone, '+', ''), '-', ''), ' ', ''), '/', '') = ?");
    dupParams.push(normalizedPhone);
  }
  if (last10 && last10.length === 10) {
    dupWhere.push(
      "REPLACE(REPLACE(REPLACE(REPLACE(phone, '+', ''), '-', ''), ' ', ''), '/', '') LIKE ?"
    );
    dupParams.push(`%${last10}`);
  }

  let client = null;
  let linkedExisting = false;
  try {
    const dups = await q(`SELECT * FROM clients WHERE tenant_id=? AND (${dupWhere.join(" OR ")}) LIMIT 1`, [tenantId, ...dupParams]);
    client = dups[0] || null;
    linkedExisting = Boolean(client);
  } catch (_) {
    // `clients` unavailable — still record the conversion attempt below.
  }

  const name = String(enquiry.name || "").trim() || (email ? email.split("@")[0] : "Enquiry");

  if (client) {
    // Existing client: only backfill blanks, never overwrite user data.
    const sets = [];
    const params = [];
    if (!client.email && email) { sets.push("email = ?"); params.push(email); }
    if (!client.company_name && enquiry.company) { sets.push("company_name = ?"); params.push(enquiry.company); }
    if (sets.length) {
      sets.push("updated_at = ?");
      params.push(stamp(), client.id, tenantId);
      try { await q(`UPDATE clients SET ${sets.join(", ")} WHERE id = ? AND tenant_id=?`, params); } catch (_) { /* non-fatal */ }
    }
    try {
      const refreshed = await q("SELECT * FROM clients WHERE id = ? AND tenant_id=?", [client.id, tenantId]);
      client = refreshed[0] || client;
    } catch (_) { /* keep original row */ }
  } else {
    const res = await q(
      `INSERT INTO clients (name, company_name, email, phone, notes, client_status, created_by, created_at, updated_at,tenant_id)
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
      [
        name,
        enquiry.company || null,
        email || null,
        phone || null,
        enquiry.message ? String(enquiry.message).trim() : (enquiry.notes || null),
        userId || null,
        stamp(),
        stamp(),
        tenantId,
      ]
    );
    const created = await q("SELECT * FROM clients WHERE id = ? AND tenant_id=?", [res.insertId, tenantId]);
    client = created[0] || { id: res.insertId, name };
  }

  await q(
    `UPDATE wa_enquiries
        SET status = 'converted', converted_client_id = ?, converted_at = ?, converted_by = ?, updated_at = ?
      WHERE id = ? AND tenant_id = ?`,
    [client.id || null, stamp(), userId || null, stamp(), id, tenantId]
  );

  // Propagate the conversion everywhere the lead was referenced:
  //   • CRM lead row  → call_outcome = Converted
  //   • client row    → original lead id / reference / converted_at
  //   • wa_contacts   → now points at the CRM client instead of the lead
  if (leadId) await setLeadOutcome(leadId, "converted", tenantId);
  client = await stampClientProvenance(client, enquiry, leadId);

  const contactLast10 = (digits(phone) || "").slice(-10);
  if (client?.id && contactLast10.length === 10) {
    try {
      await q(
        `UPDATE wa_contacts SET crm_ref_type = 'clients', crm_ref_id = ?
          WHERE tenant_id = ? AND REPLACE(REPLACE(REPLACE(REPLACE(phone, '+', ''), '-', ''), ' ', ''), '/', '') LIKE ?`,
        [client.id, tenantId, `%${contactLast10}`]
      );
    } catch (_) { /* contact link is best-effort */ }
  }
  try {
    await q(
      `INSERT INTO admin_notifications (type, user_id, message, related_id, related_type, created_by, priority, is_read, created_at)
       VALUES ('lead_converted', NULL, ?, ?, 'enquiry', ?, 'normal', 0, ?)`,
      [
        `${name}${phone ? ` (${phone})` : ""} was converted to a client`,
        id,
        userId || null,
        stamp(),
      ]
    );
  } catch (_) { /* notification is best-effort */ }

  return { enquiry: await getById(id, tenantId), client, deduped: linkedExisting };
}

module.exports = {
  ensureEnquiryTables,
  TEMPERATURES,
  ENQUIRY_TYPES,
  ENQUIRY_TYPE_LABELS,
  normaliseEnquiryType,
  stats,
  list,
  getById,
  create,
  update,
  remove,
  convert,
  digits,
};
