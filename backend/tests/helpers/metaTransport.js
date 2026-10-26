"use strict";
const http=require("node:http");
async function start(){
  const deliveries=[],uploads=[];let uploadHook=null;
  const server=http.createServer(async(req,res)=>{
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    const bytes=Buffer.concat(chunks),body=bytes.toString("utf8");
    if(req.url.startsWith("/media-bytes/")){res.setHeader("Content-Type","application/pdf");return res.end(Buffer.from("%PDF-1.4\nfixture attachment\n%%EOF"));}
    res.setHeader("Content-Type","application/json");
    if(req.url.endsWith("/media")&&req.method==="POST"){
      uploads.push({size:bytes.length,contentType:req.headers["content-type"]});
      if(uploadHook){try{await uploadHook();}catch(error){console.error("[MetaFixture] Upload hook failed",error.code);res.statusCode=500;return res.end(JSON.stringify({error:{message:"Fixture upload hook failed"}}));}}
      return res.end(JSON.stringify({id:`fixture-media-${uploads.length}`}));
    }
    if(/\/fixture-media-\d+$/.test(req.url)&&req.method==="GET")return res.end(JSON.stringify({url:`http://127.0.0.1:${server.address().port}/media-bytes/file`,mime_type:"application/pdf"}));
    const payload=body?JSON.parse(body):{};
    if(req.url.includes("message_templates")){
      if(req.method==="GET")return res.end(JSON.stringify({data:[{id:"meta-fixture-approved",name:"verified_greeting",language:"en",category:"UTILITY",status:"APPROVED",components:[{type:"BODY",text:"Hello {{1}}"}]}]}));
      return res.end(JSON.stringify({id:"meta-fixture-pending",status:"PENDING"}));
    }
    if(payload.text?.body?.includes("FIXTURE_UNKNOWN")||payload.document?.caption?.includes("FIXTURE_UNKNOWN")||payload.template?.components?.some(component=>component.parameters?.some(parameter=>parameter.text?.includes("FIXTURE_UNKNOWN")))){req.socket.destroy();return;}
    deliveries.push(payload);res.end(JSON.stringify({messages:[{id:`wamid.fixture.${deliveries.length}`}]}));
  });
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  return {url:`http://127.0.0.1:${server.address().port}`,deliveries,uploads,setUploadHook:hook=>{uploadHook=hook;},close:()=>new Promise(resolve=>server.close(resolve))};
}
module.exports={start};
