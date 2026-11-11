"use strict";

const axios = require("axios");
const crypto = require("crypto");

function validateWebhookUrl(raw) {
  const value = String(raw || "").trim();
  if (!value) return null;
  let parsed;
  try {
    parsed = new URL(value);
  } catch (_) {
    throw Object.assign(new Error("Invalid webhook URL"), { status: 400 });
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw Object.assign(new Error("Webhook URL must use http or https"), { status: 400 });
  }
  const host = parsed.hostname.toLowerCase();
  if (host === "169.254.169.254" || host === "metadata.google.internal") {
    throw Object.assign(new Error("Webhook URL points to a restricted metadata host"), { status: 400 });
  }
  return parsed.toString();
}

function createForwarder({ db = null, httpPost = null } = {}) {
  const getDb = () => db || require("../config/database");
  const q = async (sql, params = []) => (await getDb().promise().query(sql, params))[0];
  const postFn = httpPost || ((url, payload, opts) => axios.post(url, payload, opts));

  class CrmWebhookForwarder {
    constructor() {
      this.webhookUrl = process.env.CRM_WEBHOOK_URL || null;
      this.webhookSecret = process.env.CRM_WEBHOOK_SECRET || "crm_secret_signature_key";
      this.history = [];
    }

    setWebhookUrl(url) {
      this.webhookUrl = url ? String(url).trim() : null;
    }

    getWebhookUrl() {
      return this.webhookUrl || process.env.CRM_WEBHOOK_URL || null;
    }

    signPayload(payloadString, secretOverride = null) {
      const secret = secretOverride || this.webhookSecret;
      if (!secret) return null;
      return crypto.createHmac("sha256", secret).update(payloadString).digest("hex");
    }

    async getTenantWebhook(tenantId, includeSecret = false) {
      const tid = Number(tenantId);
      if (!Number.isInteger(tid) || tid < 1) return null;
      const rows = await q("SELECT * FROM tenant_crm_webhooks WHERE tenant_id = ? LIMIT 1", [tid]).catch(() => []);
      const row = rows[0];
      if (!row) {
        const fallbackUrl = this.getWebhookUrl();
        return fallbackUrl
          ? {
              tenant_id: tid,
              configured: true,
              source: "env",
              webhook_url: fallbackUrl,
              has_secret: Boolean(this.webhookSecret),
              subscribed_events: null,
              is_active: true,
              ...(includeSecret ? { webhook_secret: this.webhookSecret } : {}),
            }
          : { tenant_id: tid, configured: false, webhook_url: null, has_secret: false, subscribed_events: null, is_active: false };
      }
      let events = null;
      try {
        events = row.subscribed_events ? JSON.parse(row.subscribed_events) : null;
      } catch (_) {}
      return {
        tenant_id: tid,
        configured: Boolean(row.webhook_url),
        source: "tenant",
        webhook_url: row.webhook_url,
        has_secret: Boolean(row.webhook_secret),
        subscribed_events: Array.isArray(events) ? events : null,
        is_active: Boolean(row.is_active),
        updated_at: row.updated_at,
        ...(includeSecret ? { webhook_secret: row.webhook_secret || this.webhookSecret } : {}),
      };
    }

    async configureTenantWebhook(tenantId, opts = {}) {
      const tid = Number(tenantId);
      if (!Number.isInteger(tid) || tid < 1) throw Object.assign(new Error("Valid tenantId required"), { status: 400 });

      const cleanUrl = validateWebhookUrl(opts.webhookUrl);
      if (!cleanUrl) {
        await q("UPDATE tenant_crm_webhooks SET is_active = 0, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ?", [
          opts.userId || null,
          tid,
        ]).catch(() => {});
        return this.getTenantWebhook(tid);
      }

      const existing = await q("SELECT id, webhook_secret FROM tenant_crm_webhooks WHERE tenant_id = ? LIMIT 1", [tid]).catch(() => []);
      const secretToStore = opts.secret ? String(opts.secret).trim() : existing[0]?.webhook_secret || null;
      const eventsJson = Array.isArray(opts.events) && opts.events.length ? JSON.stringify(opts.events.map(String)) : null;
      const isActive = opts.isActive === false ? 0 : 1;

      if (existing.length) {
        await q(
          "UPDATE tenant_crm_webhooks SET webhook_url = ?, webhook_secret = ?, subscribed_events = ?, is_active = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ?",
          [cleanUrl, secretToStore, eventsJson, isActive, opts.userId || null, tid]
        );
      } else {
        await q(
          "INSERT INTO tenant_crm_webhooks (tenant_id, webhook_url, webhook_secret, subscribed_events, is_active, updated_by) VALUES (?, ?, ?, ?, ?, ?)",
          [tid, cleanUrl, secretToStore, eventsJson, isActive, opts.userId || null]
        );
      }
      return this.getTenantWebhook(tid);
    }

    async _recordTenantDelivery(tenantId, event, url, status, httpStatus, errorMsg, summary) {
      if (!Number.isInteger(Number(tenantId)) || Number(tenantId) < 1) return;
      await q(
        "INSERT INTO tenant_crm_webhook_deliveries (tenant_id, event_type, webhook_url, status, http_status, error_message, payload_summary) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          Number(tenantId),
          String(event).slice(0, 80),
          String(url).slice(0, 500),
          String(status).slice(0, 30),
          httpStatus || null,
          errorMsg ? String(errorMsg).slice(0, 500) : null,
          summary ? String(summary).slice(0, 1000) : null,
        ]
      ).catch(() => {});
    }

    async sendEvent(event, data, opts = {}) {
      const url = opts.webhookUrl || this.getWebhookUrl();
      if (!url) return null;

      const payload = {
        event,
        timestamp: Math.floor(Date.now() / 1000),
        service: "whatsapp-crm",
        ...(opts.tenantId ? { tenantId: Number(opts.tenantId) } : {}),
        data,
      };

      const payloadStr = JSON.stringify(payload);
      const headers = {
        "Content-Type": "application/json",
        "User-Agent": "Whatsapp-CRM-Webhook/2.0",
        "X-WA-Event": event,
      };
      if (opts.tenantId) headers["X-WA-Tenant-Id"] = String(opts.tenantId);

      const signature = this.signPayload(payloadStr, opts.secret || null);
      if (signature) {
        headers["X-WA-Signature-256"] = `sha256=${signature}`;
      }

      const logEntry = {
        id: `wh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        event,
        tenantId: opts.tenantId || null,
        url,
        timestamp: new Date().toISOString(),
        status: "pending",
        error: null,
      };
      this.history.unshift(logEntry);
      if (this.history.length > 50) this.history.length = 50;

      const summary = JSON.stringify({
        phone: data?.phone || data?.to || null,
        id: data?.id || data?.message?.id || data?.reference || null,
      });

      try {
        const res = await postFn(url, payload, {
          headers,
          timeout: 8000,
          maxRedirects: 0,
          validateStatus: () => true,
        });

        const ok = res.status >= 200 && res.status < 300;
        logEntry.status = ok ? "delivered" : `http_${res.status}`;
        logEntry.httpStatus = res.status;
        if (opts.tenantId) {
          await this._recordTenantDelivery(opts.tenantId, event, url, logEntry.status, res.status, ok ? null : `HTTP ${res.status}`, summary);
        }
        return { success: ok, status: res.status };
      } catch (err) {
        logEntry.status = "failed";
        logEntry.error = err.message;
        if (opts.tenantId) {
          await this._recordTenantDelivery(opts.tenantId, event, url, "failed", null, err.message, summary);
        }
        return { success: false, error: err.message };
      }
    }

    async sendTenantEvent(tenantId, event, data, opts = {}) {
      const tid = Number(tenantId);
      if (!Number.isInteger(tid) || tid < 1) {
        return this.sendEvent(event, data, opts);
      }
      const config = opts.webhookUrl
        ? { configured: true, is_active: true, webhook_url: validateWebhookUrl(opts.webhookUrl), webhook_secret: opts.secret || this.webhookSecret }
        : await this.getTenantWebhook(tid, true).catch(() => null);
      if (!config || !config.configured || !config.is_active || !config.webhook_url) return null;
      if (Array.isArray(config.subscribed_events) && config.subscribed_events.length && !config.subscribed_events.includes(event) && event !== "test.ping") {
        return null;
      }
      return this.sendEvent(event, data, {
        tenantId: tid,
        webhookUrl: config.webhook_url,
        secret: config.webhook_secret || null,
      });
    }

    async getTenantDeliveries(tenantId, limit = 50) {
      const tid = Number(tenantId);
      const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50));
      if (!Number.isInteger(tid) || tid < 1) return this.history.slice(0, safeLimit);
      const rows = await q(
        "SELECT id, tenant_id, event_type AS event, webhook_url AS url, status, http_status, error_message AS error, payload_summary, created_at AS timestamp FROM tenant_crm_webhook_deliveries WHERE tenant_id = ? ORDER BY id DESC LIMIT ?",
        [tid, safeLimit]
      ).catch(() => []);
      if (rows.length) return rows;
      return this.history.filter((h) => !h.tenantId || Number(h.tenantId) === tid).slice(0, safeLimit);
    }

    forwardIncomingMessage({ tenantId = null, sessionKey, chatId, phone, message }) {
      const payload = { sessionKey, chatId, phone, message };
      return (tenantId
        ? this.sendTenantEvent(tenantId, "message.received", payload)
        : this.sendEvent("message.received", payload)
      ).catch(() => {});
    }

    forwardOutgoingMessage({ tenantId = null, sessionKey, chatId, phone, message }) {
      const payload = { sessionKey, chatId, phone, message };
      return (tenantId
        ? this.sendTenantEvent(tenantId, "message.sent", payload)
        : this.sendEvent("message.sent", payload)
      ).catch(() => {});
    }

    forwardMessageStatus({ tenantId = null, sessionKey, messageId, status, ack, to }) {
      const payload = { sessionKey, messageId, status, ack, to };
      return (tenantId
        ? this.sendTenantEvent(tenantId, "message.status", payload)
        : this.sendEvent("message.status", payload)
      ).catch(() => {});
    }

    forwardSessionStatus({ tenantId = null, sessionKey, connected, phone, reason }) {
      const payload = { sessionKey, connected, phone, reason };
      return (tenantId
        ? this.sendTenantEvent(tenantId, "session.status", payload)
        : this.sendEvent("session.status", payload)
      ).catch(() => {});
    }

    getRecentDeliveries() {
      return this.history;
    }
  }

  return new CrmWebhookForwarder();
}

const defaultForwarder = createForwarder();
defaultForwarder.createForwarder = createForwarder;
module.exports = defaultForwarder;
