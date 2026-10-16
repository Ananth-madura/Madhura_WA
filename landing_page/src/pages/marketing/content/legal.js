/* Legal section pages — /legal/* ----------------------------------------------------
   Long-form documents rendered with a sticky table of contents. Each section
   carries a stable `id` so /legal/terms#liability deep links work.
   --------------------------------------------------------------------------------- */

const LAST_UPDATED = "14 October 2026";

export const LEGAL_PAGES = [
  {
    path: "/legal/privacy",
    section: "Legal",
    renderer: "legal",
    meta: {
      title: "Privacy Policy | Madhura",
      description:
        "How Madhura Technologies collects, uses, shares and protects personal data across the website, the platform and WhatsApp business messaging operations.",
    },
    document: {
      title: "Privacy Policy",
      subtitle:
        "This policy explains what personal data Madhura Technologies processes, on what basis, for how long, and the controls available to you.",
      lastUpdated: LAST_UPDATED,
      owner: "privacy@madhura.co",
    },
    sections: [
      {
        id: "scope",
        heading: "1. Scope and roles",
        paragraphs: [
          "This Privacy Policy applies to the Madhura website, the Madhura platform (the \"Platform\") and any related services, including the shared inbox, campaigns, templates, automations, flows, analytics and client portal.",
          "For website visitors and for individuals who evaluate or purchase the Platform, Madhura Technologies acts as the data controller. For the end-customers of our business clients — the people who actually message a business on WhatsApp — our client is the controller and Madhura acts as a processor acting on documented instructions.",
        ],
        list: [
          "Controller: website usage, account data, billing contacts, marketing enquiries",
          "Processor: WhatsApp conversation content, contact records and tags held on behalf of a client",
          "Joint determination: security telemetry and abuse-prevention signals, documented per engagement",
        ],
      },
      {
        id: "data-we-collect",
        heading: "2. Data we collect",
        paragraphs: [
          "We collect the minimum needed to operate a messaging platform and account for it afterwards. The categories below are the complete set.",
        ],
        list: [
          "Account data: name, work email, phone number, organisation, role and authentication factors",
          "Billing data: company address, GST/TIN where applicable, and payment references (card data is held by our payment processor, never by us)",
          "Messaging data: message text, media, template identifiers, delivery receipts and thread state, stored on behalf of the client",
          "Contact data: phone numbers, names, tags, custom fields and opt-in/opt-out records managed by the client",
          "Technical data: IP address, browser and device characteristics, session timestamps and API keys",
          "Usage data: feature events, page views and performance timings used to operate and improve the Platform",
        ],
      },
      {
        id: "how-we-use",
        heading: "3. How we use personal data",
        paragraphs: [
          "We process personal data to provide the Platform, to meet our contractual obligations, to keep the service secure and to comply with law. Where we rely on legitimate interests, we have assessed that the processing does not override your rights.",
        ],
        list: [
          "To provide, maintain and support the Platform and your workspace",
          "To deliver WhatsApp messages and process delivery receipts as your processor",
          "To authenticate users, prevent abuse and detect security incidents",
          "To bill, collect payment and maintain financial records required by law",
          "To send service notices — incidents, policy changes, billing — which are not marketing",
          "To send marketing communications where you have opted in, with unsubscribe in every message",
        ],
      },
      {
        id: "legal-bases",
        heading: "4. Legal bases (EEA/UK visitors)",
        paragraphs: [
          "Where the GDPR or UK GDPR applies, we rely on: performance of a contract for account and messaging processing; legitimate interests for security, fraud prevention, product improvement and B2B marketing; consent for optional cookies and marketing emails; and legal obligation for tax and regulatory record-keeping.",
        ],
      },
      {
        id: "whatsapp-and-meta",
        heading: "5. WhatsApp and Meta",
        paragraphs: [
          "Outbound and inbound WhatsApp traffic is carried over Meta's WhatsApp Business Platform. Message content and delivery state necessarily pass through Meta's infrastructure, and Meta processes that data under its own terms — the WhatsApp Business Messaging Terms and Meta's Privacy Policy.",
          "Template names, categories, quality ratings and aggregated delivery statistics are shared with Meta as part of operating the channel. We do not control Meta's processing and encourage you to review their terms.",
        ],
      },
      {
        id: "sharing",
        heading: "6. Sharing and sub-processors",
        paragraphs: [
          "We do not sell personal data. We share it only with sub-processors that host or support the Platform, each under a written data processing agreement, and only to the extent needed to deliver the service.",
        ],
        list: [
          "Cloud infrastructure and database hosting providers",
          "Payment processing for subscriptions and invoices",
          "Email and notification delivery for service notices",
          "Error monitoring and log aggregation (with payload redaction)",
          "Analytics tooling operating on aggregated or pseudonymised data",
        ],
        paragraphsAfter: [
          "A current sub-processor list is available on request from privacy@madhura.co. We give 30 days' notice before adding a sub-processor that materially affects processing.",
        ],
      },
      {
        id: "retention",
        heading: "7. Retention",
        paragraphs: [
          "Retention is configurable by the client for messaging data, subject to a contractual minimum. Default periods are set out below; longer retention is available on request and is reflected in your agreement.",
        ],
        list: [
          "Message content and thread history: 24 months by default, configurable from 3 months",
          "Delivery and campaign telemetry: 24 months, then aggregated without identifiers",
          "Account and billing records: 7 years, as required by tax law",
          "Security logs: 12 months",
          "Marketing consent records: for the life of the consent plus 3 years",
        ],
      },
      {
        id: "security",
        heading: "8. Security",
        paragraphs: [
          "We apply technical and organisational measures appropriate to the risk, described in full on our Security page. In summary: encryption in transit and at rest, role-based access control, tenant-level data partitioning, immutable audit logging, least-privilege production access and tested backups.",
          "No system is perfectly secure. If we become aware of a breach affecting your personal data we will notify you and the relevant supervisory authority within the timeframes required by applicable law.",
        ],
      },
      {
        id: "your-rights",
        heading: "9. Your rights",
        paragraphs: [
          "Depending on your jurisdiction you may have the right to access, correct, delete, restrict or object to processing, to data portability, and to withdraw consent. You may also complain to your local supervisory authority.",
          "Requests concerning data we hold as a processor are forwarded to the relevant client, who remains the controller. We assist clients in responding within the statutory deadlines.",
        ],
        list: [
          "Email privacy@madhura.co — we acknowledge within 5 business days",
          "We verify identity before acting on any request",
          "Workspace admins can export or delete contact data from the Platform directly",
        ],
      },
      {
        id: "international",
        heading: "10. International transfers",
        paragraphs: [
          "Data may be processed in India and in the regions where our infrastructure operates. Where data is transferred outside the EEA or UK, we rely on standard contractual clauses or an equivalent recognised mechanism, together with supplementary technical measures.",
        ],
      },
      {
        id: "cookies",
        heading: "11. Cookies",
        paragraphs: [
          "We use strictly necessary cookies for authentication, session integrity and security. Optional analytics cookies are set only where you consent, and consent can be withdrawn at any time without affecting access to the site.",
        ],
      },
      {
        id: "children",
        heading: "12. Children",
        paragraphs: [
          "The Platform is a business service and is not directed to individuals under 18. We do not knowingly collect personal data from children. If you believe a child has provided data, contact us and we will delete it.",
        ],
      },
      {
        id: "changes",
        heading: "13. Changes to this policy",
        paragraphs: [
          "We update this policy to reflect changes in the Platform or in law. Material changes are announced by email to workspace administrators and by an in-product notice at least 14 days before they take effect. The \"last updated\" date at the top always reflects the current version.",
        ],
      },
      {
        id: "contact",
        heading: "14. Contact",
        paragraphs: [
          "Data protection enquiries: privacy@madhura.co",
          "Madhura Technologies — Baner Road, Pune 411045, India",
          "We aim to answer every privacy enquiry within 5 business days.",
        ],
      },
    ],
  },

  {
    path: "/legal/terms",
    section: "Legal",
    renderer: "legal",
    meta: {
      title: "Terms of Service | Madhura",
      description:
        "The agreement governing access to and use of the Madhura WhatsApp CRM platform, including subscription, acceptable use, service levels and liability.",
    },
    document: {
      title: "Terms of Service",
      subtitle:
        "These Terms govern your access to and use of the Madhura Platform, website and related services. By creating an account you agree to them.",
      lastUpdated: LAST_UPDATED,
      owner: "legal@madhura.co",
    },
    sections: [
      {
        id: "agreement",
        heading: "1. The agreement",
        paragraphs: [
          "These Terms of Service (\"Terms\") form a binding agreement between Madhura Technologies (\"Madhura\", \"we\") and the entity accepting them (\"Customer\", \"you\"). They cover the website, the Platform and all related services.",
          "An order form, quote or plan confirmation that references these Terms is incorporated by reference. Where a signed master agreement exists between us, that agreement prevails over these Terms to the extent of any conflict.",
        ],
      },
      {
        id: "the-service",
        heading: "2. The service",
        paragraphs: [
          "Madhura provides a WhatsApp CRM and automation platform comprising a shared inbox, contact management, templates, campaigns, automations, flows, analytics, multi-branch administration and a client portal.",
          "We may improve, modify or discontinue features, provided we do not materially reduce the core functionality of a paid plan during a committed term without notice.",
        ],
      },
      {
        id: "accounts",
        heading: "3. Accounts and access",
        paragraphs: [
          "You are responsible for the accuracy of account information, for the security of credentials and API keys, and for all activity under your workspace, including activity by your agents and any third party you authorise.",
          "You must notify us promptly of any unauthorised use. We may suspend access where we reasonably believe credentials have been compromised or the Platform is being used in violation of these Terms.",
        ],
      },
      {
        id: "acceptable-use",
        heading: "4. Acceptable use",
        paragraphs: [
          "You agree to use the Platform only for lawful business messaging and in accordance with Meta's WhatsApp Business Messaging Terms and all applicable telecommunications and privacy law.",
        ],
        list: [
          "Message only contacts who have given documented opt-in for the messages you send",
          "Honour opt-out requests immediately and permanently",
          "Do not use the Platform to send unlawful, deceptive, harassing or infringing content",
          "Do not upload malware, scrape the service, probe for vulnerabilities or circumvent rate limits",
          "Do not resell or white-label the Platform except under a written partner agreement",
          "Do not send messages through a number you do not own or control",
        ],
        paragraphsAfter: [
          "We may suspend a sending number or an entire workspace immediately where continued sending risks a Meta quality ban, a regulatory breach or harm to recipients.",
        ],
      },
      {
        id: "customer-data",
        heading: "5. Customer data",
        paragraphs: [
          "You retain all rights to the data you and your contacts put into the Platform. You grant us only the licence needed to process that data on your instructions in order to provide the service.",
          "You are responsible for having a lawful basis to send messages, for the accuracy of contact records, and for honouring data subject requests from your own customers. We provide the tools; the lawful basis is yours to establish.",
          "On termination we retain customer data for 30 days to allow export, after which it is deleted according to the retention schedule, unless a longer period is required by law.",
        ],
      },
      {
        id: "fees",
        heading: "6. Fees, billing and taxes",
        paragraphs: [
          "Fees are set out in your plan or order form and are charged in advance for the billing period. Usage-based charges — including message volume and contact tiers — are charged in arrears.",
          "Invoices are payable within 15 days. Late payments accrue interest at 1.5% per month or the maximum permitted by law, whichever is lower. All fees are exclusive of GST, VAT and other applicable taxes.",
          "Plan changes take effect at the next billing cycle; upgrades are prorated. Downgrades do not reduce charges already incurred.",
        ],
      },
      {
        id: "third-party",
        heading: "7. Third-party services",
        paragraphs: [
          "The Platform depends on third-party services, including Meta's WhatsApp Business Platform, cloud infrastructure, payment processors and SMS or email providers. Their terms apply to your use of those services.",
          "We are not responsible for outages, policy changes, quality-rating decisions or account actions taken by a third-party provider, including suspension of your WhatsApp number by Meta. We will assist you in remediation where the cause is within our control.",
        ],
      },
      {
        id: "service-levels",
        heading: "8. Service levels and support",
        paragraphs: [
          "Enterprise agreements include a service level commitment covering monthly uptime, support response targets and escalation paths. Uptime excludes scheduled maintenance announced at least 48 hours in advance, force majeure, and failures of third-party providers outside our reasonable control.",
          "Support is provided through the channels listed on our Contact page. Enterprise customers receive a named contact and a quarterly business review.",
        ],
      },
      {
        id: "intellectual-property",
        heading: "9. Intellectual property",
        paragraphs: [
          "Madhura owns the Platform, including its software, documentation, design and trademarks. These Terms grant you a limited, non-exclusive, non-transferable right to use the Platform during your subscription for your internal business purposes.",
          "Feedback you provide may be used to improve the Platform without obligation to you. You may not copy, modify, reverse engineer or create derivative works of the Platform except to the extent permitted by law.",
        ],
      },
      {
        id: "confidentiality",
        heading: "10. Confidentiality",
        paragraphs: [
          "Each party will protect the other's confidential information with at least the care it uses for its own, and will use it only to perform under these Terms. Confidentiality does not apply to information that is public, independently developed, or required to be disclosed by law.",
          "We will disclose customer data only as instructed through the Platform or as required by law, and will notify you of any legally compelled disclosure where we are legally permitted to do so.",
        ],
      },
      {
        id: "suspension",
        heading: "11. Suspension and termination",
        paragraphs: [
          "Either party may terminate for material breach that remains uncured 30 days after written notice. You may terminate for convenience at the end of a committed term with 30 days' notice.",
          "We may suspend or terminate immediately for non-payment, unlawful use, breach of Meta's terms, or conduct that threatens the Platform or its other customers.",
          "On termination, your right to access ceases and we delete customer data after the export window described in section 5.",
        ],
      },
      {
        id: "warranties",
        heading: "12. Warranties and disclaimers",
        paragraphs: [
          "We warrant that the Platform will perform materially in accordance with its documentation and that we have the right to provide it. Your exclusive remedy for breach of this warranty is re-performance; if we cannot re-perform, you may terminate and receive a pro-rata refund of prepaid fees.",
          "Except as expressly stated, the Platform is provided \"as is\". We disclaim all implied warranties, including merchantability, fitness for a particular purpose and non-infringement, to the maximum extent permitted by law.",
          "We do not warrant message delivery, template approval, inbox placement or the continued availability of any WhatsApp number.",
        ],
      },
      {
        id: "liability",
        heading: "13. Limitation of liability",
        paragraphs: [
          "To the maximum extent permitted by law, neither party is liable for indirect, incidental, special, consequential or punitive damages, or for lost profits, revenue, goodwill or data, even if advised of the possibility.",
          "Each party's aggregate liability under these Terms is limited to the fees paid or payable by you in the 12 months preceding the event giving rise to the claim.",
          "The limitations do not apply to your payment obligations, your breach of acceptable use, infringement of our intellectual property, or either party's confidentiality obligations.",
        ],
      },
      {
        id: "indemnity",
        heading: "14. Indemnity",
        paragraphs: [
          "You will defend and indemnify us against third-party claims arising from your use of the Platform in breach of these Terms or applicable law, including claims arising from messages you send without a lawful basis.",
          "We will defend you against third-party claims that the Platform infringes that third party's intellectual property, excluding claims arising from your content, your modifications or combinations not supplied by us.",
        ],
      },
      {
        id: "governing-law",
        heading: "15. Governing law and disputes",
        paragraphs: [
          "These Terms are governed by the laws of India. Courts at Pune, Maharashtra have exclusive jurisdiction, subject to any mandatory consumer protections in your jurisdiction.",
          "Before filing a claim, the parties will attempt to resolve the dispute through good-faith negotiation for 30 days.",
        ],
      },
      {
        id: "general",
        heading: "16. General",
        paragraphs: [
          "Neither party may assign these Terms without the other's written consent, except in connection with a merger, acquisition or sale of substantially all assets. These Terms constitute the entire agreement and supersede prior discussions.",
          "If any provision is held unenforceable, it will be modified to the minimum extent necessary and the remainder will continue in effect. A failure to enforce a provision is not a waiver.",
          "Notices to Madhura must be sent to legal@madhura.co. Notices to you are sent to your account email and are deemed received on delivery.",
        ],
      },
    ],
  },

  {
    /* The security document is canonical at /trust/security (Trust Center).
       Old /legal/security links keep working through LEGACY_ALIASES. */
    path: "/trust/security",
    section: "Trust & Security",
    renderer: "legal",
    meta: {
      title: "Security | Madhura",
      description:
        "Madhura's security posture: encryption, access control, tenant isolation, audit logging, resilience, compliance and vulnerability disclosure.",
    },
    document: {
      title: "Security",
      subtitle:
        "The controls that protect customer data across the Madhura Platform, and how to report a vulnerability to us.",
      lastUpdated: LAST_UPDATED,
      owner: "security@madhura.co",
    },
    sections: [
      {
        id: "posture",
        heading: "1. Our posture",
        paragraphs: [
          "Madhura handles business messaging data for organisations across several jurisdictions. Security is treated as a product requirement, not a compliance afterthought: controls are designed with the platform and reviewed before a feature ships.",
          "We operate a defence-in-depth model. No single control is trusted to be sufficient, and the failure of any one layer must not expose customer data.",
        ],
      },
      {
        id: "encryption",
        heading: "2. Encryption",
        paragraphs: [
          "All traffic between clients and the Platform is encrypted with TLS 1.2 or higher, with modern cipher suites and HSTS enforced. Internal service traffic and database connections are encrypted as well.",
          "Data at rest — databases, object storage and backups — is encrypted with AES-256. Secrets and API keys are stored in a managed secrets store, never in source control or application configuration.",
        ],
      },
      {
        id: "access-control",
        heading: "3. Access control",
        paragraphs: [
          "Workspace access is governed by role-based access control with least privilege as the default. Permissions cover every mutating operation, including exports, deletions and number management.",
          "Platform administrative access is restricted to a small set of engineers, requires hardware-backed multi-factor authentication and is granted just-in-time for a defined task. All such access is logged and reviewed.",
        ],
        list: [
          "Role-based permissions per workspace, per branch and per module",
          "Mandatory MFA for all staff accounts with production access",
          "Just-in-time elevation with automatic expiry and session recording",
          "Quarterly access reviews with documented revocation",
        ],
      },
      {
        id: "isolation",
        heading: "4. Tenant isolation",
        paragraphs: [
          "Customer data is partitioned at the row level with the tenant identifier enforced in the data access layer, not by application convention. Cross-tenant queries are structurally prevented and covered by automated tests that fail the build on regression.",
          "Each customer has a unique inbound webhook path and a dedicated credential set. Message payloads are never logged without redaction.",
        ],
      },
      {
        id: "audit",
        heading: "5. Audit logging",
        paragraphs: [
          "Every mutating action — login, assignment, template change, export, deletion, permission change — is written to an append-only audit log with actor, timestamp, IP and the before/after state where relevant.",
          "Audit logs are retained for 12 months, are not editable by platform staff, and are exportable to the customer on request.",
        ],
      },
      {
        id: "resilience",
        heading: "6. Resilience and recovery",
        paragraphs: [
          "Production databases run with point-in-time recovery. Backups are encrypted, retained on a documented schedule and restored into a test environment monthly to verify they actually work.",
          "Services run across multiple availability zones with health-checked failover. Recovery objectives and recovery times are documented and tested in a game-day exercise each quarter.",
        ],
        list: [
          "Encrypted backups with point-in-time recovery",
          "Monthly restore verification, not just backup verification",
          "Multi-AZ deployment with automated failover",
          "Documented RTO/RPO reviewed after every incident",
        ],
      },
      {
        id: "monitoring",
        heading: "7. Monitoring and incident response",
        paragraphs: [
          "We monitor application errors, delivery telemetry, authentication anomalies and infrastructure health, with alerting routed to a compensated on-call rotation with a defined escalation path.",
          "Incidents follow a documented process: triage, contain, remediate, and a blameless post-mortem with actions assigned and tracked to completion. Enterprise customers are notified of severity-one incidents through their agreed channel.",
        ],
      },
      {
        id: "secure-development",
        heading: "8. Secure development",
        paragraphs: [
          "Dependencies are scanned for known vulnerabilities, changes are peer reviewed, and secrets are blocked from commits by pre-commit and CI checks. Production deployments are automated from a reviewed commit, with a documented rollback path.",
          "External penetration testing is carried out annually and after material architectural change. A summary report is available to enterprise customers under NDA.",
        ],
      },
      {
        id: "compliance",
        heading: "9. Compliance and privacy",
        paragraphs: [
          "Our control set is documented so that it can be assessed against the enterprise security frameworks your organisation already works with. The current control descriptions and evidence pack are available to prospective enterprise customers under NDA — request them through the contact page to run your review.",
          "Personal data handling is described in our Privacy Policy, and a data processing agreement is available for all customers processing personal data through the Platform.",
        ],
        list: [
          "Documented control set available for review under NDA",
          "Data processing agreement available for all customers",
          "GDPR-aligned data subject request tooling",
          "WhatsApp opt-in records retained as evidence of consent",
        ],
      },
      {
        id: "subprocessors",
        heading: "10. Sub-processors",
        paragraphs: [
          "Every sub-processor is assessed before onboarding, bound by a written data processing agreement, and reviewed annually. The current sub-processor list is available from security@madhura.co, and customers are notified 30 days before a material addition.",
        ],
      },
      {
        id: "responsible-disclosure",
        heading: "11. Responsible disclosure",
        paragraphs: [
          "We welcome security research conducted in good faith. Report findings to security@madhura.co with reproduction steps; we will acknowledge within 24 hours and provide a substantive response within 5 business days.",
          "Safe harbour: where you act in good faith, follow this policy and cause no harm, we will not pursue legal action relating to your research.",
        ],
        list: [
          "Do not access customer data beyond what is needed to demonstrate the issue",
          "Do not degrade service availability, and stop testing once you have a proof of concept",
          "Do not disclose publicly until we have had a reasonable opportunity to remediate",
          "Allow 90 days before public disclosure; we will keep you informed of progress",
        ],
      },
      {
        id: "reporting",
        heading: "12. How to reach us",
        paragraphs: [
          "Security enquiries and vulnerability reports: security@madhura.co",
          "Encryption: use PGP where your report contains sensitive detail; key available on request.",
          "For procurement questionnaires, penetration test summaries and the DPA, contact the same address and we will route you to the right team.",
        ],
      },
    ],
  },
];
