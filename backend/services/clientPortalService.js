const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const SOURCES = { invoice: 'clientinvoices', quotation: 'quotations' };
const stamp = (date = new Date()) => date.toISOString().slice(0, 19).replace('T', ' ');
const fail = (status, message) => Object.assign(new Error(message), { status });
const text = (value, max) => String(value ?? '').trim().slice(0, max);
const money = (value) => value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
const safeUrl = (value) => { if (!value) return null; try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; } };

async function ensureClientPortalTables(db) {
  const sqlite = db.isSqlite;
  const id = sqlite ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'INT AUTO_INCREMENT PRIMARY KEY';
  const suffix = sqlite ? '' : ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4';
  const blob = sqlite ? 'BLOB' : 'LONGBLOB';
  const queries = [
    `CREATE TABLE IF NOT EXISTS client_portal_accounts (id ${id}, client_id INT NOT NULL, email VARCHAR(254) NOT NULL UNIQUE, password_hash VARCHAR(255), status VARCHAR(20) NOT NULL DEFAULT 'invited', session_version INT NOT NULL DEFAULT 1, created_by INT NOT NULL, created_at DATETIME NOT NULL, last_login_at DATETIME)${suffix}`,
    `CREATE TABLE IF NOT EXISTS client_portal_invites (token_hash VARCHAR(64) PRIMARY KEY, account_id INT NOT NULL, session_version INT NOT NULL, expires_at DATETIME NOT NULL, used_at DATETIME)${suffix}`,
    `CREATE TABLE IF NOT EXISTS client_portal_settings (id INT PRIMARY KEY, business_name VARCHAR(120) NOT NULL, welcome_text VARCHAR(500), accent_color VARCHAR(7), contact_email VARCHAR(254), contact_phone VARCHAR(40), show_invoices INT DEFAULT 1, show_quotations INT DEFAULT 1, allow_requests INT DEFAULT 1)${suffix}`,
    `CREATE TABLE IF NOT EXISTS client_portal_documents (id ${id}, client_id INT NOT NULL, kind VARCHAR(20) NOT NULL, source_id INT NOT NULL, title VARCHAR(200) NOT NULL, amount_override DECIMAL(14,2), payment_url TEXT, published_by INT NOT NULL, published_at DATETIME NOT NULL, file_name VARCHAR(200), file_mime VARCHAR(100), file_bytes ${blob}, UNIQUE(client_id, kind, source_id))${suffix}`,
    `CREATE TABLE IF NOT EXISTS client_portal_responses (document_id INT PRIMARY KEY, client_id INT NOT NULL, decision VARCHAR(20) NOT NULL, note VARCHAR(2000), responded_at DATETIME NOT NULL)${suffix}`,
    `CREATE TABLE IF NOT EXISTS client_portal_requests (id ${id}, client_id INT NOT NULL, subject VARCHAR(200) NOT NULL, category VARCHAR(40) NOT NULL, priority VARCHAR(20) NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'open', body TEXT NOT NULL, idempotency_key VARCHAR(100) NOT NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, UNIQUE(client_id, idempotency_key))${suffix}`,
    `CREATE TABLE IF NOT EXISTS client_portal_messages (id ${id}, request_id INT NOT NULL, client_id INT NOT NULL, sender_role VARCHAR(20) NOT NULL, sender_id INT NOT NULL, body TEXT NOT NULL, idempotency_key VARCHAR(100) NOT NULL, created_at DATETIME NOT NULL, UNIQUE(request_id, sender_role, sender_id, idempotency_key))${suffix}`
  ];
  for (const sql of queries) await db.promise().query(sql);
  await db.promise().query(`${sqlite ? 'INSERT OR IGNORE' : 'INSERT IGNORE'} INTO client_portal_settings (id, business_name, welcome_text, accent_color) VALUES (1, 'Madhura', 'Your documents, requests and updates in one place.', '#202C52')`);
}

function createClientPortalService(db, { secret = () => process.env.JWT_SECRET, clock = () => new Date() } = {}) {
  const query = async (sql, params = []) => (await db.promise().query(sql, params))[0];
  const one = async (sql, params) => (await query(sql, params))[0];
  const signingKey = () => { const value = secret(); if (!value) throw fail(503, 'Portal authentication is not configured'); return value; };
  const getClient = async (id) => {
    const row = await one('SELECT id, name, company_name, email, phone FROM clients WHERE id = ?', [id]);
    if (!row) throw fail(404, 'Client not found'); return row;
  };
  const settings = async () => await one('SELECT * FROM client_portal_settings WHERE id = 1', []);
  const publicSettings = async () => {
    const row = await settings();
    return { ...row, show_invoices: !!row.show_invoices, show_quotations: !!row.show_quotations, allow_requests: !!row.allow_requests };
  };
  const saveSettings = async (input) => {
    const name = text(input.business_name, 120), color = String(input.accent_color || '#202C52');
    if (!name || !/^#[a-f0-9]{6}$/i.test(color)) throw fail(400, 'Business name and a valid accent color are required');
    const channels = [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16) / 255).map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    const luminance = channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
    if (1.05 / (luminance + .05) < 4.5) throw fail(400, 'Choose a darker accent color so button text stays readable');
    if (input.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.contact_email)) throw fail(400, 'Enter a valid contact email');
    await query('UPDATE client_portal_settings SET business_name=?, welcome_text=?, accent_color=?, contact_email=?, contact_phone=?, show_invoices=?, show_quotations=?, allow_requests=? WHERE id=1',
      [name, text(input.welcome_text, 500), color, text(input.contact_email, 254), text(input.contact_phone, 40), input.show_invoices === false ? 0 : 1, input.show_quotations === false ? 0 : 1, input.allow_requests === false ? 0 : 1]);
    return publicSettings();
  };
  const session = (account) => ({ token: jwt.sign({ id: account.id, client_id: account.client_id, role: 'client', portal: true, version: account.session_version }, signingKey(), { algorithm: 'HS256', audience: 'client-portal', issuer: 'whatsapp-crm-portal', expiresIn: '8h' }), user: { id: account.id, client_id: account.client_id, email: account.email } });
  const verifySession = async (token) => {
    let claims;
    try { claims = jwt.verify(token, signingKey(), { algorithms: ['HS256'], audience: 'client-portal', issuer: 'whatsapp-crm-portal' }); } catch (error) { if (error.status) throw error; throw fail(401, 'Please sign in to your client portal'); }
    if (claims.role !== 'client' || !claims.portal) throw fail(401, 'Invalid portal session');
    const account = await one('SELECT * FROM client_portal_accounts WHERE id = ?', [claims.id]);
    if (!account || account.status !== 'active' || account.client_id !== claims.client_id || account.session_version !== claims.version) throw fail(401, 'Your portal session has expired or access was revoked');
    await getClient(account.client_id); return account;
  };
  const invite = async (clientId, emailValue, staffId) => {
    await getClient(clientId);
    const email = text(emailValue, 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw fail(400, 'A valid client email is required');
    let account = await one('SELECT * FROM client_portal_accounts WHERE email = ?', [email]);
    if (account && account.client_id !== clientId) throw fail(409, 'This email already belongs to a different portal client');
    if (!account) {
      try { await query("INSERT INTO client_portal_accounts (client_id, email, status, created_by, created_at) VALUES (?, ?, 'invited', ?, ?)", [clientId, email, staffId, stamp(clock())]); }
      catch (error) { if (!(await one('SELECT id FROM client_portal_accounts WHERE email = ?', [email]))) throw error; }
      account = await one('SELECT * FROM client_portal_accounts WHERE email = ?', [email]);
      if (account.client_id !== clientId) throw fail(409, 'This email already belongs to another client');
    }
    await query("UPDATE client_portal_accounts SET session_version=session_version+1, status='invited', password_hash=NULL WHERE id=?", [account.id]);
    account = await one('SELECT * FROM client_portal_accounts WHERE id = ?', [account.id]);
    const token = crypto.randomBytes(32).toString('hex'), expiresAt = stamp(new Date(clock().getTime() + 48 * 60 * 60 * 1000));
    await query('INSERT INTO client_portal_invites (token_hash, account_id, session_version, expires_at) VALUES (?, ?, ?, ?)', [crypto.createHash('sha256').update(token).digest('hex'), account.id, account.session_version, expiresAt]);
    return { token, email, expires_at: expiresAt, account_id: account.id };
  };
  const activate = async (tokenValue, password) => {
    if (typeof password !== 'string' || password.length < 12 || password.length > 128) throw fail(400, 'Use a password between 12 and 128 characters');
    const token = String(tokenValue || '');
    if (!/^[a-f0-9]{64}$/.test(token)) throw fail(400, 'Invalid invitation link');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const invitation = await one('SELECT i.*, a.client_id, a.email, a.status, a.session_version AS current_version FROM client_portal_invites i JOIN client_portal_accounts a ON a.id=i.account_id WHERE i.token_hash=? AND i.used_at IS NULL AND i.expires_at > ?', [hash, stamp(clock())]);
    if (!invitation || invitation.status !== 'invited' || invitation.current_version !== invitation.session_version) throw fail(410, 'This invitation has expired or was already used. Ask your account team for a new link');
    // Hash before bcrypt to support Unicode and long passwords without its 72-byte truncation.
    const passwordHash = 'sha256:' + await bcrypt.hash(crypto.createHash('sha256').update(password).digest('hex'), 12);
    const result = await query("UPDATE client_portal_accounts SET password_hash=?, status='active', last_login_at=? WHERE id=? AND session_version=? AND status='invited' AND password_hash IS NULL", [passwordHash, stamp(clock()), invitation.account_id, invitation.session_version]);
    if (!result.affectedRows) throw fail(410, 'This invitation was already used');
    await query('UPDATE client_portal_invites SET used_at=? WHERE token_hash=?', [stamp(clock()), hash]);
    return session(await one('SELECT * FROM client_portal_accounts WHERE id=?', [invitation.account_id]));
  };
  const login = async (emailValue, password) => {
    const account = await one('SELECT * FROM client_portal_accounts WHERE email=?', [text(emailValue, 254).toLowerCase()]);
    const dummy = '$2b$12$FvUQkRLbRoIIFbhHZQQx.eOftzEVweIKqwIj5x.wolANOT9IsMfma';
    const supplied = typeof password === 'string' && password.length <= 128 ? password : '';
    const hashed = account?.password_hash || dummy;
    const matches = await bcrypt.compare(hashed.startsWith('sha256:') ? crypto.createHash('sha256').update(supplied).digest('hex') : supplied, hashed.replace(/^sha256:/, ''));
    if (!account || account.status !== 'active' || !matches) throw fail(401, 'Email or password is incorrect');
    await query('UPDATE client_portal_accounts SET last_login_at=? WHERE id=?', [stamp(clock()), account.id]); return session(account);
  };
  const revoke = async (accountId) => { await query("UPDATE client_portal_accounts SET status='disabled', session_version=session_version+1 WHERE id=?", [accountId]); };
  const logout = async (account) => { await query('UPDATE client_portal_accounts SET session_version=session_version+1 WHERE id=?', [account.id]); };
  const listClients = async (searchValue = '', pageValue = 1) => {
    const search = '%' + text(searchValue, 100) + '%', page = Math.max(1, Number(pageValue) || 1);
    const where = 'WHERE name LIKE ? OR company_name LIKE ? OR email LIKE ?';
    const total = (await one(`SELECT COUNT(*) AS total FROM clients ${where}`, [search, search, search])).total;
    const rows = await query(`SELECT id, name, company_name, email, phone FROM clients ${where} ORDER BY name, id LIMIT 50 OFFSET ?`, [search, search, search, (page - 1) * 50]);
    return { clients: rows, total, page };
  };
  const publish = async (clientId, input, staffId) => {
    await getClient(clientId);
    const kind = input.kind, sourceId = Number(input.source_id), title = text(input.title, 200);
    if (input.confirm_client !== true) throw fail(400, 'Confirm that this source record belongs to the selected client');
    if (!Object.hasOwn(SOURCES, kind) || !Number.isSafeInteger(sourceId) || sourceId < 1 || !title) throw fail(400, 'Choose a document type, record ID and title');
    if (!(await one(`SELECT id FROM ${SOURCES[kind]} WHERE id=?`, [sourceId]))) throw fail(404, 'The source document was not found in this database');
    if (input.payment_url && (!safeUrl(input.payment_url) || kind !== 'invoice')) throw fail(400, 'Payment links must be HTTPS and apply to an invoice');
    const amount = money(input.amount_override);
    if (input.amount_override != null && input.amount_override !== '' && (amount == null || amount < 0)) throw fail(400, 'The fallback amount must be a positive number');
    const existing = await one('SELECT id FROM client_portal_documents WHERE client_id=? AND kind=? AND source_id=?', [clientId, kind, sourceId]);
    if (existing) throw fail(409, 'This document is already published to this client');
    const result = await query('INSERT INTO client_portal_documents (client_id, kind, source_id, title, amount_override, payment_url, published_by, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [clientId, kind, sourceId, title, amount, safeUrl(input.payment_url), staffId, stamp(clock())]);
    return { id: result.insertId };
  };
  const sourceRecord = async (kind, sourceId) => {
    if (!Object.hasOwn(SOURCES, kind)) throw fail(400, 'Invalid document type');
    const source = await one(`SELECT * FROM ${SOURCES[kind]} WHERE id=?`, [sourceId]);
    if (!source) throw fail(404, 'Source document not found');
    return { kind, id: source.id, reference: source.reference_no || String(source.id), client_company: source.client_company || null, amount: money(source.grand_total ?? source.total_amount ?? source.total ?? source.amount), status: source.payment_status || source.status || 'Not provided', due_date: source.invoice_duedate || source.due_date || null };
  };
  const getDocument = async (clientId, documentId, enforceVisibility = true) => {
    const row = await one('SELECT id, client_id, kind, source_id, title, amount_override, payment_url, published_at, file_name, file_mime FROM client_portal_documents WHERE id=? AND client_id=?', [documentId, clientId]);
    if (!row) throw fail(404, 'Document not found');
    const config = await settings();
    if (enforceVisibility && !(row.kind === 'invoice' ? config.show_invoices : config.show_quotations)) throw fail(404, 'Document not available');
    const source = await one(`SELECT * FROM ${SOURCES[row.kind]} WHERE id=?`, [row.source_id]);
    const response = await one('SELECT decision, note, responded_at FROM client_portal_responses WHERE document_id=? AND client_id=?', [row.id, clientId]);
    return normalizeDocument(row, source, response);
  };
  function normalizeDocument(row, source, response) {
    const amount = money(source?.grand_total ?? source?.total_amount ?? source?.total ?? source?.amount ?? row.amount_override);
    return { id: row.id, kind: row.kind, title: row.title, reference: source?.reference_no || String(row.source_id), amount, due_date: source?.invoice_duedate || source?.due_date || null, date: source?.invoice_date || source?.quotation_date || null, status: source?.payment_status || source?.status || 'Not provided', available: !!source, published_at: row.published_at, payment_url: source && row.kind === 'invoice' ? safeUrl(row.payment_url) : null, file_name: row.file_name, response: response || null };
  }
  const documents = async (clientId, enforceVisibility = true) => {
    const config = await settings();
    const rows = await query('SELECT id, client_id, kind, source_id, title, amount_override, payment_url, published_at, file_name FROM client_portal_documents WHERE client_id=? ORDER BY published_at DESC, id DESC LIMIT 200', [clientId]);
    const visible = rows.filter((row) => !enforceVisibility || (row.kind === 'invoice' ? config.show_invoices : config.show_quotations));
    const records = new Map();
    for (const kind of Object.keys(SOURCES)) {
      const ids = [...new Set(visible.filter((row) => row.kind === kind).map((row) => row.source_id))];
      if (!ids.length) continue;
      const sources = await query('SELECT * FROM ' + SOURCES[kind] + ' WHERE id IN (' + ids.map(() => '?').join(',') + ')', ids);
      for (const record of sources) records.set(kind + ':' + record.id, record);
    }
    const responses = await query('SELECT document_id, decision, note, responded_at FROM client_portal_responses WHERE client_id=?', [clientId]);
    const responseMap = new Map(responses.map((row) => [row.document_id, row]));
    return visible.map((row) => normalizeDocument(row, records.get(row.kind + ':' + row.source_id), responseMap.get(row.id)));
  };

  const respond = async (clientId, documentId, input) => {
    const document = await getDocument(clientId, documentId);
    if (document.kind !== 'quotation' || !document.available) throw fail(409, 'This document cannot receive a quotation response');
    if (!['accepted', 'declined'].includes(input.decision)) throw fail(400, 'Choose accept or decline');
    const prior = await one('SELECT decision FROM client_portal_responses WHERE document_id=? AND client_id=?', [documentId, clientId]);
    if (prior) { if (prior.decision === input.decision) return getDocument(clientId, documentId); throw fail(409, 'A response is already recorded. Contact your account team to change it'); }
    try { await query('INSERT INTO client_portal_responses (document_id, client_id, decision, note, responded_at) VALUES (?, ?, ?, ?, ?)', [documentId, clientId, input.decision, text(input.note, 2000), stamp(clock())]); }
    catch (error) { const saved = await one('SELECT decision FROM client_portal_responses WHERE document_id=? AND client_id=?', [documentId, clientId]); if (!saved || saved.decision !== input.decision) throw fail(409, 'A response is already recorded'); }
    return getDocument(clientId, documentId);
  };
  const attach = async (clientId, documentId, file) => {
    await getDocument(clientId, documentId, false);
    if (!file || file.mimetype !== 'application/pdf' || file.buffer.subarray(0, 5).toString() !== '%PDF-') throw fail(400, 'Upload a valid PDF document');
    const filename = text(file.originalname.replace(/[\\/]/g, '_'), 180);
    await query('UPDATE client_portal_documents SET file_name=?, file_mime=?, file_bytes=? WHERE id=? AND client_id=?', [filename, 'application/pdf', file.buffer, documentId, clientId]);
  };
  const download = async (clientId, documentId) => {
    await getDocument(clientId, documentId);
    const row = await one('SELECT file_name, file_mime, file_bytes FROM client_portal_documents WHERE id=? AND client_id=?', [documentId, clientId]);
    if (!row?.file_bytes) throw fail(404, 'No PDF has been attached to this document'); return { ...row, file_bytes: Buffer.from(row.file_bytes) };
  };
  const unpublish = async (clientId, documentId) => { await getDocument(clientId, documentId, false); await query('DELETE FROM client_portal_documents WHERE id=? AND client_id=?', [documentId, clientId]); };
  const requestRow = async (clientId, requestId) => { const row = await one('SELECT * FROM client_portal_requests WHERE id=? AND client_id=?', [requestId, clientId]); if (!row) throw fail(404, 'Request not found'); return row; };
  const requests = async (clientId) => query('SELECT id, subject, category, priority, status, body, created_at, updated_at FROM client_portal_requests WHERE client_id=? ORDER BY updated_at DESC, id DESC LIMIT 100', [clientId]);
  const createRequest = async (clientId, input) => {
    if (typeof input.body !== 'string' || input.body.length > 8000) throw fail(400, 'Request details must contain up to 8,000 characters');
    const subject = text(input.subject, 200), body = text(input.body, 8000), key = text(input.idempotency_key, 100);
    const category = ['service', 'billing', 'quotation', 'other'].includes(input.category) ? input.category : 'service';
    const priority = ['normal', 'urgent'].includes(input.priority) ? input.priority : 'normal';
    if (!subject || !body || !key) throw fail(400, 'Subject, details and request key are required');
    const existing = await one('SELECT * FROM client_portal_requests WHERE client_id=? AND idempotency_key=?', [clientId, key]);
    if (existing) { if (existing.subject !== subject || existing.body !== body) throw fail(409, 'This submission key belongs to a different request'); return existing; }
    if (!(await settings()).allow_requests) throw fail(403, 'New service requests are currently paused. Contact your account team');
    try { const result = await query("INSERT INTO client_portal_requests (client_id, subject, category, priority, status, body, idempotency_key, created_at, updated_at) VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?)", [clientId, subject, category, priority, body, key, stamp(clock()), stamp(clock())]); return requestRow(clientId, result.insertId); }
    catch (error) { const saved = await one('SELECT * FROM client_portal_requests WHERE client_id=? AND idempotency_key=?', [clientId, key]); if (saved && saved.subject === subject && saved.body === body) return saved; throw error; }
  };
  const thread = async (clientId, requestId, before) => {
    const request = await requestRow(clientId, requestId), beforeId = Number(before) || Number.MAX_SAFE_INTEGER;
    const rows = await query('SELECT id, sender_role, body, created_at FROM client_portal_messages WHERE request_id=? AND client_id=? AND id < ? ORDER BY id DESC LIMIT 51', [requestId, clientId, beforeId]);
    return { request, messages: rows.slice(0, 50).reverse(), has_more: rows.length > 50 };
  };
  const reply = async (clientId, requestId, input, actor) => {
    const request = await requestRow(clientId, requestId);
    if (typeof input.body !== 'string' || input.body.length > 8000) throw fail(400, 'Replies must contain up to 8,000 characters');
    const body = text(input.body, 8000), key = text(input.idempotency_key, 100);
    if (!body || !key) throw fail(400, 'A reply and submission key are required');
    const existing = await one('SELECT id, body FROM client_portal_messages WHERE request_id=? AND sender_role=? AND sender_id=? AND idempotency_key=?', [requestId, actor.role, actor.id, key]);
    if (existing) { if (existing.body !== body) throw fail(409, 'This submission key belongs to another reply'); return thread(clientId, requestId); }
    if (actor.role === 'client' && (!(await settings()).allow_requests || ['resolved', 'closed'].includes(request.status))) throw fail(409, 'This request is not accepting replies. Contact your account team');
    try { await query('INSERT INTO client_portal_messages (request_id, client_id, sender_role, sender_id, body, idempotency_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [requestId, clientId, actor.role, actor.id, body, key, stamp(clock())]); }
    catch (error) { const saved = await one('SELECT body FROM client_portal_messages WHERE request_id=? AND sender_role=? AND sender_id=? AND idempotency_key=?', [requestId, actor.role, actor.id, key]); if (!saved || saved.body !== body) throw error; }
    await query('UPDATE client_portal_requests SET updated_at=? WHERE id=? AND client_id=?', [stamp(clock()), requestId, clientId]); return thread(clientId, requestId);
  };
  const updateRequest = async (clientId, requestId, status) => {
    await requestRow(clientId, requestId);
    if (!['open', 'in_progress', 'waiting_for_client', 'resolved', 'closed'].includes(status)) throw fail(400, 'Invalid request status');
    await query('UPDATE client_portal_requests SET status=?, updated_at=? WHERE id=? AND client_id=?', [status, stamp(clock()), requestId, clientId]); return requestRow(clientId, requestId);
  };
  const dashboard = async (clientId) => ({ client: await getClient(clientId), settings: await publicSettings(), documents: await documents(clientId), requests: await requests(clientId), refreshed_at: stamp(clock()) });
  const staffClient = async (clientId) => ({ client: await getClient(clientId), accounts: await query('SELECT id, email, status, created_at, last_login_at FROM client_portal_accounts WHERE client_id=?', [clientId]), documents: await documents(clientId, false), requests: await requests(clientId) });
  return { publicSettings, saveSettings, verifySession, invite, activate, login, revoke, logout, listClients, publish, sourceRecord, getDocument, respond, attach, download, unpublish, createRequest, thread, reply, updateRequest, dashboard, staffClient };
}
module.exports = { ensureClientPortalTables, createClientPortalService };
