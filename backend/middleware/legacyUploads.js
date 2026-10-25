"use strict";

function enabled() {
  return process.env.WA_LEGACY_PUBLIC_UPLOADS === "1" ||
    (process.env.NODE_ENV !== "production" && process.env.WA_LEGACY_PUBLIC_UPLOADS !== "0");
}

function requireLegacyUploads(req, res, next) {
  if (!enabled()) return res.status(409).json({
    error: "Public file uploads are disabled. Use a hosted HTTPS campaign media URL or send the attachment directly through WhatsApp.",
    code: "PUBLIC_UPLOADS_DISABLED",
  });
  next();
}

module.exports = { enabled, requireLegacyUploads };
