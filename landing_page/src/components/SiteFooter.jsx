import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Cookie, Globe, Mail, MapPin, Phone, Shield } from "lucide-react";
import { appUrl } from "../config/site";
import { COMPANY, FOOTER_GROUPS, FOOTER_QUICK_LINKS, SOCIAL_LINKS } from "../pages/marketing/siteNav";

/* ─────────────────────────────────────────────────────────────────────────────
   One footer for the whole marketing site.

   `FOOTER_GROUPS` in siteNav.js is the single source of truth: the same data
   drives the landing page and every /product, /solutions, /legal… URL, so a
   link can never exist in one place and 404 in another.

   Desktop: 9 groups across rows. Mobile: the same groups as collapsible
   sections with a large enough tap target. No certification badges or partner
   marks are rendered — only things MADHURA can actually back up today.
   ───────────────────────────────────────────────────────────────────────────── */

/** Matches the lg breakpoint so desktop never shows a pointless accordion. */
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" && window.innerWidth >= 1024
  );

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return isDesktop;
}

function FooterGroup({ group, open, onToggle, isDesktop }) {
  const expanded = isDesktop || open;
  const id = `footer-${group.title.toLowerCase().replace(/[^a-z]+/g, "-")}`;

  return (
    <div>
      <h3>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={id}
          disabled={isDesktop}
          onClick={() => onToggle(group.title)}
          className={`w-full flex items-center justify-between gap-2 text-left text-[11px] font-bold uppercase tracking-wider text-blue-400 pb-3 border-b border-white/[0.06] mb-3 ${
            isDesktop ? "cursor-default" : "lg:cursor-default"
          }`}
        >
          {group.title}
          {!isDesktop && (
            <ChevronDown
              size={14}
              className={`text-slate-500 transition-transform ${open ? "rotate-180 text-blue-400" : ""}`}
            />
          )}
        </button>
      </h3>

      <ul id={id} className={`space-y-2 text-[12.5px] ${expanded ? "block" : "hidden"}`}>
        {group.links.map((link) => (
          <li key={link.path}>
            <Link to={link.path} className="text-slate-400 hover:text-white transition leading-relaxed">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CookiePreferences({ onClose }) {
  const [analytics, setAnalytics] = useState(() => {
    try {
      return window.localStorage.getItem("mh_cookie_analytics") === "granted";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = () => {
    try {
      window.localStorage.setItem("mh_cookie_analytics", analytics ? "granted" : "denied");
    } catch {
      /* storage blocked — preference simply will not persist */
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cookie preferences"
        className="w-full max-w-lg rounded-2xl bg-[#111e43] border border-white/10 p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
              Privacy controls
            </p>
            <h2 className="mt-1.5 text-lg font-extrabold text-white">Cookie preferences</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close cookie preferences"
            className="text-slate-400 hover:text-white text-xs font-semibold px-2 py-1 rounded-md border border-white/10"
          >
            Esc
          </button>
        </div>

        <p className="mt-3 text-sm text-slate-400 leading-relaxed">
          Strictly necessary storage keeps you signed in and protects forms from abuse — it is
          always on. Everything else stays off until you switch it on.
        </p>

        <div className="mt-5 space-y-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-white">Strictly necessary</p>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                Session token, security and load-balancer cookies.
              </p>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-400/20 rounded-full px-2.5 py-1 shrink-0">
              Always on
            </span>
          </div>

          <label className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex items-start justify-between gap-4 cursor-pointer">
            <div>
              <p className="text-sm font-bold text-white">Product analytics</p>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                Aggregated page and feature usage. No advertising trackers, no cross-site profiles.
              </p>
            </div>
            <input
              type="checkbox"
              checked={analytics}
              onChange={(e) => setAnalytics(e.target.checked)}
              className="mt-1 h-4 w-4 accent-blue-500 shrink-0"
            />
          </label>
        </div>

        <div className="mt-5 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={save}
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold px-5 py-3 rounded-full transition"
          >
            Save preferences
          </button>
          <Link
            to="/legal/cookies"
            onClick={onClose}
            className="flex-1 text-center border border-white/15 hover:border-white/30 text-slate-200 text-sm font-semibold px-5 py-3 rounded-full transition"
          >
            Read cookie policy
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SiteFooter() {
  const isDesktop = useIsDesktop();
  const [openGroup, setOpenGroup] = useState(null);
  const [showCookies, setShowCookies] = useState(false);

  const toggle = (title) => setOpenGroup((current) => (current === title ? null : title));

  return (
    <>
      <footer className="bg-[#060a14] text-slate-400 border-t border-white/[0.08] pt-14 pb-10 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          {/* ── Operational transparency ─────────────────────────────────── */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#111e43] border border-white/[0.08] flex flex-col md:flex-row items-center justify-between gap-4">
            <Link to="/status" className="flex items-center gap-3 group">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="flex items-center gap-2 text-white font-semibold text-xs sm:text-sm group-hover:text-blue-300 transition">
                <span>System Status:</span>
                <span className="text-emerald-400 font-bold">All Systems Operational</span>
              </span>
            </Link>

            <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] text-slate-400">
              <Link to="/trust" className="flex items-center gap-1.5 hover:text-white transition">
                <Shield size={13} className="text-blue-400" />
                <span>Trust Center</span>
              </Link>
              <span className="hidden sm:inline text-slate-600">•</span>
              <Link to="/trust/security" className="flex items-center gap-1.5 hover:text-white transition">
                <span>TLS 1.3 encryption in transit</span>
              </Link>
              <span className="hidden sm:inline text-slate-600">•</span>
              <Link to="/trust/data-protection" className="flex items-center gap-1.5 hover:text-white transition">
                <span>Data protection &amp; retention</span>
              </Link>
            </div>
          </div>

          {/* ── Brand block ──────────────────────────────────────────────── */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-8 border-b border-white/[0.08]">
            <div className="space-y-2.5 max-w-2xl">
              <Link to="/" className="flex items-center gap-3 w-fit group" aria-label="MADHURA home">
                <img src="/Group.png" alt="MADHURA" className="h-9 w-auto object-contain" />
                <span className="text-base font-extrabold text-white tracking-tight group-hover:text-blue-400 transition">
                  MADHURA
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-900/60 text-blue-300 border border-blue-500/30">
                  {COMPANY.tagline}
                </span>
              </Link>
              <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                {COMPANY.description}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                to="/demo"
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition shadow-md"
              >
                Schedule Demo
              </Link>
              <a
                href={appUrl("/login?tab=demo")}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs transition"
              >
                Explore Workspace
              </a>
            </div>
          </div>

          {/* ── 9 navigation groups ──────────────────────────────────────── */}
          <nav aria-label="Footer" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-x-8 gap-y-7 text-[12.5px]">
            {FOOTER_GROUPS.map((group) => (
              <FooterGroup
                key={group.title}
                group={group}
                open={openGroup === group.title}
                onToggle={toggle}
                isDesktop={isDesktop}
              />
            ))}
          </nav>

          {/* ── Global business information ──────────────────────────────── */}
          <div className="pt-8 border-t border-white/[0.08] grid grid-cols-1 md:grid-cols-3 gap-6 text-[11.5px] text-slate-400">
            <div>
              <div className="font-bold text-white mb-1.5">{COMPANY.legalName}</div>
              <p className="flex items-start gap-1.5 leading-relaxed">
                <MapPin size={13} className="mt-0.5 shrink-0 text-blue-400" />
                <span>{COMPANY.address}</span>
              </p>
            </div>

            <div>
              <div className="font-bold text-white mb-1.5">Direct contacts</div>
              <p className="flex items-center gap-1.5">
                <Mail size={13} className="shrink-0 text-blue-400" />
                <a href={`mailto:${COMPANY.salesEmail}`} className="text-blue-400 hover:underline">
                  {COMPANY.salesEmail}
                </a>
                <span className="text-slate-600">(sales)</span>
              </p>
              <p className="flex items-center gap-1.5 mt-1">
                <Mail size={13} className="shrink-0 text-blue-400" />
                <a href={`mailto:${COMPANY.supportEmail}`} className="text-blue-400 hover:underline">
                  {COMPANY.supportEmail}
                </a>
                <span className="text-slate-600">(support)</span>
              </p>
              <p className="flex items-center gap-1.5 mt-1">
                <Phone size={13} className="shrink-0 text-blue-400" />
                <span className="text-white">{COMPANY.phone}</span>
              </p>
            </div>

            <div className="flex md:justify-end items-start gap-3">
              <span className="inline-flex items-center gap-2 bg-[#111e43] border border-white/10 px-3 py-1.5 rounded-lg text-white text-[11px]">
                <Globe size={13} className="text-blue-400" />
                <span>{COMPANY.region}</span>
              </span>
            </div>
          </div>

          {/* ── Copyright bar ────────────────────────────────────────────── */}
          <div className="pt-6 border-t border-white/[0.08] flex flex-col lg:flex-row items-center justify-between gap-4 text-slate-500 text-[11.5px]">
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
              <span>{COMPANY.copyright}</span>
              {SOCIAL_LINKS.length > 0 && (
                <span className="flex items-center gap-2">
                  {SOCIAL_LINKS.map((social) => (
                    <a
                      key={social.label}
                      href={social.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      aria-label={social.label}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition"
                    >
                      <social.Icon size={13} />
                    </a>
                  ))}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 text-slate-400">
              {FOOTER_QUICK_LINKS.map((link) => (
                <Link key={link.label} to={link.path} className="hover:text-white transition">
                  {link.label}
                </Link>
              ))}
              <span className="text-slate-700">·</span>
              <Link to="/accessibility" className="hover:text-white transition">
                Accessibility
              </Link>
              <span className="text-slate-700">·</span>
              <button
                type="button"
                onClick={() => setShowCookies(true)}
                className="inline-flex items-center gap-1.5 hover:text-white transition"
              >
                <Cookie size={12} />
                Cookie preferences
              </button>
            </div>
          </div>
        </div>
      </footer>

      {showCookies && <CookiePreferences onClose={() => setShowCookies(false)} />}
    </>
  );
}
