"use strict";
const assert = require("assert/strict");
const fs = require("fs"), path = require("path"), vm = require("vm");
const { redactChatWrite } = require("../services/waChatPrivacy");
const previous = process.env.WA_SERVER_CHAT_STORAGE;
delete process.env.WA_SERVER_CHAT_STORAGE;
try {
  const insert = redactChatWrite("INSERT INTO wa_message_logs (phone, direction, message_text, status, metadata, created_at) VALUES (?, 'inbound', ?, 'delivered', ?, NOW())", ['919876543210', 'Private chat', '{"document":{"id":"media-id"}}']);
  assert.deepEqual(insert.params, ['919876543210', null, null]);
  const update = redactChatWrite("UPDATE wa_message_logs SET media_url = ?, media_filename = COALESCE(?, media_filename), status = ? WHERE wa_message_id = ?", ['/private.pdf', 'private.pdf', 'sent', 'wamid.1']);
  assert.deepEqual(update.params, [null, null, 'sent', 'wamid.1']);
  const contacts = redactChatWrite("INSERT INTO wa_contacts (name, phone, last_message_text) VALUES (?, ?, ?)", ['Customer', '919876543210', 'Private chat']);
  assert.deepEqual(contacts.params, ['Customer', '919876543210', null]);
  const webhook = redactChatWrite("INSERT INTO wa_webhook_events (event_type, payload) VALUES (?, ?)", ['message', '{"text":"Private chat"}']);
  assert.equal(webhook.params[1], null);
  const campaign = redactChatWrite("INSERT INTO wa_campaign_messages (phone, message_text) VALUES (?, ?)", ['919876543210', 'Configured campaign']);
  assert.equal(campaign.params[1], 'Configured campaign', 'Configured campaign content remains available to scheduled sends');
  const literal = redactChatWrite("INSERT INTO wa_message_logs (message_text, status) VALUES ('private literal', 'sent')", []);
  assert(!literal.sql.includes('private literal'));
} finally { if (previous === undefined) delete process.env.WA_SERVER_CHAT_STORAGE; else process.env.WA_SERVER_CHAT_STORAGE = previous; }

async function main() {
  let state = 'sent'; const counts = [];
  const db = { promise: () => ({ query: async (sql, values) => {
    if (sql.startsWith('UPDATE wa_campaign_messages')) {
      const next = values[0];
      const rank = { sent: 1, delivered: 2, read: 3 };
      if ((rank[next] || 0) <= rank[state]) return [{ affectedRows: 0 }];
      state = next; return [{ affectedRows: 1 }];
    }
    if (sql.startsWith('SELECT DISTINCT')) return [[{ campaign_id: 12 }]];
    if (sql.startsWith('UPDATE wa_campaigns')) counts.push(sql);
    return [{ affectedRows: 1 }];
  } }) };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../services/waDeliveryReceipts.js'), 'utf8'), { module, require: () => db, Date, Set });
  await module.exports.applyDeliveryReceipt('wamid.1', 'read');
  await module.exports.applyDeliveryReceipt('wamid.1', 'delivered');
  await module.exports.applyDeliveryReceipt('wamid.1', 'read');
  assert.equal(state, 'read');
  assert.equal(counts.length, 1, 'Duplicate/out-of-order receipts cannot inflate campaign totals');
  assert(counts[0].includes("status IN ('delivered','read')"), 'A read receipt also counts as delivered');
  console.log('PASS: browser-local privacy policy, preserved contacts/workflow configuration, monotonic campaign receipts');
}
main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
