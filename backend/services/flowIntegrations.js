"use strict";
const crypto = require("crypto");
const axios = require("axios");
const IDENTIFIER = /^[a-zA-Z][a-zA-Z0-9_.-]{0,79}$/;
const reserved = key => key.split(".").some(part => ["__proto__", "constructor", "prototype"].includes(part));
const fail = message => Object.assign(new Error(message), { status: 400 });

function validate(config, { publish = false } = {}) {
  for (const field of ["connection", "operation"]) {
    if (!IDENTIFIER.test(config[field] || "") || reserved(config[field])) throw fail(`Business action needs a valid ${field} name`);
  }
  for (const field of ["inputs", "outputs"]) {
    const values = config[field];
    if (!values || typeof values !== "object" || Array.isArray(values) || Object.keys(values).length > 20) throw fail(`Business action ${field} must contain up to 20 named fields`);
    for (const [key, value] of Object.entries(values)) {
      if (!IDENTIFIER.test(key) || reserved(key) || typeof value !== "string" || value.length > 2000 || field === "outputs" && (!IDENTIFIER.test(value) || reserved(value))) throw fail(`Invalid business action ${field} mapping`);
      if (field === "outputs" && /^(customer\.|contact\.|integration\.|_|name$|input$|last_input$|selected)/.test(key)) throw fail("Action outputs must use their own variable names");
    }
  }
  if (publish && (!config.next_node_key || !config.error_next)) throw fail("Connect business action success and failure routes");
}

function connection(tenant, name, operation, env = process.env) {
  let registry;
  try { registry = JSON.parse(env.WA_FLOW_CONNECTIONS || "{}"); } catch (_) { throw fail("Workflow connections are not configured correctly"); }
  const tenantConnections = Object.hasOwn(registry, String(tenant)) ? registry[String(tenant)] : null;
  const selected = tenantConnections && Object.hasOwn(tenantConnections, name) ? tenantConnections[name] : null;
  if (!selected || !Array.isArray(selected.operations) || !selected.operations.includes(operation)) throw fail("This business action is not configured for your organization");
  let url;
  try { url = new URL(selected.url); } catch (_) { throw fail("Connection needs an HTTPS endpoint"); }
  if (url.protocol !== "https:" || url.username || url.password || url.hash || !selected.token || /[\r\n]/.test(selected.token)) throw fail("Connection needs HTTPS and a valid server-side token");
  return selected;
}

function readPath(object, path) {
  return path.split(".").reduce((value, key) => value && typeof value === "object" && Object.hasOwn(value, key) ? value[key] : undefined, object);
}

function createRunner({ request = options => axios(options), env = process.env, resolve = (...args) => require("./flowConnectionStore").resolve(...args) } = {}) {
  return async (node, vars, context) => {
    validate(node.config, { publish: true });
    const c = node.config, target = await resolve(context.tenantId, c.connection, c.operation, env);
    const interpolate = require("./flowDefinition").interpolate;
    for(const value of Object.values(c.inputs))for(const match of value.matchAll(/\{\{?([\w.]+)\}?\}/g))if(!Object.hasOwn(vars,match[1]))throw fail("Business action inputs refer to a missing workflow variable");
    const inputs = Object.fromEntries(Object.entries(c.inputs).map(([key, value]) => [key, interpolate(value, vars)]));
    const idempotencyKey = crypto.createHash("sha256").update([context.tenantId, context.runId, context.messageId, node.node_key, context.occurrence].join(":")).digest("hex");
    const response = await request({
      method: "POST", url: target.url, timeout: 15000, maxRedirects: 0,
      maxContentLength: 32768, maxBodyLength: 16384,
      proxy: false,
      httpsAgent: new (require("https").Agent)({ lookup: (hostname, options, callback) => {
        require("dns").lookup(hostname, { family: 4, all: true }, (error, addresses) => {
          if (error) return callback(error);
          if (!addresses.length || addresses.some(({ address }) => require("./waSsrf").isPrivateIp(address) || Number(address.split(".")[0]) >= 224)) return callback(new Error("Workflow destination must resolve to a public address"));
          callback(null, options?.all ? addresses : addresses[0].address, 4);
        });
      } }),
      headers: { Authorization: `Bearer ${target.token}`, "Idempotency-Key": idempotencyKey, "Content-Type": "application/json" },
      data: { operation: c.operation, inputs, context: { tenantId: context.tenantId, conversationId: context.conversationId, runId: context.runId, idempotencyKey } },
    });
    if (!Number.isInteger(response.status) || response.status < 200 || response.status >= 300 || response.data?.success !== true || !response.data?.data || typeof response.data.data !== "object") throw fail("Business system did not confirm this action");
    const outputs = Object.create(null);
    for (const [variable, path] of Object.entries(c.outputs)) {
      const value = readPath(response.data.data, path);
      if (!["string", "number", "boolean"].includes(typeof value) || typeof value === "number" && !Number.isFinite(value) || String(value).length > 4096) throw fail("Business system returned a missing or invalid output");
      outputs[variable] = value;
    }
    return outputs;
  };
}

module.exports = { validate, connection, createRunner };
