# Deploying the Madhura WhatsApp CRM frontend

This repo is the **frontend only**. The backend (Express + MySQL + WhatsApp
engines) lives in a separate repo and runs on a VPS.

| Piece     | Where                                        |
| --------- | -------------------------------------------- |
| Frontend  | this repo, static build on Vercel            |
| Backend   | `https://wa-api.madhuratech.com` (VPS)       |
| CRM       | `https://crm.madhuratech.com` (separate app) |

## Two supported deploy targets

### 1. Vercel (primary)

`vercel.json` is **strict JSON — no comments**. JSON has no comment syntax, so
any `//` line makes the file unparseable and the deploy fails on config parse
rather than on anything meaningful. The rationale that used to live in comments
lives in this file instead.

Set these in the Vercel dashboard (**Settings → Environment Variables**):

| Variable               | Value                                  |
| ---------------------- | -------------------------------------- |
| `REACT_APP_API_URL`    | leave **empty**                        |
| `REACT_APP_SOCKET_URL` | `https://wa-api.madhuratech.com`       |

`REACT_APP_*` values are inlined into the bundle at **build** time. Changing one
needs a redeploy, not a restart.

### 2. Docker + nginx (self-hosted)

```bash
docker build -t madhura-wa-frontend .
docker run -d -p 80:80 --link backend:backend madhura-wa-frontend
```

No environment variables needed — `nginx.conf` proxies `/api`, `/uploads`,
`/socket.io` and `/health` to the `backend` container on the same origin.

## How HTTP routing works

The browser only ever talks to **one** origin. All backend paths are rewritten
to the backend before they leave, so there is no CORS preflight and nothing to
keep in sync:

```
/api/:path*       ->  https://wa-api.madhuratech.com/api/:path*
/uploads/:path*   ->  https://wa-api.madhuratech.com/uploads/:path*
/socket.io/:path* ->  https://wa-api.madhuratech.com/socket.io/:path*
/health           ->  https://wa-api.madhuratech.com/health
/:path*           ->  /index.html          (SPA fallback, MUST stay last)
```

Two things that are easy to get wrong here:

- **Rewrite order is significant.** Vercel takes the first match, so the API,
  upload, socket and health rules must stay above the SPA fallback. Static files
  resolve before any rewrite runs, so hashed `/static/*` assets are served from
  the CDN and never reach the backend.
- **`REACT_APP_SOCKET_URL` cannot be avoided on Hobby.** Vercel only proxies
  WebSocket upgrades on paid plans, so on Hobby the socket client connects
  straight to `wa-api.madhuratech.com`. That is a real cross-origin socket, and
  the backend must list your Vercel domain in `ALLOWED_ORIGINS`. On
  Pro/Enterprise, leave it unset and the socket rides the same-origin rewrite.

## nginx: the `proxy_pass` trailing slash

`nginx.conf` proxies with **no trailing URI**:

```nginx
proxy_pass http://backend:5000;     # correct — forwards /api/auth/login as-is
```

Writing `proxy_pass http://backend:5000/;` would **replace** the matched
`/api/` prefix, so `/api/auth/login` would arrive at the backend as
`/auth/login`. Every backend route is mounted under `/api`, so that silently
breaks the entire app with 404s. This is the single easiest way to break this
deploy.

## Build flags: why `NODE_OPTIONS` is set in `package.json`

The `build` script sets:

```
--openssl-legacy-provider        react-scripts 5 (webpack 5) hashes with md4,
                                which OpenSSL 3 removed; without this the build
                                dies with ERR_OSSL_EVP_UNSUPPORTED on Node 17+
--max-old-space-size=4096        this bundle is large enough to exhaust node's
                                default heap on constrained runners, failing
                                with "DataCloneError: Data cannot be cloned,
                                out of memory" inside jest-worker
```

It lives in the npm script rather than only in `vercel.json` so that local
builds, CI and Docker all get identical flags. `vercel.json` still sets
`CI=false` and `GENERATE_SOURCEMAP=false` — `CI=false` because Vercel defaults
`CI=true`, and react-scripts then treats **any** lint warning as a build error,
which fails the deploy on pre-existing unrelated warnings.

Node is pinned to 24 in **three** places that must agree: `package.json`
`engines`, `.nvmrc`, and the Dockerfile base image. Vercel rejects `20.x` as
discontinued, so all three move together.

## Caching

| Path                      | Policy                            |
| ------------------------- | --------------------------------- |
| `/static/*`, hashed files | `max-age=31536000, immutable`     |
| `/index.html`             | `no-cache, no-store`              |
| `/sw.js`, `/manifest.json`| `no-cache, no-store`              |

The HTML shell and the service worker must never be cached, or a deploy never
reaches users.

## Pre-flight check

`npm run verify:api` proves the frontend can actually reach the backend and that
the backend's CORS allowlist admits this frontend. Run it before pushing, and
again against the deployed URL afterwards:

```bash
npm run verify:api

# against production:
VERIFY_API_URL=https://wa-api.madhuratech.com/api/health \
VERIFY_SITE_URL=https://<your-vercel-domain> \
npm run verify:api
```

Exit code 0 means the whole chain is wired; exit 1 tells you which link broke.
