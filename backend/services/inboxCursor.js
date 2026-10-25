"use strict";
function encode(row){return "v1."+Buffer.from(JSON.stringify({id:row.id,at:row.updated_at?new Date(row.updated_at).toISOString():null})).toString("base64url");}
function decode(value){
  try{
    if(typeof value!=="string"||value.length>256||!value.startsWith("v1."))throw new Error();
    const cursor=JSON.parse(Buffer.from(value.slice(3),"base64url").toString());
    if(!Number.isSafeInteger(cursor.id)||cursor.id<=0||cursor.at!==null&&(typeof cursor.at!=="string"||new Date(cursor.at).toISOString()!==cursor.at))throw new Error();
    return {id:cursor.id,at:cursor.at===null?null:new Date(cursor.at)};
  }catch(_){throw Object.assign(new Error("Invalid inbox cursor"),{status:400});}
}
module.exports={encode,decode};
