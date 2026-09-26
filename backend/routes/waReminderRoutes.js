"use strict";

const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken } = require("../middleware/authMiddleware");
const waConfirmation = require("../services/waConfirmationService");
const waReminderScheduler = require("../services/waReminderScheduler");

// ── 1. Summary Statistics ──────────────────────────────────────────────────
router.get("/summary", verifyToken, async (req, res) => {
  try {
    const [[stats]] = await db.promise().query(`
      SELECT 
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) AS confirmed,
        SUM(CASE WHEN status = 'rescheduled' THEN 1 ELSE 0 END) AS rescheduled,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS paid,
        SUM(CASE WHEN status IN ('sent', 'pending') THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
      FROM wa_interactive_reminders
    `);

    const total = stats.total || 0;
    const responded = (stats.confirmed || 0) + (stats.rescheduled || 0) + (stats.cancelled || 0) + (stats.paid || 0);
    const responseRate = total > 0 ? Math.round((responded / total) * 100) : 0;

    res.json({
      total,
      confirmed: stats.confirmed || 0,
      rescheduled: stats.rescheduled || 0,
      cancelled: stats.cancelled || 0,
      paid: stats.paid || 0,
      pending: stats.pending || 0,
      failed: stats.failed || 0,
      responseRate,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 2. List Reminders & Response Logs ───────────────────────────────────────
router.get("/list", verifyToken, async (req, res) => {
  try {
    const { status, type, search, limit = 50, offset = 0 } = req.query;
    let sql = "SELECT * FROM wa_interactive_reminders WHERE 1=1";
    const params = [];

    if (status) {
      sql += " AND status = ?";
      params.push(status);
    }
    if (type) {
      sql += " AND reminder_type = ?";
      params.push(type);
    }
    if (search) {
      sql += " AND (phone LIKE ? OR contact_name LIKE ? OR title LIKE ?)";
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    sql += " ORDER BY id DESC LIMIT ? OFFSET ?";
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const [rows] = await db.promise().query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 3. Get Reminder Settings ────────────────────────────────────────────────
router.get("/settings", verifyToken, async (req, res) => {
  try {
    const [rows] = await db.promise().query("SELECT * FROM wa_reminder_settings WHERE id = 1");
    const row = rows[0] || {};
    res.json({
      appointment_reminders_enabled: row.appointment_reminders_enabled !== 0,
      appointment_reminder_hours_before: row.appointment_reminder_hours_before || 24,
      payment_due_reminders_enabled: row.payment_due_reminders_enabled !== 0,
      payment_due_days_before: row.payment_due_days_before || 1,
      lead_followup_reminders_enabled: row.lead_followup_reminders_enabled !== 0,
      amc_renewal_reminders_enabled: row.amc_renewal_reminders_enabled !== 0,
      amc_renewal_days_before: row.amc_renewal_days_before || 7,
      confirmation_auto_update_crm: row.confirmation_auto_update_crm !== 0,
      notify_staff_on_response: row.notify_staff_on_response !== 0,
      default_confirm_prompt: row.default_confirm_prompt || "",
      default_reschedule_prompt: row.default_reschedule_prompt || "",
      default_cancel_prompt: row.default_cancel_prompt || "",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 4. Save Reminder Settings ────────────────────────────────────────────────
router.put("/settings", verifyToken, async (req, res) => {
  try {
    const {
      appointment_reminders_enabled,
      appointment_reminder_hours_before,
      payment_due_reminders_enabled,
      payment_due_days_before,
      lead_followup_reminders_enabled,
      amc_renewal_reminders_enabled,
      amc_renewal_days_before,
      confirmation_auto_update_crm,
      notify_staff_on_response,
      default_confirm_prompt,
      default_reschedule_prompt,
      default_cancel_prompt,
    } = req.body;

    await db.promise().query(
      `UPDATE wa_reminder_settings SET
        appointment_reminders_enabled = ?,
        appointment_reminder_hours_before = ?,
        payment_due_reminders_enabled = ?,
        payment_due_days_before = ?,
        lead_followup_reminders_enabled = ?,
        amc_renewal_reminders_enabled = ?,
        amc_renewal_days_before = ?,
        confirmation_auto_update_crm = ?,
        notify_staff_on_response = ?,
        default_confirm_prompt = ?,
        default_reschedule_prompt = ?,
        default_cancel_prompt = ?
       WHERE id = 1`,
      [
        appointment_reminders_enabled ? 1 : 0,
        parseInt(appointment_reminder_hours_before, 10) || 24,
        payment_due_reminders_enabled ? 1 : 0,
        parseInt(payment_due_days_before, 10) || 1,
        lead_followup_reminders_enabled ? 1 : 0,
        amc_renewal_reminders_enabled ? 1 : 0,
        parseInt(amc_renewal_days_before, 10) || 7,
        confirmation_auto_update_crm ? 1 : 0,
        notify_staff_on_response ? 1 : 0,
        default_confirm_prompt || null,
        default_reschedule_prompt || null,
        default_cancel_prompt || null,
      ]
    );

    res.json({ success: true, message: "Reminder & confirmation settings saved successfully!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 5. Instant Interactive Send ─────────────────────────────────────────────
router.post("/send-now", verifyToken, async (req, res) => {
  try {
    const { phone, contact_name, reminder_type, title, message_text, options, ref_table, ref_id, flow_id, template_id } = req.body;
    if (!phone) return res.status(400).json({ error: "Phone number is required" });

    const result = await waConfirmation.sendInteractiveReminder({
      phone,
      contactName: contact_name || "Customer",
      reminderType: reminder_type || "appointment_reminder",
      title: title || "Interactive Reminder",
      messageText: message_text,
      options,
      refTable: ref_table || null,
      refId: ref_id || null,
      flow_id: flow_id || null,
      template_id: template_id || null,
    });

    res.json({ success: true, message: "Interactive reminder sent successfully!", result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 6. Trigger Scheduler Check on Demand ────────────────────────────────────
router.post("/trigger-check", verifyToken, async (req, res) => {
  try {
    const { scheduler_type = "all" } = req.body;
    if (scheduler_type === "appointment" || scheduler_type === "all") {
      await waReminderScheduler.runAppointmentReminderCheck();
    }
    if (scheduler_type === "payment" || scheduler_type === "all") {
      await waReminderScheduler.runPaymentDueInteractiveCheck();
    }
    if (scheduler_type === "quotation" || scheduler_type === "all") {
      await waReminderScheduler.runQuotationFollowupCheck();
    }
    if (scheduler_type === "amc" || scheduler_type === "all") {
      await waReminderScheduler.runAmcRenewalCheck();
    }

    res.json({ success: true, message: "Automated reminder check executed across all CRM pipelines!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 7. Resend Reminder ──────────────────────────────────────────────────────
router.post("/:id/resend", verifyToken, async (req, res) => {
  try {
    const [rows] = await db.promise().query("SELECT * FROM wa_interactive_reminders WHERE id = ?", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Reminder not found" });

    const rem = rows[0];
    let opts = [];
    try {
      opts = typeof rem.options_payload === "string" ? JSON.parse(rem.options_payload) : rem.options_payload;
    } catch (_) {}

    await waConfirmation.sendInteractiveReminder({
      phone: rem.phone,
      contactName: rem.contact_name,
      reminderType: rem.reminder_type,
      title: rem.title,
      messageText: rem.message_text,
      options: opts,
      refTable: rem.reference_table,
      refId: rem.reference_id,
      staffName: rem.assigned_staff_name,
    });

    res.json({ success: true, message: "Reminder resent successfully!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 8. Delete Reminder Log ──────────────────────────────────────────────────
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    await db.promise().query("DELETE FROM wa_interactive_reminders WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 9. Pending Automated CRM Queue ──────────────────────────────────────────
router.get("/pending-queue", verifyToken, async (req, res) => {
  try {
    const queue = [];

    // A. Telecall Appointments / Followups
    const [telecalls] = await db.promise().query(`
      SELECT t.id, t.customer_name, t.mobile_number, t.service_name, t.location_city, t.followup_date, t.followup_notes,
             t.call_outcome
      FROM telecalls t
      WHERE t.mobile_number IS NOT NULL AND t.mobile_number != ''
        AND (t.followup_date BETWEEN DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND DATE_ADD(CURDATE(), INTERVAL 3 DAY)
             OR t.followup_required = 'Yes')
      ORDER BY t.followup_date ASC LIMIT 30
    `).catch(() => [[]]);

    for (const t of telecalls) {
      const dateStr = t.followup_date ? new Date(t.followup_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Tomorrow";
      const cleanNum = (t.mobile_number || "").replace(/\D/g, "");
      if (cleanNum.length >= 7) {
        queue.push({
          queue_id: `telecall_${t.id}`,
          ref_table: "telecalls",
          ref_id: t.id,
          reminder_type: "appointment_reminder",
          customer_name: t.customer_name || "Customer",
          phone: cleanNum,
          company: t.customer_name || "",
          city: t.location_city || "",
          context_title: `Visit: ${t.service_name || "Service Consultation"}`,
          event_date: t.followup_date,
          due_label: `Follow-up ${dateStr}`,
          amount: "",
          assigned_staff: "",
          variables: {
            name: t.customer_name || "Customer",
            first_name: (t.customer_name || "Customer").split(" ")[0],
            phone: cleanNum,
            company: t.customer_name || "",
            city: t.location_city || "",
            service_name: t.service_name || "Service Consultation",
            engineer_name: "Technical Executive",
            date: dateStr,
            time: "10:30 AM",
          },
          suggested_text: `Hi ${t.customer_name || "Customer"}, reminder for your upcoming ${t.service_name || "service visit"} scheduled on ${dateStr}. Please confirm your availability:`,
          options: [
            { id: "btn_confirm", label: "✅ Confirm Visit", action: "confirm_appointment" },
            { id: "btn_reschedule", label: "🔄 Reschedule", action: "reschedule_appointment" },
            { id: "btn_cancel", label: "❌ Cancel", action: "cancel_appointment" },
          ],
        });
      }
    }

    // B. Scheduled Services
    const [services] = await db.promise().query(`
      SELECT s.id, s.client, s.material, s.date, s.engineer_name, s.issues,
             (SELECT c.phone FROM clients c WHERE c.name = s.client OR c.company_name = s.client LIMIT 1) AS phone,
             (SELECT c.city FROM clients c WHERE c.name = s.client OR c.company_name = s.client LIMIT 1) AS city
      FROM services s
      WHERE s.date BETWEEN DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND DATE_ADD(CURDATE(), INTERVAL 3 DAY)
      ORDER BY s.date ASC LIMIT 20
    `).catch(() => [[]]);

    for (const s of services) {
      const dateStr = s.date ? new Date(s.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Tomorrow";
      const cleanNum = (s.phone || "").replace(/\D/g, "");
      if (cleanNum.length >= 7) {
        queue.push({
          queue_id: `service_${s.id}`,
          ref_table: "services",
          ref_id: s.id,
          reminder_type: "appointment_reminder",
          customer_name: s.client || "Valued Client",
          phone: cleanNum,
          company: s.client || "",
          city: s.city || "",
          context_title: `Service: ${s.material || "Maintenance"}`,
          event_date: s.date,
          due_label: `Service Visit ${dateStr}`,
          amount: "",
          assigned_staff: s.engineer_name || "Service Team",
          variables: {
            name: s.client || "Customer",
            first_name: (s.client || "Customer").split(" ")[0],
            phone: cleanNum,
            company: s.client || "",
            city: s.city || "",
            service_name: s.material || "Equipment Maintenance",
            engineer_name: s.engineer_name || "Technical Team",
            date: dateStr,
            time: "11:00 AM",
          },
          suggested_text: `Hi ${s.client}, reminder for your scheduled maintenance service (${s.material || "Inspection"}) on ${dateStr}. Assigned Engineer: ${s.engineer_name || "Technical Team"}. Please confirm your visit:`,
          options: [
            { id: "btn_confirm", label: "✅ Confirm Visit", action: "confirm_appointment" },
            { id: "btn_reschedule", label: "🔄 Reschedule", action: "reschedule_appointment" },
            { id: "btn_cancel", label: "❌ Cancel", action: "cancel_appointment" },
          ],
        });
      }
    }

    // C. Pending Quotations (> 2 days)
    const [quotes] = await db.promise().query(`
      SELECT q.id, q.reference_no, q.grand_total, q.quotation_date, q.client_company,
             COALESCE(c.customer_name, q.client_company, 'Customer') AS customer_name,
             COALESCE(c.mobile_number, (SELECT phone FROM clients cl WHERE (cl.company_name = q.client_company OR cl.name = q.client_company) AND cl.phone IS NOT NULL AND cl.phone != '' LIMIT 1)) AS phone
      FROM quotations q
      LEFT JOIN customers c ON c.id = q.customer_id
      WHERE (q.status = 'Pending' OR q.status = 'Draft' OR q.status IS NULL OR q.status = '')
        AND q.quotation_date <= DATE_SUB(CURDATE(), INTERVAL 1 DAY)
      ORDER BY q.id DESC LIMIT 20
    `).catch(() => [[]]);

    for (const q of quotes) {
      const cleanNum = (q.phone || "").replace(/\D/g, "");
      const amtStr = q.grand_total ? `₹${parseFloat(q.grand_total).toLocaleString("en-IN")}` : "";
      if (cleanNum.length >= 7) {
        queue.push({
          queue_id: `quotation_${q.id}`,
          ref_table: "quotations",
          ref_id: q.id,
          reminder_type: "quotation_followup",
          customer_name: q.customer_name || "Customer",
          phone: cleanNum,
          company: q.client_company || "",
          city: "",
          context_title: `Proposal: ${q.reference_no || `QUO-${q.id}`}`,
          event_date: q.quotation_date,
          due_label: `Sent ${new Date(q.quotation_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`,
          amount: amtStr,
          assigned_staff: "",
          variables: {
            name: q.customer_name || "Customer",
            first_name: (q.customer_name || "Customer").split(" ")[0],
            phone: cleanNum,
            company: q.client_company || "",
            quote_no: q.reference_no || `QUO-${q.id}`,
            amount: amtStr,
            service_name: "Proposal",
          },
          suggested_text: `Hello ${q.customer_name}, following up on quotation proposal *${q.reference_no || `QUO-${q.id}`}* (${amtStr}) sent recently. Would you like to approve and proceed?`,
          options: [
            { id: "btn_approve_quote", label: "👍 Approve & Proceed", action: "approve_quotation" },
            { id: "btn_modify_quote", label: "💬 Need Changes", action: "request_callback" },
            { id: "btn_reject_quote", label: "❌ Not Interested", action: "reject_quotation" },
          ],
        });
      }
    }

    // D. AMC Expiring Contracts
    const [contracts] = await db.promise().query(`
      SELECT c.id, c.contract_title, c.client_company, c.mobile_number, c.end_date
      FROM contracts c
      WHERE c.end_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
        AND c.mobile_number IS NOT NULL AND c.mobile_number != ''
      ORDER BY c.end_date ASC LIMIT 15
    `).catch(() => [[]]);

    for (const c of contracts) {
      const cleanNum = (c.mobile_number || "").replace(/\D/g, "");
      const expStr = c.end_date ? new Date(c.end_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Soon";
      if (cleanNum.length >= 7) {
        queue.push({
          queue_id: `contract_${c.id}`,
          ref_table: "contracts",
          ref_id: c.id,
          reminder_type: "amc_renewal",
          customer_name: c.client_company || "Valued Client",
          phone: cleanNum,
          company: c.client_company || "",
          city: "",
          context_title: `AMC: ${c.contract_title || "Maintenance Agreement"}`,
          event_date: c.end_date,
          due_label: `Expires ${expStr}`,
          amount: "",
          assigned_staff: "",
          variables: {
            name: c.client_company || "Valued Client",
            first_name: (c.client_company || "Client").split(" ")[0],
            phone: cleanNum,
            company: c.client_company || "",
            contract_title: c.contract_title || "Maintenance Agreement",
            expiry_date: expStr,
          },
          suggested_text: `Dear ${c.client_company || "Valued Client"}, your Annual Maintenance Contract (AMC) *${c.contract_title || "Agreement"}* is expiring on ${expStr}. Please confirm your renewal preference:`,
          options: [
            { id: "btn_renew_amc", label: "🛡️ Renew AMC", action: "renew_amc" },
            { id: "btn_call_amc", label: "📞 Speak to Engineer", action: "request_callback" },
          ],
        });
      }
    }

    // Attach already_sent status for each queue item
    if (queue.length > 0) {
      const [existingLogs] = await db.promise().query(`
        SELECT reference_table, reference_id, status, sent_at, id
        FROM wa_interactive_reminders
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      `).catch(() => [[]]);

      const logMap = new Map();
      existingLogs.forEach((l) => {
        if (l.reference_table && l.reference_id) {
          logMap.set(`${l.reference_table}_${l.reference_id}`, l);
        }
      });

      queue.forEach((q) => {
        const match = logMap.get(`${q.ref_table}_${q.ref_id}`);
        if (match) {
          q.already_sent = true;
          q.last_status = match.status;
          q.last_sent_at = match.sent_at;
          q.last_reminder_id = match.id;
        } else {
          q.already_sent = false;
        }
      });
    }

    res.json({ success: true, count: queue.length, items: queue });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 10. Bulk Batch Dispatch Reminders ───────────────────────────────────────
router.post("/bulk-send", verifyToken, async (req, res) => {
  try {
    const { items = [] } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Items array is required" });
    }

    let successCount = 0;
    const errors = [];

    for (const item of items) {
      try {
        await waConfirmation.sendInteractiveReminder({
          phone: item.phone,
          contactName: item.customer_name || item.contact_name || "Customer",
          reminderType: item.reminder_type || "appointment_reminder",
          title: item.context_title || item.title || "Interactive Reminder",
          messageText: item.suggested_text || item.message_text,
          options: item.options,
          refTable: item.ref_table || null,
          refId: item.ref_id || null,
          staffName: item.assigned_staff || null,
        });
        successCount++;
      } catch (e) {
        errors.push({ phone: item.phone, error: e.message });
      }
    }

    res.json({
      success: true,
      message: `Dispatched ${successCount} interactive reminder(s) successfully!`,
      sentCount: successCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 11. Test Simulation: Customer Click / Reply ─────────────────────────────
router.post("/simulate-reply", verifyToken, async (req, res) => {
  try {
    const { reminderId, action, text } = req.body;
    if (!reminderId) return res.status(400).json({ error: "reminderId is required" });

    const [rows] = await db.promise().query("SELECT * FROM wa_interactive_reminders WHERE id = ?", [reminderId]);
    if (!rows.length) return res.status(404).json({ error: "Reminder record not found" });

    const rem = rows[0];
    const replyText = text || (action ? action.replace(/_/g, " ") : "Confirmed");

    const handled = await waConfirmation.handleInboundConfirmation(
      rem.phone,
      replyText,
      action || null
    );

    // Fetch updated record
    const [updated] = await db.promise().query("SELECT * FROM wa_interactive_reminders WHERE id = ?", [reminderId]);

    res.json({
      success: true,
      handled,
      message: `Simulated customer action "${replyText}" processed and CRM updated!`,
      reminder: updated[0],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 11b. Manually Trigger All Interactive Schedulers Now ────────────────────
router.post("/run-schedulers-now", verifyToken, async (req, res) => {
  try {
    const results = {
      appointments: "triggered",
      paymentDue: "triggered",
      quotationFollowup: "triggered",
      amcRenewal: "triggered",
    };

    // Run all 4 checks asynchronously
    waReminderScheduler.runAppointmentReminderCheck().catch((e) => console.warn("[Manual Check] Appointments error:", e.message));
    waReminderScheduler.runPaymentDueInteractiveCheck().catch((e) => console.warn("[Manual Check] Payments error:", e.message));
    waReminderScheduler.runQuotationFollowupCheck().catch((e) => console.warn("[Manual Check] Quotations error:", e.message));
    waReminderScheduler.runAmcRenewalCheck().catch((e) => console.warn("[Manual Check] AMC error:", e.message));

    res.json({
      success: true,
      message: "All 4 automated interactive reminder checks (Appointments, Payments, Quotations, AMC) triggered successfully!",
      results,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 12. Search CRM Contacts for Quick Auto-Fill ─────────────────────────────
router.get("/search-crm-contacts", verifyToken, async (req, res) => {
  try {
    const query = (req.query.q || "").trim();
    if (!query || query.length < 2) return res.json([]);

    const term = `%${query}%`;
    const results = [];
    const seenPhones = new Set();

    // Clients
    const [clients] = await db.promise().query(
      `SELECT id, name, company_name, phone, city FROM clients 
       WHERE (name LIKE ? OR company_name LIKE ? OR phone LIKE ?) AND phone IS NOT NULL AND phone != '' LIMIT 10`,
      [term, term, term]
    ).catch(() => [[]]);

    for (const c of clients) {
      const clean = (c.phone || "").replace(/\D/g, "");
      if (clean && !seenPhones.has(clean)) {
        seenPhones.add(clean);
        results.push({
          source: "client",
          id: c.id,
          name: c.name || c.company_name,
          company: c.company_name || c.name,
          phone: clean,
          city: c.city || "",
        });
      }
    }

    // Telecalls
    const [telecalls] = await db.promise().query(
      `SELECT id, customer_name, mobile_number, service_name, location_city FROM telecalls 
       WHERE (customer_name LIKE ? OR mobile_number LIKE ? OR service_name LIKE ?) AND mobile_number IS NOT NULL AND mobile_number != '' LIMIT 10`,
      [term, term, term]
    ).catch(() => [[]]);

    for (const t of telecalls) {
      const clean = (t.mobile_number || "").replace(/\D/g, "");
      if (clean && !seenPhones.has(clean)) {
        seenPhones.add(clean);
        results.push({
          source: "telecall",
          id: t.id,
          name: t.customer_name,
          company: "",
          phone: clean,
          city: t.location_city || "",
          service: t.service_name || "",
        });
      }
    }

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 13. Cadence Rules Config (Multi-Stage Automations) ───────────────────────
const DEFAULT_CADENCE_RULES = [
  {
    category: "appointment_reminder",
    label: "📅 Service & Appointment Visits",
    enabled: true,
    stages: [
      {
        id: "app_stage_1",
        name: "Stage 1: Pre-Visit Confirmation Gateway",
        trigger: "24_hours_before",
        triggerLabel: "24 Hours Before Appointment",
        time: "09:00",
        persona: "professional",
        template: "Hi {name}, reminder for your upcoming {service_name} visit scheduled with our technician {engineer_name} on {date}. Please confirm your availability:",
        options: [
          { id: "btn_confirm", label: "✅ Confirm Visit", action: "confirm_appointment" },
          { id: "btn_reschedule", label: "🔄 Reschedule", action: "reschedule_appointment" },
          { id: "btn_cancel", label: "❌ Cancel", action: "cancel_appointment" },
        ],
      },
      {
        id: "app_stage_2",
        name: "Stage 2: Arrival Alert & Site Check",
        trigger: "2_hours_before",
        triggerLabel: "2 Hours Before Arrival",
        time: "11:00",
        persona: "urgent",
        template: "Dear {name}, our technician {engineer_name} is arriving in approximately 2 hours for your {service_name}. Please ensure site access:",
        options: [
          { id: "btn_ready", label: "👍 We are Ready", action: "confirm_appointment" },
          { id: "btn_call_eng", label: "📞 Call Technician", action: "request_callback" },
        ],
      },
    ],
  },
  {
    category: "payment_due",
    label: "💰 Invoice Payment Due & Collections",
    enabled: true,
    stages: [
      {
        id: "pay_stage_1",
        name: "Stage 1: Early Courtesy Notice",
        trigger: "3_days_before",
        triggerLabel: "3 Days Before Due Date",
        time: "10:00",
        persona: "friendly",
        template: "Hello {name}, gentle courtesy reminder from our accounts team. Invoice {invoice_no} for {amount} is due on {due_date}. Thank you for your partnership!",
        options: [
          { id: "btn_paid", label: "💳 Already Paid", action: "confirm_payment" },
          { id: "btn_invoice", label: "📄 Send Invoice PDF", action: "send_invoice_copy" },
        ],
      },
      {
        id: "pay_stage_2",
        name: "Stage 2: Due Tomorrow Action Gate",
        trigger: "1_day_before",
        triggerLabel: "1 Day Before Due Date",
        time: "10:00",
        persona: "professional",
        template: "Hi {name}, reminder that payment for invoice {invoice_no} ({amount}) is due tomorrow, {due_date}. Please choose an option below:",
        options: [
          { id: "btn_paid", label: "💳 Already Paid", action: "confirm_payment" },
          { id: "btn_invoice", label: "📄 Send Invoice", action: "send_invoice_copy" },
          { id: "btn_call_acc", label: "📞 Speak to Accounts", action: "request_callback" },
        ],
      },
      {
        id: "pay_stage_3",
        name: "Stage 3: Overdue Escalation",
        trigger: "2_days_overdue",
        triggerLabel: "2 Days Overdue",
        time: "10:30",
        persona: "urgent",
        template: "Attention {name}: Payment for invoice {invoice_no} ({amount}) is now overdue. Please settle immediately or contact us to avoid service suspension:",
        options: [
          { id: "btn_paid", label: "💳 Paid Just Now", action: "confirm_payment" },
          { id: "btn_call_acc", label: "📞 Call Accounts Now", action: "request_callback" },
        ],
      },
    ],
  },
  {
    category: "quotation_followup",
    label: "💼 Quotation & Proposal Follow-up",
    enabled: true,
    stages: [
      {
        id: "quo_stage_1",
        name: "Stage 1: Initial Review & Approval",
        trigger: "2_days_after",
        triggerLabel: "2 Days After Proposal",
        time: "11:30",
        persona: "friendly",
        template: "Hello {name}, hope you are doing well! Following up on quotation proposal *{quote_no}* for {service_name} ({amount}). Would you like to approve and proceed?",
        options: [
          { id: "btn_approve_quote", label: "👍 Approve & Proceed", action: "approve_quotation" },
          { id: "btn_modify_quote", label: "💬 Need Changes", action: "request_callback" },
          { id: "btn_reject_quote", label: "❌ Not Interested", action: "reject_quotation" },
        ],
      },
      {
        id: "quo_stage_2",
        name: "Stage 2: Consultation & Terms Discussion",
        trigger: "5_days_after",
        triggerLabel: "5 Days After Proposal",
        time: "14:00",
        persona: "vip",
        template: "Dear {name}, regarding proposal {quote_no} for {company}. We would be delighted to schedule a brief consultation with our senior specialist or discuss custom terms:",
        options: [
          { id: "btn_approve_quote", label: "👍 Approve Proposal", action: "approve_quotation" },
          { id: "btn_call", label: "📞 Request Call", action: "request_callback" },
        ],
      },
    ],
  },
  {
    category: "amc_renewal",
    label: "🛡️ AMC Contract Renewal",
    enabled: true,
    stages: [
      {
        id: "amc_stage_1",
        name: "Stage 1: 30-Day Early Renewal Notice",
        trigger: "30_days_before",
        triggerLabel: "30 Days Before Expiry",
        time: "12:00",
        persona: "vip",
        template: "Dear {name}, your Annual Maintenance Contract (AMC) for *{contract_title}* expires on {expiry_date}. Renew early to lock in current pricing with zero service disruption:",
        options: [
          { id: "btn_renew_amc", label: "🛡️ Renew AMC", action: "renew_amc" },
          { id: "btn_call_amc", label: "📞 Speak to Engineer", action: "request_callback" },
        ],
      },
      {
        id: "amc_stage_2",
        name: "Stage 2: 7-Day Continuity Warning",
        trigger: "7_days_before",
        triggerLabel: "7 Days Before Expiry",
        time: "12:00",
        persona: "urgent",
        template: "Urgent: Your AMC contract *{contract_title}* expires in 7 days on {expiry_date}. Please confirm renewal to maintain ongoing warranty and priority technician dispatch:",
        options: [
          { id: "btn_renew_amc", label: "🛡️ Confirm Renewal", action: "renew_amc" },
          { id: "btn_call_amc", label: "📞 Call Support", action: "request_callback" },
        ],
      },
    ],
  },
];

router.get("/cadence-rules", verifyToken, async (req, res) => {
  try {
    const [rows] = await db.promise().query("SELECT cadence_rules FROM wa_reminder_settings WHERE id = 1");
    let rules = DEFAULT_CADENCE_RULES;
    if (rows.length && rows[0].cadence_rules) {
      try {
        const parsed = typeof rows[0].cadence_rules === "string" ? JSON.parse(rows[0].cadence_rules) : rows[0].cadence_rules;
        if (Array.isArray(parsed) && parsed.length > 0) rules = parsed;
      } catch (_) {}
    }
    res.json(rules);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/cadence-rules", verifyToken, async (req, res) => {
  try {
    const rules = req.body;
    if (!Array.isArray(rules)) return res.status(400).json({ error: "Rules must be an array" });

    await db.promise().query("UPDATE wa_reminder_settings SET cadence_rules = ? WHERE id = 1", [JSON.stringify(rules)]);
    res.json({ success: true, message: "Cadence automation rules saved successfully!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
