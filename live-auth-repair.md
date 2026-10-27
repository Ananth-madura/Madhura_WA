# Live authentication and demo mode

- Reproduced live: public demo login receives 403, falls back to an unauthenticated profile, then workspace requests receive 401 and return to login.
- User confirmed: reuse the existing workspace screens in demo mode. No separate demo page or replacement application.
- Keep demo changes isolated from production account data and payment/message providers. Real signup, subscriptions and usage must continue through the existing backend.
- Confirmed permanent operator email: madhuratechcbe@gmail.com. Provision through server-controlled configuration with a password hash; never embed a password or a public administrator bypass in the frontend. Actual server provisioning requires deploying the implementation and operator access.

## Work

- [x] Restore stable in-app demo sessions and sample workspace context, locally and in production builds.
- [x] Isolate demo API actions from real data; keep the existing screens, navigation and account conversion path.
- [x] Verify login, signup and paid-plan continuation with a real backend, isolated MySQL, and browser tests. Payment and Meta transports are fixtures; no production transactions were made.
- [x] Implement idempotent operator provisioning and an internally managed plan for the permanent platform admin.
- [x] Build and test the application; record deployment requirements below.

## Behavior

The demo opens the existing `/whatsapp` routes. It uses sample conversations and browser-tab data instead of creating a backend account or organization. Contact, template, campaign and other supported sample edits remain in the tab through reloads. The visible demo banner stays present. Provider connections and purchases require leaving demo and signing in or creating a real account. Demo mode never grants backend privileges.

The Create real workspace button clears the demo session and loads `/signup`. A full navigation prevents the protected-route redirect from racing the lazy signup screen. Real customers continue through server-side registration, cookie sessions, actual organization data, usage accounting and verified checkout.

## Deployment required

These changes have not been deployed from this workspace. No authenticated Vercel session or VPS SSH credentials are configured here.

1. Deploy the updated `frontend` source to the application Vercel project serving `live.wa.madhuratech.in` (and `live.madhuratech.in` if retained). Keep `wa.madhuratech.in` on the landing project.
2. Deploy the updated `backend` source to the existing API service on the Hostinger VPS. Preserve its real `.env`, database and persistent data. Use its existing service manager; do not start a duplicate process or change CloudPanel SSL.
3. To provision the requested internal account, set `PLATFORM_ADMIN_EMAIL=madhuratechcbe@gmail.com` and `PLATFORM_ADMIN_PASSWORD` in the **server environment only**, using a password of at least 12 characters. Restart the updated backend. Successful provisioning logs `Platform administrator and internal workspace are ready` without credentials. Never put the password into Vercel frontend variables or source files.
4. After provisioning, remove `PLATFORM_ADMIN_PASSWORD`, keep `PLATFORM_ADMIN_EMAIL`, and restart. Existing password hashes survive subsequent restarts. The account receives its own internal enterprise organization with no subscription purchase or expiry; real WhatsApp/AI providers still require valid provider configuration.
5. Run `npm run verify:production`, then verify demo entry/reload, Create real workspace, normal login and the internal account on the deployed application. Production account provisioning and live provider settlement remain unverified until deployment.

The backend change is inactive when both platform-admin variables are absent. Internal provisioning is transactional and repeatable. Ordinary signup and employee management cannot grant the platform administrator role.

## Verification

- Frontend: 30 suites / 110 tests passed; production build passed. Targeted lint has zero errors and nine existing warnings.
- Backend: 28/28 suites passed with `verify:browser`, including real MySQL, actual HTTP/cookie login/signup, paid onboarding with a payment transport fixture, and internal administrator provisioning.
- Compiled demo: 15 existing routes survive reloads, sample contact creation persists in the tab, protected backend requests are absent, conversion opens real signup, and the staff demo opens its assigned inbox.
- The isolated test database was stopped after verification. No customer database, live payments or live messages were used.
