const crypto = require("crypto");

const ALGORITHM = "aes-256-cbc";
// Secret key from environment or a secure default
// Rebranded default (Madhura Tech). Old Achme key is kept as a fallback so
// SMTP passwords encrypted before the rename still decrypt correctly.
const ENCRYPTION_KEY = process.env.SMTP_ENCRYPTION_KEY || Buffer.from("MadhuraSmtpSecretKey123456789012"); // Must be exactly 32 bytes
const LEGACY_ENCRYPTION_KEY = Buffer.from("AchmeSmtpSecretKey12345678901234"); // pre-rebrand fallback, exactly 32 bytes
const IV_LENGTH = 16; // For AES, this is always 16 bytes

function encrypt(text) {
  if (!text) return "";
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
    for (const key of [ENCRYPTION_KEY, LEGACY_ENCRYPTION_KEY]) {
      try {
        const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(key), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
      } catch (_) {
        // try next key
      }
    }
    console.error("Decryption failed with current and legacy keys");
    // Return original text if decryption fails
    return text;
  } catch (error) {
    console.error("Decryption failed:", error);
    // Return original text if decryption fails
    return text;
  }
}

module.exports = { encrypt, decrypt };
