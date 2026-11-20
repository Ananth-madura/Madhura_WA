import { lazy, Suspense, useEffect } from "react";
import FlowPageBoundary from "./components/FlowPageBoundary";
import CampaignErrorBoundary from "./pages/campaigns/CampaignErrorBoundary";
import {MARKETING as MARKETING_URL} from "./config/index";
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from "react-router-dom";
import { Agentation } from "agentation";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import Login from "./auth/login";
import { loginDestination } from "./auth/loginDestination";
import { EnterpriseProvider } from "./context/EnterpriseContext";
import { BranchProvider } from "./context/BranchContext";
const Signup = lazy(() => import("./auth/signup"));
const WALayout = lazy(() => import("./layout/WALayout"));
const WhatsAppPage = lazy(() => import("./pages/whatsapp"));
const WAContacts = lazy(() => import("./pages/whatsappContacts"));
const WATemplates = lazy(() => import("./pages/whatsappTemplates"));
const WATemplateCreate = lazy(() => import("./pages/whatsappTemplateCreate"));
const WAGroups = lazy(() => import("./pages/whatsappGroups"));
const WACampaigns = lazy(() => import("./pages/whatsappCampaigns"));
const WAAutomations = lazy(() => import("./pages/whatsappAutomations"));
const WAFlows = lazy(() => import("./pages/whatsappFlows"));
const WAAnalytics = lazy(() => import("./pages/whatsappAnalytics"));
const WAAccounts = lazy(() => import("./pages/whatsappAccounts"));
const WAEmployees = lazy(() => import("./pages/whatsappEmployees"));
const TeamChat = lazy(() => import("./components/TeamChat"));
const EmployeeWorkspace = lazy(() => import("./pages/EmployeeWorkspace"));
const EmployeeCampaigns = lazy(() => import("./pages/EmployeeCampaigns"));
const WAEnquiries = lazy(() => import("./pages/whatsappEnquiries"));
const WABilling = lazy(() => import("./pages/whatsappBilling"));
const BranchList = lazy(() => import("./pages/branches/BranchList"));
const BranchCreateWizard = lazy(() => import("./pages/branches/BranchCreateWizard"));
const BranchLayout = lazy(() => import("./pages/branches/BranchLayout"));
const BranchOverview = lazy(() => import("./pages/branches/BranchOverview"));
const BranchInbox = lazy(() => import("./pages/branches/BranchInbox"));
const BranchContacts = lazy(() => import("./pages/branches/BranchContacts"));
const BranchEmployees = lazy(() => import("./pages/branches/BranchEmployees"));
const BranchNumbers = lazy(() => import("./pages/branches/BranchNumbers"));
const BranchCampaigns = lazy(() => import("./pages/branches/BranchCampaigns"));
const BranchAutomations = lazy(() => import("./pages/branches/BranchAutomations"));
const BranchFlows = lazy(() => import("./pages/branches/BranchFlows"));
const BranchAiAgents = lazy(() => import("./pages/branches/BranchAiAgents"));
const BranchAnalytics = lazy(() => import("./pages/branches/BranchAnalytics"));
const BranchSettings = lazy(() => import("./pages/branches/BranchSettings"));
const BranchAudit = lazy(() => import("./pages/branches/BranchAudit"));
const ClientPortal = lazy(() => import("./pages/ClientPortal"));
const ClientPortalManage = lazy(() => import("./pages/ClientPortalManage"));

// Enterprise Onboarding & Public Activation Pages
const OnboardingCommandCenter = lazy(() => import("./pages/onboarding/OnboardingCommandCenter"));
const CompanyOnboarding = lazy(() => import("./pages/onboarding/CompanyOnboarding"));
const PlanOnboarding = lazy(() => import("./pages/onboarding/PlanOnboarding"));
const WhatsAppConnectOnboarding = lazy(() => import("./pages/onboarding/WhatsAppConnectOnboarding"));
const WhatsAppNumbersOnboarding = lazy(() => import("./pages/onboarding/WhatsAppNumbersOnboarding"));
const WhatsAppTestMessageOnboarding = lazy(() => import("./pages/onboarding/WhatsAppTestMessageOnboarding"));
const OnboardingComplete = lazy(() => import("./pages/onboarding/OnboardingComplete"));

// Public Compliance & Verification Pages
const MetaTechProviderComplianceCenter = lazy(() => import("./pages/platform/MetaTechProviderComplianceCenter"));
const VerifyEmailPage = lazy(() => import("./pages/public/VerifyEmailPage"));
const TermsPage = lazy(() => import("./pages/public/TermsPage"));
const PrivacyPage = lazy(() => import("./pages/public/PrivacyPage"));
const DataDeletionPage = lazy(() => import("./pages/public/DataDeletionPage"));

// Enterprise Campaign Management System
const CampaignCenterDashboard = lazy(() => import("./pages/campaigns/CampaignCenterDashboard"));
const CampaignComposerPage = lazy(() => import("./pages/campaigns/CampaignComposerPage"));
const CampaignDetailPage = lazy(() => import("./pages/campaigns/CampaignDetailPage"));
const AudienceBuilderPage = lazy(() => import("./pages/campaigns/AudienceBuilderPage"));
const AudienceImportPage = lazy(() => import("./pages/campaigns/AudienceImportPage"));
const ConsentSuppressionPage = lazy(() => import("./pages/campaigns/ConsentSuppressionPage"));
const TemplateStudioPage = lazy(() => import("./pages/campaigns/TemplateStudioPage"));
const WhatsAppFlowsPage = lazy(() => import("./pages/campaigns/WhatsAppFlowsPage"));
const FlowbotsAutomationsPage = lazy(() => import("./pages/campaigns/FlowbotsAutomationsPage"));
const CalendarApprovalsPage = lazy(() => import("./pages/campaigns/CalendarApprovalsPage"));
const AnalyticsReportsPage = lazy(() => import("./pages/campaigns/AnalyticsReportsPage"));
const CampaignSettingsAdminPage = lazy(() => import("./pages/campaigns/CampaignSettingsAdminPage"));
const GuidedFirstCampaignPage = lazy(() => import("./pages/campaigns/GuidedFirstCampaignPage"));
const RetargetingPage = lazy(() => import("./pages/campaigns/RetargetingPage"));
const DripSequencesPage = lazy(() => import("./pages/campaigns/DripSequencesPage"));
const FailureRecoveryPage = lazy(() => import("./pages/campaigns/FailureRecoveryPage"));
const TemplateHealthPage = lazy(() => import("./pages/campaigns/TemplateHealthPage"));
const AiCampaignAssistantPage = lazy(() => import("./pages/campaigns/AiCampaignAssistantPage"));

/* Marketing site now lives in the sibling `landing_page` project (port 3002).
   Old public URLs on this origin hand off there so shared links keep working. */

function MarketingHandoff({ to = "" }) {
  const { pathname, search, hash } = useLocation();
  const target = to && to !== "/" ? to : pathname;
  useEffect(() => {
    if (MARKETING_URL && new URL(MARKETING_URL).origin !== window.location.origin) {
      window.location.replace(`${MARKETING_URL}${target}${search}${hash}`);
    } else {
      // No marketing origin configured — the content lives elsewhere now,
      // so fall back to login rather than bouncing to ourselves.
      window.location.replace("/login");
    }
  }, [target, search, hash]);
  return <p className="p-8">Opening the MADHURA website…</p>;
}

/* SPA route changes do not reset scroll position by default. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);
  return null;
}

/* Top-level sections that belong to the marketing site, not the app. */
const MARKETING_SECTIONS = [
  "product", "features", "solutions", "industries", "platform",
  "developers", "resources", "pricing", "changelog", "company",
  "support", "trust", "legal", "status", "blog", "help",
  "getting-started", "tutorials", "videos", "case-studies", "docs",
  "faqs", "compare", "demo", "news", "accessibility",
  "com",
];

function RequireAuth({ children }) {
  const { user, initializing } = useAuth();
  const { pathname, search, hash } = useLocation();
  if(initializing)return <p className="p-4">Checking your browser session…</p>;
  const token = localStorage.getItem("token");
  if (!user && !token) return <Navigate to={`/login?returnUrl=${encodeURIComponent(`${pathname}${search}${hash}`)}`} replace />;
  return children;
}

/* Signed-in users have no business on the public pages — send them into the
   app instead of showing them a "Sign in" button that would just work. */
function PublicOnly({ children }) {
  const { user, initializing } = useAuth();
  const { search } = useLocation();
  if(initializing)return <p className="p-4">Checking your browser session…</p>;
  const token = localStorage.getItem("token");
  if (user || token) return <Navigate to={loginDestination(null, search)} replace />;
  return children;
}

function FlowParamRedirect() {
  const { flowId } = useParams();
  return <Navigate to={flowId ? `/whatsapp/flows/build/${flowId}` : "/whatsapp/flows/build"} replace />;
}

function LoginRedirect() {
  const { search, hash } = useLocation();
  return <Navigate to={{ pathname: "/login", search, hash }} replace />;
}

// `/whatsapp` is the Live Chats board for every role. The page itself adapts:
// an administrator gets the organization-wide board and session controls, while
// a member gets the same board restricted by the server to the conversations
// assigned to them. The assigned inbox lives at `/whatsapp/team-inbox`.
function WorkspaceInbox() {
  return <WhatsAppPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <EnterpriseProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Suspense fallback={<p className="p-4">Loading workspace…</p>}><Routes>
            <Route path="/portal/*" element={<Suspense fallback={<p className="p-8">Opening client portal…</p>}><ClientPortal /></Suspense>} />
            <Route path="/client-portal" element={<Navigate to="/portal" replace />} />
            <Route
              path="/"
              element={
                <PublicOnly>
                  <LoginRedirect />
                </PublicOnly>
              }
            />
            <Route
              path="/login"
              element={
                <PublicOnly>
                  <Login />
                </PublicOnly>
              }
            />
            <Route
              path="/signup"
              element={
                <PublicOnly>
                  <Signup />
                </PublicOnly>
              }
            />
            {/* Public Compliance & Account Verification Routes */}
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/verify-phone" element={<VerifyEmailPage />} />
            <Route path="/signup/verify-email" element={<VerifyEmailPage />} />
            <Route path="/signup/verify-phone" element={<VerifyEmailPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/data-deletion" element={<DataDeletionPage />} />

            {/* Enterprise Onboarding & Activation Routes */}
            <Route path="/platform/meta-tech-provider" element={<RequireAuth><MetaTechProviderComplianceCenter /></RequireAuth>} />
            <Route path="/whatsapp/tech-provider" element={<RequireAuth><MetaTechProviderComplianceCenter /></RequireAuth>} />
            <Route path="/tech-provider" element={<Navigate to="/platform/meta-tech-provider" replace />} />
            <Route path="/billing" element={<RequireAuth><WABilling /></RequireAuth>} />
            <Route path="/accounts" element={<Navigate to="/whatsapp/accounts" replace />} />
            <Route path="/onboarding" element={<RequireAuth><OnboardingCommandCenter /></RequireAuth>} />
            <Route path="/onboarding/company" element={<RequireAuth><CompanyOnboarding /></RequireAuth>} />
            <Route path="/onboarding/plan" element={<RequireAuth><PlanOnboarding /></RequireAuth>} />
            <Route path="/onboarding/billing" element={<Navigate to="/onboarding/plan" replace />} />
            <Route path="/onboarding/meta-connect" element={<Navigate to="/onboarding/whatsapp/connect" replace />} />
            <Route path="/onboarding/whatsapp/connect" element={<RequireAuth><WhatsAppConnectOnboarding /></RequireAuth>} />
            <Route path="/onboarding/whatsapp-setup" element={<Navigate to="/onboarding/whatsapp/numbers" replace />} />
            <Route path="/onboarding/whatsapp/numbers" element={<RequireAuth><WhatsAppNumbersOnboarding /></RequireAuth>} />
            <Route path="/onboarding/whatsapp/test-message" element={<RequireAuth><WhatsAppTestMessageOnboarding /></RequireAuth>} />
            <Route path="/onboarding/complete" element={<RequireAuth><OnboardingComplete /></RequireAuth>} />
            {/* ── Marketing site hand-off: every public marketing URL on this
                origin forwards to the landing_page project, keeping the full
                path, query and hash so shared links keep working. */}
            {MARKETING_SECTIONS.map((section) => (
              <Route key={section} path={`/${section}`} element={<MarketingHandoff />} />
            ))}
            {MARKETING_SECTIONS.map((section) => (
              <Route key={`${section}-sub`} path={`/${section}/*`} element={<MarketingHandoff />} />
            ))}
            {/* Back-compat: old /dashboard/whatsapp bookmarks keep working */}
            <Route path="/dashboard/whatsapp/*" element={<Navigate to="/whatsapp" replace />} />
            <Route path="/flows" element={<Navigate to="/whatsapp/flows" replace />} />
            <Route path="/account" element={<Navigate to="/whatsapp/accounts" replace />} />
            <Route path="/settings/integrations/whatsapp/connect" element={<Navigate to="/whatsapp/accounts?tab=connect" replace />} />
            <Route path="/flows/create" element={<Navigate to="/whatsapp/flows/create" replace />} />
            <Route path="/flows/build" element={<Navigate to="/whatsapp/flows/build" replace />} />
            <Route path="/flows/build/:flowId" element={<FlowParamRedirect />} />
            <Route path="/flows/builder" element={<Navigate to="/whatsapp/flows/build" replace />} />
            <Route path="/flows/builder/:flowId" element={<FlowParamRedirect />} />
            <Route
              path="/whatsapp"
              element={
                <RequireAuth>
                  <WALayout />
                </RequireAuth>
              }
            >
              <Route index element={<WorkspaceInbox />} />
              <Route path="team-inbox" element={<TeamChat />} />
              <Route path="workspace" element={<EmployeeWorkspace />} />
              <Route path="workspace/campaigns" element={<EmployeeCampaigns />} />
              <Route path="contacts" element={<WAContacts />} />
              <Route path="templates" element={<WATemplates />} />
              <Route path="templates/create" element={<WATemplateCreate />} />
              <Route path="templates/:templateId/edit" element={<WATemplateCreate />} />
              <Route path="groups" element={<WAGroups />} />
              <Route path="campaigns" element={<CampaignErrorBoundary><CampaignCenterDashboard /></CampaignErrorBoundary>} />
              <Route path="campaigns/create" element={<CampaignErrorBoundary><CampaignComposerPage /></CampaignErrorBoundary>} />
              <Route path="campaigns/calendar" element={<CampaignErrorBoundary><CalendarApprovalsPage mode="calendar" /></CampaignErrorBoundary>} />
              <Route path="campaigns/approvals" element={<CampaignErrorBoundary><CalendarApprovalsPage mode="approvals" /></CampaignErrorBoundary>} />
              <Route path="campaigns/audiences" element={<CampaignErrorBoundary><AudienceBuilderPage /></CampaignErrorBoundary>} />
              <Route path="campaigns/audiences/create" element={<CampaignErrorBoundary><AudienceBuilderPage /></CampaignErrorBoundary>} />
              <Route path="campaigns/import" element={<CampaignErrorBoundary><AudienceImportPage /></CampaignErrorBoundary>} />
              <Route path="campaigns/import/:id" element={<CampaignErrorBoundary><AudienceImportPage /></CampaignErrorBoundary>} />
              <Route path="campaigns/consent" element={<CampaignErrorBoundary><ConsentSuppressionPage defaultTab="consent" /></CampaignErrorBoundary>} />
              <Route path="campaigns/consent/import" element={<CampaignErrorBoundary><AudienceImportPage /></CampaignErrorBoundary>} />
              <Route path="campaigns/suppression" element={<CampaignErrorBoundary><ConsentSuppressionPage defaultTab="suppression" /></CampaignErrorBoundary>} />
              <Route path="campaigns/templates" element={<CampaignErrorBoundary><TemplateStudioPage /></CampaignErrorBoundary>} />
              <Route path="campaigns/flows" element={<CampaignErrorBoundary><WhatsAppFlowsPage /></CampaignErrorBoundary>} />
              <Route path="campaigns/flows/create" element={<CampaignErrorBoundary><WhatsAppFlowsPage /></CampaignErrorBoundary>} />
              <Route path="campaigns/flows/:id" element={<CampaignErrorBoundary><WhatsAppFlowsPage /></CampaignErrorBoundary>} />
              <Route path="campaigns/flows/:id/edit" element={<CampaignErrorBoundary><WhatsAppFlowsPage /></CampaignErrorBoundary>} />
              <Route path="campaigns/flowbots" element={<Navigate to="/whatsapp/flows" replace />} />
              <Route path="campaigns/automations" element={<Navigate to="/whatsapp/automations" replace />} />
              <Route path="campaigns/analytics" element={<CampaignErrorBoundary><AnalyticsReportsPage /></CampaignErrorBoundary>} />
              <Route path="campaigns/reports" element={<CampaignErrorBoundary><AnalyticsReportsPage /></CampaignErrorBoundary>} />
              <Route path="campaigns/settings" element={<CampaignErrorBoundary><CampaignSettingsAdminPage mode="settings" /></CampaignErrorBoundary>} />
              <Route path="campaigns/get-started" element={<CampaignErrorBoundary><GuidedFirstCampaignPage /></CampaignErrorBoundary>} />
              <Route path="campaigns/retargeting" element={<CampaignErrorBoundary><RetargetingPage /></CampaignErrorBoundary>} />
              <Route path="campaigns/sequences" element={<CampaignErrorBoundary><DripSequencesPage /></CampaignErrorBoundary>} />
              <Route path="campaigns/recovery" element={<CampaignErrorBoundary><FailureRecoveryPage /></CampaignErrorBoundary>} />
              <Route path="campaigns/template-health" element={<CampaignErrorBoundary><TemplateHealthPage /></CampaignErrorBoundary>} />
              <Route path="campaigns/ai-assistant" element={<CampaignErrorBoundary><AiCampaignAssistantPage /></CampaignErrorBoundary>} />
              <Route path="campaigns/legacy" element={<WACampaigns />} />
              <Route path="campaigns/:id" element={<CampaignErrorBoundary><CampaignDetailPage /></CampaignErrorBoundary>} />
              <Route path="campaigns/:id/edit" element={<CampaignErrorBoundary><CampaignComposerPage /></CampaignErrorBoundary>} />
              <Route path="campaigns/:id/preview" element={<CampaignErrorBoundary><CampaignDetailPage /></CampaignErrorBoundary>} />
              <Route path="flowbots/*" element={<Navigate to="/whatsapp/flows" replace />} />
              <Route path="automation/*" element={<Navigate to="/whatsapp/automations" replace />} />
              <Route path="automations" element={<WAAutomations />} />
              <Route path="automations/create" element={<WAAutomations />} />
              <Route path="automations/:automationId/edit" element={<WAAutomations />} />
              <Route path="reminders" element={<Navigate to="/whatsapp" replace />} />
              <Route path="flows" element={<FlowPageBoundary><WAFlows /></FlowPageBoundary>} />
              <Route path="flows/create" element={<FlowPageBoundary><WAFlows /></FlowPageBoundary>} />
              <Route path="flows/build" element={<FlowPageBoundary><WAFlows /></FlowPageBoundary>} />
              <Route path="flows/build/:flowId" element={<FlowPageBoundary><WAFlows /></FlowPageBoundary>} />
              <Route path="flows/builder" element={<FlowPageBoundary><WAFlows /></FlowPageBoundary>} />
              <Route path="flows/builder/:flowId" element={<FlowPageBoundary><WAFlows /></FlowPageBoundary>} />
              <Route path="analytics" element={<WAAnalytics />} />
              <Route path="accounts" element={<WAAccounts />} />
              <Route path="account" element={<Navigate to="/whatsapp/accounts" replace />} />
              <Route path="connect" element={<Navigate to="/whatsapp/accounts?tab=connect" replace />} />
              <Route path="employees" element={<WAEmployees />} />
              <Route path="enquiries" element={<WAEnquiries />} />
              <Route path="branches" element={<BranchProvider><BranchList /></BranchProvider>} />
              <Route path="branches/new" element={<BranchProvider><BranchCreateWizard /></BranchProvider>} />
              <Route path="branches/:branchId/:slug" element={<BranchProvider><BranchLayout /></BranchProvider>}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<BranchOverview />} />
                <Route path="inbox" element={<BranchInbox />} />
                <Route path="contacts" element={<BranchContacts />} />
                <Route path="employees" element={<BranchEmployees />} />
                <Route path="numbers" element={<BranchNumbers />} />
                <Route path="campaigns" element={<BranchCampaigns />} />
                <Route path="automations" element={<BranchAutomations />} />
                <Route path="flows" element={<BranchFlows />} />
                <Route path="ai-agents" element={<BranchAiAgents />} />
                <Route path="analytics" element={<BranchAnalytics />} />
                <Route path="settings" element={<BranchSettings />} />
                <Route path="audit" element={<BranchAudit />} />
              </Route>
              <Route path="branches/:branchId" element={<Navigate to="workspace/dashboard" replace />} />
              <Route path="billing" element={<WABilling />} />
              <Route path="client-portal" element={<Suspense fallback={<p className="p-8">Loading portal management…</p>}><ClientPortalManage /></Suspense>} />
            </Route>

            {/* Enterprise Campaign Management Suite (/dashboard/campaigns/*) & Admin Control (/admin/campaigns) */}
            <Route
              path="/dashboard/campaigns"
              element={
                <RequireAuth>
                  <CampaignErrorBoundary>
                    <WALayout />
                  </CampaignErrorBoundary>
                </RequireAuth>
              }
            >
              <Route index element={<CampaignCenterDashboard />} />
              <Route path="create" element={<CampaignComposerPage />} />
              <Route path="calendar" element={<CalendarApprovalsPage mode="calendar" />} />
              <Route path="approvals" element={<CalendarApprovalsPage mode="approvals" />} />
              <Route path="audiences" element={<AudienceBuilderPage />} />
              <Route path="audiences/create" element={<AudienceBuilderPage />} />
              <Route path="import" element={<AudienceImportPage />} />
              <Route path="import/:id" element={<AudienceImportPage />} />
              <Route path="consent" element={<ConsentSuppressionPage defaultTab="consent" />} />
              <Route path="consent/import" element={<AudienceImportPage />} />
              <Route path="suppression" element={<ConsentSuppressionPage defaultTab="suppression" />} />
              <Route path="templates" element={<TemplateStudioPage />} />
              <Route path="templates/create" element={<TemplateStudioPage />} />
              <Route path="templates/:id" element={<TemplateStudioPage />} />
              <Route path="templates/:id/edit" element={<TemplateStudioPage />} />
              <Route path="flows" element={<WhatsAppFlowsPage />} />
              <Route path="flows/create" element={<WhatsAppFlowsPage />} />
              <Route path="flows/:id" element={<WhatsAppFlowsPage />} />
              <Route path="flows/:id/edit" element={<WhatsAppFlowsPage />} />
              <Route path="flowbots" element={<Navigate to="/whatsapp/flows" replace />} />
              <Route path="automations" element={<Navigate to="/whatsapp/automations" replace />} />
              <Route path="analytics" element={<AnalyticsReportsPage />} />
              <Route path="reports" element={<AnalyticsReportsPage />} />
              <Route path="reports/create" element={<AnalyticsReportsPage />} />
              <Route path="settings" element={<CampaignSettingsAdminPage mode="settings" />} />
              <Route path="get-started" element={<GuidedFirstCampaignPage />} />
              <Route path="retargeting" element={<RetargetingPage />} />
              <Route path="sequences" element={<DripSequencesPage />} />
              <Route path="recovery" element={<FailureRecoveryPage />} />
              <Route path="template-health" element={<TemplateHealthPage />} />
              <Route path="ai-assistant" element={<AiCampaignAssistantPage />} />
              <Route path=":id" element={<CampaignDetailPage />} />
              <Route path=":id/edit" element={<CampaignComposerPage />} />
              <Route path=":id/preview" element={<CampaignDetailPage />} />
            </Route>
            <Route
              path="/admin/campaigns"
              element={
                <RequireAuth>
                  <CampaignErrorBoundary>
                    <WALayout />
                  </CampaignErrorBoundary>
                </RequireAuth>
              }
            >
              <Route index element={<CampaignSettingsAdminPage mode="admin" />} />
            </Route>

            {/* Single-source redirects: /dashboard/flowbots/* -> /whatsapp/flows, /dashboard/automation/* -> /whatsapp/automations */}
            <Route path="/dashboard/flowbots/create" element={<Navigate to="/whatsapp/flows/create" replace />} />
            <Route path="/dashboard/flowbots/*" element={<Navigate to="/whatsapp/flows" replace />} />
            <Route path="/dashboard/automation/create" element={<Navigate to="/whatsapp/automations/create" replace />} />
            <Route path="/dashboard/automation/*" element={<Navigate to="/whatsapp/automations" replace />} />

            <Route path="/employee" element={<Navigate to="/whatsapp/employees" replace />} />
            <Route path="/employees" element={<Navigate to="/whatsapp/employees" replace />} />
            <Route path="*" element={<Navigate to="/whatsapp" replace />} />
          </Routes></Suspense>
          {process.env.NODE_ENV === "development" && <Agentation />}
        </BrowserRouter>
      </EnterpriseProvider>
    </AuthProvider>
  );
}
