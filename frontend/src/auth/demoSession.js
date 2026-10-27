const DEMO_USER = {
  id: -1,
  emp_id: "EMP001",
  name: "Demo Admin",
  first_name: "Demo Admin",
  email: "admin@madhuratech.com",
  role: "admin",
  status: "active",
  isAdmin: true,
  tenant_id: -1,
  tenant_name: "Madhura Demo Workspace",
  branch_id: 1,
  branch_name: "Head Office (Main)",
  branch_code: "HQ-01",
  plan: "growth",
};

/** A sample profile never grants backend access. */
export function buildOfflineDemoSession(reason = "", role = "admin") {
  const isEmp = role === "employee";
  return {
    ...DEMO_USER,
    id: isEmp ? -2 : -1,
    role: isEmp ? "employee" : "admin",
    isAdmin: !isEmp,
    name: isEmp ? "Demo Staff" : "Demo Admin",
    email: isEmp ? "staff@madhuratech.com" : "admin@madhuratech.com",
    token: null,
    cookieSession: false,
    demoMode: true,
    isStrictDemo: true,
    demoReason: reason || "Sample data only. Changes stay in this tab; live services and purchases require your own account.",
  };
}

export async function startDirectDemoSession(apiBase = "", role = "admin") {
  return buildOfflineDemoSession("Sample data only. Changes stay in this tab; no live messages or payments.", role);
}

/** True when the stored session is a demo session. */
export function isDemoSession(user) {
  return Boolean(user && user.demoMode);
}

/**
 * Why demo mode is active, phrased for human display
 */
export function describeDemoReason(user) {
  if (!isDemoSession(user)) return "";
  return user.demoReason || "Sample data only. Changes stay in this tab.";
}

/**
 * Sets instant demo session in storage for 1-click evaluation
 */
export function setDemoSession(role = "admin") {
  const session = buildOfflineDemoSession("Sample data only. Changes stay in this tab.", role);
  try {
    localStorage.setItem("user", JSON.stringify(session));
    localStorage.setItem("active_tenant_id", "-1");
    localStorage.setItem("active_branch_id", "1");
  } catch (_) {}
  return session;
}
