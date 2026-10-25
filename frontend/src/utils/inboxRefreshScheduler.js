export function createInboxRefreshScheduler({ run, visible, connected, random = Math.random, onlineMs = 120000, offlineMs = 30000, coalesceMs = 750 }) {
  let timer, due = Infinity, stopped = false, running = false, pending = false;
  const later = delay => {
    if (stopped) return;
    const target = Date.now() + delay;
    if (timer && due <= target) return;
    clearTimeout(timer);due = target;
    timer = setTimeout(tick, delay);
  };
  const interval = () => Math.round((connected() ? onlineMs : offlineMs) * (0.9 + random() * 0.2));
  async function tick() {
    timer = null;due = Infinity;
    if (stopped) return;
    if (!visible()) { later(interval());return; }
    running = true;pending = false;
    try { await run(); }
    catch (_) { /* The caller displays request errors; the next poll can recover. */ }
    finally {
      running = false;
      if (!stopped) later(pending ? coalesceMs : interval());
    }
  }
  return {
    request(immediate = false) {
      if (stopped) return;
      if (running) { pending = true;return; }
      if (visible()) later(immediate ? 0 : coalesceMs);
    },
    stop() { stopped = true;clearTimeout(timer); },
  };
}
