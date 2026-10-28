/**
 * Device archive for internal team chat.
 *
 * Backed by IndexedDB via `teamChatIndexedDB.js`, ensuring enterprise-grade
 * persistence that does not bloat localStorage, while keeping an in-memory
 * immediate cache for synchronous UI reads.
 */

import {
  readCachedMessages,
  writeCachedMessages,
  readOutbox as idbReadOutbox,
  queueOutbox as idbQueueOutbox,
  removeOutbox as idbRemoveOutbox,
  getCachedDraft,
  saveCachedDraft,
  mergeMessages as idbMergeMessages,
  isPastServerWindow as idbIsPastServerWindow,
  getContext,
} from "./teamChatIndexedDB";

export const mergeMessages = idbMergeMessages;
export const isPastServerWindow = idbIsPastServerWindow;

function storage() {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch (_) {
    return null;
  }
}

function currentUser() {
  try {
    return JSON.parse(storage()?.getItem("user") || "{}") || {};
  } catch (_) {
    return {};
  }
}

export function currentUserId() {
  return Number(currentUser().id) || 0;
}

// In-memory sync mirror to keep synchronous rendering snappy
const memSync = new Map();
const outboxSync = new Map();
const scopeKey = () => { const { tenantId, userId } = getContext(); return `${tenantId}:${userId}:`; };

export function readArchive(channelId) {
  const cId = Number(channelId);
  return memSync.get(`${scopeKey()}${cId}`) || [];
}

export function writeArchive(channelId, messages) {
  const cId = Number(channelId);
  memSync.set(`${scopeKey()}${cId}`, messages);
  writeCachedMessages(cId, messages).catch(() => {});
}

export function appendArchive(channelId, incoming) {
  const cId = Number(channelId);
  const key = `${scopeKey()}${cId}`;
  const current = memSync.get(key) || [];
  const merged = mergeMessages(current, incoming);
  memSync.set(key, merged);
  writeCachedMessages(cId, merged).catch(() => {});
  return merged;
}

export async function hydrateFromIDB(channelId) {
  const cId = Number(channelId);
  const key = `${scopeKey()}${cId}`;
  const fromDb = await readCachedMessages(cId);
  if (fromDb && fromDb.length) {
    const current = memSync.get(key) || [];
    const merged = mergeMessages(current, fromDb);
    memSync.set(key, merged);
    return merged;
  }
  return memSync.get(key) || [];
}

export function readOutbox() {
  const prefix = scopeKey();
  return [...outboxSync.entries()].filter(([key]) => key.startsWith(prefix)).map(([, value]) => value);
}

export function queueOutbox(entry) {
  outboxSync.set(`${scopeKey()}${entry.clientId}`, entry);
  idbQueueOutbox(entry).catch(() => {});
}

export function removeOutbox(clientId) {
  outboxSync.delete(`${scopeKey()}${clientId}`);
  idbRemoveOutbox(clientId).catch(() => {});
}

export async function hydrateOutbox() {
  const prefix = scopeKey();
  const list = await idbReadOutbox();
  for (const item of list) outboxSync.set(`${prefix}${item.clientId}`, item);
  return list;
}

export { getCachedDraft, saveCachedDraft };
