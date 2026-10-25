/**
 * runtimeDefaults.js — zero-config resilient runtime defaulting.
 *
 * Automatically defaults non-secret configuration and generates ephemeral
 * secrets (JWT_SECRET, SMTP_ENCRYPTION_KEY) when unconfigured, allowing
 * zero-config deployments on Render, Railway, containers, and local dev.
 *
 * Set REQUIRE_HARD_CONFIG=1 to enforce strict validation and fail fast instead.
 */

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
   * Only active when REQUIRE_HARD_CONFIG=1 is explicitly requested.
   */
  if (truthy(env.REQUIRE_HARD_CONFIG)) {
    return {
      applied,
      ephemeralJwt: { ephemeral: false, reason: null },
      ephemeralSmtp: { ephemeral: false, reason: null },
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
  const renderHost = env.RENDER_EXTERNAL_HOSTNAME
    ? `https://${env.RENDER_EXTERNAL_HOSTNAME}`
    : "https://madhura-wa-backend.onrender.com";
  set("PUBLIC_BASE_URL", renderHost, "public base URL of this backend");
  set(
    "ALLOWED_ORIGINS",
    "https://madhura-wa.vercel.app,https://madhura-ohyc9pp2x-madhura.vercel.app,https://*-madhura.vercel.app,https://madhura-*.vercel.app,https://madhura-wa-frontend.vercel.app,https://crm.madhuratech.com,http://localhost:3000,http://localhost:3001,http://localhost:5173",
    "frontend origins allowed to call this API"
  );

  // ── boot behaviour ────────────────────────────────────────────────────────
  set("ALLOW_START_WITHOUT_DB", "1", "boot degraded rather than crash-loop when the DB is missing");

  // ── database ──────────────────────────────────────────────────────────────
  const hasMysql = Boolean(env.DB_HOST && env.DB_NAME && env.DB_USER && env.DB_PASS);
  if (!hasMysql && String(env.DB_ENGINE || "").toLowerCase() !== "mysql" && !truthy(env.DISABLE_R2)) {
    set("USE_SQLITE", "1", "auto-enable SQLite persistence when MySQL is not provided");
    set("DB_ENGINE", "r2", "dual adaptive storage engine");
  } else {
    set("DB_HOST", "127.0.0.1", "localhost database");
    set("DB_PORT", "3306", "standard MySQL port");
  }

  // ── admin seed ────────────────────────────────────────────────────────────
  set("ADMIN_SEED_PASSWORD", "Admin@123", "default admin seed password for zero-config instances");

  // ── runtime state ─────────────────────────────────────────────────────────
  set("WA_DATA_DIR", "/var/data", "persistent state location (matches the Dockerfile)");

  const ephemeralJwt = ensureJwtSecret(env);
  const ephemeralSmtp = ensureSmtpEncryptionKey(env);

  return { applied, ephemeralJwt, ephemeralSmtp, strict: false };
}

const JWT_PLACEHOLDERS = new Set(["CHANGE_ME", "changeme", "secret", "TODO", "REPLACE_ME", ""]);

/**
 * Guarantee a usable JWT signing key.
 *
 * When none is configured, generate one rather than refusing to boot.
 */
function ensureJwtSecret(env = process.env) {
  const current = env.JWT_SECRET;
  if (current && !JWT_PLACEHOLDERS.has(String(current).trim())) {
    return { ephemeral: false, reason: null };
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

/**
 * Guarantee a usable 32-byte SMTP encryption key.
 *
 * If not configured or set to a placeholder, generate a random 32-byte key (64 hex characters)
 * so encryption works and boot validation passes.
 */
function ensureSmtpEncryptionKey(env = process.env) {
  const current = env.SMTP_ENCRYPTION_KEY;
  if (current && !JWT_PLACEHOLDERS.has(String(current).trim())) {
    const trimmed = String(current).trim();
    if (Buffer.byteLength(trimmed) === 32 || /^[a-f0-9]{64}$/i.test(trimmed)) {
      return { ephemeral: false, reason: null };
    }
  }
  env.SMTP_ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");
  return {
    ephemeral: true,
    reason:
      "SMTP_ENCRYPTION_KEY was not configured, so an ephemeral 32-byte key was generated for this process.",
  };
}

module.exports = { applyDefaults, ensureJwtSecret, ensureSmtpEncryptionKey, truthy };
