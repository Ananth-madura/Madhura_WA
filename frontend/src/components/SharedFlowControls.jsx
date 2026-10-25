import React,{useEffect,useState} from "react";
import api from "../config/axios";
export default function SharedFlowControls({conversationId,onStarted}){
  const [flows,setFlows]=useState([]),[flowId,setFlowId]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
  useEffect(()=>{let active=true;api.get("/api/v2/inbox/flows").then(({data})=>{if(active)setFlows(data.flows||[]);}).catch(()=>{});return()=>{active=false;};},[]);
  const start=async()=>{setBusy(true);setError("");try{await api.post(`/api/v2/inbox/conversations/${conversationId}/flow`,{flowId:Number(flowId)});await onStarted();}catch(failure){setError(failure.response?.data?.message||"The bot could not start. Check its published version and the reply window.");}finally{setBusy(false);}};
  if(!flows.length)return null;
  return <div className="flex flex-wrap items-center gap-2">
    <label className="text-sm">Published bot <select className="border rounded p-2" value={flowId} onChange={event=>setFlowId(event.target.value)} disabled={busy}><option value="">Choose a bot</option>{flows.map(flow=><option key={flow.id} value={flow.id}>{flow.name}</option>)}</select></label>
    <button className="border rounded p-2" disabled={!flowId||busy} onClick={start}>{busy?"Starting…":"Start bot"}</button>
    {error&&<span role="alert">{error}</span>}
  </div>;
}
