# Connected WhatsApp workflow updates

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

Real provider delivery still needs a connected WhatsApp Web session or valid Cloud API credentials. These changes were not validated by sending messages to real recipients. Date-based schedulers still depend on valid CRM dates and matching records. The optional second automation message remains an in-process timer and is not restart-persistent; the first delayed message uses the durable scheduler.
