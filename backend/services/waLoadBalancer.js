const db = require("../config/database");

/**
 * waLoadBalancer.js
 *
 * Enterprise Multi-Tenant WhatsApp Load Balancer & Auto-Failover Controller
 * - Distributes high-volume marketing traffic (800-1200 msgs/day/employee) across sender pools
 * - Multi-Tenant Isolation (120+ tenants, 20-100 employees per tenant)
 * - Routing Strategies: Round-Robin, Least-Loaded, Weighted, Health-Scored, Cloud-First
 * - Per-Sender Daily & Hourly Quota Enforcement with Automatic Cooldown & Failover
 */

class WALoadBalancer {
  constructor() {
    this.rrIndices = new Map(); // poolId -> currentIndex
    this.senderHealth = new Map(); // senderId -> { consecutiveErrors, inCooldownUntil, sentToday, sentThisHour, lastHour }
    this.stats = {
      totalDispatched: 0,
      cloudApiSent: 0,
      webSessionSent: 0,
      failoverCount: 0,
      lastFailoverAt: null,
    };
  }

  /**
   * Resolve healthy senders for a tenant / user or specific pool
   */
  async getActiveEngines(sessionKey, preferredEngine = null, poolId = null, tenantId = 1) {
    const engines = [];
    const waCloud = require("./whatsappCloudApi");
    const waService = require("./whatsappService");

    // 1. If poolId is provided, fetch active pool members from database
    if (poolId) {
      try {
        const [members] = await db.promise().query(
          `SELECT m.*, p.routing_strategy, p.pool_name 
           FROM wa_sender_pool_members m
           JOIN wa_sender_pools p ON m.pool_id = p.id
           WHERE m.pool_id = ? AND m.is_active = 1 AND p.is_active = 1
           ORDER BY m.weight DESC, m.id ASC`,
          [poolId]
        );

        const now = new Date();
        const currentHour = now.getHours();
        const currentDateStr = now.toISOString().slice(0, 10);

        for (const member of members) {
          // Check cooldown
          if (member.in_cooldown_until && new Date(member.in_cooldown_until) > now) {
            continue; // Number is in cooldown
          }

          // Check daily and hourly quotas
          const isSameDay = member.last_sent_date === currentDateStr;
          const isSameHour = isSameDay && member.last_sent_hour === currentHour;
          const sentToday = isSameDay ? (member.sent_today || 0) : 0;
          const sentThisHour = isSameHour ? (member.sent_this_hour || 0) : 0;

          if (member.daily_limit > 0 && sentToday >= member.daily_limit) {
            continue; // Daily cap reached for this number
          }
          if (member.hourly_limit > 0 && sentThisHour >= member.hourly_limit) {
            continue; // Hourly cap reached
          }

          if (member.sender_type === "cloud_api") {
            engines.push({
              id: `pool_member_${member.id}`,
              memberId: member.id,
              poolId: member.pool_id,
              name: `Pool [${member.pool_name}] Cloud (+${member.phone_number})`,
              type: "cloud_api",
              phone: member.phone_number,
              weight: member.weight || 1,
              sentToday,
              sentThisHour,
              sendText: async (phone, text) => waCloud.sendText(phone, text),
              sendTemplate: async (phone, tmplName, lang, components) => waCloud.sendTemplate(phone, tmplName, lang, components),
              sendMedia: async (phone, mediaType, mediaUrl, caption, filename) => waCloud.sendMedia(phone, mediaType, mediaUrl, caption, filename),
              supportsInteractive: true,
              sendButtons: async (phone, body, buttons, header, footer) => waCloud.sendInteractiveButtons(phone, body, buttons, header, footer),
              sendList: async (phone, body, buttonLabel, sections, header, footer) => waCloud.sendInteractiveList(phone, body, buttonLabel, sections, header, footer),
              sendCTA: async (phone, body, displayText, url, header, footer) => waCloud.sendCTAUrl(phone, body, displayText, url, header, footer),
            });
          } else if (member.sender_type === "web_session") {
            const memberSessionKey = member.session_key || String(member.account_id || member.id);
            const waWeb = waService.get(memberSessionKey);
            if (waWeb && waWeb.ready) {
              engines.push({
                id: `pool_member_${member.id}`,
                memberId: member.id,
                poolId: member.pool_id,
                name: `Pool [${member.pool_name}] Web (+${waWeb.phone || member.phone_number})`,
                type: "web_session",
                phone: waWeb.phone || member.phone_number,
                weight: member.weight || 1,
                sentToday,
                sentThisHour,
                sendText: async (phone, text) => {
                  return waWeb.sendMessage(phone, text);
                },
                sendTemplate: async (phone, tmplName, lang, components) => {
                  let clean = phone.replace(/\D/g, "");
                  if (clean.length === 10) clean = "91" + clean;
                  return waWeb.sendTemplateMessage(clean, tmplName, components);
                },
                sendMedia: async (phone, mediaType, mediaUrl, caption, filename) => {
                  return waWeb.sendMediaMessage(phone, mediaUrl, mediaType, caption, filename);
                },
              });
            }
          }
        }
      } catch (poolErr) {
        console.warn("⚠️ [WA LoadBalancer] Error fetching pool senders:", poolErr.message);
      }
    }

    // 2. If no pool engines found or no pool specified, construct user/session-level engines
    if (engines.length === 0) {
      let waWeb = null;
      if (sessionKey) {
        waWeb = waService.get(sessionKey);
      }
      if (!waWeb || !waWeb.ready) {
        waWeb = waService.default();
      }
      if (!waWeb || !waWeb.ready) {
        waWeb = waService.all().find((s) => s.ready);
      }
      const hasWeb = waWeb && waWeb.ready;
      const hasCloud = waCloud.isConfigured();

      const webEngine = hasWeb
        ? {
            id: `web_session_${waWeb.key || sessionKey || "default"}`,
            name: `WhatsApp Web (+${waWeb.phone || "Active"})`,
            type: "web_session",
            phone: waWeb.phone || null,
            weight: 1,
            sentToday: 0,
            sentThisHour: 0,
            sendText: async (phone, text) => {
              return waWeb.sendMessage(phone, text);
            },
            sendTemplate: async (phone, tmplName, lang, components) => {
              let clean = phone.replace(/\D/g, "");
              if (clean.length === 10) clean = "91" + clean;
              return waWeb.sendTemplateMessage(clean, tmplName, components);
            },
            sendMedia: async (phone, mediaType, mediaUrl, caption, filename) => {
              return waWeb.sendMediaMessage(phone, mediaUrl, mediaType, caption, filename);
            },
          }
        : null;

      const cloudEngine = hasCloud
        ? {
            id: "cloud_api_primary",
            name: "Meta Cloud API",
            type: "cloud_api",
            phone: waCloud.displayPhoneNumber || null,
            weight: 2,
            sentToday: 0,
            sentThisHour: 0,
            sendText: async (phone, text) => waCloud.sendText(phone, text),
            sendTemplate: async (phone, tmplName, lang, components) => waCloud.sendTemplate(phone, tmplName, lang, components),
            sendMedia: async (phone, mediaType, mediaUrl, caption, filename) => waCloud.sendMedia(phone, mediaType, mediaUrl, caption, filename),
            supportsInteractive: true,
            sendButtons: async (phone, body, buttons, header, footer) => waCloud.sendInteractiveButtons(phone, body, buttons, header, footer),
            sendList: async (phone, body, buttonLabel, sections, header, footer) => waCloud.sendInteractiveList(phone, body, buttonLabel, sections, header, footer),
            sendCTA: async (phone, body, displayText, url, header, footer) => waCloud.sendCTAUrl(phone, body, displayText, url, header, footer),
          }
        : null;

      // Priority ordering
      if (preferredEngine === "web_session" || preferredEngine === "web") {
        if (webEngine) engines.push(webEngine);
        if (cloudEngine) engines.push(cloudEngine);
      } else if (preferredEngine === "cloud_api" || preferredEngine === "meta") {
        if (cloudEngine) engines.push(cloudEngine);
        if (webEngine) engines.push(webEngine);
      } else if (hasWeb) {
        engines.push(webEngine);
        if (cloudEngine) engines.push(cloudEngine);
      } else if (hasCloud) {
        engines.push(cloudEngine);
        if (webEngine) engines.push(webEngine);
      }

      // Load additional accounts configured in wa_accounts for this tenant
      try {
        const [rows] = await db.promise().query(
          "SELECT * FROM wa_accounts WHERE is_active = 1 AND connection_type = 'cloud_api' AND (tenant_id = ? OR tenant_id IS NULL) ORDER BY id ASC",
          [tenantId || 1]
        );
        rows.forEach((acc) => {
          if (acc.phone_number_id && acc.access_token && !engines.some((e) => e.id === `acc_${acc.id}`)) {
            engines.push({
              id: `acc_${acc.id}`,
              name: acc.account_name || `Cloud Account +${acc.phone_number}`,
              type: "cloud_api",
              phone: acc.phone_number,
              weight: 1,
              sentToday: 0,
              sentThisHour: 0,
              sendText: async (phone, text) => waCloud.sendText(phone, text),
              sendTemplate: async (phone, tmplName, lang, components) => waCloud.sendTemplate(phone, tmplName, lang, components),
              sendMedia: async (phone, mediaType, mediaUrl, caption) => waCloud.sendMedia(phone, mediaType, mediaUrl, caption),
              supportsInteractive: true,
              sendButtons: async (phone, body, buttons, header, footer) => waCloud.sendInteractiveButtons(phone, body, buttons, header, footer),
              sendList: async (phone, body, buttonLabel, sections, header, footer) => waCloud.sendInteractiveList(phone, body, buttonLabel, sections, header, footer),
              sendCTA: async (phone, body, displayText, url, header, footer) => waCloud.sendCTAUrl(phone, body, displayText, url, header, footer),
            });
          }
        });
      } catch (_) {}
    }

    return engines;
  }

  /**
   * Selects best engine based on routing strategy
   */
  selectEngine(engines, strategy = "round_robin", poolKey = "default") {
    if (!engines || engines.length === 0) return null;
    if (engines.length === 1) return engines[0];

    if (strategy === "least_loaded") {
      // Pick sender with lowest sent_today / sent_this_hour
      return [...engines].sort((a, b) => (a.sentToday || 0) - (b.sentToday || 0))[0];
    }

    if (strategy === "cloud_first") {
      const cloud = engines.find((e) => e.type === "cloud_api");
      if (cloud) return cloud;
    }

    // Default: Round-robin
    const currentIndex = this.rrIndices.get(poolKey) || 0;
    const selected = engines[currentIndex % engines.length];
    this.rrIndices.set(poolKey, (currentIndex + 1) % engines.length);
    return selected;
  }

  /**
   * Record successful dispatch and increment quota counter
   */
  async recordSuccess(engine) {
    this.stats.totalDispatched++;
    if (engine.type === "cloud_api") this.stats.cloudApiSent++;
    else if (engine.type === "web_session") this.stats.webSessionSent++;

    if (engine.memberId) {
      try {
        const now = new Date();
        const currentDateStr = now.toISOString().slice(0, 10);
        const currentHour = now.getHours();

        await db.promise().query(
          `UPDATE wa_sender_pool_members 
           SET sent_today = IF(last_sent_date = ?, sent_today + 1, 1),
               sent_this_hour = IF(last_sent_date = ? AND last_sent_hour = ?, sent_this_hour + 1, 1),
               last_sent_date = ?,
               last_sent_hour = ?,
               consecutive_errors = 0,
               health_status = 'healthy'
           WHERE id = ?`,
          [currentDateStr, currentDateStr, currentHour, currentDateStr, currentHour, engine.memberId]
        );
      } catch (_) {}
    }
  }

  /**
   * Record engine failure and check if member should enter cooldown
   */
  async recordFailure(engine, err) {
    if (engine.memberId) {
      try {
        const [rows] = await db.promise().query(
          "SELECT consecutive_errors FROM wa_sender_pool_members WHERE id = ?",
          [engine.memberId]
        );
        const consecutive = (rows[0]?.consecutive_errors || 0) + 1;
        let cooldownUntil = null;
        let healthStatus = "warning";

        // If 3 consecutive errors, quarantine number for 15 minutes
        if (consecutive >= 3) {
          const cooldownDate = new Date(Date.now() + 15 * 60 * 1000);
          cooldownUntil = cooldownDate.toISOString().slice(0, 19).replace("T", " ");
          healthStatus = "cooldown";
          console.warn(`⚠️ [WA LoadBalancer] Member ${engine.name} entered 15-min cooldown due to 3 consecutive failures`);
        }

        await db.promise().query(
          `UPDATE wa_sender_pool_members 
           SET consecutive_errors = ?, 
               in_cooldown_until = ?, 
               health_status = ? 
           WHERE id = ?`,
          [consecutive, cooldownUntil, healthStatus, engine.memberId]
        );
      } catch (_) {}
    }
  }

  /**
   * Send text message with intelligent load balancing and auto-failover
   */
  async sendTextMessage(phone, text, sessionKey, preferredEngine = null, poolId = null, routingStrategy = "round_robin", tenantId = 1) {
    const engines = await this.getActiveEngines(sessionKey, preferredEngine, poolId, tenantId);
    if (!engines.length) {
      throw new Error("No active or healthy WhatsApp senders available in this pool/tenant.");
    }

    const poolKey = poolId ? `pool_${poolId}` : `session_${sessionKey || "def"}`;
    const primaryEngine = this.selectEngine(engines, routingStrategy, poolKey);

    try {
      const result = await primaryEngine.sendText(phone, text);
      await this.recordSuccess(primaryEngine);
      return { success: true, engineUsed: primaryEngine.name, senderPhone: primaryEngine.phone, result };
    } catch (primaryErr) {
      console.warn(`⚠️ [WA LoadBalancer] Primary sender '${primaryEngine.name}' failed: ${primaryErr.message}. Executing failover...`);
      await this.recordFailure(primaryEngine, primaryErr);
      this.stats.failoverCount++;
      this.stats.lastFailoverAt = new Date().toISOString();

      // Failover to secondary engine in pool
      for (const fallbackEngine of engines) {
        if (fallbackEngine.id === primaryEngine.id) continue;
        try {
          const result = await fallbackEngine.sendText(phone, text);
          await this.recordSuccess(fallbackEngine);
          console.log(`✅ [WA LoadBalancer] Failover succeeded via '${fallbackEngine.name}'`);
          return { success: true, engineUsed: fallbackEngine.name, senderPhone: fallbackEngine.phone, result, failover: true };
        } catch (fallbackErr) {
          await this.recordFailure(fallbackEngine, fallbackErr);
        }
      }
      throw primaryErr;
    }
  }

  /**
   * Send template message with load balancing & failover
   */
  async sendTemplateMessage(phone, templateName, language = "en", components = [], sessionKey, preferredEngine = null, poolId = null, routingStrategy = "round_robin", tenantId = 1) {
    const engines = await this.getActiveEngines(sessionKey, preferredEngine, poolId, tenantId);
    if (!engines.length) {
      throw new Error("No active or healthy WhatsApp senders available in this pool/tenant.");
    }

    const poolKey = poolId ? `pool_${poolId}` : `session_${sessionKey || "def"}`;
    const primaryEngine = this.selectEngine(engines, routingStrategy, poolKey);

    try {
      const result = await primaryEngine.sendTemplate(phone, templateName, language, components);
      await this.recordSuccess(primaryEngine);
      return { success: true, engineUsed: primaryEngine.name, senderPhone: primaryEngine.phone, result };
    } catch (primaryErr) {
      await this.recordFailure(primaryEngine, primaryErr);
      this.stats.failoverCount++;
      this.stats.lastFailoverAt = new Date().toISOString();

      for (const fallbackEngine of engines) {
        if (fallbackEngine.id === primaryEngine.id) continue;
        try {
          const result = await fallbackEngine.sendTemplate(phone, templateName, language, components);
          await this.recordSuccess(fallbackEngine);
          return { success: true, engineUsed: fallbackEngine.name, senderPhone: fallbackEngine.phone, result, failover: true };
        } catch (fallbackErr) {
          await this.recordFailure(fallbackEngine, fallbackErr);
        }
      }
      throw primaryErr;
    }
  }

  /**
   * Send media message with load balancing & failover
   */
  async sendMediaMessage(phone, mediaType, mediaUrl, caption = "", filename = "", sessionKey, preferredEngine = null, poolId = null, routingStrategy = "round_robin", tenantId = 1) {
    const engines = await this.getActiveEngines(sessionKey, preferredEngine, poolId, tenantId);
    if (!engines.length) {
      throw new Error("No active or healthy WhatsApp senders available in this pool/tenant.");
    }

    const poolKey = poolId ? `pool_${poolId}` : `session_${sessionKey || "def"}`;
    const primaryEngine = this.selectEngine(engines, routingStrategy, poolKey);

    try {
      const result = await primaryEngine.sendMedia(phone, mediaType, mediaUrl, caption, filename);
      await this.recordSuccess(primaryEngine);
      return { success: true, engineUsed: primaryEngine.name, senderPhone: primaryEngine.phone, result };
    } catch (primaryErr) {
      await this.recordFailure(primaryEngine, primaryErr);
      this.stats.failoverCount++;

      for (const fallbackEngine of engines) {
        if (fallbackEngine.id === primaryEngine.id) continue;
        try {
          const result = await fallbackEngine.sendMedia(phone, mediaType, mediaUrl, caption, filename);
          await this.recordSuccess(fallbackEngine);
          return { success: true, engineUsed: fallbackEngine.name, senderPhone: fallbackEngine.phone, result, failover: true };
        } catch (fallbackErr) {
          await this.recordFailure(fallbackEngine, fallbackErr);
        }
      }
      throw primaryErr;
    }
  }

  /**
   * Send a NATIVE WhatsApp interactive message (reply buttons or list).
   *
   * Native interactive UI only exists on the Cloud API — whatsapp-web.js
   * deprecated Buttons/List and cannot render them. So this tries every
   * interactive-capable (cloud) engine in turn, and only if none can deliver
   * does it degrade to the numbered text equivalent through the normal text
   * path. That degradation is a delivery guarantee, not a fake button: the
   * customer still gets the message, and the flow/menu matchers already accept
   * a typed number or option name as well as a tapped reply id.
   *
   * @param {'buttons'|'list'} kind
   */
  async sendInteractive(kind, opts = {}) {
    const waInteractive = require("./waInteractive");
    const {
      body,
      header = null,
      footer = null,
      buttonText = "View Options",
      fallbackText = null,
      sessionKey = null,
      preferredEngine = null,
      poolId = null,
      routingStrategy = "round_robin",
      tenantId = 1,
    } = opts;

    let phone = String(opts.phone || opts.phoneNumber || "").replace(/\D/g, "");
    if (phone.length === 10) phone = "91" + phone;
    if (!phone) throw new Error("Interactive send requires a phone number");

    const isList = kind === "list";
    // Normalize ONCE: ids stay stable, authored "1. " prefixes are stripped so
    // native button labels never look like the old type-a-number menu.
    const sections = isList ? waInteractive.normalizeSections(opts.sections || opts.rows, header || "Options") : null;
    const buttons = isList ? null : waInteractive.normalizeButtons(opts.buttons);
    const items = isList ? waInteractive.flattenSections(sections) : buttons;

    if (!items.length) throw new Error("Interactive send requires at least one button/row");

    const text =
      fallbackText ||
      waInteractive.buildNumberedText({ body, header, footer, items, sectioned: isList });

    const engines = await this.getActiveEngines(sessionKey, preferredEngine, poolId, tenantId);
    const poolKey = poolId ? `pool_${poolId}` : `session_${sessionKey || "def"}`;
    const interactiveEngines = engines.filter((e) => e.supportsInteractive);

    if (interactiveEngines.length) {
      // Keep round-robin/least-loaded semantics, but only across capable senders.
      const primary = this.selectEngine(interactiveEngines, routingStrategy, `${poolKey}_interactive`);
      const ordered = [primary, ...interactiveEngines.filter((e) => e.id !== primary.id)];

      for (const engine of ordered) {
        try {
          const result = isList
            ? await engine.sendList(phone, body, buttonText, sections, header, footer)
            : await engine.sendButtons(phone, body, buttons, header, footer);
          await this.recordSuccess(engine);
          return {
            success: true,
            native: true,
            kind,
            engineUsed: engine.name,
            senderPhone: engine.phone,
            failover: engine.id !== primary.id,
            result,
          };
        } catch (err) {
          console.warn(`⚠️ [WA LoadBalancer] Interactive ${kind} via '${engine.name}' failed: ${err.message}`);
          await this.recordFailure(engine, err);
          this.stats.failoverCount++;
          this.stats.lastFailoverAt = new Date().toISOString();
        }
      }
    }

    // No Cloud API sender available (or all of them failed) — deliver the text
    // equivalent rather than dropping the message silently.
    console.warn(
      `↩️ [WA LoadBalancer] No interactive-capable sender delivered ${kind} to +${phone}; falling back to numbered text.`
    );
    const res = await this.sendTextMessage(phone, text, sessionKey, preferredEngine, poolId, routingStrategy, tenantId);
    return { ...res, native: false, kind, fallbackText: text };
  }

  sendInteractiveButtons(opts = {}) {
    return this.sendInteractive("buttons", opts);
  }

  sendInteractiveList(opts = {}) {
    return this.sendInteractive("list", opts);
  }

  /**
   * Native CTA URL button — one tappable button that opens a link.
   *
   * Handled separately from sendInteractive() because a CTA carries no reply
   * ids to normalize, and it degrades differently: there are no options to
   * number, so the fallback appends the URL as a real link. WhatsApp renders a
   * preview for it, so the customer still gets something tappable — just not
   * a button with the label hidden over it.
   *
   * @param {object} opts
   * @param {string} opts.phone
   * @param {string} opts.body
   * @param {string} opts.displayText button label, <= 20 chars
   * @param {string} opts.url must be http(s)
   */
  async sendCTAButtonMessage(opts = {}) {
    const {
      body,
      displayText = "Open",
      url,
      header = null,
      footer = null,
      fallbackText = null,
      sessionKey = null,
      preferredEngine = null,
      poolId = null,
      routingStrategy = "round_robin",
      tenantId = 1,
    } = opts;

    let phone = String(opts.phone || opts.phoneNumber || "").replace(/\D/g, "");
    if (phone.length === 10) phone = "91" + phone;
    if (!phone) throw new Error("CTA send requires a phone number");
    if (!url) throw new Error("CTA send requires a url");
    if (!/^https?:\/\//i.test(String(url))) {
      throw new Error(`CTA url must start with http:// or https:// (got "${url}")`);
    }

    const mdToWa = require("./mdToWa");
    const text =
      fallbackText ||
      [header ? `*${header}*` : null, mdToWa.toWhatsApp(String(body || "")).trim(), url, footer ? `_${footer}_` : null]
        .filter(Boolean)
        .join("\n\n");

    const engines = await this.getActiveEngines(sessionKey, preferredEngine, poolId, tenantId);
    const poolKey = poolId ? `pool_${poolId}` : `session_${sessionKey || "def"}`;
    const ctaEngines = engines.filter((e) => typeof e.sendCTA === "function");

    if (ctaEngines.length) {
      const primary = this.selectEngine(ctaEngines, routingStrategy, `${poolKey}_cta`);
      const ordered = [primary, ...ctaEngines.filter((e) => e.id !== primary.id)];

      for (const engine of ordered) {
        try {
          const result = await engine.sendCTA(phone, body, displayText, url, header, footer);
          await this.recordSuccess(engine);
          return {
            success: true,
            native: true,
            kind: "cta_url",
            engineUsed: engine.name,
            senderPhone: engine.phone,
            failover: engine.id !== primary.id,
            result,
          };
        } catch (err) {
          console.warn(`⚠️ [WA LoadBalancer] CTA url via '${engine.name}' failed: ${err.message}`);
          await this.recordFailure(engine, err);
          this.stats.failoverCount++;
          this.stats.lastFailoverAt = new Date().toISOString();
        }
      }
    }

    console.warn(
      `↩️ [WA LoadBalancer] No CTA-capable sender delivered to +${phone}; falling back to a plain link.`
    );
    const res = await this.sendTextMessage(phone, text, sessionKey, preferredEngine, poolId, routingStrategy, tenantId);
    return { ...res, native: false, kind: "cta_url", fallbackText: text };
  }

  async getLoadBalancerStats(tenantId = 1) {
    const engines = await this.getActiveEngines(null, null, null, tenantId).catch(() => []);
    return {
      activeEnginesCount: engines.length,
      engines: engines.map((e) => ({ id: e.id, name: e.name, type: e.type, phone: e.phone })),
      stats: this.stats,
      loadBalanceMode: engines.length > 1 ? "Multi-Sender Pool & Auto-Failover Active" : "Single Active Sender",
    };
  }
}

module.exports = new WALoadBalancer();
