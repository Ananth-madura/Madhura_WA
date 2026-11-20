"use strict";

/**
 * aiCampaignAssistantService.js
 *
 * AI Campaign Assistant:
 *   1. Campaign Creation Assistant (goal -> reviewable draft blueprint using real
 *      tenant approved templates, Flowbots, automations & segment draft).
 *   2. Template Quality Assistant (clarity, personalization, category consistency,
 *      missing variable detection, strictly preserving Meta category rules).
 *   3. Audience Segment Assistant (natural language -> structured CRM segment draft;
 *      NEVER creates consent or overrides DNC).
 *   4. Performance Q&A Assistant (answers analytics questions strictly from real
 *      DB metrics with explicit date range, filters & calculation formulas).
 *   5. Next-Best-Action Recommendations (never auto-launches unapproved campaigns).
 */

const { createDbHelper, assertTenantId } = require("../dbHelper");
const { createTemplateHealthService } = require("./templateHealthService");

function createAiCampaignAssistantService(options = {}) {
  const db = createDbHelper(options.db);
  const templateHealth = options.templateHealth || createTemplateHealthService({ db: options.db });

  async function proposeCampaignBlueprint(tenantId, promptText = "") {
    const tid = assertTenantId(tenantId);
    const raw = String(promptText || "").trim();
    const lc = raw.toLowerCase();

    const [approvedTemplates, flowbots, automations, groups] = await Promise.all([
      db.query(`SELECT id, name, category, language, body FROM wa_templates WHERE tenant_id = ? AND meta_status = 'APPROVED' AND (archived IS NULL OR archived = 0) ORDER BY id DESC LIMIT 20`, [tid]).catch(() => []),
      db.query(`SELECT id, name, status FROM wa_flows WHERE tenant_id = ? AND status = 'active' ORDER BY id DESC LIMIT 20`, [tid]).catch(() => []),
      db.query(`SELECT id, name, trigger_type FROM wa_automations WHERE tenant_id = ? AND is_active = 1 ORDER BY id DESC LIMIT 20`, [tid]).catch(() => []),
      db.query(`SELECT id, name FROM wa_contact_groups WHERE tenant_id = ? ORDER BY id DESC LIMIT 20`, [tid]).catch(() => []),
    ]);

    let objective = "product_promotion";
    let campaignType = "promotional";
    let category = "MARKETING";
    let kpi = "Reply rate & qualified leads";

    if (/(launch|announce|new package|new product)/i.test(lc)) {
      objective = "product_announcement";
      campaignType = "product_launch";
      kpi = "Read rate & CTA click-through";
    } else if (/(cart|checkout|abandoned)/i.test(lc)) {
      objective = "revenue_generation";
      campaignType = "abandoned_cart";
      kpi = "Verified order recovery rate";
    } else if (/(payment|invoice|due|reminder)/i.test(lc)) {
      objective = "order_communication";
      campaignType = "payment_reminders";
      category = "UTILITY";
      kpi = "Verified payment completion rate";
    } else if (/(win.?back|inactive|retention)/i.test(lc)) {
      objective = "customer_retention";
      campaignType = "win_back";
      kpi = "Reactivation reply rate";
    }

    const keywords = lc.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length >= 4);
    const bestTemplate = approvedTemplates.find((t) => keywords.some((k) => `${t.name} ${t.body}`.toLowerCase().includes(k))) || approvedTemplates[0] || null;
    const bestFlowbot = flowbots.find((b) => keywords.some((k) => b.name.toLowerCase().includes(k))) || flowbots[0] || null;
    const bestAuto = automations[0] || null;
    const bestGroup = groups.find((g) => keywords.some((k) => g.name.toLowerCase().includes(k))) || groups[0] || null;

    const audienceDraft = proposeAudienceSegmentDraft(raw);

    return {
      requires_user_review: true,
      auto_launched: false,
      proposed_campaign: {
        name: raw ? `${raw.slice(0, 60)}${raw.length > 60 ? "..." : ""}` : "AI Suggested Campaign",
        objective,
        campaign_type: campaignType,
        category,
        suggested_group: bestGroup,
        suggested_audience_definition: audienceDraft.definition,
        suggested_template: bestTemplate,
        suggested_flowbot: bestFlowbot,
        suggested_automation: bestAuto,
        estimated_duration_minutes: 15,
        suggested_kpi: kpi,
      },
      compliance_note: "Review audience eligibility, consent, and Meta template approval before launching. AI never creates consent or launches automatically.",
    };
  }

  function proposeAudienceSegmentDraft(promptText = "") {
    const lc = String(promptText || "").toLowerCase();
    const include = [];

    const interestMatch = lc.match(/(?:solar|commercial|vip|enterprise|real estate|saas|retail|healthcare|education)/i);
    if (interestMatch) {
      include.push({ field: "tags", operator: "contains", value: interestMatch[0].toLowerCase() });
    }
    if (/india|\bin\b|bangalore|mumbai|delhi|chennai/i.test(lc)) {
      include.push({ field: "country_code", operator: "equals", value: "IN" });
    }
    if (/email/i.test(lc)) {
      include.push({ field: "email", operator: "is_not_empty", value: "" });
    }
    if (include.length === 0) {
      include.push({ field: "tags", operator: "is_not_empty", value: "" });
    }

    return {
      requires_user_review: true,
      consent_enforced: true,
      dnc_enforced: true,
      name: `AI Draft Segment (${interestMatch ? interestMatch[0] : "CRM Filter"})`,
      definition: { logic: "AND", include, exclude: [] },
      note: "This draft strictly filters existing CRM contacts and always respects opt-in consent and DNC suppression.",
    };
  }

  async function answerPerformanceQuestion(tenantId, question = "", { dateFrom = null, dateTo = null } = {}) {
    const tid = assertTenantId(tenantId);
    const lc = String(question || "").toLowerCase();
    const dateRange = { from: dateFrom || "all_time", to: dateTo || new Date().toISOString().slice(0, 10) };

    const clauses = ["tenant_id = ?"];
    const params = [tid];
    if (dateFrom) { clauses.push("created_at >= ?"); params.push(dateFrom); }
    if (dateTo) { clauses.push("created_at <= ?"); params.push(dateTo); }

    const campaigns = await db.query(
      `SELECT id, name, category, template_name, sender_id, segment_id, status,
              submitted_count, delivered_count, read_count, failed_count, reply_count, conversion_count, attributed_revenue_minor
       FROM campaigns WHERE ${clauses.join(" AND ")} ORDER BY id DESC LIMIT 200`,
      params
    );

    if (campaigns.length === 0) {
      return {
        question,
        date_range: dateRange,
        answer: "No campaign records found for the selected date range.",
        calculation_method: "Aggregated from campaigns table",
        data: [],
      };
    }

    if (/most replies|top.*repl/i.test(lc)) {
      const sorted = [...campaigns].sort((a, b) => Number(b.reply_count || 0) - Number(a.reply_count || 0));
      const top = sorted[0];
      return {
        question,
        date_range: dateRange,
        answer: `Campaign "${top.name}" generated the most replies (${top.reply_count || 0} replies out of ${top.delivered_count || 0} delivered messages).`,
        calculation_method: "MAX(reply_count) from campaigns table",
        data: sorted.slice(0, 5),
      };
    }

    if (/highest read|best.*template|template.*read/i.test(lc)) {
      const withRate = campaigns
        .filter((c) => Number(c.delivered_count || 0) > 0)
        .map((c) => ({ ...c, read_rate_pct: Number(((Number(c.read_count || 0) / Number(c.delivered_count || 1)) * 100).toFixed(2)) }))
        .sort((a, b) => b.read_rate_pct - a.read_rate_pct);
      const top = withRate[0];
      return {
        question,
        date_range: dateRange,
        answer: top
          ? `Template "${top.template_name || "Unnamed"}" (used in "${top.name}") achieved the highest read rate at ${top.read_rate_pct}% (${top.read_count}/${top.delivered_count}).`
          : "No delivered templates with read receipts recorded yet.",
        calculation_method: "(read_count / delivered_count) * 100 from campaigns table",
        data: withRate.slice(0, 5),
      };
    }

    if (/sender.*fail|delivery fail/i.test(lc)) {
      const bySender = new Map();
      for (const c of campaigns) {
        const sid = c.sender_id || "unassigned";
        const cur = bySender.get(sid) || { sender_id: sid, failed: 0, submitted: 0 };
        cur.failed += Number(c.failed_count || 0);
        cur.submitted += Number(c.submitted_count || 0);
        bySender.set(sid, cur);
      }
      const sorted = Array.from(bySender.values()).sort((a, b) => b.failed - a.failed);
      return {
        question,
        date_range: dateRange,
        answer: `Sender #${sorted[0].sender_id} recorded the most delivery failures (${sorted[0].failed} failed out of ${sorted[0].submitted} submitted).`,
        calculation_method: "SUM(failed_count) grouped by sender_id from campaigns table",
        data: sorted.slice(0, 5),
      };
    }

    if (/retarget/i.test(lc)) {
      const candidates = campaigns
        .filter((c) => Number(c.delivered_count || 0) > Number(c.reply_count || 0))
        .map((c) => ({ ...c, non_replied: Number(c.delivered_count || 0) - Number(c.reply_count || 0) }))
        .sort((a, b) => b.non_replied - a.non_replied);
      const top = candidates[0];
      return {
        question,
        date_range: dateRange,
        answer: top
          ? `Campaign "${top.name}" is the strongest retargeting candidate with ${top.non_replied} delivered recipients who have not replied yet.`
          : "All delivered recipients have already replied or no delivered campaigns exist yet.",
        calculation_method: "delivered_count - reply_count from campaigns table",
        data: candidates.slice(0, 5),
      };
    }

    // Default: top converting / revenue campaign
    const byConv = [...campaigns].sort((a, b) => Number(b.conversion_count || 0) - Number(a.conversion_count || 0) || Number(b.attributed_revenue_minor || 0) - Number(a.attributed_revenue_minor || 0));
    const top = byConv[0];
    return {
      question,
      date_range: dateRange,
      answer: `Campaign "${top.name}" leads conversions with ${top.conversion_count || 0} verified conversion(s) and ${top.attributed_revenue_minor || 0} minor-unit attributed revenue.`,
      calculation_method: "MAX(conversion_count, attributed_revenue_minor) from campaigns table",
      data: byConv.slice(0, 5),
    };
  }

  async function getNextBestActions(tenantId) {
    const tid = assertTenantId(tenantId);
    const [campaigns, pacing] = await Promise.all([
      db.query(`SELECT id, name, template_name, delivered_count, read_count, reply_count, failed_count, conversion_count FROM campaigns WHERE tenant_id = ? ORDER BY id DESC LIMIT 50`, [tid]).catch(() => []),
      db.query(`SELECT id, campaign_id, template_name FROM campaign_template_pacing_incidents WHERE tenant_id = ? AND status = 'OPEN' LIMIT 10`, [tid]).catch(() => []),
    ]);

    const recommendations = [];
    for (const p of pacing) {
      recommendations.push({
        priority: "high",
        type: "template_pacing_recovery",
        title: `Recover paused campaign #${p.campaign_id} with an approved template`,
        reason: `Template '${p.template_name || "Unknown"}' triggered an open Meta pacing alert.`,
        action_path: "/whatsapp/campaigns/recovery",
        auto_launch: false,
      });
    }
    for (const c of campaigns) {
      const del = Number(c.delivered_count || 0);
      const rep = Number(c.reply_count || 0);
      const fail = Number(c.failed_count || 0);
      if (rep > 0 && recommendations.length < 6) {
        recommendations.push({
          priority: "medium",
          type: "retarget_replied",
          title: `Follow up with ${rep} replied contact(s) from "${c.name}"`,
          reason: "Replied recipients have high purchase intent; route them into a Flowbot or follow-up sequence.",
          action_path: `/whatsapp/campaigns/retargeting?campaign_id=${c.id}`,
          auto_launch: false,
        });
      }
      if (del >= 5 && fail / Math.max(1, del + fail) >= 0.2 && recommendations.length < 6) {
        recommendations.push({
          priority: "high",
          type: "review_high_failure_template",
          title: `Review high failure rate on "${c.name}" (${fail} failed)`,
          reason: "Failure ratio exceeds 20%. Inspect error breakdown and template health before resending.",
          action_path: "/whatsapp/campaigns/template-health",
          auto_launch: false,
        });
      }
    }

    return { recommendations, auto_launch_permitted: false };
  }

  return {
    proposeCampaignBlueprint,
    proposeAudienceSegmentDraft,
    evaluateTemplateQuality: (tmpl) => templateHealth.suggestTemplateImprovements(tmpl),
    answerPerformanceQuestion,
    getNextBestActions,
  };
}

module.exports = { createAiCampaignAssistantService };
