import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Mail, ShieldCheck } from "lucide-react";
import { resolveRelated } from "../content/index";
import { CtaBanner, RelatedRail, Section } from "./shared";

/* Legal documents: a sticky table of contents beside the full text, with the
   active section tracked as you scroll so long documents stay navigable. */

function useActiveSection(ids) {
  const [active, setActive] = useState(ids[0]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-96px 0px -70% 0px", threshold: 0 }
    );

    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [ids]);

  return active;
}

export default function LegalRenderer({ page }) {
  const sections = useMemo(() => page.sections || [], [page.sections]);
  const ids = useMemo(() => sections.map((s) => s.id), [sections]);
  const active = useActiveSection(ids);
  const related = resolveRelated(page.related);
  const doc = page.document || {};

  return (
    <>
      <Section className="bg-white">
        <div className="grid lg:grid-cols-12 gap-12">
          <aside className="lg:col-span-4 order-2 lg:order-1">
            <div className="lg:sticky lg:top-28">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                On this page
              </p>
              <nav aria-label="Document sections" className="mt-4">
                <ol className="space-y-1 border-l border-slate-200">
                  {sections.map((section) => (
                    <li key={section.id}>
                      <a
                        href={`#${section.id}`}
                        className={`-ml-px block border-l-2 py-1.5 pl-4 text-sm transition ${
                          active === section.id
                            ? "border-blue-600 font-semibold text-blue-700"
                            : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
                        }`}
                      >
                        {section.heading}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>

              <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Questions
                </p>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  For anything not covered here, write to the team that owns this document.
                </p>
                <a
                  href={`mailto:${doc.owner}`}
                  className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-700"
                >
                  <Mail size={15} />
                  {doc.owner}
                </a>
              </div>
            </div>
          </aside>

          <article className="lg:col-span-8 order-1 lg:order-2">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 text-blue-700 font-bold px-3 py-1.5">
                <ShieldCheck size={13} />
                {doc.title}
              </span>
              <span className="text-slate-500">Last updated {doc.lastUpdated}</span>
            </div>

            <h1 className="mt-4 text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
              {doc.title}
            </h1>
            <p className="mt-4 text-sm sm:text-base text-slate-600 leading-relaxed">
              {doc.subtitle}
            </p>

            <div className="mt-10 space-y-10">
              {sections.map((section) => (
                <section key={section.id} id={section.id} className="scroll-mt-28">
                  <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
                    {section.heading}
                  </h2>
                  <div className="mt-3 space-y-3">
                    {(section.paragraphs || []).map((para) => (
                      <p key={para.slice(0, 40)} className="text-sm text-slate-600 leading-relaxed">
                        {para}
                      </p>
                    ))}

                    {section.list && (
                      <ul className="space-y-2 pt-1">
                        {section.list.map((item) => (
                          <li key={item} className="flex items-start gap-2.5 text-sm text-slate-600">
                            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                            <span className="leading-relaxed">{item}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {(section.paragraphsAfter || []).map((para) => (
                      <p key={para.slice(0, 40)} className="text-sm text-slate-600 leading-relaxed">
                        {para}
                      </p>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <div className="mt-12 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
              <p className="font-bold text-slate-900">Related documents</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <Link
                  to="/legal/privacy"
                  className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-700"
                >
                  Privacy Policy <ArrowRight size={13} />
                </Link>
                <Link
                  to="/legal/terms"
                  className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-700"
                >
                  Terms of Service <ArrowRight size={13} />
                </Link>
                <Link
                  to="/trust/security"
                  className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-700"
                >
                  Security <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          </article>
        </div>
      </Section>

      <RelatedRail pages={related} />
      <CtaBanner cta={page.cta} />
    </>
  );
}
