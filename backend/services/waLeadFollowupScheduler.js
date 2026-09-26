"use strict";
/**
 * waLeadFollowupScheduler.js
 *
 * Fires the 'lead_followup' WhatsApp automation for every telecall/walkin/
 * field lead whose follow-up is due today and hasn't been explicitly marked
 * as not needing one.
 */
const schedule = require("node-schedule");
const db = require("../config/database");

// walkins/fields don't have a service_name column like telecalls does — they
// track the same idea under "purpose" — so alias it to keep one shared query shape.
const TABLES = [
  { name: "telecalls", serviceCol: "service_name" },
  { name: "walkins", serviceCol: "purpose" },
  { name: "fields", serviceCol: "purpose" },
];

async function runLeadFollowupCheck() {
  try {
    // Check if lead_followup automation rule is actively enabled in CRM settings
    const [rules] = await db.promise().query(
      "SELECT id FROM wa_automations WHERE trigger_type = 'lead_followup' AND is_active = 1 LIMIT 1"
    );
    if (!rules || !rules.length) {
      return; // Do not process if automation is inactive
    }

    const { triggerAutomation } = require("./waAutomationService");

    for (const { name: table, serviceCol } of TABLES) {
      try {
        // Dedupe by comparing the stored "last sent for" date against the
        // current follow-up date, not a plain boolean — so re-scheduling a
        // follow-up to a new date naturally re-arms the reminder instead of
        // being silently suppressed forever after the first send.
        // followup_required is only ever "Yes"/"No"/"Default" in this app, and
        // the app's own UI treats "Default" (the unset placeholder) as NOT
        // needing a follow-up — only an explicit "Yes" does. Match that exactly.
        const [rows] = await db.promise().query(`
          SELECT id, customer_name, company_name, mobile_number, ${serviceCol} AS service_name, staff_name
          FROM ${table}
          WHERE followup_date = CURDATE()
            AND followup_required = 'Yes'
            AND mobile_number IS NOT NULL AND mobile_number != ''
            AND (wa_followup_sent_date IS NULL OR wa_followup_sent_date != followup_date)
        `);

        if (!rows.length) continue;

        for (const lead of rows) {
          try {
            await triggerAutomation("lead_followup", {
              phone: lead.mobile_number,
              contactName: lead.customer_name || lead.company_name,
              data: {
                company: lead.company_name,
                service: lead.service_name,
              },
            });
          } catch (e) {
            console.error(`[WA Lead Followup] trigger failed for ${table}#${lead.id}:`, e.message);
          }
          await db.promise().query(`UPDATE ${table} SET wa_followup_sent_date = CURDATE() WHERE id = ?`, [lead.id]);
        }
        console.log(`[WA Lead Followup] Notified ${rows.length} ${table} lead(s) due today`);
      } catch (err) {
        console.error(`[WA Lead Followup] check error (${table}):`, err.message);
      }
    }
  } catch (err) {
    console.error("[WA Lead Followup] global check error:", err.message);
  }
}

let job = null;

function startLeadFollowupScheduler() {
  if (job) return;
  // Strictly runs daily at 9:30 AM according to schedule, never blindly on server restart or number connection.
  job = schedule.scheduleJob("30 9 * * *", runLeadFollowupCheck);
  console.log("[WA Lead Followup] Scheduler started (daily at 09:30)");
}

function stopLeadFollowupScheduler() {
  if (job) { job.cancel(); job = null; }
}

module.exports = { startLeadFollowupScheduler, stopLeadFollowupScheduler, runLeadFollowupCheck };
