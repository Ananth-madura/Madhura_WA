"use strict";
const fs=require("node:fs");
const path=require("node:path");
const os=require("node:os");
const {spawn}=require("node:child_process");
function run(command,args,env,capture=false) {
  return new Promise((resolve,reject)=>{
    const child=spawn(command,args,{env,stdio:["ignore",capture?"pipe":"ignore","inherit"]});let output="";
    if(capture)child.stdout.on("data",chunk=>{output+=chunk;if(output.length>1048576)child.kill();});
    child.on("error",reject);child.on("exit",code=>code===0?resolve(output):reject(new Error("Backup command failed")));
  });
}
async function main(){
  const file=path.resolve(__dirname,"../.env");if(fs.existsSync(file))process.loadEnvFile(file);
  const env={...process.env,GOMAXPROCS:process.env.GOMAXPROCS||"2",GOMEMLIMIT:process.env.GOMEMLIMIT||"256MiB"};
  if(env.DB_ENGINE!=="mysql"||!/^\w+$/.test(env.DB_NAME||"")||!env.DB_HOST||!env.RESTIC_REPOSITORY||!env.RESTIC_PASSWORD_FILE)throw new Error("Configure MySQL, RESTIC_REPOSITORY and RESTIC_PASSWORD_FILE");
  if(!env.RESTIC_REPOSITORY.startsWith("s3:https://"))throw new Error("Configure an HTTPS S3 off-server backup repository");
  if(!path.isAbsolute(env.RESTIC_PASSWORD_FILE)||!fs.existsSync(env.RESTIC_PASSWORD_FILE))throw new Error("Backup password file is unavailable");
  if(env.R2_BACKUP_ACCESS_KEY_ID)env.AWS_ACCESS_KEY_ID=env.R2_BACKUP_ACCESS_KEY_ID;
  if(env.R2_BACKUP_SECRET_ACCESS_KEY)env.AWS_SECRET_ACCESS_KEY=env.R2_BACKUP_SECRET_ACCESS_KEY;
  env.AWS_DEFAULT_REGION=env.AWS_DEFAULT_REGION||"auto";
  env.RESTIC_CACHE_DIR=env.RESTIC_CACHE_DIR||path.join(env.WA_DATA_DIR||"/var/data",".cache/restic");
  const help=await run("restic",["backup","--help"],env,true);
  if(!help.includes("--stdin-from-command"))throw new Error("Install a restic version with --stdin-from-command support");
  if(process.argv.includes("--maintenance")){
    await run("restic",["check"],env);await run("restic",["prune"],env);
    console.log("PASS: backup repository metadata check and unreferenced-data cleanup");return;
  }
  const host=env.BACKUP_HOST_ID||os.hostname();
  await run("restic",["backup","--tag","wa-crm-mysql","--host",host,"--stdin-filename",`${env.DB_NAME}.sql`,"--stdin-from-command","--","mysqldump",`--login-path=${env.MYSQL_BACKUP_LOGIN_PATH||"wa-crm-backup"}`,`--host=${env.DB_HOST}`,`--port=${Number(env.DB_PORT)||3306}`,"--single-transaction","--quick","--no-tablespaces","--routines","--triggers",env.DB_NAME],env);
  await run("restic",["forget","--tag","wa-crm-mysql","--host",host,"--group-by","host,paths","--keep-daily","7","--keep-weekly","4","--keep-monthly","3"],env);
  const directory=path.join(env.WA_DATA_DIR||"/var/data","backups");fs.mkdirSync(directory,{recursive:true,mode:0o700});
  const status=path.join(directory,"last-success.json"),temporary=status+".tmp";
  fs.writeFileSync(temporary,JSON.stringify({at:new Date().toISOString(),source:"mysql",encrypted:true}),{mode:0o600});fs.renameSync(temporary,status);
  console.log("PASS: encrypted MySQL snapshot and backup retention; no plaintext SQL dump was saved on VPS disk");
}
if(require.main===module)main().catch(error=>{console.error(error.message.startsWith("Configure")||error.message.startsWith("Install")?error.message:"MySQL backup failed; inspect the private service journal");process.exitCode=1;});
module.exports={run};
