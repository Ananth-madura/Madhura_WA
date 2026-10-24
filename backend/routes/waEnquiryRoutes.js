const express = require("express");
const router = express.Router();
const { verifyToken: auth } = require("../middleware/authMiddleware");
const { requireTenantContext } = require("../middleware/tenantMiddleware");
const svc = require("../services/enquiryService");

// Enforce authentication & strict tenant isolation on all enquiry endpoints
router.use(auth);
router.use(requireTenantContext);

// Self-ensuring table — safe to call on every request (no-op after first).
router.use(async (req, res, next) => {
  try {
    await svc.ensureEnquiryTables();
    next();
  } catch (err) {
    console.error("enquiries: ensure table failed:", err.message);
    res.status(500).json({ message: "Enquiries storage unavailable" });
  }
});

const fail = (res, err) => {
  console.error("enquiries error:", err.message);
  res.status(err.status || 500).json({ message: err.message || "Server error" });
};

// ── KPI summary (before /:id so "summary" is not read as an id) ───────────────
router.get("/summary", async (req, res) => {
  try {
    res.json(await svc.stats(req.tenantId));
  } catch (err) {
    fail(res, err);
  }
});

// ── List enquiries ───────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { temperature, status, search, page, limit } = req.query;
    res.json(await svc.list(req.tenantId, { temperature, status, search, page, limit }));
  } catch (err) {
    fail(res, err);
  }
});

// ── Single enquiry ───────────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const row = await svc.getById(req.params.id, req.tenantId);
    if (!row) return res.status(404).json({ message: "Enquiry not found" });
    res.json(row);
  } catch (err) {
    fail(res, err);
  }
});

// ── Create ───────────────────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ message: "Name is required" });
    const row = await svc.create(req.tenantId, { ...req.body, name }, req.user?.id);
    res.status(201).json(row);
  } catch (err) {
    fail(res, err);
  }
});

// ── Update (temperature, fields, status) ─────────────────────────────────────
router.put("/:id", async (req, res) => {
  try {
    const row = await svc.update(req.params.id, req.tenantId, req.body || {});
    if (!row) return res.status(404).json({ message: "Enquiry not found" });
    res.json(row);
  } catch (err) {
    fail(res, err);
  }
});

// ── Delete (admin / sub-admin only) ──────────────────────────────────────────
router.delete("/:id", auth, require("../middleware/authMiddleware").isAdmin, async (req, res) => {
  try {
    const ok = await svc.remove(req.params.id, req.tenantId);
    if (!ok) return res.status(404).json({ message: "Enquiry not found" });
    res.json({ success: true });
  } catch (err) {
    fail(res, err);
  }
});

// ── Convert to client ────────────────────────────────────────────────────────
router.post("/:id/convert", async (req, res) => {
  try {
    const result = await svc.convert(req.params.id, req.tenantId, req.user?.id);
    res.status(result.deduped ? 200 : 201).json(result);
  } catch (err) {
    fail(res, err);
  }
});

module.exports = router;
