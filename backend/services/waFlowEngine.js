const axios = require("axios");
const db = require("../config/database");

/**
 * WhatsApp Conversational Flow State-Machine Engine
 * Manages multi-turn chatbot flows, dynamic CRM lookups, API webhooks,
 * AI intent routing, input capture, universal 24/7 triggers, interactive buttons,
 * branching, and human handoff.
 */

class WaFlowEngine {
  /**
   * Helper: Escape regex special characters
   */
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Read a flow's configured trigger keywords (tolerates the legacy single
   * `keyword` field and a JSON-string trigger_config).
   */
  getTriggerKeywords(flow) {
    let cfg = {};
    try {
      cfg = typeof flow?.trigger_config === "string"
        ? JSON.parse(flow.trigger_config)
        : (flow?.trigger_config || {});
    } catch (_) {}
    const kws = cfg.keywords || (cfg.keyword ? [cfg.keyword] : []);
    return Array.isArray(kws) ? kws.map((k) => String(k || "").toLowerCase().trim()).filter(Boolean) : [];
  }

  /**
   * Helper: Check if a flow is eligible for keyword triggers.
   * Only flows explicitly configured with trigger_type === 'keyword' are keyword-eligible.
   */
  isKeywordEligible(flow) {
    return flow?.trigger_type === "keyword";
  }

  /**
   * Does this inbound message fire the flow's keyword trigger?
   * Single source of truth — starting a flow from idle and switching flows
   * mid-conversation previously used two different, silently inconsistent rule
   * sets, so a phrase like "invoice status please" would start the invoice flow
   * when idle but not switch to it mid-chat.
   *
   * strict = true is used for mid-conversation switching: only a deliberate,
   * command-like message may hijack a running flow, otherwise a passing mention
   * inside an answer ("the AC broke, and my invoice is wrong") would discard
   * everything the customer already typed.
   */
  matchesTriggerKeywords(rawText, flow, { strict = false } = {}) {
    const raw = String(rawText || "").trim();
    const lower = raw.toLowerCase();
    if (!lower) return false;

    const keywords = this.getTriggerKeywords(flow);
    if (!keywords.length) return false;

    return keywords.some((kw) => {
      // Exact match
      if (lower === kw) return true;
      // Keyword followed by a separator: "invoice, please" / "invoice!" / "menu?"
      if (lower.startsWith(kw) && /^[\s,.!?:;-]/.test(lower.slice(kw.length))) return true;
      if (strict) return false;

      // Exact whole-word match or keyword at start followed by punctuation/space
      try {
        if (new RegExp(`^${this.escapeRegex(kw)}$`, "i").test(lower)) return true;
        if (new RegExp(`^#?${this.escapeRegex(kw)}[\\s,.!?:;-]`, "i").test(raw)) return true;
        if (new RegExp(`^#${this.escapeRegex(kw)}$`, "i").test(raw)) return true;
        if (new RegExp(`\\b${this.escapeRegex(kw)}\\b`, "i").test(raw) && kw.length >= 4) return true;
      } catch (_) {}
      return false;
    });
  }

  /**
   * Normalize a flow media reference.
   * - Resolves relative/uploaded paths ("/uploads/wa-media/x.pdf") to an absolute
   *   public URL so both WhatsApp Web and Meta Cloud API can fetch the file.
   * - Infers the WhatsApp media type (image | video | audio | document) from the
   *   file extension so a mislabelled node still delivers.
   * Returns null when there is nothing sendable.
   */
  resolveMedia(rawUrl, declaredType = "", declaredFilename = "") {
    const url = String(rawUrl || "").trim();
    if (!url) return null;

    let absolute = url;
    if (!/^https?:\/\//i.test(absolute)) {
      const base = String(
        process.env.PUBLIC_BASE_URL || process.env.REACT_APP_API_URL || ""
      ).replace(/\/+$/, "");
      if (!base) return null; // relative path with no public base — WhatsApp could never fetch it
      absolute = `${base}/${absolute.replace(/^\/+/, "")}`;
    }

    const path = absolute.split("?")[0];
    const ext = (path.match(/\.([a-z0-9]+)$/i) || [, ""])[1].toLowerCase();
    const BY_EXT = {
      jpg: "image", jpeg: "image", png: "image", webp: "image", gif: "image",
      mp4: "video", mov: "video", "3gp": "video", mkv: "video",
      mp3: "audio", ogg: "audio", wav: "audio", m4a: "audio", aac: "audio",
    };

    let type = String(declaredType || "").toLowerCase();
    if (["pdf", "doc", "docx", "xls", "xlsx", "csv", "excel", "txt", "ppt", "pptx", "file"].includes(type)) {
      type = "document";
    }
    if (!["image", "video", "audio", "document"].includes(type)) {
      type = BY_EXT[ext] || "document";
    } else if (type !== "document") {
      // An explicit "document" is always honoured; other types must match the real file
      type = BY_EXT[ext] || "document";
    }

    const filename =
      declaredFilename || decodeURIComponent(path.split("/").pop() || "attachment");

    return { url: absolute, type, filename };
  }

  /**
   * Record outbound bot message in database & broadcast live WebSocket event to CRM chat
   */
   async recordAndEmitBotMessage(phone, text, type = "text", interactivePayload = null) {
    let cleanPhone = String(phone || "").replace(/\D/g, "");
    if (cleanPhone.length === 10) cleanPhone = "91" + cleanPhone;
    const chatId = `${cleanPhone}@c.us`;
    const msgId = "bot_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);

    // 1. Insert DB log for audit & live chat history
    await db.promise().query(
      `INSERT INTO wa_message_logs (phone, direction, message_type, message_text, wa_message_id, status, interactive_payload, created_at)
       VALUES (?, 'outbound', ?, ?, ?, 'delivered', ?, NOW())`,
      [cleanPhone, type, text, msgId, interactivePayload ? JSON.stringify(interactivePayload) : null]
    ).catch(() => {});

    // 2. Update wa_contacts last_message
    await db.promise().query(
      `INSERT INTO wa_contacts (name, phone, country_code, source, opt_in_status, last_message_text, last_message_at, unread_count)
       VALUES (?, ?, '91', 'WhatsApp Chat', 1, ?, NOW(), 0)
       ON DUPLICATE KEY UPDATE
         last_message_text = VALUES(last_message_text),
         last_message_at = NOW()`,
      ["Customer", cleanPhone, text]
    ).catch(() => {});

    // 3. Emit real-time Socket event (< 1ms) to update CRM Live Chat
    try {
      const app = require("../server");
      const io = app.get && app.get("io");
      if (io) {
        const liveMsg = {
          id: msgId,
          from: "me",
          to: cleanPhone,
          body: text,
          timestamp: Math.floor(Date.now() / 1000),
          isMe: true,
          type: type,
          status: "delivered",
          interactive: interactivePayload,
        };
        io.emit("wa_message_sent", { phone: cleanPhone, chatId, message: liveMsg });
        io.emit("wa_message", { phone: cleanPhone, chatId, message: liveMsg });
      }
    } catch (_) {}

    return msgId;
  }

  async markBotMessageFailed(msgId, phone, errorMessage = "") {
    if (!msgId) return;
    let cleanPhone = String(phone || "").replace(/\D/g, "");
    if (cleanPhone.length === 10) cleanPhone = "91" + cleanPhone;
    await db.promise().query(
      "UPDATE wa_message_logs SET status = 'failed' WHERE wa_message_id = ?",
      [msgId]
    ).catch(() => {});
    try {
      const app = require("../server");
      const io = app.get && app.get("io");
      if (io) {
        io.emit("wa_message_failed", { phone: cleanPhone, msgId, error: errorMessage });
        io.emit("wa_message_status", { id: msgId, status: "failed", error: errorMessage });
      }
    } catch (_) {}
  }

  /**
   * Dispatch inbound message to any active flow run or trigger a new flow.
   * Returns true if message was consumed by a flow, false otherwise.
   */
  async dispatchInbound(phone, messageText, interactiveReplyId = null, sessionKey = null, inboundMedia = null, options = {}) {
    if (!phone) return false;
    if (options.isHistoric) return false;
    const cleanPhone = phone.replace(/\D/g, "");

    // A live agent takeover, a previous handoff, or a per-contact bot switch
    // mutes the flow bot — including advancing a run that is already open.
    // Without this, a `handoff` node was undone by the customer's very next
    // message, because an `all_inbound` flow simply started a fresh run.
    if (!(await require("./waBotGate").botMayReply(cleanPhone, "Flow bot", options))) {
      return true; // treat as handled so no downstream auto-reply fires either
    }

    try {
      // 1. Check for an active flow run for this phone
      const [activeRuns] = await db.promise().query(
        `SELECT r.*, f.fallback_policy, f.name as flow_name, f.trigger_type, f.trigger_config, f.entry_node_key
         FROM wa_flow_runs r
         JOIN wa_flows f ON r.flow_id = f.id
         WHERE r.phone LIKE ? AND r.status = 'active'
         ORDER BY r.id DESC LIMIT 1`,
        [`%${cleanPhone.slice(-10)}`]
      );

      // Check if run is stale (> 4 hours since last activity)
      let isStale = false;
      if (activeRuns && activeRuns.length > 0) {
        const run = activeRuns[0];
        const lastActive = new Date(run.last_advanced_at || run.started_at).getTime();
        if (Date.now() - lastActive > 4 * 60 * 60 * 1000) {
          isStale = true;
        }
      }

      // If active run exists and is fresh (and not an explicit new keyword trigger), advance it
      if (activeRuns && activeRuns.length > 0 && !isStale) {
        const run = activeRuns[0];

        // Check if customer typed a keyword explicitly for a DIFFERENT active flow
        const [otherFlows] = await db.promise().query(
          "SELECT * FROM wa_flows WHERE status = 'active' AND id != ? ORDER BY id DESC",
          [run.flow_id]
        );

        let switchedFlow = null;
        for (const f of otherFlows) {
          if (this.isKeywordEligible(f)) {
            // strict: only a deliberate command may abandon a running flow
            if (this.matchesTriggerKeywords(messageText, f, { strict: true })) {
              switchedFlow = f;
              break;
            }
          }
        }

        if (switchedFlow) {
          console.log(`🔀 Customer switched from Flow #${run.flow_id} to Flow "${switchedFlow.name}" (#${switchedFlow.id})`);
          await this.completeRun(run.id, `switched_to_flow_${switchedFlow.id}`);
          return await this.startFlowRun(switchedFlow, cleanPhone, sessionKey, messageText);
        }

        return await this.advanceActiveRun(run, messageText, interactiveReplyId, sessionKey, inboundMedia);
      }

      // If stale run was open, mark as timed out before triggering fresh flow
      if (activeRuns && activeRuns.length > 0 && isStale) {
        await db.promise().query(
          "UPDATE wa_flow_runs SET status = 'timed_out', ended_at = NOW(), end_reason = 'inactivity_timeout' WHERE id = ?",
          [activeRuns[0].id]
        );
      }

      // 2. No active run (or reset) — check trigger rules across all active flows
      const [activeFlows] = await db.promise().query(
        "SELECT * FROM wa_flows WHERE status = 'active' ORDER BY id DESC"
      );

      if (!activeFlows || activeFlows.length === 0) {
        return false;
      }

      // Priority 1: Explicit Keyword Match Flows (Only fires if flow is configured as 'keyword' and user types exact command)
      for (const flow of activeFlows) {
        if (this.isKeywordEligible(flow)) {
          if (this.matchesTriggerKeywords(messageText, flow)) {
            console.log(`🤖 Triggering Keyword WhatsApp Flow "${flow.name}" (ID: ${flow.id}) for +${cleanPhone}`);
            return await this.startFlowRun(flow, cleanPhone, sessionKey, messageText);
          }
        }
      }

      // NOTE: Universal catch-all / all_inbound fallback is disabled.
      // Flow bots must work ONLY for given numbers when triggered via 'Send Flow Bot' or when continuing an active session.
      return false;
    } catch (err) {
      console.error("waFlowEngine dispatch error:", err.message);
      return false;
    }
  }

  /**
   * Start a brand new flow execution for a phone number
   */
  async startFlowRun(flow, phone, sessionKey = null, triggerText = "") {
    let cleanPhone = String(phone || "").replace(/\D/g, "");
    if (cleanPhone.length === 10) cleanPhone = "91" + cleanPhone;

    // Resolve entry node key intelligently if empty or not matching existing nodes
    let entryNodeKey = flow.entry_node_key || "start";
    const [matchingNodes] = await db.promise().query(
      "SELECT node_key FROM wa_flow_nodes WHERE flow_id = ? AND node_key = ? LIMIT 1",
      [flow.id, entryNodeKey]
    ).catch(() => [[]]);

    if (!matchingNodes || matchingNodes.length === 0) {
      const [triggerNodes] = await db.promise().query(
        "SELECT node_key FROM wa_flow_nodes WHERE flow_id = ? AND node_type IN ('start', 'keyword_trigger', 'all_inbound_trigger', 'first_inbound_trigger', 'trigger') ORDER BY id ASC LIMIT 1",
        [flow.id]
      ).catch(() => [[]]);

      if (triggerNodes && triggerNodes.length > 0) {
        entryNodeKey = triggerNodes[0].node_key;
      } else {
        const [firstNodes] = await db.promise().query(
          "SELECT node_key FROM wa_flow_nodes WHERE flow_id = ? ORDER BY id ASC LIMIT 1",
          [flow.id]
        ).catch(() => [[]]);
        if (firstNodes && firstNodes.length > 0) {
          entryNodeKey = firstNodes[0].node_key;
        }
      }
    }

    // Close any previous active runs for this phone
    await db.promise().query(
      "UPDATE wa_flow_runs SET status = 'completed', end_reason = 'new_flow_started', ended_at = NOW() WHERE phone LIKE ? AND status = 'active'",
      [`%${cleanPhone.slice(-10)}`]
    );

    // Deep CRM Context auto-resolution from database
    const initialVars = await this.resolveInitialCrmVars(cleanPhone);

    // The message that triggered the flow is the AI nodes' input — without it,
    // an ai_generate / ai_intent step placed before any collect_input sees nothing.
    const trimmedTrigger = String(triggerText || "").trim();
    if (trimmedTrigger) {
      initialVars.last_input = trimmedTrigger;
      initialVars.input = trimmedTrigger;
      initialVars.trigger_message = trimmedTrigger;
    }

    const [runRes] = await db.promise().query(
      `INSERT INTO wa_flow_runs (flow_id, phone, status, current_node_key, vars, reprompt_count, started_at)
       VALUES (?, ?, 'active', ?, ?, 0, NOW())`,
      [flow.id, cleanPhone, entryNodeKey, JSON.stringify(initialVars)]
    );
    const runId = runRes.insertId;

    // Increment execution count
    await db.promise().query(
      "UPDATE wa_flows SET execution_count = execution_count + 1 WHERE id = ?",
      [flow.id]
    );

    await this.logEvent(runId, entryNodeKey, "flow_started", { flowName: flow.name, initialVars });

    // Execute the entry node with resolved CRM variables
    return await this.executeNodeChain(runId, flow.id, cleanPhone, entryNodeKey, initialVars, sessionKey);
  }

  /**
   * Advance an active flow run with customer reply
   */
  async advanceActiveRun(run, messageText, interactiveReplyId, sessionKey = null, inboundMedia = null) {
    const runId = run.id;
    const cleanPhone = run.phone;
    const rawTrimmed = (messageText || "").trim();
    const lowerText = rawTrimmed.toLowerCase();

    let vars = {};
    try {
      vars = typeof run.vars === "string" ? JSON.parse(run.vars) : (run.vars || {});
    } catch (_) {}

    // Every inbound reply — typed text OR a tapped option — becomes the input that
    // ai_generate / ai_intent steps read. Without this only collect_input fed them.
    if (rawTrimmed) vars.last_input = rawTrimmed;

    // Global Command: Live Agent Transfer
    if (["agent", "human", "support", "talk to human", "representative", "person", "help desk", "live support", "executive"].includes(lowerText)) {
      await this.sendFlowMessage(cleanPhone, "👤 Transferring you to our support specialist now. Please stay online.", sessionKey);
      await db.promise().query(
        "UPDATE wa_flow_runs SET status = 'handed_off', ended_at = NOW(), end_reason = 'user_agent_command' WHERE id = ?",
        [runId]
      );
      // A human owns this conversation now — mute the whole bot, on the same
      // window a manual agent reply uses, so the bot cannot re-engage before
      // anyone has actually picked the chat up.
      await require("./waBotGate").pauseBot(cleanPhone, undefined, "customer asked for an agent");
      try {
        const app = require("../server");
        const io = app.get && app.get("io");
        if (io) io.emit("wa_agent_handoff", { phone: cleanPhone, flowId: run.flow_id, note: "Customer typed 'agent'", vars });
      } catch (_) {}
      return true;
    }

    // Global Command: Jump to Main Menu / Restart Flow
    if (["menu", "main menu", "start", "restart", "home"].includes(lowerText)) {
      const entryNode = run.entry_node_key || "start";
      await db.promise().query(
        "UPDATE wa_flow_runs SET current_node_key = ?, reprompt_count = 0, last_advanced_at = NOW() WHERE id = ?",
        [entryNode, runId]
      );
      return await this.executeNodeChain(runId, run.flow_id, cleanPhone, entryNode, vars, sessionKey);
    }

    // Load current node
    const [nodes] = await db.promise().query(
      "SELECT * FROM wa_flow_nodes WHERE flow_id = ? AND node_key = ? LIMIT 1",
      [run.flow_id, run.current_node_key]
    );
    const currentNode = nodes[0];
    if (!currentNode) {
      await this.completeRun(runId, "current_node_missing");
      return false;
    }

    let config = {};
    try {
      config = typeof currentNode.config === "string" ? JSON.parse(currentNode.config) : (currentNode.config || {});
    } catch (_) {}

    let nextNodeKey = null;

    const isInputNode = ["collect_input", "collect_number", "collect_email", "collect_date"].includes(currentNode.node_type);
    if (isInputNode) {
      const varKey = config.var_key || "input";
      const inputVal = (messageText || "").trim();
      const validationType = config.validation_type || (currentNode.node_type === "collect_number" ? "number" : currentNode.node_type === "collect_email" ? "email" : currentNode.node_type === "collect_date" ? "date" : "none");
      const strictValidation = (validationType !== "none" && validationType !== "") || !!config.regex;
      // Attachments answer free-text questions by default. A validated question
      // (email / phone / number / regex) rejects them unless explicitly opted in,
      // so a photo can never satisfy "what is your email?".
      const mediaAllowed = config.accept_media === true || (config.accept_media !== false && !strictValidation);

      if (inboundMedia && inboundMedia.hasMedia) {
        if (!mediaAllowed) {
          const repromptCount = (run.reprompt_count || 0) + 1;
          if (repromptCount >= 3) {
            return await this.handleFallback(runId, cleanPhone, run.fallback_policy, sessionKey);
          }
          await db.promise().query("UPDATE wa_flow_runs SET reprompt_count = ? WHERE id = ?", [repromptCount, runId]);
          await this.sendFlowMessage(
            cleanPhone,
            config.invalid_prompt || "Sorry, I can't read attachments for this question. Please type your answer.",
            sessionKey
          );
          return true;
        }

        // Persist the file only now that we know a step actually wants it
        const saved = typeof inboundMedia.resolve === "function"
          ? await inboundMedia.resolve().catch((e) => {
              console.warn("[WA Flow] Inbound attachment download failed:", e.message);
              return null;
            })
          : null;

        const label = inputVal || saved?.filename || inboundMedia.filename || `[${inboundMedia.type || "attachment"}]`;
        vars[varKey] = label;
        vars[`${varKey}_url`] = saved?.url || "";
        vars[`${varKey}_type`] = inboundMedia.type || "document";
        vars[`${varKey}_filename`] = saved?.filename || inboundMedia.filename || "";
        vars.last_input = label;
        vars.last_attachment_url = saved?.url || "";
        vars.last_attachment_type = inboundMedia.type || "document";

        await this.logEvent(runId, run.current_node_key, "attachment_received", {
          varKey,
          type: inboundMedia.type,
          url: saved?.url || null,
          filename: vars[`${varKey}_filename`],
        });

        nextNodeKey = config.next_node_key;
        if (!nextNodeKey) {
          await this.completeRun(runId, "flow_end_reached");
          return true;
        }
        await db.promise().query(
          "UPDATE wa_flow_runs SET vars = ?, current_node_key = ?, reprompt_count = 0, last_advanced_at = NOW() WHERE id = ?",
          [JSON.stringify(vars), nextNodeKey, runId]
        );
        return await this.executeNodeChain(runId, run.flow_id, cleanPhone, nextNodeKey, vars, sessionKey);
      }

      // Input Validation
      let isValid = true;
      let errorMsg = config.invalid_prompt || "Please enter a valid response.";

      if (validationType === "number" || currentNode.node_type === "collect_number" || config.regex === "^\\d+$") {
        isValid = /^\d+$/.test(inputVal.replace(/\s/g, ""));
        if (!isValid) errorMsg = config.invalid_prompt || "Please enter a valid number.";
      } else if (validationType === "email" || currentNode.node_type === "collect_email") {
        isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inputVal);
        if (!isValid) errorMsg = config.invalid_prompt || "Please enter a valid email address (e.g. name@example.com).";
      } else if (validationType === "date" || currentNode.node_type === "collect_date") {
        isValid = !isNaN(Date.parse(inputVal)) || /^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$/.test(inputVal);
        if (!isValid) errorMsg = config.invalid_prompt || "Please enter a valid date (e.g. DD/MM/YYYY).";
      } else if (validationType === "phone") {
        const digits = inputVal.replace(/\D/g, "");
        isValid = digits.length >= 10;
        if (!isValid) errorMsg = config.invalid_prompt || "Please enter a valid 10-digit mobile number.";
      } else if (config.regex) {
        try {
          const reg = new RegExp(config.regex);
          isValid = reg.test(inputVal);
        } catch (_) {}
      }

      if (!isValid) {
        const repromptCount = (run.reprompt_count || 0) + 1;
        if (repromptCount >= 3) {
          return await this.handleFallback(runId, cleanPhone, run.fallback_policy, sessionKey);
        }
        await db.promise().query(
          "UPDATE wa_flow_runs SET reprompt_count = ? WHERE id = ?",
          [repromptCount, runId]
        );
        await this.sendFlowMessage(cleanPhone, errorMsg, sessionKey);
        return true;
      }

      vars[varKey] = inputVal;
      vars.last_input = inputVal;
      nextNodeKey = config.next_node_key;

    } else if (currentNode.node_type === "send_buttons" || currentNode.node_type === "send_list" || currentNode.node_type === "interactive_menu") {
      const rawText = (messageText || "").trim();
      const tappedId = interactiveReplyId || rawText;
      const lowerRaw = rawText.toLowerCase();
      
      let buttons = [];
      if (Array.isArray(config.sections) && config.sections.length > 0) {
        config.sections.forEach(sec => {
          (sec.buttons || sec.options || sec.rows || []).forEach(b => {
            const bTitle = b.label || b.title || b.text || b.name || "";
            buttons.push({
              ...b,
              id: b.id || b.reply_id,
              reply_id: b.reply_id || b.id,
              title: bTitle,
              next_node_key: b.nextNodeId || b.next_node_key || b.next_node || b.target_node
            });
          });
        });
      } else {
        buttons = (config.buttons || config.rows || config.options || []).map(b => {
          const bTitle = b.label || b.title || b.text || b.name || "";
          return {
            ...b,
            id: b.id || b.reply_id,
            reply_id: b.reply_id || b.id,
            title: bTitle,
            next_node_key: b.nextNodeId || b.next_node_key || b.next_node || b.target_node
          };
        });
      }
      
      if (!Array.isArray(vars._nav_history)) vars._nav_history = [];

      // 1. Navigation Command: Back / Previous Menu
      const isBackCmd = ["0", "back", "previous", "prev", "go back", "return", "undo", "exit", "b", "p", "⬅️", "🔙", "↩️"].includes(lowerRaw);
      if (isBackCmd) {
        if (config.back_node_key) {
          nextNodeKey = config.back_node_key;
        } else if (vars._nav_history.length > 0) {
          nextNodeKey = vars._nav_history.pop();
        } else {
          nextNodeKey = run.entry_node_key || "start";
        }
        console.log(`↩️ [WA Flow] Customer navigating BACK to node: ${nextNodeKey}`);
      }

      // 2. Navigation Command: Next / More Options
      const isNextCmd = !isBackCmd && ["next", "more", "next page", "page 2", "continue", "forward", "n", "➡️"].includes(lowerRaw);
      if (isNextCmd && (config.next_page_key || config.next_node_key)) {
        nextNodeKey = config.next_page_key || config.next_node_key;
        if (!vars._nav_history.includes(run.current_node_key)) {
          vars._nav_history.push(run.current_node_key);
        }
      }

      let matchedBtn = null;

      // 3. Option Number Match: "1", "2", "3", "1.", "#1", "opt 1", "option 1", "choice 1"
      if (!nextNodeKey) {
        const numMatch = rawText.match(/^(?:option\s*|opt\s*|choice\s*|select\s*|#\s*)?(\d+)[.)]?$/i);
        if (numMatch) {
          const numVal = parseInt(numMatch[1], 10);
          if (numVal === 0) {
            nextNodeKey = config.back_node_key || (vars._nav_history.length > 0 ? vars._nav_history.pop() : (run.entry_node_key || "start"));
          } else {
            const numIdx = numVal - 1;
            if (numIdx >= 0 && numIdx < buttons.length) {
              matchedBtn = buttons[numIdx];
            }
          }
        }
      }

      // 4. Leading Number Match in user reply: "1. Services", "1 Services", "1 - Book", "2. Payment"
      if (!nextNodeKey && !matchedBtn) {
        const leadingNumMatch = rawText.match(/^(\d+)[\s.)-]+/);
        if (leadingNumMatch) {
          const leadIdx = parseInt(leadingNumMatch[1], 10) - 1;
          if (leadIdx >= 0 && leadIdx < buttons.length) {
            matchedBtn = buttons[leadIdx];
          }
        }
      }

      // 5. Interactive Reply ID / Exact ID / Exact Title Match
      if (!nextNodeKey && !matchedBtn && tappedId) {
        const tapLower = String(tappedId).toLowerCase().trim();
        matchedBtn = buttons.find(b => 
          (b.reply_id && String(b.reply_id).toLowerCase().trim() === tapLower) ||
          (b.id && String(b.id).toLowerCase().trim() === tapLower) ||
          (b.title && String(b.title).toLowerCase().trim() === tapLower)
        );
      }

      // 6. Clean Title / Fuzzy Substring & Word Match (ignoring emojis, symbols, and leading digits)
      if (!nextNodeKey && !matchedBtn && rawText.length >= 2) {
        const stripSymbols = (s) => (s || "").replace(/^\d+[\s.)-]+\s*/, "").replace(/[^\p{L}\p{N}\s]/gu, "").toLowerCase().trim();
        const cleanInput = stripSymbols(rawText);
        if (cleanInput) {
          matchedBtn = buttons.find(b => {
            if (!b.title) return false;
            const cleanTitle = stripSymbols(b.title);
            if (!cleanTitle) return false;
            if (
              cleanTitle === cleanInput ||
              cleanInput.includes(cleanTitle) ||
              cleanTitle.includes(cleanInput)
            ) {
              return true;
            }
            // Word token overlap: e.g. user typed "view menu" and button is "view full menu"
            const inputWords = cleanInput.split(/\s+/).filter(w => w.length >= 3);
            const titleWords = cleanTitle.split(/\s+/).filter(w => w.length >= 3);
            if (inputWords.length > 0 && inputWords.every(w => titleWords.includes(w))) {
              return true;
            }
            return false;
          });
        }
      }

      // 7. Configured Button Keywords / Synonyms
      if (!nextNodeKey && !matchedBtn) {
        matchedBtn = buttons.find(b => {
          if (!b.keywords) return false;
          const kws = Array.isArray(b.keywords) ? b.keywords : String(b.keywords).split(",");
          return kws.some(k => k.trim() && lowerRaw.includes(k.trim().toLowerCase()));
        });
      }
      
      // 8. Resolve target next node key with flexible property name support
      if (matchedBtn) {
        const targetNext = matchedBtn.next_node_key || matchedBtn.nextNodeId || matchedBtn.next_node || matchedBtn.target_node || matchedBtn.next;
        if (targetNext) {
          if (!vars._nav_history.includes(run.current_node_key)) {
            vars._nav_history.push(run.current_node_key);
          }
          nextNodeKey = targetNext;
          vars.selected_option = matchedBtn.title;
          vars.selected_option_id = matchedBtn.reply_id || matchedBtn.id;
        }
      }

      if (!nextNodeKey) {
        // If unrecognized reply, reprompt with clean numbered options
        const repromptCount = (run.reprompt_count || 0) + 1;
        if (repromptCount < 2 && config.fallback_node_key) {
          nextNodeKey = config.fallback_node_key;
        } else if (repromptCount < 2 && buttons.length > 0) {
          await db.promise().query("UPDATE wa_flow_runs SET reprompt_count = ? WHERE id = ?", [repromptCount, runId]);
          let promptMsg = "Please choose one of the options below (reply with option number):\n\n";
          buttons.forEach((b, idx) => {
            const cleanTitle = (b.title || `Option ${idx + 1}`).replace(/^\d+[\s.)-]+\s*/, "").trim();
            promptMsg += `*${idx + 1}.* ${cleanTitle}\n`;
          });
          promptMsg += "\n_Reply with option number (1, 2, 3...) or MENU for main menu._";
          await this.sendFlowMessage(cleanPhone, promptMsg, sessionKey);
          return true;
        } else {
          const firstBtn = buttons[0];
          nextNodeKey = config.fallback_node_key || config.next_node_key || (firstBtn && (firstBtn.next_node_key || firstBtn.next_node || firstBtn.target_node));
        }
      }
    } else {
      nextNodeKey = config.next_node_key;
    }

    if (!nextNodeKey) {
      await this.completeRun(runId, "flow_end_reached");
      return true;
    }

    // Save updated vars
    await db.promise().query(
      "UPDATE wa_flow_runs SET vars = ?, current_node_key = ?, reprompt_count = 0, last_advanced_at = NOW() WHERE id = ?",
      [JSON.stringify(vars), nextNodeKey, runId]
    );

    return await this.executeNodeChain(runId, run.flow_id, cleanPhone, nextNodeKey, vars, sessionKey);
  }

  /**
   * Sequentially execute nodes until a suspension node (collect_input / send_buttons / send_list) or end is reached
   */
  async executeNodeChain(runId, flowId, phone, startNodeKey, currentVars, sessionKey = null) {
    let cleanPhone = String(phone || "").replace(/\D/g, "");
    if (cleanPhone.length === 10) cleanPhone = "91" + cleanPhone;

    let nodeKey = startNodeKey;
    let vars = { ...currentVars };
    let safetyCounter = 0;

    while (nodeKey && safetyCounter < 25) {
      safetyCounter++;

      const [nodes] = await db.promise().query(
        "SELECT * FROM wa_flow_nodes WHERE flow_id = ? AND node_key = ? LIMIT 1",
        [flowId, nodeKey]
      );
      let node = nodes[0];
      if (!node) {
        // Fallback: If nodeKey not found (e.g. entry_node_key is "start" but nodes start with trigger),
        // try to find trigger/start node, or first node of flow
        const [fallbackNodes] = await db.promise().query(
          "SELECT * FROM wa_flow_nodes WHERE flow_id = ? AND node_type IN ('start', 'keyword_trigger', 'all_inbound_trigger', 'first_inbound_trigger', 'trigger') ORDER BY id ASC LIMIT 1",
          [flowId]
        ).catch(() => [[]]);
        node = fallbackNodes[0];
        if (!node) {
          const [firstNodes] = await db.promise().query(
            "SELECT * FROM wa_flow_nodes WHERE flow_id = ? ORDER BY id ASC LIMIT 1",
            [flowId]
          ).catch(() => [[]]);
          node = firstNodes[0];
        }
        if (!node) {
          await this.completeRun(runId, `node_not_found_${nodeKey}`);
          return true;
        }
        nodeKey = node.node_key;
      }

      let config = {};
      try {
        config = typeof node.config === "string" ? JSON.parse(node.config) : (node.config || {});
      } catch (_) {}

      await this.logEvent(runId, nodeKey, `node_exec_${node.node_type}`, { config, vars });

      switch (node.node_type) {
        case "start":
        case "keyword_trigger":
        case "all_inbound_trigger":
        case "first_inbound_trigger":
        case "trigger": {
          nodeKey = config.next_node_key || config.nextNodeId || config.target_node || config.next_node;
          if (!nodeKey) {
            const [nextSeqNodes] = await db.promise().query(
              "SELECT node_key FROM wa_flow_nodes WHERE flow_id = ? AND id > ? ORDER BY id ASC LIMIT 1",
              [flowId, node.id]
            ).catch(() => [[]]);
            if (nextSeqNodes && nextSeqNodes[0]) {
              nodeKey = nextSeqNodes[0].node_key;
            }
          }
          break;
        }

        case "send_message": {
          const renderedText = this.interpolate(config.text || "", vars);
          if (renderedText.trim()) {
            await this.sendFlowMessage(cleanPhone, renderedText, sessionKey);
          }
          nodeKey = config.next_node_key;
          break;
        }

        case "send_media": {
          const renderedCaption = this.interpolate(config.caption || config.text || "", vars);
          const renderedUrl = this.interpolate(config.media_url || config.url || "", vars);
          const renderedFilename = config.filename ? this.interpolate(config.filename, vars) : "";
          const declaredType = String(config.media_type || "").toLowerCase();

          if (declaredType === "link") {
            // Share a link as a normal text message so WhatsApp renders the rich preview
            const linkBody = [renderedCaption, renderedUrl].filter((s) => String(s || "").trim()).join("\n");
            if (linkBody.trim()) await this.sendFlowMessage(cleanPhone, linkBody, sessionKey);
          } else {
            const media = this.resolveMedia(renderedUrl, declaredType, renderedFilename);
            if (media) {
              await this.sendFlowMedia(cleanPhone, media.type, media.url, renderedCaption, media.filename, sessionKey);
            } else {
              console.warn(`[WA Flow] send_media node '${nodeKey}' skipped — no reachable media URL (set PUBLIC_BASE_URL for uploaded files).`);
              // Don't silently drop the message: at least deliver the caption
              if (renderedCaption.trim()) await this.sendFlowMessage(cleanPhone, renderedCaption, sessionKey);
            }
          }
          nodeKey = config.next_node_key;
          break;
        }

        case "send_template": {
          await this.sendFlowTemplate(cleanPhone, config.template_id || config.template_name, vars, sessionKey);
          nodeKey = config.next_node_key;
          break;
        }

        case "send_cta": {
          await this.sendFlowCTA(
            cleanPhone,
            this.interpolate(config.text || config.body || "", vars),
            this.interpolate(config.button_text || config.display_text || "Open", vars),
            this.interpolate(config.url || "", vars),
            config.header_text ? this.interpolate(config.header_text, vars) : null,
            config.footer_text ? this.interpolate(config.footer_text, vars) : null,
            sessionKey
          );
          nodeKey = config.next_node_key;
          break;
        }

        case "delay": {
          const delaySec = Math.min(Math.max(parseInt(config.delay_seconds, 10) || 3, 1), 30);
          console.log(`⏱️ [WA Flow] Pausing ${delaySec}s before next step for +${cleanPhone}`);
          await new Promise((r) => setTimeout(r, delaySec * 1000));
          nodeKey = config.next_node_key;
          break;
        }

        case "interactive_menu": {
          const renderedText = this.interpolate(config.text || config.message?.text || "", vars);
          const renderedHeader = config.header_text ? this.interpolate(config.header_text, vars) : null;
          const renderedFooter = config.footer_text ? this.interpolate(config.footer_text, vars) : null;
          
          let sections = [];
          if (Array.isArray(config.sections) && config.sections.length > 0) {
            sections = config.sections.map(sec => ({
              title: sec.title ? this.interpolate(sec.title, vars) : null,
              buttons: (sec.buttons || sec.options || sec.rows || []).map((b, bIdx) => {
                const bTitle = this.interpolate(b.label || b.title || b.text || b.name || `Option ${bIdx + 1}`, vars);
                return {
                  ...b,
                  id: b.id || b.reply_id || `opt_${bIdx + 1}`,
                  reply_id: b.reply_id || b.id || `opt_${bIdx + 1}`,
                  label: bTitle,
                  title: bTitle,
                  description: b.description ? this.interpolate(b.description, vars) : undefined,
                  nextNodeId: b.nextNodeId || b.next_node_key || b.next_node || b.target_node
                };
              })
            }));
          } else {
            const flatBtns = (config.buttons || config.options || []).map((b, bIdx) => {
              const bTitle = this.interpolate(b.label || b.title || b.text || b.name || `Option ${bIdx + 1}`, vars);
              return {
                ...b,
                id: b.id || b.reply_id || `opt_${bIdx + 1}`,
                reply_id: b.reply_id || b.id || `opt_${bIdx + 1}`,
                label: bTitle,
                title: bTitle,
                description: b.description ? this.interpolate(b.description, vars) : undefined,
                nextNodeId: b.nextNodeId || b.next_node_key || b.next_node || b.target_node
              };
            });
            sections = [{ title: null, buttons: flatBtns }];
          }

          await this.sendFlowInteractiveMenu(cleanPhone, renderedText, sections, renderedHeader, renderedFooter, sessionKey);
          
          // Suspends execution — wait for user reply
          await db.promise().query(
            "UPDATE wa_flow_runs SET current_node_key = ?, vars = ? WHERE id = ?",
            [nodeKey, JSON.stringify(vars), runId]
          );
          return true;
        }

        case "send_buttons": {
          const renderedText = this.interpolate(config.text || "", vars);
          const renderedHeader = config.header_text ? this.interpolate(config.header_text, vars) : null;
          const renderedFooter = config.footer_text ? this.interpolate(config.footer_text, vars) : null;
          const buttons = (config.buttons || config.options || []).map((b, idx) => {
            const bTitle = this.interpolate(b.title || b.label || b.text || b.name || `Option ${idx + 1}`, vars);
            return {
              ...b,
              id: b.id || b.reply_id || `btn_${idx + 1}`,
              reply_id: b.reply_id || b.id || `btn_${idx + 1}`,
              title: bTitle,
              label: bTitle,
              next_node_key: b.next_node_key || b.nextNodeId || b.target_node || b.next_node
            };
          });
          await this.sendFlowButtons(cleanPhone, renderedText, buttons, renderedHeader, renderedFooter, sessionKey);
          
          // Suspends execution — wait for user reply
          await db.promise().query(
            "UPDATE wa_flow_runs SET current_node_key = ?, vars = ? WHERE id = ?",
            [nodeKey, JSON.stringify(vars), runId]
          );
          return true;
        }

        case "send_list": {
          const renderedText = this.interpolate(config.text || config.body || "Please choose from the list:", vars);
          const renderedButtonText = config.button_text || "View Options";
          const renderedTitle = config.title ? this.interpolate(config.title, vars) : null;
          const rows = (config.rows || config.buttons || config.options || []).map((r, idx) => {
            const rTitle = this.interpolate(r.title || r.label || r.text || r.name || `Option ${idx + 1}`, vars);
            return {
              ...r,
              id: r.id || r.reply_id || `row_${idx + 1}`,
              reply_id: r.reply_id || r.id || `row_${idx + 1}`,
              title: rTitle,
              label: rTitle,
              description: r.description ? this.interpolate(r.description, vars) : undefined,
              next_node_key: r.next_node_key || r.nextNodeId || r.target_node || r.next_node
            };
          });
          
          await this.sendFlowList(cleanPhone, renderedText, rows, renderedButtonText, renderedTitle, sessionKey);

          // Suspends execution — wait for user reply
          await db.promise().query(
            "UPDATE wa_flow_runs SET current_node_key = ?, vars = ? WHERE id = ?",
            [nodeKey, JSON.stringify(vars), runId]
          );
          return true;
        }

        case "collect_input":
        case "collect_number":
        case "collect_email":
        case "collect_date": {
          const renderedPrompt = this.interpolate(config.prompt_text || config.text || config.message || "", vars);
          if (renderedPrompt.trim()) {
            await this.sendFlowMessage(cleanPhone, renderedPrompt, sessionKey);
          }
          // Suspends execution — wait for user reply
          await db.promise().query(
            "UPDATE wa_flow_runs SET current_node_key = ?, vars = ? WHERE id = ?",
            [nodeKey, JSON.stringify(vars), runId]
          );
          return true;
        }

        case "crm_lookup": {
          // Dynamic live CRM query during execution
          const lookupType = config.lookup_type || "invoice";
          const crmResults = await this.performCrmLookup(cleanPhone, lookupType, config, vars);
          Object.assign(vars, crmResults);

          // If condition check configured inside lookup
          if (config.branch_on_result) {
            const hasRecord = !!(crmResults && Object.keys(crmResults).length > 0 && crmResults.record_found);
            nodeKey = hasRecord ? config.found_next : config.not_found_next;
          } else {
            nodeKey = config.next_node_key;
          }
          break;
        }

        case "api_webhook": {
          // Dynamic external REST API call
          try {
            const endpointUrl = this.interpolate(config.url || "", vars);
            const method = (config.method || "GET").toUpperCase();
            const headers = {};
            if (config.headers) {
              try {
                const parsedHeaders = typeof config.headers === "string" ? JSON.parse(config.headers) : config.headers;
                for (const [k, v] of Object.entries(parsedHeaders)) {
                  headers[k] = this.interpolate(String(v), vars);
                }
              } catch (_) {}
            }

            let requestData = null;
            if (method !== "GET" && config.body) {
              try {
                const renderedBody = this.interpolate(typeof config.body === "string" ? config.body : JSON.stringify(config.body), vars);
                requestData = JSON.parse(renderedBody);
              } catch (_) {
                requestData = config.body;
              }
            }

            const response = await axios({
              method,
              url: endpointUrl,
              headers,
              data: requestData,
              timeout: 10000,
            });

            // An empty mapping object must not swallow the response
            const mapping = config.response_mapping && typeof config.response_mapping === "object"
              ? Object.entries(config.response_mapping).filter(([k, v]) => k && v)
              : [];
            if (mapping.length) {
              for (const [varName, jsonPath] of mapping) {
                vars[varName] = this.extractJsonPath(response.data, jsonPath) || "";
              }
            } else if (response.data && typeof response.data === "object") {
              vars.webhook_response = JSON.stringify(response.data);
            }
            vars.webhook_status = "success";
            nodeKey = config.success_next || config.next_node_key;
          } catch (apiErr) {
            console.warn(`[WA Flow] Webhook error at node ${nodeKey}:`, apiErr.message);
            vars.webhook_status = "error";
            vars.webhook_error = apiErr.message;
            nodeKey = config.error_next || config.next_node_key;
          }
          break;
        }

        case "ai_generate":
        case "ai_intent": {
          // Dynamic AI Step (Generate Response or Classify Intent)
          const aiResult = await this.executeAiNode(node.node_type, config, vars, cleanPhone);
          if (node.node_type === "ai_intent") {
            const detectedIntent = aiResult.intent || "unknown";
            vars.ai_detected_intent = detectedIntent;
            const branchMap = config.branches || {};
            nodeKey = branchMap[detectedIntent] || config.fallback_node || config.next_node_key;
          } else {
            // ai_generate
            const replyText = aiResult.reply || "";
            if (replyText) {
              await this.sendFlowMessage(cleanPhone, replyText, sessionKey);
            }
            vars.ai_last_reply = replyText;
            nodeKey = config.next_node_key;
          }
          break;
        }

        case "condition": {
          const subjectKey = config.subject_key || "input";
          const varVal = String(vars[subjectKey] !== undefined ? vars[subjectKey] : "").trim();
          const targetVal = String(config.value !== undefined ? config.value : "").trim();
          const operator = config.operator || "equals";
          let isTrue = false;

          if (operator === "equals") isTrue = varVal.toLowerCase() === targetVal.toLowerCase();
          else if (operator === "not_equals") isTrue = varVal.toLowerCase() !== targetVal.toLowerCase();
          else if (operator === "contains") isTrue = varVal.toLowerCase().includes(targetVal.toLowerCase());
          else if (operator === "not_contains") isTrue = !varVal.toLowerCase().includes(targetVal.toLowerCase());
          else if (operator === "starts_with") isTrue = varVal.toLowerCase().startsWith(targetVal.toLowerCase());
          else if (operator === "ends_with") isTrue = varVal.toLowerCase().endsWith(targetVal.toLowerCase());
          else if (operator === "greater_than") isTrue = parseFloat(varVal) > parseFloat(targetVal);
          else if (operator === "less_than") isTrue = parseFloat(varVal) < parseFloat(targetVal);
          else if (operator === "greater_or_equal") isTrue = parseFloat(varVal) >= parseFloat(targetVal);
          else if (operator === "less_or_equal") isTrue = parseFloat(varVal) <= parseFloat(targetVal);
          else if (operator === "is_empty") isTrue = varVal === "";
          else if (operator === "is_not_empty" || operator === "present") isTrue = varVal !== "";
          else if (operator === "is_numeric") isTrue = !isNaN(parseFloat(varVal)) && isFinite(varVal);
          else if (operator === "matches_regex") {
            try { isTrue = new RegExp(targetVal, "i").test(varVal); } catch (_) { isTrue = false; }
          } else isTrue = !!varVal;

          nodeKey = isTrue ? (config.true_next || config.then_node) : (config.false_next || config.else_node);
          break;
        }

        case "set_variable": {
          if (config.variable_name) {
            const rawVal = config.variable_value !== undefined ? String(config.variable_value) : "";
            vars[config.variable_name] = this.interpolate(rawVal, vars);
          }
          nodeKey = config.next_node_key;
          break;
        }

        case "set_tag": {
          if (config.tag) {
            await db.promise().query(
              "UPDATE wa_contacts SET tags = JSON_ARRAY_APPEND(COALESCE(tags, '[]'), '$', ?) WHERE phone LIKE ?",
              [config.tag, `%${cleanPhone.slice(-10)}`]
            ).catch(() => {});
          }
          nodeKey = config.next_node_key;
          break;
        }

        case "add_to_group": {
          if (config.group_id) {
            await db.promise().query(
              `INSERT INTO wa_group_contacts (group_id, name, phone, country_code, notes)
               VALUES (?, ?, ?, '91', 'Added via Chatbot Flow')
               ON DUPLICATE KEY UPDATE name=VALUES(name)`,
              [config.group_id, vars.name || vars.customer_name || "Customer", cleanPhone.slice(-10)]
            ).catch(() => {});
          }
          nodeKey = config.next_node_key;
          break;
        }

        case "create_lead": {
          const waLeadCapture = require("./waLeadCapture");
          await waLeadCapture.captureLeadFromWhatsApp({
            phone: cleanPhone,
            name: vars.name || vars.customer_name,
            company: vars.company || vars.company_name,
            email: vars.email,
            city: vars.city || vars.location_city || vars.booking_city,
            service: vars.service || vars.product || vars.service_inquiry || config.default_service || "WhatsApp Lead",
            notes: config.notes ? this.interpolate(config.notes, vars) : JSON.stringify(vars),
            sourceDetail: `WhatsApp Flow (${flowId})`,
          });
          nodeKey = config.next_node_key;
          break;
        }

        case "jump_to_flow": {
          if (config.target_flow_id) {
            const [targetFlows] = await db.promise().query("SELECT * FROM wa_flows WHERE id = ?", [config.target_flow_id]);
            if (targetFlows[0]) {
              await this.completeRun(runId, `jumped_to_flow_${config.target_flow_id}`);
              return await this.startFlowRun(targetFlows[0], cleanPhone, sessionKey, vars.last_input || "");
            }
          }
          nodeKey = config.next_node_key;
          break;
        }

        case "handoff": {
          const noteText = config.note || "Transferring you to our support team. An agent will assist you shortly.";
          await this.sendFlowMessage(cleanPhone, this.interpolate(noteText, vars), sessionKey);
          await db.promise().query(
            "UPDATE wa_flow_runs SET status = 'handed_off', ended_at = NOW(), end_reason = 'agent_handoff', vars = ? WHERE id = ?",
            [JSON.stringify(vars), runId]
          );
          // Same window as a manual agent reply: the handoff must outlast the
          // bot, or the customer's next message simply restarts it.
          await require("./waBotGate").pauseBot(cleanPhone, undefined, "flow handoff node");

          // Emit live handoff alert to Live Chat agents
          try {
            const app = require("../server");
            const io = app.get && app.get("io");
            if (io) {
              io.emit("wa_agent_handoff", {
                phone: cleanPhone,
                flowId,
                note: config.note || "Customer requested live support",
                vars,
              });
            }
          } catch (_) {}

          return true;
        }

        case "end":
        default:
          await this.completeRun(runId, "end_node");
          return true;
      }
    }

    return true;
  }

  /**
   * Deep CRM Database Querying Helper
   */
  async performCrmLookup(cleanPhone, lookupType, config, currentVars) {
    const last10 = cleanPhone.slice(-10);
    const results = { record_found: false };

    try {
      if (lookupType === "invoice") {
        // Query latest client invoice
        const [rows] = await db.promise().query(
          `SELECT i.invoice_number, i.total_amount, i.status, i.due_date, i.issue_date, c.name as client_name
           FROM clientinvoices i
           LEFT JOIN clients c ON i.client_id = c.id
           WHERE (c.phone LIKE ? OR c.mobile LIKE ?)
           ORDER BY i.id DESC LIMIT 1`,
          [`%${last10}`, `%${last10}`]
        ).catch(() => [[]]);

        if (rows && rows[0]) {
          const inv = rows[0];
          results.record_found = true;
          results.invoice_no = inv.invoice_number || `INV-${inv.id}`;
          results.invoice_number = results.invoice_no;
          results.amount = inv.total_amount || "0.00";
          results.invoice_amount = results.amount;
          results.payment_status = inv.status || "Pending";
          results.due_date = inv.due_date ? new Date(inv.due_date).toLocaleDateString("en-IN") : "Upon Receipt";
        }
      } else if (lookupType === "amc") {
        // Query active AMC contract
        const [rows] = await db.promise().query(
          `SELECT a.contract_number, a.start_date, a.end_date, a.status, a.service_type
           FROM amc a
           LEFT JOIN clients c ON a.client_id = c.id
           WHERE (c.phone LIKE ? OR c.mobile LIKE ?)
           ORDER BY a.id DESC LIMIT 1`,
          [`%${last10}`, `%${last10}`]
        ).catch(() => [[]]);

        if (rows && rows[0]) {
          const amc = rows[0];
          results.record_found = true;
          results.amc_contract_no = amc.contract_number || `AMC-${amc.id}`;
          results.amc_service = amc.service_type || "Comprehensive Maintenance";
          results.amc_status = amc.status || "Active";
          results.amc_expiry = amc.end_date ? new Date(amc.end_date).toLocaleDateString("en-IN") : "Active";
        }
      } else if (lookupType === "quotation") {
        const [rows] = await db.promise().query(
          `SELECT q.quotation_number, q.total_amount, q.status, q.valid_until
           FROM quotations q
           LEFT JOIN clients c ON q.client_id = c.id
           WHERE (c.phone LIKE ? OR c.mobile LIKE ?)
           ORDER BY q.id DESC LIMIT 1`,
          [`%${last10}`, `%${last10}`]
        ).catch(() => [[]]);

        if (rows && rows[0]) {
          const quote = rows[0];
          results.record_found = true;
          results.quotation_no = quote.quotation_number || `QT-${quote.id}`;
          results.quote_amount = quote.total_amount || "0.00";
          results.quote_status = quote.status || "Draft";
          results.valid_until = quote.valid_until ? new Date(quote.valid_until).toLocaleDateString("en-IN") : "";
        }
      } else if (lookupType === "client") {
        const { lookupCrmDataByPhone } = require("./waAutomationService");
        const crmData = await lookupCrmDataByPhone(cleanPhone);
        if (crmData && crmData.name) {
          results.record_found = true;
          results.customer_name = crmData.name;
          results.name = crmData.name;
          results.company = crmData.company || "";
          results.company_name = crmData.company || "";
          results.city = crmData.city || "";
          results.email = crmData.email || "";
        }
      }
    } catch (e) {
      console.warn("CRM lookup error:", e.message);
    }

    return results;
  }

  /**
   * Execute AI Node (Generate text reply or Classify Intent)
   */
  async executeAiNode(nodeType, config, vars, phone) {
    try {
      const [aiSettingsRows] = await db.promise().query("SELECT * FROM wa_ai_settings WHERE id = 1");
      const aiSettings = aiSettingsRows[0] || {};
      const apiKey = aiSettings.api_key || process.env.OPENROUTER_API_KEY;
      if (!apiKey) {
        return { reply: "Thank you for reaching out. A specialist will assist you shortly.", intent: "unknown" };
      }

      const userText = vars.last_input || vars.input || "";
      
      if (nodeType === "ai_intent") {
        const prompt = `Classify the following customer WhatsApp message into exactly one of these intent categories: ${Object.keys(config.branches || { booking: 1, pricing: 1, support: 1, human: 1 }).join(", ")}. Return only the intent name in lowercase with no extra text.\nCustomer message: "${userText}"`;
        
        const res = await axios.post(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            model: aiSettings.model || "meta-llama/llama-3.3-70b-instruct:free",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.1,
          },
          { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 8000 }
        );

        const intent = (res.data?.choices?.[0]?.message?.content || "unknown").trim().toLowerCase().replace(/[^a-z_]/g, "");
        return { intent };
      } else {
        // ai_generate
        const systemPrompt = this.interpolate(config.system_prompt || "You are a helpful customer support assistant for Madhura Tech.", vars);
        const res = await axios.post(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            model: aiSettings.model || "meta-llama/llama-3.3-70b-instruct:free",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userText || "Hello" }
            ],
            temperature: 0.5,
          },
          { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 10000 }
        );
        const reply = res.data?.choices?.[0]?.message?.content || "";
        return { reply };
      }
    } catch (e) {
      console.warn("executeAiNode error:", e.message);
      return { reply: "Thank you. Our team is reviewing your request.", intent: "unknown" };
    }
  }

  /**
   * Helper to resolve dot notation JSON paths (e.g. data.items[0].price)
   */
  extractJsonPath(obj, path) {
    if (!obj || !path) return null;
    try {
      const parts = path.replace(/\[(\w+)\]/g, ".$1").replace(/^\./, "").split(".");
      let current = obj;
      for (const part of parts) {
        if (current === null || current === undefined) return null;
        current = current[part];
      }
      return current;
    } catch (_) {
      return null;
    }
  }

  /**
   * In-Memory Simulation Engine for Flow Testing in Browser
   * Executes flow steps without sending real WhatsApp messages or hitting network timeouts.
   */
  async simulateFlowStep(flow, userMessage = "", currentRunState = null) {
    const rawTrimmed = (userMessage || "").trim();
    const lowerText = rawTrimmed.toLowerCase();
    
    let nodes = flow.nodes || [];
    if (!nodes || nodes.length === 0) {
      const [dbNodes] = await db.promise().query("SELECT * FROM wa_flow_nodes WHERE flow_id = ? ORDER BY id ASC", [flow.id]);
      nodes = dbNodes.map(n => ({
        ...n,
        config: typeof n.config === "string" ? JSON.parse(n.config) : (n.config || {})
      }));
    }

    const nodeMap = {};
    for (const n of nodes) {
      const cfg = typeof n.config === "string" ? JSON.parse(n.config) : (n.config || {});
      nodeMap[n.node_key] = { ...n, config: cfg };
    }

    let vars = currentRunState?.vars ? { ...currentRunState.vars } : {
      name: "Rahul Sharma",
      customer_name: "Rahul Sharma",
      company: "Madhura Tech",
      company_name: "Madhura Tech",
      city: "Bangalore",
      service: "AC AMC Maintenance",
      amount: "14,500",
      invoice_no: "INV-2026-088",
      due_date: "25 Aug 2026",
      date: new Date().toLocaleDateString("en-IN"),
      start_time: "09:00 AM",
      end_time: "08:00 PM",
    };

    const simulatedMessages = [];
    const stepLogs = [];
    let currentNodeKey = currentRunState?.currentNodeKey;
    let isFlowEnded = false;
    let isHandedOff = false;

    // Global reset
    if (["menu", "start", "restart"].includes(lowerText)) {
      currentNodeKey = flow.entry_node_key || "start";
    }

    // Global handoff
    if (["agent", "human", "support", "person", "representative"].includes(lowerText)) {
      simulatedMessages.push({
        sender: "bot",
        type: "text",
        text: "👤 Transferring you to our support specialist now. Please stay online.",
        at: new Date()
      });
      return {
        handled: true,
        messages: simulatedMessages,
        vars,
        currentNodeKey: null,
        isEnded: true,
        isHandedOff: true,
        logs: ["Customer requested human agent."]
      };
    }

    // 1. If no active node, start at entry
    if (!currentNodeKey) {
      currentNodeKey = flow.entry_node_key || "start";
    } else {
      // Advance current waiting node with user input
      const currentNode = nodeMap[currentNodeKey];
      let nextNodeKey = null;

      if (currentNode) {
        if (currentNode.node_type === "collect_input") {
          const varKey = currentNode.config?.var_key || "input";
          vars[varKey] = rawTrimmed;
          vars.last_input = rawTrimmed;
          nextNodeKey = currentNode.config?.next_node_key;
        } else if (currentNode.node_type === "send_buttons" || currentNode.node_type === "send_list" || currentNode.node_type === "interactive_menu") {
          let buttons = [];
          if (Array.isArray(currentNode.config?.sections) && currentNode.config.sections.length > 0) {
            currentNode.config.sections.forEach(sec => {
              (sec.buttons || sec.options || sec.rows || []).forEach(b => {
                buttons.push({
                  ...b,
                  id: b.id || b.reply_id,
                  reply_id: b.reply_id || b.id,
                  title: b.label || b.title || "",
                  next_node_key: b.nextNodeId || b.next_node_key || b.next_node || b.target_node
                });
              });
            });
          } else {
            buttons = (currentNode.config?.buttons || currentNode.config?.rows || currentNode.config?.options || []).map(b => ({
              ...b,
              id: b.id || b.reply_id,
              reply_id: b.reply_id || b.id,
              title: b.label || b.title || "",
              next_node_key: b.nextNodeId || b.next_node_key || b.next_node || b.target_node
            }));
          }
          if (!Array.isArray(vars._nav_history)) vars._nav_history = [];

          // Navigation command: Back / Previous
          const isBackCmd = ["0", "back", "previous", "prev", "go back", "return", "undo", "exit", "b", "p", "⬅️", "🔙", "↩️"].includes(lowerText);
          if (isBackCmd) {
            if (currentNode.config?.back_node_key) {
              nextNodeKey = currentNode.config.back_node_key;
            } else if (vars._nav_history.length > 0) {
              nextNodeKey = vars._nav_history.pop();
            } else {
              nextNodeKey = flow.entry_node_key || "start";
            }
          }

          // Navigation command: Next / More
          const isNextCmd = !isBackCmd && ["next", "more", "next page", "page 2", "continue", "forward", "n", "➡️"].includes(lowerText);
          if (isNextCmd && (currentNode.config?.next_page_key || currentNode.config?.next_node_key)) {
            nextNodeKey = currentNode.config.next_page_key || currentNode.config.next_node_key;
            if (!vars._nav_history.includes(currentNode.node_key)) {
              vars._nav_history.push(currentNode.node_key);
            }
          }

          let matched = null;

          // 1. Single Number Match: "1", "2", "3", "1.", "#1", "opt 1", "choice 1"
          if (!nextNodeKey) {
            const numMatch = rawTrimmed.match(/^(?:option\s*|opt\s*|choice\s*|select\s*|#\s*)?(\d+)[.)]?$/i);
            if (numMatch) {
              const numVal = parseInt(numMatch[1], 10);
              if (numVal === 0) {
                if (currentNode.config?.back_node_key) {
                  nextNodeKey = currentNode.config.back_node_key;
                } else if (vars._nav_history.length > 0) {
                  nextNodeKey = vars._nav_history.pop();
                } else {
                  nextNodeKey = flow.entry_node_key || "start";
                }
              } else {
                const idx = numVal - 1;
                if (idx >= 0 && idx < buttons.length) matched = buttons[idx];
              }
            }
          }

          // 2. Leading Number Match in user reply: "1. Services", "1 Services", "1 - Book", "2. Payment"
          if (!nextNodeKey && !matched) {
            const leadingNumMatch = rawTrimmed.match(/^(\d+)[\s.)-]+/);
            if (leadingNumMatch) {
              const leadIdx = parseInt(leadingNumMatch[1], 10) - 1;
              if (leadIdx >= 0 && leadIdx < buttons.length) {
                matched = buttons[leadIdx];
              }
            }
          }

          // 3. Exact ID / Reply ID / Exact Title Match
          if (!nextNodeKey && !matched) {
            matched = buttons.find(b => 
              (b.reply_id && String(b.reply_id).toLowerCase().trim() === lowerText) ||
              (b.id && String(b.id).toLowerCase().trim() === lowerText) ||
              (b.title && String(b.title).toLowerCase().trim() === lowerText)
            );
          }

          // 4. Clean Title / Fuzzy Substring Match (ignoring emojis, symbols, and leading digits)
          if (!nextNodeKey && !matched && rawTrimmed.length >= 2) {
            const stripSymbols = (s) => (s || "").replace(/^\d+[\s.)-]+\s*/, "").replace(/[^\p{L}\p{N}\s]/gu, "").toLowerCase().trim();
            const cleanInput = stripSymbols(rawTrimmed);
            if (cleanInput) {
              matched = buttons.find(b => {
                if (!b.title) return false;
                const cleanTitle = stripSymbols(b.title);
                if (!cleanTitle) return false;
                return (
                  cleanTitle === cleanInput ||
                  cleanInput.includes(cleanTitle) ||
                  cleanTitle.includes(cleanInput)
                );
              });
            }
          }

          // 5. Configured Button Keywords / Synonyms
          if (!nextNodeKey && !matched) {
            matched = buttons.find(b => {
              if (!b.keywords) return false;
              const kws = Array.isArray(b.keywords) ? b.keywords : String(b.keywords).split(",");
              return kws.some(k => k.trim() && lowerText.includes(k.trim().toLowerCase()));
            });
          }

          if (matched) {
            if (!vars._nav_history.includes(currentNode.node_key)) {
              vars._nav_history.push(currentNode.node_key);
            }
            vars.selected_option = matched.title;
            vars.selected_option_id = matched.reply_id || matched.id;
            vars._reprompt_count = 0;
            nextNodeKey = matched.next_node_key || matched.nextNodeId || matched.next_node || matched.target_node || matched.next;
          } else if (!nextNodeKey) {
            // Mirror the live bot: re-show the numbered menu once before falling
            // through, instead of silently selecting option 1.
            const tries = (vars._reprompt_count || 0) + 1;
            if (!currentNode.config?.fallback_node_key && tries < 2 && buttons.length > 0) {
              vars._reprompt_count = tries;
              let promptMsg = "Please choose one of the options below (reply with option number):\n\n";
              buttons.forEach((b, i) => { promptMsg += `*${i + 1}.* ${b.title}\n`; });
              promptMsg += "\n_Reply 0 or BACK for previous menu, or MENU for main menu._";
              return {
                handled: true,
                messages: [{ sender: "bot", type: "text", text: promptMsg, at: new Date() }],
                vars,
                currentNodeKey: currentNode.node_key,
                isEnded: false,
                logs: [`Unrecognised reply "${rawTrimmed}" — reprompting with the option list.`]
              };
            }
            nextNodeKey = currentNode.config?.fallback_node_key || currentNode.config?.next_node_key || (buttons[0] && (buttons[0].next_node_key || buttons[0].next_node));
          }
        }
      }

      currentNodeKey = nextNodeKey;
    }

    // 2. Chain execute nodes until suspension
    let safetyCounter = 0;
    while (currentNodeKey && safetyCounter < 20) {
      safetyCounter++;
      const node = nodeMap[currentNodeKey];
      if (!node) {
        stepLogs.push(`Node '${currentNodeKey}' not found.`);
        isFlowEnded = true;
        break;
      }

      stepLogs.push(`Executed step '${node.node_key}' (${node.node_type})`);

      if (node.node_type === "start") {
        currentNodeKey = node.config?.next_node_key;
      } else if (node.node_type === "send_message") {
        const text = this.interpolate(node.config?.text || "", vars);
        simulatedMessages.push({ sender: "bot", type: "text", text, at: new Date() });
        currentNodeKey = node.config?.next_node_key;
      } else if (node.node_type === "send_media") {
        const caption = this.interpolate(node.config?.caption || node.config?.text || "", vars);
        const rawUrl = this.interpolate(node.config?.media_url || node.config?.url || "", vars);
        const declared = String(node.config?.media_type || "").toLowerCase();

        if (declared === "link") {
          simulatedMessages.push({
            sender: "bot",
            type: "text",
            text: [caption, rawUrl].filter((s) => String(s || "").trim()).join("\n"),
            at: new Date()
          });
        } else {
          const media = this.resolveMedia(rawUrl, declared, node.config?.filename || "");
          simulatedMessages.push({
            sender: "bot",
            type: "media",
            media_type: media?.type || declared || "document",
            media_url: media?.url || rawUrl,
            filename: media?.filename || node.config?.filename || "",
            caption,
            at: new Date()
          });
          if (!media) stepLogs.push(`[Warning] '${node.node_key}' has no reachable media URL — set PUBLIC_BASE_URL for uploaded files.`);
        }
        currentNodeKey = node.config?.next_node_key;
      } else if (node.node_type === "interactive_menu") {
        const text = this.interpolate(node.config?.text || node.config?.message?.text || "", vars);
        let sections = [];
        if (Array.isArray(node.config?.sections) && node.config.sections.length > 0) {
          sections = node.config.sections.map(s => ({
            title: s.title ? this.interpolate(s.title, vars) : null,
            buttons: (s.buttons || s.options || s.rows || []).map(b => ({
              ...b,
              id: b.id || b.reply_id,
              label: this.interpolate(b.label || b.title || "", vars),
              title: this.interpolate(b.label || b.title || "", vars),
              description: b.description ? this.interpolate(b.description, vars) : null,
              nextNodeId: b.nextNodeId || b.next_node_key || b.next_node || b.target_node
            }))
          }));
        } else {
          const flatBtns = (node.config?.buttons || node.config?.options || []).map(b => ({
            ...b,
            id: b.id || b.reply_id,
            label: this.interpolate(b.label || b.title || "", vars),
            title: this.interpolate(b.label || b.title || "", vars),
            description: b.description ? this.interpolate(b.description, vars) : null,
            nextNodeId: b.nextNodeId || b.next_node_key || b.next_node || b.target_node
          }));
          sections = [{ title: null, buttons: flatBtns }];
        }

        simulatedMessages.push({
          sender: "bot",
          type: "interactive_menu",
          text,
          header: node.config?.header_text,
          footer: node.config?.footer_text,
          sections,
          at: new Date()
        });

        return {
          handled: true,
          messages: simulatedMessages,
          vars,
          currentNodeKey: node.node_key,
          isEnded: false,
          logs: stepLogs
        };
      } else if (node.node_type === "send_buttons") {
        const text = this.interpolate(node.config?.text || "", vars);
        const buttons = (node.config?.buttons || []).map(b => ({
          ...b,
          title: this.interpolate(b.title, vars)
        }));
        simulatedMessages.push({
          sender: "bot",
          type: "buttons",
          text,
          header: node.config?.header_text,
          footer: node.config?.footer_text,
          buttons,
          at: new Date()
        });
        // Suspends execution waiting for button tap or reply
        return {
          handled: true,
          messages: simulatedMessages,
          vars,
          currentNodeKey: node.node_key,
          isEnded: false,
          logs: stepLogs
        };
      } else if (node.node_type === "send_list") {
        const text = this.interpolate(node.config?.text || node.config?.body || "Please choose:", vars);
        const rows = (node.config?.rows || []).map(r => ({
          ...r,
          title: this.interpolate(r.title, vars),
          description: r.description ? this.interpolate(r.description, vars) : null
        }));
        simulatedMessages.push({
          sender: "bot",
          type: "list",
          text,
          title: node.config?.title,
          button_text: node.config?.button_text || "View Options",
          rows,
          at: new Date()
        });
        return {
          handled: true,
          messages: simulatedMessages,
          vars,
          currentNodeKey: node.node_key,
          isEnded: false,
          logs: stepLogs
        };
      } else if (node.node_type === "collect_input") {
        const prompt = this.interpolate(node.config?.prompt_text || "", vars);
        simulatedMessages.push({
          sender: "bot",
          type: "collect_input",
          text: prompt,
          var_key: node.config?.var_key,
          at: new Date()
        });
        return {
          handled: true,
          messages: simulatedMessages,
          vars,
          currentNodeKey: node.node_key,
          isEnded: false,
          logs: stepLogs
        };
      } else if (node.node_type === "crm_lookup") {
        // Simulated CRM Lookup
        vars.invoice_no = "INV-2026-088";
        vars.amount = "14,500";
        vars.due_date = "25 Aug 2026";
        vars.payment_status = "Pending";
        vars.amc_contract_no = "AMC-2026-904";
        vars.amc_status = "Active";
        vars.amc_expiry = "31 Dec 2026";
        vars.record_found = true;
        currentNodeKey = node.config?.next_node_key || node.config?.found_next;
      } else if (node.node_type === "condition") {
        const subject = String(vars[node.config?.subject_key || "input"] || "");
        const target = String(node.config?.value || "");
        const op = node.config?.operator || "equals";
        let match = false;
        if (op === "equals") match = subject.toLowerCase() === target.toLowerCase();
        else if (op === "contains") match = subject.toLowerCase().includes(target.toLowerCase());
        else if (op === "is_not_empty" || op === "present") match = !!subject.trim();
        else match = !!subject;

        currentNodeKey = match ? (node.config?.true_next || node.config?.then_node) : (node.config?.false_next || node.config?.else_node);
      } else if (node.node_type === "set_variable") {
        if (node.config?.variable_name) {
          vars[node.config.variable_name] = this.interpolate(String(node.config.variable_value || ""), vars);
        }
        currentNodeKey = node.config?.next_node_key;
      } else if (node.node_type === "create_lead") {
        stepLogs.push(`[CRM] Lead auto-captured: ${JSON.stringify(vars)}`);
        currentNodeKey = node.config?.next_node_key;
      } else if (node.node_type === "delay") {
        stepLogs.push(`[Pause] Delay ${node.config?.delay_seconds || 3}s`);
        currentNodeKey = node.config?.next_node_key;
      } else if (node.node_type === "send_template") {
        stepLogs.push(`[Template] Sends approved template #${node.config?.template_id || node.config?.template_name || "?"}`);
        simulatedMessages.push({
          sender: "bot",
          type: "text",
          text: `🧾 _[Approved template #${node.config?.template_id || node.config?.template_name || "?"} would be delivered here]_`,
          at: new Date()
        });
        currentNodeKey = node.config?.next_node_key;
      } else if (node.node_type === "api_webhook") {
        // No live HTTP call in the simulator — follow the success path
        stepLogs.push(`[Webhook] ${node.config?.method || "GET"} ${node.config?.url || ""} (not called in simulation, taking success path)`);
        vars.webhook_status = "success";
        currentNodeKey = node.config?.success_next || node.config?.next_node_key;
      } else if (node.node_type === "ai_generate") {
        simulatedMessages.push({
          sender: "bot",
          type: "text",
          text: "🧠 _[AI-generated reply would appear here — the live bot answers using your AI settings]_",
          at: new Date()
        });
        currentNodeKey = node.config?.next_node_key;
      } else if (node.node_type === "ai_intent") {
        // Without calling the model, route on the first configured intent so the
        // rest of the branch stays walkable in the preview
        const branchKeys = Object.keys(node.config?.branches || {});
        const picked = branchKeys[0];
        vars.ai_detected_intent = picked || "unknown";
        stepLogs.push(`[AI Intent] Simulated as '${picked || "unknown"}' (live bot classifies the real message)`);
        currentNodeKey = (picked && node.config.branches[picked]) || node.config?.fallback_node || node.config?.next_node_key;
      } else if (node.node_type === "jump_to_flow") {
        stepLogs.push(`[Jump] Hands the customer over to flow #${node.config?.target_flow_id || "?"} — simulation stops here.`);
        isFlowEnded = true;
        break;
      } else if (node.node_type === "handoff") {
        const note = node.config?.note || "Connecting to live support agent...";
        simulatedMessages.push({ sender: "bot", type: "handoff", text: note, at: new Date() });
        isHandedOff = true;
        isFlowEnded = true;
        break;
      } else if (node.node_type === "end") {
        isFlowEnded = true;
        break;
      } else {
        currentNodeKey = node.config?.next_node_key;
      }
    }

    return {
      handled: true,
      messages: simulatedMessages,
      vars,
      currentNodeKey: isFlowEnded ? null : currentNodeKey,
      isEnded: isFlowEnded,
      isHandedOff,
      logs: stepLogs
    };
  }

  async resolveInitialCrmVars(cleanPhone) {
    const { lookupCrmDataByPhone } = require("./waAutomationService");
    const crmData = await lookupCrmDataByPhone(cleanPhone).catch(() => ({}));
    return {
      name: crmData.name || crmData.customer_name || "Valued Customer",
      customer_name: crmData.name || crmData.customer_name || "Valued Customer",
      company: crmData.company || crmData.company_name || "Madhura Tech",
      company_name: crmData.company || crmData.company_name || "Madhura Tech",
      city: crmData.city || crmData.location_city || "our city",
      email: crmData.email || "",
      is_existing_customer: !!(crmData.name || crmData.company),
      date: new Date().toLocaleDateString("en-IN"),
      start_time: "09:00 AM",
      end_time: "08:00 PM",
    };
  }

  async handleFallback(runId, cleanPhone, fallbackPolicy, sessionKey = null) {
    await this.sendFlowMessage(cleanPhone, "I am having trouble understanding. Let me connect you with a team member.", sessionKey);
    await db.promise().query(
      "UPDATE wa_flow_runs SET status = 'handed_off', ended_at = NOW(), end_reason = 'fallback_max_reprompts' WHERE id = ?",
      [runId]
    );
    return true;
  }

  async completeRun(runId, reason) {
    try {
      const [runs] = await db.promise().query(
        "SELECT r.*, f.name as flow_name FROM wa_flow_runs r LEFT JOIN wa_flows f ON r.flow_id = f.id WHERE r.id = ?",
        [runId]
      );
      if (runs && runs[0]) {
        const run = runs[0];
        let vars = {};
        try { vars = typeof run.vars === "string" ? JSON.parse(run.vars) : (run.vars || {}); } catch (_) {}
        if (vars.name || vars.service || vars.inquiry || vars.email || Object.keys(vars).length >= 3) {
          const waLeadCapture = require("./waLeadCapture");
          await waLeadCapture.captureLeadFromWhatsApp({
            phone: run.phone,
            name: vars.name || vars.customer_name,
            company: vars.company || vars.company_name,
            email: vars.email,
            city: vars.city || vars.location_city || vars.booking_city,
            service: vars.service || vars.product || vars.service_inquiry || "WhatsApp Inquiry",
            notes: JSON.stringify(vars),
            sourceDetail: `WhatsApp Flow: ${run.flow_name || "Chatbot"}`,
          }).catch(() => {});
        }
      }
    } catch (_) {}

    await db.promise().query(
      "UPDATE wa_flow_runs SET status = 'completed', ended_at = NOW(), end_reason = ? WHERE id = ?",
      [reason, runId]
    );
  }

  async sendFlowMessage(phone, text, sessionKey = null) {
    const waLoadBalancer = require("./waLoadBalancer");
    const mdToWa = require("./mdToWa");
    let cleanPhone = String(phone || "").replace(/\D/g, "");
    if (cleanPhone.length === 10) cleanPhone = "91" + cleanPhone;

    const formatted = mdToWa.toWhatsApp(text);
    const msgId = await this.recordAndEmitBotMessage(cleanPhone, formatted, "text");

    try {
      const result = await waLoadBalancer.sendTextMessage(cleanPhone, formatted, sessionKey);
      return result;
    } catch (e) {
      console.warn(`❌ [WA FlowEngine] sendFlowMessage error for +${cleanPhone}:`, e?.message || e);
      await this.markBotMessageFailed(msgId, cleanPhone, e?.message || "Failed to send");
      return null;
    }
  }

  async sendFlowMedia(phone, mediaType, mediaUrl, caption, filename = "", sessionKey = null) {
    const waLoadBalancer = require("./waLoadBalancer");
    const mdToWa = require("./mdToWa");
    let cleanPhone = String(phone || "").replace(/\D/g, "");
    if (cleanPhone.length === 10) cleanPhone = "91" + cleanPhone;

    const formattedCaption = caption ? mdToWa.toWhatsApp(caption) : "";
    const msgId = await this.recordAndEmitBotMessage(cleanPhone, formattedCaption || filename || `[Media Attachment: ${mediaType}]`, "media");

    try {
      return await waLoadBalancer.sendMediaMessage(cleanPhone, mediaType || "image", mediaUrl, formattedCaption, filename, sessionKey);
    } catch (e) {
      console.warn(`❌ [WA FlowEngine] sendFlowMedia error for +${cleanPhone}:`, e?.message || e);
      await this.markBotMessageFailed(msgId, cleanPhone, e?.message || "Failed to send");
      return null;
    }
  }

  async sendFlowTemplate(phone, templateRef, vars = {}, sessionKey = null) {
    const waLoadBalancer = require("./waLoadBalancer");
    const { buildTemplateBodyComponent } = require("./waAutomationService");
    let cleanPhone = String(phone || "").replace(/\D/g, "");
    if (cleanPhone.length === 10) cleanPhone = "91" + cleanPhone;

    try {
      let tmpl = null;
      if (typeof templateRef === "number" || /^\d+$/.test(templateRef)) {
        const [rows] = await db.promise().query("SELECT * FROM wa_templates WHERE id = ? LIMIT 1", [templateRef]);
        tmpl = rows[0];
      } else if (templateRef) {
        const [rows] = await db.promise().query("SELECT * FROM wa_templates WHERE name = ? LIMIT 1", [templateRef]);
        tmpl = rows[0];
      }
      if (!tmpl) return null;

      const bodyComponent = buildTemplateBodyComponent(tmpl.body, vars.name, vars);
      const renderedBody = this.interpolate(tmpl.body, vars);
      const msgId = await this.recordAndEmitBotMessage(cleanPhone, renderedBody, "template");

      try {
        return await waLoadBalancer.sendTemplateMessage(cleanPhone, tmpl.name, tmpl.language || "en", bodyComponent ? [bodyComponent] : [], sessionKey);
      } catch (err) {
        console.warn(`❌ [WA FlowEngine] sendFlowTemplate error for +${cleanPhone}:`, err?.message || err);
        await this.markBotMessageFailed(msgId, cleanPhone, err?.message || "Failed to send");
        return null;
      }
    } catch (e) {
      console.warn("sendFlowTemplate error:", e.message);
      return null;
    }
  }

  /**
   * Native reply buttons (<=3) or list (>3), via the provider abstraction.
   * Titles are normalized centrally so an authored "1. Our Services" reaches
   * Meta as "Our Services" — the ordinal only ever appears in the text fallback.
   */
  async sendFlowButtons(phone, text, buttons, headerText, footerText, sessionKey = null) {
    return this._dispatchInteractive({
      phone,
      body: text,
      header: headerText,
      footer: footerText,
      items: buttons,
      sessionKey,
      buttonText: "View Options",
      payloadType: "buttons",
      payloadExtra: { buttons },
    });
  }

  /**
   * Native CTA URL button. Unlike reply buttons this produces no inbound reply
   * id — the customer leaves for the link — so the flow always continues
   * straight to next_node_key.
   */
  async sendFlowCTA(phone, text, displayText, url, headerText = null, footerText = null, sessionKey = null) {
    const waLoadBalancer = require("./waLoadBalancer");
    const mdToWa = require("./mdToWa");

    let cleanPhone = String(phone || "").replace(/\D/g, "");
    if (cleanPhone.length === 10) cleanPhone = "91" + cleanPhone;

    if (!url || !/^https?:\/\//i.test(String(url))) {
      console.warn(`[WA Flow] send_cta node for +${cleanPhone} has an invalid url ("${url}") — skipping.`);
      return null;
    }

    const fallbackText = [
      headerText ? `*${headerText}*` : null,
      mdToWa.toWhatsApp(String(text || "")).trim(),
      url,
      footerText ? `_${footerText}_` : null,
    ]
      .filter(Boolean)
      .join("\n\n");

    const msgId = await this.recordAndEmitBotMessage(
      cleanPhone,
      fallbackText,
      "interactive",
      { type: "cta_url", header: headerText, footer: footerText, text, button_text: displayText, url },
      sessionKey
    );

    try {
      const res = await waLoadBalancer.sendCTAButtonMessage({
        phone: cleanPhone,
        body: text,
        displayText,
        url,
        header: headerText,
        footer: footerText,
        fallbackText,
        sessionKey,
      });
      console.log(
        `🔗 [WA Flow] cta_url -> +${cleanPhone} via ${res?.engineUsed || "WA"} (${res?.native ? "native button" : "plain link fallback"})`
      );
      return res;
    } catch (err) {
      console.error(`❌ [WA FlowEngine] Failed to deliver cta_url to +${cleanPhone}:`, err?.message || err);
      await this.markBotMessageFailed(msgId, cleanPhone, err?.message || "Failed to send");
      return null;
    }
  }

  async sendFlowList(phone, text, rows, buttonText = "View Options", title = null, sessionKey = null) {
    return this._dispatchInteractive({
      phone,
      body: text,
      header: title,
      footer: null,
      items: rows,
      forceList: true,
      buttonText,
      sessionKey,
      payloadType: "list",
      payloadExtra: { title, button_text: buttonText, rows },
    });
  }

  async sendFlowInteractiveMenu(phone, text, sections, headerText = null, footerText = null, sessionKey = null) {
    return this._dispatchInteractive({
      phone,
      body: text,
      header: headerText,
      footer: footerText,
      items: sections,
      sectioned: true,
      buttonText: "Select Option",
      sessionKey,
      payloadType: "interactive_menu",
      payloadExtra: { sections },
    });
  }

  /**
   * Shared interactive dispatcher for the three send_* node types.
   *
   * Records + broadcasts the bot message to Live Chat first (so the CRM shows
   * the menu even if delivery later fails), then hands off to waLoadBalancer,
   * which owns the cloud-vs-text decision, failover and quota accounting.
   */
  async _dispatchInteractive({
    phone,
    body,
    header,
    footer,
    items,
    sectioned = false,
    forceList = false,
    buttonText = "View Options",
    sessionKey = null,
    payloadType,
    payloadExtra = {},
  }) {
    const waLoadBalancer = require("./waLoadBalancer");
    const waInteractive = require("./waInteractive");

    let cleanPhone = String(phone || "").replace(/\D/g, "");
    if (cleanPhone.length === 10) cleanPhone = "91" + cleanPhone;

    // A sectioned menu, an explicit list, or more options than a button row
    // holds (3) must go out as a WhatsApp list.
    const sections = waInteractive.normalizeSections(items, header || "Options");
    const flat = waInteractive.flattenSections(sections);
    const hasDescriptions = flat.some((r) => r.description);
    const asList =
      forceList || sectioned || hasDescriptions || flat.length > waInteractive.LIMITS.maxButtons || sections.length > 1;

    if (!flat.length) {
      console.warn(`[WA Flow] ${payloadType} node for +${cleanPhone} has no options — nothing to send.`);
      return null;
    }

    const fallbackText = waInteractive.buildNumberedText({
      body,
      header,
      footer,
      items: flat,
      sectioned: asList && sections.length > 1,
    });

    const msgId = await this.recordAndEmitBotMessage(
      cleanPhone,
      fallbackText,
      "interactive",
      { type: payloadType, header, footer, text: body, ...payloadExtra },
      sessionKey
    );

    try {
      const opts = { phone: cleanPhone, body, header, footer, fallbackText, sessionKey };
      const res = asList
        ? await waLoadBalancer.sendInteractiveList({ ...opts, sections, buttonText })
        : await waLoadBalancer.sendInteractiveButtons({ ...opts, buttons: flat });

      console.log(
        `🔘 [WA Flow] ${payloadType} -> +${cleanPhone} via ${res?.engineUsed || "WA"} (${res?.native ? "native interactive" : "text fallback"})`
      );
      return res;
    } catch (err) {
      console.error(`❌ [WA FlowEngine] Failed to deliver ${payloadType} to +${cleanPhone}:`, err?.message || err);
      await this.markBotMessageFailed(msgId, cleanPhone, err?.message || "Failed to send");
      return null;
    }
  }

  interpolate(template, vars = {}) {
    if (!template || typeof template !== "string") return "";
    try {
      const { formatMessagePlaceholders } = require("./waAutomationService");
      return formatMessagePlaceholders(template, vars.name || vars.customer_name, vars);
    } catch (_) {
      return template;
    }
  }

  async logEvent(runId, nodeKey, eventType, payload = {}) {
    await db.promise().query(
      "INSERT INTO wa_flow_run_events (run_id, node_key, event_type, payload) VALUES (?, ?, ?, ?)",
      [runId, nodeKey, eventType, JSON.stringify(payload)]
    ).catch(() => {});
  }
}

module.exports = new WaFlowEngine();
