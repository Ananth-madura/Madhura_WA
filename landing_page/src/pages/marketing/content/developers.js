/* Developer hub — /developers/* ----------------------------------------------------
   API documentation surfaces: hub, reference, webhooks, SDKs, guides, Postman,
   sandbox and changelog. Data only; StandardRenderer consumes it.
   Keep the shape stable: path / section / renderer / meta / hero / stats /
   overview / features / workflow / capabilities / faq.
   Anything omitted (cta, related) is filled in by content/index.js.
   --------------------------------------------------------------------------------- */

export const DEVELOPER_PAGES = [
  {
    path: "/developers",
    section: "Developers",
    renderer: "standard",
    meta: {
      title: "Developer Hub — REST API, Webhooks & SDKs | Madhura",
      description:
        "Consume Madhura over a versioned REST API with scoped keys, signed webhooks, official SDKs and a sandbox — auth, rate limits and errors explained.",
    },
    hero: {
      badge: "Developers · API",
      title: "Every Madhura capability, one versioned REST API.",
      subtitle:
        "Create contacts, send messages, subscribe to events and pull analytics from your own backend. This page explains how authentication works, how requests are limited, what the sandbox covers, and which page to open next.",
      points: [
        "Scoped API keys issued per workspace",
        "Signed webhooks with backoff retries",
        "JavaScript and Python SDKs with examples",
        "Sandbox traffic that never reaches Meta",
      ],
      primaryCta: { label: "Read the docs", to: "/docs" },
      secondaryCta: { label: "Get an API key", to: "/signup" },
    },
    stats: [
      { value: "REST", label: "Interface", note: "JSON over HTTPS, versioned under /v1" },
      { value: "24h", label: "Customer service window", note: "free-form replies only inside it" },
      { value: "Scoped", label: "API keys", note: "per module, rotatable, revocable" },
      { value: "24/7", label: "Sandbox", note: "simulated traffic for CI and demos" },
    ],
    overview: {
      heading: "How the platform is consumed",
      paragraphs: [
        "Madhura is operated through three surfaces: a REST API for anything a person can do in the workspace, outbound webhooks for anything that happens without you asking, and official SDKs that wrap both with sensible defaults. Everything is scoped to a workspace, so a multi-tenant integration holds one key per workspace and never mixes data across tenants.",
        "Requests carry a bearer key, failures come back in a single error envelope, and every write accepts an idempotency key so a retried POST cannot double-message a customer. Rate-limit state is returned in headers on success and failure alike, so a client can back off instead of guessing.",
      ],
      bullets: [
        "Base URL issued with your key, shaped like https://api.madhura.example/v1",
        "Bearer authentication with per-module scopes for read, write and billing",
        "Cursor pagination with a stable sort on creation time",
        "Idempotency-Key accepted on every POST for at-most-once writes",
        "Two environments — production and sandbox — with separate keys",
      ],
    },
    features: [
      { icon: "Terminal", title: "REST surface", desc: "Seven resource families — contacts, messages, templates, campaigns, flows, conversations and analytics — addressed with plain verbs under /api/v1." },
      { icon: "RefreshCw", title: "Webhooks out", desc: "Inbound messages, delivery status, assignment and billing changes are pushed to your endpoint signed and retried, so an integration never has to poll." },
      { icon: "Layers", title: "Official SDKs", desc: "JavaScript and Python clients resolve the base URL, attach the bearer token, walk cursors and sleep through 429s instead of failing on them." },
      { icon: "ShieldCheck", title: "Scoped keys", desc: "Issue one key per integration with only the modules it needs, rotate it on a schedule, and revoke it without disturbing any other integration." },
      { icon: "Rocket", title: "Two environments", desc: "Sandbox and production use different hosts and different keys, so a CI pipeline pointed at the wrong one fails loudly instead of messaging real customers." },
    ],
    workflow: {
      heading: "From API key to first webhook",
      steps: [
        {
          title: "Create a key",
          desc: "Generate a key in the workspace developer settings, pick its scopes, and copy the base URL printed beside it — the secret is shown once.",
        },
        {
          title: "Make a call",
          desc: "GET /api/v1/contacts with the bearer token. A 200 confirms auth and scopes; the X-RateLimit headers tell you the ceiling you are working under.",
        },
        {
          title: "Send a message",
          desc: "POST /api/v1/messages with an Idempotency-Key. Inside an open 24-hour window a free-form body is accepted; outside it the payload must name an approved template.",
        },
        {
          title: "Receive the event",
          desc: "Your endpoint verifies the signature, answers 2xx within five seconds, and deduplicates on the event id — because delivery is at-least-once, not exactly-once.",
        },
      ],
    },
    capabilities: {
      heading: "What surrounds the endpoints",
      items: [
        { icon: "FileText", title: "OpenAPI description", desc: "The whole surface ships as a machine-readable spec you can generate a client from, rather than a PDF you retype." },
        { icon: "Lock", title: "One key, one workspace", desc: "A credential resolves to exactly one tenant; a cross-workspace read is rejected during auth, not filtered afterwards." },
        { icon: "Activity", title: "Request log", desc: "Every call is recorded with status, latency and request id, so a failing integration is diagnosable from inside the workspace." },
        { icon: "Download", title: "Bulk export", desc: "Cursor-walk endpoints for contacts and messages when a warehouse needs the raw history rather than aggregates." },
        { icon: "Search", title: "Webhook simulator", desc: "Fire a signed sample event at your local receiver without waiting for a real customer to message you." },
      ],
    },
    faq: [
      {
        q: "Do we need our own Meta app or WhatsApp Business account?",
        a: "Not for the common case. Madhura operates the Cloud API connection for numbers you onboard here, and your integration talks only to our API. Bringing an existing WABA is a separate path where you keep the Meta credentials and we proxy them.",
      },
      {
        q: "Where does the base URL come from?",
        a: "It is issued with the key and shown next to it. Sandbox and production are different hosts, both of the form https://api.madhura.example/v1. Read it from your key record rather than hard-coding it from an example.",
      },
      {
        q: "What happens when we exceed the rate limit?",
        a: "You receive 429 with a Retry-After header alongside the X-RateLimit headers showing the window. The SDKs sleep for Retry-After once and re-send; a second 429 surfaces as an error instead of looping, so a burst cannot turn into a retry storm.",
      },
      {
        q: "Does the API enforce Meta's 24-hour customer service window?",
        a: "Yes. A free-form send outside an open window is rejected with window_expired before anything is handed to Meta, and the same rule applies to campaigns, automations and agent replies. The rule is Meta's; we surface it early so it fails predictably.",
      },
    ],
  },

  {
    path: "/developers/api",
    section: "Developers",
    renderer: "standard",
    meta: {
      title: "API Reference — Resources, Pagination & Errors | Madhura",
      description:
        "Seven resources, cursor pagination, idempotent writes, one error envelope and a /v1 versioning policy for the Madhura REST API.",
    },
    hero: {
      badge: "Developers · API reference",
      title: "Seven resources, predictable verbs, one error envelope.",
      subtitle:
        "The reference covers every endpoint, its parameters and its failure modes. This page summarises the shape of the API — resources, verbs, pagination, idempotency, errors and versioning — so nothing in the detailed reference is a surprise.",
      points: [
        "GET, POST, PATCH, DELETE on noun-shaped paths",
        "Cursor pagination with stable ordering",
        "Idempotency-Key header on every write",
        "One machine-readable error envelope",
      ],
      primaryCta: { label: "Read the docs", to: "/docs" },
      secondaryCta: { label: "Try it in Postman", to: "/developers/postman" },
    },
    stats: [
      { value: "7", label: "Core resources", note: "one noun per endpoint family" },
      { value: "Cursor", label: "Pagination", note: "stable order, no offset drift" },
      { value: "202", label: "Async writes", note: "campaigns, bulk imports, submissions" },
      { value: "v1", label: "Versioning", note: "breaking changes ship as /v2" },
    ],
    overview: {
      heading: "The shape of a request",
      paragraphs: [
        "Resources are nouns and verbs are boring on purpose: list with GET, create with POST, update with PATCH, remove with DELETE. Reads are synchronous; anything that can take longer than a couple of seconds — a campaign send, a bulk import, a template submission — returns 202 with a job id you can poll or wait for on a webhook.",
        "Version lives in the path, so an upgrade is a base-URL change you make deliberately. Within v1 the API only grows: new optional fields, new endpoints, new webhook topics you opt into. Removals, renames and type changes wait for a new version and a deprecation window.",
      ],
      bullets: [
        "GET /api/v1/contacts?limit=50&after=<cursor> for paged reads",
        "POST bodies are camelCase JSON; timestamps are RFC 3339 in UTC",
        'Errors return one envelope: { "error": { "code": "window_expired", "message": "…", "request_id": "req_8f2…" } }',
        "201 for created resources, 202 with a job id for asynchronous work",
        "Unknown response fields may appear at any time — parse leniently",
      ],
    },
    features: [
      { icon: "Layers", title: "Resource model", desc: "contacts, messages, templates, campaigns, flows, conversations and analytics — each with the same list, retrieve, create and update conventions." },
      { icon: "Filter", title: "Filtering", desc: "eq, gte, lte, in and contains over whitelisted fields, combined with a date range, so a query never needs a second endpoint to narrow results." },
      { icon: "RefreshCw", title: "Cursor pagination", desc: "limit defaults to 25 and caps at 100; the after cursor points at the last row you received, so inserts mid-walk never duplicate or skip records." },
      { icon: "Zap", title: "Idempotency", desc: "Send Idempotency-Key on any POST. The first request stores its response; a repeat with the same key returns that response instead of sending twice." },
      { icon: "ShieldCheck", title: "Error envelope", desc: "Every failure carries a stable code, a human message and a request_id. Codes are the contract — match on those, never on the message text." },
      { icon: "GitBranch", title: "Versioning", desc: "The version is part of the path, and deprecated versions answer with Deprecation and Sunset headers long before they stop answering at all." },
    ],
    workflow: {
      heading: "Anatomy of a request",
      steps: [
        {
          title: "Authenticate",
          desc: "Send Authorization: Bearer <key>. The key's scopes are checked before the handler runs — missing scope is 403, missing or malformed key is 401.",
        },
        {
          title: "Read",
          desc: "GET the collection with limit and after. Follow the next cursor until it is empty; the sort is fixed on creation time so a walk is deterministic.",
        },
        {
          title: "Write",
          desc: "POST with an Idempotency-Key you generate once per logical operation. Synchronous creates answer 201 with the resource; long work answers 202 with a job id.",
        },
        {
          title: "Interpret failure",
          desc: "Non-2xx always uses the same envelope. Retry on 429 and 5xx with backoff; do not retry 409 or 4xx validation errors without changing the payload.",
        },
      ],
    },
    capabilities: {
      heading: "Details that save an integration",
      items: [
        { icon: "Search", title: "Field selection", desc: "Ask for only the fields you use with a sparse fieldset, so a contact list stays small enough to hold in memory." },
        { icon: "Globe", title: "Branch scoping", desc: "Every collection accepts a branch filter, which is how a multi-branch tenant keeps one integration while isolating data per location." },
        { icon: "Activity", title: "Rate-limit headers", desc: "X-RateLimit-Limit, remaining and reset ride on every response, including errors, so pacing is observable rather than guessed." },
        { icon: "Download", title: "Bulk reads", desc: "Cursor walks plus export endpoints cover warehouse sync without needing a streaming protocol or a special job." },
        { icon: "FileText", title: "Example payloads", desc: "Each endpoint documents a success body and the two or three errors it actually returns — expired window, conflict, unapproved template." },
      ],
    },
    faq: [
      {
        q: "Why cursors instead of offset pagination?",
        a: "Offsets drift. If a contact is created or deleted while you are walking page 7, every subsequent offset shifts and you silently skip or repeat rows. A cursor anchored to the last record you saw stays correct while the underlying data moves.",
      },
      {
        q: "How do we tell a synchronous write from an asynchronous one?",
        a: "Synchronous creates answer 201 with the resource. Anything slower answers 202 with a job id: poll /api/v1/jobs/{id} for the outcome, or subscribe to the matching webhook and never poll at all. 202 always means the request was accepted, not completed.",
      },
      {
        q: "Can we pin an older API version?",
        a: "Yes. Your base URL names the version, and a version stays available for at least six months after its replacement is announced — see the changelog for dates. Requests to a retired version answer with a pointer to the migration notes rather than a blank 404.",
      },
      {
        q: "What is the maximum page size?",
        a: "100 per request, with 25 as the default. For full-history syncs use the export endpoints instead of raising limit — they are built for multi-hundred-thousand-row walks and report progress as a job.",
      },
    ],
  },

  {
    path: "/developers/webhooks",
    section: "Developers",
    renderer: "standard",
    meta: {
      title: "Webhooks — Events, Signatures, Retries & Replay | Madhura",
      description:
        "Inbound message, delivery status, template, assignment and billing events — HMAC-signed, retried with backoff and replayable from the event log.",
    },
    hero: {
      badge: "Developers · Webhooks",
      title: "Signed events for everything that changes state.",
      subtitle:
        "Subscribe to the handful of topics an integration actually cares about and have them pushed to your endpoint, signed and retried. This page covers subscriptions, signature verification, the retry schedule, replay and the ordering caveats you must design for.",
      points: [
        "HMAC-SHA256 signature over timestamp and body",
        "Retry schedule of 30s, 2m, 10m, 1h, 6h",
        "Replay any event from the event log",
        "Per-topic subscriptions, one endpoint or many",
      ],
      primaryCta: { label: "Read the docs", to: "/docs" },
      secondaryCta: { label: "Get an API key", to: "/signup" },
    },
    stats: [
      { value: "HMAC", label: "Signature scheme", note: "SHA-256 over timestamp + body" },
      { value: "5", label: "Retries per event", note: "30s, 2m, 10m, 1h, 6h, then stop" },
      { value: "2xx", label: "Ack condition", note: "anything else counts as a failure" },
      { value: "30d", label: "Replay window", note: "re-deliver from the event log" },
    ],
    overview: {
      heading: "Events you can trust to arrive, eventually",
      paragraphs: [
        "Delivery is at-least-once. We retry until your endpoint answers 2xx or the schedule runs out, which means duplicates are normal and idempotency is your side of the contract: every event carries a stable event id, and processing the same id twice must have the same effect as processing it once.",
        "Your handler should verify the signature, acknowledge immediately and do the work asynchronously. An endpoint that computes for ten seconds before answering will time out, get retried, and end up doing the same work three times anyway.",
      ],
      bullets: [
        "Topics: message.received, message.delivered, message.read, message.failed",
        "template.updated, thread.assigned, thread.status.changed, billing.invoice.paid",
        "Signature header carries a timestamp — reject anything outside your tolerance",
        "Answer 2xx within five seconds and queue the payload for later processing",
        "Repeated failures disable the endpoint and flag it in the workspace",
      ],
    },
    features: [
      { icon: "ShieldCheck", title: "Signature verification", desc: "Each delivery is signed with your endpoint secret — HMAC-SHA256 over the timestamp and raw body — and compared in constant time before you trust a byte." },
      { icon: "RefreshCw", title: "Backoff retries", desc: "A non-2xx or a timeout schedules a retry at 30s, 2m, 10m, 1h and 6h. After the fifth failure the endpoint is disabled and surfaced in the workspace." },
      { icon: "Clock", title: "Ordering caveats", desc: "Events are ordered per resource, not globally. Each payload carries created_at and a per-resource sequence so a late-arriving read receipt cannot overwrite a newer state." },
      { icon: "Search", title: "Event log and replay", desc: "Every delivery attempt — status code, response time, attempt number — is logged. Re-deliver one event or a filtered range to test a fix against real payloads." },
      { icon: "Sliders", title: "Topic subscriptions", desc: "Enable topics per endpoint. Point billing at finance's receiver and messages at your own, or run one endpoint with a switch on the topic field." },
    ],
    workflow: {
      heading: "Handling an event safely",
      steps: [
        {
          title: "Verify",
          desc: "Recompute the HMAC from the raw body and the timestamp, compare in constant time, and reject deliveries whose timestamp is outside your skew window.",
        },
        {
          title: "Acknowledge",
          desc: "Return 2xx immediately and push the payload onto your own queue. The five-second budget is for writing to disk, not for calling three downstream services.",
        },
        {
          title: "Deduplicate",
          desc: "Treat event.id as the idempotency key and record it before processing. Retries and replays then become no-ops instead of duplicate messages.",
        },
        {
          title: "Process or replay",
          desc: "Apply the change, and if your handler was broken while events piled up, replay the range from the event log once the fix is deployed.",
        },
      ],
    },
    capabilities: {
      heading: "Topics available to subscribe",
      items: [
        { icon: "Inbox", title: "Inbound messages", desc: "Normalised message payload with contact, thread, text or media, ready to attach to your own record." },
        { icon: "Send", title: "Delivery status", desc: "sent, delivered, read and failed transitions with the Meta error code attached to failures." },
        { icon: "FileText", title: "Template updates", desc: "Submitted, approved, rejected and quality changes, so an automation never sends against a pending template." },
        { icon: "Users", title: "Assignment", desc: "Thread assigned, reassigned or escalated — the event your CRM needs to keep an owner field honest." },
        { icon: "Percent", title: "Billing", desc: "Invoice issued, payment failed and credit thresholds, signed with the same scheme as message events." },
      ],
    },
    faq: [
      {
        q: "Will we receive the same event twice?",
        a: "Yes, when your endpoint is slow or flaky — delivery is at-least-once by design. Deduplicate on event.id before processing, and a duplicate becomes a no-op. Exactly-once delivery across an HTTP boundary is not something to promise an integration on.",
      },
      {
        q: "Why was our endpoint disabled?",
        a: "Five consecutive failures — non-2xx responses or timeouts — with no successful delivery in between. Re-enable it from the workspace after fixing the handler, then replay any events that were dropped; nothing in the window is lost, only delayed.",
      },
      {
        q: "Are events delivered in order?",
        a: "Per resource, not globally. A delivered receipt for message A may arrive after a read receipt for message B. Each payload carries created_at and a sequence for its resource, so compare those before writing state rather than trusting arrival order.",
      },
      {
        q: "Can billing and messages go to different endpoints?",
        a: "Yes. Subscriptions are per endpoint, so each receiver can enable only the topics it handles and hold its own secret. That also keeps a finance webhook out of your message-processing path when one of them needs a maintenance window.",
      },
    ],
  },

  {
    path: "/developers/sdks",
    section: "Developers",
    renderer: "standard",
    meta: {
      title: "SDKs & Examples — JavaScript and Python Libraries | Madhura",
      description:
        "Official JavaScript and Python libraries with retries, cursor paging and webhook verification, plus runnable examples for messaging, sync and analytics.",
    },
    hero: {
      badge: "Developers · SDKs",
      title: "Official libraries that handle auth, retries and paging.",
      subtitle:
        "Install a client, pass your key, and stop writing the same boilerplate for bearer tokens, cursors and backoff. The SDKs ship with typed models, a webhook signature helper and example repositories that run against the sandbox.",
      points: [
        "npm install @madhura/sdk · pip install madhura",
        "Typed request and response models",
        "Automatic backoff on 429 and 5xx",
        "Webhook signature verification built in",
      ],
      primaryCta: { label: "See the examples", to: "/developers/guides" },
      secondaryCta: { label: "Get an API key", to: "/signup" },
    },
    stats: [
      { value: "2", label: "Official SDKs", note: "JavaScript and Python" },
      { value: "5", label: "Example repos", note: "messaging, sync, webhooks, analytics" },
      { value: "TS", label: "Types included", note: "generated from the API description" },
      { value: "0", label: "Manual retry loops", note: "backoff lives inside the client" },
    ],
    overview: {
      heading: "The library does the boring parts",
      paragraphs: [
        "A raw client is three lines of headers and about forty lines of edge cases: which errors are retryable, when a cursor is exhausted, what to do with a 429 at 2am. The SDKs settle those once, so application code deals with business rules instead of transport.",
        "Clients are constructed with a key and resolve the base URL from it, which removes the most common way to point staging traffic at production. Webhook handling gets the same treatment: one helper that verifies the signature against the raw body and returns a typed event or throws.",
      ],
      bullets: [
        "Client reads its base URL from the key record — sandbox and production stay separated",
        "Pagination exposed as an async iterator; no cursor bookkeeping in your loop",
        "Retry on 429, 502, 503, 504 and network errors with exponential backoff and jitter",
        "Idempotency keys generated per write call, overridable when you manage your own",
        "verifyRequest(secret, headers, rawBody) returns the event or raises",
      ],
    },
    features: [
      { icon: "Terminal", title: "One-line install", desc: "npm install @madhura/sdk or pip install madhura — no build step, no code generation, no OpenAPI toolchain to maintain." },
      { icon: "Layers", title: "Typed models", desc: "Contact, Message, Template, Campaign and the error envelope are all typed, so a renamed field breaks the build instead of the send." },
      { icon: "RefreshCw", title: "Retries with backoff", desc: "Retryable statuses and transport failures are retried with exponential backoff and jitter; 4xx validation errors are raised immediately because retrying them cannot help." },
      { icon: "Search", title: "Async iterators", desc: "for await (const contact of client.contacts.list()) walks every cursor page and stops at the end — the pattern that is easiest to get wrong by hand." },
      { icon: "ShieldCheck", title: "Signature helper", desc: "The webhook verifier takes the raw body, not a parsed object, because re-serialising JSON is the classic way to make a valid signature fail." },
    ],
    workflow: {
      heading: "From install to sent",
      steps: [
        {
          title: "Construct the client",
          desc: "Pass the key once at startup. The client resolves the base URL, sets the bearer header and wires the default retry policy.",
        },
        {
          title: "Send",
          desc: "client.messages.create({ to, type: 'template', template: { name, language } }) — the SDK attaches the idempotency key and returns the accepted message.",
        },
        {
          title: "Iterate",
          desc: "Walk contacts or analytics with an async iterator, chunking writes yourself so a 50,000-row sync stays inside the rate limit.",
        },
        {
          title: "Verify events",
          desc: "In your receiver, call the verifier on the raw body, switch on the topic, and ack. Duplicates and replays fall out as no-ops.",
        },
      ],
    },
    capabilities: {
      heading: "What the examples cover",
      items: [
        { icon: "Send", title: "Messaging example", desc: "Send a template, follow its status through the funnel, and handle window_expired without crashing the job." },
        { icon: "Inbox", title: "Webhook receiver", desc: "An Express and a FastAPI receiver with signature verification, idempotent storage and an immediate ack." },
        { icon: "RefreshCw", title: "Contact sync", desc: "Bidirectional cursor sync with batching, rate-limit pacing and a conflict rule for fields edited in both systems." },
        { icon: "BarChart3", title: "Analytics export", desc: "Nightly pull of delivery and response metrics into a flat table, keyed by date range and branch." },
        { icon: "GitBranch", title: "Framework routes", desc: "Route-handler shapes for Next.js and FastAPI so the receiver lands in your existing project structure." },
      ],
    },
    faq: [
      {
        q: "Do the SDKs lock us into a proprietary stack?",
        a: "No. They are thin wrappers over the same HTTP API a curl call uses, and the wire format is documented independently. If a library stops being maintained you can drop it and speak REST directly without changing your data model.",
      },
      {
        q: "How do SDK versions relate to API versions?",
        a: "Library minor releases track additive API changes — new fields, new endpoints — while majors align with API majors. A major release of the SDK keeps working against the previous API version through the announced deprecation window, so the two upgrades never have to happen on the same day.",
      },
      {
        q: "Is automatic retry safe on POST?",
        a: "For writes the client sends an idempotency key, so a replayed POST returns the original response instead of creating a second message. Calls where you supply your own key keep it; calls you mark as non-retryable are raised straight away.",
      },
      {
        q: "Which runtimes are supported?",
        a: "Node 18 and later on the JavaScript side, Python 3.9 and later on the other — both using their standard HTTP stacks. Older runtimes may work but are not what the test matrix covers.",
      },
    ],
  },

  {
    path: "/developers/guides",
    section: "Developers",
    renderer: "standard",
    meta: {
      title: "Developer Guides — Recipes for Common Integrations | Madhura",
      description:
        "Four step-by-step recipes: send a first message, sync contacts, build a verified webhook receiver and poll analytics — with runnable requests.",
    },
    hero: {
      badge: "Developers · Guides",
      title: "Recipes that take you from API key to delivered.",
      subtitle:
        "Four guides, each ending with something you can observe in the workspace rather than a snippet you hope compiles. Every guide lists its prerequisites, the exact request, the plausible failures, and a verification step that proves it worked.",
      points: [
        "Send an outbound template in one request",
        "Bulk contact sync with cursor pagination",
        "A webhook receiver you can paste in",
        "Analytics polling with stable date windows",
      ],
      primaryCta: { label: "Read the docs", to: "/docs" },
      secondaryCta: { label: "Open the sandbox", to: "/developers/sandbox" },
    },
    stats: [
      { value: "4", label: "Core recipes", note: "send, sync, receive, measure" },
      { value: "cURL", label: "Every snippet", note: "with JS and Python alongside" },
      { value: "v1", label: "Pinned examples", note: "updated when the version moves" },
      { value: "0", label: "Extra dependencies", note: "beyond the official SDK" },
    ],
    overview: {
      heading: "Guides that end with something running",
      paragraphs: [
        "Each guide is a dependency-ordered recipe: the first message proves auth, scopes and template approval in one call; the contact sync proves pagination and idempotent writes; the receiver proves signatures and dedupe; analytics proves date-window queries. Skipping ahead usually means debugging three things at once.",
        "Snippets show the request, a realistic success response and the error you are most likely to get instead — window_expired, template_not_approved, rate_limited — with the fix for each. Failures are documented because that is where an integration actually spends its first day.",
      ],
      bullets: [
        "Prerequisites stated up front: key scopes, approved template, reachable endpoint",
        "Requests shown in cURL, JavaScript and Python from the same source",
        "Expected response printed next to the two or three errors that matter",
        "Each guide ends with a check you can see in the workspace or event log",
        "Written against the sandbox so nothing real is messaged while learning",
      ],
    },
    features: [
      { icon: "Send", title: "First outbound message", desc: "Pick an approved template, POST it to a contact, and read the accepted message id back — the shortest path that proves end-to-end delivery." },
      { icon: "Users", title: "Sync contacts", desc: "Walk cursors forward, batch upserts with idempotency keys, and handle a contact updated on both sides without overwriting the newer field." },
      { icon: "ShieldCheck", title: "Webhook receiver", desc: "Verify the signature against the raw body, store on event id, ack inside five seconds — and see why each of those three steps matters." },
      { icon: "BarChart3", title: "Poll analytics", desc: "Query delivery and response metrics over half-open date windows, page through the result and cache by window so a dashboard stays cheap." },
      { icon: "Clock", title: "Respect the window", desc: "Detect an open 24-hour customer service window, reply free-form inside it, and switch to a template the moment it closes." },
      { icon: "Search", title: "Read failure codes", desc: "Map message.failed codes to actions: retry, fix the recipient, wait for approval, or stop sending to a number that has blocked you." },
    ],
    workflow: {
      heading: "The four recipes, in dependency order",
      steps: [
        {
          title: "Send a first message",
          desc: "Authenticate, choose an approved template, send with an idempotency key, and confirm the thread appears — proving key, scope and approval in one call.",
        },
        {
          title: "Sync contacts",
          desc: "Page through the collection with cursors and upsert in batches, so the hard parts — drift, duplicates and rate limits — surface before go-live.",
        },
        {
          title: "Build a webhook receiver",
          desc: "Stand up an endpoint, verify signatures, dedupe on event id and ack fast; then replay a real event from the log to prove the handler is idempotent.",
        },
        {
          title: "Poll analytics",
          desc: "Pull delivery and response series over stable date windows into your own store, on a schedule, with the same numbers the workspace shows.",
        },
      ],
    },
    capabilities: {
      heading: "How a guide is built",
      items: [
        { icon: "FileText", title: "Prerequisites first", desc: "Nothing starts mid-air: the scopes, template state and endpoint you need are listed before the first command." },
        { icon: "CheckCircle2", title: "A verification step", desc: "Every guide closes with an observable check — a thread in the inbox, an event in the log, a row in the response." },
        { icon: "Download", title: "Copy-paste assets", desc: "Sample payloads and seed data download alongside the prose, so a guide runs against a workspace with no data in it." },
        { icon: "Globe", title: "Three languages", desc: "cURL for inspection, JavaScript and Python for the two official SDKs — all derived from the same request so they cannot drift." },
        { icon: "GitBranch", title: "Sandbox-first", desc: "Each recipe runs end to end against test numbers and simulated events before you ever point it at production." },
      ],
    },
    faq: [
      {
        q: "We already have contacts — which guide do we start with?",
        a: "The webhook receiver. Contacts you can import in one call, but inbound events are what turn a static record into a live conversation, and signature verification is the part people get wrong on the first attempt.",
      },
      {
        q: "Do the guides assume an approved template?",
        a: "For the first outbound message, yes — Meta requires an approved template outside an open 24-hour window, and no amount of API design changes that. The guide shows how to check approval state first and what the response looks like when the template is still pending.",
      },
      {
        q: "Can we follow along without messaging real customers?",
        a: "Yes. Run every guide against the sandbox: simulated inbound fires the same webhooks, failure injection returns the same codes, and nothing is billed. The requests are identical, so switching the base URL is the only change at go-live.",
      },
      {
        q: "Are the snippets complete programs or fragments?",
        a: "Complete requests with every header shown, plus the error branch. Fragments hide the idempotency key and the signature step, which are exactly the two lines people omit when they assemble a guide from parts.",
      },
    ],
  },

  {
    path: "/developers/postman",
    section: "Developers",
    renderer: "standard",
    meta: {
      title: "Postman Collection — Try the API in Under 5 Minutes | Madhura",
      description:
        "Import the Madhura collection and environment, bind your API key once, and send a real request from Postman in under five minutes.",
    },
    hero: {
      badge: "Developers · Postman",
      title: "Import the collection and send in under five minutes.",
      subtitle:
        "The collection ships with every resource folder, pre-filled example payloads and the success and failure responses you should expect. Bind your key into one environment variable and the first request is a click away.",
      points: [
        "One-click import of collection and environment",
        "API key bound through a secret variable",
        "A folder per resource, requests pre-filled",
        "Example responses for 200, 401, 409 and 429",
      ],
      primaryCta: { label: "Get an API key", to: "/signup" },
      secondaryCta: { label: "Read the docs", to: "/docs" },
    },
    stats: [
      { value: "1-click", label: "Import", note: "collection plus environment bundle" },
      { value: "3", label: "Environment variables", note: "base_url, api_key, workspace_id" },
      { value: "<5 min", label: "First request", note: "import through to 200 OK" },
      { value: "0", label: "CLI required", note: "runs entirely inside Postman" },
    ],
    overview: {
      heading: "The fastest way to see a 200",
      paragraphs: [
        "The collection is organised the way the API is: contacts, messages, templates, campaigns, flows, conversations and analytics, each folder holding its list, create and retrieve requests with realistic bodies already filled in. Saved examples sit beside each request, so the shape of a success and the shape of a 429 are visible before you send anything.",
        "Authentication is a bearer token bound to a variable, which means the key never lives inside the collection itself. Export the collection, share it with a colleague, push it into a repo — the secret stays in each person's environment, and rotating a key is an edit to one variable.",
      ],
      bullets: [
        "Environment holds base_url, api_key and workspace_id — three variables, no more",
        "Auth tab reads Authorization: Bearer {{api_key}} from the active environment",
        "A pre-request script generates an Idempotency-Key for every write",
        "Sandbox and production environments ship side by side for one-click switching",
        "Webhook folder contains a signed sample event body for local receiver testing",
      ],
    },
    features: [
      { icon: "Download", title: "One-click import", desc: "Open the collection link, accept, and both the collection and its environment land in your workspace — no folder to unzip, no spec to convert." },
      { icon: "Lock", title: "Secret-variable auth", desc: "The key lives in a Postman secret variable scoped to your environment, so it is masked in the UI and absent from the exported collection." },
      { icon: "Terminal", title: "Pre-filled requests", desc: "Every request carries headers, a plausible body and the path already assembled — you change a phone number, not eight lines of JSON." },
      { icon: "FileText", title: "Example responses", desc: "Saved examples for 200, 201, 401, 404, 409 and 429 with annotated fields, so an error you have not hit yet is still recognisable." },
      { icon: "Zap", title: "Idempotency pre-script", desc: "A pre-request script mints a fresh Idempotency-Key per send, demonstrating the header you should be sending in your own client." },
    ],
    workflow: {
      heading: "First request in four moves",
      steps: [
        {
          title: "Import",
          desc: "Open the collection link and the environment link. Postman asks once where to put them; both land under your workspace.",
        },
        {
          title: "Bind the key",
          desc: "Paste your API key into {{api_key}} in the active environment. base_url is already set to the sandbox host, so nothing real is contacted yet.",
        },
        {
          title: "Send a read",
          desc: "Run GET /api/v1/contacts. A 200 with your workspace's contacts — or an empty list — confirms auth, scopes and base URL in one round trip.",
        },
        {
          title: "Send a message",
          desc: "Run the create-message request with an approved template. Watch the response come back accepted, then follow the message id in the workspace.",
        },
      ],
    },
    capabilities: {
      heading: "What is inside the collection",
      items: [
        { icon: "Users", title: "Contacts folder", desc: "List with filters, retrieve, create and update — plus the cursor pagination example that shows where the next page comes from." },
        { icon: "MessageCircle", title: "Messages folder", desc: "Template send, free-form send inside the window, and the window_expired failure documented beside it." },
        { icon: "FileText", title: "Templates folder", desc: "Submit, check status and read quality, so approval state can be verified without leaving Postman." },
        { icon: "BarChart3", title: "Analytics folder", desc: "Date-ranged queries for delivery and response series with the half-open window convention demonstrated." },
        { icon: "RefreshCw", title: "Environment switching", desc: "Pick sandbox or production from the environment dropdown; base_url and the key change together, never one without the other." },
      ],
    },
    faq: [
      {
        q: "Where do we get the collection link?",
        a: "It is on this page and repeated under the workspace developer settings, and it is versioned alongside the API — a collection for v1 keeps pointing at v1. Re-importing updates requests without touching your variables.",
      },
      {
        q: "The first request returns 401. Why?",
        a: "Almost always one of three things: the key was pasted into the wrong variable, it carries a trailing newline from the clipboard, or its scopes do not include the module you are calling. The response envelope names the failing scope when that is the cause.",
      },
      {
        q: "Does the collection send real messages?",
        a: "Only if you switch to the production environment and bind a production key. The shipped environment targets the sandbox host, so the default path exercises the API without contacting Meta or a real recipient.",
      },
      {
        q: "Can it run unattended in CI?",
        a: "Yes. The collection is Newman-compatible, and a sandbox key plus the sandbox environment is enough for a smoke suite that checks auth, pagination and webhook signature verification on every push.",
      },
    ],
  },

  {
    path: "/developers/sandbox",
    section: "Developers",
    renderer: "standard",
    meta: {
      title: "Sandbox — Test Numbers, Simulated Inbound & Failure Injection | Madhura",
      description:
        "Test numbers, simulated inbound messages and injectable failures that stay off Meta — so retries, errors and webhooks can be exercised safely.",
    },
    hero: {
      badge: "Developers · Sandbox",
      title: "Test every failure before production finds it.",
      subtitle:
        "The sandbox runs the same API, the same webhooks and the same retry schedules against simulated traffic. Fire inbound messages at yourself, inject the failures you cannot reliably reproduce on a real number, and assert on what your handler did.",
      points: [
        "Simulated inbound that fires real webhooks",
        "Injectable failures: expired, blocked, throttled",
        "Test numbers kept apart from production",
        "Simulated sends are never billed",
      ],
      primaryCta: { label: "Open the sandbox", to: "/signup" },
      secondaryCta: { label: "Read the docs", to: "/docs" },
    },
    stats: [
      { value: "0", label: "Messages billed", note: "simulated traffic never reaches Meta" },
      { value: "1-click", label: "Inbound simulation", note: "webhook fires as if a person wrote in" },
      { value: "6+", label: "Injectable failures", note: "expired, blocked, throttled, invalid" },
      { value: "24/7", label: "Available", note: "no review queue in the loop" },
    ],
    overview: {
      heading: "Two halves: simulated and Meta test mode",
      paragraphs: [
        "Most of the sandbox never leaves the platform. Inbound simulation, delivery-status walks, failure injection, retry schedules, automation runs and webhook signatures are all generated inside the workspace — nothing is handed to Meta, nothing is metered, and a test can be re-run a thousand times.",
        "Some things are deliberately real. Outbound to a registered test number goes through the Cloud API's test mode with that recipient added as a test user, and a template you submit is reviewed by Meta for real, because an approval you faked in sandbox would be worthless at go-live. The line between the two is stated on every scenario.",
      ],
      bullets: [
        "Simulated inbound opens a real thread and triggers your automations and webhooks",
        "Status simulation walks sent → delivered → read → failed on your own messages",
        "Failure injection returns the same codes production returns, for the same causes",
        "Sandbox keys are rejected by the production host, and production keys by sandbox",
        "Template approvals are never simulated — submissions reach Meta's review",
      ],
    },
    features: [
      { icon: "Send", title: "Test numbers", desc: "A separate number for test traffic with its own recipients list. Sending to a number that is not on that list is blocked, so a stray request cannot reach a customer." },
      { icon: "Inbox", title: "Simulated inbound", desc: "Compose an inbound message from any contact you invent. The event fires exactly as a real one would: webhook, thread, assignment rules, automation triggers." },
      { icon: "Zap", title: "Failure injection", desc: "Mark a send to fail with a chosen cause — window expired, template unapproved, recipient blocked, messaging limit reached — and watch your error handling respond." },
      { icon: "RefreshCw", title: "Status walkthrough", desc: "Drive a message through sent, delivered, read and failed transitions step by step to test a UI or a pipeline that must react to each one." },
      { icon: "Lock", title: "Key separation", desc: "Sandbox credentials do not work against production hosts and vice versa. Pointing CI at the wrong environment fails with a clear auth error, not a silent mis-send." },
    ],
    workflow: {
      heading: "Exercising a failure path",
      steps: [
        {
          title: "Configure",
          desc: "Create a sandbox key, register a callback endpoint, and pick the scenarios a run should include — no Meta app review, no number verification wait.",
        },
        {
          title: "Simulate inbound",
          desc: "Fire a message at your test number. The signed webhook arrives, a thread opens and any automation keyed on that keyword starts running.",
        },
        {
          title: "Inject a failure",
          desc: "Force the send to fail with a chosen code, then watch the retry schedule and the message.failed event land in your receiver with the code attached.",
        },
        {
          title: "Replay and assert",
          desc: "Re-deliver the same event from the log to confirm your handler deduplicates, and archive the run as evidence that the failure path works.",
        },
      ],
    },
    capabilities: {
      heading: "What you can rehearse",
      items: [
        { icon: "GitBranch", title: "Scenario scripts", desc: "Compose inbound, delay and failure steps into a repeatable scenario a CI job can run on every push." },
        { icon: "Clock", title: "Retry observation", desc: "See the 30s, 2m, 10m, 1h, 6h schedule fire in real time against your endpoint instead of waiting for a real outage." },
        { icon: "Search", title: "Event log", desc: "Every simulated delivery is logged with attempt numbers and response codes, exactly as production deliveries are." },
        { icon: "ShieldCheck", title: "Signature checks", desc: "Simulated events are signed with the same scheme, so a verifier that passes here passes against Meta-originated traffic." },
        { icon: "Download", title: "CI artifacts", desc: "Export a scenario run — requests, responses, event sequence — as a machine-readable artifact for the pull request." },
      ],
    },
    faq: [
      {
        q: "Does anything in the sandbox reach Meta?",
        a: "Simulated traffic does not: inbound messages, status transitions, failures, retries and replays are generated inside the platform and never leave it. Outbound to a registered test number does go through the Cloud API's test mode, and template submissions always reach Meta's real review.",
      },
      {
        q: "Are sandbox messages billed?",
        a: "No. Simulated sends are not metered and never reach a recipient. Test-mode sends to recipients you have added as test users follow Meta's development-mode rules for an app that is not yet live.",
      },
      {
        q: "Can our CI pipeline run against it?",
        a: "Yes, that is the main reason it exists. Sandbox keys are separate, scenarios are scriptable, and runs export as artifacts. Nothing in the pipeline needs a human-approved template or a live number to prove the integration still works.",
      },
      {
        q: "Do approvals carry over from sandbox to production?",
        a: "Template review is real in both, and approval state is tracked per number. A template approved while testing is ready the moment that number goes live; one that was rejected tells you exactly the same thing in sandbox as it would in production.",
      },
    ],
  },

  {
    path: "/developers/changelog",
    section: "Developers",
    renderer: "standard",
    meta: {
      title: "API Changelog — Versioned Changes & Deprecations | Madhura",
      description:
        "What changed in each API version, the deprecation window before anything is removed, and how breaking changes are announced in advance.",
    },
    hero: {
      badge: "Developers · Changelog",
      title: "Every breaking change announced well before it ships.",
      subtitle:
        "The changelog is the contract for what moved: additive fields, new endpoints, changed limits and anything on a path to removal. Each entry carries a date, an impact statement and the migration note you need to schedule the work.",
      points: [
        "Additive-only changes within a version",
        "Minimum six-month deprecation window",
        "Announced by changelog, webhook and email",
        "SDK majors aligned to API majors",
      ],
      primaryCta: { label: "Read the changelog", to: "/developers/changelog" },
      secondaryCta: { label: "Talk to an engineer", to: "/company/contact" },
    },
    stats: [
      { value: "v1", label: "Current API version", note: "pinned in the path as /api/v1" },
      { value: "6 mo", label: "Deprecation window", note: "minimum, from notice to removal" },
      { value: "3", label: "Announcement channels", note: "changelog, webhook, email to key owners" },
      { value: "Additive", label: "Change policy", note: "within a version, fields only grow" },
    ],
    overview: {
      heading: "Versioning you can plan a quarter around",
      paragraphs: [
        "Inside v1 the API only grows. New endpoints, new optional fields and new webhook topics appear without warning you, which is why clients must parse leniently and never hard-fail on an unknown key. What does not happen inside v1 is a rename, a removal, or a type change — those require a new version and a window.",
        "When a breaking change is unavoidable, both versions run side by side: the old one keeps answering while carrying Deprecation and Sunset headers, the changelog entry states the removal date, and the SDK major that targets the new version keeps working against the old one until the date passes. Nothing disappears on a Friday night.",
      ],
      bullets: [
        "Every response may gain fields — treat unknown keys as informational",
        "Removals are announced with a date, never executed silently",
        "Deprecated versions answer with Deprecation and Sunset headers",
        "New webhook topics are opt-in per endpoint; existing payloads stay stable",
        "Platform changes forced by Meta are flagged with an explicit shorter date",
      ],
    },
    features: [
      { icon: "FileText", title: "Dated entries", desc: "Each release gets an entry with the shipping date, the affected resources and an impact line — additive, behavioural, or breaking with a deadline." },
      { icon: "GitBranch", title: "Version in the path", desc: "The version is part of the base URL, so upgrading is an explicit configuration change rather than something that happens to you on deploy day." },
      { icon: "Clock", title: "Deprecation windows", desc: "A minimum of six months between announcing a removal and executing it, counted from the changelog entry rather than from an internal decision." },
      { icon: "Send", title: "Three channels", desc: "The changelog for discovery, a deprecation webhook topic for automation, and email to owners of active keys so a notice is not missed." },
      { icon: "Layers", title: "Dual-run periods", desc: "Old and new versions stay live concurrently, and the SDK major for the new version still speaks to the old one, so the two upgrades can be separated." },
      { icon: "Download", title: "Migration notes", desc: "Breaking entries ship with a field-by-field diff and a sample payload on both sides, so the change can be estimated before it is accepted." },
    ],
    workflow: {
      heading: "How a breaking change ships",
      steps: [
        {
          title: "Announce",
          desc: "A changelog entry with the date and migration notes, a deprecation event on the webhook topic, and email to the owners of every active key.",
        },
        {
          title: "Dual-run",
          desc: "Both versions stay live. Responses from the old one carry Deprecation and Sunset headers, and the workspace shows a banner to admins.",
        },
        {
          title: "Migrate",
          desc: "Update the base URL, adopt the new fields, run your suite against the new version in sandbox — while the old one still works untouched.",
        },
        {
          title: "Retire",
          desc: "After the window closes, the retired version answers 410 with a pointer to the migration notes, and SDK majors that still target it warn at construction.",
        },
      ],
    },
    capabilities: {
      heading: "Staying informed",
      items: [
        { icon: "Search", title: "Searchable history", desc: "Filter past entries by resource, version or change type to answer the question a post-mortem always asks: when did this change?" },
        { icon: "Activity", title: "Machine-readable feed", desc: "The changelog is available as JSON and RSS, so a release-notes bot or a pipeline check can consume it without scraping." },
        { icon: "ShieldCheck", title: "Advance notice", desc: "No field is removed inside its version, and no version is retired without its announced window and a reachable migration note." },
        { icon: "Terminal", title: "Diff-able schemas", desc: "Versioned API descriptions let you diff two releases in CI and fail a build when a dependency upgrades onto a breaking change." },
        { icon: "Globe", title: "Platform change notices", desc: "Meta-side changes that reach through — window rules, template categories, webhook fields — are recorded here with the date they took effect." },
      ],
    },
    faq: [
      {
        q: "Can a field disappear without warning?",
        a: "Not inside a version. Additive changes only ever add; a removal means a new version, a changelog entry with a date, headers on the old responses, and an email to key owners. If a change is forced by Meta on a shorter timeline, the entry says so explicitly instead of pretending the six-month window applied.",
      },
      {
        q: "How do we detect deprecation before anyone reads an email?",
        a: "Three ways: the Deprecation and Sunset headers on responses from an old version, the deprecation webhook topic your integration can subscribe to, and construction-time warnings from SDK majors that are nearing their end of support.",
      },
      {
        q: "Do we have to upgrade on every release?",
        a: "No. Additive releases require nothing — your client ignores the fields it does not know. You upgrade deliberately when you want a new capability, and you must upgrade only when a version you are pinned to reaches its announced sunset date.",
      },
      {
        q: "How are Meta platform changes handled?",
        a: "They are logged as their own change type with the effective date, because we do not control the timing. Where advance notice allows it, the wrapper change ships with the normal window; where it does not, the entry carries the shorter date and the specific action your integration must take.",
      },
    ],
  },
];
