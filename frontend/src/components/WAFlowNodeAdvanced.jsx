import { useEffect, useState } from "react";
import { flowPorts } from "../utils/waFlowGraph";

export default function WAFlowNodeAdvanced({ node, nodes, onApply }) {
  const serialized = JSON.stringify(node.config || {}, null, 2);
  const [draft, setDraft] = useState(serialized);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (!editing) setDraft(serialized); }, [serialized, editing]);
  const apply = () => {
    try {
      const config = JSON.parse(draft);
      if (!config || typeof config !== "object" || Array.isArray(config)) throw new Error("Configuration must be a JSON object.");
      const candidate = { ...node, config };
      const keys = new Set(nodes.map(step => step.node_key));
      for (const port of flowPorts(candidate)) if (port.target && !keys.has(port.target)) throw new Error(`The ${port.label} route points to a missing step.`);
      onApply(candidate); setEditing(false); setError("");
    } catch (failure) { setError(failure.message); }
  };
  return <details className="fe-advanced"><summary>Advanced configuration</summary><p>Edit the full step configuration. Fields must match the selected action's supported configuration. Changes apply when you save below.</p><label>Configuration JSON<textarea spellCheck={false} rows={12} value={draft} onChange={event => { setDraft(event.target.value); setEditing(true); setError(""); }} /></label>{error && <p role="alert" className="fe-json-error">{error}</p>}{editing && <p>Unapplied JSON changes</p>}<div><button type="button" className="fe-button fe-secondary" onClick={() => { setDraft(serialized); setEditing(false); setError(""); }}>Reset editor</button><button type="button" className="fe-button fe-primary" disabled={!editing} onClick={apply}>Apply configuration</button></div></details>;
}
