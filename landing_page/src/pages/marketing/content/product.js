/* Product section pages — /product/* ------------------------------------------------
   Every entry is data, not markup. `MarketingPage` renders it. Keep the shape
   stable: path / meta / hero / stats / overview / features / workflow /
   capabilities / faq / cta / related.
   ------------------------------------------------------------------------------- */

export const PRODUCT_PAGES = [
  {
    path: "/product/live-inbox",
    section: "Product",
    renderer: "standard",
    meta: {
      title: "Live Inbox — Shared WhatsApp Inbox for Teams | Madhura",
      description:
        "One shared WhatsApp thread per customer with assignment, collision detection, private notes, SLA timers and full audit history for support and sales teams.",
    },
    hero: {
      badge: "Product · Live Inbox",
      title: "Every WhatsApp conversation, in one accountable inbox.",
      highlight: "one accountable inbox",
      subtitle:
        "Stop copying screenshots between phones. Live Inbox turns WhatsApp into a shared, assigned, measurable workspace where no customer is left on read and no agent double-replies.",
      points: [
        "Agent collision detection in real time",
        "Round-robin and skill-based assignment",
        "SLA timers, snooze and follow-up states",
        "Private internal notes invisible to the customer",
      ],
      primaryCta: { label: "Start free trial", to: "/signup" },
      secondaryCta: { label: "See it in a demo", to: "/company/contact" },
    },
    stats: [
      { value: "12s", label: "Median first response", note: "across onboarding teams" },
      { value: "1", label: "Thread per customer", note: "no matter how many agents" },
      { value: "30+", label: "Concurrent agents", note: "on a single number" },
      { value: "100%", label: "Actions audited", note: "who replied, when, why" },
    ],
    overview: {
      heading: "Shared ownership without shared chaos",
      paragraphs: [
        "A WhatsApp number used by five people is a liability: customers get duplicate answers, questions fall between shifts, and nobody can prove who promised what. Live Inbox puts a strict ownership model on top of the channel — one thread, one assignee, one source of truth.",
        "Assignment, status and history live on the thread itself. Agents see what a colleague is typing before they type it, supervisors see every thread that has breached its SLA, and the customer only ever experiences a single, continuous conversation.",
      ],
      bullets: [
        "Thread states: open, pending, snoozed, resolved and reopened",
        "Assignment rules by language, product line, branch or load",
        "Whisper mode — supervisors coach agents without the customer seeing",
        "Full message, assignment and status history per thread",
        "Macros that insert a reply and change state in one keystroke",
        "Offline handoff that survives an agent's browser closing",
      ],
    },
    features: [
      {
        icon: "Inbox",
        title: "Unified thread",
        desc: "Every inbound message, media item and template reply lands in one chronological thread per contact — across agents, shifts and branches.",
      },
      {
        icon: "Users",
        title: "Collision detection",
        desc: "Live presence indicators show who is viewing and typing in a thread, so two agents never send contradictory answers at once.",
      },
      {
        icon: "Clock",
        title: "SLA timers",
        desc: "First-response and resolution targets per queue, with visible countdowns and escalation to a supervisor when a clock runs out.",
      },
      {
        icon: "MessageSquare",
        title: "Internal notes",
        desc: "Attach context for the next agent — order IDs, escalation history, credit limits — without ever leaking it to the customer.",
      },
      {
        icon: "Filter",
        title: "Smart queues",
        desc: "Filter by assignee, status, branch, tag, unread, or a saved view your team lives in. Views are shareable across the workspace.",
      },
      {
        icon: "ShieldCheck",
        title: "Audit trail",
        desc: "Every reply, reassignment, export and deletion is recorded with actor and timestamp — ready for compliance review.",
      },
    ],
    workflow: {
      heading: "How a conversation moves through the inbox",
      steps: [
        {
          title: "Arrives",
          desc: "An inbound message hits the webhook, is matched to an existing contact or created as a new one, and opens a thread in the right queue.",
        },
        {
          title: "Assigned",
          desc: "Routing rules pick an owner by round-robin, skill or load. The assignee is notified; everyone else sees the thread is taken.",
        },
        {
          title: "Worked",
          desc: "The agent replies, inserts a macro, attaches an internal note or escalates — with live presence preventing duplicate replies.",
        },
        {
          title: "Closed",
          desc: "Snooze until a promised date, resolve, or reopen automatically when the customer replies. Everything is logged for the audit trail.",
        },
      ],
    },
    capabilities: {
      heading: "Built for teams that share a number",
      items: [
        { icon: "Building", title: "Branch-aware", desc: "Each branch or brand keeps its own queues and permissions while leadership sees one consolidated view." },
        { icon: "Search", title: "Deep search", desc: "Search message text, contact fields, tags, order numbers and attachment names across the whole history." },
        { icon: "Paperclip", title: "Rich media", desc: "Images, documents, audio notes, stickers and location with inline previews and virus-scanned downloads." },
        { icon: "Radio", title: "Realtime by default", desc: "Socket-driven updates mean a new message appears on every open screen without a refresh." },
        { icon: "Lock", title: "Granular permissions", desc: "Control who can export, delete, assign, or message outside office hours — per role and per branch." },
      ],
    },
    faq: [
      {
        q: "Can several agents use the same WhatsApp number at once?",
        a: "Yes. That is the point of Live Inbox. The number stays a single official WhatsApp Business API or connected endpoint, while the workspace lets many agents read, assign and reply from the same thread with presence indicators preventing duplicate answers.",
      },
      {
        q: "What happens when an agent goes offline mid-conversation?",
        a: "The thread stays assigned but its SLA clock keeps running. Supervisors get an escalation notice, and any teammate can reassign the thread in one click. The full history — including unsent drafts that were saved — remains attached to the thread.",
      },
      {
        q: "Can customers reach us outside business hours?",
        a: "Inbound messages are always accepted. Outside hours the thread is auto-snoozed with a scheduled reply, then reopens in the queue at the start of the next shift so nothing is silently dropped.",
      },
      {
        q: "Does Live Inbox work with our existing CRM?",
        a: "Yes. Contacts, tags and custom fields sync through the REST API and webhooks, and the Universal CRM Connector can mirror threads into an existing CRM record so your team never leaves their system of record.",
      },
      {
        q: "How is conversation history retained?",
        a: "Retention is configurable per workspace and per branch, with legal hold available. Exports are available as CSV or JSON and every export is written to the audit log with the exporting user's identity.",
      },
    ],
    cta: {
      title: "Give your customers one thread, not five agents.",
      sub: "Set up a shared inbox in under ten minutes and migrate your team without losing history.",
      primary: { label: "Start free trial", to: "/signup" },
      secondary: { label: "Read the docs", to: "/docs" },
    },
    related: ["/product/campaigns", "/product/automations", "/product/analytics"],
  },

  {
    path: "/product/campaigns",
    section: "Product",
    renderer: "standard",
    meta: {
      title: "Campaigns — Compliant WhatsApp Broadcasts at Scale | Madhura",
      description:
        "Build, segment and broadcast WhatsApp campaigns with throttled delivery, opt-out handling, live delivery analytics and Meta template compliance.",
    },
    hero: {
      badge: "Product · Campaigns",
      title: "Broadcast at scale without burning the channel.",
      highlight: "without burning the channel",
      subtitle:
        "Campaigns pairs audience segmentation with rate-aware delivery, so a launch to 200,000 contacts lands in the inbox instead of in a Meta quality ban.",
      points: [
        "Segment by tags, fields, activity and opt-in status",
        "Rate-limited sends that respect per-number throughput",
        "Automatic opt-out and suppression lists",
        "Live delivery, read and reply analytics per variant",
      ],
      primaryCta: { label: "Start free trial", to: "/signup" },
      secondaryCta: { label: "Plan a broadcast", to: "/company/contact" },
    },
    stats: [
      { value: "98.4%", label: "Median delivery rate", note: "on opted-in audiences" },
      { value: "0", label: "Sends to opted-out", note: "suppression is enforced at send time" },
      { value: "4", label: "Waves per campaign", note: "warm-up pacing for new numbers" },
      { value: "live", label: "Delivery telemetry", note: "updates while the campaign runs" },
    ],
    overview: {
      heading: "A campaign is a controlled send, not a blast",
      paragraphs: [
        "Most WhatsApp bans come from velocity, not content. Campaigns schedules your broadcast in waves, respects each number's messaging limit, and pauses automatically when quality rating or throughput degrades — then tells you exactly what to fix.",
        "Audience building is explicit: you compose a segment from tags, custom fields, last-activity windows and opt-in state, preview the exact recipient count, and see the excluded population with the reason each contact was dropped.",
      ],
      bullets: [
        "Segment builder with live recipient and exclusion counts",
        "Wave scheduling with per-number throughput caps",
        "Quality-rating guardrails that pause a degrading campaign",
        "A/B variant testing on the first wave, winner to the rest",
        "UTM tagging and click tracking on link buttons",
        "Full campaign history with reproducible audience snapshots",
      ],
    },
    features: [
      {
        icon: "Users",
        title: "Segment builder",
        desc: "Compose audiences from tags, custom fields, branch, last-message date, purchase history and boolean opt-in state — with live counts as you filter.",
      },
      {
        icon: "Send",
        title: "Wave scheduling",
        desc: "Split a send into waves with delays between them, warm up new numbers gradually, and cap throughput per connected number.",
      },
      {
        icon: "ShieldCheck",
        title: "Compliance guardrails",
        desc: "Opt-outs, blocklists and template category rules are enforced at send time, so a bad segment can never reach a restricted contact.",
      },
      {
        icon: "BarChart3",
        title: "Live analytics",
        desc: "Sent, delivered, read, replied and failed — streaming as the campaign runs, with failure reasons broken down by error code.",
      },
      {
        icon: "Layers",
        title: "A/B variants",
        desc: "Test two bodies or headers on a slice of the audience, pick the winner on open rate, and send it to the remaining recipients.",
      },
      {
        icon: "RotateCw",
        title: "Retry & recovery",
        desc: "Retryable failures are requeued automatically; permanent failures move to a review list with the reason attached.",
      },
    ],
    workflow: {
      heading: "From idea to inbox in four steps",
      steps: [
        {
          title: "Build the audience",
          desc: "Pick filters, review the included and excluded counts, and confirm opt-in state for every recipient in the segment.",
        },
        {
          title: "Choose the message",
          desc: "Select an approved template or free-form message, personalise variables against real contact fields, and preview on device.",
        },
        {
          title: "Schedule the waves",
          desc: "Set start time, wave size, spacing and per-number caps. The scheduler estimates completion and flags limit risk up front.",
        },
        {
          title: "Watch and act",
          desc: "Monitor live telemetry, pause on anomaly, export failures, and hand replied contacts straight to the Live Inbox team.",
        },
      ],
    },
    capabilities: {
      heading: "Operational control over every send",
      items: [
        { icon: "Clock", title: "Send windows", desc: "Respect customer local time zones and quiet hours so a campaign never lands at 3am." },
        { icon: "Percent", title: "Promo & catalogue", desc: "Attach product cards, CTAs and discount codes with per-campaign tracking links." },
        { icon: "Download", title: "Reporting export", desc: "Push campaign results to CSV or your warehouse, or subscribe to webhook events." },
        { icon: "RefreshCw", title: "Recurring sends", desc: "Duplicate a campaign with its audience and schedule for weekly or monthly cadences." },
        { icon: "Lock", title: "Approval flows", desc: "Draft, review and approve states so an intern cannot send to 200k contacts unattended." },
      ],
    },
    faq: [
      {
        q: "How many contacts can one campaign reach?",
        a: "There is no platform-imposed ceiling — the practical limit is your Meta messaging limit and number quality. Campaigns will split the send into waves and warn you before you exceed the current tier, rather than letting the send fail halfway through.",
      },
      {
        q: "What stops us messaging people who opted out?",
        a: "Opt-out is stored on the contact and enforced at send time. A recipient is excluded even if they are inside your segment, and the exclusion reason is recorded so you can prove why the final recipient count differs from the segment count.",
      },
      {
        q: "Can campaigns run without an approved template?",
        a: "Inside the 24-hour customer service window a free-form message is allowed. Outside that window Meta requires an approved template, so the composer will block the send and route you to Templates for approval.",
      },
      {
        q: "What happens if our number quality rating drops?",
        a: "The campaign pauses automatically, the affected waves are held rather than dropped, and you get a remediation checklist — usually removing stale segments and slowing the wave cadence. Resume continues from where it stopped.",
      },
      {
        q: "Can we schedule campaigns for a future date?",
        a: "Yes. Campaigns can be scheduled with a start date, wave spacing and an end condition, and everything is queued server-side so closing your browser does not cancel the send.",
      },
    ],
    cta: {
      title: "Send the campaign your compliance team approves of.",
      sub: "Segment, schedule and measure a broadcast end to end — from one workspace.",
      primary: { label: "Start free trial", to: "/signup" },
      secondary: { label: "Talk to sales", to: "/company/contact" },
    },
    related: ["/product/templates", "/product/analytics", "/product/live-inbox"],
  },

  {
    path: "/product/templates",
    section: "Product",
    renderer: "standard",
    meta: {
      title: "Templates — Meta-Approved WhatsApp Message Templates | Madhura",
      description:
        "Author, version and QA Meta-approved WhatsApp message templates with variables, media headers, interactive buttons and quality tracking.",
    },
    hero: {
      badge: "Product · Templates",
      title: "Templates that get approved the first time.",
      highlight: "approved the first time",
      subtitle:
        "A template workspace with variable validation, category checks, side-by-side versioning and quality monitoring — so a rejected template never stalls a campaign.",
      points: [
        "Pre-flight validation before you submit to Meta",
        "Variable mapping against real contact fields",
        "Version history with rollback",
        "Quality and utility-category monitoring",
      ],
      primaryCta: { label: "Start free trial", to: "/signup" },
      secondaryCta: { label: "Review template strategy", to: "/company/contact" },
    },
    stats: [
      { value: "2-3h", label: "Typical Meta review", note: "marketing category can be longer" },
      { value: "v∞", label: "Version history", note: "diff, rollback, audit" },
      { value: "0", label: "Broken variables", note: "validated before submission" },
      { value: "5", label: "Header types", note: "text, image, video, document" },
    ],
    overview: {
      heading: "Treat templates as source code, not copy",
      paragraphs: [
        "Templates are the contract between you and Meta: a typo is a rejection, a broken variable is a customer receiving literal braces, and a downgraded quality rating silently caps your reach. Templates brings engineering discipline to that surface.",
        "Each template carries its language, category, body, header, footer, buttons and variable schema. You preview with real sample data, run the pre-flight rules that mirror Meta's rejection reasons, and submit only when the check is clean.",
      ],
      bullets: [
        "Static and dynamic headers: text, image, video, document",
        "Quick-reply and URL buttons with tracked parameters",
        "Per-language variants grouped under one template name",
        "Sample-data preview rendered exactly as the customer sees it",
        "Rejection reasons explained in plain language with fixes",
        "Quality score monitoring with downgrade early warning",
      ],
    },
    features: [
      {
        icon: "FileText",
        title: "Structured authoring",
        desc: "Compose header, body, footer and buttons in a guided editor that mirrors Meta's schema, so structure errors are impossible to submit.",
      },
      {
        icon: "CheckCircle2",
        title: "Pre-flight validation",
        desc: "Detects unresolved variables, unsupported characters, marketing-category wording and button limits before you waste a review cycle.",
      },
      {
        icon: "Layers",
        title: "Version control",
        desc: "Every edit creates a new version with a diff. Roll back instantly, and see which campaigns used which version.",
      },
      {
        icon: "Globe",
        title: "Multi-language",
        desc: "Maintain translations side by side under one template name and fall back to the default language when a translation is missing.",
      },
      {
        icon: "Activity",
        title: "Quality monitoring",
        desc: "Track per-template quality rating and user reports, and get warned before a downgrade limits who you can reach.",
      },
      {
        icon: "Sliders",
        title: "Variable mapping",
        desc: "Bind {{1}}, {{2}} to contact fields, order data or API payloads, with a sample fill for every variable during preview.",
      },
    ],
    workflow: {
      heading: "The template lifecycle",
      steps: [
        {
          title: "Author",
          desc: "Pick a category, write the body, add a header and buttons, and bind each variable to a data source.",
        },
        {
          title: "Validate",
          desc: "Pre-flight runs Meta's common rejection rules locally and highlights the exact line that would fail review.",
        },
        {
          title: "Submit",
          desc: "Push to Meta for approval and watch status live: submitted, pending, approved, rejected — with the reason attached.",
        },
        {
          title: "Operate",
          desc: "Use in campaigns, automations and inbox macros; monitor quality; branch a new version when the message needs to change.",
        },
      ],
    },
    capabilities: {
      heading: "Everything around the message itself",
      items: [
        { icon: "Search", title: "Template library", desc: "Search by name, category, language, status or the campaign that used it." },
        { icon: "MessageCircle", title: "Inbox macros", desc: "Approved templates are one keystroke away inside Live Inbox threads." },
        { icon: "Zap", title: "Automation-ready", desc: "Any approved template can be used as a node in an automation or drip sequence." },
        { icon: "ShieldCheck", title: "Category discipline", desc: "Wording checks keep utility messages out of the marketing bucket where they attract opt-outs." },
        { icon: "Download", title: "Bulk import", desc: "Import existing templates from Meta or another workspace and normalise them into one library." },
      ],
    },
    faq: [
      {
        q: "Why was my template rejected?",
        a: "Most rejections are variable placeholders without sample values, marketing wording in a utility template, incomplete sentences, or a call to action that does not match the landing URL's domain. Templates shows the rejection reason next to the offending line with a suggested fix.",
      },
      {
        q: "Can I edit an approved template?",
        a: "You can submit a new version with edits; the approved version stays live until Meta approves the replacement. Some changes — such as renaming or changing the category — create a new template entirely, which the editor flags before you start.",
      },
      {
        q: "How long does approval take?",
        a: "Utility and authentication templates are usually reviewed within a few hours; marketing templates frequently take longer. Status is polled live, and automations that reference a pending template are held rather than failing silently.",
      },
      {
        q: "Do variables cost extra?",
        a: "Variables are free — you are charged per delivered message. Dynamic media headers follow Meta's current pricing for the media type, which the composer shows before you submit.",
      },
      {
        q: "How many languages can one template have?",
        a: "As many as your business needs. Each language is maintained as its own variant under a single template name, and the correct one is selected from the recipient's profile language with fallback to your default.",
      },
    ],
    cta: {
      title: "Ship templates your reviewers approve.",
      sub: "Validate locally, submit once, and keep quality high across every language you send in.",
      primary: { label: "Start free trial", to: "/signup" },
      secondary: { label: "Read the docs", to: "/docs" },
    },
    related: ["/product/campaigns", "/product/automations", "/product/live-inbox"],
  },

  {
    path: "/product/automations",
    section: "Product",
    renderer: "standard",
    meta: {
      title: "Automations — Event-Driven WhatsApp Journeys | Madhura",
      description:
        "Build event-driven WhatsApp journeys: triggers, conditions, delays, drip sequences, reminders and payment follow-ups with full run history.",
    },
    hero: {
      badge: "Product · Automations",
      title: "Journeys that run whether or not anyone is watching.",
      highlight: "whether or not anyone is watching",
      subtitle:
        "Triggers, conditions, delays and actions composed into visual journeys — from welcome sequences to abandoned-payment recovery — with every run logged and replayable.",
      points: [
        "Triggers on inbound text, webhook, tag, date or payment events",
        "Branching conditions with wait and retry semantics",
        "Drip sequences with quiet hours and frequency caps",
        "Per-run history you can inspect and replay",
      ],
      primaryCta: { label: "Start free trial", to: "/signup" },
      secondaryCta: { label: "Design a journey", to: "/company/contact" },
    },
    stats: [
      { value: "<1s", label: "Trigger to first action", note: "event-driven, not scheduled polling" },
      { value: "24/7", label: "Coverage", note: "quiet hours respected automatically" },
      { value: "100%", label: "Runs logged", note: "inputs, branches taken, outcomes" },
      { value: "0", label: "Duplicate sends", note: "idempotency keys on every action" },
    ],
    overview: {
      heading: "From manual follow-up to a system",
      paragraphs: [
        "The work that quietly leaks out of a support team is never the hard work — it is the second follow-up, the receipt that was never sent, the payment link nobody re-issued. Automations makes those obligations explicit and then discharges them.",
        "Every automation is a directed graph: a trigger enters, conditions route, delays hold, actions send. Runs are idempotent, so a retried webhook cannot double-message a customer, and each node records what it received and what it did.",
      ],
      bullets: [
        "Triggers: inbound keyword, new contact, tag added, webhook, schedule, payment status",
        "Actions: send template, assign thread, add tag, update field, call webhook, notify team",
        "Conditions on any contact field, tag, branch, language or message content",
        "Wait nodes with business hours, quiet hours and maximum-duration timeouts",
        "Frequency caps so a contact can never be over-messaged in a window",
        "Dry-run mode that simulates a journey against sample contacts before go-live",
      ],
    },
    features: [
      {
        icon: "Zap",
        title: "Visual builder",
        desc: "Drag triggers, conditions, delays and actions onto a canvas, connect them, and see invalid connections rejected as you draw.",
      },
      {
        icon: "GitBranch",
        title: "Conditional branching",
        desc: "Route on contact fields, tags, order value, branch, language or anything your webhook payload carries.",
      },
      {
        icon: "Clock",
        title: "Delays & cadence",
        desc: "Hold for a duration, until a specific time, or until the next business window — with hard caps on how long a contact may wait.",
      },
      {
        icon: "RefreshCw",
        title: "Retry semantics",
        desc: "Failed actions retry with backoff, then escalate to a human queue instead of silently disappearing.",
      },
      {
        icon: "Activity",
        title: "Run inspector",
        desc: "Open any run to see the exact path taken, payloads at each node, and the timestamps — perfect for debugging a customer complaint.",
      },
      {
        icon: "ShieldCheck",
        title: "Guardrails",
        desc: "Global suppression, opt-out checks and per-contact frequency caps are applied to every automated send, no exceptions.",
      },
    ],
    workflow: {
      heading: "Building a journey",
      steps: [
        {
          title: "Choose a trigger",
          desc: "Start from an inbound keyword, a CRM event, a webhook, a schedule or a payment status change.",
        },
        {
          title: "Shape the path",
          desc: "Add conditions and waits so the journey adapts to what the customer actually did, not what you hoped they would do.",
        },
        {
          title: "Dry-run",
          desc: "Simulate against sample contacts and inspect every node output before a single real message goes out.",
        },
        {
          title: "Publish & monitor",
          desc: "Go live, watch active-run counts, and use the run inspector whenever a contact's experience needs explaining.",
        },
      ],
    },
    capabilities: {
      heading: "Where automations earn their keep",
      items: [
        { icon: "MessageCircle", title: "Welcome journeys", desc: "Greet, qualify and route new contacts the moment they message for the first time." },
        { icon: "Clock", title: "Reminders", desc: "Appointment, renewal and subscription reminders with reschedule buttons." },
        { icon: "Percent", title: "Payment recovery", desc: "Re-issue failed payment links on a cadence that stops the moment the invoice clears." },
        { icon: "Users", title: "Lead nurturing", desc: "Drip sequences that hand a warmed lead to a human at exactly the right moment." },
        { icon: "Building", title: "Branch routing", desc: "Send each contact to their own branch's queue, templates and business hours." },
      ],
    },
    faq: [
      {
        q: "How is this different from a drip campaign?",
        a: "A drip is a fixed schedule. An automation reacts: it can branch on what the customer replied, wait for a webhook from your billing system, or stop the moment a tag changes. Drip sequences are built from the same primitives, so simple schedules stay simple.",
      },
      {
        q: "Can an automation talk to our own backend?",
        a: "Yes. Trigger from an inbound webhook and call outbound webhooks from any action node, with signed payloads and retries. That is how payment events, order updates and CRM changes enter the journey.",
      },
      {
        q: "What prevents runaway messaging?",
        a: "Three layers: opt-out and blocklist enforcement on every send, a per-contact frequency cap across all automations, and idempotency keys so a replayed event cannot duplicate a message.",
      },
      {
        q: "Can I pause an automation without losing in-flight contacts?",
        a: "Yes. Pausing holds active runs at their current node. Resuming continues from the hold point, and you can optionally expire runs older than a window you choose.",
      },
      {
        q: "How do I test before going live?",
        a: "Dry-run mode executes the graph against sample or selected contacts with all sends suppressed, showing you every branch decision and payload as it would have happened.",
      },
    ],
    cta: {
      title: "Stop being the person who remembers the follow-up.",
      sub: "Model the journey once and let the platform keep the promise at 3am.",
      primary: { label: "Start free trial", to: "/signup" },
      secondary: { label: "See it in a demo", to: "/company/contact" },
    },
    related: ["/product/live-inbox", "/product/templates", "/product/analytics"],
  },

  {
    path: "/product/analytics",
    section: "Product",
    renderer: "standard",
    meta: {
      title: "Analytics — WhatsApp Team & Revenue Reporting | Madhura",
      description:
        "Delivery, response and revenue analytics for WhatsApp: agent performance, campaign funnels, branch comparisons and exportable reports.",
    },
    hero: {
      badge: "Product · Analytics",
      title: "Numbers your operations review can act on.",
      highlight: "can act on",
      subtitle:
        "Response times, delivery funnels, agent load and revenue attribution — sliced by team, branch, campaign and template, and exportable the moment a stakeholder asks.",
      points: [
        "First-response and resolution time distributions",
        "Delivery funnel: sent → delivered → read → replied",
        "Agent and team leaderboards with workload balance",
        "CSV and webhook export for your warehouse",
      ],
      primaryCta: { label: "Start free trial", to: "/signup" },
      secondaryCta: { label: "See a sample report", to: "/company/contact" },
    },
    stats: [
      { value: "live", label: "Dashboard refresh", note: "socket-pushed, no manual reload" },
      { value: "14", label: "Core report types", note: "from SLA to revenue" },
      { value: "5", label: "Dimensions", note: "team, branch, template, campaign, tag" },
      { value: "1-click", label: "Export", note: "CSV, JSON or scheduled webhook" },
    ],
    overview: {
      heading: "Measurement that survives a board meeting",
      paragraphs: [
        "Most messaging dashboards show volume and stop there. Volume tells you whether anyone is busy; it does not tell you whether customers are being served or whether the channel is making money.",
        "Analytics is organised around outcomes: how fast did a human answer, did the message get read, did the conversation convert, and which template, agent or branch drove it. Every chart is dimensioned, filtered and exportable — no screenshotting.",
      ],
      bullets: [
        "SLA attainment with p50 / p90 first-response times",
        "Delivery funnel with failure reasons by error code",
        "Campaign and automation performance side by side",
        "Agent workload, occupancy and resolution counts",
        "Opt-out and quality-rating trends over time",
        "Scheduled reports delivered to email or webhook",
      ],
    },
    features: [
      {
        icon: "BarChart3",
        title: "Response analytics",
        desc: "Median and p90 first response, resolution time, SLA attainment and after-hours volume — per queue, agent and branch.",
      },
      {
        icon: "Activity",
        title: "Delivery funnel",
        desc: "Sent, delivered, read, replied and failed with failure codes broken out so deliverability problems are diagnosable.",
      },
      {
        icon: "Users",
        title: "Team performance",
        desc: "Leaderboards for volume and quality together, so a high send count never hides a poor response time.",
      },
      {
        icon: "TrendingUp",
        title: "Attribution",
        desc: "Connect replies and conversions back to the campaign, template or automation that started the conversation.",
      },
      {
        icon: "Filter",
        title: "Comparative views",
        desc: "Compare two periods, two branches or two templates on the same axes with automatic delta calculation.",
      },
      {
        icon: "Download",
        title: "Portable data",
        desc: "Export any view to CSV or JSON, or schedule it to a webhook endpoint your warehouse ingests nightly.",
      },
    ],
    workflow: {
      heading: "From raw events to a decision",
      steps: [
        {
          title: "Collect",
          desc: "Every send, delivery receipt, inbound message and state change is written as an event with its dimensions attached.",
        },
        {
          title: "Aggregate",
          desc: "Events roll up into hourly and daily series per team, branch, template and campaign — without sampling.",
        },
        {
          title: "Slice",
          desc: "Filter by date range, branch, agent or tag; compare against a previous period or a target you set.",
        },
        {
          title: "Distribute",
          desc: "Send the view where the decision happens: a scheduled email, a webhook, or an export attached to the ops review.",
        },
      ],
    },
    capabilities: {
      heading: "Reports teams actually open",
      items: [
        { icon: "Clock", title: "SLA report", desc: "Attest whether support met its response commitments, with the breaches listed individually." },
        { icon: "Send", title: "Campaign report", desc: "Delivery, reads, replies and opt-outs per wave, with variant winners called out." },
        { icon: "Percent", title: "Quality & opt-outs", desc: "Track quality rating and opt-out rate together — the two leading indicators of a ban." },
        { icon: "Building", title: "Branch comparison", desc: "Rank branches on the same normalized metrics, adjusted for contact volume." },
        { icon: "Award", title: "Agent scorecards", desc: "A per-agent view for coaching conversations: load, response, resolution, reopen rate." },
      ],
    },
    faq: [
      {
        q: "How fresh is the data?",
        a: "Live views are socket-pushed and update within a second of the underlying event. Historic series are pre-aggregated, so a twelve-month range renders without re-querying raw messages.",
      },
      {
        q: "Can we build our own dashboards?",
        a: "Yes. Every metric is available through the analytics REST API and a scheduled webhook, so Looker, Metabase or a warehouse model can consume the same numbers the UI shows.",
      },
      {
        q: "Do you sample data?",
        a: "No. Counts and distributions are computed over the full event set within your retention window. Longer history is available on enterprise plans with a longer event store.",
      },
      {
        q: "How is response time measured?",
        a: "From the first inbound message of a conversation to the first human reply, excluding automated replies and out-of-hours periods if you configure the clock to ignore them.",
      },
      {
        q: "Can different roles see different metrics?",
        a: "Yes. Branch managers see their branch, agents see their own scorecard, and leadership sees the consolidated view. Metric visibility follows the same permission model as the rest of the workspace.",
      },
    ],
    cta: {
      title: "Measure the channel like a revenue line.",
      sub: "Connect your numbers to the review that decides the budget.",
      primary: { label: "Start free trial", to: "/signup" },
      secondary: { label: "Talk to sales", to: "/company/contact" },
    },
    related: ["/product/campaigns", "/product/live-inbox", "/product/automations"],
  },
];
