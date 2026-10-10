const assert = require('assert/strict'), fs = require('fs'), vm = require('vm');
const { DatabaseSync } = require('node:sqlite');
const express = require('express'), request = require('supertest'), jwt = require('jsonwebtoken');
process.env.JWT_SECRET = 'isolated-portal-regression-secret-over-32-characters';
const storage = new DatabaseSync(':memory:');
storage.exec(`CREATE TABLE clients (id INTEGER PRIMARY KEY, name TEXT, company_name TEXT, email TEXT, phone TEXT);
CREATE TABLE clientinvoices (id INTEGER PRIMARY KEY, client_company TEXT, grand_total REAL, invoice_date TEXT, invoice_duedate TEXT, status TEXT);
CREATE TABLE quotations (id INTEGER PRIMARY KEY, client_company TEXT, reference_no TEXT, grand_total REAL, quotation_date TEXT, status TEXT);
INSERT INTO clients VALUES (1,'Client A','Company A','a@example.test','1111111111'), (2,'Client B','Company B','b@example.test','2222222222');
INSERT INTO clientinvoices VALUES (10,'Company A',1200,'2026-10-01','2026-10-20','Unpaid'), (20,'Company B',4000,'2026-10-01','2026-10-20','Paid');
INSERT INTO quotations VALUES (100,'Company A','QUOTE-100',3500,'2026-10-01','Pending');`);
let queries = 0;
const database = { isSqlite: true, promise: () => ({ query: async (sql, params = []) => {
  queries++;
  const statement = storage.prepare(sql);
  if (/^\s*SELECT/i.test(sql)) return [statement.all(...params)];
  const result = statement.run(...params); return [{ affectedRows: result.changes, insertId: Number(result.lastInsertRowid) }];
} }) };
const serviceModule = require('../services/clientPortalService');
const middleware = require('../middleware/authMiddleware');
const routeModule = { exports: {} };
vm.runInNewContext(fs.readFileSync(require.resolve('../routes/clientPortalRoutes'), 'utf8'), {
  module: routeModule, console, Buffer,
  require: (name) => name === '../config/database' ? database : name === '../middleware/authMiddleware' ? middleware
    : name === '../middleware/waRateLimiter' ? { createRateLimiter: () => (req, res, next) => next() }
    : name === '../services/clientPortalService' ? serviceModule : require(name)
});
const app = express(); app.use(express.json()); app.use('/api/client-portal', routeModule.exports);
const root = '/api/client-portal';
const staff = jwt.sign({ id: 99, role: 'admin' }, process.env.JWT_SECRET);
const bearer = (token) => ({ Authorization: `Bearer ${token}` });
const get = (path, token) => request(app).get(root + path).set(bearer(token));
const post = (path, body, token = staff) => request(app).post(root + path).set(bearer(token)).send(body);
async function invite(client, email) {
  const result = await post(`/admin/clients/${client}/invitations`, { email }); assert.equal(result.status, 201); return result.body;
}
(async () => {
  assert.equal((await get('/dashboard', staff)).status, 401, 'Staff JWT cannot impersonate a client');
  const invitation = await invite(1, 'a@example.test');
  assert.equal(invitation.token.length, 64);
  assert.notEqual(storage.prepare('SELECT token_hash FROM client_portal_invites').get().token_hash, invitation.token);
  let result = await post('/auth/activate', { token: invitation.token, password: 'client-password-123' });
  assert.equal(result.status, 200); const clientA = result.body.token;
  assert.equal((await post('/auth/activate', { token: invitation.token, password: 'overwrite-password-123' })).status, 410);
  assert.equal((await post('/auth/login', { email: 'a@example.test', password: 'wrong-password' })).status, 401);
  assert.equal((await post('/admin/clients/1/invitations', { email: 'another@example.test' }, clientA)).status, 403, 'Client token never grants staff authority');
  const invitationB = await invite(2, 'b@example.test');
  const clientB = (await post('/auth/activate', { token: invitationB.token, password: 'client-password-456' })).body.token;
  assert.equal((await post('/admin/clients/1/invitations', { email: 'b@example.test' })).status, 409);
  const publish = async (client, kind, source) => {
    const result = await post(`/admin/clients/${client}/documents`, { kind, source_id: source, title: `${kind} ${source}`, confirm_client: true });
    assert.equal(result.status, 201); return result.body.id;
  };
  const invoiceA = await publish(1, 'invoice', 10), invoiceB = await publish(2, 'invoice', 20), quoteA = await publish(1, 'quotation', 100);
  assert.equal((await get(`/documents/${invoiceB}`, clientA)).status, 404);
  let dashboard = (await get('/dashboard', clientA)).body;
  assert.equal(dashboard.documents.length, 2); assert(dashboard.documents.every((document) => document.id !== invoiceB));
  storage.prepare('UPDATE clientinvoices SET grand_total=1500, status=? WHERE id=10').run('Paid');
  dashboard = (await get('/dashboard', clientA)).body;
  assert.equal(dashboard.documents.find((document) => document.id === invoiceA).amount, 1500);
  assert.equal(dashboard.documents.find((document) => document.id === invoiceA).status, 'Paid');
  const before = queries; await get('/dashboard', clientA); assert(queries - before < 15, 'Dashboard uses bounded batch queries');
  result = await post(`/documents/${quoteA}/response`, { decision: 'accepted', note: 'Please proceed' }, clientA); assert.equal(result.status, 200);
  assert.equal((await post(`/documents/${quoteA}/response`, { decision: 'accepted' }, clientA)).status, 200);
  assert.equal((await post(`/documents/${quoteA}/response`, { decision: 'declined' }, clientA)).status, 409);
  assert.equal((await post(`/documents/${quoteA}/response`, { decision: 'accepted' }, clientB)).status, 404);
  const pdf = Buffer.from('%PDF-1.7\nfixture document');
  result = await request(app).post(`${root}/admin/clients/1/documents/${invoiceA}/file`).set(bearer(staff)).attach('file', pdf, { filename: 'invoice.pdf', contentType: 'application/pdf' }); assert.equal(result.status, 200);
  result = await get(`/documents/${invoiceA}/download`, clientA); assert.equal(result.status, 200); assert.equal(result.headers['content-type'], 'application/pdf'); assert.equal(result.body.toString(), pdf.toString());
  assert.equal((await get(`/documents/${invoiceA}/download`, clientB)).status, 404);
  const draft = { subject: 'Service needed', body: 'Please check the installation', category: 'service', idempotency_key: 'request-key' };
  result = await post('/requests', draft, clientA); assert.equal(result.status, 201); const requestId = result.body.id;
  assert.equal((await post('/requests', draft, clientA)).body.id, requestId);
  assert.equal(storage.prepare('SELECT COUNT(*) AS count FROM client_portal_requests').get().count, 1);
  assert.equal((await get(`/requests/${requestId}`, clientB)).status, 404);
  await post(`/requests/${requestId}/replies`, { body: 'A client update', idempotency_key: 'reply-key' }, clientA);
  await post(`/requests/${requestId}/replies`, { body: 'A client update', idempotency_key: 'reply-key' }, clientA);
  await post(`/admin/clients/1/requests/${requestId}/replies`, { body: 'Your visit is scheduled', idempotency_key: 'staff-reply' });
  result = await get(`/requests/${requestId}`, clientA); assert.equal(result.body.messages.length, 2); assert.equal(result.body.messages[1].sender_role, 'staff');
  await request(app).patch(`${root}/admin/clients/1/requests/${requestId}`).set(bearer(staff)).send({ status: 'resolved' });
  assert.equal((await post(`/requests/${requestId}/replies`, { body: 'Blocked reply', idempotency_key: 'another' }, clientA)).status, 409);
  await request(app).put(`${root}/admin/settings`).set(bearer(staff)).send({ business_name: 'Trading Co', accent_color: '#202C52', show_invoices: false, allow_requests: false });
  assert.equal((await get(`/documents/${invoiceA}/download`, clientA)).status, 404);
  assert.equal((await post('/requests', { ...draft, idempotency_key: 'disabled' }, clientA)).status, 403);
  const claims = jwt.verify(clientA, process.env.JWT_SECRET);
  await post(`/admin/accounts/${claims.id}/revoke`, {});
  assert.equal((await get('/dashboard', clientA)).status, 401);
  let staffAccepted = false;
  middleware.verifyToken({ headers: bearer(clientB) }, { status() { return this; }, json() {} }, () => { staffAccepted = true; });
  assert.equal(staffAccepted, false);
  const { authenticateSocket } = require('../sockets/socketAuth'); let socketError;
  authenticateSocket({ handshake: { auth: { token: clientB } }, data: {} }, (error) => { socketError = error; }); assert(socketError);
  storage.close(); console.log('PASS: real portal lifecycle, current source records, client isolation, PDF ownership, quote decisions, request/reply idempotency, revoked sessions and staff/socket separation');
  process.exit(0);
})().catch((error) => { console.error(error); storage.close(); process.exit(1); });
