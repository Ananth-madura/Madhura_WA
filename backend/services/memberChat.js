"use strict";

/**
 * Assigned-chat access for organization members.
 *
 * The Live Chats page (`/whatsapp`) is backed by the WhatsApp session engine,
 * which is account-wide. Members must get the same page without inheriting the
 * account-wide view, so this module is the single place that answers:
 *
 *   • which chats does this member own, and
 *   • may this member act on this chat id?
 *
 * A chat belongs to a member when either assignment path says so:
 *
 *   • `conversations.owner_user_id` — the shared inbox routing assignment, or
 *   • `wa_contacts.assigned_agent_id` — the direct chat assignment an
 *     administrator makes on the Live Chats board.
 *
 * Everything here is tenant-scoped: a phone number that exists in two
 * organizations resolves to the caller's organization only.
 */

const db = require("../config/database");
const { serverChatStorageEnabled } = require("./waChatPrivacy");

const ADMIN_ROLES = new Set(["organization_owner", "organization_admin"]);
const CHAT_BLOCKED_LEVEL = "campaign_only";
const READ_ONLY_LEVEL = "read_only";

/** Membership is authoritative, exactly like `sharedWorkspaceGuard`. */
function isWorkspaceAdmin(req) {
  return (
    ADMIN_ROLES.has(req.userRole) ||
    req.user?.role === "platform_admin"
  );
}

/**
 * The member's chat capability for this request:
 *   "full" → read and reply, "read" → read only, null → no inbox access.
 */
function chatLevel(req) {
  if (isWorkspaceAdmin(req)) return "full";
  const level = req.waAccessLevel || "full";
  if (level === CHAT_BLOCKED_LEVEL) return null;
  return level === READ_ONLY_LEVEL ? "read" : "full";
}

function digits(value) {
  return String(value || "").replace(/\D/g, "");
}

/** WhatsApp phone identity: the trailing 10 digits identify the chat. */
function phoneKey(value) {
  const all = digits(value);
  return all.length >= 10 ? all.slice(-10) : all;
}

/** Matches the id shape the Live Chats board already sends to the engine. */
function jidFor(phone) {
  const all = digits(phone);
  const full = all.length > 10 ? all : all ? `91${all}` : "";
  return full ? `${full}@c.us` : "";
}

function formatPhone(phone) {
  const all = digits(phone);
  if (all.length === 12 && all.startsWith("91")) {
    return `+91 ${all.slice(2, 7)} ${all.slice(7)}`;
  }
  if (all.length === 10) return `+91 ${all.slice(0, 5)} ${all.slice(5)}`;
  return all ? `+${all}` : "";
}

/** The chat id carried by the route, body or query, whichever comes first. */
function chatTarget(req) {
  const params = req.params || {};
  const body = req.body || {};
  const query = req.query || {};
  const value =
    params.chatId || params.phone ||
    body.chatId || body.to || body.phone ||
    query.chatId || query.phone || null;
  const key = phoneKey(value);
  return key.length >= 7 ? key : null;
}

async function query(sql, params = []) {
  const [rows] = await db.promise().query(sql, params);
  return rows;
}

/**
 * Resolve the member's assignment for a phone key within their organization.
 * Returns `null` when the phone is not theirs — the caller must treat that as
 * "not found", never as "unassigned, allow".
 */
async function findAssignedChat(req, chatId) {
  const key = phoneKey(chatId);
  if (key.length < 7) return null;

  const [conversation] = await query(
    `SELECT c.id AS conversation_id, c.status, c.sender_id, c.branch_id,
            c.owner_user_id, ct.id AS contact_id, ct.phone, ct.name,
            ct.profile_pic_url, ct.avatar_url, ct.unread_count
       FROM conversations c
       JOIN wa_contacts ct ON ct.id = c.contact_id AND ct.tenant_id = c.tenant_id
      WHERE c.tenant_id = ? AND c.owner_user_id = ? AND ct.phone LIKE ?
      ORDER BY c.id DESC LIMIT 1`,
    [req.tenantId, req.user.id, `%${key}`]
  );
  if (conversation) {
    return {
      source: "conversation",
      conversationId: conversation.conversation_id,
      contactId: conversation.contact_id,
      phone: digits(conversation.phone),
      name: conversation.name || "",
      profilePicUrl: conversation.profile_pic_url || conversation.avatar_url || null,
      unreadCount: Number(conversation.unread_count) || 0,
      status: conversation.status || "open",
      senderId: conversation.sender_id || null,
      branchId: conversation.branch_id || null,
    };
  }

  const [contact] = await query(
    `SELECT id AS contact_id, phone, name, profile_pic_url, avatar_url, unread_count
       FROM wa_contacts
      WHERE tenant_id = ? AND assigned_agent_id = ? AND phone LIKE ?
        AND COALESCE(is_blocked, 0) = 0
      LIMIT 1`,
    [req.tenantId, req.user.id, `%${key}`]
  );
  if (!contact) return null;

  return {
    source: "contact",
    conversationId: null,
    contactId: contact.contact_id,
    phone: digits(contact.phone),
    name: contact.name || "",
    profilePicUrl: contact.profile_pic_url || contact.avatar_url || null,
    unreadCount: Number(contact.unread_count) || 0,
    status: "open",
    senderId: null,
    branchId: null,
  };
}

function notAssignedError() {
  return Object.assign(
    new Error("This conversation is not assigned to you."),
    { status: 404, code: "CHAT_NOT_ASSIGNED" }
  );
}

async function assertChat(req, chatId) {
  const access = await findAssignedChat(req, chatId);
  if (!access) throw notAssignedError();
  return access;
}

/**
 * The WhatsApp session that carries this organization's conversation.
 *
 * Members have no session of their own: the number that talks to the customer
 * is the business number an administrator linked. The log row for the chat
 * records which session that was, so resolve it from the chat itself and fall
 * back to the organization's most recent session.
 */
async function sessionKeyForPhone(req, phone) {
  const key = phoneKey(phone);
  if (key.length < 7) return null;
  const rows = await query(
    `SELECT session_key FROM wa_message_logs
      WHERE phone LIKE ? AND session_key IS NOT NULL AND session_key <> ''
        AND tenant_id = ?
      ORDER BY id DESC LIMIT 1`,
    [`%${key}`, req.tenantId]
  );
  return rows[0]?.session_key ? String(rows[0].session_key) : null;
}

async function orgSessionKey(req) {
  const rows = await query(
    `SELECT session_key FROM wa_message_logs
      WHERE session_key IS NOT NULL AND session_key <> '' AND tenant_id = ?
      ORDER BY id DESC LIMIT 1`,
    [req.tenantId]
  );
  return rows[0]?.session_key ? String(rows[0].session_key) : null;
}

function lastMessageFrom(contact, log) {
  if (log) {
    return {
      body: log.message_text || "",
      timestamp: Math.floor(new Date(log.created_at).getTime() / 1000) || 0,
      fromMe: log.direction === "outbound",
      type: log.message_type || null,
      hasMedia: ["media", "image", "video", "audio", "ptt", "document", "sticker"].includes(log.message_type),
      status: log.direction === "outbound" ? log.status || "sent" : null,
    };
  }
  if (contact.last_message_at) {
    return {
      body: contact.last_message_text || "",
      timestamp: Math.floor(new Date(contact.last_message_at).getTime() / 1000) || 0,
      fromMe: false,
      type: null,
      hasMedia: false,
      status: null,
    };
  }
  return null;
}

/**
 * The member's chat list: only conversations they own, enriched with whatever
 * the live business session has cached (name, unread badge, newest preview).
 * Nothing here triggers a WhatsApp Web fetch — the assigned rows come from the
 * database, so the list is fast and works while the browser session is down.
 */
async function listChats(req, liveChats = []) {
  const [conversations, contacts] = await Promise.all([
    query(
      `SELECT c.id AS conversation_id, c.status, ct.id AS contact_id, ct.phone, ct.name,
              ct.profile_pic_url, ct.avatar_url, ct.unread_count, ct.last_message_text,
              ct.last_message_at
         FROM conversations c
         JOIN wa_contacts ct ON ct.id = c.contact_id AND ct.tenant_id = c.tenant_id
        WHERE c.tenant_id = ? AND c.owner_user_id = ?
        ORDER BY ct.last_message_at DESC, c.id DESC
        LIMIT 100`,
      [req.tenantId, req.user.id]
    ),
    query(
      `SELECT id AS contact_id, phone, name, profile_pic_url, avatar_url, unread_count,
              last_message_text, last_message_at
         FROM wa_contacts
        WHERE tenant_id = ? AND assigned_agent_id = ? AND COALESCE(is_blocked, 0) = 0
        ORDER BY last_message_at DESC
        LIMIT 100`,
      [req.tenantId, req.user.id]
    ),
  ]);

  // One row per phone: a contact can be both conversation-owned and directly
  // assigned, and the conversation row carries the source of truth for status.
  const byPhone = new Map();
  for (const row of contacts) {
    const key = phoneKey(row.phone);
    if (key) byPhone.set(key, { ...row, conversation_id: null, status: "open" });
  }
  for (const row of conversations) {
    const key = phoneKey(row.phone);
    if (key) byPhone.set(key, row);
  }
  if (!byPhone.size) return [];

  const keys = Array.from(byPhone.keys());
  const [logs] = await Promise.all([
    query(
      `SELECT phone, direction, message_text, message_type, status, created_at
         FROM wa_message_logs
        WHERE (${keys.map(() => "phone LIKE ?").join(" OR ")})
          AND tenant_id = ?
        ORDER BY id DESC
        LIMIT ?`,
      [...keys.map(key => `%${key}`), req.tenantId, Math.min(2000, keys.length * 20)]
    ),
  ]);

  const latestLog = new Map();
  for (const log of logs) {
    const key = phoneKey(log.phone);
    if (key && !latestLog.has(key)) latestLog.set(key, log);
  }

  const liveByPhone = new Map();
  for (const chat of liveChats || []) {
    const key = phoneKey(chat.phoneNumber || chat.id);
    if (key) liveByPhone.set(key, chat);
  }

  const chats = [];
  for (const [key, row] of byPhone) {
    const live = liveByPhone.get(key) || null;
    const lastMessage = live?.lastMessage || lastMessageFrom(row, latestLog.get(key));
    const timestamp = Math.max(
      Number(row.last_message_at ? Math.floor(new Date(row.last_message_at).getTime() / 1000) : 0) || 0,
      Number(lastMessage?.timestamp) || 0,
      Number(live?.timestamp) || 0
    );
    const phone = digits(row.phone) || key;
    const savedName = String(row.name || "").trim();
    const liveName = String(live?.name || "").trim();
    const name =
      savedName && !savedName.startsWith("+") && !savedName.startsWith("WhatsApp Contact")
        ? savedName
        : liveName || savedName || formatPhone(phone) || "WhatsApp Contact";

    chats.push({
      id: jidFor(phone),
      phoneNumber: phone,
      formattedPhone: formatPhone(phone),
      name,
      unreadCount: Number(live?.unreadCount ?? row.unread_count) || 0,
      timestamp,
      isPinned: Boolean(live?.isPinned),
      isGroup: false,
      isMuted: Boolean(live?.isMuted),
      profilePicUrl: row.profile_pic_url || row.avatar_url || live?.profilePicUrl || null,
      lastMessage,
      hasMessages: Boolean(lastMessage),
      conversationId: row.conversation_id || null,
      status: row.status || "open",
      memberScoped: true,
    });
  }

  chats.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  return chats;
}

/**
 * Database history for a member when no business session can be resolved.
 * Mirrors the engine's row mapping so the chat thread renders identically.
 */
async function messages(req, chatId, conversationId = null, limit = 10) {
  const numericLimit = limit === "all" || !limit ? 250 : Math.max(1, parseInt(limit, 10) || 10);
  const key = phoneKey(chatId);
  if (key.length < 7) return [];

  const content = serverChatStorageEnabled()
    ? "message_text AS body, media_url, media_filename, interactive_payload, metadata"
    : "NULL AS body, NULL AS media_url, NULL AS media_filename, NULL AS interactive_payload, NULL AS metadata";

  const scope = conversationId ? "AND (conversation_id = ? OR conversation_id IS NULL)" : "";
  const params = [
    `%${key}`, `%${key}`,
    req.tenantId,
    ...(conversationId ? [conversationId] : []),
    numericLimit,
  ];

  const rows = await query(
    `SELECT id, phone, direction, message_type, created_at, wa_message_id, status,
            media_mime_type, media_id, ${content}
       FROM wa_message_logs
      WHERE (phone LIKE ? OR phone LIKE ?)
        AND tenant_id = ?
        ${scope}
      ORDER BY created_at DESC
      LIMIT ?`,
    params
  );

  return rows.map(row => {
    const isFile =
      ["media", "image", "video", "audio", "ptt", "document", "sticker"].includes(row.message_type) ||
      Boolean(row.media_url);
    let interactive = null;
    try {
      interactive = typeof row.interactive_payload === "string"
        ? JSON.parse(row.interactive_payload)
        : row.interactive_payload || null;
    } catch (_) {
      interactive = null;
    }
    let metadata = {};
    try {
      metadata = typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata || {};
    } catch (_) {
      metadata = {};
    }
    return {
      id: row.wa_message_id || `db_${row.id}`,
      serializedId: metadata.serializedId || null,
      from: row.direction === "inbound" ? row.phone : "me",
      body:
        row.body ||
        (row.message_type === "media"
          ? "📎 Attachment"
          : row.message_type === "location"
          ? "📍 Location"
          : ""),
      timestamp: Math.floor(new Date(row.created_at).getTime() / 1000),
      isMe: row.direction === "outbound",
      hasMedia: Boolean(isFile),
      type: row.message_type || (isFile ? "document" : "text"),
      filename: row.media_filename || "",
      mediaUrl: row.media_url || null,
      mimetype: row.media_mime_type || null,
      interactive,
      cloudMediaId: row.media_id || null,
      status: row.direction === "outbound" ? row.status || "sent" : null,
    };
  });
}

module.exports = {
  isWorkspaceAdmin,
  chatLevel,
  chatTarget,
  phoneKey,
  jidFor,
  formatPhone,
  findAssignedChat,
  assertChat,
  listChats,
  messages,
  sessionKeyForPhone,
  orgSessionKey,
  notAssignedError,
};
