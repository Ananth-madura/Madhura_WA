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
} = require("@aws-sdk/client-s3");

const DEFAULT_R2 = {
  accountId: "7107deaae02b66284b790bfb60c66191",
  accessKeyId: "8d826b1250997ad83c7d9d9ba5e2c8b8",
  secretAccessKey: "a0fbaa1af69d23cac64aed6a057ecf549dae13456058d69b246674e0f0ea4319",
  bucket: "madhurawa",
};

const USER_TOKEN_FALLBACK = {
  accessKeyId: "666a913fff525e19b92e7a625625ecd0",
  secretAccessKey: "2abd6b58bff4bad0873933f549771b068a330339508bc9398f49e9bdf1318688",
};

class R2StorageService {
  constructor() {
    this.client = null;
    this.bucket = null;
    this.accountId = null;
    this.publicDomain = null;
    this.lastSyncAt = null;
    this.lastRestoreAt = null;
    this.isSyncing = false;
    this.syncDebounceTimer = null;
    this.periodicTimer = null;

    this.init();
  }

  init() {
    if (["1", "true", "yes"].includes(String(process.env.DISABLE_R2 || process.env.SKIP_R2 || "").toLowerCase())) {
      this.client = null;
      return;
    }

    this.accountId = (
      process.env.R2_ACCOUNT_ID ||
      process.env.CLOUDFLARE_ACCOUNT_ID ||
      DEFAULT_R2.accountId
    ).trim();

    const accessKeyId = (
      process.env.R2_ACCESS_KEY_ID ||
      process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ||
      DEFAULT_R2.accessKeyId
    ).trim();

    const secretAccessKey = (
      process.env.R2_SECRET_ACCESS_KEY ||
      process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ||
      DEFAULT_R2.secretAccessKey
    ).trim();

    this.bucket = (
      process.env.R2_BUCKET_NAME ||
      process.env.CLOUDFLARE_R2_BUCKET ||
      process.env.R2_BUCKET ||
      DEFAULT_R2.bucket
    ).trim();

    this.publicDomain = (process.env.R2_PUBLIC_DOMAIN || "").trim().replace(/\/+$/, "");

    if (this.accountId && accessKeyId && secretAccessKey && this.bucket) {
      try {
        this.client = new S3Client({
          region: "auto",
          endpoint: `https://${this.accountId}.r2.cloudflarestorage.com`,
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
        });
        console.log(`☁️ [Cloudflare R2] Connected to bucket "${this.bucket}" (Account: ${this.accountId.slice(0, 8)}...)`);
      } catch (err) {
        console.error("❌ [Cloudflare R2] Failed to initialize S3 client:", err.message);
        this.client = null;
      }
    } else {
      this.client = null;
    }
  }

  isConfigured() {
    return Boolean(this.client && this.bucket);
  }

  getStatus() {
    return {
      configured: this.isConfigured(),
      bucket: this.bucket || null,
      accountId: this.accountId ? `${this.accountId.slice(0, 6)}...` : null,
      publicDomain: this.publicDomain || null,
      lastSyncAt: this.lastSyncAt,
      lastRestoreAt: this.lastRestoreAt,
      isSyncing: this.isSyncing,
    };
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
      console.log(`✅ [Cloudflare R2] Successfully restored SQLite database (${(buffer.length / 1024).toFixed(1)} KB) from Cloudflare R2!`);
      return { restored: true, size: buffer.length };
    } catch (err) {
      if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) {
        console.log("ℹ️ [Cloudflare R2] No existing 'database.sqlite' found in bucket. Will create on first sync.");
        return { restored: false, reason: "not_found" };
      }
      console.warn("⚠️ [Cloudflare R2] Restore warning:", err.message);
      return { restored: false, error: err.message };
    }
  }

  /**
   * Uploads the local SQLite database to Cloudflare R2
   * @param {string} localDbPath - Source local file path
   * @returns {Promise<{ synced: boolean, size?: number, error?: string }>}
   */
  async uploadDatabaseToR2(localDbPath) {
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

      await this.client.send(putCommand);
      this.lastSyncAt = new Date().toISOString();
      console.log(`⬆️ [Cloudflare R2] SQLite database successfully backed up to Cloudflare R2 (${(fileBuffer.length / 1024).toFixed(1)} KB) at ${this.lastSyncAt}`);
      return { synced: true, size: fileBuffer.length, lastSyncAt: this.lastSyncAt };
    } catch (err) {
      console.error("❌ [Cloudflare R2] Database sync failed:", err.message);
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
    if (!this.isConfigured()) return;
    if (this.syncDebounceTimer) clearTimeout(this.syncDebounceTimer);
    this.syncDebounceTimer = setTimeout(() => {
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
    this.periodicTimer = setInterval(() => {
      this.uploadDatabaseToR2(localDbPath).catch(() => {});
    }, intervalMs);

    // Graceful shutdown sync flush
    const onExit = async () => {
      if (this.isConfigured() && fs.existsSync(localDbPath)) {
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
  async uploadMedia(fileData, key, contentType = "application/octet-stream") {
    if (!this.isConfigured()) {
      return { success: false, reason: "r2_not_configured" };
    }

    try {
      const body = Buffer.isBuffer(fileData) ? fileData : fs.readFileSync(fileData);
      const putCommand = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      });

      await this.client.send(putCommand);
      const url = this.publicDomain
        ? `${this.publicDomain}/${key}`
        : `/api/storage/r2/${encodeURIComponent(key)}`;

      return { success: true, url, key };
    } catch (err) {
      console.error("❌ [Cloudflare R2] Media upload failed:", err.message);
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
        Bucket: this.bucket,
        Key: key,
      });
      return await this.client.send(command);
    } catch (err) {
      return null;
    }
  }
}

const instance = new R2StorageService();
module.exports = instance;
