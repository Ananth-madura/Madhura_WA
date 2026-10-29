import React, { useState } from "react";
import axios from "axios";
import { API } from "../config/api";
export default function AutomationRuleActivity({ id }) {
  const [events, setEvents] = useState([]), [error, setError] = useState(""), [loading, setLoading] = useState(false);
  const load = async () => {
    setLoading(true); setError("");
    try { const { data } = await axios.get(`${API}/api/wa/automations/${id}/audit`); setEvents(data); }
    catch (failure) { setError(failure.response?.data?.error || "Could not load rule activity."); }
    finally { setLoading(false); }
  };
  return <details className="border-t pt-3 mt-3 text-xs" onToggle={event => { if (event.currentTarget.open) load(); }}><summary className="cursor-pointer">Configuration history</summary>{loading && <p role="status">Loading…</p>}{error && <p role="alert">{error}</p>}{!loading && !error && <ol className="space-y-2 mt-3">{events.map(event => <li key={event.id}>{event.action.replaceAll("_", " ")} · revision {event.revision}<small className="block">User {event.actor_id} · {new Date(event.created_at).toLocaleString()}</small></li>)}{!events.length && <li>No configuration changes recorded yet.</li>}</ol>}<button className="underline mt-2" type="button" disabled={loading} onClick={load}>Refresh history</button></details>;
}
