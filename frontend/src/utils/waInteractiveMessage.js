const parse = (value) => {
  if (!value) return null;
  if (typeof value === "object") return value;
  try { return JSON.parse(value); } catch (_) { return null; }
};
const array = (value) => Array.isArray(value) ? value : [];
const textOf = (value) => typeof value === "string" ? value : value?.text || "";

export function safeActionUrl(url, type = "url") {
  if (type === "call") {
    const number = String(url || "").replace(/[\s()-]/g, "");
    return /^\+?\d{7,15}$/.test(number) ? `tel:${number}` : null;
  }
  try { const parsed = new URL(url); return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : null; } catch (_) { return null; }
}

export function getInteractiveMessage(message = {}) {
  const payload = parse(message.interactive || message.interactive_payload) || message;
  const options = (values, section = "") => array(values).map((entry, index) => {
    const item = entry?.reply || entry?.button || entry;
    const title = String(typeof item === "string" ? item : item?.title || item?.label || item?.text || item?.displayText || item?.id || `Option ${index + 1}`);
    const type = item?.url ? "url" : item?.phone ? "call" : ["url", "call"].includes(item?.type) ? item.type : "reply";
    return { ...item, type, title, id: String(item?.reply_id ?? item?.id ?? index + 1), description: item?.description || "", section };
  });
  const groups = array(payload.sections || payload.action?.sections).map((section) => ({
    title: section.title || "",
    options: options(section.rows || section.buttons || section.options, section.title),
  })).filter((section) => section.options.length);
  let buttons = options(payload.buttons || payload.action?.buttons || payload.rows || message.buttons || message.rows);
  if (payload.type === "cta_url") {
    const parameters = payload.action?.parameters || payload;
    buttons = [{ type: "url", id: "cta", title: parameters.display_text || parameters.button_text || "Open link", url: parameters.url }];
  }
  const rawBody = message.body ?? message.text ?? message.message_text ?? "";
  let body = payload !== message ? textOf(payload.body) || payload.text : undefined;
  // Only upgrade legacy text when it explicitly invites a menu reply. Ordinary
  // numbered notes and invoices must remain plain text.
  const legacyMenu = /reply with (?:the |a )?(?:option|number)|choose an option|please choose|select an option/i.test(rawBody);
  if (!buttons.length && !groups.length && legacyMenu) {
    const lines = String(rawBody).split("\n");
    const choice = /^\s*\*?(\d+)[.)]\*?\s+(.+?)\s*$/;
    const optionLines = [];
    lines.forEach((line) => {
      const match = line.match(choice);
      if (match) { buttons.push({ id: match[1], title: match[2].replace(/\*/g, ""), type: "reply" }); optionLines.push(line); }
    });
    if (buttons.length) body = lines.filter((line) => !optionLines.includes(line) && !/reply with (?:the |a )?(?:option|number)/i.test(line)).join("\n").trim();
  }
  if (!buttons.length && !groups.length) return null;
  const kind = payload.type === "list" || payload.type === "interactive_menu" || groups.length || buttons.length > 3 ? "list" : "buttons";
  return {
    kind,
    body: body ?? rawBody,
    header: textOf(payload.header) || payload.title || "",
    footer: textOf(payload.footer),
    buttonText: payload.button_text || payload.action?.button || "View options",
    groups: groups.length ? groups : [{ title: "", options: buttons }],
    options: groups.length ? groups.flatMap((group) => group.options) : buttons,
    native: payload.native,
  };
}
