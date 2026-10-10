import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { Agentation } from "agentation";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { LIVE_BACKEND_URL } from "./config/api";
import Landing from "./pages/Landing";
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
const ClientPortal = lazy(() => import("./pages/ClientPortal"));
const ClientPortalManage = lazy(() => import("./pages/ClientPortalManage"));

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
      <BrowserRouter>
        <Routes>
          <Route path="/portal/*" element={<Suspense fallback={<p className="p-8">Opening client portal…</p>}><ClientPortal /></Suspense>} />
          <Route path="/client-portal" element={<Navigate to="/portal" replace />} />
          <Route
            path="/"
            element={
              <PublicOnly>
                <Landing />
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
            <Route path="client-portal" element={<Suspense fallback={<p className="p-8">Loading portal management…</p>}><ClientPortalManage /></Suspense>} />
          </Route>
          <Route path="*" element={<Navigate to="/whatsapp" replace />} />
        </Routes>
        {process.env.NODE_ENV === "development" && <Agentation />}
      </BrowserRouter>
    </AuthProvider>
  );
}
