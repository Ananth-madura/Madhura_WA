const axios = require("axios");

const WA_API_VERSION = "v22.0";
const BASE_URL = `https://graph.facebook.com/${WA_API_VERSION}`;

class WhatsAppCloudApi {
  constructor() {
    this.phoneNumberId = process.env.WA_PHONE_NUMBER_ID || "";
    this.accessToken = process.env.WA_ACCESS_TOKEN || "";
    this.wabaId = process.env.WA_WABA_ID || "";
    this.appSecret = process.env.WA_APP_SECRET || "";
    this.verifyToken = process.env.WA_VERIFY_TOKEN || "crm_verify_123";
    this.businessAccountId = process.env.WA_BUSINESS_ACCOUNT_ID || "";
    this.displayPhoneNumber = process.env.WA_DISPLAY_PHONE_NUMBER || "";
    this.verifiedName = process.env.WA_VERIFIED_NAME || "";
  }

  isConfigured() {
    return !!(this.phoneNumberId && this.accessToken);
  }

  getConfig() {
    return {
      configured: this.isConfigured(),
      phoneNumberId: this.phoneNumberId || null,
      wabaId: this.wabaId || null,
      display_phone_number: this.displayPhoneNumber || null,
      verified_name: this.verifiedName || null,
    };
  }

  async sendText(to, text, previewUrl = false) {
    if (!this.isConfigured()) throw new Error("WhatsApp Cloud API not configured");
    // Auto-enable rich link preview whenever the body carries a URL
    const hasLink = /https?:\/\/\S+/i.test(String(text || ""));
    const { data } = await axios.post(
      `${BASE_URL}/${this.phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { body: text, preview_url: previewUrl || hasLink },
      },
      { headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json" } }
    );
    return data;
  }

  async sendInteractiveButtons(to, bodyText, buttons = [], headerText = null, footerText = null) {
    if (!this.isConfigured()) throw new Error("WhatsApp Cloud API not configured");
    const interactive = {
      type: "button",
      body: { text: String(bodyText).slice(0, 1024) },
      action: {
        buttons: buttons.slice(0, 3).map((b, i) => {
          // Accept both raw {id,title} and pre-wrapped {type:'reply',reply:{...}}
          const src = b.reply || b;
          return {
            type: "reply",
            reply: {
              id: String(src.id || src.reply_id || `btn_${i + 1}`).slice(0, 256),
              title: String(src.title || `Option ${i + 1}`).slice(0, 20),
            },
          };
        }),
      },
    };
    if (headerText) interactive.header = { type: "text", text: String(headerText).slice(0, 60) };
    if (footerText) interactive.footer = { text: String(footerText).slice(0, 60) };

    const { data } = await axios.post(
      `${BASE_URL}/${this.phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "interactive",
        interactive,
      },
      { headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json" } }
    );
    return data;
  }

  /**
   * rowsOrSections accepts EITHER a flat row array [{id,title,description}]
   * OR a section array [{title, rows:[...]}]. WhatsApp caps the list at 10 rows total.
   */
  async sendInteractiveList(to, bodyText, buttonLabel, rowsOrSections = [], headerText = null, footerText = null) {
    if (!this.isConfigured()) throw new Error("WhatsApp Cloud API not configured");

    const isSectioned = Array.isArray(rowsOrSections) && rowsOrSections.some((s) => Array.isArray(s?.rows));
    const rawSections = isSectioned
      ? rowsOrSections
      : [{ title: "Options", rows: rowsOrSections || [] }];

    let budget = 10;
    const sections = [];
    for (const sec of rawSections) {
      if (budget <= 0) break;
      const slice = (sec.rows || []).slice(0, budget);
      if (!slice.length) continue;
      budget -= slice.length;
      sections.push({
        title: String(sec.title || "Options").slice(0, 24),
        rows: slice.map((r, i) => ({
          id: String(r.id || r.reply_id || `row_${i + 1}`).slice(0, 200),
          title: String(r.title || `Option ${i + 1}`).slice(0, 24),
          description: r.description ? String(r.description).slice(0, 72) : undefined,
        })),
      });
    }

    const interactive = {
      type: "list",
      body: { text: String(bodyText).slice(0, 1024) },
      action: {
        button: (buttonLabel || "View Options").slice(0, 20),
        sections,
      },
    };
    if (headerText) interactive.header = { type: "text", text: String(headerText).slice(0, 60) };
    if (footerText) interactive.footer = { text: String(footerText).slice(0, 60) };

    const { data } = await axios.post(
      `${BASE_URL}/${this.phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "interactive",
        interactive,
      },
      { headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json" } }
    );
    return data;
  }

  /**
   * Native CTA URL button — a single tappable button that opens a link.
   *
   * This is a FREE-FORM interactive message (interactive.type = "cta_url"), so
   * it works inside the 24-hour customer-service window with no template and
   * no template approval. Use it instead of pasting a raw link in body text:
   * the URL is hidden behind the button label, which is what makes
   * "Your quote is ready → [ Check my quote ]" look native.
   *
   * Only ONE button is supported by Meta, and it cannot be mixed with reply
   * buttons in the same message.
   */
  async sendCTAUrl(to, bodyText, displayText, url, headerText = null, footerText = null) {
    if (!this.isConfigured()) throw new Error("WhatsApp Cloud API not configured");
    if (!url) throw new Error("CTA URL message requires a url");
    // Meta rejects anything that is not a public http(s) link.
    if (!/^https?:\/\//i.test(String(url))) {
      throw new Error(`CTA URL must start with http:// or https:// (got "${url}")`);
    }

    const interactive = {
      type: "cta_url",
      body: { text: String(bodyText || "").slice(0, 1024) },
      action: {
        name: "cta_url",
        parameters: {
          display_text: String(displayText || "Open").slice(0, 20),
          url: String(url),
        },
      },
    };
    if (headerText) interactive.header = { type: "text", text: String(headerText).slice(0, 60) };
    if (footerText) interactive.footer = { text: String(footerText).slice(0, 60) };

    const { data } = await axios.post(
      `${BASE_URL}/${this.phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "interactive",
        interactive,
      },
      { headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json" } }
    );
    return data;
  }

  async sendTemplate(to, templateName, languageCode = "en", components = []) {
    if (!this.isConfigured()) throw new Error("WhatsApp Cloud API not configured");
    const body = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
      },
    };
    if (components.length) body.template.components = components;
    const { data } = await axios.post(
      `${BASE_URL}/${this.phoneNumberId}/messages`,
      body,
      { headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json" } }
    );
    return data;
  }

  async sendMedia(to, rawMediaType, mediaIdOrLink, caption = "", filename = "") {
    if (!this.isConfigured()) throw new Error("WhatsApp Cloud API not configured");

    let cleanType = (rawMediaType || "document").toLowerCase();
    if (["pdf", "doc", "docx", "xls", "xlsx", "csv", "excel", "txt", "ppt", "pptx"].includes(cleanType)) {
      cleanType = "document";
    }

    const mediaObj = mediaIdOrLink.startsWith("http")
      ? { link: mediaIdOrLink }
      : { id: mediaIdOrLink };

    if (cleanType === "document") {
      if (filename) mediaObj.filename = filename;
      else {
        try {
          const urlParts = new URL(mediaIdOrLink).pathname.split("/");
          const lastPart = urlParts[urlParts.length - 1];
          if (lastPart && lastPart.includes(".")) mediaObj.filename = decodeURIComponent(lastPart);
        } catch (_) {}
      }
      if (caption) mediaObj.caption = caption;
    } else if (cleanType === "image" || cleanType === "video") {
      if (caption) mediaObj.caption = caption;
    } // Audio does not accept caption in Meta Cloud API

    const body = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: cleanType,
      [cleanType]: mediaObj,
    };
    const { data } = await axios.post(
      `${BASE_URL}/${this.phoneNumberId}/messages`,
      body,
      { headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json" } }
    );
    return data;
  }

  async sendLocation(to, latitude, longitude, name = "", address = "") {
    if (!this.isConfigured()) throw new Error("WhatsApp Cloud API not configured");
    const { data } = await axios.post(
      `${BASE_URL}/${this.phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "location",
        location: { latitude, longitude, name, address },
      },
      { headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json" } }
    );
    return data;
  }

  async getTemplates() {
    if (!this.isConfigured()) throw new Error("WhatsApp Cloud API not configured");
    const { data } = await axios.get(
      `${BASE_URL}/${this.wabaId}/message_templates`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    );
    return data;
  }

  async uploadMedia(fileUrl, mimeType) {
    const { data } = await axios.post(
      `${BASE_URL}/${this.phoneNumberId}/media`,
      { messaging_product: "whatsapp", file: fileUrl, type: mimeType },
      { headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json" } }
    );
    return data;
  }

  /**
   * Download an inbound media attachment and cache it under /uploads/wa-media/cloud.
   * Meta requires two authenticated hops: media id -> temporary URL -> bytes.
   * Returns { url, filename, mimetype } with a URL this server can serve.
   */
  async downloadMedia(mediaId) {
    if (!this.isConfigured()) throw new Error("WhatsApp Cloud API not configured");
    if (!mediaId) throw new Error("mediaId required");

    const fs = require("fs");
    const path = require("path");
    const cacheDir = path.join(__dirname, "..", "uploads", "wa-media", "cloud");
    const safeId = String(mediaId).replace(/[^a-zA-Z0-9_-]/g, "");

    try {
      const hit = fs.readdirSync(cacheDir).find((f) => f.startsWith(safeId + "."));
      if (hit) return { url: `/uploads/wa-media/cloud/${hit}`, filename: hit };
    } catch (_) {}

    const meta = await this.getMediaUrl(mediaId);
    if (!meta?.url) throw new Error("Media URL not returned by WhatsApp");

    const bin = await axios.get(meta.url, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
      responseType: "arraybuffer",
      timeout: 30000,
    });

    const mimetype = meta.mime_type || bin.headers["content-type"] || "application/octet-stream";
    const ext = (mimetype.split("/")[1] || "bin").split(";")[0];
    const filename = `${safeId}.${ext}`;
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, filename), Buffer.from(bin.data));

    return { url: `/uploads/wa-media/cloud/${filename}`, filename, mimetype };
  }

  async getMediaUrl(mediaId) {
    const { data } = await axios.get(
      `${BASE_URL}/${mediaId}`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    );
    return data;
  }

  async registerWebhook(url) {
    const { data } = await axios.post(
      `${BASE_URL}/${this.wabaId}/subscribed_apps`,
      {},
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    );
    return data;
  }

  async getPhoneNumbers() {
    const { data } = await axios.get(
      `${BASE_URL}/${this.wabaId}/phone_numbers`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    );
    return data;
  }

  async getPhoneNumberInfo() {
    const { data } = await axios.get(
      `${BASE_URL}/${this.phoneNumberId}`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    );
    return data;
  }

  async getBusinessProfile() {
    const { data } = await axios.get(
      `${BASE_URL}/${this.phoneNumberId}/whatsapp_business_profile`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    );
    return data;
  }

  async updateBusinessProfile(profile) {
    const { data } = await axios.post(
      `${BASE_URL}/${this.phoneNumberId}/whatsapp_business_profile`,
      { messaging_product: "whatsapp", ...profile },
      { headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json" } }
    );
    return data;
  }

  async markMessageAsRead(messageId) {
    if (!this.isConfigured() || !messageId) return { success: false };
    try {
      const { data } = await axios.post(
        `${BASE_URL}/${this.phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          status: "read",
          message_id: messageId,
        },
        { headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json" } }
      );
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  verifyWebhook(mode, token, challenge) {
    if (mode === "subscribe" && token === this.verifyToken) return challenge;
    return null;
  }
}

module.exports = new WhatsAppCloudApi();