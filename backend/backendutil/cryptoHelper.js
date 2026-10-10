const crypto = require("crypto");

const ALGORITHM = "aes-256-cbc";
// Secret key from environment or a secure default
// Rebranded default (Madhura Tech). Old Achme key is kept as a fallback so
// SMTP passwords encrypted before the rename still decrypt correctly.
const configuredKey = process.env.SMTP_ENCRYPTION_KEY;
const ENCRYPTION_KEY = configuredKey
  ? (/^[a-f0-9]{64}$/i.test(configuredKey) ? Buffer.from(configuredKey, "hex") : Buffer.from(configuredKey))
  : (process.env.NODE_ENV === "production" ? null : Buffer.from("MadhuraSmtpSecretKey123456789012"));
const LEGACY_ENCRYPTION_KEY = Buffer.from("AchmeSmtpSecretKey12345678901234"); // pre-rebrand fallback, exactly 32 bytes
const IV_LENGTH = 16; // For AES, this is always 16 bytes

function encrypt(text) {
  if (!text) return "";
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) throw new Error("Configure a 32-byte SMTP_ENCRYPTION_KEY before saving credentials");
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

function decrypt(text) {
  if (!text) return "";
  try {
    // If it's a placeholder, return as is
    if (text === "••••••••••••••••") return text;
    
    const textParts = text.split(":");
    if (textParts.length < 2) {
      // Not encrypted, return plain text (for backwards compatibility/fallbacks)
      return text;
    }
    const iv = Buffer.from(textParts.shift(), "hex");
    const encryptedText = Buffer.from(textParts.join(":"), "hex");
    // Try current key first, then legacy pre-rebrand key
    const keys = process.env.NODE_ENV === "production" ? [ENCRYPTION_KEY] : [ENCRYPTION_KEY, LEGACY_ENCRYPTION_KEY];
    for (const key of keys.filter((key) => key && key.length === 32)) {
      try {
        const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(key), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
      } catch (_) {
        // try next key
      }
    }
    throw new Error("Stored credentials could not be decrypted; configure the original encryption key or re-enter credentials");
  } catch (error) {
    throw error;
  }
}

module.exports = { encrypt, decrypt };
