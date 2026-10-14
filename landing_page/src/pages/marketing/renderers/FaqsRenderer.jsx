import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  X,
  ChevronDown,
  HelpCircle,
  MessageCircle,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Sparkles
} from "lucide-react";
import { resolveRelated } from "../content/index";
import { Section, SectionHeading, StatStrip, CtaBanner, RelatedRail } from "./shared";

export default function FaqsRenderer({ page }) {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [openItems, setOpenItems] = useState({ 0: true }); // first open by default

  const categories = page.categories || [];
  const faqItems = page.faqItems || [];
  const related = resolveRelated(page.related);

  const filteredFaqs = useMemo(() => {
    let list = faqItems;
    if (selectedCategory !== "all") {
      list = list.filter((item) => item.category === selectedCategory);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (item) =>
          item.q.toLowerCase().includes(q) ||
          item.a.toLowerCase().includes(q) ||
          (item.tags && item.tags.some((t) => t.toLowerCase().includes(q)))
      );
    }
    return list;
  }, [faqItems, selectedCategory, query]);

  const toggleItem = (idx) => {
    setOpenItems((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const expandAll = () => {
    const all = {};
    filteredFaqs.forEach((_, i) => (all[i] = true));
    setOpenItems(all);
  };

  const collapseAll = () => {
    setOpenItems({});
  };

  return (
    <>
      <StatStrip stats={page.stats} />

      {/* Hero & Search */}
      <Section className="bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <SectionHeading
            center
            eyebrow="Frequently Asked Questions"
            title="Everything You Need to Know About MADHURA"
            sub="Transparent answers regarding WhatsApp Cloud API pricing, template rejection policies, multi-branch isolation, data security, and setup timelines."
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
              placeholder="Search all questions — 'pricing', 'rejection', 'export', 'subprocessors'..."
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

          {/* Category Navigation Pills */}
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition ${
                selectedCategory === "all"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-600"
              }`}
            >
              All Questions ({faqItems.length})
            </button>
            {categories.map((cat) => {
              const count = faqItems.filter((f) => f.category === cat.id).length;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition ${
                    selectedCategory === cat.id
                      ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                  }`}
                >
                  {cat.label} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* FAQ Accordion List */}
        <div className="mt-14 max-w-4xl mx-auto">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 text-xs">
            <span className="text-slate-500 font-medium">
              Showing {filteredFaqs.length} questions
            </span>
            <div className="flex items-center gap-3 font-semibold text-blue-600">
              <button type="button" onClick={expandAll} className="hover:underline">
                Expand all
              </button>
              <span>•</span>
              <button type="button" onClick={collapseAll} className="hover:underline">
                Collapse all
              </button>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {filteredFaqs.map((faq, idx) => {
              const isOpen = !!openItems[idx];
              return (
                <div
                  key={idx}
                  className={`rounded-2xl border transition-all ${
                    isOpen
                      ? "border-blue-300 bg-white shadow-sm ring-1 ring-blue-500/10"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleItem(idx)}
                    className="w-full flex items-start justify-between gap-4 p-5 sm:p-6 text-left"
                  >
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                        {faq.category}
                      </span>
                      <h3 className="mt-2 text-base sm:text-lg font-bold text-slate-900 leading-snug">
                        {faq.q}
                      </h3>
                    </div>
                    <ChevronDown
                      size={20}
                      className={`mt-1 shrink-0 text-slate-400 transition-transform ${
                        isOpen ? "rotate-180 text-blue-600" : ""
                      }`}
                    />
                  </button>

                  {isOpen && (
                    <div className="px-5 sm:px-6 pb-6 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-4 space-y-3">
                      <p>{faq.a}</p>
                      {faq.details && (
                        <ul className="space-y-1.5 pt-2">
                          {faq.details.map((d, dIdx) => (
                            <li key={dIdx} className="flex items-start gap-2 text-xs sm:text-sm text-slate-700">
                              <CheckCircle2 size={15} className="text-blue-600 shrink-0 mt-0.5" />
                              <span>{d}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {filteredFaqs.length === 0 && (
            <div className="text-center py-16">
              <HelpCircle size={40} className="mx-auto text-slate-300" />
              <p className="mt-4 text-base font-bold text-slate-800">No questions found matching “{query}”</p>
              <button
                onClick={() => {
                  setQuery("");
                  setSelectedCategory("all");
                }}
                className="mt-3 text-xs font-bold text-blue-600 hover:underline"
              >
                Clear search query
              </button>
            </div>
          )}
        </div>
      </Section>

      {/* Still have questions? Section */}
      <Section className="bg-slate-50 border-t border-slate-200">
        <div className="max-w-4xl mx-auto rounded-3xl bg-white border border-slate-200 p-8 sm:p-10 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
              Personalized Consultation
            </span>
            <h3 className="mt-3 text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Have a custom enterprise architecture question?
            </h3>
            <p className="mt-2 text-xs sm:text-sm text-slate-500 leading-relaxed max-w-xl">
              Talk directly to our solution architects about high-throughput burst sizing, SSO setup, or on-premise CRM data synchronization.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <Link
              to="/demo"
              className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-6 py-3 rounded-full transition shadow-md shadow-blue-500/20"
            >
              Book 1-on-1 Demo <ArrowRight size={14} />
            </Link>
            <Link
              to="/company/contact"
              className="inline-flex items-center justify-center gap-2 border border-slate-300 hover:border-slate-400 text-slate-700 font-semibold text-xs px-6 py-3 rounded-full transition"
            >
              Contact Sales
            </Link>
          </div>
        </div>
      </Section>

      <RelatedRail pages={related} />
      <CtaBanner cta={page.cta} />
    </>
  );
}
