"use strict";

const axios = require("axios");
const crypto = require("crypto");

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

  signPayload(payloadString) {
    if (!this.webhookSecret) return null;
    return crypto.createHmac("sha256", this.webhookSecret).update(payloadString).digest("hex");
  }

  async sendEvent(event, data) {
    const url = this.getWebhookUrl();
    if (!url) return null;

    const payload = {
      event,
      timestamp: Math.floor(Date.now() / 1000),
      service: "whatsapp-crm",
      data,
    };

    const payloadStr = JSON.stringify(payload);
    const headers = {
      "Content-Type": "application/json",
      "User-Agent": "Whatsapp-CRM-Webhook/1.0",
      "X-WA-Event": event,
    };

    const signature = this.signPayload(payloadStr);
    if (signature) {
      headers["X-WA-Signature-256"] = `sha256=${signature}`;
    }

    // Record delivery attempt in memory buffer (last 50)
    const logEntry = {
      id: `wh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      event,
      url,
      timestamp: new Date().toISOString(),
      status: "pending",
      error: null,
    };
    this.history.unshift(logEntry);
    if (this.history.length > 50) this.history.length = 50;

    try {
      const res = await axios.post(url, payload, {
        headers,
        timeout: 8000,
        validateStatus: () => true,
      });

      logEntry.status = res.status >= 200 && res.status < 300 ? "delivered" : `http_${res.status}`;
      return { success: res.status >= 200 && res.status < 300, status: res.status };
    } catch (err) {
      logEntry.status = "failed";
      logEntry.error = err.message;
      return { success: false, error: err.message };
    }
  }

  forwardIncomingMessage({ sessionKey, chatId, phone, message }) {
    return this.sendEvent("message.received", {
      sessionKey,
      chatId,
      phone,
      message,
    }).catch(() => {});
  }

  forwardOutgoingMessage({ sessionKey, chatId, phone, message }) {
    return this.sendEvent("message.sent", {
      sessionKey,
      chatId,
      phone,
      message,
    }).catch(() => {});
  }

  forwardMessageStatus({ sessionKey, messageId, status, ack, to }) {
    return this.sendEvent("message.status", {
      sessionKey,
      messageId,
      status,
      ack,
      to,
    }).catch(() => {});
  }

  forwardSessionStatus({ sessionKey, connected, phone, reason }) {
    return this.sendEvent("session.status", {
      sessionKey,
      connected,
      phone,
      reason,
    }).catch(() => {});
  }

  getRecentDeliveries() {
    return this.history;
  }
}

module.exports = new CrmWebhookForwarder();
