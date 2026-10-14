import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { ArrowRight, ChevronDown, Menu, X } from "lucide-react";
import { appUrl, isSignedIn } from "../../config/site";
import SiteFooter from "../../components/SiteFooter";
import { HEADER_NAV } from "./siteNav";

/* ─────────────────────────────────────────────────────────────────────────────
   Shared chrome for every public marketing URL: sticky header with a
   keyboard-accessible mega menu, a mobile drawer, and the site footer.
   Styled to continue the Landing page — dark `#070b16` bar over a light canvas.
   ───────────────────────────────────────────────────────────────────────────── */

function BrandMark() {
  return (
    <Link to="/" className="flex items-center gap-2.5 group shrink-0" aria-label="Madhura home">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 via-blue-600 to-cyan-400 p-0.5 shadow-lg shadow-blue-500/25">
        <div className="w-full h-full bg-[#070b16] rounded-[10px] flex items-center justify-center">
          <span className="font-black text-xl bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
            M
          </span>
        </div>
      </div>
      <span className="text-xl font-extrabold tracking-tight text-white group-hover:text-blue-400 transition">
        MADHURA
      </span>
    </Link>
  );
}

function DesktopMenu({ item, open, onToggle, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => onToggle(item.label, true)}
      onMouseLeave={() => onToggle(item.label, false)}
    >
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => onToggle(item.label, !open)}
        className={`flex items-center gap-1 text-sm font-medium transition ${
          open ? "text-white" : "text-slate-300 hover:text-white"
        }`}
      >
        {item.label}
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-1/2 -translate-x-1/2 top-full pt-4 z-50">
          <div className="w-[26rem] rounded-2xl bg-[#0b1224] border border-white/10 shadow-2xl shadow-black/50 p-2 animate-scale-in">
            {item.children.map((child) => (
              <Link
                key={child.path}
                to={child.path}
                onClick={onClose}
                className="flex items-start gap-3 rounded-xl p-3 hover:bg-white/[0.06] transition group"
              >
                <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-blue-500/70 group-hover:bg-blue-400 shrink-0" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-white">{child.label}</span>
                  <span className="block text-xs text-slate-400 leading-relaxed mt-0.5">
                    {child.desc}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Breadcrumbs({ page }) {
  if (!page) return null;
  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-xs text-slate-400">
      <ol className="flex flex-wrap items-center gap-1.5">
        <li>
          <Link to="/" className="hover:text-blue-300 transition">
            Home
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        {page.section === "Documentation" ? (
          <li className="text-slate-200 font-medium">Documentation</li>
        ) : (
          <>
            <li className="text-slate-300">{page.section}</li>
            <li aria-hidden="true">/</li>
            <li className="text-slate-200 font-medium">
              {page.meta?.title?.split("—")[0]?.split("|")[0]?.trim() || page.path}
            </li>
          </>
        )}
      </ol>
    </nav>
  );
}

export default function MarketingLayout({ children, page }) {
  const [openMenu, setOpenMenu] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  const isAuthed = isSignedIn();

  useEffect(() => {
    setOpenMenu(null);
    setDrawerOpen(false);
  }, [location.pathname]);

  const toggle = (label, next) => setOpenMenu(next ? label : null);

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-blue-600 selection:text-white">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:bg-blue-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-50 bg-[#070b16]/90 backdrop-blur-md border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-6">
          <BrandMark />

          <nav className="hidden xl:flex items-center gap-6" aria-label="Primary">
            {HEADER_NAV.map((item) =>
              item.type === "menu" ? (
                <DesktopMenu
                  key={item.label}
                  item={item}
                  open={openMenu === item.label}
                  onToggle={toggle}
                  onClose={() => setOpenMenu(null)}
                />
              ) : (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `text-sm font-medium transition ${
                      isActive ? "text-white" : "text-slate-300 hover:text-white"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              )
            )}
          </nav>

          <div className="flex items-center gap-3">
            {isAuthed ? (
              <a
                href={appUrl("/whatsapp")}
                className="hidden sm:inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm px-5 py-2.5 rounded-full transition hover:scale-105 active:scale-95"
              >
                Open workspace
                <ArrowRight size={15} />
              </a>
            ) : (
              <>
                <a
                  href={appUrl("/login")}
                  className="hidden sm:inline text-sm font-semibold text-slate-300 hover:text-white px-3 py-2 transition"
                >
                  Sign in
                </a>
                <a
                  href={appUrl("/signup")}
                  className="hidden sm:inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm px-5 py-2.5 rounded-full transition hover:scale-105 active:scale-95"
                >
                  Start free trial
                  <ArrowRight size={15} />
                </a>
              </>
            )}
            <button
              type="button"
              onClick={() => setDrawerOpen((v) => !v)}
              aria-expanded={drawerOpen}
              aria-controls="mobile-nav"
              aria-label={drawerOpen ? "Close menu" : "Open menu"}
              className="xl:hidden text-slate-200 hover:text-white p-2 -mr-2"
            >
              {drawerOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {drawerOpen && (
          <div
            id="mobile-nav"
            className="xl:hidden border-t border-white/[0.08] bg-[#070b16] max-h-[calc(100vh-5rem)] overflow-y-auto"
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-5">
              {HEADER_NAV.map((item) =>
                item.type === "menu" ? (
                  <div key={item.label} className="space-y-1.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      {item.label}
                    </p>
                    {item.children.map((child) => (
                      <Link
                        key={child.path}
                        to={child.path}
                        onClick={() => setDrawerOpen(false)}
                        className="block text-sm text-slate-200 hover:text-white py-1"
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setDrawerOpen(false)}
                    className="block text-sm font-medium text-slate-200 hover:text-white"
                  >
                    {item.label}
                  </Link>
                )
              )}
              <div className="pt-3 border-t border-white/[0.08] flex flex-col gap-2">
                {isAuthed ? (
                  <a
                    href={appUrl("/whatsapp")}
                    className="text-center bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm px-5 py-3 rounded-full"
                  >
                    Open workspace
                  </a>
                ) : (
                  <>
                    <a
                      href={appUrl("/signup")}
                      className="text-center bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm px-5 py-3 rounded-full"
                    >
                      Start free trial
                    </a>
                    <a
                      href={appUrl("/login")}
                      className="text-center text-sm font-semibold text-slate-300 hover:text-white py-2"
                    >
                      Sign in
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      <main id="main-content">
        {page?.hero ? (
          <section className="bg-[#070b16] text-white border-b border-white/[0.08]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-16">
              <Breadcrumbs page={page} />
              <div className="grid lg:grid-cols-12 gap-10 items-end">
                <div className="lg:col-span-8">
                  <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-blue-300 bg-blue-500/10 border border-blue-400/20 rounded-full px-3 py-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    {page.hero.badge}
                  </span>
                  <h1 className="mt-5 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-[1.1]">
                    {page.hero.title}
                  </h1>
                  <p className="mt-5 text-sm sm:text-base text-slate-400 leading-relaxed max-w-2xl">
                    {page.hero.subtitle}
                  </p>
                  <div className="mt-7 flex flex-wrap items-center gap-3">
                    <Link
                      to={page.hero.primaryCta.to}
                      className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm px-7 py-3.5 rounded-full shadow-xl shadow-blue-600/25 transition hover:scale-105 active:scale-95"
                    >
                      {page.hero.primaryCta.label}
                      <ArrowRight size={16} />
                    </Link>
                    <Link
                      to={page.hero.secondaryCta.to}
                      className="inline-flex items-center gap-2 border border-white/15 hover:border-white/30 text-slate-100 font-semibold text-sm px-7 py-3.5 rounded-full transition"
                    >
                      {page.hero.secondaryCta.label}
                    </Link>
                  </div>
                </div>
                <ul className="lg:col-span-4 space-y-2.5">
                  {page.hero.points.map((point) => (
                    <li key={point} className="flex items-start gap-2.5 text-sm text-slate-300">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        ) : (
          <section className="bg-[#070b16] text-white border-b border-white/[0.08]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-10">
              <Breadcrumbs page={page} />
            </div>
          </section>
        )}

        {children}
      </main>

      <SiteFooter />
    </div>
  );
}
