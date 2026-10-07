const { Server } = require("socket.io");
const db = require("../config/database");
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
      io.emit("online_users", Array.from(onlineUsers.keys()));
    });

    socket.on("join_room", (room) => {
      if (!canJoinNamedRoom(socket, room)) {
        console.warn(`[Socket] user=${me.id} rejected join_room "${room}"`);
        socket.emit("join_denied", { reason: "not_permitted" });
        return;
      }
      socket.join(room);
    });

    socket.on("task_updated", (data) => {
      io.emit("task_updated", data);
      io.emit("data_changed", { resource: "tasks", action: "update", ...data });
    });

    socket.on("new_task", (data) => {
      io.emit("new_task", data);
      io.emit("data_changed", { resource: "tasks", action: "create", ...data });
    });

    socket.on("target_updated", (data) => {
      io.emit("target_updated", data);
      io.emit("data_changed", { resource: "targets", action: "update", ...data });
    });

    socket.on("new_target", (data) => {
      io.emit("new_target", data);
      io.emit("data_changed", { resource: "targets", action: "create", ...data });
    });

    socket.on("send_message", (data = {}) => {
      const senderId = data.senderId || data.sender_id;
      const receiverId = data.receiverId || data.receiver_id;
      const text = data.text || data.message || "";
      const type = data.type || "text";

      if (!senderId || !receiverId || !text) return;

      db.query(
        "INSERT INTO messages (sender_id, receiver_id, message, type) VALUES (?,?,?,?)",
        [senderId, receiverId, text, type],
        (err, result) => {
          if (err) {
            socket.emit("socket_error", { message: "Message could not be saved" });
            return;
          }

          const message = {
            ...data,
            id: result.insertId,
            senderId,
            receiverId,
            text,
            message: text,
            type
          };

          io.to(`user:${senderId}`).to(`user:${receiverId}`).emit("receive_message", message);
          io.emit("data_changed", { resource: "messages", action: "create", id: result.insertId });
        }
      );
    });

    socket.on("disconnect", () => {
      for (const [userId, socketId] of onlineUsers.entries()) {
        if (socketId === socket.id) onlineUsers.delete(userId);
      }
      io.emit("online_users", Array.from(onlineUsers.keys()));
    });
  });

  return io;
}

module.exports = { initSocket, getIO: () => globalIO };
