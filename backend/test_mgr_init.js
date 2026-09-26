const mgr = require('./services/whatsappService');

async function run() {
  console.log('Testing mgr.get("test_debug")...');
  const s = mgr.get('test_debug');
  s.client = null;
  s.ready = false;
  s.isInitializing = false;
  s.qrCode = null;

  console.log('Calling s.getQr(30000)...');
  const t0 = Date.now();
  const qr = await s.getQr(30000);
  console.log(`Finished after ${Date.now() - t0}ms. QR received:`, Boolean(qr), qr ? qr.slice(0, 30) : null);
  if (s.client) {
    await s.client.destroy().catch(() => {});
  }
  process.exit(0)
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
