# Connected WhatsApp workflow updates

## Browser storage, sender choices, sync and delivery (9 October 2026)

Conversation content and received media are browser-local by default. The database gateway removes message text, interactive payloads, media URLs/filenames, webhook bodies and flow event payloads from application archives. Contacts, configured workflows, campaign queues, receipts and necessary active workflow state remain server-side. Finished flow state is cleared on future terminal updates. `WA_SERVER_CHAT_STORAGE=1` is an explicit deployment override and is surfaced in Accounts.

The workspace shell caches incoming messages and attachments across all WhatsApp pages, with a separate IndexedDB namespace for each signed-in user. Accounts can clear device history. Browser capacity/availability and sender download errors are reported. Manual attachments use a memory upload/send endpoint instead of permanent server upload files; scheduled campaign/template assets remain configured business resources.

QR/Web and Cloud API are selectable for menus. Flow menu nodes require native customer buttons by default; operators can select `Allow numbered text fallback` or `Use QR/Web numbered text`. Native sending failure does not silently become a text menu when native delivery is required. Cloud sends use request/user/account-specific credentials, including sender pools.

Sync imports the available WhatsApp session address book into shared Contacts and visits all session chats, with progress reporting and no old thirty-chat cutoff. It imports recent history (fifty messages per chat) and loads more on demand. Concurrent history/media requests share work. Cloud media IDs are retained as operational references so available attachments can be retrieved without keeping their bytes on this server.

Campaigns use confirmed provider message IDs and distinguish accepted, delivered, read, failed and unconfirmed outcomes. Duplicate/out-of-order receipts cannot inflate counters; early receipts can be reconciled after dispatch. Unconfirmed sends are excluded from automatic retries. Analytics removes duplicated campaign log counts and the invented 98% delivery fallback.

Restart the backend to apply new media-ID/status migrations and rebuild/restart the frontend. Existing server archives/backups are not automatically erased. QR authentication profiles remain server-side because the QR engine runs there. Cloud API provides incoming events rather than a full phone-history import: an open browser is needed to cache message text locally, and provider attachment availability still limits later downloads. Real phone-side sending/receipts need valid connected accounts and have not been exercised by these isolated regressions.

## Chat and Flowbot menus (9 October 2026)

- Chat and the Flowbot simulator share a button/list renderer, including grouped options, descriptions, headers, footers, link actions, and phone actions.
- Interactive metadata survives stored history, live events, cache updates, and live/database message merging. Menus are no longer mistaken for attachments.
- The chat menu composer uses `/api/whatsapp/send-interactive`. Small reply menus use native buttons when supported; grouped/longer menus use lists. The sender's text fallback is clearly labelled in the CRM.
- Sent menus show customer choices for inspection. Incoming options can send their stable IDs. Flowbot preview choices select the configured branch by ID, so duplicate labels are safe. Restart and rapid-click races are guarded.
- Automation menus, welcome buttons, and reminder options retain the same metadata. Menu delivery failures appear as failures and stop the affected flow run.
- Save validation rejects duplicate option IDs and menus above the supported ten-option limit. Larger menus can use the existing next-page flow links.
- Verification: ten backend suites, seven frontend interaction tests, the production build, the route authorization audit, and isolated desktop/mobile browser checks. Build lint warnings remain. The live socket verification requires a running backend; real customer delivery was not exercised.

Run the browser check after building with `node frontend/scripts/check-menu-ui.cjs`. It uses isolated API fixtures and blocks external requests. On systems without Microsoft Edge at the default Windows path, set `WA_QA_BROWSER_PATH` to an installed Chromium browser. Screenshots are saved in `frontend/.qa/`.

Automations, campaigns, Flowbots, reminders, and chat now share corrected personalization and delivery behavior.

## Configure a workflow

1. Open Automations and create or edit a rule. Add conditions with **All conditions** or **Any condition**. Fields can be contact fields such as `city` and `service`, event fields such as `invoice_id` and `amount`, or nested custom data such as `customer.plan`. Comparisons support equality, contains, numeric ranges, and whether a field has a value. No conditions means the rule applies to every matching event.
2. Set the delay in minutes. Delayed first messages are persisted for recovery after a restart. Paused or deleted rules cannot dispatch through a previously scheduled timer.
3. Link a contact group or Flowbot using the existing selectors. Linked flows receive the automation's event data and `automation_id`. Flow-to-flow jumps preserve collected variables.
4. In Reminder settings, choose appointment hours, payment days, and renewal days before the target date. Zero means the target date. Date-only appointments round hours up to whole days. Scheduled jobs use `TZ`, defaulting to `Asia/Kolkata`.
5. Reminder-linked flows receive `reminder_id`, `reminder_type`, `reminder_response`, `selected_option`, `reference_id`, and `reference_table`.

## Delivery and personalization

- Live chat text, media, and location sends fail clearly when no sender is available. The backend no longer fabricates delivery or customer replies. The frontend's explicitly selected demo mode still simulates conversations.
- Failed chat text sends restore the draft. An attempted Web send is not silently repeated through Cloud. Confirmed Cloud sends update chat history, contact previews, and bot handoff state.
- Explicit custom fields and nested event values override generic placeholder defaults. Zero amounts and boolean values remain valid. Formatted messages no longer get invisible random characters appended.
- Campaigns preserve authored template body parameters and honor their spintax setting.
- Distinct invoice or other identified events for one contact no longer suppress each other. Duplicate events remain suppressed. CRM fallback notifications run only when no active rule exists, preserving configured conditions and duplicate suppression.
- Failed automation/reminder dispatches are reported as failures. Payment claims are released when dispatch fails. Failed reminder records do not permanently prevent later attempts. Automations and interactive reminders check blocked and unsubscribed recipients before sending.
- CRM profile lookup tolerates missing optional columns in standalone SQLite and external MySQL schemas. Startup migrations add missing lead follow-up date and enablement fields.

## Validation and limits

Run `npm.cmd test` in `backend` and `npm.cmd run build` in `frontend`. The added workflow regression suite uses stubbed senders: it tests rule execution, event independence, flow context, configured reminder timing, failed dispatch handling, and the actual chat route handlers without messaging customers.

Real provider delivery still needs a connected WhatsApp Web session or valid Cloud API credentials. These changes were not validated by sending messages to real recipients. Date-based schedulers still depend on valid CRM dates and matching records. Both delayed first messages and follow-up messages now use the durable queue, retaining the original sender/chat. Recovery checks paused rules and opt-outs; interrupted sends are marked unknown and never automatically repeated. See PRODUCTION_READINESS.md for deployment and verification requirements.
