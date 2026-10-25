"use strict";
const path=require("node:path");
require("dotenv").config({path:path.resolve(__dirname,"../.env"),quiet:true});
async function check(env=process.env){
  const result={engine:require("../config/databaseEngine").usesSqlite(env)?"sqlite":"mysql",host:env.DB_HOST||"127.0.0.1",port:Number(env.DB_PORT)||3306,database:env.DB_NAME||"madhura_wa",connected:false};
  let connection;
  try{
    if(result.engine!=="mysql")throw Object.assign(new Error("Select DB_ENGINE=mysql and USE_SQLITE=0"),{code:"MYSQL_NOT_SELECTED"});
    connection=await require("mysql2/promise").createConnection({host:result.host,port:result.port,user:env.DB_USER,password:env.DB_PASS,database:result.database,connectTimeout:5000});
    await connection.query("SELECT 1");result.connected=true;
    const [tables]=await connection.query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('plans','billing_orders','browser_sessions','organization_memberships')");
    const found=new Set(tables.map(row=>row.TABLE_NAME));result.missingTables=["plans","billing_orders","browser_sessions","organization_memberships"].filter(table=>!found.has(table));
    if(found.has("plans")){const [[counts]]=await connection.query("SELECT COUNT(*) AS count FROM plans WHERE is_active=1");result.activePlans=Number(counts.count);}
  }catch(error){result.error=error.code||"MYSQL_CHECK_FAILED";}
  finally{if(connection)await connection.end();}
  return result;
}
if(require.main===module)check().then(result=>{console.log(JSON.stringify(result));if(!result.connected)process.exitCode=1;}).catch(()=>{console.error("MySQL check failed");process.exitCode=1;});
module.exports={check};
