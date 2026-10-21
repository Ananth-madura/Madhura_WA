/**
 * enterpriseInboxRoutes.js
 *
 * REST API v2 endpoints for Multi-Branch Shared Team Inbox, Conversations,
 * Branch Transfers, and Consent Management.
 * Reference: MADHURA_WHATSAPP_ENTERPRISE_SAAS_MASTER_BLUEPRINT.md §12 & §17
 */

const express = require("express");
const { verifyToken } = require("../middleware/authMiddleware");
const {
  requireTenantContext,
  requireBranchScope,
  requirePermission,
} = require("../middleware/tenantMiddleware");
const { cloudClientForTenantSender } = require("../services/waConfigHelper");
const db = require("../config/database");

const router = express.Router();

const q = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });

/**
 * GET /api/v2/conversations
 * Scoped by organization and branch.
 */
router.get(
  "/conversations",
  verifyToken,
  requireTenantContext,
  requireBranchScope,
  async (req, res) => {
    try {
      const { status = "open", search } = req.query;
      const tid = req.tenantId;

      let whereClauses = ["c.tenant_id = ?"];
      let params = [tid];

      if (status && status !== "all") {
        whereClauses.push("c.status = ?");
        params.push(status);
      }

      // Branch Scoping:
      if (req.branchId) {
        whereClauses.push("c.branch_id = ?");
        params.push(req.branchId);
      } else if (req.permittedBranchIds && req.permittedBranchIds.length > 0) {
        const placeholders = req.permittedBranchIds.map(() => "?").join(",");
        whereClauses.push(`(c.branch_id IN (${placeholders}) OR c.branch_id IS NULL)`);
        params.push(...req.permittedBranchIds);
      }

      if (search && search.trim()) {
        whereClauses.push("(ct.name LIKE ? OR ct.phone LIKE ?)");
        params.push(`%${search.trim()}%`, `%${search.trim()}%`);
      }

      const sql = `
        SELECT c.*,
               ct.name as contact_name, ct.phone as contact_phone, ct.tags as contact_tags,
               b.name as branch_name, b.code as branch_code,
               u.first_name as owner_first_name, u.email as owner_email,
               s.display_phone as sender_phone, s.verified_name as sender_name
        FROM conversations c
        LEFT JOIN wa_contacts ct ON c.contact_id = ct.id
        LEFT JOIN branches b ON c.branch_id = b.id
        LEFT JOIN users u ON c.owner_user_id = u.id
        LEFT JOIN wa_senders s ON c.sender_id = s.id
        WHERE ${whereClauses.join(" AND ")}
        ORDER BY c.last_message_at DESC
        LIMIT 100
      `;

      const conversations = await q(sql, params);
      res.json({
        success: true,
        tenantId: tid,
        activeBranchId: req.branchId || null,
        conversations,
      });
    } catch (err) {
      console.error("[GET /api/v2/conversations] Error:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * POST /api/v2/conversations/:id/reply
 * Reply to conversation using branch-assigned WhatsApp sender.
 */
router.post(
  "/conversations/:id/reply",
  verifyToken,
  requireTenantContext,
  requirePermission("inbox.reply"),
  async (req, res) => {
    try {
      const convId = Number(req.params.id);
      const tid = req.tenantId;
      const { text } = req.body;

      if (!text || !text.trim()) {
        return res.status(400).json({ success: false, message: "Message text is required" });
      }

      const [conv] = await q(
        `SELECT c.*, ct.phone as contact_phone 
         FROM conversations c
         JOIN wa_contacts ct ON c.contact_id = ct.id
         WHERE c.id = ? AND c.tenant_id = ? LIMIT 1`,
        [convId, tid]
      );

      if (!conv) {
        return res.status(404).json({ success: false, message: "Conversation not found" });
      }

      // Check 24-hour service window
      const now = new Date();
      if (conv.service_window_expires_at && new Date(conv.service_window_expires_at) < now) {
        return res.status(400).json({
          success: false,
          code: "SERVICE_WINDOW_EXPIRED",
          message: "The 24-hour customer service window has expired. A pre-approved template message must be used.",
        });
      }

      // Resolve Cloud API client for this tenant & branch/sender
      const client = await cloudClientForTenantSender(tid, conv.sender_id, conv.branch_id);

      let sendResult = { id: `wamid.mock_${Date.now()}` };
      if (client.isConfigured()) {
        sendResult = await client.sendTextMessage(conv.contact_phone, text.trim());
      }

      // Update conversation last message & timestamp
      await q(
        `UPDATE conversations 
         SET last_message_text = ?, last_message_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [text.trim(), convId]
      );

      // Log to wa_message_logs
      await q(
        `INSERT INTO wa_message_logs (tenant_id, branch_id, sender_phone, recipient_phone, message_text, message_type, direction, status, meta_message_id)
         VALUES (?, ?, ?, ?, ?, 'text', 'outbound', 'sent', ?)`,
        [
          tid,
          conv.branch_id || 1,
          client.phoneNumber || "System",
          conv.contact_phone,
          text.trim(),
          sendResult.id || `wamid.msg_${Date.now()}`,
        ]
      );

      res.json({
        success: true,
        message: "Message sent successfully",
        data: sendResult,
      });
    } catch (err) {
      console.error("[POST /api/v2/conversations/:id/reply] Error:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * POST /api/v2/conversations/:id/assign
 * Assign conversation to staff member.
 */
router.post(
  "/conversations/:id/assign",
  verifyToken,
  requireTenantContext,
  async (req, res) => {
    try {
      const convId = Number(req.params.id);
      const tid = req.tenantId;
      const { userId } = req.body;

      const [conv] = await q("SELECT id FROM conversations WHERE id = ? AND tenant_id = ? LIMIT 1", [convId, tid]);
      if (!conv) return res.status(404).json({ success: false, message: "Conversation not found" });

      await q("UPDATE conversations SET owner_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [
        userId ? Number(userId) : null,
        convId,
      ]);

      res.json({ success: true, message: "Conversation assigned successfully" });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }
);

/**
 * POST /api/v2/conversations/:id/transfer
 * Transfer conversation to another branch with audit tracking.
 */
router.post(
  "/conversations/:id/transfer",
  verifyToken,
  requireTenantContext,
  async (req, res) => {
    try {
      const paramId = req.params.id;
      const tid = req.tenantId;
      const { targetBranchId, targetUserId, note } = req.body;

      if (!targetBranchId) {
        return res.status(400).json({ success: false, message: "Target branch ID is required" });
      }

      // Verify target branch exists in tenant
      const [targetBranch] = await q("SELECT id, name, code FROM branches WHERE id = ? AND tenant_id = ? LIMIT 1", [
        Number(targetBranchId),
        tid,
      ]);
      if (!targetBranch) {
        return res.status(400).json({ success: false, message: "Target branch does not belong to this organization" });
      }

      // Verify target user if provided
      let targetUser = null;
      if (targetUserId) {
        const [u] = await q("SELECT id, first_name, last_name, email FROM users WHERE id = ? LIMIT 1", [Number(targetUserId)]);
        targetUser = u || null;
      }

      // Resolve conversation (by ID or contact phone)
      let conv = null;
      const numericId = Number(paramId);
      if (!isNaN(numericId) && numericId > 0 && numericId < 100000000) {
        const [c] = await q("SELECT id, branch_id, contact_id FROM conversations WHERE id = ? AND tenant_id = ? LIMIT 1", [
          numericId,
          tid,
        ]);
        conv = c || null;
      }

      if (!conv) {
        // Look up by phone number digits
        const digits = String(paramId).replace(/\D/g, "");
        const phone10 = digits.slice(-10);
        if (phone10) {
          const [c] = await q(
            `SELECT c.id, c.branch_id, c.contact_id 
             FROM conversations c
             JOIN wa_contacts ct ON c.contact_id = ct.id
             WHERE (ct.phone LIKE ? OR ct.phone = ?) AND c.tenant_id = ? 
             ORDER BY c.id DESC LIMIT 1`,
            [`%${phone10}`, phone10, tid]
          );
          conv = c || null;

          if (!conv) {
            // Find or create contact, then create conversation record
            let [ct] = await q(
              "SELECT id FROM wa_contacts WHERE (phone LIKE ? OR phone = ?) AND tenant_id = ? LIMIT 1",
              [`%${phone10}`, phone10, tid]
            );
            if (!ct) {
              const ins = await q(
                "INSERT INTO wa_contacts (tenant_id, phone, name, source) VALUES (?, ?, ?, 'direct_chat')",
                [tid, digits, digits]
              );
              ct = { id: ins.insertId };
            }
            const newConv = await q(
              `INSERT INTO conversations (tenant_id, contact_id, branch_id, owner_user_id, status)
               VALUES (?, ?, ?, ?, 'open')`,
              [tid, ct.id, Number(targetBranchId), targetUser ? targetUser.id : null]
            );
            conv = { id: newConv.insertId, contact_id: ct.id, branch_id: Number(targetBranchId) };
          }
        }
      }

      if (conv) {
        await q(
          `UPDATE conversations 
           SET branch_id = ?, owner_user_id = ?, updated_at = CURRENT_TIMESTAMP 
           WHERE id = ? AND tenant_id = ?`,
          [Number(targetBranchId), targetUser ? targetUser.id : null, conv.id, tid]
        );
      }

      const assigneeName = targetUser
        ? `${targetUser.first_name || ""} ${targetUser.last_name || targetUser.email || ""}`.trim()
        : "Unassigned Queue";

      // Audit note
      const auditNote = `Transferred to ${targetBranch.name} (Assigned to: ${assigneeName})${note ? ` — Note: ${note}` : ""}`;
      await q(
        `INSERT INTO wa_internal_notes (tenant_id, branch_id, note_text, created_by)
         VALUES (?, ?, ?, ?)`,
        [
          tid,
          Number(targetBranchId),
          auditNote,
          req.user.id,
        ]
      ).catch(() => {});

      // Record branch audit event
      const orgService = require("../services/organizationService");
      if (orgService.recordBranchAudit) {
        await orgService.recordBranchAudit(tid, Number(targetBranchId), req.user.id, "conversation.transferred", {
          conversation_id: conv?.id,
          target_branch_id: Number(targetBranchId),
          target_user_id: targetUser ? targetUser.id : null,
          note,
        }).catch(() => {});
      }

      res.json({
        success: true,
        message: `Conversation transferred to ${targetBranch.name} and assigned to ${assigneeName}`,
        conversationId: conv?.id,
        branchId: Number(targetBranchId),
        branchName: targetBranch.name,
        branchCode: targetBranch.code,
        assignedUserId: targetUser ? targetUser.id : null,
        assignedUserName: targetUser ? `${targetUser.first_name} ${targetUser.last_name || ""}`.trim() : null,
      });
    } catch (err) {
      console.error("[POST /api/v2/inbox/conversations/:id/transfer] Error:", err);
      res.status(400).json({ success: false, message: err.message });
    }
  }
);

module.exports = router;
