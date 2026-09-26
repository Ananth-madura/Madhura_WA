"use strict";
/**
 * waPaymentDueScheduler.js
 *
 * Fires the 'payment_due' WhatsApp automation once for every invoice whose
 * due date is tomorrow and that has no payment recorded against it yet.
 *
 * ponytail: clientinvoices has no amount/total column, so "unpaid" here means
 * "zero rows in payments for this invoice_id" rather than a real balance
 * reconciliation — upgrade to a real amount-due check if/when clientinvoices
 * gains a total column.
 */
const schedule = require("node-schedule");
const db = require("../config/database");

async function runPaymentDueCheck() {
  try {
    // Check if payment_due automation rule is actively enabled in CRM settings
    const [rules] = await db.promise().query(
      "SELECT id FROM wa_automations WHERE trigger_type = 'payment_due' AND is_active = 1 LIMIT 1"
    );
    if (!rules || !rules.length) {
      return; // Do not process if automation rule is inactive
    }

    // Scalar subqueries (not a JOIN) so a duplicate client name can never
    // fan out into more than one row — and therefore more than one message —
    // per invoice.
    const [rows] = await db.promise().query(`
      SELECT ci.id, ci.client_company, ci.invoice_duedate,
        (SELECT c.name FROM clients c WHERE (c.company_name = ci.client_company OR c.name = ci.client_company)
          AND c.phone IS NOT NULL AND c.phone != '' LIMIT 1) AS name,
        (SELECT c.phone FROM clients c WHERE (c.company_name = ci.client_company OR c.name = ci.client_company)
          AND c.phone IS NOT NULL AND c.phone != '' LIMIT 1) AS phone
      FROM clientinvoices ci
      WHERE ci.invoice_duedate = DATE_ADD(CURDATE(), INTERVAL 1 DAY)
        AND (ci.wa_payment_due_sent IS NULL OR ci.wa_payment_due_sent = 0)
        AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.invoice_id = ci.id)
        AND EXISTS (SELECT 1 FROM clients c WHERE (c.company_name = ci.client_company OR c.name = ci.client_company)
          AND c.phone IS NOT NULL AND c.phone != '')
    `);

    if (!rows.length) return;

    const { triggerAutomation } = require("./waAutomationService");
    for (const inv of rows) {
      try {
        await triggerAutomation("payment_due", {
          phone: inv.phone,
          contactName: inv.name,
          data: {
            invoice_no: `INV-${inv.id}`,
            company: inv.client_company,
            due_date: inv.invoice_duedate,
          },
        });
      } catch (e) {
        console.error(`[WA Payment Due] trigger failed for invoice ${inv.id}:`, e.message);
      }
      await db.promise().query("UPDATE clientinvoices SET wa_payment_due_sent = 1 WHERE id = ?", [inv.id]);
    }
    console.log(`[WA Payment Due] Checked and notified ${rows.length} invoice(s) due tomorrow`);
  } catch (err) {
    console.error("[WA Payment Due] check error:", err.message);
  }
}

let job = null;

function startPaymentDueScheduler() {
  if (job) return;
  // Strictly runs daily at 10:00 AM on schedule, never blindly on server boot or WhatsApp connection.
  job = schedule.scheduleJob("0 10 * * *", runPaymentDueCheck);
  console.log("[WA Payment Due] Scheduler started (daily at 10:00)");
}

function stopPaymentDueScheduler() {
  if (job) { job.cancel(); job = null; }
}

module.exports = { startPaymentDueScheduler, stopPaymentDueScheduler, runPaymentDueCheck };
