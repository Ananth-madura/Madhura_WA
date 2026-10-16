/* ─────────────────────────────────────────────────────────────────────────────
   Single source of truth for the public marketing site.

   The header mega-nav, the 9-group enterprise footer, the related-page rails
   and the route table in App.jsx are ALL derived from this file +
   `content/index.js`.

   Adding a page = add one content entry (which carries its own `path`) and it
   is automatically linked, routed and listed in the footer.

   ROUTE CONTRACT
   • Every `path` below must resolve to a real content entry (or to an alias).
   • Authenticated app screens (/login, /signup, /whatsapp, /portal) live in the
     separate `frontend` project and are reached through `appUrl()` in
     `../../config/site.js` — never route them here.
   ───────────────────────────────────────────────────────────────────────────── */

/* ── Product ───────────────────────────────────────────────────────────────── */
export const PRODUCT_LINKS = [
  {
    label: "Shared Team Inbox",
    path: "/product/live-inbox",
    desc: "One shared thread per customer, with agent collision detection.",
  },
  {
    label: "Contact Management",
    path: "/product/contacts",
    desc: "Unified customer profiles with tags, segments and lifecycle stages.",
  },
  {
    label: "Broadcast Campaigns",
    path: "/product/campaigns",
    desc: "Broadcast to opted-in segments with throttled, metered delivery.",
  },
  {
    label: "Template Management",
    path: "/product/templates",
    desc: "Meta-approved templates with variables, QA and version history.",
  },
  {
    label: "Flow Builder",
    path: "/product/flows",
    desc: "Drag-and-drop WhatsApp Flow canvases with conditional branching.",
  },
  {
    label: "AI Chatbot",
    path: "/product/ai-chatbot",
    desc: "Deflect routine questions, then hand the thread to a human with context.",
  },
  {
    label: "Automation Engine",
    path: "/product/automations",
    desc: "Event-driven journeys, drip sequences and reminder engines.",
  },
  {
    label: "Analytics & Reports",
    path: "/product/analytics",
    desc: "Delivery, response and revenue reporting per team and branch.",
  },
  {
    label: "WhatsApp CRM",
    path: "/product/crm",
    desc: "Pipeline, deals and conversation history attached to every contact.",
  },
  {
    label: "Multi-Branch Management",
    path: "/product/multi-branch",
    desc: "Separate numbers, teams and reporting per branch — one login.",
  },
];

/* ── Solutions (by team / company stage) ───────────────────────────────────── */
export const SOLUTION_LINKS = [
  {
    label: "For Enterprises",
    path: "/solutions/enterprise",
    desc: "Multi-tenant governance, SSO-ready access and consolidated reporting.",
  },
  {
    label: "For Small Businesses",
    path: "/solutions/small-business",
    desc: "A shared number for the whole team, live in an afternoon.",
  },
  {
    label: "For Sales Teams",
    path: "/solutions/sales-teams",
    desc: "Lead capture, pipeline stages and follow-up that never slips.",
  },
  {
    label: "For Marketing Teams",
    path: "/solutions/marketing-teams",
    desc: "Consent-based campaigns with attribution back to revenue.",
  },
  {
    label: "For Customer Support",
    path: "/solutions/customer-support",
    desc: "Queues, SLAs and escalation across every branch and shift.",
  },
];

/* ── Industries ────────────────────────────────────────────────────────────── */
export const INDUSTRY_LINKS = [
  {
    label: "E-Commerce & Retail",
    path: "/industries/ecommerce",
    desc: "Abandoned-cart recovery, order updates and post-purchase care.",
  },
  {
    label: "Healthcare",
    path: "/industries/healthcare",
    desc: "Appointment reminders and consent-led patient communication.",
  },
  {
    label: "Education",
    path: "/industries/education",
    desc: "Admissions, fee reminders and parent communication at scale.",
  },
  {
    label: "Real Estate",
    path: "/industries/real-estate",
    desc: "Site-visit scheduling, lead qualification and listing alerts.",
  },
  {
    label: "Agencies",
    path: "/industries/agencies",
    desc: "Run many client accounts from one multi-tenant workspace.",
  },
];

/* ── Platform ──────────────────────────────────────────────────────────────── */
export const PLATFORM_LINKS = [
  {
    label: "Features Overview",
    path: "/features",
    desc: "Every capability in one map, from inbox to analytics.",
  },
  {
    label: "Integrations",
    path: "/platform/integrations",
    desc: "Zapier, webhooks, REST API and the tools your stack already runs on.",
  },
  {
    label: "WhatsApp Business API",
    path: "/platform/whatsapp-business-api",
    desc: "Meta Cloud API onboarding, number migration and quality ratings.",
  },
  {
    label: "Multi-Tenant Platform",
    path: "/platform/multi-tenant",
    desc: "Isolated workspaces, brands and branches under one contract.",
  },
  {
    label: "Roles & Permissions",
    path: "/platform/roles-permissions",
    desc: "Granular, branch-scoped access down to export and delete.",
  },
  {
    label: "Pricing & Plans",
    path: "/pricing",
    desc: "Transparent plans with conversation and seat limits in plain numbers.",
  },
  {
    label: "Enterprise Solutions",
    path: "/pricing/enterprise",
    desc: "Volume pricing, procurement support and dedicated onboarding.",
  },
  {
    label: "Product Updates",
    path: "/changelog",
    desc: "What shipped, what changed, and what is coming next.",
  },
];

/* ── Developers ────────────────────────────────────────────────────────────── */
export const DEVELOPER_LINKS = [
  {
    label: "API Documentation",
    path: "/developers",
    desc: "Start here: auth, rate limits, resources and first request.",
  },
  {
    label: "API Reference",
    path: "/developers/api",
    desc: "Every endpoint, parameter and payload, with examples.",
  },
  {
    label: "Webhooks",
    path: "/developers/webhooks",
    desc: "Event subscriptions, retries, signatures and replay.",
  },
  {
    label: "SDKs & Examples",
    path: "/developers/sdks",
    desc: "Official libraries and runnable starter projects.",
  },
  {
    label: "Developer Guides",
    path: "/developers/guides",
    desc: "Step-by-step recipes for the workflows teams ship most.",
  },
  {
    label: "Postman Collection",
    path: "/developers/postman",
    desc: "Import the whole API and authenticate in one click.",
  },
  {
    label: "Sandbox & Testing",
    path: "/developers/sandbox",
    desc: "Test numbers, simulated inbound messages and failure cases.",
  },
  {
    label: "API Changelog",
    path: "/developers/changelog",
    desc: "Versioned API changes with deprecation timelines.",
  },
];

/* ── Resources ─────────────────────────────────────────────────────────────── */
export const RESOURCE_LINKS = [
  {
    label: "Documentation",
    path: "/docs",
    desc: "Guides, concepts, API references and onboarding checklists.",
  },
  {
    label: "Help Center",
    path: "/help",
    desc: "Answers to the questions support hears most often.",
  },
  {
    label: "Getting Started",
    path: "/getting-started",
    desc: "Connect a number, import contacts, send the first campaign.",
  },
  {
    label: "Blog & Insights",
    path: "/blog",
    desc: "Messaging strategy, deliverability and product deep-dives.",
  },
  {
    label: "Tutorials",
    path: "/tutorials",
    desc: "Short, task-focused walkthroughs with expected output.",
  },
  {
    label: "Video Guides",
    path: "/videos",
    desc: "Recorded walkthroughs of setup, campaigns and reporting.",
  },
  {
    label: "Case Studies",
    path: "/case-studies",
    desc: "How teams cut response time and grew repeat revenue.",
  },
  {
    label: "FAQs",
    path: "/faqs",
    desc: "Pricing, compliance, migration and messaging questions.",
  },
  {
    label: "Compare Solutions",
    path: "/compare",
    desc: "An honest side-by-side against the tools you are evaluating.",
  },
];

/* ── Company ───────────────────────────────────────────────────────────────── */
export const COMPANY_LINKS = [
  {
    label: "About Us",
    path: "/company/about",
    desc: "Who we are, how we operate and what we build.",
  },
  {
    label: "Contact Us",
    path: "/company/contact",
    desc: "Talk to sales, support, security or partnerships.",
  },
  {
    label: "Careers",
    path: "/company/careers",
    desc: "Open roles across engineering, delivery and go-to-market.",
  },
  {
    label: "Our Mission",
    path: "/company/mission",
    desc: "Why MADHURA exists and the standard we hold ourselves to.",
  },
  {
    label: "Partners",
    path: "/company/partners",
    desc: "The partner program for resellers, agencies and technology partners.",
  },
  {
    label: "Become a Partner",
    path: "/company/partners/apply",
    desc: "Apply to co-sell, refer or build on the MADHURA platform.",
  },
  {
    label: "Customer Stories",
    path: "/company/customers",
    desc: "Results reported by the teams running MADHURA daily.",
  },
  {
    label: "News & Updates",
    path: "/news",
    desc: "Announcements, milestones and press mentions.",
  },
];

/* ── Support ───────────────────────────────────────────────────────────────── */
export const SUPPORT_LINKS = [
  {
    label: "Contact Support",
    path: "/support",
    desc: "Reach a support engineer by channel, plan and severity.",
  },
  {
    label: "Submit a Ticket",
    path: "/support/tickets",
    desc: "Open a tracked case with logs, scope and response targets.",
  },
  {
    label: "Support Plans",
    path: "/support/plans",
    desc: "Response times and coverage for each plan tier.",
  },
  {
    label: "System Status",
    path: "/status",
    desc: "Live component health, maintenance windows and history.",
  },
  {
    label: "Report an Issue",
    path: "/support/report-issue",
    desc: "Something broken? Give us reproduction steps and impact.",
  },
  {
    label: "Feature Requests",
    path: "/support/feature-requests",
    desc: "Tell us what would make the platform indispensable.",
  },
  {
    label: "Book a Demo",
    path: "/demo",
    desc: "A 30-minute walkthrough tailored to your workflow.",
  },
  {
    label: "Onboarding Assistance",
    path: "/onboarding",
    desc: "Guided migration, number setup and team training.",
  },
];

/* ── Trust & Security ──────────────────────────────────────────────────────── */
export const TRUST_LINKS = [
  {
    label: "Trust Center",
    path: "/trust",
    desc: "How MADHURA protects customer data, in one place.",
  },
  {
    label: "Security Overview",
    path: "/trust/security",
    desc: "Encryption, isolation, secure development and testing.",
  },
  {
    label: "Data Protection",
    path: "/trust/data-protection",
    desc: "Retention, deletion, backups and cross-border handling.",
  },
  {
    label: "Infrastructure & Hosting",
    path: "/trust/infrastructure",
    desc: "Where workloads run, how they are segmented and monitored.",
  },
  {
    label: "Access Controls",
    path: "/trust/access-controls",
    desc: "Internal access, least privilege and audit logging.",
  },
  {
    label: "Incident Response",
    path: "/trust/incident-response",
    desc: "Detection, escalation, customer notification and post-mortems.",
  },
  {
    label: "Responsible Disclosure",
    path: "/trust/disclosure",
    desc: "Report a vulnerability and get a coordinated response.",
  },
  {
    label: "Compliance Information",
    path: "/trust/compliance",
    desc: "DPDP, GDPR and Meta messaging policy alignment.",
  },
];

/* ── Legal ─────────────────────────────────────────────────────────────────── */
export const LEGAL_LINKS = [
  {
    label: "Privacy Policy",
    path: "/legal/privacy",
    desc: "How we collect, use, share and protect personal data.",
  },
  {
    label: "Terms of Service",
    path: "/legal/terms",
    desc: "The agreement that governs access to and use of the platform.",
  },
  {
    label: "Cookie Policy",
    path: "/legal/cookies",
    desc: "Which cookies we set and how to control them.",
  },
  {
    label: "Data Processing Agreement",
    path: "/legal/dpa",
    desc: "Our commitments when we process data on your behalf.",
  },
  {
    label: "Acceptable Use Policy",
    path: "/legal/acceptable-use",
    desc: "What may and may not be sent through the platform.",
  },
  {
    label: "Refund & Cancellation Policy",
    path: "/legal/refunds",
    desc: "Billing cycles, cancellations and refund eligibility.",
  },
  {
    label: "Service Level Agreement",
    path: "/legal/sla",
    desc: "Availability targets, measurement and service credits.",
  },
  {
    label: "Subprocessors",
    path: "/legal/subprocessors",
    desc: "The third parties that process data to run the service.",
  },
  {
    label: "Data Deletion Request",
    path: "/legal/data-deletion",
    desc: "How to request erasure of workspace or end-customer data.",
  },
  {
    label: "Messaging & Consent Policy",
    path: "/legal/messaging-consent",
    desc: "Opt-in, opt-out and template rules for compliant messaging.",
  },
];

/* ── Header ────────────────────────────────────────────────────────────────── */
/** Header navigation — `menu` items open a dropdown, `link` items go straight. */
export const HEADER_NAV = [
  { label: "Product", type: "menu", children: PRODUCT_LINKS.slice(0, 6) },
  { label: "Solutions", type: "menu", children: SOLUTION_LINKS },
  { label: "Industries", type: "menu", children: INDUSTRY_LINKS },
  { label: "Developers", type: "link", path: "/developers" },
  { label: "Resources", type: "menu", children: RESOURCE_LINKS.slice(0, 5) },
  { label: "Pricing", type: "link", path: "/pricing" },
  { label: "Company", type: "menu", children: COMPANY_LINKS.slice(0, 4) },
];

/**
 * The landing page runs a compact row of straight links (it has no dropdowns),
 * so it draws a short list from the same registry instead of a second nav.
 */
export const LANDING_NAV = [
  { label: "Product", path: "/product/crm" },
  { label: "Features", path: "/features" },
  { label: "Automation", path: "/product/automations" },
  { label: "Integrations", path: "/platform/integrations" },
];

/* ── Footer ────────────────────────────────────────────────────────────────── */
/**
 * The enterprise footer: 9 groups, rendered across rows on desktop and as
 * collapsible sections on mobile. Every entry must be a live route.
 */
export const FOOTER_GROUPS = [
  { title: "Product", links: PRODUCT_LINKS },
  { title: "Solutions", links: SOLUTION_LINKS },
  { title: "Platform", links: PLATFORM_LINKS },
  { title: "Developers", links: DEVELOPER_LINKS },
  { title: "Resources", links: RESOURCE_LINKS },
  { title: "Company", links: COMPANY_LINKS },
  { title: "Support", links: SUPPORT_LINKS },
  { title: "Trust & Security", links: TRUST_LINKS },
  { title: "Legal", links: LEGAL_LINKS },
];

/** Small-print row under the copyright. */
export const FOOTER_QUICK_LINKS = [
  { label: "Privacy", path: "/legal/privacy" },
  { label: "Terms", path: "/legal/terms" },
  { label: "Cookies", path: "/legal/cookies" },
  { label: "Security", path: "/trust/security" },
];

/**
 * Social profiles. Left empty on purpose: only add links MADHURA actually
 * controls — a dead or invented handle costs more trust than the icon earns.
 * Example: { label: "LinkedIn", href: "https://www.linkedin.com/company/…", Icon: Linkedin }
 */
export const SOCIAL_LINKS = [];

/* ── Company facts used by the footer & contact surfaces ───────────────────── */
export const COMPANY = {
  legalName: "Madhura Technologies Private Limited",
  tagline: "WhatsApp CRM & Automation",
  description:
    "The enterprise communication platform for sales, marketing, support, and customer engagement across multi-tenant, multi-branch organizations.",
  address:
    "Corporate Headquarters: No. 12/4 Anna Salai, Guindy, Chennai - 600032, Tamil Nadu, India.",
  salesEmail: "sales@madhuratech.com",
  supportEmail: "support@madhuratech.com",
  phone: "+91 98400 12345",
  region: "Global • English (US / IN)",
  copyright: "© 2026 MADHURA Technologies. All rights reserved.",
};

/* ── Routing helpers ───────────────────────────────────────────────────────── */

/** Section landing pages (`/product`, `/company`, `/legal`) resolve to a child. */
export const SECTION_INDEX = {
  "/product": PRODUCT_LINKS[0].path,
  "/company": COMPANY_LINKS[0].path,
  "/legal": LEGAL_LINKS[0].path,
};

/** Legacy / short aliases kept alive so old links never 404. */
export const LEGACY_ALIASES = {
  "/com/about": "/company/about",
  "/com/contact": "/company/contact",
  "/com/careers": "/company/careers",
  "/com/documentation": "/docs",
  "/company/documentation": "/docs",
  "/documentation": "/docs",
  "/docs/documentation": "/docs",
  "/privacy": "/legal/privacy",
  "/terms": "/legal/terms",
  "/security": "/trust/security",
  "/about": "/company/about",
  "/contact": "/company/contact",
  "/careers": "/company/careers",
  "/legal/security": "/trust/security",
  "/trust/security/overview": "/trust/security",
  "/support/security": "/trust/security",
  "/refund-policy": "/legal/refunds",
  "/subprocessors": "/legal/subprocessors",
  "/dpa": "/legal/dpa",
  "/data-deletion": "/legal/data-deletion",
  "/messaging-policy": "/legal/messaging-consent",
  "/blog/index": "/blog",
  "/status-page": "/status",
  "/system-status": "/status",
  "/book-a-demo": "/demo",
  "/request-demo": "/demo",
};
