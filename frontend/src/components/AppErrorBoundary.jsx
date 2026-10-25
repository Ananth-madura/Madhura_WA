import React from "react";
export default class AppErrorBoundary extends React.Component{
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(error){console.error("Workspace rendering failed",error);}
  render(){
    if(!this.state.failed)return this.props.children;
    return <main style={{maxWidth:560,margin:"12vh auto",padding:24,fontFamily:"system-ui,sans-serif",color:"#202c52"}} role="alert"><h1>The workspace could not open</h1><p>Reload the app to try again. If the backend is still being connected, saved data will be available when the service is ready.</p><button onClick={()=>window.location.reload()} style={{padding:"12px 18px",marginTop:16,cursor:"pointer"}}>Reload workspace</button></main>;
  }
}
