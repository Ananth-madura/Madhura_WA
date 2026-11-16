# MySQL startup and madhura_wa

The local backend is configured for `127.0.0.1:3306`, database **`madhura_wa`**, with `DB_ENGINE=mysql` and `USE_SQLITE=0`. Existing credentials were preserved. The frontend at `http://localhost:3001` calls `http://localhost:5001`.

## Login and signup redirects

The login bounce was reproduced in a real browser: account creation succeeded, but a frontend/API hostname mismatch prevented the browser from sending its HttpOnly session cookie. The following workspace request returned 401, refresh also failed, and the app returned to `/login`.

`start_normal.bat` previously rewrote the frontend API address to the computer's LAN IP on every launch. Opening the frontend as `localhost:3001` then made authentication cross-site. The launcher now preserves existing environment files. Local API and Socket.IO URLs use the browser's local hostname while preserving the configured backend port. Public remote API origins remain configurable.

Login, two-factor completion, signup and access-code activation now check `/api/auth/session` with cookies before publishing the authenticated profile and redirecting. If the browser blocks the cookie, the form displays a usable error instead of entering the workspace and bouncing back. Bearer API compatibility remains available.

Use `http://localhost:3001/login` locally and hard-refresh once after this update. Successful login and free signup enter `/whatsapp`; paid signup continues through the existing billing onboarding. There is no need to delete the database or reset the password to fix this hostname problem. A different password error or missing account still needs its own authentication check.

Verification: 20 frontend suites / 53 tests passed. The full 14-suite backend/browser pipeline passed signup, workspace entry, hard refresh, visiting login while signed in, logout and later login on both `localhost` and `127.0.0.1`, plus the existing inbox and flow-builder checks. These tests use disposable MySQL and provider fixtures. A read-only browser check also confirmed the running local frontend uses the matching API hostname on both addresses without page errors or account submission.

## Existing data was preserved

The old `achme_wa` database was backed up, copied to the previously absent `madhura_wa` database, and checked table by table before switching the backend. All **119 tables and 10,833 rows** matched, including extended table checksums. The original `achme_wa` database is retained; it was not dropped. Existing SQLite files were not modified by this connection change.

The SQL snapshot is under `scratch/flows-database-achme_wa-1792924555006.sql`; the earlier pre-connection snapshot is `scratch/flows-mysql-before-connect.sql`. These contain private application data and are excluded from Git. Store a separate protected backup outside this workspace as part of production operations.

Do not switch back to the old database after new writes without reconciling those writes: the retained database is a point-in-time rollback copy.

## What backend startup creates

With a running MySQL server and the configured login:

1. Connect to MySQL using the supplied credentials.
2. Create `DB_NAME` if absent, with the application character set/collation.
3. Create the known base tables and apply known column changes.
4. Apply versioned organization, branch, membership, plan, billing, session and inbox/flow migrations.
5. Verify critical signup, billing, session and inbox fields before declaring the workspace ready.

Defaults and both environment examples now use `madhura_wa`. Explicit deployment environment variables still take precedence. A missing database does not automatically select SQLite. Migration failures reject database readiness; missing critical fields keep workspace readiness false. Normal startup waits for database initialization by default. Known migrations update supported schema changes; the backend does not invent arbitrary new tables or business fields.

MySQL must already be installed and running. Automatic schema setup needs database creation and migration permissions for the target database. A login restricted to reading/writing rows cannot create databases, tables or indexes. The backend does not install the database daemon, reset credentials, repair damaged data files or create missing project source files.

## Local setup and VPS setup

Use these non-secret values in the backend environment:

```dotenv
DB_ENGINE=mysql
USE_SQLITE=0
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=madhura_wa
ALLOW_START_WITHOUT_DB=0
ENABLE_RENDER_KEEP_ALIVE=0
DISABLE_RENDER_KEEP_ALIVE=1
```

Set `DB_USER` and `DB_PASS` securely for each machine. `127.0.0.1` on the VPS refers to the VPS's MySQL server; it does not connect to the development computer. Use a dedicated database account on the VPS. Configure a different host explicitly for a managed/remote database.

The local MySQL server was started normally using its existing data directory through an administrator helper. The Windows `MySQL80` service did not start successfully through the service manager, so automatic database-server startup after a Windows reboot still needs service configuration. Do not start `MySQL`, `MySQL0` and `MySQL80` together: all three reference the same data directory. Only one server should own it. On the VPS, use the host's MySQL service manager and enable that service at boot.

Start the application with `npm start` from `backend`. Then run:

```sh
node scripts/check-mysql.js
node scripts/readiness-check.js
```

The connection check prints the selected database, connection status, missing core tables and active-plan count without printing credentials. The readiness command requires the health body's database/workspace readiness, rather than treating every HTTP 200 as success.

Keep-alive self-pings are disabled by default. HTTP and database connection reuse remain enabled; those maintain normal connections and do not generate the old `[KeepAlive]` heartbeat requests.

For frontend/VPS domains, use [live_domains.md](live_domains.md). `api.madhuratech.in` did not resolve during the last DNS check; DNS/TLS and VPS deployment still need to be connected before claiming the public system works.

## Evidence

- Local API health reported MySQL, database ready, workspace ready and `ok=true`.
- The live local plans endpoint returned five plans.
- A real browser opened `localhost:3001/signup`, displayed five plans, enabled signup, used only `localhost:5001` for API calls, and had no page errors. No account was submitted or charged during that check.
- Fourteen safe backend suites passed, including a full startup test that deliberately leaves its disposable database absent and proves the backend creates and initializes it. Signup, login and payment tests use an isolated database and provider fixtures.
- The frontend tests passed 19 suites / 46 tests. Repeat deployment checks on the declared Node 24 runtime; this workspace runs Node 26.1.0.
