# WhatsApp Interactive Messaging

How native tappable WhatsApp buttons and lists work in this CRM, and how to configure them.

> **Scope note.** Most of this architecture already existed before this change — the
> Cloud API client, the webhook, the flow engine, the visual flow builder, multi-tenant
> credential storage. This document describes the whole system, and the
> [What changed](#what-changed) section at the end lists only what was added.

---

## 1. Architecture

```
                         Application code
             (flow engine, menus, reminders, billing)
                              │
                              ▼
                     services/waLoadBalancer.js
                   ── the only provider abstraction ──
        sendText · sendTemplate · sendMedia
        sendInteractiveButtons · sendInteractiveList
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
      cloud_api engines                web_session engines
   services/whatsappCloudApi.js     services/whatsappService.js
       (Meta Graph API)               (whatsapp-web.js + QR)
              │                               │
      NATIVE interactive UI            text only — whatsapp-web.js
      buttons · lists · CTA            deprecated Buttons/List
              │                               │
              └───────────────┬───────────────┘
                              ▼
                          Customer
                              │
                    taps a button / picks a row
                              ▼
                  routes/waWebhookRoutes.js
          verify signature → claim event (idempotent)
          → normalize to { type, actionId, title }
                              ▼
            waFlowEngine · waMenuHandler · waConfirmationService
                              ▼
                        CRM side effects
                 (lead, task, booking, handoff)
```

**Application code never calls `whatsappCloudApi` or `client.sendMessage` directly.**
It calls `waLoadBalancer`, which owns provider choice, quota accounting, failover, and
the text fallback.

### Why two providers

| Capability | `whatsapp-web.js` (QR) | Cloud API |
|---|---|---|
| QR login / existing sessions | ✅ | ❌ |
| Send text / media / templates | ✅ | ✅ |
| Receive messages | ✅ | ✅ |
| **Native reply buttons** | ❌ deprecated upstream | ✅ |
| **Native list messages** | ❌ deprecated upstream | ✅ |
| Official webhooks + delivery receipts | ❌ | ✅ |
| Suited to production SaaS | ⚠️ | ✅ |

`whatsapp-web.js` marks `Buttons` and `List` as deprecated/unsupported, so **native
interactive UI is only possible through the Cloud API**. The QR provider is kept intact
for everything it already does.

### Degradation, not faking

If no Cloud API sender can deliver (none configured, token expired, 24-hour window
closed), `waLoadBalancer` sends the **numbered-text equivalent** through whichever sender
is available, and returns `native: false`.

This is a delivery guarantee, not a fake button: the customer still receives the message,
and the inbound matchers already accept a typed number or option name as well as a tapped
reply id. Nothing ever pretends emoji text is a native button — the admin UI and the
`/test-welcome` response both tell you when a send degraded.

---

## 2. Configuration

### Environment variables (`backend/.env`)

```ini
WA_PHONE_NUMBER_ID=123456789012345    # Cloud API phone number id
WA_ACCESS_TOKEN=EAAG...               # permanent system-user token
WA_WABA_ID=123456789012345            # WhatsApp Business Account id
WA_APP_SECRET=abc123...               # enables X-Hub-Signature-256 verification
WA_VERIFY_TOKEN=crm_verify_123        # your own webhook verification string
WA_BUSINESS_ACCOUNT_ID=               # optional
WA_DISPLAY_PHONE_NUMBER=              # optional, display only
WA_VERIFIED_NAME=                     # optional, display only
```

Credentials are **server-side only** — never sent to the browser. The admin UI reads
status through `GET /api/wa/config`, which returns `{ configured, phoneNumberId, ... }`
and no token.

### Per-tenant credentials

For multi-tenant use, store credentials per user in `user_wa_configs` (access token and
app secret encrypted via `backendutil/cryptoHelper`). `waConfigHelper.configureForUser(userId)`
loads them, falling back to any enabled config and then to the environment.

`.env` is the single-tenant / default path; `user_wa_configs` is the SaaS path.

### Provider preference

`waLoadBalancer` accepts `preferredEngine: "cloud_api" | "web_session"`, or a
`routingStrategy` of `round_robin` | `least_loaded` | `cloud_first`. Sender pools live in
`wa_sender_pools` / `wa_sender_pool_members` with per-number daily and hourly quotas and
automatic cooldown after 3 consecutive failures.

**Interactive sends only ever consider interactive-capable senders**, so a connected QR
session can no longer win the round-robin and downgrade a button menu to text.

---

## 3. Meta Cloud API setup

1. **Create the app** — [developers.facebook.com](https://developers.facebook.com) → Create App → *Business* → add the **WhatsApp** product.
2. **Get a phone number id** — WhatsApp → API Setup. Copy the *Phone number ID* → `WA_PHONE_NUMBER_ID`, and the *WhatsApp Business Account ID* → `WA_WABA_ID`.
3. **Create a permanent token** — Business Settings → Users → **System Users** → add a system user with the `whatsapp_business_messaging` and `whatsapp_business_management` permissions → Generate token → `WA_ACCESS_TOKEN`. (The 24-hour temporary token in API Setup is for smoke tests only.)
4. **App secret** — Settings → Basic → App Secret → `WA_APP_SECRET`. Required for signature verification.
5. **Configure the webhook** — WhatsApp → Configuration → Edit:
   - Callback URL: `https://<your-domain>/api/wa/webhook`
   - Verify token: the same string as `WA_VERIFY_TOKEN`
   - Subscribe to the **`messages`** field (covers inbound messages, interactive replies, and status updates).
6. **Verify** — Meta sends `GET /api/wa/webhook?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...`; the route echoes the challenge on a token match, else `403`.

### Local development

Meta requires a public HTTPS callback, so tunnel it:

```bash
npx localtunnel --port 5000      # or: ngrok http 5000
# then set the Callback URL to https://<tunnel-host>/api/wa/webhook
```

Leave `WA_APP_SECRET` unset locally to skip signature verification while testing with
curl; **always set it in production** (`isValidSignature` only enforces when present).

---

## 4. Sending interactive messages

All of these go through `waLoadBalancer`. Never import `whatsappCloudApi` in
application code.

### Reply buttons (max 3)

```js
const waLoadBalancer = require("./services/waLoadBalancer");

await waLoadBalancer.sendInteractiveButtons({
  phone: "919876543210",          // or phoneNumber; 10 digits are prefixed with 91
  body: "Your quotation #QT-1024 is ready.\n\nWhat would you like to do?",
  header: null,                    // optional, <= 60 chars
  footer: "SOCIA CRM",             // optional, <= 60 chars
  buttons: [
    { id: "quote_view",  title: "Check my quote" },
    { id: "quote_not_now", title: "Not now" },
  ],
  sessionKey: null,                // optional, for web-session fallback
  tenantId: 1,
});
```

### List message (max 10 rows total, across sections)

```js
await waLoadBalancer.sendInteractiveList({
  phone: "919876543210",
  body: "How can we help you today?",
  header: "Our Services",
  footer: "Madhura Tech",
  buttonText: "View options",      // the tappable label, <= 20 chars
  sections: [
    {
      title: "Services",
      rows: [
        { id: "service_web", title: "Website Development", description: "Build your business website" },
        { id: "service_ai",  title: "AI Automation",       description: "Automate your business" },
      ],
    },
  ],
});
```

`sections` also accepts a **flat row array**, which is wrapped into a single section.

### CTA URL button (one tappable link button)

```js
await waLoadBalancer.sendCTAButtonMessage({
  phone: "919876543210",
  body: "Your quotation #QT-1024 is ready.",
  displayText: "Check my quote",          // the button label, <= 20 chars
  url: "https://madhuratech.com/q/1024",  // must be http(s)
  header: null,
  footer: "Madhura Tech",
  sessionKey: null,
});
```

This is a **free-form** interactive message (`interactive.type = "cta_url"`), so it
needs **no template and no template approval** — only the 24-hour customer-service
window, same as reply buttons and lists. Use it instead of pasting a raw link into
body text: the URL hides behind the label, which is what makes
"Your quote is ready → `[ Check my quote ]`" look native.

Meta limits it to **one** link button per message, and it cannot be mixed with reply
buttons in the same message. Send them as two messages if you need both.

Because a link button produces no inbound reply, there is no action id to match — the
customer leaves for the URL — so a `send_cta` flow node always continues straight to
its `next_node_key`.

Fallback differs from buttons and lists: there are no options to number, so a
web-session send appends the URL as a real link (WhatsApp renders a preview, so it
stays tappable) rather than adding a "reply with a number" hint.

### Return value

```js
{
  success: true,
  native: true,            // false => degraded to numbered text
  kind: "buttons",         // or "list"
  engineUsed: "Meta Cloud API",
  senderPhone: "911234567890",
  failover: false,         // true if the first sender failed
  result: { /* raw Meta response */ }
}
```

### Other message types

| Need | Call |
|---|---|
| Text | `waLoadBalancer.sendTextMessage(phone, text, sessionKey)` |
| Image / document / video | `waLoadBalancer.sendMediaMessage(phone, type, url, caption, filename, sessionKey)` |
| Template | `waLoadBalancer.sendTemplateMessage(phone, name, lang, components, sessionKey)` |
| CTA URL button | `waLoadBalancer.sendCTAButtonMessage(...)` — see above |

---

## 5. Action IDs

**A button's backend meaning is its `id`, never its displayed title.**

```js
{ id: "quote_view", title: "Check my quote" }   // ✅ rename the title freely
{ id: "Check my quote", title: "Check my quote" } // ❌ breaks on any copy edit
```

Ids are capped at 256 chars (buttons) / 200 (rows); titles at 20 / 24 and **normalized**:
`services/waInteractive.js` strips an authored ordinal prefix, so a button written as
`"1. Our Services"` reaches Meta as `Our Services`. The ordinal is re-added only in the
text fallback, where numbering is actually meaningful.

### Authorization — how ids stay safe

Inbound ids are **never** used to look up a function. Each consumer resolves the id
against records it already owns, so an attacker-supplied id can only ever name something
the operator configured:

| Consumer | Resolution | Ownership check |
|---|---|---|
| `waFlowEngine` | id → `next_node_key` within **this flow run's own node graph** | the run is bound to one flow and one phone |
| `waMenuHandler` | id → a row of `wa_automation_options` **for this automation** | `wa_pending_menus` pins the automation per phone |
| `waConfirmationService` | id → an option stored on **that reminder row** | reminder is keyed to the phone |

There is deliberately **no global `ACTION_REGISTRY` mapping ids to functions** — that
would be a weaker design than the existing per-record scoping, which cannot address
anything outside the record the customer is actually in.

---

## 6. Receiving taps

`routes/waWebhookRoutes.js` `POST /api/wa/webhook`:

1. **Verify** `X-Hub-Signature-256` (HMAC-SHA256 of the raw body with the app secret). Enforced whenever `WA_APP_SECRET` is set.
2. **Claim** the event — `INSERT IGNORE` into `wa_webhook_events`; `affectedRows === 0` means a retry, and processing stops. See [idempotency](#7-database).
3. **Normalize** an interactive reply to:

```js
{
  type: "button_reply" | "list_reply",
  actionId: "quote_view",        // the operator-defined id
  title: "Check my quote",
  description: null,             // list rows only
  messageId: "wamid.HBg...",
  phone: "919876543210",
  timestamp: "2026-09-23T10:15:00.000Z"
}
```

   Stored in `wa_message_logs.interactive_payload` so taps are queryable:

```sql
SELECT phone, created_at
  FROM wa_message_logs
 WHERE direction = 'inbound'
   AND interactive_payload->>'$.actionId' = 'quote_view';
```

4. **Dispatch**, in order, stopping at the first handler that claims it:
   `waConfirmationService` → `waCustomerBillingService` → `waFlowEngine.dispatchInbound`
   → `waMenuHandler.handleMenuReply` → welcome auto-reply → AI auto-reply.
5. **Always reply `200`** — a non-200 makes Meta retry the whole batch.

Guards already in place: opt-out keywords (`stop`, `unsubscribe`, …), a 120-second stale
replay guard, campaign-reply isolation, and a 24-hour outbound guard that suppresses the
welcome message when the company contacted the customer first.

---

## 7. Database

No new tables. Existing tables used:

| Table | Role |
|---|---|
| `wa_message_logs` | every inbound/outbound message; `interactive_payload` holds the normalized tap, `metadata` the raw payload |
| `wa_webhook_events` | raw event audit **and** the idempotency claim |
| `wa_flows`, `wa_flow_runs`, `wa_flow_run_events` | flow definitions, per-contact state, step audit |
| `wa_automations`, `wa_automation_options`, `wa_pending_menus`, `wa_automation_logs` | menu automations and their pending state |
| `wa_interactive_reminders` | 2-way confirmations and their options |
| `wa_templates`, `wa_campaigns`, `wa_campaign_messages` | templates and bulk sends |
| `wa_sender_pools`, `wa_sender_pool_members` | multi-number pools, quotas, health |
| `user_wa_configs`, `wa_accounts` | per-tenant credentials (encrypted) |

Columns added (auto-applied at boot by `waDatabase.ensureWATables()`):

```
wa_welcome_settings.welcome_type     ENUM(... ,'buttons')   -- widened
wa_welcome_settings.welcome_buttons  TEXT   -- JSON [{id,title}]
wa_welcome_settings.welcome_footer   VARCHAR(60)
```

Access tokens live only in `user_wa_configs` / `wa_accounts` (encrypted) or the
environment — never in a message record.

### Idempotency migration — run once

```bash
node backend/migrations/wa_webhook_idempotency.js
```

Dedupes `wa_webhook_events` and adds `UNIQUE (event_type, wa_message_id, status)`, which
is what makes the webhook claim actually dedupe. **Until this runs, a retried delivery is
still reprocessed** (the claim always succeeds) — behaviour is unchanged, just unprotected.
Kept out of boot on purpose: the `DELETE` can hold a long lock on a large table.

Also available, if not already applied: `node backend/migrations/wa_dedupe_message_logs.js`.

---

## 8. Bot control — when the bot must stay quiet

`services/waBotGate.js` is the single authority for *"may the bot engage this
contact right now?"*. Every bot-initiated inbound handler asks it first.

```
      customer message arrives
                │
     ┌──────────┴──────────┐
     │  always processed   │   opt-out / STOP
     │  (never gated)      │   waConfirmationService  (answering a reminder
     └──────────┬──────────┘                          the operator sent)
                │
                ▼
         waBotGate.botMayReply(phone)
                │
   ┌────────────┴────────────┐
   │ blocked                 │ allowed
   ▼                         ▼
 stay silent            waFlowEngine.dispatchInbound
 (logged, one line)     waMenuHandler.handleMenuReply
                        welcome auto-reply
                        waAiReply
```

The gate blocks on any of:

| Reason | Set by |
|---|---|
| `agent_takeover` | a manual reply / media / location from the CRM inbox, assigning the chat to an agent, a flow `handoff` node, the customer typing "agent", the AI handoff tool |
| `bot_disabled_for_contact` | `wa_contacts.ai_enabled = 0` — the per-chat bot switch |
| `contact_unsubscribed` | replied STOP / UNSUBSCRIBE |
| `contact_blocked` | `wa_contacts.is_blocked` |
| `invalid_phone` | fewer than 10 digits |

A contact with **no `wa_contacts` row at all** is allowed — a first-time sender
still gets greeted. That is deliberate and was chosen explicitly; see
[new contacts](#new-contacts).

### Takeover window

**24 hours**, matching Wati/WACTO. Override with `WA_AI_TAKEOVER_MIN` (minutes)
in `backend/.env`.

The window is applied by `waBotGate.pauseBot()`, which is the only writer. It
is triggered by:

| Action | Window |
|---|---|
| Agent sends a text, media or location by hand | `WA_AI_TAKEOVER_MIN` (24h) |
| Chat assigned to an agent | 24h |
| Flow `handoff` node, or customer types "agent" | `WA_AI_TAKEOVER_MIN` (24h) |
| Ticket marked **spam** | 1 year |
| Ticket marked **resolved**, or chat unassigned | pause cleared — bot resumes |

The pause also lapses on its own when the window expires, so a forgotten
ticket never silences a contact permanently.

### Giving the chat back to the bot

In the WhatsApp inbox, an open chat whose bot is paused shows a pill in the
chat header:

```
┌────────────────────────────────────────────────┐
│ ● Bot paused              [ Let bot reply ]    │
└────────────────────────────────────────────────┘
```

Clicking **Let bot reply** calls `PATCH /api/whatsapp/chat/:phone/ai` with
`{ enabled: true }`, which re-enables the bot and clears the pause. Marking the
ticket resolved does the same thing.

Read the state directly with:

```bash
GET /api/whatsapp/chat/:phone/bot-status
# => { enabled, paused, pausedUntil, assignedAgentName, ticketStatus }
```

This endpoint is DB-only by design — the pill must render even when no
WhatsApp session is connected.

### New contacts

A brand-new number that has never been in the CRM **does** get the bot's
automatic reply. This is the configured choice: the bot works as a 24/7
receptionist, and the takeover rules above are what stop it from talking over
a human.

To change that, gate on the contact lookup the gate already performs —
`shouldBotEngage` returns `contact: null` for an unknown number, so a single
`if (!contact) return { allowed: false, reason: "unknown_contact" }` in
`waBotGate.js` makes the bot silent for numbers with no CRM record.

### Diagnosing "the bot stopped replying"

Almost always an active pause. Check, in order:

```sql
SELECT phone, ai_enabled, ai_paused_until, assigned_agent_id, ticket_status,
       is_blocked, is_unsubscribed
  FROM wa_contacts WHERE phone LIKE '%9876543210';
```

- `ai_paused_until` in the future → an agent (or a handoff) owns the chat. Resolve the ticket or click **Let bot reply**.
- `ai_enabled = 0` → the per-chat switch is off.
- `is_unsubscribed = 1` → they sent STOP. Only they can undo it (reply START).

Server logs name the reason on every suppression:

```
🤫 [WA BotGate] Flow bot suppressed for +919876543210 — agent_takeover (bot paused until ...)
```

---

## 9. Automation workflows

A tapped id drives the flow graph:

```
customer taps  [ Check my quote ]
        │  actionId = "quote_view"
        ▼
waFlowEngine.dispatchInbound(phone, text, actionId, ...)
        │  match actionId against this run's current node buttons
        ▼
follow next_node_key
        │
        ├─ send_message / send_media / send_template
        ├─ send_buttons / send_list / interactive_menu
        ├─ collect_input      → store to a run variable
        ├─ condition          → branch
        ├─ crm_lookup         → read CRM
        ├─ create_lead        → write CRM
        ├─ api_webhook        → call out
        ├─ handoff            → assign a live agent
        └─ end
```

Matching is layered and tolerant: reply id → exact id → exact title → typed ordinal →
symbol-stripped fuzzy title. So the same flow works whether the customer **taps** a native
button or **types** `2` after a text fallback.

Build and edit flows visually at **Dashboard → WhatsApp → Flows**
(`frontend/src/pages/whatsappFlows.jsx`): drag nodes, edit each button's **Title** and
**Action ID**, and wire each button's output port to its next node.

Welcome buttons are configured at **Dashboard → WhatsApp → Automations → Welcome**.

---

## 10. Testing

```bash
# Unit / routing self-check — no DB, no network
node backend/tests/test_wa_interactive.js

# Other WhatsApp self-checks
node backend/tests/test_wa_flow_engine_fixes.js
node backend/tests/test_wa_automation_boundaries.js

# Jest suite (needs MySQL running)
cd backend && npm test
```

### Send a real button message

**Via the UI** — Automations → Welcome → type *Tappable Buttons*, add buttons, Save,
then **Send Test** to your own number. The result line says which engine sent it and warns
you if it degraded to text.

**Via the API**

```bash
curl -X POST https://<host>/api/wa/automations/test-welcome \
  -H "Authorization: Bearer <jwt>" -H "Content-Type: application/json" \
  -d '{"phone":"919876543210"}'
# => { "success": true, "engineUsed": "Meta Cloud API", "native": true }
```

`native: false` means no Cloud API sender was available — check
`GET /api/wa/automations/load-balancer-stats`.

### Send a real list message

Activate a flow whose entry node is `send_list` (Flows → the seeded
*Interactive Main Business & Services Menu*), then message the business number from
WhatsApp. The main menu has 4 options, so it is delivered as a native list.

### Test any interactive type on a real handset

One endpoint sends a live test through the normal production path, so you can verify
native rendering before building a flow:

```bash
# reply buttons
curl -X POST https://<host>/api/wa/config/test-interactive \
  -H "Authorization: Bearer <jwt>" -H "Content-Type: application/json" \
  -d '{"phone":"919876543210","kind":"buttons"}'

# list
curl ... -d '{"phone":"919876543210","kind":"list"}'

# CTA link button
curl ... -d '{"phone":"919876543210","kind":"cta",
              "body":"Your quotation #QT-1024 is ready.",
              "button_text":"Check my quote",
              "url":"https://madhuratech.com/q/1024"}'
```

Response:

```json
{ "success": true, "kind": "cta_url", "native": true,
  "engineUsed": "Meta Cloud API", "senderPhone": "911234567890", "failover": false }
```

`"native": false` means no Cloud API sender could deliver and it went out as text —
check `GET /api/wa/automations/load-balancer-stats`.

Pass `buttons`, `sections`/`rows`, `header` or `footer` to override the defaults.
The recipient must have messaged you within the last 24 hours, or Meta rejects the
send with `(#131047)`.

### Send a CTA link button from a flow

Flows → drag **🔗 Link Button** into the canvas. Fill in the message text, the button
label (≤ 20 chars), and an `https://` URL — variables like `{quote_no}` are
substituted before sending. The panel shows a WhatsApp-shaped preview and flags a URL
missing its scheme, since Meta rejects those and the step is skipped.

### Simulate an inbound tap without a phone

```bash
curl -X POST http://localhost:5000/api/wa/webhook \
  -H "Content-Type: application/json" \
  -d '{"entry":[{"changes":[{"field":"messages","value":{
        "metadata":{"phone_number_id":"123"},
        "contacts":[{"profile":{"name":"Test"}}],
        "messages":[{
          "from":"919876543210",
          "id":"wamid.test001",
          "timestamp":"'$(date +%s)'",
          "type":"interactive",
          "interactive":{"type":"button_reply",
            "button_reply":{"id":"quote_view","title":"Check my quote"}}
        }]}}]}]}'
```

Expect `👆 [WA Interactive] button_reply ... actionId="quote_view"` in the logs. **Send it
twice** — after running the idempotency migration, the second call logs
`🔁 Duplicate delivery ... skipping`. (Unset `WA_APP_SECRET` or add a valid signature
header, or the request is rejected with `403`.)

Note the `timestamp` must be current: messages older than 120 seconds are logged but
bypass automations by design.

---

## 11. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Buttons arrive as a numbered text list | No Cloud API sender, or it failed | Check `native` in the send result and the `↩️ No interactive-capable sender` log; verify `WA_PHONE_NUMBER_ID` / `WA_ACCESS_TOKEN` |
| Button labels read "1. Our Services" | An authored ordinal — should now be stripped | Re-seed flows, or clear the prefix in the flow builder |
| Webhook verification fails | Verify-token mismatch | `WA_VERIFY_TOKEN` must equal the string in Meta → Configuration |
| Webhook returns 403 | Bad/missing `X-Hub-Signature-256` | Confirm `WA_APP_SECRET`; ensure the raw body is preserved (`req.rawBody`) |
| Error `(#131047) Re-engagement message` | 24-hour customer-service window closed | Business-initiated messages need an approved **template**; interactive free-form only works inside 24h of the customer's last message |
| Error `(#131030)` | Recipient not on the allow-list | Add the test number in Meta → API Setup while the app is in development mode |
| `Invalid OAuth access token` | Temporary 24h token expired | Issue a permanent System User token |
| Nothing happens on tap | Flow inactive, or the id has no `next_node_key` | Check `wa_flows.status = 'active'` and the button's wiring in the flow builder |
| Same action fires twice | Meta retry, index not yet applied | Run `node backend/migrations/wa_webhook_idempotency.js` |
| Welcome message never sends | Working as designed | It is suppressed for campaign replies, active flows, and any contact your company messaged in the last 24h — see the guards listed in the UI |

Useful queries:

```sql
-- last 20 interactive taps
SELECT phone, interactive_payload->>'$.actionId' AS action, message_text, created_at
  FROM wa_message_logs
 WHERE direction='inbound' AND message_type='interactive'
 ORDER BY id DESC LIMIT 20;

-- recent send failures
SELECT phone, message_type, error, created_at
  FROM wa_message_logs
 WHERE status='failed' ORDER BY id DESC LIMIT 20;
```

---

## 12. Production deployment

```bash
cd backend  && npm ci && pm2 start ecosystem.production.config.js
cd frontend && npm ci && npm run build      # serve build/ via nginx
node backend/migrations/wa_webhook_idempotency.js   # once
```

Checklist: `WA_APP_SECRET` set (signature verification on) · webhook URL is HTTPS and
public · permanent system-user token, not a 24h one · templates approved for any
business-initiated messaging · `nginx-local/` and `server-deployment/` hold the existing
reverse-proxy config.

---

## 13. Migration from whatsapp-web.js

**No migration is required. Nothing was removed.** QR login, session handling, contact
sync, inbound handling, outbound sends, CRM integration and existing automations all work
as before.

Recommended path:

1. Keep the QR session running. Configure the Cloud API alongside it.
2. Interactive sends automatically prefer the Cloud API (only it can render native UI); everything else keeps its existing routing.
3. Move traffic over gradually with `preferredEngine: "cloud_api"` or `routingStrategy: "cloud_first"`, or by adding Cloud senders to a pool.
4. Retire the QR session only once you no longer need features it uniquely provides.

---

## What changed

Added in this change — everything else described above already existed:

- **`services/waInteractive.js`** (new) — one place that normalizes button/row titles and ids and builds the text fallback. Previously each of five call sites had its own copy, and the ordinal-stripping regex ran **only** on the text fallback, so a button authored `"1. Our Services"` was sent to Meta verbatim and rendered as a native button labelled `"1. Our Services"` — the bug that made real interactive messages look like the old type-a-number menu.
- **`waLoadBalancer.sendInteractiveButtons` / `sendInteractiveList`** — interactive joins text/template/media in the provider abstraction, with cloud-sender selection, failover, quota accounting, and the text fallback. Five call sites (flow engine ×3, menu handler, confirmation, billing) now route through it instead of importing `whatsappCloudApi` directly.
- **Fixed silent drops** — in `waCustomerBillingService` and `waConfirmationService` a throwing Cloud API call (expired token, closed 24h window) sent the customer *nothing*. Both now degrade to text.
- **Interactive sends no longer lose the round-robin to a QR session** — only interactive-capable senders are considered.
- **Welcome auto-reply supports native buttons** — `welcome_type: 'buttons'` plus `welcome_buttons` / `welcome_footer`, a button builder and a WhatsApp-accurate preview in the admin UI, and a test send that reports whether it went native.
- **Webhook idempotency** — atomic `INSERT IGNORE` claim on `wa_webhook_events` so a Meta retry no longer re-runs lead capture, flow dispatch and campaign counters. Needs `migrations/wa_webhook_idempotency.js` run once.
- **Inbound taps are queryable** — the normalized `{ type, actionId, title, ... }` is stored in `wa_message_logs.interactive_payload` and logged.
- **Seed data de-numbered** — flow button titles no longer carry `"1. "`, `"2. "` prefixes.
- **`tests/test_wa_interactive.js`** (new) — 12 checks over normalization and provider routing, no DB or network.

### Bot control (second pass)

- **`services/waBotGate.js`** (new) — one authority for "may the bot engage this contact?". A takeover pause already existed (`wa_contacts.ai_paused_until`, written by a manual inbox reply, a flow `handoff` node and the AI handoff tool) but **only `waAiReply` ever read it**. So an agent takeover muted the AI while the flow bot kept talking, and a `handoff` was undone by the customer's very next message — the run was marked `handed_off`, found no active run, fell through to trigger matching, and an `all_inbound` flow restarted the bot. The gate makes that column authoritative for the flow engine, the menu handler and the welcome auto-reply too.
- **Takeover window 30 min → 24 hours** (`WA_AI_TAKEOVER_MIN`), matching Wati/WACTO. The old window let the bot re-enter a chat an agent was still handling.
- **Every manual reply now pauses the bot** — `/send-media` and `/send-location` previously did not, so sending a PDF by hand left the bot live.
- **Assign pauses, resolve resumes** — assigning a chat to an agent pauses the bot for 24h, unassigning or marking the ticket resolved hands it back, marking it spam keeps the bot out for a year.
- **Flow handoff aligned** — the `handoff` node and the "agent" keyword used a separate 120-minute window; both now use the shared pause, so a handoff outlasts the bot.
- **Visible and undoable** — the backend already exposed the pause state but no UI read it. The inbox chat header now shows a `● Bot paused  [ Let bot reply ]` pill, backed by a new DB-only `GET /api/whatsapp/chat/:phone/bot-status`.
- **`tests/test_wa_bot_gate.js`** (new) — 9 checks over the gate's decisions, including that it fails *open* on a DB error and still greets an unknown first-time sender.

Unchanged by choice: a brand-new number with no CRM record still gets the bot's
automatic reply. See [new contacts](#new-contacts) for the one-line change if you
ever want the opposite.

### CTA URL buttons (third pass)

- **`whatsappCloudApi.sendCTAUrl()` + `waLoadBalancer.sendCTAButtonMessage()`** (new) — native `interactive.type = "cta_url"`: one tappable button that opens a link, with the URL hidden behind the label. **Correction to earlier notes in this file: this does NOT require a message template.** It is a free-form interactive message and works inside the 24-hour customer-service window exactly like reply buttons and lists. The earlier claim that CTA buttons were template-only was wrong.
- **`send_cta` flow node** — plus a **🔗 Link Button** entry in the flow builder palette with a config panel (text, label, URL, footer), a WhatsApp-shaped preview, and validation that rejects a URL with no `http(s)` scheme. Since a link button returns no reply id, the node continues straight to `next_node_key`.
- **Distinct fallback** — a CTA has no options to enumerate, so a web-session send appends the URL as a real link (WhatsApp still renders a tappable preview) instead of adding a nonsensical "reply with a number" hint. Pinned by a test.
- **`POST /api/wa/config/test-interactive`** (new) — sends one live `buttons` / `list` / `cta` test through the production path and reports `native` true/false, so you can verify real rendering on a handset without building a flow first.
- **`tests/test_wa_interactive.js`** grew from 12 to **16 checks**, covering CTA routing, the link-preserving fallback, and rejection of a missing or scheme-less URL.
