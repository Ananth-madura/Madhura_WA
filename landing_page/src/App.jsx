import { Routes, Route, Navigate } from "react-router-dom";
import Landing from "./pages/Landing";
import MarketingPage from "./pages/marketing/MarketingPage";
import ScrollToTop from "./pages/marketing/ScrollToTop";
import ExternalRedirect from "./components/ExternalRedirect";
import { ALIASES, ROUTES, SECTION_ROUTES } from "./pages/marketing/content/index";

/* ─────────────────────────────────────────────────────────────────────────────
   Public marketing site — standalone on port 3002.

   Three route families:
     1. `/`                       the long-form landing page
     2. ROUTES                    one real URL per content entry (from siteNav)
     3. SECTION_ROUTES + ALIASES  section indexes and links that must not rot

   Authenticated screens are NOT routed here: /login, /signup, /whatsapp and
   /portal forward the browser to the `frontend` workspace (config/site.js).
   ───────────────────────────────────────────────────────────────────────────── */

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        {/* Workspace hand-off */}
        <Route path="/login" element={<ExternalRedirect to="/login" />} />
        <Route path="/signup" element={<ExternalRedirect to="/signup" />} />
        <Route path="/whatsapp/*" element={<ExternalRedirect />} />
        <Route path="/dashboard/*" element={<ExternalRedirect to="/whatsapp" />} />
        <Route path="/portal/*" element={<ExternalRedirect />} />

        {/* The landing page */}
        <Route path="/" element={<Landing />} />

        {/* One route per content page */}
        {ROUTES.map((path) => (
          <Route key={path} path={path} element={<MarketingPage />} />
        ))}

        {/* /product, /company and /legal resolve to their first child */}
        {SECTION_ROUTES.map(([from, to]) => (
          <Route key={from} path={from} element={<Navigate to={to} replace />} />
        ))}

        {/* Legacy and short aliases — old links keep working */}
        {Object.entries(ALIASES).map(([from, to]) => (
          <Route key={from} path={from} element={<Navigate to={to} replace />} />
        ))}

        {/* Unknown paths inside a public section go home instead of dead-ending */}
        {["/product", "/company", "/legal", "/com", "/solutions", "/industries", "/platform", "/developers", "/support", "/trust"].map(
          (section) => (
            <Route
              key={section}
              path={`${section}/*`}
              element={<Navigate to="/" replace />}
            />
          )
        )}

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
