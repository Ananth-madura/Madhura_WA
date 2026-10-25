"use strict";
const http=require("node:http"),https=require("node:https");
function check(address=`http://127.0.0.1:${process.env.PORT||5001}/health`){
  return new Promise((resolve,reject)=>{
    const request=(address.startsWith("https:")?https:http).get(address,{timeout:5000},response=>{
      let body="";
      response.on("data",chunk=>{body+=chunk;if(body.length>65536)request.destroy(new Error("Invalid health response"));});
      response.on("end",()=>{try{const data=JSON.parse(body);resolve(response.statusCode===200&&data.ok===true&&data.sharedInboxReady===true);}catch(_){resolve(false);}});
    });
    request.on("timeout",()=>request.destroy(new Error("Health check timed out")));request.on("error",reject);
  });
}
if(require.main===module)check().then(ready=>{if(!ready){console.error("Backend database/inbox is not ready");process.exitCode=1;}}).catch(()=>{console.error("Backend is not reachable");process.exitCode=1;});
module.exports={check};
