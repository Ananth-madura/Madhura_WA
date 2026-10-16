import { Link } from "react-router-dom";
import { COMPANY, SOCIAL_LINKS } from "../pages/marketing/siteNav";
import BrandLogo from "./BrandLogo";

/* ─────────────────────────────────────────────────────────────────────────────
   Landing-page footer.

   The marketing URLs keep the dark 9-group enterprise footer in SiteFooter.jsx;
   the landing page runs the light, three-column footer its design calls for.
   Both read their links from siteNav.js, so a route can never exist in one and
   404 in the other.
   ───────────────────────────────────────────────────────────────────────────── */

const FOOTER_COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Live Inbox", path: "/product/live-inbox" },
      { label: "Campaigns", path: "/product/campaigns" },
      { label: "Contacts", path: "/product/contacts" },
      { label: "Automation", path: "/product/automations" },
      { label: "Analytics", path: "/product/analytics" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", path: "/company/about" },
      { label: "Contact", path: "/company/contact" },
      { label: "Trust", path: "/trust" },
      { label: "Documentation", path: "/docs" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", path: "/legal/privacy" },
      { label: "Terms of Service", path: "/legal/terms" },
    ],
  },
];

export default function LandingFooter() {
  const lastColumn = FOOTER_COLUMNS.length - 1;

  return (
    <footer className="bg-white text-slate-500 border-t border-slate-200">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pt-14 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8">
          {/* Brand block */}
          <div className="lg:col-span-5">
            <Link to="/" className="inline-flex items-center w-fit group" aria-label="MADHURA home">
              <BrandLogo variant="on-light" className="h-8 lg:h-9" />
            </Link>
            <p className="mt-5 text-sm font-bold text-[#0b1b3f]">{COMPANY.tagline}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-500 max-w-xs">
              Turn conversations into meaningful business workflows.
            </p>
          </div>

          {/* Link columns */}
          <div className="lg:col-span-7 lg:pl-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-8">
              {FOOTER_COLUMNS.map((column, index) => (
                <div key={column.title}>
                  <h3 className="text-sm font-bold text-[#0b1b3f]">{column.title}</h3>
                  <ul className="mt-4 space-y-2.5 text-sm">
                    {column.links.map((link) => (
                      <li key={link.path}>
                        <Link
                          to={link.path}
                          className="inline-block text-slate-500 transition hover:translate-x-1 hover:text-azure-600"
                        >
                          <span className="border-b border-transparent pb-0.5 transition hover:border-azure-400">
                            {link.label}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>

                  {index === lastColumn && SOCIAL_LINKS.length > 0 && (
                    <div className="mt-5 flex items-center gap-2">
                      {SOCIAL_LINKS.map((social) => (
                        <a
                          key={social.label}
                          href={social.href}
                          target="_blank"
                          rel="noreferrer noopener"
                          aria-label={social.label}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:text-azure-600 hover:border-azure-200 transition"
                        >
                          <social.Icon size={15} />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <span>© 2026 Madhura. All rights reserved.</span>
          <span className="inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-azure-600" />
            <span>Built for modern businesses</span>
          </span>
        </div>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ALTERNATE FOOTER — richer link set (currently disabled).
   To use it: cut the exported LandingFooter above, then uncomment this block
   and rename `LandingFooterAlt` → `LandingFooter`. It is the fixed, site-wide
   footer — same light styling, five link columns instead of three. (Cmd+/ or
   Ctrl+/ to uncomment.)
   ═══════════════════════════════════════════════════════════════════════════

const RICH_FOOTER_COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Live Inbox", path: "/product/live-inbox" },
      { label: "Campaigns", path: "/product/campaigns" },
      { label: "Contacts", path: "/product/contacts" },
      { label: "Automation", path: "/product/automations" },
      { label: "Analytics", path: "/product/analytics" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", path: "/company/about" },
      { label: "Contact", path: "/company/contact" },
      { label: "Trust", path: "/trust" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Documentation", path: "/docs" },
      { label: "Blog", path: "/blog" },
      { label: "Tutorials", path: "/tutorials" },
      { label: "Case Studies", path: "/case-studies" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", path: "/legal/privacy" },
      { label: "Terms of Service", path: "/legal/terms" },
    ],
  },
];

export function LandingFooterAlt() {
  return (
    <footer className="bg-white text-slate-500 border-t border-slate-200">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pt-14 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8">
          <div className="lg:col-span-4">
            <Link to="/" className="inline-flex items-center w-fit group" aria-label="MADHURA home">
              <BrandLogo variant="on-light" className="h-8 lg:h-9" />
            </Link>
            <p className="mt-5 text-sm font-bold text-[#0b1b3f]">{COMPANY.tagline}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-500 max-w-xs">
              Turn conversations into meaningful business workflows.
            </p>
          </div>

          <div className="lg:col-span-8">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-8">
              {RICH_FOOTER_COLUMNS.map((column) => (
                <div key={column.title}>
                  <h3 className="text-sm font-bold text-[#0b1b3f]">{column.title}</h3>
                  <ul className="mt-4 space-y-2.5 text-sm">
                    {column.links.map((link) => (
                      <li key={link.path}>
                        <Link
                          to={link.path}
                          className="inline-block text-slate-500 transition hover:translate-x-1 hover:text-azure-600"
                        >
                          <span className="border-b border-transparent pb-0.5 transition hover:border-azure-400">
                            {link.label}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {SOCIAL_LINKS.length > 0 && (
              <div className="mt-8 flex items-center gap-2">
                {SOCIAL_LINKS.map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={social.label}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:text-azure-600 hover:border-azure-200 transition"
                  >
                    <social.Icon size={15} />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <span>© 2026 Madhura. All rights reserved.</span>
          <span className="inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-azure-600" />
            <span>Built for modern businesses</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
*/
