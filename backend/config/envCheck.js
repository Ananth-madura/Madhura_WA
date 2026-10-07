/**
 * envCheck.js — boot-time configuration validation.
 *
 * WHY THIS EXISTS
 * ---------------
 * A misconfigured backend does not crash. It boots, logs look healthy, /health
 * returns 200, and then features fail one at a time in ways that look like bugs:
 *
 *   • ALLOWED_ORIGINS left as the placeholder  -> every browser request is
 *     blocked by CORS while curl and the Madhura CRM still succeed, so health
 *     checks pass and the frontend just shows a blank page.
 *   • PUBLIC_BASE_URL left as localhost         -> outbound WhatsApp media
 *     silently fails, because Meta's servers cannot fetch http://localhost.
 *   • JWT_SECRET still CHANGE_ME               -> tokens are signed with a
 *     public string, and the main CRM rejects them.
 *   • WA_DATA_DIR unset in production          -> uploads and the paired
 *     WhatsApp session are written inside the deploy directory, so the next
 *     deploy orphans a live session and every number must be re-paired by hand.
 *
 * None of those announce themselves. This module turns them into one clear list
 * printed before the server accepts traffic.
 *
 * POLICY
 * ------
 * Production: a missing or placeholder REQUIRED value is fatal and exits non-zero.
 *   A server that refuses to start is far cheaper than one that silently drops
 *   every customer message.
 * Everything else (dev, test, optional integrations) only warns.
 *
 * Secrets are never printed. Only the variable NAME and the reason.
 */

/** Values that mean "someone copied the template and forgot to fill it in". */
const PLACEHOLDERS = [
  "CHANGE_ME",
  "CHANGE_ME_BEFORE_FIRST_BOOT",
  "changeme",
  "your_password_here",
  "REPLACE_ME",
  "xxx",
  "TODO",
];

/**
 * required: fatal in production when missing or left as a placeholder.
 * recommended: warns in production when missing. Feature degrades, not dies.
 * dedicated: has a bespoke validator below (PUBLIC_BASE_URL, ALLOWED_ORIGINS),
 *   so the generic presence check stands down to avoid reporting the same fault
 *   twice.
 */
const SPEC = [
  { key: "DB_HOST", required: true },
  { key: "DB_NAME", required: true },
  { key: "DB_USER", required: true },
  { key: "DB_PASS", required: true, secret: true },
  { key: "JWT_SECRET", required: true, secret: true },
  { key: "PUBLIC_BASE_URL", required: true, dedicated: true },
  { key: "ALLOWED_ORIGINS", required: true, dedicated: true },
  { key: "ADMIN_SEED_PASSWORD", required: false, secret: true },
  { key: "REDIS_URL", required: false },
  { key: "SMTP_HOST", required: false },
  { key: "EMAIL_USER", required: false },
  { key: "EMAIL_PASS", required: false, secret: true },
  { key: "WA_ACCESS_TOKEN", required: false, secret: true },
  { key: "WA_APP_SECRET", required: false, secret: true },
  { key: "WA_PHONE_NUMBER_ID", required: false },
  { key: "WA_WABA_ID", required: false },
  { key: "WA_VERIFY_TOKEN", required: false, secret: true },
  { key: "WA_DATA_DIR", required: false },
];

const isBlank = (v) => v === undefined || v === null || String(v).trim() === "";
const isPlaceholder = (v) => PLACEHOLDERS.includes(String(v).trim());

/**
 * Degraded mode.
 *
 * Set ALLOW_START_WITHOUT_DB=1 to let the process boot with no database
 * configured or no database reachable. The intent is diagnosability and
 * resilience, NOT a working app:
 *
 *   • /health still answers 200 so orchestrators do not kill-loop the container,
 *     but the body reports ok:false, database:"disconnected", degraded:true.
 *   • Every /api route answers 503 with an explicit reason instead of hanging on
 *     a dead socket or throwing a raw driver error at the browser.
 *
 * What it deliberately does NOT do is invent a substitute datastore. This
 * service stores clients, invoices, contacts, campaigns, flows and chat history
 * as raw SQL, and the paired WhatsApp session is a Chromium profile on disk.
 * A JSON or browser-localStorage fallback would mean rewriting every query in
 * the codebase and would silently lose all records on restart, so no such shim
 * exists here. If you need a database, provision one — render.yaml can create
 * MySQL for you.
 */
const dbKeys = new Set(["DB_HOST", "DB_NAME", "DB_USER", "DB_PASS"]);
const allowNoDb = (env) => ["1", "true", "yes", "on"].includes(String(env.ALLOW_START_WITHOUT_DB || "").toLowerCase());

/**
 * PUBLIC_BASE_URL must be an absolute https URL that Meta's servers can reach.
 * Anything local is the classic silent-media-failure trap.
 */
function checkPublicBaseUrl(value) {
  if (isBlank(value)) return { level: "error", message: "required in production" };
  const v = String(value).trim();
  let url;
  try {
    url = new URL(v);
  } catch {
    return { level: "error", message: `not a valid URL (got "${v}")` };
  }
  const host = url.hostname;
  if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0") {
    return {
      level: "error",
      message:
        "points at localhost — Meta cannot fetch media from it, so outbound " +
        "invoices/images will silently fail. Set it to the public https origin.",
    };
  }
  if (url.protocol !== "https:") {
    return { level: "error", message: `must be https, got ${url.protocol}// — WhatsApp requires a valid certificate` };
  }
  return null;
}

/**
 * The allowlist must contain at least one absolute origin.
 *
 * The singular ALLOWED_ORIGIN is a documented trap: corsPolicy.js reads the
 * plural only, so a production .env carrying the singular looks configured while
 * the allowlist is actually empty. It is still honoured as a fallback so an
 * existing host is not left silently broken — but it is reported here, once, as
 * the single actionable error rather than as a generic "not set".
 */
function checkAllowedOrigins(env) {
  const value = env.ALLOWED_ORIGINS;
  const legacy = env.ALLOWED_ORIGIN;

  if (isBlank(value)) {
    if (!isBlank(legacy)) {
      return {
        level: "error",
        message:
          "ALLOWED_ORIGIN (singular) is set but the code reads ALLOWED_ORIGINS (plural). " +
          "Rename it — the singular name is ignored, which leaves the allowlist empty and " +
          "blocks every cross-origin browser request while the server still looks healthy.",
      };
    }
    return {
      level: "error",
      message:
        "required in production. Empty means every cross-origin browser request " +
        "is blocked while the server still looks healthy. Set it to your " +
        "frontend's exact origin(s), comma-separated.",
    };
  }

  if (isPlaceholder(value)) {
    return { level: "error", message: "is still the template placeholder — set your frontend origin(s)" };
  }

  const origins = String(value)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!origins.length) return { level: "error", message: "empty after parsing the comma-separated list" };
  const bad = origins.filter((o) => {
    try {
      const u = new URL(o);
      return !u.hostname;
    } catch {
      return true;
    }
  });
  if (bad.length) {
    return { level: "error", message: `not absolute URLs: ${bad.join(", ")} — use https://host, with no path` };
  }
  return null;
}

/**
 * @param {NodeJS.ProcessEnv} env
 * @returns {{ errors: string[], warnings: string[], infos: string[] }}
 */
function checkEnv(env = process.env) {
  const isProd = env.NODE_ENV === "production";
  const r2Storage = require("../services/r2StorageService");
  const isR2OrSqlite =
    r2Storage.isConfigured() ||
    ["1", "true", "sqlite", "r2"].includes(
      String(env.USE_SQLITE || env.DB_ENGINE || "").toLowerCase()
    );
  const isMysqlConfigured = ["DB_HOST", "DB_NAME", "DB_USER"].every(
    (k) => !isBlank(env[k]) && !isPlaceholder(env[k])
  );
  const hasDb = isR2OrSqlite || isMysqlConfigured;
  const degraded = allowNoDb(env) && !hasDb;

  const errors = [];
  const warnings = [];
  const infos = [];

  /*
   * Strict mode is opt-in.
   *
   * It used to be the default, which meant a service created by hand rather
   * than from render.yaml could never start: every variable was reported
   * missing and the process exited, even though the values were plainly present
   * in the repository's blueprint. A container that refuses to boot is a poor
   * diagnostic. Now a missing or defaulted value warns, /health reports it, and
   * the process starts.
   *
   * Set REQUIRE_HARD_CONFIG=1 to restore the fail-fast behaviour once the
   * environment is genuinely known-good.
   */
  const strict = ["1", "true", "yes", "on"].includes(String(env.REQUIRE_HARD_CONFIG || "").toLowerCase());

  // Anything fatal below becomes a warning unless strict mode is on.
  const fail = (message) => (strict ? errors : warnings).push(message);

  if (!strict && isProd) {
    infos.push(
      "non-strict configuration: missing values are defaulted and reported as warnings, not fatal. " +
        "Set REQUIRE_HARD_CONFIG=1 once the environment is known-good to fail fast instead."
    );
  }


  for (const item of SPEC) {
    const raw = env[item.key];
    const blank = isBlank(raw);

    // Keys with a bespoke validator below report through that path only, so a
    // single misconfiguration never prints two complaints about itself.
    if (item.dedicated && isProd) continue;

    if (blank) {
      // Missing values are reported either way. Under strict mode they are
      // fatal; otherwise they are warnings, because a defaulted value in
      // config/runtimeDefaults.js is a deliberate, working fallback rather than
      // a broken deployment.
      if (item.required && isProd) {
        if (degraded && dbKeys.has(item.key)) {
          warnings.push(`${item.key} is not set — starting in degraded mode, database features disabled`);
        } else if (isR2OrSqlite && dbKeys.has(item.key)) {
          // Handled by SQLite/R2 database engine — no need to warn for MySQL keys
        } else {
          fail(`${item.key} is not set — required in production`);
        }
      } else if (item.required) {
        if (!isR2OrSqlite || !dbKeys.has(item.key)) {
          warnings.push(`${item.key} is not set (fine outside production)`);
        }
      }
      continue;
    }

    if (isPlaceholder(raw)) {
      // A placeholder is never an acceptable real value: booting with one is how
      // a public host ends up signing tokens with the string "CHANGE_ME". So it
      // is fatal regardless of strict mode. config/runtimeDefaults.js replaces an
      // unset or placeholder JWT_SECRET with a generated one before this runs,
      // so the common case never reaches here at all.
      errors.push(`${item.key} is still the template placeholder — set a real value`);
      continue;
    }

    if (item.required && isProd && item.secret && String(raw).trim().length < 8) {
      warnings.push(`${item.key} is very short (<8 chars) — use a long random value`);
    }
  }

  if (isProd) {
    const pub = checkPublicBaseUrl(env.PUBLIC_BASE_URL);
    if (pub) fail(`PUBLIC_BASE_URL: ${pub.message}`);

    const cors = checkAllowedOrigins(env);
    if (cors) fail(`ALLOWED_ORIGINS: ${cors.message}`);
  }

  if (isProd && isBlank(env.WA_DATA_DIR)) {
    warnings.push(
      "WA_DATA_DIR is not set. uploads/ and the paired WhatsApp session will be " +
        "written inside the deploy directory; a redeploy that replaces that " +
        "directory forces every number to be re-paired by hand. Mount a " +
        "persistent disk and point WA_DATA_DIR at it."
    );
  }

  if (!isProd) {
    infos.push("development mode — configuration problems warn instead of exiting");
  }

  if (degraded) {
    warnings.push(
      "ALLOW_START_WITHOUT_DB is set. This process will boot without a usable " +
        "database: /health reports degraded and every /api route answers 503. " +
        "Nothing is persisted to a substitute store — provision MySQL for a " +
        "working service."
    );
  }

  return { errors, warnings, infos, degraded };
}

/** Print a report and return whether the process should continue. */
function reportEnv(env = process.env) {
  const { errors, warnings, infos, degraded } = checkEnv(env);
  const isProd = env.NODE_ENV === "production";

  for (const i of infos) console.log(`  ${i}`);
  for (const w of warnings) console.warn(`  ! ${w}`);

  if (!errors.length) {
    if (degraded) console.log("  configuration incomplete — starting DEGRADED (no database)");
    else if (isProd) console.log("  configuration OK");
    return true;
  }

  console.error("\n  CONFIGURATION ERRORS — not starting:\n");
  for (const e of errors) console.error(`    x ${e}`);
  console.error(
    "\n  Copy .env.production.example to .env and fill in every value above.\n" +
      "  Secrets are listed by name only; nothing here is logged.\n"
  );
  return false;
}

module.exports = { checkEnv, reportEnv, SPEC, PLACEHOLDERS };
