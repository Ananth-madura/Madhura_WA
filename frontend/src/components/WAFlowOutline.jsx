import { useState } from "react";
import { AlertCircle, CheckCircle2, ChevronRight, GitBranch, Search } from "lucide-react";

export default function WAFlowOutline({ nodes, issues, selectedKey, onSelect, view, name, description, trigger, keywords, entry, onChange }) {
  const [search, setSearch] = useState("");
  if (view === "settings") return <div className="wa-flow-setup">
    <h2>Flow settings</h2><p>Define when this conversation starts. Save a draft before testing on a phone.</p>
    <label>Flow name<input value={name} maxLength={150} onChange={e => onChange("name", e.target.value)} placeholder="Name this flow" /></label>
    <label>Description<textarea value={description} rows={3} maxLength={1000} onChange={e => onChange("description", e.target.value)} placeholder="What should this conversation help customers do?" /></label>
    <label>Start conversation<select value={trigger} onChange={e => onChange("trigger", e.target.value)}><option value="manual">Manually</option><option value="keyword">When a keyword matches</option><option value="all_inbound">On any incoming message</option><option value="first_inbound">On the first incoming message</option></select></label>
    {trigger === "keyword" && <label>Trigger keywords<textarea value={keywords} rows={3} onChange={e => onChange("keywords", e.target.value)} placeholder="Enter keywords, separated by commas" /><small>Separate keywords with commas. Review overlap with other active flows.</small></label>}
    <label>Entry step<select value={entry || ""} onChange={e => onChange("entry", e.target.value)}><option value="" disabled>Choose a step</option>{nodes.map(n => <option key={n.node_key} value={n.node_key}>{n.node_key}</option>)}</select></label>
    <div className="wa-flow-readiness"><strong>Before publishing</strong><p>{issues.filter(i => i.severity === "error").length} blocking issues · {issues.filter(i => i.severity !== "error").length} warnings</p><p>Check every route, preview customer replies, then publish from the toolbar.</p></div>
  </div>;
  const visible = nodes.filter(n => `${n.node_key} ${n.node_type}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="wa-flow-outline">
    <label className="wa-flow-find"><Search size={15} /><input aria-label="Find a flow step" value={search} onChange={e => setSearch(e.target.value)} placeholder="Find a step…" /></label>
    <p className="wa-flow-outline-count">{visible.length} of {nodes.length} steps · select to configure</p>
    {visible.length === 0 && <p className="wa-flow-outline-empty">{nodes.length ? "No steps match your search." : "Add a block to start this conversation."}</p>}
    {visible.map((node, index) => {
      const nodeIssues = issues.filter(i => i.nodeKey === node.node_key);
      return <button type="button" key={node.node_key} className={`wa-flow-step ${selectedKey === node.node_key ? "is-selected" : ""}`} aria-pressed={selectedKey === node.node_key} onClick={() => onSelect(node.node_key)}>
        <span className="wa-flow-step-number">{String(index + 1).padStart(2, "0")}</span><span><strong>{node.node_key}</strong><small>{node.node_type.replaceAll("_", " ")}{node.node_key === entry ? " · Entry" : ""}</small></span>{nodeIssues.length ? <AlertCircle size={15} aria-label={`${nodeIssues.length} issues`} /> : <ChevronRight size={15} />}
      </button>;
    })}
    <div className="wa-flow-outline-validation"><h3><GitBranch size={15} />Conversation checks</h3>{issues.length === 0 ? <p><CheckCircle2 size={16} />No graph issues found. Preview before publishing.</p> : issues.map((issue, i) => <button type="button" key={i} disabled={!issue.nodeKey} onClick={() => onSelect(issue.nodeKey)}><AlertCircle size={14} /><span><strong>{issue.severity === "error" ? "Fix required" : "Review"}</strong>{issue.text}</span></button>)}</div>
  </div>;
}
