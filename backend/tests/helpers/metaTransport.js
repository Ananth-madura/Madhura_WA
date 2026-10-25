"use strict";
const http=require("node:http");
async function start(){
  const deliveries=[];
  const server=http.createServer(async(req,res)=>{
    let body="";for await(const chunk of req)body+=chunk;
    const payload=body?JSON.parse(body):{};
    res.setHeader("Content-Type","application/json");
    if(req.url.includes("message_templates")){
      if(req.method==="GET")return res.end(JSON.stringify({data:[{id:"meta-fixture-approved",name:"verified_greeting",language:"en",category:"UTILITY",status:"APPROVED",components:[{type:"BODY",text:"Hello {{1}}"}]}]}));
      return res.end(JSON.stringify({id:"meta-fixture-pending",status:"PENDING"}));
    }
    if(payload.text?.body?.includes("FIXTURE_UNKNOWN")){req.socket.destroy();return;}
    deliveries.push(payload);res.end(JSON.stringify({messages:[{id:`wamid.fixture.${deliveries.length}`}]}));
  });
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  return {url:`http://127.0.0.1:${server.address().port}`,deliveries,close:()=>new Promise(resolve=>server.close(resolve))};
}
module.exports={start};
