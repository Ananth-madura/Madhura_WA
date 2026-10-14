/* Which non-Tailwind class names does the moved Landing.jsx use, and does
   landing_page/src/index.css define them? */
const fs = require("fs");
const path = require("path");

const landing = fs.readFileSync("D:/Whatsapp_CRM/landing_page/src/pages/Landing.jsx", "utf8");
const css = fs.readFileSync("D:/Whatsapp_CRM/landing_page/src/index.css", "utf8");

const TOKEN = /\b(lp-[a-z0-9-]+|hl-[a-z0-9-]+|wa-[a-z0-9-]+|btn-[a-z0-9-]+|badge[a-z0-9-]*|card-[a-z0-9-]+|eyebrow|cta-section|cta-navy|cta-yellow|highlight-yellow|feature-section[a-z-]*|hero-section|hero-navy|section-heading|stat-number|stat-highlight|filter-pill[a-z-]*|image-frame|product-tile|social-icon|animate-(reveal|float|pulse-slow|pulse-subtle|slide-in)|icon-float)\b/g;

const used = new Set();
for (const m of landing.matchAll(TOKEN)) used.add(m[1]);

const missing = [...used].filter((c) => !new RegExp(`\\.${c.replace(/[-]/g, "-")}(?![a-z0-9-])`).test(css));
console.log(`Used custom classes: ${used.size}`);
console.log(`Missing from landing_page/index.css (${missing.length}):`);
missing.sort().forEach((c) => console.log("  " + c));
