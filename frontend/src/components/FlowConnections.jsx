import React, { useState } from "react";
import axios from "axios";
import { API } from "../config/api";

const empty = { name: "business", url: "", token: "", operations: "" };
export default function FlowConnections() {
  const [connections, setConnections] = useState([]), [draft, setDraft] = useState(empty);
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [loaded, setLoaded] = useState(false);
  const load = async () => {
    setError("");
    try { const { data } = await axios.get(`${API}/api/wa-flows/connections`); setConnections(data); setLoaded(true); }
    catch (e) { setError(e.response?.data?.error || "Could not load workflow connections."); }
  };
  const save = async event => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const { data } = await axios.post(`${API}/api/wa-flows/connections`, { ...draft, operations: draft.operations.split(",").map(value => value.trim()).filter(Boolean) });
      setConnections(data); setDraft(empty);
    } catch (e) { setError(e.response?.data?.error || "Could not save the connection."); }
    finally { setBusy(false); }
  };
  const remove = async name => {
    if (!window.confirm(`Remove ${name}? Workflows using this connection will follow their failure route.`)) return;
    setBusy(true); setError("");
    try { await axios.delete(`${API}/api/wa-flows/connections/${encodeURIComponent(name)}`); await load(); }
    catch (e) { setError(e.response?.data?.error || "Could not remove the connection."); }
    finally { setBusy(false); }
  };
  return <details className="border rounded-lg p-4 my-4 bg-white" onToggle={event => { if (event.currentTarget.open && !loaded) load(); }}>
    <summary className="cursor-pointer font-semibold text-sm">Workflow connections</summary>
    <p className="text-xs my-3">Organization administrators can connect business APIs here. SOCIA executes the workflow and sends WhatsApp messages through Meta. Each endpoint must support the allowed operation names and return a verified result.</p>
    {error && <p role="alert" className="text-red-700 text-xs my-2">{error}</p>}
    {connections.map(item => <div key={item.name} className="border-b py-3 text-xs space-y-1"><strong>{item.name}</strong><p className="break-all">{item.url}</p><p className="break-words">{item.operations.join(", ")}</p><div className="flex gap-4"><button type="button" disabled={busy} onClick={() => setDraft({ name: item.name, url: item.url, token: "", operations: item.operations.join(", ") })}>Edit connection</button><button type="button" disabled={busy} onClick={() => remove(item.name)}>Remove connection</button></div></div>)}
    <form onSubmit={save} className="space-y-3 mt-4 max-w-xl">
      {[ ["name", "Connection name", "text"], ["url", "HTTPS endpoint", "url"], ["token", "Bearer token (blank keeps the saved token)", "password"], ["operations", "Allowed operations, separated by commas", "text"] ].map(([field, label, type]) => <label key={field} className="block text-xs">{label}<input required={field !== "token"} autoComplete={field === "token" ? "new-password" : "off"} type={type} className="w-full border rounded p-2 mt-1" value={draft[field]} onChange={event => setDraft({ ...draft, [field]: event.target.value })} placeholder={field === "operations" ? "appointments.availability, appointments.booking_create" : ""} /></label>)}
      <button disabled={busy} className="border rounded px-3 py-2 text-xs font-semibold" type="submit">{busy ? "Saving…" : "Save connection"}</button>
    </form>
  </details>;
}
