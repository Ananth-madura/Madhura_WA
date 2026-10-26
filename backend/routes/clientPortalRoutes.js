const express = require('express');
const multer = require('multer');
const db = require('../config/database');
const { verifyToken, isAdminOnly } = require('../middleware/authMiddleware');
const { createRateLimiter } = require('../middleware/waRateLimiter');
const { ensureClientPortalTables, createClientPortalService } = require('../services/clientPortalService');

function createClientPortalRouter(database = db, { staffAuth = verifyToken, adminOnly = isAdminOnly, limiter = createRateLimiter, serviceOptions = {} } = {}) {
  const router = express.Router(), service = createClientPortalService(database, serviceOptions);
  let ready;
  const initialize = () => ready || (ready = ensureClientPortalTables(database).catch((error) => { ready = null; throw error; }));
  const handle = (fn) => async (req, res) => { try { await fn(req, res); } catch (error) { res.status(error.status || 503).json({ error: error.status ? error.message : 'The portal service is temporarily unavailable. Please try again' }); } };
  router.use(async (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
    try { await initialize(); next(); } catch (error) { res.status(503).json({ error: 'Portal storage is unavailable' }); }
  });
  const authLimit = limiter({ category: 'client_portal_login', maxRequests: 10, windowMs: 15 * 60 * 1000 });
  const writeLimit = limiter({ category: 'client_portal_write', maxRequests: 30, windowMs: 60 * 1000 });
  const portalAuth = async (req, res, next) => {
    try {
      const header = req.headers.authorization || '';
      req.portalAccount = await service.verifySession(header.startsWith('Bearer ') ? header.slice(7) : '');
      next();
    } catch (error) { res.status(error.status || 503).json({ error: error.status ? error.message : 'Portal authentication is temporarily unavailable' }); }
  };
  const id = (value) => { const parsed = Number(value); if (!Number.isSafeInteger(parsed) || parsed < 1) throw Object.assign(new Error('Invalid record ID'), { status: 400 }); return parsed; };
  router.get('/settings', handle(async (req, res) => res.json(await service.publicSettings())));
  router.post('/auth/login', authLimit, handle(async (req, res) => res.json(await service.login(req.body.email, req.body.password))));
  router.post('/auth/activate', authLimit, handle(async (req, res) => res.json(await service.activate(req.body.token, req.body.password))));
  router.post('/auth/logout', portalAuth, handle(async (req, res) => { await service.logout(req.portalAccount); res.json({ success: true }); }));
  router.get('/dashboard', portalAuth, handle(async (req, res) => res.json(await service.dashboard(req.portalAccount.client_id))));
  router.get('/documents/:id', portalAuth, handle(async (req, res) => res.json(await service.getDocument(req.portalAccount.client_id, id(req.params.id)))));
  router.post('/documents/:id/response', portalAuth, writeLimit, handle(async (req, res) => res.json(await service.respond(req.portalAccount.client_id, id(req.params.id), req.body))));
  router.get('/documents/:id/download', portalAuth, handle(async (req, res) => {
    const file = await service.download(req.portalAccount.client_id, id(req.params.id));
    res.setHeader('Content-Type', file.file_mime); res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.file_name)}`); res.send(file.file_bytes);
  }));
  router.post('/requests', portalAuth, writeLimit, handle(async (req, res) => res.status(201).json(await service.createRequest(req.portalAccount.client_id, req.body))));
  router.get('/requests/:id', portalAuth, handle(async (req, res) => res.json(await service.thread(req.portalAccount.client_id, id(req.params.id), req.query.before))));
  router.post('/requests/:id/replies', portalAuth, writeLimit, handle(async (req, res) => res.json(await service.reply(req.portalAccount.client_id, id(req.params.id), req.body, { role: 'client', id: req.portalAccount.id }))));

  const admin = express.Router();
  admin.use(staffAuth, (req, res, next) => req.user?.role === 'platform_admin' ? next() : adminOnly(req, res, next));
  admin.use(require('../middleware/tenantMiddleware').requireTenantContext);
  admin.use(async (req, res, next) => {
    try {
      if (!['organization_owner', 'organization_admin'].includes(req.userRole) && req.user.role !== 'platform_admin') return res.status(403).json({ error: 'Organization administrator required' });
      const client = req.path.match(/^\/clients\/(\d+)(?:\/|$)/);
      if (client) {
        const [rows] = await database.promise().query('SELECT id FROM clients WHERE id=? AND tenant_id=?', [Number(client[1]), req.tenantId]);
        if (!rows.length) return res.status(404).json({ error: 'Client not found' });
      }
      const account = req.path.match(/^\/accounts\/(\d+)\/revoke$/);
      if (account) {
        const [rows] = await database.promise().query('SELECT a.id FROM client_portal_accounts a JOIN clients c ON c.id=a.client_id WHERE a.id=? AND c.tenant_id=?', [Number(account[1]), req.tenantId]);
        if (!rows.length) return res.status(404).json({ error: 'Account not found' });
      }
      const source = req.path.match(/^\/sources\/(invoice|quotation)\/(\d+)$/);
      const sourceKind = source?.[1] || (req.method === 'POST' && /\/documents$/.test(req.path) ? req.body.kind : null);
      if (sourceKind) {
        const table = { invoice: 'clientinvoices', quotation: 'quotations' }[sourceKind];
        if (!table) return res.status(400).json({ error: 'Invalid document type' });
        const [rows] = await database.promise().query(`SELECT id FROM ${table} WHERE id=? AND tenant_id=?`, [Number(source?.[2] || req.body.source_id), req.tenantId]);
        if (!rows.length) return res.status(404).json({ error: 'Source document not found' });
      }
      if (req.path === '/settings' && req.user.role !== 'platform_admin') return res.status(403).json({ error: 'Shared portal settings require a platform administrator' });
      next();
    } catch (_) { res.status(503).json({ error: 'Portal organization scope is unavailable' }); }
  });
  admin.get('/clients', handle(async (req, res) => res.json(await service.listClients(req.query.q, req.query.page, req.tenantId))));
  admin.get('/clients/:clientId', handle(async (req, res) => res.json(await service.staffClient(id(req.params.clientId)))));
  admin.get('/sources/:kind/:id', handle(async (req, res) => res.json(await service.sourceRecord(req.params.kind, id(req.params.id)))));
  admin.post('/clients/:clientId/invitations', writeLimit, handle(async (req, res) => res.status(201).json(await service.invite(id(req.params.clientId), req.body.email, req.user.id))));
  admin.post('/accounts/:id/revoke', handle(async (req, res) => { await service.revoke(id(req.params.id)); res.json({ success: true }); }));
  admin.put('/settings', handle(async (req, res) => res.json(await service.saveSettings(req.body))));
  admin.post('/clients/:clientId/documents', handle(async (req, res) => res.status(201).json(await service.publish(id(req.params.clientId), req.body, req.user.id))));
  admin.delete('/clients/:clientId/documents/:id', handle(async (req, res) => { await service.unpublish(id(req.params.clientId), id(req.params.id)); res.json({ success: true }); }));
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
  admin.post('/clients/:clientId/documents/:id/file', upload.single('file'), handle(async (req, res) => { await service.attach(id(req.params.clientId), id(req.params.id), req.file); res.json({ success: true }); }));
  admin.get('/clients/:clientId/requests/:id', handle(async (req, res) => res.json(await service.thread(id(req.params.clientId), id(req.params.id), req.query.before))));
  admin.patch('/clients/:clientId/requests/:id', handle(async (req, res) => res.json(await service.updateRequest(id(req.params.clientId), id(req.params.id), req.body.status))));
  admin.post('/clients/:clientId/requests/:id/replies', handle(async (req, res) => res.json(await service.reply(id(req.params.clientId), id(req.params.id), req.body, { role: 'staff', id: req.user.id }))));
  router.use('/admin', admin);
  router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) return res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'PDF files must be smaller than 10 MB' : 'The file upload could not be accepted' });
    next(error);
  });
  return router;
}
module.exports = createClientPortalRouter();
module.exports.createClientPortalRouter = createClientPortalRouter;
