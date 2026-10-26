import { useState } from "react";
import api from "../config/axios";
import useWADialog from "../hooks/useWADialog";

export default function EmployeePermissions({ userId, name }) {
  const [grants, setGrants] = useState(null), [error, setError] = useState(""), [busy, setBusy] = useState(false), [saved, setSaved] = useState("");
  const dialog = useWADialog(Boolean(grants), () => setGrants(null), busy);
  const open = async () => {
    try {
      const { data } = await api.get(`/api/v2/workspace/permissions/${userId}`);
      setGrants(data.modules.map(module => { const grant = data.permissions.find(row => row.module === module); return { module, can_view: grant ? Boolean(grant.can_view) : module!=="campaigns", can_edit: grant ? Boolean(grant.can_edit) : module!=="campaigns" }; }));
      setError("");
    } catch (err) { setError(err.response?.data?.message || "Permissions unavailable"); }
  };
  const change = (module, patch) => setGrants(previous => previous.map(grant => grant.module === module ? { ...grant, ...patch } : grant));
  const save = async () => {
    setBusy(true);
    try { await api.put(`/api/v2/workspace/permissions/${userId}`, { permissions: grants }); setGrants(null); setSaved("Workspace permissions saved"); }
    catch (err) { setError(err.response?.data?.message || "Permissions could not be saved"); }
    finally { setBusy(false); }
  };
  return <div>
    <button className="border rounded p-2" onClick={open}>Workspace permissions</button>
    {saved && <p role="status">{saved}</p>}{error && !grants && <p role="alert">{error}</p>}
    {grants && <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4"><section ref={dialog} role="dialog" aria-modal="true" aria-labelledby={`employee-permissions-${userId}`} className="bg-white text-black rounded p-5 max-h-[90vh] overflow-auto space-y-3">
      <h3 id={`employee-permissions-${userId}`} className="font-semibold">Workspace access for {name}</h3>
      <p>These controls restrict customer work within existing ownership and organization boundaries. Saving may immediately remove access. Chat access is controlled separately by the employee’s WhatsApp access level.</p>
      {error && <p role="alert">{error}</p>}
      {grants.map(grant => <fieldset key={grant.module} className="border rounded p-2"><legend>{grant.module}</legend>
        <label><input type="checkbox" checked={grant.can_view} onChange={event => change(grant.module, { can_view: event.target.checked, ...(!event.target.checked ? { can_edit: false } : {}) })}/> View</label>{" "}
        <label><input type="checkbox" disabled={!grant.can_view} checked={grant.can_edit} onChange={event => change(grant.module, { can_edit: event.target.checked })}/> Edit</label>
      </fieldset>)}
      <button disabled={busy} className="border rounded p-2" onClick={() => setGrants(null)}>Cancel</button>{" "}<button disabled={busy} className="border rounded p-2" onClick={save}>{busy ? "Saving…" : "Confirm permission changes"}</button>
    </section></div>}
  </div>;
}
