/* Additional company pages — /company/mission, partners, partners/apply,
   customers and /news. See company.js for the canonical entry shape.
   Anything omitted is filled in by content/index.js (meta, cta, related). */

export const COMPANY_EXTRA_PAGES = [
  /* ── Mission ─────────────────────────────────────────────────────────────── */
  {
    path: "/company/mission",
    section: "Company",
    meta: {
      title: "Our Mission — The Standard We Hold | Madhura",
      description:
        "Why MADHURA exists, the standard we hold ourselves to, and what we refuse to do — no dark patterns and no unverified claims.",
    },
    hero: {
      badge: "Company · Mission",
      title: "WhatsApp should be as accountable as any other channel.",
      subtitle:
        "Businesses were running revenue and support conversations on personal phones, with no record of who promised what and no way to answer a complaint. We build the layer that makes the channel operable — and we hold ourselves to rules about what we claim and how we sell.",
      points: [
        "Prove it, or do not put it on the site",
        "No dark patterns in trial, billing or cancellation",
        "Your data leaves when you ask, with an export",
        "Compliance enforced in the schema, not a policy PDF",
      ],
      primaryCta: { label: "Start free trial", to: "/signup" },
      secondaryCta: { label: "Book a demo", to: "/demo" },
    },
    stats: [
      { value: "2019", label: "Founded", note: "first WhatsApp automation shipped" },
      { value: "6", label: "Countries served", note: "through partners and direct" },
      { value: "0", label: "Dark patterns", note: "no pre-ticked consent, no hidden cancellation" },
      { value: "12 mo", label: "Audit log retention", note: "append-only and exportable on request" },
    ],
    overview: {
      heading: "Why we exist, and what we will not do",
      paragraphs: [
        "WhatsApp is where customers already are, and running it the way most businesses do — personal phones, forwarded screenshots, no record of who said what — fails at ten agents and fails an audit at any size. We exist to keep the channel customers trust while adding the ownership, automation and measurement operations teams need, without asking anyone to abandon their CRM, their branches or their compliance obligations.",
        "That commitment cuts both ways. The standard we hold ourselves to is simple: if we cannot demonstrate a claim in a sandbox or show the screen it comes from, it does not go on this site. No certifications we have not been audited for, no uptime percentage we do not measure and publish, no customer results we cannot attribute with permission.",
        "And the product is not allowed to grow by making things harder to leave. No pre-ticked consent, no cancellation that requires a phone call, no export gated behind a fee, no price that changes at renewal without notice. Those are not features; they are the minimum for a tool your operations depend on.",
      ],
      bullets: [
        "No unverified claims — evidence or it does not appear on the site",
        "No dark patterns — consent unticked by default, cancellation is a button",
        "No hostage data — admins export contacts from the console, and termination includes an export window",
        "No sale of personal data — sharing is limited to sub-processors under a written data processing agreement",
        "No policy documents in place of controls — opt-out and permissions are enforced at send time",
        "No white-labelling or resale outside a written partner agreement",
      ],
    },
    features: [
      {
        icon: "FileText",
        title: "Claims with evidence",
        desc: "Every number and capability we publish has a source behind it — a screen, a document or a measurement we can show. Where evidence does not exist yet, we describe the control instead of the badge.",
      },
      {
        icon: "Percent",
        title: "Billing that does not punish you",
        desc: "Plan-dependent limits are published, cancellation is self-serve, and mid-cycle changes are prorated rather than discussed. A tool that traps customers stops earning them.",
      },
      {
        icon: "Download",
        title: "Data you can take",
        desc: "Workspace admins export contact data directly from the console, and termination starts a defined export window before deletion. Lock-in is a support cost, not a moat.",
      },
      {
        icon: "ShieldCheck",
        title: "Controls, not statements",
        desc: "Opt-out, role scope and retention are enforced at send time and in the schema. A compliance promise that lives only in a document is a promise nobody is enforcing.",
      },
      {
        icon: "Sliders",
        title: "The boring parts are the product",
        desc: "Assignment rules, audit trails, retention windows, per-branch permissions and delivery telemetry are what this company spends its time on.",
      },
    ],
    capabilities: {
      heading: "The standard, day to day",
      items: [
        { icon: "Lock", title: "Append-only audit trail", desc: "Login, assignment, template change, export, deletion and permission change are recorded with actor, timestamp and state — and are exportable to you." },
        { icon: "Layers", title: "Partitioned by design", desc: "Multi-tenant data is partitioned at the row level and branches are a boundary for permissions, not a filter applied on top." },
        { icon: "Terminal", title: "Open by default", desc: "REST endpoints and signed webhooks mean your data and workflows are not trapped behind an interface. The API is not a premium feature." },
        { icon: "Users", title: "Implementation is delivery", desc: "Number migration, template strategy and agent training are part of the engagement, because a platform nobody can operate is not a delivered platform." },
        { icon: "Globe", title: "Local context counts", desc: "Template language, business hours, payment rails and consent expectations differ per market, and the product has to respect that rather than assume one." },
      ],
    },
    faq: [
      {
        q: "What does 'no unverified claims' mean in practice?",
        a: "It means the trust pages describe architecture and controls we operate, and a claim that needs third-party evidence — a certification, an audited uptime figure — only appears once that evidence exists. Until then we show you the control, the log or the export rather than a badge.",
      },
      {
        q: "How do you handle cancellation and offboarding?",
        a: "Cancellation is a self-serve action in billing, not a retention call. After termination there is a defined export window during which admins can pull contact data out, after which deletion follows the retention schedule described in the legal pages.",
      },
      {
        q: "Do you sell or train on customer data?",
        a: "No. Personal data is not sold, and sharing is limited to sub-processors that host or support the platform, each under a written data processing agreement and only to the extent needed to run the service.",
      },
      {
        q: "Who is MADHURA actually for?",
        a: "Multi-location businesses where many people have to speak to customers on one WhatsApp number with a record of it — retail chains, clinics, logistics operators, education providers and brokerages. If one person with one number is your situation, the WhatsApp Business app is probably enough.",
      },
    ],
  },

  /* ── Partners ────────────────────────────────────────────────────────────── */
  {
    path: "/company/partners",
    section: "Company",
    meta: {
      title: "Partner Program — Resellers, Agencies, Technology | Madhura",
      description:
        "The MADHURA partner program for resellers, agencies and technology partners: what partners get, how the relationship works, and how to join.",
    },
    hero: {
      badge: "Company · Partners",
      title: "Partners who implement, resell and build on MADHURA.",
      subtitle:
        "Three tracks: resellers carrying the platform into their market, agencies running it for their clients, and technology partners integrating against the API. Each track has its own commercial terms, its own onboarding and its own support path — agreed in writing before the first customer, never left to interpretation.",
      points: [
        "Reseller track: carry the platform into your market",
        "Agency track: operate MADHURA for your clients",
        "Technology track: integrate against REST and webhooks",
        "A named contact for every partner with live customers",
      ],
      primaryCta: { label: "Apply to partner", to: "/company/partners/apply" },
      secondaryCta: { label: "Book a demo", to: "/demo" },
    },
    stats: [
      { value: "3", label: "Partner tracks", note: "reseller, agency, technology" },
      { value: "3 days", label: "Reply target", note: "same target as the partnerships inbox" },
      { value: "1", label: "Written agreement", note: "per track, signed before any co-selling" },
      { value: "6", label: "Countries served", note: "room for partners in new markets" },
    ],
    overview: {
      heading: "Who the program is for",
      paragraphs: [
        "Resellers sell and own the relationship, carrying MADHURA into markets and verticals we reach indirectly, with commercials agreed up front. Agencies operate the platform for clients — several workspaces, each isolated, with the agency's team doing template strategy, journey design and day-to-day running. Technology partners integrate: an analytics stack, a CRM, an order system or a data warehouse that has to stay in step with conversations.",
        "The relationship works the same way for all three: apply, get reviewed against published criteria, sign the agreement for your track, go through partner onboarding, then take a first customer through scoping with us. Commercial terms are agreed per track and written into the agreement rather than published as a rate card, because delivery scope varies too much for one number to be honest.",
      ],
      bullets: [
        "A sandbox workspace and training seats so your pre-sales team can demonstrate with real workflows",
        "Implementation playbooks: number migration, template strategy, journey design, agent enablement",
        "Deal registration so two partners are not working the same account",
        "A named escalation contact for partners with live customers",
        "Joint scoping on enterprise deals, with an implementation lead from our side",
        "Written terms — margin, billing, support boundaries — before the first referral",
      ],
    },
    features: [
      {
        icon: "Globe",
        title: "Resellers",
        desc: "You sell and hold the customer relationship in your market. We supply the platform, onboarding and escalation; you set the commercials within the agreed framework.",
      },
      {
        icon: "Users",
        title: "Agencies",
        desc: "You run MADHURA for several clients at once. Workspaces stay isolated per client, and your team does the template and journey work under your own retainer.",
      },
      {
        icon: "Terminal",
        title: "Technology partners",
        desc: "You integrate against REST endpoints and signed webhooks — syncing contacts, conversations and events into a CRM, order system or warehouse.",
      },
      {
        icon: "Rocket",
        title: "Partner onboarding",
        desc: "Track-specific: a sandbox workspace, the implementation playbooks, a walkthrough of template and approval workflows, and an introduction to your escalation contact.",
      },
      {
        icon: "MessageSquare",
        title: "Escalation that has a name",
        desc: "Partners with live customers get a named contact rather than a shared queue, because your customer's incident is also your reputation.",
      },
    ],
    capabilities: {
      heading: "What partners get",
      items: [
        { icon: "Terminal", title: "Sandbox for pre-sales", desc: "A workspace configured with test numbers so you can show queues, templates and reports instead of slides." },
        { icon: "FileText", title: "Delivery playbooks", desc: "The same checklists our implementation team uses: connection, verification, import order, template strategy, queue design." },
        { icon: "GitBranch", title: "Deal registration", desc: "Register an opportunity and it is yours for the term — no second partner walking into the account you opened." },
        { icon: "Send", title: "Escalation path", desc: "A named contact and an agreed route for incidents affecting customers you are responsible for." },
        { icon: "Percent", title: "Written commercials", desc: "Margin, billing cycle and support boundaries in the agreement for your track, not in a slide that changes next quarter." },
      ],
    },
    faq: [
      {
        q: "Do we need WhatsApp Business API experience?",
        a: "Not for the reseller or agency tracks — the onboarding covers number connection, template categories, approval flow and consent expectations. The technology track assumes your team is comfortable with REST, webhooks and JSON, because that is what you would be integrating against.",
      },
      {
        q: "What are the commercial terms?",
        a: "They are agreed per track and written into the agreement: margin or referral structure, billing cycle, and where support responsibility sits. We do not publish a rate card, because a single number would not be honest across self-serve deployments and full implementations.",
      },
      {
        q: "Can an agency manage several client workspaces?",
        a: "Yes — the platform is multi-tenant by design, so each client's contacts, numbers, templates and reporting stay partitioned, with your agency staff scoped to the workspaces you administer. That separation is a boundary, not a filter applied on top.",
      },
      {
        q: "How do we start?",
        a: "Apply through the partner application page, or write directly to partners@madhuratech.com with your market, your clients and the track you want. Applications are acknowledged on receipt and answered within three business days.",
      },
    ],
  },

  /* ── Become a partner ────────────────────────────────────────────────────── */
  {
    path: "/company/partners/apply",
    section: "Company",
    meta: {
      title: "Become a Partner — Application & Review | Madhura",
      description:
        "What the partner application asks for, how we review it, what happens next, and where to send it: partners@madhuratech.com.",
    },
    hero: {
      badge: "Company · Become a Partner",
      title: "Apply by email and hear back within three days.",
      subtitle:
        "Write to partners@madhuratech.com with your market, your clients and the track you are applying for. We acknowledge on receipt, review against the criteria published below, and reply with either a scoping call or a clear no and the reason for it.",
      points: [
        "Applications: partners@madhuratech.com",
        "Acknowledged on receipt, replied to in 3 business days",
        "Review criteria published on this page",
        "A person reads it — there is no automated funnel",
      ],
      primaryCta: { label: "Book a demo", to: "/demo" },
      secondaryCta: { label: "Read the program details", to: "/company/partners" },
    },
    stats: [
      { value: "3 days", label: "Reply target", note: "aligned with the partnerships inbox" },
      { value: "4", label: "Review criteria", note: "market fit, delivery, track, standing" },
      { value: "1", label: "Email to apply", note: "partners@madhuratech.com" },
      { value: "3", label: "Tracks", note: "reseller, agency, technology" },
    ],
    overview: {
      heading: "What the application asks for",
      paragraphs: [
        "One email is enough. Include who you are and where you operate, which track you are applying for, who your customers are — industry, size, region — and how you reach them today. Then tell us what WhatsApp work you already do: the tooling you run, roughly what volume you handle, and the first use case you would bring to MADHURA.",
        "After that: an acknowledgement that it arrived, a review against the four criteria below, and then one of two replies. A scoping call with the partner lead, where we agree the track, the terms and the onboarding plan — or a decline with the specific gap named, so you know whether and when to reapply. Nothing is signed and no co-selling starts before the agreement for your track is in place.",
      ],
      bullets: [
        "Company, location, and the track you are applying for",
        "Who you sell to: industry, size, region, and how you acquire them",
        "The WhatsApp work you already do — tooling, volume, first use case",
        "Who on your team would handle an API integration, if you are applying for the technology track",
        "One reference we can contact, or a customer you can name once the agreement is signed",
        "What you want from us in the first twelve months",
      ],
    },
    features: [
      {
        icon: "FileText",
        title: "What to write",
        desc: "One email covering company, market, customers and track. Short is fine — a paragraph on each of the six bullets above is more than enough to review.",
      },
      {
        icon: "Search",
        title: "How we review",
        desc: "Against four criteria: fit between your market and ours, delivery capability for the track, which track it actually is, and your standing with the customers you already have.",
      },
      {
        icon: "CheckCircle2",
        title: "What happens next",
        desc: "Acknowledgement on receipt, review within three business days, then either a scoping call to agree track, terms and onboarding — or a decline with the reason stated.",
      },
      {
        icon: "Filter",
        title: "Why applications get declined",
        desc: "A market we cannot support, no delivery capability where the track requires it, a plan to resell under our brand without an agreement, or consent practices we cannot stand behind.",
      },
      {
        icon: "Send",
        title: "Where to send it",
        desc: "partners@madhuratech.com, with your company name and track in the subject line. If it lands in the wrong inbox, it still gets forwarded — but you will wait for it.",
      },
    ],
    workflow: {
      heading: "What happens after you apply",
      steps: [
        {
          title: "Send the application",
          desc: "One email to partners@madhuratech.com covering the six points above, with your company and track in the subject line.",
        },
        {
          title: "Acknowledgement and completeness check",
          desc: "We confirm it arrived and come back if something material is missing — usually the track, or who your customers are.",
        },
        {
          title: "Review against the criteria",
          desc: "Market fit, delivery capability, track alignment and your standing with existing customers, reviewed by the partner lead.",
        },
        {
          title: "Scoping call, terms, onboarding",
          desc: "If it is a fit: agree the track and commercials, sign, then run partner onboarding with a sandbox and the delivery playbooks before the first customer.",
        },
      ],
    },
    capabilities: {
      heading: "The four review criteria",
      items: [
        { icon: "Globe", title: "Market fit", desc: "Where you operate and who you sell to, against the markets and verticals where we can actually support a partner's customers." },
        { icon: "Users", title: "Delivery capability", desc: "Whether your team can take a customer live — connection, import, template strategy — or whether you are reselling only." },
        { icon: "GitBranch", title: "Track alignment", desc: "Reseller, agency and technology each carry different obligations. A clear track means a clear agreement instead of a compromise nobody wanted." },
        { icon: "Building", title: "Standing and references", desc: "How you treat the customers you already have, evidenced by a reference or work you can show once terms are signed." },
      ],
    },
    faq: [
      {
        q: "What should the subject line be?",
        a: "Company name and track — for example, a reseller application from your market. It reaches the partnerships inbox faster and gets acknowledged in the same working day it arrives.",
      },
      {
        q: "How long does the review take?",
        a: "We reply within three business days, which is the same target the partnerships inbox carries on the contact page. If the review needs something from you, that request comes within the same window rather than after it.",
      },
      {
        q: "Can we apply for more than one track?",
        a: "Say so in the email. Agencies often want a reseller arrangement as well, and technology partners sometimes want to implement — we will tell you which one to start with and whether the second follows later.",
      },
      {
        q: "What if we are declined?",
        a: "You get the specific gap — market, capability, track or consent practice — not a form letter. If the gap is closable, reapply when it is closed; if it is a structural mismatch, we will say that too rather than leave you guessing.",
      },
    ],
  },

  /* ── Customer stories ────────────────────────────────────────────────────── */
  {
    path: "/company/customers",
    section: "Company",
    meta: {
      title: "Customer Stories — Who Runs Madhura | Madhura",
      description:
        "Anonymised profiles of the teams running MADHURA: what they use it for, what they measure, and what we publish with permission.",
    },
    hero: {
      badge: "Company · Customers",
      title: "The teams who run MADHURA every day.",
      subtitle:
        "Profiles here are anonymised: industry, size, geography and the work they run — never a company name, a logo or a quote we did not get in writing. What you get instead is what each type of team uses the platform for, and the signals they choose to measure.",
      points: [
        "Anonymised profiles — no names, logos or quotes",
        "What each type of team runs on the platform",
        "The signals they measure, and why those",
        "Full three-section case studies linked from each profile",
      ],
      primaryCta: { label: "Start free trial", to: "/signup" },
      secondaryCta: { label: "Book a demo", to: "/demo" },
    },
    stats: [
      { value: "40+", label: "Businesses live", note: "across retail, healthcare, logistics" },
      { value: "6", label: "Countries served", note: "through partners and direct" },
      { value: "5", label: "Profile types", note: "retail, real estate, healthcare, logistics, education" },
      { value: "0", label: "Named customers", note: "publishing a name needs written permission" },
    ],
    overview: {
      heading: "Who runs MADHURA",
      paragraphs: [
        "The shape repeats more than the industry does: many people, one or a few numbers, and a conversation that has to reach the right person with a record of it. A forty-outlet specialty retail chain in South India runs branch-scoped queues so a store enquiry reaches that store, and sends festival broadcasts per region. A multi-city real-estate brokerage routes enquiries to the broker who owns the project and automates the follow-up that used to be a spreadsheet.",
        "Clinic groups, logistics operators and education providers arrive for the same reasons with different constraints — consent records that must be answerable, utility templates for status updates, and seasonal spikes where temporary agents join the queue for six weeks. What they measure tends to converge: response time inside business hours, delivery and failure reasons, template quality rating, opt-out rate, and how each branch is performing against the rest.",
      ],
      bullets: [
        "Shared inbox with branch-scoped queues and explicit assignment rules",
        "Template lifecycle: drafts, submission, rejection reasons, quality monitoring",
        "Broadcasts to consented segments, with opt-out honoured at send time",
        "Automations that route, tag and escalate to a human before they guess",
        "Per-branch reporting rolled up for regional and central leadership",
        "REST endpoints and webhooks keeping the CRM and order system in step",
      ],
    },
    features: [
      {
        icon: "Building",
        title: "40-outlet specialty retail chain, South India",
        desc: "Runs branch-scoped queues so store enquiries reach the store, region-wise festival broadcasts, and a per-store report rolled up for the regional team.",
      },
      {
        icon: "Globe",
        title: "Multi-city real-estate brokerage",
        desc: "Routes each enquiry to the broker who owns the project, runs listing and follow-up templates, and hands off to a person when an enquiry goes quiet.",
      },
      {
        icon: "Activity",
        title: "Multi-location healthcare group",
        desc: "Appointment and reminder templates against a strict consent record, with front-desk permissions that stop one branch seeing another's patients.",
      },
      {
        icon: "Clock",
        title: "Regional logistics operator",
        desc: "Status updates sent as utility templates, exception conversations pulled into one shared queue, and routing that behaves differently after hours.",
      },
      {
        icon: "Users",
        title: "Education provider with seasonal intakes",
        desc: "Application and enquiry journeys during intake, temporary agents joining the queue for the season, and per-campaign reporting on replies and opt-outs.",
      },
    ],
    capabilities: {
      heading: "What every profile has in common",
      items: [
        { icon: "Users", title: "Many people, one number", desc: "The shared number is the point: several agents and supervisors on the same conversation history, with ownership visible at a glance." },
        { icon: "Building", title: "Branch boundaries matter", desc: "Permissions, numbers, hours and reporting are scoped per location, then rolled up so leadership sees one picture instead of twelve." },
        { icon: "ShieldCheck", title: "Consent is on record", desc: "Opt-in source and timestamp live with the contact, opt-out is enforced at send time, and the record is what answers a complaint." },
        { icon: "BarChart3", title: "They measure response and delivery", desc: "Response time in business hours, delivery and failure reasons, quality rating and opt-out rate — the signals that explain a week rather than decorate it." },
      ],
    },
    faq: [
      {
        q: "Why are customers not named on this page?",
        a: "Because naming someone is their decision, not ours. Profiles carry industry, size and geography; a name, a logo or a figure appears only with written permission, which is also why the full case studies read the way they do.",
      },
      {
        q: "Can we speak to a customer before we buy?",
        a: "For shortlisted evaluations, yes — arranged case by case with consent on record and under NDA, through the contact page. If there is no reference available in your industry, we will say so rather than substitute one from an unrelated sector.",
      },
      {
        q: "Do you publish performance figures?",
        a: "We publish the signal that moved, how it was measured and the direction, unless the customer approves the number itself. Precise metrics attributed to a customer appear only where permission is documented.",
      },
      {
        q: "Which teams get the most out of the platform?",
        a: "Multi-location operations where several people share customer conversations, consent has to be provable, and someone is accountable for response time. If that is your shape, the case studies describe the pattern you would follow.",
      },
    ],
  },

  /* ── News ────────────────────────────────────────────────────────────────── */
  {
    path: "/news",
    section: "Company",
    meta: {
      title: "News & Updates — Releases and Milestones | Madhura",
      description:
        "MADHURA announcements: product and platform releases, company milestones and press. How to subscribe, and press contact for media enquiries.",
    },
    hero: {
      badge: "Company · News",
      title: "What we ship, change and announce, in one place.",
      subtitle:
        "This page carries product and platform releases, company milestones and press — dated, with what changed and what you should do about it. Subscribe to the release list to get them as they land, or write to press@madhuratech.com for commentary, briefings and assets.",
      points: [
        "Product and platform releases, each with a date",
        "Company milestones when they are material",
        "Subscribe to the release list for updates",
        "Press enquiries: press@madhuratech.com",
      ],
      primaryCta: { label: "Read the changelog", to: "/changelog" },
      secondaryCta: { label: "Contact the team", to: "/company/contact" },
    },
    stats: [
      { value: "4", label: "Announcement types", note: "product, platform, company, press" },
      { value: "1", label: "Source of truth", note: "announced here before anywhere else" },
      { value: "Dated", label: "Every entry", note: "what changed and when it took effect" },
      { value: "0", label: "Speculation", note: "no forward-looking claims we cannot keep" },
    ],
    overview: {
      heading: "What gets announced here",
      paragraphs: [
        "Product announcements cover features that went live and the problem they close, with the version they shipped in. Platform announcements cover anything Meta changes that alters what you should be doing — template categories, API behaviour, policy wording — written with the action attached rather than as a link to someone else's changelog. Company milestones appear when they are material: funding, new markets, leadership changes, the first year of a programme we committed to.",
        "To subscribe, ask to be added to the release list from this page and entries will reach you as they are published; the feed linked here works with any reader. For media, press@madhuratech.com handles commentary, briefings, screenshots and executive interviews — include your outlet, your deadline and the topic, and we reply within three business days.",
      ],
      bullets: [
        "Product: features that went live, the setting they live behind, and what they replace",
        "Platform: Meta policy, API and template changes, with what to change on your side",
        "Company: funding, new markets and leadership — announced here when they happen",
        "Press: coverage we are quoted in, and corrections when we are wrong",
        "Subscribe: ask to join the release list, or follow the feed on this page",
        "Media: press@madhuratech.com with outlet, deadline and topic",
      ],
    },
    features: [
      {
        icon: "Rocket",
        title: "Product releases",
        desc: "What shipped, which release it belongs to, the screen it lives behind and the behaviour it replaces — dated, so you can match it to your own rollout.",
      },
      {
        icon: "ShieldCheck",
        title: "Platform and policy changes",
        desc: "Meta announcements translated into an action: which template category to re-check, which journey to update, which consent field to start capturing.",
      },
      {
        icon: "Building",
        title: "Company milestones",
        desc: "Funding, new markets, leadership and programme milestones, published when they are material and with the detail a customer would actually want.",
      },
      {
        icon: "MessageSquare",
        title: "Press and media",
        desc: "Coverage, comment requests and corrections. press@madhuratech.com — include outlet, deadline and topic, and we reply within three business days.",
      },
      {
        icon: "Send",
        title: "Subscribe",
        desc: "Ask to be added to the release list and entries arrive as they publish; the feed on this page works with any reader if you would rather aggregate.",
      },
    ],
    capabilities: {
      heading: "What an announcement contains",
      items: [
        { icon: "FileText", title: "What changed", desc: "The change described in operational terms — not a codename and not a screenshot with no caption." },
        { icon: "CheckCircle2", title: "What you should do", desc: "Whether it needs action from an admin, a template owner or nobody, and by when if there is a deadline." },
        { icon: "Clock", title: "When it takes effect", desc: "Publish date and effective date, which are not always the same thing when Meta changes platform behaviour." },
        { icon: "Terminal", title: "Where the detail lives", desc: "A pointer to the versioned changelog and the docs page, because this page is the record and those are the reference." },
      ],
    },
    faq: [
      {
        q: "Where do detailed product changes live?",
        a: "In the changelog: versioned entries with dates and deprecation timelines, linked from each product announcement. The news page is the dated record of what went live; the changelog is the reference you search when you are mid-incident.",
      },
      {
        q: "How do I subscribe to announcements?",
        a: "Ask to be added to the release list and we will add the address, or follow the feed linked on this page from any reader. There is no separate newsletter product behind it — the same entries go to both.",
      },
      {
        q: "Who do I contact for press?",
        a: "press@madhuratech.com, with your outlet, your deadline and the topic. That inbox covers commentary, briefings, product screenshots and interviews, and we reply within three business days.",
      },
      {
        q: "Do you announce WhatsApp policy changes?",
        a: "Yes — platform changes are one of the four announcement types, and they are written with the action attached: what to re-check in your templates, which journeys to update, and when Meta's change actually takes effect.",
      },
    ],
  },
];
