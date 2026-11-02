/**
 * SociaWhatsAppLocal — Browser-Local IndexedDB Chat Storage Engine
 *
 * Implements a strict Local-First storage architecture for WhatsApp CRM:
 * - Actual message contents, bodies, captions, and media binaries are stored
 *   exclusively in browser IndexedDB.
 * - The CRM database stores only operational metadata, timestamps, delivery
 *   statuses, and customer/employee relationships.
 * - Each organization & user has isolated local cache namespaces.
 */

const DB_NAME = "SociaWhatsAppLocal";
const DB_VERSION = 1;

let dbInstance = null;
let dbInitPromise = null;

/**
 * Resolve current active user & organization namespace
 */
export function getActiveStorageNamespace() {
  try {
    const userStr = localStorage.getItem("user");
    const user = userStr ? JSON.parse(userStr) : null;
    const tenantId = localStorage.getItem("active_tenant_id") || user?.tenant_id || "default";
    const userId = user?.id || "anonymous";
    return { tenantId: String(tenantId), userId: String(userId), namespace: `${tenantId}:${userId}` };
  } catch (_) {
    return { tenantId: "default", userId: "anonymous", namespace: "default:anonymous" };
  }
}

/**
 * Initialize SociaWhatsAppLocal IndexedDB with 7 object stores
 */
export function initializeLocalChatStorage() {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (dbInitPromise) return dbInitPromise;

  dbInitPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB is not supported in this browser environment."));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // 1. conversations store
      if (!db.objectStoreNames.contains("conversations")) {
        const convStore = db.createObjectStore("conversations", { keyPath: "id" });
        convStore.createIndex("tenantId", "tenantId", { unique: false });
        convStore.createIndex("phone", "phone", { unique: false });
        convStore.createIndex("updatedAt", "updatedAt", { unique: false });
      }

      // 2. messages store
      if (!db.objectStoreNames.contains("messages")) {
        const msgStore = db.createObjectStore("messages", { keyPath: "id" });
        msgStore.createIndex("conversationId", "conversationId", { unique: false });
        msgStore.createIndex("tenantId", "tenantId", { unique: false });
        msgStore.createIndex("timestamp", "timestamp", { unique: false });
        msgStore.createIndex("phone", "phone", { unique: false });
        msgStore.createIndex("direction", "direction", { unique: false });
        msgStore.createIndex("type", "type", { unique: false });
        msgStore.createIndex("status", "status", { unique: false });
        msgStore.createIndex("conv_time", ["conversationId", "timestamp"], { unique: false });
      }

      // 3. media store (blobs & files)
      if (!db.objectStoreNames.contains("media")) {
        const mediaStore = db.createObjectStore("media", { keyPath: "mediaId" });
        mediaStore.createIndex("tenantId", "tenantId", { unique: false });
        mediaStore.createIndex("conversationId", "conversationId", { unique: false });
        mediaStore.createIndex("createdAt", "createdAt", { unique: false });
        mediaStore.createIndex("mimetype", "mimetype", { unique: false });
      }

      // 4. message_reactions store
      if (!db.objectStoreNames.contains("message_reactions")) {
        const rxnStore = db.createObjectStore("message_reactions", { keyPath: "id" });
        rxnStore.createIndex("messageId", "messageId", { unique: false });
        rxnStore.createIndex("tenantId", "tenantId", { unique: false });
      }

      // 5. local_search_index store
      if (!db.objectStoreNames.contains("local_search_index")) {
        const searchStore = db.createObjectStore("local_search_index", { keyPath: "id" });
        searchStore.createIndex("tenantId", "tenantId", { unique: false });
        searchStore.createIndex("conversationId", "conversationId", { unique: false });
        searchStore.createIndex("tokens", "tokens", { unique: false, multiEntry: true });
      }

      // 6. sync_checkpoints store
      if (!db.objectStoreNames.contains("sync_checkpoints")) {
        const syncStore = db.createObjectStore("sync_checkpoints", { keyPath: "id" });
        syncStore.createIndex("updatedAt", "updatedAt", { unique: false });
      }

      // 7. local_settings store
      if (!db.objectStoreNames.contains("local_settings")) {
        db.createObjectStore("local_settings", { keyPath: "key" });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      dbInstance.onversionchange = () => {
        dbInstance.close();
        dbInstance = null;
        dbInitPromise = null;
      };
      resolve(dbInstance);
    };

    request.onerror = () => {
      dbInitPromise = null;
      reject(request.error);
    };

    request.onblocked = () => {
      console.warn("[SociaWhatsAppLocal] Database upgrade blocked by another open tab.");
    };
  });

  return dbInitPromise;
}

/**
 * Tokenize string for local search indexing
 */
function tokenizeText(text) {
  if (!text || typeof text !== "string") return [];
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .split(/\s+/)
        .filter((t) => t.length >= 2)
    )
  );
}

/**
 * Save a single WhatsApp message locally in IndexedDB
 */
export async function saveLocalMessage(msg, explicitTenantId = null) {
  const { tenantId, userId } = getActiveStorageNamespace();
  const effectiveTenantId = explicitTenantId || tenantId;
  const db = await initializeLocalChatStorage();

  const id = String(msg.id || msg.wa_message_id || `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const conversationId = String(msg.conversationId || msg.conversation_id || msg.chatId || msg.phone || "unknown");
  const phone = msg.phone || msg.from || (msg.chatId ? msg.chatId.replace(/@.*$/, "") : "");
  const timestamp = Number(msg.timestamp) || Math.floor(Date.now() / 1000);

  const localRecord = {
    id,
    conversationId,
    tenantId: effectiveTenantId,
    storedByUserId: userId,
    phone,
    body: msg.body || msg.message_text || msg.text || "",
    caption: msg.caption || "",
    direction: msg.direction || (msg.isMe ? "outbound" : "inbound"),
    isMe: Boolean(msg.isMe || msg.direction === "outbound"),
    type: msg.type || msg.message_type || "text",
    status: msg.status || "sent",
    timestamp,
    createdAt: msg.createdAt || new Date(timestamp * 1000).toISOString(),
    cloudMediaId: msg.cloudMediaId || msg.media_id || null,
    filename: msg.filename || msg.media_filename || null,
    mimetype: msg.mimetype || msg.media_mime_type || null,
    hasMedia: Boolean(msg.hasMedia || msg.cloudMediaId || msg.media_id),
    interactive: msg.interactive || null,
    authorId: msg.authorId || msg.author_id || null,
    authorName: msg.authorName || msg.author_name || null,
    quotedMessage: msg.quotedMessage || null,
    localOnly: true
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(["messages", "local_search_index", "conversations"], "readwrite");
    const msgStore = tx.objectStore("messages");
    const searchStore = tx.objectStore("local_search_index");
    const convStore = tx.objectStore("conversations");

    msgStore.put(localRecord);

    // Update Search Index
    const searchTokens = tokenizeText(`${localRecord.body} ${localRecord.caption} ${localRecord.filename || ""}`);
    if (searchTokens.length > 0) {
      searchStore.put({
        id,
        tenantId: effectiveTenantId,
        conversationId,
        tokens: searchTokens,
        timestamp
      });
    }

    // Update conversation metadata record
    convStore.put({
      id: `${effectiveTenantId}:${conversationId}`,
      conversationId,
      tenantId: effectiveTenantId,
      phone,
      lastMessageId: id,
      lastMessageTimestamp: timestamp,
      updatedAt: Date.now()
    });

    tx.oncomplete = () => resolve(localRecord);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/**
 * Batch save local messages
 */
export async function saveBatchLocalMessages(messages, explicitTenantId = null) {
  if (!Array.isArray(messages) || messages.length === 0) return [];
  const { tenantId, userId } = getActiveStorageNamespace();
  const effectiveTenantId = explicitTenantId || tenantId;
  const db = await initializeLocalChatStorage();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(["messages", "local_search_index", "conversations"], "readwrite");
    const msgStore = tx.objectStore("messages");
    const searchStore = tx.objectStore("local_search_index");
    const convStore = tx.objectStore("conversations");

    const savedRecords = [];

    for (const msg of messages) {
      const id = String(msg.id || msg.wa_message_id || `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
      const conversationId = String(msg.conversationId || msg.conversation_id || msg.chatId || msg.phone || "unknown");
      const phone = msg.phone || msg.from || (msg.chatId ? msg.chatId.replace(/@.*$/, "") : "");
      const timestamp = Number(msg.timestamp) || Math.floor(Date.now() / 1000);

      const record = {
        id,
        conversationId,
        tenantId: effectiveTenantId,
        storedByUserId: userId,
        phone,
        body: msg.body || msg.message_text || msg.text || "",
        caption: msg.caption || "",
        direction: msg.direction || (msg.isMe ? "outbound" : "inbound"),
        isMe: Boolean(msg.isMe || msg.direction === "outbound"),
        type: msg.type || msg.message_type || "text",
        status: msg.status || "sent",
        timestamp,
        createdAt: msg.createdAt || new Date(timestamp * 1000).toISOString(),
        cloudMediaId: msg.cloudMediaId || msg.media_id || null,
        filename: msg.filename || msg.media_filename || null,
        mimetype: msg.mimetype || msg.media_mime_type || null,
        hasMedia: Boolean(msg.hasMedia || msg.cloudMediaId || msg.media_id),
        interactive: msg.interactive || null,
        authorId: msg.authorId || msg.author_id || null,
        authorName: msg.authorName || msg.author_name || null,
        quotedMessage: msg.quotedMessage || null,
        localOnly: true
      };

      msgStore.put(record);

      const searchTokens = tokenizeText(`${record.body} ${record.caption} ${record.filename || ""}`);
      if (searchTokens.length > 0) {
        searchStore.put({
          id,
          tenantId: effectiveTenantId,
          conversationId,
          tokens: searchTokens,
          timestamp
        });
      }

      convStore.put({
        id: `${effectiveTenantId}:${conversationId}`,
        conversationId,
        tenantId: effectiveTenantId,
        phone,
        lastMessageId: id,
        lastMessageTimestamp: timestamp,
        updatedAt: Date.now()
      });

      savedRecords.push(record);
    }

    tx.oncomplete = () => resolve(savedRecords);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/**
 * Retrieve messages for a conversation with pagination
 */
export async function getLocalMessages(conversationId, options = {}) {
  const { limit = 50, before = null, explicitTenantId = null } = options;
  const { tenantId } = getActiveStorageNamespace();
  const effectiveTenantId = explicitTenantId || tenantId;
  const targetConvId = String(conversationId);
  const db = await initializeLocalChatStorage();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("messages", "readonly");
    const store = tx.objectStore("messages");
    const index = store.index("conv_time");

    // Fetch messages for this conversation
    const range = IDBKeyRange.bound([targetConvId, 0], [targetConvId, before || Number.MAX_SAFE_INTEGER]);
    const request = index.openCursor(range, "prev"); // newest first

    const results = [];
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor && results.length < limit) {
        const record = cursor.value;
        if (record.tenantId === effectiveTenantId) {
          results.push(record);
        }
        cursor.continue();
      } else {
        // Return in chronological order (oldest to newest for chat rendering)
        resolve(results.reverse());
      }
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Get a single message by ID
 */
export async function getLocalMessageById(messageId) {
  if (!messageId) return null;
  const db = await initializeLocalChatStorage();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("messages", "readonly");
    const store = tx.objectStore("messages");
    const request = store.get(String(messageId));

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Update a local message record (e.g. delivery status, reactions, WAMID confirmation)
 */
export async function updateLocalMessage(messageId, updates = {}) {
  if (!messageId) return null;
  const db = await initializeLocalChatStorage();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("messages", "readwrite");
    const store = tx.objectStore("messages");
    const getReq = store.get(String(messageId));

    getReq.onsuccess = () => {
      const existing = getReq.result;
      if (!existing) return resolve(null);

      // Protect against out-of-order status regressions (e.g. delivered -> sent)
      const STATUS_WEIGHT = { pending: 0, sending: 1, sent: 2, delivered: 3, read: 4, failed: -1 };
      let newStatus = updates.status || existing.status;
      if (updates.status && existing.status) {
        const currentWeight = STATUS_WEIGHT[existing.status] || 0;
        const newWeight = STATUS_WEIGHT[updates.status] || 0;
        if (newWeight > 0 && currentWeight > newWeight) {
          newStatus = existing.status; // Prevent moving backward
        }
      }

      const updated = {
        ...existing,
        ...updates,
        status: newStatus,
        updatedAt: Date.now()
      };

      store.put(updated);
      tx.oncomplete = () => resolve(updated);
    };

    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Delete a local message
 */
export async function deleteLocalMessage(messageId) {
  if (!messageId) return false;
  const db = await initializeLocalChatStorage();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(["messages", "local_search_index"], "readwrite");
    tx.objectStore("messages").delete(String(messageId));
    tx.objectStore("local_search_index").delete(String(messageId));

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Save binary media (image, video, audio, document) locally in IndexedDB
 */
export async function saveLocalMedia(mediaId, blobOrData, meta = {}) {
  if (!mediaId || !blobOrData) return null;
  const { tenantId } = getActiveStorageNamespace();
  const db = await initializeLocalChatStorage();

  let blob = blobOrData;
  if (typeof blobOrData === "string" && blobOrData.startsWith("data:")) {
    const arr = blobOrData.split(",");
    const mime = arr[0].match(/:(.*?);/)?.[1] || "application/octet-stream";
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    blob = new Blob([u8arr], { type: mime });
  }

  const record = {
    mediaId: String(mediaId),
    tenantId,
    conversationId: String(meta.conversationId || ""),
    blob,
    size: blob.size || 0,
    mimetype: meta.mimetype || blob.type || "application/octet-stream",
    filename: meta.filename || `${mediaId}`,
    createdAt: Date.now()
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction("media", "readwrite");
    tx.objectStore("media").put(record);
    tx.oncomplete = () => resolve(record);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Retrieve local binary media and generate an ephemeral Object URL
 */
export async function getLocalMedia(mediaId) {
  if (!mediaId) return null;
  const db = await initializeLocalChatStorage();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("media", "readonly");
    const request = tx.objectStore("media").get(String(mediaId));

    request.onsuccess = () => {
      const record = request.result;
      if (!record || !record.blob) return resolve(null);
      const url = URL.createObjectURL(record.blob);
      resolve({
        mediaId: record.mediaId,
        url,
        mimetype: record.mimetype,
        filename: record.filename,
        size: record.size
      });
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Search local message contents using token index
 */
export async function searchLocalMessages(query, options = {}) {
  if (!query || typeof query !== "string") return [];
  const searchTokens = tokenizeText(query);
  if (searchTokens.length === 0) return [];

  const { tenantId } = getActiveStorageNamespace();
  const { conversationId = null, limit = 50 } = options;
  const db = await initializeLocalChatStorage();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(["local_search_index", "messages"], "readonly");
    const searchStore = tx.objectStore("local_search_index");
    const msgStore = tx.objectStore("messages");
    const tokenIndex = searchStore.index("tokens");

    // Match primary token
    const primaryToken = searchTokens[0];
    const request = tokenIndex.getAll(primaryToken);

    request.onsuccess = () => {
      const candidates = request.result || [];
      const matchingIds = [];

      for (const entry of candidates) {
        if (entry.tenantId !== tenantId) continue;
        if (conversationId && String(entry.conversationId) !== String(conversationId)) continue;

        // Check if all other search tokens match
        const tokenSet = new Set(entry.tokens);
        const allMatch = searchTokens.every((t) => tokenSet.has(t));
        if (allMatch) {
          matchingIds.push(entry.id);
          if (matchingIds.length >= limit) break;
        }
      }

      if (matchingIds.length === 0) return resolve([]);

      // Fetch actual message bodies
      const fullMessages = [];
      let pending = matchingIds.length;

      for (const id of matchingIds) {
        const msgReq = msgStore.get(id);
        msgReq.onsuccess = () => {
          if (msgReq.result) fullMessages.push(msgReq.result);
          pending--;
          if (pending === 0) {
            resolve(fullMessages.sort((a, b) => b.timestamp - a.timestamp));
          }
        };
        msgReq.onerror = () => {
          pending--;
          if (pending === 0) resolve(fullMessages);
        };
      }
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear all messages and media for a specific conversation
 */
export async function clearLocalConversation(conversationId, explicitTenantId = null) {
  const { tenantId } = getActiveStorageNamespace();
  const effectiveTenantId = explicitTenantId || tenantId;
  const targetConvId = String(conversationId);
  const db = await initializeLocalChatStorage();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(["messages", "local_search_index", "conversations"], "readwrite");
    const msgStore = tx.objectStore("messages");
    const searchStore = tx.objectStore("local_search_index");
    const convStore = tx.objectStore("conversations");

    const msgIndex = msgStore.index("conversationId");
    const req = msgIndex.openKeyCursor(IDBKeyRange.only(targetConvId));

    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        msgStore.delete(cursor.primaryKey);
        searchStore.delete(cursor.primaryKey);
        cursor.continue();
      } else {
        convStore.delete(`${effectiveTenantId}:${targetConvId}`);
      }
    };

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Clear entire local chat storage for this organization/user
 */
export async function clearLocalChatStorage(explicitTenantId = null) {
  const { tenantId } = getActiveStorageNamespace();
  const effectiveTenantId = explicitTenantId || tenantId;
  const db = await initializeLocalChatStorage();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(["messages", "media", "conversations", "local_search_index"], "readwrite");

    const deleteStoreByTenant = (storeName, tenantIndexName) => {
      const store = tx.objectStore(storeName);
      const index = store.index(tenantIndexName);
      const req = index.openKeyCursor(IDBKeyRange.only(effectiveTenantId));
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          store.delete(cursor.primaryKey);
          cursor.continue();
        }
      };
    };

    deleteStoreByTenant("messages", "tenantId");
    deleteStoreByTenant("media", "tenantId");
    deleteStoreByTenant("conversations", "tenantId");
    deleteStoreByTenant("local_search_index", "tenantId");

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get device storage usage statistics
 */
export async function getLocalStorageUsage() {
  const db = await initializeLocalChatStorage();
  const { tenantId } = getActiveStorageNamespace();

  const countStore = (storeName) =>
    new Promise((resolve) => {
      const tx = db.transaction(storeName, "readonly");
      const req = tx.objectStore(storeName).count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => resolve(0);
    });

  const [messageCount, mediaCount, convCount] = await Promise.all([
    countStore("messages"),
    countStore("media"),
    countStore("conversations")
  ]);

  let estimate = { quota: 0, usage: 0 };
  if (navigator.storage && navigator.storage.estimate) {
    try {
      estimate = await navigator.storage.estimate();
    } catch (_) {}
  }

  return {
    tenantId,
    messageCount,
    mediaCount,
    conversationCount: convCount,
    usageBytes: estimate.usage || 0,
    quotaBytes: estimate.quota || 0,
    usageMB: (estimate.usage ? estimate.usage / (1024 * 1024) : 0).toFixed(2),
    quotaMB: (estimate.quota ? estimate.quota / (1024 * 1024) : 0).toFixed(2),
    percentUsed: estimate.quota ? ((estimate.usage / estimate.quota) * 100).toFixed(1) : "0"
  };
}

/**
 * Export local chat data as a structured JSON archive
 */
export async function exportLocalChatData(explicitTenantId = null) {
  const { tenantId } = getActiveStorageNamespace();
  const effectiveTenantId = explicitTenantId || tenantId;
  const db = await initializeLocalChatStorage();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(["messages", "conversations"], "readonly");
    const msgStore = tx.objectStore("messages");
    const convStore = tx.objectStore("conversations");

    const messages = [];
    const conversations = [];

    msgStore.openCursor().onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        if (cursor.value.tenantId === effectiveTenantId) messages.push(cursor.value);
        cursor.continue();
      }
    };

    convStore.openCursor().onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        if (cursor.value.tenantId === effectiveTenantId) conversations.push(cursor.value);
        cursor.continue();
      }
    };

    tx.oncomplete = () => {
      const exportBlob = new Blob(
        [
          JSON.stringify(
            {
              exportedAt: new Date().toISOString(),
              tenantId: effectiveTenantId,
              messageCount: messages.length,
              conversationCount: conversations.length,
              conversations,
              messages
            },
            null,
            2
          )
        ],
        { type: "application/json" }
      );
      resolve(exportBlob);
    };

    tx.onerror = () => reject(tx.error);
  });
}

