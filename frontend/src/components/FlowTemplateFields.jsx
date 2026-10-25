import React,{useEffect,useState} from "react";
import axios from "axios";
import {API} from "../config/api";
export default function FlowTemplateFields({config,onChange}){
  const [templates,setTemplates]=useState([]),[error,setError]=useState("");
  useEffect(()=>{let active=true;axios.get(`${API}/api/wa/templates`).then(({data})=>{if(active)setTemplates(data.filter(t=>t.meta_status==="APPROVED"&&t.meta_template_id));}).catch(()=>{if(active)setError("Approved templates could not be loaded. Synchronize templates and reopen this step.");});return()=>{active=false;};},[]);
  return <div className="space-y-3">
    <label className="block text-xs">Approved template<select className="w-full border rounded p-2" value={config.template_id||""} onChange={event=>onChange({template_id:Number(event.target.value)||null,template_name:""})}><option value="">Choose a synchronized template</option>{templates.map(template=><option key={template.id} value={template.id}>{template.name} ({template.language}) · {template.waba_id}</option>)}</select></label>
    <label className="block text-xs">Body parameters, one per line<textarea className="w-full border rounded p-2" value={(config.parameters||[]).join("\n")} onChange={event=>onChange({parameters:event.target.value?event.target.value.split("\n"):[]})} placeholder={"{{customer.name}}\n{{order_reference}}"}/></label>
    <p className="text-xs">Parameter order must match the approved body. The conversation's number must belong to the same WhatsApp Business Account.</p>
    {error&&<p role="alert" className="text-xs">{error}</p>}
  </div>;
}
