"use strict";

const { createDbHelper, assertTenantId, safeJsonParse } = require("./dbHelper");

function createCampaignAuditService(options = {}) {
  const db = createDbHelper(options.db);

  async function log(tenantId, {
    workspaceId = null,
    campaignId = null,
    entityType = "campaign",
    entityId = null,
    action,
    actorId = null,
    actorRole = null,
    before = null,
    after = null,
    metadata = null,
  }) {
    const tid = assertTenantId(tenantId);
    const res = await db.query(
      `INSERT INTO campaign_audit_logs (
        tenant_id, workspace_id, campaign_id, entity_type, entity_id,
        action, actor_id, actor_role, before_json, after_json, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tid,
        workspaceId,
        campaignId,
        entityType,
        entityId !== null && entityId !== undefined ? String(entityId) : null,
        String(action),
        actorId,
        actorRole,
        before ? JSON.stringify(before) : null,
        after ? JSON.stringify(after) : null,
        metadata ? JSON.stringify(metadata) : null,
      ]
    );
    return { id: res.insertId };
  }

  async function recordPolicyDecision(tenantId, { campaignId, policyName, outcome, details = null, actorId = null }) {
    const tid = assertTenantId(tenantId);
    const res = await db.query(
      `INSERT INTO campaign_policy_decisions (tenant_id, campaign_id, policy_name, outcome, details_json, evaluated_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [tid, campaignId, policyName, outcome, details ? JSON.stringify(details) : null, actorId]
    );
    return { id: res.insertId };
  }

  async function listLogs(tenantId, { campaignId = null, entityType = null, limit = 100 } = {}) {
    const tid = assertTenantId(tenantId);
    const clauses = ["tenant_id = ?"];
    const params = [tid];
    if (campaignId) {
      clauses.push("campaign_id = ?");
      params.push(Number(campaignId));
    }
    if (entityType) {
      clauses.push("entity_type = ?");
      params.push(entityType);
    }
    params.push(Math.min(500, Number(limit) || 100));
    const rows = await db.query(
      `SELECT * FROM campaign_audit_logs WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC LIMIT ?`,
      params
    );
    return rows.map((r) => ({
      ...r,
      before: safeJsonParse(r.before_json, null),
      after: safeJsonParse(r.after_json, null),
      metadata: safeJsonParse(r.metadata_json, null),
    }));
  }

  return { log, recordPolicyDecision, listLogs };
}

module.exports = { createCampaignAuditService };
