import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../config/axios";
import { useEnterprise } from "../context/EnterpriseContext";
import useWADialog from "../hooks/useWADialog";
import socket from "../socket/socket";
import {
  AlertCircle,
  ArrowUpRight,
  Briefcase,
  CheckCircle2,
  Download,
  Inbox,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";

const root = "/api/v2/workspace";
const kinds = ["tasks", "leads", "deals", "activities", "transfers"];
const states = { tasks: ["open", "completed", "cancelled"], leads: ["new", "cold", "warm", "hot"], deals: ["new", "qualified", "proposal", "negotiation", "won", "lost"] };
const message = error => error.response?.data?.message || "The workspace is unavailable. Try again.";
const inputClass = "emp-field";

const STAT_LABELS = {
  customers: "Customers",
  clients: "Clients",
  open_tasks: "Open tasks",
  overdue_tasks: "Overdue tasks",
  completed_tasks: "Completed tasks",
  won_deals: "Won deals",
  deals: "Deals",
  leads: "Leads",
  qualified_leads: "Qualified leads",
  conversations: "Conversations",
  active_conversations: "Active chats",
  unread_messages: "Unread messages",
  first_response_samples: "Replies measured",
  average_first_response_seconds: "Avg first response",
};
const STAT_ORDER = Object.keys(STAT_LABELS);
const PRIMARY_STATS = ["customers", "open_tasks", "overdue_tasks", "deals", "conversations", "average_first_response_seconds"];
const SECONDARY_STATS = STAT_ORDER.filter(key => !PRIMARY_STATS.includes(key));

const asDate = value => {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value);
  const date = new Date(text.includes("T") ? text : text.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
};
const dateTimeLabel = value => {
  const date = asDate(value);
  return date ? date.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "";
};
const duration = seconds => {
  const value = Number(seconds);
  if (!Number.isFinite(value)) return "—";
  if (value < 60) return `${Math.round(value)}s`;
  if (value < 3600) return `${Math.round(value / 60)}m`;
  if (value < 86400) return `${(value / 3600).toFixed(1)}h`;
  return `${(value / 86400).toFixed(1)}d`;
};
const statValue = (key, value) => {
  if (key === "average_first_response_seconds") return value === null || value === undefined ? "Not yet measured" : duration(value);
  return Number(value || 0).toLocaleString("en-IN");
};
const money = value => {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(amount)
    : "—";
};
const initials = value => {
  const words = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2);
  return `${words[0][0]}${words[words.length - 1][0]}`;
};
const temperaturePill = value => (["hot", "warm", "cold"].includes(value) ? `emp-pill emp-pill-${value}` : "emp-pill");

export default function EmployeeWorkspace() {
  const { activeTenant } = useEnterprise();
  const [params, setParams] = useSearchParams();
  const id = params.get("customer");
  const [customers, setCustomers] = useState([]), [cursor, setCursor] = useState(null);
  const [search, setSearch] = useState(""), [query, setQuery] = useState("");
  const [detail, setDetail] = useState(null), [stats, setStats] = useState(null);
  const [kind, setKind] = useState("tasks"), [records, setRecords] = useState([]), [recordCursor, setRecordCursor] = useState(null);
  const [error, setError] = useState(""), [saved, setSaved] = useState(""), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState(""), [due, setDue] = useState(""), [amount, setAmount] = useState("");
  const [activityKind, setActivityKind] = useState("note");
  const [consentProof,setConsentProof]=useState("");
  const [transfer, setTransfer] = useState(false), [employees, setEmployees] = useState([]), [target, setTarget] = useState(""), [reason, setReason] = useState("");
  const [newName, setNewName] = useState(""), [newPhone, setNewPhone] = useState("");
  const revision = useRef(0), recordRevision = useRef(0), operationRevision = useRef(0);
  const detailId = detail?.customer.id;
  const dialog = useWADialog(transfer, () => setTransfer(false), busy);
  const refresh = useCallback(async () => {
    const version = ++revision.current;
    setLoading(true); setError("");
    try {
      const [list, metrics, profile] = await Promise.all([api.get(`${root}/customers`, { params: { search: query } }), api.get(`${root}/analytics`), id ? api.get(`${root}/customers/${id}`) : Promise.resolve(null)]);
      if (version !== revision.current) return;
      setCustomers(list.data.customers); setCursor(list.data.nextCursor); setStats(metrics.data); setDetail(profile?.data || null);
    } catch (err) {
      if (version === revision.current) { setError(message(err)); setCustomers([]); setDetail(null); setRecords([]); setStats(null); }
    } finally { if (version === revision.current) setLoading(false); }
  }, [id, query]);
  const loadRecords = useCallback(async () => {
    const version = ++recordRevision.current;
    setRecords([]); setRecordCursor(null);
    if (!id || !detailId || detail?.permissions?.[kind]?.view === false) return;
    try {
      const { data } = await api.get(`${root}/customers/${id}/${kind}`);
      if (version === recordRevision.current) { setRecords(data.records); setRecordCursor(data.nextCursor); }
    } catch (err) { if (version === recordRevision.current) setError(message(err)); }
  }, [id, kind, detailId, detail?.permissions]);
  useEffect(() => { const timer = setTimeout(() => setQuery(search), 300); return () => clearTimeout(timer); }, [search]);
  useEffect(() => {
    if (!saved) return undefined;
    const timer = setTimeout(() => setSaved(""), 5000);
    return () => clearTimeout(timer);
  }, [saved]);
  useEffect(() => {
    setDetail(null); setRecords([]); setTransfer(false); setTarget(""); setDraft(""); setConsentProof(""); setBusy(false); setSaved("");
    refresh();
    const changed = event => { if (Number(event.tenantId) === Number(activeTenant?.id)) { setDetail(null); setRecords([]); refresh(); } };
    socket.on("customer_access_changed", changed); socket.on("inbox_access_changed", changed);
    const visible = () => { if (!document.hidden) refresh(); };
    document.addEventListener("visibilitychange", visible);
    const invalidate = () => { revision.current++; recordRevision.current++; operationRevision.current++; };
    return () => { invalidate(); socket.off("customer_access_changed", changed); socket.off("inbox_access_changed", changed); document.removeEventListener("visibilitychange", visible); };
  }, [activeTenant?.id, refresh]);
  useEffect(() => { loadRecords(); const invalidate = () => { recordRevision.current++; }; return invalidate; }, [loadRecords]);
  const perform = async work => {
    const version = ++operationRevision.current;
    setBusy(true); setError(""); setSaved("");
    try { await work(); if (version !== operationRevision.current) return; setSaved("Saved successfully"); await refresh(); }
    catch (err) { if (version === operationRevision.current) setError(message(err)); }
    finally { if (version === operationRevision.current) setBusy(false); }
  };
  const create = event => {
    event.preventDefault();
    perform(async () => {
      await api.post(`${root}/customers/${id}/${kind}`, kind === "activities" ? { kind: activityKind, body: draft } : kind === "leads" ? { message: draft } : { title: draft, due_at: due || null, amount });
      setDraft(""); setDue(""); setAmount("");
    });
  };
  const openTransfer = async () => {
    const version = revision.current;
    setError("");
    try { const { data } = await api.get("/api/v2/inbox/routing/employees"); if (version !== revision.current) return; setEmployees(data.employees); setTransfer(true); }
    catch (err) { if (version === revision.current) setError(message(err)); }
  };
  const loadMoreCustomers = async () => {
    const version = revision.current;
    setBusy(true);
    try {
      const { data } = await api.get(`${root}/customers`, { params: { search: query, before: cursor } });
      if (version === revision.current) { setCustomers(previous => [...previous, ...data.customers]); setCursor(data.nextCursor); }
    } catch (err) { if (version === revision.current) setError(message(err)); } finally { setBusy(false); }
  };
  const loadMoreRecords = async () => {
    const version = recordRevision.current;
    try {
      const { data } = await api.get(`${root}/customers/${id}/${kind}`, { params: { before: recordCursor } });
      if (version !== recordRevision.current) return;
      setRecords(previous => [...previous, ...data.records]);
      setRecordCursor(data.nextCursor);
    } catch (err) { if (version === recordRevision.current) setError(message(err)); }
  };
  const exportCustomers = async () => {
    try {
      const response = await api.get(`${root}/customers/export`, { params: { search: query, limit: 100 }, responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url; link.download = "authorized-customers.csv"; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setSaved("Exported up to 100 authorized customers matching your search.");
    } catch (err) { setError(message(err)); }
  };
  const emptyKind = kind === "activities" ? "activity" : kind.slice(0, -1);
  const visibleStats = stats ? PRIMARY_STATS.filter(key => key in stats) : [];
  const secondaryStats = stats ? SECONDARY_STATS.filter(key => key in stats) : [];

  return <section className="emp-surface emp-page" aria-label="Employee workspace">
    <header className="emp-head">
      <div className="emp-head-copy">
        <p className="emp-eyebrow"><Briefcase size={12} aria-hidden="true" /> Customer workspace</p>
        <h1 className="emp-title">My workspace</h1>
        <p className="emp-sub">Customers and linked work are restricted to your organization, ownership and authorized team scope. Follow-ups, leads and deals you record here stay attached to the customer record.</p>
      </div>
      <div className="emp-head-actions">
        <button type="button" className="emp-btn" onClick={exportCustomers} disabled={busy}>
          <Download size={14} aria-hidden="true" /> Export
        </button>
        <button type="button" className="emp-btn" onClick={refresh} disabled={loading}>
          <RefreshCw size={14} className={loading ? "emp-spin" : ""} aria-hidden="true" /> Refresh
        </button>
      </div>
    </header>

    {error && <div className="emp-banner emp-banner-error" role="alert">
      <AlertCircle size={15} aria-hidden="true" />
      <span>{error}</span>
      <button type="button" className="emp-btn emp-btn-sm emp-btn-ghost" onClick={refresh}>Retry</button>
    </div>}
    {saved && <div className="emp-banner emp-banner-success" role="status">
      <CheckCircle2 size={15} aria-hidden="true" /> <span>{saved}</span>
    </div>}

    {visibleStats.length > 0 && <dl className="emp-kpis">
      {visibleStats.map(key => <div className="emp-kpi" key={key}>
        <dt>{STAT_LABELS[key]}</dt>
        <dd>{statValue(key, stats[key])}</dd>
      </div>)}
    </dl>}
    {secondaryStats.length > 0 && <p className="emp-statline">
      {secondaryStats.map(key => <span key={key}><b>{STAT_LABELS[key]}</b> {statValue(key, stats[key])}</span>)}
    </p>}
    {stats && <p className="emp-hint">Response statistics use the first customer message and first employee reply found per conversation in the last {stats.response_window_days || 7} days of retained metadata. They do not measure every reply or reconstruct deleted chat history.</p>}

    <div className="emp-work">
      <aside className="emp-work-list" aria-label="Authorized customers">
        <div className="emp-list-head">
          <div className="emp-search">
            <Search size={14} aria-hidden="true" />
            <input className="emp-field" aria-label="Search customers" placeholder="Search name, phone or email" value={search} onChange={event => setSearch(event.target.value)} maxLength={100} />
          </div>
          <details className="emp-details emp-add">
            <summary><Plus size={12} aria-hidden="true" /> Add customer</summary>
            <form className="emp-form" onSubmit={event => { event.preventDefault(); perform(async () => { const { data } = await api.post(`${root}/customers`, { name: newName, phone: newPhone }); setNewName(""); setNewPhone(""); setParams({ customer: data.id }); }); }}>
              <label className="emp-label">Customer name
                <input className={inputClass} required maxLength={255} value={newName} onChange={event => setNewName(event.target.value)} />
              </label>
              <label className="emp-label">Phone with country code
                <input className={inputClass} required maxLength={20} value={newPhone} onChange={event => setNewPhone(event.target.value)} />
              </label>
              <div className="emp-form-actions">
                <button type="submit" className="emp-btn emp-btn-sm emp-btn-primary" disabled={busy}>Create customer</button>
              </div>
              <p className="emp-hint">Ten local digits use India +91. Duplicate numbers are rejected.</p>
            </form>
          </details>
        </div>
        <div className="emp-list-scroll">
          {loading && <p className="emp-list-state" role="status">Loading workspace…</p>}
          {!loading && !customers.length && <p className="emp-list-state">No customers assigned in this view.</p>}
          {customers.map(row => <button
            key={row.id}
            type="button"
            aria-current={String(row.id) === id ? "true" : undefined}
            className="emp-customer"
            onClick={() => setParams({ customer: row.id })}
          >
            <span className="emp-avatar" aria-hidden="true">{initials(row.name)}</span>
            <span className="emp-customer-body">
              <strong>{row.name}</strong>
              <small>{row.phone}</small>
              <span className="emp-customer-tags">
                <span className={`emp-pill ${row.lifecycle_stage === "client" ? "emp-pill-ok" : ""}`}>{row.lifecycle_stage || "lead"}</span>
                {!row.assigned_agent_id && <span className="emp-pill emp-pill-warm">Unassigned</span>}
              </span>
            </span>
          </button>)}
          {cursor && <button type="button" className="emp-btn emp-btn-sm emp-loadmore" disabled={busy} onClick={loadMoreCustomers}>Load more customers</button>}
        </div>
      </aside>

      {detail ? <main className="emp-work-main">
        <section className="emp-profile">
          <div className="emp-profile-id">
            <span className="emp-avatar emp-avatar-lg" aria-hidden="true">{initials(detail.customer.name)}</span>
            <div>
              <h2>{detail.customer.name}</h2>
              <p>{detail.customer.phone} · {detail.customer.email || "No email"} · Owner {detail.customer.assigned_agent_id || "unassigned"}</p>
              <div className="emp-chiprow">
                <span className={`emp-pill ${detail.customer.lifecycle_stage === "client" ? "emp-pill-ok" : ""}`}>{detail.customer.lifecycle_stage || "lead"}</span>
                <span className={`emp-pill ${detail.customer.opt_in_status ? "emp-pill-ok" : "emp-pill-warm"}`}>
                  <ShieldCheck size={10} aria-hidden="true" /> Marketing consent {detail.customer.opt_in_status ? "recorded" : "not recorded"}
                </span>
              </div>
            </div>
          </div>
          <div className="emp-profile-actions">
            <Link className="emp-btn emp-btn-sm" to="/whatsapp/team-inbox"><Inbox size={13} aria-hidden="true" /> Open team inbox</Link>
            {detail.canTransfer && <button type="button" className="emp-btn emp-btn-sm" disabled={busy} onClick={openTransfer}>
              <Users size={13} aria-hidden="true" /> Transfer customer
            </button>}
          </div>
        </section>

        {detail.canEdit && <section className="emp-card">
          <h3 className="emp-card-title">Profile</h3>
          <form className="emp-form" onSubmit={event => { event.preventDefault(); perform(() => api.patch(`${root}/customers/${id}`, detail.customer)); }}>
            <div className="emp-form-row">
              <label className="emp-label">Name
                <input required maxLength={255} className={inputClass} value={detail.customer.name} onChange={event => setDetail(previous => ({ ...previous, customer: { ...previous.customer, name: event.target.value } }))} />
              </label>
              <label className="emp-label">Email
                <input type="email" maxLength={255} className={inputClass} value={detail.customer.email || ""} onChange={event => setDetail(previous => ({ ...previous, customer: { ...previous.customer, email: event.target.value } }))} />
              </label>
              <label className="emp-label">Lifecycle
                <select className={inputClass} value={detail.customer.lifecycle_stage} onChange={event => setDetail(previous => ({ ...previous, customer: { ...previous.customer, lifecycle_stage: event.target.value } }))}>
                  <option value="lead">Lead</option>
                  <option value="client">Client</option>
                </select>
              </label>
            </div>
            <div className="emp-form-actions">
              <button type="submit" disabled={busy} className="emp-btn emp-btn-sm emp-btn-primary">Save profile</button>
            </div>
          </form>
        </section>}

        {detail.canEdit && <section className="emp-card">
          <h3 className="emp-card-title">Marketing consent</h3>
          <form className="emp-form" onSubmit={event=>{event.preventDefault();if(!window.confirm("Record verified customer consent for marketing messages? This action is audited with your evidence."))return;perform(async()=>{await api.patch(`${root}/customers/${id}/consent`,{optIn:true,proof:consentProof});setConsentProof("");});}}>
            <div className="emp-form-row">
              <label className="emp-label">Consent evidence or reference
                <input required maxLength={1000} className={inputClass} value={consentProof} onChange={event=>setConsentProof(event.target.value)} />
              </label>
            </div>
            <div className="emp-form-actions">
              <button type="submit" disabled={busy||!consentProof.trim()} className="emp-btn emp-btn-sm">Record consent</button>
              {Boolean(detail.customer.opt_in_status)&&<button type="button" disabled={busy} className="emp-btn emp-btn-sm emp-btn-danger" onClick={()=>{if(!window.confirm("Revoke marketing consent? Queued campaigns will skip this customer before sending."))return;perform(()=>api.patch(`${root}/customers/${id}/consent`,{optIn:false}));}}>Revoke marketing consent</button>}
            </div>
            <p className="emp-hint">Consent events are audited. Campaigns skip customers without recorded consent.</p>
          </form>
        </section>}

        <section className="emp-card emp-card-flush">
          <div className="emp-tabs" role="tablist" aria-label="Customer modules">
            {kinds.filter(value => detail.permissions?.[value]?.view !== false).map(value => <button
              key={value}
              type="button"
              role="tab"
              aria-selected={kind === value}
              className="emp-tab"
              onClick={() => { setKind(value); setDraft(""); }}
            >
              {value}
              {kind === value && records.length > 0 && <span className="emp-count">{records.length}</span>}
            </button>)}
          </div>
          <div className="emp-records">
            {records.length === 0 && <p className="emp-hint">No {kind} recorded for this customer yet.</p>}
            {records.map(row => <article key={row.id} className="emp-record">
              <div className="emp-record-head">
                <p>{row.title || row.message || row.body || row.reason}</p>
                {kind === "leads" && row.temperature && <span className={temperaturePill(row.temperature)}>{row.temperature}</span>}
                {kind === "deals" && row.stage && <span className="emp-pill">{row.stage}</span>}
                {kind === "tasks" && row.status && <span className={`emp-pill ${row.status === "completed" ? "emp-pill-ok" : row.status === "open" ? "" : "emp-pill-off"}`}>{row.status}</span>}
              </div>
              <p className="emp-record-meta">
                #{row.id}
                {dateTimeLabel(row.created_at) ? ` · ${dateTimeLabel(row.created_at)}` : ""}
                {row.due_at ? ` · Due ${dateTimeLabel(row.due_at)}` : ""}
                {kind === "deals" && row.amount !== undefined && row.amount !== null ? ` · ${money(row.amount)}` : ""}
              </p>
              {kind === "transfers" && <p className="emp-record-meta">
                Owner {row.previous_owner_user_id || "unassigned"} → {row.owner_user_id} · Actor {row.actor_id} · {row.conversation_count} conversations
              </p>}
              {states[kind] && <label className="emp-label">Status
                <select
                  disabled={busy || !detail.permissions?.[kind]?.edit}
                  className={inputClass}
                  value={row.status && kind === "tasks" ? row.status : kind === "deals" ? row.stage : row.temperature}
                  onChange={event => perform(() => api.patch(`${root}/customers/${id}/${kind}/${row.id}`, { [kind === "tasks" ? "status" : kind === "deals" ? "stage" : "temperature"]: event.target.value }))}
                >
                  {states[kind].map(value => <option key={value}>{value}</option>)}
                </select>
              </label>}
            </article>)}
            {recordCursor && <button type="button" className="emp-btn emp-btn-sm" disabled={busy} onClick={loadMoreRecords}>Load more {kind}</button>}
            {kind !== "transfers" && detail.permissions?.[kind]?.edit && <form onSubmit={create} className="emp-record-form">
              <h4 className="emp-card-title">Add {emptyKind}</h4>
              {kind === "activities" && <label className="emp-label">Activity type
                <select className={inputClass} value={activityKind} onChange={event => setActivityKind(event.target.value)}>
                  <option value="note">Note</option>
                  <option value="call">Call log</option>
                  <option value="meeting">Meeting</option>
                </select>
              </label>}
              <label className="emp-label">{kind === "activities" ? "Customer note" : kind === "leads" ? "Lead enquiry" : `${kind === "tasks" ? "Task" : "Deal"} title`}
                <textarea required maxLength={kind === "activities" || kind === "leads" ? 10000 : 255} className={inputClass} value={draft} onChange={event => setDraft(event.target.value)} />
              </label>
              {kind === "tasks" && <label className="emp-label">Follow-up date
                <input type="datetime-local" className={inputClass} value={due} onChange={event => setDue(event.target.value)} />
              </label>}
              {kind === "deals" && <label className="emp-label">Amount
                <input type="number" min="0" step="0.01" className={inputClass} value={amount} onChange={event => setAmount(event.target.value)} />
              </label>}
              <div className="emp-form-actions">
                <button type="submit" disabled={busy || !draft.trim()} className="emp-btn emp-btn-sm emp-btn-primary">
                  {busy ? "Saving…" : "Add record"}
                </button>
                {saved && <span className="emp-hint emp-hint-ok" aria-hidden="true">{saved}</span>}
              </div>
            </form>}
          </div>
        </section>
      </main> : <div className="emp-empty">
        <UserRound size={22} aria-hidden="true" />
        <strong>Select an assigned customer</strong>
        <span>Their profile, tasks, leads, deals, notes and transfer history open here. Conversations live in the team inbox.</span>
        <Link className="emp-link" to="/whatsapp/team-inbox">Open team inbox <ArrowUpRight size={12} aria-hidden="true" /></Link>
      </div>}
    </div>

    {transfer && detail && <div className="emp-overlay">
      <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby="transfer-title" className="emp-dialog">
        <h2 id="transfer-title">Transfer {detail.customer.name}</h2>
        {error && <div className="emp-banner emp-banner-error" role="alert"><AlertCircle size={14} aria-hidden="true" /><span>{error}</span></div>}
        <p>Current owner: {detail.customer.assigned_agent_id || "unassigned"}. All customer conversations, leads, deals, notes and open follow-ups move together. The previous owner loses access. Active chat automations pause. Saved history stays attached; chat text stored only on another device cannot be recovered here.</p>
        <label className="emp-label">Destination employee and branch
          <select required className={inputClass} value={target} onChange={event => setTarget(event.target.value)}>
            <option value="">Choose employee</option>
            {employees.map(row => <option key={`${row.user_id}:${row.branch_id}`} value={`${row.user_id}:${row.branch_id}`}>{row.first_name} · {row.branch_name}</option>)}
          </select>
        </label>
        <label className="emp-label">Transfer reason
          <textarea required maxLength={1000} className={inputClass} value={reason} onChange={event => setReason(event.target.value)} />
        </label>
        <p className="emp-hint">The server records your identity and the transfer timestamp after a successful commit.</p>
        <div className="emp-dialog-actions">
          <button type="button" className="emp-btn" disabled={busy} onClick={() => setTransfer(false)}>Cancel</button>
          <button
            type="button"
            className="emp-btn emp-btn-primary"
            disabled={busy || !target || !reason.trim()}
            onClick={() => perform(async () => { const [userId, branchId] = target.split(":").map(Number); await api.post(`${root}/customers/${id}/transfer`, { userId, branchId, expectedOwnerId: detail.customer.assigned_agent_id, reason }); setTransfer(false); setReason(""); })}
          >
            {busy ? "Transferring…" : "Confirm full transfer"}
          </button>
        </div>
      </section>
    </div>}
  </section>;
}
