import React,{act} from "react";
import {createRoot} from "react-dom/client";
import AppErrorBoundary from "./AppErrorBoundary";
test("an authenticated-page rendering failure shows recovery controls instead of clearing the root",async()=>{
  global.IS_REACT_ACT_ENVIRONMENT=true;const container=document.createElement("div");document.body.appendChild(container);const root=createRoot(container),output=jest.spyOn(console,"error").mockImplementation(()=>{});
  function Failed(){throw new Error("Invalid API list");}
  try{await act(async()=>root.render(<AppErrorBoundary><Failed/></AppErrorBoundary>));expect(container.querySelector('[role="alert"]').textContent).toContain("workspace could not open");expect(container.querySelector("button").textContent).toContain("Reload");}finally{await act(async()=>root.unmount());container.remove();output.mockRestore();}
});
