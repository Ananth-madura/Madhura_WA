"use strict";
require("./isolateSqlite")();
process.env.USE_SQLITE = "1";
process.env.JWT_SECRET = "team-chat-local-integration-test-secret-2026";
const db = require("../../config/database");
const express = require("express");
const http = require("node:http");
const jwt = require("jsonwebtoken");

async function createHarness() {
  await db.ready;
  await require("../../migrations/team_chat").migrate(db);
  const q = async (sql, params = []) => (await db.promise().query(sql, params))[0];
  const users = [];
  const [adminRow] = await q("SELECT id, first_name, last_name, role FROM users WHERE id = 1");
  const admin = { id: 1, name: [adminRow.first_name, adminRow.last_name].filter(Boolean).join(" "), role: adminRow.role, tenant_id: 1, token: jwt.sign({ id: 1, role: adminRow.role, tenant_id: 1 }, process.env.JWT_SECRET, { expiresIn: "1h" }) };
  for (const name of ["Arun", "Priya"]) {
    const result = await q("INSERT INTO users (first_name, last_name, email, role, status, tenant_id) VALUES (?, 'QA', ?, 'employee', 'active', 1)", [name, `${name.toLowerCase()}-team-qa@example.test`]);
    const id = Number(result.insertId);
    await q("INSERT INTO organization_memberships (tenant_id, user_id, role, membership_status) VALUES (1, ?, 'agent', 'active')", [id]);
    await q("INSERT INTO staff_branch_memberships (tenant_id, user_id, branch_id, is_primary) VALUES (1, ?, 1, 1)", [id]);
    users.push({ id, name: `${name} QA`, first_name: name, role: "employee", tenant_id: 1, token: jwt.sign({ id, role: "employee", tenant_id: 1 }, process.env.JWT_SECRET, { expiresIn: "1h" }) });
  }
  const app = express();
  app.use(express.json());
  app.use("/api/v2/team-chat", require("../../routes/teamChatRoutes"));
  app.use("/api/v2", require("../../routes/enterpriseOrganizationRoutes"));
  const server = http.createServer(app);
  const io = require("../../sockets/chatsockets").initSocket(server);
  app.set("io", io);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const request = async (user, method, route, body) => {
    const response = await fetch(`${origin}/api/v2/team-chat${route}`, { method, headers: { Authorization: `Bearer ${user.token}`, "x-tenant-id": "1", "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json() };
  };
  return { app, io, server, origin, users, admin, request, q, close: () => new Promise((resolve) => io.close(() => server.close(resolve))) };
}
module.exports = { createHarness };
