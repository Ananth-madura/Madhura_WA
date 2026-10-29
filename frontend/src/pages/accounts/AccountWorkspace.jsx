import React, { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { Link, useSearchParams } from "react-router-dom";
import { API } from "../../config/api";
import { useEnterprise } from "../../context/EnterpriseContext";
import { metaSignup } from "./metaSignup";
import "./accounts.css";

const message = error => error.response?.data?.message || error.message || "The request failed. Try again.";
const when = value => value ? new Date(value).toLocaleString() : "Not checked";
const emptyConnection = { wabaId: "", phoneNumberId: "", accessToken: "", appSecret: "", isShared: true, branchIds: [], defaultBranchIds: [] };
export function RoutingFields({ value, onChange, branches }) {
  const selected = value.branchIds || [];
  const defaults = value.defaultBranchIds || [];
  return <fieldset className="ac-routing"><legend>Branch routing</legend>
    <label className="ac-check"><input type="checkbox" checked={value.isShared} onChange={e => onChange({ ...value, isShared: e.target.checked })} />Allow this sender as the organization fallback</label>
    <p>Assign branches directly below. A default replaces the previous default for that branch. Shared senders also handle branches without an assigned number.</p>
    {value.isShared && !selected.length && <p>No branch selection means all active branches will be assigned when you save.</p>}
    {!branches.length && <p>No active branches. <Link to="/whatsapp/branches/new">Create a branch</Link> before connecting.</p>}
    {branches.filter(b => !b.status || b.status === "active").map(branch => {
      const id = Number(branch.id), checked = selected.includes(id);
      return <div className="ac-branch" key={id}><label className="ac-check"><input type="checkbox" checked={checked} onChange={e => onChange({ ...value, branchIds: e.target.checked ? [...selected, id] : selected.filter(x => x !== id), defaultBranchIds: defaults.filter(x => x !== id) })} />{branch.name}</label>
        <label className="ac-check"><input type="checkbox" disabled={!checked} checked={defaults.includes(id)} onChange={e => onChange({ ...value, defaultBranchIds: e.target.checked ? [...defaults, id] : defaults.filter(x => x !== id) })} />Default<span className="ac-sr"> for {branch.name}</span></label></div>;
    })}
  </fieldset>;
}
function Credentials({ value, onChange, rotation = false }) {
  const field = (key, label, secret = false, required = false) => <label>{label}<input autoComplete="off" type={secret ? "password" : "text"} required={required} maxLength={key === "accessToken" ? 8000 : key === "appSecret" ? 255 : 100} value={value[key] || ""} onChange={e => onChange({ ...value, [key]: e.target.value })} /></label>;
  return <>{!rotation && <div className="ac-fields">{field("wabaId", "WhatsApp Business Account ID", false, true)}{field("phoneNumberId", "Phone number ID", false, true)}</div>}
    {field("accessToken", "Access token", true, true)}{field("appSecret", rotation ? "New app secret (leave blank to keep current)" : "App secret (required for incoming messages)", true)}
    <p>Credentials are encrypted on the server. Token permissions and phone ownership are checked with Meta before saving.</p></>;
}
function Assistant({ request, admin, run, busy }) {
  const [value, setValue] = useState(null), [error, setError] = useState("");
  useEffect(() => { let active = true; request("get", "/inbox/assistant/settings").then(data => { if (active) setValue({ ...data.settings, enabled: Boolean(data.settings.enabled), autoStart: Boolean(data.settings.auto_start), systemPrompt: data.settings.system_prompt || "", apiKey: "", clearKey: false }); }).catch(e => { if (active) setError(message(e)); }); return () => { active = false; }; }, [request]);
  if (error) return <p role="alert">{error}</p>;
  if (!value) return <p role="status">Loading assistant settings…</p>;
  const change = (key, next) => setValue(v => ({ ...v, [key]: next }));
  return <section aria-labelledby="assistant-heading"><h2 id="assistant-heading">Business assistant</h2><p>Settings apply to this organization. Employees can take over a conversation in the inbox.</p>
    <form onSubmit={e => { e.preventDefault(); run("assistant", async () => { const data = await request("put", "/inbox/assistant/settings", { enabled: value.enabled, autoStart: value.autoStart, provider: value.provider, model: value.model, systemPrompt: value.systemPrompt, ...(value.apiKey ? { apiKey: value.apiKey } : {}), clearKey: value.clearKey }); setValue(v => ({ ...v, hasApiKey: data.settings.hasApiKey, apiKey: "", clearKey: false })); }, "Assistant settings saved."); }}>
      <fieldset disabled={!admin || Boolean(busy)}><legend className="ac-sr">Assistant configuration</legend>
        <label className="ac-check"><input type="checkbox" checked={value.enabled} onChange={e => change("enabled", e.target.checked)} />Enable AI replies</label>
        <label className="ac-check"><input type="checkbox" checked={value.autoStart} onChange={e => change("autoStart", e.target.checked)} />Start the assistant on new conversations</label>
        <div className="ac-fields"><label>Provider<select value={value.provider} onChange={e => { change("provider", e.target.value); change("apiKey", ""); change("hasApiKey", false); }}>{["openai", "openrouter", "groq", "gemini", "deepseek"].map(name => <option key={name}>{name}</option>)}</select></label>
          <label>Model ID<input required={value.enabled} value={value.model} maxLength={150} onChange={e => change("model", e.target.value)} /></label></div>
        <label>Provider API key {value.hasApiKey ? "(saved; leave blank to keep)" : "(not saved)"}<input type="password" autoComplete="off" maxLength={2000} value={value.apiKey} onChange={e => change("apiKey", e.target.value)} /></label>
        <label className="ac-check"><input type="checkbox" checked={value.clearKey} onChange={e => change("clearKey", e.target.checked)} />Remove saved API key</label>
        <label>Business instructions<textarea rows={7} maxLength={10000} value={value.systemPrompt} onChange={e => change("systemPrompt", e.target.value)} /></label>
        <p>The assistant answers messages. It cannot verify payments or change business records. Use configured workflows for those actions.</p>
        {admin && <button className="ac-primary" type="submit">{busy === "assistant" ? "Saving…" : "Save assistant settings"}</button>}
      </fieldset>
    </form></section>;
}
export default function AccountWorkspace() {
  const enterprise = useEnterprise();
  if (enterprise.loading) return <p className="ac-workspace" role="status">Loading organization…</p>;
  if (!enterprise.activeTenant) return <p className="ac-workspace">Select an organization to manage WhatsApp accounts.</p>;
  return <Workspace key={enterprise.activeTenant.id} enterprise={enterprise} />;
}
export function Workspace({ enterprise }) {
  const { activeTenant, branches = [], isOwnerOrAdmin: admin, getHeaders } = enterprise;
  const [params, setParams] = useSearchParams();
  const [senders, setSenders] = useState([]), [setup, setSetup] = useState(null), [loading, setLoading] = useState(true);
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState("");
  const [query, setQuery] = useState(""), [filter, setFilter] = useState("all");
  const [connection, setConnection] = useState(emptyConnection), [route, setRoute] = useState(null), [credentials, setCredentials] = useState({});
  const [webhook, setWebhook] = useState(null), [events, setEvents] = useState([]), [detailError, setDetailError] = useState(""), [detailLoading, setDetailLoading] = useState(false), [confirm, setConfirm] = useState(false);
  const [pin, setPin] = useState("");
  const alive = useRef(true), signup = useRef(null), operation = useRef(false), loadVersion = useRef(0);
  useEffect(() => { alive.current = true; return () => { alive.current = false; signup.current?.abort(); }; }, []);
  const request = useCallback(async (method, path, data) => {
    const headers = { ...(getHeaders ? getHeaders() : {}), "x-tenant-id": String(activeTenant.id) };
    const response = await axios({ method, url: `${API}/api/v2${path}`, headers, withCredentials: true, ...(data !== undefined ? { data } : {}) });
    if (response.data.success === false) throw new Error(response.data.message || "The operation failed.");
    return response.data;
  }, [getHeaders, activeTenant.id]);
  const refresh = useCallback(async () => {
    const version = ++loadVersion.current; setLoading(true);
    try { const [list, config] = await Promise.all([request("get", "/meta/senders"), request("get", "/meta/setup")]); if (alive.current && version === loadVersion.current) { setSenders(list.senders); setSetup(config); } }
    finally { if (alive.current && version === loadVersion.current) setLoading(false); }
  }, [request]);
  useEffect(() => { refresh().catch(e => { if (alive.current) setError(message(e)); }); }, [refresh]);
  const selectedId = params.get("sender");
  const sender = senders.find(row => String(row.id) === selectedId) || null;
  const tab = params.get("tab") === "assistant" ? "assistant" : "senders";
  const connecting = params.get("connect") === "1";
  const navigate = patch => { const next = new URLSearchParams(params); Object.entries(patch).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key)); setParams(next); };
  useEffect(() => {
    setConfirm(false); setPin(""); setCredentials({}); setWebhook(null); setEvents([]); setDetailError("");
    if (!sender) { setRoute(null); return; }
    setRoute({ isShared: sender.is_shared, branchIds: sender.assigned_branch_ids.map(Number), defaultBranchIds: sender.default_branch_ids.map(Number) });
    let current = true; setDetailLoading(true);
    Promise.all([request("get", `/meta/senders/${sender.id}/activity`), admin ? request("get", `/meta/senders/${sender.id}/webhook`) : Promise.resolve(null)]).then(([activity, settings]) => { if (current) { setEvents(activity.events); setWebhook(settings); } }).catch(e => { if (current) setDetailError(message(e)); }).finally(() => { if (current) setDetailLoading(false); });
    return () => { current = false; };
  }, [sender, request, admin]);
  const run = async (name, work, success) => {
    if (operation.current) return;
    operation.current = true; setBusy(name); setError(""); setNotice("");
    try { await work(); if (alive.current) setNotice(success); }
    catch (e) { if (alive.current) setError(message(e)); }
    finally { operation.current = false; if (alive.current) setBusy(""); }
  };
  const saveSender = async (method, path, data) => { const result = await request(method, path, data); await refresh(); return result.sender || result.data; };
  const visible = senders.filter(row => (filter === "all" || row.status === filter) && `${row.display_phone} ${row.verified_name || ""} ${row.assigned_branches}`.toLowerCase().includes(query.toLowerCase()));
  const startSignup = () => run("signup", async () => {
    const { session } = await request("post", "/meta/onboarding/sessions", {});
    signup.current = new AbortController(); const result = await metaSignup(session, signup.current.signal);
    const data = await saveSender("post", "/meta/onboarding/complete", { ...result, isShared: true, branchIds: branches.filter(b => b.status === "active").map(b => Number(b.id)) });
    if (alive.current) navigate({ sender: String(data.id), connect: null });
  }, "WhatsApp connection saved. Review branch routing and webhook setup.");
  return <main className="ac-workspace" aria-labelledby="accounts-title">
    <header className="ac-header"><div><p className="ac-context">{activeTenant.name} / WhatsApp</p><h1 id="accounts-title">Accounts</h1><p>Connect numbers, route conversations and configure your assistant.</p></div>
      <div className="ac-actions"><button disabled={loading || Boolean(busy)} onClick={() => run("refresh", refresh, "Sender list refreshed.")}>Refresh</button>{admin && <button className="ac-primary" disabled={Boolean(busy)} onClick={() => navigate({ connect: "1", tab: null })}>Connect number</button>}</div></header>
    <nav className="ac-tabs" aria-label="Account sections"><Link aria-current={tab === "senders" ? "page" : undefined} to="?tab=senders">WhatsApp numbers</Link><Link aria-current={tab === "assistant" ? "page" : undefined} to="?tab=assistant">Business assistant</Link><Link to="/whatsapp/automations">Automations</Link><Link to="/whatsapp/flows">Workflow builder</Link><Link to="/whatsapp/templates">Templates</Link><Link to="/whatsapp">Inbox</Link></nav>
    <div className="ac-feedback" aria-live="polite">{notice && <p role="status">{notice}</p>}{error && <p className="ac-error" role="alert">{error}</p>}</div>
    {!admin && <p>Connection settings are managed by your organization owner or administrator.</p>}
    {tab === "assistant" ? <div className="ac-panel ac-assistant"><Assistant request={request} run={run} busy={busy} admin={admin} /></div> : <>
      <div className="ac-summary" aria-label="Sender totals">{setup ? <><span><strong>{senders.length}</strong> numbers</span><span><strong>{senders.filter(s => s.status === "connected").length}</strong> connected</span><span><strong>{senders.filter(s => s.health_error || s.status !== "connected").length}</strong> need attention</span></> : <span>{loading ? "Loading connection counts…" : "Connection counts unavailable"}</span>}<span>Organization routing · {branches.length} branches</span></div>
      {connecting && admin && <section className="ac-panel ac-connect" aria-labelledby="connect-title"><div className="ac-section-heading"><h2 id="connect-title">Connect a WhatsApp number</h2><button disabled={Boolean(busy)} onClick={() => { setConnection(emptyConnection); navigate({ connect: null }); }}>Close connection form</button></div>
        <p>Use Meta signup or credentials from your WhatsApp Business app.</p>
        {setup?.embeddedSignupConfigured ? <div className="ac-actions"><button disabled={Boolean(busy)} onClick={startSignup}>{busy === "signup" ? "Waiting for Meta…" : "Continue with Meta"}</button>{busy === "signup" && <button onClick={() => signup.current?.abort()}>Cancel signup</button>}</div> : <p>Embedded signup needs the server’s Meta app ID, app secret and configuration ID. You can connect with a token below.</p>}
        <form onSubmit={e => { e.preventDefault(); run("connect", async () => { const saved = await saveSender("post", "/meta/senders/manual", connection); if (alive.current) { setConnection(emptyConnection); navigate({ sender: String(saved.id), connect: null }); } }, "Number verified and saved. Configure its webhook to receive messages."); }}>
          <fieldset disabled={Boolean(busy)}><legend className="ac-sr">Token connection</legend><Credentials value={connection} onChange={setConnection} /><RoutingFields value={connection} onChange={setConnection} branches={branches} /><button className="ac-primary" type="submit">{busy === "connect" ? "Verifying with Meta…" : "Verify and connect"}</button></fieldset>
        </form></section>}
      <div className="ac-toolbar"><label>Search numbers<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Phone, name or branch" /></label><label>Status<select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All statuses</option><option value="connected">Connected</option><option value="pending">Pending</option><option value="disconnected">Disconnected</option></select></label></div>
      <div className="ac-columns"><section className="ac-panel ac-list" aria-label="WhatsApp numbers" aria-busy={loading}>
        {loading && <p role="status">Loading numbers…</p>}{!loading && !setup && <div className="ac-empty"><h2>Could not load numbers</h2><p>Use Refresh to retry the connection.</p></div>}{!loading && setup && !visible.length && <div className="ac-empty"><h2>{senders.length ? "No matching numbers" : "Connect your first number"}</h2><p>{senders.length ? "Change the search or status filter." : "A verified Meta connection lets your team receive messages and run automations."}</p></div>}
        {visible.map(row => <button className={`ac-sender ${sender?.id === row.id ? "ac-selected" : ""}`} key={row.id} aria-pressed={sender?.id === row.id} onClick={() => navigate({ sender: String(row.id) })}><span className="ac-sender-top"><strong>{row.verified_name || "WhatsApp number"}</strong><span className="ac-status">{row.status}</span></span><span className="ac-phone">{row.display_phone}</span><span>{row.assigned_branches || "No branch assignment"}</span>{row.health_error && <span className="ac-error">Connection check failed</span>}<span className="ac-muted">{row.last_verified_at ? `Checked ${when(row.last_verified_at)}` : "Not yet checked"}</span></button>)}
      </section>
      <section className="ac-panel ac-detail" aria-label="Sender details">{!sender ? <div className="ac-empty"><h2>{selectedId ? "Number unavailable" : "Select a number"}</h2><p>{selectedId ? "Reload the list or choose another number in this organization." : "Review connection details, branch routing and webhook activity."}</p></div> : <>
        <div className="ac-section-heading"><div><h2>{sender.verified_name || sender.display_phone}</h2><span className="ac-phone">{sender.display_phone}</span></div><span className="ac-status">{sender.status}</span></div>
        {sender.health_error && <p className="ac-error">{sender.health_error}</p>}
        <dl className="ac-facts"><div><dt>Phone number ID</dt><dd>{sender.phone_number_id}</dd></div><div><dt>Business account ID</dt><dd>{sender.waba_id || "Unavailable"}</dd></div><div><dt>Quality</dt><dd>{sender.quality || "Not verified"}</dd></div><div><dt>Messaging tier</dt><dd>{sender.messaging_tier || "Not reported by Meta"}</dd></div><div><dt>Last verified</dt><dd>{when(sender.last_verified_at)}</dd></div><div><dt>Credentials</dt><dd>{sender.has_token ? "Access token saved" : "Access token missing"}; {sender.has_app_secret ? "app secret saved" : "app secret missing"}</dd></div></dl>
        {admin && sender.status !== "disconnected" && <button disabled={Boolean(busy)} onClick={() => run("sync", () => saveSender("post", `/meta/senders/${sender.id}/sync`, {}), "Status verified with Meta.")}>{busy === "sync" ? "Checking…" : "Check connection"}</button>}
        {sender.status === "disconnected" && <p>This sender is disconnected. Connect the same Meta phone ID to restore it. Its message history is retained.</p>}
        {admin && sender.status === "pending" && <form className="ac-detail-section" onSubmit={e => { e.preventDefault(); run("register", async () => { await saveSender("post", `/meta/senders/${sender.id}/register`, { pin }); if (alive.current) setPin(""); }, "Registration request confirmed by Meta. Review the refreshed connection status."); }}><h3>Register number</h3><p>Complete number verification in WhatsApp Manager first. Supply the six-digit two-step verification PIN to register it for Cloud API messaging.</p><label>Two-step verification PIN<input type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="off" value={pin} onChange={e => setPin(e.target.value)} /></label><button disabled={Boolean(busy)} type="submit">Register with Meta</button></form>}
        {route && <form className="ac-detail-section" onSubmit={e => { e.preventDefault(); run("routing", () => saveSender("patch", `/meta/senders/${sender.id}/branch-assignments`, { ...route, revision: sender.revision }), "Branch routing saved."); }}><fieldset disabled={!admin || Boolean(busy) || sender.status === "disconnected"}><legend className="ac-sr">Edit routing</legend><RoutingFields value={route} onChange={setRoute} branches={branches} />{admin && <button type="submit">Save routing</button>}</fieldset></form>}
        {detailLoading && <p role="status">Loading sender setup…</p>}{detailError && <p role="alert" className="ac-error">{detailError}</p>}
        {admin && webhook && <section className="ac-detail-section"><h3>Receive messages</h3><p>Configure this callback in your Meta app, verify it, then subscribe the app to this business account.</p><label>Webhook callback<input readOnly value={webhook.callbackUrl || "Set PUBLIC_BASE_URL on the server"} /></label><label>Verify token<input readOnly type="password" value={webhook.verifyToken || "Reconnect to generate a token"} /></label><div className="ac-actions"><button disabled={!webhook.verifyToken || Boolean(busy)} onClick={() => run("copy", () => navigator.clipboard.writeText(webhook.verifyToken), "Verify token copied.")}>Copy verify token</button><button disabled={!sender.has_app_secret || !sender.has_token || sender.status === "disconnected" || Boolean(busy)} onClick={() => run("subscribe", () => saveSender("post", `/meta/senders/${sender.id}/webhook`, {}), "Meta confirmed the app subscription.")}>Subscribe app</button></div><p>Subscription confirmed: {sender.webhook_subscribed_at ? when(sender.webhook_subscribed_at) : "Not confirmed"}</p></section>}
        {admin && <details className="ac-detail-section"><summary>Update credentials</summary><form onSubmit={e => { e.preventDefault(); run("credentials", async () => { await saveSender("post", `/meta/senders/${sender.id}/credentials`, { ...credentials, revision: sender.revision }); if (alive.current) setCredentials({}); }, "Credentials verified and updated."); }}><fieldset disabled={Boolean(busy) || sender.status === "disconnected"}><legend className="ac-sr">Replace credentials</legend><Credentials value={credentials} onChange={setCredentials} rotation /><button type="submit">Verify and update credentials</button></fieldset></form></details>}
        <section className="ac-detail-section"><h3>Recent changes</h3>{!detailLoading && !events.length && <p>No recorded changes yet.</p>}<ol className="ac-events">{events.map(event => <li key={event.id}><span>{event.action.replace(/_/g, " ")} · user {event.actor_id} · revision {event.revision}</span><time>{when(event.created_at)}</time></li>)}</ol></section>
        {admin && sender.status !== "disconnected" && <section className="ac-detail-section"><h3>Disconnect number</h3><p>Disconnecting pauses its scheduled automations and removes branch routing. Conversation history stays available.</p>{confirm ? <div className="ac-actions"><button className="ac-danger" disabled={Boolean(busy)} onClick={() => run("disconnect", async () => { await request("delete", `/meta/senders/${sender.id}`); await refresh(); }, "Number disconnected. Linked scheduled automations were paused.")}>Confirm disconnect</button><button disabled={Boolean(busy)} onClick={() => setConfirm(false)}>Keep connected</button></div> : <button className="ac-danger" disabled={Boolean(busy)} onClick={() => setConfirm(true)}>Disconnect number</button>}</section>}
      </>}</section></div>
    </>}
  </main>;
}
