"use strict";
/**
 * waReminderScheduler.js
 *
 * Master Automated Schedulers for Interactive WhatsApp Reminders:
 * 1. Appointment / Site Visit Reminders (Confirm / Reschedule / Cancel)
 * 2. Payment Due Reminders (Paid / Invoice / Accounts)
 * 3. Quotation Follow-up Reminders (Approve / Customize / Reject)
 * 4. AMC Maintenance Contract Renewal Reminders (Renew / Support)
 */

const schedule = require("node-schedule");
const db = require("../config/database");
const waConfirmation = require("./waConfirmationService");

function queryAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

/**
 * 1. Appointment / Service Visit Check
 */
async function runAppointmentReminderCheck() {
  try {
    const [settingsRows] = await db.promise().query("SELECT * FROM wa_reminder_settings WHERE id = 1");
    const settings = settingsRows[0] || {};
    if (settings.appointment_reminders_enabled === 0) return;

    // Check telecalls with visit/appointment tomorrow
    const [telecallRows] = await db.promise().query(`
      SELECT t.id, t.customer_name, t.mobile_number, t.service_name, t.location_city, t.followup_date
      FROM telecalls t
      WHERE t.followup_date = DATE_ADD(CURDATE(), INTERVAL 1 DAY)
        AND t.followup_required = 'Yes'
        AND t.mobile_number IS NOT NULL AND t.mobile_number != ''
        AND NOT EXISTS (
          SELECT 1 FROM wa_interactive_reminders r 
          WHERE r.reference_table = 'telecalls' AND r.reference_id = t.id 
            AND r.scheduled_for >= CURDATE()
        )
    `);

    for (const t of telecallRows) {
      const msg = `Hi ${t.customer_name || "Customer"}, reminder for your scheduled service appointment (${t.service_name || "AMC & Technical Support"}) tomorrow on ${new Date(t.followup_date).toLocaleDateString("en-IN")}. Please confirm your availability:`;
      await waConfirmation.sendInteractiveReminder({
        phone: t.mobile_number,
        contactName: t.customer_name,
        reminderType: "appointment_reminder",
        title: `Appointment Reminder: ${t.service_name || "Service Visit"}`,
        messageText: msg,
        refTable: "telecalls",
        refId: t.id,
      }).catch((e) => console.warn(`[WA Appointment Reminder] Failed for telecall #${t.id}:`, e.message));
    }

    // Check services with service date tomorrow
    const [serviceRows] = await db.promise().query(`
      SELECT s.id, s.client, s.material, s.date, s.engineer_name,
        (SELECT c.phone FROM clients c WHERE c.name = s.client OR c.company_name = s.client LIMIT 1) AS phone
      FROM services s
      WHERE s.date = DATE_ADD(CURDATE(), INTERVAL 1 DAY)
        AND NOT EXISTS (
          SELECT 1 FROM wa_interactive_reminders r 
          WHERE r.reference_table = 'services' AND r.reference_id = s.id 
            AND r.scheduled_for >= CURDATE()
        )
      HAVING phone IS NOT NULL AND phone != ''
    `).catch(() => [[]]);

    for (const s of serviceRows) {
      const msg = `Hi ${s.client}, reminder for your scheduled maintenance service (${s.material || "Equipment Inspection"}) tomorrow. Assigned Engineer: ${s.engineer_name || "Technical Team"}. Please confirm your visit:`;
      await waConfirmation.sendInteractiveReminder({
        phone: s.phone,
        contactName: s.client,
        reminderType: "appointment_reminder",
        title: `Service Visit Reminder: ${s.material || "Maintenance"}`,
        messageText: msg,
        refTable: "services",
        refId: s.id,
        staffName: s.engineer_name,
      }).catch((e) => console.warn(`[WA Service Reminder] Failed for service #${s.id}:`, e.message));
    }

    console.log(`[WA Appointment Scheduler] Dispatched interactive appointment reminders for tomorrow.`);
  } catch (err) {
    console.error("[WA Appointment Scheduler] Error:", err.message);
  }
}

/**
 * 2. Payment Due Interactive Check
 */
async function runPaymentDueInteractiveCheck() {
  try {
    const [settingsRows] = await db.promise().query("SELECT * FROM wa_reminder_settings WHERE id = 1");
    const settings = settingsRows[0] || {};
    if (settings.payment_due_reminders_enabled === 0) return;

    const [rows] = await db.promise().query(`
      SELECT ci.id, ci.client_company, ci.invoice_duedate,
        (SELECT c.name FROM clients c WHERE (c.company_name = ci.client_company OR c.name = ci.client_company)
          AND c.phone IS NOT NULL AND c.phone != '' LIMIT 1) AS name,
        (SELECT c.phone FROM clients c WHERE (c.company_name = ci.client_company OR c.name = ci.client_company)
          AND c.phone IS NOT NULL AND c.phone != '' LIMIT 1) AS phone
      FROM clientinvoices ci
      WHERE ci.invoice_duedate = DATE_ADD(CURDATE(), INTERVAL 1 DAY)
        AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.invoice_id = ci.id)
        AND NOT EXISTS (
          SELECT 1 FROM wa_interactive_reminders r 
          WHERE r.reference_table = 'clientinvoices' AND r.reference_id = ci.id 
            AND r.scheduled_for >= CURDATE()
        )
      HAVING phone IS NOT NULL AND phone != ''
    `);

    for (const inv of rows) {
      const msg = `Hi ${inv.name || inv.client_company}, reminder that invoice *INV-${inv.id}* is due for payment tomorrow (${new Date(inv.invoice_duedate).toLocaleDateString("en-IN")}). Please choose an option below:`;
      await waConfirmation.sendInteractiveReminder({
        phone: inv.phone,
        contactName: inv.name || inv.client_company,
        reminderType: "payment_due",
        title: `Payment Due Reminder: INV-${inv.id}`,
        messageText: msg,
        refTable: "clientinvoices",
        refId: inv.id,
      }).catch((e) => console.warn(`[WA Payment Due] Failed for invoice #${inv.id}:`, e.message));
    }

    console.log(`[WA Payment Due Scheduler] Dispatched interactive payment reminders for ${rows.length} invoice(s).`);
  } catch (err) {
    console.error("[WA Payment Due Scheduler] Error:", err.message);
  }
}

/**
 * 3. Quotation Followup Check
 */
async function runQuotationFollowupCheck() {
  try {
    const [settingsRows] = await db.promise().query("SELECT * FROM wa_reminder_settings WHERE id = 1");
    const settings = settingsRows[0] || {};
    if (settings.lead_followup_reminders_enabled === 0) return;

    // Check quotations created 3 days ago with status 'Pending' or NULL
    const [quotes] = await db.promise().query(`
      SELECT q.id, q.reference_no, q.grand_total, q.customer_id,
        COALESCE(c.customer_name, q.client_company, 'Customer') AS customer_name,
        COALESCE(c.mobile_number, (SELECT phone FROM clients cl WHERE (cl.company_name = q.client_company OR cl.name = q.client_company) AND cl.phone IS NOT NULL AND cl.phone != '' LIMIT 1)) AS mobile_number,
        c.email
      FROM quotations q
      LEFT JOIN customers c ON c.id = q.customer_id
      WHERE (q.status = 'Pending' OR q.status IS NULL OR q.status = '')
        AND q.quotation_date = DATE_SUB(CURDATE(), INTERVAL 3 DAY)
        AND NOT EXISTS (
          SELECT 1 FROM wa_interactive_reminders r 
          WHERE r.reference_table = 'quotations' AND r.reference_id = q.id
        )
      HAVING mobile_number IS NOT NULL AND mobile_number != ''
    `).catch(() => [[]]);

    for (const q of quotes) {
      const amount = q.grand_total ? `₹${parseFloat(q.grand_total).toLocaleString("en-IN")}` : "";
      const msg = `Hello ${q.customer_name}, following up on quotation proposal *${q.reference_no || `QUO-${q.id}`}* (${amount}) sent recently. Would you like to approve and proceed?`;
      await waConfirmation.sendInteractiveReminder({
        phone: q.mobile_number,
        contactName: q.customer_name,
        reminderType: "quotation_followup",
        title: `Quotation Followup: ${q.reference_no || `QUO-${q.id}`}`,
        messageText: msg,
        refTable: "quotations",
        refId: q.id,
      }).catch((e) => console.warn(`[WA Quotation Followup] Failed for quote #${q.id}:`, e.message));
    }
  } catch (err) {
    console.error("[WA Quotation Followup] Error:", err.message);
  }
}

/**
 * 4. AMC Contract Expiry & Renewal Check
 */
async function runAmcRenewalCheck() {
  try {
    const [settingsRows] = await db.promise().query("SELECT * FROM wa_reminder_settings WHERE id = 1");
    const settings = settingsRows[0] || {};
    if (settings.amc_renewal_reminders_enabled === 0) return;

    const daysBefore = settings.amc_renewal_days_before || 7;
    const [contracts] = await db.promise().query(`
      SELECT c.id, c.contract_title, c.client_company, c.mobile_number, c.end_date
      FROM contracts c
      WHERE c.end_date = DATE_ADD(CURDATE(), INTERVAL ? DAY)
        AND c.mobile_number IS NOT NULL AND c.mobile_number != ''
        AND NOT EXISTS (
          SELECT 1 FROM wa_interactive_reminders r 
          WHERE r.reference_table = 'contracts' AND r.reference_id = c.id
        )
    `, [daysBefore]).catch(() => [[]]);

    for (const c of contracts) {
      const msg = `Dear ${c.client_company || "Valued Client"}, your Annual Maintenance Contract (AMC) *${c.contract_title || "Maintenance Agreement"}* will expire in ${daysBefore} days on ${new Date(c.end_date).toLocaleDateString("en-IN")}. Please confirm your renewal preference:`;
      await waConfirmation.sendInteractiveReminder({
        phone: c.mobile_number,
        contactName: c.client_company,
        reminderType: "amc_renewal",
        title: `AMC Renewal Reminder: ${c.contract_title || "Contract"}`,
        messageText: msg,
        refTable: "contracts",
        refId: c.id,
      }).catch((e) => console.warn(`[WA AMC Renewal] Failed for contract #${c.id}:`, e.message));
    }
  } catch (err) {
    console.error("[WA AMC Renewal Scheduler] Error:", err.message);
  }
}

let appointmentJob = null;
let paymentJob = null;
let quoteJob = null;
let amcJob = null;

function startInteractiveReminderSchedulers() {
  // Appointment reminders daily at 09:00 AM
  if (!appointmentJob) {
    appointmentJob = schedule.scheduleJob("0 9 * * *", runAppointmentReminderCheck);
  }
  // Payment Due reminders daily at 10:00 AM
  if (!paymentJob) {
    paymentJob = schedule.scheduleJob("0 10 * * *", runPaymentDueInteractiveCheck);
  }
  // Quotation followups daily at 11:30 AM
  if (!quoteJob) {
    quoteJob = schedule.scheduleJob("30 11 * * *", runQuotationFollowupCheck);
  }
  // AMC renewal reminders daily at 12:00 PM
  if (!amcJob) {
    amcJob = schedule.scheduleJob("0 12 * * *", runAmcRenewalCheck);
  }

  console.log("✅ [WA Reminder Schedulers] Initialized all 4 interactive confirmation schedulers (strict cron schedule)");
}

module.exports = {
  startInteractiveReminderSchedulers,
  runAppointmentReminderCheck,
  runPaymentDueInteractiveCheck,
  runQuotationFollowupCheck,
  runAmcRenewalCheck,
};
