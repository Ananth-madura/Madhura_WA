"use strict";
const router = require("express").Router();
const { pipeline } = require("node:stream/promises");
const multer = require("multer");
const storage = require("../services/r2StorageService");
const assets = require("../services/workspaceAssets");
const { verifyToken } = require("../middleware/authMiddleware");
const { requireTenantContext } = require("../middleware/tenantMiddleware");
const { campaignLaunchLimiter } = require("../middleware/waRateLimiter");
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.use(verifyToken, requireTenantContext, (req, res, next) => {
  if (["organization_owner", "organization_admin"].includes(req.userRole) || req.user.role === "platform_admin") return next();
  res.status(403).json({ error: "Organization administrator required" });
});
router.use((req, res, next) => { res.set("Cache-Control", "private, no-store"); next(); });

router.get("/status", (req, res) => {
  const db = require("../config/database"), status = storage.getStatus();
  res.json({
    r2: { configured: status.configured, disabled: status.disabled, authFailed: status.authFailed, publicAssetsReady: status.publicAssetsReady, lastProbe: status.lastProbe },
    database: { engine: db.isSqlite ? "sqlite" : "mysql", isSqlite: Boolean(db.isSqlite), r2Backed: Boolean(db.isSqlite && status.configured) },
    tenantId: req.tenantId,
  });
});

router.post("/verify", campaignLaunchLimiter, async (req, res) => {
  const result = await storage.verifyConnection({ roundTrip: true, prefix: `tenants/${req.tenantId}/checks` });
  res.status(result.ok ? 200 : 503).json(result);
});

router.post("/sync", async (req, res) => {
  if (req.user.role !== "platform_admin") return res.status(403).json({ error: "Global database snapshots require platform administration" });
  if (!require("../config/database").isSqlite) return res.status(409).json({ error: "MySQL is authoritative. Use the VPS database backup workflow; R2 assets do not synchronize MySQL automatically." });
  try {
    const adapter = require("../config/sqliteDatabase");
    const result = await storage.uploadDatabaseToR2(adapter.dbPath, true);
    res.status(result.synced ? 200 : 503).json({ success: Boolean(result.synced) });
  } catch (_) { res.status(503).json({ error: "Snapshot unavailable" }); }
});

router.post("/upload", campaignLaunchLimiter, upload.single("file"), async (req, res) => {
  try { res.status(201).json(await assets.upload(req)); }
  catch (error) { res.status(error.status || 503).json({ error: error.status ? error.message : "R2 upload unavailable" }); }
});

router.get(/^\/r2\/(.+)$/, async (req, res) => {
  const key = req.params[0];
  if (!assets.ownsKey(req.tenantId, key)) return res.status(404).json({ error: "Asset not found" });
  try {
    if (!storage.isConfigured()) return res.status(503).json({ error: "R2 storage unavailable" });
    const object = await storage.getMediaStream(key);
    if (!object?.Body) return res.status(404).json({ error: "Asset not found" });
    res.set({ "Content-Type": object.ContentType || "application/octet-stream", "Content-Disposition": "attachment", "X-Content-Type-Options": "nosniff" });
    if (object.ContentLength != null) res.set("Content-Length", String(object.ContentLength));
    await pipeline(object.Body, res);
  } catch (_) { if (!res.headersSent) res.status(503).json({ error: "R2 download unavailable" }); else res.destroy(); }
});

router.delete(/^\/r2\/(.+)$/, async (req, res) => {
  if (!assets.ownsKey(req.tenantId, req.params[0])) return res.status(404).json({ error: "Asset not found" });
  try { await storage.deleteMedia(req.params[0]); res.json({ success: true }); }
  catch (_) { res.status(503).json({ error: "R2 deletion unavailable" }); }
});

router.use((error, req, res, next) => {
  if (!(error instanceof multer.MulterError)) return next(error);
  res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ error: "Asset upload rejected; maximum file size is 20 MB" });
});

module.exports = router;
