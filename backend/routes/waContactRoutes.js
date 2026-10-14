const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken: auth } = require("../middleware/authMiddleware");
const { requireTenantContext } = require("../middleware/tenantMiddleware");

// Enforce authentication & strict tenant isolation on all contact endpoints
router.use(auth);
router.use(requireTenantContext);

const q = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });

// ── List contacts with tenant & branch filters ───────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { search, filter, branchId, branch_id, page = 1, limit = 50 } = req.query;
    const requestedBranch = branchId || branch_id || req.headers["x-branch-id"];
    const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(100, parseInt(limit));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

    let where = "c.tenant_id = ?";
    const params = [req.tenantId];

    // Branch scoping
    if (requestedBranch && requestedBranch !== "all" && requestedBranch !== "0") {
      if (requestedBranch === "unassigned") {
        where += " AND c.branch_id IS NULL";
      } else {
        where += " AND c.branch_id = ?";
        params.push(Number(requestedBranch));
      }
    }

    if (search && search.trim()) {
      where += " AND (c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)";
      const s = `%${search.trim()}%`;
      params.push(s, s, s);
    }

    if (filter === "opted_in") {
      where += " AND c.opt_in_status = 1 AND c.is_blocked = 0 AND c.is_unsubscribed = 0";
    } else if (filter === "blocked") {
      where += " AND c.is_blocked = 1";
    } else if (filter === "unsubscribed" || filter === "opted_out") {
      where += " AND c.is_unsubscribed = 1";
    }

    const rows = await q(
      `SELECT c.*, b.name as branch_name, b.code as branch_code
       FROM wa_contacts c
       LEFT JOIN branches b ON c.branch_id = b.id
       WHERE ${where}
       ORDER BY c.last_message_at DESC, c.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    const countRows = await q(
      `SELECT COUNT(*) as total FROM wa_contacts c WHERE ${where}`,
      params
    );
    const total = Number(countRows?.[0]?.total || 0);

    res.json({
      contacts: rows || [],
      total,
      page: Math.max(1, parseInt(page)),
      totalPages: Math.ceil(total / limitNum) || 1,
      tenant_id: req.tenantId,
      branch_id: requestedBranch || null,
    });
  } catch (err) {
    console.error("[GET /api/wa/contacts] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Get single contact ────────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const contactId = Number(req.params.id);
    const rows = await q(
      `SELECT c.*, b.name as branch_name, b.code as branch_code
       FROM wa_contacts c
       LEFT JOIN branches b ON c.branch_id = b.id
       WHERE c.id = ? AND c.tenant_id = ? LIMIT 1`,
      [contactId, req.tenantId]
    );

    if (!rows || !rows.length) {
      return res.status(404).json({ error: "Contact not found" });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Create contact with tenant & branch assignment ────────────────────────────
router.post("/", async (req, res) => {
  try {
    const {
      name,
      phone,
      country_code = "91",
      email,
      tags,
      custom_fields,
      opt_in_status = 1,
      source,
      notes,
      branch_id,
      branchId,
    } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: "name and phone are required" });
    }

    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    if (cleanPhone.length < 10) {
      return res.status(400).json({ error: "Invalid 10-digit phone number" });
    }

    // Resolve branch ID: explicit payload > header > fallback to primary head office
    let targetBranchId = branch_id || branchId || req.headers["x-branch-id"];
    if (!targetBranchId || targetBranchId === "all") {
      const branches = await q(
        "SELECT id FROM branches WHERE tenant_id = ? AND status = 'active' ORDER BY is_head_office DESC, id ASC LIMIT 1",
        [req.tenantId]
      );
      targetBranchId = branches?.[0]?.id || null;
    } else {
      targetBranchId = Number(targetBranchId);
    }

    const tagsJson = tags
      ? (Array.isArray(tags) ? JSON.stringify(tags) : JSON.stringify(String(tags).split(",").map((t) => t.trim()).filter(Boolean)))
      : null;
    const customFieldsJson = custom_fields
      ? (typeof custom_fields === "object" ? JSON.stringify(custom_fields) : custom_fields)
      : null;

    // Check if phone exists within this tenant
    const existing = await q(
      "SELECT id FROM wa_contacts WHERE tenant_id = ? AND phone = ? LIMIT 1",
      [req.tenantId, cleanPhone]
    );

    let contactId;
    if (existing && existing.length > 0) {
      contactId = existing[0].id;
      await q(
        `UPDATE wa_contacts 
         SET name = ?, email = COALESCE(?, email), branch_id = COALESCE(?, branch_id), tags = COALESCE(?, tags), notes = COALESCE(?, notes), opt_in_status = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND tenant_id = ?`,
        [name, email || null, targetBranchId, tagsJson, notes || null, opt_in_status ? 1 : 0, contactId, req.tenantId]
      );
    } else {
      const result = await q(
        `INSERT INTO wa_contacts 
          (tenant_id, branch_id, name, phone, country_code, email, tags, custom_fields, opt_in_status, source, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.tenantId,
          targetBranchId,
          name,
          cleanPhone,
          country_code,
          email || null,
          tagsJson,
          customFieldsJson,
          opt_in_status ? 1 : 0,
          source || "Manual Entry",
          notes || null,
          req.user?.id || null,
        ]
      );
      contactId = result.insertId || result.lastID;
    }

    const [row] = await q(
      `SELECT c.*, b.name as branch_name, b.code as branch_code
       FROM wa_contacts c
       LEFT JOIN branches b ON c.branch_id = b.id
       WHERE c.id = ?`,
      [contactId]
    );

    // Optional: trigger welcome automation if requested
    if (req.body.send_welcome) {
      try {
        const { triggerAutomation } = require("../services/waAutomationService");
        triggerAutomation("welcome_message", {
          phone: cleanPhone,
          contactName: name,
          tenantId: req.tenantId,
          branchId: targetBranchId,
          data: { name, email, source, notes },
        }).catch((e) => console.error("WA Automation error:", e.message));
      } catch (_) {}
    }

    res.status(201).json(row);
  } catch (err) {
    console.error("[POST /api/wa/contacts] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Update contact ────────────────────────────────────────────────────────────
router.put("/:id", async (req, res) => {
  try {
    const contactId = Number(req.params.id);
    const { name, phone, country_code, email, tags, custom_fields, opt_in_status, source, notes, branch_id, branchId } = req.body;

    const targetBranchId = branch_id !== undefined ? branch_id : (branchId !== undefined ? branchId : null);
    const tagsJson = tags !== undefined
      ? (Array.isArray(tags) ? JSON.stringify(tags) : JSON.stringify(String(tags).split(",").map((t) => t.trim()).filter(Boolean)))
      : null;
    const customFieldsJson = custom_fields !== undefined
      ? (typeof custom_fields === "object" ? JSON.stringify(custom_fields) : custom_fields)
      : null;

    let updateSql = `
      UPDATE wa_contacts 
      SET name = COALESCE(?, name),
          email = COALESCE(?, email),
          country_code = COALESCE(?, country_code),
          tags = COALESCE(?, tags),
          custom_fields = COALESCE(?, custom_fields),
          opt_in_status = COALESCE(?, opt_in_status),
          source = COALESCE(?, source),
          notes = COALESCE(?, notes),
          updated_at = CURRENT_TIMESTAMP
    `;
    const updateParams = [
      name || null,
      email || null,
      country_code || null,
      tagsJson,
      customFieldsJson,
      opt_in_status !== undefined ? (opt_in_status ? 1 : 0) : null,
      source || null,
      notes || null,
    ];

    if (targetBranchId !== null) {
      updateSql += ", branch_id = ?";
      updateParams.push(targetBranchId ? Number(targetBranchId) : null);
    }

    updateSql += " WHERE id = ? AND tenant_id = ?";
    updateParams.push(contactId, req.tenantId);

    await q(updateSql, updateParams);

    const [row] = await q(
      `SELECT c.*, b.name as branch_name, b.code as branch_code
       FROM wa_contacts c
       LEFT JOIN branches b ON c.branch_id = b.id
       WHERE c.id = ? AND c.tenant_id = ?`,
      [contactId, req.tenantId]
    );

    if (!row) {
      return res.status(404).json({ error: "Contact not found" });
    }

    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Delete contact ────────────────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const contactId = Number(req.params.id);
    const result = await q("DELETE FROM wa_contacts WHERE id = ? AND tenant_id = ?", [contactId, req.tenantId]);
    if (result?.affectedRows === 0) {
      return res.status(404).json({ error: "Contact not found" });
    }
    res.json({ success: true, message: "Contact deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Block contact ─────────────────────────────────────────────────────────────
router.post("/:id/block", async (req, res) => {
  try {
    const contactId = Number(req.params.id);
    await q("UPDATE wa_contacts SET is_blocked = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?", [
      contactId,
      req.tenantId,
    ]);
    res.json({ success: true, blocked: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Unblock contact ───────────────────────────────────────────────────────────
router.post("/:id/unblock", async (req, res) => {
  try {
    const contactId = Number(req.params.id);
    await q("UPDATE wa_contacts SET is_blocked = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?", [
      contactId,
      req.tenantId,
    ]);
    res.json({ success: true, blocked: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Stats summary ─────────────────────────────────────────────────────────────
router.get("/stats/summary", async (req, res) => {
  try {
    const { branchId, branch_id } = req.query;
    const requestedBranch = branchId || branch_id || req.headers["x-branch-id"];

    let where = "tenant_id = ?";
    const params = [req.tenantId];

    if (requestedBranch && requestedBranch !== "all" && requestedBranch !== "0") {
      where += " AND branch_id = ?";
      params.push(Number(requestedBranch));
    }

    const [totalRow] = await q(`SELECT COUNT(*) as total FROM wa_contacts WHERE ${where}`, params);
    const [optedInRow] = await q(
      `SELECT COUNT(*) as opted_in FROM wa_contacts WHERE ${where} AND opt_in_status = 1 AND is_blocked = 0 AND is_unsubscribed = 0`,
      params
    );
    const [blockedRow] = await q(`SELECT COUNT(*) as blocked FROM wa_contacts WHERE ${where} AND is_blocked = 1`, params);
    const [unsubRow] = await q(
      `SELECT COUNT(*) as unsubscribed FROM wa_contacts WHERE ${where} AND is_unsubscribed = 1`,
      params
    );

    res.json({
      total: Number(totalRow?.total || 0),
      opted_in: Number(optedInRow?.opted_in || 0),
      blocked: Number(blockedRow?.blocked || 0),
      unsubscribed: Number(unsubRow?.unsubscribed || 0),
      opt_outs: Number(unsubRow?.unsubscribed || 0),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Bulk import contacts ──────────────────────────────────────────────────────
router.post("/bulk-import", async (req, res) => {
  try {
    const { contacts, branchId, branch_id } = req.body;
    if (!Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ error: "contacts array required" });
    }

    let targetBranchId = branch_id || branchId || req.headers["x-branch-id"];
    if (!targetBranchId || targetBranchId === "all") {
      const branches = await q(
        "SELECT id FROM branches WHERE tenant_id = ? AND status = 'active' ORDER BY is_head_office DESC, id ASC LIMIT 1",
        [req.tenantId]
      );
      targetBranchId = branches?.[0]?.id || null;
    } else {
      targetBranchId = Number(targetBranchId);
    }

    let inserted = 0;
    let skipped = 0;

    for (const c of contacts) {
      const cleanPhone = (c.phone || "").replace(/\D/g, "").slice(-10);
      if (cleanPhone.length !== 10) {
        skipped++;
        continue;
      }

      const tagsJson = c.tags
        ? (Array.isArray(c.tags) ? JSON.stringify(c.tags) : JSON.stringify(String(c.tags).split(",").map((t) => t.trim()).filter(Boolean)))
        : null;

      try {
        await q(
          `INSERT INTO wa_contacts 
            (tenant_id, branch_id, name, phone, country_code, email, tags, source, notes, opt_in_status, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
          [
            req.tenantId,
            targetBranchId,
            c.name || "Unknown",
            cleanPhone,
            c.country_code || "91",
            c.email || null,
            tagsJson,
            c.source || "Bulk Import",
            c.notes || null,
            req.user?.id || null,
          ]
        );
        inserted++;
      } catch (insErr) {
        skipped++;
      }
    }

    res.json({ success: true, inserted, skipped, total: contacts.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
