"use strict";

const bcrypt = require("bcryptjs");
const { createInboxService } = require("./sharedInboxService");
const { createWorkspaceSessionService } = require("./workspaceSession");
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const cleanCode = value => {
  if (typeof value !== "string" || !value.trim() || value.length > 100) throw fail("Enter a valid workspace access code.");
  return value.trim().toUpperCase();
};

function createEmployeeAccessService(db) {
  const resolveSession = createWorkspaceSessionService(db);
  const query = async (sql, params = []) => (await db.promise().query(sql, params))[0];
  const find = async (code, read, lock = false) => {
    const users = await read(`SELECT id,first_name,email,role,status,user_password,tenant_id,whatsapp_access_level,two_factor_enabled
      FROM users WHERE UPPER(access_code)=? LIMIT 2${lock ? " FOR UPDATE" : ""}`, [code]);
    if (users.length !== 1) throw fail("Invalid access code. Ask your organization administrator for a current code.", 404);
    const user = users[0];
    if (!["pending", "active"].includes(user.status)) throw fail("This account is not active. Contact your organization administrator.", 403);
    return user;
  };
  return {
    async preview(value) {
      const user = await find(cleanCode(value), query);
      const session = await resolveSession({ ...user, status: "active" });
      return { valid: true, ...session.user, first_name: user.first_name, account_status: user.status, requires_activation: user.status === "pending" || !user.user_password };
    },
    async join(input) {
      const code = cleanCode(input.access_code);
      if (typeof input.email !== "string" || !input.email.trim()) throw fail("Email address is required.");
      if (typeof input.password !== "string" || input.password.length < 6 || Buffer.byteLength(input.password) > 72) throw fail("Use a password of 6 to 72 bytes.");
      if (input.full_name != null && (typeof input.full_name !== "string" || input.full_name.trim().length > 100)) throw fail("Enter a name of 100 characters or fewer.");
      const email = input.email.trim().toLowerCase();
      return createInboxService(db).transaction(async read => {
        const user = await find(code, read, true);
        if (!user.email || user.email.toLowerCase() !== email) throw fail("Use the email address assigned to this access code.");
        const activating = user.status === "pending" || !user.user_password;
        if (user.status === "active" && user.two_factor_enabled) throw fail("Sign in from the login page to complete two-factor verification.", 403);
        if (!activating) {
          if (!(await bcrypt.compare(input.password, user.user_password))) throw fail("Incorrect password. Use your existing account password.", 401);
        }
        const profile = { ...user, status: "active", first_name: activating ? input.full_name?.trim() || user.first_name : user.first_name };
        const session = await resolveSession(profile, read);
        if (activating) {
          const hash = await bcrypt.hash(input.password, 10);
          await read("UPDATE users SET user_password=?,status='active',first_name=? WHERE id=? AND tenant_id=?", [hash, profile.first_name, user.id, user.tenant_id]);
          await read("UPDATE teammember SET first_name=? WHERE user_id=? AND tenant_id=?", [profile.first_name, user.id, user.tenant_id]);
        }
        return { ...session, message: activating ? "Your employee account is active. Welcome to your organization." : "Signed in to your organization." };
      });
    },
  };
}

module.exports = { createEmployeeAccessService };
