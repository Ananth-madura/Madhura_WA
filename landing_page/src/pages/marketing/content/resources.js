/* Resource centre: help, getting started, blog, tutorials, videos, case studies,
   FAQs and the comparison framework.
   Keep the shape stable: path / section / renderer / meta / hero / …
   Anything omitted is filled in by content/index.js (meta, cta, related). */

export const RESOURCE_PAGES = [
  /* ── Help ────────────────────────────────────────────────────────────────── */
  {
    path: "/help",
    section: "Resources",
    meta: {
      title: "Help Center — Answers by Topic | Madhura",
      description:
        "Find answers by topic — billing, inbox, templates, automations and analytics — then open a support ticket with the details that get it resolved.",
    },
    hero: {
      badge: "Resources · Help Center",
      title: "Search by topic before you open a ticket.",
      subtitle:
        "The help centre is indexed the way support triages issues: billing and plans, the shared inbox, templates and messaging policy, automations, and analytics. Each article names the screen and setting involved, so you can act on it without a call. When an answer is not written up, a ticket with the right four details gets a substantive reply.",
      points: [
        "Six topic areas, each with its own index",
        "Search matches the exact error text on screen",
        "Four details make a ticket answerable",
        "Status page and escalation path linked from every article",
      ],
      primaryCta: { label: "Start free trial", to: "/signup" },
      secondaryCta: { label: "Book a demo", to: "/demo" },
    },
    stats: [
      { value: "6", label: "Topic areas", note: "billing through analytics" },
      { value: "4", label: "Details per ticket", note: "workspace, number, time, screenshot" },
      { value: "1 day", label: "First reply target", note: "on new general enquiries" },
      { value: "24h", label: "Security acknowledgement", note: "reports to the security team" },
    ],
    overview: {
      heading: "How to find what you need",
      paragraphs: [
        "Support tickets fall into the same handful of shapes: something did not send, something did not deliver, a template was rejected, a number stopped responding, or a report does not match what an agent actually did. Each shape has a documented cause and a documented fix, so the help centre is indexed by the shape of the problem rather than by product area.",
        "Start with search. It matches article titles, headings and the rejection or error strings you see in the console, which is usually enough on its own. If search comes back empty, browse the six topic indexes — each one ends with the escalation path for that area, including when to skip the article and open a ticket.",
      ],
      bullets: [
        "Billing and plans: invoices, seats, plan changes, cancellation and plan-dependent limits",
        "Inbox: assignment rules, queues, snooze, collision detection and per-branch permissions",
        "Templates: categories, Meta approval, rejection reasons and quality rating",
        "Automations and analytics: triggers, journey steps, filters and report definitions",
        "Search with the exact wording from the console — rejection reasons are indexed verbatim",
        "Every article names when to escalate instead of reading further",
      ],
    },
    features: [
      {
        icon: "Search",
        title: "Search the wording you see",
        desc: "Paste the status, error or rejection text from the screen. Articles carry those strings verbatim, so you do not have to guess what we called it.",
      },
      {
        icon: "Layers",
        title: "Six topic indexes",
        desc: "Billing, inbox, templates, automations, analytics and account access — each index lists articles in the order operators hit them.",
      },
      {
        icon: "Activity",
        title: "Check status first",
        desc: "If delivery is degraded, no article will help. The status page is linked from the help navigation, and incident notes live there.",
      },
      {
        icon: "FileText",
        title: "A ticket that gets answered",
        desc: "Workspace ID, the number involved, the time it happened and a screenshot. Those four details remove two round trips from most resolutions.",
      },
      {
        icon: "Send",
        title: "Escalation by severity",
        desc: "Live delivery stops, broken webhooks and suspected account compromise skip the queue; cosmetic and how-to questions do not.",
      },
    ],
    workflow: {
      heading: "Before you open a ticket",
      steps: [
        {
          title: "Search the exact message",
          desc: "Copy the status or rejection text from the console and search it — most template and delivery questions are already written up.",
        },
        {
          title: "Check the status page",
          desc: "Rule out a platform or Meta-side incident before you diagnose your own configuration; incident notes are posted there.",
        },
        {
          title: "Gather the four details",
          desc: "Workspace ID, the number involved, the timestamp in your time zone, and a screenshot of what you saw.",
        },
        {
          title: "Open with a severity",
          desc: "Say what stopped working and who is affected. Anything blocking live sends is flagged for the on-call engineer.",
        },
      ],
    },
    capabilities: {
      heading: "Where each kind of question belongs",
      items: [
        { icon: "Percent", title: "Billing and plan limits", desc: "Seats, usage and add-ons are plan-dependent; the pricing page shows the tiers and the help centre explains the invoice." },
        { icon: "ShieldCheck", title: "Messaging policy", desc: "Opt-in, opt-out, template categories and quality rating questions route to the policy articles, not to a support workaround." },
        { icon: "Terminal", title: "API and webhook questions", desc: "Endpoints, payloads and retry behaviour are documented in the docs rather than in help articles, with samples you can run." },
        { icon: "Lock", title: "Security and privacy", desc: "Vulnerability reports go to security@madhuratech.com; data requests and DPA questions are answered from the trust and legal pages." },
      ],
    },
    faq: [
      {
        q: "How do I contact support?",
        a: "Open a ticket from the support page, or email support@madhuratech.com from an address that belongs to the workspace. Sales and pricing go to the sales inbox, security reports to the security inbox — using the right one is the fastest way to get a real reply.",
      },
      {
        q: "What should a ticket include?",
        a: "Workspace ID, the WhatsApp number involved, the time it happened with your time zone, and a screenshot of the screen or error text. If it affects sending, add roughly how many conversations are blocked and since when.",
      },
      {
        q: "Where do billing and plan questions live?",
        a: "In the billing and plans topic: invoices, seat changes, plan upgrades, cancellation and what is included at each tier. Plan-dependent limits are stated on the pricing page, so check the tier before opening a ticket about a limit.",
      },
      {
        q: "Is there a status page?",
        a: "Yes — /status shows component health, scheduled maintenance windows and incident history. Check it before diagnosing a delivery problem, because it separates a platform incident from something in your own configuration.",
      },
    ],
  },

  /* ── Getting started ─────────────────────────────────────────────────────── */
  {
    path: "/getting-started",
    section: "Resources",
    meta: {
      title: "Getting Started — First-Day Checklist | Madhura",
      description:
        "The first-day checklist for a new workspace: connect a number, verify the business, import contacts, build a template, send and invite the team.",
    },
    hero: {
      badge: "Resources · Getting Started",
      title: "Six steps from a number to your first campaign.",
      subtitle:
        "This is the sequence we run with new workspaces on day one, because most first-week problems are ordering problems. Each step states what has to be true before the next one starts, and none of them require code. A workspace admin with access to your Meta Business account and a contact export can complete the list in a day.",
      points: [
        "Connect and verify the number you already own",
        "Import contacts with tags and opt-in records kept",
        "Draft templates and read Meta's decision with its reason",
        "Send to a small segment, then invite the team",
      ],
      primaryCta: { label: "Start free trial", to: "/signup" },
      secondaryCta: { label: "Book a demo", to: "/demo" },
    },
    stats: [
      { value: "6", label: "First-day steps", note: "number connection to team invite" },
      { value: "24h", label: "Service window", note: "free-form replies after a customer messages you" },
      { value: "1", label: "Business verification", note: "per Meta business account, not per number" },
      { value: "3", label: "Template categories", note: "marketing, utility, authentication — all Meta-reviewed" },
    ],
    overview: {
      heading: "The first day, in order",
      paragraphs: [
        "Teams that send before consent is recorded, or invite twenty agents before assignment rules exist, spend the rest of the week untangling duplicates and double replies. Working the checklist in sequence avoids that, because every step produces something the next step needs: the number produces the webhook, the import produces the segments, the segments produce the first send.",
        "Nothing here is a migration commitment. You can start with a fresh number, import a small list, send to fifty contacts and widen from there — the order matters more than the volume.",
      ],
      bullets: [
        "Take a number you already own; porting and a new Cloud API number both work, with different lead times",
        "Start Meta business verification on day one even if you send before it completes",
        "Import contacts with the opt-in source and timestamp kept as their own columns",
        "Draft templates with variables you can actually fill from your CRM data",
        "Send the first campaign to a small segment before you touch the full list",
        "Invite agents only after queues and assignment rules exist",
      ],
    },
    features: [
      {
        icon: "MessageCircle",
        title: "Connect the number",
        desc: "Add the number you own, confirm the webhook is receiving, and exchange a test message in both directions. Delivery receipts on both sides mean it is live.",
      },
      {
        icon: "ShieldCheck",
        title: "Verify the business",
        desc: "Verification sits at the Meta business account level, not per number, and it unlocks the template categories and volume your use case needs.",
      },
      {
        icon: "Users",
        title: "Import contacts",
        desc: "Upload a CSV with tags and consent columns preserved. The importer flags duplicates instead of creating them, and the opt-in source survives the import.",
      },
      {
        icon: "FileText",
        title: "Build the first template",
        desc: "Write it, pick a category, fill sample variables and submit. Meta's decision and the rejection reason appear on the same screen as the draft.",
      },
      {
        icon: "Send",
        title: "Send the first campaign",
        desc: "Pick a small segment, check delivery and quality on that send, and only then widen the audience to the rest of the consented list.",
      },
      {
        icon: "Lock",
        title: "Invite the team",
        desc: "Roles and branch scope first, seats second. No agent should be able to open another branch's conversations because nobody set a boundary.",
      },
    ],
    workflow: {
      heading: "The four phases of day one",
      steps: [
        {
          title: "Connect and verify",
          desc: "Number connected, webhook confirmed with a two-way test, business verification started so it is not blocking you later.",
        },
        {
          title: "Import and segment",
          desc: "Contacts uploaded with tags and consent records intact, deduplicated, and grouped into the segments you will actually send to.",
        },
        {
          title: "Draft and submit templates",
          desc: "Category chosen deliberately, variables mapped to real fields, sample values filled, submitted for Meta review with a reason tracked.",
        },
        {
          title: "Send, then invite",
          desc: "A small first send with delivery read first, then agents invited with roles, queues and business hours already configured.",
        },
      ],
    },
    capabilities: {
      heading: "What has to be true before you send",
      items: [
        { icon: "CheckCircle2", title: "Consent is on record", desc: "Opt-in source and timestamp are stored with the contact, because an opt-out or a complaint is answered from that record." },
        { icon: "FileText", title: "Templates are approved", desc: "Meta reviews every template. Draft, submit and track the decision in the console rather than assuming it went through." },
        { icon: "GitBranch", title: "Assignment rules exist", desc: "Without a queue rule, the first inbound conversation becomes everyone's problem and the second becomes nobody's." },
        { icon: "Clock", title: "Business hours are set", desc: "Response expectations, auto-handoff and after-hours behaviour all read from this setting, so set it before the first reply." },
        { icon: "BarChart3", title: "You know which report answers your question", desc: "Pick the two or three signals you will check after the first send — delivery, replies, opt-outs — before you send them." },
      ],
    },
    faq: [
      {
        q: "How long does connecting a number take?",
        a: "Registering a new number is quick; porting an existing one depends on the carrier releasing it, so start that process separately if you need it. Many teams run a new number from day one and port later, which keeps the first campaign off the critical path.",
      },
      {
        q: "Do we need business verification before the first campaign?",
        a: "You can connect a number and start the verification in parallel, but verification gates higher-volume sending and some template categories, so begin it on day one. Treat it as a background task rather than a gate you sit and watch.",
      },
      {
        q: "We already have contacts in another tool. What moves?",
        a: "Contacts, tags and consent columns move through a CSV import; message history usually does not, so export anything you need for reference first. Templates have to be submitted again, because Meta reviews every template per business rather than accepting another tool's approvals.",
      },
      {
        q: "Who should be invited first?",
        a: "A supervisor and the two or three people who will handle replies. Set queues, assignment rules and roles on that small group, get one day of real conversations through it, and then widen the invite — it is much harder to fix permissions after thirty agents have created their own habits.",
      },
    ],
  },
  /* ── Blog ────────────────────────────────────────────────────────────────── */
  {
    path: "/blog",
    section: "Resources",
    meta: {
      title: "Blog & Insights — WhatsApp Operations Writing | Madhura",
      description:
        "MADHURA's blog covers deliverability, WhatsApp policy changes, operations playbooks and product notes — two posts a week, every claim sourced.",
    },
    hero: {
      badge: "Resources · Blog",
      title: "Writing that tells you what changed and why.",
      subtitle:
        "Four recurring columns: deliverability, WhatsApp policy changes, operations playbooks and product notes. Every post names the setting, screen or policy clause it refers to, so you can act on it the same day. Nothing here is sponsored, and nothing is published that we cannot point at a source for.",
      points: [
        "Four columns: deliverability, policy, playbooks, product notes",
        "Two posts a week, Tuesday and Thursday",
        "Every claim points at a doc, a screen or a changelog",
        "No sponsored posts and no republished press releases",
      ],
      primaryCta: { label: "Start free trial", to: "/signup" },
      secondaryCta: { label: "Book a demo", to: "/demo" },
    },
    stats: [
      { value: "4", label: "Recurring columns", note: "deliverability, policy, playbooks, product notes" },
      { value: "2/wk", label: "Publishing cadence", note: "Tuesday and Thursday" },
      { value: "0", label: "Sponsored posts", note: "editorial is not for sale" },
      { value: "1", label: "Source per claim", note: "a Meta doc, a screen or a changelog" },
    ],
    overview: {
      heading: "What we write about, and what we skip",
      paragraphs: [
        "Deliverability covers the mechanics that decide whether a message lands: template quality rating, categorisation, send pacing and what a failure code actually means. Policy coverage follows Meta's changelog and tells you what to change in your templates and journeys before it costs you a send. Playbooks are the operational side — queues, staffing against the 24-hour service window, segment hygiene. Product notes explain what shipped and what it replaces.",
        "We do not publish predictions dressed as facts, vendor-versus-vendor roundups we have not tested, or any result we cannot show the method behind. Corrections are added at the foot of a post rather than made quietly.",
      ],
      bullets: [
        "Why your template quality rating dropped after a festival campaign",
        "What the 24-hour service window does to your staffing roster",
        "Reading Meta's policy changelog before it costs you a send",
        "Assigning two hundred conversations a day without double replies",
      ],
    },
    features: [
      {
        icon: "FileText",
        title: "Sourcing rule",
        desc: "Each post links the Meta documentation, the console screen or the changelog entry it rests on. If we cannot link it, we do not assert it.",
      },
      {
        icon: "RefreshCw",
        title: "Corrections are visible",
        desc: "When a post is wrong, the correction is added at the foot with the date — the original claim stays readable so you can see what changed.",
      },
      {
        icon: "ShieldCheck",
        title: "Policy coverage with actions",
        desc: "A policy change is published with the specific thing to do: which template category to re-check, which journey to update, which consent field to start capturing.",
      },
      {
        icon: "Terminal",
        title: "Product notes tie to the changelog",
        desc: "Feature posts name the release, the setting and what the old behaviour was, so you can decide whether the change affects a live journey.",
      },
      {
        icon: "Users",
        title: "Written for operators",
        desc: "Written for the person who runs the queue on Monday, not for a search engine — steps, settings and trade-offs rather than definitions.",
      },
    ],
    capabilities: {
      heading: "The four columns",
      items: [
        { icon: "Activity", title: "Deliverability", desc: "Quality rating, categorisation, failure codes, pacing and what actually moves when a template starts underperforming." },
        { icon: "ShieldCheck", title: "WhatsApp policy changes", desc: "Meta's changelog translated into operational changes: template categories, consent, messaging windows and rate behaviour." },
        { icon: "GitBranch", title: "Operations playbooks", desc: "Queue design, routing, staffing against the service window, segment hygiene and the reporting rituals that keep a team honest." },
        { icon: "Zap", title: "Product notes", desc: "What shipped in MADHURA, which setting it lives behind, and what it replaces — dated and tied to the changelog." },
      ],
    },
    faq: [
      {
        q: "How often do you publish?",
        a: "Twice a week, on Tuesday and Thursday. When Meta ships something that changes how teams should send, that post goes out early rather than waiting for the slot.",
      },
      {
        q: "Do you accept guest posts?",
        a: "Not at the moment. If you have an operator story with a method you are willing to show, send it through the contact page — that is a better fit for a case study than a guest column, and case studies carry the measurement section.",
      },
      {
        q: "What happens when a post turns out to be wrong?",
        a: "We add a dated correction at the foot of the post and, if the change affects advice teams have already acted on, we announce it on the news page. We do not quietly edit the original wording.",
      },
      {
        q: "Where do product releases get announced?",
        a: "On the news page first, with the changelog carrying the versioned detail. Blog product notes explain the reasoning behind a release; the news page is the dated record of what went live.",
      },
    ],
  },

  /* ── Tutorials ───────────────────────────────────────────────────────────── */
  {
    path: "/tutorials",
    section: "Resources",
    meta: {
      title: "Tutorials — Task Walkthroughs with Expected Output | Madhura",
      description:
        "Task-focused walkthroughs with a stated expected output — connect a number, submit a template, import contacts, send a broadcast and more.",
    },
    hero: {
      badge: "Resources · Tutorials",
      title: "Short walkthroughs that end with a checkable result.",
      subtitle:
        "Each tutorial is one task: what you need before you start, the exact screens involved, and the output you should be able to verify when you are done. They run in the console against a workspace, so you can practise on a test number before anything touches production. No video scrubbing, no slide decks.",
      points: [
        "One task per tutorial, start to verified output",
        "Expected output stated before you begin",
        "Screens named, so you never hunt for a setting",
        "Prerequisites listed up front, including plan-dependent limits",
      ],
      primaryCta: { label: "Start free trial", to: "/signup" },
      secondaryCta: { label: "Book a demo", to: "/demo" },
    },
    stats: [
      { value: "6", label: "Tutorials", note: "first number through first report" },
      { value: "15 min", label: "Typical runtime", note: "the contact import is the longest" },
      { value: "1", label: "Expected output", note: "stated up front, checkable at the end" },
      { value: "0", label: "Code required", note: "every tutorial is click-through in the console" },
    ],
    overview: {
      heading: "How to work through a tutorial",
      paragraphs: [
        "Read the expected output first. Every tutorial opens with the thing you should be able to see at the end — a connected number, a submitted template with a decision, a segment that counted correctly — so you know when to stop instead of trusting that you finished.",
        "Then check the prerequisites. Some need an admin role, some need a contact file with an opt-in column, and one needs a template already approved by Meta, which is a review you do not control. Tutorials that depend on someone else's decision say so before you start, not halfway through.",
      ],
      bullets: [
        "Practise on a test number and a small segment before you repeat it on production data",
        "Do them in order the first time — later tutorials assume the number and contacts exist",
        "If your console looks different, check the changelog: tutorials are versioned with the product",
        "Each tutorial links the matching docs page for the settings it does not explain",
        "Something broken or unclear? That is a support ticket, and a useful one",
      ],
    },
    features: [
      {
        icon: "MessageCircle",
        title: "Connect a WhatsApp number to a workspace",
        desc: "Output: the number shows as connected, an exchange in both directions succeeds, and delivery receipts appear for each message.",
      },
      {
        icon: "FileText",
        title: "Submit your first message template",
        desc: "Output: a draft with sample variables is submitted, and the Meta decision lands on the same screen with its reason if it is rejected.",
      },
      {
        icon: "Users",
        title: "Import contacts with tags and opt-in records",
        desc: "Output: rows land with tags applied, duplicates are flagged rather than created, and the consent columns survive the import intact.",
      },
      {
        icon: "Inbox",
        title: "Build an inbox queue with assignment rules",
        desc: "Output: an inbound conversation is routed to the right agent automatically, and a second agent cannot claim it while someone is replying.",
      },
      {
        icon: "Send",
        title: "Send a broadcast to a segment and read the report",
        desc: "Output: a small segment sends, and the report breaks the result into delivered, read, failed and opted-out counts.",
      },
      {
        icon: "GitBranch",
        title: "Trigger an automation from an inbound keyword",
        desc: "Output: a reply containing your keyword starts a journey, tags the contact and hands off to a human at the step you configured.",
      },
    ],
    capabilities: {
      heading: "What every tutorial guarantees",
      items: [
        { icon: "CheckCircle2", title: "Stated output", desc: "The result is defined before the first click, so you can tell the difference between done and almost done." },
        { icon: "Clock", title: "Prerequisites first", desc: "Role, plan-dependent features and external waits such as Meta template review are listed at the top, not discovered mid-task." },
        { icon: "Terminal", title: "Console, not slides", desc: "Every step is a screen you can reproduce in your own workspace, with the menu path written out for each one." },
        { icon: "RefreshCw", title: "Versioned with the product", desc: "When a screen moves, the tutorial is updated with the release; the changelog records which version it was written against." },
        { icon: "Download", title: "Sample files included", desc: "Import tutorials ship the CSV structure they expect, with consent columns already in place, so you are not guessing at the format." },
      ],
    },
    faq: [
      {
        q: "Do I need a workspace before I start?",
        a: "Yes — tutorials assume you are signed in to a workspace with an admin or setup role. If you have not created one yet, the first-day checklist walks you through connecting a number and importing contacts before you come back here.",
      },
      {
        q: "What if my console looks different from the screenshots?",
        a: "Check the changelog for the release your workspace is on. Screenshots are updated with the release that changed them, and the tutorial states the version it was written against so you know whether it is you or us.",
      },
      {
        q: "Can I follow along without affecting live data?",
        a: "Use a test number and a small segment. Tutorials that would touch production data — broadcasts, imports, automation triggers — say so in the prerequisites and suggest a sandbox run first.",
      },
      {
        q: "Where do API and webhook tasks live?",
        a: "In the docs and the developer guides, not here. Tutorials cover the console; if your task starts with an endpoint, start at the API reference instead.",
      },
    ],
  },
  /* ── Videos ──────────────────────────────────────────────────────────────── */
  {
    path: "/videos",
    section: "Resources",
    meta: {
      title: "Video Guides — Setup, Campaigns, Reporting | Madhura",
      description:
        "Five video series by role, from workspace setup to reporting. One task per video, five to twelve minutes, captions on every video.",
    },
    hero: {
      badge: "Resources · Videos",
      title: "One task per video, one series per role.",
      subtitle:
        "The library is grouped by the person watching — a new admin, a support lead, marketing operations, an automation builder, a manager reading reports. Each video runs between five and twelve minutes, shows one task on a real console, and stops at the result you should see. Nothing is gated behind a form.",
      points: [
        "Five series, from workspace setup to reporting",
        "One task per video, shown end to end",
        "Five to twelve minutes, captions on every video",
        "Grouped by role, so you skip what is not yours",
      ],
      primaryCta: { label: "Start free trial", to: "/signup" },
      secondaryCta: { label: "Book a demo", to: "/demo" },
    },
    stats: [
      { value: "5", label: "Series", note: "setup, inbox, campaigns, automation, reporting" },
      { value: "8 min", label: "Average runtime", note: "five to twelve minutes per video" },
      { value: "1", label: "Task per video", note: "the result appears before the end" },
      { value: "0", label: "Email gates", note: "the library plays without a form" },
    ],
    overview: {
      heading: "What the library covers",
      paragraphs: [
        "The library runs from first connection to the report you show leadership: connecting and verifying a number, importing contacts, the shared inbox and its routing rules, templates and broadcasts, automations and WhatsApp Flows, and finally analytics and per-branch rollups. Each series is self-contained, so a support lead never has to sit through campaign setup to learn queue assignment.",
        "Videos are recorded against a training workspace with dummy contacts, then updated when a screen they show changes materially. The dated detail lives in the changelog; the videos are for seeing the flow of the task rather than for pixel-matching a menu.",
      ],
      bullets: [
        "New admins start with Getting Started and stop when the number is live",
        "Support leads can take Inbox and Routing without touching campaigns",
        "Marketing operations gets template categories, rejections and segmentation",
        "Managers get the reporting series without needing console access first",
        "Captions are on every video, and the UI is captured at a readable size",
      ],
    },
    features: [
      {
        icon: "Rocket",
        title: "Getting Started",
        desc: "For admins setting up a workspace: connect a number, confirm the webhook, verify the business, import contacts, invite the team. Around eight minutes each.",
      },
      {
        icon: "Inbox",
        title: "Inbox and Routing",
        desc: "For support leads: queues, assignment rules, collision detection, snooze and saved replies, plus what happens when the 24-hour window closes.",
      },
      {
        icon: "Send",
        title: "Campaigns and Templates",
        desc: "For marketing operations: choosing a template category, reading a rejection reason, building a segment and sending the first broadcast.",
      },
      {
        icon: "GitBranch",
        title: "Automation and Flows",
        desc: "For operations builders: triggers and conditions, WhatsApp Flows, handoff to a human, and where the AI chatbot should stop and escalate.",
      },
      {
        icon: "BarChart3",
        title: "Analytics and Reporting",
        desc: "For managers: delivery and failure breakdowns, response time, template quality rating, and how branch rollups differ from per-branch views.",
      },
    ],
    capabilities: {
      heading: "How the library is produced",
      items: [
        { icon: "Users", title: "Grouped by role", desc: "Series follow the job rather than the feature list, so you can watch the two videos that apply to your week and stop." },
        { icon: "CheckCircle2", title: "The result is shown", desc: "Every video ends on the screen that proves the task worked — the receipt, the decision, the routed conversation, the report row." },
        { icon: "RefreshCw", title: "Updated on material change", desc: "When a workflow a video shows is redesigned, the video is re-recorded rather than annotated with a disclaimer." },
        { icon: "Lock", title: "No gate", desc: "No email form, no gated download. If a colleague needs to see it, send them the link." },
      ],
    },
    faq: [
      {
        q: "Do I need to watch the series in order?",
        a: "Only within a series. Getting Started is sequential because each step depends on the last; the others are independent, so a support lead can open Inbox and Routing on day one and skip everything about campaigns.",
      },
      {
        q: "Are these recorded on a real customer workspace?",
        a: "No. Videos are recorded against a training workspace with dummy contacts and test numbers, which is also why the library can show mistakes — a rejection, a failed send — without exposing anyone's data.",
      },
      {
        q: "How often are videos updated?",
        a: "When a workflow they show changes materially, not on a calendar. The changelog records the release that triggered a re-record, so you can tell whether the video you just watched is current.",
      },
      {
        q: "Is there a video for something you have not covered?",
        a: "Ask through support, and check the tutorials in the meantime — most videos have a written equivalent with the same expected output, which is faster to follow when you are at your own keyboard.",
      },
    ],
  },

  /* ── Case studies ────────────────────────────────────────────────────────── */
  {
    path: "/case-studies",
    section: "Resources",
    meta: {
      title: "Case Studies — Situation, Change, Measurement | Madhura",
      description:
        "How to read a MADHURA case study: situation, change, measurement. Anonymised profiles only — no names, no logos, no attributed numbers.",
    },
    hero: {
      badge: "Resources · Case Studies",
      title: "Read the situation, the change, the measurement.",
      subtitle:
        "Every MADHURA case study has the same three sections, and every profile is anonymised: industry, size and geography, never a company name or a logo. You get the pattern of what changed and how the team could tell — not a headline figure we are not permitted to attribute to anyone.",
      points: [
        "Three sections: situation, change, measurement",
        "Profiles anonymised — no names, no logos",
        "Outcomes described as patterns, not attributed numbers",
        "Method shown, so you can judge the claim yourself",
      ],
      primaryCta: { label: "Start free trial", to: "/signup" },
      secondaryCta: { label: "Book a demo", to: "/demo" },
    },
    stats: [
      { value: "3", label: "Sections per study", note: "situation, change, measurement" },
      { value: "0", label: "Named customers", note: "no names, no logos, no attributed quotes" },
      { value: "6", label: "Countries served", note: "through partners and direct" },
      { value: "1", label: "Question answered", note: "what changed, and how they could tell" },
    ],
    overview: {
      heading: "How to read a MADHURA case study",
      paragraphs: [
        "The situation section describes the constraint the team lived with: how many outlets or brokers, how conversations arrived today, who was answering them, and what broke first as volume grew. It names the mechanism, not the tool they happened to replace — vendor names are rarely the useful part of a story.",
        "The change section lists what was actually configured: queues and assignment rules, template categories chosen deliberately, consent capture added to the intake form, automations built and the ones deliberately left alone. The measurement section says which signal moved, how it was observed before and after, and over what period — then stops. Precise figures stay with the customer unless they have given written permission to publish them, so we describe direction and mechanism instead.",
      ],
      bullets: [
        "The situation names the constraint, not the previous vendor",
        "The change lists what was configured, not what was promised",
        "The measurement names the signal and how it was observed",
        "Profiles carry industry, size and geography — never a company",
        "No precise figure is attributed to a customer without written permission",
        "If a study cannot say how it was measured, we do not publish it",
      ],
    },
    features: [
      {
        icon: "Building",
        title: "The situation",
        desc: "Scale, channels and the failure mode in plain terms — how many outlets or brokers, how messages arrived, and which part of the process broke at volume.",
      },
      {
        icon: "GitBranch",
        title: "The change",
        desc: "What was configured and in what order: routing, templates, consent capture, journeys, per-branch permissions — including the decisions the team chose not to make.",
      },
      {
        icon: "BarChart3",
        title: "The measurement",
        desc: "The signal that moved, how it was observed before and after, and the observation window — written so a sceptical operator could repeat the measurement.",
      },
      {
        icon: "Filter",
        title: "What we leave out",
        desc: "Company names, logos, attributed quotes and precise customer figures. Those appear only when the customer has approved the wording in writing.",
      },
      {
        icon: "MessageSquare",
        title: "A deeper walkthrough",
        desc: "For shortlisted evaluations we can arrange a conversation with a customer whose consent is on record — through the contact page, under NDA.",
      },
    ],
    capabilities: {
      heading: "The anonymised profiles you will see",
      items: [
        { icon: "Building", title: "40-outlet specialty retail chain, South India", desc: "Branch-scoped queues, festival-season broadcasts and per-store reporting rolled up for the regional team." },
        { icon: "Globe", title: "Multi-city real-estate brokerage", desc: "Lead routing across brokers, listing and follow-up templates, and handoff when an enquiry goes quiet." },
        { icon: "Activity", title: "Multi-location healthcare group", desc: "Appointment and reminder templates under a strict consent record, with branch-level permissions for front-desk teams." },
        { icon: "Clock", title: "Regional logistics operator", desc: "Status updates as utility templates, exception conversations pulled into a shared queue, and after-hours routing." },
      ],
    },
    faq: [
      {
        q: "Why are there no numbers in the studies?",
        a: "Because the numbers belong to the customer. We publish the signal that moved, how it was measured and in which direction — the customer keeps the figures unless they explicitly approve publishing them, and most will not, for reasons that are entirely theirs.",
      },
      {
        q: "Can we speak to a customer ourselves?",
        a: "For shortlisted evaluations, yes — arranged case by case, with the customer's consent and under NDA, through the contact page. We do not hand out contact details, and we will tell you plainly if there is no reference available in your industry.",
      },
      {
        q: "How is a case study written and approved?",
        a: "The implementation lead and the customer's operations owner write it together from their own records, and the customer reviews the final wording before publication. That is also why the anonymisation holds: approval is on the text, not on a brand guideline.",
      },
      {
        q: "Do you publish studies for our industry?",
        a: "Ask. Profiles exist for retail, healthcare, real estate, logistics and education, and if your sector is missing we would rather say so than imply a pattern we cannot evidence. A scoping call usually answers whether the pattern transfers.",
      },
    ],
  },
  /* ── FAQs ────────────────────────────────────────────────────────────────── */
  {
    path: "/faqs",
    section: "Resources",
    meta: {
      title: "Frequently Asked Questions — Pricing, Policy, Migration | Madhura",
      description:
        "Six groups of common questions — pricing, compliance, migration, security, support and onboarding — each answered briefly with a link deeper.",
    },
    hero: {
      badge: "Resources · FAQs",
      title: "Every common question, with the page that answers it.",
      subtitle:
        "Six groups: pricing and billing, compliance and messaging policy, migration from another tool, security, support and onboarding. The answers here are deliberately short and point at the page that goes deeper, so you can route yourself in one click. If your question is not here, support will answer it and it will probably appear next.",
      points: [
        "Pricing and billing, with plan-dependent limits named",
        "Compliance, consent and template policy",
        "Migration from another tool, and security review",
        "Support response targets and what onboarding includes",
      ],
      primaryCta: { label: "Start free trial", to: "/signup" },
      secondaryCta: { label: "Book a demo", to: "/demo" },
    },
    stats: [
      { value: "6", label: "Question groups", note: "billing, policy, migration, security, support, onboarding" },
      { value: "1", label: "Answer per question", note: "short here, deeper on the linked page" },
      { value: "24h", label: "Security acknowledgement", note: "vulnerability reports" },
      { value: "1 day", label: "Sales reply target", note: "for new enquiries" },
    ],
    overview: {
      heading: "Route yourself to the right page",
      paragraphs: [
        "These are the questions that come up in almost every demo, grouped the way a buying team asks them: what it costs, whether it is allowed, whether you can move, whether it is safe, who answers when something breaks, and what happens in the first weeks. Each answer here is a summary with a destination, not a substitute for the full page.",
        "Nothing on this page describes a fixed price or a fixed limit. Seats, branches, message volume and plan-dependent features are set out on the pricing page, and anything contractual — retention, response targets, residency — is written into the agreement rather than promised in an FAQ.",
      ],
      bullets: [
        "Pricing and billing: tiers, seats and usage on the pricing page, invoices in the help centre",
        "Compliance: consent, template categories and opt-out on the messaging consent page",
        "Migration: what moves, what has to be rebuilt, and the order that avoids double sends",
        "Security: controls, sub-processors and evidence on the trust and legal pages",
        "Support: channels and per-plan response targets on the support pages",
        "Onboarding: what implementation covers and who does what, on the onboarding page",
      ],
    },
    features: [
      {
        icon: "Percent",
        title: "Pricing and billing",
        desc: "What each tier includes, how seats and usage are counted, what changes at scale, and how billing reacts when you upgrade mid-cycle.",
      },
      {
        icon: "ShieldCheck",
        title: "Compliance and messaging policy",
        desc: "Consent records, opt-out handling, template categories and Meta approval, the 24-hour service window, and what quality rating does to your sends.",
      },
      {
        icon: "RefreshCw",
        title: "Migration",
        desc: "Which contact fields move, why templates are re-submitted rather than copied, how numbers are handled, and how to avoid messaging anyone twice.",
      },
      {
        icon: "Lock",
        title: "Security",
        desc: "Access control, audit logging, data export and deletion, sub-processors, and the evidence pack available for a procurement review.",
      },
      {
        icon: "Inbox",
        title: "Support",
        desc: "How to open a ticket, what to include, how severity is decided, and the response target that applies to your plan.",
      },
      {
        icon: "Rocket",
        title: "Onboarding",
        desc: "What implementation covers — number connection, template strategy, contact import, queue design and agent training — and what your team owns.",
      },
    ],
    capabilities: {
      heading: "Go deeper: the pages behind these answers",
      items: [
        { icon: "Sliders", title: "Plan-dependent limits", desc: "The pricing page is the source for tiers, seats and usage rules; enterprise terms are documented rather than implied." },
        { icon: "ShieldCheck", title: "Messaging consent", desc: "The consent page covers opt-in capture, opt-out enforcement and what must be retained if a complaint arrives." },
        { icon: "Download", title: "Migration and export", desc: "Docs carry the migration order and file formats; the console lets admins export contact data directly." },
        { icon: "Lock", title: "Trust and legal", desc: "Architecture, controls, sub-processors, DPA and retention terms live in the trust centre and the legal pages." },
      ],
    },
    faq: [
      {
        q: "What does MADHURA cost?",
        a: "It is plan-dependent: seats, branches, message volume and which modules are switched on all change the number, so there is no single figure worth quoting here. The pricing page sets out the tiers and what each includes; enterprise terms — residency, retention, response targets — are documented and agreed in writing.",
      },
      {
        q: "Do we need consent before we message someone?",
        a: "Yes, and the record has to be answerable later: opt-in source and timestamp are stored with the contact, opt-out is honoured at send time, and template categories plus Meta approval decide what can go out at all. The messaging consent page covers what to capture at the point of collection.",
      },
      {
        q: "Can we move from another tool?",
        a: "Contacts, tags and consent columns move through an import; templates are submitted again because Meta reviews them per business; numbers are connected or ported depending on what you want to keep. The migration order in the docs exists specifically to avoid messaging the same person twice during the cutover.",
      },
      {
        q: "How do we know the platform is secure?",
        a: "Start with the trust centre, which describes access control, audit logging, export and deletion, and incident handling, and the legal pages, which name sub-processors and retention terms. We answer security questionnaires for enterprise review and provide a DPA — where we are not audited for something, we do not claim it.",
      },
      {
        q: "How do we reach support, and how fast?",
        a: "Open a ticket from the support page or email support@madhuratech.com. Response targets vary by plan and are published on the support plans page rather than summarised here, and anything affecting live sends is escalated to an on-call engineer.",
      },
      {
        q: "What does onboarding actually include?",
        a: "Number connection, template strategy, contact import, queue and permission design, and agent training — delivered with your team rather than handed over as documentation. What your side owns is written into the plan before the start date, so neither team assumes the other will do it.",
      },
    ],
  },

  /* ── Compare ─────────────────────────────────────────────────────────────── */
  {
    path: "/compare",
    section: "Resources",
    meta: {
      title: "Compare WhatsApp CRM Tools — A Fair Framework | Madhura",
      description:
        "A comparison framework built on five testable dimensions, how MADHURA positions on each, and the cases where we are the wrong fit.",
    },
    hero: {
      badge: "Resources · Compare",
      title: "Compare on five dimensions you can actually test.",
      subtitle:
        "This is the framework we hand to teams running an evaluation: inbox model, multi-branch support, template workflow, API surface and pricing transparency. It explains how MADHURA positions on each, and it ends with the situations where we are the wrong choice. No competitor names and no feature matrix scored by the vendor writing it.",
      points: [
        "Five dimensions, each with a test you can run",
        "How MADHURA positions, in plain terms, on each one",
        "Where we are not the right fit, stated openly",
        "No competitor names and no self-scored matrix",
      ],
      primaryCta: { label: "Start free trial", to: "/signup" },
      secondaryCta: { label: "Book a demo", to: "/demo" },
    },
    stats: [
      { value: "5", label: "Dimensions", note: "inbox, branches, templates, API, pricing" },
      { value: "0", label: "Competitor names", note: "we do not publish comparisons we have not run" },
      { value: "4", label: "Wrong-fit cases", note: "listed at the bottom of this page" },
      { value: "1", label: "Sandbox to settle it", note: "test with your own number, not our slides" },
    ],
    overview: {
      heading: "What to compare, and how",
      paragraphs: [
        "Feature matrices flatter whoever drew them. The useful comparison is the model underneath each capability: how a conversation gets assigned when two agents want it, whether a branch is a tag or a boundary for data and permissions, whether templates are a list or a workflow with rejection handling, whether the API covers what the UI does, and whether a buyer can read the pricing without booking a call.",
        "Each dimension below states what to ask every vendor — including us — how MADHURA answers, and the test you can run in a sandbox in under an hour. Where two vendors tie, decide on implementation support and exit cost: what it takes to go live, and what it takes to leave.",
      ],
      bullets: [
        "Inbox: what happens when two agents open the same conversation at once?",
        "Multi-branch: is a branch a tag, or a boundary for data, permissions and reports?",
        "Templates: where does the rejection reason live, and who approves the next draft?",
        "API: can everything the interface does be done over REST and webhooks?",
        "Pricing: can a buyer see tiers, seats and overage rules without booking a call?",
      ],
    },
    features: [
      {
        icon: "Inbox",
        title: "Inbox model",
        desc: "Ask what assignment actually does. MADHURA treats the inbox as a routing system — queue rules, ownership, collision detection and an audit trail — rather than a chat window everyone watches.",
      },
      {
        icon: "Building",
        title: "Multi-branch support",
        desc: "Ask whether a branch is a filter or a boundary. Here it is a boundary: numbers, agents, templates, hours and reporting are scoped per branch and rolled up for leadership.",
      },
      {
        icon: "FileText",
        title: "Template workflow",
        desc: "Ask where rejections are handled. Drafts carry sample variables, the submission and Meta's decision sit on the same screen, the reason is attached, and quality rating is monitored per number.",
      },
      {
        icon: "Terminal",
        title: "API surface",
        desc: "Ask whether an interface action has an endpoint. Sends, contacts, conversations and events are covered by REST and signed webhooks; a UI action without an endpoint is treated as a gap, not a premium tier.",
      },
      {
        icon: "Percent",
        title: "Pricing transparency",
        desc: "Ask to see the tiers before the call. Plan tiers and plan-dependent limits are published, enterprise terms are documented in writing, and nothing changes at renewal without notice.",
      },
    ],
    workflow: {
      heading: "How to run the comparison",
      steps: [
        {
          title: "Weight the five dimensions",
          desc: "Score them for your situation first. A single-brand team weighs the inbox differently from a forty-branch chain, and the weighting decides the outcome.",
        },
        {
          title: "Write one test per dimension",
          desc: "Two agents on one conversation, a branch-scoped permission, a deliberately rejected template, one API call, one invoice question.",
        },
        {
          title: "Run it in a sandbox",
          desc: "Use your own number and a small contact file. A vendor willing to configure a sandbox with your data is telling you something about implementation too.",
        },
        {
          title: "Decide on exit terms",
          desc: "Data export, API coverage, contract length and the implementation load each option puts on your team — the cost of leaving is part of the cost of buying.",
        },
      ],
    },
    capabilities: {
      heading: "When MADHURA is not the right fit",
      items: [
        { icon: "MessageCircle", title: "One number, one person", desc: "A small team handling a handful of chats on the WhatsApp Business app rarely needs queues, branch permissions and an audit trail — you may not need a CRM at all yet." },
        { icon: "Percent", title: "Lowest sticker price wins", desc: "Implementation and plan-dependent limits are part of what this costs. If the decision is purely on per-seat price, we will usually lose it and we will say so early." },
        { icon: "Layers", title: "Resale under our brand", desc: "White-labelling and resale happen only under a written partner agreement. If you need to put your brand on the platform tomorrow, start with the partner program." },
        { icon: "ShieldCheck", title: "Consent you cannot evidence", desc: "If opt-in records cannot be produced or maintained, no tool fixes that. We would rather surface it in the first call than in a compliance review later." },
      ],
    },
    faq: [
      {
        q: "Why do you not name competitors?",
        a: "Because a published matrix scored by the vendor is marketing, not comparison. We describe our own model in enough detail that you can test it against anyone else's — and the framework is built so the questions are the same whichever logo is on the other side of the table.",
      },
      {
        q: "How do we compare two vendors fairly?",
        a: "Weight the five dimensions for your situation, write one concrete test per dimension, and run each vendor through the same script in a sandbox with your own data. Consistency of the test matters far more than breadth of the checklist.",
      },
      {
        q: "We already run another tool. Is switching worth it?",
        a: "It depends on what is breaking. If the constraint is routing, branch boundaries or reporting, the migration order in the docs avoids messaging anyone twice during cutover; if your current tool already answers those, the honest answer is to stay and solve the specific gap.",
      },
      {
        q: "Can we see the API before we buy?",
        a: "Yes — the API reference and webhook documentation are public, and the developer sandbox lets you authenticate and send against a test number. Evaluate the endpoints you would actually build against rather than a demo environment we control.",
      },
    ],
  },
];
