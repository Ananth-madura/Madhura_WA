/**
 * Enterprise IndexedDB Client Storage for Internal Team Messaging.
 *
 * Implements:
 *   • Scoped Databases: Scoped strictly per `tenantId:userId` so one employee or
 *     organization can never access another employee's locally cached conversations.
 *   • Indexed Stores:
 *       - `messages`: Keyed by composite key or clientId/id. Indexed by channelId and createdAt.
 *       - `channels`: Cached channel list with unread counts and last message previews.
 *       - `drafts`: Unsent message drafts per channel (prevents losing draft when switching chats).
 *       - `outbox`: Offline queue of pending messages and operations for idempotent sync.
 *       - `pins`: Cached pinned message metadata.
 *   • Survival past 7-day Server Retention: Locally opened messages survive server-side
 *     expiration and are tagged with `deviceOnly: true`.
 *   • Safe Fallback: Degrades gracefully if IndexedDB is blocked in private mode.
 */

const DB_VERSION = 3;
const encryptionKeys = new WeakMap();
let draftClock = Date.now();
function storageNotice() {
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") window.dispatchEvent(new CustomEvent("team_chat_storage_error"));
}

function retainOnDevice(message, context) {
  try {
    const policy = JSON.parse(localStorage.getItem(`team_chat_policy_${context.tenantId}_${context.userId}`) || "{}");
    const days = Number(policy.localCacheDays) || 0;
    return !days || message.pending || message.failed || timeOf(message) >= Date.now() - days * 86400000;
  } catch (_) { return true; }
}

async function encryptionKey(db) {
  if (!encryptionKeys.has(db)) encryptionKeys.set(db, (async () => {
    const generated = await window.crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    return new Promise((resolve, reject) => {
      const tx = db.transaction("keys", "readwrite");
      const store = tx.objectStore("keys");
      let key;
      const request = store.get("device");
      request.onsuccess = () => { key = request.result?.key || generated; if (!request.result) store.put({ id: "device", key }); };
      tx.oncomplete = () => resolve(key);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  })());
  return encryptionKeys.get(db);
}

async function encryptRecord(db, value) {
  const key = await encryptionKey(db);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const data = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(value)));
  const metadata = Object.fromEntries(["id", "clientId", "channelId", "createdAt", "storageKey", "stateVersion", "updatedAt"].filter((field) => value[field] !== undefined).map((field) => [field, value[field]]));
  return { ...metadata, encrypted: { iv, data } };
}

async function decryptRecord(db, value) {
  if (!value?.encrypted) return value;
  const key = await encryptionKey(db);
  const plain = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv: value.encrypted.iv }, key, value.encrypted.data);
  return JSON.parse(new TextDecoder().decode(plain));
}

export function getContext() {
  try {
    const userStr = localStorage.getItem("user");
    const user = userStr ? JSON.parse(userStr) : {};
    const tenantId = localStorage.getItem("active_tenant_id") || user.tenant_id || "0";
    const userId = user.id || "0";
    return { tenantId: String(tenantId), userId: String(userId) };
  } catch (_) {
    return { tenantId: "0", userId: "0" };
  }
}

function dbNameFor(tenantId, userId) {
  return `teamchat_db_${tenantId}_${userId}`;
}

let activeDbPromise = null;
let activeDbKey = null;

function openChatDB(tenantId, userId) {
  const key = `${tenantId}:${userId}`;
  if (activeDbPromise && activeDbKey === key) return activeDbPromise;

  activeDbKey = key;
  activeDbPromise = new Promise((resolve) => {
    if (typeof window === "undefined" || !window.indexedDB || !window.crypto?.subtle) {
      storageNotice();
      resolve(null);
      return;
    }

    try {
      const request = window.indexedDB.open(dbNameFor(tenantId, userId), DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains("keys")) db.createObjectStore("keys", { keyPath: "id" });
        if (!db.objectStoreNames.contains("sync")) db.createObjectStore("sync", { keyPath: "channelId" });
        if (!db.objectStoreNames.contains("messages")) {
          const msgStore = db.createObjectStore("messages", { keyPath: "storageKey" });
          msgStore.createIndex("by_channel", "channelId", { unique: false });
          msgStore.createIndex("by_time", "createdAt", { unique: false });
          msgStore.createIndex("by_channel_time", ["channelId", "createdAt"], { unique: false });
        }
        if (!db.objectStoreNames.contains("channels")) {
          db.createObjectStore("channels", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("drafts")) {
          db.createObjectStore("drafts", { keyPath: "channelId" });
        }
        if (!db.objectStoreNames.contains("outbox")) {
          db.createObjectStore("outbox", { keyPath: "clientId" });
        }
        if (!db.objectStoreNames.contains("pins")) {
          const pinStore = db.createObjectStore("pins", { keyPath: "storageKey" });
          pinStore.createIndex("by_channel", "channelId", { unique: false });
        }
      };

      request.onsuccess = (event) => { const db = event.target.result; db.onversionchange = () => db.close(); resolve(db); };
      request.onerror = () => { storageNotice(); resolve(null); };
      request.onblocked = () => { storageNotice(); resolve(null); };
    } catch (_) {
      resolve(null);
    }
  });

  return activeDbPromise;
}

// In-memory fallback if IndexedDB fails
const memStore = {
  messages: new Map(),
  channels: new Map(),
  drafts: new Map(),
  outbox: new Map(),
};

/* ── Message Operations ───────────────────────────────────────────────────── */

function messageStorageKey(channelId, message) {
  if (message.clientId) return `ch_${channelId}_u_${message.senderId || 0}_c_${message.clientId}`;
  return `ch_${channelId}_i_${message.id}`;
}

export async function readCachedMessages(channelId, context = getContext()) {
  const { tenantId, userId } = context;
  const db = await openChatDB(tenantId, userId);
  const cId = Number(channelId);

  if (!db) {
    const mem = memStore.messages.get(`${tenantId}:${userId}:${cId}`) || [];
    return mem;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction("messages", "readonly");
      const store = tx.objectStore("messages");
      const index = store.index("by_channel");
      const request = index.getAll(cId);

      request.onsuccess = async () => {
        try {
          const list = await Promise.all((request.result || []).map((entry) => decryptRecord(db, entry)));
          list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          resolve(mergeMessages(memStore.messages.get(`${tenantId}:${userId}:${cId}`) || [], list));
        } catch (_) { storageNotice(); resolve(memStore.messages.get(`${tenantId}:${userId}:${cId}`) || []); }
      };
      request.onerror = () => resolve([]);
    } catch (_) {
      resolve([]);
    }
  });
}

export async function writeCachedMessages(channelId, messages, context = getContext()) {
  messages = messages.filter((message) => message && retainOnDevice(message, context));
  const { tenantId, userId } = context;
  const db = await openChatDB(tenantId, userId);
  const cId = Number(channelId);
  const memoryKey = `${tenantId}:${userId}:${cId}`;
  memStore.messages.set(memoryKey, mergeMessages(memStore.messages.get(memoryKey) || [], messages));

  if (!db) {
    const key = `${tenantId}:${userId}:${cId}`;
    memStore.messages.set(key, mergeMessages(memStore.messages.get(key) || [], messages));
    return;
  }

  let entries;
  try { entries = await Promise.all(messages.filter(Boolean).map((message) => encryptRecord(db, { ...message, channelId: cId, storageKey: messageStorageKey(cId, message) }))); }
  catch (_) { storageNotice(); return false; }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction("messages", "readwrite");
      const store = tx.objectStore("messages");

      for (const entry of entries) {
        const request = store.get(entry.storageKey);
        request.onsuccess = () => { if (Number(request.result?.stateVersion || 0) <= Number(entry.stateVersion || 0)) store.put(entry); };
      }

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => { storageNotice(); resolve(false); };
    } catch (_) {
      resolve(false);
    }
  });
}

export async function updateCachedMessage(channelId, messageId, updates, context = getContext()) {
  const cId = Number(channelId);

  const existing = await readCachedMessages(cId, context);
  const updated = existing.map((m) =>
    (Number(m.id) === Number(messageId) || m.clientId === messageId) && Number(m.stateVersion || 0) <= Number(updates.stateVersion ?? m.stateVersion ?? 0) ? { ...m, ...updates } : m
  );
  await writeCachedMessages(cId, updated, context);
}

/* ── Draft Operations ─────────────────────────────────────────────────────── */

export async function getCachedDraft(channelId, context = getContext()) {
  const { tenantId, userId } = context;
  const db = await openChatDB(tenantId, userId);
  const cId = Number(channelId);

  if (!db) return memStore.drafts.get(`${tenantId}:${userId}:${cId}`) || "";

  return new Promise((resolve) => {
    try {
      const tx = db.transaction("drafts", "readonly");
      const store = tx.objectStore("drafts");
      const req = store.get(cId);
      req.onsuccess = async () => { try { resolve((await decryptRecord(db, req.result))?.text ?? memStore.drafts.get(`${tenantId}:${userId}:${cId}`) ?? ""); } catch (_) { storageNotice(); resolve(memStore.drafts.get(`${tenantId}:${userId}:${cId}`) || ""); } };
      req.onerror = () => resolve("");
    } catch (_) {
      resolve("");
    }
  });
}

export async function saveCachedDraft(channelId, text, context = getContext()) {
  const updatedAt = draftClock = Math.max(draftClock + 1, Date.now());
  const { tenantId, userId } = context;
  const db = await openChatDB(tenantId, userId);
  const cId = Number(channelId);
  const memoryKey = `${tenantId}:${userId}:${cId}`;
  if (text) memStore.drafts.set(memoryKey, text); else memStore.drafts.delete(memoryKey);

  if (!db) {
    if (text) memStore.drafts.set(`${tenantId}:${userId}:${cId}`, text);
    else memStore.drafts.delete(`${tenantId}:${userId}:${cId}`);
    return;
  }
  let encryptedDraft;
  try { encryptedDraft = await encryptRecord(db, { channelId: cId, text: text || "", updatedAt }); }
  catch (_) { storageNotice(); return false; }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction("drafts", "readwrite");
      const store = tx.objectStore("drafts");
      const request = store.get(cId);
      request.onsuccess = () => { if (Number(request.result?.updatedAt || 0) <= updatedAt) store.put(encryptedDraft); };
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => { storageNotice(); resolve(false); };
    } catch (_) {
      resolve(false);
    }
  });
}

/* ── Outbox / Offline Queue ───────────────────────────────────────────────── */

export async function readOutbox(context = getContext()) {
  const { tenantId, userId } = context;
  const db = await openChatDB(tenantId, userId);

  if (!db) return [...memStore.outbox.values()].filter((entry) => entry.scope === `${tenantId}:${userId}`);

  return new Promise((resolve) => {
    try {
      const tx = db.transaction("outbox", "readonly");
      const store = tx.objectStore("outbox");
      const req = store.getAll();
      req.onsuccess = async () => { try {
        const persisted = await Promise.all((req.result || []).map((entry) => decryptRecord(db, entry)));
        const memory = [...memStore.outbox.values()].filter((entry) => entry.scope === `${tenantId}:${userId}`);
        resolve([...new Map([...persisted, ...memory].map((entry) => [entry.clientId, entry])).values()]);
      } catch (_) { storageNotice(); resolve([...memStore.outbox.values()].filter((entry) => entry.scope === `${tenantId}:${userId}`)); } };
      req.onerror = () => resolve([]);
    } catch (_) {
      resolve([]);
    }
  });
}

export async function queueOutbox(entry, context = getContext()) {
  const { tenantId, userId } = context;
  const db = await openChatDB(tenantId, userId);
  memStore.outbox.set(`${tenantId}:${userId}:${entry.clientId}`, { ...entry, scope: `${tenantId}:${userId}` });

  if (!db) {
    memStore.outbox.set(`${tenantId}:${userId}:${entry.clientId}`, { ...entry, scope: `${tenantId}:${userId}` });
    return;
  }
  let encryptedEntry;
  try { encryptedEntry = await encryptRecord(db, entry); }
  catch (_) { storageNotice(); return false; }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction("outbox", "readwrite");
      const store = tx.objectStore("outbox");
      store.put(encryptedEntry);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => { storageNotice(); resolve(false); };
    } catch (_) {
      resolve(false);
    }
  });
}

export async function removeOutbox(clientId, context = getContext()) {
  const { tenantId, userId } = context;
  const db = await openChatDB(tenantId, userId);
  memStore.outbox.delete(`${tenantId}:${userId}:${clientId}`);

  if (!db) {
    memStore.outbox.delete(`${tenantId}:${userId}:${clientId}`);
    return;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction("outbox", "readwrite");
      const store = tx.objectStore("outbox");
      store.delete(clientId);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch (_) {
      resolve(false);
    }
  });
}

/* ── Cached Channels ──────────────────────────────────────────────────────── */

export async function readCachedChannels(context = getContext()) {
  const { tenantId, userId } = context;
  const db = await openChatDB(tenantId, userId);

  if (!db) return [...memStore.channels.values()].filter((entry) => entry.scope === `${tenantId}:${userId}`);

  return new Promise((resolve) => {
    try {
      const tx = db.transaction("channels", "readonly");
      const store = tx.objectStore("channels");
      const req = store.getAll();
      req.onsuccess = async () => { try { resolve(await Promise.all((req.result || []).map((entry) => decryptRecord(db, entry)))); } catch (_) { resolve([]); } };
      req.onerror = () => resolve([]);
    } catch (_) {
      resolve([]);
    }
  });
}

export async function writeCachedChannels(channels, context = getContext()) {
  channels = channels.map((channel) => channel.lastMessage && !retainOnDevice(channel.lastMessage, context) ? { ...channel, lastMessage: null } : channel);
  const { tenantId, userId } = context;
  const db = await openChatDB(tenantId, userId);

  if (!db) {
    for (const [key, c] of memStore.channels) if (c.scope === `${tenantId}:${userId}`) memStore.channels.delete(key);
    for (const c of channels) memStore.channels.set(`${tenantId}:${userId}:${c.id}`, { ...c, scope: `${tenantId}:${userId}` });
    return;
  }
  const entries = await Promise.all(channels.map((channel) => encryptRecord(db, channel)));

  return new Promise((resolve) => {
    try {
      const tx = db.transaction("channels", "readwrite");
      const store = tx.objectStore("channels");
      store.clear();
      for (const entry of entries) store.put(entry);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch (_) {
      resolve(false);
    }
  });
}

/* ── Utilities: Merge & Retention Tagging ─────────────────────────────────── */

const timeOf = (m) => {
  const val = m?.createdAt || m?.created_at || m?.timestamp;
  if (!val) return 0;
  if (typeof val === "number") return val > 1e12 ? val : val * 1000;
  const d = new Date(String(val).includes("T") ? val : String(val).replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
};

export function mergeMessages(...lists) {
  const map = new Map();
  for (const list of lists) {
    for (const m of Array.isArray(list) ? list : []) {
      if (!m) continue;
      const key = m.clientId ? `c:${m.channelId || 0}:${m.senderId || 0}:${m.clientId}` : `i:${m.id}`;
      const prev = map.get(key);
      if (prev && Number(prev.stateVersion || 0) > Number(m.stateVersion || 0)) continue;
      if (!prev || (prev.pending && !m.pending)) {
        map.set(key, m);
      } else if (prev && !prev.pending && !m.pending) {
        // Merge enriched fields like reactions, pins, edit status
        map.set(key, { ...prev, ...m });
      }
    }
  }
  return [...map.values()].sort((a, b) => {
    const dt = timeOf(a) - timeOf(b);
    if (dt) return dt;
    return (Number(a.id) || 0) - (Number(b.id) || 0);
  });
}

export function isPastServerWindow(message, retentionDays = 7) {
  const ts = timeOf(message);
  if (!ts) return false;
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  return ts < cutoff;
}

export async function clearAllLocalDeviceData(context = getContext()) {
  const { tenantId, userId } = context;
  if (typeof window !== "undefined" && window.indexedDB) {
    try {
      const db = await openChatDB(tenantId, userId);
      db?.close();
      activeDbPromise = null;
      activeDbKey = null;
      await new Promise((resolve, reject) => {
        const request = window.indexedDB.deleteDatabase(dbNameFor(tenantId, userId));
        request.onsuccess = resolve;
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error("Close other Team Inbox tabs before clearing device history"));
      });
    } catch (error) { throw error; }
  }
  const prefix = `${tenantId}:${userId}:`;
  for (const map of [memStore.messages, memStore.channels, memStore.drafts, memStore.outbox]) {
    for (const key of map.keys()) if (String(key).startsWith(prefix)) map.delete(key);
  }
}

export async function reconcileAuthorizedChannels(channels, context = getContext()) {
  const { tenantId, userId } = context;
  const db = await openChatDB(tenantId, userId);
  const allowed = new Set(channels.map((channel) => Number(channel.id)));
  const prefix = `${tenantId}:${userId}:`;
  for (const [key] of memStore.messages) if (key.startsWith(prefix) && !allowed.has(Number(key.slice(prefix.length)))) memStore.messages.delete(key);
  for (const [key] of memStore.drafts) if (key.startsWith(prefix) && !allowed.has(Number(key.slice(prefix.length)))) memStore.drafts.delete(key);
  for (const [key, entry] of memStore.outbox) if (entry.scope === `${tenantId}:${userId}` && !allowed.has(Number(entry.channelId))) memStore.outbox.delete(key);
  if (db) await new Promise((resolve, reject) => {
    const tx = db.transaction(["messages", "drafts", "outbox", "pins", "sync"], "readwrite");
    for (const name of ["messages", "drafts", "outbox", "pins", "sync"]) {
      const request = tx.objectStore(name).openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        if (!allowed.has(Number(cursor.value.channelId))) cursor.delete();
        cursor.continue();
      };
    }
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  await writeCachedChannels(channels, context);
}

export async function getSyncState(channelId, context = getContext()) {
  const { tenantId, userId } = context;
  const db = await openChatDB(tenantId, userId);
  if (!db) return {};
  return new Promise((resolve) => {
    const request = db.transaction("sync", "readonly").objectStore("sync").get(Number(channelId));
    request.onsuccess = () => resolve(request.result || {});
    request.onerror = () => resolve({});
  });
}

export async function setSyncState(channelId, state, context = getContext()) {
  const { tenantId, userId } = context;
  const db = await openChatDB(tenantId, userId);
  if (!db) return;
  return new Promise((resolve, reject) => {
    const tx = db.transaction("sync", "readwrite");
    tx.objectStore("sync").put({ ...state, channelId: Number(channelId) });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

export function scopedChatStorage(tenantId, userId) {
  const context = { tenantId: String(tenantId), userId: String(userId) };
  return Object.fromEntries(Object.entries({ applyDevicePolicy, readCachedMessages, writeCachedMessages, updateCachedMessage, getCachedDraft, saveCachedDraft, readOutbox, queueOutbox, removeOutbox, readCachedChannels, writeCachedChannels, clearAllLocalDeviceData, reconcileAuthorizedChannels, getSyncState, setSyncState }).map(([name, operation]) => [name, (...args) => operation(...args, context)]));
}

export async function applyDevicePolicy(policy, context = getContext()) {
  const { tenantId, userId } = context;
  try { localStorage.setItem(`team_chat_policy_${tenantId}_${userId}`, JSON.stringify({ tenantId, userId, ...policy })); } catch (_) { storageNotice(); }
  const days = Number(policy.localCacheDays) || 0;
  if (!days) return;
  const cutoff = Date.now() - days * 86400000;
  const prefix = `${tenantId}:${userId}:`;
  for (const [key, messages] of memStore.messages) if (key.startsWith(prefix)) memStore.messages.set(key, messages.filter((message) => message.pending || message.failed || timeOf(message) >= cutoff));
  const db = await openChatDB(tenantId, userId);
  if (!db) return;
  await new Promise((resolve, reject) => {
    const tx = db.transaction("messages", "readwrite");
    const request = tx.objectStore("messages").openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      if (typeof cursor.value.id === "number" && timeOf(cursor.value) < cutoff) cursor.delete();
      cursor.continue();
    };
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearChatCachesOnLogout(userId) {
  const contexts = [];
  try {
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (!key?.startsWith("team_chat_policy_")) continue;
      const policy = JSON.parse(localStorage.getItem(key));
      if (String(policy.userId) === String(userId) && policy.clearCacheOnLogout) contexts.push(policy);
    }
  } catch (_) { storageNotice(); }
  await Promise.all(contexts.map((context) => clearAllLocalDeviceData(context)));
}
