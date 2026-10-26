import { useEffect, useRef, useState } from "react";
import api from "../config/axios";
import { requestKey } from "../utils/requestKey";
import { AlertCircle } from "lucide-react";

const field="emp-field";
const count=value=>Math.min(20,Math.max(0,...[...String(value||"").matchAll(/\{\{(\d+)\}\}/g)].map(match=>Number(match[1]))));
export default function InboxComposeExtras({conversationId,onSent}) {
  const [kind,setKind]=useState("attachment"),[templates,setTemplates]=useState([]),[templateId,setTemplateId]=useState("");
  const [parameters,setParameters]=useState([]),[headerParameters,setHeaderParameters]=useState([]),[buttons,setButtons]=useState({});
  const [file,setFile]=useState(null),[caption,setCaption]=useState(""),[error,setError]=useState(""),[status,setStatus]=useState(""),[busy,setBusy]=useState(false);
  const [uncertain,setUncertain]=useState(false);
  const input=useRef(null),version=useRef(0),pendingRequest=useRef(null);
  const storageKey=`inbox-extra:${localStorage.getItem("active_tenant_id")||"none"}:${conversationId}`;
  const remember=value=>{try{if(value)sessionStorage.setItem(storageKey,value);else sessionStorage.removeItem(storageKey);}catch(_){}};
  useEffect(()=>{
    const current=++version.current; setTemplates([]);setTemplateId("");setParameters([]);setHeaderParameters([]);setButtons({});setFile(null);setError("");setStatus("");setBusy(false);pendingRequest.current=null;
    if(input.current)input.current.value="";
    let previous=null;try{previous=sessionStorage.getItem(storageKey);}catch(_){}
    pendingRequest.current=previous;setUncertain(Boolean(previous));
    if(previous)setError("An earlier send has no confirmed result. Check its delivery before starting a separate send.");
    api.get(`/api/v2/inbox/conversations/${conversationId}/templates`).then(({data})=>{if(current===version.current)setTemplates(data.templates||[]);}).catch(err=>{if(current===version.current)setError(err.response?.data?.message||"Template catalog unavailable. Retry by reopening the conversation.");});
    const invalidate=()=>{version.current++;};return invalidate;
  },[conversationId,storageKey]);
  const template=templates.find(row=>String(row.id)===templateId);
  let templateButtons=[];try{templateButtons=typeof template?.buttons==="string"?JSON.parse(template.buttons):template?.buttons||[];if(!Array.isArray(templateButtons))templateButtons=[];}catch(_){}
  const send=async event=>{
    event.preventDefault();const current=version.current;setBusy(true);setError("");setStatus("");
    const requestId=pendingRequest.current||requestKey("extra");pendingRequest.current=requestId;
    remember(requestId);
    const data=new FormData();data.append("kind",kind);data.append("requestId",requestId);data.append("caption",caption);
    if(kind==="template"){data.append("templateId",templateId);data.append("parameters",JSON.stringify(parameters));data.append("headerParameters",JSON.stringify(headerParameters));data.append("buttonParameters",JSON.stringify(buttons));}
    if(file)data.append("file",file);
    try{
      const result=await api.post(`/api/v2/inbox/conversations/${conversationId}/send`,data,{headers:{"Content-Type":"multipart/form-data"},timeout:90000});
      if(current!==version.current)return;
      pendingRequest.current=null;remember(null);setUncertain(false);setStatus(result.data.alreadySent?"This request was already sent. It was not repeated.":"Message sent");
      if(result.data.message)await onSent(result.data.message);
      setFile(null);setCaption("");if(input.current)input.current.value="";
    }catch(err){
      if(current!==version.current)return;
      const responseStatus=err.response?.status;
      if(responseStatus&&![409,504].includes(responseStatus)){pendingRequest.current=null;remember(null);setUncertain(false);}else setUncertain(true);
      setError(err.response?.data?.message||"Delivery could not be checked. Do not repeat an uncertain send.");
    }finally{if(current===version.current)setBusy(false);}
  };
  return <details className="emp-details">
    <summary>Attachments and approved templates</summary>
    <div className="emp-details-body">
      <p>Attachments: up to 8 MB; images: up to 5 MB. Templates must be approved for this business number.</p>
      {error&&<div className="emp-banner emp-banner-error" role="alert"><AlertCircle size={14} aria-hidden="true"/><span>{error}</span></div>}
      {status&&<div className="emp-banner emp-banner-success" role="status"><span>{status}</span></div>}
      {uncertain&&<div>
        <button type="button" className="emp-btn emp-btn-sm" onClick={()=>{if(!window.confirm("The previous message may have been delivered. Start a separate send only after checking delivery to avoid duplicates."))return;pendingRequest.current=null;remember(null);setUncertain(false);setError("");}}>Start a separate send after checking delivery</button>
      </div>}
      <form onSubmit={send} className="emp-form">
        <label className="emp-label">Send type
          <select disabled={busy} className={field} value={kind} onChange={event=>{setKind(event.target.value);setFile(null);if(input.current)input.current.value="";}}><option value="attachment">Attachment</option><option value="template">Approved template</option></select>
        </label>
        {kind==="template"&&<>
          <label className="emp-label">Template
            <select disabled={busy} className={field} required value={templateId} onChange={event=>{setTemplateId(event.target.value);setParameters([]);setHeaderParameters([]);setButtons({});}}><option value="">Choose approved template</option>{templates.map(row=><option key={row.id} value={row.id}>{row.name} · {row.language}</option>)}</select>
          </label>
          {template&&<p className="emp-template-preview">{template.body}</p>}
          {Array.from({length:count(template?.body)},(_,index)=><label key={`body-${index}`} className="emp-label">Body value {index+1}<input required maxLength={1024} className={field} value={parameters[index]||""} onChange={event=>setParameters(previous=>{const next=[...previous];next[index]=event.target.value;return next;})}/></label>)}
          {String(template?.header_type).toLowerCase()==="text"&&Array.from({length:count(template?.header_value)},(_,index)=><label key={`header-${index}`} className="emp-label">Header value {index+1}<input required maxLength={1024} className={field} value={headerParameters[index]||""} onChange={event=>setHeaderParameters(previous=>{const next=[...previous];next[index]=event.target.value;return next;})}/></label>)}
          {templateButtons.map((button,index)=>String(button.type).toLowerCase()==="url"&&count(button.url)?<label key={index} className="emp-label">Link button value: {button.text}<input required maxLength={1024} className={field} value={buttons[index]||""} onChange={event=>setButtons(previous=>({...previous,[index]:event.target.value}))}/></label>:null)}
        </>}
        {(kind==="attachment"||["IMAGE","VIDEO","DOCUMENT"].includes(String(template?.header_type).toUpperCase()))&&<label className="emp-label">{kind==="template"?`${template.header_type} header file`:"Attachment file"}<input ref={input} className="emp-file" type="file" required disabled={busy} onChange={event=>setFile(event.target.files?.[0]||null)}/></label>}
        {kind==="attachment"&&<label className="emp-label">Caption<textarea maxLength={1024} className={field} value={caption} onChange={event=>setCaption(event.target.value)}/></label>}
        <div className="emp-form-actions">
          <button type="submit" className="emp-btn emp-btn-sm emp-btn-primary" disabled={busy||(kind==="attachment"&&!file)||(kind==="template"&&!template)}>{busy?"Uploading and sending…":"Send selected content"}</button>
        </div>
      </form>
    </div>
  </details>;
}
