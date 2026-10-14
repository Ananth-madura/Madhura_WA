/* One-shot migration helper: replace the landing page's inline footer markup
   with the shared <SiteFooter /> component. Preserves every other byte. */
const fs = require("fs");

const file = "D:/Whatsapp_CRM/landing_page/src/pages/Landing.jsx";
const source = fs.readFileSync(file, "utf8");

const anchorIdx = source.indexOf("SECTION 7: COMPLETE ENTERPRISE FOOTER ARCHITECTURE");
if (anchorIdx === -1) throw new Error("footer marker not found");

const startIdx = source.lastIndexOf("{/*", anchorIdx);
if (startIdx === -1) throw new Error("footer comment start not found");

const endIdx = source.indexOf("</footer>", anchorIdx);
if (endIdx === -1) throw new Error("closing footer tag not found");

const eol = source.includes("\r\n") ? "\r\n" : "\n";
const replacement = [
  "      {/* ─────────────────────────────────────────────────────────────────────────",
  "          SECTION 7: ENTERPRISE FOOTER",
  "          Shared component: the same 9-group IA drives this page and every",
  "          marketing URL. Data lives in marketing/siteNav.js (FOOTER_GROUPS).",
  "          ───────────────────────────────────────────────────────────────────────── */}",
  "      <SiteFooter />",
].join(eol);

const output = source.slice(0, startIdx) + replacement + source.slice(endIdx + "</footer>".length);

fs.writeFileSync(file, output, "utf8");
console.log(`removed ${endIdx + "</footer>".length - startIdx} chars, wrote ${output.length}`);
