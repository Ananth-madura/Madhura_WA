const assert = require('assert/strict'), fs = require('fs'), vm = require('vm');
const source = fs.readFileSync(require.resolve('../routes/waAutomationRoutes'), 'utf8');
const start = source.indexOf('router.post("/:id/trigger"'), end = source.indexOf('router.get("/logs/recent"', start);
let handler, result = { success: false, error: 'Sender offline' }, calls = 0;
vm.runInNewContext(source.slice(start, end), {
  router: { post: (path, auth, callback) => { handler = callback; } }, auth: () => {},
  db: { promise: () => ({ query: async (sql, params) => {
    assert(sql.includes('a.created_by = ?')); assert.equal(params[1], 41);
    return [[{ id: 71, message_text: 'Hello {name}', followup_message_text: 'Follow-up', sequence_delay_seconds: 7 }]];
  } }) },
  require: (name) => name.endsWith('whatsappService') ? { get: (key) => { assert.equal(key, '41'); return { key }; } }
    : {
      lookupCrmDataByPhone: async () => ({ city: 'Actual customer city' }),
      formatMessagePlaceholders: (text) => text,
      executeAutomationSend: async (rule, phone, contact, text, data, session) => {
        calls++; assert.equal(session, '41'); assert.equal(data.invoice_no, undefined); assert.equal(data.amount, undefined); return result;
      }
    }
});
async function invoke(body) {
  let status = 200, response;
  await handler({ params: { id: 71 }, user: { id: 41 }, headers: {}, query: {}, body }, {
    status(value) { status = value; return this; }, json(value) { response = value; }
  });
  return { status, response };
}
(async () => {
  const input = { phone: '919123456789' };
  assert.equal((await invoke({ ...input, sessionKey: '42' })).status, 403); assert.equal(calls, 0);
  assert.equal((await invoke({ phone: 'invalid' })).status, 400); assert.equal(calls, 0);
  assert.equal((await invoke(input)).status, 502);
  result = { success: false, error: 'Outcome unknown', deliveryUnknown: true };
  const unknown = await invoke(input); assert.equal(unknown.status, 504); assert.equal(unknown.response.deliveryUnknown, true);
  result = { success: true }; const accepted = await invoke(input);
  assert.equal(accepted.status, 200); assert(accepted.response.message.includes('queued'));
  console.log('PASS: manual automation uses own sender, real event fields and honest failed/unknown/queued responses');
})().catch((error) => { console.error(error); process.exitCode = 1; });
