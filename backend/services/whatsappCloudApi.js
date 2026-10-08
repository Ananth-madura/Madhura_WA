const axios = require("axios");

const WA_API_VERSION = "v22.0";
const BASE_URL = `https://graph.facebook.com/${WA_API_VERSION}`;

function mimeToExtension(mime, defaultExt = "bin") {
  if (!mime) return defaultExt;
  const cleanMime = String(mime).toLowerCase().split(";")[0].trim();
  const map = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.ms-excel": "xls",
    "text/csv": "csv",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "application/vnd.ms-powerpoint": "ppt",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/svg+xml": "svg",
    "video/mp4": "mp4",
    "video/3gpp": "3gp",
    "video/quicktime": "mov",
    "video/webm": "webm",
    "video/x-matroska": "mkv",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/ogg": "ogg",
    "audio/wav": "wav",
    "audio/webm": "webm",
    "audio/aac": "aac",
    "audio/mp4": "m4a",
    "application/zip": "zip",
    "application/x-zip-compressed": "zip",
    "application/x-rar-compressed": "rar",
    "application/x-7z-compressed": "7z",
    "text/plain": "txt",
    "application/json": "json",
  };
  if (map[cleanMime]) return map[cleanMime];
  const sub = cleanMime.split("/")[1];
  if (sub && sub.length <= 5 && /^[a-z0-9]+$/.test(sub)) return sub;
  return defaultExt;
}

function cleanRecipient(to) {
  let clean = String(to || "").replace(/@c\.us$/i, "").replace(/\D/g, "");
  if (clean.length === 10) clean = "91" + clean;
  return clean;
}

function formatMetaError(err) {
  const metaErr = err?.response?.data?.error;
  if (metaErr) {
    const msg = metaErr.message || "Meta API error";
    const userMsg = metaErr.error_user_msg ? ` (${metaErr.error_user_msg})` : "";
    const code = metaErr.code ? ` [Code ${metaErr.code}${metaErr.error_subcode ? `:${metaErr.error_subcode}` : ""}]` : "";
    const details = metaErr.error_data?.details ? ` - ${metaErr.error_data.details}` : "";
    const customErr = new Error(`${msg}${userMsg}${details}${code}`);
    customErr.metaError = metaErr;
    customErr.status = err.response?.status;
    return customErr;
  }
  return err;
}

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
    const target = cleanRecipient(to);
    // Auto-enable rich link preview whenever the body carries a URL
    const hasLink = /https?:\/\/\S+/i.test(String(text || ""));
    try {
      const { data } = await axios.post(
        `${BASE_URL}/${this.phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: target,
          type: "text",
          text: { body: text, preview_url: previewUrl || hasLink },
        },
        { headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json" } }
      );
      return data;
    } catch (err) {
      throw formatMetaError(err);
    }
  }

  async sendInteractiveButtons(to, bodyText, buttons = [], headerText = null, footerText = null) {
    if (!this.isConfigured()) throw new Error("WhatsApp Cloud API not configured");
    const target = cleanRecipient(to);
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

    try {
      const { data } = await axios.post(
        `${BASE_URL}/${this.phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: target,
          type: "interactive",
          interactive,
        },
        { headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json" } }
      );
      return data;
    } catch (err) {
      throw formatMetaError(err);
    }
  }

  /**
   * rowsOrSections accepts EITHER a flat row array [{id,title,description}]
   * OR a section array [{title, rows:[...]}]. WhatsApp caps the list at 10 rows total.
   */
  async sendInteractiveList(to, bodyText, buttonLabel, rowsOrSections = [], headerText = null, footerText = null) {
    if (!this.isConfigured()) throw new Error("WhatsApp Cloud API not configured");
    const target = cleanRecipient(to);

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

    try {
      const { data } = await axios.post(
        `${BASE_URL}/${this.phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: target,
          type: "interactive",
          interactive,
        },
        { headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json" } }
      );
      return data;
    } catch (err) {
      throw formatMetaError(err);
    }
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
    const target = cleanRecipient(to);

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

    try {
      const { data } = await axios.post(
        `${BASE_URL}/${this.phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: target,
          type: "interactive",
          interactive,
        },
        { headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json" } }
      );
      return data;
    } catch (err) {
      throw formatMetaError(err);
    }
  }

  async sendTemplate(to, templateName, languageCode = "en", components = []) {
    if (!this.isConfigured()) throw new Error("WhatsApp Cloud API not configured");
    const target = cleanRecipient(to);
    const body = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: target,
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
      },
    };
    if (components.length) body.template.components = components;
    try {
      const { data } = await axios.post(
        `${BASE_URL}/${this.phoneNumberId}/messages`,
        body,
        { headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json" } }
      );
      return data;
    } catch (err) {
      throw formatMetaError(err);
    }
  }

  async sendMedia(to, rawMediaType, mediaIdOrLink, caption = "", filename = "") {
    if (!this.isConfigured()) throw new Error("WhatsApp Cloud API not configured");
    const target = cleanRecipient(to);

    let cleanType = (rawMediaType || "document").toLowerCase();
    if (["pdf", "doc", "docx", "xls", "xlsx", "csv", "excel", "txt", "ppt", "pptx"].includes(cleanType)) {
      cleanType = "document";
    }

    let finalMediaTarget = mediaIdOrLink;
    if (typeof finalMediaTarget === "string" && finalMediaTarget.startsWith("/")) {
      const base = (process.env.PUBLIC_BASE_URL || "").replace(/\/+$/, "");
      if (base) finalMediaTarget = `${base}${finalMediaTarget}`;
    }

    const mediaObj = (typeof finalMediaTarget === "string" && finalMediaTarget.startsWith("http"))
      ? { link: finalMediaTarget }
      : { id: finalMediaTarget };

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
      to: target,
      type: cleanType,
      [cleanType]: mediaObj,
    };
    try {
      const { data } = await axios.post(
        `${BASE_URL}/${this.phoneNumberId}/messages`,
        body,
        { headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json" } }
      );
      return data;
    } catch (err) {
      throw formatMetaError(err);
    }
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
    // Cloud-API inbound media cache. Routed through runtimePaths so it lands in
    // the persistent data dir on the VPS, not in the disposable deploy dir.
    const { cloudMediaDir: cacheDir } = require("../config/runtimePaths");
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
    const ext = mimeToExtension(mimetype, (mimetype.split("/")[1] || "bin").split(";")[0]);
    const safeExt = (ext || "bin").replace(/[^a-zA-Z0-9]/g, "");
    const filename = `${safeId}.${safeExt}`;
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

  async getPhoneNumberInfo(phoneNumberId = null, accessToken = null) {
    const pid = phoneNumberId || this.phoneNumberId;
    const token = accessToken || this.accessToken;
    if (!pid || !token) throw new Error("Phone Number ID and Access Token required");

    const fields = [
      "display_phone_number",
      "verified_name",
      "code_verification_status",
      "quality_rating",
      "messaging_limit_tier",
      "platform_type",
      "throughput",
      "status",
      "id",
      "is_official_business_account"
    ].join(",");

    try {
      const { data } = await axios.get(
        `${BASE_URL}/${pid}?fields=${fields}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return data;
    } catch (err) {
      // Fallback without explicit fields in case some permissions are missing
      try {
        const { data } = await axios.get(
          `${BASE_URL}/${pid}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        return data;
      } catch (innerErr) {
        throw formatMetaError(innerErr);
      }
    }
  }

  async getWabaInfo(wabaId = null, accessToken = null) {
    const wid = wabaId || this.wabaId;
    const token = accessToken || this.accessToken;
    if (!wid || !token) throw new Error("WABA ID and Access Token required");

    try {
      const fields = "id,name,currency,timezone_id,message_template_namespace";
      const { data } = await axios.get(
        `${BASE_URL}/${wid}?fields=${fields}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return data;
    } catch (err) {
      throw formatMetaError(err);
    }
  }

  async subscribeWabaApp(wabaId = null, accessToken = null) {
    const wid = wabaId || this.wabaId;
    const token = accessToken || this.accessToken;
    if (!wid || !token) throw new Error("WABA ID and Access Token required");

    try {
      const { data } = await axios.post(
        `${BASE_URL}/${wid}/subscribed_apps`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return data;
    } catch (err) {
      throw formatMetaError(err);
    }
  }

  async testCredentials(phoneNumberId, accessToken, wabaId = null) {
    const pid = String(phoneNumberId || "").trim();
    const token = String(accessToken || "").trim();
    if (!pid || !token) throw new Error("Phone Number ID and Access Token are required");

    // 1. Fetch phone number info with full fields
    const phoneInfo = await this.getPhoneNumberInfo(pid, token);

    // 2. Fetch business profile
    let businessProfile = null;
    try {
      const { data } = await axios.get(
        `${BASE_URL}/${pid}/whatsapp_business_profile`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      businessProfile = data?.data?.[0] || null;
    } catch (_) {}

    // 3. If WABA ID provided, verify WABA and fetch template count
    let wabaInfo = null;
    let templateCount = null;
    const wid = String(wabaId || "").trim();
    if (wid) {
      try {
        const { data: wabaData } = await axios.get(
          `${BASE_URL}/${wid}?fields=id,name,currency,timezone_id,message_template_namespace`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        wabaInfo = wabaData;
      } catch (wErr) {
        console.warn("[Meta Cloud] WABA check notice:", wErr.message);
      }

      try {
        const { data: tmplData } = await axios.get(
          `${BASE_URL}/${wid}/message_templates?limit=100`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        templateCount = tmplData?.data?.length || 0;
      } catch (_) {}
    }

    return {
      success: true,
      phoneInfo: {
        id: phoneInfo.id || pid,
        display_phone_number: phoneInfo.display_phone_number || "",
        verified_name: phoneInfo.verified_name || "",
        quality_rating: phoneInfo.quality_rating || "UNKNOWN",
        messaging_limit_tier: phoneInfo.messaging_limit_tier || "TIER_1K",
        code_verification_status: phoneInfo.code_verification_status || "VERIFIED",
        platform_type: phoneInfo.platform_type || "CLOUD_API",
        status: phoneInfo.status || "CONNECTED",
      },
      businessProfile,
      wabaInfo,
      templateCount,
    };
  }

  async testSend(to, text = "Hello from Madhura CRM! Your Meta WhatsApp Cloud API connection is verified and active. 🚀") {
    if (!this.isConfigured()) throw new Error("WhatsApp Cloud API is not configured");
    return this.sendText(to, text);
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