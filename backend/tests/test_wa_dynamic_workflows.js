"use strict";
const assert = require("assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { createRequire } = require("module");
const { normalizeConditions, matchesConditions } = require("../services/waRuleConditions");

function load(relative, mocks) {
  const filename = path.resolve(__dirname, relative);
  const realRequire = createRequire(filename);
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, "utf8"), {
    module, exports: module.exports, __dirname: path.dirname(filename),
    require: (name) => Object.hasOwn(mocks, name) ? mocks[name] : realRequire(name),
    console, process, Date, setTimeout, setInterval, clearTimeout, clearInterval, URL,
  }, { filename });
  return module.exports;
}

async function main() {
  assert(matchesConditions({ match: 'all', rules: [
    { field: 'customer.plan', operator: 'equals', value: 'gold' },
    { field: 'balance', operator: 'gte', value: 0 },
  ] }, { customer: { plan: 'Gold' }, balance: 0 }));
  assert(!matchesConditions('{invalid json', {}));
  assert(!matchesConditions({ match: 'all', rules: [{ field: 'missing', operator: 'not_equals', value: 'x' }] }, {}));
  assert(matchesConditions({ match: 'any', rules: [{ field: 'city', operator: 'equals', value: 'Pune' }, { field: 'email', operator: 'not_exists' }] }, { city: 'Delhi' }));
  assert.throws(() => normalizeConditions({ match: 'all', rules: [{ field: 'amount', operator: 'unknown', value: 2 }] }));

  let sent = 0, failSend = false;
  const rules = [{ id: 17, name: 'Gold plan', message_text: 'Hello {name}', conditions: { match: 'all', rules: [{ field: 'plan', operator: 'equals', value: 'gold' }] } }];
  const queries = [];
  const db = { promise: () => ({ query: async (sql, params) => {
    queries.push({ sql, params });
    if (sql.includes('WHERE a.is_active = 1')) return [rules];
    if (sql.startsWith('SELECT')) return [[]];
    return [{ affectedRows: 1, insertId: 1 }];
  } }) };
  const automation = load('../services/waAutomationService.js', {
    '../config/database': db,
    './whatsappService': { defaultKey: '1' },
    './waLoadBalancer': { sendTextMessage: async () => { sent++; if (failSend) throw Error('Sender offline'); return { result: { id: 'real-id' } }; } },
    './waMenuHandler': { getOptions: async () => [], sendMenu: async () => {} },
    '../server': {},
  });
  const format = automation.formatMessagePlaceholders;
  assert.equal(format('{customer.name}: {service} / {custom_1} / {amount}', null, { customer: { name: 'Priya' }, service: 'Repair', custom_1: false, amount: 0 }), 'Priya: Repair / false / ₹0');
  assert.equal(format('{brand_name}', 'Priya', { brand_name: 'Custom Brand' }), 'Custom Brand');
  assert.equal(format('{Hi|Hello} {name}', 'Priya', {}, { spintaxEnabled: false }), '{Hi|Hello} Priya');
  assert.equal(format('{unknown}', 'Priya'), '{unknown}');
  const skipped = await automation.triggerAutomation('new_lead', { phone: '919123456789', data: { plan: 'silver' } });
  assert.equal(skipped.triggeredCount, 0);
  assert.equal(sent, 0);
  const dispatched = await automation.triggerAutomation('new_lead', { phone: '919123456789', data: { plan: 'gold' } });
  assert.equal(dispatched.triggeredCount, 1);
  assert.equal(sent, 1);
  failSend = true;
  const failed = await automation.triggerAutomation('new_lead', { phone: '919123456780', data: { plan: 'gold' } });
  assert.equal(failed.success, false);
  assert.equal(failed.triggeredCount, 0);
  failSend = false;
  const retried = await automation.triggerAutomation('new_lead', { phone: '919123456780', data: { plan: 'gold' } });
  assert.equal(retried.triggeredCount, 1, 'A definitive send failure releases the event claim');
  const event = { phone: '919123456781', data: { plan: 'gold', invoice_id: 1 } };
  assert.equal((await automation.triggerAutomation('invoice_created', event)).triggeredCount, 1);
  assert.equal((await automation.triggerAutomation('invoice_created', event)).reason, 'duplicate_suppressed');
  assert.equal((await automation.triggerAutomation('invoice_created', { ...event, data: { ...event.data, invoice_id: 2 } })).triggeredCount, 1, 'Distinct invoices for the same contact remain independent');

  const reminderQueries = [], schedules = [];
  const scheduler = load('../services/waReminderScheduler.js', {
    '../config/database': { promise: () => ({ query: async (sql, params = []) => {
      reminderQueries.push({ sql, params });
      if (sql.includes('wa_reminder_settings')) return [[{ payment_due_days_before: 3, appointment_reminder_hours_before: 48 }]];
      if (sql.includes('FROM clientinvoices ci')) return [[{ id: 101, phone: '919123456789' }]];
      if (sql.startsWith('UPDATE')) return [{ affectedRows: 1 }];
      return [[]];
    } }) },
    './waConfirmationService': { sendInteractiveReminder: async () => ({ success: false, error: 'Sender offline' }) },
    'node-schedule': { scheduleJob: (spec) => { schedules.push(spec); return { cancel() {} }; } },
  });
  await scheduler.runAppointmentReminderCheck();
  assert.equal(reminderQueries.find((q) => q.sql.includes('FROM telecalls')).params[0], 2);
  await scheduler.runPaymentDueInteractiveCheck();
  assert.equal(reminderQueries.find((q) => q.sql.includes('FROM clientinvoices ci')).params[0], 3);
  assert(reminderQueries.some((q) => q.sql.includes('SET wa_payment_due_sent = 0')), 'A failed interactive reminder releases its invoice claim');
  scheduler.startInteractiveReminderSchedulers();
  assert.equal(schedules.length, 4);
  assert(schedules.every((spec) => spec.tz === (process.env.TZ || 'Asia/Kolkata')));

  const flow = load('../services/waFlowEngine.js', {
    '../config/database': { promise: () => ({ query: async (sql) => sql.startsWith('SELECT node_key') ? [[{ node_key: 'start' }]] : [{ insertId: 9, affectedRows: 1 }] }) },
    './whatsappService': { defaultKey: '1' },
  });
  flow.resolveInitialCrmVars = async () => ({ name: 'CRM Name', service: 'Default Service' });
  flow.logEvent = async () => {};
  flow.executeNodeChain = async (_run, _flow, _phone, _node, vars) => vars;
  const flowVars = await flow.startFlowRun({ id: 3, entry_node_key: 'start' }, '919123456789', 'operator-1', 'Interested', null, { service: 'Solar Installation', invoice_id: 101, automation_id: 17 });
  assert.equal(flowVars.service, 'Solar Installation');
  assert.equal(flowVars.invoice_id, 101);
  assert.equal(flowVars._session_key, 'operator-1');
  assert.equal(flowVars.last_input, 'Interested');

  const statuses = [];
  let reminderSendFails = true;
  const confirmation = load('../services/waConfirmationService.js', {
    '../config/database': {
      promise: () => ({ query: async (sql, params) => {
        if (sql.startsWith('INSERT')) { assert(sql.includes("'pending'")); return [{ insertId: 101 }]; }
        return [[]];
      } }),
      query: (sql, params, callback) => { statuses.push(sql); callback(null, { affectedRows: 1 }); },
    },
    './waAutomationService': { formatMessagePlaceholders: format, lookupCrmDataByPhone: async () => ({ service: 'Solar Repair' }) },
    './waLoadBalancer': { sendInteractiveButtons: async () => { if (reminderSendFails) throw Error('Offline'); return { native: true }; } },
  });
  assert.equal((await confirmation.sendInteractiveReminder({ phone: '919123456789' })).success, false);
  assert(statuses.some((sql) => sql.includes("status = 'failed'")));
  reminderSendFails = false;
  assert.equal((await confirmation.sendInteractiveReminder({ phone: '919123456789', messageText: 'Reminder for {service}' })).success, true);
  assert(statuses.some((sql) => sql.includes("status = 'sent'")));

  // Exercise the actual send route handlers without opening a port or connecting WhatsApp.
  let ready = false, cloud = false, cloudCalls = 0, writeCalls = 0;
  const session = { get ready() { return ready; }, sendMessage: async () => { throw Error('Web send failed'); } };
  const router = load('../routes/whatsappRoutes.js', {
    '../config/database': { promise: () => ({ query: async () => { writeCalls++; return [[]]; } }) },
    '../services/whatsappService': { get: () => session, default: () => session, defaultKey: '1' },
    '../services/whatsappCloudApi': { isConfigured: () => cloud, sendText: async () => { cloudCalls++; return { messages: [{ id: 'cloud-real' }] }; } },
    '../services/waConfigHelper': { configureForUser: async () => {} },
    '../services/waBotGate': { pauseBot: async () => {} },
  });
  async function request(route, body) {
    const layer = router.stack.find((item) => item.route?.path === route && item.route.methods.post);
    let status = 200, payload;
    const res = { status: (code) => { status = code; return res; }, json: (data) => { payload = data; return res; } };
    await layer.route.stack.at(-1).handle({ body, headers: {}, query: {}, user: { id: '1' } }, res);
    return { status, payload };
  }
  assert.equal((await request('/send', { chatId: '919123456789@c.us', message: 'Hi' })).status, 503);
  assert.equal((await request('/send-media', { chatId: '919123456789@c.us', mediaUrl: 'https://example.com/image.jpg' })).status, 503);
  assert.equal((await request('/send-location', { chatId: '919123456789@c.us', lat: 12, lng: 77 })).status, 503);
  assert.equal(writeCalls, 0, 'Unavailable sends must not create fabricated history');
  ready = true; cloud = true;
  assert.equal((await request('/send', { chatId: '919123456789@c.us', message: 'Hi' })).status, 502);
  assert.equal(cloudCalls, 0, 'An attempted Web send must never be repeated through Cloud');
  ready = false;
  assert.equal((await request('/send', { chatId: '919123456789@c.us', message: 'Hi' })).payload.id, 'cloud-real');
  assert.equal(cloudCalls, 1);
  assert.equal(writeCalls, 2, 'Confirmed Cloud sends update message history and the contact preview');

  console.log('PASS: conditions, custom data, failed automation results, and honest live chat delivery');
}
main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
