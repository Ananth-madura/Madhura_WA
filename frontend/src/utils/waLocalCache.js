const DB_NAME = "whatsapp-crm-device-cache";
const writeQueues = new Map();
const epochs = new Map();
function owner() {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    return `v2:${localStorage.getItem("active_tenant_id") || user?.tenant_id || "none"}:${user?.id || "anonymous"}`;
  } catch (_) { return "v2:none:anonymous"; }
}
export const localCacheOwner = owner;
function openCache() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) return reject(new Error("Browser storage is unavailable"));
    let blocked=false;
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      const db=request.result;
      const cache=db.objectStoreNames.contains("cache")?request.transaction.objectStore("cache"):db.createObjectStore("cache",{keyPath:"key"});
      const metadata=db.createObjectStore("metadata",{keyPath:"key"});
      const rows=cache.openCursor();
      rows.onsuccess=()=>{const cursor=rows.result;if(cursor){const row=cursor.value;metadata.put({key:row.key,updatedAt:row.updatedAt,bytes:new Blob([JSON.stringify(row.value)]).size});cursor.continue();}};
    };
    request.onblocked=()=>{blocked=true;reject(new Error("Close other CRM tabs to upgrade the device cache"));};
    request.onsuccess = () => {if(blocked)return request.result.close();request.result.onversionchange=()=>request.result.close();resolve(request.result);};
    request.onerror = () => reject(request.error);
  });
}
async function read(kind, id, ownerId = owner()) {
  const db = await openCache();
  try { return await new Promise((resolve, reject) => {
    const request = db.transaction("cache").objectStore("cache").get(`${ownerId}:${kind}:${id}`);
    request.onsuccess = () => resolve(request.result && Date.now() - request.result.updatedAt < 7 * 86400000 ? request.result.value : undefined); request.onerror = () => reject(request.error);
  }); } finally { db.close(); }
}
async function write(kind, id, value, ownerId = owner(), epoch = epochs.get(ownerId)||0) {
  const bytes=new Blob([JSON.stringify(value)]).size;
  if (bytes > 5 * 1024 * 1024) throw new Error("Local cache item exceeds 5 MB");
  const db = await openCache();
  if(epoch!==(epochs.get(ownerId)||0)){db.close();return;}
  try { await new Promise((resolve, reject) => {
    const transaction = db.transaction(["cache","metadata"], "readwrite");
    const cache = transaction.objectStore("cache");
    const metadata=transaction.objectStore("metadata");
    const key = `${ownerId}:${kind}:${id}`;
    cache.put({ key, value, updatedAt: Date.now() });
    metadata.put({key,bytes,updatedAt:Date.now()});
    const rows = metadata.getAll();
    rows.onsuccess = () => {
      let total = 0;
      for (const row of rows.result.sort((a, b) => b.updatedAt - a.updatedAt)) {
        if (Date.now() - row.updatedAt >= 7 * 86400000 || total + row.bytes > 25 * 1024 * 1024) {cache.delete(row.key);metadata.delete(row.key);}
        else total += row.bytes;
      }
    };
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
  const epoch=epochs.get(ownerId)||0;
  const key = `${ownerId}:${chatId}`;
  const pending = (writeQueues.get(key) || Promise.resolve()).catch(() => {}).then(async () => {
    if(epoch!==(epochs.get(ownerId)||0))return;
    const saved = await read("messages", chatId, ownerId).catch(() => []);
    const merged = mergeLocalMessages(saved, messages).filter(message => (message.timestamp || 0) * 1000 > Date.now() - 7 * 86400000).slice(0, 500).map((message) => ({ ...message, mediaUrl: message.mediaUrl?.startsWith("blob:") ? null : message.mediaUrl }));
    await write("messages", chatId, merged, ownerId,epoch);
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
  const ownerId = owner();
  epochs.set(ownerId,(epochs.get(ownerId)||0)+1);
  const db = await openCache();
  try { await new Promise((resolve, reject) => {
    const transaction = db.transaction(["cache","metadata"], "readwrite"), request = transaction.objectStore("metadata").openCursor();
    request.onsuccess = () => { const cursor = request.result; if (cursor) { if (cursor.key.startsWith(`${ownerId}:`)) {transaction.objectStore("cache").delete(cursor.key);cursor.delete();} cursor.continue(); } };
    transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error);
  }); } finally { db.close(); }
}
