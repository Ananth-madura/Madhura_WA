"use strict";
const multer = require("multer");
const parse = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } }).single("file");

module.exports = (req, res, next) => {
  const storage = require("../services/r2StorageService");
  if (!storage.isConfigured()) return next();
  if (!storage.getStatus().publicAssetsReady) return res.status(409).json({ error: "Campaign uploads require a separate public R2 bucket and HTTPS asset domain. Attach an existing HTTPS URL instead." });
  parse(req, res, async error => {
    if (error) return res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ error: "Media upload rejected" });
    try { res.status(201).json(await require("../services/workspaceAssets").upload(req, { published: true })); }
    catch (failure) { res.status(failure.status || 503).json({ error: failure.status ? failure.message : "R2 upload unavailable" }); }
  });
};
