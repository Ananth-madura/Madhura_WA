# Madhura WhatsApp CRM — Marketing Site Plan

**Deliverable:** a complete, build-ready plan for the public marketing website.
**Scope:** information architecture, page-by-page content, conversion psychology, copy deck, design system, CTA matrix, technical implementation, legal page outlines, build order.

**Status of every number in this document:** anything marked ⚠️ is an **assumption that a human must confirm** before it ships. Marketing claims that cannot be evidenced are liabilities, not features — the psychology section explains why, repeatedly, and it is not negotiable.

---

## 0. Ground truth (read before designing anything)

Everything in this plan is built from what actually exists in `D:\Whatsapp_CRM`, not from a generic SaaS template.

### 0.1 Real product capabilities (safe to market)

| Module | What is genuinely there |
|---|---|
| Live inbox | WhatsApp inbox in-app, real-time via Socket.IO, QR pairing |
| Accounts | QR scan, phone-pairing code, or Meta Cloud API connection |
| Contacts & groups | Contacts resolve to client records; segmentation into groups reused across campaigns/automations |
| Campaigns | Bulk send to group or saved list, live delivery + failure tracking, one-click stop |
| Templates | WhatsApp template lifecycle management |
| Automations | Trigger flows from CRM events: invoice created, quotation sent, payment received |
| Flow builder | Visual canvas — buttons, lists, delays, conditional branches, per-contact run history |
| Reminders | Payment-due nudges with interactive buttons (Pay now/UPI, Send PDF, Call accounts) |
| Analytics | Message volume, delivery, campaign performance |
| Roles | Admin / sub-admin / employee. **Employee accounts are created by an admin — there are no open self-serve signups** |
| Resilience | Retry system, queue, audit log, AI fallback, human handoff |
| CRM bridge | Event bus ingest (`/api/v1`, `/api/crm`), live CRM lookup, webhook in/out, REST API |

### 0.2 Stack reality (changes several recommendations)

| Assumption often made | Reality in this repo | What it changes |
|---|---|---|
| Vite | **Create React App 5.0.1** (`react-scripts`), Tailwind **3.4.19** | Code-splitting must use `React.lazy` + `Suspense`. No Vite `manualChunks`. |
| Modern bundle | **One 1454 KB JS bundle**, zero code-splitting | LCP < 2.0 s is impossible until routes are lazy-split. This is the single highest-value fix. |
| Multi-page SEO works | `public/index.html` has one hardcoded `<title>`; nginx does `try_files /index.html` | Crawlers see *one* document for all marketing routes. **Prerender is mandatory** for legal/pricing/blog. |
| `/signup` is signup | It is `POST /api/auth/request-access` → requires `emp_id`, writes to `admin_notifications`, creates no user | The funnel is **Demo / Access Request**, not "start free trial". Every CTA reflects this. |
| Unknown URLs 404 | `App.js` catch-all is `<Navigate to="/whatsapp">` | An unregistered marketing URL silently dumps visitors into an auth redirect. Register all routes **before** `*`, and make `*` a real 404. |
| Marketing is cheap to serve | `src/index.js` imports `socket.js`, which opens **two persistent WebSockets** at module scope | Every marketing visitor holds 2 open sockets to `:5001`. Move the import into `WALayout`. |
| SW handles offline fine | `public/sw.js` caches `/api/*` and `navigate` requests into CacheStorage | PII from marketing forms lands in CacheStorage — a DPDP/GDPR problem. Scope the SW to app routes only. |
| App is not crawlable | `robots.txt` is allow-all | The whole authed app is indexable today. Fix at launch. |
| Dark mode exists | `darkMode: 'class'` is set but no `.dark` class is ever applied | Dark mode is **net-new work**, not a config flip. Ship light-only in Phase 1 if needed. |
| Consent survives logout | `AuthContext.logout()` clears `localStorage` **and** `sessionStorage` | Consent state must live in a first-party cookie. |
| Existing `.lp-*` CSS is throwaway | `index.css:2042–2508` has a landed `.lp-*` landing layer with real tokens (navy `#202C52`, shell `#050E2F`, yellow `#FCBD16`, Poppins/Inter) | **Reuse, don't rewrite.** Extend with a `--mk-*` namespace. |
| `whatsappFlowBuilder.jsx` is the builder | It is a 0.2 KB stub, not routed. The real canvas is inside `whatsappFlows.jsx` at `/whatsapp/flows/build` | Capture screenshots from the real route. Delete or wire the stub. |
| Design system covers marketing | `design.md` states "Marketing pages: n/a" | Phase 1 must **amend `design.md`** before page work, or every page fights the "locked" contract. |
| One product, one origin | Auth/socket/crypto code is **duplicated** from the parent CRM; the core CRM lives at `crm.madhuratech.com` | `/integrations` must be framed as "Madhura CRM **+** the WhatsApp module", not "one product". |

### 0.3 Known risks that must be resolved before the security page ships

1. ⚠️ **`/uploads/**` is served by `express.static` with no authentication.** Invoice PDFs and brochures are reachable by anyone with the URL. The URL leaks whenever a file is sent to a WhatsApp contact. Mitigated in the nginx config with `Cache-Control: private, no-store` and `X-Robots-Tag: noindex`, but not eliminated. **Decide deliberately before publishing a `/security` page** — see `DEPLOYMENT.md` §10 for the three options and their trade-offs.
2. ✅ **Route authorisation is sound.** An earlier version of this document claimed a dozen `/api/wa/*` mounts were reachable without a credential because they are mounted without `verifyToken`. **That was wrong** — they are mounted bare, but every handler inside applies `verifyToken` itself, and `externalCrmRoutes` is behind the mount. Prove it with `npm run audit:auth`: **237 of 237 handlers authorised, 9 public by design** (login/OTP/registration and the Meta webhook). Do not write copy implying the API is unauthenticated.
3. ⚠️ CORS is now allowlisted (`ALLOWED_ORIGINS`, fails closed in production). Verify with `npm run audit:auth` for routes and `npm run verify:api` for the origin policy — including the negative check that a stranger's origin is *not* reflected.
4. ⚠️ Socket.IO now requires a JWT on every handshake and authorises each room join against token claims. Prove it with `npm run test:socket`.
5. ⚠️ **No product screenshots exist** in `public/`. Capture is a prerequisite task, not a nice-to-have.
6. ⚠️ **No pricing exists** anywhere in the repo. Until the business supplies real prices, `/pricing` ships in a `contact` state with **no schema `offers`**.
7. ⚠️ **No testimonials exist.** Fabricated quotes are the fastest way to lose a technical gatekeeper who reverse-engineers the claim. Empty state is the default; §8.5 defines it.
8. ⚠️ **The main CRM runs on a separate origin** (`crm.madhuratech.com`) with duplicated auth, socket and crypto code. `/integrations` and `/about` must state this plainly rather than implying one product.

---

## 1. Positioning and the psychological spine

### 1.1 The diagnosis (this drives every decision below)

The buyer is not shopping for a CRM. They are shopping for **relief from an operational anxiety that WhatsApp itself created.** WhatsApp is simultaneously:

- their **highest-intent channel** (rich, personal, high reply rates),
- their **only customer memory** (it lives in one phone, in one person),
- and their **largest uncontrolled risk** (account restriction, message quota, staff leaving with the chat history).

A "CRM" in their world means *more software*. What they need is **a second brain that doesn't steal the phone.**

> **We are not selling software adoption. We are selling the transfer of one person's private anxiety onto a system — without losing the phone.**

**Status-Quo Bias is therefore the dominant force on this site**, not one model among many. That single fact explains the entire structural choice below: every page argues *"keep WhatsApp, add a screen"* rather than *"migrate to us"*.

### 1.2 JTBD statement (customer voice)

> **When** customers message me on WhatsApp all day and I'm manually juggling quotes, follow-ups and payment reminders,
> **I want to** stop losing those conversations inside one person's phone and get follow-ups to happen without me,
> **so I can** get paid faster and stop working nights chasing invoices,
> **without** giving up WhatsApp — because that is where my business already lives.

**Competitive framing (Christensen):** they did not hire a CRM. They hired **"make sure no lead goes cold and I get paid without chasing."**

### 1.3 The five beliefs the site must install

| Belief to install | Mechanism | Proof obligation | Where it is carried |
|---|---|---|---|
| "My number stays mine and stays safe" | Risk Reversal + Authority Bias | Official-pairing-only statement, ban-risk FAQ, `/security` | Hero trust chips, FAQ #1–2, security section, footer |
| "The transition costs me almost nothing" | Activation Energy + Foot-in-the-Door | Setup-time proof, "your chats stay in WhatsApp", 3 steps | How-it-works, hero, onboarding email |
| "My team will actually use this" | Processing Fluency + Default Effect | Real inbox screenshot, no-training claim, role defaults | Feature block 1, roles section |
| "This pays for itself fast" | Mental Accounting + Loss Aversion | ₹-per-customer framing, "one recovered lead" | Pricing, use cases, ROI line |
| "People like me already run this" | Unity + Pratfall Effect | Same-industry, same-city, same-size references | Social strip, testimonials, use-case verticals |

### 1.4 Outcome-led vs feature-led headline rules

> **Every H3 must contain a verb the customer performs, not a noun we built.**

| Feature area | ❌ Feature-led | ✅ Outcome-led |
|---|---|---|
| Shared inbox | "Unified shared inbox with QR pairing" | **Everyone answers from one inbox. Your number never moves.** |
| Contacts & groups | "Contact management with segmentation" | **Stop re-asking what they told you last week.** |
| Bulk campaigns | "Bulk broadcast with delivery tracking" | **Send the same offer to 300 customers — then see exactly who got it.** |
| Payment reminders | "Automated payment reminder workflows" | **Get paid without asking twice.** |
| Automations | "Event-based workflow automation" | **Send the invoice. The follow-up goes out by itself.** |
| Flow builder | "Visual chatbot flow editor" | **Write your best reply once. Let it handle the boring ones.** |
| Analytics | "Delivery and engagement analytics" | **Stop guessing which campaign worked.** |
| Roles & access | "Role-based permission system" | **Your team gets exactly the access they need. Nothing more.** |

---

## 2. Audience and belief mapping

> Structural note: **the owner is the buyer, the ops/sales lead is the champion, and admin/IT is the veto.** In Indian SMB SaaS above roughly ₹10k/month, technical gatekeepers routinely kill products on security and integration grounds *after* commercial enthusiasm is established. Design the admin content early; do not bury it.

### 2.1 Owner / Founder

| | |
|---|---|
| Role | Budget holder, final yes/no. Often also the person working the inbox on day one. |
| Current belief | "WhatsApp is where my customers already are. Any CRM is for big companies with 200 people. Software costs money and time and my team won't use it." |
| Unsaid sub-belief | "I started this business so I wouldn't be managed. Introducing a system feels like going back under someone." |
| Blocking objections | 1. **"Will WhatsApp restrict my number?"** (existential — nothing else gets evaluated) 2. "My team will mess this up / won't bother" 3. "I already pay for WhatsApp Business — do I stop using it?" |
| Models | Status-Quo Bias (dominant), Loss Aversion, Endowment Effect, Risk Reversal, Unity |
| Resolving copy | "**Keep WhatsApp. Keep your number. Just add a second screen.** Madhura runs *alongside* WhatsApp Business — your chats, contacts and number stay exactly where they are. Nothing moves." · "**You still answer the messages. That's the job.** Madhura handles the parts you hate: chasing payments, sending the same offer to 300 people, and remembering who asked for what." |
| Placement | Hero sub-line; a dedicated 3-panel objection strip immediately after hero; FAQ #1–3; final CTA reassurance line |

### 2.2 Sales Head (champion)

| | |
|---|---|
| Current belief | "My leads go cold because nobody follows up. I want automatic follow-ups — but generic auto-replies sound like a robot and customers will think my brand is fake." |
| Unsaid sub-belief | "If the founder reads what the bot sent under my name, I get blamed. I need to see what went out." |
| Blocking objections | 1. **"Will the bot sound like a robot and embarrass us?"** 2. "I can't see which messages actually reached the customer" 3. "I need to send the same offer to 300 people without looking like a spam account" |
| Models | Processing Fluency, Specificity, Cognitive Load, Mere Exposure, Zeigark |
| Resolving copy | "**Write the reply like a human. Once.** Type the exact reply you want — tone, greeting, discount, all of it. It reads like you wrote it, because you did." · "**Every message Madhura sends shows up with your name on it, in your inbox, with a timestamp.** Nothing goes out invisibly." |
| Placement | Feature blocks 2/3/6; downloadable "sales head pitch sheet" (Reciprocity + Foot-in-the-Door); FAQ #5 |

### 2.3 Ops / Support Lead (operational conscience)

| | |
|---|---|
| Current belief | "The owner wants automation. Automation means losing control. The day a bot sends the wrong thing, it's my name on the escalation." |
| Unsaid sub-belief | "If I hand over the numbers and a campaign fires at 9pm to a bad list, I lose my job." |
| Blocking objections | 1. **"Does this replace WhatsApp Business / our workflow?"** (Endowment Effect) 2. "Who can send messages, and can my team send to the wrong person?" 3. "What happens if the internet dies mid-quotation?" |
| Models | Status-Quo Bias, Endowment Effect, Loss Aversion, Default Effect |
| Resolving copy | "**It's an add-on, not a replacement.** Keep WhatsApp Business on every phone exactly as your team uses it. Madhura is the shared layer on top." · "**Campaigns wait for you.** Nothing goes live at 3am. You schedule it, you approve it, one tap stops it — and if delivery drops, you see it before your customers do." |
| Placement | Feature block 8 (roles); how-it-works step 1; resilience band; FAQ #7/#9 |

### 2.4 Admin / IT (veto holder)

| | |
|---|---|
| Current belief | "Another SaaS = another lock-in, another export problem. And 'WhatsApp automation' sounds exactly like the grey-market tools that get accounts restricted." |
| Unsaid sub-belief | "Someone will ask me one day why I approved this, and I need a document, not a salesperson." |
| Blocking objections | 1. **"Is this WhatsApp-compliant or is it an unofficial tool?"** 2. "Where is my data stored, who can see it, can I get all of it out?" 3. "Can I connect my number without breaking WhatsApp Business?" |
| Models | Authority Bias, Risk Reversal, Precision Bias, Uncertainty Reduction, Accountability |
| Resolving copy | "**Official paths only.** QR pairing, pairing code, or Meta Cloud API — the three sanctioned methods. We do not run unofficial clients and we do not automate the WhatsApp app by screen-scraping it." · "**Your data is yours.** Export the full dataset — contacts, conversations, campaign history — any time, without asking." · "**Connect your number in a browser tab.** Your phone stays logged into WhatsApp Business. If anything looks unfamiliar, close the tab and you've lost nothing." |
| Placement | Dedicated `/security` linked from **nav, footer and the security band**; a downloadable **Security & Compliance one-pager (PDF)** — this is the asset that closes the veto |

### 2.5 Objection severity ranking (drives FAQ order)

Deals in this category die on four words: **ban**, **number**, **replace**, **export**. Each must be answered **above the fold**, not in a footer accordion. The FAQ also answers one objection the visitor has *not yet formulated* ("Can my customer tell the difference between me and an automated reply?") — answering an unasked question builds trust out of proportion to its cost.

---

## 3. Site map and routes

### 3.1 Route table

| # | Path | Component | Stage | Lazy | Prerender | Priority |
|---|---|---|---|---|---|---|
| 1 | `/` | Home | Awareness | eager | ✅ | P1 |
| 2 | `/features` | Features | Consideration | ✅ | ✅ | P1 |
| 3 | `/pricing` | Pricing | Decision | ✅ | ✅ | P1 |
| 4 | `/how-it-works` | HowItWorks | Consideration | ✅ | ✅ | P2 |
| 5 | `/integrations` | Integrations | Consideration | ✅ | ✅ | P2 |
| 6 | `/about` | About | Consideration | ✅ | ✅ | P2 |
| 7 | `/testimonials` | Testimonials | Decision | ✅ | ✅ | P2 |
| 8 | `/blog` | Blog index | Awareness | ✅ | ✅ | P3 |
| 9 | `/blog/:slug` | BlogPost | Awareness | ✅ | ✅ | P3 |
| 10 | `/faq` | FAQ | Decision | ✅ | ✅ | P2 |
| 11 | `/contact` | Contact / demo request | Decision | ✅ | ✅ | P1 |
| 12 | `/changelog` | Changelog | Retention | ✅ | ✅ | P3 |
| 13 | `/security` | Security & Trust | Decision | ✅ | ✅ | P2 |
| 14 | `/privacy` | Privacy Policy | Legal | ✅ | ✅ **required** | P1 |
| 15 | `/terms` | Terms of Service | Legal | ✅ | ✅ **required** | P1 |
| 16 | `/cookies` | Cookie Policy | Legal | ✅ | ✅ **required** | P1 |
| 17 | `/acceptable-use` | Acceptable Use | Legal | ✅ | ✅ | P1 |
| 18 | `/dpa` | Data Processing | Legal | ✅ | ✅ **required** | P2 |
| 19 | `/access-requested` | Thank you | — | ✅ | `noindex` | P1 |
| 20 | `/404` and `*` | NotFound | — | ✅ | — | P1 |

Unchanged: `/login`, `/signup`, `/whatsapp/*`, and the back-compat redirects.

### 3.2 Routing shape

Mount a **parallel branch** registered **before** the `*` catch-all. Do not nest under `/whatsapp` — that would inherit `RequireAuth` + `WALayout`.

```
<Route path="/"        element={<PublicOnly><Home/></PublicOnly>} />   {/* signed-in staff skip marketing */}
<Route path="/login"   element={<PublicOnly><Login/></PublicOnly>} />
<Route path="/signup"  element={<PublicOnly><Signup/></PublicOnly>} />

<Route element={<MarketingLayout/>}>
  <Route path="features" ... />   <Route path="pricing" ... />
  <Route path="how-it-works" ... /><Route path="integrations" ... />
  <Route path="about" ... />      <Route path="testimonials" ... />
  <Route path="blog" ... />       <Route path="blog/:slug" ... />
  <Route path="faq" ... />        <Route path="contact" ... />
  <Route path="changelog" ... />  <Route path="security" ... />
  <Route path="privacy" ... />    <Route path="terms" ... />
  <Route path="cookies" ... />    <Route path="acceptable-use" ... />
  <Route path="dpa" ... />        <Route path="access-requested" ... />
  <Route path="*" element={<NotFound/>} />
</Route>
```

Rules:
- Every marketing child is `React.lazy`. Home is the only eager marketing import.
- `*` becomes a **real 404**, not a redirect to `/whatsapp`.
- Keep `<PublicOnly>` on `/` only (signed-in staff should never be forced through marketing); drop it everywhere else so internal sharing of `/pricing` works.

### 3.3 Hard separation from `WALayout`

| Concern | `WALayout` (app) | `MarketingLayout` |
|---|---|---|
| Scroll owner | `<main>` is a flex child with its own `overflow-y-auto` | Document scroll. Never copy the `wa-dvh` / `overflow-hidden` shell. |
| Global body class | Sets `wa-chat-active` on `<html>` and `<body>` | Must never set these — a leaked class breaks marketing pages. |
| Sockets | Owns `socket.js` (moved out of `index.js`) | **No socket import, ever.** |
| Tokens | `hl-*` on navy shell | `mk-*` on paper |
| Auth | `RequireAuth` | none; optional `useAuth()` for an "Open app" affordance |

### 3.4 Folder layout

```
src/marketing/
├── site.config.js            # nav, footer groups, social, contact, legal dates
├── MarketingLayout.jsx       # header + <main id="main"> + footer + cookie banner + scroll tracker
├── MarketingRoutes.jsx       # the <Routes> tree
├── seo/
│   ├── Seo.jsx               # title/meta/canonical/OG/Twitter (no react-helmet installed)
│   └── schema.js             # JSON-LD builders
├── components/               # Section, Button, Eyebrow, FeatureGrid, FeatureCard, SplitFeature,
│                             # ScreenshotFrame, StepTimeline, FlowBuilderDiagram, UseCaseTabs,
│                             # IndustryCard, ComparisonTable, PricingTable, PricingCard,
│                             # BillingToggle, TestimonialCard, StatBand, LogoRow, FAQAccordion,
│                             # TrustBadgeRow, SecurityPanel, CTABand, AnnouncementBar,
│                             # MarketingHeader, MarketingFooter, DemoForm, LegalPage, CookieConsent
├── content/                  # static, build-time — no DB, no API
│   ├── pricing.js  features.js  integrations.js  testimonials.js
│   ├── faq.js  changelog.js  company.js
│   └── legal/ privacy.js terms.js cookies.js acceptable-use.js dpa.js
├── blog/
│   ├── index.js              # post metadata (slug, title, date, tags, excerpt)
│   ├── <slug>.js             # one file per post — static import map
│   └── BlogPostLayout.jsx    # TOC, prose styles, share, related, Article schema
└── pages/                    # Home Features Pricing HowItWorks Integrations About
                              # Testimonials Blog BlogPost FAQ Contact Changelog Security
                              # NotFound ThankYou legal/*
```

### 3.5 `site.config.js` — single source of truth

```js
export const site = {
  name: "Madhura WhatsApp CRM",
  legalName: "Madhura Technologies",          // ⚠ confirm registered entity name
  tagline: "Run sales, service and support on WhatsApp",
  domain: "madhurawhatsappcrm.com",          // ⚠ confirm; repo only shows crm.madhuratech.com
  appUrl: "https://crm.madhuratech.com",      // core CRM — separate origin
  email: "hello@madhuratech.com",             // ⚠ confirm
  supportEmail: "support@madhuratech.com",    // ⚠ confirm
  privacyEmail: "privacy@madhuratech.com",    // ⚠ confirm
  dpoEmail: "dpo@madhuratech.com",            // ⚠ confirm — DPDP requires a named DPO
  securityEmail: "security@madhuratech.com",  // ⚠ confirm
  phone: "+91 XXXXX XXXXX",                   // ⚠ confirm
  address: { line1:"", line2:"", city:"", state:"", pin:"", country:"IN" }, // ⚠ confirm
  founded: "2024",                            // ⚠ confirm
  social: { linkedin: "…", twitter: null, youtube: null }, // ⚠ confirm
  legal: {
    jurisdiction: "India",
    courts: "Courts at Chennai, Tamil Nadu",  // ⚠ confirm
    effectiveDate: "2026-01-01",              // set at launch
    lastUpdated: { privacy:"…", terms:"…", cookies:"…", aup:"…", dpa:"…" },
  },
  analytics: { ga4: "G-XXXXXXXXXX" },         // ⚠ confirm — GA4 needs DPDP consent
};

export const nav = [
  { label: "Features",     to: "/features" },
  { label: "How it works", to: "/how-it-works" },
  { label: "Pricing",      to: "/pricing" },
  { label: "Customers",    to: "/testimonials" },
  { label: "Trust",        to: "/security" },   // unusual to put in nav — deliberate: pre-empts the admin veto
  { label: "More", children: [ Blog, Changelog, FAQ, About ] },
];

export const footerGroups = [
  { title: "Product",   links: [["Features","/features"],["How it works","/how-it-works"],["Integrations","/integrations"],["Pricing","/pricing"],["Changelog","/changelog"]] },
  { title: "Company",   links: [["About","/about"],["Customers","/testimonials"],["Contact","/contact"],["Blog","/blog"]] },
  { title: "Resources", links: [["FAQ","/faq"],["Security","/security"],["Data Processing","/dpa"],["Request access","/signup"]] },
  { title: "Legal",     links: [["Privacy Policy","/privacy"],["Terms of Service","/terms"],["Cookie Policy","/cookies"],["Acceptable Use","/acceptable-use"]] },
];
```

**Hick's Law in the config:** nav ≤ 6 top-level items. `Pricing` sits in nav (the highest-intent visitor). `Trust` is in nav specifically for the admin persona. Everything else falls under "More".

---

## 4. Design system

### 4.1 Recommended direction — **"Ledger Line"**

**Mood:** a printed operations ledger that learned to run software. Warm paper stock, ink-navy rules, tabular figures, an ember/ochre signal colour that behaves like a rubber stamp. Sections are separated by a *drawn rule*, not a colour change. Screenshots sit on the page like tipped-in plates. Nothing glows.

**Tone of voice:** *plain, precise, unhurried, accountable.*

**Why this direction wins over the alternatives:**

1. **It solves the accent problem.** The landed yellow `#FCBD16` is **1.72:1 on paper** — a graphic-only colour. It cannot carry meaning. Ember `#A65A12` (4.68:1) can carry links, emphasis and active states, and sits nowhere near WhatsApp green or SaaS blue.
2. **It gives the WhatsApp colour a legitimate home.** Screenshots are *tipped-in plates* on a paper page — caption, hairline, figure number. That framing inherently quarantines WhatsApp green inside the plate, which is what stops the site reading as an unofficial WhatsApp clone.
3. **It's an extension, not a fork.** `--mk-ink` **is** the app's `#202C52`; same Poppins, same easing, same 4-pt spacing. Marketing and product must look like one company, because the owner is comparing a screenshot on the marketing page to the app he just signed up for.

**Rejected directions:**

| Direction | Verdict |
|---|---|
| **Quiet Enterprise** (near-monochrome, blue accent, screenshot-dominant) | Fastest credible build, but cold. An Indian SMB owner deciding whether to hand over his WhatsApp number gets no warmth from it. Accent is blue, which is on the ban list. |
| **Warm Paper/Ink deepened** (exactly what's landed) | Zero migration cost, but inherits the deep-navy-hero habit (the single most common AI-landing tell) **and** has no usable accent for links or emphasis — which is precisely what the marketing pages need. |

### 4.2 Palette — light (primary spec)

| Token | Hex | oklch | Notes |
|---|---|---|---|
| `--mk-bg` | `#F7F4EE` | `oklch(96.6% 0.006 84)` | Warm paper. Page field. |
| `--mk-surface` | `#FFFDF9` | `oklch(99.2% 0.004 90)` | Cards, panels, tables. |
| `--mk-surface-2` | `#F1EDE4` | `oklch(94.0% 0.009 84)` | Recessed wells, code blocks. |
| `--mk-border` | `#E0D9CB` | `oklch(89.7% 0.012 84)` | Default 1px hairline. |
| `--mk-border-strong` | `#C9BFAD` | `oklch(80.6% 0.019 82)` | Inputs, table header underline. |
| `--mk-ink` | `#202C52` | `oklch(30.35% 0.0706 269)` | **Identical to app ink.** 12.4:1 on bg. |
| `--mk-ink-2` | `#5C6479` | `oklch(52.4% 0.028 264)` | Body secondary. 5.38:1. |
| `--mk-ink-3` | `#8A8F9E` | `oklch(63.0% 0.017 266)` | Microcopy and footnotes only. |
| `--mk-primary` | `#202C52` | — | Primary fill. |
| `--mk-primary-hover` | `#16203C` | — | |
| `--mk-primary-active` | `#0F1830` | — | Press state. |
| `--mk-on-primary` | `#FFFDF9` | — | 13.6:1. |
| `--mk-accent` | `#A65A12` | `oklch(53.5% 0.128 55)` | Ember/ochre. Text-safe at 4.68:1. |
| `--mk-accent-hover` | `#8A4A0C` | — | |
| `--mk-accent-soft` | `#F6E9D8` | `oklch(93.0% 0.035 70)` | Tinted fills, badges, zebra rows. |
| `--mk-success` | `#15803D` | — | 4.57:1. |
| `--mk-warn` | `#8A5A00` | — | 5.40:1. |
| `--mk-danger` | `#B3261E` | — | 5.95:1. |
| `--mk-focus` | `#1F6FEB` | — | 4.22:1 on surface. Ring only. |
| `--mk-shell` | `#0F1830` | — | Dark band colour. |

### 4.3 Palette — dark (`html.dark`, Phase 2)

`bg #14161C` · `surface #1B1E26` · `surface-2 #232733` · `border #2E3340` · `ink #F2F0EA` · `ink-2 #A7ADBD` · `ink-3 #767D8F` · `accent #E9A23B` · `success #4ADE80` · `warn #FBBF24` · `danger #F87171` · `focus #FFC24B`. **Primary inverts** to off-white with ink text.

⚠️ Dark mode is net-new work (no `.dark` class is ever applied today). Ship light-only in Phase 1 rather than shipping a half-done toggle.

### 4.4 WhatsApp-truth tokens — quarantined (trust + legal requirement)

| Token | Hex | Permitted use | Contrast verdict |
|---|---|---|---|
| `--mkt-wa-green` | `#25D366` | Status dot, read-tick, chat-bubble fill **inside mock UI only** | **1.98:1 on white — FAILS.** Never text, never a meaningful border, never a button fill. |
| `--mkt-wa-teal` | `#128C7E` | Outgoing bubble fill in mock chat only | **4.13:1 — FAILS AA for text.** Graphic only. |
| `--mkt-wa-teal-text` | `#0E6E62` | The **only** permitted WhatsApp-green text/icon colour | 6.13:1 ✓ |
| `--mkt-wa-bubble-in` | `#E9EDEF` | Incoming mock bubble | |
| `--mkt-wa-bubble-out` | `#DCF8C6` | Outgoing mock bubble | |

> **Budget rule:** WhatsApp-derived colour is capped at **≤2% of any viewport**, only ever inside a `ScreenshotFrame` or a "connected account" badge. Page brand = ink navy + ember ochre.

### 4.5 Typography

- **Display:** Poppins 600/700 — *retained deliberately*. Already loaded app-wide, and it is the font in every product screenshot we will ship. Swapping it would create marketing↔product visual drift.
- **Body:** Inter 400/500/600.
- **Editorial accent:** **Source Serif 4** — pull-quotes and the About page only, max 3 per site. This one addition is what lifts the site off "template" without a font overhaul.
- **Mono:** JetBrains Mono 500 — invoice numbers, timestamps, event keys, figure captions.

| Role | Family/weight | Size | LH | Tracking | Max width |
|---|---|---|---|---|---|
| H1 hero | Poppins 700 | `clamp(2.125rem, 1.15rem + 3.9vw, 3.5rem)` | 1.08 | −0.025em | **18ch** |
| H1 sub-page | Poppins 700 | `clamp(1.875rem, 1.2rem + 2.6vw, 2.75rem)` | 1.12 | −0.022em | 20ch |
| H2 | Poppins 600 | `clamp(1.5rem, 1.2rem + 1.2vw, 2rem)` | 1.18 | −0.018em | 22ch |
| H3 | Poppins 600 | 1.25rem | 1.3 | −0.012em | 32ch |
| H4 card | Poppins 600 | 1.0625rem | 1.4 | −0.008em | 36ch |
| Lede | Inter 400 | `clamp(1.0625rem, 1rem + 0.35vw, 1.1875rem)` | 1.6 | 0 | 54ch |
| Body | Inter 400 | 1rem | 1.65 | 0 | **64ch** |
| Body small | Inter 400 | 0.9375rem | 1.6 | 0 | 68ch |
| UI / button | Inter 600 | 0.9375rem | 1.4 | −0.005em | — |
| Eyebrow | Inter 600 | 0.6875rem | 1.2 | **0.1em** uppercase | — |
| Caption | Inter 400 | 0.8125rem | 1.5 | 0.005em | — |
| Micro / legal | Inter 400 | 0.75rem | 1.5 | 0.01em | 80ch |
| Figure | JetBrains Mono 500 | 0.9375rem | 1.2 | tabular-nums | — |
| Pull-quote | Source Serif 4 | 1.375rem | 1.45 | −0.01em | 40ch |
| Stat numeral | Poppins 700 | `clamp(2rem, 1.4rem + 2vw, 2.75rem)` | 1 | −0.03em | — |

### 4.6 Spacing, radius, borders, elevation

**Spacing (4-pt base, harmonised with the existing `--space-*`):** `4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96 / 128 / 160px`.

**Section padding-block:** `<640px: 56/72px` · `640–1023px: 72/96px` · `≥1024px: 96/128px`. Sections are **never separated by margin**; each owns its padding, with hairline rules *inside* the boundary.

**Radius — deliberately short.** `rounded-2xl` / `rounded-3xl` are banned in marketing.

| Token | Value | Use |
|---|---|---|
| `--mk-r-xs` | 2px | Rule caps |
| `--mk-r-sm` | 4px | Badges, pills, table chips |
| `--mk-r-md` | 6px | Inputs, small buttons |
| `--mk-r-lg` | 10px | Buttons, feature cards |
| `--mk-r-xl` | 14px | Screenshot frames, pricing cards, modals |
| `--mk-r-pill` | 999px | Toggles only — never cards |

**Borders:** 1px `--mk-border` for 95% of rules. 2px for the scrolled nav rule, the step connector and the active toggle thumb. 3px only for the active tab underline. **No 4px+ borders anywhere.**

**Elevation:**

| Token | Value | Use |
|---|---|---|
| `--mk-e0` | none + 1px border | Default card. The workhorse. |
| `--mk-e1` | `0 1px 2px rgba(32,44,82,.04)` | Card hover |
| `--mk-e2` | `0 4px 14px rgba(32,44,82,.08)` | Screenshot frames, scrolled nav |
| `--mk-e3` | `0 16px 40px rgba(15,24,48,.16)` | Dropdown, drawer, cookie banner |

> **Shadow budget: 2 elevated objects per viewport maximum.** No stacked float.

### 4.7 Layout system

| Container | Max width | Use |
|---|---|---|
| `--mk-container` | **1180px** | Default. Matches the landed `.lp-shell` — one container, no drift. |
| `--mk-container-wide` | 1320px | Comparison table, flow diagram, full-bleed bands |
| `--mk-container-prose` | 720px | Blog posts, legal pages, changelog |
| `--mk-container-narrow` | 560px | Forms, FAQ answers, thank-you |

Gutter `clamp(20px, 4vw, 40px)`. Grid: `repeat(12, minmax(0, 1fr))`, `column-gap: 32px` — **always `minmax(0,1fr)`**, never bare `1fr` (this codebase already documents the `min-width:auto` overflow failure).

Presets: asymmetric hero `1-7 / 8-12` · reverse split `1-6 / 7-12` · section head `1-6` · feature grid 4-up (`1-3`,`4-6`,`7-9`,`10-12`) · 3-up (`1-4`,`5-8`,`9-12`) · centred band `3-10`.

**Alignment rule:** left-aligned is the default for **all** body copy and headings. Centred is permitted only for: sub-page H1 mastheads, the closing CTA band, and empty states (404 / thank-you / no results). **Max 2 centred sections per page.**

**Background alternation cycle** — never two identical adjacent backgrounds:

```
1. bg          (#F7F4EE warm paper — default)
2. surface     (#FFFDF9 raised, hairline top+bottom)
3. bg
4. shell       (#0F1830 deep ink — AT MOST 2 per page)
5. surface-2   (#F1EDE4 recessed well)
→ repeat
```

`shell` appears **exactly twice** per long page: hero + closing CTA. Legal pages get zero `shell` bands inside content.

**Line length:** lede 54ch · body 64ch · card body 52ch · FAQ answer 68ch · table cell 34ch · pull-quote 40ch. Enforce with `max-width: <n>ch`, never with `<br>`.

### 4.8 Responsive behaviour

| BP | Range | What changes |
|---|---|---|
| Base | 320–639 | Gutter 20px. Hero stacks, media `order:2`. All grids → 1 col. Nav → drawer. Section padding 56px. H1 → 34px. Step timeline vertical. Comparison table → `.mk-scroll-x` with `min-width:640px`. Buttons full-width in stacked CTA rows. |
| sm | ≥640 | Gutter 24px. 2-col grids. Section padding 72px. |
| md | ≥768 | 3-col grids. Gutter 32px. Hero **still stacks** until 900px. |
| lg | ≥1024 | **Hero goes 7/5 asymmetric.** 4-col feature grid. All splits side-by-side. Nav → horizontal, drawer off. Section padding 96px. Pricing 3-up. Sticky nav gains scrolled state. |
| xl | ≥1280 | Container caps at 1180px. Section padding 128px. Flow diagram gains its annotation column. No layout change — just air. |
| Landscape phone | `max-height:520px` | Drawers/modals scroll; hero media compresses to a single bubble. |

---

## 5. Anti-slop build gate

This is a **merge gate**, not a suggestion. Any of column 1 in a PR blocks the build.

| # | Banned | Why it fails here | Required replacement |
|---|---|---|---|
| 1 | Purple→blue gradient hero | Universal "AI SaaS" signal; reads unverified | Flat paper field, 1px rule under the eyebrow, ink H1 with **one** ember phrase |
| 2 | Gradient buttons (`#6366F1 → #A855F7`) | Same, plus fails a11y | Solid `--mk-primary`, 6px radius |
| 3 | Glassmorphism cards | Costly, blurry, illegible, overused | Opaque surface + 1px border. `backdrop-blur` only on scrolled nav and the mobile drawer |
| 4 | Three-icon feature row | Truncates an 8-module product into a brochure | 8-card grid 4×2 with one featured 2-col card — **asymmetric** |
| 5 | Everything centred | Template tell; no hierarchy | Left-aligned default; max 2 centred sections per page |
| 6 | Emoji as icons | Unprofessional for a tool holding a customer list | Lucide 18px `stroke-width:1.75` in a 32px `--mk-accent-soft` square |
| 7 | "Trusted by 10,000+ companies" with no logos | Unverifiable claim = trust liability, exactly what this product sells against | Real named logos only. Below 3 → `TrustBadgeRow`. Empty state is the default |
| 8 | Floating 3D blobs / mesh gradients | Loudest 2023–25 tell | Hairlines, a 4px ember tick before section labels, CSS-art ledger grid at 4% ink |
| 9 | Fake dashboard screenshots with lorem numbers | The owner **knows** what his own invoice list looks like | Real captures only (§6.8). If no capture exists, ship a diagram instead — **never a mockup** |
| 10 | `rounded-2xl` everywhere | 2021 SaaS; flattens hierarchy | Radius carries rank: 6 / 10 / 14 only |
| 11 | Card inside card inside card | Visual mush, +40% DOM | **Max one** card level. Nested content uses a `--mk-surface-2` well with a 1px left rule |
| 12 | Neon glow / coloured shadow on dark | Game-UI look | On shell: `--mk-e-inset` + `--mk-e2`. Never a coloured glow |
| 13 | Identical icon tiles above every card | Eight identical tiles = wallpaper | Only 3 of 8 feature cards get an icon; the rest use a 1px top rule + a mono module code (`F·02`) |
| 14 | Inter-only typography | Uninformed default | Source Serif 4 pull-quotes (max 3 site-wide) |
| 15 | "Revolutionise / supercharge / seamless / unlock" | Template | Concrete verbs. CTA ≤ 3 words, verb-first, no intensifiers |
| 16 | Fake ★★★★★ rating widget | Unverifiable | Only real, attributable, quoted reviews with name + role + company |
| 17 | Autoplaying hero video | Owner wants to read, not wait | Signature interaction is a **silent ≤9s self-typing chat**. No video in the hero |
| 18 | Gradient CTA band | Loudest close on the quietest page | Flat shell band, ember rule, one H2 + one sentence + one button |
| 19 | `!important` fights to beat utilities | Already bit this codebase | All `.mk-*` in `@layer components` |
| 20 | Placeholder prices / "Most popular" on an untargeted tier | Pricing-integrity failure | `priceState: 'known' \| 'contact'`. A missing price is a build error, never `₹0` |

---

## 6. Component specs

### 6.1 Button — `.mk-btn`

**Anatomy:** `[icon-left] <label> [icon-right]` + optional `sub` line (pricing/CTA bands only).
**Variants:** `primary` · `accent` · `secondary` (transparent + 1px strong border) · `ghost` · `link` (always 2px underline, offset 2) · `on-shell` · `danger-ghost`.

| State | Treatment |
|---|---|
| hover | `translateY(-1px)` + `--mk-e1`; border → ink for secondary. No transform on link/ghost |
| active | `translateY(1px)` |
| focus-visible | `outline: 2px solid var(--mk-focus); outline-offset: 2px` — **instant, never animated** |
| disabled | `opacity:.5; cursor:not-allowed` — submittable-but-inert, matching the landed app buttons |
| loading | Label → 14px spinner, `aria-busy="true"`, width frozen via pre-measured `min-width` |

**Size:** sm h36/px14/13px · md h44/px20/15px · lg h52/px26/16px. Icon 16–18px, `gap:8px`. **≥44px on coarse pointers** (`@media (hover:none)`). `white-space:normal` + `overflow-wrap:anywhere` below 640px — inherited lesson from the existing landing CSS.

### 6.2 AnnouncementBar — `.mk-announce`

`[6px dot] [text] ["Read →"] [dismiss ×]`. Variants `default` · `accent` · `urgent` (security incidents only). States: default · hover · focus-visible · dismissed (localStorage, 30-day TTL) · **empty → component does not render, never an empty 40px bar**.

**Psychology:** Mere Exposure × Von Restorff × Zeigarnik. The bar's job is not to inform — it plants one *specific, slightly unfinished* fact. **One number or one fact, never adjectives.** 3 rotating items, rotation pauses on hover, first item stable for the full 30-day window (rotation increases distinctiveness but destroys consistency). Never the only place information exists.

### 6.3 Navbar — `.mk-nav`

`[wordmark] [links] [Sign in] [primary CTA] [☰ <lg]`. Height 64px desktop / 56px mobile. Transparent → `--mk-surface` + border + `--mk-e2` after 24px scroll. Link hover: ink + 2px ember underline offset 6px. Active route: ink 600 + ember underline.

**Mobile drawer:** right sheet `min(88vw, 380px)`, `--mk-e3`, links 17px with 1px dividers, each ≥48px, CTA pinned above `env(safe-area-inset-bottom)`, `role="dialog" aria-modal="true"`, focus trap, `Esc` closes, body scroll locked, focus restored on close.

> Reuse the wordmark `.hl-wordmark` **unchanged**. Marketing and app must not diverge here.

### 6.4 Hero — `.mk-hero`

`eyebrow → H1 (2 lines max, one ember phrase) → lede (54ch) → [primary][secondary] → guarantee list (3, hairline-divided)`. Right column: a `ScreenshotFrame` holding the self-typing chat, captioned `Fig. 01 — Shared inbox, invoice thread.`

Headline direction: **verb + channel + object.** The landed `Run sales, service and support on WhatsApp` is correct and stays.

**Psychology:** Processing Fluency is the load-bearing effect here, not aesthetics. Fluent text is judged more true and its claims more believed even when the content is identical. Sentence case beats ALL CAPS; H1 ≤ 9 words at 18ch max — **a 6-line wrap kills scanning**.

### 6.5 ScreenshotFrame — `.mk-shot` ⚠ highest-leverage component

This is the single component that separates "real product" from "AI landing page". Rules in priority order:

1. **Real captures only.** Screenshot the actual app (`/whatsapp`, `/whatsapp/campaigns`, `/whatsapp/flows/build`, `/whatsapp/analytics`) with **real seeded data** — Indian business names, real invoice numbers, real ₹ amounts, real timestamps. If seeded data doesn't exist, **seed a demo workspace before capture.**
2. **Two captures per feature:** `*-clean` (empty states, no customer names, for marketing) and `*-live` (real data, for the security context).
3. **Browser chrome is CSS, never a PNG.** 1px bar, 32px tall, three 8px circles, and a mono URL pill reading `crm.madhuratech.com/whatsapp`.
4. **Never tilt.** No `rotate()`, no `perspective`, no 3D transform.
5. **Never float over a gradient.** No overlap into the CTA band, no glow. Flush in its grid cell.
6. **Caption is mandatory.** Mono 12px: `Fig. 02 — Campaign wizard, delivery ledger. Captured 14 Mar, anonymised.` This single line is the strongest honesty signal available and costs nothing.
7. **Capture one element with a real focus ring visible.** It proves it's a screenshot.
8. **Density is the proof.** Zoom to 100%, real mid-work-surface scroll position. Empty airy fake UIs are the tell.
9. **Format:** AVIF → WebP → PNG. 2× density, ≤1600px wide, ≤180 KB decorative, ≤260 KB hero.

**States:** hover `--mk-e1 → --mk-e2` + border `--mk-border-strong` (220ms). **No scale, no zoom, no rotate.** Optional 1.5× zoom hotspot, ember outline, mono label — max 2 per frame.

**Alt text describes the workflow and the data, never the pixels:**
`alt="Campaign wizard showing 4,120 contacts delivered, 38 failed, with a stop-campaign control"`.
Decorative repeats get `alt="" aria-hidden`.

### 6.6 FeatureGrid / FeatureCard — `.mk-features` / `.mk-feature`

Card anatomy: optional mono module code `F·01` **or** 32px icon tile · H3 · body (52ch) · optional learn-more link.
Variants: `default` · `featured` (spans 2 cols, includes a ScreenshotFrame) · `quiet` (1px top rule only) · `dark`.
Hover: `--mk-e1` + `translateY(-2px)` + border `--mk-border-strong` — **not** a colour flood. `focus-within` mirrors hover for keyboard users.
Padding 24px (featured 32px), gap 24px, min-height 200px.

Content: the **8 real modules**. Do not add a ninth.

### 6.7 StepTimeline — `.mk-steps`

Ordered list on a 1px vertical connector, node at col 2. Max 4 steps. Variants `horizontal` (≥lg) · `vertical` (<lg) · `ticked` (onboarding checklist).
Reveal on scroll stagger 80ms; the connector draws downward over 500ms `--ease-out` **once**; the node scales 0.9→1 as the connector reaches it. Reduced motion: connector appears at full length immediately.

**Psychology — Activation Energy.** Use this as a *design noun*, not a quantitative claim (ego-depletion's large-effect claims failed a major multi-lab replication). What replicates is the descriptive basis: initiating behaviour is disproportionately effortful relative to continuing it. So: **make step 1 a 4-minute QR scan with zero data entry.** Goal-Gradient: show `01/03` and a progress bar during in-product setup; on the page, "3 steps · about 8 minutes" makes 8 minutes feel *bounded*, and bounded feels possible.

### 6.8 FlowBuilderDiagram — `.mk-flow`

The one hand-drawn SVG. A diagram of the product's **real** node model: trigger → message → button/list → delay → condition → branch → end. Three swim lanes (Trigger · Logic · Message), 6 nodes, one outcome annotation.
Variants: `static` · `animated` (edges draw on scroll, staggered 70ms) · `interactive` (Features page only — nodes are buttons in a `role="tablist"`, arrow keys move, panels swap the diagram caption and a matching ScreenshotFrame).
`viewBox="0 0 960 420"`, `preserveAspectRatio="xMidYMid meet"`, `width:100%; height:auto`. Node 148×56.
**A11y:** `role="img"` with a full `aria-label` describing the flow in order, **plus a visually-hidden ordered list** carrying the same content. Every node label is real `<text>`, never a path. Lane labels stay horizontal — rotated text fails zoom.

### 6.9 ComparisonTable — `.mk-compare`

3 columns: feature · Madhura · **"the usual way"**. Never against named competitors. No competitor names anywhere on the site.
Truthy = `--mk-success` + 14px Lucide `check`. Falsy = `--mk-ink-3` + 14px `minus` — **never a red ✗**, because this is a workflow comparison, not an attack.
13px body, 11px uppercase-600 headers, 44px min row height. Below 768px: table `min-width:640px` inside `.mk-scroll-x`, first column `sticky left:0` with a right hairline. `<caption class="mk-sr-only">`; `scope="col"` / `scope="row"`; wrapper `role="region" aria-label="…"` + `tabindex="0"` for keyboard scroll.

**Psychology — Contrast Effect.** Positive in one frame and negative in the other beats either alone. Hence a before/after table beats a feature list. Cap at 6 rows on the home page; longer tables stop being processed.

### 6.10 PricingCard + BillingToggle — `.mk-price`

Toggle: `[Monthly] [44×24 track] [Yearly] [−20% badge]`. Renders **only** if real annual pricing exists.
Card: `[tier name] [one-line audience] [price + period] [CTA] [divider] [4–6 feature lines] [footnote]`.
Variants: `standard` · `featured` (2px ink border + a small mono "Most popular" tab in ember, offset −1px) · `contact` · `enterprise`.
Price change: 160ms cross-fade + 4px rise, `aria-live="polite"` so screen readers hear it.

**Hard rule:** `priceState` is a required prop. A missing price renders "Talk to us" + a response-time line — never `₹0`, never a placeholder figure.

### 6.11 FAQAccordion — `.mk-faq`

`<dl>` of native `<details>/<summary>`. No ARIA reimplementation — native semantics, deep-linkable via `#q-id`, shareable.
Summary `py-20px` (min 56px), 1px bottom rule, 20px chevron rotating 45°→90°. Answer 15px/1.6, 68ch, `pb-24px pr-56px`.
Hover: summary underline + chevron to `--mk-accent`. Open: chevron rotates, answer fades + rises 8px over 180ms.
**12–16 questions max** — the rest live on `/faq`.

### 6.12 StatCounter — `.mk-stat`

`[numeral 44px tabular] [label 13px] [optional 12px mono source]`.
Animated: counts 0→N over 900ms `--ease-out`, once, `IntersectionObserver` threshold 0.5, `aria-live="off"` — a screen reader must hear the **final value from the DOM**, not a count-up. Reduced motion / SSR / no-JS: render the final value immediately.

> **Content honesty — the critical rule for this product:** a statistic renders **only** with a named source. Factual capability counts are always allowed because they are verifiable from the codebase: *"8 modules, one workspace"* · *"2 ways to connect — WhatsApp Web QR or Meta Cloud API"* · *"1 inbox for sales, service and support."* **Never** invent "10,000+ businesses" or "99.9% uptime."

### 6.13 SecurityPanel — `.mk-security`

2-col: left = eyebrow / H2 / body / link to `/security`; right = a card with items (your number stays yours · admin-provisioned accounts · role-based access · message history export).
Distinctive device: an honest **"What we don't claim"** footnote in 12px `--mk-ink-3`.

**Honesty rule:** this panel may only state what `/security` actually documents. If we cannot answer "where is data stored / how are backups handled", the item is written as a *link with the question as the link text*, not as a claim. **Never write SOC 2 / ISO 27001 badges that aren't held.**

### 6.14 TrustBadgeRow — `.mk-trust`

3–4 items, each `[18px icon] [statement]`, separated by 1px vertical rules. No cards, no logos, **no hover state** — static trust elements must not invite interaction.
Content (all genuinely true today): *"Messages are sent from your own connected WhatsApp account"* · *"Accounts are created by an admin — no open sign-ups"* · *"Role-based access: admin and employee see different controls."*

### 6.15 DemoForm — `.mk-form`

See §9.2 for the full field-by-field spec and rationale.

### 6.16 LegalPage shell — `.mk-legal`

Sticky TOC (left rail, `--mk-container-prose` content), "Last updated" + effective date, section anchors, a `print` stylesheet, and a download/print action. Reused by all five legal documents.

---

## 7. Page-by-page specification

> Every page block below is **independently survivable**: people don't read landing pages, they sample them in 5–20 seconds. A visitor landing mid-page must still get the whole argument. This is why CTAs repeat, why sections restate the core promise, and why no section depends on scroll order.

---

### 7.1 HOME `/`

**Purpose:** establish the category reframe (*add-on, not replacement*) and route qualified visitors to a demo/access request. **Awareness.**

**Sections, in order:**

| # | Block | Content | Model |
|---|---|---|---|
| 1 | `MarketingHeader` | Wordmark, nav from `nav[]`, `Sign in` ghost → `/login`, `Book a demo` → `/contact`. Signed-in: both swap for `Open app` → `/whatsapp` | Hick's Law, Default Effect |
| 2 | `Hero` | Eyebrow "WhatsApp CRM workspace". H1. Lede naming the record link. Right: `ScreenshotFrame` with the self-typing invoice chat (INV-1042, ₹48,500, Pay-now chips) captioned `Fig. 01` | Processing Fluency, Von Restorff, Curiosity Gap |
| 3 | `TrustBadgeRow` | The three true guarantees | Processing Fluency |
| 4 | `LogoRow` | "Works with": Meta WhatsApp Business Platform, Meta Cloud API, WhatsApp Web. **Text fallback until brand assets are licence-cleared** | Authority Bias |
| 5 | `StatBand` | Capability counts only, each with a source line (§6.12) | Specificity |
| 6 | `ProblemSection` | Three pains. **Validate, don't diagnose** | Loss Aversion (real losses only) |
| 7 | `SolutionSection` | Before/after table, max 6 rows | Contrast Effect |
| 8 | `FeatureGrid` | 8 real modules, 4×2 asymmetric, one featured card → `/features#anchor` | Chunking |
| 9 | `FlowBuilderFeature` | Full-width real canvas screenshot + node palette (TRIGGER / LOGIC / ACTION). Emphasis on "no code" | Curiosity Gap, Endowment |
| 10 | `HowItWorksPreview` | 3 steps + link to `/how-it-works` | Activation Energy, Goal-Gradient |
| 11 | `AutomationsFeature` | Real CRM event strip: `invoice_created`, `quotation_created`, `payment_received`, `new_lead`, `lead_followup` | Availability Heuristic |
| 12 | `SecurityTeaser` | Role-based access, admin-provisioned accounts, data residency → `/security` | Authority Bias |
| 13 | `TestimonialStrip` | 2–3 quotes — **or the honest empty state** (§8.5) | Unity, Pratfall |
| 14 | `PricingTeaser` | 3 tiers → `/pricing` | Anchoring |
| 15 | `FAQPreview` | Top 5, ban-risk first → `/faq` | Uncertainty Reduction |
| 16 | `CTABand` | Dark shell band | Commitment & Consistency, Risk Reversal |
| 17 | `MarketingFooter` | 4 columns + legal row | Mere Exposure |

**CTAs**

| Priority | Label | Destination | Microcopy under it |
|---|---|---|---|
| Primary | **Book a demo** | `/contact` | *See the workspace on your own use case — 30 minutes, no commitment.* |
| Secondary | **Request access** | `/signup` | *An admin creates your account. No self-serve signups.* |
| Tertiary (nav) | **Sign in** | `/login` | — |
| Tertiary (inline) | How does pairing work? → | `/how-it-works#pairing` | — |

**SEO**
- Title `WhatsApp CRM for Sales, Service & Support | Madhura` (51)
- Meta `Run sales, service and support on WhatsApp — live inbox, bulk campaigns, CRM automations, chatbot flows and payment reminders.` (131)
- H1 `Run sales, service and support on WhatsApp`
- Keywords: `whatsapp crm`, `whatsapp business platform`, `whatsapp automation`, `whatsapp bulk messaging`, `crm with whatsapp`
- Schema: `Organization` + `WebSite` (+ `potentialAction`/`SearchAction` → `/blog?q=`) + `SoftwareApplication` (`applicationCategory: "BusinessApplication"`, `operatingSystem: "Web"`, `offers` from `pricing.js`). **`aggregateRating` only if real reviews exist.**

**Technical:** `pages/Home.jsx` (retires `pages/Landing.jsx`). Static props from `content/`. Must **not** statically import anything from `pages/whatsapp*` or `components/WhatsApp*` — those three files are 315 KB / 217 KB / 93 KB. Hero LCP image gets `fetchpriority="high"`; everything else `loading="lazy" decoding="async"`.

---

### 7.2 FEATURES `/features`

**Purpose:** depth per capability so an evaluator can self-qualify without a human. **Consideration.**

**Sections:** PageHeader (H1 `Every capability, tied to the record`) → StickySectionNav (Inbox · Contacts · Campaigns · Automations · Flows · Reminders · Analytics · Accounts · Roles) → **9 × FeatureDeepDive**, each with icon, H2, 2-line description, **real screenshot**, 3–4 capability bullets, a "where it shows up in your CRM" line, and a secondary CTA → full-width FlowBuilder section with the node-type table (TRIGGER / LOGIC / ACTION) + run-history panel → capability × tier matrix from `pricing.js` → role-access table (admin / sub-admin / employee, matching the real role model) → CTABand.

**CTAs:** Primary `Book a demo` → `/contact` · *"Walk through the canvas with a solutions engineer."* Secondary `See pricing` → `/pricing` · *"Compare every capability by plan."*

**SEO:** Title `Features — Inbox, Campaigns, Automations & Flows` (49) · Meta `Explore WhatsApp CRM features: live inbox, contacts and groups, bulk campaigns, event automations, visual chatbot flows and payment reminders.` (146) · Keywords `whatsapp crm features`, `whatsapp bulk campaign software`, `whatsapp chatbot flow builder`, `whatsapp payment reminders` · Schema `ItemList` of features + `BreadcrumbList` + `FAQPage`.

**Technical:** static from `content/features.js` — `{id, icon, title, summary, capabilities[], screenshot, crmAnchor}`.

---

### 7.3 PRICING `/pricing`

**Purpose:** let a self-serve evaluator qualify without a human. **Decision.** See §8 for the full psychology.

**Sections:** PageHeader (H1 `Pricing that scales with your message volume`) → `BillingToggle` (`role="radiogroup"`, arrow keys, `aria-checked`) → 3 `PricingCard`s → **`WhatsAppFeeCallout` (mandatory honesty block)** → `ComparisonTable` → `QuotaExplainer` → `OnboardingCosts` → 6 pricing FAQs → CTABand.

> **`WhatsAppFeeCallout` is non-negotiable.** Meta charges separately for conversations (template vs utility vs marketing categories, India 2026 rate card, free-form customer-service window). A pricing page that omits this reads as a bait-and-switch to any informed buyer and destroys the trust the rest of the site is built on. Cite `meta.com/business/whatsapp/pricing`.

**`QuotaExplainer`** documents the real behaviour: opt-in status, unsubscribed and blocked flags, daily campaign caps, `daily_limit` / `start_time` / `end_time` / `timezone` per campaign.

**CTAs:** all tier buttons → `/contact?plan=<tier>` (prefills the form). Band primary `Book a demo` · *"Need a custom quote? We'll price it against your actual volume."* Secondary `Request access` → `/signup` · *"No self-serve signups — an admin provisions your workspace."*

**SEO:** Title `Pricing — Plans & WhatsApp Message Costs | Madhura` (48) · Meta `Compare Madhura WhatsApp CRM plans. See seat pricing, included features, and how Meta's separate WhatsApp conversation charges work.` (135) · Keywords `whatsapp crm pricing`, `whatsapp business api pricing india`, `whatsapp crm cost` · Schema `Product` ×3 with `offers` (`priceCurrency: "INR"`, `priceValidUntil`), `FAQPage`, `BreadcrumbList`. **No `aggregateRating` without real reviews. No `offers` without real prices.**

⚠️ **Pricing numbers do not exist anywhere in this repo.** The business must supply them. Until then the page ships in `contact` state with no `offers` schema.

---

### 7.4 HOW IT WORKS `/how-it-works`

**Purpose:** de-risk onboarding and time-to-first-message. **Consideration.**

**Sections:** PageHeader (H1 `From zero to first WhatsApp message in four steps`) → `StepTimeline` (4 steps) → `SetupDetailTabs` (QR scan / pairing code / Meta Cloud API, including Cloud API prerequisites) → `DataModelDiagram` (chat → contact → group → campaign → flow run → CRM record) → `AutomationExample` (`invoice_created` → send PDF → Pay-now/UPI → confirmation → CRM write-back) → `TimelineEstimate` (Day 1 / Week 1 / Month 1) → `OnboardingChecklist` (what the customer must bring) → CTABand.

**The 4 steps:**
1. **Your admin creates accounts and roles** — no open signup surface.
2. **Pair your number** — QR scan (WhatsApp → Linked Devices), a pairing code, or Meta Cloud API. ~4 minutes. WhatsApp Business stays logged in.
3. **Import and segment your contacts** — Excel, CSV, or existing groups.
4. **Go live** — send a campaign, or switch on one automation. Watch the first one send.

**`OnboardingChecklist` is the honest expectation-setter** and belongs on the page: your own number · a Meta verified business (for Cloud API) · an admin who can scan the QR · a customer list to import. Expectation setting against churn and refunds is one of the highest-ROI, lowest-effort things on this list.

**CTAs:** Primary `Book a demo` · *"We'll pair a sandbox number live on the call."* Secondary `Read the FAQ` → `/faq`.

**SEO:** Title `How It Works — Setup in Four Steps | Madhura CRM` (48) · Meta `See how a team goes live on Madhura WhatsApp CRM: admin-provisioned accounts, QR or Cloud API pairing, contact import, then campaigns.` (149) · Schema `HowTo` with 4 positioned steps, `FAQPage`, `BreadcrumbList`.

---

### 7.5 INTEGRATIONS `/integrations`

**Purpose:** show it plugs into the existing stack rather than replacing it. **Consideration.**

> **Framing correction:** this is a **WhatsApp module for the Madhura CRM**, and the core CRM runs on a separate origin (`crm.madhuratech.com`). Say so plainly. Pretending it's one product creates a support incident the first time a customer looks for their invoices.

**Sections:** PageHeader (H1 `Works with your CRM. Works with Meta.`) → `IntegrationGrid` in three groups:
- **WhatsApp channels:** WhatsApp Web (QR + pairing code), Meta Cloud API, hosted engine-number fallback.
- **Madhura CRM:** event-bus ingest (`/api/v1`, `/api/crm`); events `invoice_created`, `quotation_created`, `payment_received`, `new_lead`, `lead_followup`; live CRM lookup for balance/AMC; payment links + UPI confirmation; PDF generation.
- **Extension:** direct lead capture (`POST /api/v1/lead`), custom triggers (`POST /api/v1/event`), webhooks in/out at `/webhook`.

→ `ArchitectureDiagram` (two-origin: CRM ⇄ bearer token ⇄ WA module ⇄ Meta) → `ApiCodeBlock` (copyable cURL/JSON) → `ZapierWebhookSection` ("anything that can POST can trigger a flow") → **`NotYetAvailable`** (an honest list of what doesn't exist today).

⚠️ **Never show a logo wall of things not integrated.** Naming a non-existent integration to the admin persona is a trust-ending error.

**CTAs:** Primary `Book a demo` · *"We'll map your CRM events to your flows on the call."* Secondary `Talk to an engineer` → `/contact?topic=integration`.

**SEO:** Title `Integrations — WhatsApp Cloud API & CRM Events` (46) · Meta `Connect Madhura WhatsApp CRM to Meta Cloud API, WhatsApp Web and your CRM via events, webhooks and the REST API.` (125) · Schema `ItemList` + `BreadcrumbList`. **No `OfferCatalog` until a real connector inventory exists.**

**Technical:** `<pre><code>` only — **never** `dangerouslySetInnerHTML`. Copy button with `aria-live` confirmation. Label the token as a server-side secret; never ship a browser key.

---

### 7.6 ABOUT `/about`

**Purpose:** build trust and humanise; supports decision-stage scrutiny. **Consideration → Decision.**

**Sections:** PageHeader (H1 `Built by the team that got tired of WhatsApp exports`) → `StorySection` (WhatsApp is where Indian SMEs actually do business while the CRM of record lives elsewhere; Madhura is an existing business-management platform, and this module exists because the gap was real) → `StatsBand` (verified only) → `MissionValues` (each value with a **concrete product consequence** — e.g. "admin-provisioned accounts ⇒ no open signup surface") → `TeamGrid` (real people, real roles, verified photo consent) → `Timeline` (sourced from `git log` for accuracy) → `PresenceSection` (location, data residency, IST support hours) → `TrustLogos` (permission-gated) → CTABand.

**Pratfall Effect note:** the origin story works *because* it admits a limitation — the CRM of record lives somewhere else. Hiding that costs more credibility than it buys.

**CTAs:** Primary `Book a demo` · *"Talk to the team that builds it."* Secondary `Read the blog`.

**SEO:** Title `About Madhura — The Team Behind the WhatsApp CRM` (49) · Meta `Madhura builds business management software for Indian SMEs. Learn why we built a WhatsApp CRM that stays tied to the record.` (134) · Schema `AboutPage` + `Organization` with real `foundingDate`, `address`, `contactPoint`, `logo`.

---

### 7.7 TESTIMONIALS `/testimonials`

**Purpose:** third-party proof. **Decision.**

**Sections:** PageHeader (H1 `Teams that run their customer conversations on WhatsApp`) → `StatsBand` (aggregate, attributable) → `TestimonialGrid` (6 × card, each with quote / name / role / company / industry / city / verified metric) → `CaseStudies` (3 × Challenge → Approach → Result) → `VideoTestimonials` (1–2, lazy facade, click-to-play, poster, transcript) → `RoleQuotes` (sorted by persona so each visitor finds their own) → `LogoRow` (permission-gated) → CTABand.

**CTAs:** Primary `Book a demo` · *"Ask us for a reference call in your industry."* Secondary `Read the blog`.

**SEO:** Title `Customer Stories & Reviews | Madhura WhatsApp CRM` (48) · Meta `Read how Indian SMEs use Madhura WhatsApp CRM for collections, follow-ups and support — with named contacts and measurable results.` (141) · Schema `ItemList` of `Review`/`Person`. **Never emit `Review` or `aggregateRating` for a quote you cannot attribute to a named, consenting source.**

**Technical:** `<blockquote>` + `<cite>` for every quote. Video: `controls` on by default, full transcript in a `<details>` rendered server-side, `.vtt` captions required.

---

### 7.8 BLOG `/blog` + `/blog/:slug`

**Purpose:** topical acquisition + sales enablement for field engineers. **Awareness → Consideration.**

**Index sections:** PageHeader → `FeaturedPost` → `CategoryFilter` (`aria-pressed`) → `PostGrid` → `NewsletterInline` → pagination → CTABand.

**Post template:** `Breadcrumbs` → `BlogPostHeader` (category, H1, dek, author + date + read time) → hero image (**the LCP element**, `fetchpriority="high"`) → sticky `TableOfContents` (`aria-current`) → `ArticleBody` → mid-article `NewsletterInline` → `AuthorBio` → `RelatedPosts` → `ShareButtons` (copy-link with `aria-live`) → CTABand → footer. Plus a doctype check so drafts emit `noindex, follow`.

**CTAs:** Index primary `Subscribe for product notes` · *"Monthly. No spam, unsubscribe any time."* Post primary `Book a demo` · *"See this workflow live in the workspace."*

**SEO:** Index `Blog — WhatsApp CRM Product Notes & Guides` (44) · Schema `Blog` + `BreadcrumbList`. Post: `BlogPosting` with `headline`, `description`, `datePublished`, `dateModified`, `author`, `publisher` (+`logo`), `image`, `mainEntityOfPage`, `articleSection`, `keywords`, `wordCount`.

**Technical:** static import map in `blog/index.js` — **no MDX toolchain, no remark/rehype dependency.** Prose styles hand-rolled under `.prose-mktg` (the repo has no `@tailwindcss/typography`).

---

### 7.9 FAQ `/faq`

**Purpose:** kill the last objections and become a rich-results surface. **Decision.**

**Sections:** PageHeader (H1 `Questions, answered`) → `CategoryFilter` (Getting started · Pairing & channels · Campaigns & limits · Flows & automations · Roles & access · Billing & plans · Security & data) → `FAQAccordion` (~35 questions) → `StillStuck` contact card → CTABand.

**Schema note:** Google honours **one `FAQPage` per URL**. Emit categories as headings inside a single `FAQPage`, or split into `/faq` + `/faq/billing`. Multiple `FAQPage` blocks on one page are ignored.

**SEO:** Title `FAQ — WhatsApp CRM Setup, Limits & Billing` (46) · Meta `Answers on WhatsApp pairing, campaign limits, message quota, flow builder, user roles, billing and data handling for Madhura WhatsApp CRM.` (150) · Schema `FAQPage`.

Full Q&A copy in §9.1.

---

### 7.10 CONTACT / DEMO REQUEST `/contact`

**Purpose:** the conversion endpoint. **Decision.** Full form spec in §9.2.

**Sections:** PageHeader (H1 `Book a demo`, lede: *"Tell us your volume and channel. We'll come back with a plan and a WhatsApp sandbox."*) → `DemoForm` → `WhatToExpect` (reply within 1 business day → 30-min call → sandbox pairing) → `ContactChannels` (sales, support, DPO/privacy, security emails, HQ address, IST hours) → `SecurityNote` ("Don't send credentials or customer data in this form." + link `/security`) → `AlternativeCta` (`Sign in` → `/login`).

**CTAs:** Primary `Request my demo` → `POST /api/marketing/demo-request` → on success `navigate('/access-requested', {state})` · *"We'll reply within one business day. No obligation."* Secondary `Request access instead` → `/signup` · *"Already know your team? Skip the call and request an account."*

**SEO:** Title `Book a Demo — Madhura WhatsApp CRM` (34) · Meta `Book a live demo of Madhura WhatsApp CRM. See campaigns, automations and the visual flow builder on your own use case.` (129) · Schema `ContactPage` + `ContactPoint`.

⚠️ **This needs a new backend endpoint. Do not reuse `/api/auth/request-access`:**
1. It **requires `emp_id`** — an external prospect has none, so the form can never submit.
2. It is rate-limited to **5 requests / 15 min per IP**. One office NAT = 5 demo requests per quarter. A pricing page can burn that in an afternoon.
3. It 409s on any repeat email within 7 days.
4. It writes a prose string into `admin_notifications`, which is not a CRM.

Proposed `backend/routes/marketingRoutes.js`: `POST /api/marketing/demo-request`, no `verifyToken`, **its own limiter at 10/10min/IP**, validation, structured columns (`name, email, company, employees, volume, channel, interests JSON, message, consent_at, source, utm_*`). Fire `demo_request_submit` **server-side too**, so ad blockers don't eat it. Honeypot `<input name="website" tabindex="-1" aria-hidden="true">` + a time-to-submit > 3s check.

---

### 7.11 ACCESS REQUESTED `/access-requested`

**Purpose:** Peak-End Rule. This is the **last moment** the customer remembers from their first session, so it must not feel like a form receipt.

**Sections:** H1 `Request received` · one sentence naming what happens next and when · the 3-step setup list (§9.3) · reassurance line ("Your number stays yours · Cancel any time · Export everything, always · No card, no app install") · `WhatToExpect` timeline · contact fallback · a `Book the call now` secondary.

`noindex, follow`. The step list is **Chunking** applied to reduce post-conversion anxiety.

---

### 7.12 CHANGELOG `/changelog`

**Purpose:** retention + advocacy; signals an actively maintained product. **Retention.**

**Sections:** PageHeader (H1 `What we're shipping`) → RSS/email subscribe → version list newest-first: version chip, `<time dateTime>`, tag (`New` / `Improved` / `Fixed` / `Security`), grouped items → filter by tag → paginated older releases → CTABand.
**SEO:** Title `Changelog — Product Updates | Madhura WhatsApp CRM` (49) · Schema `BreadcrumbList` + `ItemList`. Add `public/rss.xml` + `<link rel="alternate" type="application/rss+xml">`.

---

### 7.13 SECURITY & TRUST `/security`

**Purpose:** pre-empt the security questionnaire and shorten enterprise deal cycles. **Decision.**

**Sections:** PageHeader (H1 `Security, stated plainly`) → `TrustBadges` → `ArchitectureAndBoundaries` (two-origin model; the authed surface is `/whatsapp/*` and requires a JWT `Authorization` header) → `AuthAndAccess` (`verifyToken` supports JWT **and** X-API-Key for server-to-server CRM calls; roles admin / sub-admin / employee; **admin-provisioned accounts only**) → `DataProtection` (TLS in transit, MySQL `achme_wa`, backups, encryption at rest) → `WhatsAppChannelSecurity` (**QR/pairing-code pairing is the highest-risk surface**; session stored server-side; "Disconnect" purges it) → `AIAndData` (name the model, the data sent, whether training is disabled, where keys live) → **`KnownLimitations`** → `SubprocessorsTable` → `ComplianceTable` (DPDP Act 2023 · GDPR · **ISO 27001 / SOC 2 only if actually held** · VAPT) → `DisclosureProcess` (security@, 24h ack, 90-day disclosure) → CTABand.

> **`KnownLimitations` is the differentiator, not the liability.** Publish it. A trust page that admits what it doesn't do reads as competent to exactly the admin persona who holds the veto — and that admin will find the gap themselves if you don't publish it.

⚠️ **Do not emit `Event`/`Review` schema for certifications you don't hold.**

✅ **You MAY now claim "every endpoint is authenticated" — it is true and provable.** `npm run audit:auth` reports **237 of 237 handlers authorised**, with 9 public by design (login/OTP/registration and the Meta webhook). Put that number on the page. A specific, checkable claim is worth more to a technical buyer than the adjective "enterprise-grade."

⚠️ Two things you still **cannot** claim: certifications you do not hold, and protection of `/uploads` — that mount is `express.static` with no auth. Publish it under `KnownLimitations`. An honest gap reads as competence to exactly the admin persona who holds the veto, and that admin will find it themselves if you don't.

**CTAs:** Primary `Request our security pack` → `/contact?topic=security` · *"NDA available. Sent within one business day."* Secondary `Read the DPA`.

**SEO:** Title `Security & Trust — Madhura WhatsApp CRM` (39) · Meta `How Madhura WhatsApp CRM protects your data: JWT and API-key auth, admin-provisioned accounts, WhatsApp session handling, subprocessors and disclosure.` (152).

---

### 7.14 LEGAL PAGES

Shared `LegalPage` shell (§6.16). All five are **indexable** — `noindex` on a privacy policy is a compliance failure in spirit and looks like an attempt to bury it.

#### `/privacy` — Privacy Policy

**Outline:** 1 Scope · 2 Who we are (controller) · 3 Data we collect · 4 How we use it · 5 **Lawful basis** · 6 **Sharing, including Meta** · 7 International transfers · 8 Retention · 9 Security · 10 **Your rights** · 11 Children's data · 12 Cookies · 13 Changes · 14 Contact.

- **Data collected.** *Account:* name, work email, employee ID, password hash, role, tenant. *WhatsApp:* phone numbers, contact names, chat message content, media, per-message delivery/read status. *Business:* invoices, quotations, payment records, contacts, groups, templates, flow definitions, run history. *Technical:* IP, device/browser, socket session ID, localStorage keys (`user`, `token`, `wa_cached_status`, `wa_cached_chats`, `wa_active_chat`), logs. *Marketing:* name, email, company, message volume, form content, UTM parameters.
- **Purpose.** Provide the workspace; send and receive WhatsApp messages on the customer's behalf; execute campaigns/flows/automations; store and display history; analytics; security and fraud prevention; legal compliance.
- **Lawful basis.** DPDP §7(a) consent (marketing-site processing), §7(b) performance of contract (the workspace itself), §7(c) legal obligation, §7(f) legitimate interests (security, analytics, service improvement). GDPR Art. 6(1)(a)/(b)/(c)/(f). **State explicitly that consent is not relied on for core service processing** — the customer's instruction to message their own contacts is the basis.
- **Meta sharing.** Madhura acts as a **WhatsApp Business Solution Provider**. Message content is transmitted through Meta's WhatsApp Business Platform and processed by Meta under the WhatsApp Business Messaging Terms and Meta's Privacy Policy. Shared: recipient number, message content, template name + parameters, media URLs, delivery/read events. For **Cloud API** deployments the customer may connect their own Meta account (Madhura = processor); for **hosted engine numbers / WhatsApp Web pairing** Madhura may operate the number on the customer's behalf (Madhura = controller). ⚠️ **This dual role must be stated precisely — get counsel to confirm.**
- **Retention.** ⚠️ set real numbers: account data for the life of the account + 30 days after deletion; message content as long as the account is active or per the customer's configured window; campaign/analytics records 24 months; security and access logs 12 months; marketing leads 24 months or until consent is withdrawn; backups 30 days rolling.
- **Rights.** DPDP §11 — access, correction, erasure, withdraw consent, grievance redressal, nomination. GDPR Art. 15–22 — same plus portability and objection. Channel: `privacyEmail`, identity verification, response within 30 days, **named grievance officer** per DPDP §5.
- **Contact.** DPO name, `dpo@` address, postal address, DPDP Data Protection Board grievance route.

#### `/terms` — Terms of Service

1 Acceptance · 2 The service (**including that it is a module** of the broader Madhura CRM) · 3 **Accounts — admin-provisioned only; no self-serve registration**; the customer is responsible for all credentials under its control · 4 Licence and restrictions · 5 Acceptable use (→ `/acceptable-use`) · 6 Customer content and ownership · 7 **WhatsApp platform terms** — the customer must hold a valid Meta account, comply with the WhatsApp Business Messaging Policy and opt-in rules, and is solely responsible for opt-out handling; Madhura may suspend a number Meta restricts · 8 Fees, billing and **refunds** (annual plans non-refundable except pro-rata; Meta message charges are billed by Meta, not us) · 9 Third-party services (Meta, AI providers) · 10 IP and branding · 11 Confidentiality · 12 Data protection (→ `/dpa`) · 13 Warranties and disclaimers (**"as is" for AI output**) · 14 **Limitation of liability — capped at fees paid in the preceding 12 months** · 15 Indemnity · 16 **SLA** (⚠️ set a target, credit formula, and exclusions for Meta outages / planned maintenance / force majeure) · 17 Suspension and termination · 18 Suspension of the WhatsApp channel · 19 Export and transition assistance on termination · 20 Governing law **India**, jurisdiction ⚠️ confirm · 21 Changes · 22 General · 23 Contact.

#### `/cookies` — Cookie Policy

Categories (strictly necessary / functional / analytics / marketing), purpose + duration per cookie (match the real localStorage keys), the consent banner behaviour under DPDP and GDPR, **how to revoke**, and the DPDP requirement that consent be as easy to withdraw as to give. ⚠️ Note that `logout()` clears `localStorage`, so **consent must live in a first-party cookie** (`max-age=31536000`), not localStorage.

#### `/acceptable-use` — Acceptable Use Policy

Permitted use · prohibited content and conduct · **bulk messaging rules** (consent/opt-in basis, opt-out handling, no purchased lists without documented consent, rate-limit compliance) · no automated or unofficial WhatsApp clients · no reverse engineering · no reselling or sublicensing · **suspension trigger for the WhatsApp channel** (Meta policy violation) · reporting and enforcement.

#### `/dpa` — Data Processing

Roles (controller/processor) · processing details (subject matter, duration, nature, purpose, data types, data subjects) · **subprocessors table** · international transfers and safeguards · security measures · data-subject request assistance · **breach notification obligations and timelines** · audit rights · deletion on termination · governing terms.

**CTAs on legal pages:** Primary `Contact our DPO` → `mailto:{privacyEmail}` · *"We respond to data requests within 30 days."* Secondary `Read the Cookie Policy` → `/cookies` · *"Categories, purposes and how to revoke consent."* Tertiary `Request your data` → `/contact?topic=privacy`.

**SEO for all legal:** `<Page> — Madhura WhatsApp CRM` + a one-sentence meta + `WebPage` + `BreadcrumbList`.

---

### 7.15 404 `/404`

H1 `This page doesn't exist` · one line · `Go to home` primary · `Search the blog` secondary · a `TrustBadgeRow` so the dead end still reassures. Centred (permitted empty-state exception).

---

## 8. Pricing psychology

### 8.1 Stated assumptions — read before approving any number

| # | Assumption | Confidence | If wrong |
|---|---|---|---|
| 1 | Buyer is a micro-SMB, 1–15 seats, owner-operated | High | Tier ladder rescales; entry tier moves up |
| 2 | Willingness to pay ≈ ₹1,500–₹8,000/month for a WhatsApp CRM at this seat band | **Medium — genuinely uncertain** | Biggest single risk in this plan |
| 3 | Per-seat is the wrong primary metric; per-team or flat-per-workspace is right | Medium | Anchor shifts |
| 4 | Annual commitment acceptable for the mid tier at ~18–20% off | Medium | Monthly-first becomes required |
| 5 | Prices exclude GST (18% on SaaS in India) | High | Display both |
| 6 | "Unlimited messages" is not viable — Meta per-ticket pricing and quotas apply | High | Must not be promised |

> **On assumption 2:** there is no defensible number yet. Treat the ladder below as a **testable structure**, run the price test, and instrument pricing-page-view → request-access as the primary metric **before** scaling spend.

### 8.2 The architecture

```
┌──────────────────────────────────────────────────┐
  ANCHOR (high)   │  Stays  ₹6,499/mo  (Dominant) │  ← "this is a serious product"
└──────────────────────────────────────────────────┘
                    ▲
   DECOY (dominated)│  must be genuinely worse in EVERY dimension
                    ▼
┌──────────────────────────────────────────────────┐
                  │  Grow  ₹2,499/mo  (Most popular) │
                  └──────────────────────────────────┘
                    ▲
  ANCHOR (low)     │  Start  ₹999/mo                │
                  └──────────────────────────────────┘
```

⚠️ **All figures above are illustrative placeholders.** See §8.1.

1. **Anchoring** (robust). The first price a visitor processes calibrates all subsequent judgement. Showing the top tier first makes the middle read as moderate rather than expensive.
2. **Decoy / asymmetric dominance** (robust *but conditional*). The top tier must be **dominated**, not merely expensive — fewer automations, no flow builder, no advanced analytics, restricted roles, lower quota. A decoy that is only cheaper-but-not-worse makes the middle look bad; a decoy that fails to dominate **actively reduces** purchase probability.
3. **Mental accounting** (real, over-applied). Show **₹ per customer**, not only ₹ per month. The owner counts customers, not seats.
4. **Peak-end pricing.** Put the best-value tier at the visual *end* of the ladder for mobile scroll.
5. **Default effect** (among the best-replicated defaults in the literature). Preselect **annual** — but see §8.4 on the ethical line.
6. **Charm pricing.** Real but small (~1–3%), not the folklore. `₹2,499` over `₹2,500`; do not build copy around it.

### 8.3 Tier names and job-framed descriptions

| Tier | Name | Job-framed line | Role |
|---|---|---|---|
| Entry | **Start** | *"For the first person answering the phone."* | Low anchor. 1 seat, inbox + reminders. |
| Target | **Grow** | *"For a team that lives in the inbox."* | **Default, "Most popular."** The tier the CTA band and every demo push toward. |
| Anchor | **Stays** | *"For a business with a process, not a person."* | High anchor + dominated decoy. Advanced roles, quota headroom, custom onboarding. |

### 8.4 Monthly vs annual — the ethical line

- Present **annual** as the default (Default Effect) **only if** the saving is real and the annual commitment is genuinely cancellable or creditable.
- Label the toggle: "Yearly — save 20%" and, on hover/focus, show the actual rupee delta: **"you keep ₹X per month"** (Loss Aversion framed as a retained benefit rather than a discount).
- **Never** hide the monthly option, never pre-select a multi-year term, never make annual cancellation artificially hard.
- **Never** a countdown timer, never "3 seats left at this price".

### 8.5 Risk reversal (Regret Aversion)

The single most effective objection-reducer available to a product with a real onboarding risk:

- **"Your number stays yours. Cancel any time. Export everything, always."**
- Setup is on **your** number in a browser tab — "if anything looks unfamiliar, close the tab and you've lost nothing."
- A demo on a **sandbox number**, live, on the call.
- No card. No app install. No self-serve signup to undo.

### 8.6 Objection-handling FAQ for price

1. **Why isn't there a free trial?** → Because setup involves pairing your real WhatsApp number and your customer list. A trial on dummy data would prove nothing about the part you actually care about. The demo is on a sandbox; your rollout is on us.
2. **Do you charge per message?** → No. Madhura pricing covers the workspace, seats and features. Meta charges separately for WhatsApp conversations — we show you exactly how before you buy.
3. **What happens to my price if my volume grows?** → Nothing. Seats and features are your plan; Meta's conversation charges vary with volume and we show you the actual rate card.
4. **Can I start with one seat?** → Yes. Start is a single seat. You can add seats when the team catches up.
5. **What if I decide to cancel?** → Export your full dataset — contacts, conversations, campaign history — any time, without asking. Cancel from settings; annual plans are non-refundable except pro-rata.
6. **Is there a setup fee?** → One-off onboarding is available for larger tiers. It's quoted before you commit, never added after.

### 8.7 The testimonial empty state (do this now, don't skip it)

If there are no permissioned quotes, the section **does not render**. Substitute `TrustBadgeRow` (factual capability statements, which are always available).

The `/testimonials` page ships as a deliberate empty state, not a 404:

> **"We're collecting customer stories.**
> Talk to us and we'll tell you honestly what works and what doesn't."

Publishing a "we have no testimonials yet" page with an invitation to a reference call is a stronger trust signal than three invented quotes. The admin persona reverse-engineers claims; a fake one costs the deal.

---

## 9. Copy deck

> **Copy rules.** Sentence case. ≤18 words per sentence. Indian English retained (₹, GST, WhatsApp Business App, re-order, site visit). **Banned:** seamlessly, empower, revolutionise, supercharge, unlock, leverage, "ready to transform your business?", "in today's fast-paced world". CTA labels ≤3 words, verb-first, no intensifiers.

### 9.1 Hero and key sections

**Announcement bar — 3 rotating items** (pause rotation on hover; the first item stays stable for 30 days):
```
● Now supporting Meta Cloud API + QR pairing — connect your own number in about 4 minutes.   → Connect your number
● Your number stays yours. Export everything, any time, even after you leave.                 → Read the data policy
● Invoice sent → follow-up sent → payment received. All three, automatic.                     → See how it works
```

**Hero — primary variant (recommended):**
```
H1        Get paid faster. Stop losing leads.
Sub       WhatsApp CRM for Indian businesses that run on chat.
          Your number stays yours. Your team keeps replying in WhatsApp.
          The follow-ups happen on their own.
CTA 1     [ Request access ]      ← primary, filled
CTA 2     [ Book a demo ]          ← secondary, outline
CTA 3     How does pairing work? → ← tertiary, text link with chevron

Microcopy under CTA 1:
          No card. No app to install. Nothing leaves your phone.

Trust chips (single row, below the CTAs — never above):
   ✓ Official WhatsApp pairing      ✓ Works alongside WhatsApp Business
   ✓ Cancel any time                ✓ Full data export, always
```

**Hero variants for A/B (T-01, T-02):**
- **B — objection-first:** `Everything WhatsApp. With a memory.` / *Madhura adds a shared inbox, a customer record and payment reminders to the WhatsApp you already use — without moving your number.*
- **C — specificity:** `Your WhatsApp, now it never forgets a customer.` / *Shared inbox, auto follow-ups, one-tap payment reminders and delivery tracking for retailers, clinics, coaching and service businesses.*
- **D — anti-sceptic:** `Still using WhatsApp Business? Good. Add one screen.` / *The CRM your team will actually open — because it doesn't ask them to learn a new app.*
- **E — economic:** `One recovered lead pays for a month.` / *Stop losing enquiries in a busy inbox. Send invoices, chase payments and run repeat offers on WhatsApp — with proof every message was delivered.*

**Problem section (validate, don't diagnose):**
```
Eyebrow   The WhatsApp problem
H2        WhatsApp is where your customers trust you.
          It's also where your leads quietly die.
Body      Three people. Three chats. Nobody's job is "remember".
          An enquiry comes on Sunday, gets buried under a festival offer,
          and by the time anyone replies it's already booked elsewhere.
          You didn't lose that customer to a competitor's price.
          You lost them to your own inbox.

Bullets (real losses only, in their nouns):
   → Enquiries that got answered two days late — or not at all
   → Invoices you've followed up on so many times you've stopped wanting to
   → The one employee who knows every customer's history is on leave
```

**Solution section — before/after (max 6 rows):**

| Today, in WhatsApp | With Madhura |
|---|---|
| Enquiries buried under other chats | Every enquiry assigned, with an owner |
| Follow-ups depend on memory | Follow-ups fire on a timer or an event |
| "Did I send that?" — no answer | Delivered. Read. Failed. Visible per row |
| Invoices chased one-by-one, awkwardly | A reminder with a Pay-now-UPI button |
| The customer's history lives in one phone | History attached to the contact record |

**Six feature deep-dives:**

| Eyebrow | H3 | Body | Micro-CTA |
|---|---|---|---|
| One inbox, whole team | **Everyone answers from one inbox. Your number never moves.** | Connect your WhatsApp by QR or pairing code — or via Meta Cloud API. Every message lands in a shared inbox with an owner, a status and a history. Your team replies from WhatsApp as usual; your customers still see the same number they've always saved. | See how pairing works → |
| Reach | **Send the same offer to 300 customers — then see exactly who got it.** | Pick a group, write the message, send. Watch delivery update live. One tap stops the campaign. Failed numbers are flagged so you're never sending into a void — or over a WhatsApp limit. | See it in a demo → |
| Get paid | **Get paid without asking twice.** | When an invoice is created, Madhura sends a polite reminder with a Pay-now-UPI button, a Send-PDF option, or a request to call accounts — whichever you prefer. Customers tap to pay. You stop typing the same message every month. | See the reminder templates → |
| Set it once | **Send the invoice. The follow-up goes out by itself.** | Invoice created → quotation sent → payment received. Pick the events, pick the timing, pick the message. Madhura runs the sequence so nobody has to remember step two. | Build your first flow → |
| Your voice, on repeat | **Write your best reply once. Let it handle the boring ones.** | Build a flow in a visual canvas: trigger, message, wait, branch, done. Type the exact reply you want — your greeting, your tone, your discount. It reads like you wrote it, because you did. | Open a sample flow → |
| Proof and permission | **Stop guessing which campaign worked.** | Delivery, read and failure rates per campaign, per customer, per number. Plus role-based access: owners see everything, sales sees their customers, support sees conversations. Nobody sends to a list they can't see. | See a sample report → |

**Six industry use-cases** (Unity / In-Group Identity — lead with *their* vocabulary, not ours):

| Vertical | Blurb |
|---|---|
| **Coaching & education** | Send the fee reminder with a UPI button to 240 parents, and let the "what's the fee?" reply flow answer them at 11pm without you being awake. |
| **Retail & D2C** | Reorder nudges to last quarter's repeat buyers, split by size and pincode — before they remember they need new ones. |
| **Clinics & diagnostics** | Appointment reminders 24 hours ahead, with reschedule and directions in the same message. Fewer no-shows, fewer phone calls. |
| **Real estate** | Every site visit confirmed, every follow-up scheduled, every "what's the final price?" answered from your flow — across all 12 agents. |
| **Service businesses** | Booked, reminded, and re-booked. Automatic follow-ups after every completed job, with a review request that doesn't sound like one. |
| **Local services & salons** | Slots fill while you're with a customer. The flow answers "what time are you free?" and books it — you see it the moment you look. |

**Final CTA band:**
```
Eyebrow   Ready when you are
H2        Keep WhatsApp. Add a memory.
Sub       Tell us a little about your business. We'll show you the exact setup for your
          number, your team size and your follow-ups — then you decide.
CTA 1     [ Request access ]
CTA 2     [ Book a 20-min call ]
Microcopy Your number stays yours · Cancel any time · Export everything, always · No card, no app install
Below CTA  ₹ invoices & payment reminders · DPDP-aligned data handling · Official WhatsApp pairing only
```

### 9.2 FAQ — the 12 that must be above the fold

> **Q&A 3, 4 and 12 are the three that are almost always skipped and always needed.**

1. **Will WhatsApp ban my number?** → Madhura connects through official paths only — QR pairing, the pairing code, or Meta Cloud API. These are the same sanctioned mechanisms WhatsApp Business itself uses. We don't run unofficial clients and we don't automate the WhatsApp app by screen-scraping it. You stay inside Meta's rules because there is no other path we offer.
2. **Do I have to stop using the WhatsApp Business app?** → No. Keep it on every phone, exactly as your team uses it. Madhura is the shared layer on top — the shared inbox, the contact record, the campaign. Your customers still message the same number.
3. **What happens to my existing chat history?** → It stays in WhatsApp, where it is. Madhura stores the messages sent and received through your connected account so they attach to the right contact record. It doesn't migrate your chats out of WhatsApp, and it doesn't ask you to stop using the app.
4. **Where is my data stored, and who can see it?** → See our Security page for the specifics: storage location, encryption, roles and who can read what. Short version — accounts are provisioned by an admin (there are no open signups), and role-based access means a sales user cannot see or send to a list they don't own. You can export your full dataset at any time, including after you leave.
5. **Can my customers tell the difference between me and an automated reply?** → No, and that's the design goal. You write the exact reply — greeting, tone, discount, all of it — and it goes out verbatim. It reads like you wrote it because you did. And every message Madhura sends appears in your own inbox with your name and a timestamp.
6. **How long does setup take?** → About 8 minutes for the core: scan the QR, import a list, switch on one automation. Most teams are running a campaign the same week. Larger rollouts with multiple numbers and roles take an afternoon.
7. **What happens if the internet drops?** → Nothing is lost. Replies, contacts and campaign state queue and sync when you're back, and a half-typed reply survives the outage.
8. **How many messages can I send?** → It depends on your channel and Meta's limits, and we'll show you the actual numbers on the call rather than quoting a headline figure. Inside the app you can see your remaining messaging quota at any time, and failed numbers are flagged rather than silently retried into a void.
9. **Does my team need training?** → No. Your team keeps replying in WhatsApp. What changes is that they see a bigger inbox, a customer list, and one-tap payment reminders. The admin gets roles and provisioning.
10. **Can I connect more than one number?** → Yes. Accounts are per-number, with quota and campaign controls per account.
11. **What if I want to cancel?** → Export your full dataset any time — contacts, conversations, campaign history — without asking us. Cancel from settings. Annual plans are non-refundable except pro-rata.
12. **Who do I talk to if something breaks?** → Support over email and WhatsApp during IST business hours, plus an admin in your own workspace. If your WhatsApp channel itself is restricted by Meta, that's between you and Meta — we can't override it, and we'd rather tell you that up front than discover it together.

Full FAQ (35 questions across 7 categories) lives on `/faq`, sourced from `content/faq.js`.

### 9.3 Form spec — "Request access / Book a demo"

| Field | Ask? | Why |
|---|---|---|
| Full name | ✅ required | Personalises the reply; the sales conversation is human |
| Work email | ✅ required | The channel the follow-up happens on. **Validate for free-mail domains** and ask "use your work email?" rather than blocking |
| Company | ✅ required | Qualification + routing |
| Team size | ✅ select | Determines tier; short list (1–5 / 6–15 / 16–50 / 50+) |
| **Monthly message volume** | ✅ select | The single most predictive qualification field. It lets us quote against real volume and pre-answer the Meta pricing question on the call |
| Current channel | ✅ select | WhatsApp Web / Meta Cloud API / neither / not sure |
| What do you want to solve? | ✅ checkbox group | Collections · Follow-ups · Campaigns · Support · Flows. Doubles as the demo agenda |
| Message | ⭕ optional | Free text, 500 chars |
| **Consent** | ✅ required | DPDP. Un-ticked by default — never a pre-ticked box |

**Rules:**
- **Progressive disclosure:** the 5 selects collapse behind "Add details" for visitors who only came to click. Ask the minimum that lets us route the request.
- **Never ask for a password, a WhatsApp number you need to send on the first call, or customer data.** The security note says so explicitly.
- `autocomplete` on every field (`name`, `email`, `organization`).
- Errors in `role="alert"`, success in `role="status"`, focus moved to the confirmation heading, inline error text tied to the input via `aria-describedby`.
- Honeypot + time-to-submit check. Preserve the entered values on error — never clear the form.
- The button microcopy carries the SLA, and **the SLA must be real**. An unmet SLA costs more trust than a modest commitment would have earned.

### 9.4 Post-request confirmation email

**Subject (A/B):**
- A: `Your Madhura setup — next 3 steps (about 8 minutes)`
- B: `Confirming your access request, {{first_name}} — here's what happens next`

**Body (~120 words):**

```
Subject: Your Madhura setup — next 3 steps (about 8 minutes)

Hi {{first_name}},

Thanks for reaching out. Your request is with our team — someone will reply
within one working day, usually sooner.

While you wait, here's the whole setup. It's about 8 minutes total:

1. Connect your WhatsApp number — scan the QR from WhatsApp → Linked Devices.
   Your WhatsApp Business login stays exactly as it is.
2. Add your customer list — Excel or Google Sheets both work.
3. Turn on one automation — start with invoice reminders.

Nothing leaves your phone. Your number stays yours, and you can export your
full data or cancel at any time — no questions, no retention games.

Not sure yet? Just reply to this email with a question.

— {{advisor_name}}, Madhura
```

**Mechanism notes:** the subject pre-loads effort ("about 8 minutes"), which measurably reduces post-conversion anxiety. The numbered list is **Chunking**. "Someone will reply within one working day" is honest expectation setting — do not write it unless the SLA is real.

---

## 10. Technical implementation

### 10.1 SEO

| Page | Title (≤60) | Meta (≤155) | Schema |
|---|---|---|---|
| Home | WhatsApp CRM for Sales, Service & Support \| Madhura | Run sales, service and support on WhatsApp — live inbox, bulk campaigns, CRM automations, chatbot flows and payment reminders. | Organization, WebSite, SoftwareApplication |
| Features | Features — Inbox, Campaigns, Automations & Flows | Explore WhatsApp CRM features: live inbox, contacts and groups, bulk campaigns, event automations, visual chatbot flows and payment reminders. | ItemList, BreadcrumbList, FAQPage |
| Pricing | Pricing — Plans & WhatsApp Message Costs \| Madhura | Compare Madhura WhatsApp CRM plans. See seat pricing, included features, and how Meta's separate WhatsApp conversation charges work. | Product×3 (offers), FAQPage, BreadcrumbList |
| How it works | How It Works — Setup in Four Steps \| Madhura CRM | See how a team goes live on Madhura WhatsApp CRM: admin-provisioned accounts, QR or Cloud API pairing, contact import, then campaigns. | HowTo, FAQPage, BreadcrumbList |
| Integrations | Integrations — WhatsApp Cloud API & CRM Events | Connect Madhura WhatsApp CRM to Meta Cloud API, WhatsApp Web and your CRM via events, webhooks and the REST API. | ItemList, BreadcrumbList |
| About | About Madhura — The Team Behind the WhatsApp CRM | Madhura builds business management software for Indian SMEs. Learn why we built a WhatsApp CRM that stays tied to the record. | AboutPage, Organization |
| Testimonials | Customer Stories & Reviews \| Madhura WhatsApp CRM | Read how Indian SMEs use Madhura WhatsApp CRM for collections, follow-ups and support — with named contacts and measurable results. | ItemList of Review, BreadcrumbList |
| Blog | Blog — WhatsApp CRM Product Notes & Guides | Practical writing on WhatsApp Business messaging, CRM automation, collections, flows and delivery limits for Indian teams. | Blog, BreadcrumbList |
| FAQ | FAQ — WhatsApp CRM Setup, Limits & Billing | Answers on WhatsApp pairing, campaign limits, message quota, flow builder, user roles, billing and data handling for Madhura WhatsApp CRM. | FAQPage |
| Contact | Book a Demo — Madhura WhatsApp CRM | Book a live demo of Madhura WhatsApp CRM. See campaigns, automations and the visual flow builder on your own use case. | ContactPage, ContactPoint |
| Changelog | Changelog — Product Updates \| Madhura WhatsApp CRM | Release notes for Madhura WhatsApp CRM — new features in the flow builder, campaigns, automations, analytics and WhatsApp channel support. | ItemList, BreadcrumbList |
| Security | Security & Trust — Madhura WhatsApp CRM | How Madhura WhatsApp CRM protects your data: JWT and API-key auth, admin-provisioned accounts, WhatsApp session handling, subprocessors and disclosure. | WebPage, BreadcrumbList |
| Privacy | Privacy Policy — Madhura WhatsApp CRM | How Madhura Technologies collects, uses, shares and protects personal data under India's DPDP Act 2023 and the GDPR, including Meta WhatsApp data. | WebPage, BreadcrumbList |
| Terms | Terms of Service — Madhura WhatsApp CRM | The terms governing your use of Madhura WhatsApp CRM, including accounts, WhatsApp platform rules, billing, liability and termination. | WebPage, BreadcrumbList |
| Cookies | Cookie Policy — Madhura WhatsApp CRM | The cookies and local storage Madhura WhatsApp CRM uses, their purposes, durations and how to withdraw consent. | WebPage, BreadcrumbList |
| Acceptable Use | Acceptable Use Policy — Madhura WhatsApp CRM | What is and isn't allowed on Madhura WhatsApp CRM, including bulk messaging, consent and opt-out obligations. | WebPage, BreadcrumbList |
| DPA | Data Processing — Madhura WhatsApp CRM | Subprocessors, processing details, transfer safeguards and breach obligations under the Madhura WhatsApp CRM data processing terms. | WebPage, BreadcrumbList |

**No `review`, `rating`, `aggregateRating`, or `offers` schema without a real, attributable source.**

**Prerender is mandatory.** A CRA SPA serves one HTML document for every route, so crawlers see one hardcoded `<title>` for the whole site. Add `react-snap` or `react-ssr-guides`, or prerender the marketing routes at build time into `public/`. Legal, pricing and the blog are non-negotiable; the app routes stay client-only.

**`robots.txt`** at launch:
```
User-agent: *
Allow: /
Disallow: /whatsapp/
Disallow: /login
Disallow: /signup
Disallow: /access-requested

Sitemap: https://<domain>/sitemap.xml
```
Generate `sitemap.xml` and `rss.xml` from the content modules.

### 10.2 Performance budget

| Metric | Target |
|---|---|
| LCP | < 2.0 s (mobile, 4G) |
| CLS | < 0.05 — always set explicit `width`/`height` on every image |
| INP | < 200 ms |
| Marketing route JS | < 180 KB gzipped, excluding shared React |
| CSS | < 30 KB gzipped |

Rules:
- **`React.lazy` every marketing route except Home.** The current 1454 KB single bundle is the single largest blocker.
- Move the `socket.js` import out of `index.js` into `WALayout` so marketing visitors don't hold two open WebSockets.
- Hero LCP image: AVIF, `fetchpriority="high"`, no lazy. Everything else `loading="lazy" decoding="async"`.
- Self-hosted fonts with `font-display: swap` and preloaded Poppins + Inter. Source Serif 4 only on pages that use it.
- **No `framer-motion`.** CSS transitions and one small `IntersectionObserver` reveal hook. Animation is not worth 60 KB on a page whose job is to load fast.
- Scope `public/sw.js` to app routes so marketing forms and API responses don't enter CacheStorage.

### 10.3 Accessibility gate

- Skip link to `#main` (already present as `.lp-skip` — reuse the pattern).
- **One H1 per page**, hierarchical H2→H3, no skipped levels.
- Contrast ≥ 4.5:1 for text, ≥ 3:1 for UI boundaries. Verified: ink 12.4:1, ink-2 5.38:1, ember 4.68:1, success 4.57:1. **Landed yellow `#FCBD16` is 1.72:1 — graphic only.**
- `:focus-visible` on everything interactive — 2px ring, 2px offset, **instant, never animated**.
- Touch targets ≥ 44px on coarse pointers.
- Accordions: native `<details>/<summary>`. Tabs: WAI-ARIA pattern with roving tabindex, `Home`/`End`. Billing toggle: `role="radiogroup"` with `aria-checked`.
- Every SVG `role="img"` + `aria-label`, plus a visually-hidden text equivalent.
- Tables: `<caption class="sr-only">`, `scope="col"`/`scope="row"`, scroll wrapper `role="region"` + `tabindex="0"`.
- Forms: `autocomplete`, inline errors via `aria-describedby`, `role="alert"` on error, `role="status"` on success.
- `prefers-reduced-motion: reduce` — the repo already handles this in `index.css`; extend it to all new `.mk-*` motion and to the count-up and chat typing.

### 10.4 Motion & the one signature interaction

**Motion spec:** reveal = 12px rise + fade over 400ms `--ease-out cubic-bezier(0.16,1,0.3,1)`, triggered once at `IntersectionObserver` threshold 0.2, 60ms stagger within a group. Hover 140ms. Drawer/modal 220ms. Price change 160ms. Connector draw 500ms.

**Signature interaction — the self-typing chat in the hero.** A **silent, ≤9s, loop-and-pause** animation inside the `ScreenshotFrame`: the invoice bubble appears, then a reply types itself character by character, then the quick-reply chips (`Pay now / UPI`, `Send PDF`, `Call accounts`) fade in and stop. It pauses on hover and on focus, and renders its final state immediately under `prefers-reduced-motion`.

**Why this one:** it demonstrates the actual product promise (an automated, interactive, on-brand reply) in nine seconds without a video, and it does it inside the "tipped-in plate" frame, which keeps WhatsApp green quarantined. It is the only motion on the site. **No autoplaying hero video, no 3D, no parallax, no marquee with a customer quote.**

### 10.5 Conversion tracking

| Event | Fires when | Params |
|---|---|---|
| `page_view` | Route change on a marketing route | `path`, `referrer`, `utm_*` |
| `cta_click` | Any CTA button | `cta_name`, `cta_variant`, `placement`, `page` |
| `hero_cta_click` | Hero primary only | `hero_variant` (for the A/B test) |
| `pricing_view` | Pricing page mount | — |
| `pricing_toggle` | Billing period change | `period` |
| `tier_select` | Tier CTA click | `tier`, `price_state` |
| `demo_form_start` | First field interaction | — |
| `demo_request_submit` | **Server-side on success** (not client — ad blockers eat client events) | `plan`, `volume`, `channel` |
| `signup_start` / `signup_complete` | `/signup` engagement and post-submit | — |
| `scroll_depth` | 25 / 50 / 75 / 100 | `page` |
| `faq_expand` | Accordion open | `question_id` |
| `content_outbound` | Any external link | `href` |

⚠️ **Analytics does not load before consent.** GA4 under DPDP requires a lawful basis; default to consent-denied and only initialise on opt-in.

---

## 11. Ethical guardrails

These are the tactics that must **not** appear in this build, and the honest substitute for each.

| Dark pattern | Why it's banned here | Ethical substitute |
|---|---|---|
| False scarcity / fake countdown timers | This product sells trust to a paranoid buyer. One fake timer discovered by the admin persona ends the deal and the referral. | Show **real** limits: actual messaging quota from Meta, actual onboarding slots per week. If there's no real constraint, show no constraint. |
| Fake social proof / invented testimonials | Directly contradicts every claim on the site and is trivially reverse-engineered. | The honest empty state (§8.5) plus `TrustBadgeRow` of verifiable capability statements. |
| Manufactured loss ("most businesses lose 40% of leads — are you one?") | Loss Aversion is legitimate; **manufacturing** a threat the reader didn't have is manipulation. | State **realised** loss the reader already lives with: "enquiries that got answered two days late". Realised loss is honest; threatened loss is manipulation. |
| Pre-ticked consent checkbox | Invalid under DPDP and GDPR. | Unticked by default, with the consent line adjacent to the submit button. |
| Confirmshaming ("No thanks, I'd rather keep losing leads") | Aggressive; also the kind of thing that gets a site flagged. | Neutral decline link: "I'll decide later". |
| Forced continuity / pre-selected annual with a hidden cancellation path | Contradicts "cancel any time", which is a load-bearing promise. | Annual default **only if** genuinely cancellable or creditable, with the monthly option one click away and clearly labelled. |
| Disguised ads / "sponsored" content without labels | DPDP and ASCI require disclosure. | Label every partner placement, always. |
| Misleading guarantees ("guaranteed 10x ROI") | Unsustainable, and the ops lead is the one who has to deliver it. | Guarantees only where Madhura controls the outcome: "your number stays yours", "export everything, always", "cancel any time". |
| Near-miss CTA buttons ("Continue reading »" that isn't a link) | Dark pattern; also an accessibility failure. | Real links, real labels. |
| Cookie walls on marketing content | India has no cookie-consent precedent; a wall blocks SEO and users alike. | Consent-gate **analytics and non-essential cookies only**. Marketing content is always readable. |
| Exit-intent modals that interrupt the pricing table | The pricing page is the highest-intent moment on the site. Interrupting it is self-sabotage. | No exit-intent anywhere. The only popup is the cookie banner, and only before consent. |

**The governing principle:** the owner is handing us his business's customer list and his WhatsApp number. Every dishonest pattern we ship is a tax on the one asset we cannot afford to lose.

---

## 12. Build order

### Phase 0 — Foundations (no visible output, blocks everything)
1. Amend `design.md` to cover marketing pages (it currently says "Marketing pages: n/a"). Add the `--mk-*` token block to `index.css` in a new appended section — **never touch** `--color-paper`, `--color-ink`, `--color-accent`, or any `hl-*`.
2. `site.config.js` with every ⚠️ field populated by the business.
3. `Seo.jsx` + `schema.js` + `LegalPage` shell.
4. Move the `socket.js` import from `index.js` into `WALayout`.
5. Scope `public/sw.js` to app routes.
6. Convert the `*` catch-all to a real `<NotFound/>`.
7. `MarketingLayout` + `MarketingHeader` + `MarketingFooter` + `MarketingRoutes` skeleton, all routes lazy.

### Phase 1 — The money pages
8. `Home` (using the existing `.lp-*` CSS where it already works)
9. `Pricing` — in `contact` state until real prices arrive
10. `Contact` + **`POST /api/marketing/demo-request`** (new backend endpoint, §7.10)
11. `ThankYou` + the confirmation email
12. All five legal pages — **these are compliance obligations, not marketing**, and are shipped in the same release as the form that collects consent.
13. Cookie banner + consent storage in a first-party cookie.

### Phase 2 — Depth + trust
14. `Features`
15. `HowItWorks`
16. `Security` — **only after** §0.3 item 1 is either fixed or disclosed
17. `Integrations`
18. `FAQ`
19. `robots.txt`, `sitemap.xml`

### Phase 3 — Proof + story
20. **Screenshot capture task** — seed a demo workspace with realistic Indian data, capture 1440×900 and 768×1024, export AVIF + WebP, write the `Fig. NN` captions.
21. `Testimonials` (with the empty state shipped if quotes aren't ready)
22. `About`
23. `Changelog` + `rss.xml`

### Phase 4 — Content engine
24. `Blog` index + post template + 5 launch posts
25. Newsletter capture
26. Prerender (this unblocks real SEO for everything shipped in Phases 1–3)

### Phase 5 — Optimisation
27. Dark mode (apply the `.dark` class, ship the token set from §4.3)
28. A/B tests from §13
29. Full Lighthouse + axe audit on every route
30. Announcement bar rotation, exit-intent on the count-up

---

## 13. Test backlog

| ID | Hypothesis | Control | Variant | Primary metric | Model validated | Priority |
|---|---|---|---|---|---|---|
| T-01 | An objection-first hero headline outperforms an outcome-led one for cold traffic | H1-A `Get paid faster. Stop losing leads.` | H1-B `Everything WhatsApp. With a memory.` | `hero_cta_click` rate | Status-Quo Bias, Processing Fluency | 1 |
| T-02 | Explicit Status-Quo reassurance in the hero microcopy lifts CTA clicks | Current microcopy | Add `Nothing leaves your phone. Your number stays yours.` | CTA click rate | Status-Quo Bias, Endowment | 1 |
| T-03 | An outcome-led H1 beats a category-led H1 on demo-request rate | Current | `Run sales, service and support on WhatsApp` vs variant C | `demo_request_submit` | JTBD framing | 1 |
| T-04 | A three-card before/after table outperforms the feature list above the fold | FeatureGrid first | Contrast table first | Scroll-to-CTA-2 rate | Contrast Effect | 2 |
| T-05 | The fear-relief FAQ strip (ban / replace / export) above the fold raises form starts | 5 generic FAQs | The 3 kill-questions | `demo_form_start` | Uncertainty Reduction | 1 |
| T-06 | Leading with "Book a demo" outperforms "Request access" as primary | Request access | Book a demo | Qualified submissions per session | Activation Energy, Foot-in-the-Door | 1 |
| T-07 | A one-button demo form outperforms the multi-field form | Full form | Progressive disclosure (5 fields, "Add details" expands) | `demo_request_submit` | Hick's Law, Paradox of Choice | 1 |
| T-08 | The honest empty testimonial state outperforms no testimonial section at all | Section absent | Honest empty state + reference-call offer | Scroll-to-pricing rate | Specificity, Pratfall | 2 |
| T-09 | A live screenshot in the hero outperforms the illustrated chat mock | Current mock | Real capture | LCP, CTA click rate | Processing Fluency | 1 |
| T-10 | The animated announcement bar outperforms a static one | Static single item | 3 rotating items | Bounce rate, return sessions | Mere Exposure, Von Restorff | 3 |
| T-11 | Pricing framed as "₹ per customer" outperforms "₹ per month" | ₹/month | ₹/customer + hours-returned | Tier CTA click rate | Mental Accounting | 2 |
| T-12 | Publishing "Known limitations" on `/security` increases demo requests from the admin persona | Section hidden | Section published | Requests tagged `topic=security` | Pratfall, Authority Bias | 2 |

**Measurement rule:** instrument the primary metric before running anything, and **do not scale spend until T-03 (price/message-volume sensitivity) has data.** Everything else on this list is optimisation; T-03 is a business-model question.

---

## 14. Open decisions that need a human

| # | Decision | Owner | Blocks |
|---|---|---|---|
| 1 | **Real pricing** for the three tiers | Business | `/pricing`, all schema `offers`, T-11 |
| 2 | Registered legal entity name, address, DPO name and email | Legal | All five legal pages |
| 3 | Governing jurisdiction and courts | Legal | `/terms` |
| 4 | SLA target, uptime number, credit formula | Engineering + Business | `/terms`, `/security` |
| 5 | Data residency location and backup policy | Engineering | `/security`, `/dpa` |
| 6 | AI provider, model name, whether training is disabled, where keys live | Engineering | `/security`, `/privacy` |
| 7 | **Whether to fix or disclose the unauthenticated `/api/wa/*` mounts** | Engineering | `/security` claims |
| 8 | Whether ISO 27001 / SOC 2 / VAPT are actually held | Business | `/security` compliance table + schema |
| 9 | Named customers who will grant written logo + quote permission | Sales | `/testimonials`, logo rows |
| 10 | Product screenshots + who is authorised to publish them | Product | All screenshot frames |
| 11 | Brand clearance for Meta / WhatsApp marks in marketing | Legal | Logo row |
| 12 | Product domain (repo only shows `crm.madhuratech.com`) | Business | Canonicals, sitemap, analytics |
| 13 | Whether dark mode ships in Phase 1 or 5 | Design | Token set completeness |

---

## 15. Summary — the five things that decide whether this site works

1. **Ship real screenshots or ship none.** Every faked dashboard screenshot is a trust liability with the one audience whose objection is trust. A diagram is always better than a mockup.
2. **Say "keep WhatsApp" everywhere, and never hide Meta's message charges.** The buyer's default answer is to do nothing. The pricing page that omits Meta's per-conversation billing is the one page that loses the deal to a competitor's honesty.
3. **Publish what you don't claim.** Empty testimonial state, published limitations, unheld certifications omitted. This is the single cheapest differentiator against every tool in this category, and it is the one thing competitors structurally cannot copy without lying.
4. **Make step one a four-minute QR scan.** Activation Energy decides onboarding far more than persuasion does.
5. **Lazy-load everything and move the sockets out of `index.js`.** A marketing page that opens two persistent WebSockets and ships a 1.4 MB bundle is losing the visitor before a single word lands — and no amount of copy recovers that.
