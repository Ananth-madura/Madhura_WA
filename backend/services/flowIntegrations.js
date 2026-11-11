"use strict";
const crypto = require("crypto");
const axios = require("axios");
const dns = require("dns");
const http = require("http");
const https = require("https");
const rules = require("./flowRules");

const IDENTIFIER = /^[a-zA-Z][a-zA-Z0-9_.-]{0,79}$/;
const HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
const AUTH_TYPES = new Set(["none", "bearer", "api_key", "basic"]);
const reserved = key => String(key || "").split(".").some(part => ["__proto__", "constructor", "prototype"].includes(part));
const fail = (message, status = 400) => Object.assign(new Error(message), { status });

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

function validateWebhook(config, { publish = false } = {}) {
  const c = config || {};
  const method = String(c.method || "GET").toUpperCase();
  if (!HTTP_METHODS.has(method)) throw fail("HTTP request method must be GET, POST, PUT, PATCH, or DELETE");
  const rawUrl = String(c.url || "").trim();
  if (publish) {
    if (!rawUrl) throw fail("HTTP webhook requires an endpoint URL");
    let parsed;
    try {
      const checkUrl = rawUrl.replace(/\{\{?[\w.]+\}?\}/g, "placeholder");
      parsed = new URL(checkUrl);
    } catch (_) {
      throw fail("HTTP webhook URL must be a valid HTTPS/HTTP endpoint");
    }
    if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
      throw fail("HTTP webhook URL must use HTTPS in production");
    }
    if (!["https:", "http:"].includes(parsed.protocol)) {
      throw fail("HTTP webhook URL must start with https:// or http://");
    }
  }
  if (c.timeout_ms !== undefined && (!Number.isFinite(Number(c.timeout_ms)) || Number(c.timeout_ms) < 500 || Number(c.timeout_ms) > 30000)) {
    throw fail("Webhook timeout must be between 500 ms and 30000 ms");
  }
  if (c.retry_count !== undefined && (!Number.isInteger(Number(c.retry_count)) || Number(c.retry_count) < 0 || Number(c.retry_count) > 3)) {
    throw fail("Webhook retries must be between 0 and 3");
  }
  if (c.response_mapping && typeof c.response_mapping === "object" && !Array.isArray(c.response_mapping)) {
    for (const [k, v] of Object.entries(c.response_mapping)) {
      if (reserved(k) || typeof v !== "string") throw fail("Invalid webhook response mapping");
    }
  }
  if (publish && !c.next_node_key && !c.success_next) {
    throw fail("Connect HTTP webhook success route");
  }
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
  if (!path) return undefined;
  return String(path)
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean)
    .reduce((value, key) => {
      if (reserved([key])) return undefined;
      return value && typeof value === "object" && Object.hasOwn(value, key) ? value[key] : undefined;
    }, object);
}

function safePublicLookup(hostname, options, callback) {
  dns.lookup(hostname, { family: 4, all: true }, (error, addresses) => {
    if (error) return callback(error);
    if (!addresses.length || addresses.some(({ address }) => require("./waSsrf").isPrivateIp(address) || Number(address.split(".")[0]) >= 224)) {
      return callback(new Error("Workflow destination must resolve to a public address"));
    }
    callback(null, options?.all ? addresses : addresses[0].address, 4);
  });
}

function createRunner({ request = options => axios(options), env = process.env, resolve = (...args) => require("./flowConnectionStore").resolve(...args) } = {}) {
  return async (node, vars, context) => {
    validate(node.config, { publish: true });
    const c = node.config, target = await resolve(context.tenantId, c.connection, c.operation, env);
    for (const value of Object.values(c.inputs)) {
      for (const match of value.matchAll(/\{\{?([\w.]+)\}?\}/g)) {
        if (rules.resolveVar(vars, match[1]) === undefined) throw fail("Business action inputs refer to a missing workflow variable");
      }
    }
    const inputs = Object.fromEntries(Object.entries(c.inputs).map(([key, value]) => [key, rules.interpolateText(value, vars)]));
    const idempotencyKey = crypto.createHash("sha256").update([context.tenantId, context.runId, context.messageId, node.node_key, context.occurrence].join(":")).digest("hex");
    const response = await request({
      method: "POST", url: target.url, timeout: 15000, maxRedirects: 0,
      maxContentLength: 32768, maxBodyLength: 16384,
      proxy: false,
      httpsAgent: new https.Agent({ lookup: safePublicLookup }),
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

function normalizePairs(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.filter(item => item && String(item.key || "").trim()).map(item => [String(item.key).trim(), String(item.value ?? "")]);
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return normalizePairs(parsed);
    } catch (_) {
      return [];
    }
  }
  if (typeof raw === "object") {
    return Object.entries(raw).filter(([k]) => String(k || "").trim()).map(([k, v]) => [String(k).trim(), String(v ?? "")]);
  }
  return [];
}

function createWebhookRunner({ request = options => axios(options), skipDnsCheck = false } = {}) {
  return async (node, vars, context) => {
    const c = node.config || {};
    validateWebhook(c, { publish: true });

    const method = String(c.method || "GET").toUpperCase();
    let baseUrl = rules.interpolateText(c.url || "", vars, 2000).trim();
    const parsedUrl = new URL(baseUrl);

    if (!skipDnsCheck) {
      const deliverable = await require("./waSsrf").isDeliverableUrl(parsedUrl.toString());
      if (!deliverable) throw fail("Webhook destination blocked: URL must resolve to a safe public address", 400);
    }

    for (const [k, v] of normalizePairs(c.query_params)) {
      parsedUrl.searchParams.set(rules.interpolateText(k, vars, 120), rules.interpolateText(v, vars, 500));
    }

    const headers = {};
    for (const [k, v] of normalizePairs(c.headers)) {
      headers[rules.interpolateText(k, vars, 120)] = rules.interpolateText(v, vars, 2000);
    }

    const authType = AUTH_TYPES.has(c.auth_type) ? c.auth_type : "none";
    if (authType === "bearer" && c.auth_token) {
      headers.Authorization = `Bearer ${rules.interpolateText(c.auth_token, vars, 1000)}`;
    } else if (authType === "api_key" && c.auth_header_name && c.auth_token) {
      headers[rules.interpolateText(c.auth_header_name, vars, 120)] = rules.interpolateText(c.auth_token, vars, 1000);
    } else if (authType === "basic" && (c.auth_username || c.auth_token)) {
      const creds = Buffer.from(`${rules.interpolateText(c.auth_username || "", vars, 200)}:${rules.interpolateText(c.auth_token || "", vars, 500)}`).toString("base64");
      headers.Authorization = `Basic ${creds}`;
    }

    let requestData = undefined;
    if (method !== "GET" && c.body !== undefined && c.body !== null && String(c.body).trim() !== "") {
      const rawBody = typeof c.body === "string" ? c.body : JSON.stringify(c.body);
      const renderedBody = rules.interpolateText(rawBody, vars, 16384);
      if ((c.body_type || "json") === "form") {
        const params = new URLSearchParams();
        try {
          const obj = JSON.parse(renderedBody);
          for (const [k, v] of Object.entries(obj)) params.append(k, String(v ?? ""));
          requestData = params.toString();
        } catch (_) {
          requestData = renderedBody;
        }
        headers["Content-Type"] ??= "application/x-www-form-urlencoded";
      } else {
        try {
          requestData = JSON.parse(renderedBody);
        } catch (_) {
          requestData = renderedBody;
        }
        headers["Content-Type"] ??= "application/json";
      }
    }

    const timeout = Math.min(30000, Math.max(500, Number(c.timeout_ms) || 10000));
    const maxRetries = Math.min(3, Math.max(0, Number.parseInt(c.retry_count ?? 0, 10) || 0));
    const idempotencyKey = crypto
      .createHash("sha256")
      .update([context?.tenantId || 0, context?.runId || 0, context?.messageId || "", node.node_key, context?.occurrence || 0].join(":"))
      .digest("hex");
    headers["Idempotency-Key"] ??= idempotencyKey;

    let lastErr = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await request({
          method,
          url: parsedUrl.toString(),
          headers,
          data: requestData,
          timeout,
          maxRedirects: 0,
          maxContentLength: 262144,
          maxBodyLength: 32768,
          proxy: false,
          ...(skipDnsCheck ? {} : {
            httpAgent: new http.Agent({ lookup: safePublicLookup }),
            httpsAgent: new https.Agent({ lookup: safePublicLookup }),
          }),
        });
        if (!Number.isInteger(response.status) || response.status < 200 || response.status >= 300) {
          throw fail(`HTTP ${response.status || "error"} from endpoint`, 502);
        }

        const outputs = Object.create(null);
        outputs.webhook_status = "success";
        outputs.webhook_status_code = response.status;
        if (response.data && typeof response.data === "object") {
          outputs.webhook_response = JSON.stringify(response.data).slice(0, 4096);
        } else if (response.data !== undefined) {
          outputs.webhook_response = String(response.data).slice(0, 4096);
        }

        const mappings = normalizePairs(c.response_mapping);
        for (const [varName, jsonPath] of mappings) {
          if (!IDENTIFIER.test(varName) || reserved(varName)) continue;
          const val = readPath(response.data, jsonPath);
          if (val !== undefined) {
            outputs[varName] = typeof val === "object" ? JSON.stringify(val).slice(0, 2000) : val;
          }
        }
        return outputs;
      } catch (err) {
        lastErr = err;
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 250 * (attempt + 1)));
        }
      }
    }
    throw lastErr || fail("HTTP webhook request failed", 502);
  };
}

module.exports = {
  validate,
  validateWebhook,
  connection,
  readPath,
  createRunner,
  createWebhookRunner,
};
