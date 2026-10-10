// Isolated browser fixtures: no requests reach a CRM or WhatsApp sender.
const fs = require('fs'), path = require('path'), http = require('http'), assert = require('assert/strict');
const puppeteer = require('../../backend/node_modules/puppeteer');
const build = path.resolve(__dirname, '../build'), output = path.resolve(__dirname, '../.qa');
const chat = { id: '919123456789@c.us', name: 'Food Store', unreadCount: 0, timestamp: 1791522000, lastMessage: { body: 'Choose a category' } };
const messages = [
  { id: 'menu-list', body: 'Choose a category', isMe: true, type: 'interactive', timestamp: 1791522060, status: 'sent', interactive: { type: 'list', text: 'Choose a category', button_text: 'View categories', sections: [{ title: 'Wholesale', rows: [{ id: 'rice', title: 'Rice & grains', description: 'Bulk packs and bags' }, { id: 'oil', title: 'Cooking oil', description: 'Wholesale cartons' }] }, { title: 'Help', rows: [{ id: 'support', title: 'Talk to the team' }] }] } },
  { id: 'menu-buttons', body: 'Welcome to Food Store. What do you need today?', isMe: true, type: 'interactive', timestamp: 1791522000, status: 'sent', interactive: { type: 'buttons', text: 'Welcome to Food Store. What do you need today?', native: true, buttons: [{ id: 'view-menu', title: 'View full menu' }, { id: 'offers', title: "Today's offers" }, { id: 'quote', title: 'Bulk price list' }] } },
];
async function main() {
  fs.mkdirSync(output, { recursive: true });
  const server = http.createServer((req, res) => {
    const file = path.resolve(build, `.${new URL(req.url, 'http://localhost').pathname}`);
    const target = file.startsWith(build + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(build, 'index.html');
    res.setHeader('Content-Type', target.endsWith('.js') ? 'application/javascript' : target.endsWith('.css') ? 'text/css' : 'text/html');
    fs.createReadStream(target).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await puppeteer.launch({ executablePath: process.env.WA_QA_BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, pipe: true,
      args: ['--no-sandbox', '--disable-gpu', '--host-resolver-rules=MAP * 127.0.0.1'] });
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.pathname.includes('/api/')) {
        let response = [];
        if (url.pathname.endsWith('/automations/stats')) response = { totalRules: 0, activeRules: 0, totalRuns: 1, sentCount: 1, failedCount: 0 };
        else if (url.pathname.endsWith('/logs/recent')) response = [
          { id: 1, automation_name: 'Order follow-up', trigger_type: 'order_created', phone: '919123456789', status: 'scheduled', execution_step: 2, scheduled_for: '2026-10-09T15:30:00Z' },
          { id: 2, automation_name: 'Order follow-up', trigger_type: 'order_created', phone: '919123456789', status: 'unknown', execution_step: 2, error: 'Provider response timed out' },
          { id: 3, automation_name: 'Order follow-up', trigger_type: 'order_created', phone: '919123456789', status: 'sent', execution_step: 1, wa_message_id: 'wamid.fixture' }
        ];
        else if (url.pathname.endsWith('/interactive-capabilities')) response = { nativeButtons: true, webConnected: false, serverChatStorage: false, senders: [{ type: 'cloud_api', name: 'Fixture Cloud sender' }] };
        else if (url.pathname.includes('status')) response = { connected: true, isCloud: true, phone: '919123456789', activeEngine: 'Cloud API', cloud: { configured: true } };
        else if (url.pathname.endsWith('/chats')) response = [chat];
        else if (url.pathname.endsWith('/messages')) response = messages;
        return request.respond({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' }, body: JSON.stringify(response) });
      }
      if (url.hostname === '127.0.0.1') return request.continue();
      return request.abort();
    });
    await page.evaluateOnNewDocument((activeChat, cachedMessages) => {
      localStorage.setItem('user', JSON.stringify({ id: 999, name: 'Menu preview', role: 'admin' }));
      localStorage.setItem('token', 'local-qa-fixture');
      localStorage.setItem('wa_user_999:wa_cached_status', JSON.stringify({ connected: true, isCloud: true, phone: '919123456789' }));
      localStorage.setItem('wa_user_999:wa_cached_chats', JSON.stringify([activeChat]));
      localStorage.setItem('wa_user_999:wa_active_chat', JSON.stringify(activeChat));
      localStorage.setItem(`wa_user_999:wa_chat_messages_${activeChat.id}`, JSON.stringify(cachedMessages));
    }, chat, messages);
    for (const [name, width, height] of [['desktop', 1440, 950], ['mobile', 390, 844]]) {
      await page.setViewport({ width, height });
      await page.goto(`http://127.0.0.1:${server.address().port}/whatsapp`, { waitUntil: 'networkidle0' });
      if (name === 'mobile') {
        await page.$$eval('div.cursor-pointer.text-left', (elements) => elements.find((element) => element.textContent.includes('Food Store'))?.click());
      }
      await page.waitForSelector('.wa-interactive-options');
      await page.waitForFunction(() => document.querySelector('.wa-interactive-options')?.getBoundingClientRect().width > 0);
      await page.$eval('.wa-options-toggle', (element) => element.click());
      await page.$eval('.wa-options-toggle', (element) => element.closest('.wa-interactive-options').scrollIntoView({ block: 'end' }));
      await page.waitForFunction(() => [...document.querySelectorAll('.wa-bubble-enter')].every((element) => Number(getComputedStyle(element).opacity) >= 0.99));
      assert.equal(await page.$$eval('.wa-option', (elements) => elements.length), 6);
      assert.equal(await page.$$eval('.wa-option', (elements) => elements.every((element) => element.disabled)), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `${name} has horizontal page overflow`);
      await page.mouse.move(width / 2, height / 2);
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await page.screenshot({ path: path.join(output, `menu-${name}.png`), fullPage: true });
    }
    await page.setViewport({ width: 1440, height: 950 });
    await page.goto(`http://127.0.0.1:${server.address().port}/whatsapp/automations`, { waitUntil: 'networkidle0' });
    await page.$$eval('button', (buttons) => buttons.find((button) => button.textContent.includes('Execution Audit Logs'))?.click());
    await page.waitForFunction(() => document.body.textContent.includes('Check delivery before retrying'));
    const logs = await page.$$eval('tbody tr', (rows) => rows.map((row) => row.textContent));
    assert(logs.some((text) => text.includes('scheduled') && text.includes('Step 2') && text.includes('Due')));
    assert(logs.some((text) => text.includes('unknown') && text.includes('Provider response timed out')));
    assert(logs.some((text) => text.includes('sent') && text.includes('wamid.fixture')));
    await page.$eval('tbody', (element) => element.scrollIntoView({ block: 'center' }));
    await page.screenshot({ path: path.join(output, 'automation-logs-desktop.png'), fullPage: true });
    assert.deepEqual(errors, []);
    console.log('PASS: desktop/mobile menus and automation queue, unknown outcome, and provider ID log states');
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}
main().catch((err) => { console.error(err); process.exitCode = 1; });
