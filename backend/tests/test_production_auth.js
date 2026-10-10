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
const env = { NODE_ENV: 'production' };
applyDefaults(env);
assert.equal(env.JWT_SECRET, undefined, 'Production requires a stable configured secret');
assert.equal(env.ALLOW_START_WITHOUT_DB, undefined);
// Execute the real login route bodies without a database or email sender.
const fs = require('fs'), vm = require('vm');
const source = fs.readFileSync(require.resolve('../routes/authRoutes'), 'utf8');
const handlers = new Map();
process.env.JWT_SECRET = 'test-only-auth-secret-with-more-than-32-characters';
process.env.DEFAULT_TEST_PASSWORD = 'old-master-password';
vm.runInNewContext(source.slice(source.indexOf('// Demo previews'), source.indexOf('/* ================= ADMIN: CREATE USER')), {
  router: {
    post: (path, ...callbacks) => handlers.set(path, callbacks.at(-1)),
    get: (path, ...callbacks) => handlers.set(path, callbacks.at(-1)),
  },
  verifyToken: (req, res, next) => next && next(),
  isAdmin: (req, res, next) => next && next(),
  loginLimiter: () => {}, process, jwt,
  bcrypt: { compare: (password, hash, callback) => callback(null, password === 'actual-user-password') },
  db: { query: (sql, values, callback) => callback(null, [{ id: 42, first_name: 'User', email: 'fixture@example.test', status: 'active', role: 'employee', two_factor_enabled: false }]) }
});
function route(path, body) {
  let status = 200, result;
  handlers.get(path)({ body }, { status(code) { status = code; return this; }, json(value) { result = value; } });
  return { status, result };
}
assert.equal(route('/demo-login', {}).status, 200);
assert(route('/demo-login', {}).result.token);
assert.equal(route('/login', { email: 'fixture@example.test', password: process.env.DEFAULT_TEST_PASSWORD }).status, 401);
assert(route('/login', { email: 'fixture@example.test', password: 'actual-user-password' }).result.token);
console.log('PASS: REST/socket reject forged, expired and demo tokens; production secrets are never invented');
