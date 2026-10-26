import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { act } from "react";
import EmployeeWorkspace from "./EmployeeWorkspace";
import api from "../config/axios";
import { useEnterprise } from "../context/EnterpriseContext";

let mockParams;
jest.mock("react-router-dom", () => ({ Link: ({ children }) => <span>{children}</span>, useSearchParams: () => [mockParams, jest.fn()] }));
jest.mock("../context/EnterpriseContext", () => ({ useEnterprise: jest.fn() }));
jest.mock("../hooks/useWorkspaceAccess", () => ({
  __esModule: true,
  default: () => ({ admin: true, ready: true, permissions: null, canView: () => true, canEdit: () => true }),
}));
jest.mock("../config/axios", () => ({ get: jest.fn(), post: jest.fn(), patch: jest.fn() }));
jest.mock("../socket/socket", () => ({ on: jest.fn(), off: jest.fn() }));

beforeEach(() => { jest.clearAllMocks(); mockParams = new URLSearchParams(); });

test("late customer results cannot cross an organization switch", async () => {
  let tenant = 1, finishOld;
  useEnterprise.mockImplementation(() => ({ activeTenant: { id: tenant } }));
  api.get.mockImplementation(url => {
    if (url.endsWith("/analytics")) return Promise.resolve({ data: { customers: tenant } });
    if (tenant === 1) return new Promise(resolve => { finishOld = resolve; });
    return Promise.resolve({ data: { customers: [{ id: 2, name: "Second organization customer", phone: "912222222222", assigned_agent_id: 2 }], nextCursor: null } });
  });
  const view = render(<EmployeeWorkspace/>);
  await waitFor(() => expect(finishOld).toBeDefined());
  tenant = 2; view.rerender(<EmployeeWorkspace/>);
  expect(await screen.findByText("Second organization customer")).not.toBeNull();
  await act(async () => finishOld({ data: { customers: [{ id: 1, name: "First organization private customer" }], nextCursor: null } }));
  expect(screen.queryByText("First organization private customer")).toBeNull();
});

test("a direct denied customer URL displays the server error without customer work", async () => {
  mockParams = new URLSearchParams("customer=99");
  useEnterprise.mockReturnValue({ activeTenant: { id: 1 } });
  api.get.mockImplementation(url => {
    if (url.endsWith("/99")) return Promise.reject({ response: { status: 404, data: { message: "Customer not found" } } });
    return Promise.resolve({ data: url.endsWith("/analytics") ? {} : { customers: [], nextCursor: null } });
  });
  render(<EmployeeWorkspace/>);
  expect((await screen.findByRole("alert")).textContent).toContain("Customer not found");
  expect(screen.queryByRole("button", { name: "Transfer complete customer" })).toBeNull();
  expect(screen.queryByLabelText("Task title")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await waitFor(() => expect(api.get.mock.calls.filter(([url]) => url.endsWith("/99"))).toHaveLength(2));
});
