// ─────────────────────────────────────────────────────────────────────────────
// Whatsapp_CRM backend — standalone WhatsApp service.
// Forked from MADHURA_CRM/backend/server.js. Only WhatsApp routes + schedulers.
// Shares NO code with the CRM at runtime (shared files were duplicated here so
// every require() resolves locally — see DIVERGENCE NOTE in README.md).
// ─────────────────────────────────────────────────────────────────────────────
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env"), override: true });
const express = require("express");
const cors = require("cors");
const http = require("http");
const db = require("./config/database");
const { initSocket } = require("./sockets/chatsockets");
const { initNotificationsSocket } = require("./sockets/notifications");

process.on("unhandledRejection", (reason, promise) => {
  console.warn("⚠️ [Server Guard] Unhandled Rejection at:", promise, "reason:", reason?.message || reason);
});
process.on("uncaughtException", (err) => {
  console.warn("⚠️ [Server Guard] Uncaught Exception:", err?.message || err);
});

// ── Fail fast if required env vars are missing ──────────────────────────────
const REQUIRED_ENV = ["DB_HOST", "DB_USER", "DB_PASS", "DB_NAME", "JWT_SECRET"];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`❌ Missing required environment variables: ${missing.join(", ")}`);
  console.error("   Copy backend/.env.example to backend/.env and fill in the values.");
  process.exit(1);
}

const app = express();
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
const dynamicOrigin = (origin, callback) => {
  callback(null, true);
};
app.use(cors({
  origin: dynamicOrigin,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));
const corsOrigins = dynamicOrigin;

app.use(express.json({ limit: "50mb", verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.get(["/health", "/api/health"], (req, res) => {
  res.json({
    ok: true,
    service: "whatsapp-crm",
    database: "ready",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  const shouldEmit = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);

  res.json = (body) => {
    if (shouldEmit && res.statusCode < 400) {
      const io = req.app.get("io");
      if (io) {
        io.emit("data_changed", {
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
app.use("/api/auth", require("./routes/authRoutes"));

// WhatsApp session engine (QR / chats / send / media). Every route is behind
// verifyToken — supports JWT tokens as well as X-API-Key for external CRM connection.
app.use("/api/whatsapp", require("./middleware/authMiddleware").verifyToken, require("./routes/whatsappRoutes"));
app.use(["/api/v1", "/api/crm"], require("./middleware/authMiddleware").verifyToken, require("./routes/externalCrmRoutes"));
app.use("/api/wa/templates", require("./routes/waTemplateRoutes"));
app.use("/api/wa/groups", require("./routes/waGroupRoutes"));
app.use("/api/wa/campaigns", require("./routes/waCampaignRoutes"));
app.use("/api/wa/analytics", require("./routes/waAnalyticsRoutes"));
app.use("/api/wa/config", require("./routes/waConfigRoutes"));
app.use("/webhook", require("./routes/waWebhookRoutes"));
app.use("/api/wa/webhook", require("./routes/waWebhookRoutes"));
app.use("/api/wa/contacts", require("./routes/waContactRoutes"));
app.use("/api/wa/automations", require("./routes/waAutomationRoutes"));
app.use("/api/wa/flows", require("./routes/waFlowRoutes"));
app.use("/api/wa-flows", require("./routes/waFlowRoutes"));
app.use("/api/wa/ai", require("./routes/waAiRoutes"));
app.use("/api/wa/payments", require("./routes/waPaymentsRoutes"));
app.use("/api/wa/drip", require("./routes/waDripRoutes"));
app.use("/api/wa/reminders", require("./routes/waReminderRoutes"));

// Direct trigger route for external webhooks or automation triggers
app.post("/send-menu", async (req, res) => {
  try {
    const { phone, flow_id, flowId, sessionKey } = req.body || {};
    if (!phone) return res.status(400).json({ error: "Phone number is required" });
    let cleanPhone = String(phone).replace(/\D/g, "");
    if (cleanPhone.length === 10) cleanPhone = "91" + cleanPhone;
    const waFlowEngine = require("./services/waFlowEngine");
    const db = require("./config/database");

    let targetFlow = null;
    const requestedId = flow_id || flowId;
    if (requestedId) {
      const [flows] = await db.promise().query("SELECT * FROM wa_flows WHERE id = ? LIMIT 1", [requestedId]);
      if (flows.length) targetFlow = flows[0];
    }
    if (!targetFlow) {
      const [flows] = await db.promise().query("SELECT * FROM wa_flows WHERE status = 'active' ORDER BY id ASC LIMIT 1");
      if (flows.length) targetFlow = flows[0];
    }
    if (!targetFlow) {
      const [flows] = await db.promise().query("SELECT * FROM wa_flows ORDER BY id ASC LIMIT 1");
      if (flows.length) targetFlow = flows[0];
    }
    if (!targetFlow) {
      return res.status(404).json({ error: "No WhatsApp flow found in system" });
    }
    const result = await waFlowEngine.startFlowRun(targetFlow, cleanPhone, sessionKey || null);
    res.json({ success: true, message: `Menu triggered for +${cleanPhone}`, flow: targetFlow.name, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Test/simulate inbound message for WhatsApp flow or bot testing
app.post("/simulate-inbound", async (req, res) => {
  try {
    const { phone, message, chatId, sessionKey } = req.body || {};
    if (!phone && !chatId) return res.status(400).json({ error: "phone or chatId is required" });
    const waFlowEngine = require("./services/waFlowEngine");
    const handled = await waFlowEngine.dispatchInbound(
      phone || chatId,
      message || "",
      null,
      sessionKey || null,
      null,
      { chatId: chatId || null, isHistoric: false }
    );
    res.json({ success: true, handled, phone: phone || chatId, message });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Test/simulate automation trigger for CRM automation testing
app.post("/trigger-automation", async (req, res) => {
  try {
    const { id, phone, contact_name, chatId, sessionKey } = req.body || {};
    if (!id || (!phone && !chatId)) return res.status(400).json({ error: "id and phone/chatId required" });
    const db = require("./config/database");
    const [rows] = await db.promise().query("SELECT * FROM wa_automations WHERE id = ?", [id]);
    if (!rows.length) return res.status(404).json({ error: "Automation not found" });
    const { executeAutomationSend } = require("./services/waAutomationService");
    const waService = require("./services/whatsappService");
    const cleanPhone = String(phone || chatId).replace(/\D/g, "");
    const activeKey = sessionKey || waService.defaultKey || "708";
    await executeAutomationSend(
      rows[0],
      cleanPhone,
      contact_name || "Valued Client",
      { invoice_no: "INV-2026-999", amount: "25,000", due_date: "05 Oct 2026", date: "30/09/2026", service: "Full AMC Service", company: "Madhura Tech" },
      activeKey,
      chatId || null
    );
    res.json({ success: true, message: `Automation ${rows[0].name} triggered for ${cleanPhone}`, rule: rows[0].name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Ensure Runtime Directories Exist ──────────────────────────────────────────
const fs = require("fs");
const runtimeDirs = [
  path.join(__dirname, "uploads"),
  path.join(__dirname, "uploads", "wa-media"),
  path.join(__dirname, "..", "whatsapp-sessions"),
  path.join(__dirname, "..", "logs"),
];
runtimeDirs.forEach((dir) => {
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch (_) {}
});

// Absolute path: express.static("uploads") resolves against process.cwd(), so
// uploaded media 404'd whenever the server was started from anywhere but backend/.
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

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
  return db.ready.then(async () => {
    const io = initSocket(server, corsOrigins);
    initNotificationsSocket(io, corsOrigins);
    app.set("io", io);
    app.set("notificationIO", io);

    // Ensure WhatsApp tables exist
    try {
      await require("./services/waDatabase").ensureWATables();
    } catch (e) {
      console.warn("⚠️ WhatsApp tables setup warning:", e.message);
    }

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
      require("./services/crmEventBus").startCrmRealtimeSweep();
    } catch (e) {
      console.warn("⚠️ CRM Event Bus sweep warning:", e.message);
    }

    // Start WhatsApp Cloud API queue worker (no Redis fallback = synchronous)
    const { startWorker } = require("./services/waQueue");
    startWorker().catch(() => {});
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`✅ Whatsapp_CRM server running: http://0.0.0.0:${PORT} [${process.env.NODE_ENV || "development"}]`);
    });
  }).catch((error) => {
    console.error("Database is not ready. Server not started.");
    console.error(`Check DB_HOST, DB_PORT, DB_USER, DB_PASS, and DB_NAME in Whatsapp_CRM/backend/.env. Details: ${error.message}`);
    process.exit(1);
  });
}

app.startServer = startServer;

if (process.env.NODE_ENV !== "test") {
  startServer();
}
