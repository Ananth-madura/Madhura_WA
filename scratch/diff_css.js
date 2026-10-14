/* Diff the class-ish selectors defined in both index.css files so we know what
   landing_page/src/index.css still needs from the frontend copy. */
const fs = require("fs");

const read = (p) => fs.readFileSync(p, "utf8");
const selectors = (css) => {
  const out = new Set();
  for (const m of css.matchAll(/(?:^|\})\s*([.#][A-Za-z0-9_-]+(?:\s+[.#][A-Za-z0-9_-]+)*)\s*[,{]/gm)) {
    out.add(m[1].trim());
  }
  return out;
};

const fe = selectors(read("D:/Whatsapp_CRM/frontend/src/index.css"));
const lp = selectors(read("D:/Whatsapp_CRM/landing_page/src/index.css"));

console.log("In frontend/index.css but NOT landing_page/index.css:");
[...fe].filter((s) => !lp.has(s)).sort().forEach((s) => console.log("  " + s));
console.log("\nIn landing_page but not frontend:");
[...lp].filter((s) => !fe.has(s)).sort().forEach((s) => console.log("  " + s));
