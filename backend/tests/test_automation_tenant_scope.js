"use strict";
const assert = require("node:assert/strict");
const calls = [];
const db = { isSqlite: false, promise: () => ({ query: async (sql, params = []) => {
  calls.push({ sql, params });
  if (sql.includes("INFORMATION_SCHEMA.COLUMNS")) return [[{ COLUMN_NAME: "tenant_id" }, { COLUMN_NAME: "phone" }, { COLUMN_NAME: "name" }]];
  return [[]];
} }) };
require.cache[require.resolve("../config/database")] = { loaded: true, exports: db };
async function main() {
  const service = require("../services/waAutomationService");
  assert.equal((await service.triggerAutomation("new_lead", { phone: "919123456789" })).reason, "organization_required");
  assert.equal(calls.length, 0);
  for (const tenantId of [1, 2]) {
    calls.length = 0;
    assert.equal((await service.triggerAutomation("new_lead", { tenantId, phone: "919123456789" })).reason, "no_active_rules");
    for (const call of calls) { assert(call.sql.includes("tenant_id=?")); assert.equal(call.params[0], tenantId); }
  }
  calls.length = 0;
  assert.deepEqual(await service.lookupCrmDataByPhone("919123456789"), {});
  assert.equal(calls.length, 0);
  await service.lookupCrmDataByPhone("919123456789", 2);
  assert(calls.some(call => call.sql.includes("FROM clients WHERE tenant_id=?")));
  assert(calls.filter(call => call.sql.startsWith("SELECT ") && !call.sql.includes("INFORMATION_SCHEMA")).every(call => call.sql.includes("tenant_id=?")));
  console.log("PASS: automation requires an organization; rules, templates, opt-outs, blocked contacts and CRM enrichment remain tenant scoped; unresolved organization performs no queries or sends.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
