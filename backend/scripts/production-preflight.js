"use strict";
const path=require("node:path");
function validate(env,nodeMajor=Number(process.versions.node.split(".")[0])){
  const errors=[];
  if(env.NODE_ENV!=="production")errors.push("Set NODE_ENV=production");
  if(nodeMajor!==24)errors.push("Use the declared Node 24 runtime");
  for(const name of ["DB_HOST","DB_NAME","DB_USER","DB_PASS","JWT_SECRET","SMTP_ENCRYPTION_KEY","PUBLIC_BASE_URL","ALLOWED_ORIGINS","WA_DATA_DIR"]){
    if(!env[name]||/^(CHANGE_ME|changeme|secret|REPLACE_ME|TODO)$/.test(env[name]))errors.push(`${name} must be configured`);
  }
  if(env.DB_ENGINE!=="mysql"||env.USE_SQLITE==="1")errors.push("Select DB_ENGINE=mysql and disable USE_SQLITE");
  if(env.REQUIRE_HARD_CONFIG!=="1"||env.ALLOW_START_WITHOUT_DB!=="0")errors.push("Enable strict configuration and disable degraded startup");
  if(env.WA_SERVER_CHAT_STORAGE!=="0")errors.push("The selected device-history policy requires WA_SERVER_CHAT_STORAGE=0");
  if(env.WA_ENABLE_WEB_ENGINE!=="0")errors.push("This deployment uses Cloud API; set WA_ENABLE_WEB_ENGINE=0");
  if(env.WA_LEGACY_PUBLIC_UPLOADS!=="0")errors.push("Disable legacy public upload serving");
  if(env.AUTH_BROWSER_COOKIES!=="1")errors.push("Enable HttpOnly browser sessions");
  errors.push(...require("../config/capacity").validateOperations(env));
  if(env.R2_REQUIRED==="1"&&env.DISABLE_R2!=="0")errors.push("R2_REQUIRED requires DISABLE_R2=0");
  if(env.DISABLE_R2==="0"){
    for(const key of ["R2_ACCOUNT_ID","R2_ACCESS_KEY_ID","R2_SECRET_ACCESS_KEY","R2_BUCKET_NAME"]){
      if(!env[key]||/CHANGE_ME|REPLACE_ME|TODO/i.test(env[key]))errors.push(`${key} must be configured when R2 is enabled`);
    }
    if(env.R2_PUBLIC_DOMAIN){
      try{const url=new URL(env.R2_PUBLIC_DOMAIN);if(url.protocol!=="https:"||url.origin!==env.R2_PUBLIC_DOMAIN)throw new Error();}catch(_){errors.push("R2_PUBLIC_DOMAIN must be an exact HTTPS origin");}
      if(!env.R2_PUBLIC_BUCKET_NAME||env.R2_PUBLIC_BUCKET_NAME===env.R2_BUCKET_NAME)errors.push("Public assets require a separate R2_PUBLIC_BUCKET_NAME");
    }
  }
  if(!/^[A-Za-z0-9_]+$/.test(env.DB_NAME||""))errors.push("DB_NAME must be a simple database identifier");
  if(env.DB_USER==="root")errors.push("Use an application-specific MySQL user");
  if(String(env.JWT_SECRET||"").length<32)errors.push("JWT_SECRET must contain at least 32 characters");
  const encryption=env.SMTP_ENCRYPTION_KEY||"";
  if(Buffer.byteLength(encryption)!==32&&!/^[a-f0-9]{64}$/i.test(encryption))errors.push("SMTP_ENCRYPTION_KEY must be 32 bytes or 64 hex characters");
  for(const value of [env.PUBLIC_BASE_URL,...String(env.ALLOWED_ORIGINS||"").split(",").map(item=>item.trim())]){
    try{const url=new URL(value);if(url.protocol!=="https:"||url.origin!==value||url.hostname.includes("*")||url.username||url.password)throw new Error();}
    catch(_){errors.push("API and allowed frontend origins must be exact HTTPS origins");break;}
  }
  if(env.WA_DATA_DIR){const target=path.resolve(env.WA_DATA_DIR),app=path.resolve(__dirname,"..");if(target===path.parse(target).root||target===app||target.startsWith(app+path.sep))errors.push("Keep WA_DATA_DIR outside the backend checkout and filesystem root");}
  if(env.AUTH_COOKIE_SAME_SITE&&!["lax","strict","none"].includes(env.AUTH_COOKIE_SAME_SITE))errors.push("Invalid AUTH_COOKIE_SAME_SITE");
  if((env.AUTH_COOKIE_SAME_SITE||"lax")!=="none"){
    const domain=String(env.AUTH_COOKIE_SITE_DOMAIN||"").toLowerCase();
    if(!domain.includes(".")||domain.includes("/"))errors.push("Set AUTH_COOKIE_SITE_DOMAIN to the business domain used by both app and API");
    else for(const value of [env.PUBLIC_BASE_URL,...String(env.ALLOWED_ORIGINS||"").split(",").map(item=>item.trim())]){
      try{const host=new URL(value).hostname;if(host!==domain&&!host.endsWith(`.${domain}`))throw new Error();}
      catch(_){errors.push("Lax/strict cookies require app and API origins under AUTH_COOKIE_SITE_DOMAIN; attach a custom app domain in Vercel");break;}
    }
  }
  return errors;
}
function load(){const file=path.resolve(__dirname,"../.env");if(require("node:fs").existsSync(file))process.loadEnvFile(file);}
async function main(){
  load();
  const errors=validate(process.env);
  if(errors.length){console.error(errors.map(error=>`- ${error}`).join("\n"));process.exitCode=1;return;}
  if(process.argv.includes("--database")){
    const connection=await require("mysql2/promise").createConnection({host:process.env.DB_HOST,port:Number(process.env.DB_PORT)||3306,user:process.env.DB_USER,password:process.env.DB_PASS,database:process.env.DB_NAME,connectTimeout:5000});
    try{await connection.query("SELECT 1");}finally{await connection.end();}
  }
  console.log("PASS: production configuration"+(process.argv.includes("--database")?" and read-only database connection":""));
}
if(require.main===module)main().catch(()=>{console.error("Production database preflight failed; verify connectivity and credentials");process.exitCode=1;});
module.exports={validate,load};
