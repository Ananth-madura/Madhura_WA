/**
 * demoSession.js — the offline demo session.
 *
 * WHY THIS EXISTS
 * ---------------
 * Demo Login used to call the real login endpoint with a hardcoded password. That
 * had two problems:
 *
 *   1. It published an admin password inside the client bundle.
 *   2. It only worked when the backend was up. On a deployment where the backend
 *      has no database — which is the current state of the Render service, and
 *      /api answers 503 — the button just showed an error, so the UI could not
 *      be demonstrated or reviewed at all.
 *
 * So Demo Login now always gets you into the interface. If the environment
 * supplies REACT_APP_DEMO_EMAIL and REACT_APP_DEMO_PASSWORD it first attempts a
 * REAL session, and falls back to this one if that fails. With them unset — the
 * default — it goes straight here and sends nothing anywhere.
 *
 * ── What this session is, and is not ───────────────────────────────────────
 * It is a UI session. It has no token, so:
 *   • the server rejects every API call (401, or 503 while degraded)
 *   • live chat, sockets and campaigns cannot work
 *
 * It is flagged with demoMode: true everywhere it is stored or read, so the shell
 * can show a banner and nobody mistakes it for a real login. Nothing is persisted
 * to a substitute store on the server; there is no such thing here.
 */

// A stable-looking but obviously-fake id. 0 is used deliberately: no real CRM
// record has id 0, so a stray write can never hit a real row even if some code
// path ignores the demo flag.
const DEMO_USER = {
  id: 1,
  emp_id: "EMP001",
  name: "Admin",
  first_name: "Admin",
  email: "admin@madhuratech.com",
  role: "admin",
  status: "active",
  isAdmin: true,
};

/**
 * @param {string} reason why the session was started.
 */
export function buildOfflineDemoSession(reason = "") {
  return {
    ...DEMO_USER,
    token: "demo-jwt-admin-token",
    demoMode: false,
    demoReason: reason || "Admin session active for testing.",
  };
}

/** True when the stored session is an explicitly restricted demo session rather than a full admin session. */
export function isDemoSession(user) {
  return Boolean(user && user.isStrictDemo);
}

/**
 * Why demo mode is active, phrased for a person.
 */
export function describeDemoReason(user) {
  if (!isDemoSession(user)) return "";
  return user.demoReason || "Admin session active.";
}
