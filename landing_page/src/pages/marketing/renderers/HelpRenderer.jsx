import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  X,
  ChevronDown,
  ArrowRight,
  LifeBuoy,
  MessageCircle,
  FileText,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Clock,
  Shield,
  HelpCircle
} from "lucide-react";
import { resolveIcon } from "../iconMap";
import { resolveRelated } from "../content/index";
import { Section, SectionHeading, StatStrip, CtaBanner, RelatedRail } from "./shared";

export default function HelpRenderer({ page }) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [expandedFaq, setExpandedFaq] = useState(null);

  const categories = page.categories || [];
  const quickFixes = page.quickFixes || [];
  const articles = page.articles || [];
  const related = resolveRelated(page.related);

  const filteredArticles = useMemo(() => {
    let list = articles;
    if (activeCategory !== "all") {
      list = list.filter((a) => a.category === activeCategory);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.summary.toLowerCase().includes(q) ||
          (a.tags && a.tags.some((t) => t.toLowerCase().includes(q))) ||
          (a.content && a.content.some((c) => c.toLowerCase().includes(q)))
      );
    }
    return list;
  }, [articles, activeCategory, query]);

  return (
    <>
      <StatStrip stats={page.stats} />

      {/* Search & Categories Hero */}
      <Section className="bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <SectionHeading
            center
            eyebrow="Help Center"
            title="How can our support team help you today?"
            sub="Search across our knowledge base, common setup hurdles, Meta API troubleshooting, and account configuration."
          />

          <div className="mt-8 relative max-w-2xl mx-auto">
            <Search
              size={20}
              className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search help topics — 'template rejection', 'reset quality', 'webhooks', 'billing'..."
              className="w-full rounded-full border border-slate-200 bg-white pl-13 pr-12 py-4 text-base text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Quick Categories Filter */}
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => setActiveCategory("all")}
              className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition ${
                activeCategory === "all"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-600"
              }`}
            >
              All Topics ({articles.length})
            </button>
            {categories.map((cat) => {
              const count = articles.filter((a) => a.category === cat.id).length;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition ${
                    activeCategory === cat.id
                      ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                  }`}
                >
                  {cat.title} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Category Cards Overview */}
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((cat) => {
            const Icon = resolveIcon(cat.icon);
            const count = articles.filter((a) => a.category === cat.id).length;
            const isSelected = activeCategory === cat.id;
            return (
              <div
                key={cat.id}
                onClick={() => setActiveCategory(isSelected ? "all" : cat.id)}
                className={`cursor-pointer rounded-2xl border p-6 transition-all hover:-translate-y-1 ${
                  isSelected
                    ? "border-blue-500 bg-blue-50/50 shadow-md ring-1 ring-blue-500"
                    : "border-slate-200 bg-white hover:border-blue-300 hover:shadow-card"
                }`}
              >
                <div className="h-11 w-11 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-4">
                  <Icon size={22} />
                </div>
                <h3 className="text-base font-bold text-slate-900">{cat.title}</h3>
                <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">{cat.desc}</p>
                <div className="mt-4 flex items-center justify-between text-xs font-semibold text-blue-600">
                  <span>{count} articles</span>
                  <ArrowRight size={14} />
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Top Troubleshooting / Quick Fixes */}
      {quickFixes.length > 0 && !query && activeCategory === "all" && (
        <Section className="bg-slate-50 border-y border-slate-200">
          <SectionHeading
            eyebrow="Instant Solvers"
            title="Fast resolutions for the 4 most frequent hurdles"
            sub="Step-by-step instructions to get past the common blockers without waiting for a support ticket."
          />
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {quickFixes.map((fix) => (
              <div
                key={fix.id}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-card transition"
              >
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <AlertCircle size={20} />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100/70 px-2.5 py-0.5 rounded-full">
                      {fix.badge}
                    </span>
                    <h4 className="mt-2 text-base font-bold text-slate-900">{fix.title}</h4>
                    <p className="mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
                      {fix.problem}
                    </p>
                  </div>
                </div>

                <div className="mt-5 border-t border-slate-100 pt-4">
                  <p className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    Resolution Steps:
                  </p>
                  <ol className="mt-2 space-y-1.5 text-xs sm:text-sm text-slate-600">
                    {fix.steps.map((st, i) => (
                      <li key={st} className="flex items-start gap-2">
                        <span className="h-4 w-4 shrink-0 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center mt-0.5">
                          {i + 1}
                        </span>
                        <span>{st}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Help Articles Directory */}
      <Section className="bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">
              Knowledge Base Articles
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Showing {filteredArticles.length} articles{" "}
              {activeCategory !== "all" ? `in ${activeCategory}` : ""}{" "}
              {query ? `matching "${query}"` : ""}
            </p>
          </div>
          {query && (
            <button
              onClick={() => {
                setQuery("");
                setActiveCategory("all");
              }}
              className="text-xs font-semibold text-blue-600 hover:underline self-start sm:self-auto"
            >
              Reset filters
            </button>
          )}
        </div>

        {filteredArticles.length === 0 ? (
          <div className="py-16 text-center">
            <HelpCircle size={40} className="mx-auto text-slate-300" />
            <p className="mt-4 text-base font-bold text-slate-800">
              No matching articles found for “{query}”
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Need assistance with an unlisted topic? Our support engineering team is here 24/7.
            </p>
            <Link
              to="/company/contact"
              className="mt-6 inline-flex items-center gap-2 bg-blue-600 text-white font-bold text-sm px-6 py-3 rounded-full hover:bg-blue-500 transition"
            >
              Open a Support Ticket <ArrowRight size={15} />
            </Link>
          </div>
        ) : (
          <div className="mt-8 divide-y divide-slate-200">
            {filteredArticles.map((art, idx) => {
              const isExpanded = expandedFaq === art.id;
              return (
                <div key={art.id} className="py-5">
                  <button
                    type="button"
                    onClick={() => setExpandedFaq(isExpanded ? null : art.id)}
                    className="w-full flex items-start justify-between gap-4 text-left group"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                          {art.category}
                        </span>
                        {art.readTime && (
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Clock size={11} /> {art.readTime}
                          </span>
                        )}
                      </div>
                      <h4 className="mt-2 text-base font-bold text-slate-900 group-hover:text-blue-600 transition">
                        {art.title}
                      </h4>
                      <p className="mt-1 text-sm text-slate-500 leading-relaxed">{art.summary}</p>
                    </div>
                    <ChevronDown
                      size={20}
                      className={`mt-1 shrink-0 text-slate-400 transition-transform ${
                        isExpanded ? "rotate-180 text-blue-600" : ""
                      }`}
                    />
                  </button>

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-slate-100 text-sm text-slate-600 space-y-3 leading-relaxed">
                      {art.content &&
                        art.content.map((p, i) => (
                          <p key={i} className="text-slate-700">
                            {p}
                          </p>
                        ))}
                      {art.steps && (
                        <div className="mt-3 bg-slate-50 rounded-xl p-4 border border-slate-200">
                          <p className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-2">
                            Step-by-Step Instructions:
                          </p>
                          <ol className="space-y-2">
                            {art.steps.map((st, i) => (
                              <li key={i} className="flex items-start gap-2.5 text-xs sm:text-sm">
                                <span className="h-4 w-4 shrink-0 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center mt-0.5">
                                  {i + 1}
                                </span>
                                <span>{st}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                      {art.note && (
                        <div className="mt-2 flex items-start gap-2 bg-blue-50 text-blue-800 rounded-lg p-3 text-xs leading-relaxed border border-blue-100">
                          <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-blue-600" />
                          <span>{art.note}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* Escalation / Direct Channels */}
      <Section className="bg-slate-50 border-t border-slate-200">
        <div className="grid md:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
              <MessageCircle size={20} />
            </div>
            <h4 className="text-base font-bold text-slate-900">Direct WhatsApp Desk</h4>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">
              Message our certified Meta Cloud API specialists directly on WhatsApp for live thread triage.
            </p>
            <div className="mt-4 text-xs font-semibold text-emerald-600 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Now • Avg reply &lt; 5 mins
            </div>
            <a
              href="https://wa.me/919840012345?text=Hi%20Madhura%20Support%2C%20I%20need%20help%20with%20my%20workspace"
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700"
            >
              Open WhatsApp Chat <ExternalLink size={13} />
            </a>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4">
              <LifeBuoy size={20} />
            </div>
            <h4 className="text-base font-bold text-slate-900">Enterprise Ticket Portal</h4>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">
              Submit reproducible technical logs, webhook payloads, and account escalation requests.
            </p>
            <div className="mt-4 text-xs font-semibold text-slate-500 flex items-center gap-1.5">
              <Clock size={13} />
              SLA Guarantee: 15m (Enterprise), 1h (Pro)
            </div>
            <Link
              to="/support/tickets"
              className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700"
            >
              Submit Ticket <ArrowRight size={13} />
            </Link>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
              <FileText size={20} />
            </div>
            <h4 className="text-base font-bold text-slate-900">Developer & API Docs</h4>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">
              Deep-dive into authentication, rate limits, REST endpoints, webhooks, and the CRM connector.
            </p>
            <div className="mt-4 text-xs font-semibold text-slate-500 flex items-center gap-1.5">
              <Shield size={13} />
              Full v1 & v2 OpenAPI specifications
            </div>
            <Link
              to="/docs"
              className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700"
            >
              Browse Docs <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </Section>

      <RelatedRail pages={related} />
      <CtaBanner cta={page.cta} />
    </>
  );
}
