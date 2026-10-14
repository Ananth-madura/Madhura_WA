/* The /features index that maps every capability to its product page — content entries are appended by the content pass.
   Keep the shape stable: path / section / renderer / meta / hero / …
   Anything omitted is filled in by content/index.js (meta, cta, related). */
export const FEATURE_PAGES = [
  {
    path: "/features",
    section: "Product",
    renderer: "standard",
    meta: {
      title: "Features — The Full MADHURA Capability Map | Madhura",
      description:
        "Every module on one page: shared inbox, contacts, campaigns, templates, automations, Flows, AI chatbot, analytics, multi-branch, roles and billing.",
    },
    hero: {
      badge: "Platform · Features",
      title: "One page for every module your team will use.",
      subtitle:
        "MADHURA is a multi-tenant WhatsApp CRM: a shared team inbox, contact records, broadcasts, Meta-approved templates, automation journeys, WhatsApp Flows, an AI chatbot, analytics, branch administration, role control and billing. This page is the map — each module described once, with the link to the page that goes deeper. Start at the inbox if conversations are the problem; start at campaigns if reach is.",
      points: [
        "Shared inbox with assignment, notes and SLA timers",
        "Campaigns, templates and Flows inside Meta's rules",
        "Automation journeys and an AI chatbot outside hours",
        "Branches, roles, exports and billing in one workspace",
      ],
      primaryCta: { label: "Start free trial", to: "/signup" },
      secondaryCta: { label: "Book a demo", to: "/demo" },
    },
    stats: [
      { value: "11", label: "Modules on this page", note: "each described below" },
      { value: "10", label: "Dedicated module pages", note: "linked from the copy" },
      { value: "24h", label: "Customer-service window", note: "free-form inside it, template outside" },
      { value: "24/7", label: "Automations & AI chatbot", note: "they do not clock off" },
    ],
    overview: {
      heading: "The platform, module by module",
      paragraphs: [
        "Everything in MADHURA hangs off one contact record and one thread history. A customer who messages a marketing number, then a support branch, appears as one person with one timeline — so a campaign, an automation and the agent who eventually replies are all working from the same facts rather than from three copies of them.",
        "The map below is the whole surface: what each module does, which rule of the WhatsApp platform it has to respect, and where the dedicated page lives when you want the mechanics. Modules can be adopted in order or out of order, and nothing is switched on that your team has not asked for.",
      ],
      bullets: [
        "Conversations: /product/live-inbox and /product/contacts — shared threads and the record behind them",
        "Outbound: /product/campaigns and /product/templates — segmentation, wave scheduling, approved wording",
        "Automation: /product/automations and /product/flows — journeys, waits and in-chat Flow screens",
        "Self-service: /product/ai-chatbot — containment inside and outside the service window",
        "Structure & measurement: /product/multi-branch, /product/crm and /product/analytics",
        "Governance: roles and permissions on every action, plus plans and billing per workspace",
      ],
    },
    features: [
      {
        icon: "Inbox",
        title: "Shared team inbox",
        desc: "One thread per customer with assignment, collision detection, internal notes and SLA timers. The mechanics live at /product/live-inbox.",
      },
      {
        icon: "Users",
        title: "Contacts & CRM",
        desc: "A single contact record with tags, custom fields and opt-in state, plus pipeline records alongside it — /product/contacts and /product/crm.",
      },
      {
        icon: "Send",
        title: "Campaigns & templates",
        desc: "Segmented broadcasts sent in waves against per-number limits, using wording Meta has already approved — /product/campaigns and /product/templates.",
      },
      {
        icon: "GitBranch",
        title: "Automations & Flows",
        desc: "Event-driven journeys with conditions, waits and retries, plus in-chat Flow screens for form-style self-service — /product/automations and /product/flows.",
      },
      {
        icon: "MessageSquare",
        title: "AI chatbot",
        desc: "An assistant that answers the repetitive questions and hands off to a human with the full context attached, at /product/ai-chatbot.",
      },
      {
        icon: "BarChart3",
        title: "Analytics & multi-branch",
        desc: "Response, delivery and revenue reporting across teams, with branch partitions and leadership roll-ups — /product/analytics and /product/multi-branch.",
      },
    ],
    capabilities: {
      heading: "Governance around every module",
      items: [
        {
          icon: "Lock",
          title: "Roles & permissions",
          desc: "Every module reads the same permission model: who may reply, publish, export or delete, scoped to a branch.",
        },
        {
          icon: "Building",
          title: "Branch administration",
          desc: "Numbers, templates, queues and business hours belong to a branch; leadership reads the consolidated view across all of them.",
        },
        {
          icon: "ShieldCheck",
          title: "Rules enforced at send time",
          desc: "Opt-in, opt-out, template categories and the 24-hour window are checked by the platform, not left to an agent's judgement.",
        },
        {
          icon: "Download",
          title: "Exports & portability",
          desc: "Contacts, threads and reports leave as CSV or JSON, and every export is written to the audit trail with the exporting user.",
        },
        {
          icon: "FileText",
          title: "Plans & billing",
          desc: "Seats, branches and conversations are metered per workspace, with usage visible during the cycle — see /pricing.",
        },
      ],
    },
    faq: [
      {
        q: "Do we have to use every module?",
        a: "No. The modules ship in one workspace, but activation is yours: a team can run the inbox and contact records for months before touching broadcasts or journeys. Tiers differ by limits and governance rather than by switching core mechanics off and on — the comparison lives on /pricing.",
      },
      {
        q: "Do the modules really share one contact record?",
        a: "Yes, and that is the point of the map. A tag set inside the inbox is visible to the segment builder; an opt-out recorded by the chatbot or a Flow blocks the campaign at send time; analytics reads the same events the modules produced. There is no per-module copy to drift.",
      },
      {
        q: "Which WhatsApp rules do these modules have to respect?",
        a: "The 24-hour customer-service window — free-form replies inside it, an approved template outside — Meta's template review and categories (utility, marketing, authentication), opt-in and opt-out handling, quality rating, and Meta's conversation-based pricing. The modules enforce those rules at send time rather than documenting them and hoping.",
      },
      {
        q: "Can we start with one branch and add more later?",
        a: "Yes. Add branches to the same workspace when the second location opens; contacts, templates, queues and permissions stay partitioned per branch, while reporting rolls up immediately so leadership sees new and old branches on one chart.",
      },
    ],
  },
];
