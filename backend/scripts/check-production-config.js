// Read-only launch check. Never opens a WhatsApp session or sends a message.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const { checkEnv } = require('../config/envCheck');
const result = checkEnv({ ...process.env, NODE_ENV: 'production', REQUIRE_HARD_CONFIG: '1' });
for (const error of result.errors) console.error(`FAIL: ${error}`);
for (const warning of result.warnings) console.warn(`WARN: ${warning}`);
if (!result.errors.length) console.log('Configuration validation passed. Live sending, webhook receipts and restore testing still require verification.');
process.exitCode = result.errors.length ? 1 : 0;
