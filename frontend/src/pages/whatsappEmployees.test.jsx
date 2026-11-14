import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import axios from "axios";
import WAEmployees from "./whatsappEmployees";
import "@testing-library/jest-dom";

jest.mock("axios");

jest.mock("react-router-dom", () => ({
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => jest.fn(),
  useLocation: () => ({ pathname: "/whatsapp/employees" }),
}));

jest.mock("../components/InboxRoutingSettings", () => () => <div data-testid="inbox-routing-settings" />);
jest.mock("../components/WAWorkspaceGuide", () => () => null);

const mockAuthContext = {
  user: { id: 1, role: "admin", email: "admin@business.com" },
  demoMode: false,
};

const mockEnterpriseContext = {
  activeTenant: { id: 7, name: "Test Enterprise" },
  activeBranch: { id: 1, name: "HQ" },
  branches: [
    { id: 1, name: "Head Office", code: "HQ-01", is_head_office: true },
    { id: 2, name: "North Branch", code: "NB-02", is_head_office: false },
  ],
  enterpriseHeaders: { "x-tenant-id": "7" },
  isOwnerOrAdmin: true,
  actorRole: "admin",
  loading: false,
};

jest.mock("../auth/AuthContext", () => ({
  useAuth: () => mockAuthContext,
}));

jest.mock("../context/EnterpriseContext", () => ({
  useEnterprise: () => mockEnterpriseContext,
}));

const mockEmployees = [
  {
    id: 101,
    first_name: "Rahul",
    last_name: "Verma",
    email: "rahul@business.com",
    role: "employee",
    whatsapp_access_level: "full",
    job_title: "Support Lead",
    access_code: "EMP-98214",
    status: "active",
    branch_name: "Head Office",
  },
  {
    id: 102,
    first_name: "Priya",
    last_name: "Nair",
    email: "priya@business.com",
    role: "agent",
    whatsapp_access_level: "campaign_only",
    job_title: "Broadcast Specialist",
    access_code: "EMP-44102",
    status: "pending",
    branch_name: "North Branch",
  },
];

const mockAnalytics = {
  total_employees: 2,
  active_employees: 1,
  pending_activation: 1,
  access_levels: { full: 1, chat_only: 0, read_only: 0, campaign_only: 1 },
  total_messages_dispatched: 1450,
};

beforeEach(() => {
  jest.clearAllMocks();
  axios.get.mockImplementation(() =>
    Promise.resolve({
      data: {
        employees: mockEmployees,
        analytics: mockAnalytics,
      },
    })
  );
});

test("renders employees directory with KPI stats and staff list", async () => {
  render(<WAEmployees />);

  expect(await screen.findByRole("heading", { name: /Employees & access/i })).toBeInTheDocument();
  expect(await screen.findByText("Rahul Verma")).toBeInTheDocument();
  expect(screen.getByText("Priya Nair")).toBeInTheDocument();

  // Check KPI stat numbers
  expect(screen.getByText("Total staff")).toBeInTheDocument();
  expect(screen.getByText("1,450")).toBeInTheDocument();
});

test("filters employee list based on search query", async () => {
  render(<WAEmployees />);
  await screen.findByText("Rahul Verma");

  const searchInput = screen.getByLabelText("Search employees directory");
  fireEvent.change(searchInput, { target: { value: "Priya" } });

  expect(screen.getByText("Priya Nair")).toBeInTheDocument();
  expect(screen.queryByText("Rahul Verma")).not.toBeInTheDocument();
});

test("opens Add Employee modal and submits form", async () => {
  axios.post.mockResolvedValueOnce({
    data: {
      employee: {
        id: 103,
        first_name: "Amit",
        last_name: "Kumar",
        email: "amit@business.com",
        access_code: "EMP-77123",
        whatsapp_access_level: "full",
      },
    },
  });

  render(<WAEmployees />);
  await screen.findByText("Rahul Verma");

  const addBtn = screen.getByRole("button", { name: /Add employee/i });
  fireEvent.click(addBtn);

  expect(screen.getByRole("heading", { name: /Add new employee/i })).toBeInTheDocument();

  fireEvent.change(screen.getByPlaceholderText(/e\.g\. Ananya/i), { target: { value: "Amit" } });
  fireEvent.change(screen.getByPlaceholderText("employee@company.com"), { target: { value: "amit@business.com" } });

  const submitBtn = screen.getByRole("button", { name: /Create & generate code/i });
  fireEvent.click(submitBtn);

  await waitFor(() => {
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining("/api/auth/employees"),
      expect.objectContaining({ first_name: "Amit", email: "amit@business.com" }),
      expect.any(Object)
    );
  });
});
