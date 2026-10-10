"use strict";
const assert = require("assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { createRequire } = require("module");
function load(file, mocks) {
  const filename = path.resolve(__dirname, file), module = { exports: {} }, realRequire = createRequire(filename);
  vm.runInNewContext(fs.readFileSync(filename, "utf8"), { module, exports: module.exports,
    require: (name) => Object.hasOwn(mocks, name) ? mocks[name] : realRequire(name),
    __dirname: path.dirname(filename), console, process, Date, setTimeout, clearTimeout, setInterval, clearInterval, URL,
  }, { filename });
  return module.exports;
}
async function main() {
  let deliveryKind, failed = false;
  const records = [], delivered = [];
  const balancer = {
    sendInteractiveButtons: async (opts) => { deliveryKind = 'buttons'; delivered.push(opts); if (failed) throw Error('Sender offline'); return { native: true, result: { messages: [{ id: 'wamid.1' }] } }; },
    sendInteractiveList: async (opts) => { deliveryKind = 'list'; delivered.push(opts); return { native: true, result: { messages: [{ id: 'wamid.2' }] } }; },
  };
  const flow = load('../services/waFlowEngine.js', {
    '../config/database': { promise: () => ({ query: async () => [[]] }) },
    './waLoadBalancer': balancer,
    './whatsappService': { defaultKey: '1' },
  });
  flow.interpolate = (text, vars = {}) => String(text || '').replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
  flow.recordAndEmitBotMessage = async (...args) => { records.push(args); return args[6]?.id || 'failed-id'; };
  await flow.sendFlowInteractiveMenu('919123456789', 'Choose a product', [{ title: 'Products', buttons: [{ id: 'rice', label: '1. Rice' }, { id: 'oil', label: '2. Oil' }] }], null, null, 'operator');
  assert.equal(deliveryKind, 'buttons', 'A single short menu uses native reply buttons');
  assert.equal(records[0][3].buttons[0].id, 'rice');
  assert.equal(records[0][3].buttons[0].title, 'Rice');
  assert.equal(records[0][6].id, 'wamid.1');
  assert.equal(records[0][6].status, 'sent');
  await flow.sendFlowInteractiveMenu('919123456789', 'Categories', [{ title: 'Food', buttons: [{ id: 'rice', label: 'Rice' }] }, { title: 'Drinks', buttons: [{ id: 'juice', label: 'Juice' }] }]);
  assert.equal(deliveryKind, 'list');
  assert.equal(records.at(-1)[3].sections[1].rows[0].id, 'juice');
  failed = true;
  assert.equal(await flow.sendFlowButtons('919123456789', 'Choose', [{ id: 'rice', title: 'Rice' }]), null);
  assert.equal(records.at(-1)[6].status, 'failed', 'Failed sends are never recorded as delivered');
  failed = false;
  const config = { sections: [{ buttons: [{ label: 'Order', nextNodeId: 'first' }] }, { buttons: [{ label: 'Order', nextNodeId: 'second' }] }] };
  const options = flow.getMenuOptions(config, 'interactive_menu');
  assert.equal(options[0].id, 'opt_1');
  assert.equal(options[1].id, 'opt_2');
  const draft = { entry_node_key: 'menu', nodes: [
    { node_key: 'menu', node_type: 'interactive_menu', config },
    { node_key: 'first', node_type: 'send_message', config: { text: 'First product' } },
    { node_key: 'second', node_type: 'send_message', config: { text: 'Second product' } },
  ] };
  const preview = await flow.simulateFlowStep(draft, '', null);
  assert.equal(preview.messages[0].sections[1].buttons[0].id, 'opt_2');
  const selected = await flow.simulateFlowStep(draft, 'opt_2', { currentNodeKey: 'menu', vars: {} });
  assert.equal(selected.messages[0].text, 'Second product', 'Duplicate labels route by stable ID in preview');

  const router = load('../routes/whatsappRoutes.js', {
    '../config/database': {},
    '../services/whatsappService': { defaultKey: '1', get: () => ({ ready: false }) },
    '../services/whatsappCloudApi': {},
    '../services/waConfigHelper': {},
    '../services/waLoadBalancer': balancer,
    '../services/waFlowEngine': { recordAndEmitBotMessage: async (...args) => { records.push(args); return args[6].id; } },
    '../services/waBotGate': { pauseBot: async () => {} },
  });
  const handler = router.stack.find((layer) => layer.route?.path === '/send-interactive').route.stack.at(-1).handle;
  async function request(buttons) {
    let status = 200, data;
    const res = { status: (value) => { status = value; return res; }, json: (value) => { data = value; return res; } };
    await handler({ body: { chatId: '919123456789@c.us', message: 'Select', buttons }, headers: {}, query: {}, user: { id: 'operator' } }, res);
    return { status, data };
  }
  const sent = await request([{ id: 'small', title: 'Order' }, { id: 'large', title: 'Order' }]);
  assert.equal(sent.status, 200);
  assert.equal(sent.data.id, 'wamid.1');
  assert.equal(delivered.at(-1).sessionKey, 'operator');
  assert.equal(sent.data.interactive.buttons[1].id, 'large');
  assert.equal((await request([{ id: 'duplicate', title: 'Order' }, { id: 'duplicate', title: 'Order' }])).status, 400);
  assert.equal((await request([{ id: 'bad', title: 'Open', type: 'url', url: 'javascript:alert(1)' }])).status, 400);
  const recordsBefore = records.length;
  failed = true;
  assert.equal((await request([{ id: 'small', title: 'Order' }])).status, 502);
  assert.equal(records.length, recordsBefore, 'The menu endpoint cannot fabricate a successful send after a transport error');

  // Exercise the history mapper using the real method with a mocked store.
  const source = fs.readFileSync(path.resolve(__dirname, '../services/whatsappService.js'), 'utf8');
  const start = source.indexOf('  async getMessages('), end = source.indexOf('\n  async sendSeen(', start);
  const history = vm.runInNewContext(`(class { ${source.slice(start, end)} })`, {
    require: (name) => name === './waChatPrivacy' ? { serverChatStorageEnabled: () => true } : ({ promise: () => ({ query: async () => [[{ id: 1, phone: '919123456789', direction: 'outbound', message_type: 'interactive', body: 'Choose', wa_message_id: 'wamid.1', created_at: '2026-10-09T09:00:00Z', interactive_payload: JSON.stringify({ type: 'buttons', text: 'Choose', buttons: [{ id: 'rice', title: 'Rice' }] }) }]] }) }),
    Date, console, process,
  });
  const service = new history();
  Object.assign(service, { key: '1', messagesFetchCache: {}, messagesCache: { chat: [{ id: 'wamid.1', body: 'Choose', timestamp: 1, hasMedia: false }] }, ready: false });
  const messages = await service.getMessages('chat', true, 10);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].hasMedia, false);
  assert.equal(messages[0].interactive.buttons[0].id, 'rice', 'Interactive history survives live-message merge');
  console.log('PASS: native menu selection, normalized saved options, stable preview routing, failed status, and history reload');
}
main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
