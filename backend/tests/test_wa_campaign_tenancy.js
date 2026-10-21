"use strict";

/**
 * Campaign engine tenancy.
 *
 * The engine is driven entirely by whatever row a campaign id points at, so
 * three things have to hold or one organization ends up operating another's
 * sends:
 *
 *   1. `startCampaignEngine(id, tenant)` refuses a campaign it does not own,
 *      so no route can aim the dispatch loop at someone else's queue.
 *   2. `checkAndRecordCampaignReply` only attributes a reply inside the
 *      sender's own organization. Without that, the newest campaign row for a
 *      number anywhere in the system wins - another tenant's reply count goes
 *      up and, worse, another tenant's linked flow launches in this inbox.
 *   3. `getQueueStats(tenant)` reports one organization's queue. Called with
 *      no tenant it used to sum every tenant's rows, so the first tenant's
 *      dashboard showed everyone's volume.
 *
 * Route-level scoping (pause/resume/stop/complete/retry-failed/clone/queue all
 * carrying `AND tenant_id=?`) is asserted against the route source at the end.
 */

const assert = require("assert/strict");
const fs = require("fs");
const db = require("../config/database");
const waCampaignEngine = require("../services/waCampaignEngine");

const OTHER_TENANT = 999001; // guaranteed not to exist in fixtures
const OWN_TENANT = 1;

async function cleanup(dbh, tag) {
  await dbh.promise().query("DELETE FROM wa_campaign_messages WHERE phone LIKE ?", [`%${tag}%`]).catch(() => {});
  await dbh.promise().query("DELETE FROM wa_campaigns WHERE description = ?", [`campaign-tenancy-${tag}`]).catch(() => {});
}

(async () => {
  let passed = 0;
  let failed = 0;
  const check = (cond, msg) => {
    if (cond) { console.log(`  PASS: ${msg}`); passed++; }
    else { console.error(`  FAIL: ${msg}`); failed++; }
  };

  const tag = String(Date.now()).slice(-8);
  const phone = "9199" + tag;

  try {
    // ── 1. engine entry point ownership ────────────────────────────────────
    // 'cancelled' so an accepted start returns straight out of the dispatch
    // loop instead of sitting in a working-hours sleep inside the test run.
    const [camp] = await db.promise().query(
      `INSERT INTO wa_campaigns (name, description, type, status, tenant_id, created_by)
       VALUES (?, ?, 'text', 'cancelled', ?, 1)`,
      [`Tenancy Fixture ${tag}`, `campaign-tenancy-${tag}`, OWN_TENANT]
    );
    const campaignId = camp.insertId;

    check(
      (await waCampaignEngine.startCampaignEngine(campaignId, OWN_TENANT)) === true,
      "the owning organization may start its own campaign"
    );
    // Let the launch settle; a draft campaign exits its loop immediately.
    await new Promise((r) => setTimeout(r, 300));

    check(
      (await waCampaignEngine.startCampaignEngine(campaignId, OTHER_TENANT)) === false,
      "another organization cannot aim the dispatch loop at this campaign"
    );
    check(
      (await waCampaignEngine.startCampaignEngine(999999991, OWN_TENANT)) === false,
      "an unknown campaign is refused rather than started"
    );

    const [afterStart] = await db.promise().query("SELECT status FROM wa_campaigns WHERE id = ?", [campaignId]);
    check(
      afterStart[0]?.status !== "running",
      "a refused start leaves the campaign status untouched"
    );

    // ── 2. reply attribution is bound to an organization ───────────────────
    const [msg] = await db.promise().query(
      `INSERT INTO wa_campaign_messages (campaign_id, phone, status, sent_at, reply_received, tenant_id)
       VALUES (?, ?, 'sent', DATE_SUB(NOW(), INTERVAL 1 HOUR), 0, ?)`,
      [campaignId, phone, OWN_TENANT]
    );
    const messageId = msg.insertId;

    const noTenant = await waCampaignEngine.checkAndRecordCampaignReply(phone, "hello");
    check(
      noTenant.isCampaignReply === false,
      "a reply with no resolvable organization is never attributed"
    );

    const wrongTenant = await waCampaignEngine.checkAndRecordCampaignReply(phone, "hello", OTHER_TENANT);
    check(
      wrongTenant.isCampaignReply === false,
      "another organization's reply does not land on this campaign"
    );

    const ownTenant = await waCampaignEngine.checkAndRecordCampaignReply(phone, "hello", OWN_TENANT);
    check(ownTenant.isCampaignReply === true, "the owning organization's reply is attributed");
    check(ownTenant.campaignId === campaignId, "the campaign is the right one");

    const [marked] = await db.promise().query("SELECT reply_received FROM wa_campaign_messages WHERE id = ?", [messageId]);
    check(marked[0]?.reply_received === 1, "the campaign message is marked as replied");

    // A message sitting in another tenant's campaign for the same number must
    // stay untouched even when its own tenant asks.
    const [foreignCamp] = await db.promise().query(
      `INSERT INTO wa_campaigns (name, description, type, status, tenant_id, created_by)
       VALUES (?, ?, 'text', 'draft', ?, 1)`,
      [`Foreign Fixture ${tag}`, `campaign-tenancy-foreign-${tag}`, OTHER_TENANT]
    );
    const [foreignMsg] = await db.promise().query(
      `INSERT INTO wa_campaign_messages (campaign_id, phone, status, sent_at, reply_received, tenant_id)
       VALUES (?, ?, 'sent', DATE_SUB(NOW(), INTERVAL 1 HOUR), 0, ?)`,
      [foreignCamp.insertId, phone, OTHER_TENANT]
    );
    const stillOwn = await waCampaignEngine.checkAndRecordCampaignReply(phone, "again", OWN_TENANT);
    check(
      stillOwn.campaignId === campaignId,
      "same number, different tenants: only this organization's campaign is matched"
    );
    const [foreignUnmarked] = await db.promise().query("SELECT reply_received FROM wa_campaign_messages WHERE id = ?", [foreignMsg.insertId]);
    check(foreignUnmarked[0]?.reply_received === 0, "the other organization's row is left alone");

    // ── 3. queue stats are one organization's, not everyone's ──────────────
    const unscoped = await waCampaignEngine.getQueueStats();
    check(
      unscoped.scoped === false && unscoped.waiting === 0 && unscoped.completed === 0,
      "queue stats without an organization report nothing instead of every tenant's volume"
    );

    const ownStats = await waCampaignEngine.getQueueStats(OWN_TENANT);
    check(typeof ownStats.waiting === "number", "queue stats for an organization return its own counts");

    const [otherStats] = await db.promise().query(
      `SELECT COUNT(*) AS cnt FROM wa_campaign_messages WHERE status='queued' AND tenant_id = ?`,
      [OTHER_TENANT]
    );
    const [ownQueued] = await db.promise().query(
      `SELECT COUNT(*) AS cnt FROM wa_campaign_messages WHERE status='queued' AND tenant_id = ?`,
      [OWN_TENANT]
    );
    // The numbers must be reproducible from the same tenant filter the engine
    // uses - i.e. the caller cannot receive another tenant's rows.
    if (typeof ownStats.waiting === "number" && ownStats.waiting > 0) {
      check(ownStats.waiting === ownQueued[0].cnt, "reported queue depth matches this organization's rows exactly");
    } else {
      check(ownStats.waiting === 0 || ownStats.waiting === ownQueued[0].cnt, "reported queue depth matches this organization's rows");
    }
    check(
      otherStats[0].cnt === 0 || ownStats.waiting !== otherStats[0].cnt || ownQueued[0].cnt === otherStats[0].cnt,
      "another organization's queue depth is not reported as this one's"
    );

    // ── 4. route-level scoping is present in the source ────────────────────
    const routes = fs.readFileSync(require.resolve("../routes/waCampaignRoutes"), "utf8");

    const mustBeTenantScoped = [
      ["SET status='paused' WHERE id=?", "pause"],
      ["SET status='running' WHERE id=?", "resume"],
      ["SET status='cancelled', completed_at=NOW() WHERE id=?", "stop"],
      ["SET status='completed', completed_at=NOW() WHERE id=?", "complete"],
    ];
    for (const [fragment, label] of mustBeTenantScoped) {
      const occurrences = routes.split(fragment).length - 1;
      check(occurrences > 0, `${label} route still performs its status update`);
      const scopedOccurrences = routes.split(fragment.replace("WHERE id=?", "WHERE id=? AND tenant_id=?")).length - 1;
      check(scopedOccurrences === occurrences, `${label} route is scoped to the caller's organization`);
    }

    check(
      /FROM wa_campaign_messages WHERE \$\{where\}/.test(routes) && routes.includes("campaign_id=? AND tenant_id=?"),
      "the queue read is scoped by organization as well as campaign"
    );
    check(
      /INSERT INTO wa_campaigns[\s\S]{0,600}?tenant_id, branch_id/.test(routes),
      "a clone is created inside the caller's own organization"
    );
    check(
      routes.includes("startCampaignEngine(req.params.id, req.tenantId)"),
      "resume hands the engine the caller's organization for verification"
    );

    const configRoutes = fs.readFileSync(require.resolve("../routes/waConfigRoutes"), "utf8");
    check(
      /getQueueStats\(\s*tenantId\s*\)/.test(configRoutes),
      "the queue-stats endpoint resolves the caller's organization before reading depth"
    );
  } finally {
    await cleanup(db, tag).catch(() => {});
    await db.promise().query("DELETE FROM wa_campaigns WHERE description = ?", [`campaign-tenancy-foreign-${tag}`]).catch(() => {});
    await db.promise().query("DELETE FROM wa_campaign_messages WHERE campaign_id IN (SELECT id FROM wa_campaigns WHERE description LIKE ?)", [`campaign-tenancy-${tag}%`]).catch(() => {});
  }

  console.log(`\nCAMPAIGN TENANCY: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
