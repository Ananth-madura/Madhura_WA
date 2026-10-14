/* Full class-token sweep for the moved landing page + marketing renderers:
   report tokens that are neither recognizable Tailwind utilities nor defined
   in landing_page/src/index.css. */
const fs = require("fs");
const path = require("path");

const css = fs.readFileSync("D:/Whatsapp_CRM/landing_page/src/index.css", "utf8");
const definedInCss = new Set();
for (const m of css.matchAll(/\.([A-Za-z0-9_-]+)/g)) definedInCss.add(m[1]);

const TAILWIND_PREFIXES = [
  "sm:", "md:", "lg:", "xl:", "2xl:", "hover:", "focus:", "active:", "disabled:",
  "group-hover:", "group-focus:", "peer-checked:", "aria-selected:", "data-[",
];
const TAILWIND_ROOTS = new Set([
  "p","px","py","pt","pb","pl","pr","m","mx","my","mt","mb","ml","mr",
  "w","h","min-w","min-h","max-w","max-h","text","font","leading","tracking",
  "bg","border","rounded","shadow","ring","opacity","z","gap","space-x","space-y",
  "flex","grid","block","inline","inline-block","inline-flex","hidden","table",
  "absolute","relative","fixed","sticky","static","inset","top","right","bottom","left",
  "items","justify","self","order","overflow","whitespace","break","truncate",
  "align","cursor","select","pointer-events","resize","appearance","outline","outline-offset",
  "transition","duration","ease","delay","animate","transform","scale","rotate","translate","skew","origin",
  "fill","stroke","object","aspect","columns","divide","sr-only","not-sr-only",
  "container","mx-auto","uppercase","lowercase","capitalize","normal-case","italic","underline",
  "line-through","no-underline","antialiased","list","decoration","underline-offset",
  "backdrop","blur","brightness","contrast","grayscale","hue-rotate","invert","saturate",
  "sepia","drop-shadow","mix-blend","isolation","col-span","row-span","auto-cols","auto-rows",
  "grid-cols","grid-rows","basis","grow","shrink","place-items","place-content","place-self",
  "float","clear","align-top","align-middle","align-bottom","overflow-x","overflow-y",
  "overscroll","scroll","snap","touch","will-change","content","capitalize",
  "from","via","to","rounded-t","rounded-b","rounded-l","rounded-r","rounded-tl","rounded-tr",
  "rounded-bl","rounded-br","border-t","border-b","border-l","border-r","border-x","border-y",
  "divide-x","divide-y","indent","hyphens","word-break","break-all","break-words","break-keep",
  "text-left","text-center","text-right","text-justify","align-self","justify-self",
]);

function rootOf(tok) {
  const noVariant = tok.includes(":") ? tok.slice(tok.lastIndexOf(":") + 1) : tok;
  const m = noVariant.match(/^(-?[a-z]+)/);
  return m ? m[1] : noVariant;
}

const files = [
  "D:/Whatsapp_CRM/landing_page/src/pages/Landing.jsx",
  ...fs.readdirSync("D:/Whatsapp_CRM/landing_page/src/pages/marketing/renderers")
    .map((f) => path.join("D:/Whatsapp_CRM/landing_page/src/pages/marketing/renderers", f)),
  "D:/Whatsapp_CRM/landing_page/src/components/SiteFooter.jsx",
  "D:/Whatsapp_CRM/landing_page/src/pages/marketing/MarketingLayout.jsx",
];

const unknown = new Map();
for (const f of files) {
  const t = fs.readFileSync(f, "utf8");
  for (const m of t.matchAll(/className=\{?\s*(["'`])((?:\\.|(?!\1).)*)\1/g)) {
    for (const raw of m[2].split(/\s+/)) {
      const tok = raw.trim();
      if (!tok || tok.includes("${") || tok.includes("{")) continue;
      if (definedInCss.has(tok.replace(/^[:!]/, ""))) continue;
      const root = rootOf(tok);
      if (TAILWIND_ROOTS.has(root)) continue;
      if (/^\[|^rounded-\[|^text-\[|^bg-\[|^shadow-\[|^w-\[|^h-\[|^leading-\[|^tracking-\[/.test(tok)) continue;
      if (/^[a-z]+-\[/.test(tok)) continue; // arbitrary values
      if (!unknown.has(tok)) unknown.set(tok, new Set());
      unknown.get(tok).add(path.basename(f));
    }
  }
}

console.log("Unrecognized class tokens:");
[...unknown].sort().forEach(([tok, where]) => console.log(`  ${tok}  <- ${[...where].join(", ")}`));
