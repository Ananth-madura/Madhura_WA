"use strict";
/**
 * crmEventBus.js
 *
 * Universal CRM Event Bus & Autonomous WhatsApp Automation Orchestrator
 *
 * Implements the bidirectional CRM <-> WhatsApp Automation Operating System:
 * 1. CRM Event -> WhatsApp Action (Invoices, Quotations, Payments, Leads, Walkins, AMC, Tasks)
 * 2. WhatsApp Customer Response -> CRM Action (Invoice Paid, Quote Approved, Changes Requested, Callback Task Created)
 * 3. Autonomous Real-Time Database Change Sweep (polls newly created CRM records and triggers events automatically)
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
  const cleaned = String(phone).replace(/\D/g, "");
  return cleaned.length === 10 ? "91" + cleaned : cleaned;
}

function emitSocketEvent(eventName, payload) {
  try {
    const app = require("../server");
    const io = app.get && app.get("io");
    if (io) {
      io.emit("crm_event", { event: eventName, payload, timestamp: new Date().toISOString() });
      io.emit(eventName, payload);
    }
  } catch (_) {}
}

// ── 1. INVOICE CREATED AUTOMATION ───────────────────────────────────────────
crmEventBus.on("invoice_created", async (invoice) => {
  try {
    const { id, client_company, invoice_date, invoice_duedate, grand_total, client_phone, total_amount } = invoice;

    // Resolve client phone and name if not supplied
    let phone = client_phone;
    let customerName = client_company || "Customer";
    if (!phone && client_company) {
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

    const amountVal = grand_total || total_amount;
    const amountStr = amountVal ? `₹${parseFloat(amountVal).toLocaleString("en-IN")}` : "as detailed";
    const dueDateStr = invoice_duedate ? new Date(invoice_duedate).toLocaleDateString("en-IN") : "on receipt";

    // 1. Dispatch through Automations Engine (matches Rule #2 'Instant Invoice WhatsApp Notice', linked flow bots, etc.)
    const { triggerAutomation } = require("./waAutomationService");
    const autoRes = await triggerAutomation("invoice_created", {
      phone: normPhone,
      contactName: customerName,
      data: {
        invoice_no: `INV-${id}`,
        invoice_id: id,
        amount: amountStr,
        grand_total: amountStr,
        due_date: dueDateStr,
        company: client_company || customerName,
        client_company: client_company || customerName,
      },
    }).catch((e) => {
      console.warn("[CRM Event Bus] triggerAutomation('invoice_created') error:", e.message);
      return null;
    });

    // 2. If no active rule was executed, dispatch standard interactive confirmation reminder
    if (!autoRes || autoRes.count === 0) {
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
    }

    emitSocketEvent("invoice_created", { id, customerName, phone: normPhone, amount: amountStr });
    console.log(`✅ [CRM Event Bus] Invoice #${id} automated WhatsApp notice dispatched to +${normPhone}`);
  } catch (err) {
    console.error("[CRM Event Bus] Error in invoice_created listener:", err.message);
  }
});

// ── 2. QUOTATION CREATED AUTOMATION ─────────────────────────────────────────
crmEventBus.on("quotation_created", async (quotation) => {
  try {
    const { id, reference_no, grand_total, customer_id, client_company, mobile_number, phone: rawPhone } = quotation;

    let phone = mobile_number || rawPhone;
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

    // 1. Dispatch through Automations Engine (matches Rule #7 'Instant Quotation Proposal Notice')
    const { triggerAutomation } = require("./waAutomationService");
    const autoRes = await triggerAutomation("quotation_created", {
      phone: normPhone,
      contactName: customerName,
      data: {
        quote_no: refNo,
        quotation_no: refNo,
        reference_no: refNo,
        amount: amountStr,
        grand_total: amountStr,
        service_name: quotation.service_name || "Services",
        company: client_company || customerName,
      },
    }).catch((e) => {
      console.warn("[CRM Event Bus] triggerAutomation('quotation_created') error:", e.message);
      return null;
    });

    // 2. If no active rule was executed, dispatch interactive quotation followup
    if (!autoRes || autoRes.count === 0) {
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
    }

    emitSocketEvent("quotation_created", { id, refNo, customerName, phone: normPhone, amount: amountStr });
    console.log(`✅ [CRM Event Bus] Quotation #${id} automated WhatsApp notice dispatched to +${normPhone}`);
  } catch (err) {
    console.error("[CRM Event Bus] Error in quotation_created listener:", err.message);
  }
});

// ── 3. PAYMENT RECEIVED AUTOMATION (AUTO RECEIPT) ───────────────────────────
crmEventBus.on("payment_received", async (payment) => {
  try {
    const { invoice_id, amount, payment_method, reference_no, Transaction_ID, phone, client_name } = payment;

    let targetPhone = phone;
    let customerName = client_name || "Customer";

    if (!targetPhone && invoice_id) {
      const [invRows] = await db.promise().query(
        `SELECT ci.client_company,
          (SELECT c.phone FROM clients c WHERE (c.company_name = ci.client_company OR c.name = ci.client_company) AND c.phone IS NOT NULL LIMIT 1) AS phone,
          (SELECT c.name FROM clients c WHERE (c.company_name = ci.client_company OR c.name = ci.client_company) LIMIT 1) AS name
        FROM clientinvoices ci
        WHERE ci.id = ? LIMIT 1`,
        [invoice_id]
      );

      if (invRows && invRows[0]) {
        targetPhone = invRows[0].phone;
        customerName = invRows[0].name || invRows[0].client_company || customerName;
      }
    }

    const normPhone = cleanPhone(targetPhone);
    if (!normPhone || normPhone.length < 10) return;

    const amountStr = amount ? `₹${parseFloat(amount).toLocaleString("en-IN")}` : "";
    const refStr = reference_no || Transaction_ID || "";

    // 1. Dispatch through Automations Engine (matches Rule #3 'Payment Receipt Acknowledgement')
    const { triggerAutomation } = require("./waAutomationService");
    const autoRes = await triggerAutomation("payment_received", {
      phone: normPhone,
      contactName: customerName,
      data: {
        invoice_no: `INV-${invoice_id || ""}`,
        invoice_id,
        amount: amountStr,
        payment_method: payment_method || "Online / UPI",
        reference_no: refStr,
        date: new Date().toLocaleDateString("en-IN"),
      },
    }).catch((e) => {
      console.warn("[CRM Event Bus] triggerAutomation('payment_received') error:", e.message);
      return null;
    });

    if (!autoRes || autoRes.count === 0) {
      const receiptMsg =
        `🎉 *Payment Received Successfully!*\n\n` +
        `Dear *${customerName}*,\n` +
        `We have received your payment of *${amountStr}* for invoice *INV-${invoice_id || ""}*.\n\n` +
        `• *Method:* ${payment_method || "Online / UPI"}\n` +
        (refStr ? `• *Reference / UTR:* \`${refStr}\`\n` : "") +
        `• *Date:* ${new Date().toLocaleDateString("en-IN")}\n\n` +
        `Invoice status has been updated to *PAID* in our accounts system. Thank you for your business! 🙏`;

      const waLoadBalancer = require("./waLoadBalancer");
      const mdToWa = require("./mdToWa");
      await waLoadBalancer.sendTextMessage(normPhone, mdToWa.toWhatsApp(receiptMsg)).catch(() => {});
    }

    emitSocketEvent("payment_received", { invoice_id, amount: amountStr, customerName, phone: normPhone });
    console.log(`✅ [CRM Event Bus] Payment receipt dispatched via WhatsApp to +${normPhone}`);
  } catch (err) {
    console.error("[CRM Event Bus] Error in payment_received listener:", err.message);
  }
});

// ── 4. NEW LEAD CREATED AUTOMATION ──────────────────────────────────────────
crmEventBus.on("new_lead", async (lead) => {
  try {
    const { phone, customerName, name, companyName, company, serviceName, service, locationCity, city, leadId } = lead;
    const normPhone = cleanPhone(phone);
    if (!normPhone || normPhone.length < 10) return;

    const resolvedName = customerName || name || "Valued Customer";
    const resolvedService = serviceName || service || "General Inquiry";

    const { triggerAutomation } = require("./waAutomationService");
    await triggerAutomation("new_lead", {
      phone: normPhone,
      contactName: resolvedName,
      data: {
        name: resolvedName,
        customer_name: resolvedName,
        service: resolvedService,
        service_name: resolvedService,
        company: companyName || company || "",
        city: locationCity || city || "",
        lead_id: leadId || "",
      },
    }).catch((e) => console.warn("[CRM Event Bus] new_lead error:", e.message));

    emitSocketEvent("new_lead", { phone: normPhone, name: resolvedName, service: resolvedService, leadId });
    console.log(`✅ [CRM Event Bus] New lead automation executed for ${resolvedName} (+${normPhone})`);
  } catch (err) {
    console.error("[CRM Event Bus] Error in new_lead listener:", err.message);
  }
});

// ── 5. WALKIN SHOP VISIT AUTOMATION ─────────────────────────────────────────
crmEventBus.on("walkin_created", async (walkin) => {
  try {
    const { mobile_number, phone, customer_name, name, company_name, purpose, location_city, id } = walkin;
    const normPhone = cleanPhone(mobile_number || phone);
    if (!normPhone || normPhone.length < 10) return;

    const resolvedName = customer_name || name || "Valued Visitor";
    const resolvedPurpose = purpose || "Visit & Consultation";

    const { triggerAutomation } = require("./waAutomationService");
    await triggerAutomation("walkin_created", {
      phone: normPhone,
      contactName: resolvedName,
      data: {
        name: resolvedName,
        purpose: resolvedPurpose,
        company: company_name || "",
        city: location_city || "",
        walkin_id: id || "",
      },
    }).catch((e) => console.warn("[CRM Event Bus] walkin_created error:", e.message));

    emitSocketEvent("walkin_created", { phone: normPhone, name: resolvedName, purpose: resolvedPurpose });
    console.log(`✅ [CRM Event Bus] Walkin visit automation executed for ${resolvedName} (+${normPhone})`);
  } catch (err) {
    console.error("[CRM Event Bus] Error in walkin_created listener:", err.message);
  }
});

// ── 6. AMC CONTRACT AGREEMENT AUTOMATION ────────────────────────────────────
crmEventBus.on("amc_created", async (contract) => {
  try {
    const { id, client_company, contract_title, start_date, end_date, amount_value, mobile_number } = contract;
    let phone = mobile_number;
    let customerName = client_company || "Customer";

    if (!phone && client_company) {
      const [cRows] = await db.promise().query(
        "SELECT phone, name FROM clients WHERE (company_name = ? OR name = ?) AND phone IS NOT NULL LIMIT 1",
        [client_company, client_company]
      );
      if (cRows && cRows[0]) {
        phone = cRows[0].phone;
        customerName = cRows[0].name || client_company;
      }
    }

    const normPhone = cleanPhone(phone);
    if (!normPhone || normPhone.length < 10) return;

    const amountStr = amount_value ? `₹${parseFloat(amount_value).toLocaleString("en-IN")}` : "";
    const startDateStr = start_date ? new Date(start_date).toLocaleDateString("en-IN") : "";
    const endDateStr = end_date ? new Date(end_date).toLocaleDateString("en-IN") : "";

    const { triggerAutomation } = require("./waAutomationService");
    await triggerAutomation("amc_created", {
      phone: normPhone,
      contactName: customerName,
      data: {
        contract_title: contract_title || `AMC Contract #${id}`,
        contract_no: `AMC-${id}`,
        amount: amountStr,
        start_date: startDateStr,
        end_date: endDateStr,
        company: client_company || customerName,
      },
    }).catch((e) => console.warn("[CRM Event Bus] amc_created error:", e.message));

    emitSocketEvent("amc_created", { id, customerName, phone: normPhone, contractTitle: contract_title });
    console.log(`✅ [CRM Event Bus] AMC Contract #${id} notice executed for +${normPhone}`);
  } catch (err) {
    console.error("[CRM Event Bus] Error in amc_created listener:", err.message);
  }
});

// ── 7. SERVICE VISIT SCHEDULED ALERT ─────────────────────────────────────────
crmEventBus.on("service_visit_scheduled", async (visit) => {
  try {
    const { phone, customerName, name, visit_date, service_type, engineer_name, time_slot } = visit;
    const normPhone = cleanPhone(phone);
    if (!normPhone || normPhone.length < 10) return;

    const resolvedName = customerName || name || "Customer";

    const { triggerAutomation } = require("./waAutomationService");
    await triggerAutomation("service_visit_scheduled", {
      phone: normPhone,
      contactName: resolvedName,
      data: {
        visit_date: visit_date || "as scheduled",
        service_type: service_type || "Service Inspection",
        engineer_name: engineer_name || "Assigned Engineer",
        time_slot: time_slot || "business hours",
      },
    }).catch((e) => console.warn("[CRM Event Bus] service_visit_scheduled error:", e.message));

    emitSocketEvent("service_visit_scheduled", { phone: normPhone, name: resolvedName, visit_date });
    console.log(`✅ [CRM Event Bus] Service visit alert executed for ${resolvedName} (+${normPhone})`);
  } catch (err) {
    console.error("[CRM Event Bus] Error in service_visit_scheduled listener:", err.message);
  }
});

// ── 8. TICKET CLOSED FEEDBACK REQUEST ───────────────────────────────────────
crmEventBus.on("ticket_closed", async (ticket) => {
  try {
    const { phone, customerName, name, ticket_id, issue_type, resolved_by } = ticket;
    const normPhone = cleanPhone(phone);
    if (!normPhone || normPhone.length < 10) return;

    const resolvedName = customerName || name || "Customer";

    const { triggerAutomation } = require("./waAutomationService");
    await triggerAutomation("ticket_closed", {
      phone: normPhone,
      contactName: resolvedName,
      data: {
        ticket_id: ticket_id || "Closed Ticket",
        issue_type: issue_type || "Technical Support",
        resolved_by: resolved_by || "Customer Support",
      },
    }).catch((e) => console.warn("[CRM Event Bus] ticket_closed error:", e.message));

    emitSocketEvent("ticket_closed", { phone: normPhone, name: resolvedName, ticket_id });
    console.log(`✅ [CRM Event Bus] Ticket closed feedback request executed for +${normPhone}`);
  } catch (err) {
    console.error("[CRM Event Bus] Error in ticket_closed listener:", err.message);
  }
});

// ── 9. NEW CLIENT WELCOME ONBOARDING ────────────────────────────────────────
crmEventBus.on("welcome_message", async (client) => {
  try {
    const { phone, name, company_name } = client;
    const normPhone = cleanPhone(phone);
    if (!normPhone || normPhone.length < 10) return;

    const resolvedName = name || company_name || "Valued Client";

    const { triggerAutomation } = require("./waAutomationService");
    await triggerAutomation("welcome_message", {
      phone: normPhone,
      contactName: resolvedName,
      data: {
        name: resolvedName,
        company: company_name || "",
      },
    }).catch((e) => console.warn("[CRM Event Bus] welcome_message error:", e.message));

    emitSocketEvent("welcome_message", { phone: normPhone, name: resolvedName });
    console.log(`✅ [CRM Event Bus] Welcome onboarding executed for ${resolvedName} (+${normPhone})`);
  } catch (err) {
    console.error("[CRM Event Bus] Error in welcome_message listener:", err.message);
  }
});

// ── 10. CREATE CRM PAYMENT VERIFICATION TASK (FROM "I ALREADY PAID") ─────────
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
    emitSocketEvent("payment_claim_submitted", { phone, customerName, utrReference });
    console.log(`✅ [CRM Event Bus] Created payment verification task for Accounts team.`);
  } catch (err) {
    console.error("[CRM Event Bus] Failed to create payment verification task:", err.message);
  }
});

// ── 11. UNIVERSAL CRM REAL-TIME DATABASE CHANGE SWEEP ───────────────────────
// Automatically catches freshly created records inserted directly into MySQL
// (from external CRM PHP/Web pages) and fires the corresponding event!
let sweepTimer = null;
let isSweeping = false;

async function runCrmRealtimeEventSweep() {
  if (isSweeping) return;
  isSweeping = true;

  try {
    // A. Check for new Invoices
    const [newInvoices] = await db.promise().query(
      `SELECT id, client_company, invoice_date, invoice_duedate, project_names
       FROM clientinvoices
       WHERE (wa_notified IS NULL OR wa_notified = 0)
         AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
       ORDER BY id ASC LIMIT 10`
    ).catch(() => [[]]);

    for (const inv of newInvoices) {
      await db.promise().query("UPDATE clientinvoices SET wa_notified = 1 WHERE id = ?", [inv.id]).catch(() => {});
      console.log(`🔔 [CRM Sweep] Detected new Invoice #${inv.id} for "${inv.client_company}". Emitting event...`);
      crmEventBus.emit("invoice_created", inv);
    }

    // B. Check for new Quotations
    const [newQuotes] = await db.promise().query(
      `SELECT id, customer_id, quotation_date, grand_total, reference_no, client_company
       FROM quotations
       WHERE (wa_notified IS NULL OR wa_notified = 0)
         AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
       ORDER BY id ASC LIMIT 10`
    ).catch(() => [[]]);

    for (const quote of newQuotes) {
      await db.promise().query("UPDATE quotations SET wa_notified = 1 WHERE id = ?", [quote.id]).catch(() => {});
      console.log(`🔔 [CRM Sweep] Detected new Quotation #${quote.id} (${quote.reference_no}). Emitting event...`);
      crmEventBus.emit("quotation_created", quote);
    }

    // C. Check for new AMC Contracts
    const [newContracts] = await db.promise().query(
      `SELECT id, client_company, contract_title, start_date, end_date, amount_value, mobile_number
       FROM contracts
       WHERE (wa_notified IS NULL OR wa_notified = 0)
         AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
       ORDER BY id ASC LIMIT 10`
    ).catch(() => [[]]);

    for (const c of newContracts) {
      await db.promise().query("UPDATE contracts SET wa_notified = 1 WHERE id = ?", [c.id]).catch(() => {});
      console.log(`🔔 [CRM Sweep] Detected new AMC Contract #${c.id} ("${c.contract_title}"). Emitting event...`);
      crmEventBus.emit("amc_created", c);
    }

    // D. Check for new Walkin Visitors
    const [newWalkins] = await db.promise().query(
      `SELECT id, customer_name, company_name, mobile_number, location_city, purpose
       FROM walkins
       WHERE (wa_notified IS NULL OR wa_notified = 0)
         AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
       ORDER BY id ASC LIMIT 10`
    ).catch(() => [[]]);

    for (const w of newWalkins) {
      await db.promise().query("UPDATE walkins SET wa_notified = 1 WHERE id = ?", [w.id]).catch(() => {});
      console.log(`🔔 [CRM Sweep] Detected new Walkin visit #${w.id} for "${w.customer_name}". Emitting event...`);
      crmEventBus.emit("walkin_created", w);
    }

    // E. Check for new Payments
    const [newPayments] = await db.promise().query(
      `SELECT id, invoice_id, amount, payment_method, Transaction_ID
       FROM payments
       WHERE (wa_notified IS NULL OR wa_notified = 0)
         AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
       ORDER BY id ASC LIMIT 10`
    ).catch(() => [[]]);

    for (const p of newPayments) {
      await db.promise().query("UPDATE payments SET wa_notified = 1 WHERE id = ?", [p.id]).catch(() => {});
      console.log(`🔔 [CRM Sweep] Detected new Payment #${p.id} for Invoice #${p.invoice_id}. Emitting event...`);
      crmEventBus.emit("payment_received", p);
    }

  } catch (sweepErr) {
    console.warn("[CRM Sweep] Periodic sweep warning:", sweepErr.message);
  } finally {
    isSweeping = false;
  }
}

function startCrmRealtimeSweep(intervalMs = 30000) {
  if (sweepTimer) return;
  // Delay first pass slightly on boot to let DB connect
  const initTimer = setTimeout(() => runCrmRealtimeEventSweep().catch(() => {}), 5000);
  if (initTimer.unref) initTimer.unref();
  sweepTimer = setInterval(() => runCrmRealtimeEventSweep().catch(() => {}), intervalMs);
  if (sweepTimer.unref) sweepTimer.unref();
  console.log("✅ Universal CRM Database Change Sweep started (30s interval)");
}

module.exports = crmEventBus;
module.exports.startCrmRealtimeSweep = startCrmRealtimeSweep;
