/* Platform, integrations, WhatsApp Business API and pricing pages — content entries are appended by the content pass.
   Keep the shape stable: path / section / renderer / meta / hero / …
   Anything omitted is filled in by content/index.js (meta, cta, related). */
export const PLATFORM_PAGES = [
  /* ── /platform/integrations ─────────────────────────────────────────────── */
  {
    path: "/platform/integrations",
    section: "Platform",
    renderer: "standard",
    meta: {
      title: "Integrations — REST API, Webhooks & Imports | Madhura",
      description:
        "Connect MADHURA with a REST API, signed webhooks, automation platforms, CRM and helpdesk imports, and CSV — with the constraints written down.",
    },
    hero: {
      badge: "Platform · Integrations",
      title: "Connect MADHURA to the stack you already run.",
      subtitle:
        "Integrations moves contacts, threads and events between MADHURA and the systems that already own them — your CRM, helpdesk, store or warehouse. Use the REST API for custom work, webhooks for outbound events, an automation platform for the long tail, and CSV when a system has no API at all. The result is one WhatsApp record wherever your team already looks.",
      points: [
        "REST API over contacts, threads, templates and sends",
        "Signed webhooks with retries and a replay log",
        "Two-way sync with common CRMs and helpdesks",
        "CSV import and export with field mapping",
      ],
      primaryCta: { label: "Start free trial", to: "/signup" },
      secondaryCta: { label: "Read the docs", to: "/developers" },
    },
    stats: [
      { value: "REST", label: "Public API", note: "versioned, rate-limited, documented" },
      { value: "signed", label: "Webhook payloads", note: "signature header on every delivery" },
      { value: "backoff", label: "Failed deliveries", note: "retried, then parked with the payload intact" },
      { value: "CSV", label: "No-API fallback", note: "import with mapping, export in the same shape" },
    ],
    overview: {
      heading: "Your systems stay the system of record",
      paragraphs: [
        "Most teams already have a CRM, a ticketing tool and an order system. WhatsApp is the channel that was never wired into them, and that gap is where context dies: an agent answers without the order history, a campaign segments on stale data, a report counts a conversation nobody connected to a deal.",
        "Integrations closes it in both directions. Outbound, the REST API and automation connectors let your systems start a journey, update a field or hand a thread to a queue without a human copying data. Inbound, webhooks and scheduled exports write message, tag and status changes back into the tools that need them.",
      ],
      bullets: [
        "Per-workspace API keys that can be rotated without downtime",
        "Cursor-paginated resources for contacts, threads, templates and campaigns",
        "Webhook subscriptions per event type, with signature verification and replay",
        "Idempotency keys on bulk operations, so a retried import cannot duplicate rows",
        "Import mapping for CRM and helpdesk exports: fields, tags, owners, custom values",
        "Rate limits published per endpoint and surfaced in response headers",
      ],
    },
    features: [
      {
        icon: "Terminal",
        title: "REST API",
        desc: "Contacts, threads, templates, campaigns, sends and analytics as JSON resources — create, read and update from any backend that can make an HTTP call.",
      },
      {
        icon: "RefreshCw",
        title: "Webhooks",
        desc: "Subscribe per event — inbound message, assignment change, delivery failure, payment status — and receive signed payloads with retry and dead-letter handling.",
      },
      {
        icon: "Zap",
        title: "Automation connectors",
        desc: "Trigger MADHURA actions from the automation platform you already use, with no code and no polling loops; the same events remain available as webhooks.",
      },
      {
        icon: "Layers",
        title: "CRM & helpdesk import",
        desc: "Bring contacts, tags, custom fields and ownership across, deduplicated against what is already in the workspace and previewed before anything is committed.",
      },
      {
        icon: "FileText",
        title: "CSV import & export",
        desc: "Map columns to fields, review validation errors row by row, and export the same shape back out for audits, migrations or a finance reconciliation.",
      },
      {
        icon: "Activity",
        title: "Integration log",
        desc: "Every API call and webhook delivery is listed with status, response code and retry count, so a sync that stopped at 02:00 is diagnosable at 09:00.",
      },
    ],
    workflow: {
      heading: "How a connection gets made",
      steps: [
        {
          title: "Pick the direction",
          desc: "Decide whether you are reading from MADHURA (webhooks, exports) or writing to it (API calls, automation triggers). Most setups end up doing both.",
        },
        {
          title: "Scope the credentials",
          desc: "Create a key or subscription for one workspace and one purpose, so revoking a broken integration never takes an unrelated one down with it.",
        },
        {
          title: "Map the data",
          desc: "Match fields, tags and owners; run a test webhook or a preview import and read the validation report before anything is committed.",
        },
        {
          title: "Ship and watch",
          desc: "Go live with the integration log open. Failed calls and deliveries can be replayed once the cause is fixed, with the original payload intact.",
        },
      ],
    },
    capabilities: {
      heading: "The details that decide whether an integration survives",
      items: [
        {
          icon: "Lock",
          title: "Scoped keys",
          desc: "A key can be read-only, branch-limited or send-enabled — least privilege applies to machines as it does to people.",
        },
        {
          icon: "GitBranch",
          title: "Branch inheritance",
          desc: "Integration records inherit branch permissions, so a connector built for one branch cannot read another's threads.",
        },
        {
          icon: "Clock",
          title: "Paced bulk work",
          desc: "Published rate limits with header feedback let a bulk sync pace itself instead of failing halfway through a night job.",
        },
        {
          icon: "CheckCircle2",
          title: "Validation first",
          desc: "Imports and payload writes are checked against the schema before commit, with per-row errors reported rather than a generic failure.",
        },
        {
          icon: "Download",
          title: "Scheduled exports",
          desc: "Push contacts or reports to an endpoint on a schedule instead of pulling on demand — useful when the consumer is a warehouse.",
        },
      ],
    },
    faq: [
      {
        q: "Do we need a developer to connect our CRM?",
        a: "Not for the common paths. CSV import with field mapping and the automation connector cover most CRM and helpdesk moves without code. Anything custom — starting a journey from your own events, writing thread state back into a record — uses the REST API and webhooks, which are documented with runnable examples.",
      },
      {
        q: "What happens when an integration fails?",
        a: "A failed API call returns a status code and a message; a failed webhook delivery retries with backoff and then parks in a dead-letter list with the payload intact. Nothing is dropped silently, and a replay can be triggered once the cause on either side is fixed.",
      },
      {
        q: "Can a rogue API key message our customers?",
        a: "Keys run under a role and scope, so a read-only or branch-limited key cannot send at all. A send-enabled key still passes the same guardrails as the interface: opt-out and blocklist enforcement, approved templates outside the 24-hour window, and per-contact frequency caps.",
      },
      {
        q: "Will an import duplicate our contacts?",
        a: "Imports match on phone number plus a secondary key you choose, report collisions before commit, and run in preview mode first. Re-importing an updated file updates existing rows instead of creating twins, and every import is written to the audit trail.",
      },
    ],
  },

  /* ── /platform/whatsapp-business-api ────────────────────────────────────── */
  {
    path: "/platform/whatsapp-business-api",
    section: "Platform",
    renderer: "standard",
    meta: {
      title: "WhatsApp Business API Setup — Cloud API Onboarding | Madhura",
      description:
        "Register or migrate a number onto Meta's Cloud API, manage display name, template categories and quality rating — with each step written down.",
    },
    hero: {
      badge: "Platform · WhatsApp Business API",
      title: "Move a number onto the Cloud API safely.",
      subtitle:
        "MADHURA runs on Meta's WhatsApp Business Cloud API, so the number, the display name and the templates stay under your business verification while your team works from one shared workspace. Onboarding covers number registration or migration, template categories, stored opt-in and the quality rating that decides how far your messages travel. This page sets out the steps and the rules behind them.",
      points: [
        "Register a new number or migrate a live one",
        "Display name tracked against Meta's review rules",
        "Template categories: utility, marketing, authentication",
        "Quality rating monitored, with pause-and-fix guidance",
      ],
      primaryCta: { label: "Start free trial", to: "/signup" },
      secondaryCta: { label: "Plan a migration", to: "/demo" },
    },
    stats: [
      { value: "24h", label: "Customer-service window", note: "free-form replies only inside it" },
      { value: "3", label: "Template categories", note: "utility, marketing, authentication" },
      { value: "2", label: "Number paths", note: "register new, or migrate an existing one" },
      { value: "3", label: "Quality ratings", note: "high, medium, low — Meta's own scale" },
    ],
    overview: {
      heading: "The channel is rented; the number is yours",
      paragraphs: [
        "Meta owns access to WhatsApp; you own the number, the business identity behind it and the reputation it carries. Getting onboarding wrong — registering the wrong line, submitting marketing wording as a utility template, skipping opt-in records — costs review cycles at best, and at worst brings a quality downgrade that caps delivery long after the mistake.",
        "MADHURA handles the mechanics: submitting registration, keeping the display name consistent with your verified business, tracking every template through Meta's review, and watching the quality rating so you learn about a problem from a dashboard rather than from customers who stopped receiving messages.",
      ],
      bullets: [
        "Two paths onto the API: register a new number, or migrate a live one",
        "Display name reviewed with your business verification, not separately",
        "Opt-in captured with proof, wherever the opt-in originally happened",
        "Template category must match the wording and the actual use",
        "Conversation charges follow Meta's model: category and region set the rate",
        "Quality rating moves with user reports, blocks and message relevance",
      ],
    },
    features: [
      {
        icon: "Rocket",
        title: "Number registration",
        desc: "Guided registration of a fresh number onto the Cloud API: verification, pairing and a checked test message before the number is handed to customers.",
      },
      {
        icon: "RefreshCw",
        title: "Number migration",
        desc: "Move an existing number off another provider or the Business App without losing the customer list, with the cutover window planned so the gap customers notice is small.",
      },
      {
        icon: "Globe",
        title: "Display name",
        desc: "Submit and track the display name against Meta's rules, so customers see your business rather than an unverified string — and rejections come back with the reason.",
      },
      {
        icon: "FileText",
        title: "Template submission",
        desc: "Category selection, variable samples and local pre-flight checks before the request reaches Meta's reviewers, tracked through to approved or rejected.",
      },
      {
        icon: "Activity",
        title: "Quality monitoring",
        desc: "The rating Meta reports for each number, next to the behaviour that moves it — report and block rates, stale segments, message relevance.",
      },
      {
        icon: "ShieldCheck",
        title: "Opt-in records",
        desc: "Capture where, when and how each contact opted in, and keep the record exportable when a consent question or a Meta review arrives.",
      },
    ],
    workflow: {
      heading: "Getting a number live",
      steps: [
        {
          title: "Verify the business",
          desc: "Complete Meta's business verification with details that match everywhere else. The display name and template approvals hang off it.",
        },
        {
          title: "Register the number",
          desc: "Pair a fresh line or a migrating one with the Cloud API, and confirm it can exchange a test message before any customer sees it.",
        },
        {
          title: "Prepare templates",
          desc: "Write the templates needed on day one — greeting, order update, appointment reminder — assign correct categories and submit with samples.",
        },
        {
          title: "Open for traffic",
          desc: "Start with inbound and small sends, watch the quality rating while volume builds, and only then schedule broadcasts against the number.",
        },
      ],
    },
    capabilities: {
      heading: "The rules, enforced where they matter",
      items: [
        {
          icon: "Clock",
          title: "Window rules in the composer",
          desc: "Inside 24 hours any free-form reply is allowed; outside it only an approved template. The composer blocks the wrong choice per thread.",
        },
        {
          icon: "Percent",
          title: "Category discipline",
          desc: "Wording checks keep service messages out of the marketing bucket, where Meta's rates are higher and opt-outs arrive faster.",
        },
        {
          icon: "Building",
          title: "One number per branch",
          desc: "Each branch registers its own number and display name under the business's verification, while the workspace stays a single login.",
        },
        {
          icon: "Download",
          title: "Evidence on hand",
          desc: "Consent records, template history and quality history exportable when a reviewer, a regulator or a customer asks for them.",
        },
        {
          icon: "Search",
          title: "One status view",
          desc: "Registration, verification, template and quality states collected in one place instead of only inside Meta's own dashboard.",
        },
      ],
    },
    faq: [
      {
        q: "Can we keep the number our customers already know?",
        a: "Yes, if it is a business number: migrate it to the Cloud API and customers keep messaging the same contact. The constraint is that a number can only be registered to one API provider at a time, so the migration includes releasing it from its current home — which is why the cutover window is planned rather than improvised.",
      },
      {
        q: "Why does our display name keep getting rejected?",
        a: "Usually it does not match the verified business name, contains a generic term or a location you do not operate in, or was submitted before verification finished. The submission checklist mirrors Meta's rules, so the common rejections are caught before the request is sent.",
      },
      {
        q: "What happens when the quality rating drops?",
        a: "Meta reduces messaging limits as the rating falls. MADHURA warns at medium, and at low it pauses scheduled waves instead of pushing them further, with a remediation list attached: drop cold segments, slow the cadence, and clear the reports and blocks driving the score.",
      },
      {
        q: "Who pays for the conversations?",
        a: "Meta prices each conversation window by template category and by the recipient's region, and charges once per window regardless of how many messages land inside it. MADHURA meters that consumption per number, template and campaign, so the cause of the charge is visible rather than bundled into one opaque total.",
      },
    ],
  },

  /* ── /platform/multi-tenant ─────────────────────────────────────────────── */
  {
    path: "/platform/multi-tenant",
    section: "Platform",
    renderer: "standard",
    meta: {
      title: "Multi-Tenant Platform — Brands & Branches, Isolated | Madhura",
      description:
        "Tenant isolation with brand and branch partitions, per-branch numbers and permissions, and consolidated leadership reporting under one contract.",
    },
    hero: {
      badge: "Platform · Multi-Tenant",
      title: "Brands and branches in one workspace, kept apart.",
      subtitle:
        "MADHURA is multi-tenant from the data layer up: a workspace holds brands, a brand holds branches, and every thread, contact and export resolves to exactly one of them. Operators work inside their own partition while leadership reads a consolidated view across all of them. One contract, one login screen, no accidental cross-visibility.",
      points: [
        "Workspace, brand and branch partitioned at the data layer",
        "Own numbers, queues, templates and hours per branch",
        "Consolidated reporting across every partition",
        "Permissions that stop one branch reading another",
      ],
      primaryCta: { label: "Start free trial", to: "/signup" },
      secondaryCta: { label: "Book a demo", to: "/demo" },
    },
    stats: [
      { value: "3", label: "Levels of ownership", note: "workspace, brand, branch" },
      { value: "0", label: "Cross-branch reads", note: "unless a role is explicitly granted one" },
      { value: "1", label: "Consolidated view", note: "leadership reads every branch together" },
      { value: "per-branch", label: "Numbers & templates", note: "each partition owns its own" },
    ],
    overview: {
      heading: "Isolation first, consolidation second",
      paragraphs: [
        "Multi-tenant software fails in one of two directions: partitions that leak, or partitions so total that nobody can manage the whole business. MADHURA solves both by scoping every row to a branch key at the data layer — queries are filtered before they run, not hidden in the interface — and by building leadership reporting as a deliberate, permissioned overlay on top.",
        "In practice: a Delhi agent searches contacts and finds Delhi contacts; a regional head granted cross-branch scope sees both of their regions in one queue view; the group operator sees delivery, response and conversation volume across every branch on a single chart. Visibility is a grant, never an accident of configuration.",
      ],
      bullets: [
        "Workspace owns the contract, security policy and the billing account",
        "Brands separate businesses that share a workspace: distinct audiences and identities",
        "Branches separate locations, languages or teams inside a brand",
        "Each branch keeps its own number, templates, queues, hours and retention",
        "Cross-branch roles are explicit, and every grant is written to the audit trail",
        "Consolidated reporting aggregates on read — no rows copied between partitions",
      ],
    },
    features: [
      {
        icon: "Layers",
        title: "Tenant partitioning",
        desc: "Every contact, thread, template and export carries a branch key, and queries filter on it at the data layer rather than in presentation code.",
      },
      {
        icon: "Building",
        title: "Brands & branches",
        desc: "Model the real organisation: a workspace for the group, brands for businesses, branches for locations or teams — each with its own settings.",
      },
      {
        icon: "Inbox",
        title: "Partitioned queues",
        desc: "Agents land in their own branch's threads by default; a supervisor with scope switches between assigned branches without a second login.",
      },
      {
        icon: "BarChart3",
        title: "Consolidated reporting",
        desc: "Roll delivery, response and volume metrics up to brand or workspace level, with drill-down back to the branch that produced each number.",
      },
      {
        icon: "Lock",
        title: "Scope-aware permissions",
        desc: "A role is only ever evaluated against the branch it was granted on; workspace-wide access is a separate, deliberate decision.",
      },
      {
        icon: "Download",
        title: "Controlled exports",
        desc: "Exports inherit the exporter's scope, so a branch manager's CSV contains their branch — and the export is logged either way.",
      },
    ],
    workflow: {
      heading: "How a new branch comes online",
      steps: [
        {
          title: "Create the partition",
          desc: "Add a branch under its brand. It inherits workspace security policy and nothing else — no contacts, no threads, no templates.",
        },
        {
          title: "Attach its identity",
          desc: "Register or assign the branch's WhatsApp number, display name, template library, business hours and queues.",
        },
        {
          title: "Grant the roles",
          desc: "Invite agents and supervisors with branch-scoped roles; cross-branch access is added last and explicitly, with the grant recorded.",
        },
        {
          title: "Report upward",
          desc: "The branch appears in consolidated reporting immediately, so leadership sees day-one volumes alongside every other partition.",
        },
      ],
    },
    capabilities: {
      heading: "Structure without friction",
      items: [
        {
          icon: "Globe",
          title: "Regional settings",
          desc: "Time zones, languages and date formats per branch, so SLA clocks and quiet hours match where the team actually works.",
        },
        {
          icon: "ShieldCheck",
          title: "Isolated retention",
          desc: "Retention windows and legal hold are set per partition — one branch's purge does not touch another's history.",
        },
        {
          icon: "Search",
          title: "Scoped search",
          desc: "Global search is bounded by what the role can see; the same query returns different results for different people, by design.",
        },
        {
          icon: "Users",
          title: "Shared services",
          desc: "A central support team or a shared template library can be granted cross-branch rights without flattening the structure.",
        },
        {
          icon: "Activity",
          title: "Access audit",
          desc: "Every cross-branch grant, transfer and export is written to the audit trail with actor, target and timestamp.",
        },
      ],
    },
    faq: [
      {
        q: "Can two brands share one workspace without seeing each other?",
        a: "Yes. Brand-level isolation keeps contacts, threads, templates and reports separate; a user must be granted brand or workspace scope to cross that line, and the grant is recorded. Most groups share security policy and billing at workspace level and leave everything else per brand.",
      },
      {
        q: "How can leadership see everything if data is partitioned?",
        a: "The consolidated view is a permissioned aggregate, not a merged copy: queries read across the partitions the role is scoped to and roll them up on read. No second copy of the data exists to leak or to fall out of sync with the branch it came from.",
      },
      {
        q: "Can a contact move between branches?",
        a: "Yes, as an explicit transfer: the thread history moves with the record, both branches see the transfer in their audit trails, and the receiving branch's permissions, hours and templates apply from that point on.",
      },
      {
        q: "Does multi-tenancy complicate our WhatsApp numbers?",
        a: "No, it maps cleanly onto it. Each branch typically registers its own number and display name under the business's verification, so customers reach the branch that serves them while your team keeps one workspace, one login and one bill.",
      },
    ],
  },

  /* ── /platform/roles-permissions ────────────────────────────────────────── */
  {
    path: "/platform/roles-permissions",
    section: "Platform",
    renderer: "standard",
    meta: {
      title: "Roles & Permissions — Branch-Scoped Access Control | Madhura",
      description:
        "A deny-by-default role model with branch scoping, separate export and delete grants, and an audit trail behind every action.",
    },
    hero: {
      badge: "Platform · Roles & Permissions",
      title: "Every action gated by role, branch and scope.",
      subtitle:
        "Permissions in MADHURA are deny-by-default: a new role can do nothing until something is granted, and every grant is bound to a branch. Agents answer, supervisors reassign and approve, admins configure, owners bill — and the two actions everyone forgets, exporting customer data and deleting it, are separate grants. Every decision lands in the audit trail.",
      points: [
        "Deny-by-default roles with explicit capability grants",
        "Branch-scoped access, cross-branch only when granted",
        "Export and delete as separate, revocable permissions",
        "Audit trail on actor, target and timestamp",
      ],
      primaryCta: { label: "Start free trial", to: "/signup" },
      secondaryCta: { label: "Book a demo", to: "/demo" },
    },
    stats: [
      { value: "0", label: "Default capabilities", note: "a new role starts with nothing" },
      { value: "branch", label: "Scope unit", note: "grants resolve to one partition" },
      { value: "2", label: "Extra gates", note: "export and delete are their own grants" },
      { value: "100%", label: "Actions audited", note: "who did what, to which record" },
    ],
    overview: {
      heading: "Least privilege that survives a real team",
      paragraphs: [
        "Permission models fail in practice when they are either too coarse — everyone becomes an admin because only admin can reassign a thread — or too fine, so nobody can remember what any of the eighty roles are allowed to do. MADHURA keeps the model small: a readable set of capabilities, evaluated against a branch scope, composed into roles you can explain without a diagram.",
        "The sensitive operations are not folded into a generic 'manage everything' right. Export, delete, template publish and cross-branch view are their own grants, so handing someone inbox access does not quietly hand them the customer database. Changes to roles, and actions taken under them, both land in the audit trail.",
      ],
      bullets: [
        "Built-in roles: owner, admin, supervisor, agent — plus custom roles per workspace",
        "Capabilities cover reply, assign, publish, campaign, export, delete and configure",
        "Scope is a branch, a set of branches, or the whole workspace",
        "API keys inherit their owner's role, so automation cannot exceed human rights",
        "Role changes record what was added or removed, and by whom",
        "Audit entries are read-only and retained per workspace policy",
      ],
    },
    features: [
      {
        icon: "Lock",
        title: "Role builder",
        desc: "Toggle capabilities on a readable matrix — roles as rows, actions as columns — and see immediately which branch scope the change applies to.",
      },
      {
        icon: "Building",
        title: "Branch scoping",
        desc: "A supervisor scoped to two branches sees exactly those two in search, queues and reports. For them, the rest of the workspace does not exist.",
      },
      {
        icon: "Users",
        title: "Built-in tiers",
        desc: "Owner, admin, supervisor and agent cover most teams on day one; clone one to make a custom role rather than starting from a blank sheet.",
      },
      {
        icon: "Download",
        title: "Export & delete gates",
        desc: "Bulk export and record deletion are separate grants, so customer data leaves the workspace only through someone given that specific right.",
      },
      {
        icon: "FileText",
        title: "Audit trail",
        desc: "Every login, reply, reassignment, grant, export and deletion written with actor, target and timestamp — filterable and exportable.",
      },
      {
        icon: "Terminal",
        title: "Scoped API keys",
        desc: "An integration key carries a role and a branch scope, so automation can do what its owner can do, and stops exactly there.",
      },
    ],
    workflow: {
      heading: "Setting up access the right way",
      steps: [
        {
          title: "Start from a built-in tier",
          desc: "Pick the closest of owner, admin, supervisor or agent. The defaults reflect how teams actually divide the work, so most setups begin by narrowing rather than by building.",
        },
        {
          title: "Bind the scope",
          desc: "Attach the role to a branch. If someone genuinely needs two, add the second explicitly — workspace-wide access is never the starting position.",
        },
        {
          title: "Add sensitive grants last",
          desc: "Export, delete, template publish and cross-branch view are added one at a time, each with a reason you have considered and can defend later.",
        },
        {
          title: "Review the trail",
          desc: "The audit log shows who holds what and what they did with it. Cross-branch grants and export rights are the two things worth reviewing on a schedule.",
        },
      ],
    },
    capabilities: {
      heading: "Control that answers real questions",
      items: [
        {
          icon: "ShieldCheck",
          title: "Separation of duties",
          desc: "Admins who configure the workspace can be kept from exporting its data, by splitting those two grants between different people.",
        },
        {
          icon: "MessageSquare",
          title: "Read-only participation",
          desc: "A role can follow threads without being able to answer them — useful for quality review, finance and new starters in week one.",
        },
        {
          icon: "Search",
          title: "Queryable audit",
          desc: "Filter by actor, action, branch and date range to answer who can currently see customer data, without opening a ticket to engineering.",
        },
        {
          icon: "RefreshCw",
          title: "Change history on roles",
          desc: "Editing a role records what was added or removed and by whom, so an over-broad grant is traceable to its author.",
        },
        {
          icon: "Users",
          title: "Offboarding in one action",
          desc: "Revoking a member stops their sessions and their API keys together, while their history stays attributed in the audit trail.",
        },
      ],
    },
    faq: [
      {
        q: "Can a branch manager see another branch's data?",
        a: "Not unless you grant it. Search, queues, reports and exports all filter on the role's branch scope by default. Cross-branch access is an additional, explicit grant on the role, and every change to that grant is written to the audit trail with the actor who made it.",
      },
      {
        q: "Who can export or delete customer records?",
        a: "Only roles carrying the export or delete capability, and neither is included in a default role. Because those grants are separate, giving someone supervisor rights does not also give them a way to walk out with the customer database.",
      },
      {
        q: "Do API keys bypass permissions?",
        a: "No. A key runs under the role and branch scope of the member who created it, and a departing member's keys are revoked along with their access. Sends still pass opt-out, blocklist and template rules regardless of who or what is holding the key.",
      },
      {
        q: "What if we need a role you do not ship?",
        a: "Clone the closest built-in role and toggle capabilities per branch. Roles can differ between branches, so a finance reviewer in one business unit need not hold the same rights in another, and both remain readable in the same matrix.",
      },
    ],
  },

  /* ── /pricing ───────────────────────────────────────────────────────────── */
  {
    path: "/pricing",
    section: "Platform",
    renderer: "standard",
    meta: {
      title: "Pricing — Plans, Metering and How Billing Works | Madhura",
      description:
        "What MADHURA meters — seats, branches and conversations — how Meta's conversation charges fit in, and how to compare the three tiers.",
    },
    hero: {
      badge: "Platform · Pricing",
      title: "Pay for the conversations, seats and branches you use.",
      subtitle:
        "MADHURA meters three things: the seats that log in, the branches that run their own numbers, and the conversations the workspace handles. Starter suits one team getting the inbox right; Growth adds branches, campaigns and automation at volume; Enterprise covers multi-branch groups with SSO, custom roles and invoicing. This page explains the metering so you can compare tiers without a spreadsheet.",
      points: [
        "Three meters: seats, branches and conversations",
        "WhatsApp charges follow Meta's category and region rates",
        "Starter, Growth and Enterprise compared qualitatively",
        "Volume terms and procurement at /pricing/enterprise",
      ],
      primaryCta: { label: "Start free trial", to: "/signup" },
      secondaryCta: { label: "Talk to sales", to: "/company/contact" },
    },
    stats: [
      { value: "3", label: "Meters", note: "seats, branches, conversations" },
      { value: "3", label: "Tiers", note: "Starter, Growth, Enterprise" },
      { value: "Meta", label: "Conversation rates", note: "category and region, per Meta's model" },
      { value: "live", label: "Usage metering", note: "visible before the cycle closes" },
    ],
    overview: {
      heading: "What you are actually billed for",
      paragraphs: [
        "Seats, branches and conversations are the meters. Everything that makes the product work — the shared inbox, contact records, template authoring, the automation builder, analytics — ships with the tier rather than appearing as a paid add-on, because gating core mechanics produces plans nobody can honestly compare.",
        "WhatsApp conversation charges are Meta's, not a MADHURA invention: Meta prices each conversation window by template category — utility, marketing, authentication — and by the recipient's region, and charges once per window no matter how many messages land inside its 24 hours. MADHURA meters and attributes that consumption per number, template and campaign, so the line on the invoice has a cause attached.",
      ],
      bullets: [
        "Starter: one team, a small number of branches, inbox and contacts in full",
        "Growth: more branches, campaigns, automation journeys, Flows, deeper analytics",
        "Enterprise: SSO, custom roles, consolidated reporting, invoicing and volume terms",
        "Seats counted per named member of the workspace, priced by the tier's allowance",
        "Conversations counted per window and attributed to branch, template and campaign",
        "Usage visible during the cycle, not only once the invoice arrives",
      ],
    },
    features: [
      {
        icon: "Users",
        title: "Seats",
        desc: "Named members who reply, configure or review. The role decides what each seat can do; the branch scope decides what it can see — neither changes the seat's price.",
      },
      {
        icon: "Building",
        title: "Branches",
        desc: "Each branch runs its own number, queues, templates and hours. Tiers differ in how many partitions a workspace may create.",
      },
      {
        icon: "Send",
        title: "Conversations",
        desc: "Metered the way Meta meters them — one window per customer conversation — and attributed to the branch, template and campaign that opened it.",
      },
      {
        icon: "Layers",
        title: "Included on every tier",
        desc: "Shared inbox, contact records, templates, campaigns, journeys and analytics are part of the product; higher tiers lift limits and add governance.",
      },
      {
        icon: "BarChart3",
        title: "Usage visibility",
        desc: "Current-cycle consumption for seats, branches and conversations sits inside the workspace, so an overage is something you see coming.",
      },
      {
        icon: "FileText",
        title: "One bill per workspace",
        desc: "A single invoice each cycle with plan and usage broken out; enterprise accounts can be invoiced against a purchase order.",
      },
    ],
    workflow: {
      heading: "How a billing cycle works",
      steps: [
        {
          title: "Pick a tier",
          desc: "Match the plan to your seats, branches and expected conversation volume. If volume or procurement terms need negotiating, /pricing/enterprise is the track.",
        },
        {
          title: "Invite the team",
          desc: "Seats are counted as members join, and roles and branch scope are assigned at the same moment — access and billing stay aligned.",
        },
        {
          title: "Use the product",
          desc: "Conversations accrue per window and are attributed as they close; the usage meters update during the cycle instead of after it.",
        },
        {
          title: "Review and adjust",
          desc: "At cycle end the invoice shows plan, seats, branches and conversation totals. Move tier before the next cycle starts, not after it has billed.",
        },
      ],
    },
    capabilities: {
      heading: "Comparing tiers without guesswork",
      items: [
        {
          icon: "Search",
          title: "Compare on structure",
          desc: "Each tier is described by what it lifts — partitions, governance, support — so you can line it up against your org chart before you line it up against a number.",
        },
        {
          icon: "Percent",
          title: "Meta's model, stated plainly",
          desc: "Template category and recipient region set the conversation rate; under Meta's schedule, utility and authentication cost less than marketing.",
        },
        {
          icon: "Download",
          title: "Cost attribution",
          desc: "Export conversation counts per branch, template and campaign to reconcile the invoice against what the workspace actually did.",
        },
        {
          icon: "RefreshCw",
          title: "Move tiers",
          desc: "Go up when a second branch opens or governance demands it, and back down at the next cycle if the team shrinks.",
        },
        {
          icon: "MessageCircle",
          title: "Talk it through",
          desc: "Volume, annual terms and multi-brand structures are quoted rather than self-served — start at /company/contact or /pricing/enterprise.",
        },
      ],
    },
    faq: [
      {
        q: "What exactly counts as a conversation?",
        a: "A conversation window between your business and a customer, as Meta defines it: one window covers any number of messages within its 24-hour span, and Meta prices that window by template category and by the recipient's region. MADHURA reports the count per number, template and branch so you can see what opened each one.",
      },
      {
        q: "Which plan should a single support team start on?",
        a: "Starter. It covers the shared inbox, contact records and the day-to-day workflow for one team. Move to Growth when you add branches, run campaigns or lean on automation journeys at volume — the qualitative comparison on this page is the whole decision, and /company/contact can put numbers against it.",
      },
      {
        q: "Are WhatsApp conversation charges included in the plan?",
        a: "No. They are Meta's charges under Meta's conversation pricing model, set by template category and recipient region. Plan fees cover seats, branches and the product itself, and MADHURA reports the consumption that drives the Meta line, so the two are separable on the invoice.",
      },
      {
        q: "Can we pay by invoice instead of a card?",
        a: "Enterprise accounts can be set up against a purchase order and invoiced each cycle, with terms agreed as part of the commercial discussion. Self-serve tiers are card-billed; /pricing/enterprise covers what procurement needs and who to speak to.",
      },
    ],
  },

  /* ── /pricing/enterprise ────────────────────────────────────────────────── */
  {
    path: "/pricing/enterprise",
    section: "Platform",
    renderer: "standard",
    meta: {
      title: "Enterprise Pricing — Procurement, Security Review & SLA | Madhura",
      description:
        "Volume pricing, SSO and custom roles, purchase-order invoicing, guided onboarding, SLA discussion and a security review before signature.",
    },
    hero: {
      badge: "Platform · Enterprise",
      title: "Enterprise procurement, security review and volume terms.",
      subtitle:
        "Enterprise is a commercial track, not a feature list: volume pricing negotiated against seats, branches and usage; SSO and custom role design; invoicing against a purchase order; and a guided onboarding for branch-by-branch rollouts. Terms that matter — support response, data handling, retention — are discussed and written into the agreement rather than implied by a badge.",
      points: [
        "Volume pricing quoted across seats, branches and usage",
        "SSO plus custom, branch-scoped role design",
        "SLA terms agreed and documented in the contract",
        "Security review material at /trust before signature",
      ],
      primaryCta: { label: "Talk to sales", to: "/company/contact" },
      secondaryCta: { label: "See our security posture", to: "/trust" },
    },
    stats: [
      { value: "SLA", label: "Support terms", note: "agreed in the contract, not a badge" },
      { value: "SSO", label: "Identity", note: "members authenticate through your directory" },
      { value: "4", label: "Review stages", note: "commercial, security, legal, onboarding" },
      { value: "PO", label: "Procurement", note: "purchase orders and cycle-based invoicing" },
    ],
    overview: {
      heading: "What enterprise actually changes",
      paragraphs: [
        "On a self-serve plan the product is the product: you sign up, invite people and send. Enterprise changes the relationship around it. Pricing is negotiated against expected volume, identity plugs into your directory, roles are designed to match the org, and the paperwork — master agreement, purchase order, invoicing cadence, security questionnaire — is handled as a track rather than as a support ticket.",
        "The technical surface is the same one every tier runs on. The difference is what your information security team gets before signature: how tenants are partitioned, where data sits, what is logged and for how long, drawn from the material at /trust and answered directly rather than paraphrased from marketing copy.",
      ],
      bullets: [
        "Volume pricing across seats, branches and conversation volume, quoted per agreement",
        "SSO for member sign-in, with roles and branch scope applied after authentication",
        "Custom roles designed against your org chart and reviewed before go-live",
        "Security review: documentation, architecture answers and questionnaire support",
        "Onboarding: number registration, template strategy, migration, admin enablement",
        "Commercial terms: master agreement, purchase order, invoicing cadence, renewal dates",
      ],
    },
    features: [
      {
        icon: "Percent",
        title: "Volume pricing",
        desc: "Quoted against expected seats, branches and conversation volume, with each meter named in the agreement so finance can forecast the bill.",
      },
      {
        icon: "ShieldCheck",
        title: "SSO & identity",
        desc: "Members authenticate through your directory; MADHURA roles and branch scope are applied after sign-in, so offboarding happens in one place.",
      },
      {
        icon: "Lock",
        title: "Custom roles",
        desc: "Role design maps your org chart onto capabilities and branch scope, then gets walked through with your security team before rollout.",
      },
      {
        icon: "FileText",
        title: "Procurement & invoicing",
        desc: "Master agreement, purchase order and cycle-based invoicing, with one commercial point of contact for the thread instead of a new inbox each time.",
      },
      {
        icon: "Rocket",
        title: "Guided onboarding",
        desc: "A rollout plan for branch-by-branch activation: number registration, template library, data migration and admin enablement sequenced so a go-live does not stall.",
      },
      {
        icon: "Clock",
        title: "SLA discussion",
        desc: "Support response, escalation paths and incident notification are negotiated and written into the agreement — terms you can hold us to rather than read on a page.",
      },
    ],
    workflow: {
      heading: "How an enterprise evaluation runs",
      steps: [
        {
          title: "Scope",
          desc: "Confirm seats, branches, expected conversation volume and the systems that must integrate, so the quote describes your real footprint.",
        },
        {
          title: "Technical & security review",
          desc: "Your architecture and infosec teams work from /trust and the security material; open questions are answered directly during the evaluation.",
        },
        {
          title: "Commercial terms",
          desc: "Volume pricing, master agreement, purchase order and invoicing cadence are agreed, alongside the support terms you want written into the SLA.",
        },
        {
          title: "Onboarding",
          desc: "Numbers registered, templates authored and approved, data migrated, roles configured — then branches activated in waves rather than all at once.",
        },
      ],
    },
    capabilities: {
      heading: "The parts procurement asks about",
      items: [
        {
          icon: "Users",
          title: "A single commercial thread",
          desc: "One point of contact for pricing, rollout and renewal questions, so context is not re-explained to a new inbox each time it is needed.",
        },
        {
          icon: "Download",
          title: "Data terms before signature",
          desc: "Retention windows, export formats and deletion handling are set out during evaluation rather than discovered after the purchase order.",
        },
        {
          icon: "Building",
          title: "Multi-brand structures",
          desc: "Groups running several brands under one workspace get pricing and reporting structured the same way their org chart is.",
        },
        {
          icon: "Activity",
          title: "Review-ready reporting",
          desc: "Consolidated and per-branch reports exported for internal review, with audit trails behind the numbers they cite.",
        },
        {
          icon: "Globe",
          title: "Rollout sequencing",
          desc: "Branches go live in waves with a checkpoint between them, so a problem in one becomes a contained fix rather than a migration incident.",
        },
      ],
    },
    faq: [
      {
        q: "Do we have to move everyone at once?",
        a: "No. Enterprise onboarding is usually branch by branch: one number, one queue and one template set goes live, is verified in real traffic, then the next branch follows. The agreement covers the full footprint from day one, so sequencing is an operational choice rather than a commercial one.",
      },
      {
        q: "Can our security team review before we sign?",
        a: "Yes — that is the point of the track. Architecture, tenant isolation, access control, retention and logging material lives at /trust, and questionnaires are worked through directly during evaluation rather than after a purchase order has been raised.",
      },
      {
        q: "What does the SLA actually cover?",
        a: "Support response and escalation commitments, incident notification, and what happens if those commitments are missed — all negotiated and written into the agreement. No number is published here because the term that matters is the one you can hold us to in your own contract.",
      },
      {
        q: "Can we be invoiced rather than pay by card?",
        a: "Yes. Enterprise agreements run against a purchase order, invoiced each cycle with terms agreed in the master agreement. Volume pricing, renewal dates and any usage thresholds are stated in the same document, so finance sees the whole commitment in one place.",
      },
    ],
  },

  /* ── /changelog ─────────────────────────────────────────────────────────── */
  {
    path: "/changelog",
    section: "Platform",
    renderer: "standard",
    meta: {
      title: "Changelog — What Shipped in MADHURA | Madhura",
      description:
        "How releases ship, what every release note contains, where older entries live, and where API-specific changes are documented.",
    },
    hero: {
      badge: "Platform · Changelog",
      title: "What shipped, what changed, and what you should check.",
      subtitle:
        "MADHURA ships in small batches, and every batch lands here as a dated entry: what was added, what changed, what was fixed, and whether anything about existing behaviour needs your attention. API-specific changes are versioned separately at /developers/changelog, so an integration owner and a workspace admin read the same release from the angle that affects them. Older entries stay published.",
      points: [
        "Dated entries: added, changed, fixed, deprecated",
        "Behaviour changes flagged before the feature copy",
        "API and webhook changes at /developers/changelog",
        "A full archive rather than the latest release only",
      ],
      primaryCta: { label: "Start free trial", to: "/signup" },
      secondaryCta: { label: "Read developer changes", to: "/developers/changelog" },
    },
    stats: [
      { value: "2", label: "Changelogs", note: "product here, API for developers" },
      { value: "4", label: "Entry categories", note: "added, changed, fixed, deprecated" },
      { value: "full", label: "Archive", note: "every past entry stays published" },
      { value: "dated", label: "Every entry", note: "shipped date and affected areas attached" },
    ],
    overview: {
      heading: "A changelog is a promise to whoever owns the workspace",
      paragraphs: [
        "Teams get into trouble with software that changes underneath them: a field moves, an export gains a column, an automation's default behaviour tightens — and nobody finds out until a report breaks on a Monday. This changelog exists so the person who owns the workspace learns about a change from the log rather than from the incident.",
        "Entries are written for operators rather than for a release manager: what changed, why it matters, what you have to do — usually nothing — and which areas are affected. Anything that could alter existing behaviour is flagged at the top of the entry and repeated in the product where the change actually lands.",
      ],
      bullets: [
        "Every entry dated, titled and tagged with the areas it touches",
        "Added, changed, fixed and deprecated as the standard categories",
        "Behaviour and breaking changes flagged ahead of the feature description",
        "Older entries remain readable; the archive does not roll off the end",
        "API, webhook and SDK changes versioned at /developers/changelog",
        "Deprecations carry a date and a migration path, not just a notice",
      ],
    },
    features: [
      {
        icon: "FileText",
        title: "Structured entries",
        desc: "Category, affected areas, summary and the operator action required — the same shape every time, so a year of entries can be scanned in minutes.",
      },
      {
        icon: "CheckCircle2",
        title: "Change flags",
        desc: "Anything that alters existing behaviour — defaults, exports, permissions — is marked at the top of the entry, before the feature description.",
      },
      {
        icon: "Clock",
        title: "Dated archive",
        desc: "Each entry carries its shipped date and stays published, so 'when did this change?' always has an answer you can quote internally.",
      },
      {
        icon: "RefreshCw",
        title: "Deprecation notices",
        desc: "Retired behaviour gets an entry with the replacement and the date it stops working, so a migration can be planned instead of discovered.",
      },
      {
        icon: "Terminal",
        title: "Developer track",
        desc: "API, webhook and SDK changes are documented at /developers/changelog with version detail and migration notes, kept in step with the product entry.",
      },
      {
        icon: "Search",
        title: "Findable",
        desc: "Filter by area — inbox, contacts, campaigns, automations, platform, billing — or search by the feature name you are trying to trace.",
      },
    ],
    workflow: {
      heading: "How a release gets published",
      steps: [
        {
          title: "Ship",
          desc: "Changes go out in small batches, each tagged with the areas it touches and whether it alters existing behaviour.",
        },
        {
          title: "Write the note",
          desc: "The entry states what changed, why it changed and what an admin has to do, if anything — in the terms of the team that will live with it.",
        },
        {
          title: "Flag the impact",
          desc: "Behaviour, permission and export changes are called out at the top of the entry and surfaced in the product where the change lands.",
        },
        {
          title: "Publish and archive",
          desc: "The entry joins the dated archive, and API-facing changes are cross-posted with version detail to /developers/changelog.",
        },
      ],
    },
    capabilities: {
      heading: "Reading the log like an owner",
      items: [
        {
          icon: "ShieldCheck",
          title: "Security-relevant changes",
          desc: "Access control, retention and permission changes appear on the same timeline, so an internal review can reconstruct what moved and when.",
        },
        {
          icon: "Sliders",
          title: "Defaults spelled out",
          desc: "When a default, an export shape or a journey's behaviour changes, the note says what the old behaviour was, not only what the new one is.",
        },
        {
          icon: "MessageCircle",
          title: "Pointers into the product",
          desc: "Where a change lands, the note names the screen or setting to check, so the fix does not start with a search.",
        },
        {
          icon: "Globe",
          title: "One release, two documents",
          desc: "Product notes and API notes stay in step, so a workspace admin and an integration owner reach the same conclusion about the same release.",
        },
      ],
    },
    faq: [
      {
        q: "How often do you release?",
        a: "Continuously and in small batches rather than one monthly dump, which keeps each entry small enough to actually read. If you only want material changes, follow the changed and deprecated categories; the added stream is the low-drama one.",
      },
      {
        q: "Do I have to act on every entry?",
        a: "Mostly no — each note states the action required, and when the answer is nothing the note says so. The exceptions are deprecations, which carry a date and a migration path, and permission or export changes, which can warrant a role review.",
      },
      {
        q: "Where do API and webhook changes go?",
        a: "To /developers/changelog, with version detail and migration notes. The product changelog still mentions them when they change what an admin sees, but payload, endpoint and SDK material lives with the developer documentation where an integration owner will look for it.",
      },
      {
        q: "Can I see what changed six months ago?",
        a: "Yes. Entries are dated and never rotate out of the archive. Filter by area or search the feature name, and the result is a timeline you can reconstruct an internal change review from.",
      },
    ],
  },
];
