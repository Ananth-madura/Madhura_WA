import React,{act} from "react";
import {createRoot} from "react-dom/client";
import axios from "axios";
import WAAnalytics from "./whatsappAnalytics";
import {useEnterprise} from "../context/EnterpriseContext";

jest.mock("../components/WAWorkspaceGuide",()=>()=>null);
jest.mock("../context/EnterpriseContext",()=>({useEnterprise:jest.fn()}));
jest.mock("axios",()=>({get:jest.fn()}));

test("switching organizations discards late analytics from the previous organization",async()=>{
  global.IS_REACT_ACT_ENVIRONMENT=true;
  const container=document.createElement("div");document.body.appendChild(container);const root=createRoot(container);
  let tenant=1,finishOld;
  useEnterprise.mockImplementation(()=>({activeTenant:{id:tenant}}));
  axios.get.mockImplementation(url=>{
    if(!url.endsWith("/dashboard"))return Promise.resolve({data:[]});
    if(tenant===1)return new Promise(resolve=>{finishOld=resolve;});
    return Promise.resolve({data:{totalContacts:222222,generatedAt:"2026-01-01T02:00:00Z"}});
  });
  try{
    await act(async()=>root.render(<WAAnalytics/>));
    tenant=2;await act(async()=>root.render(<WAAnalytics/>));
    expect(container.textContent).toContain((222222).toLocaleString());
    await act(async()=>{finishOld({data:{totalContacts:111111,generatedAt:"2026-01-01T01:00:00Z"}});});
    expect(container.textContent).toContain((222222).toLocaleString());
    expect(container.textContent).not.toContain((111111).toLocaleString());
    expect(axios.get.mock.calls.filter(([url])=>url.endsWith("/dashboard"))).toHaveLength(2);
  }finally{await act(async()=>root.unmount());container.remove();}
});
