"use strict";

/**
 * dripSequenceService.js
 *
 * Multi-Step Drip Campaign & Sequence Engine:
 *   - Supports step types: template, free_form, interactive, whatsapp_flow,
 *     flowbot, automation, delay, condition, human_handover, end.
 *   - Durable wait states persisted in `drip_sequence_enrollments.next_run_at`.
 *   - Configurable stop conditions: reply (stop OR route to Flowbot/Inbox),
 *     opt_out, purchase, deal_won, payment_succeeded, human_support, suppressed,
 *     campaign_cancelled, expired.
 *   - Step-level funnel analytics: enrolled, reached, submitted, delivered,
 *     read, replied, failed, exited, converted, revenue_minor.
 */

const {
  createDbHelper,
  assertTenantId,
  normalizePhone,
  safeJsonParse,
  httpError,
  generateUid,
} = require("../dbHelper");
const { createConsentSuppressionService } = require("../consentSuppressionService");
const { createServiceWindowService } = require("../../orchestration/serviceWindowService");
const { evaluateConditionGroup } = require("../../orchestration/conditionEvaluator");

const DEFAULT_STOP_CONDITIONS = ["opt_out", "purchase", "suppressed", "campaign_cancelled", "expired"];

function computeDelayMs(step = {}) {
  const unit = String(step.unit || step.delay_unit || "hours").toLowerCase();
  const amount = Math.max(0, Number(step.amount ?? step.delay_value ?? 1));
  const mult = { seconds: 1000, minutes: 60000, hours: 3600000, days: 86400000 }[unit] || 3600000;
  return Math.max(1000, amount * mult);
}

function createDripSequenceService(options = {}) {
  const db = createDbHelper(options.db);
  const consentService = options.consentService || createConsentSuppressionService({ db: options.db });
  const serviceWindow = options.serviceWindow || createServiceWindowService({ db: options.db, consentService });
  const messageDispatcher = options.messageDispatcher || null;

  async function createSequence(tenantId, input = {}, actorId = null) {
    const tid = assertTenantId(tenantId);
    const name = String(input.name || "").trim();
    if (!name) throw httpError("Drip sequence name is required", 400, "SEQUENCE_NAME_REQUIRED");
    const steps = Array.isArray(input.steps) ? input.steps : [];
    if (steps.length === 0) throw httpError("At least one sequence step is required", 400, "SEQUENCE_STEPS_REQUIRED");

    const uid = generateUid("drip");
    const res = await db.query(
      `INSERT INTO drip_sequences
       (sequence_uid, tenant_id, workspace_id, name, description, status, current_version,
        sender_id, waba_id, group_id, segment_id, steps_json, schedule_config_json,
        stop_conditions_json, reply_behavior, reply_flowbot_id, expires_at, created_by)
       VALUES (?, ?, ?, ?, ?, 'DRAFT', 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uid,
        tid,
        input.workspace_id || null,
        name,
        input.description || null,
        input.sender_id || null,
        input.waba_id || null,
        input.group_id || null,
        input.segment_id || null,
        JSON.stringify(steps),
        JSON.stringify(input.schedule_config || { business_hours_only: false, timezone: "Asia/Kolkata" }),
        JSON.stringify(Array.isArray(input.stop_conditions) ? input.stop_conditions : DEFAULT_STOP_CONDITIONS),
        input.reply_behavior || "stop", // stop | route_flowbot | route_inbox | continue
        input.reply_flowbot_id || null,
        input.expires_at || null,
        actorId || null,
      ]
    );
    return getSequence(tid, res.insertId);
  }

  async function getSequence(tenantId, sequenceId) {
    const tid = assertTenantId(tenantId);
    const row = await db.queryOne(`SELECT * FROM drip_sequences WHERE tenant_id = ? AND id = ? LIMIT 1`, [tid, Number(sequenceId)]);
    if (!row) throw httpError("Drip sequence not found", 404, "SEQUENCE_NOT_FOUND");
    const metrics = await getSequenceStepAnalytics(tid, row.id);
    return {
      ...row,
      steps: safeJsonParse(row.steps_json, []),
      schedule_config: safeJsonParse(row.schedule_config_json, {}),
      stop_conditions: safeJsonParse(row.stop_conditions_json, DEFAULT_STOP_CONDITIONS),
      analytics: metrics,
    };
  }

  async function listSequences(tenantId) {
    const tid = assertTenantId(tenantId);
    const rows = await db.query(
      `SELECT s.*,
              (SELECT COUNT(*) FROM drip_sequence_enrollments e WHERE e.sequence_id = s.id AND e.tenant_id = s.tenant_id) AS enrolled_count,
              (SELECT COUNT(*) FROM drip_sequence_enrollments e WHERE e.sequence_id = s.id AND e.tenant_id = s.tenant_id AND e.status IN ('ACTIVE','WAITING_DELAY')) AS active_enrollments,
              (SELECT COUNT(*) FROM drip_sequence_enrollments e WHERE e.sequence_id = s.id AND e.tenant_id = s.tenant_id AND e.status = 'COMPLETED') AS completed_enrollments,
              (SELECT COUNT(*) FROM drip_sequence_enrollments e WHERE e.sequence_id = s.id AND e.tenant_id = s.tenant_id AND e.converted = 1) AS converted_count
       FROM drip_sequences s WHERE s.tenant_id = ? ORDER BY s.updated_at DESC LIMIT 100`,
      [tid]
    );
    return rows.map((r) => ({
      ...r,
      steps: safeJsonParse(r.steps_json, []),
      stop_conditions: safeJsonParse(r.stop_conditions_json, DEFAULT_STOP_CONDITIONS),
    }));
  }

  async function setSequenceStatus(tenantId, sequenceId, nextStatus) {
    const tid = assertTenantId(tenantId);
    const allowed = ["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"];
    const st = String(nextStatus || "").toUpperCase();
    if (!allowed.includes(st)) throw httpError("Invalid sequence status", 400, "INVALID_STATUS");
    const seq = await getSequence(tid, sequenceId);
    await db.query(`UPDATE drip_sequences SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?`, [st, tid, seq.id]);
    if (st === "CANCELLED") {
      await db.query(
        `UPDATE drip_sequence_enrollments SET status = 'EXITED', exit_reason = 'campaign_cancelled', completed_at = CURRENT_TIMESTAMP
         WHERE tenant_id = ? AND sequence_id = ? AND status IN ('ACTIVE','WAITING_DELAY')`,
        [tid, seq.id]
      );
    }
    return getSequence(tid, seq.id);
  }

  async function duplicateSequence(tenantId, sequenceId, actorId = null) {
    const seq = await getSequence(tenantId, sequenceId);
    return createSequence(tenantId, {
      ...seq,
      name: `${seq.name} (Copy)`,
      steps: seq.steps,
      schedule_config: seq.schedule_config,
      stop_conditions: seq.stop_conditions,
    }, actorId);
  }

  async function enrollContacts(tenantId, sequenceId, contacts = [], { startImmediately = true } = {}) {
    const tid = assertTenantId(tenantId);
    const seq = await getSequence(tid, sequenceId);
    if (!["ACTIVE", "DRAFT"].includes(seq.status)) {
      throw httpError(`Cannot enroll contacts into sequence in status '${seq.status}'`, 409, "SEQUENCE_NOT_ENROLLABLE");
    }
    if (seq.status === "DRAFT") {
      await db.query(`UPDATE drip_sequences SET status = 'ACTIVE', updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?`, [tid, seq.id]);
    }

    const enrolled = [];
    const skipped = [];
    for (const c of contacts) {
      const norm = normalizePhone(c.phone);
      if (!norm.valid) {
        skipped.push({ phone: c.phone, reason: "INVALID_PHONE" });
        continue;
      }
      const consent = await consentService.checkConsent(tid, norm.normalized, { category: "MARKETING" });
      if (!consent.eligible) {
        skipped.push({ phone: norm.normalized, reason: consent.code });
        continue;
      }
      const existing = await db.queryOne(
        `SELECT id FROM drip_sequence_enrollments
         WHERE tenant_id = ? AND sequence_id = ? AND normalized_phone = ? AND status IN ('ACTIVE','WAITING_DELAY') LIMIT 1`,
        [tid, seq.id, norm.normalized]
      );
      if (existing) {
        skipped.push({ phone: norm.normalized, reason: "ALREADY_ENROLLED" });
        continue;
      }

      const res = await db.query(
        `INSERT INTO drip_sequence_enrollments
         (tenant_id, sequence_id, sequence_version, contact_id, normalized_phone, contact_name, status, current_step_index, next_run_at, state_json)
         VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', 0, ?, ?)`,
        [tid, seq.id, seq.current_version, c.contact_id || null, norm.normalized, c.name || "", new Date().toISOString(), JSON.stringify(c.vars || {})]
      );
      const enr = await db.queryOne(`SELECT * FROM drip_sequence_enrollments WHERE id = ?`, [res.insertId]);
      if (startImmediately) {
        await advanceEnrollment(tid, seq, enr);
      }
      enrolled.push({ enrollment_id: res.insertId, phone: norm.normalized });
    }

    return { sequence_id: seq.id, enrolled_count: enrolled.length, skipped_count: skipped.length, enrolled, skipped };
  }

  async function logStep(tenantId, sequenceId, enrollmentId, stepIndex, stepType, status, extra = {}) {
    await db.query(
      `INSERT INTO drip_sequence_step_logs
       (tenant_id, sequence_id, enrollment_id, step_index, step_type, status, wamid, error_code, error_message, payload_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        sequenceId,
        enrollmentId,
        stepIndex,
        stepType,
        status,
        extra.wamid || null,
        extra.errorCode || null,
        extra.errorMessage || null,
        extra.payload ? JSON.stringify(extra.payload) : null,
      ]
    );
  }

  async function advanceEnrollment(tenantId, seq, enrollmentRow) {
    const tid = assertTenantId(tenantId);
    const steps = Array.isArray(seq.steps) ? seq.steps : safeJsonParse(seq.steps_json, []);
    let idx = Number(enrollmentRow.current_step_index || 0);
    let stateVars = safeJsonParse(enrollmentRow.state_json, {});

    // Check sequence expiration
    if (seq.expires_at && new Date(seq.expires_at).getTime() <= Date.now()) {
      await db.query(
        `UPDATE drip_sequence_enrollments SET status = 'EXITED', exit_reason = 'expired', completed_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [enrollmentRow.id]
      );
      await logStep(tid, seq.id, enrollmentRow.id, idx, "expiration", "EXITED");
      return { status: "EXITED", exit_reason: "expired" };
    }

    while (idx < steps.length) {
      const step = steps[idx];
      const stType = String(step.type || "template").toLowerCase();

      // Always re-verify consent/suppression before any outbound message step
      if (["template", "free_form", "interactive", "whatsapp_flow"].includes(stType)) {
        const elig = await serviceWindow.checkOutboundEligibility(tid, {
          senderId: seq.sender_id,
          phone: enrollmentRow.normalized_phone,
          messageType: stType === "template" ? "template" : stType === "whatsapp_flow" ? "whatsapp_flow" : "text",
          templateId: step.template_id || null,
          category: step.category || (stType === "template" ? "MARKETING" : "SERVICE"),
        });
        if (!elig.eligible) {
          const isSup = elig.code === "BLOCKED_BY_SUPPRESSION";
          await logStep(tid, seq.id, enrollmentRow.id, idx, stType, isSup ? "EXITED" : "FAILED", {
            errorCode: elig.code,
            errorMessage: elig.reason,
          });
          await db.query(
            `UPDATE drip_sequence_enrollments SET status = ?, exit_reason = ?, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [isSup ? "EXITED" : "FAILED", elig.code, enrollmentRow.id]
          );
          return { status: isSup ? "EXITED" : "FAILED", reason: elig.code };
        }

        let wamid = `drip_${seq.id}_${enrollmentRow.id}_${idx}`;
        if (messageDispatcher && typeof messageDispatcher.send === "function") {
          const sent = await messageDispatcher.send(tid, {
            sender_id: seq.sender_id,
            phone: enrollmentRow.normalized_phone,
            message_type: stType,
            template_id: step.template_id || null,
            text: step.text || "",
          });
          if (sent?.message_id) wamid = sent.message_id;
        }
        await logStep(tid, seq.id, enrollmentRow.id, idx, stType, "SUBMITTED", { wamid });
        idx++;
        await db.query(
          `UPDATE drip_sequence_enrollments SET current_step_index = ?, last_wamid = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [idx, wamid, enrollmentRow.id]
        );
        continue;
      }

      if (stType === "delay") {
        const resumeAt = step.specific_date
          ? new Date(step.specific_date).toISOString()
          : new Date(Date.now() + computeDelayMs(step)).toISOString();
        await logStep(tid, seq.id, enrollmentRow.id, idx, "delay", "WAITING_DELAY", { payload: { resume_at: resumeAt } });
        idx++;
        await db.query(
          `UPDATE drip_sequence_enrollments SET status = 'WAITING_DELAY', current_step_index = ?, next_run_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [idx, resumeAt, enrollmentRow.id]
        );
        return { status: "WAITING_DELAY", next_run_at: resumeAt, next_step_index: idx };
      }

      if (stType === "condition") {
        const ok = evaluateConditionGroup(step.condition || step, { vars: stateVars, contact: { phone: enrollmentRow.normalized_phone, name: enrollmentRow.contact_name } });
        await logStep(tid, seq.id, enrollmentRow.id, idx, "condition", ok ? "REACHED" : "EXITED", { payload: { matched: ok } });
        if (!ok && step.stop_on_false !== false) {
          await db.query(
            `UPDATE drip_sequence_enrollments SET status = 'EXITED', exit_reason = 'condition_not_met', completed_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [enrollmentRow.id]
          );
          return { status: "EXITED", exit_reason: "condition_not_met" };
        }
        idx++;
        continue;
      }

      if (stType === "end") {
        await logStep(tid, seq.id, enrollmentRow.id, idx, "end", "COMPLETED");
        break;
      }

      // flowbot / automation / human_handover steps logged cleanly and advance
      await logStep(tid, seq.id, enrollmentRow.id, idx, stType, "REACHED", { payload: step });
      idx++;
    }

    await db.query(
      `UPDATE drip_sequence_enrollments SET status = 'COMPLETED', current_step_index = ?, next_run_at = NULL, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [idx, enrollmentRow.id]
    );
    return { status: "COMPLETED", current_step_index: idx };
  }

  async function processDueEnrollments(nowIso = new Date().toISOString()) {
    const due = await db.query(
      `SELECT e.*
       FROM drip_sequence_enrollments e
       JOIN drip_sequences s ON s.id = e.sequence_id AND s.tenant_id = e.tenant_id
       WHERE s.status = 'ACTIVE' AND e.status = 'WAITING_DELAY' AND e.next_run_at IS NOT NULL AND e.next_run_at <= ?
       ORDER BY e.next_run_at ASC LIMIT 100`,
      [nowIso]
    );
    let processed = 0;
    for (const enr of due) {
      const seq = await getSequence(enr.tenant_id, enr.sequence_id);
      await db.query(`UPDATE drip_sequence_enrollments SET status = 'ACTIVE', next_run_at = NULL WHERE id = ?`, [enr.id]);
      await advanceEnrollment(enr.tenant_id, seq, { ...enr, status: "ACTIVE" });
      processed++;
    }
    return { processed };
  }

  /**
   * Handles stop-condition events (purchase, opt_out, reply, deal_won, payment_succeeded, human_support).
   * Respects sequence `reply_behavior` so a customer reply can route to Flowbot or Team Inbox instead of always stopping!
   */
  async function handleStopEvent(tenantId, phone, eventType, { revenueMinor = 0 } = {}) {
    const tid = assertTenantId(tenantId);
    const norm = normalizePhone(phone);
    if (!norm.valid) return { stopped: 0, routed_to_flowbot: 0 };

    const active = await db.query(
      `SELECT e.*, s.stop_conditions_json, s.reply_behavior, s.reply_flowbot_id
       FROM drip_sequence_enrollments e
       JOIN drip_sequences s ON s.id = e.sequence_id AND s.tenant_id = e.tenant_id
       WHERE e.tenant_id = ? AND e.normalized_phone = ? AND e.status IN ('ACTIVE','WAITING_DELAY')`,
      [tid, norm.normalized]
    );

    let stopped = 0;
    let routedToFlowbot = 0;

    for (const row of active) {
      const stopConds = safeJsonParse(row.stop_conditions_json, DEFAULT_STOP_CONDITIONS);
      const ev = String(eventType || "").toLowerCase();

      if (ev === "reply" && row.reply_behavior === "route_flowbot") {
        routedToFlowbot++;
        await logStep(tid, row.sequence_id, row.id, row.current_step_index, "reply_routing", "REPLIED", {
          payload: { routed_flowbot_id: row.reply_flowbot_id },
        });
        continue;
      }

      if (ev === "opt_out" || ev === "suppressed" || stopConds.includes(ev)) {
        const isConversion = ["purchase", "deal_won", "payment_succeeded"].includes(ev);
        await db.query(
          `UPDATE drip_sequence_enrollments
           SET status = 'EXITED', exit_reason = ?, converted = ?, revenue_minor = revenue_minor + ?,
               next_run_at = NULL, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [ev, isConversion ? 1 : row.converted, isConversion ? Number(revenueMinor || 0) : 0, row.id]
        );
        await logStep(tid, row.sequence_id, row.id, row.current_step_index, "stop_condition", isConversion ? "CONVERTED" : "EXITED", {
          payload: { reason: ev, revenue_minor: revenueMinor },
        });
        stopped++;
      }
    }

    return { stopped, routed_to_flowbot: routedToFlowbot };
  }

  async function getSequenceStepAnalytics(tenantId, sequenceId) {
    const tid = assertTenantId(tenantId);
    const [totals, byStep] = await Promise.all([
      db.queryOne(
        `SELECT COUNT(*) AS enrolled,
                SUM(CASE WHEN status IN ('ACTIVE','WAITING_DELAY') THEN 1 ELSE 0 END) AS active,
                SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed,
                SUM(CASE WHEN status = 'EXITED' THEN 1 ELSE 0 END) AS exited,
                SUM(CASE WHEN converted = 1 THEN 1 ELSE 0 END) AS converted,
                COALESCE(SUM(revenue_minor), 0) AS revenue_minor
         FROM drip_sequence_enrollments WHERE tenant_id = ? AND sequence_id = ?`,
        [tid, Number(sequenceId)]
      ),
      db.query(
        `SELECT step_index, step_type,
                COUNT(*) AS reached,
                SUM(CASE WHEN status = 'SUBMITTED' THEN 1 ELSE 0 END) AS submitted,
                SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END) AS delivered,
                SUM(CASE WHEN status = 'READ' THEN 1 ELSE 0 END) AS read_count,
                SUM(CASE WHEN status = 'REPLIED' THEN 1 ELSE 0 END) AS replied,
                SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) AS failed,
                SUM(CASE WHEN status = 'EXITED' THEN 1 ELSE 0 END) AS exited,
                SUM(CASE WHEN status = 'CONVERTED' THEN 1 ELSE 0 END) AS converted
         FROM drip_sequence_step_logs
         WHERE tenant_id = ? AND sequence_id = ?
         GROUP BY step_index, step_type
         ORDER BY step_index ASC`,
        [tid, Number(sequenceId)]
      ),
    ]);
    return { totals: totals || {}, steps: byStep || [] };
  }

  return {
    createSequence,
    getSequence,
    listSequences,
    setSequenceStatus,
    duplicateSequence,
    enrollContacts,
    processDueEnrollments,
    handleStopEvent,
    getSequenceStepAnalytics,
  };
}

module.exports = { createDripSequenceService };
