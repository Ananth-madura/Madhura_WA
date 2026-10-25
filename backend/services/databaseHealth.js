"use strict";
function createDatabaseHealth(database,{onResult=()=>{},now=Date.now,intervalMs=10000,maxAgeMs=30000}={}){
  let result={ok:false,checkedAt:null,queryMs:null,errorCode:null},pending=null,timer;
  function status(){return {...result,ok:result.ok&&result.checkedAt!==null&&now()-result.checkedAt<=maxAgeMs};}
  function check(){
    if(pending)return pending;
    const started=now();
    pending=Promise.resolve().then(()=>database.promise().query(database.isSqlite?"SELECT 1":{sql:"SELECT 1",timeout:5000})).then(()=>{
      result={ok:true,checkedAt:now(),queryMs:now()-started,errorCode:null};
    }).catch(error=>{result={ok:false,checkedAt:now(),queryMs:now()-started,errorCode:error.code||"DATABASE_UNAVAILABLE"};}).then(()=>{onResult(status());return status();}).finally(()=>{pending=null;});
    return pending;
  }
  return {status,check,start(){if(!timer){check();timer=setInterval(check,intervalMs);timer.unref();}},stop(){clearInterval(timer);timer=null;}};
}
module.exports={createDatabaseHealth};
