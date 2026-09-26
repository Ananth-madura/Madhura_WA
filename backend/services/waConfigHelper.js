const db = require("../config/database");
const wa = require("./whatsappCloudApi");
const { decrypt } = require("../backendutil/cryptoHelper");

async function loadUserConfig(userId) {
  return new Promise((resolve) => {
    if (userId) {
      db.query(
        "SELECT * FROM user_wa_configs WHERE user_id = ? AND is_enabled = 1 LIMIT 1",
        [userId],
        (err, rows) => {
          if (!err && rows && rows.length > 0) {
            return resolve(rows[0]);
          }
          // Fallback to any active system/admin config
          db.query(
            "SELECT * FROM user_wa_configs WHERE is_enabled = 1 ORDER BY id ASC LIMIT 1",
            (err2, fallbackRows) => {
              if (!err2 && fallbackRows && fallbackRows.length > 0) {
                return resolve(fallbackRows[0]);
              }
              resolve(false);
            }
          );
        }
      );
    } else {
      db.query(
        "SELECT * FROM user_wa_configs WHERE is_enabled = 1 ORDER BY id ASC LIMIT 1",
        (err, rows) => {
          if (err || !rows || rows.length === 0) return resolve(false);
          resolve(rows[0]);
        }
      );
    }
  });
}

async function configureForUser(userId) {
  const config = await loadUserConfig(userId);
  if (!config) {
    // If environment variables are set, use them
    if (process.env.WA_PHONE_NUMBER_ID && process.env.WA_ACCESS_TOKEN) {
      resetToEnvConfig();
      return true;
    }
    return false;
  }

  wa.phoneNumberId = config.phone_number_id;
  wa.accessToken = decrypt(config.access_token);
  wa.wabaId = config.waba_id || "";
  wa.appSecret = decrypt(config.app_secret || "");
  wa.verifyToken = config.verify_token || "crm_verify_123";
  wa.businessAccountId = config.business_account_id || "";

  // Attempt to fetch phone number info if not already cached
  if (wa.phoneNumberId && wa.accessToken && !wa.displayPhoneNumber) {
    try {
      wa.getPhoneNumberInfo()
        .then((info) => {
          if (info?.display_phone_number) {
            wa.displayPhoneNumber = info.display_phone_number;
          }
          if (info?.verified_name) {
            wa.verifiedName = info.verified_name;
          }
        })
        .catch(() => {});
    } catch (_) {}
  }

  return true;
}

function resetToEnvConfig() {
  wa.phoneNumberId = process.env.WA_PHONE_NUMBER_ID || "";
  wa.accessToken = process.env.WA_ACCESS_TOKEN || "";
  wa.wabaId = process.env.WA_WABA_ID || "";
  wa.appSecret = process.env.WA_APP_SECRET || "";
  wa.verifyToken = process.env.WA_VERIFY_TOKEN || "crm_verify_123";
  wa.businessAccountId = process.env.WA_BUSINESS_ACCOUNT_ID || "";
  wa.displayPhoneNumber = process.env.WA_DISPLAY_PHONE_NUMBER || "";
  wa.verifiedName = process.env.WA_VERIFIED_NAME || "";
}

module.exports = { loadUserConfig, configureForUser, resetToEnvConfig };