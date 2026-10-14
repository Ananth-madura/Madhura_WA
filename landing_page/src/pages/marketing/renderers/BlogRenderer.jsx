import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  X,
  Clock,
  Calendar,
  User,
  ArrowRight,
  Sparkles,
  BookOpen,
  Share2,
  Check,
  Send,
  Tag
} from "lucide-react";
import { resolveRelated } from "../content/index";
import { Section, SectionHeading, StatStrip, CtaBanner, RelatedRail } from "./shared";

export default function BlogRenderer({ page }) {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [activeArticleModal, setActiveArticleModal] = useState(null);
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const articles = page.articles || [];
  const categories = page.categories || [];
  const featured = page.featuredArticle || articles[0];
  const related = resolveRelated(page.related);

  const filteredArticles = useMemo(() => {
    let list = articles;
    if (selectedCategory !== "all") {
      list = list.filter((a) => a.category.toLowerCase() === selectedCategory.toLowerCase());
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.summary.toLowerCase().includes(q) ||
          (a.tags && a.tags.some((t) => t.toLowerCase().includes(q))) ||
          (a.author && a.author.toLowerCase().includes(q))
      );
    }
    return list;
  }, [articles, selectedCategory, query]);

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (newsletterEmail && newsletterEmail.includes("@")) {
      setSubscribed(true);
    }
  };

  return (
    <>
      <StatStrip stats={page.stats} />

      {/* Hero Header & Filters */}
      <Section className="bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <SectionHeading
            center
            eyebrow="Blog & Insights"
            title="Strategic Insights for Enterprise WhatsApp Engagement"
            sub="Deep-dives into deliverability, Meta pricing changes, automation engineering, and conversational commerce frameworks."
          />

          <div className="mt-8 relative max-w-xl mx-auto">
            <Search
              size={18}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search articles — 'pricing', 'quality rating', 'flows', 'drip'..."
              className="w-full rounded-full border border-slate-200 bg-white pl-11 pr-10 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition ${
                selectedCategory === "all"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-600"
              }`}
            >
              All Articles ({articles.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition ${
                  selectedCategory.toLowerCase() === cat.toLowerCase()
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Featured Flagship Article (if not searching) */}
        {!query && selectedCategory === "all" && featured && (
          <div className="mt-14 max-w-5xl mx-auto">
            <div className="relative rounded-3xl bg-[#070b16] text-white p-8 sm:p-12 border border-white/10 shadow-2xl overflow-hidden">
              <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-blue-600/20 blur-3xl pointer-events-none" />

              <div className="relative z-10 grid lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-8">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-black uppercase tracking-widest text-cyan-400 bg-cyan-950/60 border border-cyan-500/30 px-3 py-1 rounded-full">
                      ★ Featured Analysis
                    </span>
                    <span className="text-xs text-slate-400">• {featured.readTime}</span>
                  </div>

                  <h3 className="mt-4 text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight">
                    {featured.title}
                  </h3>

                  <p className="mt-4 text-sm sm:text-base text-slate-300 leading-relaxed">
                    {featured.summary}
                  </p>

                  <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-blue-500 text-white font-bold flex items-center justify-center text-[10px]">
                        {featured.author?.charAt(0) || "M"}
                      </div>
                      <span className="text-white font-semibold">{featured.author}</span>
                    </div>
                    <span>•</span>
                    <div className="flex items-center gap-1">
                      <Calendar size={13} /> {featured.date}
                    </div>
                  </div>

                  <div className="mt-8">
                    <button
                      type="button"
                      onClick={() => setActiveArticleModal(featured)}
                      className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm px-6 py-3 rounded-full transition shadow-lg shadow-blue-500/30"
                    >
                      Read In-Depth Analysis <ArrowRight size={15} />
                    </button>
                  </div>
                </div>

                <div className="lg:col-span-4 bg-white/5 rounded-2xl p-6 border border-white/10 backdrop-blur-sm">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-300 mb-3">
                    Core Takeaways
                  </h4>
                  <ul className="space-y-3 text-xs sm:text-sm text-slate-300">
                    {featured.keyTakeaways?.map((point, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 mt-2 shrink-0" />
                        <span className="leading-relaxed">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Articles Grid */}
        <div className="mt-14 max-w-6xl mx-auto">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <h3 className="text-xl font-black text-slate-900 tracking-tight">Recent Articles</h3>
            <span className="text-xs text-slate-500">{filteredArticles.length} publications</span>
          </div>

          <div className="mt-8 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {filteredArticles.map((article) => (
              <article
                key={article.id}
                onClick={() => setActiveArticleModal(article)}
                className="cursor-pointer group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-xs hover:border-blue-400 hover:shadow-card transition-all"
              >
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full">
                      {article.category}
                    </span>
                    <span className="text-slate-400 flex items-center gap-1">
                      <Clock size={12} /> {article.readTime}
                    </span>
                  </div>

                  <h4 className="mt-3 text-base sm:text-lg font-bold text-slate-900 group-hover:text-blue-600 transition leading-snug">
                    {article.title}
                  </h4>

                  <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed line-clamp-3">
                    {article.summary}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-[10px]">
                      {article.author?.charAt(0) || "M"}
                    </div>
                    <span className="text-slate-700 font-medium">{article.author}</span>
                  </div>
                  <span className="font-bold text-blue-600 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    Read <ArrowRight size={12} />
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </Section>

      {/* Newsletter Subscription Banner */}
      <Section className="bg-slate-50 border-y border-slate-200">
        <div className="max-w-3xl mx-auto text-center rounded-3xl bg-[#0b1224] text-white p-8 sm:p-12 border border-white/10 shadow-xl">
          <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 bg-cyan-950/70 border border-cyan-500/30 px-3 py-1 rounded-full">
            Bi-Weekly Engineering Briefing
          </span>
          <h3 className="mt-4 text-2xl sm:text-3xl font-black text-white tracking-tight">
            Stay Ahead of Meta WhatsApp Ecosystem Changes
          </h3>
          <p className="mt-3 text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
            Get practical analysis on WhatsApp Cloud API updates, template approval shifts, and automation architecture directly in your inbox. No spam.
          </p>

          {subscribed ? (
            <div className="mt-6 inline-flex items-center gap-2 bg-emerald-950 text-emerald-300 border border-emerald-500/30 px-6 py-3 rounded-full text-sm font-bold">
              <Check size={16} /> You are subscribed! Next edition drops this Tuesday.
            </div>
          ) : (
            <form onSubmit={handleSubscribe} className="mt-6 flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <input
                type="email"
                required
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                placeholder="Enter your work email address"
                className="flex-1 rounded-full bg-white/10 border border-white/20 px-5 py-3 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm px-6 py-3 rounded-full transition shadow-lg shadow-blue-500/20 shrink-0"
              >
                Subscribe
              </button>
            </form>
          )}
        </div>
      </Section>

      {/* In-Depth Article Reader Modal */}
      {activeArticleModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-fade-in">
          <div className="relative w-full max-w-3xl rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full">
                  {activeArticleModal.category}
                </span>
                <span className="text-xs text-slate-400">• {activeArticleModal.readTime}</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveArticleModal(null)}
                className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 sm:p-10 overflow-y-auto space-y-6">
              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
                  {activeArticleModal.title}
                </h2>
                <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">{activeArticleModal.author}</span>
                  <span>•</span>
                  <span>{activeArticleModal.date}</span>
                </div>
              </div>

              {/* Lead paragraph */}
              <p className="text-base font-medium text-slate-700 leading-relaxed border-l-4 border-blue-600 pl-4 py-1 bg-slate-50 rounded-r-xl">
                {activeArticleModal.summary}
              </p>

              {/* Article Sections / Content */}
              {activeArticleModal.sections?.map((sec, i) => (
                <div key={i} className="space-y-3">
                  <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                    {sec.heading}
                  </h3>
                  {sec.paragraphs?.map((p, pIdx) => (
                    <p key={pIdx} className="text-sm text-slate-600 leading-relaxed">
                      {p}
                    </p>
                  ))}
                  {sec.bullets && (
                    <ul className="space-y-2 pt-1">
                      {sec.bullets.map((b, bIdx) => (
                        <li key={bIdx} className="flex items-start gap-2.5 text-sm text-slate-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-600 mt-2 shrink-0" />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}

              {/* Author bio & Actions */}
              <div className="mt-8 pt-6 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-sm">
                    {activeArticleModal.author?.charAt(0) || "M"}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">{activeArticleModal.author}</p>
                    <p className="text-[11px] text-slate-500">Published on {activeArticleModal.date}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveArticleModal(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold px-5 py-2.5 rounded-full transition"
                >
                  Close Article
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <RelatedRail pages={related} />
      <CtaBanner cta={page.cta} />
    </>
  );
}
