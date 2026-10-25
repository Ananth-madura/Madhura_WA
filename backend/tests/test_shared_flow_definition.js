"use strict";
const assert=require("node:assert/strict");
const {normalize,step}=require("../services/flowDefinition");
const library=require("../services/prebuiltFlows");
assert.equal(library.length,10);
for(const input of library){
  const flow=normalize(input,{publish:true});
  let result=step(flow,"",null,{name:"Customer"});
  assert(result.waiting,input.key);
  if(input.key==="welcome"){
    assert.equal(result.messages[0].buttons.length,3);
    result=step(flow,"route_2",result);assert(result.isHandedOff);
  }else{
    const firstAnswer=input.key==="feedback"?"4":"First answer";
    result=step(flow,firstAnswer,result);
    const node=flow.nodes.find(n=>n.node_key===result.currentNodeKey);
    const answer=node.config.validation==="date"?"2026-12-20":node.config.validation==="email"?"customer@example.test":"Second answer";
    result=step(flow,answer,result);
    assert(result.isHandedOff,input.key);
    assert(result.messages.some(m=>m.text.includes(firstAnswer)),input.key);
  }
}
const simple={name:"Builder field compatibility",trigger_type:"manual",entry_node_key:"start",nodes:[
  {node_key:"start",node_type:"start",config:{next_node_key:"ask"}},
  {node_key:"ask",node_type:"collect_input",config:{prompt_text:"Your email?",var_key:"email",validation_type:"email",next_node_key:"check"}},
  {node_key:"check",node_type:"condition",config:{subject_key:"email",operator:"contains",value:"@",true_next:"yes",false_next:"no"}},
  {node_key:"yes",node_type:"send_message",config:{text:"Received {{email}}",next_node_key:"end"}},
  {node_key:"no",node_type:"handoff",config:{}},{node_key:"end",node_type:"end",config:{}},
]};
const flow=normalize(simple,{publish:true});
let first=step(flow);assert.equal(first.messages[0].text,"Your email?");
const invalid=step(flow,"bad email",first);assert(invalid.waiting);assert.equal(invalid.currentNodeKey,"ask");
assert(step(flow,"still invalid",step(flow,"bad again",invalid)).isHandedOff);
const valid=step(flow,"customer@example.test",first);assert(valid.isEnded);assert.equal(valid.messages[0].text,"Received customer@example.test");
assert.throws(()=>normalize({...simple,nodes:[...simple.nodes,{...simple.nodes[0]}]}),/unique key/);
assert.throws(()=>normalize({...simple,nodes:simple.nodes.map(n=>n.node_key==="ask"?{...n,config:{...n.config,next_node_key:"missing"}}:n)}),/missing step/);
assert.throws(()=>normalize({...simple,nodes:simple.nodes.map(n=>({...n,node_type:"api_webhook"}))}),/not supported/);
assert.throws(()=>normalize({...simple,nodes:simple.nodes.map(n=>n.node_key==="ask"?{...n,config:{...n.config,var_key:"__proto__"}}:n)}),/Reserved/);
const loop=normalize({name:"Loop",trigger_type:"manual",nodes:[{node_key:"start",node_type:"start",config:{next_node_key:"start"}}]});assert.throws(()=>step(loop),/40 steps/);
const draft={name:"Unfinished menu",trigger_type:"manual",nodes:[{node_key:"start",node_type:"send_buttons",config:{text:"Choose",buttons:[{id:"a",title:"First",next_node_key:""}]}}]};normalize(draft);assert.throws(()=>normalize(draft,{publish:true}),/connected destinations/);
const booking=normalize(library.find(f=>f.key==="booking"));const date=step(booking,"Service",step(booking));assert(step(booking,"2026-02-31",date).waiting);assert(step(booking,"2026-02-28",date).isHandedOff);
console.log("PASS: all 10 prebuilt bots traverse to handoff; shared preview/runtime field compatibility, menu choices, input validation, conditions, interpolation, invalid graphs, unsupported steps and loop bounds.");
