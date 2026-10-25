import React from "react";
import {useEnterprise} from "../context/EnterpriseContext";
import {useAuth} from "../auth/AuthContext";
export default function FlowWorkspaceGate({children}){
  const {activeTenant,loading,refreshEnterpriseContext}=useEnterprise();
  const {demoMode}=useAuth();
  if(loading&&!demoMode)return <section role="status" className="hl-card p-6"><h1 className="hl-title">Opening flow workspace</h1><p className="my-3">Checking your organization and flow permissions.</p><button className="hl-btn-secondary" onClick={refreshEnterpriseContext}>Retry workspace connection</button></section>;
  return children(activeTenant);
}
