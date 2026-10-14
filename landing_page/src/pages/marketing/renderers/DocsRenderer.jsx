import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, ChevronDown, Code, ListChecks, Search, X } from "lucide-react";
import { resolveIcon } from "../iconMap";
import { resolveRelated } from "../content/index";
import { CtaBanner, RelatedRail, Section } from "./shared";

/* Documentation hub: searchable index over every article, each of which expands
   in place. Deep links work — /docs#connect-number opens that article. */

function ArticleBody({ article }) {
  return (
    <div className="space-y-4">
      {(article.body || []).map((para, i) => (
        <p key={para.slice(0, 40)} className="text-sm text-slate-600 leading-relaxed">
          {para}
        </p>
      ))}

      {article.steps?.length > 0 && (
        <ol className="space-y-2 pt-1">
          {article.steps.map((step, i) => (
            <li key={step} className="flex items-start gap-3 text-sm text-slate-700">
              <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <span className="leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
      )}

      {article.list?.length > 0 && (
        <ul className="space-y-2 pt-1">
          {article.list.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm text-slate-600">
              <Check size={15} className="mt-0.5 shrink-0 text-blue-600" />
              <span className="leading-relaxed">{item}</span>
            </li>
          ))}
        </ul>
      )}

      {article.code && (
        <figure className="pt-1">
          <figcaption className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
            {article.code.label}
          </figcaption>
          <pre className="rounded-xl bg-[#0b1224] text-slate-100 p-4 text-xs leading-relaxed overflow-x-auto">
            <code>{article.code.text}</code>
          </pre>
        </figure>
      )}
    </div>
  );
}

export default function DocsRenderer({ page }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(() => {
    const hash = typeof window !== "undefined" ? window.location.hash.slice(1) : "";
    if (!hash) return null;
    for (const category of page.categories) {
      if (category.articles.some((a) => a.id === hash)) return `${category.id}:${hash}`;
    }
    return null;
  });

  const related = resolveRelated(page.related);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return page.categories;
    return page.categories
      .map((category) => {
        const articles = category.articles.filter((a) =>
          `${a.title} ${a.summary} ${(a.body || []).join(" ")} ${(a.list || []).join(" ")} ${(
            a.steps || []
          ).join(" ")}`
            .toLowerCase()
            .includes(q)
        );
        return articles.length ? { ...category, articles } : null;
      })
      .filter(Boolean);
  }, [page.categories, query]);

  const totalArticles = filtered.reduce((sum, c) => sum + c.articles.length, 0);
  const apiCategory =
    filtered.find((c) => c.id === "api") || page.categories.find((c) => c.id === "api") || null;

  const toggle = (key) => setOpen((current) => (current === key ? null : key));

  return (
    <>
      <Section className="bg-white">
        <div className="max-w-2xl">
          <div className="relative">
            <Search
              size={18}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search guides — templates, webhooks, delivery, assignment…"
              aria-label="Search documentation"
              className="w-full rounded-full border border-slate-200 bg-white pl-11 pr-11 py-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {totalArticles} article{totalArticles === 1 ? "" : "s"} across {filtered.length}{" "}
            categor{filtered.length === 1 ? "y" : "ies"}
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {page.categories.map((category) => {
            const Icon = resolveIcon(category.icon);
            const visible = filtered.find((c) => c.id === category.id)?.articles || [];
            return (
              <a
                key={category.id}
                href={`#${category.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(category.id)?.scrollIntoView({ behavior: "smooth" });
                }}
                className="group rounded-2xl border border-slate-200 bg-white p-6 hover:border-blue-300 hover:shadow-card transition"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Icon size={18} />
                </span>
                <h2 className="mt-4 text-base font-bold text-slate-900 group-hover:text-blue-600 transition">
                  {category.title}
                </h2>
                <p className="mt-2 text-sm text-slate-500 leading-relaxed">{category.desc}</p>
                <p className="mt-3 text-xs font-semibold text-slate-400">
                  {visible.length} article{visible.length === 1 ? "" : "s"}
                </p>
              </a>
            );
          })}
        </div>
      </Section>

      {filtered.length === 0 && (
        <Section className="bg-slate-50 border-y border-slate-200">
          <div className="text-center py-8">
            <p className="text-base font-bold text-slate-900">No articles match “{query}”</p>
            <p className="mt-2 text-sm text-slate-500">
              Try a broader term, or ask support — unanswered searches are how we pick the next
              article to write.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => setQuery("")}
                className="inline-flex items-center gap-2 border border-slate-300 hover:border-slate-400 text-slate-700 font-semibold text-sm px-6 py-3 rounded-full transition"
              >
                Clear search
              </button>
              <Link
                to="/company/contact"
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm px-6 py-3 rounded-full transition"
              >
                Contact support
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </Section>
      )}

      {filtered.map((category) => {
        const Icon = resolveIcon(category.icon);
        return (
          <Section
            key={category.id}
            id={category.id}
            className="bg-slate-50 border-t border-slate-200 scroll-mt-24"
          >
            <div className="flex items-start gap-4">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
                <Icon size={20} />
              </span>
              <div>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                  {category.title}
                </h2>
                <p className="mt-1 text-sm text-slate-500">{category.desc}</p>
              </div>
            </div>

            <div className="mt-8 space-y-3">
              {category.articles.map((article) => {
                const key = `${category.id}:${article.id}`;
                const expanded = open === key;
                return (
                  <article
                    key={article.id}
                    id={article.id}
                    className={`rounded-2xl border bg-white transition scroll-mt-28 ${
                      expanded ? "border-blue-300 shadow-card" : "border-slate-200"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggle(key)}
                      aria-expanded={expanded}
                      aria-controls={`${article.id}-body`}
                      className="w-full flex items-start justify-between gap-4 p-5 text-left"
                    >
                      <span className="min-w-0">
                        <h3 className="text-sm sm:text-base font-bold text-slate-900">
                          {article.title}
                        </h3>
                        <p className="mt-1 text-sm text-slate-500 leading-relaxed">
                          {article.summary}
                        </p>
                      </span>
                      <ChevronDown
                        size={18}
                        className={`mt-1 shrink-0 text-slate-400 transition-transform ${
                          expanded ? "rotate-180 text-blue-600" : ""
                        }`}
                      />
                    </button>
                    {expanded && (
                      <div id={`${article.id}-body`} className="px-5 pb-6 border-t border-slate-100 pt-5">
                        <ArticleBody article={article} />
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </Section>
        );
      })}

      <Section className="bg-white border-t border-slate-200">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 flex flex-wrap items-center justify-between gap-6">
          <div className="max-w-xl">
            <h2 className="text-lg font-bold text-slate-900">Building against the API?</h2>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
              Authentication, webhooks, retries and the CRM connector are documented under
              Integrations. If something is missing, tell us — the docs track real support
              questions.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!apiCategory}
              onClick={() => setOpen(`${apiCategory.id}:authentication`)}
              className="inline-flex items-center gap-2 bg-[#0b1224] text-white font-bold text-sm px-6 py-3 rounded-full transition hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
            >
              <Code size={15} />
              API auth
            </button>
            <button
              type="button"
              disabled={!apiCategory}
              onClick={() => setOpen(`${apiCategory.id}:webhooks`)}
              className="inline-flex items-center gap-2 border border-slate-300 hover:border-slate-400 text-slate-700 font-semibold text-sm px-6 py-3 rounded-full transition disabled:opacity-40"
            >
              <ListChecks size={15} />
              Webhook events
            </button>
          </div>
        </div>
      </Section>

      <RelatedRail pages={related} />
      <CtaBanner cta={page.cta} />
    </>
  );
}
