const { Client, LocalAuth, MessageMedia, Location } = require("whatsapp-web.js");
const path = require("path");
const fs = require("fs");
const cp = require("child_process");

const puppeteer = require("puppeteer");

// Forcefully terminates any orphan Chrome / Edge processes holding this session on Windows
function killSessionBrowserProcesses(sessionPath) {
  if (process.platform !== "win32" || !sessionPath) return;
  try {
    const folderName = path.basename(sessionPath);
    // Use PowerShell encoded command so $_ is never corrupted or prematurely evaluated
    const script = `Get-CimInstance Win32_Process | Where-Object { ($_.Name -eq 'msedge.exe' -or $_.Name -eq 'chrome.exe') -and $_.CommandLine -like '*${folderName}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
    const encoded = Buffer.from(script, "utf16le").toString("base64");
    cp.execSync(`powershell -NoProfile -NonInteractive -EncodedCommand ${encoded}`, { timeout: 4000, stdio: "ignore" });
  } catch (_) {}

  // Remove lingering Chrome lockfiles that cause "browser is already running" or EBUSY on Windows
  try {
    const sessionDir = path.join(sessionPath, "session");
    const lockFiles = [
      path.join(sessionDir, "SingletonLock"),
      path.join(sessionDir, "SingletonCookie"),
      path.join(sessionDir, "SingletonSocket"),
      path.join(sessionDir, "lockfile"),
    ];
    for (const lf of lockFiles) {
      if (fs.existsSync(lf)) {
        try { fs.unlinkSync(lf); } catch (_) {}
      }
    }
  } catch (_) {}
}

function getExecutablePath() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }
  // 1. Playwright / Puppeteer Chrome for Testing (Cleanest vanilla Chromium builds)
  try {
    const pwDir = path.join(process.env.LOCALAPPDATA || "", "ms-playwright");
    if (fs.existsSync(pwDir)) {
      const dirs = fs.readdirSync(pwDir);
      for (const d of dirs) {
        const p = path.join(pwDir, d, "chrome-win64", "chrome.exe");
        if (fs.existsSync(p)) return p;
      }
    }
  } catch (_) {}

  try {
    if (typeof puppeteer.executablePath === "function") {
      const pPath = puppeteer.executablePath();
      if (pPath && fs.existsSync(pPath)) return pPath;
    }
  } catch (_) {}

  const candidatePaths = [
    // Google Chrome paths
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    path.join(process.env.LOCALAPPDATA || "", "Google\\Chrome\\Application\\chrome.exe"),
    // Microsoft Edge paths (pre-installed on all Windows 10/11)
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    path.join(process.env.LOCALAPPDATA || "", "Microsoft\\Edge\\Application\\msedge.exe"),
    path.join(process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)", "Microsoft\\Edge\\Application\\msedge.exe"),
    // Brave / Chromium paths
    path.join(process.env.PROGRAMFILES || "C:\\Program Files", "BraveSoftware\\Brave-Browser\\Application\\brave.exe"),
    path.join(process.env.LOCALAPPDATA || "", "BraveSoftware\\Brave-Browser\\Application\\brave.exe"),
    // Linux/Docker paths
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/snap/bin/chromium",
  ];
  for (const p of candidatePaths) {
    if (p && fs.existsSync(p)) return p;
  }
  return undefined;
}

// Media/location messages often have an empty .body — showing that blank made
// the chat list read as "Tap to start chatting" (no messages yet) for chats
// that actually have history, which was confusing. Give the preview a label.
const MEDIA_TYPE_LABELS = {
  image: "📷 Photo",
  video: "🎥 Video",
  document: "📄 Document",
  audio: "🎤 Voice message",
  ptt: "🎤 Voice message",
  sticker: "Sticker",
  location: "📍 Location",
};
function describeLastMessage(msg) {
  if (msg.body) return msg.body;
  if (msg.type === "location") return MEDIA_TYPE_LABELS.location;
  if (msg.hasMedia || MEDIA_TYPE_LABELS[msg.type]) return MEDIA_TYPE_LABELS[msg.type] || "📎 Attachment";
  return msg.body || "";
}

function formatChatJid(chatId) {
  if (!chatId) return "";
  const str = String(chatId).trim();
  if (str.includes("@g.us") || str.includes("@broadcast") || str.includes("@lid") || str.includes("@newsletter")) {
    return str;
  }
  let digits = str.replace(/\D/g, "");
  if (!digits) return str;
  if (digits.length >= 18 && digits.startsWith("120363")) return `${digits}@g.us`;
  if (digits.length === 10) digits = "91" + digits;
  return `${digits}@c.us`;
}

function formatPhoneDisplay(phone) {
  if (!phone) return "";
  const digits = String(phone).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length >= 14 && !digits.startsWith("120363")) return "";
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (digits.length > 10) {
    return `+${digits.slice(0, digits.length - 10)} ${digits.slice(-10, -5)} ${digits.slice(-5)}`;
  }
  return `+${digits}`;
}

function withTimeout(promise, ms = 10000, label = "operation") {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Root for all per-user session profiles. Each linked WhatsApp number gets
// whatsapp-sessions/<userId>/ — a full Chrome profile owned by LocalAuth.
const SESSIONS_ROOT = path.join(__dirname, "../../whatsapp-sessions");
// Pre-multi-session location. Migrated into SESSIONS_ROOT/<adminId> on first boot.
const LEGACY_SESSION_PATH = path.join(__dirname, "../../whatsapp-session");

const FOUR_DAYS_MS = 4 * 24 * 60 * 60 * 1000; // 96 hours (4 days)

class WhatsAppService {
  constructor(key) {
    this.key = String(key);
    this.client = null;
    this.qrCode = null;
    this.ready = false;
    this.phone = null;
    this.isInitializing = false;
    this.qrCallbacks = [];
    this.chatsCache = [];
    this.messagesCache = {};
    this.messagesFetchCache = {};
    this.lastChatsFetch = 0;
    this.chatsFetching = false;
    this.connectedAt = 0;
    this.isSyncing = false;
    this._quarantineTimer = null;
    this._quarantineToken = null;
    this._queue = Promise.resolve();
    this._sendQueue = Promise.resolve();
    this._lastSendAt = 0;
    this._initPromise = null;
    this._getQrPromise = null;
    this._isRefreshingQr = false;
    this.lidToPhoneMap = new Map();
    this.phoneToLidMap = new Map();
  }

  clearQuarantineTimer() {
    if (this._quarantineTimer) {
      clearTimeout(this._quarantineTimer);
      this._quarantineTimer = null;
    }
    this._quarantineToken = null;
  }

  async resolveLidToPhone(lidJid) {
    if (!lidJid) return null;
    const str = String(lidJid).trim();
    if (!str.includes("@lid") && (str.length < 13 || str.startsWith("120363"))) {
      return null;
    }
    const fullLid = str.includes("@lid") ? str : `${str}@lid`;
    const digitsOnly = str.replace(/\D/g, "");

    if (this.lidToPhoneMap?.has(fullLid)) return this.lidToPhoneMap.get(fullLid);
    if (this.lidToPhoneMap?.has(digitsOnly)) return this.lidToPhoneMap.get(digitsOnly);

    const map = await this.resolveLidsBatch([fullLid]);
    return map.get(fullLid) || map.get(digitsOnly) || null;
  }

  async resolveLidsBatch(lidJids) {
    if (!lidJids || !lidJids.length) return this.lidToPhoneMap || new Map();
    if (!this.lidToPhoneMap) this.lidToPhoneMap = new Map();
    if (!this.phoneToLidMap) this.phoneToLidMap = new Map();

    const normalized = lidJids.map((j) => String(j).trim()).filter(Boolean);
    const unmapped = normalized.filter(
      (id) => !this.lidToPhoneMap.has(id) && !this.lidToPhoneMap.has(id.replace(/\D/g, ""))
    );
    if (!unmapped.length) return this.lidToPhoneMap;

    // 1. Live WhatsApp Web batch query via getContactLidAndPhone
    if (this.ready && this.client && this.client.pupPage) {
      try {
        const results = await this.enqueue(() =>
          this.withTimeout(this.client.getContactLidAndPhone(unmapped), 6000, "getContactLidAndPhone")
        ).catch(() => []);

        for (const item of (results || [])) {
          if (item && item.lid && item.pn) {
            const cleanPn = String(item.pn).replace(/\D/g, "");
            if (cleanPn && cleanPn.length >= 10 && cleanPn.length <= 13) {
              const lidFull = item.lid.includes("@lid") ? item.lid : `${item.lid}@lid`;
              const lidDigits = String(item.lid).replace(/\D/g, "");
              this.lidToPhoneMap.set(lidFull, cleanPn);
              this.lidToPhoneMap.set(lidDigits, cleanPn);
              this.phoneToLidMap.set(cleanPn, lidFull);
            }
          }
        }
      } catch (_) {}

      // 1b. In-page evaluate fallback for any still unmapped
      const stillUnmapped = unmapped.filter(
        (id) => !this.lidToPhoneMap.has(id) && !this.lidToPhoneMap.has(id.replace(/\D/g, ""))
      );
      if (stillUnmapped.length) {
        try {
          const evalResults = await this.enqueue(() =>
            this.withTimeout(
              this.client.pupPage.evaluate((lids) => {
                const out = [];
                for (const lid of lids) {
                  try {
                    const wid = window.require("WAWebWidFactory").createWid(lid);
                    const pnWid = window.require("WAWebApiContact").getPhoneNumber(wid);
                    if (pnWid) {
                      const pn = pnWid.user || pnWid._serialized || pnWid;
                      out.push({ lid, pn: String(pn) });
                    }
                  } catch (_) {}
                }
                return out;
              }, stillUnmapped),
              4000,
              "WAWebApiContact.getPhoneNumber batch"
            )
          ).catch(() => []);

          for (const item of (evalResults || [])) {
            if (item && item.lid && item.pn) {
              const cleanPn = String(item.pn).replace(/\D/g, "");
              if (cleanPn && cleanPn.length >= 10 && cleanPn.length <= 13) {
                const lidFull = item.lid.includes("@lid") ? item.lid : `${item.lid}@lid`;
                const lidDigits = String(item.lid).replace(/\D/g, "");
                this.lidToPhoneMap.set(lidFull, cleanPn);
                this.lidToPhoneMap.set(lidDigits, cleanPn);
                this.phoneToLidMap.set(cleanPn, lidFull);
              }
            }
          }
        } catch (_) {}
      }
    }

    return this.lidToPhoneMap;
  }

  withTimeout(promise, ms = 10000, label = "operation") {
    return withTimeout(promise, ms, label);
  }

  get sessionPath() {
    return path.join(SESSIONS_ROOT, this.key);
  }

  hasSavedProfile() {
    return hasSavedProfile(this.sessionPath);
  }

  getSessionMeta() {
    try {
      const metaFile = path.join(this.sessionPath, "session_meta.json");
      if (fs.existsSync(metaFile)) {
        return JSON.parse(fs.readFileSync(metaFile, "utf8"));
      }
    } catch (_) {}
    return null;
  }

  saveSessionMeta(meta) {
    try {
      if (!fs.existsSync(this.sessionPath)) {
        fs.mkdirSync(this.sessionPath, { recursive: true });
      }
      const metaFile = path.join(this.sessionPath, "session_meta.json");
      fs.writeFileSync(metaFile, JSON.stringify({ ...meta, updatedAt: Date.now() }, null, 2), "utf8");
    } catch (_) {}
  }

  markLoggedOut(reason = "USER_LOGOUT") {
    const now = Date.now();
    const expiresAt = now + FOUR_DAYS_MS;
    const meta = {
      sessionKey: this.key,
      phone: this.phone,
      status: "logged_out",
      reason: reason,
      loggedOutAt: now,
      expiresAt: expiresAt,
      autoDeleteDays: 4,
    };
    this.saveSessionMeta(meta);
    return meta;
  }

  // WhatsApp bans on the *aggregate* send rate of a number, not per campaign.
  // enqueue() serializes Puppeteer calls but doesn't throttle them, so three
  // concurrent campaigns each honouring their own 8s delay still triple the
  // rate on one phone. One gate on the session covers campaigns, AI replies,
  // automations, schedulers and manual sends alike.
  //
  // ponytail: fixed gap, not a token bucket — WA_MIN_SEND_GAP_MS is the
  // calibration knob. Swap for a bucket only if bursts need to be allowed.
  async _paceSend() {
    const gap = Number(process.env.WA_MIN_SEND_GAP_MS || 4000);
    const wait = gap - (Date.now() - this._lastSendAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this._lastSendAt = Date.now();
  }

  // whatsapp-web.js drives one shared Puppeteer page — overlapping calls
  // (chat polling, message fetch) race against each other on that page
  // and time out or throw under load. Serialize read calls through here.
  enqueue(fn) {
    const run = this._queue.then(fn, fn);
    this._queue = run.then(() => {}, () => {});
    return run;
  }

  // Dedicated fast queue for outbound sends so messages are never blocked behind slow contact scans
  enqueueSend(fn) {
    const run = this._sendQueue.then(fn, fn);
    this._sendQueue = run.then(() => {}, () => {});
    return run;
  }

  // Broadcasts real-time WhatsApp events across the shared team inbox and specific user rooms
  // whatsapp-web.js ack codes -> the status strings the UI renders ticks from.
  // -1 error, 0 pending, 1 sent to server, 2 delivered to device, 3 read, 4 played
  static ackToStatus(ack) {
    if (ack === undefined || ack === null) return null;
    if (ack < 0) return "failed";
    if (ack === 0) return "pending";
    if (ack === 1) return "sent";
    if (ack === 2) return "delivered";
    return "read";
  }

  emitWaEvent(event, chatId, phone, message) {
    try {
      const app = require("../server");
      const io = app.get && app.get("io");
      if (io) {
        io.to(`user:${this.key}`).emit(event, { phone, chatId, message, sessionKey: this.key });
        io.to("whatsapp").emit(event, { phone, chatId, message, sessionKey: this.key });
        io.emit(event, { phone, chatId, message, sessionKey: this.key });
      }
    } catch (_) {}
  }

  // Serializes every client-lifecycle transition (init / logout). These both
  // mutate the same LocalAuth profile directory — logout() deletes it outright —
  // so overlapping them left a live Puppeteer browser running against a deleted
  // profile, which shows up as "Attempted to use detached Frame" and can get the
  // freshly-linked device unlinked again.
  lifecycle(fn) {
    this._lifecycle = (this._lifecycle || Promise.resolve()).then(fn, fn);
    return this._lifecycle;
  }

  init(forceFresh = false) {
    if (!forceFresh && this.ready) return Promise.resolve();
    if (!forceFresh && this.isInitializing && this._initPromise) {
      return this._initPromise;
    }
    this._initPromise = this.lifecycle(() => this._doInit(forceFresh))
      .finally(() => {
        this._initPromise = null;
      });
    return this._initPromise;
  }

  async _doInit(forceFresh = false) {
    if (this.ready && !forceFresh) return;
    if (this.client && !forceFresh && !this.isInitializing && (this.ready || this.qrCode)) return;

    const sessionPath = this.sessionPath;
    // Clean up any stale/dead client instance before initializing a new one
    if (this.client) {
      try {
        await this.client.destroy().catch(() => {});
      } catch (_) {}
      this.client = null;
    }

    // Terminate any lingering browser processes holding this session directory on Windows
    killSessionBrowserProcesses(sessionPath);

    // Only wipe the saved session on an explicit reset (forceFresh) or if there
    // is no valid saved login profile. A normal reconnect with a valid session
    // reuses the saved LocalAuth profile so the device stays connected.
    if (forceFresh || !this.hasSavedProfile()) {
      try {
        if (fs.existsSync(sessionPath)) {
          console.log(`🧹 [Session Purge] Cleaning empty or unauthenticated session directory for ${this.key}`);
          fs.rmSync(sessionPath, { recursive: true, force: true });
        }
      } catch (_) {}
    }

    // Each live session is a headless Chrome holding WhatsApp Web (~350-500MB
    // RSS). On a multi-tenant VPS with 120+ tenants, LRU session hibernation
    // frees idle browser memory while preserving saved login tokens on disk.
    const maxSessions = Number(process.env.WA_MAX_SESSIONS || 15);
    const liveSessions = all().filter((s) => s !== this && s.client);
    if (liveSessions.length >= maxSessions) {
      // Find oldest idle session to hibernate
      const oldestIdle = liveSessions
        .filter((s) => s.ready && !s.isInitializing && !s._isSending)
        .sort((a, b) => (a.lastActiveAt || 0) - (b.lastActiveAt || 0))[0];

      if (oldestIdle) {
        console.log(`💤 [VPS Memory Optimizer] Hibernating idle session ${oldestIdle.key} to make room for session ${this.key}`);
        await oldestIdle.hibernate();
      } else {
        throw new Error(
          `Maximum of ${maxSessions} active WhatsApp browser sessions reached. Please use Meta Cloud API for high-volume bulk marketing.`
        );
      }
    }

    this.isInitializing = true;
    this._isHibernated = false;
    this.lastActiveAt = Date.now();
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
    }

    const initTimer = setTimeout(() => {
      if (this.isInitializing && !this.ready && !this.qrCode) {
        console.warn("⚠️ WhatsApp Client init watchdog timeout — resetting state");
        this.isInitializing = false;
        if (this.client) {
          this.client.destroy().catch(() => {});
          this.client = null;
        }
      }
    }, 60000); // cold Chrome/Puppeteer launch + WhatsApp Web's JS bundle can legitimately take longer than 30s

    try {
      const execPath = getExecutablePath();
      if (execPath) {
        console.log(`ℹ️ WhatsApp Puppeteer using browser at: ${execPath}`);
      }

      const defaultUserAgent =
        process.env.WA_USER_AGENT ||
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

      const puppeteerOptions = {
        headless: process.env.WA_HEADLESS === "false" ? false : true,
        defaultViewport: { width: 1024, height: 768 },
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--disable-gpu",
          "--disable-blink-features=AutomationControlled",
          "--disable-features=IsolateOrigins,site-per-process",
          "--disable-site-isolation-trials",
          "--disable-extensions",
          "--disable-default-apps",
          "--mute-audio",
          "--no-default-browser-check",
          `--user-agent=${defaultUserAgent}`,
        ],
      };
      if (execPath) puppeteerOptions.executablePath = execPath;

      const pinnedWebVersion = process.env.WA_WEB_VERSION || "latest";
      const clientOptions = {
        authStrategy: new LocalAuth({
          dataPath: sessionPath,
        }),
        puppeteer: puppeteerOptions,
        userAgent: defaultUserAgent,
        takeoverOnConflict: true,
        takeoverTimeoutMs: 0,
        authTimeoutMs: 120000,
        qrMaxRetries: 0,
        bypassCSP: true,
        userAgentMetadata: {
          brands: [
            { brand: "Chromium", version: "131" },
            { brand: "Google Chrome", version: "131" },
            { brand: "Not_A Brand", version: "24" }
          ],
          fullVersionList: [
            { brand: "Chromium", version: "131.0.6778.205" },
            { brand: "Google Chrome", version: "131.0.6778.205" },
            { brand: "Not_A Brand", version: "24.0.0.0" }
          ],
          platform: "Windows",
          platformVersion: "15.0.0",
          architecture: "x86",
          model: "",
          mobile: false,
          bitness: "64",
          wow64: false
        },
        evalOnNewDoc: () => {
          try {
            Object.defineProperty(navigator, "webdriver", { get: () => undefined });
          } catch (_) {}
          try {
            delete Object.getPrototypeOf(navigator).webdriver;
          } catch (_) {}
          try {
            const brands = [
              { brand: "Chromium", version: "131" },
              { brand: "Google Chrome", version: "131" },
              { brand: "Not_A Brand", version: "24" }
            ];
            const uad = {
              brands,
              mobile: false,
              platform: "Windows",
              getHighEntropyValues: async () => ({
                architecture: "x86",
                bitness: "64",
                brands,
                mobile: false,
                model: "",
                platform: "Windows",
                platformVersion: "15.0.0",
                uaFullVersion: "131.0.6778.205",
                wow64: false
              }),
              toJSON: () => ({ brands, mobile: false, platform: "Windows" })
            };
            Object.defineProperty(navigator, "userAgentData", { get: () => uad });
          } catch (_) {}
        },
      };
      if (pinnedWebVersion !== "latest") {
        clientOptions.webVersion = pinnedWebVersion;
        clientOptions.webVersionCache = {
          type: "local",
          path: path.join(__dirname, "../../whatsapp-webcache"),
          strict: false,
        };
      }
      console.log(`ℹ️ WhatsApp Web build: ${pinnedWebVersion === "latest" ? "live (not pinned)" : pinnedWebVersion}`);
      this.client = new Client(clientOptions);

      this.client.on("qr", (qr) => {
        clearTimeout(initTimer);
        this.qrCode = qr;
        this.qrCodeAt = Date.now();
        this.ready = false;
        this.isInitializing = false;
        console.log(`✅ WhatsApp QR Code generated successfully for session ${this.key}!`);
        this.emitWaEvent("wa_qr", null, null, { qr, sessionKey: this.key });
        this.qrCallbacks.forEach((cb) => cb(qr));
        this.qrCallbacks = [];
      });

      this.client.on("ready", async () => {
        clearTimeout(initTimer);
        this.ready = true;
        this.qrCode = null;
        this.isInitializing = false;
        this.phone = this.client.info?.wid?.user || null;
        this.connectedAt = Date.now();
        this.isSyncing = true;
        console.log(`✅ WhatsApp Client is Ready for phone: ${this.phone} [Quarantine Active for initial history sync]`);

        // 45-second quarantine grace period: WhatsApp Web replays historic/unread messages during initial sync.
        // During this window, all old/sync messages are ingested for CRM live chat but strictly blocked from firing automations.
        if (this._quarantineTimer) {
          clearTimeout(this._quarantineTimer);
          this._quarantineTimer = null;
        }
        const currentToken = Symbol("quarantineToken");
        this._quarantineToken = currentToken;

        this._quarantineTimer = setTimeout(() => {
          if (this._quarantineToken !== currentToken || !this.ready) return;
          this.isSyncing = false;
          this._quarantineTimer = null;
          console.log(`🛡️ [WA Quarantine Guard] Initial sync completed for session ${this.key}. Live real-time automations are active.`);
        }, 45000);

        try {
          const db = require("../config/database");
          await db.promise().query(
            `INSERT INTO wa_accounts (account_name, phone_number, connection_type, is_active, is_default)
             VALUES (?, ?, 'web_session', 1, 1)
             ON DUPLICATE KEY UPDATE
               account_name = VALUES(account_name),
               is_active = 1,
               updated_at = NOW()`,
            [`WhatsApp Web (${this.phone || 'Connected'})`, this.phone]
          );
        } catch (_) {}

        this.saveSessionMeta({
          sessionKey: this.key,
          phone: this.phone,
          status: "active",
          connectedAt: this.connectedAt,
          lastActiveAt: Date.now(),
        });

        this.emitWaEvent("wa_ready", null, this.phone, { connected: true, phone: this.phone, sessionKey: this.key });
        this.emitWaEvent("wa_connected", null, this.phone, { connected: true, phone: this.phone, sessionKey: this.key });
        try {
          require("./crmWebhookForwarder").forwardSessionStatus({ sessionKey: this.key, connected: true, phone: this.phone });
        } catch (_) {}

        (async () => {
          try {
            const res = await this.getChats(true);
            this.emitWaEvent("wa_chats_synced", null, this.phone, res);
          } catch (_) {}
          try {
            const res = await this.syncWhatsAppContacts();
            this.emitWaEvent("wa_contacts_synced", null, this.phone, res);
          } catch (_) {}
        })();
      });

      this.client.on("loading_screen", (percent, message) => {
        console.log(`⏳ WhatsApp session ${this.key} loading: ${percent}% - ${message || "WhatsApp"}`);
        this.emitWaEvent("wa_loading", null, null, { percent, message, sessionKey: this.key });
      });

      this.client.on("change_state", (state) => {
        console.log(`📶 WhatsApp session ${this.key} state changed: ${state}`);
        this.emitWaEvent("wa_state", null, null, { state, sessionKey: this.key });
      });

      this.client.on("authenticated", () => {
        this.qrCode = null;
        console.log(`🔐 WhatsApp session ${this.key} authenticated successfully.`);
        this.emitWaEvent("wa_authenticated", null, null, { sessionKey: this.key });
      });

      this.client.on("auth_failure", (msg) => {
        console.warn(`⚠️ WhatsApp session ${this.key} auth failure:`, msg);
        this.ready = false;
        this.qrCode = null;
        this.pairingCode = null;
        this.isInitializing = false;
        this.connectedAt = 0;
        this.isSyncing = false;
        if (this._quarantineTimer) {
          clearTimeout(this._quarantineTimer);
          this._quarantineTimer = null;
        }
        this._quarantineToken = null;
        this.emitWaEvent("wa_disconnected", null, this.phone, { reason: "AUTH_FAILURE", message: msg });
      });

      this.client.on("disconnected", (reason) => {
        const reasonStr = String(reason || "DISCONNECTED");
        console.log(`ℹ️ WhatsApp session ${this.key} disconnected (${reasonStr}).`);
        this.ready = false;
        this.qrCode = null;
        this.pairingCode = null;
        this.isInitializing = false;
        this.connectedAt = 0;
        this.isSyncing = false;
        if (this._quarantineTimer) {
          clearTimeout(this._quarantineTimer);
          this._quarantineTimer = null;
        }
        this._quarantineToken = null;

        this.emitWaEvent("wa_disconnected", null, this.phone, { reason: reasonStr });
        try {
          require("./crmWebhookForwarder").forwardSessionStatus({ sessionKey: this.key, connected: false, phone: this.phone, reason: reasonStr });
        } catch (_) {}

        // Only mark logged_out if it was an explicit LOGOUT from phone / user
        if (reasonStr.toUpperCase().includes("LOGOUT")) {
          this.markLoggedOut(reasonStr);
          console.log(`🔒 WhatsApp session ${this.key} logged out from phone. Auto-cleanup timer active.`);
        } else {
          // Transient network drop, NAVIGATION, or browser crash -> schedule automatic reconnect
          console.log(`🔄 Transient disconnect (${reasonStr}) — scheduling auto-reconnect for session ${this.key}...`);
          if (!this._reconnectScheduled) {
            this._reconnectScheduled = true;
            setTimeout(() => {
              this._reconnectScheduled = false;
              if (!this.ready && !this.isInitializing) {
                this.init(false).catch((err) => {
                  console.warn(`⚠️ Auto-reconnect failed for ${this.key}:`, err?.message || err);
                });
              }
            }, 5000);
          }
        }
      });

      const handleLiveMessage = (msg) => {
        const chatId = msg.fromMe ? msg.to : msg.from;
        if (!chatId) return;

        // Skip status broadcast updates
        if (chatId === "status@broadcast" || chatId.includes("@broadcast")) return;

        const isGroup = chatId.includes("@g.us") || Boolean(msg.isGroup);
        const digitsOnly = chatId.replace(/\D/g, "");
        let cleanPhone = digitsOnly;
        if (!isGroup && (chatId.includes("@lid") || digitsOnly.length >= 14)) {
          const mapped = this.lidToPhoneMap?.get(chatId) || this.lidToPhoneMap?.get(digitsOnly);
          if (mapped) cleanPhone = mapped;
        }
        const rawFilename = msg._data?.filename || (/\.(md|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|zip|rar|png|jpg|jpeg|webp|mp4|mp3|ogg|wav)$/i.test(msg.body || "") ? msg.body : "");
        const isMedia = Boolean(msg.hasMedia || msg.type === "document" || msg.type === "image" || msg.type === "video" || msg.type === "audio" || rawFilename);

        const msgTimestampSec = msg.timestamp || Math.floor(Date.now() / 1000);
        const msgTimestampMs = msgTimestampSec * 1000;
        const nowMs = Date.now();
        const connectedTime = this.connectedAt || nowMs;

        // ── 🛡️ STRICT CONNECTION & REPLAY QUARANTINE GUARD ─────────────────────
        // Connecting a WhatsApp number alone MUST NEVER trigger automated messages.
        // Distinguish genuine live customer replies from replayed sync messages:
        const isNewReply = Boolean(this.connectedAt > 0 && msgTimestampMs > (connectedTime - 15000));
        const isPreConnection = Boolean(this.connectedAt > 0 && msgTimestampMs <= (connectedTime - 15000));
        const isStale = false;
        const isSyncReplay = Boolean(this.isSyncing && isPreConnection);
        const isHistoricalOrSync = !isNewReply && (isPreConnection || isSyncReplay);

        const liveMsg = {
          id: msg.id?.id || `msg_${Date.now()}`,
          serializedId: msg.id?._serialized || msg.id?.id,
          from: msg.from,
          to: msg.to,
          body: rawFilename || msg.body || (isMedia ? "📷 Media attachment" : ""),
          timestamp: msgTimestampSec,
          isMe: Boolean(msg.fromMe),
          type: msg.type || (isMedia ? "document" : "text"),
          hasMedia: isMedia,
          filename: rawFilename || "",
          ack: typeof msg.ack === "number" ? msg.ack : null,
          status: WhatsAppService.ackToStatus(msg.ack) || (msg.fromMe ? "sent" : null),
          location: msg.type === "location" && msg.location
            ? { lat: msg.location.latitude, lng: msg.location.longitude, name: msg.location.description || "" }
            : null,
        };

        if (!this.messagesCache[chatId]) this.messagesCache[chatId] = [];
        if (!this.messagesCache[chatId].some((m) => m.id === liveMsg.id)) {
          this.messagesCache[chatId].unshift(liveMsg);
          if (this.messagesCache[chatId].length > 200) {
            this.messagesCache[chatId].length = 200;
          }
        }
        delete this.messagesFetchCache[chatId];

        // 1. Emit live Socket event INSTANTLY (< 1ms) so CRM operator sees message in chat
        const eventName = msg.fromMe ? "wa_message_sent" : "wa_message_received";
        this.emitWaEvent(eventName, chatId, cleanPhone, liveMsg);
        this.emitWaEvent("wa_message", chatId, cleanPhone, liveMsg);

        // 1b. Forward to connected External CRM webhook
        try {
          const crmWebhook = require("./crmWebhookForwarder");
          if (!msg.fromMe) {
            crmWebhook.forwardIncomingMessage({
              sessionKey: this.key,
              chatId,
              phone: cleanPhone,
              message: liveMsg,
            });
          }
        } catch (_) {}

        // 2. Async DB log and bot automation in background (zero blocking)
        process.nextTick(async () => {
          try {
            const db = require("../config/database");
            let phoneToStore = cleanPhone;
            if (!isGroup && (chatId.includes("@lid") || phoneToStore.length >= 14)) {
              const resolved = await this.resolveLidToPhone(chatId).catch(() => null);
              if (resolved && resolved.length <= 13) {
                phoneToStore = resolved;
                cleanPhone = resolved;
              }
            }

            await db.promise().query(
              `INSERT IGNORE INTO wa_message_logs (session_key, phone, direction, message_type, message_text, wa_message_id, status, created_at)
               VALUES (?, ?, ?, ?, ?, ?, 'delivered', FROM_UNIXTIME(?))`,
              [
                this.key,
                phoneToStore || chatId,
                msg.fromMe ? "outbound" : "inbound",
                liveMsg.type,
                liveMsg.body,
                liveMsg.id,
                msgTimestampSec
              ]
            );

            // Update contact last message in CRM for non-group chats ONLY if valid phone number
            if (!isGroup && phoneToStore && phoneToStore.length >= 10 && phoneToStore.length <= 13) {
              const countryCode = phoneToStore.length > 10 ? phoneToStore.slice(0, phoneToStore.length - 10) : "91";
              await db.promise().query(
                `INSERT INTO wa_contacts (name, phone, country_code, source, opt_in_status, last_message_text, last_message_at, unread_count)
                 VALUES (?, ?, ?, 'WhatsApp Chat', 1, ?, NOW(), ?)
                 ON DUPLICATE KEY UPDATE
                   last_message_text = VALUES(last_message_text),
                   last_message_at = NOW()`,
                [
                  msg.fromMe ? "Me" : (msg._data?.notifyName || formatPhoneDisplay(phoneToStore)),
                  phoneToStore,
                  countryCode,
                  liveMsg.body,
                  msg.fromMe ? 0 : 1
                ]
              ).catch(() => {});
            }
          } catch (_) {}

          // ── 🛡️ QUARANTINE ENFORCEMENT: NEVER TRIGGER AUTOMATION ON PAST/SYNC MESSAGES ──
          if (isHistoricalOrSync) {
            console.log(`🛡️ [WA Quarantine Guard] Ingested historical/sync message ${liveMsg.id} from ${cleanPhone || chatId} (sent: ${new Date(msgTimestampMs).toISOString()}) — all outbound automations suppressed.`);
            return;
          }

          // ── 🔗 AUTO-CAPTURE: Create CRM lead for first-time inbound WhatsApp contacts ──
          if (!msg.fromMe && !isGroup && cleanPhone) {
            try {
              const waLeadCapture = require("./waLeadCapture");
              const contactName = msg._data?.notifyName || msg.notifyName || null;
              waLeadCapture.captureLeadFromWhatsApp({
                phone: cleanPhone,
                name: contactName || undefined,
                notes: (liveMsg.body || "").slice(0, 500) || "Customer messaged via WhatsApp",
                sourceDetail: "WhatsApp Inbound",
              }).catch(() => {});
            } catch (_) {}
          }

          // Bot automations only run on inbound 1-to-1 chats, never on groups
          if (!msg.fromMe && !isGroup && cleanPhone) {
            const bodyTrimmed = (msg.body || "").trim().toLowerCase();
            const OPT_OUT_WORDS = ["stop", "unsubscribe", "optout", "opt out", "stop promo", "cancel", "don't message", "dont message"];
            const isOptOut = OPT_OUT_WORDS.some((kw) => bodyTrimmed === kw || bodyTrimmed.startsWith(kw));

            if (isOptOut) {
              try {
                const db = require("../config/database");
                await db.promise().query(
                  "INSERT IGNORE INTO wa_opt_outs (phone, reason, opt_out_keyword) VALUES (?, 'user_request', ?)",
                  [cleanPhone, bodyTrimmed]
                );
                await db.promise().query(
                  "UPDATE wa_contacts SET is_unsubscribed=1, opt_in_status=0, updated_at=NOW() WHERE phone LIKE ?",
                  [`%${cleanPhone.slice(-10)}`]
                );
                await db.promise().query(
                  "UPDATE wa_campaign_messages SET status='opted_out', opt_out=1, error='User opted out' WHERE phone=? AND status='queued'",
                  [cleanPhone]
                );
                // Send polite unsubscribe confirmation
                await this.sendMessage(chatId, "✅ You have been successfully unsubscribed. You will no longer receive promotional messages from us. Reply START anytime to re-subscribe.");
                return;
              } catch (_) {}
            }

            const interactiveReplyId = msg.selectedButtonId || msg.selectedRowId || msg.selectedListId || msg._data?.selectedButtonId || msg._data?.selectedRowId || null;
            const contactName = msg._data?.notifyName || msg.notifyName || null;

            // 1. Check if inbound message resolves a pending 2-way interactive confirmation
            const confirmationHandled = await require("./waConfirmationService").handleInboundConfirmation(cleanPhone, msg.body, interactiveReplyId, this.key, chatId).catch(() => false);
            if (confirmationHandled) return;

            // 2. Check if customer is requesting their bills / receipts (scoped strictly to their phone)
            const billHandled = await require("./waCustomerBillingService").handleInboundBillKeyword(cleanPhone, msg.body, this.key).catch(() => false);
            if (billHandled) return;

            // 3. Check if contact is replying to a bulk campaign (Campaign Isolation)
            const waCampaignEngine = require("./waCampaignEngine");
            const campaignReply = await waCampaignEngine.checkAndRecordCampaignReply(cleanPhone, msg.body).catch(() => ({ isCampaignReply: false }));
            const isCampaignReply = Boolean(campaignReply?.isCampaignReply);
            if (isCampaignReply) {
              this.emitWaEvent("wa_campaign_reply", chatId, cleanPhone, {
                campaignId: campaignReply.campaignId,
                campaignName: campaignReply.campaignName,
                flowId: campaignReply.flowId || null,
                body: msg.body,
              });

              // Direct Campaign -> Flow Bot Connection: If campaign has a linked flow, launch it!
              if (campaignReply.flowId) {
                try {
                  const db = require("../config/database");
                  const [cFlows] = await db.promise().query("SELECT * FROM wa_flows WHERE id = ? AND status = 'active' LIMIT 1", [campaignReply.flowId]);
                  if (cFlows.length > 0) {
                    console.log(`🚀 [Campaign -> Flow Bot] Launching linked Flow "${cFlows[0].name}" (#${cFlows[0].id}) for +${cleanPhone}`);
                    await require("./waFlowEngine").startFlowRun(cFlows[0], cleanPhone, this.key, msg.body, chatId);
                    return;
                  }
                } catch (cfErr) {
                  console.warn("[Campaign -> Flow Bot] Error launching linked flow:", cfErr.message);
                }
              }
            }

            // Describe any attachment, but DON'T download it yet — the engine
            // calls resolve() only if the step the customer is on wants a file.
            const inboundMedia = isMedia
              ? {
                  hasMedia: true,
                  type: msg.type || "document",
                  filename: rawFilename || "",
                  caption: msg.body || "",
                  resolve: () => this.getMediaForMessage(chatId, liveMsg.id, liveMsg.serializedId),
                }
              : null;

            // 4. Conversational Flow Engine dispatch
            const flowHandled = await require("./waFlowEngine").dispatchInbound(
              cleanPhone,
              msg.body,
              interactiveReplyId,
              this.key,
              inboundMedia,
              { isCampaignReply, isHistoric: false, chatId }
            ).catch(() => false);

            if (!flowHandled) {
              // 5. Menu keywords handler
              const handled = await require("./waMenuHandler").handleMenuReply(cleanPhone, { text: msg.body, buttonReplyId: interactiveReplyId }, this.key).catch(() => false);
              if (!handled) {
                // 6. Welcome Auto-Reply (Only when customer initiates conversation, strictly never on campaign replies)
                const welcomeSent = await require("./waAutomationService").maybeSendWelcomeReply(
                  chatId || cleanPhone,
                  contactName,
                  this.key,
                  { isCampaignReply }
                ).catch(() => false);

                // 7. AI Auto-Reply (Only if welcome not sent and not replying to campaign)
                if (!welcomeSent && !isCampaignReply) {
                  await require("./waAiReply").maybeAutoReply(chatId || cleanPhone, msg.body, contactName, this.key).catch(() => {});
                }
              }
            }
          }
        });
      };

      const processedMsgIds = new Set();
      const safeHandleLiveMessage = (msg) => {
        const msgId = msg.id?._serialized || msg.id?.id || `${msg.from}_${msg.timestamp}`;
        if (processedMsgIds.has(msgId)) return;
        processedMsgIds.add(msgId);
        if (processedMsgIds.size > 1000) {
          const first = processedMsgIds.values().next().value;
          processedMsgIds.delete(first);
        }
        handleLiveMessage(msg);
      };

      this.client.on("message_create", safeHandleLiveMessage);
      this.client.on("message", (msg) => {
        if (!msg.fromMe) safeHandleLiveMessage(msg);
      });

      // Real-time message emoji reactions
      this.client.on("message_reaction", (reaction) => {
        try {
          const chatId = reaction.msgId?.remote || (reaction.id?.fromMe ? reaction.id.to : reaction.id?.from);
          if (!chatId) return;
          const cleanPhone = (chatId || "").replace(/\D/g, "");
          const reactionData = {
            id: reaction.msgId?.id,
            serializedId: reaction.msgId?._serialized,
            reaction: reaction.reaction,
            senderId: reaction.senderId,
            timestamp: reaction.timestamp || Math.floor(Date.now() / 1000),
          };
          this.emitWaEvent("wa_message_reaction", chatId, cleanPhone, reactionData);
        } catch (_) {}
      });

      // Real-time message revoke / delete for everyone
      this.client.on("message_revoke_everyone", (after, before) => {
        try {
          const msg = before || after;
          const chatId = msg?.fromMe ? msg.to : msg?.from;
          if (!chatId) return;
          const cleanPhone = (chatId || "").replace(/\D/g, "");
          const msgId = msg?.id?.id;
          const serializedId = msg?.id?._serialized;
          this.emitWaEvent("wa_message_revoked", chatId, cleanPhone, { id: msgId, serializedId, revoked: true });
          const db = require("../config/database");
          db.promise().query(
            "UPDATE wa_message_logs SET message_text = '🚫 This message was deleted' WHERE wa_message_id = ? OR wa_message_id = ?",
            [msgId, serializedId || msgId]
          ).catch(() => {});
        } catch (_) {}
      });

      // Delivery receipts: keeps the tick marks honest (sent -> delivered -> read)
      // instead of the UI always claiming blue double-ticks.
      this.client.on("message_ack", (msg, ack) => {
        try {
          const status = WhatsAppService.ackToStatus(ack);
          if (!status) return;
          const chatId = msg.fromMe ? msg.to : msg.from;
          if (!chatId) return;
          const cleanPhone = chatId.replace(/\D/g, "");
          const msgId = msg.id?.id;
          const serializedId = msg.id?._serialized;

          const cached = this.messagesCache[chatId];
          if (Array.isArray(cached)) {
            const hit = cached.find((m) => m.id === msgId || m.serializedId === serializedId);
            if (hit) {
              hit.ack = ack;
              hit.status = status;
            }
          }

          this.emitWaEvent("wa_message_ack", chatId, cleanPhone, { id: msgId, serializedId, ack, status });

          const db = require("../config/database");
          const statusColumn = { sent: "sent_at", delivered: "delivered_at", read: "read_at" }[status];
          const sets = ["status = ?"];
          const params = [status];
          if (statusColumn) {
            sets.push(`${statusColumn} = NOW()`);
          }
          params.push(msgId, serializedId || msgId);
          db.promise().query(
            `UPDATE wa_message_logs SET ${sets.join(", ")} WHERE wa_message_id = ? OR wa_message_id = ?`,
            params
          ).catch(() => {});
        } catch (_) {}
      });

      await this.client.initialize();
    } catch (err) {
      this.isInitializing = false;
      const deadClient = this.client;
      this.client = null;
      try { await deadClient?.destroy?.(); } catch (_) {}

      const isCorruptedProfileErr =
        err?.message?.includes("Minified Invariant") ||
        err?.message?.includes("Invariant Violation") ||
        err?.message?.includes("Protocol error") ||
        err?.message?.includes("Session closed");

      if (isCorruptedProfileErr && !forceFresh) {
        console.warn(`⚠️ WhatsApp session profile for ${this.key} corrupted (${err.message}). Auto-purging stale files and retrying clean...`);
        try {
          killSessionBrowserProcesses(sessionPath);
          if (fs.existsSync(sessionPath)) {
            fs.rmSync(sessionPath, { recursive: true, force: true });
          }
        } catch (_) {}
        return this._doInit(true);
      }

      throw err;
    }
  }

  async sendMessage(chatId, message, options = {}) {
    const waCloud = require("./whatsappCloudApi");
    if (!chatId) throw new Error("chatId is required");

    let cleanPhone = String(chatId).replace(/\D/g, "");
    if (cleanPhone.length === 10) cleanPhone = "91" + cleanPhone;

    message = require("./mdToWa").toWhatsApp(message);
    const formattedJid = formatChatJid(chatId);
    let msgId = "sent_" + Date.now();
    const quotedId = options?.quotedMessageId || options?.replyToMessageId || null;

    let sentResult = null;
    let lastError = null;

    if (this.ready && this.client) {
      try {
        await this._paceSend();
        const sendOpts = {};
        if (quotedId) {
          sendOpts.quotedMessageId = quotedId;
        }

        sentResult = await this.enqueueSend(() =>
          this.withTimeout(
            this.client.sendMessage(formattedJid, message, sendOpts),
            20000,
            "client.sendMessage direct"
          )
        ).catch(async (e) => {
          lastError = e;
          console.warn(`⚠️ Direct send to ${formattedJid} failed (${e.message}), attempting JID resolution...`);
          const targetJid = await this.resolveTargetJid(formattedJid).catch(() => null);
          const altJid = targetJid && targetJid !== formattedJid ? targetJid : formattedJid;
          
          // Try sending to resolved target JID
          const res1 = await this.enqueueSend(() =>
            this.withTimeout(
              this.client.sendMessage(altJid, message, sendOpts),
              20000,
              "client.sendMessage fallback"
            )
          ).catch((err2) => {
            lastError = err2;
            console.warn(`⚠️ Fallback send to ${altJid} failed:`, err2.message);
            return null;
          });
          if (res1) return res1;

          // Try getChatById and chat.sendMessage
          try {
            const chat = await this.enqueue(() =>
              this.withTimeout(this.client.getChatById(altJid), 10000, "getChatById fallback")
            ).catch(() => null);
            if (chat && typeof chat.sendMessage === "function") {
              return await this.enqueueSend(() =>
                this.withTimeout(chat.sendMessage(message, sendOpts), 20000, "chat.sendMessage")
              );
            }
          } catch (chatErr) {
            lastError = chatErr;
          }

          return null;
        });
      } catch (err) {
        lastError = err;
        console.warn("⚠️ WhatsApp Web send error:", err.message);
      }
    }

    if (sentResult) {
      msgId = sentResult?.id?.id || sentResult?.id?._serialized || msgId;
    } else if (waCloud.isConfigured()) {
      console.log("⚡ Sending via Meta Cloud API for +", cleanPhone);
      try {
        const sent = await waCloud.sendText(cleanPhone, message);
        msgId = sent?.messages?.[0]?.id || msgId;
      } catch (cloudErr) {
        const errMsg = cloudErr.response?.data?.error?.message || cloudErr.message;
        console.error("Meta Cloud API sendText error:", errMsg);
        throw new Error(`Meta Cloud API error: ${errMsg}`);
      }
    } else {
      if (!this.ready || !this.client) {
        throw new Error("WhatsApp is not connected. Please scan QR Code or configure Meta Cloud API.");
      }
      const specificErr = lastError?.message || "Failed to deliver message via WhatsApp";
      throw new Error(specificErr);
    }

    const newMsg = {
      id: msgId,
      serializedId: sentResult?.id?._serialized || msgId,
      from: "me",
      to: cleanPhone,
      body: message,
      replyToMessageId: quotedId,
      timestamp: Math.floor(Date.now() / 1000),
      isMe: true,
      type: "text",
      status: "sent",
    };

    if (!this.messagesCache[chatId]) this.messagesCache[chatId] = [];
    if (!this.messagesCache[chatId].some((m) => m.id === newMsg.id)) {
      this.messagesCache[chatId].unshift(newMsg);
    }
    delete this.messagesFetchCache[chatId];

    this.emitWaEvent("wa_message_sent", chatId, cleanPhone, newMsg);
    try {
      require("./crmWebhookForwarder").forwardOutgoingMessage({
        sessionKey: this.key,
        chatId,
        phone: cleanPhone,
        message: newMsg,
      });
    } catch (_) {}

    process.nextTick(async () => {
      try {
        const db = require("../config/database");
        await db.promise().query(
          `INSERT INTO wa_message_logs (session_key, phone, direction, message_type, message_text, wa_message_id, reply_to_message_id, status, created_at)
           VALUES (?, ?, 'outbound', 'text', ?, ?, ?, 'sent', NOW())`,
          [this.key, cleanPhone, message, msgId, quotedId]
        );
        // Update contact last message in CRM
        await db.promise().query(
          `INSERT INTO wa_contacts (name, phone, country_code, source, opt_in_status, last_message_text, last_message_at, unread_count)
           VALUES (?, ?, '91', 'WhatsApp Chat', 1, ?, NOW(), 0)
           ON DUPLICATE KEY UPDATE
             last_message_text = VALUES(last_message_text),
             last_message_at = NOW()`,
          ["Me", cleanPhone, message]
        ).catch(() => {});
      } catch (e) {}
    });

    return { success: true, id: msgId, result: sentResult };
  }

  async getStatus() {
    if (!this.ready && this.client) {
      try {
        const state = await this.enqueue(() =>
          this.withTimeout(this.client.getState(), 3000, "getState")
        ).catch(() => null);

        if (state === "CONNECTED") {
          this.ready = true;
          this.qrCode = null;
          this.isInitializing = false;
          this.phone = this.client.info?.wid?.user || this.phone || null;
          console.log(`✅ WhatsApp Client detected CONNECTED state! Phone: ${this.phone}`);
          this.emitWaEvent("wa_ready", null, this.phone, { connected: true, phone: this.phone });

          // Trigger background sync for contacts & chat history if not already triggered
          setTimeout(() => {
            this.syncWhatsAppContacts().catch(() => {});
            this.syncWhatsAppChatsAndMessages().catch(() => {});
          }, 1000);
        }
      } catch (_) {}
    }

    const sessionMeta = this.getSessionMeta();
    let sessionExpiry = null;
    if (sessionMeta && sessionMeta.status === "logged_out" && sessionMeta.expiresAt) {
      const msLeft = Math.max(0, sessionMeta.expiresAt - Date.now());
      sessionExpiry = {
        loggedOutAt: sessionMeta.loggedOutAt,
        expiresAt: sessionMeta.expiresAt,
        hoursRemaining: Math.round(msLeft / (60 * 60 * 1000)),
        daysRemaining: +(msLeft / (24 * 60 * 60 * 1000)).toFixed(1),
      };
    }

    return {
      connected: this.ready,
      phone: this.phone || null,
      initializing: this.isInitializing,
      hasQr: !!this.qrCode,
      qr: this.qrCode || null,
      sessionExpiry,
    };
  }

  // Hibernates idle browser process while keeping saved LocalAuth profile on disk
  async hibernate() {
    if (!this.client) return;
    console.log(`💤 [VPS RAM Saver] Hibernating idle WhatsApp Web session ${this.key}`);
    this.clearQuarantineTimer();
    const deadClient = this.client;
    this.client = null;
    this.isInitializing = false;
    this._isHibernated = true;
    try {
      await deadClient.destroy().catch(() => {});
    } catch (_) {}
  }

  // Tears down a dead/crashed client and schedules a reconnect.
  // Called from the "disconnected" event and from server.js's crash guard —
  // whatsapp-web.js/puppeteer occasionally throws unhandled navigation-timing
  // errors deep inside the library, outside any of its own event handlers.
  forceReset(reason = "unknown") {
    console.warn(`⚠️ WhatsApp Web session force-reset (${reason})`);
    this.clearQuarantineTimer();
    const deadClient = this.client;
    this.ready = false;
    this.qrCode = null;
    this.phone = null;
    this.isInitializing = false;
    this.client = null;
    try { deadClient?.destroy?.().catch(() => {}); } catch (_) {}

    if (this._reconnectScheduled) return;
    this._reconnectScheduled = true;
    setTimeout(() => {
      this._reconnectScheduled = false;
      if (!this.ready && !this.isInitializing) {
        console.log("🔄 Auto-reconnecting WhatsApp Web session in background...");
        this.init(false).catch(() => {});
      }
    }, 10000);
  }

  async getUnifiedStatus() {
    const waCloud = require("./whatsappCloudApi");
    const cloudConfigured = waCloud.isConfigured();
    const status = await this.getStatus();
    const webConnected = status.connected;

    let activeEngine = "Disconnected";
    if (cloudConfigured && webConnected) activeEngine = "Dual (Cloud API + Web)";
    else if (cloudConfigured) activeEngine = "Meta Cloud API";
    else if (webConnected) activeEngine = "WhatsApp Web Session";

    const activePhone = (webConnected ? this.phone : null) || waCloud.displayPhoneNumber || (cloudConfigured ? waCloud.phoneNumberId : null);

    return {
      connected: cloudConfigured || webConnected,
      isCloud: cloudConfigured,
      isWeb: webConnected,
      activeEngine,
      phone: activePhone,
      qr: status.qr || this.qrCode || null,
      web: {
        connected: webConnected,
        phone: this.phone || null,
        initializing: this.isInitializing,
        hasQr: !!this.qrCode,
        qr: this.qrCode || null,
      },
      cloud: waCloud.getConfig(),
    };
  }

  async sendTestMessage(targetPhone, text = "Hello! This is a test message from Madhura Tech WhatsApp Engine.", enginePreference = null) {
    const waCloud = require("./whatsappCloudApi");
    const formattedPhone = targetPhone.replace(/\D/g, "");
    if (!formattedPhone) throw new Error("Valid phone number required");

    if (enginePreference === "web" || (this.ready && enginePreference !== "cloud_api" && enginePreference !== "meta")) {
      const chatId = `${formattedPhone}@c.us`;
      const res = await this.sendMessage(chatId, text);
      return { success: true, engineUsed: `WhatsApp Web (+${this.phone || "Own Number"})`, response: res };
    } else if (waCloud.isConfigured()) {
      const res = await waCloud.sendText(formattedPhone, text);
      return { success: true, engineUsed: "Meta Cloud API", response: res };
    } else if (this.ready) {
      const chatId = `${formattedPhone}@c.us`;
      const res = await this.sendMessage(chatId, text);
      return { success: true, engineUsed: `WhatsApp Web (+${this.phone || "Own Number"})`, response: res };
    } else {
      throw new Error("No active WhatsApp engine available. Please scan QR Code or configure Meta Cloud API.");
    }
  }

  async getPairingCode(phone) {
    if (!phone) throw new Error("Phone number is required");
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) throw new Error("Please enter a valid phone number with country code (e.g. 919876543210)");

    if (!this.client || (!this.isInitializing && !this.ready)) {
      await this.init(true);
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Pairing code generation timed out. Please try QR Code instead.")), 35000);
      const interval = setInterval(async () => {
        try {
          if (this.client && typeof this.client.requestPairingCode === "function") {
            clearInterval(interval);
            clearTimeout(timer);
            const code = await this.client.requestPairingCode(cleanPhone);
            console.log("✅ WhatsApp Pairing Code generated:", code);
            resolve(code);
          }
        } catch (e) {
          clearInterval(interval);
          clearTimeout(timer);
          reject(e);
        }
      }, 500);
    });
  }

  // Dynamic In-Page QR Refresh: If the browser is running on WhatsApp Web, refresh
  // the QR code in-place using Puppeteer instead of restarting the whole browser engine!
  async refreshQr() {
    if (this.ready) return { connected: true, qr: null, message: "Already connected" };
    if (this._isRefreshingQr) {
      return {
        connected: false,
        qr: this.qrCode || null,
        refreshed: false,
        message: "QR refresh already in progress",
      };
    }
    this._isRefreshingQr = true;
    this.qrCode = null;
    this.qrCodeAt = 0;
    this._getQrPromise = null;

    try {
      if (this.client && this.client.pupPage && !this.client.pupPage.isClosed()) {
        try {
          console.log(`🔄 [Dynamic QR] Refreshing in-page QR for session ${this.key}...`);

          // Try clicking WhatsApp Web's reload button if present (appears when QR expires)
          const clickedReload = await this.client.pupPage.evaluate(() => {
            const reloadBtn = document.querySelector('button[role="button"]') ||
                              document.querySelector('div[data-ref]') ||
                              document.querySelector('span[data-icon="refresh"]') ||
                              document.querySelector('[data-testid="qrcode"] + div button');
            if (reloadBtn && typeof reloadBtn.click === "function") {
              reloadBtn.click();
              return true;
            }
            return false;
          }).catch(() => false);

          if (!clickedReload) {
            await this.client.pupPage.reload({ waitUntil: "load", timeout: 25000 }).catch(() => {});
          }

          const newQr = await this._waitForQr(15000).catch(() => null);
          return {
            connected: false,
            qr: newQr || this.qrCode || null,
            refreshed: true,
            message: (newQr || this.qrCode) ? "QR Refreshed" : "QR refreshing in background",
          };
        } catch (err) {
          console.warn(`⚠️ [Dynamic QR] In-page refresh failed (${err.message}), falling back to init...`);
        }
      }

      // Fallback: if browser was stopped, boot it cleanly
      await this.init(false).catch(() => {});
      const qr = await this._waitForQr(15000).catch(() => null);
      return {
        connected: this.ready,
        qr: qr || this.qrCode || null,
        refreshed: true,
        message: this.ready ? "Connected" : (qr || this.qrCode) ? "QR Ready" : "Initializing WhatsApp engine...",
      };
    } finally {
      this._isRefreshingQr = false;
    }
  }

  // Purely waits for QR event or returns cached QR without triggering init or refresh
  _waitForQr(timeout = 15000) {
    if (this.ready) return Promise.resolve(null);
    if (this.qrCode && this.qrCodeAt && (Date.now() - this.qrCodeAt < 25000)) {
      return Promise.resolve(this.qrCode);
    }

    return new Promise((resolve) => {
      let resolved = false;
      const done = (val) => {
        if (resolved) return;
        resolved = true;
        clearInterval(checkTimer);
        clearTimeout(timeoutTimer);
        const idx = this.qrCallbacks.indexOf(onQr);
        if (idx !== -1) this.qrCallbacks.splice(idx, 1);
        resolve(val);
      };

      const checkTimer = setInterval(() => {
        if (this.qrCode) return done(this.qrCode);
        if (this.ready) return done(null);
      }, 200);

      const timeoutTimer = setTimeout(() => {
        done(this.qrCode || null);
      }, timeout);

      const onQr = (qr) => done(qr);
      this.qrCallbacks.push(onQr);
    });
  }

  async getQr(timeout = 25000) {
    if (this.ready) return null; // already connected via a restored session — no QR needed
    if (this.qrCode && this.qrCodeAt && (Date.now() - this.qrCodeAt < 25000)) return this.qrCode;

    if (!this.client && !this.isInitializing) {
      this.init(false).catch((err) => {
        console.warn("⚠️ WhatsApp init error in getQr:", err?.message || err);
      });
    }

    if (this._getQrPromise) {
      return this._getQrPromise;
    }

    this._getQrPromise = this._waitForQr(timeout).finally(() => {
      this._getQrPromise = null;
    });

    return this._getQrPromise;
  }

  // CRM fallback contacts barely change minute-to-minute — cache them for 5
  // minutes unless forceRefresh is requested.
  async getCrmFallbackContacts(force = false) {
    const now = Date.now();
    if (!force && this._crmCache && now - (this._crmCacheAt || 0) < 5 * 60 * 1000) {
      return this._crmCache;
    }

    const db = require("../config/database");
    const contactsMap = new Map();
    const sources = [
      ["clients", "COALESCE(NULLIF(TRIM(name), ''), NULLIF(TRIM(company_name), ''), 'Client')", "phone", "Client"],
      ["telecalls", "COALESCE(NULLIF(TRIM(customer_name), ''), NULLIF(TRIM(company_name), ''), 'Lead')", "mobile_number", "Telecalling"],
      ["walkins", "COALESCE(NULLIF(TRIM(customer_name), ''), NULLIF(TRIM(company_name), ''), 'Walkin')", "mobile_number", "Walkin"],
      ["fields", "COALESCE(NULLIF(TRIM(customer_name), ''), NULLIF(TRIM(company_name), ''), 'Field')", "mobile_number", "Field"],
    ];

    try {
      for (const [table, nameExpr, phoneCol, label] of sources) {
        const [rows] = await db.promise().query(
          `SELECT ${nameExpr} as name, ${phoneCol} as phone FROM ${table} WHERE ${phoneCol} IS NOT NULL AND ${phoneCol} != '' ORDER BY id DESC LIMIT 500`
        );
        rows.forEach((c) => {
          const cleanPhone = (c.phone || "").replace(/\D/g, "").slice(-10);
          if (cleanPhone.length === 10 && !contactsMap.has(cleanPhone)) {
            contactsMap.set(cleanPhone, { name: c.name, phone: cleanPhone, source: label });
          }
        });
      }

      const [waContacts] = await db.promise().query(
        "SELECT name, phone, source FROM wa_contacts WHERE is_blocked = 0 ORDER BY id DESC LIMIT 500"
      );
      waContacts.forEach((c) => {
        const cleanPhone = (c.phone || "").replace(/\D/g, "").slice(-10);
        if (cleanPhone.length === 10) {
          if (!contactsMap.has(cleanPhone) || contactsMap.get(cleanPhone).name.startsWith("+")) {
            contactsMap.set(cleanPhone, { name: c.name || `+91 ${cleanPhone}`, phone: cleanPhone, source: c.source || "WhatsApp Contact" });
          }
        }
      });
    } catch (e) {
      console.error("CRM contacts load error:", e.message);
    }

    const contacts = Array.from(contactsMap.values());
    this._crmCache = contacts;
    this._crmCacheAt = now;
    return contacts;
  }

  async getChats(forceRefresh = false) {
    const now = Date.now();
    // Fast path 1: Instant cache return (< 1ms)
    if (!forceRefresh && (now - this.lastChatsFetch < 15000) && this.chatsCache.length > 0) {
      return this.chatsCache;
    }
    // Fast path 2: Return existing cache immediately while refreshing in background
    if (this.chatsCache.length > 0 && !forceRefresh) {
      if (!this.chatsFetching) {
        process.nextTick(() => this.getChats(true).catch(() => {}));
      }
      return this.chatsCache;
    }
    this.chatsFetching = true;

    const chatMap = new Map(); // dedupeKey -> chatObject
    const db = require("../config/database");

    // 1. Fetch live chats from WhatsApp Web if connected
    if (this.ready && this.client) {
      try {
        const fetchTimeout = forceRefresh ? 25000 : 12000;
        let rawChats = await this.enqueue(() =>
          this.withTimeout(this.client.getChats(), fetchTimeout, "WhatsApp Web getChats")
        ).catch((err) => {
          console.warn("⚠️ [WhatsApp Web] getChats took too long or errored:", err?.message || err);
          return [];
        });

        // 1a. Identify all LID chats and batch resolve to real phone numbers
        const lidChatIds = (rawChats || [])
          .filter((c) => c.id?._serialized?.includes("@lid") || c.id?.server === "lid")
          .map((c) => c.id?._serialized || String(c.id));
        if (lidChatIds.length > 0) {
          await this.resolveLidsBatch(lidChatIds).catch(() => {});
        }

        // 1b. Collect all clean 10-digit phones and LIDs for name enrichment lookup in DB
        const lookupTerms = [];
        (rawChats || []).forEach((c) => {
          const cid = c.id?._serialized || String(c.id);
          const digits = (c.id?.user || "").replace(/\D/g, "");
          if (digits) lookupTerms.push(digits);
          const resolved = this.lidToPhoneMap.get(cid) || this.lidToPhoneMap.get(digits);
          if (resolved) lookupTerms.push(resolved);
        });

        const contactNameMap = new Map();
        if (lookupTerms.length > 0) {
          try {
            const uniqueTerms = Array.from(new Set(lookupTerms.filter((t) => t.length >= 10))).slice(0, 150);
            if (uniqueTerms.length > 0) {
              const [dbContacts] = await db.promise().query(
                `SELECT name, phone, profile_pic_url, avatar_url FROM wa_contacts 
                 WHERE ${uniqueTerms.map(() => "phone LIKE ?").join(" OR ")}`,
                uniqueTerms.map((t) => `%${t.slice(-10)}%`)
              );
              (dbContacts || []).forEach((row) => {
                const c10 = (row.phone || "").replace(/\D/g, "").slice(-10);
                if (c10 && row.name && !row.name.startsWith("+") && !contactNameMap.has(c10)) {
                  contactNameMap.set(c10, {
                    name: row.name,
                    pic: row.profile_pic_url || row.avatar_url || null,
                  });
                }
              });
            }
          } catch (_) {}
        }

        // 1c. Process and deduplicate each live chat
        (rawChats || []).forEach((c) => {
          const chatId = c.id?._serialized || String(c.id);
          const isGroup = Boolean(c.isGroup || (chatId && chatId.includes("@g.us")));

          let realPhone = null;
          let clean10 = null;
          if (!isGroup) {
            if (chatId.includes("@lid") || c.id?.server === "lid") {
              const resolved = this.lidToPhoneMap.get(chatId) || this.lidToPhoneMap.get(c.id?.user);
              if (resolved && resolved.length >= 10 && resolved.length <= 13) {
                realPhone = resolved;
                clean10 = resolved.slice(-10);
              }
            } else {
              const userDigits = (c.id?.user || "").replace(/\D/g, "");
              if (userDigits && userDigits.length >= 10 && userDigits.length <= 13) {
                realPhone = userDigits;
                clean10 = userDigits.slice(-10);
              }
            }
          }

          // Strict Deduplication Key:
          // Groups -> group JID
          // Individual chats -> normalized 10-digit phone if available, else canonical chatId
          const dedupeKey = isGroup ? chatId : (clean10 && clean10.length === 10 ? clean10 : chatId);

          // Name Resolution:
          // 1) Saved contact name from address book (c.name)
          // 2) CRM DB name (from wa_contacts)
          // 3) WhatsApp pushname / public profile name (c.pushname)
          // 4) Clean formatted phone number (e.g. +91 98765 43210)
          // NEVER raw 14+ digit LID string
          let resolvedName = c.name;
          const rawNameDigits = (resolvedName || "").replace(/\D/g, "");
          const isBogusName = !resolvedName || 
                              resolvedName === "Unknown" || 
                              resolvedName.startsWith("+") || 
                              (rawNameDigits.length >= 13 && !rawNameDigits.startsWith("120363")) ||
                              resolvedName.includes("@lid");

          if (clean10 && contactNameMap.has(clean10)) {
            const dbMatch = contactNameMap.get(clean10);
            if (dbMatch.name) {
              resolvedName = dbMatch.name;
            }
          } else if (isBogusName && c.pushname && !c.pushname.includes("@lid")) {
            resolvedName = c.pushname;
          }

          if (isBogusName && (!resolvedName || resolvedName.includes("@lid") || (resolvedName.replace(/\D/g, "").length >= 13 && !resolvedName.replace(/\D/g, "").startsWith("120363")))) {
            if (realPhone) {
              resolvedName = formatPhoneDisplay(realPhone);
            } else if (!isGroup) {
              resolvedName = "WhatsApp Contact";
            } else {
              resolvedName = "Group Chat";
            }
          }

          const chatObj = {
            id: chatId,
            phoneNumber: realPhone || (isGroup ? null : (c.id?.user?.length <= 13 ? c.id?.user : null)),
            formattedPhone: isGroup ? "Group Chat" : (realPhone ? formatPhoneDisplay(realPhone) : ""),
            name: resolvedName || "WhatsApp Contact",
            unreadCount: c.unreadCount || 0,
            timestamp: c.timestamp || Math.floor(Date.now() / 1000),
            isPinned: Boolean(c.pinned || c.isPinned),
            isGroup: isGroup,
            isMuted: Boolean(c.isMuted),
            profilePicUrl: (clean10 && contactNameMap.get(clean10)?.pic) || null,
            lastMessage: c.lastMessage
              ? {
                  body: describeLastMessage(c.lastMessage),
                  timestamp: c.lastMessage.timestamp,
                  fromMe: Boolean(c.lastMessage.fromMe),
                  type: c.lastMessage.type || null,
                  hasMedia: Boolean(c.lastMessage.hasMedia),
                  status: WhatsAppService.ackToStatus(c.lastMessage.ack),
                }
              : null,
            hasMessages: true,
          };

          if (chatMap.has(dedupeKey)) {
            const existing = chatMap.get(dedupeKey);
            // Merge duplicates: prefer newer timestamp, prefer @c.us if available
            if ((chatObj.timestamp || 0) > (existing.timestamp || 0)) {
              existing.timestamp = chatObj.timestamp;
              if (chatObj.lastMessage) existing.lastMessage = chatObj.lastMessage;
            }
            if (chatObj.unreadCount) existing.unreadCount = Math.max(existing.unreadCount, chatObj.unreadCount);
            if (!existing.phoneNumber && chatObj.phoneNumber) {
              existing.phoneNumber = chatObj.phoneNumber;
              existing.formattedPhone = chatObj.formattedPhone;
            }
            if (chatId.includes("@c.us") && existing.id.includes("@lid")) {
              existing.id = chatId; // Prefer @c.us for direct sending
            }
            if ((!existing.name || existing.name === "WhatsApp Contact" || existing.name.startsWith("+")) && chatObj.name && !chatObj.name.startsWith("+")) {
              existing.name = chatObj.name;
            }
          } else {
            chatMap.set(dedupeKey, chatObj);
          }
        });

        // 1d. Auto-persist scanned session chats into wa_contacts
        process.nextTick(async () => {
          try {
            for (const chat of chatMap.values()) {
              if (chat.isGroup || !chat.phoneNumber) continue;
              const cleanDigits = chat.phoneNumber.replace(/\D/g, "");
              if (cleanDigits.length < 10 || cleanDigits.length > 13) continue;
              const countryCode = cleanDigits.length > 10 ? cleanDigits.slice(0, cleanDigits.length - 10) : "91";
              await db.promise().query(
                `INSERT INTO wa_contacts (name, phone, country_code, source, opt_in_status, last_message_text, last_message_at, unread_count)
                 VALUES (?, ?, ?, 'WhatsApp Account', 1, ?, FROM_UNIXTIME(?), ?)
                 ON DUPLICATE KEY UPDATE
                   name = IF(name IS NULL OR name = '' OR name LIKE '+%', VALUES(name), name),
                   last_message_text = COALESCE(VALUES(last_message_text), last_message_text),
                   last_message_at = COALESCE(VALUES(last_message_at), last_message_at)`,
                [
                  chat.name || `+${cleanDigits}`,
                  cleanDigits,
                  countryCode,
                  chat.lastMessage?.body || null,
                  chat.timestamp || Math.floor(Date.now() / 1000),
                  chat.unreadCount || 0
                ]
              ).catch(() => {});
            }
          } catch (_) {}
        });

      } catch (err) {
        console.error("WhatsApp Web fetch chats error:", err.message);
      }
    } else {
      // 2. Client is OFFLINE: display historical conversation logs for THIS session key only
      try {
        const [recentLogs] = await db.promise().query(
          `SELECT phone, direction, message_text, message_type, status, created_at, wa_message_id
           FROM wa_message_logs
           WHERE (session_key = ? OR session_key IS NULL)
             AND LENGTH(phone) <= 13
           ORDER BY id DESC LIMIT 250`,
          [this.key]
        );

        recentLogs.forEach((log) => {
          const cleanPhone = (log.phone || "").replace(/\D/g, "");
          if (!cleanPhone || cleanPhone.length < 10 || cleanPhone.length > 13) return;
          const clean10 = cleanPhone.slice(-10);
          const chatId = `91${clean10}@c.us`;
          const logTime = Math.floor(new Date(log.created_at).getTime() / 1000);

          if (!chatMap.has(clean10)) {
            chatMap.set(clean10, {
              id: chatId,
              phoneNumber: cleanPhone,
              formattedPhone: formatPhoneDisplay(cleanPhone),
              name: `+91 ${clean10}`,
              unreadCount: 0,
              timestamp: logTime,
              isGroup: false,
              lastMessage: {
                body: log.message_text || "",
                timestamp: logTime,
                fromMe: log.direction === "outbound",
                type: log.message_type || null,
                status: log.direction === "outbound" ? (log.status || "sent") : null,
              },
              hasMessages: true,
            });
          }
        });

        // Enrich offline names from wa_contacts
        const phones = Array.from(chatMap.keys());
        if (phones.length > 0) {
          const [waContacts] = await db.promise().query(
            `SELECT name, phone, profile_pic_url, avatar_url FROM wa_contacts WHERE (${phones.map(() => "phone LIKE ?").join(" OR ")})`,
            phones.map((p) => `%${p}`)
          );
          (waContacts || []).forEach((c) => {
            const clean10 = (c.phone || "").replace(/\D/g, "").slice(-10);
            if (chatMap.has(clean10)) {
              const chat = chatMap.get(clean10);
              if (c.name && (!chat.name || chat.name.startsWith("+"))) {
                chat.name = c.name;
              }
              if (c.profile_pic_url || c.avatar_url) {
                chat.profilePicUrl = c.profile_pic_url || c.avatar_url;
              }
            }
          });
        }
      } catch (e) {
        console.error("Offline fast DB chat fetch error:", e.message);
      }
    }

    const finalChats = Array.from(chatMap.values());
    finalChats.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return (b.timestamp || 0) - (a.timestamp || 0);
    });

    this.chatsCache = finalChats;
    this.lastChatsFetch = now;
    this.chatsFetching = false;
    return this.chatsCache;
  }

  async getProfilePicUrl(chatId) {
    if (!chatId) return null;
    const cleanPhone = String(chatId).replace(/\D/g, "").slice(-10);
    const db = require("../config/database");

    // 1. Check in wa_contacts DB first
    try {
      const [rows] = await db.promise().query(
        "SELECT profile_pic_url, avatar_url FROM wa_contacts WHERE phone LIKE ? LIMIT 1",
        [`%${cleanPhone}`]
      );
      if (rows[0] && (rows[0].profile_pic_url || rows[0].avatar_url)) {
        return rows[0].profile_pic_url || rows[0].avatar_url;
      }
    } catch (_) {}

    // 2. Fetch live from WhatsApp Web client if connected
    if (this.ready && this.client) {
      try {
        const fullChatId = chatId.includes("@") ? chatId : `91${cleanPhone}@c.us`;
        const picUrl = await this.enqueue(() =>
          this.withTimeout(this.client.getProfilePicUrl(fullChatId), 4000, "getProfilePicUrl")
        ).catch(() => null);

        if (picUrl) {
          await db.promise().query(
            "UPDATE wa_contacts SET profile_pic_url = ? WHERE phone LIKE ?",
            [picUrl, `%${cleanPhone}`]
          ).catch(() => {});
          return picUrl;
        }
      } catch (_) {}
    }

    return null;
  }

  async getMessages(chatId, forceRefresh = false, limit = 10) {
    const now = Date.now();
    const numericLimit = (limit === "all" || !limit) ? 250 : parseInt(limit, 10) || 10;
    const cacheKey = `${chatId}_${numericLimit}`;

    const digitsOnly = chatId.replace(/\D/g, "");
    const clean10 = digitsOnly.length >= 10 ? digitsOnly.slice(-10) : digitsOnly;

    // 1. Fast DB message fetch (< 5ms response time)
    const dbMsgs = [];
    try {
      const db = require("../config/database");
      const dbLimit = Math.max(numericLimit, 50);
      const [rows] = await db.promise().query(
        `SELECT id, phone, direction, message_type, message_text as body, created_at, wa_message_id, status
         FROM wa_message_logs
         WHERE (session_key = ? OR session_key IS NULL OR session_key = '1' OR session_key = 'default')
           AND (phone LIKE ? OR phone LIKE ? OR phone LIKE ? OR phone = ?)
         ORDER BY created_at DESC LIMIT ?`,
        [this.key, `%${clean10}%`, `%${digitsOnly}%`, `%${chatId}%`, digitsOnly, dbLimit]
      );
      rows.forEach((r) => {
        const isFile = (r.message_type && r.message_type !== "text" && r.message_type !== "location") || /\.(md|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|zip|rar|png|jpg|jpeg|webp|mp4|mp3|ogg|wav)$/i.test(r.body || "");
        dbMsgs.push({
          id: r.wa_message_id || `db_${r.id}`,
          from: r.direction === "inbound" ? r.phone : "me",
          body: r.body || (r.message_type === "media" ? "📎 Attachment" : r.message_type === "location" ? "📍 Location" : ""),
          timestamp: Math.floor(new Date(r.created_at).getTime() / 1000),
          isMe: r.direction === "outbound",
          hasMedia: Boolean(isFile),
          type: r.message_type || (isFile ? "document" : "text"),
          filename: r.body || "",
          status: r.direction === "outbound" ? (r.status || "sent") : null,
        });
      });
    } catch (e) {
      console.error("DB message fetch error:", e.message);
    }

    let liveMsgs = this.messagesCache[chatId] || [];

    // 2. Non-blocking background fetch if empty or forceRefresh to keep UI ultra-fast (< 5ms)
    if (this.ready && this.client && (forceRefresh || (!liveMsgs.length && dbMsgs.length === 0))) {
      process.nextTick(async () => {
        try {
          const formattedChatId = formatChatJid(chatId);
          let chat = await this.enqueue(() => this.withTimeout(this.client.getChatById(formattedChatId), 3000, "WhatsApp Web getChatById")).catch(() => null);
          if (!chat && formattedChatId !== chatId) {
            chat = await this.enqueue(() => this.withTimeout(this.client.getChatById(chatId), 2500, "WhatsApp Web getChatById fallback")).catch(() => null);
          }
          if (chat) {
            const fetchLimit = Math.max(numericLimit, 50);
            const msgs = await this.enqueue(() => this.withTimeout(chat.fetchMessages({ limit: fetchLimit }), 3000, "WhatsApp Web fetchMessages")).catch(() => []);
            const freshLive = msgs.map((m) => {
              const filename = m._data?.filename || (/\.(md|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|zip|rar|png|jpg|jpeg|webp|mp4|mp3|ogg|wav)$/i.test(m.body || "") ? m.body : "");
              const isMedia = Boolean(m.hasMedia || m.type === "document" || m.type === "image" || m.type === "video" || m.type === "audio" || filename);
              return {
                id: m.id.id,
                serializedId: m.id._serialized || m.id.id,
                from: m.from,
                body: filename || describeLastMessage(m) || m.body || "",
                timestamp: m.timestamp,
                isMe: m.fromMe,
                type: m.type || (isMedia ? "document" : "text"),
                hasMedia: isMedia,
                filename: filename || "",
                ack: typeof m.ack === "number" ? m.ack : null,
                status: WhatsAppService.ackToStatus(m.ack) || (m.fromMe ? "sent" : null),
                location: m.type === "location" && m.location
                  ? { lat: m.location.latitude, lng: m.location.longitude, name: m.location.description || "" }
                  : null,
              };
            });
            if (freshLive.length) {
              this.messagesCache[chatId] = freshLive;

              // Auto-persist loaded chat messages into wa_message_logs DB
              const db = require("../config/database");
              for (const m of freshLive) {
                await db.promise().query(
                  `INSERT IGNORE INTO wa_message_logs (session_key, phone, direction, message_type, message_text, wa_message_id, status, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, 'sent', FROM_UNIXTIME(?))`,
                  [
                    this.key,
                    digitsOnly,
                    m.isMe ? "outbound" : "inbound",
                    m.hasMedia ? (m.type || "media") : "text",
                    m.body || describeLastMessage(m) || "",
                    m.id,
                    m.timestamp || Math.floor(Date.now() / 1000)
                  ]
                ).catch(() => {});
              }
              this.emitWaEvent("wa_chat_history_updated", chatId, digitsOnly, { count: freshLive.length });
            }
          }
        } catch (_) {}
      });
    }

    const msgMap = new Map();
    liveMsgs.forEach((m) => msgMap.set(m.id, m));
    dbMsgs.forEach((m) => {
      if (!msgMap.has(m.id)) {
        msgMap.set(m.id, m);
      }
    });

    const allMsgs = Array.from(msgMap.values());
    allMsgs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    const sliced = (limit === "all") ? allMsgs : allMsgs.slice(0, numericLimit);
    this.messagesFetchCache[cacheKey] = { data: sliced, at: now };
    return sliced;
  }

  async sendSeen(chatId) {
    if (!chatId) return { success: false };
    try {
      const cleanPhone = chatId.replace(/\D/g, "").slice(-10);
      const digitsOnly = chatId.replace(/\D/g, "");

      // 1. WhatsApp Web mark as seen
      if (this.ready && this.client) {
        const formattedChatId = formatChatJid(chatId);
        await this.enqueue(async () => {
          try {
            if (this.client.sendSeen) {
              await this.withTimeout(this.client.sendSeen(formattedChatId), 2000, "sendSeen").catch(() => {});
            }
            const chat = await this.client.getChatById(formattedChatId).catch(() => null);
            if (chat && chat.sendSeen) {
              await this.withTimeout(chat.sendSeen(), 2000, "chat.sendSeen").catch(() => {});
            }
          } catch (_) {}
        }).catch(() => {});
      }

      // 2. Clear unread in database
      const db = require("../config/database");
      await db.promise().query(
        "UPDATE wa_contacts SET unread_count = 0 WHERE phone LIKE ? OR phone LIKE ?",
        [`%${cleanPhone}`, `%${digitsOnly}`]
      ).catch(() => {});

      await db.promise().query(
        "UPDATE wa_message_logs SET is_read = 1 WHERE (phone LIKE ? OR phone LIKE ?) AND direction = 'inbound'",
        [`%${cleanPhone}`, `%${digitsOnly}`]
      ).catch(() => {});

      // 3. Emit real-time read event to UI
      this.emitWaEvent("wa_chat_read", chatId, digitsOnly, { unreadCount: 0 });
      return { success: true, chatId };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async sendReaction(chatId, messageId, emoji) {
    if (!chatId || !messageId) return { success: false };
    try {
      if (this.ready && this.client) {
        const formattedChatId = formatChatJid(chatId);
        const chat = await this.client.getChatById(formattedChatId).catch(() => null);
        if (chat) {
          const msgs = await chat.fetchMessages({ limit: 50 }).catch(() => []);
          const target = msgs.find((m) => m.id?.id === messageId || m.id?._serialized === messageId);
          if (target && target.react) {
            await target.react(emoji);
            this.emitWaEvent("wa_message_reaction", chatId, chatId.replace(/\D/g, ""), { id: messageId, reaction: emoji });
            return { success: true };
          }
        }
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async deleteMessage(chatId, messageId, everyone = true) {
    if (!chatId || !messageId) return { success: false };
    try {
      if (this.ready && this.client) {
        const formattedChatId = formatChatJid(chatId);
        const chat = await this.client.getChatById(formattedChatId).catch(() => null);
        if (chat) {
          const msgs = await chat.fetchMessages({ limit: 50 }).catch(() => []);
          const target = msgs.find((m) => m.id?.id === messageId || m.id?._serialized === messageId);
          if (target && target.delete) {
            await target.delete(everyone);
            this.emitWaEvent("wa_message_revoked", chatId, chatId.replace(/\D/g, ""), { id: messageId, revoked: true });
            const db = require("../config/database");
            await db.promise().query(
              "UPDATE wa_message_logs SET message_text = '🚫 This message was deleted' WHERE wa_message_id = ? OR wa_message_id = ?",
              [messageId, messageId]
            ).catch(() => {});
            return { success: true };
          }
        }
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async sendTypingState(chatId, isTyping = true) {
    if (!chatId) return { success: false };
    try {
      if (this.ready && this.client) {
        const formattedChatId = formatChatJid(chatId);
        const chat = await this.client.getChatById(formattedChatId).catch(() => null);
        if (chat) {
          if (isTyping && chat.sendStateTyping) {
            await chat.sendStateTyping().catch(() => {});
          } else if (chat.clearState) {
            await chat.clearState().catch(() => {});
          }
          return { success: true };
        }
      }
      return { success: true };
    } catch (_) {
      return { success: false };
    }
  }

  async getContactBalance(phone) {
    if (!phone) return { phone: "", clientName: "N/A", companyName: "N/A", source: "Unknown", totalInvoiced: 0, totalPaid: 0, pendingBalance: 0 };
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    const fullPhone = phone.replace(/\D/g, "");
    const db = require("../config/database");

    let clientName = "";
    let companyName = "";
    let source = "WhatsApp Contact";

    try {
      const [clients] = await db.promise().query(
        "SELECT id, name, company_name FROM clients WHERE phone LIKE ? OR phone LIKE ? LIMIT 1",
        [`%${cleanPhone}`, `%${fullPhone}`]
      ).catch(() => [[]]);
      if (clients && clients.length > 0) {
        clientName = clients[0].name || "";
        companyName = clients[0].company_name || clients[0].name || "";
        source = "Client";
      } else {
        const [telecalls] = await db.promise().query(
          "SELECT customer_name, company_name FROM telecalls WHERE mobile_number LIKE ? LIMIT 1",
          [`%${cleanPhone}`]
        ).catch(() => [[]]);
        if (telecalls && telecalls.length > 0) {
          clientName = telecalls[0].customer_name || "";
          companyName = telecalls[0].company_name || telecalls[0].customer_name || "";
          source = "Telecalling";
        }
      }
    } catch (_) {}

    let totalInvoiced = 0;
    let totalPaid = 0;
    let pendingBalance = 0;

    const searchComp = companyName || clientName;
    if (searchComp) {
      try {
        const [invRows] = await db.promise().query(
          `SELECT i.id, 
                  COALESCE((SELECT SUM(qty * rate) FROM clientinvoice_items WHERE invoice_id = i.id), 0) as inv_total,
                  COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id = i.id), 0) as paid_total
           FROM clientinvoices i
           WHERE i.client_company = ? OR i.customer_name = ?`,
          [searchComp, clientName]
        ).catch(() => [[]]);

        if (invRows && invRows.length) {
          invRows.forEach(r => {
            totalInvoiced += Number(r.inv_total || 0);
            totalPaid += Number(r.paid_total || 0);
          });
          pendingBalance = Math.max(0, totalInvoiced - totalPaid);
        }
      } catch (e) {
        console.error("Balance query error:", e.message);
      }
    }

    return {
      phone: cleanPhone,
      clientName: clientName || `+91 ${cleanPhone}`,
      companyName: companyName || clientName || "N/A",
      source,
      totalInvoiced,
      totalPaid,
      pendingBalance,
    };
  }

  async getAccountBalance() {
    const db = require("../config/database");
    let totalSent = 0;
    let todaySent = 0;
    let totalDelivered = 0;
    let totalFailed = 0;

    try {
      const [[r1]] = await db.promise().query("SELECT COUNT(*) as cnt FROM wa_message_logs WHERE direction = 'outbound'");
      totalSent = r1?.cnt || 0;

      const [[r2]] = await db.promise().query("SELECT COUNT(*) as cnt FROM wa_message_logs WHERE direction = 'outbound' AND DATE(created_at) = CURDATE()");
      todaySent = r2?.cnt || 0;

      const [[r3]] = await db.promise().query("SELECT COUNT(*) as cnt FROM wa_message_logs WHERE status = 'delivered'");
      totalDelivered = r3?.cnt || 0;

      const [[r4]] = await db.promise().query("SELECT COUNT(*) as cnt FROM wa_message_logs WHERE status = 'failed'");
      totalFailed = r4?.cnt || 0;
    } catch (_) {}

    const unifiedStatus = await this.getUnifiedStatus().catch(() => ({ connected: false, activeEngine: "Unknown" }));

    return {
      connected: unifiedStatus.connected,
      activeEngine: unifiedStatus.activeEngine,
      phone: this.phone || null,
      totalSent,
      todaySent,
      totalDelivered,
      totalFailed,
      status: "Active",
    };
  }

  // Fails fast instead of hanging until nginx/the browser gives up with an
  // opaque 504 — whatsapp-web.js occasionally stalls on a slow/first-contact
  // Store lookup, especially on the pinned older WhatsApp Web build.
  withTimeout(promise, ms, label) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

  async resolveTargetJid(cleanPhoneOrJid) {
    if (!cleanPhoneOrJid) return "";
    const str = String(cleanPhoneOrJid).trim();
    if (str.includes("@g.us") || str.includes("@broadcast") || str.includes("@lid") || str.includes("@newsletter")) {
      return str;
    }
    let digits = str.replace(/\D/g, "");
    if (!digits) return "";
    if (digits.length >= 18 && digits.startsWith("120363")) return `${digits}@g.us`;
    if (digits.length === 10) digits = "91" + digits;
    const formattedJid = `${digits}@c.us`;

    if (!this.ready || !this.client) return formattedJid;
    try {
      const contact = await this.enqueue(() =>
        this.withTimeout(this.client.getNumberId(digits), 4000, "WhatsApp getNumberId")
      ).catch(() => null);
      if (contact && (contact._serialized || contact.$1)) {
        return contact._serialized || contact.$1;
      }
    } catch (_) {}
    return formattedJid;
  }



  async sendReaction(chatId, messageId, emoji) {
    const cleanPhone = chatId.replace(/\D/g, "");
    if (!messageId || !emoji) throw new Error("messageId and emoji are required");

    let success = false;
    if (this.ready && this.client) {
      try {
        await this._paceSend();
        const msg = await this.enqueue(() =>
          this.withTimeout(this.client.getMessageById(messageId), 5000, "getMessageById for reaction")
        ).catch(() => null);

        if (msg && typeof msg.react === "function") {
          await this.enqueue(() => this.withTimeout(msg.react(emoji), 5000, "react"));
          success = true;
        }
      } catch (err) {
        console.warn("Reaction send error:", err.message);
      }
    }

    // Persist reaction into wa_reactions
    try {
      const db = require("../config/database");
      await db.promise().query(
        `INSERT INTO wa_reactions (wa_message_id, phone, emoji, sender_type)
         VALUES (?, ?, ?, 'agent')`,
        [messageId, cleanPhone, emoji]
      );
    } catch (e) {
      console.error("DB log reaction error:", e.message);
    }

    this.emitWaEvent("wa_reaction_updated", chatId, cleanPhone, { messageId, emoji, senderType: "agent" });
    return { success: true, messageId, emoji };
  }

  // Returns a URL under /uploads, not base64. The old version re-fetched up to
  // 250 messages through the shared Puppeteer page on *every* render of *every*
  // media bubble, all serialized behind one enqueue chain — ten images in view
  // meant ten full chat scans and a frozen UI. Now: resolve the message
  // directly, download once, cache to disk, and let the browser HTTP-cache it.
  async getMediaForMessage(chatId, messageId, serializedId) {
    const cacheDir = path.join(__dirname, "..", "uploads", "wa-media", this.key);
    const safeId = String(messageId).replace(/[^a-zA-Z0-9_-]/g, "");

    // Cache hit: no Puppeteer at all.
    try {
      const hit = fs.readdirSync(cacheDir).find((f) => f.startsWith(safeId + "."));
      if (hit) return { url: `/uploads/wa-media/${this.key}/${hit}`, filename: hit };
    } catch (_) {}

    if (!this.ready || !this.client) throw new Error("WhatsApp Web session not connected");

    let msg = null;
    // getMessageById is O(1) against the Store; the chat scan below is the
    // fallback for rows logged before serializedId was recorded.
    if (serializedId) {
      msg = await this.enqueue(() =>
        this.withTimeout(this.client.getMessageById(serializedId), 10000, "getMessageById")
      ).catch(() => null);
    }
    if (!msg) {
      const formattedChatId = formatChatJid(chatId);
      const chat = await this.enqueue(() => this.withTimeout(this.client.getChatById(formattedChatId), 15000, "getChatById"));
      const msgs = await this.enqueue(() => this.withTimeout(chat.fetchMessages({ limit: 100 }), 15000, "fetchMessages"));
      msg = msgs.find((m) => m.id.id === messageId || m.id._serialized === messageId);
    }
    if (!msg || !msg.hasMedia) throw new Error("Message not found or has no media");

    const media = await this.enqueue(() => this.withTimeout(msg.downloadMedia(), 20000, "downloadMedia"));
    if (!media) throw new Error("Media could not be downloaded");

    const ext = (media.mimetype || "application/octet-stream").split("/")[1]?.split(";")[0] || "bin";
    const filename = `${safeId}.${ext}`;
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, filename), Buffer.from(media.data, "base64"));

    return {
      url: `/uploads/wa-media/${this.key}/${filename}`,
      filename: media.filename || filename,
      mimetype: media.mimetype,
    };
  }

  async sendMediaMessage(chatId, mediaUrl, mediaType = "document", caption = "", filename = "") {
    const waCloud = require("./whatsappCloudApi");
    if (!chatId) throw new Error("chatId is required");

    let cleanPhone = String(chatId).replace(/\D/g, "");
    if (cleanPhone.length === 10) cleanPhone = "91" + cleanPhone;
    const targetJid = formatChatJid(chatId);
    let msgId = "sent_" + Date.now();

    if (this.ready && this.client) {
      try {
        await this._paceSend();
        const resolvedJid = await this.resolveTargetJid(targetJid);

        // Fast-path: Check if mediaUrl refers to a local file on disk to avoid network loopback & 504 timeouts
        let localFilePath = null;
        if (typeof mediaUrl === "string") {
          if (fs.existsSync(mediaUrl)) {
            localFilePath = mediaUrl;
          } else if (mediaUrl.includes("/uploads/")) {
            const relPath = mediaUrl.substring(mediaUrl.indexOf("/uploads/"));
            const candidates = [
              path.join(__dirname, "..", relPath),
              path.join(__dirname, "..", "uploads", "wa-media", path.basename(mediaUrl)),
              path.join(__dirname, "..", "uploads", path.basename(mediaUrl)),
              path.join(__dirname, "../../", relPath),
            ];
            for (const cand of candidates) {
              if (fs.existsSync(cand)) {
                localFilePath = cand;
                break;
              }
            }
          } else if (!mediaUrl.startsWith("http://") && !mediaUrl.startsWith("https://") && !mediaUrl.startsWith("data:")) {
            const cand = path.join(__dirname, "..", "uploads", "wa-media", path.basename(mediaUrl));
            if (fs.existsSync(cand)) localFilePath = cand;
          }
        }

        let media = null;
        if (localFilePath && fs.existsSync(localFilePath)) {
          try {
            if (typeof MessageMedia.fromFilePath === "function") {
              media = MessageMedia.fromFilePath(localFilePath);
            }
          } catch (_) {}
          if (!media) {
            const ext = path.extname(localFilePath).toLowerCase();
            const mimeMap = {
              ".jpg": "image/jpeg",
              ".jpeg": "image/jpeg",
              ".png": "image/png",
              ".webp": "image/webp",
              ".gif": "image/gif",
              ".pdf": "application/pdf",
              ".doc": "application/msword",
              ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              ".xls": "application/vnd.ms-excel",
              ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              ".csv": "text/csv",
              ".txt": "text/plain",
              ".mp4": "video/mp4",
              ".mp3": "audio/mpeg",
              ".ogg": "audio/ogg",
              ".wav": "audio/wav",
              ".m4a": "audio/mp4",
              ".zip": "application/zip",
              ".rar": "application/x-rar-compressed",
            };
            const mimeType = mimeMap[ext] || "application/octet-stream";
            const fileData = fs.readFileSync(localFilePath, { encoding: "base64" });
            media = new MessageMedia(mimeType, fileData, filename || path.basename(localFilePath));
          }
          if (filename && media) {
            media.filename = filename;
          }
        } else {
          media = await this.withTimeout(
            MessageMedia.fromUrl(mediaUrl, { unsafeMime: true, filename: filename || undefined }),
            25000,
            "MessageMedia.fromUrl"
          );
          if (filename && !media.filename) {
            media.filename = filename;
          }
        }

        let sendOpts = {};
        const isDoc = mediaType === "document" || ["pdf", "xls", "xlsx", "csv", "doc", "docx", "ppt", "pptx", "excel"].includes(mediaType) || (filename && !["image", "video", "audio"].includes(mediaType));
        if (mediaType === "audio" || mediaType === "voice" || mediaType === "ptt") {
          sendOpts = { sendAudioAsVoice: false };
        } else if (isDoc) {
          sendOpts = { sendMediaAsDocument: true, caption: caption || undefined };
        } else {
          sendOpts = { caption: caption || undefined };
        }

        const sent = await this.enqueue(() => this.withTimeout(
          this.client.sendMessage(resolvedJid, media, sendOpts),
          35000,
          "WhatsApp Web send media"
        ));
        msgId = sent?.id?.id || msgId;
      } catch (e) {
        console.error("WhatsApp Web sendMediaMessage error:", e.message);
        if (waCloud.isConfigured()) {
          const sent = await waCloud.sendMedia(cleanPhone, mediaType, mediaUrl, caption, filename);
          msgId = sent?.messages?.[0]?.id || msgId;
        } else if (e.message && (e.message.includes("No LID") || e.message.includes("LID"))) {
          throw new Error(`Recipient is not reachable on WhatsApp or requires Meta Cloud API.`);
        } else {
          throw new Error(`WhatsApp Web error: ${e.message}`);
        }
      }
    } else if (waCloud.isConfigured()) {
      const sent = await waCloud.sendMedia(cleanPhone, mediaType, mediaUrl, caption, filename);
      msgId = sent?.messages?.[0]?.id || msgId;
    } else {
      throw new Error("WhatsApp not connected. Please scan QR Code or configure Meta Cloud API.");
    }

    const logText = filename || caption || `[${mediaType}]`;
    try {
      const db = require("../config/database");
      await db.promise().query(
        `INSERT INTO wa_message_logs (session_key, phone, direction, message_type, message_text, wa_message_id, status, created_at)
         VALUES (?, ?, 'outbound', ?, ?, ?, 'sent', NOW())`,
        [this.key, cleanPhone, mediaType || "document", logText, msgId]
      );
    } catch (e) {
      console.error("DB log outbound media error:", e.message);
    }
    delete this.messagesFetchCache[chatId];

    const mediaMsg = {
      id: msgId,
      from: "me",
      to: cleanPhone,
      body: logText,
      caption: caption || "",
      timestamp: Math.floor(Date.now() / 1000),
      isMe: true,
      hasMedia: true,
      type: mediaType || "document",
      mediaUrl: mediaUrl,
      filename: filename || logText,
    };
    if (!this.messagesCache[chatId]) this.messagesCache[chatId] = [];
    this.messagesCache[chatId].unshift(mediaMsg);
    this.emitWaEvent("wa_message_sent", chatId, cleanPhone, mediaMsg);

    return { success: true, id: msgId };
  }

  async sendLocationMessage(chatId, lat, lng, name = "") {
    const waCloud = require("./whatsappCloudApi");
    if (!chatId) throw new Error("chatId is required");

    let cleanPhone = String(chatId).replace(/\D/g, "");
    if (cleanPhone.length === 10) cleanPhone = "91" + cleanPhone;
    const targetJid = formatChatJid(chatId);
    let msgId = "sent_" + Date.now();

    if (this.ready && this.client) {
      try {
        await this._paceSend();
        const resolvedJid = await this.resolveTargetJid(targetJid);
        const location = new Location(lat, lng, { name });
        const sent = await this.enqueue(() => this.withTimeout(
          this.client.sendMessage(resolvedJid, location),
          25000,
          "WhatsApp Web send location"
        ));
        msgId = sent?.id?.id || msgId;
      } catch (e) {
        console.error("WhatsApp Web sendLocationMessage error:", e.message);
        if (waCloud.isConfigured()) {
          const sent = await waCloud.sendLocation(cleanPhone, lat, lng, name);
          msgId = sent?.messages?.[0]?.id || msgId;
        } else if (e.message && (e.message.includes("No LID") || e.message.includes("LID"))) {
          throw new Error(`Recipient is not reachable on WhatsApp or requires Meta Cloud API.`);
        } else {
          throw new Error(`WhatsApp Web error: ${e.message}`);
        }
      }
    } else if (waCloud.isConfigured()) {
      const sent = await waCloud.sendLocation(cleanPhone, lat, lng, name);
      msgId = sent?.messages?.[0]?.id || msgId;
    } else {
      throw new Error("WhatsApp not connected. Please scan QR Code or configure Meta Cloud API.");
    }

    try {
      const db = require("../config/database");
      await db.promise().query(
        `INSERT INTO wa_message_logs (session_key, phone, direction, message_type, message_text, wa_message_id, status, created_at)
         VALUES (?, ?, 'outbound', 'location', ?, ?, 'sent', NOW())`,
        [this.key, cleanPhone, name || "Location", msgId]
      );
    } catch (e) {
      console.error("DB log outbound location error:", e.message);
    }
    delete this.messagesFetchCache[chatId];

    const locationMsg = {
      id: msgId,
      from: "me",
      to: cleanPhone,
      body: "",
      timestamp: Math.floor(Date.now() / 1000),
      isMe: true,
      location: { lat, lng, name },
    };
    if (!this.messagesCache[chatId]) this.messagesCache[chatId] = [];
    this.messagesCache[chatId].unshift(locationMsg);
    this.emitWaEvent("wa_message_sent", chatId, cleanPhone, locationMsg);

    return { success: true, id: msgId };
  }

  async syncWhatsAppContacts() {
    if (!this.ready || !this.client) {
      return { success: false, message: "WhatsApp client is not ready" };
    }
    try {
      const rawContacts = await this.enqueue(() =>
        this.withTimeout(this.client.getContacts(), 25000, "WhatsApp Web getContacts")
      ).catch(() => []);

      if (!rawContacts || !rawContacts.length) {
        return { success: true, count: 0, inserted: 0, updated: 0 };
      }

      // 1. Batch resolve any LID contacts to real phone numbers
      const lidContacts = rawContacts.filter(
        (c) => c.id?._serialized?.includes("@lid") || c.id?.server === "lid"
      );
      if (lidContacts.length > 0) {
        const lidIds = lidContacts.map((c) => c.id?._serialized || String(c.id));
        await this.resolveLidsBatch(lidIds).catch(() => {});
      }

      const db = require("../config/database");
      let inserted = 0;
      let updated = 0;

      for (const c of rawContacts) {
        if (!c.isUser) continue;

        let cleanPhone = null;
        if (c.id?._serialized?.includes("@lid") || c.id?.server === "lid") {
          cleanPhone = this.lidToPhoneMap.get(c.id?._serialized) || this.lidToPhoneMap.get(c.id?.user) || null;
        } else if (c.number) {
          cleanPhone = c.number.replace(/\D/g, "");
        } else if (c.id?.user) {
          cleanPhone = c.id.user.replace(/\D/g, "");
        }

        // Strictly ignore unresolvable LIDs or invalid digits — never save fake numbers to CRM
        if (!cleanPhone || cleanPhone.length < 10 || cleanPhone.length > 13) {
          continue;
        }

        const countryCode = cleanPhone.length > 10 ? cleanPhone.slice(0, cleanPhone.length - 10) : "91";
        const name = (c.name || c.pushname || c.shortName || formatPhoneDisplay(cleanPhone)).trim();

        try {
          const [res] = await db.promise().query(
            `INSERT INTO wa_contacts (name, phone, country_code, source, opt_in_status)
             VALUES (?, ?, ?, 'WhatsApp Account', 1)
             ON DUPLICATE KEY UPDATE
               name = IF(name IS NULL OR name = '' OR name LIKE '+%', VALUES(name), name),
               updated_at = NOW()`,
            [name, cleanPhone, countryCode]
          );
          if (res.affectedRows === 1) inserted++;
          else if (res.affectedRows === 2) updated++;
        } catch (e) {}
      }

      return { success: true, count: rawContacts.length, inserted, updated };
    } catch (err) {
      console.error("syncWhatsAppContacts error:", err.message);
      return { success: false, error: err.message };
    }
  }

  async syncWhatsAppChatsAndMessages() {
    if (!this.ready || !this.client) {
      return { success: false, message: "WhatsApp client is not ready" };
    }
    try {
      const chats = await this.getChats(true);
      let syncedMessages = 0;

      for (const chat of (chats || []).slice(0, 30)) {
        if (!chat.id) continue;
        try {
          const msgs = await this.getMessages(chat.id, true);
          syncedMessages += (msgs || []).length;
        } catch (_) {}
      }

      return { success: true, syncedChats: (chats || []).length, syncedMessages };
    } catch (err) {
      console.error("syncWhatsAppChatsAndMessages error:", err.message);
      return { success: false, error: err.message };
    }
  }

  async getAccountDetails() {
    // getStatus() is async — without the await, status.connected was always
    // undefined and this endpoint reported "disconnected" on a live session.
    const status = await this.getStatus();
    if (!status.connected || !this.client) {
      return {
        connected: false,
        phone: null,
        pushname: null,
        profilePicUrl: null,
        contactsCount: 0,
        chatsCount: 0,
      };
    }

    let pushname = null;
    let profilePicUrl = null;

    try {
      pushname = this.client.info?.pushname || null;
      if (this.client.info?.wid?._serialized) {
        profilePicUrl = await this.client.getProfilePicUrl(this.client.info.wid._serialized).catch(() => null);
      }
    } catch (_) {}

    let contactsCount = 0;
    try {
      const db = require("../config/database");
      const [[{ total }]] = await db.promise().query(
        "SELECT COUNT(*) as total FROM wa_contacts WHERE source = 'WhatsApp Account' OR opt_in_status = 1"
      );
      contactsCount = total || 0;
    } catch (_) {}

    return {
      connected: true,
      phone: this.phone,
      pushname: pushname || `WhatsApp (+${this.phone})`,
      profilePicUrl,
      platform: this.client.info?.platform || "WhatsApp Web",
      contactsCount,
      chatsCount: this.chatsCache.length,
    };
  }

  async sendTemplateMessage(phone, templateName, components = []) {
    let cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length === 10) cleanPhone = "91" + cleanPhone;

    let text = "";
    try {
      const db = require("../config/database");
      const [rows] = await db.promise().query(
        "SELECT body_text FROM wa_templates WHERE name = ? OR name LIKE ? LIMIT 1",
        [templateName, `%${templateName}%`]
      );
      if (rows.length > 0 && rows[0].body_text) {
        text = rows[0].body_text;
      }
    } catch (_) {}

    if (!text) {
      const DEFAULT_TEMPLATES = {
        welcome_message: "Hello! Welcome to our service. We are glad to connect with you. How can we help you today?",
        lead_inquiry_reply: "Hello, thank you for reaching out regarding your inquiry. Our team will connect with you shortly!",
        invoice_payment_reminder: "Dear Customer, this is a friendly reminder regarding your outstanding invoice payment. Please let us know if you need any details.",
        payment_received_ack: "Dear Customer, we have received your payment. Thank you!",
        amc_renewal_notice: "Dear Customer, your AMC Contract is due for renewal. Please contact us to extend coverage.",
      };
      text = DEFAULT_TEMPLATES[templateName] || `Hello! Reference: ${templateName}`;
    }

    if (Array.isArray(components)) {
      components.forEach((comp, idx) => {
        if (comp && comp.parameters && Array.isArray(comp.parameters)) {
          comp.parameters.forEach((p, pIdx) => {
            const val = p.text || p.value || "";
            text = text.replace(new RegExp(`\\{\\{${pIdx + 1}\\}\\}`, "g"), val);
          });
        } else if (typeof comp === "string" || typeof comp === "number") {
          text = text.replace(new RegExp(`\\{\\{${idx + 1}\\}\\}`, "g"), String(comp));
        }
      });
    }

    return this.sendMessage(`${cleanPhone}@c.us`, text);
  }

  logout(purgeImmediately = false) {
    return this.lifecycle(() => this._doLogout(purgeImmediately));
  }

  async _doLogout(purgeImmediately = false) {
    try {
      if (this.client) {
        await this.client.destroy();
      }
    } catch (_) {}
    this.client = null;
    this.ready = false;
    this.qrCode = null;
    this.phone = null;
    this.isInitializing = false;
    this.chatsCache = [];
    this.messagesCache = {};
    this.messagesFetchCache = {};
    this.lastChatsFetch = 0;

    // Clean up any lingering browser processes on Windows
    killSessionBrowserProcesses(this.sessionPath);

    // Update database account status
    try {
      const db = require("../config/database");
      await db.promise().query(
        "UPDATE wa_accounts SET is_active = 0, updated_at = NOW() WHERE account_name LIKE ? OR phone_number LIKE ?",
        [`%${this.key}%`, `%${this.key}%`]
      ).catch(() => {});
    } catch (_) {}

    if (purgeImmediately) {
      try {
        if (fs.existsSync(this.sessionPath)) {
          fs.rmSync(this.sessionPath, { recursive: true, force: true });
        }
      } catch (_) {}
      // Keep instance in sessions map to prevent split-brain re-initializations
      this.emitWaEvent("wa_disconnected", null, this.phone, { reason: "LOGOUT", purged: true, sessionKey: this.key });
      return { success: true, purged: true, message: "Session permanently deleted from disk and memory." };
    } else {
      // 4-day auto-delete lifecycle (real WhatsApp Web expiration)
      const meta = this.markLoggedOut("USER_LOGOUT");
      this.emitWaEvent("wa_disconnected", null, this.phone, { reason: "LOGOUT", purged: false, sessionKey: this.key });
      console.log(`🔒 WhatsApp session ${this.key} logged out. Will auto-delete in 4 days if not reconnected.`);
      return { success: true, purged: false, ...meta };
    }
  }
}

// ── Session registry ────────────────────────────────────────────────────────
// One WhatsAppService per linked number, keyed by the owning CRM user id.
// The constructor is pure field assignment — get() launches no browser, so an
// unlinked key cheaply yields an object with ready === false, which every
// caller already handles.
const sessions = new Map();
let defaultKey = process.env.WA_DEFAULT_USER || "1";

function get(key) {
  const k = String(key || defaultKey);
  if (!sessions.has(k)) sessions.set(k, new WhatsAppService(k));
  return sessions.get(k);
}

function all() {
  return Array.from(sessions.values());
}

// The session CRM-side senders use when there is no user in context:
// schedulers, Cloud API webhooks, invoice/payment automations, the queue worker.
function getDefault() {
  const readySession = all().find((s) => s.ready);
  if (readySession) return readySession;
  return get(defaultKey);
}

// A LocalAuth profile only counts as linked once Chrome has written its user
// data dir. _doInit mkdirs the session folder *before* launching, so an empty
// directory is residue from an aborted QR scan, not a session.
function hasSavedProfile(dir) {
  try {
    const metaFile = path.join(dir, "session_meta.json");
    if (!fs.existsSync(metaFile)) return false;
    const meta = JSON.parse(fs.readFileSync(metaFile, "utf8"));
    if (meta.status === "active" && meta.phone) return true;
    return false;
  } catch (_) {
    return false;
  }
}

async function migrateLegacySession(adminKey) {
  if (!fs.existsSync(LEGACY_SESSION_PATH) || !hasSavedProfile(LEGACY_SESSION_PATH)) return;
  const target = path.join(SESSIONS_ROOT, adminKey);
  if (fs.existsSync(target)) return;
  try {
    fs.mkdirSync(SESSIONS_ROOT, { recursive: true });
    // Copy rather than rename: a stale Chrome still holding the profile lock
    // makes rename throw EPERM, and a half-moved profile costs a QR re-scan.
    // The legacy folder is left in place as the rollback.
    fs.cpSync(LEGACY_SESSION_PATH, target, { recursive: true });
    console.log(`✅ Migrated existing WhatsApp session -> whatsapp-sessions/${adminKey} (original kept as backup)`);
  } catch (e) {
    console.warn("⚠️ Could not migrate legacy WhatsApp session:", e.message);
  }
}

// ── 4-Day Session Auto-Cleanup Worker ─────────────────────────────────────────
// Automatically deletes logged-out or abandoned WhatsApp session folders older than 4 days
async function cleanExpiredSessions() {
  const now = Date.now();
  const cleaned = [];
  if (!fs.existsSync(SESSIONS_ROOT)) return cleaned;

  let dirs = [];
  try {
    dirs = fs.readdirSync(SESSIONS_ROOT, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch (_) {
    return cleaned;
  }

  for (const sessionKey of dirs) {
    const dir = path.join(SESSIONS_ROOT, sessionKey);
    const metaFile = path.join(dir, "session_meta.json");
    let shouldDelete = false;
    let deleteReason = "";

    if (fs.existsSync(metaFile)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaFile, "utf8"));
        if (meta.status === "logged_out") {
          const loggedOutAt = meta.loggedOutAt || 0;
          const expiresAt = meta.expiresAt || (loggedOutAt + FOUR_DAYS_MS);
          if (now >= expiresAt || (now - loggedOutAt >= FOUR_DAYS_MS)) {
            shouldDelete = true;
            deleteReason = `Logged out for > 4 days (expired at ${new Date(expiresAt).toISOString()})`;
          }
        }
      } catch (_) {}
    } else {
      try {
        const stats = fs.statSync(dir);
        const ageMs = now - stats.mtimeMs;
        if (!hasSavedProfile(dir) && ageMs > FOUR_DAYS_MS) {
          shouldDelete = true;
          deleteReason = `Abandoned incomplete session folder older than 4 days`;
        }
      } catch (_) {}
    }

    if (shouldDelete) {
      try {
        const instance = sessions.get(sessionKey);
        if (instance && instance.client) {
          await instance.client.destroy().catch(() => {});
          instance.client = null;
          instance.ready = false;
        }
        sessions.delete(sessionKey);
        fs.rmSync(dir, { recursive: true, force: true });
        cleaned.push({ sessionKey, reason: deleteReason });
        console.log(`🗑️ [WhatsApp Session Expiry] Auto-deleted 4-day expired session: ${sessionKey} (${deleteReason})`);
      } catch (err) {
        console.warn(`⚠️ Could not auto-delete expired session ${sessionKey}:`, err.message);
      }
    }
  }

  return cleaned;
}

let cleanupInterval = null;
function startSessionCleanupScheduler() {
  if (cleanupInterval) return;
  // Run every 6 hours
  cleanupInterval = setInterval(() => {
    cleanExpiredSessions().catch((err) => {
      console.warn("⚠️ WhatsApp session cleanup scheduler error:", err.message);
    });
  }, 6 * 60 * 60 * 1000);
}

// Called once at boot. Restores every active saved session; launches nothing when
// none exist. Automatically purges sessions expired past 4 days.
async function restoreExisting() {
  const db = require("../config/database");

  // 1. Purge any 4-day expired sessions and start the recurring cleanup worker
  await cleanExpiredSessions().catch(() => []);
  startSessionCleanupScheduler();

  if (!process.env.WA_DEFAULT_USER) {
    try {
      const [rows] = await db.promise().query("SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1");
      if (rows.length) defaultKey = String(rows[0].id);
    } catch (_) {}
  }

  await migrateLegacySession(defaultKey);

  // Pre-multi-session rows carry no session_key; attribute them to the owner
  // so their history doesn't vanish from the chat list. No-op after first boot.
  try {
    await db.promise().query("UPDATE wa_message_logs SET session_key = ? WHERE session_key IS NULL", [defaultKey]);
    await db.promise().query("UPDATE wa_campaigns SET session_key = ? WHERE session_key IS NULL", [defaultKey]);
  } catch (_) {}

  let dirs = [];
  try {
    if (!fs.existsSync(SESSIONS_ROOT)) {
      fs.mkdirSync(SESSIONS_ROOT, { recursive: true });
    }
    dirs = fs.readdirSync(SESSIONS_ROOT, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  } catch (_) {
    return { restored: 0 };
  }

  let restored = 0;
  for (const key of dirs) {
    const dir = path.join(SESSIONS_ROOT, key);
    if (!hasSavedProfile(dir)) {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
      continue;
    }

    // Skip auto-launching sessions that the user explicitly logged out from
    const metaFile = path.join(dir, "session_meta.json");
    if (fs.existsSync(metaFile)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaFile, "utf8"));
        if (meta.status === "logged_out") {
          console.log(`ℹ️ WhatsApp session ${key} is logged out (auto-deletes in 4 days). Skipping auto-restore.`);
          continue;
        }
      } catch (_) {}
    }

    // Staggered and unawaited — N cold Chrome launches at once would stall boot.
    setTimeout(() => {
      console.log(`♻️ Restoring saved WhatsApp session for user ${key}...`);
      get(key).init(false).catch((e) => console.warn(`⚠️ WhatsApp session ${key} restore failed:`, e.message));
    }, restored * 5000);
    restored++;
  }

  console.log(restored ? `📱 ${restored} saved WhatsApp session(s) queued for restore` : "ℹ️ No active saved WhatsApp sessions — none started");
  return { restored };
}

module.exports = {
  get,
  all,
  default: getDefault,
  hasSavedProfile,
  restoreExisting,
  cleanExpiredSessions,
  startSessionCleanupScheduler,
  get defaultKey() { return defaultKey; },
  SESSIONS_ROOT,
};
