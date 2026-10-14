import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Briefcase, ChevronDown, MapPin } from "lucide-react";
import { resolveIcon } from "../iconMap";
import { resolveRelated } from "../content/index";
import { CtaBanner, CardGrid, FaqList, RelatedRail, Section, SectionHeading } from "./shared";

/* Careers: benefits grid + an expandable list of open roles, each with its own
   anchor (#senior-backend-engineer) so a job posting can be linked directly. */

export default function CareersRenderer({ page }) {
  const [openRole, setOpenRole] = useState(null);
  const benefits = (page.benefits || []).map((b) => ({ ...b, icon: resolveIcon(b.icon) }));
  const related = resolveRelated(page.related);

  return (
    <>
      {benefits.length > 0 && (
        <Section className="bg-white">
          <SectionHeading
            eyebrow="Working here"
            title="What we offer, in plain terms"
            sub="No ping-pong tables in this list — just the things that actually affect whether a job is good."
          />
          <CardGrid items={benefits} />
        </Section>
      )}

      <Section id="open-roles" className="bg-slate-50 border-y border-slate-200">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading
            eyebrow={`Open roles · ${page.roles?.length || 0}`}
            title="Positions we are hiring for"
          />
          <p className="text-sm text-slate-500">
            Not listed?{" "}
            <Link to="/company/contact" className="font-semibold text-blue-600 hover:text-blue-700">
              Send an open application
            </Link>
            .
          </p>
        </div>

        <div className="mt-10 space-y-3">
          {(page.roles || []).map((role) => {
            const expanded = openRole === role.id;
            return (
              <article
                key={role.id}
                id={role.id}
                className={`rounded-2xl border bg-white transition ${
                  expanded ? "border-blue-300 shadow-card" : "border-slate-200"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpenRole(expanded ? null : role.id)}
                  aria-expanded={expanded}
                  aria-controls={`${role.id}-detail`}
                  className="w-full flex flex-wrap items-center justify-between gap-4 p-6 text-left"
                >
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">{role.title}</h3>
                      <span className="text-[11px] font-bold uppercase tracking-wider rounded-full bg-blue-50 text-blue-700 px-2.5 py-1">
                        {role.team}
                      </span>
                    </span>
                    <span className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin size={13} />
                        {role.location}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Briefcase size={13} />
                        {role.type} · {role.level}
                      </span>
                    </span>
                  </span>
                  <ChevronDown
                    size={20}
                    className={`shrink-0 text-slate-400 transition-transform ${
                      expanded ? "rotate-180 text-blue-600" : ""
                    }`}
                  />
                </button>

                {expanded && (
                  <div id={`${role.id}-detail`} className="px-6 pb-6 border-t border-slate-100 pt-5">
                    <p className="text-sm text-slate-600 leading-relaxed">{role.summary}</p>

                    <div className="mt-6 grid gap-8 md:grid-cols-2">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          What you will own
                        </h4>
                        <ul className="mt-3 space-y-2">
                          {role.responsibilities.map((item) => (
                            <li key={item} className="flex items-start gap-2.5 text-sm text-slate-600">
                              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                              <span className="leading-relaxed">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          What we look for
                        </h4>
                        <ul className="mt-3 space-y-2">
                          {role.requirements.map((item) => (
                            <li key={item} className="flex items-start gap-2.5 text-sm text-slate-600">
                              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-300 shrink-0" />
                              <span className="leading-relaxed">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-wrap items-center gap-3">
                      <a
                        href={`mailto:careers@madhura.co?subject=${encodeURIComponent(
                          `Application — ${role.title} (${role.id})`
                        )}&body=${encodeURIComponent(
                          `Role: ${role.title}\nLocation: ${role.location}\n\nWhy I am a fit:\n\nWhere I would start in the first 90 days:\n`
                        )}`}
                        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm px-6 py-3 rounded-full transition"
                      >
                        Apply for this role
                        <ArrowRight size={15} />
                      </a>
                      <Link
                        to="/company/about"
                        className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                      >
                        Learn about the company
                      </Link>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>

        <p className="mt-8 text-xs text-slate-500">
          Madhura is an equal opportunity employer. We evaluate candidates on skill and evidence of
          work, and we do not consider caste, religion, gender, disability or any other protected
          characteristic.
        </p>
      </Section>

      <FaqList faq={page.faq} />
      <RelatedRail pages={related} />
      <CtaBanner cta={page.cta} />
    </>
  );
}
