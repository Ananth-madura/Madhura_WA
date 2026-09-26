const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken: auth } = require("../middleware/authMiddleware");

// ── List all Drip Sequences ──────────────────────────────────────────────────
router.get("/", auth, async (req, res) => {
  try {
    const [sequences] = await db.promise().query(
      `SELECT s.*, 
        (SELECT COUNT(*) FROM wa_drip_steps WHERE sequence_id = s.id) as step_count,
        (SELECT COUNT(*) FROM wa_drip_enrollments WHERE sequence_id = s.id AND status = 'active') as active_enrolled,
        (SELECT COUNT(*) FROM wa_drip_enrollments WHERE sequence_id = s.id AND status = 'completed') as completed_enrolled
       FROM wa_drip_sequences s
       ORDER BY s.created_at DESC`
    );
    res.json(sequences);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get Single Drip Sequence Details with Steps ──────────────────────────────
router.get("/:id", auth, async (req, res) => {
  try {
    const [rows] = await db.promise().query("SELECT * FROM wa_drip_sequences WHERE id = ?", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Drip sequence not found" });

    const [steps] = await db.promise().query(
      "SELECT * FROM wa_drip_steps WHERE sequence_id = ? ORDER BY step_number ASC",
      [req.params.id]
    );

    const [enrollments] = await db.promise().query(
      "SELECT * FROM wa_drip_enrollments WHERE sequence_id = ? ORDER BY enrolled_at DESC LIMIT 50",
      [req.params.id]
    );

    res.json({
      sequence: rows[0],
      steps,
      enrollments,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Create Drip Sequence with Steps ──────────────────────────────────────────
router.post("/", auth, async (req, res) => {
  try {
    const {
      name,
      description,
      trigger_type = "manual",
      trigger_config = null,
      stop_on_reply = 1,
      stop_on_payment = 1,
      steps = [],
    } = req.body;

    if (!name) return res.status(400).json({ error: "Sequence name required" });

    const [result] = await db.promise().query(
      `INSERT INTO wa_drip_sequences (name, description, trigger_type, trigger_config, stop_on_reply, stop_on_payment, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        description || null,
        trigger_type,
        trigger_config ? JSON.stringify(trigger_config) : null,
        stop_on_reply ? 1 : 0,
        stop_on_payment ? 1 : 0,
        req.user?.id || null,
      ]
    );

    const sequenceId = result.insertId;

    if (Array.isArray(steps) && steps.length > 0) {
      for (let i = 0; i < steps.length; i++) {
        const s = steps[i];
        await db.promise().query(
          `INSERT INTO wa_drip_steps (sequence_id, step_number, delay_days, delay_hours, template_id, message_text, media_url, media_type)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            sequenceId,
            i + 1,
            s.delay_days || 0,
            s.delay_hours || 0,
            s.template_id || null,
            s.message_text || "",
            s.media_url || null,
            s.media_type || null,
          ]
        );
      }
    }

    res.json({ success: true, sequenceId, message: "Drip sequence created" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Enroll Contact(s) into Drip Sequence ─────────────────────────────────────
router.post("/:id/enroll", auth, async (req, res) => {
  try {
    const { phones, contact_names = {} } = req.body;
    if (!phones || !phones.length) return res.status(400).json({ error: "At least one phone required" });

    const [steps] = await db.promise().query(
      "SELECT * FROM wa_drip_steps WHERE sequence_id = ? ORDER BY step_number ASC LIMIT 1",
      [req.params.id]
    );

    if (!steps.length) return res.status(400).json({ error: "Sequence has no steps configured" });

    const firstStep = steps[0];
    const delayMinutes = (firstStep.delay_days || 0) * 1440 + (firstStep.delay_hours || 0) * 60;
    const nextRunAt = new Date(Date.now() + delayMinutes * 60000);

    let enrolledCount = 0;
    for (const rawPhone of phones) {
      const cleanPhone = String(rawPhone).replace(/\D/g, "");
      if (!cleanPhone) continue;

      await db.promise().query(
        `INSERT INTO wa_drip_enrollments (sequence_id, phone, contact_name, current_step, status, next_run_at)
         VALUES (?, ?, ?, 1, 'active', ?)
         ON DUPLICATE KEY UPDATE current_step = 1, status = 'active', next_run_at = ?`,
        [
          req.params.id,
          cleanPhone,
          contact_names[cleanPhone] || null,
          nextRunAt,
          nextRunAt,
        ]
      );
      enrolledCount++;
    }

    await db.promise().query(
      "UPDATE wa_drip_sequences SET total_enrolled = total_enrolled + ? WHERE id = ?",
      [enrolledCount, req.params.id]
    );

    res.json({ success: true, enrolledCount, message: `Enrolled ${enrolledCount} contacts into drip sequence` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
