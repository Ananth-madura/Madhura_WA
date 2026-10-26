import { act } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import WAEnquiries from "./whatsappEnquiries";
import { getEnquiries, getEnquirySummary } from "../api/enquiries";
import useWorkspaceAccess from "../hooks/useWorkspaceAccess";

const mockParams = new URLSearchParams();
const mockSetParams = jest.fn();
jest.mock("react-router-dom", () => ({ Link: ({ children }) => <span>{children}</span>, useSearchParams: () => [mockParams, mockSetParams] }));
jest.mock("../components/WAWorkspaceGuide", () => () => null);
jest.mock("../hooks/useWorkspaceAccess", () => jest.fn());
jest.mock("../socket/socket", () => ({ on: jest.fn(), off: jest.fn() }));
jest.mock("../api/enquiries", () => ({
  getEnquiries: jest.fn(), getEnquirySummary: jest.fn(), createEnquiry: jest.fn(), updateEnquiry: jest.fn(), deleteEnquiry: jest.fn(), convertEnquiry: jest.fn(),
  ENQUIRY_TYPES: [{ value: "general", label: "General enquiry" }], enquiryTypeLabel: () => "General enquiry",
}));

const result = name => ({ enquiries: [{ id: 1, name, temperature: "new", status: "open" }], total: 1, totalPages: 1 });

beforeEach(() => {
  jest.clearAllMocks();
  useWorkspaceAccess.mockReturnValue({ admin: true, canEdit: () => true });
  getEnquirySummary.mockResolvedValue({ total: 1, new: 1 });
});

test("a slower old search cannot replace the newest enquiry results", async () => {
  let resolveOld;
  getEnquiries.mockImplementation(params => params.search === "old"
    ? new Promise(resolve => { resolveOld = resolve; })
    : Promise.resolve(result(params.search === "new" ? "Newest result" : "Initial result")));
  render(<WAEnquiries />);
  await screen.findByText("Initial result");
  fireEvent.change(screen.getByLabelText("Search enquiries"), { target: { value: "old" } });
  await waitFor(() => expect(resolveOld).toBeDefined());
  fireEvent.change(screen.getByLabelText(/Search enquiries/), { target: { value: "new" } });
  await screen.findByText("Newest result");
  await act(async () => resolveOld(result("Stale result")));
  expect(screen.queryByText("Stale result")).toBeNull();
  expect(screen.getByText("Newest result")).not.toBeNull();
});

test("read-only enquiry access exposes no conversion, edit or delete actions", async () => {
  useWorkspaceAccess.mockReturnValue({ admin: false, canEdit: () => false });
  getEnquiries.mockResolvedValue(result("Read-only lead"));
  render(<WAEnquiries />);
  await screen.findByText("Read-only lead");
  expect(screen.getByRole("button", { name: "Add enquiry" }).disabled).toBe(true);
  expect(screen.getByLabelText("Temperature for Read-only lead").disabled).toBe(true);
  expect(screen.queryByRole("button", { name: /Convert Read-only/ })).toBeNull();
  expect(screen.queryByRole("button", { name: "Edit Read-only lead" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Delete Read-only lead" })).toBeNull();
});
