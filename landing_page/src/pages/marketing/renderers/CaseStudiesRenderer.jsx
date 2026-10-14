import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  TrendingUp,
  Clock,
  CheckCircle2,
  Building,
  Quote,
  ArrowRight,
  X,
  Sparkles,
  BarChart3,
  Award,
  Users
} from "lucide-react";
import { resolveRelated } from "../content/index";
import { Section, SectionHeading, StatStrip, CtaBanner, RelatedRail } from "./shared";

export default function CaseStudiesRenderer({ page }) {
  const [selectedIndustry, setSelectedIndustry] = useState("all");
  const [activeStory, setActiveStory] = useState(null);

  const studies = page.caseStudies || [];
  const industries = page.industries || [];
  const related = resolveRelated(page.related);

  const filteredStudies = useMemo(() => {
    if (selectedIndustry === "all") return studies;
    return studies.filter(
      (s) => s.industry.toLowerCase() === selectedIndustry.toLowerCase()
    );
  }, [studies, selectedIndustry]);

  return (
    <>
      <StatStrip stats={page.stats} />

      {/* Hero & Industry Filter */}
      <Section className="bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <SectionHeading
            center
            eyebrow="Customer Impact"
            title="Proven Results Across High-Volume Teams"
            sub="See how enterprise brands, multi-branch healthcare networks, and fast-growing retailers scaled WhatsApp engagement with zero delivery degradation."
          />

          <div className="mt-8 flex flex-wrap justify-center gap-2">
            <button
              onClick={() => setSelectedIndustry("all")}
              className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition ${
                selectedIndustry === "all"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-600"
              }`}
            >
              All Industries ({studies.length})
            </button>
            {industries.map((ind) => (
              <button
                key={ind}
                onClick={() => setSelectedIndustry(ind)}
                className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition ${
                  selectedIndustry.toLowerCase() === ind.toLowerCase()
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                }`}
              >
                {ind}
              </button>
            ))}
          </div>
        </div>

        {/* Case Studies Cards Grid */}
        <div className="mt-14 max-w-6xl mx-auto grid gap-8 md:grid-cols-2">
          {filteredStudies.map((study) => (
            <div
              key={study.id}
              onClick={() => setActiveStory(study)}
              className="cursor-pointer group rounded-3xl border border-slate-200 bg-white p-8 shadow-xs hover:border-blue-400 hover:shadow-card transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                    {study.industry}
                  </span>
                  <span className="text-xs font-semibold text-slate-400">{study.companyScale}</span>
                </div>

                <h3 className="mt-4 text-xl sm:text-2xl font-black text-slate-900 group-hover:text-blue-600 transition leading-snug">
                  {study.company}: {study.headline}
                </h3>

                <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                  {study.summary}
                </p>

                {/* Key Metrics Highlight Grid */}
                <div className="mt-6 grid grid-cols-2 gap-3 bg-slate-50 rounded-2xl p-4 border border-slate-100">
                  {study.metrics?.slice(0, 2).map((m, i) => (
                    <div key={i}>
                      <div className="text-xl sm:text-2xl font-black text-blue-600 tracking-tight">
                        {m.value}
                      </div>
                      <div className="text-xs text-slate-500 font-medium leading-tight mt-0.5">
                        {m.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quote teaser */}
              <div className="mt-6 pt-4 border-t border-slate-100">
                <p className="text-xs italic text-slate-500 line-clamp-2">
                  “{study.quote?.text}”
                </p>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">{study.quote?.author}</span>
                  <span className="font-bold text-blue-600 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    Read Full Story <ArrowRight size={13} />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Interactive Case Study Modal */}
      {activeStory && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-fade-in">
          <div className="relative w-full max-w-4xl rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 sm:px-8 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-0.5 rounded-full">
                  {activeStory.industry}
                </span>
                <span className="text-xs text-slate-400">• {activeStory.company}</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveStory(null)}
                className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 sm:p-10 overflow-y-auto space-y-8">
              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
                  {activeStory.headline}
                </h2>
                <p className="mt-3 text-base text-slate-600 leading-relaxed">
                  {activeStory.summary}
                </p>
              </div>

              {/* Stats Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-blue-50/60 rounded-2xl p-5 border border-blue-100">
                {activeStory.metrics?.map((m, i) => (
                  <div key={i} className="text-center sm:text-left">
                    <div className="text-2xl sm:text-3xl font-black text-blue-600">{m.value}</div>
                    <div className="text-xs font-semibold text-slate-700 mt-1">{m.label}</div>
                  </div>
                ))}
              </div>

              {/* Challenge vs Solution Breakdown */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-6 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-rose-600">
                    The Challenge
                  </h4>
                  <h5 className="text-base font-bold text-slate-900">
                    {activeStory.challenge?.title}
                  </h5>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {activeStory.challenge?.description}
                  </p>
                  <ul className="space-y-2 pt-2">
                    {activeStory.challenge?.points?.map((pt, i) => (
                      <li key={i} className="text-xs text-slate-600 flex items-start gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl border border-blue-200 bg-blue-50/30 p-6 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-blue-600">
                    The MADHURA Architecture
                  </h4>
                  <h5 className="text-base font-bold text-slate-900">
                    {activeStory.solution?.title}
                  </h5>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {activeStory.solution?.description}
                  </p>
                  <ul className="space-y-2 pt-2">
                    {activeStory.solution?.points?.map((pt, i) => (
                      <li key={i} className="text-xs text-slate-600 flex items-start gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Executive Testimonial Quote */}
              {activeStory.quote && (
                <div className="rounded-2xl bg-[#050e2f] text-white p-6 sm:p-8 relative">
                  <Quote size={32} className="text-blue-500/30 mb-2" />
                  <p className="text-sm sm:text-base text-slate-200 italic leading-relaxed">
                    “{activeStory.quote.text}”
                  </p>
                  <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
                    <div>
                      <span className="font-bold text-white">{activeStory.quote.author}</span> —{" "}
                      <span>{activeStory.quote.role}</span>
                    </div>
                    <span className="text-blue-400 font-semibold">{activeStory.company}</span>
                  </div>
                </div>
              )}

              {/* Close Button */}
              <div className="pt-4 border-t border-slate-200 flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveStory(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold px-6 py-2.5 rounded-full transition"
                >
                  Close Story
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
