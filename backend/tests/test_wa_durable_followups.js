const assert = require('assert/strict'), fs = require('fs'), vm = require('vm');
const { createRequire } = require('module');
const filename = require.resolve('../services/waAutomationService');
const realRequire = createRequire(filename);
const queued = [], sends = [], updates = [];
let active = true, blocked = false, unknown = false, menus = 0;
const rule = { id: 71, name: 'Order follow-up', is_active: 1, message_text: 'Thanks {name}', followup_message_text: 'Order {order_no} is ready', sequence_delay_seconds: 7 };
const db = { promise: () => ({ query: async (sql, params = []) => {
  updates.push({ sql, params });
  if (sql.startsWith('INSERT INTO wa_automation_logs') && sql.includes("'scheduled'")) {
    queued.push({ log_id: 81 + queued.length, rule_id: rule.id, phone: params[1], contact_name: params[2], trigger_data: params[3], execution_step: 2, session_key: params[5], target_chat_id: params[6], state: 'scheduled' });
    return [{ insertId: queued.at(-1).log_id, affectedRows: 1 }];
  }
  if (sql.includes('FROM wa_automation_logs l')) return [queued.filter((row) => row.state === 'scheduled').map((row) => ({ ...rule, ...row }))];
  if (sql.includes("claimed_at = NOW()")) {
    const row = queued.find((item) => item.log_id === params[0]);
    if (!row || row.state !== 'scheduled') return [{ affectedRows: 0 }];
    row.state = 'sending'; return [{ affectedRows: 1 }];
  }
  if (sql.startsWith('SELECT is_active')) return [[{ is_active: active ? 1 : 0 }]];
  if (sql.includes('FROM wa_opt_outs')) return [blocked ? [{ id: 1 }] : []];
  if (sql.startsWith('SELECT')) return [[]];
  if (sql.includes("SET status = 'sent'")) queued.find((row) => row.log_id === params[0]).state = 'sent';
  if (sql.startsWith('UPDATE wa_automation_logs SET status = ?')) queued.find((row) => row.log_id === params[2]).state = params[0];
  return [{ affectedRows: 1, insertId: 80 }];
} }) };
function freshProcess() {
  const module = { exports: {} };
  const mocks = {
    '../config/database': db, './whatsappService': { defaultKey: 'default' }, '../server': {},
    './waMenuHandler': { getOptions: async () => [{ id: 'menu' }], sendMenu: async () => { menus++; } },
    './waLoadBalancer': { sendTextMessage: async (phone, text, session) => {
      sends.push({ phone, text, session });
      if (unknown) throw Object.assign(new Error('Provider response timed out'), { deliveryUnknown: true });
      return { result: { messages: [{ id: `wamid.${sends.length}` }] } };
    } }
  };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module, exports: module.exports, require: (name) => mocks[name] || realRequire(name), process, console,
    Date, setTimeout: () => ({ unref() {} }), setInterval: () => ({ unref() {} }), clearTimeout, clearInterval
  }, { filename });
  return module.exports;
}
(async () => {
  let service = freshProcess();
  const result = await service.executeAutomationSend(rule, '919123456789', 'Priya', null, { order_no: 'ORD-7' }, '42', 'original@lid');
  assert(result.success); assert.equal(queued.length, 1); assert.equal(menus, 1);
  service = freshProcess(); // No timer from the previous process can run.
  await Promise.all([service.runDueAutomationsSweep(), service.runDueAutomationsSweep()]);
  assert.equal(sends.length, 2, 'Concurrent recovery claims send a follow-up only once');
  assert.deepEqual(sends[1], { phone: 'original@lid', text: 'Order ORD-7 is ready', session: '42' });
  assert.equal(queued[0].state, 'sent'); assert.equal(menus, 1, 'Follow-up does not replay menus');
  assert.equal(updates.filter((q) => q.sql.includes('run_count = run_count + 1')).length, 1);
  assert(!updates.some((q) => q.sql.includes('wa_message_logs') && q.sql.includes("'delivered'")));
  const queueAgain = async () => {
    active = true; blocked = false; unknown = false;
    await freshProcess().executeAutomationSend(rule, '919123456789', 'Priya', null, {}, '42');
  };
  await queueAgain(); active = false;
  const beforePause = sends.length; await freshProcess().runDueAutomationsSweep();
  assert.equal(sends.length, beforePause); assert.equal(queued[1].state, 'skipped');
  await queueAgain(); blocked = true;
  const beforeOptOut = sends.length; await freshProcess().runDueAutomationsSweep();
  assert.equal(sends.length, beforeOptOut); assert.equal(queued[2].state, 'failed');
  await queueAgain(); unknown = true;
  await freshProcess().runDueAutomationsSweep(); assert.equal(queued[3].state, 'unknown');
  const beforeRetry = sends.length; await freshProcess().runDueAutomationsSweep(); assert.equal(sends.length, beforeRetry);
  assert(updates.some((q) => q.sql.includes('trigger_data = NULL')));
  console.log('PASS: restart recovery, atomic follow-up claims, original sender/chat, paused rules, opt-outs and unknown-send suppression');
})().catch((error) => { console.error(error); process.exitCode = 1; });
