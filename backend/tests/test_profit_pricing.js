"use strict";

const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");
const { PLANS } = require("../services/planCatalog");
const { migrate } = require("../migrations/profit_pricing");

async function main() {
  const sql = new DatabaseSync(":memory:");
  sql.exec(`
    CREATE TABLE schema_migrations (name TEXT, version INTEGER);
    CREATE TABLE plans (id TEXT PRIMARY KEY, name TEXT, badge TEXT, price_inr INTEGER,
      max_branches INTEGER, max_seats INTEGER, max_senders INTEGER, max_contacts INTEGER,
      max_monthly_messages INTEGER, features_json TEXT, is_active INTEGER DEFAULT 1);
    CREATE TABLE tenants (id INTEGER, name TEXT, max_senders INTEGER);
    INSERT INTO tenants VALUES (1, 'Pricing fixture', 10);
    CREATE TABLE users (id INTEGER, email TEXT, first_name TEXT);
    CREATE TABLE billing_orders (id INTEGER PRIMARY KEY, amount_minor INTEGER,
      tenant_id INTEGER, user_id INTEGER, plan_id TEXT, interval TEXT, currency TEXT,
      provider TEXT, provider_order_id TEXT, receipt TEXT, status TEXT, source TEXT);
    INSERT INTO billing_orders (id, amount_minor) VALUES (1, 149900);
  `);
  for (const id of Object.keys(PLANS)) sql.prepare("INSERT INTO plans (id, price_inr) VALUES (?, 1499)").run(id);
  const db = {
    isSqlite: true,
    query(statement, values, callback) {
      if (typeof values === "function") { callback = values; values = []; }
      try {
        const prepared = sql.prepare(statement);
        const result = /^(SELECT|PRAGMA)/i.test(statement) ? prepared.all(...values) : prepared.run(...values);
        callback(null, Array.isArray(result) ? result : { ...result, insertId: Number(result.lastInsertRowid) });
      } catch (error) { callback(error); }
    },
  };
  try {
    await migrate(db);
    const rows = sql.prepare("SELECT * FROM plans ORDER BY price_inr").all();
    assert.deepEqual(rows.map(row => row.price_inr), [0, 2499, 5999, 17499, 49999]);
    assert.deepEqual(rows.map(row => row.max_senders), [1, 1, 3, 10, 50]);
    assert.deepEqual(rows.map(row => row.max_seats), [3, 6, 15, 40, 150]);
    assert.deepEqual(rows.map(row => row.ai_credit_grant), [0, 300, 1500, 5000, 15000]);
    assert.deepEqual(rows.map(row => row.annual_price_inr), [0, 24990, 59990, 174990, 499990]);
    assert.equal(rows.filter(row => row.badge).length, 1);
    assert.equal(sql.prepare("SELECT max_senders FROM tenants").get().max_senders, 10);
    assert.equal(sql.prepare("SELECT amount_minor FROM billing_orders").get().amount_minor, 149900);
    await migrate(db);
    assert.equal(sql.prepare("SELECT COUNT(*) n FROM schema_migrations").get().n, 1);

    const dbPath = require.resolve("../config/database");
    require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: db };
    const legacy = require("../services/tenantPlanService");
    const billing = require("../services/billingService");
    const publicPlans = await billing.getPlans();
    assert.deepEqual(publicPlans.map(plan => Number(plan.price_inr)), legacy.getAvailablePlans().map(plan => plan.price_inr));
    assert.equal(legacy.getPlan("business").price_inr, 17499);
    assert.equal(publicPlans.find(plan => plan.id === "growth").price, "₹5,999");
    process.env.NODE_ENV = "test";
    process.env.BILLING_ALLOW_DEV_PAYMENTS = "1";
    process.env.RAZORPAY_KEY_ID = "";
    process.env.RAZORPAY_KEY_SECRET = "";
    process.env.RAZORPAY_CHECKOUT_ENABLED = "1";
    for (const planId of ["starter", "growth", "business", "enterprise"]) {
      const session = await billing.createCheckoutSession(1, null, { planId });
      assert.equal(session.amount, PLANS[planId].price_inr * 100);
      assert.equal(session.live, false);
      const order = sql.prepare("SELECT * FROM billing_orders WHERE id = ?").get(session.billingOrderId);
      assert.equal(order.amount_minor, session.amount);
      assert.equal(order.plan_id, planId);
    }
    await assert.rejects(() => billing.createCheckoutSession(1, null, { planId: "growth", interval: "year" }), { code: "INVALID_INTERVAL" });
    console.log("PASS: migration and repeat run, preserved tenant/order values, catalog consistency, four checkout prices and stored orders. No live payments.");
  } finally {
    sql.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
