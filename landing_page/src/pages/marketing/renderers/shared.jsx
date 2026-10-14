import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronDown } from "lucide-react";

/* Small presentational pieces shared by every marketing renderer. */

export function Section({ id, children, className = "" }) {
  return (
    <section id={id} className={`py-16 sm:py-20 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">{children}</div>
    </section>
  );
}

export function SectionHeading({ eyebrow, title, sub, center = false }) {
  return (
    <div className={`max-w-3xl ${center ? "mx-auto text-center" : ""}`}>
      {eyebrow && (
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-600">{eyebrow}</p>
      )}
      <h2 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-slate-900 leading-tight">
        {title}
      </h2>
      {sub && <p className="mt-4 text-sm sm:text-base text-slate-500 leading-relaxed">{sub}</p>}
    </div>
  );
}

export function StatStrip({ stats }) {
  if (!stats?.length) return null;
  return (
    <section className="bg-slate-50 border-y border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-slate-200">
        {stats.map((stat) => (
          <div key={stat.label} className="px-5 sm:px-8 py-8">
            <div className="text-2xl sm:text-3xl font-black tracking-tight text-blue-600">
              {stat.value}
            </div>
            <div className="mt-1.5 text-sm font-bold text-slate-900">{stat.label}</div>
            {stat.note && <div className="mt-0.5 text-xs text-slate-500">{stat.note}</div>}
          </div>
        ))}
      </div>
    </section>
  );
}

export function FaqList({ faq }) {
  const [open, setOpen] = useState(null);
  if (!faq?.length) return null;

  return (
    <Section className="bg-white">
      <SectionHeading eyebrow="FAQ" title="Frequently asked questions" />
      <div className="mt-10 max-w-3xl divide-y divide-slate-200 border-y border-slate-200">
        {faq.map((item, i) => {
          const expanded = open === i;
          return (
            <div key={item.q}>
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : i)}
                aria-expanded={expanded}
                className="w-full flex items-start justify-between gap-6 py-5 text-left group"
              >
                <span className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-blue-600 transition">
                  {item.q}
                </span>
                <ChevronDown
                  size={18}
                  className={`mt-0.5 shrink-0 text-slate-400 transition-transform ${
                    expanded ? "rotate-180 text-blue-600" : ""
                  }`}
                />
              </button>
              {expanded && (
                <p className="pb-6 -mt-1 text-sm text-slate-600 leading-relaxed">{item.a}</p>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

export function CtaBanner({ cta }) {
  if (!cta) return null;
  return (
    <section className="py-20 bg-[#070b16] text-white border-t border-white/[0.08]">
      <div className="max-w-4xl mx-auto px-4 text-center space-y-6">
        <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white leading-tight">
          {cta.title}
        </h2>
        <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto leading-relaxed">
          {cta.sub}
        </p>
        <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
          <Link
            to={cta.primary.to}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm sm:text-base px-8 py-4 rounded-full shadow-xl shadow-blue-600/35 transition hover:scale-105 active:scale-95"
          >
            {cta.primary.label}
            <ArrowRight size={16} />
          </Link>
          {cta.secondary && (
            <Link
              to={cta.secondary.to}
              className="inline-flex items-center gap-2 border border-white/15 hover:border-white/30 text-slate-100 font-semibold text-sm sm:text-base px-8 py-4 rounded-full transition"
            >
              {cta.secondary.label}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

export function RelatedRail({ title = "Keep exploring", pages }) {
  if (!pages?.length) return null;
  return (
    <Section className="bg-slate-50 border-t border-slate-200">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{title}</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pages.map((page) => (
          <Link
            key={page.path}
            to={page.path}
            className="group rounded-2xl border border-slate-200 bg-white p-6 hover:border-blue-300 hover:shadow-hover transition"
          >
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
              {page.section}
            </span>
            <h3 className="mt-2 text-base font-bold text-slate-900 group-hover:text-blue-600 transition">
              {page.meta?.title?.split("—")[0]?.split("|")[0]?.trim() || page.path}
            </h3>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
              {page.hero?.subtitle?.slice(0, 110) || page.path}
              …
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-blue-600">
              Read more
              <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        ))}
      </div>
    </Section>
  );
}

export function CardGrid({ items, columns = "sm:grid-cols-2 lg:grid-cols-3", iconColor = "text-blue-600 bg-blue-50" }) {
  return (
    <div className={`mt-10 grid gap-4 ${columns}`}>
      {items.map((item) => (
        <div
          key={item.title}
          className="rounded-2xl border border-slate-200 bg-white p-6 hover:shadow-card transition"
        >
          {item.icon && (
            <span
              className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${iconColor}`}
            >
              <item.icon size={18} />
            </span>
          )}
          <h3 className="mt-4 text-base font-bold text-slate-900">{item.title}</h3>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">{item.desc}</p>
        </div>
      ))}
    </div>
  );
}

export function NumberedSteps({ steps }) {
  return (
    <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {steps.map((step, i) => (
        <li key={step.title} className="relative rounded-2xl border border-slate-200 bg-white p-6">
          <span className="text-xs font-black text-blue-600">
            {String(i + 1).padStart(2, "0")}
          </span>
          <h3 className="mt-2 text-base font-bold text-slate-900">{step.title}</h3>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">{step.desc}</p>
        </li>
      ))}
    </ol>
  );
}
