"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const { createRequire } = require("node:module");
process.env.SMTP_ENCRYPTION_KEY = "a".repeat(32);
const encryption = require("../backendutil/cryptoHelper");
const records = new Map();
const queries = [];
const query = async (sql, params = []) => {
  queries.push({ sql, params });
  const key = `${params[0]}:${params[1]}`;
  if (sql.startsWith("INSERT")) {
    records.set(key, { name: params[1], url: params[2], token: params[3], operations: params[4] });
    return [{ affectedRows: 1 }];
  }
  if (sql.startsWith("DELETE")) { records.delete(key); return [{ affectedRows: 1 }]; }
  if (sql.includes("AND name=?")) return [records.has(key) ? [{ ...records.get(key) }] : []];
  return [[...records.entries()].filter(([recordKey]) => recordKey.startsWith(`${params[0]}:`)).map(([, row]) => {
    const { token, ...publicRow } = row;
    return publicRow;
  })];
};
const filename = path.resolve(__dirname, "../services/flowConnectionStore.js");
const realRequire = createRequire(filename), moduleState = { exports: {} };
const mocks = {
  "../config/database": { promise: () => ({ query }) },
  "./waSsrf": { isDeliverableUrl: async url => !url.includes("internal") },
};
vm.runInNewContext(fs.readFileSync(filename, "utf8"), { module: moduleState, exports: moduleState.exports, process, require: name => Object.hasOwn(mocks, name) ? mocks[name] : realRequire(name) }, { filename });
const store = moduleState.exports;

async function main() {
  const input = { name: "business", url: "https://api.example.test/actions", token: "private-token", operations: ["appointments.availability"] };
  const saved = await store.save(7, input);
  assert.equal(saved.length, 1);
  assert(!JSON.stringify(saved).includes("private-token"));
  const stored = records.get("7:business");
  assert.notEqual(stored.token, input.token);
  assert.equal(encryption.decrypt(stored.token), input.token);
  assert.equal((await store.resolve(7, "business", "appointments.availability")).token, input.token);
  await assert.rejects(store.resolve(8, "business", "appointments.availability", {}), /not configured/);
  await assert.rejects(store.resolve(7, "business", "finance.receipt"), /not configured/);
  await store.save(7, { ...input, token: "" });
  assert.equal(encryption.decrypt(records.get("7:business").token), input.token);
  await assert.rejects(store.save(7, { ...input, token: "", url: "https://another.example.test/actions" }), /new token/);
  await assert.rejects(store.save(7, { ...input, url: "https://internal.example.test/actions" }), /public HTTPS/);
  await assert.rejects(store.save(7, { ...input, url: "http://api.example.test/actions" }), /HTTPS/);
  assert.equal((await store.list(8)).length, 0);
  await store.remove(8, "business");
  assert.equal((await store.list(7)).length, 1);
  await store.remove(7, "business");
  assert.equal((await store.list(7)).length, 0);
  assert(queries.every(({ sql }) => !sql.startsWith("SELECT") || sql.includes("tenant_id=?")));
  console.log("PASS: encrypted connection credentials, token redaction, tenant and operation boundaries, credential rotation, HTTPS validation and scoped removal");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
