# Automation workspace

The automation dashboard, creation page and edit routes use the same organization-scoped backend. The local `madhura_wa` database has received the additive automation workspace migration; deployments run it during backend startup after the base WhatsApp tables are ready.

## Configure a rule

Open `/whatsapp/automations`, create a rule or select Edit on an existing card. Editors are full pages at `/whatsapp/automations/create` and `/whatsapp/automations/:id/edit`.

Choose a connected organization Meta sender. Configure an event, conditions, main message, optional follow-up, reply buttons and linked contact group or published flow. The page lists only references returned by `/api/wa/automations/references` for the verified organization. Rule configuration and reply options save in one MySQL transaction. A revision check rejects stale edits with HTTP 409.

The dashboard links to senders, templates, workflows, groups and contacts. Each card links to its executions and related records and exposes configuration history. Execution logs distinguish scheduled, sending, sent, skipped, failed and uncertain delivery. Scheduled jobs can be cancelled while they remain unclaimed. Once a job is sending, cancellation returns a conflict; an uncertain send cannot be automatically retried.

## Runtime guarantees and boundaries

- New or edited rules require an explicit organization-owned Meta sender. Existing legacy rules need a sender selected before they can be enabled or edited through the workspace. Their historical engine remains available until reconfigured.
- Plain text, media and reply buttons require an open customer service window for the same sender and contact. Outside it, the rule needs a Meta-approved template belonging to that sender's WABA and an opted-in contact.
- Blocked, unsubscribed and opted-out contacts are refused. Employee takeover suppresses autonomous conversational actions. Manual rule tests are authorized sends and can run for a paused rule; they still enforce contact, sender, template, service-window and condition checks.
- Each incoming reply is matched against the organization, sender, contact and active rule. Reply tokens refer only to that rule's saved options. Welcome cooldowns are persisted in MySQL, including the once-only setting when the configured cooldown is zero.
- Delayed messages and follow-ups survive restarts. An atomic scheduled-job claim prevents two sweepers from sending the same execution. Paused/deleted rules, invalid stored event data and conditions that no longer match prevent dispatch. Interrupted in-flight attempts become uncertain rather than being resent.
- Meta dispatch claims use persistent organization-scoped request identifiers. This avoids duplicate submissions on replay. It cannot guarantee provider delivery: `sent` means the provider accepted the request and returned a message ID. Delivery/read webhooks remain responsible for later provider receipts.
- CRM event listeners retain the source row's organization and record identity. Unowned events are ignored. Unconfigured invoice, quote and payment fallback notices are disabled by default; `WA_LEGACY_UNCONFIGURED_NOTICES=1` explicitly restores the old tenant-1 fallback path.
- Event simulation is read-only. It evaluates supplied sample fields and shows condition outcomes. It cannot send live messages. Individual Test Send actions use a selected saved rule, real organization contact and configured Meta sender.
- Audit history records actor, operation and revision without storing the message body. Scheduled event data remains in its durable job until completion/failure/cancellation and is cleared afterwards. Configuration removal retains its audit rows; rule-linked execution logs follow their existing database foreign-key behavior.

## APIs and migrations

Routes remain under `/api/wa/automations`. Static reference, stats, welcome-settings and simulation routes precede `/:id`; welcome settings no longer resolve as an automation ID. All CRUD, options, statistics, history, bulk controls, linked references and manual sends use verified tenant membership and the automations workspace permission.

`backend/migrations/automation_workspace.js` adds `revision` and `sender_id` to rules, plus configuration audit, tenant welcome settings, durable dispatch claims, pending reply menus and welcome cooldown tables. It creates indexes for event routing and scheduled jobs. Migration reruns preserve data and copies the old global welcome configuration to tenant 1 only.

The native workflow builder is separate from event automation: event rules can start a published shared-number flow through `sharedFlowRuntime`; no n8n instance is required. These changes do not implement external CRM provider adapters or validate an external financial system on its behalf. Financial events must originate from a verified source integration.

## Verification

Run `node backend/scripts/verify-shared-core.js` for isolated backend checks. Use `INBOX_TEST_MYSQL_PORT=<isolated non-default port> node backend/scripts/verify-shared-core.js --integration` to include real MySQL and HTTP integration. Never point the integration verifier at the application database.

`test_automation_workspace_mysql.js` covers migration idempotence, transaction rollback, concurrent edit conflicts, linked-record/tenant isolation, Meta transport boundaries, service windows, approved templates, persistent uncertain-delivery claims, concurrent sweepers, cancellation, reply handling, welcome cooldowns, takeover and safe starter seeding. Meta transport is mocked; no real recipients are messaged by the test suite.

Frontend tests cover starter configuration, conditions, sample-event editing, atomic option saves, paused activation and full-page revision-aware editing. The production build also checks the updated page and component imports.
