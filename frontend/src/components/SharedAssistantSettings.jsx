import { useEffect, useState } from "react";
import api from "../config/axios";
export default function SharedAssistantSettings(){
  const [form,setForm]=useState(null),[apiKey,setApiKey]=useState(""),[notice,setNotice]=useState(""),[saving,setSaving]=useState(false);
  useEffect(()=>{api.get("/api/v2/inbox/assistant/settings").then(({data})=>setForm({enabled:Boolean(data.settings.enabled),autoStart:Boolean(data.settings.auto_start),provider:data.settings.provider,model:data.settings.model,systemPrompt:data.settings.system_prompt||"",hasApiKey:data.settings.hasApiKey})).catch(()=>setNotice("Assistant settings could not be loaded."));},[]);
  const save=async event=>{
    event.preventDefault();setSaving(true);
    try{await api.put("/api/v2/inbox/assistant/settings",{...form,apiKey});setApiKey("");setNotice("Assistant settings saved.");}
    catch(error){setNotice(error.response?.data?.message||"Settings could not be saved.");}finally{setSaving(false);}
  };
  return <details className="border rounded p-3"><summary className="cursor-pointer font-semibold">Business assistant settings</summary>
    <p className="text-sm py-2">The selected provider receives the current customer message and name. Chat history and internal notes are not sent. Automatic replies run only in chats set to Assistant mode.</p>
    {notice&&<p role="status">{notice}</p>}
    {form&&<form onSubmit={save} className="space-y-3">
      <label className="block"><input type="checkbox" checked={form.enabled} onChange={event=>setForm({...form,enabled:event.target.checked})}/> Enable this business assistant</label>
      <label className="block"><input type="checkbox" checked={form.autoStart} onChange={event=>setForm({...form,autoStart:event.target.checked})}/> Start automatic replies for new conversations</label>
      <label className="block">Provider <select className="border rounded p-2 text-black" value={form.provider} onChange={event=>setForm({...form,provider:event.target.value})}>{["openai","openrouter","groq","gemini","deepseek"].map(provider=><option key={provider}>{provider}</option>)}</select></label>
      <label className="block">Model <input className="border rounded p-2 text-black" value={form.model} onChange={event=>setForm({...form,model:event.target.value})}/></label>
      <label className="block">API key {form.hasApiKey&&<small>(a key is already saved; leave blank to keep it)</small>}<input className="border rounded p-2 text-black" type="password" autoComplete="new-password" value={apiKey} onChange={event=>setApiKey(event.target.value)}/></label>
      <label className="block">Business instructions <textarea className="block w-full border rounded p-2 text-black" maxLength={10000} value={form.systemPrompt} onChange={event=>setForm({...form,systemPrompt:event.target.value})}/></label>
      <button className="border rounded p-2" disabled={saving}>Save assistant settings</button>
    </form>}
  </details>;
}
