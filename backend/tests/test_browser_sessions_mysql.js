"use strict";
const assert=require("node:assert/strict");
const mysql=require("mysql2");
const express=require("express");
const request=require("supertest");
const jwt=require("jsonwebtoken");
async function main(){
  if(!process.env.INBOX_TEST_MYSQL_PORT){console.log("SKIP: isolated INBOX_TEST_MYSQL_PORT required");return;}
  const database=`browser_sessions_test_${process.pid}_${Date.now()}`;
  const settings={host:"127.0.0.1",port:Number(process.env.INBOX_TEST_MYSQL_PORT),user:"root",password:""};
  const root=mysql.createPool(settings);await root.promise().query(`CREATE DATABASE \`${database}\``);await root.promise().end();
  const db=mysql.createPool({...settings,database});
  try{
    await db.promise().query("CREATE TABLE users(id INT PRIMARY KEY,first_name VARCHAR(50),email VARCHAR(80),role VARCHAR(30),tenant_id INT,status VARCHAR(20))");
    await db.promise().query("CREATE TABLE browser_sessions(id VARCHAR(36) PRIMARY KEY,user_id INT,refresh_hash CHAR(64),expires_at TIMESTAMP,revoked_at TIMESTAMP NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
    await db.promise().query("INSERT INTO users VALUES(1,'Employee','staff@fixture.test','employee',1,'active')");
    require.cache[require.resolve("../config/database")]={loaded:true,exports:db};
    process.env.JWT_SECRET="isolated-browser-session-secret";process.env.NODE_ENV="test";process.env.PUBLIC_BASE_URL="http://app.fixture.test";process.env.ALLOWED_ORIGINS="http://app.fixture.test";
    const sessions=require("../services/browserSessions"),{verifyToken}=require("../middleware/authMiddleware");
    const app=express();app.use(express.json());
    app.use("/api/auth",require("../routes/browserSessionRoutes"));
    app.use("/api/auth",sessions.interceptLogin);
    app.post("/api/auth/login",(req,res)=>res.json({token:jwt.sign({id:1,tenant_id:1,role:"employee"},process.env.JWT_SECRET,{expiresIn:"14d"}),user:{id:1,tenant_id:1,role:"employee"}}));
    app.post("/api/private",verifyToken,(req,res)=>res.json({success:true}));
    const origin="http://app.fixture.test";
    const login=()=>request(app).post("/api/auth/login").set("Origin",origin).set("X-Browser-Session","1").send({});
    const cookieHeader=response=>response.headers["set-cookie"].map(value=>value.split(";")[0]).join("; ");
    const first=await login();assert.equal(first.status,200);assert.equal(first.body.cookieSession,true);assert.equal(first.body.token,undefined);
    assert(first.headers["set-cookie"].every(value=>value.includes("HttpOnly")&&value.includes("SameSite=Lax")));
    assert(first.headers["set-cookie"].find(value=>value.startsWith("wa_access=")).includes("Max-Age=900"));
    const firstCookies=cookieHeader(first);
    const access=sessions.cookies(firstCookies).wa_access,claims=jwt.verify(access,process.env.JWT_SECRET);
    const [[stored]]=await db.promise().query("SELECT * FROM browser_sessions WHERE id=?",[claims.sid]);
    assert.equal(stored.refresh_hash.length,64);assert(!firstCookies.includes(stored.refresh_hash));
    assert.equal((await request(app).get("/api/auth/session").set("Cookie",firstCookies)).status,200);
    assert.equal((await request(app).post("/api/private").set("Cookie",firstCookies).set("Origin","https://evil.fixture.test").send({})).status,403);
    assert.equal((await request(app).post("/api/private").set("Cookie",firstCookies).set("Origin",origin).send({})).status,200);
    const expired=jwt.sign({id:1,role:"employee",tenant_id:1,sid:claims.sid},process.env.JWT_SECRET,{expiresIn:-1});
    assert.equal((await request(app).get("/api/auth/session").set("Cookie",`wa_access=${expired}`)).status,401);
    const refreshed=await request(app).post("/api/auth/refresh").set("Cookie",firstCookies).set("Origin",origin);assert.equal(refreshed.status,200);
    assert.equal((await request(app).post("/api/auth/refresh").set("Cookie",firstCookies).set("Origin",origin)).status,401);
    const nextCookies=cookieHeader(refreshed);
    const competing=await Promise.all([1,2].map(()=>request(app).post("/api/auth/refresh").set("Cookie",nextCookies).set("Origin",origin)));
    assert.deepEqual(competing.map(response=>response.status).sort(),[200,401]);
    const current=cookieHeader(competing.find(response=>response.status===200));
    assert.equal((await request(app).post("/api/auth/logout").set("Cookie",current).set("Origin",origin)).status,200);
    assert.equal((await request(app).get("/api/auth/session").set("Cookie",current)).status,401);
    const two=await login(),three=await login();
    assert.equal((await request(app).post("/api/auth/logout-all").set("Cookie",cookieHeader(two)).set("Origin",origin)).status,200);
    assert.equal((await request(app).get("/api/auth/session").set("Cookie",cookieHeader(three))).status,401);
    const accessOnly=await login(),accessCookie=accessOnly.headers["set-cookie"].find(value=>value.startsWith("wa_access=")).split(";")[0];
    assert.equal((await request(app).post("/api/auth/logout").set("Cookie",accessCookie).set("Origin",origin)).status,200);
    assert.equal((await request(app).get("/api/auth/session").set("Cookie",accessCookie)).status,401);
    const legacy=await request(app).post("/api/auth/login").send({});assert(legacy.body.token);assert.equal(legacy.headers["set-cookie"],undefined);
    console.log("PASS: real MySQL hashed sessions; HttpOnly cookie login; 15-minute access lifetime; CSRF rejection; refresh rotation/replay rejection and concurrent refresh; logout/all-device revocation; bearer API compatibility.");
  }finally{await db.promise().query(`DROP DATABASE \`${database}\``);await db.promise().end();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
