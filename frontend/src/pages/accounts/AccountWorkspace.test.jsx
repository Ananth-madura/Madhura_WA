import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import { Workspace } from "./AccountWorkspace";
import "@testing-library/jest-dom";

jest.mock("axios", () => jest.fn());
jest.mock("../../context/EnterpriseContext", () => ({ useEnterprise: jest.fn() }));
jest.mock("react-router-dom", () => {
  global.TextEncoder = require("util").TextEncoder;
  global.TextDecoder = require("util").TextDecoder;
  return jest.requireActual("react-router");
});

const enterprise = {
  activeTenant: { id: 7, name: "Test business" },
  branches: [{ id: 2, name: "North", status: "active" }],
  isOwnerOrAdmin: true,
  getHeaders: () => ({ Authorization: "Bearer test" }),
};

const sender = {
  id: 1,
  status: "connected",
  phone_number_id: "11111",
  display_phone: "+155511111",
  verified_name: "North business",
  assigned_branches: "North",
  branches: [{ branch_id: 2 }],
  assigned_branch_ids: [2],
  default_branch_ids: [2],
  revision: 3,
  waba_id: "99999",
  has_token: true,
  has_app_secret: true,
};

let calls, list;

beforeEach(() => {
  calls = [];
  list = [sender];
  axios.mockImplementation(async (config) => {
    calls.push(config);
    let data = { success: true };
    if (config.url.endsWith("/meta/senders")) data.senders = list;
    if (config.url.endsWith("/meta/setup")) data.embeddedSignupConfigured = false;
    if (config.url.endsWith("/activity")) data.events = [];
    if (config.url.endsWith("/webhook")) data.verifyToken = "verification-secret";
    if (config.url.endsWith("/assistant/settings")) {
      data.settings = {
        provider: "openai",
        model: "",
        enabled: 0,
        auto_start: 0,
        system_prompt: "",
        hasApiKey: false,
      };
    }
    if (config.url.endsWith("/manual")) data.sender = sender;
    return { data };
  });
});

const mount = (url = "/whatsapp/accounts?sender=1", context = enterprise) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Workspace enterprise={context} />
    </MemoryRouter>
  );

test("shows real sender metadata and sends explicit organization context", async () => {
  mount();
  await screen.findByRole("heading", { name: "North business" });
  expect(calls.every((c) => c.headers["x-tenant-id"] === "7" && c.withCredentials)).toBe(true);
  expect(screen.getByRole("link", { name: /Workflow builder/i })).toHaveAttribute("href", "/whatsapp/flows");
  expect(screen.getByRole("link", { name: /Live Inbox/i })).toHaveAttribute("href", "/whatsapp");
});

test("renders all command center tabs with accessibility semantics", async () => {
  mount();
  await screen.findByRole("heading", { name: "North business" });
  expect(screen.getByRole("tab", { name: /Numbers & Operations/i })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: /Meta Integrations/i })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: /Assign & Team Access/i })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: /Business Assistant/i })).toBeInTheDocument();
});

test("navigates to Meta Integrations tab on Connect button click", async () => {
  mount();
  await screen.findByRole("heading", { name: "North business" });
  const connectBtn = screen.getByRole("button", { name: /Connect WhatsApp Number/i });
  expect(connectBtn).toBeInTheDocument();
  fireEvent.click(connectBtn);
  expect(await screen.findByText(/Connect via Meta Embedded Signup/i)).toBeInTheDocument();
});

test("non-admins see read-only badge and cannot access admin action buttons", async () => {
  mount(undefined, { ...enterprise, isOwnerOrAdmin: false });
  await screen.findByRole("heading", { name: "North business" });
  expect(screen.queryByRole("button", { name: /Connect WhatsApp Number/i })).not.toBeInTheDocument();
  expect(screen.getByText(/Read-only Mode:/i)).toBeInTheDocument();
});

test("assistant saves through the organization-scoped native backend", async () => {
  mount("/whatsapp/accounts?tab=assistant");
  await screen.findByLabelText("Model ID");
  fireEvent.change(screen.getByLabelText("Model ID"), { target: { value: "configured-model" } });
  fireEvent.click(screen.getByRole("button", { name: "Save assistant settings" }));
  await screen.findByText("Assistant settings saved.");
  expect(calls.find((c) => c.method === "put")).toMatchObject({
    data: { model: "configured-model", enabled: false },
    headers: { "x-tenant-id": "7" },
  });
});

test("list failures can be retried with refresh", async () => {
  axios.mockRejectedValueOnce(new Error("Network unavailable"));
  mount();
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
  expect(await screen.findByRole("heading", { name: "North business" })).toBeInTheDocument();
});
