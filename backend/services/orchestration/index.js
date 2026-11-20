"use strict";

/**
 * orchestration/index.js
 *
 * Wires Madhura's Conversational Flowbot Runtime and Business Automation Engine
 * together with shared context, 24h Meta Customer Service Window, Consent/DNC,
 * AI Agent + Knowledge Base, and bidirectional Flowbot <-> Automation bridges.
 */

const { createConsentSuppressionService } = require("../campaign/consentSuppressionService");
const { createServiceWindowService } = require("./serviceWindowService");
const { createAiAgentService } = require("./aiAgentService");
const { createSharedContextService } = require("./sharedContextService");
const { createFlowbotRuntimeService } = require("./flowbotRuntimeService");
const { createAutomationEngineService } = require("./automationEngineService");

function createOrchestrationEngines(options = {}) {
  const db = options.db || require("../../config/database");
  const consentService = options.consentService || createConsentSuppressionService({ db });
  const serviceWindow = options.serviceWindow || createServiceWindowService({ db, consentService });
  const aiService = options.aiService || createAiAgentService({ db, llmClient: options.llmClient });
  const sharedContext = options.sharedContext || createSharedContextService({ db });

  const flowbotRuntime = createFlowbotRuntimeService({
    db,
    consentService,
    serviceWindow,
    aiService,
    sharedContext,
    messageDispatcher: options.messageDispatcher || null,
  });

  const automationEngine = createAutomationEngineService({
    db,
    consentService,
    serviceWindow,
    aiService,
    sharedContext,
    flowbotRuntime,
    httpClient: options.httpClient || null,
    messageDispatcher: options.messageDispatcher || null,
  });

  flowbotRuntime.setAutomationBridge(automationEngine);
  automationEngine.setFlowbotRuntime(flowbotRuntime);

  return {
    consentService,
    serviceWindow,
    aiService,
    sharedContext,
    flowbotRuntime,
    automationEngine,
  };
}

let singleton = null;
function getOrchestrationEngines() {
  if (!singleton) {
    singleton = createOrchestrationEngines();
  }
  return singleton;
}

module.exports = { createOrchestrationEngines, getOrchestrationEngines };
