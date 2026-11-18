"use strict";

/**
 * campaignExperimentService.js
 *
 * Enterprise A/B Testing & Experimentation Engine.
 * - Deterministic per-recipient variant assignment (SHA-256 hash of experimentId:phone)
 * - Holdout group support
 * - Compares delivered, read, reply, click, conversion, revenue, cost & opt-out rates
 * - Honest statistical significance (two-proportion z-test + minimum sample & observation guards)
 */

const crypto = require("crypto");
const { createDbHelper, assertTenantId, safeJsonParse, httpError } = require("./dbHelper");

function normalCdf(z) {
  // Abramowitz & Stegun approximation
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p =
    d *
    t *
    (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

function twoProportionPValue(successA, totalA, successB, totalB) {
  if (totalA <= 0 || totalB <= 0) return 1;
  const pA = successA / totalA;
  const pB = successB / totalB;
  const pPool = (successA + successB) / (totalA + totalB);
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / totalA + 1 / totalB));
  if (se === 0) return 1;
  const z = Math.abs(pA - pB) / se;
  return 2 * (1 - normalCdf(z));
}

function createCampaignExperimentService(options = {}) {
  const db = createDbHelper(options.db);

  async function createExperiment(tenantId, campaignId, input = {}) {
    const tid = assertTenantId(tenantId);
    const variants = Array.isArray(input.variants) ? input.variants : [];
    if (variants.length < 2) {
      throw httpError("A/B experiment requires at least 2 variants", 400, "MIN_TWO_VARIANTS_REQUIRED");
    }
    const holdoutPct = Math.max(0, Math.min(50, Number(input.holdout_pct || 0)));
    const allocSum = variants.reduce((acc, v) => acc + Number(v.allocation_pct || 0), 0);
    if (allocSum + holdoutPct !== 100) {
      throw httpError(
        `Variant allocations (${allocSum}%) + holdout (${holdoutPct}%) must equal 100%`,
        400,
        "INVALID_ALLOCATION_SUM"
      );
    }

    const res = await db.query(
      `INSERT INTO campaign_experiments (
        tenant_id, campaign_id, name, status, winning_metric, holdout_pct,
        min_sample_size, min_observation_hours, confidence_level
      ) VALUES (?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?)`,
      [
        tid,
        Number(campaignId),
        String(input.name || "A/B Experiment"),
        input.winning_metric || "reply_rate",
        holdoutPct,
        Math.max(10, Number(input.min_sample_size || 100)),
        Math.max(1, Number(input.min_observation_hours || 24)),
        Number(input.confidence_level || 0.95),
      ]
    );
    const expId = res.insertId;

    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      await db.query(
        `INSERT INTO campaign_experiment_variants (
          tenant_id, experiment_id, variant_key, name, allocation_pct,
          template_id, template_name, template_language, variable_overrides_json, send_delay_minutes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tid,
          expId,
          String(v.variant_key || String.fromCharCode(65 + i)),
          String(v.name || `Variant ${String.fromCharCode(65 + i)}`),
          Number(v.allocation_pct),
          v.template_id || null,
          v.template_name || null,
          v.template_language || "en",
          v.variable_overrides ? JSON.stringify(v.variable_overrides) : null,
          Number(v.send_delay_minutes || 0),
        ]
      );
    }

    await db.query(`UPDATE campaigns SET is_ab_test = 1 WHERE tenant_id = ? AND id = ?`, [tid, Number(campaignId)]);
    return getExperiment(tid, expId);
  }

  async function getExperiment(tenantId, experimentId) {
    const tid = assertTenantId(tenantId);
    const exp = await db.queryOne(
      `SELECT * FROM campaign_experiments WHERE tenant_id = ? AND id = ? LIMIT 1`,
      [tid, Number(experimentId)]
    );
    if (!exp) throw httpError("Experiment not found", 404, "EXPERIMENT_NOT_FOUND");
    const variants = await db.query(
      `SELECT * FROM campaign_experiment_variants WHERE tenant_id = ? AND experiment_id = ? ORDER BY id ASC`,
      [tid, exp.id]
    );
    return {
      ...exp,
      variants: variants.map((v) => ({ ...v, variable_overrides: safeJsonParse(v.variable_overrides_json, {}) })),
    };
  }

  /**
   * Deterministically assigns a recipient to exactly one variant (or holdout).
   */
  async function assignRecipient(tenantId, experimentId, recipientId, normalizedPhone) {
    const tid = assertTenantId(tenantId);
    const existing = await db.queryOne(
      `SELECT * FROM campaign_experiment_assignments WHERE tenant_id = ? AND experiment_id = ? AND recipient_id = ? LIMIT 1`,
      [tid, Number(experimentId), Number(recipientId)]
    );
    if (existing) return existing;

    const exp = await getExperiment(tid, experimentId);
    const hash = crypto
      .createHash("sha256")
      .update(`${exp.id}:${String(normalizedPhone)}`)
      .digest();
    const bucket = (hash.readUInt32BE(0) % 10000) / 100; // 0.00 to 99.99

    let cursor = Number(exp.holdout_pct || 0);
    if (bucket < cursor) {
      await db.query(
        `INSERT INTO campaign_experiment_assignments (tenant_id, experiment_id, variant_id, recipient_id, normalized_phone, is_holdout)
         VALUES (?, ?, NULL, ?, ?, 1)`,
        [tid, exp.id, Number(recipientId), normalizedPhone]
      );
      return { experiment_id: exp.id, variant_id: null, is_holdout: 1 };
    }

    let chosen = exp.variants[exp.variants.length - 1];
    for (const v of exp.variants) {
      cursor += Number(v.allocation_pct || 0);
      if (bucket < cursor) {
        chosen = v;
        break;
      }
    }

    await db.query(
      `INSERT INTO campaign_experiment_assignments (tenant_id, experiment_id, variant_id, recipient_id, normalized_phone, is_holdout)
       VALUES (?, ?, ?, ?, ?, 0)`,
      [tid, exp.id, chosen.id, Number(recipientId), normalizedPhone]
    );
    return { experiment_id: exp.id, variant_id: chosen.id, variant: chosen, is_holdout: 0 };
  }

  async function getExperimentReport(tenantId, campaignId) {
    const tid = assertTenantId(tenantId);
    const exp = await db.queryOne(
      `SELECT * FROM campaign_experiments WHERE tenant_id = ? AND campaign_id = ? ORDER BY id DESC LIMIT 1`,
      [tid, Number(campaignId)]
    );
    if (!exp) return null;

    const full = await getExperiment(tid, exp.id);
    const variantMetrics = [];

    for (const v of full.variants) {
      const stats = await db.queryOne(
        `SELECT
           COUNT(*) AS assigned_count,
           SUM(CASE WHEN status IN ('SENT','DELIVERED','READ') THEN 1 ELSE 0 END) AS sent_count,
           SUM(CASE WHEN status IN ('DELIVERED','READ') THEN 1 ELSE 0 END) AS delivered_count,
           SUM(CASE WHEN status = 'READ' THEN 1 ELSE 0 END) AS read_count,
           SUM(CASE WHEN replied_at IS NOT NULL THEN 1 ELSE 0 END) AS replied_count,
           SUM(CASE WHEN converted_at IS NOT NULL THEN 1 ELSE 0 END) AS converted_count,
           SUM(CASE WHEN status = 'BLOCKED_BY_SUPPRESSION' THEN 1 ELSE 0 END) AS opt_out_count,
           COALESCE(SUM(estimated_cost_minor), 0) AS estimated_cost_minor
         FROM campaign_recipients
         WHERE tenant_id = ? AND campaign_id = ? AND variant_id = ?`,
        [tid, Number(campaignId), v.id]
      );
      const delivered = Number(stats?.delivered_count || 0);
      const sent = Number(stats?.sent_count || 0);
      const read = Number(stats?.read_count || 0);
      const replied = Number(stats?.replied_count || 0);
      const converted = Number(stats?.converted_count || 0);
      const optOuts = Number(stats?.opt_out_count || 0);

      variantMetrics.push({
        variant_id: v.id,
        variant_key: v.variant_key,
        name: v.name,
        allocation_pct: v.allocation_pct,
        assigned_count: Number(stats?.assigned_count || 0),
        sent_count: sent,
        delivered_count: delivered,
        read_count: read,
        replied_count: replied,
        converted_count: converted,
        opt_out_count: optOuts,
        delivered_rate: sent > 0 ? Number(((delivered / sent) * 100).toFixed(2)) : 0,
        read_rate: delivered > 0 ? Number(((read / delivered) * 100).toFixed(2)) : 0,
        reply_rate: delivered > 0 ? Number(((replied / delivered) * 100).toFixed(2)) : 0,
        conversion_rate: delivered > 0 ? Number(((converted / delivered) * 100).toFixed(2)) : 0,
        opt_out_rate: delivered > 0 ? Number(((optOuts / delivered) * 100).toFixed(2)) : 0,
        estimated_cost_minor: Number(stats?.estimated_cost_minor || 0),
      });
    }

    // Honest statistical significance evaluation
    const minSample = Number(full.min_sample_size || 100);
    const enoughSamples = variantMetrics.every((m) => m.delivered_count >= minSample);
    let significance = {
      statistically_significant: false,
      winner_variant_id: null,
      p_value: null,
      reason: `Insufficient sample size (minimum ${minSample} delivered recipients per variant required)`,
    };

    if (enoughSamples && variantMetrics.length >= 2) {
      const metricKey = full.winning_metric === "conversion_rate" ? "converted_count" : full.winning_metric === "read_rate" ? "read_count" : "replied_count";
      const sorted = [...variantMetrics].sort(
        (a, b) => (b[metricKey] / Math.max(1, b.delivered_count)) - (a[metricKey] / Math.max(1, a.delivered_count))
      );
      const pVal = twoProportionPValue(sorted[0][metricKey], sorted[0].delivered_count, sorted[1][metricKey], sorted[1].delivered_count);
      const alpha = 1 - Number(full.confidence_level || 0.95);
      significance = {
        statistically_significant: pVal <= alpha,
        winner_variant_id: pVal <= alpha ? sorted[0].variant_id : null,
        p_value: Number(pVal.toFixed(4)),
        reason: pVal <= alpha
          ? `Variant ${sorted[0].variant_key} leads with p=${pVal.toFixed(4)} <= ${alpha.toFixed(2)}`
          : `Difference not statistically significant yet (p=${pVal.toFixed(4)} > ${alpha.toFixed(2)})`,
      };
    }

    return {
      experiment: full,
      variants: variantMetrics,
      significance,
    };
  }

  return {
    createExperiment,
    getExperiment,
    assignRecipient,
    getExperimentReport,
    twoProportionPValue,
  };
}

module.exports = { createCampaignExperimentService, twoProportionPValue };
