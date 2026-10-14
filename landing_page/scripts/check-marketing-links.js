/* Link integrity check for the marketing site (landing_page project).
   Walks every content entry + nav config and asserts each internal target is a
   known marketing path, a known workspace hand-off route, or a same-page anchor.
   Run: node scripts/check-marketing-links.js  (from landing_page/)            */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PAGES_DIR = path.join(ROOT, "src", "pages", "marketing");
const CONTENT_DIR = path.join(PAGES_DIR, "content");
const read = (p) => fs.readFileSync(p, "utf8");

// Every content module + the nav registry (single source of truth).
const files = [
  ...fs.readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith(".js") && f !== "index.js")
    .map((f) => path.join(CONTENT_DIR, f)),
  path.join(PAGES_DIR, "siteNav.js"),
];

// Collect every path literal declared as a route.
const pagePaths = new Set();
for (const file of files) {
  for (const m of read(file).matchAll(/path:\s*"([^"]+)"/g)) pagePaths.add(m[1]);
}

// Routes handled by the landing_page router itself (App.jsx), not content pages.
const APP_ROUTES = new Set([
  "/login", "/signup", "/whatsapp", "/portal",
]);

const problems = [];
const seen = new Set();

function checkTarget(target, where) {
  if (!target) return;
  if (target.startsWith("#") || target.startsWith("mailto:") || target.startsWith("http")) return;
  const clean = target.split("#")[0];
  if (!clean) return;
  if (pagePaths.has(clean) || APP_ROUTES.has(clean)) return;
  if (!seen.has(clean + "|" + where)) {
    seen.add(clean + "|" + where);
    problems.push(`${where} -> ${target}`);
  }
}

for (const file of files) {
  const text = read(file);
  const label = path.relative(ROOT, file);
  for (const m of text.matchAll(/to:\s*"([^"]+)"/g)) checkTarget(m[1], label);
}

console.log(`Registered marketing paths (${pagePaths.size}):`);
[...pagePaths].sort().forEach((p) => console.log("  " + p));

if (problems.length) {
  console.error("\nBROKEN LINK TARGETS:");
  problems.forEach((p) => console.error("  " + p));
  process.exit(1);
}
console.log("\nAll internal link targets resolve.");
