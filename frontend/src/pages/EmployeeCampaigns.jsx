import {useCallback,useEffect,useRef,useState} from "react";
import api from "../config/axios";
import {useEnterprise} from "../context/EnterpriseContext";
import socket from "../socket/socket";
import {requestKey as newRequestKey} from "../utils/requestKey";
import {AlertCircle,CheckCircle2,Megaphone,RefreshCw,Send} from "lucide-react";
const root="/api/v2/workspace/campaigns",field="emp-field";
const errorMessage=error=>error.response?.data?.message||"Campaign service unavailable. Try again.";
const statusClass=status=>status==="running"?"emp-pill emp-pill-ok":status==="paused"?"emp-pill emp-pill-warm":status==="draft"?"emp-pill":"emp-pill emp-pill-off";
const ACTION_LABELS={start:"Start",pause:"Pause",resume:"Resume",cancel:"Cancel"};
export default function EmployeeCampaigns(){
  const {activeTenant}=useEnterprise();
  const [campaigns,setCampaigns]=useState([]),[audience,setAudience]=useState([]),[senders,setSenders]=useState([]),[templates,setTemplates]=useState([]);
  const [campaignCursor,setCampaignCursor]=useState(null),[audienceCursor,setAudienceCursor]=useState(null),[detail,setDetail]=useState(null);
  const [name,setName]=useState(""),[senderId,setSenderId]=useState(""),[templateId,setTemplateId]=useState(""),[parameters,setParameters]=useState([]),[selected,setSelected]=useState([]);
  const [error,setError]=useState(""),[saved,setSaved]=useState(""),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[canEdit,setCanEdit]=useState(false);
  const version=useRef(0),requestKey=useRef(null);
  const load=useCallback(async()=>{
    const current=version.current;setError("");setLoading(true);
    try{const [list,contacts,numbers]=await Promise.all([api.get(root),api.get(`${root}/recipients`),api.get(`${root}/senders`)]);
      if(current!==version.current)return;
      setCampaigns(list.data.records);setCampaignCursor(list.data.nextCursor);setCanEdit(list.data.canEdit);setAudience(contacts.data.records);setAudienceCursor(contacts.data.nextCursor);setSenders(numbers.data.senders);
    }catch(err){if(current===version.current){setError(errorMessage(err));setCampaigns([]);setAudience([]);setDetail(null);setCanEdit(false);}}
    finally{if(current===version.current)setLoading(false);}
  },[]);
  useEffect(()=>{
    version.current++;setCampaigns([]);setAudience([]);setSelected([]);setDetail(null);setName("");setSenderId("");setTemplateId("");setTemplates([]);setBusy(false);setSaved("");requestKey.current=null;load();
    const changed=event=>{if(Number(event.tenantId)!==Number(activeTenant?.id))return;version.current++;setBusy(false);setSelected([]);setAudience([]);setDetail(null);requestKey.current=null;load();};
    socket.on("customer_access_changed",changed);socket.on("inbox_access_changed",changed);
    const invalidate=()=>{version.current++;};
    return()=>{invalidate();socket.off("customer_access_changed",changed);socket.off("inbox_access_changed",changed);};
  },[activeTenant?.id,load]);
  useEffect(()=>{
    let active=true;setTemplates([]);setTemplateId("");setParameters([]);
    if(senderId)api.get(`${root}/templates`,{params:{senderId}}).then(({data})=>{if(active)setTemplates(data.templates||[]);}).catch(err=>{if(active)setError(errorMessage(err));});
    return()=>{active=false;};
  },[senderId]);
  useEffect(()=>{
    if(!saved)return undefined;
    const timer=setTimeout(()=>setSaved(""),5000);
    return()=>clearTimeout(timer);
  },[saved]);
  const template=templates.find(row=>String(row.id)===templateId);
  const variableCount=Math.min(20,Math.max(0,...[...String(template?.body||"").matchAll(/\{\{(\d+)\}\}/g)].map(match=>Number(match[1]))));
  const open=async id=>{const current=version.current;try{const {data}=await api.get(`${root}/${id}`);if(current===version.current)setDetail(data);}catch(err){if(current===version.current)setError(errorMessage(err));}};
  const create=async event=>{
    event.preventDefault();if(!window.confirm(`Create a draft campaign for ${selected.length} assigned, opted-in customers? No messages are sent until you start it.`))return;
    const current=version.current;setBusy(true);setError("");requestKey.current=requestKey.current||newRequestKey("campaign");
    try{const {data}=await api.post(root,{name,senderId:Number(senderId),templateId:Number(templateId),parameters,contactIds:selected,requestKey:requestKey.current});if(current!==version.current)return;requestKey.current=null;setSaved("Campaign draft saved");setSelected([]);setName("");await load();await open(data.id);}
    catch(err){if(current===version.current)setError(errorMessage(err));}finally{if(current===version.current)setBusy(false);}
  };
  const control=async action=>{
    if(!detail||!window.confirm(`${action} this campaign? ${detail.campaign.total_contacts} recipients remain visible in your current scope. Ownership, consent and permissions are checked again before each send.`))return;
    const current=version.current;setBusy(true);setError("");
    try{await api.post(`${root}/${detail.campaign.id}/${action}`,{confirmCount:detail.campaign.total_contacts});if(current!==version.current)return;setSaved(`Campaign ${action} accepted`);await load();await open(detail.campaign.id);}
    catch(err){if(current===version.current)setError(errorMessage(err));}finally{if(current===version.current)setBusy(false);}
  };
  const more=async(type,cursor)=>{
    const current=version.current;
    try{const {data}=await api.get(type==="campaigns"?root:`${root}/recipients`,{params:{before:cursor}});if(current!==version.current)return;if(type==="campaigns"){setCampaigns(previous=>[...previous,...data.records]);setCampaignCursor(data.nextCursor);}else{setAudience(previous=>[...previous,...data.records]);setAudienceCursor(data.nextCursor);}}
    catch(err){if(current===version.current)setError(errorMessage(err));}
  };
  const actions=detail?(detail.campaign.status==="draft"?["start","cancel"]:detail.campaign.status==="running"?["pause","cancel"]:detail.campaign.status==="paused"?["resume","cancel"]:[]):[];
  return <section className="emp-surface emp-page" aria-label="Assigned customer campaigns">
    <header className="emp-head">
      <div className="emp-head-copy">
        <p className="emp-eyebrow"><Megaphone size={12} aria-hidden="true"/> Campaigns</p>
        <h1 className="emp-title">My campaigns</h1>
        <p className="emp-sub">Campaign permission is granted by your administrator. Only currently authorized, opted-in customers can receive these campaigns. Recipients transferred away disappear from your results and are skipped before delivery.</p>
      </div>
      <div className="emp-head-actions">
        <button type="button" className="emp-btn" onClick={load} disabled={loading}>
          <RefreshCw size={14} className={loading?"emp-spin":""} aria-hidden="true"/> Refresh
        </button>
      </div>
    </header>

    {error&&<div className="emp-banner emp-banner-error" role="alert"><AlertCircle size={15} aria-hidden="true"/><span>{error}</span></div>}
    {saved&&<div className="emp-banner emp-banner-success" role="status"><CheckCircle2 size={15} aria-hidden="true"/><span>{saved}</span></div>}

    <div className="emp-campaigns">
      <div className="emp-card emp-card-flush">
        <div className="emp-card-head">
          <h2 className="emp-card-title">Compose a draft</h2>
          <span className="emp-pill">{selected.length} of 100 selected</span>
        </div>
        <form onSubmit={create} className="emp-card-body emp-form">
          <label className="emp-label">Campaign name
            <input className={field} required maxLength={255} disabled={!canEdit||busy} value={name} onChange={event=>setName(event.target.value)}/>
          </label>
          <div className="emp-form-row">
            <label className="emp-label">Business number
              <select className={field} required disabled={!canEdit||busy} value={senderId} onChange={event=>setSenderId(event.target.value)}>
                <option value="">Select number</option>
                {senders.map(row=><option key={row.id} value={row.id}>{row.display_phone}</option>)}
              </select>
            </label>
            <label className="emp-label">Approved template
              <select className={field} required disabled={!canEdit||busy} value={templateId} onChange={event=>{setTemplateId(event.target.value);setParameters([]);}}>
                <option value="">Select template</option>
                {templates.map(row=><option key={row.id} value={row.id}>{row.name} · {row.language}</option>)}
              </select>
            </label>
          </div>
          {template&&<p className="emp-template-preview">{template.body}</p>}
          {Array.from({length:variableCount},(_,index)=><label key={index} className="emp-label">Body value {index+1}
            <input className={field} required maxLength={1024} disabled={busy} value={parameters[index]||""} onChange={event=>setParameters(previous=>{const next=[...previous];next[index]=event.target.value;return next;})}/>
          </label>)}
          <p className="emp-hint">Body values can include {"{name}"}, {"{phone}"} or {"{email}"} from each authorized customer. Campaigns support static headers and buttons; use the inbox for media templates.</p>
          <fieldset className="emp-audience-field">
            <legend className="emp-label">Select up to 100 assigned customers</legend>
            <div className="emp-audience">
              {!audience.length&&<p className="emp-hint">No authorized, opted-in customers are available for this campaign.</p>}
              {audience.map(row=><label key={row.id}>
                <input type="checkbox" disabled={!canEdit||busy||!row.opt_in_status||(selected.length>=100&&!selected.includes(row.id))} checked={selected.includes(row.id)} onChange={event=>setSelected(previous=>event.target.checked?[...previous,row.id]:previous.filter(id=>id!==row.id))}/>
                <span>{row.name} · {row.phone}</span>
                {!row.opt_in_status&&<small>No opt-in</small>}
              </label>)}
            </div>
            {audienceCursor&&<button type="button" className="emp-btn emp-btn-sm" onClick={()=>more("audience",audienceCursor)}>Load more assigned customers</button>}
          </fieldset>
          <div className="emp-form-actions">
            <button type="submit" className="emp-btn emp-btn-primary" disabled={!canEdit||busy||!selected.length}>
              <Send size={13} aria-hidden="true"/> {busy?"Saving…":"Create draft campaign"}
            </button>
            <button type="button" className="emp-btn" disabled={busy} onClick={()=>{if(!window.confirm("Reset this form for a separate draft? Any draft already saved remains in the campaign list."))return;requestKey.current=null;setName("");setSelected([]);setParameters([]);setError("");}}>Reset draft form</button>
          </div>
          {!canEdit&&<p className="emp-hint">Your role cannot create campaigns. An administrator can grant campaign permission.</p>}
        </form>
      </div>

      <div className="emp-stack">
        <div className="emp-card emp-card-flush">
          <div className="emp-card-head">
            <h2 className="emp-card-title">Campaigns</h2>
            {loading&&<span className="emp-hint" role="status">Loading…</span>}
          </div>
          <div className="emp-campaign-list">
            {!loading&&!campaigns.length&&<p className="emp-list-state">No campaigns in this view yet.</p>}
            {campaigns.map(row=><button
              key={row.id}
              type="button"
              aria-current={detail?.campaign?.id===row.id?"true":undefined}
              className="emp-campaign"
              onClick={()=>open(row.id)}
            >
              <span className="emp-campaign-top">
                <strong>{row.name}</strong>
                <span className={statusClass(row.status)}>{row.status}</span>
              </span>
              <span className="emp-campaign-meta">{Number(row.visible_recipients||0).toLocaleString("en-IN")} visible recipients</span>
            </button>)}
            {campaignCursor&&<button type="button" className="emp-btn emp-btn-sm emp-loadmore" onClick={()=>more("campaigns",campaignCursor)}>Load more campaigns</button>}
          </div>
        </div>

        {detail&&<div className="emp-card emp-card-flush">
          <div className="emp-card-head">
            <h2 className="emp-card-title">{detail.campaign.name}</h2>
            <span className={statusClass(detail.campaign.status)}>{detail.campaign.status}</span>
          </div>
          <div className="emp-card-body">
            <p className="emp-hint">{detail.campaign.total_contacts} authorized recipients · Template {detail.campaign.template?.name||"unavailable"}{detail.campaign.template?.language?` · ${detail.campaign.template.language}`:""}</p>
            {detail.campaign.template?.body&&<p className="emp-template-preview">{detail.campaign.template.body}</p>}
            <p className="emp-hint">Saved body values: {(detail.campaign.parameters||[]).join(" · ")||"none"}</p>
            {actions.length>0?<div className="emp-form-actions">
              {actions.map(action=><button key={action} type="button" className={`emp-btn emp-btn-sm ${action==="cancel"?"emp-btn-danger":"emp-btn-primary"}`} disabled={!canEdit||busy} onClick={()=>control(action)}>{ACTION_LABELS[action]||action}</button>)}
              {saved&&<span className="emp-hint emp-hint-ok" aria-hidden="true">{saved}</span>}
            </div>:<p className="emp-hint">This campaign has no further actions in its current status.</p>}
            {Object.keys(detail.summary||{}).length>0&&<dl className="emp-summary">
              {Object.entries(detail.summary||{}).map(([status,count])=><div key={status}><dt>{status}</dt><dd>{count}</dd></div>)}
            </dl>}
            <div className="emp-recipients">
              {(detail.records||[]).map(row=><div className="emp-recipient" key={row.id}>
                <span>{row.name} · {row.phone}</span>
                <small>{row.status}</small>
              </div>)}
            </div>
            {detail.nextCursor&&<button type="button" className="emp-btn emp-btn-sm" onClick={async()=>{const current=version.current;try{const {data}=await api.get(`${root}/${detail.campaign.id}`,{params:{before:detail.nextCursor}});if(current===version.current)setDetail(previous=>previous?.campaign.id===data.campaign.id?({...data,records:[...previous.records,...data.records]}):previous);}catch(err){if(current===version.current)setError(errorMessage(err));}}}>Load more results</button>}
          </div>
        </div>}
      </div>
    </div>
  </section>;
}
