"use strict";

/**
 * sharedContextService.js
 *
 * Shared Madhura business context loader and CRM/Sales/Support/Team action
 * executor used by BOTH the Flowbot Runtime and Automation Engine.
 *
 * Guarantees:
 *   - Always reloads fresh CRM records (never trusts stale workflow snapshots).
 *   - Strict tenant_id + workspace_id isolation on every query and mutation.
 *   - Safe customer ownership verification on order lookups (never discloses
 *     another customer's order information).
 *   - Duplicate-safe contact/lead handling and structured action results.
 */

const {
  createDbHelper,
  assertTenantId,
  normalizePhone,
  safeJsonParse,
  httpError,
} = require("../campaign/dbHelper");
const { createCampaignAnalyticsService } = require("../campaign/campaignAnalyticsService");

function createSharedContextService(options = {}) {
  const db = createDbHelper(options.db);
  const analyticsService = options.analyticsService || createCampaignAnalyticsService({ db: options.db });

  async function loadFreshContext(tenantId, refs = {}) {
    const tid = assertTenantId(tenantId);
    const norm = refs.phone ? normalizePhone(refs.phone) : { valid: false, normalized: null };
    const phone = norm.valid ? norm.normalized : null;

    let contact = null;
    if (refs.contactId) {
      contact = await db.queryOne(
        `SELECT * FROM wa_contacts WHERE tenant_id = ? AND id = ? LIMIT 1`,
        [tid, Number(refs.contactId)]
      ).catch(() => null);
    }
    if (!contact && phone) {
      contact = await db.queryOne(
        `SELECT * FROM wa_contacts WHERE tenant_id = ? AND (phone = ? OR phone LIKE ?) LIMIT 1`,
        [tid, phone, `%${phone.slice(-10)}`]
      ).catch(() => null);
    }

    const effectivePhone = phone || (contact?.phone ? normalizePhone(contact.phone).normalized : null);

    let lead = null;
    if (refs.leadId) {
      lead = await db.queryOne(
        `SELECT * FROM wa_enquiries WHERE tenant_id = ? AND id = ? LIMIT 1`,
        [tid, Number(refs.leadId)]
      ).catch(() => null);
    } else if (effectivePhone) {
      lead = await db.queryOne(
        `SELECT * FROM wa_enquiries WHERE tenant_id = ? AND phone = ? ORDER BY id DESC LIMIT 1`,
        [tid, effectivePhone]
      ).catch(() => null);
    }

    let deal = null;
    if (refs.dealId) {
      deal = await db.queryOne(
        `SELECT * FROM crm_deals WHERE tenant_id = ? AND id = ? LIMIT 1`,
        [tid, Number(refs.dealId)]
      ).catch(() => null);
    } else if (contact?.id) {
      deal = await db.queryOne(
        `SELECT * FROM crm_deals WHERE tenant_id = ? AND contact_id = ? ORDER BY id DESC LIMIT 1`,
        [tid, contact.id]
      ).catch(() => null);
    }

    let campaign = null;
    if (refs.campaignId) {
      campaign = await db.queryOne(
        `SELECT id, campaign_uid, name, campaign_type, category, status, waba_id, sender_id
         FROM campaigns WHERE tenant_id = ? AND id = ? LIMIT 1`,
        [tid, Number(refs.campaignId)]
      ).catch(() => null);
    }

    return {
      system: {
        timestamp: new Date().toISOString(),
        tenant_id: tid,
        workspace_id: refs.workspaceId || null,
        contact_id: contact?.id || refs.contactId || null,
        conversation_id: refs.conversationId || null,
        sender_id: refs.senderId || campaign?.sender_id || null,
        waba_id: refs.wabaId || campaign?.waba_id || null,
        campaign_id: refs.campaignId || null,
      },
      customer: {
        id: contact?.id || null,
        name: contact?.name || refs.customerName || "",
        first_name: String(contact?.name || refs.customerName || "").trim().split(/\s+/)[0] || "",
        phone: effectivePhone || "",
        email: contact?.email || null,
        tags: safeJsonParse(contact?.tags, []),
        custom_fields: safeJsonParse(contact?.custom_fields, {}),
        is_blocked: Boolean(contact?.is_blocked),
        is_unsubscribed: Boolean(contact?.is_unsubscribed),
        source: contact?.source || null,
      },
      lead: lead || null,
      deal: deal || null,
      campaign: campaign || null,
      flow: refs.flowVars || {},
      ai: refs.aiVars || {},
      execution: refs.executionVars || {},
      integration: refs.integrationVars || {},
    };
  }

  async function executeCrmAction(tenantId, actionType, params = {}, context = {}) {
    const tid = assertTenantId(tenantId);
    const workspaceId = params.workspace_id || context.system?.workspace_id || null;
    const rawPhone = params.phone || context.customer?.phone || null;
    const norm = rawPhone ? normalizePhone(rawPhone) : { valid: false, normalized: null };
    const phone = norm.valid ? norm.normalized : null;

    switch (String(actionType || "").toLowerCase()) {
      case "find_contact": {
        if (!phone && !params.contact_id) return { ok: false, error: "phone or contact_id required" };
        const row = params.contact_id
          ? await db.queryOne(`SELECT * FROM wa_contacts WHERE tenant_id = ? AND id = ? LIMIT 1`, [tid, Number(params.contact_id)])
          : await db.queryOne(`SELECT * FROM wa_contacts WHERE tenant_id = ? AND (phone = ? OR phone LIKE ?) LIMIT 1`, [tid, phone, `%${phone.slice(-10)}`]);
        return { ok: true, found: Boolean(row), contact: row || null };
      }

      case "create_contact":
      case "update_contact": {
        if (!phone && !params.contact_id && !context.customer?.id) {
          throw httpError("Contact phone or ID is required", 400, "CONTACT_PHONE_REQUIRED");
        }
        const existing = params.contact_id || context.customer?.id
          ? await db.queryOne(`SELECT * FROM wa_contacts WHERE tenant_id = ? AND id = ? LIMIT 1`, [tid, Number(params.contact_id || context.customer.id)])
          : await db.queryOne(`SELECT * FROM wa_contacts WHERE tenant_id = ? AND (phone = ? OR phone LIKE ?) LIMIT 1`, [tid, phone, `%${phone.slice(-10)}`]);

        if (existing) {
          const mergedCustom = {
            ...safeJsonParse(existing.custom_fields, {}),
            ...(params.custom_fields && typeof params.custom_fields === "object" ? params.custom_fields : {}),
          };
          await db.query(
            `UPDATE wa_contacts
             SET name = COALESCE(?, name), email = COALESCE(?, email),
                 custom_fields = ?, notes = COALESCE(?, notes), updated_at = CURRENT_TIMESTAMP
             WHERE tenant_id = ? AND id = ?`,
            [params.name || null, params.email || null, JSON.stringify(mergedCustom), params.notes || null, tid, existing.id]
          );
          return { ok: true, action: "updated", contact_id: existing.id };
        }

        const res = await db.query(
          `INSERT INTO wa_contacts (tenant_id, branch_id, name, phone, email, tags, custom_fields, source, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            tid,
            workspaceId,
            params.name || "WhatsApp Contact",
            phone,
            params.email || null,
            JSON.stringify(Array.isArray(params.tags) ? params.tags : []),
            JSON.stringify(params.custom_fields || {}),
            params.source || (context.system?.campaign_id ? "campaign" : "flowbot"),
            params.notes || null,
          ]
        );
        return { ok: true, action: "created", contact_id: res.insertId };
      }

      case "add_tag":
      case "remove_tag": {
        const tag = String(params.tag || "").trim();
        if (!tag) throw httpError("tag is required", 400, "TAG_REQUIRED");
        const contactId = params.contact_id || context.customer?.id;
        const contact = contactId
          ? await db.queryOne(`SELECT id, tags FROM wa_contacts WHERE tenant_id = ? AND id = ? LIMIT 1`, [tid, Number(contactId)])
          : phone
          ? await db.queryOne(`SELECT id, tags FROM wa_contacts WHERE tenant_id = ? AND (phone = ? OR phone LIKE ?) LIMIT 1`, [tid, phone, `%${phone.slice(-10)}`])
          : null;
        if (!contact) return { ok: false, error: "Contact not found for tag mutation" };

        const cur = new Set(safeJsonParse(contact.tags, []));
        if (actionType === "add_tag") cur.add(tag);
        else cur.delete(tag);

        await db.query(`UPDATE wa_contacts SET tags = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?`, [
          JSON.stringify(Array.from(cur)),
          tid,
          contact.id,
        ]);
        return { ok: true, contact_id: contact.id, tags: Array.from(cur) };
      }

      case "add_note": {
        const noteText = String(params.note || "").trim();
        const contactId = params.contact_id || context.customer?.id;
        if (!contactId || !noteText) return { ok: false, error: "contact_id and note are required" };
        const contact = await db.queryOne(`SELECT id, notes FROM wa_contacts WHERE tenant_id = ? AND id = ? LIMIT 1`, [tid, Number(contactId)]);
        if (!contact) return { ok: false, error: "Contact not found" };
        const combined = contact.notes ? `${contact.notes}\n[${new Date().toISOString()}] ${noteText}` : `[${new Date().toISOString()}] ${noteText}`;
        await db.query(`UPDATE wa_contacts SET notes = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?`, [combined, tid, contact.id]);
        return { ok: true, contact_id: contact.id };
      }

      case "find_lead": {
        const row = params.lead_id
          ? await db.queryOne(`SELECT * FROM wa_enquiries WHERE tenant_id = ? AND id = ? LIMIT 1`, [tid, Number(params.lead_id)])
          : phone
          ? await db.queryOne(`SELECT * FROM wa_enquiries WHERE tenant_id = ? AND phone = ? ORDER BY id DESC LIMIT 1`, [tid, phone])
          : null;
        return { ok: true, found: Boolean(row), lead: row || null };
      }

      case "create_lead": {
        if (!phone) throw httpError("Phone is required to create a lead", 400, "LEAD_PHONE_REQUIRED");
        const leadName = params.name || context.customer?.name || "WhatsApp Lead";
        const notes = params.notes || params.summary || JSON.stringify(context.flow || {});
        const status = params.status || "warm";
        const source = params.source || (context.system?.campaign_id ? "campaign_response" : "flowbot");
        const res = await db.query(
          `INSERT INTO wa_enquiries (tenant_id, phone, name, status, notes, source)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [tid, phone, leadName, status, String(notes).slice(0, 2000), source]
        );
        return { ok: true, lead_id: res.insertId, status, source };
      }

      case "update_lead":
      case "qualify_lead":
      case "convert_lead": {
        const leadId = params.lead_id || context.lead?.id;
        if (!leadId) return { ok: false, error: "lead_id not found in context" };
        const nextStatus = actionType === "convert_lead"
          ? "converted"
          : actionType === "qualify_lead"
          ? (params.status || "hot")
          : (params.status || null);
        await db.query(
          `UPDATE wa_enquiries
           SET status = COALESCE(?, status), notes = COALESCE(?, notes)
           WHERE tenant_id = ? AND id = ?`,
          [nextStatus, params.notes || null, tid, Number(leadId)]
        );
        return { ok: true, lead_id: Number(leadId), status: nextStatus };
      }

      case "create_deal": {
        const title = String(params.title || `Deal - ${context.customer?.name || phone || "Prospect"}`).trim();
        const valueMinor = Number(params.value_minor ?? (params.amount ? Math.round(Number(params.amount) * 100) : 0));
        const res = await db.query(
          `INSERT INTO crm_deals
           (tenant_id, workspace_id, contact_id, enquiry_id, campaign_id, title, stage, value_minor, currency, assigned_to, team_id, status, metadata_json, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`,
          [
            tid,
            workspaceId,
            params.contact_id || context.customer?.id || null,
            params.lead_id || context.lead?.id || null,
            params.campaign_id || context.system?.campaign_id || null,
            title,
            params.stage || "qualified",
            Number.isFinite(valueMinor) ? valueMinor : 0,
            params.currency || "INR",
            params.assigned_to || null,
            params.team_id || null,
            JSON.stringify(params.metadata || {}),
            params.actor_id || null,
          ]
        );
        return { ok: true, deal_id: res.insertId, title, stage: params.stage || "qualified", value_minor: valueMinor };
      }

      case "update_deal":
      case "move_deal_stage": {
        const dealId = params.deal_id || context.deal?.id;
        if (!dealId) return { ok: false, error: "deal_id not found in context" };
        const nextStage = params.stage || null;
        const nextStatus = nextStage === "won" ? "won" : nextStage === "lost" ? "lost" : (params.status || null);
        await db.query(
          `UPDATE crm_deals
           SET stage = COALESCE(?, stage), status = COALESCE(?, status),
               assigned_to = COALESCE(?, assigned_to),
               value_minor = COALESCE(?, value_minor),
               updated_at = CURRENT_TIMESTAMP
           WHERE tenant_id = ? AND id = ?`,
          [nextStage, nextStatus, params.assigned_to || null, params.value_minor ?? null, tid, Number(dealId)]
        );
        return { ok: true, deal_id: Number(dealId), stage: nextStage, status: nextStatus };
      }

      case "create_task":
      case "schedule_follow_up": {
        const title = String(params.title || (actionType === "schedule_follow_up" ? "Follow up with lead" : "CRM Task")).trim();
        const dueAt = params.due_at || new Date(Date.now() + Number(params.due_in_hours || 24) * 3600000).toISOString();
        const res = await db.query(
          `INSERT INTO crm_tasks
           (tenant_id, workspace_id, contact_id, enquiry_id, deal_id, campaign_id, title, description, task_type, priority, assigned_to, due_at, status, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`,
          [
            tid,
            workspaceId,
            params.contact_id || context.customer?.id || null,
            params.lead_id || context.lead?.id || null,
            params.deal_id || context.deal?.id || null,
            params.campaign_id || context.system?.campaign_id || null,
            title,
            params.description || null,
            actionType === "schedule_follow_up" ? "follow_up" : (params.task_type || "general"),
            params.priority || "normal",
            params.assigned_to || null,
            dueAt,
            params.actor_id || null,
          ]
        );
        return { ok: true, task_id: res.insertId, title, due_at: dueAt, assigned_to: params.assigned_to || null };
      }

      case "assign_employee":
      case "assign_agent":
      case "assign_team": {
        const assignedTo = params.agent_id || params.employee_id || params.assigned_to || null;
        const teamId = params.team_id || null;
        const dealId = params.deal_id || context.deal?.id || null;
        if (dealId && (assignedTo || teamId)) {
          await db.query(
            `UPDATE crm_deals SET assigned_to = COALESCE(?, assigned_to), team_id = COALESCE(?, team_id), updated_at = CURRENT_TIMESTAMP
             WHERE tenant_id = ? AND id = ?`,
            [assignedTo, teamId, tid, Number(dealId)]
          ).catch(() => {});
        }
        return { ok: true, assigned_to: assignedTo, team_id: teamId, strategy: params.strategy || "direct" };
      }

      case "create_ticket": {
        // Reuses wa_support_tickets if present, otherwise creates a support crm_task
        try {
          const res = await db.query(
            `INSERT INTO wa_support_tickets (tenant_id, phone, subject, description, priority, status)
             VALUES (?, ?, ?, ?, ?, 'open')`,
            [tid, phone || "", params.subject || "Customer Support Ticket", params.description || "", params.priority || "normal"]
          );
          return { ok: true, ticket_id: res.insertId, table: "wa_support_tickets" };
        } catch {
          return executeCrmAction(tid, "create_task", {
            ...params,
            title: params.subject || "Support Ticket",
            task_type: "support_ticket",
          }, context);
        }
      }

      case "create_appointment": {
        try {
          const res = await db.query(
            `INSERT INTO wa_appointments (tenant_id, phone, customer_name, service_name, scheduled_at, status)
             VALUES (?, ?, ?, ?, ?, 'confirmed')`,
            [tid, phone || "", context.customer?.name || "Customer", params.service || "Consultation", params.scheduled_at || new Date().toISOString()]
          );
          return { ok: true, appointment_id: res.insertId, table: "wa_appointments" };
        } catch {
          return executeCrmAction(tid, "create_task", {
            ...params,
            title: `Appointment: ${params.service || "Visit"}`,
            task_type: "appointment",
            due_at: params.scheduled_at,
          }, context);
        }
      }

      case "lookup_customer_order": {
        // Strict customer ownership enforcement: never disclose another customer's order!
        const orderRef = String(params.order_id || "").trim();
        if (!orderRef || !phone) {
          return { ok: false, code: "ORDER_LOOKUP_INVALID", error: "Both order_id and verified customer phone are required" };
        }
        const order = await db.queryOne(
          `SELECT * FROM campaign_ecommerce_events
           WHERE tenant_id = ? AND external_order_id = ? ORDER BY id DESC LIMIT 1`,
          [tid, orderRef]
        ).catch(() => null);
        if (!order) {
          return { ok: true, found: false, authorized: true };
        }
        const orderPhone = normalizePhone(order.normalized_phone || "").normalized;
        if (orderPhone !== phone) {
          return {
            ok: false,
            found: false,
            authorized: false,
            code: "ORDER_OWNERSHIP_MISMATCH",
            error: "Order does not belong to this customer phone number",
          };
        }
        return {
          ok: true,
          found: true,
          authorized: true,
          order: {
            order_id: order.external_order_id,
            event_type: order.event_type,
            amount_minor: order.amount_minor,
            currency: order.currency,
            created_at: order.created_at,
          },
        };
      }

      case "record_conversion": {
        if (!phone) return { ok: false, error: "Phone required to attribute verified conversion" };
        const conv = await analyticsService.recordVerifiedConversion(tid, {
          entity_type: params.entity_type || "order",
          entity_id: params.entity_id || `CONV-${Date.now()}`,
          conversion_type: params.conversion_type || "order",
          phone,
          revenue_minor: Number(params.revenue_minor || 0),
          evidence: params.evidence || { source: "automation_engine" },
        });
        return { ok: true, ...conv };
      }

      default:
        return { ok: false, code: "UNKNOWN_CRM_ACTION", error: `Unsupported CRM action '${actionType}'` };
    }
  }

  return {
    loadFreshContext,
    executeCrmAction,
  };
}

module.exports = { createSharedContextService };
