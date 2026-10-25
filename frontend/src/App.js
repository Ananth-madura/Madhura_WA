import { lazy, Suspense, useEffect } from "react";
import FlowPageBoundary from "./components/FlowPageBoundary";
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from "react-router-dom";
import { Agentation } from "agentation";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import Login from "./auth/login";
import { EnterpriseProvider, useEnterprise } from "./context/EnterpriseContext";
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
const WAReminders = lazy(() => import("./pages/whatsappReminders"));
const WAFlows = lazy(() => import("./pages/whatsappFlows"));
const WAAnalytics = lazy(() => import("./pages/whatsappAnalytics"));
const WAAccounts = lazy(() => import("./pages/whatsappAccounts"));
const WAEmployees = lazy(() => import("./pages/whatsappEmployees"));
const SharedTeamInbox = lazy(() => import("./components/SharedTeamInbox"));
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

/* Marketing site now lives in the sibling `landing_page` project (port 3002).
   Old public URLs on this origin hand off there so shared links keep working. */
const MARKETING_URL = (process.env.REACT_APP_MARKETING_URL || "").replace(/\/+$/, "");

function MarketingHandoff({ to = "" }) {
  const { pathname, search, hash } = useLocation();
  const target = to && to !== "/" ? to : pathname;
  useEffect(() => {
    if (MARKETING_URL) {
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
  "getting-started", "tutorials", "videos", "case-studies",
  "faqs", "compare", "demo", "onboarding", "news", "accessibility",
  "com",
];

function RequireAuth({ children }) {
  const { user, initializing } = useAuth();
  if(initializing)return <p className="p-4">Checking your browser session…</p>;
  const token = localStorage.getItem("token");
  if (!user && !token) return <Navigate to="/login" replace />;
  return children;
}

/* Signed-in users have no business on the public pages — send them into the
   app instead of showing them a "Sign in" button that would just work. */
function PublicOnly({ children }) {
  const { user, initializing } = useAuth();
  if(initializing)return <p className="p-4">Checking your browser session…</p>;
  const token = localStorage.getItem("token");
  if (user || token) return <Navigate to="/whatsapp" replace />;
  return children;
}

function FlowParamRedirect() {
  const { flowId } = useParams();
  return <Navigate to={flowId ? `/whatsapp/flows/build/${flowId}` : "/whatsapp/flows/build"} replace />;
}

function WorkspaceInbox() {
  const { user, demoMode } = useAuth();
  const {isOwnerOrAdmin}=useEnterprise();
  return !demoMode && !isOwnerOrAdmin && user?.role!=="platform_admin"
    ? <SharedTeamInbox /> : <WhatsAppPage />;
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
                  <MarketingHandoff to="/" />
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
              <Route path="team-inbox" element={<SharedTeamInbox />} />
              <Route path="contacts" element={<WAContacts />} />
              <Route path="templates" element={<WATemplates />} />
              <Route path="templates/create" element={<WATemplateCreate />} />
              <Route path="templates/:templateId/edit" element={<WATemplateCreate />} />
              <Route path="groups" element={<WAGroups />} />
              <Route path="campaigns" element={<WACampaigns />} />
              <Route path="automations" element={<WAAutomations />} />
              <Route path="reminders" element={<WAReminders />} />
              <Route path="flows" element={<FlowPageBoundary><WAFlows /></FlowPageBoundary>} />
              <Route path="flows/create" element={<FlowPageBoundary><WAFlows /></FlowPageBoundary>} />
              <Route path="flows/build" element={<FlowPageBoundary><WAFlows /></FlowPageBoundary>} />
              <Route path="flows/build/:flowId" element={<FlowPageBoundary><WAFlows /></FlowPageBoundary>} />
              <Route path="flows/builder" element={<FlowPageBoundary><WAFlows /></FlowPageBoundary>} />
              <Route path="flows/builder/:flowId" element={<FlowPageBoundary><WAFlows /></FlowPageBoundary>} />
              <Route path="analytics" element={<WAAnalytics />} />
              <Route path="accounts" element={<WAAccounts />} />
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
            <Route path="/employee" element={<Navigate to="/whatsapp/employees" replace />} />
            <Route path="*" element={<Navigate to="/whatsapp" replace />} />
          </Routes></Suspense>
          {process.env.NODE_ENV === "development" && <Agentation />}
        </BrowserRouter>
      </EnterpriseProvider>
    </AuthProvider>
  );
}
