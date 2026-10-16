/* Trust Center and security documentation pages --------------------------------
   Content entries keyed by route. `content/index.js` resolves them into the
   route table. Keep the shape stable: path / section / renderer / meta / hero /
   stats / overview / features / workflow / capabilities / faq / cta / related.
   Anything omitted is filled in by content/index.js (meta, cta, related).
   Internal links are always `{ label, to }` — never href/url.
   ------------------------------------------------------------------------------- */

export const TRUST_PAGES = {
  /* ── Trust overview ──────────────────────────────────────────────────────── */
  "/trust": {
    path: "/trust",
    section: "Trust",
    renderer: "standard",
    meta: {
      title: "Trust Center — How Madhura Protects Customer Data | Madhura",
      description:
        "Madhura's trust center: our security philosophy, the shared responsibility model, and the documentation covering data protection, infrastructure, access controls, incidents, disclosure and compliance.",
    },
    hero: {
      badge: "Trust · Overview",
      title: "Trust is a set of controls you can inspect.",
      highlight: "you can inspect",
      subtitle:
        "Security claims are cheap, so this center describes the actual controls — what we operate on the platform, what your workspace owns, and where the line between the two sits.",
      points: [
        "Security philosophy: custodians of data we do not own",
        "Shared responsibility split stated plainly",
        "Documentation for procurement and security review",
        "Disclosure channel with a safe-harbour policy",
      ],
      primaryCta: { label: "Read data protection", to: "/trust/data-protection" },
      secondaryCta: { label: "Request documentation", to: "/trust/compliance" },
    },
    stats: [
      { value: "6", label: "Trust topics", note: "from storage to disclosure" },
      { value: "TLS", label: "In transit", note: "all external traffic" },
      { value: "least", label: "Privilege", note: "default internal access" },
      { value: "1", label: "Security contact", note: "security@madhura.co" },
    ],
    overview: {
      heading: "Custodians, not owners",
      paragraphs: [
        "Customer conversations, contact records and consent evidence belong to the businesses that collected them. Madhura processes them to run the service — inbox, campaigns, automations — and every design decision starts from that position: collect what is needed, keep it only as long as it is useful, restrict who can see it, and make the whole thing exportable or deletable on request.",
        "Security is also a shared job. We operate the platform: hosts, networks, application code, access controls and monitoring. Your workspace owns its own surface: who gets an account, which roles they hold, what your team sends, and whether your own systems protect the API keys they hold. Both halves have to be right, so each sub-page states which side is responsible.",
      ],
      bullets: [
        "Data minimisation — collect only what the workflow needs",
        "Encryption in transit and at rest across the platform",
        "Internal access on least privilege, logged and reviewed",
        "Documented incident handling and notification by agreement",
        "A published policy for reporting vulnerabilities safely",
        "Controls mapped to industry frameworks for procurement",
      ],
    },
    features: [
      {
        icon: "Lock",
        title: "Data protection",
        desc: "Minimisation, encryption in transit and at rest, key handling, retention and deletion, region options and customer-controlled export.",
      },
      {
        icon: "Building",
        title: "Infrastructure",
        desc: "Cloud hosting with segmented networks, redundancy by design, backups with restore testing, and change management on every deploy.",
      },
      {
        icon: "Users",
        title: "Access controls",
        desc: "SSO, MFA, role-based permissions, least privilege for staff, audit logging and scheduled access reviews.",
      },
      {
        icon: "Activity",
        title: "Incident response",
        desc: "Detection, severity triage, escalation, customer communication and a post-incident review with actions that get tracked.",
      },
      {
        icon: "ShieldCheck",
        title: "Responsible disclosure",
        desc: "A published policy for security researchers: scope, contact, expectations, safe harbour and what is out of scope.",
      },
      {
        icon: "FileText",
        title: "Compliance",
        desc: "Control areas mapped to industry frameworks, with security documentation and questionnaire responses available on request.",
      },
    ],
    workflow: {
      heading: "Where responsibility sits",
      steps: [
        {
          title: "We operate the platform",
          desc: "Hosts, network, application, encryption, platform access controls, monitoring and patching — everything below your workspace.",
        },
        {
          title: "Your workspace configures",
          desc: "Roles, queues, retention settings, integrations, template content and which team members may send or export.",
        },
        {
          title: "Your team operates",
          desc: "Consent for the contacts you message, the content you send, and the credentials your own systems keep for API access.",
        },
        {
          title: "We review together",
          desc: "Enterprise reviews cover incidents, open questions and control changes, so the split is re-checked rather than assumed.",
        },
      ],
    },
    capabilities: {
      heading: "How to use this center",
      items: [
        {
          icon: "Search",
          title: "Read by topic",
          desc: "Each sub-page answers one question a security reviewer would ask, with the same structure: what we do, why, and what you control.",
        },
        {
          icon: "Download",
          title: "Request the pack",
          desc: "Security documentation, control summaries and questionnaire responses are available on request for procurement review.",
        },
        {
          icon: "MessageSquare",
          title: "Ask a human",
          desc: "Questions about a specific control go to the team that operates it — start at the contact page and they will be routed correctly.",
        },
        {
          icon: "Terminal",
          title: "Report a vulnerability",
          desc: "Security issues do not belong in the support queue. Send them to security@madhura.co under the disclosure policy.",
        },
        {
          icon: "FileText",
          title: "Legal commitments",
          desc: "The DPA, subprocessor list and data-deletion process sit in the legal pages, where contractual language belongs.",
        },
      ],
    },
    faq: [
      {
        q: "Where should a security researcher report an issue?",
        a: "To security@madhura.co, under the responsible disclosure policy published on this center. Do not open a public issue or a support ticket; the policy sets out scope, what to include, response expectations and the safe-harbour terms that apply.",
      },
      {
        q: "Do you sign a DPA and complete security questionnaires?",
        a: "Yes to both. A data processing agreement is standard for workspaces handling personal data, and enterprise procurement receives the documentation pack with current attestation status stated openly in the response.",
      },
      {
        q: "Who can see our customer conversations inside Madhura?",
        a: "Support and engineering access workspace content only when a case requires it, on a time-boxed, logged and approved basis. Routine work happens on metadata — IDs, delivery states, errors — rather than message bodies.",
      },
      {
        q: "Is customer data segregated between tenants?",
        a: "Workspace boundaries are enforced at the application layer, so records, threads and exports are scoped to your workspace by default. Queries that cross that boundary are deliberate, reviewed and logged.",
      },
      {
        q: "Can we get our data out?",
        a: "Yes. Contacts, tags, custom fields and conversation records export in structured formats from the workspace, and deletion requests run through the documented process. Export and deletion actions are written to the audit log.",
      },
    ],
    cta: {
      title: "Bring your security team to the conversation.",
      sub: "Most reviews start with the documentation pack and a call with the people who run the controls.",
      primary: { label: "Request documentation", to: "/trust/compliance" },
      secondary: { label: "Report an issue", to: "/trust/disclosure" },
    },
    related: [
      "/trust/data-protection",
      "/trust/infrastructure",
      "/trust/access-controls",
      "/trust/incident-response",
      "/trust/disclosure",
      "/trust/compliance",
    ],
  },

  /* ── Data protection ─────────────────────────────────────────────────────── */
  "/trust/data-protection": {
    path: "/trust/data-protection",
    section: "Trust",
    renderer: "standard",
    meta: {
      title: "Data Protection — Encryption, Retention & Deletion | Madhura",
      description:
        "How Madhura protects customer data: minimisation, TLS in transit, encryption at rest, key management, region options, retention and deletion, and customer-controlled export.",
    },
    hero: {
      badge: "Trust · Data protection",
      title: "Data kept because it is used, not because it accumulated.",
      highlight: "because it is used",
      subtitle:
        "Minimisation first, then encryption in transit and at rest, controlled keys, defined retention, and an export path that means the data was never held hostage.",
      points: [
        "Collection limited to what a workflow actually needs",
        "TLS on every external hop, encryption at rest",
        "Region options and documented retention schedules",
        "Export and deletion driven by the customer",
      ],
      primaryCta: { label: "See infrastructure", to: "/trust/infrastructure" },
      secondaryCta: { label: "Read the DPA", to: "/legal/dpa" },
    },
    stats: [
      { value: "TLS", label: "In transit", note: "external traffic encrypted" },
      { value: "AES-class", label: "At rest", note: "storage-level encryption" },
      { value: "30d+", label: "Retention options", note: "configured per workspace" },
      { value: "1-click", label: "Export", note: "structured, customer-run" },
    ],
    overview: {
      heading: "Four questions about every field we store",
      paragraphs: [
        "Was it needed, is it protected, how long does it live, and who can get it out. Those four questions run through contact records, message bodies, media, consent evidence and analytics events alike — and if a field cannot answer them, it does not get collected or it gets deleted from the schema.",
        "Protection is layered: TLS on external hops so nothing crosses the public internet in clear text, encryption at rest on storage volumes and databases, and keys managed by the provider's key service rather than sitting in configuration files. Retention is a workspace setting with documented defaults, and export is a self-serve action rather than a support request.",
      ],
      bullets: [
        "Collect only fields a workflow or report consumes",
        "TLS enforced externally, encrypted volumes internally",
        "Keys held in managed key storage, rotated on schedule",
        "Retention schedules with legal hold where required",
        "Region options for workspaces with residency needs",
        "Export before deletion, so nothing is lost in the move",
      ],
    },
    features: [
      {
        icon: "Filter",
        title: "Data minimisation",
        desc: "Custom fields, tags and events exist because something reads them. Unused collection points are removed rather than quietly retained.",
      },
      {
        icon: "Lock",
        title: "Encryption in transit",
        desc: "All external traffic — browser, API, webhooks to your endpoints — travels over TLS, with modern configuration and no clear-text fallback.",
      },
      {
        icon: "ShieldCheck",
        title: "Encryption at rest",
        desc: "Storage volumes, databases and backups are encrypted at rest using provider-managed encryption, independent of application code.",
      },
      {
        icon: "Terminal",
        title: "Key management",
        desc: "Keys live in managed key storage with rotation, not in environment files. Application servers receive short-lived credentials to use them.",
      },
      {
        icon: "Clock",
        title: "Retention & deletion",
        desc: "Each workspace sets how long messages, media and analytics events are kept, with scheduled deletion and legal hold where an obligation requires it.",
      },
      {
        icon: "Download",
        title: "Customer-controlled export",
        desc: "Contacts, fields, tags and conversation history export in structured formats at any time — before a migration, an audit, or a deletion request.",
      },
    ],
    workflow: {
      heading: "The life of a record",
      steps: [
        {
          title: "Collect",
          desc: "A contact, message or event enters through a form, an inbound message or your API, and is stored against your workspace boundary.",
        },
        {
          title: "Use",
          desc: "It is read by the inbox, campaigns, automations and reports — each access scoped to the workspace and recorded where it matters.",
        },
        {
          title: "Retain",
          desc: "It stays for the window your workspace configured, or until a deletion request or scheduled cleanup removes it.",
        },
        {
          title: "Delete or hand back",
          desc: "Export first if you want a copy, then deletion runs through the documented process, including backups on their next rotation.",
        },
      ],
    },
    capabilities: {
      heading: "Residency, retention and control",
      items: [
        {
          icon: "Globe",
          title: "Region options",
          desc: "Workspaces with residency requirements can select a hosting region where available; commitments are written into the agreement, not offered verbally.",
        },
        {
          icon: "FileText",
          title: "Documented retention",
          desc: "Defaults and configurable windows for messages, media and analytics are documented, so retention can be defended in an audit.",
        },
        {
          icon: "Users",
          title: "End-customer rights",
          desc: "Deletion and access requests for end-customer data run through the documented process on the legal pages, with confirmation returned.",
        },
        {
          icon: "Layers",
          title: "Backups",
          desc: "Backups are encrypted like primary storage, retained for a defined window, and excluded from ad-hoc access — restores are a controlled operation.",
        },
        {
          icon: "Activity",
          title: "Audit on exits",
          desc: "Exports, deletions and configuration changes to retention are written to the audit log with actor and timestamp.",
        },
      ],
    },
    faq: [
      {
        q: "What personal data does the platform store?",
        a: "Whatever your workflows send: contact identifiers such as phone number and name, the message content and media your teams exchange, consent and opt-out state, plus custom fields you choose to populate. Storage follows collection — nothing is added by default that your workflows never write.",
      },
      {
        q: "How is data protected in transit and at rest?",
        a: "External traffic travels over TLS, with no clear-text fallback on public endpoints. Storage volumes, databases and backups are encrypted at rest through managed keys held outside application configuration.",
      },
      {
        q: "Can we choose where data is hosted?",
        a: "Region options exist for workspaces with residency requirements and are confirmed as part of the agreement. Where an option is not available for a region, we say so before signature rather than after onboarding.",
      },
      {
        q: "How do retention and deletion work?",
        a: "Your workspace sets retention windows for messages, media and analytics; scheduled deletion enforces them. Deletion requests — workspace or end-customer — follow the documented process, including removal from backups on their next rotation.",
      },
      {
        q: "Can we export everything before we leave?",
        a: "Yes, and you do not need permission to ask. Contacts, fields, tags and conversation records export in structured formats from the workspace, and every export is written to the audit log with your identity attached.",
      },
    ],
    cta: {
      title: "Put the data questions in writing.",
      sub: "The DPA and subprocessor list carry the commitments; this page explains the mechanics behind them.",
      primary: { label: "Read the DPA", to: "/legal/dpa" },
      secondary: { label: "See subprocessors", to: "/legal/subprocessors" },
    },
    related: ["/trust", "/trust/infrastructure", "/trust/compliance"],
  },

  /* ── Infrastructure ──────────────────────────────────────────────────────── */
  "/trust/infrastructure": {
    path: "/trust/infrastructure",
    section: "Trust",
    renderer: "standard",
    meta: {
      title: "Infrastructure — Hosting, Redundancy, Backups & Change | Madhura",
      description:
        "Where Madhura runs and how it stays up: managed cloud hosting, network segmentation, redundancy by design, backup and disaster recovery, and change management on every deploy.",
    },
    hero: {
      badge: "Trust · Infrastructure",
      title: "Boring infrastructure on purpose.",
      highlight: "on purpose",
      subtitle:
        "Managed cloud, segmented networks, redundancy where failure actually happens, tested restores and a change process that refuses to let a Friday deploy go unreviewed.",
      points: [
        "Managed cloud hosting across isolated environments",
        "Network segmentation between tiers and tenants",
        "Redundancy designed around real failure modes",
        "Backups, restore tests and reviewed changes",
      ],
      primaryCta: { label: "See access controls", to: "/trust/access-controls" },
      secondaryCta: { label: "Check system status", to: "/status" },
    },
    stats: [
      { value: "cloud", label: "Hosting", note: "managed, multi-zone" },
      { value: "3", label: "Backup layers", note: "volume, database, snapshot" },
      { value: "tested", label: "Restores", note: "drills, not assumptions" },
      { value: "peer", label: "Change review", note: "every deploy has one" },
    ],
    overview: {
      heading: "Designed for the failure you have actually seen",
      paragraphs: [
        "Madhura runs on managed cloud infrastructure: stateless application nodes behind load balancers, managed databases with replication, and object storage for media, spread across availability zones so a single zone failing does not take messaging with it. Environments are separated — production, staging and the tooling that reaches them — so a test never touches customer traffic.",
        "Availability comes from redundancy plus the boring work around it: backups taken at more than one layer, restores rehearsed rather than assumed, health checks that replace unhealthy nodes automatically, and capacity watched against growth instead of after it. Changes are the biggest cause of self-inflicted outages, so every deploy is peer-reviewed, tested and reversible.",
      ],
      bullets: [
        "Managed cloud with multi-zone deployment",
        "Application, database and media tiers separated",
        "Automated health checks and replacement of nodes",
        "Backups at several layers with scheduled restore tests",
        "Peer review and staged rollout on every change",
        "Capacity reviewed against volume trends each cycle",
      ],
    },
    features: [
      {
        icon: "Building",
        title: "Managed cloud",
        desc: "Compute, databases, storage and networking from a major provider, so undifferentiated maintenance is their problem, not a latent risk in ours.",
      },
      {
        icon: "Layers",
        title: "Network segmentation",
        desc: "Application, data and management tiers sit in separate network scopes; not every service can talk to every other service by default.",
      },
      {
        icon: "Activity",
        title: "Redundancy by design",
        desc: "Stateless nodes, load balancing and replicated data stores mean losing one instance is a non-event rather than an incident.",
      },
      {
        icon: "Download",
        title: "Backups",
        desc: "Database snapshots, volume backups and media replication run on independent schedules, encrypted at rest like the data they mirror.",
      },
      {
        icon: "RefreshCw",
        title: "Disaster recovery",
        desc: "Restore procedures are documented and rehearsed, so recovery time is a tested number for your agreement rather than a hopeful estimate.",
      },
      {
        icon: "GitBranch",
        title: "Change management",
        desc: "Peer-reviewed changes, automated tests, staged rollout and a fast, documented rollback path — no direct edits to production.",
      },
    ],
    workflow: {
      heading: "How a change reaches production",
      steps: [
        {
          title: "Plan",
          desc: "The change is described with its scope, risk and rollback path before anyone writes code, so surprises surface early.",
        },
        {
          title: "Review & test",
          desc: "A second engineer reviews the diff and automated tests run against a staging environment configured like production.",
        },
        {
          title: "Release",
          desc: "The change ships staged rather than all at once, with health signals and error rates watched through the rollout window.",
        },
        {
          title: "Verify or roll back",
          desc: "Signals confirm the change, or it is rolled back immediately using the path defined in step one. Both outcomes are recorded.",
        },
      ],
    },
    capabilities: {
      heading: "Operational hygiene",
      items: [
        {
          icon: "ShieldCheck",
          title: "Secrets management",
          desc: "Credentials and API keys live in managed secret storage with rotation — never in source control or long-lived config files.",
        },
        {
          icon: "Terminal",
          title: "Monitoring & alerting",
          desc: "Health, error rates, queue depth and delivery failures are monitored continuously, with alerting that reaches the on-call engineer.",
        },
        {
          icon: "Search",
          title: "Environment separation",
          desc: "Staging and tooling environments are isolated from production data, so testing never needs real customer conversations to be realistic.",
        },
        {
          icon: "Clock",
          title: "Patching cadence",
          desc: "Runtime and dependency updates follow a scheduled cycle, with urgent security patches fast-tracked through the same reviewed path.",
        },
        {
          icon: "BarChart3",
          title: "Capacity planning",
          desc: "Volume trends are reviewed against headroom, so growth in sends and message volume arrives as a plan rather than a throttle.",
        },
      ],
    },
    faq: [
      {
        q: "Where is the platform hosted?",
        a: "On managed cloud infrastructure in the provider's data centres, with region options for workspaces that have residency requirements. The exact topology, provider and backup scheme are covered in the documentation pack for procurement review.",
      },
      {
        q: "What happens if an availability zone fails?",
        a: "Application nodes and data services are distributed so that one zone failing degrades capacity rather than service; traffic shifts to what remains while instances are replaced. The status page would carry the incident and its timeline.",
      },
      {
        q: "How often are backups taken and have they been tested?",
        a: "Backups run on independent schedules across databases, volumes and media. Restores are rehearsed on a documented cadence — a backup nobody has restored is a hypothesis, not a recovery plan.",
      },
      {
        q: "How do you handle risky changes?",
        a: "Every change is peer-reviewed, tested against staging, released in stages and paired with a defined rollback path. Direct edits to production are not part of the process, and rollbacks are recorded like any other change.",
      },
      {
        q: "Do you run penetration tests?",
        a: "Independent security testing is part of the review cycle for the platform and its application. The current testing status and summary of findings are shared under NDA as part of the security documentation pack — ask for current status rather than relying on a claim here.",
      },
    ],
    cta: {
      title: "Ask the infrastructure questions directly.",
      sub: "Topology, backup scheme and recovery procedures are documented for your security review.",
      primary: { label: "Request documentation", to: "/trust/compliance" },
      secondary: { label: "See data protection", to: "/trust/data-protection" },
    },
    related: ["/trust", "/trust/data-protection", "/trust/access-controls"],
  },

  /* ── Access controls ─────────────────────────────────────────────────────── */
  "/trust/access-controls": {
    path: "/trust/access-controls",
    section: "Trust",
    renderer: "standard",
    meta: {
      title: "Access Controls — SSO, MFA, RBAC & Audit Logging | Madhura",
      description:
        "How access to Madhura systems and customer workspaces is controlled: SSO and MFA, role-based permissions, least privilege, audit logging, access reviews and joiner-mover-leaver handling.",
    },
    hero: {
      badge: "Trust · Access controls",
      title: "Nobody gets access by default — including us.",
      highlight: "including us",
      subtitle:
        "Staff access follows least privilege and expires; customer workspaces get SSO, MFA and role-based permissions; everything meaningful is written to an audit log somebody reads.",
      points: [
        "SSO and MFA for workspace accounts",
        "Role-based permissions down to individual actions",
        "Time-boxed, approved access for support cases",
        "Quarterly reviews of every standing grant",
      ],
      primaryCta: { label: "See incident response", to: "/trust/incident-response" },
      secondaryCta: { label: "Read access in the docs", to: "/docs" },
    },
    stats: [
      { value: "SSO", label: "Authentication", note: "with MFA enforced" },
      { value: "RBAC", label: "Authorisation", note: "per role, per action" },
      { value: "quarterly", label: "Access reviews", note: "every standing grant" },
      { value: "logged", label: "Privileged actions", note: "actor, time, target" },
    ],
    overview: {
      heading: "Access is granted, scoped and expires",
      paragraphs: [
        "The default for any system that holds other people's conversations is that nobody can see them. Access at Madhura is granted explicitly, scoped to the smallest set of privileges that does the job, and reviewed on a schedule — standing access to production data is the exception that must justify itself, not the norm that goes unexamined.",
        "Inside a workspace, the same principle applies to your team. Accounts authenticate through single sign-on with multi-factor authentication, and roles decide what each person may do: reply, assign, export, delete, manage numbers or change automations. Because permissions are per action rather than per page, a supervisor can coach without inheriting an administrator's keys.",
      ],
      bullets: [
        "SSO with enforced MFA for workspace sign-in",
        "Roles defined by action: read, reply, assign, export, admin",
        "Staff access requested per case, approved and time-boxed",
        "Audit log entries carry actor, target and timestamp",
        "Quarterly review removes access nobody can justify",
        "Joiners, movers and leavers follow a fixed checklist",
      ],
    },
    features: [
      {
        icon: "Lock",
        title: "Single sign-on",
        desc: "Workspace members authenticate through your identity provider, so account lifecycle and password policy stay in the system you already govern.",
      },
      {
        icon: "ShieldCheck",
        title: "Multi-factor authentication",
        desc: "MFA is enforced for workspace accounts and for every Madhura internal system that can reach customer data.",
      },
      {
        icon: "Users",
        title: "Role-based permissions",
        desc: "Roles map to actions — send, assign, export, delete, administer — per workspace and branch, so authority follows the job rather than seniority.",
      },
      {
        icon: "Filter",
        title: "Least privilege",
        desc: "Staff receive the minimum access their role requires, for the shortest time it is needed. Broad standing access to customer content is not a convenience we allow.",
      },
      {
        icon: "Terminal",
        title: "Audit logging",
        desc: "Logins, permission changes, exports, deletions and privileged access are recorded with actor and timestamp, and retained for review.",
      },
      {
        icon: "RefreshCw",
        title: "Quarterly access reviews",
        desc: "Every standing grant is re-justified each quarter by its owner. Access whose justification disappeared disappears with it.",
      },
    ],
    workflow: {
      heading: "Joiner, mover, leaver",
      steps: [
        {
          title: "Join",
          desc: "Accounts are created against a role with least privilege, MFA is enforced, and system access is granted from a checklist rather than by request.",
        },
        {
          title: "Move",
          desc: "A change of role triggers a review of both directions: privileges added for the new job and privileges removed from the old one.",
        },
        {
          title: "Just-in-time access",
          desc: "When a task needs more, access is requested with a reason, approved, scoped to a window, and revoked automatically at its end.",
        },
        {
          title: "Leave",
          desc: "Accounts and tokens are revoked on the last day through the same checklist, followed by a confirmation that no credentials survive.",
        },
      ],
    },
    capabilities: {
      heading: "Controls inside your workspace",
      items: [
        {
          icon: "Inbox",
          title: "Per-action permissions",
          desc: "Decide who may export contact data, who may delete threads, who may message outside business hours — enforced, not documented as policy.",
        },
        {
          icon: "Building",
          title: "Branch scoping",
          desc: "Branch managers see and act only on their branch, while leadership sees the consolidated view — one permission model across both.",
        },
        {
          icon: "Activity",
          title: "Session controls",
          desc: "Sessions expire, re-authentication is required for sensitive actions, and revoking a member's access takes effect immediately.",
        },
        {
          icon: "Search",
          title: "Log visibility",
          desc: "Administrators can review workspace activity — who replied, reassigned, exported or changed a setting — without asking us for a report.",
        },
        {
          icon: "FileText",
          title: "Review evidence",
          desc: "Audit entries export for internal review, so your own compliance team can sample privileged actions on its own schedule.",
        },
      ],
    },
    faq: [
      {
        q: "Can we enforce SSO and MFA for our team?",
        a: "Yes. Workspace members can authenticate through your identity provider, which lets you enforce MFA, password policy and deprovisioning where your team already works. Local accounts can be restricted once SSO is in place.",
      },
      {
        q: "What can an agent see versus an administrator?",
        a: "An agent sees the threads assigned to them and the fields needed to answer. An administrator manages numbers, roles, templates and automations. Export and delete are separate permissions again, because they are the actions with the longest reach.",
      },
      {
        q: "Can Madhura staff read our conversations?",
        a: "Only through a time-boxed, approved and logged access path tied to an open support case, and only for the specific workspace you approve. Routine engineering work uses metadata — identifiers, delivery states, errors — rather than message content.",
      },
      {
        q: "How often is internal access reviewed?",
        a: "Standing access is reviewed quarterly by its owner, and immediately on any role change. Access whose business justification no longer exists is removed in the review rather than carried forward because it is convenient.",
      },
      {
        q: "What is recorded in the audit log?",
        a: "Authentication events, permission and role changes, exports, deletions, template approvals and privileged access to customer content — each with actor, target and timestamp, exportable for your own sampling.",
      },
    ],
    cta: {
      title: "Review access like it matters.",
      sub: "Roles, exports and privileged actions are the controls your auditors will ask about first.",
      primary: { label: "Request documentation", to: "/trust/compliance" },
      secondary: { label: "See incident response", to: "/trust/incident-response" },
    },
    related: ["/trust", "/trust/infrastructure", "/trust/incident-response"],
  },

  /* ── Incident response ───────────────────────────────────────────────────── */
  "/trust/incident-response": {
    path: "/trust/incident-response",
    section: "Trust",
    renderer: "standard",
    meta: {
      title: "Incident Response — Detection, Escalation & Notification | Madhura",
      description:
        "How Madhura handles incidents: detection and triage by severity, escalation to on-call, customer communication on the status page, post-incident review and notification per the DPA.",
    },
    hero: {
      badge: "Trust · Incident response",
      title: "A process you can audit before you need it.",
      highlight: "before you need it",
      subtitle:
        "Detection, severity triage, escalation, communication and post-incident review — defined in advance, published here, and measured afterwards against how the incident actually ran.",
      points: [
        "Monitoring and reports feed one triage path",
        "Severity drives escalation and communication cadence",
        "Customers informed through status page, email and webhook",
        "Post-incident review with tracked corrective actions",
      ],
      primaryCta: { label: "See how we communicate", to: "/status" },
      secondaryCta: { label: "Report a vulnerability", to: "/trust/disclosure" },
    },
    stats: [
      { value: "24/7", label: "On-call", note: "for critical incidents" },
      { value: "4", label: "Severity levels", note: "set at triage" },
      { value: "3", label: "Comms channels", note: "page, email, webhook" },
      { value: "1", label: "Review per incident", note: "actions tracked to done" },
    ],
    overview: {
      heading: "Handled the same way every time",
      paragraphs: [
        "An incident is any unplanned disruption or degradation of the service — messaging delayed, automations stalled, webhooks failing, a dashboard unavailable. They are detected by monitoring or by customer report, confirmed by an engineer, then triaged to a severity that decides who is paged, how often updates are published and who is told.",
        "Communication is part of the response, not a courtesy added afterwards. The status page is updated first, subscribers are notified when components change state, and customers affected by a security-relevant incident are informed as required by the data processing agreement and the terms that govern your account. Once resolved, every incident gets a written review with corrective actions assigned to owners.",
      ],
      bullets: [
        "Monitoring alerts and customer reports share one path",
        "Severity assigned at triage, revised as facts change",
        "On-call escalation for critical incidents, day or night",
        "Status page, subscriber email and signed webhook updates",
        "Notification of security incidents per the DPA",
        "Post-incident review with dated, owned actions",
      ],
    },
    features: [
      {
        icon: "Activity",
        title: "Detection",
        desc: "Monitoring on health, error rates, queue depth and delivery failures, combined with inbound reports — whichever arrives first opens the path.",
      },
      {
        icon: "Filter",
        title: "Triage & severity",
        desc: "An engineer confirms the signal, sets severity from customer impact, and records what is known so later updates build on a baseline.",
      },
      {
        icon: "Zap",
        title: "Escalation",
        desc: "Severity determines who is paged and how quickly: critical incidents escalate to on-call immediately rather than waiting for business hours.",
      },
      {
        icon: "MessageCircle",
        title: "Customer communication",
        desc: "Updates land on the status page first, then to subscribers and via webhook, with scope, impact and what customers should do meanwhile.",
      },
      {
        icon: "FileText",
        title: "Post-incident review",
        desc: "A written timeline, contributing factors and corrective actions — reviewed with the team that lived through it, not written to close a ticket.",
      },
      {
        icon: "CheckCircle2",
        title: "Notification commitments",
        desc: "Security-relevant incidents affecting your data are communicated in line with your DPA and agreement, which state the obligations on both sides.",
      },
    ],
    workflow: {
      heading: "The incident lifecycle",
      steps: [
        {
          title: "Detect & declare",
          desc: "Monitoring or a report is confirmed, an incident is declared with an initial severity, and an incident lead takes ownership.",
        },
        {
          title: "Contain & diagnose",
          desc: "The team reduces blast radius first, then diagnoses — stopping the bleeding matters more than a perfect explanation.",
        },
        {
          title: "Communicate",
          desc: "Status page updated, subscribers notified, affected customers informed, and updates published on the cadence the severity sets.",
        },
        {
          title: "Review & improve",
          desc: "A post-incident review produces actions with owners and dates, and those actions are tracked until they are closed.",
        },
      ],
    },
    capabilities: {
      heading: "What customers can expect",
      items: [
        {
          icon: "Search",
          title: "Severity you can see",
          desc: "Incident updates state which components are affected and how, rather than a vague assurance that everything is being looked at.",
        },
        {
          icon: "Clock",
          title: "A steady update rhythm",
          desc: "While an incident is live, updates arrive at a consistent cadence — including updates that say the state has not changed yet.",
        },
        {
          icon: "GitBranch",
          title: "Link, don't duplicate",
          desc: "Support tickets touching an open incident are linked to it, so one update reaches everyone waiting instead of being repeated per case.",
        },
        {
          icon: "Download",
          title: "History stays published",
          desc: "Resolved incidents remain on the status page with their timelines, so the record can be examined later rather than taken on trust.",
        },
        {
          icon: "RefreshCw",
          title: "Actions that close",
          desc: "Corrective actions from a review are owned and dated; open actions are visible internally until the work is actually done.",
        },
      ],
    },
    faq: [
      {
        q: "How will we be told about a security incident?",
        a: "As required by the data processing agreement and the terms governing your account — the obligations and timing for both sides are written there rather than summarised into a number on this page. Alongside that, the status page and subscriber notifications carry operational updates throughout.",
      },
      {
        q: "What counts as an incident?",
        a: "Any unplanned disruption or material degradation: messaging delayed or failing, automations stalled, webhooks erroring, or a dashboard unavailable. Internal issues caught before customers are affected are still reviewed, but are not published as customer-facing incidents.",
      },
      {
        q: "Who responds, and when?",
        a: "An on-call rota covers critical incidents around the clock, with an incident lead taking ownership of coordination and communication. Lower severities are handled in working hours by the owning team without a page.",
      },
      {
        q: "How do we follow an incident while it is live?",
        a: "Subscribe to the status page by component or to the webhook feed. Updates are published there first, with scope, impact and mitigation in progress; support tickets are linked to the incident rather than answered separately.",
      },
      {
        q: "What happens after it is resolved?",
        a: "The incident is closed on the status page with a timeline, and a post-incident review produces corrective actions with owners and dates. The summary stays published so customers can see both what happened and what changed because of it.",
      },
    ],
    cta: {
      title: "Read the process before the outage.",
      sub: "Severity, escalation and notification are easier to trust when you have already seen them written down.",
      primary: { label: "Check system status", to: "/status" },
      secondary: { label: "Read the DPA", to: "/legal/dpa" },
    },
    related: ["/status", "/trust", "/trust/access-controls"],
  },

  /* ── Responsible disclosure ──────────────────────────────────────────────── */
  "/trust/disclosure": {
    path: "/trust/disclosure",
    section: "Trust",
    renderer: "standard",
    meta: {
      title: "Responsible Disclosure — Report a Vulnerability | Madhura",
      description:
        "Madhura's responsible vulnerability disclosure policy: scope, how to report to security@madhura.co, what to include, response expectations, safe harbour and out-of-scope items.",
    },
    hero: {
      badge: "Trust · Disclosure",
      title: "Found something? Tell us before anyone else does.",
      highlight: "before anyone else does",
      subtitle:
        "A written policy so you know what happens after you report: where it goes, what to include, when you will hear back, and the safe-harbour terms that apply to good-faith research.",
      points: [
        "Report to security@madhura.co — one address, one team",
        "Scope covering the platform and its public endpoints",
        "Acknowledgement and updates on a stated cadence",
        "Safe harbour for good-faith, non-destructive research",
      ],
      primaryCta: { label: "Email security", to: "/company/contact" },
      secondaryCta: { label: "How we handle incidents", to: "/trust/incident-response" },
    },
    stats: [
      { value: "1", label: "Reporting address", note: "security@madhura.co" },
      { value: "24h", label: "Acknowledgement", note: "reports acknowledged" },
      { value: "good-faith", label: "Safe harbour", note: "within policy scope" },
      { value: "0", label: "Legal risk", note: "for following the policy" },
    ],
    overview: {
      heading: "Coordinated beats public",
      paragraphs: [
        "A vulnerability disclosed quietly gives us a chance to fix it before anyone is harmed; the same finding published first does the opposite. This policy defines the terms of that trade: what is in scope, how to reach us, what a useful report contains, when you will hear back, and how disclosure is timed once a fix exists.",
        "Good-faith research that follows this policy is welcome and will not attract legal action. Research that goes outside it — accessing other customers' data, degrading the service, social engineering staff, or holding findings for ransom — is not, because that crosses from testing into harm.",
      ],
      bullets: [
        "Report to security@madhura.co, not the support queue",
        "Include steps, impact, affected endpoint and evidence",
        "Acknowledgement on receipt, updates while open",
        "Fix agreed before any public disclosure is scheduled",
        "Credit offered if you want it named in the summary",
        "Out-of-scope items listed so nobody wastes time",
      ],
    },
    features: [
      {
        icon: "Globe",
        title: "Scope",
        desc: "Madhura-hosted web application, public APIs, webhooks and the workspace login surface. Findings in those areas are in scope for this policy.",
      },
      {
        icon: "Send",
        title: "How to report",
        desc: "Email security@madhura.co with the finding. Do not open a public issue, a support ticket or a feature request — those routes are slower and less private.",
      },
      {
        icon: "FileText",
        title: "What to include",
        desc: "Affected endpoint or component, reproduction steps, impact, evidence such as a request and response, and any prerequisite configuration you used.",
      },
      {
        icon: "Clock",
        title: "Response expectations",
        desc: "Reports are acknowledged quickly, triaged for severity, and updated while work continues — including a realistic fix window once confirmed.",
      },
      {
        icon: "ShieldCheck",
        title: "Safe harbour",
        desc: "Good-faith research within this policy, without data access or service degradation, will not trigger legal action from us.",
      },
      {
        icon: "Filter",
        title: "Out of scope",
        desc: "Denial of service, spam, physical attacks, social engineering of staff, and findings that only exist because of another customer's configuration.",
      },
    ],
    workflow: {
      heading: "What happens after you report",
      steps: [
        {
          title: "Acknowledge",
          desc: "You receive confirmation that the report arrived and who is handling it, so the conversation has a named counterpart.",
        },
        {
          title: "Triage",
          desc: "The finding is reproduced, scored for impact and scope, and either confirmed as valid or closed with the reasoning explained.",
        },
        {
          title: "Fix & verify",
          desc: "A remediation is built, deployed through the normal change process, and verified — with you re-testing where that is practical.",
        },
        {
          title: "Disclose",
          desc: "We agree a disclosure window, publish or credit as you prefer, and record the finding in the post-incident history.",
        },
      ],
    },
    capabilities: {
      heading: "What makes a report useful",
      items: [
        {
          icon: "Search",
          title: "Reproduction steps",
          desc: "The exact sequence, from a clean session to the observed result, with the request and response captured rather than described from memory.",
        },
        {
          icon: "Activity",
          title: "Demonstrated impact",
          desc: "What the flaw enables — reading another tenant's data, bypassing a permission, forging a webhook — stated in terms of consequence.",
        },
        {
          icon: "Terminal",
          title: "Affected surface",
          desc: "Endpoint, parameter, component and environment, plus whether authentication was required, so triage can start at the right layer.",
        },
        {
          icon: "Filter",
          title: "Realistic limits",
          desc: "Testing performed without mass data extraction, service degradation or persistence beyond proof of the specific finding.",
        },
        {
          icon: "Award",
          title: "Credit, if you want it",
          desc: "Researchers who wish to be named are acknowledged in the disclosure summary; anonymous reports are handled exactly the same way.",
        },
      ],
    },
    faq: [
      {
        q: "Where do I send a vulnerability report?",
        a: "To security@madhura.co. That address reaches the team that triages and fixes security issues; support tickets and public forums do not, and routing it there would only slow the fix and reduce your privacy.",
      },
      {
        q: "What should the report contain?",
        a: "The affected endpoint or component, steps to reproduce, the impact you observed, evidence such as a request and response pair, and any prerequisites. A clear report is usually confirmed much faster than a bare assertion.",
      },
      {
        q: "When will I hear back?",
        a: "Reports are acknowledged on receipt and triaged promptly, then updated while remediation continues — including an honest fix window once the finding is confirmed. If we need more detail, you will get one consolidated question rather than a drip of them.",
      },
      {
        q: "What does the safe-harbour cover?",
        a: "Good-faith research conducted within this policy — no data access beyond proof, no service degradation, no extortion, and reports sent privately first. Follow that and we will not pursue legal action for the research itself.",
      },
      {
        q: "What is explicitly out of scope?",
        a: "Denial-of-service and load testing against production, spam and phishing, physical attacks, social engineering of employees or customers, and vulnerabilities that exist only in another customer's own configuration or integrations.",
      },
    ],
    cta: {
      title: "Report it privately, fix it together.",
      sub: "One address, a written policy, and a team that answers instead of arguing about scope.",
      primary: { label: "Email security", to: "/company/contact" },
      secondary: { label: "See our incident process", to: "/trust/incident-response" },
    },
    related: ["/trust", "/trust/incident-response", "/trust/compliance"],
  },

  /* ── Compliance ───────────────────────────────────────────────────────────── */
  "/trust/compliance": {
    path: "/trust/compliance",
    section: "Trust",
    renderer: "standard",
    meta: {
      title: "Compliance — Controls, Frameworks & Security Documentation | Madhura",
      description:
        "Madhura's compliance posture stated honestly: control areas mapped to industry frameworks, how to request security documentation, and how to complete a security questionnaire.",
    },
    hero: {
      badge: "Trust · Compliance",
      title: "Controls first, evidence on request.",
      highlight: "evidence on request",
      subtitle:
        "Rather than wave a badge, we describe the control areas we operate, how they map to recognised frameworks, and how your team gets the documentation and current attestation status for review.",
      points: [
        "Control areas mapped to industry frameworks",
        "Access, change, incident and vendor management covered",
        "Documentation pack for procurement and review",
        "Questionnaire responses from the team that runs the controls",
      ],
      primaryCta: { label: "Request the pack", to: "/company/contact" },
      secondaryCta: { label: "Read the DPA", to: "/legal/dpa" },
    },
    stats: [
      { value: "4", label: "Control areas", note: "operated and documented" },
      { value: "mapped", label: "Frameworks", note: "controls cross-referenced" },
      { value: "1", label: "Request route", note: "one contact, one pack" },
      { value: "current", label: "Attestation status", note: "stated on request" },
    ],
    overview: {
      heading: "What compliance means here",
      paragraphs: [
        "For a platform carrying customer conversations, compliance is not a logo — it is whether the controls a framework asks for actually exist, are operated, and can be evidenced when someone reviews them. Madhura maps its control areas to recognised frameworks so that a reviewer can translate what we do into the language their checklist uses.",
        "Current attestation status, summaries of independent reviews and completed questionnaires are shared directly with your team as part of the security documentation process. Ask for what you need with your review in mind, and you will get the current position rather than a claim taken out of context from a marketing page.",
      ],
      bullets: [
        "Access control: SSO, MFA, least privilege, reviews",
        "Change management: peer review, tests, staged rollout",
        "Incident management: triage, escalation, review",
        "Vendor management: assessed subprocessors, documented",
        "Controls cross-referenced to framework language",
        "Documentation pack available for procurement review",
      ],
    },
    features: [
      {
        icon: "ShieldCheck",
        title: "Framework mapping",
        desc: "Each control area is cross-referenced to the control language of common security and privacy frameworks, so reviewers can map our answers to their template.",
      },
      {
        icon: "Lock",
        title: "Access control",
        desc: "Identity, MFA, role-based permissions, least privilege for staff, audit logging and periodic access reviews — evidenced through logs and review records.",
      },
      {
        icon: "GitBranch",
        title: "Change management",
        desc: "Peer-reviewed changes, automated testing, staged release and defined rollback, so the path from commit to production is the same every time.",
      },
      {
        icon: "Activity",
        title: "Incident management",
        desc: "Documented detection, severity triage, escalation, communication and post-incident review, with notification obligations set in the DPA.",
      },
      {
        icon: "Building",
        title: "Vendor management",
        desc: "Subprocessors are assessed before use, listed publicly, and reviewed on a schedule — with changes communicated through the subprocessor page.",
      },
      {
        icon: "Download",
        title: "Documentation requests",
        desc: "Control summaries, testing status and questionnaire responses are provided for your review, under NDA where the material warrants it.",
      },
    ],
    workflow: {
      heading: "Getting the documentation you need",
      steps: [
        {
          title: "Request",
          desc: "Tell us what your review covers and your deadline, through the contact page — procurement, security review or a completed questionnaire.",
        },
        {
          title: "NDA if required",
          desc: "Where the material warrants it, we sign a mutual NDA first so detailed control descriptions can be shared without ambiguity.",
        },
        {
          title: "Receive the pack",
          desc: "You get the control summary, current attestation status and relevant attestations or reports your review accepts.",
        },
        {
          title: "Questionnaire & call",
          desc: "Open questions are answered by the people who operate the controls, with follow-ups closed in writing rather than verbally.",
        },
      ],
    },
    capabilities: {
      heading: "How we talk about compliance",
      items: [
        {
          icon: "FileText",
          title: "Current status, stated",
          desc: "Where an attestation or audit is in progress, scheduled or held, the current position is stated plainly in the response you receive.",
        },
        {
          icon: "Search",
          title: "No borrowed credibility",
          desc: "We describe controls we operate. A badge copied from a marketing page without the underlying evidence would fail your review anyway.",
        },
        {
          icon: "Users",
          title: "Shared obligations",
          desc: "The DPA divides responsibilities for security and breach handling; your side covers workspace access, consent and the content you send.",
        },
        {
          icon: "Globe",
          title: "Privacy frameworks",
          desc: "Data handling supports obligations under applicable privacy law, with the DPA and privacy policy carrying the specific commitments.",
        },
        {
          icon: "MessageSquare",
          title: "Messaging policy alignment",
          desc: "Template categories, consent evidence and opt-out handling keep customers aligned with Meta's messaging and commerce policies.",
        },
      ],
    },
    faq: [
      {
        q: "Do you hold SOC 2 or ISO 27001 certification?",
        a: "Ask us for the current attestation status rather than relying on a badge on this page — we share where audits and attestations stand today, what evidence exists, and what is scheduled next as part of the security documentation pack.",
      },
      {
        q: "Which control areas do you cover?",
        a: "Access control, change management, incident management and vendor management, together with data protection controls such as encryption, retention and deletion. Those areas are mapped to framework control language for your reviewer.",
      },
      {
        q: "How do we request the security documentation?",
        a: "Through the contact page, naming what your review covers and your deadline. The pack is assembled for your specific review, and a mutual NDA is signed first where the detail requires it.",
      },
      {
        q: "Will you complete our security questionnaire?",
        a: "Yes. Questionnaires are answered by the team that operates the controls rather than a sales template, and follow-up questions are closed in writing so your reviewer has a record.",
      },
      {
        q: "What is our responsibility as the customer?",
        a: "Workspace access and roles, the consent behind your messaging, the content you send, and the credentials your integrations hold. The DPA sets out both sides so nothing falls between them during a review.",
      },
    ],
    cta: {
      title: "Start the security review properly.",
      sub: "One request, one pack, and answers written by the people who run the controls.",
      primary: { label: "Request documentation", to: "/company/contact" },
      secondary: { label: "Read the trust center", to: "/trust" },
    },
    related: ["/trust", "/trust/data-protection", "/legal/dpa"],
  },
};
