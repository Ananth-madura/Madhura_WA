"use strict";
const target=process.env.INBOX_TEST_META_TRANSPORT;
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(target||"")||!/^inbox_boot_/.test(process.env.DB_NAME||""))throw new Error("Meta transport preload requires an isolated boot-test database and loopback fixture");
const axios=require("axios");
for(const method of ["get","post"]){
  const original=axios[method].bind(axios);
  axios[method]=(url,...args)=>{
    const options=args[method==="post"?1:0];
    if(String(url).startsWith("https://graph.facebook.com/")&&options?.headers?.Authorization==="Bearer fixture-access-token")url=String(url).replace("https://graph.facebook.com",target);
    return original(url,...args);
  };
}
