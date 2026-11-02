"use strict";

const { PLANS } = require("../services/planCatalog");
const VERSION = "profit_pricing_2026_10_30";

async function migrate(db) {
  const q = (sql, params = []) => new Promise((resolve, reject) => db.query(sql, params, (error, rows) => error ? reject(error) : resolve(rows)));
  const done = await q("SELECT version FROM schema_migrations WHERE name = ? LIMIT 1", [VERSION]);
  if (done.length) return;
  const columns = db.isSqlite
    ? (await q("PRAGMA table_info(plans)")).map(row => row.name)
    : (await q("SHOW COLUMNS FROM plans")).map(row => row.Field);
  for (const [column, type] of Object.entries({ annual_price_inr: "INT NOT NULL DEFAULT 0", message_grant_inr: "INT NOT NULL DEFAULT 0", ai_credit_grant: "INT NOT NULL DEFAULT 0", gst_inclusive: "INT NOT NULL DEFAULT 0" })) {
    if (!columns.includes(column)) await q(`ALTER TABLE plans ADD COLUMN ${column} ${type}`);
  }
  // Catalog prices change; existing tenant allowances and stored checkout amounts remain intact.
  for (const plan of Object.values(PLANS)) {
    const values = [plan.name, plan.badge, plan.price_inr, plan.annual_price_inr, plan.message_grant_inr, plan.ai_credit_grant, plan.gst_inclusive, plan.max_branches, plan.max_seats, plan.max_senders, plan.max_contacts, plan.max_monthly_messages, plan.features_json, plan.id];
    await q("UPDATE plans SET name = ?, badge = ?, price_inr = ?, annual_price_inr = ?, message_grant_inr = ?, ai_credit_grant = ?, gst_inclusive = ?, max_branches = ?, max_seats = ?, max_senders = ?, max_contacts = ?, max_monthly_messages = ?, features_json = ? WHERE id = ?", values);
  }
  await q("INSERT INTO schema_migrations (name, version) VALUES (?, 1)", [VERSION]);
}

module.exports = { migrate };
