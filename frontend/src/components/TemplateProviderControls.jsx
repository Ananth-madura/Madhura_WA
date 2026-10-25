import React,{useEffect,useState} from "react";
import axios from "axios";
import {API} from "../config/api";

export default function TemplateProviderControls({templates,onChanged}){
  const [senders,setSenders]=useState([]),[senderId,setSenderId]=useState("");
  const [draftId,setDraftId]=useState(""),[examples,setExamples]=useState("[]");
  const [busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[error,setError]=useState("");
  useEffect(()=>{let active=true;axios.get(`${API}/api/v2/meta/senders`).then(({data})=>{if(active)setSenders(data.senders||[]);}).catch(()=>{if(active)setError("Connected numbers could not be loaded. Check Accounts and reload this page.");});return()=>{active=false;};},[]);
  const run=async submit=>{
    setBusy(true);setNotice("");setError("");
    try{
      const values=submit?JSON.parse(examples):[];
      if(!Array.isArray(values))throw new Error("Examples must be a JSON array, for example [\"Customer\"]");
      await axios.post(`${API}/api/wa/templates/${submit?`${draftId}/submit`:"sync"}`,{senderId:Number(senderId),examples:values});
      setNotice(submit?"Submitted to Meta. Synchronize later to check approval.":"Templates synchronized from the selected WhatsApp Business Account.");await onChanged();
    }catch(failure){setError(failure.response?.data?.error||failure.message||"Template operation failed");}finally{setBusy(false);}
  };
  return <section className="hl-card p-4 space-y-3" aria-label="Meta template approval">
    <p className="text-sm">Local drafts require Meta approval before use. Select the number whose business account owns the templates.</p>
    <div className="flex flex-wrap items-end gap-3">
      <label className="text-xs">Connected number<select className="hl-input block" value={senderId} onChange={event=>setSenderId(event.target.value)} disabled={busy}><option value="">Choose a number</option>{senders.map(sender=><option key={sender.id} value={sender.id}>{sender.display_phone||sender.verified_name||`Number ${sender.id}`}</option>)}</select></label>
      <button className="hl-btn-secondary" onClick={()=>run(false)} disabled={!senderId||busy}>{busy?"Working…":"Sync Meta templates"}</button>
    </div>
    <details><summary className="text-sm cursor-pointer">Submit a text draft for approval</summary>
      <div className="flex flex-wrap items-end gap-3 mt-3">
        <label className="text-xs">Local draft<select className="hl-input block" value={draftId} onChange={event=>setDraftId(event.target.value)} disabled={busy}><option value="">Choose a draft</option>{templates.filter(t=>!t.meta_template_id).map(template=><option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
        <label className="text-xs">Body variable examples<input className="hl-input block" value={examples} onChange={event=>setExamples(event.target.value)} placeholder={'["Customer"]'} disabled={busy}/></label>
        <button className="hl-btn-secondary" onClick={()=>run(true)} disabled={!senderId||!draftId||busy}>Submit to Meta</button>
      </div>
      <p className="text-xs mt-2">Use numbered variables such as {"{{1}}"}. Create media, button and authentication templates in WhatsApp Manager, then sync them here.</p>
    </details>
    {error&&<p role="alert" className="text-sm">{error}</p>}
    {notice&&<p role="status" className="text-sm">{notice}</p>}
  </section>;
}
