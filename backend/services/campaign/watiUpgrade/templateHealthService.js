"use strict";

/**
 * templateHealthService.js
 *
 * Campaign Template Health Center:
 *   - Real-time visibility across APPROVED, PENDING, REJECTED, PAUSED, DISABLED
 *     templates with WABA, category, language, campaign usage, last successful
 *     send, last error, and pacing/missing-variable alerts.
 *   - Actions: Duplicate template, AI-assisted improvement (never promises Meta
 *     approval and never misclassifies category to bypass rules), and safe
 *     replacement across eligible DRAFT campaigns.
 */

const { createDbHelper, assertTenantId, httpError } = require("../dbHelper");

function extractVars(body = "") {
  const found = [];
  const re = /\{\{(\d+)\}\}/g;
  let m;
  while ((m = re.exec(String(body || "")))) {
    const n = Number(m[1]);
    if (!found.includes(n)) found.push(n);
  }
  return found.sort((a, b) => a - b);
}

function createTemplateHealthService(options = {}) {
  const db = createDbHelper(options.db);

  async function getTemplateHealthOverview(tenantId) {
    const tid = assertTenantId(tenantId);
    const templates = await db.query(
      `SELECT t.*,
              (SELECT COUNT(*) FROM campaigns c WHERE c.tenant_id = t.tenant_id AND c.template_id = t.id) AS campaign_usage_count,
              (SELECT COUNT(*) FROM campaigns c WHERE c.tenant_id = t.tenant_id AND c.template_id = t.id AND c.status = 'DRAFT') AS draft_usage_count,
              (SELECT MAX(r.delivered_at) FROM campaign_recipients r JOIN campaigns c ON c.id = r.campaign_id WHERE r.tenant_id = t.tenant_id AND c.template_id = t.id) AS last_successful_send,
              (SELECT r.error_message FROM campaign_recipients r JOIN campaigns c ON c.id = r.campaign_id WHERE r.tenant_id = t.tenant_id AND c.template_id = t.id AND r.status = 'FAILED' ORDER BY r.id DESC LIMIT 1) AS last_error,
              (SELECT COUNT(*) FROM campaign_template_pacing_incidents i WHERE i.tenant_id = t.tenant_id AND i.template_id = t.id AND i.status = 'OPEN') AS open_pacing_incidents
       FROM wa_templates t
       WHERE t.tenant_id = ? AND (t.archived IS NULL OR t.archived = 0)
       ORDER BY t.updated_at DESC LIMIT 300`,
      [tid]
    );

    const summary = { total: templates.length, approved: 0, pending: 0, rejected: 0, paused: 0, disabled: 0, alerts: [] };

    const enriched = templates.map((t) => {
      const st = String(t.meta_status || "DRAFT").toUpperCase();
      if (st === "APPROVED") summary.approved++;
      else if (st === "PENDING") summary.pending++;
      else if (st === "REJECTED") summary.rejected++;
      else if (st === "PAUSED") summary.paused++;
      else if (st === "DISABLED") summary.disabled++;

      const vars = extractVars(t.body);
      const issues = [];
      if (["PAUSED", "REJECTED", "DISABLED"].includes(st) && Number(t.campaign_usage_count || 0) > 0) {
        issues.push(`Template is ${st} while linked to ${t.campaign_usage_count} campaign(s)`);
        summary.alerts.push({ template_id: t.id, template_name: t.name, severity: "high", message: issues[0] });
      }
      if (Number(t.open_pacing_incidents || 0) > 0) {
        issues.push(`Open Meta pacing incident (${t.open_pacing_incidents})`);
        summary.alerts.push({ template_id: t.id, template_name: t.name, severity: "high", message: `Template '${t.name}' has an open Meta pacing alert.` });
      }
      if (vars.length > 0 && vars[0] !== 1) {
        issues.push("Template variables must start at {{1}} sequentially");
      }

      return {
        ...t,
        meta_status_normalized: st,
        variables: vars,
        issues,
      };
    });

    return { summary, templates: enriched };
  }

  async function duplicateTemplate(tenantId, templateId) {
    const tid = assertTenantId(tenantId);
    const orig = await db.queryOne(`SELECT * FROM wa_templates WHERE tenant_id = ? AND id = ? LIMIT 1`, [tid, Number(templateId)]);
    if (!orig) throw httpError("Template not found", 404, "TEMPLATE_NOT_FOUND");
    const copyName = `${orig.name}_v${Date.now().toString().slice(-4)}`;
    const res = await db.query(
      `INSERT INTO wa_templates (tenant_id, name, category, language, header_type, header_value, body, footer, buttons, meta_status, waba_id, sender_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?)`,
      [tid, copyName, orig.category, orig.language || "en", orig.header_type, orig.header_value, orig.body, orig.footer, orig.buttons, orig.waba_id, orig.sender_id]
    );
    return db.queryOne(`SELECT * FROM wa_templates WHERE id = ?`, [res.insertId]);
  }

  async function replaceTemplateInDraftCampaigns(tenantId, oldTemplateId, newTemplateId) {
    const tid = assertTenantId(tenantId);
    const replacement = await db.queryOne(`SELECT * FROM wa_templates WHERE tenant_id = ? AND id = ? LIMIT 1`, [tid, Number(newTemplateId)]);
    if (!replacement) throw httpError("Replacement template not found", 404, "TEMPLATE_NOT_FOUND");
    if (String(replacement.meta_status || "").toUpperCase() !== "APPROVED") {
      throw httpError("Only APPROVED Meta templates can replace paused/rejected templates in campaigns", 409, "TEMPLATE_NOT_APPROVED");
    }
    const res = await db.query(
      `UPDATE campaigns
       SET template_id = ?, template_name = ?, template_language = ?, updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = ? AND template_id = ? AND status = 'DRAFT'`,
      [replacement.id, replacement.name, replacement.language || "en", tid, Number(oldTemplateId)]
    );
    return { updated_draft_campaigns: Number(res.affectedRows || 0), replacement_template: { id: replacement.id, name: replacement.name } };
  }

  function suggestTemplateImprovements(template = {}) {
    const body = String(template.body || "").trim();
    const category = String(template.category || "MARKETING").toUpperCase();
    const vars = extractVars(body);
    const suggestions = [];
    const riskWarnings = [];

    if (!body) {
      riskWarnings.push("Template body is empty.");
    }
    if (body.length > 900) {
      suggestions.push("Shorten copy under 600 characters so key value appears above the WhatsApp fold.");
    }
    if (vars.length === 0) {
      suggestions.push("Add personalization such as 'Hi {{1}}' to improve read and reply rates.");
    }
    if (!/[?!.]/.test(body.slice(-20))) {
      suggestions.push("Add a clear call to action (e.g., 'Reply YES to schedule a quick demo' or attach a Quick-Reply button).");
    }
    if (category === "UTILITY" && /(discount|offer|sale|promo|limited time|buy now|% off)/i.test(body)) {
      riskWarnings.push("Policy Warning: Promotional language detected in a UTILITY template. Meta requires MARKETING category for promotional offers; never reclassify promos as UTILITY.");
    }
    if (/\{\{\d+\}\}\s*$/.test(body) || /^\s*\{\{\d+\}\}/.test(body)) {
      riskWarnings.push("Meta rejects templates that start or end directly with a variable parameter.");
    }

    const improvedDraft = body
      ? `${vars.length === 0 ? "Hi {{1}}, " : ""}${body.replace(/\s+/g, " ").trim()}${/(reply|tap|click|button)/i.test(body) ? "" : " Tap below to connect with our team."}`
      : "Hi {{1}}, we have an update regarding {{2}}. Tap below to learn more.";

    return {
      original_category: category,
      preserved_category: category,
      variables_detected: vars,
      suggestions,
      risk_warnings: riskWarnings,
      improved_draft: improvedDraft,
      meta_approval_disclaimer: "AI improvements are draft suggestions only and do not guarantee Meta template approval. Submit through Meta for official review.",
    };
  }

  return {
    getTemplateHealthOverview,
    duplicateTemplate,
    replaceTemplateInDraftCampaigns,
    suggestTemplateImprovements,
  };
}

module.exports = { createTemplateHealthService };
