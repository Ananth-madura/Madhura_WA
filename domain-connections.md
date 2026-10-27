# Domain connections

Scope: connect the marketing site, workspace and API across production, local and LAN environments; audit dashboard backend calls and correct sample-data fallbacks and organization/branch refresh gaps.

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
