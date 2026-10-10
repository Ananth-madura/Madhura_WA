const assert = require('assert/strict'), fs = require('fs'), vm = require('vm');
const express = require('express'), multer = require('multer'), request = require('supertest');
const source = fs.readFileSync(require.resolve('../routes/whatsappRoutes'), 'utf8');
const start = source.indexOf('const privateAttachmentUpload =');
const end = source.indexOf('router.post("/send-media",', start);
let ready = true, webCalls = 0, cloudCalls = 0, unknown = false;
const bytes = Buffer.from('private file contents');
const router = express.Router();
vm.runInNewContext(source.slice(start, end), {
  router, multer, Buffer,
  messageSendLimiter: (req, res, next) => next(),
  s: () => ({ ready, sendMediaMessage: async (chat, uri, type, caption, name) => {
    webCalls++; assert(uri.endsWith(bytes.toString('base64'))); assert.equal(name, 'private.pdf');
    return { id: 'web-file-id' };
  } }),
  mgr: { defaultKey: 42 }, recordCloudSend: async () => {},
  require: (name) => name.endsWith('waBotGate') ? { pauseBot: async () => {} }
    : name.endsWith('waInteractive') ? { deliveryMessageId: (result) => result.messages?.[0]?.id }
    : { cloudClientForUser: async () => ({ isConfigured: () => true,
      uploadMedia: async (file, mime, name) => { assert.deepEqual(file, bytes); assert.equal(mime, 'application/pdf'); return { id: 'media-id' }; },
      sendMedia: async () => { cloudCalls++; if (unknown) throw Object.assign(new Error('No receipt'), { deliveryUnknown: true }); return { messages: [{ id: 'wamid.file' }] }; }
    }) }
});
const app = express();
app.use((req, res, next) => { req.user = { id: 42 }; next(); }, router);
const send = () => request(app).post('/send-media-upload').field('chatId', '919123456789@c.us').attach('file', bytes, { filename: 'private.pdf', contentType: 'application/pdf' });
(async () => {
  let result = await send(); assert.equal(result.status, 200); assert.equal(result.body.id, 'web-file-id');
  ready = false; result = await send(); assert.equal(result.status, 200); assert.equal(result.body.id, 'wamid.file');
  unknown = true; result = await send(); assert.equal(result.status, 504); assert.equal(result.body.deliveryUnknown, true);
  assert.equal(webCalls, 1); assert.equal(cloudCalls, 2);
  assert(source.slice(start, end).includes('multer.memoryStorage()'));
  console.log('PASS: private Web/Cloud attachment uploads use memory and report uncertain delivery honestly');
})().catch((err) => { console.error(err); process.exitCode = 1; });
