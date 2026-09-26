"use strict";
/**
 * waAiMenuState.js
 *
 * Ephemeral (in-memory) tracking of the choices the AI most recently offered
 * a phone number. Meta's Cloud API always echoes back the tapped button/list
 * option's real title on its own — this state is only needed so the
 * Web-session engine's numbered-text fallback (no native button support) can
 * resolve a plain "2" reply back to the option's actual label before it's
 * fed to the AI as the next message.
 *
 * ponytail: in-memory Map, not persisted — fine for a single-process CRM;
 * lost on restart just means the user has to pick again, no data loss.
 */
const TTL_MS = 10 * 60 * 1000;
const state = new Map();

function remember(phone, options) {
  state.set(phone, { options, expiresAt: Date.now() + TTL_MS });
}

// Resolves free text against the last offered options: by 1-based position,
// exact label match, or the reply containing the label.
function resolve(phone, text) {
  const entry = state.get(phone);
  if (!entry || Date.now() > entry.expiresAt) return null;

  const trimmed = (text || "").trim();
  const asNumber = parseInt(trimmed, 10);
  if (!isNaN(asNumber) && entry.options[asNumber - 1]) return entry.options[asNumber - 1];

  const lower = trimmed.toLowerCase();
  return entry.options.find((o) => o.title.toLowerCase() === lower || lower.includes(o.title.toLowerCase())) || null;
}

function clear(phone) {
  state.delete(phone);
}

module.exports = { remember, resolve, clear };
