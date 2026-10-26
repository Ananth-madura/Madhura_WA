import {
  ADMIN_ONLY_PATHS,
  canOpenWorkspacePath,
  isWorkspaceAdmin,
  isWorkspaceSubadmin,
  moduleLabel,
  workspaceModuleForPath,
} from "./workspaceAccess";

describe("workspace access policy", () => {
  test("administrators are recognized from every source of authority", () => {
    expect(isWorkspaceAdmin({ demoMode: true })).toBe(true);
    expect(isWorkspaceAdmin({ orgRole: "organization_owner" })).toBe(true);
    expect(isWorkspaceAdmin({ orgRole: "organization_admin" })).toBe(true);
    expect(isWorkspaceAdmin({ isOwnerOrAdmin: true })).toBe(true);
    // Before the membership resolves, the session role is the fallback.
    expect(isWorkspaceAdmin({ globalRole: "platform_admin" })).toBe(true);
    expect(isWorkspaceAdmin({ globalRole: "admin" })).toBe(true);
    expect(isWorkspaceAdmin({ globalRole: "subadmin" })).toBe(true);
  });

  test("the organization membership overrides a stale session role", () => {
    // Demoted administrator: the 14-day token still says admin, the
    // membership says agent. The membership wins.
    expect(isWorkspaceAdmin({ orgRole: "agent", globalRole: "admin" })).toBe(false);
    expect(isWorkspaceAdmin({ orgRole: "agent", globalRole: "subadmin" })).toBe(false);
    expect(isWorkspaceAdmin({ orgRole: "branch_manager", isOwnerOrAdmin: true })).toBe(false);
    // Promoted member whose token has not refreshed yet still gets admin UI.
    expect(isWorkspaceAdmin({ orgRole: "organization_admin", globalRole: "employee" })).toBe(true);
  });

  test("agents and employees are members, not administrators", () => {
    expect(isWorkspaceAdmin({ orgRole: "agent", globalRole: "employee" })).toBe(false);
    expect(isWorkspaceAdmin({ orgRole: "branch_manager", globalRole: "employee" })).toBe(false);
    expect(isWorkspaceAdmin()).toBe(false);
  });

  test("sub-admin is a workspace administrator but not a full administrator", () => {
    expect(isWorkspaceSubadmin({ actorRole: "subadmin" })).toBe(true);
    expect(isWorkspaceSubadmin({ globalRole: "subadmin" })).toBe(true);
    expect(isWorkspaceSubadmin({ actorRole: "admin" })).toBe(false);
    expect(isWorkspaceSubadmin({ actorRole: "employee" })).toBe(false);
    // A sub-admin still administers the workspace shell.
    expect(isWorkspaceAdmin({ orgRole: "organization_admin", globalRole: "subadmin" })).toBe(true);
  });

  test("members may open the operational workspace but not administration surfaces", () => {
    for (const path of [
      "/whatsapp",
      "/whatsapp/team-inbox",
      "/whatsapp/contacts",
      "/whatsapp/enquiries",
      "/whatsapp/templates",
      "/whatsapp/templates/create",
      "/whatsapp/groups",
      "/whatsapp/campaigns",
      "/whatsapp/automations",
      "/whatsapp/flows",
      "/whatsapp/flows/build/12",
      "/whatsapp/analytics",
      "/whatsapp/client-portal",
    ]) {
      expect(canOpenWorkspacePath(path, false)).toBe(true);
    }

    for (const path of [
      "/whatsapp/employees",
      "/whatsapp/employees/7",
      "/whatsapp/accounts",
      "/whatsapp/branches",
      "/whatsapp/branches/3",
      "/whatsapp/billing",
      "/whatsapp/employees/",
    ]) {
      expect(canOpenWorkspacePath(path, false)).toBe(false);
    }
  });

  test("administrators may open every path, including the administration surfaces", () => {
    for (const path of [...ADMIN_ONLY_PATHS, "/whatsapp/contacts", "/whatsapp"]) {
      expect(canOpenWorkspacePath(path, true)).toBe(true);
    }
  });

  test("route prefixes resolve to the module that gates them", () => {
    expect(workspaceModuleForPath("/whatsapp/workspace/campaigns")).toBe("campaigns");
    expect(workspaceModuleForPath("/whatsapp/workspace")).toBe("customers");
    expect(workspaceModuleForPath("/whatsapp/contacts/12")).toBe("contacts");
    expect(workspaceModuleForPath("/whatsapp/enquiries")).toBe("enquiries");
    expect(workspaceModuleForPath("/whatsapp/templates/create")).toBe("templates");
    expect(workspaceModuleForPath("/whatsapp/groups")).toBe("groups");
    expect(workspaceModuleForPath("/whatsapp/campaigns/launch")).toBe("campaigns");
    expect(workspaceModuleForPath("/whatsapp/automations")).toBe("automations");
    expect(workspaceModuleForPath("/whatsapp/flows/build/9")).toBe("flows");
    expect(workspaceModuleForPath("/whatsapp/analytics")).toBe("analytics");
    expect(workspaceModuleForPath("/whatsapp/client-portal/documents")).toBe("client_portal");
  });

  test("paths outside a module return no requirement", () => {
    expect(workspaceModuleForPath("/whatsapp")).toBeNull();
    expect(workspaceModuleForPath("/whatsapp/team-inbox")).toBeNull();
    expect(workspaceModuleForPath("/whatsapp/employees")).toBeNull();
  });

  test("module labels fall back to the raw key", () => {
    expect(moduleLabel("client_portal")).toBe("Client portal");
    expect(moduleLabel("flows")).toBe("Chatbot flows");
    expect(moduleLabel("unknown_module")).toBe("unknown_module");
  });
});
