/* Solutions (by team/stage) and Industries (by vertical) section pages.
   Every entry is data, not markup. `MarketingPage` renders it. Keep the shape
   stable: path / section / renderer / meta / hero / stats / overview /
   features / workflow / capabilities / faq. `related` and `cta` are omitted on
   purpose — content/index.js fills both in.
   ------------------------------------------------------------------------------- */

export const SOLUTION_PAGES = [
  {
    path: "/solutions",
    section: "Solutions",
    renderer: "standard",
    meta: {
      title: "Solutions — Pick the Profile That Matches Your Team | Madhura",
      description:
        "Five MADHURA profiles — enterprise, small business, sales, marketing and support — with the setup each needs and the failure each prevents.",
    },
    hero: {
      badge: "Solutions",
      title: "Choose the profile that matches your team.",
      subtitle:
        "MADHURA is one WhatsApp CRM — shared inbox, broadcasts, Meta-approved templates, journeys, Flows, AI chatbot, analytics and permissions — configured differently for each kind of team. This page tells you which of the five profiles fits, and each page behind it spells out the setup. Start with the one closest to how your day actually runs.",
      points: [
        "Shared inbox with assignment, collision detection and timers",
        "Broadcasts paced against messaging limits and opt-out state",
        "Journeys, Flows and an AI chatbot on one contact record",
        "Roles and branch scoping that decide who sees what",
      ],
      primaryCta: { label: "Start free trial", to: "/signup" },
      secondaryCta: { label: "Book a demo", to: "/demo" },
    },
    stats: [
      { value: "5", label: "Team profiles", note: "same platform, different configuration" },
      { value: "24h", label: "Service window", note: "free-form replies only while it is open" },
      { value: "24/7", label: "Automations keep running", note: "quiet hours and caps still enforced" },
      { value: "1", label: "Contact record", note: "threads, consent and history live together" },
    ],
    overview: {
      heading: "One platform, five ways to configure it",
      paragraphs: [
        "Most teams do not need a different product; they need the same primitives — an owned thread, a timer, an approved template, an opt-out check — weighted differently. A two-person shop and a forty-branch retailer break in different places, so each profile below starts from the failure mode it prevents rather than from a feature list.",
        "Everything runs in one workspace per tenant. You can start on one profile and slide to another as headcount, branches or compliance requirements change, because nothing migrates: the contacts, threads and templates are already where they belong.",
      ],
      bullets: [
        "For Enterprises (/solutions/enterprise): multi-branch governance, granular roles, audit trail and consolidated reporting.",
        "For Small Businesses (/solutions/small-business): one shared number, a handful of saved replies, live in an afternoon.",
        "For Sales Teams (/solutions/sales-teams): lead capture, pipeline stages and follow-ups that fire without a human.",
        "For Marketing Teams (/solutions/marketing-teams): consent-based segments, wave-paced broadcasts and delivery funnels.",
        "For Customer Support (/solutions/customer-support): queues, timers, escalation and after-hours handling of the window.",
      ],
    },
    features: [
      { icon: "Building", title: "For Enterprises", desc: "Tenant scoping, branch queues, granular roles, audit trail and consolidated reporting. Full walkthrough at /solutions/enterprise." },
      { icon: "Rocket", title: "For Small Businesses", desc: "One shared number, saved replies and an after-hours greeting, without a dedicated ops person. Walkthrough at /solutions/small-business." },
      { icon: "TrendingUp", title: "For Sales Teams", desc: "Keyword capture, assignment rules, stages on the thread and cadence journeys. Walkthrough at /solutions/sales-teams." },
      { icon: "Send", title: "For Marketing Teams", desc: "Consent segments, wave pacing, template category checks and delivery funnels. Walkthrough at /solutions/marketing-teams." },
      { icon: "MessageCircle", title: "For Customer Support", desc: "Queues, response timers, macros, escalation and after-hours snooze. Walkthrough at /solutions/customer-support." },
      { icon: "Layers", title: "The shared foundation", desc: "Every profile runs the same inbox, templates, journeys, Flows, chatbot, analytics and permission model underneath." },
    ],
    workflow: {
      heading: "Getting from a number to a working workspace",
      steps: [
        {
          title: "Connect the number",
          desc: "Port an existing WhatsApp Business number or register a new one. Meta reviews the business and the number before outbound traffic flows, so start this track first.",
        },
        {
          title: "Load the context",
          desc: "Import contacts from CSV or your CRM, map custom fields, and record existing opt-in state — a contact with unknown consent counts as not opted in.",
        },
        {
          title: "Write the templates",
          desc: "Draft the four or five messages you send most, run pre-flight validation, submit to Meta, and keep building while the review runs.",
        },
        {
          title: "Invite the team",
          desc: "Create roles, queues and business hours, then route one pilot group through the inbox before the whole team switches over.",
        },
      ],
    },
    capabilities: {
      heading: "What every profile gets",
      items: [
        { icon: "GitBranch", title: "Branch scoping", desc: "Numbers, queues, hours, templates and reports can be fenced per branch or brand inside one tenant." },
        { icon: "Search", title: "Search across history", desc: "Message text, contact fields, tags, order numbers and attachment names — across the whole retained history." },
        { icon: "ShieldCheck", title: "Consent enforcement", desc: "Opt-out and blocklist state are checked at send time by campaigns and journeys alike, with exclusions logged." },
        { icon: "Activity", title: "Live status", desc: "Delivery, presence and queue state update in place, so nobody refreshes a page to find out what happened." },
        { icon: "Rocket", title: "Plan-dependent limits", desc: "Seats, volume and retention follow your plan; the workspace shows the current caps before a send, not after." },
      ],
    },
    faq: [
      {
        q: "We are both a sales team and a support team. Which profile do we pick?",
        a: "Neither is exclusive. Most workspaces run sales and support queues side by side in one inbox, with routing rules that send billing threads to support and pricing threads to sales. Pick the page that matches the larger half of your day, then add the second queue — the contact records, templates and reporting are shared either way.",
      },
      {
        q: "Do we already need a WhatsApp Business API number?",
        a: "No. You can start on a connected endpoint and move to the official Cloud API path when volume or template use demands it. Threads live on the contact record rather than on a handset, so the history survives the move and the customer never sees the digits change.",
      },
      {
        q: "Which features are gated behind a plan?",
        a: "Seats, concurrent agents, messaging volume, history retention and advanced branch controls are plan-dependent. The workspace displays your current limits, and a send that would exceed a cap is flagged before it starts rather than failing halfway through a campaign.",
      },
      {
        q: "How long before we can actually send?",
        a: "Business and number verification happen once at the platform level, and every outbound template is reviewed individually — utility and authentication templates are usually reviewed within hours, marketing templates often longer. Everything else (inbox, contacts, journeys, Flows) is usable while review runs.",
      },
    ],
  },

  {
    path: "/solutions/enterprise",
    section: "Solutions",
    renderer: "standard",
    meta: {
      title: "For Enterprises — WhatsApp Governance Across Branches | Madhura",
      description:
        "Govern WhatsApp across branches with tenant scoping, granular roles, audit trails, send guardrails and consolidated reporting on every number.",
    },
    hero: {
      badge: "Solutions · Enterprise",
      title: "Run WhatsApp across branches without losing control.",
      subtitle:
        "Large organisations do not fail at WhatsApp because they lack a tool; they fail because four departments share one number with no owner, no permissions and no record. MADHURA gives each branch its own queues, hours, templates and reporting while leadership keeps a single view of the channel.",
      points: [
        "Per-branch numbers, queues, business hours and templates",
        "Role-based permissions down to export and delete",
        "Audit trail on replies, reassignments, exports and deletions",
        "Consolidated reporting with branch-level drill-down",
      ],
      primaryCta: { label: "Start free trial", to: "/signup" },
      secondaryCta: { label: "Book a demo", to: "/demo" },
    },
    stats: [
      { value: "100%", label: "Actions audited", note: "actor and timestamp on every change" },
      { value: "1", label: "Consolidated view", note: "across every branch and number" },
      { value: "24/7", label: "Shift coverage", note: "queues hand over without losing threads" },
      { value: "24h", label: "Service window", note: "templates re-open a thread after it closes" },
    ],
    overview: {
      heading: "Governance first, features second",
      paragraphs: [
        "Scale breaks WhatsApp in predictable ways: a regional manager needs visibility of their region only, an agent resigns and their open threads must move, someone exports a customer list and afterwards nobody can prove who approved it. The enterprise profile answers those questions before they become incidents.",
        "Each branch operates as a scoped unit inside one tenant — its own numbers, hours, queues, templates and permissions — while tags, contact records and metric definitions stay consistent across the organisation. Nothing crosses a boundary that a role does not explicitly allow.",
      ],
      bullets: [
        "Branch scoping for numbers, queues, templates, hours and reports",
        "Roles such as agent, supervisor, branch admin, analyst and billing, each with explicit caps",
        "Export, delete and bulk-send actions are permission-gated and written to the log",
        "Quality-rating and opt-out guardrails applied at send time across all branches",
        "Consolidated dashboards with per-branch drill-down and scheduled delivery",
        "Seats, retention and branch counts are plan-dependent and shown in the workspace",
      ],
    },
    features: [
      { icon: "Building", title: "Branch workspaces", desc: "Each branch gets its own numbers, queues, business hours and template library, while leadership reads one consolidated dashboard." },
      { icon: "Lock", title: "Granular roles", desc: "Decide per role who may export contacts, delete threads, approve sends, view reports or message outside office hours." },
      { icon: "ShieldCheck", title: "Audit trail", desc: "Every reply, reassignment, export and deletion is recorded with actor and timestamp, so an internal review starts from facts." },
      { icon: "BarChart3", title: "Consolidated analytics", desc: "Response distributions, delivery funnels and opt-out trends per branch, comparable on the same axes and exportable on a schedule." },
      { icon: "Users", title: "Handover and escalation", desc: "Bulk reassignment by queue, tag or assignee when people move, plus escalation to a supervisor when a timer runs out." },
      { icon: "Sliders", title: "Send guardrails", desc: "Suppression, frequency caps and pacing apply globally, so one team's experiment cannot degrade the number another team depends on." },
    ],
    workflow: {
      heading: "Rolling out across a large organisation",
      steps: [
        {
          title: "Map the org",
          desc: "Decide what a branch is — region, brand, store or business unit — and which numbers, hours, templates and reports each one owns.",
        },
        {
          title: "Connect the numbers",
          desc: "Port or register each number and verify the business behind it. Meta reviews numbers individually, so run the tracks in parallel.",
        },
        {
          title: "Set roles before traffic",
          desc: "Define who can export, delete, approve and see which reports, then prove the boundaries with a pilot branch using real threads.",
        },
        {
          title: "Open branch by branch",
          desc: "Move queues live one group at a time, watching quality rating and response distributions before the next branch joins.",
        },
      ],
    },
    capabilities: {
      heading: "Operational detail that matters at scale",
      items: [
        { icon: "Search", title: "Scoped search", desc: "Search runs inside the caller's permissions, so an agent cannot read another branch's history by accident." },
        { icon: "Download", title: "Scheduled reporting", desc: "Push branch and consolidated views to CSV, JSON or a webhook your warehouse ingests on a timetable." },
        { icon: "Clock", title: "Hours per branch", desc: "Each branch keeps its own business hours and quiet hours; journeys and auto-replies respect the local clock." },
        { icon: "Terminal", title: "API and webhooks", desc: "REST endpoints and signed webhooks connect queues to your ITSM, CRM or data platform without screen scraping." },
        { icon: "Award", title: "Identity integration", desc: "Access follows your directory through SSO-ready paths on enterprise plans, so leavers are disabled in one place." },
      ],
    },
    faq: [
      {
        q: "Can a branch manager read another branch's conversations?",
        a: "Not by default. Visibility follows the role model: a branch admin sees their own branch's queues, numbers and reports, and any cross-branch view is a separate permission you grant deliberately. Leadership roles get the consolidated view because that is the job they perform.",
      },
      {
        q: "What happens to an agent's threads when they leave?",
        a: "Reassign in bulk by queue, tag or assignee. The conversation history stays attached to the contact record while ownership moves to the next person, and the reassignment itself is written to the audit log with your identity and timestamp.",
      },
      {
        q: "How do we handle export and deletion requests internally?",
        a: "Exports are permission-gated and logged, deletions are soft-deleted inside a retention window you configure, and legal hold suspends that window where your process requires it. Retention length and hold support are plan-dependent, so confirm the configuration against your plan during onboarding.",
      },
      {
        q: "Can we keep our existing numbers and CRM?",
        a: "Yes. Numbers move onto the official WhatsApp Business API path without changing the digits customers already have saved, and contacts, tags and thread state sync through the REST API, webhooks or the Universal CRM Connector so the CRM stays the system of record.",
      },
    ],
  },

  {
    path: "/solutions/small-business",
    section: "Solutions",
    renderer: "standard",
    meta: {
      title: "For Small Businesses — One Shared WhatsApp Number | Madhura",
      description:
        "One WhatsApp number for a small team: shared inbox, saved replies, after-hours auto-reply and plan-dependent limits, ready in an afternoon.",
    },
    hero: {
      badge: "Solutions · Small Business",
      title: "One WhatsApp number, shared by the whole team.",
      subtitle:
        "Small teams lose customers in the gaps: the owner's phone is on another call, the reply never happens, the price list lives in someone's camera roll. MADHURA puts the number in a shared workspace so anyone on shift can answer with the right wording, and the standard replies send themselves.",
      points: [
        "Everyone answers from one number — no second handset",
        "Saved replies for the questions you type every day",
        "Greeting and auto-reply outside your business hours",
        "Plan-dependent pricing with the limits visible up front",
      ],
      primaryCta: { label: "Start free trial", to: "/signup" },
      secondaryCta: { label: "Book a demo", to: "/demo" },
    },
    stats: [
      { value: "1", label: "Number for the team", note: "no device per person" },
      { value: "0", label: "Extra handsets", note: "the workspace runs in the browser" },
      { value: "24/7", label: "Greeting and auto-reply", note: "even when the shop is closed" },
      { value: "24h", label: "Service window", note: "free-form replies while a customer is active" },
    ],
    overview: {
      heading: "The shared-number problem, solved in an afternoon",
      paragraphs: [
        "A small business usually runs WhatsApp on one person's phone. That works until they are busy, on leave, or gone — and the thread, the customer and the promise all leave with them. A shared workspace fixes ownership without adding a call centre or a headcount.",
        "Setup is deliberately short: connect the number, import the contacts you already have, save the five replies you type daily, and invite the two or three people who answer. Journeys, Flows and analytics can wait until the inbox itself is boring.",
      ],
      bullets: [
        "One thread per customer so two people never send two answers",
        "Macros that paste a reply and change the thread state in one keystroke",
        "Greeting, away message and keyword auto-reply for common questions",
        "Tags and internal notes for prices, addresses and job history",
        "Roles that keep billing and deletion out of a part-timer's reach",
      ],
    },
    features: [
      { icon: "Inbox", title: "Shared inbox", desc: "Whoever is on shift sees every thread, its owner and its last action — no forwarding screenshots, no guessing who replied." },
      { icon: "MessageCircle", title: "Saved replies", desc: "The price list, opening hours, delivery radius and booking steps become one-keystroke macros instead of copy-paste archaeology." },
      { icon: "Clock", title: "Hours and auto-reply", desc: "A greeting on first contact, an away message outside your hours, and keyword replies that answer before anyone wakes up." },
      { icon: "Users", title: "Assignment", desc: "Route a thread to a named person or let round-robin decide, so responsibility is visible rather than assumed." },
      { icon: "BarChart3", title: "Plain reporting", desc: "How many conversations came in, how long they waited, which saved reply got used — enough to staff the next busy afternoon." },
    ],
    workflow: {
      heading: "From one phone to one workspace",
      steps: [
        {
          title: "Connect the number",
          desc: "Bring the number your customers already save, verify the business behind it, and keep answering while the review completes.",
        },
        {
          title: "Import your contacts",
          desc: "Upload a CSV or sync from your existing tool, tag the regulars, and record who has already opted out of promotions.",
        },
        {
          title: "Save your replies",
          desc: "Write the five messages you send daily, attach the price list or catalogue once, and make them available to everyone.",
        },
        {
          title: "Invite the team",
          desc: "Add the people who answer, give the owner admin rights, and switch the phone off the shared desk.",
        },
      ],
    },
    capabilities: {
      heading: "Small footprint, real mechanics",
      items: [
        { icon: "Zap", title: "Keyword replies", desc: "A customer typing PRICE or HOURS gets the right answer immediately, at any hour, before a human is involved." },
        { icon: "Layers", title: "WhatsApp Flows", desc: "Collect what you need — address, service type, preferred slot — in a structured form instead of ten back-and-forth messages." },
        { icon: "Search", title: "Find anything", desc: "Search old threads by name, number, tag or a word someone sent last spring, from any device the team uses." },
        { icon: "ShieldCheck", title: "Opt-out handling", desc: "STOP is recorded on the contact and enforced on the next send, including any campaign you run later." },
        { icon: "Download", title: "Take it with you", desc: "Export contacts and conversation history at any time — the data is yours whether or not you stay." },
      ],
    },
    faq: [
      {
        q: "Do our customers have to message a new number?",
        a: "No. The number stays exactly the same; what changes is who can answer it. Contacts, groups you migrate and history come across with it, so the customer experience on the other side of the thread is unchanged.",
      },
      {
        q: "Is this overkill for a team of three?",
        a: "If all you use is the shared inbox, saved replies and the after-hours greeting, that is the whole product for you — the heavier parts stay switched off. Most small teams add journeys later, usually for reminders or a follow-up they keep forgetting.",
      },
      {
        q: "What does it cost?",
        a: "Pricing is plan-dependent: seats, messaging volume and history retention scale with the plan, and the current caps are displayed inside the workspace rather than discovered mid-campaign. Start on the trial and read the limits before you commit.",
      },
      {
        q: "Who inside the team can see the conversations?",
        a: "Roles decide that. You can give someone reply-only access, another person assignment rights, and keep exports, billing and deletions with the owner. Every privileged action is written to the audit log with the person's name on it.",
      },
    ],
  },

  {
    path: "/solutions/sales-teams",
    section: "Solutions",
    renderer: "standard",
    meta: {
      title: "For Sales Teams — WhatsApp Lead Pipeline & Follow-Up | Madhura",
      description:
        "Capture every WhatsApp lead, route it by rule, track stages on the thread and let journeys hold the follow-up cadence instead of people.",
    },
    hero: {
      badge: "Solutions · Sales Teams",
      title: "Every WhatsApp lead lands in a pipeline.",
      subtitle:
        "Inbound messages arrive at all hours and get answered by whoever notices first. MADHURA turns them into owned records — captured, routed, staged and followed up by automation — until a human takes over or the deal closes.",
      points: [
        "Keyword, ad and Flows triggers capture on first contact",
        "Round-robin and skill rules assign an owner immediately",
        "Stages and next actions live on the thread, not a spreadsheet",
        "Follow-up journeys stop the moment a reply arrives",
      ],
      primaryCta: { label: "Start free trial", to: "/signup" },
      secondaryCta: { label: "Book a demo", to: "/demo" },
    },
    stats: [
      { value: "24/7", label: "Inbound capture", note: "triggers fire outside working hours too" },
      { value: "1", label: "Thread per lead", note: "stage, notes and history on the record" },
      { value: "24h", label: "Service window", note: "template needed to re-open a silent thread" },
      { value: "0", label: "Follow-ups left to memory", note: "journeys hold the cadence" },
    ],
    overview: {
      heading: "Leads are a routing problem before they are a closing problem",
      paragraphs: [
        "The first reply sets the temperature of a WhatsApp conversation, and most teams lose it to delay: the enquiry lands at 21:00, sits until morning, and by then three competitors have quoted. Capture and assignment are the parts you can fix mechanically, this week.",
        "Once a lead is an owned thread, the pipeline becomes visible: stage, value, last contact and next action sit on the record, and a cadence journey keeps nudging while the conversation is silent. Humans work the open conversations; automation works the silent ones.",
      ],
      bullets: [
        "Triggers on keyword, ad click, Flows submission or CRM webhook",
        "Assignment rules by territory, product line, language or current load",
        "Stages, values and next actions visible on the thread itself",
        "Cadence journeys: same-day answer, day-three note, day-seven close-out",
        "Template category checked before any re-open outside the 24-hour window",
        "Attribution back to the campaign, keyword or source that produced the lead",
      ],
    },
    features: [
      { icon: "Filter", title: "Lead routing", desc: "Rules pick the owner by territory, product, language or load the moment a message arrives, and notify them while everyone else sees the thread is taken." },
      { icon: "GitBranch", title: "Pipeline stages", desc: "Stage, estimated value and next action attach to the thread, so a pipeline review reads the conversation instead of a rep's memory." },
      { icon: "Zap", title: "Follow-up cadence", desc: "Journeys send the second and third touch on schedule, then cancel themselves the moment the lead replies or the deal closes." },
      { icon: "MessageSquare", title: "Context on the record", desc: "Budget, decision maker, objection, competitor — internal notes and tags that the customer never sees but the next rep always reads." },
      { icon: "BarChart3", title: "Conversion reporting", desc: "Leads created, stage conversion, response time and replies per source, sliced by rep, campaign or branch." },
      { icon: "Users", title: "Workload balance", desc: "See who is carrying which open threads before you assign the next one, so a top rep's queue is not the reason a lead goes cold." },
    ],
    workflow: {
      heading: "How an enquiry becomes a deal",
      steps: [
        {
          title: "Capture",
          desc: "A keyword, ad click, Flows submission or webhook opens the contact and the thread — with the source recorded on the record.",
        },
        {
          title: "Assign",
          desc: "Routing rules pick an owner by territory, product or load. The assignee is notified; collision detection stops a second rep replying.",
        },
        {
          title: "Qualify",
          desc: "The rep pulls the four answers they need — need, budget, timing, authority — using notes, tags and a quick Flow if the lead prefers forms.",
        },
        {
          title: "Follow up",
          desc: "A cadence journey holds the next touch, exits on reply or opt-out, and hands the conversation back to the rep when it goes warm.",
        },
      ],
    },
    capabilities: {
      heading: "Mechanics a pipeline depends on",
      items: [
        { icon: "Layers", title: "Qualification Flows", desc: "Structured first replies collect need, budget and timeline before a rep spends a call finding them out." },
        { icon: "Clock", title: "After-hours capture", desc: "Night and weekend enquiries are accepted, tagged and queued with a timer, not answered at 9am from memory." },
        { icon: "Search", title: "History before hello", desc: "The rep opens the thread with every past message, quote and note in view before typing the first word." },
        { icon: "Send", title: "Template re-open", desc: "When the 24-hour window closes, the composer forces an approved template instead of letting the send silently fail." },
        { icon: "Download", title: "CRM handoff", desc: "REST API and webhooks push stage changes and thread state into your CRM so the two records never disagree." },
      ],
    },
    faq: [
      {
        q: "What happens when a lead messages outside the 24-hour window?",
        a: "Free-form replies are only allowed while a customer has messaged you recently. Once the window closes, the composer blocks free text and routes you to an approved template — usually a utility or marketing category one depending on intent — so the re-open is compliant rather than hopeful.",
      },
      {
        q: "Will automated follow-ups annoy good leads?",
        a: "Three controls keep the cadence honest: frequency caps across all journeys, quiet hours, and an immediate exit the moment the lead replies or opts out. A journey that would send into a closed window waits for a human decision instead of firing anyway.",
      },
      {
        q: "How do we know which source produced the lead?",
        a: "The source is captured on the first contact — campaign, keyword, ad click or referring webhook — and carried through to analytics, so replies and stage conversions can be read per source rather than in aggregate.",
      },
      {
        q: "Can reps change stages freely, and can we control who sees deals?",
        a: "Stage changes are normal thread actions and are logged like any other. Visibility follows the same role model as the rest of the workspace: a rep sees their own threads, a manager sees the team's, and pipeline reports can be restricted per role and per branch.",
      },
    ],
  },

  {
    path: "/solutions/marketing-teams",
    section: "Solutions",
    renderer: "standard",
    meta: {
      title: "For Marketing Teams — Consent-Based WhatsApp Campaigns | Madhura",
      description:
        "Segment opted-in audiences, pace broadcasts against Meta limits, keep template categories clean and read delivery down to replies.",
    },
    hero: {
      badge: "Solutions · Marketing Teams",
      title: "Broadcasts that respect opt-ins and quality ratings.",
      subtitle:
        "WhatsApp punishes careless sending harder than it rewards good messaging: one blast to a stale list drags quality down for every campaign after it. MADHURA makes consent, category and pacing part of the send, so reach is something you keep rather than borrow.",
      points: [
        "Segments built from consent state, tags and activity windows",
        "Wave pacing with per-number throughput caps",
        "Template category rules enforced before submission",
        "Delivery funnel from sent to replied, per variant",
      ],
      primaryCta: { label: "Start free trial", to: "/signup" },
      secondaryCta: { label: "Book a demo", to: "/demo" },
    },
    stats: [
      { value: "0", label: "Sends to opted-out contacts", note: "suppression enforced at send time" },
      { value: "3", label: "Template categories", note: "utility, marketing, authentication" },
      { value: "24h", label: "Service window", note: "free-form replies only while open" },
      { value: "live", label: "Delivery funnel", note: "sent → delivered → read → replied" },
    ],
    overview: {
      heading: "Consent and pacing are the campaign",
      paragraphs: [
        "Reach on WhatsApp is a function of how you behave. Meta's quality rating and messaging limits react to velocity, user reports and opt-outs, and a number that degrades takes every future campaign down with it — which makes suppression and pacing creative decisions, not plumbing.",
        "Segments are explicit: you see who is included, who is excluded and why, before a single message leaves. Each send runs in waves against the number's current limit, and replies drop straight into the shared inbox, so a campaign ends where a human conversation starts.",
      ],
      bullets: [
        "Segment builder with live recipient counts and exclusion reasons",
        "Opt-out, blocklist and consent state checked at send time",
        "A/B variants on the first wave, winner sent to the remainder",
        "Category discipline: utility wording kept out of the marketing bucket",
        "Quality-rating pause with a remediation checklist instead of a silent drop",
        "Reply handoff to the inbox with campaign attribution attached",
      ],
    },
    features: [
      { icon: "Users", title: "Segment builder", desc: "Compose audiences from tags, custom fields, branch, last-activity window and opt-in state, with the excluded population and its reasons shown alongside." },
      { icon: "Send", title: "Wave scheduling", desc: "Split a send into waves with spacing, warm up new numbers gradually, and cap throughput per connected number so a launch never outruns the tier." },
      { icon: "ShieldCheck", title: "Consent enforcement", desc: "Opt-outs and blocklists are evaluated at send time, so a segment assembled yesterday cannot message someone who opted out this morning." },
      { icon: "Layers", title: "A/B variants", desc: "Test two bodies or headers on a slice of the audience, pick the winner on reply rate, and send it to everyone remaining." },
      { icon: "BarChart3", title: "Funnel analytics", desc: "Sent, delivered, read, replied and failed streaming as the campaign runs, with failures broken out by error code instead of a single red number." },
      { icon: "FileText", title: "Template discipline", desc: "Pre-flight flags marketing wording in a utility template and unresolved variables before submission, saving a wasted review cycle." },
    ],
    workflow: {
      heading: "How a campaign goes out",
      steps: [
        {
          title: "Build the segment",
          desc: "Pick filters, read the included and excluded counts, and confirm every recipient's opt-in state before the copy is even opened.",
        },
        {
          title: "Pick the message",
          desc: "Choose an approved template or free-form copy inside the window, personalise variables against real fields, and preview as the customer sees it.",
        },
        {
          title: "Schedule the waves",
          desc: "Set start time, wave size, spacing and per-number caps. The scheduler estimates completion and flags limit risk before you confirm.",
        },
        {
          title: "Read the result",
          desc: "Watch live telemetry, pause on an anomaly, export failures, and route replied contacts into the inbox with attribution intact.",
        },
      ],
    },
    capabilities: {
      heading: "Controls around every send",
      items: [
        { icon: "Clock", title: "Quiet hours", desc: "Respect recipient time zones and send windows so a campaign never lands at 3am in the name of conversion." },
        { icon: "Percent", title: "Offers and catalogue", desc: "Attach product cards, discount codes and tracked link buttons, with per-campaign parameters on every click." },
        { icon: "RefreshCw", title: "Recurring sends", desc: "Duplicate a campaign with its audience and schedule intact for weekly or monthly cadences." },
        { icon: "Lock", title: "Approval before send", desc: "Draft, review and approved states stop a junior operator from mailing the whole list unattended." },
        { icon: "Download", title: "Reporting out", desc: "Export results to CSV or push them to a webhook, so the weekly marketing review runs on your own numbers." },
      ],
    },
    faq: [
      {
        q: "What actually separates a utility template from a marketing one?",
        a: "Meta classifies by intent: a message that fulfils an existing customer action — an order, an appointment, a booking — is utility, while anything promotional is marketing and carries stricter consent expectations. Wording decides the classification, which is why pre-flight flags sales language sitting inside a utility draft before you submit it.",
      },
      {
        q: "How do we avoid damaging the number's quality rating?",
        a: "Send only to recent, opted-in segments; pace in waves under the number's current limit; and watch opt-out and report rates during the send. If quality degrades, the campaign pauses with the held waves preserved and a remediation checklist, so resume continues where it stopped.",
      },
      {
        q: "Can we prove who consented and who opted out?",
        a: "Opt-in state lives on the contact and is enforced at send time; opt-out is recorded the same way and applies to every campaign and journey from that moment. The send-time exclusion report shows who was dropped and why, which is what you reconstruct after the fact.",
      },
      {
        q: "Do A/B tests work on small lists?",
        a: "They work, but the honest constraint is sample size: a 500-contact audience split in half rarely gives a decisive read. The tool shows the split counts before sending, so you can decide whether to test this campaign or simply run the better version.",
      },
    ],
  },

  {
    path: "/solutions/customer-support",
    section: "Solutions",
    renderer: "standard",
    meta: {
      title: "For Customer Support — WhatsApp Queues, SLAs & Escalation | Madhura",
      description:
        "Queues, assignment, response timers and escalation for WhatsApp support, with after-hours snooze and templates once the 24-hour window closes.",
    },
    hero: {
      badge: "Solutions · Customer Support",
      title: "Support queues that never lose a thread.",
      subtitle:
        "Support on WhatsApp fails quietly: two agents answer the same question, a night-shift message is never opened again, and nobody can show when a complaint was first seen. MADHURA adds the mechanics of a helpdesk — queue, owner, timer, escalation, audit — on top of the channel.",
      points: [
        "Round-robin and skill-based assignment with collision detection",
        "First-response and resolution timers per queue",
        "Macros that reply, tag and close in one keystroke",
        "After-hours snooze that reopens at the next shift",
      ],
      primaryCta: { label: "Start free trial", to: "/signup" },
      secondaryCta: { label: "Book a demo", to: "/demo" },
    },
    stats: [
      { value: "24h", label: "Service window", note: "template required once it closes" },
      { value: "24/7", label: "Inbound intake", note: "messages accepted even off the clock" },
      { value: "1", label: "Thread per customer", note: "across agents, shifts and branches" },
      { value: "100%", label: "Actions in the audit trail", note: "reply, reassign, export, delete" },
    ],
    overview: {
      heading: "The helpdesk mechanics WhatsApp does not ship",
      paragraphs: [
        "WhatsApp delivers messages; it does not deliver ownership. Without an assignee, a timer and a record, support degrades into whoever glanced at the phone, and the customer experiences that as silence. This profile adds exactly those three things and nothing decorative.",
        "The 24-hour customer-service window shapes every decision: free-form replies are possible only while a customer has messaged recently, so queues are built to answer inside it and to switch to approved templates the moment it closes. Outside hours, threads snooze to a promised time instead of vanishing.",
      ],
      bullets: [
        "Queues by issue type, branch, language or plan tier",
        "Response countdowns with escalation to a supervisor on breach",
        "Internal notes and whisper mode for coaching mid-thread",
        "Macros: approved template plus tag plus state change in one action",
        "Snooze until a date, with automatic reopen when the customer replies",
        "Escalation to a human whenever the AI chatbot cannot answer safely",
      ],
    },
    features: [
      { icon: "Inbox", title: "Queues and ownership", desc: "Every thread sits in a queue with exactly one assignee, a status and a timer, so nothing depends on someone remembering." },
      { icon: "Clock", title: "Response timers", desc: "First-response and resolution targets per queue, visible countdowns, and escalation the moment a clock runs out." },
      { icon: "Users", title: "Collision detection", desc: "Presence indicators show who is viewing and typing, so two agents never send contradictory answers to one customer." },
      { icon: "MessageCircle", title: "Macros", desc: "One keystroke inserts the approved reply, applies the tag and moves the thread to the right state — consistent wording across shifts." },
      { icon: "GitBranch", title: "Escalation paths", desc: "Tier rules hand a thread to a senior or a supervisor with the transcript attached, instead of a forwarded screenshot." },
      { icon: "ShieldCheck", title: "Permission boundaries", desc: "Who may export, delete or reassign is decided per role and per branch, and every one of those actions is logged." },
    ],
    workflow: {
      heading: "How a ticket moves",
      steps: [
        {
          title: "Arrives",
          desc: "The inbound message opens or reopens a thread, matches the contact, and lands in the right queue with a timer already running.",
        },
        {
          title: "Owned",
          desc: "Routing rules pick an assignee by round-robin, skill or load; everyone else sees the thread is taken before they start typing.",
        },
        {
          title: "Answered",
          desc: "The agent replies free-form inside the window or via an approved template outside it, with an internal note for the next shift.",
        },
        {
          title: "Closed",
          desc: "Resolve, snooze to a promised date, or let an automatic reopen fire when the customer replies — all of it written to the trail.",
        },
      ],
    },
    capabilities: {
      heading: "What support teams lean on daily",
      items: [
        { icon: "Zap", title: "AI chatbot first line", desc: "Routine questions — order status, opening hours, how-to steps — are answered instantly, and anything uncertain is handed to a human with the transcript." },
        { icon: "Filter", title: "Saved views", desc: "Unassigned, breaching, waiting-on-customer, reopened: the views a shift lives in, shareable across the team." },
        { icon: "BarChart3", title: "SLA reporting", desc: "Median and p90 first response, attainment per queue, and the individual breaches listed rather than averaged away." },
        { icon: "Search", title: "History across shifts", desc: "Search message text, order numbers, tags and attachments so an agent never asks the customer to repeat themselves." },
        { icon: "Lock", title: "Out-of-hours rules", desc: "Decide who may message outside business hours and what the queue does with a thread that arrived at 02:00." },
      ],
    },
    faq: [
      {
        q: "How do we answer inside the 24-hour window across shifts?",
        a: "The timer runs from the customer's message, not from your roster, so a thread arriving at 23:00 is still inside the window at 09:00 — the queue just shows it as breaching first response. If the window is about to close, the agent sees it and can send an approved template once it has.",
      },
      {
        q: "Can the AI chatbot hand off without making things worse?",
        a: "The chatbot handles only the questions you have authorised, and any refusal, complaint or unknown intent routes to a human queue with the full transcript attached. Opt-out and suppression rules apply to the chatbot exactly as they do to campaigns, so automation cannot message someone who asked to stop.",
      },
      {
        q: "What stops two agents replying at once?",
        a: "Live presence shows who is viewing and typing in a thread, and assignment marks it as taken. If two replies still race, the customer sees a single continuous thread and the audit log shows who sent what — the mess is visible internally rather than hidden.",
      },
      {
        q: "Can we measure response time honestly?",
        a: "Yes: from the first inbound message of a conversation to the first human reply, excluding automated replies, with out-of-hours periods optionally ignored. The distribution is reported at median and p90 per queue and agent, so one slow thread cannot flatter or ruin a report.",
      },
    ],
  },
];

export const INDUSTRY_PAGES = [
  {
    path: "/industries",
    section: "Industries",
    renderer: "standard",
    meta: {
      title: "Industries — WhatsApp CRM Patterns by Vertical | Madhura",
      description:
        "Five verticals on WhatsApp: what each one sends, what each one must not send, and the MADHURA mechanics that change with the message.",
    },
    hero: {
      badge: "Industries",
      title: "The channel is the same, the patterns are not.",
      subtitle:
        "Every vertical runs the same primitives — consent, templates, windows, routing — but the message that must go out, the hour it must go out and the mistake that costs the most all differ. Each page below maps those constraints onto MADHURA.",
      points: [
        "Consent capture shaped by how each vertical actually sells",
        "Template categories matched to the message you really send",
        "Routing to the branch, campus or agent that owns the enquiry",
        "Quiet hours and caps tuned to what intrusive means here",
      ],
      primaryCta: { label: "Start free trial", to: "/signup" },
      secondaryCta: { label: "Book a demo", to: "/demo" },
    },
    stats: [
      { value: "5", label: "Verticals mapped", note: "same platform, different playbooks" },
      { value: "3", label: "Template categories", note: "utility, marketing, authentication" },
      { value: "24h", label: "Service window", note: "identical in every industry" },
      { value: "24/7", label: "Automations", note: "subject to quiet hours per vertical" },
    ],
    overview: {
      heading: "What actually changes between verticals",
      paragraphs: [
        "The differences are operational, not cosmetic. Retail re-opens abandoned carts; clinics confirm appointments and never market in the same breath; schools chase fees against a calendar; agencies must keep four clients' data from ever touching. Each constraint selects the trigger, the template category and the routing rule.",
        "This section names those constraints per vertical and shows the standard configuration that satisfies them. If your industry is not listed, the nearest pattern usually transfers — the mechanics are generic even when the wording and the compliance posture are not.",
      ],
      bullets: [
        "E-Commerce & Retail (/industries/ecommerce): cart recovery, order updates, delivery and returns.",
        "Healthcare (/industries/healthcare): reminders and administrative contact with consent on record.",
        "Education (/industries/education): admissions intake, fee reminders, campus announcements.",
        "Real Estate (/industries/real-estate): enquiry qualification, viewing schedules, listing alerts.",
        "Agencies (/industries/agencies): one tenant per client, approvals and client-scoped reporting.",
      ],
    },
    features: [
      { icon: "Send", title: "E-Commerce & Retail", desc: "Cart recovery and order updates as journeys, promotions as an opted-in segment. Full pattern at /industries/ecommerce." },
      { icon: "Clock", title: "Healthcare", desc: "Reminders and confirmations as utility templates, with consent and quiet hours enforced at send time. Pattern at /industries/healthcare." },
      { icon: "FileText", title: "Education", desc: "Admissions Flows, deadline cadences and campus-scoped parent announcements. Pattern at /industries/education." },
      { icon: "Building", title: "Real Estate", desc: "Qualification on first reply, routing by project, visit reminders until the tour. Pattern at /industries/real-estate." },
      { icon: "Users", title: "Agencies", desc: "One tenant per client with approval gates and reporting that never crosses accounts. Pattern at /industries/agencies." },
      { icon: "ShieldCheck", title: "Shared guardrails", desc: "Opt-out enforcement, category checks, frequency caps and audit apply identically in every vertical." },
    ],
    workflow: {
      heading: "Adapting the platform to a vertical",
      steps: [
        {
          title: "Name the critical message",
          desc: "Identify the one message whose absence costs the most — the reminder, the dispatch note, the payment chase — and build that journey first.",
        },
        {
          title: "Fix category and consent",
          desc: "Decide whether each send is utility or marketing, then confirm the consent path that supports it before a template is written.",
        },
        {
          title: "Set routing and hours",
          desc: "Map who owns which enquiry, in which branch, during which hours — and what the queue does outside them.",
        },
        {
          title: "Measure the matching funnel",
          desc: "Delivery is not the outcome: track replies, bookings, payments or visits — whichever number the vertical actually runs on.",
        },
      ],
    },
    capabilities: {
      heading: "Guardrails every vertical inherits",
      items: [
        { icon: "ShieldCheck", title: "Consent on record", desc: "Opt-in state is stored per contact and checked at send time; opt-out suppresses the contact across every channel you run." },
        { icon: "Filter", title: "Audience separation", desc: "Service audiences and promotional audiences are distinct segments, so a campaign cannot reach people who only ever agreed to reminders." },
        { icon: "Lock", title: "Scoping", desc: "Branch, campus or tenant boundaries decide who sees which conversations and reports, enforced by role rather than habit." },
        { icon: "Activity", title: "Quality monitoring", desc: "Template quality rating and opt-out trends are watched continuously, with warnings before a downgrade caps your reach." },
        { icon: "Download", title: "Reporting out", desc: "Any vertical funnel exports to CSV or a webhook, so the operations review runs on the same numbers the dashboard shows." },
      ],
    },
    faq: [
      {
        q: "Our industry is not listed — is it supported?",
        a: "The platform does not restrict by vertical. What differs per industry is the consent path, the template category and the routing rules, all of which you configure yourself. Bring the messages you must send and their timing, and the pattern above is adapted in a working session.",
      },
      {
        q: "Are templates pre-approved for our industry?",
        a: "No — templates are approved per message, not per industry. You author the wording, pre-flight catches the common rejection reasons, and Meta reviews the submission. Category (utility, marketing, authentication) and the landing domain behind any button are the two things that most often decide the outcome.",
      },
      {
        q: "Do we need a separate opt-in for each kind of message?",
        a: "Effectively yes. Service messages tied to an existing customer action ride on that relationship; promotional messages need their own clear opt-in, and every message must honour an opt-out wherever it was recorded. Keeping the two audiences as separate segments is how teams stay on the right side of that line.",
      },
      {
        q: "Can one workspace serve several brands or verticals?",
        a: "Yes. Branch scoping gives each brand, campus or client its own numbers, templates, queues and reports inside one tenant, and an agency running unrelated clients can instead use one tenant per client for hard isolation. Both models share the same permission and audit model.",
      },
    ],
  },

  {
    path: "/industries/ecommerce",
    section: "Industries",
    renderer: "standard",
    meta: {
      title: "E-Commerce & Retail — WhatsApp Cart Recovery & Order Updates | Madhura",
      description:
        "Recover carts, send utility order and delivery updates, handle returns in-thread and keep promotional broadcasts behind explicit opt-in.",
    },
    hero: {
      badge: "Industries · E-Commerce & Retail",
      title: "Recover carts and confirm orders on WhatsApp.",
      subtitle:
        "Retail conversations split into two kinds of message: service updates the customer expects, and promotions they must have opted into. MADHURA keeps them in separate template categories, triggers the service side from your store's events, and hands every reply to a human in the shared inbox.",
      points: [
        "Cart and checkout events trigger the journey, not a person",
        "Utility templates for order, shipping and delivery updates",
        "Marketing broadcasts gated on opt-in and suppression state",
        "Returns and order status answered in one thread",
      ],
      primaryCta: { label: "Start free trial", to: "/signup" },
      secondaryCta: { label: "Book a demo", to: "/demo" },
    },
    stats: [
      { value: "24/7", label: "Recovery journeys", note: "fired by your store's webhook" },
      { value: "0", label: "Promos to opted-out buyers", note: "suppression enforced at send time" },
      { value: "3", label: "Template categories in play", note: "utility for orders, marketing for offers" },
      { value: "1", label: "Thread per customer", note: "cart, order, delivery and returns" },
    ],
    overview: {
      heading: "Two sends, two rules",
      paragraphs: [
        "An order update and a discount blast use the same mechanism with opposite obligations. The update is expected — usually a utility template driven by a webhook from your store — while the blast needs a marketing opt-in, a suppression check and pacing that does not erode the number's quality rating.",
        "Between them sits the part retail actually bleeds: the shopper who added to cart and left. A journey waits, checks whether an order was completed in the meantime, sends a single reminder, then stops the moment a reply or a purchase arrives.",
      ],
      bullets: [
        "Triggers: cart abandoned, checkout started, order placed, shipped, delivered, return opened",
        "Utility templates for transactional updates with variables bound to order data",
        "Marketing segments from purchase windows, tags and explicit consent state",
        "In-thread return intake: order number, reason and photo captured as a reply or Flow",
        "Delivery failures routed to the support queue instead of retrying forever",
        "Attribution from the reply back to the campaign that produced the order",
      ],
    },
    features: [
      { icon: "Zap", title: "Store triggers", desc: "Cart, checkout, order and shipment events arrive by webhook and open or advance the journey — no nightly batch, no manual export." },
      { icon: "Send", title: "Transactional updates", desc: "Confirmed, dispatched, out for delivery, delivered: approved utility templates with real order variables, sent from the event itself." },
      { icon: "TrendingUp", title: "Recovery journeys", desc: "Wait, check whether the order completed, send one reminder, exit on reply or purchase — with frequency caps across all journeys." },
      { icon: "Filter", title: "Consent segments", desc: "Promotional audiences are built from explicit opt-in plus activity windows, with the excluded buyers and their reasons shown up front." },
      { icon: "Inbox", title: "Returns in the thread", desc: "Where-is-my-order and I-want-to-return replies land as owned threads with the order context attached, not as unknown enquiries." },
      { icon: "BarChart3", title: "Revenue attribution", desc: "Read replies, conversions and opt-outs per campaign and per wave, then export the join to your own analytics stack." },
    ],
    workflow: {
      heading: "How a cart comes back",
      steps: [
        {
          title: "Event lands",
          desc: "Your store's webhook identifies the shopper, updates the contact record and starts the recovery journey with a wait node.",
        },
        {
          title: "Conditions check",
          desc: "Did an order complete meanwhile? Is the contact opted in? Are quiet hours active? The journey branches before anything sends.",
        },
        {
          title: "Message goes",
          desc: "An approved template with the cart's real contents leaves in the current wave, paced alongside the rest of the day's sends.",
        },
        {
          title: "Reply is owned",
          desc: "The message opens a thread in the support queue, cancels the remaining journey steps for that contact and starts the clock.",
        },
      ],
    },
    capabilities: {
      heading: "Retail mechanics that pay for themselves",
      items: [
        { icon: "Layers", title: "Flows for intake", desc: "Size, pincode, preferred slot and return reason collected in a structured form instead of a message chain." },
        { icon: "Clock", title: "Delivery windows", desc: "Send windows and recipient time zones stop promotional traffic landing in the middle of the night." },
        { icon: "Percent", title: "Codes and catalogue", desc: "Product cards, discount codes and tracked buttons on every campaign, with click parameters carried into attribution." },
        { icon: "Search", title: "Order context in-thread", desc: "Search order numbers, tags and past messages so an agent answers Where is my order without asking twice." },
        { icon: "Download", title: "Campaign-to-order export", desc: "Push campaign results and reply outcomes to CSV or a webhook for the weekly trading review." },
      ],
    },
    faq: [
      {
        q: "Can we message someone who abandoned a cart but never bought?",
        a: "Not as marketing without an opt-in. The 24-hour window only opens when the customer messages you first, so growth teams capture consent at checkout, through a lead offer or via an on-site prompt — and a contact with unknown consent is treated as not opted in. Without consent, the recovery journey simply does not send.",
      },
      {
        q: "Do order and shipping updates need marketing opt-in?",
        a: "No — they belong to the utility category because they fulfil an existing order. They must stay transactional: the moment a dispatch note carries a discount code, Meta can reclassify it as marketing. Pre-flight flags promotional wording inside a utility draft before you submit it.",
      },
      {
        q: "What happens when a shopper replies STOP?",
        a: "The opt-out is written to the contact and enforced at send time by every campaign and journey from that moment on. They still receive transactional messages tied to their own order where appropriate, and the exclusion shows up in the send report with its reason.",
      },
      {
        q: "How do we avoid hammering one shopper across journeys?",
        a: "A global frequency cap counts sends across all automations, not per journey, so a recovery reminder and a promo broadcast cannot both land in the same window. Quiet hours apply on top, and any reply cancels the remaining steps for that contact.",
      },
    ],
  },

  {
    path: "/industries/healthcare",
    section: "Industries",
    renderer: "standard",
    meta: {
      title: "Healthcare — WhatsApp Reminders With Consent | Madhura",
      description:
        "Appointment reminders and administrative contact via utility templates, with consent on record, opt-out enforcement and role-scoped staff access.",
    },
    hero: {
      badge: "Industries · Healthcare",
      title: "Appointment reminders and confirmations, sent with consent.",
      subtitle:
        "Clinics lose time to no-shows and phone trees, not to a lack of channels. MADHURA runs the administrative side — reminders, confirmations, reschedules and follow-up notices — as utility templates with consent on record, while patient questions inside the 24-hour window go to a staffed queue.",
      points: [
        "Utility templates driven by your scheduling system",
        "Opt-in captured per patient before any promotional send",
        "Opt-out honoured across campaigns and journeys alike",
        "Role-scoped access so staff see only what their job needs",
      ],
      primaryCta: { label: "Start free trial", to: "/signup" },
      secondaryCta: { label: "Book a demo", to: "/demo" },
    },
    stats: [
      { value: "24h", label: "Service window", note: "questions answered in it, template after" },
      { value: "24/7", label: "Reminder scheduling", note: "quiet hours set per clinic" },
      { value: "0", label: "Marketing without opt-in", note: "enforced at send time" },
      { value: "100%", label: "Sends in the audit trail", note: "who, what, when, to whom" },
    ],
    overview: {
      heading: "Administrative messaging, deliberately bounded",
      paragraphs: [
        "Healthcare organisations usually draw a hard line: WhatsApp carries scheduling and administrative traffic, and the clinical record stays in the system of record. This configuration respects that line — the message says when to arrive and what to bring, not what the diagnosis is.",
        "Because reminders are repetitive and time-critical, they are template-driven and triggered by the calendar. Because marketing to patients is a different act entirely, promotional sends sit behind explicit opt-in in their own segments — so a campaign can never reach someone who only ever agreed to appointment reminders.",
      ],
      bullets: [
        "Scheduling webhooks trigger reminders, confirmations and reschedules",
        "Consent state stored on the contact and checked at send time",
        "Clinic-level business hours and quiet hours on every journey",
        "Roles: front desk sees bookings, managers see reports, access is explicit",
        "Reschedule and cancel handled as replies or Flows inside the thread",
        "Every outbound message written to the audit log for internal review",
      ],
    },
    features: [
      { icon: "Clock", title: "Reminder journeys", desc: "Triggered from your scheduling system: confirm on booking, remind before the visit, follow up if the slot was missed — each exiting when the patient replies." },
      { icon: "ShieldCheck", title: "Consent controls", desc: "Promotional segments require recorded opt-in; opt-out suppresses the contact immediately across campaigns and journeys, with exclusions logged." },
      { icon: "Layers", title: "Reschedule with Flows", desc: "Offer the available slots in a structured form so a reply becomes a confirmed new time instead of a message chain staff must decode." },
      { icon: "Lock", title: "Role-scoped access", desc: "Front desk, clinicians and management each see the queues and reports their role requires, with exports and deletions gated separately." },
      { icon: "Inbox", title: "One queue for questions", desc: "Patient replies land as owned threads with the appointment context attached, timer running, and escalation when the queue breaches." },
    ],
    workflow: {
      heading: "How a reminder runs",
      steps: [
        {
          title: "The calendar fires",
          desc: "A booking, cancellation or follow-up event arrives by webhook and identifies the patient on the contact record.",
        },
        {
          title: "Consent and category check",
          desc: "The journey confirms the template is utility, the contact is not suppressed, and the send falls inside the allowed window.",
        },
        {
          title: "Message leaves in its window",
          desc: "The reminder sends with real date, time and location variables, paced with the clinic's other sends for that period.",
        },
        {
          title: "The reply is owned",
          desc: "Confirm, cancel or reschedule becomes a thread in the right queue with a timer — and the next journey step adjusts to the answer.",
        },
      ],
    },
    capabilities: {
      heading: "Details that matter in a clinic",
      items: [
        { icon: "RefreshCw", title: "Reschedule loop", desc: "A cancellation re-enters the scheduler flow instead of silently freeing a slot nobody fills." },
        { icon: "MessageCircle", title: "Pre-visit notes", desc: "What to bring, where to park, how long it takes — sent as a template the day before, identical for every patient." },
        { icon: "Filter", title: "Department segments", desc: "Each department keeps its own queues, templates and hours inside one organisation-wide workspace." },
        { icon: "BarChart3", title: "Delivery reporting", desc: "Sent, delivered and failed per reminder run, so undeliverable numbers surface before the appointment day, not after." },
        { icon: "Search", title: "History per patient", desc: "Search across past reminders and replies from any device an authorised staff member uses." },
      ],
    },
    faq: [
      {
        q: "Should clinical details go over WhatsApp?",
        a: "Most organisations decide no, and configure this profile to match: messages stay administrative — time, location, preparation, status of a report being available — while clinical content stays in the medical record. The platform gives you audit and permissions; your content policy decides what is written, and the audit makes that policy reviewable.",
      },
      {
        q: "Do appointment reminders count as marketing?",
        a: "A reminder that fulfils an existing booking is utility. The same message with a promotion for a new service inside it is marketing and needs the corresponding opt-in. Category rules and pre-flight wording checks exist precisely to catch that drift before Meta reviews it.",
      },
      {
        q: "What if a patient opts out partway through a journey?",
        a: "The opt-out is written to the contact and enforced at the very next send, stopping the remaining steps of every journey. Where a patient asks to stop all messages, the contact is suppressed from every outbound send and the exclusion is recorded with its reason.",
      },
      {
        q: "Can departments have separate queues, hours and reports?",
        a: "Yes. Department or site scoping gives each unit its own queues, business hours and template library, while management reads consolidated reporting across the organisation. Permissions decide who crosses between units, and every cross-unit action is logged.",
      },
    ],
  },

  {
    path: "/industries/education",
    section: "Industries",
    renderer: "standard",
    meta: {
      title: "Education — WhatsApp Admissions & Fee Reminders | Madhura",
      description:
        "Admissions intake, deadline and fee reminders, and campus-scoped parent announcements with separate consent per audience.",
    },
    hero: {
      badge: "Industries · Education",
      title: "Admissions and fee follow-ups without the call center.",
      subtitle:
        "Enquiries arrive from prospectuses, posters and portal clicks at every hour, and fee deadlines arrive whether or not anyone chased them. MADHURA captures each enquiry as an owned lead, runs the reminder cadence as approved templates, and keeps parent announcements scoped to the campus that sent them.",
      points: [
        "Keyword and Flows intake for prospect enquiries, around the clock",
        "Deadline and fee reminders triggered by the calendar, not a to-do list",
        "Separate consent segments for applicants, students and parents",
        "Campus or department scoping for announcements and permissions",
      ],
      primaryCta: { label: "Start free trial", to: "/signup" },
      secondaryCta: { label: "Book a demo", to: "/demo" },
    },
    stats: [
      { value: "24/7", label: "Enquiry intake", note: "portals and QR codes never close" },
      { value: "24h", label: "Service window", note: "free-form counselling while active" },
      { value: "3", label: "Audience segments", note: "applicants, enrolled, parents — separate consent" },
      { value: "0", label: "Deadline chases by hand", note: "the calendar triggers the journey" },
    ],
    overview: {
      heading: "An admissions cycle is a workflow, not a season",
      paragraphs: [
        "Admissions runs on hard dates — application close, entrance test, counselling, fee payment — each needing the same message to hundreds of people who each need it at a slightly different moment. Doing that by hand produces the two classic failures: the wrong deadline in a broadcast, and nobody following up on the interested one.",
        "Modelled as journeys, every stage triggers from the record: an enquiry opens a qualification Flow, a submitted application schedules the next reminder, a cleared fee ends the cadence. Parent announcements stay a separate, campus-scoped audience with their own consent, so a new-course promotion never reaches a family that only agreed to fee notices.",
      ],
      bullets: [
        "Flows collect course, intake, mode of study and contact permission on first reply",
        "Cadence journeys per stage: enquiry, application, test, counselling, payment",
        "Utility templates for deadlines and receipts; marketing templates for new courses",
        "Campus, department or programme scoping on queues, templates and reports",
        "Status questions answered from the thread with search across the full history",
        "Opt-out honoured across every audience, with exclusions logged at send time",
      ],
    },
    features: [
      { icon: "FileText", title: "Enquiry intake", desc: "Keywords, brochure links and QR codes open an enquiry with the source attached, then hand a structured Flow for course and intake details." },
      { icon: "Zap", title: "Deadline journeys", desc: "Each stage of the calendar triggers its own reminder run, with the queue adjusting automatically when the candidate replies or applies." },
      { icon: "Layers", title: "Application Flows", desc: "Collect documents, preferences and slot bookings in forms inside the thread, so incomplete applications are visible rather than assumed." },
      { icon: "Users", title: "Audience separation", desc: "Applicants, enrolled students and parents are distinct segments with distinct consent, so campaigns cannot bleed across them." },
      { icon: "Building", title: "Campus scoping", desc: "Each campus or department owns its numbers, queues and announcements, and staff permissions stop one unit messaging another's audience." },
      { icon: "BarChart3", title: "Funnel reporting", desc: "Enquiries opened, replies, applications submitted and reminders delivered — read per source, per programme and per campus." },
    ],
    workflow: {
      heading: "How an enquiry becomes enrolment",
      steps: [
        {
          title: "Capture",
          desc: "A prospect replies to a keyword or scans a poster code; the contact opens with its source and the qualification Flow starts.",
        },
        {
          title: "Qualify",
          desc: "Course, intake, mode of study and contact permission are collected in one structured reply before a counsellor is involved.",
        },
        {
          title: "Remind",
          desc: "The stage calendar drives deadlines, tests, counselling slots and fee dates — each exiting the moment the candidate acts.",
        },
        {
          title: "Hand over",
          desc: "A warm applicant becomes an owned thread for the counsellor, with the whole Flow history visible before the first call.",
        },
      ],
    },
    capabilities: {
      heading: "Mechanics an academic calendar needs",
      items: [
        { icon: "RefreshCw", title: "Recurring runs", desc: "Duplicate a deadline campaign with its audience and schedule intact for the next intake or term." },
        { icon: "MessageCircle", title: "Parent announcements", desc: "Campus-wide notices go to the consented parent segment, scheduled inside quiet hours for each region." },
        { icon: "ShieldCheck", title: "Consent per audience", desc: "Opt-in recorded per segment and checked at send time, so a fee-reminder agreement never becomes a marketing permission." },
        { icon: "Search", title: "One history per applicant", desc: "Every enquiry, document request and reply in a single thread, searchable after the cycle ends." },
        { icon: "Download", title: "Roster exports", desc: "Export the cycle's funnel and contact state to CSV or a webhook for the admissions review." },
      ],
    },
    faq: [
      {
        q: "Can we message parents who never opted in?",
        a: "Only within the bounds of the relationship and the category. Administrative messages tied to the child's enrolment are service traffic; promotional messages about new courses need their own opt-in, and an opt-out is honoured everywhere. Keeping the audiences as separate segments is what makes that distinction enforceable rather than aspirational.",
      },
      {
        q: "What happens when someone replies with a question at midnight?",
        a: "The thread opens in the right queue with a timer running and an auto-greeting that sets the expectation. Inside the 24-hour window your team answers free-form at shift start; if the window closes first, the reply must go out as an approved template — the composer enforces that rather than letting the send fail.",
      },
      {
        q: "How do we stop campuses messaging each other's audiences?",
        a: "Scoping plus roles. Each campus owns its own numbers, queues, templates and segments, and staff permissions decide who may send to which audience or read which queue. Any cross-unit send or export is a granted permission, and it is written to the audit log when it happens.",
      },
      {
        q: "Can we import the enquiry lists we already have?",
        a: "Yes — CSV upload or a CRM sync, with custom fields for course, intake and source. Consent state should be imported alongside; where it is missing, the contact is treated as not opted in for marketing, which is the conservative default you can correct once consent is re-confirmed.",
      },
    ],
  },

  {
    path: "/industries/real-estate",
    section: "Industries",
    renderer: "standard",
    meta: {
      title: "Real Estate — WhatsApp Lead Qualification & Site Visits | Madhura",
      description:
        "Capture portal and signage enquiries, qualify with Flows, route to the project's branch and keep site visits scheduled with reminders.",
    },
    hero: {
      badge: "Industries · Real Estate",
      title: "Qualify property leads before an agent calls.",
      subtitle:
        "A listing generates the same four questions from every buyer — budget, location, possession, configuration — and agents lose evenings answering them one at a time. MADHURA collects those answers in the first reply, routes the enquiry to the branch that holds the project, and keeps the visit scheduled.",
      points: [
        "Listing keywords and QR clicks open a qualified enquiry",
        "Flows capture budget, location and timeline before a call",
        "Routing by project, locality or on-call agent availability",
        "Visit reminders and cadence until the site tour happens",
      ],
      primaryCta: { label: "Start free trial", to: "/signup" },
      secondaryCta: { label: "Book a demo", to: "/demo" },
    },
    stats: [
      { value: "24/7", label: "Enquiry intake", note: "portal and signage clicks included" },
      { value: "<1s", label: "Rule-based routing", note: "runs on the inbound webhook" },
      { value: "24h", label: "Service window", note: "template needed once it closes" },
      { value: "1", label: "Thread per enquiry", note: "across agents and site offices" },
    ],
    overview: {
      heading: "Speed and context, in that order",
      paragraphs: [
        "Portal leads decay in minutes, and the broker who answers first usually keeps the conversation — but answering first with nothing in hand wastes the advantage on small talk. The first reply should do two jobs at once: acknowledge the enquiry and collect the answers the agent actually needs.",
        "Once qualified, the enquiry becomes an owned thread with a project, a budget band and a next action attached. Journeys then handle the part agents drop — the second visit reminder, the price sheet nobody sent, the day-ten check-in — each stopping the moment the buyer replies, books or opts out.",
      ],
      bullets: [
        "Triggers: portal lead webhook, project keyword, brochure click, gate QR code",
        "Flows to collect budget, locality, configuration, timeline and contact consent",
        "Routing rules by project, city, language or on-call agent",
        "Viewing scheduling with confirmation and day-before reminders",
        "Listing alerts as an opted-in marketing segment, per project",
        "Follow-up cadence that ends on reply, booking or opt-out",
      ],
    },
    features: [
      { icon: "Filter", title: "Qualification Flows", desc: "Budget, configuration, locality and possession window collected in a structured first reply, before an agent picks up the phone." },
      { icon: "GitBranch", title: "Project routing", desc: "The keyword or portal source decides the branch and the agent, so a golf-course enquiry never lands with the city-centre team." },
      { icon: "Clock", title: "Visit reminders", desc: "Confirmation on booking, a reminder the day before, and a follow-up if the tour did not happen — each triggered from the thread state." },
      { icon: "Send", title: "Listing alerts", desc: "New inventory and price-sheet drops go to an opted-in segment per project, paced and suppressed like any other campaign." },
      { icon: "Users", title: "Agent handover", desc: "Reassign a live enquiry with its whole history when a site visit needs a different broker, and log who handed what to whom." },
      { icon: "BarChart3", title: "Source attribution", desc: "Replies, visits and reservations read back to the portal, campaign or QR code that produced them, per project and per agent." },
    ],
    workflow: {
      heading: "From portal click to site visit",
      steps: [
        {
          title: "Capture",
          desc: "A portal webhook, keyword or QR scan opens the contact with its source and project, and fires the qualification Flow immediately.",
        },
        {
          title: "Qualify",
          desc: "Budget, locality, configuration and timeline arrive as structured answers; missing fields trigger one polite follow-up, not five.",
        },
        {
          title: "Route",
          desc: "Rules pick the branch and the on-call agent, assign the thread, and notify them while everyone else sees it is taken.",
        },
        {
          title: "Visit",
          desc: "The viewing is booked in-thread, reminders run up to the day, and the cadence continues until the buyer books, opts out or says no.",
        },
      ],
    },
    capabilities: {
      heading: "What keeps a pipeline warm",
      items: [
        { icon: "Search", title: "Project context in-thread", desc: "Past enquiries, sent price sheets and visit history are visible before the agent types, even if another agent handled it." },
        { icon: "FileText", title: "Brochures and price sheets", desc: "Deliver as media in an approved template outside the window, with tracked buttons showing who actually opened it." },
        { icon: "ShieldCheck", title: "Alert opt-in", desc: "Listing alerts are a marketing segment with recorded consent; an opt-out suppresses the buyer across every project." },
        { icon: "Terminal", title: "Portal webhooks", desc: "Where a portal or your CRM exposes an endpoint, leads enter the queue directly instead of arriving as an email someone must forward." },
        { icon: "Lock", title: "Site-office scoping", desc: "Each site or project keeps its own queues, hours and reporting, and permissions decide who may read across projects." },
      ],
    },
    faq: [
      {
        q: "Do portal leads arrive automatically?",
        a: "Where the portal or your CRM exposes a webhook or API, yes — the lead opens the contact and the thread directly, and the routing rules run on arrival. Where it only emails, the fallback is keyword or manual entry, which is slower but still lands in the same owned queue.",
      },
      {
        q: "Can we send price sheets to everyone who asked?",
        a: "Inside the 24-hour window you can reply free-form with what they requested. Outside it, price sheets and updates go as approved templates; anything promotional — a new project launch, a limited offer — needs to be in an opted-in marketing segment, because that is a different message under Meta's categories.",
      },
      {
        q: "Several agents work one project. How do we avoid double-calling?",
        a: "Assignment marks the thread as taken and presence shows who is typing, so a second agent sees the enquiry is handled before dialling. Reassignment between site offices carries the full history, so the buyer never repeats themselves to the next broker.",
      },
      {
        q: "What happens when a buyer replies STOP?",
        a: "The opt-out is written to the contact and enforced at send time by every campaign and journey that follows — including other projects' alerts if they opted out globally. The exclusion is recorded with its reason, so the send report explains the final recipient count.",
      },
    ],
  },

  {
    path: "/industries/agencies",
    section: "Industries",
    renderer: "standard",
    meta: {
      title: "Agencies — Multi-Tenant WhatsApp Client Management | Madhura",
      description:
        "Run every client's WhatsApp account from one workspace: tenant isolation, approval gates, scoped roles and client-ready reporting.",
    },
    hero: {
      badge: "Industries · Agencies",
      title: "Run every client's WhatsApp from one login.",
      subtitle:
        "Agency work on WhatsApp usually means five browser profiles, five numbers on five desks and a monthly screenshot report. MADHURA gives each client a tenant — its own numbers, templates, contacts and permissions — while your team moves between them without changing tools.",
      points: [
        "One tenant per client; contacts and templates never cross",
        "Client-scoped roles: your staff, their staff, their approvers",
        "Draft, review, approve before anything sends under a client name",
        "Client-ready reporting instead of monthly screenshots",
      ],
      primaryCta: { label: "Start free trial", to: "/signup" },
      secondaryCta: { label: "Book a demo", to: "/demo" },
    },
    stats: [
      { value: "1", label: "Tenant per client", note: "numbers, templates and contacts scoped" },
      { value: "3", label: "Approval states", note: "draft, review, approved before send" },
      { value: "0", label: "Cross-tenant access", note: "enforced by role, not by convention" },
      { value: "24/7", label: "Client dashboards", note: "live instead of a monthly export" },
    ],
    overview: {
      heading: "Isolation is the product",
      paragraphs: [
        "Everything that goes wrong in agency messaging is a boundary problem: the wrong list on the wrong client, an intern holding keys to four accounts, a report that quotes two tenants glued together. A tenant model removes the ambiguity — data does not cross, and roles decide whether someone may even see that another client exists.",
        "On top of isolation sits the workflow account leads actually need: draft a campaign, route it to the client's approver, hold it until approved, then send under the client's number with that client's templates and pacing. Reporting is generated per tenant, so a deck is an export rather than an afternoon.",
      ],
      bullets: [
        "Tenant isolation for contacts, threads, templates, campaigns and reports",
        "Roles per tenant: agency admin, agency operator, client viewer, client approver",
        "Approval gates so nothing sends under a client name before sign-off",
        "Per-client template libraries with their own quality tracking",
        "Move between tenants without re-authenticating or losing your place",
        "Seats, volume and retention are plan-dependent and shown in the workspace",
      ],
    },
    features: [
      { icon: "Layers", title: "Tenant isolation", desc: "Contacts, threads, templates, campaigns and reports live inside one tenant and are never visible from another — by construction, not by habit." },
      { icon: "Lock", title: "Roles per tenant", desc: "Give your operators access to four clients, an approver access to one, and a client stakeholder read-only reporting on their own account." },
      { icon: "CheckCircle2", title: "Approval gates", desc: "A campaign leaves the operator as a draft, waits in review, and sends only after the named approver signs — with the state change logged." },
      { icon: "Send", title: "Execution under the client's number", desc: "Wave pacing, suppression and category checks run per client number, so one client's send cannot degrade another's quality rating." },
      { icon: "BarChart3", title: "Client reporting", desc: "Per-tenant funnels, response times and opt-out trends, exported on a schedule so reporting stops being a monthly assembly job." },
      { icon: "Building", title: "Onboarding and offboarding", desc: "Stand up a tenant with its own numbers and templates, and close one with a scoped export and deletion that leaves other tenants untouched." },
    ],
    workflow: {
      heading: "How a client campaign runs",
      steps: [
        {
          title: "Draft",
          desc: "The operator builds the segment and message inside that client's tenant, using the client's templates and branding assumptions.",
        },
        {
          title: "Approve",
          desc: "The campaign moves to review; the client's approver sees the audience count, the copy and the send window before signing.",
        },
        {
          title: "Send",
          desc: "On approval the waves run against that client's number and limits, with suppression and quality guardrails applied as usual.",
        },
        {
          title: "Report",
          desc: "Results land in the tenant's dashboard and export, so the account review quotes that client's numbers alone.",
        },
      ],
    },
    capabilities: {
      heading: "The agency operating layer",
      items: [
        { icon: "Search", title: "Scoped search", desc: "Search runs inside the tenant you are in, so a hurried query cannot surface another client's conversation." },
        { icon: "Activity", title: "Quality per number", desc: "Each client's template quality and opt-out trends are tracked separately, and a downgrade is visible before the next campaign." },
        { icon: "Download", title: "Scheduled exports", desc: "Client reports arrive as CSV or webhook payloads on your timetable, ready for the deck without reformatting." },
        { icon: "Clock", title: "Client business hours", desc: "Each tenant keeps its own hours and quiet hours, so a campaign for one market never fires while that market sleeps." },
        { icon: "ShieldCheck", title: "Audit per tenant", desc: "Who drafted, who approved, who sent — recorded inside the tenant, which is what an offboarding conversation runs on." },
      ],
    },
    faq: [
      {
        q: "Can a client see our other clients?",
        a: "No. A role granted inside one tenant has no visibility into any other — not the contacts, not the campaigns, not the reports, and by default not even the list of other tenants. Cross-tenant visibility only exists if you deliberately grant it, which is rarely what an agency wants.",
      },
      {
        q: "Who owns the templates and contact data?",
        a: "They live inside that client's tenant and can be exported on request, which matters at offboarding: the client leaves with their contacts, templates and history, and deletion follows the retention configuration for that tenant only. Retention length is plan-dependent, so confirm it during onboarding.",
      },
      {
        q: "How do approvals behave when a client is slow?",
        a: "The campaign simply stays in review — it does not send, and it does not disappear. A held campaign keeps its scheduled window until it is approved or cancelled, and the state history shows who was asked and when, which is usually the answer the account lead needs in the status call.",
      },
      {
        q: "Is pricing per client or per team?",
        a: "It is plan-dependent: seats, tenant counts and messaging volume are packaged by plan rather than quoted as fixed numbers here. Bring the number of clients, the staff who will touch them and expected volume to the demo, and the current packaging is mapped against it.",
      },
    ],
  },
];
