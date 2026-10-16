/* Registry check: every navigation target (header, footer, quick links,
   legacy aliases) must resolve to a real route or an alias redirect. */
import { ROUTES, SECTION_ROUTES, ALIASES } from
  "file:///D:/Whatsapp_CRM/landing_page/src/pages/marketing/content/index.js";
import { HEADER_NAV, LANDING_NAV, FOOTER_GROUPS, FOOTER_QUICK_LINKS, LEGACY_ALIASES } from
  "file:///D:/Whatsapp_CRM/landing_page/src/pages/marketing/siteNav.js";

const routeSet = new Set(ROUTES);
const aliasTargets = new Set([...Object.values(ALIASES), ...SECTION_ROUTES.map(([, to]) => to)]);
const resolve = (p) => routeSet.has(p) || aliasTargets.has(p);

const problems = [];
const check = (p, where) => {
  if (!p || p.startsWith("http") || p.startsWith("mailto:") || p.startsWith("#")) return;
  const clean = p.split("#")[0];
  if (clean && !resolve(clean)) problems.push(`${where} -> ${p}`);
};

const checkItem = (item, where) => check(item.path || item.to, where);

for (const item of HEADER_NAV) {
  checkItem(item, `HEADER ${item.label}`);
  for (const c of item.children || []) checkItem(c, `HEADER ${item.label}/${c.label}`);
}
for (const item of LANDING_NAV) checkItem(item, `LANDING ${item.label}`);
for (const group of FOOTER_GROUPS) {
  for (const item of group.links) checkItem(item, `FOOTER ${group.title}/${item.label}`);
}
for (const item of FOOTER_QUICK_LINKS) checkItem(item, `QUICK ${item.label}`);
for (const [from, to] of Object.entries(LEGACY_ALIASES)) check(to, `LEGACY ${from}`);

// Reverse: content pages reachable from no nav (informational only).
const linked = new Set();
const collect = (item) => {
  const p = (item.path || item.to || "").split("#")[0];
  if (p.startsWith("/")) linked.add(p);
};
HEADER_NAV.forEach((i) => { collect(i); (i.children || []).forEach(collect); });
LANDING_NAV.forEach(collect);
FOOTER_GROUPS.forEach((g) => g.links.forEach(collect));
FOOTER_QUICK_LINKS.forEach(collect);

const orphanRoutes = [...routeSet].filter((r) => !linked.has(r) && !Object.values(ALIASES).includes(r));

console.log(`Routes: ${routeSet.size} | Footer groups: ${FOOTER_GROUPS.length} | Linked from nav: ${linked.size}`);
if (problems.length) {
  console.error(`\nNAV TARGETS WITHOUT A PAGE (${problems.length}):`);
  problems.forEach((p) => console.error("  " + p));
} else {
  console.log("\nAll nav targets resolve to a real page.");
}
console.log(`\nRoutes not directly linked from nav/footer (${orphanRoutes.length}):`);
orphanRoutes.sort().forEach((r) => console.log("  " + r));
