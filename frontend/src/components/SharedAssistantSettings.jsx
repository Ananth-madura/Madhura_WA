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
  return <details className="emp-details">
    <summary>Business assistant settings</summary>
    <div className="emp-details-body">
      <p>The selected provider receives the current customer message and name. Chat history and internal notes are not sent. Automatic replies run only in chats set to Assistant mode.</p>
      {notice&&<p role="status" className="emp-hint">{notice}</p>}
      {form&&<form onSubmit={save} className="emp-form">
        <label className="emp-check"><input type="checkbox" checked={form.enabled} onChange={event=>setForm({...form,enabled:event.target.checked})}/> Enable this business assistant</label>
        <label className="emp-check"><input type="checkbox" checked={form.autoStart} onChange={event=>setForm({...form,autoStart:event.target.checked})}/> Start automatic replies for new conversations</label>
        <label className="emp-label">Provider
          <select className="emp-field" value={form.provider} onChange={event=>setForm({...form,provider:event.target.value})}>{["openai","openrouter","groq","gemini","deepseek"].map(provider=><option key={provider}>{provider}</option>)}</select>
        </label>
        <label className="emp-label">Model
          <input className="emp-field" value={form.model} onChange={event=>setForm({...form,model:event.target.value})}/>
        </label>
        <label className="emp-label">API key {form.hasApiKey&&<small className="emp-hint">A key is already saved; leave blank to keep it.</small>}
          <input className="emp-field" type="password" autoComplete="new-password" value={apiKey} onChange={event=>setApiKey(event.target.value)}/>
        </label>
        <label className="emp-label">Business instructions
          <textarea className="emp-field" maxLength={10000} value={form.systemPrompt} onChange={event=>setForm({...form,systemPrompt:event.target.value})}/>
        </label>
        <div className="emp-form-actions">
          <button type="submit" className="emp-btn emp-btn-sm emp-btn-primary" disabled={saving}>{saving?"Saving…":"Save assistant settings"}</button>
        </div>
      </form>}
    </div>
  </details>;
}
