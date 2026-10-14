/* One-off audit: find className string literals (any position) referencing
   tokens that must come from tailwind.config.js or index.css. */
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

const WATCH = /(^|\s|["'`:{])((hover|focus|lg|md|sm|xl|group-hover):)?(shadow-[a-z]+|animate-[a-z-]+|font-[a-z]+|text-brand|bg-brand|border-brand)/g;
const found = new Map();
for (const f of files) {
  const t = fs.readFileSync(f, "utf8");
  for (const m of t.matchAll(WATCH)) {
    const cls = (m[2] ? m[2] + ":" : "") + m[4];
    if (!found.has(cls)) found.set(cls, []);
    found.get(cls).push(path.relative(root, f));
  }
}

const BUILTIN_ANIM = new Set(["animate-bounce", "animate-pulse", "animate-spin"]);
const BUILTIN_FONT = new Set(["font-sans", "font-serif", "font-mono", "font-black", "font-bold", "font-semibold", "font-medium", "font-normal", "font-extrabold", "font-light"]);
const BUILTIN_SHADOW = new Set(["shadow-sm", "shadow-md", "shadow-lg", "shadow-xl", "shadow-2xl", "shadow-xs", "shadow-inner", "shadow-none", "shadow"]);

for (const [cls, where] of [...found].sort()) {
  const base = cls.split(":").pop();
  const builtin = BUILTIN_ANIM.has(base) || BUILTIN_FONT.has(base) || BUILTIN_SHADOW.has(base) || /^shadow-(black|white|blue|emerald|slate|gray|red|amber|green|indigo|violet|purple|cyan|sky|stone|zinc|neutral|orange|yellow|lime|teal|rose|fuchsia|pink)-/.test(base);
  if (!builtin) console.log(`${cls}  <- ${[...new Set(where)].slice(0, 3).join(", ")}`);
}
