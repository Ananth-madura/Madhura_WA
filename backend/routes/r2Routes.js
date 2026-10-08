/**
 * r2Routes.js — API endpoints for Cloudflare R2 storage management and sync
 */

const express = require("express");
const router = express.Router();
const path = require("path");
const multer = require("multer");
const r2Storage = require("../services/r2StorageService");
const sqliteAdapter = require("../config/sqliteDatabase");
const { mediaDir } = require("../config/runtimePaths");

const { verifyToken: auth } = require("../middleware/authMiddleware");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

/**
 * GET /api/storage/status
 * Returns Cloudflare R2 connection & sync status
 */
router.get("/status", auth, (req, res) => {
  const r2Status = r2Storage.getStatus();
  const db = require("../config/database");

  res.json({
    r2: r2Status,
    database: {
      engine: db.isSqlite ? "sqlite" : "mysql",
      isSqlite: Boolean(db.isSqlite),
      r2Backed: Boolean(db.r2Enabled || (db.isSqlite && r2Status.configured)),
      localPath: sqliteAdapter.dbPath || null,
    },
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /api/storage/sync
 * Manually trigger SQLite database snapshot upload to Cloudflare R2
 */
router.post("/sync", auth, async (req, res) => {
  if (!r2Storage.isConfigured()) {
    return res.status(400).json({
      error: "Cloudflare R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME in environment.",
    });
  }

  if (!sqliteAdapter.dbPath) {
    return res.status(400).json({
      error: "SQLite database path not found or MySQL engine in use.",
    });
  }

  try {
    const result = await r2Storage.uploadDatabaseToR2(sqliteAdapter.dbPath);
    res.json({
      success: result.synced,
      message: result.synced
        ? "SQLite database successfully synced to Cloudflare R2"
        : result.error || "Sync failed",
      size: result.size,
      lastSyncAt: result.lastSyncAt,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to sync to Cloudflare R2" });
  }
});

/**
 * POST /api/storage/upload
 * Upload media directly to Cloudflare R2 bucket
 */
router.post("/upload", auth, upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file provided" });
  }

  const filename = `${Date.now()}_${Math.round(Math.random() * 1e9)}_${req.file.originalname}`;
  const key = `uploads/${filename}`;

  if (r2Storage.isConfigured()) {
    const uploadResult = await r2Storage.uploadMedia(req.file.buffer, key, req.file.mimetype);
    if (uploadResult.success) {
      return res.json({
        url: uploadResult.url,
        key: uploadResult.key,
        storage: "cloudflare-r2",
      });
    }
  }

  // Fallback to local storage if R2 is not configured
  const fs = require("fs");
  const localTarget = path.join(mediaDir, filename);
  if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });
  fs.writeFileSync(localTarget, req.file.buffer);

  return res.json({
    url: `/uploads/wa-media/${filename}`,
    key: filename,
    storage: "local",
  });
});

/**
 * GET /api/storage/r2/...
 * Stream file from Cloudflare R2
 */
router.get(/^\/r2\/(.+)/, auth, async (req, res) => {
  const key = req.params[0] || (req.params && req.params.key);
  if (!key) return res.status(400).json({ error: "Missing key" });

  try {
    const obj = await r2Storage.getMediaStream(key);
    if (!obj || !obj.Body) {
      return res.status(404).json({ error: "File not found on Cloudflare R2" });
    }

    if (obj.ContentType) res.setHeader("Content-Type", obj.ContentType);
    if (obj.ContentLength) res.setHeader("Content-Length", obj.ContentLength);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

    obj.Body.pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
