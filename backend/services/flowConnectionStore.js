"use strict";
const { encrypt, decrypt } = require("../backendutil/cryptoHelper");
const { connection } = require("./flowIntegrations");
const query = async (sql, params = []) => (await require("../config/database").promise().query(sql, params))[0];
const fail = message => Object.assign(new Error(message), { status: 400 });

async function list(tenant) {
  const rows = await query("SELECT name,url,operations,updated_at FROM wa_flow_connections WHERE tenant_id=? ORDER BY name", [tenant]);
  return rows.map(row => ({ ...row, operations: typeof row.operations === "string" ? JSON.parse(row.operations) : row.operations }));
}

async function save(tenant, input) {
  const { name, url, token, operations } = input;
  if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/.test(name || "") || ["constructor", "prototype", "__proto__"].includes(name)) throw fail("Choose a connection name using letters, numbers, underscores and hyphens");
  if (typeof url !== "string" || url.length > 2000 || typeof token !== "string" || token.length > 2000 || !Array.isArray(operations) || !operations.length || operations.length > 100 || operations.some(op => typeof op !== "string" || !/^[a-zA-Z][a-zA-Z0-9_.-]{0,79}$/.test(op))) throw fail("Provide an endpoint, token and 1 to 100 allowed operations");
  const [previous] = await query("SELECT token,url FROM wa_flow_connections WHERE tenant_id=? AND name=?", [tenant, name]);
  if (!token.trim() && previous?.url !== url) throw fail("Enter a new token when changing the endpoint");
  const secret = token.trim() || (previous ? decrypt(previous.token) : "");
  connection(tenant, name, operations[0], { WA_FLOW_CONNECTIONS: JSON.stringify({ [tenant]: { [name]: { url, token: secret, operations } } }) });
  if (!await require("./waSsrf").isDeliverableUrl(url)) throw fail("The endpoint must resolve to a public HTTPS service");
  await query(`INSERT INTO wa_flow_connections (tenant_id,name,url,token,operations) VALUES (?,?,?,?,?)
    ON DUPLICATE KEY UPDATE url=VALUES(url),token=VALUES(token),operations=VALUES(operations),updated_at=CURRENT_TIMESTAMP`, [tenant, name, url, encrypt(secret), JSON.stringify([...new Set(operations)])]);
  return list(tenant);
}

async function resolve(tenant, name, operation, env = process.env) {
  const [row] = await query("SELECT url,token,operations FROM wa_flow_connections WHERE tenant_id=? AND name=?", [tenant, name]);
  if (!row) return connection(tenant, name, operation, env);
  const target = { ...row, token: decrypt(row.token), operations: typeof row.operations === "string" ? JSON.parse(row.operations) : row.operations };
  return connection(tenant, name, operation, { WA_FLOW_CONNECTIONS: JSON.stringify({ [tenant]: { [name]: target } }) });
}

async function remove(tenant, name) {
  await query("DELETE FROM wa_flow_connections WHERE tenant_id=? AND name=?", [tenant, name]);
}

module.exports = { list, save, resolve, remove };
