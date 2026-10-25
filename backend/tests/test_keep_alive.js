"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const file=path.resolve(__dirname,"../services/renderKeepAlive.js"),source=fs.readFileSync(file,"utf8");
function load(env){
  const timers=new Set(),state={exports:{}};
  const create=()=>{const handle={unref(){}};timers.add(handle);return handle;};
  vm.runInNewContext(source,{require,module:state,exports:state.exports,process:{env},console:{log(){},warn(){}},setTimeout:create,setInterval:create,clearTimeout:value=>timers.delete(value),clearInterval:value=>timers.delete(value)});
  return {service:state.exports,timers};
}
for(const env of [{},{NODE_ENV:"production",PUBLIC_BASE_URL:"https://api.fixture.test"},{ENABLE_RENDER_KEEP_ALIVE:"1",DISABLE_RENDER_KEEP_ALIVE:"1"},{ENABLE_RENDER_KEEP_ALIVE:"1",NODE_ENV:"test"}]){
  const {service,timers}=load(env);service.startKeepAlive();assert.equal(timers.size,0);
}
const {service,timers}=load({ENABLE_RENDER_KEEP_ALIVE:"1",PUBLIC_BASE_URL:"http://127.0.0.1:5001"});
service.startKeepAlive();assert.equal(timers.size,2);service.startKeepAlive();assert.equal(timers.size,2);service.stopKeepAlive();assert.equal(timers.size,0);
console.log("PASS: VPS/default startup creates no self-ping timers; explicit opt-in only; stopping clears initial and recurring timers. No network requests.");
