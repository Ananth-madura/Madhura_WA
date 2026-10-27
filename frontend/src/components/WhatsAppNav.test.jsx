import { render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import WhatsAppNav from "./WhatsAppNav";
import useWorkspaceAccess from "../hooks/useWorkspaceAccess";

const mockNavigate = jest.fn();
let mockPathname = "/whatsapp/team-inbox";
jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: mockPathname }),
}));
jest.mock("axios", () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock("../socket/socket", () => ({ on: jest.fn(), off: jest.fn() }));
jest.mock("../hooks/useWorkspaceAccess", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("../auth/AuthContext", () => ({ useAuth: () => ({ user: { whatsapp_access_level: "full" } }) }));

const grants = (modules) => {
  const granted = new Set(modules);
  return {
    admin: false,
    ready: true,
    permissions: {},
    canView: (module) => granted.has(module),
    canEdit: () => false,
  };
};

const tabLabels = () =>
  screen.getAllByRole("button").filter(button => button.getAttribute("class")?.includes("wa-nav-tab-btn")).map(button => button.textContent.trim());

beforeEach(() => {
  jest.clearAllMocks();
  mockPathname = "/whatsapp/team-inbox";
  axios.get.mockResolvedValue({ data: {} });
  useWorkspaceAccess.mockReturnValue(grants([]));
});

test("a member with no extra grants sees the inbox routes", () => {
  render(<WhatsAppNav />);
  expect(tabLabels()).toEqual(["Team Inbox", "Live Chats"]);
});

test("a member sees exactly the modules the administrator granted", () => {
  useWorkspaceAccess.mockReturnValue(grants(["customers", "contacts", "campaigns", "analytics"]));
  render(<WhatsAppNav />);
  expect(tabLabels()).toEqual(["Team Inbox", "My workspace", "Live Chats", "Contacts", "Bulk Campaigns", "Analytics"]);
  for (const blocked of ["Branches", "Accounts", "Employees"]) {
    expect(screen.queryByText(blocked)).toBeNull();
  }
});

test("an administrator sees the full rail including the administration tabs", async () => {
  useWorkspaceAccess.mockReturnValue({
    admin: true,
    ready: true,
    permissions: null,
    canView: () => true,
    canEdit: () => true,
  });
  render(<WhatsAppNav />);
  // Administrators poll session status; let that settle inside act().
  await waitFor(() => expect(axios.get).toHaveBeenCalled());
  expect(tabLabels()).toEqual([
    "Team Inbox",
    "My workspace",
    "Live Chats",
    "Contacts",
    "Enquiries",
    "Templates",
    "Contact Groups",
    "Bulk Campaigns",
    "Automations",
    "Chatbot Flows",
    "Analytics",
    "Client portal",
    "Branches",
    "Accounts",
    "Employees",
  ]);
});

test("workspace tab is exact so campaigns does not keep it active", () => {
  mockPathname = "/whatsapp/campaigns";
  useWorkspaceAccess.mockReturnValue(grants(["customers", "campaigns"]));
  render(<WhatsAppNav />);
  const active = screen.getAllByRole("button").filter(button => button.getAttribute("class")?.includes("wa-nav-tab-btn") && button.getAttribute("class")?.includes("is-active")).map(button => button.textContent.trim());
  expect(active).toEqual(["Bulk Campaigns"]);
});
