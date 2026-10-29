import React, { useState } from "react";
import axios from "axios";
import { API } from "../config/api";
export default function FlowRunEvents({ flowId, runId }) {
  const [events, setEvents] = useState([]), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const load = async () => {
    setBusy(true); setError("");
    try { const { data } = await axios.get(`${API}/api/wa-flows/${flowId}/runs/${runId}/events`); setEvents(data); }
    catch (e) { setError(e.response?.data?.error || "Could not load execution events."); }
    finally { setBusy(false); }
  };
  return <details onToggle={e => { if (e.currentTarget.open) load(); }}><summary className="cursor-pointer">View execution</summary>
    {busy && <p role="status">Loading events…</p>}{error && <p role="alert">{error}</p>}
    {!busy && !error && <><ol className="space-y-2 my-2">{events.map(event => <li key={event.id}><strong>{event.node_key}</strong> · {event.event_type.replaceAll("_", " ")}<small className="block">{new Date(event.created_at).toLocaleString()}</small></li>)}</ol>{!events.length && <p>No step events recorded.</p>}</>}
    <button type="button" disabled={busy} onClick={load}>{error ? "Retry events" : "Refresh events"}</button>
  </details>;
}
