"use strict";
/**
 * crmEventBus.js
 *
 * Universal CRM Event Bus & Autonomous WhatsApp Automation Orchestrator
 *
 * Implements the bidirectional CRM <-> WhatsApp Automation Operating System:
 * 1. CRM Event -> WhatsApp Action (Invoices, Quotations, Payments, Leads, Tasks, Appointments)
 * 2. WhatsApp Customer Response -> CRM Action (Invoice Paid, Quote Approved, Changes Requested, Callback Task Created)
 */

const EventEmitter = require("events");
const db = require("../config/database");

class CRMEventBus extends EventEmitter {}

const crmEventBus = new CRMEventBus();

function queryAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

function cleanPhone(phone) {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  return cleaned.length === 10 ? "91" + cleaned : cleaned;
}

// ── 1. INVOICE CREATED AUTOMATION ───────────────────────────────────────────
crmEventBus.on("invoice_created", async (invoice) => {
  try {
    const { id, client_company, invoice_date, invoice_duedate, grand_total, client_phone } = invoice;

    // Resolve client phone if not supplied
    let phone = client_phone;
    let customerName = client_company || "Customer";
    if (!phone) {
      const [clientRows] = await db.promise().query(
        `SELECT phone, name FROM clients 
         WHERE (company_name = ? OR name = ?) AND phone IS NOT NULL AND phone != '' LIMIT 1`,
        [client_company, client_company]
      );
      if (clientRows && clientRows[0]) {
        phone = clientRows[0].phone;
        customerName = clientRows[0].name || client_company;
      }
    }

    const normPhone = cleanPhone(phone);
    if (!normPhone || normPhone.length < 10) {
      console.log(`ℹ️ [CRM Event Bus] Invoice #${id} created, but no valid WhatsApp phone found for "${client_company}"`);
      return;
    }

    const amountStr = grand_total ? `₹${parseFloat(grand_total).toLocaleString("en-IN")}` : "as detailed";
    const dueDateStr = invoice_duedate ? new Date(invoice_duedate).toLocaleDateString("en-IN") : "on receipt";

    const messageText = 
      `Hello *${customerName}*,\n\n` +
      `Your invoice *INV-${id}* has been generated.\n\n` +
      `• *Amount Due:* ${amountStr}\n` +
      `• *Due Date:* ${dueDateStr}\n\n` +
      `Please select an option below:`;

    const options = [
      { id: "btn_paid", label: "💳 Pay Now / UPI", action: "confirm_payment" },
      { id: "btn_invoice", label: "📄 Send Invoice PDF", action: "send_invoice_copy" },
      { id: "btn_call_acc", label: "📞 Talk to Accounts", action: "request_callback" },
    ];

    const waConfirmation = require("./waConfirmationService");
    await waConfirmation.sendInteractiveReminder({
      phone: normPhone,
      contactName: customerName,
      reminderType: "payment_due",
      title: `Invoice Generated: INV-${id}`,
      messageText,
      options,
      refTable: "clientinvoices",
      refId: id,
    });

    console.log(`✅ [CRM Event Bus] Invoice #${id} automated WhatsApp notice dispatched to +${normPhone}`);
  } catch (err) {
    console.error("[CRM Event Bus] Error in invoice_created listener:", err.message);
  }
});

// ── 2. QUOTATION CREATED AUTOMATION ─────────────────────────────────────────
crmEventBus.on("quotation_created", async (quotation) => {
  try {
    const { id, reference_no, grand_total, customer_id, client_company, mobile_number } = quotation;

    let phone = mobile_number;
    let customerName = client_company || "Valued Client";

    if (!phone && customer_id) {
      const [custRows] = await db.promise().query(
        "SELECT customer_name, mobile_number FROM customers WHERE id = ? LIMIT 1",
        [customer_id]
      );
      if (custRows && custRows[0]) {
        phone = custRows[0].mobile_number;
        customerName = custRows[0].customer_name || customerName;
      }
    }

    if (!phone && client_company) {
      const [clientRows] = await db.promise().query(
        "SELECT name, phone FROM clients WHERE (company_name = ? OR name = ?) AND phone IS NOT NULL LIMIT 1",
        [client_company, client_company]
      );
      if (clientRows && clientRows[0]) {
        phone = clientRows[0].phone;
        customerName = clientRows[0].name || customerName;
      }
    }

    const normPhone = cleanPhone(phone);
    if (!normPhone || normPhone.length < 10) {
      console.log(`ℹ️ [CRM Event Bus] Quotation #${id} created, but no valid WhatsApp phone found.`);
      return;
    }

    const refNo = reference_no || `QT-${id}`;
    const amountStr = grand_total ? `₹${parseFloat(grand_total).toLocaleString("en-IN")}` : "";

    const messageText = 
      `Hello *${customerName}*,\n\n` +
      `Your quotation proposal *${refNo}* ${amountStr ? `(${amountStr}) ` : ""}is ready for review.\n\n` +
      `Please select an option below:`;

    const options = [
      { id: "btn_approve_quote", label: "👍 Accept Quote", action: "approve_quotation" },
      { id: "btn_modify_quote", label: "💬 Request Changes", action: "request_callback" },
      { id: "btn_reject_quote", label: "❌ Not Interested", action: "reject_quotation" },
    ];

    const waConfirmation = require("./waConfirmationService");
    await waConfirmation.sendInteractiveReminder({
      phone: normPhone,
      contactName: customerName,
      reminderType: "quotation_followup",
      title: `Quotation Proposal: ${refNo}`,
      messageText,
      options,
      refTable: "quotations",
      refId: id,
    });

    console.log(`✅ [CRM Event Bus] Quotation #${id} automated WhatsApp notice dispatched to +${normPhone}`);
  } catch (err) {
    console.error("[CRM Event Bus] Error in quotation_created listener:", err.message);
  }
});

// ── 3. PAYMENT RECEIVED AUTOMATION (AUTO RECEIPT) ───────────────────────────
crmEventBus.on("payment_received", async (payment) => {
  try {
    const { invoice_id, amount, payment_method, reference_no, phone, client_name } = payment;

    let targetPhone = phone;
    let customerName = client_name || "Customer";

    if (!targetPhone && invoice_id) {
      const [invRows] = await db.promise().query(`
        SELECT ci.client_company,
          (SELECT c.phone FROM clients c WHERE (c.company_name = ci.client_company OR c.name = ci.client_company) AND c.phone IS NOT NULL LIMIT 1) AS phone,
          (SELECT c.name FROM clients c WHERE (c.company_name = ci.client_company OR c.name = ci.client_company) LIMIT 1) AS name
        FROM clientinvoices ci
        WHERE ci.id = ? LIMIT 1
      `, [invoice_id]);

      if (invRows && invRows[0]) {
        targetPhone = invRows[0].phone;
        customerName = invRows[0].name || invRows[0].client_company || customerName;
      }
    }

    const normPhone = cleanPhone(targetPhone);
    if (!normPhone || normPhone.length < 10) return;

    const receiptMsg = 
      `🎉 *Payment Received Successfully!*\n\n` +
      `Dear *${customerName}*,\n` +
      `We have received your payment of *₹${parseFloat(amount).toLocaleString("en-IN")}* for invoice *INV-${invoice_id || ""}*.\n\n` +
      `• *Method:* ${payment_method || "Online / UPI"}\n` +
      (reference_no ? `• *Reference / UTR:* \`${reference_no}\`\n` : "") +
      `• *Date:* ${new Date().toLocaleDateString("en-IN")}\n\n` +
      `Invoice status has been updated to *PAID* in our accounts system. Thank you for your business! 🙏`;

    const waLoadBalancer = require("./waLoadBalancer");
    const mdToWa = require("./mdToWa");
    await waLoadBalancer.sendTextMessage(normPhone, mdToWa.toWhatsApp(receiptMsg)).catch(() => {});

    console.log(`✅ [CRM Event Bus] Payment receipt dispatched via WhatsApp to +${normPhone}`);
  } catch (err) {
    console.error("[CRM Event Bus] Error in payment_received listener:", err.message);
  }
});

// ── 4. CREATE CRM PAYMENT VERIFICATION TASK (FROM "I ALREADY PAID") ──────────
crmEventBus.on("payment_claim_submitted", async ({ phone, customerName, utrReference, reminderId }) => {
  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    await queryAsync(
      `INSERT INTO tasks (
        project_name, task_title, client_name, project_status, project_priority,
        created_date, due_date, task_description
      ) VALUES (?, ?, ?, 'Pending', 'High', ?, ?, ?)`,
      [
        "Accounts & Collections",
        `Verify WhatsApp Payment Claim: ${utrReference || "UTR Needed"}`,
        customerName || `+${phone}`,
        todayStr,
        todayStr,
        `Customer (+${phone}) marked "Already Paid" on WhatsApp reminder #${reminderId || "N/A"}. Provided reference: ${utrReference || "None provided"}. Please verify bank statement and credit invoice.`,
      ]
    );
    console.log(`✅ [CRM Event Bus] Created payment verification task for Accounts team.`);
  } catch (err) {
    console.error("[CRM Event Bus] Failed to create payment verification task:", err.message);
  }
});

module.exports = crmEventBus;
