const crypto = require('crypto');
function verifySignature(rawBody, signature, secret) {
  if (!Buffer.isBuffer(rawBody) || typeof signature !== 'string' || !secret) return false;
  const expected = Buffer.from('sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex'));
  const received = Buffer.from(signature);
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}
async function authorizeWebhook(req, resolveAccount, env = process.env) {
  const allowUnsigned = env.NODE_ENV !== 'production' && env.WA_WEBHOOK_ALLOW_UNSIGNED === '1';
  const accounts = new Map();
  const values = (req.body?.entry || []).flatMap((entry) => (entry.changes || []).filter((change) => change.field === 'messages').map((change) => change.value));
  const signature = req.headers['x-hub-signature-256'];
  if (!values.length) {
    return { valid: verifySignature(req.rawBody, signature, env.WA_APP_SECRET) || allowUnsigned, accounts };
  }
  for (const value of values) {
    const id = value?.metadata?.phone_number_id;
    if (!id) return { valid: false, accounts };
    let account = accounts.get(id);
    if (!account) {
      account = await resolveAccount(id);
      if (!account) return { valid: false, accounts };
      account.phoneNumberId = id;
      accounts.set(id, account);
    }
    if (!verifySignature(req.rawBody, signature, account.appSecret) && !allowUnsigned) return { valid: false, accounts };
  }
  return { valid: true, accounts };
}
module.exports = { verifySignature, authorizeWebhook };
