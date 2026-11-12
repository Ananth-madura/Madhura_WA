"use strict";
/**
 * waBotGate.js
 *
 * One authority for "may the bot engage this contact right now?".
 *
 * The problem this fixes: a takeover pause already existed (`wa_contacts.
 * ai_paused_until`, set by a manual reply from the CRM inbox, by a flow
 * `handoff` node, and by the AI handoff tool) — but ONLY services/waAiReply.js
 * ever read it. The flow engine, the menu handler and the welcome auto-reply
 * all ignored it, which produced exactly the behaviour that felt out of
 * control:
 *
 *   1. An agent takes over a chat and replies by hand. The AI goes quiet, but
 *      the flow bot keeps firing on the customer's next message.
 *   2. A flow reaches a `handoff` node. The run is marked 'handed_off', so the
 *      customer's next message finds no active run, falls through to trigger
 *      matching, and an `all_inbound` flow restarts the bot immediately —
 *      silently undoing the handoff.
 *
 * So `ai_paused_until` is now read as what its setters always meant: the bot
 * is paused for this contact. Reusing the existing column (rather than adding
 * a parallel one) means every existing pause-setter starts working bot-wide
 * with no migration and no second source of truth.
 *
 * What this gate deliberately does NOT block, because none of it is the bot
 * choosing to engage:
 *   - opt-out / STOP handling — must always work
 *   - waConfirmationService replies — the customer is answering a reminder the
 *     operator explicitly sent them, so a tap is consent by definition
 *   - anything an operator triggers by hand from the CRM
 */

const getDb = () => require("../config/database");

/**
 * Minutes a manual agent reply mutes the bot.
 *
 * 24 hours, matching Wati/WACTO: once a human is in the conversation the bot
 * stays out for the day, or until the agent marks the ticket resolved (which
 * calls resumeBot). The old 30-minute default let the bot re-enter a chat an
 * agent was still handling. Override with WA_AI_TAKEOVER_MIN.
 */
const DEFAULT_TAKEOVER_MIN = Number(process.env.WA_AI_TAKEOVER_MIN || 1440);

function last10(phone) {
  return String(phone || "").replace(/\D/g, "").slice(-10);
}

/**
 * @param {string} phone
 * @param {object} [opts]
 * @param {boolean} [opts.isCampaignReply] caller already detected a campaign reply
 * @returns {Promise<{allowed: boolean, reason: string|null, contact: object|null}>}
 */
async function shouldBotEngage(phone, opts = {}) {
  const p10 = last10(phone);
  if (!p10 || p10.length < 10) {
    return { allowed: false, reason: "invalid_phone", contact: null };
  }

  let contact = null;
  try {
    let tenantId = Number(opts.tenantId || opts._tenant_id) || null;
    if (!tenantId && opts.sessionKey) {
      tenantId = Number(await require("./waContactTenancy").tenantForSessionKey(opts.sessionKey).catch(() => null)) || null;
    }
    const tenantClause = tenantId ? " AND tenant_id = ?" : "";
    const params = tenantId ? [`%${p10}`, tenantId] : [`%${p10}`];
    const [rows] = await getDb().promise().query(
      `SELECT id, name, is_blocked, is_unsubscribed, ai_enabled, ai_paused_until,
              assigned_agent_id, ticket_status, created_at
         FROM wa_contacts WHERE phone LIKE ?${tenantClause} ORDER BY id DESC LIMIT 1`,
      params
    );
    contact = rows?.[0] || null;
  } catch (err) {
    // A bookkeeping failure must not silence a real conversation.
    console.warn(`[WA BotGate] Lookup failed for +${p10}: ${err.message} — allowing.`);
    return { allowed: true, reason: null, contact: null };
  }

  if (contact) {
    if (contact.is_blocked) {
      return { allowed: false, reason: "contact_blocked", contact };
    }
    if (contact.is_unsubscribed) {
      return { allowed: false, reason: "contact_unsubscribed", contact };
    }
    // Per-contact bot switch. ai_enabled is the existing flag the inbox
    // already toggles; 0 means "no automation for this contact".
    if (contact.ai_enabled === 0) {
      return { allowed: false, reason: "bot_disabled_for_contact", contact };
    }
    // THE fix: a live agent takeover or a flow handoff now mutes the whole bot,
    // not just the AI auto-reply.
    if (contact.ai_paused_until && new Date(contact.ai_paused_until) > new Date()) {
      return { allowed: false, reason: "agent_takeover", contact };
    }
  }

  return { allowed: true, reason: null, contact };
}

/**
 * Convenience wrapper: logs once, consistently, and returns a plain boolean.
 * Use at the top of any bot-initiated inbound handler.
 */
async function botMayReply(phone, label, opts = {}) {
  const { allowed, reason, contact } = await shouldBotEngage(phone, opts);
  if (!allowed) {
    console.log(
      `🤫 [WA BotGate] ${label} suppressed for +${last10(phone)} — ${reason}` +
      (reason === "agent_takeover" && contact?.ai_paused_until
        ? ` (bot paused until ${new Date(contact.ai_paused_until).toISOString()})`
        : "")
    );
  }
  return allowed;
}

/**
 * Mute the bot for a contact — call whenever a human takes the conversation
 * over, or a flow deliberately hands off.
 *
 * @param {string} phone
 * @param {number} [minutes]
 * @param {string} [reason] for the log line only
 */
async function pauseBot(phone, minutes = DEFAULT_TAKEOVER_MIN, reason = "agent_takeover", sessionKey = null, scopedTenantId = null) {
  const p10 = last10(phone);
  if (!p10) return false;
  try {
    // Scoped to the calling organization: a phone match on its own would mute
    // the same person for every other tenant on this platform.
    const tenantId = Number(scopedTenantId) || await require("./waContactTenancy").tenantForContactWrite({ sessionKey });
    const [res] = await getDb().promise().query(
      "UPDATE wa_contacts SET ai_paused_until = DATE_ADD(NOW(), INTERVAL ? MINUTE) WHERE tenant_id = ? AND phone LIKE ?",
      [minutes, tenantId, `%${p10}`]
    );
    if (res.affectedRows) {
      console.log(`🤝 [WA BotGate] Bot paused ${minutes}min for +${p10} (${reason})`);
    }
    return res.affectedRows > 0;
  } catch (err) {
    console.warn(`[WA BotGate] pauseBot failed for +${p10}: ${err.message}`);
    return false;
  }
}

/** Hand the conversation back to the bot (operator resolved the ticket). */
async function resumeBot(phone, sessionKey = null, scopedTenantId = null) {
  const p10 = last10(phone);
  if (!p10) return false;
  try {
    const tenantId = Number(scopedTenantId) || await require("./waContactTenancy").tenantForContactWrite({ sessionKey });
    await getDb().promise().query(
      "UPDATE wa_contacts SET ai_paused_until = NULL WHERE tenant_id = ? AND phone LIKE ?",
      [tenantId, `%${p10}`]
    );
    console.log(`🤖 [WA BotGate] Bot resumed for +${p10}`);
    return true;
  } catch (err) {
    console.warn(`[WA BotGate] resumeBot failed for +${p10}: ${err.message}`);
    return false;
  }
}

async function syncConversationTakeover({ db: customDb = null, tenantId = null, phone = null, conversationId = null, paused = true, reason = "agent_takeover", minutes = DEFAULT_TAKEOVER_MIN } = {}) {
  const database = customDb || getDb();
  const q = async (sql, params = []) => (await database.promise().query(sql, params))[0];
  const p10 = last10(phone);
  const tid = Number(tenantId) || null;
  const cid = Number(conversationId) || null;

  try {
    if (p10 && p10.length >= 10) {
      if (paused) {
        const sql = database.isSqlite
          ? `UPDATE wa_contacts SET ai_paused_until = datetime('now', '+' || ? || ' minutes') WHERE ${tid ? "tenant_id = ? AND " : ""}phone LIKE ?`
          : `UPDATE wa_contacts SET ai_paused_until = DATE_ADD(NOW(), INTERVAL ? MINUTE) WHERE ${tid ? "tenant_id = ? AND " : ""}phone LIKE ?`;
        await q(sql, tid ? [minutes, tid, `%${p10}`] : [minutes, `%${p10}`]).catch(() => { });
      } else {
        await q(
          `UPDATE wa_contacts SET ai_paused_until = NULL WHERE ${tid ? "tenant_id = ? AND " : ""}phone LIKE ?`,
          tid ? [tid, `%${p10}`] : [`%${p10}`]
        ).catch(() => { });
      }
    }

    let convIds = cid ? [cid] : [];
    if (!convIds.length && tid && p10 && p10.length >= 10) {
      const matched = await q(
        "SELECT c.id FROM conversations c JOIN wa_contacts ct ON ct.id = c.contact_id AND ct.tenant_id = c.tenant_id WHERE c.tenant_id = ? AND ct.phone LIKE ? LIMIT 10",
        [tid, `%${p10}`]
      ).catch(() => []);
      convIds = matched.map((r) => r.id);
    }

    for (const id of convIds) {
      if (paused) {
        await q(
          `UPDATE conversations SET automation_mode = 'human', automation_version = automation_version + 1, updated_at = CURRENT_TIMESTAMP WHERE ${tid ? "tenant_id = ? AND " : ""}id = ?`,
          tid ? [tid, id] : [id]
        ).catch(() => { });
        await q(
          `UPDATE wa_flow_runs SET status = 'paused_by_agent', end_reason = ?, ended_at = CURRENT_TIMESTAMP WHERE conversation_id = ? AND status = 'active'`,
          [String(reason).slice(0, 64), id]
        ).catch(() => { });
      } else if (tid) {
        await q(
          "UPDATE conversations SET automation_mode = 'assistant', automation_version = automation_version + 1, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ? AND automation_mode = 'human'",
          [tid, id]
        ).catch(() => { });
      }
    }
    return true;
  } catch (err) {
    console.warn("[WA BotGate] syncConversationTakeover warning:", err.message);
    return false;
  }
}

module.exports = {
  shouldBotEngage,
  botMayReply,
  pauseBot,
  resumeBot,
  syncConversationTakeover,
  DEFAULT_TAKEOVER_MIN,
};
