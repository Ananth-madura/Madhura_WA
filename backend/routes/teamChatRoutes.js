"use strict";

/**
 * Internal Team Chat API Routes.
 *
 * Mounted under `/api/v2/team-chat`.
 * Secured by JWT authentication and tenant verification middleware.
 */

const router = require("express").Router();
const crypto = require("node:crypto");
const path = require("node:path");
const multer = require("multer");
const { verifyToken } = require("../middleware/authMiddleware");
const { requireTenantContext } = require("../middleware/tenantMiddleware");
const { privateChatDir } = require("../config/runtimePaths");
const teamChat = require("../services/teamChat");

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      require("node:fs").mkdirSync(privateChatDir, { recursive: true, mode: 0o750 });
      cb(null, privateChatDir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const safe = `tc_${Date.now()}_${crypto.randomUUID().slice(0, 8)}${ext}`;
      cb(null, safe);
    },
  }),
  limits: { fileSize: 35 * 1024 * 1024 },
});

const handle = (work) => async (req, res, next) => {
  try {
    await work(req, res, next);
  } catch (error) {
    if (res.headersSent) return next(error);
    res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : "Team chat is unavailable right now",
      code: error.code,
    });
  }
};

router.use(verifyToken, requireTenantContext);
router.use((req, res, next) => { res.setHeader("Cache-Control", "no-store"); res.setHeader("X-Content-Type-Options", "nosniff"); next(); });

/* ── Bootstrap & Channels ─────────────────────────────────────────────────── */

router.get("/bootstrap", handle(async (req, res) => {
  const data = await teamChat.bootstrap(req);
  res.json({ success: true, ...data });
}));

router.get("/retention", handle(async (req, res) => {
  if (!teamChat.isAdmin(req)) return res.status(403).json({ success: false, message: "Organization administrator required" });
  const state = teamChat.retentionState();
  res.json({ success: true, retentionDays: state.retentionDays, lastSweepAt: state.lastSweepAt, sweeping: state.sweeping, healthy: !state.lastSweepError });
}));

router.get("/channels", handle(async (req, res) => {
  const [channels, settings] = await Promise.all([
    teamChat.channelsFor(req),
    teamChat.settings(req.tenantId),
  ]);
  res.json({ success: true, channels, settings, retentionDays: teamChat.RETENTION_DAYS });
}));

router.patch("/channels/:id/preferences", handle(async (req, res) => {
  const preferences = await teamChat.updatePreferences(req, req.params.id, req.body || {});
  res.json({ success: true, preferences });
}));

router.post("/direct", handle(async (req, res) => {
  const channel = await teamChat.openDirect(req, req.body?.userId);
  const data = await teamChat.bootstrap(req);
  res.json({
    success: true,
    channel: data.channels.find((item) => Number(item.id) === Number(channel.id)) || channel,
  });
}));

/* ── Custom Groups ────────────────────────────────────────────────────────── */

router.post("/channels/group", handle(async (req, res) => {
  const channel = await teamChat.createGroup(req, req.body || {});
  const data = await teamChat.bootstrap(req);
  const fullChannel = data.channels.find((c) => Number(c.id) === Number(channel.id)) || channel;
  res.status(201).json({ success: true, channel: fullChannel });
  teamChat.emitChannelCreated(req.app.get("io"), {
    tenantId: Number(req.tenantId),
    recipients: await teamChat.recipientsFor(channel),
    channel: fullChannel,
  });
}));

router.patch("/channels/:id", handle(async (req, res) => {
  const channel = await teamChat.updateGroup(req, req.params.id, req.body || {});
  res.json({ success: true, channel });
  teamChat.emitChannelUpdated(req.app.get("io"), {
    tenantId: Number(req.tenantId),
    recipients: await teamChat.recipientsFor(channel),
    channel,
  });
}));

router.get("/channels/:id/members", handle(async (req, res) => {
  const members = await teamChat.groupMembers(req, req.params.id);
  res.json({ success: true, members });
}));

router.post("/channels/:id/avatar", handle(async (req, res, next) => { await teamChat.assertChannel(req, req.params.id); next(); }), upload.single("avatar"), handle(async (req, res) => {
  let saved = false;
  try {
    const { channel, oldStorageKey } = await teamChat.saveGroupAvatar(req, req.params.id, req.file);
    saved = true;
    if (oldStorageKey && path.basename(oldStorageKey) === oldStorageKey) await require("node:fs").promises.unlink(path.join(privateChatDir, oldStorageKey)).catch((error) => { if (error.code !== "ENOENT") console.warn("[team-chat] replaced avatar cleanup failed"); });
    const recipients = await teamChat.recipientsFor(channel);
    res.json({ success: true });
    teamChat.emitChannelUpdated(req.app.get("io"), { tenantId: Number(req.tenantId), recipients, channel });
  } catch (error) { if (!saved && req.file?.path) await require("node:fs").promises.unlink(req.file.path).catch(() => {}); throw error; }
}));

router.get("/channels/:id/avatar", handle(async (req, res) => {
  const avatar = await teamChat.getGroupAvatar(req, req.params.id);
  res.type(avatar.mimeType).sendFile(avatar.filePath);
}));

router.delete("/channels/:id/avatar", handle(async (req, res) => {
  const { oldStorageKey, channel } = await teamChat.removeGroupAvatar(req, req.params.id);
  if (oldStorageKey && path.basename(oldStorageKey) === oldStorageKey) await require("node:fs").promises.unlink(path.join(privateChatDir, oldStorageKey)).catch((error) => { if (error.code !== "ENOENT") console.warn("[team-chat] removed avatar cleanup failed"); });
  const recipients = await teamChat.recipientsFor(channel);
  res.json({ success: true });
  teamChat.emitChannelUpdated(req.app.get("io"), { tenantId: Number(req.tenantId), recipients, channel });
}));

router.post("/channels/:id/members", handle(async (req, res) => {
  const result = await teamChat.addGroupMembers(req, req.params.id, req.body || {});
  const channel = await teamChat.findChannel(req.tenantId, req.params.id);
  const members = await teamChat.groupMembers(req, req.params.id);
  res.json({ success: true, ...result, members });
  if (channel) {
    teamChat.emitChannelUpdated(req.app.get("io"), {
      tenantId: Number(req.tenantId),
      recipients: await teamChat.recipientsFor(channel),
      channel: { ...channel, memberCount: members.length },
    });
  }
}));

router.delete("/channels/:id/members/:userId", handle(async (req, res) => {
  const result = await teamChat.removeGroupMember(req, req.params.id, req.params.userId);
  const channel = await teamChat.findChannel(req.tenantId, req.params.id);
  const members = Number(req.params.userId) === Number(req.user.id) ? [] : await teamChat.groupMembers(req, req.params.id);
  await teamChat.emitPolicyUpdated(req.app.get("io"), Number(req.tenantId));
  res.json({ success: true, ...result, members });
  if (channel) {
    teamChat.emitChannelUpdated(req.app.get("io"), {
      tenantId: Number(req.tenantId),
      recipients: await teamChat.recipientsFor(channel),
      channel: { ...channel, memberCount: members.length },
    });
  }
}));

router.post("/channels/:id/leave", handle(async (req, res) => {
  const result = await teamChat.removeGroupMember(req, req.params.id, req.user.id);
  const channel = await teamChat.findChannel(req.tenantId, req.params.id);
  const members = [];
  await teamChat.emitPolicyUpdated(req.app.get("io"), Number(req.tenantId));
  res.json({ success: true, ...result, members });
  if (channel) {
    teamChat.emitChannelUpdated(req.app.get("io"), {
      tenantId: Number(req.tenantId),
      recipients: await teamChat.recipientsFor(channel),
      channel: { ...channel, memberCount: members.length },
    });
  }
}));

router.patch("/channels/:id/members/:userId", handle(async (req, res) => {
  const members = await teamChat.setGroupRole(req, req.params.id, req.params.userId, req.body?.role);
  res.json({ success: true, members });
  const channel = await teamChat.findChannel(req.tenantId, req.params.id);
  teamChat.emitChannelUpdated(req.app.get("io"), { tenantId: Number(req.tenantId), recipients: await teamChat.recipientsFor(channel), channel });
}));

/* ── Messages & Interactions ──────────────────────────────────────────────── */

router.get("/channels/:id/messages", handle(async (req, res) => {
  const payload = await teamChat.listMessages(req, req.params.id, {
    after: req.query.after,
    before: req.query.before,
    limit: req.query.limit,
  });
  res.json({ success: true, ...payload });
}));

router.post("/channels/:id/messages", handle(async (req, res) => {
  const { channel, message, recipients, replayed } = await teamChat.sendMessage(req, req.params.id, req.body || {});
  res.status(201).json({ success: true, message });
  if (!replayed) teamChat.emitMessage(req.app.get("io"), {
    tenantId: Number(req.tenantId),
    channelId: Number(channel.id),
    channelKind: channel.kind,
    message,
    recipients,
  });
}));

router.patch("/channels/:id/messages/:messageId", handle(async (req, res) => {
  const { channel, message, recipients } = await teamChat.editMessage(
    req,
    req.params.id,
    req.params.messageId,
    req.body || {}
  );
  res.json({ success: true, message });
  teamChat.emitMessageEdited(req.app.get("io"), {
    tenantId: Number(req.tenantId),
    channelId: Number(channel.id),
    message,
    recipients,
  });
}));

router.delete("/channels/:id/messages/:messageId", handle(async (req, res) => {
  const { channel, messageId, recipients, stateVersion } = await teamChat.deleteMessage(
    req,
    req.params.id,
    req.params.messageId
  );
  res.json({ success: true, messageId, stateVersion });
  teamChat.emitMessageDeleted(req.app.get("io"), {
    stateVersion,
    tenantId: Number(req.tenantId),
    channelId: Number(channel.id),
    messageId,
    recipients,
  });
}));

router.post("/channels/:id/messages/:messageId/reactions", handle(async (req, res) => {
  const { channel, messageId, reactions, recipients, stateVersion } = await teamChat.toggleReaction(
    req,
    req.params.id,
    req.params.messageId,
    req.body?.emoji
  );
  res.json({ success: true, messageId, reactions, stateVersion });
  teamChat.emitReaction(req.app.get("io"), {
    stateVersion,
    tenantId: Number(req.tenantId),
    channelId: Number(channel.id),
    messageId,
    reactions,
    recipients,
  });
}));

router.post("/channels/:id/messages/:messageId/pin", handle(async (req, res) => {
  const { channel, messageId, isPinned, recipients, stateVersion } = await teamChat.togglePin(
    req,
    req.params.id,
    req.params.messageId
  );
  res.json({ success: true, messageId, isPinned, stateVersion });
  teamChat.emitPin(req.app.get("io"), {
    stateVersion,
    tenantId: Number(req.tenantId),
    channelId: Number(channel.id),
    messageId,
    isPinned,
    recipients,
  });
}));

router.get("/channels/:id/pins", handle(async (req, res) => {
  const pins = await teamChat.listPins(req, req.params.id);
  res.json({ success: true, pins });
}));

router.get("/channels/:id/sync", handle(async (req, res) => {
  res.json({ success: true, ...(await teamChat.syncMessages(req, req.params.id, { after: req.query.after })) });
}));

router.post("/channels/:id/read", handle(async (req, res) => {
  const result = await teamChat.markRead(req, req.params.id);
  res.json({ success: true, ...result });
  const channel = await teamChat.assertChannel(req, req.params.id);
  const recipients = await teamChat.recipientsFor(channel);
  for (const id of recipients) req.app.get("io")?.to(`user:${id}`).emit("team_chat_read", { tenantId: Number(req.tenantId), userId: Number(req.user.id), ...result });
}));

router.post("/channels/:id/unread", handle(async (req, res) => {
  const result = await teamChat.markUnread(req, req.params.id);
  res.json({ success: true, ...result });
  req.app.get("io")?.to(`user:${req.user.id}`).emit("team_chat_unread", { tenantId: Number(req.tenantId), ...result });
}));

router.get("/presence", handle(async (req, res) => {
  const members = await teamChat.membersFor(req);
  const permitted = new Set(members.map((member) => Number(member.id)));
  const sockets = await req.app.get("io")?.fetchSockets() || [];
  const onlineUserIds = [...new Set(sockets.map((socket) => Number(socket.data?.user?.id)).filter((id) => permitted.has(id)))];
  res.json({ success: true, onlineUserIds });
}));

/* ── Attachments ──────────────────────────────────────────────────────────── */

router.post("/channels/:id/attachments", handle(async (req, res, next) => {
  await teamChat.assertChannel(req, req.params.id);
  next();
}), upload.single("file"), handle(async (req, res) => {
  try {
    const attachment = await teamChat.saveAttachment(req, req.params.id, req.file);
    res.status(201).json({ success: true, attachment });
  } catch (error) {
    if (req.file?.path) await require("node:fs").promises.unlink(req.file.path).catch(() => {});
    throw error;
  }
}));

router.get("/attachments/stream/:storageKey", handle(async (req, res) => {
  const { row, filePath } = await teamChat.getAttachmentFile(req, req.params.storageKey);
  res.setHeader("Content-Type", row.mime_type || "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(row.file_name)}"`);
  res.sendFile(filePath);
}));

/* ── Search & Members ─────────────────────────────────────────────────────── */

router.get("/members", handle(async (req, res) => {
  res.json({ success: true, members: await teamChat.membersFor(req, req.query.q) });
}));

router.get("/search", handle(async (req, res) => {
  const results = await teamChat.search(req, {
    query: req.query.q,
    channelId: req.query.channelId,
  });
  res.json({ success: true, ...results });
}));

/* ── Branch Communication Policies & Settings ────────────────────────────── */

router.get("/branch-policies", handle(async (req, res) => {
  const data = await teamChat.listBranchPolicies(req);
  res.json({ success: true, ...data });
}));

router.get("/orphaned-groups", handle(async (req, res) => {
  res.json({ success: true, groups: await teamChat.orphanedGroups(req) });
}));

router.post("/channels/:id/recover-admin", handle(async (req, res) => {
  const result = await teamChat.recoverGroupAdmin(req, req.params.id, req.body?.userId);
  res.json({ success: true, ...result });
  await teamChat.emitPolicyUpdated(req.app.get("io"), Number(req.tenantId));
}));

router.put("/branch-policies", handle(async (req, res) => {
  if (!Number.isInteger(req.body?.version) || req.body.version < 0) return res.status(400).json({ success: false, message: "Reload branch settings before saving", code: "POLICY_VERSION_REQUIRED" });
  const policy = await teamChat.updateBranchPolicy(req, req.body || {});
  res.json({ success: true, policy });
  await teamChat.emitPolicyUpdated(req.app.get("io"), Number(req.tenantId), policy);
}));

router.patch("/settings", handle(async (req, res) => {
  const settings = await teamChat.updateSettings(req, req.body || {});
  res.json({ success: true, settings });
  await teamChat.emitPolicyUpdated(req.app.get("io"), Number(req.tenantId));
}));

router.patch("/notification-preferences", handle(async (req, res) => {
  res.json({ success: true, preferences: await teamChat.updateNotificationPreferences(req, req.body || {}) });
}));

module.exports = router;
