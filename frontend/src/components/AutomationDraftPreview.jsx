import React, { useState } from "react";
import { sampleMatches, sampleMessage } from "../utils/automationDraft";

const initialSample = {
  name: "Sample customer",
  company: "Your business",
  service: "Consultation",
  amount: 1500,
  invoice_no: "SAMPLE-100",
  due_date: "2026-12-15",
  city: "Chennai",
};

export default function AutomationDraftPreview({
  form,
  conditions,
  options,
  templates,
  flows,
  groups,
  issues,
  triggerLabel,
}) {
  const [sample, setSample] = useState(JSON.stringify(initialSample, null, 2));
  let data = {};
  let error = "";
  try {
    data = JSON.parse(sample);
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error();
  } catch (_) {
    error = "Enter a valid JSON event object to preview this rule.";
  }

  const content = (prefix, kind) => {
    const template = templates.find((item) => String(item.id) === String(form[`${prefix}template_id`]));
    const text = kind === "template" ? template?.body : form[`${prefix}message_text`];
    return (
      <div
        className="rounded-xl border p-3.5 space-y-2 min-w-0"
        style={{
          background: "var(--color-surface, #F5F5F5)",
          borderColor: "var(--color-rule, #E8E8E8)",
        }}
      >
        {kind === "template" && (
          <p className="text-xs font-semibold" style={{ color: "var(--color-ink, #202C52)" }}>
            Template: {template?.name || "Select a template"}
          </p>
        )}
        {kind === "media" && (
          <p className="text-xs break-all" style={{ color: "var(--color-ink-2, #667085)" }}>
            {form[`${prefix}media_type`]}: {sampleMessage(form[`${prefix}media_url`], data) || "Add a media URL"}
          </p>
        )}
        <p
          className="text-xs whitespace-pre-wrap break-words leading-relaxed"
          style={{ color: "var(--color-ink, #202C52)" }}
        >
          {sampleMessage(text, data) || (kind === "text" ? "Your message preview appears here." : "")}
        </p>
      </div>
    );
  };

  const isMatched = !error && sampleMatches(conditions, data);

  return (
    <aside
      aria-label="Automation preview and checks"
      className="p-4 sm:p-6 border-t xl:border-t-0 xl:border-l min-w-0"
      style={{
        borderColor: "var(--color-rule, #E8E8E8)",
        color: "var(--color-ink, #202C52)",
      }}
    >
      <div className="xl:sticky xl:top-6 space-y-5">
        <section>
          <h2
            className="text-sm font-bold m-0"
            style={{ color: "var(--color-ink, #202C52)", fontFamily: "Poppins, sans-serif" }}
          >
            Readiness
          </h2>
          <p
            className="text-xs sm:text-sm mt-1 font-medium"
            role="status"
            style={{ color: issues.length ? "#B42318" : "var(--color-success, #16803C)" }}
          >
            {issues.length ? `${issues.length} items to complete` : "Ready to save"}
          </p>
          {issues.length > 0 && (
            <ul className="text-xs space-y-1.5 mt-2 list-disc pl-4" style={{ color: "var(--color-ink-2, #667085)" }}>
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}
        </section>

        <section
          className="border-t pt-4"
          style={{ borderColor: "var(--color-rule, #E8E8E8)" }}
        >
          <h2
            className="text-sm font-bold m-0"
            style={{ color: "var(--color-ink, #202C52)", fontFamily: "Poppins, sans-serif" }}
          >
            Execution plan
          </h2>
          <ol className="list-decimal pl-4 text-xs space-y-2 mt-2.5 leading-relaxed" style={{ color: "var(--color-ink-2, #667085)" }}>
            <li>Receive {triggerLabel || "the selected event"}.</li>
            <li>
              {conditions.rules.length
                ? `Check ${conditions.rules.length} conditions (${conditions.match}).`
                : "Accept any matching event."}
            </li>
            <li>
              {Number(form.delay_minutes) > 0
                ? `Wait ${form.delay_minutes} minutes before sending.`
                : "Send without an initial delay."}
            </li>
            <li>Send the main {form.msg_kind} message.</li>
            {form.group_id && (
              <li>
                Enroll in{" "}
                {groups.find((group) => String(group.id) === String(form.group_id))?.name || "the selected group"}.
              </li>
            )}
            {form.flow_id && (
              <li>
                Start {flows.find((flow) => String(flow.id) === String(form.flow_id))?.name || "the selected flow"}.
              </li>
            )}
            {options.length > 0 && <li>Offer {options.length} reply options.</li>}
            {form.enable_sequence && (
              <li>
                Send the {form.followup_msg_kind} follow-up after {form.sequence_delay_seconds} seconds.
              </li>
            )}
            <li>Save {form.is_active ? "enabled" : "paused"}.</li>
          </ol>
        </section>

        <section
          className="border-t pt-4 space-y-3"
          style={{ borderColor: "var(--color-rule, #E8E8E8)" }}
        >
          <h2
            className="text-sm font-bold m-0"
            style={{ color: "var(--color-ink, #202C52)", fontFamily: "Poppins, sans-serif" }}
          >
            Sample event preview
          </h2>
          <p className="text-xs leading-relaxed" style={{ color: "var(--color-ink-2, #667085)", margin: 0 }}>
            Uses only the sample fields below. Unresolved variables stay visible. This preview sends no messages and performs no actions.
          </p>

          {!error && (
            <div className="space-y-2.5">
              {[
                ["name", "Sample customer name"],
                ["service", "Sample service"],
                ["amount", "Sample amount"],
              ].map(([field, label]) => (
                <label key={field} className="block text-xs font-medium" style={{ color: "var(--color-ink, #202C52)" }}>
                  {label}
                  <input
                    className="w-full rounded-lg border px-2.5 py-1.5 mt-1 text-xs shadow-2xs focus:outline-none"
                    style={{
                      borderColor: "var(--color-rule, #E8E8E8)",
                      background: "var(--color-paper-2, #ffffff)",
                      color: "var(--color-ink, #202C52)",
                    }}
                    value={typeof data[field] === "object" ? "" : data[field] ?? ""}
                    onChange={(event) =>
                      setSample(JSON.stringify({ ...data, [field]: event.target.value }, null, 2))
                    }
                  />
                </label>
              ))}
            </div>
          )}

          <details className="text-xs">
            <summary className="cursor-pointer font-semibold py-1" style={{ color: "var(--color-ink, #202C52)" }}>
              Advanced event data (JSON)
            </summary>
            <label className="block text-xs mt-2" style={{ color: "var(--color-ink-2, #667085)" }}>
              Event data (JSON)
              <textarea
                className="w-full rounded-lg border p-2 mt-1 font-mono text-xs shadow-2xs focus:outline-none"
                style={{
                  borderColor: "var(--color-rule, #E8E8E8)",
                  background: "var(--color-paper-2, #ffffff)",
                  color: "var(--color-ink, #202C52)",
                }}
                rows={7}
                value={sample}
                maxLength={12000}
                spellCheck={false}
                onChange={(event) => setSample(event.target.value)}
              />
            </label>
          </details>

          {error ? (
            <p role="alert" className="text-xs font-semibold p-2.5 rounded-lg border" style={{ color: "#B42318", background: "#FEF3F2", borderColor: "#FECDCA" }}>
              {error}
            </p>
          ) : (
            <div className="space-y-3">
              <div
                className="rounded-lg px-2.5 py-1.5 text-xs font-semibold border flex items-center gap-1.5"
                style={{
                  background: isMatched ? "#EDF7EE" : "#FEF3C7",
                  color: isMatched ? "var(--color-success, #16803C)" : "#92400E",
                  borderColor: isMatched ? "#C7E8CA" : "#FDE68A",
                }}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: isMatched ? "var(--color-success, #16803C)" : "#D97706" }} />
                <p className="m-0" role="status">
                  {isMatched ? "Sample matches the conditions" : "Sample is excluded by the conditions"}
                </p>
              </div>

              {content("", form.msg_kind)}

              {form.enable_sequence && (
                <>
                  <p className="text-xs font-semibold" style={{ color: "var(--color-ink-2, #667085)" }}>
                    Follow-up · {form.sequence_delay_seconds}s later
                  </p>
                  {content("followup_", form.followup_msg_kind)}
                </>
              )}

              {options.map((option, index) => (
                <div
                  key={index}
                  className="rounded-xl border p-2.5 text-xs space-y-1"
                  style={{
                    background: "var(--color-paper-2, #ffffff)",
                    borderColor: "var(--color-rule, #E8E8E8)",
                  }}
                >
                  <strong style={{ color: "var(--color-ink, #202C52)" }}>{option.label || `Reply ${index + 1}`}</strong>
                  <p className="whitespace-pre-wrap break-words m-0" style={{ color: "var(--color-ink-2, #667085)" }}>
                    {sampleMessage(option.reply_text, data)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </aside>
  );
}
