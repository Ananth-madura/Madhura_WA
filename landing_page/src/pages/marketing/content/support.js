/* Support, status, demo and onboarding pages ------------------------------------
   Content entries keyed by route. `content/index.js` resolves them into the
   route table. Keep the shape stable: path / section / renderer / meta / hero /
   stats / overview / features / workflow / capabilities / faq / cta / related.
   Anything omitted is filled in by content/index.js (meta, cta, related).
   Internal links are always `{ label, to }` — never href/url.
   ------------------------------------------------------------------------------- */

export const SUPPORT_PAGES = {
  /* ── Support overview ────────────────────────────────────────────────────── */
  "/support": {
    path: "/support",
    section: "Support",
    renderer: "standard",
    meta: {
      title: "Support — Channels, Response Times & Escalation | Madhura",
      description:
        "Support channels, severity levels and first-response targets by plan, plus escalation paths and what every Madhura ticket includes.",
    },
    hero: {
      badge: "Support · Overview",
      title: "Support that answers with an owner, not an auto-reply.",
      highlight: "an owner",
      subtitle:
        "Every request becomes a tracked ticket with a severity, a named owner and a published target. You pick the channel that matches how badly things are broken; we pick the engineer.",
      points: [
        "Portal and email intake feeding one queue",
        "Severity assigned at triage, targets published by plan",
        "Escalation from engineer to lead to on-call",
        "Status page, docs and FAQ for self-serve answers",
      ],
      primaryCta: { label: "Open a ticket", to: "/support/tickets" },
      secondaryCta: { label: "See plans & targets", to: "/support/plans" },
    },
    stats: [
      { value: "S1–S4", label: "Severity scale", note: "assigned at triage" },
      { value: "4h", label: "First response", note: "on enterprise plans" },
      { value: "24/7", label: "Critical coverage", note: "on-call on Premium+" },
      { value: "1", label: "Owner per ticket", note: "never a shared mailbox" },
    ],
    overview: {
      heading: "One queue behind every channel",
      paragraphs: [
        "Support runs out of a single queue. A ticket opened in the portal, an email to support@madhura.co and an escalation raised by your account contact all become one object: a numbered case with an owner, a severity and a clock. Nothing sits in a personal inbox, and nothing is lost because it arrived on a channel nobody watches.",
        "Plans change coverage and speed, not who you reach. Community answers in working hours by the next business day; Standard and Premium tighten the clock and widen the channels; Enterprise adds an agreed coverage window, a named escalation contact and a customer success manager. The matrix is on the plans page, and every target is measured on the ticket itself.",
      ],
      bullets: [
        "Portal intake pre-fills workspace, plan and page",
        "Email joins the same queue and thread",
        "Severity agreed at triage, revised as impact changes",
        "Status page first: component health and maintenance",
        "Docs and guides cover most how-to questions",
        "Escalation path with a named contact per level",
      ],
    },
    features: [
      {
        icon: "Inbox",
        title: "Portal intake",
        desc: "Open a ticket from inside the workspace — workspace ID, feature, recent errors and plan attach automatically, so triage starts with context instead of questions.",
      },
      {
        icon: "MessageSquare",
        title: "Email intake",
        desc: "Mail to support@madhura.co threads onto the same ticket, so a long investigation never fragments across mailboxes.",
      },
      {
        icon: "Clock",
        title: "Published targets",
        desc: "First-response targets are defined by severity and plan, published rather than negotiated, with the clock visible on the ticket.",
      },
      {
        icon: "ShieldCheck",
        title: "Escalation path",
        desc: "When a target is at risk — or you ask — the ticket moves from engineer to support lead, then to on-call for critical issues.",
      },
      {
        icon: "Terminal",
        title: "Diagnostics attached",
        desc: "Pull conversation IDs, webhook payloads and delivery errors from the workspace into the ticket instead of screenshotting them.",
      },
      {
        icon: "Search",
        title: "Self-serve first",
        desc: "Docs, this FAQ and the status page answer most questions in minutes. They exist to save you a ticket, not to keep you out of support.",
      },
    ],
    workflow: {
      heading: "How a request moves through support",
      steps: [
        {
          title: "Submit",
          desc: "Open a ticket in the portal or email support. The confirmation lists everything we captured about the request.",
        },
        {
          title: "Triage",
          desc: "A support engineer sets severity and owner, then routes the case to messaging, automations, webhooks, billing or integrations.",
        },
        {
          title: "Investigate",
          desc: "We reproduce, offer a workaround when one exists, and update at the cadence your severity sets.",
        },
        {
          title: "Resolve",
          desc: "The fix ships or the answer lands, you confirm, and the ticket closes with a written summary.",
        },
      ],
    },
    capabilities: {
      heading: "What every ticket promises",
      items: [
        {
          icon: "Award",
          title: "A named owner",
          desc: "One engineer is accountable from triage to closure, shown on the ticket with the escalation contacts above them.",
        },
        {
          icon: "Activity",
          title: "Update cadence",
          desc: "At least one substantive update per business day while a ticket is open, faster when severity is high.",
        },
        {
          icon: "Building",
          title: "Hours & on-call",
          desc: "Coverage runs 09:00–18:00 IST, Monday to Friday, with weekend on-call for critical issues on Premium and Enterprise.",
        },
        {
          icon: "FileText",
          title: "Written resolution",
          desc: "Closed tickets end with cause, fix and any action needed on your side — ready for an internal report.",
        },
        {
          icon: "Users",
          title: "Escalation on request",
          desc: "Ask for a supervisor at any point; the request is logged, so escalation is a process rather than a favour.",
        },
      ],
    },
    faq: [
      {
        q: "What is the fastest way to get help when messaging is down?",
        a: "File an S1 ticket from the portal with the affected number, WABA ID and a conversation ID. Check the status page first: if a component is degraded, subscribe and reply to that incident instead of opening a duplicate.",
      },
      {
        q: "What counts as an S1?",
        a: "Messaging stopped or failing broadly, an automation misfiring at volume, or a defect sending incorrect messages with no workaround. Severity follows customer impact, not how loudly the issue was reported.",
      },
      {
        q: "Do you answer outside business hours?",
        a: "Coverage is 09:00–18:00 IST on weekdays for every plan. Premium and Enterprise add an on-call rota for critical issues, and Enterprise agreements state the coverage window in writing.",
      },
      {
        q: "Can support read our customer conversations?",
        a: "Only when it is needed and only with your approval. Engineers request time-boxed, logged access to the thread you approve, and every access event lands in the audit trail.",
      },
      {
        q: "How do I escalate a ticket that has stalled?",
        a: "Reply and ask for escalation, or contact the escalation named on your plan. The request is logged, a support lead takes it, and you get an explanation of where the ticket actually was.",
      },
    ],
    cta: {
      title: "Open a ticket that starts with context.",
      sub: "Two minutes in the portal attaches an owner, a severity and a target.",
      primary: { label: "Submit a ticket", to: "/support/tickets" },
      secondary: { label: "Compare support plans", to: "/support/plans" },
    },
    related: ["/support/tickets", "/support/plans", "/status"],
  },

  /* ── Tickets ─────────────────────────────────────────────────────────────── */
  "/support/tickets": {
    path: "/support/tickets",
    section: "Support",
    renderer: "standard",
    meta: {
      title: "Support Tickets — Severity Levels & Response Targets | Madhura",
      description:
        "How to submit and track a Madhura support ticket: severity levels S1–S4 with target first-response times, what to include (screenshots, WABA ID, conversation ID) and the SLA by plan.",
    },
    hero: {
      badge: "Support · Tickets",
      title: "A ticket diagnosed on the first reply, not the fifth.",
      highlight: "the first reply",
      subtitle:
        "Screenshots, a WABA ID and a conversation ID turn two days of back-and-forth into one focused answer. Here is what to send, how severity is set, and when you can expect us.",
      points: [
        "File from the portal, email or the in-app error banner",
        "Severity S1–S4 assigned with you during triage",
        "Target first-response times published per plan",
        "Status, target clock and history on one thread",
      ],
      primaryCta: { label: "Contact support", to: "/company/contact" },
      secondaryCta: { label: "Check system status", to: "/status" },
    },
    stats: [
      { value: "1h", label: "S1 first response", note: "Premium & Enterprise" },
      { value: "S1–S4", label: "Severity scale", note: "set at triage" },
      { value: "auto", label: "Context attached", note: "workspace, plan, errors" },
      { value: "daily", label: "Progress updates", note: "per business day" },
    ],
    overview: {
      heading: "Send identifiers, not adjectives",
      paragraphs: [
        "Most slow tickets are slow because the first message said “messages are not delivering” and stopped there. Failures have a cause — a rejected template, an expired window, a rate limit, a webhook throwing errors — and the identifiers let an engineer find the failing record in seconds.",
        "Once filed, a ticket is one thread. The confirmation records what we attached, triage sets severity and owner, and the first response gives an answer, a next question or a workaround. Reply by portal or email — it lands on the same ticket, with its status and history intact.",
      ],
      bullets: [
        "Screenshot or short recording with the timestamp visible",
        "WABA ID and phone number ID from Meta Business Manager",
        "Conversation ID of an affected thread",
        "Exact failure time with timezone, not “this morning”",
        "Expected behaviour in a sentence, actual in a sentence",
        "Blast radius: one contact, one number, or everything",
      ],
    },
    features: [
      {
        icon: "FileText",
        title: "Reproduction steps",
        desc: "Numbered steps, expected versus actual, and how often it happens. If we cannot reproduce it first time, we ask only for what changes the diagnosis.",
      },
      {
        icon: "GitBranch",
        title: "Identifiers that matter",
        desc: "Workspace ID, WABA ID, phone number ID, conversation ID, template or automation name, webhook endpoint — the keys that locate your data without a fishing expedition.",
      },
      {
        icon: "Clock",
        title: "Severity & targets",
        desc: "Four severities with published first-response targets by plan, set during triage and revised with you whenever the blast radius differs.",
      },
      {
        icon: "Activity",
        title: "Trackable status",
        desc: "Open, waiting on you, in progress, resolved and closed — with the target clock and last update, so nobody has to ask where it stands.",
      },
      {
        icon: "Layers",
        title: "Attachments, redacted",
        desc: "Attach logs, HAR files and recordings. Redact end-customer personal data unless it is the defect itself; for one specific thread we request access instead.",
      },
      {
        icon: "RefreshCw",
        title: "Reopen in one click",
        desc: "A resolution that does not hold reopens the original ticket with its history, so you never restart the story or re-explain context we had.",
      },
    ],
    workflow: {
      heading: "The life of a ticket",
      steps: [
        {
          title: "File",
          desc: "Portal, email or the in-app error banner. A confirmation arrives with the ticket ID and the context we captured.",
        },
        {
          title: "Triage",
          desc: "Severity and owner are assigned, then the ticket routes to messaging, automations, webhooks, billing or integrations.",
        },
        {
          title: "Work",
          desc: "Reproduction, a workaround where one exists, and updates on the severity cadence. We ask for detail only when it moves the diagnosis.",
        },
        {
          title: "Close",
          desc: "The fix is verified with you, a resolution summary is written into the ticket, and reopening stays one click away.",
        },
      ],
    },
    capabilities: {
      heading: "Severity levels and target first response",
      items: [
        {
          icon: "Zap",
          title: "S1 — Critical",
          desc: "Messaging stopped or failing broadly, or incorrect messages reaching customers with no workaround. First response within 1 hour on Premium and Enterprise; 4 business hours on Standard.",
        },
        {
          icon: "Activity",
          title: "S2 — High",
          desc: "A core feature is broken or a campaign cannot send, with a workaround available. First response within 4 business hours on Premium and Enterprise, 8 on Standard.",
        },
        {
          icon: "Layers",
          title: "S3 — Medium",
          desc: "Degraded behaviour, an incorrect report or a non-blocking defect. First response within 1 business day across paid plans, with the fix joining the release train.",
        },
        {
          icon: "Search",
          title: "S4 — Question",
          desc: "How-to, configuration and best-practice questions, answered within 2 business days — usually with a documentation link that answers what you asked.",
        },
        {
          icon: "Building",
          title: "SLA by plan",
          desc: "Community: next business day. Standard: 8 business hours. Premium: 4 business hours plus weekend on-call for S1. Enterprise: coverage window and escalation contacts defined in your agreement.",
        },
      ],
    },
    faq: [
      {
        q: "Where do I find my WABA ID and conversation ID?",
        a: "Both live in Meta Business Manager; inside Madhura they sit on the Channels settings screen. Tickets opened from the portal carry them automatically — they are only needed when filing by email.",
      },
      {
        q: "What if I do not know how severe it is?",
        a: "File it as you see it. Triage sets severity in the first response and confirms it with you. Severity moves in both directions — it follows customer impact, not volume.",
      },
      {
        q: "Can we file tickets by email?",
        a: "Yes, to support@madhura.co. Every reply threads onto the same ticket. Only the initial report needs identifiers and steps; after that it is a conversation, with status and target still visible in the portal.",
      },
      {
        q: "How do we tell our outage from a platform incident?",
        a: "Check the status page before filing. If a component is degraded, subscribe and add your workspace detail — that speeds the fix and links your ticket to the cause. Otherwise, file normally.",
      },
      {
        q: "What happens after a ticket is closed?",
        a: "The resolution summary stays searchable, reopening takes one click, and the ticket exports for a post-mortem. If the cause needs a design change, we will say so — raise it as a feature request.",
      },
    ],
    cta: {
      title: "Send the identifiers once.",
      sub: "A ticket with IDs, timestamps and steps usually gets its answer in the first reply.",
      primary: { label: "Contact support", to: "/company/contact" },
      secondary: { label: "See system status", to: "/status" },
    },
    related: ["/support", "/support/plans", "/support/report-issue"],
  },

  /* ── Support plans ───────────────────────────────────────────────────────── */
  "/support/plans": {
    path: "/support/plans",
    section: "Support",
    renderer: "standard",
    meta: {
      title: "Support Plans — Community, Standard, Premium & Enterprise | Madhura",
      description:
        "Madhura support tiers compared: response targets, channels from email to phone to a dedicated CSM, onboarding help and escalation paths for each plan.",
    },
    hero: {
      badge: "Support · Plans",
      title: "Pick the support tier that matches your risk.",
      highlight: "matches your risk",
      subtitle:
        "Every tier reaches the same engineers and the same ticket system. What changes is how fast we answer, when we answer, and how much of the rollout we take on with you.",
      points: [
        "Community, Standard, Premium and Enterprise tiers",
        "Targets published per severity, not negotiated per case",
        "Channels widen: email, portal, phone, named CSM",
        "Onboarding help and escalation depth grow by tier",
      ],
      primaryCta: { label: "Talk to sales", to: "/company/contact" },
      secondaryCta: { label: "See ticket severity", to: "/support/tickets" },
    },
    stats: [
      { value: "4", label: "Support tiers", note: "community to enterprise" },
      { value: "1 day", label: "Community reply", note: "next business day" },
      { value: "4h", label: "Premium response", note: "business hours" },
      { value: "24/7", label: "Enterprise critical", note: "window per agreement" },
    ],
    overview: {
      heading: "Same engineers, different clocks",
      paragraphs: [
        "Tiers are not a system in which free customers get a bot. The same engineers work every plan; a tier buys a shorter clock, wider coverage and more channels — a portal ticket with a target on it, a weekend on-call rota, a phone call when a screen share beats typing, or a named person who already knows your workspace.",
        "The tier also decides how much of the rollout we carry. Self-serve onboarding is open to everyone. From Premium up, migration assistance and training are included; Enterprise adds a guided rollout with a named lead and a customer success manager who reviews delivery health with you.",
      ],
      bullets: [
        "Community — docs, status page, email next business day",
        "Standard — portal tickets, 8 business hour response",
        "Premium — 4 business hours, weekend on-call, callbacks",
        "Enterprise — agreed window, named contacts, CSM",
        "Channels widen with tier: email → portal → phone → CSM",
        "Onboarding scales from checklist to guided migration",
      ],
    },
    features: [
      {
        icon: "Users",
        title: "Community",
        desc: "For trials and small teams: documentation, this FAQ, the status page and email to support@madhura.co with a next-business-day reply in working hours.",
      },
      {
        icon: "Inbox",
        title: "Standard",
        desc: "Tracked portal tickets with an 8 business hour first-response target, daily updates on everything open, and a written resolution on every closed case.",
      },
      {
        icon: "Rocket",
        title: "Premium",
        desc: "4 business hour first response, weekend on-call for critical issues, a phone callback when an incident needs a call, and a quarterly review of open items.",
      },
      {
        icon: "Building",
        title: "Enterprise",
        desc: "Coverage window and targets written into the agreement, a named escalation contact, a customer success manager, and onboarding included in the rollout.",
      },
      {
        icon: "Send",
        title: "Onboarding help",
        desc: "Migration assistance — number setup, template import, contact import and agent training — from a shared checklist up to a rollout led by a named engineer.",
      },
      {
        icon: "ShieldCheck",
        title: "Escalation paths",
        desc: "Every tier can escalate in writing; the depth differs. Community gets a lead review, Premium gets on-call, Enterprise gets named contacts with agreed commitments.",
      },
    ],
    workflow: {
      heading: "Choosing and starting a plan",
      steps: [
        {
          title: "Assess",
          desc: "Match team size, send volume and coverage hours to a tier. If WhatsApp is revenue-critical, the real gap between Standard and Premium is the on-call rota.",
        },
        {
          title: "Confirm",
          desc: "Sales confirms targets, channels and onboarding scope in writing. Enterprise coverage windows become part of the agreement, not a verbal promise.",
        },
        {
          title: "Onboard",
          desc: "Migration, template import, queue configuration and training run against the checklist described in the onboarding program.",
        },
        {
          title: "Review",
          desc: "Premium and Enterprise review open tickets, delivery health and upcoming changes together. Community self-serves from docs and the status page.",
        },
      ],
    },
    capabilities: {
      heading: "What widens as you move up",
      items: [
        {
          icon: "MessageCircle",
          title: "Email",
          desc: "support@madhura.co on every tier, including Community. Replies thread onto your ticket, so history survives the channel it started on.",
        },
        {
          icon: "Inbox",
          title: "Portal",
          desc: "Tracked tickets with status, severity, target clock and attachments — the standard channel on paid tiers and the fastest route to triage.",
        },
        {
          icon: "Clock",
          title: "Phone callback",
          desc: "A scheduled call for critical issues on Premium and Enterprise, when sharing a screen with an engineer beats another round of tickets.",
        },
        {
          icon: "Award",
          title: "Named CSM",
          desc: "Enterprise gets a customer success manager who knows your workspace, your branches and your escalation history.",
        },
        {
          icon: "GitBranch",
          title: "Escalation depth",
          desc: "Each tier states who you escalate to and how quickly they respond, so escalation is a defined process rather than a raised voice.",
        },
      ],
    },
    faq: [
      {
        q: "Which plan should we start on?",
        a: "Trials suit Community. Once agents live in the inbox daily, Standard is the floor. If campaigns and automations carry revenue and an hour of downtime shows on the P&L, Premium is the sensible tier. Multi-branch operations usually want Enterprise, because the coverage window and escalation contacts get written down.",
      },
      {
        q: "Are the response targets guarantees?",
        a: "Targets on this page are commitments we measure against real ticket timestamps. Enterprise targets, coverage windows and any service credits are defined in your agreement; the rest is our published standard. If we miss one, the ticket shows it.",
      },
      {
        q: "Can we change plans mid-term?",
        a: "Yes. Upgrades take effect immediately and are prorated; moving to a lower tier applies at renewal. If your volumes or hours change, we would rather move you than watch tickets miss their targets.",
      },
      {
        q: "Is onboarding charged separately?",
        a: "Self-serve onboarding — checklist, documentation and recorded walkthroughs — is free on every plan. Guided migration and agent training are included from Premium upwards and quoted as a one-off on Standard.",
      },
      {
        q: "Do you complete security questionnaires?",
        a: "Yes. Request our security documentation and questionnaire pack through the trust center pages; enterprise reviews are handled by the same team that answers them for every customer, with current attestation status stated openly.",
      },
    ],
    cta: {
      title: "Match the plan to the risk you carry.",
      sub: "Tell us your hours, volumes and branch structure — we will say which tier fits, including when a cheaper one does.",
      primary: { label: "Talk to sales", to: "/company/contact" },
      secondary: { label: "See the onboarding program", to: "/onboarding" },
    },
    related: ["/support", "/support/tickets", "/onboarding"],
  },

  /* ── Status ──────────────────────────────────────────────────────────────── */
  "/status": {
    path: "/status",
    section: "Support",
    renderer: "standard",
    meta: {
      title: "System Status — Component Health & Incident Notices | Madhura",
      description:
        "What Madhura publishes on its status surface: health of the Messaging API, Automation Engine, Webhooks, Dashboard and Integrations, maintenance windows and how incidents are communicated.",
    },
    hero: {
      badge: "Status",
      title: "Know whether it is us before you open a ticket.",
      highlight: "whether it is us",
      subtitle:
        "Component-level health, planned maintenance and incident updates in one place — published by us, and pushed to you by status page, email and webhook.",
      points: [
        "Five components reported independently, not one global light",
        "Rolling history of incidents and maintenance windows",
        "Email subscriptions per component and per workspace",
        "Signed webhook so your own tooling can react",
      ],
      primaryCta: { label: "Report an issue", to: "/support/report-issue" },
      secondaryCta: { label: "Incident response process", to: "/trust/incident-response" },
    },
    stats: [
      { value: "5", label: "Published components", note: "messaging to integrations" },
      { value: "3", label: "Update channels", note: "page, email, webhook" },
      { value: "planned", label: "Maintenance", note: "announced in advance" },
      { value: "rolling", label: "Incident history", note: "past cases stay visible" },
    ],
    overview: {
      heading: "Status is a publication, not a screenshot",
      paragraphs: [
        "A single green dot tells you nothing you can act on. Madhura reports each component separately — Messaging API, Automation Engine, Webhooks, Dashboard and Integrations — with one of four states: operational, degraded, partial disruption, or under maintenance. Every change carries a timestamp, a description of what customers are experiencing, and what we are doing about it.",
        "The status surface is the source of truth during an incident. Email subscribers are notified whenever a component moves, and a signed webhook posts the same event to an endpoint you choose, so your systems can pause a campaign without anyone watching a page. After resolution, the incident and its timeline stay in the published history beside the maintenance windows that have run.",
      ],
      bullets: [
        "States: operational, degraded, partial disruption, maintenance",
        "Start and end times kept in a rolling history",
        "Maintenance announced ahead with expected impact",
        "Email subscriptions per component or per workspace",
        "Signed webhook carrying component, severity and timestamps",
        "Post-incident summary after the state returns to normal",
      ],
    },
    features: [
      {
        icon: "Send",
        title: "Messaging API",
        desc: "Inbound and outbound flow, template submission and delivery receipts — the component whose state decides whether customers hear from you at all.",
      },
      {
        icon: "Zap",
        title: "Automation Engine",
        desc: "Trigger evaluation, delays and scheduled journeys. Its status tells you whether journeys run on time or queue behind a backlog.",
      },
      {
        icon: "GitBranch",
        title: "Webhooks",
        desc: "Delivery of outbound events to your endpoints, including retries and signature validity — the line your CRM and billing depend on.",
      },
      {
        icon: "Layers",
        title: "Dashboard",
        desc: "The workspace itself: inbox, campaigns, templates and analytics, reported separately so a reporting problem never disguises a delivery problem.",
      },
      {
        icon: "RefreshCw",
        title: "Integrations",
        desc: "CRM sync, connectors and third-party dependencies, each attributable on its own line so an upstream partner outage is credited honestly.",
      },
      {
        icon: "Clock",
        title: "Maintenance windows",
        desc: "Planned work is published in advance with scope and expected impact. Emergency maintenance appears the moment it is declared, then follows the normal cadence.",
      },
    ],
    workflow: {
      heading: "How an incident is communicated",
      steps: [
        {
          title: "Detect",
          desc: "Monitoring and internal alerting flag the anomaly, and an on-call engineer confirms it — including whether it is platform-side or configuration.",
        },
        {
          title: "Declare",
          desc: "The incident is declared with a severity and the affected components. The status page updates first; subscriptions and webhook events follow.",
        },
        {
          title: "Update",
          desc: "Progress is posted at a steady cadence: what is affected, what is being done, and what you can safely do meanwhile.",
        },
        {
          title: "Resolve & review",
          desc: "State returns to operational, subscribers are notified of recovery, and a written summary with timeline and follow-up actions stays published.",
        },
      ],
    },
    capabilities: {
      heading: "Subscribing and integrating with status",
      items: [
        {
          icon: "MessageCircle",
          title: "Email notices",
          desc: "Subscribe by component and get a message on every state change — degraded and recovered — so the page comes to you.",
        },
        {
          icon: "Terminal",
          title: "Webhook feed",
          desc: "A signed payload carries component, severity, state and timestamps to an endpoint you choose, so your tooling can pause sends automatically.",
        },
        {
          icon: "Search",
          title: "Auditable history",
          desc: "Past incidents and maintenance windows stay published with their timelines — the record of how the platform behaved, not a claim about how it behaves.",
        },
        {
          icon: "Inbox",
          title: "Tickets linked to incidents",
          desc: "When a component is degraded, affected tickets link to the open incident, so updates are written once and reach everyone waiting.",
        },
        {
          icon: "FileText",
          title: "What we publish",
          desc: "Scope, customer impact, start time, updates and resolution. Availability commitments for your workspace live in your agreement, not as a headline percentage here.",
        },
      ],
    },
    faq: [
      {
        q: "Why is there no big uptime percentage here?",
        a: "A single percentage hides what you actually need: which component was affected, for how long, and whether your workflows were touched. We publish component state plus the full history of incidents and maintenance windows with timelines; concrete availability commitments live in your agreement.",
      },
      {
        q: "How will we find out when something breaks?",
        a: "Three ways, and you can use all of them: the status page itself, email subscriptions per component, and a signed webhook to an endpoint you control. The page updates first, and subscribers are notified on every state change.",
      },
      {
        q: "How far ahead is maintenance announced?",
        a: "Planned maintenance is published before the window opens, with scope, expected impact and the components involved, scheduled away from your peak sending hours where possible. Emergency maintenance is announced the moment it is declared.",
      },
      {
        q: "Should we still open a ticket during an incident?",
        a: "If your workspace has a specific angle — one number failing while a component is only partially disrupted — yes, and mention the incident so we can link it. If you only want updates, subscribe instead and skip the queue.",
      },
      {
        q: "Do you report incidents caused by third parties?",
        a: "Yes. If a Meta-side outage, a connector partner or an upstream dependency is the cause, the incident says so on the affected component line. Honest attribution is the only version of a status page worth publishing.",
      },
    ],
    cta: {
      title: "Subscribe once, stop refreshing.",
      sub: "Email notices and a signed webhook keep your team informed without anyone watching a page.",
      primary: { label: "Report an issue", to: "/support/report-issue" },
      secondary: { label: "Read incident response", to: "/trust/incident-response" },
    },
    related: ["/support", "/trust/incident-response", "/support/tickets"],
  },

  /* ── Report an issue ─────────────────────────────────────────────────────── */
  "/support/report-issue": {
    path: "/support/report-issue",
    section: "Support",
    renderer: "standard",
    meta: {
      title: "Report an Issue — Triage, Timelines & Workarounds | Madhura",
      description:
        "A guided way to report a bug in Madhura: what to send, what happens after you report it, the triage stages, expected timelines and how workaround guidance keeps you running.",
    },
    hero: {
      badge: "Support · Report an issue",
      title: "Report it once, in a form we can act on.",
      highlight: "in a form we can act on",
      subtitle:
        "A good bug report is a reproduction recipe. Give us the steps, the identifiers and the blast radius, and we will give you triage stages, a timeline and a workaround while a fix is on its way.",
      points: [
        "Guided form that asks what engineers actually need",
        "Triage stages visible from intake to verification",
        "Workaround guidance offered as soon as one exists",
        "Fix verified against your steps before closure",
      ],
      primaryCta: { label: "Contact support", to: "/company/contact" },
      secondaryCta: { label: "Check known issues", to: "/status" },
    },
    stats: [
      { value: "3", label: "Triage stages", note: "intake, diagnosis, verification" },
      { value: "1h", label: "S1 first response", note: "Premium & Enterprise" },
      { value: "0", label: "Duplicate chasing", note: "linked, never re-asked" },
      { value: "1", label: "Workaround first", note: "offered when one exists" },
    ],
    overview: {
      heading: "A bug report is a reproduction recipe",
      paragraphs: [
        "Reporting well separates a fix tomorrow from a fix in three weeks. The report needs the shortest path to the failure: what you did, what you expected, what happened instead, when — with a timezone — and the identifiers that let an engineer pull the record. Blast radius matters: it drives severity, and severity drives everything.",
        "After you report, the work is staged rather than vague. Intake confirms we have it, diagnosis reproduces it and sets severity with you, and verification means we never close on “should be fixed now” — the fix is confirmed against your original steps, with a workaround meanwhile.",
      ],
      bullets: [
        "Shortest reproduction path: steps, expected, actual",
        "Timestamps with timezone and affected number or branch",
        "Identifiers: workspace, WABA, conversation, template",
        "Blast radius: one contact, one number, or everything",
        "Whether a workaround exists today, and its cost",
        "Whether an open status-page incident explains it",
      ],
    },
    features: [
      {
        icon: "FileText",
        title: "Guided intake",
        desc: "The form asks for reproduction steps, expected versus actual, identifiers and blast radius — the fields that decide whether the first reply can be an answer.",
      },
      {
        icon: "Activity",
        title: "Visible triage stages",
        desc: "The ticket shows intake, diagnosis, fix in progress and verification, so you can see which stage you are in instead of inferring it from silence.",
      },
      {
        icon: "Clock",
        title: "Timeline you can plan around",
        desc: "First response is set by severity and plan; after that, open tickets get at least one substantive update per business day, critical ones more.",
      },
      {
        icon: "ShieldCheck",
        title: "Workaround guidance",
        desc: "If a route keeps you sending while the defect is fixed — a fallback template, a paused journey, a manual step — it is written on the ticket.",
      },
      {
        icon: "GitBranch",
        title: "Linked, not duplicated",
        desc: "If the cause matches an open incident or another report, your ticket links to it. Same updates, no re-explaining the problem.",
      },
      {
        icon: "CheckCircle2",
        title: "Verified closure",
        desc: "We run your original steps against the fix before closing. If the behaviour returns, one click reopens the same ticket with all of its history.",
      },
    ],
    workflow: {
      heading: "What happens after you report",
      steps: [
        {
          title: "Intake",
          desc: "You get a ticket ID immediately with the context we captured. Anything missing is requested in one consolidated message.",
        },
        {
          title: "Diagnosis",
          desc: "An engineer reproduces the behaviour, confirms or revises severity with you, and states the target and next milestone.",
        },
        {
          title: "Workaround & fix",
          desc: "A workaround is documented if one exists, the fix is scheduled, and updates land at the cadence your severity sets.",
        },
        {
          title: "Verification",
          desc: "We run your original steps against the fix, you confirm on your side, and the ticket closes with a written summary.",
        },
      ],
    },
    capabilities: {
      heading: "Timelines you can hold us to",
      items: [
        {
          icon: "Zap",
          title: "First response",
          desc: "Set by severity and plan — S1 within 1 hour on Premium and Enterprise, S2 within 4 business hours, S3 a day, S4 two.",
        },
        {
          icon: "Activity",
          title: "Updates while open",
          desc: "At least one substantive update per business day on open tickets, and a tighter cadence on critical ones — including updates that say nothing changed.",
        },
        {
          icon: "Search",
          title: "Reproduction window",
          desc: "If we cannot reproduce a reported defect, we say so in the first response and ask for the specific missing detail rather than parking it.",
        },
        {
          icon: "RefreshCw",
          title: "Fix scheduling",
          desc: "Confirmed defects join the release train; severity and blast radius decide where, and the ticket shows the planned window.",
        },
        {
          icon: "FileText",
          title: "Post-fix summary",
          desc: "Cause, fix and anything you need to change are written into the ticket, so your report does not depend on reconstructing what we did.",
        },
      ],
    },
    faq: [
      {
        q: "What if the bug only happens sometimes?",
        a: "Report it with the frequency and conditions — time of day, number, branch, campaign size. Intermittent defects usually follow load or a specific payload, and the pattern you notice is often faster than any log we could pull.",
      },
      {
        q: "How soon will someone look at it?",
        a: "First response follows your plan and severity: S1 within an hour on Premium and Enterprise, S4 within two business days. From it you know the owner, stage and next update.",
      },
      {
        q: "What should we do while waiting for the fix?",
        a: "Ask for the workaround on the ticket: a paused journey, a fallback template, a second number, or a manual step with a known cost. If none exists, the ticket says so plainly.",
      },
      {
        q: "Will we be told when it is fixed?",
        a: "Yes. The ticket moves to verification, the fix is confirmed against your original reproduction steps, and the resolution summary lands in the thread you have been replying to. Nothing closes silently.",
      },
      {
        q: "Is this the right place for a missing feature?",
        a: "Not quite. A bug contradicts documented or reasonable expectations; a missing capability belongs on the feature-requests page, where product reviews it instead of scheduling it as a defect.",
      },
    ],
    cta: {
      title: "Show us the shortest path to the failure.",
      sub: "Steps, IDs and timestamps get you diagnosis instead of a questionnaire.",
      primary: { label: "Contact support", to: "/company/contact" },
      secondary: { label: "Request a feature instead", to: "/support/feature-requests" },
    },
    related: ["/support/tickets", "/support/feature-requests", "/status"],
  },

  /* ── Feature requests ────────────────────────────────────────────────────── */
  "/support/feature-requests": {
    path: "/support/feature-requests",
    section: "Support",
    renderer: "standard",
    meta: {
      title: "Feature Requests — How Ideas Are Reviewed | Madhura",
      description:
        "How to submit a feature request to Madhura, how requests are reviewed and prioritised, how roadmap visibility works and what you can expect after you submit.",
    },
    hero: {
      badge: "Support · Feature requests",
      title: "Tell us what would make the platform indispensable.",
      highlight: "indispensable",
      subtitle:
        "A request carrying a use case, the workaround you live with today and who it affects beats a one-line idea every time. Here is how requests are reviewed and what happens next.",
      points: [
        "Submit from the portal, your CSM, or a call",
        "Reviewed on a fixed cadence by product and engineering",
        "Roadmap visibility without invented delivery dates",
        "Every request gets a disposition, not an archive",
      ],
      primaryCta: { label: "Contact support", to: "/company/contact" },
      secondaryCta: { label: "See what shipped", to: "/changelog" },
    },
    stats: [
      { value: "monthly", label: "Review cadence", note: "product and engineering" },
      { value: "4", label: "Possible outcomes", note: "planned, exploring, and two more" },
      { value: "0", label: "Silent archives", note: "every request gets a disposition" },
      { value: "1", label: "Roadmap view", note: "committed work, honest windows" },
    ],
    overview: {
      heading: "Prioritisation you can see, dates you can trust",
      paragraphs: [
        "Most roadmap pain is not a team refusing a feature; it is never hearing what happened to it. Requests are reviewed monthly with product and engineering together, because half of what looks missing turns out to be a configuration question, a duplicate of committed work, or a smaller change that does the job.",
        "Every request leaves that review with a disposition: planned, exploring, declined or duplicate, each with a reason. Planned items carry a window we will defend; exploring means the problem is accepted but the solution is not; declined is a clear explanation — better than silence.",
      ],
      bullets: [
        "Use case first: who needs it, how often, what it blocks",
        "The workaround you use today and its cost",
        "Volume: how many teams, branches or contacts",
        "Expected versus actual behaviour, in concrete terms",
        "Whether an API or webhook would bridge the gap",
        "A disposition with reasoning on every reviewed request",
      ],
    },
    features: [
      {
        icon: "Send",
        title: "How to submit",
        desc: "Raise it from the portal's feature-request form, hand it to your customer success manager, or bring it to a review call — everything lands in the same backlog.",
      },
      {
        icon: "Users",
        title: "Who reviews it",
        desc: "Product owns the backlog; engineering joins to size the work. Requests are read together, because three small asks often describe one missing primitive.",
      },
      {
        icon: "Filter",
        title: "How it is prioritised",
        desc: "Impact on outcomes, how many teams hit it, how painful the workaround is, and fit with direction. Volume helps; a blocking problem beats a popular convenience.",
      },
      {
        icon: "TrendingUp",
        title: "Roadmap visibility",
        desc: "Committed work is published with a delivery window rather than a promise date. Exploring items show the open problem, so you can plan around what we know.",
      },
      {
        icon: "FileText",
        title: "What to expect",
        desc: "A disposition after the next review: planned with a window, exploring with the question stated, duplicate with a link, or declined with a reason you can argue against.",
      },
      {
        icon: "RefreshCw",
        title: "Revisiting declines",
        desc: "A declined request is not deleted. If your context changes — volume, regulation, branches — resubmit with what changed and it re-enters review with its history.",
      },
    ],
    workflow: {
      heading: "From request to release",
      steps: [
        {
          title: "Submit with a use case",
          desc: "Describe the job you are trying to do, who it affects, and what you do today instead. Identifiers are only needed if behaviour is also broken.",
        },
        {
          title: "Review",
          desc: "Requests are read at the monthly product and engineering review, sized honestly, and grouped where several describe the same gap.",
        },
        {
          title: "Disposition",
          desc: "You get planned, exploring, duplicate or declined with reasoning — and planned items appear on the roadmap with a defensible window.",
        },
        {
          title: "Build & confirm",
          desc: "When it ships, requesters are told first and early access is offered where a preview would improve the result.",
        },
      ],
    },
    capabilities: {
      heading: "What a strong request contains",
      items: [
        {
          icon: "MessageSquare",
          title: "The use case",
          desc: "Not the widget you want, the outcome you need: “agents must see the last order without leaving the thread” beats “add a sidebar”.",
        },
        {
          icon: "Activity",
          title: "Frequency & volume",
          desc: "How often it happens and how many teams, branches or contacts it touches — the line between an annoyance and an operational blocker.",
        },
        {
          icon: "Terminal",
          title: "Today's workaround",
          desc: "What you do now, what it costs in minutes or mistakes, and why the obvious alternative — an API call, a webhook, a spreadsheet — does not hold.",
        },
        {
          icon: "GitBranch",
          title: "Fit with existing flows",
          desc: "Which inbox, campaign, automation or reporting workflow it belongs to. Requests anchored in a real flow are easier to size and design against.",
        },
        {
          icon: "CheckCircle2",
          title: "Definition of done",
          desc: "One sentence describing what would make you stop doing the workaround. It gives review something concrete to accept, refine or decline.",
        },
      ],
    },
    faq: [
      {
        q: "How long until we hear back?",
        a: "Every request is read at the next monthly review, and the disposition follows shortly after. If you need an answer sooner, say so when you submit and it will be raised out of cadence.",
      },
      {
        q: "Do you publish delivery dates?",
        a: "We publish delivery windows for committed work and honest problem statements for everything else. Dates for un-sized work go wrong in one direction, so we would rather commit late than announce early and slip.",
      },
      {
        q: "Our request was declined — can we try again?",
        a: "Yes, especially if the reasoning no longer applies — declined requests stay in the backlog with their reason. Resubmit with what changed and it re-enters review with its history attached.",
      },

      {
        q: "What if we need something custom for our integration?",
        a: "Start with the API and webhooks — most extensibility needs are covered today. If a gap remains, submit it marked integration-blocking; those are reviewed with the platform team, not the backlog alone.",
      },
    ],
    cta: {
      title: "Put the use case on the record.",
      sub: "One well-described request reaches a real review — and comes back with a disposition either way.",
      primary: { label: "Talk to us", to: "/company/contact" },
      secondary: { label: "Read the docs", to: "/docs" },
    },
    related: ["/support/report-issue", "/support", "/changelog"],
  },

  /* ── Demo ────────────────────────────────────────────────────────────────── */
  "/demo": {
    path: "/demo",
    section: "Support",
    renderer: "contact",
    meta: {
      title: "Book a Demo — WhatsApp CRM Walkthrough | Madhura",
      description:
        "See Madhura on your own workflow: a WhatsApp-hosted demo, a video call, a live screen share or a self-guided product tour. Pick the format and book it.",
    },
    hero: {
      badge: "Support · Demo",
      title: "See your own workflow running, not a canned script.",
      highlight: "your own workflow",
      subtitle:
        "Bring a real process — an enquiry flow, a payment follow-up, a support queue — and we will build it live in front of you. Pick the format below: WhatsApp, video call, screen share or a self-guided tour.",
      points: [
        "Four formats: WhatsApp demo, video call, screen share, tour",
        "Built around your numbers, templates and team structure",
        "Sandbox workspace available after the session",
        "Thirty minutes, no slide deck required",
      ],
      primaryCta: { label: "Request your demo", to: "#contact-form" },
      secondaryCta: { label: "Start a free trial", to: "/signup" },
    },
    channels: [
      {
        icon: "MessageCircle",
        title: "WhatsApp demo",
        email: "demos+whatsapp@madhura.co",
        desc: "See the platform from the customer's side: message us on WhatsApp and watch the thread arrive, get routed, answered by an agent and picked up by an automation.",
        sla: "Reply within 1 business day",
      },
      {
        icon: "Users",
        title: "Video call",
        email: "demos+video@madhura.co",
        desc: "A 30-minute live walkthrough with a solutions engineer — discovery first, then the three workflows that matter to you, on your own use cases.",
        sla: "Scheduled within 1 business day",
      },
      {
        icon: "Sliders",
        title: "Screen share",
        email: "demos+screen@madhura.co",
        desc: "The most useful format if you already have a workspace: share your screen and we build queues, journeys and templates alongside your team, live.",
        sla: "Bring your team — no seat limit",
      },
      {
        icon: "Rocket",
        title: "In-product tour",
        email: "demos+tour@madhura.co",
        desc: "A self-guided tour you can start now: inbox, campaigns, templates, automations and analytics in sequence, with a person available if you get stuck.",
        sla: "Available immediately, no scheduling",
      },
    ],
    offices: [
      {
        city: "Pune",
        region: "Maharashtra, India",
        role: "Headquarters & engineering",
        lines: ["Baner Road", "Pune 411045", "India"],
      },
      {
        city: "Ahmedabad",
        region: "Gujarat, India",
        role: "Delivery & customer success",
        lines: ["Science City Road", "Ahmedabad 380060", "India"],
      },
    ],
    faq: [
      {
        q: "What actually happens in a demo?",
        a: "Ten minutes on your current flow — where messages arrive today, who answers them, what breaks — then the rest of the session building that flow in Madhura: routing, templates, an automation, and the reporting you would show a manager. No slide deck unless you ask for one.",
      },
      {
        q: "Do we need our own WhatsApp number to see it working?",
        a: "No. We can run everything on a sandbox workspace with our own numbers first, so you see real behaviour without touching production. If you want the session on your own number, we set that up beforehand — it takes longer, but it is the more useful demo once you are ready.",
      },
      {
        q: "Who should join from our side?",
        a: "Whoever owns the process: a support lead for inbox and SLAs, a marketing lead for campaigns and templates, an ops or engineering contact for webhooks and integrations. Sessions with two or three of those in the room tend to end with a real rollout plan.",
      },
      {
        q: "Can we bring our existing templates and data?",
        a: "Yes, and it makes the session better. Bring a template set, an export of contacts or your current conversation volume, and we will show how the migration would look — including what needs rework and what carries across as-is.",
      },
      {
        q: "Is there something we can try without talking to anyone?",
        a: "Yes — the self-guided tour above and the free trial both run without a call. The demo exists for what is hard to infer from a screen: architecture, migration, permissions across branches, and how support and onboarding would work for your team.",
      },
    ],
    cta: {
      title: "Prefer to just try it?",
      sub: "The self-guided tour takes four minutes and does not require talking to anyone.",
      primary: { label: "Start free trial", to: "/signup" },
      secondary: { label: "See the onboarding plan", to: "/onboarding" },
    },
    related: ["/onboarding", "/support", "/product/live-inbox"],
  },

  /* ── Onboarding ──────────────────────────────────────────────────────────── */
  "/onboarding": {
    path: "/onboarding",
    section: "Support",
    renderer: "standard",
    meta: {
      title: "Onboarding — Migration, Data Import, Training & Go-Live | Madhura",
      description:
        "The Madhura onboarding program: migration from other tools, contact and template import, team training, a go-live checklist and a week-by-week timeline.",
    },
    hero: {
      badge: "Support · Onboarding",
      title: "From first call to first production message in five weeks.",
      highlight: "in five weeks",
      subtitle:
        "A week-by-week program covering migration, data import, template migration, configuration and team training — ending with a go-live checklist both sides sign off, not a login and good luck.",
      points: [
        "Migration from other tools and spreadsheets, validated",
        "Template migration with re-validation against current rules",
        "Role-based training for agents, supervisors and admins",
        "Go-live checklist and a hypercare window after cut-over",
      ],
      primaryCta: { label: "Plan your onboarding", to: "/company/contact" },
      secondaryCta: { label: "Compare support plans", to: "/support/plans" },
    },
    stats: [
      { value: "5", label: "Weeks to go-live", note: "typical mid-size rollout" },
      { value: "3", label: "Audiences trained", note: "agents, supervisors, admins" },
      { value: "2", label: "Validation passes", note: "before and after cut-over" },
      { value: "1", label: "Onboarding lead", note: "kickoff through hypercare" },
    ],
    overview: {
      heading: "Migration is the risky week — so it is the planned one",
      paragraphs: [
        "Going live is rarely blocked by the software. It is blocked by what nobody scheduled: contacts trapped in a previous tool, templates written for a different category, an opt-in list with no evidence, and agents who have never shared a thread. Onboarding puts dates and owners against those items, so cut-over is a decision rather than a hope.",
        "The program runs week by week with a named lead: discovery, migration, configuration and dry-runs, then training and a pilot — and only cut-over against a checklist both sides signed. Enterprise rollouts add branch-by-branch phasing and a second wave for extra numbers.",
      ],
      bullets: [
        "Inventory of current tools, numbers, templates and data",
        "Contact import with row counts reconciled before cut-over",
        "Template migration with re-submission where needed",
        "Queues, permissions and automations set to your org chart",
        "Role-based training built from your own scenarios",
        "Go-live checklist, pilot send and hypercare afterwards",
      ],
    },
    features: [
      {
        icon: "RefreshCw",
        title: "Migration from other tools",
        desc: "From another BSP, an in-house setup or a spreadsheet, we map what carries across, what needs rework, and whether your number can move or a fresh one is faster.",
      },
      {
        icon: "Download",
        title: "Data import",
        desc: "Contacts, tags, custom fields and consent records import from CSV or API, with row counts reconciled — an import that silently drops contacts is worse than one that fails loudly.",
      },
      {
        icon: "FileText",
        title: "Template migration",
        desc: "Existing templates are normalised into the library, variables rebound to real fields and re-submitted for approval, so nothing stalls on the first campaign after cut-over.",
      },
      {
        icon: "Users",
        title: "Team training",
        desc: "Three sessions with different emphasis: agents on the inbox and macros, supervisors on queues, SLAs and reporting, admins on permissions, numbers and integrations.",
      },
      {
        icon: "CheckCircle2",
        title: "Go-live checklist",
        desc: "Numbers connected, templates approved, routing tested, permissions set, opt-in evidence in place, webhooks verified, pilot delivered. Both sides sign before production moves.",
      },
      {
        icon: "Rocket",
        title: "Hypercare after cut-over",
        desc: "A focused window where your onboarding lead and support watch delivery, response times and automations together, fixing friction that only appears under real volume.",
      },
    ],
    workflow: {
      heading: "Week by week to go-live",
      steps: [
        {
          title: "Week 1 — Discovery & access",
          desc: "Inventory of numbers, templates and data sources; workspace created; roles provisioned; success criteria agreed in writing.",
        },
        {
          title: "Weeks 2–3 — Migration & import",
          desc: "Number path decided, contacts and history imported and reconciled, templates migrated and re-submitted, consent records carried with their evidence.",
        },
        {
          title: "Week 4 — Configure & train",
          desc: "Queues, permissions, business hours and automations configured, a dry-run journey executed end to end, and role-based training for each audience.",
        },
        {
          title: "Week 5 — Pilot & go-live",
          desc: "Checklist reviewed item by item, a pilot send to a controlled audience, production cut-over, then hypercare until the numbers settle.",
        },
      ],
    },
    capabilities: {
      heading: "What onboarding covers",
      items: [
        {
          icon: "Building",
          title: "Multi-branch rollouts",
          desc: "Enterprise programs phase branch by branch, so the first wave proves the model and later waves repeat a pattern that already worked.",
        },
        {
          icon: "ShieldCheck",
          title: "Consent & opt-in",
          desc: "Opt-in evidence, opt-out handling and template categories are set up before the first send — compliance is part of go-live, not cleanup.",
        },
        {
          icon: "Terminal",
          title: "Integrations & webhooks",
          desc: "CRM sync, outbound webhooks and signature verification are tested against staging before anything points at production.",
        },
        {
          icon: "BarChart3",
          title: "Reporting baseline",
          desc: "SLA targets, delivery funnels and agent dashboards are configured during onboarding, so week one already produces numbers worth reviewing.",
        },
        {
          icon: "Award",
          title: "Named onboarding lead",
          desc: "One person owns the timeline, checklist and escalations from kickoff through hypercare — on Premium and Enterprise plans.",
        },
      ],
    },
    faq: [
      {
        q: "How long does onboarding actually take?",
        a: "A typical mid-size rollout reaches production traffic in about five weeks. Smaller teams with clean data and one number move faster; multi-branch programs phase longer. The timeline is agreed in week one and tracked against the checklist.",
      },
      {
        q: "Can we keep our existing WhatsApp number?",
        a: "Often, depending on how the number is registered today and with whom. Week 1 establishes the path: migrate it, register a new one alongside, or run both during a transition. Where a number cannot move cleanly, we say so early.",
      },
      {
        q: "What happens to our existing conversation history?",
        a: "Contacts, tags, custom fields and consent records import directly. Message history is typically archived from your previous tool and referenced rather replayed, because thread state does not translate between platforms — we agree the retention approach in discovery.",
      },
      {
        q: "Do our templates have to be approved again?",
        a: "Templates are migrated into the library and re-submitted where Meta requires approval, with variables rebound and sample values supplied. This runs in weeks 2–3 precisely so template review never stands between you and go-live.",
      },
      {
        q: "What training do our agents get?",
        a: "Role-based sessions built on your configuration: agents work the inbox with your queues and macros; supervisors work assignment, escalation and reporting; admins work numbers, permissions and integrations. Sessions are recorded for new joiners.",
      },

    ],
    cta: {
      title: "Put dates against the risky week.",
      sub: "Kick off with an inventory of your numbers, templates and data — the timeline follows from there.",
      primary: { label: "Plan your onboarding", to: "/company/contact" },
      secondary: { label: "Book a demo first", to: "/demo" },
    },
    related: ["/demo", "/support/plans", "/support"],
  },
};
