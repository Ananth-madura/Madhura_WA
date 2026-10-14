/* Trust Center and security documentation pages.
   Shape: path / section / renderer / meta / hero / stats / overview / features /
   workflow / capabilities / faq / related. /trust/security lives in legal.js. */

const page = ({ path, badge, title, highlight, subtitle, points, stats, overview, features, steps, workflowHeading, capHeading, caps, faq, related }) => ({
  path,
  section: "Trust & Security",
  renderer: "standard",
  hero: {
    badge: `Trust & Security · ${badge}`,
    title,
    highlight,
    subtitle,
    points,
    primaryCta: { label: "Contact security team", to: "/company/contact" },
    secondaryCta: { label: "Security overview", to: "/trust/security" },
  },
  stats,
  overview,
  features,
  workflow: { heading: workflowHeading, steps },
  capabilities: { heading: capHeading, items: caps },
  faq,
  related,
});

export const TRUST_PAGES = [
  page({
    path: "/trust",
    badge: "Trust Center",
    title: "Your customer conversations, protected by design.",
    highlight: "protected by design",
    subtitle:
      "One place for how Madhura secures data, runs infrastructure, controls access, handles incidents and meets compliance obligations for WhatsApp messaging.",
    points: [
      "Encryption in transit and at rest",
      "Tenant isolation for every workspace",
      "Role-based, branch-scoped access",
      "Published incident and disclosure process",
    ],
    stats: [
      { value: "TLS 1.3", label: "In transit", note: "on every public endpoint" },
      { value: "AES-256", label: "At rest", note: "databases and backups" },
      { value: "99.9%", label: "Uptime target", note: "see the SLA" },
      { value: "24/7", label: "Monitoring", note: "alerting and on-call" },
    ],
    overview: {
      heading: "Security is part of the product, not an add-on",
      paragraphs: [
        "Madhura carries sensitive business conversations: orders, appointments, payments and personal details. Every design decision starts from the assumption that this data belongs to you and your customers, and that access to it must be deliberate, logged and reversible.",
        "This Trust Center links to the detailed pages behind each commitment so security, legal and procurement teams can review them without waiting on a call.",
      ],
      bullets: [
        "Security overview and architecture",
        "Data protection and retention",
        "Infrastructure and hosting regions",
        "Access controls and audit logs",
        "Incident response commitments",
        "Compliance and responsible disclosure",
      ],
    },
    features: [
      { icon: "ShieldCheck", title: "Security overview", desc: "Encryption, isolation, logging and resilience controls in one document." },
      { icon: "Lock", title: "Data protection", desc: "How customer data is collected, processed, retained and deleted." },
      { icon: "Layers", title: "Infrastructure", desc: "Where workloads run, how they are segmented and how backups work." },
      { icon: "Users", title: "Access controls", desc: "Roles, permissions, branch scoping and admin safeguards." },
      { icon: "AlertCircle", title: "Incident response", desc: "Detection, containment, notification and post-incident review." },
      { icon: "Scale", title: "Compliance", desc: "Regulatory alignment, Meta policy adherence and contractual documents." },
    ],
    workflowHeading: "How we review trust with your team",
    steps: [
      { title: "Read", desc: "Start with the pages in this Trust Center; most questionnaires are answered here." },
      { title: "Request", desc: "Ask for the security questionnaire pack or DPA through the contact page." },
      { title: "Review", desc: "Our team walks your security reviewers through architecture and controls." },
      { title: "Sign", desc: "Contractual commitments are captured in the DPA and SLA before go-live." },
    ],
    capHeading: "What we commit to",
    caps: [
      { icon: "FileText", title: "Written policies", desc: "Security commitments are documented and versioned, not verbal." },
      { icon: "Activity", title: "Continuous monitoring", desc: "Infrastructure and application health are watched around the clock." },
      { icon: "RefreshCw", title: "Regular review", desc: "Controls are reviewed as the platform and threat landscape change." },
    ],
    faq: [
      { q: "Can I get a completed security questionnaire?", a: "Yes. Request it through the contact page and our team will share the standard pack." },
      { q: "Do you sign a Data Processing Agreement?", a: "Yes. The DPA is available on the legal pages and can be countersigned for your account." },
    ],
    related: ["/trust/security", "/trust/data-protection", "/trust/compliance"],
  }),

  page({
    path: "/trust/data-protection",
    badge: "Data Protection",
    title: "Your data, processed only for the purpose you set.",
    highlight: "only for the purpose",
    subtitle:
      "Madhura acts as a processor for your customer conversations. We collect the minimum needed, keep it isolated, and delete it when you ask.",
    points: ["Data minimisation", "Workspace-level isolation", "Configurable retention", "Deletion on request"],
    stats: [
      { value: "Processor", label: "Our role", note: "you remain the controller" },
      { value: "AES-256", label: "Encryption", note: "at rest" },
      { value: "30 days", label: "Deletion window", note: "after verified request" },
      { value: "0", label: "Data sold", note: "ever" },
    ],
    overview: {
      heading: "How customer data is handled",
      paragraphs: [
        "Messages, contacts and attachments are stored per workspace and are never used to train shared models or sold to third parties. Access by Madhura staff is limited to support requests you raise and is logged.",
        "You control retention and can export or delete data at any time from the workspace or by submitting a data deletion request.",
      ],
      bullets: ["Per-workspace storage", "No resale or ad usage", "Logged staff access", "Export in standard formats", "Retention settings per workspace", "Subprocessor list published"],
    },
    features: [
      { icon: "Lock", title: "Encryption", desc: "Data is encrypted in transit with TLS and at rest with AES-256." },
      { icon: "Folder", title: "Isolation", desc: "Each workspace is logically separated so data never crosses tenants." },
      { icon: "Download", title: "Portability", desc: "Export contacts, conversations and reports whenever you need them." },
      { icon: "Clock", title: "Retention", desc: "Set how long conversations are kept to match your policies." },
    ],
    workflowHeading: "Lifecycle of your data",
    steps: [
      { title: "Collect", desc: "Only data needed to deliver messaging and CRM features is collected." },
      { title: "Process", desc: "Data is processed on your instructions inside your workspace." },
      { title: "Retain", desc: "Data is kept for the period you configure or the contract defines." },
      { title: "Delete", desc: "Data is deleted on request or at the end of the retention period." },
    ],
    capHeading: "Your rights and controls",
    caps: [
      { icon: "FileText", title: "DPA", desc: "Contractual data processing terms are available for every customer." },
      { icon: "Users", title: "Subject requests", desc: "We help you answer access and deletion requests from your customers." },
      { icon: "Globe", title: "Subprocessors", desc: "A published list of subprocessors with advance notice of changes." },
    ],
    faq: [
      { q: "Do you use my conversations to train AI?", a: "No. Your data is only used to provide the service to your workspace." },
      { q: "How do I request deletion?", a: "Use the Data Deletion Request page or contact support from your workspace." },
    ],
    related: ["/trust", "/legal/dpa", "/legal/data-deletion"],
  }),

  page({
    path: "/trust/infrastructure",
    badge: "Infrastructure & Hosting",
    title: "Infrastructure built for reliable, isolated messaging.",
    highlight: "reliable, isolated",
    subtitle:
      "Madhura runs on established cloud providers with segmented networks, automated backups and continuous monitoring.",
    points: ["Reputable cloud hosting", "Network segmentation", "Automated encrypted backups", "Redundant services"],
    stats: [
      { value: "99.9%", label: "Uptime target", note: "per the SLA" },
      { value: "Daily", label: "Backups", note: "encrypted" },
      { value: "Multi-AZ", label: "Redundancy", note: "for core services" },
      { value: "24/7", label: "Monitoring", note: "with on-call" },
    ],
    overview: {
      heading: "Where and how Madhura runs",
      paragraphs: [
        "Production workloads run in managed cloud data centres with physical security, redundant power and network. Databases and queues are deployed with redundancy so a single failure does not take messaging down.",
        "Production, staging and development environments are separated, and production access is restricted to a small, audited group.",
      ],
      bullets: ["Separate environments", "Private networking for data stores", "Infrastructure as code", "Automated patching", "Encrypted backups with restore tests", "Status page for live health"],
    },
    features: [
      { icon: "Layers", title: "Segmentation", desc: "Services run in isolated networks with only required ports exposed." },
      { icon: "RefreshCw", title: "Backups", desc: "Automated encrypted backups with periodic restore verification." },
      { icon: "Activity", title: "Monitoring", desc: "Metrics, logs and alerts route to an on-call engineer." },
      { icon: "Zap", title: "Scalability", desc: "Messaging queues scale with campaign volume to protect delivery." },
    ],
    workflowHeading: "How changes reach production",
    steps: [
      { title: "Review", desc: "Every change is peer-reviewed before merge." },
      { title: "Test", desc: "Automated tests run on every build." },
      { title: "Stage", desc: "Changes are verified in a staging environment." },
      { title: "Deploy", desc: "Rollouts are monitored and can be rolled back quickly." },
    ],
    capHeading: "Resilience practices",
    caps: [
      { icon: "Clock", title: "Recovery targets", desc: "Defined recovery objectives for core data stores." },
      { icon: "ShieldCheck", title: "Hardening", desc: "Minimal base images and regular dependency updates." },
      { icon: "Globe", title: "Status page", desc: "Live component health and incident history are public." },
    ],
    faq: [
      { q: "Where is my data hosted?", a: "Hosting region details are shared during onboarding and in the DPA." },
      { q: "Do you test backups?", a: "Yes. Restores are tested periodically to confirm backups are usable." },
    ],
    related: ["/trust", "/support/status", "/legal/sla"],
  }),

  page({
    path: "/trust/access-controls",
    badge: "Access Controls",
    title: "The right people see the right conversations.",
    highlight: "the right conversations",
    subtitle:
      "Role-based permissions, branch scoping and audit logs keep every action in your workspace deliberate and traceable.",
    points: ["Role-based access", "Branch-scoped permissions", "Audit logs", "Session controls"],
    stats: [
      { value: "RBAC", label: "Permission model", note: "custom roles" },
      { value: "Per branch", label: "Scoping", note: "numbers and teams" },
      { value: "Full", label: "Audit trail", note: "admin actions logged" },
      { value: "Least", label: "Privilege", note: "for Madhura staff" },
    ],
    overview: {
      heading: "Control inside your workspace and ours",
      paragraphs: [
        "Admins define roles that limit who can read conversations, export contacts, send campaigns or change settings. Branch scoping keeps each location's team inside its own numbers and data.",
        "Internally, Madhura staff follow least-privilege access with logged, time-limited production access tied to a support ticket.",
      ],
      bullets: ["Custom roles and permissions", "Export and delete restrictions", "Branch-level data scoping", "Admin activity logs", "Revoke access instantly", "Staff access tied to tickets"],
    },
    features: [
      { icon: "Users", title: "Roles", desc: "Owner, admin, manager and agent roles, plus custom ones." },
      { icon: "Building", title: "Branches", desc: "Scope agents to the branches and numbers they serve." },
      { icon: "FileText", title: "Audit logs", desc: "See who changed what and when across the workspace." },
      { icon: "Lock", title: "Sessions", desc: "Sign out users and revoke tokens immediately when needed." },
    ],
    workflowHeading: "Setting up access",
    steps: [
      { title: "Define roles", desc: "Choose which actions each role may perform." },
      { title: "Assign branches", desc: "Scope users to the branches they work in." },
      { title: "Invite", desc: "Invite teammates with their role already applied." },
      { title: "Review", desc: "Check audit logs and adjust access as teams change." },
    ],
    capHeading: "Safeguards",
    caps: [
      { icon: "ShieldCheck", title: "Sensitive actions", desc: "Exports and bulk deletes can be limited to admins." },
      { icon: "Key", title: "API keys", desc: "Keys are scoped and can be rotated or revoked." },
      { icon: "Activity", title: "Anomaly review", desc: "Unusual admin activity is visible in logs." },
    ],
    faq: [
      { q: "Can agents export contacts?", a: "Only if their role allows it. Exports can be restricted to admins." },
      { q: "Can Madhura staff read my chats?", a: "Only when needed for a support request you raise, and that access is logged." },
    ],
    related: ["/trust", "/platform/roles-permissions", "/product/multi-branch"],
  }),

  page({
    path: "/trust/incident-response",
    badge: "Incident Response",
    title: "When something goes wrong, you hear it from us first.",
    highlight: "from us first",
    subtitle:
      "A defined process to detect, contain, fix and communicate security and availability incidents.",
    points: ["24/7 alerting", "Severity-based response", "Customer notification", "Post-incident review"],
    stats: [
      { value: "24/7", label: "On-call", note: "for critical alerts" },
      { value: "S1–S4", label: "Severity", note: "drives response" },
      { value: "72h", label: "Breach notice", note: "maximum target" },
      { value: "Written", label: "Post-mortem", note: "for major incidents" },
    ],
    overview: {
      heading: "A process rehearsed before it is needed",
      paragraphs: [
        "Alerts from monitoring, customer reports and security disclosures all enter the same incident process. A named incident lead coordinates engineering, communication and follow-up.",
        "Affected customers are notified without undue delay, and the status page is updated throughout availability incidents.",
      ],
      bullets: ["Single incident process", "Named incident lead", "Status page updates", "Customer notification", "Root-cause analysis", "Tracked corrective actions"],
    },
    features: [
      { icon: "AlertCircle", title: "Detect", desc: "Automated alerting and reports trigger the process." },
      { icon: "ShieldCheck", title: "Contain", desc: "Limit impact by isolating affected systems or credentials." },
      { icon: "Settings", title: "Remediate", desc: "Fix the cause and verify the system is healthy." },
      { icon: "MessageSquare", title: "Communicate", desc: "Keep affected customers informed with clear updates." },
    ],
    workflowHeading: "Incident lifecycle",
    steps: [
      { title: "Triage", desc: "Assign severity and an incident lead." },
      { title: "Contain", desc: "Stop the impact from spreading." },
      { title: "Resolve", desc: "Fix the cause and restore service." },
      { title: "Review", desc: "Publish findings and track preventive actions." },
    ],
    capHeading: "Commitments",
    caps: [
      { icon: "Clock", title: "Timely notice", desc: "Data breaches are notified within contractual timeframes." },
      { icon: "FileText", title: "Reports", desc: "Major incidents receive a written summary." },
      { icon: "TrendingUp", title: "Improvement", desc: "Lessons learned feed back into controls." },
    ],
    faq: [
      { q: "Where can I see live incidents?", a: "On the System Status page, which shows component health and history." },
      { q: "How do I report a suspected incident?", a: "Contact support or use the Responsible Disclosure page for security issues." },
    ],
    related: ["/trust", "/support/status", "/trust/disclosure"],
  }),

  page({
    path: "/trust/disclosure",
    badge: "Responsible Disclosure",
    title: "Found a vulnerability? Tell us, and we will fix it.",
    highlight: "we will fix it",
    subtitle:
      "We welcome reports from security researchers and commit to acknowledging, investigating and resolving valid issues.",
    points: ["Clear reporting channel", "Acknowledgement of reports", "No action for good-faith research", "Credit on request"],
    stats: [
      { value: "3 days", label: "Acknowledgement", note: "target" },
      { value: "Good faith", label: "Safe harbour", note: "for researchers" },
      { value: "Tracked", label: "Every report", note: "to resolution" },
      { value: "Credit", label: "Recognition", note: "if you want it" },
    ],
    overview: {
      heading: "How to report",
      paragraphs: [
        "Email security@madhura.co with a description of the issue, steps to reproduce and any proof of concept. Please give us reasonable time to fix the issue before sharing it publicly.",
        "Do not access other customers' data, disrupt service, or use social engineering. Test only against accounts you own.",
      ],
      bullets: ["Describe the impact", "Include reproduction steps", "Avoid customer data", "No denial-of-service testing", "Allow time to fix", "Keep details private until fixed"],
    },
    features: [
      { icon: "Send", title: "Report", desc: "Send findings to security@madhura.co." },
      { icon: "CheckCircle", title: "Acknowledge", desc: "We confirm receipt and assign an owner." },
      { icon: "Search", title: "Investigate", desc: "We validate and assess severity." },
      { icon: "Award", title: "Resolve & credit", desc: "We fix the issue and credit you if you wish." },
    ],
    workflowHeading: "What happens after you report",
    steps: [
      { title: "Receive", desc: "Your report enters our security queue." },
      { title: "Validate", desc: "We reproduce and rate the issue." },
      { title: "Fix", desc: "A fix is developed and deployed." },
      { title: "Close", desc: "We confirm the fix with you." },
    ],
    capHeading: "In scope",
    caps: [
      { icon: "Globe", title: "Web app", desc: "The Madhura workspace and marketing site." },
      { icon: "Code", title: "API", desc: "Public REST API and webhooks." },
      { icon: "Smartphone", title: "Integrations", desc: "Official SDKs and connectors." },
    ],
    faq: [
      { q: "Do you offer a paid bounty?", a: "Not currently, but we acknowledge valid reports and credit researchers on request." },
      { q: "Is third-party infrastructure in scope?", a: "No. Report issues in third-party services to those vendors directly." },
    ],
    related: ["/trust", "/trust/incident-response", "/trust/security"],
  }),

  page({
    path: "/trust/compliance",
    badge: "Compliance Information",
    title: "Messaging that respects the rules your business follows.",
    highlight: "respects the rules",
    subtitle:
      "Madhura is built to support data protection law, Meta's WhatsApp Business policies and your contractual obligations.",
    points: ["Privacy law alignment", "WhatsApp Business policy adherence", "Opt-in consent tooling", "Contractual documentation"],
    stats: [
      { value: "DPDP / GDPR", label: "Privacy alignment", note: "processor commitments" },
      { value: "Meta", label: "Policy", note: "WhatsApp Business rules" },
      { value: "Opt-in", label: "Consent", note: "tracked per contact" },
      { value: "DPA", label: "Contract", note: "available to sign" },
    ],
    overview: {
      heading: "How Madhura supports your compliance",
      paragraphs: [
        "Consent is recorded per contact, opt-outs are honoured automatically, and template messages follow Meta's approval rules. This helps your campaigns stay within WhatsApp policy and privacy law.",
        "Legal documents including the DPA, SLA, subprocessors list and acceptable use policy are published so reviewers can assess them directly.",
      ],
      bullets: ["Consent and opt-out tracking", "Approved template workflow", "Quality rating visibility", "Published legal documents", "Data subject request support", "Audit logs for review"],
    },
    features: [
      { icon: "CheckSquare", title: "Consent", desc: "Record how and when each contact opted in." },
      { icon: "FileCode", title: "Templates", desc: "Submit and track Meta template approval." },
      { icon: "Scale", title: "Legal docs", desc: "DPA, SLA, AUP and privacy policy in one place." },
      { icon: "BarChart3", title: "Reporting", desc: "Evidence for audits from logs and reports." },
    ],
    workflowHeading: "Staying compliant day to day",
    steps: [
      { title: "Collect consent", desc: "Capture opt-in with source and timestamp." },
      { title: "Use approved templates", desc: "Send business-initiated messages only via approved templates." },
      { title: "Honour opt-outs", desc: "STOP replies remove contacts from campaigns automatically." },
      { title: "Keep records", desc: "Logs and exports support audits." },
    ],
    capHeading: "Related documents",
    caps: [
      { icon: "FileText", title: "Privacy Policy", desc: "How we handle personal data." },
      { icon: "Lock", title: "Data Processing Agreement", desc: "Our processor commitments." },
      { icon: "MessageCircle", title: "Messaging & Consent", desc: "Rules for compliant WhatsApp outreach." },
    ],
    faq: [
      { q: "Are you certified?", a: "Ask our team for the current status of certifications and audit reports." },
      { q: "Who is responsible for consent?", a: "You are, as the sender; Madhura provides the tools to collect and track it." },
    ],
    related: ["/trust", "/legal/messaging-consent", "/legal/privacy"],
  }),
];
