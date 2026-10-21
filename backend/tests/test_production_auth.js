const assert = require('assert/strict');
const jwt = require('jsonwebtoken');
process.env.JWT_SECRET = 'test-only-auth-secret-with-more-than-32-characters';
const { verifyToken } = require('../middleware/authMiddleware');
const { authenticateSocket } = require('../sockets/socketAuth');
function rest(token) {
  let accepted = false, status;
  verifyToken({ headers: { authorization: `Bearer ${token}` } }, {
    status(code) { status = code; return this; }, json() {}
  }, () => { accepted = true; });
  return { accepted, status };
}
function socket(token) {
  let rejected;
  const s = { handshake: { auth: { token } }, data: {} };
  authenticateSocket(s, (err) => { rejected = err; });
  return { accepted: !rejected, user: s.data.user };
}
const claims = { id: 42, role: 'admin' };
const valid = jwt.sign(claims, process.env.JWT_SECRET);
const attacks = ['demo-anything', 'demo-jwt-admin-token', jwt.sign(claims, 'wrong-secret'), jwt.sign(claims, process.env.JWT_SECRET, { expiresIn: -1 }), jwt.sign(claims, '', { algorithm: 'none' })];
for (const token of attacks) {
  assert.equal(rest(token).accepted, false);
  assert.equal(socket(token).accepted, false);
}
assert(rest(valid).accepted);
assert(socket(valid).accepted);
delete process.env.JWT_SECRET;
assert.equal(rest(valid).accepted, false);
assert.equal(socket(valid).accepted, false);
const { applyDefaults } = require('../config/runtimeDefaults');
const env = { NODE_ENV: 'production', REQUIRE_HARD_CONFIG: '1' };
applyDefaults(env);
assert.equal(env.JWT_SECRET, undefined, 'Production requires a stable configured secret');
assert.equal(env.ALLOW_START_WITHOUT_DB, undefined);
// Execute the real login route bodies without a database or email sender.
const fs = require('fs'), vm = require('vm');
const source = fs.readFileSync(require.resolve('../routes/authRoutes'), 'utf8');
const handlers = new Map();
process.env.JWT_SECRET = 'test-only-auth-secret-with-more-than-32-characters';
process.env.DEFAULT_TEST_PASSWORD = 'old-master-password';

// Slice boundaries must stay in sync with authRoutes.js. Everything the two
// handlers under test reference lives either in this context or in code above
// the slice, so a missing binding here is a broken fixture, not a broken route.
const sliceStart = source.indexOf('router.post("/demo-login"');
const sliceEnd = source.indexOf('/* ================= ADMIN: CREATE USER');
if (sliceStart < 0 || sliceEnd < 0 || sliceEnd <= sliceStart) {
  throw new Error('authRoutes slice markers not found - update tests/test_production_auth.js');
}

const emptyBranch = { id: 1, name: 'Head Office (Main)', code: 'HQ-01', is_head_office: 1 };
const organizationService = {
  getOrganizationDetails: async () => null,
  getUserOrganizations: async (userId) => [{ id: 1, name: 'Madhura Primary Organization', plan: 'growth' }],
  getBranches: async () => [emptyBranch],
};
const tenantPlanService = {
  getTenantById: async () => ({ id: 1, name: 'Workspace', plan: 'growth' }),
  getAvailablePlans: () => [],
};

vm.runInNewContext(source.slice(sliceStart, sliceEnd), {
  router: {
    post: (path, ...callbacks) => handlers.set(path, callbacks.at(-1)),
    get: (path, ...callbacks) => handlers.set(path, callbacks.at(-1)),
  },
  verifyToken: (req, res, next) => next && next(),
  isAdmin: (req, res, next) => next && next(),
  loginLimiter: () => {}, process, jwt, console,
  bcrypt: { compare: (password, hash, callback) => callback(null, password === 'actual-user-password') },
  db: { query: (sql, values, callback) => callback(null, [{ id: 42, first_name: 'User', email: 'fixture@example.test', status: 'active', role: 'employee', two_factor_enabled: false, tenant_id: 1 }]) },
  organizationService,
  tenantPlanService,
  queryAsync: async () => [],
  generateOtp: () => '123456',
  sendEmailOtp: async () => {},
  getNotificationIO: () => null,
  encrypt: (value) => value,
  decrypt: (value) => value,
  nodemailer: { createTransport: () => ({ sendMail: async () => {} }) },
  // Defined above the slice; the real implementation refuses to sign when the
  // secret is missing, which is exactly what the fixture must reproduce.
  requireJwtSecret: (res) => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      res.status(503).json({ success: false, code: 'JWT_SECRET_REQUIRED', message: 'Authentication is not configured' });
      return null;
    }
    return secret;
  },
});

// Both handlers respond after awaits (organization + branch resolution), so a
// synchronous read would see an empty body and report a false failure.
async function route(path, body) {
  let status = 200, result;
  handlers.get(path)({ body }, { status(code) { status = code; return this; }, json(value) { result = value; } });
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  return { status, result };
}

(async () => {
  // Dev: one-click demo workspace still works.
  const devDemo = await route('/demo-login', {});
  assert.equal(devDemo.status, 200);
  assert(devDemo.result.token, 'demo-login issues a token outside production');
  assert.equal(devDemo.result.user.demoMode, true);

  // Production: the public demo admin login must be unreachable. It signs a
  // real 14-day JWT with no password and no MFA, so a live deployment would
  // hand admin access to anyone who can POST to it.
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  const prodDemo = await route('/demo-login', {});
  assert.equal(prodDemo.status, 403, 'demo-login is disabled in production');
  assert(!prodDemo.result || !prodDemo.result.token, 'production demo-login never returns a token');
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;

  // The old universal master password must not authenticate.
  const badPassword = await route('/login', { email: 'fixture@example.test', password: process.env.DEFAULT_TEST_PASSWORD });
  assert.equal(badPassword.status, 401);

  const goodPassword = await route('/login', { email: 'fixture@example.test', password: 'actual-user-password' });
  assert(goodPassword.result?.token, 'a real password still authenticates');
  assert.equal(goodPassword.result.user.tenant_id, 1, 'login carries organization context');

  console.log('PASS: REST/socket reject forged, expired and demo tokens; production secrets are never invented');
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
