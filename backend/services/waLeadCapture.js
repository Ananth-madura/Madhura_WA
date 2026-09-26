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
  } = leadData;

  const last10 = clean10DigitPhone(phone);
  if (!last10 || last10.length < 10) {
    console.warn(`[WA LeadCapture] Skipped lead creation: invalid phone '${phone}'`);
    return { success: false, reason: "invalid_phone" };
  }

  const customerName = (name || "").trim() || "WhatsApp Lead";
  const serviceName = (service || "").trim() || "General Inquiry";
  const locationCity = (city || "").trim() || "Unknown";
  const companyName = (company || "").trim() || null;
  const emailAddr = (email || "").trim() || null;
  const noteText = notes ? `[WhatsApp Inquiry]: ${notes}` : `Lead captured via WhatsApp (${sourceDetail})`;

  try {
    // 1. Check if lead already exists in telecalls
    const existing = await queryAsync(
      "SELECT id, customer_name, followup_notes FROM telecalls WHERE mobile_number LIKE ? LIMIT 1",
      [`%${last10}`]
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
         WHERE id = ?`,
        [customerName, companyName, emailAddr, serviceName, locationCity, updatedNotes, leadId]
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
          assigned_to
        ) VALUES (?, ?, ?, ?, CURDATE(), ?, 'System', 'WhatsApp Lead', 'WhatsApp', ?, ?, ?, NOW(), ?)`,
        [
          customerName,
          companyName,
          last10,
          locationCity,
          serviceName,
          sourceDetail,
          emailAddr,
          noteText,
          assignedTo || null,
        ]
      );
      leadId = res.insertId;
      console.log(`🎉 [WA LeadCapture] Created NEW CRM lead ID ${leadId} for ${customerName} (+91${last10}) (Source: WhatsApp)`);
    }

    // 2. Sync to wa_contacts
    await queryAsync(
      `INSERT INTO wa_contacts (name, phone, country_code, source, crm_ref_type, crm_ref_id, opt_in_status, last_contacted)
       VALUES (?, ?, '91', 'WhatsApp', 'telecalls', ?, 1, NOW())
       ON DUPLICATE KEY UPDATE 
         name = COALESCE(NULLIF(VALUES(name), 'WhatsApp Lead'), name),
         source = 'WhatsApp',
         crm_ref_type = 'telecalls',
         crm_ref_id = VALUES(crm_ref_id),
         last_contacted = NOW()`,
      [customerName, last10, leadId]
    ).catch(() => {});

    // 3. Emit real-time notification to CRM Dashboard & Staff
    try {
      const message = isNew
        ? `New Lead from WhatsApp: ${customerName} (+91${last10}) interested in ${serviceName}`
        : `WhatsApp Lead Activity: ${customerName} (+91${last10}) updated inquiry`;

      await queryAsync(
        `INSERT INTO admin_notifications (type, message, related_type, related_id, priority) 
         VALUES ('new_lead', ?, 'telecalls', ?, 'high')`,
        [message, leadId]
      ).catch(() => {});

      const { getNotificationIO } = require("../sockets/notifications");
      const helpers = getNotificationIO && getNotificationIO();
      if (helpers) {
        helpers.sendToAdmin("new_notification", {
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
