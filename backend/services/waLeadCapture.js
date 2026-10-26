"use strict";

const db = require("../config/database");

/**
 * waLeadCapture.js
 * 
 * Automatically captures leads from WhatsApp (Inbound messages, Chatbot Flows, and AI assistant)
 * and creates/updates CRM leads with Source = 'WhatsApp'.
 */

async function queryAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

function clean10DigitPhone(phone) {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  return cleaned.length >= 10 ? cleaned.slice(-10) : cleaned;
}

// The legacy CRM `telecalls` table ships with different columns depending on
// the engine: the production MySQL clone has staff_name / call_date /
// call_outcome / reference / assigned_to, while the embedded SQLite schema
// stops at followup_notes. Creating a lead from WhatsApp must work on both, so
// reconcile the columns once per process before touching the table.
let leadColumnsEnsured = false;

async function ensureLeadTableColumns() {
  if (leadColumnsEnsured) return;
  const sqlite = Boolean(db.isSqlite);
  const wanted = [
    ["staff_name", sqlite ? "TEXT DEFAULT NULL" : "VARCHAR(150) DEFAULT NULL"],
    ["call_date", sqlite ? "TEXT DEFAULT NULL" : "DATE DEFAULT NULL"],
    ["call_outcome", sqlite ? "TEXT DEFAULT NULL" : "VARCHAR(40) DEFAULT NULL"],
    ["reference", sqlite ? "TEXT DEFAULT NULL" : "VARCHAR(100) DEFAULT NULL"],
    ["reference_by", sqlite ? "TEXT DEFAULT NULL" : "VARCHAR(150) DEFAULT NULL"],
    ["assigned_to", "INT DEFAULT NULL"],
    ["tenant_id", "INT DEFAULT NULL"],
    ["updated_at", sqlite ? "TEXT DEFAULT NULL" : "TIMESTAMP NULL DEFAULT NULL"],
    ["followup_notes", "TEXT DEFAULT NULL"],
    ["service_name", sqlite ? "TEXT DEFAULT NULL" : "VARCHAR(255) DEFAULT NULL"],
  ];

  let existing = new Set();
  try {
    if (sqlite) {
      const rows = await queryAsync("PRAGMA table_info(telecalls)");
      existing = new Set(rows.map((r) => String(r.name).toLowerCase()));
    } else {
      const rows = await queryAsync(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'telecalls'"
      );
      existing = new Set(rows.map((r) => String(r.column_name).toLowerCase()));
    }
  } catch (_) { /* fall through and try the ALTERs blindly */ }

  for (const [col, def] of wanted) {
    if (existing.has(col)) continue;
    try {
      await queryAsync(`ALTER TABLE telecalls ADD COLUMN ${col} ${def}`);
    } catch (_) { /* race with another process */ }
  }

  leadColumnsEnsured = true;
}

/**
 * Automatically create or update a CRM lead in telecalls with source = 'WhatsApp'
 * @param {Object} leadData
 * @param {string} leadData.phone - Customer phone number
 * @param {string} [leadData.name] - Customer name
 * @param {string} [leadData.company] - Company name
 * @param {string} [leadData.email] - Email address
 * @param {string} [leadData.city] - Location/City
 * @param {string} [leadData.service] - Service or product of interest
 * @param {string} [leadData.notes] - Inquiry details / conversation summary
 * @param {string} [leadData.sourceDetail] - Sub-source (e.g. 'WhatsApp Flow: Booking', 'WhatsApp AI Lead', 'WhatsApp Inbound')
 * @param {string|number} [leadData.assignedTo] - Assigned staff ID or name
 * @param {string|number} [leadData.sessionKey] - Session/user the capture is attributed to, so the contact lands in the right organization
 * @param {number} [leadData.tenantId] - Explicit organization, when the caller already resolved one
 */
async function captureLeadFromWhatsApp(leadData = {}) {
  const {
    phone,
    name,
    company,
    email,
    city,
    service,
    notes,
    sourceDetail = "WhatsApp Inbound",
    assignedTo = null,
    sessionKey = null,
    tenantId = null,
  } = leadData;

  const last10 = clean10DigitPhone(phone);
  const rawPhone = String(phone || "").replace(/\D/g, "");
  const identityPhone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;
  if (!last10 || last10.length < 10) {
    console.warn(`[WA LeadCapture] Skipped lead creation: invalid phone '${phone}'`);
    return { success: false, reason: "invalid_phone" };
  }

  await ensureLeadTableColumns();

  const customerName = (name || "").trim() || "WhatsApp Lead";
  const serviceName = (service || "").trim() || "General Inquiry";
  const locationCity = (city || "").trim() || "Unknown";
  const companyName = (company || "").trim() || null;
  const emailAddr = (email || "").trim() || null;
  const noteText = notes ? `[WhatsApp Inquiry]: ${notes}` : `Lead captured via WhatsApp (${sourceDetail})`;
  const contactTenantId = await require("./waContactTenancy").tenantForContactWrite({
    tenantId,
    sessionKey,
  });

  try {
    // 1. Check if lead already exists in telecalls
    const existing = await queryAsync(
      "SELECT id, customer_name, followup_notes FROM telecalls WHERE tenant_id = ? AND mobile_number = ? LIMIT 1",
      [contactTenantId, identityPhone]
    );

    let leadId;
    let isNew = false;

    if (existing && existing.length > 0) {
      leadId = existing[0].id;
      // Append note to existing lead
      const updatedNotes = existing[0].followup_notes
        ? `${existing[0].followup_notes}\n\n[${new Date().toLocaleDateString("en-IN")}] ${noteText}`
        : noteText;

      await queryAsync(
        `UPDATE telecalls 
         SET customer_name = COALESCE(NULLIF(?, 'WhatsApp Lead'), customer_name),
             company_name = COALESCE(?, company_name),
             email = COALESCE(?, email),
             service_name = COALESCE(?, service_name),
             location_city = COALESCE(NULLIF(?, 'Unknown'), location_city),
             followup_notes = ?,
             call_date = CURDATE()
         WHERE id = ? AND tenant_id = ?`,
        [customerName, companyName, emailAddr, serviceName, locationCity, updatedNotes, leadId, contactTenantId]
      );
      console.log(`📋 [WA LeadCapture] Updated existing CRM lead ID ${leadId} for +91${last10} (Source: WhatsApp)`);
    } else {
      isNew = true;
      const [res] = await db.promise().query(
        `INSERT INTO telecalls (
          customer_name,
          company_name,
          mobile_number,
          location_city,
          call_date,
          service_name,
          staff_name,
          call_outcome,
          reference,
          reference_by,
          email,
          followup_notes,
          created_at,
          assigned_to, tenant_id
        ) VALUES (?, ?, ?, ?, CURDATE(), ?, 'System', 'WhatsApp Lead', 'WhatsApp', ?, ?, ?, NOW(), ?, ?)`,
        [
          customerName,
          companyName,
          identityPhone,
          locationCity,
          serviceName,
          sourceDetail,
          emailAddr,
          noteText,
          assignedTo || null,
          contactTenantId,
        ]
      );
      leadId = res.insertId;
      console.log(`🎉 [WA LeadCapture] Created NEW CRM lead ID ${leadId} for ${customerName} (+91${last10}) (Source: WhatsApp)`);
    }

    // 2. Sync to wa_contacts, under the organization that captured the lead
    await queryAsync(
      `INSERT INTO wa_contacts (tenant_id, name, phone, country_code, source, crm_ref_type, crm_ref_id, opt_in_status, last_contacted)
       VALUES (?, ?, ?, '91', 'WhatsApp', 'telecalls', ?, 0, NOW())
       ON DUPLICATE KEY UPDATE 
         name = COALESCE(NULLIF(VALUES(name), 'WhatsApp Lead'), name),
         source = 'WhatsApp',
         crm_ref_type = 'telecalls',
         crm_ref_id = VALUES(crm_ref_id),
         last_contacted = NOW()`,
      [contactTenantId, customerName, identityPhone, leadId]
    ).catch(() => {});

    // 3. Emit real-time notification to CRM Dashboard & Staff
    try {
      const message = isNew
        ? `New Lead from WhatsApp: ${customerName} (+91${last10}) interested in ${serviceName}`
        : `WhatsApp Lead Activity: ${customerName} (+91${last10}) updated inquiry`;

      const { getNotificationIO } = require("../sockets/notifications");
      const helpers = getNotificationIO();
      const admins = await queryAsync("SELECT user_id FROM organization_memberships WHERE tenant_id=? AND membership_status='active' AND role IN ('organization_owner','organization_admin')", [contactTenantId]);
      for (const admin of admins) {
        helpers?.sendToUser(admin.user_id, "new_notification", {
          id: Date.now(),
          type: "new_lead",
          title: isNew ? "🎉 New WhatsApp Lead!" : "WhatsApp Lead Activity",
          message,
          related_type: "telecalls",
          related_id: leadId,
          timestamp: new Date().toISOString(),
          is_read: 0,
        });
      }
    } catch (_) {}

    // 4. Trigger CRM Event Bus & Automations for New Lead
    if (isNew) {
      try {
        // The event bus owns this. Its `new_lead` listener is what calls
        // triggerAutomation("new_lead") — calling it here as well meant every
        // first-time contact's welcome/automation fired TWICE.
        const crmEventBus = require("./crmEventBus");
        crmEventBus.emit("new_lead", {
          tenantId: contactTenantId,
          leadId,
          phone: last10,
          cleanPhone: "91" + last10,
          contactName: customerName,
          customerName,
          companyName,
          locationCity,
          serviceName,
          source: sourceDetail,
          isNew: true,
        });
      } catch (evErr) {
        console.warn("[WA LeadCapture] Event bus error:", evErr.message);
      }
    }

    return { success: true, leadId, isNew, source: "WhatsApp" };
  } catch (err) {
    console.error("[WA LeadCapture] Error creating lead:", err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  captureLeadFromWhatsApp,
  clean10DigitPhone,
};
