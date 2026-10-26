import { useEffect, useState } from "react";
import api from "../config/axios";
import EmployeePermissions from "./EmployeePermissions";
import EmployeeAudit from "./EmployeeAudit";

export default function InboxRoutingSettings() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [senders, setSenders] = useState([]);
  const [settings, setSettings] = useState({ strategy: "round_robin", required_skill: "" });
  const [skills, setSkills] = useState({});
  useEffect(() => { Promise.all([api.get("/api/v2/inbox/routing/employees"), api.get("/api/v2/inbox/routing/settings")]).then(([routing, rules]) => {
    setRows(routing.data.employees); setSenders(routing.data.senders || []); setSettings(rules.data.settings);
    setSkills(Object.fromEntries(routing.data.employees.map(row => [row.user_id, rules.data.skills.filter(item => item.user_id === row.user_id).map(item => item.skill).join(", ")])));
  }).catch(err => setError(err.response?.data?.message || "Routing settings unavailable")); }, []);
  const save = async row => {
    try {
      if (!window.confirm(`Update availability, capacity, skills and WhatsApp number access for ${row.first_name}? These settings can change which conversations they can access.`)) return;
      await api.patch(`/api/v2/inbox/routing/employees/${row.user_id}`, { branchId: row.branch_id, available: Boolean(row.is_available), enabled: Boolean(row.auto_assign_enabled), maxOpenChats: Number(row.max_open_chats),maxOpenLeads:Number(row.max_open_leads||250), allowedSenderIds: row.allowed_sender_ids || [], skills: (skills[row.user_id] || "").split(",").map(value => value.trim()).filter(Boolean) });
      setSaved(`Saved routing for ${row.first_name}`); setError("");
    } catch (err) { setError(err.response?.data?.message || "Routing update failed"); }
  };
  const update = (index, patch) => setRows(previous => previous.map((row, i) => i === index || (patch.allowed_sender_ids && row.user_id === previous[index].user_id) ? { ...row, ...patch } : row));
  return <section className="border rounded p-4 space-y-3"><h2 className="font-semibold">Automatic chat assignment</h2><p>Round-robin across available employees in branches linked to the receiving number. Existing chat ownership stays unchanged.</p>
    <EmployeeAudit/>
    <label>Strategy <select className="border rounded p-2 text-black" value={settings.strategy} onChange={event => setSettings(previous => ({ ...previous, strategy: event.target.value }))}><option value="round_robin">Round robin</option><option value="workload">Lowest open workload</option><option value="manual">Manual assignment</option></select></label>
    <label>Required skill (optional) <input maxLength={80} className="border rounded p-2 text-black" value={settings.required_skill || ""} onChange={event => setSettings(previous => ({ ...previous, required_skill: event.target.value }))}/></label>
    <label>CRM customer/lead strategy <select className="border rounded p-2 text-black" value={settings.crm_strategy||"round_robin"} onChange={event=>setSettings(previous=>({...previous,crm_strategy:event.target.value}))}><option value="round_robin">Round robin</option><option value="workload">Lowest open lead workload</option><option value="manual">Manual assignment</option></select></label>
    <label>CRM required skill <input maxLength={80} className="border rounded p-2 text-black" value={settings.crm_required_skill||""} onChange={event=>setSettings(previous=>({...previous,crm_required_skill:event.target.value}))}/></label>
    <button className="border rounded p-2" onClick={async()=>{if(!window.confirm("Assign up to 50 waiting CRM customers using the saved intake rules? Existing owners stay assigned."))return;try{const {data}=await api.post("/api/v2/workspace/intake/rebalance");setSaved(`${data.assigned} of ${data.reviewed} waiting CRM customers assigned`);setError("");}catch(err){setError(err.response?.data?.message||"CRM assignment failed");}}}>Assign waiting CRM customers</button>
    <button className="border rounded p-2" onClick={async () => { if (!window.confirm("Change routing for new and waiting conversations? Existing owners stay assigned.")) return; try { await api.put("/api/v2/inbox/routing/settings", settings); setSaved("Assignment strategy saved"); setError(""); } catch (err) { setError(err.response?.data?.message || "Strategy update failed"); } }}>Save strategy</button>
    <button className="border rounded p-2" onClick={async () => { if (!window.confirm("Transfer up to 25 customers owned by inactive employees to eligible active employees? Complete customer history and work will follow the new owner.")) return; try { const { data } = await api.post("/api/v2/workspace/reassign-inactive"); setSaved(`${data.results.filter(row => row.status === "transferred").length} customers transferred; ${data.results.filter(row => row.status !== "transferred").length} require manual review`); setError(""); } catch (err) { setError(err.response?.data?.message || "Reassignment failed"); } }}>Recover inactive employee work</button>
    {error && <p role="alert">{error}</p>}{saved && <p role="status">{saved}</p>}
    {rows.map((row, index) => <div key={`${row.user_id}:${row.branch_id}`} className="flex flex-wrap gap-4 items-center border-t py-2"><span>{row.first_name} · {row.branch_name}</span>
      <span>{row.open_count || 0} open conversations · {row.employee_status}</span>
      {/* Administrators reach every module through their role, so a grant
          editor would be meaningless (and the API refuses it). */}
      {!["admin", "subadmin", "platform_admin"].includes(row.employee_role) && <EmployeePermissions userId={row.user_id} name={row.first_name}/>}
      {["admin", "subadmin", "platform_admin"].includes(row.employee_role) && <span className="text-xs opacity-70">Full workspace access (administrator)</span>}
      <label>Skills (comma separated) <input className="border rounded p-2 text-black" value={skills[row.user_id] || ""} onChange={event => setSkills(previous => ({ ...previous, [row.user_id]: event.target.value }))}/></label>
      <label><input type="checkbox" checked={Boolean(row.auto_assign_enabled)} onChange={e => update(index, { auto_assign_enabled: e.target.checked })} /> Auto assign</label>
      <label><input type="checkbox" checked={Boolean(row.is_available)} onChange={e => update(index, { is_available: e.target.checked })} /> Available</label>
      <label>Capacity <input className="border rounded p-1 w-20 text-black" type="number" min="1" max="1000" value={row.max_open_chats} onChange={e => update(index, { max_open_chats: e.target.value })} /></label><button className="border rounded p-2" onClick={() => save(row)}>Save routing</button>
      <label>Open lead capacity <input className="border rounded p-1 w-24 text-black" type="number" min="1" max="10000" value={row.max_open_leads||250} onChange={event=>update(index,{max_open_leads:event.target.value})}/></label>
      <label>Allowed numbers (empty means all linked branch numbers)<select multiple className="border rounded p-2 text-black" value={(row.allowed_sender_ids || []).map(String)} onChange={e => update(index,{allowed_sender_ids:[...e.target.selectedOptions].map(option=>Number(option.value))})}>{senders.map(sender=><option key={sender.id} value={sender.id}>{sender.display_phone || sender.verified_name || sender.id}</option>)}</select></label>
      <button className="border rounded p-2" onClick={()=>update(index,{allowed_sender_ids:[]})}>Use all branch numbers</button>
    </div>)}
  </section>;
}
