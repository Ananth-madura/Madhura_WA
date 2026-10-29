# SOCIA native WhatsApp workflow hub

SOCIA runs the visual graph itself. n8n is not installed, embedded or required. Customer messages enter through the existing Meta webhook and published workflows send through the conversation's organization-owned Cloud API sender.

## Use the hub

1. Open WhatsApp → Flows → Create flow. In Add step, filter the Workflow library by system or industry. The library includes 55 business starters across ten systems, plus the existing 13 conversation/service starters. Appointments includes all ten requested workflows.
2. Choose a starter, edit its questions, keywords and branches, and save a draft. Starters do not activate automatically.
3. In Flow settings → Workflow connections, an organization administrator adds a public HTTPS business endpoint, bearer token and explicit allowed operations. The default starter connection name is `business`. Credentials stay on the server and use the existing `SMTP_ENCRYPTION_KEY` encryption configuration. Restart the backend to run the additive connection-table migration before using connection settings.
4. Configure each Business Action's inputs and output mappings. Only mapped inputs leave the workflow. Output variable names refer to flow variables; output paths refer to the response's `data` object.
5. Preview the conversation. Action results display labeled samples; the failure toggle tests error routes. Preview makes no business or AI calls.
6. Publish after testing. Publishing checks the graph, connection ownership, operation allowlist and AI configuration where applicable. Start in an existing conversation within its eligible service window. Inspect Live Run Audit → View execution for step and action events.

## Native steps

The builder supports message triggers, text, buttons, lists, validated questions, contact snapshots, variables, grouped AND/OR conditions, business hours, handoff and end steps. This update adds:

- **Switch / Multiple Routes:** first matching rule wins; Otherwise is required. Up to ten routes can compare collected or returned variables.
- **Business Action:** a bounded server-side HTTPS call with explicit inputs, scalar response mappings, and separate Success/Failure connections. No automatic retry occurs after an uncertain business action.
- **AI Reply:** uses the configured inbox AI assistant, writes its response to a custom variable, and follows Success or Failure. Connect a Text Message step containing `{{ai_response}}` to send it. This step has the existing assistant's current-message context and business instructions; it does not independently retrieve documents or execute tools.
- **Media / PDF:** sends documents, images, videos or audio using the organization's Meta sender and a fixed HTTPS media destination. Variables in URL paths/queries are encoded; they cannot change the destination domain.

## Business endpoint contract

Business connections call your business service, CRM adapter or integration endpoint. They do not require n8n. An adapter is configured once and can serve many independently editable workflows. A starter is not an implementation of a calendar, payment provider, ERP or HR database.

SOCIA sends `POST` with `Authorization: Bearer <saved token>`, `Idempotency-Key`, and JSON:

```json
{
  "operation": "appointments.booking_create",
  "inputs": {
    "customer_phone": "919000000000",
    "service": "Consultation",
    "branch": "Central",
    "date": "2026-12-15",
    "time": "10:00"
  },
  "context": {
    "tenantId": 7,
    "conversationId": 10,
    "runId": 20,
    "idempotencyKey": "stable hash for this run, message and action occurrence"
  }
}
```

The service must authenticate the token, bind it to the organization, enforce operation permissions, verify customer access and source records, and deduplicate the idempotency key. The supplied context identifies a request; it does not replace authorization. For example, booking creation must check live availability atomically, and receipts must come from provider-verified payments. A customer message or AI reply is never sufficient proof.

An HTTP 2xx response must confirm success explicitly and supply every mapped output:

```json
{
  "success": true,
  "data": {
    "message": "Your booking is confirmed. Reference B-100.",
    "booking": { "reference": "B-100" }
  }
}
```

Map `result_message` to `message` and, optionally, `booking_reference` to `booking.reference`. Use `{{result_message}}` in the next text step. Missing outputs, invalid responses, timeouts and denied operations follow Failure. A timeout or response-mapping error can occur after the remote system committed an action: check the source system before starting another run. Success text must come from verified business data.

Requests have a 15-second timeout, no redirects, pinned public IPv4 DNS resolution, bounded request/response sizes, a tenant operation allowlist and at most 40 automatic steps per inbound turn. Tokens and business payloads are excluded from run events. Employee takeover is checked before an action and after it returns; an already submitted external action cannot be recalled.

For operator-managed deployments, `WA_FLOW_CONNECTIONS` can provide a JSON registry keyed by tenant ID, then connection name, with `url`, `token` and `operations`. Saved organization connections take precedence. Avoid mixing the two sources for the same connection: removing a saved connection reveals any operator fallback.

## Production boundaries

- Reminder starters submit scheduling requests to the connected business scheduler. This update does not add a durable Wait node or a general cron/webhook workflow trigger.
- Existing conversational waits keep answers in transient memory. A backend restart ends active conversations and returns them to employees; it does not resume them from a checkpoint.
- The workflow hub does not yet provide reusable callable subflows, parallel joins, document ingestion/RAG, provider-specific calendar/payment/accounting adapters, or a payment-settlement webhook implementation. Those systems must be connected or implemented separately.
- Existing shared-runtime Meta template approval, service-window, unsubscribe, blocked-contact and human-takeover checks remain in force. Sending beyond the service window requires a separately configured compliant template/reminder path.
- Only one action is executed at a time within a conversation. Idempotency keys are supplied to external services, which must enforce them. The existing inbound webhook claims handle duplicate customer events.

## Validation

Run `node backend/scripts/verify-shared-core.js` for the isolated backend suites, including workflow traversal, live runtime success/failure, connection encryption, tenant boundaries, idempotency keys and loop bounds. Frontend graph and workflow UI tests are in `waFlowGraph.test.js` and `FlowWorkflowHub.test.jsx`. Live Meta delivery and real provider adapters require configured test credentials and source systems.
