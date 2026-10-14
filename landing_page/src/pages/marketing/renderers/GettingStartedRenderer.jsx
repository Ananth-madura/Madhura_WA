import { useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  Circle,
  Copy,
  Check,
  ArrowRight,
  Sparkles,
  Rocket,
  ShieldCheck,
  Terminal,
  ExternalLink,
  Users,
  MessageSquare,
  FileCheck
} from "lucide-react";
import { resolveIcon } from "../iconMap";
import { resolveRelated } from "../content/index";
import { Section, SectionHeading, StatStrip, CtaBanner, RelatedRail } from "./shared";

export default function GettingStartedRenderer({ page }) {
  const [activeStep, setActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([0]); // First step marked complete by default
  const [copiedKey, setCopiedKey] = useState(null);

  const steps = page.onboardingSteps || [];
  const preflightChecks = page.preflightChecks || [];
  const related = resolveRelated(page.related);

  const toggleComplete = (idx) => {
    setCompletedSteps((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  const copyToClipboard = (text, key) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const progressPercentage = Math.round((completedSteps.length / (steps.length || 1)) * 100);

  return (
    <>
      <StatStrip stats={page.stats} />

      {/* Interactive Progress & Roadmap Bar */}
      <Section className="bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                Interactive Onboarding Roadmap
              </span>
              <h2 className="mt-2 text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Launch Your WhatsApp CRM in 6 Clear Milestones
              </h2>
            </div>
            <div className="sm:text-right">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Setup Progress
              </div>
              <div className="text-2xl font-black text-blue-600">
                {progressPercentage}% Completed
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4 w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-blue-600 h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>

          {/* Step Pill Selectors */}
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {steps.map((st, idx) => {
              const isSelected = activeStep === idx;
              const isDone = completedSteps.includes(idx);
              return (
                <button
                  key={st.id}
                  onClick={() => setActiveStep(idx)}
                  className={`p-3 rounded-xl border text-left transition-all relative ${
                    isSelected
                      ? "border-blue-600 bg-blue-50/70 shadow-sm ring-1 ring-blue-600"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-slate-400">
                      Step {idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleComplete(idx);
                      }}
                      className="text-slate-400 hover:text-blue-600"
                    >
                      {isDone ? (
                        <CheckCircle2 size={16} className="text-emerald-600" />
                      ) : (
                        <Circle size={16} className="text-slate-300" />
                      )}
                    </button>
                  </div>
                  <div className="mt-1 text-xs font-bold text-slate-900 truncate">{st.shortTitle}</div>
                  <div className="text-[10px] text-slate-500 truncate">{st.estimatedTime}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Step Detailed Walkthrough */}
        {steps[activeStep] && (
          <div className="mt-10 max-w-4xl mx-auto rounded-3xl border border-slate-200 bg-slate-50/50 p-6 sm:p-10 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-6 w-6 rounded-full bg-blue-600 text-white text-xs font-black flex items-center justify-center">
                    {activeStep + 1}
                  </span>
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                    {steps[activeStep].category}
                  </span>
                  <span className="text-xs text-slate-400">• {steps[activeStep].estimatedTime}</span>
                </div>
                <h3 className="mt-3 text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {steps[activeStep].title}
                </h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed max-w-2xl">
                  {steps[activeStep].description}
                </p>
              </div>

              <button
                type="button"
                onClick={() => toggleComplete(activeStep)}
                className={`shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold transition ${
                  completedSteps.includes(activeStep)
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                    : "bg-blue-600 text-white hover:bg-blue-500 shadow-md shadow-blue-500/20"
                }`}
              >
                {completedSteps.includes(activeStep) ? (
                  <>
                    <Check size={14} /> Completed
                  </>
                ) : (
                  <>
                    <Circle size={14} /> Mark Step as Done
                  </>
                )}
              </button>
            </div>

            {/* Instruction Checklist for this step */}
            <div className="mt-8 space-y-6">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Detailed Actions to Take:
                </h4>
                <ol className="mt-4 space-y-3">
                  {steps[activeStep].tasks.map((task, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs"
                    >
                      <span className="h-5 w-5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900">{task.action}</p>
                        <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">{task.detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Code / Configuration Snippet if applicable */}
              {steps[activeStep].code && (
                <div className="mt-6">
                  <div className="flex items-center justify-between bg-[#050e2f] text-slate-300 px-4 py-2.5 rounded-t-xl border border-white/10 text-xs font-mono">
                    <span>{steps[activeStep].code.label}</span>
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(steps[activeStep].code.snippet, `code-${activeStep}`)
                      }
                      className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-white"
                    >
                      {copiedKey === `code-${activeStep}` ? (
                        <>
                          <Check size={13} className="text-emerald-400" /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy size={13} /> Copy Snippet
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="bg-[#111e43] text-slate-100 p-4 rounded-b-xl text-xs overflow-x-auto font-mono leading-relaxed border-x border-b border-white/10">
                    <code>{steps[activeStep].code.snippet}</code>
                  </pre>
                </div>
              )}

              {/* Best Practice Callout */}
              {steps[activeStep].tip && (
                <div className="mt-6 flex items-start gap-3 rounded-2xl bg-blue-50 border border-blue-200 p-4 text-xs text-blue-900 leading-relaxed">
                  <Sparkles size={18} className="shrink-0 text-blue-600 mt-0.5" />
                  <div>
                    <span className="font-bold">Pro Tip: </span>
                    {steps[activeStep].tip}
                  </div>
                </div>
              )}
            </div>

            {/* Next / Previous Step Navigation */}
            <div className="mt-10 pt-6 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                disabled={activeStep === 0}
                onClick={() => setActiveStep((s) => Math.max(0, s - 1))}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 disabled:opacity-30 disabled:hover:text-slate-600 px-4 py-2"
              >
                ← Previous Step
              </button>
              {activeStep < steps.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setActiveStep((s) => Math.min(steps.length - 1, s + 1))}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-6 py-2.5 rounded-full shadow-md shadow-blue-500/20"
                >
                  Next: Step {activeStep + 2} <ArrowRight size={14} />
                </button>
              ) : (
                <Link
                  to="/features"
                  className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-6 py-2.5 rounded-full shadow-md shadow-emerald-500/20"
                >
                  Explore All Modules <ArrowRight size={14} />
                </Link>
              )}
            </div>
          </div>
        )}
      </Section>

      {/* Pre-Flight Production Readiness Checklist */}
      {preflightChecks.length > 0 && (
        <Section className="bg-slate-50 border-y border-slate-200">
          <SectionHeading
            eyebrow="Go-Live Assurance"
            title="Production Pre-Flight Checklist"
            sub="Before turning on customer-facing campaigns or auto-routing live chats, verify these critical security, webhook, and compliance items."
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {preflightChecks.map((check, i) => (
              <div
                key={i}
                className="flex items-start gap-4 rounded-2xl bg-white border border-slate-200 p-5 shadow-xs"
              >
                <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{check.title}</h4>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">{check.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <RelatedRail pages={related} />
      <CtaBanner cta={page.cta} />
    </>
  );
}
