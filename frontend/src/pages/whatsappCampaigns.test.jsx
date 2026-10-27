import { act } from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import axios from "axios";
import WACampaigns from "./whatsappCampaigns";
import { useAuth } from "../auth/AuthContext";
import { useEnterprise } from "../context/EnterpriseContext";

jest.mock("axios", () => ({ get: jest.fn() }));
jest.mock("../auth/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../context/EnterpriseContext", () => ({ useEnterprise: jest.fn() }));
jest.mock("../components/WhatsAppCampaignWizard", () => () => null);
jest.mock("../components/WAVariablePicker", () => ({ __esModule: true, default: () => null, evaluateMessagePlaceholders: text => text }));

const headers = { "x-tenant-id": "1", "x-branch-id": "2" };
beforeEach(() => {
  jest.clearAllMocks();
  useAuth.mockReturnValue({ demoMode: false });
  useEnterprise.mockReturnValue({ activeTenant: { id: 1 }, activeBranch: { id: 2 }, enterpriseHeaders: headers, loading: false });
  axios.get.mockResolvedValue({ data: [] });
});

test("an empty live account shows an empty list rather than sample campaigns", async () => {
  render(<WACampaigns />);
  await screen.findByText("No Campaigns Found");
  expect(screen.queryByText("Diwali Enterprise Broadcast 2026")).toBeNull();
  expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("/api/wa/campaigns"), { headers: expect.objectContaining(headers) });
});

test("a failed live API displays an error and can recover with actual campaign data", async () => {
  axios.get.mockRejectedValue(new Error("offline"));
  render(<WACampaigns />);
  expect((await screen.findByRole("alert")).textContent).toContain("could not be refreshed");
  expect(screen.queryByText("Diwali Enterprise Broadcast 2026")).toBeNull();
  axios.get.mockImplementation(url => Promise.resolve({ data: url.endsWith("/campaigns") ? [{ id: 7, name: "Actual campaign", status: "draft" }] : [] }));
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await screen.findByText("Actual campaign");
  expect(screen.queryByRole("alert")).toBeNull();
});

test("late campaign results from another organization cannot replace current data", async () => {
  let finishOld;
  axios.get.mockImplementation(url => url.endsWith("/campaigns") ? new Promise(resolve => { finishOld = resolve; }) : Promise.resolve({ data: [] }));
  const view = render(<WACampaigns />);
  await waitFor(() => expect(finishOld).toBeDefined());
  useEnterprise.mockReturnValue({ activeTenant: { id: 2 }, activeBranch: null, enterpriseHeaders: { "x-tenant-id": "2" }, loading: false });
  axios.get.mockImplementation(url => Promise.resolve({ data: url.endsWith("/campaigns") ? [{ id: 2, name: "Current organization campaign", status: "draft" }] : [] }));
  view.rerender(<WACampaigns />);
  await screen.findByText("Current organization campaign");
  await act(async () => finishOld({ data: [{ id: 1, name: "Private previous campaign", status: "draft" }] }));
  expect(screen.queryByText("Private previous campaign")).toBeNull();
  expect(screen.getByText("Current organization campaign")).not.toBeNull();
});

test("explicit demo sessions still display sample campaigns without fetching live data", async () => {
  useAuth.mockReturnValue({ demoMode: true });
  render(<WACampaigns />);
  await screen.findByText("Diwali Enterprise Broadcast 2026");
  expect(axios.get).not.toHaveBeenCalled();
});
