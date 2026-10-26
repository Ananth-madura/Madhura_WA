import { useCallback, useEffect, useRef, useState } from "react";
import api from "../config/axios";
import socket from "../socket/socket";
import { readLocalMessages, writeLocalMessages, mergeLocalMessages, localMediaUrl, clearLocalCache, localCacheOwner } from "../utils/waLocalCache";
import { useEnterprise } from "../context/EnterpriseContext";
import SharedAssistantSettings from "./SharedAssistantSettings";
import SharedFlowControls from "./SharedFlowControls";
import { createInboxRefreshScheduler } from "../utils/inboxRefreshScheduler";
import { cachedRecords, requireRecords } from "../utils/apiPayload";
import { Link } from "react-router-dom";
import InboxComposeExtras from "./InboxComposeExtras";
import "../pages/customer-operations.css";
import { requestKey as newRequestKey } from "../utils/requestKey";
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Download,
  Inbox,
  Phone,
  RefreshCw,
  Search,
  Send,
  UserPlus,
  PanelRight,
} from "lucide-react";

const root = "/api/v2/inbox";
const errorText = error => error.response?.data?.message || error.friendlyMessage || (!error.response?"The backend is unavailable. Connect the API service and try again.":"The inbox could not complete this action.");

/* MySQL DATETIME columns arrive as "2026-10-26 09:30:00"; socket payloads may
   already be ISO strings or unix seconds. Normalise without inventing a date. */
const asDate = value => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return new Date(value > 1e12 ? value : value * 1000);
  const text = String(value);
  const date = new Date(text.includes("T") ? text : text.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
};
const sameDay = (a, b) => a && b && a.toDateString() === b.toDateString();
const timeLabel = value => {
  const date = asDate(value);
  if (!date) return "";
  const now = new Date();
  if (sameDay(date, now)) return date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (sameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};
const dateTimeLabel = value => {
  const date = asDate(value);
  return date ? date.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "";
};
const initials = value => {
  const words = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2);
  return `${words[0][0]}${words[words.length - 1][0]}`;
};
const modeLabel = mode => (mode === "assistant" ? "Assistant" : mode === "flow" ? "Bot flow" : "Agent");

export default function SharedTeamInbox({ branchId }) {
  const { activeTenant } = useEnterprise();
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [notes, setNotes] = useState([]);
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [showRecord, setShowRecord] = useState(false);
  const messagePane = useRef(null);
  const followMessages = useRef(true);
  const searchInput = useRef(null);
  const [canManage, setCanManage] = useState(false);
  const [canSend,setCanSend]=useState(false);
  const [employees, setEmployees] = useState([]);
  const [assignee, setAssignee] = useState("");
  const [filter, setFilter] = useState("open");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(null);
  const [contact, setContact] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [aiQuestion,setAiQuestion]=useState("");
  const active = useRef(null);
  const context = useRef(0);
  const refreshScheduler = useRef(null);
  const knownConversations = useRef(new Map());
  const cacheKey = row => `shared:${row.sender_id}:${row.id}`;
  useEffect(()=>{knownConversations.current=new Map(conversations.map(row=>[Number(row.id),row]));},[conversations]);

  const refresh = useCallback(async () => {
    const version = context.current;
    try {
      const { data } = await api.get(`${root}/conversations`, { params: { branch_id: branchId || "all", status: filter, search: query, sort:"activity" } });
      if (version !== context.current) return;
      requireRecords(data?.conversations);
      setConversations(data.conversations); setCursor(data.nextCursor); setCanManage(data.canManage); setError("");
      setCanSend(data.canSend!==false);
      if (active.current && !data.conversations.some(row => row.id === active.current.id)) {
        const selectedId=active.current.id;
        try {
          const result=await api.get(`${root}/conversations/${selectedId}`);
          if(version===context.current&&active.current?.id===selectedId){active.current={...active.current,...result.data.conversation};setSelected(active.current);}
        } catch(error) {
          if(version===context.current&&active.current?.id===selectedId&&[401,403,404].includes(error.response?.status)){
            setSelected(null);active.current=null;setMessages([]);setNotes([]);setContact(null);setAssignments([]);clearLocalCache().catch(()=>{});
          }
        }
      }
      else if(active.current){const current=data.conversations.find(row=>row.id===active.current.id);if(current){active.current=current;setSelected(current);}}
    } catch (err) {
      if (version !== context.current) return;
      setError(errorText(err));
      if ([401,403].includes(err.response?.status)) { active.current=null;setSelected(null);setConversations([]);setMessages([]);setNotes([]);setContact(null);setAssignments([]);clearLocalCache().catch(()=>{}); }
    }
    finally { if (version === context.current) setLoading(false); }
  }, [branchId, filter, query]);
  useEffect(() => { const timer=setTimeout(()=>setQuery(search),300);return()=>clearTimeout(timer); },[search]);
  useEffect(() => {
    const version = ++context.current; setLoading(true); setCanSend(false); setShowRecord(false); setSelected(null); active.current = null; setMessages([]); setNotes([]); setConversations([]); setContact(null); setAssignments([]);
    const scheduler=createInboxRefreshScheduler({run:refresh,visible:()=>!document.hidden,connected:()=>socket.connected});
    refreshScheduler.current=scheduler;scheduler.request(true);
    const wake=()=>{if(!document.hidden)scheduler.request(true);};
    document.addEventListener("visibilitychange",wake);
    return () => { scheduler.stop();document.removeEventListener("visibilitychange",wake);context.current = version + 1; };
  }, [refresh, activeTenant?.id]);
  useEffect(() => {
    if (!canManage) return;
    api.get(`${root}/routing/employees`).then(({ data }) => setEmployees(requireRecords(data?.employees))).catch(() => setEmployees([]));
  }, [canManage, activeTenant?.id]);
  const load = useCallback(async row => {
    const version = context.current;
    setThreadLoading(true);
    try {
      const [{ data }, noteResult, cached, contactResult, assignmentResult] = await Promise.all([
        api.get(`${root}/conversations/${row.id}/messages`),
        api.get(`${root}/conversations/${row.id}/notes`),
        readLocalMessages(cacheKey(row)),
        api.get(`${root}/conversations/${row.id}/contact`),
        // Ownership history is part of the shared record, not a management
        // control — every permitted reader can see how the chat moved. It is
        // supplementary: a deployment without the endpoint (or a body without
        // records) degrades to an empty history instead of failing the thread.
        api.get(`${root}/conversations/${row.id}/assignments`)
          .then(({ data }) => cachedRecords(data?.records))
          .catch(() => []),
      ]);
      if (version !== context.current || active.current?.id !== row.id) return;
      const incoming=requireRecords(data?.messages),sharedNotes=requireRecords(noteResult.data?.notes);
      setMessages(mergeLocalMessages(cached || [], incoming)); setNotes(sharedNotes); setError("");
      setContact(contactResult.data.contact);
      setAssignments(assignmentResult);
      setAiQuestion((cached||[]).find(message=>!message.isMe&&message.body)?.body||"");
      api.post(`${root}/conversations/${row.id}/read`).catch(() => {});
    } catch (err) { if (version === context.current && active.current?.id === row.id) { setError(errorText(err)); setMessages([]); setNotes([]); } }
    finally { if (version === context.current && active.current?.id === row.id) setThreadLoading(false); }
  }, []);
  useEffect(() => {
    const pane = messagePane.current;
    if (pane && followMessages.current) pane.scrollTop = pane.scrollHeight;
  }, [messages]);
  useEffect(() => {
    const receive = event => {
      if (Number(event.tenantId) !== Number(localStorage.getItem("active_tenant_id"))) return;
      const known=knownConversations.current.get(Number(event.conversationId)),summary=event.conversation;
      const metadataChanged=known&&summary&&["owner_user_id","branch_id","status","automation_mode","automation_error"].some(field=>known[field]!==summary[field]);
      if(known&&summary&&(metadataChanged||event.message?.body))setConversations(previous=>previous.map(row=>row.id===event.conversationId?{...row,...summary}:row).sort((a,b)=>(new Date(b.updated_at||0)-new Date(a.updated_at||0))||b.id-a.id));
      const matchesView=!summary||filter==="all"||summary.status===filter;
      if(!event.message||(!known&&matchesView)||(known&&summary&&(known.status!==summary.status||known.branch_id!==summary.branch_id)))refreshScheduler.current?.request();
      if (event.message) writeLocalMessages(`shared:${event.senderId}:${event.conversationId}`, [event.message]).catch(() => setError("Device cache is full or unavailable."));
      if (event.conversationId !== active.current?.id) return;
      if(summary){active.current={...active.current,...summary};setSelected(active.current);}
      if (event.message) {
        setMessages(previous => mergeLocalMessages(previous, [event.message]));
      } else load(active.current);
    };
    const revoke = event => {
      if (Number(event.tenantId) !== Number(localStorage.getItem("active_tenant_id"))) return;
      clearLocalCache().catch(() => {});
      if (event.conversationId === active.current?.id) { setSelected(null); active.current = null; setMessages([]); setNotes([]); }
      refreshScheduler.current?.request(true);
    };
    const reconnect=()=>refreshScheduler.current?.request(true);
    socket.on("inbox_message", receive); socket.on("inbox_changed", receive); socket.on("inbox_access_changed", revoke); socket.on("connect", reconnect);
    return () => { socket.off("inbox_message", receive); socket.off("inbox_changed", receive); socket.off("inbox_access_changed", revoke); socket.off("connect", reconnect); };
  }, [refresh, load, filter]);
  const select = row => { followMessages.current = true; active.current = row; setSelected(row); setShowRecord(false); setMessages([]); setNotes([]); setContact(null); setAssignments([]); setText(""); setNote(""); setAiQuestion(""); setAssignee(""); load(row); };
  const backToList = () => { active.current = null; setSelected(null); setShowRecord(false); requestAnimationFrame(() => searchInput.current?.focus()); };
  const download = async message => {
    try {
      const { data } = await api.get(`${root}/conversations/${selected.id}/media/${message.cloudMediaId}`);
      const url = localMediaUrl(data), link = document.createElement("a");
      link.href = url; link.download = data.filename || "attachment"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) { setError(errorText(err)); }
  };
  const send = async event => {
    event.preventDefault(); if (!text.trim() || !selected || busy || !canSend || threadLoading) return;
    const row = selected; setBusy(true); setError("");
    let requestKey;
    try {
      const fingerprint = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text.trim())))].map(value => value.toString(16).padStart(2,"0")).join("");
      requestKey = `inbox-send:${localCacheOwner()}:${row.id}:${fingerprint}`;
      const requestId = sessionStorage.getItem(requestKey) || newRequestKey("reply");
      sessionStorage.setItem(requestKey, requestId);
      const { data } = await api.post(`${root}/conversations/${row.id}/reply`, { text, requestId },{timeout:60000});
      const message = data.message || { id:data.providerId,body:text,isMe:true,status:"sent",timestamp:Math.floor(Date.now()/1000) };
      sessionStorage.removeItem(requestKey);
      if (active.current?.id === row.id) { setMessages(previous => mergeLocalMessages(previous, [message])); setText(""); }
      await writeLocalMessages(cacheKey(row), [message]).catch(() => {});
    } catch (err) {
      const status=err.response?.status;
      if (requestKey && status && status !== 409 && status !== 504 && status < 504) sessionStorage.removeItem(requestKey);
      setError(errorText(err));
    }
    finally { setBusy(false); }
  };
  const saveNote = async event => {
    event.preventDefault(); if (!selected || !note.trim()) return;
    setBusy(true);
    try { await api.post(`${root}/conversations/${selected.id}/notes`, { text: note }); setNote(""); await load(selected); }
    catch (err) { setError(errorText(err)); } finally { setBusy(false); }
  };
  const assign = async () => {
    const employee = employees.find(item => `${item.user_id}:${item.branch_id}` === assignee);
    if (!employee || !selected) return;
    if (!window.confirm(`Reassign this conversation from ${selected.owner_user_id || "unassigned"} to ${employee.first_name}? The previous employee will lose chat access. Customer work is transferred separately from My workspace.`)) return;
    try { await api.post(`${root}/conversations/${selected.id}/assign`, { userId: employee.user_id, branchId: employee.branch_id }); await refresh(); }
    catch (err) { setError(errorText(err)); }
  };
  const close = async () => {
    try { await api.patch(`${root}/conversations/${selected.id}/status`, { status: selected.status === "closed" ? "open" : "closed" }); setSelected(null); active.current = null; await refresh(); }
    catch (err) { setError(errorText(err)); }
  };
  const assistantMode=async mode=>{
    try{await api.post(`${root}/conversations/${selected.id}/assistant`,{mode});await refresh();}
    catch(error){setError(errorText(error));}
  };
  const draft=async()=>{
    if(!selected||!aiQuestion.trim())return;
    setBusy(true);
    try{const {data}=await api.post(`${root}/conversations/${selected.id}/ai-draft`,{text:aiQuestion});setText(data.text);setError("");}
    catch(error){setError(errorText(error));}finally{setBusy(false);}
  };
  const loadMore = async () => {
    if (!cursor) return;
    setBusy(true);
    try {
      const { data } = await api.get(`${root}/conversations`, { params: { before: cursor, status: filter, search: query, sort: "activity", branch_id: branchId || "all" } });
      const incoming = requireRecords(data?.conversations);
      setConversations(previous => [...new Map([...previous, ...incoming].map(row => [row.id, row])).values()]);
      setCursor(data.nextCursor);
    } catch (err) { setError(errorText(err)); } finally { setBusy(false); }
  };
  const rebalance = async () => {
    try { await api.post(`${root}/routing/rebalance`); await refresh(); }
    catch (err) { setError(errorText(err)); }
  };

  const counts = {
    open: conversations.filter(row => row.status === "open").length,
    unassigned: conversations.filter(row => !row.owner_user_id).length,
    bot: conversations.filter(row => row.automation_mode && row.automation_mode !== "human").length,
  };
  const windowState = selected?.service_window_expires_at
    ? (asDate(selected.service_window_expires_at) > new Date() ? "open" : "closed")
    : null;

  return <section className="emp-surface emp-page crm-ops crm-inbox-page" aria-label="Shared team inbox">
    <header className="emp-head">
      <div className="emp-head-copy">
        <h1 className="emp-title">Team inbox</h1>
        <p className="emp-sub">Reply to assigned conversations and keep your team up to date.</p>
      </div>
      <div className="emp-head-actions">
        <button type="button" className="emp-btn" onClick={() => { setLoading(true); refresh(); }} disabled={loading}>
          <RefreshCw size={14} className={loading ? "emp-spin" : ""} aria-hidden="true" /> Refresh
        </button>
      </div>
    </header>

    {error && <div className="emp-banner emp-banner-error" role="alert">
      <AlertCircle size={15} aria-hidden="true" />
      <span>{error}</span>
      <button type="button" className="emp-btn emp-btn-sm emp-btn-ghost" onClick={refresh}>Retry</button>
    </div>}

    <dl className="emp-kpis">
      <div className="emp-kpi"><dt>In view</dt><dd>{conversations.length}</dd><small>Loaded conversations</small></div>
      <div className="emp-kpi"><dt>Open</dt><dd>{counts.open}</dd><small>Status open</small></div>
      <div className="emp-kpi"><dt>Unassigned</dt><dd>{counts.unassigned}</dd><small>No owner yet</small></div>
      <div className="emp-kpi"><dt>Bot managed</dt><dd>{counts.bot}</dd><small>Assistant or flow</small></div>
    </dl>

    <div className={`emp-inbox ${selected ? "crm-has-selection" : ""} ${showRecord ? "crm-show-record" : ""}`}>
      <aside className="emp-pane-list" aria-label="Conversations">
        <div className="emp-list-head">
          <div className="crm-panel-heading"><h2>Conversations</h2><span>{conversations.length} loaded</span></div>
          <div className="emp-search">
            <Search size={14} aria-hidden="true" />
            <input
              ref={searchInput}
              type="text"
              className="emp-field"
              placeholder="Search contacts"
              aria-label="Search contacts"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="emp-segment" role="group" aria-label="Conversation status">
            <button type="button" aria-pressed={filter === "open"} onClick={() => setFilter("open")}>Open</button>
            <button type="button" aria-pressed={filter === "closed"} onClick={() => setFilter("closed")}>Closed</button>
            <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All</button>
          </div>
          {canManage && <button type="button" className="emp-btn emp-btn-sm" onClick={rebalance}>
            <UserPlus size={13} aria-hidden="true" /> Assign waiting chats
          </button>}
        </div>
        <div className="emp-list-scroll">
          {loading && <p className="emp-list-state" role="status">Loading conversations…</p>}
          {!loading && !conversations.length && <p className="emp-list-state">No conversations in this view. Try another status or clear the search.</p>}
          {conversations.map(row => <button
            key={row.id}
            type="button"
            aria-pressed={selected?.id === row.id}
            className="emp-conv"
            onClick={() => select(row)}
          >
            <span className="emp-conv-top">
              <span className="emp-conv-name">{row.contact_name || row.contact_phone}</span>
              <span className="emp-conv-time">{timeLabel(row.last_message_at || row.updated_at)}</span>
            </span>
            <span className="emp-conv-meta">
              <span>{row.contact_phone}</span>
              <span className="emp-dot">·</span>
              <span>{row.owner_user_id ? `Agent ${row.owner_user_id}` : "Unassigned"}</span>
              {row.status === "closed" && <span className="emp-pill emp-pill-off">Closed</span>}
              {row.automation_mode && row.automation_mode !== "human" && <span className="emp-pill emp-pill-bot">{modeLabel(row.automation_mode)}</span>}
            </span>
          </button>)}
          {cursor && <button type="button" className="emp-btn emp-btn-sm emp-loadmore" disabled={busy} onClick={loadMore}>Load more conversations</button>}
        </div>
      </aside>

      <section className="emp-pane-thread" aria-label="Conversation">
        {selected ? <>
          <header className="emp-thread-head">
            <button type="button" className="emp-btn crm-mobile-back" onClick={backToList} aria-label="Back to conversations"><ArrowLeft size={18} aria-hidden="true" /></button>
            <span className="emp-avatar" aria-hidden="true">{initials(selected.contact_name || selected.contact_phone)}</span>
            <div className="emp-thread-title">
              <strong>{selected.contact_name || selected.contact_phone}</strong>
              <span>{selected.contact_phone} · via {selected.sender_phone} · {selected.owner_user_id ? `Owner agent ${selected.owner_user_id}` : "Unassigned"}</span>
            </div>
            <div className="emp-thread-actions">
              <button type="button" className="emp-btn emp-btn-sm crm-record-toggle" aria-expanded={showRecord} aria-controls="inbox-customer-record" onClick={() => setShowRecord(value => !value)}><PanelRight size={15} aria-hidden="true" /> Customer details</button>
              {windowState && <span className={`emp-pill ${windowState === "open" ? "emp-pill-ok" : "emp-pill-warm"}`} title="WhatsApp customer service window">
                {windowState === "open" ? "Window open" : "Template may be required"}
              </span>}
              <span className="emp-pill">{modeLabel(selected.automation_mode)}</span>
              {selected.automation_mode !== "human" && <button type="button" className="emp-btn emp-btn-sm" onClick={() => assistantMode("human")}>Take over from bot</button>}
              {canManage && selected.automation_mode === "human" && <button type="button" className="emp-btn emp-btn-sm" onClick={() => assistantMode("assistant")}>Resume assistant</button>}
              <button type="button" className="emp-btn emp-btn-sm" onClick={close}>{selected.status === "closed" ? "Reopen conversation" : "Close conversation"}</button>
            </div>
          </header>
          {selected.automation_error && <div className="emp-banner emp-banner-info emp-thread-alert" role="status">
            <Bot size={14} aria-hidden="true" /> <span>Bot paused: {selected.automation_error}</span>
          </div>}
          <div className="emp-messages" ref={messagePane} aria-busy={threadLoading} onScroll={event => { const pane = event.currentTarget; followMessages.current = pane.scrollHeight - pane.scrollTop - pane.clientHeight < 100; }}>
            {threadLoading && <p className="emp-list-state" role="status">Loading conversation…</p>}
            {!threadLoading && !messages.length && <p className="emp-list-state">No retained messages on this device yet.</p>}
            {[...messages].reverse().map(message => <article className={`emp-msg ${message.isMe ? "emp-msg-out" : "emp-msg-in"}`} key={message.id}>
              <p>{message.body || "Message content unavailable on this device"}</p>
              <span className="emp-msg-meta">
                {message.sentBy === "assistant" ? "Assistant" : message.isMe ? "Team" : "Customer"}
                {message.status ? ` · ${message.status}` : ""}
                {timeLabel(message.created_at || message.timestamp) ? ` · ${timeLabel(message.created_at || message.timestamp)}` : ""}
              </span>
              {message.cloudMediaId && <button type="button" className="emp-btn emp-btn-sm" onClick={() => download(message)}>
                <Download size={12} aria-hidden="true" /> Download attachment
              </button>}
            </article>)}
          </div>
          <div className="emp-composer">
            <form onSubmit={send} className="emp-compose-row">
              <label className="emp-label emp-grow">Reply
                <textarea className="emp-field" disabled={!canSend || threadLoading} maxLength={4096} value={text} onChange={e => setText(e.target.value)} placeholder={canSend ? "Write a reply to the customer" : "Read-only conversation access"} />
              </label>
              <button type="submit" className="emp-btn emp-btn-primary" disabled={busy || !text.trim() || !canSend || threadLoading}>
                <Send size={13} aria-hidden="true" /> Send reply
              </button>
            </form>
            {canSend ? <InboxComposeExtras conversationId={selected.id} onSent={async message=>{if(active.current?.id!==selected.id)return;setMessages(previous=>mergeLocalMessages(previous,[message]));await writeLocalMessages(cacheKey(selected),[message]).catch(()=>{});if(active.current?.id===selected.id)await refresh();}}/> : <p className="emp-hint">This account has read-only conversation access.</p>}
            <details className="emp-details">
              <summary>Ask for a reply draft</summary>
              <div className="emp-details-body">
                <label className="emp-label">Customer’s current message
                  <textarea className="emp-field" maxLength={4000} value={aiQuestion} onChange={event=>setAiQuestion(event.target.value)} />
                </label>
                <div className="emp-form-actions">
                  <button type="button" className="emp-btn emp-btn-sm" disabled={busy||!aiQuestion.trim()} onClick={draft}>Generate draft for review</button>
                  <span className="emp-hint">A draft fills the reply box. Review it before sending.</span>
                </div>
              </div>
            </details>
          </div>
        </> : <div className="emp-thread-empty">
          <Inbox size={32} aria-hidden="true" />
          <h2>Your next conversation starts here</h2>
          <span>Select a conversation to read messages, reply, and add shared notes.</span>
          <p className="emp-hint">You see conversations allowed by your assignment and role.</p>
        </div>}
      </section>

      <aside id="inbox-customer-record" className="emp-pane-meta" aria-label="Customer record">
        {selected ? <>
          <button type="button" className="emp-btn crm-record-toggle crm-record-back" onClick={() => setShowRecord(false)}><ArrowLeft size={16} aria-hidden="true" /> Back to conversation</button>
          <p className="emp-meta-head">Customer record</p>
          <div className="emp-meta-body">
            <section className="emp-meta-section">
              <h4>Profile</h4>
              {contact ? <form className="emp-form" onSubmit={async event => { event.preventDefault(); try { await api.patch(`${root}/conversations/${selected.id}/contact`, { name: contact.name, email: contact.email }); await refresh(); } catch (err) { setError(errorText(err)); } }}>
                <label className="emp-label">Customer name
                  <input className="emp-field" value={contact.name || ""} onChange={e => setContact(previous => ({ ...previous, name: e.target.value }))} />
                </label>
                <label className="emp-label">Email
                  <input className="emp-field" type="email" value={contact.email || ""} onChange={e => setContact(previous => ({ ...previous, email: e.target.value }))} />
                </label>
                <div className="emp-form-actions">
                  <button type="submit" className="emp-btn emp-btn-sm">Save customer details</button>
                </div>
              </form> : <p className="emp-hint">{threadLoading ? "Loading customer…" : "Customer details are unavailable. Try refreshing the inbox."}</p>}
              <Link className="emp-link" to={`/whatsapp/workspace?customer=${selected.contact_id}`}>
                Open customer, leads, deals and follow-ups <ArrowUpRight size={12} aria-hidden="true" />
              </Link>
              <p className="emp-hint"><Phone size={11} aria-hidden="true" /> {selected.contact_phone}</p>
            </section>

            <section className="emp-meta-section">
              <h4>Replies</h4>
              <SharedFlowControls key={`${activeTenant?.id}:${selected.id}`} conversationId={selected.id} onStarted={refresh}/>
              <p className="emp-hint">Bot replies pause when an employee takes over. Resume the assistant from the conversation header.</p>
            </section>

            {canManage && <section className="emp-meta-section">
              <h4>Assignment</h4>
              <label className="emp-label">Assign or transfer
                <select className="emp-field" value={assignee} onChange={e => setAssignee(e.target.value)}>
                  <option value="">Choose employee and branch</option>
                  {employees.map(item => <option key={`${item.user_id}:${item.branch_id}`} value={`${item.user_id}:${item.branch_id}`}>{item.first_name} · {item.branch_name}</option>)}
                </select>
              </label>
              <div className="emp-form-actions">
                <button type="button" className="emp-btn emp-btn-sm" onClick={assign} disabled={!assignee}>Save assignment</button>
              </div>
              <p className="emp-hint">The previous employee loses chat access. Customer work moves separately from My workspace.</p>
            </section>}

            {canManage && <section className="emp-meta-section">
              <h4>Business assistant</h4>
              <SharedAssistantSettings/>
            </section>}

            <section className="emp-meta-section">
              <h4>Assignment history</h4>
              {!assignments.length && <p className="emp-hint">No ownership changes recorded for this conversation yet.</p>}
              {assignments.map(item => <p className="emp-note" key={item.id}>
                <strong>{item.owner_user_id ? `Agent ${item.owner_user_id}` : "Unassigned"}</strong>
                {` · branch ${item.branch_id || "none"} · by agent ${item.actor_id}`}
                {dateTimeLabel(item.created_at) ? ` · ${dateTimeLabel(item.created_at)}` : ""}
              </p>)}
            </section>

            <section className="emp-meta-section">
              <h4>Internal notes</h4>
              {!notes.length && <p className="emp-hint">No shared notes yet. Notes are visible to the whole authorized team.</p>}
              {notes.map(item => <p className="emp-note" key={item.id}><strong>{item.author_name}: </strong>{item.note_text}</p>)}
              <form className="emp-form" onSubmit={saveNote}>
                <label className="emp-label">New internal note
                  <textarea className="emp-field" value={note} maxLength={10000} onChange={e => setNote(e.target.value)} />
                </label>
                <div className="emp-form-actions">
                  <button type="submit" className="emp-btn emp-btn-sm" disabled={busy || !note.trim()}>
                    <CheckCircle2 size={12} aria-hidden="true" /> Save note
                  </button>
                </div>
              </form>
            </section>
          </div>
        </> : <div className="emp-list-state">Select a conversation to see the customer record and shared notes.</div>}
      </aside>
    </div>
  </section>;
}
