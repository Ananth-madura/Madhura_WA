"use strict";
const crypto = require("node:crypto");
const path = require("node:path");
const storage = require("./r2StorageService");
const fail = (message, status) => Object.assign(new Error(message), { status });

async function upload(req, { published = false } = {}) {
  if (!storage.isConfigured()) throw fail("R2 storage is unavailable. No file was saved locally.", 503);
  if (published && !storage.getStatus().publicAssetsReady) throw fail("Campaign uploads require a separate public R2 bucket and HTTPS asset domain. You can attach an existing hosted HTTPS URL instead.", 409);
  if (!req.file) throw fail("No file provided", 400);
  if (!Number.isSafeInteger(Number(req.tenantId)) || Number(req.tenantId) <= 0) throw fail("Organization context required", 403);
  const ext = path.extname(req.file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, "").slice(0, 12);
  const folder = published ? "public-assets" : "assets";
  const key = `tenants/${req.tenantId}/${folder}/${crypto.randomUUID()}${ext}`;
  const result = await storage.uploadMedia(req.file.buffer, key, req.file.mimetype, { published });
  if (!result.success) throw fail("R2 upload failed. No local fallback file was created.", 502);
  const type = req.file.mimetype.startsWith("image/") ? "image" : req.file.mimetype.startsWith("video/") ? "video" : req.file.mimetype.startsWith("audio/") ? "audio" : "document";
  const url=published?result.url:`${result.url}?tenant_id=${req.tenantId}`;
  return { url, key, storage: "cloudflare-r2", published, media_type: type, filename: req.file.originalname, size: req.file.size, mimetype: req.file.mimetype };
}

function ownsKey(tenantId, key) {
  return typeof key === "string" && new RegExp(`^tenants/${Number(tenantId)}/(?:assets|public-assets)/[a-f0-9-]{36}(?:\\.[a-z0-9.]{1,11})?$`).test(key);
}

module.exports = { upload, ownsKey };
