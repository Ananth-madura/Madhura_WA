"use strict";
const definition=require("./flowDefinition");
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
function createFlowStore(db){
  const query=async(sql,params=[])=>(await db.promise().query(sql,params))[0];
  async function transaction(work){if(db.isSqlite)throw fail("Shared-number flows require the configured MySQL database",503);const connection=await db.promise().getConnection();try{await connection.beginTransaction();const result=await work(async(sql,params=[])=>(await connection.query(sql,params))[0]);await connection.commit();return result;}catch(error){await connection.rollback();throw error;}finally{connection.release();}}
  async function get(tenant,id,q=query,lock=false){
    const [row]=await q(`SELECT * FROM wa_flows WHERE tenant_id=? AND id=?${lock?" FOR UPDATE":""}`,[tenant,id]);
    if(!row)throw fail("Flow not found",404);
    const nodes=await q("SELECT * FROM wa_flow_nodes WHERE flow_id=? ORDER BY id",[row.id]);
    return {...row,trigger_config:typeof row.trigger_config==="string"?JSON.parse(row.trigger_config):row.trigger_config||{},nodes:nodes.map(n=>({...n,config:typeof n.config==="string"?JSON.parse(n.config):n.config||{}}))};
  }
  async function replaceNodes(q,id,nodes){await q("DELETE FROM wa_flow_nodes WHERE flow_id=?",[id]);for(const node of nodes)await q("INSERT INTO wa_flow_nodes (flow_id,node_key,node_type,config,position_x,position_y) VALUES (?,?,?,?,?,?)",[id,node.node_key,node.node_type,JSON.stringify(node.config),Number(node.position_x)||0,Number(node.position_y)||0]);}
  async function save(tenant,user,input,id=null){return transaction(async q=>{
    const previous=id?await get(tenant,id,q,true):null;
    const flow=definition.normalize({...previous,...input});
    if(previous){await q("UPDATE wa_flows SET name=?,description=?,trigger_type=?,trigger_config=?,entry_node_key=?,updated_at=NOW() WHERE tenant_id=? AND id=?",[flow.name,flow.description,flow.trigger_type,JSON.stringify(flow.trigger_config),flow.entry_node_key,tenant,id]);}
    else{const result=await q("INSERT INTO wa_flows (tenant_id,name,description,status,trigger_type,trigger_config,entry_node_key,created_by) VALUES (?,?,?,'draft',?,?,?,?)",[tenant,flow.name,flow.description,flow.trigger_type,JSON.stringify(flow.trigger_config),flow.entry_node_key,user]);id=result.insertId;}
    await replaceNodes(q,id,flow.nodes);return get(tenant,id,q);
  });}
  async function publish(tenant,user,id,changelog="Published version"){return transaction(async q=>{
    const flow=definition.normalize(await get(tenant,id,q,true),{publish:true});
    for(const node of flow.nodes.filter(n=>n.node_type==="business_action"))await require("./flowConnectionStore").resolve(tenant,node.config.connection,node.config.operation);
    if(flow.nodes.some(n=>n.node_type==="ai_reply")){
      const settings=await require("./sharedInboxAssistant").publicSettings(tenant);
      if(!settings.enabled||!settings.hasApiKey||!settings.model)throw fail("Configure and enable the inbox AI assistant before publishing an AI reply step");
    }
    for(const node of flow.nodes.filter(n=>n.node_type==="send_template")){
      const [template]=await q("SELECT id FROM wa_templates WHERE tenant_id=? AND (id=? OR name=?) AND meta_status='APPROVED' AND meta_template_id IS NOT NULL LIMIT 1",[tenant,Number(node.config.template_id)||0,node.config.template_name||""]);
      if(!template)throw fail(`Step ${node.node_key} needs a template synchronized from Meta with approval`);
    }
    const [max]=await q("SELECT COALESCE(MAX(version_number),0) AS version FROM wa_flow_versions WHERE flow_id=?",[id]);
    await q("UPDATE wa_flow_versions SET status='archived' WHERE flow_id=? AND status='published'",[id]);
    await q("INSERT INTO wa_flow_versions (flow_id,version_number,name,description,trigger_type,trigger_config,entry_node_key,nodes_snapshot,status,changelog,published_at,created_by) VALUES (?,?,?,?,?,?,?,?,'published',?,NOW(),?)",[id,Number(max.version)+1,flow.name,flow.description,flow.trigger_type,JSON.stringify(flow.trigger_config),flow.entry_node_key,JSON.stringify(flow.nodes),String(changelog).slice(0,4000),user]);
    await q("UPDATE wa_flows SET status='active',updated_at=NOW() WHERE tenant_id=? AND id=?",[tenant,id]);return {success:true,version:Number(max.version)+1};
  }).then(result=>{require("./sharedFlowRuntime").invalidate(tenant);return result;});}
  async function seed(tenant,user){return transaction(async q=>{
    await q("SELECT id FROM tenants WHERE id=? FOR UPDATE",[tenant]);
    let added=0;
    for(const input of require("./prebuiltFlows")){
      const flow=definition.normalize(input,{publish:true});
      const name=`${flow.name}`;
      if((await q("SELECT id FROM wa_flows WHERE tenant_id=? AND name=?",[tenant,name])).length)continue;
      definition.normalize(flow,{publish:true});
      const result=await q("INSERT INTO wa_flows (tenant_id,name,description,status,trigger_type,trigger_config,entry_node_key,created_by) VALUES (?,?,?,'draft',?,?,?,?)",[tenant,name,flow.description,flow.trigger_type,JSON.stringify(flow.trigger_config),flow.entry_node_key,user]);
      await replaceNodes(q,result.insertId,flow.nodes);added++;
    }
    return {success:true,count:added,message:"Starter flows added as drafts. Test and publish each flow to enable it."};
  });}
  return {query,transaction,get,save,publish,seed,replaceNodes};
}
module.exports={createFlowStore};
