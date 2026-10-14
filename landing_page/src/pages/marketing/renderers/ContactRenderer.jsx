import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Copy, Mail, MapPin, Send } from "lucide-react";
import { resolveIcon } from "../iconMap";
import { resolveRelated } from "../content/index";
import { CtaBanner, FaqList, RelatedRail, Section, SectionHeading } from "./shared";

const TOPICS = [
  { value: "sales", label: "Sales & demos", email: "sales@madhura.co" },
  { value: "support", label: "Customer support", email: "support@madhura.co" },
  { value: "security", label: "Security", email: "security@madhura.co" },
  { value: "partnerships", label: "Partnerships", email: "partners@madhura.co" },
  { value: "careers", label: "Careers", email: "careers@madhura.co" },
];

const TEAM_SIZES = ["1–10", "11–50", "51–200", "201–1000", "1000+"];

const EMPTY = { name: "", email: "", company: "", teamSize: "11–50", topic: "sales", message: "" };

export default function ContactRenderer({ page }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [sent, setSent] = useState(null);
  const [copied, setCopied] = useState(false);

  const channels = (page.channels || []).map((c) => ({ ...c, icon: resolveIcon(c.icon) }));
  const related = resolveRelated(page.related);
  const recipient = useMemo(
    () => TOPICS.find((t) => t.value === form.topic)?.email || "hello@madhura.co",
    [form.topic]
  );

  const mailtoHref = useMemo(() => {
    const subject = `[${form.topic}] Website enquiry — ${form.company || form.name || "Unknown"}`;
    const body = [
      `Name: ${form.name}`,
      `Email: ${form.email}`,
      `Company: ${form.company || "—"}`,
      `Team size: ${form.teamSize}`,
      `Topic: ${form.topic}`,
      "",
      form.message,
    ].join("\n");
    return `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, [form, recipient]);

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = "Please tell us who you are.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      next.email = "Enter a valid work email so we can reply.";
    if (form.message.trim().length < 20)
      next.message = "A little more detail helps us route you to the right person (20+ characters).";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    /* The marketing site has no lead endpoint yet, so the message is handed to the
       visitor's mail client with everything pre-filled. Nothing is silently dropped. */
    window.location.href = mailtoHref;
    setSent({ to: recipient, href: mailtoHref });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(sent.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {
      setCopied(false);
    }
  };

  const fieldClass = (key) =>
    `w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition ${
      errors[key] ? "border-red-400" : "border-slate-200"
    }`;

  return (
    <>
      <Section className="bg-white">
        <div className="grid lg:grid-cols-12 gap-12">
          <div className="lg:col-span-7">
            <SectionHeading
              eyebrow="Send a message"
              title="Tell us what you are trying to build"
              sub="The more context you give us, the more useful the first reply will be. Nothing here goes into a lead-scoring queue."
            />

            {sent ? (
              <div
                id="contact-form"
                className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-8"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white">
                  <Check size={20} />
                </span>
                <h3 className="mt-4 text-lg font-bold text-slate-900">
                  Your message is ready to send
                </h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Your email application should have opened with the message pre-filled and
                  addressed to <strong>{sent.to}</strong>. Press send there and we will reply within
                  one business day. If nothing opened, use the button below or copy the address.
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <a
                    href={sent.href}
                    className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-6 py-3 rounded-full transition"
                  >
                    <Mail size={15} />
                    Open the drafted email
                  </a>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex items-center gap-2 border border-slate-300 hover:border-slate-400 text-slate-700 font-semibold text-sm px-6 py-3 rounded-full transition"
                  >
                    <Copy size={15} />
                    {copied ? "Copied" : "Copy message"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSent(null);
                      setForm(EMPTY);
                    }}
                    className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                  >
                    Write another
                  </button>
                </div>
              </div>
            ) : (
              <form id="contact-form" onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="contact-name" className="block text-xs font-bold text-slate-700 mb-1.5">
                      Full name *
                    </label>
                    <input
                      id="contact-name"
                      type="text"
                      autoComplete="name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Ramesh Patel"
                      className={fieldClass("name")}
                    />
                    {errors.name && <p className="mt-1.5 text-xs text-red-600">{errors.name}</p>}
                  </div>
                  <div>
                    <label htmlFor="contact-email" className="block text-xs font-bold text-slate-700 mb-1.5">
                      Work email *
                    </label>
                    <input
                      id="contact-email"
                      type="email"
                      autoComplete="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="you@company.com"
                      className={fieldClass("email")}
                    />
                    {errors.email && <p className="mt-1.5 text-xs text-red-600">{errors.email}</p>}
                  </div>
                  <div>
                    <label htmlFor="contact-company" className="block text-xs font-bold text-slate-700 mb-1.5">
                      Company
                    </label>
                    <input
                      id="contact-company"
                      type="text"
                      autoComplete="organization"
                      value={form.company}
                      onChange={(e) => setForm({ ...form, company: e.target.value })}
                      placeholder="Acme Retail Pvt Ltd"
                      className={fieldClass("company")}
                    />
                  </div>
                  <div>
                    <label htmlFor="contact-team" className="block text-xs font-bold text-slate-700 mb-1.5">
                      Team size
                    </label>
                    <select
                      id="contact-team"
                      value={form.teamSize}
                      onChange={(e) => setForm({ ...form, teamSize: e.target.value })}
                      className={fieldClass("teamSize")}
                    >
                      {TEAM_SIZES.map((size) => (
                        <option key={size} value={size}>
                          {size} agents
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="contact-topic" className="block text-xs font-bold text-slate-700 mb-1.5">
                    What is this about?
                  </label>
                  <select
                    id="contact-topic"
                    value={form.topic}
                    onChange={(e) => setForm({ ...form, topic: e.target.value })}
                    className={fieldClass("topic")}
                  >
                    {TOPICS.map((topic) => (
                      <option key={topic.value} value={topic.value}>
                        {topic.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-xs text-slate-500">
                    Goes to <span className="font-semibold text-slate-700">{recipient}</span>
                  </p>
                </div>

                <div>
                  <label htmlFor="contact-message" className="block text-xs font-bold text-slate-700 mb-1.5">
                    Message *
                  </label>
                  <textarea
                    id="contact-message"
                    rows={6}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    placeholder="How many agents and branches, what you send today, and what you want the channel to do."
                    className={fieldClass("message")}
                  />
                  {errors.message && <p className="mt-1.5 text-xs text-red-600">{errors.message}</p>}
                </div>

                <button
                  type="submit"
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm px-8 py-3.5 rounded-full shadow-lg shadow-blue-600/25 transition hover:scale-105 active:scale-95"
                >
                  <Send size={16} />
                  Send message
                </button>
                <p className="text-xs text-slate-500">
                  By sending you agree to be contacted about your enquiry. See our{" "}
                  <Link to="/legal/privacy" className="font-semibold text-blue-600 hover:text-blue-700">
                    Privacy Policy
                  </Link>
                  .
                </p>
              </form>
            )}
          </div>

          <aside className="lg:col-span-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Or email a team directly
            </h3>
            {channels.map((channel) => (
              <a
                key={channel.email}
                href={`mailto:${channel.email}`}
                className="block rounded-2xl border border-slate-200 bg-white p-5 hover:border-blue-300 hover:shadow-card transition"
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <channel.icon size={17} />
                </span>
                <div className="mt-3 flex items-baseline justify-between gap-3">
                  <h4 className="text-sm font-bold text-slate-900">{channel.title}</h4>
                  <span className="text-xs font-semibold text-blue-600">{channel.email}</span>
                </div>
                <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">{channel.desc}</p>
                <p className="mt-2 text-xs text-slate-400">{channel.sla}</p>
              </a>
            ))}
          </aside>
        </div>
      </Section>

      {page.offices?.length > 0 && (
        <Section className="bg-slate-50 border-y border-slate-200">
          <SectionHeading eyebrow="Offices" title="Where we work" />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {page.offices.map((office) => (
              <div key={office.city} className="rounded-2xl border border-slate-200 bg-white p-6">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-900">
                  <MapPin size={17} />
                </span>
                <h3 className="mt-3 text-base font-bold text-slate-900">{office.city}</h3>
                <p className="text-xs font-semibold text-blue-600">{office.role}</p>
                <address className="mt-3 not-italic text-sm text-slate-500 leading-relaxed">
                  {office.lines.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                  <span className="block">{office.region}</span>
                </address>
              </div>
            ))}
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 flex flex-col justify-center">
              <h3 className="text-base font-bold text-slate-900">Response times</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <Check size={15} className="mt-0.5 text-blue-600 shrink-0" /> Sales: 1 business day
                </li>
                <li className="flex items-start gap-2">
                  <Check size={15} className="mt-0.5 text-blue-600 shrink-0" /> Support: 4 hours on
                  enterprise plans
                </li>
                <li className="flex items-start gap-2">
                  <Check size={15} className="mt-0.5 text-blue-600 shrink-0" /> Security: acknowledged
                  within 24 hours
                </li>
              </ul>
              <Link
                to="/trust/security"
                className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700"
              >
                Read the disclosure policy
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </Section>
      )}

      <FaqList faq={page.faq} />
      <RelatedRail pages={related} />
      <CtaBanner cta={page.cta} />
    </>
  );
}
