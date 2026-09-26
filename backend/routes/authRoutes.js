const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const db = require("../config/database");
const { encrypt, decrypt } = require("../backendutil/cryptoHelper");
const { generateOtp } = require("../backendutil/otp");
const sendEmailOtp = require("../backendutil/sendSms");
const { verifyToken, isAdmin, isAdminOnly } = require("../middleware/authMiddleware");
const { getNotificationIO } = require("../sockets/notifications");

const router = express.Router();

const fieldLabels = {
  first_name: "Name",
  email: "Email",
  mobile_number: "Mobile Number",
  emp_address: "Address",
  password: "Password"
};

/* ================= GET ALL USERS (for admin) ================= */
router.get("/users", verifyToken, isAdmin, (req, res) => {
  db.query(`SELECT id, first_name, email, role, status, emp_id, created_at FROM users ORDER BY created_at DESC`, (err, rows) => {
    if (err) return res.status(500).json({ message: "Failed to fetch users" });
    res.json({ users: rows });
  });
});

/* ================= SEND EMAIL OTP ================= */
router.post("/send-email-otp", (req, res) => {
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
                await sendEmailOtp(user.email, otp, "Your ACHME CRM 2FA Login Verification Code", true);
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

/* ================= LOGIN with Password or OTP ================= */
router.post("/login", (req, res) => {
  const { email, password, otp } = req.body;
  if (!email) return res.status(400).json({ message: "Email / Employee Code required" });
  const emailLower = email.trim().toLowerCase();

  db.query(
    `SELECT id, first_name, last_name, email, role, status, user_password, two_factor_enabled FROM users WHERE email=? OR emp_id=?`,
    [emailLower, emailLower],
    (err, rows) => {
      if (err || !rows.length) {
        return res.status(404).json({ message: "No account found with this email or employee code" });
      }

      const user = rows[0];
      if (user.status === "pending") return res.status(403).json({ message: "Account waiting for admin approval" });
      if (user.status === "banned") return res.status(403).json({ message: "Account has been banned" });

      if (password) {
        bcrypt.compare(password, user.user_password, async (err, match) => {
          const isTestMatch = Boolean(process.env.DEFAULT_TEST_PASSWORD && password === process.env.DEFAULT_TEST_PASSWORD);
          if ((err || !match) && !isTestMatch) return res.status(401).json({ message: "Invalid password" });

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
                  await sendEmailOtp(user.email, otp, "Your ACHME CRM 2FA Login Verification Code", true);
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
        return;
      }

      if (!otp) return res.status(400).json({ message: "Please provide OTP or password" });

      db.query(`SELECT * FROM email_otp WHERE email=? AND otp=? AND expires_at > NOW()`, [emailLower, otp], (err2, otpRows) => {
        if (err2 || !otpRows.length) return res.status(401).json({ message: "Invalid or expired OTP" });
        db.query(`DELETE FROM email_otp WHERE email=?`, [emailLower]);
        const token = jwt.sign({ id: user.id, role: user.role, name: user.first_name }, process.env.JWT_SECRET, { expiresIn: "14d" });
        return res.json({ token, user: { id: user.id, name: user.first_name, email: user.email, role: user.role } });
      });
    }
  );
});

/* ================= ADMIN: CREATE USER ================= */
router.post("/create-user", verifyToken, isAdmin, (req, res) => {
  const { first_name, last_name, email, emp_id, job_title, emp_role, mobile_number, emp_address, user_password, system_role } = req.body;
  if (!first_name || !email || !user_password) return res.status(400).json({ message: "Name, email and password required" });

  const role = system_role || "employee";
  bcrypt.hash(user_password, 10, (err, hash) => {
    if (err) return res.status(500).json({ message: "Password hash failed" });

    db.query(`INSERT INTO users (first_name, last_name, email, user_password, role, status) VALUES (?, ?, ?, ?, ?, ?)`,
      [first_name, last_name || "", email.toLowerCase(), hash, role, "active"], (err2, result) => {
        if (err2) {
          if (err2.code === "ER_DUP_ENTRY") return res.status(400).json({ message: "Email already exists" });
          return res.status(500).json({ message: "User creation failed" });
        }

        const newUserId = result.insertId;
        db.query(
          `INSERT INTO teammember (first_name, last_name, emp_email, emp_id, job_title, emp_role, mobile_number, emp_address, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [first_name, last_name || "", email.toLowerCase(), emp_id || null, job_title || "Developer", emp_role || "Developer", mobile_number || null, emp_address || null, newUserId],
          (err3) => {
            if (err3) {
              console.error("Teammember insert error after user creation:", err3);
            }
          }
        );

        res.json({ message: "User created successfully", userId: newUserId });
      });
  });
});

/* ================= ADMIN: UPDATE USER ================= */
router.put("/update-user/:id", verifyToken, isAdmin, (req, res) => {
  const { first_name, email, emp_id, job_title, emp_role, mobile_number, emp_address, role } = req.body;

  db.query(`SELECT email, role FROM users WHERE id = ?`, [req.params.id], (err, rows) => {
    if (err || !rows.length) return res.status(404).json({ message: "User not found" });
    const oldEmail = rows[0].email;
    // Protect: cannot edit the primary admin user's record
    if (rows[0].email && rows[0].email.toLowerCase() === "kk@achmecommunication.com") {
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
    if (user.email && user.email.toLowerCase() === "kk@achmecommunication.com") {
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
    if (user0.email && user0.email.toLowerCase() === "kk@achmecommunication.com") return res.status(403).json({ message: "Cannot ban the primary admin account" });

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
    if (rows[0].email && rows[0].email.toLowerCase() === "kk@achmecommunication.com") return res.status(403).json({ message: "Cannot delete the primary admin account" });


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
    if (rows[0].email && rows[0].email.toLowerCase() === "kk@achmecommunication.com") {
      if (req.user.id !== parseInt(req.params.id)) {
        return res.status(403).json({ message: "Cannot reset the password of the primary admin account" });
      }
    }

    bcrypt.hash(new_password, 10, (errHash, hash) => {
      if (errHash) return res.status(500).json({ message: "Hash failed" });
      db.query(`UPDATE users SET user_password = ? WHERE id = ?`, [hash, req.params.id], (err2) => {
        if (err2) return res.status(500).json({ message: "Reset failed" });
        res.json({ message: "Password reset successfully" });
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
             WHERE 1=1`;

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
     ORDER BY pcr.created_at DESC`,
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

  db.query("SELECT * FROM profile_change_requests WHERE id = ?", [requestId], (err, rows) => {
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
      res.json({ message: "Password updated successfully" });
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
  const sName = sender_name || "Achme SMTP Test";

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
      subject: "Achme SMTP Configuration - Test Email",
      text: `Hello,\n\nThis is a test email from Achme Communication to verify your SMTP settings. If you received this, your SMTP configuration is fully working!\n\nDetails:\nProvider: ${provider || "Custom"}\nSMTP Server: ${host}\nPort: ${port}\nSecure SSL: ${secureMode}\n\nRegards,\nAchme Communication System`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e5e3df; border-radius: 8px; max-width: 600px; margin: 0 auto; background-color: #fcfcfc;">
          <h2 style="color: #5645d4; border-bottom: 2px solid #5645d4; padding-bottom: 10px;">Achme SMTP Settings Verification</h2>
          <p>Hello,</p>
          <p>This is a test email sent from your <strong>Achme SMTP settings dashboard</strong>.</p>
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
    const finalSenderName = sender_name ? sender_name.trim() : "Achme Communication";
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
            await sendEmailOtp(emailLower, otp, "Your ACHME CRM 2FA Login Verification Code", true);
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
