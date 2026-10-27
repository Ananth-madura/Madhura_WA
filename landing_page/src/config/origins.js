const clean = value => String(value || "").trim().replace(/\/+$/, "");
const isLocal = hostname => ["localhost", "127.0.0.1", "[::1]", "::1"].includes(hostname)
  || /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname);

export function resolveOrigin(configured, productionOrigin, port, location, production = false) {
  const local = location && isLocal(location.hostname);
  const fallback = local ? `${location.protocol}//${location.hostname}:${port}`
    : production ? productionOrigin : `http://localhost:${port}`;
  if (!clean(configured)) return fallback;
  try {
    const target = new URL(clean(configured));
    if (!["http:", "https:"].includes(target.protocol)) return fallback;
    if (isLocal(target.hostname) && location) {
      if (local) target.hostname = location.hostname;
      else if (production) return fallback;
    }
    return clean(target.href);
  } catch {
    return fallback;
  }
}
