const { Server } = require("socket.io");
const db = require("../config/database");

const onlineUsers = new Map();

let globalIO = null;

function initSocket(server, corsOrigin = "*") {
  const io = new Server(server, {
    cors: {
      origin: corsOrigin,
      methods: ["GET", "POST", "PUT", "DELETE"]
    }
  });
  globalIO = io;

  io.on("connection", (socket) => {
    socket.on("join", (userId) => {
      if (!userId) return;
      onlineUsers.set(String(userId), socket.id);
      socket.join(`user:${userId}`);
      io.emit("online_users", Array.from(onlineUsers.keys()));
    });

    socket.on("join_room", (room) => {
      if (room) socket.join(room);
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
