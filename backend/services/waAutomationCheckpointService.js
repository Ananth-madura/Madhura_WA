"use strict";

const db = require("../config/database");

/**
 * waAutomationCheckpointService.js
 *
 * Manages durable conversational checkpoints for WhatsApp Automations.
 * Enables:
 * - Multi-turn customer question collection across server restarts
 * - Dynamic answer validation (text, number, email, date, button choice)
 * - CRM custom field updates based on collected customer responses
 * - Automatic resumption and continuation of workflow pipelines
 */

async function createCheckpoint({
  tenantId,
  automationId,
  executionId,
  phone,
  contactId = null,
  conversationId = null,
  senderId = null,
  sessionKey = null,
  currentStep = 1,
  checkpointType = "ask_question",
  expectedType = "text",
  questionContext = {},
  collectedAnswers = {},
  timeoutHours = 24,
}) {
  const cleanPhone = String(phone).replace(/\D/g, "");
  const [result] = await db.promise().query(
    `INSERT INTO wa_automation_checkpoints 
     (tenant_id, automation_id, execution_id, phone, contact_id, conversation_id, sender_id, session_key, current_step, status, checkpoint_type, expected_type, question_context, collected_answers, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'waiting', ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR))`,
    [
      tenantId,
      automationId,
      executionId || null,
      cleanPhone,
      contactId || null,
      conversationId || null,
      senderId || null,
      sessionKey || null,
      currentStep,
      checkpointType,
      expectedType,
      JSON.stringify(questionContext),
      JSON.stringify(collectedAnswers),
      Math.max(1, Math.min(720, Number(timeoutHours) || 24)),
    ]
  );
  return result.insertId;
}

async function findActiveCheckpoint(tenantId, phone) {
  const cleanPhone = String(phone).replace(/\D/g, "");
  const [rows] = await db.promise().query(
    `SELECT * FROM wa_automation_checkpoints 
     WHERE tenant_id = ? AND (phone = ? OR phone LIKE ?) AND status = 'waiting' AND (expires_at IS NULL OR expires_at >= NOW()) 
     ORDER BY id DESC LIMIT 1`,
    [tenantId, cleanPhone, `%${cleanPhone.slice(-10)}`]
  );
  return rows && rows[0] ? rows[0] : null;
}

function validateAndFormatAnswer(input, expectedType) {
  const raw = String(input || "").trim();
  if (!raw) return { valid: false, error: "Empty response" };

  switch (expectedType) {
    case "number": {
      const stripped = raw.replace(/[^0-9.-]/g, "");
      if (!stripped || !/^-?\d+(\.\d+)?$/.test(stripped)) {
        return { valid: false, error: "Please enter a valid number" };
      }
      const num = Number(stripped);
      if (!Number.isFinite(num)) return { valid: false, error: "Please enter a valid number" };
      return { valid: true, value: num };
    }
    case "email": {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(raw)) return { valid: false, error: "Please enter a valid email address" };
      return { valid: true, value: raw.toLowerCase() };
    }
    case "date": {
      const d = new Date(raw);
      if (isNaN(d.getTime())) return { valid: false, error: "Please provide a valid date" };
      return { valid: true, value: raw };
    }
    case "button":
    case "list":
    case "text":
    default:
      return { valid: true, value: raw };
  }
}

async function updateCrmWithAnswer(tenantId, phone, fieldName, fieldValue) {
  if (!fieldName || !fieldValue) return;
  const cleanPhone = String(phone).replace(/\D/g, "");
  const last10 = cleanPhone.slice(-10);

  try {
    // 1. Check wa_contacts
    const [cols] = db.isSqlite
      ? await db.promise().query("PRAGMA table_info(wa_contacts)")
      : await db.promise().query(
          "SELECT COLUMN_NAME AS name FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='wa_contacts'"
        );
    const colNames = new Set(cols.map((c) => c.name || c.COLUMN_NAME));
    if (colNames.has(fieldName)) {
      await db.promise().query(
        `UPDATE wa_contacts SET ${fieldName} = ? WHERE tenant_id = ? AND (phone = ? OR phone LIKE ?)`,
        [fieldValue, tenantId, cleanPhone, `%${last10}`]
      );
    }
  } catch (_) {}

  // 2. Also try updating clients or leads if mapped
  try {
    if (["company", "city", "service", "email", "name"].includes(fieldName)) {
      await db.promise().query(
        `UPDATE clients SET ${fieldName} = ? WHERE tenant_id = ? AND (phone = ? OR phone LIKE ?)`,
        [fieldValue, tenantId, cleanPhone, `%${last10}`]
      );
    }
  } catch (_) {}
}

async function resumeCheckpoint(tenantId, senderId, checkpoint, input, contact = {}) {
  let context = {};
  let collected = {};
  try {
    context = checkpoint.question_context ? JSON.parse(checkpoint.question_context) : {};
  } catch (_) {}
  try {
    collected = checkpoint.collected_answers ? JSON.parse(checkpoint.collected_answers) : {};
  } catch (_) {}

  const validation = validateAndFormatAnswer(input, checkpoint.expected_type);
  if (!validation.valid) {
    // Validation failed: send helpful prompt back to user
    try {
      const warningText = `⚠️ ${validation.error}. Please try again: ${context.question_text || ""}`;
      const delivery = require("./automationCloudDelivery");
      await delivery.send(
        { tenant_id: tenantId, sender_id: senderId },
        checkpoint.phone,
        warningText,
        {},
        { requestId: `retry:${checkpoint.id}:${Date.now()}` }
      );
    } catch (_) {}
    return true; // Claimed, waiting for valid answer
  }

  // Answer accepted!
  const answerKey = context.crm_field || `question_step_${checkpoint.current_step}`;
  collected[answerKey] = validation.value;

  // Update CRM field if mapped
  if (context.crm_field) {
    await updateCrmWithAnswer(tenantId, checkpoint.phone, context.crm_field, validation.value);
  }

  // Mark checkpoint completed / advancing
  await db.promise().query(
    `UPDATE wa_automation_checkpoints 
     SET collected_answers = ?, status = 'resumed', updated_at = NOW() 
     WHERE id = ?`,
    [JSON.stringify(collected), checkpoint.id]
  );

  // Fetch parent automation rule to see if there is a next action in the pipeline
  const [rules] = await db.promise().query(
    "SELECT * FROM wa_automations WHERE tenant_id = ? AND id = ?",
    [tenantId, checkpoint.automation_id]
  );
  if (!rules || !rules[0]) return true;

  const rule = rules[0];
  let actions = [];
  try {
    actions = rule.actions_json ? JSON.parse(rule.actions_json) : [];
  } catch (_) {}

  const nextStepIndex = checkpoint.current_step; // 1-based index pointing to next action
  if (Array.isArray(actions) && nextStepIndex < actions.length) {
    // Continue pipeline execution with next action!
    const waAutomationService = require("./waAutomationService");
    await waAutomationService.executePipelineAction(
      rule,
      actions,
      nextStepIndex,
      checkpoint.phone,
      contact.name,
      collected,
      checkpoint.session_key,
      { checkpointId: checkpoint.id, executionId: checkpoint.execution_id }
    );
  } else {
    // Pipeline complete! Send completion confirmation if configured
    await db.promise().query(
      "UPDATE wa_automation_checkpoints SET status = 'completed', updated_at = NOW() WHERE id = ?",
      [checkpoint.id]
    );

    if (context.completion_message) {
      try {
        const text = require("./waAutomationService").formatMessagePlaceholders(
          context.completion_message,
          contact.name,
          collected
        );
        await require("./automationCloudDelivery").send(
          { tenant_id: tenantId, sender_id: senderId },
          checkpoint.phone,
          text,
          collected,
          { requestId: `complete:${checkpoint.id}:${Date.now()}` }
        );
      } catch (_) {}
    }
  }

  return true;
}

module.exports = {
  createCheckpoint,
  findActiveCheckpoint,
  validateAndFormatAnswer,
  resumeCheckpoint,
  updateCrmWithAnswer,
};
