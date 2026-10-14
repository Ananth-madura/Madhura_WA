/* Company section pages — /company/* -------------------------------------------------
   About renders through the standard marketing template. Contact and Careers
   carry extra data consumed by their dedicated renderers.
   --------------------------------------------------------------------------------- */

export const COMPANY_PAGES = [
  {
    path: "/company/about",
    section: "Company",
    renderer: "standard",
    meta: {
      title: "About Madhura — Enterprise WhatsApp CRM | Madhura",
      description:
        "Madhura builds the enterprise WhatsApp CRM and automation platform used by multi-branch businesses to run support, sales and operations on one channel.",
    },
    hero: {
      badge: "Company · About",
      title: "We build the layer that makes WhatsApp operable.",
      highlight: "operable",
      subtitle:
        "Madhura Technologies builds the systems that turn WhatsApp from a phone app into an accountable business channel — with ownership, audit trails and reporting that a compliance team will accept.",
      points: [
        "Multi-tenant, multi-branch architecture from day one",
        "Built around Meta's Cloud API and webhook contract",
        "Delivered with implementation partners, not just licences",
        "Operating from India, serving teams across Asia, GCC and Africa",
      ],
      primaryCta: { label: "Work with us", to: "/company/contact" },
      secondaryCta: { label: "See open roles", to: "/company/careers" },
    },
    stats: [
      { value: "2019", label: "Founded", note: "first WhatsApp automation shipped" },
      { value: "6", label: "Countries served", note: "through partners and direct" },
      { value: "40+", label: "Businesses live", note: "across retail, healthcare, logistics" },
      { value: "24/7", label: "Operations coverage", note: "follow-the-sun support" },
    ],
    overview: {
      heading: "Why Madhura exists",
      paragraphs: [
        "WhatsApp is where customers already are, but running a business on it the way most companies do — personal phones, forwarded screenshots, no record of who promised what — does not survive contact with real volume. It fails at ten agents, and it fails an audit at any size.",
        "We started Madhura to close that gap: keep the channel customers trust, add the ownership, automation and measurement that operations teams need, and do it without asking a business to abandon its CRM, its branches or its compliance obligations.",
        "That means the boring parts are the product: assignment rules, audit logs, retention windows, per-branch permissions, delivery telemetry. The parts that look impressive in a demo are the easy half.",
      ],
      bullets: [
        "Multi-tenant by design — data is partitioned at the row level, not by convention",
        "Branch topology mirrors how multi-location businesses actually operate",
        "Every mutating action is written to an immutable audit trail",
        "Open REST API and webhooks so the platform composes with existing systems",
        "Implementation is part of the engagement, not an upsell",
      ],
    },
    features: [
      {
        icon: "Building",
        title: "Multi-branch native",
        desc: "One organisation, many branches — each with its own numbers, agents, templates, hours and reporting, rolled up for leadership.",
      },
      {
        icon: "ShieldCheck",
        title: "Compliance posture",
        desc: "Opt-in records, opt-out enforcement, retention controls and audit exports designed to answer a regulator's questions.",
      },
      {
        icon: "Layers",
        title: "Modular platform",
        desc: "Inbox, campaigns, templates, automations, flows and analytics ship as modules — adopt one or the whole workspace.",
      },
      {
        icon: "Globe",
        title: "Regional delivery",
        desc: "Data residency options, local-language template support and delivery windows tuned to the markets our customers operate in.",
      },
      {
        icon: "Terminal",
        title: "Developer surface",
        desc: "Documented REST endpoints, signed webhooks and a CRM connector so engineering teams are never trapped in a UI.",
      },
      {
        icon: "Users",
        title: "Implementation partnership",
        desc: "Number migration, template strategy, journey design and agent training delivered alongside your team, not at them.",
      },
    ],
    workflow: {
      heading: "How we work with customers",
      steps: [
        {
          title: "Discover",
          desc: "Map the conversations, branches and systems the channel has to touch — and the compliance constraints it must satisfy.",
        },
        {
          title: "Configure",
          desc: "Numbers, templates, queues, permissions and journeys configured against that map, with your real data in a sandbox workspace.",
        },
        {
          title: "Launch",
          desc: "Phased rollout by branch or team, with parallel running and a rollback point until the metrics hold.",
        },
        {
          title: "Operate",
          desc: "Ongoing quality reviews, template strategy, quarterly business reviews and a named contact for escalations.",
        },
      ],
    },
    capabilities: {
      heading: "What we believe about this channel",
      items: [
        { icon: "Lock", title: "Ownership beats tools", desc: "A tool that no one is accountable for becomes a liability the moment volume arrives." },
        { icon: "Activity", title: "Measurement changes behaviour", desc: "Teams that can see response time improve it; teams that cannot, argue about it." },
        { icon: "ShieldCheck", title: "Compliance is design", desc: "Opt-out and retention are enforced at send time and in the schema, never in a policy document." },
        { icon: "Globe", title: "Local context matters", desc: "Template language, payment rails and business hours differ per market and the product has to respect that." },
        { icon: "Terminal", title: "Open by default", desc: "If your data cannot leave the platform, you do not own it. The API is not a premium feature." },
      ],
    },
    faq: [
      {
        q: "What kinds of businesses use Madhura?",
        a: "Multi-location retailers, healthcare and clinic groups, logistics and field-service operators, education providers and financial services teams — essentially any business where many people must speak to customers on one WhatsApp number with a record of it.",
      },
      {
        q: "Is Madhura a WhatsApp BSP?",
        a: "Madhura is a WhatsApp CRM and automation platform that runs on top of the official Meta Cloud API. We work with BSPs and direct Meta onboarding depending on what each customer's region and volume require.",
      },
      {
        q: "Do you offer implementation services?",
        a: "Yes. Number migration, template strategy, journey design, data migration and agent training are part of most engagements. Enterprise customers get a named implementation lead and a quarterly business review.",
      },
      {
        q: "Where is customer data hosted?",
        a: "Default hosting is on isolated cloud infrastructure with regional options available on enterprise plans. Residency commitments are written into the agreement rather than offered verbally.",
      },
      {
        q: "How do we start?",
        a: "Talk to us through the contact page. We run a discovery session, then configure a sandbox workspace with your own numbers and templates so you can evaluate against real workflows rather than a canned demo.",
      },
    ],
    cta: {
      title: "Bring your WhatsApp operations up to enterprise standard.",
      sub: "A discovery session is usually enough to know whether we are the right fit.",
      primary: { label: "Contact us", to: "/company/contact" },
      secondary: { label: "Read the docs", to: "/docs" },
    },
    related: ["/company/contact", "/company/careers", "/trust/security"],
  },

  /* ── Contact ──────────────────────────────────────────────────────────────── */
  {
    path: "/company/contact",
    section: "Company",
    renderer: "contact",
    meta: {
      title: "Contact Madhura — Sales, Support & Security | Madhura",
      description:
        "Reach the Madhura team: sales enquiries, implementation scoping, customer support, security reports and partnership requests. One business day response.",
    },
    hero: {
      badge: "Company · Contact",
      title: "Talk to the team that will actually build it.",
      highlight: "actually build it",
      subtitle:
        "No lead-qualification maze. Your message goes to a named person in the right team, and you get a substantive reply — not an autoresponder — within one business day.",
      points: [
        "Sales and implementation scoping",
        "Customer support for live workspaces",
        "Security and vulnerability reporting",
        "Partnerships and channel enquiries",
      ],
      primaryCta: { label: "Book a demo", to: "#contact-form" },
      secondaryCta: { label: "Read the docs first", to: "/docs" },
    },
    channels: [
      {
        icon: "Send",
        title: "Sales & demos",
        email: "sales@madhura.co",
        desc: "Pricing, scoping, migrations and a sandbox workspace configured with your own numbers.",
        sla: "Reply within 1 business day",
      },
      {
        icon: "MessageSquare",
        title: "Customer support",
        email: "support@madhura.co",
        desc: "Live workspace issues, template rejections, delivery anomalies and incident escalation.",
        sla: "Enterprise: 4 hour target",
      },
      {
        icon: "Lock",
        title: "Security",
        email: "security@madhura.co",
        desc: "Vulnerability reports, disclosure coordination, questionnaires and compliance evidence.",
        sla: "Acknowledged within 24 hours",
      },
      {
        icon: "Globe",
        title: "Partnerships",
        email: "partners@madhura.co",
        desc: "BSP, reseller, integration and implementation partner programmes.",
        sla: "Reply within 3 business days",
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
        q: "How quickly will someone reply?",
        a: "Sales and general enquiries get a substantive reply within one business day. Existing customers get a four-hour first-response target on enterprise plans, and support tickets are escalated to an on-call engineer for anything affecting live delivery.",
      },
      {
        q: "Can we get a sandbox before buying?",
        a: "Yes. After a scoping call we configure a sandbox workspace with your own number and a small template set so your team can test real workflows rather than a canned demo.",
      },
      {
        q: "Do you sign NDAs and DPAs?",
        a: "Yes to both. A data processing agreement is standard for any workspace handling personal data, and we complete security questionnaires for enterprise procurement.",
      },
      {
        q: "I found a security issue — where does it go?",
        a: "Email security@madhura.co with reproduction steps. Do not open a public issue. Our disclosure policy and safe-harbour terms are on the Security page.",
      },
    ],
    cta: {
      title: "Prefer to just try it?",
      sub: "The product tour takes four minutes and does not require talking to anyone.",
      primary: { label: "Start free trial", to: "/signup" },
      secondary: { label: "Browse documentation", to: "/docs" },
    },
    related: ["/company/about", "/company/careers", "/trust/security"],
  },

  /* ── Careers ──────────────────────────────────────────────────────────────── */
  {
    path: "/company/careers",
    section: "Company",
    renderer: "careers",
    meta: {
      title: "Careers at Madhura — Open Roles | Madhura",
      description:
        "Open roles at Madhura across engineering, delivery, support and go-to-market. Remote-friendly within India, with a product used across Asia, GCC and Africa.",
    },
    hero: {
      badge: "Company · Careers",
      title: "Build infrastructure other businesses depend on.",
      highlight: "depend on",
      subtitle:
        "Small team, real production traffic, customers in six countries. You will own systems end to end — from webhook to dashboard to the 3am incident write-up.",
      points: [
        "Remote-friendly across India, with hubs in Pune and Ahmedabad",
        "Product decisions made by the people who ship them",
        "On-call is compensated and rotated, never heroics",
        "Every role has a defined level and salary band",
      ],
      primaryCta: { label: "View open roles", to: "#open-roles" },
      secondaryCta: { label: "Ask a question", to: "/company/contact" },
    },
    benefits: [
      { icon: "Globe", title: "Remote-friendly", desc: "Work from anywhere in India. Hubs in Pune and Ahmedabad for those who want a desk." },
      { icon: "Clock", title: "Flexible hours", desc: "Core overlap of four hours; the rest is yours to schedule around your life." },
      { icon: "Activity", title: "Health cover", desc: "Family-inclusive medical insurance from day one, plus annual health check-ups." },
      { icon: "Layers", title: "Learning budget", desc: "An annual budget for courses, conferences and books, claimed without a committee." },
      { icon: "Award", title: "Clear levelling", desc: "Published expectations per level, twice-yearly reviews and compensation bands you can see." },
      { icon: "Zap", title: "Real ownership", desc: "You ship to production in week one and own the systems you build thereafter." },
    ],
    roles: [
      {
        id: "senior-backend-engineer",
        title: "Senior Backend Engineer",
        team: "Engineering",
        location: "Pune / Remote (India)",
        type: "Full-time",
        level: "Senior (L4–L5)",
        summary:
          "Own the delivery pipeline: webhook ingestion, template sync, rate-aware send queues and the analytics event store behind them.",
        responsibilities: [
          "Design and operate Node.js services handling WhatsApp webhook volume and delivery receipts",
          "Build idempotent, retry-safe send queues with per-number throughput accounting",
          "Own the analytics event store and the aggregation jobs that feed the dashboards",
          "Set the standard for schema migrations, observability and incident response",
        ],
        requirements: [
          "5+ years backend experience, with production Node.js",
          "Comfortable with MySQL at real volume: indexing, query plans, partitioning",
          "Experience running queues and background workers in production",
          "Clear written communication — we are a remote-first team",
        ],
      },
      {
        id: "frontend-engineer",
        title: "Frontend Engineer",
        team: "Engineering",
        location: "Remote (India)",
        type: "Full-time",
        level: "Mid–Senior (L3–L4)",
        summary:
          "Build the surfaces operators live in all day: the shared inbox, the flow builder and the analytics dashboards.",
        responsibilities: [
          "Ship React features against a socket-driven realtime backend",
          "Own performance of the inbox under hundreds of threads per agent",
          "Build accessible, keyboard-navigable operational UI",
          "Work directly with support leads to turn complaints into fixes",
        ],
        requirements: [
          "3+ years with React in production",
          "Strong TypeScript and state-management fundamentals",
          "An eye for interface craft in dense, data-heavy screens",
          "Experience debugging realtime sync and websocket edge cases",
        ],
      },
      {
        id: "implementation-specialist",
        title: "Implementation Specialist",
        team: "Delivery",
        location: "Ahmedabad / Hybrid",
        type: "Full-time",
        level: "Mid (L3)",
        summary:
          "Take customers from signed to live: number migration, template strategy, journey design and agent enablement.",
        responsibilities: [
          "Run discovery workshops and translate operations into queues, rules and journeys",
          "Own number migration and Meta template approval strategy",
          "Train agent teams and supervisors on the workspace",
          "Feed recurring customer friction back into the product roadmap",
        ],
        requirements: [
          "2+ years in customer implementation, solutions consulting or ops",
          "Working knowledge of WhatsApp Business API concepts",
          "Comfortable presenting to operations and compliance stakeholders",
          "Fluency in English and Hindi; Gujarati is an advantage",
        ],
      },
      {
        id: "customer-support-engineer",
        title: "Customer Support Engineer",
        team: "Support",
        location: "Remote (India)",
        type: "Full-time",
        level: "L2–L3",
        summary:
          "First line for live workspaces: diagnose delivery anomalies, template rejections and integration issues.",
        responsibilities: [
          "Triage and resolve inbound tickets with real diagnostic depth",
          "Own the knowledge base and first-response macros",
          "Reproduce bugs with enough detail for engineering to act",
          "Own the on-call rotation for delivery-impacting incidents",
        ],
        requirements: [
          "1+ years in technical support or SRE-adjacent roles",
          "SQL literacy and comfort reading logs",
          "Written English that customers are happy to receive",
          "Willingness to join a compensated on-call rotation",
        ],
      },
      {
        id: "account-executive",
        title: "Account Executive — GCC",
        team: "Go-to-market",
        location: "Remote (GCC time zones)",
        type: "Full-time",
        level: "Senior (L4)",
        summary:
          "Open and close enterprise conversations with multi-location businesses across the Gulf region.",
        responsibilities: [
          "Run full-cycle sales from discovery through procurement and security review",
          "Own the regional pipeline and forecast accurately",
          "Work with implementation to scope realistic deployments",
          "Represent the product at regional events and partner sessions",
        ],
        requirements: [
          "4+ years of B2B SaaS selling, ideally into operations or CX buyers",
          "Experience with enterprise procurement, DPAs and security questionnaires",
          "Arabic or French is an advantage",
          "Comfortable selling a technical product to both ops and IT",
        ],
      },
    ],
    faq: [
      {
        q: "What does the interview process look like?",
        a: "An intro call, a practical exercise scoped to take under four hours and paid if it exceeds that, a technical or functional deep dive, and a final conversation with the team lead and a future teammate. Most candidates finish within three weeks.",
      },
      {
        q: "Are these roles fully remote?",
        a: "Remote-friendly within India, with hub desks in Pune and Ahmedabad. The GCC account role is remote within Gulf time zones. We do not require relocation for any current opening.",
      },
      {
        q: "Do you hire interns?",
        a: "Yes, in engineering and delivery. Internships are structured around a real deliverable with a named mentor, and conversion to a full-time role is explicit rather than implied.",
      },
      {
        q: "What if my role is not listed?",
        a: "Send a note through the contact page describing what you would build and where you would start. We have hired from speculative applications twice in the last year.",
      },
    ],
    cta: {
      title: "Nothing here fits, but you should still talk to us.",
      sub: "Tell us what you would build in your first ninety days.",
      primary: { label: "Send an open application", to: "/company/contact" },
      secondary: { label: "Learn about the company", to: "/company/about" },
    },
    related: ["/company/about", "/company/contact", "/docs"],
  },
];
