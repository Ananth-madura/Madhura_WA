import {flowPorts,removeFlowNodes,duplicateFlowNodes,parseFlowImport} from "./waFlowGraph";
const hours={node_key:"office-hours",node_type:"business_hours",config:{open_next:"open",closed_next:"closed"}};
const open={node_key:"open",node_type:"end",config:{}},closed={node_key:"closed",node_type:"handoff",config:{}};
test("removing a business-hours destination clears only that route",()=>{
  const updated=removeFlowNodes([hours,open,closed],new Set(["closed"]));
  expect(flowPorts(updated[0]).map(port=>port.target)).toEqual(["open",""]);
});
test("duplicated branches preserve internal connections and exclude external destinations",()=>{
  const copies=duplicateFlowNodes([hours,open,closed],[hours,open]);
  expect(flowPorts(copies[0]).map(port=>port.target)).toEqual(["open_copy",""]);
  const input={node_key:"ask",node_type:"collect_input",config:{next_node_key:"open",invalid_next:"closed"}};
  expect(flowPorts(removeFlowNodes([input,open,closed],new Set(["closed"]))[0]).map(port=>port.target)).toEqual(["open",""]);
});
test("imports accept supported hyphenated keys and enforce the server's node limit",()=>{
  const allowed=new Set(["business_hours","end","handoff"]);
  expect(parseFlowImport(JSON.stringify({name:"Hours",entry_node_key:"office-hours",nodes:[hours,open,closed]}),allowed).nodes).toHaveLength(3);
  expect(()=>parseFlowImport(JSON.stringify({nodes:Array.from({length:101},(_,i)=>({...open,node_key:`step_${i}`}))}),allowed)).toThrow("100 steps");
});
