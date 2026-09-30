import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { Agentation } from "agentation";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import Login from "./auth/login";
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

function RequireAuth({ children }) {
  const { user } = useAuth();
  const token = localStorage.getItem("token");
  if (!user && !token) return <Navigate to="/login" replace />;
  return children;
}

function FlowParamRedirect() {
  const { flowId } = useParams();
  return <Navigate to={flowId ? `/whatsapp/flows/build/${flowId}` : "/whatsapp/flows/build"} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/whatsapp" replace />} />
          <Route path="/login" element={<Login />} />
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
          </Route>
          <Route path="*" element={<Navigate to="/whatsapp" replace />} />
        </Routes>
        {process.env.NODE_ENV === "development" && <Agentation />}
      </BrowserRouter>
    </AuthProvider>
  );
}
