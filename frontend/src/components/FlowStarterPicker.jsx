import React,{useEffect,useState} from "react";
import axios from "axios";
import {API} from "../config/api";
export default function FlowStarterPicker({onChoose}){
  const [flows,setFlows]=useState([]),[selected,setSelected]=useState(""),[error,setError]=useState("");
  useEffect(()=>{let active=true;axios.get(`${API}/api/wa-flows/library`).then(({data})=>{if(active)setFlows(Array.isArray(data)?data:[]);}).catch(()=>{if(active)setError("Starter library is unavailable. You can still add steps below and save when connected.");});return()=>{active=false;};},[]);
  const flow=flows.find(item=>item.key===selected);
  return <section className="fe-library-group"><h3>Start from a workflow</h3><label>Starter<select className="w-full border rounded p-2" value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Build from scratch</option>{flows.map(item=><option key={item.key} value={item.key}>{item.name}</option>)}</select></label>{flow&&<><p className="text-xs my-2">{flow.description}</p><button type="button" onClick={()=>onChoose(JSON.parse(JSON.stringify(flow)))}>Use this starter</button></>}{error&&<p role="status" className="text-xs">{error}</p>}</section>;
}
