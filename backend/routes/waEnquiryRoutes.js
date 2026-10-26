const express = require("express");
const router = express.Router();
const { verifyToken: auth } = require("../middleware/authMiddleware");
const { requireTenantContext } = require("../middleware/tenantMiddleware");
const svc = require("../services/enquiryService");

// Enforce authentication & strict tenant isolation on all enquiry endpoints
router.use(auth);
router.use(requireTenantContext);
router.use(require("../middleware/workspaceModule").workspaceModule("enquiries"));

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

// ── Enquiry types (before /:id so "types" is not read as an id) ──────────────
router.get("/types", (_req, res) => {
  res.json({
    types: svc.ENQUIRY_TYPES.map((value) => ({ value, label: svc.ENQUIRY_TYPE_LABELS[value] })),
  });
});

// ── List enquiries ───────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { temperature, status, search, enquiry_type, page, limit } = req.query;
    res.json(await svc.list(req.tenantId, { temperature, status, search, enquiry_type, page, limit }));
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
    // Branch defaults to the active branch from the verified tenant context,
    // never to a branch id guessed by the client.
    const branchId = req.body.branch_id ?? req.branchId ?? null;
    const row = await svc.create(
      req.tenantId,
      { ...req.body, branch_id: branchId, name },
      req.user?.id
    );
    if(row?.contact_id){
      const [owners]=await require("../config/database").promise().query("SELECT assigned_agent_id FROM wa_contacts WHERE tenant_id=? AND id=?",[req.tenantId,row.contact_id]);
      if(owners[0]?.assigned_agent_id)req.app.get("io")?.to(`user:${owners[0].assigned_agent_id}`).emit("customer_access_changed",{tenantId:req.tenantId,contactId:row.contact_id});
    }
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
