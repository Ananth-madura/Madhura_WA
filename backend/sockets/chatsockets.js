const { Server } = require("socket.io");
const { authenticateSocket, canJoinUserRoom, canJoinNamedRoom } = require("./socketAuth");

const onlineUsers = new Map();

let globalIO = null;

function initSocket(server, corsOrigin = "*") {
  const io = new Server(server, {
    cors: {
      origin: corsOrigin,
      methods: ["GET", "POST", "PUT", "DELETE"],
      credentials: true,
    },
    maxHttpBufferSize: 65536,
    perMessageDeflate: false,
    allowRequest: (req,callback)=>callback(null,io.engine.clientsCount<require("../config/capacity").integer(process.env.SOCKET_MAX_CONNECTIONS,1000,10,50000)),
  });
  globalIO = io;

  // Every connection must present a valid JWT before any handler runs. Without
  // this, `join` was an open impersonation primitive: any client could name any
  // userId and receive that user's live WhatsApp messages.
  io.use(authenticateSocket);

  io.on("connection", (socket) => {
    const me = socket.data.user;
    console.log(`[Socket] connected user=${me.id} role=${me.role} sid=${socket.id}`);

    socket.on("join", (userId) => {
      if (!canJoinUserRoom(socket, userId)) {
        // Deliberately terse: do not confirm whether the target id exists.
        console.warn(`[Socket] user=${me.id} rejected join to room user:${userId}`);
        socket.emit("join_denied", { reason: "not_permitted" });
        return;
      }
      onlineUsers.set(String(userId), socket.id);
      socket.join(`user:${userId}`);
      socket.emit("online_users", [me.id]);
    });

    socket.on("join_room", (room) => {
      if (!canJoinNamedRoom(socket, room)) {
        console.warn(`[Socket] user=${me.id} rejected join_room "${room}"`);
        socket.emit("join_denied", { reason: "not_permitted" });
        return;
      }
      socket.join(room);
    });

    let lastTeamTypingAt = 0;
    socket.on("team_chat_typing", async (data) => {
      try {
        if (Date.now() - lastTeamTypingAt < 500) return;
        lastTeamTypingAt = Date.now();
        const teamChat = require("../services/teamChat");
        const tenantId = Number(data?.tenantId);
        const channelId = Number(data?.channelId);
        if (!channelId) return;
        const channel = await teamChat.findChannel(tenantId, channelId);
        if (!channel) return;
        const canAccess = await teamChat.canAccessChannel({ tenantId, user: socket.data.user, userRole: socket.data.user.role }, channel);
        if (!canAccess) return;
        const recipients = await teamChat.recipientsFor(channel);
        const meId = Number(socket.data.user.id);
        for (const rId of recipients) {
          if (rId !== meId) {
            io.to(`user:${rId}`).emit("team_chat_typing", {
              tenantId,
              channelId,
              userId: meId,
              userName: socket.data.user.name || `User ${meId}`,
              isTyping: Boolean(data?.isTyping),
            });
          }
        }
      } catch (_) {}
    });

    for (const event of ["task_updated", "new_task", "target_updated", "new_target", "send_message"]) {
      socket.on(event, () => socket.emit("socket_error", { code: "REST_REQUIRED", message: "Use the authorized workspace API for changes." }));
    }

    socket.on("disconnect", () => {
      for (const [userId, socketId] of onlineUsers.entries()) {
        if (socketId === socket.id) onlineUsers.delete(userId);
      }
    });
  });

  return io;
}

module.exports = { initSocket, getIO: () => globalIO };
