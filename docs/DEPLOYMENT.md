# DEPLOYMENT — Vercel (frontend) + Hostinger VPS (backend)

**Split repos, two hosts, one working app.** This document is the whole procedure, in order.

Last reviewed against the repo state after the deployment-readiness pass.

---

## 1. The architecture, and why it's shaped this way

```
                            ┌─────────────────────────────────────┐
   Browser                  │  VERCEL                            │
   ────────                 │  https://app.example.com            │
                            │  CRA static build (no Node runtime) │
                            │                                     │
                            │  /            → index.html         │
                            │  /static/*    → CDN, immutable     │
                            │  /api/*       ─┐                   │
                            │  /uploads/*   ─┼─ rewrite ──────┐  │
                            │  /health      ─┘                │  │
                            │                                │  │
                            │  WebSocket ──────────────────┐   │  │
                            └─────────────────────────────┼───┼──┘
                                                          │   │
                              ┌───────────────────────────┼───┼────────┐
                              │  HOSTINGER VPS                        │
                              │  https://api.example.com              │
                              │                                        │
                              │  nginx :443  ── TLS, rate limits ──┐  │
                              │     /socket.io/  ── WS upgrade ────┤  │
                              │     /api/         ─────────────────┤  │
                              │     /uploads/     ─────────────────┤  │
                              │                                   ▼  │
                              │  node server.js :5001 (PM2, fork mode)│
                              │     ├── MySQL  achme_wa              │
                              │     ├── Redis  (BullMQ queue)        │
                              │     └── Chromium (WhatsApp session)  │
                              └────────────────────────────────────────┘

  Persistent state lives OUTSIDE the deploy directory:
      /home/wauser/wa-data/
        whatsapp-sessions/   ← the paired WhatsApp login. A Chromium profile.
        uploads/             ← invoices, brochures, campaign media
        backups/  logs/  .cache/puppeteer/
```

**Three decisions drive everything else:**

1. **HTTP is same-origin; the WebSocket is not.** All REST goes through Vercel rewrites so the browser never makes a cross-origin call — no CORS preflight, no third-party cookie blocking. The WebSocket bypasses Vercel because **Vercel only proxies WebSocket upgrades on paid plans**. On Hobby the socket points straight at the VPS, which the backend's origin allowlist permits.

2. **Runtime state is outside the deploy directory.** The backend is deployed by `git pull`, which makes the code directory replaceable. The paired WhatsApp session is not replaceable — losing it means walking to a phone and re-scanning a QR for every number the business runs. So `config/runtimePaths.js` resolves every mutable path through `WA_DATA_DIR`.

3. **PM2 runs `fork` mode, never `cluster`.** A WhatsApp Web session is a stateful Chromium profile with a lock file. Two forks fight over it and one crash-loops.

---

## 2. Before you start — the full checklist

| # | Item | Why it blocks |
|---|---|---|
| 1 | **Two domains** — one for the frontend, one for the backend | Both rewrites and both CORS checks key off them |
| 2 | **A real `JWT_SECRET`** on the backend | A placeholder means anyone can forge a token |
| 3 | **A MySQL database** `achme_wa` with the `wa_*` tables | Everything depends on it |
| 4 | **Redis** on the VPS | Without it, sends fall back to synchronous and can blow Meta's timing window |
| 5 | **Node 20** on the VPS | CRA 5 / `react-scripts` needs the OpenSSL legacy flag, which the build sets |
| 6 | **Chromium** installed on the VPS | `whatsapp-web.js` launches a real browser for QR pairing |

---

## 3. Split the repo into two

You have one repo today. Make two.

### 3.1 Frontend repo

```powershell
cd D:\Whatsapp_CRM
git subtree split --prefix=frontend -b frontend-only
```
Then create an empty GitHub repo `whatsapp-crm-frontend` (no README, no `.gitignore`) and:
```powershell
git remote add frontend git@github.com:<you>/whatsapp-crm-frontend.git
git push -u frontend frontend-only
```

Or, if you prefer to start clean (the frontend has its own `.gitignore`, so nothing leaks either way):
```powershell
cd D:\Whatsapp_CRM\frontend
git init -b main
git remote add origin git@github.com:<you>/whatsapp-crm-frontend.git
git add .
git commit -m "Frontend: CRA app, Vercel config, socket auth callback"
git push -u origin main
```

### 3.2 Backend repo

```powershell
cd D:\Whatsapp_CRM\backend
git init -b main
git remote add origin git@github.com:<you>/whatsapp-crm-backend.git
git add .
git status                    # ← READ THIS BEFORE COMMITTING
git commit -m "Backend: runtime paths, socket auth, CORS allowlist, deploy tooling"
git push -u origin main
```

**Before that first commit, verify nothing secret is staged.** `backend/.gitignore` now covers `.env`, `uploads/`, `.wwebjs_cache/`, `logs/`, `*.sql`, but check:
```powershell
git ls-files | Select-String -Pattern "\.env$|uploads/|\.wwebjs"
```
Expected: **no output.** If `.env` appears, stop — you are one commit away from publishing `DB_PASS`, `JWT_SECRET` and the Meta access token. Remove it from the index (`git rm --cached backend/.env`) and rotate the credentials, because a staged-then-committed secret must be assumed compromised.

> ⚠️ **`backend/patches/` must be committed.** The repo-root `.gitignore` used to exclude it, which made `postinstall`'s `patch-package` silently no-op on the VPS (`it ends in || echo "Patch applied or skipped"`). The result was an unpatched `whatsapp-web.js` that pairs the QR and then drops the session. `backend/.gitignore` no longer ignores it. Confirm it is tracked:
> ```powershell
> git ls-files patches/
> ```

### 3.3 Leave the monorepo working locally

Both halves still run on this machine unchanged:
```powershell
start_normal.bat
```
Runtime paths resolve to `D:\Whatsapp_CRM\whatsapp-sessions` and `D:\Whatsapp_CRM\backend\uploads` exactly as before — `config/runtimePaths.js` only redirects when `WA_DATA_DIR` is set.

---

## 4. DNS

| Record | Type | Value |
|---|---|---|
| `api` | A | `<VPS IPv4>` |
| `app` | A / CNAME | Vercel's target — Vercel tells you the value after you add the domain |

Two records on the same apex is fine (`api.example.com` and `app.example.com`). Wildcard `*.example.com` → VPS works too, but a wildcard cert then has to cover both, so **use two explicit records**.

**Wait for DNS to propagate before requesting the certificate.** ACME HTTP-01 validation fails against a stale record, and a failed first attempt triggers certbot rate limits that block you for a week.

---

## 5. Frontend → Vercel

### 5.1 Connect the repo

1. Vercel dashboard → **Add New** → **Project** → import `whatsapp-crm-frontend`.
2. Vercel auto-detects Create React App from `package.json`. Leave **Framework Preset = Create React App**, **Build Command = `npm run build`**, **Output Directory = `build`**.
3. Attach it to the `app` domain.

### 5.2 Set environment variables

**Settings → Environment Variables → Production.** Set only these — do **not** set `REACT_APP_API_URL`.

| Name | Value | Required? |
|---|---|---|
| `REACT_APP_SOCKET_URL` | `https://api.example.com` | **Yes, on Hobby.** No trailing slash. |
| `REACT_APP_API_URL` | *leave unset / empty* | No — empty is what makes HTTP same-origin |

`REACT_APP_*` values are **baked into the bundle at build time.** Changing one requires a redeploy (any commit to the repo triggers one, since Vercel auto-deploys). This is why they live in the dashboard and not in a committed `.env.production`.

### 5.3 Point `vercel.json` at the real backend

Four occurrences of `api.example.com`:

```powershell
cd D:\Whatsapp_CRM\frontend
(Get-Content vercel.json -Raw) -replace 'api\.example\.com', 'api.YOURDOMAIN.com' | Set-Content vercel.json
git commit -am "chore: point rewrites at the production backend"
git push
```

### 5.4 The Vercel plan decides your socket strategy

| Plan | `REACT_APP_SOCKET_URL` | Result |
|---|---|---|
| **Hobby** (free) | **Set it** to `https://api.example.com` | Socket connects direct to the VPS. Works. |
| **Pro / Enterprise** | **Leave it unset** | Socket uses the Vercel origin and rides the `/socket.io` rewrite. Everything same-origin. |

Hobby is fine for this app. The only cost of Hobby here is that the WebSocket request exposes your backend hostname to anyone who opens devtools — acceptable, because the backend is a public API endpoint anyway.

### 5.5 Deploy

Push to `main`, or `npx vercel --prod`. Watch the build log for two failure modes that are **not** code problems:

| Symptom | Cause | Fix |
|---|---|---|
| `error:0308010C:digital envelope routines::unsupported` | Node 17+ vs CRA's md4 hash | Already handled: `NODE_OPTIONS=--openssl-legacy-provider` in `vercel.json` + `engines.node: 20.x` |
| `Treating warnings as errors because process.env.CI = true` | Vercel sets `CI=true`; this codebase has pre-existing lint warnings | Already handled: `CI=false` in `vercel.json` |

If either still appears, check that `vercel.json` was actually picked up — Project → Settings → Build & Development, or run `npx vercel build` locally to reproduce.

---

## 6. Backend → Hostinger VPS

### 6.1 Bootstrap

```bash
sudo apt update && sudo apt upgrade -y
sudo adduser --disabled-password --gecos "" wauser
sudo usermod -aG sudo wauser

sudo su - wauser
git clone git@github.com:<you>/whatsapp-crm-backend.git ~/app/backend
cd ~/app/backend
bash deploy/setup-vps.sh
```

`setup-vps.sh` installs Node 20, nginx, Redis, PM2 + log rotation, Chromium's shared libraries, the persistent directory tree, and the nginx site config. It is idempotent — re-run it after a big system upgrade.

### 6.2 DNS, then the certificate

```bash
sudo certbot --nginx -d api.example.com
```

**DNS must already resolve.** If it doesn't, certbot fails and you may hit rate limits.

Verify:
```bash
curl -I https://api.example.com/health
```

### 6.3 Configuration

```bash
cd /home/wauser/app/backend
cp .env.production.example .env
nano .env
```

| Variable | Value | Notes |
|---|---|---|
| `NODE_ENV` | `production` | Turns on the strict CORS fail-closed behaviour |
| `ALLOWED_ORIGINS` | `https://app.example.com,https://www.example.com` | **Exact origins.** Scheme included. No trailing slash (a trailing slash is stripped automatically). |
| `JWT_SECRET` | `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` | Must match the main Madhura CRM's secret, or its tokens will be rejected |
| `DB_HOST` / `DB_USER` / `DB_PASS` / `DB_NAME` | from hPanel → MySQL → Databases | `DB_NAME=achme_wa` |
| `PUBLIC_BASE_URL` | `https://api.example.com` | **Must be publicly reachable HTTPS.** Meta's servers fetch media from this. `localhost` here means outbound WhatsApp media silently fails. |
| `WA_DATA_DIR` | `/home/wauser/wa-data` | Must match `ecosystem.config.cjs` |
| `REDIS_URL` | `redis://127.0.0.1:6379` | |
| `WA_ACCESS_TOKEN`, `WA_PHONE_NUMBER_ID`, … | from Meta | Only if using Cloud API |
| `OPENROUTER_API_KEY` / `OPENAI_API_KEY` | optional | If set, name the provider and model in your privacy policy |

Create the database:
```sql
CREATE DATABASE achme_wa CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 6.4 First deploy

```bash
cd /home/wauser/app/backend
./deploy/deploy.sh
```

It: preflights `.env` and refuses a placeholder `JWT_SECRET` → dumps the DB → `git pull` → `npm ci --omit=dev` → verifies `patches/` actually applied → installs Chromium **only if missing** → runs the idempotent migrations → `pm2 startOrRestart` → **polls `/health` for up to 30s** → and if unhealthy, prints the PM2 log, checks out the previous commit, restarts, and exits non-zero.

### 6.5 Survive reboots

```bash
pm2 save
pm2 startup          # prints a command — run it
```

---

## 7. The connection matrix

Every cross-process edge, and how it is authenticated.

| From | To | Via | Auth | Fails how |
|---|---|---|---|---|
| Browser → REST | `app.example.com/api/*` | Vercel rewrite → nginx → `:5001` | `Authorization: Bearer <jwt>` | CORS not involved (same-origin) |
| Browser → media | `app.example.com/uploads/*` | Vercel rewrite → nginx → `express.static` | **none** | Files are public if you know the URL. See §10. |
| Browser → socket | `api.example.com/socket.io` (Hobby) or `app.example.com/socket.io` (Pro) | direct or rewrite | JWT in `handshake.auth.token` | `connect_error: unauthorized: …` |
| Meta → webhook | `api.example.com/webhook` | nginx → express | `X-Hub-Signature-256` when `WA_APP_SECRET` is set | 401 |
| Madhura CRM → | `api.example.com/api/v1/*`, `/api/crm/*` | nginx → express | `X-API-Key` (timing-safe compare) or JWT | 401/403 |
| Meta → media fetch | `PUBLIC_BASE_URL/uploads/...` | nginx | **none** | 404 → inbound media silently broken |
| nginx → node | `127.0.0.1:5001` | loopback | none | — |

**Ports that must never be open to the internet:** `3306` (MySQL), `6379` (Redis), `5001` (node). nginx proxies 443 → 5001; nothing else should reach 5001 from outside. Confirm with `sudo ufw status`.

---

## 8. Verification

Run these **before** you tell anyone the site is live.

### 8.0 One command

```bash
cd backend
npm run verify:all                       # against localhost
npm run verify:all -- --api https://api.example.com --site https://app.example.com
```

```
  Static checks
  ✓ Route authorisation
      228 handlers guarded, 0 reachable without a credential
  ✓ CORS origin policy
      25 cases, including 9 hostile origins refused in production
  Runtime checks
  ✓ Socket authorisation
  ✓ Frontend link
```

**A skipped check is reported as skipped and exits non-zero.** Unverified is not
the same as working — that distinction is the whole reason this script refuses to
report a partial run as a pass.

| Flag | Effect |
|---|---|
| `--api <url>` | Backend target (default `http://localhost:5001`) |
| `--site <url>` | Frontend origin to test CORS against (default `http://localhost:3001`) |
| `--skip-socket` | Static checks only |
| `--skip-link` | Skip the frontend check |

Both runtime checks detect the most common failure mode after pulling new code:
**a backend still running the old process.** They say so explicitly rather than
reporting a generic failure.

### 8.1 The chain check (from the frontend folder)

```powershell
cd D:\Whatsapp_CRM\frontend
npm install
$env:VERIFY_SITE_URL="https://app.example.com"
$env:VERIFY_API_URL="https://api.example.com"
npm run verify:api
```

Eight checks, each named to the thing it proves:

| # | Check | Failing means |
|---|---|---|
| 1 | Backend `/health` returns 200 | Backend down, or nginx isn't proxying |
| 2 | Backend reflects your frontend origin in `Access-Control-Allow-Origin` | `ALLOWED_ORIGINS` mismatch — **the #1 post-migration break** |
| 3 | CORS preflight passes (methods, credentials, `Authorization`) | `allowedHeaders` regressed |
| 4 | An unknown origin is **not** reflected | The allowlist isn't active. `NODE_ENV` isn't `production`, or `ALLOWED_ORIGINS` is empty |
| 5 | `/uploads` is mounted | `PUBLIC_BASE_URL` media will 404 |
| 6 | Socket.IO handshake answers | nginx is missing `Upgrade`/`Connection` on `/socket.io/` |
| 7 | Socket origin is allowlisted | `ALLOWED_ORIGINS` missing the frontend, when using a direct socket |
| 8 | Authenticated `GET /api/auth/me` (only with `VERIFY_WITH_TOKEN`) | JWT mismatch between login and verify |

Run it against `http://127.0.0.1:5001` first — same script, no deploy involved.

### 8.2 The socket authorisation check (from the backend folder)

```bash
cd /home/wauser/app/backend
npm run test:socket
```

Proves five things that a browser test cannot:

1. An anonymous socket is **refused**
2. A socket with a valid JWT connects
3. You can join your own room
4. You **cannot** join another user's room
5. An employee **cannot** join `admin_notifications`
6. An admin **still can** — a guard that rejects everyone is an outage, not a fix

### 8.3 Manual smoke test

| Step | Expected |
|---|---|
| Open `https://app.example.com` | SPA loads, no console CORS error |
| Sign in | Redirects to `/whatsapp` |
| Inbox loads, message arrives from a real contact | **Live** message without a refresh → socket is genuinely connected |
| Send a message | Status goes sent → delivered → read |
| Upload a PDF via a campaign | File appears under `/uploads/wa-media/` on the VPS |
| Upload the same PDF in a flow, send it to a WhatsApp contact | The PDF arrives — proves `PUBLIC_BASE_URL` works for Meta |
| `pm2 status` | `online`, low restart count |
| `pm2 logs wa-crm-backend --lines 50` | No `unauthorized`, no `[Socket] ... rejected` for your own user |
| Hard-refresh the browser | Still signed in; no dead hash errors |

---

## 9. Deploying an update

**Frontend** — push to `main`; Vercel builds and swaps atomically.
```powershell
cd D:\Whatsapp_CRM\frontend
git push
```

**Backend** — on the VPS:
```bash
cd /home/wauser/app/backend
./deploy/deploy.sh
```
This is the safe path: DB backup → pull → deps → patch verify → migrations → restart → health poll → **automatic rollback on failure**.

**Never** `git pull` by hand on the server. `deploy.sh` is what guarantees the health check and the rollback.

### 9.0 Local development: restarting after a pull

Node caches modules, so **the backend must be restarted to pick up any change.**
This is the single most common source of confusion after a `git pull`:

```powershell
# stop the old process, then
cd D:\Whatsapp_CRM
start_normal.bat
```

Then confirm it is actually running the new code:

```bash
cd D:\Whatsapp_CRM\backend
npm run verify:all
```

Two of its checks exist specifically to catch "I forgot to restart":

| If it says | Meaning |
|---|---|
| `backend is running the OLD socket code (no handshake auth)` | The process predates `sockets/socketAuth.js`. Restart. |
| `backend is reflecting ANY origin` | The process predates `config/corsPolicy.js`. Restart. |

Both messages name the file to check, because "connection refused" or a generic
CORS failure tells you nothing about which of your changes is actually loaded.

**Restarting drops any in-flight campaign** and re-boots the Chromium session.
Do it when nothing is sending, not mid-campaign. A paired session should restore
from its profile automatically — confirm in the log, and if you see
`disconnected: LOGOUT` immediately after a QR scan, check that `patches/` was
actually committed (§3.2).

### 9.1 If a migration changed the schema

`deploy.sh` runs `scripts/first-boot-db.js` and then the three scripts in `migrations/`, all of which are idempotent. Review them before the first production deploy — they are written to be safe to re-run, but "idempotent" is a claim to verify, not an assumption.

### 9.2 Rolling back a schema migration

`deploy.sh` rolls back **code only.** If a migration made an incompatible schema change, the old code may not run against the new schema. Restore the dump:

```bash
gunzip -c /home/wauser/wa-data/backups/achme_wa-<stamp>.sql.gz \
  | mysql -u root -p achme_wa
```

This is why `deploy.sh` takes a dump **before** migrating and keeps the last 10.

---

## 10. Security checklist before go-live

This deployment moves a service that was previously LAN-only onto a public hostname. Everything on this list was a non-issue at `192.168.0.131` and is an issue at `api.example.com`.

| # | Check | Status |
|---|---|---|
| 1 | `NODE_ENV=production` and `ALLOWED_ORIGINS` set | ☐ |
| 2 | `JWT_SECRET` is a real 64-byte random hex, not `CHANGE_ME` | ☐ |
| 3 | `JWT_SECRET` matches the main CRM's, or you accept re-login | ☐ |
| 4 | `verify-api-link` check #4 passes — the allowlist is actually active | ☐ |
| 5 | `npm run test:socket` passes — sockets authenticate and authorise | ☐ |
| 6 | `ufw status` shows only 22, 80, 443 | ☐ |
| 7 | `mysql -e "SHOW VARIABLES LIKE 'bind_address'"` → `127.0.0.1`, or MySQL is not listening publicly | ☐ |
| 8 | Redis has `bind 127.0.0.1` and a `requirepass` | ☐ |
| 9 | **`/uploads/**` is publicly readable by URL** | ⚠️ see below |
| 10 | `public/robots.txt` disallows `/whatsapp/`, `/login`, `/signup` | ☐ |
| 11 | `WA_API_KEY` is set (the old code had a hardcoded fallback secret) | ☐ |
| 12 | Backups exist and have been restore-tested at least once | ☐ |

### ✅ Correction — the `/api/wa/*` "unauthenticated mounts" claim was WRONG

An earlier version of this document (and of `landing.md`) stated that a dozen
`/api/wa/*` mounts were reachable without a credential because they are mounted
without `verifyToken`. **That was incorrect.** They are mounted bare, but every
single handler inside them applies `verifyToken` itself. Routing auth at the
mount is a style, not a requirement — a bare mount plus per-handler middleware
is fully protected, and reading it the other way round produced a false alarm.

Verify it yourself rather than taking this on faith:

```bash
npm run audit:auth
```

```
  Handlers by verdict
    GUARDED              228
    PUBLIC_BY_DESIGN     9
  All 237 handlers are authorised. Nothing reachable without a credential.
```

How the API is actually protected:

| Mount | Protection |
|---|---|
| `/api/whatsapp` (55 handlers) | `verifyToken` at the mount |
| `/api/v1`, `/api/crm` (15 handlers) | `verifyToken` at the mount — this is the CRM bridge, and `verifyToken` accepts `X-API-Key` for server-to-server calls |
| `/api/wa/config` (5 handlers) | `verifyToken` at the mount |
| `/api/wa/templates`, `groups`, `campaigns`, `analytics`, `contacts`, `automations`, `flows`, `ai`, `payments`, `drip`, `reminders` (153 handlers) | Bare mount, but **every handler** applies `verifyToken` inline |
| `/api/auth` (7) | Public by design — login, OTP, registration. Rate-limited |
| `/webhook`, `/api/wa/webhook` (2) | Public by design — Meta calls them, verified by `X-Hub-Signature-256` when `WA_APP_SECRET` is set |

**The one genuine open item is `/uploads`.** `express.static` has no middleware
chain, so no amount of route auditing covers it. See below.

### ⚠️ `/uploads/**` — the only genuinely open surface

Served by `express.static` with **no authentication**. Invoice PDFs and
brochures are reachable by anyone who knows or guesses the URL. Filenames are
`timestamp_random.ext`, which is not guessable — but the URL leaks whenever a
file is sent to a WhatsApp contact, and the recipient can share it.

Already done for you in the nginx config: `Cache-Control: private, no-store` and
`X-Robots-Tag: noindex`. That stops proxies and search engines from keeping a
copy. What it cannot do is stop a recipient from forwarding the link.

Three options, in order of effort:

1. **Accept it, and scope the damage** — never store anything in `/uploads` that you would not put in a customer's inbox. Write that rule down so it is a decision rather than an oversight.
2. **Signed URLs** — middleware that checks `?exp=&sig=` (HMAC of path + expiry + a secret) before serving. ~40 lines in `server.js`. The complication is Meta: the signature has to be present in the URL handed to Meta's servers, so the signature must be generated at send-time wherever media URLs are built for Cloud API. Doable, but it touches several call sites — plan for a regression test on outbound media.
3. **Move files behind `verifyToken`** — simplest, but it breaks Meta's inbound media fetch, because Meta cannot present your JWT. Only viable if you are not using Cloud API.

### Also worth knowing

- **`waPasswordless` / OTP is email-based.** If `SMTP_USER`/`SMTP_PASS` are empty, **logins silently cannot complete.** Set them or turn off passwordless login.
- **`WA_API_KEY`** — the auth middleware's comment notes it *used* to fall back to the literal string `"wa_crm_secret_key_2026"`. That is a publicly known admin credential. Set `WA_API_KEY` explicitly.
- **`ALLOWED_ORIGINS` is the whole CORS posture.** With `NODE_ENV=production` and an empty value, every cross-origin browser request is refused. That is intentional — fail closed, and louder than reflecting every origin with `credentials: true`.

---

## 11. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| CORS error in the console, **server logs look fine** | `ALLOWED_ORIGINS` doesn't match the frontend origin exactly | Compare character by character: `https://`, `www.`, trailing `/`. Test: `curl -I -H "Origin: https://app.example.com" https://api.example.com/api/health \| grep -i access-control` |
| Every API call 404s on Vercel | Rewrite order — the SPA fallback is catching `/api` | Confirm `/api/:path*` is above `/:path*` in `vercel.json` |
| `ERR_OSSL_EVP_UNSUPPORTED` at build | Node 17+ vs CRA's md4 hash | Already in `vercel.json`. If it persists, set `engines.node: "20.x"` in the Vercel project settings |
| `Treating warnings as errors` at build | `CI=true` | Already `CI=false` in `vercel.json` |
| Socket never connects; console shows repeated `connect_error` | Missing JWT, or the `auth` option isn't the **callback** form | The frontend must use `auth: (cb) => cb({ token })`. A function that *returns* the object is silently ignored by socket.io-client |
| Inbox loads but never updates live | Falling back to long-polling, or the WS is dead | `curl -i "https://api.example.com/socket.io/?EIO=4&transport=polling"` should return a body containing `sid`. Check nginx `Upgrade`/`Connection` headers on `/socket.io/` |
| Socket connects, then drops every ~60s | nginx `proxy_read_timeout` default | Already set to 3600s in the nginx config |
| Outbound WhatsApp PDF/images fail, everything else works | `PUBLIC_BASE_URL` is `localhost` or not HTTPS | Meta fetches from Facebook's servers. It must be the public URL with a valid cert |
| QR scan links the phone, session drops immediately (`disconnected: LOGOUT`) | The `whatsapp-web.js` patch didn't apply | Check `patches/*.patch` is committed, and that `npx patch-package` reports success during deploy. Otherwise set `WA_WEB_VERSION=latest` |
| Deploy succeeds, `git status` shows `uploads/` as deleted | State was written inside the deploy dir | `WA_DATA_DIR` isn't set, or `deploy.sh` wasn't used. `pm2 logs` prints the resolved paths at boot — read that line |
| `502` from nginx intermittently | Node restarting, or 2GB RAM + Chromium is OOM-killed | `pm2 status` (restart count), `dmesg \| grep -i oom`, add 2GB swap |
| `429` too many requests | nginx `limit_req` (30r/s) or the app's own limiter | Expected on a bulk campaign. Check which one: nginx returns no JSON body, the app returns `{message}` |
| Frontend works locally, breaks only on Vercel | `REACT_APP_API_URL` is set in the dashboard | Leave it **unset**. Empty = same-origin = the rewrite handles it |
| `npm ci` fails on the VPS but works locally | `package-lock.json` out of sync with `package.json` | Commit the lockfile from the same machine you edited on |

---

## 12. Cost and sizing

| Item | Cost | Note |
|---|---|---|
| Vercel Hobby | $0 | Fine. WebSocket goes direct to the VPS. |
| Vercel Pro | $20/mo | Only if you want the socket same-origin, or you exceed Hobby's build-minute limits. |
| Hostinger VPS | plan-dependent | **2GB minimum.** Chromium + MySQL + Redis on 1GB OOMs under load. |
| Managed Redis | optional | Skip at first; local Redis on the same box is fine at SMB volume. |

Capacity notes: one Chrome profile per paired WhatsApp number, so N numbers ≈ N Chromium instances. Budget roughly 300–500MB of RAM per active session plus ~200MB for the Node process. **A 2GB VPS comfortably holds about 3 paired numbers.** Past that, go to 4GB or move to managed MySQL.

---

## 13. What was changed in the repo for this deployment

Everything below is already committed to the working tree.

### Frontend
| File | Change | Why |
|---|---|---|
| `vercel.json` | **new** | Rewrites `/api`, `/uploads`, `/socket.io`, `/health` to the backend; SPA fallback; cache and security headers; Node/OpenSSL/CI build env |
| `.nvmrc` | **new** | Pins Node 20 for Vercel and local parity |
| `.env.production.example` | **new** | Documents `REACT_APP_SOCKET_URL` and why `REACT_APP_API_URL` stays empty |
| `scripts/verify-api-link.js` | **new** | The 8-check link verifier (`npm run verify:api`) |
| `src/config/index.js` | Added `SOCKET` export | HTTP and WebSocket need separate origins on Hobby |
| `src/config/api.js` | Re-export `SOCKET` | |
| `src/socket/socket.js` | Uses `SOCKET`; token read **per handshake** via the **callback** `auth` form | Reading the token at module scope meant a user still on the login page had a null token forever. The callback form is required — returning the object is silently ignored |
| `src/index.js` | Removed the module-scope socket import | `socket.js` calls `io()` twice at import, so every visitor — including on the public landing page — held two persistent WebSockets. It also pulled socket.io-client into the main bundle and defeated code splitting |
| `public/sw.js` | `/api/**` and navigations → `NetworkOnly` | The old `NetworkFirst` + 24h TTL wrote conversations and payment records into CacheStorage and served stale HTML for a day after a deploy |
| `package.json` | `engines.node`, `verify:api` script | |
| `.dockerignore` | secrets, build | |

### Backend
| File | Change | Why |
|---|---|---|
| `config/runtimePaths.js` | **new** | One place that decides where `uploads/`, `whatsapp-sessions/`, `backups/`, `logs/` live, all overridable via `WA_DATA_DIR`. Deploys can no longer orphan a session |
| `config/corsPolicy.js` | **new** | The origin allowlist, extracted so it is unit-testable without booting the app. Server.js previously inlined it, which meant the only way to verify the policy was to restart a live server holding a paired WhatsApp number — so nobody re-verified it after a change |
| `scripts/test-cors-policy.js` | **new** | 25 policy cases incl. lookalike-subdomain, suffix-attack, scheme and port mismatches, and 9 hostile origins in production |
| `scripts/audit-auth.js` | **new** | Resolves mount-level *and* per-handler auth across all 237 handlers. Exists because a bare `app.use("/api/wa/x", router)` was mistaken for an open mount when every handler actually guards itself |
| `scripts/verify-all.js` | **new** | One command: static audit + CORS policy + socket auth + frontend link. Skips count as failures |
| `sockets/socketAuth.js` | **new** | JWT-required Socket.IO handshake plus per-room authorisation |
| `sockets/chatsockets.js` | `io.use(authenticateSocket)`; `join` and `join_room` authorised | **There was no socket authentication at all.** Anyone could `join` any `userId` or `join_admin` and read that user's live messages |
| `sockets/notifications.js` | Same auth; `role` from the client ignored; `join_admin` admin-only; `mark_read` scoped by `user_id` | `join({ role: "admin" })` was a privilege-escalation primitive |
| `server.js` | `ALLOWED_ORIGINS` allowlist (fails closed in prod); `trust proxy`; `dotenv` `override:false`; runtime paths | Reflect-all + `credentials:true` is how a JWT gets stolen. `trust proxy` is required for rate limiters to see real client IPs. `override:false` lets the VPS inject env without `.env` clobbering it |
| `routes/whatsappRoutes.js`, `waCampaignRoutes.js`, `externalCrmRoutes.js`, `services/whatsappCloudApi.js` | Use `runtimePaths` instead of `__dirname`-relative paths | Uploaded media must live outside the deploy dir |
| `services/whatsappService.js` | `SESSIONS_ROOT` from `runtimePaths` | |
| `ecosystem.config.cjs` | **new** | PM2: fork mode, memory cap, persistent paths, log rotation notes |
| `deploy/setup-vps.sh` | **new** | Idempotent bootstrap |
| `deploy/deploy.sh` | **new** | Backup → pull → deps → patch verify → Chromium once → migrate → restart → health poll → **auto-rollback** |
| `deploy/nginx/whatsapp-crm.conf` | **new** | TLS, WS upgrade, 3600s socket timeout, 60MB body, rate-limit zones |
| `scripts/check-socket-auth.js` | **new** | 6-check socket authorisation proof |
| `.env.production.example` | **new** | Annotated VPS template |
| `.gitignore` | Rewritten; `patches/` no longer ignored | A gitignored `patches/` made `postinstall` silently no-op on the VPS → unpatched `whatsapp-web.js` → sessions dropped right after pairing. `.env` is now ignored **in this repo**, since the root `.gitignore` won't travel with a split repo |
| `package.json` | `test:socket`; `socket.io-client` as a devDependency | |
| `.dockerignore` | sessions, uploads, secrets | |

### Still open
- **`/uploads/**` has no authentication.** `express.static` has no middleware chain. Already mitigated with `private, no-store` + `noindex` in nginx. Options in §10.
- The frontend is one 1454KB bundle with no code splitting. LCP < 2.0s is not achievable until routes are `React.lazy`. Works fine, just slow — and slow loses visitors before any copy lands.
- `public/robots.txt` currently allows everything, including the authed app.

### Corrected
- ~~`/api/wa/*` mounts are unauthenticated~~ — **false.** Every handler applies `verifyToken`; `externalCrmRoutes` is behind the mount. Proven by `npm run audit:auth`: 237/237 handlers authorised. Run it rather than trusting this note.
