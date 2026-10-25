# Local release verification - 25 October 2026

This records the frontend/backend code checks and deployment requirements. It does not certify the requested full production volume or every legacy CRM feature.

## Login/signup loop verification

The browser reproduction failed before the fix: signup briefly reached `/whatsapp`, then workspace and refresh requests returned 401 and it returned to `/login`. The launcher was rewriting the API address to a LAN IP while the frontend was opened on localhost. Local hostname normalization now keeps API/socket cookies on the same site, and the launcher preserves existing environment files. Login/signup/2FA/access-code activation confirm the cookie session before setting client authentication state.

Passed: 20 frontend suites / 53 tests, targeted authentication lint and the full 14-suite isolated backend/browser pipeline. Real browser journeys cover signup, workspace entry, reload, authenticated public-login navigation, logout and later login on localhost and 127.0.0.1. Existing inbox, WebSocket/device cache, mobile layout, templates and flow-builder tests also passed. A read-only check of the running local frontend confirmed matching API hosts and no page errors. Test accounts and payment fixtures were confined to disposable test databases; no account or charge was created in `madhura_wa` for this verification.

## MySQL connection and database-name update

The local app is connected to MySQL `madhura_wa` at `127.0.0.1:3306`. The copy from `achme_wa` verified 119 tables and 10,833 rows using row counts and table checksums before switching. Original databases, SQLite files and an ignored SQL snapshot were retained. Defaults and deployment examples now select MySQL and the new database name. Self-pings are opt-in and disabled locally and in the production example.

Fourteen safe backend suites passed, including actual startup against an initially absent disposable database, full schema creation, signup/payment fixtures and checks that missing critical fields cannot report workspace readiness. The frontend run passed 19 suites / 46 tests. A real local browser displayed five signup plans with no page errors, no catalog error, and signup enabled; no account or payment was submitted. Local health reported `ok=true`, MySQL ready and workspace ready. See [database_setup.md](database_setup.md) for OS service and VPS DNS limitations.

## Signup and first-login payment pass

Paid signup now provisions free quotas, saves the selected plan and continues to real billing through the HttpOnly browser session. Normal owner login resumes unfinished payment; free signup and an explicit free-plan continuation remain available. Successful payment clears the saved choice atomically. The in-app plan modal now routes through billing. Signup and billing share the canonical database catalog.

The actual full backend/MySQL startup pipeline passed signup, cookie login, pending-plan resumption, duplicate/invalid signup rejection, forced branch-creation rollback, provider-fixture payment, later paid login and free/skip paths. The safe integration runner passed all 12 suites. Schema version 7 corrects the MySQL billing-table/index syntax and adds `pending_plan_id`. Deploy the backend and verify readiness before deploying the dependent frontend. No live registration, order or charge was made.

The final frontend run passed 19 suites / 45 tests; the production build passed using your API domain. Targeted lint for signup, login, login routing, the plan modal and billing passed without warnings. Existing warnings elsewhere in the frontend remain.

## Razorpay billing pass

Real Checkout, capture/amount/currency verification, atomic settlement, idempotent webhooks, status recovery, scoped order history, server-derived billing permissions and renewal controls are implemented. A read-only authentication check for the supplied credentials returned HTTP 200; no live order or charge was created. Keys are in the ignored backend environment only. Rotate the secret shared in chat before production use.

Verification passed: 16 frontend suites / 38 tests, targeted billing lint, production frontend build and 12 safe backend integration suites. Payment tests use disposable MySQL and local provider transport, covering eight concurrent confirmations, forced transaction rollback/retry, wrong tenant/plan, invalid proof, pending/underpaid/refunded payment rejection, manual recovery, renewal and free-plan credits. Live deployment and Dashboard webhook delivery are outstanding. See [razorpay_setup.md](razorpay_setup.md) for configuration and the supported billing scope; recurring mandates, refunds and legacy customer-payment-link controls are separate.

## Domain and blank-screen update

The deployed signed-in CRM was receiving HTML from its own static host for API requests, then crashing on list rendering. The source now selects `https://api.madhuratech.in`, rejects HTML API responses, validates chat lists and keeps an error visible during an API outage. Public domain settings are included for both Vercel projects and the VPS. The root rendering boundary provides a reload action for unexpected crashes.

Current verification: 14 frontend suites / 31 tests passed; 7 safe backend suites passed; frontend and landing production builds passed; landing internal-link validation passed. Six browser scenarios exercise HTML-200 responses, malformed JSON and an offline API in demo and cached signed-in sessions, including hard reload. They passed against the final production build and asserted that non-demo API requests use `https://api.madhuratech.in`. These fixtures make no production API requests. Targeted lint for the new response validation, domain resolver, session interceptor, error boundary and shared inbox passed without warnings.

The VPS is not connected yet, and these source changes have not been deployed. Follow [live_domains.md](live_domains.md) for the two Vercel redeployments and later VPS/DNS/TLS setup. The integration results below belong to the earlier full pipeline; this domain pass reran core backend checks and the disconnected-API browser checks.

## Changes completed in the final pass

- The flow canvas reuses its supported palette, step metadata, validation index and graph edges across unrelated viewport updates. Editing and dragging still invalidate the graph when needed.
- A rejected, unavailable or queued-out manual bot start no longer cancels an existing conversation bot before the new request is validated.
- Idle cleanup ends expired runs, releases transient answers, returns the conversation to human mode using a version guard and sends a permission-scoped UI update. Accepted customer input refreshes the idle deadline before provider work starts.
- Explicit bot initiation resolves the selected published flow directly by organization and ID instead of depending on the first 100 automatic-trigger definitions.
- Recovery branches preserve the trusted contact snapshot instead of promoting customer-supplied state into that snapshot.
- `backend/npm test` now runs an explicit core allowlist without loading `backend/.env`. Database defaults point to an unused test configuration; integration checks require an explicit isolated loopback MySQL port and refuse the default port 3306.

## Verification

| Check | Result |
|---|---|
| All frontend unit/component suites | Passed: 14 suites, 31 tests |
| Backend core verification | Passed: 7 suites |
| Isolated MySQL and real-browser pipeline | Passed: 10 suites, including the 7 core suites |
| Production frontend build without test-origin overrides | Passed; existing legacy lint warnings remain |

The integration pipeline covers cookie sessions, permissions, assignment, shared notes, signed inbound text and interactive events, published bot execution, draft isolation, version changes, template lifecycle, scoped storage transport and the actual built frontend. Meta and object-storage provider requests use local transport fixtures. The browser checks include `/whatsapp/flows`, direct `/whatsapp/flows/create`, starter selection, schedule controls, draft saving, preview, publication, template sync and organization switching.

## Repeatable commands

From the repository root:

```powershell
npm.cmd --prefix backend test
$env:CI='true'
npm.cmd --prefix frontend test -- --watchAll=false --runInBand
```

For database integration, provision a disposable local MySQL instance, then explicitly select its non-default port:

```powershell
$env:INBOX_TEST_MYSQL_PORT='13307'
npm.cmd --prefix backend run verify:integration
```

`verify:browser` additionally requires a frontend build targeting the isolated backend at `http://127.0.0.1:15317`, with the socket origin set to the same address. The test serves that build on port 15318. Afterward, remove the temporary frontend API/socket overrides and rebuild with the intended deployment configuration. The real-browser mode does not intercept frontend API responses; only external provider transport is a fixture.

The old full backend runner remains available as `test:legacy`; it loads development configuration and is not included in these safe default checks. Use separate disposable configuration before investigating legacy suites.

## Deployment requirements still outstanding

- Repeat release checks under the declared Node 24 runtime. This workspace runs Node 26.1.0.
- Configure real app/API domains, TLS, cookie/CORS origins and WhatsApp credentials. Verify approval and delivery with the actual Meta account.
- Configure and verify live private/public R2 buckets. Passing an SDK transport fixture does not verify Cloudflare credentials or bucket delivery.
- Verify Linux service/timer/proxy configuration and perform an encrypted backup **restore** drill. These were not executed on the destination VPS.
- Run staged load/failure testing against the intended host. The full 50-125 million messages/day estimate remains unsuitable for a single 4 GB RAM / 100 GB SSD VPS. Current settings protect a measured single-process pilot; see [capacity_report.md](capacity_report.md).

No production deployment, live customer send, bank-system integration or regulatory certification was performed. The selected privacy model still stores shared CRM records and necessary metadata in MySQL while keeping chat bodies in bounded device caches and bot answers in bounded transient process memory.

See [plan_live.md](plan_live.md) and [enterprise_flows.md](enterprise_flows.md) for operating instructions and supported workflows.
