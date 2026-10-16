/* Additional product pages — contact profiles, flow builder, AI chatbot, CRM and
   multi-branch management. Same entry shape as product.js: path / section /
   renderer / meta / hero / stats / overview / features / workflow /
   capabilities / faq / cta / related. meta, cta and related defaults are
   filled in by content/index.js.
   Icons must come from the iconMap set.
   --------------------------------------------------------------------------------- */

export const PRODUCT_EXTRA_PAGES = {
  "/product/contacts": {
    path: "/product/contacts",
    section: "Product",
    renderer: "standard",
    title: "Contact Management",
    description:
      "Unified WhatsApp contact profiles with tags, segments, unlimited custom fields, CSV and API import, conversation history, duplicate merging and consent tracking.",
    wordCount: 820,
    link: { label: "See pricing", to: "/pricing" },
    meta: {
      title: "Contact Management — Unified WhatsApp Profiles | Madhura",
      description:
        "One profile per contact on WhatsApp: tags and segments, unlimited custom fields, CSV and API import, conversation and order history, duplicate merging and consent tracking.",
    },
    hero: {
      badge: "Product · Contacts",
      title: "One profile per contact, not one spreadsheet row per conversation.",
      highlight: "One profile per contact",
      subtitle:
        "Your contact list is the substrate under every campaign, automation and reply. Madhura keeps a single, WhatsApp-first record per person — tagged, fielded, de-duplicated and consent-aware — so an audience you build today still resolves correctly tomorrow.",
      points: [
        "WhatsApp number as the identity key",
        "Tags, segments and unlimited custom fields",
        "CSV, API and webhook import with validation",
        "Consent status and source stored on every record",
      ],
      primaryCta: { label: "Start free trial", to: "/signup" },
      secondaryCta: { label: "Talk to sales", to: "/company/contact" },
    },
    stats: [
      { value: "1", label: "Unified profile", note: "per person, across agents and branches" },
      { value: "∞", label: "Custom fields", note: "text, number, date, dropdown, relation" },
      { value: "CSV + API", label: "Import paths", note: "validated before anything is created" },
      { value: "100%", label: "Consent tracked", note: "source and timestamp on every record" },
    ],
    overview: {
      heading: "The record your whole team messages from",
      paragraphs: [
        "A contact in Madhura is not a row in a list — it is the person on the other end of the WhatsApp thread. The phone number is the identity key, so whichever agent replies, whatever branch owns them and whichever template was used, every interaction attaches to the same profile.",
        "Everything else hangs off that record: tags and custom fields describe the person, conversation and order history explains where they have been, and consent state decides whether you may message them at all. Segments are saved queries over that record, reusable in campaigns, automations and suppression rules.",
      ],
      bullets: [
        "Normalised phone identity with country code, across every import source",
        "Tags for classification and saved segments with live recipient counts",
        "Unlimited custom fields — order ID, store, plan, renewal date, language",
        "Duplicate detection with a merge that keeps messages, tags and consent",
        "Opt-in source, timestamp and wording stored on the profile",
        "Owning branch and assigned agent visible on every record",
      ],
    },
    features: [
      {
        icon: "Users",
        title: "WhatsApp-first profiles",
        desc: "The number is the primary key: name, photo, language, timezone, agent, branch and last activity, alongside every thread they have ever had with you.",
      },
      {
        icon: "Filter",
        title: "Tags & segments",
        desc: "Combine tags, fields, activity windows and opt-in state into a saved segment with a live count — then reuse it in campaigns, automations and exclusions.",
      },
      {
        icon: "Sliders",
        title: "Custom fields",
        desc: "Add text, number, date, dropdown and linked-record fields without a developer. Every field is searchable, filterable and usable as a template variable.",
      },
      {
        icon: "Download",
        title: "Import & export",
        desc: "CSV import with column mapping, a dry-run preview and an error report; export any view as CSV or JSON, or keep records flowing through the REST API.",
      },
      {
        icon: "Layers",
        title: "Duplicate merging",
        desc: "Likely duplicates are flagged on normalised numbers and similar names. You choose which record wins, and messages, tags, custom values and consent from both are kept.",
      },
      {
        icon: "ShieldCheck",
        title: "Consent tracking",
        desc: "Opt-in source, timestamp and wording live on the profile, and suppression is enforced at send time across campaigns, automations and manual replies.",
      },
    ],
    workflow: {
      heading: "From a spreadsheet to a working audience",
      steps: [
        {
          title: "Import",
          desc: "Upload a CSV, map columns to fields and review the dry run: which rows will create, update or merge, and which will be rejected with the reason.",
        },
        {
          title: "Enrich",
          desc: "Backfill consent source, branch and lifecycle stage; custom fields fill in from your API as orders and events happen.",
        },
        {
          title: "Segment",
          desc: "Save a filter as a segment — active customers in Chennai with marketing consent — and watch the recipient count update live.",
        },
        {
          title: "Activate",
          desc: "Hand the segment to a campaign, an automation or an assignment rule, and reuse it whenever that audience needs reaching again.",
        },
      ],
    },
    capabilities: {
      heading: "Around the profile",
      items: [
        { icon: "Inbox", title: "Conversation history", desc: "Every thread, template and campaign reply in one timeline, with the agent's name on each turn." },
        { icon: "FileText", title: "Order & activity history", desc: "Order references, appointment dates, payment flags and notes recorded against the person, not the thread." },
        { icon: "Clock", title: "Lifecycle stages", desc: "New, active, at risk or churned — set by hand or by automation, and usable as a segment filter." },
        { icon: "Building", title: "Branch ownership", desc: "Give a contact an owning branch, or keep a shared directory where several branches see the same person." },
        { icon: "RefreshCw", title: "API & webhooks", desc: "Two-way sync with your systems: create and update records through the REST API and stream changes to your warehouse." },
      ],
    },
    faq: [
      {
        q: "How are contacts identified?",
        a: "Primarily by normalised WhatsApp number, with an optional external ID you supply through the API so your CRM key stays attached. Re-importing the same number updates the record rather than creating a second one.",
      },
      {
        q: "Is there a limit on custom fields?",
        a: "No. Paid plans include unlimited custom fields, all searchable and exportable, and the import mapper suggests a field type from your CSV column before you commit.",
      },
      {
        q: "What happens to duplicates on import?",
        a: "The dry run flags them before anything is written. You choose skip, update or merge per group, and a merge keeps messages, tags, custom values and consent from both records.",
      },
      {
        q: "Can I import contacts without consent evidence?",
        a: "Yes, but they land marked as consent-pending and are excluded from campaigns and automations until a source and timestamp are recorded against the profile.",
      },
    ],
    cta: {
      title: "Give your team the whole customer, not a phone number.",
      sub: "Import your list, map your fields and start segmenting this afternoon.",
      primary: { label: "Start free trial", to: "/signup" },
      secondary: { label: "See it in a demo", to: "/company/contact" },
    },
    related: ["/product/live-inbox", "/product/crm", "/features"],
  },

  "/product/flows": {
    path: "/product/flows",
    section: "Product",
    renderer: "standard",
    title: "Flow Builder",
    description:
      "Drag-and-drop flow builder for WhatsApp: 50+ triggers, conditions and actions with visual branching, dry-run testing and draft-to-publish versioning.",
    wordCount: 840,
    link: { label: "See pricing", to: "/pricing" },
    meta: {
      title: "Flow Builder — Visual WhatsApp Automation Flows | Madhura",
      description:
        "Build WhatsApp flows on a visual canvas: 50+ triggers, conditions and actions, visual branching, dry-run testing and versioned draft-to-publish releases.",
    },
    hero: {
      badge: "Product · Flows",
      title: "Build the logic once, then let the flow answer every time.",
      highlight: "Build the logic once",
      subtitle:
        "Flows is a visual canvas for WhatsApp logic: a trigger starts it, conditions route it, actions do the work. Draw the branch a customer should take, test it against real contacts, then publish — with every run recorded.",
      points: [
        "50+ triggers: message, keyword, form, hours, webhook",
        "Visual branching on any field, tag or message",
        "Actions: assign, tag, notify, send template, call API",
        "Draft → test → publish, with version history",
      ],
      primaryCta: { label: "Start free trial", to: "/signup" },
      secondaryCta: { label: "Design a flow", to: "/company/contact" },
    },
    stats: [
      { value: "50+", label: "Triggers", note: "message, keyword, form, schedule, webhook" },
      { value: "visual", label: "Branching", note: "conditions drawn on the canvas" },
      { value: "draft → publish", label: "Release flow", note: "version history and rollback" },
      { value: "100%", label: "Runs recorded", note: "path taken, node inputs, outcome" },
    ],
    overview: {
      heading: "Automation you can see end to end",
      paragraphs: [
        "Text-based automation tools hide the shape of what you built. On the canvas the whole journey is visible at once: where it starts, where it can branch, where it waits, and which node finally sends the message — so a supervisor can review a flow before it ever reaches a customer.",
        "Flows is deliberately narrow. It runs a defined path in response to an event: conditions read contact fields, tags and message content, waits hold until the right moment, and actions hand the thread to a person, notify your team or call your systems.",
      ],
      bullets: [
        "Triggers on inbound message, keyword, form submit, business hours and webhook",
        "Conditions on tags, fields, branch, language, order value and message text",
        "Wait nodes that hold until a time, a window or a maximum duration",
        "Actions: assign, tag, notify, send a template, update a field, call an API",
        "Dry-run mode that simulates the path with every send suppressed",
        "Version history with diff and rollback to any published version",
      ],
    },
    features: [
      {
        icon: "Zap",
        title: "Drag-and-drop builder",
        desc: "Triggers, conditions, waits and actions drop onto the canvas and connect by drawing; invalid connections are rejected as you draw them.",
      },
      {
        icon: "GitBranch",
        title: "Visual branching",
        desc: "Split the path on any condition and label each branch, so the logic reads like a decision tree instead of a configuration file.",
      },
      {
        icon: "Sliders",
        title: "50+ triggers",
        desc: "Message received, keyword match, form submitted, inside or outside business hours, contact created, tag added, schedule and inbound webhook.",
      },
      {
        icon: "Search",
        title: "Dry-run testing",
        desc: "Run any flow against chosen contacts with sends suppressed, and inspect each node's input, output and branch decision before publishing.",
      },
      {
        icon: "Layers",
        title: "Versioning",
        desc: "Every save is a draft; publishing creates an immutable version you can diff and roll back, while in-flight runs finish on the version they started with.",
      },
      {
        icon: "ShieldCheck",
        title: "Guardrails",
        desc: "Opt-out, blocklist and per-contact frequency caps apply to every automated send, so a flow can never message someone who should not be messaged.",
      },
    ],
    workflow: {
      heading: "Draft to publish in four moves",
      steps: [
        {
          title: "Start from a trigger",
          desc: "Pick the event — an inbound keyword, a form submit, a webhook, a time window — and the canvas opens with that node in place.",
        },
        {
          title: "Draw the path",
          desc: "Add conditions and waits so the flow adapts to what the customer actually did, then attach the actions that discharge the obligation.",
        },
        {
          title: "Test it",
          desc: "Dry-run against sample contacts with sends suppressed, and inspect every node payload before a single real message goes out.",
        },
        {
          title: "Publish and watch",
          desc: "Publish the version, watch active-run counts, and open any run to see the exact path it took and why.",
        },
      ],
    },
    capabilities: {
      heading: "What flows are good for",
      items: [
        { icon: "MessageCircle", title: "Qualification", desc: "Ask the qualifying questions, branch on the answers, then hand a warm lead to the right queue." },
        { icon: "Clock", title: "Business-hours routing", desc: "Route differently inside and outside hours, and hold messages until the next window opens." },
        { icon: "Percent", title: "Payment follow-up", desc: "On a failed-payment webhook, re-issue the link on a cadence that stops the moment the invoice clears." },
        { icon: "Users", title: "Escalation", desc: "Move a stuck contact to a human with the context attached instead of leaving them in an automated loop." },
        { icon: "Activity", title: "Run inspector", desc: "Open any run to see the path taken, the payload at each node and the timestamps." },
      ],
    },
    faq: [
      {
        q: "How is Flows different from Automations?",
        a: "Flows is the visual builder where a path is drawn, tested and published. Automations is the engine and run history underneath it, where schedules and drip sequences are also configured. Both share the same primitives and the same run log.",
      },
      {
        q: "Can a flow call our own systems?",
        a: "Yes. Inbound webhooks trigger flows, and action nodes can call your API with signed payloads, retries and the response recorded on the run.",
      },
      {
        q: "What happens if a node fails mid-run?",
        a: "Failed actions retry with backoff, then hold the run and notify an owner instead of silently dropping the contact.",
      },
      {
        q: "Can I change a published flow?",
        a: "Edits happen in a draft. Publishing creates a new version, in-flight runs complete on the version they started with, and you can roll back to any earlier version at any time.",
      },
    ],
    cta: {
      title: "Draw the path once, not the follow-up every time.",
      sub: "Build your first flow on the canvas and publish it before your next stand-up.",
      primary: { label: "Start free trial", to: "/signup" },
      secondary: { label: "See it in a demo", to: "/company/contact" },
    },
    related: ["/product/flows", "/product/automations", "/product/ai-chatbot"],
  },

  "/product/ai-chatbot": {
    path: "/product/ai-chatbot",
    section: "Product",
    renderer: "standard",
    title: "AI Chatbot",
    description:
      "AI chatbot for WhatsApp: intent detection, knowledge-source answers with guardrails, human handoff with context, suggested replies and containment analytics.",
    wordCount: 830,
    link: { label: "See pricing", to: "/pricing" },
    meta: {
      title: "AI Chatbot for WhatsApp — Intent Detection & Human Handoff | Madhura",
      description:
        "An AI chatbot that answers from your knowledge sources, stays inside allowed topics, and hands the thread to a human agent with transcript, intent and collected fields attached.",
    },
    hero: {
      badge: "Product · AI Chatbot",
      title: "Resolve the routine, and hand over the rest with context.",
      highlight: "hand over the rest",
      subtitle:
        "The chatbot answers the questions your team answers ten times a day from the knowledge you give it, and passes anything it should not decide to a human agent — with the whole conversation attached, not a fresh start.",
      points: [
        "Intent detection on live WhatsApp conversations",
        "Guardrails: allowed topics and hard refusals",
        "Human handoff with transcript and fields",
        "Containment rate reported per topic",
      ],
      primaryCta: { label: "Start free trial", to: "/signup" },
      secondaryCta: { label: "See it in a demo", to: "/company/contact" },
    },
    stats: [
      { value: "24/7", label: "First-line coverage", note: "instant answers, any hour" },
      { value: "1", label: "Handoff with context", note: "transcript, intent and fields" },
      { value: "live", label: "Guardrails", note: "allowed topics and hard refusals" },
      { value: "weekly", label: "Containment reporting", note: "per topic and per intent" },
    ],
    overview: {
      heading: "Deflection that knows when to stop",
      paragraphs: [
        "Chatbots fail in two predictable ways: they answer things they should not, or they loop when a person is needed. This one is built around both limits — it answers only from the knowledge you give it, and it escalates the moment confidence or topic says it should.",
        "Handoff is the feature that matters. When the bot escalates, the agent receives the transcript, the detected intent, the fields collected so far and the contact's history, so the customer never repeats themselves and the agent starts mid-conversation rather than at zero.",
      ],
      bullets: [
        "Answers drawn from your documents, FAQs and saved replies",
        "Intent detection per message with confidence thresholds you set",
        "Allowed-topic guardrails and explicit refusals outside them",
        "Handoff carrying transcript, intent and collected fields",
        "Suggested replies for agents on threads the bot does not own",
        "Containment and escalation analytics grouped by topic",
      ],
    },
    features: [
      {
        icon: "MessageCircle",
        title: "Intent detection",
        desc: "Each inbound message is classified against the intents you define — order status, refunds, pricing, appointments — before a reply is composed.",
      },
      {
        icon: "Search",
        title: "Knowledge sources",
        desc: "Answers are drawn from your uploaded documents, FAQ entries and saved replies, with the source attached so an agent can verify in one click.",
      },
      {
        icon: "ShieldCheck",
        title: "Guardrails",
        desc: "Allowed topics and hard refusals bound the conversation: no invented pricing, no policy promises, no subjects you have not approved.",
      },
      {
        icon: "Users",
        title: "Human handoff",
        desc: "Escalate to the right queue with transcript, intent and fields attached — and the customer's next message lands with the agent, not back in the bot.",
      },
      {
        icon: "MessageSquare",
        title: "Agent suggestions",
        desc: "On human-owned threads the model drafts a suggested reply from the same knowledge sources; the agent sends, edits or ignores it.",
      },
      {
        icon: "BarChart3",
        title: "Containment analytics",
        desc: "See what the bot resolved on its own, what escalated and why — trended by topic so you know what to fix next.",
      },
    ],
    workflow: {
      heading: "How a conversation is resolved",
      steps: [
        {
          title: "Understand",
          desc: "The message is matched to a contact, then classified against your intents with a confidence score.",
        },
        {
          title: "Answer or ask",
          desc: "Inside an allowed topic the bot replies from a knowledge source; outside it, it asks a clarifying question or states its limits.",
        },
        {
          title: "Decide",
          desc: "Below your confidence threshold, or on a high-stakes intent such as a refund, the thread escalates automatically.",
        },
        {
          title: "Hand over",
          desc: "The agent receives transcript, intent and collected fields, continues in the same thread, and the outcome feeds reporting.",
        },
      ],
    },
    capabilities: {
      heading: "Control over the model's behaviour",
      items: [
        { icon: "Sliders", title: "Confidence thresholds", desc: "Set per intent where the bot answers alone and where it escalates, rather than one global switch." },
        { icon: "Lock", title: "Approved content only", desc: "Responses are limited to your knowledge sources; anything else becomes a refusal and a route to a human." },
        { icon: "Filter", title: "Business hours", desc: "Route escalations by queue and hours so a handoff lands where someone is actually working." },
        { icon: "Activity", title: "Run visibility", desc: "Every resolution is logged with the sources used and the path taken, like any other automated run." },
        { icon: "TrendingUp", title: "Deflection reporting", desc: "Track containment rate over time and the topics that drive escalation." },
      ],
    },
    faq: [
      {
        q: "What does the chatbot do when it does not know?",
        a: "It says so, offers the closest approved option or takes a message, and escalates. Replies are grounded in your knowledge sources, and out-of-topic questions hit a hard refusal rather than a guess.",
      },
      {
        q: "Can we control what it is allowed to discuss?",
        a: "Yes. Guardrails define allowed topics and explicitly blocked ones — pricing promises, legal advice, account changes — each with its own escalation rule.",
      },
      {
        q: "How does the handoff reach a human?",
        a: "The thread moves to the chosen queue with transcript, intent, confidence and collected fields attached. The agent continues the same conversation, so the customer never repeats themselves.",
      },
      {
        q: "How do we know it is working?",
        a: "Containment rate — the share of conversations resolved without a human — is reported per topic and trended, alongside escalation reasons and the questions that keep recurring.",
      },
    ],
    cta: {
      title: "Automate the tenth answer, not the first.",
      sub: "Point the chatbot at your knowledge, set the guardrails, and keep humans for what needs them.",
      primary: { label: "Start free trial", to: "/signup" },
      secondary: { label: "Talk to sales", to: "/company/contact" },
    },
    related: ["/product/automations", "/product/flows", "/pricing"],
  },

  "/product/crm": {
    path: "/product/crm",
    section: "Product",
    renderer: "standard",
    title: "WhatsApp CRM",
    description:
      "Deal pipeline built on WhatsApp conversations: stages, automatic activity logging, tasks and notes, pipeline reporting and two-way sync with your existing CRM.",
    wordCount: 840,
    link: { label: "See pricing", to: "/pricing" },
    meta: {
      title: "WhatsApp CRM — Deal Pipeline, Activities & Tasks | Madhura",
      description:
        "A deal pipeline that starts in the WhatsApp conversation: drag-and-drop stages, activities logged from threads, task reminders, notes, reporting and two-way CRM sync via API.",
    },
    hero: {
      badge: "Product · CRM",
      title: "A pipeline that starts in the conversation, not in a data-entry form.",
      highlight: "starts in the conversation",
      subtitle:
        "Deals, stages, activities and reminders attached to the WhatsApp thread that produced them. Your team stops copy-pasting between a chat app and a CRM, because here they are the same screen.",
      points: [
        "Drag-and-drop pipeline with your own stages",
        "Activities logged automatically from threads",
        "Task reminders and notes on every record",
        "Two-way sync with other CRMs via API",
      ],
      primaryCta: { label: "Start free trial", to: "/signup" },
      secondaryCta: { label: "Talk to sales", to: "/company/contact" },
    },
    stats: [
      { value: "1", label: "Screen for chat and deals", note: "thread and pipeline side by side" },
      { value: "auto", label: "Activity logging", note: "replies, notes and stage changes" },
      { value: "custom", label: "Pipeline stages", note: "per pipeline, drag to reorder" },
      { value: "2-way", label: "CRM sync", note: "REST API and webhooks" },
    ],
    overview: {
      heading: "The pipeline your team will actually keep updated",
      paragraphs: [
        "CRMs fail when logging becomes a separate job from working. In Madhura, moving a deal and replying to the customer are one interaction: the thread sits beside the board, and every reply, note and stage change writes itself into the activity history with an actor and a timestamp.",
        "Because the record is built from the conversation, the reporting survives contact with reality. You can see which stage deals stall in, what a stalled deal was actually waiting for, and which branch, agent or source moves deals forward.",
      ],
      bullets: [
        "Deal records linked to a contact and its WhatsApp thread",
        "Configurable stages with drag-and-drop movement and change reasons",
        "Automatic activity log: messages, notes, stage moves, assignments",
        "Tasks with due dates and reminders surfaced in the agent's workspace",
        "Internal notes visible to the team, never to the customer",
        "Pipeline reporting: velocity, stuck deals and win rate by branch",
      ],
    },
    features: [
      {
        icon: "TrendingUp",
        title: "Deal pipeline",
        desc: "Stages you define, with probabilities and expected values, on a board that mirrors how your team actually sells rather than a generic funnel.",
      },
      {
        icon: "RefreshCw",
        title: "Activity capture",
        desc: "Replies, template sends, notes, assignments and stage changes are written to the record automatically — you only add what only a human knows.",
      },
      {
        icon: "Clock",
        title: "Tasks & reminders",
        desc: "Follow-ups attached to the deal with due dates, owners and reminders that surface in the inbox before the promise is missed.",
      },
      {
        icon: "FileText",
        title: "Notes",
        desc: "Context for the next person — credit limits, objections, decision criteria — attached to the record, searchable and timestamped.",
      },
      {
        icon: "BarChart3",
        title: "Pipeline reporting",
        desc: "Conversion by stage, time in stage, stuck deals and win rate broken down by agent, branch, source or template.",
      },
      {
        icon: "GitBranch",
        title: "Sync with your systems",
        desc: "Two-way framing through the REST API and webhooks: push contacts and deals in, stream stage changes and activities out to the CRM you already run.",
      },
    ],
    workflow: {
      heading: "From first message to closed deal",
      steps: [
        {
          title: "Capture",
          desc: "An inbound message creates or matches a contact; a qualified conversation opens a deal in the right pipeline and stage.",
        },
        {
          title: "Work",
          desc: "Reply, note, task and stage move happen beside the thread, and each one lands in the activity history.",
        },
        {
          title: "Advance",
          desc: "Stages move on evidence — a quote sent, a payment received — with reasons recorded so the report explains itself.",
        },
        {
          title: "Review",
          desc: "The board and the reports show where deals stall, who owns them and what is due today.",
        },
      ],
    },
    capabilities: {
      heading: "Beyond the board",
      items: [
        { icon: "Inbox", title: "Thread-linked records", desc: "Every deal opens straight into its conversation, and every thread shows the deal it belongs to." },
        { icon: "Users", title: "Ownership & teams", desc: "Assign a deal to an agent, a queue or a branch, with permissions that follow your roles." },
        { icon: "Filter", title: "Saved views", desc: "Closing this week, stalled over 14 days, no activity — save any filter as a view and share it with the team." },
        { icon: "Download", title: "Export", desc: "CSV and JSON exports of deals and activities, or a scheduled webhook into your warehouse." },
        { icon: "Lock", title: "Permissions", desc: "Control who can edit stages, see deal values or export the pipeline — per role and per branch." },
      ],
    },
    faq: [
      {
        q: "Is this a replacement for our existing CRM?",
        a: "It can be, for teams that sell on WhatsApp. Where you already have a system of record, contacts, deals and activities sync both ways through the REST API and webhooks so your CRM stays authoritative.",
      },
      {
        q: "Are activities really logged automatically?",
        a: "Yes. Inbound and outbound messages, template sends, assignments, notes and stage changes are written to the activity history with actor and timestamp. Your team records only what the conversation cannot tell you.",
      },
      {
        q: "Can different branches run different pipelines?",
        a: "Yes. Each branch can have its own stages and its own board while leadership sees one consolidated view across all of them.",
      },
      {
        q: "How do reminders reach agents?",
        a: "Tasks appear in the agent's workspace with their due dates and are highlighted in the thread the moment they fall due, so a follow-up never lives only in someone's memory.",
      },
    ],
    cta: {
      title: "Make the pipeline update itself.",
      sub: "Attach deals to the conversations that create them and let the activity log do the admin.",
      primary: { label: "Start free trial", to: "/signup" },
      secondary: { label: "See it in a demo", to: "/company/contact" },
    },
    related: ["/product/live-inbox", "/product/multi-branch", "/features"],
  },

  "/product/multi-branch": {
    path: "/product/multi-branch",
    section: "Product",
    renderer: "standard",
    title: "Multi-Branch Management",
    description:
      "Run every branch as its own workspace: separate inboxes, teams, hours and templates, routing rules, shared or scoped contacts, branch reporting and consolidated billing.",
    wordCount: 850,
    link: { label: "See pricing", to: "/pricing" },
    meta: {
      title: "Multi-Branch Management — Separate WhatsApp Inboxes Per Branch | Madhura",
      description:
        "Separate inboxes, team members, business hours and templates per branch with routing rules, optional shared contact directory, branch-level reporting and one consolidated invoice.",
    },
    hero: {
      badge: "Product · Multi-Branch",
      title: "Every branch its own inbox, the whole company one login.",
      highlight: "one login",
      subtitle:
        "Run separate branches, brands or stores as their own workspaces inside one account: separate numbers, teams, hours and templates, with consolidated reporting and a single invoice at the top.",
      points: [
        "Separate inboxes, hours and templates per branch",
        "Shared contact directory — or branch-scoped",
        "Routing rules that send each contact to their branch",
        "Branch-level reporting on consolidated billing",
      ],
      primaryCta: { label: "Start free trial", to: "/signup" },
      secondaryCta: { label: "Talk to sales", to: "/company/contact" },
    },
    stats: [
      { value: "N", label: "Branches", note: "unlimited on enterprise plans" },
      { value: "each", label: "Own inbox, hours, templates", note: "per branch, one login" },
      { value: "1", label: "Consolidated invoice", note: "with per-branch usage breakdown" },
      { value: "live", label: "Branch reporting", note: "ranked on the same metrics" },
    ],
    overview: {
      heading: "Multi-location operations without multi-tool chaos",
      paragraphs: [
        "A company with twelve stores usually ends up with twelve phone numbers, twelve WhatsApp apps and no view of the whole. Madhura models each branch as its own workspace — its own inbox, team, hours and templates — under one account with one set of credentials.",
        "Consolidation happens where it should: leadership gets one reporting view across branches and one invoice, while a branch manager sees only their own queues, hours and performance. Routing decides which branch owns a conversation in the first place.",
      ],
      bullets: [
        "Branch workspaces with their own number, inbox, queues and permissions",
        "Per-branch business hours, greeting and after-hours behaviour",
        "Per-branch template libraries under central governance",
        "Shared or branch-scoped contact directory, chosen once per account",
        "Routing by location, keyword, language, field or round-robin",
        "Consolidated billing with a per-branch usage breakdown",
      ],
    },
    features: [
      {
        icon: "Building",
        title: "Branch workspaces",
        desc: "Each branch is a workspace with its own inbox, team members, roles and permissions, so a store team never sees another region's threads.",
      },
      {
        icon: "Clock",
        title: "Per-branch hours",
        desc: "Business hours, holidays and after-hours replies set per branch — queues close and reopen on each branch's own clock, not headquarters'.",
      },
      {
        icon: "FileText",
        title: "Template libraries",
        desc: "Templates organised per branch with central review, so local teams move fast without breaking the governance your brand depends on.",
      },
      {
        icon: "GitBranch",
        title: "Routing rules",
        desc: "Send a conversation to the right branch on location, keyword, language or a custom field, with round-robin inside a region.",
      },
      {
        icon: "BarChart3",
        title: "Branch reporting",
        desc: "Rank branches on the same normalised metrics — response time, resolution, delivery, opt-outs — with contact volume shown for context.",
      },
      {
        icon: "Layers",
        title: "Centralised billing",
        desc: "One invoice for the whole account with usage and seats broken out per branch, so internal cost allocation stops being a spreadsheet exercise.",
      },
    ],
    workflow: {
      heading: "Standing up a new branch",
      steps: [
        {
          title: "Create it",
          desc: "Add a workspace, connect its number, set its hours and pick its queues — templates and permissions inherit from the account defaults.",
        },
        {
          title: "Staff it",
          desc: "Invite agents and a branch manager, assign roles; branch members only see their own branch's threads.",
        },
        {
          title: "Route to it",
          desc: "Point the routing rules — by location, keyword or field — so new conversations land with the branch that owns them.",
        },
        {
          title: "Report on it",
          desc: "The branch appears in consolidated reporting and on the same invoice from its first message.",
        },
      ],
    },
    capabilities: {
      heading: "Governance across locations",
      items: [
        { icon: "Users", title: "Roles per branch", desc: "Branch managers administer their own team, while regional and headquarters roles see across branches." },
        { icon: "ShieldCheck", title: "Shared guardrails", desc: "Consent enforcement, frequency caps and acceptable-use rules apply identically at every branch." },
        { icon: "Inbox", title: "Shared directory", desc: "Opt in to one contact directory so a customer who visits two stores has one profile — or keep branches fully separate." },
        { icon: "Search", title: "Cross-branch search", desc: "For roles permitted to see it: search message text and contacts across branches from one box." },
        { icon: "Percent", title: "Usage allocation", desc: "Message volume and seats broken down per branch, ready for internal recharge." },
      ],
    },
    faq: [
      {
        q: "Does each branch need its own WhatsApp number?",
        a: "Most branch networks run one number per branch, though a single number can be shared with routing deciding which branch owns the conversation. Either way, threads stay inside the branch that owns them.",
      },
      {
        q: "Can customers be shared between branches?",
        a: "Yes. Choose a shared contact directory so someone who messages two stores has one profile with history from both, or keep directories branch-scoped for strict separation.",
      },
      {
        q: "How is billing handled across branches?",
        a: "One invoice covers the account, with usage and seats broken down per branch so you can recharge internally without reconstructing the numbers.",
      },
      {
        q: "Can a manager work across branches?",
        a: "Yes. Permissions are per branch by default, and a regional or headquarters role can be granted cross-branch visibility for reporting and search while branch-limited roles stay inside their own.",
      },
    ],
    cta: {
      title: "Run twelve locations like one company.",
      sub: "Give every branch its own inbox and hours, and keep one report and one invoice at the top.",
      primary: { label: "Start free trial", to: "/signup" },
      secondary: { label: "Talk to sales", to: "/company/contact" },
    },
    related: ["/product/live-inbox", "/product/crm", "/pricing"],
  },
};
