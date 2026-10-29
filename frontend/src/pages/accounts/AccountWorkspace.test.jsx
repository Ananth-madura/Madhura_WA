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
const enterprise = { activeTenant: { id: 7, name: "Test business" }, branches: [{ id: 2, name: "North", status: "active" }], isOwnerOrAdmin: true, getHeaders: () => ({ Authorization: "Bearer test" }) };
const sender = { id: 1, status: "connected", phone_number_id: "11111", display_phone: "+155511111", verified_name: "North business", assigned_branches: "North", branches: [{ branch_id: 2 }], assigned_branch_ids: [2], default_branch_ids: [2], revision: 3, waba_id: "99999", has_token: true, has_app_secret: true };
let calls, list;
beforeEach(() => {
  calls = []; list = [sender];
  axios.mockImplementation(async config => {
    calls.push(config);
    let data = { success: true };
    if (config.url.endsWith("/meta/senders")) data.senders = list;
    if (config.url.endsWith("/meta/setup")) data.embeddedSignupConfigured = false;
    if (config.url.endsWith("/activity")) data.events = [];
    if (config.url.endsWith("/webhook")) data.verifyToken = "verification-secret";
    if (config.url.endsWith("/assistant/settings")) data.settings = { provider: "openai", model: "", enabled: 0, auto_start: 0, system_prompt: "", hasApiKey: false };
    if (config.url.endsWith("/manual")) data.sender = sender;
    return { data };
  });
});
const mount = (url = "/whatsapp/accounts?sender=1", context = enterprise) => render(<MemoryRouter initialEntries={[url]}><Workspace enterprise={context} /></MemoryRouter>);
test("shows real sender metadata and sends explicit organization context", async () => {
  mount(); await screen.findByRole("heading", { name: "North business" });
  expect(screen.getByText("Not reported by Meta")).toBeInTheDocument();
  expect(calls.every(c => c.headers["x-tenant-id"] === "7" && c.withCredentials)).toBe(true);
  expect(screen.getByRole("link", { name: "Workflow builder" })).toHaveAttribute("href", "/whatsapp/flows");
});
test("search and empty states respond to filters", async () => {
  mount(); await screen.findByRole("heading", { name: "North business" });
  fireEvent.change(screen.getByLabelText("Search numbers"), { target: { value: "missing" } });
  expect(screen.getByRole("heading", { name: "No matching numbers" })).toBeInTheDocument();
});
test("routing saves the current revision and selected branch IDs", async () => {
  mount(); await screen.findByRole("heading", { name: "North business" });
  fireEvent.click(await screen.findByRole("button", { name: "Save routing" })); await screen.findByText("Branch routing saved.");
  const saved = calls.find(c => c.method === "patch");
  expect(saved.data).toMatchObject({ revision: 3, branchIds: [2], defaultBranchIds: [2] });
});
test("failed Meta checks show an actionable error without claiming success", async () => {
  mount(); await screen.findByRole("heading", { name: "North business" });
  axios.mockImplementationOnce(async () => { throw Object.assign(new Error("Meta rejected the token"), { response: { data: { message: "Meta rejected the token" } } }); });
  fireEvent.click(screen.getByRole("button", { name: "Check connection" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Meta rejected the token");
  expect(screen.queryByText("Status verified with Meta.")).not.toBeInTheDocument();
});
test("disconnect requires the explicit inline confirmation", async () => {
  mount(); await screen.findByRole("heading", { name: "North business" });
  fireEvent.click(screen.getByRole("button", { name: "Disconnect number" }));
  expect(calls.some(c => c.method === "delete")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Keep connected" })); expect(screen.queryByText("Confirm disconnect")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Disconnect number" })); fireEvent.click(screen.getByRole("button", { name: "Confirm disconnect" }));
  await screen.findByText("Number disconnected. Linked scheduled automations were paused."); expect(calls.filter(c => c.method === "delete")).toHaveLength(1);
});
test("non-admins cannot access credential, webhook or routing mutations", async () => {
  mount(undefined, { ...enterprise, isOwnerOrAdmin: false }); await screen.findByRole("heading", { name: "North business" });
  expect(screen.queryByRole("button", { name: "Connect number" })).not.toBeInTheDocument();
  expect(screen.queryByText("Update credentials")).not.toBeInTheDocument();
  expect(calls.some(c => c.url.endsWith("/webhook"))).toBe(false);
});
test("connection form uses entered credentials with no fabricated IDs", async () => {
  mount("/whatsapp/accounts?connect=1"); await screen.findByText(/Embedded signup needs/);
  expect(screen.getByLabelText("Phone number ID")).toHaveValue("");
  fireEvent.change(screen.getByLabelText("Phone number ID"), { target: { value: "11111" } });
  fireEvent.change(screen.getByLabelText("WhatsApp Business Account ID"), { target: { value: "99999" } });
  fireEvent.change(screen.getByLabelText("Access token"), { target: { value: "provided-token" } });
  fireEvent.click(screen.getByRole("button", { name: "Verify and connect" }));
  await screen.findByText("Number verified and saved. Configure its webhook to receive messages.");
  expect(calls.find(c => c.url.endsWith("/manual")).data).toMatchObject({ phoneNumberId: "11111", accessToken: "provided-token" });
});
test("assistant saves through the organization-scoped native backend", async () => {
  mount("/whatsapp/accounts?tab=assistant"); await screen.findByLabelText("Model ID");
  fireEvent.change(screen.getByLabelText("Model ID"), { target: { value: "configured-model" } });
  fireEvent.click(screen.getByRole("button", { name: "Save assistant settings" })); await screen.findByText("Assistant settings saved.");
  expect(calls.find(c => c.method === "put")).toMatchObject({ data: { model: "configured-model", enabled: false }, headers: { "x-tenant-id": "7" } });
});
test("list failures can be retried with refresh", async () => {
  axios.mockRejectedValueOnce(new Error("Network unavailable")); mount();
  await screen.findByRole("alert"); fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
  expect(await screen.findByRole("heading", { name: "North business" })).toBeInTheDocument();
});
