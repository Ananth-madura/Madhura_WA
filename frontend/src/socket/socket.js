import { io } from "socket.io-client";
import { SOCKET } from "../config/api";

// SOCKET is REACT_APP_SOCKET_URL when set (direct to the VPS backend), otherwise
// it falls back to the API origin, i.e. same-origin through the Vercel rewrite.
const socketUrl = SOCKET || window.location.origin;

// Read the JWT lazily on every (re)connect rather than once at module load.
// Reading it at import time captures whatever was in localStorage when this
// module was first evaluated, which is `null` for a user who is still on the
// login page — the socket then reconnects forever without a token.
const readToken = () => {
  try {
    return localStorage.getItem("token") || null;
  } catch (_) {
    return null;
  }
};

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch (_) {
    return {};
  }
};

/*
 * An offline demo session has no token, so the server would reject every
 * handshake with "unauthorized: no token". Combined with
 * reconnectionAttempts: Infinity that is an endless retry loop against a backend
 * that will never accept it — battery drain and log noise for nothing.
 *
 * So in demo mode the sockets are never opened at all. The UI is static but
 * honest; there is no phantom "connecting" state to debug later.
 */
const hasToken = Boolean(localStorage.getItem("token"));

const socketOptions = {
  path: "/socket.io",
  transports: ["websocket", "polling"],
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  autoConnect: hasToken,
};

// Socket.IO evaluates this on EVERY handshake and expects the CALLBACK form:
//
//   socket.io-client/src/socket.js -> onopen():
//     if (typeof this.auth == "function") this.auth((data) => this._sendConnectPacket(data));
//
// Returning an object from this function would be silently ignored and the
// server would reject the socket with "unauthorized: no token". The callback
// shape is load-bearing, not stylistic.
const auth = (cb) => {
  const token = readToken();
  cb(token ? { token } : {});
};

const socket = io(socketUrl, { ...socketOptions, auth });

// Connect to notifications namespace
const notificationSocket = io(`${socketUrl}/notifications`, { ...socketOptions, auth });

const joinMainRooms = () => {
  const user = readUser();
  const userId = user.id || user._id || localStorage.getItem("userId") || "1";

  socket.emit("join_room", "whatsapp");
  if (userId) {
    socket.emit("join", userId);
    socket.emit("join_room", `user:${userId}`);
  }
};

socket.on("connect", () => {
  joinMainRooms();
});

socket.on("reconnect", () => {
  joinMainRooms();
});

const joinNotificationRooms = () => {
  const token = readToken();
  const user = readUser();

  if (token && user.id) {
    notificationSocket.emit("join", { userId: user.id, role: user.role });
    notificationSocket.emit("join_notifications", user.id);

    if (user.role === "admin" || user.role === "subadmin") {
      notificationSocket.emit("join_admin");
    }
  }
};

// On connection, join appropriate rooms based on user role
notificationSocket.on("connect", () => {
  joinNotificationRooms();
});

// Listen for reconnection
notificationSocket.on("reconnect", () => {
  joinNotificationRooms();
});

// Connect helper when logging in
export const connectSocket = () => {
  const token = readToken();
  if (token) {
    try {
      if (!socket.connected) socket.connect();
      if (!notificationSocket.connected) notificationSocket.connect();
    } catch (_) {}
  }
};

export const disconnectSocket = () => {
  try {
    if (socket.connected) socket.disconnect();
    if (!notificationSocket.connected) notificationSocket.disconnect();
  } catch (_) {}
};

export { socket, notificationSocket };
export default socket;
