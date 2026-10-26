// ─────────────────────────────────────────────────────────────────────────────
// Whatsapp_CRM backend — standalone WhatsApp service.
// Forked from MADHURA_CRM/backend/server.js. Only WhatsApp routes + schedulers.
// Shares NO code with the CRM at runtime (shared files were duplicated here so
// every require() resolves locally — see DIVERGENCE NOTE in README.md).
// ─────────────────────────────────────────────────────────────────────────────
const path = require("path");
// NOTE: override:false (the default) so a real process environment wins over .env.
// That is what lets a VPS inject env vars (systemd / PM2 / panel) without .env
// silently clobbering them. Local dev sets no env vars, so .env still wins there.
// WA_SKIP_DOTENV exists so a container with no .env — and a test that wants to
// assert true zero-config behaviour — can prove the defaults carry the process on
// their own. Without it, a developer's local .env silently supplies the very
// variables under test, and the test passes for the wrong reason. That is not
// hypothetical: it is how a missing DB_NAME crash went unnoticed locally.
if (["1", "true", "yes", "on"].includes(String(process.env.WA_SKIP_DOTENV || "").toLowerCase())) {
  console.log("ℹ️  WA_SKIP_DOTENV set — not loading .env");
} else {
  require("dotenv").config({ path: path.join(__dirname, ".env") });
}

// Apply defaults BEFORE anything reads configuration, and before validation, so
// the service comes up on a host where no environment variables were injected at
// all. Without this, a service created by hand rather than from render.yaml
// refused to boot with every variable reported missing — including values that
// were plainly present in the repository's blueprint. A real environment
// variable always wins; these are fallbacks. See config/runtimeDefaults.js for
// what is defaulted and, more importantly, what deliberately is not.
const { applyDefaults } = require("./config/runtimeDefaults");
const defaults = applyDefaults(process.env);
if (defaults.applied.length) {
  console.log(`\nℹ️  ${defaults.applied.length} configuration value(s) defaulted (no environment was provided):`);
  for (const d of defaults.applied) console.log(`   ${d.key.padEnd(24)} ${d.why}`);
}
if (defaults.ephemeralJwt?.ephemeral && defaults.ephemeralJwt?.reason) {
  console.warn(`\n⚠️  ${defaults.ephemeralJwt.reason}\n`);
}

// ── Validate configuration before anything has a side effect ────────────────
// Deliberately placed ABOVE `require("./config/database")`: opening the database
// starts a 15-attempt connection retry loop and spins up the SMTP verifier, so
// validating afterwards means a misconfigured host waits through all of that
// before being told what is wrong.
//
// dotenv has already run (line above), so .env values are visible while a real
// process environment still wins over the file.
//
// This used to be a bare ["DB_HOST","DB_USER","DB_PASS","DB_NAME","JWT_SECRET"]
// presence check. Presence is not enough: a template value left as CHANGE_ME is
// "present" and still broken. config/envCheck.js also rejects placeholders and
// validates PUBLIC_BASE_URL and the CORS allowlist — the two settings that fail
// silently, with a healthy-looking server and a blank frontend.
const { reportEnv } = require("./config/envCheck");
console.log("\n── configuration ──");
if (!reportEnv(process.env)) {
  process.exit(1);
}
console.log("");

const express = require("express");
const cors = require("cors");
const http = require("http");
const db = require("./config/database");
// Dependency-free: reporting the Web-engine state must not pull Puppeteer into
// memory on a small instance.
const webEngine = require("./config/webEngine");
const { initSocket } = require("./sockets/chatsockets");
const { initNotificationsSocket } = require("./sockets/notifications");
const { startKeepAlive } = require("./services/renderKeepAlive");

process.on("unhandledRejection", (reason, promise) => {
  console.warn("⚠️ [Server Guard] Unhandled Rejection at:", promise, "reason:", reason?.message || reason);
});
process.on("uncaughtException", (err) => {
  console.warn("⚠️ [Server Guard] Uncaught Exception:", err?.message || err);
});

const app = express();

/*
 * Database readiness, tracked here rather than inferred.
 *
 * `db.ready` is the promise config/database.js already exposes. The service
 * starts before that promise settles, so a synchronous check at boot would
 * always read "not connected" and would then be wrong a second later. Tracking
 * the settled outcome means /health and the degraded guard report what is
 * actually true at request time.
 */
const r2Storage = require("./services/r2StorageService");
const isR2OrSqliteActive = require("./config/databaseEngine").usesSqlite();
const r2Required = process.env.R2_REQUIRED === "1";
if(r2Required && r2Storage.isConfigured()) {
  const verifyStorage=()=>r2Storage.verifyConnection().catch(()=>{});
  verifyStorage();
  const storageTimer=setInterval(verifyStorage,300000);storageTimer.unref();
}

const dbState = {
  connected: false,
  configured:
    isR2OrSqliteActive ||
    ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASS"].every(
      (k) => process.env[k] && String(process.env[k]).trim()
    ),
  degradedAllowed: ["1", "true", "yes", "on"].includes(
    String(process.env.ALLOW_START_WITHOUT_DB || "").toLowerCase()
  ),
  lastError: null,
};
const databaseHealth=require("./services/databaseHealth").createDatabaseHealth(db,{onResult:result=>{dbState.connected=result.ok;dbState.lastError=result.errorCode;}});

// Never let a database failure become an unhandled rejection. Without this, a
// dead database crashes the process even in degraded mode, which defeats the
// point of booting without one.
db.ready.then(
  () => {
    dbState.connected = true;
    console.log("  database: connected");
  },
  (err) => {
    dbState.lastError = err && err.message;
    console.error(`  database: NOT available — ${dbState.lastError}`);
    if (!dbState.degradedAllowed) {
      console.error("  Set ALLOW_START_WITHOUT_DB=1 to boot anyway (API will answer 503).");
    }
  }
);
const server = http.createServer(app);
module.exports = app;

// ── Crash guard for whatsapp-web.js / Puppeteer ─────────────────────────────
// whatsapp-web.js occasionally throws an unhandled rejection deep inside
// Puppeteer during a WhatsApp Web page navigation (e.g. "Execution context
// was destroyed"), outside of any of its own event handlers. Left alone this
// takes down the entire process, not just the WhatsApp session. Only this
// known, benign error class is swallowed here — anything else still crashes
// the process as Node intends, so real bugs aren't masked.
function isRecoverableWaError(err) {
  const text = `${(err && err.message) || err} ${(err && err.stack) || ""}`;
  return /puppeteer|whatsapp-web\.js|Execution context was destroyed|Protocol error|Session closed|Target closed|detached Frame|Navigation timeout|Page\.navigate/i.test(text);
}
function handleFatal(label, err) {
  if (isRecoverableWaError(err)) {
    console.warn(`⚠️ [WhatsApp Web Guard] Handled transient Puppeteer warning (${label}):`, err?.message || err);
    return;
  }
  console.error(`❌ ${label}:`, err);
  process.exit(1);
}
process.on("unhandledRejection", (reason) => handleFatal("unhandledRejection", reason));
process.on("uncaughtException", (err) => handleFatal("uncaughtException", err));

// ── CORS ─────────────────────────────────────────────────────────────────────
// Policy lives in config/corsPolicy.js so it can be unit-tested without booting
// this file (booting server.js also starts the WhatsApp session engine, so the
// only alternative was to restart a live server holding a paired number).
//
// Summary: no Origin -> allowed (curl, PM2, Meta webhook, CRM X-API-Key calls).
// Exact match against ALLOWED_ORIGINS -> allowed. localhost -> dev only.
// Everything else refused, with no CORS headers so the browser blocks it.
const { createCorsOrigin, describePolicy } = require("./config/corsPolicy");
const corsOrigin = createCorsOrigin(process.env);

// Behind nginx on the VPS. Without this, express-rate-limit sees the nginx
// proxy IP as the client and every visitor shares one rate-limit bucket.
app.set("trust proxy", 1);

app.use(cors({
  origin: corsOrigin,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  // X-Tenant-Id / X-Branch-Id are required: src/config/axios.js attaches them to
  // every request, so leaving them off this list made the browser fail the
  // preflight and drop the response ("Failed to fetch") for any cross-origin
  // dev/prod call using that instance. Tenant validation stays server-side.
  allowedHeaders: ["Content-Type", "Authorization", "X-API-Key", "X-Requested-With", "X-Tenant-Id", "X-Branch-Id", "X-Browser-Session"],
  exposedHeaders: ["Content-Disposition"],
  credentials: true,
  maxAge: 86400,
}));
const corsOrigins = corsOrigin;

if (corsOrigin.isProd && corsOrigin.allowedOrigins.length === 0) {
  console.warn("?? NODE_ENV=production but ALLOWED_ORIGINS is empty - all cross-origin browser requests will be blocked. Set it to your Vercel domain.");
} else {
  console.log(`? CORS allowlist: ${describePolicy(process.env)}`);
}


app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});

app.use(require("./middleware/requestAdmission").admitRequest);
app.use(express.json({ limit: process.env.HTTP_JSON_LIMIT || "2mb", verify: (req, res, buf) => { if(req.path.includes("webhook"))req.rawBody = buf; } }));
app.use(express.urlencoded({ limit: process.env.HTTP_JSON_LIMIT || "2mb", extended: true, parameterLimit: 2000 }));

server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;
server.requestTimeout = 120000;

app.set("sharedInboxReady", false);
app.set("databaseHealth",databaseHealth);
app.get("/api/ops/metrics",require("./services/runtimeMetrics").protectedSnapshot);
app.get(["/health", "/api/health"], (req, res) => {
  // Truth over green ticks. The status stays 200 so orchestrators do not
  // kill-loop the container, but the body reports the real state — a monitor
  // reading `ok` sees degraded, and a human reading the deploy log sees why.
  const dbUp = dbState.connected && databaseHealth.status().ok;
  const webEngineOn = webEngine.isWebEngineEnabled();
  const r2Storage = require("./services/r2StorageService");
  const isSqlite = Boolean(db.isSqlite);
  const r2Status = r2Storage.getStatus();
  res.json({
    ok: !app.get("draining") && dbUp && app.get("sharedInboxReady") && (!r2Required || Boolean(r2Status.configured && r2Status.lastProbe?.ok)),
    draining: Boolean(app.get("draining")),
    sharedInboxReady: app.get("sharedInboxReady"),
    service: "whatsapp-crm",
    database: dbUp ? "ready" : "disconnected",
    databaseCheckAt: databaseHealth.status().checkedAt,
    dbEngine: isSqlite ? (r2Status.configured ? "sqlite-r2" : "sqlite") : "mysql",
    storage: {
      r2Configured: r2Status.configured,
      r2Required,
      r2Verified: Boolean(r2Status.configured && r2Status.lastProbe?.ok),
      r2LastCheck: r2Status.lastProbe?.checkedAt || null,
      legacyPublicUploads: require("./middleware/legacyUploads").enabled(),
      r2Bucket: r2Status.bucket,
      lastSyncAt: r2Status.lastSyncAt,
    },
    degraded: !dbUp,
    ...(dbUp
      ? {}
      : {
          reason:
            dbState.configured
              ? "Database is configured but not reachable"
              : "No database configured — set DB_HOST, DB_USER, DB_PASS, DB_NAME (or configure Cloudflare R2 / USE_SQLITE=1)",
          hint: "Every /api route answers 503 while degraded. Provision MySQL or set Cloudflare R2 keys.",
        }),
    // Not a fault: the Web engine is optional. Reported so it is never a
    // mystery why QR pairing does nothing.
    whatsappWebEngine: webEngineOn ? "enabled" : "disabled",
    ...(webEngineOn ? {} : { whatsappWebEngineHint: webEngine.WEB_ENGINE_DISABLED_REASON }),
    // So a defaulted deployment is visible in one place rather than inferred from
    // a deploy log that has already scrolled away.
    defaultedValues: defaults.applied.map((d) => d.key),
    ephemeralJwtSecret: Boolean(defaults.ephemeralJwt?.ephemeral),
    ...(defaults.ephemeralJwt?.ephemeral
      ? { ephemeralJwtSecretHint: "Set a real JWT_SECRET; sessions do not survive a restart until you do." }
      : {}),
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

/*
 * Degraded mode guard.
 *
 * When ALLOW_START_WITHOUT_DB=1 and the database is not usable, short-circuit
 * every API route with an explicit 503 instead of letting each one fail
 * somewhere different — a raw driver error, an unhandled rejection, or a
 * request that hangs until the client gives up.
 *
 * This is deliberately a hard stop. It does not fall back to a substitute
 * datastore: this service keeps clients, invoices, contacts, campaigns, flows
 * and chat history as raw SQL, and a JSON shim would mean rewriting every query
 * and would lose all records on restart. Degraded mode is for seeing that the
 * database is missing, not for pretending to work without it.
 */
app.use("/api", (req, res, next) => {
  // Never block CORS OPTIONS preflight checks with 503
  if (req.method === "OPTIONS") return res.sendStatus(204);

  // Allow dedicated demo-login endpoint so demo access always works even before DB is provisioned
  if (req.path === "/auth/demo-login") return next();

  // WhatsApp Web engine routes run independently of MySQL database using LocalAuth filesystem persistence
  if (req.path.startsWith("/whatsapp")) return next();

  // Storage and Cloudflare R2 routes run independently
  if (req.path.startsWith("/storage")) return next();

  // Guard on the database being down, NOT on whether degraded boot was
  // requested. Gating this on degradedAllowed left a hole: with the flag off and
  // no database, routes were allowed through to a dead socket and produced raw
  // driver errors and unhandled rejections instead of one clear 503.
  if (dbState.connected && databaseHealth.status().ok) return next();

  if (!dbState.degradedAllowed) {
    console.warn(
      "Database is not connected and ALLOW_START_WITHOUT_DB is not set — /api will answer 503. " +
        "Set ALLOW_START_WITHOUT_DB=1 to make that intentional rather than accidental."
    );
  }
  res.status(503).json({
    error: "Service is running without a database",
    degraded: true,
    database: dbState.configured ? "disconnected" : "not configured",
    reason: dbState.configured
      ? "The configured database is not reachable"
      : "DB_HOST, DB_USER, DB_PASS and DB_NAME are not set",
    hint: "Provision MySQL (render.yaml can create it) and restart the service.",
  });
});

app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  const shouldEmit = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);

  res.json = (body) => {
    if (shouldEmit && res.statusCode < 400) {
      const io = req.app.get("io");
      if (io) {
        io.to(`user:${req.user?.id || "none"}`).emit("data_changed", {
          method: req.method,
          path: req.originalUrl,
          status: res.statusCode,
          at: new Date().toISOString()
        });
      }
    }
    return originalJson(body);
  };

  next();
});

// ── Routes ───────────────────────────────────────────────────────────────────
// Auth plane (login/register/2FA + verifyToken) — duplicated from the CRM so
// the WA frontend can log in against the cloned users table. See README.
app.use("/api", require("./middleware/sharedWorkspaceGuard"));
app.use("/api/auth", require("./routes/browserSessionRoutes"));
app.use("/api/auth", require("./middleware/authWorkspaceScope"), require("./services/browserSessions").interceptLogin, require("./routes/authRoutes"));
app.use("/api/client-portal", require("./routes/clientPortalRoutes"));

// ── Enterprise Multi-Tenant & Multi-Branch v2 REST APIs ──────────────────────
app.use("/api/v2", require("./routes/enterpriseBranchRoutes"));
app.use("/api/v2", require("./routes/enterpriseOrganizationRoutes"));
app.use("/api/v2/meta", require("./routes/enterpriseMetaRoutes"));
app.use("/api/v2/billing", require("./routes/enterpriseBillingRoutes"));
app.use("/api/v2/inbox", (req, res, next) => app.get("sharedInboxReady") ? next() : res.status(503).json({ message: "Shared inbox schema is not ready" }), require("./routes/enterpriseInboxRoutes"));
app.use("/api/v2/workspace", (req, res, next) => app.get("sharedInboxReady") ? next() : res.status(503).json({ message: "Employee workspace schema is not ready" }), require("./routes/employeeWorkspaceRoutes"));
app.use("/webhooks/razorpay", require("./routes/enterpriseBillingRoutes"));

app.use("/api/teammember", require("./middleware/authMiddleware").verifyToken, (req, res) => {
  const tenantId = req.user?.tenant_id;
  if (!tenantId) {
    return res.status(403).json({ message: "Tenant context required" });
  }
  const db = require("./config/database");
  db.query(
    `SELECT id, first_name, last_name, emp_email, mobile, job_title, emp_role, emp_id, user_id, whatsapp_access_level
     FROM teammember
     WHERE tenant_id = ?
     ORDER BY first_name ASC`,
    [tenantId],
    (err, rows) => {
      if (err) return res.json([]);
      res.json(rows || []);
    }
  );
});

// WhatsApp session engine (QR / chats / send / media). Every route is behind
// verifyToken — supports JWT tokens as well as X-API-Key for external CRM connection.
app.use("/api/whatsapp", require("./middleware/authMiddleware").verifyToken, require("./routes/whatsappRoutes"));
app.use(["/api/v1", "/api/crm"], require("./middleware/authMiddleware").verifyToken, require("./routes/externalCrmRoutes"));
app.use("/api/wa/templates", require("./routes/waTemplateRoutes"));
app.use("/api/wa/groups", require("./routes/waGroupRoutes"));
app.use("/api/wa/campaigns", require("./routes/waCampaignRoutes"));
app.use("/api/wa/analytics", require("./routes/waAnalyticsRoutes"));
// Mounted behind verifyToken: the config router only applied auth to its
// write/test routes, leaving /status, /phone-info, /business-profile,
// /queue-stats and /meta-templates readable by any unauthenticated caller.
app.use("/api/wa/config", require("./middleware/authMiddleware").verifyToken, require("./routes/waConfigRoutes"));
app.use("/webhook", require("./routes/waWebhookRoutes"));
app.use("/api/wa/webhook", require("./routes/waWebhookRoutes"));
app.use("/api/wa/contacts", require("./routes/waContactRoutes"));
app.use("/api/wa/enquiries", require("./routes/waEnquiryRoutes"));
app.use("/api/wa/automations", require("./routes/waAutomationRoutes"));
app.use("/api/wa/flows", require("./routes/waFlowRoutes"));
app.use("/api/wa-flows", require("./routes/waFlowRoutes"));
app.use("/api/wa/ai", require("./routes/waAiRoutes"));
app.use("/api/wa/payments", require("./routes/waPaymentsRoutes"));
app.use("/api/wa/drip", require("./routes/waDripRoutes"));
app.use("/api/wa/reminders", require("./routes/waReminderRoutes"));
app.use("/api/storage", require("./routes/r2Routes"));

// ── Removed: unauthenticated test hooks ──────────────────────────────────────
// /send-menu, /simulate-inbound and /trigger-automation used to be registered on
// the bare app here, outside every auth-wrapped mount, listening on 0.0.0.0.
// Each performed real sends to a caller-supplied phone number with no auth, no
// opt-in check and no allowlist — and CORS reflects every origin, so any web page
// could reach them cross-origin.
//
// /simulate-inbound was the worst: dispatchInbound runs the whole inbound
// pipeline (flow advance, payment confirmation, welcome, AI reply) and mutates
// CRM records, so one POST caused several outbound messages plus financial
// writes against an arbitrary number.
//
// All three had authenticated equivalents, still available at:
//   POST /api/wa/flows/:id/trigger-phone   (replaces /send-menu)
//   POST /api/wa/automations/:id/trigger   (replaces /trigger-automation)
//   POST /api/wa/flows/simulate-step       (inbound simulation)

// ── Ensure Runtime Directories Exist ──────────────────────────────────────────
//
// Deploy model: the app is deployed by `git pull` into a deploy directory, so
// the code directory is replaceable. Runtime state is NOT — it holds the paired
// WhatsApp session (a full Chromium profile) and every uploaded PDF and image.
//
// All path resolution therefore lives in config/runtimePaths.js, and each path
// is env-overridable. On the VPS they point at /home/wauser/wa-data/*, outside
// the deploy directory, so a deploy can never orphan a live WhatsApp session.
// With no env set (local dev) they resolve to the original hardcoded locations,
// so nothing changes on this machine.
const { ensureRuntimeDirs, uploadsDir, sessionsDir, logsDir, isExternalState } =
  require("./config/runtimePaths");

ensureRuntimeDirs();

// Absolute path: express.static("uploads") resolves against process.cwd(), so
// uploaded media 404'd whenever the server was started from anywhere but backend/.
app.use(
  "/uploads",
  (req, res, next) => {
    if(!require("./middleware/legacyUploads").enabled())return res.sendStatus(404);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    next();
  },
  express.static(uploadsDir, {
    maxAge: "7d",
    setHeaders: (res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
    },
  })
);

// Make the resolved locations visible in the boot log. A deployment mistake
// here (state written inside the deploy dir) must be obvious in the first
// screenful of PM2 output, not discovered when a session vanishes.
console.log(`? Runtime state ${isExternalState() ? "EXTERNAL (persistent)" : "in-repo (dev)"}`);
console.log(`?   uploads  -> ${uploadsDir}`);
console.log(`?   sessions -> ${sessionsDir}`);
console.log(`?   logs     -> ${logsDir}`);

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT) || 5001;

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`❌ Port ${PORT} is already in use. Either stop the process currently listening on port ${PORT} or set a different PORT in Whatsapp_CRM/backend/.env.`);
    process.exit(1);
  }
  throw error;
});

function startServer() {
  const initSockets = () => {
    const io = initSocket(server, corsOrigins);
    initNotificationsSocket(io, corsOrigins);
    app.set("io", io);
    app.set("notificationIO", io);
  };

  /*
   * Everything that needs a live database: WhatsApp tables, Meta credential
   * load, session restore, the reminder/automation schedulers, the CRM sweep
   * and the queue worker. Split out so degraded mode can skip it.
   */
  const bootDatabaseFeatures = async () => {
    // Ensure WhatsApp tables exist
    try {
      await require("./services/waDatabase").ensureWATables();
      await require("./services/tenantPlanService").ensureTenantsTable();
      await require("./services/enquiryService").ensureEnquiryTables();
      await require("./migrations/shared_number_inbox").migrate(require("./config/database"));
      await require("./migrations/shared_flows").migrate(require("./config/database"));
      await require("./services/schemaReadiness").assertReady(db);
      await require("./services/sharedFlowRuntime").recover();
      app.set("sharedInboxReady", true);
      require("./services/employeeOwnershipRecovery").start(db, app.get("io"));
      await require("./services/waCampaignEngine").startWorker();
      require("./services/waStorageRetention").start();
    } catch (e) {
      console.warn("⚠️ WhatsApp tables setup warning:", e.message);
    }

    await databaseHealth.check();databaseHealth.start();

    // Load active Meta WhatsApp Cloud API credentials on boot
    try {
      await require("./services/waConfigHelper").configureForUser(null);
    } catch (e) {
      console.warn("⚠️ Meta WhatsApp Cloud API config init warning:", e.message);
    }

    // Restore saved WhatsApp sessions. Launches nothing when no session is saved.
    try {
      await require("./services/whatsappService").restoreExisting();
    } catch (e) {
      console.warn("⚠️ WhatsApp session restore warning:", e.message);
    }

    // Daily payment_due WhatsApp reminder for invoices due tomorrow
    try {
      require("./services/waPaymentDueScheduler").startPaymentDueScheduler();
    } catch (e) {
      console.warn("⚠️ WA payment-due scheduler warning:", e.message);
    }

    // Daily lead_followup WhatsApp reminder for telecalls/walkins/fields due today
    try {
      require("./services/waLeadFollowupScheduler").startLeadFollowupScheduler();
    } catch (e) {
      console.warn("⚠️ WA lead-followup scheduler warning:", e.message);
    }

    // Master 2-Way Interactive Confirmation Schedulers (Appointments, Invoices, Quotations, AMC)
    try {
      require("./services/waReminderScheduler").startInteractiveReminderSchedulers();
    } catch (e) {
      console.warn("⚠️ WA interactive reminder schedulers warning:", e.message);
    }

    // Recovers delayed automation rules whose in-process timer was lost on restart
    try {
      require("./services/waAutomationService").startAutomationScheduler();
    } catch (e) {
      console.warn("⚠️ WA delayed automation scheduler warning:", e.message);
    }

    // Universal CRM Real-Time Event Bus & Database Change Sweep (Invoices, Quotes, AMC, Leads, Walkins)
    try {
      if(process.env.WA_ENABLE_CRM_SWEEP!=="0")require("./services/crmEventBus").startCrmRealtimeSweep();
    } catch (e) {
      console.warn("⚠️ CRM Event Bus sweep warning:", e.message);
    }

    // Start WhatsApp Cloud API queue worker (no Redis fallback = synchronous)
    const { startWorker } = require("./services/waQueue");
    startWorker().catch(() => {});
  };

  if (isR2OrSqliteActive || !dbState.degradedAllowed) {
    return db.ready
      .then(async () => {
        initSockets();
        await bootDatabaseFeatures();
        server.listen(PORT, "0.0.0.0", () => {
          console.log(`✅ Whatsapp_CRM server running: http://0.0.0.0:${PORT} [${process.env.NODE_ENV || "development"}]`);
          startKeepAlive();
        });
      })
      .catch((error) => {
        if (dbState.degradedAllowed) {
          initSockets();
          server.listen(PORT, "0.0.0.0", () => {
            console.log(`⚠️  Whatsapp_CRM server running DEGRADED: http://0.0.0.0:${PORT} [${process.env.NODE_ENV || "development"}]`);
            console.log(`   Database features are disabled until database resolves.`);
            startKeepAlive();
          });
          return Promise.resolve();
        }
        console.error("Database is not ready. Server not started.");
        console.error(`Check DB_HOST, DB_PORT, DB_USER, DB_PASS, and DB_NAME in Whatsapp_CRM/backend/.env. Details: ${error.message}`);
        console.error("To boot anyway with every /api route answering 503, set ALLOW_START_WITHOUT_DB=1.");
        process.exit(1);
      });
  }

  /*
   * Degraded mode for unconfigured / legacy MySQL boot where degraded boot was allowed:
   * Listen immediately for /health so orchestrators and tests see the degraded status right away.
   * Boot database features only when db.ready resolves.
   */
  initSockets();
  db.ready
    .then(async () => {
      await bootDatabaseFeatures();
    })
    .catch((error) => {
      console.error(`Database features unavailable: ${error.message}`);
      console.error("Running degraded: /health reports it and /api answers 503.");
    });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`⚠️  Whatsapp_CRM server running DEGRADED: http://0.0.0.0:${PORT} [${process.env.NODE_ENV || "development"}]`);
    console.log(`   Database features are disabled until DB_HOST/DB_USER/DB_PASS/DB_NAME resolve.`);
    startKeepAlive();
  });
  return Promise.resolve();
}

app.startServer = startServer;

function setupGracefulShutdown() {
  let stopping=false;
  const shutdown = (signal) => {
    if(stopping)return;stopping=true;app.set("draining",true);databaseHealth.stop();
    console.log(`\n🛑 [Server Guard] Received ${signal} — draining connections and shutting down gracefully...`);
    server.close(async () => {
      console.log("  HTTP/WebSocket servers closed to new connections.");
      try {
        await require("./services/sharedInboxAssistant").idle();
        const { messageQueue } = require("./services/waQueue");
        if (messageQueue && messageQueue.close) await messageQueue.close().catch(() => {});
        if (db && db.end) await new Promise((r) => db.end(r)).catch(() => {});
      } catch (_) {}
      console.log("  Clean shutdown completed.");
      process.exit(0);
    });
    const io=require("./sockets/chatsockets").getIO();
    if(io){io.of("/").disconnectSockets(true);io.of("/notifications").disconnectSockets(true);io.engine.close();}
    setTimeout(() => {
      console.error("  Forced exit after 30s shutdown timeout.");
      process.exit(1);
    }, 30000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

setupGracefulShutdown();

if (process.env.NODE_ENV !== "test") {
  startServer();
}
