/* One-off audit: list custom-looking Tailwind classes used in landing_page/src
   so we can confirm tailwind.config.js covers them. Run: node scratch/audit_classes.js */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "landing_page", "src");
const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.jsx?$/.test(f)) files.push(p);
  }
})(root);

const PREFIXES = ["shadow-", "animate-", "font-", "ease-", "duration-", "ring-"];
const cls = new Set();
for (const f of files) {
  const t = fs.readFileSync(f, "utf8");
  for (const m of t.matchAll(/className=\{?\s*["'`]([^"'`]+)["'`]/g)) {
    for (const c of m[1].split(/\s+/)) {
      if (PREFIXES.some((p) => c.startsWith(p))) cls.add(c);
    }
  }
}

// Tailwind built-ins we don't need to define.
const BUILTIN = new Set([
  "font-sans", "font-serif", "font-mono", "font-black", "font-bold", "font-semibold",
  "font-medium", "font-normal", "font-extrabold", "font-light",
  "shadow-sm", "shadow", "shadow-md", "shadow-lg", "shadow-xl", "shadow-2xl", "shadow-xs",
  "shadow-inner", "shadow-none",
  "duration-75", "duration-100", "duration-150", "duration-200", "duration-300",
  "duration-500", "duration-700", "duration-1000",
  "ease-linear", "ease-in", "ease-out", "ease-in-out",
  "ring-0", "ring-1", "ring-2", "ring-4", "ring-8", "ring", "ring-inset",
]);
const custom = [...cls].filter((c) => !BUILTIN.has(c)).sort();
console.log("Non-builtin classes in use:");
custom.forEach((c) => console.log("  " + c));
