"use strict";
const assert = require("assert/strict"), fs = require("fs"), path = require("path"), vm = require("vm");
const source = fs.readFileSync(path.resolve(__dirname, '../services/whatsappService.js'), 'utf8');
function method(start, end) { return source.slice(source.indexOf(`  async ${start}(`), source.indexOf(`  async ${end}(`, source.indexOf(`  async ${start}(`))); }
async function main() {
  let fetches = 0;
  const db = { promise: () => ({ query: async () => [[]] }) };
  const methods = method('getMessages', 'sendSeen') + method('getMediaForMessage', 'sendMediaMessage') + method('syncWhatsAppChatsAndMessages', 'getAccountDetails');
  const TestService = vm.runInNewContext(`(class { ${methods} })`, {
    require: (name) => name === '../config/database' ? db : name === './waChatPrivacy' ? { serverChatStorageEnabled: () => false } : name === './waMediaMetadata' ? require('../services/waMediaMetadata') : { mediaDir: path.resolve(__dirname, '../uploads/wa-media'), cloudMediaDir: path.resolve(__dirname, '../uploads/wa-media/cloud') },
    path, fs, Buffer, Date, console, process, Map, formatChatJid: (id) => id, describeLastMessage: (msg) => msg.body, mimeToExtension: () => 'jpg', WhatsAppService: { ackToStatus: () => 'sent' },
  });
  const service = new TestService();
  Object.assign(service, { key: 'operator', ready: true, messagesCache: {}, messagesFetchCache: {}, emitWaEvent: () => {}, enqueue: async (operation) => operation(), withTimeout: async (promise) => promise,
    client: { getChatById: async () => ({ fetchMessages: async () => { fetches++; await new Promise((resolve) => setTimeout(resolve, 10)); return [{ id: { id: 'message', _serialized: 'false_chat_message' }, body: 'Live WhatsApp history', timestamp: 123, fromMe: false }]; } }), getMessageById: async () => ({ hasMedia: true, downloadMedia: async () => ({ data: 'aW1hZ2U=', filename: 'received.jpg', mimetype: 'image/jpeg' }) }) },
  });
  const [first, second] = await Promise.all([service.getMessages('chat', true), service.getMessages('chat', true)]);
  assert.equal(fetches, 1, 'Parallel refreshes share one WhatsApp history fetch');
  assert.equal(first[0].body, 'Live WhatsApp history');
  assert.equal(second[0].serializedId, 'false_chat_message');
  const media = await service.getMediaForMessage('chat', 'message', 'false_chat_message');
  assert.equal(media.data, 'aW1hZ2U=');
  assert.equal(media.mimetype, 'image/jpeg');
  assert.equal(media.url, undefined, 'Received media is returned to the browser without a server cache file URL');
  service.syncWhatsAppContacts = async () => ({ success: true, count: 80 });
  service.getChats = async () => Array.from({ length: 65 }, (_, id) => ({ id: `chat-${id}`, hasMessages: true }));
  let refreshed = 0;
  service.getMessages = async () => { refreshed++; return [{ id: 'one' }]; };
  const synced = await service.syncWhatsAppChatsAndMessages();
  assert.equal(refreshed, 65, 'Sync visits all session chats, beyond the old 30-chat limit');
  assert.equal(synced.completedChats, 65);
  assert.equal(synced.status, 'completed');
  console.log('PASS: coalesced live history, browser-only attachment data, complete session chat sync and progress');
}
main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
