# Local release verification - 25 October 2026

This records the frontend/backend code checks and deployment requirements. It does not certify the requested full production volume or every legacy CRM feature.

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
| All frontend unit/component suites | Passed: 11 suites, 26 tests |
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
