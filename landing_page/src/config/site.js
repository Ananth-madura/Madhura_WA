/* ─────────────────────────────────────────────────────────────────────────────
   Cross-project link configuration.

   `landing_page` is a standalone Vite app (marketing site) and `frontend` is the
   authenticated CRA workspace. They are deployed separately, so anything that
   leaves the marketing site must be built from an absolute URL instead of a
   react-router `<Link>`.

   Dev defaults assume the documented local ports:
     frontend   http://localhost:3001
     landing    http://localhost:3002
   Override per environment with VITE_APP_URL / VITE_API_URL in `.env`.
   ───────────────────────────────────────────────────────────────────────────── */

const stripTrailingSlash = (value) => String(value || "").replace(/\/+$/, "");

export const APP_URL = stripTrailingSlash(
  import.meta.env.VITE_APP_URL || "http://localhost:3001"
);

export const API_URL = stripTrailingSlash(import.meta.env.VITE_API_URL || "");

/** Absolute URL inside the workspace app: appUrl("/login") → http://host/login */
export const appUrl = (path = "/") =>
  `${APP_URL}${path.startsWith("/") ? path : `/${path}`}`;

/** Absolute URL inside this marketing site: siteUrl("/pricing") → /pricing */
export const siteUrl = (path = "/") => `${import.meta.env.BASE_URL || "/"}${path.replace(/^\//, "")}`;

/**
 * The workspace keeps its session token in localStorage under the same key, so
 * once the two apps share a domain in production this reads correctly too.
 * In local dev the origins differ, which is why sign-in CTAs always point at
 * the workspace instead of guessing.
 */
export const isSignedIn = () => {
  try {
    return Boolean(window.localStorage.getItem("token"));
  } catch {
    return false;
  }
};

/** Mailto helper so sales/support CTAs are written once. */
export const mailto = (address, subject) =>
  `mailto:${address}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
