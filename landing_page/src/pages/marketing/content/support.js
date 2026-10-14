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
        "Reach Madhura support through the portal, email or the status page: severity levels, first-response targets by plan, escalation paths and what every ticket includes.",
    },
    hero: {
      badge: "Support · Overview",
      title: "Support that answers with an owner, not an auto-reply.",
      highlight: "an owner",
      subtitle:
        "Every request becomes a tracked ticket with a severity, a named owner and a published first-response target. Choose the channel that matches how badly things are broken; we choose the engineer.",
      points: [
        "Portal and email intake that open a ticket in one queue",
        "Severity assigned at triage, targets published by plan",
        "Escalation from engineer to support lead to on-call",
        "Status page, docs and FAQ for what you can resolve now",
      ],
      primaryCta: { label: "Open a ticket", to: "/support/tickets" },
      secondaryCta: { label: "See plans & targets", to: "/support/plans" },
    },
    stats: [
      { value: "S1–S4", label: "Severity scale", note: "assigned when we triage" },
      { value: "4h", label: "First response", note: "on enterprise plans" },
      { value: "24/7", label: "Critical coverage", note: "on-call for S1 on Premium and up" },
      { value: "1", label: "Owner per ticket", note: "never a shared mailbox" },
    ],
    overview: {
      heading: "One queue behind every channel",
      paragraphs: [
        "Support runs out of a single queue. A ticket opened in the workspace portal, an email to support@madhura.co and an escalation raised by your account contact all become the same object: a numbered case with an owner, a severity and a clock. Nothing lives only in someone's personal inbox, and nothing gets lost because it arrived on a channel nobody watches.",
        "What changes between plans is coverage and speed, not who you reach. Community covers working hours with next-business-day replies; Standard and Premium tighten the target and widen the channels; Enterprise adds an agreed coverage window, a named escalation contact and a customer success manager. The full matrix sits on the plans page, and every target is measured on the ticket itself.",
      ],
      bullets: [
        "Portal intake pre-fills workspace, plan and the page you were on",
        "Email to support@madhura.co joins the same queue and thread",
        "Severity agreed with you at triage, revised if impact changes",
        "Status page first: component health, maintenance, past incidents",
        "Docs and troubleshooting guides cover most how-to questions",
        "Escalation path with a named contact at each level",
      ],
    },
    features: [
      {
        icon: "Inbox",
        title: "Portal intake",
        desc: "Open a ticket from inside the workspace — workspace ID, affected feature, recent errors and plan are attached automatically, so triage starts with context instead of questions.",
      },
      {
        icon: "MessageSquare",
        title: "Email intake",
        desc: "Send the problem to support@madhura.co. Replies from either side stay on the ticket thread, so a long investigation never fragments across mailboxes.",
      },
      {
        icon: "Clock",
        title: "Published targets",
        desc: "First-response targets are defined by severity and plan, published rather than negotiated. The ticket shows the target and how much of it is left while the clock runs.",
      },
      {
        icon: "ShieldCheck",
        title: "Escalation path",
        desc: "When a target is at risk — or you ask directly — the ticket escalates from the assigned engineer to a support lead, then to the on-call engineer for critical issues.",
      },
      {
        icon: "Terminal",
        title: "Diagnostics attached",
        desc: "Pull conversation IDs, webhook payloads, error codes and delivery failures from the workspace into the ticket instead of screenshotting them by hand.",
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
          desc: "Open a ticket in the portal or email support. You get a ticket ID immediately, and the confirmation lists everything we captured about the request.",
        },
        {
          title: "Triage",
          desc: "A support engineer assigns severity, confirms scope and routes it to the right product area — messaging, automations, webhooks, billing or integrations.",
        },
        {
          title: "Investigate",
          desc: "We reproduce, offer a workaround when one exists and post updates on the cadence your severity sets. At every moment a named engineer is holding it.",
        },
        {
          title: "Resolve",
          desc: "The fix ships or the answer lands, you confirm, and the ticket closes with a written summary of cause and resolution that stays in your history.",
        },
      ],
    },
    capabilities: {
      heading: "What every ticket promises",
      items: [
        {
          icon: "Award",
          title: "A named owner",
          desc: "One engineer is accountable from triage to closure — visible on the ticket, together with the escalation contacts above them.",
        },
        {
          icon: "Activity",
          title: "Update cadence",
          desc: "At least one substantive update per business day on open tickets, and on a tighter clock while a critical issue is live.",
        },
        {
          icon: "Building",
          title: "Hours & on-call",
          desc: "Standard coverage is 09:00–18:00 IST, Monday to Friday. Premium and Enterprise add an on-call rota for critical issues outside those hours.",
        },
        {
          icon: "FileText",
          title: "Written resolution",
          desc: "Every closed ticket ends with cause, fix and any action needed on your side — usable in an internal report without rewriting it.",
        },
        {
          icon: "Users",
          title: "Escalation on request",
          desc: "Ask for a supervisor at any point and it happens; the request is logged against the ticket, so escalation is measurable rather than a favour.",
        },
      ],
    },
    faq: [
      {
        q: "What is the fastest way to get help when messaging is down?",
        a: "File a ticket from the portal marked S1 and attach the affected number, WABA ID and a conversation ID. Check the status page first — if a component is already degraded, subscribe to that incident and reply to it rather than opening a duplicate, because the incident thread is where fixes are announced.",
      },
      {
        q: "What actually counts as an S1?",
        a: "Messaging stopped or failing broadly for your workspace, an automation misfiring at volume, or a defect sending incorrect messages to customers with no workaround. A slow report or a how-to question is not an S1, however inconvenient it is — severity follows customer impact, not internal urgency.",
      },
      {
        q: "Do you answer outside business hours?",
        a: "Business-hours coverage is 09:00–18:00 IST on weekdays for every plan. Premium and Enterprise add an on-call rota for critical issues outside those hours, and Enterprise agreements state the coverage window in writing so nobody has to guess.",
      },
      {
        q: "Can support read our customer conversations?",
        a: "Only when it is genuinely needed and only with your approval. Engineers request time-boxed, logged access to the specific thread or workspace you approve. Broad standing access is not the default, and every access event is recorded in the audit trail.",
      },
      {
        q: "How do I escalate a ticket I think has stalled?",
        a: "Reply to the ticket and ask for escalation, or contact the escalation named on your plan. The request is recorded, a support lead picks it up, and you get an explanation of where the ticket actually was rather than a reassurance that it is being looked at.",
      },
    ],
    cta: {
      title: "Open a ticket that starts with context.",
      sub: "Two minutes in the portal attaches an owner, a severity and a target to your problem.",
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
      title: "Support Tickets — Submit, Severity Levels & Response Targets | Madhura",
      description:
        "How to submit and track a Madhura support ticket: severity levels S1–S4 with target first-response times, what to include (screenshots, WABA ID, conversation ID) and the SLA by plan.",
    },
    hero: {
      badge: "Support · Tickets",
      title: "A ticket diagnosed on the first reply, not the fifth.",
      highlight: "the first reply",
      subtitle:
        "Screenshots, a WABA ID and a conversation ID turn two days of back-and-forth into one focused answer. Here is exactly what to send, how severity is set, and when you can expect us to reply.",
      points: [
        "File from the portal, email or the in-app error banner",
        "Severity S1–S4 assigned with you during triage",
        "Target first-response times published per plan",
        "Thread, attachments, status and clock on one ticket",
      ],
      primaryCta: { label: "Contact support", to: "/company/contact" },
      secondaryCta: { label: "Check system status", to: "/status" },
    },
    stats: [
      { value: "1h", label: "S1 first response", note: "Premium & Enterprise, 24/7" },
      { value: "S1–S4", label: "Severity scale", note: "agreed with you at triage" },
      { value: "auto", label: "Context attached", note: "workspace, plan, recent errors" },
      { value: "daily", label: "Progress updates", note: "at least one per business day" },
    ],
    overview: {
      heading: "Send identifiers, not adjectives",
      paragraphs: [
        "Almost every slow ticket is slow because the first message said “messages are not delivering” and stopped there. Delivery failures have a cause — a rejected template, an expired opt-in window, a rate limit, a webhook that is throwing 501s — and each one is visible from a different place. The identifiers are what let an engineer open your case and find the failing record in seconds.",
        "Once filed, a ticket is a single thread: the confirmation captures what we attached, triage sets severity and owner, and the first response tells you whether we have an answer, a next question or a workaround. You can reply from the portal or by email — either way it lands on the same ticket, with its status, target clock and history intact.",
      ],
      bullets: [
        "Screenshot or short screen recording with the timestamp visible",
        "WABA ID and phone number ID from Meta Business Manager",
        "Conversation / message ID of an affected thread",
        "Exact failure time with timezone — not “some time this morning”",
        "Expected behaviour in one sentence, actual behaviour in one",
        "Blast radius: one contact, one number, or the whole workspace",
      ],
    },
    features: [
      {
        icon: "FileText",
        title: "Reproduction steps",
        desc: "Numbered steps, expected versus actual, and how often it happens. If we cannot reproduce it on the first pass, we say so plainly and ask only for what changes the diagnosis.",
      },
      {
        icon: "GitBranch",
        title: "Identifiers that matter",
        desc: "Workspace ID, WABA ID, phone number ID, conversation ID, template name, automation or campaign name, webhook endpoint — the keys that locate your data without a fishing expedition.",
      },
      {
        icon: "Clock",
        title: "Severity & targets",
        desc: "Four severities with published first-response targets by plan. Severity is set during triage and revised with you whenever the blast radius turns out to be different.",
      },
      {
        icon: "Activity",
        title: "Trackable status",
        desc: "Every ticket shows open, waiting on you, in progress, resolved and closed — alongside the target clock and the last update, so nobody has to ask where it stands.",
      },
      {
        icon: "Layers",
        title: "Attachments, redacted",
        desc: "Attach logs, HAR files and recordings. Redact end-customer personal data unless it is the defect itself; if we need one specific thread, we request access instead.",
      },
      {
        icon: "RefreshCw",
        title: "Reopen in one click",
        desc: "A resolution that does not hold reopens the original ticket with its full history, so you never restart the story or re-explain context we already had.",
      },
    ],
    workflow: {
      heading: "The life of a ticket",
      steps: [
        {
          title: "File",
          desc: "Portal, email or the in-app error banner. A confirmation with the ticket ID arrives immediately and lists exactly which context we captured.",
        },
        {
          title: "Triage",
          desc: "Severity and owner are assigned, then the ticket routes to messaging, automations, webhooks, billing or integrations. The first response states the target and the next step.",
        },
        {
          title: "Work",
          desc: "Reproduction, a workaround where one exists, and updates on the severity cadence. We ask for more detail only when it would genuinely move the diagnosis forward.",
        },
        {
          title: "Close",
          desc: "The fix is verified with you, a resolution summary is written into the ticket, and reopening stays available if the behaviour returns.",
        },
      ],
    },
    capabilities: {
      heading: "Severity levels and target first response",
      items: [
        {
          icon: "Zap",
          title: "S1 — Critical",
          desc: "Messaging stopped or failing broadly, or incorrect messages reaching customers with no workaround. First response within 1 hour on Premium and Enterprise around the clock; within 4 business hours on Standard.",
        },
        {
          icon: "Activity",
          title: "S2 — High",
          desc: "A core feature is broken or a campaign cannot send, with a workaround available. First response within 4 business hours on Premium and Enterprise, 8 business hours on Standard.",
        },
        {
          icon: "Layers",
          title: "S3 — Medium",
          desc: "Degraded behaviour, an incorrect report or a non-blocking defect. First response within 1 business day across paid plans, with the fix scheduled into the normal release train.",
        },
        {
          icon: "Search",
          title: "S4 — Question",
          desc: "How-to, configuration and best-practice questions. Answered within 2 business days, usually with a documentation link that actually answers the question you asked.",
        },
        {
          icon: "Building",
          title: "SLA by plan",
          desc: "Community: next business day, working hours. Standard: 8 business hours. Premium: 4 business hours plus weekend on-call for S1. Enterprise: coverage window and escalation contacts defined in your agreement.",
        },
      ],
    },
    faq: [
      {
        q: "Where do I find my WABA ID and conversation ID?",
        a: "The WABA ID and phone number ID live in Meta Business Manager under your WhatsApp account; inside Madhura both are on the Channels settings screen, and the workspace ID sits on the Workspace settings page. Any ticket opened from the portal carries these automatically — they are only needed when you file by email.",
      },
      {
        q: "What if I do not know how severe the issue is?",
        a: "File it as you see it. Triage sets severity during the first response, explains which target applies and confirms it with you. Severity is revised freely in both directions — it follows customer impact, not how loudly the issue was reported.",
      },
      {
        q: "Can we file tickets by email instead of the portal?",
        a: "Yes. Email to support@madhura.co and every reply threads onto the same ticket. Only the initial report needs the identifiers and reproduction steps; after that it is a normal conversation, with status and target still visible in the portal.",
      },
      {
        q: "How do we tell our outage from a platform incident?",
        a: "Check the status page before filing. If a component is degraded, subscribe to the incident and add your workspace detail to it — that both speeds the fix and keeps your ticket linked to the cause. If every component is operational, file normally and we will look at your configuration first.",
      },
      {
        q: "What happens after a ticket is closed?",
        a: "The resolution summary stays searchable in your portal history, reopening takes one click, and the ticket can be exported for an internal post-mortem. If the underlying cause needs a design change rather than a fix, we will tell you and you can raise it as a feature request.",
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
        "Madhura support tiers compared: response targets, channels from email to phone to a dedicated CSM, onboarding help and escalation paths for Community, Standard, Premium and Enterprise.",
    },
    hero: {
      badge: "Support · Plans",
      title: "Pick the support tier that matches your risk.",
      highlight: "matches your risk",
      subtitle:
        "Every tier reaches the same engineers and the same ticket system. What changes is how fast we answer, when we answer, and how much of the rollout we take on with you.",
      points: [
        "Community, Standard, Premium and Enterprise tiers",
        "Targets published per severity, not negotiated case by case",
        "Channels widen up the stack: email, portal, phone, CSM",
        "Onboarding help and escalation depth increase by tier",
      ],
      primaryCta: { label: "Talk to sales", to: "/company/contact" },
      secondaryCta: { label: "See ticket severity", to: "/support/tickets" },
    },
    stats: [
      { value: "4", label: "Support tiers", note: "from community to enterprise" },
      { value: "1 day", label: "Community reply", note: "next business day, working hours" },
      { value: "4h", label: "Premium first response", note: "business hours, S1 faster" },
      { value: "24/7", label: "Enterprise critical", note: "coverage window per agreement" },
    ],
    overview: {
      heading: "Same engineers, different clocks",
      paragraphs: [
        "Support tiers are not a two-tier class system in which free customers get a bot. The same support engineers work every plan; a tier buys you a shorter clock, wider coverage and more channels — a portal ticket with a target on it, a weekend on-call rota, a phone call when a screen share is faster than typing, or a named person who already knows your workspace.",
        "The tier also decides how much of the rollout we carry. Self-serve onboarding — checklist, docs, templates — is available to everyone. From Premium up, migration assistance and training are part of the package; Enterprise includes a guided rollout with a named lead and a customer success manager who reviews delivery health with you.",
      ],
      bullets: [
        "Community — docs, FAQ, status page, email next business day",
        "Standard — tracked portal tickets, 8 business hour response",
        "Premium — 4 business hours, weekend on-call, phone callback",
        "Enterprise — agreed coverage window, named contacts, CSM",
        "Channels widen with tier: email → portal → phone → CSM",
        "Onboarding scales from a checklist to a guided migration",
      ],
    },
    features: [
      {
        icon: "Users",
        title: "Community",
        desc: "For trials and small teams: documentation, this FAQ, the status page and email to support@madhura.co with a next-business-day reply during working hours.",
      },
      {
        icon: "Inbox",
        title: "Standard",
        desc: "Tracked portal tickets with an 8 business hour first-response target, daily progress updates on everything open, and a written resolution on every closed case.",
      },
      {
        icon: "Rocket",
        title: "Premium",
        desc: "4 business hour first response, weekend on-call for critical issues, a phone callback when an incident needs a call, and a quarterly review of open items and delivery health.",
      },
      {
        icon: "Building",
        title: "Enterprise",
        desc: "Coverage window and response targets written into the agreement, a named escalation contact, a customer success manager, and onboarding and training included in the rollout.",
      },
      {
        icon: "Send",
        title: "Onboarding help",
        desc: "Higher tiers include migration assistance — number setup, template import, contact data import and agent training — from a shared checklist up to a rollout led by a named engineer.",
      },
      {
        icon: "ShieldCheck",
        title: "Escalation paths",
        desc: "Every tier can escalate in writing; the depth differs. Community gets a support lead review, Premium gets weekend on-call, Enterprise gets a named contact with agreed response commitments.",
      },
    ],
    workflow: {
      heading: "Choosing and starting a plan",
      steps: [
        {
          title: "Assess",
          desc: "Match team size, send volume and coverage hours to a tier. If WhatsApp is revenue-critical, the real difference between Standard and Premium is the on-call rota.",
        },
        {
          title: "Confirm",
          desc: "Sales confirms targets, channels and onboarding scope in writing. Enterprise coverage windows and escalation contacts become part of the agreement, not a verbal promise.",
        },
        {
          title: "Onboard",
          desc: "Migration, template import, queue configuration and training run against the go-live checklist described in the onboarding program.",
        },
        {
          title: "Review",
          desc: "Premium and Enterprise review open tickets, delivery health and upcoming changes together. Community self-serves from the docs and the status page.",
        },
      ],
    },
    capabilities: {
      heading: "What widens as you move up",
      items: [
        {
          icon: "MessageCircle",
          title: "Email",
          desc: "support@madhura.co on every tier, including Community. Replies thread onto your ticket, so the history survives the channel it started on.",
        },
        {
          icon: "Inbox",
          title: "Portal",
          desc: "Tracked tickets with status, severity, target clock and attachments — the standard channel on paid tiers and the fastest route to triage.",
        },
        {
          icon: "Clock",
          title: "Phone callback",
          desc: "A scheduled call for critical issues on Premium and Enterprise, when sharing a screen with an engineer is faster than another round of tickets.",
        },
        {
          icon: "Award",
          title: "Named CSM",
          desc: "Enterprise gets a customer success manager who knows your workspace, your branches and your escalation history, and owns the relationship between incidents.",
        },
        {
          icon: "GitBranch",
          title: "Escalation depth",
          desc: "Each tier states who you escalate to and how quickly they respond, so escalation is a defined process rather than a raised voice in a thread.",
        },
      ],
    },
    faq: [
      {
        q: "Which plan should we start on?",
        a: "Trials and evaluation suit Community. Once agents live in the inbox daily, Standard is the floor. If campaigns and automations carry revenue — and an hour of downtime is visible on the P&L — Premium is the sensible tier. Multi-branch or regulated operations usually want Enterprise, because the coverage window and escalation contacts get written down.",
      },
      {
        q: "Are the response targets guarantees?",
        a: "Targets on this page are commitments we measure against real ticket timestamps. Enterprise targets, coverage windows and any service credits are defined in your agreement; everything else is our published standard. If we miss one, the ticket shows it and we say so rather than redefining the clock.",
      },
      {
        q: "Can we change plans mid-term?",
        a: "Yes. Upgrades take effect immediately and are prorated; moving to a lower tier applies at renewal. If your volumes or coverage hours change, we would rather move you than quietly watch tickets miss their targets.",
      },
      {
        q: "Is onboarding charged separately?",
        a: "Self-serve onboarding — checklist, documentation, template library and recorded walkthroughs — is free on every plan. Guided migration and agent training are included from Premium upwards, and quoted as a one-off engagement on Standard.",
      },
      {
        q: "Do you complete security questionnaires during procurement?",
        a: "Yes. Request our security documentation and questionnaire pack through the trust center pages; enterprise reviews are handled by the same team that answers them for every customer, with the current attestation status stated openly in the response.",
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
      title: "System Status — Component Health, Maintenance & Incident Notices | Madhura",
      description:
        "What Madhura publishes on its status surface: health of the Messaging API, Automation Engine, Webhooks, Dashboard and Integrations, maintenance windows, incident history and how updates are communicated.",
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
        "Signed webhook so your own ops tooling can react",
      ],
      primaryCta: { label: "Report an issue", to: "/support/report-issue" },
      secondaryCta: { label: "Incident response process", to: "/trust/incident-response" },
    },
    stats: [
      { value: "5", label: "Published components", note: "messaging to integrations" },
      { value: "3", label: "Update channels", note: "status page, email, webhook" },
      { value: "planned", label: "Maintenance windows", note: "announced before they start" },
      { value: "rolling", label: "Incident history", note: "past incidents stay visible" },
    ],
    overview: {
      heading: "Status is a publication, not a screenshot",
      paragraphs: [
        "A single green dot tells you nothing you can act on. Madhura reports each component separately — Messaging API, Automation Engine, Webhooks, Dashboard and Integrations — with one of four states: operational, degraded, partial disruption, or under maintenance. When a state changes, the change carries a timestamp, a description of what customers are experiencing, and what we are doing about it.",
        "The status surface is the source of truth during an incident. Email subscribers are notified when a component moves in either direction, and a signed webhook posts the same event to an endpoint you choose, so your systems can pause a campaign or open your own incident without anyone watching a page. After resolution, the incident and its timeline remain in the published history alongside the maintenance windows that have run.",
      ],
      bullets: [
        "Component states: operational, degraded, partial disruption, maintenance",
        "Start and end times on every incident, kept in a rolling history",
        "Maintenance windows announced ahead with expected impact",
        "Email subscriptions per component or for the whole workspace",
        "Signed webhook carrying component, severity and timestamps",
        "Post-incident summary published after the state returns to normal",
      ],
    },
    features: [
      {
        icon: "Send",
        title: "Messaging API",
        desc: "Inbound and outbound message flow, template submission and delivery receipts — the component whose state decides whether your customers are hearing from you at all.",
      },
      {
        icon: "Zap",
        title: "Automation Engine",
        desc: "Trigger evaluation, delays and scheduled journeys. Its status tells you whether journeys are running on time or queueing behind a backlog.",
      },
      {
        icon: "GitBranch",
        title: "Webhooks",
        desc: "Delivery of outbound events to your endpoints, including retries and signature validity — the line your own CRM, billing and data pipelines depend on.",
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
        desc: "Planned work is published in advance with scope and expected impact. Emergency maintenance appears the moment it is declared and follows the same update cadence.",
      },
    ],
    workflow: {
      heading: "How an incident is communicated",
      steps: [
        {
          title: "Detect",
          desc: "Automated monitoring and internal alerting flag the anomaly, and an on-call engineer confirms it is real — including whether it is platform-side or configuration — before anything is published.",
        },
        {
          title: "Declare",
          desc: "The incident is declared with a severity and the affected components. The status page updates first; subscriptions and webhook events follow immediately after.",
        },
        {
          title: "Update",
          desc: "Progress is posted at a steady cadence while the incident is live: what is affected, what is being done, and what you can safely do in the meantime.",
        },
        {
          title: "Resolve & review",
          desc: "State returns to operational, subscribers are notified of recovery, and a written summary with a timeline and follow-up actions stays in the published history.",
        },
      ],
    },
    capabilities: {
      heading: "Subscribing and integrating with status",
      items: [
        {
          icon: "MessageCircle",
          title: "Email notices",
          desc: "Subscribe by component and receive a message on every state change — degraded and recovered — so the page comes to you instead of the other way round.",
        },
        {
          icon: "Terminal",
          title: "Webhook feed",
          desc: "A signed payload carries component, severity, state and timestamps to an endpoint you choose, so your tooling can pause sends or raise an internal incident automatically.",
        },
        {
          icon: "Search",
          title: "Auditable history",
          desc: "Past incidents and maintenance windows stay published with their timelines — the record of how the platform behaved, not a claim about how it behaves.",
        },
        {
          icon: "Inbox",
          title: "Tickets linked to incidents",
          desc: "When a component is degraded, affected tickets are linked to the open incident, so updates are written once and reach everyone waiting on them.",
        },
        {
          icon: "FileText",
          title: "What we publish",
          desc: "Scope, customer impact, start time, updates and resolution. Availability commitments for your workspace live in your agreement rather than as a headline percentage here.",
        },
      ],
    },
    faq: [
      {
        q: "Why is there no big uptime percentage on this page?",
        a: "Because a single percentage hides the thing you actually need: which component was affected, for how long, and whether your workflows were touched. We publish component state plus the full history of incidents and maintenance windows with their timelines; concrete availability commitments for your workspace are stated in your agreement.",
      },
      {
        q: "How will we find out when something breaks?",
        a: "Three ways, and you can use all of them: the status page itself, email subscriptions per component, and a signed webhook to an endpoint you control. During a live incident the status page is updated first, and subscribers are notified the moment state changes in either direction.",
      },
      {
        q: "How far ahead is maintenance announced?",
        a: "Planned maintenance is published before the window opens, with its scope, expected impact and the components involved. It is scheduled away from your peak sending hours wherever possible. Emergency maintenance is announced as soon as it is declared and then follows the normal incident update cadence.",
      },
      {
        q: "Should we still open a ticket during an incident?",
        a: "If your workspace has a specific angle — one number failing while the component is only partially disrupted — yes, and mention the incident so we can link it. If you simply want updates, subscribe to the incident instead: you will get the same information the ticket would have carried, without waiting in a queue.",
      },
      {
        q: "Do you report incidents caused by third parties?",
        a: "Yes. If a Meta-side outage, a connector partner or an upstream dependency is the cause, the incident says so explicitly on the affected component line. Honest attribution is the only version of a status page worth publishing.",
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
        "Guided form that asks for what engineers actually need",
        "Triage stages visible on the ticket from intake to closure",
        "Workaround guidance offered as soon as one is known",
        "Fix verification with you before the ticket closes",
      ],
      primaryCta: { label: "Contact support", to: "/company/contact" },
      secondaryCta: { label: "Check known issues", to: "/status" },
    },
    stats: [
      { value: "3", label:"Triage stages", note: "intake, diagnosis, verification" },
      { value: "1h", label: "S1 first response", note: "Premium & Enterprise, 24/7" },
      { value: "0", label: "Duplicate chasing", note: "linked, never re-asked" },
      { value: "1", label: "Workaround first", note: "offered when one exists" },
    ],
    overview: {
      heading: "A bug report is a reproduction recipe",
      paragraphs: [
        "Reporting well is what separates a fixed tomorrow from a fixed in three weeks. The report needs the shortest path to the failure: what you did, what you expected, what happened instead, when it happened with a timezone, and the identifiers that let an engineer pull the exact record — workspace ID, WABA ID, conversation ID, template or automation name. If it only happens on one number or one branch, say that too; blast radius changes severity, and severity changes everything downstream.",
        "After you report, the work is staged rather than vague. Intake confirms we have it and what we captured, diagnosis reproduces it and assigns a severity with you, and verification means we do not close on 'should be fixed now' — the fix is confirmed against your original reproduction steps, with a workaround offered in the meantime whenever one exists.",
      ],
      bullets: [
        "Shortest reproduction path: steps, expected, actual, frequency",
        "Timestamps with timezone and the affected number or branch",
        "Identifiers: workspace, WABA, conversation, template, automation",
        "Blast radius: one contact, one number, or the whole workspace",
        "Whether a workaround exists today and how costly it is",
        "Whether an existing incident on the status page explains it",
      ],
    },
    features: [
      {
        icon: "FileText",
        title: "Guided intake",
        desc: "The form asks for reproduction steps, expected versus actual behaviour, identifiers and blast radius — the fields that decide whether the first reply can be an answer.",
      },
      {
        icon: "Activity",
        title: "Visible triage stages",
        desc: "The ticket shows intake, diagnosis, fix in progress and verification, so you can see which stage you are in rather than inferring it from the silence.",
      },
      {
        icon: "Clock",
        title: "Timeline you can plan around",
        desc: "First response is set by severity and plan; after that, open tickets get at least one substantive update per business day, and critical ones get more.",
      },
      {
        icon: "ShieldCheck",
        title: "Workaround guidance",
        desc: "If a route exists that keeps you sending while the defect is being fixed — a fallback template, a paused journey, a manual step — it is documented on the ticket, not offered verbally.",
      },
      {
        icon: "GitBranch",
        title: "Linked, not duplicated",
        desc: "If the cause matches an open incident or another customer's report, your ticket is linked to it. You get the same updates without re-explaining the problem.",
      },
      {
        icon: "CheckCircle2",
        title: "Verified closure",
        desc: "We reproduce your original steps against the fix before closing. If the behaviour returns, one click reopens the same ticket with all of its history.",
      },
    ],
    workflow: {
      heading: "What happens after you report",
      steps: [
        {
          title: "Intake",
          desc: "You get a ticket ID immediately with a record of the context we attached. Anything missing is requested in one consolidated message, not a drip of questions.",
        },
        {
          title: "Diagnosis",
          desc: "An engineer reproduces the behaviour, confirms or revises the severity with you, and states the target and the next milestone in the first response.",
        },
        {
          title: "Workaround & fix",
          desc: "A workaround is documented if one exists, the fix is scheduled, and updates land on the ticket at the cadence your severity sets until it ships.",
        },
        {
          title: "Verification",
          desc: "We run your original reproduction steps against the fix, you confirm on your side, and the ticket closes with a written summary of cause and resolution.",
        },
      ],
    },
    capabilities: {
      heading: "Timelines you can hold us to",
      items: [
        {
          icon: "Zap",
          title: "First response",
          desc: "Set by severity and plan — S1 within 1 hour on Premium and Enterprise around the clock, S2 within 4 business hours, S3 within a day, S4 within two.",
        },
        {
          icon: "Activity",
          title: "Updates while open",
          desc: "At least one substantive update per business day on open tickets, and a tighter cadence while a critical issue is live — including the updates that say nothing has changed.",
        },
        {
          icon: "Search",
          title: "Reproduction window",
          desc: "If we cannot reproduce a reported defect, we tell you within the first response and ask for the specific missing detail rather than parking the ticket.",
        },
        {
          icon: "RefreshCw",
          title: "Fix scheduling",
          desc: "Confirmed defects are scheduled against the release train; severity and blast radius decide where in it they land, and the ticket shows the planned window.",
        },
        {
          icon: "FileText",
          title: "Post-fix summary",
          desc: "Cause, fix and anything you need to change are written into the ticket — so your internal report does not depend on reconstructing what we did.",
        },
      ],
    },
    faq: [
      {
        q: "What if the bug only happens sometimes?",
        a: "Report it anyway with the frequency and the conditions — time of day, number, branch, campaign size, media type. Intermittent defects are usually tied to load or a specific payload, and the pattern you notice is often faster than any log we could pull.",
      },
      {
        q: "How soon will someone look at it?",
        a: "The first response follows your plan and severity — S1 within an hour on Premium and Enterprise, S4 within two business days. From that first response you know the owner, the stage and the next update, which is usually more useful than a fast reply that says nothing.",
      },
      {
        q: "What should we do while waiting for the fix?",
        a: "Ask for the workaround on the ticket. Depending on the defect it may be a paused journey, a fallback template, sending from a second number, or a manual step with a known cost. If no workaround exists, the ticket says so plainly so you can plan around it instead of hoping.",
      },
      {
        q: "Will we be told when it is fixed?",
        a: "Yes — the ticket moves to verification, the fix is confirmed against your original reproduction steps, and the resolution summary lands in the same thread you have been replying to. Nothing closes silently in the background.",
      },
      {
        q: "Is this the right place for a missing feature?",
        a: "Not quite. A bug is behaviour that contradicts documented or reasonable expectations; a missing capability belongs on the feature-requests page, where it is reviewed by product rather than scheduled as a defect.",
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
      title: "Feature Requests — How Ideas Are Reviewed & What to Expect | Madhura",
      description:
        "How to submit a feature request to Madhura, how requests are reviewed and prioritised, how roadmap visibility works and what you can realistically expect after you submit.",
    },
    hero: {
      badge: "Support · Feature requests",
      title: "Tell us what would make the platform indispensable.",
      highlight: "indispensable",
      subtitle:
        "A feature request that carries a use case, a workaround you live with today and who it affects beats a one-line idea every time. Here is how requests are reviewed and what happens next.",
      points: [
        "Submit from the portal, your CSM, or a call",
        "Reviewed on a fixed cadence by product and engineering",
        "Roadmap visibility without invented delivery dates",
        "Every request gets a disposition, not a silent archive",
      ],
      primaryCta: { label: "Contact support", to: "/company/contact" },
      secondaryCta: { label: "See what shipped", to: "/changelog" },
    },
    stats: [
      { value: "monthly", label: "Review cadence", note: "product and engineering together" },
      { value: "4", label: "Possible outcomes", note: "planned, exploring, declined, duplicate" },
      { value: "0", label: "Silent archives", note: "every request gets a disposition" },
      { value: "1", label: "Roadmap view", note: "committed work, honestly dated" },
    ],
    overview: {
      heading: "Prioritisation you can see, dates you can trust",
      paragraphs: [
        "Most roadmap pain is not caused by a team refusing a feature; it is caused by never hearing what happened to it. Madhura reviews incoming requests on a fixed monthly cadence with product and engineering in the same room, because half of what looks like a missing feature turns out to be a configuration question, a duplicate of something already committed, or a smaller change that solves the same job.",
        "Every request leaves that review with a disposition: planned, exploring, declined or duplicate — each with a reason attached. Planned items appear on the roadmap view with a window we are willing to defend; exploring means the problem is accepted but the shape of the solution is not settled; declined means a clear explanation of why, which is a legitimate answer and better than silence.",
      ],
      bullets: [
        "Use case first: who needs it, how often, and what it blocks",
        "The workaround you use today and what it costs you",
        "Volume: how many teams, branches or contacts are affected",
        "Expected versus actual behaviour, in concrete terms",
        "Whether an API or webhook would solve it in the interim",
        "A disposition with reasoning on every request reviewed",
      ],
    },
    features: [
      {
        icon: "Send",
        title: "How to submit",
        desc: "Raise it from the portal's feature-request form, hand it to your customer success manager, or bring it to a quarterly review. Requests from calls and tickets are transcribed into the same backlog so nothing lives only in a meeting note.",
      },
      {
        icon: "Users",
        title: "Who reviews it",
        desc: "Product owns the backlog; engineering joins to size the work. Requests are read together, because the interesting ones are rarely independent — three small asks often describe one missing primitive.",
      },
      {
        icon: "Filter",
        title: "How it is prioritised",
        desc: "Impact on customer outcomes, how many teams hit it, how painful the current workaround is, and how it fits the direction of the product. Volume helps; a single team with a blocking problem can outrank a popular convenience.",
      },
      {
        icon: "TrendingUp",
        title: "Roadmap visibility",
        desc: "Committed work is published with a delivery window rather than a promise date. Exploring items are visible as problems under investigation, so you can plan around what we know instead of what we hope.",
      },
      {
        icon: "FileText",
        title: "What to expect",
        desc: "A disposition after the next review: planned with a window, exploring with the open question stated, duplicate with a link to the original, or declined with a reason you can argue against.",
      },
      {
        icon: "RefreshCw",
        title: "Revisiting declines",
        desc: "A declined request is not deleted. If your context changes — volume, regulation, branch structure — resubmit with what changed, and it re-enters the review with its history attached.",
      },
    ],
    workflow: {
      heading: "From request to release",
      steps: [
        {
          title: "Submit with a use case",
          desc: "Describe the job you are trying to do, who it affects, and what you do today instead. Include identifiers only if you are reporting related broken behaviour.",
        },
        {
          title: "Review",
          desc: "Requests are read at the monthly product and engineering review, sized honestly, and grouped where several describe the same underlying gap.",
        },
        {
          title: "Disposition",
          desc: "You get planned, exploring, duplicate or declined with reasoning — and the planned items appear on the roadmap with a window we are prepared to defend.",
        },
        {
          title: "Build & confirm",
          desc: "When it ships, the requester is told first, and early access is offered where a preview would improve the result. Feedback at that stage genuinely changes the shape of the feature.",
        },
      ],
    },
    capabilities: {
      heading: "What a strong request contains",
      items: [
        {
          icon: "MessageSquare",
          title: "The use case",
          desc: "Not the widget you want, the outcome you need: 'agents must see the last order without leaving the thread' beats 'add a sidebar'.",
        },
        {
          icon: "Activity",
          title: "Frequency & volume",
          desc: "How often it happens and how many teams, branches or contacts it touches — the difference between an annoyance and an operational blocker.",
        },
        {
          icon: "Terminal",
          title: "Today's workaround",
          desc: "What you do now, what it costs in minutes or mistakes, and why the obvious alternative — an API call, a webhook, a spreadsheet — does not hold.",
        },
        {
          icon: "GitBranch",
          title: "Fit with existing flows",
          desc: "Which inbox, campaign, automation or reporting workflow it belongs to. Requests anchored in a real flow are far easier to size and design against.",
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
        q: "How long until we hear back about a request?",
        a: "Every request is read at the next monthly review, and the disposition follows shortly afterwards — planned, exploring, duplicate or declined with a reason. If something is urgent enough to need an answer sooner, say so when you submit and it will be raised out of cadence.",
      },
      {
        q: "Do you publish delivery dates?",
        a: "We publish delivery windows for committed work and honest problem statements for everything else. Dates for work that has not been sized tend to become wrong in one direction, so we would rather commit late and ship than announce early and slip repeatedly.",
      },
      {
        q: "Our request was declined — can we try again?",
        a: "Yes, particularly if the reasoning no longer applies. Declined requests stay in the backlog with their reason. Resubmit with what changed — new volume, a regulatory requirement, a branch rollout — and it re-enters review with its history intact.",
      },
      {
        q: "Is there a way to vote on other customers' requests?",
        a: "Request volume is considered during review, and your customer success manager can tell you whether a request you care about has been raised elsewhere. Detailed public voting boards tend to reward loud minorities, so we weight described use cases above raw counts.",
      },
      {
        q: "What if we need something custom for our integration?",
        a: "Start with the API and webhooks — most extensibility needs are already covered, and the developer pages show what is possible today. If a genuine gap remains, submit it as a request and mark it integration-blocking; those are reviewed with the platform team rather than the product backlog alone.",
      },
    ],
    cta: {
      title: "Put the use case on the record.",
      sub: "One well-described request reaches a real review — and comes back with a disposition either way.",
      primary: { label: "Talk to us", to: "/company/contact" },
      secondary: { label: "Read the docs", to: "/docs" },
    },
    related: ["/support/report-issue", "/support", "/developers"],
  },

  /* ── Demo ────────────────────────────────────────────────────────────────── */
  "/demo": {
    path: "/demo",
    section: "Support",
    renderer: "contact",
    meta: {
      title: "Book a Demo — WhatsApp CRM Walkthrough | Madhura",
      description:
        "See Madhura on your own workflow: a WhatsApp-hosted demo, a video call, a live screen share or an in-product tour. Pick the format that suits your team and book it.",
    },
    hero: {
      badge: "Support · Demo",
      title: "See your own workflow running, not a canned script.",
      highlight: "your own workflow",
      subtitle:
        "Bring a real process — an enquiry flow, a payment follow-up, a support queue — and we will build it live in front of you. Pick the format below: WhatsApp, video call, screen share or a self-guided tour.",
      points: [
        "Four formats: WhatsApp demo, video call, screen share, product tour",
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
        icon: "Video",
        title: "Video call",
        email: "demos+video@madhura.co",
        desc: "A 30-minute live walkthrough with a solutions engineer — discovery first, then the three workflows that matter to you, on your own use cases.",
        sla: "Scheduled within 1 business day",
      },
      {
        icon: "Users",
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
        a: "Yes, and it makes the session better. Bring a template set, an export of contacts or a sample of your current conversation volume, and we will show how the migration would look — including what would need rework and what carries across as-is.",
      },
      {
        q: "Is there something we can try without talking to anyone?",
        a: "Yes — the self-guided tour above and the free trial both run without a call. The demo exists for the parts that are hard to infer from a screen: architecture, migration, permissions across branches, and how support and onboarding would work for your team.",
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
        "The Madhura onboarding program: migration from other tools, contact and template import, team training, a go-live checklist and a week-by-week timeline to first production traffic.",
    },
    hero: {
      badge: "Support · Onboarding",
      title: "From first call to first production message in five weeks.",
      highlight: "in five weeks",
      subtitle:
        "A week-by-week program covering migration, data import, template migration, configuration and team training — ending with a go-live checklist both sides sign off, not a login and good luck.",
      points: [
        "Migration from other tools and spreadsheets, validated before cut-over",
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
      { value: "1", label: "Named onboarding lead", note: "from kickoff to hypercare" },
    ],
    overview: {
      heading: "Migration is the risky week — so it is the planned one",
      paragraphs: [
        "Going live on WhatsApp is rarely blocked by the software. It is blocked by the things nobody scheduled: contacts trapped in a previous tool, templates written for a different category, an opt-in list with no evidence behind it, and an agent team that has never shared a thread. Onboarding exists to put dates and owners against exactly those items, so the cut-over is a decision rather than a hope.",
        "The program runs week by week with a named onboarding lead. Discovery and access come first, migration and import next, configuration and dry-runs after that, then training and a pilot — and only then cut-over, against a checklist both sides have signed. Enterprise rollouts add branch-by-branch phasing and a second wave for additional numbers.",
      ],
      bullets: [
        "Inventory of current tools, numbers, templates and data sources",
        "Contact and history import with row counts reconciled before cut-over",
        "Template migration with re-submission for approval where needed",
        "Queue, permission and automation configuration against your org chart",
        "Role-based training with exercises built from your own scenarios",
        "Go-live checklist, pilot send and a hypercare window afterwards",
      ],
    },
    features: [
      {
        icon: "RefreshCw",
        title: "Migration from other tools",
        desc: "Whether you come from another BSP, an in-house setup or a shared spreadsheet, we map what carries across, what needs rework, and whether your existing number can move or a fresh one is faster.",
      },
      {
        icon: "Download",
        title: "Data import",
        desc: "Contacts, tags, custom fields and consent records import from CSV or through the API, with row counts reconciled on both sides — an import that silently drops 4% of contacts is worse than one that fails loudly.",
      },
      {
        icon: "FileText",
        title: "Template migration",
        desc: "Existing templates are normalised into the library, variables rebound to real fields and re-submitted for approval, so nothing stalls on the first campaign after cut-over.",
      },
      {
        icon: "Users",
        title: "Team training",
        desc: "Three sessions with different emphasis: agents on the inbox and macros, supervisors on queues, SLAs and reporting, admins on permissions, numbers and integrations — each on your configuration.",
      },
      {
        icon: "CheckCircle2",
        title: "Go-live checklist",
        desc: "Numbers connected, templates approved, routing tested, permissions set, opt-in evidence in place, webhooks verified, pilot send delivered. Both sides sign it before production traffic moves.",
      },
      {
        icon: "Rocket",
        title: "Hypercare after cut-over",
        desc: "A focused window after go-live where the onboarding lead and support watch delivery, response times and automations together, and fix the friction that only appears under real volume.",
      },
    ],
    workflow: {
      heading: "Week by week to go-live",
      steps: [
        {
          title: "Week 1 — Discovery & access",
          desc: "Inventory of numbers, templates, data sources and current tooling; workspace created; users and roles provisioned; success criteria agreed in writing.",
        },
        {
          title: "Weeks 2–3 — Migration & import",
          desc: "Number path decided, contacts and history imported and reconciled, templates migrated and re-submitted, consent records carried across with their evidence.",
        },
        {
          title: "Week 4 — Configure & train",
          desc: "Queues, permissions, business hours and automations configured against your structure, a dry-run journey executed end to end, and role-based training for agents, supervisors and admins.",
        },
        {
          title: "Week 5 — Pilot & go-live",
          desc: "Checklist reviewed item by item, a pilot send to a controlled audience, production cut-over, then hypercare: daily checks with your onboarding lead until the numbers settle.",
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
          desc: "Opt-in evidence, opt-out handling and template categories are set up before the first send — compliance is part of go-live, not a cleanup task afterwards.",
        },
        {
          icon: "Terminal",
          title: "Integrations & webhooks",
          desc: "CRM sync, outbound webhooks and signature verification are configured and tested against a staging endpoint before anything points at production.",
        },
        {
          icon: "BarChart3",
          title: "Reporting baseline",
          desc: "SLA targets, delivery funnels and agent dashboards are configured during onboarding, so week one already produces numbers worth reviewing.",
        },
        {
          icon: "Award",
          title: "Named onboarding lead",
          desc: "One person owns the timeline, the checklist and the escalations from kickoff through hypercare — on Premium and Enterprise plans.",
        },
      ],
    },
    faq: [
      {
        q: "How long does onboarding actually take?",
        a: "A typical mid-size rollout reaches production traffic in about five weeks with the week-by-week plan above. Smaller teams with clean data and a single number move faster; multi-branch or multi-number programs phase over longer windows. The timeline is agreed in week one and tracked against the checklist.",
      },
      {
        q: "Can we keep our existing WhatsApp number?",
        a: "Often, yes — it depends on how the number is registered today and with whom. Week 1 establishes the path: migrate the number, register a new one alongside it, or run both during a transition. Where a number cannot move cleanly, we say so early rather than discovering it at cut-over.",
      },
      {
        q: "What happens to our existing conversation history?",
        a: "Contacts, tags, custom fields and consent records import directly. Message history is typically archived from your previous tool and referenced rather than replayed, because thread state does not translate between platforms — we agree the retention approach during discovery so nobody is surprised later.",
      },
      {
        q: "Do our templates have to be approved again?",
        a: "Templates are migrated into the library and re-submitted where Meta requires approval for the new setup, with variables rebound and sample values supplied. This runs in week 2–3 precisely so template review is never the thing standing between you and go-live.",
      },
      {
        q: "What training do our agents get?",
        a: "Role-based sessions built on your configuration: agents work the inbox with your queues, macros and SLAs; supervisors work assignment, escalation and reporting; admins work numbers, permissions and integrations. Sessions are recorded for new joiners, and refresher sessions run after hypercare.",
      },
      {
        q: "What if we want to do it ourselves?",
        a: "Use the go-live checklist and the documentation — the program is a structure, not a dependency. Self-serve onboarding is available on every plan; the named lead and guided migration are what Premium and Enterprise add when the timeline carries business risk.",
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
