import { useEffect, useRef, useState } from "react";
import api from "../config/axios";
import { useEnterprise } from "../context/EnterpriseContext";

export default function EmployeeAudit() {
  const { activeTenant } = useEnterprise();
  const currentTenant = useRef(activeTenant?.id);
  currentTenant.current = activeTenant?.id;
  const [rows, setRows] = useState([]), [cursor, setCursor] = useState(null), [error, setError] = useState("");
  useEffect(() => {
    let active = true; setRows([]); setCursor(null); setError("");
    api.get("/api/v2/workspace/audit").then(({ data }) => { if (active) { setRows(data.records); setCursor(data.nextCursor); } }).catch(err => { if (active) setError(err.response?.data?.message || "Audit history unavailable"); });
    return () => { active = false; };
  }, [activeTenant?.id]);
  return <details className="border rounded p-3"><summary>Employee access and transfer audit</summary>
    {error && <p role="alert">{error}</p>}
    {!rows.length && !error && <p>No audit events recorded yet.</p>}
    {rows.map(row => <article key={row.id} className="border-t py-2"><p>{row.created_at} · {row.action} · Actor {row.actor_id || "system"} · Employee {row.subject_user_id || "—"}</p><pre className="whitespace-pre-wrap break-all text-sm">{row.details}</pre></article>)}
    {cursor && <button className="border rounded p-2" onClick={async () => { const tenantId = currentTenant.current; try { const { data } = await api.get("/api/v2/workspace/audit", { params: { before: cursor } }); if (currentTenant.current !== tenantId) return; setRows(previous => [...previous, ...data.records]); setCursor(data.nextCursor); } catch (err) { if (currentTenant.current === tenantId) setError(err.response?.data?.message || "Audit page unavailable"); } }}>Load earlier audit events</button>}
  </details>;
}
