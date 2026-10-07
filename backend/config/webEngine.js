/**
 * webEngine.js — whether the WhatsApp Web (browser) engine may run.
 *
 * Deliberately dependency-free. It is required at server boot so /health can
 * report the state without pulling Puppeteer and whatsapp-web.js into memory
 * first — on a 512 MB instance, loading a browser stack just to answer a health
 * check is the problem this module exists to avoid.
 *
 * ── Why the flag exists ─────────────────────────────────────────────────────
 * The Web engine drives a real headless Chromium per paired number, roughly
 * 350-500 MB RSS each. That is fine on a VPS or a paid Render instance and does
 * not fit Render's free 512 MB tier, where Node itself takes a third of the
 * budget and the container gets OOM-killed during boot.
 *
 * With WA_ENABLE_WEB_ENGINE=0 the browser never launches and no profile is
 * written. Everything that does not need a browser still works: contacts,
 * groups, templates, campaigns, automations, flows, analytics, the admin UI, and
 * the Meta Cloud API engine.
 *
 * This is a testing and resource lever, NOT a way to run WhatsApp Web without a
 * browser. With it off you cannot pair a number over QR. Configure the Meta
 * Cloud API engine for real sending, or move to a paid plan.
 */

const DISABLED_VALUES = new Set(["0", "false", "no", "off"]);

function isWebEngineEnabled(env = process.env) {
  const raw = String(env.WA_ENABLE_WEB_ENGINE ?? "1").toLowerCase();
  return !DISABLED_VALUES.has(raw);
}

const WEB_ENGINE_DISABLED_REASON =
  "The WhatsApp Web engine is disabled (WA_ENABLE_WEB_ENGINE=0). It needs a " +
  "headless Chromium of roughly 350-500 MB, which does not fit a free 512 MB " +
  "instance. Configure the Meta Cloud API engine to send, or move to a paid plan.";

module.exports = { isWebEngineEnabled, WEB_ENGINE_DISABLED_REASON };
