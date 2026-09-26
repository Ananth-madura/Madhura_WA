const db = require("../config/database");

const MENU_EXPIRY_MS = 24 * 60 * 60 * 1000; // pending menus older than this are ignored

function queryAsync(sql, params) {
  return new Promise((resolve, reject) => {
    db.query(sql, params || [], (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

async function getOptions(automationId) {
  return queryAsync(
    "SELECT * FROM wa_automation_options WHERE automation_id = ? ORDER BY sort_order ASC, id ASC",
    [automationId]
  );
}

// Sends the clickable option list for an automation and remembers it so the
// customer's next message can be matched back to one of the options.
async function sendMenu(phone, automationId, sessionKey) {
  const options = await getOptions(automationId);
  if (!options.length) return;

  const waLoadBalancer = require("./waLoadBalancer");
  const waInteractive = require("./waInteractive");
  const cleanPhone = phone.replace(/\D/g, "");

  // Option row ids are the wa_automation_options primary keys — handleMenuReply
  // matches the tapped id straight back against this automation's own rows, so
  // an inbound id can never address anything the operator did not configure.
  const items = options.map((o) => ({ id: String(o.id), title: o.label }));
  const body = "Please choose an option:";

  // Native interactive caps at 3 buttons / 10 rows, but the text fallback has
  // no such limit — so build it from every option rather than the capped set.
  const fallbackText = waInteractive.buildNumberedText({
    body,
    items: items.map((it, i) => ({ ...it, title: waInteractive.normalizeTitle(it.title, i) })),
  });
  const opts = { phone: cleanPhone, body, fallbackText, sessionKey };

  try {
    if (items.length <= waInteractive.LIMITS.maxButtons) {
      await waLoadBalancer.sendInteractiveButtons({ ...opts, buttons: items });
    } else {
      await waLoadBalancer.sendInteractiveList({ ...opts, sections: items, buttonText: "View Options" });
    }
  } catch (e) {
    console.error(`[WA Menu] Failed to deliver menu for automation #${automationId} to +${cleanPhone}:`, e.message);
    return;
  }

  await queryAsync(
    `INSERT INTO wa_pending_menus (phone, automation_id) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE automation_id = VALUES(automation_id), created_at = NOW()`,
    [cleanPhone, automationId]
  );
}

// Checks whether an inbound message resolves a pending menu for this phone.
// `msg` is normalized: { text, buttonReplyId, listReplyId }.
// Returns true if it was handled (caller should skip further auto-reply logic).
async function handleMenuReply(phone, msg, sessionKey) {
  const cleanPhone = phone.replace(/\D/g, "");

  if (!(await require("./waBotGate").botMayReply(cleanPhone, "Menu auto-reply"))) {
    return true; // handled: stay quiet while an agent owns this conversation
  }

  const rows = await queryAsync("SELECT * FROM wa_pending_menus WHERE phone = ?", [cleanPhone]);
  const pending = rows[0];
  if (!pending) return false;

  if (Date.now() - new Date(pending.created_at).getTime() > MENU_EXPIRY_MS) {
    await queryAsync("DELETE FROM wa_pending_menus WHERE phone = ?", [cleanPhone]);
    return false;
  }

  const options = await getOptions(pending.automation_id);
  if (!options.length) {
    await queryAsync("DELETE FROM wa_pending_menus WHERE phone = ?", [cleanPhone]);
    return false;
  }

  let matched = null;
  const replyId = msg.buttonReplyId || msg.listReplyId;
  if (replyId) {
    matched = options.find((o) => String(o.id) === String(replyId));
  }
  if (!matched && msg.text) {
    const trimmed = msg.text.trim();
    const asNumber = parseInt(trimmed, 10);
    if (!isNaN(asNumber) && options[asNumber - 1]) {
      matched = options[asNumber - 1];
    } else {
      const lower = trimmed.toLowerCase();
      matched = options.find((o) => o.label.toLowerCase() === lower || lower.includes(o.label.toLowerCase()));
    }
  }

  if (!matched) return false;

  const waLoadBalancer = require("./waLoadBalancer");
  const result = await waLoadBalancer.sendTextMessage(cleanPhone, matched.reply_text, sessionKey);
  await queryAsync("DELETE FROM wa_pending_menus WHERE phone = ?", [cleanPhone]);

  // Log automation execution
  await queryAsync(
    "INSERT INTO wa_automation_logs (automation_id, phone, contact_name, trigger_data, status) VALUES (?, ?, NULL, ?, 'sent')",
    [pending.automation_id, cleanPhone, JSON.stringify({ menuOptionSelected: matched.label })]
  ).catch(() => {});

  // Log outbound message in message logs
  await queryAsync(
    `INSERT INTO wa_message_logs (phone, direction, message_type, message_text, status, created_at)
     VALUES (?, 'outbound', 'text', ?, 'sent', NOW())`,
    [cleanPhone, matched.reply_text]
  ).catch(() => {});

  // Emit Socket.IO live update for real-time Live Chat
  try {
    const app = require("../server");
    const io = app.get && app.get("io");
    if (io) {
      const livePayload = {
        phone: cleanPhone,
        chatId: `${cleanPhone}@c.us`,
        message: {
          id: result?.result?.id || "opt_" + Date.now(),
          from: "me",
          body: matched.reply_text,
          timestamp: Math.floor(Date.now() / 1000),
          isMe: true,
          status: "sent",
        },
      };
      io.emit("wa_message_sent", livePayload);
    }
  } catch (_) {}

  return true;
}

module.exports = { sendMenu, handleMenuReply, getOptions };
