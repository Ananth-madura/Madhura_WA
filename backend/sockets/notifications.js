const { Server } = require("socket.io");
const db = require("../config/database");
const { sendPushToUser, sendPushToAdmins } = require("../backendutil/pushSender");

let notificationIO = null;
let notificationHelpers = null;

function getNotificationIO() {
  return notificationHelpers;
}

function initNotificationsSocket(io, corsOrigin = "*") {
  notificationIO = io.of("/notifications");

  notificationIO.on("connection", (socket) => {
    socket.on("join", ({ userId, role } = {}) => {
      if (userId) socket.join(`notifications:${userId}`);
      if (role === "admin") socket.join("admin_notifications");
    });

    socket.on("join_notifications", (userId) => {
      if (!userId) return;
      socket.join(`notifications:${userId}`);
      console.log(`User ${userId} joined notifications channel`);
    });

    socket.on("join_admin", () => {
      socket.join("admin_notifications");
      console.log("Admin joined notifications channel");
    });

    socket.on("mark_read", (notificationId) => {
      if (!notificationId) return;
      db.query("UPDATE admin_notifications SET is_read = 1 WHERE id = ?", [notificationId], (err) => {
        db.query("UPDATE notifications SET is_read = 1 WHERE id = ?", [notificationId], () => {
          notificationIO.emit("notification_read", { notificationId });
        });
      });
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected from notifications");
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
