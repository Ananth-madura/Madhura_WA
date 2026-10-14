import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "../../../auth/AuthContext";
import MarketingPage from "../MarketingPage";
import { ROUTES, SECTION_ROUTES, ALIASES, SECTION_INDEX } from "../content/index";

/* Renders each marketing URL through the real router and asserts the page
   actually produces content — this is what catches a broken content entry or a
   renderer that silently renders nothing. */

function renderAt(path) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          {ROUTES.map((p) => (
            <Route key={p} path={p} element={<MarketingPage />} />
          ))}
          {SECTION_ROUTES.map(([from, to]) => (
            <Route key={from} path={from} element={<MarketingPage />} />
          ))}
          {Object.entries(ALIASES).map(([from, to]) => (
            <Route key={from} path={from} element={<MarketingPage />} />
          ))}
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

describe("marketing site routes", () => {
  test("every registered path renders a heading and a footer link set", () => {
    ROUTES.forEach((path) => {
      const { unmount } = renderAt(path);
      expect(screen.getByRole("heading", { level: 1 }).textContent.length).toBeGreaterThan(10);
      expect(screen.getAllByText("MADHURA").length).toBeGreaterThan(0);
      unmount();
    });
  });

  test("legal pages render their full document title", () => {
    const { unmount } = renderAt("/legal/terms");
    expect(screen.getByRole("heading", { level: 1, name: /terms of service/i })).toBeTruthy();
    unmount();
  });

  test("section indexes resolve to a real page", () => {
    Object.entries(SECTION_INDEX).forEach(([from]) => {
      const { unmount } = renderAt(from);
      expect(screen.getByRole("heading", { level: 1 }).textContent.length).toBeGreaterThan(10);
      unmount();
    });
  });

  test("legacy /com aliases still resolve", () => {
    const { unmount } = renderAt("/com/about");
    expect(screen.getByRole("heading", { level: 1 }).textContent.length).toBeGreaterThan(10);
    unmount();
  });

  test("the footer lists every product, company and legal page", () => {
    const { unmount } = renderAt("/product/live-inbox");
    ["Live Inbox", "Campaigns", "Templates", "Automations", "Analytics",
     "About", "Contact", "Careers", "Documentation",
     "Privacy Policy", "Terms of Service", "Security"].forEach((label) => {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    });
    unmount();
  });
});
