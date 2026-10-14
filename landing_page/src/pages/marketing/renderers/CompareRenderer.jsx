import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Check,
  X,
  Minus,
  Sparkles,
  ArrowRight,
  TrendingDown,
  ShieldCheck,
  Zap,
  Building,
  Layers,
  HelpCircle
} from "lucide-react";
import { resolveRelated } from "../content/index";
import { Section, SectionHeading, StatStrip, CtaBanner, RelatedRail } from "./shared";

export default function CompareRenderer({ page }) {
  const [activeCompetitor, setActiveCompetitor] = useState("bsps"); // bsps | helpdesks | crms
  const [monthlyVolume, setMonthlyVolume] = useState(100000); // 100k messages

  const comparisons = page.comparisons || {};
  const currentComparison = comparisons[activeCompetitor] || comparisons.bsps;
  const differentiators = page.differentiators || [];
  const related = resolveRelated(page.related);

  // Calculate estimated savings based on BSP markup vs Madhura $0 markup
  const bspMarkupPerMsg = 0.0035; // typical BSP markup ~$0.0035 per message
  const monthlySavings = Math.round(monthlyVolume * bspMarkupPerMsg);
  const annualSavings = monthlySavings * 12;

  const renderStatus = (val) => {
    if (val === true) {
      return (
        <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-emerald-100 text-emerald-700">
          <Check size={14} strokeWidth={3} />
        </span>
      );
    }
    if (val === false) {
      return (
        <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-slate-100 text-slate-400">
          <X size={14} strokeWidth={2.5} />
        </span>
      );
    }
    if (val === "partial") {
      return (
        <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
          <Minus size={14} strokeWidth={3} />
        </span>
      );
    }
    return <span className="text-xs font-semibold text-slate-700">{val}</span>;
  };

  return (
    <>
      <StatStrip stats={page.stats} />

      {/* Hero & Competitor Category Switcher */}
      <Section className="bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <SectionHeading
            center
            eyebrow="Objective Comparison"
            title="How MADHURA Compares Head-to-Head"
            sub="An honest side-by-side evaluation against traditional WhatsApp BSPs, legacy helpdesks, and generic CRM suites."
          />

          <div className="mt-8 inline-flex rounded-full bg-slate-100 p-1.5 shadow-inner">
            <button
              type="button"
              onClick={() => setActiveCompetitor("bsps")}
              className={`px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold transition ${
                activeCompetitor === "bsps"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              vs. Traditional BSPs (Wati, Interakt, Aisensy)
            </button>
            <button
              type="button"
              onClick={() => setActiveCompetitor("helpdesks")}
              className={`px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold transition ${
                activeCompetitor === "helpdesks"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              vs. Legacy Helpdesks (Zendesk, Freshdesk)
            </button>
            <button
              type="button"
              onClick={() => setActiveCompetitor("crms")}
              className={`px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold transition ${
                activeCompetitor === "crms"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              vs. Generic CRMs (HubSpot, Zoho)
            </button>
          </div>
        </div>

        {/* Side-by-Side Comparison Matrix Table */}
        <div className="mt-14 max-w-5xl mx-auto">
          <div className="overflow-x-auto rounded-3xl border border-slate-200 shadow-sm bg-white">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#050e2f] text-white">
                  <th className="p-5 sm:p-6 text-sm font-bold w-2/5">Platform Capability</th>
                  <th className="p-5 sm:p-6 text-sm font-bold text-cyan-400 bg-blue-950/60 border-x border-white/10 w-3/10">
                    <div className="flex items-center gap-1.5">
                      <span>MADHURA</span>
                      <span className="text-[10px] font-black uppercase bg-blue-600 text-white px-2 py-0.5 rounded-full">
                        Enterprise
                      </span>
                    </div>
                  </th>
                  <th className="p-5 sm:p-6 text-sm font-bold text-slate-300 w-3/10">
                    {currentComparison?.competitorName || "Traditional Alternatives"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                {currentComparison?.matrix?.map((category, catIdx) => (
                  <>
                    <tr key={catIdx} className="bg-slate-50/80 font-black text-slate-800">
                      <td colSpan={3} className="px-5 sm:px-6 py-3 uppercase tracking-wider text-[11px] text-blue-700">
                        {category.categoryName}
                      </td>
                    </tr>
                    {category.items.map((item, itemIdx) => (
                      <tr
                        key={itemIdx}
                        className="hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="px-5 sm:px-6 py-4">
                          <div className="font-bold text-slate-900">{item.feature}</div>
                          {item.note && (
                            <div className="text-[11px] text-slate-500 mt-0.5">{item.note}</div>
                          )}
                        </td>
                        <td className="px-5 sm:px-6 py-4 bg-blue-50/30 border-x border-slate-100 font-semibold text-slate-900">
                          <div className="flex items-center gap-2">
                            {renderStatus(item.madhura)}
                            {item.madhuraLabel && (
                              <span className="text-xs font-bold text-blue-950">
                                {item.madhuraLabel}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 sm:px-6 py-4 text-slate-600">
                          <div className="flex items-center gap-2">
                            {renderStatus(item.competitor)}
                            {item.competitorLabel && (
                              <span className="text-xs text-slate-500">
                                {item.competitorLabel}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      {/* Interactive TCO Calculator: Direct Meta API Savings */}
      <Section className="bg-slate-50 border-y border-slate-200">
        <div className="max-w-4xl mx-auto rounded-3xl bg-white border border-slate-200 p-8 sm:p-12 shadow-sm">
          <div className="text-center max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              Interactive Cost Calculator
            </span>
            <h3 className="mt-3 text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              See How Much You Save with Zero Message Markup
            </h3>
            <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
              Unlike traditional BSPs that charge a per-message markup (often $0.003 to $0.006 per message on top of Meta fees), MADHURA passes Meta Cloud API costs through directly with 0% markup.
            </p>
          </div>

          <div className="mt-10 max-w-xl mx-auto space-y-6">
            <div>
              <div className="flex justify-between items-center text-sm font-bold text-slate-900 mb-2">
                <span>Monthly WhatsApp Message Volume:</span>
                <span className="text-blue-600 text-base">{monthlyVolume.toLocaleString()} msgs / mo</span>
              </div>
              <input
                type="range"
                min="10000"
                max="1000000"
                step="10000"
                value={monthlyVolume}
                onChange={(e) => setMonthlyVolume(Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
              />
              <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                <span>10,000</span>
                <span>250,000</span>
                <span>500,000</span>
                <span>1,000,000+</span>
              </div>
            </div>

            {/* Savings Callout Display */}
            <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
              <div className="rounded-2xl bg-emerald-50/70 border border-emerald-200 p-5 text-center">
                <div className="text-xs font-bold uppercase tracking-wide text-emerald-800">
                  Estimated Monthly Savings
                </div>
                <div className="mt-2 text-3xl font-black text-emerald-600">
                  ${monthlySavings.toLocaleString()}
                </div>
                <div className="text-[11px] text-emerald-700 mt-1 font-medium">
                  Eliminated markup fees
                </div>
              </div>

              <div className="rounded-2xl bg-[#050e2f] text-white p-5 text-center">
                <div className="text-xs font-bold uppercase tracking-wide text-cyan-400">
                  Projected Annual Savings
                </div>
                <div className="mt-2 text-3xl font-black text-white">
                  ${annualSavings.toLocaleString()} / yr
                </div>
                <div className="text-[11px] text-slate-400 mt-1 font-medium">
                  Direct bottom-line ROI
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Core Architectural Differentiators Grid */}
      <Section className="bg-white">
        <SectionHeading
          eyebrow="Architectural Advantage"
          title="Why Enterprise Teams Switch to MADHURA"
          sub="Engineered from day one for multi-location teams, high delivery assurance, and strict role segregation."
        />
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {differentiators.map((diff, i) => (
            <div
              key={i}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs hover:border-blue-400 transition"
            >
              <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                <Zap size={20} />
              </div>
              <h4 className="text-base font-bold text-slate-900">{diff.title}</h4>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">{diff.description}</p>
            </div>
          ))}
        </div>
      </Section>

      <RelatedRail pages={related} />
      <CtaBanner cta={page.cta} />
    </>
  );
}
