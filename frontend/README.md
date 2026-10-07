# Madhura WhatsApp CRM — Frontend

React client for the Madhura WhatsApp CRM. This repository is the **frontend
only**; the backend (Express + MySQL + WhatsApp engines) lives in
[`Madhura-wa-backend`](https://github.com/madhuratech/Madhura-wa-backend).

## What it does

The WhatsApp side of the CRM: live chat inbox with QR pairing, contacts,
templates, contact groups, bulk campaigns, event-driven automations, payment
reminders, chatbot flows, analytics, and engine account management — all tied to
the CRM records the team already uses.

The core idea is a loop in both directions: a CRM record change (invoice,
quotation, AMC contract, walk-in) fires a WhatsApp message with buttons
attached, and the customer's tap resolves back into a CRM update.

## Stack

- React 19 + React Router 7
- Create React App 5 (react-scripts), Tailwind CSS 3
- lucide-react icons, Recharts, Socket.IO client, qrcode.react

## Local development

```bash
npm ci
cp .env.example .env      # point REACT_APP_API_URL at your local backend
npm start                 # http://localhost:3001
```

The dev server proxies nothing: in development `src/config/index.js` builds the
API origin from `REACT_APP_API_URL` (default `http://<host>:5001`).

## Deploy

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** — it covers both supported targets
(Vercel and Docker + nginx), the required environment variables, the rewrite
layout, and the two configuration mistakes that silently break the whole app.

Quick version:

```bash
npm ci
npm run build     # -> build/
```

## Pre-flight

```bash
npm run verify:api
```

Proves the frontend can reach the backend and that the backend's CORS allowlist
admits this frontend. Run it before pushing and again against the deployed URL.

## Notes

- `design.md` is the locked design system. Read it before changing any UI; it is
  the source of truth for tokens, type, spacing and motion.
- Node is pinned to 24 in `package.json` `engines`, `.nvmrc`, and the Dockerfile
  base image. All three must agree. (Vercel rejects 20.x as discontinued.)
- `vercel.json` is strict JSON with no comments — JSON has no comment syntax, so
  a `//` line there fails the deploy at config parse.
