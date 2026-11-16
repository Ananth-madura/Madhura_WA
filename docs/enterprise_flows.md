# Shared chat, bot builder and templates

The shared-number inbox now executes published bot flows through the connected Meta Cloud API sender. Administrators manage definitions and Meta template synchronization within their organization. Employees can start a published bot only inside a conversation they may access. This improves the implemented core workflow; it is not certification of every legacy module or the full production traffic target.

## Start here

1. Use the shared MySQL deployment described in [plan_live.md](plan_live.md). Shared-number execution and transactional flow editing require MySQL. Keep one backend process; the runtime does not support multiple replicas yet.
2. Connect the organization's number, link its branches and configure employee assignment. Receive a customer message so a shared conversation and customer service window exist.
3. Open **Flows > Load 10 bot starters**. Installation creates organization-owned drafts and preserves existing flows. Loading twice does not duplicate the starters. Startup no longer activates automations or rewrites flow triggers.
4. Open a starter, edit its questions and messages, use **Preview**, then **Publish**. Only active, published definitions receive customer messages. Draft edits do not alter the published bot. Existing sessions keep their starting definition; new sessions use the current publication.
5. In an assigned shared chat, choose **Published bot > Start bot**. Keyword bots also start automatically when a customer sends the exact configured keyword and the conversation has not been handed to a person. Organization-wide triggers use the connected number that received the message.
6. Use **Take over from bot** or send a manual reply to stop automatic progression. Customer `human`, `agent`, `cancel bot`, and opt-out commands also stop automation. Handoff is sticky: the next message does not silently start another bot. An employee can explicitly start a published bot again.

## Ten editable starters

| Starter | Default keyword | Result |
|---|---|---|
| Welcome and routing | `menu` | Native reply buttons for sales, support or a person |
| Sales qualification | `sales` | Collect product/service and budget; show summary and hand off |
| Appointment request | `book` | Collect service and a valid ISO date; request human review |
| Support intake | `support` | Collect problem and product/order reference |
| Quote request | `quote` | Collect scope and quantity |
| Order enquiry | `order` | Collect order reference and enquiry |
| Customer feedback | `feedback` | Validate a rating from 1 to 5 and collect feedback |
| Callback request | `callback` | Collect preferred callback time and reason |
| New customer onboarding | `join` | Collect service and email; explicitly save the validated email to the shared contact |
| Return or cancellation request | `return` | Collect reference and reason; request human review |

These are intake workflows. They do not claim to book an appointment, issue a refund, change an order, calculate a live price or create a transaction in an external system. The summary is delivered to the customer and connected, permitted employees. Under device-only history, an employee who missed that text cannot fetch it later from arbitrary Meta history endpoints.

## Builder and runtime contract

Supported steps are entry/trigger, text, native reply buttons, lists, interactive menus, validated input, conditions, variable assignment, approved text template delivery, secure HTTPS link buttons, business-hours routing, a scoped contact snapshot, handoff and end. Both preview and live execution use the same graph interpreter and builder field mappings. Preview makes no provider calls or CRM writes; its template message is explicitly marked as a delivery placeholder.

Input steps can explicitly save **contact name** or **contact email**. The default keeps answers in transient bot state and device chat. Saving a contact field updates only that conversation's organization-owned contact; it does not store a transcript. Internal notes continue to use the existing shared notes API.

Publication checks graph references, unique keys, reachable steps, menu sizes and destinations, required content, supported conditions and template approval. Transactions make node replacement, publication and rollback atomic. Concurrent publishers serialize on the parent flow row. A restored version becomes a draft and requires publication before it runs. Archiving stops further progression when the active run next processes or sends a step.

The shared-number palette omits legacy external webhooks, arbitrary CRM lookups/actions, media delivery, delays, flow jumps and legacy AI nodes. Importing or publishing these nodes returns an explicit validation error. They are not simulated as if their external side effects succeeded. The separately configured shared AI assistant remains available; a flow consumes the message before that assistant is considered. Legacy Web/QR-session bot execution is outside this shared-number implementation and has not been certified here.

Limits for the single-process pilot:

- 100 nodes and 256 KiB per definition; at most 40 automatic steps in one turn.
- At most 256 active transient bot sessions; 16 KiB of collected variables per session; input truncated to 2,000 characters.
- Four concurrent execution workers; at most 64 pending tasks, including waiting conversation work. Capacity exhaustion returns a retryable failure instead of allocating an unlimited queue.
- Fifteen-second definition cache, single-flight reads, at most 64 organization entries and 16 MiB of cached definitions. Publications/status changes invalidate the local cache. Existing runs check current activation and conversation permissions again.
- Four-hour idle expiry. By default, three invalid answers hand off to a person; input steps can configure one to five attempts and an explicit recovery destination. Process restart marks interrupted shared runs timed out and returns conversations to human mode; transient answers are not reconstructed.
- Every outbound attempt has a durable body-free idempotency claim. A provider timeout or uncertain result records `unknown`, fails the run and stops automation. It does not automatically retry or fail over. Check the provider before intentionally starting another send.
- `/api/ops/metrics` reports bot sessions, pending work and cache bytes. The operations check warns near session/queue limits.

The resource ceilings are protective limits, not proven supported customer counts. See [capacity_report.md](capacity_report.md); the full requested 50-125 million messages/day remains unsuitable for one 4 GB / 100 GB host.

## Template lifecycle

Local templates and starters are **DRAFT**, with no invented provider approval. Historical rows marked approved without a provider template ID are corrected to draft. Editing a synchronized row creates a local draft state and removes its provider approval linkage; synchronize to retrieve the provider's current definition again. Deleting locally does not delete the template from Meta.

In **Message templates**, select the connected number and choose **Sync Meta templates**. The backend resolves that organization's credentials and fetches a complete bounded listing from its WhatsApp Business Account. Imports store Meta's identifier, language, category, components represented by the local editor and actual status. Templates absent from a complete listing become unavailable. Failed or truncated fetches do not partially replace approval state. Multiple pages use cursors against a fixed Graph API endpoint; provider-supplied next URLs are not followed.

For text drafts, expand **Submit a text draft for approval**, choose the number and provide one example per numbered body variable, such as `{{1}}`. Submission records the provider-confirmed identifier/status. Synchronize later to see approval, rejection, pause or disappearance. Automatic template-status webhook subscriptions are not implemented in this change. Create media, button and authentication templates in WhatsApp Manager, then synchronize them; the local submission form explicitly restricts those formats.

A bot template step selects a synchronized approved template and ordered body parameters. Before sending, the runtime rechecks that approval belongs to the conversation sender's business account and that required body parameters are present. The supported bot sender handles body parameters and static text headers; media/variable headers require a separate advanced sender workflow. Campaign template lookups and references were also scoped to the organization and require a provider-confirmed approval; the complete legacy campaign delivery system is not certified by the shared-flow tests.

The basic provider contract follows Meta's [Business Management API collection](https://www.postman.com/meta/whatsapp-business-platform/collection/3kru5r6/-moved-whatsapp-business-management-api) and [template message reference](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/messages/template/). Actual approval, permission grants, account-specific limits and live delivery must be checked with the connected business account.

## Storage and privacy

MySQL stores definitions, published versions, run identifiers/status/current step, shared contact fields, notes and delivery identifiers. Shared run `vars`, event payloads and outbound message bodies are null. Shared run metadata expires under the existing audit retention period in bounded cleanup batches; definitions and version history remain administrative records to monitor and retain deliberately.

Customer answers exist briefly in the bounded process memory while a bot runs. Connected browsers receive messages through the existing permission-scoped socket path and retain their own bounded device cache. This is not a durable cross-device transcript. Offline/crash recovery remains intentionally limited by the no-server-chat-archive policy.

Flow/template pages remount on organization changes; late responses cannot populate the next organization's editor. Management APIs verify organization membership and administrator role. Reads, writes, versions, analytics, simulation and seeding verify ownership; employee execution checks assigned-conversation access.

## Verification and remaining release checks

Executed locally:

- All 10 starter graphs traverse through valid inputs/menu choices to handoff. Invalid graphs, unsupported steps, invalid inputs, branching, variables and loop limits are exercised.
- Full backend with isolated MySQL: scoped/idempotent seeding, employee initiation, signed inbound text and interactive webhooks, duplicate suppression, human takeover, draft isolation, concurrent publications, rollback and body-free run records.
- Real provider client methods against a loopback Meta HTTP transport fixture: submission/pending status, synchronized approval, native menu delivery, template parameters, foreign-account rejection and uncertain-delivery failure without automatic resend.
- Actual built frontend against that backend: administrator cookie login, builder load/preview/input/handoff/publish, template status/controls, synchronization, organization-switch isolation and mobile template overflow checks. The existing employee inbox/note/socket/cache browser scenario also passes.
- Frontend compilation, targeted lint, browser session/workspace/cache regressions and shared-inbox MySQL tests.

Repeat checks with the declared Node 24 runtime before release; this machine runs Node 26. Live Meta/R2 credentials, production approval/delivery, Linux recovery, distributed execution and full-scale load are unverified. No live deployment or live messages to customers were performed.

One older regression test unexpectedly loaded the local development SQLite adapter while resolving a transitive dependency. Its migrations ran against the local SQLite files; those files were left intact. The test now blocks unmocked database access. New flow integration checks create and drop isolated MySQL databases.

```powershell
node backend/tests/test_shared_flow_definition.js
# Use only an isolated MySQL instance:
$env:INBOX_TEST_MYSQL_PORT='13307'
node backend/tests/test_shared_inbox_boot.js
# Build frontend against 127.0.0.1:15317 before enabling the real-browser variant:
$env:INBOX_TEST_REAL_BROWSER='1'
node backend/tests/test_shared_inbox_boot.js
```

Remove test-origin build overrides and rebuild with deployment settings before publishing.

## Create-page customization update

The create route opens its step library immediately. A starter selector offers the original ten bots plus **Account service routing**, **Dispute enquiry intake**, and **Branch hours and callback routing**. Choosing one replaces only the current unsaved graph after confirmation. It is saved and published through the same organization-scoped API as other flows. The account-service starter requires the administrator to supply their actual secure portal URL before publication.

Conditions support up to ten rules combined with AND/OR, equality, inequality, text matching, numeric comparisons, presence/absence and comma-separated membership. Input controls support phone, reference, yes/no and allowed-answer validation, character limits, numeric ranges, whole numbers, custom retry messages and recovery branches. Arbitrary executable expressions or user-supplied regex are not introduced.

Business-hours steps support IANA timezones, selectable weekdays and overnight shifts with separate Open/Closed connections. Contact snapshot steps load only the current conversation's shared name, email and phone, plus a presence flag. They do not query bank accounts or balances. Secure link steps enforce a fixed HTTPS domain, reject embedded credentials and encode dynamic URL values.

Loading organization context now shows a retryable status rather than an empty render; demo mode can open the builder while that context is pending. Flow routes have an error boundary for failed application chunks or render errors. These are recovery mechanisms, not a replacement for correct API/domain configuration.

These features support customer-service intake and routing. Bank-system connectivity, authentication/verification, transaction execution, maker-checker authorization and regulatory certification have not been implemented or claimed. Use an authenticated external portal for sensitive operations.
