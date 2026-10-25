import { useEffect, useState } from "react";
import api from "../config/axios";

export default function InboxRoutingSettings() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [senders, setSenders] = useState([]);
  useEffect(() => { api.get("/api/v2/inbox/routing/employees").then(({ data }) => {setRows(data.employees);setSenders(data.senders || []);}).catch(err => setError(err.response?.data?.message || "Routing settings unavailable")); }, []);
  const save = async row => {
    try {
      await api.patch(`/api/v2/inbox/routing/employees/${row.user_id}`, { branchId: row.branch_id, available: Boolean(row.is_available), enabled: Boolean(row.auto_assign_enabled), maxOpenChats: Number(row.max_open_chats), allowedSenderIds: row.allowed_sender_ids || [] });
      setSaved(`Saved routing for ${row.first_name}`); setError("");
    } catch (err) { setError(err.response?.data?.message || "Routing update failed"); }
  };
  const update = (index, patch) => setRows(previous => previous.map((row, i) => i === index || (patch.allowed_sender_ids && row.user_id === previous[index].user_id) ? { ...row, ...patch } : row));
  return <section className="border rounded p-4 space-y-3"><h2 className="font-semibold">Automatic chat assignment</h2><p>Round-robin across available employees in branches linked to the receiving number. Existing chat ownership stays unchanged.</p>
    {error && <p role="alert">{error}</p>}{saved && <p role="status">{saved}</p>}
    {rows.map((row, index) => <div key={`${row.user_id}:${row.branch_id}`} className="flex flex-wrap gap-4 items-center border-t py-2"><span>{row.first_name} · {row.branch_name}</span>
      <label><input type="checkbox" checked={Boolean(row.auto_assign_enabled)} onChange={e => update(index, { auto_assign_enabled: e.target.checked })} /> Auto assign</label>
      <label><input type="checkbox" checked={Boolean(row.is_available)} onChange={e => update(index, { is_available: e.target.checked })} /> Available</label>
      <label>Capacity <input className="border rounded p-1 w-20 text-black" type="number" min="1" max="1000" value={row.max_open_chats} onChange={e => update(index, { max_open_chats: e.target.value })} /></label><button className="border rounded p-2" onClick={() => save(row)}>Save routing</button>
      <label>Allowed numbers (empty means all linked branch numbers)<select multiple className="border rounded p-2 text-black" value={(row.allowed_sender_ids || []).map(String)} onChange={e => update(index,{allowed_sender_ids:[...e.target.selectedOptions].map(option=>Number(option.value))})}>{senders.map(sender=><option key={sender.id} value={sender.id}>{sender.display_phone || sender.verified_name || sender.id}</option>)}</select></label>
      <button className="border rounded p-2" onClick={()=>update(index,{allowed_sender_ids:[]})}>Use all branch numbers</button>
    </div>)}
  </section>;
}
