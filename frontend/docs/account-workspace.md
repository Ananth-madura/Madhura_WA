# Account workspace direction and verification

Reading this as: WhatsApp sender management for organization administrators, using the existing corporate navy workbench, ENERGY 2 / RHYTHM 2 / MOTION 1.

The source of design direction is `frontend/design.md`. The antislop plugin is applied during implementation, using its UI, accessibility and mobile rules. No visual assets are generated or installed.

## Design decisions

- Color: existing navy establishes work-surface hierarchy; yellow marks the selected section. Connection status always includes text.
- Layout: a dense sender list supports comparing real connections; an inline details area holds branch routing and credentials without obscuring the list.
- Typography: existing Poppins headings and Inter body text preserve the application's identity; monospace is limited to provider IDs.
- Spacing: separate connection setup, routing and activity with section dividers; mobile stacks these tasks in source order.
- Controls: text actions name the operation. No decorative icons, gradients, glows, illustrations or invented quality metrics.
- Motion: existing hover and focus feedback only; loading states include text and respect reduced motion.
- States: empty, loading and retryable errors are explicit. Provider values that have not been returned remain unknown.

## Delivered behavior

`/whatsapp/accounts` is the canonical full page. `/account` and `/whatsapp/account` redirect there. Connection forms and sender details stay inline. The old global settings, mock onboarding assets and browser-session panels have been replaced by organization-scoped Meta sender management and the native inbox assistant.

The workspace includes sender search and status filters, actual connection counts, branch assignments and defaults, verified provider status, credential replacement, webhook verification details, app subscription, pending-number registration, change history and explicit disconnect confirmation. Navigation links open the existing inbox, templates, automations and workflow builder. The assistant uses `/api/v2/inbox/assistant/settings`; provider keys never return to the browser.

Meta signup waits for both an authorization code and a trusted Facebook asset event. Sessions expire after 15 minutes, belong to the authenticated actor and organization, and can be consumed only once. Failed exchanges never produce fallback tokens or phone IDs. Signup is unavailable until the server's app ID, app secret and embedded configuration ID are configured; token connection remains available.

## Backend and database

`backend/migrations/sender_workspace.js` adds sender revisions, verification timestamps, sanitized health errors, subscription timestamps, indexed audit history and routing/session indexes. It upgrades legacy plaintext WABA tokens and app secrets using the application's encryption helper. Existing sender and conversation IDs are retained. The migration ran against the configured local MySQL database and is included in server startup. Schema readiness now checks the sender workspace tables and columns.

All sender routes require authenticated organization context and sender permissions. Manage-only webhook settings expose the verification token intentionally; list/detail responses expose credential-presence flags without access tokens or app secrets. Mutations use a dedicated transaction connection, serialize on the organization row, validate active branch ownership, enforce sender allowance and record the actor. Replacing another sender's branch default also increments that sender's revision. Stale editor revisions return a conflict. Branch-page assignment APIs use the same transaction service.

Health checks decrypt stored credentials before contacting Meta. Provider failures return a sanitized error and never claim a successful check. Stale failed checks cannot overwrite a newer sender revision. Number registration validates a six-digit PIN, passes it to Meta and does not store it. App subscription requires an explicit successful provider response. Disconnect retains history, removes routing, clears sender secrets, pauses linked automations and skips scheduled payloads; credentials used by connected sibling senders remain available.

### Sender API

All paths below are under `/api/v2/meta`.

| Method | Path | Operation |
| --- | --- | --- |
| GET | `/setup` | Public configuration and signup availability |
| GET | `/senders` | Organization sender inventory |
| POST | `/senders/manual` | Verify Meta assets and connect using a token |
| POST | `/onboarding/sessions` | Create an actor-bound signup session |
| POST | `/onboarding/complete` | Consume a session and exchange the Meta code |
| GET | `/senders/:id` | Sender details and revision |
| PATCH | `/senders/:id/branch-assignments` | Atomic routing update |
| POST | `/senders/:id/credentials` | Verify and replace credentials |
| POST | `/senders/:id/sync` | Check provider status |
| POST | `/senders/:id/register` | Register a pending number using its PIN |
| GET / POST | `/senders/:id/webhook` | Read setup / subscribe the app |
| GET | `/senders/:id/activity` | Recent scoped change history |
| DELETE | `/senders/:id` | Disconnect and pause scheduled work |

## Verification, 29 October 2026

- Backend: `node scripts/verify-shared-core.js --integration` with isolated MySQL and `INBOX_TEST_ACCOUNTS_BROWSER=1`: **34/34 suites passed**. The account browser helper used a separate frontend build pointed at the test backend, real cookie login, actual APIs and the isolated MySQL schema. It checked the `/account` redirect, connection verification, revisioned routing, clipboard feedback, assistant persistence, organization switching, responsive app shell and access to disconnect confirmation at 390/768/1440 pixels.
- Sender database suite: **15 checks passed**, including migration repeatability and legacy credential encryption, asset ownership, foreign/inactive branch rejection, concurrent stale updates, default assignment, injected SQL rollback, provider failures, explicit subscription, PIN registration, single-use OAuth state, plan limits and disconnecting queued work.
- Frontend account suite: **13 tests passed** for scoped requests, provider errors, routing revision, inline confirmation, read-only access, entered credentials, assistant persistence, retries, trusted signup events, event ordering and cancellation.
- `node tests/test_accounts_browser.js`: Chromium exercised keyboard focus, status success/error, routing, subscription, credential updates, disconnect cancellation, assistant save, search and the inline connection form. Light and dark renders at **390/768/1440** had no horizontal page overflow or page errors. Screenshots were inspected.
- Production frontend build passed. Existing repository lint warnings remain; the new account components, signup helper and their tests pass targeted ESLint without warnings.
- `node scripts/check-deployment.cjs --local`: app on 3001, marketing site on 3002, API health and credentialed CORS all passed.
- The full frontend test run passed **34/35 suites, 131/133 tests**. The two failures are in the unchanged `EmployeeWorkspace.test.jsx`, whose router mock does not provide `useNavigate`. This is separate from the passing account suites; no unrelated workspace production code or tests were changed.

Meta HTTP responses in automated verification came from local fixtures. Live Meta signup, number registration, subscription and message delivery were not performed. Production operation requires valid Meta asset access, server signup configuration where used, a publicly reachable callback and the correct app secret. The UI reports missing configuration and provider failures directly.

## Antislop delivery gate

| Gate item | Result and evidence |
| --- | --- |
| Hard gate: R-02, R-03 | PASS: new interface copy contains no em dashes; inspected light/dark renders and actual app-shell layouts at 390/768/1440, with no horizontal page overflow. |
| Hard gate: R-17, R-18, R-23 | PASS: counters derive from API records; provider values stay unknown until verified; no testimonials, invented assets, new logos or fabricated production metrics. Fixture records are confined to tests. |
| Hard gate: R-24, R-26 | PASS: navigation targets are existing application routes; forms and actions call real scoped APIs. Browser and component tests exercise their success, validation, cancellation and failure paths. Live Meta authorization remains an explicit external prerequisite. |
| Hard gate: R-25 | PASS: measured helper text contrast is 5.48:1 or greater in light mode and 7.27:1 or greater on dark/selected surfaces. Error text exceeds 7.34:1; input borders exceed 3.62:1 on both surfaces. |
| Hard gate: R-27, R-28 | PASS: explicit initial loading, unavailable-count, failed-load, empty-inventory, filtered-empty, missing-selection and provider-error states. No filler FAQ. |
| Hard gate: R-32 | PASS: native links, buttons, labels and fieldsets; visible three-pixel keyboard focus; no modal focus trap. Chromium Tab reached Refresh with a visible outline. The page uses a section inside the app's main landmark. |
| Hard gate: R-33, R-35 | PASS: source/UI edits used direct patches. Production build, 13 account tests, 15 sender database checks, 34 backend suites and browser interaction checks ran. |
| Hard gate: R-37 to R-40 | PASS: existing design direction was read and declared before implementation; existing fonts and brand colors retained; no decorative assets or hero media; Meta SDK loads asynchronously only when signup is requested. No unmeasured performance claims. |
| Purpose: R-01, R-04, R-07, R-08, R-10, R-12, R-13, R-19, R-22 | PASS: no gradients, glows, decorative icon set, background patterns, decorative arrows, glass panels, elevation effects, template animation or illustrations. |
| Purpose: R-06, R-09, R-14, R-31 | PASS: Poppins/Inter continue the existing brand. Monospace distinguishes phone numbers. Text status labels convey actual state. Repeated sender rows support comparison; inline sections separate operational tasks. Reasons are recorded above. |
| Liveliness | PASS: ENERGY 2 / RHYTHM 2 / MOTION 1 declared before implementation; selected sender and section form the focal point; dividers organize tasks; restrained yellow selection and repeated number typography preserve identity. |
| Craft: C-1 to C-5 | PASS: decisions follow the existing workbench design and real administrative tasks; controls have API behavior and visible feedback; responsive, keyboard and error states were exercised; provider data is never invented. |
| Consistency: R-05, R-11, R-15, R-16, R-20, R-21, R-29, R-30 | PASS: operational list/detail composition, small varied corner radii, named actions, plain copy, WhatsApp-specific identifiers and routing, light default with dark-theme support, existing navy/yellow palette, and existing application identity. No marketing template or competitor visual clone. |
