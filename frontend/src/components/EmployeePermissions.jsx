import { useState } from "react";
import api from "../config/axios";
import useWADialog from "../hooks/useWADialog";
import { CUSTOMER_MODULES, WHATSAPP_MODULES, moduleLabel } from "../auth/workspaceAccess";

const LEVELS = [
  { value: "none", label: "No access" },
  { value: "view", label: "View" },
  { value: "edit", label: "Full use" },
];

// Mirrors backend `DEFAULT_EDIT`: modules an employee could already edit before
// grants existed. Everything else starts read-only until an admin raises it.
const editByDefault = (module) => CUSTOMER_MODULES.includes(module);

const levelOf = (grant) => (!grant.can_view ? "none" : grant.can_edit ? "edit" : "view");
const grantOf = (level) => ({ can_view: level !== "none", can_edit: level === "edit" });

export default function EmployeePermissions({ userId, name }) {
  const [grants, setGrants] = useState(null), [error, setError] = useState(""), [busy, setBusy] = useState(false), [saved, setSaved] = useState("");
  const dialog = useWADialog(Boolean(grants), () => setGrants(null), busy);

  const open = async () => {
    try {
      const { data } = await api.get(`/api/v2/workspace/permissions/${userId}`);
      setGrants(data.modules.map((module) => {
        const grant = data.permissions.find((row) => row.module === module);
        return grant
          ? { module, can_view: Boolean(grant.can_view), can_edit: Boolean(grant.can_edit) }
          : { module, can_view: true, can_edit: editByDefault(module) };
      }));
      setError("");
    } catch (err) { setError(err.response?.data?.message || "Permissions unavailable"); }
  };

  const setLevel = (module, level) => setGrants((previous) =>
    previous.map((grant) => (grant.module === module ? { module, ...grantOf(level) } : grant))
  );

  const save = async () => {
    setBusy(true);
    try {
      await api.put(`/api/v2/workspace/permissions/${userId}`, { permissions: grants });
      setGrants(null);
      setSaved("Workspace permissions saved");
    } catch (err) { setError(err.response?.data?.message || "Permissions could not be saved"); }
    finally { setBusy(false); }
  };

  const group = (title, modules) => {
    const rows = grants.filter((grant) => modules.includes(grant.module));
    if (!rows.length) return null;
    return (
      <fieldset key={title} className="border rounded p-2">
        <legend>{title}</legend>
        {rows.map((grant) => (
          <label key={grant.module} className="flex items-center justify-between gap-3 py-0.5">
            <span>{moduleLabel(grant.module)}</span>
            <select
              className="border rounded p-1"
              value={levelOf(grant)}
              onChange={(event) => setLevel(grant.module, event.target.value)}
            >
              {LEVELS.map((level) => (
                <option key={level.value} value={level.value}>{level.label}</option>
              ))}
            </select>
          </label>
        ))}
      </fieldset>
    );
  };

  return <div>
    <button className="border rounded p-2" onClick={open}>Workspace permissions</button>
    {saved && <p role="status">{saved}</p>}{error && !grants && <p role="alert">{error}</p>}
    {grants && <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4"><section ref={dialog} role="dialog" aria-modal="true" aria-labelledby={`employee-permissions-${userId}`} className="bg-white text-black rounded p-5 max-h-[90vh] overflow-auto space-y-3">
      <h3 id={`employee-permissions-${userId}`} className="font-semibold">Workspace access for {name}</h3>
      <p>Choose what {name} can do in the shared dashboard. <strong>View</strong> opens a module read-only. <strong>Full use</strong> also allows creating, editing, sending and publishing. Customer work stays inside existing ownership and organization boundaries; chat access is controlled separately by the employee’s WhatsApp access level.</p>
      {error && <p role="alert">{error}</p>}
      {group("Customer workspace", CUSTOMER_MODULES)}
      {group("WhatsApp modules", WHATSAPP_MODULES)}
      <button disabled={busy} className="border rounded p-2" onClick={() => setGrants(null)}>Cancel</button>{" "}<button disabled={busy} className="border rounded p-2" onClick={save}>{busy ? "Saving…" : "Confirm permission changes"}</button>
    </section></div>}
  </div>;
}
