"use strict";

const ADMIN_ROLES = new Set(["organization_owner", "organization_admin", "platform_admin"]);
const VALID_PERMISSIONS = new Set(["viewer", "responder", "collaborator", "manager"]);

const fail = (message, status = 400) => Object.assign(new Error(message), { status });

function createConversationShareService(database) {
  const query = async (sql, params = []) => (await database.promise().query(sql, params))[0];

  const transaction = async (work) => {
    if (database.isSqlite) {
      return work(query);
    }
    const connection = await new Promise((resolve, reject) =>
      database.getConnection((err, conn) => (err ? reject(err) : resolve(conn)))
    );
    const client = connection.promise();
    try {
      for (let attempt = 0; ; attempt++) {
        try {
          await client.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
          await client.beginTransaction();
          const result = await work(async (sql, values = []) => (await client.query(sql, values))[0]);
          await client.commit();
          return result;
        } catch (error) {
          await client.rollback();
          if (attempt >= 3 || !["ER_LOCK_DEADLOCK", "ER_LOCK_WAIT_TIMEOUT"].includes(error.code)) throw error;
          await new Promise(resolve => setTimeout(resolve, 20 * (attempt + 1)));
        }
      }
    } finally {
      connection.release();
    }
  };

  /**
   * Determine exact permissions of a user on a given conversation.
   */
  async function getUserAccess(tenantId, conversationId, userId, userRole, waAccessLevel) {
    if (ADMIN_ROLES.has(userRole)) {
      return {
        isOwner: true,
        isCollaborator: false,
        permissionLevel: "owner",
        canView: true,
        canReply: !["read_only", "campaign_only"].includes(waAccessLevel),
        canNote: true,
        canShare: true,
        canManageCollaborators: true,
        canTransfer: true
      };
    }

    const [conv] = await query(
      "SELECT id, tenant_id, sender_id, branch_id, owner_user_id, status FROM conversations WHERE tenant_id = ? AND id = ?",
      [tenantId, conversationId]
    );
    if (!conv) return null;

    if (userRole === "branch_manager") {
      const [mgr] = await query(
        "SELECT 1 FROM staff_branch_memberships WHERE tenant_id = ? AND user_id = ? AND branch_id = ?",
        [tenantId, userId, conv.branch_id]
      );
      if (mgr) {
        return {
          isOwner: Number(conv.owner_user_id) === Number(userId),
          isCollaborator: false,
          permissionLevel: "manager",
          canView: true,
          canReply: !["read_only", "campaign_only"].includes(waAccessLevel),
          canNote: true,
          canShare: true,
          canManageCollaborators: true,
          canTransfer: true
        };
      }
    }

    if (Number(conv.owner_user_id) === Number(userId)) {
      return {
        isOwner: true,
        isCollaborator: false,
        permissionLevel: "owner",
        canView: true,
        canReply: !["read_only", "campaign_only"].includes(waAccessLevel),
        canNote: true,
        canShare: true,
        canManageCollaborators: true,
        canTransfer: true
      };
    }

    // Check active share
    const [share] = await query(
      `SELECT id, permission_level, expires_at, status 
       FROM wa_conversation_shares 
       WHERE tenant_id = ? AND conversation_id = ? AND shared_with_user_id = ? AND status = 'active'
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
      [tenantId, conversationId, userId]
    );

    if (!share) return null;

    const plevel = share.permission_level || "viewer";
    const canReply = ["responder", "collaborator", "manager"].includes(plevel) && !["read_only", "campaign_only"].includes(waAccessLevel);
    const canNote = ["collaborator", "manager"].includes(plevel);
    const canShare = plevel === "manager";
    const canManageCollaborators = plevel === "manager";

    return {
      isOwner: false,
      isCollaborator: true,
      shareId: share.id,
      permissionLevel: plevel,
      canView: true,
      canReply,
      canNote,
      canShare,
      canManageCollaborators,
      canTransfer: false
    };
  }

  /**
   * Get active and past shares for a conversation
   */
  async function getConversationShares(tenantId, conversationId) {
    const rows = await query(
      `SELECT s.id, s.tenant_id, s.conversation_id, s.owner_user_id, s.shared_with_user_id, s.shared_by_user_id,
              s.permission_level, s.status, s.sharing_reason, s.expires_at, s.created_at, s.updated_at, s.revoked_at,
              u.first_name AS user_name, u.email AS user_email, u.role AS user_role, u.department AS user_department,
              b.first_name AS shared_by_name,
              CASE WHEN s.expires_at IS NOT NULL AND s.expires_at <= CURRENT_TIMESTAMP THEN 1 ELSE 0 END AS is_expired
       FROM wa_conversation_shares s
       JOIN users u ON u.id = s.shared_with_user_id
       LEFT JOIN users b ON b.id = s.shared_by_user_id
       WHERE s.tenant_id = ? AND s.conversation_id = ?
       ORDER BY s.status = 'active' DESC, s.id DESC`,
      [tenantId, conversationId]
    );

    return rows.map(r => ({
      ...r,
      effective_status: r.status === "active" && r.is_expired ? "expired" : r.status
    }));
  }

  /**
   * Search eligible employees to share conversation with.
   * Scoped to the same organization & authorized branch (Approved Option A).
   */
  async function getShareCandidates(tenantId, conversationId, search = "") {
    const [conv] = await query("SELECT branch_id, owner_user_id FROM conversations WHERE tenant_id = ? AND id = ?", [tenantId, conversationId]);
    if (!conv) throw fail("Conversation not found", 404);

    const term = `%${String(search || "").slice(0, 50)}%`;
    const rows = await query(
      `SELECT DISTINCT u.id, u.first_name, u.email, u.role, u.department, b.name AS branch_name,
              m.is_available,
              (SELECT s.permission_level FROM wa_conversation_shares s 
               WHERE s.tenant_id = ? AND s.conversation_id = ? AND s.shared_with_user_id = u.id AND s.status = 'active' 
               AND (s.expires_at IS NULL OR s.expires_at > CURRENT_TIMESTAMP) LIMIT 1) AS active_permission
       FROM users u
       JOIN organization_memberships om ON om.user_id = u.id AND om.tenant_id = ? AND om.membership_status = 'active'
       JOIN staff_branch_memberships m ON m.user_id = u.id AND m.tenant_id = ? AND m.branch_id = ?
       JOIN branches b ON b.id = m.branch_id AND b.tenant_id = ? AND b.status = 'active'
       WHERE u.status = 'active' AND u.id <> ?
         AND (u.first_name LIKE ? OR u.email LIKE ? OR COALESCE(u.department, '') LIKE ?)
       ORDER BY u.first_name ASC LIMIT 50`,
      [tenantId, conversationId, tenantId, tenantId, conv.branch_id, tenantId, conv.owner_user_id || 0, term, term, term]
    );

    return rows.map(r => ({
      id: r.id,
      name: r.first_name,
      email: r.email,
      role: r.role,
      department: r.department || "General",
      branchName: r.branch_name,
      isAvailable: Boolean(r.is_available),
      alreadyShared: Boolean(r.active_permission),
      currentPermission: r.active_permission || null
    }));
  }

  /**
   * Share a conversation with one or more employees.
   */
  async function shareConversation(tenantId, conversationId, actorId, { userIds = [], permissionLevel = "responder", reason = null, expiresAt = null }, io) {
    if (!Array.isArray(userIds) || !userIds.length) throw fail("Select at least one employee to share with");
    if (!VALID_PERMISSIONS.has(permissionLevel)) throw fail("Invalid permission level. Choose viewer, responder, collaborator, or manager");

    let parsedExpiry = null;
    if (expiresAt) {
      const d = new Date(expiresAt);
      if (isNaN(d.getTime()) || d.getTime() <= Date.now()) throw fail("Expiration date must be in the future");
      parsedExpiry = d;
    }

    return transaction(async (q) => {
      const [conv] = await q(
        "SELECT id, tenant_id, sender_id, branch_id, owner_user_id, status FROM conversations WHERE tenant_id = ? AND id = ? FOR UPDATE",
        [tenantId, conversationId]
      );
      if (!conv) throw fail("Conversation not found", 404);

      const [actor] = await q("SELECT first_name, email FROM users WHERE id = ?", [actorId]);
      const actorName = actor?.first_name || "Staff";

      const createdShares = [];

      for (const targetUserId of new Set(userIds.map(Number))) {
        if (!Number.isInteger(targetUserId) || targetUserId <= 0) continue;
        if (Number(conv.owner_user_id) === targetUserId) {
          throw fail("Cannot share conversation with the conversation owner");
        }

        // Validate target employee is active in organization & branch
        const [target] = await q(
          `SELECT u.id, u.first_name, u.email 
           FROM users u
           JOIN organization_memberships om ON om.user_id = u.id AND om.tenant_id = ? AND om.membership_status = 'active'
           JOIN staff_branch_memberships m ON m.user_id = u.id AND m.tenant_id = ? AND m.branch_id = ?
           WHERE u.id = ? AND u.status = 'active'`,
          [tenantId, tenantId, conv.branch_id, targetUserId]
        );
        if (!target) {
          throw fail(`Employee #${targetUserId} is not an active member of this branch and organization`);
        }

        // Insert or update share
        await q(
          `INSERT INTO wa_conversation_shares 
             (tenant_id, conversation_id, owner_user_id, shared_with_user_id, shared_by_user_id, permission_level, status, sharing_reason, expires_at, created_at, updated_at, revoked_at)
           VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL)
           ON DUPLICATE KEY UPDATE 
             permission_level = VALUES(permission_level),
             status = 'active',
             sharing_reason = VALUES(sharing_reason),
             expires_at = VALUES(expires_at),
             updated_at = CURRENT_TIMESTAMP,
             revoked_at = NULL`,
          [tenantId, conv.id, conv.owner_user_id || actorId, targetUserId, actorId, permissionLevel, reason || null, parsedExpiry]
        );

        // Record in timeline
        await q(
          `INSERT INTO wa_assignment_events 
             (tenant_id, conversation_id, actor_id, owner_user_id, branch_id, action, shared_with_user_id, details)
           VALUES (?, ?, ?, ?, ?, 'shared', ?, ?)`,
          [tenantId, conv.id, actorId, conv.owner_user_id, conv.branch_id, targetUserId, JSON.stringify({
            permissionLevel,
            reason,
            expiresAt: parsedExpiry ? parsedExpiry.toISOString() : null,
            targetUserName: target.first_name,
            sharedByName: actorName
          })]
        );

        // Record in workspace audit
        await q(
          `INSERT INTO wa_workspace_audit (tenant_id, actor_id, action, subject_user_id, details)
           VALUES (?, ?, 'conversation.shared', ?, ?)`,
          [tenantId, actorId, targetUserId, JSON.stringify({
            conversationId: conv.id,
            permissionLevel,
            reason,
            expiresAt: parsedExpiry ? parsedExpiry.toISOString() : null
          })]
        );

        createdShares.push({
          userId: targetUserId,
          name: target.first_name,
          email: target.email,
          permissionLevel,
          expiresAt: parsedExpiry
        });

        // Real-time notification to the collaborator
        if (io) {
          io.to(`user:${targetUserId}`).emit("conversation_shared", {
            tenantId,
            conversationId: conv.id,
            sharedBy: { id: actorId, name: actorName },
            permissionLevel,
            reason,
            expiresAt: parsedExpiry ? parsedExpiry.toISOString() : null
          });
          io.to(`user:${targetUserId}`).emit("inbox_access_changed", { tenantId, conversationId: conv.id });
        }
      }

      // Notify owner if shared by another manager/admin
      if (io && conv.owner_user_id && Number(conv.owner_user_id) !== Number(actorId)) {
        io.to(`user:${conv.owner_user_id}`).emit("conversation_collaborators_updated", {
          tenantId,
          conversationId: conv.id,
          shares: createdShares
        });
      }

      return { success: true, count: createdShares.length, shares: createdShares };
    });
  }

  /**
   * Update permission or expiration on an existing share.
   */
  async function updateShare(tenantId, conversationId, shareId, actorId, { permissionLevel, expiresAt }, io) {
    if (permissionLevel && !VALID_PERMISSIONS.has(permissionLevel)) {
      throw fail("Invalid permission level. Choose viewer, responder, collaborator, or manager");
    }

    let parsedExpiry = undefined;
    if (expiresAt !== undefined) {
      if (expiresAt === null) {
        parsedExpiry = null;
      } else {
        const d = new Date(expiresAt);
        if (isNaN(d.getTime()) || d.getTime() <= Date.now()) throw fail("Expiration date must be in the future");
        parsedExpiry = d;
      }
    }

    return transaction(async (q) => {
      const [share] = await q(
        "SELECT * FROM wa_conversation_shares WHERE tenant_id = ? AND conversation_id = ? AND id = ? FOR UPDATE",
        [tenantId, conversationId, shareId]
      );
      if (!share) throw fail("Share record not found", 404);

      const updates = [];
      const values = [];

      if (permissionLevel) {
        updates.push("permission_level = ?");
        values.push(permissionLevel);
      }
      if (parsedExpiry !== undefined) {
        updates.push("expires_at = ?");
        values.push(parsedExpiry);
      }
      updates.push("updated_at = CURRENT_TIMESTAMP");

      await q(`UPDATE wa_conversation_shares SET ${updates.join(", ")} WHERE id = ?`, [...values, shareId]);

      // Audit
      await q(
        `INSERT INTO wa_workspace_audit (tenant_id, actor_id, action, subject_user_id, details)
         VALUES (?, ?, 'conversation.share_updated', ?, ?)`,
        [tenantId, actorId, share.shared_with_user_id, JSON.stringify({
          conversationId,
          shareId,
          oldPermission: share.permission_level,
          newPermission: permissionLevel || share.permission_level,
          expiresAt: parsedExpiry
        })]
      );

      if (io) {
        io.to(`user:${share.shared_with_user_id}`).emit("conversation_collaborator_updated", {
          tenantId,
          conversationId,
          permissionLevel: permissionLevel || share.permission_level,
          expiresAt: parsedExpiry
        });
        io.to(`user:${share.shared_with_user_id}`).emit("inbox_access_changed", { tenantId, conversationId });
      }

      return { success: true };
    });
  }

  /**
   * Revoke share access immediately.
   */
  async function revokeShare(tenantId, conversationId, shareId, actorId, io) {
    return transaction(async (q) => {
      const [share] = await q(
        "SELECT * FROM wa_conversation_shares WHERE tenant_id = ? AND conversation_id = ? AND id = ? FOR UPDATE",
        [tenantId, conversationId, shareId]
      );
      if (!share) throw fail("Share record not found", 404);

      await q(
        "UPDATE wa_conversation_shares SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [shareId]
      );

      // Record in timeline
      await q(
        `INSERT INTO wa_assignment_events 
           (tenant_id, conversation_id, actor_id, owner_user_id, branch_id, action, shared_with_user_id, details)
         VALUES (?, ?, ?, ?, NULL, 'share_revoked', ?, ?)`,
        [tenantId, conversationId, actorId, share.owner_user_id, share.shared_with_user_id, JSON.stringify({
          shareId,
          revokedAt: new Date().toISOString()
        })]
      );

      // Record in workspace audit
      await q(
        `INSERT INTO wa_workspace_audit (tenant_id, actor_id, action, subject_user_id, details)
         VALUES (?, ?, 'conversation.share_revoked', ?, ?)`,
        [tenantId, actorId, share.shared_with_user_id, JSON.stringify({
          conversationId,
          shareId
        })]
      );

      // Realtime notification to revoked collaborator
      if (io) {
        io.to(`user:${share.shared_with_user_id}`).emit("conversation_share_revoked", {
          tenantId,
          conversationId,
          revokedBy: actorId
        });
        io.to(`user:${share.shared_with_user_id}`).emit("inbox_access_changed", { tenantId, conversationId });
      }

      return { success: true };
    });
  }

  /**
   * Get unified conversation timeline (assignments, transfers, shares, revocations)
   */
  async function getConversationTimeline(tenantId, conversationId, limit = 50) {
    const rows = await query(
      `SELECT e.id, e.conversation_id, e.actor_id, e.owner_user_id, e.branch_id, e.action, e.shared_with_user_id, e.details, e.created_at,
              u.first_name AS actor_name,
              o.first_name AS owner_name,
              s.first_name AS shared_with_name,
              b.name AS branch_name
       FROM wa_assignment_events e
       LEFT JOIN users u ON u.id = e.actor_id
       LEFT JOIN users o ON o.id = e.owner_user_id
       LEFT JOIN users s ON s.id = e.shared_with_user_id
       LEFT JOIN branches b ON b.id = e.branch_id
       WHERE e.tenant_id = ? AND e.conversation_id = ?
       ORDER BY e.id DESC LIMIT ?`,
      [tenantId, conversationId, Math.min(100, Math.max(1, limit))]
    );

    return rows.map(r => {
      let parsedDetails = null;
      try {
        parsedDetails = r.details ? JSON.parse(r.details) : null;
      } catch (_) {}
      return {
        id: r.id,
        action: r.action || "assigned",
        actor: { id: r.actor_id, name: r.actor_name || "System" },
        owner: r.owner_user_id ? { id: r.owner_user_id, name: r.owner_name } : null,
        sharedWith: r.shared_with_user_id ? { id: r.shared_with_user_id, name: r.shared_with_name } : null,
        branch: r.branch_id ? { id: r.branch_id, name: r.branch_name } : null,
        details: parsedDetails,
        createdAt: r.created_at
      };
    });
  }

  /**
   * Background sweep for expired shares (Approved Option A)
   */
  async function sweepExpiredShares(io) {
    const expired = await query(
      `SELECT id, tenant_id, conversation_id, shared_with_user_id, owner_user_id 
       FROM wa_conversation_shares 
       WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at <= CURRENT_TIMESTAMP 
       LIMIT 100`
    );

    if (!expired.length) return 0;

    for (const item of expired) {
      await query(
        "UPDATE wa_conversation_shares SET status = 'expired', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [item.id]
      );

      await query(
        `INSERT INTO wa_assignment_events 
           (tenant_id, conversation_id, actor_id, owner_user_id, action, shared_with_user_id, details)
         VALUES (?, ?, NULL, ?, 'share_expired', ?, ?)`,
        [item.tenant_id, item.conversation_id, item.owner_user_id, item.shared_with_user_id, JSON.stringify({ shareId: item.id })]
      );

      await query(
        `INSERT INTO wa_workspace_audit (tenant_id, actor_id, action, subject_user_id, details)
         VALUES (?, 0, 'conversation.share_expired', ?, ?)`,
        [item.tenant_id, item.shared_with_user_id, JSON.stringify({ conversationId: item.conversation_id, shareId: item.id })]
      );

      if (io) {
        io.to(`user:${item.shared_with_user_id}`).emit("conversation_share_revoked", {
          tenantId: item.tenant_id,
          conversationId: item.conversation_id,
          reason: "expired"
        });
        io.to(`user:${item.shared_with_user_id}`).emit("inbox_access_changed", {
          tenantId: item.tenant_id,
          conversationId: item.conversation_id
        });
      }
    }

    return expired.length;
  }

  /**
   * Multi-Number Team Assignment Overview for /accounts page
   */
  async function getNumberAssignmentsOverview(tenantId) {
    const senders = await query(
      `SELECT s.id, s.display_phone, s.verified_name, s.status, s.quality, s.messaging_tier, s.is_shared,
              GROUP_CONCAT(DISTINCT b.name ORDER BY b.name SEPARATOR ', ') AS assigned_branches,
              (SELECT COUNT(*) FROM staff_sender_assignments a WHERE a.tenant_id = s.tenant_id AND a.sender_id = s.id) AS assigned_employee_count,
              (SELECT COUNT(*) FROM conversations c WHERE c.tenant_id = s.tenant_id AND c.sender_id = s.id AND c.status <> 'closed') AS active_chat_count
       FROM wa_senders s
       LEFT JOIN sender_branch_assignments sba ON sba.tenant_id = s.tenant_id AND sba.sender_id = s.id
       LEFT JOIN branches b ON b.id = sba.branch_id AND b.tenant_id = s.tenant_id
       WHERE s.tenant_id = ?
       GROUP BY s.id ORDER BY s.id ASC`,
      [tenantId]
    );

    const [empTotals] = await query(
      `SELECT 
         COUNT(DISTINCT u.id) AS total_employees,
         COUNT(DISTINCT a.user_id) AS assigned_employees
       FROM users u
       JOIN organization_memberships om ON om.user_id = u.id AND om.tenant_id = ? AND om.membership_status = 'active'
       LEFT JOIN staff_sender_assignments a ON a.user_id = u.id AND a.tenant_id = ?
       WHERE u.status = 'active'`,
      [tenantId, tenantId]
    );

    const [settings] = await query("SELECT strategy, required_skill FROM wa_assignment_settings WHERE tenant_id = ?", [tenantId]);

    // For each sender, fetch the list of assigned employees
    const allAssignments = await query(
      `SELECT a.sender_id, a.user_id, a.role_in_sender, a.can_view, a.can_reply, a.can_send_templates, a.can_send_attachments,
              a.can_add_notes, a.can_transfer, a.can_share, a.can_manage_collaborators,
              u.first_name AS user_name, u.email AS user_email, u.role AS user_role, u.department AS user_department,
              m.is_available, m.auto_assign_enabled, m.max_open_chats
       FROM staff_sender_assignments a
       JOIN users u ON u.id = a.user_id
       LEFT JOIN staff_branch_memberships m ON m.user_id = a.user_id AND m.tenant_id = a.tenant_id
       WHERE a.tenant_id = ?
       ORDER BY a.sender_id, u.first_name ASC`,
      [tenantId]
    );

    const assignmentsBySender = new Map();
    for (const row of allAssignments) {
      if (!assignmentsBySender.has(row.sender_id)) assignmentsBySender.set(row.sender_id, []);
      assignmentsBySender.get(row.sender_id).push(row);
    }

    const numbersWithAssignments = senders.map(s => {
      const assigned = assignmentsBySender.get(s.id) || [];
      return {
        ...s,
        assignedEmployees: assigned,
        previewNames: assigned.slice(0, 5).map(e => e.user_name),
        routingStrategy: settings?.strategy || "round_robin"
      };
    });

    const totalEmps = Number(empTotals?.total_employees || 0);
    const assignedEmps = Number(empTotals?.assigned_employees || 0);

    return {
      overview: {
        totalNumbers: senders.length,
        connectedNumbers: senders.filter(s => s.status === "connected").length,
        totalEmployees: totalEmps,
        assignedEmployees: assignedEmps,
        unassignedEmployees: Math.max(0, totalEmps - assignedEmps),
        routingStrategy: settings?.strategy || "round_robin"
      },
      numbers: numbersWithAssignments
    };
  }

  /**
   * Save or update employee assignments for a specific WhatsApp number
   */
  async function updateSenderTeamAssignments(tenantId, senderId, actorId, { userIds = [], permissions = {} }) {
    if (!Array.isArray(userIds)) throw fail("userIds must be an array");

    return transaction(async (q) => {
      const [sender] = await q("SELECT id FROM wa_senders WHERE tenant_id = ? AND id = ?", [tenantId, senderId]);
      if (!sender) throw fail("WhatsApp number not found", 404);

      // Verify each user belongs to tenant & has branch linked to this sender
      for (const uid of userIds) {
        const [linked] = await q(
          `SELECT m.user_id 
           FROM staff_branch_memberships m
           JOIN sender_branch_assignments s ON s.tenant_id = m.tenant_id AND s.branch_id = m.branch_id
           WHERE m.tenant_id = ? AND m.user_id = ? AND s.sender_id = ? LIMIT 1`,
          [tenantId, uid, senderId]
        );
        if (!linked) {
          throw fail(`Employee #${uid} does not belong to any branch assigned to this WhatsApp number`);
        }
      }

      // Sync assignments
      await q("DELETE FROM staff_sender_assignments WHERE tenant_id = ? AND sender_id = ?", [tenantId, senderId]);

      const perms = {
        can_view: permissions.can_view ?? 1,
        can_reply: permissions.can_reply ?? 1,
        can_send_templates: permissions.can_send_templates ?? 1,
        can_send_attachments: permissions.can_send_attachments ?? 1,
        can_add_notes: permissions.can_add_notes ?? 1,
        can_transfer: permissions.can_transfer ?? 1,
        can_share: permissions.can_share ?? 1,
        can_manage_collaborators: permissions.can_manage_collaborators ?? 1,
        role_in_sender: permissions.role_in_sender || "member"
      };

      for (const uid of new Set(userIds)) {
        await q(
          `INSERT INTO staff_sender_assignments 
             (tenant_id, user_id, sender_id, role_in_sender, can_view, can_reply, can_send_templates, can_send_attachments, can_add_notes, can_transfer, can_share, can_manage_collaborators)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [tenantId, uid, senderId, perms.role_in_sender, perms.can_view, perms.can_reply, perms.can_send_templates, perms.can_send_attachments, perms.can_add_notes, perms.can_transfer, perms.can_share, perms.can_manage_collaborators]
        );
      }

      await q(
        `INSERT INTO wa_workspace_audit (tenant_id, actor_id, action, details)
         VALUES (?, ?, 'sender.team_assignments_updated', ?)`,
        [tenantId, actorId, JSON.stringify({ senderId, assignedUserIds: userIds, permissions: perms })]
      );

      return { success: true, assignedCount: userIds.length };
    });
  }

  /**
   * Get organization-level assignment and sharing audit logs
   */
  async function getAuditLog(tenantId, { limit = 50, offset = 0, employeeId = null, action = null }) {
    const where = ["a.tenant_id = ?"];
    const params = [tenantId];

    if (employeeId) {
      where.push("(a.actor_id = ? OR a.subject_user_id = ?)");
      params.push(Number(employeeId), Number(employeeId));
    }
    if (action) {
      where.push("a.action LIKE ?");
      params.push(`%${action}%`);
    }

    const rows = await query(
      `SELECT a.id, a.tenant_id, a.actor_id, a.action, a.subject_user_id, a.details, a.created_at,
              u.first_name AS actor_name,
              s.first_name AS subject_name
       FROM wa_workspace_audit a
       LEFT JOIN users u ON u.id = a.actor_id
       LEFT JOIN users s ON s.id = a.subject_user_id
       WHERE ${where.join(" AND ")}
       ORDER BY a.id DESC LIMIT ? OFFSET ?`,
      [...params, Math.min(100, Math.max(1, limit)), Math.max(0, offset)]
    );

    const [countRow] = await query(
      `SELECT COUNT(*) AS total FROM wa_workspace_audit a WHERE ${where.join(" AND ")}`,
      params
    );

    return {
      records: rows.map(r => {
        let details = null;
        try { details = JSON.parse(r.details); } catch (_) { details = r.details; }
        return {
          id: r.id,
          action: r.action,
          actor: { id: r.actor_id, name: r.actor_name || (r.actor_id === 0 ? "System Automation" : "Staff") },
          subject: r.subject_user_id ? { id: r.subject_user_id, name: r.subject_name } : null,
          details,
          createdAt: r.created_at
        };
      }),
      total: countRow?.total || 0
    };
  }

  return {
    query,
    transaction,
    getUserAccess,
    getConversationShares,
    getShareCandidates,
    shareConversation,
    updateShare,
    revokeShare,
    getConversationTimeline,
    sweepExpiredShares,
    getNumberAssignmentsOverview,
    updateSenderTeamAssignments,
    getAuditLog
  };
}

let sweeperTimer = null;
function startRetentionSweep(db, io) {
  if (sweeperTimer) return;
  const service = createConversationShareService(db);
  // Run once after 5s then every 1 hour
  setTimeout(() => service.sweepExpiredShares(io).catch(() => {}), 5000);
  sweeperTimer = setInterval(() => {
    service.sweepExpiredShares(io).catch(err => console.error("[ShareSweep] error:", err.message));
  }, 3600000);
  sweeperTimer.unref();
}

module.exports = { createConversationShareService, startRetentionSweep };
