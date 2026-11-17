"use strict";
// Cookie flags decide whether an IP-only install can keep a session at all:
// Secure cookies are dropped by the browser on http://<ip>, so the login
// succeeds and the next request is already signed out.
const assert=require("node:assert/strict");
const sessions=require("../services/browserSessions");

if(!process.env.JWT_SECRET)process.env.JWT_SECRET="cookie-flag-fixture-secret";

function cookiesFor(env){
  const previous={};
  for(const key of Object.keys(env))previous[key]=process.env[key];
  Object.assign(process.env,env);
  try{
    const captured=[];
    const res={cookie:(name,value,options)=>captured.push({name,options}),set(){}};
    sessions.setCookies(res,{id:1,role:"admin",tenant_id:1,first_name:"Fixture"},"sid","secret");
    return captured;
  }finally{
    for(const key of Object.keys(env)){
      if(previous[key]===undefined)delete process.env[key];
      else process.env[key]=previous[key];
    }
  }
}

const production=cookiesFor({NODE_ENV:"production",AUTH_COOKIE_SECURE:"",AUTH_COOKIE_SAME_SITE:"lax"});
assert.equal(production.length,2);
assert(production.every(cookie=>cookie.options.secure===true),"production must default to Secure cookies");
assert(production.every(cookie=>cookie.options.httpOnly===true&&cookie.options.sameSite==="lax"));
assert.equal(production.find(cookie=>cookie.name==="wa_refresh").options.path,"/api/auth");
assert.equal(production.find(cookie=>cookie.name==="wa_access").options.path,"/");

const plainHttp=cookiesFor({NODE_ENV:"production",AUTH_COOKIE_SECURE:"0"});
assert(plainHttp.every(cookie=>cookie.options.secure===false),"AUTH_COOKIE_SECURE=0 must allow cookies over plain HTTP");

const forced=cookiesFor({NODE_ENV:"development",AUTH_COOKIE_SECURE:"1"});
assert(forced.every(cookie=>cookie.options.secure===true),"AUTH_COOKIE_SECURE=1 must force Secure outside production");

assert.throws(()=>cookiesFor({NODE_ENV:"production",AUTH_COOKIE_SECURE:"0",AUTH_COOKIE_SAME_SITE:"none"}),/Invalid browser cookie configuration/,"SameSite=None requires Secure");

const crossSite=cookiesFor({NODE_ENV:"production",AUTH_COOKIE_SECURE:"1",AUTH_COOKIE_SAME_SITE:"none"});
assert(crossSite.every(cookie=>cookie.options.sameSite==="none"&&cookie.options.secure===true));

console.log("PASS: Secure cookie default, explicit plain-HTTP opt-out, forced Secure, and SameSite=None validation");
