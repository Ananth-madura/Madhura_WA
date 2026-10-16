/* The remaining legal documents — cookies, DPA, acceptable use, refunds, SLA,
   subprocessors, data deletion and messaging consent.
   Each entry is a `legal` renderer document: a `document` header plus numbered
   `sections` whose stable ids power #anchor deep links. meta / cta / related
   defaults are filled in by content/index.js, but `related` is set explicitly
   so the documents cross-link each other.

   Shape: { path, section, renderer, title, description, wordCount, link,
            meta, document: { title, subtitle, lastUpdated, owner },
            sections: [{ id, heading, paragraphs, list? }], related }
   --------------------------------------------------------------------------------- */

export const LEGAL_EXTRA_PAGES = {
  "/legal/cookies": {
    path: "/legal/cookies",
    section: "Legal",
    renderer: "legal",
    title: "Cookies Policy",
    description:
      "Which cookies and similar technologies Madhura sets on its website and platform, what each one does, and how to control them.",
    wordCount: 900,
    link: { label: "Privacy Policy", to: "/legal/privacy" },
    meta: {
      title: "Cookies Policy | Madhura",
      description:
        "The cookies and similar technologies Madhura sets — essential, analytics and preference cookies — with the full cookie list, browser controls, DNT and GPC handling.",
    },
    document: {
      title: "Cookies Policy",
      subtitle:
        "This policy explains which cookies and similar technologies the Madhura website and platform set, why we set them, and the choices available to you.",
      lastUpdated: "October 2026",
      owner: "Legal & Compliance",
    },
    sections: [
      {
        id: "what-cookies",
        heading: "1. What cookies are",
        paragraphs: [
          "A cookie is a small text file that a website stores in your browser so the site can recognise you on your next visit. This policy also covers similar technologies that do the same job by other means — local storage entries, session identifiers and pixels — because most privacy and cookie rules treat them the same way.",
          "We set these technologies on our marketing pages and inside the authenticated platform. Cookies that are not strictly necessary are stored only after you accept them in the cookie banner, and you can withdraw that choice at any time without losing access to the service.",
        ],
      },
      {
        id: "essential",
        heading: "2. Essential cookies",
        paragraphs: [
          "Essential cookies keep the service working. They authenticate you, protect forms against cross-site request forgery, balance traffic across servers, remember the workspace and branch you last opened, and store the cookie choices you have made so we do not ask on every page. The platform cannot be used reliably without them.",
          "Because they are strictly necessary to deliver the service you have asked for, they do not rely on consent under most cookie rules, and we therefore set them on every visit.",
        ],
        list: [
          "Authentication and session integrity — keeping you signed in and preventing session hijacking",
          "Security — request validation tokens, abuse detection and load-balancer affinity",
          "Consent storage — the choices recorded in the cookie banner",
          "Interface state — last workspace, branch, language and timezone you selected",
        ],
      },
      {
        id: "analytics",
        heading: "3. Analytics cookies",
        paragraphs: [
          "Analytics cookies tell us how the site is used: which pages are read, where people abandon a signup flow, which documentation pages answer a question, and how quickly pages render. They are set only if you consent, and we configure them to work on aggregated or pseudonymised data wherever the tool allows.",
          "We use this information to decide what to build and what to fix, not to build advertising profiles. We do not sell analytics data and we do not pass it to third parties for their own advertising. Withdrawing consent stops new analytics cookies; existing ones expire on the schedule in the table below.",
        ],
      },
      {
        id: "preference",
        heading: "4. Preference cookies",
        paragraphs: [
          "Preference cookies remember choices you have made so the site behaves the same way next time: language, timezone, date format, dismissed notices, accessibility settings and saved dashboard views. They are convenient rather than necessary — the platform works without them, you simply reconfigure a few things.",
          "Preference cookies persist beyond a single session, typically for up to 12 months, and disappear if you clear site data or reset your consent preferences.",
        ],
      },
      {
        id: "cookie-table",
        heading: "5. The cookies we set",
        paragraphs: [
          "The list below covers the cookies and storage entries set on our own surfaces. Individual names may change as the product evolves; the purpose and duration of each entry stay as described. Cookies set by embedded third-party players, such as a video host on a marketing page, are governed by that provider's own policy.",
        ],
        list: [
          "madhura_session — Identifies your signed-in session and workspace — Session; expires after 12 hours of inactivity",
          "madhura_csrf — Validates state-changing requests and blocks cross-site forgery — Session",
          "madhura_consent — Stores the cookie choices you have made — 12 months",
          "madhura_prefs — Remembers language, timezone and interface preferences — 12 months",
          "madhura_workspace — Remembers the last workspace and branch you opened — 30 days",
          "madhura_analytics — Pseudonymous identifier used for aggregated traffic statistics — 13 months; set only with consent",
        ],
      },
      {
        id: "managing",
        heading: "6. Managing cookies in your browser",
        paragraphs: [
          "Every major browser lets you inspect, block and delete cookies, and most block third-party cookies by default. Blocking essential cookies will sign you out repeatedly and can break parts of the platform; blocking the optional categories has no effect on core functionality.",
        ],
        list: [
          "Delete stored cookies and site data from your browser's privacy or site-settings panel",
          "Block all cookies for a site, or third-party cookies only, before you visit",
          "Reopen the site and use the cookie banner to change your optional-cookie choice at any time",
          "Use a private or incognito window to browse without persisting anything after you close it",
        ],
      },
      {
        id: "do-not-track",
        heading: "7. Do Not Track and Global Privacy Control",
        paragraphs: [
          "Do Not Track never became an agreed standard, so browsers that send a DNT header do not receive a consistent response from most websites, including ours. We therefore treat DNT as informational rather than a request we act on.",
          "We do honour the Global Privacy Control signal where your browser sends it: a GPC signal is treated as a request to disable optional cookies for that browser until you change it. Whichever signal you use, the cookie banner and your browser settings achieve the same result directly.",
        ],
      },
      {
        id: "updates",
        heading: "8. Changes to this policy",
        paragraphs: [
          "We update this policy when the technologies we use change or when the law does. Material changes are announced on this page and, where they affect platform users, by email to workspace administrators. The “last updated” date at the top of this document always reflects the version currently in force.",
        ],
      },
      {
        id: "contact",
        heading: "9. Contact",
        paragraphs: [
          "Questions about this policy or about our use of cookies: legal@madhura.co. Data-protection questions belong with the team named in our Privacy Policy, and vulnerability reports go to the address on our Security page.",
          "Madhura Technologies Private Limited — Corporate Headquarters: No. 12/4 Anna Salai, Guindy, Chennai 600032, Tamil Nadu, India.",
        ],
      },
    ],
    related: ["/legal/acceptable-use", "/legal/messaging-consent", "/legal/data-deletion"],
  },

  "/legal/dpa": {
    path: "/legal/dpa",
    section: "Legal",
    renderer: "legal",
    title: "Data Processing Addendum",
    description:
      "Madhura's commitments when we process personal data on your behalf: roles, purposes, security, sub-processors, transfers, breach notice and deletion.",
    wordCount: 900,
    link: { label: "Subprocessors", to: "/legal/subprocessors" },
    meta: {
      title: "Data Processing Addendum (DPA) | Madhura",
      description:
        "The Madhura Data Processing Addendum: controller and processor roles, processing purposes, data and data subject categories, security measures, breach notification, audit rights and deletion on termination.",
    },
    document: {
      title: "Data Processing Addendum",
      subtitle:
        "This addendum sets out how Madhura Technologies processes personal data on your behalf when you use the platform, and the safeguards that apply to that processing.",
      lastUpdated: "October 2026",
      owner: "Legal & Compliance",
    },
    sections: [
      {
        id: "scope",
        heading: "1. Scope and roles",
        paragraphs: [
          "This Data Processing Addendum (the “DPA”) applies when you use the Madhura platform to process personal data about your own customers, contacts or staff. It forms part of, and is incorporated into, the agreement between you and Madhura under our Terms of Service.",
          "For that processing you are the data controller — or a processor acting on behalf of a third-party controller — and Madhura Technologies Private Limited is the data processor. Each party remains responsible for its own compliance under applicable data protection law.",
        ],
        list: [
          "Controller: you — the business that decides why and how end-customer data is messaged and stored",
          "Processor: Madhura — we process only on your documented instructions, given through the platform",
          "Independent controller: Madhura — account, billing, security and website data we determine for our own purposes, described in our Privacy Policy",
        ],
      },
      {
        id: "purposes",
        heading: "2. Processing purposes and instructions",
        paragraphs: [
          "We process personal data only to provide the platform: to send and receive WhatsApp messages, store contact records and conversation history, run campaigns and automations, produce analytics, provide support and keep the service secure. Your instructions are the configuration you apply in the product and the documented requests you make through it or through our API.",
          "If we become aware that an instruction appears to infringe applicable data protection law, we will inform you unless the law forbids us from doing so. We assist you, at no additional cost where the request concerns our processing, with data subject requests, data protection impact assessments and communications with supervisory authorities.",
        ],
      },
      {
        id: "data-and-subjects",
        heading: "3. Categories of data and data subjects",
        paragraphs: [
          "The exact categories depend on what you put into the platform. The sets below are the ones we typically process on your behalf.",
        ],
        list: [
          "Data subjects: your customers and prospects, your agents and administrators, and contacts at your suppliers who write to you",
          "Contact data: names, phone numbers, email addresses, language, timezone and any custom fields you define",
          "Messaging data: message text, media, template names and categories, delivery receipts, thread state and timestamps",
          "Commercial data: order references, appointment details, payment status flags and consent records you maintain",
          "Technical data: IP address, device and browser characteristics, and API access logs associated with platform use",
        ],
      },
      {
        id: "subprocessors",
        heading: "4. Sub-processors",
        paragraphs: [
          "You authorise us to engage sub-processors to deliver the service. Each is bound by written terms that impose protections no less protective than those in this DPA, and we remain responsible for their performance as if it were our own.",
          "The current categories of sub-processor, and the commitments that apply to every one of them, are published on our Subprocessor page at /legal/subprocessors. We give at least 30 days' notice before adding a sub-processor that materially affects your processing, and you may object during that window as described there.",
        ],
      },
      {
        id: "international",
        heading: "5. International transfers",
        paragraphs: [
          "We process data in India and in the regions where our infrastructure operates. Where a transfer crosses a border that data protection law treats as restricted — for example from the EEA or the UK to another country — we rely on a recognised transfer mechanism rather than assuming the destination is equivalent.",
        ],
        list: [
          "An adequacy decision, where the relevant authority has issued one for the destination",
          "The EU standard contractual clauses, or the UK International Data Transfer Addendum, with the transfer impact assessment they require",
          "Supplementary technical measures: encryption in transit and at rest, tenant isolation and least-privilege access",
          "A record of transfers and the mechanism used, available to you on reasonable request",
        ],
      },
      {
        id: "security",
        heading: "6. Annex A — Security measures",
        paragraphs: [
          "We implement technical and organisational measures appropriate to the risk, summarised below and described in full on our Security page. The measures are reviewed at least annually and updated as the risk or the service changes.",
        ],
        list: [
          "Encryption in transit with TLS 1.2 or higher and AES-256 at rest, with secrets held in a managed store",
          "Role-based access control, mandatory multi-factor authentication for staff and logged, time-limited production access",
          "Tenant isolation enforced in the data access layer, with automated tests that fail the build on regression",
          "Append-only audit logging of every mutating action, retained for 12 months",
          "Encrypted backups with point-in-time recovery and monthly restore verification",
          "Peer review, dependency scanning, annual external penetration testing and a documented incident response process",
        ],
      },
      {
        id: "breach",
        heading: "7. Breach notification",
        paragraphs: [
          "We will notify you without undue delay, and in any event within 48 hours, after becoming aware of a personal data breach affecting your personal data. The notice will describe what happened, the categories and approximate numbers of records affected, the likely consequences and the measures taken or proposed.",
          "We will provide the information you need to meet your own notification obligations to supervisory authorities and to affected individuals, and we will not communicate with your data subjects about the breach without your prior instructions unless the law requires us to.",
        ],
      },
      {
        id: "audit",
        heading: "8. Audit and inspection rights",
        paragraphs: [
          "On reasonable written notice, you may verify our compliance with this DPA. Most requests are answered with documentation — security documentation, certifications and the results of independent assessments — so that audits are not duplicated across customers.",
        ],
        list: [
          "One audit per 12-month period, unless a supervisory authority requires otherwise",
          "At least 30 days' notice, during business hours, and without unreasonably disrupting the service",
          "Your personnel bound by confidentiality and our security requirements for the duration",
          "A written remediation plan with dates for any material finding we accept",
        ],
      },
      {
        id: "deletion",
        heading: "9. Return and deletion on termination",
        paragraphs: [
          "When the agreement ends you may export your data during the 30-day window described in our Data Deletion Policy. After that window we delete or return personal data at your election, and permanently delete it within 90 days, except where we are required by law to retain it.",
          "Deletion covers production copies; archived backup copies are purged on their normal rotation cycle within the same period. We will confirm completion in writing when you ask.",
        ],
      },
    ],
    related: ["/legal/subprocessors", "/legal/data-deletion", "/legal/sla"],
  },

  "/legal/acceptable-use": {
    path: "/legal/acceptable-use",
    section: "Legal",
    renderer: "legal",
    title: "Acceptable Use Policy",
    description:
      "What may and may not be sent through the Madhura platform: prohibited content, scraping, reverse engineering, rate limits, opt-in rules and enforcement.",
    wordCount: 900,
    link: { label: "Messaging & Consent Policy", to: "/legal/messaging-consent" },
    meta: {
      title: "Acceptable Use Policy | Madhura",
      description:
        "Prohibited content and goods under WhatsApp's Messaging Policy, bans on scraping and reverse engineering, rate limits, spam and opt-in rules, enforcement and how to report a violation.",
    },
    document: {
      title: "Acceptable Use Policy",
      subtitle:
        "This policy sets out what may and may not be sent through the Madhura platform, and what happens when these rules are broken.",
      lastUpdated: "October 2026",
      owner: "Legal & Compliance",
    },
    sections: [
      {
        id: "scope",
        heading: "1. Scope and your responsibilities",
        paragraphs: [
          "This Acceptable Use Policy (the “AUP”) supplements our Terms of Service and applies to everyone who uses the platform under your account — your administrators, your agents and anyone else you authorise to send through it.",
          "You are responsible for the messages you send and for holding a lawful basis for each one. Your use must comply with applicable law and with WhatsApp's Messaging Policy, WhatsApp's Commerce Policy and Meta's terms for the WhatsApp Business Platform. We provide the tooling, and we enforce this policy where a workspace uses it in a way that risks recipients, the channel or our other customers.",
        ],
      },
      {
        id: "prohibited-content",
        heading: "2. Prohibited content and goods",
        paragraphs: [
          "The platform may not be used to send content that WhatsApp's Messaging Policy prohibits, or that is unlawful where the recipient lives. The summary below covers the main categories; it is not exhaustive, and a category that is lawful in one country may not be lawful in another.",
        ],
        list: [
          "Illegal goods and services — controlled drugs, stolen goods, counterfeit documents, and restricted items sold without the required licence",
          "Violence and harm — graphic violence, credible threats, incitement, or content that facilitates harm to people or animals",
          "Hate and harassment — attacks on people because of protected characteristics, abuse, doxxing, or unsolicited sexual content directed at an individual",
          "Adult content — pornography, escort services and sexually explicit commercial offers",
          "Malware and phishing — links or files that distribute malware, harvest credentials or impersonate another brand",
          "Deception — scams, fake prize draws, impersonation of public bodies, and misleading health or financial claims",
        ],
      },
      {
        id: "data-collection",
        heading: "3. No scraping or harvesting",
        paragraphs: [
          "Do not collect phone numbers or profile data by scraping WhatsApp, another messaging service, a public directory or any third-party source. Do not upload lists you bought, rented or inherited unless you can show that every person on them gave documented opt-in to messages from you — not merely to the party who sold you the list.",
          "Consent is purpose-specific. Collecting details through a form, an event or a purchase does not authorise unrelated marketing messaging, and a contact who agreed to order updates has not agreed to promotions.",
        ],
      },
      {
        id: "platform-integrity",
        heading: "4. No reverse engineering or circumvention",
        paragraphs: [
          "You may not reverse engineer, decompile or attempt to derive the source code of the platform, extract internal prompts or model configuration from the AI features, bypass authentication or permission checks, or probe for vulnerabilities outside our published disclosure programme.",
          "You may not resell, white-label or sublicense the platform except under a written partner agreement, and you may not share a single seat across people it was not licensed for.",
        ],
      },
      {
        id: "rate-limits",
        heading: "5. Rate limits and channel health",
        paragraphs: [
          "Platform rate limits, API quotas and per-number messaging limits protect deliverability for everyone on the channel. Do not work around them by rotating numbers to reach the same audience, and do not drive traffic beyond the throughput your plan and your number's quality rating allow.",
          "Where we detect abusive volume we may throttle or pause sends automatically. That is a protective measure rather than a penalty: the platform shows you which limit was hit and what to change before sending resumes.",
        ],
      },
      {
        id: "opt-in",
        heading: "6. Spam, opt-in and opt-out",
        paragraphs: [
          "Every recipient must have given documented opt-in for the specific messages you send, before you send them. Opt-out requests must be honoured immediately and permanently across campaigns, automations and manual replies alike. Our Messaging & Consent Policy sets out the mechanics in detail.",
        ],
        list: [
          "Record where, when and how each contact opted in, and exactly what they were told",
          "Identify your business clearly in the first message you send to a new contact",
          "Send only what the contact agreed to receive; never repurpose one consent for another purpose",
          "Suppress opted-out contacts at send time, in every channel, automation and campaign",
        ],
      },
      {
        id: "enforcement",
        heading: "7. Enforcement",
        paragraphs: [
          "We prefer to warn and remediate. Depending on the risk, we may throttle sending, block a specific template or automation, suspend a number or a whole workspace, or terminate the agreement. Suspension may be immediate where continued use would risk a regulatory breach, a Meta quality ban or harm to recipients.",
          "If you believe a restriction was applied in error, write to legal@madhura.co with the workspace name and the timeline. Reinstatement requests are reviewed on a prioritised basis and, where the cause is fixed, sending is restored without waiting for the next billing cycle.",
        ],
      },
      {
        id: "reporting",
        heading: "8. Reporting violations",
        paragraphs: [
          "To report a workspace using the platform in violation of this policy — unsolicited messages, prohibited content, impersonation — email legal@madhura.co with the phone number or business involved, copies of the messages, the dates, and how you came to receive them.",
          "We acknowledge reports within 5 business days and act on credible ones that endanger recipients. This address is not a support channel; questions about your own workspace go through normal support.",
        ],
      },
    ],
    related: ["/legal/messaging-consent", "/legal/sla", "/legal/subprocessors"],
  },

  "/legal/refunds": {
    path: "/legal/refunds",
    section: "Legal",
    renderer: "legal",
    title: "Refund & Cancellation Policy",
    description:
      "Billing cycles, cancellations and refund eligibility for Madhura subscriptions, including what is and is not refundable.",
    wordCount: 900,
    link: { label: "Service Level Agreement", to: "/legal/sla" },
    meta: {
      title: "Refund & Cancellation Policy | Madhura",
      description:
        "How Madhura subscriptions are billed, how to cancel, when a refund is available (14 days from first purchase within usage limits), what is non-refundable and how long refunds take.",
    },
    document: {
      title: "Refund & Cancellation Policy",
      subtitle:
        "This policy explains how subscriptions are billed and cancelled, when a refund is available, and how to request one.",
      lastUpdated: "October 2026",
      owner: "Legal & Compliance",
    },
    sections: [
      {
        id: "billing-cycles",
        heading: "1. Billing cycles",
        paragraphs: [
          "Paid plans are billed in advance — monthly or annually — to the payment method on file, plus applicable taxes. Charges that vary with usage, such as message volume beyond your plan allowance, are billed in arrears on the following invoice.",
          "Your renewal date, plan and current invoices are shown in workspace settings. Invoices are issued on the billing date and are payable on receipt under our Terms of Service.",
        ],
      },
      {
        id: "monthly-annual",
        heading: "2. Monthly and annual plans",
        paragraphs: [
          "Monthly plans renew automatically on the billing date until you cancel. Annual plans are charged once at the start of the term and renew once a year; we send a reminder before an annual renewal so the charge is never a surprise.",
          "Upgrades take effect immediately and are prorated for the remainder of the cycle. Downgrades take effect at the next renewal — we do not refund the difference for a period you have already paid for on a higher tier.",
        ],
      },
      {
        id: "cancellation",
        heading: "3. Cancelling your subscription",
        paragraphs: [
          "You can cancel at any time from workspace settings, or by writing to legal@madhura.co from the email address on the account. Cancellation stops the next renewal: the workspace stays active, with full features, until the end of the period you have already paid for.",
          "When that period ends the workspace enters a 30-day grace period in which you can export your data. The retention and deletion steps in our Data Deletion Policy then apply. Cancelling does not delete your data early, and it does not remove your obligation to pay charges already incurred.",
        ],
      },
      {
        id: "eligibility",
        heading: "4. Refund eligibility",
        paragraphs: [
          "Your first purchase is eligible for a full refund within 14 days of the first payment, provided usage during that window has not exceeded the plan's usage limits for messages, seats or contact tiers. We check those limits against our records before approving.",
          "Renewal invoices are generally non-refundable once the new term has started, because the workspace remains available for it. Where the service fails to perform materially in accordance with its documentation and we cannot re-perform, the warranty in our Terms applies: you may terminate and receive a pro-rata refund of prepaid fees.",
        ],
      },
      {
        id: "statutory-rights",
        heading: "5. Your statutory rights",
        paragraphs: [
          "Nothing in this policy limits rights you have under consumer protection law in your jurisdiction. Where local law provides a longer cooling-off period or a mandatory refund right, that law prevails over the 14-day window described above. The window is our voluntary commitment, offered in addition to those rights.",
        ],
      },
      {
        id: "non-refundable",
        heading: "6. What is not refundable",
        paragraphs: [
          "The following are outside refund eligibility, except where applicable law requires otherwise.",
        ],
        list: [
          "WhatsApp conversation fees charged by Meta and its messaging providers — billed to you at cost and outside our control",
          "Professional services, onboarding, migration or configuration work already delivered",
          "Third-party charges incurred on your behalf, such as phone numbers, where the provider does not refund them",
          "Partial periods after the 14-day first-purchase window, and taxes already remitted",
        ],
      },
      {
        id: "how-to-request",
        heading: "7. How to request a refund",
        paragraphs: [
          "Email legal@madhura.co from the address on the account with the workspace name, the invoice number, the reason for the request and the dates concerned. If you are within the 14-day first-purchase window, include a rough figure for messages sent and seats used so we can verify the usage limits in one pass.",
          "We acknowledge every request within 3 business days and come back once if we need anything further. Requests about Meta conversation fees are passed to the relevant provider with our records attached.",
        ],
      },
      {
        id: "processing",
        heading: "8. Processing time and method",
        paragraphs: [
          "Approved refunds are issued within 10 business days of approval, back to the original payment method. Your bank or card issuer may take a further 5 to 10 business days to show the credit; we provide the refund reference as soon as it is issued so you can trace it.",
          "If the original method is no longer valid, we will agree an alternative with you in writing before issuing the refund by bank transfer.",
        ],
      },
      {
        id: "disputes",
        heading: "9. Disputes and chargebacks",
        paragraphs: [
          "Please raise billing concerns with us before filing a chargeback — most are resolved within a day once we can see the invoice in question. Raising a chargeback for a valid invoice while it is under review may lead us to suspend the workspace until the matter is settled, because the funds are held by the issuer during the dispute.",
        ],
      },
    ],
    related: ["/legal/sla", "/legal/acceptable-use", "/legal/data-deletion"],
  },

  "/legal/sla": {
    path: "/legal/sla",
    section: "Legal",
    renderer: "legal",
    title: "Service Level Agreement",
    description:
      "Madhura's availability target, what it excludes, how availability is measured, incident severity and response targets, and the service credit process.",
    wordCount: 900,
    link: { label: "Subprocessors", to: "/legal/subprocessors" },
    meta: {
      title: "Service Level Agreement | Madhura",
      description:
        "Availability target, measurement method, exclusions, incident severity and response targets, service credit tiers and how to claim them under the Madhura SLA framework.",
    },
    document: {
      title: "Service Level Agreement",
      subtitle:
        "This document describes our availability commitment, how it is measured, what is excluded, and the credits available when we miss it.",
      lastUpdated: "October 2026",
      owner: "Legal & Compliance",
    },
    sections: [
      {
        id: "commitment",
        heading: "1. Service commitment",
        paragraphs: [
          "Madhura targets monthly availability of 99.9% for the hosted platform — the shared inbox, contact management, templates, campaigns, automations, flows, analytics and the REST API — measured as described in section 3.",
          "This document is the standard framework. The commitment that legally binds us is the SLA schedule attached to your plan or order form; where your plan's schedule differs from this framework, the schedule prevails. The 99.9% figure is an agreement target for the month as a whole, not a certification, an audit result or a promise of uninterrupted service minute by minute.",
        ],
      },
      {
        id: "exclusions",
        heading: "2. Exclusions",
        paragraphs: [
          "Time is not counted as downtime when unavailability arises from causes outside the service boundary:",
        ],
        list: [
          "Scheduled maintenance announced at least 48 hours in advance, up to the maintenance allowance in your SLA schedule",
          "Force majeure — internet failures, extreme weather, war, labour action, or government or regulatory action",
          "Third-party services outside our control, including Meta's WhatsApp platform, your carrier, DNS providers and the recipient's device",
          "Issues in your configuration, custom integrations, credentials you exposed, or your use beyond documented limits",
          "Preview, beta or trial features, which are provided without an availability commitment",
        ],
      },
      {
        id: "measurement",
        heading: "3. Measuring availability",
        paragraphs: [
          "We measure availability continuously with external synthetic checks against the web application and the API from multiple regions, backed by internal health telemetry. A minute counts as unavailable when those checks fail for the whole minute and no healthy region responds.",
          "Monthly availability is the ratio of available minutes to total minutes in the calendar month, after removing the maintenance allowance and the other excluded periods. Our monitoring record is the basis for every credit claim; incident timelines are published on our status page, and we will share the record for your workspace on request.",
        ],
      },
      {
        id: "severity",
        heading: "4. Incident severity and response targets",
        paragraphs: [
          "Incidents are classified when first triaged and re-classified as facts change. Response means an initial human acknowledgement with a named owner and an ETA — not a full resolution.",
        ],
        list: [
          "Severity 1 — the platform, or sending and receiving, is unavailable for most users: response within 1 hour, updates at least hourly, around the clock",
          "Severity 2 — major degradation such as delivery delays or a core feature unusable by many users: response within 4 business hours, updates daily",
          "Severity 3 — minor degradation, or a single workspace affected: response within 1 business day",
          "Severity 4 — questions, requests for help and non-urgent issues: response within 2 business days",
        ],
      },
      {
        id: "credits",
        heading: "5. Service credits",
        paragraphs: [
          "If we miss the monthly availability target for reasons within our control, your workspace is eligible for a service credit against the next subscription invoice. The standard ladder below applies where your plan's SLA schedule does not specify a different one. Percentages are of the subscription fee for the affected month.",
        ],
        list: [
          "Availability of 99.0% or more but below 99.9% — a 10% credit",
          "Availability below 99.0% but 95.0% or more — a 25% credit",
          "Availability below 95.0% — a 50% credit",
        ],
      },
      {
        id: "claiming",
        heading: "6. Claiming service credits",
        paragraphs: [
          "Email legal@madhura.co within 30 days of the end of the affected month with your workspace name, the month, the approximate times you were affected and a short description of the impact. We reconcile the claim against our monitoring record — the two usually agree — and confirm the outcome in writing.",
          "Credits are applied to your next invoice, are not payable in cash, and are your sole financial remedy for an availability miss. Claims received after the 30-day window, or that we can show did not meet the target, are not eligible.",
        ],
      },
      {
        id: "escalation",
        heading: "7. Support and escalation",
        paragraphs: [
          "Support requests go through the channels on our Contact page. Severity-1 incidents can be raised there around the clock on plans that include 24×7 support, and every workspace has a documented escalation path to an on-call engineer. Enterprise customers have a named contact and an agreed escalation tree.",
        ],
      },
      {
        id: "changes",
        heading: "8. Changes to this SLA",
        paragraphs: [
          "We may update this framework as the service evolves. Changes never reduce the commitment in your plan's SLA schedule during a committed term. We post the updated version on this page and, for material changes, notify workspace administrators at least 30 days before it takes effect.",
        ],
      },
    ],
    related: ["/legal/refunds", "/legal/subprocessors", "/legal/dpa"],
  },

  "/legal/subprocessors": {
    path: "/legal/subprocessors",
    section: "Legal",
    renderer: "legal",
    title: "Subprocessors",
    description:
      "The categories of third party that process data to run Madhura, the terms that bind every one of them, and how to subscribe to change notices.",
    wordCount: 900,
    link: { label: "Data Processing Addendum", to: "/legal/dpa" },
    meta: {
      title: "Subprocessor List | Madhura",
      description:
        "Madhura's subprocessors by category — cloud hosting, email delivery, analytics, payment processing and customer support tooling — with flow-down terms, change notice, objection rights and subscription options.",
    },
    document: {
      title: "Subprocessors",
      subtitle:
        "The third parties that process personal data so the Madhura platform can run, the commitments we impose on every one of them, and how you stay informed about changes.",
      lastUpdated: "October 2026",
      owner: "Legal & Compliance",
    },
    sections: [
      {
        id: "purpose",
        heading: "1. Why we use subprocessors",
        paragraphs: [
          "Madhura is a hosted service, and specialised third parties handle parts of it — infrastructure, delivery, payments and support. Each of them processes some personal data on our behalf, and each is engaged under a written agreement that mirrors the protections in our Data Processing Addendum.",
          "You remain the controller of the data you bring to the platform; engaging a subprocessor does not change your instructions to us or our responsibility for what they do with your data.",
        ],
      },
      {
        id: "categories",
        heading: "2. Categories of subprocessor",
        paragraphs: [
          "We publish this list at category level: the reasons we involve each kind of vendor change far less often than the vendor's name, and the category tells you precisely what sort of access exists. Purpose and typical data are set out below.",
        ],
        list: [
          "Cloud infrastructure provider — hosting, compute, object storage and databases — stores contact records, message history and application data",
          "Email delivery provider — transactional email for invitations, alerts and billing — processes names, email addresses and the content of those notices",
          "Analytics provider — product and website usage statistics on pseudonymised or aggregated data — processes identifiers and usage events",
          "Payment processing provider — subscription billing, invoicing and tax calculation — processes billing details; full card numbers are held by that provider, never by us",
          "Customer support tooling — ticketing and live support — processes your team's contact details, support correspondence and diagnostic data",
        ],
      },
      {
        id: "messaging",
        heading: "3. Messaging carried by Meta",
        paragraphs: [
          "Messages sent over WhatsApp necessarily pass through Meta's WhatsApp Business Platform before they reach the recipient. Meta processes that data under its own terms — the WhatsApp Business Messaging Terms and Meta's Privacy Policy — and is not a subprocessor engaged under this page.",
          "Template names, categories, quality ratings and aggregated delivery statistics are shared with Meta as part of operating the channel. Our Privacy Policy explains this relationship in full.",
        ],
      },
      {
        id: "commitments",
        heading: "4. Commitments that apply to every subprocessor",
        paragraphs: [
          "The same obligations follow every category on this list, whether the vendor is large or small.",
        ],
        list: [
          "Written terms no less protective than our Data Processing Addendum, including confidentiality and security obligations",
          "Processing only on our documented instructions, limited to what the service actually needs",
          "Assessment before onboarding: security review, data-flow mapping and contractual checks",
          "Re-assessment at least annually, and immediate replacement if the vendor no longer meets our requirements",
          "No sale of personal data, and no use of your data for the vendor's own advertising",
        ],
      },
      {
        id: "changes",
        heading: "5. Notice of changes and your right to object",
        paragraphs: [
          "Additions and removals are published on this page with their effective date. Before we add a subprocessor that materially affects your processing, we give at least 30 days' notice by email to workspace administrators.",
          "If you object in writing during that window, we will work with you on a reasonable alternative — for example a different region or an exclusion for your workspace. If we cannot agree, you may terminate the affected service without penalty and we will refund the prepaid fees for the terminated portion.",
        ],
      },
      {
        id: "assessment",
        heading: "6. How we select them",
        paragraphs: [
          "Selection starts with necessity: a vendor is added only where the service genuinely needs it. We then assess the security controls, the legal environment of the processing location, whether the vendor relies on its own subprocessors, and the contractual protections available.",
          "A vendor that fails the assessment is not engaged, and one that stops meeting it after onboarding is replaced. Records of each assessment are retained and available to enterprise customers under NDA.",
        ],
      },
      {
        id: "subscribe",
        heading: "7. How to subscribe to updates",
        paragraphs: [
          "Email legal@madhura.co from a workspace administrator address to join the sub-processor notification list; we confirm by reply and send notice of material changes 30 days before they take effect. The list on this page is always current, so you can also check it directly at any time.",
          "Enterprise customers can receive notices through their named contact or pushed into a ticketing webhook instead of email.",
        ],
      },
      {
        id: "contact",
        heading: "8. Contact",
        paragraphs: [
          "Questions about a specific vendor, the safeguards in place, or a request for the underlying flow-down terms under NDA: legal@madhura.co. Our Data Processing Addendum and Security page describe the protections that apply to every entry on this list.",
        ],
      },
    ],
    related: ["/legal/dpa", "/legal/data-deletion", "/legal/sla"],
  },

  "/legal/data-deletion": {
    path: "/legal/data-deletion",
    section: "Legal",
    renderer: "legal",
    title: "Data Deletion Policy",
    description:
      "What happens when a Madhura account closes: the 30-day grace period, the permanent purge timeline, what is retained and why, and how to request deletion.",
    wordCount: 900,
    link: { label: "Data Processing Addendum", to: "/legal/dpa" },
    meta: {
      title: "Data Deletion Policy | Madhura",
      description:
        "Account closure, the 30-day grace period and purge within 90 days, what is retained for billing and security and for how long, exports, early deletion requests and identity verification.",
    },
    document: {
      title: "Data Deletion Policy",
      subtitle:
        "This policy explains what happens to data held in a Madhura workspace when the account closes, what we retain afterwards, and how to request deletion sooner.",
      lastUpdated: "October 2026",
      owner: "Legal & Compliance",
    },
    sections: [
      {
        id: "scope",
        heading: "1. Scope and who may request",
        paragraphs: [
          "This policy applies to a workspace that is closed by an administrator or terminated by us under the Terms, and to individual requests for erasure of personal data.",
          "Where you are our customer, data about your end-customers is held on your behalf. Erasure requests from them should reach you first as the controller; we will assist you in fulfilling them and, where we act as processor, we delete only on your instruction.",
        ],
      },
      {
        id: "closure",
        heading: "2. What happens when an account closes",
        paragraphs: [
          "When the workspace closes, sending stops immediately and every user access is revoked. Nothing is purged that day: a 30-day grace period begins, during which an administrator can reactivate the workspace exactly as it was, or export everything before deletion starts.",
          "The grace period exists because deletion is irreversible. It is your last chance to recover a workspace closed by mistake, and it is included in every plan at no cost.",
        ],
      },
      {
        id: "timeline",
        heading: "3. Deletion timeline",
        paragraphs: [
          "The full schedule from closure to purge is set out below. We will confirm completion in writing when you ask.",
        ],
        list: [
          "Day 0 — account closed: sending disabled, all user access revoked",
          "Days 1 to 30 — grace period: full export available, reactivation restores the workspace",
          "Day 31 — permanent deletion begins for workspace data in production systems",
          "Within 90 days of day 31 — purge completed across production and archived backup copies; we confirm on request",
        ],
      },
      {
        id: "retained",
        heading: "4. What we keep, why, and for how long",
        paragraphs: [
          "Deletion does not remove records we must keep for legal, tax or security reasons. These are held separately from the workspace, are not used to operate any service, and expire on their own schedule.",
        ],
        list: [
          "Invoices, payment references and tax records — 7 years, to meet accounting and tax law",
          "Security and audit logs — 12 months, to investigate fraud, abuse and unauthorised access",
          "Consent and opt-out records for messaging — the life of the consent plus 3 years, to evidence a lawful basis",
          "The deletion request itself and our confirmation — 3 years, to demonstrate compliance",
          "Aggregated usage statistics — indefinitely, but only with identifiers removed and not re-identifiable",
        ],
      },
      {
        id: "export",
        heading: "5. Export before you delete",
        paragraphs: [
          "Export first. From workspace settings you can download contacts and conversation history as CSV or JSON, and pull everything through the REST API while the grace period runs. Exports include tags, custom fields, consent state, assignment history and thread content.",
          "Once production deletion starts, nothing can be reconstructed — we cannot restore a closed workspace — so we warn administrators again before the grace period expires.",
        ],
      },
      {
        id: "early-deletion",
        heading: "6. Requesting early or partial deletion",
        paragraphs: [
          "To delete data before the workspace closes — a single contact, an import batch, a branch or the whole workspace — email legal@madhura.co from a workspace administrator address, or use the delete action in the product where one is offered. Deleting a contact can cascade to its conversation history if you choose.",
          "For personal data we process as a processor, we forward the request to the relevant customer and act on their instructions, and we assist with verification where you ask us to.",
        ],
      },
      {
        id: "verification",
        heading: "7. Verifying a request",
        paragraphs: [
          "Because deletion is irreversible, we verify before acting. Administrator requests must come from the account email and pass a workspace-level confirmation. Individual requests must be matched to a record, and we ask for proof of identity only where the request cannot otherwise be tied to data we hold — we do not collect identity documents by default.",
          "We acknowledge requests within 5 business days and complete verified ones within 30 days, telling you if we need longer and why.",
        ],
      },
      {
        id: "holds",
        heading: "8. Legal holds and exceptions",
        paragraphs: [
          "We may retain data longer where the law, a legal process or a documented legal hold requires it — for example under a court order, an active dispute or a regulatory investigation. When the hold ends, the normal schedule resumes and the data is deleted.",
          "Holds are recorded against the affected records so that a deletion request suspended by a hold is not forgotten when the hold is released.",
        ],
      },
    ],
    related: ["/legal/dpa", "/legal/subprocessors", "/legal/refunds"],
  },

  "/legal/messaging-consent": {
    path: "/legal/messaging-consent",
    section: "Legal",
    renderer: "legal",
    title: "Messaging & Consent Policy",
    description:
      "Opt-in, opt-out, template, frequency and quiet-hour rules for messaging sent through Madhura, aligned with WhatsApp's Messaging and Commerce Policies.",
    wordCount: 900,
    link: { label: "Acceptable Use Policy", to: "/legal/acceptable-use" },
    meta: {
      title: "Messaging & Consent Policy | Madhura",
      description:
        "Opt-in requirements and permitted channels, template approval, STOP and UNSUBSCRIBE handling, frequency and quiet hours, WhatsApp Commerce Policy alignment, consent records and consequences of non-compliance.",
    },
    document: {
      title: "Messaging & Consent Policy",
      subtitle:
        "The consent rules that apply to every message sent through the Madhura platform, and what happens when they are not followed.",
      lastUpdated: "October 2026",
      owner: "Legal & Compliance",
    },
    sections: [
      {
        id: "scope",
        heading: "1. Scope and responsibilities",
        paragraphs: [
          "This policy sets the consent rules for messaging sent through the platform. It sits alongside WhatsApp's Messaging Policy, WhatsApp's Commerce Policy and the messaging and privacy law that applies where your recipients live — comply with all of them, not just this document.",
          "You are the sender, and you must hold a lawful basis for each message. We provide the tooling — opt-in capture, consent records, suppression lists, approved templates and frequency caps — and we may throttle or suspend sending where those tools are bypassed.",
        ],
      },
      {
        id: "opt-in",
        heading: "2. Opt-in requirements",
        paragraphs: [
          "Consent must be freely given, specific, informed and unambiguous: an active action by the person, never a pre-ticked box or an assumption drawn from an existing relationship. At the point of opt-in, say who you are, what you will send, how often, and how to stop.",
        ],
        list: [
          "Record the timestamp, the source and the exact wording shown at opt-in",
          "Hold a separate consent per purpose — order updates, marketing and appointment reminders are not interchangeable",
          "Never make a purchase or a service conditional on receiving marketing messages",
          "Re-permission any contact whose consent evidence you cannot produce",
        ],
      },
      {
        id: "channels",
        heading: "3. Permitted opt-in channels",
        paragraphs: [
          "Consent may be collected through your website forms, your checkout, an in-app prompt, a QR code or sign-up sheet in store, an IVR menu prompt, a confirmation email, or a support conversation in which the person asked to be messaged.",
          "Lists bought, rented or scraped are never a permitted source, and neither is a partner's list unless you can produce that partner's own consent evidence for your messages. An inbound message to your business is consent for a reply within the service window, not for a marketing campaign.",
        ],
      },
      {
        id: "templates",
        heading: "4. Message templates and approval",
        paragraphs: [
          "Outside the 24-hour customer service window, WhatsApp requires an approved message template. Templates must identify who is sending, must not mislead, and must not contain content this policy or WhatsApp's Messaging Policy prohibits.",
          "We help you author, validate and submit templates and we track their status in the product. Approval and category assignment are Meta's decisions, not ours, and we cannot guarantee approval or a particular quality rating.",
        ],
      },
      {
        id: "opt-out",
        heading: "5. Opt-out handling",
        paragraphs: [
          "STOP, UNSUBSCRIBE, STOPALL, CANCEL, END and QUIT — and any reasonable free-text equivalent such as “remove me” — must end messaging immediately. We honour keyword opt-outs at platform level: the contact is flagged before dispatch, so campaigns, automations and manual sends are all blocked.",
          "Never re-add an opted-out contact. Re-consent must come from them and must be recorded as a new event with its own evidence.",
        ],
      },
      {
        id: "frequency",
        heading: "6. Frequency and quiet hours",
        paragraphs: [
          "Send at the rate you promised at opt-in, and no faster. Use the platform's frequency caps so a contact cannot be over-messaged across all campaigns and automations combined, and respect each contact's local timezone rather than your own.",
          "Quiet hours suppress non-urgent sends outside the window you configure; automated sends default away from late-night and early-morning hours. Urgent transactional messages can be exempted, but should still respect local norms and the recipient's expectations.",
        ],
      },
      {
        id: "commerce",
        heading: "7. Alignment with WhatsApp's Commerce Policy",
        paragraphs: [
          "If you sell through WhatsApp, the goods and services you offer must be permitted by WhatsApp's Commerce Policy, and your catalogue, prices and descriptions must be accurate and match what you actually deliver.",
          "Prohibited and restricted items — set out in our Acceptable Use Policy — are not allowed regardless of how much consent you hold. Consent to receive a message is not permission to offer something the channel forbids.",
        ],
      },
      {
        id: "prohibited",
        heading: "8. Prohibited messaging",
        paragraphs: [
          "The following are prohibited through the platform, without exception.",
        ],
        list: [
          "Unsolicited bulk messages, and any message sent without evidence of opt-in",
          "Purchased, rented or scraped contact lists",
          "Misleading claims, impersonation, or content that WhatsApp's Messaging Policy prohibits",
          "Messages to a contact who has blocked, reported or opted out of you",
          "Circumventing messaging limits by rotating numbers to reach the same people",
        ],
      },
      {
        id: "records",
        heading: "9. Record-keeping",
        paragraphs: [
          "Keep consent evidence for the life of the consent plus 3 years — our consent records do this automatically for contacts onboarded through the platform. Each record holds the source, timestamp, wording shown, the messages sent under it, and every opt-out event that followed.",
          "Records are exportable at any time as CSV, so you can produce evidence for a regulator, a Meta review or an internal audit without reconstructing it from spreadsheets.",
        ],
      },
      {
        id: "consequences",
        heading: "10. Consequences of non-compliance",
        paragraphs: [
          "Breaches have consequences at three levels. Meta may reject templates, downgrade your quality rating, restrict messaging limits or suspend your number. Regulators may act against you for unlawful messaging, with penalties set by local law. And we may throttle or suspend sending, or terminate the agreement, under our Acceptable Use Policy.",
          "We will usually warn you first when there is time to fix the problem, and our team will tell you exactly which rule was hit and what to change — but we will not wait to be asked when recipients are being harmed.",
        ],
      },
    ],
    related: ["/legal/acceptable-use", "/legal/dpa", "/legal/data-deletion"],
  },

  "/accessibility": {
    path: "/accessibility",
    section: "Legal",
    renderer: "legal",
    title: "Accessibility Statement",
    description:
      "Madhura's commitment to an accessible website and platform, the standards we work to, what is and is not yet conformant, and how to report a barrier.",
    wordCount: 700,
    link: { label: "Contact support", to: "/support" },
    meta: {
      title: "Accessibility Statement | Madhura",
      description:
        "How Madhura approaches accessibility across its website and WhatsApp CRM platform, the standards we target, known limitations, and how to report a barrier.",
    },
    document: {
      title: "Accessibility Statement",
      subtitle:
        "This statement explains how Madhura approaches accessibility for its website, marketing content and the WhatsApp CRM platform, and what to do if something gets in your way.",
      lastUpdated: "October 2026",
      owner: "Legal & Compliance",
    },
    sections: [
      {
        id: "commitment",
        heading: "1. Our commitment",
        paragraphs: [
          "We want people who use Madhura — customers, prospects, evaluators and visitors — to be able to find information, complete tasks and get help regardless of the device, browser, assistive technology or input method they use. Accessibility is treated as a requirement in how we design and build, not as a clean-up pass before release.",
          "This statement covers the public marketing website, the help and documentation content published on it, and the authenticated platform at large. Where a part of the product has a known barrier, we say so below rather than letting the silence stand in for an answer.",
        ],
      },
      {
        id: "standard",
        heading: "2. The standard we work to",
        paragraphs: [
          "We aim to conform with the Web Content Accessibility Guidelines (WCAG) 2.2 at Level AA. Those guidelines explain how to make content perceivable, operable, understandable and robust — for example: sufficient colour contrast, keyboard reachability, visible focus, text that reflows without loss of content, and labels that name controls for screen readers.",
          "Conformance is assessed with a mix of automated tooling, manual keyboard-only passes, screen reader checks on the flows that matter most (sign-in, inbox, contacts, campaign creation and billing), and feedback from people who rely on assistive technology day to day.",
        ],
      },
      {
        id: "what-we-do",
        heading: "3. How we apply it",
        paragraphs: [
          "Accessibility acceptance criteria are part of the definition of done for new features. Design components carry focus states, error messaging and label patterns with them, so the accessible option is the default one rather than a special case each team invents.",
        ],
        list: [
          "Keyboard support for every interactive element, with a visible focus indicator",
          "Semantic headings, landmarks and labels so screen readers can navigate by structure",
          "Colour contrast meeting WCAG 2.2 AA for text, controls and status indicators",
          "Text and controls that reflow to 320 CSS pixels and work at 200% zoom",
          "Reduced-motion preferences respected for animation and auto-playing media",
          "Form errors announced and described in text, not colour alone",
          "Plain-language defaults for policy, billing and error messages",
        ],
      },
      {
        id: "known-limitations",
        heading: "4. Known limitations",
        paragraphs: [
          "We publish what we know is not there yet. Two areas currently fall short of our target, and each has a planned route rather than an open-ended wait.",
        ],
        list: [
          "Some archived case-study and tutorial media ships without captions or a transcript — the source recordings are being re-cut with text alternatives",
          "A few dense reporting tables in the analytics module rely on visual grouping that a screen reader cannot convey; tabular equivalents are on the backlog",
        ],
      },
      {
        id: "third-party",
        heading: "5. Third-party content and services",
        paragraphs: [
          "Parts of the experience are delivered by other providers — the WhatsApp conversation surface, payment processing, embedded maps or video, and font hosting. We choose providers that publish their own accessibility statements, but their content is under their control, so we can only raise issues with them, not change their code.",
          "Documents we publish (policies, invoices, quotations) are produced from accessible templates with real headings and selectable text rather than images of text.",
        ],
      },
      {
        id: "feedback",
        heading: "6. Reporting a barrier",
        paragraphs: [
          "If something on this site or in the platform stops you from getting what you need, tell us and we will treat it as a defect, not a suggestion. Email support@madhuratech.com with the page address or screen, what you were trying to do, the browser and assistive technology you use, and a screenshot or short recording if you can. Screenshots are optional — a description in your own words is enough to start.",
          "We acknowledge accessibility reports within two business days and give you an initial assessment within five. If a fix will take longer, you get a date and a workaround in the meantime wherever one exists.",
        ],
      },
      {
        id: "enforcement",
        heading: "7. If you are not satisfied",
        paragraphs: [
          "If our response does not resolve the problem, reply to the same thread and it is escalated to the product owner for the affected area. Nothing about this statement limits any right you have under applicable equality or disability discrimination legislation.",
        ],
      },
      {
        id: "review",
        heading: "8. Reviewing this statement",
        paragraphs: [
          "This statement is reviewed every six months and whenever we ship a material change to the platform's interface. The date at the top of the document is the date of the most recent review. Changes that add or remove a known limitation are called out in the changelog.",
        ],
      },
    ],
    related: ["/legal/privacy", "/support", "/legal/acceptable-use"],
  },
};
