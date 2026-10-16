/* Fix invalid lucide icon names in content modules (unknown icons silently
   fall back to a generic Layers glyph in the renderers). */
import fs from "node:fs";

const DIR = "D:/Whatsapp_CRM/landing_page/src/pages/marketing/content/";

// [file, oldSnippet, newSnippet]
const FIXES = [
  ["trust.js", '{ icon: "AlertCircle", title: "Incident response"', '{ icon: "Activity", title: "Incident response"'],
  ["trust.js", '{ icon: "Scale", title: "Compliance"', '{ icon: "CheckCircle2", title: "Compliance"'],
  ["trust.js", '{ icon: "Folder", title: "Isolation"', '{ icon: "Layers", title: "Isolation"'],
  ["trust.js", '{ icon: "Key", title: "API keys"', '{ icon: "Lock", title: "API keys"'],
  ["trust.js", '{ icon: "AlertCircle", title: "Detect"', '{ icon: "Activity", title: "Detect"'],
  ["trust.js", '{ icon: "Settings", title: "Remediate"', '{ icon: "RefreshCw", title: "Remediate"'],
  ["trust.js", '{ icon: "CheckCircle", title: "Acknowledge"', '{ icon: "CheckCircle2", title: "Acknowledge"'],
  ["trust.js", '{ icon: "Code", title: "API"', '{ icon: "Terminal", title: "API"'],
  ["trust.js", '{ icon: "Smartphone", title: "Integrations"', '{ icon: "Globe", title: "Integrations"'],
  ["trust.js", '{ icon: "CheckSquare", title: "Consent"', '{ icon: "CheckCircle2", title: "Consent"'],
  ["trust.js", '{ icon: "FileCode", title: "Templates"', '{ icon: "FileText", title: "Templates"'],
  ["trust.js", '{ icon: "Scale", title: "Legal docs"', '{ icon: "FileText", title: "Legal docs"'],
  ["product.js", '{ icon: "Paperclip", title: "Rich media"', '{ icon: "Download", title: "Rich media"'],
  ["product.js", '{ icon: "Radio", title: "Realtime by default"', '{ icon: "Activity", title: "Realtime by default"'],
  ["product.js", 'icon: "RotateCw"', 'icon: "RefreshCw"'],
];

for (const [file, from, to] of FIXES) {
  const p = DIR + file;
  const text = fs.readFileSync(p, "utf8");
  if (!text.includes(from)) { console.log(`MISS ${file}: ${from}`); continue; }
  fs.writeFileSync(p, text.split(from).join(to));
  console.log(`OK   ${file}: ${from}`);
}
