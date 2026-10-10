/** Development defaults only. Production validates the supplied configuration
 * and requires stable externally configured secrets and deployment URLs. */

const crypto = require("crypto");

const truthy = (v) => ["1", "true", "yes", "on"].includes(String(v ?? "").toLowerCase());

/**
 * Apply defaults in place. Returns a summary for logging and for /health, so a
 * defaulted deployment is visible rather than silent.
 */
function applyDefaults(env = process.env) {
  const applied = [];

  /*
   * Strict mode disables defaulting entirely.
   *
   * These two features are mutually exclusive, and silently letting both run made
   * REQUIRE_HARD_CONFIG=1 a no-op: applyDefaults filled every gap first, so
   * config/envCheck.js then found nothing missing and reported "configuration
   * OK" on a completely unconfigured host. Under strict mode the environment is
   * validated exactly as provided, which is the only way that check can mean
   * anything.
   */
  if (env.NODE_ENV === "production" || truthy(env.REQUIRE_HARD_CONFIG)) {
    return {
      applied,
      ephemeralJwt: { ephemeral: false, reason: null },
      strict: true,
    };
  }

  const set = (key, value, why) => {
    if (env[key] !== undefined && String(env[key]).trim() !== "") return;
    env[key] = value;
    applied.push({ key, value, why });
  };

  // ── runtime ───────────────────────────────────────────────────────────────
  set("PORT", "5001", "default listen port");
  set("TZ", "Asia/Kolkata", "business timezone");
  set("WA_MESSAGE_INTERVAL", "2000", "2s between outbound messages");
  set("WA_MAX_SESSIONS", "15", "concurrent WhatsApp Web sessions");
  set("WA_HEADLESS", "true", "Chromium runs headless");
  set("WA_ENABLE_WEB_ENGINE", "1", "WhatsApp Web engine on (set 0 for small instances)");
  set("RENDER_KEEP_ALIVE_MINUTES", "7", "interval in minutes to ping /health and prevent Render from sleeping");

  // ── public URLs ───────────────────────────────────────────────────────────
  // Public hostnames, not secrets. Both point at the live Render deployment;
  // override if the domain changes.
  //
  // PUBLIC_BASE_URL matters more than it looks: it is what turns a stored
  // relative media path (/uploads/wa-media/x.pdf) into an absolute link, and it is
  // Meta's Cloud API servers that fetch those links. Pointing it at the old VPS
  // domain made every outbound invoice and image fail silently.
  set("PUBLIC_BASE_URL", "https://madhura-wa-backend.onrender.com", "public base URL of this backend");
  set(
    "ALLOWED_ORIGINS",
    "https://madhura-wa.vercel.app,https://madhura-ohyc9pp2x-madhura.vercel.app,https://*-madhura.vercel.app,https://madhura-*.vercel.app,https://madhura-wa-frontend.vercel.app,https://crm.madhuratech.com,http://localhost:3000,http://localhost:3001,http://localhost:5173",
    "frontend origins allowed to call this API"
  );

  // ── boot behaviour ────────────────────────────────────────────────────────
  // Boot even with no database: /health reports degraded and /api answers 503.
  // A container that refuses to start tells you far less than one that starts
  // and explains itself.
  set("ALLOW_START_WITHOUT_DB", "1", "boot degraded rather than crash-loop when the DB is missing");

  // ── database ──────────────────────────────────────────────────────────────
  set("DB_HOST", "127.0.0.1", "localhost database");
  set("DB_PORT", "3306", "standard MySQL port");

  // ── runtime state ─────────────────────────────────────────────────────────
  // /var/data is what the Dockerfile creates and chowns to the node user. Left
  // unset it would resolve to a path the process may not be able to write.
  set("WA_DATA_DIR", "/var/data", "persistent state location (matches the Dockerfile)");

  return { applied, ephemeralJwt: ensureJwtSecret(env), strict: false };
}

const JWT_PLACEHOLDERS = new Set(["CHANGE_ME", "changeme", "secret", "TODO", "REPLACE_ME", ""]);

/**
 * Guarantee a usable JWT signing key.
 *
 * When none is configured, generate one rather than refusing to boot. A
 * hardcoded fallback would be a public string published in the repository, and
 * anyone reading it could mint valid tokens. A per-process random value cannot
 * be leaked from the repo, because it is not in the repo.
 *
 * The cost is that restarting invalidates existing tokens. That is reported in
 * the boot log and in /health so nobody is surprised by it.
 */
function ensureJwtSecret(env = process.env) {
  const current = env.JWT_SECRET;
  if (current && !JWT_PLACEHOLDERS.has(String(current).trim())) {
    return { ephemeral: false, reason: null };
  }
  if (current !== undefined && String(current).trim() === "") {
    // Present but empty: treat as unset rather than as a real (zero-length) key.
  }
  env.JWT_SECRET = crypto.randomBytes(48).toString("hex");
  return {
    ephemeral: true,
    reason:
      "JWT_SECRET was not configured, so a random one was generated for this process only. " +
      "Tokens are invalidated on every restart. Set a real JWT_SECRET in the environment " +
      "before running this anywhere that matters.",
  };
}

module.exports = { applyDefaults, ensureJwtSecret, truthy };
