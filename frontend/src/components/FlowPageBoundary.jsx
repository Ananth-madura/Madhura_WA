import React from "react";

export default class FlowPageBoundary extends React.Component {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(error){console.error("Flow workspace could not render",error);}
  render(){
    if(this.state.failed)return <section role="alert" className="hl-card p-6"><h1 className="hl-title">The flow workspace could not open</h1><p className="my-3">Reload to fetch the latest application files. Your saved flows remain on the server.</p><button className="hl-btn-primary" onClick={()=>window.location.reload()}>Reload flow workspace</button></section>;
    return this.props.children;
  }
}
