const DB_NAME = "whatsapp-crm-device-cache";
const writeQueues = new Map();
function owner() {
  try { return String(JSON.parse(localStorage.getItem("user") || "null")?.id || "anonymous"); } catch (_) { return "anonymous"; }
}
export const localCacheOwner = owner;
function openCache() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) return reject(new Error("Browser storage is unavailable"));
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("cache", { keyPath: "key" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function read(kind, id, ownerId = owner()) {
  const db = await openCache();
  try { return await new Promise((resolve, reject) => {
    const request = db.transaction("cache").objectStore("cache").get(`${ownerId}:${kind}:${id}`);
    request.onsuccess = () => resolve(request.result?.value); request.onerror = () => reject(request.error);
  }); } finally { db.close(); }
}
async function write(kind, id, value, ownerId = owner()) {
  const db = await openCache();
  try { await new Promise((resolve, reject) => {
    const transaction = db.transaction("cache", "readwrite");
    transaction.objectStore("cache").put({ key: `${ownerId}:${kind}:${id}`, value, updatedAt: Date.now() });
    transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error);
  }); } finally { db.close(); }
}
export function mergeLocalMessages(local = [], incoming = []) {
  const messages = new Map(local.map((message) => [message.id, message]));
  for (const message of incoming) {
    const saved = messages.get(message.id) || local.find((item) => item.serializedId && item.serializedId === message.serializedId);
    if (saved && saved.id !== message.id) messages.delete(saved.id);
    messages.set(message.id, { ...saved, ...message, body: message.body || saved?.body || "", interactive: message.interactive || saved?.interactive, cloudMediaId: message.cloudMediaId || saved?.cloudMediaId });
  }
  return [...messages.values()].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}
export const readLocalMessages = (chatId, ownerId = owner()) => read("messages", chatId, ownerId).catch(() => []);
export const writeLocalMessages = (chatId, messages, ownerId = owner()) => {
  const key = `${ownerId}:${chatId}`;
  const pending = (writeQueues.get(key) || Promise.resolve()).catch(() => {}).then(async () => {
    const saved = await read("messages", chatId, ownerId).catch(() => []);
    const merged = mergeLocalMessages(saved, messages).map((message) => ({ ...message, mediaUrl: message.mediaUrl?.startsWith("blob:") ? null : message.mediaUrl }));
    await write("messages", chatId, merged, ownerId);
  });
  writeQueues.set(key, pending);
  pending.finally(() => { if (writeQueues.get(key) === pending) writeQueues.delete(key); }).catch(() => {});
  return pending;
};
export const readLocalMedia = (key, ownerId = owner()) => read("media", key, ownerId).catch(() => null);
export const writeLocalMedia = (key, media, ownerId = owner()) => write("media", key, media, ownerId);
export function localMediaUrl(media) {
  const binary = atob(media.data), bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return URL.createObjectURL(new Blob([bytes], { type: media.mimetype || "application/octet-stream" }));
}
export function mediaFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ data: String(reader.result).split(',')[1], filename: file.name, mimetype: file.type || "application/octet-stream" });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
export async function clearLocalCache() {
  const db = await openCache();
  try { await new Promise((resolve, reject) => {
    const transaction = db.transaction("cache", "readwrite"), request = transaction.objectStore("cache").openCursor();
    request.onsuccess = () => { const cursor = request.result; if (cursor) { if (cursor.key.startsWith(`${owner()}:`)) cursor.delete(); cursor.continue(); } };
    transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error);
  }); } finally { db.close(); }
}
