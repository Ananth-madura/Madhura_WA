import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from "react-router-dom";
import { Agentation } from "agentation";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { LIVE_BACKEND_URL } from "./config/api";
import Login from "./auth/login";
import Signup from "./auth/signup";
import WALayout from "./layout/WALayout";
import WhatsAppPage from "./pages/whatsapp";
import WAContacts from "./pages/whatsappContacts";
import WATemplates from "./pages/whatsappTemplates";
import WAGroups from "./pages/whatsappGroups";
import WACampaigns from "./pages/whatsappCampaigns";
import WAAutomations from "./pages/whatsappAutomations";
import WAReminders from "./pages/whatsappReminders";
import WAFlows from "./pages/whatsappFlows";
import WAAnalytics from "./pages/whatsappAnalytics";
import WAAccounts from "./pages/whatsappAccounts";
import WAEmployees from "./pages/whatsappEmployees";
import WABilling from "./pages/whatsappBilling";
import { EnterpriseProvider } from "./context/EnterpriseContext";
import { BranchProvider } from "./context/BranchContext";
import BranchList from "./pages/branches/BranchList";
import BranchCreateWizard from "./pages/branches/BranchCreateWizard";
import BranchLayout from "./pages/branches/BranchLayout";
import BranchOverview from "./pages/branches/BranchOverview";
import BranchInbox from "./pages/branches/BranchInbox";
import BranchContacts from "./pages/branches/BranchContacts";
import BranchEmployees from "./pages/branches/BranchEmployees";
import BranchNumbers from "./pages/branches/BranchNumbers";
import BranchCampaigns from "./pages/branches/BranchCampaigns";
import BranchAutomations from "./pages/branches/BranchAutomations";
import BranchFlows from "./pages/branches/BranchFlows";
import BranchAiAgents from "./pages/branches/BranchAiAgents";
import BranchAnalytics from "./pages/branches/BranchAnalytics";
import BranchSettings from "./pages/branches/BranchSettings";
import BranchAudit from "./pages/branches/BranchAudit";
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
  const { user } = useAuth();
  const token = localStorage.getItem("token");
  if (!user && !token) return <Navigate to="/login" replace />;
  return children;
}

/* Signed-in users have no business on the public pages — send them into the
   app instead of showing them a "Sign in" button that would just work. */
function PublicOnly({ children }) {
  const { user } = useAuth();
  const token = localStorage.getItem("token");
  if (user || token) return <Navigate to="/whatsapp" replace />;
  return children;
}

function FlowParamRedirect() {
  const { flowId } = useParams();
  return <Navigate to={flowId ? `/whatsapp/flows/build/${flowId}` : "/whatsapp/flows/build"} replace />;
}

export default function App() {
  // Anti-sleep keep-alive: ping Render backend every 7 minutes to prevent free-tier spin down
  useEffect(() => {
    const keepAlivePing = () => {
      try {
        fetch(`${LIVE_BACKEND_URL}/health`, { method: "GET", mode: "no-cors" }).catch(() => {});
      } catch (_) {}
    };
    keepAlivePing();
    const interval = setInterval(keepAlivePing, 7 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);
  return (
    <AuthProvider>
      <EnterpriseProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
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
              <Route index element={<WhatsAppPage />} />
              <Route path="contacts" element={<WAContacts />} />
              <Route path="templates" element={<WATemplates />} />
              <Route path="groups" element={<WAGroups />} />
              <Route path="campaigns" element={<WACampaigns />} />
              <Route path="automations" element={<WAAutomations />} />
              <Route path="reminders" element={<WAReminders />} />
              <Route path="flows" element={<WAFlows />} />
              <Route path="flows/build" element={<WAFlows />} />
              <Route path="flows/build/:flowId" element={<WAFlows />} />
              <Route path="flows/builder" element={<WAFlows />} />
              <Route path="flows/builder/:flowId" element={<WAFlows />} />
              <Route path="analytics" element={<WAAnalytics />} />
              <Route path="accounts" element={<WAAccounts />} />
              <Route path="employees" element={<WAEmployees />} />
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
            <Route path="*" element={<Navigate to="/whatsapp" replace />} />
          </Routes>
          {process.env.NODE_ENV === "development" && <Agentation />}
        </BrowserRouter>
      </EnterpriseProvider>
    </AuthProvider>
  );
}
