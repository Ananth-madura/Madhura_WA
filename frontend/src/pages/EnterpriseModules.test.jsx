import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("react-router-dom", () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => jest.fn(),
  useLocation: () => ({ search: "" }),
}));

import IntegrationCenter from "./integrations/IntegrationCenter";
import ClickToWhatsAppAds from "./ads/ClickToWhatsAppAds";
import WhatsAppCommerce from "./commerce/WhatsAppCommerce";
import AgencyWorkspace from "./agency/AgencyWorkspace";
import AiAgentStudio from "./ai/AiAgentStudio";
import PlatformAdminHub from "./platform/PlatformAdminHub";

describe("Enterprise Modules Render Tests", () => {
  beforeEach(() => {
    jest.spyOn(window, "fetch").mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, items: [], logs: [], stages: [] }),
      })
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("renders IntegrationCenter heading and search", () => {
    render(<IntegrationCenter />);
    expect(screen.getByText(/Integration Center/i)).toBeTruthy();
    expect(screen.getByPlaceholderText(/search integrations/i)).toBeTruthy();
  });

  test("renders ClickToWhatsAppAds hub", () => {
    render(<ClickToWhatsAppAds />);
    expect(screen.getByText(/Click-to-WhatsApp Ads/i)).toBeTruthy();
    expect(screen.getByText(/Meta Ads Attribution/i)).toBeTruthy();
  });

  test("renders WhatsAppCommerce catalog and store management", () => {
    render(<WhatsAppCommerce />);
    expect(screen.getByText(/WhatsApp Commerce & Payments/i)).toBeTruthy();
    expect(screen.getByText(/Conversational Commerce/i)).toBeTruthy();
  });

  test("renders AgencyWorkspace client management", () => {
    render(<AgencyWorkspace />);
    expect(screen.getByText(/Agency & White-Label Management/i)).toBeTruthy();
    expect(screen.getByText(/Multi-Client Agency Command/i)).toBeTruthy();
  });

  test("renders AiAgentStudio prompt and playground", () => {
    render(<AiAgentStudio />);
    expect(screen.getByText(/AI Agents & Knowledge Copilots/i)).toBeTruthy();
    expect(screen.getByText(/Autonomous AI Workforce/i)).toBeTruthy();
  });

  test("renders PlatformAdminHub operational controls", () => {
    render(<PlatformAdminHub />);
    expect(screen.getByText(/Platform Administration Console/i)).toBeTruthy();
    expect(screen.getByText(/Active Tenant Organizations/i)).toBeTruthy();
  });
});
