const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken: auth } = require("../middleware/authMiddleware");

router.get("/", auth, async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      "SELECT g.*, (SELECT COUNT(*) FROM wa_group_contacts WHERE group_id = g.id) as contact_count FROM wa_contact_groups g ORDER BY g.created_at DESC"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", auth, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });
    const [result] = await db.promise().query(
      "INSERT INTO wa_contact_groups (name, description, created_by) VALUES (?,?,?)",
      [name, description || null, req.user?.id || null]
    );
    const [row] = await db.promise().query("SELECT * FROM wa_contact_groups WHERE id = ?", [result.insertId]);
    res.status(201).json({ ...row[0], contact_count: 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", auth, async (req, res) => {
  try {
    const [rows] = await db.promise().query("SELECT * FROM wa_contact_groups WHERE id = ?", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Group not found" });
    const [contacts] = await db.promise().query("SELECT * FROM wa_group_contacts WHERE group_id = ? ORDER BY created_at DESC", [req.params.id]);
    res.json({ ...rows[0], contacts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/:id", auth, async (req, res) => {
  try {
    const { name, description } = req.body;
    await db.promise().query("UPDATE wa_contact_groups SET name=?, description=? WHERE id=?", [name, description, req.params.id]);
    const [rows] = await db.promise().query("SELECT * FROM wa_contact_groups WHERE id = ?", [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    await db.promise().query("DELETE FROM wa_contact_groups WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/contacts", auth, async (req, res) => {
  try {
    const { contacts } = req.body;
    if (!contacts || !Array.isArray(contacts) || !contacts.length)
      return res.status(400).json({ error: "contacts array required" });

    const values = contacts.map((c) => [req.params.id, c.name || null, c.phone, c.country_code || "91", c.notes || null]);
    await db.promise().query(
      "INSERT INTO wa_group_contacts (group_id, name, phone, country_code, notes) VALUES ?",
      [values]
    );
    const [countRow] = await db.promise().query("SELECT COUNT(*) as count FROM wa_group_contacts WHERE group_id = ?", [req.params.id]);
    await db.promise().query("UPDATE wa_contact_groups SET total_contacts = ? WHERE id = ?", [countRow[0].count, req.params.id]);
    const [contactsList] = await db.promise().query("SELECT * FROM wa_group_contacts WHERE group_id = ? ORDER BY created_at DESC", [req.params.id]);
    res.status(201).json(contactsList);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:groupId/contacts/:contactId", auth, async (req, res) => {
  try {
    await db.promise().query("DELETE FROM wa_group_contacts WHERE id = ? AND group_id = ?", [req.params.contactId, req.params.groupId]);
    const [countRow] = await db.promise().query("SELECT COUNT(*) as count FROM wa_group_contacts WHERE group_id = ?", [req.params.groupId]);
    await db.promise().query("UPDATE wa_contact_groups SET total_contacts = ? WHERE id = ?", [countRow[0].count, req.params.groupId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/sources/all", auth, async (req, res) => {
  try {
    const contacts = [];
    
    // Clients
    const [clients] = await db.promise().query(
      "SELECT id, COALESCE(name, company_name, 'Client') as name, phone, city, 'Client' as source FROM clients WHERE phone IS NOT NULL AND phone != ''"
    );
    contacts.push(...clients.map(c => ({ id: `client_${c.id}`, name: c.name, phone: c.phone.replace(/[^0-9]/g, "").slice(-10), city: c.city, source: c.source })));

    // Telecalls
    const [telecalls] = await db.promise().query(
      "SELECT id, COALESCE(customer_name, company_name, 'Lead') as name, mobile_number as phone, location_city as city, 'Telecalling' as source FROM telecalls WHERE mobile_number IS NOT NULL AND mobile_number != ''"
    );
    contacts.push(...telecalls.map(c => ({ id: `tele_${c.id}`, name: c.name, phone: c.phone.replace(/[^0-9]/g, "").slice(-10), city: c.city, source: c.source })));

    // Walkins
    const [walkins] = await db.promise().query(
      "SELECT id, COALESCE(customer_name, company_name, 'Walkin') as name, mobile_number as phone, location_city as city, 'Walkin' as source FROM walkins WHERE mobile_number IS NOT NULL AND mobile_number != ''"
    );
    contacts.push(...walkins.map(c => ({ id: `walk_${c.id}`, name: c.name, phone: c.phone.replace(/[^0-9]/g, "").slice(-10), city: c.city, source: c.source })));

    // Fields
    const [fields] = await db.promise().query(
      "SELECT id, COALESCE(customer_name, company_name, 'Field') as name, mobile_number as phone, location_city as city, 'Field Work' as source FROM fields WHERE mobile_number IS NOT NULL AND mobile_number != ''"
    );
    contacts.push(...fields.map(c => ({ id: `field_${c.id}`, name: c.name, phone: c.phone.replace(/[^0-9]/g, "").slice(-10), city: c.city, source: c.source })));

    // WhatsApp Contacts page — contacts added/imported there weren't reachable
    // from Groups/Campaigns before; include them so the two lists stay in sync.
    const [waContacts] = await db.promise().query(
      "SELECT id, name, phone, source FROM wa_contacts WHERE is_blocked=0 AND is_unsubscribed=0 AND phone IS NOT NULL AND phone != ''"
    );
    contacts.push(...waContacts.map(c => ({ id: `wac_${c.id}`, name: c.name, phone: c.phone.replace(/[^0-9]/g, "").slice(-10), city: null, source: c.source || "WhatsApp Contacts" })));

    // Filter valid 10-digit numbers and dedupe by phone (a contact can exist
    // in both a CRM table and wa_contacts) so the same number isn't offered twice.
    const seenPhones = new Set();
    const valid = contacts.filter(c => {
      if (!c.phone || c.phone.length !== 10) return false;
      if (seenPhones.has(c.phone)) return false;
      seenPhones.add(c.phone);
      return true;
    });
    res.json(valid);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/create-from-selected", auth, async (req, res) => {
  try {
    const { name, description, contacts } = req.body;
    if (!name) return res.status(400).json({ error: "Group name required" });
    if (!contacts || !Array.isArray(contacts) || !contacts.length) {
      return res.status(400).json({ error: "No contacts selected" });
    }

    const [result] = await db.promise().query(
      "INSERT INTO wa_contact_groups (name, description, created_by) VALUES (?,?,?)",
      [name, description || `Created from ${contacts.length} selected contacts`, req.user?.id || null]
    );
    const groupId = result.insertId;

    const values = contacts.map(c => [
      groupId,
      c.name || null,
      c.phone.replace(/[^0-9]/g, "").slice(-10),
      c.country_code || "91",
      c.source ? `Source: ${c.source}` : (c.notes || null)
    ]);

    await db.promise().query(
      "INSERT IGNORE INTO wa_group_contacts (group_id, name, phone, country_code, notes) VALUES ?",
      [values]
    );

    const [countRow] = await db.promise().query("SELECT COUNT(*) as count FROM wa_group_contacts WHERE group_id = ?", [groupId]);
    await db.promise().query("UPDATE wa_contact_groups SET total_contacts = ? WHERE id = ?", [countRow[0].count, groupId]);

    const [groupRow] = await db.promise().query("SELECT * FROM wa_contact_groups WHERE id = ?", [groupId]);
    res.status(201).json({ ...groupRow[0], contact_count: countRow[0].count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/import-customers", auth, async (req, res) => {
  try {
    const [customers] = await db.promise().query(
      "SELECT id, name, phone, city FROM clients WHERE phone IS NOT NULL AND phone != ''"
    );
    if (!customers.length) return res.status(400).json({ error: "No customers with phone numbers found" });

    const values = customers.map((c) => [req.params.id, c.name || c.company_name || null, c.phone.replace(/[^0-9]/g, "").slice(-10), "91", c.city || null]);
    await db.promise().query(
      "INSERT IGNORE INTO wa_group_contacts (group_id, name, phone, country_code, notes) VALUES ?",
      [values]
    );
    const [countRow] = await db.promise().query("SELECT COUNT(*) as count FROM wa_group_contacts WHERE group_id = ?", [req.params.id]);
    await db.promise().query("UPDATE wa_contact_groups SET total_contacts = ? WHERE id = ?", [countRow[0].count, req.params.id]);
    res.json({ success: true, imported: customers.length, totalContacts: countRow[0].count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;