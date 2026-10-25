"use strict";
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const ACCESS_COOKIE = "wa_access";
const REFRESH_COOKIE = "wa_refresh";
const ACCESS_SECONDS = 15 * 60;
const SESSION_MS = 14 * 86400000;
const query = async (sql, params = []) => (await require("../config/database").promise().query(sql, params))[0];
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
const unauthorized = () => Object.assign(new Error("Browser session expired or revoked"), { status:401 });

function cookies(header = "") {
  const values = {};
  for (const item of String(header).split(";")) {
    const separator=item.indexOf("=");if(separator<0)continue;
    try { const key=item.slice(0,separator).trim();if(!(key in values))values[key]=decodeURIComponent(item.slice(separator+1)); } catch (_) {}
  }
  return values;
}
function requireOrigin(req) {
  const allowed = String(process.env.ALLOWED_ORIGINS || "").split(",").map(value=>value.trim()).filter(Boolean);
  try { allowed.push(new URL(process.env.PUBLIC_BASE_URL).origin); } catch (_) {}
  let origin=req.headers.origin;
  if(!origin&&req.headers.referer)try{origin=new URL(req.headers.referer).origin;}catch(_){}
  if(!origin || !allowed.includes(origin)) throw Object.assign(new Error("Browser request origin is not permitted"),{status:403});
}
function options(refresh = false) {
  const secure=process.env.NODE_ENV === "production" || process.env.AUTH_COOKIE_SECURE === "1";
  const sameSite=String(process.env.AUTH_COOKIE_SAME_SITE || "lax").toLowerCase();
  if(!["lax","strict","none"].includes(sameSite)||sameSite==="none"&&!secure)throw new Error("Invalid browser cookie configuration");
  return {httpOnly:true,secure,sameSite,path:refresh?"/api/auth":"/",maxAge:refresh?SESSION_MS:ACCESS_SECONDS*1000};
}
function accessToken(user, sid) {
  if(!process.env.JWT_SECRET)throw new Error("Authentication is not configured");
  return jwt.sign({id:Number(user.id),role:user.role,name:user.first_name||user.name||"",email:user.email,tenant_id:Number(user.tenant_id),sid},process.env.JWT_SECRET,{expiresIn:ACCESS_SECONDS});
}
function setCookies(res, user, sid, secret, remaining = SESSION_MS) {
  res.cookie(ACCESS_COOKIE,accessToken(user,sid),options());
  res.cookie(REFRESH_COOKIE,`${sid}.${secret}`,{...options(true),maxAge:remaining});
  res.set("Cache-Control","no-store");
}
function clearCookies(res) {
  const {maxAge:accessAge,...access}=options(),{maxAge:refreshAge,...refresh}=options(true);
  res.clearCookie(ACCESS_COOKIE,access);res.clearCookie(REFRESH_COOKIE,refresh);
}
function disconnectSessions({sid,userId}) {
  const io=require("../sockets/chatsockets").getIO();
  if(!io)return;
  for(const name of ["/","/notifications"])for(const socket of io.of(name).sockets.values()) {
    if(socket.data.sessionId && (sid?socket.data.sessionId===sid:Number(socket.data.user?.id)===Number(userId)))socket.disconnect(true);
  }
}
async function issue(req,res,claims) {
  requireOrigin(req);
  const [user]=await query("SELECT id, first_name, email, role, tenant_id FROM users WHERE id = ? AND status = 'active'",[claims.id]);
  if(!user)throw unauthorized();
  const sid=crypto.randomUUID(),secret=crypto.randomBytes(32).toString("base64url");
  await query("INSERT INTO browser_sessions (id,user_id,refresh_hash,expires_at) VALUES (?,?,?,?)",[sid,user.id,hash(secret),new Date(Date.now()+SESSION_MS)]);
  setCookies(res,user,sid,secret);
}
async function active(claims) {
  const [row]=await query(`SELECT s.id FROM browser_sessions s JOIN users u ON u.id=s.user_id AND u.status='active'
    WHERE s.id=? AND s.user_id=? AND s.revoked_at IS NULL AND s.expires_at>CURRENT_TIMESTAMP`,[claims.sid,claims.id]);
  if(!row)throw unauthorized();
}
function refreshParts(req) {
  const raw=cookies(req.headers.cookie)[REFRESH_COOKIE]||"";
  const [sid,secret,...extra]=raw.split(".");
  if(!/^[a-f0-9-]{36}$/.test(sid||"")||!secret||extra.length)throw unauthorized();
  return {sid,secret};
}
async function refresh(req,res) {
  requireOrigin(req);
  const {sid,secret}=refreshParts(req);
  const [user]=await query(`SELECT u.id,u.first_name,u.email,u.role,u.tenant_id,s.expires_at FROM browser_sessions s
    JOIN users u ON u.id=s.user_id AND u.status='active' WHERE s.id=? AND s.refresh_hash=? AND s.revoked_at IS NULL AND s.expires_at>CURRENT_TIMESTAMP`,[sid,hash(secret)]);
  if(!user)throw unauthorized();
  const next=crypto.randomBytes(32).toString("base64url");
  const result=await query("UPDATE browser_sessions SET refresh_hash=? WHERE id=? AND refresh_hash=? AND revoked_at IS NULL AND expires_at>CURRENT_TIMESTAMP",[hash(next),sid,hash(secret)]);
  if(result.affectedRows!==1)throw unauthorized();
  setCookies(res,user,sid,next,new Date(user.expires_at).getTime()-Date.now());
  return user;
}
async function revoke(req,res) {
  requireOrigin(req);
  try {
    const {sid,secret}=refreshParts(req);
    const result=await query("UPDATE browser_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE id=? AND refresh_hash=?",[sid,hash(secret)]);
    if(result.affectedRows)disconnectSessions({sid});
  } catch(error) {
    if(error.status!==401)throw error;
    const access=cookies(req.headers.cookie)[ACCESS_COOKIE];
    if(access) {
      let claims;
      try{claims=jwt.verify(access,process.env.JWT_SECRET,{algorithms:["HS256"],ignoreExpiration:true});}catch(_){}
      if(claims?.sid){await query("UPDATE browser_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?",[claims.sid,claims.id]);disconnectSessions({sid:claims.sid});}
    }
  }
  clearCookies(res);
}
function interceptLogin(req,res,next) {
  if(req.headers["x-browser-session"]!=="1"||process.env.AUTH_BROWSER_COOKIES==="0")return next();
  const json=res.json.bind(res);
  res.json=body=>{
    if(!body?.token||!body.user)return json(body);
    const claims=jwt.verify(body.token,process.env.JWT_SECRET,{algorithms:["HS256"]});
    issue(req,res,claims).then(()=>{
      const {token,...publicBody}=body;
      json({...publicBody,cookieSession:true,user:{...body.user,cookieSession:true}});
    }).catch(error=>{res.status(error.status||503);json({success:false,message:error.status?error.message:"Browser session could not be established"});});
    return res;
  };
  next();
}
module.exports={ACCESS_COOKIE,REFRESH_COOKIE,cookies,requireOrigin,active,refresh,revoke,clearCookies,interceptLogin,query,disconnectSessions};
