"use strict";
const conversations = new Map();
function key(phone, session = "1") { return `${session}:${String(phone).replace(/\D/g, '').slice(-10)}`; }
function remember(phone, session, message) {
  if (!message?.body) return;
  const id = key(phone, session), now = Date.now();
  if (conversations.size >= 1000) for (const [entry, data] of conversations) if (now - data.at > 30 * 60 * 1000) conversations.delete(entry);
  if (!conversations.has(id) && conversations.size >= 1000) conversations.delete(conversations.keys().next().value);
  const previous = conversations.get(id);
  const items = previous && now - previous.at < 30 * 60 * 1000 ? previous.items : [];
  if (!items.some((item) => item.id === message.id)) items.push({ id: message.id, role: message.isMe ? 'assistant' : 'user', content: message.body });
  conversations.set(id, { at: now, items: items.slice(-10) });
}
function recent(phone, session, limit = 8) {
  const entry = conversations.get(key(phone, session));
  if (!entry || Date.now() - entry.at > 30 * 60 * 1000) return [];
  return entry.items.slice(-limit).map(({ role, content }) => ({ role, content }));
}
module.exports = { remember, recent };
