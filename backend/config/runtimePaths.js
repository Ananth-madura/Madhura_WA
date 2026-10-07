/**
 * Runtime path resolution — the single source of truth for where mutable state
 * lives on disk.
 *
 * WHY THIS EXISTS
 * ---------------
 * The backend is deployed to the VPS with `git pull`. That means the code
 * directory is disposable: it can be deleted and replaced on any deploy. But
 * two directories are NOT disposable:
 *
 *   uploads/            every invoice PDF, brochure and campaign image
 *   whatsapp-sessions/  the paired WhatsApp login — a full Chromium profile
 *
 * If either lives inside the repo, a deploy can orphan a live WhatsApp session,
 * which means an operator has to walk to the phone and re-scan a QR for every
 * number the business runs. That is the single worst failure mode this
 * deployment can have, so the paths are env-overridable and default to the
 * original repo-relative locations for local development.
 *
 * USAGE
 *   const { uploadsDir, mediaDir, cloudMediaDir, sessionsDir } = require("./config/runtimePaths");
 *
 * On the VPS, set WA_DATA_DIR (see ecosystem.config.cjs) and every path moves
 * out of the deploy directory automatically.
 */

const path = require("path");
const fs = require("fs");

const BACKEND_ROOT = path.join(__dirname, "..");

// Optional single knob: set WA_DATA_DIR and everything lands under it.
const DATA_DIR = process.env.WA_DATA_DIR ? path.resolve(process.env.WA_DATA_DIR) : null;

const resolve = (envValue, fallback) => (envValue ? path.resolve(envValue) : fallback);

const uploadsDir = resolve(
  process.env.WA_UPLOADS_DIR,
  DATA_DIR ? path.join(DATA_DIR, "uploads") : path.join(BACKEND_ROOT, "uploads")
);

/** Media that came in over HTTP and must be fetchable by Meta. */
const mediaDir = resolve(
  process.env.WA_MEDIA_DIR,
  DATA_DIR ? path.join(DATA_DIR, "uploads", "wa-media") : path.join(BACKEND_ROOT, "uploads", "wa-media")
);

/** Media downloaded from the Cloud API on the way in. */
const cloudMediaDir = resolve(
  process.env.WA_CLOUD_MEDIA_DIR,
  DATA_DIR ? path.join(DATA_DIR, "uploads", "wa-media", "cloud") : path.join(BACKEND_ROOT, "uploads", "wa-media", "cloud")
);

/** One Chromium profile per paired WhatsApp number. Never commit, never deploy. */
const sessionsDir = resolve(
  process.env.WA_SESSIONS_DIR,
  DATA_DIR
    ? path.join(DATA_DIR, "whatsapp-sessions")
    : path.join(BACKEND_ROOT, "..", "whatsapp-sessions")
);

/** Where deploy.sh keeps database dumps taken before each deploy. */
const backupDir = resolve(
  process.env.WA_BACKUP_DIR,
  DATA_DIR ? path.join(DATA_DIR, "backups") : path.join(BACKEND_ROOT, "..", "backups")
);

const logsDir = resolve(
  process.env.WA_LOGS_DIR,
  DATA_DIR ? path.join(DATA_DIR, "logs") : path.join(BACKEND_ROOT, "..", "logs")
);

/**
 * Create everything. Called from server.js at boot. Uses mode 0o750 because
 * uploads and session profiles contain customer data and must not be
 * world-readable on a shared host.
 */
const ensureRuntimeDirs = () => {
  for (const dir of [uploadsDir, mediaDir, cloudMediaDir, sessionsDir, logsDir, backupDir]) {
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o750 });
    } catch (err) {
      console.error(`? runtimePaths: could not create ${dir} — ${err.message}`);
    }
  }
};

const isExternalState = () => Boolean(DATA_DIR);

module.exports = {
  backendRoot: BACKEND_ROOT,
  dataDir: DATA_DIR,
  uploadsDir,
  mediaDir,
  cloudMediaDir,
  sessionsDir,
  backupDir,
  logsDir,
  ensureRuntimeDirs,
  isExternalState,
};
