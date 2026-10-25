/**
 * PM2 process definition — Whatsapp_CRM backend on the Hostinger VPS.
 *
 *   npm i -g pm2
 *   pm2 start ecosystem.config.cjs
 *   pm2 save && pm2 startup      # survives a reboot
 *
 * Cloud API pilot profile for a 4 GB VM shared with MySQL.
 * One process owns in-memory assistant queues and rate controls. Adding PM2
 * instances requires distributed event delivery and worker/scheduler ownership.
 * The 768 MB heap and 1100 MB RSS restart threshold are resource fuses, not a
 * throughput guarantee. Persistent state stays outside the checkout.
 */

const path = require("path");

const APP_DIR = path.resolve(__dirname);

// Persistent state, deliberately outside APP_DIR.
const DATA_DIR = process.env.WA_DATA_DIR || "/home/wauser/wa-data";

module.exports = {
  apps: [
    {
      name: "wa-crm-backend",
      script: path.join(APP_DIR, "server.js"),
      cwd: APP_DIR,

      // The assistant queue and local admission counters have one process owner.
      instances: 1,
      exec_mode: "fork",

      // Use the declared Node 24 runtime.
      node_args: "--max-old-space-size=768",
      exec_interpreter: "node",

      // Restart policy: crash always, in-flight requests get a moment to drain.
      autorestart: true,
      max_restarts: 15,
      restart_delay: 3000,
      exp_backoff_restart_delay: 200,
      kill_timeout: 35000,
      listen_timeout: 10000,
      wait_ready: false,
      max_memory_restart: "1100M",

      env: {
        NODE_ENV: "production",
        PORT: "5001",
        DB_ENGINE: "mysql",
        USE_SQLITE: "0",
        REQUIRE_HARD_CONFIG: "1",
        ALLOW_START_WITHOUT_DB: "0",
        WA_ENABLE_WEB_ENGINE: "0",
        WA_SERVER_CHAT_STORAGE: "0",
        WA_LEGACY_PUBLIC_UPLOADS: "0",
        AUTH_BROWSER_COOKIES: "1",

        // ── PERSISTENT STATE (survives git pull) ────────────────────────────
        // whatsapp-web.js reads PuppeteerProfile path from these.
        WA_DATA_DIR: DATA_DIR,
        WA_SESSIONS_DIR: path.join(DATA_DIR, "whatsapp-sessions"),
        WA_UPLOADS_DIR: path.join(DATA_DIR, "uploads"),
        WA_BACKUP_DIR: path.join(DATA_DIR, "backups"),

        // ── CHROME ─────────────────────────────────────────────────────────
        // Must match what deploy.sh installed, or Puppeteer cannot launch.
        PUPPETEER_CACHE_DIR: path.join(DATA_DIR, ".cache", "puppeteer"),
        PUPPETEER_EXECUTABLE_PATH: process.env.PUPPETEER_EXECUTABLE_PATH || "",

        // ── RUNTIME ────────────────────────────────────────────────────────
        TZ: "Asia/Kolkata",
        NODE_OPTIONS: "--max-old-space-size=768",
      },

      // NOTE: dotenv runs with override:false, so anything exported by
      // `pm2 restart ecosystem.config.cjs --update-env` from your shell wins
      // over .env. Your .env on the VPS remains the source of truth for
      // DB_*, JWT_SECRET, ALLOWED_ORIGINS, REDIS_URL and the Meta keys.

      out_file: path.join(DATA_DIR, "logs", "out.log"),
      error_file: path.join(DATA_DIR, "logs", "error.log"),
      merge_logs: true,
      time: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",

      // pm2-logrotate is not installed by default. Without it these files grow
      // until the disk fills and MySQL starts failing writes.
      //   pm2 i pm2-logrotate && pm2 set pm2-logrotate:max_size 20M
    },
  ],
};
