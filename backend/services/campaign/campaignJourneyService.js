"use strict";

/**
 * campaignJourneyService.js
 *
 * Connects Enterprise Campaigns to:
 * 1. Madhura Flowbot conversational runtime (persistent conversation states + Team Inbox handover)
 * 2. Campaign Automation Engine (triggers, conditional branches, stop conditions, re-entry policy)
 * 3. E-Commerce & Integration Events (Shopify, WooCommerce, Razorpay, Sales CRM) with idempotency
 *    and abandoned-cart stop-on-purchase enforcement.
 */

const {
  createDbHelper,
  assertTenantId,
  normalizePhone,
  safeJsonParse,
  httpError,
} = require("./dbHelper");
const { createConsentSuppressionService } = require("./consentSuppressionService");

const VALID_STOP_REASONS = new Set([
  "contact_opted_out",
  "customer_converted",
  "order_completed",
  "deal_won",
  "campaign_cancelled",
  "journey_expired",
  "human_handover",
  "frequency_limit",
  "sender_unavailable",
]);

function createCampaignJourneyService(options = {}) {
  const db = createDbHelper(options.db);
  const consentService = options.consentService || createConsentSuppressionService({ db: options.db });

  // ── Flowbot Bindings & Persistent Conversation State ─────────────────────

  async function bindFlowbot(tenantId, campaignId, { flowbotId, triggerOn = "reply", handoverRules = null }) {
    const tid = assertTenantId(tenantId);
    const res = await db.query(
      `INSERT INTO campaign_flowbot_bindings (tenant_id, campaign_id, flowbot_id, trigger_on, handover_rules_json, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [tid, Number(campaignId), Number(flowbotId), triggerOn, handoverRules ? JSON.stringify(handoverRules) : null]
    );
    await db.query(
      `UPDATE campaigns SET flowbot_id = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?`,
      [Number(flowbotId), tid, Number(campaignId)]
    );
    return db.queryOne(`SELECT * FROM campaign_flowbot_bindings WHERE id = ?`, [res.insertId]);
  }

  async function advanceFlowbotState(tenantId, { flowbotId, campaignId = null, recipientId = null, contactId = null, phone, nodeId, answer = null, requestHandover = false, assignedAgentId = null }) {
    const tid = assertTenantId(tenantId);
    const { normalized } = normalizePhone(phone);
    if (!normalized) throw httpError("Valid phone required for Flowbot state", 400);

    const existing = await db.queryOne(
      `SELECT * FROM flowbot_conversation_states
       WHERE tenant_id = ? AND flowbot_id = ? AND normalized_phone = ? AND state_status IN ('ACTIVE','WAITING')
       ORDER BY id DESC LIMIT 1`,
      [tid, Number(flowbotId), normalized]
    );

    const answers = existing ? safeJsonParse(existing.collected_answers_json, {}) : {};
    if (answer && typeof answer === "object") Object.assign(answers, answer);

    const status = requestHandover ? "HANDOVER" : "ACTIVE";
    if (existing) {
      await db.query(
        `UPDATE flowbot_conversation_states
         SET current_node_id = COALESCE(?, current_node_id),
             state_status = ?,
             collected_answers_json = ?,
             handover_active = ?,
             assigned_agent_id = COALESCE(?, assigned_agent_id),
             last_action_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND tenant_id = ?`,
        [nodeId || null, status, JSON.stringify(answers), requestHandover ? 1 : 0, assignedAgentId, existing.id, tid]
      );
      if (requestHandover && campaignId) {
        await stopJourneysForPhone(tid, normalized, "human_handover", { campaignId });
      }
      return db.queryOne(`SELECT * FROM flowbot_conversation_states WHERE id = ?`, [existing.id]);
    }

    const res = await db.query(
      `INSERT INTO flowbot_conversation_states (
        tenant_id, flowbot_id, campaign_id, recipient_id, contact_id, normalized_phone,
        current_node_id, state_status, collected_answers_json, handover_active, assigned_agent_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tid, Number(flowbotId), campaignId, recipientId, contactId, normalized, nodeId || "start", status, JSON.stringify(answers), requestHandover ? 1 : 0, assignedAgentId]
    );
    return db.queryOne(`SELECT * FROM flowbot_conversation_states WHERE id = ?`, [res.insertId]);
  }

  // ── Automation Bindings & Journey Enrollments ────────────────────────────

  async function createAutomationBinding(tenantId, campaignId, input = {}, actorId = null) {
    const tid = assertTenantId(tenantId);
    if (!input.trigger_event) throw httpError("trigger_event is required", 400);
    if (!Array.isArray(input.actions) || input.actions.length === 0) {
      throw httpError("At least one automation action is required", 400);
    }

    const res = await db.query(
      `INSERT INTO campaign_automation_bindings (
        tenant_id, campaign_id, automation_id, name, trigger_event,
        conditions_json, actions_json, stop_conditions_json,
        reentry_policy, reentry_cooldown_hours, max_duration_hours, is_active, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [
        tid,
        Number(campaignId),
        input.automation_id || null,
        String(input.name || `Automation (${input.trigger_event})`),
        String(input.trigger_event),
        input.conditions ? JSON.stringify(input.conditions) : null,
        JSON.stringify(input.actions),
        JSON.stringify(input.stop_conditions || ["contact_opted_out", "order_completed", "human_handover"]),
        input.reentry_policy || "one_time",
        Number(input.reentry_cooldown_hours || 0),
        Number(input.max_duration_hours || 720),
        actorId,
      ]
    );
    return db.queryOne(`SELECT * FROM campaign_automation_bindings WHERE id = ?`, [res.insertId]);
  }

  async function listAutomationBindings(tenantId, campaignId) {
    const tid = assertTenantId(tenantId);
    const rows = await db.query(
      `SELECT * FROM campaign_automation_bindings WHERE tenant_id = ? AND campaign_id = ? ORDER BY id ASC`,
      [tid, Number(campaignId)]
    );
    return rows.map((r) => ({
      ...r,
      conditions: safeJsonParse(r.conditions_json, null),
      actions: safeJsonParse(r.actions_json, []),
      stop_conditions: safeJsonParse(r.stop_conditions_json, []),
    }));
  }

  /**
   * Enroll a contact into matching campaign automation journeys with strict re-entry & consent guards.
   */
  async function triggerCampaignEvent(tenantId, { campaignId, triggerEvent, recipientId = null, contactId = null, phone, sourceEventKey = null, context = {} }) {
    const tid = assertTenantId(tenantId);
    const { valid, normalized } = normalizePhone(phone);
    if (!valid) return { enrolled: 0, skipped: 1, reason: "invalid_phone" };

    // Always honor opt-out/suppression before enrolling into outbound journeys
    const sup = await consentService.checkSuppression(tid, normalized, { category: "MARKETING" });
    if (sup.suppressed) {
      return { enrolled: 0, skipped: 1, reason: "suppressed" };
    }

    const bindings = await db.query(
      `SELECT * FROM campaign_automation_bindings
       WHERE tenant_id = ? AND campaign_id = ? AND trigger_event = ? AND is_active = 1`,
      [tid, Number(campaignId), String(triggerEvent)]
    );

    const enrolledIds = [];
    for (const b of bindings) {
      // Enforce re-entry policy
      const prior = await db.queryOne(
        `SELECT * FROM campaign_journey_enrollments
         WHERE tenant_id = ? AND binding_id = ? AND normalized_phone = ?
         ORDER BY enrolled_at DESC LIMIT 1`,
        [tid, b.id, normalized]
      );

      if (prior) {
        if (b.reentry_policy === "one_time" || b.reentry_policy === "never") continue;
        if (b.reentry_policy === "after_completion" && prior.status === "ACTIVE") continue;
        if (b.reentry_policy === "after_cooldown" && b.reentry_cooldown_hours > 0) {
          const elapsedHrs = (Date.now() - new Date(prior.enrolled_at).getTime()) / 3600000;
          if (elapsedHrs < Number(b.reentry_cooldown_hours)) continue;
        }
      }

      const eventKey = sourceEventKey || `${triggerEvent}:${recipientId || normalized}`;
      try {
        const res = await db.query(
          `INSERT INTO campaign_journey_enrollments (
            tenant_id, campaign_id, binding_id, recipient_id, contact_id,
            normalized_phone, source_event_key, status, current_step, context_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 0, ?)`,
          [tid, Number(campaignId), b.id, recipientId, contactId, normalized, eventKey, JSON.stringify(context)]
        );
        enrolledIds.push(res.insertId);

        // Execute immediate CRM/Inbox actions defined in the automation binding
        const actions = safeJsonParse(b.actions_json, []);
        const executedActions = await executeBindingActions(tid, {
          campaignId: Number(campaignId),
          recipientId,
          contactId,
          normalizedPhone: normalized,
          triggerEvent,
          actions,
          context,
        });
        if (executedActions.length > 0) {
          await db.query(
            `UPDATE campaign_journey_enrollments SET current_step = ?, context_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [executedActions.length, JSON.stringify({ ...context, executed_actions: executedActions }), res.insertId]
          );
        }
      } catch (_) {
        // Unique (binding_id, normalized_phone, source_event_key) prevents duplicate event enrollment
      }
    }

    return { enrolled: enrolledIds.length, enrollment_ids: enrolledIds };
  }

  /**
   * Execute real CRM & Inbox side-effects for campaign automation bindings
   * (tags, contact updates, lead/enquiry creation in wa_enquiries, human handover).
   */
  async function executeBindingActions(tenantId, { campaignId, recipientId, contactId, normalizedPhone, triggerEvent, actions = [], context = {} }) {
    const tid = assertTenantId(tenantId);
    const executed = [];

    for (const act of actions) {
      if (!act || !act.type) continue;
      try {
        if (act.type === "add_tag" || act.type === "remove_tag") {
          const tag = String(act.tag || act.value || "campaign_engaged").trim();
          const contact = await db.queryOne(
            `SELECT id, tags FROM wa_contacts WHERE tenant_id = ? AND (id = ? OR phone = ? OR phone = ?) LIMIT 1`,
            [tid, contactId || 0, normalizedPhone, normalizedPhone.slice(-10)]
          );
          if (contact) {
            const tags = safeJsonParse(contact.tags, []);
            const nextTags =
              act.type === "add_tag"
                ? Array.from(new Set([...tags, tag]))
                : tags.filter((t) => String(t).toLowerCase() !== tag.toLowerCase());
            await db.query(`UPDATE wa_contacts SET tags = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?`, [
              JSON.stringify(nextTags),
              contact.id,
              tid,
            ]);
            executed.push({ type: act.type, tag, contact_id: contact.id });
          }
        } else if (act.type === "update_contact" && act.fields && typeof act.fields === "object") {
          const contact = await db.queryOne(
            `SELECT id, custom_fields FROM wa_contacts WHERE tenant_id = ? AND (id = ? OR phone = ? OR phone = ?) LIMIT 1`,
            [tid, contactId || 0, normalizedPhone, normalizedPhone.slice(-10)]
          );
          if (contact) {
            const cf = { ...safeJsonParse(contact.custom_fields, {}), ...act.fields };
            await db.query(`UPDATE wa_contacts SET custom_fields = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?`, [
              JSON.stringify(cf),
              contact.id,
              tid,
            ]);
            executed.push({ type: "update_contact", contact_id: contact.id });
          }
        } else if (act.type === "create_lead") {
          // Create a real lead in wa_enquiries while preserving original contact source
          const contact = await db.queryOne(
            `SELECT id, name, email FROM wa_contacts WHERE tenant_id = ? AND (id = ? OR phone = ? OR phone = ?) LIMIT 1`,
            [tid, contactId || 0, normalizedPhone, normalizedPhone.slice(-10)]
          ).catch(() => null);
          const leadName = contact?.name || context.response?.full_name || `WhatsApp Lead ${normalizedPhone.slice(-4)}`;
          const messageSummary =
            context.text ||
            (context.response ? `Flow submission: ${JSON.stringify(context.response).slice(0, 300)}` : `Triggered by ${triggerEvent}`);
          const res = await db.query(
            `INSERT INTO wa_enquiries (tenant_id, contact_id, name, phone, email, source, enquiry_type, message, temperature, status, notes)
             VALUES (?, ?, ?, ?, ?, 'campaign_response', ?, ?, 'warm', 'open', ?)`,
            [
              tid,
              contact?.id || contactId || null,
              leadName,
              normalizedPhone,
              contact?.email || null,
              act.enquiry_type || "product",
              messageSummary,
              `Campaign #${campaignId}${recipientId ? ` · Recipient #${recipientId}` : ""} (${triggerEvent})`,
            ]
          ).catch(() => null);
          if (res?.insertId) {
            executed.push({ type: "create_lead", enquiry_id: res.insertId });
          }
        } else if (act.type === "handover_to_human") {
          await db.query(
            `UPDATE flowbot_conversation_states SET handover_active = 1, state_status = 'HANDOVER', assigned_agent_id = COALESCE(?, assigned_agent_id), updated_at = CURRENT_TIMESTAMP
             WHERE tenant_id = ? AND normalized_phone = ? AND state_status IN ('ACTIVE','WAITING')`,
            [act.agent_id || null, tid, normalizedPhone]
          );
          executed.push({ type: "handover_to_human", agent_id: act.agent_id || null });
        }
      } catch (_) {}
    }

    return executed;
  }

  async function stopJourneysForPhone(tenantId, phone, stopReason, { campaignId = null } = {}) {
    const tid = assertTenantId(tenantId);
    const { normalized } = normalizePhone(phone);
    if (!normalized) return { stopped: 0 };
    const reason = VALID_STOP_REASONS.has(stopReason) ? stopReason : String(stopReason || "stopped");
    const sql = campaignId
      ? `UPDATE campaign_journey_enrollments SET status = 'STOPPED', stop_reason = ?, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND normalized_phone = ? AND campaign_id = ? AND status = 'ACTIVE'`
      : `UPDATE campaign_journey_enrollments SET status = 'STOPPED', stop_reason = ?, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND normalized_phone = ? AND status = 'ACTIVE'`;
    const params = campaignId ? [reason, tid, normalized, Number(campaignId)] : [reason, tid, normalized];
    const res = await db.query(sql, params);
    return { stopped: Number(res?.affectedRows || 0), stop_reason: reason };
  }

  // ── E-Commerce & Integration Event Ingestion (Shopify / WooCommerce / Razorpay / CRM) ──

  async function ingestEcommerceEvent(tenantId, input = {}) {
    const tid = assertTenantId(tenantId);
    const provider = String(input.provider || "custom").toLowerCase();
    const eventType = String(input.event_type || "").toLowerCase();
    const idempotencyKey = String(input.idempotency_key || "");
    if (!eventType || !idempotencyKey) {
      throw httpError("event_type and idempotency_key are required", 400, "ECOMMERCE_EVENT_INVALID");
    }

    const existing = await db.queryOne(
      `SELECT id FROM campaign_ecommerce_events WHERE tenant_id = ? AND provider = ? AND idempotency_key = ? LIMIT 1`,
      [tid, provider, idempotencyKey]
    );
    if (existing) {
      return { deduplicated: true, event_id: existing.id };
    }

    const phoneCheck = normalizePhone(input.phone || input.customer_phone || "");
    const normalizedPhone = phoneCheck.valid ? phoneCheck.normalized : null;

    let contactId = input.contact_id || null;
    if (!contactId && normalizedPhone) {
      const contact = await db.queryOne(
        `SELECT id FROM wa_contacts WHERE tenant_id = ? AND (phone = ? OR phone = ?) LIMIT 1`,
        [tid, normalizedPhone, normalizedPhone.slice(-10)]
      );
      contactId = contact?.id || null;
    }

    const res = await db.query(
      `INSERT INTO campaign_ecommerce_events (
        tenant_id, provider, event_type, idempotency_key, external_order_id,
        external_cart_id, contact_id, normalized_phone, amount_minor, currency, payload_json, processed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        tid,
        provider,
        eventType,
        idempotencyKey,
        input.order_id ? String(input.order_id) : null,
        input.cart_id ? String(input.cart_id) : null,
        contactId,
        normalizedPhone,
        input.amount_minor !== undefined ? Number(input.amount_minor) : null,
        input.currency || "INR",
        JSON.stringify(input.payload || input),
      ]
    );
    const eventId = res.insertId;

    const actionsTaken = [];

    // When a real order is paid/completed, stop any active abandoned-cart journeys for that customer
    if (["order_completed", "paid_order", "payment_completed"].includes(eventType) && normalizedPhone) {
      const stopped = await stopJourneysForPhone(tid, normalizedPhone, "order_completed");
      if (stopped.stopped > 0) actionsTaken.push({ action: "stopped_abandoned_cart_journeys", count: stopped.stopped });
    }

    // Trigger matching event-driven campaigns (e.g., abandoned_cart, order_updates, payment_reminders)
    if (normalizedPhone) {
      const matchingCampaigns = await db.query(
        `SELECT id FROM campaigns
         WHERE tenant_id = ? AND status IN ('RUNNING','SCHEDULED','APPROVED')
           AND campaign_type IN (?, 'triggered', 'journey_based')`,
        [tid, eventType === "abandoned_cart" ? "abandoned_cart" : eventType === "paid_order" ? "order_updates" : "triggered"]
      );
      for (const camp of matchingCampaigns) {
        const enrolled = await triggerCampaignEvent(tid, {
          campaignId: camp.id,
          triggerEvent: eventType,
          contactId,
          phone: normalizedPhone,
          sourceEventKey: `${provider}:${idempotencyKey}`,
          context: {
            provider,
            event_id: eventId,
            order_id: input.order_id || null,
            cart_id: input.cart_id || null,
            amount_minor: input.amount_minor || null,
          },
        });
        if (enrolled.enrolled > 0) {
          await db.query(`UPDATE campaign_ecommerce_events SET matched_campaign_id = ? WHERE id = ?`, [camp.id, eventId]);
          actionsTaken.push({ action: "enrolled_journey", campaign_id: camp.id, count: enrolled.enrolled });
        }
      }
    }

    return { deduplicated: false, event_id: eventId, normalized_phone: normalizedPhone, contact_id: contactId, actions: actionsTaken };
  }

  return {
    bindFlowbot,
    advanceFlowbotState,
    createAutomationBinding,
    listAutomationBindings,
    triggerCampaignEvent,
    stopJourneysForPhone,
    ingestEcommerceEvent,
  };
}

module.exports = { createCampaignJourneyService };
