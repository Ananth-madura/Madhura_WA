"use strict";
/**
 * waAiTools.js
 *
 * Real-time CRM Tools the WhatsApp AI assistant can execute to answer queries,
 * manage customer leads, schedule callbacks, check invoice status, and request human assistance.
 */
const db = require("../config/database");

function queryAsync(sql, params) {
  return new Promise((resolve, reject) => {
    db.query(sql, params || [], (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

// Describes available tools to the AI model
const TOOLS_DESCRIPTION = `You have access to live CRM actions and data tools. Whenever you need to perform an action or fetch real business data for this customer, respond with ONLY a JSON object in this format:
{"action": "<tool_name>", "params": { ...optional params... }}

Available Tools:
1. create_lead: Automatically saves or updates this customer as a qualified CRM lead when they express interest or provide their details.
   Params: {"name": "Customer Name", "service": "Service/Product interested in", "city": "City/Location", "notes": "Key inquiry details"}

2. schedule_callback: Registers a phone callback reminder for our sales/support team.
   Params: {"preferred_time": "Morning/Afternoon/Tomorrow", "notes": "Topic for callback"}

3. check_invoice_status: Fetches this customer's recent invoice numbers, due dates, and payment status.
   Params: {}

4. get_company_services: Fetches the live list of services, AMC maintenance packages, and solutions offered by our company.
   Params: {}

5. request_human_support: Immediately alerts our team to take over this conversation (use when user explicitly asks for a human agent or has an issue you cannot resolve).
   Params: {"reason": "Customer requested human executive"}

6. get_contact_quotations: Looks up recent quotations and proposals sent to this customer.
   Params: {}

When you use a tool, you will receive the real CRM data back, and then you can answer the customer clearly and conversationally.`;

async function checkInvoiceStatus(phone) {
  try {
    const waBilling = require("./waCustomerBillingService");
    const billingData = await waBilling.getCustomerBillsAndReceipts(phone);
    if (!billingData.found) {
      return { found: false, message: "No registered invoices or bills found for this phone number." };
    }
    return {
      found: true,
      customer_name: billingData.customerName,
      total_billed: `₹${billingData.totalBilled.toLocaleString("en-IN")}`,
      total_paid: `₹${billingData.totalPaid.toLocaleString("en-IN")}`,
      balance_due: `₹${billingData.balanceDue.toLocaleString("en-IN")}`,
      invoices: billingData.invoices.map((inv) => ({
        invoice_no: inv.invoice_no,
        type: inv.type,
        service: inv.project_name,
        date: inv.date,
        due_date: inv.due_date,
        amount: `₹${inv.amount_billed.toLocaleString("en-IN")}`,
        status: inv.status,
      })),
    };
  } catch (err) {
    return { found: false, error: err.message };
  }
}

async function createLead(phone, params = {}) {
  const waLeadCapture = require("./waLeadCapture");
  try {
    const result = await waLeadCapture.captureLeadFromWhatsApp({
      phone,
      name: params.name || null,
      service: params.service || null,
      city: params.city || null,
      notes: params.notes || "Lead captured by WhatsApp AI Assistant",
      sourceDetail: "WhatsApp AI Assistant",
    });
    return {
      lead_saved: true,
      is_new: result.isNew,
      lead_id: result.leadId,
      message: "Lead successfully recorded in CRM database.",
    };
  } catch (err) {
    return { lead_saved: false, error: err.message };
  }
}

async function scheduleCallback(phone, params = {}) {
  const last10 = (phone || "").replace(/\D/g, "").slice(-10);
  const waLeadCapture = require("./waLeadCapture");
  try {
    await waLeadCapture.captureLeadFromWhatsApp({
      phone,
      notes: `[Callback Requested]: ${params.preferred_time || "As soon as possible"} - ${params.notes || "General callback"}`,
      sourceDetail: "WhatsApp AI Callback Request",
    });

    const notifMsg = `WhatsApp Callback Request from +91${last10} (${params.preferred_time || "Soon"}): ${params.notes || "Followup"}`;
    await queryAsync(
      `INSERT INTO admin_notifications (type, message, related_type, priority) VALUES ('wa_callback', ?, 'telecalls', 'high')`,
      [notifMsg]
    );

    return { scheduled: true, message: "Callback request registered. Our team will call you shortly." };
  } catch (err) {
    return { scheduled: false, error: err.message };
  }
}

async function getCompanyServices() {
  try {
    const rows = await queryAsync("SELECT DISTINCT material, issues FROM services LIMIT 10");
    const serviceList = rows
      .map((r) => r.material || r.issues)
      .filter(Boolean);

    const defaultServices = [
      "Engineering & Hardware AMC Maintenance",
      "Equipment Servicing, Repair & Troubleshooting",
      "Annual Maintenance Contracts (AMC / ALC)",
      "Technical Field Inspection & Support",
      "Turnkey Project Installation & Commissioning",
    ];

    const combined = Array.from(new Set([...serviceList, ...defaultServices]));
    return {
      available_services: combined,
      amc_available: true,
      service_warranty: "Standard warranty provided with all official maintenance contracts.",
    };
  } catch {
    return {
      available_services: [
        "Engineering & Hardware AMC Maintenance",
        "Equipment Servicing, Repair & Troubleshooting",
        "Annual Maintenance Contracts (AMC / ALC)",
        "Technical Field Inspection & Support",
      ],
      amc_available: true,
    };
  }
}

async function requestHumanSupport(phone, params = {}) {
  const last10 = (phone || "").replace(/\D/g, "").slice(-10);
  const reason = params.reason || "Customer requested human support";
  const message = `WhatsApp AI handoff: Customer +91${last10} requested to speak with a human agent. Reason: ${reason}`;

  try {
    // Pause AI for 180 minutes on this contact
    await queryAsync(
      "UPDATE wa_contacts SET ai_paused_until = DATE_ADD(NOW(), INTERVAL 180 MINUTE), ai_autoreply_disabled = 1 WHERE phone LIKE ?",
      [`%${last10}`]
    ).catch(() => {});

    const result = await queryAsync(
      `INSERT INTO admin_notifications (type, message, related_type, priority) VALUES ('wa_support_request', ?, 'whatsapp', 'high')`,
      [message]
    );

    try {
      const { getNotificationIO } = require("../sockets/notifications");
      const helpers = getNotificationIO();
      if (helpers) {
        helpers.sendToAdmin("new_notification", {
          id: Date.now(),
          dbId: result.insertId,
          type: "wa_support_request",
          title: "WhatsApp: Customer Requested Support",
          message,
          timestamp: new Date().toISOString(),
          is_read: 0,
        });
      }
    } catch (_) {}

    return { notified: true, handoff: true, message: "A senior team member has been alerted and will take over this chat." };
  } catch (err) {
    console.error("[WA AI Tools] request_human_support notification failed:", err.message);
    return { notified: false, error: err.message };
  }
}

async function getContactQuotations(phone) {
  const last10 = (phone || "").replace(/\D/g, "").slice(-10);
  try {
    const rows = await queryAsync(
      `SELECT q.id, q.reference_no, q.grand_total, q.status, q.quotation_date
       FROM quotations q
       JOIN customers c ON c.id = q.customer_id
       WHERE c.mobile_number LIKE ? OR c.phone LIKE ?
       ORDER BY q.id DESC LIMIT 3`,
      [`%${last10}`, `%${last10}`]
    );

    if (!rows.length) {
      return { found: false, message: "No active quotations found for this phone number." };
    }

    return {
      found: true,
      quotations: rows.map((q) => ({
        quote_no: q.reference_no || `QUO-${q.id}`,
        amount: q.grand_total ? `₹${parseFloat(q.grand_total).toLocaleString("en-IN")}` : "Under Review",
        status: q.status || "Generated",
        date: q.quotation_date ? new Date(q.quotation_date).toLocaleDateString("en-IN") : "Recent",
      })),
    };
  } catch (err) {
    return { found: false, error: err.message };
  }
}

const TOOLS = {
  check_invoice_status: (phone) => checkInvoiceStatus(phone),
  create_lead: (phone, params) => createLead(phone, params),
  schedule_callback: (phone, params) => scheduleCallback(phone, params),
  get_company_services: () => getCompanyServices(),
  request_human_support: (phone, params) => requestHumanSupport(phone, params),
  get_contact_quotations: (phone) => getContactQuotations(phone),
};

async function runTool(actionName, phone, params = {}) {
  const fn = TOOLS[actionName];
  if (!fn) return { error: `Unknown tool "${actionName}"` };
  try {
    return await fn(phone, params);
  } catch (err) {
    return { error: err.message };
  }
}

module.exports = { TOOLS_DESCRIPTION, runTool };
