import { useCallback, useEffect, useRef, useState } from "react";
import api from "../config/axios";
import socket from "../socket/socket";
import { readLocalMessages, writeLocalMessages, mergeLocalMessages, localMediaUrl, clearLocalCache, localCacheOwner } from "../utils/waLocalCache";
import { useEnterprise } from "../context/EnterpriseContext";
import SharedAssistantSettings from "./SharedAssistantSettings";
import SharedFlowControls from "./SharedFlowControls";
import { createInboxRefreshScheduler } from "../utils/inboxRefreshScheduler";

const root = "/api/v2/inbox";
const errorText = error => error.response?.data?.message || "The inbox could not complete this action.";

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
  const [canManage, setCanManage] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [assignee, setAssignee] = useState("");
  const [filter, setFilter] = useState("open");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(null);
  const [contact, setContact] = useState(null);
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
      setConversations(data.conversations); setCursor(data.nextCursor); setCanManage(data.canManage); setError("");
      if (active.current && !data.conversations.some(row => row.id === active.current.id)) {
        const selectedId=active.current.id;
        try {
          const result=await api.get(`${root}/conversations/${selectedId}`);
          if(version===context.current&&active.current?.id===selectedId){active.current={...active.current,...result.data.conversation};setSelected(active.current);}
        } catch(error) {
          if(version===context.current&&active.current?.id===selectedId&&[401,403,404].includes(error.response?.status)){
            setSelected(null);active.current=null;setMessages([]);setNotes([]);setContact(null);clearLocalCache().catch(()=>{});
          }
        }
      }
      else if(active.current){const current=data.conversations.find(row=>row.id===active.current.id);if(current){active.current=current;setSelected(current);}}
    } catch (err) {
      setError(errorText(err));
      if ([401,403].includes(err.response?.status)) { active.current=null;setSelected(null);setConversations([]);setMessages([]);setNotes([]);setContact(null);clearLocalCache().catch(()=>{}); }
    }
    finally { setLoading(false); }
  }, [branchId, filter, query]);
  useEffect(() => { const timer=setTimeout(()=>setQuery(search),300);return()=>clearTimeout(timer); },[search]);
  useEffect(() => {
    const version = ++context.current; setSelected(null); active.current = null; setMessages([]); setNotes([]); setConversations([]);
    const scheduler=createInboxRefreshScheduler({run:refresh,visible:()=>!document.hidden,connected:()=>socket.connected});
    refreshScheduler.current=scheduler;scheduler.request(true);
    const wake=()=>{if(!document.hidden)scheduler.request(true);};
    document.addEventListener("visibilitychange",wake);
    return () => { scheduler.stop();document.removeEventListener("visibilitychange",wake);context.current = version + 1; };
  }, [refresh, activeTenant?.id]);
  useEffect(() => {
    if (!canManage) return;
    api.get(`${root}/routing/employees`).then(({ data }) => setEmployees(data.employees)).catch(() => setEmployees([]));
  }, [canManage, activeTenant?.id]);
  const load = useCallback(async row => {
    const version = context.current;
    try {
      const [{ data }, noteResult, cached, contactResult] = await Promise.all([api.get(`${root}/conversations/${row.id}/messages`), api.get(`${root}/conversations/${row.id}/notes`), readLocalMessages(cacheKey(row)), api.get(`${root}/conversations/${row.id}/contact`)]);
      if (version !== context.current || active.current?.id !== row.id) return;
      setMessages(mergeLocalMessages(cached || [], data.messages)); setNotes(noteResult.data.notes); setError("");
      setContact(contactResult.data.contact);
      setAiQuestion((cached||[]).find(message=>!message.isMe&&message.body)?.body||"");
      api.post(`${root}/conversations/${row.id}/read`).catch(() => {});
    } catch (err) { if (active.current?.id === row.id) { setError(errorText(err)); setMessages([]); setNotes([]); } }
  }, []);
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
  const select = row => { active.current = row; setSelected(row); setMessages([]); setNotes([]); setContact(null); setText(""); load(row); };
  const download = async message => {
    try {
      const { data } = await api.get(`${root}/conversations/${selected.id}/media/${message.cloudMediaId}`);
      const url = localMediaUrl(data), link = document.createElement("a");
      link.href = url; link.download = data.filename || "attachment"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) { setError(errorText(err)); }
  };
  const send = async event => {
    event.preventDefault(); if (!text.trim() || !selected || busy) return;
    const row = selected; setBusy(true); setError("");
    let requestKey;
    try {
      const fingerprint = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text.trim())))].map(value => value.toString(16).padStart(2,"0")).join("");
      requestKey = `inbox-send:${localCacheOwner()}:${row.id}:${fingerprint}`;
      const requestId = sessionStorage.getItem(requestKey) || crypto.randomUUID();
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
  return <section className="p-4 space-y-4 overflow-y-auto">
    <h1 className="text-xl font-semibold">Shared team inbox</h1>
    <p>One business number can serve your team. You see conversations permitted by your assignment and role.</p>
    <p className="text-sm">Chat text is cached on this device. Earlier or transferred messages may be unavailable. Customer details, assignments and internal notes are shared.</p>
    {error && <p role="alert" className="text-red-600">{error}</p>}
    {canManage&&<SharedAssistantSettings/>}
    <div className="flex flex-wrap gap-3">
      <label>Search contacts <input className="border rounded p-2 text-black" value={search} onChange={e => setSearch(e.target.value)} /></label>
      <label>Status <select className="border rounded p-2 text-black" value={filter} onChange={e => setFilter(e.target.value)}><option value="open">Open</option><option value="closed">Closed</option><option value="all">All</option></select></label>
      <button className="border rounded p-2" onClick={refresh}>Refresh inbox</button>
      {canManage && <button className="border rounded p-2" onClick={async () => { try { await api.post(`${root}/routing/rebalance`); await refresh(); } catch (err) { setError(errorText(err)); } }}>Assign waiting chats</button>}
    </div>
    <div className="grid md:grid-cols-[280px_1fr] gap-4">
      <aside className="space-y-2" aria-label="Conversations">
        {loading ? <p>Loading conversations…</p> : !conversations.length && <p>No conversations in this view.</p>}
        {conversations.map(row => <button key={row.id} aria-pressed={selected?.id === row.id} className={`w-full text-left border rounded p-3 ${selected?.id === row.id ? "border-emerald-600" : ""}`} onClick={() => select(row)}><strong>{row.contact_name || row.contact_phone}</strong><br />{row.contact_phone}<br /><small>{row.sender_phone} · {row.owner_user_id ? `Agent ${row.owner_user_id}` : "Unassigned"}</small></button>)}
        {cursor && <button className="border rounded p-2" onClick={async () => { try { const { data } = await api.get(`${root}/conversations`, { params: { before: cursor, status: filter, search: query, sort:"activity", branch_id: branchId || "all" } }); setConversations(previous => [...new Map([...previous, ...data.conversations].map(row=>[row.id,row])).values()]); setCursor(data.nextCursor); } catch (err) { setError(errorText(err)); } }}>Load more conversations</button>}
      </aside>
      {selected ? <div className="space-y-4 min-w-0">
        <h2 className="font-semibold">{selected.contact_name} · {selected.contact_phone}</h2>
        <div className="flex flex-wrap gap-2 items-center"><span>Replies: {selected.automation_mode==="assistant"?"Assistant":selected.automation_mode==="flow"?"Flow bot":"Employee"}</span><button className="border rounded p-2" onClick={()=>assistantMode("human")}>Take over from bot</button>{canManage&&<button className="border rounded p-2" onClick={()=>assistantMode("assistant")}>Resume assistant</button>}{selected.automation_error&&<span role="status">Bot paused: {selected.automation_error}</span>}</div>
        <SharedFlowControls key={`${activeTenant?.id}:${selected.id}`} conversationId={selected.id} onStarted={refresh}/>
        {contact && <form className="flex flex-wrap gap-2" onSubmit={async event => { event.preventDefault(); try { await api.patch(`${root}/conversations/${selected.id}/contact`, { name: contact.name, email: contact.email }); await refresh(); } catch (err) { setError(errorText(err)); } }}><label>Customer name <input className="border rounded p-2 text-black" value={contact.name || ""} onChange={e => setContact(previous => ({ ...previous, name: e.target.value }))} /></label><label>Email <input className="border rounded p-2 text-black" type="email" value={contact.email || ""} onChange={e => setContact(previous => ({ ...previous, email: e.target.value }))} /></label><button className="border rounded p-2">Save customer details</button></form>}
        <button className="border rounded p-2" onClick={close}>{selected.status === "closed" ? "Reopen conversation" : "Close conversation"}</button>
        {canManage && <div className="flex flex-wrap gap-2"><label>Assign or transfer <select className="border rounded p-2 text-black" value={assignee} onChange={e => setAssignee(e.target.value)}><option value="">Choose employee and branch</option>{employees.map(item => <option key={`${item.user_id}:${item.branch_id}`} value={`${item.user_id}:${item.branch_id}`}>{item.first_name} · {item.branch_name}</option>)}</select></label><button className="border rounded p-2" onClick={assign} disabled={!assignee}>Save assignment</button></div>}
        <ol className="space-y-2 max-h-96 overflow-y-auto" aria-label="Messages">{[...messages].reverse().map(message => <li className="border rounded p-3 break-words" key={message.id}><small>{message.sentBy==="assistant"?"Assistant":message.isMe ? "Team" : "Customer"} · {message.status}</small><p>{message.body || "Message content unavailable on this device"}</p>{message.cloudMediaId && <button className="border rounded p-2" onClick={() => download(message)}>Download attachment</button>}</li>)}</ol>
        {!messages.length && <p>No retained messages on this device yet.</p>}
        <form onSubmit={send} className="flex gap-2"><label className="flex-1">Reply<textarea className="w-full border rounded p-2 text-black" maxLength={4096} value={text} onChange={e => setText(e.target.value)} /></label><button className="border rounded p-2" disabled={busy || !text.trim()}>Send reply</button></form>
        <details className="border rounded p-3"><summary className="cursor-pointer">Ask for a reply draft</summary><label className="block">Customer’s current message<textarea className="block w-full border rounded p-2 text-black" maxLength={4000} value={aiQuestion} onChange={event=>setAiQuestion(event.target.value)}/></label><button className="border rounded p-2" disabled={busy||!aiQuestion.trim()} onClick={draft}>Generate draft for review</button><p className="text-sm">A draft fills the reply box. Review it before sending.</p></details>
        <h2 className="font-semibold">Internal notes</h2>
        {notes.map(item => <p className="border rounded p-2" key={item.id}><strong>{item.author_name}: </strong>{item.note_text}</p>)}
        <form onSubmit={saveNote}><label>New internal note<textarea className="w-full border rounded p-2 text-black" value={note} maxLength={10000} onChange={e => setNote(e.target.value)} /></label><button className="border rounded p-2" disabled={busy || !note.trim()}>Save note</button></form>
      </div> : <p>Select a conversation to view messages and shared notes.</p>}
    </div>
  </section>;
}
