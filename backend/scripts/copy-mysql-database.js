"use strict";
const fs=require("node:fs"),path=require("node:path"),{spawnSync}=require("node:child_process");
require("dotenv").config({path:path.resolve(__dirname,"../.env"),quiet:true});
const quote=value=>"`"+value.replace(/`/g,"``")+"`";
async function main(){
  const [source,target]=process.argv.slice(2);
  if(!/^[A-Za-z0-9_]+$/.test(source||"")||!/^[A-Za-z0-9_]+$/.test(target||"")||source===target)throw new Error("Usage: node scripts/copy-mysql-database.js SOURCE NEW_TARGET");
  const env=process.env,connection=await require("mysql2/promise").createConnection({host:env.DB_HOST||"127.0.0.1",port:Number(env.DB_PORT)||3306,user:env.DB_USER,password:env.DB_PASS});
  try{
    const [existing]=await connection.query("SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME=?",[target]);
    if(existing.length)throw new Error("Target database already exists. Refusing to overwrite it.");
    const [tables]=await connection.query("SELECT TABLE_NAME,TABLE_TYPE FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=? ORDER BY TABLE_NAME",[source]);
    if(!tables.length)throw new Error("Source database is missing or empty");
    const [[objects]]=await connection.query("SELECT (SELECT COUNT(*) FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_SCHEMA=?) + (SELECT COUNT(*) FROM INFORMATION_SCHEMA.EVENTS WHERE EVENT_SCHEMA=?) AS count",[source,source]);
    if(tables.some(row=>row.TABLE_TYPE!=="BASE TABLE")||Number(objects.count))throw new Error("Views, routines or events need an explicit reference migration before copying");
    const backup=path.resolve(__dirname,`../../scratch/flows-database-${source}-${Date.now()}.sql`);
    fs.mkdirSync(path.dirname(backup),{recursive:true});
    const bin=env.MYSQL_BIN_DIR||(process.platform==="win32"?"C:/Program Files/MySQL/MySQL Server 8.0/bin":"");
    const executable=name=>bin?path.join(bin,name+(process.platform==="win32"?".exe":"")):name;
    const options=["--host="+(env.DB_HOST||"127.0.0.1"),"--port="+(env.DB_PORT||3306),"--user="+env.DB_USER];
    const childEnv={...env,MYSQL_PWD:env.DB_PASS||""};
    let file=fs.openSync(backup,"w"),result;
    try{result=spawnSync(executable("mysqldump"),[...options,"--single-transaction","--triggers","--no-tablespaces","--set-gtid-purged=OFF",source],{env:childEnv,stdio:["ignore",file,"pipe"],timeout:120000});}finally{fs.closeSync(file);}
    if(result.status!==0)throw new Error("Backup failed; database copy was not started");
    await connection.query(`CREATE DATABASE ${quote(target)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    file=fs.openSync(backup,"r");
    try{result=spawnSync(executable("mysql"),[...options,"--binary-mode=1","--database="+target],{env:childEnv,stdio:[file,"ignore","pipe"],timeout:120000});}finally{fs.closeSync(file);}
    if(result.status!==0)throw new Error("Restore failed. Source and SQL backup are preserved; inspect the new target before retrying.");
    let rows=0;
    for(const {TABLE_NAME:name} of tables){
      const [[counts]]=await connection.query(`SELECT (SELECT COUNT(*) FROM ${quote(source)}.${quote(name)}) AS original,(SELECT COUNT(*) FROM ${quote(target)}.${quote(name)}) AS copied`);
      if(String(counts.original)!==String(counts.copied))throw new Error(`Row-count verification failed for ${name}; app configuration was not changed`);
      const [checksums]=await connection.query(`CHECKSUM TABLE ${quote(source)}.${quote(name)},${quote(target)}.${quote(name)} EXTENDED`);
      if(checksums.length!==2||checksums.some(row=>row.Checksum==null)||String(checksums[0].Checksum)!==String(checksums[1].Checksum))throw new Error(`Content verification failed for ${name}; app configuration was not changed`);
      rows+=Number(counts.original);
    }
    console.log(JSON.stringify({source,target,tablesVerified:tables.length,rowsVerified:rows,backup,sourcePreserved:true}));
  }finally{await connection.end();}
}
main().catch(error=>{console.error(error.code||error.message);process.exitCode=1;});
