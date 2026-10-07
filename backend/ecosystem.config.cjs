/**
 * PM2 process definition — Whatsapp_CRM backend on the Hostinger VPS.
 *
 *   npm i -g pm2
 *   pm2 start ecosystem.config.cjs
 *   pm2 save && pm2 startup      # survives a reboot
 *
 * Key decisions and why:
 *
 *  - instances: 1, exec_mode: "fork". NOT cluster. This app holds a WhatsApp
 *    Web session, which is a stateful Chromium profile with a lock file. Two
 *    forks would fight over the same profile and one would crash-loop. If you
 *    ever need more throughput, scale the whole box, not the fork count.
 *
 *  - max_memory_restart: 2G. Puppeteer/Chromium is the memory hog; a leak here
 *    is the difference between a healthy inbox and a dead one at 3am.
 *
 *  - The persistent dirs (whatsapp-sessions/, uploads/, .env) live OUTSIDE the
 *    deploy directory and are bind-mounted in via env, so `git pull` deploys
 *    never touch them. This is the single most important thing in this file.
 *
 *  - ENABLE_CHROME is not a thing; PUPPETEER_* are read by .puppeteerrc.cjs.
 *    skipDownload is true in that file, so Chrome is installed ONCE by
 *    deploy.sh (PUPPETEER_SKIP_DOWNLOAD=false) rather than on every npm ci.
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

      // Fork, not cluster — see note above about the Chromium session profile.
      instances: 1,
      exec_mode: "fork",

      // Node 20 LTS (matches frontend/.nvmrc). Node 18 also works.
      node_args: "--max-old-space-size=1536",
      exec_interpreter: "node",

      // Restart policy: crash always, in-flight requests get a moment to drain.
      autorestart: true,
      max_restarts: 15,
      restart_delay: 3000,
      exp_backoff_restart_delay: 200,
      kill_timeout: 8000,
      listen_timeout: 10000,
      wait_ready: false,
      max_memory_restart: "2G",

      env: {
        NODE_ENV: "production",
        PORT: "5001",

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
        NODE_OPTIONS: "--max-old-space-size=1536",
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
