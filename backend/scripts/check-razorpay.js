"use strict";
const path=require("node:path");
require("dotenv").config({path:path.resolve(__dirname,"../.env"),quiet:true});
async function main(){
  if(process.argv.slice(2).some(arg=>arg!=="--authenticate"))throw new Error("Usage: node scripts/check-razorpay.js [--authenticate]");
  const gateway=require("../services/razorpayClient"),result=gateway.status();
  if(process.argv.includes("--authenticate")&&result.configured){
    const axios=require("axios");
    try{
      const response=await axios.get("https://api.razorpay.com/v1/orders",{params:{count:1},auth:{username:gateway.keyId(),password:gateway.keySecret()},timeout:10000});
      result.authenticated=response.status===200;
    }catch(error){result.authenticated=false;result.httpStatus=error.response?.status||null;result.error=error.response?"Provider rejected authentication":"Provider could not be reached";}
  }
  console.log(JSON.stringify(result));
  if(!result.configured||!result.webhookConfigured||result.authenticated===false)process.exitCode=1;
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
