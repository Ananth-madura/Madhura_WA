/**
 * r2StorageService.js — Cloudflare R2 S3-compatible persistent storage engine.
 *
 * Provides automated Cloudflare R2 cloud backup & restore for the embedded SQLite
 * database and WhatsApp media files. Solves the ephemeral filesystem limitation of
 * Render free tier and containerized cloud deployments.
 */

const fs = require("fs");
const path = require("path");
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  HeadBucketCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");

class R2StorageService {
  constructor({ env = process.env, client } = {}) {
    this.env = env;
    this.client = null;
    this.bucket = null;
    this.accountId = null;
    this.publicDomain = null;
    this.lastSyncAt = null;
    this.lastRestoreAt = null;
    this.isSyncing = false;
    this.syncDebounceTimer = null;
    this.periodicTimer = null;
    this.authFailed = false;
    this.authError = null;
    this.disabled = false;
    this.lastProbe = null;

    this.init();
    if (client) this.client = client;
  }

  init() {
    const env = this.env;
    this.disabled = false;
    this.client = null;
    this.authFailed = false;
    this.authError = null;

    if ([env.DISABLE_R2, env.SKIP_R2].some(value => ["1", "true", "yes"].includes(String(value || "").toLowerCase()))) {
      this.client = null;
      this.disabled = true;
      console.log("ℹ️ [Cloudflare R2] Object storage disabled by environment.");
      return;
    }

    const accountId = (
      env.R2_ACCOUNT_ID ||
      env.CLOUDFLARE_ACCOUNT_ID ||
      ""
    ).trim();

    const accessKeyId = (
      env.R2_ACCESS_KEY_ID ||
      env.CLOUDFLARE_R2_ACCESS_KEY_ID ||
      ""
    ).trim();

    const secretAccessKey = (
      env.R2_SECRET_ACCESS_KEY ||
      env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ||
      ""
    ).trim();

    const bucket = (
      env.R2_BUCKET_NAME ||
      env.CLOUDFLARE_R2_BUCKET ||
      env.R2_BUCKET ||
      ""
    ).trim();

    this.publicDomain = (env.R2_PUBLIC_DOMAIN || "").trim().replace(/\/+$/, "");
    this.publicBucket = (env.R2_PUBLIC_BUCKET_NAME || "").trim() || null;
    if (this.publicBucket && this.publicBucket === bucket) throw new Error("Use separate private and public R2 buckets");
    if (this.publicDomain) {
      const domain = new URL(this.publicDomain);
      if (domain.protocol !== "https:" || domain.origin !== this.publicDomain || domain.username || domain.password) throw new Error("R2_PUBLIC_DOMAIN must be an HTTPS origin");
    }

    // Only attempt S3 client connection when valid credentials are explicitly provided in environment
    if (accountId && accessKeyId && secretAccessKey && bucket) {
      this.accountId = accountId;
      this.bucket = bucket;
      try {
        this.client = new S3Client({
          region: "auto",
          maxAttempts: 2,
          endpoint: `https://${this.accountId}.r2.cloudflarestorage.com`,
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
        });
        console.log(`☁️ [Cloudflare R2] Configured for bucket "${this.bucket}" (Account: ${this.accountId.slice(0, 8)}...)`);
      } catch (err) {
        console.error("❌ [Cloudflare R2] Failed to initialize S3 client:", err.message);
        this.client = null;
      }
    } else {
      this.client = null;
      this.bucket = null;
      this.accountId = null;
      console.log("ℹ️ [Cloudflare R2] Object storage credentials are not configured.");
    }
  }

  isAuthError(err) {
    if (!err) return false;
    const msg = String(err.message || "").toLowerCase();
    const code = String(err.name || err.code || "").toLowerCase();
    const status = err.$metadata?.httpStatusCode;
    return (
      status === 403 ||
      status === 401 ||
      code.includes("accessdenied") ||
      code.includes("signaturedoesnotmatch") ||
      code.includes("invalidaccesskey") ||
      code.includes("auth") ||
      msg.includes("access denied") ||
      msg.includes("forbidden") ||
      msg.includes("unauthorized")
    );
  }

  handleAuthFailure(err) {
    if (this.authFailed) return;
    this.authFailed = true;
    this.authError = err.message || "Access Denied";
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
      this.syncDebounceTimer = null;
    }
    if (this.periodicTimer) {
      clearInterval(this.periodicTimer);
      this.periodicTimer = null;
    }
    console.warn(
      `⚠️ [Cloudflare R2] Access Denied: Cloudflare R2 credentials for bucket "${this.bucket || "unknown"}" are invalid or expired.\n` +
      `   R2 operations are paused. The configured application database is unchanged.\n` +
      `   To enable cloud backup, set valid R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY in backend/.env, or set DISABLE_R2=1.`
    );
  }

  isConfigured() {
    return Boolean(this.client && this.bucket && !this.authFailed && !this.disabled);
  }

  getStatus() {
    return {
      configured: this.isConfigured(),
      disabled: Boolean(this.disabled),
      authFailed: Boolean(this.authFailed),
      authError: this.authError || null,
      bucket: this.bucket || null,
      accountId: this.accountId ? `${this.accountId.slice(0, 6)}...` : null,
      publicDomain: this.publicDomain || null,
      publicAssetsReady: Boolean(this.isConfigured() && this.publicDomain && this.publicBucket),
      lastSyncAt: this.lastSyncAt,
      lastRestoreAt: this.lastRestoreAt,
      isSyncing: this.isSyncing,
      lastProbe: this.lastProbe,
    };
  }

  async verifyConnection({ roundTrip = false, prefix = "checks" } = {}) {
    if (!this.isConfigured()) return { ok: false, reason: this.disabled ? "disabled" : this.authFailed ? "authentication_failed" : "not_configured" };
    const { randomUUID, randomBytes } = require("node:crypto");
    const key = `${prefix}/${randomUUID()}.bin`, body = randomBytes(32);
    const send = command => this.client.send(command, { abortSignal: AbortSignal.timeout(15000) });
    let wrote = false, failure = null;
    try {
      if (roundTrip) {
        wrote = true;
        await send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: "application/octet-stream", CacheControl: "no-store" }));
        const result = await send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
        const downloaded = Buffer.from(await result.Body.transformToByteArray());
        if (!body.equals(downloaded)) throw new Error("ContentMismatch");
      } else await send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (error) { failure = this.isAuthError(error) ? "access_denied" : "connection_or_integrity_failed"; }
    finally {
      if (wrote) try { await send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key })); }
      catch (_) { failure = "probe_cleanup_failed"; }
    }
    this.lastProbe = { ok: !failure, mode: roundTrip ? "put_get_delete" : "head_bucket", checkedAt: new Date().toISOString(), ...(failure ? { reason: failure } : {}) };
    return this.lastProbe;
  }

  async deleteMedia(key) {
    if (!this.isConfigured()) throw new Error("R2 unavailable");
    await this.client.send(new DeleteObjectCommand({ Bucket: this.mediaBucket(key), Key: key }), { abortSignal: AbortSignal.timeout(15000) });
  }

  mediaBucket(key) {
    return /^tenants\/\d+\/public-assets\//.test(key) ? this.publicBucket : this.bucket;
  }

  /**
   * Helper: Convert Node.js readable stream into a Buffer
   */
  async streamToBuffer(stream) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      stream.on("data", (chunk) => chunks.push(chunk));
      stream.on("error", reject);
      stream.on("end", () => resolve(Buffer.concat(chunks)));
    });
  }

  /**
   * Downloads the SQLite database from Cloudflare R2 if it exists
   * @param {string} localDbPath - Target local file path for database.sqlite
   * @returns {Promise<{ restored: boolean, size?: number, error?: string }>}
   */
  async downloadDatabaseFromR2(localDbPath) {
    if (!this.isConfigured()) {
      return { restored: false, reason: "r2_not_configured" };
    }

    try {
      console.log(`⬇️ [Cloudflare R2] Checking for existing database in bucket "${this.bucket}"...`);
      const getCommand = new GetObjectCommand({
        Bucket: this.bucket,
        Key: "database.sqlite",
      });

      const response = await this.client.send(getCommand);
      if (!response.Body) {
        console.log("ℹ️ [Cloudflare R2] No remote database found. Initializing fresh local database.");
        return { restored: false, reason: "empty_remote" };
      }

      const buffer = await this.streamToBuffer(response.Body);
      const parentDir = path.dirname(localDbPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      fs.writeFileSync(localDbPath, buffer);
      this.lastRestoreAt = new Date().toISOString();
      this.authFailed = false;
      this.authError = null;
      console.log(`✅ [Cloudflare R2] Successfully restored SQLite database (${(buffer.length / 1024).toFixed(1)} KB) from Cloudflare R2!`);
      return { restored: true, size: buffer.length };
    } catch (err) {
      if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) {
        console.log("ℹ️ [Cloudflare R2] No existing 'database.sqlite' found in bucket. Will create on first sync.");
        return { restored: false, reason: "not_found" };
      }
      if (this.isAuthError(err)) {
        this.handleAuthFailure(err);
        return { restored: false, error: err.message, authFailed: true };
      }
      console.warn("⚠️ [Cloudflare R2] Restore warning:", err.message);
      return { restored: false, error: err.message };
    }
  }

  /**
   * Uploads the local SQLite database to Cloudflare R2
   * @param {string} localDbPath - Source local file path
   * @param {boolean} [isManual=false] - If triggered manually by user action
   * @returns {Promise<{ synced: boolean, size?: number, error?: string }>}
   */
  async uploadDatabaseToR2(localDbPath, isManual = false) {
    if (this.authFailed && !isManual) {
      return { synced: false, reason: "r2_auth_failed", error: this.authError };
    }
    if (!this.isConfigured()) return { synced: false, reason: "r2_not_configured" };
    if (!fs.existsSync(localDbPath)) return { synced: false, reason: "local_file_not_found" };
    if (this.isSyncing) return { synced: false, reason: "sync_in_progress" };

    this.isSyncing = true;
    try {
      if (typeof this.beforeUploadCallback === "function") {
        try { this.beforeUploadCallback(); } catch (_) {}
      }
      const fileBuffer = fs.readFileSync(localDbPath);
      const putCommand = new PutObjectCommand({
        Bucket: this.bucket,
        Key: "database.sqlite",
        Body: fileBuffer,
        ContentType: "application/vnd.sqlite3",
        Metadata: {
          syncedAt: new Date().toISOString(),
          appName: "madhura-whatsapp-crm",
        },
      });

      await this.client.send(putCommand, { abortSignal: AbortSignal.timeout(15000) });
      this.lastSyncAt = new Date().toISOString();
      this.authFailed = false;
      this.authError = null;
      console.log(`⬆️ [Cloudflare R2] SQLite database successfully backed up to Cloudflare R2 (${(fileBuffer.length / 1024).toFixed(1)} KB) at ${this.lastSyncAt}`);
      return { synced: true, size: fileBuffer.length, lastSyncAt: this.lastSyncAt };
    } catch (err) {
      if (this.isAuthError(err)) {
        this.handleAuthFailure(err);
      } else {
        console.error("❌ [Cloudflare R2] Database sync failed:", err.message);
      }
      return { synced: false, error: err.message };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Debounced sync trigger called after database write operations
   * @param {string} localDbPath
   * @param {number} delayMs
   */
  triggerDebouncedSync(localDbPath, delayMs = 5000) {
    if (!this.isConfigured() || this.authFailed || this.disabled) return;
    if (this.syncDebounceTimer) clearTimeout(this.syncDebounceTimer);
    this.syncDebounceTimer = setTimeout(() => {
      if (!this.isConfigured() || this.authFailed || this.disabled) return;
      this.uploadDatabaseToR2(localDbPath).catch(() => {});
    }, delayMs);
  }

  /**
   * Schedules recurring sync and shutdown hooks
   * @param {string} localDbPath
   * @param {number} intervalMs
   */
  startSyncSchedule(localDbPath, intervalMs = 120000) {
    if (this.periodicTimer) clearInterval(this.periodicTimer);
    if (!this.isConfigured() || this.authFailed || this.disabled) return;

    this.periodicTimer = setInterval(() => {
      if (!this.isConfigured() || this.authFailed || this.disabled) {
        if (this.periodicTimer) clearInterval(this.periodicTimer);
        return;
      }
      this.uploadDatabaseToR2(localDbPath).catch(() => {});
    }, intervalMs);

    // Graceful shutdown sync flush
    const onExit = async () => {
      if (this.isConfigured() && !this.authFailed && !this.disabled && fs.existsSync(localDbPath)) {
        console.log("🛑 [Cloudflare R2] Process shutting down — flushing final SQLite snapshot to R2...");
        try {
          await this.uploadDatabaseToR2(localDbPath);
        } catch (_) {}
      }
    };
    process.once("SIGTERM", onExit);
    process.once("SIGINT", onExit);
  }

  /**
   * Uploads a media file (attachment, audio, PDF) to Cloudflare R2
   * @param {Buffer|string} fileData - Buffer or local file path
   * @param {string} key - S3 object key (e.g. "media/123_invoice.pdf")
   * @param {string} contentType - MIME type
   * @returns {Promise<{ success: boolean, url: string, key: string }>}
   */
  async uploadMedia(fileData, key, contentType = "application/octet-stream", { published = false } = {}) {
    if (!this.isConfigured()) {
      return { success: false, reason: "r2_not_configured" };
    }
    if (published && (!this.publicBucket || !this.publicDomain)) return { success: false, reason: "public_bucket_not_configured" };

    try {
      const body = Buffer.isBuffer(fileData) ? fileData : fs.readFileSync(fileData);
      const putCommand = new PutObjectCommand({
        Bucket: published ? this.publicBucket : this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: published ? "public, max-age=3600" : "private, no-store",
      });

      await this.client.send(putCommand, { abortSignal: AbortSignal.timeout(15000) });
      const url = published && this.publicDomain
        ? `${this.publicDomain}/${key}`
        : `/api/storage/r2/${encodeURIComponent(key)}`;

      return { success: true, url, key };
    } catch (err) {
      if (this.isAuthError(err)) {
        this.handleAuthFailure(err);
      } else {
        console.error("❌ [Cloudflare R2] Media upload failed:", err.message);
      }
      return { success: false, error: err.message };
    }
  }

  /**
   * Downloads a media file or returns a stream
   * @param {string} key
   */
  async getMediaStream(key) {
    if (!this.isConfigured()) return null;
    try {
      const command = new GetObjectCommand({
        Bucket: this.mediaBucket(key),
        Key: key,
      });
      return await this.client.send(command, { abortSignal: AbortSignal.timeout(15000) });
    } catch (err) {
      if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) return null;
      throw new Error("R2 download unavailable");
    }
  }
}

const instance = new R2StorageService();
module.exports = instance;
module.exports.R2StorageService = R2StorageService;
