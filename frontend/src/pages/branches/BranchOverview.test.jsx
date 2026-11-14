import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import BranchOverview from "./BranchOverview";
import { getBranchAnalytics } from "../../api/branches";
import "@testing-library/jest-dom";

jest.mock("../../api/branches", () => ({
  getBranchAnalytics: jest.fn(),
}));

jest.mock("react-router-dom", () => ({
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => jest.fn(),
  useLocation: () => ({ pathname: "/whatsapp/branches/1/head-office/dashboard" }),
  useParams: () => ({ branchId: "1", slug: "head-office" }),
}));

const mockRefreshBranch = jest.fn();

const mockActiveBranch = {
  id: 1,
  name: "Head Office",
  slug: "head-office",
  code: "HQ-01",
  city: "Hyderabad",
  is_head_office: 1,
  status: "active",
  timezone: "Asia/Kolkata",
  manager_id: 10,
  manager: {
    id: 10,
    displayName: "Ananya Sharma",
    name: "Ananya Sharma",
    email: "ananya@business.com",
  },
  operating_hours: { start: "09:00", end: "18:00" },
  settings: { assignment_strategy: "round_robin" },
  contacts_count: 342,
  open_conversations_count: 14,
};

const mockSenders = [
  {
    id: 1,
    sender_id: 1,
    display_phone_number: "+91 98765 43210",
    phone_number: "919876543210",
    assignment_type: "dedicated",
    status: "active",
  },
  {
    id: 2,
    sender_id: 2,
    display_phone_number: "+91 91234 56789",
    phone_number: "919123456789",
    assignment_type: "shared",
    status: "active",
  },
];

const mockMembers = [
  {
    id: 10,
    user_id: 10,
    first_name: "Ananya",
    last_name: "Sharma",
    email: "ananya@business.com",
    role: "branch_manager",
    whatsapp_access_level: "full",
    status: "Active",
  },
  {
    id: 11,
    user_id: 11,
    first_name: "Karan",
    last_name: "Mehta",
    email: "karan@business.com",
    role: "agent",
    whatsapp_access_level: "chat_only",
    status: "Active",
  },
];

const mockBranchContext = {
  activeBranch: mockActiveBranch,
  senders: mockSenders,
  members: mockMembers,
  userRole: "organization_admin",
  refreshBranch: mockRefreshBranch,
};

jest.mock("../../context/BranchContext", () => ({
  useBranch: () => mockBranchContext,
}));

describe("BranchOverview Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getBranchAnalytics.mockResolvedValue({
      success: true,
      analytics: {
        conversations: {
          total: 48,
          open: 14,
          resolved: 34,
        },
        messages: {
          total: 310,
          inbound: 190,
          outbound: 120,
        },
        avg_response_time_min: 4.2,
        csat_score: 4.9,
      },
    });
  });

  test("renders branch dashboard header, code badge, and operational controls", async () => {
    render(<BranchOverview />);

    // Verify Title & Code (use getAllByText for "Head Office" since both title and badge display it)
    const headOfficeElements = screen.getAllByText("Head Office");
    expect(headOfficeElements.length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText("HQ-01")).toBeInTheDocument();
    expect(screen.getByText("Active Queue")).toBeInTheDocument();

    // Verify Action CTA
    expect(screen.getByText("Open Branch Inbox")).toBeInTheDocument();
    expect(screen.getByText("Broadcast")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Refresh")).toBeInTheDocument();
    });
  });

  test("renders telemetry KPI metrics accurately from backend analytics", async () => {
    render(<BranchOverview />);

    await waitFor(() => {
      // 14 open chats (in KPI card and inbox button)
      const openChatElements = screen.getAllByText("14");
      expect(openChatElements.length).toBeGreaterThanOrEqual(1);
      // 310 total messages
      expect(screen.getByText("310")).toBeInTheDocument();
    });

    // Check Senders and Staff counts
    const countElements = screen.getAllByText("2");
    expect(countElements.length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText(/Manager: Ananya Sharma/i)).toBeInTheDocument();
    expect(screen.getByText(/4.2m/i)).toBeInTheDocument();
    expect(screen.getByText(/4.9 \/ 5.0/i)).toBeInTheDocument();
    expect(screen.getByText("342")).toBeInTheDocument();
  });

  test("renders attached WhatsApp numbers and team staff rosters", async () => {
    render(<BranchOverview />);

    // Senders list
    expect(screen.getByText("+91 98765 43210")).toBeInTheDocument();
    expect(screen.getByText("Dedicated Number")).toBeInTheDocument();
    expect(screen.getByText("+91 91234 56789")).toBeInTheDocument();
    expect(screen.getByText("Shared Multi-Branch")).toBeInTheDocument();

    // Members list
    expect(screen.getByText("Ananya Sharma")).toBeInTheDocument();
    expect(screen.getByText(/branch_manager/i)).toBeInTheDocument();
    expect(screen.getByText("Karan Mehta")).toBeInTheDocument();
  });

  test("clicking Refresh triggers loadStats and refreshBranch", async () => {
    render(<BranchOverview />);

    // Wait for initial mount load to complete so button is enabled
    const refreshButton = await screen.findByRole("button", { name: /refresh branch telemetry/i });
    await waitFor(() => {
      expect(refreshButton).not.toBeDisabled();
    });

    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(mockRefreshBranch).toHaveBeenCalled();
      expect(getBranchAnalytics).toHaveBeenCalledWith(1);
    });
  });

  test("renders operational sub-module navigation tiles", () => {
    render(<BranchOverview />);

    expect(screen.getByText("Inbox", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText("Contacts", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText("Campaigns", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText("Automations", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText("AI Copilot", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText("Audit Log", { selector: "span" })).toBeInTheDocument();
  });
});
