import { Check } from "lucide-react";
import { resolveIcon } from "../iconMap";
import { resolveRelated } from "../content/index";
import {
  CardGrid,
  CtaBanner,
  FaqList,
  NumberedSteps,
  RelatedRail,
  Section,
  SectionHeading,
  StatStrip,
} from "./shared";

/* The default marketing page: hero (rendered by MarketingLayout) + stats +
   overview + features + workflow + capabilities + FAQ + related + CTA. */

export default function StandardRenderer({ page }) {
  const features = (page.features || []).map((f) => ({ ...f, icon: resolveIcon(f.icon) }));
  const capabilities = (page.capabilities?.items || []).map((c) => ({
    ...c,
    icon: resolveIcon(c.icon),
  }));
  const related = resolveRelated(page.related);

  return (
    <>
      <StatStrip stats={page.stats} />

      {page.overview && (
        <Section className="bg-white">
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 items-start">
            <div className="lg:col-span-5">
              <SectionHeading eyebrow="Overview" title={page.overview.heading} />
            </div>
            <div className="lg:col-span-7 space-y-4">
              {page.overview.paragraphs.map((para) => (
                <p key={para.slice(0, 40)} className="text-sm sm:text-base text-slate-600 leading-relaxed">
                  {para}
                </p>
              ))}
              {page.overview.bullets && (
                <ul className="pt-4 grid sm:grid-cols-2 gap-3">
                  {page.overview.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-2.5 text-sm text-slate-700">
                      <Check size={16} className="mt-0.5 shrink-0 text-blue-600" />
                      <span className="leading-relaxed">{bullet}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Section>
      )}

      {features.length > 0 && (
        <Section className="bg-slate-50 border-y border-slate-200">
          <SectionHeading
            eyebrow="Capabilities"
            title={page.section === "Company" ? "How we work" : "What the platform delivers"}
          />
          <CardGrid items={features} />
        </Section>
      )}

      {page.workflow && (
        <Section className="bg-white">
          <SectionHeading eyebrow="How it works" title={page.workflow.heading} />
          <NumberedSteps steps={page.workflow.steps} />
        </Section>
      )}

      {capabilities.length > 0 && (
        <Section className="bg-slate-50 border-y border-slate-200">
          <SectionHeading eyebrow="Details" title={page.capabilities.heading} />
          <CardGrid items={capabilities} columns="sm:grid-cols-2 lg:grid-cols-3" iconColor="text-slate-900 bg-slate-100" />
        </Section>
      )}

      <FaqList faq={page.faq} />
      <RelatedRail pages={related} />
      <CtaBanner cta={page.cta} />
    </>
  );
}
