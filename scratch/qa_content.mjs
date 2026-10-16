/* Content QA sweep across every module: allowed icons only, no fabricated
   metrics/claims, valid renderer values, no leftover href/url link fields. */
import fs from "node:fs";
import path from "node:path";

const DIR = "D:/Whatsapp_CRM/landing_page/src/pages/marketing/content";
const ALLOWED_ICONS = new Set([
  "Activity", "Award", "BarChart3", "Building", "CheckCircle2", "Clock", "Download",
  "FileText", "Filter", "GitBranch", "Globe", "Inbox", "Layers", "Lock",
  "MessageCircle", "MessageSquare", "Percent", "RefreshCw", "Rocket", "Search",
  "Send", "ShieldCheck", "Sliders", "Terminal", "TrendingUp", "Users", "Zap",
]);
const ALLOWED_RENDERERS = new Set([
  "standard", "legal", "contact", "careers", "docs", "help", "blog", "videos",
  "tutorials", "case-studies", "getting-started", "faqs", "compare",
]);
// Phrases that would be fabricated claims if MADHURA hasn't verified them.
const BANNED = [
  /\bSOC ?2\b/i, /\bISO ?27001\b/i, /\bMeta Verified\b/i, /\b99\.98%\b/,
  /\b97% first-contact\b/i, /\$0\.001\b/, /\b50\+ indexed articles\b/,
  /localhost:3000/, /href=\"#/, /<5 min response/i,
];

const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".js") && f !== "index.js");
let problems = 0;
for (const f of files) {
  const text = fs.readFileSync(path.join(DIR, f), "utf8");
  for (const re of BANNED) {
    const m = text.match(re);
    if (m) { console.log(`BANNED  ${f}: "${m[0]}"`); problems++; }
  }
  // icon: "X" must be in the allowed set.
  for (const m of text.matchAll(/icon:\s*"([A-Za-z0-9]+)"/g)) {
    if (!ALLOWED_ICONS.has(m[1])) { console.log(`ICON    ${f}: "${m[1]}"`); problems++; }
  }
  // renderer: "X" must be a known renderer.
  for (const m of text.matchAll(/renderer:\s*"([a-z-]+)"/g)) {
    if (!ALLOWED_RENDERERS.has(m[1])) { console.log(`RENDER  ${f}: "${m[1]}"`); problems++; }
  }
  // Link fields must be `link: { label, to }` — no href/url.
  for (const m of text.matchAll(/\b(href|url):\s*"/g)) {
    console.log(`LINK    ${f}: ${m[1]}:`); problems++;
  }
}
console.log(problems ? `\n${problems} PROBLEM(S)` : "\nALL CONTENT CHECKS PASS");
