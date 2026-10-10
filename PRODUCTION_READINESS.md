# Launch status

Code verification passes are listed below. This deployment is not yet cleared for customer traffic: live provider delivery and deployment configuration still need verification.

## Implemented behavior

- Live chat and flow previews share button/list rendering with stable reply IDs. New flow menus can require native customer buttons. Cloud API supports native messages; QR/Web uses a clearly labeled numbered-text option. An unavailable native sender produces a failure instead of quietly substituting text.
- Contact sync saves WhatsApp contacts to the shared contact directory and visits all available session chats, with progress and partial-failure reporting. It no longer stops at 30 chats.
- Chat bodies and received attachment archives are browser-local by default, scoped by authenticated user. Manual attachments travel through memory rather than permanent upload files. Contacts, provider message IDs/status, configured campaign content and active workflow state remain on the server. QR authentication profiles also remain on the server. Cloud history cannot be recreated when the browser was absent; WhatsApp Web history availability depends on the paired device/provider.
- Campaign delivery/read figures use real receipts. Duplicate and out-of-order receipts do not inflate totals. Uncertain sends are marked unknown and excluded from automatic resend to avoid duplicate customer messages. Provider acceptance is distinct from delivery.
- REST and socket authentication require verified JWT signatures. Demo admin tokens, decoded-token fallback, public demo admin login and the universal test-password override have been removed. SQLite admin seeding requires an explicit password.
- Production boot requires configured stable JWT and credential-encryption secrets rather than generating temporary secrets. Example storage credentials have been replaced with placeholders.
- Automation follow-ups now use the durable database queue. Recovery keeps the original sender and chat, claims each dispatch atomically, rechecks paused rules and opt-outs, and records uncertain sends without automatically repeating them. Completed event data is cleared. The manual trigger no longer adds invented invoice/quotation amounts or reports failed sends as successful.
- Cloud configuration requests use independent provider instances; one request cannot overwrite another user's credentials. Account lists omit tokens/secrets and show only the caller's accounts. Switching defaults checks ownership and updates the caller's configuration.
- Webhooks verify the exact request bytes against the account's app secret. Unsigned production requests and payloads mixing unrelated signing accounts are rejected. Receipt and attachment socket events go to the owning user. Duplicate event claims are enforced by a dedicated table populated from legacy claim records without deleting historical rows.

## Deployment blockers

The read-only command `node backend/scripts/check-production-config.js` currently reports:

1. `SMTP_ENCRYPTION_KEY` is missing. Supply a stable 32-byte key or 64 hexadecimal characters through the deployment secret store. Preserve the original key for existing encrypted credentials, or re-enter those credentials. Production no longer tries public legacy keys.
2. `PUBLIC_BASE_URL` points at localhost. Set the reachable HTTPS backend origin and exact frontend `ALLOWED_ORIGINS`.
3. `WA_DATA_DIR` is unset. Mount persistent storage for QR profiles and the SQLite database if used; verify backup/restore on the production host.

Rotate the R2 credentials previously embedded in example files, including any keys copied into deployment settings. Editing examples does not revoke old keys. Existing seeded accounts may still have historical default passwords; change those passwords before opening access. Existing chat archives/backups are not deleted by the new default privacy policy.

## Verification

Verified on 2026-10-09: 18 backend suites passed, 11 focused frontend tests passed, production build succeeded with lint warnings, and desktop/mobile browser menu checks and automation log state checks passed. Authentication checks additionally execute the real login handlers to reject the old master-password override and public demo login.

Run backend suites with `NODE_ENV=test` and `WA_DISABLE_OUTBOUND=1`; they use transport fixtures and do not send customer messages. Run focused frontend tests with `CI=true npm test -- --watchAll=false --runInBand --testPathPattern=wa`, then `npm run build`. The build still reports inherited lint warnings.

`frontend/scripts/check-menu-ui.cjs` checks the built interface at desktop and mobile sizes using isolated API fixtures, blocks external requests and writes screenshots under `frontend/.qa/`.

Before launch, verify with an authorized test recipient: QR pairing/reconnect; Cloud native button/list delivery and reply IDs; incoming image/document viewing after refresh; contact imports; one small campaign with actual delivered/read receipts; linked automation/reminder/flow execution; session restart; and database restore. No 100% success rate or real-device delivery has been claimed.

Both the first delayed message and second automation message survive restarts through the database queue. Recovery runs at boot and every minute, so a recovered message can run later than its exact due time. A crash during a provider send becomes an unknown outcome after ten minutes and requires delivery verification before retrying. This avoids duplicate sends but does not promise exactly-once delivery across external services.

Cloud webhook processing requires a valid account app secret and a working database. `WA_WEBHOOK_ALLOW_UNSIGNED=1` is honored only outside production. Additional independent-customer tenant isolation and load testing are required before marketing the deployment as a fully isolated multi-tenant SaaS.
