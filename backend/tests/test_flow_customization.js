"use strict";
const assert=require("node:assert/strict");
const rules=require("../services/flowRules"),{normalize,step}=require("../services/flowDefinition");
assert(rules.evaluate({match:"all",rules:[{field:"email",operator:"ends_with",value:"@example.test"},{field:"amount",operator:"greater_or_equal",value:"100"}]},{email:"person@example.test",amount:"150"}));
assert(!rules.evaluate({match:"all",rules:[{field:"email",operator:"is_empty"},{field:"amount",operator:"is_numeric"}]},{email:"person@example.test",amount:"150"}));
assert(rules.evaluate({match:"any",rules:[{field:"tier",operator:"in",value:"gold, premium"},{field:"city",operator:"equals",value:"Chennai"}]},{tier:"GOLD",city:"Delhi"}));
assert(!rules.compare({field:"amount",operator:"greater_than",value:"not numeric"},{amount:100}));
const office={timezone:"Asia/Kolkata",days:[1,2,3,4,5],start:"09:00",end:"18:00"};
assert(rules.openHours(office,new Date("2026-10-26T04:00:00Z")));assert(!rules.openHours(office,new Date("2026-10-25T04:00:00Z")));
const night={timezone:"UTC",days:[1],start:"22:00",end:"06:00"};assert(rules.openHours(night,new Date("2026-10-27T03:00:00Z")));assert(!rules.openHours(night,new Date("2026-10-28T03:00:00Z")));
assert.equal(rules.secureUrl("https://portal.example.test/help?ref={ref}",{ref:"one&redirect=https://evil.test"}),"https://portal.example.test/help?ref=one%26redirect%3Dhttps%3A%2F%2Fevil.test");
for(const value of ["http://example.test","javascript:alert(1)","https://user:password@example.test","https://{host}/portal"])assert.throws(()=>rules.secureUrl(value,{host:"evil.test"}));
const flow=normalize({name:"Reference recovery",trigger_type:"manual",nodes:[{node_key:"start",node_type:"collect_input",config:{prompt_text:"Reference?",var_key:"ref",validation_type:"reference",max_length:10,max_attempts:2,invalid_next:"recover",next_node_key:"end"}},{node_key:"recover",node_type:"handoff",config:{note:"A person can help."}},{node_key:"end",node_type:"end",config:{}}]},{publish:true});
const first=step(flow),invalid=step(flow,"!",first);assert(invalid.waiting);assert(step(flow,"!",invalid).isHandedOff);assert(step(flow,"CASE-123",first).isEnded);
const blueprints=require("../services/serviceFlowBlueprints");assert.equal(blueprints.length,3);
for(const source of blueprints){const input=JSON.parse(JSON.stringify(source));if(input.key==="account_service")input.nodes.find(n=>n.node_key==="portal").config.url="https://portal.example.test";const normalized=normalize(input,{publish:true});assert(step(normalized,"",null,{"customer.name":"Customer","contact.exists":true},{now:new Date("2026-10-26T04:00:00Z")}));}
assert.throws(()=>normalize(blueprints[0],{publish:true}),/HTTPS/);
console.log("PASS: grouped AND/OR conditions, strict numeric comparisons, office/overnight routing, fixed-domain encoded HTTPS links, bounded retries/recovery and all three service blueprints.");
