/**
 * Socket.IO handshake authentication.
 *
 * ── Why this file exists ────────────────────────────────────────────────────
 * The chat sockets had NO authentication. Anyone who could open a WebSocket
 * could emit `join` with an arbitrary userId, or `join_admin`, and receive that
 * user's live WhatsApp messages and every admin notification.
 *
 * On a laptop on the LAN that was bad practice. This deployment puts the
 * backend on a public hostname behind TLS, which turns it into a live data
 * leak: rooms are just strings, and there was nothing checking who was asking
 * for them.
 *
 * So every connection is now required to present the same JWT the REST API
 * already uses, and every room join is authorised against the claims in that
 * token rather than against a userId supplied by the client.
 *
 * ── Token sources, in order ─────────────────────────────────────────────────
 *   1. socket.handshake.auth.token   (what the frontend sends)
 *   2. Authorization: Bearer header  (non-browser clients)
 *   3. ?token= query param           (last resort — lands in nginx access logs,
 *                                      so it is logged and warned about)
 *
 * The frontend uses (1). See frontend/src/socket/socket.js.
 */

const jwt = require("jsonwebtoken");

const ADMIN_ROLES = ["admin", "subadmin"];

const extractToken = (socket) => {
  const authToken = socket.handshake?.auth?.token;
  if (authToken && typeof authToken === "string") return authToken;

  const header = socket.handshake?.headers?.authorization;
  if (header && header.startsWith("Bearer ")) return header.slice(7).trim();

  const queryToken = socket.handshake?.query?.token;
  if (queryToken && typeof queryToken === "string") {
    console.warn(
      "[SocketAuth] token arrived via query string — it will be written to the nginx access log. Use handshake.auth.token."
    );
    return queryToken;
  }

  const sessions=require("../services/browserSessions");
  return sessions.cookies(socket.handshake?.headers?.cookie)[sessions.ACCESS_COOKIE] || null;
};

/**
 * Socket.IO middleware. Verifies the JWT and pins the identity to
 * socket.data.user. Once this runs, a socket can never be talked into a
 * different identity by a client-supplied id.
 */
const authenticateSocket = (socket, next) => {
  const token = extractToken(socket);

  if (!token) {
    return next(new Error("unauthorized: no token"));
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) return next(new Error("unauthorized: authentication is not configured"));

  try {
    const decoded = jwt.verify(token, jwtSecret, { algorithms: ["HS256"] });
    if (decoded.portal || decoded.role === "client" || [decoded.aud].flat().includes("client-portal")) return next(new Error("unauthorized: client portal session"));
    if (!decoded || !decoded.id) {
      return next(new Error("unauthorized: token has no subject"));
    }

    socket.data.user = {
      id: Number(decoded.id),
      role: String(decoded.role || "employee"),
      name: decoded.name || decoded.first_name || "",
    };

    const allow=()=>{
      socket.data.sessionId=decoded.sid||null;
      if(decoded.exp) {
        const timer=setTimeout(()=>{socket.emit("session_expired");socket.disconnect(true);},Math.max(1,Math.min(2147483647,decoded.exp*1000-Date.now())));
        timer.unref();socket.once("disconnect",()=>clearTimeout(timer));
      }
      next();
    };
    if(decoded.sid) {
      const sessions=require("../services/browserSessions");
      sessions.requireOrigin({headers:socket.handshake?.headers||{}});
      return sessions.active(decoded).then(allow).catch(()=>next(new Error("unauthorized: browser session revoked")));
    }
    return allow();
  } catch (err) {
    return next(new Error(`unauthorized: ${err.message}`));
  }
};

/** True when the socket's verified role is admin or sub-admin. */
const socketIsAdmin = (socket) => ADMIN_ROLES.includes(socket.data?.user?.role);

/**
 * Can this socket join a per-user room?
 *
 * A user may only join their own room. This check stops
 * `socket.emit("join", 42)` from being an impersonation.
 */
const canJoinUserRoom = (socket, targetUserId) => {
  const user = socket.data?.user;
  if (!user) return false;
  const target = Number(targetUserId);
  if (!Number.isFinite(target)) return false;
  if (user.id === target) return true;
  return false;
};

/** May this socket join an arbitrary named room (e.g. "whatsapp")? */
const canJoinNamedRoom = (socket, room) => {
  if (!socket.data?.user || !room) return false;
  // Anything user-scoped must match the authenticated identity.
  if (typeof room === "string" && room.startsWith("user:")) {
    return canJoinUserRoom(socket, room.slice(5));
  }
  // Unknown rooms are refused rather than allowed, so a future room name
  // cannot accidentally become public.
  return false;
};

module.exports = {
  authenticateSocket,
  socketIsAdmin,
  canJoinUserRoom,
  canJoinNamedRoom,
  ADMIN_ROLES,
};
