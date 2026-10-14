/* Documentation index — /docs -------------------------------------------------------
   A self-contained, searchable docs hub. Categories hold articles; each article
   expands in place so every link on this page always resolves.
   --------------------------------------------------------------------------------- */

export const DOCS_PAGE = {
  path: "/docs",
  section: "Documentation",
  renderer: "docs",
  meta: {
    title: "Documentation | Madhura",
    description:
      "Guides, concepts, API references and troubleshooting for the Madhura WhatsApp CRM — connecting numbers, templates, campaigns, automations and analytics.",
  },
  hero: {
    badge: "Documentation",
    title: "Everything you need to run the platform.",
    highlight: "run the platform",
    subtitle:
      "Concepts first, then step-by-step guides, then the API. Search below or browse by category — every article opens in place.",
    points: [
      "Onboarding checklists for new workspaces",
      "Concept guides for branches, queues and templates",
      "REST API and webhook reference",
      "Troubleshooting for delivery and approval failures",
    ],
    primaryCta: { label: "Start free trial", to: "/signup" },
    secondaryCta: { label: "Contact support", to: "/company/contact" },
  },
  categories: [
    {
      id: "getting-started",
      title: "Getting started",
      icon: "Rocket",
      desc: "Connect a number, invite your team and send your first message.",
      articles: [
        {
          id: "workspace-setup",
          title: "Set up your workspace",
          summary: "Organisation, branches, business hours and the settings that matter before your first send.",
          body: [
            "A workspace is the top-level container: it owns numbers, templates, agents and billing. If you operate in more than one city or brand, create one branch per location at this stage — retrofitting branches later means re-doing permissions and reporting.",
            "Start with business hours. Quiet hours, SLA clocks and automation wait nodes all read from the branch calendar, so getting this right early prevents messages arriving at 2am.",
          ],
          steps: [
            "Create the organisation and set the default timezone and currency",
            "Add one branch per location, each with its own business hours",
            "Define roles: admin, supervisor, agent and analyst",
            "Invite agents by email and assign them to their branch",
          ],
        },
        {
          id: "connect-number",
          title: "Connect a WhatsApp number",
          summary: "Direct Cloud API onboarding or connecting an existing BSP number, and what verification to expect.",
          body: [
            "You can onboard a new number directly through Meta's Cloud API, or connect a number that already runs through a BSP. Both paths end with a webhook pointing at your Madhura workspace and a verified display name.",
            "The number must be able to receive an SMS or voice call for verification, and it must not currently be active in the WhatsApp consumer app on a personal phone. That registration must be removed first or verification will fail.",
          ],
          steps: [
            "Register the number in Meta Business Manager and complete business verification",
            "Request the display name and wait for approval before sending at volume",
            "Point the webhook URL at the endpoint shown in Settings → Numbers",
            "Send a test message from a personal device and confirm the thread appears in the inbox",
          ],
          code: {
            lang: "text",
            label: "Webhook callback URL",
            text: "https://<your-workspace>.madhura.co/api/wa/webhook/<workspace-token>",
          },
        },
        {
          id: "first-message",
          title: "Send your first message",
          summary: "Why your first outbound message must be a template, and how to check it landed.",
          body: [
            "Outside an open 24-hour customer service window, WhatsApp only permits approved templates. So the first message to a new contact must be a template — this is a Meta rule, not a platform restriction.",
            "Send it, then watch the delivery funnel in Analytics. Sent → Delivered → Read tells you whether the number, the template and the recipient's registration are all healthy.",
          ],
        },
      ],
    },
    {
      id: "messaging",
      title: "Messaging operations",
      icon: "MessageCircle",
      desc: "Inbox, templates, campaigns and the rules that keep the channel healthy.",
      articles: [
        {
          id: "template-approval",
          title: "Getting templates approved first time",
          summary: "The five rejection reasons that account for most failures, and how to avoid each.",
          body: [
            "Meta reviews templates against a published policy. The pre-flight validator in Templates mirrors the most common rejection rules, so a clean local check usually means a clean review.",
          ],
          list: [
            "Every {{variable}} must have a sample value supplied at submission",
            "Utility templates cannot contain marketing wording or promotional calls to action",
            "Sentences must be complete — no mid-sentence truncation or leading punctuation",
            "URL buttons must use a domain you own and that matches your verified business",
            "Authentication templates have a strict body structure and cannot include media",
          ],
        },
        {
          id: "campaign-hygiene",
          title: "Sending campaigns without degrading quality",
          summary: "Segment freshness, wave cadence and the two metrics to watch after every send.",
          body: [
            "Quality degradation is almost always caused by sending to stale lists. A contact who has not messaged you in 18 months is far more likely to block than to read.",
            "Watch two numbers after every campaign: the opt-out rate and the block rate. An opt-out rate above roughly 1% on a marketing send is a signal to tighten the segment, not to keep sending.",
          ],
          steps: [
            "Restrict segments to contacts active within the last 90 days for marketing sends",
            "Split large audiences into waves with spacing, rather than one maximum-rate burst",
            "Check the delivery funnel 30 minutes in and pause if failures spike",
            "Review opt-out and block rates before scheduling the next campaign",
          ],
        },
        {
          id: "inbox-assignment",
          title: "Assignment and routing rules",
          summary: "Round-robin, skill-based and branch-based routing, and when to use each.",
          body: [
            "Routing decides who owns a thread. Round-robin spreads load evenly and is the right default. Skill-based routing sends language or product-specific conversations to agents tagged with that skill. Branch-based routing keeps a location's customers with that location's team.",
            "Rules are evaluated in order and the first match wins, so put the most specific rule first.",
          ],
        },
      ],
    },
    {
      id: "automation",
      title: "Automation & flows",
      icon: "Zap",
      desc: "Triggers, conditions, delays and the debug loop that makes journeys reliable.",
      articles: [
        {
          id: "automation-anatomy",
          title: "Anatomy of an automation",
          summary: "Trigger, condition, wait, action — and the idempotency guarantee behind each run.",
          body: [
            "Every automation is a directed graph. A trigger enters the graph, conditions route, waits hold and actions send. Each run records the path taken and the payload at every node, which is what makes a customer complaint debuggable.",
            "Actions carry an idempotency key derived from the run and the node, so a replayed webhook cannot double-message a contact.",
          ],
        },
        {
          id: "payment-recovery",
          title: "Build a payment recovery journey",
          summary: "Re-issue a failed payment link on a cadence that stops the moment the invoice clears.",
          body: [
            "This is the highest-return automation most businesses can build: a reminder cadence that runs entirely off billing events, with no human remembering anything.",
          ],
          steps: [
            "Trigger: webhook from your billing system with status = payment_failed",
            "Wait 1 hour, then send the payment link template",
            "Condition: if payment.status = paid, exit the journey",
            "Otherwise wait 24 hours and repeat, for a maximum of three attempts",
            "On the third failure, assign the thread to the collections queue",
          ],
        },
        {
          id: "dry-run",
          title: "Testing with dry-run",
          summary: "Simulate a journey against real contacts with every send suppressed.",
          body: [
            "Dry-run executes the full graph with sends suppressed and every node output recorded. Run it against a small set of real contacts — not synthetic samples — because field names and null values are where journeys actually break.",
          ],
        },
      ],
    },
    {
      id: "api",
      title: "API & integrations",
      icon: "Terminal",
      desc: "Authentication, endpoints, webhooks and the Universal CRM Connector.",
      articles: [
        {
          id: "authentication",
          title: "API authentication",
          summary: "Workspace API keys, JWT sessions and how to scope a key safely.",
          body: [
            "The REST API accepts either a user JWT (for user-context operations) or a workspace API key (for server-to-server integrations). API keys should be scoped to the modules an integration actually needs, and rotated on a schedule.",
          ],
          code: {
            lang: "bash",
            label: "Example request",
            text: "curl -X GET https://api.madhura.co/api/wa/contacts?limit=50 \\\n  -H \"Authorization: Bearer $MADHURA_API_KEY\" \\\n  -H \"Content-Type: application/json\"",
          },
        },
        {
          id: "webhooks",
          title: "Webhooks",
          summary: "Event types, signature verification, retries and how to handle replays.",
          body: [
            "Webhooks are signed. Verify the signature before processing, and treat the event ID as an idempotency key — we retry with backoff on a non-2xx response, so the same event can arrive more than once.",
          ],
          list: [
            "message.received — inbound message normalised and attached to a thread",
            "message.delivered / message.read — delivery receipts from Meta",
            "message.failed — send failure with the Meta error code",
            "contact.updated — tag, field or opt-out state changed",
            "automation.run.completed — a journey run finished, with its path",
          ],
          code: {
            lang: "text",
            label: "Retry schedule",
            text: "Retries: 30s, 2m, 10m, 1h, 6h — then the endpoint is disabled and flagged in the workspace.",
          },
        },
        {
          id: "crm-connector",
          title: "Universal CRM Connector",
          summary: "Mirror contacts, threads and events into an existing CRM without an integration project.",
          body: [
            "The connector maps Madhura entities onto your CRM's object model through a configuration file, then keeps them in sync over webhooks. Contacts, tags, thread summaries and campaign events are the supported objects.",
          ],
        },
      ],
    },
    {
      id: "troubleshooting",
      title: "Troubleshooting",
      icon: "Search",
      desc: "The failures that look mysterious and usually are not.",
      articles: [
        {
          id: "not-delivered",
          title: "Messages show sent but never delivered",
          summary: "Six causes, ordered by how often they are actually the problem.",
          body: [
            "Sent means Madhura handed the message to Meta. Delivered means Meta reached the recipient's device. If you are stuck between the two, the cause is almost always one of these.",
          ],
          list: [
            "The recipient's number is not registered on WhatsApp — verify by sending from the consumer app",
            "The recipient has blocked the business or reported the number",
            "Your messaging limit for the current tier has been reached",
            "The number's quality rating was downgraded, throttling throughput",
            "The message was sent outside the permitted window without an approved template",
            "A regional or carrier-level outage — check the status page before changing anything",
          ],
        },
        {
          id: "template-rejected",
          title: "Template rejected by Meta",
          summary: "How to read a rejection reason and what to change.",
          body: [
            "The rejection reason is returned on the template record and shown next to the offending line in Templates. Meta's wording is terse; the mapping below covers most cases.",
          ],
          list: [
            "\"Invalid parameter\" → a variable has no sample value supplied",
            "\"Marketing template not allowed\" → move the copy to a utility template or remove the promotion",
            "\"Template name mismatch\" → renaming creates a new template rather than editing the old one",
            "\"Category mismatch\" → the body reads as marketing while declared as utility",
          ],
        },
        {
          id: "automation-not-firing",
          title: "An automation is not firing",
          summary: "Check the trigger, then the guardrails, then the run inspector.",
          body: [
            "Open the run inspector for the affected contact. If there is no run, the trigger did not fire: verify the keyword match, the filter conditions and that the contact is not excluded by a suppression rule.",
            "If a run exists but stopped, the inspector shows which node failed and why — usually a missing template approval or a frequency cap that has been hit.",
          ],
          steps: [
            "Confirm the trigger event actually arrived — check the webhook log",
            "Check the contact is not on a suppression or opt-out list",
            "Check the frequency cap for that contact across all automations",
            "Open the run in the inspector and read the failing node's payload",
          ],
        },
      ],
    },
  ],
  cta: {
    title: "Still stuck?",
    sub: "Support engineers read every message — no ticket bot in between.",
    primary: { label: "Contact support", to: "/company/contact" },
    secondary: { label: "See the product", to: "/product/live-inbox" },
  },
  related: ["/product/live-inbox", "/product/automations", "/company/contact"],
};
