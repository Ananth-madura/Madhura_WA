import React, { act } from "react";
import { createRoot } from "react-dom/client";
import axios from "axios";
import { EnterpriseProvider, useEnterprise } from "./EnterpriseContext";
import { useAuth } from "../auth/AuthContext";

jest.mock("../auth/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("axios", () => { const client=jest.requireActual("axios").default;client.get=jest.fn();return client; });
let container, root, workspace;
function Consumer() { workspace = useEnterprise(); return <span>{workspace.activeTenant?.name || "No workspace"}</span>; }
const render = async user => {
  useAuth.mockReturnValue({ user, initializing: false });
  await act(async () => { root.render(<EnterpriseProvider><Consumer /></EnterpriseProvider>); });
};
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();axios.get.mockReset();
  container = document.createElement("div");document.body.appendChild(container);root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount());container.remove(); });

test("login loads the actual workspace and logout clears its branches and privileges", async () => {
  await render(null);
  expect(axios.get).not.toHaveBeenCalled();
  const user = { id: 1, cookieSession: true };
  localStorage.setItem("user", JSON.stringify(user));
  axios.get.mockResolvedValue({ data: { success: true, activeOrganization: { id: 7, name: "Selected business" }, organizations: [{ id: 7 }], branches: [], activeBranch: null, roleInActiveOrg: "organization_owner" } });
  await render(user);
  expect(container.textContent).toBe("Selected business");
  expect(workspace.isOwnerOrAdmin).toBe(true);
  expect(workspace.activeBranch).toBeNull();
  localStorage.clear();await render(null);
  expect(container.textContent).toBe("No workspace");
  expect(workspace.isOwnerOrAdmin).toBe(false);
  expect(workspace.branches).toEqual([]);
});

test("late organization responses cannot replace the most recent selection", async () => {
  const user = { id: 1, cookieSession: true };
  localStorage.setItem("user", JSON.stringify(user));
  const orgs = [{ id: 1, name: "One" }, { id: 2, name: "Two" }];
  axios.get.mockResolvedValueOnce({ data: { success: true, organizations: orgs, activeOrganization: orgs[0], branches: [] } });
  await render(user);
  let completeOld;
  axios.get.mockImplementationOnce(() => new Promise(resolve => { completeOld = resolve; }));
  axios.get.mockResolvedValueOnce({ data: { success: true, organizations: orgs, activeOrganization: orgs[0], branches: [] } });
  let old;
  await act(async () => { old = workspace.switchOrganization(2); });
  await act(async () => { await workspace.switchOrganization(1); });
  await act(async () => { completeOld({ data: { success: true, organizations: orgs, activeOrganization: orgs[1] } });await old; });
  expect(container.textContent).toBe("One");
  expect(localStorage.getItem("active_tenant_id")).toBe("1");
});
