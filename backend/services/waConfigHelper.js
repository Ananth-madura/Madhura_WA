const db = require("../config/database");
const wa = require("./whatsappCloudApi");

// Resolve the Cloud API config for a user.
//
// It deliberately does NOT fall back to "any enabled config". That fallback
// picked the lowest-id row, so a user with no Cloud API of their own silently
// sent through a colleague's phone_number_id and access_token — messages going
// out from a number the sender does not own. The only permitted fallback is the
// single process-wide config from the environment.
async function loadUserConfig(userId) {
  if (!userId) return false;
  return new Promise((resolve, reject) => {
    db.query(
      "SELECT * FROM user_wa_configs WHERE user_id = ? LIMIT 1",
      [userId],
      (err, rows) => {
        if (err) return reject(err);
        if (rows && rows.length > 0) return resolve(rows[0]);
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

// Legacy readiness call: never mutates the process-wide provider client.
async function configureForUser(userId) {
  return (await cloudClientForUser(userId)).isConfigured();
}

async function cloudClientForUser(userId) {
  const config = await loadUserConfig(userId);
  if (config && (config.is_enabled === 0 || config.is_enabled === false)) return wa.withAccount({});
  if (config) return wa.withAccount({ ...config, access_token: config.access_token, phone_number: config.display_phone_number });
  return wa.withAccount({ phone_number_id: process.env.WA_PHONE_NUMBER_ID || "", access_token: process.env.WA_ACCESS_TOKEN || "", waba_id: process.env.WA_WABA_ID || "", phone_number: process.env.WA_DISPLAY_PHONE_NUMBER || "", app_secret: process.env.WA_APP_SECRET || "", verify_token: process.env.WA_VERIFY_TOKEN || "", business_account_id: process.env.WA_BUSINESS_ACCOUNT_ID || "", verified_name: process.env.WA_VERIFIED_NAME || "" });
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

module.exports = { loadUserConfig, configureForUser, resetToEnvConfig, hasSystemEnvConfig, cloudClientForUser };
