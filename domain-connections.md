# Domain connections

Scope: connect the marketing site, workspace and API across production, local and LAN environments; audit dashboard backend calls and correct sample-data fallbacks and organization/branch refresh gaps.

## Run all three services locally

Use Node 24, the runtime declared by the frontend and backend. Install dependencies once:

```powershell
npm.cmd --prefix backend ci
npm.cmd --prefix frontend ci
npm.cmd --prefix landing_page ci
if (!(Test-Path backend/.env)) { Copy-Item backend/.env.example backend/.env }
```

Configure the local database and signing/encryption keys in `backend/.env`. Existing environment files are preserved. Then run these commands from the repository root:

```powershell
npm.cmd run check:local
npm.cmd run dev
```

The launcher opens no extra windows. It starts marketing on 3002, workspace on 3001 and API on 5001, waits for ready responses, and stops its child services on Ctrl+C or if one service exits. It supplies matching API/Socket.IO/marketing origins rather than letting production URLs from frontend environment files redirect local traffic. Database and provider credentials remain in the backend configuration.

The launcher was exercised with real frontend dev servers and a fresh isolated MySQL database on custom ports 31301/31302/31501. Both frontend pages, backend schema readiness and credentialed CORS/login preflight passed. Temporary development processes were stopped after verification.

In another terminal:

```powershell
npm.cmd run verify:local
```

To change ports, set `WA_DEV_APP_PORT`, `WA_DEV_SITE_PORT` and `WA_DEV_API_PORT` in both terminals before invoking the commands. Private LAN IPv4 addresses are admitted in the local backend CORS list. This local mode does not change the production backend's allowlist.

## Production certificate and CORS status

On 27 October 2026, the API initially presented a self-signed certificate. The user installed trusted SSL in CloudPanel, then updated the backend allowlist and restarted it. Production verification now passes all six checks: all three frontend domains serve their pages, and the API permits credentialed requests and login preflights from each frontend. API health reports `ok: true` and `sharedInboxReady: true`.

Update `ALLOWED_ORIGINS` in the running backend's environment to the exact three frontend origins listed below, then restart that backend process. The backend loads `.env` from the directory containing `server.js`; process-manager environment variables take priority over `.env`. If an old allowlist is set in PM2/CloudPanel, update it there as well. Keep other environment values intact. Rerun `npm.cmd run verify:production` after restarting.

Run `npm.cmd run verify:production` after correcting the certificate. The command checks frontend responses, API readiness, exact credentialed CORS and required login preflight headers. It never disables TLS verification, submits login credentials, or sends WhatsApp messages.

For CloudPanel, issue a trusted certificate for the API site using its SSL/TLS certificate controls. For a VPS whose Nginx configuration is managed directly, the prepared helper can be run on that VPS with your certificate-contact email:

Confirmed CloudPanel site: `api.madhuratech.in`, site user `madhuratech`, VPS IP `187.77.149.186`, root `/home/madhuratech/htdocs/api.madhuratech.in`. In that site's SSL/TLS tab, choose Actions > New Let's Encrypt Certificate, enter only `api.madhuratech.in`, then Create and Install. CloudPanel manages this site's certificate; use its controls rather than the direct-Nginx helper below.

```bash
cd /path/to/checkout/backend
bash deploy/repair-api-https.sh your-certificate-contact-email
```

The helper requires Certbot's Nginx plugin, validates Nginx before and after issuance, reloads Nginx, checks renewal and tests HTTPS health. It requests a certificate only for `api.madhuratech.in` (or an explicitly set `API_DOMAIN`). It has not been run against the VPS. VPS access is required to apply this repair; no SSH credentials or logged-in deployment session are configured in this workspace.

## Database and browser integration verification

The backend suite supports a dedicated loopback MySQL instance on a non-default port. It creates and removes its own temporary schemas; never point it at a customer database. With that instance running:

```powershell
$env:INBOX_TEST_MYSQL_PORT='13317'
npm.cmd run verify:integration
npm.cmd run verify:browser
```

Browser mode builds an isolated frontend in `scratch/integration-frontend-build` configured for the test API on 15317. It preserves the production build. The suite exercises database-backed signup, HttpOnly sessions, organizations, branches, employee privacy, inbox routing, signed webhooks, notes, tasks, billing reconciliation and browser flows. Meta and payment-provider transports are local fixtures; no live messages or payments are sent.

- [x] Centralize environment-aware app, marketing and API destinations in each independently deployed frontend.
- [x] Connect login, signup, demo and marketing handoffs without root redirect loops; preserve query parameters.
- [x] Include both application domains in backend origin examples and defaults.
- [x] Keep live campaign data separate from demo fixtures and refresh it when organization or branch changes.
- [x] Remove deployment values that override configurable frontend URLs, and document deployment settings.
- [x] Verify routing, environment resolution, CORS, marketing links and both builds.

## Deployment settings

Deploy the two frontends as separate Vercel projects. Assign `wa.madhuratech.in` to the project rooted at `landing_page`. Assign `live.wa.madhuratech.in` and, if used, `live.madhuratech.in` to the project rooted at `frontend`. Both app domains serve the same workspace; neither needs to redirect to marketing. Host `api.madhuratech.in` on the backend service.

Frontend public build variables:

```dotenv
REACT_APP_API_URL=https://api.madhuratech.in
REACT_APP_SOCKET_URL=https://api.madhuratech.in
REACT_APP_MARKETING_URL=https://wa.madhuratech.in
```

Landing-page public build variables:

```dotenv
VITE_APP_URL=https://live.wa.madhuratech.in
VITE_API_URL=https://api.madhuratech.in
```

Backend environment (merge these into the existing configuration):

```dotenv
PUBLIC_BASE_URL=https://api.madhuratech.in
ALLOWED_ORIGINS=https://live.wa.madhuratech.in,https://live.madhuratech.in,https://wa.madhuratech.in
```

Keep any other explicitly authorized frontend origins in `ALLOWED_ORIGINS` if those clients are still used. Explicit backend environment values take priority over runtime defaults, so update an existing allowlist when deploying. Strict production configuration still requires an explicit allowlist.

Public frontend variables are embedded at build time: changing them requires a new build and deployment of the latest source. Changing backend variables requires restarting that service. API credentials, database credentials and application session secrets belong only on the backend.

Local defaults use the browser hostname with ports 3001 (workspace), 3002 (marketing) and 5001 (API). Explicit custom public origins remain supported. Run all three services and allow the local marketing origin if a development allowlist is configured. The Socket.IO origin follows the API unless explicitly configured otherwise.

## Expected navigation and data behavior

- Try Now opens the configured workspace login. Demo opens `/login?tab=demo`.
- An app root opens login for signed-out visitors and the workspace for signed-in visitors.
- Protected workspace links retain their path, query and hash in `returnUrl` for sign-in.
- Login/signup Home and workspace Website open the configured marketing site.
- Marketing `/whatsapp/*` and `/portal/*` forward their full paths, queries and hashes to the app. App marketing paths, including `/docs`, hand off to the marketing site.
- API, Socket.IO and the Meta webhook use the backend origin.
- Live campaigns use server responses, empty results and retryable errors. Samples remain restricted to explicit demo sessions. Switching organization or branch resets campaign state.
- Opening saved chats does not fabricate a connected device or insert sample conversations for normal users.

## Verification commands

```powershell
npm.cmd --prefix frontend test -- --watchAll=false --runInBand
npm.cmd --prefix frontend run build
npm.cmd --prefix landing_page run build
npm.cmd --prefix landing_page run check:links
npm.cmd --prefix landing_page run check:origins
npm.cmd --prefix backend test
node backend/scripts/test-cors-policy.js
node backend/tests/test_domain_navigation_browser.js
```

The browser navigation check serves both compiled builds through intercepted requests on their production hostnames. It does not contact production services. Live database, Meta delivery and payment-provider integration require a separately configured environment and are not established by these checks.

Verified locally: 29 frontend suites / 102 tests, 20 backend core suites, 27 CORS policy checks, marketing link checks, origin checks and compiled-build browser navigation passed. Both production builds passed with existing lint/bundle-size warnings. These changes have not been deployed.

Follow-up verification: the complete backend run now passes 27/27 suites with `--integration --browser`, including the shared-workspace permission policy, a fresh MySQL database, real cookie signup/login/reload/logout, WebSocket inbox updates, persisted notes/tasks, flow preview/publishing, template controls, attachment uploads and explicit campaign starts. Provider transports use local fixtures. All four root environment tests pass. This workstation runs Node 26.1.0; the deployment target and VPS setup remain Node 24. Temporary dev servers and the isolated MySQL instance were stopped after testing.

Production SSL and CORS were corrected by the user and verified successfully with `node scripts/check-deployment.cjs --production` (six checks passed). This confirms HTTPS, backend database/schema readiness, exact credentialed origins and required login preflight headers. Live account login, message delivery and payment settlement have not been exercised against production. No backend environment or deployment changes were applied from this workspace.

## Demo and real-account follow-up

The production demo login loop was reproduced: the public backend demo endpoint returns 403, then protected workspace requests return 401 and clear the preview profile. The frontend now runs the existing workspace screens with isolated tab-local demo data in every environment, without creating a backend demo workspace. It keeps real account cookies, data, provider connections and purchases behind ordinary authentication. Conversion to a real account clears demo storage before opening signup.

See [live-auth-repair.md](live-auth-repair.md) for deployment and server-only provisioning of the requested permanent platform administrator. The updated source must be deployed before the live demo behavior or internal account changes take effect.
