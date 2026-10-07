# Madhura WhatsApp CRM — Backend

Express + MySQL service behind the Madhura WhatsApp CRM. This repository is the
**backend only**; the React client lives in
[`Madhura-wa-frontend`](https://github.com/madhuratech/Madhura-wa-frontend).

This project integrates the WhatsApp Business Platform to help businesses
communicate with customers efficiently. It enables sending and receiving WhatsApp
messages, customer support, notifications, and automated responses, making
customer communication faster, easier, and more organized.

## What it does

- WhatsApp engines: WhatsApp Web sessions (QR / pairing code) and Meta Cloud API
- Live chat, contacts, templates, groups, bulk campaigns
- A CRM event bus that turns CRM records into WhatsApp messages, and WhatsApp
  replies back into CRM actions
- Chatbot flow engine, payment reminders, automations, analytics

## Requirements

- Node 20
- MySQL 8
- A WhatsApp session (QR pairing) or Meta Cloud API credentials

## First boot

```bash
npm ci
cp .env.example .env      # then fill it in — see below
npm start
```

`package.json` runs `patch-package` on postinstall. The patch in `patches/` is
what keeps a paired WhatsApp session from dropping immediately on newer WhatsApp
Web builds, so **do not** ignore that directory. Verify after cloning:

```bash
git ls-files patches/
```

## Configuration

All configuration is environment variables; `.env` is git-ignored. Copy
`.env.example` (local) or `.env.production.example` (VPS) and fill it in.

The ones that matter most:

| Variable | Purpose |
| --- | --- |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASS` / `DB_NAME` | MySQL connection |
| `JWT_SECRET` | token signing — **must match the main CRM's** initially |
| `ALLOWED_ORIGIN` | comma-separated allowed browser origins |
| `PUBLIC_BASE_URL` | public HTTPS base URL of this service; Meta fetches media from it |
| `ADMIN_SEED_PASSWORD` | used **once** to create the admin row |
| `WA_ACCESS_TOKEN` / `WA_APP_SECRET` / … | Meta Cloud API credentials |

### Admin seeding

`ADMIN_SEED_PASSWORD` creates the admin user **only if that row does not
already exist**. On every later boot the seed leaves the password column alone,
so a password changed from inside the app survives a restart. You can remove
`ADMIN_SEED_PASSWORD` from `.env` once the first boot has succeeded.

## Operational files — never in git

`.gitignore` keeps these out, and it is deliberately self-sufficient because
this directory is pushed as its own repository:

- `.env` — holds `DB_PASS`, `JWT_SECRET`, SMTP credentials, `WA_ACCESS_TOKEN`,
  `WA_APP_SECRET` and `VAPID_PRIVATE_KEY`
- `.wwebjs_cache/` — the paired WhatsApp session. Committing one leaks a live
  WhatsApp login; losing one forces every number to be re-paired by hand.
- `uploads/` — generated media and documents
- `*.sql` / `*.sql.gz` — ad-hoc database dumps

## Scripts

```bash
npm start                 # start the server
npm run dev               # same, with nodemon reload
npm test                  # jest suite
npm run verify            # auth audit + socket auth check
npm run verify:all        # everything, including the API link check
npm run audit:auth        # auth surface audit on its own
npm run test:degraded     # asserts boot + /health + 503 behaviour with no DB
npm run test:free         # asserts the app boots with the browser engine off
npm run test:zero-config  # asserts the app boots with NO env vars at all
```

### Zero-configuration boot

The service starts even when **no environment variables reach the container**.
That matters because a Render service can be created by hand rather than from
`render.yaml`, and then none of the blueprint's variables apply — which is
exactly what happened: the image built perfectly and then exited reporting every
variable missing, including `PUBLIC_BASE_URL` and `ALLOWED_ORIGINS`, which were
plainly set in the repository.

`config/runtimeDefaults.js` therefore supplies working fallbacks before anything
reads configuration:

| Defaulted | Value |
| --- | --- |
| `PORT`, `TZ`, `WA_MESSAGE_INTERVAL`, `WA_MAX_SESSIONS`, `WA_HEADLESS`, `WA_ENABLE_WEB_ENGINE` | sensible operating values |
| `PUBLIC_BASE_URL` | `https://wa-api.madhuratech.com` |
| `ALLOWED_ORIGINS` | this deployment's frontend + CRM origins |
| `ALLOW_START_WITHOUT_DB` | `1` — boot degraded rather than crash-loop |
| `DB_HOST`, `DB_PORT`, `WA_DATA_DIR` | localhost / 3306 / `/var/data` |
| `JWT_SECRET` | **generated at boot** — see below |

`/health` reports `defaultedValues` (exactly which keys were filled in) and
`ephemeralJwtSecret`, so a defaulted deployment is visible rather than inferred
from a log that has already scrolled away. The boot log lists them too.

A real environment variable always wins. These are fallbacks, never overrides.

#### `JWT_SECRET` is generated, not hardcoded

When unset or left as `CHANGE_ME`, a fresh random value is generated per process.
A hardcoded default would be a public string sitting in the repository that
anyone could read and mint valid tokens with; a generated one cannot be leaked
from the source. The cost is that restarting invalidates existing sessions, which
is logged loudly and reported in `/health`.

`DB_PASS`, `WA_ACCESS_TOKEN`, `WA_APP_SECRET` and the SMTP/EMAIL credentials are
**never** defaulted. There is no safe value to invent for those, and inventing one
is how credentials end up in git history.

#### Strict mode

Set `REQUIRE_HARD_CONFIG=1` and the environment is validated exactly as
provided — no defaulting at all, and a missing required value refuses to boot
again. Use it once the environment is known-good. The two features are mutually
exclusive by design: defaulting first would leave the check nothing to find.

Verify:

```bash
npm run test:zero-config
```

Migrations are standalone scripts, run directly:

```bash
node migrate_wa_tables.js
node migrations/wa_dedupe_and_unique_keys.js
```

`patches/` is applied automatically by the `postinstall` hook
(`patch-package || echo Patch applied or skipped`). That `||` fallback means a
patch failure is **silent** — after a fresh clone, confirm it actually applied:

```bash
npx patch-package --error-on-fail
```

## Deploy

## Deploy

### Render

`render.yaml` is a Render blueprint. Point Render at this repo (New → Blueprint)
and it creates both services, both disks, and every secret.

**Nothing needs typing.** The blueprint declares MySQL as a private service
(`wa-mysql`, from Render's own MySQL image) and the backend reads its host,
port, user, database and password through `fromService`, so Render fills them at
sync time. Secrets it can invent use `generateValue: true` and you never see or
copy them.

Two prefilled values depend on facts Render cannot know, so review them:

| Variable | Why you may need to change it |
| --- | --- |
| `ALLOWED_ORIGINS` | must match your frontend's origin exactly |
| `PUBLIC_BASE_URL` | must match this service's public URL |

Four things to know before you deploy:

1. **Paid plans only.** Both services need persistent disks, and the backend's
   free plan spins down — killing the browser and the paired session — with
   512 MB, which is under what Chromium alone needs.
2. **The backend's disk is not optional.** The paired WhatsApp session is a
   Chromium profile. On an ephemeral filesystem every deploy wipes it and every
   number has to be re-paired by hand at the phone.
3. **Already have a MySQL?** Delete the `wa-mysql` service block and set
   `DB_HOST`/`DB_PASS` yourself. Nothing else changes.
4. **`JWT_SECRET` must match the main Madhura CRM's** initially, or tokens
   issued by one origin are rejected by the other. Replace the generated value
   with the CRM's if you need shared sessions, and rotate both together.

### Running without a database (`ALLOW_START_WITHOUT_DB=1`)

Set this and the service boots even when no database is configured or reachable.
It exists for diagnosability and resilience — **not** as a working app:

| Surface | Behaviour |
| --- | --- |
| `/health` | HTTP 200, body `ok:false`, `database:"disconnected"`, `degraded:true`, plus a reason |
| `/api/*` | HTTP 503 with an explicit reason and hint |
| `/health` HTTP status | deliberately still 200, so orchestrators do not kill-loop the container |

There is **no substitute datastore**. This service keeps clients, invoices,
contacts, campaigns, flows and chat history as raw SQL, and the paired WhatsApp
session is a Chromium profile on disk. A JSON or browser-`localStorage` fallback
would mean rewriting every query in the codebase and would silently lose every
record on restart, so none exists here. Provision MySQL for a working service;
`render.yaml` can create it for you.

What degraded mode does *not* excuse: a `CHANGE_ME` placeholder in any secret
still refuses to boot, even with this set. A half-configured secret is never an
intentional state — booting with one is how a public host ends up signing tokens
with a public string.

Verify the behaviour:

```bash
node scripts/test-degraded-mode.js
```


### Running on the free plan (testing only)

`render.free.yaml` is a free-tier variant: both services on `plan: free`, no
disks, browser engine off. Copy it over `render.yaml` to use it, or add it as a
second Blueprint.

**What works:** the app boots and serves. Contacts, groups, templates, campaigns,
automations, flows, analytics, reminders, the admin UI, and the Meta Cloud API
engine. `/health` reports exactly what is and isn't available.

**What does not, and why** — these are platform limits, not settings:

| Limit | Consequence |
| --- | --- |
| No persistent disks | The database is **ephemeral**. Every container replacement wipes it and uploads are lost. It comes back as an empty-but-working app because the schema self-creates and the admin re-seeds. |
| Spins down after ~15 min idle | Next request is a cold start against an empty database. |
| 512 MB, and the Web engine needs ~350–500 MB for Chromium | **QR pairing does not work.** The browser is switched off via `WA_ENABLE_WEB_ENGINE=0`. |

Good for demoing the UI, testing a frontend change, validating a deploy, checking
CORS and env wiring. Not for real customers or any number you'd hate to re-pair.

### `WA_ENABLE_WEB_ENGINE=0`

The WhatsApp Web engine is a real headless Chromium per paired number. On a small
instance Node alone eats a third of the budget, so the browser is OOM-killed
during boot. With the flag off:

- nothing launches, and no session profile is written
- `restoreExisting()` skips saved profiles and reports why
- `Session.init()` rejects immediately with `WHATSAPP_WEB_ENGINE_DISABLED` and
  HTTP 503 — no partial launch, no orphan browser process
- `/health` reports `whatsappWebEngine: "disabled"` plus a hint, so a dead QR
  button is never a mystery
- everything not needing a browser keeps working

The flag defaults to **enabled**, so nothing changes for existing deployments. It
is a resource lever, not a way to run WhatsApp Web without a browser — with it off
you cannot pair a number. Configure the Meta Cloud API engine to send.

The switch lives in `config/webEngine.js`, deliberately dependency-free: `server.js`
reads it at boot so `/health` can answer without loading Puppeteer first.

Verify it:

```bash
npm run test:free        # boots the real server in a free-tier-shaped config
```

### VPS

`deploy/` holds `deploy.sh`, `setup-vps.sh` and an nginx site config.
`ecosystem.config.cjs` is the PM2 process definition.

Either way, put `WA_DATA_DIR` on storage **outside** the deploy directory — the
deploy script replaces that directory on every update.

### Anywhere else (Docker)

```bash
docker build -t madhura-wa-backend .
docker run -d -p 5001:5001 \
  -v /srv/wa-data:/data \
  --env-file .env \
  madhura-wa-backend
```

The image includes Chromium, runs as a non-root user, and ships a `/health`
healthcheck.

### After any deploy

```bash
curl -fsS https://<your-backend>/health          # {"ok":true,...}
```

Then confirm the browser can actually reach it. A green health check does not
prove CORS is right, because `curl` sends no `Origin` header:

```bash
curl -i -H "Origin: https://<your-frontend>" https://<your-backend>/api/health \
  | grep -i access-control-allow-origin
```

No `Access-Control-Allow-Origin` line means the frontend domain is missing from
`ALLOWED_ORIGINS`.

## Configuration validation

The server validates its own configuration before accepting traffic and
**refuses to start in production** when something required is missing or still
holds a template placeholder. It names the variables; no secret value is ever
logged.

This exists because a misconfigured backend does not crash. It boots, `/health`
returns 200, the logs look healthy, and things fail one at a time:

| Symptom | Cause the check now catches at boot |
| --- | --- |
| Frontend blank, curl fine | `ALLOWED_ORIGINS` empty or still the placeholder |
| Every browser request blocked | `ALLOWED_ORIGIN` (singular) set — that name is ignored |
| Outbound invoices/images silently fail | `PUBLIC_BASE_URL` is localhost or `http` |
| Tokens rejected by the main CRM | `JWT_SECRET` still `CHANGE_ME` |
| WhatsApp session dies on every deploy | `WA_DATA_DIR` unset (warns, not fatal) |

Check a configuration without starting the server:

```bash
node -e "const {reportEnv}=require('./config/envCheck');process.exit(reportEnv(process.env)?0:1)"
```

The frontend is deployed separately (Vercel or Docker). It reaches this service
over `ALLOWED_ORIGINS`, so add the frontend's domain there.
