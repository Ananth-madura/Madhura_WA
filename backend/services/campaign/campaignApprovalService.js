"use strict";

/**
 * campaignApprovalService.js
 *
 * Enterprise multi-stage campaign approval workflows with:
 * - Configurable approval rules (recipient thresholds, estimated cost, category, workspace)
 * - Four-eyes maker-checker control (creator cannot approve own high-risk campaign)
 * - Approve, Reject, Request Changes, Escalate, Withdraw actions
 * - Full decision history & automatic invalidation when critical campaign attributes change
 */

const { createDbHelper, assertTenantId, safeJsonParse, httpError } = require("./dbHelper");
const { createCampaignAuditService } = require("./campaignAuditService");

function createCampaignApprovalService(options = {}) {
  const db = createDbHelper(options.db);
  const audit = options.auditService || createCampaignAuditService({ db: options.db });

  async function evaluateRequiredStages(tenantId, campaign) {
    const tid = assertTenantId(tenantId);
    const rules = await db.query(
      `SELECT * FROM campaign_approval_rules WHERE tenant_id = ? AND is_active = 1 ORDER BY priority ASC`,
      [tid]
    );

    const stages = [];
    let requireFourEyes = false;

    for (const rule of rules) {
      const cond = safeJsonParse(rule.condition_json, {});
      let matches = true;
      if (cond.min_recipients && Number(campaign.total_eligible || 0) < Number(cond.min_recipients)) matches = false;
      if (cond.min_cost_minor && Number(campaign.estimated_cost_minor || 0) < Number(cond.min_cost_minor)) matches = false;
      if (cond.category && String(campaign.category || "").toUpperCase() !== String(cond.category).toUpperCase()) matches = false;
      if (cond.campaign_type && String(campaign.campaign_type || "") !== String(cond.campaign_type)) matches = false;

      if (matches) {
        const ruleStages = safeJsonParse(rule.stages_json, []);
        for (const s of ruleStages) {
          stages.push({
            stage_name: s.stage_name || "marketing_approval",
            required_role: s.required_role || "organization_admin",
          });
        }
        if (rule.require_four_eyes) requireFourEyes = true;
      }
    }

    // Fallback default governance check via campaign_settings
    if (stages.length === 0) {
      const settings = await db.queryOne(
        `SELECT * FROM campaign_settings WHERE tenant_id = ? AND campaign_id IS NULL ORDER BY id DESC LIMIT 1`,
        [tid]
      );
      const recipThresh = Number(settings?.approval_threshold_recipients || 1000);
      const costThresh = Number(settings?.approval_threshold_cost_minor || 50000);
      if (
        Number(campaign.total_eligible || 0) >= recipThresh ||
        Number(campaign.estimated_cost_minor || 0) >= costThresh ||
        Number(settings?.require_four_eyes_approval || 0) === 1
      ) {
        stages.push({ stage_name: "compliance_and_marketing_review", required_role: "organization_admin" });
        if (Number(campaign.estimated_cost_minor || 0) >= costThresh) {
          stages.push({ stage_name: "finance_approval", required_role: "finance_approver" });
        }
        requireFourEyes = Boolean(settings?.require_four_eyes_approval ?? true);
      }
    }

    return { required: stages.length > 0, stages, requireFourEyes };
  }

  async function submitForApproval(tenantId, campaignId, actorId, { stagesOverride = null, requireFourEyesOverride = null } = {}) {
    const tid = assertTenantId(tenantId);
    const campaign = await db.queryOne(
      `SELECT * FROM campaigns WHERE tenant_id = ? AND id = ? LIMIT 1`,
      [tid, Number(campaignId)]
    );
    if (!campaign) throw httpError("Campaign not found", 404, "CAMPAIGN_NOT_FOUND");
    if (!["DRAFT", "CHANGES_REQUESTED", "REJECTED"].includes(campaign.status)) {
      throw httpError(`Campaign in status '${campaign.status}' cannot be submitted for approval`, 409, "INVALID_APPROVAL_STATE");
    }

    const evalRes = await evaluateRequiredStages(tid, campaign);
    const stages = Array.isArray(stagesOverride) && stagesOverride.length
      ? stagesOverride
      : evalRes.stages.length
      ? evalRes.stages
      : [{ stage_name: "marketing_approval", required_role: "organization_admin" }];
    const fourEyes = requireFourEyesOverride !== null ? Boolean(requireFourEyesOverride) : evalRes.requireFourEyes;

    // Supersede any old pending approval records for older versions
    await db.query(
      `UPDATE campaign_approvals SET status = 'SUPERSEDED', updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = ? AND campaign_id = ? AND status = 'PENDING'`,
      [tid, campaign.id]
    );

    const createdApprovals = [];
    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      const status = i === 0 ? "PENDING" : "QUEUED";
      const res = await db.query(
        `INSERT INTO campaign_approvals (
          tenant_id, workspace_id, campaign_id, campaign_version, stage_index,
          stage_name, required_role, status, requested_by, require_four_eyes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tid,
          campaign.workspace_id,
          campaign.id,
          campaign.current_version,
          i,
          stage.stage_name,
          stage.required_role || "organization_admin",
          status,
          actorId,
          fourEyes ? 1 : 0,
        ]
      );
      createdApprovals.push({ id: res.insertId, stage_index: i, stage_name: stage.stage_name, status });
    }

    await db.query(
      `UPDATE campaigns
       SET status = 'PENDING_APPROVAL', approval_status = 'pending', updated_by = ?, updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = ? AND id = ?`,
      [actorId, tid, campaign.id]
    );

    await db.query(
      `INSERT INTO campaign_approval_events (tenant_id, campaign_id, approval_id, campaign_version, actor_id, action, note)
       VALUES (?, ?, ?, ?, ?, 'SUBMITTED', ?)`,
      [tid, campaign.id, createdApprovals[0].id, campaign.current_version, actorId, `Submitted version ${campaign.current_version} for approval`]
    );

    await audit.log(tid, {
      workspaceId: campaign.workspace_id,
      campaignId: campaign.id,
      entityType: "campaign_approval",
      entityId: createdApprovals[0].id,
      action: "SUBMIT_FOR_APPROVAL",
      actorId,
      after: { stages: createdApprovals, four_eyes: fourEyes },
    });

    return {
      campaign_id: campaign.id,
      campaign_version: campaign.current_version,
      status: "PENDING_APPROVAL",
      require_four_eyes: fourEyes,
      stages: createdApprovals,
    };
  }

  async function decideApproval(tenantId, campaignId, { action, actorId, actorRole = null, reason = null }) {
    const tid = assertTenantId(tenantId);
    const normalizedAction = String(action || "").toUpperCase();
    if (!["APPROVE", "REJECT", "REQUEST_CHANGES", "ESCALATE", "WITHDRAW"].includes(normalizedAction)) {
      throw httpError(`Unsupported approval action: ${action}`, 400, "INVALID_APPROVAL_ACTION");
    }

    const campaign = await db.queryOne(`SELECT * FROM campaigns WHERE tenant_id = ? AND id = ? LIMIT 1`, [tid, Number(campaignId)]);
    if (!campaign) throw httpError("Campaign not found", 404, "CAMPAIGN_NOT_FOUND");

    const pending = await db.queryOne(
      `SELECT * FROM campaign_approvals
       WHERE tenant_id = ? AND campaign_id = ? AND campaign_version = ? AND status = 'PENDING'
       ORDER BY stage_index ASC LIMIT 1`,
      [tid, campaign.id, campaign.current_version]
    );
    if (!pending) {
      throw httpError("No pending approval stage found for current campaign version", 409, "NO_PENDING_APPROVAL");
    }

    // Four-eyes maker-checker check
    if (
      normalizedAction === "APPROVE" &&
      Number(pending.require_four_eyes) === 1 &&
      (Number(pending.requested_by) === Number(actorId) || Number(campaign.created_by) === Number(actorId))
    ) {
      throw httpError(
        "Four-eyes maker-checker policy: campaign creator/submitter cannot approve their own campaign",
        403,
        "FOUR_EYES_VIOLATION"
      );
    }

    if (normalizedAction === "WITHDRAW") {
      await db.query(
        `UPDATE campaign_approvals SET status = 'WITHDRAWN', decided_by = ?, decision_reason = ?, decided_at = CURRENT_TIMESTAMP
         WHERE tenant_id = ? AND campaign_id = ? AND campaign_version = ? AND status IN ('PENDING','QUEUED')`,
        [actorId, reason || "Withdrawn by requester", tid, campaign.id, campaign.current_version]
      );
      await db.query(
        `UPDATE campaigns SET status = 'DRAFT', approval_status = 'withdrawn', updated_by = ?, updated_at = CURRENT_TIMESTAMP
         WHERE tenant_id = ? AND id = ?`,
        [actorId, tid, campaign.id]
      );
    } else if (normalizedAction === "REJECT") {
      await db.query(
        `UPDATE campaign_approvals SET status = 'REJECTED', decided_by = ?, decision_reason = ?, decided_at = CURRENT_TIMESTAMP
         WHERE id = ? AND tenant_id = ?`,
        [actorId, reason || "Rejected", pending.id, tid]
      );
      await db.query(
        `UPDATE campaign_approvals SET status = 'CANCELLED' WHERE tenant_id = ? AND campaign_id = ? AND campaign_version = ? AND status = 'QUEUED'`,
        [tid, campaign.id, campaign.current_version]
      );
      await db.query(
        `UPDATE campaigns SET status = 'REJECTED', approval_status = 'rejected', updated_by = ?, updated_at = CURRENT_TIMESTAMP
         WHERE tenant_id = ? AND id = ?`,
        [actorId, tid, campaign.id]
      );
    } else if (normalizedAction === "REQUEST_CHANGES") {
      await db.query(
        `UPDATE campaign_approvals SET status = 'CHANGES_REQUESTED', decided_by = ?, decision_reason = ?, decided_at = CURRENT_TIMESTAMP
         WHERE id = ? AND tenant_id = ?`,
        [actorId, reason || "Changes requested", pending.id, tid]
      );
      await db.query(
        `UPDATE campaigns SET status = 'DRAFT', approval_status = 'changes_requested', updated_by = ?, updated_at = CURRENT_TIMESTAMP
         WHERE tenant_id = ? AND id = ?`,
        [actorId, tid, campaign.id]
      );
    } else if (normalizedAction === "ESCALATE") {
      await db.query(
        `UPDATE campaign_approvals SET required_role = 'organization_owner', decision_reason = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND tenant_id = ?`,
        [reason || "Escalated to owner", pending.id, tid]
      );
    } else if (normalizedAction === "APPROVE") {
      await db.query(
        `UPDATE campaign_approvals SET status = 'APPROVED', decided_by = ?, decision_reason = ?, decided_at = CURRENT_TIMESTAMP
         WHERE id = ? AND tenant_id = ?`,
        [actorId, reason || "Approved", pending.id, tid]
      );

      // Advance to next queued stage or mark fully approved
      const nextStage = await db.queryOne(
        `SELECT * FROM campaign_approvals
         WHERE tenant_id = ? AND campaign_id = ? AND campaign_version = ? AND status = 'QUEUED'
         ORDER BY stage_index ASC LIMIT 1`,
        [tid, campaign.id, campaign.current_version]
      );

      if (nextStage) {
        await db.query(
          `UPDATE campaign_approvals SET status = 'PENDING', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [nextStage.id]
        );
      } else {
        await db.query(
          `UPDATE campaigns
           SET status = 'APPROVED', approval_status = 'approved', approved_version = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
           WHERE tenant_id = ? AND id = ?`,
          [campaign.current_version, actorId, tid, campaign.id]
        );
      }
    }

    await db.query(
      `INSERT INTO campaign_approval_events (tenant_id, campaign_id, approval_id, campaign_version, actor_id, action, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [tid, campaign.id, pending.id, campaign.current_version, actorId, normalizedAction, reason]
    );

    await audit.log(tid, {
      workspaceId: campaign.workspace_id,
      campaignId: campaign.id,
      entityType: "campaign_approval",
      entityId: pending.id,
      action: `APPROVAL_${normalizedAction}`,
      actorId,
      actorRole,
      metadata: { stage: pending.stage_name, reason, version: campaign.current_version },
    });

    const refreshed = await db.queryOne(`SELECT * FROM campaigns WHERE tenant_id = ? AND id = ?`, [tid, campaign.id]);
    const allStages = await db.query(
      `SELECT * FROM campaign_approvals WHERE tenant_id = ? AND campaign_id = ? AND campaign_version = ? ORDER BY stage_index ASC`,
      [tid, campaign.id, campaign.current_version]
    );
    return { campaign_status: refreshed.status, approval_status: refreshed.approval_status, approved_version: refreshed.approved_version, stages: allStages };
  }

  async function invalidateApproval(tenantId, campaignId, reason, actorId = null) {
    const tid = assertTenantId(tenantId);
    await db.query(
      `UPDATE campaign_approvals
       SET status = 'INVALIDATED', invalidated_reason = ?, updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = ? AND campaign_id = ? AND status IN ('PENDING','QUEUED','APPROVED')`,
      [reason, tid, Number(campaignId)]
    );
    await db.query(
      `UPDATE campaigns
       SET approval_status = 'invalidated', approved_version = NULL,
           status = CASE WHEN status IN ('APPROVED','PENDING_APPROVAL','SCHEDULED') THEN 'DRAFT' ELSE status END,
           updated_by = ?, updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = ? AND id = ?`,
      [actorId, tid, Number(campaignId)]
    );
  }

  async function listApprovalQueue(tenantId, { status = "PENDING" } = {}) {
    const tid = assertTenantId(tenantId);
    const clauses = ["a.tenant_id = ?"];
    const params = [tid];
    if (status && status !== "ALL") {
      clauses.push("a.status = ?");
      params.push(status);
    }
    return db.query(
      `SELECT a.*, c.name AS campaign_name, c.campaign_type, c.category, c.total_eligible,
              c.estimated_cost_minor, c.currency, c.status AS campaign_status, c.owner_id
       FROM campaign_approvals a
       JOIN campaigns c ON c.id = a.campaign_id AND c.tenant_id = a.tenant_id
       WHERE ${clauses.join(" AND ")}
       ORDER BY a.created_at DESC LIMIT 200`,
      params
    );
  }

  async function createRule(tenantId, input = {}, actorId = null) {
    const tid = assertTenantId(tenantId);
    const res = await db.query(
      `INSERT INTO campaign_approval_rules (
        tenant_id, workspace_id, name, condition_json, stages_json, require_four_eyes, priority, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tid,
        input.workspace_id || null,
        String(input.name || "Enterprise Approval Rule"),
        JSON.stringify(input.condition || {}),
        JSON.stringify(input.stages || [{ stage_name: "marketing_approval", required_role: "organization_admin" }]),
        input.require_four_eyes === false ? 0 : 1,
        Number(input.priority || 10),
        actorId,
      ]
    );
    return db.queryOne(`SELECT * FROM campaign_approval_rules WHERE id = ?`, [res.insertId]);
  }

  return {
    evaluateRequiredStages,
    submitForApproval,
    decideApproval,
    invalidateApproval,
    listApprovalQueue,
    createRule,
  };
}

module.exports = { createCampaignApprovalService };
