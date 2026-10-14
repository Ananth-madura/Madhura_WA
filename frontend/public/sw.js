/*
 * Whatsapp_CRM service worker.
 *
 * ⚠️ READ BEFORE EDITING CACHE STRATEGIES
 *
 * This app holds WhatsApp conversations, contact phone numbers, invoices and
 * payment records. Two rules follow from that, and both are enforced below:
 *
 *   1. NEVER cache /api/** into CacheStorage. The previous version used
 *      NetworkFirst with a 24h TTL, which wrote conversation content and
 *      payment records to disk in the browser and kept serving them after a
 *      user logged out or after a record was deleted. That is a DPDP Act 2023 /
 *      GDPR problem and it also served stale business data. It is now
 *      NetworkOnly.
 *
 *   2. NEVER cache navigations. The old NetworkFirst/24h rule meant that after a
 *      Vercel deploy, users could be served yesterday's index.html - including
 *      a dead hashed JS bundle reference - for up to a day. Vercel's edge
 *      already caches the static assets correctly; the SW only made it worse.
 *      It is now NetworkOnly.
 *
 * Static assets ARE safe to cache because Create React App content-hashes every
 * file under /static/, so a changed file always has a changed name.
 */

importScripts("https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js");

workbox.setConfig({ debug: false });

const { registerRoute } = workbox.routing;
const { NetworkFirst, CacheFirst, StaleWhileRevalidate, NetworkOnly } =
  workbox.strategies;
const { ExpirationPlugin } = workbox.expiration;
const { CacheableResponsePlugin } = workbox.cacheableResponse;

const CACHE_NAMES = {
  static: "achme-static-v2",
  images: "achme-images-v2",
  googleFonts: "achme-fonts-v2",
  manifest: "achme-manifest-v2",
};

self.addEventListener("activate", (event) => {
  const valid = Object.values(CACHE_NAMES);
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => !valid.includes(key)).map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("install", () => {
  self.skipWaiting();
});

/* ── 1. Never touch the API ─────────────────────────────────────────────────── */
registerRoute(
  ({ url }) =>
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/uploads/") ||
    url.pathname.includes("socket.io"),
  new NetworkOnly()
);

/* ── 2. Never cache navigations ─────────────────────────────────────────────── */
registerRoute(({ request }) => request.mode === "navigate", new NetworkOnly());

/* ── 3. Content-hashed static assets: safe to cache forever ─────────────────── */
registerRoute(
  ({ request, url }) =>
    (request.destination === "script" ||
      request.destination === "style" ||
      request.destination === "font") &&
    // sw.js must stay uncached or a deploy can never ship a new worker.
    url.pathname !== "/sw.js" &&
    url.pathname !== "/service-worker.js",
  new CacheFirst({
    cacheName: CACHE_NAMES.static,
    plugins: [
      new ExpirationPlugin({ maxEntries: 120, maxAgeSeconds: 30 * 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

registerRoute(
  ({ request }) => request.destination === "image",
  new CacheFirst({
    cacheName: CACHE_NAMES.images,
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

registerRoute(
  ({ request }) => request.destination === "manifest",
  new StaleWhileRevalidate({
    cacheName: CACHE_NAMES.manifest,
    plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
  })
);

registerRoute(
  ({ url }) =>
    url.origin === "https://fonts.googleapis.com" ||
    url.origin === "https://fonts.gstatic.com",
  new StaleWhileRevalidate({
    cacheName: CACHE_NAMES.googleFonts,
    plugins: [
      new ExpirationPlugin({ maxEntries: 30 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

/* ── Push notifications (desktop alerts) ───────────────────────────────────── */
self.addEventListener("push", (event) => {
  let data = {
    title: "Madhura Tech CRM Notification",
    body: "You have a new update!",
  };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: "Madhura Tech CRM Notification", body: event.data.text() };
    }
  }

  const options = {
    body: data.body,
    icon: "/Group.png",
    badge: "/Group.png",
    data: { url: data.url || "/dashboard" },
    actions: [{ action: "open_url", title: "View Details" }],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (var i = 0; i < windowClients.length; i++) {
          var client = windowClients[i];
          if (client.url.includes(urlToOpen) && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) return clients.openWindow(urlToOpen);
      })
  );
});
