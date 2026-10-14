import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  X,
  Clock,
  Code,
  Copy,
  Check,
  CheckCircle2,
  ChevronDown,
  ArrowRight,
  BookOpen,
  Terminal,
  Zap,
  Sparkles,
  GitBranch,
  ShieldCheck,
  AlertTriangle
} from "lucide-react";
import { resolveRelated } from "../content/index";
import { Section, SectionHeading, StatStrip, CtaBanner, RelatedRail } from "./shared";

export default function TutorialsRenderer({ page }) {
  const [query, setQuery] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState("all");
  const [selectedTopic, setSelectedTopic] = useState("all");
  const [activeTutorial, setActiveTutorial] = useState(null);
  const [copiedSnippet, setCopiedSnippet] = useState(null);

  const tutorials = page.tutorials || [];
  const topics = page.topics || [];
  const related = resolveRelated(page.related);

  const filteredTutorials = useMemo(() => {
    let list = tutorials;
    if (selectedDifficulty !== "all") {
      list = list.filter((t) => t.difficulty.toLowerCase() === selectedDifficulty.toLowerCase());
    }
    if (selectedTopic !== "all") {
      list = list.filter((t) => t.topic.toLowerCase() === selectedTopic.toLowerCase());
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          (t.tags && t.tags.some((tag) => tag.toLowerCase().includes(q)))
      );
    }
    return list;
  }, [tutorials, selectedDifficulty, selectedTopic, query]);

  const copyCode = (text, key) => {
    navigator.clipboard?.writeText(text);
    setCopiedSnippet(key);
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  const getDifficultyColor = (diff) => {
    switch (diff?.toLowerCase()) {
      case "beginner":
        return "text-emerald-700 bg-emerald-50 border-emerald-200";
      case "intermediate":
        return "text-blue-700 bg-blue-50 border-blue-200";
      case "advanced":
        return "text-purple-700 bg-purple-50 border-purple-200";
      default:
        return "text-slate-700 bg-slate-50 border-slate-200";
    }
  };

  return (
    <>
      <StatStrip stats={page.stats} />

      {/* Hero & Interactive Filters */}
      <Section className="bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <SectionHeading
            center
            eyebrow="Practical Walkthroughs"
            title="Step-by-Step Technical Recipes"
            sub="Hands-on tutorials for automation flows, webhooks, broadcast wave scheduling, and enterprise multi-branch routing."
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
              placeholder="Search tutorials — 'Shopify webhook', 'cart recovery', 'CSAT flow'..."
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

          {/* Difficulty and Topic Filters */}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <div className="inline-flex rounded-full bg-slate-100 p-1">
              {["all", "beginner", "intermediate", "advanced"].map((diff) => (
                <button
                  key={diff}
                  onClick={() => setSelectedDifficulty(diff)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold capitalize transition ${
                    selectedDifficulty === diff
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {diff}
                </button>
              ))}
            </div>

            {topics.length > 0 && (
              <div className="flex flex-wrap gap-1.5 justify-center">
                <button
                  onClick={() => setSelectedTopic("all")}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                    selectedTopic === "all"
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  All Topics
                </button>
                {topics.map((t) => (
                  <button
                    key={t}
                    onClick={() => setSelectedTopic(t)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                      selectedTopic === t
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tutorials Grid */}
        <div className="mt-14 max-w-6xl mx-auto">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredTutorials.map((tut) => (
              <div
                key={tut.id}
                onClick={() => setActiveTutorial(tut)}
                className="cursor-pointer group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-xs hover:border-blue-400 hover:shadow-card transition-all"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span
                      className={`font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border text-[10px] ${getDifficultyColor(
                        tut.difficulty
                      )}`}
                    >
                      {tut.difficulty}
                    </span>
                    <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                      <Clock size={12} /> {tut.duration}
                    </span>
                  </div>

                  <h3 className="mt-4 text-base sm:text-lg font-bold text-slate-900 group-hover:text-blue-600 transition leading-snug">
                    {tut.title}
                  </h3>

                  <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed line-clamp-3">
                    {tut.description}
                  </p>
                </div>

                <div className="mt-6">
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {tut.tags?.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-blue-600">
                    <span>{tut.steps?.length || 4} steps to complete</span>
                    <span className="flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      Start Guide <ArrowRight size={13} />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredTutorials.length === 0 && (
            <div className="text-center py-16">
              <BookOpen size={40} className="mx-auto text-slate-300" />
              <p className="mt-4 text-base font-bold text-slate-800">No tutorials match your filter</p>
              <p className="mt-1 text-xs text-slate-500">
                Try clearing search terms or difficulty toggles.
              </p>
              <button
                onClick={() => {
                  setQuery("");
                  setSelectedDifficulty("all");
                  setSelectedTopic("all");
                }}
                className="mt-4 text-xs font-bold text-blue-600 hover:underline"
              >
                Reset all filters
              </button>
            </div>
          )}
        </div>
      </Section>

      {/* Active Tutorial Modal / Drawer */}
      {activeTutorial && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-fade-in">
          <div className="relative w-full max-w-4xl rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 sm:px-8 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${getDifficultyColor(
                    activeTutorial.difficulty
                  )}`}
                >
                  {activeTutorial.difficulty}
                </span>
                <span className="text-xs text-slate-400">• {activeTutorial.duration}</span>
                <span className="text-xs text-slate-400">• {activeTutorial.topic}</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveTutorial(null)}
                className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 sm:p-10 overflow-y-auto space-y-8">
              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
                  {activeTutorial.title}
                </h2>
                <p className="mt-2 text-sm sm:text-base text-slate-600 leading-relaxed">
                  {activeTutorial.description}
                </p>
              </div>

              {/* Prerequisites */}
              {activeTutorial.prerequisites?.length > 0 && (
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                    Prerequisites before you begin:
                  </h4>
                  <ul className="grid sm:grid-cols-2 gap-2 text-xs text-slate-600">
                    {activeTutorial.prerequisites.map((req, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                        <span>{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Step by step guide */}
              <div className="space-y-6">
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                  Implementation Steps:
                </h3>
                {activeTutorial.steps?.map((step, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-3"
                  >
                    <div className="flex items-start gap-3">
                      <span className="h-6 w-6 rounded-full bg-blue-600 text-white text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <h4 className="text-base font-bold text-slate-900">{step.title}</h4>
                        <p className="mt-1 text-xs sm:text-sm text-slate-600 leading-relaxed">
                          {step.instructions}
                        </p>
                      </div>
                    </div>

                    {/* Step Code Block if any */}
                    {step.code && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between bg-[#050e2f] text-slate-300 px-4 py-2 rounded-t-xl text-xs font-mono">
                          <span>{step.code.label || "Code snippet"}</span>
                          <button
                            type="button"
                            onClick={() => copyCode(step.code.snippet, `tut-step-${idx}`)}
                            className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white"
                          >
                            {copiedSnippet === `tut-step-${idx}` ? (
                              <>
                                <Check size={13} className="text-emerald-400" /> Copied
                              </>
                            ) : (
                              <>
                                <Copy size={13} /> Copy
                              </>
                            )}
                          </button>
                        </div>
                        <pre className="bg-[#111e43] text-slate-100 p-4 rounded-b-xl text-xs overflow-x-auto font-mono leading-relaxed">
                          <code>{step.code.snippet}</code>
                        </pre>
                      </div>
                    )}

                    {step.tip && (
                      <div className="mt-2 flex items-start gap-2 text-xs text-blue-800 bg-blue-50/70 p-3 rounded-xl border border-blue-100">
                        <Sparkles size={15} className="text-blue-600 shrink-0 mt-0.5" />
                        <span>{step.tip}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Pitfalls & Verification */}
              {activeTutorial.verification && (
                <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5 text-xs text-emerald-900 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-emerald-800">
                    <CheckCircle2 size={16} /> How to Verify Success:
                  </div>
                  <p className="leading-relaxed">{activeTutorial.verification}</p>
                </div>
              )}

              {/* Close / Next Actions */}
              <div className="pt-6 border-t border-slate-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setActiveTutorial(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold px-6 py-2.5 rounded-full transition"
                >
                  Close Tutorial
                </button>
                <Link
                  to="/features"
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-6 py-2.5 rounded-full transition shadow-md shadow-blue-500/20"
                >
                  Try in Sandbox <ArrowRight size={14} />
                </Link>
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
