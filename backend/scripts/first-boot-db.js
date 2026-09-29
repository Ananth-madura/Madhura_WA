// First-boot DB auto-setup — runs on every launcher start (idempotent).
// Finds a working MySQL root password, saves it to backend/.env and creates
// the achme_wa database if missing, so a fresh clone can log in with
// admin@madhuratech.com / admin@123 with zero manual DB work.
// Uses only mysql2 (a backend dependency) — no mysql CLI needed.
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2");

const envPath = path.join(__dirname, "..", ".env");

function loadEnv() {
  const out = {};
  if (!fs.existsSync(envPath)) return out;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith("#")) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

function savePass(newPass) {
  let text = fs.readFileSync(envPath, "utf8");
  if (/^DB_PASS=.*/m.test(text)) {
    text = text.replace(/^DB_PASS=.*/m, `DB_PASS=${newPass}`);
  } else {
    text += `\nDB_PASS=${newPass}\n`;
  }
  fs.writeFileSync(envPath, text);
  console.log("[first-boot-db] Saved working MySQL password to backend/.env");
}

function tryConnect(cfg) {
  return new Promise((resolve) => {
    const c = mysql.createConnection({ ...cfg, connectTimeout: 4000 });
    c.connect((err) => {
      if (err) { try { c.destroy(); } catch (_) {} return resolve({ ok: false, error: err }); }
      resolve({ ok: true, conn: c });
    });
  });
}

(async () => {
  const env = loadEnv();
  const base = {
    host: env.DB_HOST || "127.0.0.1",
    port: Number(env.DB_PORT) || 3306,
    user: env.DB_USER || "root",
  };
  const dbName = env.DB_NAME || "achme_wa";
  const candidates = [];
  for (const p of [env.DB_PASS, "root", "admin@123", "", "password", "mysql", "root123"]) {
    if (p !== undefined && !candidates.includes(p)) candidates.push(p);
  }

  for (const pass of candidates) {
    const { ok, conn, error } = await tryConnect({ ...base, password: pass });
    if (!ok) {
      // Wrong password → try next. Anything else (server down) → stop, backend will report it.
      if (error && (error.code === "ER_ACCESS_DENIED_ERROR" || error.code === "ER_ACCESS_DENIED_NO_PASSWORD_ERROR")) continue;
      console.error(`[first-boot-db] Cannot reach MySQL at ${base.host}:${base.port} (${error.message}). Start MySQL/XAMPP and re-run.`);
      process.exit(2);
    }
    if (pass !== env.DB_PASS) savePass(pass);
    await new Promise((resolve) => {
      conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName.replace(/`/g, "``")}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`, (e) => {
        if (e) console.error(`[first-boot-db] CREATE DATABASE failed: ${e.message}`);
        else console.log(`[first-boot-db] Database "${dbName}" ready.`);
        conn.end(() => resolve());
      });
    });
    console.log("[first-boot-db] OK — backend will seed tables + admin on boot.");
    process.exit(0);
  }

  console.error("[first-boot-db] None of the tried passwords worked for MySQL user " + JSON.stringify(base.user) + ".");
  console.error("  Fix: set the correct DB_PASS in backend/.env (your MySQL root password) and re-run the launcher.");
  process.exit(2);
})().catch((e) => {
  console.error("[first-boot-db] Unexpected error:", e.message);
  process.exit(2);
});
