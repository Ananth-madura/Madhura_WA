import { useEffect } from "react";

/* Per-page document metadata -------------------------------------------------------
   React apps ship a single index.html, so every marketing URL needs its title,
   description and Open Graph tags injected on mount. Also updates the canonical
   link so duplicate aliases do not compete in search.
   --------------------------------------------------------------------------------- */

const META_NAME = "name";
const META_PROP = "property";

function upsertMeta(attribute, key, content) {
  if (!content) return;
  let el = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attribute, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertCanonical(href) {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export default function usePageMeta({ title, description, path, type = "website" }) {
  useEffect(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = path ? `${origin}${path}` : origin;

    if (title) document.title = title;
    upsertMeta(META_NAME, "description", description);
    upsertMeta(META_PROP, "og:title", title);
    upsertMeta(META_PROP, "og:description", description);
    upsertMeta(META_PROP, "og:url", url);
    upsertMeta(META_PROP, "og:type", type);
    if (url) upsertCanonical(url);
  }, [title, description, path, type]);
}
