import axios from "axios";

/**
 * demoSession.js — Dev & testing demo session support.
 *
 * Provides instant 1-click access for developers and evaluators to preview
 * the multi-tenant WhatsApp CRM platform.
 *
 * First attempts to authenticate directly via POST /api/auth/demo-login
 * to obtain a genuine JWT token with full access. If the backend is offline
 * or unreachable, falls back to the safe client-side preview session.
 */

const DEMO_USER = {
  id: 1,
  emp_id: "EMP001",
  name: "Demo Admin",
  first_name: "Demo Admin",
  email: "admin@madhuratech.com",
  role: "admin",
  status: "active",
  isAdmin: true,
  tenant_id: 1,
  tenant_name: "Madhura Demo Workspace",
  branch_id: 1,
  branch_name: "Head Office (Main)",
  branch_code: "HQ-01",
  plan: "growth",
};

/**
 * Creates an offline fallback session if backend is completely unreachable
 */
export function buildOfflineDemoSession(reason = "", role = "admin") {
  const isEmp = role === "employee";
  return {
    ...DEMO_USER,
    id: isEmp ? 2 : 1,
    role: isEmp ? "employee" : "admin",
    isAdmin: !isEmp,
    name: isEmp ? "Demo Staff" : "Demo Admin",
    email: isEmp ? "staff@madhuratech.com" : "admin@madhuratech.com",
    token: null,
    demoMode: true,
    isStrictDemo: true,
    demoReason: reason || "Dev session active for testing.",
  };
}

/**
 * Initiates direct demo access: calls backend /api/auth/demo-login first,
 * or gracefully falls back to offline demo session if network/backend fails.
 */
export async function startDirectDemoSession(apiBase = "", role = "admin") {
  try {
    const res = await axios.post(`${apiBase}/api/auth/demo-login`, { role }, { timeout: 8000 });
    if (res.data?.token) {
      return {
        ...res.data.user,
        token: res.data.token,
        tenant: res.data.tenant,
        demoMode: true,
        isStrictDemo: false,
        demoReason: "Authenticated developer & test session active.",
      };
    }
  } catch (err) {
    console.warn("Backend demo-login unavailable, using offline preview mode:", err.message);
  }

  return buildOfflineDemoSession("Interactive developer demo session active.", role);
}

/** True when the stored session is an offline demo session */
export function isDemoSession(user) {
  return Boolean(user && user.demoMode);
}

/**
 * Why demo mode is active, phrased for human display
 */
export function describeDemoReason(user) {
  if (!isDemoSession(user)) return "";
  return user.demoReason || "Developer test session active.";
}

/**
 * Sets instant demo session in storage for 1-click evaluation
 */
export function setDemoSession(role = "admin") {
  const session = buildOfflineDemoSession("Interactive developer demo session active.", role);
  try {
    localStorage.setItem("user", JSON.stringify(session));
    localStorage.setItem("active_tenant_id", "1");
    localStorage.setItem("active_branch_id", "1");
  } catch (_) {}
  return session;
}
