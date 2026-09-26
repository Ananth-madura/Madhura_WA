const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken: auth } = require("../middleware/authMiddleware");

router.get("/", auth, async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      "SELECT * FROM wa_templates ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", auth, async (req, res) => {
  try {
    const { name, category, language, header_type, header_value, body, footer, button_type, buttons } = req.body;
    if (!name || !body) return res.status(400).json({ error: "name and body required" });
    const [result] = await db.promise().query(
      `INSERT INTO wa_templates (name, category, language, header_type, header_value, body, footer, button_type, buttons, created_by) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [name, category || "MARKETING", language || "en", header_type || null, header_value || null, body, footer || null, button_type || null, buttons ? JSON.stringify(buttons) : null, req.user?.id || null]
    );
    const [row] = await db.promise().query("SELECT * FROM wa_templates WHERE id = ?", [result.insertId]);
    res.status(201).json(row[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", auth, async (req, res) => {
  try {
    const [rows] = await db.promise().query("SELECT * FROM wa_templates WHERE id = ?", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Template not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/:id", auth, async (req, res) => {
  try {
    const { name, category, language, header_type, header_value, body, footer, button_type, buttons } = req.body;
    await db.promise().query(
      `UPDATE wa_templates SET name=?, category=?, language=?, header_type=?, header_value=?, body=?, footer=?, button_type=?, buttons=? WHERE id=?`,
      [name, category, language, header_type, header_value, body, footer, button_type, buttons ? JSON.stringify(buttons) : null, req.params.id]
    );
    const [rows] = await db.promise().query("SELECT * FROM wa_templates WHERE id = ?", [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    await db.promise().query("DELETE FROM wa_templates WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/seed", auth, async (req, res) => {
  try {
    const defaultTemplates = [
      ["welcome_greeting", "UTILITY", "en", "Welcome to {company}", "Hello {name}! Welcome to {company}. We are delighted to assist you with {service}. Feel free to reply anytime!", "Thank you, Team {company}", "APPROVED"],
      ["new_lead_acknowledgement", "MARKETING", "en", "Inquiry Received", "Hi {name}, thank you for reaching out! Our team in {city} received your inquiry for {service}. We will connect with you shortly.", "Customer Care", "APPROVED"],
      ["shop_business_hours_notice", "UTILITY", "en", "Office Working Hours", "Hello {name}, thank you for messaging {company}. Our working hours in {city} are {start_time} to {end_time}. How can we assist you today?", "Team {company}", "APPROVED"],
      ["service_appointment_reminder", "UTILITY", "en", "Appointment Reminder", "Hi {name}, this is a reminder for your {service} appointment scheduled on {date} at {city}. Our team will arrive between {start_time} and {end_time}.", "Service Team", "APPROVED"],
      ["invoice_generated_notice", "UTILITY", "en", "Invoice Notice", "Hello {name}, your invoice {invoice_no} for amount {amount} has been generated. Due date: {due_date}. Thank you for choosing {company}!", "Billing Department", "APPROVED"],
      ["payment_received_receipt", "UTILITY", "en", "Payment Received", "Dear {name}, we received your payment of {amount} for invoice {invoice_no} on {date}. Thank you for your prompt payment!", "Accounts Team", "APPROVED"],
      ["payment_due_reminder_notice", "UTILITY", "en", "Payment Due Reminder", "Hi {name}, gentle reminder that payment for invoice {invoice_no} (amount {amount}) is due on {due_date}. Please reply if you need help.", "Accounts Team", "APPROVED"],
      ["birthday_wishes_discount", "MARKETING", "en", "Happy Birthday!", "🎉 Happy Birthday {name}! Wishing you a wonderful year ahead from all of us at {company}. Enjoy special savings on your next {service}!", "Special Gift", "APPROVED"],
      ["service_ticket_feedback", "UTILITY", "en", "Support Feedback", "Hello {name}, your service request for {service} in {city} has been completed. We would love to hear your feedback!", "Customer Care", "APPROVED"],
    ];

    for (const t of defaultTemplates) {
      await db.promise().query(
        `INSERT INTO wa_templates (name, category, language, header_value, body, footer, meta_status)
         VALUES (?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE body=VALUES(body), header_value=VALUES(header_value), footer=VALUES(footer)`,
        t
      );
    }
    const [rows] = await db.promise().query("SELECT * FROM wa_templates ORDER BY created_at DESC");
    res.json({ success: true, count: rows.length, templates: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/sync", auth, async (req, res) => {
  try {
    const wa = require("../services/whatsappCloudApi");
    const templates = await wa.getTemplates();
    res.json({ success: true, metaTemplates: templates.data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;