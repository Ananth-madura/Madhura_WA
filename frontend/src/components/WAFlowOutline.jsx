import { useState } from "react";
import { AlertCircle, CheckCircle2, ChevronRight, GitBranch, Search } from "lucide-react";

export default function WAFlowOutline({
  nodes,
  issues,
  selectedKey,
  onSelect,
  view,
  name,
  description,
  trigger,
  keywords,
  entry,
  onChange,
  triggerMeta = {},
  onMetaChange,
  senders = [],
}) {
  const [search, setSearch] = useState("");

  if (view === "settings") {
    const meta = triggerMeta || {};
    const updateMeta = (patch) => onMetaChange && onMetaChange({ ...meta, ...patch });
    const selectedSenders = Array.isArray(meta.sender_ids) ? meta.sender_ids.map(String) : [];
    const senderScope = meta.sender_scope || (selectedSenders.length ? "selected" : "all");
    const activeHours = meta.active_hours || { enabled: false, timezone: "Asia/Kolkata", start: "09:00", end: "18:00", days: [1, 2, 3, 4, 5, 6] };

    return (
      <div className="wa-flow-setup space-y-3">
        <h2>Flow settings</h2>
        <p>Define when this conversation starts, which WhatsApp numbers it runs on, and execution rules.</p>

        <label>
          Flow name
          <input
            value={name}
            maxLength={150}
            onChange={(e) => onChange("name", e.target.value)}
            placeholder="Name this flow"
          />
        </label>

        <label>
          Description
          <textarea
            value={description}
            rows={2}
            maxLength={1000}
            onChange={(e) => onChange("description", e.target.value)}
            placeholder="What should this conversation help customers do?"
          />
        </label>

        <label>
          Start conversation
          <select value={trigger} onChange={(e) => onChange("trigger", e.target.value)}>
            <option value="keyword">When a keyword matches (Separate / Dedicated Bot)</option>
            <option value="all_inbound">On any incoming message (Global 24/7 Bot)</option>
            <option value="first_inbound">On the first incoming message (Welcome Bot)</option>
            <option value="manual">Manually / API / Agent Trigger</option>
          </select>
        </label>

        {trigger === "keyword" && (
          <>
            <label>
              Trigger keywords
              <textarea
                value={keywords}
                rows={2}
                onChange={(e) => onChange("keywords", e.target.value)}
                placeholder="Enter keywords, separated by commas"
              />
              <small>Separate keywords with commas. Review overlap with other active flows.</small>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label>
                Match rule
                <select
                  value={meta.match_mode || "smart"}
                  onChange={(e) => updateMeta({ match_mode: e.target.value })}
                >
                  <option value="smart">Smart Word & Prefix</option>
                  <option value="exact">Exact Match</option>
                  <option value="contains">Contains Phrase</option>
                  <option value="starts_with">Starts With</option>
                  <option value="regex">Regex Pattern</option>
                </select>
              </label>

              <label>
                Priority (1-100)
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={meta.priority ?? 50}
                  onChange={(e) => updateMeta({ priority: Math.min(100, Math.max(1, Number(e.target.value) || 50)) })}
                />
              </label>
            </div>

            <label className="flex items-center gap-2 text-xs pt-1" style={{ flexDirection: "row" }}>
              <input
                type="checkbox"
                checked={Boolean(meta.case_sensitive)}
                onChange={(e) => updateMeta({ case_sensitive: e.target.checked })}
              />
              <span>Case-sensitive keyword matching</span>
            </label>

            <label className="flex items-center gap-2 text-xs" style={{ flexDirection: "row" }}>
              <input
                type="checkbox"
                checked={Boolean(meta.allow_restart_after_human)}
                onChange={(e) => updateMeta({ allow_restart_after_human: e.target.checked })}
              />
              <span>Allow keyword to wake bot after human agent reply</span>
            </label>
          </>
        )}

        {trigger !== "keyword" && (
          <label>
            Bot Priority (1-100, higher runs first)
            <input
              type="number"
              min={1}
              max={100}
              value={meta.priority ?? 50}
              onChange={(e) => updateMeta({ priority: Math.min(100, Math.max(1, Number(e.target.value) || 50)) })}
            />
          </label>
        )}

        <label>
          Entry step
          <select value={entry || ""} onChange={(e) => onChange("entry", e.target.value)}>
            <option value="" disabled>Choose a step</option>
            {nodes.map((n) => (
              <option key={n.node_key} value={n.node_key}>{n.node_key}</option>
            ))}
          </select>
        </label>

        <details className="border rounded p-2.5 bg-slate-50 space-y-2">
          <summary className="cursor-pointer text-xs font-semibold text-slate-800">
            Bot Activation Scope & WhatsApp Numbers
          </summary>
          <div className="space-y-2 pt-2 text-xs">
            <label>
              Listen on numbers
              <select
                value={senderScope}
                onChange={(e) =>
                  updateMeta({
                    sender_scope: e.target.value,
                    sender_ids: e.target.value === "all" ? [] : selectedSenders,
                  })
                }
              >
                <option value="all">Global — All Connected Numbers (Cloud & QR/Web)</option>
                <option value="selected">Selected WhatsApp Numbers Only</option>
              </select>
            </label>

            {senderScope === "selected" && (
              <div className="space-y-1 max-h-36 overflow-y-auto border rounded p-2 bg-white">
                {senders.length === 0 ? (
                  <p className="text-[11px] text-slate-500">No connected senders found yet.</p>
                ) : (
                  senders.map((sender) => {
                    const checked = selectedSenders.includes(String(sender.id));
                    return (
                      <label key={sender.id} className="flex items-center gap-2 text-[11px]" style={{ flexDirection: "row" }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...new Set([...selectedSenders, String(sender.id)])]
                              : selectedSenders.filter((id) => id !== String(sender.id));
                            updateMeta({ sender_scope: "selected", sender_ids: next });
                          }}
                        />
                        <span>{sender.label}</span>
                      </label>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </details>

        <details className="border rounded p-2.5 bg-slate-50 space-y-2">
          <summary className="cursor-pointer text-xs font-semibold text-slate-800">
            Schedule, Cooldown & Execution Limits
          </summary>
          <div className="space-y-2 pt-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <label>
                Cooldown (minutes)
                <input
                  type="number"
                  min={0}
                  max={10080}
                  value={meta.cooldown_minutes ?? 0}
                  onChange={(e) => updateMeta({ cooldown_minutes: Math.max(0, Number(e.target.value) || 0) })}
                />
              </label>
              <label>
                Idle timeout (min)
                <input
                  type="number"
                  min={5}
                  max={1440}
                  value={meta.session_timeout_minutes ?? 240}
                  onChange={(e) => updateMeta({ session_timeout_minutes: Math.min(1440, Math.max(5, Number(e.target.value) || 240)) })}
                />
              </label>
            </div>

            <label>
              Custom Stop / Human Keywords
              <input
                type="text"
                value={meta.escape_keywords || ""}
                onChange={(e) => updateMeta({ escape_keywords: e.target.value })}
                placeholder="stop, agent, exit, cancel bot"
              />
            </label>

            <label className="flex items-center gap-2" style={{ flexDirection: "row" }}>
              <input
                type="checkbox"
                checked={Boolean(activeHours.enabled)}
                onChange={(e) => updateMeta({ active_hours: { ...activeHours, enabled: e.target.checked } })}
              />
              <span>Only auto-trigger during active schedule</span>
            </label>

            {activeHours.enabled && (
              <div className="grid grid-cols-2 gap-2">
                <label>
                  Start time
                  <input
                    type="time"
                    value={activeHours.start || "09:00"}
                    onChange={(e) => updateMeta({ active_hours: { ...activeHours, start: e.target.value } })}
                  />
                </label>
                <label>
                  End time
                  <input
                    type="time"
                    value={activeHours.end || "18:00"}
                    onChange={(e) => updateMeta({ active_hours: { ...activeHours, end: e.target.value } })}
                  />
                </label>
              </div>
            )}
          </div>
        </details>

        <div className="wa-flow-readiness">
          <strong>Before publishing</strong>
          <p>{issues.filter((i) => i.severity === "error").length} blocking issues · {issues.filter((i) => i.severity !== "error").length} warnings</p>
          <p>Check every route, preview customer replies, then publish from the toolbar.</p>
        </div>
      </div>
    );
  }

  const visible = nodes.filter((n) => `${n.node_key} ${n.node_type}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="wa-flow-outline">
      <label className="wa-flow-find">
        <Search size={15} />
        <input aria-label="Find a flow step" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a step…" />
      </label>
      <p className="wa-flow-outline-count">{visible.length} of {nodes.length} steps · select to configure</p>
      {visible.length === 0 && <p className="wa-flow-outline-empty">{nodes.length ? "No steps match your search." : "Add a block to start this conversation."}</p>}
      {visible.map((node, index) => {
        const nodeIssues = issues.filter((i) => i.nodeKey === node.node_key);
        return (
          <button
            type="button"
            key={node.node_key}
            className={`wa-flow-step ${selectedKey === node.node_key ? "is-selected" : ""}`}
            aria-pressed={selectedKey === node.node_key}
            onClick={() => onSelect(node.node_key)}
          >
            <span className="wa-flow-step-number">{String(index + 1).padStart(2, "0")}</span>
            <span>
              <strong>{node.node_key}</strong>
              <small>{node.node_type.replaceAll("_", " ")}{node.node_key === entry ? " · Entry" : ""}</small>
            </span>
            {nodeIssues.length ? <AlertCircle size={15} aria-label={`${nodeIssues.length} issues`} /> : <ChevronRight size={15} />}
          </button>
        );
      })}
      <div className="wa-flow-outline-validation">
        <h3><GitBranch size={15} />Conversation checks</h3>
        {issues.length === 0 ? (
          <p><CheckCircle2 size={16} />No graph issues found. Preview before publishing.</p>
        ) : (
          issues.map((issue, i) => (
            <button type="button" key={i} disabled={!issue.nodeKey} onClick={() => onSelect(issue.nodeKey)}>
              <AlertCircle size={14} />
              <span><strong>{issue.severity === "error" ? "Fix required" : "Review"}</strong>{issue.text}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
