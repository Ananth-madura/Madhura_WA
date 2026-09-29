# Whatsapp_CRM — standalone WhatsApp service (MOVED out of MADHURA_CRM)

Independent project at `Whatsapp_CRM/` with its own `backend/` (Express + Socket.IO)
and `frontend/` (React). The CRM no longer contains WhatsApp code (see strip notes
in the parent repo).

## Quick start

### 0. New device / fresh clone (recommended)
```bat
git clone <repo-url>
cd Whatsapp_CRM
start_normal.bat
```
That's it. The launcher automatically: finds your MySQL root password
(asks once if needed), writes `backend/.env`, creates the `achme_wa`
database, installs dependencies, seeds all tables + the admin account, and
waits for the backend to turn healthy. Then log in with:

| | |
|---|---|
| Email | `admin@madhuratech.com` |
| Password | `admin@123` |

Works on any Windows PC with Node.js LTS + MySQL running — no manual DB work.

### 1. Database — clone the CRM database once (alternative, keeps old CRM data)
```sql
-- full clone (keeps users table for login + CRM tables the WA schedulers read)
mysqldump -u root -p achme > achme_full.sql
mysql -u root -p -e "CREATE DATABASE achme_wa CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
mysql -u root -p achme_wa < achme_full.sql
```
`wa_*` tables self-heal on boot via `services/waDatabase.ensureWATables()`.

### 2. Backend
```bash
cd Whatsapp_CRM/backend
cp .env.example .env        # set DB_* (achme_wa), JWT_SECRET (= CRM secret initially), WA_* keys
npm install
npm start                   # → http://0.0.0.0:5001, GET /health
```

### 3. Frontend
```bash
cd Whatsapp_CRM/frontend
cp .env.example .env        # REACT_APP_API_URL=http://localhost:5001 (dev default already does this)
npm install
npm start                   # → http://localhost:3001, login, /whatsapp inbox
```

### 4. Move the live session (only ONE engine may hold it)
Stop the CRM backend, move `../whatsapp-sessions/` + `backend/uploads/wa-media/`
into `Whatsapp_CRM/`, then start this backend. Re-scan QR at `/whatsapp/accounts`
if the session doesn't restore.

## Ports (run side-by-side with the CRM)
| | CRM | Whatsapp_CRM |
|---|---|---|
| backend | 5000 / DB `achme` | 5001 / DB `achme_wa` |
| frontend | 3000 | 3001 |

## What's inside
- `backend/routes/` — `whatsappRoutes`, 13× `wa*Routes`, `authRoutes` (login plane only)
- `backend/services/` — session engine, Cloud API, campaign/automation/flow/AI engines, schedulers, queue
- `backend/config/database.js`, `backendutil/{cryptoHelper,otp,sendSms,emailConfig,pushSender}`,
  `middleware/{authMiddleware,waRateLimiter}`, `sockets/{chatsockets,notifications}` —
  **duplicated** from the CRM (see divergence note)
- `frontend/src/pages/whatsapp*.jsx` (11) + 7 WA components + `config/`, `socket/`, slim `auth/` + `layout/WALayout`
- `POST /send-menu` trigger + `GET /health`

## ⚠️ DIVERGENCE NOTE (your "keep direct imports" choice)
To keep every `require()` working with zero refactor, shared CRM files were
**copied** here (auth, database, sockets, crypto). The two projects now evolve
independently — a fix to `middleware/authMiddleware.js` in one will NOT appear
in the other. Recommended follow-up: replace CRM-table reads + `crmEventBus`
with an HTTP webhook bridge (`CRM --POST--> Whatsapp_CRM /send-menu`).

## Stale-snapshot warning (your "duplicate full DB" choice)
`achme_wa` is a one-time clone. WA schedulers read CRM tables
(`clientinvoices`, `telecalls`, `walkins`, `fields`, `quotations`, `contracts`,
`users`) from the **clone**, which goes stale. Re-sync or migrate to the webhook
bridge if you need live CRM data.
