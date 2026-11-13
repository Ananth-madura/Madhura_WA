# AUTOMATION & WORKFLOW ENGINE SPECIFICATION
## Madhura Event-Driven Automation & Visual Chatbot Execution

---

### 1. Engine Overview

The Automation subsystem consists of two interconnected layers:
1. **Event-Driven Workflow Engine (`waAutomationService.js`)**: Evaluates incoming events (inbound messages, status transitions, schedules), filters by conditional rules, and dispatches multi-step action plans through durable queues.
2. **Visual Chatbot Runtime (`waFlowEngine.js` & `sharedFlowRuntime.js`)**: Executes node-based conversation trees with interactive WhatsApp components (buttons, lists, inputs, API calls, and human handover).

---

### 2. Supported Event Triggers

| Trigger Identifier | Source Event | Context Payload |
| :--- | :--- | :--- |
| `INBOUND_MESSAGE` | Customer sends WhatsApp message | `chatId`, `messageText`, `senderPhone`, `contactId` |
| `NEW_CONTACT` | Contact created manually or via webhook | `contactId`, `phone`, `tags`, `source` |
| `LEAD_STATUS_CHANGED` | Enquiry or lead transitions status | `enquiryId`, `previousStatus`, `newStatus`, `temperature` |
| `DEAL_STAGE_CHANGED` | Sales deal moves along pipeline | `dealId`, `previousStage`, `newStage`, `amount` |
| `PAYMENT_RECEIVED` | Razorpay / Shopify payment success | `paymentId`, `amount`, `orderId`, `phone` |
| `FORM_SUBMITTED` | Website form / landing page lead | `formData`, `phone`, `email`, `serviceInterested` |
| `SCHEDULED_TIME` | Cron or delayed drip timer | `checkpointId`, `targetEntityId`, `scheduledAt` |

---

### 3. Condition Evaluation Model (`waRuleConditions.js`)

Conditions support nested group logic:
```json
{
  "operator": "AND",
  "conditions": [
    { "field": "contact.tags", "operator": "CONTAINS", "value": "VIP" },
    { "field": "message.text", "operator": "REGEX", "value": "^(help|support|price)" },
    {
      "operator": "OR",
      "conditions": [
        { "field": "contact.lifecycle_stage", "operator": "EQUALS", "value": "lead" },
        { "field": "enquiry.temperature", "operator": "IN", "value": ["warm", "hot"] }
      ]
    }
  ]
}
```

---

### 4. Workflow Actions Library

1. **Messaging Actions**:
   - `SEND_TEXT`: Send contextual reply.
   - `SEND_TEMPLATE`: Dispatch approved WhatsApp template with variables.
   - `SEND_INTERACTIVE`: Dispatch quick-reply buttons or list picker.
2. **CRM & Entity Actions**:
   - `ADD_TAG` / `REMOVE_TAG`: Update contact categorization.
   - `CREATE_DEAL`: Instantiate deal in sales pipeline.
   - `UPDATE_STAGE`: Transition deal stage.
   - `ASSIGN_AGENT`: Route to specific agent or round-robin team.
   - `CREATE_TASK`: Schedule follow-up task.
   - `ADD_INTERNAL_NOTE`: Post private note on chat thread.
3. **External Gateway Actions**:
   - `HTTP_REQUEST`: Dispatch webhook to third-party endpoint with HMAC signature.
   - `RAZORPAY_PAYMENT_LINK`: Generate payment link and send to customer.
4. **Flow Control**:
   - `WAIT_DELAY`: Pause execution for specified duration.
   - `WAIT_UNTIL_DATE`: Pause until specified datetime.
   - `STOP_WORKFLOW`: Terminate further actions.

---

### 5. Durable Checkpoints & Multi-Day Workflows
- Multi-day drip campaigns and delay nodes persist their execution resume state in `wa_automation_checkpoints`.
- The background scheduler (`backend/server.js`) scans for pending checkpoints every 60 seconds, ensuring zero lost workflows across backend server restarts.
