/**
 * waInteractive.js
 *
 * Shared normalizers for WhatsApp interactive messages (reply buttons + list rows).
 *
 * Why this exists: five call sites (flow engine x3, menu handler, confirmation
 * service, billing service) each built their own button/row arrays AND their own
 * numbered-text fallback. The number-stripping regex only ever ran on the text
 * fallback, so a button authored as "1. Our Services" was sent to Meta verbatim
 * and rendered as a native button reading "1. Our Services" — which is exactly
 * what made real interactive messages look like the old type-a-number menu.
 *
 * Normalizing in one place means the native path and the text path can never
 * disagree again, and Meta's length caps are enforced once.
 */

const mdToWa = require("./mdToWa");

// Meta Cloud API caps (docs: interactive object reference)
const LIMITS = {
  buttonTitle: 20,
  buttonId: 256,
  rowTitle: 24,
  rowId: 200,
  rowDescription: 72,
  sectionTitle: 24,
  body: 1024,
  header: 60,
  footer: 60,
  listButton: 20,
  maxButtons: 3,
  maxRows: 10,
};

/**
 * Strip an authored ordinal prefix ("1. ", "2) ", "3 - ") off a title.
 * Native buttons are tapped, not numbered, so the ordinal is noise there; the
 * text fallback re-adds its own numbering.
 */
function normalizeTitle(raw, index = 0) {
  const text = String(raw == null ? "" : raw).trim();
  const stripped = text.replace(/^\d+\s*[.)\-:⃣️]*\s*/, "").trim();
  return stripped || text || `Option ${index + 1}`;
}

/** Pick whichever title-ish key a caller happened to use. */
function rawTitleOf(item, index) {
  return item?.title || item?.label || item?.text || item?.name || `Option ${index + 1}`;
}

/** Pick whichever id-ish key a caller happened to use. Never falls back to the title. */
function rawIdOf(item, index, prefix = "btn") {
  return item?.reply_id || item?.id || item?.action_id || `${prefix}_${index + 1}`;
}

/**
 * Normalize a mixed bag of caller shapes into Meta reply-button items.
 * Returns [{ id, title }] capped at 3 — ids stay stable, titles get cleaned.
 */
function normalizeButtons(items = []) {
  return (items || []).slice(0, LIMITS.maxButtons).map((b, i) => ({
    id: String(rawIdOf(b, i, "btn")).slice(0, LIMITS.buttonId),
    title: normalizeTitle(rawTitleOf(b, i), i).slice(0, LIMITS.buttonTitle),
  }));
}

/**
 * Normalize into Meta list sections. Accepts either a flat row array or an
 * array of { title, rows|buttons|options }. Enforces the global 10-row budget
 * across sections.
 */
function normalizeSections(rowsOrSections = [], defaultSectionTitle = "Options") {
  const input = rowsOrSections || [];
  const isSectioned = Array.isArray(input) && input.some((s) => Array.isArray(s?.rows || s?.buttons || s?.options));
  const raw = isSectioned ? input : [{ title: defaultSectionTitle, rows: input }];

  let budget = LIMITS.maxRows;
  const sections = [];
  let seq = 0;

  for (const sec of raw) {
    if (budget <= 0) break;
    const rows = (sec?.rows || sec?.buttons || sec?.options || []).slice(0, budget);
    if (!rows.length) continue;
    budget -= rows.length;
    sections.push({
      title: String(sec?.title || defaultSectionTitle).slice(0, LIMITS.sectionTitle),
      rows: rows.map((r) => {
        const i = seq++;
        const row = {
          id: String(rawIdOf(r, i, "row")).slice(0, LIMITS.rowId),
          title: normalizeTitle(rawTitleOf(r, i), i).slice(0, LIMITS.rowTitle),
        };
        if (r?.description) row.description = String(r.description).slice(0, LIMITS.rowDescription);
        return row;
      }),
    });
  }
  return sections;
}

/** Flatten sections back to a single ordered item list (for the text fallback). */
function flattenSections(sections = []) {
  const out = [];
  (sections || []).forEach((s) => (s.rows || []).forEach((r) => out.push({ ...r, sectionTitle: s.title })));
  return out;
}

/**
 * Build the plain-text equivalent of an interactive message, for providers that
 * cannot render native buttons (whatsapp-web.js) or when the Cloud API call fails.
 *
 * Takes ALREADY-NORMALIZED items so the numbering here and the button titles
 * Meta received are guaranteed to line up.
 */
function buildNumberedText({ body, header, footer, items = [], sectioned = false }) {
  let out = "";
  if (header) out += `*${header}*\n\n`;
  out += mdToWa.toWhatsApp(String(body || "")).trim();
  out += "\n\n";

  let lastSection = null;
  items.forEach((it, idx) => {
    if (sectioned && it.sectionTitle && it.sectionTitle !== lastSection) {
      out += `${lastSection ? "\n" : ""}*${it.sectionTitle}*\n`;
      lastSection = it.sectionTitle;
    }
    out += `*${idx + 1}.* ${it.title}`;
    if (it.description) out += ` - _${it.description}_`;
    out += "\n";
  });

  // The hint belongs to the text path only — this is the one place options are
  // numbered, so it must always be shown here even when a footer is also set.
  out += "\n_Reply with the option number (1, 2, 3...) or the option name._";
  if (footer && !/^tap an option or reply with number[.!]?$/i.test(footer.trim())) out += `\n_${footer}_`;
  return out.trim();
}

function deliveryMessageId(delivery) {
  const result = delivery?.result || delivery?.response || delivery;
  const id = result?.messages?.[0]?.id || result?.id || result?.result?.id;
  return typeof id === "string" ? id : id?.id || id?._serialized || null;
}

function validateMenuNodes(nodes) {
  if (!Array.isArray(nodes)) return "Flow nodes must be an array.";
  for (const node of nodes) {
    if (!["send_buttons", "send_list", "interactive_menu"].includes(node.node_type)) continue;
    let config;
    try { config = typeof node.config === "string" ? JSON.parse(node.config) : node.config || {}; }
    catch (_) { return `Menu ${node.node_key} has invalid configuration.`; }
    if (!config || typeof config !== "object" || (config.sections && !Array.isArray(config.sections))) return `Menu ${node.node_key} has invalid sections.`;
    const items = config.sections?.length
      ? config.sections.flatMap((section) => section.buttons || section.rows || section.options || [])
      : config.buttons || config.rows || config.options || [];
    if (!Array.isArray(items) || !items.length || items.length > LIMITS.maxRows) return `Menu ${node.node_key} needs between 1 and 10 options.`;
    if (items.some((item) => !item || typeof item !== "object")) return `Menu ${node.node_key} has an invalid option.`;
    const ids = items.map((item, index) => String(item.reply_id || item.id || `generated_${index + 1}`));
    if (new Set(ids).size !== ids.length) return `Menu ${node.node_key} has duplicate option IDs. Give each option its own ID.`;
  }
  return null;
}

module.exports = {
  validateMenuNodes,
  deliveryMessageId,
  LIMITS,
  normalizeTitle,
  normalizeButtons,
  normalizeSections,
  flattenSections,
  buildNumberedText,
};
