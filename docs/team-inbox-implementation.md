# Internal Team Inbox implementation record

## Design contract

Audience: employees communicating inside one organization. The primary action is finding a permitted teammate and sending a message. Use the existing workspace navy, neutral surfaces, system typography and compact rows. The active conversation is the focal point; details open on demand. Icons reuse the application's existing set for recognizable messaging actions. ENERGY 1 / RHYTHM 2 / MOTION 1. No decorative gradients or invented activity.

Desktop uses a conversation list and timeline, with an optional details pane. Tablet details overlay the timeline. Mobile switches between list and chat with back navigation. Empty, loading, pending, failed, disconnected and revoked-access states must remain explicit. Keyboard users need visible focus and modal focus containment.

## Inspected architecture

React 19, React Router 7, CRA, Tailwind, shared Axios client, AuthContext and EnterpriseContext. Express 5, existing session/JWT middleware and tenant middleware, mysql2 with an existing SQLite fallback. Socket.IO authenticates connections using the existing session. Existing organization_memberships and staff_branch_memberships supply identity and branch authorization. The starting worktree already contained an internal team-chat migration, service, routes, React workspace and IndexedDB cache. These were extended without replacing authentication or touching customer WhatsApp message tables.

## Behavior and security policy

- Explicit branch pairs govern cross-branch discovery, direct chats, shared groups and file sharing. A legacy blanket cross-branch setting does not authorize a pair.
- Configuration rights do not grant access to private groups. Groups require current membership. Every pair of proposed members must be allowed to communicate.
- Legacy company-wide chats are administrator-only; ordinary employees use branch chats or explicitly authorized groups. This prevents bypassing default branch isolation.
- Revoked conversations disappear from server lists and search. Sends and reads recheck current memberships; recipient lists are reauthorized. Policy changes, employee updates/deletion, and branch membership changes notify open clients to revalidate. A 30-second refresh also detects changes made outside these application routes. An incompatible branch pair suspends access to an existing shared group; it does not silently split the conversation into partial audiences.
- Cached history is only displayed after a successful authorized bootstrap in the current page session. A new offline page load fails closed. An already open authorized session can retain its visible history offline until it reconnects. Remote revocation cannot erase bytes from a disconnected browser immediately.
- Local history older than the server window can differ by device. Server retention does not instruct IndexedDB to delete authorized history. Explicit device clearing does.
- Attachments use a private directory outside public uploads, download through the authenticated Axios client, carry no-store/nosniff headers and require conversation authorization. Uploaded files are owned by the uploader until linked. Legacy internal attachment files are moved out of public media storage by the migration. Deleting a message removes its files, reactions and pins. Private group photos are conversation metadata, persist with the group, and have separate authenticated image routes and image-signature validation.
- IndexedDB version 3 encrypts message payloads, drafts, outbox entries and conversation previews with a non-extractable AES-GCM key scoped to the organization/user database on that browser profile. This is device storage encryption, not end-to-end encryption or protection against an attacker executing code in the application's origin. Browsers without working IndexedDB/Web Crypto fall back to scoped memory and show a persistence warning.
- Organization device-history policies are separate from server retention: 0 keeps authorized history until explicitly cleared, or administrators can configure 1–3650 days. The logout policy can clear each organization's device cache. Identity changes in another tab reset and reload the workspace. Never put authentication tokens in the chat database.
- Pending sends retain their operation ID and retry with bounded backoff. Operations older than the server recovery window require explicit recomposition, preventing uncertain old sends from silently recreating expired messages. Sender IDs are part of client-operation cache keys. Canonical state versions reject older edit/reaction/delete updates.
- Mentions are validated against current conversation participants. Notification preferences persist per organization/user. Desktop permission is requested only when the user enables desktop notifications; desktop notification text omits message contents. Presence is derived from authenticated sockets and filtered through permitted employee discovery. Read indicators reflect backend read records; server acceptance is shown separately.

## Retention and deployment

The server window begins at local midnight six dates before today in the organization's IANA timezone, covering today plus six preceding dates. SQL timestamps are treated as UTC. Configure the database connection/session timezone as UTC. Cleanup runs at startup and every minute, without overlapping runs. Reads filter the window independently. Cleanup removes message rows, related files/reactions/pins/change-cursor rows/read pointers and expired reply references. An hourly pass removes abandoned internal upload files older than seven days. Security audit records have an independent 90-day retention window. Failures are logged without message bodies and exposed through the administrator-only `/api/v2/team-chat/retention` health endpoint. A failing organization does not prevent other organizations' cleanup.

Set TEAM_CHAT_STORAGE_DIR to persistent private storage, or use WA_DATA_DIR/private-team-chat. Never configure this directory underneath a public static upload directory. Apply existing filesystem/disk encryption and TLS at deployment. Run the additive team_chat migration before marking the route ready. Rollback application code without dropping chat tables; do not restore expired content from backups into active storage.

Backups are a separate retention surface. The inspected `backend/scripts/backup-mysql.js` encrypts snapshots with restic and enforces 7 daily, 4 weekly and 3 monthly snapshots. Its `--maintenance` mode prunes unreferenced repository data. These backups can therefore retain internal messages beyond seven active-storage days. Verify backup and maintenance scheduling, object-version expiration and restore procedures on the deployment. Active database cleanup cannot erase historical backup artifacts. Never describe this implementation as guaranteeing seven-day backup erasure. Run retention cleanup before exposing a restored database.

MySQL mutations use the existing pool with a transaction-bound query context. SQLite is the existing fallback used by the automated integration fixtures; it does not provide the same multi-query transaction guarantee in this service. Multi-instance deployment additionally requires a shared Socket.IO adapter and shared private storage; the local verification uses a single instance. No new runtime dependency was added.

## Implementation inventory

| Area | State at inspection | Changes in this implementation |
| --- | --- | --- |
| Identity and organization model | Existing session/JWT middleware, organization memberships, branch memberships, teams and roles | Reused throughout; no replacement identity framework |
| Chat tables, API and workspace | Already present in the starting working tree | Audited and extended; customer WhatsApp tables remain separate |
| Authorization | Existing checks had private-group admin bypasses and stale direct access | Current membership graph, every-pair group checks, scoped discovery/search/files/events, branch revocation hooks |
| Migration | Existing additive team-chat schema | State versions, change cursors and indexes, upload ownership, preferences, policy constraints/version, mentions, device policies, notification settings and avatar MIME metadata; migration errors now surface |
| Messaging | Existing direct/group sends, edit/delete/reply/reaction/pin APIs | Idempotent recipient events, durable mutation recovery, expired-operation conflicts, private files, read events, authorized presence and validated mentions |
| Device storage | Existing IndexedDB code and memory fallback | AES-GCM payload encryption, fixed organization/user binding, safe canonical reconciliation, permission pruning, drafts, outbox backoff, local policy and logout cleanup |
| Workspace | Existing messaging UI | Product-themed responsive layout, mobile Back fix, explicit message menus, keyboard focus, modal containment, search/jump, real preferences, group roles/photo/archive, upload progress/retry and image preview |

## API surface

All paths below are under `/api/v2/team-chat` and use the existing authentication and tenant middleware.

- `GET /bootstrap`, `/channels`, `/members?q=`, `/search`, `/presence`.
- `POST /direct`, `/channels/group`; `PATCH /channels/:id`.
- `GET/POST /channels/:id/members`; `PATCH/DELETE /channels/:id/members/:userId`; `POST /channels/:id/leave`.
- `GET/POST /channels/:id/messages`; `PATCH/DELETE /channels/:id/messages/:messageId`.
- `POST /channels/:id/messages/:messageId/reactions`, `/pin`; `GET /channels/:id/pins`.
- `GET /channels/:id/sync?after=`; `POST /channels/:id/read`, `/unread`; `PATCH /channels/:id/preferences`.
- `POST /channels/:id/attachments`; `GET /attachments/stream/:storageKey`.
- `POST/GET/DELETE /channels/:id/avatar`.
- `GET/PUT /branch-policies`; `PATCH /settings`, `/notification-preferences`; `GET /retention` for administrators.

Sockets use authenticated per-user rooms, not client-controlled conversation subscriptions. The service computes authorized recipients for message, edit, delete, reaction, pin, channel, read and permission events. Typing requests validate the requested organization/conversation against current membership. Legacy bearer sockets now also disconnect at token expiry. Reconnection uses the persisted per-conversation change cursor rather than relying on socket event replay.

## Verification

Commands run from the repository root unless noted:

| Check | Result and evidence |
| --- | --- |
| `node backend/tests/test_team_chat_enterprise.js` | PASS: branch revocation, multiple branch memberships, foreign tenants/branches, private group authorization, group operations, reactions/pins, role/team/employee constraints, policy conflicts, mentions, notification/device preferences, removal and timezone cutoffs |
| `node backend/tests/test_team_chat_sqlite.js` | PASS: tenant/branch isolation, idempotency, unread counts, scoped socket recipients and retention |
| `node backend/tests/test_team_chat_transport.js` | PASS: real authenticated HTTP + Socket.IO delivery, one event for replayed sends, persisted edits/deletions, read records, presence filtering, attachment expiration and revoked memberships |
| `node backend/tests/test_team_chat_device.mjs` | PASS: scoped fallback caches, drafts/outbox, permission invalidation, canonical reconciliation, stale-version rejection, operation-ID collision isolation, local retention and per-organization logout policy |
| `node frontend/scripts/build-team-chat-qa.cjs` | PASS: current Team Inbox source compiles into a focused browser bundle |
| Focused ESLint | PASS with zero errors and zero warnings at the last completed check; rerun after final edits |
| Full CRA production build | BLOCKED: Node terminated with `Zone Allocation failed - process out of memory`; a full production build is not certified |
| Full-server HTTP smoke | BLOCKED: server did not reach its listening state within the smoke-test deadline; focused real-route HTTP/socket tests passed |
| Live socket-auth diagnostic | NOT VERIFIED: `localhost:5001` was unavailable, so its connection failure is not an authentication regression result |

The browser harness uses the actual React workspace with AuthProvider/EnterpriseProvider, the real chat router, existing authentication/tenant middleware, Socket.IO and an isolated SQLite database. It does not replace chat APIs with mock responses. Test employees and messages are confined to temporary test databases. Desktop (1440×950) and mobile (390×844) captures were rendered and visually inspected. Artifacts are in `scratch/team-inbox-desktop.png`, `scratch/team-inbox-mobile.png` and `scratch/team-inbox-group-details.png`.

| Interaction audit | Verified behavior |
| --- | --- |
| Employee selection and direct messages | Browser creates/opens a real direct conversation, sends, receives and refreshes without duplicate rows |
| Composer and message actions | Browser edit/reply flows, offline exactly-once replay, restored encrypted drafts, real search and pinned conversation preference |
| Conversation management | Backend preference persistence and manual unread state; UI pin/mute/archive controls use the real API |
| Groups | Browser creation, member role promotion, renaming, archive/reopen and actual participant details |
| Files | Browser upload and authenticated download; foreign-tenant access denied; transport test verifies expiration |
| Retained history | Browser backdates an actual synchronized message, purges the server, verifies its authorized device copy survives, and verifies a fresh device cannot retrieve it |
| Branch administration | Browser explicitly saves enable/disable rules; open clients hide revoked conversations and prune their cached history |
| Responsive and keyboard behavior | Mobile Back stays on the list, no horizontal page overflow at 390px, dialogs support Escape/focus containment, message actions have touch/keyboard triggers |

Final avatar, mention, notification and policy UI checks are included in `test_team_chat_browser.js`; report their latest run rather than assuming they pass from source inspection.

## Remaining acceptance work

This record is not a production certification. Production MySQL migration/rollback/concurrency tests, the full application build/startup, cookie-session flows in the full application shell, cross-device desktop-notification permission behavior, heavy-load/multi-instance testing, and configured malware scanning remain unverified. The timeline renders 200 messages initially and reveals history in batches; it is not a fully virtualized list. Employee search returns up to 500 matching permitted users per query. Dedicated per-device delivered acknowledgments are not implemented; the UI distinguishes server acceptance and actual reads.

If the sole group administrator is removed through an external account-management operation, the organization may need an administrative recovery procedure; ordinary leave operations prevent abandoning a group without a manager. Current authorization prevents removed users reading or receiving messages. Offline devices cannot be remotely erased while disconnected. Devices offline beyond the server window cannot recover mutations that have already expired; old local history can differ by device. AES-GCM cache encryption does not defend against a compromised browser origin or a user controlling that browser profile.

Do not represent every acceptance criterion in the original master brief as production-verified until these deployment and edge-case checks have passed.
