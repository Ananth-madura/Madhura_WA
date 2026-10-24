import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, ExternalLink, Menu, Sparkles, X } from "lucide-react";
import { appUrl, LIVE_APP_URL } from "../config/site";
import BrandLogo from "./BrandLogo";
import { LANDING_NAV } from "../pages/marketing/siteNav";

/* ─────────────────────────────────────────────────────────────────────────────
   THE HOME PAGE HEADER — shared chrome.

   Extracted from Landing.jsx so the *exact* header the home page shows is also
   rendered on every marketing URL (MarketingLayout.jsx renders this component).

   `onBookDemo`:
     • Landing passes its in-page demo-modal opener.
     • Pages without the modal fall back to the real /demo route.
   ───────────────────────────────────────────────────────────────────────────── */

function Container({ className = "", children }) {
  return (
    <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>
  );
}

export default function LandingHeader({ onBookDemo }) {
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Sticky header shadow once the page is scrolled
  useEffect(() => {
    const onScroll = () => setHeaderScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  const handleBookDemo = () => {
    if (onBookDemo) {
      onBookDemo();
      return;
    }
    navigate("/demo");
  };

  return (
    <header
      className={`sticky top-0 z-50 border-b bg-white/95 backdrop-blur-md transition-shadow duration-300 ${
        headerScrolled ? "border-slate-200 shadow-[0_10px_30px_-12px_rgba(11,27,63,0.18)]" : "border-slate-200/80"
      }`}
    >
      <Container className="flex h-16 items-center justify-between gap-4 lg:h-[72px]">
        <Link to="/" className="flex shrink-0 items-center" aria-label="MADHURA home">
          <BrandLogo variant="on-light" className="h-8 lg:h-9" />
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex" aria-label="Primary">
          {LANDING_NAV.map((item) => (
            <Link key={item.path} to={item.path} className="transition hover:text-azure-600">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2.5 sm:gap-3">
          <a
            href={LIVE_APP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-semibold text-slate-700 shadow-sm transition hover:border-azure-500 hover:bg-slate-50 hover:text-azure-600 active:scale-[0.98]"
          >
            <span>Try Now</span>
            <ArrowRight size={14} />
          </a>

          <button
            type="button"
            onClick={handleBookDemo}
            className="inline-flex items-center gap-1.5 rounded-full bg-azure-600 px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-bold text-white shadow-[0_8px_20px_rgba(37,99,235,0.28)] transition hover:bg-azure-700 active:scale-[0.98]"
          >
            <span>Book a Demo</span>
            <ArrowRight size={14} />
          </button>

          <button
            type="button"
            onClick={() => setMobileNavOpen((v) => !v)}
            aria-expanded={mobileNavOpen}
            aria-controls="landing-mobile-nav"
            aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
            className="-mr-2 p-2 text-slate-600 transition hover:text-azure-600 md:hidden"
          >
            {mobileNavOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </Container>

      {mobileNavOpen && (
        <div
          id="landing-mobile-nav"
          className="max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-slate-200 bg-white md:hidden"
        >
          <Container className="space-y-4 py-5">
            <ul className="space-y-1">
              {LANDING_NAV.map((item) => (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    onClick={() => setMobileNavOpen(false)}
                    className="block py-2 text-sm font-medium text-slate-700 transition hover:text-azure-600"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-2 border-t border-slate-200 pt-4">
              <a
                href={LIVE_APP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 rounded-full border border-slate-300 bg-white py-2.5 text-center text-sm font-semibold text-slate-700 shadow-sm transition hover:border-azure-500 hover:text-azure-600"
              >
                <span>Try Now</span>
                <ArrowRight size={14} />
              </a>
              <button
                type="button"
                onClick={() => {
                  setMobileNavOpen(false);
                  handleBookDemo();
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-azure-600 py-2.5 text-center text-sm font-bold text-white shadow-md transition hover:bg-azure-700"
              >
                <span>Book a Demo</span>
                <ArrowRight size={14} />
              </button>
              <a
                href={appUrl("/login")}
                className="rounded-full border border-slate-200 py-2 text-center text-xs font-medium text-slate-500 hover:text-slate-800"
              >
                Sign in
              </a>
            </div>
          </Container>
        </div>
      )}
    </header>
  );
}
