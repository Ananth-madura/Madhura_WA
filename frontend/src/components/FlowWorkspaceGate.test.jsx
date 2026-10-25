import React,{act} from "react";
import {createRoot} from "react-dom/client";
import FlowWorkspaceGate from "./FlowWorkspaceGate";
import FlowPageBoundary from "./FlowPageBoundary";
import {useEnterprise} from "../context/EnterpriseContext";
import {useAuth} from "../auth/AuthContext";
jest.mock("../context/EnterpriseContext",()=>({useEnterprise:jest.fn()}));
jest.mock("../auth/AuthContext",()=>({useAuth:jest.fn()}));
let root,container;
beforeEach(()=>{global.IS_REACT_ACT_ENVIRONMENT=true;container=document.createElement("div");document.body.appendChild(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();});
test("loading organization has visible recovery controls, and demo mode still opens the builder",async()=>{
  const retry=jest.fn();useEnterprise.mockReturnValue({loading:true,activeTenant:null,refreshEnterpriseContext:retry});useAuth.mockReturnValue({demoMode:false});
  const render=()=>root.render(<FlowWorkspaceGate>{()=> <h1>Flow builder</h1>}</FlowWorkspaceGate>);
  await act(async()=>render());expect(container.textContent).toContain("Opening flow workspace");await act(async()=>container.querySelector("button").click());expect(retry).toHaveBeenCalled();
  useAuth.mockReturnValue({demoMode:true});await act(async()=>render());expect(container.textContent).toBe("Flow builder");
});
test("failed lazy module or editor rendering displays a recoverable message",async()=>{
  const output=jest.spyOn(console,"error").mockImplementation(()=>{});function Failed(){throw new Error("Loading chunk failed");}
  try{await act(async()=>root.render(<FlowPageBoundary><Failed/></FlowPageBoundary>));expect(container.querySelector('[role="alert"]').textContent).toContain("flow workspace could not open");expect(container.querySelector("button").textContent).toContain("Reload");}finally{output.mockRestore();}
});
