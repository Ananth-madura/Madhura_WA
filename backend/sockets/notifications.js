const { Server } = require("socket.io");
const db = require("../config/database");
const { sendPushToUser, sendPushToAdmins } = require("../backendutil/pushSender");
const { authenticateSocket, socketIsAdmin, canJoinUserRoom } = require("./socketAuth");

let notificationIO = null;
let notificationHelpers = null;

function getNotificationIO() {
  return notificationHelpers;
}

function initNotificationsSocket(io, corsOrigin = "*") {
  notificationIO = io.of("/notifications");

  // Same JWT requirement as the main namespace — these rooms carry admin-wide
  // and per-user notifications.
  notificationIO.use(authenticateSocket);

  notificationIO.on("connection", (socket) => {
    const me = socket.data.user;
    console.log(`[Notify] connected user=${me.id} role=${me.role}`);

    socket.on("join", ({ userId, role } = {}) => {
      // `role` from the client is ignored. Authority comes from the verified
      // token, so a caller cannot grant themselves admin by passing
      // { role: "admin" } here.
      if (canJoinUserRoom(socket, userId)) {
        socket.join(`notifications:${userId}`);
      } else {
        console.warn(`[Notify] user=${me.id} rejected notifications:${userId}`);
      }
      if (socketIsAdmin(socket)) socket.join("admin_notifications");
    });

    socket.on("join_notifications", (userId) => {
      if (!canJoinUserRoom(socket, userId)) {
        console.warn(`[Notify] user=${me.id} rejected join_notifications:${userId}`);
        return;
      }
      socket.join(`notifications:${userId}`);
      console.log(`User ${me.id} joined notifications channel`);
    });

    socket.on("join_admin", () => {
      if (!socketIsAdmin(socket)) {
        console.warn(`[Notify] user=${me.id} (role=${me.role}) rejected join_admin`);
        socket.emit("join_denied", { reason: "admin_only" });
        return;
      }
      socket.join("admin_notifications");
      console.log(`Admin ${me.id} joined notifications channel`);
    });

    socket.on("mark_read", (notificationId) => {
      if (!notificationId) return;
      // Two different tables, two different rules:
      //   admin_notifications -> admin-wide, so only an admin may touch it
      //   notifications        -> per-user, so scope the UPDATE by user_id
      // Scoping the UPDATE (rather than trusting the client) is what stops one
      // user marking another's notification read.
      if (socketIsAdmin(socket)) {
        db.query("UPDATE admin_notifications SET is_read = 1 WHERE id = ?", [notificationId], () => {
          notificationIO.emit("notification_read", { notificationId });
        });
        return;
      }
      db.query(
        "UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?",
        [notificationId, me.id],
        (err) => {
          if (!err) notificationIO.emit("notification_read", { notificationId, userId: me.id });
        }
      );
    });

    socket.on("disconnect", () => {
      console.log(`[Notify] user=${me.id} disconnected`);
    });
  });

  const VISIBLE_TYPES = ["missed_reminder_alert", "target_completed"];

  const emitNotification = (type, data, targetUserId = null, isAdmin = true) => {
    const notification = {
      id: Date.now(),
      type,
      data,
      timestamp: new Date().toISOString(),
      is_read: 0
    };

    const message = data.message || getNotificationMessage(type, data);
    const priority = data.priority || "normal";

    const shouldEmit = true; // Emit all notifications to enable full notifications functionality

    const emitToEmployee = () => {
      if (!targetUserId) return;

      const relatedId = data.taskId || data.leadId || data.targetId || data.id || 0; // Use 0 instead of null since task_id is NOT NULL

      db.query(
        "INSERT INTO notifications (task_id, user_id, type, title, description) VALUES (?, ?, ?, ?, ?)",
        [relatedId, targetUserId, type, data.title || "CRM Alert", message],
        (err, result) => {
          if (err) {
            console.error("[Notification Sockets] DB insert error:", err.message);
            if (shouldEmit) notificationIO.to(`notifications:${targetUserId}`).emit("new_notification", notification);
            return;
          }

          // Trigger Desktop Web Push
          sendPushToUser(targetUserId, data.title || "CRM Alert", message, "/dashboard/notifications");

          if (shouldEmit) {
            notificationIO.to(`notifications:${targetUserId}`).emit("new_notification", {
              ...notification,
              dbId: result.insertId
            });
          }
        }
      );
    };

    if (!isAdmin) {
      emitToEmployee();
      return;
    }

    const relatedId = data.taskId || data.leadId || data.targetId || data.id || 0;

    db.query(
      "INSERT INTO admin_notifications (type, message, user_id, related_id, related_type, created_by, priority) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [type, message, data.userId || null, relatedId, data.type || null, data.userId || null, priority],
      (err, result) => {
        if (err) {
          console.error("[Notification Sockets] Admin DB insert error:", err.message);
          return emitToEmployee();
        }

        // Trigger Admin Desktop Web Push
        sendPushToAdmins(data.title || "Admin CRM Alert", message, "/dashboard/notifications");

        notification.dbId = result.insertId;
        if (shouldEmit) {
          notificationIO.to("admin_notifications").emit("new_notification", notification);
        }
        emitToEmployee();
      }
    );
  };

  const getNotificationMessage = (type, data) => {
    switch (type) {
      case "missed_reminder_alert":
        return `⚠️ ${data.userName || "Employee"} missed ${data.count || 3} reminders for client "${data.customerName || "Unknown"}"`;
      case "target_completed":
        return `🎉 ${data.userName || "Employee"} completed their monthly target (${data.percentage || 100}%) - Rs.${Number(data.achievedAmount || 0).toLocaleString()} achieved`;
      case "new_target":
        return `New target assigned: ₹${data.targetAmount || 0} for ${data.userName || "employee"}`;
      case "target_updated":
        return `${data.userName || "Employee"} updated target - Now: ₹${data.newAmount || 0}`;
      case "target_achieved":
        return `${data.userName || "Employee"} achieved ${data.percentage || 0}% of target`;
      case "task_assigned":
        return `New task assigned to ${data.userName || "employee"}: ${data.taskName || "Task"}`;
      case "task_completed":
        return `${data.userName || "Employee"} completed task: ${data.taskName || "Task"}`;
      case "profile_change_requested":
        return `${data.userName || "Employee"} requested profile change: ${data.fieldLabel || data.field || "Profile"}`;
      case "profile_change_approved":
        return `Your profile change was approved: ${data.fieldLabel || data.field || "Profile"}`;
      case "profile_change_declined":
        return `Your profile change was declined: ${data.fieldLabel || data.field || "Profile"}`;
      case "registration_approved":
        return `Your account has been approved. You can now log in.`;
      case "registration_declined":
        return `Your account request was declined. Please contact admin.`;
      case "task_updated":
        return `${data.userName || "Employee"} updated task status to: ${data.status || "Updated"}`;
      case "new_lead":
        return `New lead added: ${data.customerName || "Unknown"} - ${data.leadType || "Telecalling"}`;
      case "lead_converted":
        return `🎉 ${data.staffName || "Employee"} converted lead: ${data.customerName || "Unknown"} at ${data.convertedAt || ""}`;
      case "lead_updated":
        return `Lead status updated: ${data.customerName || "Unknown"} → ${data.status || "Updated"}`;
      case "missed_calls":
        return `⚠️ ${data.userName || "Employee"} missed ${data.count || 3} calls for ${data.customerName || "Unknown"} at ${data.missedAt || ""}`;
      case "contract_created":
        return `📝 New contract: ${data.contractTitle || "Contract"} for ${data.clientName || "Client"} - ₹${data.amountValue || 0}`;
      case "proposal_created":
        return `📄 New proposal: ${data.referenceNo || "QT"} for ${data.clientCompany || data.customerName || "Client"} - ₹${data.grandTotal || 0} by ${data.createdBy || "Employee"}`;
      case "service_created":
        return `New service added: ${data.serviceType || "Service"} for ${data.clientName || "Client"}`;
      case "task_not_completed":
        return `⚠️ ${data.employeeName || "Employee"} has not completed their task: "${data.taskName || "Task"}" (Due: ${data.dueDate || "N/A"})`;
      case "daily_task_summary":
        return `📋 End of day summary: ${data.incompleteCount || 0} task(s) not completed by employees`;
      case "lead_missed_reminder":
        return `⚠️ Lead "${data.customerName || "Unknown"}" has ${data.missedCount || 3}+ missed reminders`;
      case "reminder_due":
        return `⏰ Reminder: Follow up with ${data.customerName || "customer"} - ${data.mobileNumber || ""}`;
      default:
        return `Notification: ${type}`;
    }
  };

  notificationHelpers = {
    namespace: notificationIO,
    emitNotification,
    emit: (event, data) => {
      notificationIO.emit(event, data);
    },
    sendToUser: (userId, event, data) => {
      notificationIO.to(`notifications:${userId}`).emit(event, data);
    },
    sendToAdmin: (event, data) => {
      notificationIO.to("admin_notifications").emit(event, data);
    },
    emitToEmployee: (userId, event, data) => {
      notificationIO.to(`notifications:${userId}`).emit(event, data);
    },
    emitToAdmins: (event, data) => {
      notificationIO.to("admin_notifications").emit(event, data);
    }
  };

  return notificationIO;
}

module.exports = { initNotificationsSocket, getNotificationIO };
