const db = require("../config/database");
const wa = require("./whatsappCloudApi");
const { decrypt } = require("../backendutil/cryptoHelper");

// Resolve the Cloud API config for a user.
//
// It deliberately does NOT fall back to "any enabled config". That fallback
// picked the lowest-id row, so a user with no Cloud API of their own silently
// sent through a colleague's phone_number_id and access_token — messages going
// out from a number the sender does not own. The only permitted fallback is the
// single process-wide config from the environment.
async function loadUserConfig(userId) {
  if (!userId) return false;
  return new Promise((resolve) => {
    db.query(
      "SELECT * FROM user_wa_configs WHERE user_id = ? AND is_enabled = 1 LIMIT 1",
      [userId],
      (err, rows) => {
        if (!err && rows && rows.length > 0) return resolve(rows[0]);
        resolve(false);
      }
    );
  });
}

// True when this process has a system-wide Cloud API config in the environment.
// This is shared by design (one number for the whole install), unlike a
// per-user row, so it is a legitimate fallback.
function hasSystemEnvConfig() {
  return Boolean(process.env.WA_PHONE_NUMBER_ID && process.env.WA_ACCESS_TOKEN);
}

async function configureForUser(userId) {
  const config = await loadUserConfig(userId);
  if (!config) {
    if (hasSystemEnvConfig()) {
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

module.exports = { loadUserConfig, configureForUser, resetToEnvConfig, hasSystemEnvConfig };