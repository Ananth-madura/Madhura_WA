/**
 * end-to-end socket check — proves the browser↔backend socket path actually
 * authenticates and authorises, rather than merely opening.
 *
 *   node scripts/check-socket-auth.js
 *
 * Boots nothing. Assumes the backend is already running and reachable:
 *   VERIFY_API_URL=https://api.example.com node scripts/check-socket-auth.js
 *
 * Requires `socket.io-client` (already a frontend dependency) and a JWT signed
 * with the backend's JWT_SECRET.
 *
 * What it proves:
 *   1. a socket with NO token is refused          (the internet-facing risk)
 *   2. a socket with a valid token connects        (auth callback shape is right)
 *   3. the token's own userId can be joined        (normal path still works)
 *   4. a DIFFERENT userId is refused               (no impersonation)
 *   5. join_admin is refused for a non-admin       (no privilege escalation)
 *
 * Exit 0 = all good. Exit 1 = read which check failed.
 */

const path = require("path");
const fs = require("fs");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

let jwt;
let io;

// socket.io-client is a frontend dependency. In this repo it also exists at
// ../frontend/node_modules, so try that before giving up — otherwise every
// developer has to install a second copy just to run this one check.
const requireFrom = (mod) => {
  try {
    return require(mod);
  } catch (_) {
    try {
      const alt = path.join(__dirname, "..", "..", "frontend", "node_modules", mod);
      if (fs.existsSync(alt)) return require(alt);
    } catch (_) {
      /* fall through */
    }
    return null;
  }
};

jwt = requireFrom("jsonwebtoken");
io = requireFrom("socket.io-client");

if (!jwt || !io) {
  console.error("This check needs jsonwebtoken and socket.io-client.");
  console.error("  Option A: npm i -D socket.io-client   (in backend/)");
  console.error("  Option B: run npm install in ../frontend so ../frontend/node_modules exists");
  process.exit(1);
}

const API_URL = (process.env.VERIFY_API_URL || "http://localhost:5001").replace(/\/+$,?/, "").replace(/\/$/, "");
const SECRET = process.env.JWT_SECRET;

if (!SECRET) {
  console.error("JWT_SECRET not found. Set it in the environment or in backend/.env.");
  process.exit(1);
}
if (/^CHANGE_ME/.test(SECRET)) {
  console.error("JWT_SECRET is still the placeholder. Generate a real one.");
  process.exit(1);
}

const SELF_ID = Number(process.env.CHECK_USER_ID || 1);
const OTHER_ID = Number(process.env.CHECK_OTHER_USER_ID || SELF_ID + 1);

const mint = (id, role) =>
  jwt.sign({ id, role, name: `socket-check-${id}` }, SECRET, { expiresIn: "10m" });

const selfToken = mint(SELF_ID, "employee");
const otherToken = mint(OTHER_ID, "employee");

const ok = (s) => console.log(`\u001b[32mPASS\u001b[0m  ${s}`);
const bad = (s) => {
  failures += 1;
  console.log(`\u001b[31mFAIL\u001b[0m  ${s}`);
};
const note = (s) => console.log(`\u001b[90m      ${s}\u001b[0m`);

let failures = 0;

/**
 * Try to connect a socket with the given auth payload.
 *
 * Resolves { connected, error, socket }.
 *
 * NOTE: on success the socket is returned OPEN. An earlier version closed it
 * inside finish(), which meant every emitAndWait() that followed fired at a
 * closed socket, got no reply from the server, and resolved as "allowed" on
 * its timeout. That produced a false PASS on check 3 and a false FAIL on
 * checks 4 and 5. The caller owns the lifetime.
 */
const tryConnect = (url, authPayload, { namespace = "/", ms = 8000 } = {}) =>
  new Promise((resolve) => {
    let settled = false;
    const target = namespace === "/" ? url : `${url}${namespace}`;
    const socket = io(target, {
      path: "/socket.io",
      transports: ["websocket"],
      reconnection: false,
      timeout: ms,
      // Exactly the callback shape the app uses. If this is wrong the server
      // sees no token at all and every "valid token" check fails too — which is
      // exactly the bug this script exists to catch.
      auth: (cb) => cb(authPayload),
    });

    const finish = (result) => {
      if (settled) return;
      settled = true;
      if (!result.connected) socket.close();
      resolve(result);
    };

    socket.on("connect", () => finish({ connected: true, socket }));
    socket.on("connect_error", (err) => finish({ connected: false, error: err }));
    setTimeout(() => finish({ connected: false, error: new Error("timeout") }), ms);
  });

/**
 * Emit a room-join and report whether the server permitted it.
 *
 * Both outcomes are inferred from traffic, never from a success event, because
 * the join handlers emit nothing on success:
 *   "denied"  -> server emitted join_denied
 *   "allowed" -> no join_denied within the window
 *
 * A missing reply therefore means permitted, which is what we want to assert.
 */
const emitAndWait = (socket, event, payload, ms = 2500) =>
  new Promise((resolve) => {
    let settled = false;
    const done = (outcome) => {
      if (settled) return;
      settled = true;
      socket.off("join_denied", onDeny);
      clearTimeout(timer);
      resolve(outcome);
    };
    const onDeny = () => done("denied");
    socket.on("join_denied", onDeny);
    const timer = setTimeout(() => done("allowed"), ms);
    socket.emit(event, payload);
  });

(async () => {
  console.log("");
  console.log("  Socket.IO auth end-to-end check");
  console.log("  " + "-".repeat(52));
  note(`target ${API_URL}`);
  note(`self user ${SELF_ID} · other user ${OTHER_ID}`);
  console.log("");

  if (!/^https?:\/\//.test(API_URL)) {
    bad("VERIFY_API_URL looks wrong");
    process.exit(1);
  }

  // ── 1. No token must be refused ────────────────────────────────────────────
  const anon = await tryConnect(API_URL, {});
  if (!anon.connected) {
    ok("1. Anonymous socket is refused");
    note(`server said: ${anon.error?.message}`);
  } else {
    bad("1. Anonymous socket CONNECTED — the socket has no authentication");
    note("Anyone on the internet can open a socket and subscribe to rooms.");
  }

  // ── 2. Valid token must connect ────────────────────────────────────────────
  const authed = await tryConnect(API_URL, { token: selfToken });
  if (authed.connected) {
    ok("2. Socket with a valid JWT connects");
  } else {
    bad(`2. Socket with a valid JWT was refused: ${authed.error?.message}`);
    note("If this fails, check the client `auth` option uses the CALLBACK form");
    note("(auth: (cb) => cb({ token })), and that frontend/backend share JWT_SECRET.");
    process.exit(1);
  }

  // ── 3. Joining your OWN user room must work ────────────────────────────────
  const selfJoin = await emitAndWait(authed.socket, "join", SELF_ID);
  if (selfJoin === "allowed") ok(`3. Joining your own room (user:${SELF_ID}) is allowed`);
  else bad(`3. Joining your own room was denied — the normal path is broken`);
  authed.socket.close();

  // ── 4. Joining SOMEONE ELSE's room must be refused ──────────────────────────
  const asSelf = await tryConnect(API_URL, { token: selfToken });
  if (asSelf.connected) {
    const crossJoin = await emitAndWait(asSelf.socket, "join", OTHER_ID);
    if (crossJoin === "denied") {
      ok(`4. Impersonating user:${OTHER_ID} is refused`);
    } else {
      bad(`4. user:${SELF_ID} was able to join user:${OTHER_ID}`);
      note("Rooms are just strings. This lets any user read another's live messages.");
    }
    asSelf.socket.close();
  } else {
    bad(`4. Could not re-authenticate for the impersonation test: ${asSelf.error?.message}`);
  }

  // ── 5. join_admin must be refused for a non-admin ──────────────────────────
  // join_admin lives on the /notifications namespace, not the default one.
  // Connecting to the default namespace here tests nothing.
  const asEmployee = await tryConnect(API_URL, { token: otherToken }, { namespace: "/notifications" });
  if (asEmployee.connected) {
    const adminJoin = await emitAndWait(asEmployee.socket, "join_admin");
    if (adminJoin === "denied") {
      ok("5. join_admin is refused for a non-admin token");
    } else {
      bad("5. An employee token was able to join admin_notifications");
      note("Admin-wide notifications (revenue, missed reminders, targets) would leak.");
    }
    asEmployee.socket.close();
  } else {
    bad(`5. Could not connect as employee for the privilege test: ${asEmployee.error?.message}`);
  }

  // ── 6. An admin token MUST still reach the admin room ──────────────────────
  // A guard that rejects everyone is not a fix, it is an outage. Prove the
  // admin path still works.
  const adminToken = mint(Number(process.env.CHECK_ADMIN_USER_ID || SELF_ID), "admin");
  const asAdmin = await tryConnect(API_URL, { token: adminToken }, { namespace: "/notifications" });
  if (asAdmin.connected) {
    const adminJoin = await emitAndWait(asAdmin.socket, "join_admin");
    if (adminJoin === "allowed") ok("6. An admin token CAN join admin_notifications");
    else bad("6. An admin token was refused from admin_notifications");
    asAdmin.socket.close();
  } else {
    bad(`6. Admin could not connect: ${asAdmin.error?.message}`);
  }

  console.log("");
  console.log("  " + "-".repeat(52));
  if (failures === 0) {
    console.log("  \u001b[32mSocket path is authenticated and authorised.\u001b[0m");
    console.log("");
    process.exit(0);
  }
  console.log(`  \u001b[31m${failures} check(s) failed.\u001b[0m`);
  console.log("  Do NOT put this backend on a public hostname until they pass.");
  console.log("");
  process.exit(1);
})().catch((err) => {
  console.error("\nUnexpected error:", err);
  process.exit(1);
});
