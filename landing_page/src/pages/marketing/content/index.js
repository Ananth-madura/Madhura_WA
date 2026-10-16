/* Content registry ------------------------------------------------------------------
   Aggregates every public marketing page, derives the route table, the section
   index redirects, legacy aliases and the sitemap. App.jsx consumes ROUTES and
   ALIASES; nothing else needs to know where a page's data lives.

   Every module contributes entries that share one shape (path / section /
   renderer / meta / hero / …). Anything a module leaves out is filled in here,
   so a new page only has to say what makes it different:
     • meta.title        → derived from hero.title when absent
     • meta.description  → derived from hero.subtitle when absent
     • cta               → the shared pre-footer conversion band
     • related           → up to three siblings from the same section
   --------------------------------------------------------------------------------- */

import { PRODUCT_PAGES } from "./product.js";
import { PRODUCT_EXTRA_PAGES } from "./productExtra.js";
import { COMPANY_PAGES } from "./company.js";
import { COMPANY_EXTRA_PAGES } from "./companyExtra.js";
import { LEGAL_PAGES } from "./legal.js";
import { DOCS_PAGE } from "./docs.js";
import { SOLUTION_PAGES, INDUSTRY_PAGES } from "./solutions.js";
import { FEATURE_PAGES } from "./features.js";
import { PLATFORM_PAGES } from "./platform.js";
import { DEVELOPER_PAGES } from "./developers.js";
import { RESOURCE_PAGES } from "./resources.js";
import { SUPPORT_PAGES } from "./support.js";
import { TRUST_PAGES } from "./trust.js";
import { LEGAL_EXTRA_PAGES } from "./legalExtra.js";
import { SECTION_INDEX, LEGACY_ALIASES } from "../siteNav.js";

const RAW_PAGES = [
  ...PRODUCT_PAGES,
  ...Object.values(PRODUCT_EXTRA_PAGES),
  ...COMPANY_PAGES,
  ...COMPANY_EXTRA_PAGES,
  ...LEGAL_PAGES,
  ...Object.values(LEGAL_EXTRA_PAGES),
  DOCS_PAGE,
  ...FEATURE_PAGES,
  ...SOLUTION_PAGES,
  ...INDUSTRY_PAGES,
  ...PLATFORM_PAGES,
  ...DEVELOPER_PAGES,
  ...RESOURCE_PAGES,
  ...Object.values(SUPPORT_PAGES),
  ...Object.values(TRUST_PAGES),
];

const DEFAULT_CTA = {
  title: "Ready to transform your WhatsApp customer engagement?",
  sub: "Bring every WhatsApp conversation into one accountable workspace — sales, support and marketing, on the numbers you already own.",
  primary: { label: "Start free trial", to: "/signup" },
  secondary: { label: "Book a demo", to: "/demo" },
};

const clean = (value) => (value || "").replace(/\s+/g, " ").trim();

/** Strip the " | Madhura" / " — Madhura" suffix we append to every <title>. */
const bareTitle = (value) => clean(value).split(" — ")[0].split(" | ")[0].trim();

const applyDefaults = (page) => {
  const hero = page.hero || null;
  const sourceTitle = bareTitle(hero?.title) || bareTitle(page.document?.title) || page.path;
  const description =
    page.meta?.description || clean(hero?.subtitle || page.document?.subtitle) || undefined;

  return {
    ...page,
    meta: {
      ...page.meta,
      title: page.meta?.title || `${sourceTitle} | Madhura`,
      ...(description ? { description } : {}),
    },
    cta: page.cta || DEFAULT_CTA,
  };
};

const withDefaults = (pages) => {
  const resolved = pages.map(applyDefaults);

  /* Second pass: related pages default to same-section siblings, so a page
     that never declares `related` still ends the visit with a next step. */
  return resolved.map((page) => {
    if (Array.isArray(page.related)) return page;
    const siblings = resolved
      .filter((other) => other.path !== page.path && other.section === page.section)
      .slice(0, 3)
      .map((other) => other.path);
    return { ...page, related: siblings };
  });
};

export const MARKETING_PAGES = withDefaults(RAW_PAGES);

/* Duplicate paths are a silent 404 generator: the second page becomes
   unreachable and the footer points at whichever one wins. Fail loudly. */
const seenPaths = new Set();
MARKETING_PAGES.forEach((page) => {
  if (seenPaths.has(page.path)) {
    // eslint-disable-next-line no-console
    console.error(`[content] duplicate page path: ${page.path}`);
  }
  seenPaths.add(page.path);
});

export const PAGE_BY_PATH = MARKETING_PAGES.reduce((acc, page) => {
  acc[page.path] = page;
  return acc;
}, {});

export const getPageByPath = (pathname) => {
  if (!pathname) return null;
  const cleanPath = pathname.replace(/\/+$/, "") || "/";
  return PAGE_BY_PATH[cleanPath] || null;
};

/** Explicit paths, so every URL is a real route rather than a catch-all. */
export const ROUTES = MARKETING_PAGES.map((page) => page.path);

/** /product, /company and /legal resolve to their first child page. */
export const SECTION_ROUTES = Object.entries(SECTION_INDEX);

/** Old and short URLs that must keep working. */
export const ALIASES = { ...LEGACY_ALIASES };

/** Helper for the related-pages rail: returns content objects, dropping unknowns. */
export const resolveRelated = (paths = []) =>
  paths.map((p) => PAGE_BY_PATH[p]).filter(Boolean);
