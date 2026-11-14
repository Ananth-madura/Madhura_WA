# MODULE IMPLEMENTATION COVERAGE & DEPENDENCIES
## Detailed Specifications for All 11 Core Platform Modules

---

### MODULE 1: WhatsApp CRM
- **Primary Files**:
  - Backend: `routes/waContactRoutes.js`, `routes/waEnquiryRoutes.js`, `services/waContactTenancy.js`, `services/enquiryService.js`
  - Frontend: `pages/whatsappContacts.jsx`, `pages/whatsappEnquiries.jsx`, `pages/EmployeeWorkspace.jsx`
- **Coverage**:
  - Contact creation, deduplication by E.164 phone digits, multi-phone support.
  - Tag management with colored badge groups.
  - Enquiry funnel (Cold, Warm, Hot leads).
  - Activity timeline linking calls, messages, notes, and invoice updates.
- **Interconnections**:
  - On Inbound Message -> auto-resolves or creates contact -> links conversation -> evaluates lead rules -> triggers automations.

---

### MODULE 2: Team Inbox & Multi-Agent Collaboration
- **Primary Files**:
  - Backend: `routes/enterpriseInboxRoutes.js`, `routes/teamChatRoutes.js`, `services/conversationShareService.js`, `services/teamChat.js`
  - Frontend: `pages/whatsapp.jsx`, `components/TeamChat.jsx`, `pages/whatsapp-inbox.css`
- **Coverage**:
  - Live WhatsApp chat interface with conversation filters (All, Mine, Unassigned, Unread).
  - Dynamic contact-specific enquiry drawer.
  - Collision prevention (showing when another agent is actively typing or viewing).
  - Internal private notes (`wa_internal_notes`) hidden from end-customers.
  - Chat transfer, round-robin assignment, and supervisor takeover.
- **Interconnections**:
  - Reads live messages from Meta Cloud API and Baileys local engines simultaneously.
  - Enables one-click lead creation and deal pipeline attachment directly from the header.

---

### MODULE 3: Automation Engine
- **Primary Files**:
  - Backend: `routes/waAutomationRoutes.js`, `services/waAutomationService.js`, `services/builtinWorkflowExecutor.js`, `services/waQueue.js`
  - Frontend: `pages/whatsappAutomations.jsx`, `pages/branches/BranchAutomations.jsx`
- **Coverage**:
  - Event-driven trigger library: inbound message, tag added, lead created, deal stage changed, scheduled delay, webhook event.
  - Condition evaluator: nested AND/OR rules, string matches, numeric bounds, tag inclusion, business hours.
  - Action bus: send message, send template, update field, assign agent, create task, trigger webhook, request approval.
  - Durable state: `wa_automation_checkpoints` for multi-day drip campaigns and restart-safe delays.

---

### MODULE 4: Chatbot Builder & Visual Canvas
- **Primary Files**:
  - Backend: `routes/waFlowRoutes.js`, `services/waFlowEngine.js`, `services/sharedFlowRuntime.js`
  - Frontend: `pages/whatsappFlows.jsx`, `components/FlowPageBoundary.jsx`
- **Coverage**:
  - Drag-and-drop canvas for complex conversational decision trees.
  - Node types: Start, Text, Template, Media, Question, Interactive Buttons, List Menus, Logic Condition, API Request, Data Capture, Agent Handover, End.
  - Dynamic customer input capture saved to contact custom fields.
  - Human handover mechanism that safely pauses automated bot responses when escalated to a human agent.

---

### MODULE 5: Campaign Management & Broadcasts
- **Primary Files**:
  - Backend: `routes/waCampaignRoutes.js`, `services/waCampaignEngine.js`, `services/waBlastGuard.js`
  - Frontend: `pages/whatsappCampaigns.jsx`, `pages/EmployeeCampaigns.jsx`
- **Coverage**:
  - Audience builder supporting dynamic segmentation (tags, source, lifecycle stage, last contacted date).
  - Approved WhatsApp template selection with variable mapping (`{{1}}`, `{{2}}`).
  - Safe broadcast dispatcher with Anti-Ban rate pacing and queue-based execution.
  - Real-time campaign performance analytics (sent, delivered, read, failed, replies).

---

### MODULE 6: AI Platform & Conversational RAG
- **Primary Files**:
  - Backend: `routes/waAiRoutes.js`, `services/waAiReply.js`, `services/waKnowledgeBase.js`, `services/waBotGate.js`
  - Frontend: `pages/branches/BranchAiAgents.jsx`, `components/WAConfigPrompt.jsx`
- **Coverage**:
  - Multi-provider AI connectivity (OpenRouter, OpenAI, Meta Llama, Gemini).
  - Contextual knowledge base ingestion (PDF, DOCX, TXT, FAQ, URLs).
  - Intent classification, conversation summarization, and suggested replies for inbox agents.
  - Strict tenant isolation: knowledge chunks are strictly partitioned by `tenant_id`.

---

### MODULE 7: Sales CRM & Pipeline Management
- **Primary Files**:
  - Backend: `routes/externalCrmRoutes.js`, `services/chatCrmBridge.js`, `services/enquiryService.js`
  - Frontend: `pages/EmployeeWorkspace.jsx`, `pages/whatsappEnquiries.jsx`
- **Coverage**:
  - Multi-stage sales pipelines (Lead, Qualified, Proposal, Negotiation, Won, Lost).
  - Deal management (`wa_customer_deals`) linked to contacts and accounts.
  - Activity log for sales interactions (calls, meetings, tasks, follow-up dates).
  - Revenue forecasting and won/lost analytics.

---

### MODULE 8: Native Integrations (Shopify, WooCommerce, Razorpay)
- **Primary Files**:
  - Backend: `routes/waPaymentsRoutes.js`, `services/razorpayClient.js`, `services/flowIntegrations.js`, `services/crmWebhookForwarder.js`
  - Frontend: `pages/whatsappBilling.jsx`, `pages/ClientPortalManage.jsx`
- **Coverage**:
  - Razorpay checkout, payment link generation, and signed webhook verification.
  - Shopify and WooCommerce order sync and automated WhatsApp order confirmation templates.
  - Custom REST webhook triggers and outward API dispatch nodes.

---

### MODULE 9: Analytics & Reporting Engine
- **Primary Files**:
  - Backend: `routes/waAnalyticsRoutes.js`, `services/tenantAnalytics.js`, `services/usageMeteringService.js`
  - Frontend: `pages/whatsappAnalytics.jsx`, `pages/branches/BranchAnalytics.jsx`
- **Coverage**:
  - Real-time WhatsApp messaging volume (sent, delivered, read, failed).
  - Response time metrics and SLA tracking for inbox agents.
  - Broadcast campaign delivery and conversion attribution.
  - Branch comparisons and exportable reports (CSV, Excel).

---

### MODULE 10: Admin, Authentication & Access Control
- **Primary Files**:
  - Backend: `routes/authRoutes.js`, `services/rolePolicy.js`, `services/platformAdminBootstrap.js`
  - Frontend: `auth/login.jsx`, `auth/signup.jsx`, `pages/whatsappEmployees.jsx`
- **Coverage**:
  - Multi-company user administration, invitation tokens, password resets.
  - Granular RBAC permissions per feature and module.
  - Field-level security and data ownership policies.
  - Comprehensive audit trail across all sensitive actions.

---

### MODULE 11: Agency & White-Label Architecture
- **Primary Files**:
  - Backend: `routes/enterpriseOrganizationRoutes.js`, `services/organizationService.js`, `routes/clientPortalRoutes.js`
  - Frontend: `context/EnterpriseContext.jsx`, `pages/branches/BranchList.jsx`, `pages/ClientPortal.jsx`
- **Coverage**:
  - Multi-workspace switcher for agency operators.
  - Independent client provisioning with dedicated quotas and billing tiers.
  - White-label custom branding (custom logo, brand colors, custom login screen).
  - Client portal allowing customer self-service, document review, and ticket submission.

