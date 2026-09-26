const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken: auth } = require("../middleware/authMiddleware");

// ── List contacts with filters ────────────────────────────────────────────────
router.get("/", auth, async (req, res) => {
  try {
    const { search, filter, tag, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = "1=1";
    const params = [];

    if (search) {
      where += " AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)";
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    if (filter === "opted_in") { where += " AND opt_in_status=1 AND is_blocked=0 AND is_unsubscribed=0"; }
    if (filter === "blocked") { where += " AND is_blocked=1"; }
    if (filter === "unsubscribed") { where += " AND is_unsubscribed=1"; }
    if (filter === "opted_out") { where += " AND is_unsubscribed=1"; }

    const [rows] = await db.promise().query(
      `SELECT * FROM wa_contacts WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    const [[{ total }]] = await db.promise().query(
      `SELECT COUNT(*) as total FROM wa_contacts WHERE ${where}`,
      params
    );

    res.json({ contacts: rows, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get single contact ────────────────────────────────────────────────────────
router.get("/:id", auth, async (req, res) => {
  try {
    const [rows] = await db.promise().query("SELECT * FROM wa_contacts WHERE id=?", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Contact not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Create contact ────────────────────────────────────────────────────────────
router.post("/", auth, async (req, res) => {
  try {
    const { name, phone, country_code = "91", email, tags, custom_fields, opt_in_status = 1, source, notes } = req.body;
    if (!name || !phone) return res.status(400).json({ error: "name and phone are required" });

    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    if (cleanPhone.length < 10) return res.status(400).json({ error: "Invalid phone number" });

    const [result] = await db.promise().query(
      `INSERT INTO wa_contacts (name, phone, country_code, email, tags, custom_fields, opt_in_status, source, notes, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [name, cleanPhone, country_code, email || null,
        tags ? JSON.stringify(tags) : null,
        custom_fields ? JSON.stringify(custom_fields) : null,
        opt_in_status ? 1 : 0,
        source || null, notes || null, req.user?.id || null]
    );
    const [row] = await db.promise().query("SELECT * FROM wa_contacts WHERE id=?", [result.insertId]);

    // Optional: Only trigger welcome_message automation if explicitly requested by user in request payload
    if (req.body.send_welcome) {
      try {
        const { triggerAutomation } = require("../services/waAutomationService");
        triggerAutomation("welcome_message", {
          phone: cleanPhone,
          contactName: name,
          data: { name, email, source, notes }
        }).catch(e => console.error("WA Automation error:", e.message));
      } catch (_) {}
    }

    res.status(201).json(row[0]);
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Phone number already exists" });
    res.status(500).json({ error: err.message });
  }
});

// ── Update contact ────────────────────────────────────────────────────────────
router.put("/:id", auth, async (req, res) => {
  try {
    const { name, phone, country_code, email, tags, custom_fields, opt_in_status, source, notes } = req.body;
    await db.promise().query(
      `UPDATE wa_contacts SET name=?, phone=?, country_code=?, email=?, tags=?, custom_fields=?, opt_in_status=?, source=?, notes=?, updated_at=NOW() WHERE id=?`,
      [name, phone, country_code || "91", email || null,
        tags ? JSON.stringify(tags) : null,
        custom_fields ? JSON.stringify(custom_fields) : null,
        opt_in_status ? 1 : 0,
        source || null, notes || null, req.params.id]
    );
    const [row] = await db.promise().query("SELECT * FROM wa_contacts WHERE id=?", [req.params.id]);
    res.json(row[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Delete contact ────────────────────────────────────────────────────────────
router.delete("/:id", auth, async (req, res) => {
  try {
    await db.promise().query("DELETE FROM wa_contacts WHERE id=?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Block contact ─────────────────────────────────────────────────────────────
router.post("/:id/block", auth, async (req, res) => {
  try {
    await db.promise().query("UPDATE wa_contacts SET is_blocked=1, updated_at=NOW() WHERE id=?", [req.params.id]);
    res.json({ success: true, blocked: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Unblock contact ───────────────────────────────────────────────────────────
router.post("/:id/unblock", auth, async (req, res) => {
  try {
    await db.promise().query("UPDATE wa_contacts SET is_blocked=0, updated_at=NOW() WHERE id=?", [req.params.id]);
    res.json({ success: true, blocked: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Opt-out list ──────────────────────────────────────────────────────────────
router.get("/opt-outs/list", auth, async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      "SELECT * FROM wa_opt_outs ORDER BY opted_out_at DESC LIMIT 200"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Remove opt-out (re-subscribe) ─────────────────────────────────────────────
router.delete("/opt-outs/:phone", auth, async (req, res) => {
  try {
    await db.promise().query("DELETE FROM wa_opt_outs WHERE phone=?", [req.params.phone]);
    await db.promise().query(
      "UPDATE wa_contacts SET is_unsubscribed=0, opt_in_status=1 WHERE phone LIKE ?",
      [`%${req.params.phone.slice(-10)}`]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Bulk import from CRM sources ──────────────────────────────────────────────
router.post("/bulk-import", auth, async (req, res) => {
  try {
    const { source } = req.body; // 'clients', 'telecalls', 'walkins', 'fields', or array of {name, phone}
    let contacts = [];

    if (Array.isArray(req.body.contacts)) {
      contacts = req.body.contacts;
    } else {
      // Pull from CRM tables
      const sources = source ? [source] : ["clients", "telecalls", "walkins", "fields"];

      for (const src of sources) {
        let rows = [];
        if (src === "clients") {
          [rows] = await db.promise().query(
            "SELECT COALESCE(name, company_name, 'Client') as name, phone, 'Client' as source FROM clients WHERE phone IS NOT NULL AND phone != ''"
          );
        } else if (src === "telecalls") {
          [rows] = await db.promise().query(
            "SELECT COALESCE(customer_name, company_name, 'Lead') as name, mobile_number as phone, 'Telecalling' as source FROM telecalls WHERE mobile_number IS NOT NULL AND mobile_number != ''"
          );
        } else if (src === "walkins") {
          [rows] = await db.promise().query(
            "SELECT COALESCE(customer_name, company_name, 'Walkin') as name, mobile_number as phone, 'Walkin' as source FROM walkins WHERE mobile_number IS NOT NULL AND mobile_number != ''"
          );
        } else if (src === "fields") {
          [rows] = await db.promise().query(
            "SELECT COALESCE(customer_name, company_name, 'Field') as name, mobile_number as phone, 'Field Visit' as source FROM fields WHERE mobile_number IS NOT NULL AND mobile_number != ''"
          );
        }
        contacts = contacts.concat(rows);
      }
    }

    const values = [];
    let skipped = 0;
    for (const c of contacts) {
      const cleanPhone = (c.phone || "").replace(/\D/g, "").slice(-10);
      if (cleanPhone.length !== 10) { skipped++; continue; }
      const tagsJson = c.tags
        ? (Array.isArray(c.tags) ? JSON.stringify(c.tags) : JSON.stringify(String(c.tags).split(",").map(t => t.trim()).filter(Boolean)))
        : null;
      values.push([
        c.name || "Unknown",
        cleanPhone,
        c.country_code || "91",
        c.email || null,
        tagsJson,
        c.source || "CRM Import",
        c.notes || null,
        1,
        req.user?.id || null
      ]);
    }

    let inserted = 0;
    if (values.length) {
      const [result] = await db.promise().query(
        `INSERT IGNORE INTO wa_contacts (name, phone, country_code, email, tags, source, notes, opt_in_status, created_by) VALUES ?`,
        [values]
      );
      inserted = result.affectedRows;
      skipped += values.length - inserted;
    }

    res.json({ success: true, inserted, skipped, total: contacts.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Stats summary ─────────────────────────────────────────────────────────────
router.get("/stats/summary", auth, async (req, res) => {
  try {
    const [[{ total }]] = await db.promise().query("SELECT COUNT(*) as total FROM wa_contacts");
    const [[{ opted_in }]] = await db.promise().query("SELECT COUNT(*) as opted_in FROM wa_contacts WHERE opt_in_status=1 AND is_blocked=0 AND is_unsubscribed=0");
    const [[{ blocked }]] = await db.promise().query("SELECT COUNT(*) as blocked FROM wa_contacts WHERE is_blocked=1");
    const [[{ unsubscribed }]] = await db.promise().query("SELECT COUNT(*) as unsubscribed FROM wa_contacts WHERE is_unsubscribed=1");
    const [[{ opt_outs }]] = await db.promise().query("SELECT COUNT(*) as opt_outs FROM wa_opt_outs");
    res.json({ total, opted_in, blocked, unsubscribed, opt_outs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
