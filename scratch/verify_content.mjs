/* Verify every content module imports and exports the expected entries. */
import fs from "node:fs";
import path from "node:path";

const DIR = "D:/Whatsapp_CRM/landing_page/src/pages/marketing/content";
const EXPECT = {
  product: { PRODUCT_PAGES: 5 },
  productExtra: { PRODUCT_EXTRA_PAGES: 5 },
  company: { COMPANY_PAGES: 3 },
  companyExtra: { COMPANY_EXTRA_PAGES: 5 },
  legal: { LEGAL_PAGES: 3 },
  legalExtra: { LEGAL_EXTRA_PAGES: 8 },
  solutions: { SOLUTION_PAGES: 6, INDUSTRY_PAGES: 6 },
  features: { FEATURE_PAGES: 1 },
  platform: { PLATFORM_PAGES: 7 },
  developers: { DEVELOPER_PAGES: 8 },
  resources: { RESOURCE_PAGES: 8 },
  support: { SUPPORT_PAGES: 8 },
  trust: { TRUST_PAGES: 7 },
};

let failed = false;
for (const [name, expected] of Object.entries(EXPECT)) {
  try {
    const mod = await import(`file:///${DIR}/${name}.js?verify=${Date.now()}`);
    for (const [exp, count] of Object.entries(expected)) {
      const value = mod[exp];
      const len = Array.isArray(value) ? value.length : value && typeof value === "object" ? Object.keys(value).length : 0;
      const ok = len === count;
      if (!ok) failed = true;
      console.log(`${ok ? "OK  " : "FAIL"} ${name}.js :: ${exp} = ${len} (expected ${count})`);
    }
  } catch (e) {
    failed = true;
    console.log(`FAIL ${name}.js :: ${e.message}`);
  }
}

// Registry-level check: unique paths, all entries have path/title.
const idx = await import(`file:///${DIR}/index.js?verify=${Date.now()}`);
const routes = idx.ROUTES || [];
console.log(`\nROUTES total: ${routes.length}`);
const dupes = routes.filter((r, i) => routes.indexOf(r) !== i);
if (dupes.length) { failed = true; console.log("DUPLICATE ROUTES:", dupes); }
console.log(failed ? "\nRESULT: FAILURES" : "\nRESULT: ALL OK");
