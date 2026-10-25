const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const db = require("../config/database");
const { encrypt, decrypt } = require("../backendutil/cryptoHelper");
const { generateOtp } = require("../backendutil/otp");
const sendEmailOtp = require("../backendutil/sendSms");
const { verifyToken, isAdmin, isAdminOnly } = require("../middleware/authMiddleware");
const { createRateLimiter, loginLimiter, otpLimiter } = require("../middleware/waRateLimiter");
const { getNotificationIO } = require("../sockets/notifications");
const tenantPlanService = require("../services/tenantPlanService");
const organizationService = require("../services/organizationService");
const { resolveTenantId } = require("../middleware/tenantMiddleware");

const queryAsync = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });

const router = express.Router();

/**
 * JWT signing secret accessor.
 *
 * `middleware/authMiddleware.js` already refuses to verify when JWT_SECRET is
 * unset, so signing with a source-code fallback would only ever mint tokens
 * that cannot be verified - while quietly putting a guessable secret in the
 * signing path. Refuse loudly instead.
 *
 * Returns null (and has already responded 503) when unconfigured.
 */
function requireJwtSecret(res) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(503).json({
      success: false,
      code: "JWT_SECRET_REQUIRED",
      message: "Authentication is not configured",
    });
    return null;
  }
  return secret;
}

const fieldLabels = {
  first_name: "Name",
  email: "Email",
  mobile_number: "Mobile Number",
  emp_address: "Address",
  password: "Password"
};

/* ================= GET ALL USERS (for admin) ================= */
router.get("/users", verifyToken, isAdmin, (req, res) => {
  const tenantId = req.user?.tenant_id;
  if (!tenantId) {
    return res.status(403).json({ message: "Tenant context required" });
  }
  db.query(
    `SELECT id, first_name, last_name, email, role, status, emp_id, access_code, whatsapp_access_level, created_at 
     FROM users 
     WHERE tenant_id = ?
     ORDER BY created_at DESC`,
    [tenantId],
    (err, rows) => {
      if (err) return res.status(500).json({ message: "Failed to fetch users" });
      res.json({ users: rows });
    }
  );
});

/* ================= SEND EMAIL OTP ================= */
router.post("/send-email-otp", otpLimiter, (req, res) => {
  const email = req.body.email?.trim().toLowerCase();

  if (!email) {
    return res.status(400).json({ message: "Email required" });
  }

  const otp = generateOtp();
  const expires = new Date(Date.now() + 5 * 60000);

  db.query(
    `INSERT INTO email_otp (email, otp, expires_at)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE otp=?, expires_at=?`,
    [email, otp, expires, otp, expires],
    async (err) => {
      if (err) {
        console.error("send-email-otp db error:", err.message);
        return res.status(500).json({ message: "OTP failed" });
      }

      try {
        await sendEmailOtp(email, otp);
        res.json({ message: "OTP sent to email" });
      } catch (mailErr) {
        console.error("send-email-otp mail error:", mailErr.message);
        return res.status(500).json({ message: "Failed to send OTP email. Please try again." });
      }
    }
  );
});

/*  REGISTER  */
router.post("/register", async (req, res) => {
  const { first_name, otp, user_password, emp_id } = req.body;
  const email = req.body.email?.trim().toLowerCase();

  if (!first_name || !email || !otp || !user_password || !emp_id) {
    return res.status(400).json({ message: "All fields required (Name, Email, Employee ID, OTP, Password)" });
  }

  db.query(
    `SELECT * FROM email_otp WHERE email=? AND otp=? AND expires_at > NOW()`,
    [email, otp],
    async (err, rows) => {
      if (!rows || !rows.length) {
        return res.status(400).json({ message: "Invalid or expired OTP" });
      }

      const hash = await bcrypt.hash(user_password, 10);
      const userRole = "employee";
      const status = "pending";

      db.query(
        `INSERT INTO users (first_name, email, user_password, role, status, emp_id) VALUES (?,?,?,?,?,?)`,
        [first_name.trim(), email, hash, userRole, status, emp_id.trim()],
        (err, result) => {
          if (err) {
            if (err.code === "ER_DUP_ENTRY") {
              return res.status(409).json({ message: "Email already registered" });
            }
            if (err.code === "ER_DUP_ENTRY" && err.message.includes("emp_id")) {
              return res.status(409).json({ message: "Employee ID already registered" });
            }
            return res.status(500).json({ message: "Server error" });
          }

          const newUserId = result.insertId;
          db.query(`DELETE FROM email_otp WHERE email=?`, [email]);

          db.query(
            `INSERT INTO teammember (first_name, emp_email, emp_id, job_title, emp_role, user_id) VALUES (?,?,?,?,?,?)`,
            [first_name.trim(), email, emp_id.trim(), "Sales", "Sales", newUserId]
          );

          db.query(
            `INSERT INTO admin_notifications (type, user_id, message) VALUES ('registration', ?, ?)`,
            [newUserId, `New employee registration: ${first_name} (${email}, EMP: ${emp_id}) is waiting for approval.`]
          );

          const notificationIO = getNotificationIO();
          if (notificationIO) {
            notificationIO.sendToAdmin("new_notification", {
              dbId: newUserId,
              type: "registration",
              timestamp: new Date().toISOString(),
              is_read: 0,
              data: {
                id: newUserId,
                userId: newUserId,
                userName: first_name,
                email,
                emp_id: emp_id,
                type: "user",
                message: `New employee registration: ${first_name} (${email}, EMP: ${emp_id}) is waiting for approval.`
              },
              userId: newUserId,
              message: `New employee registration: ${first_name} (${email}, EMP: ${emp_id}) is waiting for approval.`
            });
          }

          res.json({ message: "Registration successful. Your account is pending admin approval." });
        }
      );
    }
  );
});

/* ================= REQUEST ACCESS (public, no OTP) =================
   The landing page's "Request access" form. Accounts here are created by an
   admin, so there is nothing to verify against and no password to set — this
   only records the request and pings the admins. Stored in admin_notifications
   so it shows up in the same place registration approvals already do.
   Unauthenticated, so it is rate limited per IP and rejects duplicate emails. */
const accessRequestLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, maxRequests: 5, category: "access_request" });

router.post("/request-access", accessRequestLimiter, (req, res) => {
  const firstName = (req.body?.first_name || "").trim();
  const email = (req.body?.email || "").trim().toLowerCase();
  const empId = (req.body?.emp_id || "").trim();

  if (!firstName || !email || !empId) {
    return res.status(400).json({ message: "All fields required (Name, Email, Employee ID)" });
  }
  if (firstName.length > 100 || empId.length > 50) {
    return res.status(400).json({ message: "Name or Employee ID is too long" });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return res.status(400).json({ message: "Enter a valid email address" });
  }

  // LIKE wildcards in the email must not widen the match.
  const likeEmail = email.replace(/[\\%_]/g, (c) => `\\${c}`);

  db.query(
    `SELECT id FROM users WHERE email = ? OR emp_id = ? LIMIT 1`,
    [email, empId],
    (err, existing) => {
      if (err) return res.status(500).json({ message: "Could not submit request" });
      if (existing && existing.length) {
        return res.status(409).json({ message: "This email or employee ID already has an account — try signing in." });
      }

      // Requesting access never creates a users row, so the users check above
      // cannot catch the same person submitting twice. Dedupe against recent
      // access requests instead, otherwise the form can be spammed with copies
      // of one request until the rate limit resets.
      db.query(
        `SELECT id FROM admin_notifications
          WHERE type = 'access_request'
            AND message LIKE ? ESCAPE '\\\\'
            AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
          LIMIT 1`,
        [`%${likeEmail}%`],
        (dupErr, dupes) => {
          if (dupErr) return res.status(500).json({ message: "Could not submit request" });
          if (dupes && dupes.length) {
            return res.status(409).json({ message: "An access request from this email was already received. An admin will be in touch." });
          }
          insertAccessRequest(res, firstName, email, empId);
        }
      );
    }
  );
});

function insertAccessRequest(res, firstName, email, empId) {
  const message = `Access requested by ${firstName} (${email}, EMP: ${empId}). An admin must create this account.`;

  db.query(
    `INSERT INTO admin_notifications (type, message, related_type, priority) VALUES ('access_request', ?, 'user', 'normal')`,
    [message],
    (insErr, result) => {
      if (insErr) {
        console.error("request-access insert error:", insErr.message);
        return res.status(500).json({ message: "Could not submit request" });
      }

      const notificationIO = getNotificationIO();
      if (notificationIO) {
        notificationIO.sendToAdmin("new_notification", {
          dbId: result.insertId,
          type: "access_request",
          timestamp: new Date().toISOString(),
          is_read: 0,
          data: { id: result.insertId, type: "user", message },
          message,
        });
      }

      res.json({ message: "Access request received. An admin will create your account and you can sign in once it is approved." });
    }
  );
}

/* ================= ADMIN LOGIN ================= */
router.post("/admin-login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: "Email and password required" });
  const emailLower = email.trim().toLowerCase();

  db.query(
    `SELECT id, first_name, last_name, email, role, status, user_password, two_factor_enabled FROM users WHERE email=? OR emp_id=?`,
    [emailLower, emailLower],
    (err, rows) => {
      if (err || !rows.length) {
        return res.status(404).json({ message: "No account found" });
      }

      const user = rows[0];
      if (user.role !== "admin") return res.status(403).json({ message: "Access denied. Admin only." });
      if (user.status !== "active") return res.status(403).json({ message: "Account is not active" });

      bcrypt.compare(password, user.user_password, async (err, match) => {
        if (err || !match) return res.status(401).json({ message: "Invalid password" });

        if (user.two_factor_enabled) {
          const otp = generateOtp();
          const expires = new Date(Date.now() + 5 * 60000);

          db.query(
            `INSERT INTO email_otp (email, otp, expires_at)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE otp=?, expires_at=?`,
            [user.email, otp, expires, otp, expires],
            async (dbErr) => {
              if (dbErr) {
                console.error("2FA OTP db save error:", dbErr.message);
                return res.status(500).json({ message: "Failed to generate 2FA code" });
              }

              try {
                await sendEmailOtp(user.email, otp, "Your Madhura Tech CRM 2FA Login Verification Code", true);
                return res.json({ requires2FA: true, email: user.email, message: "2FA verification code sent to your email" });
              } catch (mailErr) {
                console.error("2FA OTP mail send error:", mailErr.message);
                return res.status(500).json({ message: "Failed to send 2FA verification email" });
              }
            }
          );
        } else {
          const token = jwt.sign({ id: user.id, role: user.role, name: user.first_name }, process.env.JWT_SECRET, { expiresIn: "14d" });
          return res.json({ token, user: { id: user.id, name: user.first_name, email: user.email, role: user.role } });
        }
      });
    }
  );
});

/*
 * Demo previews never grant access to customer data or live senders.
 *
 * This is a development convenience (one-click demo workspace), not a product
 * feature. In production it is disabled outright unless an operator
 * deliberately re-enables it: it signs a real 14-day JWT with no password, no
 * MFA and no rate limiter, so leaving it reachable on a live deployment is a
 * public admin-login backdoor. PRODUCTION_READINESS.md records that the public
 * demo admin login must be removed - this is the enforcement point, kept
 * reachable in dev so local onboarding still works.
 */
router.post("/demo-login", async (req, res) => {
  const demoLoginDisabled =
    process.env.NODE_ENV === "production" &&
    !["1", "true", "yes", "on"].includes(
      String(process.env.ALLOW_DEMO_LOGIN || "").toLowerCase()
    );
  if (demoLoginDisabled) {
    return res.status(403).json({
      success: false,
      code: "DEMO_LOGIN_DISABLED",
      message: "Demo access is disabled in production",
    });
  }

  const secret = requireJwtSecret(res);
  if (!secret) return;

  const requestedRole = req.body?.role === "employee" ? "employee" : "admin";
  const demoEmail = requestedRole === "employee" ? "staff@madhuratech.com" : "admin@madhuratech.com";
  const demoName = requestedRole === "employee" ? "Demo Staff" : "Demo Admin";

  db.query(
    `SELECT id, first_name, email, role, status, tenant_id FROM users WHERE email=? OR role='admin' ORDER BY id ASC LIMIT 1`,
    [demoEmail],
    async (err, rows) => {
      if (err) {
        return res.status(500).json({ success: false, message: "Demo account lookup failed" });
      }
      const user = (rows && rows.length) ? rows[0] : { id: 1, first_name: demoName, email: demoEmail, role: requestedRole, status: "active", tenant_id: 1 };
      const tid = Number(user.tenant_id) || 1;

      let orgs = await organizationService.getUserOrganizations(user.id).catch(() => []);
      const activeOrg = (orgs && orgs.find(o => o.id === tid)) || (orgs && orgs[0]) || { id: tid, name: "Madhura Primary Organization", plan: "growth" };
      let branchList = await organizationService.getBranches(tid).catch(() => []);
      const activeBranch = branchList[0] || { id: 1, name: "Head Office (Main)", code: "HQ-01", is_head_office: 1 };

      const token = jwt.sign(
        { id: user.id, role: user.role || requestedRole, name: user.first_name || demoName, email: user.email || demoEmail, tenant_id: tid, branch_id: activeBranch.id, plan: activeOrg.plan || "growth" },
        secret,
        { expiresIn: "14d" }
      );

      return res.json({
        token,
        user: {
          id: user.id,
          name: user.first_name || demoName,
          email: user.email || demoEmail,
          role: user.role || requestedRole,
          tenant_id: tid,
          tenant_name: activeOrg.name,
          branch_id: activeBranch.id,
          branch_name: activeBranch.name,
          branch_code: activeBranch.code,
          plan: activeOrg.plan || "growth",
          demoMode: true,
        },
        activeOrganization: activeOrg,
        organizations: orgs.length ? orgs : [activeOrg],
        activeBranch,
        branches: branchList.length ? branchList : [activeBranch],
        permittedBranchIds: [activeBranch.id],
        message: "Demo developer access granted",
      });
    }
  );
});

/* ================= LOGIN with Password or OTP ================= */
router.post("/login", loginLimiter, (req, res) => {
  const { email, password, otp } = req.body;
  if (!email) return res.status(400).json({ message: "Email / Employee Code required" });
  const emailLower = email.trim().toLowerCase();

  db.query(
    `SELECT id, first_name, last_name, email, role, status, user_password, two_factor_enabled, tenant_id, access_code, whatsapp_access_level FROM users WHERE email=? OR emp_id=? OR UPPER(access_code)=?`,
    [emailLower, emailLower, emailLower.toUpperCase()],
    (err, rows) => {
      if (err || !rows.length) {
        return res.status(404).json({ message: "No account found with this email or employee code" });
      }

      const user = rows[0];
      if (user.status === "pending") return res.status(403).json({ message: "Account waiting for admin approval" });
      if (user.status === "banned") return res.status(403).json({ message: "Account has been banned" });

      const sendAuthResponse = async () => {
        const tid = user.tenant_id || 1;
        let tInfo = null;
        try {
          tInfo = await organizationService.getOrganizationDetails(tid);
        } catch (_) {}
        if (!tInfo) {
          tInfo = (typeof tenantPlanService !== "undefined" && tenantPlanService?.getTenantById)
            ? await tenantPlanService.getTenantById(tid).catch(() => ({ id: tid, name: "Workspace", plan: "starter" }))
            : { id: tid, name: "Workspace", plan: "starter" };
        }

        let orgs = await organizationService.getUserOrganizations(user.id).catch(() => []);
        if (!orgs || orgs.length === 0) {
          try {
            await queryAsync(
              `INSERT OR IGNORE INTO organization_memberships (tenant_id, user_id, role, membership_status) VALUES (?, ?, ?, 'active')`,
              [tid, user.id, user.role === 'admin' ? 'organization_owner' : 'agent']
            );
            orgs = await organizationService.getUserOrganizations(user.id).catch(() => []);
          } catch (_) {}
        }

        const activeOrg = (orgs && orgs.find(o => o.id === tid)) || (orgs && orgs[0]) || {
          id: tid,
          name: tInfo.name || "Workspace",
          plan: tInfo.plan || "starter",
        };
        const activeTenantId = activeOrg.id;

        let branchList = await organizationService.getBranches(activeTenantId).catch(() => []);
        if (!branchList || branchList.length === 0) {
          try {
            await queryAsync(
              `INSERT OR IGNORE INTO branches (tenant_id, code, name, timezone, is_head_office, status) VALUES (?, 'HEADOFFICE', 'Head Office (Main)', 'Asia/Kolkata', 1, 'active')`,
              [activeTenantId]
            );
            branchList = await organizationService.getBranches(activeTenantId).catch(() => []);
          } catch (_) {}
        }

        const staffBranches = await queryAsync(
          `SELECT sbm.branch_id, sbm.is_primary, b.name, b.code, b.is_head_office
           FROM staff_branch_memberships sbm
           JOIN branches b ON sbm.branch_id = b.id
           WHERE sbm.user_id = ? AND sbm.tenant_id = ?
           ORDER BY sbm.is_primary DESC`,
          [user.id, activeTenantId]
        ).catch(() => []);

        let activeBranch = null;
        if (staffBranches && staffBranches.length > 0) {
          activeBranch = branchList.find(b => b.id === staffBranches[0].branch_id) || staffBranches[0];
        } else {
          activeBranch = branchList.find(b => b.is_head_office) || branchList[0] || null;
          if (activeBranch) {
            try {
              await queryAsync(
                `INSERT OR IGNORE INTO staff_branch_memberships (tenant_id, user_id, branch_id, is_primary) VALUES (?, ?, ?, 1)`,
                [activeTenantId, user.id, activeBranch.id]
              );
            } catch (_) {}
          }
        }

        const secret = requireJwtSecret(res);
        if (!secret) return;
        const token = jwt.sign(
          {
            id: user.id,
            role: user.role,
            name: user.first_name,
            email: user.email,
            tenant_id: activeTenantId,
            branch_id: activeBranch?.id || null,
            whatsapp_access_level: user.whatsapp_access_level || "full",
            plan: activeOrg.plan || "starter",
          },
          secret,
          { expiresIn: "14d" }
        );

        return res.json({
          nextPath:activeOrg.pending_plan_id && activeOrg.role === "organization_owner" ? "/whatsapp/billing?onboarding=1&plan="+encodeURIComponent(activeOrg.pending_plan_id):"/whatsapp",
          token,
          user: {
            id: user.id,
            name: user.first_name,
            email: user.email,
            role: user.role,
            tenant_id: activeTenantId,
            tenant_name: activeOrg.name || "Workspace",
            branch_id: activeBranch?.id || null,
            branch_name: activeBranch?.name || "Head Office (Main)",
            branch_code: activeBranch?.code || "HQ-01",
            whatsapp_access_level: user.whatsapp_access_level || "full",
            plan: activeOrg.plan || "starter",
          },
          activeOrganization: activeOrg,
          organizations: orgs,
          activeBranch,
          branches: branchList,
          permittedBranchIds: user.role === 'admin' ? branchList.map(b => b.id) : (staffBranches.map(s => s.branch_id)),
          tenant: tInfo,
        });
      };

      if (password) {
        bcrypt.compare(password, user.user_password, async (err, match) => {
          if (err || !match) return res.status(401).json({ message: "Invalid password" });

          if (user.two_factor_enabled) {
            const otp = generateOtp();
            const expires = new Date(Date.now() + 5 * 60000);

            db.query(
              `INSERT INTO email_otp (email, otp, expires_at)
               VALUES (?, ?, ?)
               ON DUPLICATE KEY UPDATE otp=?, expires_at=?`,
              [user.email, otp, expires, otp, expires],
              async (dbErr) => {
                if (dbErr) {
                  console.error("2FA OTP db save error:", dbErr.message);
                  return res.status(500).json({ message: "Failed to generate 2FA code" });
                }

                try {
                  await sendEmailOtp(user.email, otp, "Your Madhura Tech CRM 2FA Login Verification Code", true);
                  return res.json({ requires2FA: true, email: user.email, message: "2FA verification code sent to your email" });
                } catch (mailErr) {
                  console.error("2FA OTP mail send error:", mailErr.message);
                  return res.status(500).json({ message: "Failed to send 2FA verification email" });
                }
              }
            );
          } else {
            return sendAuthResponse();
          }
        });
        return;
      }

      if (!otp) return res.status(400).json({ message: "Please provide OTP or password" });

      db.query(`SELECT * FROM email_otp WHERE email=? AND otp=? AND expires_at > NOW()`, [emailLower, otp], async (err2, otpRows) => {
        if (err2 || !otpRows.length) return res.status(401).json({ message: "Invalid or expired OTP" });
        db.query(`DELETE FROM email_otp WHERE email=?`, [emailLower]);
        return sendAuthResponse();
      });
    }
  );
});

/* ================= SUBSCRIPTION PLANS (PUBLIC) ================= */
router.get("/plans", async (req, res) => {
  try {
    const plans = await require("../services/billingService").getPlans();
    res.json({ plans });
  } catch (err) {
    res.status(500).json({ message: "Failed to load plans" });
  }
});

/* ================= SELF SIGNUP (MULTI-TENANT & MULTI-BRANCH WORKSPACE ONBOARDING) ================= */
const signupLimiter=createRateLimiter({windowMs:15*60*1000,maxRequests:10,category:"workspace_signup"});
router.post("/self-signup",signupLimiter,async(req,res)=>{
  const secret=requireJwtSecret(res);if(!secret)return;
  try{
    const result=await require("../services/selfSignupService").createSignupService(db,organizationService)(req.body||{});
    const {user,org,branch}=result;
    const token=jwt.sign({id:user.id,role:user.role,name:user.name,email:user.email,tenant_id:org.id,branch_id:branch.id,plan:org.plan},secret,{expiresIn:"14d"});
    res.status(201).json({token,user,activeOrganization:org,organizations:[{...org,role:"organization_owner",membership_status:"active"}],activeBranch:branch,branches:[branch],permittedBranchIds:[branch.id],checkoutRequired:org.checkoutRequired,requestedPlanId:org.requestedPlanId,nextPath:org.checkoutRequired?"/whatsapp/billing?onboarding=1&plan="+encodeURIComponent(org.requestedPlanId):"/whatsapp",message:org.checkoutRequired?"Account created on the free plan. Complete payment to activate your selected plan.":"Your free workspace is ready."});
  }catch(error){
    console.error("[self-signup]",error.code||error.status||"SIGNUP_FAILED");
    res.status(error.status||503).json({message:error.status?error.message:"Workspace signup is unavailable. If an account was already created, sign in to continue."});
  }
});

/* ================= GET CURRENT TENANT & USAGE ================= */
router.get("/tenant-info", verifyToken, async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      return res.status(403).json({ message: "Tenant context required" });
    }
    const usageData = await tenantPlanService.getTenantUsage(tenantId);
    res.json(usageData);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch tenant info" });
  }
});

/* ================= SWITCH / UPGRADE PLAN ================= */
router.post("/switch-plan", verifyToken, isAdmin, async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      return res.status(403).json({ message: "Tenant context required" });
    }
    const { plan } = req.body;
    if (!plan) return res.status(400).json({ message: "Plan is required" });

    // Allow plan update only for platform admin in development, otherwise direct to billing checkout
    if (process.env.NODE_ENV === "development" && req.user.role === "admin") {
      const updated = await tenantPlanService.switchTenantPlan(tenantId, plan);
      return res.json({
        message: `Plan upgraded to ${updated.planMeta?.name || plan}`,
        tenant: updated,
      });
    }

    return res.status(402).json({
      message: "Direct plan switching is disabled. Upgrades require a verified checkout session via /api/v2/billing/checkout.",
      checkoutUrl: "/api/v2/billing/checkout",
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to update plan" });
  }
});

/* ================= ADMIN: CREATE USER ================= */
router.post("/create-user", verifyToken, isAdmin, (req, res) => {
  const tenantId = req.user?.tenant_id;
  if (!tenantId) {
    return res.status(403).json({ message: "Organization context is required to create users" });
  }

  const { first_name, last_name, email, emp_id, job_title, emp_role, mobile_number, emp_address, user_password, system_role } = req.body;
  if (!first_name || !email || !user_password) return res.status(400).json({ message: "Name, email and password required" });

  const role = system_role || "employee";
  bcrypt.hash(user_password, 10, (err, hash) => {
    if (err) return res.status(500).json({ message: "Password hash failed" });

    db.query(`INSERT INTO users (first_name, last_name, email, user_password, role, status, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [first_name, last_name || "", email.toLowerCase(), hash, role, "active", tenantId], (err2, result) => {
        if (err2) {
          if (err2.code === "ER_DUP_ENTRY") return res.status(400).json({ message: "Email already exists" });
          return res.status(500).json({ message: "User creation failed" });
        }

        const newUserId = result.insertId;
        db.query(
          `INSERT INTO teammember (first_name, last_name, emp_email, emp_id, job_title, emp_role, mobile_number, emp_address, user_id, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [first_name, last_name || "", email.toLowerCase(), emp_id || null, job_title || "Developer", emp_role || "Developer", mobile_number || null, emp_address || null, newUserId, tenantId],
          (err3) => {
            if (err3) {
              console.error("Teammember insert error after user creation:", err3);
            }
          }
        );

        // Also record in organization_memberships
        db.query(
          `INSERT OR IGNORE INTO organization_memberships (tenant_id, user_id, role, membership_status) VALUES (?, ?, ?, 'active')`,
          [tenantId, newUserId, role === "admin" ? "organization_admin" : "agent"]
        );

        res.json({ message: "User created successfully", userId: newUserId });
      });
  });
});

/* ================= EMPLOYEE MANAGEMENT, ACCESS CODES & MULTI-DYNAMIC ANALYTICS ================= */

// Generate secure random access code e.g. AC-X9B2-4821
function generateEmployeeAccessCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let part1 = "";
  for (let i = 0; i < 4; i++) {
    part1 += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const part2 = Math.floor(1000 + Math.random() * 9000);
  return `AC-${part1}-${part2}`;
}

// 1. GET /api/auth/employees — Admin only. Strictly scoped to current tenant.
router.get("/employees", verifyToken, isAdmin, async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) return res.status(403).json({ message: "Organization context required", code: "TENANT_REQUIRED" });
    const requestedBranch = req.query?.branchId || req.query?.branch_id || req.headers["x-branch-id"];

    // Strict employee isolation: employees can NEVER list or view other employees
    if (req.user?.role === "employee") {
      return res.status(403).json({ message: "Access denied. Employee accounts cannot view other employees." });
    }

    let branchWhere = "";
    const queryParams = [tenantId];
    if (requestedBranch && requestedBranch !== "all" && requestedBranch !== "0") {
      branchWhere = " AND (t.branch_id = ? OR sbm.branch_id = ?)";
      queryParams.push(Number(requestedBranch), Number(requestedBranch));
    }

    db.query(
      `SELECT 
        u.id, 
        u.first_name, 
        u.last_name, 
        u.email, 
        u.role, 
        u.status, 
        u.emp_id, 
        u.access_code, 
        u.whatsapp_access_level, 
        u.created_at,
        t.mobile,
        t.job_title,
        t.emp_role,
        COALESCE(t.branch_id, sbm.branch_id) as branch_id,
        b.name as branch_name,
        b.code as branch_code
       FROM users u
       LEFT JOIN teammember t ON (t.user_id = u.id OR (u.email IS NOT NULL AND t.emp_email = u.email))
       LEFT JOIN staff_branch_memberships sbm ON (sbm.tenant_id = u.tenant_id AND sbm.user_id = u.id AND sbm.is_primary = 1)
       LEFT JOIN branches b ON (b.id = COALESCE(t.branch_id, sbm.branch_id))
       WHERE u.tenant_id = ? ${branchWhere}
       ORDER BY u.created_at DESC`,
      queryParams,
      (err, rows) => {
        if (err) {
          console.error("fetch employees error:", err.message);
          return res.status(500).json({ message: "Failed to fetch employees" });
        }

        const employees = rows || [];

        // Multi-dynamic analytics calculation
        const total = employees.length;
        const active = employees.filter((e) => e.status === "active").length;
        const pending = employees.filter((e) => e.status === "pending" || !e.user_password).length;

        const accessLevels = {
          full: employees.filter((e) => !e.whatsapp_access_level || e.whatsapp_access_level === "full").length,
          chat_only: employees.filter((e) => e.whatsapp_access_level === "chat_only").length,
          read_only: employees.filter((e) => e.whatsapp_access_level === "read_only").length,
          campaign_only: employees.filter((e) => e.whatsapp_access_level === "campaign_only").length,
        };

        // Query total messages dispatched in this tenant
        db.query(
          `SELECT COUNT(*) as total_dispatched FROM wa_message_logs WHERE tenant_id = ?`,
          [tenantId],
          (logErr, logRows) => {
            const totalDispatched = (logRows && logRows[0] && logRows[0].total_dispatched) || 0;

            res.json({
              employees,
              analytics: {
                total_employees: total,
                active_employees: active,
                pending_activation: pending,
                access_levels: accessLevels,
                total_messages_dispatched: totalDispatched,
              },
            });
          }
        );
      }
    );
  } catch (err) {
    console.error("GET /employees exception:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// 2. POST /api/auth/employees — Admin creates employee & generates Access Code
router.post("/employees", verifyToken, isAdmin, async (req, res) => {
  try {
    const tenantId = req.tenantId || resolveTenantId(req);
    if (!tenantId) return res.status(403).json({ message: "Organization context required" });
    const branchId = Number(req.body.branch_id);
    if (!Number.isSafeInteger(branchId) || branchId < 1) return res.status(400).json({ message: "Select a branch for this employee" });
    const employee = await organizationService.createBranchEmployee(tenantId, branchId, req.body, req.user.id);
    res.status(201).json({ message: "Employee created. Share their access code privately.", employee, access_code: employee.access_code });
  } catch (error) {
    res.status(400).json({ message: error.code === "ER_DUP_ENTRY" ? "An account with this email already exists" : error.message });
  }
});

// 3. POST /api/auth/employees/:id/regenerate-code — Admin regenerates a fresh access code
router.post("/employees/:id/regenerate-code", verifyToken, isAdmin, (req, res) => {
  const tenantId = resolveTenantId(req);
  if (!tenantId) return res.status(403).json({ message: "Organization context required", code: "TENANT_REQUIRED" });
  const targetId = parseInt(req.params.id, 10);

  if (!targetId) return res.status(400).json({ message: "Invalid employee ID" });

  db.query(`SELECT id, first_name, email FROM users WHERE id = ? AND tenant_id = ?`, [targetId, tenantId], (err, rows) => {
    if (err || !rows || !rows.length) {
      return res.status(404).json({ message: "Employee not found in your workspace" });
    }

    const newCode = generateEmployeeAccessCode();

    db.query(`UPDATE users SET access_code = ? WHERE id = ? AND tenant_id = ?`, [newCode, targetId, tenantId], (upErr) => {
      if (upErr) return res.status(500).json({ message: "Failed to update access code" });

      try {
        db.query(`UPDATE teammember SET access_code = ? WHERE user_id = ?`, [newCode, targetId]);
      } catch (_) {}

      res.json({
        message: "New Access Code generated successfully!",
        access_code: newCode,
      });
    });
  });
});

// 4. PUT /api/auth/employees/:id — Admin updates role, status, name, access level
router.put("/employees/:id", verifyToken, isAdmin, async (req, res) => {
  const tenantId = req.tenantId || resolveTenantId(req);
  const targetId = Number(req.params.id);
  if (!tenantId || !Number.isSafeInteger(targetId) || targetId < 1) return res.status(400).json({ message: "Valid employee and organization required" });
  try {
    await require("../services/sharedInboxService").createInboxService(db).transaction(async q => {
      await q("INSERT INTO wa_routing_cursors (tenant_id,last_user_id) VALUES (?,0) ON DUPLICATE KEY UPDATE tenant_id=VALUES(tenant_id)", [tenantId]);
      await q("SELECT tenant_id FROM wa_routing_cursors WHERE tenant_id = ? FOR UPDATE", [tenantId]);
      const [employee] = await q("SELECT u.id, m.role FROM users u JOIN organization_memberships m ON m.user_id=u.id AND m.tenant_id=u.tenant_id WHERE u.id=? AND u.tenant_id=? FOR UPDATE", [targetId,tenantId]);
      if (!employee || employee.role === 'organization_owner') throw new Error("Employee not found or owner cannot be edited here");
      const fields = [], params = [];
      for (const field of ['first_name','last_name']) if (req.body[field] !== undefined) { fields.push(field+' = ?'); params.push(String(req.body[field]).trim().slice(0,100)); }
      for (const [field, allowed] of [['role',['admin','employee','agent']],['status',['active','pending','banned']],['whatsapp_access_level',['full','chat_only','read_only','campaign_only']]]) {
        if (req.body[field] !== undefined) { if (!allowed.includes(req.body[field])) throw new Error('Invalid '+field); fields.push(field+' = ?'); params.push(req.body[field]); }
      }
      if (fields.length) await q('UPDATE users SET '+fields.join(', ')+' WHERE id = ? AND tenant_id = ?', [...params,targetId,tenantId]);
      if (req.body.role !== undefined) await q("UPDATE organization_memberships SET role = ? WHERE tenant_id = ? AND user_id = ?", [req.body.role==='admin'?'organization_admin':'agent',tenantId,targetId]);
      const branchId = Number(req.body.branch_id || req.body.branchId);
      if (branchId) {
        const [branch] = await q("SELECT id FROM branches WHERE id = ? AND tenant_id = ? AND status = 'active'", [branchId,tenantId]);
        if (!branch) throw new Error('Branch is outside this organization');
        await q("DELETE FROM staff_branch_memberships WHERE tenant_id = ? AND user_id = ? AND branch_id <> ?", [tenantId,targetId,branchId]);
        await q("INSERT IGNORE INTO staff_branch_memberships (tenant_id,user_id,branch_id,is_primary) VALUES (?,?,?,1)", [tenantId,targetId,branchId]);
        await q("UPDATE teammember SET branch_id = ? WHERE user_id = ? AND tenant_id = ?", [branchId,targetId,tenantId]);
        await q("UPDATE conversations SET owner_user_id = NULL WHERE tenant_id = ? AND owner_user_id = ? AND branch_id <> ?", [tenantId,targetId,branchId]);
      }
      if (req.body.status && req.body.status !== 'active') await q("UPDATE conversations SET owner_user_id = NULL WHERE tenant_id = ? AND owner_user_id = ?", [tenantId,targetId]);
    });
    res.json({ message: "Employee updated successfully" });
  } catch (error) { res.status(400).json({ message: error.message }); }
});

// 5. DELETE /api/auth/employees/:id — Admin deletes employee (cannot delete self)
router.delete("/employees/:id", verifyToken, isAdmin, (req, res) => {
  const tenantId = resolveTenantId(req);
  if (!tenantId) return res.status(403).json({ message: "Organization context required", code: "TENANT_REQUIRED" });
  const targetId = parseInt(req.params.id, 10);

  if (!targetId) return res.status(400).json({ message: "Invalid employee ID" });
  if (req.user?.id === targetId) {
    return res.status(400).json({ message: "You cannot delete your own admin account" });
  }

  db.query(`SELECT id, email FROM users WHERE id = ? AND tenant_id = ?`, [targetId, tenantId], (err, rows) => {
    if (err || !rows || !rows.length) {
      return res.status(404).json({ message: "Employee not found in your workspace" });
    }

    const email = rows[0].email;
    db.query(`DELETE FROM users WHERE id = ? AND tenant_id = ?`, [targetId, tenantId], (delErr) => {
      if (delErr) return res.status(500).json({ message: "Failed to delete employee" });

      try {
        db.query(`DELETE FROM teammember WHERE user_id = ? OR emp_email = ?`, [targetId, email]);
      } catch (_) {}

      res.json({ message: "Employee deleted successfully." });
    });
  });
});

// 6. POST /api/auth/verify-access-code — Public code preview for employee signup/activation
router.post("/verify-access-code", (req, res) => {
  const code = (req.body?.access_code || "").trim().toUpperCase();
  if (!code) return res.status(400).json({ valid: false, message: "Access code is required" });

  db.query(
    `SELECT u.id, u.first_name, u.email, u.role, u.whatsapp_access_level, u.tenant_id,
            t.name as tenant_name,
            b.id as branch_id, b.name as branch_name, b.code as branch_code
     FROM users u
     LEFT JOIN tenants t ON t.id = u.tenant_id
     LEFT JOIN staff_branch_memberships sbm ON sbm.user_id = u.id AND sbm.tenant_id = u.tenant_id
     LEFT JOIN branches b ON b.id = sbm.branch_id
     WHERE UPPER(u.access_code) = ?
     ORDER BY sbm.is_primary DESC LIMIT 1`,
    [code],
    (err, rows) => {
      if (err || !rows || !rows.length) {
        return res.status(404).json({ valid: false, message: "Invalid access code. Please check with your administrator." });
      }

      const u = rows[0];
      res.json({
        valid: true,
        email: u.email,
        first_name: u.first_name,
        role: u.role,
        whatsapp_access_level: u.whatsapp_access_level || "full",
        tenant_name: u.tenant_name || "Workspace",
        tenant_id: u.tenant_id,
        branch_id: u.branch_id || null,
        branch_name: u.branch_name || "Head Office (Main)",
        branch_code: u.branch_code || "HQ-01",
      });
    }
  );
});

// 7. POST /api/auth/join-with-access-code — Employee logs in & activates account with admin Access Code
router.post("/join-with-access-code", async (req, res) => {
  try {
    const { access_code, email, password, full_name } = req.body || {};
    const code = (access_code || "").trim().toUpperCase();
    const cleanEmail = (email || "").trim().toLowerCase();
    const cleanPass = password || "";
    const cleanName = (full_name || "").trim();

    if (!code) return res.status(400).json({ message: "Access code is required" });
    if (!cleanEmail) return res.status(400).json({ message: "Email address is required" });
    if (!cleanPass || cleanPass.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long" });
    }

    db.query(
      `SELECT u.id, u.first_name, u.email, u.role, u.status, u.user_password, u.tenant_id, u.whatsapp_access_level, u.emp_id, t.name as tenant_name, t.plan
       FROM users u
       LEFT JOIN tenants t ON t.id = u.tenant_id
       WHERE UPPER(u.access_code) = ? LIMIT 1`,
      [code],
      async (err, rows) => {
        if (err || !rows || !rows.length) {
          return res.status(404).json({ message: "Invalid access code. Please obtain a valid code from your workspace admin." });
        }

        const user = rows[0];

        // Check if email matches the assigned invitation email
        if (user.email && user.email.toLowerCase() !== cleanEmail) {
          return res.status(400).json({
            message: `This access code was issued for ${user.email}. Please use that email to activate.`,
          });
        }

        const hash = await bcrypt.hash(cleanPass, 10);
        const displayName = cleanName || user.first_name || "Employee";

        db.query(
          `UPDATE users SET user_password = ?, status = 'active', first_name = ? WHERE id = ?`,
          [hash, displayName, user.id],
          async (upErr) => {
            if (upErr) {
              console.error("join-with-access-code update error:", upErr.message);
              return res.status(500).json({ message: "Failed to activate employee account" });
            }

            try {
              db.query(`UPDATE teammember SET first_name = ? WHERE user_id = ?`, [displayName, user.id]);
            } catch (_) {}

            const tid = user.tenant_id || 1;

            // Ensure organization membership exists
            try {
              await queryAsync(
                `INSERT OR IGNORE INTO organization_memberships (tenant_id, user_id, role, membership_status) VALUES (?, ?, ?, 'active')`,
                [tid, user.id, user.role || "agent"]
              );
            } catch (_) {}

            // Ensure branches and staff branch membership exist
            let branchList = await organizationService.getBranches(tid).catch(() => []);
            const staffBranches = await queryAsync(
              `SELECT sbm.branch_id, b.name, b.code, b.is_head_office
               FROM staff_branch_memberships sbm
               JOIN branches b ON sbm.branch_id = b.id
               WHERE sbm.user_id = ? AND sbm.tenant_id = ?
               ORDER BY sbm.is_primary DESC`,
              [user.id, tid]
            ).catch(() => []);

            let activeBranch = null;
            if (staffBranches && staffBranches.length > 0) {
              activeBranch = branchList.find((b) => b.id === staffBranches[0].branch_id) || staffBranches[0];
            } else {
              activeBranch = branchList.find((b) => b.is_head_office) || branchList[0] || null;
              if (activeBranch) {
                try {
                  await queryAsync(
                    `INSERT OR IGNORE INTO staff_branch_memberships (tenant_id, user_id, branch_id, is_primary) VALUES (?, ?, ?, 1)`,
                    [tid, user.id, activeBranch.id]
                  );
                } catch (_) {}
              }
            }

            const orgs = await organizationService.getUserOrganizations(user.id).catch(() => []);
            const activeOrg = (orgs && orgs.find((o) => o.id === tid)) || { id: tid, name: user.tenant_name || "Workspace", plan: user.plan || "starter" };

            const secret = requireJwtSecret(res);
            if (!secret) return;
            const token = jwt.sign(
              {
                id: user.id,
                role: user.role || "employee",
                name: displayName,
                email: cleanEmail,
                tenant_id: tid,
                branch_id: activeBranch?.id || null,
                whatsapp_access_level: user.whatsapp_access_level || "full",
                plan: user.plan || "starter",
              },
              secret,
              { expiresIn: "14d" }
            );

            res.status(200).json({
              token,
              user: {
                id: user.id,
                name: displayName,
                email: cleanEmail,
                role: user.role || "employee",
                tenant_id: tid,
                tenant_name: activeOrg.name,
                branch_id: activeBranch?.id || null,
                branch_name: activeBranch?.name || "Head Office (Main)",
                branch_code: activeBranch?.code || "HQ-01",
                whatsapp_access_level: user.whatsapp_access_level || "full",
                plan: user.plan || "starter",
              },
              activeOrganization: activeOrg,
              organizations: orgs.length ? orgs : [activeOrg],
              activeBranch,
              branches: branchList,
              permittedBranchIds: activeBranch ? [activeBranch.id] : [],
              message: "Access code verified! Your employee account is activated.",
            });
          }
        );
      }
    );
  } catch (err) {
    console.error("join-with-access-code exception:", err);
    res.status(500).json({ message: "Server error during employee activation" });
  }
});

// 8. GET /api/auth/my-employee-profile — Strictly personal profile, deep isolation for employees
router.get("/my-employee-profile", verifyToken, (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  db.query(
    `SELECT u.id, u.first_name, u.last_name, u.email, u.role, u.status, u.emp_id, u.whatsapp_access_level, u.tenant_id, t.name as tenant_name, t.plan
     FROM users u
     LEFT JOIN tenants t ON t.id = u.tenant_id
     WHERE u.id = ? LIMIT 1`,
    [userId],
    (err, rows) => {
      if (err || !rows || !rows.length) {
        return res.status(404).json({ message: "User profile not found" });
      }
      res.json({ profile: rows[0] });
    }
  );
});

// 9. GET /api/auth/teammember — Returns team members of current tenant for live chat assignments
router.get("/teammember", verifyToken, (req, res) => {
  const tenantId = req.user?.tenant_id;
  if (!tenantId) {
    return res.status(403).json({ message: "Tenant context required" });
  }
  db.query(
    `SELECT id, first_name, last_name, emp_email, mobile, job_title, emp_role, emp_id, user_id, whatsapp_access_level
     FROM teammember
     WHERE tenant_id = ?
     ORDER BY first_name ASC`,
    [tenantId],
    (err, rows) => {
      if (err) return res.json([]);
      res.json(rows || []);
    }
  );
});



/* ================= ADMIN: UPDATE USER ================= */
router.put("/update-user/:id", verifyToken, isAdmin, (req, res) => {
  const { first_name, email, emp_id, job_title, emp_role, mobile_number, emp_address, role } = req.body;

  db.query(`SELECT email, role FROM users WHERE id = ?`, [req.params.id], (err, rows) => {
    if (err || !rows.length) return res.status(404).json({ message: "User not found" });
    const oldEmail = rows[0].email;
    // Protect: cannot edit the primary admin user's record
    if (rows[0].email && rows[0].email.toLowerCase() === "admin@madhuratech.com") {
      return res.status(403).json({ message: "Cannot modify the primary admin account" });
    }

    db.query(`UPDATE users SET first_name = ?, email = ?, role = ? WHERE id = ?`, [first_name, email?.toLowerCase() || oldEmail, role || "employee", req.params.id], (err2) => {
      if (err2) return res.status(500).json({ message: "Update failed" });

      db.query(`UPDATE teammember SET first_name = ?, emp_email = ?, emp_id = ?, job_title = ?, emp_role = ?, mobile_number = ?, emp_address = ? WHERE emp_email = ?`,
        [first_name, email?.toLowerCase() || oldEmail, emp_id || null, job_title || "Developer", emp_role || "Developer", mobile_number || null, emp_address || null, oldEmail]);

      res.json({ message: "User updated successfully" });
    });
  });
});

/* ================= ADMIN: CHANGE USER ROLE ================= */
router.put("/change-role/:id", verifyToken, isAdminOnly, (req, res) => {
  const { role } = req.body;
  if (!["admin", "subadmin", "employee"].includes(role)) {
    return res.status(400).json({ message: "Invalid role. Can only set admin, subadmin or employee" });
  }
  // Check if target user is primary admin — primary admin is protected
  db.query(`SELECT email, role FROM users WHERE id = ?`, [req.params.id], (err, rows) => {
    if (err || !rows || (Array.isArray(rows) && !rows.length)) return res.status(404).json({ message: "User not found" });
    const user = (rows && Array.isArray(rows) && rows[0]) ? rows[0] : {};
    if (user.email && user.email.toLowerCase() === "admin@madhuratech.com") {
      return res.status(403).json({ message: "Cannot change the role of the primary admin account" });
    }
    db.query(`UPDATE users SET role = ? WHERE id = ?`, [role, req.params.id], (err2) => {
      if (err2) return res.status(500).json({ message: "Role update failed" });
      res.json({ message: `Role updated to ${role}` });
    });
  });
});

/* ================= ADMIN: BAN USER ================= */
router.put("/ban-user/:id", verifyToken, isAdminOnly, (req, res) => {
  const { status } = req.body;
  if (!["active", "banned", "pending"].includes(status)) return res.status(400).json({ message: "Invalid status" });

  // Protect primary admin account from being banned
  db.query(`SELECT email, role FROM users WHERE id = ?`, [req.params.id], (err0, rows0) => {
    if (err0 || !rows0 || (Array.isArray(rows0) && !rows0.length)) return res.status(404).json({ message: "User not found" });
    const user0 = (rows0 && Array.isArray(rows0) && rows0[0]) ? rows0[0] : {};
    if (user0.email && user0.email.toLowerCase() === "admin@madhuratech.com") return res.status(403).json({ message: "Cannot ban the primary admin account" });

    db.query(`UPDATE users SET status = ? WHERE id = ?`, [status, req.params.id], (err) => {
      if (err) {
        console.error("ban-user update error:", err);
        return res.status(500).json({ message: "Update failed", error: err.message });
      }
      res.json({ message: "User status updated" });
    });
  });
});

/* ================= ADMIN: DELETE USER ================= */
router.delete("/delete-user/:id", verifyToken, isAdminOnly, (req, res) => {
  db.query(`SELECT email, role FROM users WHERE id = ?`, [req.params.id], (err, rows) => {
    if (err || !rows.length) return res.status(404).json({ message: "User not found" });
    // Protect primary admin account from being deleted
    if (rows[0].email && rows[0].email.toLowerCase() === "admin@madhuratech.com") return res.status(403).json({ message: "Cannot delete the primary admin account" });


    db.query(`DELETE FROM users WHERE id = ?`, [req.params.id], (err2) => {
      if (err2) return res.status(500).json({ message: "Delete failed" });
      db.query(`DELETE FROM teammember WHERE emp_email = ?`, [rows[0].email]);
      res.json({ message: "User deleted" });
    });
  });
});

/* ================= ADMIN: RESET PASSWORD ================= */
router.post("/reset-password/:id", verifyToken, isAdmin, (req, res) => {
  const { new_password } = req.body;
  if (!new_password) return res.status(400).json({ message: "New password required" });

  db.query(`SELECT email, role FROM users WHERE id = ?`, [req.params.id], (err, rows) => {
    if (err || !rows || !rows.length) return res.status(404).json({ message: "User not found" });
    // If resetting the primary admin's password, allow it ONLY if they are doing it themselves
    if (rows[0].email && rows[0].email.toLowerCase() === "admin@madhuratech.com") {
      if (req.user.id !== parseInt(req.params.id)) {
        return res.status(403).json({ message: "Cannot reset the password of the primary admin account" });
      }
    }

    bcrypt.hash(new_password, 10, (errHash, hash) => {
      if (errHash) return res.status(500).json({ message: "Hash failed" });
      db.query(`UPDATE users SET user_password = ? WHERE id = ?`, [hash, req.params.id], (err2) => {
        if (err2) return res.status(500).json({ message: "Reset failed" });
        const sessions=require("../services/browserSessions");
        sessions.query("UPDATE browser_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE user_id=?",[Number(req.params.id)]).then(()=>{sessions.disconnectSessions({userId:Number(req.params.id)});res.json({message:"Password reset successfully; browser sessions revoked"});}).catch(()=>res.status(503).json({message:"Password reset, but session revocation could not be completed"}));
      });
    });
  });
});

/* ================= ADMIN: GET REGISTRATION NOTIFICATIONS ================= */
router.get("/notifications", verifyToken, isAdmin, (req, res) => {
  const { type, limit } = req.query;
  const params = [];
  let sql = `SELECT an.*, u.first_name, u.email, u.role, u.emp_id, u.status as user_status 
             FROM admin_notifications an 
             LEFT JOIN users u ON an.user_id = u.id 
             WHERE u.tenant_id = ?`;
  params.push(req.tenantId);

  if (type) { sql += " AND an.type = ?"; params.push(type); }
  sql += " ORDER BY an.created_at DESC";
  if (limit) { sql += " LIMIT ?"; params.push(parseInt(limit)); }

  db.query(sql, params, (err, rows) => {
    if (err) return res.status(500).json(err);
    res.json(rows);
  });
});

/* ================= ADMIN: APPROVE/REJECT USER ================= */
router.put("/approve/:userId", verifyToken, isAdmin, (req, res) => {
  const { action } = req.body;
  const { userId } = req.params;
  if (!["active", "rejected"].includes(action)) return res.status(400).json({ message: "Invalid action" });

  db.query("UPDATE users SET status = ? WHERE id = ?", [action, userId], (err) => {
    if (err) return res.status(500).json({ message: "Update failed" });

    if (action === "active") {
      db.query("UPDATE admin_notifications SET is_read = 1 WHERE user_id = ? AND type = 'registration'", [userId]);
      const userRes = db.query("SELECT first_name, email FROM users WHERE id = ?", [userId], (e2, rows) => {
        if (!e2 && rows.length) {
          const notificationIO = getNotificationIO();
          if (notificationIO) {
            notificationIO.sendToUser(rows[0].id, "new_notification", {
              dbId: rows[0].id,
              type: "registration_approved",
              timestamp: new Date().toISOString(),
              is_read: 0,
              data: {
                message: "Your account has been approved. You can now log in.",
                type: "registration_approved"
              }
            });
          }
        }
      });
    } else {
      db.query("UPDATE admin_notifications SET is_read = 1 WHERE user_id = ? AND type = 'registration'", [userId]);
    }

    res.json({ message: `User ${action === "active" ? "approved" : "rejected"} successfully` });
  });
});

/* ================= ADMIN: GET PROFILE CHANGE REQUESTS ================= */
router.get("/profile-change-requests", verifyToken, isAdmin, (req, res) => {
  db.query(
    `SELECT pcr.*, u.first_name, u.email 
     FROM profile_change_requests pcr 
     LEFT JOIN users u ON pcr.user_id = u.id 
     WHERE u.tenant_id = ? ORDER BY pcr.created_at DESC`,
    [req.tenantId],
    (err, rows) => {
      if (err) return res.status(500).json(err);
      res.json(rows);
    }
  );
});

/* ================= ADMIN: HANDLE PROFILE CHANGE REQUEST ================= */
router.put("/handle-change-request/:requestId", verifyToken, isAdmin, (req, res) => {
  const { action } = req.body;
  const { requestId } = req.params;
  if (!["approved", "declined"].includes(action)) return res.status(400).json({ message: "Invalid action" });

  db.query("SELECT p.* FROM profile_change_requests p JOIN users u ON u.id=p.user_id WHERE p.id = ? AND u.tenant_id = ?", [requestId,req.tenantId], (err, rows) => {
    if (err || !rows.length) return res.status(404).json({ message: "Request not found" });
    const req_data = rows[0];

    if (action === "approved") {
      const field = req_data.field;
      if (field === "password") {
        bcrypt.hash(req_data.new_value, 10, (hashErr, hash) => {
          if (hashErr) return res.status(500).json({ message: "Hash failed" });
          db.query("UPDATE users SET user_password = ? WHERE id = ?", [hash, req_data.user_id], (upErr) => {
            if (upErr) return res.status(500).json({ message: "Update failed" });
          });
        });
      } else if (field === "first_name") {
        db.query("UPDATE users SET first_name = ? WHERE id = ?", [req_data.new_value, req_data.user_id], (upErr) => {
          if (upErr) return res.status(500).json({ message: "Update failed" });
          db.query("UPDATE teammember SET first_name = ? WHERE user_id = ?", [req_data.new_value, req_data.user_id]);
        });
      } else if (field === "email") {
        db.query("UPDATE users SET email = ? WHERE id = ?", [req_data.new_value, req_data.user_id], (upErr) => {
          if (upErr) return res.status(500).json({ message: "Update failed" });
          db.query("UPDATE teammember SET emp_email = ? WHERE user_id = ?", [req_data.new_value, req_data.user_id]);
        });
      } else if (field === "mobile_number") {
        db.query("UPDATE teammember SET mobile_number = ? WHERE user_id = ?", [req_data.new_value, req_data.user_id]);
      } else if (field === "emp_address") {
        db.query("UPDATE teammember SET emp_address = ? WHERE user_id = ?", [req_data.new_value, req_data.user_id]);
      }
      db.query("UPDATE profile_change_requests SET status = ? WHERE id = ?", [action, requestId]);
    } else {
      db.query("UPDATE profile_change_requests SET status = ? WHERE id = ?", [action, requestId]);
    }

    const notificationIO = getNotificationIO();
    if (notificationIO) {
      notificationIO.sendToUser(req_data.user_id, "new_notification", {
        type: action === "approved" ? "profile_change_approved" : "profile_change_declined",
        timestamp: new Date().toISOString(),
        is_read: 0,
        data: {
          message: `Your profile change request (${req_data.field}) has been ${action}.`,
          field: req_data.field
        }
      });
    }

    res.json({ message: `Request ${action}` });
  });
});

/* ================= GET LOGGED-IN USER PROFILE ================= */
router.get("/profile", verifyToken, (req, res) => {
  const userId = req.user.id;
  db.query(
    `SELECT u.id, u.first_name, u.email, u.role, u.status, u.created_at, u.two_factor_enabled, 
            tm.job_title, tm.emp_role, tm.mobile_number, tm.emp_address, tm.emp_id
     FROM users u
     LEFT JOIN teammember tm ON u.id = tm.user_id
     WHERE u.id = ?`,
    [userId],
    (err, rows) => {
      if (err) {
        console.error("GET /profile db error:", err);
        return res.status(500).json({ message: "Failed to fetch profile" });
      }
      if (!rows.length) {
        return res.status(404).json({ message: "Profile not found" });
      }
      res.json(rows[0]);
    }
  );
});

/* ================= UPDATE LOGGED-IN USER PROFILE (Admin/Subadmin Direct) ================= */
router.put("/profile", verifyToken, (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;
  const { first_name, email, mobile_number, emp_address } = req.body;

  if (userRole !== "admin" && userRole !== "subadmin") {
    return res.status(403).json({ message: "Only administrators can directly modify profile data without approval." });
  }

  db.query(
    "UPDATE users SET first_name = ?, email = ? WHERE id = ?",
    [first_name, email, userId],
    (err) => {
      if (err) {
        console.error("PUT /profile users update error:", err);
        return res.status(500).json({ message: "Failed to update profile" });
      }

      // mobile_number / emp_address live only in `teammember`. Upsert so the
      // values are saved permanently even if this user has no teammember row
      // yet — otherwise the mobile number would silently fail to persist.
      const done = (err2) => {
        if (err2) {
          console.error("PUT /profile teammember upsert error:", err2);
          return res.status(500).json({ message: "Failed to update profile details" });
        }
        res.json({ message: "Profile updated successfully" });
      };

      db.query(
        "SELECT id FROM teammember WHERE user_id = ?",
        [userId],
        (errSel, tmRows) => {
          if (errSel) {
            console.error("PUT /profile teammember lookup error:", errSel);
            return res.status(500).json({ message: "Failed to update profile details" });
          }
          if (tmRows && tmRows.length) {
            db.query(
              "UPDATE teammember SET first_name = ?, emp_email = ?, mobile_number = ?, emp_address = ? WHERE user_id = ?",
              [first_name, email, mobile_number, emp_address, userId],
              done
            );
          } else {
            db.query(
              "INSERT INTO teammember (first_name, emp_email, mobile_number, emp_address, user_id) VALUES (?, ?, ?, ?, ?)",
              [first_name, email, mobile_number, emp_address, userId],
              done
            );
          }
        }
      );
    }
  );
});

/* ================= GET LOGGED-IN USER CHANGE REQUESTS ================= */
router.get("/my-change-requests", verifyToken, (req, res) => {
  const userId = req.user.id;
  db.query(
    "SELECT * FROM profile_change_requests WHERE user_id = ? ORDER BY created_at DESC",
    [userId],
    (err, rows) => {
      if (err) {
        console.error("GET /my-change-requests db error:", err);
        return res.status(500).json({ message: "Failed to fetch change requests" });
      }
      res.json(rows);
    }
  );
});

/* ================= REQUEST PROFILE CHANGE (Employee) ================= */
router.post("/request-profile-change", verifyToken, (req, res) => {
  const userId = req.user.id;
  const { field, new_value, current_password } = req.body;

  if (!field || new_value === undefined || new_value === null) {
    return res.status(400).json({ message: "Field and new value are required" });
  }

  const allowedFields = ["first_name", "email", "mobile_number", "emp_address", "password"];
  if (!allowedFields.includes(field)) {
    return res.status(400).json({ message: "Invalid profile field" });
  }

  if (field === "password") {
    if (!current_password) {
      return res.status(400).json({ message: "Current password is required to request a password change" });
    }
    db.query("SELECT user_password, first_name FROM users WHERE id = ?", [userId], async (err, rows) => {
      if (err || !rows.length) {
        return res.status(500).json({ message: "Database error" });
      }
      const user = rows[0];
      const match = await bcrypt.compare(current_password, user.user_password);
      if (!match) {
        return res.status(400).json({ message: "Invalid current password" });
      }

      insertRequest(userId, field, new_value, user.first_name, res);
    });
  } else {
    db.query("SELECT first_name FROM users WHERE id = ?", [userId], (err, rows) => {
      if (err || !rows.length) {
        return res.status(500).json({ message: "Database error" });
      }
      insertRequest(userId, field, new_value, rows[0].first_name, res);
    });
  }
});

/* ================= DIRECT CHANGE PASSWORD (For any logged in user) ================= */
router.post("/change-password-direct", verifyToken, (req, res) => {
  const userId = req.user.id;
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    return res.status(400).json({ message: "Current and new passwords are required" });
  }

  db.query("SELECT user_password FROM users WHERE id = ?", [userId], async (err, rows) => {
    if (err || !rows.length) {
      return res.status(500).json({ message: "Database error" });
    }
    const user = rows[0];
    const match = await bcrypt.compare(current_password, user.user_password);
    if (!match) {
      return res.status(400).json({ message: "Invalid current password" });
    }

    const hash = await bcrypt.hash(new_password, 10);
    db.query("UPDATE users SET user_password = ? WHERE id = ?", [hash, userId], (upErr) => {
      if (upErr) {
        console.error("change-password-direct db error:", upErr);
        return res.status(500).json({ message: "Failed to update password" });
      }
      const sessions=require("../services/browserSessions");
      sessions.query("UPDATE browser_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE user_id=?",[userId]).then(()=>{sessions.disconnectSessions({userId});sessions.clearCookies(res);res.json({message:"Password updated. Sign in again."});}).catch(()=>res.status(503).json({message:"Password updated, but session revocation could not be completed"}));
    });
  });
});

/* ================= SMTP CONNECTION VERIFICATION HELPER ================= */
const testSMTPConnection = async (host, port, secure, user, pass) => {
  const secureMode = secure === "SSL/TLS" || Number(port) === 465 || secure === "true" || secure === true;
  
  const createTransporter = () => nodemailer.createTransport({
    host: host,
    port: Number(port),
    secure: secureMode,
    auth: {
      user: user,
      pass: pass
    },
    connectionTimeout: 10000, // 10 seconds timeout
    greetingTimeout: 10000,
    socketTimeout: 10000,
    tls: { rejectUnauthorized: false }
  });

  const verifyAttempt = (transporter) => {
    return new Promise((resolve, reject) => {
      transporter.verify((error, success) => {
        if (error) {
          reject(error);
        } else {
          resolve(success);
        }
      });
    });
  };

  // Auto retry once
  try {
    const transporter = createTransporter();
    await verifyAttempt(transporter);
    return { success: true };
  } catch (error) {
    console.warn("SMTP verification attempt 1 failed, retrying...", error.message);
    try {
      const transporter = createTransporter();
      await verifyAttempt(transporter);
      return { success: true };
    } catch (retryError) {
      console.error("SMTP verification attempt 2 failed:", retryError);
      
      let message = "SMTP Connection failed.";
      let code = "SMTP_ERROR";
      const errStr = retryError.message || "";
      
      if (errStr.includes("Timeout") || retryError.code === "ETIMEDOUT") {
        message = "SMTP connection timeout. Please check your network connection, host, or port settings.";
        code = "TIMEOUT";
      } else if (errStr.includes("Username and Password not accepted") || errStr.includes("Invalid credentials") || errStr.includes("auth") || errStr.includes("Authentication failed")) {
        message = "Authentication failed. Invalid email address or app password. Please verify your credentials.";
        code = "INVALID_CREDENTIALS";
      } else if (errStr.includes("ENOTFOUND") || errStr.includes("EHOSTUNREACH")) {
        message = "SMTP server host not found. Please verify the SMTP server address.";
        code = "INVALID_HOST";
      } else {
        message = `SMTP error: ${errStr}`;
      }
      
      return { success: false, message, code, rawError: errStr };
    }
  }
};

/* ================= CHECK USER EMAIL SMTP CONFIG STATUS ================= */
router.get("/check-email-config", verifyToken, (req, res) => {
  const userId = req.user.id;
  db.query(
    "SELECT id, email_user, smtp_host, smtp_port, smtp_secure, from_email_address, sender_name, provider, is_enabled FROM user_email_configs WHERE user_id = ?",
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ message: "Failed to check email config" });
      if (!rows.length) {
        return res.json({ hasConfig: false });
      }
      res.json({ hasConfig: true, config: rows[0] });
    }
  );
});

/* ================= TEST SMTP CONNECTION API ================= */
router.post("/test-smtp-connection", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { email_user, email_pass, smtp_host, smtp_port, smtp_secure, provider } = req.body;

  let host = smtp_host;
  let port = smtp_port;
  let secure = smtp_secure;

  if (provider === "google") {
    host = "smtp.gmail.com";
    port = 465;
    secure = "true";
  } else if (provider === "yahoo") {
    host = "smtp.mail.yahoo.com";
    port = 465;
    secure = "true";
  }

  // Fallback to saved password if placeholder sent
  let finalPass = email_pass;
  if (!finalPass || finalPass === "••••••••••••••••") {
    try {
      const savedConfig = await new Promise((resolve, reject) => {
        db.query("SELECT email_pass FROM user_email_configs WHERE user_id = ?", [userId], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      if (savedConfig && savedConfig.length > 0) {
        finalPass = decrypt(savedConfig[0].email_pass);
      }
    } catch (e) {
      return res.status(500).json({ message: "Failed to fetch saved password" });
    }
  }

  if (!finalPass) {
    return res.status(400).json({ message: "Password / App Password is required to test connection." });
  }

  const result = await testSMTPConnection(host, port, secure, email_user, finalPass);
  if (result.success) {
    res.json({ success: true, message: "SMTP connection verified successfully!" });
  } else {
    res.status(400).json({ success: false, message: result.message, code: result.code });
  }
});

/* ================= SEND TEST EMAIL API ================= */
router.post("/send-test-email", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { email_user, email_pass, smtp_host, smtp_port, smtp_secure, from_email_address, sender_name, provider, recipient_email } = req.body;

  const toEmail = recipient_email ? recipient_email.trim() : email_user;
  if (!toEmail) {
    return res.status(400).json({ message: "Recipient email is required" });
  }

  let host = smtp_host;
  let port = smtp_port;
  let secure = smtp_secure;

  if (provider === "google") {
    host = "smtp.gmail.com";
    port = 465;
    secure = "true";
  } else if (provider === "yahoo") {
    host = "smtp.mail.yahoo.com";
    port = 465;
    secure = "true";
  }

  let finalPass = email_pass;
  if (!finalPass || finalPass === "••••••••••••••••") {
    try {
      const savedConfig = await new Promise((resolve, reject) => {
        db.query("SELECT email_pass FROM user_email_configs WHERE user_id = ?", [userId], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      if (savedConfig && savedConfig.length > 0) {
        finalPass = decrypt(savedConfig[0].email_pass);
      }
    } catch (e) {
      return res.status(500).json({ message: "Failed to fetch saved password" });
    }
  }

  if (!finalPass) {
    return res.status(400).json({ message: "Password / App Password is required to send test email." });
  }

  const secureMode = secure === "SSL/TLS" || Number(port) === 465 || secure === "true" || secure === true;
  const fromEmail = from_email_address || email_user;
  const sName = sender_name || "Madhura Tech SMTP Test";

  try {
    const transporter = nodemailer.createTransport({
      host: host,
      port: Number(port),
      secure: secureMode,
      auth: {
        user: email_user,
        pass: finalPass
      },
      tls: { rejectUnauthorized: false }
    });

    const mailOptions = {
      from: `"${sName}" <${fromEmail}>`,
      to: toEmail,
      subject: "Madhura Tech SMTP Configuration - Test Email",
      text: `Hello,\n\nThis is a test email from Madhura Tech to verify your SMTP settings. If you received this, your SMTP configuration is fully working!\n\nDetails:\nProvider: ${provider || "Custom"}\nSMTP Server: ${host}\nPort: ${port}\nSecure SSL: ${secureMode}\n\nRegards,\nMadhura Tech System`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e5e3df; border-radius: 8px; max-width: 600px; margin: 0 auto; background-color: #fcfcfc;">
          <h2 style="color: #5645d4; border-bottom: 2px solid #5645d4; padding-bottom: 10px;">Madhura Tech SMTP Settings Verification</h2>
          <p>Hello,</p>
          <p>This is a test email sent from your <strong>Madhura Tech SMTP settings dashboard</strong>.</p>
          <p style="background-color: #eafbf0; border-left: 4px solid #2bc460; padding: 12px; font-weight: bold; color: #1e7039;">
            ✓ Congratulations! Your SMTP Configuration is working flawlessly.
          </p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
            <tr style="border-bottom: 1px solid #e5e3df;"><td style="padding: 8px; font-weight: bold; width: 150px;">SMTP Provider</td><td style="padding: 8px; text-transform: capitalize;">${provider || "Custom"}</td></tr>
            <tr style="border-bottom: 1px solid #e5e3df;"><td style="padding: 8px; font-weight: bold;">SMTP Host</td><td style="padding: 8px;">${host}</td></tr>
            <tr style="border-bottom: 1px solid #e5e3df;"><td style="padding: 8px; font-weight: bold;">Port</td><td style="padding: 8px;">${port}</td></tr>
            <tr style="border-bottom: 1px solid #e5e3df;"><td style="padding: 8px; font-weight: bold;">SSL/TLS</td><td style="padding: 8px;">${secureMode ? "Enabled" : "Disabled"}</td></tr>
            <tr style="border-bottom: 1px solid #e5e3df;"><td style="padding: 8px; font-weight: bold;">Sender Name</td><td style="padding: 8px;">${sName}</td></tr>
            <tr style="border-bottom: 1px solid #e5e3df;"><td style="padding: 8px; font-weight: bold;">Sender Email</td><td style="padding: 8px;">${fromEmail}</td></tr>
          </table>
          <p style="margin-top: 20px; font-size: 12px; color: #787671;">This email was sent automatically as part of your system configuration test. You do not need to reply to this message.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: `Test email sent successfully to ${toEmail}!` });
  } catch (error) {
    console.error("Test email send failed:", error);
    res.status(400).json({ success: false, message: `Failed to send test email: ${error.message}` });
  }
});

/* ================= SAVE/UPDATE USER EMAIL SMTP CONFIG ================= */
router.post("/save-email-config", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { email_user, email_pass, smtp_host, smtp_port, smtp_secure, from_email_address, sender_name, provider, is_enabled } = req.body;

  // Fetch the user's email address first to auto-populate default if needed
  db.query("SELECT email FROM users WHERE id = ?", [userId], async (err, rows) => {
    if (err || !rows.length) {
      return res.status(500).json({ message: "Failed to find user email" });
    }
    const defaultEmailUser = rows[0].email;
    const finalEmailUser = email_user ? email_user.trim() : defaultEmailUser;
    
    let host = smtp_host;
    let port = smtp_port;
    let secure = smtp_secure;

    if (provider === "google") {
      host = "smtp.gmail.com";
      port = 465;
      secure = "true";
    } else if (provider === "yahoo") {
      host = "smtp.mail.yahoo.com";
      port = 465;
      secure = "true";
    } else {
      host = host ? host.trim() : "smtp.gmail.com";
      port = parseInt(port) || 587;
      secure = secure || "STARTTLS";
    }

    const finalFromEmail = from_email_address ? from_email_address.trim() : finalEmailUser;
    const finalSenderName = sender_name ? sender_name.trim() : "Madhura Tech";
    const finalProvider = provider || "custom";
    const finalEnabled = is_enabled !== undefined ? (is_enabled ? 1 : 0) : 1;

    // Check if an existing configuration exists to preserve password if placeholder is sent
    db.query("SELECT email_pass FROM user_email_configs WHERE user_id = ?", [userId], async (errExist, rowsExist) => {
      let finalPass = email_pass;
      let encryptedPass = "";
      let decryptedPass = "";

      if ((!finalPass || finalPass === "••••••••••••••••") && rowsExist && rowsExist.length > 0) {
        encryptedPass = rowsExist[0].email_pass;
        decryptedPass = decrypt(encryptedPass);
      } else if (finalPass && finalPass !== "••••••••••••••••") {
        decryptedPass = finalPass;
        encryptedPass = encrypt(finalPass);
      }

      if (!decryptedPass) {
        return res.status(400).json({ message: "SMTP Password or App Password is required" });
      }

      // If configuration is being enabled/saved for the first time, or password changed, validate it first!
      if (finalEnabled === 1) {
        const check = await testSMTPConnection(host, port, secure, finalEmailUser, decryptedPass);
        if (!check.success) {
          return res.status(400).json({ 
            message: `Verification failed: ${check.message}`, 
            code: check.code 
          });
        }
      }

      // Use INSERT ... ON DUPLICATE KEY UPDATE
      db.query(
        `INSERT INTO user_email_configs (user_id, email_user, email_pass, smtp_host, smtp_port, smtp_secure, from_email_address, sender_name, provider, is_enabled)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE email_user = ?, email_pass = ?, smtp_host = ?, smtp_port = ?, smtp_secure = ?, from_email_address = ?, sender_name = ?, provider = ?, is_enabled = ?`,
        [
          userId, finalEmailUser, encryptedPass, host, port, secure, finalFromEmail, finalSenderName, finalProvider, finalEnabled,
          finalEmailUser, encryptedPass, host, port, secure, finalFromEmail, finalSenderName, finalProvider, finalEnabled
        ],
        (err2) => {
          if (err2) {
            console.error("save-email-config db error:", err2);
            return res.status(500).json({ message: "Failed to save email configuration" });
          }
          res.json({ message: "Email SMTP configuration verified and saved successfully!" });
        }
      );
    });
  });
});

function insertRequest(userId, field, new_value, userName, res) {
  db.query(
    "INSERT INTO profile_change_requests (user_id, field, new_value, status) VALUES (?, ?, ?, 'pending')",
    [userId, field, new_value],
    (err, result) => {
      if (err) {
        console.error("insertRequest db error:", err);
        return res.status(500).json({ message: "Failed to submit change request" });
      }

      const requestId = result.insertId;
      const fieldLabel = fieldLabels[field] || field;
      const messageText = `${userName} requested profile change: ${fieldLabel}`;

      db.query(
        "INSERT INTO admin_notifications (type, user_id, message, related_id, related_type) VALUES ('profile_change_requested', ?, ?, ?, 'profile_change_requests')",
        [userId, messageText, requestId],
        (errNotif, resultNotif) => {
          const notificationIO = getNotificationIO();
          if (notificationIO) {
            notificationIO.sendToAdmin("new_notification", {
              dbId: resultNotif?.insertId || requestId,
              type: "profile_change_requested",
              timestamp: new Date().toISOString(),
              is_read: 0,
              data: {
                id: requestId,
                userId: userId,
                userName: userName,
                field: field,
                fieldLabel: fieldLabel,
                type: "profile",
                message: messageText
              },
              userId: userId,
              message: messageText
            });
          }
          res.json({ message: "Change request submitted successfully. Waiting for admin approval." });
        }
      );
    }
  );
}

router.get("/admin-email", verifyToken, (req, res) => {
  // Return the logged-in user's own email so that each tenant/company
  // gets their own admin email as CC — not a hardcoded first-row admin.
  db.query("SELECT email FROM users WHERE id = ?", [req.user.id], (err, rows) => {
    if (err || !rows.length) {
      return res.json({ email: "" });
    }
    res.json({ email: rows[0].email });
  });
});

/* ================= TOGGLE 2FA STATUS ================= */
router.post("/toggle-2fa", verifyToken, (req, res) => {
  const userId = req.user.id;
  const { isEnabled } = req.body;
  
  if (isEnabled === undefined) {
    return res.status(400).json({ message: "isEnabled status is required" });
  }

  const numericVal = isEnabled ? 1 : 0;

  db.query(
    "UPDATE users SET two_factor_enabled = ? WHERE id = ?",
    [numericVal, userId],
    (err) => {
      if (err) {
        console.error("toggle-2fa error:", err);
        return res.status(500).json({ message: "Failed to update 2FA configuration" });
      }
      res.json({ success: true, message: `Two-Factor Authentication successfully ${isEnabled ? 'enabled' : 'disabled'}!`, isEnabled });
    }
  );
});

/* ================= VERIFY 2FA OTP CODE ================= */
router.post("/verify-2fa", (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ message: "Email and OTP passcode are required" });
  }

  const emailLower = email.trim().toLowerCase();

  db.query(
    "SELECT * FROM email_otp WHERE email=? AND otp=? AND expires_at > NOW()",
    [emailLower, otp],
    (err, rows) => {
      if (err) {
        console.error("verify-2fa select error:", err);
        return res.status(500).json({ message: "Verification failed due to server error" });
      }

      if (!rows.length) {
        return res.status(401).json({ message: "Invalid or expired verification code" });
      }

      // Cleanup OTP
      db.query("DELETE FROM email_otp WHERE email=?", [emailLower]);

      // Fetch user profile and issue token
      db.query(
        "SELECT id, first_name, email, role, status FROM users WHERE email=?",
        [emailLower],
        (err2, userRows) => {
          if (err2 || !userRows.length) {
            return res.status(404).json({ message: "Associated account not found" });
          }

          const user = userRows[0];
          if (user.status !== "active") {
            return res.status(403).json({ message: "Account is not active" });
          }

          const token = jwt.sign({ id: user.id, role: user.role, name: user.first_name }, process.env.JWT_SECRET, { expiresIn: "14d" });
          res.json({
            token,
            user: { id: user.id, name: user.first_name, email: user.email, role: user.role }
          });
        }
      );
    }
  );
});

/* ================= RESEND 2FA OTP CODE ================= */
router.post("/resend-2fa", (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email required" });
  
  const emailLower = email.trim().toLowerCase();

  db.query(
    "SELECT id, email, status FROM users WHERE email=?",
    [emailLower],
    (err, rows) => {
      if (err || !rows.length) {
        return res.status(404).json({ message: "No account found with this email" });
      }

      const user = rows[0];
      if (user.status !== "active") return res.status(403).json({ message: "Account is not active" });

      const otp = generateOtp();
      const expires = new Date(Date.now() + 5 * 60000);

      db.query(
        `INSERT INTO email_otp (email, otp, expires_at)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE otp=?, expires_at=?`,
        [emailLower, otp, expires, otp, expires],
        async (dbErr) => {
          if (dbErr) {
            console.error("resend-2fa db error:", dbErr.message);
            return res.status(500).json({ message: "Failed to generate code" });
          }

          try {
            await sendEmailOtp(emailLower, otp, "Your Madhura Tech CRM 2FA Login Verification Code", true);
            res.json({ success: true, message: "A new 2FA verification code has been sent to your email!" });
          } catch (mailErr) {
            console.error("resend-2fa mail error:", mailErr.message);
            return res.status(500).json({ message: "Failed to send 2FA verification email" });
          }
        }
      );
    }
  );
});

/* ================= LOGOUT ================= */
router.post("/logout", verifyToken, (req, res) => {
  res.json({ success: true, message: "Logged out successfully" });
});

module.exports = router;
