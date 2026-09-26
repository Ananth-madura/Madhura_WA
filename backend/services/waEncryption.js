const crypto = require("crypto");

/**
 * AES-256-GCM Encryption Service
 * Used for encrypting sensitive tokens, API keys, and webhook secrets.
 * Format: <iv_hex>:<ciphertext_hex>:<authTag_hex>
 */

function getEncryptionKey() {
  const envKey = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || "madhura_crm_secure_encryption_key_2026_default";
  // Create a 32-byte (256-bit) buffer deterministically from the key string
  return crypto.createHash("sha256").update(String(envKey)).digest();
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns: "gcm:<iv_hex>:<ciphertext_hex>:<authTag_hex>"
 */
function encrypt(plaintext) {
  if (!plaintext || typeof plaintext !== "string") return plaintext;
  
  // If already encrypted with GCM prefix, do not re-encrypt
  if (plaintext.startsWith("gcm:")) return plaintext;

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(12); // 96-bit IV for GCM
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv, { authTagLength: 16 });
    
    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag().toString("hex");

    return `gcm:${iv.toString("hex")}:${encrypted}:${authTag}`;
  } catch (err) {
    console.error("Encryption error:", err.message);
    return plaintext;
  }
}

/**
 * Decrypt a ciphertext string.
 * Supports "gcm:<iv>:<ciphertext>:<tag>" as well as legacy/plaintext fallback.
 */
function decrypt(ciphertext) {
  if (!ciphertext || typeof ciphertext !== "string") return ciphertext;

  // Not encrypted with our GCM prefix, return as-is
  if (!ciphertext.startsWith("gcm:")) return ciphertext;

  try {
    const parts = ciphertext.split(":");
    if (parts.length !== 4) return ciphertext;

    const [, ivHex, encHex, tagHex] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(tagHex, "hex");

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv, { authTagLength: 16 });
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (err) {
    console.error("Decryption error (returning raw):", err.message);
    return ciphertext;
  }
}

/**
 * Generate a cryptographically secure random API key with hash.
 */
function generateApiKey(prefix = "wacrm_live_") {
  const randomBytes = crypto.randomBytes(24).toString("base64url");
  const rawKey = `${prefix}${randomBytes}`;
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.slice(0, 16) + "...";

  return { rawKey, keyHash, keyPrefix };
}

module.exports = {
  encrypt,
  decrypt,
  generateApiKey,
};
